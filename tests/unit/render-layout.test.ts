import { describe, expect, it } from "vitest";
import {
  calculateArenaFrustum,
  decorativeTime,
  deriveRenderBudget,
} from "../../src/render/render-layout";
import { getPaddleFinishColors } from "../../src/render/paddle-finish";

describe("calculateArenaFrustum", () => {
  it("keeps the whole 100 by 100 arena visible on a wide canvas", () => {
    const frustum = calculateArenaFrustum(1600, 900);

    expect(frustum).toEqual({
      left: -38.888888888888886,
      right: 138.88888888888889,
      top: 0,
      bottom: 100,
    });
  });

  it("keeps the whole arena visible on a tall canvas", () => {
    const frustum = calculateArenaFrustum(600, 900);

    expect(frustum).toEqual({ left: 0, right: 100, top: -25, bottom: 125 });
  });

  it("falls back to a square arena for invalid measurements", () => {
    expect(calculateArenaFrustum(0, Number.NaN)).toEqual({
      left: 0,
      right: 100,
      top: 0,
      bottom: 100,
    });
  });
});

describe("deriveRenderBudget", () => {
  it("removes ambient decoration and shortens trails when effects are reduced", () => {
    expect(
      deriveRenderBudget({ quality: "high", reducedEffects: true }, 3),
    ).toEqual({
      pixelRatio: 1.5,
      starCount: 48,
      debrisCount: 10,
      effectCapacity: 44,
      trailSamples: 6,
    });
  });

  it("caps automatic quality on dense displays", () => {
    expect(
      deriveRenderBudget({ quality: "auto", reducedEffects: false }, 4),
    ).toEqual({
      pixelRatio: 2,
      starCount: 150,
      debrisCount: 30,
      effectCapacity: 96,
      trailSamples: 14,
    });
  });
});

describe("decorativeTime", () => {
  it("freezes decorative motion at its authored rest pose for reduced effects", () => {
    expect(decorativeTime(27.4, true)).toBe(0);
  });

  it("returns to the current clock when reduced effects are disabled", () => {
    expect(decorativeTime(27.4, false)).toBe(27.4);
  });
});

describe("getPaddleFinishColors", () => {
  it("keeps each cosmetic finish in its authored color family", () => {
    expect(getPaddleFinishColors("standard")).toEqual({
      energy: 0x7eefff,
      emissive: 0x09bad4,
      glow: 0x4de9ff,
      cap: 0xbdd6df,
      trim: 0x547493,
    });
    expect(getPaddleFinishColors("aurora")).toEqual({
      energy: 0x9effd8,
      emissive: 0x18d59a,
      glow: 0x6dffc9,
      cap: 0xc8f1df,
      trim: 0x5f9c8b,
    });
    expect(getPaddleFinishColors("eclipse")).toEqual({
      energy: 0xdac7ff,
      emissive: 0x9368ff,
      glow: 0xb99aff,
      cap: 0xded3f2,
      trim: 0x81709d,
    });
  });
});
