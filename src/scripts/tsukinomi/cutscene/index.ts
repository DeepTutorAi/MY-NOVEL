// Page adapter of the Tsukinomi opening cutscene: binds the dialog that
// TsukinomiCutscene.astro renders to the shared runner
// (src/scripts/_shared/cutscene/runner.ts) and to the scene registered for the
// part (registry.ts). Loaded as a module script by TsukinomiSectionLayout.
//
// This file decides nothing about timing or layout: the rules (once per day
// since 06:00 local, ?resume=1 and history traversal never play, forced replay
// with ?cutscene=replay) are core.ts's, the dialog lifecycle is the runner's,
// and the scene is the scene's. What is Tsukinomi's:
//
//   - the played key, tsukinomi:cutscene:played:<part>, kept from the old
//     cutscene; its old numeric-millisecond values still count as played today;
//   - a snapshot of the page's URL and navigation type taken by the inline gate
//     in the component before first paint (the reading-progress script strips
//     ?resume=1 from the address bar, so reading location.search later would
//     miss it);
//   - the scene and its session (context, audio, canvas loops) are imported
//     only once the runner says the cutscene will play, so a visit the cooldown
//     skips downloads none of it;
//   - the no-flash cover: the inline gate's 2.5 s timer started at HTML parse,
//     long before this module could run on a slow phone, so once the cutscene
//     is on its way the adapter asks the gate to restart it (hold) with a
//     budget for the scene chunks alone;
//   - focus goes to the section heading (or <main>) when the dialog closes;
//   - nothing to clean up by hand on ClientRouter navigation: onPage tears the
//     runner down on astro:before-swap, which closes the dialog, disposes the
//     scene and hands the Walkman back.
import { createCutsceneRunner, type CutsceneRunner } from "../../_shared/cutscene/runner";
import { onPage } from "../../_shared/lifecycle";
import { registryEntry, type TsukiRegistryEntry } from "./registry";
import type { TsukiSession } from "./session";
import type { TsukiSceneHandle, TsukiSceneModule } from "./scene-types";

export const PLAYED_PREFIX = "tsukinomi:cutscene:played:";
export const COVER_CLASS = "tsuki-cutscene-pending";
/** How long the cover may keep hiding the page while the scene's chunks download, counted from when this module starts. */
export const SCENE_LOAD_BUDGET_MS = 3000;

interface CutsceneNav {
  path?: string;
  search?: string;
  traverse?: boolean;
  /** Restarts the gate's cover timer with the given budget, if the cover is still up. */
  hold?(ms: number): void;
}

declare global {
  interface Window {
    /** Snapshot taken by the inline gate in TsukinomiCutscene.astro before any module script runs. */
    __tsukiCutsceneNav?: CutsceneNav;
  }
}

interface Loaded {
  scene: TsukiSceneModule;
  session: typeof import("./session");
}

function sectionHeading(): HTMLElement | null {
  const target =
    document.querySelector<HTMLElement>("article.tsukinomi-section h1") ?? document.getElementById("tsukinomi-main");
  // Neither is focusable by default; -1 makes them a focus target without adding a tab stop.
  if (target && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  return target;
}

/** What the adapter builds on; the defaults are the real thing, a test passes fakes. */
export interface AdapterDeps {
  /** Development build: ?cutscene=force is honoured. Default import.meta.env.DEV. */
  dev?: boolean;
  /** The part's registry entry. Default: registryEntry(part of the dialog). */
  entry?: TsukiRegistryEntry;
  /** Imports the session module. Default: a dynamic import, which keeps it out of visits that do not play. */
  loadSession?: () => Promise<Loaded["session"]>;
}

export function setupTsukinomiCutscene(deps: AdapterDeps = {}): (() => void) | undefined {
  const root = document.documentElement;
  const uncover = () => root.classList.remove(COVER_CLASS);
  const dialog = document.querySelector<HTMLDialogElement>("dialog.tsuki-cutscene");
  const stage = dialog?.querySelector<HTMLElement>("[data-cutscene-stage]");
  const textEl = dialog?.querySelector<HTMLElement>("[data-cutscene-text]");
  const skipButton = dialog?.querySelector<HTMLElement>("[data-cutscene-skip]");
  const startButton = dialog?.querySelector<HTMLElement>("[data-cutscene-start]");
  const part = Number(dialog?.dataset.part);
  if (!dialog || !stage || !textEl || !skipButton || !startButton || !Number.isInteger(part)) {
    uncover();
    return undefined;
  }

  const nav = window.__tsukiCutsceneNav;
  const search = nav?.path === location.pathname && nav.search !== undefined ? nav.search : location.search;
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const traversal = nav ? nav.traverse === true : navigation?.type === "back_forward";
  const pageCue = document.querySelector<HTMLElement>("article.tsukinomi-section")?.dataset.musicCue;

  const entry = deps.entry ?? registryEntry(part);
  const loadSession = deps.loadSession ?? (() => import("./session"));
  let loading: Promise<Loaded> | null = null;
  const loadParts = () =>
    (loading ??= Promise.all([entry.load(), loadSession()]).then(([scene, session]) => ({ scene, session })));

  const openSession = (session: Loaded["session"], reducedMotion: boolean) =>
    session.createSession({
      dialog,
      stage,
      textEl,
      part,
      entry,
      reducedMotion,
      skip: () => runner.skip(),
      pageCue,
    });

  const runner: CutsceneRunner = createCutsceneRunner<Loaded>({
    dialog,
    skipButton,
    startButton,
    playedKey: `${PLAYED_PREFIX}${part}`,
    loadScene: () => loadParts(),

    play(loaded, runCtx) {
      const session = openSession(loaded.session, false);
      let handle: TsukiSceneHandle | null = null;
      const end = () => runCtx.complete();
      try {
        handle = loaded.scene.play(session.ctx);
        handle.done.then(end, (error: unknown) => {
          console.warn("[tsukinomi cutscene] scene ended with an error", error);
          end();
        });
      } catch (error) {
        // The runner only disposes what play() returns, so undo the session here.
        session.abort();
        try {
          handle?.dispose();
        } finally {
          session.dispose();
        }
        throw error;
      }
      const scene = handle;
      return {
        pause: () => session.pause(),
        dispose: () => {
          session.abort();
          try {
            scene.dispose();
          } finally {
            session.dispose();
          }
        },
      };
    },

    // Reduced motion: the dialog already shows the real text and the continue
    // button; the scene's still() adds its plate once its module has loaded.
    still() {
      let session: TsukiSession | null = null;
      let cancelled = false;
      loadParts().then(
        (loaded) => {
          if (cancelled) return;
          session = openSession(loaded.session, true);
          loaded.scene.still(session.ctx);
        },
        (error: unknown) => console.warn("[tsukinomi cutscene] still failed to load", error),
      );
      return () => {
        cancelled = true;
        session?.abort();
        session?.dispose();
      };
    },

    focusAfterClose: sectionHeading,
    hasEntry: true,
    traversal,
    dev: deps.dev ?? import.meta.env.DEV,
    search,
    cover: { isActive: () => root.classList.contains(COVER_CLASS), lift: uncover },
    label: "tsukinomi cutscene",
  });

  runner.start();
  // Not playing (cooldown, ?resume=1, traversal) has already lifted the cover; a still opens at once.
  if (runner.state === "pending" || runner.state === "loading") window.__tsukiCutsceneNav?.hold?.(SCENE_LOAD_BUDGET_MS);
  return () => runner.destroy();
}

onPage("tsukinomi-cutscene", { bodyClass: "tsukinomi-page" }, () => setupTsukinomiCutscene());
