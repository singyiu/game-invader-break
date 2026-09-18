import { mkdir, cp, readFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const runtime = path.join(root, "node_modules/@mediapipe/tasks-vision");
const pkg = JSON.parse(
  await readFile(path.join(runtime, "package.json"), "utf8"),
);
if (pkg.version !== "0.10.32")
  throw new Error(
    "Requalify the module worker adapter before changing MediaPipe version.",
  );
const publicDir = path.join(root, "public");
await mkdir(path.join(publicDir, "runtime/wasm"), { recursive: true });
await mkdir(path.join(publicDir, "models"), { recursive: true });
await cp(path.join(runtime, "wasm"), path.join(publicDir, "runtime/wasm"), {
  recursive: true,
});
for (const name of ["vision_wasm_internal", "vision_wasm_nosimd_internal"]) {
  const source = await readFile(path.join(runtime, `wasm/${name}.js`), "utf8");
  if (!source.includes("ModuleFactory"))
    throw new Error("Unsupported upstream loader.");
  await writeFile(
    path.join(publicDir, `runtime/wasm/${name}.mjs`),
    source + "\nexport default ModuleFactory;\n",
  );
}
const model = "hand_landmarker.task";
const source =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const expected =
  "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1";
const destination = path.join(publicDir, "models", model);
let bytes;
try {
  bytes = await readFile(destination);
} catch {
  const response = await fetch(source, { signal: AbortSignal.timeout(120000) });
  if (!response.ok)
    throw new Error(`Hand model download failed: ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
}
const hash = createHash("sha256").update(bytes).digest("hex");
if (hash !== expected)
  throw new Error("Hand model SHA-256 mismatch. Refusing to install.");
await writeFile(destination + ".tmp", bytes);
await rename(destination + ".tmp", destination);
const entries = [];
for (const name of [
  "vision_wasm_internal.js",
  "vision_wasm_internal.mjs",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.mjs",
  "vision_wasm_nosimd_internal.wasm",
]) {
  const data = await readFile(path.join(publicDir, "runtime/wasm", name));
  entries.push({
    path: `runtime/wasm/${name}`,
    bytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
  });
}
entries.push({
  path: `models/${model}`,
  bytes: bytes.length,
  sha256: hash,
  source,
});
await writeFile(
  path.join(publicDir, "models/manifest.json"),
  JSON.stringify(
    {
      runtime: `@mediapipe/tasks-vision@${pkg.version}`,
      modelRevision: 1,
      entries,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Prepared same-origin runtime and ${bytes.length.toLocaleString()}-byte hand model.`,
);
