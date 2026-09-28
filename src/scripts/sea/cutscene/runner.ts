// Arc-entry cutscene runner. SeaChapterLayout renders <dialog class="sea-cutscene">
// (ArcCutscene.astro) only on an arc's entry chapter; this module decides
// whether it plays, then drives it:
//
//   idle -> pending -> loading -> playing -> finishing -> done
//
// pending   waiting for the tab to be visible.
// loading   GSAP, the scene chunk and the audio state load in parallel while
//           the no-flash cover (html.sea-cutscene-pending, set by the inline
//           gate in SeaBaseLayout) hides the page. If the gate's 2.5s safety
//           timeout already lifted the cover, the reader is looking at the
//           text and the cutscene is dropped for this visit.
// playing   dialog.showModal(); the played key is written here, so leaving
//           or skipping mid-scene still counts as seen. The key holds a
//           timestamp and lasts until the next 06:00 local time, so each arc
//           plays at most once per day. Skip button, Escape ("cancel") and a
//           tap anywhere after 400ms all skip.
// finishing 250ms fade, close, focus the chapter title, clean the URL.
//
// Reduced motion (media query or html[data-sea-motion=off]) shows the static
// title card from ArcCutscene.astro instead: no scene, no GSAP, a 300ms CSS
// fade and a "เริ่มอ่าน" button.
import { loadScene, type SceneHandle, type SceneModule } from "./registry";
import type { CutsceneSfx } from "./sfx";

export type CutsceneState = "idle" | "pending" | "loading" | "playing" | "finishing" | "done";

export const COVER_CLASS = "sea-cutscene-pending";
export const PLAYED_PREFIX = "sea:cutscene:played:";
export const TAP_GRACE_MS = 400;
/** Local hour at which the once-per-day cooldown resets. */
export const COOLDOWN_RESET_HOUR = 6;
const FADE_OUT_S = 0.25;

export interface CutsceneParams {
  resume: boolean;
  replay: boolean;
  force: boolean;
  /** Dev-only scene override (?cutscene=force&scene=sealed-depth). */
  scene: string | null;
}

export function parseCutsceneParams(search: string): CutsceneParams {
  const params = new URLSearchParams(search);
  const mode = params.get("cutscene");
  return {
    resume: params.get("resume") === "1",
    replay: mode === "replay",
    force: mode === "force",
    scene: params.get("scene"),
  };
}

export interface CutsceneTrigger {
  /** The article carries data-arc-entry. */
  hasEntry: boolean;
  resume: boolean;
  /** Back/forward history traversal (Astro navigationType "traverse", or a back_forward page load). */
  traversal: boolean;
  played: boolean;
  replay: boolean;
  force: boolean;
  dev: boolean;
}

/**
 * Keep in sync with the inline gate in SeaBaseLayout.astro, which applies the
 * same rule before first paint to decide whether to cover the page.
 */
export function shouldPlay(trigger: CutsceneTrigger): boolean {
  if (!trigger.hasEntry) return false;
  if (trigger.replay || (trigger.force && trigger.dev)) return true;
  return !trigger.resume && !trigger.traversal && !trigger.played;
}

/** The current cooldown day: from the latest 06:00 local time to the next one. */
export function cooldownDay(now: Date): { start: number; end: number } {
  const start = new Date(now);
  start.setHours(COOLDOWN_RESET_HOUR, 0, 0, 0);
  if (start.getTime() > now.getTime()) start.setDate(start.getDate() - 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

/**
 * Whether a stored played timestamp falls in the current cooldown day. Missing
 * or unreadable values count as not played. Keep in sync with the inline gate
 * in SeaBaseLayout.astro.
 */
export function playedToday(stored: string | null, now: Date): boolean {
  if (stored === null) return false;
  const at = Date.parse(stored);
  const { start, end } = cooldownDay(now);
  return at >= start && at < end;
}

/** The URL without the cutscene-only parameters. */
export function cleanCutsceneUrl(href: string): string {
  const url = new URL(href);
  const mode = url.searchParams.get("cutscene");
  if (mode === "replay" || mode === "force") {
    url.searchParams.delete("cutscene");
    url.searchParams.delete("scene");
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

interface CutsceneNav {
  path?: string;
  search?: string;
  traverse?: boolean;
}

declare global {
  interface Window {
    /** Snapshot taken by the inline gate before any module script runs. */
    __seaCutsceneNav?: CutsceneNav;
  }
}

const readPlayed = (arc: string) => {
  try {
    return playedToday(localStorage.getItem(PLAYED_PREFIX + arc), new Date());
  } catch {
    return false;
  }
};

const writePlayed = (arc: string) => {
  try {
    localStorage.setItem(PLAYED_PREFIX + arc, new Date().toISOString());
  } catch {
    // Without storage the cutscene may play again next visit; nothing else depends on it.
  }
};

const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

export function bindArcCutscene(): (() => void) | undefined {
  const root = document.documentElement;
  const uncover = () => root.classList.remove(COVER_CLASS);
  const dialog = document.querySelector<HTMLDialogElement>("dialog.sea-cutscene");
  const article = document.querySelector<HTMLElement>("article.sea-chapter");
  const titleEl = dialog?.querySelector<HTMLElement>("[data-cutscene-title]");
  const arcLabelEl = dialog?.querySelector<HTMLElement>("[data-cutscene-arc]");
  const stage = dialog?.querySelector<HTMLElement>("[data-cutscene-stage]");
  const skipButton = dialog?.querySelector<HTMLButtonElement>("[data-cutscene-skip]");
  const startButton = dialog?.querySelector<HTMLButtonElement>("[data-cutscene-start]");
  const arc = dialog?.dataset.arc;
  if (!dialog || !article || !titleEl || !arcLabelEl || !stage || !skipButton || !startButton || !arc) {
    uncover();
    return undefined;
  }

  const nav = window.__seaCutsceneNav;
  // ?resume=1 may already be gone (reading-progress strips it on setup), so
  // prefer the gate's snapshot of this page's URL.
  const search = nav?.path === location.pathname && nav.search !== undefined ? nav.search : location.search;
  const params = parseCutsceneParams(search);
  const dev = import.meta.env.DEV;
  const play = shouldPlay({
    hasEntry: article.dataset.arcEntry === "true",
    resume: params.resume,
    traversal: nav?.traverse === true,
    played: readPlayed(arc),
    replay: params.replay,
    force: params.force,
    dev,
  });
  if (!play) {
    uncover();
    return undefined;
  }

  const explicit = params.replay || (params.force && dev);
  // Dev preview of the arcs 4-7 scene on any entry chapter; it is the only
  // scene that builds its own stage, the others need their arc's markup.
  const sceneId = dev && params.force && params.scene === "sealed-depth" ? params.scene : dialog.dataset.scene;
  const controller = new AbortController();
  const { signal } = controller;
  let state: CutsceneState = "pending";
  let handle: SceneHandle | null = null;
  let sfx: CutsceneSfx | null = null;
  let fade: { kill(): void } | null = null;
  let loadedGsap: typeof import("gsap").gsap | null = null;
  let openedAt = 0;

  const stripParams = () => {
    const clean = cleanCutsceneUrl(location.href);
    if (clean !== `${location.pathname}${location.search}${location.hash}`) {
      history.replaceState(history.state, "", clean);
    }
  };

  const release = () => {
    handle?.timeline.kill();
    handle?.dispose();
    handle = null;
    fade?.kill();
    fade = null;
    sfx?.dispose();
    sfx = null;
    dialog.removeEventListener("cancel", onCancel);
    dialog.removeEventListener("close", onClose);
    dialog.removeEventListener("pointerup", onPointerUp);
    dialog.removeEventListener("wheel", preventScroll);
    dialog.removeEventListener("touchmove", preventScroll);
    dialog.removeEventListener("keydown", onKeyDown);
    skipButton.removeEventListener("click", finish);
    startButton.removeEventListener("click", finish);
  };

  const complete = () => {
    if (state === "done") return;
    state = "done";
    release();
    if (dialog.open) dialog.close();
    dialog.dataset.state = "done";
    uncover();
    stripParams();
    const heading = document.getElementById("sea-chapter-title");
    heading?.focus({ preventScroll: true });
  };

  const finish = () => {
    if (state !== "playing") return;
    state = "finishing";
    dialog.dataset.state = "finishing";
    handle?.timeline.pause();
    const gsap = loadedGsap;
    if (!gsap) return complete();
    fade = gsap.to(dialog, { opacity: 0, duration: FADE_OUT_S, ease: "power1.out", onComplete: complete });
  };

  const onCancel = (event: Event) => {
    event.preventDefault();
    finish();
  };

  // Closed by the browser itself (a repeated Escape without user activation
  // skips "cancel"): clean up without the fade.
  const onClose = () => {
    if (state === "playing" || state === "finishing") complete();
  };

  const onPointerUp = () => {
    if (performance.now() - openedAt < TAP_GRACE_MS) return;
    finish();
  };

  const preventScroll = (event: Event) => {
    event.preventDefault();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (SCROLL_KEYS.has(event.key)) event.preventDefault();
  };

  // Before the dialog opened: nothing was shown, so focus and URL stay as they are.
  const abandon = () => {
    state = "done";
    dialog.dataset.state = "done";
    release();
    uncover();
  };

  const open = (reduced: boolean) => {
    state = "playing";
    dialog.dataset.state = "playing";
    dialog.dataset.mode = reduced ? "still" : "motion";
    skipButton.hidden = reduced;
    startButton.hidden = !reduced;
    writePlayed(arc);
    stripParams();
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose);
    dialog.addEventListener("pointerup", onPointerUp);
    dialog.addEventListener("wheel", preventScroll, { passive: false });
    dialog.addEventListener("touchmove", preventScroll, { passive: false });
    dialog.addEventListener("keydown", onKeyDown);
    skipButton.addEventListener("click", finish);
    startButton.addEventListener("click", finish);
    dialog.showModal();
    (reduced ? startButton : skipButton).focus({ preventScroll: true });
    openedAt = performance.now();
    uncover();
  };

  const start = async () => {
    if (state !== "pending" || signal.aborted) return;
    state = "loading";
    dialog.dataset.state = "loading";
    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.seaMotion === "off";

    if (reduced) {
      if (!root.classList.contains(COVER_CLASS) && !explicit) return abandon();
      open(true);
      return;
    }

    let loaded: [typeof import("gsap"), SceneModule, typeof import("../sea-audio-state")];
    try {
      loaded = await Promise.all([import("gsap"), loadScene(sceneId), import("../sea-audio-state")]);
    } catch (error) {
      console.warn("[sea] cutscene skipped: scene failed to load", error);
      return abandon();
    }
    if (signal.aborted) return;
    if (!root.classList.contains(COVER_CLASS) && !explicit) return abandon();

    const [{ gsap }, scene, { seaAudio }] = loaded;
    loadedGsap = gsap;
    if (seaAudio.isEnabled()) {
      const { createSfx } = await import("./sfx");
      if (signal.aborted) return;
      sfx = createSfx(seaAudio.getVolume());
      // Constructing an AudioContext can take over 100ms; give it its own
      // task under the cover so it never lands in the first animated frame.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      if (signal.aborted) return;
      if (!root.classList.contains(COVER_CLASS) && !explicit) return abandon();
    }

    open(false);
    try {
      handle = scene.play({ stage, titleEl, arcLabelEl, sfx, gsap });
    } catch (error) {
      console.warn("[sea] cutscene scene failed", error);
      return complete();
    }
    handle.timeline.eventCallback("onComplete", finish);
  };

  const onVisible = () => {
    if (document.hidden) return;
    document.removeEventListener("visibilitychange", onVisible);
    void start();
  };

  dialog.dataset.state = "pending";
  if (document.hidden) document.addEventListener("visibilitychange", onVisible);
  else void start();

  return () => {
    controller.abort();
    document.removeEventListener("visibilitychange", onVisible);
    release();
    if (dialog.open) dialog.close();
    state = "done";
    uncover();
  };
}
