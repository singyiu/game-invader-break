import { expect, it } from "vitest";
import { createGame } from "../../src/game/state";
import { stepGame } from "../../src/game/step";
const input = {
  mode: 1 as const,
  targets: [{ id: 1, x: 0.5 }],
  status: "stable" as const,
  paused: false,
  resumeIn: 0,
  needsDwell: false,
};
it("consumes simultaneous projectiles with only one shared shield loss", () => {
  const s = createGame();
  s.serveRemaining = 0;
  s.projectiles = [1, 2].map((id) => ({
    id,
    x: 50,
    y: 86,
    vx: 0,
    vy: 60,
    radius: 0.7,
    sourceId: 0,
  }));
  s.ball.x = 10;
  stepGame(s, input, 1 / 30);
  expect(s.shields).toBe(2);
  expect(s.projectiles).toHaveLength(0);
  expect(s.events.filter((e) => e.kind === "shield-hit")).toHaveLength(1);
});
it("drain resets combo and charge during damage grace and re-serves", () => {
  const s = createGame();
  s.serveRemaining = 0;
  s.combo = 7;
  s.charge = 4;
  s.graceUntil = 2;
  s.ball.y = 100.8;
  s.ball.vy = 95;
  stepGame(s, input);
  expect(s.shields).toBe(3);
  expect(s.combo).toBe(0);
  expect(s.charge).toBe(0);
  expect(s.serveRemaining).toBeGreaterThan(1);
});
it("earliest projectile beats a later drain and harmless grace contacts preserve combo", () => {
  const s = createGame();
  s.serveRemaining = 0;
  s.ball = { id: 0, x: 10, y: 100, vx: 0, vy: 95, radius: 0.9 };
  s.projectiles = [
    { id: 1, x: 50, y: 86.5, vx: 0, vy: 60, radius: 0.7, sourceId: 0 },
  ];
  stepGame(s, input, 1 / 30);
  expect(s.lastDamage).toBe("projectile");
  expect(s.shields).toBe(2);
  s.combo = 6;
  s.charge = 3;
  s.projectiles = [
    { id: 2, x: 50, y: 86.5, vx: 0, vy: 60, radius: 0.7, sourceId: 0 },
  ];
  stepGame(s, input);
  expect(s.combo).toBe(6);
  expect(s.charge).toBe(3);
});
it("zero shields wins over any later contact", () => {
  const s = createGame();
  s.shields = 1;
  s.serveRemaining = 0;
  s.ball.y = 100.8;
  s.ball.vy = 95;
  stepGame(s, input);
  expect(s.status).toBe("lost");
  expect(s.shields).toBe(0);
});

it.each([
  ["merge", "projectile", 58],
  ["merge", "diver", 60],
  ["split", "projectile", 56],
  ["split", "diver", 58],
] as const)(
  "%s neutralizes newly enclosed %s without damage or rewards",
  (mode, hazard, x) => {
    const s = createGame();
    s.serveRemaining = 0;
    s.combo = 5;
    s.charge = 3;
    s.ball = { id: 0, x: 10, y: 50, vx: 0, vy: -55, radius: 0.9 };
    s.paddles =
      mode === "merge"
        ? [
            { id: 1, x: 50, y: 88, width: 13.5, height: 1.5 },
            { id: 2, x: 80, y: 88, width: 13.5, height: 1.5 },
          ]
        : [{ id: 1, x: 20, y: 88, width: 18, height: 1.5 }];
    if (hazard === "projectile")
      s.projectiles = [
        { id: 99, x, y: 88, vx: 0, vy: 30, radius: 0.7, sourceId: 0 },
      ];
    else
      s.enemies.push({
        id: 99,
        kind: "lancer",
        x,
        y: 88,
        width: 4.5,
        height: 5,
        hp: 1,
        maxHp: 1,
        phase: "diving",
        phaseTime: 0,
        lane: x,
        originX: x,
        originY: 20,
      });
    stepGame(s, {
      ...input,
      mode: mode === "merge" ? 1 : 2,
      targets:
        mode === "merge"
          ? [{ id: 1, x: 0.5 }]
          : [
              { id: 1, x: 0.5 },
              { id: 2, x: 0.8 },
            ],
    });
    expect(s.shields).toBe(3);
    expect(s.score).toBe(0);
    expect(s.combo).toBe(5);
    expect(s.charge).toBe(3);
    expect(
      s.events.some(
        (e) => e.kind === "shield-hit" || e.kind === "enemy-killed",
      ),
    ).toBe(false);
    expect(
      s.projectiles.some((p) => p.id === 99) ||
        s.enemies.some((e) => e.id === 99),
    ).toBe(false);
  },
);
it("a projectile entering through actual motion after a merge still damages", () => {
  const s = createGame();
  s.serveRemaining = 0;
  s.ball = { id: 0, x: 10, y: 50, vx: 0, vy: -55, radius: 0.9 };
  s.paddles = [
    { id: 1, x: 50, y: 88, width: 13.5, height: 1.5 },
    { id: 2, x: 80, y: 88, width: 13.5, height: 1.5 },
  ];
  s.projectiles = [
    { id: 99, x: 57, y: 86, vx: 0, vy: 60, radius: 0.7, sourceId: 0 },
  ];
  stepGame(s, input, 0.03);
  expect(s.shields).toBe(2);
  expect(s.lastDamage).toBe("projectile");
});
it("a hazard already overlapping an old surface remains an ordinary damaging contact", () => {
  const s = createGame();
  s.serveRemaining = 0;
  s.ball = { id: 0, x: 10, y: 50, vx: 0, vy: -55, radius: 0.9 };
  s.paddles = [
    { id: 1, x: 50, y: 88, width: 13.5, height: 1.5 },
    { id: 2, x: 80, y: 88, width: 13.5, height: 1.5 },
  ];
  s.projectiles = [
    { id: 99, x: 50, y: 88, vx: 0, vy: 30, radius: 0.7, sourceId: 0 },
  ];
  stepGame(s, input);
  expect(s.shields).toBe(2);
});
it("a projectile entering a wider split-paddle edge still damages", () => {
  const s = createGame();
  s.serveRemaining = 0;
  s.ball = { id: 0, x: 10, y: 50, vx: 0, vy: -55, radius: 0.9 };
  const split = {
    ...input,
    mode: 2 as const,
    targets: [
      { id: 1, x: 0.5 },
      { id: 2, x: 0.8 },
    ],
  };
  stepGame(s, split);
  s.projectiles = [
    { id: 99, x: 56, y: 86, vx: 0, vy: 60, radius: 0.7, sourceId: 0 },
  ];
  stepGame(s, split, 0.03);
  expect(s.shields).toBe(2);
  expect(s.lastDamage).toBe("projectile");
});
