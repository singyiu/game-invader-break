# Invader Break Development Plan

> **For agentic workers:** REQUIRED SUB-SKILL when implementation is requested: use superpowers:subagent-driven-development or superpowers:executing-plans task by task. The checkboxes below track future work. No implementation is authorized by this document.

**Goal:** Build a polished browser arcade game in which one or two camera-tracked hands control shield paddles against ball-damaged, attacking invaders.

**Architecture:** A versioned camera/ML boundary produces normalized hand observations; an input controller produces paddle intents; a deterministic fixed-step simulation owns rules and collisions. Three.js presents simulation snapshots, while DOM UI and audio consume events without owning gameplay state.

**Tech stack:** Proposed TypeScript, Vite, MediaPipe Tasks Vision Hand Landmarker, Three.js/WebGL 2, Web Audio, Vitest and Playwright. Exact versions are selected, pinned and qualified during feasibility.

**Spec:** [Game design](../specs/2026-09-16-invader-break-design.md). Also read the [research brief](../../research/research-brief.md) and [art direction](../../art/art-direction.md).

## Global constraints

- Web browser game named Invader Break.
- Hand-position control only after browser permission/bootstrap; no alternate combat controller.
- One paddle with width 18% of the arena.
- Two independently controlled paddles, each 9% of the arena; shared resources.
- Start every run at exactly three; no separate lives or hull meter.
- Every accepted damaging body/projectile collision removes exactly one shared shield.
- Proposed ball-loss rule: a drain also costs one shield; shared one-second damage grace prevents burst losses.
- One active ball; solo mode; no online account or leaderboard dependency.
- The shipped game uploads/persists no camera frames or landmarks; request video, not microphone. External consented QA timing recordings follow the separate policy below.
- Camera processing and decorative rendering must be qualified together.
- All performance numbers are targets until measured on recorded browser/hardware configurations.
- Original /home/cyngn/sing/agent-dev/rules is unavailable; do not claim conformity.
- This delivery is planning only. All source paths below are proposed, not implemented files.

## 1. Milestones and production expectation

| Milestone | Deliverable | Exit decision |
| --- | --- | --- |
| M0 — feasibility, estimated weeks 1–2 | Real camera/hand pipeline, timing harness, basic render workload | Can input and graphics coexist responsively on baseline hardware? |
| M1 — enjoyable graybox, weeks 3–4 | One/two-hand control, ball, three enemy behaviors, shields and fair attack scheduling | Is it fun and understandable with plain shapes? |
| M2 — polished vertical slice, weeks 5–7 | One finished arena, two waves, a shortened boss, production-quality effects/audio | Does the intended visual quality survive real play and device limits? |
| M3 — complete content, weeks 8–12 | Three sectors, six waves, full boss, tutorial, settings, local progression | Is the entire short run coherent and replayable? |
| M4 — qualification/polish, weeks 13–18 | Browser/device evidence, final balance, resource cleanup, release package | Are release claims supported by actual evidence? |

These are planning ranges, not a delivery commitment. The estimate assumes two engineers (game/input and graphics), one experienced 3D artist, and part-time technical art, sound/music and QA support. A strong vertical slice may fit in 4–7 weeks; a premium first release is more plausibly 12–18 weeks with that team. A solo schedule would be substantially longer and should reduce content before reducing control quality. Budget should follow staffing and asset scope, not a promise of “AAA” from a renderer choice.

M0 and M1 may change the estimate materially. Stop expanding content if input or fair attack scheduling fails its gate. Re-estimate after each milestone using observed production throughput.

## 2. Proposed module map

| Future path or group | Responsibility |
| --- | --- |
| package.json, tsconfig.json, vite.config.ts, vitest.config.ts, playwright.config.ts | Pinned build, type, test and browser tooling |
| src/app/session-machine.ts | Permission, setup, ready, play, pause, recovery, result and teardown states |
| src/camera/camera-session.ts, frame-scheduler.ts | Stream lifecycle, frame freshness, transfer and disposal |
| src/perception/hand-provider.ts, mediapipe-hands.ts, hand.worker.ts, protocol.ts | Model adapter, worker ownership and validated messages |
| src/input/hand-tracks.ts, palm-filter.ts, reach-calibration.ts, paddle-controller.ts | Identity, smoothing, mapping and one/two-hand mode |
| src/game/state.ts, step.ts, collisions.ts, damage.ts | Authoritative deterministic simulation |
| src/game/encounters.ts, attack-director.ts, scoring.ts, boss.ts | Content state, fairness, rewards and boss phases |
| src/content/tuning.ts, enemies.ts, sectors.ts | Reviewed balance values and declarative content |
| src/render/arena-renderer.ts, entity-views.ts, effects.ts, quality.ts | View-only rendering and measured quality tiers |
| src/audio/audio-director.ts | Event-driven sound, music stems and mixing |
| src/ui/setup.ts, hud.ts, menus.ts, accessibility.ts | Skeleton preview, hand-position menus and readable feedback |
| src/storage/local-profile.ts | Versioned local preferences and scores |
| src/diagnostics/metrics.ts | Local aggregate timing and quality counters, no camera payloads |
| public/models/, public/runtime/, public/assets/ | Pinned model/runtime and optimized art/audio |
| scripts/prepare-assets.mjs, verify-assets.mjs | Reproducible local assets, integrity and notices |
| tests/unit/, tests/integration/, tests/browser/, tests/fixtures/ | Rule invariants, worker boundaries, browser flows and synthetic observations |
| docs/decisions/, docs/validation/, docs/assets/ | Decisions, measured evidence and asset provenance |

These boundaries can split further where a module becomes hard to reason about. Do not introduce a generic entity framework, networking layer or React dependency unless an actual need appears.

## 3. Contracts to agree before parallel implementation

These are data definitions in prose, not source code.

| Contract | Required fields and invariants |
| --- | --- |
| CapturedFrame | Monotonic frame ID; media timestamp in ms; page capture-callback timestamp in ms; actual width/height; transferable bitmap with one clear owner |
| HandObservation | Exactly 21 finite x/y/z image landmarks; handedness label and label probability when available; derived palm anchor/scale; no invented per-joint confidence |
| HandFrame | Protocol version; frame ID; document capture/arrival timestamps; worker-local inference duration; media timestamp only for model ordering; zero to two observations; selected model/delegate; error state distinct from zero detected hands |
| HandTrack | Stable internal ID, current/prior palm samples, last-seen capture timestamp, association validity and filter state; references one shared session calibration |
| PaddleIntent | Simulation input time; active mode; zero/one/two track IDs and normalized target centers; tracking state; explicit pause/reconfigure request |
| GameSnapshot | Simulation tick and seed; ball/paddles/enemies/projectiles; shields 0–3; grace expiry; score/combo/charge; current wave/boss state |
| GameEvent | Stable event ID, tick and event kind; relevant entity IDs; collision position; damage/score cause; emitted once |
| UserProfile | Versioned settings, calibration, local bests and cosmetic unlocks; validated defaults and migration path |
| MetricsSummary | Aggregate sample ages, inference/frame timings, accepted/drop rates and state-transition counts; no video/landmarks |

The simulation consumes PaddleIntent and a fixed timestep. The renderer/audio/HUD consume snapshots/events. The ML adapter cannot damage shields or directly move scene objects. Identical normalized input and seed must reproduce the same game state independent of rendering speed.

## Task 0 — Reconcile rules, scope and target hardware

**Files:** create docs/decisions/development-baseline.md, browser-matrix.md and stack-selection.md.

**Consumes:** this proposal, the user requirements and locally available Motion Fighter evidence.  
**Produces:** a recorded engineering baseline, initial target-device list and dependency decision.

- [ ] Recheck the original rules path when the implementation environment is known; read an authoritative replacement if one is supplied.
- [ ] Map actual rules to branching, review, tests, dependencies and release tasks. If still unavailable, record the gap and the provisional practices; do not manufacture an 80% coverage requirement from a secondary summary.
- [ ] Confirm which proposed gameplay defaults become the implementation baseline, especially ball-loss damage and desktop-first scope.
- [ ] Select two initial devices: an Apple Silicon laptop and a Windows laptop with integrated graphics and a 720p webcam. Record exact CPU/GPU, RAM, OS, camera and browser versions instead of assuming a model name guarantees performance.
- [ ] Treat both devices as required baselines: all input/render gates apply to Windows Chrome and macOS Chrome/Safari independently from M0 onward. Publish the slower passing configuration as the minimum measured baseline; never average away a failing platform.
- [ ] Choose current compatible tool versions, lock dependencies, and record model/runtime URLs, hashes, licenses and redistribution requirements.
- [ ] Inspect the selected SDK's telemetry behavior against the current MediaPipe notice. Record actual endpoints/payload categories and the disclosure/consent or alternate-runtime decision; local inference alone does not establish zero network metrics.
- [ ] Record why WebGL 2 is the first renderer path; keep WebGPU as a later measured comparison.

**Exit:** another developer can identify the accepted scope and distinguish available rules from provisional recommendations. Missing historical rules are a documented limitation, not evidence that the current design work was incomplete.

## Task 1 — Prove camera and HandLandmarker together

**Files:** camera/perception modules; asset preparation scripts; tests/unit/camera-session.test.ts, frame-scheduler.test.ts and tests/browser/hand-worker.spec.ts.

**Consumes:** CapturedFrame and HandFrame contracts.  
**Produces:** real zero/one/two-hand observations with measured timestamps and reliable teardown.

- [ ] Write lifecycle tests for denial, cancellation, ended camera, worker failure and repeated start/stop. Run them and confirm the meaningful failure before implementing.
- [ ] Adapt Motion Fighter's newest-frame scheduling and ownership pattern; replace every pose-specific payload and model assumption.
- [ ] Configure video-mode HandLandmarker for two hands; preserve all 21 points per observation.
- [ ] Test the SDK module-worker loader on the chosen versions. Use a CPU fallback only when it loads correctly and meets the input gate.
- [ ] Validate message structure, result ages and monotonically increasing media timestamps; reject stale/out-of-order results.
- [ ] Dispose each transferred/discarded bitmap and every model, worker and camera resource on teardown.
- [ ] Run actual-model tests on Windows Chrome and macOS Chrome plus branded Safari with consented local camera use. Use a headed manual/SafariDriver path for actual Safari; Playwright WebKit and fake-camera tests alone cannot pass this task.
- [ ] Capture a ten-minute metrics report with one hand, two hands, graphics workload and thermal behavior.

**Exit:** minimum 20 accepted results/second, target 24–30; callback-to-result p95 ≤100 ms; no accepted result older than 150 ms; no queue growth. These are proposed desktop gates. If they cannot be met, adjust load or scope before continuing. The result age limit here is intentionally stricter than Motion Fighter's inspected 200 ms limit.

## Task 2 — Deliver stable one/two-hand paddle control

**Files:** input modules, src/ui/setup.ts; tests/unit/hand-tracks.test.ts, palm-filter.test.ts, paddle-controller.test.ts.

**Consumes:** HandFrame.  
**Produces:** PaddleIntent, calibration state and skeleton setup feedback.

- [ ] Write observation fixtures for mirroring, preview crop independent of control mapping, ordered/unordered detections, crossed hands, overlap, alternating single-frame misses, burst occlusions, extra detections and invalid geometry.
- [ ] Implement palm centroid, temporal association and timestamp-aware filtering independently so each can be measured.
- [ ] Implement comfortable reach calibration and mapping; never recalibrate gain continuously during play.
- [ ] Use one shared source-coordinate reach mapping so adding/removing a hand does not change gain or require identifying a returning hand from handedness.
- [ ] Implement capture-clock stability timers, document-clock freshness, uncertain-state micro-pauses and split/merge transitions. A single missing frame must not launch a countdown; worker/document clock origins must not be subtracted directly.
- [ ] Verify one full paddle is 18% wide and each half is 9%; enforce in-bounds centers.
- [ ] Perform 50 ordinary non-occluded crossings: require zero identity swaps, zero uncommanded jumps >3% arena width, zero unintended mode changes, and at most two ambiguity pauses, each ≤500 ms. Report deliberate occlusion separately; settle to the confirmed one-hand mode within 500 ms of loss, followed by the specified resume countdown.
- [ ] Externally film hand motion and display response; measure median ≤100 ms, p95 ≤150 ms, and stationary p95 deviation <0.5% arena width.
- [ ] In a normal ten-minute session, require uncertain-state freezes <1% of active time and no more than two tracking interruptions longer than 150 ms. Reject a configuration that meets average detection rate but interrupts play repeatedly.

**Exit:** players can move and rest comfortably, with no unexplained teleport or damage during loss. If aggressive smoothing fails the lag target, tune the filter rather than hiding latency with long prediction.

## Task 3 — Build authoritative ball physics and shield rules

**Files:** game/state.ts, step.ts, collisions.ts, damage.ts, content/tuning.ts; tests/unit/physics.test.ts, damage.test.ts and tests/integration/determinism.test.ts.

**Consumes:** PaddleIntent.  
**Produces:** GameSnapshot and unique GameEvents.

- [ ] Write swept-collision cases for a fast ball, moving paddle, wall corner, simultaneous overlap, underside contact and two touching/overlapping halves.
- [ ] Define earliest-time-of-impact ordering, deterministic ties, contact separation and a bounded collision-iteration limit.
- [ ] Implement fixed 120 Hz simulation with bounded catch-up; pause on long interruption.
- [ ] Implement contact-offset aiming, speed limits and anti-stall handling exactly once in the simulation.
- [ ] Calculate rebound offset from the contacted contiguous union interval; test deterministic ties between separate intervals. Consume contacts during damage grace without score or combo changes, while retaining the visible active ball-return surface.
- [ ] Write damage tests for a projectile, invader body, drain, simultaneous hazards, grace period, zero shields and pause.
- [ ] Implement three shared shields, the proposed miss penalty, one-second global grace, recovery serve and game over.
- [ ] Verify reconfiguration and tracking pause never award a hit, kill, score or shield loss.
- [ ] Replay identical seeds/inputs at 30/60/120 Hz rendering and compare final state/event sequences.

**Exit:** no tunneling or duplicate collision events in targeted stress cases; stable deterministic replays; exact shared-health behavior.

## Task 4 — Make a fair graybox encounter

**Files:** game/encounters.ts, attack-director.ts; content/enemies.ts, sectors.ts; tests/unit/attack-director.test.ts and tests/integration/encounter.test.ts.

**Consumes:** GameSnapshot and enemy definitions.  
**Produces:** Drone, Spitter and Lancer encounters, valid telegraphs and scheduled attack events.

- [ ] Specify time-to-impact and reachable catch intervals from the current ball state and measured control delay.
- [ ] Write scenarios where two hazards would make a catch impossible; require the director to defer or move the uncommitted attack.
- [ ] Implement conservative prediction for known trajectories. When prediction is uncertain, withhold a shot rather than claiming a proven safe schedule.
- [ ] Revalidate committed hazards after each ball collision, mode change and recovery. Visibly neutralize the minimum conflicting hazard when no reachable safe catch remains; award no points. Log interventions and redesign patterns that need more than one per wave in ordinary play.
- [ ] Implement minimum windup 650 ms and projectile flight-to-paddle 900 ms; lock aimed lanes at release.
- [ ] Limit simultaneous projectiles to two and divers to one; allow a smaller cap in the introductory wave.
- [ ] Cancel an unlaunched attack when its source dies; test ball/projectile interception.
- [ ] Run one-hand and two-hand graybox sessions before commissioning the full enemy roster.
- [ ] After Task 5 makes setup testable, run an exploratory pilot with at least ten first-time players before Task 6 art production: at least 8/10 complete setup and five returns within two minutes, at least 8/10 explain recent damage, and at least 7/10 voluntarily retry. Inspect every tracking-related loss. If these targets fail, iterate the graybox first.
- [ ] Compare the proposed drain penalty against the documented alternative without mixing both in one run.

**Exit:** first-time players can explain threats and losses; observed failures do not reveal scheduler-created traps. A unit-test oracle is supporting evidence, not a substitute for human play.

## Task 5 — Build the complete hand-only session flow

**Files:** app/session-machine.ts, ui/setup.ts, menus.ts, hud.ts, accessibility.ts; tests/browser/session.spec.ts, permissions.spec.ts.

**Consumes:** tracking states and game events.  
**Produces:** permission/setup/tutorial/play/pause/results/retry flow.

- [ ] Test bootstrap permission denial, insecure-origin messaging, missing camera, model download failure and audio activation failure.
- [ ] Build the mirrored skeleton setup and low-risk three-catch exercise.
- [ ] Add horizontal one-second dwell menus with visible progress and leave-to-rearm behavior.
- [ ] Implement removal-of-hands pause, stable reacquisition, countdown resume and safe merge/split.
- [ ] Pause and release camera on hidden visibility/pagehide events immediately; restart through the explicit camera/recovery flow on return. Do not depend on a background timer firing at a precise delay.
- [ ] Add reduced effects, sensitivity presets, readable UI scaling, separate sound levels and optional slower practice.
- [ ] Verify the full post-permission route without mouse/keyboard gameplay input.
- [ ] Verify network requests carry no camera frames, landmarks or microphone data.

**Exit:** the Task 4 exploratory pilot passes with this flow; a new player can grant access, calibrate, play, rest and retry without staff intervention. The browser bootstrap exception is explained accurately. Expensive asset production waits for this gate.

## Task 6 — Produce the visual and audio vertical slice

**Files:** render and audio modules; public/assets/sector-01/, enemies/, paddle/, boss/, audio/; docs/assets/manifest.md; tests/browser/visual-states.spec.ts.

**Consumes:** GameSnapshot/GameEvent, approved art brief and graybox timing.  
**Produces:** one finished arena, three enemies, two waves, shortened boss, effects, HUD and sound.

- [ ] Approve enemy silhouettes and paddle collision faces at actual gameplay size.
- [ ] Build optimized meshes/materials and core animation states, with source provenance recorded.
- [ ] Implement a fixed orthographic foreground and separate decorative depth layer.
- [ ] Add instancing, shared materials, pooled effects and shader warmup.
- [ ] Implement ball/shot contrast, local destruction, shield fracture and Overdrive visuals.
- [ ] Implement musical stems, distinct threat cues and critical-sound ducking.
- [ ] Capture the art brief's named visual states at 720p, full quality and reduced effects.
- [ ] Run both-hand inference during a ten-minute effects stress test; tune the whole workload.

**Exit:** frame intervals p95 ≤18 ms and p99 ≤33 ms on Windows Chrome and macOS Chrome/Safari on both selected baseline machines; control latency still passes; visual targets are evaluated in motion. If necessary, reduce decorations before reducing control responsiveness.

## Task 7 — Complete mastery, content and boss

**Files:** game/scoring.ts, boss.ts; content/enemies.ts, sectors.ts; remaining art/audio; tests/unit/scoring.test.ts, boss.test.ts and tests/integration/run.test.ts.

**Consumes:** validated core loop, content schemas and event contracts.  
**Produces:** six waves across three sectors and the full Eclipse Engine encounter.

- [ ] Add Bastion and Conductor with silhouette, armor-state and attack-cap tests.
- [ ] Author six waves with specific teaching/escalation goals and safe sector transitions.
- [ ] Implement petal/core boss phases and one-hand-solvable attack patterns.
- [ ] Implement score values, combo cap, five precision-return charge and six-second automatic Overdrive.
- [ ] Define piercing with remaining travel/time-of-impact processing; test multi-enemy contact and no repeated damage on an embedded ball.
- [ ] Add intact-shield results, local bests and cosmetic-only progression.
- [ ] Record one-hand/two-hand/mixed-control history, transition count, active time and wall-clock time; separate corresponding local records so deliberate pause/reconfiguration does not masquerade as a fixed-mode speed result.
- [ ] Play complete runs to measure duration, repetition, clarity and fatigue; rebalance content before adding modes.

**Exit:** complete runs generally fit 5–8 minutes; one-hand and two-hand completion are viable; all three shields have a clear, recorded loss cause.

## Task 8 — Harden profiles, privacy and deployment behavior

**Files:** storage/local-profile.ts, public/_headers, scripts/verify-assets.mjs; tests/unit/profile.test.ts and tests/browser/lifecycle.spec.ts.

**Consumes:** settings/profile schema and chosen deployment behavior.  
**Produces:** robust local persistence and a deployable static artifact.

- [ ] Validate/migrate local data; recover from corrupt or full storage without blocking a run.
- [ ] Freeze and pin runtime/model asset versions with integrity checks and notices.
- [ ] Configure HTTPS, worker/model fetch policy, CSP and camera Permissions Policy for the actual hosting environment.
- [ ] Recheck runtime telemetry against the recorded privacy decision and test actual requests. Keep camera/landmark non-upload verification separate from SDK performance-metrics disclosure and consent behavior.
- [ ] Test missing/corrupt asset handling, worker initialization timeout and WebGL context loss.
- [ ] Release stream, workers, bitmaps, audio and GPU resources on exit/restart; inspect repeated-session memory trends.
- [ ] Keep offline play out of the initial claim unless model/assets are deliberately cached and permission behavior is tested.
- [ ] Produce a build manifest containing exact versions, asset hashes and commit identity when available.

**Exit:** failure states are recoverable and explain themselves; network inspection confirms the local-camera architecture. Hosting/publication is a separate action when requested.

## Task 9 — Qualify fun, comfort and supported browsers

**Files:** docs/validation/pilot-protocol.md, participant-summary.md, browser-matrix.md, performance.md and accessibility.md.

**Consumes:** release-shaped game and metrics definitions.  
**Produces:** observed evidence, remaining limitations and support decisions.

- [ ] Run a consent-based pilot with at least ten first-time players across varied hands, lighting and cameras. Store aggregate results, not camera recordings by default.
- [ ] Counterbalance one-hand/two-hand order; compare catch accuracy, avoidable losses, comprehension, retry choice and effort.
- [ ] Measure setup completion, five-return learning time and the cause of each shield loss.
- [ ] Run exact browser/OS/device matrix: current Chrome on both baseline machines, Safari on macOS, then Edge on Windows. Qualify Firefox only if it passes the model/worker path and the same tests.
- [ ] Test denied permission, camera unplugging/switching, tab hide/restore, display resize, low light, fast sweeps, crossed hands, thermal load and reduced effects.
- [ ] Assess worst-case combined flashing, grayscale threat recognition, laptop-speaker cues and muted play.
- [ ] Publish p50/p95/p99 metrics with configuration and raw aggregate counts. Do not describe inference throughput as physical tracking latency.

**Exit:** the game passes the spec's pilot and performance targets, or clearly narrows its support scope and fixes the failures before claiming readiness.

## Task 10 — Review and prepare release

**Files:** release notes, known-limitations.md, validation summaries, asset notices and release checklist.

**Consumes:** measured evidence, final assets and rules reconciliation record.  
**Produces:** a reviewable candidate with justified claims.

- [ ] Run formatting, lint, typecheck, unit/integration tests, browser tests and production build.
- [ ] Review consequential code independently, concentrating on resource lifecycle, collision chronology, identity transitions and attack fairness.
- [ ] Resolve critical/high findings and regressions; record actual commands and results.
- [ ] Check no production debugging logs, client secrets, surprise data uploads or unlicensed copied assets remain.
- [ ] Review the Invader Break title/name before public release and confirm contributor/commissioned-art, music and sound usage rights; record any naming or asset changes needed.
- [ ] Compare final scope, art and browser claims with the evidence; reconcile authoritative rules if now available.
- [ ] Write player-facing known limitations and install-free launch instructions.
- [ ] Deliver the candidate for the separately requested release/deployment step.

**Exit:** a reviewer can reproduce checks and see what is supported. A successful build alone does not pass playability, comfort, performance or art gates.

## 4. Verification strategy

Future standard commands should be exposed consistently as npm scripts: npm run format:check, npm run lint, npm run typecheck, npm test, npm run test:browser, npm run build and npm run assets:verify. These scripts do not exist yet.

Use test-first cycles for stateful consequential behavior: add the specific failing scenario, confirm failure, implement the smallest correct behavior, run the relevant suite, then review. Do not write tests that merely restate decorative CSS or assert arbitrary implementation details.

Synthetic input replay proves logic; actual-camera trials prove the chosen model path; external timing proves end-to-end response; visual/audio review proves presentation; participants provide evidence about enjoyment and comfort. None substitutes for all the others.

External timing recordings require explicit participant consent. Frame hands/display without faces where possible; keep recordings local, outside the repository, for at most seven days and delete after scoring. Do not upload them. Prefer synthetic test fixtures and aggregate results for retained evidence; a non-recording optical timing setup can replace filming.

Require seeded replay tests for collision ordering and attack scheduling. Keep fixtures generated or explicitly consented. Log normalized game input only for an opt-in debug session, with a clear delete action; routine metrics contain aggregate counts.

## 5. Safe parallel work

After Task 0 and contract agreement, camera/inference and deterministic physics can progress separately. Art silhouette exploration and audio palette work can also proceed from the brief. Integration waits for shared contracts to stabilize.

After the graybox gate, one lane owns rendering/assets, one owns enemy/content logic, and a separate reviewer owns scenario verification. Avoid assigning multiple agents to the same state machine, tuning file or contract simultaneously.

Each small implementation change should state the resulting behavior, validation performed and remaining limitations. Use isolated development work when appropriate at execution time. This planning task has not created a branch, commit, release or deployment.

## 6. Requirement coverage

| Requirement area | Tasks |
| --- | --- |
| Camera, detailed hand joints and Motion Fighter reuse | 1–2 |
| One/two hands, identity, crossing, loss and rest | 2, 5 |
| Ball, invaders, three shields and exact damage | 3–4, 7 |
| Exciting aim, progression, Overdrive and boss | 4, 6–7 |
| Premium graphics, animation, VFX and sound | 6–7, 9 |
| Browser performance and local camera processing | 1, 6, 8–9 |
| Onboarding and hand-only UI | 5 |
| Rules, code quality and release evidence | 0, 8–10 |

The next implementation action, if separately requested, is Task 0 followed by the hand-tracking feasibility gate. Producing more concept art or enemies before that gate does not resolve the largest project risk.
