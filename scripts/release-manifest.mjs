import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
let commit = "unavailable",
  dirty = true;
try {
  commit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  dirty =
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()
      .length > 0;
} catch {
  /* Source archive. */
}
async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(file)));
    else if (entry.name !== "build-manifest.json") {
      const bytes = await readFile(file);
      files.push({
        path: file.slice(5),
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
  return files;
}
await writeFile(
  "dist/build-manifest.json",
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      sourceCommit: commit,
      includesUncommittedImplementation: dirty,
      dependencies: pkg.dependencies,
      files: await walk("dist"),
    },
    null,
    2,
  ) + "\n",
);
console.log("Static build manifest written.");
