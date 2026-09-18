import { describe, expect, it } from "vitest";
import { createGame } from "../../src/game/state";
import { startWave } from "../../src/game/encounters";
import { updateBoss } from "../../src/game/boss";
import { awardKill } from "../../src/game/scoring";
import { stepGame, continueSector } from "../../src/game/step";
import type { PaddleIntent } from "../../src/shared/contracts";
const input: PaddleIntent = {
  mode: 1,
  targets: [{ id: 1, x: 0.5 }],
  status: "stable",
  paused: false,
  resumeIn: 0,
  needsDwell: false,
};
describe("endless powers state", () => {
  it("starts with stable ball identity and bounded power collections", () => {
    const s = createGame();
    expect(s.ball.id).toBe(0);
    expect(s.extraBalls).toEqual([]);
    expect(s.pickups).toEqual([]);
    expect(s.powers).toEqual({ giant: 0, wide: 0, multi: 0, fire: 0 });
  });
  it("awards a two-hand drone kill after the combo factor", () => {
    const s = createGame();
    s.paddles.push({ ...s.paddles[0], id: 2 });
    awardKill(s, "drone", 99, 50, 20);
    expect(s.score).toBe(150);
    s.combo = 3;
    awardKill(s, "bastion", 100, 50, 20);
    expect(s.score).toBe(619);
  });
  it("rests after a boss, records once, and continues to level eight", () => {
    const s = createGame();
    startWave(s, 7);
    s.bossPhase = 2;
    s.enemies = [];
    updateBoss(s);
    updateBoss(s);
    expect(s.status).toBe("rest");
    expect(s.wave).toBe(7);
    expect(s.bossesDefeated).toBe(1);
    expect(s.perfectBossClears).toBe(1);
    expect(s.score).toBe(3000);
    s.restRemaining = 0;
    continueSector(s);
    expect(s.wave).toBe(8);
    expect(s.bossPhase).toBe(0);
  });
  it("selects formations and bosses at arbitrarily high levels", () => {
    const s = createGame();
    startWave(s, 1001);
    expect(s.wave).toBe(1001);
    expect(s.bossPhase).toBe(1);
    startWave(s, 1002);
    expect(s.enemies.length).toBeGreaterThan(0);
    expect(s.sector).toBeGreaterThanOrEqual(1);
    expect(s.sector).toBeLessThanOrEqual(3);
    stepGame(s, input, 0.05);
    expect(Math.hypot(s.ball.vx, s.ball.vy)).toBeGreaterThan(84);
    expect(Math.hypot(s.ball.vx, s.ball.vy)).toBeLessThan(85);
  });
});

describe("collectible powers", () => {
  it("repairs one shield, stacks timed powers and refreshes thirty seconds", async () => {
    const { activatePower } = await import("../../src/game/powers");
    const s = createGame();
    s.shields = 2;
    activatePower(s, "shield");
    activatePower(s, "shield");
    expect(s.shields).toBe(3);
    activatePower(s, "giant");
    activatePower(s, "wide");
    activatePower(s, "multi");
    expect(s.ball.radius).toBeCloseTo(1.62);
    expect(s.paddles[0].width).toBe(27);
    expect(s.extraBalls).toHaveLength(2);
    expect(new Set([s.ball, ...s.extraBalls].map((b) => b.id)).size).toBe(3);
    s.powers.multi = 1;
    activatePower(s, "multi");
    expect(s.powers.multi).toBe(30);
    expect(s.extraBalls).toHaveLength(2);
  });
  it("counts only live combat and expires extras harmlessly", async () => {
    const { activatePower } = await import("../../src/game/powers");
    const s = createGame();
    activatePower(s, "fire");
    activatePower(s, "multi");
    stepGame(s, input, 0.05);
    expect(s.powers.fire).toBe(30);
    s.serveRemaining = 0;
    stepGame(s, { ...input, paused: true }, 0.05);
    expect(s.powers.fire).toBe(30);
    s.status = "rest";
    s.restRemaining = 5;
    stepGame(s, input, 0.05);
    expect(s.powers.fire).toBe(30);
    s.status = "playing";
    s.powers.multi = 0.02;
    stepGame(s, input, 0.05);
    expect(s.powers.fire).toBeCloseTo(29.95);
    expect(s.extraBalls).toHaveLength(0);
    expect(s.shields).toBe(3);
    expect(s.events.some((e) => e.kind === "power-expired")).toBe(true);
  });
  it("catches a capsule through swept paddle motion", () => {
    const s = createGame({ practice: true });
    s.serveRemaining = 0;
    s.pickups = [{ id: 99, kind: "shield", x: 70, y: 88, vy: 14, radius: 1 }];
    s.shields = 2;
    stepGame(s, { ...input, targets: [{ id: 1, x: 0.85 }] }, 0.05);
    expect(s.shields).toBe(3);
    expect(s.pickups).toHaveLength(0);
  });
  it("loses shields only on the last drain, then restores active multiball on serve", async () => {
    const { activatePower } = await import("../../src/game/powers");
    const s = createGame();
    s.serveRemaining = 0;
    activatePower(s, "multi");
    s.ball.x = 10;
    s.ball.y = 100.8;
    s.ball.vy = 95;
    stepGame(s, input, 0.01);
    expect(s.shields).toBe(3);
    expect(s.extraBalls).toHaveLength(1);
    for (const b of [s.ball, ...s.extraBalls]) {
      b.x = 10;
      b.y = 100.8;
      b.vy = 95;
    }
    stepGame(s, input, 0.01);
    expect(s.shields).toBe(2);
    expect(s.serveRemaining).toBeGreaterThan(0);
    stepGame(s, input, 0.05);
    expect(s.extraBalls).toHaveLength(2);
  });
  it("pierces armored enemies once across simultaneous balls", async () => {
    const { activatePower } = await import("../../src/game/powers");
    const s = createGame({ practice: true });
    s.serveRemaining = 0;
    const e = s.enemies[0];
    e.x = 50;
    e.y = 40;
    e.hp = 9;
    e.maxHp = 9;
    e.phase = "telegraph";
    s.enemies = [e];
    s.ball.x = 50;
    s.ball.y = 44;
    s.ball.vx = 0;
    s.ball.vy = -95;
    activatePower(s, "multi");
    activatePower(s, "fire");
    for (const b of s.extraBalls) {
      b.vx = 0;
      b.vy = -95;
    }
    stepGame(s, input, 0.05);
    expect(s.kills).toBe(1);
    expect(s.score).toBe(100);
    expect(s.ball.vy).toBeLessThan(0);
  });
  it("uses seeded bounded drops and all five kinds without practice drops", () => {
    const s = createGame({ seed: 42 });
    const kinds = new Set<string>();
    let gap = 0;
    for (let i = 0; i < 150; i++) {
      awardKill(s, "drone", i, 20, 20);
      gap++;
      if (s.pickups.length) {
        kinds.add(s.pickups[0].kind);
        gap = 0;
        s.pickups = [];
      }
      expect(gap).toBeLessThan(5);
    }
    expect(kinds.size).toBe(5);
    const p = createGame({ practice: true });
    for (let i = 0; i < 100; i++) awardKill(p, "drone", i, 20, 20);
    expect(p.pickups).toHaveLength(0);
    for (let i = 0; i < 100; i++) awardKill(s, "drone", i, 20, 20);
    expect(s.pickups).toHaveLength(6);
  });
});

describe("power chronology and safety", () => {
  it("expires every stacked power at the same instant", async () => {
    const { activatePower } = await import("../../src/game/powers");
    const s = createGame();
    s.serveRemaining = 0;
    for (const kind of ["giant", "wide", "multi", "fire"] as const) {
      activatePower(s, kind);
      s.powers[kind] = 0.02;
    }
    stepGame(s, input, 0.05);
    expect(s.extraBalls).toHaveLength(0);
    expect(s.ball.radius).toBe(0.9);
    expect(s.paddles[0].width).toBe(18);
    expect(s.events.filter((e) => e.kind === "power-expired")).toHaveLength(4);
  });
  it("neutralizes only newly enclosed hazards when paddles expand", async () => {
    const { activatePower } = await import("../../src/game/powers");
    const s = createGame();
    s.serveRemaining = 0;
    s.ball.x = 10;
    s.projectiles = [60, 50].map((x, i) => ({
      id: 90 + i,
      x,
      y: 88,
      vx: 0,
      vy: 20,
      radius: 0.7,
      sourceId: 0,
    }));
    activatePower(s, "wide");
    expect(s.projectiles.map((p) => p.id)).toEqual([91]);
    stepGame(s, input, 0.01);
    expect(s.shields).toBe(2);
    expect(s.score).toBe(0);
  });
  it("clamps expanding balls and paddles while preserving capsules across transitions", async () => {
    const { activatePower } = await import("../../src/game/powers");
    const s = createGame();
    s.ball.x = 0.9;
    activatePower(s, "giant");
    activatePower(s, "wide");
    expect(s.ball.x).toBeCloseTo(1.62);
    stepGame(s, { ...input, targets: [{ id: 1, x: 0 }] });
    expect(s.paddles[0].x).toBe(13.5);
    s.pickups = [{ id: 99, kind: "multi", x: 40, y: 50, vy: 14, radius: 1 }];
    startWave(s, 8);
    stepGame(s, input, 0.05);
    expect(s.pickups[0].y).toBe(50);
    expect(s.powers.giant).toBe(30);
  });
  it("uses the earliest collision across different balls rather than primary-ball order", async () => {
    const { activatePower } = await import("../../src/game/powers");
    const s = createGame({ practice: true });
    s.serveRemaining = 0;
    activatePower(s, "multi");
    activatePower(s, "fire");
    const e = s.enemies[0];
    e.x = 50;
    e.y = 40;
    e.phase = "telegraph";
    s.enemies = [e];
    Object.assign(s.ball, { x: 50, y: 46, vx: 0, vy: -95 });
    Object.assign(s.extraBalls[0], { x: 50, y: 44, vx: 0, vy: -95 });
    Object.assign(s.extraBalls[1], { x: 10, y: 40, vx: 0, vy: -95 });
    stepGame(s, input, 0.05);
    expect(s.kills).toBe(1);
    expect(s.events.filter((e) => e.kind === "enemy-hit")[0].y).toBeCloseTo(
      42.65,
    );
    expect(s.ball.y).toBeCloseTo(41.25);
  });
  it("awards interceptions and boss bonuses in the current confirmed mode", () => {
    const s = createGame({ practice: true });
    s.serveRemaining = 0;
    s.enemies = [];
    const two: PaddleIntent = {
      ...input,
      mode: 2,
      targets: [
        { id: 1, x: 0.3 },
        { id: 2, x: 0.7 },
      ],
    };
    stepGame(s, two);
    Object.assign(s.ball, { x: 50, y: 60, vx: 0, vy: -55 });
    s.projectiles = [
      { id: 99, x: 50, y: 58, vx: 0, vy: 30, radius: 0.7, sourceId: 0 },
    ];
    stepGame(s, two, 0.02);
    expect(s.score).toBe(38);
    startWave(s, 7);
    s.bossPhase = 2;
    s.enemies = [];
    updateBoss(s);
    expect(s.score).toBe(4538);
    expect(s.events.at(-1)?.value).toBe(4500);
    s.status = "playing";
    stepGame(s, input);
    awardKill(s, "drone", 100, 20, 20);
    expect(s.score).toBe(4638);
  });
  it("caps speed/motion/cadence and adds durability every two completed cycles", async () => {
    const { difficultyForLevel, cycleForLevel } =
      await import("../../src/game/difficulty");
    expect(cycleForLevel(7)).toBe(1);
    expect(cycleForLevel(8)).toBe(2);
    expect(difficultyForLevel(1)).toEqual({
      ballSpeed: 55,
      formationSpeed: 1,
      extraHp: 0,
      attackIntervalScale: 1,
      hazardSpeed: 1,
    });
    expect(difficultyForLevel(15).extraHp).toBe(1);
    const highLevel = difficultyForLevel(1001);
    expect(highLevel.ballSpeed).toBeGreaterThan(55);
    expect(highLevel.ballSpeed).toBeLessThan(85);
    expect(highLevel.formationSpeed).toBeGreaterThan(1);
    expect(highLevel.formationSpeed).toBeLessThan(1.8);
    expect(highLevel.attackIntervalScale).toBeGreaterThan(0.55);
    expect(highLevel.attackIntervalScale).toBeLessThan(1);
    expect(highLevel.hazardSpeed).toBeGreaterThan(1);
    expect(highLevel.hazardSpeed).toBeLessThan(1.5);
    const s = createGame();
    startWave(s, 15);
    expect(s.enemies.every((e) => e.hp >= 2)).toBe(true);
  });
});

it("repair and fire activation do not manufacture a paddle return", async () => {
  const { activatePower } = await import("../../src/game/powers");
  const s = createGame();
  s.serveRemaining = 0;
  Object.assign(s.ball, { x: 50, y: 89, vy: 55 });
  activatePower(s, "shield");
  activatePower(s, "fire");
  expect(s.ball.y).toBe(89);
  expect(s.ball.vy).toBe(55);
});
it("fairness can preserve a safe extra-ball catch when the primary catch is blocked", async () => {
  const { activatePower } = await import("../../src/game/powers");
  const { canCommit, revalidateHazards } =
    await import("../../src/game/attack-director");
  const s = createGame();
  s.serveRemaining = 0;
  s.enemies = [];
  Object.assign(s.ball, { x: 50, y: 50, vx: 0, vy: 55 });
  activatePower(s, "multi");
  Object.assign(s.extraBalls[0], { x: 80, y: 50, vx: 0, vy: 55 });
  s.extraBalls[1].vy = -55;
  const hazard = {
    id: 99,
    x: 50,
    y: 50,
    vx: 0,
    vy: 55,
    radius: 0.7,
    sourceId: 0,
  };
  expect(canCommit(s, hazard)).toBe(true);
  s.projectiles = [hazard];
  revalidateHazards(s);
  expect(s.projectiles).toHaveLength(1);
  expect(s.fairnessInterventions).toBe(0);
});
it("seeded drops replay the same positions and kinds", () => {
  const run = () => {
    const s = createGame({ seed: 313 });
    const drops = [];
    for (let i = 0; i < 60; i++) {
      awardKill(s, "drone", i, i, 20);
      drops.push(...s.pickups);
      s.pickups = [];
    }
    return drops;
  };
  expect(run()).toEqual(run());
  expect(run().length).toBeGreaterThanOrEqual(12);
});
it("withholds a dive whose remaining flight would be below nine hundred milliseconds", async () => {
  const { updateAttacks } = await import("../../src/game/attack-director");
  const s = createGame();
  s.serveRemaining = 0;
  s.attackTimer = 5;
  s.paddles[0].x = 25;
  Object.assign(s.ball, { x: 25, y: 75, vx: 0, vy: 55 });
  const e = s.enemies[0];
  Object.assign(e, {
    kind: "lancer",
    x: 80,
    y: 70,
    lane: 80,
    phase: "telegraph",
    phaseTime: 0.64,
  });
  s.enemies = [e];
  updateAttacks(s, 0.02);
  expect(e.phase).not.toBe("diving");
});

describe("drains after Giant radius expiry", () => {
  it("recovers a sole ball already below the shrunken drain plane", async () => {
    const { activatePower } = await import("../../src/game/powers");
    const s = createGame();
    s.serveRemaining = 0;
    activatePower(s, "giant");
    s.powers.giant = 0.002;
    Object.assign(s.ball, { x: 10, y: 101.1, vx: 0, vy: 55 });
    stepGame(s, input);
    expect(s.shields).toBe(2);
    expect(s.serveRemaining).toBeGreaterThan(0);
    expect(s.events.filter((e) => e.kind === "drain")).toHaveLength(1);
    expect(s.events.filter((e) => e.kind === "shield-hit")).toHaveLength(1);
    for (let i = 0; i < 120; i++) stepGame(s, input);
    expect(s.shields).toBe(2);
    expect(s.ball.y).toBe(84);
  });
  it.each(["primary", "extra"] as const)(
    "removes an escaped %s ball while retaining live survivors",
    async (which) => {
      const { activatePower } = await import("../../src/game/powers");
      const s = createGame();
      s.serveRemaining = 0;
      activatePower(s, "giant");
      activatePower(s, "multi");
      s.powers.giant = 0.002;
      const escaped = which === "primary" ? s.ball : s.extraBalls[0];
      const survivors = [s.ball, ...s.extraBalls]
        .filter((b) => b.id !== escaped.id)
        .map((b) => b.id);
      Object.assign(escaped, { x: 10, y: 101.1, vx: 0, vy: 55 });
      stepGame(s, input);
      expect([s.ball, ...s.extraBalls].map((b) => b.id)).toEqual(survivors);
      expect(s.shields).toBe(3);
      expect(s.serveRemaining).toBe(0);
    },
  );
  it("charges only one shield when all three balls cross the shrunken plane together", async () => {
    const { activatePower } = await import("../../src/game/powers");
    const s = createGame();
    s.serveRemaining = 0;
    activatePower(s, "giant");
    activatePower(s, "multi");
    s.powers.giant = 0.002;
    for (const b of [s.ball, ...s.extraBalls])
      Object.assign(b, { x: 10, y: 101.1, vx: 0, vy: 55 });
    stepGame(s, input);
    expect(s.extraBalls).toHaveLength(0);
    expect(s.shields).toBe(2);
    expect(s.serveRemaining).toBeGreaterThan(0);
    expect(s.events.filter((e) => e.kind === "shield-hit")).toHaveLength(1);
    expect(s.events.filter((e) => e.kind === "drain")).toHaveLength(1);
  });
  it("keeps a Giant ball live below the ordinary plane while its radius still overlaps the arena", async () => {
    const { activatePower } = await import("../../src/game/powers");
    const s = createGame();
    s.serveRemaining = 0;
    activatePower(s, "giant");
    Object.assign(s.ball, { x: 10, y: 101.1, vx: 0, vy: 55 });
    stepGame(s, input, 0.002);
    expect(s.ball.y).toBeCloseTo(101.21);
    expect(s.shields).toBe(3);
    expect(s.serveRemaining).toBe(0);
  });
  it.each([-55, 0, 55])(
    "handles an already crossed plane immediately with vy=%s",
    (vy) => {
      const s = createGame();
      s.serveRemaining = 0;
      Object.assign(s.ball, { x: 10, y: 101.1, vx: 0, vy });
      stepGame(s, input);
      expect(s.shields).toBe(2);
      expect(s.serveRemaining).toBeGreaterThan(0);
    },
  );
});
