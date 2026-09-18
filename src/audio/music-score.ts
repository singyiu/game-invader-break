export const MUSIC_BPM = 112;
export const MUSIC_STEPS = 32;
export const STEP_SECONDS = 60 / MUSIC_BPM / 4;

/** Keep the default 0.3 setting clearly audible while preserving mute and headroom. */
export function musicGainForSetting(setting: number): number {
  return Math.max(0, Math.min(1, setting)) * 1.5;
}

export type MusicPart = "pad" | "bass" | "melody" | "kick" | "snare" | "hat";

export interface MusicVoice {
  part: MusicPart;
  frequency: number;
  endFrequency?: number;
  duration: number;
  level: number;
  wave: OscillatorType;
  attack: number;
}

const CHORDS = [
  [52, 55, 59], // Em
  [48, 52, 55], // C
  [55, 59, 62], // G
  [50, 54, 57], // D
] as const;

const MELODY = [
  64,
  null,
  67,
  null,
  71,
  null,
  74,
  71,
  67,
  null,
  64,
  null,
  67,
  null,
  71,
  null,
  67,
  null,
  71,
  null,
  74,
  null,
  79,
  74,
  69,
  null,
  66,
  null,
  69,
  null,
  74,
  null,
] as const;

function frequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** A deterministic two-bar phrase. The caller owns the clock and lookahead. */
export function musicVoicesAtStep(
  step: number,
  active: boolean,
  reducedEffects: boolean,
): MusicVoice[] {
  const position = ((step % MUSIC_STEPS) + MUSIC_STEPS) % MUSIC_STEPS;
  const voices: MusicVoice[] = [];
  const chordIndex = Math.floor(position / 8);
  const withinChord = position % 8;

  if (withinChord === 0) {
    for (const midi of CHORDS[chordIndex]!) {
      voices.push({
        part: "pad",
        frequency: frequency(midi),
        duration: STEP_SECONDS * 7.7,
        level: active ? 0.055 : 0.025,
        wave: "triangle",
        attack: active ? 0.07 : 0.18,
      });
    }
  }

  if (active && [0, 3, 4, 6].includes(withinChord)) {
    const root = CHORDS[chordIndex]![0];
    const bassMidi =
      withinChord === 3 ? root + 7 : withinChord === 6 ? root + 12 : root;
    voices.push({
      part: "bass",
      frequency: frequency(bassMidi - 12),
      duration: STEP_SECONDS * 1.7,
      level: 0.24,
      wave: "triangle",
      attack: 0.012,
    });
  }

  const melodyMidi = MELODY[position];
  if (melodyMidi !== null && (active || withinChord === 0)) {
    voices.push({
      part: "melody",
      frequency: frequency(melodyMidi),
      duration: STEP_SECONDS * (active ? 1.65 : 3.2),
      level: active ? 0.14 : 0.035,
      wave: "sine",
      attack: 0.018,
    });
  }

  if (!active) return voices;

  if (position % 8 === 0 || position % 8 === 4) {
    voices.push({
      part: "kick",
      frequency: 145,
      endFrequency: 46,
      duration: 0.15,
      level: reducedEffects ? 0.24 : 0.32,
      wave: "sine",
      attack: 0.004,
    });
  }
  if (position % 8 === 4) {
    voices.push({
      part: "snare",
      frequency: 190,
      endFrequency: 82,
      duration: 0.09,
      level: reducedEffects ? 0.08 : 0.13,
      wave: "triangle",
      attack: 0.003,
    });
  }
  if (position % (reducedEffects ? 4 : 2) === 0) {
    voices.push({
      part: "hat",
      frequency: 5200,
      endFrequency: 3600,
      duration: 0.035,
      level: reducedEffects ? 0.012 : 0.025,
      wave: "triangle",
      attack: 0.002,
    });
  }
  return voices;
}

/** Schedule one score voice on a real-time or offline Web Audio context. */
export function scheduleMusicVoice(
  context: BaseAudioContext,
  destination: AudioNode,
  voice: MusicVoice,
  at: number,
  onEnded?: (source: OscillatorNode) => void,
): OscillatorNode {
  const source = context.createOscillator();
  const envelope = context.createGain();
  const end = at + voice.duration;
  source.type = voice.wave;
  source.frequency.setValueAtTime(voice.frequency, at);
  if (voice.endFrequency)
    source.frequency.exponentialRampToValueAtTime(voice.endFrequency, end);
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, voice.level),
    at + Math.min(voice.attack, voice.duration * 0.4),
  );
  envelope.gain.exponentialRampToValueAtTime(0.0001, end);
  source.connect(envelope);
  envelope.connect(destination);
  source.start(at);
  source.stop(end + 0.02);
  source.onended = () => {
    source.disconnect();
    envelope.disconnect();
    onEnded?.(source);
  };
  return source;
}
