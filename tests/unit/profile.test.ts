import { describe, expect, it } from "vitest";
import {
  defaultProfile,
  loadProfile,
  saveProfile,
  recordRun,
  recordMilestones,
} from "../../src/storage/local-profile";
const store = (value: string | null) => ({
  getItem: () => value,
  setItem: (_key: string, v: string) => {
    value = v;
  },
});
describe("local profiles", () => {
  it("survives corrupt data, unavailable storage and malicious values", () => {
    expect(loadProfile(store("{bad")).settings.music).toBe(0.3);
    expect(
      loadProfile({
        getItem: () => {
          throw new Error("blocked");
        },
      }).version,
    ).toBe(1);
    const profile = loadProfile(
      store(
        JSON.stringify({
          version: 1,
          settings: { music: 999, effects: -1, reducedEffects: "no" },
          calibration: { min: 0.8, max: 0.2 },
          bests: { one: { score: NaN } },
        }),
      ),
    );
    expect(profile.settings.music).toBeLessThanOrEqual(1);
    expect(profile.settings.effects).toBeGreaterThanOrEqual(0);
    expect(profile.settings.reducedEffects).toBe(false);
    expect(profile.calibration.min).toBeLessThan(profile.calibration.max);
  });
  it("separates control modes and protects cleared-time records from incomplete runs", () => {
    const p = defaultProfile();
    recordRun(p, {
      mode: "one",
      score: 1500,
      activeSeconds: 150,
      wallSeconds: 180,
      won: true,
      shields: 3,
      transitions: 0,
    });
    recordRun(p, {
      mode: "mixed",
      score: 3000,
      activeSeconds: 120,
      wallSeconds: 200,
      won: true,
      shields: 1,
      transitions: 3,
    });
    recordRun(p, {
      mode: "one",
      score: 2000,
      activeSeconds: 20,
      wallSeconds: 25,
      won: false,
      shields: 0,
      transitions: 0,
    });
    expect(p.bests.one.score).toBe(2000);
    expect(p.bests.one.clearSeconds).toBe(150);
    expect(p.bests.mixed.score).toBe(3000);
    expect(p.unlocks).toContain("aurora");
    expect(p.runs).toBe(3);
  });
  it("returns failure rather than throwing on full storage", () => {
    expect(
      saveProfile(defaultProfile(), {
        setItem: () => {
          throw new Error("full");
        },
      }),
    ).toBe(false);
  });
});

it("selects only earned finishes and rejects a locked saved finish", () => {
  const locked = loadProfile(
    store(JSON.stringify({ version: 1, finish: "eclipse", unlocks: [] })),
  );
  expect(locked.finish).toBe("standard");
  const earned = loadProfile(
    store(
      JSON.stringify({ version: 1, finish: "aurora", unlocks: ["aurora"] }),
    ),
  );
  expect(earned.finish).toBe("aurora");
});

it("records endless progress and boss unlocks without inventing a completed-run time", () => {
  const profile = defaultProfile();
  recordRun(profile, {
    mode: "two",
    score: 9000,
    activeSeconds: 340,
    wallSeconds: 400,
    won: false,
    shields: 0,
    transitions: 0,
    level: 15,
    bossesDefeated: 2,
    perfectBossClears: 1,
  });
  expect(profile.bests.two.level).toBe(15);
  expect(profile.bests.two.score).toBe(9000);
  expect(profile.bests.two.clearSeconds).toBeNull();
  expect(profile.bests.one.level).toBe(0);
  expect(profile.unlocks).toEqual(["aurora", "eclipse"]);
  const storage = store(null);
  saveProfile(profile, storage);
  expect(loadProfile(storage).bests.two.level).toBe(15);
});

it("loads legacy records and validates saved endless levels", () => {
  const profile = loadProfile(
    store(
      JSON.stringify({
        version: 1,
        bests: {
          one: { score: 250, level: -10 },
          two: { score: 9000, clearSeconds: 220 },
          mixed: { score: 400, level: 9.9 },
        },
      }),
    ),
  );
  expect(profile.bests.one.level).toBe(0);
  expect(profile.bests.two.level).toBe(7);
  expect(profile.bests.mixed.level).toBe(9);
});

it("keeps a later mixed run out of single-mode records after a boss milestone", () => {
  const profile = defaultProfile();
  recordMilestones(profile, {
    mode: "one",
    score: 7000,
    level: 7,
    bossesDefeated: 1,
    perfectBossClears: 1,
  });
  const storage = store(null);
  saveProfile(profile, storage);
  const restored = loadProfile(storage);
  expect(restored.unlocks).toEqual(["aurora", "eclipse"]);
  expect(restored.bests.one.score).toBe(0);
  expect(restored.bests.one.level).toBe(0);
  recordRun(restored, {
    mode: "mixed",
    score: 9000,
    level: 10,
    bossesDefeated: 1,
    perfectBossClears: 1,
    activeSeconds: 300,
    wallSeconds: 350,
    won: false,
    shields: 2,
    transitions: 1,
  });
  expect(restored.bests.one.score).toBe(0);
  expect(restored.bests.one.level).toBe(0);
  expect(restored.bests.two.score).toBe(0);
  expect(restored.bests.mixed.score).toBe(9000);
  expect(restored.bests.mixed.level).toBe(10);
  expect(restored.runs).toBe(1);
});
