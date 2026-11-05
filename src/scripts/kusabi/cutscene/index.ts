// Binds a chapter's cutscene dialog to the shared runner. The rules (once per day
// since 06:00 local, ?resume=1 and history traversal never play, ?cutscene=replay
// forces it) are core.ts's. The played key is the one the old overlay wrote, and
// its numeric values still count as played today.
import { revealClusters, shouldStep, visibleCount } from "../../lodge/cutscene/reveal-core";
import { createCutsceneRunner, type CutsceneRunner } from "../../_shared/cutscene/runner";
import { safeGet } from "../progress";
import { loadSceneFor, type KusabiSceneContext, type KusabiSceneHandle, type KusabiSceneModule } from "./registry";

export const PLAYED_PREFIX = "kusabi:cutscene:played:";
export const COVER_CLASS = "kusabi-cutscene-pending";
const SCENE_LOAD_BUDGET_MS = 3000;
const MOTION_KEY = "kusabi:motion:backdrop";

interface CutsceneNav {
  path?: string;
  search?: string;
  traverse?: boolean;
  hold?(ms: number): void;
}

declare global {
  interface Window {
    __kusabiCutsceneNav?: CutsceneNav;
  }
}

function createReveal(textEl: HTMLElement, onComplete: () => void) {
  const text = textEl.textContent ?? "";
  const spans = revealClusters(text).map((cluster) => {
    const span = document.createElement("span");
    span.className = "kusabi-cutscene__g";
    span.textContent = cluster;
    return span;
  });
  textEl.replaceChildren(...spans);
  textEl.dataset.reveal = "";
  let shown = 0;
  let steppedAt = -Infinity;
  let completed = false;
  return (fraction: number) => {
    const next = visibleCount(fraction, spans.length);
    const now = performance.now();
    if (!shouldStep(shown, next, spans.length, now - steppedAt)) return;
    steppedAt = now;
    for (let i = Math.min(shown, next); i < Math.max(shown, next); i += 1) spans[i].classList.toggle("is-shown", i < next);
    shown = next;
    if (shown === spans.length && !completed) {
      completed = true;
      onComplete();
    }
  };
}

function resetReveal(textEl: HTMLElement): void {
  textEl.textContent = textEl.textContent ?? "";
  delete textEl.dataset.reveal;
}

function chapterHeading(): HTMLElement | null {
  const target = document.querySelector<HTMLElement>("article.chapter h1") ?? document.querySelector<HTMLElement>("main");
  if (target && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  return target;
}

export function setupKusabiCutscene(): (() => void) | undefined {
  const root = document.documentElement;
  const uncover = () => root.classList.remove(COVER_CLASS);
  const dialog = document.querySelector<HTMLDialogElement>("dialog.kusabi-cutscene");
  const stage = dialog?.querySelector<HTMLElement>("[data-cutscene-stage]");
  const controls = dialog?.querySelector<HTMLElement>("[data-cutscene-controls]");
  const textEl = dialog?.querySelector<HTMLElement>("[data-cutscene-text]");
  const skipButton = dialog?.querySelector<HTMLElement>("[data-cutscene-skip]");
  const startButton = dialog?.querySelector<HTMLElement>("[data-cutscene-start]");
  const chapter = Number(dialog?.dataset.chapter);
  if (!dialog || !stage || !controls || !textEl || !skipButton || !startButton || !Number.isInteger(chapter)) {
    uncover();
    return undefined;
  }

  const nav = window.__kusabiCutsceneNav;
  const search = nav?.path === location.pathname && nav.search !== undefined ? nav.search : location.search;
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const traversal = nav ? nav.traverse === true : navigation?.type === "back_forward";

  let loading: Promise<KusabiSceneModule> | null = null;
  const loadScene = () => (loading ??= loadSceneFor(chapter));

  const clearStage = () => {
    stage.replaceChildren();
    controls.replaceChildren();
    resetReveal(textEl);
  };

  const buildContext = (still: boolean, complete: () => void) => {
    clearStage();
    const canvas = document.createElement("canvas");
    canvas.className = "kusabi-cutscene__canvas";
    stage.append(canvas);
    const abort = new AbortController();
    const reveal = createReveal(textEl, () => {
      if (still || abort.signal.aborted) return;
      const next = document.createElement("button");
      next.type = "button";
      next.className = "kusabi-cutscene__button";
      next.textContent = "เดินทางต่อ";
      next.addEventListener("click", complete, { once: true });
      controls.append(next);
    });
    const ctx: KusabiSceneContext = { canvas, stage, reveal, complete, signal: abort.signal };
    return { ctx, abort };
  };

  const runner: CutsceneRunner = createCutsceneRunner<KusabiSceneModule>({
    dialog,
    skipButton,
    startButton,
    playedKey: `${PLAYED_PREFIX}${chapter}`,
    loadScene: () => {
      nav?.hold?.(SCENE_LOAD_BUDGET_MS);
      return loadScene();
    },

    play(scene, runCtx) {
      const { ctx, abort } = buildContext(false, () => runCtx.complete());
      let handle: KusabiSceneHandle | null = null;
      try {
        handle = scene.play(ctx);
      } catch (error) {
        abort.abort();
        clearStage();
        throw error;
      }
      const playing = handle;
      return {
        pause: () => playing.pause?.(),
        dispose: () => {
          abort.abort();
          try {
            playing.dispose();
          } finally {
            clearStage();
          }
        },
      };
    },

    still(runCtx) {
      let abort: AbortController | null = null;
      let cancelled = false;
      loadScene().then(
        (scene) => {
          if (cancelled) return;
          const built = buildContext(true, () => runCtx.complete());
          abort = built.abort;
          built.ctx.reveal(1);
          scene.still(built.ctx);
        },
        (error: unknown) => console.warn("[kusabi cutscene] still failed to load", error),
      );
      return () => {
        cancelled = true;
        abort?.abort();
        clearStage();
      };
    },

    reducedMotion: () => safeGet(MOTION_KEY) === "false" || window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    focusAfterClose: chapterHeading,
    hasEntry: true,
    traversal,
    dev: import.meta.env.DEV,
    search,
    cover: { isActive: () => root.classList.contains(COVER_CLASS), lift: uncover },
    label: "kusabi cutscene",
  });

  dialog.addEventListener("close", clearStage);
  runner.start();
  return () => {
    dialog.removeEventListener("close", clearStage);
    runner.destroy();
    uncover();
  };
}
