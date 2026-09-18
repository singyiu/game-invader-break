import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createFromOptions, forVisionTasks, registerWasmFactory } = vi.hoisted(
  () => ({
    createFromOptions: vi.fn(),
    forVisionTasks: vi.fn(),
    registerWasmFactory: vi.fn(),
  }),
);

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks },
  HandLandmarker: { createFromOptions },
}));
vi.mock("../../src/perception/worker-loader", () => ({ registerWasmFactory }));

import { MediaPipeHandProvider } from "../../src/perception/hand-provider";

function result() {
  return {
    landmarks: [
      Array.from({ length: 21 }, (_, index) => ({
        x: index / 100,
        y: 0.4,
        z: -0.01,
        visibility: 1,
      })),
    ],
    handedness: [
      [{ categoryName: "Left", score: 0.91, index: 0, displayName: "" }],
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      constructor(
        public width: number,
        public height: number,
      ) {}
      getContext() {
        return { fillStyle: "", fillRect() {} };
      }
      transferToImageBitmap() {
        return { close() {} };
      }
    },
  );
  forVisionTasks.mockResolvedValue({
    wasmLoaderPath: "/runtime/wasm/vision_wasm_internal.js",
    wasmBinaryPath: "/x.wasm",
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("MediaPipeHandProvider", () => {
  it("configures VIDEO mode for two hands and preserves every hand joint", async () => {
    const close = vi.fn();
    createFromOptions.mockResolvedValue({
      detectForVideo: () => result(),
      close,
    });
    const provider = new MediaPipeHandProvider();
    expect(
      await provider.initialize({
        modelUrl: "/models/hand_landmarker.task",
        wasmUrl: "/runtime/wasm",
      }),
    ).toBe("GPU");
    const frame = provider.detect({
      frameId: 4,
      capturedAt: 100,
      mediaTime: 90,
      width: 640,
      height: 480,
      bitmap: { close() {} } as ImageBitmap,
    });
    expect(frame.hands).toHaveLength(1);
    expect(frame.hands[0]!.landmarks).toHaveLength(21);
    expect(frame.hands[0]).toMatchObject({
      handedness: "Left",
      handednessScore: 0.91,
    });
    expect(createFromOptions.mock.calls[0]![1]).toMatchObject({
      runningMode: "VIDEO",
      numHands: 2,
      baseOptions: { delegate: "GPU" },
    });
    provider.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it("falls back explicitly to CPU when GPU initialization fails", async () => {
    createFromOptions
      .mockRejectedValueOnce(new Error("WebGL unavailable"))
      .mockResolvedValueOnce({ detectForVideo: () => result(), close() {} });
    const provider = new MediaPipeHandProvider();
    expect(
      await provider.initialize({
        modelUrl: "/models/hand_landmarker.task",
        wasmUrl: "/runtime/wasm",
      }),
    ).toBe("CPU");
    expect(createFromOptions.mock.calls[1]![1].baseOptions.delegate).toBe(
      "CPU",
    );
  });
});
