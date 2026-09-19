import { afterEach, expect, it, vi } from "vitest";
import { InvaderBreakApp } from "../../src/app/application";
import { SessionMachine } from "../../src/app/session-machine";

afterEach(() => vi.unstubAllGlobals());

it("starts the camera while audio activation is still pending", async () => {
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

  await vi.waitFor(() => expect(camera.running).toBe(true));
  await startup;
  expect((app as unknown as { session: SessionMachine }).session.phase).toBe(
    "align",
  );

  resolveAudio(true);
});

it("starts the camera when audio activation rejects", async () => {
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("document", { hidden: false });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });
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
      activate: () => Promise.reject(new Error("audio unavailable")),
      suspend: vi.fn(),
    },
    applyCalibration: vi.fn(),
    elements: { "quality-label": { textContent: "" } },
    startupGeneration: 0,
    disposed: false,
  });

  await expect(
    (app as unknown as { enable: () => Promise<void> }).enable(),
  ).resolves.toBeUndefined();
  expect(camera.running).toBe(true);
  expect((app as unknown as { session: SessionMachine }).session.phase).toBe(
    "align",
  );
});

it("keeps a stopped session inactive when its audio activation settles", async () => {
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
  const audio = {
    running: false,
    activate: () =>
      new Promise<boolean>((resolve) => {
        resolveAudio = resolve;
      }).then((ready) => {
        audio.running = ready;
        return ready;
      }),
    suspend: vi.fn(() => {
      audio.running = false;
    }),
  };
  const app = Object.create(InvaderBreakApp.prototype);
  Object.assign(app, {
    session: new SessionMachine(),
    camera,
    controller: { reset: vi.fn() },
    audio,
    applyCalibration: vi.fn(),
    elements: { "quality-label": { textContent: "" } },
    startupGeneration: 0,
    disposed: false,
  });
  const startup = (app as unknown as { enable: () => Promise<void> }).enable();
  await vi.waitFor(() => expect(camera.running).toBe(true));

  (app as unknown as { suspend: () => void }).suspend();
  resolveAudio(true);
  await startup;

  expect(camera.running).toBe(false);
  await vi.waitFor(() => expect(audio.running).toBe(false));
  expect((app as unknown as { session: SessionMachine }).session.phase).toBe(
    "suspended",
  );
});
