import { expect, it } from "vitest";
import { ReachSetup } from "../../src/ui/reach-setup";
it("captures comfortable source-space endpoints only after a stable hold", () => {
  const r = new ReachSetup();
  expect(r.update("left", 0.72, 0).done).toBe(false);
  expect(r.update("left", 0.73, 1000).done).toBe(true);
  expect(r.update("right", 0.3, 1200).done).toBe(false);
  expect(r.update("right", 0.3, 2200).calibration).toEqual({
    min: 0.3,
    max: 0.73,
  });
});
it("rejects narrow reach and resets dwell when the hand disappears", () => {
  const r = new ReachSetup();
  r.update("left", 0.7, 0);
  r.update("left", 0.7, 1000);
  r.update("right", 0.62, 1100);
  expect(r.update("right", 0.62, 3000).done).toBe(false);
  r.update("right", 0.2, 4000);
  r.update("right", null, 4800);
  expect(r.update("right", 0.2, 5000).progress).toBe(0);
});
