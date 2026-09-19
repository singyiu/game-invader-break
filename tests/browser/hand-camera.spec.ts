import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

interface SyntheticCameraState {
  handResponses: number;
  workerErrors: string[];
  delegate: string;
  pan: "left" | "center" | "right";
}

declare global {
  interface Window {
    syntheticCamera: {
      setPan(pan: "left" | "center" | "right"): void;
      state: SyntheticCameraState;
    };
  }
}

const imageData = `data:image/jpeg;base64,${(
  await readFile(new URL("../fixtures/woman_hands.jpg", import.meta.url))
).toString("base64")}`;

test("accepts a known hand through the real camera pipeline with Safari timestamps", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName === "chromium",
    "Safari timestamp regression runs in WebKit; this Chromium project uses SwiftShader and drops the photo frames as older than the 150 ms production age bound.",
  );
  test.setTimeout(120000);
  await page.addInitScript(
    ({ imageData: source }) => {
      const state: SyntheticCameraState = {
        handResponses: 0,
        workerErrors: [],
        delegate: "pending",
        pan: "center",
      };
      window.syntheticCamera = {
        state,
        setPan: (pan) => {
          state.pan = pan;
        },
      };

      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        constructor(url: string | URL, options?: WorkerOptions) {
          super(url, options);
          this.addEventListener("message", ({ data }) => {
            if (data?.type === "ready") state.delegate = data.delegate;
            else if (data?.type === "hands") state.handResponses += 1;
            else if (data?.type === "error")
              state.workerErrors.push(data.message);
          });
        }
      };

      const nativeRequestVideoFrameCallback =
        HTMLVideoElement.prototype.requestVideoFrameCallback;
      if (nativeRequestVideoFrameCallback) {
        HTMLVideoElement.prototype.requestVideoFrameCallback = function (
          callback,
        ) {
          return nativeRequestVideoFrameCallback.call(this, (now, metadata) =>
            callback(now, { ...metadata, mediaTime: 0 }),
          );
        };
      }

      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async (): Promise<MediaStream> => {
            const image = new Image();
            image.src = source;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = 320;
            canvas.height = 240;
            const context = canvas.getContext("2d");
            if (!context)
              throw new Error("Synthetic camera canvas unavailable.");
            let running = true;
            const draw = (): void => {
              if (!running) return;
              context.clearRect(0, 0, canvas.width, canvas.height);
              const destinationX =
                state.pan === "right" ? 105 : state.pan === "center" ? 50 : 0;
              context.drawImage(
                image,
                150,
                270,
                360,
                240,
                destinationX,
                60,
                180,
                120,
              );
              requestAnimationFrame(draw);
            };
            draw();
            const stream = canvas.captureStream(24);
            for (const track of stream.getVideoTracks()) {
              const stop = track.stop.bind(track);
              track.stop = (): void => {
                running = false;
                stop();
              };
            }
            return stream;
          },
        },
      });
    },
    { imageData },
  );

  await page.goto("/");
  await page.getByRole("button", { name: /Enable camera/ }).click();
  await expect(page.locator("#quality-label")).toHaveText(
    "ON-DEVICE · VIDEO ONLY",
    { timeout: 60000 },
  );
  await expect(page.locator("#hands-count")).toHaveText(/1 HAND DETECTED/, {
    timeout: 15000,
  });
  await expect(page.locator("#app")).toHaveAttribute(
    "data-phase",
    "reach-left",
    {
      timeout: 15000,
    },
  );
  await expect
    .poll(() => page.evaluate(() => window.syntheticCamera.state.handResponses))
    .toBeGreaterThan(2);
  await expect
    .poll(() => page.evaluate(() => window.syntheticCamera.state.delegate))
    .toMatch(/GPU|CPU/);

  await page.evaluate(() => window.syntheticCamera.setPan("right"));
  await expect(page.locator("#app")).toHaveAttribute(
    "data-phase",
    "reach-right",
    {
      timeout: 15000,
    },
  );
  await page.evaluate(() => window.syntheticCamera.setPan("left"));
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "playing", {
    timeout: 15000,
  });
  await expect(page.locator("#hands-count")).toHaveText(/1 HAND DETECTED/);
  expect(
    await page.evaluate(() => window.syntheticCamera.state.workerErrors),
  ).toEqual([]);
});
