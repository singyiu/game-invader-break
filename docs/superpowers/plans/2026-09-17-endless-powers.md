# Endless Powers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship background music, five collectible powers, infinite levels and two-hand bonus scoring.
**Architecture:** Extend the deterministic simulation with a small powers module and level-difficulty helpers. Preserve primary-ball compatibility, add extra balls to the shared chronological collision pass, and keep Web Audio/render presentation separate. Integrate HUD and records in the app.
**Tech Stack:** Existing TypeScript, Three.js, Web Audio, Vitest and Playwright; no new dependencies.
**Spec:** `docs/superpowers/specs/2026-09-17-endless-powers-design.md`

## Global Constraints

- Hand-only combat; preserve camera disconnect, automatic calibrated start and all privacy/suspension guarantees.
- Four timed powers last 30 active-combat seconds; repair adds one shield, maximum three.
- Two-hand positive score awards multiply by 1.5 after combo and round to an integer.
- Ball speed caps, two-shot/one-diver caps, 650ms windups and >=900ms flights remain enforced.
- No new dependencies, third-party audio, production test controls or commits/pushes. `.git` is read-only.
- Tasks 1–3 own disjoint files; their shared contract below is fixed before parallel work. Root owns Task 4 and browser orchestration.

## Shared interfaces (Task 1 owns definitions)

```ts
// Add to shared/contracts.ts; all existing fields remain.
export type PowerKind = 'giant' | 'wide' | 'multi' | 'fire' | 'shield';
export type TimedPowerKind = Exclude<PowerKind, 'shield'>;
export interface PowerPickup { id: number; kind: PowerKind; x: number; y: number; radius: number; vy: number }
// Ball gains required `id: number` (primary starts at 0).
// GameState gains:
// extraBalls: Ball[];
// pickups: PowerPickup[];
// powers: Record<TimedPowerKind, number>; // remaining combat seconds
// killsSinceDrop: number; powerDropCount: number;
// bossesDefeated: number; perfectBossClears: number;
// GameEventKind gains 'power-drop' | 'power-collected' | 'power-expired' | 'cycle-clear'.
// Power events use cause=PowerKind; collection value=30 (or resulting shield count).
// cycle-clear value=awarded bonus; wave remains cleared boss level during rest.
// src/game/powers.ts exports:
// activatePower(s: GameState, kind: PowerKind): void
// paddleWidthForMode(s: GameState, mode: 1 | 2): number
// src/game/difficulty.ts exports difficultyForLevel(level: number), cycleForLevel(level:number):number
// difficulty result: { ballSpeed:number; formationSpeed:number; extraHp:number; attackIntervalScale:number }
// src/game/scoring.ts exports handScoreMultiplier(s:GameState):number
```

### Task 1: Simulation, pickups, endless levels, score bonus

**Files:** `src/shared/contracts.ts`, `src/game/*.ts`, `src/content/{tuning,sectors}.ts`; simulation/input-dependent unit fixtures under `tests/unit/` only. Do not edit app/UI/render/audio/browser files. Existing input controller base clamp is compatible with a wider final physics clamp; tell root if not.

**Interfaces:** Implement the shared interfaces above; existing `createGame`, `stepGame`, `continueSector`, `startWave` stay callable. Keep game status `won` in the type for historical fixtures but ordinary play continues after bosses.

- [x] Add focused failing tests for each behavior. Hand-derived examples:
```ts
activatePower(s, 'shield'); expect(s.shields).toBe(3); // s.shields initially2
activatePower(s, 'multi'); expect(s.extraBalls).toHaveLength(2);
// After a live .05s step, powers.fire is29.95; paused/rest/serve leaves30.
// A drone kill is150 with two paddles and100 with one at combo0.
// Final-boss clear at level7 enters rest, then level8; startWave(s,1001) remains valid.
```
- [x] Observe expected red failures, then implement bounded powers/difficulty modules and chronological multi-ball collisions. Limit three balls/six pickups, stable IDs, last-ball drain only, preserve non-powered physics and damage grace.
- [x] Run covering unit suites and existing simulation tests. Update obsolete finite-victory assertions to endless progression; retain regression coverage for one-hand physics and boss awards. Ensure record counters increment once.
- [x] Write `.superpowers/sdd/2026-09-17-endless-powers/engine-report.md` with requirements, files, red/green commands/results and concerns. No commits.

### Task 2: Multi-ball and collectible visuals

**Files:** `src/render/arena-renderer.ts`, `src/render/entity-views.ts`, optional `src/render/power-pickup-view.ts`, `src/render/effects.ts`, rendering unit tests only. No shared contracts/app/UI/CSS changes.

**Interfaces:** Consume all primary+extra balls by stable ID and `state.pickups`, with `state.powers.fire >0` for fire visuals and radius from the ball. `BallView.update` may add an optional fire parameter; root/other callers retain compatibility.

- [x] Read renderer ownership/disposal and write failing focused tests for geometry/visual state that exercise actual Three objects (e.g. radius scale, independent fire material, pickup kinds).
- [x] Implement distinct collectible capsule silhouettes with recognizable badges/colors (G/W/M/F/+), shield green, giant violet, wide cyan, multi blue, fire orange. Use procedural meshes/canvas texture if needed; preserve hostile diamonds. Map ball views by ID; remove/dispose every orphan and trail; no shared-material recolor leakage.
- [x] Respect reduced effects, low budgets, stable arena geometry and existing paddle finishes. Use literal current `wave` only via bossPhase/sector where needed; no finite-level assumptions.
- [x] Run focused renderer tests and write `.superpowers/sdd/2026-09-17-endless-powers/render-report.md`. Root handles visual browser fixtures and screenshots.

### Task 3: Audible background soundtrack

**Files:** `src/audio/audio-director.ts`, new `src/audio/music-score.ts` if useful, audio unit tests, optionally `tests/browser/audio.spec.ts` (do not start browser servers; root runs it).

**Interfaces:** Preserve `new AudioDirector()`, `activate()`, `applySettings`, `update(game,events,active)`, `suspend()`, `dispose()`. `active=false` with a running context means quiet menu/pause music, not disconnected; suspended context produces no sound. App suspends on disconnect/hidden/error. React to new power/cycle events via shared event kinds.

- [x] Build a deterministic original synth arrangement with midrange melody, bass, chord/pad and percussion. At default music0.3 it must be audible; keep headroom and effects separate. Use a short lookahead and bounded scheduling, no bursts after pauses.
- [x] Test the sequencer's actual timing/notes, muted gain behavior and lifecycle. For browser proof use real Web Audio nodes/analyser or OfflineAudioContext; inspect RMS/energy instead of merely asserting a function was called.
- [x] Implement 30-second power acquisition cues and celebratory cycle clear cue; respect all existing volume controls and reduced active intensity. Close or mute scheduled nodes on suspend/dispose, restart without leaking voices.
- [x] Run focused tests and write `.superpowers/sdd/2026-09-17-endless-powers/audio-report.md` with acoustic-output validation and any root browser steps. No external audio assets.

### Task 4: App, HUD, records, integration and review

**Files:** `src/app/application.ts`, `src/ui/{shell,overlay}.ts`, CSS, `src/storage/local-profile.ts`, app/storage unit tests, browser fixtures/specs, README and validation evidence.

**Interfaces:** Consume `paddleWidthForMode` for paused/preview geometry. Show absolute `wave` as Level and cycle via `cycleForLevel`; boss labels use bossPhase. Show powers remaining and two-hand bonus independently of combo. Store highest level and unlock cosmetics from boss counters without pretending endless run defeat is a victory.

- [x] Write failing profile/HUD integration checks. Test old profiles loading with a sensible highest-level fallback; one/two/mixed records remain separated.
- [x] Implement readable power HUD/legend and level labels, timers frozen with gameplay, acquisition notices, cycle-clear rest text, highest-level results and saved records. Suspend audio on errors and retain start/exit flow.
- [x] Extend browser fixtures for synthetic collectible catches, actual multi-ball gameplay, 1.5× score and boss→next-cycle progression; verify power expiry in the fixed-step unit suite. Keep diagnostic injection in tests. Add screenshots and inspect laptop/narrow layouts and reduced effects.
- [x] Independently review all task diffs against the spec, fix important findings with original owners, then run `npm test`, `npm run test:browser`, format/lint/typecheck/assets/build and `git diff --check`.
- [x] Update README and validation evidence with actual checks/limits; deliver the updated local game. No public deployment or camera activation on the user's behalf.

### Validation follow-up: cold inference startup

- [x] Add provider regression coverage and warm one blank frame before initialization resolves, including bitmap cleanup, failed GPU fallback cleanup and monotonic internal timestamps without changing captured-frame metadata.
- [x] Independently review the fix; rerun the real production camera test with completed native inference responses required on initial connect and reconnect; preserve stale-frame rejection without treating software-renderer timing as a physical-device performance qualification. Keep existing ongoing watchdog/freshness limits.

Evidence: exact built GPU worker initialization 3,764.6 ms; cold inference 4,590.1 ms; subsequent 118.6 ms and 119.3 ms. The original 1,000 ms watchdog correctly stopped the worker before its cold first response. Both 1440px and 720px production checks reproduced it.

Final evidence: 173 unit/integration tests across 31 files and all 21 browser checks passed, with typecheck, ESLint, Prettier, asset verification, production build and whitespace checks. See [validation report](../../validation/2026-09-17-endless-powers.md) for measured limits and review fixes.
