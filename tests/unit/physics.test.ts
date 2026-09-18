import { describe, expect, it } from "vitest";
import { createGame } from "../../src/game/state";
import { stepGame } from "../../src/game/step";
import type { PaddleIntent } from "../../src/shared/contracts";
const intent: PaddleIntent = {
  mode: 1,
  targets: [{ id: 1, x: 0.5 }],
  paused: false,
  status: "stable",
  resumeIn: 0,
  needsDwell: false,
};
function game() {
  const s = createGame({ practice: true });
  s.enemies = [];
  s.serveRemaining = 0;
  return s;
}
describe("authoritative physics", () => {
  it("starts with exactly three shields and normalized arena geometry", () => {
    const s = createGame();
    expect(s.shields).toBe(3);
    expect(s.ball.radius).toBe(0.9);
    expect(s.paddles[0].width).toBe(18);
  });
  it.each([41.5, 50, 58.5])(
    "catches a fast ball at x=%s across the full one-hand paddle",
    (x) => {
      const s = game();
      s.ball = { id: 0, x, y: 85, vx: 0, vy: 95, radius: 0.9 };
      stepGame(s, intent, 1 / 30);
      expect(s.ball.vy).toBeLessThan(0);
      expect(s.returns).toBe(1);
    },
  );
  it("never catches a ball from below", () => {
    const s = game();
    s.ball = { id: 0, x: 50, y: 90, vx: 0, vy: -55, radius: 0.9 };
    stepGame(s, intent, 1 / 30);
    expect(s.returns).toBe(0);
  });
  it.each([18.5, 31.5, 68.5, 81.5])(
    "catches a ball at x=%s on the wider split-paddle edges",
    (x) => {
      const s = game();
      const two: PaddleIntent = {
        ...intent,
        mode: 2,
        targets: [
          { id: 1, x: 0.25 },
          { id: 2, x: 0.75 },
        ],
      };
      stepGame(s, two);
      s.ball = { id: 0, x, y: 85, vx: 0, vy: 95, radius: 0.9 };
      stepGame(s, two, 1 / 30);
      expect(s.returns).toBe(1);
      expect(s.ball.vy).toBeLessThan(0);
    },
  );
  it("keeps the full width of both split paddles inside the arena", () => {
    const s = game();
    stepGame(s, {
      ...intent,
      mode: 2,
      targets: [
        { id: 1, x: 0 },
        { id: 2, x: 1 },
      ],
    });
    expect(s.paddles.map((paddle) => paddle.x)).toEqual([6.75, 93.25]);
    expect(s.paddles[0].x - s.paddles[0].width / 2).toBe(0);
    expect(s.paddles[1].x + s.paddles[1].width / 2).toBe(100);
  });
  it("touching split paddles are a single aim surface without duplicate returns", () => {
    const s = game();
    const two = {
      ...intent,
      mode: 2 as const,
      targets: [
        { id: 1, x: 0.4325 },
        { id: 2, x: 0.5675 },
      ],
    };
    stepGame(s, two);
    s.ball = { id: 0, x: 50, y: 86, vx: 0, vy: 55, radius: 0.9 };
    stepGame(s, two);
    expect(s.returns).toBe(1);
    expect(Math.abs(s.ball.vx / s.ball.vy)).toBeLessThan(0.2);
  });
  it("freezes all timers and rewards when tracking is paused", () => {
    const s = createGame();
    const before = JSON.stringify(s);
    stepGame(s, { ...intent, paused: true, status: "reconfiguring" });
    expect(JSON.stringify(s)).toBe(before);
  });
  it("tracks hand mode history and safely separates an enclosed ball", () => {
    const s = game();
    s.ball = { id: 0, x: 50, y: 88, vx: 0, vy: 55, radius: 0.9 };
    stepGame(s, {
      ...intent,
      mode: 2,
      targets: [
        { id: 1, x: 0.49 },
        { id: 2, x: 0.51 },
      ],
    });
    expect(s.ball.y).toBeLessThan(87);
    expect(s.returns).toBe(0);
    expect(s.controlHistory).toBe("two");
  });
});
