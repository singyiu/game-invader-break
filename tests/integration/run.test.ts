import { expect, it } from "vitest";
import { createGame } from "../../src/game/state";
import { stepGame, continueSector } from "../../src/game/step";
const input = {
  mode: 1 as const,
  targets: [{ id: 1, x: 0.5 }],
  status: "stable" as const,
  paused: false,
  resumeIn: 0,
  needsDwell: false,
};
it("traverses the authored waves and boss, then continues into a tougher cycle", () => {
  const s = createGame();
  const seen = [];
  for (let wave = 1; wave <= 6; wave++) {
    expect(s.wave).toBe(wave);
    seen.push(...s.enemies.map((e) => e.kind));
    s.enemies = [];
    stepGame(s, input);
    if (s.status === "rest") {
      s.restRemaining = 4;
      continueSector(s);
    }
  }
  expect(new Set(seen).size).toBe(5);
  expect(s.wave).toBe(7);
  expect(s.bossPhase).toBe(1);
  s.enemies = [];
  stepGame(s, input);
  expect(s.bossPhase).toBe(2);
  s.enemies = [];
  stepGame(s, input);
  expect(s.status).toBe("rest");
  expect(s.bossesDefeated).toBe(1);
  const score = s.score;
  s.restRemaining = 4;
  continueSector(s);
  expect(s.status).toBe("playing");
  expect(s.wave).toBe(8);
  expect(s.bossPhase).toBe(0);
  expect(s.enemies.length).toBeGreaterThan(0);
  expect(s.score).toBe(score);
  const time = s.time;
  stepGame(s, input);
  expect(s.time).toBeGreaterThan(time);
});
