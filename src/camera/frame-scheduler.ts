export interface CapturedFrame {
  frameId: number;
  capturedAt: number;
  mediaTime: number;
  width: number;
  height: number;
  bitmap: ImageBitmap;
}

export interface FrameSchedulerCallbacks {
  onFrame(frame: CapturedFrame): void;
  onError(message: string): void;
  onDrop?(): void;
}

/** Captures at most one frame at a time and retains only the newest pending inference. */
export class FrameScheduler {
  private running = false;
  private frameId = 0;
  private inFlight = false;
  private capturing = false;
  private pendingCapture: { capturedAt: number; mediaTime: number } | null =
    null;
  private pendingFrame: CapturedFrame | null = null;
  private callbackId: number | null = null;
  private lastFallbackTime = -1;
  private lastMediaTime = -1;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly callbacks: FrameSchedulerCallbacks,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.callbackId !== null) {
      if (typeof this.video.cancelVideoFrameCallback === "function") {
        this.video.cancelVideoFrameCallback(this.callbackId);
      } else {
        cancelAnimationFrame(this.callbackId);
      }
    }
    this.callbackId = null;
    this.pendingCapture = null;
    this.pendingFrame?.bitmap.close();
    this.pendingFrame = null;
    this.inFlight = false;
  }

  completeInference(): void {
    this.inFlight = false;
    if (!this.running || !this.pendingFrame) return;
    const newest = this.pendingFrame;
    this.pendingFrame = null;
    this.submit(newest);
  }

  private schedule(): void {
    if (!this.running) return;
    if (typeof this.video.requestVideoFrameCallback === "function") {
      this.callbackId = this.video.requestVideoFrameCallback(
        (now, metadata) => {
          this.schedule();
          // Safari camera streams can report mediaTime=0 for every new frame.
          // Use the video clock when metadata stalls, without admitting duplicates.
          const mediaTime =
            metadata.mediaTime > this.lastMediaTime
              ? metadata.mediaTime
              : this.video.currentTime;
          if (!Number.isFinite(mediaTime) || mediaTime <= this.lastMediaTime)
            return;
          this.lastMediaTime = mediaTime;
          void this.capture(now, mediaTime * 1_000);
        },
      );
      return;
    }
    this.callbackId = requestAnimationFrame((now) => {
      this.schedule();
      if (this.video.currentTime === this.lastFallbackTime) return;
      this.lastFallbackTime = this.video.currentTime;
      void this.capture(now, this.video.currentTime * 1_000);
    });
  }

  private async capture(capturedAt: number, mediaTime: number): Promise<void> {
    if (!this.running) return;
    if (this.capturing) {
      this.pendingCapture = { capturedAt, mediaTime };
      this.callbacks.onDrop?.();
      return;
    }
    this.capturing = true;
    try {
      const captured = await createImageBitmap(this.video);
      if (!this.running) {
        captured.close();
        return;
      }
      const frame: CapturedFrame = {
        frameId: ++this.frameId,
        capturedAt,
        mediaTime,
        width: captured.width || this.video.videoWidth,
        height: captured.height || this.video.videoHeight,
        bitmap: captured,
      };
      if (this.inFlight) {
        if (this.pendingFrame) {
          this.pendingFrame.bitmap.close();
          this.callbacks.onDrop?.();
        }
        this.pendingFrame = frame;
      } else {
        this.submit(frame);
      }
    } catch (error) {
      this.callbacks.onError(
        error instanceof Error
          ? error.message
          : "Unable to capture a camera frame.",
      );
    } finally {
      this.capturing = false;
      const pending = this.pendingCapture;
      this.pendingCapture = null;
      if (pending && this.running)
        void this.capture(pending.capturedAt, pending.mediaTime);
    }
  }

  private submit(frame: CapturedFrame): void {
    this.inFlight = true;
    this.callbacks.onFrame(frame);
  }
}
