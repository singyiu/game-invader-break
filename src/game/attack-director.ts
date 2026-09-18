import type { GameState, Projectile, Enemy, Ball } from "../shared/contracts";
import { TUNING as T } from "../content/tuning";
import { liveBalls } from "./powers";
import { difficultyForLevel } from "./difficulty";
import { emit } from "./events";
import { flightHazard, planFlight } from "./flight";
type Hazard = Projectile & { halfHeight?: number };
interface Catch {
  time: number;
  x: number;
  intervals: { left: number; right: number; width: number }[];
}
function reflected(x: number, r: number) {
  const w = 100 - 2 * r;
  const m = (((x - r) % (2 * w)) + 2 * w) % (2 * w);
  return r + (m > w ? 2 * w - m : m);
}
export function predictCatch(s: GameState, b: Ball = s.ball): Catch | null {
  if (s.serveRemaining > 0 || b.vy <= 0) return null;
  const time = (T.paddleY - T.paddleHeight / 2 - b.radius - b.y) / b.vy;
  if (time < 0 || time > 3) return null;
  // A formation contact before the paddle makes a single straight forecast unsafe.
  if (
    s.enemies.some(
      (e) =>
        e.phase !== "diving" &&
        e.y + e.height / 2 + b.radius > b.y &&
        e.y - e.height / 2 < T.paddleY,
    )
  )
    return null;
  const x = reflected(b.x + b.vx * time, b.radius);
  const reach = Math.max(0, time - T.controlDelay) * T.reachableSpeed;
  const intervals = s.paddles
    .map((p) => ({
      left: Math.max(p.width / 2, p.x - reach, x - p.width / 2 + b.radius),
      right: Math.min(
        100 - p.width / 2,
        p.x + reach,
        x + p.width / 2 - b.radius,
      ),
      width: p.width,
    }))
    .filter((i) => i.left <= i.right);
  return { time, x, intervals };
}
function safe(hazards: Hazard[], catchInfo: Catch) {
  for (const lane of catchInfo.intervals) {
    let pieces = [{ left: lane.left, right: lane.right }];
    for (const h of hazards) {
      const height = h.halfHeight ?? h.radius;
      const top = T.paddleY - T.paddleHeight / 2 - height;
      const bottom = T.paddleY + T.paddleHeight / 2 + height;
      if (h.vy === 0 && (h.y < top || h.y > bottom)) continue;
      const first = h.vy === 0 ? -Infinity : (top - h.y) / h.vy;
      const last = h.vy === 0 ? Infinity : (bottom - h.y) / h.vy;
      // A shot keeps moving horizontally throughout its vertical overlap.
      // Reserve that full swept footprint within the conservative catch window,
      // including overlaps that began before the current simulation instant.
      const enter = Math.max(0, catchInfo.time - 0.3, Math.min(first, last));
      const leave = Math.min(catchInfo.time + 0.3, Math.max(first, last));
      if (enter > leave) continue;
      const x1 = h.x + h.vx * enter,
        x2 = h.x + h.vx * leave;
      const r = lane.width / 2 + h.radius + 1.2;
      const blockedLeft = Math.min(x1, x2) - r,
        blockedRight = Math.max(x1, x2) + r;
      pieces = pieces.flatMap((p) => {
        if (blockedRight < p.left || blockedLeft > p.right) return [p];
        return [
          { left: p.left, right: Math.min(p.right, blockedLeft) },
          { left: Math.max(p.left, blockedRight), right: p.right },
        ].filter((v) => v.right - v.left > 0.2);
      });
    }
    if (pieces.length) return true;
  }
  return false;
}
function divers(s: GameState): Hazard[] {
  return s.enemies
    .filter((e) => e.phase === "diving")
    .map((e) => flightHazard(e, s.wave));
}
export function canCommit(s: GameState, candidate: Hazard) {
  return liveBalls(s).some((b) => {
    const c = predictCatch(s, b);
    return c !== null && safe([...s.projectiles, ...divers(s), candidate], c);
  });
}
export function revalidateHazards(s: GameState) {
  const catches = liveBalls(s)
    .map((b) => predictCatch(s, b))
    .filter((c): c is Catch => c !== null && c.intervals.length > 0);
  if (!catches.length) return;
  const safeCatch = (hazards: Hazard[]) =>
    catches.some((c) => safe(hazards, c));
  const all = [...s.projectiles, ...divers(s)].sort((a, b) => a.id - b.id);
  if (safeCatch(all)) return;
  // At most two shots and one diver: enumerate subsets, fewest removals first.
  for (let count = 1; count <= all.length; count++)
    for (let mask = 1; mask < 1 << all.length; mask++) {
      const removed = all.filter((_, i) => mask & (1 << i));
      if (
        removed.length !== count ||
        !safeCatch(all.filter((_, i) => !(mask & (1 << i))))
      )
        continue;
      for (const h of removed) {
        s.projectiles = s.projectiles.filter((p) => p.id !== h.id);
        s.enemies = s.enemies.filter((e) => e.id !== h.id);
        s.fairnessInterventions++;
        emit(s, "neutralize", h.x, h.y, h.id, undefined, "safe catch");
      }
      return;
    }
}
function candidate(s: GameState, e: Enemy): Projectile {
  const lane = e.lane;
  const flight = Math.max(
    1.15,
    (T.paddleY - e.y) / (38 * difficultyForLevel(s.wave).hazardSpeed),
  );
  return {
    id: s.nextId,
    x: e.x,
    y: e.y,
    vx: (lane - e.x) / flight,
    vy: (T.paddleY - e.y) / flight,
    radius: 0.7,
    sourceId: e.id,
  };
}
export function updateAttacks(s: GameState, dt: number) {
  if (s.practice || s.serveRemaining > 0 || s.status !== "playing") return;
  s.attackTimer -= dt;
  for (const e of s.enemies) {
    if (e.phase !== "telegraph") continue;
    e.phaseTime += dt;
    if (e.phaseTime < T.windup) continue;
    if (e.flight || e.kind === "lancer") {
      e.flight ??= planFlight(e, s.wave);
      const proposed = flightHazard(e, s.wave);
      if (
        s.enemies.filter((a) => a.phase === "diving").length === 0 &&
        (T.paddleY - T.paddleHeight / 2 - e.height / 2 - e.y) / proposed.vy >=
          T.flight &&
        canCommit(s, proposed)
      ) {
        e.phase = "diving";
        e.phaseTime = 0;
        emit(s, "shot", e.x, e.y, e.id, undefined, "dive");
      } else {
        e.phase = "formation";
        e.phaseTime = 0;
        delete e.flight;
      }
    } else {
      const p = candidate(s, e);
      if (s.projectiles.length < (s.wave === 2 ? 1 : 2) && canCommit(s, p)) {
        p.id = s.nextId++;
        s.projectiles.push(p);
        emit(s, "shot", p.x, p.y, e.id);
      }
      e.phase = "formation";
      e.phaseTime = 0;
    }
  }
  if (s.attackTimer > 0) return;
  s.attackTimer =
    (s.enemies.some((e) => e.kind === "conductor") ? 1.1 : 1.9) *
    difficultyForLevel(s.wave).attackIntervalScale;
  const ready = s.enemies
    .filter(
      (e) =>
        e.phase === "formation" &&
        // A returning lancer must resume formation before planning another dive.
        (e.kind !== "lancer" || e.phaseTime > 0) &&
        (["spitter", "lancer", "conductor", "petal", "core"].includes(e.kind) ||
          (e.kind === "drone" && s.wave >= 3 && e.phaseTime >= 6)),
    )
    .sort((a, b) => a.id - b.id);
  if (!ready.length) return;
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  const flightBusy = s.enemies.some(
    (a) => a.phase === "diving" || (a.phase === "telegraph" && a.flight),
  );
  // A lingering formation eventually sends a diver, even among many shooters.
  const agedDivers = flightBusy
    ? []
    : ready.filter(
        (e) => ["drone", "lancer"].includes(e.kind) && e.phaseTime >= 6,
      );
  const choices = agedDivers.length ? agedDivers : ready;
  const e = choices[s.rng % choices.length];
  const dives = e.kind === "lancer" || e.kind === "drone";
  if (dives && flightBusy) return;
  if (
    !dives &&
    s.projectiles.length +
      s.enemies.filter((a) => a.phase === "telegraph" && !a.flight).length >=
      2
  )
    return;
  const target = s.paddles[(s.rng >>> 8) % s.paddles.length];
  e.lane = dives ? e.x : (target?.x ?? 50);
  if (dives) e.flight = planFlight(e, s.wave);
  if (!canCommit(s, dives ? flightHazard(e, s.wave) : candidate(s, e))) {
    delete e.flight;
    return;
  }
  e.phase = "telegraph";
  e.phaseTime = 0;
  emit(s, "telegraph", e.lane, e.y, e.id, T.windup, dives ? "dive" : "shot");
}
