// Shared plumbing for the canvas cutscenes (parts 2 to 5, and the plate loader
// part 1 uses): load the part's plate, run one full-screen canvas on the
// scene-runtime loop with the scene's own clock, end on time, and draw a still.
//
// runCanvasScene() is the whole life of a moving scene:
//
//   - the plate is loaded (decoded off the main thread) and the scene's clock
//     starts once it is in, or after READY_TIMEOUT_MS without it, so the first
//     thing the reader sees is the picture and not a pop-in;
//   - layout() is called with every new size and once the plate arrives, to
//     paint whatever is expensive into canvases that are not in the page;
//   - render() draws a frame from the scene's own time `t` (seconds since the
//     plate settled). The time only advances while frames run, and the
//     runtime stops frames while the tab is hidden, so the scene never runs
//     ahead of a reader who is not looking;
//   - the scene resolves done at `endS`; a safety timer ends it anyway if no
//     frame ever runs (no area, no animation frames);
//   - everything is undone when ctx.signal aborts (skip, end, page left) or
//     dispose() is called.
//
// stillCanvas() draws the reduced-motion composition once per size and again
// when the plate arrives; it starts no loop that changes the picture.
import { splitGraphemes } from "../../../_shared/cutscene/graphemes";
import { createRevealClock } from "./plate-core";
import type { PointerState, SceneFrame, SceneSize } from "../../../_shared/scene-runtime";
import type { TsukiSceneContext, TsukiSceneHandle } from "../scene-types";
import { injectSceneStyles } from "../styles";
import kitCss from "./kit.css?inline";

export type Ctx = CanvasRenderingContext2D;

/** How long a scene waits for its plate before it starts without it. */
export const READY_TIMEOUT_MS = 1500;

/** Loads the plate; resolves null if it cannot be had. With a timeout it gives up after that many ms. */
export function loadPlate(url: string | null, signal: AbortSignal, timeoutMs: number | null): Promise<HTMLImageElement | null> {
  if (!url || signal.aborted) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (value: HTMLImageElement | null) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => settle(null);
    signal.addEventListener("abort", onAbort, { once: true });
    if (timeoutMs !== null) timer = setTimeout(() => settle(null), timeoutMs);
    image.decoding = "async";
    image.src = url;
    image.decode().then(
      () => settle(image),
      () => settle(null),
    );
  });
}

/** A canvas that is not in the page, its context pre-scaled so it is drawn in CSS pixels. */
export function makeLayer(width: number, height: number, dpr: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  const ctx = canvas.getContext("2d") as Ctx;
  ctx.setTransform(canvas.width / Math.max(1, width), 0, 0, canvas.height / Math.max(1, height), 0, 0);
  return { canvas, ctx };
}

/** Draws `image` to cover a w x h box (object-fit: cover), zoomed by `zoom` about the box's centre. */
export function drawCover(c: Ctx, image: CanvasImageSource & { width: number; height: number }, w: number, h: number, zoom = 1, shiftX = 0, shiftY = 0): void {
  const iw = image.width;
  const ih = image.height;
  if (!(iw > 0 && ih > 0)) return;
  const scale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  c.drawImage(image, (w - dw) / 2 + shiftX, (h - dh) / 2 + shiftY, dw, dh);
}

/** The section plates are 16:9. */
export const PLATE_ASPECT = 16 / 9;

/**
 * Where a point of the plate, given as fractions of its width and height, lands
 * on a w x h screen when the plate is drawn to cover it (drawCover, zoom 1).
 */
export function platePoint(w: number, h: number, fx: number, fy: number): { x: number; y: number } {
  const scale = Math.max(w / PLATE_ASPECT, h);
  const dw = scale * PLATE_ASPECT;
  return { x: (w - dw) / 2 + fx * dw, y: (h - scale) / 2 + fy * scale };
}

/** The plate softened once: drawn small and scaled back up. */
export function softenedPlate(image: HTMLImageElement, w: number, h: number, dpr: number, soften: number): HTMLCanvasElement {
  const factor = Math.max(1, soften);
  const small = makeLayer(Math.max(1, w / factor), Math.max(1, h / factor), 1);
  small.ctx.imageSmoothingQuality = "high";
  drawCover(small.ctx, image, w / factor, h / factor);
  const out = makeLayer(w, h, dpr);
  out.ctx.imageSmoothingEnabled = true;
  out.ctx.imageSmoothingQuality = "high";
  out.ctx.drawImage(small.canvas, 0, 0, w, h);
  return out.canvas;
}

export function radialSprite(radius: number, dpr: number, stops: Array<[number, string]>): HTMLCanvasElement {
  const size = Math.max(2, Math.ceil(radius * 2));
  const { canvas, ctx } = makeLayer(size, size, dpr);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, radius);
  for (const [at, colour] of stops) g.addColorStop(at, colour);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export interface SceneFrameInfo {
  /** Seconds since the plate settled; 0 until then. */
  t: number;
  dt: number;
  width: number;
  height: number;
  dpr: number;
  pointer: Readonly<PointerState>;
  /** The plate settled (loaded or given up on): the scene's clock is running. */
  ready: boolean;
}

export interface CanvasSceneSpec {
  /** Seconds from the plate settling to the scene's natural end. */
  endS: number;
  dprCap?: number;
  className?: string;
  /** Called with every new size, and again once the plate settles (image null if it never came). */
  layout(size: Readonly<SceneSize>, image: HTMLImageElement | null): void;
  render(c: Ctx, info: Readonly<SceneFrameInfo>): void;
  onPointer?(pointer: Readonly<PointerState>, event: PointerEvent): void;
  /** Called once when the scene's clock starts. */
  onReady?(): void;
  /** Undoes what the scene added beyond its canvas (classes, styles, DOM). */
  cleanup?(): void;
}

export function runCanvasScene(ctx: TsukiSceneContext, spec: CanvasSceneSpec): TsukiSceneHandle {
  injectSceneStyles(kitCss, ctx.signal);
  const life = new AbortController();
  const signal = life.signal;
  ctx.signal.addEventListener("abort", () => life.abort(), { once: true });

  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    resolveDone();
  };

  let image: HTMLImageElement | null = null;
  let ready = false;
  let startedAt = 0;
  let size: SceneSize | null = null;
  const info: SceneFrameInfo = { t: 0, dt: 0, width: 0, height: 0, dpr: 1, pointer: IDLE_POINTER, ready: false };

  const loop = ctx.createCanvasLoop({
    render(c, frame: Readonly<SceneFrame>) {
      if (signal.aborted) return;
      if (ready && startedAt < 0) startedAt = frame.t;
      info.t = ready ? Math.max(0, frame.t - startedAt) : 0;
      info.dt = ready ? frame.dt : 0;
      info.width = frame.width;
      info.height = frame.height;
      info.dpr = frame.dpr;
      info.pointer = frame.pointer;
      info.ready = ready;
      spec.render(c, info);
      if (ready && info.t >= spec.endS) finish();
    },
    resize(next) {
      size = { ...next };
      spec.layout(next, image);
    },
    onPointer: spec.onPointer,
    className: spec.className,
    dprCap: spec.dprCap ?? 1.25,
  });

  void loadPlate(ctx.assets.backgroundUrl, signal, READY_TIMEOUT_MS).then((loaded) => {
    if (signal.aborted) return;
    image = loaded;
    if (size) spec.layout(size, image);
    ready = true;
    // The clock starts at the next frame's time, so `t` begins at 0 wherever the loop's own time stands.
    startedAt = -1;
    spec.onReady?.();
  });
  loop.start();

  const safety = createRevealClock(READY_TIMEOUT_MS + (spec.endS + 3) * 1000, signal);
  void safety.done.then(finish);

  signal.addEventListener(
    "abort",
    () => {
      safety.dispose();
      loop.destroy();
      loop.canvas.remove();
      spec.cleanup?.();
    },
    { once: true },
  );

  return { done, dispose: () => life.abort() };
}

/**
 * The reduced-motion composition: `draw` paints the whole still from the plate
 * (null if it cannot be had). Drawn once per size and once the plate arrives;
 * nothing changes on screen after that.
 */
export function stillCanvas(
  ctx: TsukiSceneContext,
  draw: (c: Ctx, size: Readonly<SceneSize>, image: HTMLImageElement | null) => void,
  className?: string,
): void {
  injectSceneStyles(kitCss, ctx.signal);
  let image: HTMLImageElement | null = null;
  let needsDraw = true;
  const paint = (c: Ctx, frame: Readonly<SceneFrame>) => {
    c.clearRect(0, 0, frame.width, frame.height);
    draw(c, frame, image);
  };
  const loop = ctx.createCanvasLoop({
    // Under reduced motion the runtime draws reducedMotionFrame on start and after a resize and runs no frames;
    // should it run frames anyway, draw once per size and leave the canvas alone after.
    render: (c, frame) => {
      if (!needsDraw) return;
      needsDraw = false;
      paint(c, frame);
    },
    reducedMotionFrame: paint,
    resize: () => {
      needsDraw = true;
    },
    className,
    dprCap: 1.5,
  });
  void loadPlate(ctx.assets.backgroundUrl, ctx.signal, null).then((loaded) => {
    if (ctx.signal.aborted) return;
    image = loaded;
    needsDraw = true;
    // start() draws the still again under reduced motion.
    loop.start();
  });
  loop.start();
  ctx.signal.addEventListener("abort", () => loop.canvas.remove(), { once: true });
}

// ---- the epigraph -------------------------------------------------------------------

/**
 * Splits the epigraph into one inline <span class="tsuki-k-g"> per grapheme
 * cluster (Thai marks stay with their consonant), so textContent never
 * changes. Each span gets --i (its index) and --n (the count) for the scene's
 * stylesheet to stagger with. The spans stay inline: an inline-block span per
 * cluster would let a Thai line break in the middle of a word. Returns the
 * spans and a function that puts the plain text node back.
 */
export function splitGlyphs(textEl: HTMLElement): { glyphs: HTMLSpanElement[]; restore(): void } {
  const text = textEl.textContent ?? "";
  const clusters = splitGraphemes(text);
  const glyphs = clusters.map((cluster, index) => {
    const span = document.createElement("span");
    span.className = "tsuki-k-g";
    span.style.setProperty("--i", String(index));
    span.textContent = cluster;
    return span;
  });
  textEl.style.setProperty("--n", String(Math.max(1, glyphs.length)));
  textEl.replaceChildren(...glyphs);
  return {
    glyphs,
    restore() {
      textEl.replaceChildren(document.createTextNode(text));
      textEl.style.removeProperty("--n");
    },
  };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The epigraph's box relative to the stage, or null while it has no size. */
export function textBox(stage: HTMLElement, textEl: HTMLElement): Box | null {
  const box = textEl.getBoundingClientRect();
  if (!(box.width > 0 && box.height > 0)) return null;
  const origin = stage.getBoundingClientRect();
  return { x: box.left - origin.left, y: box.top - origin.top, w: box.width, h: box.height };
}

/** Darkens the picture softly behind the epigraph so it reads over anything the scene draws. */
export function drawTextScrim(c: Ctx, box: Box | null, strength: number): void {
  if (!box || !(strength > 0)) return;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const r = Math.max(box.w, box.h) * 0.75;
  c.save();
  c.translate(cx, cy);
  c.scale(1, Math.max(0.35, box.h / box.w) * 1.4);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, `rgba(4, 3, 10, ${(0.55 * strength).toFixed(3)})`);
  g.addColorStop(0.6, `rgba(4, 3, 10, ${(0.3 * strength).toFixed(3)})`);
  g.addColorStop(1, "rgba(4, 3, 10, 0)");
  c.fillStyle = g;
  c.fillRect(-r, -r, r * 2, r * 2);
  c.restore();
}

/** Sakura petal sprites in four tints, drawn at 24 CSS pixels. */
export function petalSprites(dpr: number): HTMLCanvasElement[] {
  const tints = [
    ["#f3c6d6", "#d98aa6"],
    ["#f7d9e3", "#e3a5bb"],
    ["#eab3c6", "#c7768f"],
    ["#fde8ee", "#e9b3c4"],
  ];
  return tints.map(([light, dark]) => {
    const { canvas, ctx } = makeLayer(24, 24, dpr);
    const g = ctx.createLinearGradient(4, 4, 20, 20);
    g.addColorStop(0, light);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(12, 21);
    ctx.bezierCurveTo(3, 16, 3, 6, 9, 3.5);
    ctx.lineTo(12, 6.5);
    ctx.lineTo(15, 3.5);
    ctx.bezierCurveTo(21, 6, 21, 16, 12, 21);
    ctx.closePath();
    ctx.fill();
    return canvas;
  });
}

/** Draws a petal sprite turned by `rot`, tumbling (its width squeezed by cos(tumble)). */
export function drawPetal(c: Ctx, sprite: HTMLCanvasElement, x: number, y: number, size: number, rot: number, tumble: number, alpha: number): void {
  c.globalAlpha = alpha;
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.scale(Math.max(0.12, Math.abs(Math.cos(tumble))), 1);
  c.drawImage(sprite, -size / 2, -size / 2, size, size);
  c.restore();
  c.globalAlpha = 1;
}

const IDLE_POINTER: PointerState ={ x: 0, y: 0, nx: 0.5, ny: 0.5, active: false, down: false, justTapped: false, type: "mouse" };
