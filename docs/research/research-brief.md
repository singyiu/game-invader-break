# Invader Break — research brief

Research date: 2026-09-16. Sources below were inspected during this design task. Published product descriptions establish features, not player enjoyment or the performance of this proposed game. Local code observations are inspection findings; no reference application or benchmark was run in this task.

## 1. What the precedents suggest

| Reference and observed feature | Transfer to Invader Break | What to avoid |
| --- | --- | --- |
| [Atari Breakout](https://atari.com/pages/breakout): paddle, ball, destructible targets, finite chances | Keep the return path and damage economy immediately understandable | Adding several competing health meters |
| [Taito history](https://taito.co.jp/en/corporate/about/history): Space Invaders originated in 1978 | Preserve the recognizable rhythm of an advancing alien formation | Copying original sprite designs or implying a licensed sequel |
| [Shatter Remastered Deluxe, developer announcement](https://pikpok.com/news/shatter-remastered-deluxe-brings-you-classic-brick-breaking-action-like-you-have-never-seen-it-before-smashing-onto-console-and-steam-in-late-2022/): trajectory influence, bosses, modern 3D presentation and soundtrack | Make paddle contact position a deliberate aiming choice; use bosses and responsive audiovisual layers | Importing extra buttons or hand gestures for “suck and blow” |
| [Space Invaders Extreme, official help](https://www.taito.co.jp/en/steam/sie/help): chains, multipliers, power-ups, bonus states and varied enemies | Make enemy priority, score, music and effects communicate the same state | Hidden kill-order recipes that distract from the ball |
| [Arkanoid: Eternal Battle, publisher page](https://www.microids.com/game-arkanoid-eternal-battle/): distinct solo and multiplayer modes | Start with one strong mode, then reuse established mechanics for later modes | Launching with networking and many modes before controls feel good |
| [Breakout Beyond, Atari](https://atari.com/products/breakout-beyond): changed playfield structure, combo-driven effects and focus mode | Tie spectacle to mastery; test slower practice play; make the hybrid more than a reskin | Letting increasing effects conceal necessary information |

**Synthesis:** the strongest identity is defensive geometry. One full paddle is forgiving and continuous; two halves can occupy separated lanes. Both must return a physical ball while the targets attack. This is a concrete differentiator, not a novelty or market-size claim.

The research supports combining readable rules with controllable aim, escalating enemy behavior, music and effects. It does not tell us the right hand sensitivity, enemy density, or miss penalty. Those require comparative playtests.

### Central design risk

A conventional Breakout paddle wants to move toward the ball; an Invaders defender often wants to move away from a threat. Without a scheduler, the two demands can produce an unavoidable loss. Therefore telegraph duration, projectile arrival windows, reachable safe catches and damage grace must be designed together. “More bullets” is not a difficulty model.

The design deliberately leaves ball speed unchanged during Overdrive. Skill changes what the ball can accomplish, while input latency remains a stable learning problem.

## 2. Motion Fighter: what is actually reusable

The reference project is [game-motion-fighter](/Users/singcheung/sing/game-motion-fighter/README.md). It uses a body-pose pipeline, not a complete hand-joint pipeline.

| Local evidence | Observed behavior | Invader Break action |
| --- | --- | --- |
| [MediaPipe provider](/Users/singcheung/sing/game-motion-fighter/src/perception/mediapipe-provider.ts:1) | PoseLandmarker, VIDEO mode, up to two poses; returns the first body's landmarks | Replace with HandLandmarker and explicit arrays of hand observations |
| [Body features](/Users/singcheung/sing/game-motion-fighter/src/motion/body-features.ts:3) | Uses pose wrist indices 15/16; mirrors wrist positions later | Replace with the 21-joint hand model and palm anchor |
| [Contracts](/Users/singcheung/sing/game-motion-fighter/src/shared/contracts.ts:15) | Flat PoseSample with visibility values | Define hand-specific contracts; do not reuse pose visibility thresholds |
| [Frame scheduler](/Users/singcheung/sing/game-motion-fighter/src/camera/frame-scheduler.ts:16) | Fresh video callbacks, animation-frame fallback, one inference in flight, newest pending frame, disposal of discarded bitmaps | Adapt this scheduling/resource lifecycle pattern |
| [Camera tracker](/Users/singcheung/sing/game-motion-fighter/src/camera/camera-tracker.ts:38) | Video-only 640×480/30 fps preference, cancellation, ended-track handling, worker transfer, 200 ms age rejection | Reuse lifecycle ideas; qualify actual camera settings and tighten live-input policy for this game |
| [Worker shell](/Users/singcheung/sing/game-motion-fighter/src/perception/pose.worker.ts:22) | Validates messages, performs inference, closes transferred frames | Adapt with a new hand protocol |
| [Worker loader](/Users/singcheung/sing/game-motion-fighter/src/perception/worker-loader.ts:1) and [asset preparation](/Users/singcheung/sing/game-motion-fighter/scripts/prepare-assets.mjs:9) | Version-specific MediaPipe ES-module worker adapter and local asset preparation | Re-evaluate against the selected SDK; do not assume upgrade compatibility |
| [Protocol](/Users/singcheung/sing/game-motion-fighter/src/perception/protocol.ts:3) | Versioned messages and runtime checks | Preserve pattern, replace pose-specific payload checks |
| [Headers](/Users/singcheung/sing/game-motion-fighter/public/_headers:1) | Camera policy, WASM/worker CSP, asset caching | Adapt to actual deployment origin and loader behavior |
| [Scheduler tests](/Users/singcheung/sing/game-motion-fighter/tests/unit/camera-scheduler.test.ts:14), [tracker tests](/Users/singcheung/sing/game-motion-fighter/tests/unit/camera-tracker.test.ts:58), [camera browser test](/Users/singcheung/sing/game-motion-fighter/tests/browser/camera.spec.ts:7) | Examples of lifecycle and browser coverage; camera browser test targets Chromium | Reuse test scenarios, add real HandLandmarker and supported Safari runs |
| [Application lifecycle](/Users/singcheung/sing/game-motion-fighter/src/main.ts:403) | Pauses when hidden; camera release and page-exit cleanup | Apply explicit pause/restart semantics here |

The [package manifest](/Users/singcheung/sing/game-motion-fighter/package.json:21) pins MediaPipe Tasks Vision 0.10.32 and uses Phaser. Those are reference-project facts, not a recommendation to copy its complete stack. Invader Break does not need its body-strike recognizer, MoveNet fallback, frame-motion strike corroboration, body calibration, or character combat state.

## 3. Hand tracking: documented facts and consequences

The current [Hand Landmarker Web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js) describes per-hand image landmarks, world landmarks and handedness, with 21 landmarks per hand. The maximum hand count defaults to one and must be configured to two. Detection for video is synchronous; the guide recommends a worker to avoid blocking the UI.

The [options reference](https://ai.google.dev/edge/api/mediapipe/js/tasks-vision.handlandmarkeroptions) distinguishes palm detection confidence, hand presence confidence, and bounding-box tracking overlap thresholds. These gate the pipeline; they are not per-joint quality scores. Start with documented defaults and tune from evidence.

The [result/API reference](https://ai.google.dev/edge/api/mediapipe/js/tasks-vision.handlandmarker) does not provide persistent gameplay track IDs. A handedness label probability must not become a “tracking accuracy” number. Temporal association, finite-coordinate checks, plausible geometry and sample age belong in our adapter.

Design consequences, which are proposals:

- Use image-space palm position for horizontal control; world coordinates are unnecessary.
- Retain all 21 points for skeleton feedback, but do not require finger poses.
- Track continuity across frames rather than sorting each detection array by x.
- Verify mirroring and left/right labels with controlled fixtures. The [legacy MediaPipe Hands documentation](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/hands.md) specifically discusses a selfie-image assumption; do not blindly transplant that convention to every Tasks configuration.
- Use timestamp-aware smoothing and measure the latency it adds. The [original 1€ filter project](https://gery.casiez.net/1euro/) is a primary reference for adaptive filtering.
- Freeze simulation when current control is unavailable; tracking loss must never silently become damage.

## 4. Browser feasibility and limits

| Evidence | Practical decision |
| --- | --- |
| [MediaPipe Web setup](https://ai.google.dev/edge/mediapipe/solutions/setup_web) names Chrome and Safari | Qualify current desktop Chrome and Safari first; test Edge separately; do not promise Firefox solely because it implements camera APIs |
| [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) requires secure context and permission; embedding affects permission policy | Develop on localhost; serve over HTTPS; validate production headers and actual embedded deployment if any |
| [Video frame callbacks](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback) follow video frame delivery without a hard real-time guarantee | Schedule from fresh video frames, preserve media timestamps, maintain a tested fallback |
| [ImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap) is transferable and has explicit disposal | Transfer one frame at a time and close every consumed/discarded bitmap |
| [OffscreenCanvas contexts](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/getContext) can enable worker graphics depending on support | Prove the chosen ML worker/delegate path on each target; API availability is not proof that the model loads correctly |
| [Autoplay guidance](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) explains activation restrictions | Use the initial camera bootstrap interaction to initialize audio where permitted; support blocked/muted audio gracefully |

Do not reuse Motion Fighter's GPU request as evidence of a selected GPU delegate or of HandLandmarker compatibility. Record the delegate actually initialized. CPU fallback is acceptable only if it meets the responsiveness gate.

Browser timing begins after unknown camera sensor, exposure and driver delay. A low inference time is therefore insufficient evidence of responsive controls. Measure both callback-to-result age and external physical motion-to-display latency.

Local processing is the proposed privacy architecture: the shipped game neither records nor uploads camera frames or landmarks and requests no microphone. This is not a claim that the SDK makes no network requests. Google's [MediaPipe Tasks privacy notice](https://developers.google.com/edge/mediapipe/solutions/tasks#mediapipe_tasks_privacy_notice), modified June 5, 2026, distinguishes on-device input processing from performance/utilization metrics sent to Google and describes consent responsibilities. Inspect the selected runtime's actual requests and configuration, record telemetry behavior, and resolve the player disclosure/consent or alternative-runtime choice before release. Do not assume self-hosting model files disables telemetry.

External QA latency filming is separate from the shipped game: use explicit participant consent, frame hands and display without faces where possible, retain recordings locally for at most seven days, delete after scoring, and never put footage in the repository or upload it. Ordinary qualification metrics remain aggregate. A non-recording optical timing rig is an acceptable alternative.

[Playwright's browser documentation](https://playwright.dev/docs/browsers) distinguishes its WebKit build from branded Safari. Automated WebKit coverage is useful but cannot replace an actual macOS Safari camera/model/worker qualification run.

## 5. Rendering research and the visual target

[Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) uses WebGL 2 and documents shader precompilation facilities. [WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html) can select WebGPU and fall back to WebGL 2. Its [postprocessing system](https://threejs.org/manual/en/webgpu-postprocessing.html) has a different node-based architecture. Switching renderer is therefore a scoped technical/art comparison, not a free feature toggle.

[Babylon.js](https://www.babylonjs.com/specifications/) is a credible alternative with a broad game-engine feature set. The proposed choice of Three.js is an engineering judgment: a small custom arena with simple authoritative physics benefits from a narrow rendering layer and direct art control. Revisit only if the team already has substantial Babylon expertise or the renderer spike demonstrates a material advantage.

[MDN WebGL guidance](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) supports batching draw calls, managing texture/memory budgets and reducing the back buffer when needed. It also warns that system limits differ. Our inferred production approach is instanced enemies, shared material atlases, bounded debris, selective bloom and scalable backgrounds.

Do not place expensive graphics and hand inference in separate benchmarks and add the results. They must coexist on the same device, often sharing graphics resources. The performance scene must run camera, two-hand inference, full gameplay, sound and maximum approved effects together.

## 6. Comfort and accessibility evidence

The [NICER research record](https://research.monash.edu/en/publications/nicer-a-new-and-improved-consumed-endurance-and-recovery-metric-t/) studies mid-air fatigue and recovery. It motivates measuring comfort and providing rest; it does not establish a safe duration for this game or every player.

[Microsoft input guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107) recommends alternatives for demanding input. This game's explicit hand-only requirement limits that approach. Preserve the requested control concept and state the limitation honestly; use one-hand completion, smaller-motion calibration, optional slow practice and immediate rest pauses instead of silently adding a keyboard fallback.

The [W3C flash criterion](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) concerns the combined presentation, including red flashes and flashing area. Reducing individual particle brightness is not a compliance test. Our design uses restrained local effects and requires captured worst-case sequences to be checked.

## 7. Development rules provenance

The user-specified /home/cyngn/sing/agent-dev/rules does not exist in this environment. The likely /Users/singcheung/sing/agent-dev/rules equivalent is also absent. A bounded search under /Users/singcheung/sing found no authoritative copy.

The [Motion Fighter alignment document](/Users/singcheung/sing/game-motion-fighter/docs/development-rules-alignment.md) records the same limitation and uses a provisional baseline: pinned dependencies, meaningful test-first behavior changes, independent review, local camera processing and evidence before completion claims.

A [Voice Fighter plan](/Users/singcheung/sing/game-voice-fighter/docs/superpowers/plans/2026-09-13-voice-fighter-design-and-development-plan.md) contains a secondary rule summary in section 13. It is not the original rule source. Its numeric file-size and coverage guidelines have not been promoted to binding Invader Break requirements.

No applicable AGENTS.md or CLAUDE.md was found in this repository's ancestry. At the start of this task the repository contained only README.md at commit 08af68c.

The development plan includes reconciliation of the original rules before claiming compliance. Their absence does not prevent this requested design package. Nothing in another project's historical implementation approvals authorizes coding this game now.

## 8. Uncertainty register

| Uncertainty | Evidence needed next |
| --- | --- |
| End-to-end hand latency while rendering premium effects | Real camera + render benchmark with external timing |
| Stable dual-hand identity in crossings and occlusion | Repeatable physical trials and deterministic replay of normalized observations |
| Ball catch and attack dodge compatibility | Graybox encounter review plus observed user failures |
| Three-shield drain rule is enjoyable | A/B test unified shield loss versus combo loss/formation advance |
| Two hands are attractive without being exhausting | Counterbalanced short runs and effort ratings |
| Art direction survives ordinary laptop limits | One fully produced arena running alongside inference |
| Actual development-rule conformity | Authoritative rule files and a requirement mapping |

This is a desk-research design, not a completed playtest study, performance qualification, or asset/license clearance.
