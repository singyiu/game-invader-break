import { expect, test } from "@playwright/test";
test("real local hand model initializes in a worker and processes a blank frame without external requests", async ({
  page,
}) => {
  test.setTimeout(60000);
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const worker = new Worker(
      new URL(
        "/src/perception/hand.worker.ts?worker_file&type=module",
        location.href,
      ),
      { type: "module" },
    );
    const next = () =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Worker timeout")),
          30000,
        );
        worker.onmessage = (e) => {
          clearTimeout(timer);
          resolve(e.data);
        };
        worker.onerror = (e) => {
          clearTimeout(timer);
          reject(new Error(e.message));
        };
      });
    try {
      const readyPromise = next();
      worker.postMessage({
        type: "init",
        version: 1,
        modelUrl: location.origin + "/models/hand_landmarker.task",
        wasmUrl: location.origin + "/runtime/wasm",
      });
      const ready = await readyPromise;
      if (ready.type !== "ready") throw new Error(JSON.stringify(ready));
      const canvas = new OffscreenCanvas(320, 240);
      const c = canvas.getContext("2d")!;
      c.fillStyle = "#777";
      c.fillRect(0, 0, 320, 240);
      const bitmap = canvas.transferToImageBitmap();
      const resultPromise = next();
      worker.postMessage(
        {
          type: "frame",
          version: 1,
          frameId: 1,
          capturedAt: performance.now(),
          mediaTime: 1,
          width: 320,
          height: 240,
          bitmap,
        },
        [bitmap],
      );
      return { ready, result: await resultPromise };
    } finally {
      worker.terminate();
    }
  });
  expect(result.ready.type).toBe("ready");
  expect(result.result.type).toBe("hands");
  const frame = result.result.frame as {
    hands: unknown[];
    inferenceMs: number;
  };
  expect(frame.hands).toEqual([]);
  expect(frame.inferenceMs).toBeGreaterThanOrEqual(0);
  expect(
    requests.filter(
      (url) =>
        !url.startsWith("http://127.0.0.1:4175/") && !url.startsWith("blob:"),
    ),
  ).toEqual([]);
});
