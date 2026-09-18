import type { Calibration, PlayerSettings } from "../shared/contracts";
export interface Best {
  score: number;
  level: number;
  clearSeconds: number | null;
  wallSeconds: number | null;
}
export interface Profile {
  version: 1;
  settings: PlayerSettings;
  calibration: Calibration;
  bests: Record<"one" | "two" | "mixed", Best>;
  unlocks: string[];
  finish: "standard" | "aurora" | "eclipse";
  runs: number;
}
export interface RunProgress {
  mode: "one" | "two" | "mixed";
  score: number;
  level?: number;
  bossesDefeated?: number;
  perfectBossClears?: number;
}
export interface RunRecord extends RunProgress {
  activeSeconds: number;
  wallSeconds: number;
  won: boolean;
  shields: number;
  transitions: number;
}
const KEY = "invader-break.profile.v1";
const finite = (
  value: unknown,
  fallback: number,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export function defaultProfile(): Profile {
  return {
    version: 1,
    settings: {
      music: 0.3,
      effects: 0.65,
      reducedEffects: false,
      sensitivity: "comfortable",
      uiScale: "normal",
    },
    calibration: { min: 0.18, max: 0.82 },
    bests: {
      one: { score: 0, level: 0, clearSeconds: null, wallSeconds: null },
      two: { score: 0, level: 0, clearSeconds: null, wallSeconds: null },
      mixed: { score: 0, level: 0, clearSeconds: null, wallSeconds: null },
    },
    unlocks: [],
    finish: "standard",
    runs: 0,
  };
}
export function loadProfile(storage?: Pick<Storage, "getItem">): Profile {
  const profile = defaultProfile();
  try {
    const data = object(
      JSON.parse((storage ?? localStorage).getItem(KEY) ?? "{}"),
    );
    if (data.version !== 1) return profile;
    const settings = object(data.settings);
    profile.settings.music = finite(settings.music, 0.3, 0, 1);
    profile.settings.effects = finite(settings.effects, 0.65, 0, 1);
    profile.settings.reducedEffects = settings.reducedEffects === true;
    profile.settings.sensitivity =
      settings.sensitivity === "small" ? "small" : "comfortable";
    profile.settings.uiScale =
      settings.uiScale === "large" ? "large" : "normal";
    const c = object(data.calibration);
    const min = finite(c.min, 0.18, 0, 1),
      max = finite(c.max, 0.82, 0, 1);
    if (max - min >= 0.15) profile.calibration = { min, max };
    const bests = object(data.bests);
    for (const mode of ["one", "two", "mixed"] as const) {
      const best = object(bests[mode]);
      profile.bests[mode] = {
        score: Math.floor(finite(best.score, 0)),
        level: Math.floor(
          finite(
            best.level,
            finite(best.clearSeconds, 0) > 0
              ? 7
              : finite(best.score, 0) > 0
                ? 1
                : 0,
          ),
        ),
        clearSeconds:
          typeof best.clearSeconds === "number" &&
          Number.isFinite(best.clearSeconds) &&
          best.clearSeconds > 0
            ? best.clearSeconds
            : null,
        wallSeconds:
          typeof best.wallSeconds === "number" &&
          Number.isFinite(best.wallSeconds) &&
          best.wallSeconds > 0
            ? best.wallSeconds
            : null,
      };
    }
    profile.runs = Math.floor(finite(data.runs, 0));
    profile.unlocks = Array.isArray(data.unlocks)
      ? ["aurora", "eclipse"].filter((x) =>
          (data.unlocks as unknown[]).includes(x),
        )
      : [];
    if (
      (data.finish === "aurora" || data.finish === "eclipse") &&
      profile.unlocks.includes(data.finish)
    )
      profile.finish = data.finish;
  } catch {
    /* Private browsing and corrupt/full storage must never block play. */
  }
  return profile;
}
export function saveProfile(
  profile: Profile,
  storage?: Pick<Storage, "setItem">,
): boolean {
  try {
    (storage ?? localStorage).setItem(KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}
/** Boss rewards persist immediately; score categories are final only at run end. */
export function recordMilestones(profile: Profile, record: RunProgress): void {
  if (
    finite(record.bossesDefeated, 0) >= 1 &&
    !profile.unlocks.includes("aurora")
  )
    profile.unlocks.push("aurora");
  if (
    finite(record.perfectBossClears, 0) >= 1 &&
    !profile.unlocks.includes("eclipse")
  )
    profile.unlocks.push("eclipse");
}
export function recordRun(profile: Profile, record: RunRecord): void {
  const best = profile.bests[record.mode];
  profile.runs += 1;
  best.score = Math.max(best.score, Math.floor(finite(record.score, 0)));
  best.level = Math.max(
    best.level,
    Math.floor(finite(record.level, record.won ? 7 : 1)),
  );
  recordMilestones(profile, record);
  if (
    record.won &&
    Number.isFinite(record.activeSeconds) &&
    record.activeSeconds > 0 &&
    (best.clearSeconds === null || record.activeSeconds < best.clearSeconds)
  ) {
    best.clearSeconds = record.activeSeconds;
    best.wallSeconds = record.wallSeconds;
  }
  if (record.won && !profile.unlocks.includes("aurora"))
    profile.unlocks.push("aurora");
  if (
    record.won &&
    record.shields === 3 &&
    !profile.unlocks.includes("eclipse")
  )
    profile.unlocks.push("eclipse");
}
