# Invader Break — endless powers update

The requested update adds audible background music, falling power pickups, endless increasing difficulty and a 1.5× two-hand scoring bonus. Existing hand-only combat, automatic start after calibration, large typography and camera disconnect remain.

## Rules

- Destroyed enemies can drop a collectible capsule. Drops are seeded: 22% chance, with a guaranteed drop after five kills without a drop, at most six falling items. No random drops in the test-only practice simulation. All five kinds are available; avoid long sequences of only one kind by cycling a shuffled/seeded selection or equivalent deterministic selection. Capsules fall at 14 arena units/second and activate on a swept paddle contact; missing one has no penalty.
- Giant Ball multiplies the radius by 1.8; Wide Paddles multiplies each current paddle width by 1.5; Multiball produces up to three independently simulated balls; Fireball destroys enemies it touches, including armor, without bouncing off them. These four powers last 30 seconds of active combat, pause during camera/hand loss, serve countdowns and sector rests, stack with different kinds, and refresh (not add) time on repeated catches.
- Shield Repair restores one shield immediately, capped at three. It has no duration. Distinct colors and simple icon/letter labels distinguish pickups from hostile diamond shots. A HUD shows active powers and seconds remaining.
- Losing one multiball does not cost a shield while another ball remains. Losing the last costs one shield and reserves a ball. The multiball effect remains timed; re-serving can restore its three balls. Expiry removes extra balls without damage. All balls share other powers and use one chronological fixed-step collision pass so enemies, points and shield hits cannot duplicate.
- Width/radius changes clamp safely to arena bounds, resolve enclosed-ball contacts, and neutralize only hazards newly enclosed by an expanding paddle. Timed powers and uncollected pickups survive level transitions; rest freezes their movement and duration.
- Levels are absolute increasing integers in `GameState.wave`: six formation levels followed by an Eclipse Engine boss, repeating forever. `sector` remains 1–3 for the existing art. Defeating a boss awards the boss bonus, records a clear, rests for six seconds, then starts the next level; it never ends the run. Formation selection repeats with cycle variations and stronger invader composition/durability.
- Difficulty increases gradually: base ball speed rises from 55 by 1.2 per level, capped at 85; rally speed stays capped at 95. Formation motion rises gradually to 1.8×. Enemy durability gains one hit per two cycles. Attack cadence grows faster with a safe lower bound; retain at most two hostile shots and one diver, 650ms telegraphs and at least 900ms projectile flight. The catch-fairness director must account for multiple balls and preserve at least one reachable safe catch.
- Every positive score award (kills, interceptions, boss-clear bonus) gets 1.5× while the confirmed active mode has two paddles. Multiply after the existing combo factor and round to a whole point. One-hand awards are unchanged; switching modes never rescales old points. HUD makes the bonus visible.

## Music and integration

Use original procedural Web Audio music, no downloaded/copyrighted samples or new dependencies. A clearly audible space-arcade arrangement includes midrange melody, bass, chords and percussion, with a gentle calibration/menu arrangement and stronger combat beat. Enable only after the existing user camera/audio click. Respect the music setting, keep effects separate, duck on damage/pauses, stop on disconnect or tab suspension, avoid scheduling bursts after long gaps, and restart cleanly. New pickup/activation cues must be distinguishable from damage.

Keep the primary `ball` for compatibility, with stable numeric IDs and an `extraBalls` collection. Add remaining-time power fields, pickups, drop counters and boss-clear counters to game state. The renderer displays every live ball and pickup, owns trail cleanup, preserves collision silhouettes and reduced-effects behavior. Records include highest level; boss achievements unlock existing cosmetics even though a run now ends only on defeat/exit.

## Validation

Test seeded drop distribution, swept catches, expiry/refresh/stacking and pause semantics, last-ball shield loss, piercing chronology and duplicate prevention, powered widths and damage safety, unbounded level selection, scaled/capped difficulty, all scoring paths and mode changes. Verify music produces actual Web Audio output, volume zero mutes it, and disconnect stops it. Browser checks cover real app integration and power HUD, score bonus, endless progression, layout and all existing camera flows. Synthetic fixtures are labeled and never bundled into production. Real-camera device qualification remains separate.

## Camera startup correction found in validation

The production GPU worker's first inference took 4,590 ms under Chromium's software renderer, compared with about 119 ms for subsequent frames. Warm the model with a blank frame during bounded initialization before reporting ready. Preserve the 1,000 ms ongoing worker watchdog, 150 ms freshness rejection, frame metadata, cancellation and resource cleanup. Keep internal video timestamps monotonic across warmup and the first real frame. This corrects a measured startup failure; it is not a physical-camera performance claim.
