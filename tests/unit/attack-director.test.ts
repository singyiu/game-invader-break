import { expect, it } from "vitest";
import { createGame } from "../../src/game/state";
import { stepGame } from "../../src/game/step";
import {
  predictCatch,
  canCommit,
  revalidateHazards,
  updateAttacks,
} from "../../src/game/attack-director";
it("withholds uncertain ascending-ball attacks", () => {
  const s = createGame();
  expect(predictCatch(s)).toBeNull();
  expect(
    canCommit(s, {
      x: 50,
      y: 20,
      vx: 0,
      vy: 40,
      radius: 0.7,
      id: 99,
      sourceId: 10,
    }),
  ).toBe(false);
});
it("permits a harmless shot when only the wider split edge can make the catch", () => {
  const s = createGame();
  s.serveRemaining = 0;
  stepGame(s, {
    mode: 2,
    targets: [
      { id: 1, x: 0.5 },
      { id: 2, x: 0.8 },
    ],
    status: "stable",
    paused: false,
    resumeIn: 0,
    needsDwell: false,
  });
  s.ball = { id: 0, x: 55.5, y: 85.8, vx: 0, vy: 55, radius: 0.9 };
  expect(
    canCommit(s, {
      id: 99,
      x: 90,
      y: 70,
      vx: 0,
      vy: 55,
      radius: 0.7,
      sourceId: 10,
    }),
  ).toBe(true);
});
it("neutralizes only a hazard blocking all reachable catch positions, without reward", () => {
  const s = createGame();
  s.enemies = [];
  s.serveRemaining = 0;
  s.ball = { id: 0, x: 50, y: 70, vx: 0, vy: 55, radius: 0.9 };
  s.projectiles = [
    { id: 91, x: 50, y: 70, vx: 0, vy: 55, radius: 1, sourceId: 0 },
    { id: 92, x: 90, y: 60, vx: 0, vy: 30, radius: 1, sourceId: 0 },
  ];
  revalidateHazards(s);
  expect(s.projectiles.map((p) => p.id)).toEqual([92]);
  expect(s.fairnessInterventions).toBe(1);
  expect(s.score).toBe(0);
  expect(s.events.at(-1)?.kind).toBe("neutralize");
});
it("requires a full windup and caps projectiles even for conductors", () => {
  const s = createGame();
  s.serveRemaining = 0;
  s.ball = { id: 0, x: 25, y: 40, vx: 0, vy: 55, radius: 0.9 };
  s.enemies = [
    {
      id: 10,
      kind: "conductor",
      x: 80,
      y: 20,
      width: 6,
      height: 4,
      hp: 2,
      maxHp: 2,
      phase: "telegraph",
      phaseTime: 0.64,
      lane: 80,
      originX: 80,
      originY: 20,
    },
  ];
  updateAttacks(s, 0.001);
  expect(s.projectiles).toHaveLength(0);
  updateAttacks(s, 0.02);
  expect(s.projectiles.length).toBeLessThanOrEqual(2);
  if (s.projectiles[0])
    expect(
      (88 - s.projectiles[0].y) / s.projectiles[0].vy,
    ).toBeGreaterThanOrEqual(0.9);
});
it("lancer release stays on its telegraphed world lane", () => {
  const s = createGame();
  s.serveRemaining = 0;
  s.ball = { id: 0, x: 25, y: 40, vx: 0, vy: 55, radius: 0.9 };
  s.enemies = [
    {
      id: 10,
      kind: "lancer",
      x: 80,
      y: 20,
      width: 4,
      height: 5,
      hp: 1,
      maxHp: 1,
      phase: "formation",
      phaseTime: 0,
      lane: 80,
      originX: 80,
      originY: 20,
    },
  ];
  s.attackTimer = 0;
  updateAttacks(s, 0.001);
  expect(s.enemies[0].lane).toBe(80);
});
it("rejects converging shots that cover every catch during their vertical overlap", () => {
  const s = createGame();
  s.enemies = [];
  s.serveRemaining = 0;
  s.ball = { id: 0, x: 50, y: 29.7, vx: 0, vy: 55, radius: 0.9 };
  const left = {
    id: 91,
    x: 14.65,
    y: 49.69,
    vx: 25,
    vy: 38,
    radius: 0.7,
    sourceId: 0,
  };
  const right = {
    id: 92,
    x: 85.35,
    y: 49.69,
    vx: -25,
    vy: 38,
    radius: 0.7,
    sourceId: 0,
  };
  s.projectiles = [left];
  expect(canCommit(s, right)).toBe(false);
});
it("removes the minimum converging shot subset to reopen a safe catch", () => {
  const s = createGame();
  s.enemies = [];
  s.serveRemaining = 0;
  s.combo = 6;
  s.charge = 3;
  s.ball = { id: 0, x: 50, y: 29.7, vx: 0, vy: 55, radius: 0.9 };
  s.projectiles = [
    { id: 91, x: 14.65, y: 49.69, vx: 25, vy: 38, radius: 0.7, sourceId: 0 },
    { id: 92, x: 85.35, y: 49.69, vx: -25, vy: 38, radius: 0.7, sourceId: 0 },
  ];
  revalidateHazards(s);
  expect(s.projectiles.map((p) => p.id)).toEqual([92]);
  expect(s.fairnessInterventions).toBe(1);
  expect(s.events.filter((e) => e.kind === "neutralize")).toHaveLength(1);
  expect(s.score).toBe(0);
  expect(s.combo).toBe(6);
  expect(s.charge).toBe(3);
});
it("revalidates a shot whose paddle overlap has already started", () => {
  const s = createGame();
  s.enemies = [];
  s.serveRemaining = 0;
  s.ball = { id: 0, x: 50, y: 85.8, vx: 0, vy: 55, radius: 0.9 };
  s.projectiles = [
    { id: 91, x: 50, y: 88, vx: 0, vy: 10, radius: 0.7, sourceId: 0 },
  ];
  revalidateHazards(s);
  expect(s.projectiles).toHaveLength(0);
  expect(s.fairnessInterventions).toBe(1);
});
