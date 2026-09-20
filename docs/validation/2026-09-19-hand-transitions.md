# Continuous one-hand / two-hand transitions

## Cause and change

The controller paused on any missing active hand, required 350 ms to confirm a split or merge, and then froze gameplay for a further 700 ms. A returning partially occluded hand could also trigger a 300 ms recovery countdown.

Mode changes now use a 150 ms capture-time confirmation window while combat keeps running. During a brief one-hand loss, the visible hand continues steering and the missing paddle retains its last position. A confirmed merge keeps the visible hand's identity and position; a split adds the second paddle without a countdown. Short detection flicker does not change modes.

All-hand loss, stale frames, and ambiguous identities still pause. Recovery timing now measures the period when all active hands were absent, so an earlier partial loss cannot create an unnecessary recovery countdown. Existing physics handles contacts introduced by the changed paddle geometry.

## Verification

- Eight controller regression cases failed against the previous implementation, then passed with the change. Coverage includes split timing, either surviving hand, continuous movement during the merge window, flicker, partial occlusion, and partial loss followed by brief total loss.
- `npm test`: 219 tests passed across 35 files.
- `npm run test:browser`: 49 passed, 1 skipped across Chromium and WebKit. The existing Chromium photographed-hand test remains skipped for its software-GPU latency limitation; the equivalent WebKit camera regression passed.
- The new browser regression uses synthetic camera observations through the real controller, application, and physics. It verifies advancing game time, ticks, and ball position during both transitions, no paused intents or countdowns, a hidden pause overlay, and unchanged survivor identity. Both browser projects passed.
- Type checking, lint, formatting, and the production build passed. The existing Three.js bundle-size warning remains.
- Independent review found no actionable defects in the controller or physics integration.

These are automated behavior checks. Physical-camera control feel has not been measured for this change. Changes are local and have not been deployed.
