import type { GameState } from "../shared/contracts";
import { emit } from "./events";
import { TUNING as T } from "../content/tuning";
export function damage(
  s: GameState,
  cause: string,
  x: number,
  y: number,
): boolean {
  if (s.practice || s.status !== "playing" || s.time < s.graceUntil)
    return false;
  s.shields = Math.max(0, s.shields - 1);
  s.graceUntil = s.time + T.grace;
  s.combo = 0;
  s.charge = 0;
  s.lastDamage = cause;
  emit(s, "shield-hit", x, y, undefined, s.shields, cause);
  if (s.shields === 0) {
    s.status = "lost";
    s.projectiles = [];
    emit(s, "game-over", x, y, undefined, undefined, cause);
  }
  return true;
}
export function drain(s: GameState) {
  s.combo = 0;
  s.charge = 0;
  emit(s, "drain", s.ball.x, s.ball.y);
  damage(s, "ball drain", s.ball.x, s.ball.y);
  if (s.status === "playing") {
    s.serveRemaining = T.recovery;
    s.projectiles = [];
    s.ball.y = 84;
    s.ball.x = s.paddles[0]?.x ?? 50;
  }
}
