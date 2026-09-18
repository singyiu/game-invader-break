# Invader Break — game design

Date: 2026-09-16  
Status: researched design proposal for review; no game code has been implemented. All timing, balance, performance, and staffing figures are proposed targets, not measured results.

## The game in one sentence

Defend an orbital shield line by moving your hands to ricochet a plasma ball through a living alien formation; bring a second hand into view to split your paddle and defend two places at once.

The promise is physical immediacy, satisfying precision, and escalating spectacle. The player should feel like they are conducting a defensive energy system. The core challenge is choosing where the next rebound goes while managing incoming danger.

## 1. Requirements and design decisions

| User requirement | Design response |
| --- | --- |
| Web browser game named Invader Break | Desktop/laptop browser launch proposal, landscape arena, camera required |
| Breakout with space invaders replacing bricks | Moving enemy formations take ball damage, fire projectiles, and launch diving enemies |
| Camera and ML extraction of hand joints | Dedicated MediaPipe Hand Landmarker; locally process up to two hands |
| Hand-position control only | Horizontal palm position controls the paddle; no fist, pinch, swipe, keyboard, mouse, or controller combat input |
| One hand controls one paddle | One paddle with width 18% of the arena |
| Two hands split the paddle into equal halves | Two independently controlled paddles, each 9% of the arena; shared resources |
| Three energy shields | Start every run at exactly three; no separate lives or hull meter |
| Paddle hit by invader or shot consumes one shield | Every accepted damaging body/projectile collision removes exactly one shared shield |
| Exciting, high-quality graphics | Authored 2.5D alien machines, premium materials, strong effects and audio, with explicit readability and performance gates |
| Reference Motion Fighter and development rules | Concrete reuse map and rules availability record in the research and development documents |
| Design and plan only | This package contains documents and concept images only |

**Assumptions chosen for this proposal:** desktop first; solo play; a 5–8 minute main run; one active ball; missing the ball also consumes one shield; no shield replenishment during a standard run. Ball-loss damage is an additional design recommendation, not a rule supplied by the user. If damage-only shields are preferred, the alternative is a miss that advances the enemy formation and resets the combo; do not combine both penalties.

Camera permission and, where required, audio/fullscreen activation happen through browser-owned UI. An initial click/tap may therefore be necessary before tracking exists. Once permission is granted, all game interaction can use hand position. Fullscreen is optional. This is a browser bootstrap constraint, not an alternate gameplay controller. See [camera requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) and [autoplay guidance](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).

**Not in the first release:** multiplayer, voice commands, full-body combat, online accounts, global leaderboards, procedural campaigns, inventory trees, compulsory gestures, more than one ball, VR, or phone support. These would complicate the test of whether hands, ball, and invaders feel good together.

## 2. Approaches considered

| Approach | Strength | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Sculpted 2.5D: 2D physics with 3D presentation | Readable trajectories; original materials and animation; controlled rendering workload | Requires dedicated art and technical art effort | Recommended |
| Premium 2D: illustrated sprites and shaders | Easier performance envelope and content production | Less opportunity for dimensional materials and cinematic staging | Good fallback if staffing or hardware budget is smaller |
| Fully perspective 3D arena | Large cinematic environments and camera movement | Depth ambiguity, perspective distortion, extra aiming and rendering complexity | Reject for the core mode |

The recommendation is a fixed orthographic combat camera and a separate decorative depth layer. Background cameras can move gently during downtime. Combat camera movement must never change the apparent paddle-to-ball relationship.

The graphical ambition is an AAA-quality visual target in a deliberately small arena. That is a production standard for composition, material work, animation, sound, and polish—not a claim that a browser build will match every feature or content budget of an AAA release.

## 3. Core loop and why it can be fun

1. Read a descending ball and the next enemy attack cue.
2. Move a hand sideways to intercept the ball.
3. Use the ball's contact point on the paddle to choose its outgoing angle.
4. Strike an exposed enemy, open a channel, or interrupt a charged attack.
5. Shift to a safe lane before a hostile projectile arrives.
6. Maintain accurate returns to charge Overdrive automatically.
7. Clear a formation, get a short rest, and meet a new combination of behaviors.

A well-aimed rebound should solve several problems: destroy a shooter before it fires, open a route behind armored enemies, and keep the return trajectory manageable. Random speed increases are a weak substitute for these decisions.

Two hands change spatial coverage, not the amount of shield material. They let the player prepare a catch in one lane while moving the other paddle out of danger. The tradeoff is narrower individual targets and the need to coordinate two positions. A one-hand run must remain fully viable.

Modern references support several useful directions: Shatter emphasizes active ball influence, boss variety, effects and music; Space Invaders Extreme combines enemy ordering with score and audiovisual escalation; Breakout Beyond rethinks the playfield around chains and flow. These are design precedents, not evidence that the proposed camera controls will work. See the [research brief](../../research/research-brief.md).

## 4. Arena and ball rules

The logical arena is a fixed 16:9 rectangle, independently scaled and letterboxed. A wider display does not grant more dodge space. All gameplay coordinates are normalized; visible collision edges match the simulation.

| Element | Initial tuning |
| --- | --- |
| Paddle center line | 88% of arena height from the top |
| Paddle collision thickness | 1.5% of arena height |
| Full paddle width | 18% of arena width |
| Half paddle width | 9% of arena width each |
| Ball radius | 0.9% of arena height |
| Ball speed | Start at 0.55 arena-heights/second; normal cap 0.95 |
| Outgoing angle | Contact offset maps to -60° through +60° from upward vertical |
| Near-vertical minimum | 8° away from vertical, with stable previous-side tie breaking |
| Normal enemy region | Upper 15–55% of arena; diving enemies may descend farther |
| Drain line | Below the lower visible boundary |

These are starting values for tests, not final balance. The speed cap applies to physical motion, not render frame rate.

The full paddle and each half have the same normalized aiming behavior: center contact produces a near-vertical return; edge contact produces a strong bank. Do not use hand velocity to add power or steering in the first release. Fast hand swings would reward fatigue and amplify camera noise.

The ball rebounds from side and top walls. It collides with living enemies and continues according to a swept, deterministic collision calculation. On entering the upper side of a paddle while descending, it rebounds upward. Side, underside, corner, moving-paddle, and simultaneous-contact cases need explicit tests. A decorative paddle flare is never extra reach.

An upward ball can destroy a hostile projectile on contact for a small score award. This enables satisfying interceptions, but encounters must be survivable without requiring that difficult coincidence.

Avoid stale rallies with readable enemy movement and banks. If no enemy is damaged for eight seconds, a living formation shifts laterally to open a new route and highlights an exposed target. Do not invisibly curve the ball toward an enemy. A three-second serve countdown and a deterministic initial angle introduce each wave; subsequent drains use a shorter recovery serve.

## 5. One-hand and two-hand control

### Position mapping

Use a palm anchor formed from wrist and metacarpal-base landmarks 0, 5, 9, 13, and 17. This is less dependent on finger pose than a fingertip. The remaining joints support the visible skeleton and validity checks. No finger arrangement is required.

Mirror the camera mapping exactly once so moving a hand to the player's right moves its paddle right. Calibrate and map in normalized inference-source coordinates. Apply CSS preview cropping only to skeleton/marker rendering; it must not alter paddle mapping. If a future pipeline crops frames before inference, explicitly transform those coordinates back to the documented source space. The camera preview is a small setup aid; it is not the playfield.

Calibrate one shared comfortable horizontal reach with arms low and elbows supported where possible. Map that range across the full arena for both hands. Offer a smaller-motion sensitivity preset. Use the same session calibration after loss, reacquisition or mode changes; do not bind saved gain settings to temporary hand IDs. Clamp each paddle center so the entire paddle remains in bounds. Individual per-hand ranges are deferred because reliably restoring anonymous hands to different saved profiles adds unnecessary setup complexity.

Apply timestamp-aware adaptive smoothing, then a capped response filter. Start without extrapolation. Evaluate an optional prediction horizon of at most 25 ms only if captured measurements demonstrate an improvement without overshoot. The [1€ filter](https://gery.casiez.net/1euro/) is a relevant jitter/lag tradeoff reference.

### Hand identity and crossing

Assign persistent track IDs using nearby predicted palm positions and geometric continuity. Handedness labels are weak supporting evidence, not stable identity and not an instruction to swap the control slots.

When hands cross, their paddles may cross. Preserve physical hand association through the crossing when evidence permits. If identity becomes ambiguous, briefly pause rather than teleport a paddle. Two overlapping paddles provide only the geometric union of their surfaces: no duplicate ball bounce, damage, bonus, extra width, or invisible bridge. For aiming, each touching/overlapping contiguous surface is one interval: calculate contact offset from that interval's center and width. Separated surfaces remain independent. If the ball touches two separate intervals simultaneously, select earliest contact, then nearest interval center, then lowest stable track ID as the deterministic tie break.

A static inset can distinguish the tracks using a solid-ring and a split-ring marker, so the association remains legible without relying on color. The player never needs to know whether an ML model called a hand left or right.

### Detection and mode transitions

Proposed state policy, to be tuned against real video:

Measure detection stability and absence using accepted frame capture-callback timestamps in the document clock. Measure pipeline staleness as current document monotonic time minus the latest accepted capture timestamp. Media timestamps are only for model ordering. Record arrival time on the document thread; never subtract an independent worker clock from the document clock. Presentation countdowns use document time; gameplay timers use simulation ticks and remain frozen during pauses.

| Situation | Behavior |
| --- | --- |
| First valid hand held for 300 ms | Enter setup/ready; center dwell starts a countdown |
| Second track stable for 350 ms | Announce split; freeze briefly, animate shape change, resume after a 0.7 s countdown |
| An active track is absent in a completed inference result | Enter an uncertain state: freeze simulation, preserve identity and last paddle positions, continue inference; no visible countdown for a single missed frame |
| No fresh inference result for 150 ms | Freeze simulation as stale input |
| Missing track returns within 150 ms | Preserve identity and resume immediately; no countdown or large help overlay |
| Missing track returns after 150 ms but within 350 ms | Preserve identity; resume with a 0.3 s countdown after stable reacquisition |
| One track remains after 350 ms | Reconfigure to a full paddle at that surviving hand; resume with a 0.7 s countdown |
| No tracks remain | Stay paused; show rest/reacquisition UI after 500 ms |
| Resume after both hands were removed | Require 300 ms stable tracking and a one-second center dwell |
| Repeated association ambiguity, invalid hand geometry, persistent zero-hand results, camera ended or hidden tab | Stay paused and show a recovery message based on the observed cause; do not invent an image-quality score |

The entire simulation clock, ball, damage, enemy cooldowns, and score timer freeze together. Continue rendering UI and processing the camera. Never extrapolate a lost hand into danger.

Shape changes occur only while frozen. Move new paddle colliders directly to their mapped locations without treating that reconfiguration as a damaging sweep. If expansion would enclose the ball, place it just above the surface and resume its upward serve path without a score award. Merge and split events must not change shields or enemy health.

Debounce identities and mode changes to avoid repeated transitions. Do not restart a countdown because one frame jitters. Short missing samples may create a micro-pause, so tracking observation rate alone is not enough: measure interruption duty and frequency as well. These transitions are a high-risk feel issue and need user trials before aesthetic polish.

Deliberately removing one hand is permitted to return to one-hand mode; automatic splitting means this cannot honestly be treated as forbidden input. It can simplify a catch, so describe it as an allowed tactical reconfiguration. Pauses grant no charge, enemy damage or timer-based rewards, and grace/Overdrive timers do not advance while frozen. Record active play time, wall-clock run time, transition count and whether a run used one hand, two hands or mixed control. Keep local records separated by that control history; do not compare mixed-control times with a future fixed-mode leaderboard. Test ordinary hand crossings specifically to avoid accidental tactical reconfigurations.

Hand Landmarker returns hands rather than verified people. A background person's hand can confuse selection. The launch experience is one player in the camera area, not automatic multi-person identity recognition.

## 6. Three energy shields and fair damage

Shields are a single shared integer from zero to three. Two paddles do not create two health pools.

| Event | Effect |
| --- | --- |
| Hostile projectile touches an active paddle | Minus one shield; projectile consumed |
| Diving/descending invader touches an active paddle | Minus one shield; that invader breaks apart without a kill score |
| Ball drains below the arena | Minus one shield under the proposed ball-loss rule |
| Ball hits a paddle, wall, enemy, or enemy projectile | No shield loss |
| Projectile or diver misses every paddle and exits below | No shield loss; remove it |
| Tracking pause, hand split/merge, resize, hidden tab | No shield loss |
| Shields reach zero | End the run; identify the cause and offer a quick retry |

Resolve collisions chronologically within a fixed simulation step, then apply a **shared one-second damage grace period**. The first accepted hit removes exactly one shield; simultaneous or immediately following contacts do not remove additional shields. Clear the impacting hazard and briefly make both paddle surfaces visibly protected. During grace, any additional projectile or invader body that contacts a paddle is consumed without a score award, shield loss, combo reset or extra charge. It cannot linger until grace expires. The paddle's ball-collision face remains visible and active throughout. This prevents one burst from deleting a run.

If a ball drains during an already active damage grace period, re-serve it without a second shield deduction. Do not treat an isolated ordinary drain as free. A player cannot gain score while paused or during a reconfiguration. There is no global leaderboard in scope, so anti-cheat infrastructure is unnecessary; still log transition counts locally during tests to expose exploitable scoring rules.

A miss resets the combo and Overdrive charge, even if a pre-existing damage grace period prevents an additional shield deduction. An accepted damaging projectile/body hit also resets them but otherwise leaves the current rally alive. Harmless contacts during grace do not reset them. A drain clears nearby active projectiles and starts a recovery serve if shields remain. At zero shields, game over wins over all remaining collision events.

## 7. The fairness contract: catch and dodge must coexist

A fixed-height paddle cannot always catch a ball and escape a simultaneous bullet. The encounter director must be designed around that constraint.

- Every new aimed attack shows a shape-and-audio windup of at least 650 ms initially. The lane locks when the projectile fires; it does not keep homing toward the paddle.
- No newly spawned projectile may reach the paddle line in under 900 ms in the standard mode.
- Begin with at most two simultaneous hostile projectiles and one diver. Raise density only after tests; a visual spectacle can contain many harmless fragments.
- Before committing an attack, check the predicted ball catch interval and plausible reachable paddle positions. Defer or shift attacks that cover every reachable way to catch the ball. In two-hand mode, at least one track must have a viable catch assignment.
- Revalidate in-flight attacks after every ball collision, mode change and recovery, because a new rebound can invalidate the earlier prediction. If a committed hazard leaves no reachable safe catch, visibly neutralize the minimum conflicting hazard with a brief cyan interception ring, with no score award. Never silently teleport a shot. This is an explicit Standard-mode assistance rule. Log interventions; if normal play needs more than one per wave, revise the pattern or density instead of relying on constant cancellations.
- Test the reachable envelope conservatively using measured input delay and the calibrated movement rate. A mathematical escape is insufficient if a human cannot read and execute it.
- Preserve a safe lane around a re-serve. Do not fire from newly spawned enemies until they have appeared and telegraphed.
- Critical audio conveys information already available visually. Playing muted must remain viable.

This director is not proven by a specification. The graybox must demonstrate that players perceive damage as their mistake, not a tracking or scheduling trap.

## 8. Enemies and encounter progression

| Enemy | Visual signature | Behavior and ball interaction | Interesting choice |
| --- | --- | --- | --- |
| Drone | Compact square scarab with recessed amber core | One hit; moves with the formation | Reliable target for building a chain |
| Lancer | Narrow spear with swept fins | One hit; charges a visible dive lane before descending | Interrupt the dive or route around it |
| Bastion | Broad horseshoe armor framing an exposed core | Two hits from front; one hit on exposed rear/core side | Bank a ball around its armor |
| Spitter | Three-pronged frame with a pulsing center | One hit; fires a slow diamond shot after a windup | Remove an imminent shooter |
| Conductor | Tall fork silhouette with orbiting small plates | Two hits; synchronizes nearby attacks without exceeding director caps | Prioritize it to simplify the formation |

Use three enemy types in the first playable slice: Drone, Spitter, Lancer. Bastion and Conductor arrive only after the controls and fairness rules work.

A standard run has three sectors, two formation waves each, followed by one final boss. Target ordinary waves at 35–45 seconds and the boss at 75–100 seconds; transitions, slower clears, and short rests bring most successful runs toward 5–8 minutes. Wave length is an observed result to tune, not a forced timeout.

| Sequence | Teaching and escalation | Mood |
| --- | --- | --- |
| Sector 1: Broken Orbit, waves 1–2 | Drones, then simple Spitters; learn angles and telegraphs | Blue planet rim and distant station debris |
| Sector 2: Ember Foundry, waves 3–4 | Introduce Lancers and Bastions; deliberate banks | Warm industrial vents outside the combat plane |
| Sector 3: Eclipse Gate, waves 5–6 | Conductors combine known behaviors; target priority | Monumental rings and restrained violet depth |
| Boss: The Eclipse Engine | Apply learned aiming, interruption, and dodge skills | Petaled machine occluding the planet |

Rest for approximately six seconds between sectors with a hand-position “continue” option after the first two seconds. Pause indefinitely by removing hands. Do not require arms to remain raised through a cinematic.

### Boss: The Eclipse Engine

A segmented circular machine fills the upper third of the arena. The first phase presents three individually vulnerable petals; hitting each breaks armor and opens a route. The second phase exposes the core intermittently while side emitters announce alternating lanes. The final phase combines a slow lateral core movement with familiar dive cues.

Initial health proposal: three petals at two hits each, then a core at six hits. Overdrive applies normal two-damage hits. The timing and vulnerability cycle must be tuned to keep the fight in its target duration without unavoidable attack overlap.

No arena rotation, invisible weak points, surprise bottom attacks, extra control gesture, or compulsory two-hand move. A one-handed player can defeat every phase. A short destruction sequence unfolds only after the last dangerous object is disabled.

## 9. Scoring, Overdrive, and replay

Use simple, understandable scoring: Drone 100, Spitter 150, Lancer 200, Bastion 250, Conductor 300, hostile projectile interception 25. Boss components and victory have explicit fixed rewards. Award a kill once.

The combo multiplier starts at 1× and increases by 0.25× after each three enemy kills without damage or a drain, capped at 3×. Reset on accepted shield damage or any ball drain. Time alone does not drain the multiplier; unnecessary urgency would encourage tiring movements.

**Precision returns:** contact in the central 20% of the active paddle adds one Overdrive charge. Five precision returns activate Overdrive for six seconds automatically. During Overdrive the ball deals two damage, has a tighter bright core and a musical accent, and can penetrate one destroyed enemy per fixed step before normal collision processing continues. It does not become faster. No charge is earned while Overdrive is active; the meter resets at its end.

Two-hand alternating catches may receive a small, separately labeled style award in a later tuning pass, but no necessary power advantage. Ship the same base score system for one or two hands first.

Replay motivation comes from cleaner aim, targeting order, intact-shield completion, and seeded local challenge runs. Persist best score, best clear time, settings, and cosmetic unlocks locally. Unlock alternate material finishes and sound accents—not upgrades that make tracking performance or survival paywalled. Endless mode can reuse proven formations after the main mode passes playtests.

## 10. Onboarding and hand-only interface

The route is short: camera explanation → permission → palm alignment and comfortable reach → safe bounce exercise → first wave.

1. Explain local camera use and show an explicit “Enable camera” bootstrap control.
2. Show the mirrored view with the 21-joint skeleton. Ask the player to place one relaxed hand in view; no fixed pose.
3. Let the player hold a comfortable left and right position to establish reach. Confirm visibly before saving.
4. Demonstrate a slow ball with no damage. Teach three successful catches and the effect of an edge hit.
5. Invite a second hand; show the split and check that both hands can comfortably use the shared reach range. Offer shared-range recalibration if needed, without requiring two-hand play.
6. Start a real wave. Teach one telegraphed projectile before introducing combinations.

After setup, menus use large horizontally arranged choices. A palm marker moves along the row; a visible one-second dwell ring selects an option. Selection requires leaving the old dwell region before another choice can fire. Put retry, settings, and exit on clear separate screens; avoid tiny camera-driven buttons.

Removing all hands pauses. Returning hands does not instantly unpause into a bullet. Camera errors show specific steps for permission denial, missing device, device busy, insecure origin, and model download failure. No-camera users can view a noninteractive attract sequence but cannot start a fake “hand-controlled” run.

## 11. Art, audio, and comfort

See the [art direction](../../art/art-direction.md) and [gameplay concept](../../art/concepts/invader-break-gameplay-target.png).

The visual language is dark ceramic alien machinery against titanium-and-cyan defense technology. The ball has the highest sustained luminance, hostile projectiles use diamond silhouettes, and enemy vulnerabilities pulse locally. Backgrounds remain lower contrast and less saturated than gameplay.

Sound turns reliable input into satisfaction: a crisp tonal paddle return, weighty armor break, distinct shot windup, and a layered shield fracture. Music adds stems as a formation thins and a boss escalates. It must not force ball timing onto a beat. Duck music under danger cues; provide independent music/effects volume and a quiet preset.

Offer seated play, shared sensitivity and smaller-motion presets, reduced effects, zero camera shake, muted-safe cues, scalable HUD, left/right color-independent markers, and one-hand completion. Reduced effects disables decorative particles, background drift, bright flares, and shake; it never removes telegraphs or ball contrast.

This remains a motion-dependent game and will not serve every motor-access need. Do not claim universal accessibility. Avoid large full-screen flashes in the default presentation, and test combined effects against the [W3C flash criteria](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html), not merely individual effect files.

## 12. Technical shape

Recommended provisional stack: TypeScript, Vite, MediaPipe Tasks Vision Hand Landmarker, Three.js with a WebGL 2 baseline, browser Web Audio, Vitest, and Playwright. Pin exact compatible versions after the first feasibility comparison; copying Motion Fighter's older version choices is not a validation step.

Data flow:

Camera stream → fresh-frame scheduler → inference worker → hand association and smoothing → normalized paddle intents → fixed-step game simulation → render snapshots, sound events, and HUD.

The renderer never owns health or collisions. The ML provider never directly mutates game state. The deterministic simulation knows only normalized input, not video frames. A seeded encounter director emits proposed attacks through the fairness checker.

The shipped game must not record or upload camera frames or hand landmarks. Separately, the current [MediaPipe privacy notice](https://developers.google.com/edge/mediapipe/solutions/tasks#mediapipe_tasks_privacy_notice) describes performance/utilization telemetry. Verify the pinned runtime's behavior and resolve disclosure/consent or an alternative runtime before making broader privacy claims. Self-hosted model files alone do not settle this.

Run rendering toward 60 frames/second, inference toward 24–30 results/second, and simulation at a fixed 120 steps/second. These loops have independent schedules; one inference request may be in flight and stale results are dropped. Fixed-step overload is handled by pausing after a bounded catch-up interval, not letting a backgrounded tab simulate seconds of unavoidable damage.

Three.js documents WebGL 2 in its [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) and a WebGPU renderer with a WebGL 2 fallback in its [WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html). The latter is an optional later comparison, not a launch dependency. Test both graphics and ML together: they may contend for the same GPU.

## 13. Evidence required before calling the game successful

| Hypothesis or quality target | Proposed validation |
| --- | --- |
| Hand control feels immediate | Externally film hand and display; target median motion-to-photon latency ≤100 ms and p95 ≤150 ms on qualified hardware |
| Stationary palms do not visibly shake paddles | Target stationary p95 position deviation <0.5% of arena width; record median/centering bias separately |
| Tracking is dependable | Target valid observations ≥97% of intended active time; additionally require tracking micro-pauses to occupy <1% of active time and no more than two interruptions longer than 150 ms in a normal ten-minute session; report conditions and subgroup results |
| Crossings preserve control | Across 50 ordinary non-occluded crossings: zero identity swaps, zero uncommanded jumps >3% arena width, zero unintended mode changes, and at most two ambiguity pauses, each ≤500 ms; deliberate occlusion trials are reported separately |
| Two hands feel useful | Counterbalanced within-person trial of one vs two hands; compare control clarity, optional use, hit rate, and fatigue |
| Onboarding is understandable | At least 8 of 10 first-time pilot participants complete setup and make five returns within two minutes |
| The game feels fair | At least 8 of 10 can identify the cause of recent damage; inspect every tracking-related loss |
| Runs invite another attempt | Observe voluntary retry choice; initially aim for ≥7 of 10 without prompting |
| Comfortable short sessions | Ask for 0–10 effort ratings before/after; target median increase ≤2, and investigate every discomfort report |
| Performance supports the art | Frame intervals p95 ≤18 ms and p99 ≤33 ms in a 10-minute representative stress run on the chosen baseline device |
| No systematic simulation bugs | Seeded repeatability; no tunneling, duplicate collision rewards, or health changes during tracking pause |

These pilot targets are product decisions, not population-level research findings. A small pilot cannot establish broad tracking accuracy or accessibility. Test different skin tones, hand sizes, camera positions, lighting, glasses/background conditions where relevant, and limited comfortable reach; document failures rather than averaging them away. Longer qualification follows the pilot.

**Go/no-go order:** responsive hands → fair, fun graybox → visually complete vertical slice → enough polished content → supported-device qualification. If the hands fail, defer expensive asset production. If two-hand mode is tiring, retain optional splitting and improve calibration/transitions before adding rewards.

## 14. Decisions to review

The brief fixes hand-only control, splitting, enemy damage, and three shields. The proposed defaults still worth reviewing are: desktop-first launch; ball drain costing one shield; the 5–8 minute session; the sculpted 2.5D direction; and the production staffing/budget needed to achieve the visual target.

The [development plan](../plans/2026-09-16-invader-break-development-plan.md) turns this proposal into gated work. No implementation or release conformance is implied by this document.
