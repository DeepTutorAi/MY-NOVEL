// The part of the passing train that is in the home page's initial script: it
// decides whether the train will run at all and, if so, downloads the scene
// (train-scene.ts) after first paint and idle. Everything else (the plan, the
// canvas, the pictures) is in the lazy chunk. This module therefore imports
// nothing from train-core.ts or train-scene.ts statically: a module shared with
// the lazy chunk would be hoisted into this one and downloaded with it.
//
// The train is skipped, and the scene is never even downloaded, under
// prefers-reduced-motion (the hero stays still) and in the short-landscape
// layout (no train band; the board is shown directly). Both are live: if the
// reader turns reduced motion on mid-pass the pass is cut, and if a phone is
// rotated from short landscape to portrait before the train has run, it runs
// then. One pass per page load: once a pass has started it is never started again
// on the same page.
//
// The state is published on the mount for the checks and for debugging:
//
//   data-train         waiting (scheduled), loading (scene being fetched),
//                      passing, done, skipped
//   data-train-skip    why it was skipped (reduced-motion, short-landscape,
//                      no-mount, no-canvas, load-failed)
//   data-train-seed    optional, read: an integer that fixes the train's
//                      variation (the checks use it)
import { SHORT_LANDSCAPE_QUERY } from "./concourse-core";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/** requestIdleCallback gives up waiting after this long and runs anyway. */
const IDLE_TIMEOUT_MS = 2500;
/** Where there is no requestIdleCallback (Safari), the scene is requested this long after first paint. */
const IDLE_FALLBACK_MS = 400;

export type TrainSkip = "reduced-motion" | "short-landscape" | "no-mount" | "no-canvas" | "load-failed";

export interface TrainEnvironment {
  reducedMotion: boolean;
  shortLandscape: boolean;
  hasMount: boolean;
  /** The browser can make a 2D canvas. */
  hasCanvas: boolean;
}

/** Why the train must not run, or null when it may. Reduced motion wins over layout. */
export function trainSkipReason(env: TrainEnvironment): TrainSkip | null {
  if (env.reducedMotion) return "reduced-motion";
  if (!env.hasMount) return "no-mount";
  if (env.shortLandscape) return "short-landscape";
  if (!env.hasCanvas) return "no-canvas";
  return null;
}

/** A non-negative integer from a data-train-seed value, or null. */
export function parseSeed(raw: string | null | undefined): number | null {
  if (typeof raw !== "string" || !/^\d{1,10}$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  return Number.isSafeInteger(value) && value <= 0xffffffff ? value : null;
}

/**
 * Runs `callback` after the first paint and once the browser is idle (and the
 * tab is visible). Returns the function that cancels it.
 */
function afterPaintAndIdle(callback: () => void): () => void {
  let cancelled = false;
  const undo: Array<() => void> = [];

  const fire = () => {
    if (cancelled) return;
    if (document.hidden) {
      const onVisible = () => {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", onVisible);
        fire();
      };
      document.addEventListener("visibilitychange", onVisible);
      undo.push(() => document.removeEventListener("visibilitychange", onVisible));
      return;
    }
    callback();
  };

  const idle = () => {
    if (cancelled) return;
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(fire, { timeout: IDLE_TIMEOUT_MS });
      undo.push(() => window.cancelIdleCallback(id));
    } else {
      const id = window.setTimeout(fire, IDLE_FALLBACK_MS);
      undo.push(() => window.clearTimeout(id));
    }
  };

  const paint = () => {
    // Two frames: the first paint has happened once the second callback runs.
    const first = window.requestAnimationFrame(() => {
      const second = window.requestAnimationFrame(idle);
      undo.push(() => window.cancelAnimationFrame(second));
    });
    undo.push(() => window.cancelAnimationFrame(first));
  };

  if (document.readyState === "complete") {
    paint();
  } else {
    window.addEventListener("load", paint, { once: true });
    undo.push(() => window.removeEventListener("load", paint));
  }

  return () => {
    cancelled = true;
    for (const fn of undo.splice(0)) fn();
  };
}

const canMakeCanvas = () => {
  try {
    return typeof HTMLCanvasElement !== "undefined" && Boolean(document.createElement("canvas").getContext("2d"));
  } catch {
    return false;
  }
};

export interface StartTrainOptions {
  /** The hero's [data-train-mount], or null on a page without one. */
  mount: HTMLElement | null;
  /** ReadState.furthestRead: the furthest part READ. It decides which pictures the train may show. */
  furthestRead: number | null;
}

/** Schedules the pass; returns the cleanup that cancels it, or ends a pass in progress. */
export function startTrain({ mount, furthestRead }: StartTrainOptions): () => void {
  if (!mount) return () => {};
  const reducedQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  const directQuery = window.matchMedia(SHORT_LANDSCAPE_QUERY);
  const hasCanvas = canMakeCanvas();

  let cancelWait: (() => void) | null = null;
  let handle: { destroy(): void } | null = null;
  let stopped = false;
  // A pass has started (the scene is loading or running): never start a second one.
  let ran = false;
  let done = false;

  const reason = () =>
    trainSkipReason({
      reducedMotion: reducedQuery.matches,
      shortLandscape: directQuery.matches,
      hasMount: true,
      hasCanvas,
    });

  const setState = (state: string, skip?: TrainSkip) => {
    mount.dataset.train = state;
    if (skip) mount.dataset.trainSkip = skip;
    else delete mount.dataset.trainSkip;
  };

  const begin = async () => {
    cancelWait = null;
    const why = reason();
    if (stopped || ran) return;
    if (why) {
      setState("skipped", why);
      return;
    }
    ran = true;
    setState("loading");
    let scene: typeof import("./train-scene");
    try {
      scene = await import("./train-scene");
    } catch {
      if (!stopped) setState("skipped", "load-failed");
      return;
    }
    const nowWhy = reason();
    if (stopped || nowWhy) {
      if (!stopped) setState("skipped", nowWhy ?? "no-canvas");
      return;
    }
    const seed = parseSeed(mount.dataset.trainSeed);
    handle = scene.mountTrain({
      mount,
      furthestRead,
      ...(seed === null ? {} : { seed }),
      onState: (state) => {
        if (state === "done") done = true;
        if (!stopped) setState(state);
      },
    });
  };

  const schedule = () => {
    if (stopped || ran || cancelWait) return;
    const why = reason();
    if (why) {
      setState("skipped", why);
      return;
    }
    setState("waiting");
    cancelWait = afterPaintAndIdle(() => void begin());
  };

  const onPreferenceChange = () => {
    // A finished pass stays "done": nothing is left to cut.
    if (stopped || done) return;
    const why = reason();
    if (why) {
      // Reduced motion turned on, or a rotation to short landscape: cut a pass in progress, drop a scheduled one.
      cancelWait?.();
      cancelWait = null;
      handle?.destroy();
      handle = null;
      setState("skipped", why);
    } else {
      // Rotated back before the train had run: it may run now. A pass already made is not repeated.
      schedule();
    }
  };
  for (const query of [reducedQuery, directQuery]) query.addEventListener("change", onPreferenceChange);

  schedule();

  return () => {
    stopped = true;
    for (const query of [reducedQuery, directQuery]) query.removeEventListener("change", onPreferenceChange);
    cancelWait?.();
    cancelWait = null;
    handle?.destroy();
    handle = null;
  };
}
