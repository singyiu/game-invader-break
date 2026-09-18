import type { Paddle } from "../shared/contracts";
export interface Interval {
  left: number;
  right: number;
  id: number;
}
export function paddleIntervals(paddles: Paddle[]): Interval[] {
  const sorted = paddles
    .map((p) => ({
      left: p.x - p.width / 2,
      right: p.x + p.width / 2,
      id: p.id,
    }))
    .sort((a, b) => a.left - b.left || a.id - b.id);
  const merged: Interval[] = [];
  for (const p of sorted) {
    const last = merged.at(-1);
    if (last && p.left <= last.right + 1e-8) {
      last.right = Math.max(last.right, p.right);
      last.id = Math.min(last.id, p.id);
    } else merged.push({ ...p });
  }
  return merged;
}
export interface Contact {
  t: number;
  nx: number;
  ny: number;
}
/** Swept point against an expanded AABB; velocity is relative to the target. */
export function sweepRect(
  x: number,
  y: number,
  vx: number,
  vy: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  maxT: number,
): Contact | null {
  const tx1 = vx === 0 ? -Infinity : (left - x) / vx,
    tx2 = vx === 0 ? Infinity : (right - x) / vx;
  const ty1 = vy === 0 ? -Infinity : (top - y) / vy,
    ty2 = vy === 0 ? Infinity : (bottom - y) / vy;
  if (
    (vx === 0 && (x < left || x > right)) ||
    (vy === 0 && (y < top || y > bottom))
  )
    return null;
  const nearX = Math.min(tx1, tx2),
    nearY = Math.min(ty1, ty2),
    far = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2)),
    near = Math.max(nearX, nearY);
  if (near < -1e-8 || near > far || near > maxT || far < 0) return null;
  return {
    t: Math.max(0, near),
    nx: nearX >= nearY ? -Math.sign(vx) : 0,
    ny: nearY >= nearX ? -Math.sign(vy) : 0,
  };
}
export function sweepCircle(
  x: number,
  y: number,
  vx: number,
  vy: number,
  radius: number,
  maxT: number,
): number | null {
  const a = vx * vx + vy * vy,
    b = 2 * (x * vx + y * vy),
    c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  if (a === 0) return null;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= maxT ? t : null;
}
