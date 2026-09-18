import { expect, it } from "vitest";
import { createGame } from "../../src/game/state";
import { startBoss, updateBoss, isVulnerable } from "../../src/game/boss";
it("opens three two-hit petals then a six-hit core and ends all danger during the cycle rest", () => {
  const s = createGame();
  startBoss(s);
  expect(s.enemies.map((e) => e.hp)).toEqual([2, 2, 2]);
  s.enemies = [];
  updateBoss(s);
  expect(s.bossPhase).toBe(2);
  expect(s.enemies[0].hp).toBe(6);
  expect(isVulnerable(s, s.enemies[0])).toBe(true);
  s.enemies[0].hp = 3;
  updateBoss(s);
  expect(s.bossPhase).toBe(3);
  s.enemies = [];
  updateBoss(s);
  expect(s.status).toBe("rest");
  expect(s.projectiles).toHaveLength(0);
});
it("shows a timed closed core, adds final dive cues and rests as soon as core falls", () => {
  const s = createGame();
  startBoss(s);
  s.enemies = [];
  updateBoss(s);
  const core = s.enemies[0];
  s.time = 4;
  expect(isVulnerable(s, core)).toBe(false);
  core.hp = 3;
  updateBoss(s);
  expect(s.enemies.some((e) => e.kind === "lancer")).toBe(true);
  s.enemies = s.enemies.filter((e) => e.kind !== "core");
  updateBoss(s);
  expect(s.status).toBe("rest");
  expect(s.enemies).toHaveLength(0);
});
it("the core vulnerability cycle continues through its attack windups", () => {
  const s = createGame();
  startBoss(s);
  s.enemies = [];
  updateBoss(s);
  s.time = 4;
  s.enemies[0].phase = "telegraph";
  s.enemies[0].phaseTime = 0.2;
  expect(isVulnerable(s, s.enemies[0])).toBe(false);
});
it("core destruction disables a later damaging projectile in the same step", async () => {
  const { stepGame } = await import("../../src/game/step");
  const s = createGame();
  startBoss(s);
  s.enemies = [];
  updateBoss(s);
  s.enemies[0].hp = 1;
  s.enemies[0].phase = "telegraph";
  s.serveRemaining = 0;
  s.shields = 1;
  s.ball = { id: 0, x: 50, y: 30, vx: 0, vy: -95, radius: 0.9 };
  s.projectiles = [
    { id: 99, x: 50, y: 85, vx: 0, vy: 60, radius: 0.7, sourceId: 0 },
  ];
  stepGame(
    s,
    {
      mode: 1,
      targets: [{ id: 1, x: 0.5 }],
      paused: false,
      status: "stable",
      resumeIn: 0,
      needsDwell: false,
    },
    0.03,
  );
  expect(s.status).toBe("rest");
  expect(s.shields).toBe(1);
});
