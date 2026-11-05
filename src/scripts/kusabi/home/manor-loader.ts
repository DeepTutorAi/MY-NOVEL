// Starts the home scene after the first paint, as its own chunk. If the chunk or
// the plate cannot load, the static picture behind it stays and nothing breaks.
import { manorState } from "../progress-core";
import { loadProgress, safeGet } from "../progress";

const LIVE_CLASS = "kusabi-manor-live";
const MOTION_KEY = "kusabi:motion:backdrop";
const MOTION_EVENT = "kusabi:motion-change";

const wantsStill = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches || safeGet(MOTION_KEY) === "false";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${url}`));
    image.src = url;
  });
}

export function startManor(mount: HTMLElement | null): () => void {
  const plateUrl = mount?.dataset.plateUrl;
  if (!mount || !plateUrl) return () => {};
  let stopped = false;
  let handle: { setStill(still: boolean): void; destroy(): void } | null = null;

  const onMotionChange = () => handle?.setStill(wantsStill());
  window.addEventListener(MOTION_EVENT, onMotionChange);

  const begin = async () => {
    try {
      const [scene, plate, progress] = await Promise.all([import("./manor-scene"), loadImage(plateUrl), loadProgress()]);
      if (stopped) return;
      const state = manorState(progress);
      mount.dataset.state = state;
      handle = scene.mountManor({ mount, plate, state, still: wantsStill() });
      document.body.classList.add(LIVE_CLASS);
    } catch (error) {
      console.warn("[kusabi home] the scene did not start", error);
    }
  };

  const first = requestAnimationFrame(() => void begin());

  return () => {
    stopped = true;
    cancelAnimationFrame(first);
    window.removeEventListener(MOTION_EVENT, onMotionChange);
    handle?.destroy();
    handle = null;
    document.body.classList.remove(LIVE_CLASS);
  };
}
