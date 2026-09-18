import type {
  Ball,
  GameState,
  Paddle,
  PowerKind,
  TimedPowerKind,
} from "../shared/contracts";
import { TUNING as T } from "../content/tuning";
import { emit } from "./events";
export const TIMED_POWERS: TimedPowerKind[] = [
  "giant",
  "wide",
  "multi",
  "fire",
];
const KINDS: PowerKind[] = ["giant", "wide", "multi", "fire", "shield"];
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export const liveBalls = (s: GameState): Ball[] => [s.ball, ...s.extraBalls];
export function paddleWidthForMode(s: GameState, mode: 1 | 2): number {
  return (
    (mode === 2 ? T.splitPaddleWidth : T.paddleWidth) *
    (s.powers.wide > 0 ? 1.5 : 1)
  );
}
/** Apply dimensions immediately, preserving ordinary pre-existing hazard contacts. */
export function syncPowerGeometry(s: GameState) {
  const previous = s.paddles.map((p) => ({ ...p }));
  const width = paddleWidthForMode(s, s.paddles.length === 2 ? 2 : 1);
  for (const p of s.paddles) {
    p.width = width;
    p.x = clamp(p.x, width / 2, 100 - width / 2);
  }
  const newlyEnclosed = (x: number, y: number, rx: number, ry: number) => {
    const overlaps = (p: Paddle) =>
      Math.abs(x - p.x) <= p.width / 2 + rx &&
      Math.abs(y - p.y) <= p.height / 2 + ry;
    return s.paddles.some(overlaps) && !previous.some(overlaps);
  };
  s.projectiles = s.projectiles.filter((p) => {
    if (!newlyEnclosed(p.x, p.y, p.radius, p.radius)) return true;
    emit(s, "neutralize", p.x, p.y, p.id, undefined, "power expansion");
    return false;
  });
  s.enemies = s.enemies.filter((e) => {
    if (
      e.phase !== "diving" ||
      !newlyEnclosed(e.x, e.y, e.width / 2, e.height / 2)
    )
      return true;
    emit(s, "neutralize", e.x, e.y, e.id, undefined, "power expansion");
    return false;
  });
  const widthChanged = previous.some((p) => p.width !== width);
  for (const b of liveBalls(s)) {
    const oldRadius = b.radius;
    b.radius = T.radius * (s.powers.giant > 0 ? 1.8 : 1);
    b.x = clamp(b.x, b.radius, 100 - b.radius);
    b.y = Math.max(b.radius, b.y);
    if (
      (widthChanged || b.radius !== oldRadius) &&
      s.paddles.some(
        (p) =>
          Math.abs(b.x - p.x) <= p.width / 2 + b.radius &&
          Math.abs(b.y - p.y) <= p.height / 2 + b.radius,
      )
    ) {
      b.y = T.paddleY - T.paddleHeight / 2 - b.radius - 0.001;
      b.vy = -Math.abs(b.vy);
    }
  }
}
export function restoreMultiball(s: GameState) {
  if (s.powers.multi <= 0) return;
  while (s.extraBalls.length < 2) {
    const b = s.ball,
      angle = s.extraBalls.length === 0 ? -0.35 : 0.35;
    s.extraBalls.push({
      id: s.nextId++,
      x: b.x,
      y: b.y,
      radius: b.radius,
      vx: b.vx * Math.cos(angle) - b.vy * Math.sin(angle),
      vy: b.vx * Math.sin(angle) + b.vy * Math.cos(angle),
    });
  }
}
export function activatePower(s: GameState, kind: PowerKind): void {
  if (kind === "shield") s.shields = Math.min(3, s.shields + 1);
  else {
    s.powers[kind] = 30;
    if (kind === "multi") restoreMultiball(s);
  }
  syncPowerGeometry(s);
  emit(
    s,
    "power-collected",
    s.ball.x,
    T.paddleY,
    undefined,
    kind === "shield" ? s.shields : 30,
    kind,
  );
}
export function expirePower(s: GameState, kind: TimedPowerKind) {
  s.powers[kind] = 0;
  if (kind === "multi") s.extraBalls = [];
  syncPowerGeometry(s);
  emit(s, "power-expired", s.ball.x, s.ball.y, undefined, 0, kind);
}
export function maybeDropPower(s: GameState, x: number, y: number) {
  if (s.practice) return;
  s.killsSinceDrop++;
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  if (
    s.pickups.length >= 6 ||
    (s.killsSinceDrop < 5 && s.rng / 0x100000000 >= 0.22)
  )
    return;
  // Seed chooses the first kind; a coprime stride supplies every kind each five drops.
  const kind = KINDS[((s.seed >>> 0) + s.powerDropCount * 3) % KINDS.length];
  const pickup = { id: s.nextId++, kind, x, y, radius: T.pickupRadius, vy: 14 };
  s.pickups.push(pickup);
  s.killsSinceDrop = 0;
  s.powerDropCount++;
  emit(s, "power-drop", x, y, pickup.id, undefined, kind);
}
