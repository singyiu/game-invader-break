import { expect, it } from "vitest";
import { createGame } from "../../src/game/state";
import { stepGame } from "../../src/game/step";
import { spawnEnemy } from "../../src/game/encounters";
const input = {
  mode: 1 as const,
  targets: [{ id: 1, x: 0.5 }],
  status: "stable" as const,
  paused: false,
  resumeIn: 0,
  needsDwell: false,
};
it("uses the moving paddle position at the impact time", () => {
  const s = createGame({ practice: true });
  s.enemies = [];
  s.serveRemaining = 0;
  s.paddles[0].x = 10;
  s.ball = { id: 0, x: 50, y: 85.35, vx: 0, vy: 60, radius: 0.9 };
  stepGame(s, { ...input, targets: [{ id: 1, x: 0.9 }] }, 1 / 30);
  expect(s.returns).toBe(1);
});
it("resolves two wall faces at a corner once each", () => {
  const s = createGame({ practice: true });
  s.enemies = [];
  s.serveRemaining = 0;
  s.ball = { id: 0, x: 1, y: 1, vx: -50, vy: -50, radius: 0.9 };
  stepGame(s, input);
  expect(s.ball.vx).toBe(50);
  expect(s.ball.vy).toBe(50);
  expect(s.events.filter((e) => e.kind === "wall-hit")).toHaveLength(2);
});
it("overdrive pierces one destroyed target and uses remaining travel to hit the second", () => {
  const s = createGame();
  s.serveRemaining = 0;
  s.overdriveUntil = 10;
  s.time = 0;
  s.enemies = [spawnEnemy(s, "drone", 50, 51), spawnEnemy(s, "drone", 50, 47)];
  for (const e of s.enemies) e.phase = "telegraph";
  s.ball = { id: 0, x: 50, y: 54, vx: 0, vy: -95, radius: 0.9 };
  stepGame(s, input, 0.05);
  expect(s.kills).toBe(2);
  expect(s.ball.vy).toBeGreaterThan(0);
});
it("an upward ball intercepts a moving shot once for25points", () => {
  const s = createGame();
  s.serveRemaining = 0;
  s.ball = { id: 0, x: 50, y: 60, vx: 0, vy: -55, radius: 0.9 };
  s.projectiles = [
    { id: 90, x: 50, y: 57, vx: 0, vy: 30, radius: 0.7, sourceId: 0 },
  ];
  stepGame(s, input, 0.03);
  expect(s.score).toBe(25);
  expect(s.events.filter((e) => e.kind === "intercept")).toHaveLength(1);
});
it("front armor needs two hits while rear contact defeats a bastion", () => {
  for (const rear of [false, true]) {
    const s = createGame();
    s.serveRemaining = 0;
    const e = spawnEnemy(s, "bastion", 50, 40);
    e.phase = "telegraph";
    s.enemies = [e];
    s.ball = {
      id: 0,
      x: 50,
      y: rear ? 36 : 44,
      vx: 0,
      vy: rear ? 55 : -55,
      radius: 0.9,
    };
    stepGame(s, input, 0.02);
    expect(s.kills).toBe(rear ? 1 : 0);
  }
});
it("an already overlapping incoming projectile is consumed during grace", () => {
  const s = createGame();
  s.serveRemaining = 0;
  s.graceUntil = 10;
  s.combo = 5;
  s.projectiles = [
    { id: 90, x: 50, y: 88, vx: 0, vy: 30, radius: 0.7, sourceId: 0 },
  ];
  stepGame(s, input);
  expect(s.projectiles).toHaveLength(0);
  expect(s.shields).toBe(3);
  expect(s.combo).toBe(5);
});
it("separated surfaces use nearest center then stable id for a tie", () => {
  const s = createGame({ practice: true });
  s.enemies = [];
  s.serveRemaining = 0;
  const split = {
    ...input,
    mode: 2 as const,
    targets: [
      { id: 3, x: 0.4275 },
      { id: 2, x: 0.5725 },
    ],
  };
  stepGame(s, split);
  s.ball = { id: 0, x: 50, y: 86.1, vx: 0, vy: 55, radius: 0.9 };
  stepGame(s, split);
  expect(s.events.find((e) => e.kind === "paddle-hit")?.entityId).toBe(2);
  expect(s.returns).toBe(1);
});
