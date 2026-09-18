import type { RenderOptions } from "../shared/contracts";

export interface ArenaFrustum {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface RenderBudget {
  pixelRatio: number;
  starCount: number;
  debrisCount: number;
  effectCapacity: number;
  trailSamples: number;
}

const ARENA_SIZE = 100;

/** Decorative animation uses a stable authored pose when reduced effects are active. */
export function decorativeTime(
  elapsedSeconds: number,
  reducedEffects: boolean,
): number {
  return reducedEffects ? 0 : elapsedSeconds;
}

export function calculateArenaFrustum(
  width: number,
  height: number,
): ArenaFrustum {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return { left: 0, right: ARENA_SIZE, top: 0, bottom: ARENA_SIZE };
  }

  const aspect = width / height;
  if (aspect >= 1) {
    const visibleWidth = ARENA_SIZE * aspect;
    const inset = (visibleWidth - ARENA_SIZE) / 2;
    return {
      left: -inset,
      right: ARENA_SIZE + inset,
      top: 0,
      bottom: ARENA_SIZE,
    };
  }

  const visibleHeight = ARENA_SIZE / aspect;
  const inset = (visibleHeight - ARENA_SIZE) / 2;
  return {
    left: 0,
    right: ARENA_SIZE,
    top: -inset,
    bottom: ARENA_SIZE + inset,
  };
}

export function deriveRenderBudget(
  options: RenderOptions,
  devicePixelRatio: number,
): RenderBudget {
  const requestedRatio =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;
  const qualityCap =
    options.quality === "low" ? 1 : options.quality === "high" ? 2.25 : 2;

  if (options.reducedEffects) {
    return {
      pixelRatio: Math.min(requestedRatio, 1.5, qualityCap),
      starCount: 48,
      debrisCount: 10,
      effectCapacity: 44,
      trailSamples: 6,
    };
  }

  if (options.quality === "low") {
    return {
      pixelRatio: Math.min(requestedRatio, qualityCap),
      starCount: 76,
      debrisCount: 16,
      effectCapacity: 56,
      trailSamples: 9,
    };
  }

  return {
    pixelRatio: Math.min(requestedRatio, qualityCap),
    starCount: 150,
    debrisCount: 30,
    effectCapacity: 96,
    trailSamples: 14,
  };
}
