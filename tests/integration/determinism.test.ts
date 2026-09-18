import { expect, it } from "vitest";
import { createGame } from "../../src/game/state";
import { stepGame } from "../../src/game/step";
it("has identical states and event streams for render batches of 30,60 and120 Hz", () => {
  function replay(batch: number) {
    const s = createGame({ seed: 91 });
    const events = [];
    for (let frame = 0; frame < 1200 / batch; frame++)
      for (let j = 0; j < batch; j++) {
        const tick = frame * batch + j;
        events.push(
          ...stepGame(s, {
            mode: 1,
            targets: [{ id: 1, x: 0.5 + 0.25 * Math.sin(tick / 80) }],
            status: "stable",
            paused: false,
            resumeIn: 0,
            needsDwell: false,
          }),
        );
      }
    return { s, events };
  }
  expect(replay(4)).toEqual(replay(2));
  expect(replay(2)).toEqual(replay(1));
});
