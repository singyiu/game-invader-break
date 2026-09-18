import { describe, expect, it } from "vitest";
import {
  DEFAULT_CALIBRATION,
  mapSourceX,
  normalizeCalibration,
} from "../../src/input/reach-calibration";

describe("shared reach calibration", () => {
  it("mirrors source coordinates exactly once across the calibrated reach", () => {
    expect(mapSourceX(DEFAULT_CALIBRATION.min, DEFAULT_CALIBRATION)).toBe(1);
    expect(mapSourceX(DEFAULT_CALIBRATION.max, DEFAULT_CALIBRATION)).toBe(0);
    expect(mapSourceX(0.5, DEFAULT_CALIBRATION)).toBeCloseTo(0.5, 8);
  });

  it("clamps an invalid or too-narrow calibration to a safe shared range", () => {
    expect(normalizeCalibration({ min: 0.8, max: 0.2 })).toEqual(
      DEFAULT_CALIBRATION,
    );
    const narrow = normalizeCalibration({ min: 0.48, max: 0.52 });
    expect(narrow.max - narrow.min).toBeGreaterThanOrEqual(0.12);
    expect(narrow.min).toBeGreaterThanOrEqual(0);
    expect(narrow.max).toBeLessThanOrEqual(1);
  });
});
