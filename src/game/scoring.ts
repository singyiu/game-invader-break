import type { GameState, EnemyKind } from "../shared/contracts";
import { ENEMIES } from "../content/enemies";
import { maybeDropPower } from "./powers";
import { emit } from "./events";
export const handScoreMultiplier = (s: GameState) =>
  s.paddles.length === 2 ? 1.5 : 1;
export const awardPoints = (s: GameState, base: number) => {
  const value =
    s.paddles.length === 2
      ? Math.round(base * handScoreMultiplier(s))
      : Math.floor(base);
  s.score += value;
  return value;
};
export const multiplier = (s: GameState) =>
  Math.min(3, 1 + 0.25 * Math.floor(s.combo / 3));
export function awardKill(
  s: GameState,
  kind: EnemyKind,
  id: number,
  x: number,
  y: number,
) {
  const value = awardPoints(
    s,
    ENEMIES[kind].score *
      (kind === "petal" || kind === "core" ? 1 : multiplier(s)),
  );
  s.kills++;
  s.combo++;
  maybeDropPower(s, x, y);
  emit(s, "enemy-killed", x, y, id, value);
}
export function precisionReturn(s: GameState, offset: number) {
  if (Math.abs(offset) > 0.2 || s.overdriveUntil > s.time) return;
  s.precisionReturns++;
  s.charge++;
  if (s.charge === 5) {
    s.charge = 0;
    s.overdriveUntil = s.time + 6;
    emit(s, "overdrive", s.ball.x, s.ball.y);
  }
}
