import { Howl } from "howler";
import {
  DEFAULT_MUSIC_CUE_ID,
  MUSIC_CUES,
  SOUNDSCAPES,
  getSoundscapeCue,
  isMusicCueId,
  isSoundscapeId,
  nextMusicCue,
  previousMusicCue,
  type MusicCueId,
  type SoundscapeId,
} from "../../data/kusabi/audio-cues";

const ENABLED_KEY = "kusabi:audio:enabled";
const VOLUME_KEY = "kusabi:audio:volume";
const DEFAULT_VOLUME = 0.35;
const FADE_IN_MS = 3_000;
const FADE_OUT_MS = 1_500;
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

const soundscapeEnabledKey = (id: SoundscapeId) => `kusabi:soundscape:${id}:enabled`;
const soundscapeVolumeKey = (id: SoundscapeId) => `kusabi:soundscape:${id}:volume`;

type TrackState = {
  howl: Howl;
  soundId?: number;
};

export class KusabiAudio {
  private musicTracks = new Map<MusicCueId, TrackState>();
  private soundscapeTracks = new Map<SoundscapeId, TrackState>();
  private soundscapeEnabled = new Map<SoundscapeId, boolean>();
  private soundscapeVolumes = new Map<SoundscapeId, number>();
  private currentCue: MusicCueId = DEFAULT_MUSIC_CUE_ID;
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

    for (const soundscape of SOUNDSCAPES) {
      this.soundscapeEnabled.set(soundscape.id, this.readSoundscapeEnabled(soundscape.id));
      this.soundscapeVolumes.set(soundscape.id, this.readSoundscapeVolume(soundscape.id));
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.wasPlayingBeforeHidden = this.enabled || this.hasEnabledSoundscape();
        this.pauseAll();
        return;
      }

      if (this.wasPlayingBeforeHidden) {
        if (this.enabled) {
          this.playCue(this.currentCue, 0);
        }
        this.playEnabledSoundscapes(0);
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

  getSoundscapeVolume(id: SoundscapeId) {
    return this.soundscapeVolumes.get(id) ?? getSoundscapeCue(id).defaultVolume;
  }

  isSoundscapeEnabled(id: SoundscapeId) {
    return this.soundscapeEnabled.get(id) ?? false;
  }

  async enable() {
    this.init();

    try {
      this.ensureMusicTracks();
      this.enabled = true;
      localStorage.setItem(ENABLED_KEY, "true");
      this.enableDefaultSoundscapes();
      this.playCue(this.currentCue, FADE_IN_MS);
      this.emitChange();
      return true;
    } catch (error) {
      console.warn("Kusabi audio failed to enable.", error);
      this.enabled = false;
      localStorage.setItem(ENABLED_KEY, "false");
      this.emitError();
      return false;
    }
  }

  disable() {
    this.enabled = false;
    this.wasPlayingBeforeHidden = false;
    localStorage.setItem(ENABLED_KEY, "false");

    for (const track of this.musicTracks.values()) {
      this.fadeOutAndUnload(track);
    }
    this.musicTracks.clear();

    this.disableAllSoundscapes();
    this.emitChange();
  }

  setCue(cueId: string) {
    if (!isMusicCueId(cueId)) {
      return;
    }

    const previousCue = this.currentCue;
    this.currentCue = cueId;

    if (!this.enabled || previousCue === cueId) {
      this.emitChange();
      return;
    }

    const previous = this.musicTracks.get(previousCue);
    if (previous?.soundId !== undefined) {
      this.fadeOutAndStop(previous, FADE_OUT_MS);
    }

    this.playCue(cueId, FADE_IN_MS);
    this.emitChange();
  }

  nextCue() {
    const cueId = nextMusicCue(this.currentCue);
    this.setCue(cueId);
    return cueId;
  }

  previousCue() {
    const cueId = previousMusicCue(this.currentCue);
    this.setCue(cueId);
    return cueId;
  }

  setVolume(value: number) {
    this.volume = this.clamp(value, 0, 1);
    localStorage.setItem(VOLUME_KEY, String(this.volume));

    const current = this.musicTracks.get(this.currentCue);
    if (current?.soundId !== undefined) {
      current.howl.volume(this.volume, current.soundId);
    }

    this.emitChange();
  }

  async setSoundscapeEnabled(id: string, enabled: boolean) {
    if (!isSoundscapeId(id)) {
      return;
    }

    this.soundscapeEnabled.set(id, enabled);
    localStorage.setItem(soundscapeEnabledKey(id), String(enabled));

    if (enabled && (this.enabled || this.hasEnabledSoundscape())) {
      this.playSoundscape(id, FADE_IN_MS);
    } else {
      const track = this.soundscapeTracks.get(id);
      if (track) {
        this.fadeOutAndStop(track, FADE_OUT_MS);
        this.soundscapeTracks.delete(id);
      }
    }

    this.emitChange();
  }

  setSoundscapeVolume(id: string, value: number) {
    if (!isSoundscapeId(id)) {
      return;
    }

    const clamped = this.clamp(value, 0, 1);
    this.soundscapeVolumes.set(id, clamped);
    localStorage.setItem(soundscapeVolumeKey(id), String(clamped));

    const track = this.soundscapeTracks.get(id);
    if (track?.soundId !== undefined) {
      track.howl.volume(clamped, track.soundId);
    }

    this.emitChange();
  }

  // --- INTERNAL HELPERS ---
  private clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val));
  }

  private readVolume(): number {
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      return raw ? this.clamp(Number(raw), 0, 1) : DEFAULT_VOLUME;
    } catch {
      return DEFAULT_VOLUME;
    }
  }

  private readSoundscapeEnabled(id: SoundscapeId): boolean {
    try {
      const raw = localStorage.getItem(soundscapeEnabledKey(id));
      if (raw) {
        return raw === "true";
      }
      return getSoundscapeCue(id).defaultEnabledOnPlay;
    } catch {
      return getSoundscapeCue(id).defaultEnabledOnPlay;
    }
  }

  private readSoundscapeVolume(id: SoundscapeId): number {
    try {
      const raw = localStorage.getItem(soundscapeVolumeKey(id));
      return raw ? this.clamp(Number(raw), 0, 1) : getSoundscapeCue(id).defaultVolume;
    } catch {
      return getSoundscapeCue(id).defaultVolume;
    }
  }

  private emitChange() {
    window.dispatchEvent(new CustomEvent("kusabi:audio-change"));
  }

  private emitError() {
    window.dispatchEvent(new CustomEvent("kusabi:audio-error"));
  }

  private ensureMusicTracks() {
    for (const cue of MUSIC_CUES) {
      if (!this.musicTracks.has(cue.id)) {
        const howl = new Howl({
          src: getAudioSources(cue.srcBase),
          loop: true,
          html5: true,
          volume: this.volume,
        });
        this.musicTracks.set(cue.id, { howl });
      }
    }
  }

  private ensureSoundscapeTrack(id: SoundscapeId) {
    if (!this.soundscapeTracks.has(id)) {
      const cue = getSoundscapeCue(id);
      const howl = new Howl({
        src: getAudioSources(cue.srcBase),
        loop: true,
        html5: true,
        volume: this.getSoundscapeVolume(id),
      });
      this.soundscapeTracks.set(id, { howl });
    }
  }

  private playCue(id: MusicCueId, fadeMs: number) {
    this.ensureMusicTracks();
    const track = this.musicTracks.get(id);
    if (!track) return;

    if (track.soundId === undefined) {
      track.soundId = track.howl.play();
    } else if (!track.howl.playing(track.soundId)) {
      track.howl.play(track.soundId);
    }

    if (fadeMs > 0) {
      track.howl.fade(0, this.volume, fadeMs, track.soundId);
    } else {
      track.howl.volume(this.volume, track.soundId);
    }
  }

  private playSoundscape(id: SoundscapeId, fadeMs: number) {
    this.ensureSoundscapeTrack(id);
    const track = this.soundscapeTracks.get(id);
    if (!track) return;

    const targetVolume = this.getSoundscapeVolume(id);

    if (track.soundId === undefined) {
      track.soundId = track.howl.play();
    } else if (!track.howl.playing(track.soundId)) {
      track.howl.play(track.soundId);
    }

    if (fadeMs > 0) {
      track.howl.fade(0, targetVolume, fadeMs, track.soundId);
    } else {
      track.howl.volume(targetVolume, track.soundId);
    }
  }

  private playEnabledSoundscapes(fadeMs: number) {
    for (const id of this.soundscapeEnabled.keys()) {
      if (this.soundscapeEnabled.get(id)) {
        this.playSoundscape(id, fadeMs);
      }
    }
  }

  private enableDefaultSoundscapes() {
    for (const cue of SOUNDSCAPES) {
      const enabled = this.readSoundscapeEnabled(cue.id);
      this.soundscapeEnabled.set(cue.id, enabled);
      if (enabled) {
        this.playSoundscape(cue.id, FADE_IN_MS);
      }
    }
  }

  private disableAllSoundscapes() {
    for (const track of this.soundscapeTracks.values()) {
      this.fadeOutAndUnload(track);
    }
    this.soundscapeTracks.clear();
  }

  private pauseAll() {
    const current = this.musicTracks.get(this.currentCue);
    if (current?.soundId !== undefined) {
      current.howl.pause(current.soundId);
    }
    for (const track of this.soundscapeTracks.values()) {
      if (track.soundId !== undefined) {
        track.howl.pause(track.soundId);
      }
    }
  }

  private hasEnabledSoundscape() {
    for (const enabled of this.soundscapeEnabled.values()) {
      if (enabled) return true;
    }
    return false;
  }

  private fadeOutAndStop(track: TrackState, ms: number) {
    const id = track.soundId;
    if (id === undefined) return;

    track.howl.fade(track.howl.volume(id) as number, 0, ms, id);
    track.howl.once("fade", () => {
      // Confirm we are still faded to 0 before stopping
      if ((track.howl.volume(id) as number) === 0) {
        track.howl.stop(id);
        track.soundId = undefined;
      }
    }, id);
  }

  private fadeOutAndUnload(track: TrackState) {
    const id = track.soundId;
    if (id === undefined) {
      track.howl.unload();
      return;
    }
    track.howl.fade(track.howl.volume(id) as number, 0, 1000, id);
    track.howl.once("fade", () => {
      track.howl.stop(id);
      track.howl.unload();
      track.soundId = undefined;
    }, id);
  }
}

export const kusabiAudio = new KusabiAudio();
