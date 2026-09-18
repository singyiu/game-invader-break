import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioDirector } from "../../src/audio/audio-director";
import { musicGainForSetting } from "../../src/audio/music-score";
import type {
  GameEvent,
  GameState,
  PlayerSettings,
} from "../../src/shared/contracts";

class FakeAudioParam {
  value = 1;
  readonly events: { kind: string; value: number; time: number }[] = [];
  setValueAtTime(value: number, time: number): AudioParam {
    this.value = value;
    this.events.push({ kind: "set", value, time });
    return this as unknown as AudioParam;
  }
  exponentialRampToValueAtTime(value: number, time: number): AudioParam {
    this.value = value;
    this.events.push({ kind: "exponential", value, time });
    return this as unknown as AudioParam;
  }
  linearRampToValueAtTime(value: number, time: number): AudioParam {
    this.value = value;
    this.events.push({ kind: "linear", value, time });
    return this as unknown as AudioParam;
  }
  cancelScheduledValues(time: number): AudioParam {
    this.events.push({ kind: "cancel", value: this.value, time });
    return this as unknown as AudioParam;
  }
}

class FakeNode {
  connections: AudioNode[] = [];
  connect(destination: AudioNode): AudioNode {
    this.connections.push(destination);
    return destination;
  }
  disconnect(): void {
    this.connections = [];
  }
}

class FakeGainNode extends FakeNode {
  gain = new FakeAudioParam();
}

class FakeOscillatorNode extends FakeNode {
  frequency = new FakeAudioParam();
  type: OscillatorType = "sine";
  onended: (() => void) | null = null;
  readonly starts: number[] = [];
  readonly stops: number[] = [];
  start(time = 0): void {
    this.starts.push(time);
  }
  stop(time = 0): void {
    this.stops.push(time);
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  currentTime = 10;
  state: AudioContextState = "suspended";
  destination = new FakeNode() as unknown as AudioDestinationNode;
  readonly gains: FakeGainNode[] = [];
  readonly oscillators: FakeOscillatorNode[] = [];
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createGain(): GainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }
  createOscillator(): OscillatorNode {
    const oscillator = new FakeOscillatorNode();
    this.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  }
  async resume(): Promise<void> {
    this.state = "running";
  }
  async suspend(): Promise<void> {
    this.state = "suspended";
  }
  async close(): Promise<void> {
    this.state = "closed";
  }
}

const settings = (music: number): PlayerSettings => ({
  music,
  effects: 0.65,
  reducedEffects: false,
  sensitivity: "comfortable",
  uiScale: "normal",
});

const game = { time: 20, overdriveUntil: 0, wave: 3 } as GameState;
const event = (kind: GameEvent["kind"], cause?: string): GameEvent => ({
  id: 1,
  tick: 1,
  kind,
  cause,
  x: 50,
  y: 50,
});

beforeEach(() => {
  FakeAudioContext.instances = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
});

afterEach(() => vi.unstubAllGlobals());

describe("AudioDirector", () => {
  it("does not create or schedule audio before activation", () => {
    const director = new AudioDirector();
    director.update(game, [], true);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it("schedules a bounded combat phrase at the default audible gain", async () => {
    const director = new AudioDirector();
    expect(await director.activate()).toBe(true);
    director.update(game, [], true);
    const context = FakeAudioContext.instances[0]!;
    expect(context.gains[1]!.gain.value).toBeCloseTo(
      musicGainForSetting(0.3),
      5,
    );
    expect(context.oscillators).toHaveLength(7);
    expect(context.oscillators.every((source) => source.starts[0]! >= 10)).toBe(
      true,
    );
    expect(
      Math.max(...context.oscillators.map((source) => source.starts[0]!)),
    ).toBeLessThanOrEqual(10.22);
  });

  it("continues with sparse quiet music while combat is inactive", async () => {
    const director = new AudioDirector();
    await director.activate();
    director.update(game, [], false);
    const context = FakeAudioContext.instances[0]!;
    expect(context.oscillators).toHaveLength(4);
    expect(context.gains[3]!.gain.value).toBe(0.55);
  });

  it("mutes music at zero without muting acquisition effects", async () => {
    const director = new AudioDirector();
    await director.activate();
    director.applySettings(settings(0));
    director.update(game, [event("power-collected", "wide")], true);
    const context = FakeAudioContext.instances[0]!;
    expect(context.gains[1]!.gain.value).toBe(0);
    expect(
      context.oscillators.map((source) => source.frequency.events[0]!.value),
    ).toEqual([392, 493.88, 587.33, 783.99]);
  });

  it("stops scheduled voices on suspend and restarts from a clean phrase", async () => {
    const director = new AudioDirector();
    await director.activate();
    director.update(game, [], true);
    const context = FakeAudioContext.instances[0]!;
    const firstPhrase = [...context.oscillators];
    director.suspend();
    await vi.waitFor(() => expect(context.state).toBe("suspended"));
    expect(firstPhrase.every((source) => source.stops.length === 2)).toBe(true);

    context.currentTime = 40;
    await director.activate();
    director.update(game, [], true);
    const restarted = context.oscillators.slice(firstPhrase.length);
    expect(restarted).toHaveLength(7);
    expect(restarted.every((source) => source.starts[0]! >= 40)).toBe(true);
  });

  it("closes the context and stops voices when disposed", async () => {
    const director = new AudioDirector();
    await director.activate();
    director.update(game, [], true);
    const context = FakeAudioContext.instances[0]!;
    director.dispose();
    await vi.waitFor(() => expect(context.state).toBe("closed"));
    expect(
      context.oscillators.every((source) => source.stops.length === 2),
    ).toBe(true);
  });
});
