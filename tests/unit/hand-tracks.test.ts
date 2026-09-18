import { describe, expect, it } from "vitest";
import type { HandObservation, Landmark } from "../../src/shared/contracts";
import { HandTracks, palmAnchor } from "../../src/input/hand-tracks";

function hand(x: number, y = 0.5): HandObservation {
  const landmarks: Landmark[] = Array.from({ length: 21 }, (_, index) => ({
    x: x + ((index % 5) - 2) * 0.006,
    y: y + (Math.floor(index / 5) - 2) * 0.006,
    z: index * -0.001,
  }));
  for (const index of [0, 5, 9, 13, 17]) landmarks[index] = { x, y, z: 0 };
  return { landmarks };
}

describe("palmAnchor", () => {
  it("uses the wrist and four metacarpal bases", () => {
    const observation = hand(0.4, 0.6);
    observation.landmarks[8] = { x: 1, y: 0, z: 0 };
    expect(palmAnchor(observation)).toEqual({ x: 0.4, y: 0.6 });
  });

  it("rejects invalid points and collapsed palm geometry", () => {
    const invalid = hand(0.4);
    invalid.landmarks[4] = { x: Number.NaN, y: 0.5, z: 0 };
    expect(palmAnchor(invalid)).toBeNull();
    const collapsed = hand(0.4);
    for (const point of collapsed.landmarks)
      Object.assign(point, { x: 0.4, y: 0.5, z: 0 });
    expect(palmAnchor(collapsed)).toBeNull();
  });
});

describe("HandTracks", () => {
  it("preserves physical identities through an ordinary crossing", () => {
    const tracks = new HandTracks();
    const initial = tracks.update([hand(0.2, 0.4), hand(0.8, 0.6)], 0);
    const upperId = initial.hands.find((tracked) => tracked.rawX < 0.5)!.id;
    tracks.update([hand(0.4, 0.4), hand(0.6, 0.6)], 40);
    tracks.update([hand(0.48, 0.6), hand(0.52, 0.4)], 80);
    const crossed = tracks.update([hand(0.3, 0.6), hand(0.7, 0.4)], 120);
    expect(
      crossed.hands.find((tracked) => tracked.id === upperId)!.rawX,
    ).toBeGreaterThan(0.5);
  });

  it("does not turn sorted detection order into identity", () => {
    const tracks = new HandTracks();
    const first = tracks.update([hand(0.25, 0.35), hand(0.75, 0.65)], 0);
    const topId = first.hands.find((tracked) => tracked.y < 0.5)!.id;
    const second = tracks.update([hand(0.7, 0.65), hand(0.3, 0.35)], 33);
    expect(
      second.hands.find((tracked) => tracked.id === topId)!.y,
    ).toBeLessThan(0.5);
  });

  it("ignores malformed and extra observations", () => {
    const invalid = hand(0.5);
    invalid.landmarks[0] = { x: -2, y: 0.5, z: 0 };
    const result = new HandTracks().update(
      [invalid, hand(0.2), hand(0.8), hand(0.6)],
      0,
    );
    expect(result.hands).toHaveLength(2);
    expect(
      result.hands.every((tracked) => tracked.rawX >= 0 && tracked.rawX <= 1),
    ).toBe(true);
  });
});
