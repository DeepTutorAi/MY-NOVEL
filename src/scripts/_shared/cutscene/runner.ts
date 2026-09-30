// DOM lifecycle of the once-per-day cutscene dialog, shared by Sea and
// Tsukinomi. The rules (cooldown, forced replay, state machine) live in
// core.ts; this module acts on them:
//
//   createCutsceneRunner(config).start()
//
//   idle -> pending -> loading -> playing -> finishing -> finished
//                                   (skipped when it never opens)
//
// start()   reads the played key and the URL, asks core.shouldPlay(). If it
//           says no, nothing is downloaded: the runner goes straight to
//           "skipped" and lifts the cover.
// pending   waiting for the tab to be visible.
// loading   config.loadScene() imports the scene module (the only place a
//           scene is fetched) while the optional no-flash cover hides the
//           page. If the cover was already lifted by its safety timeout the
//           reader is looking at the text, so the cutscene is dropped for this
//           visit unless it was forced with ?cutscene=replay (or =force in
//           dev). With reduced motion nothing is loaded: the static still is
//           shown instead.
// playing   dialog.showModal() puts the dialog in the top layer, so no page
//           layer can cover it. The played key is written here, as an ISO
//           timestamp, so leaving or skipping mid-scene still counts as seen
//           (it lasts until the next 06:00 local time). Skip button, Escape
//           ("cancel") and, when tapSkipGraceMs is set, a tap anywhere after
//           that grace all finish it. Wheel, touch-move and scroll keys are
//           blocked so the page behind stays put.
// finishing fade-out, then close. Focus goes to focusAfterClose (default: the
//           element that had focus before the dialog opened) and the forced-
//           replay parameters are removed from the address bar.
//
// Completion signal: the scene tells the runner it reached its end by calling
// ctx.complete() (passed to play()). A scene driven by a timeline, such as
// Sea's GSAP timeline, adapts with timeline.eventCallback("onComplete",
// ctx.complete). The runner never inspects the scene, and this module imports
// no animation library and nothing specific to a novel.
//
// The runner listens for astro:before-swap on `document` (never `window`) and
// tears itself down there, so a ClientRouter navigation mid-scene leaves no
// open dialog, timer or listener behind. destroy() does the same on demand.
import {
  canTransition,
  cleanCutsceneUrl,
  parseCutsceneParams,
  playedStamp,
  playedToday,
  shouldPlay,
  transition,
  type CutsceneEvent,
  type CutsceneParams,
  type CutsceneState,
} from "./core";

export const DEFAULT_FADE_OUT_MS = 250;

/** Why the dialog closed, as passed to onClose. */
export type CutsceneCloseReason =
  /** The scene signalled its end through ctx.complete(). */
  | "complete"
  /** The reader skipped: skip or start button, Escape, or a tap after the grace. */
  | "skip"
  /** The browser closed the dialog by itself (a repeated Escape without user activation). */
  | "closed"
  /** The scene threw while starting. */
  | "error"
  /** The page was left (astro:before-swap) or destroy() was called. */
  | "aborted";

/** What play() returns. Scenes set up synchronously; dispose() undoes everything they added. */
export interface CutsceneSceneHandle {
  /** Stops the scene's clock when a finish begins, so the fade runs over a still frame. */
  pause?(): void;
  /** Called once when the cutscene ends, before the dialog closes, and on abort. */
  dispose?(): void;
}

export interface CutsceneLoadContext {
  /** Aborted when the runner is destroyed; pass it to fetches that support it. */
  signal: AbortSignal;
  params: CutsceneParams;
}

export interface CutscenePlayContext extends CutsceneLoadContext {
  dialog: HTMLDialogElement;
  /**
   * The completion signal: call it when the scene reached its end and the
   * dialog should fade out. Idempotent, and ignored once a finish has begun.
   */
  complete(): void;
}

/** The no-flash cover that hides the page while the scene loads (Sea: html.sea-cutscene-pending). */
export interface CutsceneCover {
  /**
   * Whether the cover still hides the page. False means a safety timeout
   * already lifted it and the reader is reading, so the cutscene is dropped
   * unless it was forced.
   */
  isActive(): boolean;
  /** Lifts the cover. Called when the dialog opens and on every way out; idempotent. */
  lift(): void;
}

export interface CutsceneRunnerConfig<Loaded> {
  /** The native <dialog>; the runner opens it with showModal(). */
  dialog: HTMLDialogElement;
  /** Always-visible skip control inside the dialog. */
  skipButton: HTMLElement;
  /**
   * Control shown instead of the skip button in still (reduced-motion) mode,
   * for example "start reading". Without it the skip button stays visible.
   */
  startButton?: HTMLElement;
  /** localStorage key of the played stamp, e.g. "tsukinomi:cutscene:played:3". */
  playedKey: string;

  /**
   * Imports the scene module and whatever it needs. Called only after the
   * trigger said play, the tab is visible and reduced motion is off; a
   * rejection drops the cutscene for this visit.
   */
  loadScene(ctx: CutsceneLoadContext): Promise<Loaded>;
  /**
   * Optional second loading step that still runs under the cover, before the
   * dialog opens (Sea builds its sound-effect context here so it never lands
   * in the first animated frame). The cover is checked again afterwards.
   */
  prepare?(loaded: Loaded, ctx: CutsceneLoadContext): Promise<void>;
  /** Starts the scene once the dialog is open; see the completion signal above. */
  play(loaded: Loaded, ctx: CutscenePlayContext): CutsceneSceneHandle | void;
  /**
   * Renders the static composition in still mode, after the dialog opened
   * (the markup may already be in place; this can fill in text or art). May
   * return a cleanup. The runner sets dialog.dataset.mode to "still".
   */
  still?(ctx: CutscenePlayContext): (() => void) | void;

  /** Runs right after the dialog opened (pause the page's audio, for example). */
  onOpen?(info: { still: boolean }): void;
  /** Runs once after the dialog closed, only if onOpen ran, whatever the reason. */
  onClose?(info: { reason: CutsceneCloseReason; still: boolean }): void;
  /** Where focus goes after a skip or an ending. Default: the element focused before opening. */
  focusAfterClose?: HTMLElement | null | (() => HTMLElement | null);

  /** The page carries a cutscene. Default true. */
  hasEntry?: boolean;
  /** Back/forward history traversal. Default false. */
  traversal?: boolean;
  /** Development build: ?cutscene=force is honoured. Default false. */
  dev?: boolean;
  /** Query string to read the forced-replay parameters from. Default location.search. */
  search?: string;
  cover?: CutsceneCover;
  /** Default: the prefers-reduced-motion media query. */
  reducedMotion?(): boolean;

  /** Fade-out before closing, in ms, when fadeOut is not given. Default 250; 0 closes at once. */
  fadeOutMs?: number;
  /**
   * Replaces the default fade (an opacity animation over fadeOutMs) with the
   * caller's own, such as a GSAP tween. Call `done` when it is over; return a
   * function that stops it. Not used in still mode, which closes at once.
   */
  fadeOut?(dialog: HTMLDialogElement, done: () => void): (() => void) | void;
  /** A tap anywhere skips once this many ms have passed since opening. Omit to disable tap-to-skip. */
  tapSkipGraceMs?: number;
  /** Prefix of console warnings, "[label] ...". Default "cutscene". */
  label?: string;
  /** The clock, for the played stamp. Default new Date(). */
  now?(): Date;
}

export interface CutsceneRunner {
  readonly state: CutsceneState;
  /** Decides whether to play and, if so, begins. No-op unless the runner is idle. */
  start(): void;
  /** Skips like the reader pressing the skip button. No-op unless the dialog is playing. */
  skip(): void;
  /** Tears down without focus or URL changes. Idempotent; also called on astro:before-swap. */
  destroy(): void;
  /** Resolves with the terminal state: "finished" if the dialog had opened, else "skipped". Never rejects. */
  readonly settled: Promise<"finished" | "skipped">;
}

const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

export function createCutsceneRunner<Loaded>(config: CutsceneRunnerConfig<Loaded>): CutsceneRunner {
  const { dialog, skipButton, startButton, playedKey } = config;
  const label = config.label ?? "cutscene";
  const controller = new AbortController();
  const { signal } = controller;

  let state: CutsceneState = "idle";
  let params: CutsceneParams = parseCutsceneParams("");
  let explicit = false;
  let still = false;
  let opened = false;
  let handle: CutsceneSceneHandle | null = null;
  let stillCleanup: (() => void) | null = null;
  let stopFade: (() => void) | null = null;
  let openedAt = 0;
  let previousFocus: HTMLElement | null = null;
  let resolveSettled!: (value: "finished" | "skipped") => void;
  const settled = new Promise<"finished" | "skipped">((resolve) => {
    resolveSettled = resolve;
  });

  const warn = (message: string, error: unknown) => console.warn(`[${label}] ${message}`, error);

  // Hooks are the caller's code; a throw in one must not leave the dialog open.
  const guarded = (what: string, fn: () => void) => {
    try {
      fn();
    } catch (error) {
      warn(`${what} failed`, error);
    }
  };

  const go = (event: CutsceneEvent): boolean => {
    if (!canTransition(state, event)) return false;
    state = transition(state, event);
    dialog.dataset.state = state;
    return true;
  };

  const readPlayed = (): boolean => {
    try {
      return playedToday(localStorage.getItem(playedKey), (config.now ?? (() => new Date()))());
    } catch {
      return false;
    }
  };

  const writePlayed = () => {
    try {
      localStorage.setItem(playedKey, playedStamp((config.now ?? (() => new Date()))()));
    } catch {
      // Without storage the cutscene may play again next visit; nothing else depends on it.
    }
  };

  const stripParams = () => {
    const clean = cleanCutsceneUrl(location.href);
    if (clean !== `${location.pathname}${location.search}${location.hash}`) {
      history.replaceState(history.state, "", clean);
    }
  };

  const isReduced = () =>
    config.reducedMotion ? config.reducedMotion() : matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The cover safety timeout already lifted: the reader is looking at the text.
  const coverLapsed = () => config.cover !== undefined && !config.cover.isActive() && !explicit;

  const preventDefault = (event: Event) => {
    event.preventDefault();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (SCROLL_KEYS.has(event.key)) event.preventDefault();
  };

  const onCancel = (event: Event) => {
    event.preventDefault();
    finish("skip");
  };

  // Closed by the browser itself (a repeated Escape without user activation
  // skips "cancel"): clean up without the fade.
  const onDialogClose = () => {
    if (state === "playing" || state === "finishing") settle("close", "closed");
  };

  const onPointerUp = () => {
    if (performance.now() - openedAt < (config.tapSkipGraceMs ?? 0)) return;
    finish("skip");
  };

  const onSkipClick = () => finish("skip");

  const addDialogListeners = () => {
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onDialogClose);
    if (config.tapSkipGraceMs !== undefined) dialog.addEventListener("pointerup", onPointerUp);
    dialog.addEventListener("wheel", preventDefault, { passive: false });
    dialog.addEventListener("touchmove", preventDefault, { passive: false });
    dialog.addEventListener("keydown", onKeyDown);
    skipButton.addEventListener("click", onSkipClick);
    startButton?.addEventListener("click", onSkipClick);
  };

  const removeDialogListeners = () => {
    dialog.removeEventListener("cancel", onCancel);
    dialog.removeEventListener("close", onDialogClose);
    dialog.removeEventListener("pointerup", onPointerUp);
    dialog.removeEventListener("wheel", preventDefault);
    dialog.removeEventListener("touchmove", preventDefault);
    dialog.removeEventListener("keydown", onKeyDown);
    skipButton.removeEventListener("click", onSkipClick);
    startButton?.removeEventListener("click", onSkipClick);
  };

  const release = () => {
    const scene = handle;
    handle = null;
    if (scene?.dispose) guarded("scene dispose", () => scene.dispose?.());
    const cleanup = stillCleanup;
    stillCleanup = null;
    if (cleanup) guarded("still cleanup", cleanup);
    stopFade?.();
    stopFade = null;
    removeDialogListeners();
  };

  const detach = () => {
    document.removeEventListener("visibilitychange", onVisible);
    document.removeEventListener("astro:before-swap", destroy);
  };

  const resolveFocusTarget = (): HTMLElement | null => {
    const target = config.focusAfterClose;
    const element = typeof target === "function" ? target() : target;
    if (element) return element;
    return previousFocus?.isConnected ? previousFocus : null;
  };

  /** Every way out: close the dialog (if it opened), clean up, lift the cover, report. */
  const settle = (event: "close" | "abandon" | "abort", reason: CutsceneCloseReason) => {
    if (!go(event)) return;
    release();
    detach();
    if (opened) {
      if (dialog.open) dialog.close();
      // A page that is being left keeps its focus and address bar as they are.
      if (reason !== "aborted") {
        stripParams();
        resolveFocusTarget()?.focus({ preventScroll: true });
      }
    }
    config.cover?.lift();
    if (opened) guarded("onClose", () => config.onClose?.({ reason, still }));
    resolveSettled(state === "finished" ? "finished" : "skipped");
  };

  function finish(reason: "complete" | "skip") {
    if (!go("finish")) return;
    handle?.pause?.();
    const done = () => settle("close", reason);
    if (still) return done();
    if (config.fadeOut) {
      stopFade = config.fadeOut(dialog, done) ?? null;
      return;
    }
    const ms = config.fadeOutMs ?? DEFAULT_FADE_OUT_MS;
    if (!(ms > 0)) return done();
    const animation =
      typeof dialog.animate === "function"
        ? dialog.animate({ opacity: [1, 0] }, { duration: ms, easing: "ease-out", fill: "forwards" })
        : null;
    const timer = setTimeout(done, ms);
    stopFade = () => {
      clearTimeout(timer);
      animation?.cancel();
    };
  }

  function destroy() {
    controller.abort();
    settle("abort", "aborted");
  }

  // load() handles its own failures; this only keeps an unexpected one from
  // escaping as an unhandled rejection with the dialog left open.
  function run() {
    load().catch((error: unknown) => {
      warn("cutscene failed", error);
      settle(opened ? "close" : "abandon", "error");
    });
  }

  function onVisible() {
    if (document.hidden) return;
    document.removeEventListener("visibilitychange", onVisible);
    run();
  }

  const open = (): boolean => {
    const active = document.activeElement as HTMLElement | null;
    previousFocus = active && active !== document.body ? active : null;
    dialog.dataset.mode = still ? "still" : "motion";
    if (startButton) {
      skipButton.hidden = still;
      startButton.hidden = !still;
    }
    try {
      dialog.showModal();
    } catch (error) {
      warn("cutscene skipped: dialog could not open", error);
      settle("abandon", "error");
      return false;
    }
    opened = true;
    go("open");
    writePlayed();
    stripParams();
    addDialogListeners();
    (still && startButton ? startButton : skipButton).focus({ preventScroll: true });
    openedAt = performance.now();
    config.cover?.lift();
    guarded("onOpen", () => config.onOpen?.({ still }));
    return true;
  };

  const load = async () => {
    if (!go("visible") || signal.aborted) return;
    const loadContext: CutsceneLoadContext = { signal, params };
    const playContext: CutscenePlayContext = { ...loadContext, dialog, complete: () => finish("complete") };
    still = isReduced();

    if (still) {
      if (coverLapsed()) return settle("abandon", "skip");
      if (!open()) return;
      try {
        stillCleanup = config.still?.(playContext) ?? null;
      } catch (error) {
        warn("still failed", error);
      }
      return;
    }

    let loaded: Loaded;
    try {
      loaded = await config.loadScene(loadContext);
    } catch (error) {
      warn("cutscene skipped: scene failed to load", error);
      return settle("abandon", "error");
    }
    if (signal.aborted) return;
    if (coverLapsed()) return settle("abandon", "skip");

    if (config.prepare) {
      try {
        await config.prepare(loaded, loadContext);
      } catch (error) {
        warn("cutscene skipped: scene failed to prepare", error);
        return settle("abandon", "error");
      }
      if (signal.aborted) return;
      if (coverLapsed()) return settle("abandon", "skip");
    }

    if (!open()) return;
    try {
      handle = config.play(loaded, playContext) ?? null;
    } catch (error) {
      warn("cutscene scene failed", error);
      settle("close", "error");
    }
  };

  const start = () => {
    if (state !== "idle" || signal.aborted) return;
    params = parseCutsceneParams(config.search ?? location.search);
    const dev = config.dev === true;
    explicit = params.replay || (params.force && dev);
    const play = shouldPlay({
      hasEntry: config.hasEntry ?? true,
      resume: params.resume,
      traversal: config.traversal === true,
      played: readPlayed(),
      replay: params.replay,
      force: params.force,
      dev,
    });
    if (!play) return settle("abandon", "skip");

    go("queue");
    document.addEventListener("astro:before-swap", destroy);
    if (document.hidden) document.addEventListener("visibilitychange", onVisible);
    else run();
  };

  return {
    get state() {
      return state;
    },
    start,
    skip: () => finish("skip"),
    destroy,
    settled,
  };
}
