import type { Enemy, EnemyKind, GameState } from "../shared/contracts";
import { cycleForLevel, difficultyForLevel } from "./difficulty";
import { ENEMIES } from "../content/enemies";
import { WAVES } from "../content/sectors";
import { emit } from "./events";
import { startBoss, updateBoss } from "./boss";
export function spawnEnemy(
  s: GameState,
  kind: EnemyKind,
  x: number,
  y: number,
): Enemy {
  const d = ENEMIES[kind];
  return {
    id: s.nextId++,
    kind,
    x,
    y,
    width: d.width,
    height: d.height,
    hp: d.hp + difficultyForLevel(s.wave).extraHp,
    maxHp: d.hp + difficultyForLevel(s.wave).extraHp,
    phase: "formation",
    phaseTime: 0,
    lane: x,
    originX: x,
    originY: y,
  };
}
export function startWave(s: GameState, wave: number) {
  s.wave = Math.max(1, Math.floor(wave));
  s.status = "playing";
  s.bossPhase = 0;
  const formation = ((s.wave - 1) % 7) + 1;
  if (formation === 7) {
    startBoss(s);
    return;
  }
  s.lastEnemyHitAt = s.time;
  s.lastStallShiftAt = s.time;
  s.sector = Math.ceil(formation / 2);
  s.enemies = [];
  s.projectiles = [];
  s.attackTimer = 2;
  s.serveRemaining = 3;
  s.status = "playing";
  const rows = WAVES[formation - 1].rows;
  rows.forEach((row, r) =>
    row.forEach((kind, c) =>
      s.enemies.push(
        spawnEnemy(
          s,
          cycleForLevel(s.wave) > 1 &&
            kind === "drone" &&
            (c + r + cycleForLevel(s.wave)) % 3 === 0
            ? "spitter"
            : kind,
          50 + (c - (row.length - 1) / 2) * 15,
          20 + r * 10,
        ),
      ),
    ),
  );
  emit(s, "wave-start", 50, 25, undefined, wave);
}
export function updateEncounters(s: GameState) {
  if (s.practice || s.status !== "playing") return;
  if (s.bossPhase) {
    updateBoss(s);
    return;
  }
  if (s.enemies.length) return;
  if ([2, 4].includes(((s.wave - 1) % 7) + 1)) {
    s.status = "rest";
    s.restRemaining = 6;
    s.projectiles = [];
    emit(s, "sector-clear", 50, 40, undefined, s.sector);
  } else startWave(s, s.wave + 1);
}
export function moveFormation(s: GameState, dt: number) {
  if (
    !s.practice &&
    s.serveRemaining === 0 &&
    s.time - Math.max(s.lastEnemyHitAt, s.lastStallShiftAt) >= 8
  )
    s.lastStallShiftAt = s.time;
  for (const e of s.enemies) {
    if (e.phase !== "formation") continue;
    e.phaseTime += dt;
    const amplitude = e.kind === "core" ? 12 : 5;
    const speed =
      (e.kind === "core" ? 0.5 : 0.65) *
      difficultyForLevel(s.wave).formationSpeed;
    e.x +=
      (Math.sin((s.time + dt) * speed + s.wave * 0.7) -
        Math.sin(s.time * speed + s.wave * 0.7)) *
      amplitude;
    if (
      s.lastStallShiftAt > s.lastEnemyHitAt &&
      s.time - s.lastStallShiftAt < 1
    )
      e.x += dt * 5 * (s.wave % 2 ? 1 : -1);
    e.x = Math.max(e.width / 2, Math.min(100 - e.width / 2, e.x));
    e.y +=
      (e.y < 55 ? dt * 0.012 : 0) +
      (Math.sin((s.time + dt) * 0.45 + e.originX * 0.03) -
        Math.sin(s.time * 0.45 + e.originX * 0.03)) *
        0.65;
  }
}
