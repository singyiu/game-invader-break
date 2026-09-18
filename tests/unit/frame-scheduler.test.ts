import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FrameScheduler,
  type CapturedFrame,
} from "../../src/camera/frame-scheduler";

interface FakeBitmap extends ImageBitmap {
  closed: boolean;
}

function bitmap(width = 640, height = 480): FakeBitmap {
  return {
    width,
    height,
    closed: false,
    close() {
      this.closed = true;
    },
  } as FakeBitmap;
}

function fakeVideo() {
  let nextId = 0;
  const callbacks = new Map<number, VideoFrameRequestCallback>();
  return {
    currentTime: 0,
    videoWidth: 640,
    videoHeight: 480,
    requestVideoFrameCallback(callback: VideoFrameRequestCallback) {
      const id = ++nextId;
      callbacks.set(id, callback);
      return id;
    },
    cancelVideoFrameCallback(id: number) {
      callbacks.delete(id);
    },
    fire(now: number, mediaTime: number) {
      const entry = callbacks.entries().next().value as
        | [number, VideoFrameRequestCallback]
        | undefined;
      if (!entry) throw new Error("No scheduled callback");
      callbacks.delete(entry[0]);
      entry[1](now, { mediaTime } as VideoFrameCallbackMetadata);
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("FrameScheduler", () => {
  it("keeps one inference in flight and replaces pending work with the newest frame", async () => {
    const video = fakeVideo();
    const bitmaps = [bitmap(), bitmap(), bitmap()];
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => bitmaps.shift()!),
    );
    const received: CapturedFrame[] = [];
    let drops = 0;
    const scheduler = new FrameScheduler(video as unknown as HTMLVideoElement, {
      onFrame: (frame) => received.push(frame),
      onError: (message) => {
        throw new Error(message);
      },
      onDrop: () => {
        drops += 1;
      },
    });

    scheduler.start();
    video.fire(10, 0.01);
    await vi.waitFor(() => expect(received).toHaveLength(1));
    video.fire(20, 0.02);
    await Promise.resolve();
    video.fire(30, 0.03);
    await Promise.resolve();
    await vi.waitFor(() => expect(drops).toBe(1));

    const replaced = received[0]!.frameId + 1;
    scheduler.completeInference();
    expect(received).toHaveLength(2);
    expect(received[1]!.mediaTime).toBe(30);
    expect(received[1]!.frameId).toBeGreaterThan(replaced);
    scheduler.stop();
  });

  it("closes a pending bitmap when stopped", async () => {
    const video = fakeVideo();
    const first = bitmap();
    const pending = bitmap();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(pending),
    );
    const scheduler = new FrameScheduler(video as unknown as HTMLVideoElement, {
      onFrame: () => undefined,
      onError: (message) => {
        throw new Error(message);
      },
    });
    scheduler.start();
    video.fire(10, 0.01);
    await Promise.resolve();
    video.fire(20, 0.02);
    await Promise.resolve();
    scheduler.stop();
    expect(pending.closed).toBe(true);
  });
});
