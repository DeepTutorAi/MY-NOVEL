// Page adapter of the Lodge opening cutscene (design section 7.1): binds the
// dialog that LodgeCutscene.astro renders to the shared runner
// (src/scripts/_shared/cutscene/runner.ts) and to the scene registered for the
// chapter (registry.ts). The rules (once per day since 06:00 local, ?resume=1
// and history traversal never play, ?cutscene=replay forces a replay) are
// core.ts's; the dialog lifecycle is the runner's; the scene is the scene's.
// What is Lodge's:
//
//   - the played key, hvitveldt:cutscene:played:<chapter>, kept from the old
//     overlay; its numeric-millisecond values still count as played today;
//   - the gate's URL snapshot and its no-flash cover (window.__lodgeCutsceneNav);
//   - the epigraph's reveal, and a "เดินทางต่อ" button added to the controls
//     once the text has fully appeared;
//   - focus goes to the chapter heading when the dialog closes.
import { createCutsceneRunner, type CutsceneRunner } from "../../_shared/cutscene/runner";
import { registryEntry } from "./registry";
import { createReveal, resetReveal } from "./reveal";
import type { LodgeSceneContext, LodgeSceneHandle, LodgeSceneModule } from "./scene-types";

export const PLAYED_PREFIX = "hvitveldt:cutscene:played:";
export const COVER_CLASS = "lodge-cutscene-pending";
/** How long the cover may keep hiding the page while the scene downloads. */
export const SCENE_LOAD_BUDGET_MS = 3000;
const CONTINUE_LABEL = "เดินทางต่อ";

interface CutsceneNav {
  path?: string;
  search?: string;
  traverse?: boolean;
  hold?(ms: number): void;
}

declare global {
  interface Window {
    /** Snapshot taken by the inline gate in LodgeCutscene.astro before any module script runs. */
    __lodgeCutsceneNav?: CutsceneNav;
  }
}

function chapterHeading(): HTMLElement | null {
  const target = document.querySelector<HTMLElement>("article.chapter .chapter-header h1") ?? document.querySelector<HTMLElement>("main");
  if (target && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  return target;
}

export function setupLodgeCutscene(): (() => void) | undefined {
  const root = document.documentElement;
  const uncover = () => root.classList.remove(COVER_CLASS);
  const dialog = document.querySelector<HTMLDialogElement>("dialog.lodge-cutscene");
  const stage = dialog?.querySelector<HTMLElement>("[data-cutscene-stage]");
  const controls = dialog?.querySelector<HTMLElement>("[data-cutscene-controls]");
  const textEl = dialog?.querySelector<HTMLElement>("[data-cutscene-text]");
  const skipButton = dialog?.querySelector<HTMLElement>("[data-cutscene-skip]");
  const startButton = dialog?.querySelector<HTMLElement>("[data-cutscene-start]");
  const chapter = Number(dialog?.dataset.chapter);
  const assetBase = dialog?.dataset.assetBase ?? "";
  if (!dialog || !stage || !controls || !textEl || !skipButton || !startButton || !Number.isInteger(chapter)) {
    uncover();
    return undefined;
  }

  const nav = window.__lodgeCutsceneNav;
  const search = nav?.path === location.pathname && nav.search !== undefined ? nav.search : location.search;
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const traversal = nav ? nav.traverse === true : navigation?.type === "back_forward";

  const entry = registryEntry(chapter);
  let loading: Promise<LodgeSceneModule> | null = null;
  const loadScene = () => (loading ??= entry.load());

  const clearStage = () => {
    stage.replaceChildren();
    controls.replaceChildren();
    resetReveal(textEl);
  };

  const buildContext = (still: boolean, complete: () => void): { ctx: LodgeSceneContext; abort: AbortController } => {
    clearStage();
    const canvas = document.createElement("canvas");
    canvas.className = "lodge-cutscene__canvas";
    stage.append(canvas);
    const abort = new AbortController();
    const reveal = createReveal(textEl, () => {
      if (still || abort.signal.aborted) return;
      const next = document.createElement("button");
      next.type = "button";
      next.className = "lodge-cutscene__control lodge-cutscene__continue-motion";
      next.textContent = CONTINUE_LABEL;
      next.addEventListener("click", complete, { once: true });
      controls.append(next);
    });
    const ctx: LodgeSceneContext = {
      chapter,
      stage,
      canvas,
      textEl,
      controls,
      signal: abort.signal,
      still,
      reveal,
      assetUrl: (path) => `${assetBase}${path.replace(/^\//, "")}`,
      complete,
    };
    return { ctx, abort };
  };

  const runner: CutsceneRunner = createCutsceneRunner<LodgeSceneModule>({
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
      let handle: LodgeSceneHandle | null = null;
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

    // Reduced motion or snow motion off: the full text and "เดินทางต่อ" with the scene's still frame.
    still(runCtx) {
      let abort: AbortController | null = null;
      let cancelled = false;
      loadScene().then(
        (scene) => {
          if (cancelled) return;
          const built = buildContext(true, () => runCtx.complete());
          abort = built.abort;
          scene.still(built.ctx);
        },
        (error: unknown) => console.warn("[lodge cutscene] still failed to load", error),
      );
      return () => {
        cancelled = true;
        abort?.abort();
        clearStage();
      };
    },

    reducedMotion: () => {
      try {
        if (window.localStorage.getItem("hvitveldt:motion:snow") === "false") return true;
      } catch {
        // Unreadable storage: follow the media query alone.
      }
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    },
    focusAfterClose: chapterHeading,
    hasEntry: true,
    traversal,
    dev: import.meta.env.DEV,
    search,
    cover: { isActive: () => root.classList.contains(COVER_CLASS), lift: uncover },
    label: "lodge cutscene",
  });

  dialog.addEventListener("close", clearStage);
  runner.start();
  return () => {
    dialog.removeEventListener("close", clearStage);
    runner.destroy();
    uncover();
  };
}
