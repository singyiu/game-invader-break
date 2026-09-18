# Implementation evidence

Validated locally on 2026-09-16 using macOS arm64, Node.js 20.18.0, npm 10.8.2, local Chrome and Playwright Chromium. This is an implemented local candidate; the [release checklist](release-checklist.md) retains the human, physical-camera and device qualification gates.

## Final automated checks

| Command | Result |
| --- | --- |
| `npm run format:check` | Passed |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | 112 tests passed across 25 files |
| `npm run assets:verify` | Seven model/runtime files verified against SHA-256 manifest |
| `npm run build` | Passed; static output and hashed build manifest generated |
| `git diff --check` | Passed |

The browser suite covers the landing screen, permission denial, reduced-motion preference, real model/worker startup, production CSP and camera scheduling, calibration and dwell menus, split/loss recovery, game over and retry, page suspension and four visual captures. Synthetic control observations exercise the actual simulation; they do not substitute for physical-camera testing.

Final renderer verification ran `npm run test:browser`: 12 of 13 checks passed. The remaining run-flow test stopped at the intended display-gap safety pause after a slow software-rendered frame; its automated player was still following the ball instead of responding to the center-dwell prompt. The failure screenshot showed the correct safety UI. The test camera now optionally follows that prompt using hand observations, without changing production behavior. `npm run test:browser -- tests/browser/run.spec.ts` then passed the full practice → run → three-shield loss → retry flow in 54 seconds. Other callers retain manual recovery behavior and are checked separately below.

`npm run test:browser -- tests/browser/session.spec.ts tests/browser/startup.spec.ts` passed all three checks after that fixture update. All 13 browser scenarios therefore have passing results on their final relevant code. This was a full run followed by affected-test reruns, not a claim that the last full invocation had no failure. Formatting, lint and TypeScript checks also passed after the fixture change.

The tests cover collision chronology, moving/overlapping paddles, shared shield damage and grace, catch-safe attacks, fixed boss rewards, deterministic encounters, hand identity and debounce timing, stale frame rejection, camera/worker ownership, calibration, dwell selection, local profile validation, metrics and startup cancellation. Regression tests were added for independently reproduced defects rather than relying only on visual inspection.

## Independent reviews

- Gameplay review found merge-enclosed hazard damage, a diagonal-shot catch conflict and combo multiplication of fixed boss rewards. All three were fixed and approved on scoped re-review; 43 gameplay tests passed.
- Input review found premature paddle ownership changes, count-only merge debounce and an occlusion recovery countdown bypass. All three were fixed and approved on scoped re-review, including four independent boundary replays.
- Integration review found that a delayed audio startup could start the camera after suspension. A generation guard now cancels stale startup work. The direct application regression failed before the fix and passed afterward; re-review approved it with 19 tests and five independent cancellation replays.
- Renderer review found incompatible Drone geometry batching that removed authored details and emitted console errors, plus paddle endcaps extending outside the collider. Geometry compaction now preserves the authored parts, and both paddle sizes fit their collision width. Three new geometry/bounds tests passed after reproducing the defects; browser checks now reject console errors as well as uncaught exceptions. Scoped re-review approved both fixes with 11 focused tests and no new actionable findings.

Detailed implementation/review reports are retained locally under `.superpowers/sdd/2026-09-16-invader-break-development-plan/`. This ignored working directory is not required to run the game.

## Visual evidence

The [screenshots](screenshots/README.md) include the actual landing screen and explicitly labelled synthetic combat, boss and reduced-effects states rendered by the production renderer. Draw-call and triangle counts are available through the renderer's local `stats` API. Scene counts do not establish frame-rate or combined camera/render performance on the target laptops.

Live Chrome inspection checked the landing composition and readable faceted enemy materials after the final lighting pass. Art, effects and audio are original procedural work. No concept image is used as a fake gameplay background, and no synthetic hand controller is included in the production entry.

## Build and provenance

The pinned local model and runtime are prepared by `scripts/prepare-assets.mjs`; the build refuses missing or changed assets. The static output contains notices, licenses, security-header configuration and `build-manifest.json` with file hashes and dependency versions. The manifest explicitly identifies this as an uncommitted implementation based on commit `08af68c`; no commit, push or deployment was performed.

Production and development worker checks exercise real model initialization and blank-frame inference. A test canvas supplies the production camera stream. This verifies the application/worker integration and observed same-origin requests, not recognition of real hands. Camera permission denial and hidden-page resource release are also exercised.

## Remaining empirical work

Physical hand accuracy, motion-to-photon latency, crossing identity, camera-load performance, ten-person usability/comfort, measured run length, single-hand boss balance and Windows/branded Safari support remain unmeasured. Use the [pilot](pilot-protocol.md), [browser matrix](browser-matrix.md) and [performance protocol](performance.md). Public release also retains the model redistribution, title and hosting checks listed in the release checklist.
