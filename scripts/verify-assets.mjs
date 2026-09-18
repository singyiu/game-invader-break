import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../public/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("models/manifest.json", root), "utf8"),
);
if (
  manifest.runtime !== "@mediapipe/tasks-vision@0.10.32" ||
  manifest.entries.length !== 7
)
  throw new Error("Unexpected asset manifest.");
for (const entry of manifest.entries) {
  const bytes = await readFile(new URL(entry.path, root));
  if (
    bytes.length !== entry.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== entry.sha256
  )
    throw new Error(`Asset mismatch: ${entry.path}`);
}
console.log(
  `Verified ${manifest.entries.length} model/runtime assets with SHA-256.`,
);
