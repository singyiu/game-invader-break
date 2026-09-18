# Third-party notices

| Component | Version/source | License |
| --- | --- | --- |
| Three.js | 0.180.0, npm `three` | MIT; full notice in `public/licenses/three-MIT.txt`. |
| MediaPipe Tasks Vision JS/WASM | 0.10.32, npm `@mediapipe/tasks-vision` | Apache-2.0 per pinned package metadata; full text in `public/licenses/Apache-2.0.txt`. [Source](https://github.com/google-ai-edge/mediapipe). |
| Hand Landmarker bundle | Google float16 revision 1; source/hash in generated `public/models/manifest.json` | Model-specific redistribution terms remain a public-release review item; the runtime package license is not represented as separate model-weight clearance. |

The original `.js` MediaPipe loaders are copied unchanged. Additional `.mjs` files append `export default ModuleFactory;` to enable module-worker loading, with a local factory registration hook. The model and WASM binaries are unmodified.

All runtime meshes, shaders, UI symbols and synthesized sounds were created for Invader Break. No copied Breakout or Space Invaders sprites, music, characters or logos are included. Concept images in `docs/art/concepts` were generated during design and are not embedded as gameplay graphics.

Build/test dependencies and exact transitive versions are recorded in package-lock.json. The working title has not undergone trademark clearance. Public distribution is separate from this local development delivery.
