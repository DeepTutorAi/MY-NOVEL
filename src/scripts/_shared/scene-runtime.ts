// Runtime for full-screen canvas scenes, shared by the hub (Firefly, Mothlight,
// ...) and the cutscene scenes.
//
// A scene supplies render/resize callbacks; the runtime owns the frame loop,
// backing-store sizing, visibility pausing, live reduced-motion handling and a
// unified pointer state. It is framework-agnostic: page lifecycle (Astro
// ClientRouter swaps) is handled by the caller through destroy().

export const MAX_DT = 1 / 20;
export const RESIZE_DEBOUNCE_MS = 150;
const TAP_MAX_MOVE_PX = 12;
const TAP_MAX_MS = 450;

export interface PointerState {
  /** CSS pixels relative to the canvas' top-left corner. */
  x: number;
  y: number;
  /** Position as a fraction (0..1) of the canvas size. */
  nx: number;
  ny: number;
  /** A mouse is over the page, or a touch/pen contact is in progress. */
  active: boolean;
  down: boolean;
  /** True for the first frame after a short press-release with little travel. */
  justTapped: boolean;
  type: string;
}

export interface SceneSize {
  /** CSS pixels. The context transform is pre-scaled so scenes draw in CSS pixels. */
  width: number;
  height: number;
  dpr: number;
}

export interface SceneFrame extends SceneSize {
  /** Scene time in seconds; advances only while the loop runs. */
  t: number;
  /** Seconds since the previous frame, clamped to MAX_DT. 0 for still frames. */
  dt: number;
  pointer: Readonly<PointerState>;
}

export interface SceneOptions {
  canvas: HTMLCanvasElement;
  /**
   * Viewport-fixed element whose CSS box defines the scene size (not the
   * switcher's display wrapper, which has no box of its own). The canvas must
   * be CSS-sized to fill it; the runtime only sets the backing store.
   */
  container: HTMLElement;
  dprCap: number;
  render(ctx: CanvasRenderingContext2D, frame: Readonly<SceneFrame>): void;
  /**
   * Called after the backing store changed. Setting canvas.width resets all
   * context state, so re-apply composite modes, fonts, etc. here. Must not
   * reseed the scene: mobile URL bars change the height continuously.
   */
  resize(size: Readonly<SceneSize>, ctx: CanvasRenderingContext2D): void;
  onPointer?(pointer: Readonly<PointerState>, event: PointerEvent): void;
  /** Composed still frame for prefers-reduced-motion; defaults to render() with dt = 0. */
  reducedMotionFrame?(ctx: CanvasRenderingContext2D, frame: Readonly<SceneFrame>): void;
}

export interface SceneHandle {
  start(): void;
  stop(): void;
  destroy(): void;
}

export function clampDt(seconds: number, max: number = MAX_DT): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(seconds, max);
}

export function capDpr(devicePixelRatio: number, cap: number): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const limit = Number.isFinite(cap) && cap > 0 ? cap : 1;
  return Math.min(dpr, limit);
}

export function backingSize(cssPixels: number, dpr: number): number {
  return Math.max(1, Math.round(cssPixels * dpr));
}

export function isTap(dx: number, dy: number, elapsedMs: number): boolean {
  return elapsedMs <= TAP_MAX_MS && Math.hypot(dx, dy) <= TAP_MAX_MOVE_PX;
}

/** Seeded PRNG (mulberry32). Returns floats in [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRADIENTS = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
] as const;

/** Seeded 2D simplex noise. Output is continuous and within [-1, 1]. */
export function createNoise2D(seed: number): (x: number, y: number) => number {
  const rng = createRng(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = base[i];
    base[i] = base[j];
    base[j] = tmp;
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];

  const corner = (gi: number, x: number, y: number): number => {
    const t = 0.5 - x * x - y * y;
    if (t < 0) return 0;
    const g = GRADIENTS[gi & 7];
    const t2 = t * t;
    return t2 * t2 * (g[0] * x + g[1] * y);
  };

  return (x, y) => {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const n =
      corner(perm[ii + perm[jj]], x0, y0) +
      corner(perm[ii + i1 + perm[jj + j1]], x1, y1) +
      corner(perm[ii + 1 + perm[jj + 1]], x2, y2);
    return Math.max(-1, Math.min(1, 70 * n));
  };
}

/** Fractal sum of noise octaves, normalized back into [-1, 1]. */
export function fbm2D(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}

export function createScene(options: SceneOptions): SceneHandle {
  const { canvas, container, dprCap, render, resize, onPointer, reducedMotionFrame } = options;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { start() {}, stop() {}, destroy() {} };
  }

  const pointer: PointerState = { x: 0, y: 0, nx: 0.5, ny: 0.5, active: false, down: false, justTapped: false, type: "mouse" };
  const frame: SceneFrame = { t: 0, dt: 0, width: 0, height: 0, dpr: 1, pointer };
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let rect = { left: 0, top: 0 };
  let wanted = false;
  let destroyed = false;
  let rafId = 0;
  let lastTs = -1;
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  let press: { x: number; y: number; at: number; id: number } | null = null;

  const measure = (): boolean => {
    const box = container.getBoundingClientRect();
    rect = { left: box.left, top: box.top };
    const dpr = capDpr(window.devicePixelRatio, dprCap);
    const width = box.width;
    const height = box.height;
    if (width === frame.width && height === frame.height && dpr === frame.dpr) return false;
    frame.width = width;
    frame.height = height;
    frame.dpr = dpr;
    if (width <= 0 || height <= 0) return false;
    canvas.width = backingSize(width, dpr);
    canvas.height = backingSize(height, dpr);
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    resize({ width, height, dpr }, ctx);
    return true;
  };

  const hasArea = () => frame.width > 0 && frame.height > 0;

  const drawStill = () => {
    if (!hasArea()) return;
    frame.dt = 0;
    if (reducedMotionFrame) reducedMotionFrame(ctx, frame);
    else render(ctx, frame);
    pointer.justTapped = false;
  };

  const tick = (ts: number) => {
    rafId = requestAnimationFrame(tick);
    frame.dt = lastTs < 0 ? 0 : clampDt((ts - lastTs) / 1000);
    lastTs = ts;
    frame.t += frame.dt;
    render(ctx, frame);
    pointer.justTapped = false;
  };

  const halt = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    lastTs = -1;
  };

  const sync = () => {
    const shouldRun = wanted && !destroyed && !reduceQuery.matches && !document.hidden && hasArea();
    if (shouldRun && !rafId) {
      lastTs = -1;
      rafId = requestAnimationFrame(tick);
    } else if (!shouldRun && rafId) {
      halt();
    }
  };

  const onResizeObserved = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (destroyed) return;
      const changed = measure();
      if (changed && wanted && reduceQuery.matches) drawStill();
      sync();
    }, RESIZE_DEBOUNCE_MS);
  };

  const onReduceChange = () => {
    sync();
    if (wanted && reduceQuery.matches) drawStill();
  };

  const updatePointerPosition = (event: PointerEvent) => {
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.nx = frame.width > 0 ? pointer.x / frame.width : 0.5;
    pointer.ny = frame.height > 0 ? pointer.y / frame.height : 0.5;
    pointer.type = event.pointerType || "mouse";
  };

  const notify = (event: PointerEvent) => {
    if (onPointer && wanted) onPointer(pointer, event);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!event.isPrimary) return;
    updatePointerPosition(event);
    // Touch and pen only count as active while in contact.
    pointer.active = event.pointerType === "mouse" || pointer.down;
    notify(event);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary) return;
    updatePointerPosition(event);
    pointer.active = true;
    pointer.down = true;
    pointer.justTapped = false;
    press = { x: event.clientX, y: event.clientY, at: event.timeStamp, id: event.pointerId };
    notify(event);
  };

  const release = (event: PointerEvent, cancelled: boolean) => {
    if (!event.isPrimary) return;
    // A cancelled touch (the browser took over to scroll) reports 0,0; keep the last real position.
    if (!cancelled) updatePointerPosition(event);
    const tapped =
      !cancelled &&
      press !== null &&
      press.id === event.pointerId &&
      isTap(event.clientX - press.x, event.clientY - press.y, event.timeStamp - press.at);
    press = null;
    pointer.down = false;
    pointer.justTapped = tapped;
    if (event.pointerType !== "mouse") pointer.active = false;
    notify(event);
    if (tapped && wanted && reduceQuery.matches) drawStill();
  };

  const onPointerUp = (event: PointerEvent) => release(event, false);
  const onPointerCancel = (event: PointerEvent) => release(event, true);

  const onPointerOut = (event: PointerEvent) => {
    // Touch and pen contact ends in pointerup/pointercancel; only a mouse leaves the page.
    if (event.pointerType !== "mouse" || event.relatedTarget !== null || !event.isPrimary) return;
    pointer.active = false;
    notify(event);
  };

  const onBlur = () => {
    pointer.active = false;
    pointer.down = false;
    press = null;
  };

  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(onResizeObserved) : null;
  resizeObserver?.observe(container);
  if (!resizeObserver) window.addEventListener("resize", onResizeObserved);

  reduceQuery.addEventListener("change", onReduceChange);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointercancel", onPointerCancel, { passive: true });
  window.addEventListener("pointerout", onPointerOut, { passive: true });
  window.addEventListener("blur", onBlur);

  measure();

  return {
    start() {
      if (destroyed) return;
      wanted = true;
      if (!hasArea()) measure();
      if (reduceQuery.matches) drawStill();
      sync();
    },
    stop() {
      wanted = false;
      sync();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      wanted = false;
      halt();
      clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", onResizeObserved);
      reduceQuery.removeEventListener("change", onReduceChange);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("blur", onBlur);
    },
  };
}
