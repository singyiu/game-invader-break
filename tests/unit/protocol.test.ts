import { describe, expect, it } from "vitest";
import {
  HAND_PROTOCOL_VERSION,
  isWorkerRequest,
  isWorkerResponse,
} from "../../src/perception/protocol";

function landmarks(count = 21) {
  return Array.from({ length: count }, (_, index) => ({
    x: 0.2 + index / 100,
    y: 0.4,
    z: 0,
  }));
}

describe("hand worker protocol", () => {
  it("accepts a complete two-hand result with all 21 landmarks", () => {
    expect(
      isWorkerResponse({
        type: "hands",
        version: HAND_PROTOCOL_VERSION,
        frame: {
          version: 1,
          frameId: 8,
          capturedAt: 100,
          mediaTime: 90,
          inferenceMs: 12,
          hands: [
            {
              landmarks: landmarks(),
              handedness: "Left",
              handednessScore: 0.9,
            },
            {
              landmarks: landmarks(),
              handedness: "Right",
              handednessScore: 0.8,
            },
          ],
        },
      }),
    ).toBe(true);
  });

  it("rejects malformed geometry, wrong joint counts, and extra hands", () => {
    const frame = {
      version: 1,
      frameId: 8,
      capturedAt: 100,
      mediaTime: 90,
      inferenceMs: 12,
      hands: [{ landmarks: landmarks() }],
    };
    expect(
      isWorkerResponse({
        type: "hands",
        version: HAND_PROTOCOL_VERSION,
        frame: {
          ...frame,
          hands: [{ landmarks: landmarks(20) }],
        },
      }),
    ).toBe(false);
    expect(
      isWorkerResponse({
        type: "hands",
        version: HAND_PROTOCOL_VERSION,
        frame: {
          ...frame,
          hands: [
            {
              landmarks: landmarks().map((p, i) =>
                i === 4 ? { ...p, x: Number.NaN } : p,
              ),
            },
          ],
        },
      }),
    ).toBe(false);
    expect(
      isWorkerResponse({
        type: "hands",
        version: HAND_PROTOCOL_VERSION,
        frame: {
          ...frame,
          hands: [0, 1, 2].map(() => ({ landmarks: landmarks() })),
        },
      }),
    ).toBe(false);
  });

  it("accepts only same-version init and transferable frame requests", () => {
    expect(
      isWorkerRequest({
        type: "init",
        version: HAND_PROTOCOL_VERSION,
        modelUrl: "/models/hand_landmarker.task",
        wasmUrl: "/runtime/wasm",
      }),
    ).toBe(true);
    expect(
      isWorkerRequest({
        type: "frame",
        version: HAND_PROTOCOL_VERSION,
        frameId: 1,
        capturedAt: 10,
        mediaTime: 4,
        width: 640,
        height: 480,
        bitmap: { close() {} },
      }),
    ).toBe(true);
    expect(
      isWorkerRequest({
        type: "init",
        version: 99,
        modelUrl: "/x",
        wasmUrl: "/y",
      }),
    ).toBe(false);
  });
});
