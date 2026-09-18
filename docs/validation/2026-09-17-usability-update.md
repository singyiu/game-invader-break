# September 17 usability update

This update implements the four requested improvements and supersedes the corresponding parts of the original design proposal.

## Player-facing changes

- Completing left/right reach calibration starts a fresh standard run automatically, using the existing launch countdown. Practice and the pre-run choice screens are removed. New players use comfortable reach, automatic one-/two-hand switching, 30% music and 65% effects; saved preferences and reduced-motion preferences remain respected. Settings are still available after a run.
- Each two-hand paddle is 13.5 arena units wide, up from 9 (+50%). The single-hand paddle remains 18. Input clamping, live collisions, attack fairness, paused previews and attract graphics share the same dimensions.
- Body copy and menu titles are generally 16px, descriptions 12px, and HUD labels 11px. The optional Large setting increases these further. Layout spacing and wrapping accommodate the larger text.
- A pointer-accessible **Disconnect camera** button in the bottom tracking panel stops the camera and audio, cancels pending startup, clears the current run, and returns to the initial landing screen. It works during loading, calibration, play, hand-loss pauses and results. Gameplay remains hand-controlled.

## Verification scope

The changed behavior is covered by unit and browser checks: direct calibration-to-play, split-paddle edge catches and arena clamping, overlap and attack fairness, settings/retry, hand loss/recovery, disconnect/reconnect, delayed audio-start cancellation, stopped real MediaStream tracks and cleared video attachment, and responsive layouts. Camera observations in gameplay tests are synthetic; the production camera/worker test uses a canvas video stream with the real scheduler and hand model.

Screenshots in [screenshots](screenshots/README.md) are refreshed for this update. Independent review found no blocking lifecycle or paddle-width issues. Layout checks exposed and corrected narrow-screen disconnect placement and Large-text victory-menu clipping. The layout regression test checks all 16 combinations of two viewport sizes, two text sizes, and four menu states; the entire hand-selection area and disconnect button remain visible.

Physical-camera accuracy, comfort and hardware performance remain subject to the existing [qualification work](README.md#not-established-by-this-delivery).

## Final results

- `npm test`: 121 tests passed across 25 files.
- `npm run test:browser`: all 16 scenarios passed in one final full run (2 minutes).
- `npm run format:check`, `npm run lint`, `npm run typecheck`, and `git diff --check`: passed.
- `npm run assets:verify`: seven model/runtime assets verified against SHA-256.
- `npm run build`: passed, including TypeScript checks and the static release manifest.

Regression checks were observed failing before their fixes: direct launch previously stopped at the ready screen; the disconnect button was absent; split-paddle edge/collision checks failed at the old width; and the Large-text victory selection area exceeded the visible overlay.
