// Tiny synthesized cues for the arc cutscenes: no audio files. The runner only
// creates this when the reader has Sea audio on (seaAudio.isEnabled()); every
// cue goes through one master gain capped at 0.15 x the reader's volume, and
// dispose() closes the AudioContext when the cutscene ends.

export interface ToneOptions {
  /** Seconds. */
  duration?: number;
  type?: OscillatorType;
  /** Relative level, 0..1, under the master cap. */
  level?: number;
  /** Seconds from now. */
  delay?: number;
}

export interface NoiseOptions {
  duration: number;
  filter: BiquadFilterType;
  frequency: number;
  level?: number;
  delay?: number;
  /** Attack time in seconds; noise bursts default to a hard hit. */
  attack?: number;
}

export interface CutsceneSfx {
  tone(frequency: number, options?: ToneOptions): void;
  noise(options: NoiseOptions): void;
  dispose(): void;
}

export const SFX_MAX_GAIN = 0.15;

export function createSfx(readerVolume: number): CutsceneSfx | null {
  const AudioCtor =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!AudioCtor) return null;

  let context: AudioContext;
  try {
    context = new AudioCtor();
  } catch {
    return null;
  }
  // Without a recent gesture the context stays suspended and the cues are
  // silent; that is the intended outcome, never a reason to retry.
  if (context.state === "suspended") void context.resume().catch(() => undefined);

  const master = context.createGain();
  master.gain.value = SFX_MAX_GAIN * Math.min(1, Math.max(0, readerVolume));
  master.connect(context.destination);
  let closed = false;
  let noiseBuffer: AudioBuffer | null = null;

  const envelope = (at: number, duration: number, level: number, attack: number) => {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    gain.connect(master);
    return gain;
  };

  return {
    tone(frequency, { duration = 1.2, type = "sine", level = 0.8, delay = 0 } = {}) {
      if (closed) return;
      const at = context.currentTime + delay;
      const osc = context.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, at);
      osc.connect(envelope(at, duration, level, 0.02));
      osc.start(at);
      osc.stop(at + duration + 0.05);
    },
    noise({ duration, filter, frequency, level = 0.8, delay = 0, attack = 0.005 }) {
      if (closed) return;
      if (!noiseBuffer) {
        noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 1.5), context.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      const at = context.currentTime + delay;
      const source = context.createBufferSource();
      source.buffer = noiseBuffer;
      const biquad = context.createBiquadFilter();
      biquad.type = filter;
      biquad.frequency.value = frequency;
      source.connect(biquad);
      biquad.connect(envelope(at, duration, level, attack));
      source.start(at);
      source.stop(at + Math.min(duration + 0.05, 1.45));
    },
    dispose() {
      if (closed) return;
      closed = true;
      void context.close().catch(() => undefined);
    },
  };
}
