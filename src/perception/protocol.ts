import type { HandObservation, Landmark } from "../shared/contracts";

export const HAND_PROTOCOL_VERSION = 1 as const;
export const MAX_HAND_AGE_MS = 150;

export interface WorkerInitRequest {
  type: "init";
  version: typeof HAND_PROTOCOL_VERSION;
  modelUrl: string;
  wasmUrl: string;
}

export interface WorkerFrameRequest {
  type: "frame";
  version: typeof HAND_PROTOCOL_VERSION;
  frameId: number;
  capturedAt: number;
  mediaTime: number;
  width: number;
  height: number;
  bitmap: ImageBitmap;
}

export type WorkerRequest = WorkerInitRequest | WorkerFrameRequest;

export interface WorkerReadyResponse {
  type: "ready";
  version: typeof HAND_PROTOCOL_VERSION;
  delegate: "GPU" | "CPU";
}

export interface WorkerHandFrame {
  version: 1;
  frameId: number;
  capturedAt: number;
  mediaTime: number;
  inferenceMs: number;
  hands: HandObservation[];
}

export interface WorkerHandsResponse {
  type: "hands";
  version: typeof HAND_PROTOCOL_VERSION;
  frame: WorkerHandFrame;
}

export interface WorkerErrorResponse {
  type: "error";
  version: typeof HAND_PROTOCOL_VERSION;
  message: string;
  recoverable: boolean;
}

export type WorkerResponse =
  | WorkerReadyResponse
  | WorkerHandsResponse
  | WorkerErrorResponse;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function landmark(value: unknown): value is Landmark {
  return object(value) && finite(value.x) && finite(value.y) && finite(value.z);
}

function observation(value: unknown): value is HandObservation {
  if (
    !object(value) ||
    !Array.isArray(value.landmarks) ||
    value.landmarks.length !== 21 ||
    !value.landmarks.every(landmark)
  )
    return false;
  if (value.handedness !== undefined && typeof value.handedness !== "string")
    return false;
  return (
    value.handednessScore === undefined ||
    (finite(value.handednessScore) &&
      value.handednessScore >= 0 &&
      value.handednessScore <= 1)
  );
}

function handFrame(value: unknown): value is WorkerHandFrame {
  return (
    object(value) &&
    value.version === 1 &&
    Number.isInteger(value.frameId) &&
    Number(value.frameId) >= 0 &&
    finite(value.capturedAt) &&
    finite(value.mediaTime) &&
    value.mediaTime >= 0 &&
    finite(value.inferenceMs) &&
    value.inferenceMs >= 0 &&
    Array.isArray(value.hands) &&
    value.hands.length <= 2 &&
    value.hands.every(observation)
  );
}

export function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (
    !object(value) ||
    value.version !== HAND_PROTOCOL_VERSION ||
    typeof value.type !== "string"
  )
    return false;
  if (value.type === "ready")
    return value.delegate === "GPU" || value.delegate === "CPU";
  if (value.type === "hands") return handFrame(value.frame);
  if (value.type === "error")
    return (
      typeof value.message === "string" &&
      typeof value.recoverable === "boolean"
    );
  return false;
}

export function isWorkerRequest(value: unknown): value is WorkerRequest {
  if (
    !object(value) ||
    value.version !== HAND_PROTOCOL_VERSION ||
    typeof value.type !== "string"
  )
    return false;
  if (value.type === "init")
    return (
      typeof value.modelUrl === "string" &&
      value.modelUrl.length > 0 &&
      typeof value.wasmUrl === "string" &&
      value.wasmUrl.length > 0
    );
  return (
    value.type === "frame" &&
    Number.isInteger(value.frameId) &&
    Number(value.frameId) >= 0 &&
    finite(value.capturedAt) &&
    finite(value.mediaTime) &&
    value.mediaTime >= 0 &&
    finite(value.width) &&
    value.width > 0 &&
    finite(value.height) &&
    value.height > 0 &&
    object(value.bitmap) &&
    typeof value.bitmap.close === "function"
  );
}
