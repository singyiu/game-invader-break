# Endless powers update — September 17, 2026

## Delivered behavior

- Original 112 BPM synthesized background score with melody, chords, bass and percussion; quieter calibration/menu/pause arrangement, independent music/effects settings, and cleanup on disconnect, hidden tab and errors.
- Seeded collectible drops with a five-kill drought limit. Giant Ball, Wide Paddles, Multiball and piercing Fireball last 30 active-combat seconds; Shield Repair restores one shield up to three. Different powers stack, repeated pickups refresh, and timers freeze during serves, rests and hand-loss pauses.
- Shared chronological collisions for up to three balls, with stable render identities. Only losing the last ball costs a shield. Giant expiry cannot strand a missed ball offscreen.
- Endless levels with a boss every seventh level, rising ball/formation speed, durability and attack frequency, and retained speed, attack-count and telegraph limits.
- Positive score awards receive 1.5× while confirmed two-hand mode is active. Combo remains separate. Highest-level records and score records use the final one/two/mixed run category; boss rewards persist immediately. Explicit disconnect saves the run once.
- Visible power capsules/badges, four countdown chips, acquisition cues, absolute level/cycle labels and revised rest/results/landing copy. Existing automatic calibrated start, wider split paddles, larger text and disconnect flow remain.

## Review and regression evidence

Independent engine, render/audio and app reviews passed after two gameplay/records fixes:

1. Giant expiry near the bottom could shrink the drain boundary above a ball and leave it permanently offscreen. The engine now processes an already-crossed drain immediately, preserving survivor promotion and exactly one final-ball shield loss. Eight added regressions include legitimate Giant extents and simultaneous drains.
2. Intermediate score/level saves could contaminate single-hand records when a run later became mixed. Milestones now save only boss rewards; final banking writes score/level. A save/reload regression covers the mode change.

The real audio-output test first failed because the default mix was too quiet. The production gain mapping was raised and shared with the test; the threshold was retained. Chromium OfflineAudioContext measured 37 voices, RMS **0.01382897**, peak **0.10159963**, and muted RMS/peak **0/0**. This establishes rendered signal and headroom, not a listening evaluation on the player's speakers.

A browser fixture also failed to move its simulated hand out of a latched dwell region after a display safety pause. The fixture now leaves the region until the displayed filtered cursor confirms it, then holds center while preserving hand count. A forced safety-pause case reproduced the failure and passed after the fixture correction. Production pause safeguards remain intact.

The complete browser run also exposed a pre-existing camera cold-start problem: model creation reported ready before its first inference had run. Under Chromium software rendering the exact built GPU worker took 3,764.6 ms to initialize, then 4,590.1 ms for the first blank frame, followed by 118.6 ms and 119.3 ms. The ongoing 1,000 ms watchdog therefore stopped the first frame. The provider now warms a blank frame during initialization, keeping the existing watchdog and 150 ms freshness rejection. Five regression tests cover warmup ordering, GPU/CPU failure cleanup, bitmap disposal and monotonic internal timestamps without changing captured-frame metadata; independent review passed. The production test observes actual native worker responses on both connect and reconnect and saves timing diagnostics. After warmup, the full software-rendered scene returned frames continuously in roughly 267–328 ms, below the one-second watchdog but above the 150 ms freshness threshold. Those stale frames were correctly rejected. The lifecycle check therefore requires completed real inference and successful cleanup; it does not claim that software rendering meets the physical-device latency target.

## Automated checks

- Vitest: **173 tests in 31 files passed**.
- TypeScript, ESLint, Prettier and `git diff --check`: passed.
- Seven local model/runtime assets verified against SHA-256 hashes.
- Playwright: **21/21 passed** in the complete Chromium run (`npm run test:browser -- --max-failures=1`), without retries.
- Production build: passed through the browser suite's `npm run build` step and served successfully by Vite preview under the production CSP.

The browser scenarios use the real app/render/simulation with test-only injected camera observations or deterministic encounter states. The production-camera scenario uses the real camera scheduler and ML worker with a synthetic video stream. Diagnostic controls are not included in the production entry.

## Visual inspection

Inspected the actual rendered [landing screen](screenshots/landing.png) and [powered combat at 720p](screenshots/powers-720p.png). The latter shows all five pickup kinds, three Giant Fireballs, widened split paddles, four countdown chips and the 1.5× score label. Paddles and disconnect remain visible. Browser fixtures also exercise boss, reduced-effects, narrow calibration and large-text menu layouts.

## Remaining qualification

Physical hand tracking, measured latency, long-session device performance, human difficulty/fun balance and listening on real speakers remain manual qualification work. No physical camera was enabled on the user's behalf, and no public deployment was performed.
