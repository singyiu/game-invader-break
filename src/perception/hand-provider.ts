import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { CapturedFrame } from "../camera/frame-scheduler";
import type { WorkerHandFrame } from "./protocol";
import { registerWasmFactory } from "./worker-loader";

export interface HandProviderOptions {
  modelUrl: string;
  wasmUrl: string;
}

export class MediaPipeHandProvider {
  private landmarker: HandLandmarker | null = null;
  private lastInferenceTimestamp = Number.NEGATIVE_INFINITY;

  async initialize(options: HandProviderOptions): Promise<"GPU" | "CPU"> {
    this.close();
    const files = await FilesetResolver.forVisionTasks(options.wasmUrl);
    const workerFiles = { ...files, wasmLoaderPath: "" };
    const common = {
      runningMode: "VIDEO" as const,
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };
    const createAndWarm = async (delegate: "GPU" | "CPU") => {
      try {
        await registerWasmFactory(files.wasmLoaderPath);
        this.landmarker = await HandLandmarker.createFromOptions(workerFiles, {
          ...common,
          baseOptions: { modelAssetPath: options.modelUrl, delegate },
        });
        this.warmup();
        return delegate;
      } catch (error) {
        this.close();
        throw error;
      }
    };
    try {
      return await createAndWarm("GPU");
    } catch {
      return createAndWarm("CPU");
    }
  }

  private warmup(): void {
    // Shader compilation/first inference belongs to model initialization, before
    // the worker announces readiness and the per-frame stall watchdog begins.
    const canvas = new OffscreenCanvas(320, 240);
    let bitmap: ImageBitmap | null = null;
    try {
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to prepare hand model warmup.");
      context.fillStyle = "#000";
      context.fillRect(0, 0, canvas.width, canvas.height);
      bitmap = canvas.transferToImageBitmap();
      this.landmarker!.detectForVideo(bitmap, this.inferenceTimestamp(0));
    } finally {
      bitmap?.close();
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  private inferenceTimestamp(mediaTime: number): number {
    // Camera metadata keeps its original clock. Only MediaPipe's VIDEO input
    // clock advances past warmup or duplicate/earlier media timestamps.
    this.lastInferenceTimestamp = Math.max(
      mediaTime,
      this.lastInferenceTimestamp + 1,
    );
    return this.lastInferenceTimestamp;
  }

  detect(frame: CapturedFrame): WorkerHandFrame {
    if (!this.landmarker) throw new Error("Hand model is not initialized.");
    const startedAt = performance.now();
    const result = this.landmarker.detectForVideo(
      frame.bitmap,
      this.inferenceTimestamp(frame.mediaTime),
    );
    const inferenceMs = performance.now() - startedAt;
    const hands = result.landmarks.slice(0, 2).map((landmarks, index) => {
      const category = result.handedness[index]?.[0];
      return {
        landmarks: landmarks.map((point) => ({
          x: point.x,
          y: point.y,
          z: point.z,
        })),
        ...(category?.categoryName
          ? { handedness: category.categoryName }
          : {}),
        ...(Number.isFinite(category?.score)
          ? { handednessScore: category!.score }
          : {}),
      };
    });
    return {
      version: 1,
      frameId: frame.frameId,
      capturedAt: frame.capturedAt,
      mediaTime: frame.mediaTime,
      inferenceMs,
      hands,
    };
  }

  close(): void {
    const landmarker = this.landmarker;
    this.landmarker = null;
    this.lastInferenceTimestamp = Number.NEGATIVE_INFINITY;
    landmarker?.close();
  }
}
