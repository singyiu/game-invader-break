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
it("authors six escalating waves and requires two seconds before sector continue", () => {
  const s = createGame();
  expect(s.enemies.length).toBeGreaterThan(0);
  s.enemies = [];
  stepGame(s, input);
  expect(s.wave).toBe(2);
  s.enemies = [];
  stepGame(s, input);
  expect(s.status).toBe("rest");
  continueSector(s);
  expect(s.status).toBe("rest");
  s.restRemaining = 4;
  continueSector(s);
  expect(s.wave).toBe(3);
  expect(s.sector).toBe(2);
  expect(s.enemies.some((e) => e.kind === "lancer")).toBe(true);
});
it("practice has a real slow rally and does not progress combat waves", () => {
  const s = createGame({ practice: true });
  s.enemies = [];
  s.serveRemaining = 0;
  stepGame(s, input);
  expect(s.wave).toBe(1);
  expect(s.shields).toBe(3);
});
it("formation movement stays continuous when an attacker rejoins", () => {
  const s = createGame();
  const e = s.enemies[0];
  s.time = 100;
  e.phase = "formation";
  e.x = 20;
  e.y = 30;
  const x = e.x,
    y = e.y;
  stepGame(s, input);
  expect(Math.abs(e.x - x)).toBeGreaterThan(0);
  expect(Math.abs(e.x - x)).toBeLessThan(0.1);
  expect(Math.abs(e.y - y)).toBeLessThan(0.1);
});
it("opens a new lateral route after eight seconds without enemy damage", () => {
  const s = createGame();
  s.time = 8.1;
  s.serveRemaining = 0;
  s.lastEnemyHitAt = 0;
  s.lastStallShiftAt = 0;
  stepGame(s, input);
  expect(s.lastStallShiftAt).toBeGreaterThan(8);
  const e = s.enemies[0],
    x = e.x;
  stepGame(s, input);
  expect(e.x - x).toBeGreaterThan(0.025);
});
