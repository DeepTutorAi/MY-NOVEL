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
import { withBase } from "../../utils/base-path";

const ENABLED_KEY = "sea:audio:enabled";
const VOLUME_KEY = "sea:audio:volume";
const DEFAULT_VOLUME = 0.32;
const FADE_IN_MS = 4000;
const FADE_OUT_MS = 2000;
const GESTURE_FADE_MS = 2000;
const GESTURE_EVENTS = ["pointerdown", "pointerup", "keydown"] as const;

/**
 * playing   - the reader wants audio and it is audible.
 * blocked   - the reader wants audio but the browser has not allowed playback
 *             yet; the next user gesture on the page starts it.
 * suspended - paused by the page (hidden tab or reader left Sea), not by the
 *             reader; the preference is kept and playback resumes later.
 * off       - the reader turned audio off.
 */
export type SeaAudioStatus = "playing" | "blocked" | "suspended" | "off";

const getAudioSources = (srcBase: string) => {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return [withBase(`${srcBase}.mp3`)];
  }
  const supportsOgg = new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== "";
  return supportsOgg
    ? [withBase(`${srcBase}.ogg`), withBase(`${srcBase}.mp3`)]
    : [withBase(`${srcBase}.mp3`)];
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

const isSeaPage = () => document.body?.classList.contains("sea-page") ?? false;

const isSeaPath = (pathname: string) => {
  const base = withBase("/sea/");
  return pathname === base.slice(0, -1) || pathname.startsWith(base);
};

/** Sticky activation: whether the browser will let media start without a new gesture. */
const hasUserActivation = () => {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation;
  // Without the API, try to play and rely on Howler's playerror to fall back.
  return activation ? activation.hasBeenActive : true;
};

export class SeaAudio {
  private musicTracks = new Map<SeaMusicCueId, TrackState>();
  private soundscapeTracks = new Map<SeaSoundscapeId, TrackState>();
  private soundscapeEnabled = new Map<SeaSoundscapeId, boolean>();
  private soundscapeVolumes = new Map<SeaSoundscapeId, number>();
  private currentCue: SeaMusicCueId = DEFAULT_SEA_CUE_ID;
  /** Persisted reader preference. Only toggle()/userToggle() change it. */
  private enabled = false;
  /** Whether tracks are actually running right now. */
  private playing = false;
  private suspended = false;
  private volume = DEFAULT_VOLUME;
  private initialized = false;
  private gestureListener: ((event: Event) => void) | null = null;
  private lastStatus: SeaAudioStatus | null = null;

  init() {
    if (this.initialized || typeof window === "undefined") {
      return;
    }

    this.initialized = true;
    this.volume = this.readVolume();
    try {
      this.enabled = localStorage.getItem(ENABLED_KEY) === "true";
    } catch {
      this.enabled = false;
    }

    for (const soundscape of SEA_SOUNDSCAPES) {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(SOUNDSCAPE_ENABLED_KEYS[soundscape.id]);
      } catch {}
      this.soundscapeEnabled.set(
        soundscape.id,
        stored === null ? soundscape.defaultEnabledOnPlay : stored === "true",
      );
      this.soundscapeVolumes.set(soundscape.id, this.readSoundscapeVolume(soundscape.id));
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.suspend();
      } else {
        this.resumeSuspended();
      }
    });

    document.addEventListener("astro:before-swap", (event) => {
      const to = (event as Event & { to?: URL }).to;
      if (to instanceof URL && !isSeaPath(to.pathname)) {
        this.suspend();
      }
    });

    if (this.enabled) {
      this.start(GESTURE_FADE_MS);
    } else {
      this.emit("change");
    }
  }

  isEnabled() {
    return this.enabled;
  }

  isPlaying() {
    return this.playing;
  }

  getStatus(): SeaAudioStatus {
    if (!this.enabled) return "off";
    if (this.playing) return "playing";
    return this.suspended ? "suspended" : "blocked";
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

  /**
   * The play button. When the preference is on but the browser blocked
   * playback, the click is the gesture that starts it instead of turning the
   * preference off.
   */
  userToggle() {
    if (this.enabled && !this.playing) {
      this.suspended = false;
      this.start(FADE_IN_MS);
      return;
    }
    this.toggle();
  }

  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(ENABLED_KEY, String(this.enabled));
    } catch {}

    if (this.enabled) {
      this.suspended = false;
      this.start(FADE_IN_MS);
      return;
    }

    this.disarmGestureStart();
    this.suspended = false;
    this.playing = false;
    this.fadeOutAll(FADE_OUT_MS);
    this.emit("change");
  }

  /** Pause for page reasons (hidden tab, leaving Sea) without touching the saved preference. */
  suspend() {
    if (!this.enabled || this.suspended) return;
    this.suspended = true;
    this.playing = false;
    this.disarmGestureStart();
    this.pauseTracks();
    this.emit("change");
  }

  /** Undo suspend() once the reader is back on a visible Sea page. */
  resumeSuspended() {
    if (!this.suspended || document.visibilityState === "hidden" || !isSeaPage()) return;
    this.suspended = false;
    if (this.enabled) {
      this.start(0);
    } else {
      this.emit("change");
    }
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

    if (this.playing) {
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

    if (this.playing && enabled) {
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

  private start(fadeMs: number) {
    if (!this.enabled || this.suspended) return;
    if (!hasUserActivation()) {
      this.markBlocked();
      return;
    }
    this.disarmGestureStart();
    this.playing = true;
    this.playCue(this.currentCue, fadeMs);
    this.playEnabledSoundscapes(fadeMs);
    this.emit("change");
  }

  /** Playback was refused by the browser: stop pretending and wait for a gesture. */
  private markBlocked() {
    if (!this.enabled || this.suspended) return;
    this.playing = false;
    this.pauseTracks();
    this.armGestureStart();
    this.emit("change");
  }

  private armGestureStart() {
    if (this.gestureListener) return;
    const listener = (event: Event) => {
      // The play button handles its own click through userToggle(); starting
      // here as well would make that click toggle the audio straight off.
      const target = event.target;
      if (target instanceof Element && target.closest("[data-sonar-play]")) return;
      // A touch pointerdown does not grant activation yet; wait for pointerup.
      if (!hasUserActivation()) return;
      this.disarmGestureStart();
      if (this.enabled && !this.playing && !this.suspended) {
        this.start(GESTURE_FADE_MS);
      }
    };
    this.gestureListener = listener;
    for (const type of GESTURE_EVENTS) {
      document.addEventListener(type, listener, { capture: true });
    }
  }

  private disarmGestureStart() {
    const listener = this.gestureListener;
    if (!listener) return;
    this.gestureListener = null;
    for (const type of GESTURE_EVENTS) {
      document.removeEventListener(type, listener, { capture: true });
    }
  }

  // Audio loading & playback helpers
  private createHowl(srcBase: string) {
    return new Howl({
      src: getAudioSources(srcBase),
      loop: true,
      volume: 0,
      html5: true,
      onplayerror: () => this.markBlocked(),
    });
  }

  private playCue(cueId: SeaMusicCueId, fadeMs = 0) {
    let state = this.musicTracks.get(cueId);
    if (!state) {
      const cue = SEA_MUSIC_CUES.find((c) => c.id === cueId)!;
      state = { howl: this.createHowl(cue.srcBase) };
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
        // Pause once the fade ends unless the same cue was started again meanwhile.
        if (!this.playing || this.currentCue !== cueId) {
          state.howl.pause(soundId);
        }
      }, fadeMs + 100);
    }
  }

  private playSoundscape(id: SeaSoundscapeId, fadeMs = 0) {
    let state = this.soundscapeTracks.get(id);
    if (!state) {
      state = { howl: this.createHowl(getSeaSoundscapeCue(id).srcBase) };
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
        if (!this.playing || !this.getSoundscapeEnabled(id)) {
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

  private pauseTracks() {
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
      const parsed = vol === null ? DEFAULT_VOLUME : Number(vol);
      return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : DEFAULT_VOLUME;
    } catch {
      return DEFAULT_VOLUME;
    }
  }

  private readSoundscapeVolume(id: SeaSoundscapeId) {
    const fallback = getSeaSoundscapeCue(id).defaultVolume;
    try {
      const vol = localStorage.getItem(SOUNDSCAPE_VOLUME_KEYS[id]);
      const parsed = vol === null ? fallback : Number(vol);
      return Number.isFinite(parsed) ? parsed : fallback;
    } catch {
      return fallback;
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

    // Separate, de-duplicated event for a role="status" live region.
    const status = this.getStatus();
    if (status !== this.lastStatus) {
      this.lastStatus = status;
      window.dispatchEvent(new CustomEvent<SeaAudioStatus>("sea:audio:status", { detail: status }));
    }
  }
}

export const seaAudio = new SeaAudio();
