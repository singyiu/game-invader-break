import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CapturedFrame } from "../../src/camera/frame-scheduler";
const mocks = vi.hoisted(() => ({
  createFromOptions: vi.fn(),
  forVisionTasks: vi.fn(),
  registerWasmFactory: vi.fn(),
}));
vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: mocks.forVisionTasks },
  HandLandmarker: { createFromOptions: mocks.createFromOptions },
}));
vi.mock("../../src/perception/worker-loader", () => ({
  registerWasmFactory: mocks.registerWasmFactory,
}));
import { MediaPipeHandProvider } from "../../src/perception/hand-provider";
const options = { modelUrl: "/model.task", wasmUrl: "/runtime/wasm" };
const empty = { landmarks: [], handedness: [] };
let canvases: {
  width: number;
  height: number;
  bitmap: { close: ReturnType<typeof vi.fn> };
}[];
let events: string[];
function model() {
  return {
    detectForVideo: vi.fn(() => {
      events.push("inference");
      return empty;
    }),
    close: vi.fn(() => events.push("model-close")),
  };
}
function frame(mediaTime: number, frameId = 1): CapturedFrame {
  return {
    frameId,
    capturedAt: 1234,
    mediaTime,
    width: 640,
    height: 480,
    bitmap: { close: vi.fn() } as unknown as ImageBitmap,
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  canvases = [];
  events = [];
  mocks.forVisionTasks.mockResolvedValue({
    wasmLoaderPath: "/loader.js",
    wasmBinaryPath: "/module.wasm",
  });
  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      bitmap = { close: vi.fn(() => events.push("bitmap-close")) };
      constructor(
        public width: number,
        public height: number,
      ) {
        canvases.push(this);
        events.push(`canvas-${width}x${height}`);
      }
      getContext() {
        return { fillStyle: "", fillRect: vi.fn() };
      }
      transferToImageBitmap() {
        return this.bitmap;
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("provider startup inference warmup", () => {
  it("finishes actual blank inference and disposes its bitmap before initialization resolves", async () => {
    const detector = model();
    mocks.createFromOptions.mockResolvedValue(detector);
    const provider = new MediaPipeHandProvider();
    const delegate = await provider.initialize(options);
    events.push("ready");
    expect(delegate).toBe("GPU");
    expect(detector.detectForVideo).toHaveBeenCalledExactlyOnceWith(
      canvases[0]?.bitmap,
      0,
    );
    expect(events).toEqual([
      "canvas-320x240",
      "inference",
      "bitmap-close",
      "ready",
    ]);
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 });
    expect(canvases[0].bitmap.close).toHaveBeenCalledOnce();
    expect(detector.close).not.toHaveBeenCalled();
    provider.close();
  });
  it("cleans up a failed GPU warmup before creating and warming CPU fallback", async () => {
    const gpu = model(),
      cpu = model();
    gpu.detectForVideo.mockImplementation(() => {
      events.push("gpu-warmup-failed");
      throw new Error("GPU cold inference failed");
    });
    mocks.createFromOptions
      .mockResolvedValueOnce(gpu)
      .mockImplementationOnce(() => {
        expect(gpu.close).toHaveBeenCalledOnce();
        expect(canvases[0].bitmap.close).toHaveBeenCalledOnce();
        return Promise.resolve(cpu);
      });
    const provider = new MediaPipeHandProvider();
    expect(await provider.initialize(options)).toBe("CPU");
    expect(mocks.createFromOptions.mock.calls[1][1].baseOptions.delegate).toBe(
      "CPU",
    );
    expect(cpu.detectForVideo).toHaveBeenCalledExactlyOnceWith(
      canvases[1].bitmap,
      0,
    );
    expect(canvases.every((c) => c.width === 0 && c.height === 0)).toBe(true);
    expect(canvases[1].bitmap.close).toHaveBeenCalledOnce();
    provider.close();
    expect(cpu.close).toHaveBeenCalledOnce();
  });
  it("closes both models and temporary bitmaps when both delegates fail warmup", async () => {
    const gpu = model(),
      cpu = model();
    gpu.detectForVideo.mockImplementation(() => {
      throw new Error("GPU warmup failed");
    });
    cpu.detectForVideo.mockImplementation(() => {
      throw new Error("CPU warmup failed");
    });
    mocks.createFromOptions
      .mockResolvedValueOnce(gpu)
      .mockResolvedValueOnce(cpu);
    const provider = new MediaPipeHandProvider();
    await expect(provider.initialize(options)).rejects.toThrow(
      "CPU warmup failed",
    );
    expect(gpu.close).toHaveBeenCalledOnce();
    expect(cpu.close).toHaveBeenCalledOnce();
    expect(canvases).toHaveLength(2);
    for (const canvas of canvases)
      expect(canvas.bitmap.close).toHaveBeenCalledOnce();
    expect(() => provider.detect(frame(0))).toThrow("not initialized");
    provider.close();
    expect(cpu.close).toHaveBeenCalledOnce();
  });
  it("uses strictly increasing inference timestamps without changing camera metadata or owning camera bitmaps", async () => {
    const detector = model();
    mocks.createFromOptions.mockResolvedValue(detector);
    const provider = new MediaPipeHandProvider();
    await provider.initialize(options);
    const frames = [frame(0, 4), frame(0, 5), frame(0.5, 6), frame(90, 7)];
    const results = frames.map((f) => provider.detect(f));
    const times = detector.detectForVideo.mock.calls.map(
      (call) => (call as unknown[])[1] as number,
    );
    expect(times).toEqual([0, 1, 2, 3, 90]);
    for (let i = 0; i < frames.length; i++) {
      expect(results[i]).toMatchObject({
        frameId: frames[i].frameId,
        capturedAt: 1234,
        mediaTime: frames[i].mediaTime,
      });
      expect(frames[i].bitmap.close).not.toHaveBeenCalled();
    }
    provider.close();
  });
  it("resets its inference clock when a model is replaced and closes each model once", async () => {
    const first = model(),
      second = model();
    mocks.createFromOptions
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const provider = new MediaPipeHandProvider();
    await provider.initialize(options);
    provider.detect(frame(900));
    await provider.initialize(options);
    expect(first.close).toHaveBeenCalledOnce();
    provider.detect(frame(0));
    expect(
      second.detectForVideo.mock.calls.map((call) => (call as unknown[])[1]),
    ).toEqual([0, 1]);
    provider.close();
    provider.close();
    expect(second.close).toHaveBeenCalledOnce();
  });
});
