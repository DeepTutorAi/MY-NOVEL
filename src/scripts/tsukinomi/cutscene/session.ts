// Everything a scene needs while a cutscene is playing, built once per
// cutscene: its TsukiSceneContext, its audio and the canvas loops it creates.
// index.ts imports this module dynamically, together with the scene, so none
// of it (scene-runtime, the Walkman wrapper) loads on a visit where the
// cutscene will not play.
//
// The one place in the cutscene code that touches the Walkman singleton:
// audio goes through walkmanAudio (src/scripts/tsukinomi/walkman-state.ts),
// the page's single audio graph, via the wrapper in audio.ts. Nothing here
// creates a Howl or an Audio element.
//
// Ending a session is two steps, in this order, so a scene's own dispose() runs
// after its signal aborted and before its loops and audio are taken away:
//
//   abort()    aborts ctx.signal
//   dispose()  destroys the canvas loops still alive and hands the audio back
//
// The Walkman persists every toggle and volume the moment it is set, so a scene
// that layered a soundscape would leave it persisted if the page were closed or
// reloaded mid-scene (no dispose runs then). The session therefore also hands
// the audio back on pagehide. (A page that the browser later restores from its
// back/forward cache carries on silently: the audio was already handed back.)
import { isMusicCueId, type MusicCueId } from "../../../data/tsukinomi/music-cues";
import { withBase } from "../../../utils/base-path";
import { createScene } from "../../_shared/scene-runtime";
import { walkmanAudio } from "../walkman-state";
import { createSceneAudio, createSilentSceneAudio, type SceneAudio } from "./audio";
import { resolveAssets, type TsukiRegistryEntry } from "./registry";
import type { TsukiCanvasLoop, TsukiCanvasLoopOptions, TsukiSceneContext } from "./scene-types";

const DEFAULT_DPR_CAP = 1.5;

export interface SessionInit {
  dialog: HTMLDialogElement;
  stage: HTMLElement;
  textEl: HTMLElement;
  part: number;
  entry: TsukiRegistryEntry;
  /** True for the reduced-motion still: silent audio, ctx.reducedMotion set. */
  reducedMotion: boolean;
  /** The runner's skip(), offered to the scene as ctx.skip(). */
  skip(): void;
  /** The music cue the reading page wants (the section's musicCueId); the audio goes back to it at the end. */
  pageCue?: string;
}

/** What the session builds on; the defaults are the real thing, a test passes fakes. */
export interface SessionDeps {
  /** Default: the page's Walkman (silent for a reduced-motion session). */
  audio?: SceneAudio;
  /** Default: _shared/scene-runtime's createScene. */
  createScene?: typeof createScene;
  /** Default: src/utils/base-path's withBase, which needs the bundler's import.meta.env. */
  withBase?: (path: string) => string;
}

export interface TsukiSession {
  readonly ctx: TsukiSceneContext;
  /** Stops the frame loops (the runner calls it when a finish begins, so the fade runs over a still frame). */
  pause(): void;
  /** Aborts ctx.signal. Idempotent. */
  abort(): void;
  /** Destroys the loops still alive and restores the Walkman. Aborts first if needed. Idempotent. */
  dispose(): void;
}

export function createSession(init: SessionInit, deps: SessionDeps = {}): TsukiSession {
  const controller = new AbortController();
  const loops = new Set<TsukiCanvasLoop>();
  const audio = deps.audio ?? (init.reducedMotion ? createSilentSceneAudio() : createSceneAudio(walkmanAudio));
  const makeScene = deps.createScene ?? createScene;
  // The section's cue arrives as a data attribute; anything that is not a cue is no cue.
  const pageCue: MusicCueId | undefined = init.pageCue !== undefined && isMusicCueId(init.pageCue) ? init.pageCue : undefined;
  let disposed = false;

  const createCanvasLoop = (options: TsukiCanvasLoopOptions): TsukiCanvasLoop => {
    const canvas = document.createElement("canvas");
    canvas.className = ["tsuki-cutscene__canvas", options.className].filter(Boolean).join(" ");
    canvas.setAttribute("aria-hidden", "true");
    init.stage.append(canvas);
    const scene = makeScene({
      canvas,
      container: init.stage,
      dprCap: options.dprCap ?? DEFAULT_DPR_CAP,
      render: options.render,
      resize: options.resize ?? (() => {}),
      onPointer: options.onPointer,
      reducedMotionFrame: options.reducedMotionFrame,
    });
    let destroyed = false;
    const loop: TsukiCanvasLoop = {
      canvas,
      start: () => scene.start(),
      stop: () => scene.stop(),
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        scene.destroy();
        canvas.remove();
        loops.delete(loop);
      },
    };
    loops.add(loop);
    return loop;
  };

  const ctx: TsukiSceneContext = {
    dialog: init.dialog,
    stage: init.stage,
    textEl: init.textEl,
    part: init.part,
    skip: init.skip,
    signal: controller.signal,
    reducedMotion: init.reducedMotion,
    assets: resolveAssets(init.entry.assets, deps.withBase ?? withBase),
    audio,
    createCanvasLoop,
  };

  const abort = () => controller.abort();
  const onPageHide = () => audio.restore({ cue: pageCue });
  window.addEventListener("pagehide", onPageHide);

  return {
    ctx,
    pause() {
      for (const loop of loops) loop.stop();
    },
    abort,
    dispose() {
      if (disposed) return;
      disposed = true;
      window.removeEventListener("pagehide", onPageHide);
      abort();
      for (const loop of [...loops]) loop.destroy();
      audio.restore({ cue: pageCue });
    },
  };
}
