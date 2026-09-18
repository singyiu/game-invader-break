import { afterEach, expect, it, vi } from "vitest";
import { InvaderBreakApp } from "../../src/app/application";
import { SessionMachine } from "../../src/app/session-machine";
import { DwellMenu } from "../../src/ui/dwell-menu";
import { createGame } from "../../src/game/state";
import { defaultProfile } from "../../src/storage/local-profile";

afterEach(() => vi.unstubAllGlobals());
it("disconnect banks an endless run once before clearing it", () => {
  let saved = "";
  vi.stubGlobal("localStorage", {
    setItem: (_: string, value: string) => {
      saved = value;
    },
  });
  const game = createGame();
  Object.assign(game, {
    wave: 12,
    time: 44,
    score: 1700,
    bossesDefeated: 1,
    perfectBossClears: 1,
  });
  const profile = defaultProfile();
  const app = Object.create(InvaderBreakApp.prototype);
  Object.assign(app, {
    game,
    profile,
    session: new SessionMachine("playing"),
    dwell: new DwellMenu(),
    camera: { stop() {} },
    controller: { reset() {} },
    audio: { suspend() {} },
    metrics: { reset() {} },
    startupGeneration: 0,
    runStartedAt: 100,
    runRecorded: false,
  });
  app.choose("exit", 44100);
  app.choose("exit", 44200);
  expect(profile.runs).toBe(1);
  expect(profile.bests.one.level).toBe(12);
  expect(profile.bests.one.score).toBe(1700);
  expect(profile.unlocks).toEqual(["aurora", "eclipse"]);
  expect(JSON.parse(saved).bests.one.level).toBe(12);
  expect(app.session.phase).toBe("landing");
  expect(app.game.wave).toBe(1);
});
