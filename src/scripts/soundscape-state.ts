const ENABLED_KEY = "hvitveldt:soundscape:enabled";
const VOLUME_KEY = "hvitveldt:soundscape:volume";
const DEFAULT_VOLUME = 0.18;

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export class SoundscapeAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private wind?: AudioBufferSourceNode;
  private crackleTimer?: number;
  private enabled = false;
  private volume = DEFAULT_VOLUME;
  private initialized = false;

  init() {
    if (this.initialized || typeof window === "undefined") {
      return;
    }

    this.initialized = true;
    this.volume = this.readVolume();

    document.addEventListener("visibilitychange", () => {
      if (!this.context) {
        return;
      }

      if (document.visibilityState === "hidden") {
        this.context.suspend().catch(() => undefined);
      } else if (this.enabled) {
        this.context.resume().catch(() => undefined);
      }
    });
  }

  isEnabled() {
    return this.enabled;
  }

  getVolume() {
    return this.volume;
  }

  async enable() {
    this.init();

    try {
      this.ensureGraph();
      await this.context?.resume();
      this.enabled = true;
      localStorage.setItem(ENABLED_KEY, "true");
      this.master?.gain.setTargetAtTime(this.volume, this.context?.currentTime ?? 0, 0.6);
      this.startCrackles();
      return true;
    } catch (error) {
      console.warn("Soundscape failed to enable.", error);
      this.disable();
      return false;
    }
  }

  disable() {
    this.enabled = false;
    localStorage.setItem(ENABLED_KEY, "false");

    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.35);
    }

    if (this.wind) {
      this.wind.stop();
      this.wind.disconnect();
      this.wind = undefined;
    }

    if (this.crackleTimer !== undefined) {
      window.clearTimeout(this.crackleTimer);
      this.crackleTimer = undefined;
    }
  }

  setVolume(value: number) {
    this.volume = Math.min(0.7, Math.max(0, value));
    localStorage.setItem(VOLUME_KEY, String(this.volume));

    if (this.context && this.master && this.enabled) {
      this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.25);
    }
  }

  private ensureGraph() {
    if (!this.context) {
      const AudioContextConstructor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;

      if (!AudioContextConstructor) {
        throw new Error("AudioContext is not available.");
      }

      this.context = new AudioContextConstructor();
      this.master = this.context.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.context.destination);
    }

    if (!this.wind) {
      this.wind = this.createWind();
      this.wind.start();
    }
  }

  private createWind() {
    const context = this.requireContext();
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = this.createNoiseBuffer(2.5);
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = 580;
    filter.Q.value = 0.7;
    gain.gain.value = 0.34;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.requireMaster());

    return source;
  }

  private startCrackles() {
    if (!this.enabled || !this.context) {
      return;
    }

    const delay = 900 + Math.random() * 1800;
    this.crackleTimer = window.setTimeout(() => {
      this.playCrackle();
      this.startCrackles();
    }, delay);
  }

  private playCrackle() {
    if (!this.context || !this.master || !this.enabled) {
      return;
    }

    const context = this.context;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const duration = 0.05 + Math.random() * 0.08;

    source.buffer = this.createNoiseBuffer(duration);
    filter.type = "bandpass";
    filter.frequency.value = 900 + Math.random() * 1800;
    filter.Q.value = 2.4;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.1 + Math.random() * 0.18, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start();
    source.stop(context.currentTime + duration + 0.01);
  }

  private createNoiseBuffer(seconds: number) {
    const context = this.requireContext();
    const sampleRate = context.sampleRate;
    const buffer = context.createBuffer(1, Math.max(1, Math.floor(seconds * sampleRate)), sampleRate);
    const channel = buffer.getChannelData(0);
    let previous = 0;

    for (let i = 0; i < channel.length; i += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.82 + white * 0.18;
      channel[i] = previous;
    }

    return buffer;
  }

  private readVolume() {
    const raw = localStorage.getItem(VOLUME_KEY);
    const parsed = raw ? Number(raw) : DEFAULT_VOLUME;
    return Number.isFinite(parsed) ? Math.min(0.7, Math.max(0, parsed)) : DEFAULT_VOLUME;
  }

  private requireContext() {
    if (!this.context) {
      throw new Error("Soundscape context is not ready.");
    }

    return this.context;
  }

  private requireMaster() {
    if (!this.master) {
      throw new Error("Soundscape master is not ready.");
    }

    return this.master;
  }
}

export const soundscapeAudio = new SoundscapeAudio();
