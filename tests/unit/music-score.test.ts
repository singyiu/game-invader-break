import { describe, expect, it } from "vitest";
import {
  MUSIC_STEPS,
  STEP_SECONDS,
  musicGainForSetting,
  musicVoicesAtStep,
} from "../../src/audio/music-score";

describe("procedural music score", () => {
  it("maps the default volume to an audible bus gain and preserves mute", () => {
    expect(musicGainForSetting(0)).toBe(0);
    expect(musicGainForSetting(0.3)).toBeCloseTo(0.45, 8);
    expect(musicGainForSetting(1)).toBe(1.5);
  });

  it("keeps the loop on a deterministic 112 BPM sixteenth-note grid", () => {
    expect(STEP_SECONDS).toBeCloseTo(60 / 112 / 4, 8);
    expect(MUSIC_STEPS).toBe(32);
    expect(musicVoicesAtStep(0, true, false)).toEqual(
      musicVoicesAtStep(32, true, false),
    );
  });

  it("opens combat with audible melody, harmony, percussion, and bass", () => {
    const voices = musicVoicesAtStep(0, true, false);
    expect(voices.map((voice) => voice.part)).toEqual([
      "pad",
      "pad",
      "pad",
      "bass",
      "melody",
      "kick",
      "hat",
    ]);
    expect(
      voices.find((voice) => voice.part === "melody")?.frequency,
    ).toBeCloseTo(329.63, 1);
    expect(
      voices.find((voice) => voice.part === "bass")?.frequency,
    ).toBeCloseTo(82.41, 1);
    expect(voices.every((voice) => voice.level > 0)).toBe(true);
  });

  it("keeps inactive music gentle and removes the combat rhythm section", () => {
    const quiet = musicVoicesAtStep(0, false, false);
    const combat = musicVoicesAtStep(0, true, false);
    expect(quiet.map((voice) => voice.part)).toEqual([
      "pad",
      "pad",
      "pad",
      "melody",
    ]);
    expect(quiet.reduce((sum, voice) => sum + voice.level, 0)).toBeLessThan(
      combat.reduce((sum, voice) => sum + voice.level, 0) / 2,
    );
  });

  it("reduces dense percussion when reduced effects are enabled", () => {
    expect(
      musicVoicesAtStep(2, true, false).some((v) => v.part === "hat"),
    ).toBe(true);
    expect(musicVoicesAtStep(2, true, true).some((v) => v.part === "hat")).toBe(
      false,
    );
  });
});
