import type { WorkerResponse } from "../../src/perception/protocol";

interface SmokeState {
  delegate: string;
  hands: number;
  errors: number;
  starts: number;
  stops: number;
  phase: string;
  pageErrors: number;
  workerErrors: number;
}

declare global {
  interface Window {
    safariSmoke: SmokeState;
  }
}

const status = document.querySelector<HTMLElement>("#safari-smoke-status");
const root = document.querySelector<HTMLElement>("#app");
if (!status || !root) throw new Error("Missing Safari smoke fixture elements.");

const state: SmokeState = (window.safariSmoke = {
  delegate: "pending",
  hands: 0,
  errors: 0,
  starts: 0,
  stops: 0,
  phase: "loading",
  pageErrors: 0,
  workerErrors: 0,
});

const renderStatus = (): void => {
  const quality =
    document.querySelector<HTMLElement>("#quality-label")?.textContent;
  status.textContent = [
    "SAFARI SMOKE · TEST FIXTURE",
    `phase=${state.phase} camera=${quality ?? "pending"}`,
    `delegate=${state.delegate} hands=${state.hands} errors=${state.errors}`,
    `camera starts=${state.starts} reconnects=${Math.max(0, state.starts - 1)} stops=${state.stops}`,
    `pageerrors=${state.pageErrors} workererrors=${state.workerErrors}`,
  ].join("\n");
};

window.addEventListener("error", () => {
  state.pageErrors += 1;
  state.errors += 1;
  renderStatus();
});
window.addEventListener("unhandledrejection", () => {
  state.pageErrors += 1;
  state.errors += 1;
  renderStatus();
});

const NativeWorker = window.Worker;
window.Worker = class extends NativeWorker {
  constructor(url: string | URL, options?: WorkerOptions) {
    super(url, options);
    this.addEventListener(
      "message",
      ({ data }: MessageEvent<WorkerResponse>) => {
        if (data.type === "ready") state.delegate = data.delegate;
        else if (data.type === "hands") state.hands += 1;
        else if (data.type === "error") {
          state.errors += 1;
          state.workerErrors += 1;
        }
        renderStatus();
      },
    );
    this.addEventListener("error", () => {
      state.errors += 1;
      state.workerErrors += 1;
      renderStatus();
    });
  }
};

Object.defineProperty(navigator, "mediaDevices", {
  configurable: true,
  value: {
    getUserMedia: async (): Promise<MediaStream> => {
      state.starts += 1;
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Synthetic camera canvas is unavailable.");
      let running = true;
      const draw = (): void => {
        if (!running) return;
        context.fillStyle = "#777";
        context.fillRect(0, 0, canvas.width, canvas.height);
        requestAnimationFrame(draw);
      };
      draw();
      const stream = canvas.captureStream(24);
      for (const track of stream.getVideoTracks()) {
        const stop = track.stop.bind(track);
        track.stop = (): void => {
          if (!running) return;
          running = false;
          state.stops += 1;
          stop();
          renderStatus();
        };
      }
      renderStatus();
      return stream;
    },
  },
});

new MutationObserver(() => {
  state.phase = root.dataset.phase ?? "unknown";
  renderStatus();
}).observe(root, { attributes: true, attributeFilter: ["data-phase"] });

renderStatus();
await import("../../src/main");
state.phase = root.dataset.phase ?? "landing";
renderStatus();
