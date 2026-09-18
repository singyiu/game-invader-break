import { expect, it } from "vitest";
import { MetricsCollector } from "../../src/diagnostics/metrics";
it("reports bounded aggregate percentiles and interruption duty without input payloads", () => {
  const m = new MetricsCollector();
  for (let i = 1; i <= 100; i++) m.inference(i, i / 2);
  m.frame(16, true, false);
  m.frame(200, true, true);
  m.frame(16, true, false);
  const report = m.summary();
  expect(report.resultAgeMs.p95).toBe(95);
  expect(report.inferenceMs.p50).toBe(25);
  expect(report.interruptionsOver150ms).toBe(1);
  expect(report.trackingPauseMs).toBe(200);
  expect(report.activeWallMs).toBe(232);
  expect(JSON.stringify(report)).not.toMatch(/landmarks|hands|video|positions/);
});
it("ignores invalid timings and clears aggregates between runs", () => {
  const m = new MetricsCollector();
  m.inference(NaN, -1);
  expect(m.summary().inferenceMs.count).toBe(0);
  m.inference(3, 5);
  m.reset();
  expect(m.summary().inferenceMs.count).toBe(0);
});
