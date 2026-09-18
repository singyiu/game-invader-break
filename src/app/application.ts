import { paddleWidthForMode } from "../game/powers";
import { cycleForLevel } from "../game/difficulty";
import { HUD_POWERS, POWER_LABELS } from "../ui/power-labels";
import { TUNING } from "../content/tuning";
import { MetricsCollector } from "../diagnostics/metrics";
import { CameraSession } from "../camera/camera-session";
import { HandController } from "../input/paddle-controller";
import { createGame } from "../game/state";
import { spawnEnemy } from "../game/encounters";
import { continueSector, stepGame } from "../game/step";
import { ArenaRenderer } from "../render/arena-renderer";
import { AudioDirector } from "../audio/audio-director";
import {
  loadProfile,
  saveProfile,
  recordRun,
  recordMilestones,
  type RunProgress,
} from "../storage/local-profile";
import { SessionMachine, type SessionAction } from "./session-machine";
import { DwellMenu } from "../ui/dwell-menu";
import { ReachSetup } from "../ui/reach-setup";
import { Overlay, formatTime } from "../ui/overlay";
import { HandPreview } from "../ui/hand-preview";
import { mountShell } from "../ui/shell";
import type {
  GameEvent,
  GameState,
  PaddleIntent,
  TrackedHand,
  PowerKind,
} from "../shared/contracts";

const SECTORS = ["BROKEN ORBIT", "EMBER FOUNDRY", "ECLIPSE GATE"];
const FIXED_STEP = 1 / 120;
export class InvaderBreakApp {
  private metrics = new MetricsCollector();
  private session = new SessionMachine();
  private controller = new HandController();
  private camera: CameraSession;
  private renderer: ArenaRenderer | null = null;
  private audio = new AudioDirector();
  private profile = loadProfile();
  private game = createGame();
  private attract = createGame();
  private overlay: Overlay;
  private preview: HandPreview;
  private dwell = new DwellMenu();
  private reach = new ReachSetup();
  private lastFrame = 0;
  private frameId = 0;
  private accumulator = 0;
  private runStartedAt = 0;
  private runWallSeconds = 0;
  private runRecorded = true;
  private loading = "Requesting camera permission…";
  private error = "";
  private settingPage = 0;
  private performancePaused = false;
  private disposed = false;
  private startupGeneration = 0;
  private graphicsFailed = false;
  private handLostAt = 0;
  private lastUiUpdate = 0;
  private notice = "";
  private noticeUntil = 0;
  private observer: ResizeObserver;
  private elements: Record<string, HTMLElement> = {};
  private readonly hidden = () => {
    if (document.hidden) this.suspend();
  };
  private readonly pagehide = () => this.suspend();
  constructor(private root: HTMLElement) {
    mountShell(root);
    for (const el of root.querySelectorAll<HTMLElement>("[id]"))
      this.elements[el.id] = el;
    this.overlay = new Overlay(this.elements.overlay);
    this.preview = new HandPreview(this.elements.skeleton as HTMLCanvasElement);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      this.profile.settings.reducedEffects = true;
    this.camera = new CameraSession(
      this.elements["camera-video"] as HTMLVideoElement,
      {
        onFrame: (frame) => {
          this.controller.update(frame);
          this.metrics.inference(
            frame.arrivedAt - frame.capturedAt,
            frame.inferenceMs,
          );
        },
        onError: (message) => this.fail(message),
        onStatus: (message) => {
          this.loading = message;
        },
      },
    );
    this.root.dataset.phase = "landing";
    try {
      this.renderer = new ArenaRenderer(
        this.elements.arena as HTMLCanvasElement,
        () => this.graphicsError(),
      );
    } catch {
      this.graphicsFailed = true;
      this.fail(
        "This browser could not start WebGL 2 graphics. Enable hardware acceleration, or use a current desktop Chrome or Safari browser.",
      );
    }
    this.attract.paddles = [
      { id: 1, x: 36, y: 88, width: TUNING.splitPaddleWidth, height: 1.5 },
      { id: 2, x: 68, y: 88, width: TUNING.splitPaddleWidth, height: 1.5 },
    ];
    this.attract.serveRemaining = 0;
    this.attract.enemies = Array.from({ length: 18 }, (_, i) =>
      spawnEnemy(
        this.attract,
        (["drone", "spitter", "lancer"] as const)[Math.floor(i / 6)],
        15 + (i % 6) * 14,
        20 + Math.floor(i / 6) * 12,
      ),
    );
    this.attract.projectiles = [
      { id: 701, x: 35, y: 48, vx: 0, vy: 30, radius: 0.7, sourceId: 0 },
      { id: 702, x: 73, y: 57, vx: 0, vy: 30, radius: 0.7, sourceId: 0 },
    ];
    this.applySettings();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.elements["arena-wrap"]);
    this.root.addEventListener("click", this.click);
    document.addEventListener("visibilitychange", this.hidden);
    window.addEventListener("pagehide", this.pagehide);
    this.resize();
    this.frameId = requestAnimationFrame(this.frame);
  }
  private click = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    if (target.closest("#disconnect-camera")) {
      this.choose("exit", performance.now());
      return;
    }
    if (
      target.closest("#enable-camera") ||
      target.closest("[data-camera-retry]")
    )
      void this.enable();
  };
  private async enable(): Promise<void> {
    if (this.disposed || this.session.phase === "loading") return;
    if (this.graphicsFailed) {
      location.reload();
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.fail(
        "Camera access requires HTTPS or localhost in a supported desktop browser. Open this game at a secure address.",
      );
      return;
    }
    const generation = ++this.startupGeneration;
    this.session.send("enable");
    this.controller.reset();
    this.applyCalibration();
    this.performancePaused = false;
    const audioReady = await this.audio.activate();
    if (!this.startupCurrent(generation)) return;
    if (!audioReady)
      this.elements["quality-label"].textContent =
        "SOUND UNAVAILABLE · VISUAL CUES ACTIVE";
    await this.camera.start();
    if (!this.startupCurrent(generation)) return;
    if (this.camera.running) this.session.send("camera-ready");
  }
  private startupCurrent(generation: number): boolean {
    return (
      !this.disposed &&
      generation === this.startupGeneration &&
      this.session.phase === "loading" &&
      !document.hidden
    );
  }
  private fail(message: string): void {
    this.startupGeneration++;
    this.error = message;
    this.session.send("error");
    this.camera?.stop();
    this.audio.suspend();
    this.accumulator = 0;
  }
  private graphicsError(): void {
    this.graphicsFailed = true;
    this.fail(
      "The graphics connection was interrupted. Your camera is stopped. Reload to restore the arena.",
    );
  }
  private suspend(): void {
    if (this.session.phase === "landing") return;
    this.startupGeneration++;
    this.camera.stop();
    this.controller.reset();
    this.audio.suspend();
    this.session.send("hidden");
    this.accumulator = 0;
    this.lastFrame = 0;
  }
  private applyCalibration(): void {
    const c = this.profile.calibration;
    if (this.profile.settings.sensitivity === "small") {
      const mid = (c.min + c.max) / 2,
        half = (c.max - c.min) * 0.35;
      this.controller.setCalibration({ min: mid - half, max: mid + half });
    } else this.controller.setCalibration(c);
  }
  private applySettings(): void {
    document.documentElement.dataset.reduced = String(
      this.profile.settings.reducedEffects,
    );
    document.documentElement.dataset.ui = this.profile.settings.uiScale;
    this.audio.applySettings(this.profile.settings);
    this.renderer?.setFinish(this.profile.finish);
    this.renderer?.setOptions({
      quality: "auto",
      reducedEffects: this.profile.settings.reducedEffects,
    });
    this.applyCalibration();
  }
  private resize(): void {
    const box = this.elements["arena-wrap"].getBoundingClientRect();
    this.renderer?.resize(box.width, box.height);
  }
  private frame = (now: number): void => {
    if (this.disposed) return;
    const elapsed = this.lastFrame
      ? Math.max(0, (now - this.lastFrame) / 1000)
      : 0;
    this.lastFrame = now;
    let intent = this.controller.intent(now);
    const hands = this.controller.hands;
    const fresh =
      !["stale", "uncertain"].includes(intent.status) && hands.length > 0;
    const hand = fresh
      ? hands.slice().sort((a, b) => a.id - b.id)[0]
      : undefined;
    if (!hand) {
      if (!this.handLostAt) this.handLostAt = now;
    } else this.handLostAt = 0;
    this.root.dataset.phase = this.session.phase;
    const live = this.session.phase === "playing";
    this.metrics.frame(elapsed * 1000, live, intent.paused);
    if (live && elapsed > 0.25) {
      this.performancePaused = true;
      this.accumulator = 0;
    }
    const events: GameEvent[] = [];
    if (live && !intent.paused && !this.performancePaused && elapsed <= 0.25) {
      this.accumulator += elapsed;
      let steps = 0;
      while (this.accumulator >= FIXED_STEP && steps < 30) {
        events.push(...stepGame(this.game, intent));
        this.accumulator -= FIXED_STEP;
        steps++;
        if (this.game.status === "lost" || this.game.status === "won") break;
      }
      if (
        this.session.phase === "playing" &&
        (this.game.status === "won" || this.game.status === "lost")
      )
        this.finishRun(now);
    } else this.accumulator = 0;
    this.updateMenu(now, intent, hand, hands);
    intent = this.controller.intent(now);
    const state =
      this.session.phase === "landing"
        ? this.animateAttract(now)
        : this.renderState(intent);
    this.renderer?.render(state, events, now / 1000);
    this.audio.update(
      this.game,
      events,
      live && !intent.paused && !this.performancePaused,
    );
    this.preview.draw(hands, fresh);
    for (const event of events) {
      if (event.kind === "cycle-clear") {
        recordMilestones(this.profile, this.runProgress());
        saveProfile(this.profile);
      }
      if (event.kind === "shield-hit") {
        this.notice = "SHIELD LOST";
        this.noticeUntil = now + 1400;
      }
      if (
        event.kind === "power-collected" &&
        event.cause &&
        event.cause in POWER_LABELS
      ) {
        const kind = event.cause as PowerKind;
        this.notice =
          kind === "shield"
            ? `SHIELD REPAIRED · ${event.value}/3`
            : `${POWER_LABELS[kind].name.toUpperCase()} · 30s`;
        this.noticeUntil = now + 1800;
      }
      if (event.kind === "overdrive") {
        this.notice = "OVERDRIVE ONLINE";
        this.noticeUntil = now + 1700;
      }
      if (event.kind === "neutralize") {
        this.notice = "THREAT NEUTRALIZED";
        this.noticeUntil = now + 600;
      }
    }
    if (now - this.lastUiUpdate > 80) {
      this.updateHud(state, intent, now, hands);
      this.lastUiUpdate = now;
    }
    this.frameId = requestAnimationFrame(this.frame);
  };
  private updateMenu(
    now: number,
    intent: PaddleIntent,
    hand: TrackedHand | undefined,
    hands: TrackedHand[],
  ): void {
    const longLoss = this.handLostAt > 0 && now - this.handLostAt >= 500;
    const paused = intent.paused || this.performancePaused;
    this.overlay.show({
      phase: this.session.phase,
      game: this.game,
      error: this.error,
      loading: this.loading,
      settings: this.profile.settings,
      settingsPage: this.settingPage,
      finish: this.profile.finish,
      unlocks: this.profile.unlocks,
      paused,
      needsDwell: intent.needsDwell || longLoss,
      hands: hand ? hands.length : 0,
      cameraRecover: this.performancePaused,
      wallSeconds: this.runWallSeconds,
      best: this.best(),
      bestLevel: this.profile.bests[this.runProgress().mode].level,
    });
    const menuX = hand?.x ?? null;
    const result = this.dwell.update(menuX, now, this.overlay.choices);
    this.overlay.progress(result.active, result.progress, menuX);
    if (result.selected) this.choose(result.selected, now);
    if (
      this.session.phase === "reach-left" ||
      this.session.phase === "reach-right"
    ) {
      const side = this.session.phase === "reach-left" ? "left" : "right";
      const reach = this.reach.update(side, hand?.rawX ?? null, now);
      const progress = this.root.querySelector<HTMLElement>("#reach-progress");
      if (progress) progress.style.width = `${reach.progress * 100}%`;
      if (reach.done) {
        if (side === "left") this.session.send("left-set");
        else if (reach.calibration) {
          this.profile.calibration = reach.calibration;
          this.applyCalibration();
          saveProfile(this.profile);
          this.startRun(now, "right-set");
        }
      }
    }
  }
  private choose(action: string, now: number): void {
    if (action === "aligned") {
      this.controller.confirmResume(now);
      this.reach = new ReachSetup();
      this.session.send("aligned");
    } else if (action === "retry") {
      this.startRun(now, "retry");
    } else if (action === "resume") {
      this.controller.confirmResume(now);
      this.performancePaused = false;
      this.accumulator = 0;
    } else if (action === "recover") {
      this.controller.confirmResume(now);
      this.performancePaused = false;
      this.session.send("resume");
    } else if (action === "continue-sector") continueSector(this.game);
    else if (action === "exit") {
      this.bankRun(now);
      this.startupGeneration++;
      this.camera.stop();
      this.controller.reset();
      this.audio.suspend();
      this.session.send("exit");
      this.game = createGame();
      this.metrics.reset();
      this.reach = new ReachSetup();
      this.performancePaused = false;
      this.accumulator = 0;
      this.lastFrame = 0;
      this.handLostAt = 0;
      this.runStartedAt = 0;
      this.runWallSeconds = 0;
      this.notice = "";
      this.noticeUntil = 0;
    } else if (action === "finish") {
      const choices = ["standard", ...this.profile.unlocks];
      const next =
        choices[(choices.indexOf(this.profile.finish) + 1) % choices.length];
      this.profile.finish =
        next === "aurora" || next === "eclipse" ? next : "standard";
      this.applySettings();
      saveProfile(this.profile);
    } else if (action === "more") this.settingPage = 1;
    else if (
      ["music", "effects", "reduced", "sensitivity", "ui"].includes(action)
    ) {
      const s = this.profile.settings;
      if (action === "music") {
        const levels = [0, 0.15, 0.3, 0.6];
        s.music = levels[(levels.indexOf(s.music) + 1) % levels.length];
      }
      if (action === "effects") {
        const levels = [0, 0.25, 0.65, 1];
        s.effects = levels[(levels.indexOf(s.effects) + 1) % levels.length];
      }
      if (action === "reduced") s.reducedEffects = !s.reducedEffects;
      if (action === "sensitivity")
        s.sensitivity = s.sensitivity === "small" ? "comfortable" : "small";
      if (action === "ui")
        s.uiScale = s.uiScale === "large" ? "normal" : "large";
      this.applySettings();
      saveProfile(this.profile);
    } else {
      if (action === "settings") this.settingPage = 0;
      if (action === "recalibrate") this.reach = new ReachSetup();
      this.session.send(action as SessionAction);
    }
    this.dwell.reset(action !== "exit");
  }
  private startRun(now: number, action: "right-set" | "retry"): void {
    this.game = createGame({ seed: 20260916 });
    this.metrics.reset();
    this.runStartedAt = now;
    this.runWallSeconds = 0;
    this.runRecorded = false;
    this.controller.confirmResume(now);
    this.performancePaused = false;
    this.accumulator = 0;
    this.notice = "";
    this.noticeUntil = 0;
    this.session.send(action);
    this.dwell.reset(true);
  }
  private runProgress(): RunProgress {
    return {
      mode:
        this.game.controlHistory === "none" ? "one" : this.game.controlHistory,
      score: this.game.score,
      level: this.game.wave,
      bossesDefeated: this.game.bossesDefeated,
      perfectBossClears: this.game.perfectBossClears,
    };
  }
  private bankRun(now: number): void {
    if (this.runRecorded) return;
    this.runWallSeconds = Math.max(0, (now - this.runStartedAt) / 1000);
    recordRun(this.profile, {
      ...this.runProgress(),
      activeSeconds: this.game.time,
      wallSeconds: this.runWallSeconds,
      won: this.game.status === "won",
      shields: this.game.shields,
      transitions: this.game.transitions,
    });
    saveProfile(this.profile);
    this.runRecorded = true;
  }
  private finishRun(now: number): void {
    this.bankRun(now);
    this.session.send("finish");
    this.dwell.reset(true);
    this.accumulator = 0;
  }
  private best(): number {
    return this.profile.bests[
      this.game.controlHistory === "two"
        ? "two"
        : this.game.controlHistory === "mixed"
          ? "mixed"
          : "one"
    ].score;
  }
  private renderState(intent: PaddleIntent): GameState {
    if (!intent.mode) return this.game;
    const width = paddleWidthForMode(this.game, intent.mode);
    if (intent.paused || this.session.phase !== "playing")
      return {
        ...this.game,
        paddles: intent.targets.map((p) => ({
          id: p.id,
          x: Math.max(width / 2, Math.min(100 - width / 2, p.x * 100)),
          y: 88,
          width,
          height: 1.5,
        })),
      };
    return this.game;
  }
  private animateAttract(now: number): GameState {
    const t = now / 1000;
    this.attract.time = t;
    this.attract.ball.x = 54 + Math.sin(t * 0.45) * 19;
    this.attract.ball.y = 56 + Math.cos(t * 0.65) * 13;
    this.attract.paddles[0].x = 31 + Math.sin(t * 0.32) * 8;
    this.attract.paddles[1].x = 68 + Math.cos(t * 0.27) * 8;
    return this.attract;
  }
  private updateHud(
    state: GameState,
    intent: PaddleIntent,
    now: number,
    hands: TrackedHand[],
  ): void {
    const e = this.elements,
      landing = this.session.phase === "landing";
    e["tracking-dock"].hidden = landing;
    e["score"].textContent = Math.floor(state.score)
      .toString()
      .padStart(6, "0");
    e["combo"].textContent =
      `${(1 + Math.min(2, Math.floor(state.combo / 3) * 0.25)).toFixed(2)}×`;
    e["wave-label"].textContent = landing
      ? "ENDLESS INVASION"
      : `LEVEL ${String(state.wave).padStart(2, "0")}${state.bossPhase ? " · BOSS" : ""}`;
    e["phase-name"].textContent = state.bossPhase
      ? "THE ECLIPSE ENGINE"
      : SECTORS[state.sector - 1];
    e["sector-label"].textContent =
      `CYCLE ${cycleForLevel(state.wave)} / ${SECTORS[state.sector - 1]}`;
    e["hand-bonus"].hidden = landing || intent.mode !== 2;
    e["power-status"].hidden =
      landing || !HUD_POWERS.some((kind) => state.powers[kind] > 0);
    for (const kind of HUD_POWERS) {
      const chip = e["power-status"].querySelector<HTMLElement>(
        `[data-power="${kind}"]`,
      )!;
      const remaining = state.powers[kind];
      chip.hidden = remaining <= 0;
      chip.querySelector<HTMLElement>(".power-time")!.textContent =
        `${Math.ceil(remaining)}s`;
      chip.classList.toggle("expiring", remaining > 0 && remaining <= 5);
    }
    for (const [i, shield] of Array.from(e.shields.children).entries())
      shield.classList.toggle("empty", i >= state.shields);
    for (const [i, segment] of Array.from(
      e["charge-segments"].children,
    ).entries())
      segment.classList.toggle(
        "charged",
        i < state.charge || state.overdriveUntil > state.time,
      );
    e["charge-label"].textContent =
      state.overdriveUntil > state.time ? "OVERDRIVE ACTIVE" : "OVERDRIVE";
    e["header-status"].textContent = landing
      ? "SYSTEM ONLINE"
      : this.camera.running
        ? "CONTROL LINK ACTIVE"
        : "CONTROL LINK STANDBY";
    e["arena-label"].textContent = landing
      ? "LIVE ARENA PREVIEW"
      : this.session.phase === "playing"
        ? "DEFEND YOUR ORBIT"
        : "ESTABLISH YOUR LINK";
    e["tracking-label"].textContent = landing
      ? "HAND TRACKING STANDBY"
      : intent.status === "stable"
        ? "HAND TRACKING ACTIVE"
        : intent.status === "stale"
          ? "WAITING FOR FRESH CAMERA"
          : "ACQUIRING YOUR HANDS";
    e["tracking-light"].className =
      `tracking-light ${intent.status === "stable" ? "active" : landing ? "" : "warning"}`;
    e["mode-label"].textContent = landing
      ? "ONE OR TWO HANDS"
      : intent.mode === 2
        ? "02 HANDS · 1.5× POINTS"
        : "01 HAND → 01 PADDLE";
    e["hands-count"].textContent =
      `${hands.length} ${hands.length === 1 ? "HAND" : "HANDS"} DETECTED`;
    e["quality-label"].textContent = this.camera.running
      ? "ON-DEVICE · VIDEO ONLY"
      : "CAMERA OFF";
    e["tracking-hint"].textContent =
      this.session.phase === "playing"
        ? "Catch powers. Dodge shots and amber dive paths."
        : "Keep a relaxed hand in view. Sit comfortably.";
    const active = this.session.phase === "playing";
    let notice = "";
    if (active && intent.resumeIn > 0)
      notice = `${intent.mode === 2 ? "PADDLE SPLIT" : "CONTROL RESTORED"}\n${(intent.resumeIn / 1000).toFixed(1)}`;
    else if (active && intent.status === "stale" && this.camera.running)
      notice = "TRACKING PAUSED";
    else if (
      active &&
      !intent.paused &&
      !this.performancePaused &&
      state.serveRemaining > 0
    )
      notice = `GET READY\n${Math.ceil(state.serveRemaining)}`;
    else if (now < this.noticeUntil) notice = this.notice;
    e["rally-notice"].textContent = notice;
    if (active)
      e["arena-coords"]?.setAttribute("title", formatTime(state.time));
  }
  get diagnostics() {
    return {
      timings: this.metrics.summary(),
      camera: this.camera.metrics,
      render: this.renderer?.stats,
      controlHistory: this.game.controlHistory,
      transitions: this.game.transitions,
      fairnessInterventions: this.game.fairnessInterventions,
    };
  }
  dispose(): void {
    this.startupGeneration++;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.camera.stop();
    this.audio.dispose();
    this.renderer?.dispose();
    this.observer.disconnect();
    this.root.removeEventListener("click", this.click);
    document.removeEventListener("visibilitychange", this.hidden);
    window.removeEventListener("pagehide", this.pagehide);
  }
}
