# Candidate screenshots

- `landing.png`: actual application landing screen at a laptop viewport.
- `combat-720p.png`, `boss-720p.png`, `reduced-720p.png`: named synthetic render states at 1280×720. These instantiate the production renderer and content under a test-only entry substitution; they are not photographs or evidence of an actual player run.

- `setup-narrow.png`: actual calibration UI at 800×850 with a synthetic camera source emitting no hands, showing the larger text and camera exit control.

The fixtures live in `tests/browser/visual-states.spec.ts`. The production entry contains no synthetic controls. Visual screenshots support composition review; they do not establish frame-rate, tracking, comfort or full-run quality gates.
