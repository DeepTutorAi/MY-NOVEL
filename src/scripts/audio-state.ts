import { Howl, Howler } from "howler";

const ENABLED_KEY = "hvitveldt:audio:enabled";
const VOLUME_KEY = "hvitveldt:audio:volume";
const DEFAULT_VOLUME = 0.4;
const TRACKS = [1, 2, 3, 4] as const;
const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

type ActNumber = (typeof TRACKS)[number];

type TrackState = {
  howl: Howl;
  soundId?: number;
};

export class AmbientAudio {
  private tracks = new Map<ActNumber, TrackState>();
  private currentAct: ActNumber = 1;
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
        this.playAct(this.currentAct, 0);
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
      await this.resumeAudioContext();
      this.ensureTracks();
      this.enabled = true;
      localStorage.setItem(ENABLED_KEY, "true");
      this.playAct(this.currentAct, 4000);
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

  setAct(act: number) {
    if (!this.isActNumber(act)) {
      return;
    }

    const previousAct = this.currentAct;
    this.currentAct = act;

    if (!this.enabled || previousAct === act) {
      return;
    }

    const previous = this.tracks.get(previousAct);

    if (previous?.soundId !== undefined) {
      const previousSoundId = previous.soundId;
      previous.howl.fade(previous.howl.volume(previousSoundId) as number, 0, 2000, previousSoundId);
      window.setTimeout(() => previous.howl.stop(previousSoundId), 2100);
    }

    this.playAct(act, 4000);
  }

  setVolume(value: number) {
    this.volume = Math.min(1, Math.max(0, value));
    localStorage.setItem(VOLUME_KEY, String(this.volume));

    const current = this.tracks.get(this.currentAct);
    if (current?.soundId !== undefined) {
      current.howl.volume(this.volume, current.soundId);
    }
  }

  destroy() {
    this.disable();
    this.initialized = false;
  }

  private ensureTracks() {
    for (const act of TRACKS) {
      if (this.tracks.has(act)) {
        continue;
      }

      const howl = new Howl({
        src: [assetPath(`/assets/audio/ambient-act${act}.ogg`), assetPath(`/assets/audio/ambient-act${act}.mp3`)],
        loop: true,
        html5: false,
        preload: true,
        volume: 0,
        onloaderror: (_, error) => this.handleLoadError(error),
        onplayerror: (_, error) => this.handleLoadError(error),
      });

      this.tracks.set(act, { howl });
    }
  }

  private playAct(act: ActNumber, fadeDuration: number) {
    const track = this.tracks.get(act);

    if (!track || document.visibilityState === "hidden") {
      return;
    }

    if (track.soundId === undefined || !track.howl.playing(track.soundId)) {
      track.soundId = track.howl.play();
    }

    track.howl.volume(0, track.soundId);
    track.howl.fade(0, this.volume, fadeDuration, track.soundId);
  }

  private pauseCurrent() {
    const current = this.tracks.get(this.currentAct);

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
    this.disable();
    window.dispatchEvent(new CustomEvent("hvitveldt:audio-error"));
  }

  private isActNumber(value: number): value is ActNumber {
    return TRACKS.includes(value as ActNumber);
  }
}

export const ambientAudio = new AmbientAudio();
