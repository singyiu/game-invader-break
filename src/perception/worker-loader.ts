/** Registers the pinned Emscripten factory through the local .mjs adapter. */
export async function registerWasmFactory(loaderPath: string): Promise<void> {
  const moduleUrl = loaderPath.replace(/\.js$/, ".mjs");
  if (moduleUrl === loaderPath)
    throw new Error("Unrecognized MediaPipe loader path.");
  const loaded: { default?: unknown } = await import(
    /* @vite-ignore */ moduleUrl
  );
  if (typeof loaded.default !== "function")
    throw new Error("Hand runtime factory is unavailable.");
  (globalThis as unknown as { ModuleFactory: unknown }).ModuleFactory =
    loaded.default;
  (globalThis as unknown as { dbg: (...args: unknown[]) => void }).dbg = (
    ...args
  ) => console.debug(...args);
}
