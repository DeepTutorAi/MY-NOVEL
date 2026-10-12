// Mounts the home sky (moonsea-scene.ts) behind the /tsukinomi/ hero and
// concourse. The scene is its own chunk, fetched by a dynamic import right
// after the page's first paint, so the page script stays small and the copy
// paints before any canvas work starts.
//
// The scene is the page's backdrop, so it always draws something: the moving
// sky, or one still composition when the reader prefers reduced motion or has
// switched the Walkman panel's backdrop motion off (the same switch and event
// the site-wide sakura backdrop follows). Once the sky is up the body carries
// tsuki-moonsea-live, and home.css hides the sakura backdrop it replaces.
// If the chunk cannot load or the browser has no 2D canvas, nothing is
// mounted and the page keeps that backdrop.
//
// startMoonsea() returns the teardown for concourse.ts's onPage cleanups: it
// cancels a pending start, destroys the scene and removes every listener.

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/** The Walkman panel's backdrop-motion switch (SakuraTwilightBackdrop.astro, WalkmanPlayer.astro). */
export const MOTION_STORAGE_KEY = "tsukinomi:motion:backdrop";
export const MOTION_EVENT = "tsukinomi:motion-change";
export const LIVE_CLASS = "tsuki-moonsea-live";

export interface StartMoonseaOptions {
  mount: HTMLElement | null;
  furthestRead: number | null;
}

/** The reader's backdrop-motion switch: on unless it was explicitly turned off. Unreadable storage counts as on. */
export function motionSwitchOn(getItem: (key: string) => string | null): boolean {
  try {
    return getItem(MOTION_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

const canDraw = () => {
  try {
    return typeof HTMLCanvasElement !== "undefined" && Boolean(document.createElement("canvas").getContext("2d"));
  } catch {
    return false;
  }
};

export function startMoonsea({ mount, furthestRead }: StartMoonseaOptions): () => void {
  if (!mount || !canDraw()) return () => {};
  const reducedQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  const readSwitch = () => motionSwitchOn((key) => window.localStorage.getItem(key));
  const wantsStill = () => reducedQuery.matches || !readSwitch();

  let stopped = false;
  let handle: { setStill(still: boolean): void; destroy(): void } | null = null;

  const onMotionChange = () => handle?.setStill(wantsStill());
  window.addEventListener(MOTION_EVENT, onMotionChange);
  reducedQuery.addEventListener("change", onMotionChange);

  // Two frames: the first paint has happened before the chunk is asked for.
  let second = 0;
  const first = window.requestAnimationFrame(() => {
    second = window.requestAnimationFrame(() => void begin());
  });

  const begin = async () => {
    if (stopped) return;
    mount.dataset.moonsea = "loading";
    let scene: typeof import("./moonsea-scene");
    try {
      scene = await import("./moonsea-scene");
    } catch {
      if (!stopped) mount.dataset.moonsea = "failed";
      return;
    }
    if (stopped) return;
    handle = scene.mountMoonsea({ mount, furthestRead, still: wantsStill() });
    mount.dataset.moonsea = "live";
    document.body.classList.add(LIVE_CLASS);
  };

  return () => {
    stopped = true;
    window.cancelAnimationFrame(first);
    window.cancelAnimationFrame(second);
    window.removeEventListener(MOTION_EVENT, onMotionChange);
    reducedQuery.removeEventListener("change", onMotionChange);
    handle?.destroy();
    handle = null;
    document.body.classList.remove(LIVE_CLASS);
    delete mount.dataset.moonsea;
  };
}
