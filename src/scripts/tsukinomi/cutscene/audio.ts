// Audio for the cutscene scenes: one object per cutscene that wraps the
// existing Walkman (src/scripts/tsukinomi/walkman-state.ts). There is exactly
// one audio graph on the page, the Walkman's; this module never creates a
// Howl or an Audio element of its own. session.ts passes the walkmanAudio
// singleton in; tests pass a fake, which keeps this file free of Howler.
//
// Rules, from design section 4.2 ("Audio starts only after a user gesture"):
//
//   - A scene is silent unless the Walkman is already on and not turned down
//     to nothing (available()): the reader made a gesture and has not muted
//     it. Every method that makes sound is then a silent no-op, and sfx() is
//     also quiet while the tab is hidden.
//   - The one exception is requestPlayFromGesture(), which the prologue's play
//     button calls from inside its click handler to switch the Walkman on.
//   - When the cutscene ends, restore() puts back what the scene itself
//     changed, and only that: the soundscapes it layered (toggle and volume),
//     and the cue. It does not undo what the Walkman did on its own when the
//     reader pressed play inside the scene (the default hiss), because that is
//     what pressing play in the Walkman panel gives too. The Walkman's previous
//     enabled state comes back, except when the reader switched it on inside
//     the scene: that press is the reader's own action, so the Walkman stays on
//     and the music continues with the part cue into reading (design section 5:
//     cues continue into reading).
//   - restore() also runs when the Walkman has been switched off in the
//     meantime (leaving /tsukinomi/ mid-scene disables it first): the volumes
//     the scene changed are still handed back, since they are persisted.
//     session.ts calls it on pagehide too, so a reload or a closed tab does not
//     leave a layered soundscape persisted either.
//
// The scene-facing summary lives in scene-types.ts next to TsukiSceneContext.
import {
  DEFAULT_MUSIC_CUE_ID,
  SOUNDSCAPES,
  type MusicCueId,
  type SoundscapeId,
} from "../../../data/tsukinomi/music-cues";
import type { SfxId, WalkmanAudio } from "../walkman-state";

export type SceneSfxId = SfxId;

const SFX_IDS: readonly SceneSfxId[] = ["tape-click", "tape-rewind"];

/** What SceneAudio uses of WalkmanAudio; a fake implements it in the unit test. */
export type WalkmanLike = Pick<
  WalkmanAudio,
  | "init"
  | "isEnabled"
  | "enable"
  | "disable"
  | "getVolume"
  | "setVolume"
  | "getCurrentCue"
  | "setCue"
  | "isSoundscapeEnabled"
  | "getSoundscapeVolume"
  | "setSoundscapeEnabled"
  | "setSoundscapeVolume"
  | "playSfx"
>;

export interface SoundscapeSnapshot {
  enabled: boolean;
  volume: number;
}

/** The Walkman state a cutscene must hand back. */
export interface AudioSnapshot {
  /** The Walkman is on. */
  enabled: boolean;
  /** Master (music) volume, 0 to 1. */
  volume: number;
  /** The cue the Walkman is on, playing or not. */
  cue: MusicCueId;
  soundscapes: Readonly<Record<SoundscapeId, SoundscapeSnapshot>>;
}

export interface RestoreOptions {
  /**
   * Keep the Walkman on if it was off when the scene began. Default: true
   * exactly when the reader switched it on through requestPlayFromGesture()
   * in this scene. Pass false to force the previous enabled state back.
   */
  keepPlaying?: boolean;
  /**
   * The cue the reading page wants (the section's music cue). Default: the
   * cue at the start, or, when the Walkman stays on, the cue it is on now.
   * session.ts passes the page cue, since the page can set its cue after the
   * scene took its snapshot.
   */
  cue?: MusicCueId;
}

export interface SceneAudio {
  /** The live Walkman state. The copy restore() returns to was taken when this object was created. */
  snapshot(): AudioSnapshot;
  /**
   * True only while the Walkman is on with its volume above zero. Scenes can
   * branch on it, but they do not have to: every method below is already a
   * silent no-op when false.
   */
  available(): boolean;
  /** Switches the Walkman to a music cue; the music cross-fades. */
  setCue(id: MusicCueId): void;
  /**
   * Switches a soundscape on for the length of the scene and, when given,
   * sets its volume (0 to 0.7). restore() puts the toggle and volume back.
   */
  layerSoundscape(id: SoundscapeId, volume?: number): void;
  /** One-shot tape sound effect. */
  sfx(id: SceneSfxId): void;
  /**
   * Switches the Walkman on. Call it synchronously from the click or key
   * handler of a control the reader pressed (the prologue's play button): the
   * browser only allows audio to start inside a user gesture. Resolves true if
   * the Walkman is on afterwards. The Walkman plays its own tape-click when it
   * turns on, so the scene must not add another. `cue`, when given, is
   * selected first so the right music fades in. Works whether or not
   * available() was true; it is the only method that does.
   */
  requestPlayFromGesture(cue?: MusicCueId): Promise<boolean>;
  /**
   * Hands back what the scene changed; see the file header. The session
   * (session.ts) calls it when the cutscene ends and on pagehide, whichever
   * comes first. Safe to call twice.
   */
  restore(options?: RestoreOptions): void;
  /** True once requestPlayFromGesture() switched the Walkman on in this scene. */
  readonly startedFromGesture: boolean;
}

const noop = () => {};

function readSnapshot(walkman: WalkmanLike): AudioSnapshot {
  const soundscapes = {} as Record<SoundscapeId, SoundscapeSnapshot>;
  for (const { id } of SOUNDSCAPES) {
    soundscapes[id] = { enabled: walkman.isSoundscapeEnabled(id), volume: walkman.getSoundscapeVolume(id) };
  }
  return {
    enabled: walkman.isEnabled(),
    volume: walkman.getVolume(),
    cue: walkman.getCurrentCue(),
    soundscapes,
  };
}

/** The reader's tab is in the background. Injectable so the unit test needs no document. */
const documentHidden = () => typeof document !== "undefined" && document.hidden;

export function createSceneAudio(walkman: WalkmanLike, isHidden: () => boolean = documentHidden): SceneAudio {
  // Loads the persisted volumes and toggles; idempotent (the Walkman panel calls it too).
  walkman.init();
  const before = readSnapshot(walkman);
  // What the scene changed, as it was before the scene's first change to it.
  const layered = new Map<SoundscapeId, SoundscapeSnapshot>();
  let startedFromGesture = false;
  let restored = false;

  // A master volume of 0 is how the Walkman panel mutes: it has no separate switch.
  const available = () => walkman.isEnabled() && walkman.getVolume() > 0;

  return {
    snapshot: () => readSnapshot(walkman),
    available,

    setCue(id) {
      if (available()) walkman.setCue(id);
    },

    layerSoundscape(id, volume) {
      if (!available()) return;
      if (!layered.has(id)) {
        layered.set(id, { enabled: walkman.isSoundscapeEnabled(id), volume: walkman.getSoundscapeVolume(id) });
      }
      if (volume !== undefined) walkman.setSoundscapeVolume(id, volume);
      if (!walkman.isSoundscapeEnabled(id)) void walkman.setSoundscapeEnabled(id, true).catch(noop);
    },

    sfx(id) {
      if (available() && !isHidden() && SFX_IDS.includes(id)) walkman.playSfx(id);
    },

    async requestPlayFromGesture(cue) {
      if (walkman.isEnabled()) return true;
      // enable() starts the audio context synchronously, so everything up to
      // here must stay before the first await: it is what the gesture pays for.
      if (cue !== undefined) walkman.setCue(cue);
      const enabled = await walkman.enable();
      if (enabled) startedFromGesture = true;
      return enabled;
    },

    restore(options = {}) {
      if (restored) return;
      restored = true;
      const on = walkman.isEnabled();

      // What the scene layered goes back first. With the Walkman off its
      // toggles are already all off, but a volume the scene set is persisted.
      for (const [id, was] of layered) {
        if (walkman.getSoundscapeVolume(id) !== was.volume) walkman.setSoundscapeVolume(id, was.volume);
        if (on && walkman.isSoundscapeEnabled(id) !== was.enabled) void walkman.setSoundscapeEnabled(id, was.enabled).catch(noop);
      }
      // Nothing else to hand back while the Walkman is off: a press that
      // failed to switch it on left it off.
      if (!on) return;

      const keepPlaying = options.keepPlaying ?? startedFromGesture;
      if (!before.enabled && !keepPlaying) {
        walkman.disable();
        return;
      }

      if (walkman.getVolume() !== before.volume) walkman.setVolume(before.volume);
      const cue = options.cue ?? (keepPlaying ? walkman.getCurrentCue() : before.cue);
      if (cue !== walkman.getCurrentCue()) walkman.setCue(cue);
    },

    get startedFromGesture() {
      return startedFromGesture;
    },
  };
}

/** The audio of a still (reduced-motion) scene, and of a scene with no Walkman: everything is a no-op. */
export function createSilentSceneAudio(): SceneAudio {
  const soundscapes = {} as Record<SoundscapeId, SoundscapeSnapshot>;
  for (const { id, defaultVolume } of SOUNDSCAPES) soundscapes[id] = { enabled: false, volume: defaultVolume };
  const snapshot: AudioSnapshot = { enabled: false, volume: 0, cue: DEFAULT_MUSIC_CUE_ID, soundscapes };
  return {
    snapshot: () => snapshot,
    available: () => false,
    setCue: noop,
    layerSoundscape: noop,
    sfx: noop,
    requestPlayFromGesture: () => Promise.resolve(false),
    restore: noop,
    startedFromGesture: false,
  };
}
