// Mounts the home backdrop (whiteout-scene.ts) behind the /lodge/ hero. The
// scene is its own chunk, fetched by a dynamic import after the first paint,
// so the copy paints before any canvas work starts.
//
// The scene always draws something: the moving whiteout, or one still frame
// when the reader prefers reduced motion or switched snow motion off (the same
// switch and event the site-wide SnowCanvas follows). While the scene is up the
// body carries LIVE_CLASS: the static hero picture and the site-wide snow step
// aside. If the chunk cannot load or there is no 2D canvas, nothing is mounted
// and the page keeps the picture and the global snow.
import { lodgeDrift, readFinished, type DriftLevel } from "../progress-core";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/** SnowCanvas.astro and AmbientPlayer.astro own this switch. */
export const MOTION_STORAGE_KEY = "hvitveldt:motion:snow";
export const MOTION_EVENT = "hvitveldt:motion-change";
export const LIVE_CLASS = "lodge-whiteout-live";

/** On unless it was explicitly turned off; unreadable storage counts as on. */
export function motionSwitchOn(getItem: (key: string) => string | null): boolean {
  try {
    return getItem(MOTION_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

const canDraw = () => {
  try {
    return Boolean(document.createElement("canvas").getContext("2d"));
  } catch {
    return false;
  }
};

const readLevel = (): DriftLevel => {
  try {
    return lodgeDrift(readFinished(window.localStorage));
  } catch {
    return 0;
  }
};

export function startWhiteout({ mount }: { mount: HTMLElement | null }): () => void {
  if (!mount || !canDraw()) return () => {};
  const plateUrl = mount.dataset.plateUrl;
  if (!plateUrl) return () => {};
  const reducedQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  const readSwitch = () => motionSwitchOn((key) => window.localStorage.getItem(key));
  const wantsStill = () => reducedQuery.matches || !readSwitch();
  const level = readLevel();
  mount.dataset.drift = String(level);

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
    mount.dataset.whiteout = "loading";
    let scene: typeof import("./whiteout-scene");
    try {
      scene = await import("./whiteout-scene");
    } catch {
      if (!stopped) mount.dataset.whiteout = "failed";
      return;
    }
    if (stopped) return;
    handle = scene.mountWhiteout({ mount, plateUrl, level, still: wantsStill() });
    mount.dataset.whiteout = "live";
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
    delete mount.dataset.whiteout;
  };
}
