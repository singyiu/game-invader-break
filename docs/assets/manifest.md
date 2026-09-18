# Runtime asset provenance

- **Enemy fleet, paddle and ball:** original procedural Three.js meshes/materials in `src/render/entity-views.ts`. Mesh pivots follow the authoritative 100×100 arena. Decorative fins and glows confer no collision reach.
- **Eclipse planet, ring, orbital machinery, stars and debris:** original procedural geometry/shaders in `src/render/arena-environment.ts`. No external photographs or texture packs.
- **Impact effects:** bounded instanced effects in `src/render/effects.ts`.
- **Audio:** original Web Audio oscillator synthesis in `src/audio/audio-director.ts`; separate music/effects gains. No downloaded/commercial samples.
- **UI symbols/favicon:** original inline SVG; local system fonts. No third-party font request.
- **ML:** Google's Hand Landmarker float16 revision1, unchanged. Model/runtime integrity in generated `public/models/manifest.json`; regenerate with `npm run assets:prepare`, verify with `npm run assets:verify`.
- **Design concepts:** generated flattened images retained under docs/art/concepts, not runtime assets or claimed screenshots.

See [third-party notices](../../THIRD_PARTY_NOTICES.md). Runtime model-license review and working-title clearance remain public-release tasks.
