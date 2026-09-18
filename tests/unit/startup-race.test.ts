import { afterEach, expect, it, vi } from "vitest";
import { InvaderBreakApp } from "../../src/app/application";
import { SessionMachine } from "../../src/app/session-machine";

afterEach(() => vi.unstubAllGlobals());
it("invalidates an awaited audio activation before it can open the camera", async () => {
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("document", { hidden: false });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });
  let resolveAudio!: (ready: boolean) => void;
  const camera = {
    running: false,
    start: vi.fn(async () => {
      camera.running = true;
    }),
    stop: vi.fn(() => {
      camera.running = false;
    }),
  };
  const app = Object.create(InvaderBreakApp.prototype);
  Object.assign(app, {
    session: new SessionMachine(),
    camera,
    controller: { reset: vi.fn() },
    audio: {
      activate: () =>
        new Promise<boolean>((resolve) => {
          resolveAudio = resolve;
        }),
      suspend: vi.fn(),
    },
    applyCalibration: vi.fn(),
    elements: { "quality-label": { textContent: "" } },
    startupGeneration: 0,
    disposed: false,
  });
  const startup = (app as unknown as { enable: () => Promise<void> }).enable();
  (app as unknown as { suspend: () => void }).suspend();
  resolveAudio(true);
  await startup;
  expect(camera.start).not.toHaveBeenCalled();
  expect(camera.running).toBe(false);
});
