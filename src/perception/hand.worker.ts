import type { CapturedFrame } from "../camera/frame-scheduler";
import { MediaPipeHandProvider } from "./hand-provider";
import {
  HAND_PROTOCOL_VERSION,
  isWorkerRequest,
  type WorkerErrorResponse,
  type WorkerResponse,
} from "./protocol";

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: WorkerResponse): void;
  addEventListener(type: "close", listener: () => void): void;
};
const provider = new MediaPipeHandProvider();

function report(message: string, recoverable: boolean): void {
  const response: WorkerErrorResponse = {
    type: "error",
    version: HAND_PROTOCOL_VERSION,
    message,
    recoverable,
  };
  scope.postMessage(response);
}

scope.onmessage = (event) => {
  const request = event.data;
  if (!isWorkerRequest(request)) {
    report("Invalid hand worker message.", false);
    return;
  }
  if (request.type === "init") {
    void provider
      .initialize({ modelUrl: request.modelUrl, wasmUrl: request.wasmUrl })
      .then((delegate) =>
        scope.postMessage({
          type: "ready",
          version: HAND_PROTOCOL_VERSION,
          delegate,
        }),
      )
      .catch((error: unknown) =>
        report(
          error instanceof Error ? error.message : "Hand model failed to load.",
          false,
        ),
      );
    return;
  }
  try {
    const frame: CapturedFrame = {
      frameId: request.frameId,
      capturedAt: request.capturedAt,
      mediaTime: request.mediaTime,
      width: request.width,
      height: request.height,
      bitmap: request.bitmap,
    };
    scope.postMessage({
      type: "hands",
      version: HAND_PROTOCOL_VERSION,
      frame: provider.detect(frame),
    });
  } catch (error) {
    report(
      error instanceof Error ? error.message : "Hand inference failed.",
      true,
    );
  } finally {
    request.bitmap.close();
  }
};

scope.addEventListener("close", () => provider.close());
