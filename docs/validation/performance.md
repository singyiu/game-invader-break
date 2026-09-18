# Performance and privacy protocol

Physical device qualification is pending. Do not treat software-rendered automated browser timings as hardware minimums.

The app collects fixed-memory aggregate histograms only: frame interval, capture-to-result age, worker inference duration, active wall time, tracking pause duty and long interruption count. `InvaderBreakApp.diagnostics` provides a local summary for the QA harness without retaining frames or joint traces. Model timings are separate from externally measured motion-to-photon latency.

For each baseline browser/device, run 10 minutes each of one-hand, two-hand and peak legal combat while recording aggregate counts. Record p50/p95/p99, accepted/dropped observations, frame rates and final resource trends. Include thermal slowdown. Targets from the specification: ≥20 accepted hand results/s; callback-to-result p95 ≤100 ms; no accepted result >150 ms; frame interval p95 ≤18 ms / p99 ≤33 ms; tracking freezes <1% of active wall time, ≤2 interruptions >150 ms per 10 minutes. Externally measure motion-to-photon median ≤100 ms / p95 ≤150 ms and stationary p95 deviation <0.5% arena width.

Inspect network requests with the actual camera and every recovery path. They must stay on the application origin; no camera/landmark payloads, no microphone permission. The app's same-origin CSP must apply to workers. The upstream MediaPipe metrics notice remains disclosed; a blank-frame smoke test observing no external requests is narrower evidence than every platform/runtime path.

Visual QA: normal rally, busiest legal attack, shield fracture, split/merge, Overdrive, boss destruction, reduced effects. Assess at 720p, native speed, low brightness, grayscale and muted. Combined flashing/accessibility acceptance remains a human review task.
