# Invader return flights

Date: 2026-09-17

## Behavior

- A surviving patterned invader reverses at paddle height and retraces its original swoop or weave at the same speed. At its launch position it resumes formation movement, keeping its identity and health. A lancer cannot begin another attack until it has resumed formation movement.
- Both legs occupy the single active flight slot. Returning does not award points, count as a kill, drop a power, or clear the level.
- Ball collisions and paddle impacts remain active on both legs. Paddle contact destroys the invader and follows the existing shield/grace rules.
- Turnaround and arrival are explicit simulation events so collision sweeps do not skip a contact across the reversal. The return freezes during tracking pauses and recovery serves.
- Amber paths show the remaining outbound route to the paddle, then the remaining return route to the launch position. They remain visible with reduced effects.

## Verification

- `npm test`: **213 tests passed**, 35 files. New coverage checks exact reverse geometry for both patterns, survival of the final invader, formation re-entry even when the attack timer expires on arrival, return pause/resume, return-leg ball and paddle collisions, a collision inside the turnaround tick, and safe-catch handling after a returning invader clears the paddle.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `git diff --check`: passed.
- Chromium camera-session checks: **2 passed**, covering automatic play after calibration, split hands, disconnect, and page-hide cleanup.
- Chromium flight-rendering check: **1 passed**, covering outbound and return paths with reduced effects and no browser errors. The return comparison uses the same positions, phases, and effects setting with and without flight geometry.
- `npm run build`: passed after the final scheduler fix. The existing bundle-size warning remains nonfatal.
- Independent review found an arrival-frame reattack edge case; the regression reproduced it, the scheduler fix passed, and review confirmed the issue closed.
- [Inspected return-flight preview](screenshots/return-flight-720p.png). This synthetic fixture displays both patterns together for inspection; gameplay still permits one active flight at a time.

These checks use deterministic simulation and synthetic browser fixtures; they do not establish physical-camera or human play-balance qualification. Changes remain local and were not deployed.
