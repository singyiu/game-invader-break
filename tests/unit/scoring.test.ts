import { expect, it } from "vitest";
import { createGame } from "../../src/game/state";
import { precisionReturn, awardKill, multiplier } from "../../src/game/scoring";
it("activates exactly six seconds of Overdrive after five center returns", () => {
  const s = createGame();
  for (let i = 0; i < 4; i++) precisionReturn(s, 0.15);
  expect(s.charge).toBe(4);
  precisionReturn(s, 0.21);
  expect(s.charge).toBe(4);
  precisionReturn(s, 0);
  expect(s.overdriveUntil - s.time).toBe(6);
  precisionReturn(s, 0);
  expect(s.charge).toBe(0);
});
it("awards enemy values once with a capped kill combo", () => {
  const s = createGame();
  awardKill(s, "drone", 1, 0, 0);
  expect(s.score).toBe(100);
  awardKill(s, "spitter", 2, 0, 0);
  awardKill(s, "lancer", 3, 0, 0);
  expect(s.score).toBe(450);
  awardKill(s, "bastion", 4, 0, 0);
  expect(s.score).toBe(762);
  s.combo = 99;
  expect(multiplier(s)).toBe(3);
});
it("keeps petal and core rewards fixed even with a nonzero kill combo", () => {
  const s = createGame();
  s.combo = 12;
  awardKill(s, "petal", 90, 50, 20);
  expect(s.score).toBe(500);
  expect(s.events.at(-1)?.value).toBe(500);
  awardKill(s, "core", 91, 50, 20);
  expect(s.score).toBe(2000);
  expect(s.events.at(-1)?.value).toBe(1500);
  expect(s.kills).toBe(2);
  expect(s.combo).toBe(14);
});
