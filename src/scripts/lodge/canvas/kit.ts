// Canvas kit for the Lodge scenes (design section 4.4): graphite and charcoal
// on paper. Drawing helpers plus runLodgeScene, a thin layer over the shared
// scene runtime that adds the reader's still mode (motion switch off) on top
// of the runtime's own reduced-motion handling. Geometry lives in kit-core.ts.
import { createRng, createScene, type PointerState, type SceneFrame, type SceneHandle, type SceneSize } from "../../_shared/scene-runtime";

export const DPR_CAP = 2;

const STILL_POINTER: PointerState = { x: 0, y: 0, nx: 0.5, ny: 0.5, active: false, down: false, justTapped: false, type: "mouse" };

export function loadPlate(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    const abort = () => {
      image.src = "";
      reject(new DOMException("aborted", "AbortError"));
    };
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort, { once: true });
    image.onload = () => {
      signal?.removeEventListener("abort", abort);
      resolve(image);
    };
    image.onerror = () => {
      signal?.removeEventListener("abort", abort);
      reject(new Error(`could not load ${url}`));
    };
    image.src = url;
  });
}

/** An offscreen layer in device pixels whose context draws in CSS pixels. */
export function makeLayer(size: SceneSize): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(size.width * size.dpr));
  canvas.height = Math.max(1, Math.round(size.height * size.dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  return { canvas, ctx };
}

/** Paper tooth: sparse light and dark specks, seeded so a resize does not shimmer. */
export function paperGrain(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, strength = 1): void {
  const rng = createRng(seed);
  const count = Math.round((w * h) / 90);
  for (let i = 0; i < count; i += 1) {
    const light = rng() < 0.5;
    ctx.fillStyle = light ? `rgba(236,231,221,${0.035 * strength})` : `rgba(0,0,0,${0.06 * strength})`;
    ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 1.4, 1 + rng() * 1.4);
  }
}

/** A soft charcoal smudge. */
export function smudge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number, tone = "14,13,12"): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, `rgba(${tone},${alpha})`);
  gradient.addColorStop(1, `rgba(${tone},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Runs `draw` with destination-out, so whatever it paints is erased from the layer. */
export function erase(ctx: CanvasRenderingContext2D, draw: () => void): void {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  draw();
  ctx.restore();
}

export interface LodgeSceneSpec {
  canvas: HTMLCanvasElement;
  /** Element whose box sizes the scene (see SceneOptions.container). */
  container: HTMLElement;
  /** Start in the still mode (the reader's motion switch is off). */
  still: boolean;
  /** Rebuild size-dependent layers. Called on every backing-store change. */
  layout(size: Readonly<SceneSize>): void;
  /** Paint one frame. `moving` is false for the still frame (t = 0, no pointer). */
  draw(ctx: CanvasRenderingContext2D, frame: Readonly<SceneFrame>, moving: boolean): void;
}

export interface LodgeSceneHandle extends SceneHandle {
  setStill(still: boolean): void;
  /** Repaint the still frame (after a layer the still depends on changed). */
  redrawStill(): void;
}

export function runLodgeScene(spec: LodgeSceneSpec): LodgeSceneHandle {
  let still = spec.still;
  let size: SceneSize | null = null;
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const paintStill = () => {
    const ctx = spec.canvas.getContext("2d");
    if (!ctx || !size) return;
    spec.draw(ctx, { t: 0, dt: 0, width: size.width, height: size.height, dpr: size.dpr, pointer: STILL_POINTER }, false);
  };
  const scene = createScene({
    canvas: spec.canvas,
    container: spec.container,
    dprCap: DPR_CAP,
    render(ctx, frame) {
      if (!still) spec.draw(ctx, frame, true);
    },
    resize(next) {
      size = { width: next.width, height: next.height, dpr: next.dpr };
      spec.layout(next);
      if (still || reduced()) paintStill();
    },
    reducedMotionFrame(ctx, frame) {
      spec.draw(ctx, frame, false);
    },
  });
  if (!still) scene.start();
  return {
    start: () => scene.start(),
    stop: () => scene.stop(),
    destroy: () => scene.destroy(),
    setStill(next: boolean) {
      if (next === still) return;
      still = next;
      if (still) {
        scene.stop();
        paintStill();
      } else {
        scene.start();
      }
    },
    redrawStill() {
      if (still || reduced()) paintStill();
    },
  };
}
