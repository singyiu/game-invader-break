import type {
  Calibration,
  HandFrame,
  PaddleIntent,
  PaddleTarget,
  TrackedHand,
  TrackingStatus,
} from "../shared/contracts";
import { TUNING } from "../content/tuning";
import { HandTracks } from "./hand-tracks";
import {
  DEFAULT_CALIBRATION,
  mapSourceX,
  normalizeCalibration,
} from "./reach-calibration";

const FIRST_HAND_STABLE_MS = 300;
const SECOND_HAND_STABLE_MS = 350;
const MODE_CHANGE_STABLE_MS = 150;
const SHORT_OCCLUSION_MS = 150;
const LOST_HANDS_MS = 350;
const RETURN_COUNTDOWN_MS = 300;

export class HandController {
  private readonly tracker = new HandTracks();
  private calibration: Calibration = { ...DEFAULT_CALIBRATION };
  private visibleHands: TrackedHand[] = [];
  private targets = new Map<number, number>();
  private activeIds: number[] = [];
  private mode: 0 | 1 | 2 = 0;
  private latestCapture = Number.NEGATIVE_INFINITY;
  private latestFrameId = -1;
  private latestMediaTime = Number.NEGATIVE_INFINITY;
  private stableKey = "";
  private stableSince = 0;
  private secondCandidateId: number | null = null;
  private secondCandidateSince = 0;
  private readonly absentSince = new Map<number, number>();
  private allAbsentSince: number | null = null;
  private lostAll = false;
  private needsCenterDwell = false;
  private ambiguous = false;
  private resumeUntil = 0;

  update(frame: HandFrame): void {
    if (
      frame.version !== 1 ||
      frame.arrivedAt - frame.capturedAt > 150 ||
      frame.arrivedAt < frame.capturedAt ||
      frame.frameId <= this.latestFrameId ||
      frame.capturedAt <= this.latestCapture ||
      frame.mediaTime <= this.latestMediaTime
    )
      return;
    this.latestFrameId = frame.frameId;
    this.latestCapture = frame.capturedAt;
    this.latestMediaTime = frame.mediaTime;

    const result = this.tracker.update(frame.hands, frame.capturedAt);
    this.ambiguous = result.ambiguous;
    this.visibleHands = result.hands.map((hand) => ({
      ...hand,
      x: mapSourceX(hand.x, this.calibration),
      y: clamp(hand.y, 0, 1),
    }));
    for (const hand of this.visibleHands) this.targets.set(hand.id, hand.x);
    const visibleIds = this.visibleHands.map((hand) => hand.id);
    const visibleSet = new Set(visibleIds);

    if (this.mode === 0) {
      this.updateStableCandidate(visibleIds, frame.capturedAt);
      const required =
        visibleIds.length === 2 ? SECOND_HAND_STABLE_MS : FIRST_HAND_STABLE_MS;
      if (
        visibleIds.length > 0 &&
        frame.capturedAt - this.stableSince >= required
      ) {
        this.confirmActiveIds(visibleIds);
        this.needsCenterDwell = true;
      }
      return;
    }

    if (this.lostAll) {
      this.updateStableCandidate(visibleIds, frame.capturedAt);
      if (
        visibleIds.length > 0 &&
        frame.capturedAt - this.stableSince >= FIRST_HAND_STABLE_MS
      ) {
        this.confirmActiveIds(visibleIds);
        this.lostAll = false;
        this.needsCenterDwell = true;
      }
      return;
    }

    const visibleActive = this.activeIds.filter((id) => visibleSet.has(id));
    const allAbsentFor =
      this.allAbsentSince === null ? 0 : frame.capturedAt - this.allAbsentSince;
    if (visibleActive.length === 0) {
      this.allAbsentSince ??= frame.capturedAt;
    } else this.allAbsentSince = null;
    for (const id of this.activeIds) {
      if (visibleSet.has(id)) {
        this.absentSince.delete(id);
      } else if (!this.absentSince.has(id)) {
        this.absentSince.set(id, frame.capturedAt);
      }
    }

    if (allAbsentFor >= LOST_HANDS_MS) {
      this.lostAll = true;
      this.needsCenterDwell = false;
      this.updateStableCandidate(visibleIds, frame.capturedAt, true);
      return;
    }

    if (visibleActive.length > 0 && allAbsentFor >= SHORT_OCCLUSION_MS) {
      this.resumeUntil = frame.arrivedAt + RETURN_COUNTDOWN_MS;
    }

    if (this.mode === 2) {
      if (visibleActive.length === 1) {
        const missingId = this.activeIds.find((id) => id !== visibleActive[0])!;
        const missingFor =
          frame.capturedAt -
          (this.absentSince.get(missingId) ?? frame.capturedAt);
        if (missingFor >= MODE_CHANGE_STABLE_MS) {
          this.activeIds = [visibleActive[0]!];
          this.mode = 1;
          this.absentSince.clear();
          this.resetSecondCandidate();
        }
      }
      return;
    }

    const activeId = this.activeIds[0]!;
    if (!visibleSet.has(activeId)) {
      this.resetSecondCandidate();
      return;
    }
    const secondId = visibleIds.find((id) => id !== activeId) ?? null;
    if (secondId === null) {
      this.resetSecondCandidate();
      return;
    }
    if (secondId !== this.secondCandidateId) {
      this.secondCandidateId = secondId;
      this.secondCandidateSince = frame.capturedAt;
      return;
    }
    if (frame.capturedAt - this.secondCandidateSince >= MODE_CHANGE_STABLE_MS) {
      this.activeIds = [activeId, secondId];
      this.mode = 2;
      this.absentSince.clear();
      this.resetSecondCandidate();
    }
  }

  intent(now: number): PaddleIntent {
    const targets = this.currentTargets();
    if (now - this.latestCapture > 150)
      return this.makeIntent(targets, "stale", true, 0);
    if (this.mode === 0) return this.makeIntent([], "searching", true, 0);
    if (this.needsCenterDwell || this.lostAll)
      return this.makeIntent(targets, "paused", true, 0);
    // Keep the live hand responsive during the short split/merge debounce.
    // A missing partner stays at its last position until the merge is confirmed.
    if (
      this.ambiguous ||
      this.activeIds.every((id) => this.absentSince.has(id))
    )
      return this.makeIntent(targets, "uncertain", true, 0);
    if (now < this.resumeUntil) {
      return this.makeIntent(
        targets,
        "paused",
        true,
        Math.ceil(this.resumeUntil - now),
      );
    }
    return this.makeIntent(targets, "stable", false, 0);
  }

  get hands(): TrackedHand[] {
    return this.visibleHands.map((hand) => ({
      ...hand,
      landmarks: hand.landmarks.slice(),
    }));
  }

  setCalibration(value: Calibration): void {
    this.calibration = normalizeCalibration(value);
    this.visibleHands = this.visibleHands.map((hand) => ({
      ...hand,
      x: mapSourceX(hand.rawX, this.calibration),
    }));
    for (const hand of this.visibleHands) this.targets.set(hand.id, hand.x);
  }

  confirmResume(now: number): void {
    if (!Number.isFinite(now) || !this.needsCenterDwell) return;
    this.needsCenterDwell = false;
    this.resumeUntil = 0;
  }

  reset(): void {
    this.tracker.reset();
    this.visibleHands = [];
    this.targets.clear();
    this.activeIds = [];
    this.mode = 0;
    this.latestCapture = Number.NEGATIVE_INFINITY;
    this.latestFrameId = -1;
    this.latestMediaTime = Number.NEGATIVE_INFINITY;
    this.stableKey = "";
    this.stableSince = 0;
    this.resetSecondCandidate();
    this.absentSince.clear();
    this.allAbsentSince = null;
    this.lostAll = false;
    this.needsCenterDwell = false;
    this.ambiguous = false;
    this.resumeUntil = 0;
  }

  private confirmActiveIds(ids: number[]): void {
    this.activeIds = ids.slice(0, 2);
    this.mode = this.activeIds.length as 1 | 2;
    this.absentSince.clear();
    this.allAbsentSince = null;
    this.resetSecondCandidate();
  }

  private updateStableCandidate(
    ids: number[],
    capturedAt: number,
    force = false,
  ): void {
    const key = ids
      .slice()
      .sort((a, b) => a - b)
      .join(",");
    if (force || key !== this.stableKey) {
      this.stableKey = key;
      this.stableSince = capturedAt;
    }
  }

  private resetSecondCandidate(): void {
    this.secondCandidateId = null;
    this.secondCandidateSince = 0;
  }

  private currentTargets(): PaddleTarget[] {
    const halfWidth =
      (this.mode === 2 ? TUNING.splitPaddleWidth : TUNING.paddleWidth) / 200;
    return this.activeIds.map((id) => ({
      id,
      x: clamp(this.targets.get(id) ?? 0.5, halfWidth, 1 - halfWidth),
    }));
  }

  private makeIntent(
    targets: PaddleTarget[],
    status: TrackingStatus,
    paused: boolean,
    resumeIn: number,
  ): PaddleIntent {
    return {
      mode: this.mode,
      targets,
      status,
      paused,
      resumeIn,
      needsDwell: this.needsCenterDwell,
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
