import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

interface WorkerTiming {
  worker: number;
  type: string;
  at: number;
  frameId?: number;
  delegate?: string;
  inferenceMs?: number;
  ageMs?: number;
  roundTripMs?: number;
}

declare global {
  interface Window {
    productionWorkerTimings: WorkerTiming[];
  }
}

test.afterEach(async ({ page }, testInfo) => {
  if (page.isClosed()) return;
  const timings = await page.evaluate(() => window.productionWorkerTimings);
  const path = testInfo.outputPath("real-worker-timings.json");
  await writeFile(path, JSON.stringify(timings ?? [], null, 2));
  await testInfo.attach("real-worker-timings", {
    path,
    contentType: "application/json",
  });
});

test("production camera lifecycle receives real worker inference under same-origin CSP", async ({
  page,
}) => {
  test.setTimeout(90000);
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    // Observe the native worker without replacing inference or its messages.
    const NativeWorker = window.Worker;
    const timings: WorkerTiming[] = (window.productionWorkerTimings = []);
    let workerId = 0;
    window.Worker = class extends NativeWorker {
      private readonly observationId = ++workerId;
      private readonly postedAt = new Map<number, number>();
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener("message", ({ data }) => {
          const at = performance.now();
          const frame = data.frame;
          timings.push({
            worker: this.observationId,
            type: data.type,
            at,
            delegate: data.delegate,
            ...(frame && {
              frameId: frame.frameId,
              inferenceMs: frame.inferenceMs,
              ageMs: at - frame.capturedAt,
              roundTripMs: at - this.postedAt.get(frame.frameId)!,
            }),
          });
        });
      }
      postMessage(
        message: unknown,
        transfer: Transferable[] | StructuredSerializeOptions = [],
      ): void {
        const request = message as { type: string; frameId?: number };
        const at = performance.now();
        if (request.frameId !== undefined)
          this.postedAt.set(request.frameId, at);
        timings.push({
          worker: this.observationId,
          type: `sent-${request.type}`,
          at,
          frameId: request.frameId,
        });
        if (Array.isArray(transfer)) super.postMessage(message, transfer);
        else super.postMessage(message, transfer);
      }
      terminate(): void {
        timings.push({
          worker: this.observationId,
          type: "terminated",
          at: performance.now(),
        });
        super.terminate();
      }
    };
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => {
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 240;
          const context = canvas.getContext("2d")!;
          let running = true;
          function draw() {
            if (!running) return;
            context.fillStyle = "#777";
            context.fillRect(0, 0, 320, 240);
            requestAnimationFrame(draw);
          }
          draw();
          const stream = canvas.captureStream(24);
          const track = stream.getVideoTracks()[0],
            stop = track.stop.bind(track);
          track.stop = () => {
            running = false;
            stop();
          };
          return stream;
        },
      },
    });
  });
  const response = await page.goto("http://127.0.0.1:4176/");
  expect(response?.headers()["content-security-policy"]).toContain(
    "connect-src 'self';",
  );
  await page.getByRole("button", { name: /Enable camera/ }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "align", {
    timeout: 40000,
  });
  await expect(page.locator("#quality-label")).toHaveText(
    "ON-DEVICE · VIDEO ONLY",
  );
  // This SwiftShader fixture proves the native pipeline and camera lifecycle.
  // It does not qualify physical-camera latency: the production session still
  // rejects results older than 150 ms, covered by camera-session unit tests.
  const expectWorkerResponses = async (worker: number) => {
    await expect
      .poll(
        () =>
          page.evaluate(
            (id) =>
              window.productionWorkerTimings.filter(
                (entry) =>
                  entry.worker === id &&
                  entry.type === "hands" &&
                  Number.isFinite(entry.inferenceMs) &&
                  entry.inferenceMs! >= 0 &&
                  Number.isFinite(entry.ageMs) &&
                  entry.ageMs! >= 0 &&
                  Number.isFinite(entry.roundTripMs) &&
                  entry.roundTripMs! >= 0 &&
                  entry.roundTripMs! < 1000,
              ).length,
            worker,
          ),
        {
          message: `worker ${worker} returns real inference before the stall watchdog`,
          timeout: 10000,
        },
      )
      .toBeGreaterThanOrEqual(2);
    await expect(page.locator("#app")).toHaveAttribute("data-phase", "align");
    await expect(page.locator("#quality-label")).toHaveText(
      "ON-DEVICE · VIDEO ONLY",
    );
  };
  await expectWorkerResponses(1);
  const track = await page
    .locator("#camera-video")
    .evaluateHandle(
      (video) =>
        (
          (video as HTMLVideoElement).srcObject as MediaStream
        ).getVideoTracks()[0],
    );
  await page.getByRole("button", { name: "Disconnect camera" }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "landing");
  expect(await track.evaluate((value) => value.readyState)).toBe("ended");
  expect(
    await page
      .locator("#camera-video")
      .evaluate((video) => (video as HTMLVideoElement).srcObject),
  ).toBeNull();
  await expect(page.locator("#tracking-dock")).toBeHidden();
  await expect(
    page.getByRole("button", { name: /Enable camera/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Enable camera/ }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "align", {
    timeout: 40000,
  });
  await expectWorkerResponses(2);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "suspended");
  await expect(page.locator("#quality-label")).toHaveText("CAMERA OFF");
  expect(requests.some((url) => url.includes("hand_landmarker.task"))).toBe(
    true,
  );
  expect(requests.some((url) => url.includes(".wasm"))).toBe(true);
  expect(
    requests.filter(
      (url) =>
        !url.startsWith("http://127.0.0.1:4176/") && !url.startsWith("blob:"),
    ),
  ).toEqual([]);
  expect(errors).toEqual([]);
});
