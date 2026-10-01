// The contract between the Tsukinomi cutscene adapter (index.ts, session.ts)
// and the six scene modules under ./scenes. Types only: nothing here runs.
//
// A scene module is one file, scenes/<scene-id>.ts, that exports two functions:
//
//   export function play(ctx: TsukiSceneContext): TsukiSceneHandle
//   export function still(ctx: TsukiSceneContext): void
//
// The registry (registry.ts) maps a part number to the module, which is only
// ever loaded by a dynamic import(), and only when the cutscene is going to
// play (the cooldown, ?resume=1 and history traversal keep the chunk unloaded).
//
// What the runner (src/scripts/_shared/cutscene/runner.ts) owns, and a scene
// must not touch:
//
//   - the dialog: showModal(), focus, the Skip button, Escape, the page scroll
//     lock, the fade-out, closing, focus return and the played-today stamp;
//   - the "เดินทางต่อ" button shown in the reduced-motion still.
//
// What a scene owns: its own drawing inside ctx.stage, the animation of
// ctx.textEl, its canvas loops, timers and listeners, and the moment it ends.
//
// Ending. A scene ends by resolving handle.done at its natural end; the runner
// then fades the dialog out. A scene never closes the dialog itself; the
// reader's Skip and Escape (or ctx.skip()) end it early. Either way the runner
// then calls handle.dispose(), after aborting ctx.signal. After that point the
// scene must not draw, start audio or resolve anything else.
//
// The epigraph text. ctx.textEl is the real DOM paragraph the server rendered
// (#cutscene-text): its text is what screen readers read, so a scene may
// animate its classes, style, opacity or split it into per-character spans
// (src/scripts/_shared/cutscene/graphemes.ts keeps Thai vowel and tone marks
// with their consonant), but must never remove or replace its text. Its
// textContent must still equal the epigraph at every moment. Decorative layers
// (canvas, SVG, particles) go in ctx.stage, which is aria-hidden and sits
// behind the text in paint order, so a decoration never covers the text.
//
// Large text. When the reader's text size makes the epigraph taller than the
// screen the dialog scrolls (nothing else does: the page behind is locked), and
// the text card moves over the stage while the stage and the Skip button stay
// put. So never assume where the text is: read its getBoundingClientRect() when
// you need it. Pointer input reaches a scene through scene-runtime's window
// listeners; a scroll gesture ends in a pointercancel, which a scene that
// tracks a drag has to handle.
//
// Reduced motion. still() draws the single static composition: the epigraph
// visible with no animation, no canvas loop, no timer that changes what is
// on screen, and no audio. The runner calls still() instead of play() when the
// reader prefers reduced motion; ctx.reducedMotion is true then and ctx.audio
// is silent. The same module is loaded for both, so keep heavy code behind a
// dynamic import() inside play() if the still should stay cheap.
//
// Audio. Scenes are silent unless the Walkman is already on; see audio.ts. The
// only audio path is ctx.audio, which wraps the page's one Walkman graph.
//
// Styles. A scene keeps its CSS in a sibling file and loads it with
// `import css from "./<scene-id>.css?inline"` plus injectSceneStyles(css,
// ctx.signal) from ../styles, in play() and in still(). Never a bare
// `import "./x.css"`: Astro would hoist it into every section page's stylesheet.
// No z-index in it: the dialog is in the top layer and the stage, text and
// Skip button are ordered by the DOM.
import type { SceneHandle, SceneOptions } from "../../_shared/scene-runtime";
import type { SceneAudio } from "./audio";

/** Icon assets a scene may use (public/assets/tsukinomi/icons/<id>.svg). */
export type TsukiIconId = "walkman" | "cassette-mark";

/**
 * Resolved URLs of the part's visual assets. Every URL already carries the
 * site base (`/` in development and `/MY-NOVEL/` on GitHub Pages, through
 * src/utils/base-path), so use them as they are.
 */
export interface TsukiSceneAssets {
  /**
   * Value for the CSS `background-image` property: the part's section
   * background as an image-set() of avif, webp and jpg, or `none` for a part
   * whose plate is plain black (the prologue).
   */
  readonly backgroundCss: string;
  /**
   * The same background as one plain URL (webp), for drawImage() or an <img>.
   * null for a black plate. Wait for the image to load before drawing it.
   */
  readonly backgroundUrl: string | null;
  /** The icons the registry lists for the part; an icon it does not list is absent. */
  readonly icons: Readonly<Partial<Record<TsukiIconId, string>>>;
}

export interface TsukiCanvasLoopOptions {
  /** Draws one frame. The context is pre-scaled, so draw in CSS pixels; see SceneFrame. */
  render: SceneOptions["render"];
  /** Called after the backing store changed (context state is reset then). Default: nothing. */
  resize?: SceneOptions["resize"];
  onPointer?: SceneOptions["onPointer"];
  /** The composed still frame; only used if the scene also runs the loop under reduced motion. */
  reducedMotionFrame?: SceneOptions["reducedMotionFrame"];
  /** Cap on devicePixelRatio for the backing store. Default 1.5: a cutscene is not a place for a 3x canvas. */
  dprCap?: number;
  /** Extra class for the canvas, for styling. */
  className?: string;
}

/**
 * A canvas that fills ctx.stage with a frame loop on _shared/scene-runtime:
 * frame-time clamping, pause while the tab is hidden, a debounced resize,
 * live reduced-motion and a unified pointer. Created stopped: call start().
 * The adapter destroys every loop still alive when the cutscene ends, so a
 * scene that forgets cannot leak one; destroy() is idempotent.
 */
export interface TsukiCanvasLoop extends SceneHandle {
  readonly canvas: HTMLCanvasElement;
}

export interface TsukiSceneContext {
  /** The top-layer <dialog>. Read-only for a scene: the runner opens, closes and focuses it. */
  readonly dialog: HTMLDialogElement;
  /** aria-hidden host for the scene's own canvas and decoration. Fills the screen and stays put when the dialog scrolls; behind the text. */
  readonly stage: HTMLElement;
  /** The real epigraph paragraph (#cutscene-text). Animate it; never remove or replace its text. */
  readonly textEl: HTMLElement;
  /** 0 for the prologue, 1 to 5 for the parts. */
  readonly part: number;
  /** Ends the cutscene early, exactly as if the reader pressed Skip. Does nothing once it is ending. */
  skip(): void;
  /**
   * Aborted when the cutscene is over for any reason: the reader skipped, the
   * scene ended, or the page is being left. Stop every timer, frame loop,
   * listener and audio layer you added; abort is also when fetches should stop.
   */
  readonly signal: AbortSignal;
  /** True exactly when still() is running (prefers-reduced-motion); play() always sees false. */
  readonly reducedMotion: boolean;
  readonly assets: TsukiSceneAssets;
  /** The Walkman, silent unless it is on. Always silent in still(). */
  readonly audio: SceneAudio;
  /** Appends a canvas to the stage and wraps it in a scene-runtime loop. The canvas is aria-hidden. */
  createCanvasLoop(options: TsukiCanvasLoopOptions): TsukiCanvasLoop;
}

export interface TsukiSceneHandle {
  /**
   * Resolves when the scene reaches its natural end. Never reject it: throw
   * from play() instead, which the runner treats as "the scene failed" and
   * closes the dialog. Left pending after dispose() is fine.
   */
  readonly done: Promise<void>;
  /**
   * Undoes everything play() added beyond what ctx tracks for you (timers,
   * listeners, DOM in the stage). Idempotent. Runs before the dialog closes,
   * and also when the page is left mid-scene.
   */
  dispose(): void;
}

export interface TsukiSceneModule {
  play(ctx: TsukiSceneContext): TsukiSceneHandle;
  still(ctx: TsukiSceneContext): void;
}
