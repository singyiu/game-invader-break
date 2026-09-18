import type { HandFrame } from "../shared/contracts";
import {
  HAND_PROTOCOL_VERSION,
  isWorkerResponse,
  MAX_HAND_AGE_MS,
  type WorkerInitRequest,
} from "../perception/protocol";
import { FrameScheduler, type CapturedFrame } from "./frame-scheduler";

export interface CameraSessionCallbacks {
  onFrame(frame: HandFrame): void;
  onError(message: string): void;
  onStatus?(message: string): void;
}

export interface CameraSessionMetrics {
  accepted: number;
  dropped: number;
  inferenceMs: number;
  ageMs: number;
  delegate: string;
}

const STARTUP_TIMEOUT_MS = 30_000;
const WORKER_STALL_MS = 1_000;

export class CameraSession {
  private generation = 0;
  private stream: MediaStream | null = null;
  private worker: Worker | null = null;
  private scheduler: FrameScheduler | null = null;
  private cancelWorkerInitialization: (() => void) | null = null;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private lastFrameId = -1;
  private lastMediaTime = Number.NEGATIVE_INFINITY;
  private readonly metricValues: CameraSessionMetrics = {
    accepted: 0,
    dropped: 0,
    inferenceMs: 0,
    ageMs: 0,
    delegate: "pending",
  };

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly callbacks: CameraSessionCallbacks,
  ) {}

  get running(): boolean {
    return this.active;
  }

  get metrics(): CameraSessionMetrics {
    return { ...this.metricValues };
  }

  async start(): Promise<void> {
    this.stop();
    this.resetMetrics();
    const generation = ++this.generation;
    this.callbacks.onStatus?.("Requesting camera permission…");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is unavailable in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
      });
      if (generation !== this.generation) {
        this.stopStream(stream);
        return;
      }
      this.stream = stream;
      for (const track of stream.getTracks()) {
        track.onended = () => {
          if (generation !== this.generation) return;
          this.callbacks.onError(
            "Camera stream ended. Reconnect the camera to continue.",
          );
          this.generation += 1;
          this.teardown();
        };
      }
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.srcObject = stream;
      this.callbacks.onStatus?.("Loading hand model…");
      await Promise.all([this.video.play(), this.startWorker(generation)]);
      if (generation !== this.generation) return;
      this.scheduler = new FrameScheduler(this.video, {
        onFrame: (frame) => this.submit(frame, generation),
        onError: (message) => this.fail(message, generation),
        onDrop: () => {
          this.metricValues.dropped += 1;
        },
      });
      this.scheduler.start();
      this.active = true;
      this.callbacks.onStatus?.("Camera ready");
    } catch (error) {
      if (generation !== this.generation) return;
      this.callbacks.onError(cameraErrorMessage(error));
      this.teardown();
    }
  }

  stop(): void {
    this.generation += 1;
    this.teardown();
  }

  private async startWorker(generation: number): Promise<void> {
    const worker = new Worker(
      new URL("../perception/hand.worker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker = worker;
    const origin =
      typeof location === "undefined" ? "http://localhost" : location.origin;
    const init: WorkerInitRequest = {
      type: "init",
      version: HAND_PROTOCOL_VERSION,
      modelUrl: new URL("/models/hand_landmarker.task", origin).href,
      wasmUrl: new URL("/runtime/wasm", origin).href,
    };
    await new Promise<void>((resolve, reject) => {
      let initialized = false;
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.cancelWorkerInitialization = null;
        if (error) reject(error);
        else resolve();
      };
      const timeout = setTimeout(
        () => finish(new Error("Hand model initialization timed out.")),
        STARTUP_TIMEOUT_MS,
      );
      this.cancelWorkerInitialization = () =>
        finish(new Error("Hand model initialization cancelled."));
      worker.onerror = (event) => {
        if (generation !== this.generation) return;
        const message = event.message || "Hand worker failed.";
        if (!initialized) finish(new Error(message));
        else this.fail(message, generation);
      };
      worker.onmessage = (event: MessageEvent<unknown>) => {
        if (generation !== this.generation || worker !== this.worker) return;
        if (!isWorkerResponse(event.data)) {
          if (!initialized)
            finish(new Error("Hand worker returned an invalid message."));
          else
            this.fail("Hand worker returned an invalid message.", generation);
          return;
        }
        const response = event.data;
        if (response.type === "ready") {
          initialized = true;
          this.metricValues.delegate = response.delegate;
          finish();
          return;
        }
        this.clearStallTimer();
        this.scheduler?.completeInference();
        if (response.type === "error") {
          if (response.recoverable) this.callbacks.onError(response.message);
          else this.fail(response.message, generation);
          return;
        }
        const arrivedAt = performance.now();
        const ageMs = arrivedAt - response.frame.capturedAt;
        if (
          ageMs > MAX_HAND_AGE_MS ||
          response.frame.frameId <= this.lastFrameId ||
          response.frame.mediaTime <= this.lastMediaTime
        ) {
          this.metricValues.dropped += 1;
          return;
        }
        this.lastFrameId = response.frame.frameId;
        this.lastMediaTime = response.frame.mediaTime;
        this.metricValues.accepted += 1;
        const count = this.metricValues.accepted;
        this.metricValues.inferenceMs +=
          (response.frame.inferenceMs - this.metricValues.inferenceMs) / count;
        this.metricValues.ageMs += (ageMs - this.metricValues.ageMs) / count;
        this.callbacks.onFrame({ ...response.frame, arrivedAt });
      };
      worker.postMessage(init);
    });
  }

  private submit(frame: CapturedFrame, generation: number): void {
    if (generation !== this.generation || !this.worker) {
      frame.bitmap.close();
      return;
    }
    this.clearStallTimer();
    this.stallTimer = setTimeout(
      () => this.fail("Hand worker stopped responding.", generation),
      WORKER_STALL_MS,
    );
    this.worker.postMessage(
      {
        type: "frame",
        version: HAND_PROTOCOL_VERSION,
        frameId: frame.frameId,
        capturedAt: frame.capturedAt,
        mediaTime: frame.mediaTime,
        width: frame.width,
        height: frame.height,
        bitmap: frame.bitmap,
      },
      [frame.bitmap],
    );
  }

  private fail(message: string, generation: number): void {
    if (generation !== this.generation) return;
    this.callbacks.onError(message);
    this.generation += 1;
    this.teardown();
  }

  private teardown(): void {
    this.active = false;
    this.cancelWorkerInitialization?.();
    this.cancelWorkerInitialization = null;
    this.clearStallTimer();
    this.scheduler?.stop();
    this.scheduler = null;
    this.worker?.terminate();
    this.worker = null;
    if (this.stream) this.stopStream(this.stream);
    this.stream = null;
    if (this.video.srcObject) this.video.srcObject = null;
    this.video.pause();
  }

  private clearStallTimer(): void {
    if (this.stallTimer !== null) clearTimeout(this.stallTimer);
    this.stallTimer = null;
  }

  private stopStream(stream: MediaStream): void {
    for (const track of stream.getTracks()) {
      track.onended = null;
      track.stop();
    }
  }

  private resetMetrics(): void {
    Object.assign(this.metricValues, {
      accepted: 0,
      dropped: 0,
      inferenceMs: 0,
      ageMs: 0,
      delegate: "pending",
    });
    this.lastFrameId = -1;
    this.lastMediaTime = Number.NEGATIVE_INFINITY;
  }
}

function cameraErrorMessage(error: unknown): string {
  if (!(error instanceof DOMException))
    return error instanceof Error
      ? error.message
      : "Unable to start the camera.";
  if (error.name === "NotAllowedError") return "Camera permission was denied.";
  if (error.name === "SecurityError")
    return "Camera access requires a secure browser context.";
  if (error.name === "NotFoundError") return "No camera was found.";
  if (error.name === "NotReadableError" || error.name === "AbortError")
    return "The camera is already in use or unavailable.";
  if (error.name === "OverconstrainedError")
    return "The camera cannot meet the video requirements.";
  return "Unable to start the camera.";
}
