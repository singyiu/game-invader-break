import { expect, it } from "vitest";
import { createGame } from "../../src/game/state";
import { startWave } from "../../src/game/encounters";
import { stepGame } from "../../src/game/step";

it("launches repeatable patterned attacks in a real rally across render batch sizes", () => {
  function replay(batch: number) {
    const state = createGame({ seed: 91 });
    startWave(state, 3);
    // Keep the fleet present for a long scheduling/replay observation.
    for (const enemy of state.enemies) enemy.hp = enemy.maxHp = 100;
    state.graceUntil = 1000;
    const events = [];
    const patterns = new Set<string>();
    for (let frame = 0; frame < 3600 / batch; frame++) {
      for (let tick = 0; tick < batch; tick++) {
        events.push(
          ...stepGame(state, {
            mode: 1,
            targets: [{ id: 1, x: state.ball.x / 100 }],
            status: "stable",
            paused: false,
            resumeIn: 0,
            needsDwell: false,
          }),
        );
        for (const enemy of state.enemies)
          if (enemy.phase === "diving" && enemy.flight)
            patterns.add(enemy.flight.pattern);
      }
    }
    expect(
      events.filter((event) => event.kind === "shot" && event.cause === "dive")
        .length,
    ).toBeGreaterThan(0);
    expect(patterns.size).toBeGreaterThan(0);
    return { state, events, patterns };
  }
  expect(replay(4)).toEqual(replay(2));
  expect(replay(2)).toEqual(replay(1));
});
