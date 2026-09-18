import type {
  GameState,
  PaddleIntent,
  Paddle,
  TimedPowerKind,
} from "../shared/contracts";
import { TUNING as T } from "../content/tuning";
import { paddleIntervals, sweepRect, sweepCircle } from "./collisions";
import { damage, drain } from "./damage";
import { emit } from "./events";
import { startWave, updateEncounters, moveFormation } from "./encounters";
import { precisionReturn, awardKill, awardPoints } from "./scoring";
import { isVulnerable, updateBoss } from "./boss";
import { updateAttacks, revalidateHazards } from "./attack-director";
import { difficultyForLevel } from "./difficulty";
import { flightDuration, flightPosition } from "./flight";
import {
  liveBalls,
  paddleWidthForMode,
  restoreMultiball,
  activatePower,
  expirePower,
  TIMED_POWERS,
} from "./powers";
const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));
type Hit = {
  t: number;
  type:
    | "wall"
    | "paddle"
    | "drain"
    | "shot"
    | "body"
    | "enemy"
    | "intercept"
    | "pickup"
    | "expiry"
    | "flight-turn"
    | "flight-return";
  id: number;
  ballId?: number;
  powerKind?: TimedPowerKind;
  nx?: number;
  ny?: number;
};
export function continueSector(s: GameState) {
  if (s.status === "rest" && s.restRemaining <= 4) {
    s.status = "playing";
    s.restRemaining = 0;
    startWave(s, s.wave + 1);
  }
}
export function stepGame(
  s: GameState,
  intent: PaddleIntent,
  dt: number = T.step,
) {
  if (
    intent.paused ||
    intent.mode === 0 ||
    intent.status !== "stable" ||
    s.status === "won" ||
    s.status === "lost" ||
    !Number.isFinite(dt) ||
    dt <= 0 ||
    dt > 0.05
  )
    return (s.events = []);
  s.events = [];
  const previous = s.paddles.map((p) => ({ ...p }));
  const targets = intent.targets.slice(0, intent.mode);
  const paddleWidth = paddleWidthForMode(s, intent.mode);
  const next: Paddle[] = targets.map((p) => ({
    id: p.id,
    x: clamp(p.x * 100, paddleWidth / 2, 100 - paddleWidth / 2),
    y: T.paddleY,
    width: paddleWidth,
    height: T.paddleHeight,
  }));
  const changed =
    next.length !== previous.length ||
    next.some(
      (p) => !previous.some((old) => old.id === p.id && old.width === p.width),
    );
  const history = intent.mode === 1 ? "one" : "two";
  if (s.controlHistory === "none") s.controlHistory = history;
  else if (s.controlHistory !== history) s.controlHistory = "mixed";
  if (changed) {
    s.transitions++;
    s.paddles = next;
    // Only contacts created by the new geometry are harmless. An existing
    // overlap, or a later swept entry, still follows ordinary damage rules.
    const newlyEnclosed = (
      x: number,
      y: number,
      halfWidth: number,
      halfHeight: number,
    ) => {
      const overlaps = (p: Paddle) =>
        Math.abs(x - p.x) <= p.width / 2 + halfWidth &&
        Math.abs(y - p.y) <= p.height / 2 + halfHeight;
      return next.some(overlaps) && !previous.some(overlaps);
    };
    s.projectiles = s.projectiles.filter((p) => {
      if (!newlyEnclosed(p.x, p.y, p.radius, p.radius)) return true;
      emit(s, "neutralize", p.x, p.y, p.id, undefined, "reconfiguration");
      return false;
    });
    s.enemies = s.enemies.filter((e) => {
      if (
        e.phase !== "diving" ||
        !newlyEnclosed(e.x, e.y, e.width / 2, e.height / 2)
      )
        return true;
      emit(s, "neutralize", e.x, e.y, e.id, undefined, "reconfiguration");
      return false;
    });
    for (const b of liveBalls(s))
      if (
        next.some(
          (p) =>
            Math.abs(b.x - p.x) <= p.width / 2 + b.radius &&
            Math.abs(b.y - p.y) <= p.height / 2 + b.radius,
        )
      ) {
        b.y = T.paddleY - T.paddleHeight / 2 - b.radius - 0.001;
        b.vy = -Math.abs(b.vy);
      }
  }
  const starts = changed ? next : previous;
  const velocity = new Map(
    next.map((p) => [
      p.id,
      (p.x - (starts.find((a) => a.id === p.id)?.x ?? p.x)) / dt,
    ]),
  );
  s.paddles = starts.map((p) => ({ ...p }));
  s.tick++;
  if (s.status === "rest") {
    s.time += dt;
    s.restRemaining = Math.max(0, s.restRemaining - dt);
    s.paddles = next;
    if (s.restRemaining === 0) continueSector(s);
    return s.events;
  }
  const enemyStarts = new Map(s.enemies.map((e) => [e.id, { x: e.x, y: e.y }]));
  const serving = s.serveRemaining > 0;
  moveFormation(s, dt);
  const enemyVelocity = new Map(
    s.enemies.map((e) => {
      const start = enemyStarts.get(e.id)!;
      if (e.phase === "diving" && !e.flight && !serving)
        e.y += 28 * difficultyForLevel(s.wave).hazardSpeed * dt;
      const v = { x: (e.x - start.x) / dt, y: (e.y - start.y) / dt };
      e.x = start.x;
      e.y = start.y;
      return [e.id, v] as const;
    }),
  );
  if (changed) revalidateHazards(s);
  if (serving) {
    s.serveRemaining = Math.max(0, s.serveRemaining - dt);
    s.ball.x = next[0]?.x ?? 50;
    s.ball.y = 84;
    const speed = s.practice ? 32 : difficultyForLevel(s.wave).ballSpeed;
    s.ball.vx = 15;
    s.ball.vy = -Math.sqrt(speed * speed - 225);
    restoreMultiball(s);
    for (const [i, b] of s.extraBalls.entries()) {
      b.x = s.ball.x;
      b.y = s.ball.y;
      const angle = i === 0 ? -0.35 : 0.35;
      b.vx = s.ball.vx * Math.cos(angle) - s.ball.vy * Math.sin(angle);
      b.vy = s.ball.vx * Math.sin(angle) + s.ball.vy * Math.cos(angle);
    }
  }
  let remaining = dt,
    iterations = 0;
  const touched = new Set<string>();
  const pierced = new Set<number>();
  while (remaining > 1e-8 && iterations++ < 96 && s.status === "playing") {
    const candidates: Hit[] = [];
    let ballId: number | undefined;
    const add = (hit: Hit) => {
      if (hit.t >= -1e-8 && hit.t <= remaining + 1e-8)
        candidates.push({ ballId, ...hit, t: Math.max(0, hit.t) });
    };
    if (!serving)
      for (const e of s.enemies) {
        if (e.phase !== "diving" || !e.flight) continue;
        const duration = flightDuration(e.flight);
        const returning = e.phaseTime >= duration;
        const boundary = returning ? 2 * duration : duration;
        const untilBoundary = Math.max(0, boundary - e.phaseTime);
        const travel = Math.min(remaining, untilBoundary);
        const end = flightPosition(e.flight, e.phaseTime + travel);
        enemyVelocity.set(e.id, {
          x: travel > 0 ? (end.x - e.x) / travel : 0,
          y: travel > 0 ? (end.y - e.y) / travel : 0,
        });
        // Split at the reversal so a single sweep never cuts across the turn.
        add({
          t: untilBoundary,
          type: returning ? "flight-return" : "flight-turn",
          id: e.id,
        });
      }
    if (!serving && s.serveRemaining === 0) {
      for (const b of liveBalls(s)) {
        ballId = b.id;
        if (b.vx < 0)
          add({ t: (b.radius - b.x) / b.vx, type: "wall", id: -3, nx: 1 });
        if (b.vx > 0)
          add({
            t: (100 - b.radius - b.x) / b.vx,
            type: "wall",
            id: -2,
            nx: -1,
          });
        if (b.vy < 0)
          add({ t: (b.radius - b.y) / b.vy, type: "wall", id: -1, ny: 1 });
        // A shrinking radius can move the drain plane above a live ball.
        // Process that crossed boundary now, through the ordinary shared drain
        // path, so survivor promotion and last-ball recovery remain chronological.
        if (b.y >= 100 + b.radius) add({ t: 0, type: "drain", id: 0 });
        else if (b.vy > 0)
          add({ t: (100 + b.radius - b.y) / b.vy, type: "drain", id: 0 });
        for (const p of s.paddles) {
          const t = (p.y - p.height / 2 - b.radius - b.y) / b.vy;
          if (b.vy > 0 && t >= -1e-8 && t <= remaining) {
            const x = b.x + b.vx * t,
              px = p.x + (velocity.get(p.id) ?? 0) * t;
            if (Math.abs(x - px) <= p.width / 2 + b.radius)
              add({ t, type: "paddle", id: p.id });
          }
        }
        for (const e of s.enemies) {
          if (touched.has(`${b.id}:${e.id}`)) continue;
          const enclosed =
            Math.abs(b.x - e.x) < e.width / 2 + b.radius &&
            Math.abs(b.y - e.y) < e.height / 2 + b.radius;
          const hit = enclosed
            ? { t: 0, nx: 0, ny: -Math.sign(b.vy) }
            : sweepRect(
                b.x,
                b.y,
                b.vx - (enemyVelocity.get(e.id)?.x ?? 0),
                b.vy - (enemyVelocity.get(e.id)?.y ?? 0),
                e.x - e.width / 2 - b.radius,
                e.y - e.height / 2 - b.radius,
                e.x + e.width / 2 + b.radius,
                e.y + e.height / 2 + b.radius,
                remaining,
              );
          if (hit) add({ ...hit, type: "enemy", id: e.id });
        }
        if (b.vy < 0)
          for (const p of s.projectiles) {
            const t = sweepCircle(
              b.x - p.x,
              b.y - p.y,
              b.vx - p.vx,
              b.vy - p.vy,
              b.radius + p.radius,
              remaining,
            );
            if (t !== null) add({ t, type: "intercept", id: p.id });
          }
      }
      ballId = undefined;
      for (const kind of TIMED_POWERS)
        if (s.powers[kind] > 0)
          add({ t: s.powers[kind], type: "expiry", id: -10, powerKind: kind });
      for (const item of s.pickups)
        for (const p of s.paddles) {
          const enclosed =
            Math.abs(item.x - p.x) <= p.width / 2 + item.radius &&
            Math.abs(item.y - p.y) <= p.height / 2 + item.radius;
          const contact = enclosed
            ? { t: 0 }
            : sweepRect(
                item.x,
                item.y,
                -(velocity.get(p.id) ?? 0),
                item.vy,
                p.x - p.width / 2 - item.radius,
                p.y - p.height / 2 - item.radius,
                p.x + p.width / 2 + item.radius,
                p.y + p.height / 2 + item.radius,
                remaining,
              );
          if (contact) add({ t: contact.t, type: "pickup", id: item.id });
        }
    }
    for (const p of s.projectiles)
      for (const paddle of s.paddles) {
        if (
          Math.abs(p.x - paddle.x) < paddle.width / 2 + p.radius &&
          Math.abs(p.y - paddle.y) < paddle.height / 2 + p.radius
        ) {
          add({ t: 0, type: "shot", id: p.id });
          continue;
        }
        const hit = sweepRect(
          p.x,
          p.y,
          p.vx - (velocity.get(paddle.id) ?? 0),
          p.vy,
          paddle.x - paddle.width / 2 - p.radius,
          paddle.y - paddle.height / 2 - p.radius,
          paddle.x + paddle.width / 2 + p.radius,
          paddle.y + paddle.height / 2 + p.radius,
          remaining,
        );
        if (hit) add({ ...hit, type: "shot", id: p.id });
      }
    for (const e of s.enemies)
      if (e.phase === "diving")
        for (const p of s.paddles) {
          if (
            Math.abs(e.x - p.x) < (p.width + e.width) / 2 &&
            Math.abs(e.y - p.y) < (p.height + e.height) / 2
          ) {
            add({ t: 0, type: "body", id: e.id });
            continue;
          }
          const hit = sweepRect(
            e.x,
            e.y,
            (enemyVelocity.get(e.id)?.x ?? 0) - (velocity.get(p.id) ?? 0),
            enemyVelocity.get(e.id)?.y ?? 0,
            p.x - (p.width + e.width) / 2,
            p.y - (p.height + e.height) / 2,
            p.x + (p.width + e.width) / 2,
            p.y + (p.height + e.height) / 2,
            remaining,
          );
          if (hit) add({ ...hit, type: "body", id: e.id });
        }
    candidates.sort(
      (a, b) =>
        a.t - b.t ||
        a.id - b.id ||
        (a.ballId ?? -1) - (b.ballId ?? -1) ||
        a.type.localeCompare(b.type),
    );
    const hit = candidates[0];
    const elapsed = hit?.t ?? remaining;
    const expiring =
      !serving && s.serveRemaining === 0
        ? TIMED_POWERS.filter(
            (kind) => s.powers[kind] > 0 && s.powers[kind] <= elapsed + 1e-10,
          )
        : [];
    if (!serving && s.serveRemaining === 0) {
      for (const b of liveBalls(s)) {
        b.x += b.vx * elapsed;
        b.y += b.vy * elapsed;
      }
      for (const p of s.pickups) p.y += p.vy * elapsed;
      for (const kind of TIMED_POWERS)
        s.powers[kind] = Math.max(0, s.powers[kind] - elapsed);
    }
    for (const p of s.projectiles) {
      p.x += p.vx * elapsed;
      p.y += p.vy * elapsed;
    }
    for (const e of s.enemies) {
      const v = enemyVelocity.get(e.id);
      if (v) {
        e.x += v.x * elapsed;
        e.y += v.y * elapsed;
        if (e.phase === "diving" && !serving) e.phaseTime += elapsed;
      }
    }
    for (const p of s.paddles) p.x += (velocity.get(p.id) ?? 0) * elapsed;
    s.time += elapsed;
    remaining -= elapsed;
    if (!hit) break;
    const b = liveBalls(s).find((b) => b.id === hit.ballId) ?? s.ball;
    for (const kind of expiring) expirePower(s, kind);
    if (hit.type === "flight-turn" || hit.type === "flight-return") {
      const e = s.enemies.find((enemy) => enemy.id === hit.id);
      if (e?.flight) {
        e.phaseTime =
          flightDuration(e.flight) * (hit.type === "flight-return" ? 2 : 1);
        Object.assign(e, flightPosition(e.flight, e.phaseTime));
        if (hit.type === "flight-return") {
          e.phase = "formation";
          e.phaseTime = 0;
          delete e.flight;
          enemyVelocity.set(e.id, { x: 0, y: 0 });
        }
      }
    }
    if (hit.type === "pickup") {
      const item = s.pickups.find((p) => p.id === hit.id);
      if (item) {
        s.pickups = s.pickups.filter((p) => p.id !== hit.id);
        activatePower(s, item.kind);
      }
    }
    if (hit.type === "expiry" || hit.type === "pickup") {
      for (const p of next) {
        p.width = paddleWidthForMode(s, intent.mode);
        p.x = clamp(p.x, p.width / 2, 100 - p.width / 2);
        const current = s.paddles.find((a) => a.id === p.id);
        if (current)
          velocity.set(p.id, remaining > 0 ? (p.x - current.x) / remaining : 0);
      }
      revalidateHazards(s);
    }
    if (hit.type === "wall") {
      if (hit.nx) b.vx = -b.vx;
      if (hit.ny) b.vy = -b.vy;
      b.x += (hit.nx ?? 0) * 0.0001;
      b.y += (hit.ny ?? 0) * 0.0001;
      emit(s, "wall-hit", b.x, b.y);
    }
    if (hit.type === "paddle") {
      const intervals = paddleIntervals(s.paddles)
        .filter(
          (p) =>
            b.x >= p.left - b.radius - 1e-6 && b.x <= p.right + b.radius + 1e-6,
        )
        .sort((a, c) => {
          const delta =
            Math.abs(b.x - (a.left + a.right) / 2) -
            Math.abs(b.x - (c.left + c.right) / 2);
          return Math.abs(delta) > 1e-8 ? delta : a.id - c.id;
        });
      const p = intervals[0];
      if (p) {
        const offset = clamp(
          (b.x - (p.left + p.right) / 2) / ((p.right - p.left) / 2),
          -1,
          1,
        );
        const angle =
          (Math.max(T.minAngle, Math.abs(offset) * T.maxAngle) *
            Math.sign(offset || b.vx || 1) *
            Math.PI) /
          180;
        const speed = s.practice
          ? 32
          : Math.min(
              T.maxSpeed,
              Math.max(
                difficultyForLevel(s.wave).ballSpeed,
                Math.hypot(b.vx, b.vy) + 0.5,
              ),
            );
        b.vx = Math.sin(angle) * speed;
        b.vy = -Math.cos(angle) * speed;
        b.y = T.paddleY - T.paddleHeight / 2 - b.radius - 0.0001;
        s.returns++;
        precisionReturn(s, offset);
        emit(s, "paddle-hit", b.x, b.y, p.id, offset);
      }
    }
    if (hit.type === "drain") {
      if (s.extraBalls.length) {
        if (b.id === s.ball.id) s.ball = s.extraBalls.shift()!;
        else s.extraBalls = s.extraBalls.filter((other) => other.id !== b.id);
      } else drain(s);
    }
    if (hit.type === "shot") {
      const p = s.projectiles.find((p) => p.id === hit.id);
      if (p) {
        damage(s, "projectile", p.x, p.y);
        s.projectiles = s.projectiles.filter((p) => p.id !== hit.id);
      }
    }
    if (hit.type === "body") {
      const e = s.enemies.find((e) => e.id === hit.id);
      if (e) {
        damage(s, "invader body", e.x, e.y);
        s.enemies = s.enemies.filter((e) => e.id !== hit.id);
        emit(s, "enemy-killed", e.x, e.y, e.id, 0, "invader body");
      }
    }
    if (hit.type === "intercept") {
      s.projectiles = s.projectiles.filter((p) => p.id !== hit.id);
      const value = awardPoints(s, 25);
      emit(s, "intercept", b.x, b.y, hit.id, value);
    }
    if (hit.type === "enemy") {
      const e = s.enemies.find((e) => e.id === hit.id);
      if (e) {
        touched.add(`${b.id}:${e.id}`);
        const power = s.overdriveUntil > s.time ? 2 : 1;
        const fire = s.powers.fire > 0;
        const vulnerable = fire || isVulnerable(s, e);
        if (vulnerable) {
          e.hp -= fire ? e.hp : e.kind === "bastion" && b.y < e.y ? 2 : power;
          s.lastEnemyHitAt = s.time;
        }
        emit(
          s,
          "enemy-hit",
          b.x,
          b.y,
          e.id,
          vulnerable ? power : 0,
          vulnerable ? "hit" : "armor",
        );
        if (e.hp <= 0) {
          s.enemies = s.enemies.filter((e) => e.id !== hit.id);
          awardKill(s, e.kind, e.id, e.x, e.y);
          if (e.kind === "core") updateBoss(s);
        }
        if (fire || (e.hp <= 0 && power === 2 && !pierced.has(b.id))) {
          pierced.add(b.id);
        } else {
          if (hit.nx) b.vx = -b.vx;
          if (hit.ny) b.vy = -b.vy;
          b.x += (hit.nx ?? 0) * 0.0001;
          b.y += (hit.ny ?? 0) * 0.0001;
        }
      }
    }
    if (["wall", "paddle", "enemy", "drain"].includes(hit.type))
      revalidateHazards(s);
  }
  s.time += remaining;
  s.paddles = next;
  s.pickups = s.pickups.filter((p) => p.y < 103);
  s.projectiles = s.projectiles.filter((p) => p.y < 103);
  s.enemies = s.enemies.filter((e) => e.y < 105);
  updateAttacks(s, dt);
  updateEncounters(s);
  return s.events;
}
