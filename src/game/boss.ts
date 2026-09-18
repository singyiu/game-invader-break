import type { Enemy, GameState } from "../shared/contracts";
import { difficultyForLevel } from "./difficulty";
import { awardPoints } from "./scoring";
import { ENEMIES } from "../content/enemies";
import { emit } from "./events";
export function bossEnemy(
  s: GameState,
  kind: "petal" | "core" | "lancer",
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
export function startBoss(s: GameState) {
  if (s.wave % 7 !== 0) s.wave = Math.ceil(s.wave / 7) * 7;
  s.status = "playing";
  s.sector = 3;
  s.bossPhase = 1;
  s.enemies = [
    bossEnemy(s, "petal", 28, 27),
    bossEnemy(s, "petal", 50, 19),
    bossEnemy(s, "petal", 72, 27),
  ];
  s.projectiles = [];
  s.serveRemaining = 3;
  s.attackTimer = 2;
  emit(s, "boss-phase", 50, 24, undefined, 1);
}
/** Core armor opens for 3.6 s, then closes for 1.4 s; simulation time is the visible cycle. */
export function isVulnerable(s: GameState, e: Enemy) {
  return e.kind !== "core" || s.bossPhase === 3 || s.time % 5 < 3.6;
}
export function updateBoss(s: GameState) {
  if (s.bossPhase === 0 || s.status !== "playing") return;
  if (s.enemies.length === 0 && s.bossPhase === 1) {
    s.bossPhase = 2;
    s.enemies = [bossEnemy(s, "core", 50, 24)];
    s.projectiles = [];
    s.serveRemaining = 1.2;
    emit(s, "boss-phase", 50, 24, undefined, 2);
  } else if (s.bossPhase >= 2 && !s.enemies.some((e) => e.kind === "core")) {
    s.status = "rest";
    s.restRemaining = 6;
    s.bossesDefeated++;
    if (s.shields === 3) s.perfectBossClears++;
    s.projectiles = [];
    s.enemies = [];
    const value = awardPoints(s, 3000);
    emit(s, "cycle-clear", 50, 25, undefined, value);
  } else if (s.bossPhase === 2 && s.enemies[0].hp <= 3) {
    s.bossPhase = 3;
    s.enemies.push(
      bossEnemy(s, "lancer", 25, 22),
      bossEnemy(s, "lancer", 75, 22),
    );
    emit(s, "boss-phase", 50, 24, undefined, 3);
  }
}
