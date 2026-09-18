import type { GameEvent, GameState, PlayerSettings } from "../shared/contracts";
import {
  MUSIC_STEPS,
  STEP_SECONDS,
  musicGainForSetting,
  musicVoicesAtStep,
  scheduleMusicVoice,
} from "./music-score";

const LOOKAHEAD_SECONDS = 0.22;
const START_DELAY_SECONDS = 0.06;
const MAX_STEPS_PER_UPDATE = 3;

/** Original procedural score and cues. No samples, network, or microphones. */
export class AudioDirector {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private musicScene: GainNode | null = null;
  private effects: GainNode | null = null;
  private nextStep = 0;
  private step = 0;
  private readonly activeSources = new Set<OscillatorNode>();
  private activeScene = false;
  private settings: PlayerSettings = {
    music: 0.3,
    effects: 0.65,
    reducedEffects: false,
    sensitivity: "comfortable",
    uiScale: "normal",
  };
  private lastCue = -Infinity;

  async activate(): Promise<boolean> {
    try {
      if (!this.context) this.createGraph();
      const context = this.context!;
      if (context.state !== "running") {
        await context.resume();
        this.applySettings(this.settings);
        this.nextStep = context.currentTime + START_DELAY_SECONDS;
        this.step = 0;
      }
      return context.state === "running";
    } catch {
      return false;
    }
  }

  private createGraph(): void {
    const context = new AudioContext();
    const master = context.createGain();
    const music = context.createGain();
    const effects = context.createGain();
    const musicScene = context.createGain();
    master.gain.value = 0.58;
    musicScene.gain.value = 0.55;
    musicScene.connect(music);
    music.connect(master);
    effects.connect(master);
    master.connect(context.destination);
    this.context = context;
    this.master = master;
    this.music = music;
    this.musicScene = musicScene;
    this.effects = effects;
    this.applySettings(this.settings);
  }

  applySettings(settings: PlayerSettings): void {
    this.settings = settings;
    if (this.music) this.music.gain.value = musicGainForSetting(settings.music);
    if (this.effects) this.effects.gain.value = settings.effects * 0.38;
  }

  update(game: GameState, events: GameEvent[], active: boolean): void {
    const context = this.context;
    if (!context || context.state !== "running") return;
    this.setScene(active);
    if (this.settings.music > 0) this.scheduleMusic(active);

    for (const event of events) {
      if (
        context.currentTime - this.lastCue < 0.018 &&
        ![
          "shield-hit",
          "overdrive",
          "victory",
          "game-over",
          "power-collected",
          "cycle-clear",
        ].includes(event.kind)
      )
        continue;
      if (this.playCue(game, event)) this.lastCue = context.currentTime;
    }
  }

  private scheduleMusic(active: boolean): void {
    const context = this.context!;
    const music = this.musicScene!;
    const now = context.currentTime;
    if (!this.nextStep || this.nextStep < now - 0.03)
      this.nextStep = now + START_DELAY_SECONDS;
    const horizon = now + LOOKAHEAD_SECONDS;
    let scheduled = 0;
    while (this.nextStep <= horizon && scheduled < MAX_STEPS_PER_UPDATE) {
      for (const voice of musicVoicesAtStep(
        this.step,
        active,
        this.settings.reducedEffects,
      )) {
        const source = scheduleMusicVoice(
          context,
          music,
          voice,
          this.nextStep,
          (ended) => this.activeSources.delete(ended),
        );
        this.activeSources.add(source);
      }
      this.step = (this.step + 1) % MUSIC_STEPS;
      this.nextStep += STEP_SECONDS;
      scheduled++;
    }
  }

  private playCue(_game: GameState, event: GameEvent): boolean {
    const effects = this.effects!;
    switch (event.kind) {
      case "paddle-hit":
        this.tone(event.value ? 760 : 480, 0.12, "sine", effects, 0.8, 180);
        return true;
      case "enemy-hit":
        this.tone(200, 0.14, "triangle", effects, 0.7, 60);
        return true;
      case "enemy-killed":
        this.tone(340, 0.22, "sawtooth", effects, 0.28, 55);
        this.tone(92, 0.25, "sine", effects, 0.65);
        return true;
      case "telegraph":
        this.tone(660, 0.24, "sine", effects, 0.28, 900);
        return true;
      case "shot":
        this.tone(240, 0.16, "triangle", effects, 0.4, 95);
        return true;
      case "intercept":
      case "neutralize":
        this.tone(1100, 0.13, "sine", effects, 0.4, 460);
        return true;
      case "shield-hit":
        this.tone(90, 0.65, "sawtooth", effects, 0.4, 35);
        this.duck();
        return true;
      case "overdrive":
        this.arpeggio([220, 330, 440, 660], 0.08, 0.5, 0.3);
        return true;
      case "power-drop":
        this.arpeggio([740, 1110], 0.07, 0.2, 0.18);
        return true;
      case "power-collected":
        this.arpeggio(this.powerChord(event.cause), 0.07, 0.42, 0.3);
        return true;
      case "power-expired":
        this.arpeggio([440, 329.63, 220], 0.09, 0.3, 0.18);
        return true;
      case "cycle-clear":
        this.arpeggio([392, 493.88, 587.33, 783.99], 0.11, 0.85, 0.38);
        return true;
      case "victory":
        this.arpeggio([220, 277.18, 329.63, 440, 659.25], 0.1, 1.4, 0.5);
        return true;
      case "game-over":
        this.tone(146.8, 1, "triangle", effects, 0.5, 55);
        return true;
      default:
        return false;
    }
  }

  private powerChord(cause: string | undefined): number[] {
    switch (cause) {
      case "giant":
        return [261.63, 392, 523.25, 783.99];
      case "multi":
        return [329.63, 415.3, 493.88, 659.25];
      case "fire":
        return [440, 554.37, 659.25, 880];
      case "shield":
        return [523.25, 659.25, 783.99, 1046.5];
      case "wide":
      default:
        return [392, 493.88, 587.33, 783.99];
    }
  }

  private arpeggio(
    frequencies: number[],
    spacing: number,
    duration: number,
    level: number,
  ): void {
    for (const [index, frequency] of frequencies.entries())
      this.tone(
        frequency,
        duration,
        "triangle",
        this.effects!,
        level,
        undefined,
        index * spacing,
      );
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    destination: GainNode,
    level: number,
    end?: number,
    delay = 0,
  ): void {
    const context = this.context!;
    const at = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const adjustedLevel = level * (this.settings.reducedEffects ? 0.72 : 1);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (end)
      oscillator.frequency.exponentialRampToValueAtTime(end, at + duration);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, adjustedLevel),
      at + 0.012,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.03);
    this.activeSources.add(oscillator);
    oscillator.onended = () => {
      this.activeSources.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  private duck(): void {
    const context = this.context!;
    const gain = this.musicScene!.gain;
    const target = this.activeScene ? 1 : 0.55;
    gain.cancelScheduledValues(context.currentTime);
    gain.setValueAtTime(target * 0.16, context.currentTime);
    gain.linearRampToValueAtTime(target, context.currentTime + 0.65);
  }

  private setScene(active: boolean): void {
    if (active === this.activeScene) return;
    this.activeScene = active;
    const gain = this.musicScene!.gain;
    const now = this.context!.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(active ? 1 : 0.55, now + 0.16);
  }

  private stopSources(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // It may already have ended between the set iteration and stop().
      }
      source.disconnect();
    }
    this.activeSources.clear();
    this.nextStep = 0;
  }

  suspend(): void {
    if (!this.context) return;
    this.stopSources();
    if (this.music) this.music.gain.value = 0;
    void this.context.suspend().catch(() => {});
  }

  dispose(): void {
    this.stopSources();
    if (this.context) void this.context.close().catch(() => {});
    this.master?.disconnect();
    this.music?.disconnect();
    this.musicScene?.disconnect();
    this.effects?.disconnect();
    this.context = null;
    this.master = null;
    this.music = null;
    this.musicScene = null;
    this.effects = null;
    this.activeScene = false;
  }
}
