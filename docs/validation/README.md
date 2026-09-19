# Candidate validation

This directory separates reproducible software checks from human/device qualification. See [implementation status](implementation-status.md) for task coverage. The original implementation checks are recorded in [implementation evidence](implementation-evidence.md); the calibration and camera controls are covered in the [September 17 usability update](2026-09-17-usability-update.md), followed by the [endless powers update](2026-09-17-endless-powers.md), [five-level speed and patterned-flight update](2026-09-17-speed-and-flight.md), [return-flight update](2026-09-17-return-flight.md), and [Safari compatibility investigation](2026-09-19-safari.md).

## Implemented and exercised

- Pure deterministic simulation with swept collision chronology, overlap/union paddles, shared damage grace, six repeating formations, five invader types and a recurring petal/core boss, with increasing difficulty and no final level.
- Camera session, one-in-flight/newest-frame scheduling, bitmap ownership and worker protocol. Real pinned Hand Landmarker initialization and blank-frame inference in browser, in addition to isolated lifecycle tests.
- Stable hand association, capture-clock mode confirmation, shared calibration, paused loss/recovery and one/two-hand mapping.
- Browser bootstrap denial, hand-only calibration followed by automatic play, dwell settings, split/merge, rest/reacquisition, game over, retry, camera disconnect, hidden-page camera release and delayed-start cancellation.
- Five collectible powers with combat-time expiry, safe multiball recovery, piercing fireballs and shield repair; two-hand score bonuses and highest-level records.
- Original realtime procedural art and an original layered synthesized soundtrack, local validated profiles and hashed same-origin assets.

## Not established by this delivery

- Accuracy, jitter, motion-to-photon latency, ordinary-hand crossing identity quality or fatigue on physical participants.
- The 10-minute frame/inference performance gates under real two-hand camera load on the required Windows and macOS devices.
- The ten-person onboarding/fairness/retry pilot, endless-mode difficulty and run-length balance or a commercial AAA art/audio acceptance review.
- Broad Safari/Windows Chrome/Edge physical-camera qualification. Native Safari hand detection was exercised on the available Mac; sustained two-hand runs and other devices remain unqualified. Automated Chromium and WebKit checks and local Chrome visual checks are supporting evidence, not the whole support matrix.
- Model-weight redistribution clearance, working-title trademark review, production-host header configuration or public deployment.

Use [pilot protocol](pilot-protocol.md), [browser matrix](browser-matrix.md) and [performance protocol](performance.md) for the remaining work. Do not relabel a synthetic run or blank-frame inference as actual-camera performance evidence.
