// The /lodge/ home page backdrop (design section 5.1): the lodge plate in
// graphite, a three-depth pencil-stroke snowfall with gusts, the reader's
// footprints in the foreground snow and, as reading progresses, the bare
// long-toed prints that retrace them half a second late and the shadows at the
// treeline that turn when the pointer stops. Rules live in whiteout-core.ts.
//
// Decoration only: the canvas is aria-hidden, takes pointer input from
// scene-runtime's passive window listeners and never covers the hero copy,
// which sits above it with its own vignette.
import { createNoise2D, createRng, fbm2D, type SceneFrame, type SceneSize } from "../../_shared/scene-runtime";
import type { DriftLevel } from "../progress-core";
import { coverRect, luminanceRamp, platePoint, type Rect } from "../canvas/kit-core";
import { loadPlate, makeLayer, paperGrain, pencilFlake, runLodgeScene, smudge, type LodgeSceneHandle } from "../canvas/kit";
import {
  PRINT_FADE_S,
  STRIDE_PX,
  followerSteps,
  gustLength,
  gustVeil,
  nextGustAt,
  placeSteps,
  printAlpha,
  shadowCount,
  shadowTurn,
  type Gust,
  type PathPoint,
  type Step,
} from "./whiteout-core";

export interface MountWhiteoutOptions {
  mount: HTMLElement;
  plateUrl: string;
  level: DriftLevel;
  still: boolean;
  /** The finale's mirrored home (design 8.2). */
  mirrored?: boolean;
  /** Turn from the plain scene into the mirrored one, once (the first visit after the finale). */
  flipOnce?: boolean;
  seed?: number;
}

export interface WhiteoutHandle {
  setStill(still: boolean): void;
  destroy(): void;
}

/** Where the plate is anchored when it is cropped (fractions of the overflow). */
const FOCUS = { x: 0.45, y: 0.56 };
/** The foreground band that takes footprints, as a fraction of the height from the bottom. */
const PRINT_BAND = 0.2;
/** A dark lodge window that lights up once a chapter is finished (plate fractions). */
const LATE_WINDOW = { u: 0.3755, v: 0.812 };
/** Treeline figures: plate x, ground line, height (fractions of the plate) and how solid each one reads. */
const SHADOWS: Record<2 | 3, Array<{ u: number; v: number; h: number; solid: number }>> = {
  2: [
    { u: 0.468, v: 0.861, h: 0.078, solid: 0.7 },
    { u: 0.497, v: 0.868, h: 0.071, solid: 0.85 },
    { u: 0.548, v: 0.864, h: 0.083, solid: 0.6 },
    { u: 0.571, v: 0.872, h: 0.069, solid: 0.9 },
    { u: 0.618, v: 0.866, h: 0.08, solid: 0.75 },
    { u: 0.664, v: 0.874, h: 0.074, solid: 0.55 },
    { u: 0.709, v: 0.87, h: 0.077, solid: 0.8 },
  ],
  3: [
    { u: 0.452, v: 0.925, h: 0.112, solid: 0.8 },
    { u: 0.503, v: 0.94, h: 0.104, solid: 0.9 },
    { u: 0.561, v: 0.93, h: 0.118, solid: 0.7 },
    { u: 0.598, v: 0.948, h: 0.101, solid: 0.95 },
    { u: 0.652, v: 0.934, h: 0.115, solid: 0.75 },
    { u: 0.707, v: 0.944, h: 0.108, solid: 0.85 },
  ],
};
const STROKE_GAP_S = 0.35;
const MAX_STROKE_POINTS = 400;

interface Flake {
  x: number;
  y: number;
  depth: 0 | 1 | 2;
  speed: number;
  len: number;
  alpha: number;
  phase: number;
}

const DEPTHS = [
  { share: 0.5, speed: [18, 30], len: [1.2, 2.2], alpha: [0.18, 0.32] },
  { share: 0.35, speed: [38, 60], len: [2.4, 4.2], alpha: [0.3, 0.5] },
  { share: 0.15, speed: [80, 120], len: [5, 9], alpha: [0.45, 0.7] },
] as const;

export function mountWhiteout(options: MountWhiteoutOptions): WhiteoutHandle {
  const { mount, level } = options;
  const mirrored = Boolean(options.mirrored);
  const FLIP_FROM_S = 0.6;
  const FLIP_S = 1.5;
  let flipping = mirrored && Boolean(options.flipOnce) && !options.still;
  /** The plain scene, kept only while the first flip runs. */
  let plainBase: HTMLCanvasElement | null = null;
  const rng = createRng(options.seed ?? 20240206);
  const noise = createNoise2D(options.seed ?? 20240206);

  const canvas = document.createElement("canvas");
  canvas.className = "lodge-whiteout-canvas";
  canvas.setAttribute("aria-hidden", "true");
  mount.append(canvas);

  const abort = new AbortController();
  let plate: HTMLImageElement | null = null;
  let size: SceneSize | null = null;
  let rect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  let base: HTMLCanvasElement | null = null;
  let flakes: Flake[] = [];
  let gusts: Gust[] = [];
  let nextGust = 0;
  let destroyed = false;

  // Footprints: the current stroke of pointer positions, the prints already placed.
  let stroke: PathPoint[] = [];
  let strokeSteps = 0;
  let steps: Step[] = [];
  let lastPointerAt = -Infinity;
  let lastMoveAt = 0;
  let lastPointer = { x: -1, y: -1 };

  const wind = level >= 1 ? 1.15 : 1;

  const spawnFlake = (w: number, h: number, anywhere: boolean): Flake => {
    const pick = rng();
    const depth: 0 | 1 | 2 = pick < DEPTHS[0].share ? 0 : pick < DEPTHS[0].share + DEPTHS[1].share ? 1 : 2;
    const spec = DEPTHS[depth];
    const between = (range: readonly [number, number]) => range[0] + rng() * (range[1] - range[0]);
    return {
      x: rng() * w,
      y: anywhere ? rng() * h : -10 - rng() * 40,
      depth,
      speed: between(spec.speed),
      len: between(spec.len),
      alpha: between(spec.alpha),
      phase: rng() * Math.PI * 2,
    };
  };

  const drawFallbackSky = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#1b1a18");
    sky.addColorStop(0.55, "#2e2c29");
    sky.addColorStop(1, "#474440");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#121110";
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * 0.72 - fbm2D(noise, x / 260, 0.5, 4) * h * 0.12);
    ctx.lineTo(w, h);
    ctx.fill();
  };

  const bakeBase = (next: SceneSize, flip: boolean): HTMLCanvasElement | null => {
    const layer = makeLayer(next);
    if (!layer) return null;
    const { ctx } = layer;
    const { width: w, height: h } = next;
    ctx.fillStyle = "#0e0d0c";
    ctx.fillRect(0, 0, w, h);
    if (plate) {
      const cover = coverRect(plate.naturalWidth, plate.naturalHeight, w, h);
      rect = { ...cover, x: (w - cover.w) * FOCUS.x, y: (h - cover.h) * FOCUS.y };
      ctx.save();
      if (flip) {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      ctx.filter = "grayscale(1) contrast(1.12) brightness(0.66)";
      ctx.drawImage(plate, rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    } else {
      rect = { x: 0, y: 0, w, h };
      drawFallbackSky(ctx, w, h);
    }
    paperGrain(ctx, w, h, 7);
    const edges = ctx.createLinearGradient(0, 0, w, 0);
    edges.addColorStop(0, "rgba(14,13,12,0.5)");
    edges.addColorStop(0.24, "rgba(14,13,12,0)");
    edges.addColorStop(0.76, "rgba(14,13,12,0)");
    edges.addColorStop(1, "rgba(14,13,12,0.5)");
    ctx.fillStyle = edges;
    ctx.fillRect(0, 0, w, h);
    return layer.canvas;
  };

  const bake = (next: SceneSize) => {
    size = next;
    const { width: w, height: h } = next;
    base = bakeBase(next, mirrored);
    plainBase = flipping ? bakeBase(next, false) : null;
    bakeFigures(next);
    const count = Math.round((w * h) / 2600);
    flakes = Array.from({ length: count }, () => spawnFlake(w, h, true));
  };

  /** A plate point, mirrored with the plate in the finale. */
  const at = (u: number, v: number) => {
    const point = platePoint(rect, u, v);
    if (mirrored && size) point.x = size.width - point.x;
    return point;
  };

  const drawLateWindow = (ctx: CanvasRenderingContext2D) => {
    if (level < 1 || !plate) return;
    const { x, y } = at(LATE_WINDOW.u, LATE_WINDOW.v);
    const r = rect.h * 0.012;
    smudge(ctx, x, y, r * 4, 0.16, "236,214,160");
    ctx.fillStyle = "rgba(240,224,182,0.55)";
    ctx.fillRect(x - r * 0.45, y - r * 0.7, r * 0.9, r * 1.3);
  };

  const figures = () => (level === 2 || level === 3 ? SHADOWS[level].slice(0, shadowCount(level)) : []);

  /** One too-thin figure, feet at the origin, drawn upward. */
  const figure = (ctx: CanvasRenderingContext2D, H: number, solid: number, lean: number) => {
    ctx.save();
    ctx.transform(1, 0, lean, 1, 0, 0);
    ctx.fillStyle = `rgba(10,9,8,${0.86 * solid})`;
    const quad = (x1: number, y1: number, w1: number, x2: number, y2: number, w2: number) => {
      ctx.beginPath();
      ctx.moveTo(x1 - w1, y1);
      ctx.lineTo(x1 + w1, y1);
      ctx.lineTo(x2 + w2, y2);
      ctx.lineTo(x2 - w2, y2);
      ctx.closePath();
      ctx.fill();
    };
    quad(-0.022 * H, -0.5 * H, 0.014 * H, -0.026 * H, 0, 0.01 * H);
    quad(0.022 * H, -0.5 * H, 0.014 * H, 0.024 * H, 0, 0.01 * H);
    quad(0, -0.84 * H, 0.062 * H, 0, -0.48 * H, 0.04 * H);
    quad(-0.064 * H, -0.83 * H, 0.011 * H, -0.08 * H, -0.36 * H, 0.008 * H);
    quad(0.064 * H, -0.83 * H, 0.011 * H, 0.078 * H, -0.37 * H, 0.008 * H);
    quad(0, -0.885 * H, 0.012 * H, 0, -0.835 * H, 0.016 * H);
    ctx.beginPath();
    ctx.ellipse(0, -0.94 * H, 0.043 * H, 0.058 * H, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    smudge(ctx, 0, 0, H * 0.09, 0.3, "205,200,191");
  };

  let figuresLayer: HTMLCanvasElement | null = null;

  const bakeFigures = (next: SceneSize) => {
    figuresLayer = null;
    const list = figures();
    if (list.length === 0) return;
    const layer = makeLayer(next);
    if (!layer) return;
    layer.ctx.filter = "blur(0.7px)";
    list.forEach((spec, i) => {
      const { x, y } = at(spec.u, spec.v);
      layer.ctx.save();
      layer.ctx.translate(x, y);
      figure(layer.ctx, rect.h * spec.h, spec.solid, ((i * 5) % 7 - 3) * 0.012);
      layer.ctx.restore();
    });
    figuresLayer = layer.canvas;
  };

  const drawShadows = (ctx: CanvasRenderingContext2D, stillFor: number, w: number, h: number) => {
    if (!figuresLayer) return;
    ctx.drawImage(figuresLayer, 0, 0, w, h);
    figures().forEach((spec, i) => {
      const turn = shadowTurn(stillFor, i);
      if (turn <= 0) return;
      const H = rect.h * spec.h;
      const { x, y } = at(spec.u, spec.v);
      ctx.fillStyle = `rgba(214,208,198,${0.34 * turn * spec.solid})`;
      ctx.beginPath();
      ctx.ellipse(x + ((i * 5) % 7 - 3) * 0.012 * -0.94 * H, y - 0.94 * H, 0.026 * H, 0.038 * H, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const bootPrint = (ctx: CanvasRenderingContext2D, step: Step, alpha: number, scale: number) => {
    const side = step.side === "L" ? -1 : 1;
    ctx.save();
    ctx.translate(step.x, step.y);
    ctx.rotate(step.angle + Math.PI / 2);
    ctx.translate(side * 5 * scale, 0);
    const sole = () => {
      ctx.beginPath();
      ctx.ellipse(0, -2.6 * scale, 2.9 * scale, 5 * scale, 0, 0, Math.PI * 2);
      ctx.ellipse(0, 5.4 * scale, 2.4 * scale, 2.7 * scale, 0, 0, Math.PI * 2);
    };
    ctx.fillStyle = `rgba(226,221,212,${0.22 * alpha})`;
    ctx.translate(0.8, 0.8);
    sole();
    ctx.fill();
    ctx.translate(-0.8, -0.8);
    ctx.fillStyle = `rgba(40,38,36,${0.58 * alpha})`;
    sole();
    ctx.fill();
    ctx.restore();
  };

  /** A bare print with toes too long (chapter 5, chapter 16). */
  const barePrint = (ctx: CanvasRenderingContext2D, step: Step, alpha: number, scale: number) => {
    const side = step.side === "L" ? -1 : 1;
    ctx.save();
    ctx.translate(step.x, step.y);
    ctx.rotate(step.angle + Math.PI / 2);
    ctx.translate(side * 6 * scale + 2, 1.5);
    ctx.fillStyle = `rgba(14,13,14,${0.66 * alpha})`;
    ctx.beginPath();
    ctx.ellipse(0, 2 * scale, 2.3 * scale, 5.4 * scale, side * 0.08, 0, Math.PI * 2);
    ctx.fill();
    for (let toe = 0; toe < 5; toe += 1) {
      const tx = (toe - 2) * 1.15 * scale * -side;
      const length = (3.8 - Math.abs(toe - 1) * 0.45) * scale;
      ctx.beginPath();
      ctx.ellipse(tx, -3.8 * scale - length, 0.55 * scale, length, (toe - 2) * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const printScale = (y: number) => {
    if (!size) return 1;
    const band = size.height * PRINT_BAND;
    return 1 + ((y - (size.height - band)) / band) * 0.6;
  };

  const trackPointer = (frame: Readonly<SceneFrame>) => {
    const { pointer, t, height } = frame;
    const inBand = pointer.active && pointer.y > height * (1 - PRINT_BAND) && pointer.y < height;
    const moved = Math.hypot(pointer.x - lastPointer.x, pointer.y - lastPointer.y) > 1.5;
    if (moved) lastMoveAt = t;
    lastPointer = { x: pointer.x, y: pointer.y };
    if (!inBand) {
      return;
    }
    if (!moved) return;
    if (t - lastPointerAt > STROKE_GAP_S || stroke.length >= MAX_STROKE_POINTS) {
      stroke = [];
      strokeSteps = 0;
    }
    lastPointerAt = t;
    stroke.push({ x: pointer.x, y: pointer.y, t });
    const placed = placeSteps(stroke, STRIDE_PX);
    if (placed.length > strokeSteps) {
      steps.push(...placed.slice(strokeSteps));
      strokeSteps = placed.length;
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, frame: Readonly<SceneFrame>, moving: boolean) => {
    const { width: w, height: h, t, dt } = frame;
    ctx.setTransform(frame.dpr, 0, 0, frame.dpr, 0, 0);
    if (flipping && plainBase && moving) {
      const turn = luminanceRamp(t - FLIP_FROM_S, FLIP_S);
      ctx.drawImage(plainBase, 0, 0, w, h);
      if (base) {
        ctx.globalAlpha = turn;
        ctx.drawImage(base, 0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      if (turn >= 1) {
        flipping = false;
        plainBase = null;
      }
    } else if (base) {
      ctx.drawImage(base, 0, 0, w, h);
    }
    drawLateWindow(ctx);

    if (moving) trackPointer(frame);
    const stillFor = moving ? t - lastMoveAt : 0;
    drawShadows(ctx, stillFor, w, h);

    // Footprints, then the follower on top of them.
    if (moving) {
      steps = steps.filter((step) => t - step.t < PRINT_FADE_S + 1);
      for (const step of steps) {
        const alpha = printAlpha(t - step.t);
        if (alpha > 0) (mirrored ? barePrint : bootPrint)(ctx, step, alpha, printScale(step.y));
      }
      for (const step of followerSteps(steps, level, t)) {
        const alpha = printAlpha(t - step.t);
        if (alpha > 0) barePrint(ctx, step, alpha, printScale(step.y));
      }
    }

    // Gusts: scheduled ahead, they thicken the snow and pass a pale veil across.
    if (moving && t >= nextGust) {
      if (nextGust > 0) gusts.push({ at: t, length: gustLength(rng) });
      nextGust = nextGustAt(rng, t);
      gusts = gusts.filter((gust) => t - gust.at < gust.length + 1);
    }
    const veil = moving ? gustVeil(t, gusts) : 0;
    const drift = (14 + veil * 120) * wind;

    for (const flake of flakes) {
      if (moving) {
        const sway = noise(flake.phase, t * 0.2) * 10;
        flake.y += flake.speed * (1 + veil * 0.8) * dt;
        flake.x += (drift * (0.4 + flake.depth * 0.3) + sway) * dt;
        if (flake.y > h + 10) Object.assign(flake, spawnFlake(w, h, false));
        if (flake.x > w + 10) flake.x = -10;
        if (flake.x < -10) flake.x = w + 10;
      }
      const angle = Math.atan2(flake.speed, drift * (0.4 + flake.depth * 0.3)) + Math.PI;
      pencilFlake(ctx, flake.x, flake.y, flake.len, angle, flake.alpha);
    }

    if (veil > 0) {
      const band = ctx.createLinearGradient(0, 0, w, 0);
      const shift = (t * 0.08) % 1;
      band.addColorStop(0, `rgba(222,218,210,${veil * 0.42})`);
      band.addColorStop(Math.min(0.99, 0.35 + shift * 0.3), `rgba(222,218,210,${veil * 0.6})`);
      band.addColorStop(1, `rgba(222,218,210,${veil * 0.36})`);
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, w, h);
    }

    // The scene gives way to blank paper as the reader scrolls to the found note.
    const fade = Math.min(1, Math.max(0, window.scrollY / (h * 0.9)));
    if (fade > 0) {
      ctx.fillStyle = `rgba(14,13,12,${fade * 0.88})`;
      ctx.fillRect(0, 0, w, h);
    }
  };

  const handle: LodgeSceneHandle = runLodgeScene({
    canvas,
    container: mount,
    still: options.still,
    layout: bake,
    draw,
  });

  void loadPlate(options.plateUrl, abort.signal)
    .then((image) => {
      if (destroyed) return;
      plate = image;
      if (size) bake(size);
      handle.redrawStill();
      mount.dataset.plate = "ready";
    })
    .catch(() => {
      if (!destroyed) mount.dataset.plate = "failed";
    });

  let scrollFrame = 0;
  const onScroll = () => {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      handle.redrawStill();
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  return {
    setStill: (still) => handle.setStill(still),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      abort.abort();
      window.cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", onScroll);
      handle.destroy();
      canvas.remove();
      base = null;
      flakes = [];
      steps = [];
    },
  };
}
