// Mothlight hub scene: luna moths in a moonlit garden, drawn on one canvas.
//
// Everything expensive (sky, nebula, stars, moon, back plants, back mist, moth
// flap sprite sheets) is pre-rendered on resize from a fixed seed, so a resize
// re-lays the scene without reseeding and the frame loop only composites a few
// images and advances a small simulation. The caller describes the page's text
// and cards with CSS selectors; the moon is placed clear of them and moths and
// the pointer lantern keep out of them.

import { createNoise2D, createRng, createScene, fbm2D } from "../_shared/scene-runtime";
import type { PointerState, SceneFrame, SceneHandle, SceneSize } from "../_shared/scene-runtime";

const TAU = Math.PI * 2;
const SEED = 0x6d6f7468;
const FLAP_FRAMES = 12;
const OPEN_MIN = 0.3;
const FLAP_EASE = 0.6;
/** Moth sprite cell spans this many wingspan units; the body centre sits at CELL_ORIGIN. */
const CELL_UNITS = 1.36;
const CELL_ORIGIN_X = 0.68;
const CELL_ORIGIN_Y = 0.56;
const MAX_DUST = 240;
const MOUSE_IDLE_FADE_S = 6;
/** A touch lantern lingers briefly after the finger lifts (or the page starts panning), then fades. */
const TOUCH_LINGER_S = 2.2;
/** Only a few moths answer the pointer lantern at once; the rest keep their own business. */
const MAX_POINTER_MOTHS = 3;
/** Soft painterly content does not need a full 2x backing store. */
const DPR_CAP = 1.5;
/** Upright display: the dorsal sprite leans into its flight direction by at most this much. */
const MAX_LEAN = 0.8;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MoonPlacement {
  x: number;
  y: number;
  r: number;
  /** Faint 22-degree halo ring; dropped on small screens and when the moon is tucked into a corner. */
  ring: boolean;
}

export interface MothlightLayout {
  width: number;
  height: number;
  short: number;
  margin: number;
  compact: boolean;
  moon: MoonPlacement;
  /** Moon orbit radii, shrunk so circling moths stay clear of the page text. */
  moonOrbit: { rx: number; ry: number };
  lamp: { postX: number; hookX: number; hookY: number; size: number; chain: number };
  lampOrbit: number;
  plantHeight: number;
  /** Share of the usual moonflowers; wide screens get fewer so the lower third stays calm. */
  flowerDensity: number;
  nearMoths: number;
  farMoths: number;
  /** Wingspan in CSS px of a near moth at depth 1. */
  mothSpan: number;
}

export interface Orbit {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

/** Distance from a point to a rectangle; 0 inside it. */
export function rectDistance(px: number, py: number, r: Rect): number {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

function clearance(px: number, py: number, rects: readonly Rect[]): number {
  let best = Infinity;
  for (const r of rects) best = Math.min(best, rectDistance(px, py, r));
  return best;
}

/**
 * Puts the moon in the top of the screen, preferring the upper right, with the
 * disc and its inner bloom clear of every rect. When nothing is free (portrait
 * phones) it shrinks and tucks into the freest spot, partly off the top edge.
 */
export function placeMoon(width: number, height: number, r0: number, avoid: readonly Rect[]): MoonPlacement {
  const ring = Math.min(width, height) >= 600;
  const preferred = { x: width - Math.max(r0 * 2.2 + 16, width * 0.085), y: Math.max(r0 * 2 + 12, height * 0.12) };
  if (clearance(preferred.x, preferred.y, avoid) >= r0 * 1.6) return { ...preferred, r: r0, ring };

  const search = (r: number, need: number, xLo: number, xHi: number, yLo: number, yHi: number) => {
    let best: { x: number; y: number } | null = null;
    let bestScore = -Infinity;
    const step = Math.max(4, r * 0.4);
    for (let y = yLo; y <= yHi; y += step) {
      for (let x = xHi; x >= xLo; x -= step) {
        const c = clearance(x, y, avoid);
        if (c < r * need) continue;
        const score = x / width - (y / height) * 0.9 + Math.min(c / r, 4) * 0.05;
        if (score > bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }
    return best;
  };

  const edge = Math.max(10, r0 * 0.5);
  const inside = search(r0, 1.6, edge + r0, width - edge - r0, edge + r0, height * 0.34);
  if (inside) return { ...inside, r: r0, ring };
  const r1 = r0 * 0.72;
  const tucked = search(r1, 1.3, r1 + 4, width - r1 - 4, -r1 * 0.25, height * 0.3);
  if (tucked) return { ...tucked, r: r1, ring: false };
  return { x: width - r1 * 1.4, y: r1 * 0.3, r: r1, ring: false };
}

/** How far moths can circle the moon before brushing the page text. */
function moonOrbitFor(moon: MoonPlacement, span: number, avoid: readonly Rect[]): { rx: number; ry: number } {
  const base = moon.r * 3.4;
  const pad = span * 0.6;
  const reach = (dx: number, dy: number) => {
    let d = moon.r;
    while (d < base && clearance(moon.x + dx * d, moon.y + dy * d, avoid) > pad) d += 4;
    return d;
  };
  const lo = moon.r * 1.3;
  return {
    rx: clamp(Math.min(reach(1, 0), reach(-1, 0)), lo, base),
    ry: clamp(Math.min(reach(0, 1), reach(0, -1) + moon.r), lo, base),
  };
}

export function computeLayout(width: number, height: number, avoid: readonly Rect[] = []): MothlightLayout {
  const short = Math.max(1, Math.min(width, height));
  const margin = clamp(short * 0.03, 10, 28);
  const mothSpan = clamp(short * 0.056, 26, 58);
  const moon = placeMoon(width, height, clamp(short * 0.05, 14, 54), avoid);
  const size = clamp(short * 0.042, 14, 32);
  const postX = Math.max(margin * 1.2, width * 0.05);
  const hookY = height - clamp(short * 0.36, 120, 320);
  const area = width * height;
  return {
    width,
    height,
    short,
    margin,
    compact: short < 600,
    moon,
    moonOrbit: moonOrbitFor(moon, mothSpan, avoid),
    lamp: { postX, hookX: postX + size * 2.2, hookY, size, chain: size * 1.1 },
    lampOrbit: clamp(short * 0.1, 40, 96),
    plantHeight: clamp(short * 0.3, 90, 250),
    flowerDensity: width / height > 1.8 ? 0.5 : 1,
    nearMoths: clamp(Math.round(area / 220_000) + 2, 3, 8),
    farMoths: clamp(Math.round(area / 450_000), 1, 4),
    mothSpan,
  };
}

/** Shrinks and shifts an elliptical orbit so it stays inside the screen margins. */
export function fitOrbit(cx: number, cy: number, rx: number, ry: number, layout: MothlightLayout): Orbit {
  const { width, height, margin } = layout;
  const fx = Math.max(0, Math.min(rx, (width - 2 * margin) / 2));
  const fy = Math.max(0, Math.min(ry, (height - 2 * margin) / 2));
  return {
    x: clamp(cx, margin + fx, width - margin - fx),
    y: clamp(cy, margin + fy, height - margin - fy),
    rx: fx,
    ry: fy,
  };
}

/** Wing openness (x foreshortening) for a flap phase; 1 = fully spread, OPEN_MIN = raised. */
export function flapOpenness(phase: number): number {
  // The exponent keeps wings spread for most of the stroke, as in a real wingbeat.
  return OPEN_MIN + (1 - OPEN_MIN) * (0.5 + 0.5 * Math.cos(phase)) ** FLAP_EASE;
}

/** Flap frame whose openness is closest to `open`, searched on the opening half of the cycle. */
export function frameForOpenness(open: number, frames = FLAP_FRAMES): number {
  const c = clamp(clamp((open - OPEN_MIN) / (1 - OPEN_MIN), 0, 1) ** (1 / FLAP_EASE) * 2 - 1, -1, 1);
  return Math.round((Math.acos(c) / TAU) * frames) % frames;
}

/**
 * Screen rotation for the top-down moth sprite: it stays near upright in this
 * side-view garden and only leans toward its flight direction.
 */
export function displayAngle(heading: number): number {
  const hx = Math.cos(heading);
  const hy = Math.sin(heading);
  return clamp(Math.atan2(hx, Math.max(0.3, -hy)), -MAX_LEAN, MAX_LEAN);
}

function wrapAngle(a: number): number {
  let r = (a + Math.PI) % TAU;
  if (r < 0) r += TAU;
  return r - Math.PI;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

interface Surface {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
}

function surface(w: number, h: number): Surface {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(w));
  canvas.height = Math.max(1, Math.ceil(h));
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Mothlight: 2D canvas context unavailable");
  return { canvas, g };
}

/** Frees a scratch canvas' backing store now instead of at garbage collection (iOS caps canvas memory). */
function release(...canvases: HTMLCanvasElement[]): void {
  for (const c of canvases) {
    c.width = 0;
    c.height = 0;
  }
}

/* ------------------------------------------------------------------ */
/* Moth sprites                                                        */
/* ------------------------------------------------------------------ */

interface WingPalette {
  center: string;
  mid: string;
  edge: string;
  costa: string;
  rim: string;
  tail: string;
  vein: string;
}

const PALETTES: WingPalette[] = [
  { center: "#d9eecb", mid: "#b1d7a2", edge: "#7db38c", costa: "#8a6aa6", rim: "#c7b2e4", tail: "#c9d6a2", vein: "rgba(84,128,104,0.5)" },
  { center: "#f3f0da", mid: "#d6e2bc", edge: "#a5c69a", costa: "#9a79aa", rim: "#d6c4ea", tail: "#d6d3a8", vein: "rgba(108,136,100,0.45)" },
  { center: "#d3ebdc", mid: "#a6d3b8", edge: "#74ad98", costa: "#7672b2", rim: "#b6b8ec", tail: "#b2d4ba", vein: "rgba(76,124,114,0.5)" },
];

function forewingPath(): Path2D {
  const p = new Path2D();
  p.moveTo(0.02, -0.11);
  p.bezierCurveTo(0.12, -0.215, 0.34, -0.27, 0.5, -0.225);
  p.quadraticCurveTo(0.475, -0.19, 0.478, -0.15);
  p.bezierCurveTo(0.47, -0.08, 0.42, -0.005, 0.35, 0.055);
  p.bezierCurveTo(0.25, 0.105, 0.11, 0.07, 0.02, 0.005);
  p.closePath();
  return p;
}

function hindwingPath(): Path2D {
  const p = new Path2D();
  p.moveTo(0.02, -0.035);
  p.bezierCurveTo(0.17, -0.035, 0.365, 0.01, 0.372, 0.15);
  p.bezierCurveTo(0.376, 0.24, 0.3, 0.29, 0.235, 0.33);
  p.bezierCurveTo(0.255, 0.42, 0.3, 0.52, 0.24, 0.615);
  p.quadraticCurveTo(0.205, 0.69, 0.168, 0.628);
  p.bezierCurveTo(0.195, 0.53, 0.145, 0.42, 0.105, 0.31);
  p.bezierCurveTo(0.07, 0.2, 0.04, 0.12, 0.02, 0.06);
  p.closePath();
  return p;
}

function costaPath(): Path2D {
  const p = new Path2D();
  p.moveTo(0.02, -0.11);
  p.bezierCurveTo(0.12, -0.215, 0.34, -0.27, 0.49, -0.225);
  return p;
}

function veinPath(from: [number, number], targets: Array<[number, number]>, bend: number): Path2D {
  const p = new Path2D();
  for (const [tx, ty] of targets) {
    p.moveTo(from[0], from[1]);
    const mx = (from[0] + tx) / 2;
    const my = (from[1] + ty) / 2 + bend;
    p.quadraticCurveTo(mx, my, tx, ty);
  }
  return p;
}

interface WingPaths {
  fore: Path2D;
  hind: Path2D;
  costa: Path2D;
  foreVeins: Path2D;
  hindVeins: Path2D;
}

// Built lazily: Path2D only exists in the browser, and this module is also imported by unit tests.
let wingPaths: WingPaths | null = null;
function getWingPaths(): WingPaths {
  wingPaths ??= {
    fore: forewingPath(),
    hind: hindwingPath(),
    costa: costaPath(),
    foreVeins: veinPath([0.03, -0.07], [[0.46, -0.19], [0.45, -0.1], [0.4, -0.01], [0.31, 0.065], [0.18, 0.075]], 0.025),
    hindVeins: veinPath([0.03, 0.0], [[0.34, 0.1], [0.31, 0.22], [0.21, 0.33], [0.215, 0.6], [0.08, 0.26]], 0.02),
  };
  return wingPaths;
}

function drawEyespot(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0.3, 0, TAU);
  g.fillStyle = "rgba(96,58,86,0.85)";
  g.fill();
  g.beginPath();
  g.ellipse(x, y, rx * 0.72, ry * 0.72, 0.3, 0, TAU);
  g.fillStyle = "rgba(222,186,110,0.95)";
  g.fill();
  g.beginPath();
  g.ellipse(x, y, rx * 0.46, ry * 0.46, 0.3, 0, TAU);
  g.fillStyle = "rgba(236,242,222,0.95)";
  g.fill();
  g.beginPath();
  g.ellipse(x + rx * 0.08, y, rx * 0.12, ry * 0.36, 0.3, 0, TAU);
  g.fillStyle = "rgba(70,46,72,0.8)";
  g.fill();
}

/** Draws one flat right-side wing in wing units; flap frames scale this texture horizontally. */
function drawWing(g: CanvasRenderingContext2D, kind: "fore" | "hind", pal: WingPalette): void {
  const paths = getWingPaths();
  const path = kind === "fore" ? paths.fore : paths.hind;
  const grad = g.createRadialGradient(0.08, 0.0, 0.02, 0.12, 0.02, kind === "fore" ? 0.5 : 0.62);
  grad.addColorStop(0, pal.center);
  grad.addColorStop(0.45, pal.mid);
  grad.addColorStop(1, pal.edge);
  g.fillStyle = grad;
  g.fill(path);

  g.save();
  g.clip(path);
  if (kind === "hind") {
    const tail = g.createLinearGradient(0, 0.26, 0, 0.7);
    tail.addColorStop(0, "rgba(0,0,0,0)");
    tail.addColorStop(0.5, pal.tail);
    tail.addColorStop(1, pal.rim);
    g.fillStyle = tail;
    g.globalAlpha = 0.85;
    g.fillRect(0, 0.24, 0.4, 0.5);
    g.globalAlpha = 1;
  }
  const speck = createRng(kind === "fore" ? 11 : 23);
  for (let i = 0; i < 140; i++) {
    const sx = speck() * 0.5;
    const sy = kind === "fore" ? -0.27 + speck() * 0.37 : -0.04 + speck() * 0.7;
    g.fillStyle = speck() < 0.5 ? "rgba(40,70,60,0.09)" : "rgba(255,255,240,0.1)";
    g.fillRect(sx, sy, 0.008, 0.008);
  }
  g.strokeStyle = "rgba(236,232,170,0.35)";
  g.lineWidth = 0.03;
  g.stroke(path);
  g.strokeStyle = pal.vein;
  g.lineWidth = 0.0055;
  g.stroke(kind === "fore" ? paths.foreVeins : paths.hindVeins);
  if (kind === "fore") drawEyespot(g, 0.24, -0.085, 0.026, 0.033);
  else drawEyespot(g, 0.215, 0.14, 0.035, 0.043);
  g.restore();

  if (kind === "fore") {
    g.strokeStyle = pal.costa;
    g.lineWidth = 0.02;
    g.lineCap = "round";
    g.stroke(paths.costa);
  }
  g.strokeStyle = pal.rim;
  g.globalAlpha = 0.75;
  g.lineWidth = 0.008;
  g.stroke(path);
  g.globalAlpha = 1;
}

function drawAntennae(g: CanvasRenderingContext2D): void {
  g.lineCap = "round";
  for (const s of [-1, 1]) {
    const x0 = s * 0.012;
    const y0 = -0.165;
    const cx = s * 0.035;
    const cy = -0.275;
    const x1 = s * 0.105;
    const y1 = -0.325;
    g.strokeStyle = "rgba(218,196,142,0.95)";
    g.lineWidth = 0.007;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(cx, cy, x1, y1);
    g.stroke();
    g.lineWidth = 0.0032;
    g.strokeStyle = "rgba(226,206,152,0.8)";
    g.beginPath();
    for (let i = 1; i < 11; i++) {
      const t = i / 11;
      const it = 1 - t;
      const px = it * it * x0 + 2 * it * t * cx + t * t * x1;
      const py = it * it * y0 + 2 * it * t * cy + t * t * y1;
      const tx = 2 * it * (cx - x0) + 2 * t * (x1 - cx);
      const ty = 2 * it * (cy - y0) + 2 * t * (y1 - cy);
      const tl = Math.hypot(tx, ty) || 1;
      const nx = -ty / tl;
      const ny = tx / tl;
      const len = 0.026 * Math.sin(Math.PI * Math.min(1, t * 1.15));
      const bx = -tx / tl;
      const by = -ty / tl;
      g.moveTo(px, py);
      g.lineTo(px + (nx + bx * 0.5) * len, py + (ny + by * 0.5) * len);
      g.moveTo(px, py);
      g.lineTo(px + (-nx + bx * 0.5) * len, py + (-ny + by * 0.5) * len);
    }
    g.stroke();
  }
}

function bodyPath(): Path2D {
  const p = new Path2D();
  p.ellipse(0, 0.075, 0.036, 0.13, 0, 0, TAU);
  p.ellipse(0, -0.075, 0.046, 0.058, 0, 0, TAU);
  p.arc(0, -0.145, 0.03, 0, TAU);
  return p;
}

function drawBody(g: CanvasRenderingContext2D): void {
  const abdomen = g.createLinearGradient(-0.04, 0, 0.04, 0);
  abdomen.addColorStop(0, "#bdb8a8");
  abdomen.addColorStop(0.5, "#f7f3e8");
  abdomen.addColorStop(1, "#c4bfae");
  g.fillStyle = abdomen;
  g.beginPath();
  g.ellipse(0, 0.075, 0.036, 0.13, 0, 0, TAU);
  g.fill();
  g.strokeStyle = "rgba(150,140,120,0.35)";
  g.lineWidth = 0.004;
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const y = 0.0 + i * 0.038;
    g.moveTo(-0.03, y);
    g.quadraticCurveTo(0, y + 0.012, 0.03, y);
  }
  g.stroke();

  const fuzz = g.createRadialGradient(0, -0.075, 0.02, 0, -0.075, 0.085);
  fuzz.addColorStop(0, "rgba(250,248,238,0.9)");
  fuzz.addColorStop(0.6, "rgba(245,242,230,0.55)");
  fuzz.addColorStop(1, "rgba(245,242,230,0)");
  g.fillStyle = fuzz;
  g.fillRect(-0.09, -0.165, 0.18, 0.18);
  g.fillStyle = "#f5f2e6";
  g.beginPath();
  g.ellipse(0, -0.075, 0.046, 0.058, 0, 0, TAU);
  g.fill();
  g.fillStyle = "#ece6d4";
  g.beginPath();
  g.arc(0, -0.145, 0.03, 0, TAU);
  g.fill();
  drawAntennae(g);
}

interface MothSheets {
  cell: number;
  base: HTMLCanvasElement[];
  /** Warm rim light on the outer silhouette edge facing a light; shared by every palette. */
  rimLeft: HTMLCanvasElement;
  rimRight: HTMLCanvasElement;
}

interface UnitBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const WING_BOX: UnitBox = { x0: -0.04, y0: -0.34, x1: 0.56, y1: 0.78 };
const BODY_BOX: UnitBox = { x0: -0.17, y0: -0.38, x1: 0.17, y1: 0.27 };

/** Renders a unit-space drawing into its own texture at u pixels per unit. */
function unitTexture(box: UnitBox, u: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const { canvas, g } = surface((box.x1 - box.x0) * u, (box.y1 - box.y0) * u);
  g.scale(u, u);
  g.translate(-box.x0, -box.y0);
  paint(g);
  return canvas;
}

function drawUnitTexture(g: CanvasRenderingContext2D, tex: HTMLCanvasElement, box: UnitBox): void {
  g.drawImage(tex, box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
}

interface MothTextures {
  fore: HTMLCanvasElement;
  hind: HTMLCanvasElement;
  foreShade: HTMLCanvasElement;
  hindShade: HTMLCanvasElement;
  body: HTMLCanvasElement;
}

// Each wing and the body are painted once; the 12 flap frames only composite scaled copies.
function buildMothSheet(tex: MothTextures, cell: number, shaded: boolean): HTMLCanvasElement {
  const { canvas, g } = surface(cell * FLAP_FRAMES, cell);
  const u = cell / CELL_UNITS;
  g.imageSmoothingQuality = "high";
  for (let k = 0; k < FLAP_FRAMES; k++) {
    const phase = (k / FLAP_FRAMES) * TAU;
    const openF = flapOpenness(phase);
    const openH = flapOpenness(phase - 0.4);
    const bob = Math.sin(phase) * 0.012;
    // Raised forewings sweep slightly forward, so the beat reads as a stroke, not a squash.
    const sweep = 0.11 * (1 - openF);
    g.save();
    g.beginPath();
    g.rect(k * cell, 0, cell, cell);
    g.clip();
    g.translate(k * cell + CELL_ORIGIN_X * u, CELL_ORIGIN_Y * u);
    g.scale(u, u);
    g.translate(0, bob);
    for (const side of [-1, 1]) {
      for (const [wing, shade, open, rot] of [
        [tex.hind, tex.hindShade, openH, sweep * 0.35],
        [tex.fore, tex.foreShade, openF, sweep],
      ] as const) {
        g.save();
        g.rotate(-side * rot);
        g.scale(side * open, 1);
        drawUnitTexture(g, wing, WING_BOX);
        if (shaded) {
          // Raised wings tilt away from the moonlight and read darker.
          g.globalAlpha = (1 - open) * 0.42;
          drawUnitTexture(g, shade, WING_BOX);
        }
        g.restore();
      }
    }
    drawUnitTexture(g, tex.body, BODY_BOX);
    g.restore();
  }
  return canvas;
}

/**
 * Rim light from one side, built from the union silhouette so only the outer
 * edge facing the light glows (never the hindwing edge hidden under the forewing).
 */
function buildRimSheet(silhouette: HTMLCanvasElement, cell: number, side: number): HTMLCanvasElement {
  const w = silhouette.width;
  const h = silhouette.height;
  const edge = surface(w, h);
  edge.g.drawImage(silhouette, 0, 0);
  edge.g.globalCompositeOperation = "destination-out";
  edge.g.drawImage(silhouette, -side * Math.max(1.5, cell * 0.035), 0);
  edge.g.globalCompositeOperation = "source-in";
  edge.g.fillStyle = "rgb(255,214,150)";
  edge.g.fillRect(0, 0, w, h);

  const small = surface(w / 3, h / 3);
  small.g.imageSmoothingQuality = "high";
  small.g.drawImage(edge.canvas, 0, 0, small.canvas.width, small.canvas.height);

  const wash = surface(w, h);
  wash.g.drawImage(silhouette, 0, 0);
  wash.g.globalCompositeOperation = "source-in";
  const u = cell / CELL_UNITS;
  for (let k = 0; k < FLAP_FRAMES; k++) {
    const x0 = k * cell + CELL_ORIGIN_X * u;
    const grad = wash.g.createLinearGradient(x0, 0, side > 0 ? (k + 1) * cell : k * cell, 0);
    grad.addColorStop(0, "rgba(255,190,112,0)");
    grad.addColorStop(1, "rgba(255,190,112,0.16)");
    wash.g.fillStyle = grad;
    wash.g.fillRect(k * cell, 0, cell, h);
  }

  const out = surface(w, h);
  out.g.globalCompositeOperation = "lighter";
  out.g.drawImage(wash.canvas, 0, 0);
  out.g.globalAlpha = 0.85;
  out.g.drawImage(edge.canvas, 0, 0);
  out.g.globalAlpha = 0.9;
  out.g.imageSmoothingQuality = "high";
  out.g.drawImage(small.canvas, 0, 0, w, h);
  release(edge.canvas, small.canvas, wash.canvas);
  return out.canvas;
}

function buildMothSheets(cell: number): MothSheets {
  const u = cell / CELL_UNITS;
  const paths = getWingPaths();
  const fill = (box: UnitBox, path: Path2D, color: string) =>
    unitTexture(box, u, (g) => {
      g.fillStyle = color;
      g.fill(path);
    });
  const foreShade = fill(WING_BOX, paths.fore, "rgb(18,20,58)");
  const hindShade = fill(WING_BOX, paths.hind, "rgb(18,20,58)");
  const body = unitTexture(BODY_BOX, u, drawBody);
  const bodySil = fill(BODY_BOX, bodyPath(), "#fff");
  const wings = PALETTES.map((pal) => ({
    fore: unitTexture(WING_BOX, u, (g) => drawWing(g, "fore", pal)),
    hind: unitTexture(WING_BOX, u, (g) => drawWing(g, "hind", pal)),
  }));
  const base = wings.map((w) => buildMothSheet({ ...w, foreShade, hindShade, body }, cell, true));
  const silhouette = buildMothSheet({ fore: foreShade, hind: hindShade, foreShade, hindShade, body: bodySil }, cell, false);
  const sheets = {
    cell,
    base,
    rimLeft: buildRimSheet(silhouette, cell, -1),
    rimRight: buildRimSheet(silhouette, cell, 1),
  };
  release(foreShade, hindShade, body, bodySil, silhouette, ...wings.flatMap((w) => [w.fore, w.hind]));
  return sheets;
}

/* ------------------------------------------------------------------ */
/* Small light sprites                                                 */
/* ------------------------------------------------------------------ */

function radialSprite(size: number, stops: Array<[number, string]>): HTMLCanvasElement {
  const { canvas, g } = surface(size, size);
  const h = size / 2;
  const grad = g.createRadialGradient(h, h, 0, h, h, h);
  for (const [o, c] of stops) grad.addColorStop(o, c);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return canvas;
}

function meteorSprite(): HTMLCanvasElement {
  const w = 512;
  const h = 32;
  const { canvas, g } = surface(w, h);
  const trail = g.createLinearGradient(0, 0, w, 0);
  trail.addColorStop(0, "rgba(160,180,255,0)");
  trail.addColorStop(0.7, "rgba(200,212,255,0.35)");
  trail.addColorStop(0.97, "rgba(255,250,236,0.95)");
  trail.addColorStop(1, "rgba(255,250,236,0)");
  g.fillStyle = trail;
  g.beginPath();
  g.moveTo(0, h / 2);
  g.lineTo(w - 12, h / 2 - 2.2);
  g.lineTo(w - 12, h / 2 + 2.2);
  g.closePath();
  g.fill();
  const head = g.createRadialGradient(w - 14, h / 2, 0, w - 14, h / 2, h / 2);
  head.addColorStop(0, "rgba(255,252,240,1)");
  head.addColorStop(0.3, "rgba(220,230,255,0.5)");
  head.addColorStop(1, "rgba(200,215,255,0)");
  g.fillStyle = head;
  g.fillRect(w - 30, 0, 30, h);
  return canvas;
}

/* ------------------------------------------------------------------ */
/* Static layers                                                       */
/* ------------------------------------------------------------------ */

type Noise = (x: number, y: number) => number;

/** Milky band density (0..1) as a function of screen position. */
function bandAt(x: number, y: number, layout: MothlightLayout): number {
  const { width, height, short } = layout;
  const nx = x / Math.max(1, width);
  const center = height * (0.36 - 0.34 * nx) + height * 0.05 * Math.sin(nx * 3.1 + 0.6);
  const halfWidth = short * 0.2 + width * 0.04;
  const d = (y - center) / halfWidth;
  return Math.exp(-d * d);
}

function renderNebula(layout: MothlightLayout, noise: Noise, dustNoise: Noise): HTMLCanvasElement {
  const step = 6;
  const gw = Math.ceil(layout.width / step) + 1;
  const gh = Math.ceil(layout.height / step) + 1;
  const { canvas, g } = surface(gw, gh);
  const img = g.createImageData(gw, gh);
  const data = img.data;
  const s = layout.short;
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const X = i * step;
      const Y = j * step;
      const u = X / s;
      const v = Y / s;
      const qx = fbm2D(noise, u * 0.9, v * 0.9, 3);
      const qy = fbm2D(noise, u * 0.9 + 5.2, v * 0.9 + 1.3, 3);
      const n = fbm2D(noise, u * 1.7 + 0.9 * qx, v * 1.7 + 0.9 * qy, 5);
      const band = bandAt(X, Y, layout);
      const core = band * band;
      const cloud = smoothstep(-0.25, 0.75, n);
      const lanes = smoothstep(0.02, 0.36, fbm2D(dustNoise, u * 2.6 + 0.5 * qx, v * 2.6 + 0.5 * qy, 4));
      const ambient = 0.035 * smoothstep(-0.2, 0.9, n);
      const dens = (band * (0.12 + 0.88 * cloud) + core * 0.42) * (1 - 0.45 * lanes * band) + ambient;
      const teal = smoothstep(0.2, 0.7, qy) * 0.6;
      const rose = smoothstep(0.3, 0.75, n) * core * 0.8;
      // The sky warms slightly toward the lantern in the lower left.
      const warm = smoothstep(0.45, 1, (1 - X / layout.width) * 0.5 + (Y / layout.height) * 0.6) * 0.6;
      let r = 36 + (100 - 36) * core;
      let gg = 42 + (94 - 42) * core;
      let b = 100 + (138 - 100) * core;
      r += (26 - r) * teal + 58 * rose;
      gg += (74 - gg) * teal + 18 * rose;
      b += (100 - b) * teal + 20 * rose;
      r += (128 - r) * warm;
      gg += (86 - gg) * warm;
      b += (96 - b) * warm;
      const k = (j * gw + i) * 4;
      const a = dens * 0.42;
      data[k] = r * a;
      data[k + 1] = gg * a;
      data[k + 2] = b * a;
      data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

function drawMoon(g: CanvasRenderingContext2D, layout: MothlightLayout, noise: Noise, dpr: number): void {
  const { x, y, r, ring: withRing } = layout.moon;

  g.globalCompositeOperation = "lighter";
  const halo = g.createRadialGradient(x, y, r * 0.8, x, y, r * 7);
  halo.addColorStop(0, "rgba(185,195,230,0.2)");
  halo.addColorStop(0.18, "rgba(185,195,230,0.09)");
  halo.addColorStop(0.5, "rgba(150,165,220,0.03)");
  halo.addColorStop(1, "rgba(150,165,220,0)");
  g.fillStyle = halo;
  g.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);

  if (withRing) {
    const ringR = r * 3.9;
    const outer = ringR + r * 0.5;
    const ring = g.createRadialGradient(x, y, 0, x, y, outer);
    const at = (d: number) => clamp(d / outer, 0, 1);
    ring.addColorStop(0, "rgba(0,0,0,0)");
    ring.addColorStop(at(ringR - r * 0.35), "rgba(0,0,0,0)");
    ring.addColorStop(at(ringR - r * 0.08), "rgba(214,176,168,0.045)");
    ring.addColorStop(at(ringR + r * 0.05), "rgba(196,208,240,0.055)");
    ring.addColorStop(at(ringR + r * 0.28), "rgba(150,172,236,0.025)");
    ring.addColorStop(1, "rgba(150,172,236,0)");
    g.fillStyle = ring;
    g.fillRect(x - outer, y - outer, outer * 2, outer * 2);
  }

  // Earthshine: the unlit disc is faintly visible, a little brighter toward the crescent.
  g.globalCompositeOperation = "source-over";
  const shine = g.createRadialGradient(x + r * 0.35, y + r * 0.28, 0, x, y, r * 1.02);
  shine.addColorStop(0, "rgba(74,82,122,0.62)");
  shine.addColorStop(0.75, "rgba(46,52,88,0.55)");
  shine.addColorStop(0.97, "rgba(40,46,80,0.5)");
  shine.addColorStop(1, "rgba(40,46,80,0)");
  g.fillStyle = shine;
  g.fillRect(x - r * 1.1, y - r * 1.1, r * 2.2, r * 2.2);

  const size = Math.ceil(r * 2.4 * dpr);
  const lit = surface(size, size);
  const lg = lit.g;
  lg.scale(dpr, dpr);
  const c = (r * 2.4) / 2;
  const disc = lg.createRadialGradient(c + r * 0.35, c + r * 0.25, r * 0.1, c, c, r);
  disc.addColorStop(0, "#fbf7ec");
  disc.addColorStop(0.7, "#f4efe1");
  disc.addColorStop(1, "#ddd3bd");
  lg.fillStyle = disc;
  lg.beginPath();
  lg.arc(c, c, r, 0, TAU);
  lg.fill();

  const tex = surface(40, 40);
  const tImg = tex.g.createImageData(40, 40);
  for (let j = 0; j < 40; j++) {
    for (let i = 0; i < 40; i++) {
      const v = fbm2D(noise, i * 0.09 + 40, j * 0.09 - 12, 4);
      const k = (j * 40 + i) * 4;
      tImg.data[k] = 112;
      tImg.data[k + 1] = 116;
      tImg.data[k + 2] = 112;
      tImg.data[k + 3] = Math.round(smoothstep(-0.1, 0.5, v) * 110);
    }
  }
  tex.g.putImageData(tImg, 0, 0);
  lg.globalCompositeOperation = "source-atop";
  lg.imageSmoothingQuality = "high";
  lg.drawImage(tex.canvas, c - r, c - r, r * 2, r * 2);

  // Carve the crescent with a soft-edged disc so the terminator is gradual.
  lg.globalCompositeOperation = "destination-out";
  const bx = c - r * 0.42;
  const by = c - r * 0.3;
  const bite = lg.createRadialGradient(bx, by, 0, bx, by, r * 1.04);
  bite.addColorStop(0, "rgba(0,0,0,1)");
  bite.addColorStop(0.9, "rgba(0,0,0,1)");
  bite.addColorStop(1, "rgba(0,0,0,0)");
  lg.fillStyle = bite;
  lg.fillRect(0, 0, r * 2.4, r * 2.4);

  g.drawImage(lit.canvas, x - c, y - c, r * 2.4, r * 2.4);
  release(lit.canvas, tex.canvas);

  g.globalCompositeOperation = "lighter";
  const bx2 = x + r * 0.5;
  const by2 = y + r * 0.38;
  const bloom = g.createRadialGradient(bx2, by2, 0, bx2, by2, r * 2.6);
  bloom.addColorStop(0, "rgba(244,239,225,0.34)");
  bloom.addColorStop(0.35, "rgba(214,220,240,0.08)");
  bloom.addColorStop(1, "rgba(185,195,230,0)");
  g.fillStyle = bloom;
  g.fillRect(bx2 - r * 2.6, by2 - r * 2.6, r * 5.2, r * 5.2);
  g.globalCompositeOperation = "source-over";
}

/** One soft, edge-free wash of moonlight falling toward the garden in the lower left. */
function drawMoonWash(g: CanvasRenderingContext2D, layout: MothlightLayout): void {
  const { moon, width, height } = layout;
  const tx = width * 0.3;
  const ty = height * 0.95;
  const len = Math.hypot(tx - moon.x, ty - moon.y);
  g.save();
  g.globalCompositeOperation = "lighter";
  g.translate(moon.x, moon.y);
  g.rotate(Math.atan2(ty - moon.y, tx - moon.x));
  g.scale(1, 0.45);
  const cx = len * 0.42;
  const grad = g.createRadialGradient(cx * 0.3, 0, 0, cx, 0, len * 0.72);
  grad.addColorStop(0, "rgba(176,188,232,0.075)");
  grad.addColorStop(0.45, "rgba(160,176,226,0.035)");
  grad.addColorStop(1, "rgba(150,170,220,0)");
  g.fillStyle = grad;
  g.fillRect(cx - len * 0.8, -len * 0.8, len * 1.6, len * 1.6);
  g.restore();
}

function drawStars(g: CanvasRenderingContext2D, layout: MothlightLayout, star: HTMLCanvasElement): void {
  const { width, height } = layout;
  const rng = createRng(SEED ^ 0x51a7);
  const count = Math.round((width * height) / 1000);
  const tints = ["#dfe5ff", "#dfe5ff", "#eef0ff", "#fff5e4", "#ffdcb4"];
  for (let i = 0; i < count; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const keep = 0.25 + 0.75 * bandAt(x, y, layout);
    const mag = rng() ** 3;
    const tint = tints[Math.floor(rng() * tints.length)];
    if (rng() > keep) continue;
    const vertical = 1 - 0.55 * smoothstep(0.55, 1, y / height);
    g.globalAlpha = (0.18 + 0.72 * mag) * vertical;
    g.fillStyle = tint;
    const rad = 0.3 + 0.85 * mag;
    if (rad < 0.6) g.fillRect(x, y, rad * 1.6, rad * 1.6);
    else {
      g.beginPath();
      g.arc(x, y, rad, 0, TAU);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "lighter";
  const bright = Math.round((width * height) / 70_000) + 4;
  for (let i = 0; i < bright; i++) {
    const x = rng() * width;
    const y = rng() * height * 0.75;
    const s = 4 + rng() * 6;
    g.globalAlpha = 0.35 + rng() * 0.4;
    g.drawImage(star, x - s / 2, y - s / 2, s, s);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
}

function buildMist(layout: MothlightLayout, noise: Noise, offset: number, strength: number): HTMLCanvasElement {
  const step = 8;
  const w = layout.width * 1.3;
  const h = layout.height * 0.5;
  const gw = Math.ceil(w / step) + 1;
  const gh = Math.ceil(h / step) + 1;
  const { canvas, g } = surface(gw, gh);
  const img = g.createImageData(gw, gh);
  const s = layout.short;
  for (let j = 0; j < gh; j++) {
    const fy = j / (gh - 1);
    const envelope = smoothstep(0, 0.55, fy) * (1 - 0.35 * smoothstep(0.85, 1, fy));
    for (let i = 0; i < gw; i++) {
      const u = (i * step) / s;
      const v = (j * step) / s;
      const n = fbm2D(noise, u * 1.3 + offset, v * 3.2 - offset, 4);
      const k = (j * gw + i) * 4;
      img.data[k] = 150;
      img.data[k + 1] = 162;
      img.data[k + 2] = 206;
      img.data[k + 3] = Math.round(smoothstep(-0.35, 0.75, n) * envelope * strength * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

/* ------------------------------------------------------------------ */
/* Plants and lantern                                                  */
/* ------------------------------------------------------------------ */

interface Clump {
  canvas: HTMLCanvasElement;
  x: number;
  anchorX: number;
  w: number;
  h: number;
  front: boolean;
  swayPhase: number;
  swayRate: number;
  swayAmp: number;
  shear: number;
}

interface Flower {
  clump: number;
  lx: number;
  ly: number;
  r: number;
  claimedBy: number;
}

/** Lantern position relative to a clump's base centre, and how far its light reaches. */
interface LocalLight {
  x: number;
  y: number;
  range: number;
}

const WARM = "255,178,108";

function lightAt(light: LocalLight, x: number, y: number): number {
  return Math.max(0, 1 - Math.hypot(light.x - x, light.y - y) / light.range) ** 1.5;
}

function drawMoonflower(g: CanvasRenderingContext2D, x: number, y: number, r: number, tilt: number, warm: number): void {
  const glow = g.createRadialGradient(x, y, 0, x, y, r * 2.6);
  glow.addColorStop(0, warm > 0.05 ? `rgba(${WARM},${(0.12 + 0.14 * warm).toFixed(3)})` : "rgba(196,208,232,0.13)");
  glow.addColorStop(0.45, "rgba(170,186,220,0.04)");
  glow.addColorStop(1, "rgba(170,186,220,0)");
  g.fillStyle = glow;
  g.fillRect(x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  g.scale(1, 0.8);
  const petals = new Path2D();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.9;
    if (i === 0) petals.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else petals.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  petals.closePath();
  const petal = g.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
  petal.addColorStop(0, "#9faa94");
  petal.addColorStop(0.35, "#bec4cc");
  petal.addColorStop(0.85, "#adb4c3");
  petal.addColorStop(1, "#7c859a");
  g.fillStyle = petal;
  g.fill(petals);
  // Moon-side highlight on the upper edge.
  const hi = g.createRadialGradient(r * 0.3, -r * 0.55, 0, r * 0.3, -r * 0.55, r * 1.05);
  hi.addColorStop(0, "rgba(224,232,250,0.5)");
  hi.addColorStop(1, "rgba(224,232,250,0)");
  g.fillStyle = hi;
  g.fill(petals);
  if (warm > 0.02) {
    g.fillStyle = `rgba(${WARM},${(0.42 * warm).toFixed(3)})`;
    g.fill(petals);
  }
  g.strokeStyle = "rgba(140,158,140,0.45)";
  g.lineWidth = Math.max(0.5, r * 0.06);
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2;
    g.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
    g.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
  }
  g.stroke();
  g.fillStyle = "rgba(180,188,128,0.85)";
  g.beginPath();
  g.arc(0, 0, r * 0.16, 0, TAU);
  g.fill();
  g.restore();
}

/** Side-on moonflower: a flared trumpet on a leaning stem tip. */
function drawTrumpet(g: CanvasRenderingContext2D, x: number, y: number, r: number, tilt: number, warm: number): void {
  const len = r * 1.5;
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  const tube = g.createLinearGradient(0, 0, 0, -len);
  tube.addColorStop(0, "#56605e");
  tube.addColorStop(0.55, "#98a0ae");
  tube.addColorStop(1, "#b4bbc8");
  g.fillStyle = tube;
  g.beginPath();
  g.moveTo(-r * 0.1, 0);
  g.quadraticCurveTo(-r * 0.16, -len * 0.62, -r, -len);
  g.lineTo(r, -len);
  g.quadraticCurveTo(r * 0.16, -len * 0.62, r * 0.1, 0);
  g.closePath();
  g.fill();
  g.beginPath();
  g.ellipse(0, -len, r, r * 0.3, 0, 0, TAU);
  g.fillStyle = "#b3bac8";
  g.fill();
  g.beginPath();
  g.ellipse(0, -len + r * 0.03, r * 0.66, r * 0.17, 0, 0, TAU);
  g.fillStyle = "rgba(96,104,122,0.6)";
  g.fill();
  if (warm > 0.02) {
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = `rgba(${WARM},${(0.4 * warm).toFixed(3)})`;
    g.fillRect(-r * 1.1, -len - r * 0.4, r * 2.2, len + r * 0.5);
    g.globalCompositeOperation = "source-over";
  }
  g.restore();
}

function heartLeaf(g: CanvasRenderingContext2D, x: number, y: number, s: number, a: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(-s * 0.5, -s * 0.05, -s * 0.42, -s * 0.62, 0, -s * 1.1);
  g.bezierCurveTo(s * 0.42, -s * 0.62, s * 0.5, -s * 0.05, 0, 0);
  g.fill();
  g.restore();
}

interface Head {
  x: number;
  y: number;
  r: number;
  tilt: number;
  kind: "face" | "trumpet" | "bud";
}

function buildClump(
  rng: () => number,
  w: number,
  h: number,
  dpr: number,
  front: boolean,
  flowerCount: number,
  flowersOut: Array<{ lx: number; ly: number; r: number }>,
  light: LocalLight,
): { canvas: HTMLCanvasElement; anchorX: number; spriteW: number; spriteH: number } {
  const pad = Math.max(24, h * 0.25);
  const spriteW = w + pad * 2;
  const spriteH = h + pad;
  const mask = surface(spriteW * dpr, spriteH * dpr);
  const mg = mask.g;
  mg.scale(dpr, dpr);
  mg.translate(pad + w / 2, spriteH);
  mg.fillStyle = "#fff";
  mg.strokeStyle = "#fff";
  mg.lineCap = "round";

  const blades = Math.max(5, Math.round(w / 6));
  for (let i = 0; i < blades; i++) {
    const bx = (rng() - 0.5) * w;
    const bh = h * (0.35 + rng() * 0.65) * (1 - Math.abs(bx) / w);
    const lean = (rng() - 0.5) * bh * 0.7;
    const bw = 1.2 + rng() * 2.2;
    mg.beginPath();
    mg.moveTo(bx - bw, 0);
    mg.quadraticCurveTo(bx - bw * 0.5 + lean * 0.3, -bh * 0.55, bx + lean, -bh);
    mg.quadraticCurveTo(bx + bw * 0.5 + lean * 0.3, -bh * 0.55, bx + bw, 0);
    mg.closePath();
    mg.fill();
  }

  const heads: Head[] = [];
  for (let f = 0; f < flowerCount; f++) {
    const sx = (rng() - 0.5) * w * 0.5;
    const fx = sx + (rng() - 0.5) * w * 0.5;
    const fy = -h * (0.72 + rng() * 0.3);
    const midX = (sx + fx) / 2 + (rng() - 0.5) * w * 0.4;
    mg.lineWidth = 1.4;
    mg.beginPath();
    mg.moveTo(sx, 0);
    mg.bezierCurveTo(midX, fy * 0.35, fx - (fx - sx) * 0.2, fy * 0.7, fx, fy);
    mg.stroke();
    const leaves = 3 + Math.floor(rng() * 3);
    for (let l = 0; l < leaves; l++) {
      const t = 0.25 + (l / leaves) * 0.6;
      const lx = sx + (fx - sx) * t + (rng() - 0.5) * 6;
      const ly = fy * t;
      heartLeaf(mg, lx, ly, 9 + rng() * 8, (l % 2 ? 1 : -1) * (0.9 + rng() * 0.6));
    }
    const r = clamp(h * 0.07, 6, 12) * (0.6 + rng() * 0.7);
    const trumpet = rng() < 0.35;
    const lean = (rng() < 0.5 ? -1 : 1) * (0.45 + rng() * 0.7);
    heads.push(trumpet ? { x: fx, y: fy, r: r * 0.85, tilt: lean, kind: "trumpet" } : { x: fx, y: fy, r, tilt: (rng() - 0.5) * 0.9, kind: "face" });
    if (rng() < 0.6) {
      const bx = fx + (rng() - 0.5) * 18;
      const by = fy + 10 + rng() * 14;
      mg.lineWidth = 1;
      mg.beginPath();
      mg.moveTo(fx + (bx - fx) * 0.2, fy + (by - fy) * 0.6);
      mg.quadraticCurveTo(bx, by + 6, bx, by);
      mg.stroke();
      heads.push({ x: bx, y: by, r: r * 0.45, tilt: (rng() - 0.5) * 0.8, kind: "bud" });
    }
  }

  const out = surface(spriteW * dpr, spriteH * dpr);
  const og = out.g;
  const scratch: HTMLCanvasElement[] = [];
  const tint = (color: string): HTMLCanvasElement => {
    const t = surface(mask.canvas.width, mask.canvas.height);
    t.g.drawImage(mask.canvas, 0, 0);
    t.g.globalCompositeOperation = "source-in";
    t.g.fillStyle = color;
    t.g.fillRect(0, 0, t.canvas.width, t.canvas.height);
    scratch.push(t.canvas);
    return t.canvas;
  };
  const rim = Math.max(1, dpr * 1.1);
  const cx = 0;
  const cy = -h * 0.55;
  const warm = lightAt(light, cx, cy);
  if (front) og.drawImage(tint("rgba(78,88,146,0.6)"), rim, -rim);
  if (warm > 0.02) {
    // Warm rim on the edges that face the lantern.
    const d = Math.hypot(light.x - cx, light.y - cy) || 1;
    const k = rim * 1.4;
    og.drawImage(tint(`rgba(${WARM},${Math.min(0.9, warm * 1.3).toFixed(3)})`), ((light.x - cx) / d) * k, ((light.y - cy) / d) * k);
  }
  og.drawImage(tint(front ? "#04050d" : "#15173a"), 0, 0);

  og.scale(dpr, dpr);
  og.translate(pad + w / 2, spriteH);
  if (warm > 0.02) {
    // Faint warm bounce on the lit side of the silhouette itself.
    og.globalCompositeOperation = "source-atop";
    const bounce = og.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.range);
    bounce.addColorStop(0, `rgba(150,92,46,${front ? 0.55 : 0.4})`);
    bounce.addColorStop(0.6, "rgba(110,66,36,0.12)");
    bounce.addColorStop(1, "rgba(110,66,36,0)");
    og.fillStyle = bounce;
    og.fillRect(-pad - w / 2, -spriteH, spriteW, spriteH);
    og.globalCompositeOperation = "source-over";
  }
  for (const head of heads) {
    const hw = lightAt(light, head.x, head.y);
    if (head.kind === "face") {
      drawMoonflower(og, head.x, head.y, head.r, head.tilt, hw);
      flowersOut.push({ lx: head.x, ly: head.y, r: head.r });
    } else if (head.kind === "trumpet") {
      drawTrumpet(og, head.x, head.y, head.r, head.tilt, hw);
    } else {
      const br = head.r;
      og.save();
      og.translate(head.x, head.y);
      og.rotate(head.tilt);
      og.fillStyle = hw > 0.05 ? `rgba(206,180,150,0.8)` : "rgba(170,178,168,0.75)";
      og.beginPath();
      og.ellipse(0, 0, br * 0.55, br * 1.5, 0, 0, TAU);
      og.fill();
      og.strokeStyle = "rgba(120,140,118,0.7)";
      og.lineWidth = 0.6;
      og.beginPath();
      og.moveTo(-br * 0.4, br);
      og.quadraticCurveTo(br * 0.6, 0, -br * 0.2, -br * 1.2);
      og.stroke();
      og.restore();
    }
  }
  release(mask.canvas, ...scratch);
  return { canvas: out.canvas, anchorX: pad + w / 2, spriteW, spriteH };
}

interface PlantSet {
  clumps: Clump[];
  flowers: Flower[];
}

function lampLightPoint(layout: MothlightLayout): { x: number; y: number } {
  const { hookX, hookY, chain, size } = layout.lamp;
  return { x: hookX, y: hookY + chain * 1.8 + size * 0.3 };
}

function buildPlants(layout: MothlightLayout, dpr: number): PlantSet {
  const rng = createRng(SEED ^ 0x9f1a);
  const { width, height, plantHeight, flowerDensity } = layout;
  const lamp = lampLightPoint(layout);
  const range = clamp(layout.short * 0.34, 120, 300);
  const clumps: Clump[] = [];
  const flowers: Flower[] = [];

  const addRow = (front: boolean) => {
    let x = -20 + rng() * 20;
    while (x < width + 20) {
      const nx = x / width;
      const edge = Math.abs(nx * 2 - 1);
      const profile = 0.26 + 0.74 * edge ** 1.4;
      const h = plantHeight * profile * (0.75 + rng() * 0.45) * (front ? 1 : 1.12);
      const w = clamp(h * (0.45 + rng() * 0.35), 26, 110);
      const wantsFlower = front && edge > 0.3 && rng() < (0.6 + edge * 0.3) * flowerDensity;
      const flowerCount = wantsFlower ? (edge > 0.7 && rng() < 0.5 * flowerDensity ? 2 : 1) : 0;
      const heads: Array<{ lx: number; ly: number; r: number }> = [];
      const light = { x: lamp.x - x, y: lamp.y - (height + 2), range: front ? range : range * 0.8 };
      const built = buildClump(rng, w, h, dpr, front, flowerCount, heads, light);
      const index = clumps.length;
      clumps.push({
        canvas: built.canvas,
        x,
        anchorX: built.anchorX,
        w: built.spriteW,
        h: built.spriteH,
        front,
        swayPhase: rng() * TAU,
        swayRate: 0.45 + rng() * 0.35,
        swayAmp: (front ? 0.045 : 0.03) * (0.7 + rng() * 0.6),
        shear: 0,
      });
      for (const head of heads) flowers.push({ clump: index, lx: head.lx, ly: head.ly, r: head.r, claimedBy: -1 });
      x += w * (front ? 0.55 : 0.75) * (0.7 + rng() * 0.6);
    }
  };
  addRow(false);
  addRow(true);
  return { clumps, flowers };
}

interface LampSprites {
  post: HTMLCanvasElement;
  postLeft: number;
  postTop: number;
  postW: number;
  postH: number;
  body: HTMLCanvasElement;
  bodyW: number;
  bodyH: number;
}

function buildLamp(layout: MothlightLayout, dpr: number): LampSprites {
  const { height } = layout;
  const { postX, hookX, hookY, size } = layout.lamp;
  const pad = 8;
  const top = hookY - size * 1.3;
  const postLeft = postX - pad;
  const postW = hookX - postX + pad * 2 + size;
  const postH = height - top + pad * 2;
  const post = surface(postW * dpr, postH * dpr);
  const pg = post.g;
  pg.scale(dpr, dpr);
  pg.translate(-postLeft, -top + pad);
  pg.lineCap = "round";
  const lw = clamp(size * 0.16, 2, 4.5);
  const trace = () => {
    pg.beginPath();
    pg.moveTo(postX, height + 10);
    pg.lineTo(postX, top + size * 0.9);
    pg.quadraticCurveTo(postX, top, postX + size * 0.9, top);
    pg.lineTo(hookX - size * 0.5, top);
    pg.quadraticCurveTo(hookX, top, hookX, top + size * 0.55);
    pg.lineTo(hookX, hookY);
  };
  pg.strokeStyle = "rgba(96,108,168,0.6)";
  pg.lineWidth = lw;
  pg.save();
  pg.translate(-1, -1);
  trace();
  pg.stroke();
  pg.restore();
  // Warm edge on the faces that see the lantern.
  const light = lampLightPoint(layout);
  const warm = pg.createRadialGradient(light.x, light.y, 0, light.x, light.y, size * 7);
  warm.addColorStop(0, `rgba(${WARM},0.95)`);
  warm.addColorStop(0.5, `rgba(${WARM},0.35)`);
  warm.addColorStop(1, `rgba(${WARM},0)`);
  pg.strokeStyle = warm;
  pg.save();
  pg.translate(lw * 0.4, lw * 0.4);
  trace();
  pg.stroke();
  pg.restore();
  pg.strokeStyle = "#04050d";
  trace();
  pg.stroke();
  pg.lineWidth = lw * 0.6;
  pg.beginPath();
  pg.moveTo(postX, top + size * 1.2);
  pg.quadraticCurveTo(postX + size * 0.5, top + size * 0.4, postX + size * 1.3, top);
  pg.stroke();

  const bodyW = size * 1.6;
  const bodyH = size * 2.6;
  const body = surface(bodyW * dpr, bodyH * dpr);
  const bg = body.g;
  bg.scale(dpr, dpr);
  bg.translate(bodyW / 2, 0);
  const s = size;
  bg.fillStyle = "#05060e";
  bg.strokeStyle = "#05060e";
  bg.lineWidth = Math.max(1, s * 0.07);
  bg.beginPath();
  bg.arc(0, s * 0.12, s * 0.1, 0, TAU);
  bg.stroke();
  bg.beginPath();
  bg.moveTo(-s * 0.18, s * 0.22);
  bg.lineTo(s * 0.18, s * 0.22);
  bg.lineTo(s * 0.62, s * 0.62);
  bg.lineTo(-s * 0.62, s * 0.62);
  bg.closePath();
  bg.fill();
  // Warm underside of the roof.
  bg.fillStyle = "rgba(196,128,70,0.55)";
  bg.fillRect(-s * 0.56, s * 0.58, s * 1.12, s * 0.05);
  const glass = bg.createLinearGradient(-s * 0.5, 0, s * 0.5, 0);
  glass.addColorStop(0, "#b77d45");
  glass.addColorStop(0.5, "#ffe2ae");
  glass.addColorStop(1, "#c08449");
  bg.fillStyle = glass;
  bg.beginPath();
  bg.moveTo(-s * 0.46, s * 0.66);
  bg.lineTo(s * 0.46, s * 0.66);
  bg.lineTo(s * 0.38, s * 1.9);
  bg.lineTo(-s * 0.38, s * 1.9);
  bg.closePath();
  bg.fill();
  bg.fillStyle = "rgba(255,248,226,0.9)";
  bg.beginPath();
  bg.ellipse(0, s * 1.45, s * 0.1, s * 0.2, 0, 0, TAU);
  bg.fill();
  bg.strokeStyle = "#05060e";
  bg.lineWidth = Math.max(0.8, s * 0.06);
  bg.beginPath();
  bg.moveTo(0, s * 0.66);
  bg.lineTo(0, s * 1.9);
  bg.stroke();
  bg.fillStyle = "#05060e";
  bg.fillRect(-s * 0.5, s * 1.88, s, s * 0.16);
  bg.beginPath();
  bg.moveTo(-s * 0.3, s * 2.04);
  bg.lineTo(s * 0.3, s * 2.04);
  bg.lineTo(0, s * 2.3);
  bg.closePath();
  bg.fill();
  return { post: post.canvas, postLeft, postTop: top - pad, postW, postH, body: body.canvas, bodyW, bodyH };
}

/* ------------------------------------------------------------------ */
/* Simulation                                                          */
/* ------------------------------------------------------------------ */

type Goal = "wander" | "moon" | "lamp" | "pointer" | "flower";
type Phase = "fly" | "dart" | "retreat" | "rest" | "takeoff";

interface Moth {
  id: number;
  far: boolean;
  type: number;
  depth: number;
  x: number;
  y: number;
  heading: number;
  /** On-screen rotation of the sprite (see displayAngle). */
  disp: number;
  speed: number;
  cruise: number;
  turn: number;
  flapPhase: number;
  flapRate: number;
  flapping: boolean;
  glideTimer: number;
  goal: Goal;
  goalTimer: number;
  side: number;
  phase: Phase;
  phaseTimer: number;
  retreatHeading: number;
  anchorX: number;
  anchorY: number;
  flower: number;
  restClock: number;
  restTilt: number;
  restCooldown: number;
  warm: number;
  litX: number;
  dustCarry: number;
  sepX: number;
  sepY: number;
  /** Personal orbit: size, flattening, axis tilt and precession rate. */
  orbitScale: number;
  orbitAspect: number;
  orbitTilt: number;
  precess: number;
}

interface Dust {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  age: Float32Array;
  life: Float32Array;
  size: Float32Array;
  count: number;
}

interface Meteor {
  active: boolean;
  x: number;
  y: number;
  angle: number;
  speed: number;
  length: number;
  age: number;
  life: number;
}

interface Twinkle {
  x: number;
  y: number;
  size: number;
  rate: number;
  phase: number;
  base: number;
}

interface Built {
  layout: MothlightLayout;
  dpr: number;
  /** Sky, moon, moonlight wash, back plants and back mist, composited once. */
  back: HTMLCanvasElement;
  backClumps: Clump[];
  mistBack: HTMLCanvasElement;
  mistFront: HTMLCanvasElement;
  plants: PlantSet;
  lamp: LampSprites;
  twinkles: Twinkle[];
}

interface AvoidRect extends Rect {
  /** Opaque cards: moths are hidden behind them rather than clashing with glyphs, so they are avoided more gently. */
  soft: boolean;
}

export interface MothlightOptions {
  /** Text the moths must keep clear of (title, subtitle, notes, chips). */
  avoid?: string;
  /** Opaque cards moths should prefer to fly around. */
  avoidSoft?: string;
  /** Pointer targets over which the pointer lantern does not light (text, cards, controls). */
  pointerBlock?: string;
}

export function createMothlightScene(canvas: HTMLCanvasElement, container: HTMLElement, options: MothlightOptions = {}): SceneHandle {
  const noise = createNoise2D(SEED);
  const dustNoise = createNoise2D(SEED ^ 0x2b2b);
  const flightNoise = createNoise2D(SEED ^ 0x77);
  const rng = createRng(SEED ^ 0x3c3c);

  const star = radialSprite(32, [
    [0, "rgba(255,255,255,1)"],
    [0.12, "rgba(236,240,255,0.85)"],
    [0.35, "rgba(200,212,255,0.18)"],
    [1, "rgba(170,190,255,0)"],
  ]);
  const meteorImg = meteorSprite();
  const glow = radialSprite(256, [
    [0, "rgba(255,230,186,0.9)"],
    [0.07, "rgba(246,200,138,0.6)"],
    [0.25, "rgba(207,154,94,0.24)"],
    [0.55, "rgba(207,154,94,0.07)"],
    [1, "rgba(207,154,94,0)"],
  ]);
  const pool = radialSprite(128, [
    [0, "rgba(236,170,104,0.5)"],
    [0.4, "rgba(207,140,84,0.2)"],
    [1, "rgba(207,140,84,0)"],
  ]);
  const mothGlow = radialSprite(64, [
    [0, "rgba(196,232,196,0.5)"],
    [0.35, "rgba(190,220,204,0.16)"],
    [1, "rgba(170,200,200,0)"],
  ]);
  const mote = radialSprite(32, [
    [0, "rgba(232,244,240,0.95)"],
    [0.2, "rgba(200,226,232,0.4)"],
    [1, "rgba(170,200,226,0)"],
  ]);
  const dot = radialSprite(16, [
    [0, "rgba(255,244,214,1)"],
    [0.35, "rgba(250,220,168,0.55)"],
    [1, "rgba(240,200,140,0)"],
  ]);

  let built: Built | null = null;
  let sheets: MothSheets | null = null;
  let nebulaKey = "";
  let nebula: HTMLCanvasElement | null = null;
  let scale = 1;
  let prevW = 0;
  let prevH = 0;
  let scrollTop = 0;
  let pointerBlocked = false;
  let pointerMoths = 0;

  /* ---------------- page text and cards ---------------- */

  const measureAvoid = (): AvoidRect[] => {
    const out: AvoidRect[] = [];
    const sy = window.scrollY;
    const add = (selector: string | undefined, soft: boolean) => {
      if (!selector) return;
      for (const el of document.querySelectorAll(selector)) {
        const b = el.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) continue;
        out.push({ x: b.left, y: b.top + sy, w: b.width, h: b.height, soft });
      }
    };
    add(options.avoid, false);
    add(options.avoidSoft, true);
    return out;
  };
  /** Document-space rects; each frame subtracts the scroll offset. */
  let avoidDoc = measureAvoid();

  const moths: Moth[] = [];
  const dust: Dust = {
    x: new Float32Array(MAX_DUST),
    y: new Float32Array(MAX_DUST),
    vx: new Float32Array(MAX_DUST),
    vy: new Float32Array(MAX_DUST),
    age: new Float32Array(MAX_DUST),
    life: new Float32Array(MAX_DUST),
    size: new Float32Array(MAX_DUST),
    count: 0,
  };
  const meteor: Meteor = { active: false, x: 0, y: 0, angle: 0, speed: 0, length: 0, age: 0, life: 1 };
  let nextMeteorAt = 5 + rng() * 6;

  const lantern = { x: 0, y: 0, intensity: 0, lastX: -1, lastY: -1, movedAt: 0, lingerUntil: -1 };
  const lampState = { x: 0, y: 0, angle: 0, flicker: 1 };

  const range = (lo: number, hi: number) => lo + rng() * (hi - lo);

  const push = { x: 0, y: 0, inside: false };
  /** Steering away from page text (and gently from cards) near (x, y) in viewport space. */
  const avoidPush = (x: number, y: number, span: number, L: MothlightLayout) => {
    push.x = 0;
    push.y = 0;
    push.inside = false;
    const pad = span * 0.75 + 6;
    for (const r of avoidDoc) {
      // A card nearly as wide as the screen cannot be flown around; moths just pass behind it.
      if (r.soft && r.w > L.width * 0.75) continue;
      const top = r.y - scrollTop;
      if (top > L.height + pad || top + r.h < -pad) continue;
      const weight = r.soft ? 0.6 : 1;
      const p = r.soft ? pad * 0.6 : pad;
      const qx = clamp(x, r.x, r.x + r.w);
      const qy = clamp(y, top, top + r.h);
      const dx = x - qx;
      const dy = y - qy;
      const d = Math.hypot(dx, dy);
      if (d > 0) {
        if (d < p) {
          const k = (1 - d / p) * 2.4 * weight;
          push.x += (dx / d) * k;
          push.y += (dy / d) * k;
        }
        continue;
      }
      const l = x - r.x;
      const rr = r.x + r.w - x;
      const t = y - top;
      const b = top + r.h - y;
      const mn = Math.min(l, rr, t, b);
      const k = 3 * weight;
      if (mn === l) push.x -= k;
      else if (mn === rr) push.x += k;
      else if (mn === t) push.y -= k;
      else push.y += k;
      if (!r.soft) push.inside = true;
    }
  };

  const isClear = (x: number, y: number, pad: number, L: MothlightLayout): boolean => {
    for (const r of avoidDoc) {
      if (r.soft && r.w > L.width * 0.75) continue;
      if (rectDistance(x, y + scrollTop, r) < pad) return false;
    }
    return true;
  };

  const pickAnchor = (m: Moth, L: MothlightLayout) => {
    const { width: W, height: H, margin: mg } = L;
    const pad = L.mothSpan * m.depth;
    for (let attempt = 0; attempt < 12; attempt++) {
      const zone = m.far ? (rng() < 0.7 ? 0 : 1 + Math.floor(rng() * 2)) : Math.floor(rng() * 4);
      if (zone === 0) {
        m.anchorX = range(mg, W - mg);
        m.anchorY = range(mg, H * 0.28);
      } else if (zone === 1) {
        m.anchorX = range(mg, Math.max(mg + 1, W * 0.2));
        m.anchorY = range(H * 0.15, H - mg);
      } else if (zone === 2) {
        m.anchorX = range(Math.min(W - mg - 1, W * 0.8), W - mg);
        m.anchorY = range(H * 0.15, H - mg);
      } else {
        m.anchorX = range(mg, W - mg);
        m.anchorY = range(H * 0.68, H - mg);
      }
      if (isClear(m.anchorX, m.anchorY, pad, L)) return;
    }
  };

  const releaseFlower = (m: Moth) => {
    if (m.flower >= 0 && built) {
      const f = built.plants.flowers[m.flower];
      if (f && f.claimedBy === m.id) f.claimedBy = -1;
    }
    m.flower = -1;
  };

  const flowerX = (f: Flower): number => {
    if (!built) return 0;
    const c = built.plants.clumps[f.clump];
    return c.x + f.lx + c.shear * f.ly;
  };
  const flowerY = (f: Flower): number => (built ? built.layout.height + 2 + f.ly : 0);
  /** Front-row flowers fully on screen; flowers clipped by an edge are never landing spots. */
  const landable = (f: Flower): boolean => {
    if (!built || !built.plants.clumps[f.clump].front) return false;
    const x = flowerX(f);
    const { width, margin } = built.layout;
    return x > margin && x < width - margin;
  };

  const claimFlower = (m: Moth): boolean => {
    if (!built) return false;
    const free: number[] = [];
    built.plants.flowers.forEach((f, i) => {
      if (f.claimedBy < 0 && landable(f)) free.push(i);
    });
    if (free.length === 0) return false;
    let best = free[0];
    let bestD = Infinity;
    for (const i of free) {
      const d = Math.hypot(flowerX(built.plants.flowers[i]) - m.x, flowerY(built.plants.flowers[i]) - m.y) * (0.6 + rng() * 0.8);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    built.plants.flowers[best].claimedBy = m.id;
    m.flower = best;
    return true;
  };

  const setGoal = (m: Moth, goal: Goal) => {
    if (m.goal === "flower" && goal !== "flower") releaseFlower(m);
    m.goal = goal;
    m.goalTimer = range(8, 18);
    m.side = rng() < 0.5 ? 1 : -1;
    if (goal === "flower" && !claimFlower(m)) m.goal = "wander";
    if (m.goal === "wander" && built) pickAnchor(m, built.layout);
  };

  const pickGoal = (m: Moth): Goal => {
    const r = rng();
    // A moon squeezed between page text has little room to circle; send fewer moths there.
    const L = built?.layout;
    const room = L ? clamp(Math.min(L.moonOrbit.rx, L.moonOrbit.ry) / (L.mothSpan * 1.6), 0.3, 1) : 1;
    if (m.far) return r < 0.5 * room ? "moon" : "wander";
    if (r < 0.3) return "lamp";
    if (r < 0.3 + 0.18 * room) return "moon";
    if (r < 0.72 && m.restCooldown <= 0) return "flower";
    return "wander";
  };

  const spawnMoths = (L: MothlightLayout) => {
    const total = L.nearMoths + L.farMoths;
    for (let i = 0; i < total; i++) {
      const far = i >= L.nearMoths;
      const depth = far ? range(0.36, 0.52) : range(0.72, 1.12);
      const m: Moth = {
        id: i,
        far,
        type: i % PALETTES.length,
        depth,
        x: 0,
        y: 0,
        heading: range(-Math.PI, Math.PI),
        disp: 0,
        speed: 0,
        cruise: (far ? 38 : 70) * depth * (0.85 + rng() * 0.3) * clamp(L.short / 800, 0.7, 1.15),
        turn: 0,
        flapPhase: rng() * TAU,
        flapRate: far ? range(4.2, 5.6) : range(3.0, 4.2),
        flapping: true,
        glideTimer: range(1, 4),
        goal: "wander",
        goalTimer: 0,
        side: 1,
        phase: "fly",
        phaseTimer: 0,
        retreatHeading: 0,
        anchorX: 0,
        anchorY: 0,
        flower: -1,
        restClock: rng() * TAU,
        restTilt: 0,
        restCooldown: range(2, 10),
        warm: 0,
        litX: 0,
        dustCarry: 0,
        sepX: 0,
        sepY: 0,
        orbitScale: range(0.75, 1.25),
        orbitAspect: range(0.62, 1),
        orbitTilt: range(0, Math.PI),
        precess: (rng() < 0.5 ? -1 : 1) * range(0.05, 0.14),
      };
      pickAnchor(m, L);
      m.x = m.anchorX;
      m.y = m.anchorY;
      m.speed = m.cruise;
      m.disp = displayAngle(m.heading);
      moths.push(m);
      setGoal(m, i === 0 ? "lamp" : pickGoal(m));
    }
  };

  const emitDust = (x: number, y: number, vx: number, vy: number, span: number) => {
    let i = dust.count;
    if (i >= MAX_DUST) {
      // Recycle a random slot rather than growing the pool.
      i = Math.floor(rng() * MAX_DUST);
    } else {
      dust.count++;
    }
    dust.x[i] = x + (rng() - 0.5) * span * 0.6;
    dust.y[i] = y + (rng() - 0.5) * span * 0.3;
    dust.vx[i] = vx * 0.15 + (rng() - 0.5) * 14;
    dust.vy[i] = vy * 0.1 + 6 + rng() * 12;
    dust.age[i] = 0;
    dust.life[i] = 1.4 + rng() * 1.8;
    dust.size[i] = 0.7 + rng() * 1.5;
  };

  const light = { x: 0, y: 0, rx: 0, ry: 0, rot: 0, tx: 0, ty: 0, bump: 0 };
  /** Fills `light` with the moth's personal orbit around its light and the point it darts at. */
  const lightTarget = (m: Moth, L: MothlightLayout, t: number) => {
    if (m.goal === "moon") {
      const s = m.orbitScale * (m.far ? 1.15 : 1);
      light.x = L.moon.x;
      light.y = L.moon.y;
      light.rx = L.moonOrbit.rx * Math.min(1, s);
      light.ry = L.moonOrbit.ry * Math.min(1, s * m.orbitAspect + 0.2);
      light.rot = 0.3 * Math.sin(t * m.precess * 2 + m.orbitTilt);
      light.tx = light.x;
      light.ty = light.y;
      light.bump = 0;
      return;
    }
    const pointer = m.goal === "pointer";
    const cx = pointer ? lantern.x : lampState.x;
    const cy = pointer ? lantern.y : lampState.y;
    const base = pointer ? L.lampOrbit * 0.85 : L.lampOrbit;
    const radius = base * m.orbitScale;
    const o = fitOrbit(cx, cy, radius, radius, L);
    light.x = o.x;
    light.y = o.y;
    light.rx = o.rx;
    light.ry = o.ry * m.orbitAspect;
    light.rot = m.orbitTilt + t * m.precess;
    light.tx = cx;
    light.ty = pointer ? cy : cy + L.lamp.size * 0.5;
    light.bump = pointer ? 8 : L.lamp.size * 0.9;
  };

  const stepMoth = (m: Moth, dt: number, t: number, L: MothlightLayout) => {
    const span = L.mothSpan * m.depth;
    m.goalTimer -= dt;
    m.phaseTimer -= dt;
    m.restCooldown -= dt;

    const pointerOn = lantern.intensity > 0.3;
    if (
      !m.far &&
      pointerOn &&
      m.goal !== "pointer" &&
      (m.phase === "fly" || m.phase === "rest") &&
      pointerMoths < MAX_POINTER_MOTHS &&
      rng() < dt * 1.2
    ) {
      const dp = Math.hypot(lantern.x - m.x, lantern.y - m.y);
      if (dp < Math.hypot(L.width, L.height) * (0.3 + rng() * 0.35)) {
        if (m.phase === "rest") {
          m.phase = "takeoff";
          m.phaseTimer = 0.7;
          m.heading = -Math.PI / 2 + range(-0.5, 0.5);
          m.restCooldown = range(8, 16);
        }
        setGoal(m, "pointer");
        pointerMoths++;
      }
    }
    if (m.goal === "pointer" && lantern.intensity < 0.12) setGoal(m, pickGoal(m));
    if (m.goalTimer <= 0 && m.phase === "fly") setGoal(m, pickGoal(m));

    if (m.phase === "rest") {
      const f = built ? built.plants.flowers[m.flower] : undefined;
      if (!f) {
        m.phase = "fly";
      } else {
        const c = built!.plants.clumps[f.clump];
        m.x = flowerX(f);
        m.y = flowerY(f) - f.r * 0.25;
        m.heading = -Math.PI / 2 + m.restTilt + c.shear * 0.8;
        m.disp = m.restTilt + c.shear * 0.8;
        m.restClock += dt * (TAU / 4.6);
        m.speed = 0;
        if (m.phaseTimer <= 0) {
          m.phase = "takeoff";
          m.phaseTimer = 0.8;
          m.heading = -Math.PI / 2 + range(-0.6, 0.6);
          m.restCooldown = range(10, 20);
          setGoal(m, rng() < 0.5 ? "wander" : "lamp");
        }
        return;
      }
    }

    let desired = m.heading;
    let speedMul = 1;
    let maxTurn = m.far ? 2.2 : 3.0;
    let forceFlap = false;
    let nearFlower = false;

    if (m.phase === "takeoff") {
      desired = -Math.PI / 2;
      speedMul = 0.8;
      forceFlap = true;
      if (m.phaseTimer <= 0) m.phase = "fly";
    } else if (m.phase === "retreat") {
      desired = m.retreatHeading;
      speedMul = 1.6;
      maxTurn = 5;
      forceFlap = true;
      if (m.phaseTimer <= 0) m.phase = "fly";
    } else if (m.goal === "flower" && m.flower >= 0 && built) {
      const f = built.plants.flowers[m.flower];
      const fx = flowerX(f);
      const fy = flowerY(f) - f.r * 0.25;
      const d = Math.hypot(fx - m.x, fy - m.y);
      desired = Math.atan2(fy - m.y, fx - m.x);
      speedMul = clamp(d / 160, 0.3, 1);
      maxTurn = 4.5;
      nearFlower = d < 60;
      if (d < 50) {
        const pull = Math.min(1, dt * (2 + (50 - d) * 0.08));
        m.x += (fx - m.x) * pull;
        m.y += (fy - m.y) * pull;
      }
      if (d < 3 + span * 0.05) {
        m.phase = "rest";
        m.phaseTimer = range(8, 16);
        m.restTilt = range(-0.3, 0.3);
        m.restClock = 0;
        m.disp = m.restTilt;
        return;
      }
    } else if (m.goal === "wander") {
      const d = Math.hypot(m.anchorX - m.x, m.anchorY - m.y);
      if (d < 50) pickAnchor(m, L);
      desired = Math.atan2(m.anchorY - m.y, m.anchorX - m.x) + flightNoise(m.id * 5.3, t * 0.12) * 1.1;
    } else {
      lightTarget(m, L, t);
      if (m.phase === "dart") {
        desired = Math.atan2(light.ty - m.y, light.tx - m.x);
        speedMul = 1.5;
        maxTurn = 7;
        forceFlap = true;
        if (Math.hypot(light.tx - m.x, light.ty - m.y) < light.bump + span * 0.2 || m.phaseTimer <= 0) {
          m.phase = "retreat";
          m.phaseTimer = range(0.4, 0.8);
          m.retreatHeading = desired + Math.PI + range(-0.7, 0.7);
          for (let k = 0; k < 7; k++) emitDust(m.x, m.y, 0, 0, span);
        }
      } else {
        // Steer along the moth's own tilted ellipse, in the ellipse's normalized frame.
        const c = Math.cos(light.rot);
        const s = Math.sin(light.rot);
        const rx = Math.max(8, light.rx);
        const ry = Math.max(8, light.ry);
        const dx = m.x - light.x;
        const dy = m.y - light.y;
        const lx = (dx * c + dy * s) / rx;
        const ly = (-dx * s + dy * c) / ry;
        const d = Math.hypot(lx, ly) || 1e-3;
        const alpha = clamp(Math.PI / 2 - 1.15 * (d - 1), 0.3, 2.3);
        const a = Math.atan2(-ly, -lx) - m.side * alpha;
        const ux = Math.cos(a) * rx;
        const uy = Math.sin(a) * ry;
        desired = Math.atan2(ux * s + uy * c, ux * c - uy * s);
        if (light.bump > 0 && Math.abs(d - 1) < 0.45 && rng() < dt * 0.3) {
          m.phase = "dart";
          m.phaseTimer = 0.9;
        }
      }
    }

    // Soft inward push near the screen edges, away from page text, and away from other moths.
    const zone = L.margin * 2;
    let px = 0;
    let py = 0;
    if (m.x < zone) px += (zone - m.x) / zone;
    if (m.x > L.width - zone) px -= (m.x - (L.width - zone)) / zone;
    if (m.y < zone) py += (zone - m.y) / zone;
    if (m.y > L.height - zone) py -= (m.y - (L.height - zone)) / zone;
    avoidPush(m.x, m.y, span, L);
    const sep = nearFlower ? 0 : 1;
    const vx = Math.cos(desired) + px * 2.2 + push.x + m.sepX * sep;
    const vy = Math.sin(desired) + py * 2.2 + push.y + m.sepY * sep;
    if (vx !== Math.cos(desired) || vy !== Math.sin(desired)) desired = Math.atan2(vy, vx);
    if (push.inside) maxTurn = Math.max(maxTurn, 5);

    const diff = wrapAngle(desired - m.heading);
    const turbulence = flightNoise(t * 0.55 + m.id * 17.1, m.id * 3.3) * (m.phase === "fly" ? 1.1 : 0.4);
    const targetTurn = clamp(diff * 3.2, -maxTurn, maxTurn) + turbulence;
    m.turn += (targetTurn - m.turn) * Math.min(1, dt * 6);
    m.heading = wrapAngle(m.heading + m.turn * dt);
    m.disp += (displayAngle(m.heading) - m.disp) * Math.min(1, dt * 5);

    m.glideTimer -= dt;
    const hardTurn = Math.abs(m.turn) > 1.5;
    if (m.flapping) {
      if (!forceFlap && m.glideTimer <= 0 && !hardTurn) {
        m.flapping = false;
        m.glideTimer = range(0.5, 1.3);
      }
    } else if (forceFlap || hardTurn || m.glideTimer <= 0) {
      m.flapping = true;
      m.glideTimer = range(1.6, 4.5);
    }

    if (m.flapping) {
      const burst = 1 + 0.7 * Math.min(1, Math.abs(m.turn) / 2.5) + (forceFlap ? 0.35 : 0);
      m.flapPhase += TAU * m.flapRate * burst * dt;
    } else {
      const into = m.flapPhase % TAU;
      const remaining = into === 0 ? 0 : TAU - into;
      const stepSize = TAU * m.flapRate * 0.8 * dt;
      m.flapPhase += Math.min(remaining, stepSize);
    }
    if (m.flapPhase > TAU * 1000) m.flapPhase %= TAU;

    const targetSpeed = m.cruise * speedMul * (m.flapping ? 1 : 0.85) * (push.inside ? 1.3 : 1);
    m.speed += (targetSpeed - m.speed) * Math.min(1, dt * 2.5);
    m.x += Math.cos(m.heading) * m.speed * dt;
    m.y += Math.sin(m.heading) * m.speed * dt + (m.flapping ? 0 : 7 * m.depth * dt);
    m.x = clamp(m.x, -20, L.width + 20);
    m.y = clamp(m.y, -20, L.height + 20);
  };

  const separate = (L: MothlightLayout) => {
    for (const m of moths) {
      m.sepX = 0;
      m.sepY = 0;
    }
    for (let i = 0; i < moths.length; i++) {
      const a = moths[i];
      if (a.phase === "rest") continue;
      for (let j = i + 1; j < moths.length; j++) {
        const b = moths[j];
        if (b.phase === "rest" || a.far !== b.far) continue;
        const lim = L.mothSpan * 1.2 * Math.max(a.depth, b.depth);
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= lim * lim) continue;
        const d = Math.sqrt(d2) || 1e-3;
        const k = (1 - d / lim) * 1.6;
        a.sepX += (dx / d) * k;
        a.sepY += (dy / d) * k;
        b.sepX -= (dx / d) * k;
        b.sepY -= (dy / d) * k;
      }
    }
  };

  const warmLight = (m: Moth, L: MothlightLayout, dt: number) => {
    let wx = 0;
    let wy = 0;
    let total = 0;
    const lampRange = clamp(L.short * 0.26, 100, 240);
    const dxl = lampState.x - m.x;
    const dyl = lampState.y - m.y;
    const dl = Math.hypot(dxl, dyl) || 1;
    const fl = Math.max(0, 1 - dl / lampRange) ** 2 * lampState.flicker;
    total += fl;
    wx += (dxl / dl) * fl;
    wy += (dyl / dl) * fl;
    if (lantern.intensity > 0.01) {
      const dxp = lantern.x - m.x;
      const dyp = lantern.y - m.y;
      const dp = Math.hypot(dxp, dyp) || 1;
      const fp = Math.max(0, 1 - dp / (lampRange * 1.1)) ** 2 * lantern.intensity;
      total += fp;
      wx += (dxp / dp) * fp;
      wy += (dyp / dp) * fp;
    }
    const warm = Math.min(1, total * 1.4);
    const wl = Math.hypot(wx, wy) || 1;
    // Sprite +x maps to world (cos disp, sin disp): the moth's right side on screen.
    const local = (wx / wl) * Math.cos(m.disp) + (wy / wl) * Math.sin(m.disp);
    const k = Math.min(1, dt * 5);
    if (dt === 0) {
      m.warm = warm;
      m.litX = local;
    } else {
      m.warm += (warm - m.warm) * k;
      m.litX += (local - m.litX) * k;
    }
  };

  const stepDust = (dt: number, t: number) => {
    let i = 0;
    while (i < dust.count) {
      dust.age[i] += dt;
      if (dust.age[i] >= dust.life[i]) {
        const last = dust.count - 1;
        dust.x[i] = dust.x[last];
        dust.y[i] = dust.y[last];
        dust.vx[i] = dust.vx[last];
        dust.vy[i] = dust.vy[last];
        dust.age[i] = dust.age[last];
        dust.life[i] = dust.life[last];
        dust.size[i] = dust.size[last];
        dust.count--;
        continue;
      }
      dust.vy[i] += 5 * dt;
      dust.vx[i] *= 1 - Math.min(1, dt * 0.8);
      dust.x[i] += (dust.vx[i] + Math.sin(t * 1.3 + i) * 4) * dt;
      dust.y[i] += dust.vy[i] * dt;
      i++;
    }
  };

  const updateLights = (t: number, dt: number, pointer: Readonly<PointerState>, L: MothlightLayout) => {
    const { hookX, hookY, chain } = L.lamp;
    lampState.angle = 0.06 * Math.sin(t * 0.7) + 0.03 * noise(t * 0.25, 9.1);
    lampState.flicker = 0.93 + 0.07 * noise(t * 0.6, 3.7);
    lampState.x = hookX - Math.sin(lampState.angle) * chain * 1.8;
    lampState.y = hookY + Math.cos(lampState.angle) * chain * 1.8;

    if (pointer.x !== lantern.lastX || pointer.y !== lantern.lastY) {
      lantern.lastX = pointer.x;
      lantern.lastY = pointer.y;
      lantern.movedAt = t;
    }
    const mouse = pointer.type === "mouse";
    const free = !pointerBlocked;
    if (!mouse && pointer.active && free) lantern.lingerUntil = t + TOUCH_LINGER_S;
    const idle = mouse && t - lantern.movedAt > MOUSE_IDLE_FADE_S;
    const target = (pointer.active && free && !idle) || (!mouse && t < lantern.lingerUntil) ? 1 : 0;
    if (lantern.intensity < 0.02 && target > 0) {
      lantern.x = pointer.x;
      lantern.y = pointer.y;
    }
    // Over text or cards the lantern stays where it was and fades, instead of trailing onto the glyphs.
    if (free) {
      const follow = Math.min(1, dt * 9);
      lantern.x += (pointer.x - lantern.x) * follow;
      lantern.y += (pointer.y - lantern.y) * follow;
    }
    const rate = target > lantern.intensity ? 2.6 : 1.6;
    lantern.intensity += clamp(target - lantern.intensity, -rate * dt, rate * dt);
  };

  const step = (f: Readonly<SceneFrame>) => {
    if (!built) return;
    const L = built.layout;
    const { t, dt } = f;
    scrollTop = window.scrollY;
    for (const c of built.plants.clumps) {
      if (!c.front) continue;
      const gust = fbm2D(noise, c.x * 0.0022 - t * 0.12, 7.7, 2);
      c.shear = Math.sin(t * c.swayRate + c.swayPhase) * c.swayAmp + gust * c.swayAmp * 1.4;
    }
    updateLights(t, dt, f.pointer, L);
    pointerMoths = 0;
    for (const m of moths) if (m.goal === "pointer") pointerMoths++;
    separate(L);
    for (const m of moths) {
      stepMoth(m, dt, t, L);
      if (m.far) continue;
      warmLight(m, L, dt);
      if (m.warm > 0.08 && m.phase !== "rest") {
        m.dustCarry += dt * m.warm * (m.flapping ? 16 : 6);
        while (m.dustCarry >= 1) {
          m.dustCarry -= 1;
          emitDust(m.x, m.y, Math.cos(m.heading) * m.speed, Math.sin(m.heading) * m.speed, L.mothSpan * m.depth);
        }
      }
    }
    stepDust(dt, t);

    if (meteor.active) {
      meteor.age += dt;
      meteor.x += Math.cos(meteor.angle) * meteor.speed * dt;
      meteor.y += Math.sin(meteor.angle) * meteor.speed * dt;
      if (meteor.age >= meteor.life) meteor.active = false;
    } else if (t >= nextMeteorAt) {
      const leftward = rng() < 0.5;
      meteor.active = true;
      meteor.x = leftward ? range(L.width * 0.35, L.width * 0.95) : range(L.width * 0.05, L.width * 0.65);
      meteor.y = range(L.height * 0.02, L.height * 0.28);
      meteor.angle = leftward ? Math.PI - range(0.3, 0.6) : range(0.3, 0.6);
      meteor.speed = range(520, 860) * clamp(L.short / 800, 0.6, 1.1);
      meteor.length = range(110, 210) * clamp(L.short / 800, 0.6, 1.1);
      meteor.age = 0;
      meteor.life = range(0.7, 1.2);
      nextMeteorAt = t + range(8, 20);
    }
  };

  const composeStill = () => {
    if (!built) return;
    const L = built.layout;
    const still = createRng(SEED ^ 0x5717);
    scrollTop = window.scrollY;
    const flowers = built.plants.flowers;
    for (const f of flowers) f.claimedBy = -1;
    for (const c of built.plants.clumps) c.shear = 0;
    lampState.angle = 0;
    lampState.flicker = 1;
    lampState.x = L.lamp.hookX;
    lampState.y = L.lamp.hookY + L.lamp.chain * 1.8;
    lantern.intensity = 0;
    meteor.active = false;
    dust.count = 0;
    const order = flowers
      .map((f, i) => ({ i, x: flowerX(f), ok: landable(f) }))
      .filter((e) => e.ok)
      .sort((a, b) => a.x - b.x);
    // One moth rests on the far-right flower and one mid-screen, away from the lantern's crowd.
    const picks: typeof order = [];
    if (order.length > 0) picks.push(order[order.length - 1]);
    if (order.length > 1) {
      const clear = order.filter((e) => e.x > L.lamp.hookX + L.lampOrbit * 2 && Math.abs(e.x - picks[0].x) > L.mothSpan * 3);
      const mid = clear.length ? clear : order.slice(0, -1);
      picks.push(mid.reduce((best, e) => (Math.abs(e.x - L.width * 0.55) < Math.abs(best.x - L.width * 0.55) ? e : best)));
    }
    let nextPick = 0;
    const lampOrbit = fitOrbit(lampState.x, lampState.y, L.lampOrbit, L.lampOrbit * 0.8, L);
    // Poses spread around each light on their own radii, never evenly spaced clones or overlapping pairs.
    const lampAngles = [-0.45, 0.5, -1.25, 1.2, -2.0];
    const moonAngles = [0.62 * Math.PI, 0.95 * Math.PI, 0.3 * Math.PI, 1.3 * Math.PI];
    let lampSlot = 0;
    let moonSlot = 0;
    const placed: Array<{ x: number; y: number; r: number }> = [];
    // The lantern post is an obstacle too: moths posed beside it must not hide behind the pole.
    for (let y = L.lamp.hookY - L.lamp.size; y <= L.lamp.hookY + L.lamp.size * 4; y += L.lamp.size * 1.2) {
      placed.push({ x: L.lamp.postX, y, r: L.mothSpan * 0.3 });
    }
    const spaced = (x: number, y: number, r: number) => placed.every((p) => Math.hypot(p.x - x, p.y - y) >= (p.r + r) * 1.25);
    for (const m of moths) {
      m.flower = -1;
      m.warm = 0;
      m.turn = 0;
      const reach = (L.mothSpan * m.depth) / 2;
      if (!m.far && nextPick < picks.length) {
        const f = flowers[picks[nextPick].i];
        f.claimedBy = m.id;
        m.flower = picks[nextPick].i;
        m.goal = "flower";
        m.phase = "rest";
        m.restTilt = nextPick === 0 ? 0.18 : -0.22;
        m.restClock = nextPick === 0 ? Math.PI / 2 - 0.35 : -0.6;
        m.x = flowerX(f);
        m.y = flowerY(f) - f.r * 0.25;
        m.heading = -Math.PI / 2 + m.restTilt;
        m.disp = m.restTilt;
        nextPick++;
      } else {
        const onMoon = m.far || moonSlot < lampSlot;
        const radius = 0.8 + still() * 0.4;
        let a = onMoon ? moonAngles[moonSlot % moonAngles.length] : lampAngles[lampSlot % lampAngles.length];
        const cx = onMoon ? L.moon.x : lampOrbit.x;
        const cy = onMoon ? L.moon.y : lampOrbit.y;
        const rx = (onMoon ? L.moonOrbit.rx : lampOrbit.rx) * radius;
        const ry = (onMoon ? L.moonOrbit.ry : lampOrbit.ry) * radius;
        for (let tries = 0; tries < 16; tries++) {
          m.x = clamp(cx + Math.cos(a) * rx, L.margin + reach, L.width - L.margin - reach);
          m.y = clamp(cy + Math.sin(a) * ry, L.margin + reach, L.height - L.margin - reach);
          if (isClear(m.x, m.y, L.mothSpan * m.depth, L) && spaced(m.x, m.y, reach)) break;
          a += 0.7;
        }
        m.goal = onMoon ? "moon" : "lamp";
        m.phase = "fly";
        m.heading = a + Math.PI / 2 + (still() - 0.5) * 0.6;
        m.disp = displayAngle(m.heading);
        m.flapPhase = TAU * (Math.floor(still() * 5) / FLAP_FRAMES);
        if (onMoon) moonSlot++;
        else lampSlot++;
      }
      placed.push({ x: m.x, y: m.y, r: reach });
      if (!m.far) warmLight(m, L, 0);
    }
  };

  /* ---------------- drawing ---------------- */

  const drawMoth = (ctx: CanvasRenderingContext2D, m: Moth, L: MothlightLayout) => {
    if (!sheets) return;
    const span = L.mothSpan * m.depth;
    const k = scale;
    if (m.far) {
      // Distant moths read as pale motes that pulse softly with their wingbeat.
      const s = span * 0.55;
      ctx.setTransform(k, 0, 0, k, m.x * k, m.y * k);
      ctx.globalAlpha = 0.34 + 0.08 * Math.cos(m.flapPhase);
      ctx.drawImage(mote, -s / 2, -s / 2, s, s);
      return;
    }
    let frameIndex: number;
    let open: number;
    if (m.phase === "rest") {
      open = 0.62 + 0.38 * Math.sin(m.restClock);
      frameIndex = frameForOpenness(open);
    } else {
      frameIndex = Math.floor(((((m.flapPhase % TAU) + TAU) % TAU) / TAU) * FLAP_FRAMES) % FLAP_FRAMES;
      open = flapOpenness((frameIndex / FLAP_FRAMES) * TAU);
    }
    const c = Math.cos(m.disp);
    const s = Math.sin(m.disp);
    const bank = m.phase === "rest" ? 1 : 1 - 0.22 * Math.min(1, Math.abs(m.turn) / 3);
    ctx.setTransform(c * bank * k, s * bank * k, -s * k, c * k, m.x * k, m.y * k);
    const cell = sheets.cell;
    const size = span * CELL_UNITS;
    const ox = -CELL_ORIGIN_X * span;
    const oy = -CELL_ORIGIN_Y * span;
    const sx = frameIndex * cell;
    const halo = span * 1.5;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.2;
    ctx.drawImage(mothGlow, -halo / 2, -halo / 2 + span * 0.08, halo, halo);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(sheets.base[m.type], sx, 0, cell, cell, ox, oy, size, size);
    const side = Math.abs(m.litX);
    const fade = smoothstep(0, 0.4, side);
    if (m.warm > 0.03 && fade > 0.01) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.min(1, m.warm * (0.35 + 0.75 * side)) * fade;
      ctx.drawImage(m.litX >= 0 ? sheets.rimRight : sheets.rimLeft, sx, 0, cell, cell, ox, oy, size, size);
      const gx = (m.litX >= 0 ? 1 : -1) * 0.4 * open * span;
      const glint = span * 0.3;
      ctx.globalAlpha = Math.min(1, m.warm * side * 0.7) * fade;
      ctx.drawImage(star, gx - glint / 2, -0.19 * span - glint / 2, glint, glint);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, f: Readonly<SceneFrame>, still: boolean) => {
    if (!built || !sheets) return;
    const B = built;
    const L = B.layout;
    const { width: W, height: H } = L;
    const k = scale;
    const t = f.t;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(B.back, 0, 0, W, H);

    ctx.globalCompositeOperation = "lighter";
    for (const tw of B.twinkles) {
      const a = still ? tw.base : tw.base * (0.55 + 0.45 * Math.sin(t * tw.rate + tw.phase));
      ctx.globalAlpha = a;
      ctx.drawImage(star, tw.x - tw.size / 2, tw.y - tw.size / 2, tw.size, tw.size);
    }

    if (meteor.active && !still) {
      const p = meteor.age / meteor.life;
      const env = Math.sin(Math.PI * p);
      const len = meteor.length * (0.4 + 0.6 * Math.min(1, p * 2));
      const c = Math.cos(meteor.angle);
      const s = Math.sin(meteor.angle);
      ctx.setTransform(c * k, s * k, -s * k, c * k, meteor.x * k, meteor.y * k);
      ctx.globalAlpha = env * 0.9;
      ctx.drawImage(meteorImg, -len, -len * 0.035, len * 1.03, len * 0.07);
    }

    for (const m of moths) if (m.far) drawMoth(ctx, m, L);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    // Garden lantern: glow, pointer lantern, post, swinging body.
    const lampGlow = clamp(L.short * 0.42, 150, 380) * (still ? 1 : 0.97 + 0.03 * lampState.flicker);
    ctx.globalAlpha = 0.8 * lampState.flicker;
    ctx.drawImage(glow, lampState.x - lampGlow, lampState.y + L.lamp.size * 0.3 - lampGlow, lampGlow * 2, lampGlow * 2);
    if (lantern.intensity > 0.005) {
      const pg = clamp(L.short * 0.26, 100, 250) * (0.85 + 0.15 * lantern.intensity);
      ctx.globalAlpha = 0.75 * lantern.intensity;
      ctx.drawImage(glow, lantern.x - pg, lantern.y - pg, pg * 2, pg * 2);
      const core = 14;
      ctx.globalAlpha = 0.85 * lantern.intensity;
      ctx.drawImage(dot, lantern.x - core / 2, lantern.y - core / 2, core, core);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    const lamp = B.lamp;
    ctx.drawImage(lamp.post, lamp.postLeft, lamp.postTop, lamp.postW, lamp.postH);
    const ca = Math.cos(lampState.angle);
    const sa = Math.sin(lampState.angle);
    ctx.setTransform(ca * k, sa * k, -sa * k, ca * k, L.lamp.hookX * k, L.lamp.hookY * k);
    ctx.strokeStyle = "#05060e";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, L.lamp.chain * 1.8 - L.lamp.size * 0.9);
    ctx.stroke();
    ctx.drawImage(lamp.body, -lamp.bodyW / 2, L.lamp.chain * 1.8 - L.lamp.size, lamp.bodyW, lamp.bodyH);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    for (const m of moths) if (!m.far && m.phase !== "rest") drawMoth(ctx, m, L);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    const mistShift = still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.016 + 2);
    ctx.drawImage(B.mistFront, -W * 0.3 * mistShift, H * 0.62, W * 1.3, H * 0.38);

    // Warm pool of lantern light on the mist under the lamp.
    const poolW = clamp(L.short * 0.34, 120, 300);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.75 * lampState.flicker;
    ctx.drawImage(pool, lampState.x - poolW, H - L.plantHeight * 0.34 - poolW * 0.24, poolW * 2, poolW * 0.48);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    const baseY = H + 2;
    for (const c of B.plants.clumps) {
      if (!c.front) continue;
      ctx.setTransform(k, 0, c.shear * k, k, c.x * k, baseY * k);
      ctx.drawImage(c.canvas, -c.anchorX, -c.h, c.w, c.h);
    }
    ctx.setTransform(k, 0, 0, k, 0, 0);

    for (const m of moths) if (!m.far && m.phase === "rest") drawMoth(ctx, m, L);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    if (dust.count > 0) {
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < dust.count; i++) {
        const life = 1 - dust.age[i] / dust.life[i];
        const s = dust.size[i] * 3;
        ctx.globalAlpha = life * life * 0.9;
        ctx.drawImage(dot, dust.x[i] - s / 2, dust.y[i] - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  };

  /** Paints every static layer into one screen-sized image. */
  const paintBack = (L: MothlightLayout, dpr: number, backClumps: Clump[], mistBack: HTMLCanvasElement): HTMLCanvasElement => {
    const { width: W, height: H } = L;
    const { canvas: back, g } = surface(W * dpr, H * dpr);
    g.scale(dpr, dpr);
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#06071a");
    sky.addColorStop(0.5, "#0a0b22");
    sky.addColorStop(0.85, "#111131");
    sky.addColorStop(1, "#141236");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    if (nebula) {
      g.globalCompositeOperation = "lighter";
      g.imageSmoothingQuality = "high";
      g.drawImage(nebula, 0, 0, nebula.width * 6, nebula.height * 6);
      g.globalCompositeOperation = "source-over";
    }
    drawStars(g, L, star);
    const diag = Math.hypot(W, H);
    const vignette = g.createRadialGradient(W / 2, H * 0.46, diag * 0.22, W / 2, H * 0.5, diag * 0.72);
    vignette.addColorStop(0, "rgba(3,3,12,0)");
    vignette.addColorStop(1, "rgba(3,3,12,0.62)");
    g.fillStyle = vignette;
    g.fillRect(0, 0, W, H);
    drawMoonWash(g, L);
    drawMoon(g, L, noise, dpr);
    for (const c of backClumps) g.drawImage(c.canvas, c.x - c.anchorX, H + 2 - c.h, c.w, c.h);
    g.drawImage(mistBack, -W * 0.15, H * 0.5, W * 1.3, H * 0.5);
    return back;
  };

  const rebuild = (size: Readonly<SceneSize>) => {
    const L = computeLayout(size.width, size.height, avoidDoc);
    const dpr = size.dpr;
    const nh = Math.ceil(L.height / 160) * 160;
    const key = `${Math.round(L.width)}x${nh}`;
    if (!nebula || key !== nebulaKey) {
      if (nebula) release(nebula);
      nebula = renderNebula({ ...L, height: nh }, noise, dustNoise);
      nebulaKey = key;
    }
    const cell = Math.ceil(L.mothSpan * 1.15 * CELL_UNITS * dpr);
    if (!sheets || sheets.cell !== cell) sheets = buildMothSheets(cell);

    const twRng = createRng(SEED ^ 0x7e11);
    const twinkles: Twinkle[] = [];
    const twCount = Math.round(clamp((L.width * L.height) / 50_000, 8, 28));
    for (let i = 0; i < twCount; i++) {
      twinkles.push({
        x: twRng() * L.width,
        y: twRng() * L.height * 0.7,
        size: 5 + twRng() * 6,
        rate: TAU / (2.5 + twRng() * 5),
        phase: twRng() * TAU,
        base: 0.35 + twRng() * 0.45,
      });
    }

    const oldFlowers = built?.plants.flowers;
    const plants = buildPlants(L, dpr);
    const backClumps = plants.clumps.filter((c) => !c.front);
    const mistBack = buildMist(L, noise, 3.1, 0.22);
    if (built) release(built.back);
    built = {
      layout: L,
      dpr,
      back: paintBack(L, dpr, backClumps, mistBack),
      backClumps,
      mistBack,
      mistFront: buildMist(L, dustNoise, 8.4, 0.14),
      plants,
      lamp: buildLamp(L, dpr),
      twinkles,
    };

    if (moths.length === 0) {
      spawnMoths(L);
    } else {
      const sx = prevW > 0 ? L.width / prevW : 1;
      const sy = prevH > 0 ? L.height / prevH : 1;
      for (const m of moths) {
        m.x *= sx;
        m.y *= sy;
        m.anchorX *= sx;
        m.anchorY *= sy;
        // Flower indices are stable for the same width; otherwise land again elsewhere.
        const keep = m.flower >= 0 && oldFlowers && oldFlowers.length === built.plants.flowers.length;
        if (m.flower >= 0 && keep) built.plants.flowers[m.flower].claimedBy = m.id;
        else if (m.flower >= 0) {
          m.flower = -1;
          if (m.phase === "rest") m.phase = "fly";
          if (m.goal === "flower") setGoal(m, "wander");
        }
      }
    }
    prevW = L.width;
    prevH = L.height;
    lampState.x = L.lamp.hookX;
    lampState.y = L.lamp.hookY + L.lamp.chain * 1.8;
  };

  /** Page text moved or resized (fonts loaded, profile chip shown): re-place the moon if needed. */
  const relayout = (): boolean => {
    if (!built) return false;
    const old = built.layout;
    const L = computeLayout(old.width, old.height, avoidDoc);
    const moved =
      Math.abs(L.moon.x - old.moon.x) + Math.abs(L.moon.y - old.moon.y) + Math.abs(L.moon.r - old.moon.r) > 1 || L.moon.ring !== old.moon.ring;
    built.layout = L;
    if (moved) {
      release(built.back);
      built.back = paintBack(L, built.dpr, built.backClumps, built.mistBack);
    }
    return moved;
  };

  const handle = createScene({
    canvas,
    container,
    dprCap: DPR_CAP,
    resize(size, ctx) {
      scale = ctx.canvas.width / size.width;
      rebuild(size);
    },
    render(ctx, frame) {
      step(frame);
      draw(ctx, frame, false);
    },
    reducedMotionFrame(ctx, frame) {
      composeStill();
      draw(ctx, frame, true);
    },
    onPointer(_pointer, event) {
      if (event.type !== "pointermove" && event.type !== "pointerdown") return;
      const target = event.target;
      pointerBlocked = !!options.pointerBlock && target instanceof Element && target.closest(options.pointerBlock) !== null;
    },
  });

  let started = false;
  let avoidTimer: ReturnType<typeof setTimeout> | undefined;
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const selectors = [options.avoid, options.avoidSoft].filter((s): s is string => !!s).join(",");
  const avoidObserver =
    selectors && typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          clearTimeout(avoidTimer);
          avoidTimer = setTimeout(() => {
            avoidDoc = measureAvoid();
            // A still frame is only redrawn on demand; start() repaints it.
            if (relayout() && started && reduceQuery.matches) handle.start();
          }, 120);
        })
      : null;
  if (avoidObserver) for (const el of document.querySelectorAll(selectors)) avoidObserver.observe(el);

  return {
    start() {
      started = true;
      handle.start();
    },
    stop() {
      started = false;
      handle.stop();
    },
    destroy() {
      started = false;
      clearTimeout(avoidTimer);
      avoidObserver?.disconnect();
      handle.destroy();
    },
  };
}
