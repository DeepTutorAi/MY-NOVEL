import { Howl, Howler } from "howler";
import { DEFAULT_MUSIC_CUE_ID, MUSIC_CUES, type MusicCueId } from "../../data/lodge/audio-cues";

const ENABLED_KEY = "hvitveldt:audio:enabled";
const VOLUME_KEY = "hvitveldt:audio:volume";
const DEFAULT_VOLUME = 0.4;
const TRACKS = MUSIC_CUES.map((cue) => cue.id);
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

type TrackState = {
  howl: Howl;
  soundId?: number;
};

export class AmbientAudio {
  private tracks = new Map<MusicCueId, TrackState>();
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

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.wasPlayingBeforeHidden = this.enabled;
        this.pauseCurrent();
      } else if (this.wasPlayingBeforeHidden && this.enabled) {
        this.playCue(this.currentCue, 0);
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

  nextCue() {
    const currentIndex = TRACKS.indexOf(this.currentCue);
    const next = TRACKS[(currentIndex + 1) % TRACKS.length];
    this.setCue(next);
    return next;
  }

  previousCue() {
    const currentIndex = TRACKS.indexOf(this.currentCue);
    const previous = TRACKS[(currentIndex - 1 + TRACKS.length) % TRACKS.length];
    this.setCue(previous);
    return previous;
  }

  async enable() {
    this.init();

    try {
      await this.resumeAudioContext();
      this.ensureTracks();
      this.enabled = true;
      localStorage.setItem(ENABLED_KEY, "true");
      this.playCue(this.currentCue, 4000);
      return true;
    } catch (error) {
      console.warn("Ambient audio failed to enable.", error);
      this.enabled = false;
      localStorage.setItem(ENABLED_KEY, "false");
      window.dispatchEvent(new CustomEvent("hvitveldt:audio-error"));
      return false;
    }
  }

  disable() {
    this.enabled = false;
    this.wasPlayingBeforeHidden = false;
    localStorage.setItem(ENABLED_KEY, "false");

    const tracksToDispose = Array.from(this.tracks.values());
    this.tracks.clear();

    for (const track of tracksToDispose) {
      if (track.soundId !== undefined) {
        const soundId = track.soundId;
        track.howl.fade(track.howl.volume(soundId) as number, 0, 1200, soundId);
        window.setTimeout(() => {
          track.howl.stop(soundId);
          track.howl.unload();
        }, 1300);
      } else {
        track.howl.stop();
        track.howl.unload();
      }
    }
  }

  setCue(cueId: string) {
    if (!this.isCueId(cueId)) {
      return;
    }

    const previousCue = this.currentCue;
    this.currentCue = cueId;

    if (!this.enabled || previousCue === cueId) {
      return;
    }

    const previous = this.tracks.get(previousCue);

    if (previous?.soundId !== undefined) {
      const previousSoundId = previous.soundId;
      previous.howl.fade(previous.howl.volume(previousSoundId) as number, 0, 2000, previousSoundId);
      window.setTimeout(() => previous.howl.stop(previousSoundId), 2100);
    }

    this.playCue(cueId, 4000);
  }

  setVolume(value: number) {
    this.volume = Math.min(1, Math.max(0, value));
    localStorage.setItem(VOLUME_KEY, String(this.volume));

    const current = this.tracks.get(this.currentCue);
    if (current?.soundId !== undefined) {
      current.howl.volume(this.volume, current.soundId);
    }
  }

  destroy() {
    this.disable();
    this.initialized = false;
  }

  private ensureTracks() {
    for (const cue of MUSIC_CUES) {
      if (this.tracks.has(cue.id)) {
        continue;
      }

      const howl = new Howl({
        src: getAudioSources(cue.srcBase),
        loop: true,
        html5: true,
        preload: false,
        volume: 0,
        onloaderror: (_, error) => this.handleLoadError(error),
        onplayerror: (_, error) => this.handlePlayError(cue.id, error),
      });

      this.tracks.set(cue.id, { howl });
    }
  }

  private playCue(cueId: MusicCueId, fadeDuration: number) {
    const track = this.tracks.get(cueId);

    if (!track || document.visibilityState === "hidden") {
      return;
    }

    if (track.howl.state() === "unloaded") {
      track.howl.load();
    }

    if (track.soundId === undefined || !track.howl.playing(track.soundId)) {
      track.soundId = track.howl.play();
    }

    track.howl.volume(0, track.soundId);
    track.howl.fade(0, this.volume, fadeDuration, track.soundId);
  }

  private pauseCurrent() {
    const current = this.tracks.get(this.currentCue);

    if (current?.soundId !== undefined && current.howl.playing(current.soundId)) {
      current.howl.pause(current.soundId);
    }
  }

  private readVolume() {
    const raw = localStorage.getItem(VOLUME_KEY);
    const parsed = raw ? Number(raw) : DEFAULT_VOLUME;
    return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : DEFAULT_VOLUME;
  }

  private async resumeAudioContext() {
    const context = Howler.ctx;

    if (context?.state === "suspended") {
      await context.resume();
    }
  }

  private handleLoadError(error: unknown) {
    console.warn("Ambient audio track failed to load.", error);
    window.dispatchEvent(new CustomEvent("hvitveldt:audio-error"));
  }

  private handlePlayError(cueId: MusicCueId, error: unknown) {
    console.warn("Ambient audio track failed to play.", error);
    const track = this.tracks.get(cueId);
    track?.howl.once("unlock", () => {
      if (this.enabled) {
        this.playCue(cueId, 4000);
      }
    });
    window.dispatchEvent(new CustomEvent("hvitveldt:audio-error"));
  }

  private isCueId(value: string): value is MusicCueId {
    return TRACKS.includes(value as MusicCueId);
  }
}

export const ambientAudio = new AmbientAudio();
