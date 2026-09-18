import type {
  HandObservation,
  Landmark,
  TrackedHand,
} from "../shared/contracts";
import { OneEuroFilter } from "./palm-filter";

const PALM_INDICES = [0, 5, 9, 13, 17] as const;

export interface PalmPoint {
  x: number;
  y: number;
}

export interface TrackingResult {
  hands: TrackedHand[];
  ambiguous: boolean;
}

interface Detection {
  observation: HandObservation;
  anchor: PalmPoint;
}

interface Track {
  id: number;
  rawX: number;
  rawY: number;
  filteredX: number;
  filteredY: number;
  vx: number;
  vy: number;
  lastAt: number;
  landmarks: Landmark[];
  xFilter: OneEuroFilter;
  yFilter: OneEuroFilter;
}

export function palmAnchor(observation: HandObservation): PalmPoint | null {
  if (
    observation.landmarks.length !== 21 ||
    observation.landmarks.some(
      (point) =>
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        !Number.isFinite(point.z) ||
        point.x < 0 ||
        point.x > 1 ||
        point.y < 0 ||
        point.y > 1 ||
        Math.abs(point.z) > 2,
    )
  )
    return null;
  const xs = observation.landmarks.map((point) => point.x);
  const ys = observation.landmarks.map((point) => point.y);
  if (
    Math.max(...xs) - Math.min(...xs) < 0.008 ||
    Math.max(...ys) - Math.min(...ys) < 0.008
  )
    return null;
  let x = 0;
  let y = 0;
  for (const index of PALM_INDICES) {
    x += observation.landmarks[index]!.x;
    y += observation.landmarks[index]!.y;
  }
  return { x: x / PALM_INDICES.length, y: y / PALM_INDICES.length };
}

export class HandTracks {
  private tracks: Track[] = [];
  private nextId = 1;

  update(observations: HandObservation[], capturedAt: number): TrackingResult {
    const detections = observations
      .map((observation) => ({ observation, anchor: palmAnchor(observation) }))
      .filter((entry): entry is Detection => entry.anchor !== null)
      .slice(0, 2);
    if (detections.length === 0) return { hands: [], ambiguous: false };

    if (this.tracks.length === 0) {
      const created = detections.map((detection) =>
        this.createTrack(detection, capturedAt),
      );
      this.tracks.push(...created);
      return { hands: created.map(toPublic), ambiguous: false };
    }

    const assignment = chooseAssignment(this.tracks, detections, capturedAt);
    const matchedTrackIds = new Set<number>();
    const current: Track[] = [];
    for (const [trackIndex, detectionIndex] of assignment.pairs) {
      const track = this.tracks[trackIndex]!;
      this.updateTrack(track, detections[detectionIndex]!, capturedAt);
      matchedTrackIds.add(track.id);
      current.push(track);
    }
    for (
      let index = 0;
      index < detections.length && this.tracks.length < 2;
      index++
    ) {
      if (assignment.pairs.some((pair) => pair[1] === index)) continue;
      const track = this.createTrack(detections[index]!, capturedAt);
      this.tracks.push(track);
      matchedTrackIds.add(track.id);
      current.push(track);
    }
    return { hands: current.map(toPublic), ambiguous: assignment.ambiguous };
  }

  reset(): void {
    this.tracks = [];
    this.nextId = 1;
  }

  private createTrack(detection: Detection, capturedAt: number): Track {
    const xFilter = new OneEuroFilter();
    const yFilter = new OneEuroFilter();
    return {
      id: this.nextId++,
      rawX: detection.anchor.x,
      rawY: detection.anchor.y,
      filteredX: xFilter.filter(detection.anchor.x, capturedAt),
      filteredY: yFilter.filter(detection.anchor.y, capturedAt),
      vx: 0,
      vy: 0,
      lastAt: capturedAt,
      landmarks: detection.observation.landmarks,
      xFilter,
      yFilter,
    };
  }

  private updateTrack(
    track: Track,
    detection: Detection,
    capturedAt: number,
  ): void {
    const seconds = Math.max((capturedAt - track.lastAt) / 1_000, 1 / 240);
    const measuredVx = (detection.anchor.x - track.rawX) / seconds;
    const measuredVy = (detection.anchor.y - track.rawY) / seconds;
    track.vx = track.vx * 0.25 + measuredVx * 0.75;
    track.vy = track.vy * 0.25 + measuredVy * 0.75;
    track.rawX = detection.anchor.x;
    track.rawY = detection.anchor.y;
    track.filteredX = track.xFilter.filter(track.rawX, capturedAt);
    track.filteredY = track.yFilter.filter(track.rawY, capturedAt);
    track.lastAt = capturedAt;
    track.landmarks = detection.observation.landmarks;
  }
}

function toPublic(track: Track): TrackedHand {
  return {
    id: track.id,
    x: track.filteredX,
    rawX: track.rawX,
    y: track.filteredY,
    landmarks: track.landmarks,
  };
}

function chooseAssignment(
  tracks: Track[],
  detections: Detection[],
  capturedAt: number,
): {
  pairs: Array<[number, number]>;
  ambiguous: boolean;
} {
  if (tracks.length === 1) {
    let best = 0;
    for (let index = 1; index < detections.length; index++) {
      if (
        cost(tracks[0]!, detections[index]!, capturedAt) <
        cost(tracks[0]!, detections[best]!, capturedAt)
      )
        best = index;
    }
    return { pairs: [[0, best]], ambiguous: false };
  }
  if (detections.length === 1) {
    const first = cost(tracks[0]!, detections[0]!, capturedAt);
    const second = cost(tracks[1]!, detections[0]!, capturedAt);
    return {
      pairs: [[first <= second ? 0 : 1, 0]],
      ambiguous: Math.abs(first - second) < 0.015,
    };
  }
  const direct =
    cost(tracks[0]!, detections[0]!, capturedAt) +
    cost(tracks[1]!, detections[1]!, capturedAt);
  const crossed =
    cost(tracks[0]!, detections[1]!, capturedAt) +
    cost(tracks[1]!, detections[0]!, capturedAt);
  return {
    pairs:
      direct <= crossed
        ? [
            [0, 0],
            [1, 1],
          ]
        : [
            [0, 1],
            [1, 0],
          ],
    ambiguous: Math.abs(direct - crossed) < 0.015,
  };
}

function cost(track: Track, detection: Detection, capturedAt: number): number {
  const horizon = Math.min(
    Math.max((capturedAt - track.lastAt) / 1_000, 0),
    0.12,
  );
  const predictedX = track.rawX + track.vx * horizon;
  const predictedY = track.rawY + track.vy * horizon;
  return Math.hypot(
    detection.anchor.x - predictedX,
    (detection.anchor.y - predictedY) * 0.7,
  );
}
