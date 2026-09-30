// "Lamphu by the canal": the hub's firefly background.
//
// Static art (sky, far bank, lamphu trees) is painted once per size into
// layer canvases; each frame only moves firefly sprites, river strips and
// reeds. Tree geometry lives in firefly-tree.ts, flash timing and
// synchronisation in firefly-sync.ts.

import {
  createNoise2D,
  createRng,
  createScene,
  fbm2D,
  type PointerState,
  type SceneFrame,
  type SceneSize,
} from "./scene-runtime";
import {
  configureGrid,
  createFlashField,
  flashIntensity,
  seedFirefly,
  smoothstep as smooth,
  startWave,
  stepField,
} from "./firefly-sync";
import { buildTree, MARGIN, pickWeighted, type CrownSpec, type LayoutMode, type Pad, type TreeGeom } from "./firefly-tree";

const SEED = 0x51a7e;
const MAX_FIREFLIES = 330;
const FX_DPR_CAP = 1.5;
const STATIC_DPR_CAP = 2;
const SKY_DPR_CAP = 1.25;
const RIVER_DPR_CAP = 1.5;
const SPRITE_SIZE = 64;
const TAU = Math.PI * 2;

export type { CrownSpec, LayoutMode };

export interface SceneLayout {
  mode: LayoutMode;
  width: number;
  height: number;
  waterY: number;
  moonX: number;
  moonY: number;
  moonR: number;
  farHeight: number;
  houses: number;
  reedHeight: number;
  /** Size scale relative to a 900 px short side. */
  scale: number;
  trees: CrownSpec[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function layoutMode(width: number, height: number): LayoutMode {
  const aspect = width / Math.max(1, height);
  if (aspect < 0.85) return "portrait";
  if (height < 520 && aspect > 1.45) return "short";
  return "wide";
}

export function computeLayout(width: number, height: number): SceneLayout {
  const W = width;
  const H = height;
  const mode = layoutMode(W, H);
  const scale = clamp(Math.min(W, H) / 900, 0.5, 1.25);
  if (mode === "portrait") {
    const waterY = H * 0.79;
    return {
      mode, width: W, height: H, waterY, scale,
      // Above the profile chip: the only sky band content never covers at the top of the page.
      moonX: W * 0.78, moonY: clamp(H * 0.024, 15, 22), moonR: clamp(W * 0.024, 7, 10),
      farHeight: H * 0.03, houses: 2, reedHeight: Math.min(H * 0.15, 140),
      trees: [
        { x0: -W * 0.55, x1: W * 0.86, top: -H * 0.04, bottom: H * 0.5, belly: 0.58, baseX: W * 0.06, baseY: waterY + H * 0.045, forkX: W * 0.22, forkY: H * 0.45, near: true, seed: 11, fireflyShare: 0.7, sprays: 8 },
        { x0: W * 0.56, x1: W * 1.12, top: H * 0.57, bottom: H * 0.75, belly: 0.66, baseX: W * 0.83, baseY: waterY + H * 0.004, forkX: W * 0.82, forkY: H * 0.73, near: false, seed: 23, fireflyShare: 0.2, sprays: 3 },
      ],
    };
  }
  if (mode === "short") {
    const waterY = H * 0.72;
    return {
      mode, width: W, height: H, waterY, scale,
      moonX: W * 0.58, moonY: H * 0.16, moonR: clamp(H * 0.022, 7, 12),
      farHeight: H * 0.055, houses: 3, reedHeight: H * 0.2,
      trees: [
        { x0: -W * 0.26, x1: W * 0.24, top: -H * 0.1, bottom: H * 0.54, belly: 0.64, baseX: W * 0.05, baseY: waterY + H * 0.08, forkX: W * 0.09, forkY: H * 0.48, near: true, seed: 11, fireflyShare: 0.4, sprays: 5 },
        { x0: W * 0.78, x1: W * 1.18, top: -H * 0.02, bottom: H * 0.5, belly: 0.62, baseX: W * 0.97, baseY: waterY + H * 0.09, forkX: W * 0.93, forkY: H * 0.45, near: true, seed: 17, fireflyShare: 0.28, sprays: 3 },
        { x0: W * 0.61, x1: W * 0.75, top: H * 0.45, bottom: H * 0.66, belly: 0.66, baseX: W * 0.685, baseY: waterY + H * 0.005, forkX: W * 0.68, forkY: H * 0.63, near: false, seed: 23, fireflyShare: 0.12, sprays: 2 },
      ],
    };
  }
  const waterY = H * 0.75;
  return {
    mode, width: W, height: H, waterY, scale,
    moonX: W * 0.6, moonY: H * 0.125, moonR: clamp(H * 0.02, 11, 24),
    farHeight: H * 0.045, houses: 5, reedHeight: Math.min(H * 0.24, 230),
    trees: [
      // Dominant tree on the left, a smaller one on the right; mid trees off the mirror axis.
      { x0: -W * 0.22, x1: W * 0.41, top: -H * 0.05, bottom: H * 0.52, belly: 0.64, baseX: W * 0.075, baseY: waterY + H * 0.045, forkX: W * 0.13, forkY: H * 0.47, near: true, seed: 11, fireflyShare: 0.46, sprays: 11 },
      { x0: W * 0.8, x1: W * 1.17, top: H * 0.03, bottom: H * 0.45, belly: 0.62, baseX: W * 0.965, baseY: waterY + H * 0.055, forkX: W * 0.935, forkY: H * 0.41, near: true, seed: 17, fireflyShare: 0.24, sprays: 6 },
      { x0: W * 0.655, x1: W * 0.83, top: H * 0.44, bottom: H * 0.665, belly: 0.66, baseX: W * 0.735, baseY: waterY + H * 0.004, forkX: W * 0.735, forkY: H * 0.635, near: false, seed: 23, fireflyShare: 0.1, sprays: 3 },
      { x0: W * 0.415, x1: W * 0.505, top: H * 0.585, bottom: H * 0.705, belly: 0.66, baseX: W * 0.462, baseY: waterY + H * 0.003, forkX: W * 0.462, forkY: H * 0.69, near: false, seed: 29, fireflyShare: 0.04, sprays: 2 },
    ],
  };
}

/** Firefly count by viewport area; coarse pointers (phones, tablets) get fewer. */
export function fireflyCount(width: number, height: number, coarse: boolean): number {
  const base = 60 + (Math.max(0, width) * Math.max(0, height)) / 6500;
  return Math.round(clamp(base * (coarse ? 0.85 : 1), 50, MAX_FIREFLIES - 10));
}


/* ------------------------------------------------------------------ */
/* Painting helpers                                                     */
/* ------------------------------------------------------------------ */

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return ctx;
}

interface Limb { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number; w0: number; w1: number }

function taperedCurve(ctx: CanvasRenderingContext2D, l: Limb): void {
  const steps = 8;
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * l.x0 + 2 * mt * t * l.cx + t * t * l.x1;
    const y = mt * mt * l.y0 + 2 * mt * t * l.cy + t * t * l.y1;
    const dx = 2 * mt * (l.cx - l.x0) + 2 * t * (l.x1 - l.cx);
    const dy = 2 * mt * (l.cy - l.y0) + 2 * t * (l.y1 - l.cy);
    const len = Math.hypot(dx, dy) || 1;
    const w = lerp(l.w0, l.w1, t) / 2;
    left.push(x - (dy / len) * w, y + (dx / len) * w);
    right.push(x + (dy / len) * w, y - (dx / len) * w);
  }
  ctx.moveTo(left[0], left[1]);
  for (let i = 2; i < left.length; i += 2) ctx.lineTo(left[i], left[i + 1]);
  for (let i = right.length - 2; i >= 0; i -= 2) ctx.lineTo(right[i], right[i + 1]);
  ctx.closePath();
  ctx.moveTo(l.x1 + l.w1 / 2, l.y1);
  ctx.arc(l.x1, l.y1, l.w1 / 2, 0, TAU);
}

/** Smooth tapered outline of a limb given as (x, y, width) triples; overlapping limbs union under nonzero fill. */
function branchPath(ctx: CanvasRenderingContext2D, pts: number[]): void {
  const n = pts.length / 3;
  if (n < 2) return;
  const lx: number[] = [];
  const ly: number[] = [];
  const rx: number[] = [];
  const ry: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1) * 3;
    const b = Math.min(n - 1, i + 1) * 3;
    const dx = pts[b] - pts[a];
    const dy = pts[b + 1] - pts[a + 1];
    const len = Math.hypot(dx, dy) || 1;
    const w = pts[i * 3 + 2] / 2;
    const nx = (-dy / len) * w;
    const ny = (dx / len) * w;
    lx.push(pts[i * 3] + nx);
    ly.push(pts[i * 3 + 1] + ny);
    rx.push(pts[i * 3] - nx);
    ry.push(pts[i * 3 + 1] - ny);
  }
  const side = (xs: number[], ys: number[], reverse: boolean) => {
    const order = xs.map((_, i) => (reverse ? xs.length - 1 - i : i));
    const first = order[0];
    if (reverse) ctx.lineTo(xs[first], ys[first]);
    else ctx.moveTo(xs[first], ys[first]);
    for (let k = 1; k < order.length - 1; k++) {
      const c = order[k];
      const d = order[k + 1];
      ctx.quadraticCurveTo(xs[c], ys[c], (xs[c] + xs[d]) / 2, (ys[c] + ys[d]) / 2);
    }
    const last = order[order.length - 1];
    ctx.lineTo(xs[last], ys[last]);
  };
  side(lx, ly, false);
  side(rx, ry, true);
  ctx.closePath();
}

/** A pointed leaf from (x, y) along `ang`: two quadratic curves, no ellipse. */
function leafPath(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, wid: number): void {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const mx = x + dx * len * 0.45;
  const my = y + dy * len * 0.45;
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(mx - dy * wid, my + dx * wid, x + dx * len, y + dy * len);
  ctx.quadraticCurveTo(mx + dy * wid, my - dx * wid, x, y);
}


function radialSprite(stops: ReadonlyArray<readonly [number, string]>, size = SPRITE_SIZE): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const ctx = ctx2d(c);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

/** Glow sprite with a tight white-hot core; `rgb` is the species colour as "r,g,b". */
function fireflySprite(rgb: string): HTMLCanvasElement {
  return radialSprite([
    [0, "rgba(255,255,244,1)"],
    [0.05, "rgba(248,255,226,1)"],
    [0.1, `rgba(${rgb},0.76)`],
    [0.19, `rgba(${rgb},0.36)`],
    [0.32, `rgba(${rgb},0.13)`],
    [0.55, `rgba(${rgb},0.035)`],
    [1, `rgba(${rgb},0)`],
  ]);
}

interface TreePalette { limb: string; back: string; front: string; highlight: string; rim: string; rimAlpha: number; sheen: number }
const NEAR_PALETTE: TreePalette = { limb: "#010408", back: "#050e17", front: "#02070b", highlight: "120,160,190", rim: "#a9c8dc", rimAlpha: 0.62, sheen: 0.1 };
const MID_PALETTE: TreePalette = { limb: "#0a1824", back: "#142b3d", front: "#0c1c2a", highlight: "130,170,200", rim: "#a4c2d4", rimAlpha: 0.34, sheen: 0.12 };
const FAR_BANK = "#0a1a27";
const FAR_DISTANT = "#15324a";

/** Stable id of the static art; bump when painting changes so kept canvases repaint. */
const ART_VERSION = 3;
/** Layer canvases that already hold art for a given size (kept across theme toggles). */
const paintedKey = new WeakMap<HTMLCanvasElement, string>();
interface GeomCache { key: string; trees: TreeGeom[]; farProfile: Float32Array; lights: Light[] }
let geomCache: GeomCache | null = null;

/* ------------------------------------------------------------------ */
/* Scene                                                                */
/* ------------------------------------------------------------------ */

interface Glint { x: number; y: number; len: number; w: number; phase: number; speed: number; base: number }
interface Light { x: number; y: number }

export interface FireflySceneOptions {
  /** Elements whose text should not have fireflies flashing right behind it. */
  quietSelector?: string;
}

export interface FireflySceneHandle {
  destroy(): void;
}

const NEUTRAL_POINTER: PointerState = { x: 0, y: 0, nx: 0.5, ny: 0.5, active: false, down: false, justTapped: false, type: "mouse" };

export function mountFireflyScene(root: HTMLElement, options: FireflySceneOptions = {}): FireflySceneHandle | null {
  const pick = (name: string) => root.querySelector<HTMLCanvasElement>(`canvas[data-layer="${name}"]`);
  const skyCanvas = pick("sky");
  const farCanvas = pick("far");
  const riverCanvas = pick("river");
  const nearCanvas = pick("near");
  const fxCanvas = pick("fx");
  const reedCanvas = pick("reeds");
  if (!skyCanvas || !farCanvas || !riverCanvas || !nearCanvas || !fxCanvas || !reedCanvas) return null;
  const skyCtx = skyCanvas.getContext("2d", { alpha: false });
  const farCtx = farCanvas.getContext("2d");
  const riverCtx = riverCanvas.getContext("2d", { alpha: false });
  const nearCtx = nearCanvas.getContext("2d");
  const reedCtx = reedCanvas.getContext("2d");
  if (!skyCtx || !farCtx || !riverCtx || !nearCtx || !reedCtx) return null;

  const coarse = window.matchMedia("(pointer: coarse)").matches;

  const sprites = [fireflySprite("214,255,110"), fireflySprite("150,255,150"), fireflySprite("255,214,120")];
  const bokehSprite = radialSprite([[0, "rgba(225,255,170,0.3)"], [0.5, "rgba(205,255,140,0.24)"], [0.8, "rgba(180,240,120,0.1)"], [1, "rgba(160,230,110,0)"]]);
  const callSprite = radialSprite([[0, "rgba(255,255,250,1)"], [0.05, "rgba(245,255,225,1)"], [0.12, "rgba(215,255,150,0.55)"], [0.3, "rgba(160,235,120,0.14)"], [1, "rgba(90,200,120,0)"]]);
  const ringSprite = radialSprite([[0, "rgba(190,255,150,0)"], [0.55, "rgba(190,255,150,0)"], [0.78, "rgba(210,255,170,0.5)"], [0.9, "rgba(190,255,150,0.16)"], [1, "rgba(190,255,150,0)"]]);
  const warmSprite = radialSprite([[0, "rgba(255,226,170,1)"], [0.12, "rgba(255,190,110,0.55)"], [0.4, "rgba(255,150,70,0.12)"], [1, "rgba(255,120,60,0)"]]);
  const softSprite = radialSprite([[0, "rgba(255,255,255,1)"], [1, "rgba(255,255,255,0)"]]);
  // Swoop streak: head at the right edge, fading tail to the left.
  const STREAK_W = 64;
  const STREAK_H = 16;
  const streakSprite = makeCanvas(STREAK_W, STREAK_H);
  {
    const g = ctx2d(streakSprite);
    const lg = g.createLinearGradient(0, 0, STREAK_W, 0);
    lg.addColorStop(0, "rgba(200,255,120,0)");
    lg.addColorStop(0.7, "rgba(215,255,140,0.35)");
    lg.addColorStop(1, "rgba(240,255,200,0.9)");
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(0, STREAK_H / 2);
    g.quadraticCurveTo(STREAK_W * 0.6, STREAK_H * 0.2, STREAK_W, STREAK_H / 2);
    g.quadraticCurveTo(STREAK_W * 0.6, STREAK_H * 0.8, 0, STREAK_H / 2);
    g.fill();
  }

  const scratch: HTMLCanvasElement[] = [];
  const scratchCanvas = (i: number, w: number, h: number) => {
    let c = scratch[i];
    if (!c || c.width < w || c.height < h) {
      c = makeCanvas(Math.max(w, c?.width ?? 0), Math.max(h, c?.height ?? 0));
      scratch[i] = c;
    }
    const g = ctx2d(c);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.clearRect(0, 0, w, h);
    return c;
  };

  // Firefly state (struct of arrays; capacity is fixed so resizes never reallocate it).
  const field = createFlashField(MAX_FIREFLIES);
  const rand = createRng(SEED);
  const kind = new Uint8Array(MAX_FIREFLIES); // 0 far bank, 1 mid tree, 2 near tree, 3 drifter
  const bokeh = new Uint8Array(MAX_FIREFLIES);
  const tree = new Int16Array(MAX_FIREFLIES);
  const perch = new Int32Array(MAX_FIREFLIES);
  const homeX = new Float32Array(MAX_FIREFLIES);
  const homeY = new Float32Array(MAX_FIREFLIES);
  const homeEdge = new Float32Array(MAX_FIREFLIES);
  const posX = new Float32Array(MAX_FIREFLIES);
  const surf = new Float32Array(MAX_FIREFLIES);
  const size = new Float32Array(MAX_FIREFLIES);
  const bright = new Float32Array(MAX_FIREFLIES);
  const floorGlow = new Float32Array(MAX_FIREFLIES);
  const still = new Float32Array(MAX_FIREFLIES);
  const stillRoll = new Float32Array(MAX_FIREFLIES);
  const wanderA = new Float32Array(MAX_FIREFLIES);
  const wanderF1 = new Float32Array(MAX_FIREFLIES);
  const wanderF2 = new Float32Array(MAX_FIREFLIES);
  const wanderP1 = new Float32Array(MAX_FIREFLIES);
  const wanderP2 = new Float32Array(MAX_FIREFLIES);
  const swoopH = new Float32Array(MAX_FIREFLIES);
  const swoopW = new Float32Array(MAX_FIREFLIES);
  const fromX = new Float32Array(MAX_FIREFLIES);
  const fromY = new Float32Array(MAX_FIREFLIES);
  const flyStart = new Float32Array(MAX_FIREFLIES);
  const flyEnd = new Float32Array(MAX_FIREFLIES);
  const attractX = new Float32Array(MAX_FIREFLIES);
  const attractY = new Float32Array(MAX_FIREFLIES);
  const attractStart = new Float32Array(MAX_FIREFLIES);
  const attractArrive = new Float32Array(MAX_FIREFLIES);
  const attractEnd = new Float32Array(MAX_FIREFLIES);
  const attractAmt = new Float32Array(MAX_FIREFLIES);
  const driftH = new Float32Array(MAX_FIREFLIES);
  const driftSeed = new Float32Array(MAX_FIREFLIES);
  const kindRoll = new Float32Array(MAX_FIREFLIES);
  const sizeRoll = new Float32Array(MAX_FIREFLIES);
  // Per-frame draw results, reused by the reflection pass.
  const drawn = new Uint8Array(MAX_FIREFLIES);
  const drawX = new Float32Array(MAX_FIREFLIES);
  const drawMirrorY = new Float32Array(MAX_FIREFLIES);
  const drawR = new Float32Array(MAX_FIREFLIES);
  const drawA = new Float32Array(MAX_FIREFLIES);
  for (let i = 0; i < MAX_FIREFLIES; i++) {
    seedFirefly(field, i, rand);
    kindRoll[i] = rand();
    sizeRoll[i] = rand();
    stillRoll[i] = rand();
    perch[i] = Math.floor(rand() * 1e9);
    wanderF1[i] = 0.15 + rand() * 0.35;
    wanderF2[i] = 0.12 + rand() * 0.3;
    wanderP1[i] = rand() * TAU;
    wanderP2[i] = rand() * TAU;
    swoopW[i] = rand() < 0.5 ? -1 : 1;
    driftSeed[i] = rand() * 100;
    flyEnd[i] = -1;
    attractEnd[i] = -1;
  }

  const noise = createNoise2D(SEED + 5);

  let layout: SceneLayout | null = null;
  let trees: TreeGeom[] = [];
  let farProfile: Float32Array = new Float32Array(0);
  let lights: Light[] = [];
  let glints: Glint[] = [];
  let riverSrc: HTMLCanvasElement | null = null;
  let riverTint: HTMLCanvasElement | null = null;
  let riverScale = 1;
  let staticDpr = 1;
  let skyDpr = 1;
  let reedDpr = 1;
  let fxScale = 1;
  let wanderScale = 1;
  let driftMinY = 0;
  let driftMaxY = 0;
  let frameNo = 0;

  // Reeds (struct of arrays sized per layout).
  let reedCount = 0;
  let reedX = new Float32Array(0);
  let reedH = new Float32Array(0);
  let reedW = new Float32Array(0);
  let reedLean = new Float32Array(0);
  let reedStiff = new Float32Array(0);
  let reedPhase = new Float32Array(0);
  let reedFreq = new Float32Array(0);
  let reedGroup = new Uint8Array(0);

  // Wind: one gust front travelling left to right at a time.
  let gustX = Infinity;
  let gustSpeed = 0;
  let gustWidth = 1;
  let gustStrength = 0;
  let nextGustAt = 3;
  let windLevel = 0;

  // Parallax: smoothed pointer offset in -0.5..0.5, quantised for the CSS layers.
  let parX = 0;
  let parY = 0;
  let lastTransformX = Number.NaN;
  let lastTransformY = Number.NaN;
  // Layer offsets in CSS px by firefly kind (far bank and mid trees share the far layer).
  const offX = new Float32Array(4);
  const offY = new Float32Array(4);
  let farOffX = 0;
  let farOffY = 0;

  // Calls (tap/click) and their answering fireflies.
  const CALLS = 4;
  const callX = new Float32Array(CALLS);
  const callY = new Float32Array(CALLS);
  const callT = new Float32Array(CALLS).fill(-100);
  let callCursor = 0;
  let sceneT = 0;
  let waveInitialised = false;
  let coupledMinX = 0;
  let coupledMaxX = 0;

  // Text boxes (scene coordinates) where fireflies are dimmed.
  const QUIET_MAX = 6;
  const quiet = new Float32Array(QUIET_MAX * 4);
  let quietCount = 0;
  let quietDirty = true;
  let quietCheckedAt = -Infinity;
  const markQuiet = () => {
    quietDirty = true;
  };
  window.addEventListener("scroll", markQuiet, { passive: true });

  /* ---------------- static painting ---------------- */

  function paintSky(L: SceneLayout): void {
    const { width: W, height: H, waterY } = L;
    const ctx = skyCtx!;
    ctx.setTransform(skyDpr, 0, 0, skyDpr, MARGIN * skyDpr, MARGIN * skyDpr);
    const g = ctx.createLinearGradient(0, -MARGIN, 0, waterY);
    g.addColorStop(0, "#03061a");
    g.addColorStop(0.32, "#071032");
    g.addColorStop(0.68, "#0b2340");
    g.addColorStop(0.93, "#10394b");
    g.addColorStop(1, "#154650");
    ctx.fillStyle = g;
    ctx.fillRect(-MARGIN, -MARGIN, W + MARGIN * 2, waterY + MARGIN);
    ctx.fillStyle = "#07131d";
    ctx.fillRect(-MARGIN, waterY, W + MARGIN * 2, H - waterY + MARGIN);

    // Faint nebulous band and airglow, computed at low resolution.
    const step = 8;
    const tw = Math.ceil((W + MARGIN * 2) / step);
    const th = Math.ceil((waterY + MARGIN) / step);
    const tex = makeCanvas(tw, th);
    const tctx = ctx2d(tex);
    const img = tctx.createImageData(tw, th);
    const band = createNoise2D(SEED + 9);
    const bx0 = -W * 0.1;
    const by0 = -H * 0.05;
    const bdx = W * 1.1;
    const bdy = waterY * 0.9;
    const bl = Math.hypot(bdx, bdy);
    for (let j = 0; j < th; j++) {
      for (let i = 0; i < tw; i++) {
        const x = i * step - MARGIN;
        const y = j * step - MARGIN;
        const d = Math.abs(((x - bx0) * bdy - (y - by0) * bdx) / bl) / (Math.min(W, H) * 0.22);
        const n = fbm2D(band, x * 0.004, y * 0.004, 3);
        const milky = Math.max(0, 1 - d * d) * clamp(0.45 + n * 0.9, 0, 1) * 0.22;
        const glow = Math.exp(-Math.pow((y - (waterY - H * 0.13)) / (H * 0.09), 2)) * (0.13 + 0.07 * n);
        const k = (j * tw + i) * 4;
        img.data[k] = 110 + 40 * glow;
        img.data[k + 1] = 140 + 70 * glow;
        img.data[k + 2] = 190 - 20 * glow;
        img.data[k + 3] = clamp((milky + glow) * 255, 0, 255);
      }
    }
    tctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(tex, -MARGIN, -MARGIN, tw * step, th * step);

    // Moonlit sky brightening.
    const mg = ctx.createRadialGradient(L.moonX, L.moonY, 0, L.moonX, L.moonY, L.moonR * 16);
    mg.addColorStop(0, "rgba(120,160,205,0.2)");
    mg.addColorStop(0.35, "rgba(90,130,180,0.07)");
    mg.addColorStop(1, "rgba(60,100,150,0)");
    ctx.fillStyle = mg;
    ctx.fillRect(-MARGIN, -MARGIN, W + MARGIN * 2, waterY + MARGIN);

    // Stars: dense, faint, varied temperatures; thinned toward the horizon and the moon.
    const srng = createRng(SEED + 1);
    const temps = ["#a9c3ff", "#cddcff", "#f4f6ff", "#fff3dc", "#ffd7a6"];
    const count = Math.round(((W + MARGIN * 2) * (waterY + MARGIN)) / 700);
    for (let n = 0; n < count; n++) {
      const x = srng() * (W + MARGIN * 2) - MARGIN;
      const yr = srng();
      const y = -MARGIN + Math.pow(yr, 1.25) * (waterY + MARGIN);
      const horizon = 1 - smooth(waterY - H * 0.28, waterY - H * 0.02, y);
      const md = Math.hypot(x - L.moonX, y - L.moonY) / (L.moonR * 9);
      const moonFade = clamp(md, 0.08, 1);
      const b = Math.pow(srng(), 3.2);
      const alpha = (0.14 + 0.86 * b) * horizon * moonFade;
      const tr = srng();
      if (alpha < 0.03) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = temps[tr < 0.12 ? 0 : tr < 0.35 ? 1 : tr < 0.72 ? 2 : tr < 0.92 ? 3 : 4];
      const sz = 0.5 + b * 1.1;
      ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      if (b > 0.8) {
        ctx.globalAlpha = alpha * 0.3;
        const gr = 2 + b * 3.5;
        ctx.drawImage(softSprite, x - gr, y - gr, gr * 2, gr * 2);
      }
    }
    ctx.globalAlpha = 1;

    // Moon: halo ring, glow, limb-darkened disc with faint maria.
    const R = L.moonR;
    const ring = ctx.createRadialGradient(L.moonX, L.moonY, R * 2.6, L.moonX, L.moonY, R * 4.4);
    ring.addColorStop(0, "rgba(170,200,230,0)");
    ring.addColorStop(0.45, "rgba(175,205,235,0.055)");
    ring.addColorStop(0.62, "rgba(190,215,240,0.03)");
    ring.addColorStop(1, "rgba(170,200,230,0)");
    ctx.fillStyle = ring;
    ctx.fillRect(L.moonX - R * 5, L.moonY - R * 5, R * 10, R * 10);
    const glow = ctx.createRadialGradient(L.moonX, L.moonY, R * 0.9, L.moonX, L.moonY, R * 3.2);
    glow.addColorStop(0, "rgba(215,230,245,0.38)");
    glow.addColorStop(0.3, "rgba(170,200,230,0.12)");
    glow.addColorStop(1, "rgba(140,175,215,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(L.moonX - R * 3.5, L.moonY - R * 3.5, R * 7, R * 7);
    const disc = ctx.createRadialGradient(L.moonX - R * 0.25, L.moonY - R * 0.25, R * 0.1, L.moonX, L.moonY, R);
    disc.addColorStop(0, "#f4f8fc");
    disc.addColorStop(0.7, "#dde7f1");
    disc.addColorStop(1, "#b8c8d9");
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(L.moonX, L.moonY, R, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.clip();
    const mrng = createRng(SEED + 3);
    ctx.fillStyle = "#8e9fb5";
    for (let n = 0; n < 7; n++) {
      const a = mrng() * TAU;
      const d = mrng() * R * 0.6;
      const r = R * (0.18 + mrng() * 0.25);
      ctx.globalAlpha = 0.1 + mrng() * 0.08;
      ctx.beginPath();
      ctx.arc(L.moonX + Math.cos(a) * d, L.moonY + Math.sin(a) * d, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** Leaf tuft: leaves fan out from the pad centre and sag under gravity; noise opens lace gaps toward the outline. */
  function padLeaves(g: CanvasRenderingContext2D, p: Pad, gap: (x: number, y: number) => number, gapFreq: number, coverage: number): void {
    const rng = createRng(p.seed);
    const area = Math.PI * p.rx * p.ry;
    const count = Math.min(720, Math.ceil((p.density * coverage * area) / (p.leaf * p.leaf * 0.17)));
    const thr = 0.88 - 0.8 * p.shell;
    const droop = 0.42 + 0.2 * p.shell;
    const nx = (p.seed % 977) * 0.13;
    for (let k = 0; k < count; k++) {
      const a = rng() * TAU;
      const u = Math.pow(rng(), 0.6);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const edge = 1 + 0.2 * gap(ca * 1.3 + nx, sa * 1.3);
      const x = p.x + ca * p.rx * u * edge;
      const y = p.y + sa * p.ry * u * edge;
      if (gap(x * gapFreq, y * gapFreq) > thr) continue;
      const ang = Math.atan2(sa * (1 - droop) * 0.8 + droop, ca * (1 - droop)) + (rng() - 0.5) * 1.15;
      const len = p.leaf * (0.75 + rng() * 0.6) * (0.9 + 0.35 * u);
      leafPath(g, x, y, ang, len, len * 0.3);
    }
  }

  function finishSteps(steps: Generator<void, void, void>): void {
    while (!steps.next().done);
  }

  /** Paints one tree in steps; each yield is a safe place to hand control back to the browser. */
  function* paintTree(target: CanvasRenderingContext2D, geom: TreeGeom, pal: TreePalette, L: SceneLayout): Generator<void, void, void> {
    const dpr = staticDpr;
    const s = L.scale;
    const spec = geom.spec;
    const box = geom.box;
    const bw = Math.ceil(box.w * dpr);
    const bh = Math.ceil(box.h * dpr);
    const Tc = scratchCanvas(0, bw, bh);
    const Fc = scratchCanvas(1, bw, bh);
    const Rc = scratchCanvas(2, bw, bh);
    const T = ctx2d(Tc);
    const F = ctx2d(Fc);
    const R = ctx2d(Rc);
    const gapNoise = createNoise2D(spec.seed + 101);
    const crownSize = Math.min((spec.x1 - spec.x0) / 2, (spec.bottom - spec.top) * 0.8);
    const gapFreq = 1 / Math.max(18, crownSize * 0.11);
    const toBox = (g: CanvasRenderingContext2D) => g.setTransform(dpr, 0, 0, dpr, -box.x * dpr, -box.y * dpr);
    const tint = (g: CanvasRenderingContext2D, color: string) => {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = color;
      g.fillRect(0, 0, bw, bh);
      g.globalCompositeOperation = "source-over";
    };

    // 1. Back plane: interior leaf mass, a lighter value behind the limbs.
    T.fillStyle = "#fff";
    toBox(T);
    T.beginPath();
    for (const p of geom.pads) if (!p.front) padLeaves(T, p, gapNoise, gapFreq, 0.95);
    T.fill();
    tint(T, pal.back);
    toBox(T);
    T.globalCompositeOperation = "source-atop";
    const reach = Math.max(spec.x1 - spec.x0, spec.bottom - spec.top) * 0.6;
    const hx = geom.cx + geom.lightX * reach * 0.6;
    const hy = geom.bellyY + geom.lightY * reach * 0.6;
    const vg = T.createRadialGradient(hx, hy, 0, hx, hy, reach * 1.1);
    vg.addColorStop(0, `rgba(${pal.highlight},${pal.sheen})`);
    vg.addColorStop(1, `rgba(${pal.highlight},0)`);
    T.fillStyle = vg;
    T.fillRect(box.x, box.y, box.w, box.h);
    T.globalCompositeOperation = "source-over";
    yield;

    // 2. Trunk, roots and limbs, darkest.
    toBox(T);
    T.fillStyle = pal.limb;
    T.beginPath();
    branchPath(T, geom.trunk.pts);
    for (const r of geom.roots) branchPath(T, r.pts);
    for (const b of geom.branches) branchPath(T, b.pts);
    for (let n = 0; n < geom.spikes.length; n += 4) {
      const x = geom.spikes[n];
      const y = geom.spikes[n + 1];
      const h = geom.spikes[n + 2];
      const w = geom.spikes[n + 3];
      T.moveTo(x - w, y);
      T.lineTo(x + w * 0.15, y - h);
      T.lineTo(x + w, y);
      T.closePath();
    }
    T.fill();

    // Faint moonlit edge along the trunk and limbs: the mask minus a copy moved away from the moon.
    toBox(F);
    F.fillStyle = "#fff";
    F.beginPath();
    branchPath(F, geom.trunk.pts);
    for (const b of geom.branches) if (b.pts[2] > 2.5) branchPath(F, b.pts);
    F.fill();
    R.setTransform(1, 0, 0, 1, 0, 0);
    R.globalCompositeOperation = "source-over";
    R.clearRect(0, 0, bw, bh);
    R.drawImage(Fc, 0, 0, bw, bh, 0, 0, bw, bh);
    const limbShift = 1.6 * dpr * Math.max(0.75, s);
    R.globalCompositeOperation = "destination-out";
    R.drawImage(Fc, 0, 0, bw, bh, -geom.lightX * limbShift, -geom.lightY * limbShift, bw, bh);
    R.globalCompositeOperation = "source-in";
    R.fillStyle = pal.rim;
    R.fillRect(0, 0, bw, bh);
    R.globalCompositeOperation = "source-over";
    T.setTransform(1, 0, 0, 1, 0, 0);
    T.globalAlpha = pal.rimAlpha * 0.4;
    T.drawImage(Rc, 0, 0, bw, bh, 0, 0, bw, bh);
    T.globalAlpha = 1;
    F.setTransform(1, 0, 0, 1, 0, 0);
    F.clearRect(0, 0, bw, bh);
    yield;

    // 3. Front leaf mass with lace gaps, then tint and moonlit rims.
    F.fillStyle = "#fff";
    toBox(F);
    F.beginPath();
    for (const p of geom.pads) if (p.front) padLeaves(F, p, gapNoise, gapFreq, 1.45);
    F.fill();
    tint(F, pal.front);
    yield;

    const rimPass = (shift: number, alpha: number) => {
      R.setTransform(1, 0, 0, 1, 0, 0);
      R.globalCompositeOperation = "source-over";
      R.clearRect(0, 0, bw, bh);
      R.drawImage(Fc, 0, 0, bw, bh, 0, 0, bw, bh);
      R.globalCompositeOperation = "destination-out";
      R.drawImage(Fc, 0, 0, bw, bh, -geom.lightX * shift, -geom.lightY * shift, bw, bh);
      // Strongest on the moon side, fading across the crown and below its widest line.
      const mx = (geom.cx - box.x) * dpr;
      const my = (geom.bellyY - box.y) * dpr;
      const span = reach * dpr;
      R.globalCompositeOperation = "source-in";
      const lg = R.createLinearGradient(mx - geom.lightX * span, my - geom.lightY * span, mx + geom.lightX * span, my + geom.lightY * span);
      lg.addColorStop(0, "rgba(0,0,0,0)");
      lg.addColorStop(0.45, `${pal.rim}00`);
      lg.addColorStop(1, pal.rim);
      R.fillStyle = lg;
      R.fillRect(0, 0, bw, bh);
      R.globalCompositeOperation = "destination-in";
      const top = (spec.top - box.y) * dpr;
      const vg2 = R.createLinearGradient(0, top, 0, my + (spec.bottom - geom.bellyY) * dpr * 0.5);
      vg2.addColorStop(0, "rgba(0,0,0,1)");
      vg2.addColorStop(0.7, "rgba(0,0,0,0.45)");
      vg2.addColorStop(1, "rgba(0,0,0,0)");
      R.fillStyle = vg2;
      R.fillRect(0, 0, bw, bh);
      F.setTransform(1, 0, 0, 1, 0, 0);
      F.globalCompositeOperation = "source-atop";
      F.globalAlpha = alpha;
      F.drawImage(Rc, 0, 0, bw, bh, 0, 0, bw, bh);
      F.globalAlpha = 1;
      F.globalCompositeOperation = "source-over";
    };
    const rimD = 1.3 * dpr * Math.max(0.75, s);
    rimPass(rimD * 5, pal.rimAlpha * 0.2);
    yield;
    rimPass(rimD, pal.rimAlpha);
    yield;

    T.setTransform(1, 0, 0, 1, 0, 0);
    T.drawImage(Fc, 0, 0, bw, bh, 0, 0, bw, bh);

    // 4. Weeping twigs: arching, leafy, outside the rim pass so they do not glint like chains.
    toBox(T);
    T.fillStyle = pal.front;
    T.strokeStyle = pal.front;
    T.lineWidth = Math.max(0.8, 1.1 * s);
    T.lineCap = "round";
    T.beginPath();
    for (const st of geom.strands) {
      T.moveTo(st.x0, st.y0);
      T.quadraticCurveTo(st.cx, st.cy, st.x1, st.y1);
    }
    T.stroke();
    T.beginPath();
    for (const st of geom.strands) {
      const rng = createRng(st.seed);
      const steps = Math.max(4, Math.ceil(Math.hypot(st.x1 - st.x0, st.y1 - st.y0) / (st.leaf * 0.62)));
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        const mt = 1 - t;
        const x = mt * mt * st.x0 + 2 * mt * t * st.cx + t * t * st.x1;
        const y = mt * mt * st.y0 + 2 * mt * t * st.cy + t * t * st.y1;
        const tx = 2 * mt * (st.cx - st.x0) + 2 * t * (st.x1 - st.cx);
        const ty = 2 * mt * (st.cy - st.y0) + 2 * t * (st.y1 - st.cy);
        const along = Math.atan2(ty, tx);
        const len = st.leaf * (1.25 - 0.55 * t) * (0.8 + rng() * 0.4);
        const side = k % 2 === 0 ? 1 : -1;
        leafPath(T, x, y, along + side * (0.75 + rng() * 0.5), len, len * 0.3);
      }
      leafPath(T, st.x1, st.y1, Math.PI / 2 + (rng() - 0.5) * 0.6, st.leaf * 0.9, st.leaf * 0.27);
    }
    T.fill();

    target.setTransform(1, 0, 0, 1, 0, 0);
    const dx = Math.round((box.x + MARGIN) * dpr);
    const dy = Math.round((box.y + MARGIN) * dpr);
    if (spec.near) {
      // Dim mirror of the trunk foot in the water just below it.
      const foot = (spec.baseY + MARGIN) * dpr;
      target.save();
      target.beginPath();
      target.rect(0, foot, target.canvas.width, L.height * 0.1 * dpr);
      target.clip();
      target.globalAlpha = 0.3;
      target.setTransform(1, 0, 0, -1, 0, 2 * foot);
      target.drawImage(Tc, 0, 0, bw, bh, dx, dy, bw, bh);
      target.restore();
    }
    target.drawImage(Tc, 0, 0, bw, bh, dx, dy, bw, bh);
  }

  /** Coconut palm: slender leaning trunk with drooping feathered fronds. */
  function palm(g: CanvasRenderingContext2D, x: number, y: number, h: number, lean: number, s: number, rng: () => number): void {
    const tx = x + lean * h;
    const ty = y - h;
    g.beginPath();
    taperedCurve(g, { x0: x, y0: y, cx: x + lean * h * 0.1, cy: y - h * 0.55, x1: tx, y1: ty, w0: 2.6 * s, w1: 1.5 * s });
    g.fill();
    const n = 9 + Math.floor(rng() * 4);
    g.beginPath();
    const leaflets: number[] = [];
    for (let k = 0; k < n; k++) {
      const ang = -Math.PI / 2 + ((k + rng() * 0.6) / n - 0.5) * Math.PI * 1.7;
      const len = h * (0.24 + rng() * 0.12);
      const ex = tx + Math.cos(ang) * len;
      const ey = ty + Math.sin(ang) * len * 0.55 + len * 0.45 * (1 - Math.abs(Math.sin(ang)) * 0.6);
      const mx = tx + Math.cos(ang) * len * 0.55;
      const my = ty + Math.sin(ang) * len * 0.6 - len * 0.12;
      const w = len * 0.07;
      g.moveTo(tx, ty);
      g.quadraticCurveTo(mx, my - w, ex, ey);
      g.quadraticCurveTo(mx, my + w, tx, ty);
      for (let f = 0.25; f < 0.95; f += 0.14) {
        const mt = 1 - f;
        const px = mt * mt * tx + 2 * mt * f * mx + f * f * ex;
        const py = mt * mt * ty + 2 * mt * f * my + f * f * ey;
        leaflets.push(px, py, px + Math.cos(ang) * len * 0.05, py + len * 0.14 * (1 - f * 0.4));
      }
    }
    g.fill();
    g.lineWidth = Math.max(0.6, 0.7 * s);
    g.beginPath();
    for (let k = 0; k < leaflets.length; k += 4) {
      g.moveTo(leaflets[k], leaflets[k + 1]);
      g.lineTo(leaflets[k + 2], leaflets[k + 3]);
    }
    g.stroke();
  }

  /** Nipa palm clump: stemless fronds rising from the waterline. */
  function nipa(g: CanvasRenderingContext2D, x: number, y: number, h: number, s: number, rng: () => number): void {
    const n = 5 + Math.floor(rng() * 4);
    g.beginPath();
    for (let k = 0; k < n; k++) {
      const ang = -Math.PI / 2 + ((k + rng() * 0.5) / n - 0.5) * 1.9;
      const len = h * (0.65 + rng() * 0.45);
      const bx = x + (rng() - 0.5) * 4 * s;
      const ex = bx + Math.cos(ang) * len * 1.05;
      const ey = y + Math.sin(ang) * len * 0.8 + len * 0.25;
      const mx = bx + Math.cos(ang) * len * 0.5;
      const my = y + Math.sin(ang) * len * 0.75;
      const w = Math.max(0.8, len * 0.08);
      g.moveTo(bx - w * 0.5, y);
      g.quadraticCurveTo(mx - w, my, ex, ey);
      g.quadraticCurveTo(mx + w, my + w * 0.6, bx + w * 0.5, y);
    }
    g.fill();
  }

  function paintFar(L: SceneLayout): void {
    const { width: W, waterY } = L;
    const s = L.scale;
    const ctx = farCtx!;
    const dpr = staticDpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, farCanvas!.width, farCanvas!.height);
    const base = () => ctx.setTransform(dpr, 0, 0, dpr, MARGIN * dpr, MARGIN * dpr);
    base();
    const frng = createRng(SEED + 17);
    const fn = createNoise2D(SEED + 19);
    const x0 = -MARGIN;
    const x1 = W + MARGIN;
    const STEP = 3;
    const samples = Math.ceil((x1 - x0) / STEP) + 1;
    farProfile = new Float32Array(samples);
    const FH = L.farHeight;

    // Distant treeline: crowns of uneven width and height, open stretches, a few palms.
    const crowns: number[] = [];
    for (let x = x0 - 60; x < x1 + 60; ) {
      if (frng() < 0.12) {
        x += (20 + frng() * 60) * s;
        continue;
      }
      const hw = (6 + Math.pow(frng(), 1.8) * 38) * s;
      const tall = frng() < 0.1 ? 1.6 : 1;
      crowns.push(x, hw, FH * (0.35 + frng() * 0.55) * tall * (0.7 + hw / (44 * s) * 0.5));
      x += hw * (0.7 + frng() * 1.1);
    }
    ctx.fillStyle = FAR_DISTANT;
    ctx.beginPath();
    ctx.moveTo(x0, waterY + 1);
    for (let k = 0; k < samples; k++) {
      const x = x0 + k * STEP;
      let h = FH * (0.22 + 0.12 * fn(x * 0.004, 7));
      for (let c = 0; c < crowns.length; c += 3) {
        const q = (x - crowns[c]) / crowns[c + 1];
        if (q > -1 && q < 1) h = Math.max(h, crowns[c + 2] * Math.pow(1 - q * q, 0.5));
      }
      h += 1.6 * s * fn(x * 0.21, 3) + 0.9 * s * fn(x * 0.7, 9);
      ctx.lineTo(x, waterY - h);
    }
    ctx.lineTo(x1, waterY + 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = FAR_DISTANT;
    const distantPalms = Math.round(W / 170);
    for (let n = 0; n < distantPalms; n++) {
      const x = x0 + frng() * (x1 - x0);
      palm(ctx, x, waterY - FH * 0.3, (26 + frng() * 22) * s, (frng() - 0.5) * 0.25, s * 0.75, frng);
    }
    const haze = ctx.createLinearGradient(0, waterY - FH * 2.2, 0, waterY);
    haze.addColorStop(0, "rgba(40,90,110,0)");
    haze.addColorStop(1, "rgba(50,100,120,0.22)");
    ctx.fillStyle = haze;
    ctx.fillRect(x0, waterY - FH * 2.2, x1 - x0, FH * 2.2);

    // Near bank: a low earth line, bushy trees made of leaves, nipa clumps and palms.
    const bankH = new Float32Array(samples);
    for (let k = 0; k < samples; k++) {
      const x = x0 + k * STEP;
      bankH[k] = Math.max(1.5 * s, FH * (0.1 + 0.08 * fn(x * 0.006, 21)) + 0.8 * s * fn(x * 0.3, 23));
    }
    const bump = (cx: number, hw: number, top: number) => {
      const k0 = Math.max(0, Math.floor((cx - hw - x0) / STEP));
      const k1 = Math.min(samples - 1, Math.ceil((cx + hw - x0) / STEP));
      for (let k = k0; k <= k1; k++) {
        const q = (x0 + k * STEP - cx) / hw;
        if (q > -1 && q < 1) farProfile[k] = Math.max(farProfile[k], top * Math.sqrt(1 - q * q));
      }
    };
    ctx.fillStyle = FAR_BANK;
    ctx.beginPath();
    ctx.moveTo(x0, waterY + 1);
    for (let k = 0; k < samples; k++) {
      farProfile[k] = bankH[k];
      ctx.lineTo(x0 + k * STEP, waterY - bankH[k]);
    }
    ctx.lineTo(x1, waterY + 1);
    ctx.closePath();
    ctx.fill();

    // Bankside shrubs: wide, low leaf masses that hug the waterline, a few on a short stem.
    const bushes = Math.round(W / 70);
    for (let n = 0; n < bushes; n++) {
      const x = x0 + ((n + frng()) / bushes) * (x1 - x0);
      const rw = (7 + frng() * 14) * s * (frng() < 0.15 ? 1.6 : 1);
      const rh = rw * (0.5 + frng() * 0.35);
      const stem = frng() < 0.35 ? rh * 0.5 : 0;
      const cy = waterY - stem - rh * 0.55;
      const leaf = clamp(rw * 0.34, 2.4 * s, 6 * s);
      ctx.beginPath();
      if (stem > 0) ctx.rect(x - 0.8 * s, cy, 1.6 * s, waterY - cy);
      const count = Math.ceil((Math.PI * rw * rh * 1.6) / (leaf * leaf * 0.17));
      for (let k = 0; k < count; k++) {
        const a = frng() * TAU;
        const d = Math.sqrt(frng());
        const px = x + Math.cos(a) * rw * d;
        const py = Math.min(waterY + 0.5, cy + Math.sin(a) * rh * d);
        const len = leaf * (0.75 + frng() * 0.6);
        leafPath(ctx, px, py, Math.atan2(Math.sin(a) * 0.5 + 0.5, Math.cos(a)) + (frng() - 0.5) * 1.3, len, len * 0.3);
      }
      ctx.fill();
      bump(x, rw * 1.05, waterY - cy + rh * 0.85);
    }
    const nipas = Math.round(W / 45);
    for (let n = 0; n < nipas; n++) {
      const x = x0 + frng() * (x1 - x0);
      const h = (7 + frng() * 10) * s;
      nipa(ctx, x, waterY + 0.5, h, s, frng);
      bump(x, h * 0.9, h * 0.8);
    }
    ctx.strokeStyle = FAR_BANK;
    const palms = Math.max(3, Math.round(W / 190));
    for (let n = 0; n < palms; n++) {
      // Palms come in loose pairs and trios.
      const x = x0 + frng() * (x1 - x0);
      const group = 1 + Math.floor(frng() * 3);
      for (let g = 0; g < group; g++) {
        palm(ctx, x + (g - 1) * (5 + frng() * 7) * s, waterY - bankH[0] * 0.5, (34 + frng() * 36) * s, (frng() - 0.5) * 0.45, s, frng);
      }
    }

    // Stilt houses in two loose groups, a jetty with a lamp and a moored long-tail boat.
    lights = [];
    const hrng = createRng(SEED + 23);
    const groups = [W * (0.3 + hrng() * 0.06), W * (0.55 + hrng() * 0.08)];
    const houseAt: number[] = [];
    for (let n = 0; n < L.houses; n++) {
      const g = groups[n % 2];
      houseAt.push(g + (Math.floor(n / 2) - 0.3) * (34 + hrng() * 20) * s * (n % 2 ? 1 : -1));
    }
    if (L.houses >= 5) houseAt[L.houses - 1] = W * (0.86 + hrng() * 0.04);
    for (const x of houseAt) {
      const w = (15 + hrng() * 12) * s;
      const h = (7 + hrng() * 5) * s;
      const stilt = (4 + hrng() * 4) * s;
      const floor = waterY - stilt;
      const apex = (7 + hrng() * 5) * s;
      const eave = 4 * s;
      ctx.fillStyle = "#081723";
      ctx.fillRect(x - w / 2, floor - h, w, h);
      ctx.beginPath();
      ctx.moveTo(x - w / 2 - eave, floor - h + 1.2 * s);
      ctx.quadraticCurveTo(x - w * 0.22, floor - h - apex * 0.3, x, floor - h - apex);
      ctx.quadraticCurveTo(x + w * 0.22, floor - h - apex * 0.3, x + w / 2 + eave, floor - h + 1.2 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x - w / 2 - 2 * s, floor - 1, w + 4 * s, 1.5 * s);
      ctx.strokeStyle = "#081723";
      ctx.lineWidth = Math.max(0.7, s);
      ctx.beginPath();
      for (let p = 0; p <= 3; p++) {
        const px = x - w / 2 + (w * p) / 3;
        ctx.moveTo(px, floor);
        ctx.lineTo(px, waterY + 1);
      }
      ctx.stroke();
      if (hrng() < 0.8) {
        const windows = 1 + Math.floor(hrng() * 2);
        for (let k = 0; k < windows; k++) {
          const wx = x - w / 2 + ((k + 0.5) / windows) * w;
          const wy = floor - h * 0.55;
          lights.push({ x: wx, y: wy });
          ctx.fillStyle = "#ffc37a";
          ctx.fillRect(wx - 1.3 * s, wy - 1.8 * s, 2.6 * s, 3.4 * s);
          ctx.globalAlpha = 0.45;
          const gr = 11 * s;
          ctx.drawImage(warmSprite, wx - gr, wy - gr, gr * 2, gr * 2);
          ctx.globalAlpha = 1;
        }
      }
    }
    {
      const jx = groups[0] + (20 + hrng() * 10) * s;
      const jl = (46 + hrng() * 30) * s;
      const deckY = waterY - 2.6 * s;
      ctx.fillStyle = "#081723";
      ctx.fillRect(jx, deckY, jl, 1.4 * s);
      ctx.beginPath();
      for (let px = jx + 2 * s; px < jx + jl; px += 7 * s) ctx.rect(px, deckY, 0.9 * s, waterY - deckY + 1.5 * s);
      ctx.rect(jx + jl - 1.5 * s, deckY - 10 * s, 0.8 * s, 10 * s);
      ctx.fill();
      const lx = jx + jl - 1.1 * s;
      const ly = deckY - 10.5 * s;
      lights.push({ x: lx, y: ly });
      ctx.fillStyle = "#ffd48f";
      ctx.fillRect(lx - 1.1 * s, ly - 1.1 * s, 2.2 * s, 2.2 * s);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(warmSprite, lx - 13 * s, ly - 13 * s, 26 * s, 26 * s);
      ctx.globalAlpha = 1;
      // Long-tail boat moored beside the jetty.
      const bx = jx + jl * 0.55;
      const bl = (30 + hrng() * 8) * s;
      const bh = 2.4 * s;
      const by = waterY + 0.8 * s;
      ctx.fillStyle = "#07141f";
      ctx.beginPath();
      ctx.moveTo(bx - bl / 2, by - bh);
      ctx.lineTo(bx + bl * 0.36, by - bh);
      ctx.quadraticCurveTo(bx + bl * 0.5, by - bh * 1.3, bx + bl * 0.56, by - bh * 2.6);
      ctx.quadraticCurveTo(bx + bl * 0.5, by - bh * 0.2, bx + bl * 0.3, by);
      ctx.quadraticCurveTo(bx - bl * 0.1, by + bh * 0.35, bx - bl / 2, by - bh * 0.3);
      ctx.closePath();
      ctx.moveTo(bx - bl * 0.22, by - bh);
      ctx.quadraticCurveTo(bx - bl * 0.08, by - bh - 4.5 * s, bx + bl * 0.08, by - bh);
      ctx.lineTo(bx + bl * 0.05, by - bh);
      ctx.quadraticCurveTo(bx - bl * 0.08, by - bh - 3.2 * s, bx - bl * 0.19, by - bh);
      ctx.closePath();
      ctx.fill();
    }

    // Low mist over the far water.
    const mist = ctx.createLinearGradient(0, waterY - FH * 1.4, 0, waterY + 2);
    mist.addColorStop(0, "rgba(120,170,185,0)");
    mist.addColorStop(0.7, "rgba(120,170,185,0.08)");
    mist.addColorStop(1, "rgba(140,185,200,0.13)");
    ctx.fillStyle = mist;
    ctx.fillRect(x0, waterY - FH * 1.4, x1 - x0, FH * 1.4 + 2);

    for (const geom of trees) {
      if (!geom.spec.near) finishSteps(paintTree(ctx, geom, MID_PALETTE, L));
    }
  }

  function clearNear(): void {
    const ctx = nearCtx!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, nearCanvas!.width, nearCanvas!.height);
  }

  function buildRiver(L: SceneLayout): void {
    const { width: W, height: H, waterY } = L;
    const hR = H - waterY;
    riverScale = Math.min(RIVER_DPR_CAP, window.devicePixelRatio || 1);
    const rs = riverScale;
    const devW = Math.round((W + MARGIN * 2) * rs);
    const devH = Math.max(1, Math.round((hR + MARGIN) * rs));
    riverCanvas!.width = devW;
    riverCanvas!.height = devH;
    riverCanvas!.style.top = `${waterY}px`;
    riverCanvas!.style.height = `${hR + MARGIN}px`;

    // Mirror of everything above the waterline (sky and far layer).
    riverSrc = makeCanvas(devW, devH);
    const src = ctx2d(riverSrc);
    src.setTransform(rs, 0, 0, -rs, MARGIN * rs, waterY * rs);
    src.imageSmoothingQuality = "high";
    src.drawImage(skyCanvas!, -MARGIN, -MARGIN, W + MARGIN * 2, H + MARGIN * 2);
    src.drawImage(farCanvas!, -MARGIN, -MARGIN, W + MARGIN * 2, H + MARGIN * 2);
    src.setTransform(rs, 0, 0, rs, MARGIN * rs, 0);
    // Light streaks: window lights stretch into vertical columns on the rippled water.
    for (const light of lights) {
      const r0 = waterY - light.y;
      const len = (26 + (light.x % 13)) * L.scale;
      const g = src.createLinearGradient(0, r0 - 2, 0, r0 + len);
      g.addColorStop(0, "rgba(255,190,110,0.5)");
      g.addColorStop(1, "rgba(255,160,90,0)");
      src.fillStyle = g;
      src.fillRect(light.x - 1.6 * L.scale, r0 - 2, 3.2 * L.scale, len);
    }
    // Moon path: soft column below the moon.
    const colW = L.moonR * 4 + hR * 0.25;
    const cg = src.createLinearGradient(L.moonX - colW, 0, L.moonX + colW, 0);
    cg.addColorStop(0, "rgba(150,185,215,0)");
    cg.addColorStop(0.5, "rgba(170,200,225,0.13)");
    cg.addColorStop(1, "rgba(150,185,215,0)");
    src.fillStyle = cg;
    src.fillRect(L.moonX - colW, 0, colW * 2, hR + MARGIN);

    riverTint = makeCanvas(devW, devH);
    const tint = ctx2d(riverTint);
    tint.setTransform(rs, 0, 0, rs, 0, 0);
    const tg = tint.createLinearGradient(0, 0, 0, hR);
    tg.addColorStop(0, "rgba(4,12,22,0.12)");
    tg.addColorStop(0.25, "rgba(4,12,22,0.38)");
    tg.addColorStop(1, "rgba(2,6,12,0.74)");
    tint.fillStyle = tg;
    tint.fillRect(0, 0, W + MARGIN * 2, hR + MARGIN);
    tint.fillStyle = "rgba(150,195,215,0.14)";
    tint.fillRect(0, 0, W + MARGIN * 2, 1);

    const grng = createRng(SEED + 31);
    const count = Math.round(clamp(hR * 0.7, 40, 170));
    glints = [];
    for (let n = 0; n < count; n++) {
      const depth = Math.pow(grng(), 0.85);
      const r = 2 + depth * (hR - 4);
      const spread = L.moonR * 1.2 + r * 0.5;
      const off = (grng() + grng() + grng() - 1.5) * spread * 0.9;
      glints.push({
        x: L.moonX + off,
        y: waterY + r,
        len: (2 + depth * 14 * (0.4 + grng() * 0.6)) * L.scale,
        w: depth > 0.5 ? 1.5 : 1,
        phase: grng() * TAU,
        speed: 1.2 + grng() * 2.6,
        base: (0.75 - depth * 0.4) * (1 - Math.min(1, Math.abs(off) / (spread * 1.4))),
      });
    }
  }

  function buildReeds(L: SceneLayout): void {
    const { width: W } = L;
    const rh = L.reedHeight;
    reedDpr = Math.min(window.devicePixelRatio || 1, FX_DPR_CAP);
    reedCanvas!.width = Math.round((W + MARGIN * 2) * reedDpr);
    reedCanvas!.height = Math.round(rh * reedDpr);
    reedCanvas!.style.height = `${rh}px`;
    const rrng = createRng(SEED + 41);
    const target = Math.round(clamp(W / 5, 70, 300));
    const xs: number[] = [];
    const hs: number[] = [];
    for (let n = 0; n < target * 3 && xs.length < target; n++) {
      const x = rrng() * (W + MARGIN * 2) - MARGIN;
      const e = Math.abs(x / W - 0.5) * 2;
      const corner = Math.pow(clamp((e - 0.35) / 0.65, 0, 1), 1.3);
      if (rrng() > 0.18 + corner * 0.82) continue;
      xs.push(x);
      hs.push(rh * (0.12 + 0.88 * corner) * (0.45 + 0.55 * rrng()) + 6 * L.scale);
    }
    reedCount = xs.length;
    reedX = Float32Array.from(xs);
    reedH = Float32Array.from(hs);
    reedW = new Float32Array(reedCount);
    reedLean = new Float32Array(reedCount);
    reedStiff = new Float32Array(reedCount);
    reedPhase = new Float32Array(reedCount);
    reedFreq = new Float32Array(reedCount);
    reedGroup = new Uint8Array(reedCount);
    for (let n = 0; n < reedCount; n++) {
      reedW[n] = (1.1 + rrng() * 1.8) * Math.max(0.7, L.scale);
      const side = reedX[n] < W / 2 ? -1 : 1;
      reedLean[n] = side * (0.05 + rrng() * 0.2) + (rrng() - 0.5) * 0.25;
      reedStiff[n] = 0.7 + rrng() * 0.6;
      reedPhase[n] = rrng() * TAU;
      reedFreq[n] = 0.5 + rrng() * 0.6;
      reedGroup[n] = rrng() < 0.45 ? 0 : 1;
    }
  }

  function placeFireflies(L: SceneLayout): void {
    const count = fireflyCount(L.width, L.height, coarse);
    field.count = count;
    const s = L.scale;
    const fs = Math.max(0.7, s);
    let shareSum = 0;
    for (const g of trees) shareSum += g.spec.fireflyShare;
    const farShare = 0.12;
    const driftShare = 0.08;
    const treeShare = 1 - farShare - driftShare;
    driftMinY = L.waterY + (L.height - L.waterY) * 0.18;
    driftMaxY = L.height - (L.height - L.waterY) * 0.18;
    coupledMinX = Infinity;
    coupledMaxX = -Infinity;
    for (let i = 0; i < count; i++) {
      const roll = kindRoll[i];
      let k = 0;
      let treeIdx = -1;
      if (roll < treeShare && trees.length) {
        let acc = 0;
        const target = (roll / treeShare) * shareSum;
        for (let t = 0; t < trees.length; t++) {
          acc += trees[t].spec.fireflyShare;
          if (target < acc || t === trees.length - 1) {
            treeIdx = t;
            break;
          }
        }
        k = trees[treeIdx].spec.near ? 2 : 1;
      } else if (roll < treeShare + farShare) {
        k = 0;
      } else {
        k = 3;
      }
      kind[i] = k;
      tree[i] = treeIdx;
      const sr = sizeRoll[i];
      bokeh[i] = 0;
      if (k === 2) {
        size[i] = (14 + sr * sr * 17) * fs;
        bright[i] = 0.82 + sr * 0.18;
        floorGlow[i] = sr > 0.55 ? 0.04 : 0;
        swoopH[i] = (4 + sr * 5) * s;
        wanderA[i] = (2 + sr * 4) * s;
      } else if (k === 1) {
        size[i] = (10 + sr * 5) * fs;
        bright[i] = 0.72 + sr * 0.2;
        floorGlow[i] = 0;
        swoopH[i] = (2.5 + sr * 3) * s;
        wanderA[i] = (1.5 + sr * 2) * s;
      } else if (k === 0) {
        size[i] = (6 + sr * 3) * fs;
        bright[i] = 0.6 + sr * 0.3;
        floorGlow[i] = 0;
        swoopH[i] = 0;
        wanderA[i] = 0.6 * s;
      } else {
        // Drifters over the water; some are close to the viewer and out of focus.
        bokeh[i] = sr > 0.55 ? 1 : 0;
        size[i] = bokeh[i] ? (12 + sr * 12) * fs : (16 + sr * 8) * fs;
        bright[i] = 0.7 + sr * 0.25;
        floorGlow[i] = 0.05;
        swoopH[i] = bokeh[i] ? 0 : (4 + sr * 4) * s;
        wanderA[i] = 0;
      }
      setHome(i, L);
      posX[i] = homeX[i];
      if (k === 3) driftH[i] = (18 + sr * 40) * s;
      field.x[i] = homeX[i];
      field.y[i] = k === 3 ? surf[i] - driftH[i] : homeY[i];
      if (k === 1 || k === 2) {
        coupledMinX = Math.min(coupledMinX, homeX[i]);
        coupledMaxX = Math.max(coupledMaxX, homeX[i]);
      }
      // Still frame: the canopy outline softly lit, as at the top of a shared pulse.
      const sr2 = stillRoll[i];
      if (k === 1 || k === 2) still[i] = sr2 < 0.78 ? 0.12 + 0.62 * homeEdge[i] * (0.7 + 0.3 * sr2) : 0;
      else if (k === 0) still[i] = sr2 < 0.5 ? 0.35 + sr2 * 0.6 : 0;
      else still[i] = sr2 < 0.4 ? 0.45 : 0;
      flyEnd[i] = -1;
    }
    if (!Number.isFinite(coupledMinX)) {
      coupledMinX = 0;
      coupledMaxX = L.width;
    }
    wanderScale = s;
  }

  function setHome(i: number, L: SceneLayout): void {
    const k = kind[i];
    if (k === 1 || k === 2) {
      const g = trees[tree[i]];
      if (!g) return;
      const n = pickWeighted(g.perchCdf, (perch[i] % 100003) / 100003);
      homeX[i] = g.perches[n * 2];
      homeY[i] = g.perches[n * 2 + 1];
      homeEdge[i] = g.perchEdge[n];
      surf[i] = g.spec.baseY;
    } else if (k === 0) {
      const u = (perch[i] % 997) / 997;
      const x = -MARGIN + u * (L.width + MARGIN * 2);
      const idx = clamp(Math.round((x + MARGIN) / 3), 0, farProfile.length - 1);
      const h = farProfile.length ? farProfile[idx] : L.farHeight;
      homeX[i] = x;
      homeY[i] = L.waterY - h * (0.25 + ((perch[i] % 61) / 61) * 0.65);
      homeEdge[i] = 0;
      surf[i] = L.waterY;
    } else {
      homeX[i] = ((perch[i] % 991) / 991) * L.width;
      homeY[i] = lerp(driftMinY, driftMaxY, (perch[i] % 89) / 89);
      homeEdge[i] = 0;
      surf[i] = homeY[i];
    }
  }

  // Static art is painted in small tasks so the page never freezes: sky at once,
  // then one task per tree, the far bank (which also commits the layout and
  // places the fireflies) and finally the near trees, which fade in.
  let jobId = 0;
  let jobTimer: ReturnType<typeof setTimeout> | undefined;
  let fxCtx: CanvasRenderingContext2D | null = null;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /** A stage returns true when it has more work and should run again in a later task. */
  function runStages(id: number, stages: Array<() => boolean | void>): void {
    const next = () => {
      if (id !== jobId || !stages.length) return;
      if (!stages[0]()) stages.shift();
      if (stages.length) jobTimer = setTimeout(next, 0);
    };
    jobTimer = setTimeout(next, 0);
  }

  function commitLayout(L: SceneLayout): void {
    layout = L;
    buildRiver(L);
    buildReeds(L);
    placeFireflies(L);
  }

  function showNear(): void {
    const el = nearCanvas!;
    el.style.transition = reduceMotion.matches ? "none" : "opacity 700ms ease";
    el.style.opacity = "1";
  }

  function resize(sz: Readonly<SceneSize>, ctx: CanvasRenderingContext2D): void {
    fxCtx = ctx;
    const L = computeLayout(sz.width, sz.height);
    const dpr = window.devicePixelRatio || 1;
    staticDpr = Math.min(dpr, STATIC_DPR_CAP);
    skyDpr = Math.min(dpr, SKY_DPR_CAP);
    const key = `${ART_VERSION}:${sz.width}x${sz.height}@${staticDpr}/${skyDpr}`;
    const size = (c: HTMLCanvasElement, scale: number) => {
      const w = Math.round((sz.width + MARGIN * 2) * scale);
      const h = Math.round((sz.height + MARGIN * 2) * scale);
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
        paintedKey.delete(c);
      }
    };
    size(skyCanvas!, skyDpr);
    size(farCanvas!, staticDpr);
    size(nearCanvas!, staticDpr);
    configureGrid(field, sz.width, sz.height, Math.max(70, Math.min(sz.width, sz.height) * 0.11));
    ctx.globalCompositeOperation = "lighter";
    fxScale = ctx.getTransform().a;
    lastTransformX = Number.NaN;
    quietDirty = true;

    jobId++;
    clearTimeout(jobTimer);
    const cached = geomCache?.key === key ? geomCache : null;
    const painted = paintedKey.get(skyCanvas!) === key && paintedKey.get(farCanvas!) === key && paintedKey.get(nearCanvas!) === key;
    if (painted && cached) {
      trees = cached.trees;
      farProfile = cached.farProfile;
      lights = cached.lights;
      commitLayout(L);
      showNear();
      return;
    }

    const id = jobId;
    nearCanvas!.style.transition = "none";
    nearCanvas!.style.opacity = "0";
    clearNear();
    paintSky(L);
    paintedKey.set(skyCanvas!, key);
    const built: TreeGeom[] = [];
    const stages: Array<() => boolean | void> = L.trees.map((spec, k) => () => {
      built[k] = cached ? cached.trees[k] : buildTree(spec, L);
    });
    stages.push(() => {
      trees = built;
      paintFar(L);
      commitLayout(L);
      paintedKey.set(farCanvas!, key);
      if (reduceMotion.matches && fxCtx) reducedMotionFrame(fxCtx);
    });
    L.trees.forEach((spec, k) => {
      if (!spec.near) return;
      let steps: Generator<void, void, void> | null = null;
      stages.push(() => {
        steps ??= paintTree(nearCtx!, built[k], NEAR_PALETTE, L);
        return !steps.next().done;
      });
    });
    stages.push(() => {
      // Scratch layers are only needed while painting.
      scratch.length = 0;
      geomCache = { key, trees: built, farProfile, lights };
      paintedKey.set(nearCanvas!, key);
      showNear();
    });
    runStages(id, stages);
  }

  /* ---------------- per-frame ---------------- */

  function measureQuiet(t: number): void {
    quietDirty = false;
    quietCheckedAt = t;
    quietCount = 0;
    const selector = options.quietSelector;
    if (!selector) return;
    const origin = root.getBoundingClientRect();
    const range = document.createRange();
    for (const el of document.querySelectorAll(selector)) {
      if (quietCount >= QUIET_MAX) break;
      if (typeof el.checkVisibility === "function" && !el.checkVisibility({ checkVisibilityCSS: true })) continue;
      // The text itself, not the (often much wider) block box.
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const q = quietCount * 4;
      quiet[q] = r.left - origin.left;
      quiet[q + 1] = r.top - origin.top;
      quiet[q + 2] = r.right - origin.left;
      quiet[q + 3] = r.bottom - origin.top;
      quietCount++;
    }
    range.detach();
  }

  /** 1 away from text, down to 0.3 right behind it. */
  function quietFactor(x: number, y: number): number {
    let f = 1;
    const pad = 16;
    for (let q = 0; q < quietCount * 4; q += 4) {
      const dx = Math.max(quiet[q] - x, 0, x - quiet[q + 2]);
      const dy = Math.max(quiet[q + 1] - y, 0, y - quiet[q + 3]);
      const d = Math.max(dx, dy);
      if (d < pad) f = Math.min(f, 0.3 + 0.7 * (d / pad));
    }
    return f;
  }

  function applyParallax(dt: number, pointer: Readonly<PointerState>): void {
    const tx = pointer.active && pointer.type === "mouse" ? clamp(pointer.nx - 0.5, -0.5, 0.5) : 0;
    const ty = pointer.active && pointer.type === "mouse" ? clamp(pointer.ny - 0.5, -0.5, 0.5) : 0;
    const k = dt > 0 ? 1 - Math.exp(-dt * 2.2) : 1;
    parX += (tx - parX) * k;
    parY += (ty - parY) * k;
    const qx = Math.round(parX * 400) / 400;
    const qy = Math.round(parY * 400) / 400;
    if (qx === lastTransformX && qy === lastTransformY) return;
    lastTransformX = qx;
    lastTransformY = qy;
    farOffX = -qx * 6;
    farOffY = -qy * 2;
    offX[0] = farOffX;
    offY[0] = farOffY;
    offX[1] = farOffX;
    offY[1] = farOffY;
    offX[2] = -qx * 11;
    offY[2] = -qy * 3.8;
    offX[3] = -qx * 14;
    offY[3] = -qy * 3;
    skyCanvas!.style.transform = `translate3d(${(-qx * 3).toFixed(2)}px,${(-qy * 1.5).toFixed(2)}px,0)`;
    const far = `translate3d(${farOffX.toFixed(2)}px,${farOffY.toFixed(2)}px,0)`;
    farCanvas!.style.transform = far;
    riverCanvas!.style.transform = far;
    nearCanvas!.style.transform = `translate3d(${offX[2].toFixed(2)}px,${offY[2].toFixed(2)}px,0)`;
    reedCanvas!.style.transform = `translate3d(${(-qx * 17).toFixed(2)}px,0,0)`;
  }

  function updateWind(t: number, dt: number, W: number): void {
    if (dt <= 0) return;
    if (t >= nextGustAt && gustX > W + gustWidth * 2) {
      gustWidth = W * (0.18 + Math.random() * 0.14);
      gustX = -gustWidth * 2;
      gustSpeed = W / (3 + Math.random() * 2);
      gustStrength = 0.6 + Math.random() * 0.6;
      nextGustAt = t + 7 + Math.random() * 9;
    }
    gustX += gustSpeed * dt;
    const inView = gustX > -gustWidth && gustX < W + gustWidth ? 1 : 0;
    windLevel += (inView * gustStrength - windLevel) * (1 - Math.exp(-dt * 1.5));
  }

  function rippleOffset(r: number, hR: number, t: number): number {
    const depth = r / hR;
    const amp = (0.35 + 4.2 * depth * Math.sqrt(depth)) * (1 + 0.45 * windLevel);
    const q = Math.sqrt(r);
    return amp * (0.65 * Math.sin(q * 3.1 - t * 1.5) + 0.35 * Math.sin(q * 1.3 + t * 0.8 + 1.3));
  }

  function drawRiver(L: SceneLayout, t: number, moving: boolean): void {
    if (!riverSrc || !riverTint) return;
    const ctx = riverCtx!;
    const rs = riverScale;
    const hR = L.height - L.waterY;
    const devH = riverCanvas!.height;
    const devW = riverCanvas!.width;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    let row = 0;
    while (row < devH) {
      const r = row / rs;
      const depth = Math.min(1, r / hR);
      const hs = Math.max(1, Math.round((1 + 2.2 * depth + 2.5 * depth * depth) * rs));
      const dx = (moving ? rippleOffset(r + hs * 0.5 / rs, hR, t) : rippleOffset(r, hR, 0.7) * 0.4) * rs;
      ctx.drawImage(riverSrc, 0, row, devW, hs, dx, row, devW, hs);
      row += hs;
    }
    ctx.drawImage(riverTint, 0, 0);

    ctx.setTransform(rs, 0, 0, rs, MARGIN * rs, -L.waterY * rs);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#d4e6f2";
    for (let n = 0; n < glints.length; n++) {
      const g = glints[n];
      let a: number;
      if (moving) {
        a = Math.sin(t * g.speed + g.phase);
        if (a <= 0) continue;
        a = a * a;
        a = a * a * g.base;
      } else {
        a = g.base * 0.35 * (0.5 + 0.5 * Math.sin(g.phase));
      }
      if (a < 0.02) continue;
      ctx.globalAlpha = a;
      const dx = moving ? rippleOffset(g.y - L.waterY, hR, t) * 0.6 : 0;
      ctx.fillRect(g.x + dx - g.len / 2, g.y, g.len, g.w);
    }
    ctx.globalAlpha = 1;
  }

  function drawReeds(L: SceneLayout, t: number, moving: boolean): void {
    const ctx = reedCtx!;
    const rh = L.reedHeight;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, reedCanvas!.width, reedCanvas!.height);
    ctx.setTransform(reedDpr, 0, 0, reedDpr, MARGIN * reedDpr, 0);
    const baseY = rh + 2;
    for (let group = 0; group < 2; group++) {
      ctx.beginPath();
      for (let n = 0; n < reedCount; n++) {
        if (reedGroup[n] !== group) continue;
        const x = reedX[n];
        const h = reedH[n];
        let bend = reedLean[n];
        if (moving) {
          const q = (x - gustX) / gustWidth;
          const gust = q > -3 && q < 3 ? gustStrength * Math.exp(-q * q) : 0;
          bend += (0.05 * Math.sin(t * reedFreq[n] + reedPhase[n] + x * 0.004) + (gust * 0.32 + windLevel * 0.05)) / reedStiff[n];
        }
        const w = reedW[n];
        const tx = x + Math.sin(bend) * h;
        const ty = baseY - Math.cos(bend) * h;
        const cx = x + Math.sin(bend * 0.45) * h * 0.55;
        const cy = baseY - Math.cos(bend * 0.45) * h * 0.55;
        ctx.moveTo(x - w, baseY);
        ctx.quadraticCurveTo(cx - w * 0.45, cy, tx, ty);
        ctx.quadraticCurveTo(cx + w * 0.45, cy, x + w, baseY);
      }
      ctx.fillStyle = group === 0 ? "#0a1822" : "#020508";
      ctx.fill();
    }
  }

  function scheduleWave(t: number): void {
    const wave = field.wave;
    if (!waveInitialised) {
      waveInitialised = true;
      wave.nextAt = t + 7 + Math.random() * 3;
    }
    if (!wave.running && t >= wave.nextAt && layout) {
      const pad = layout.width * 0.04;
      startWave(field, t, Math.random() < 0.5 ? 1 : -1, coupledMinX - pad, coupledMaxX + pad);
      wave.nextAt = t + 28 + Math.random() * 12;
    }
  }

  /** Blend toward a call point: fly in, hover in a loose swarm, then return. */
  function attraction(i: number, t: number): number {
    if (!(t > attractStart[i] && t < attractEnd[i] + 2.5)) return 0;
    return smooth(attractStart[i], attractArrive[i], t) * (1 - smooth(attractEnd[i], attractEnd[i] + 2.5, t)) * attractAmt[i];
  }

  function moveFireflies(L: SceneLayout, t: number, dt: number): void {
    const n = field.count;
    for (let i = 0; i < n; i++) {
      const k = kind[i];
      const a = attraction(i, t);
      const swarmX = attractX[i] + Math.sin(t * 0.7 + wanderP1[i]) * 9 * wanderScale;
      const swarmY = attractY[i] + Math.sin(t * 0.55 + wanderP2[i]) * 6 * wanderScale;
      if (k === 3) {
        const ns = driftSeed[i];
        const ang = noise(posX[i] * 0.0025 + ns, t * 0.05 + ns) * Math.PI * 1.2;
        const speed = (10 + 8 * sizeRoll[i]) * wanderScale * (1 - a);
        posX[i] += (Math.cos(ang) * speed + windLevel * 6 * (1 - a)) * dt;
        surf[i] += Math.sin(ang) * speed * 0.25 * dt;
        if (surf[i] < driftMinY) surf[i] += (driftMinY - surf[i]) * dt;
        if (surf[i] > driftMaxY) surf[i] -= (surf[i] - driftMaxY) * dt;
        if (posX[i] < -40) posX[i] = L.width + 40;
        else if (posX[i] > L.width + 40) posX[i] = -40;
        const ax = posX[i];
        const ay = surf[i] - driftH[i] * (0.8 + 0.2 * Math.sin(t * 0.4 + ns));
        field.x[i] = ax + (swarmX - ax) * a;
        field.y[i] = ay + (swarmY - ay) * a;
        continue;
      }
      if (dt > 0 && (k === 1 || k === 2) && t > flyEnd[i] && a === 0 && Math.random() < dt * 0.01) {
        fromX[i] = homeX[i];
        fromY[i] = homeY[i];
        perch[i] = Math.floor(Math.random() * 1e9);
        setHome(i, L);
        flyStart[i] = t;
        flyEnd[i] = t + 2.5 + Math.random() * 2.5;
      }
      let ax = homeX[i];
      let ay = homeY[i];
      if (t < flyEnd[i]) {
        const p = clamp((t - flyStart[i]) / (flyEnd[i] - flyStart[i]), 0, 1);
        const e = p * p * (3 - 2 * p);
        ax = lerp(fromX[i], homeX[i], e);
        ay = lerp(fromY[i], homeY[i], e) - Math.sin(p * Math.PI) * 18 * wanderScale;
      }
      const wa = wanderA[i];
      ax += wa * Math.sin(t * wanderF1[i] + wanderP1[i]);
      ay += wa * 0.6 * Math.sin(t * wanderF2[i] + wanderP2[i]);
      field.x[i] = ax + (swarmX - ax) * a;
      field.y[i] = ay + (swarmY - ay) * a - Math.sin(a * Math.PI) * 14 * wanderScale;
    }
  }

  function drawFireflies(ctx: CanvasRenderingContext2D, L: SceneLayout, t: number, moving: boolean): void {
    const n = field.count;
    const fs = fxScale;
    for (let i = 0; i < n; i++) {
      drawn[i] = 0;
      let e: number;
      let tau = 1e9;
      let flashLen = 1;
      if (moving) {
        e = flashIntensity(field, i, t);
        tau = t - field.flashAt[i];
        flashLen = field.attack[i] + field.decay[i];
      } else {
        e = still[i];
      }
      let glow = e * bright[i] + floorGlow[i];
      if (glow < 0.012) continue;
      const k = kind[i];
      let sx = 0;
      let sy = 0;
      let u = 0;
      const swooping = moving && tau < flashLen && swoopH[i] > 0;
      if (swooping) {
        u = tau / flashLen;
        sy = swoopH[i] * Math.sin(u * 2.36);
        sx = swoopW[i] * swoopH[i] * 0.6 * u * u * u;
      }
      const baseX = field.x[i];
      const baseY = field.y[i];
      const px = baseX + sx + offX[k];
      const py = baseY + sy + offY[k];
      if (quietCount) glow *= quietFactor(px, py);
      const r = size[i] * (0.85 + 0.25 * e);
      const alpha = bokeh[i] ? glow * 0.5 : glow;
      ctx.globalAlpha = alpha > 1 ? 1 : alpha;
      ctx.drawImage(bokeh[i] ? bokehSprite : sprites[field.species[i]], px - r, py - r, r * 2, r * 2);
      if (swooping && e > 0.2 && (k === 2 || k === 3) && u > 0.08) {
        // One stretched streak from where the swoop started to the head.
        const tu = u * 0.35;
        const tx = baseX + offX[k] + swoopW[i] * swoopH[i] * 0.6 * tu * tu * tu;
        const ty = baseY + offY[k] + swoopH[i] * Math.sin(tu * 2.36);
        const dx = px - tx;
        const dy = py - ty;
        const len = Math.hypot(dx, dy);
        if (len > 2) {
          const ux = dx / len;
          const uy = dy / len;
          const th = r * 0.22;
          const sl = (len + th) / STREAK_W;
          const st = th / STREAK_H;
          ctx.globalAlpha = Math.min(1, glow * 0.4);
          ctx.setTransform(fs * ux * sl, fs * uy * sl, -fs * uy * st, fs * ux * st, fs * px, fs * py);
          ctx.drawImage(streakSprite, -STREAK_W, -STREAK_H / 2);
          ctx.setTransform(fs, 0, 0, fs, 0, 0);
        }
      }
      drawn[i] = 1;
      drawX[i] = px;
      drawMirrorY[i] = 2 * surf[i] - (baseY + sy) - offY[k];
      drawR[i] = r;
      drawA[i] = alpha;
    }

    if (moving) {
      for (let c = 0; c < CALLS; c++) {
        const tau = t - callT[c];
        if (tau < 0 || tau > 1.6) continue;
        const a = tau < 0.12 ? smooth(0, 0.12, tau) : 1 - smooth(0.12, 1.6, tau);
        const r = 42 * Math.max(0.75, L.scale) * (0.8 + 0.3 * a);
        ctx.globalAlpha = a;
        ctx.drawImage(callSprite, callX[c] - r, callY[c] - r, r * 2, r * 2);
        // A soft ring spreads from the tap so the call reads even against a busy tree.
        const spread = smooth(0, 1.6, tau);
        const rr = (14 + 84 * spread) * Math.max(0.75, L.scale);
        ctx.globalAlpha = (1 - spread) * 0.7;
        ctx.drawImage(ringSprite, callX[c] - rr, callY[c] - rr, rr * 2, rr * 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Firefly reflections on the river layer (which already carries the far-layer offset). */
  function drawReflections(L: SceneLayout, t: number, moving: boolean): void {
    const hR = L.height - L.waterY;
    const rs = riverScale;
    const rctx = riverCtx!;
    rctx.setTransform(rs, 0, 0, rs, MARGIN * rs, -L.waterY * rs);
    rctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < field.count; i++) {
      if (!drawn[i] || bokeh[i]) continue;
      const r = drawR[i];
      const ry = drawMirrorY[i];
      if (ry <= L.waterY + 1 || ry > L.height + r) continue;
      const depth = (ry - L.waterY) / hR;
      const ra = drawA[i] * 0.42 * (1 - depth * 0.6);
      if (ra < 0.01) continue;
      const dx = moving ? rippleOffset(ry - L.waterY, hR, t) : 0;
      rctx.globalAlpha = ra > 1 ? 1 : ra;
      const rw = r * 0.85;
      const rh = r * 1.5;
      rctx.drawImage(sprites[field.species[i]], drawX[i] - farOffX + dx - rw, ry + farOffY - rh, rw * 2, rh * 2);
    }
    rctx.globalAlpha = 1;
    rctx.globalCompositeOperation = "source-over";
  }

  function render(ctx: CanvasRenderingContext2D, frame: Readonly<SceneFrame>): void {
    const L = layout;
    if (!L) return;
    const { t, dt } = frame;
    sceneT = t;
    frameNo++;
    if (quietDirty || t - quietCheckedAt > 1) measureQuiet(t);
    applyParallax(dt, frame.pointer);
    updateWind(t, dt, L.width);
    scheduleWave(t);
    moveFireflies(L, t, dt);
    stepField(field, t, dt, Math.random);
    ctx.clearRect(0, 0, L.width, L.height);
    drawFireflies(ctx, L, t, true);
    // On fast displays the river and the reeds alternate frames (30 Hz each).
    const split = dt > 0 && dt < 1 / 45;
    if (!split || (frameNo & 1) === 0) {
      drawRiver(L, t, true);
      drawReflections(L, t, true);
    }
    if (!split || (frameNo & 1) === 1) drawReeds(L, t, true);
  }

  function reducedMotionFrame(ctx: CanvasRenderingContext2D): void {
    const L = layout;
    if (!L) return;
    applyParallax(0, NEUTRAL_POINTER);
    measureQuiet(sceneT);
    for (let i = 0; i < field.count; i++) {
      field.x[i] = kind[i] === 3 ? posX[i] : homeX[i];
      field.y[i] = kind[i] === 3 ? surf[i] - driftH[i] : homeY[i];
    }
    ctx.clearRect(0, 0, L.width, L.height);
    drawFireflies(ctx, L, 0, false);
    drawRiver(L, 0, false);
    drawReflections(L, 0, false);
    drawReeds(L, 0, false);
  }

  function isInteractive(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest("a, button, input, select, textarea, label, summary, [role='button'], [contenteditable='true']") !== null;
  }

  function onPointer(pointer: Readonly<PointerState>, event: PointerEvent): void {
    if (event.type !== "pointerup" || !pointer.justTapped || !layout || isInteractive(event.target)) return;
    const t = sceneT;
    const x = pointer.x;
    const y = pointer.y;
    callX[callCursor] = x;
    callY[callCursor] = y;
    callT[callCursor] = t;
    callCursor = (callCursor + 1) % CALLS;

    // The nearest fireflies answer: they fly in, gather in a loose swarm and
    // flash back as a cascade from the nearest outward. triggerFlash keeps
    // each one's refractory interval.
    const s = layout.scale;
    const reach = Math.max(200, Math.min(layout.width, layout.height) * 0.42);
    const candidates: Array<{ i: number; d: number }> = [];
    for (let i = 0; i < field.count; i++) {
      if (kind[i] === 0 || bokeh[i]) continue;
      const d = Math.hypot(field.x[i] - x, field.y[i] - y);
      if (d < reach) candidates.push({ i, d });
    }
    candidates.sort((a, b) => a.d - b.d);
    const answer = Math.min(candidates.length, 16);
    for (let c = 0; c < answer; c++) {
      const { i, d } = candidates[c];
      const ang = Math.random() * TAU;
      const rr = Math.sqrt(Math.random());
      attractX[i] = x + Math.cos(ang) * rr * 46 * Math.max(0.7, s);
      attractY[i] = y + Math.sin(ang) * rr * 30 * Math.max(0.7, s);
      attractStart[i] = t + 0.25 + c * 0.03;
      attractArrive[i] = attractStart[i] + 1.1 + (d / reach) * 1.1;
      attractEnd[i] = attractArrive[i] + 6 + Math.random() * 3;
      attractAmt[i] = 0.92 + Math.random() * 0.06;
      field.respondAt[i] = t + 1.1 + (c / Math.max(1, answer - 1)) * 1.1;
      field.active[i] = 1;
      field.boutEnd[i] = Math.max(field.boutEnd[i], attractEnd[i]);
    }
  }

  const scene = createScene({
    canvas: fxCanvas,
    container: root,
    dprCap: FX_DPR_CAP,
    render,
    resize,
    onPointer,
    reducedMotionFrame,
  });
  scene.start();

  return {
    destroy() {
      jobId++;
      clearTimeout(jobTimer);
      scene.destroy();
      window.removeEventListener("scroll", markQuiet);
      riverSrc = null;
      riverTint = null;
      trees = [];
      scratch.length = 0;
    },
  };
}
