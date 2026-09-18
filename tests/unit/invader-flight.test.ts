import { describe, expect, it } from "vitest";
import type { PaddleIntent } from "../../src/shared/contracts";
import { createGame } from "../../src/game/state";
import { spawnEnemy } from "../../src/game/encounters";
import { stepGame } from "../../src/game/step";
import {
  updateAttacks,
  revalidateHazards,
} from "../../src/game/attack-director";
import { flightPosition, planFlight } from "../../src/game/flight";

const input: PaddleIntent = {
  mode: 1,
  targets: [{ id: 1, x: 0.5 }],
  status: "stable",
  paused: false,
  resumeIn: 0,
  needsDwell: false,
};

function arena() {
  const s = createGame();
  s.wave = 3;
  s.serveRemaining = 0;
  s.attackTimer = 100;
  Object.assign(s.ball, { x: 10, y: 60, vx: 0, vy: 0 });
  s.enemies = [spawnEnemy(s, "drone", 10, 20)];
  return s;
}

function flying(s: ReturnType<typeof arena>, pattern: "swoop" | "weave") {
  const e = spawnEnemy(s, "lancer", 50, 20);
  e.phase = "diving";
  e.flight = { pattern, startX: 50, startY: 20, amplitude: 10, speed: 28 };
  s.enemies.push(e);
  return e;
}

describe("patterned invader flight", () => {
  it.each(["swoop", "weave"] as const)(
    "moves a %s sideways along its path",
    (pattern) => {
      const s = arena();
      const e = flying(s, pattern);
      const positions: number[] = [];
      // Stop above the paddle: 2 seconds descends from y=20 to y=76.
      for (let i = 0; i < 240; i++) {
        stepGame(s, input);
        positions.push(e.x);
      }
      expect(e.y).toBeCloseTo(76);
      expect(Math.max(...positions)).toBeGreaterThan(59);
      if (pattern === "weave") expect(Math.min(...positions)).toBeLessThan(41);
      else expect(Math.min(...positions)).toBeGreaterThanOrEqual(50);
      expect(e.phaseTime).toBeCloseTo(2);
    },
  );

  it("waits for a full warning before launching a drone that has lingered in formation", () => {
    const s = arena();
    const e = s.enemies[0];
    Object.assign(e, { x: 80, y: 20, phaseTime: 8 });
    Object.assign(s.ball, { x: 25, y: 70, vx: 0, vy: 55 });
    s.paddles[0].x = 25;
    s.attackTimer = 0;
    updateAttacks(s, 0.001);
    expect(e.phase).toBe("telegraph");
    expect(e.flight).toBeDefined();
    updateAttacks(s, 0.64);
    expect(e.phase).toBe("telegraph");
    updateAttacks(s, 0.02);
    expect(e.phase).toBe("diving");
    expect(e.phaseTime).toBe(0);
  });

  it("reserves the entire curved flight corridor when preserving a safe ball catch", () => {
    const s = arena();
    const e = flying(s, "weave");
    // The current x=75 is harmless; its advertised sweep reaches x=50.
    e.flight!.startX = 75;
    e.flight!.amplitude = -25;
    e.x = 75;
    e.y = 74;
    Object.assign(s.ball, { x: 50, y: 59.75, vx: 0, vy: 55 });
    revalidateHazards(s);
    expect(s.enemies.some((enemy) => enemy.id === e.id)).toBe(false);
    expect(s.fairnessInterventions).toBe(1);
    expect(s.shields).toBe(3);
    expect(s.score).toBe(0);
  });

  it("freezes an airborne invader when hand tracking pauses and during a recovery serve", () => {
    const s = arena();
    const e = flying(s, "weave");
    stepGame(s, { ...input, paused: true }, 0.05);
    expect([e.x, e.y, e.phaseTime]).toEqual([50, 20, 0]);
    s.serveRemaining = 1;
    stepGame(s, input, 0.05);
    expect([e.x, e.y, e.phaseTime]).toEqual([50, 20, 0]);
    s.serveRemaining = 0;
    stepGame(s, input, 0.05);
    expect(e.x).toBeGreaterThan(50);
    expect(e.y).toBeGreaterThan(20);
  });

  it.each([1, 2] as const)(
    "destroys a flying invader on a %s-hand paddle and takes exactly one shield",
    (mode) => {
      const s = arena();
      const control = {
        ...input,
        mode,
        targets:
          mode === 1
            ? [{ id: 1, x: 0.5 }]
            : [
                { id: 1, x: 0.25 },
                { id: 2, x: 0.75 },
              ],
      };
      stepGame(s, control);
      const x = mode === 1 ? 50 : 75;
      const e = spawnEnemy(s, "lancer", x, 84);
      e.phase = "diving";
      e.flight = {
        pattern: "swoop",
        startX: x,
        startY: 84,
        amplitude: 0,
        speed: 40,
      };
      s.enemies.push(e);
      stepGame(s, control, 0.05);
      expect(s.enemies.some((enemy) => enemy.id === e.id)).toBe(false);
      expect(s.shields).toBe(2);
      expect(s.lastDamage).toBe("invader body");
      expect(
        s.events.filter((event) => event.kind === "shield-hit"),
      ).toHaveLength(1);
      expect(
        s.events.some(
          (event) => event.kind === "enemy-killed" && event.entityId === e.id,
        ),
      ).toBe(true);
      expect(s.score).toBe(0);
      expect(s.pickups).toHaveLength(0);
    },
  );

  it("catches a lateral flight contact that a stationary-x body sweep would miss", () => {
    const s = arena();
    const e = spawnEnemy(s, "lancer", 62, 85);
    e.phase = "diving";
    e.flight = {
      pattern: "swoop",
      startX: 62,
      startY: 85,
      amplitude: -10,
      speed: 28,
    };
    s.enemies.push(e);
    stepGame(s, input, 0.05);
    expect(s.shields).toBe(2);
    expect(s.enemies.some((enemy) => enemy.id === e.id)).toBe(false);
  });

  it("lets the ball shoot down a diver before a later paddle collision", () => {
    const s = arena();
    const e = spawnEnemy(s, "lancer", 50, 83);
    e.phase = "diving";
    e.flight = {
      pattern: "swoop",
      startX: 50,
      startY: 83,
      amplitude: 0,
      speed: 28,
    };
    s.enemies.push(e);
    Object.assign(s.ball, { x: 50, y: 86.5, vx: 0, vy: -55 });
    stepGame(s, input, 0.05);
    expect(s.shields).toBe(3);
    expect(s.kills).toBe(1);
    expect(s.enemies.some((enemy) => enemy.id === e.id)).toBe(false);
  });

  it("removes simultaneous ram attacks during damage grace without awarding points", () => {
    const s = arena();
    const first = flying(s, "swoop");
    const second = flying(s, "weave");
    for (const e of [first, second]) {
      Object.assign(e, { x: 50, y: 86 });
      e.flight = {
        pattern: "swoop",
        startX: 50,
        startY: 86,
        amplitude: 0,
        speed: 28,
      };
    }
    stepGame(s, input, 0.05);
    expect(s.shields).toBe(2);
    expect(
      s.events.filter((event) => event.kind === "shield-hit"),
    ).toHaveLength(1);
    expect(s.enemies.some((e) => e.id === first.id || e.id === second.id)).toBe(
      false,
    );
    expect(s.kills).toBe(0);
    expect(s.score).toBe(0);
  });

  it("ends the run when a body impact consumes the final shield", () => {
    const s = arena();
    const e = flying(s, "swoop");
    s.shields = 1;
    e.y = 86;
    e.flight = {
      pattern: "swoop",
      startX: 50,
      startY: 86,
      amplitude: 0,
      speed: 28,
    };
    stepGame(s, input, 0.05);
    expect(s.shields).toBe(0);
    expect(s.status).toBe("lost");
    expect(s.enemies.some((enemy) => enemy.id === e.id)).toBe(false);
  });

  it("withholds an accelerated dive without enough reaction time and clears its warning", () => {
    const s = arena();
    s.wave = 1001;
    const e = s.enemies[0];
    Object.assign(e, {
      kind: "lancer",
      x: 80,
      y: 55,
      phase: "telegraph",
      phaseTime: 0.64,
    });
    e.flight = planFlight(e, s.wave);
    s.paddles[0].x = 25;
    Object.assign(s.ball, { x: 25, y: 70, vx: 0, vy: 55 });
    updateAttacks(s, 0.02);
    expect(e.phase).toBe("formation");
    expect(e.flight).toBeUndefined();
  });

  it("keeps only one planned or airborne dive while other invaders wait", () => {
    const s = arena();
    s.paddles[0].x = 25;
    Object.assign(s.ball, { x: 25, y: 70, vx: 0, vy: 55 });
    const e = s.enemies[0];
    Object.assign(e, { x: 80, phaseTime: 8 });
    const other = spawnEnemy(s, "lancer", 70, 20);
    other.phaseTime = 8;
    s.enemies.push(other);
    s.attackTimer = 0;
    updateAttacks(s, 0.01);
    expect(s.enemies.filter((enemy) => enemy.flight)).toHaveLength(1);
    s.attackTimer = 0;
    updateAttacks(s, 0.01);
    expect(s.enemies.filter((enemy) => enemy.flight)).toHaveLength(1);
    updateAttacks(s, 0.65);
    expect(s.enemies.filter((enemy) => enemy.phase === "diving")).toHaveLength(
      1,
    );
  });

  it.each(["swoop", "weave"] as const)(
    "retraces the exact %s route back to its launch position",
    (pattern) => {
      const flight = {
        pattern,
        startX: 50,
        startY: 20,
        amplitude: 10,
        speed: 34,
      };
      for (const elapsed of [0, 0.25, 0.5, 1, 1.5, 1.75, 2]) {
        const outward = flightPosition(flight, elapsed);
        const returning = flightPosition(flight, 4 - elapsed);
        expect(returning.x).toBeCloseTo(outward.x);
        expect(returning.y).toBeCloseTo(outward.y);
      }
      expect(flightPosition(flight, 2).y).toBe(88);
      expect(flightPosition(flight, 5)).toEqual({ x: 50, y: 20 });
    },
  );

  it.each(["swoop", "weave"] as const)(
    "keeps the final missed %s alive through its return and resumes formation",
    (pattern) => {
      const s = arena();
      const control = { ...input, targets: [{ id: 1, x: 0.2 }] };
      s.paddles[0].x = 20;
      const e = flying(s, pattern);
      e.flight!.speed = 34;
      s.enemies = [e];
      for (let i = 0; i < 60; i++) stepGame(s, control, 0.05);
      expect(s.enemies).toContain(e);
      expect(e.phase).toBe("diving");
      expect(e.y).toBeCloseTo(54);
      expect(e.x).toBeCloseTo(pattern === "swoop" ? 60 : 50);
      for (let i = 0; i < 20; i++) stepGame(s, control, 0.05);
      expect(s.enemies).toContain(e);
      expect(e.x).toBeCloseTo(50);
      expect(e.y).toBeCloseTo(20);
      expect(e.phase).toBe("formation");
      expect(e.phaseTime).toBe(0);
      expect(e.flight).toBeUndefined();
      expect(s.wave).toBe(3);
      expect(s.serveRemaining).toBe(0);
      expect(s.shields).toBe(3);
      expect(s.score).toBe(0);
      expect(s.kills).toBe(0);
      expect(s.pickups).toHaveLength(0);
      stepGame(s, control, 0.05);
      expect(e.x).not.toBe(50);
      expect(Math.abs(e.x - 50)).toBeLessThan(1);
      expect(Math.abs(e.y - 20)).toBeLessThan(0.1);
    },
  );

  it("pauses and resumes the return leg without restarting the path", () => {
    const s = arena();
    const e = flying(s, "swoop");
    e.flight!.speed = 34;
    e.phaseTime = 3;
    Object.assign(e, { x: 60, y: 54 });
    stepGame(s, { ...input, paused: true }, 0.05);
    expect([e.x, e.y, e.phaseTime]).toEqual([60, 54, 3]);
    s.serveRemaining = 1;
    stepGame(s, input, 0.05);
    expect([e.x, e.y, e.phaseTime]).toEqual([60, 54, 3]);
    s.serveRemaining = 0;
    stepGame(s, input, 0.05);
    expect(e.y).toBeCloseTo(52.3);
    expect(e.phaseTime).toBeCloseTo(3.05);
  });

  it("resumes formation before accepting another attack when the timer expires on arrival", () => {
    const s = arena();
    const e = flying(s, "swoop");
    e.flight = {
      pattern: "swoop",
      startX: 80,
      startY: 20,
      amplitude: -10,
      speed: 34,
    };
    e.phaseTime = 3.975;
    Object.assign(e, flightPosition(e.flight, e.phaseTime));
    s.enemies = [e];
    s.paddles[0].x = 25;
    s.attackTimer = 0;
    Object.assign(s.ball, { x: 25, y: 60, vx: 0, vy: 55 });
    const control = { ...input, targets: [{ id: 1, x: 0.25 }] };
    stepGame(s, control, 0.05);
    expect(e.phase).toBe("formation");
    expect(e.flight).toBeUndefined();
    expect(e.x).toBe(80);
    expect(e.y).toBe(20);
    s.attackTimer = 0;
    stepGame(s, control, 0.05);
    expect(e.x).not.toBe(80);
    expect(e.phase).toBe("telegraph");
    expect(e.flight).toBeDefined();
  });

  it("detects a ball contact at the turnaround within a simulation tick", () => {
    const s = arena();
    const e = flying(s, "swoop");
    e.flight!.speed = 34;
    e.phaseTime = 1.975;
    Object.assign(e, flightPosition(e.flight!, e.phaseTime));
    s.paddles[0].x = 20;
    Object.assign(s.ball, { x: 50, y: 91.2, vx: 0, vy: 0 });
    // Both tick endpoints are y=87.15; the body reaches the ball only at the turn.
    stepGame(s, { ...input, targets: [{ id: 1, x: 0.2 }] }, 0.05);
    expect(s.enemies).not.toContain(e);
    expect(s.kills).toBe(1);
    expect(s.shields).toBe(3);
  });

  it("allows the ball to destroy an invader on its return leg", () => {
    const s = arena();
    const e = flying(s, "swoop");
    e.flight!.speed = 34;
    e.phaseTime = 3;
    Object.assign(e, { x: 60, y: 54 });
    Object.assign(s.ball, { x: 60, y: 49, vx: 0, vy: 55 });
    stepGame(s, input, 0.05);
    expect(s.enemies).not.toContain(e);
    expect(s.kills).toBe(1);
    expect(s.shields).toBe(3);
  });

  it("destroys a returning invader when the player moves a paddle into it", () => {
    const s = arena();
    s.paddles[0].x = 31;
    const e = flying(s, "swoop");
    e.flight!.speed = 34;
    e.phaseTime = 2.02;
    Object.assign(e, flightPosition(e.flight!, e.phaseTime));
    stepGame(s, input, 0.05);
    expect(s.enemies).not.toContain(e);
    expect(s.shields).toBe(2);
    expect(s.lastDamage).toBe("invader body");
    expect(s.score).toBe(0);
  });

  it("does not erase a returning invader that has already cleared the paddle", () => {
    const s = arena();
    const e = flying(s, "swoop");
    e.flight!.speed = 34;
    e.phaseTime = 2.3;
    Object.assign(e, { x: 54.54, y: 77.8 });
    Object.assign(s.ball, { x: 50, y: 70.85, vx: 0, vy: 55 });
    revalidateHazards(s);
    expect(s.enemies).toContain(e);
    expect(s.fairnessInterventions).toBe(0);
  });

  it.each(["swoop", "weave"] as const)(
    "keeps the whole %s body inside the walls and finishes on its warned lane",
    (pattern) => {
      const s = arena();
      for (const x of [2.25, 5, 50, 95, 97.75]) {
        const e = spawnEnemy(s, "lancer", x, 20);
        const flight = { ...planFlight(e, 1001), pattern };
        const duration = 68 / flight.speed;
        for (let n = 0; n <= 100; n++) {
          const position = flightPosition(flight, (duration * n) / 100);
          expect(position.x - e.width / 2).toBeGreaterThanOrEqual(-1e-9);
          expect(position.x + e.width / 2).toBeLessThanOrEqual(100 + 1e-9);
        }
        expect(flightPosition(flight, 0)).toEqual({ x, y: 20 });
        expect(flightPosition(flight, duration).x).toBeCloseTo(x);
        expect(flightPosition(flight, duration).y).toBeCloseTo(88);
      }
    },
  );

  it("scales actual enemy shots after five levels without shrinking reaction time below 0.9 seconds", () => {
    const speeds = [5, 6, 10, 11, 1001].map((level) => {
      const s = arena();
      s.wave = level;
      s.paddles[0].x = 25;
      Object.assign(s.ball, { x: 25, y: 70, vx: 0, vy: 55 });
      Object.assign(s.enemies[0], {
        kind: "spitter",
        x: 80,
        y: 20,
        lane: 80,
        phase: "telegraph",
        phaseTime: 0.64,
      });
      updateAttacks(s, 0.02);
      expect(s.projectiles).toHaveLength(1);
      const p = s.projectiles[0];
      expect((88 - 0.75 - p.radius - p.y) / p.vy).toBeGreaterThanOrEqual(0.9);
      return p.vy;
    });
    expect(speeds[1]).toBeGreaterThan(speeds[0]);
    expect(speeds[2]).toBe(speeds[1]);
    expect(speeds[3]).toBeGreaterThan(speeds[2]);
    expect(speeds[4]).toBeGreaterThan(speeds[3]);
  });
});
