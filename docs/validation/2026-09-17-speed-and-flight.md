# Five-level speed increases and patterned flights

The subsequent [return-flight update](2026-09-17-return-flight.md) replaces missed divers exiting the arena with a reverse flight back to formation.

Implemented against baseline `9b3483f` on September 17, 2026.

## Behavior

- Speed advances after each completed block of five levels: the first increase is level 6, followed by 11, 16, and so on. Ball launch speed, formation movement, projectile speed, dive speed and attack cadence share the same tier. Practice remains at its original speed.
- Growth approaches the existing ball/formation/cadence limits gradually. With `tier = floor((level - 1) / 5)` and `pressure = tier / (tier + 4)`, ball launch speeds are 55 for levels 1–5, 61 for 6–10, 65 for 11–15, and about 67.86 for 16–20. Rally acceleration still respects the existing 95-unit maximum. Enemy HP progression remains tied to invasion cycles.
- From level 3, lancers and lingering drones can fly a swoop or weave. A flight is fixed before its 650 ms warning, remains inside the arena, and preserves at least 900 ms of travel before paddle contact. Only one flight can be planned or active at once.
- Amber dashed paths and endpoint markers use the same trajectory sampler as simulation. They remain visible under reduced effects and fade during the attack. The warning shortens as the invader advances.
- Ball and paddle collisions account for the invader’s horizontal and vertical motion. Paddle impact removes the invader, triggers its destruction effect and consumes one shield through the existing damage/grace rules. It awards no score or power drop. The ball can destroy it first.
- Attack checks reserve the flight’s horizontal corridor while using its actual vertical collision extent. Flight timing freezes with hand-tracking pauses and during recovery serves.

## Verification

- `npm test`: **203 passed**, 35 files. Coverage includes tier boundaries, multiball launch speed, actual accelerated shots, bounded paths, windup, flight limits, safe catches, horizontal impacts, one/two-hand shields, shared damage grace, final-shield loss, ball interception, pause/serve freezing, and level progression after a missed diver.
- A 30-second deterministic rally exercises real attack selection and confirms that patterned dives launch identically across render batch sizes.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `git diff --check`: passed.
- Flight-warning Chromium fixture: **1 passed**, with normal and reduced-effects rendering. [Inspected 720p preview](screenshots/flights-720p.png).
- Camera/session, powers and production Chromium checks: **6 passed**. These cover calibration into automatic play, split mode, disconnect/reconnect, page hiding, power collection/pausing, score bonuses, boss continuation, and native ML-worker inference under the production content-security policy.
- Production build passed as part of browser-server startup. The existing large Three.js bundle warning remains nonfatal.
- Independent engine and renderer review: no remaining actionable findings.

Browser controls use synthetic observations or a generated video stream. This update does not establish physical-camera latency or human difficulty balance. No deployment was performed.
