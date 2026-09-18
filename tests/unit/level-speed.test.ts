import { describe, expect, it } from "vitest";
import { difficultyForLevel } from "../../src/game/difficulty";
import { startWave } from "../../src/game/encounters";
import { activatePower } from "../../src/game/powers";
import { createGame } from "../../src/game/state";
import { stepGame } from "../../src/game/step";
import type { PaddleIntent } from "../../src/shared/contracts";

const input: PaddleIntent = {
  mode: 1,
  targets: [{ id: 1, x: 0.5 }],
  status: "stable",
  paused: false,
  resumeIn: 0,
  needsDwell: false,
};

function serveAtLevel(level: number, practice = false) {
  const state = createGame({ practice });
  startWave(state, level);
  stepGame(state, input, 0.05);
  return state;
}

describe("level speed tiers", () => {
  it.each([
    [5, 55],
    [6, 61],
    [10, 61],
    [11, 65],
  ])("serves level %i at speed %f", (level, speed) => {
    const state = serveAtLevel(level);
    expect(Math.hypot(state.ball.vx, state.ball.vy)).toBeCloseTo(speed);
  });

  it("keeps speed and cadence unchanged within a five-level tier", () => {
    for (const level of [6, 10]) {
      const difficulty = difficultyForLevel(level);
      expect(difficulty.ballSpeed).toBeCloseTo(61);
      expect(difficulty.formationSpeed).toBeCloseTo(1.16);
      expect(difficulty.attackIntervalScale).toBeCloseTo(0.91);
      expect(difficulty.hazardSpeed).toBeCloseTo(1.1);
    }
    for (const level of [11, 15]) {
      const difficulty = difficultyForLevel(level);
      expect(difficulty.ballSpeed).toBeCloseTo(65);
      expect(difficulty.formationSpeed).toBeCloseTo(1.266667);
      expect(difficulty.attackIntervalScale).toBeCloseTo(0.85);
      expect(difficulty.hazardSpeed).toBeCloseTo(1.166667);
    }
  });

  it("grows toward finite limits at arbitrarily high levels", () => {
    const difficulty = difficultyForLevel(Number.MAX_SAFE_INTEGER);
    expect(difficulty.ballSpeed).toBeGreaterThan(84);
    expect(difficulty.ballSpeed).toBeLessThan(85);
    expect(difficulty.formationSpeed).toBeGreaterThan(1.79);
    expect(difficulty.formationSpeed).toBeLessThan(1.8);
    expect(difficulty.attackIntervalScale).toBeGreaterThan(0.55);
    expect(difficulty.attackIntervalScale).toBeLessThan(0.56);
    expect(difficulty.hazardSpeed).toBeGreaterThan(1.49);
    expect(difficulty.hazardSpeed).toBeLessThan(1.5);
  });

  it("restores every active multiball at the current tier speed", () => {
    const state = createGame();
    startWave(state, 6);
    activatePower(state, "multi");
    state.extraBalls = [];
    stepGame(state, input, 0.05);

    expect([state.ball, ...state.extraBalls]).toHaveLength(3);
    for (const ball of [state.ball, ...state.extraBalls]) {
      expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(61);
    }
  });

  it("keeps practice serves at their baseline speed", () => {
    const state = serveAtLevel(11, true);
    expect(Math.hypot(state.ball.vx, state.ball.vy)).toBeCloseTo(32);
  });
});
