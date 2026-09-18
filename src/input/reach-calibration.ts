import type { Calibration } from "../shared/contracts";

export const DEFAULT_CALIBRATION: Readonly<Calibration> = Object.freeze({
  min: 0.18,
  max: 0.82,
});
export const MIN_CALIBRATION_WIDTH = 0.12;

export function normalizeCalibration(value: Calibration): Calibration {
  if (
    !Number.isFinite(value.min) ||
    !Number.isFinite(value.max) ||
    value.min >= value.max
  ) {
    return { ...DEFAULT_CALIBRATION };
  }
  let min = clamp(value.min, 0, 1);
  let max = clamp(value.max, 0, 1);
  if (max - min < MIN_CALIBRATION_WIDTH) {
    const center = (min + max) / 2;
    min = clamp(
      center - MIN_CALIBRATION_WIDTH / 2,
      0,
      1 - MIN_CALIBRATION_WIDTH,
    );
    max = min + MIN_CALIBRATION_WIDTH;
  }
  return { min, max };
}

/** Source coordinates are unmirrored. This is the pipeline's single mirror. */
export function mapSourceX(sourceX: number, calibration: Calibration): number {
  const safe = normalizeCalibration(calibration);
  return clamp((safe.max - sourceX) / (safe.max - safe.min), 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
