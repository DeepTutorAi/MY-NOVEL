import { Howl } from "howler";
import {
  DEFAULT_SEA_CUE_ID,
  SEA_MUSIC_CUES,
  SEA_SOUNDSCAPES,
  getSeaSoundscapeCue,
  isSeaMusicCueId,
  isSeaSoundscapeId,
  type SeaMusicCueId,
  type SeaSoundscapeId,
} from "../../data/sea/music-cues";

const ENABLED_KEY = "sea:audio:enabled";
const VOLUME_KEY = "sea:audio:volume";
const DEFAULT_VOLUME = 0.32;
const FADE_IN_MS = 4000;
const FADE_OUT_MS = 2000;

const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

const getAudioSources = (srcBase: string) => {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return [assetPath(`${srcBase}.mp3`)];
  }
  const supportsOgg = new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== "";
  return supportsOgg
    ? [assetPath(`${srcBase}.ogg`), assetPath(`${srcBase}.mp3`)]
    : [assetPath(`${srcBase}.mp3`)];
};

const SOUNDSCAPE_ENABLED_KEYS = {
  "rain-drip": "sea:soundscape:rain-drip:enabled",
  "pressure-hum": "sea:soundscape:pressure-hum:enabled",
} satisfies Record<SeaSoundscapeId, string>;

const SOUNDSCAPE_VOLUME_KEYS = {
  "rain-drip": "sea:soundscape:rain-drip:volume",
  "pressure-hum": "sea:soundscape:pressure-hum:volume",
} satisfies Record<SeaSoundscapeId, string>;

type TrackState = {
  howl: Howl;
  soundId?: number;
};

export class SeaAudio {
  private musicTracks = new Map<SeaMusicCueId, TrackState>();
  private soundscapeTracks = new Map<SeaSoundscapeId, TrackState>();
  private soundscapeEnabled = new Map<SeaSoundscapeId, boolean>();
  private soundscapeVolumes = new Map<SeaSoundscapeId, number>();
  private currentCue: SeaMusicCueId = DEFAULT_SEA_CUE_ID;
  private enabled = false;
  private volume = DEFAULT_VOLUME;
  private wasPlayingBeforeHidden = false;
  private initialized = false;

  init() {
    if (this.initialized || typeof window === "undefined") {
      return;
    }

    this.initialized = true;
    this.volume = this.readVolume();
    this.enabled = localStorage.getItem(ENABLED_KEY) === "true";

    for (const soundscape of SEA_SOUNDSCAPES) {
      const enabledKey = SOUNDSCAPE_ENABLED_KEYS[soundscape.id];
      const val = localStorage.getItem(enabledKey);
      this.soundscapeEnabled.set(
        soundscape.id,
        val === null ? soundscape.defaultEnabledOnPlay : val === "true"
      );
      this.soundscapeVolumes.set(soundscape.id, this.readSoundscapeVolume(soundscape.id));
    }

    // Auto-resume if enabled on initialization (with user gesture protection)
    if (this.enabled) {
      const startOnGesture = () => {
        if (this.enabled) {
          this.playCue(this.currentCue, 2000);
          this.playEnabledSoundscapes(2000);
        }
        window.removeEventListener("click", startOnGesture);
      };
      window.addEventListener("click", startOnGesture);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.wasPlayingBeforeHidden = this.enabled;
        this.pauseAll();
        return;
      }

      if (this.wasPlayingBeforeHidden) {
        if (this.enabled) {
          this.playCue(this.currentCue, 0);
          this.playEnabledSoundscapes(0);
        }
      }
    });
  }

  isEnabled() {
    return this.enabled;
  }

  getVolume() {
    return this.volume;
  }

  getCurrentCue() {
    return this.currentCue;
  }

  getSoundscapeEnabled(id: SeaSoundscapeId) {
    return this.soundscapeEnabled.get(id) ?? false;
  }

  getSoundscapeVolume(id: SeaSoundscapeId) {
    return this.soundscapeVolumes.get(id) ?? getSeaSoundscapeCue(id).defaultVolume;
  }

  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(ENABLED_KEY, String(this.enabled));
    } catch {}

    if (this.enabled) {
      this.playCue(this.currentCue, FADE_IN_MS);
      this.playEnabledSoundscapes(FADE_IN_MS);
    } else {
      this.fadeOutAll(FADE_OUT_MS);
    }

    this.emit("change");
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem(VOLUME_KEY, String(this.volume));
    } catch {}

    const state = this.musicTracks.get(this.currentCue);
    if (state && state.soundId !== undefined) {
      state.howl.volume(this.volume, state.soundId);
    }

    this.emit("change");
  }

  setCue(cueId: SeaMusicCueId) {
    if (!isSeaMusicCueId(cueId)) return;
    if (this.currentCue === cueId) return;

    const prevCue = this.currentCue;
    this.currentCue = cueId;

    if (this.enabled) {
      this.fadeOutCue(prevCue, FADE_OUT_MS);
      this.playCue(this.currentCue, FADE_IN_MS);
    }

    this.emit("change");
  }

  setSoundscapeEnabled(id: SeaSoundscapeId, enabled: boolean) {
    if (!isSeaSoundscapeId(id)) return;
    this.soundscapeEnabled.set(id, enabled);
    try {
      localStorage.setItem(SOUNDSCAPE_ENABLED_KEYS[id], String(enabled));
    } catch {}

    if (this.enabled && enabled) {
      this.playSoundscape(id, FADE_IN_MS);
    } else {
      this.fadeOutSoundscape(id, FADE_OUT_MS);
    }

    this.emit("change");
  }

  setSoundscapeVolume(id: SeaSoundscapeId, vol: number) {
    if (!isSeaSoundscapeId(id)) return;
    this.soundscapeVolumes.set(id, vol);
    try {
      localStorage.setItem(SOUNDSCAPE_VOLUME_KEYS[id], String(vol));
    } catch {}

    const state = this.soundscapeTracks.get(id);
    if (state && state.soundId !== undefined) {
      state.howl.volume(vol, state.soundId);
    }

    this.emit("change");
  }

  // Audio loading & playback helpers
  private playCue(cueId: SeaMusicCueId, fadeMs = 0) {
    let state = this.musicTracks.get(cueId);
    if (!state) {
      const cue = SEA_MUSIC_CUES.find((c) => c.id === cueId)!;
      const howl = new Howl({
        src: getAudioSources(cue.srcBase),
        loop: true,
        volume: 0,
        html5: true,
      });
      state = { howl };
      this.musicTracks.set(cueId, state);
    }

    if (!state.howl.playing(state.soundId)) {
      state.soundId = state.howl.play();
    }

    const soundId = state.soundId as number;
    if (fadeMs > 0) {
      const currentVol = state.howl.volume(soundId) as number;
      state.howl.fade(currentVol, this.volume, fadeMs, soundId);
    } else {
      state.howl.volume(this.volume, soundId);
    }
  }

  private fadeOutCue(cueId: SeaMusicCueId, fadeMs: number) {
    const state = this.musicTracks.get(cueId);
    if (state && state.soundId !== undefined && state.howl.playing(state.soundId)) {
      const soundId = state.soundId;
      const currentVol = state.howl.volume(soundId) as number;
      state.howl.fade(currentVol, 0, fadeMs, soundId);
      setTimeout(() => {
        if (state && !this.enabled && this.currentCue !== cueId) {
          state.howl.pause(soundId);
        }
      }, fadeMs + 100);
    }
  }

  private playSoundscape(id: SeaSoundscapeId, fadeMs = 0) {
    let state = this.soundscapeTracks.get(id);
    if (!state) {
      const cue = getSeaSoundscapeCue(id);
      const howl = new Howl({
        src: getAudioSources(cue.srcBase),
        loop: true,
        volume: 0,
        html5: true,
      });
      state = { howl };
      this.soundscapeTracks.set(id, state);
    }

    if (!state.howl.playing(state.soundId)) {
      state.soundId = state.howl.play();
    }

    const soundId = state.soundId as number;
    const targetVol = this.getSoundscapeVolume(id);
    if (fadeMs > 0) {
      const currentVol = state.howl.volume(soundId) as number;
      state.howl.fade(currentVol, targetVol, fadeMs, soundId);
    } else {
      state.howl.volume(targetVol, soundId);
    }
  }

  private fadeOutSoundscape(id: SeaSoundscapeId, fadeMs: number) {
    const state = this.soundscapeTracks.get(id);
    if (state && state.soundId !== undefined && state.howl.playing(state.soundId)) {
      const soundId = state.soundId;
      const currentVol = state.howl.volume(soundId) as number;
      state.howl.fade(currentVol, 0, fadeMs, soundId);
      setTimeout(() => {
        if (state && (!this.enabled || !this.getSoundscapeEnabled(id))) {
          state.howl.pause(soundId);
        }
      }, fadeMs + 100);
    }
  }

  private playEnabledSoundscapes(fadeMs = 0) {
    for (const id of this.soundscapeEnabled.keys()) {
      if (this.getSoundscapeEnabled(id)) {
        this.playSoundscape(id, fadeMs);
      }
    }
  }

  private fadeOutAll(fadeMs: number) {
    for (const cueId of this.musicTracks.keys()) {
      this.fadeOutCue(cueId, fadeMs);
    }
    for (const id of this.soundscapeTracks.keys()) {
      this.fadeOutSoundscape(id, fadeMs);
    }
  }

  private pauseAll() {
    for (const state of this.musicTracks.values()) {
      if (state.soundId !== undefined) state.howl.pause(state.soundId);
    }
    for (const state of this.soundscapeTracks.values()) {
      if (state.soundId !== undefined) state.howl.pause(state.soundId);
    }
  }

  private readVolume() {
    try {
      const vol = localStorage.getItem(VOLUME_KEY);
      return vol === null ? DEFAULT_VOLUME : Number(vol);
    } catch {
      return DEFAULT_VOLUME;
    }
  }

  private readSoundscapeVolume(id: SeaSoundscapeId) {
    try {
      const vol = localStorage.getItem(SOUNDSCAPE_VOLUME_KEYS[id]);
      return vol === null ? getSeaSoundscapeCue(id).defaultVolume : Number(vol);
    } catch {
      return getSeaSoundscapeCue(id).defaultVolume;
    }
  }



  // Event emitter API
  private listeners = new Set<() => void>();

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: string) {
    this.listeners.forEach((l) => l());
    window.dispatchEvent(new CustomEvent(`sea:audio:${event}`));
  }
}

export const seaAudio = new SeaAudio();
