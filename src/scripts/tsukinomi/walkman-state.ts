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
} from "../../data/tsukinomi/music-cues";

const ENABLED_KEY = "tsukinomi:audio:enabled";
const VOLUME_KEY = "tsukinomi:audio:volume";
const DEFAULT_VOLUME = 0.32;
const FADE_IN_MS = 4_000;
const FADE_OUT_MS = 2_000;
const SFX_VOLUME = 0.42;
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
  "cassette-hiss": "tsukinomi:soundscape:cassette-hiss:enabled",
  "distant-train": "tsukinomi:soundscape:distant-train:enabled",
  "mountain-wind": "tsukinomi:soundscape:mountain-wind:enabled",
} satisfies Record<SoundscapeId, string>;
const SOUNDSCAPE_VOLUME_KEYS = {
  "cassette-hiss": "tsukinomi:soundscape:cassette-hiss:volume",
  "distant-train": "tsukinomi:soundscape:distant-train:volume",
  "mountain-wind": "tsukinomi:soundscape:mountain-wind:volume",
} satisfies Record<SoundscapeId, string>;
const soundscapeEnabledKey = (id: SoundscapeId) => SOUNDSCAPE_ENABLED_KEYS[id];
const soundscapeVolumeKey = (id: SoundscapeId) => SOUNDSCAPE_VOLUME_KEYS[id];

type TrackState = {
  howl: Howl;
  soundId?: number;
};

type SfxId = "tape-click" | "tape-rewind";

export class WalkmanAudio {
  private musicTracks = new Map<MusicCueId, TrackState>();
  private soundscapeTracks = new Map<SoundscapeId, TrackState>();
  private sfxTracks = new Map<SfxId, Howl>();
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
      this.playOneShot("tape-click");
      this.emitChange();
      return true;
    } catch (error) {
      console.warn("Tsukinomi Walkman audio failed to enable.", error);
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
    this.playOneShot("tape-click");

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
    this.playOneShot("tape-rewind");
    return cueId;
  }

  previousCue() {
    const cueId = previousMusicCue(this.currentCue);
    this.setCue(cueId);
    this.playOneShot("tape-rewind");
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
      return false;
    }

    this.init();
    this.soundscapeEnabled.set(id, enabled);
    localStorage.setItem(soundscapeEnabledKey(id), String(enabled));

    if (!enabled) {
      const track = this.soundscapeTracks.get(id);
      if (track) {
        this.fadeOutAndUnload(track);
        this.soundscapeTracks.delete(id);
      }

      this.emitChange();
      return true;
    }

    try {
      this.ensureSoundscapeTrack(id);
      this.playSoundscape(id, FADE_IN_MS);
      this.emitChange();
      return true;
    } catch (error) {
      console.warn("Tsukinomi soundscape failed to enable.", error);
      this.soundscapeEnabled.set(id, false);
      localStorage.setItem(soundscapeEnabledKey(id), "false");
      this.emitError();
      return false;
    }
  }

  setSoundscapeVolume(id: string, value: number) {
    if (!isSoundscapeId(id)) {
      return;
    }

    const volume = this.clamp(value, 0, 0.7);
    this.soundscapeVolumes.set(id, volume);
    localStorage.setItem(soundscapeVolumeKey(id), String(volume));

    const track = this.soundscapeTracks.get(id);
    if (track?.soundId !== undefined) {
      track.howl.volume(volume, track.soundId);
    }

    this.emitChange();
  }

  destroy() {
    this.disable();
    for (const howl of this.sfxTracks.values()) {
      howl.unload();
    }
    this.sfxTracks.clear();
    this.initialized = false;
  }

  private ensureMusicTracks() {
    for (const cue of MUSIC_CUES) {
      if (this.musicTracks.has(cue.id)) {
        continue;
      }

      const howl = new Howl({
        src: getAudioSources(cue.srcBase),
        loop: true,
        html5: false,
        preload: false,
        volume: 0,
        onloaderror: (_, error) => this.handleLoadError(error),
        onplayerror: (_, error) => this.handlePlayError(cue.id, error),
      });

      this.musicTracks.set(cue.id, { howl });
    }
  }

  private ensureSoundscapeTrack(id: SoundscapeId) {
    if (this.soundscapeTracks.has(id)) {
      return;
    }

    const cue = getSoundscapeCue(id);
    const howl = new Howl({
      src: getAudioSources(cue.srcBase),
      loop: true,
      html5: false,
      preload: false,
      volume: 0,
      onloaderror: (_, error) => this.handleLoadError(error),
      onplayerror: (_, error) => this.handleSoundscapePlayError(id, error),
    });

    this.soundscapeTracks.set(id, { howl });
  }

  private ensureSfx(id: SfxId) {
    const existing = this.sfxTracks.get(id);
    if (existing) {
      return existing;
    }

    const howl = new Howl({
      src: [assetPath(`/assets/tsukinomi/audio/sfx/${id}.mp3`)],
      html5: false,
      preload: false,
      volume: SFX_VOLUME,
      onloaderror: (_, error) => this.handleLoadError(error),
    });

    this.sfxTracks.set(id, howl);
    return howl;
  }

  private playCue(cueId: MusicCueId, fadeDuration: number) {
    if (document.visibilityState === "hidden") {
      return;
    }

    this.ensureMusicTracks();
    const track = this.musicTracks.get(cueId);

    if (!track) {
      return;
    }

    // Tracks are created with preload:false, so the file isn't fetched until asked for.
    // Howler's play() only queues while a track is unloaded — it won't start the download
    // on its own — so trigger the load here or the queued play never fires (no sound).
    if (track.howl.state() === "unloaded") {
      track.howl.load();
    }

    if (track.soundId === undefined || !track.howl.playing(track.soundId)) {
      track.soundId = track.howl.play();
    }

    track.howl.volume(0, track.soundId);
    track.howl.fade(0, this.volume, fadeDuration, track.soundId);
  }

  private playSoundscape(id: SoundscapeId, fadeDuration: number) {
    if (document.visibilityState === "hidden") {
      return;
    }

    this.ensureSoundscapeTrack(id);
    const track = this.soundscapeTracks.get(id);

    if (!track) {
      return;
    }

    if (track.howl.state() === "unloaded") {
      track.howl.load();
    }

    if (track.soundId === undefined || !track.howl.playing(track.soundId)) {
      track.soundId = track.howl.play();
    }

    const volume = this.getSoundscapeVolume(id);
    track.howl.volume(0, track.soundId);
    track.howl.fade(0, volume, fadeDuration, track.soundId);
  }

  private playEnabledSoundscapes(fadeDuration: number) {
    for (const soundscape of SOUNDSCAPES) {
      if (this.isSoundscapeEnabled(soundscape.id)) {
        this.playSoundscape(soundscape.id, fadeDuration);
      }
    }
  }

  private enableDefaultSoundscapes() {
    for (const soundscape of SOUNDSCAPES) {
      const key = soundscapeEnabledKey(soundscape.id);
      const persisted = localStorage.getItem(key);
      const shouldEnable = persisted === null ? soundscape.defaultEnabledOnPlay : persisted === "true";

      this.soundscapeEnabled.set(soundscape.id, shouldEnable);
      localStorage.setItem(key, String(shouldEnable));

      if (shouldEnable) {
        this.playSoundscape(soundscape.id, FADE_IN_MS);
      }
    }
  }

  private disableAllSoundscapes() {
    for (const soundscape of SOUNDSCAPES) {
      this.soundscapeEnabled.set(soundscape.id, false);
      localStorage.setItem(soundscapeEnabledKey(soundscape.id), "false");
    }

    for (const track of this.soundscapeTracks.values()) {
      this.fadeOutAndUnload(track);
    }

    this.soundscapeTracks.clear();
  }

  private pauseAll() {
    for (const track of [...this.musicTracks.values(), ...this.soundscapeTracks.values()]) {
      if (track.soundId !== undefined && track.howl.playing(track.soundId)) {
        track.howl.pause(track.soundId);
      }
    }
  }

  private hasEnabledSoundscape() {
    return SOUNDSCAPES.some((soundscape) => this.isSoundscapeEnabled(soundscape.id));
  }

  private fadeOutAndStop(track: TrackState, duration: number) {
    if (track.soundId === undefined) {
      track.howl.stop();
      return;
    }

    const soundId = track.soundId;
    track.howl.fade(track.howl.volume(soundId) as number, 0, duration, soundId);
    window.setTimeout(() => track.howl.stop(soundId), duration + 100);
  }

  private fadeOutAndUnload(track: TrackState) {
    if (track.soundId === undefined) {
      track.howl.stop();
      track.howl.unload();
      return;
    }

    const soundId = track.soundId;
    track.howl.fade(track.howl.volume(soundId) as number, 0, FADE_OUT_MS, soundId);
    window.setTimeout(() => {
      track.howl.stop(soundId);
      track.howl.unload();
    }, FADE_OUT_MS + 100);
  }

  private playOneShot(id: SfxId) {
    try {
      const howl = this.ensureSfx(id);
      if (howl.state() === "unloaded") {
        howl.load();
      }
      howl.volume(SFX_VOLUME);
      howl.play();
    } catch {
      this.emitError();
    }
  }

  private readVolume() {
    const raw = localStorage.getItem(VOLUME_KEY);
    const parsed = raw ? Number(raw) : DEFAULT_VOLUME;
    return Number.isFinite(parsed) ? this.clamp(parsed, 0, 1) : DEFAULT_VOLUME;
  }

  private readSoundscapeEnabled(id: SoundscapeId) {
    return localStorage.getItem(soundscapeEnabledKey(id)) === "true";
  }

  private readSoundscapeVolume(id: SoundscapeId) {
    const cue = getSoundscapeCue(id);
    const raw = localStorage.getItem(soundscapeVolumeKey(id));
    const parsed = raw ? Number(raw) : cue.defaultVolume;
    return Number.isFinite(parsed) ? this.clamp(parsed, 0, 0.7) : cue.defaultVolume;
  }

  private handlePlayError(cueId: MusicCueId, error: unknown) {
    console.warn("Tsukinomi music cue failed to play.", error);
    const track = this.musicTracks.get(cueId);
    track?.howl.once("unlock", () => {
      if (this.enabled) {
        this.playCue(cueId, FADE_IN_MS);
      }
    });
    this.enabled = false;
    localStorage.setItem(ENABLED_KEY, "false");
    this.disableAllSoundscapes();
    this.emitError();
  }

  private handleSoundscapePlayError(id: SoundscapeId, error: unknown) {
    console.warn("Tsukinomi soundscape failed to play.", error);
    const track = this.soundscapeTracks.get(id);
    track?.howl.once("unlock", () => {
      if (this.isSoundscapeEnabled(id)) {
        this.playSoundscape(id, FADE_IN_MS);
      }
    });
    this.soundscapeEnabled.set(id, false);
    localStorage.setItem(soundscapeEnabledKey(id), "false");
    this.emitError();
  }

  private handleLoadError(error: unknown) {
    console.warn("Tsukinomi Walkman audio asset failed to load.", error);
    this.emitError();
  }

  private emitChange() {
    window.dispatchEvent(new CustomEvent("tsukinomi:audio-change"));
  }

  private emitError() {
    window.dispatchEvent(new CustomEvent("tsukinomi:audio-error"));
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }
}

export const walkmanAudio = new WalkmanAudio();
