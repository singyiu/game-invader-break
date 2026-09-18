import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CameraSession } from "../../src/camera/camera-session";
import { HAND_PROTOCOL_VERSION } from "../../src/perception/protocol";

class FakeTrack {
  onended: (() => void) | null = null;
  stop = vi.fn();
}

class FakeStream {
  readonly track = new FakeTrack();
  getTracks() {
    return [this.track] as unknown as MediaStreamTrack[];
  }
}

class FakeWorker {
  static instances: FakeWorker[] = [];
  static ready = true;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn((message: { type: string }) => {
    if (message.type === "init" && FakeWorker.ready)
      queueMicrotask(() =>
        this.emit({
          type: "ready",
          version: HAND_PROTOCOL_VERSION,
          delegate: "GPU",
        }),
      );
  });
  constructor() {
    FakeWorker.instances.push(this);
  }
  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent<unknown>);
  }
  fail(message: string) {
    this.onerror?.({ message } as ErrorEvent);
  }
}

function video() {
  let callback: VideoFrameRequestCallback | null = null;
  return {
    muted: false,
    playsInline: false,
    srcObject: null as MediaStream | null,
    currentTime: 0,
    videoWidth: 640,
    videoHeight: 480,
    play: vi.fn(async () => undefined),
    pause: vi.fn(),
    requestVideoFrameCallback: vi.fn((next: VideoFrameRequestCallback) => {
      callback = next;
      return 1;
    }),
    cancelVideoFrameCallback: vi.fn(() => {
      callback = null;
    }),
    fire(now: number, mediaTime: number) {
      const current = callback;
      callback = null;
      current?.(now, { mediaTime } as VideoFrameCallbackMetadata);
    },
  } as unknown as HTMLVideoElement & {
    fire(now: number, mediaTime: number): void;
  };
}

let getUserMedia: ReturnType<typeof vi.fn>;

beforeEach(() => {
  FakeWorker.instances = [];
  FakeWorker.ready = true;
  getUserMedia = vi.fn();
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CameraSession", () => {
  it("does not request camera permission until start and requests video only", async () => {
    const stream = new FakeStream();
    getUserMedia.mockResolvedValue(stream);
    const session = new CameraSession(video(), { onFrame() {}, onError() {} });
    expect(getUserMedia).not.toHaveBeenCalled();
    await session.start();
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ audio: false, video: expect.any(Object) }),
    );
    expect(session.running).toBe(true);
    session.stop();
  });

  it.each([
    ["NotAllowedError", "permission was denied"],
    ["SecurityError", "secure browser context"],
    ["NotFoundError", "No camera was found"],
    ["NotReadableError", "already in use"],
    ["OverconstrainedError", "requirements"],
  ])("reports a specific %s camera error", async (name, expected) => {
    getUserMedia.mockRejectedValue(new DOMException("failed", name));
    const errors: string[] = [];
    const session = new CameraSession(video(), {
      onFrame() {},
      onError: (message) => errors.push(message),
    });
    await session.start();
    expect(errors.at(-1)).toContain(expected);
    expect(session.running).toBe(false);
  });

  it("reports unavailable camera APIs without attempting worker startup", async () => {
    vi.stubGlobal("navigator", {});
    const errors: string[] = [];
    const session = new CameraSession(video(), {
      onFrame() {},
      onError: (message) => errors.push(message),
    });
    await session.start();
    expect(errors.at(-1)).toContain("unavailable in this browser");
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("stops a stream that arrives after start was cancelled", async () => {
    let resolveStream!: (stream: FakeStream) => void;
    getUserMedia.mockReturnValue(
      new Promise((resolve) => {
        resolveStream = resolve;
      }),
    );
    const session = new CameraSession(video(), { onFrame() {}, onError() {} });
    const starting = session.start();
    session.stop();
    const stream = new FakeStream();
    resolveStream(stream);
    await starting;
    expect(stream.track.stop).toHaveBeenCalledOnce();
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("tears down and reports when the active camera ends", async () => {
    const stream = new FakeStream();
    getUserMedia.mockResolvedValue(stream);
    const errors: string[] = [];
    const session = new CameraSession(video(), {
      onFrame() {},
      onError: (message) => errors.push(message),
    });
    await session.start();
    stream.track.onended?.();
    expect(errors.at(-1)).toContain("Camera stream ended");
    expect(stream.track.stop).toHaveBeenCalledOnce();
    expect(session.running).toBe(false);
  });

  it("tears down on a fatal worker error", async () => {
    const stream = new FakeStream();
    getUserMedia.mockResolvedValue(stream);
    const errors: string[] = [];
    const session = new CameraSession(video(), {
      onFrame() {},
      onError: (message) => errors.push(message),
    });
    await session.start();
    FakeWorker.instances[0]!.fail("worker crashed");
    expect(errors.at(-1)).toBe("worker crashed");
    expect(stream.track.stop).toHaveBeenCalledOnce();
    expect(session.running).toBe(false);
  });

  it("replaces an active session without leaking its stream or worker", async () => {
    const first = new FakeStream();
    const second = new FakeStream();
    getUserMedia.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const session = new CameraSession(video(), { onFrame() {}, onError() {} });
    await session.start();
    const firstWorker = FakeWorker.instances[0]!;
    await session.start();
    expect(first.track.stop).toHaveBeenCalledOnce();
    expect(firstWorker.terminate).toHaveBeenCalledOnce();
    expect(session.running).toBe(true);
    session.stop();
  });

  it("rejects stale and out-of-order worker results while accepting a fresh result", async () => {
    const stream = new FakeStream();
    getUserMedia.mockResolvedValue(stream);
    const frames: number[] = [];
    const session = new CameraSession(video(), {
      onFrame: (frame) => frames.push(frame.frameId),
      onError() {},
    });
    await session.start();
    const worker = FakeWorker.instances[0]!;
    const now = performance.now();
    worker.emit(handsResponse(2, now - 200, 20));
    worker.emit(handsResponse(3, now - 10, 30));
    worker.emit(handsResponse(1, now - 5, 10));
    expect(frames).toEqual([3]);
    expect(session.metrics.accepted).toBe(1);
    expect(session.metrics.dropped).toBe(2);
    session.stop();
  });

  it("times out a stalled worker and supports a clean later restart", async () => {
    vi.useFakeTimers();
    const stream1 = new FakeStream();
    const stream2 = new FakeStream();
    getUserMedia.mockResolvedValueOnce(stream1).mockResolvedValueOnce(stream2);
    const errors: string[] = [];
    const camera = video();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 640, height: 480, close() {} })),
    );
    const session = new CameraSession(camera, {
      onFrame() {},
      onError: (message) => errors.push(message),
    });
    await session.start();
    camera.fire(10, 0.01);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_001);
    expect(errors.at(-1)).toContain("stopped responding");
    expect(session.running).toBe(false);
    await session.start();
    expect(session.running).toBe(true);
    session.stop();
  });

  it("times out worker startup and releases the camera", async () => {
    vi.useFakeTimers();
    FakeWorker.ready = false;
    const stream = new FakeStream();
    getUserMedia.mockResolvedValue(stream);
    const errors: string[] = [];
    const session = new CameraSession(video(), {
      onFrame() {},
      onError: (message) => errors.push(message),
    });
    const starting = session.start();
    await vi.advanceTimersByTimeAsync(30_001);
    await starting;
    expect(errors.at(-1)).toContain("initialization timed out");
    expect(stream.track.stop).toHaveBeenCalledOnce();
    expect(session.running).toBe(false);
  });
});

function handsResponse(frameId: number, capturedAt: number, mediaTime: number) {
  return {
    type: "hands",
    version: HAND_PROTOCOL_VERSION,
    frame: {
      version: 1,
      frameId,
      capturedAt,
      mediaTime,
      inferenceMs: 4,
      hands: [],
    },
  };
}
