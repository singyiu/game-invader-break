import { describe, expect, it } from "vitest";
import type {
  HandFrame,
  HandObservation,
  Landmark,
} from "../../src/shared/contracts";
import { HandController } from "../../src/input/paddle-controller";

function hand(x: number, y = 0.5): HandObservation {
  const landmarks: Landmark[] = Array.from({ length: 21 }, (_, index) => ({
    x: x + ((index % 5) - 2) * 0.006,
    y: y + (Math.floor(index / 5) - 2) * 0.006,
    z: 0,
  }));
  for (const index of [0, 5, 9, 13, 17]) landmarks[index] = { x, y, z: 0 };
  return { landmarks };
}

function frame(
  capturedAt: number,
  hands: HandObservation[],
  arrivedAt = capturedAt + 10,
): HandFrame {
  return {
    version: 1,
    frameId: capturedAt + 1,
    capturedAt,
    arrivedAt,
    mediaTime: capturedAt,
    inferenceMs: 5,
    hands,
  };
}

describe("HandController", () => {
  it("requires 300 ms of stable first-hand input and explicit center-dwell confirmation", () => {
    const controller = new HandController();
    controller.update(frame(0, [hand(0.5)]));
    controller.update(frame(299, [hand(0.5)]));
    expect(controller.intent(309)).toMatchObject({ mode: 0, paused: true });
    controller.update(frame(300, [hand(0.5)]));
    expect(controller.intent(310)).toMatchObject({
      mode: 1,
      paused: true,
      needsDwell: true,
    });
    for (const at of [600, 900, 1_200, 1_300])
      controller.update(frame(at, [hand(0.5)]));
    controller.confirmResume(1_310);
    expect(controller.intent(1_310)).toMatchObject({
      mode: 1,
      paused: false,
      status: "stable",
      needsDwell: false,
    });
  });

  it("mirrors once and clamps full and split paddle centers in bounds", () => {
    const controller = new HandController();
    controller.update(frame(0, [hand(0.18)]));
    controller.update(frame(300, [hand(0.18)]));
    controller.confirmResume(310);
    expect(controller.intent(310).targets[0]!.x).toBeCloseTo(0.91, 5);

    controller.update(frame(400, [hand(0.18), hand(0.82)]));
    controller.update(frame(750, [hand(0.18), hand(0.82)]));
    for (const at of [1_000, 1_300, 1_450])
      controller.update(frame(at, [hand(0.18), hand(0.82)]));
    expect(controller.intent(1_459)).toMatchObject({
      mode: 2,
      paused: true,
      status: "reconfiguring",
    });
    const split = controller.intent(1_460);
    expect(split.paused).toBe(false);
    expect(split.targets.map((target) => target.x).sort()).toEqual([
      0.0675, 0.9325,
    ]);
  });

  it("micro-pauses on one missed hand and resumes immediately when it returns within 150 ms", () => {
    const controller = readyTwoHands();
    const ids = controller.hands.map((tracked) => tracked.id).sort();
    controller.update(frame(1_600, [hand(0.3)]));
    expect(controller.intent(1_610)).toMatchObject({
      mode: 2,
      paused: true,
      status: "uncertain",
    });
    controller.update(frame(1_700, [hand(0.3), hand(0.7)]));
    expect(controller.intent(1_710)).toMatchObject({
      mode: 2,
      paused: false,
      status: "stable",
    });
    expect(controller.hands.map((tracked) => tracked.id).sort()).toEqual(ids);
  });

  it("uses a 300 ms return countdown after a 150–350 ms partial occlusion", () => {
    const controller = readyTwoHands();
    controller.update(frame(1_600, [hand(0.3)]));
    controller.update(frame(1_800, [hand(0.3), hand(0.7)]));
    expect(controller.intent(1_810)).toMatchObject({
      mode: 2,
      paused: true,
      status: "paused",
      resumeIn: 300,
    });
    controller.update(frame(2_000, [hand(0.3), hand(0.7)]));
    controller.update(frame(2_100, [hand(0.3), hand(0.7)]));
    expect(controller.intent(2_110)).toMatchObject({
      paused: false,
      status: "stable",
      resumeIn: 0,
    });
  });

  it("merges after one hand has been absent 350 ms and freezes shape change for 700 ms", () => {
    const controller = readyTwoHands();
    controller.update(frame(1_600, [hand(0.3)]));
    controller.update(frame(1_950, [hand(0.3)]));
    expect(controller.intent(1_960)).toMatchObject({
      mode: 1,
      paused: true,
      status: "reconfiguring",
      resumeIn: 700,
    });
    for (const at of [2_200, 2_500, 2_650])
      controller.update(frame(at, [hand(0.3)]));
    expect(controller.intent(2_660)).toMatchObject({
      mode: 1,
      paused: false,
      status: "stable",
    });
  });

  it("rejects stale and out-of-order frames without replacing the latest valid hands", () => {
    const controller = new HandController();
    controller.update(frame(100, [hand(0.3)], 120));
    const before = controller.hands[0]!.rawX;
    controller.update(frame(300, [hand(0.8)], 451));
    controller.update({ ...frame(90, [hand(0.9)], 100), frameId: 0 });
    expect(controller.hands[0]!.rawX).toBe(before);
  });

  it("marks fresh tracking stale against the document clock after 150 ms", () => {
    const controller = new HandController();
    controller.update(frame(0, [hand(0.5)]));
    controller.update(frame(300, [hand(0.5)]));
    controller.confirmResume(310);
    expect(controller.intent(449).paused).toBe(false);
    expect(controller.intent(451)).toMatchObject({
      paused: true,
      status: "stale",
    });
  });

  it("requires stable reacquisition and another dwell after both hands stay absent", () => {
    const controller = new HandController();
    controller.update(frame(0, [hand(0.5)]));
    controller.update(frame(300, [hand(0.5)]));
    controller.confirmResume(310);
    controller.update(frame(400, []));
    controller.update(frame(750, []));
    controller.update(frame(800, [hand(0.5)]));
    controller.update(frame(1_099, [hand(0.5)]));
    expect(controller.intent(1_109).needsDwell).toBe(false);
    controller.update(frame(1_100, [hand(0.5)]));
    expect(controller.intent(1_110)).toMatchObject({
      paused: true,
      needsDwell: true,
    });
    for (const at of [1_400, 1_700, 2_000, 2_100])
      controller.update(frame(at, [hand(0.5)]));
    controller.confirmResume(2_110);
    expect(controller.intent(2_110).paused).toBe(false);
  });

  it("uses capture time to require reacquisition when zero-hand results are sparse", () => {
    const controller = new HandController();
    controller.update(frame(0, [hand(0.5)]));
    controller.update(frame(300, [hand(0.5)]));
    controller.confirmResume(310);
    controller.update(frame(400, []));
    controller.update(frame(800, [hand(0.5)]));
    expect(controller.intent(810)).toMatchObject({
      paused: true,
      needsDwell: false,
    });
    controller.update(frame(1_100, [hand(0.5)]));
    expect(controller.intent(1_110)).toMatchObject({
      paused: true,
      needsDwell: true,
    });
  });

  it("keeps the confirmed survivor when the lower-ID hand returns before split confirmation", () => {
    const controller = readyTwoHands();
    for (let at = 1_550; at <= 2_650; at += 50)
      controller.update(frame(at, [hand(0.7)]));
    expect(controller.intent(2_660)).toMatchObject({
      mode: 1,
      targets: [{ id: 2 }],
      paused: false,
      status: "stable",
    });

    controller.update(frame(2_700, [hand(0.3), hand(0.7)]));
    const returning = controller.intent(2_710);
    expect(returning).toMatchObject({
      mode: 1,
      targets: [{ id: 2 }],
      paused: false,
      status: "stable",
    });
    expect(returning.targets[0]!.x).toBeLessThan(0.3);
  });

  it("does not merge when the two active IDs alternate single-frame misses", () => {
    const controller = readyTwoHands();
    for (let at = 1_550, index = 0; at <= 1_900; at += 50, index += 1) {
      controller.update(frame(at, [hand(index % 2 === 0 ? 0.7 : 0.3)]));
    }
    expect(controller.intent(1_910)).toMatchObject({
      mode: 2,
      paused: true,
      status: "uncertain",
    });
  });

  it("applies the return countdown before considering an additional hand", () => {
    const controller = new HandController();
    controller.update(frame(0, [hand(0.3)]));
    controller.update(frame(300, [hand(0.3)]));
    controller.confirmResume(310);
    controller.update(frame(350, []));
    controller.update(frame(550, [hand(0.3), hand(0.7)]));
    expect(controller.intent(560)).toMatchObject({
      mode: 1,
      targets: [{ id: 1 }],
      paused: true,
      status: "paused",
      resumeIn: 300,
    });
  });
});

function readyTwoHands(): HandController {
  const controller = new HandController();
  controller.update(frame(0, [hand(0.3)]));
  controller.update(frame(300, [hand(0.3)]));
  controller.confirmResume(310);
  controller.update(frame(400, [hand(0.3), hand(0.7)]));
  controller.update(frame(750, [hand(0.3), hand(0.7)]));
  for (const at of [1_000, 1_300, 1_450])
    controller.update(frame(at, [hand(0.3), hand(0.7)]));
  expect(controller.intent(1_460).paused).toBe(false);
  return controller;
}
