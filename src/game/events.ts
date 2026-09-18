import type { GameState, GameEventKind } from "../shared/contracts";
export function emit(
  s: GameState,
  kind: GameEventKind,
  x: number,
  y: number,
  entityId?: number,
  value?: number,
  cause?: string,
) {
  s.events.push({
    id: s.nextEventId++,
    tick: s.tick,
    kind,
    x,
    y,
    entityId,
    value,
    cause,
  });
}
