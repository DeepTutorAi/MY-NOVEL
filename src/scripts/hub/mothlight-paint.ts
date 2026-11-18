// Painting for the mothlight hub scene: luna-moth flap sheets, the moon, the sky and hanging
// garden planes, and the stage, mid and ground set pieces with their live lanterns and
// moonflowers. Every offscreen canvas comes from the kit's surfaces ledger (alloc/free), so a
// resize or destroy releases it.

import { createRng, fbm2D } from "../_shared/scene-runtime";
import { FLAP_FRAMES, TAU, flapOpenness, moonShape, type GroundLayout, type MidLayout, type StageLayout } from "./mothlight-core";
import { paintDither } from "./scene-paint";
import { clamp, smoothstep } from "./world/geom";
import type { Surface } from "./world/types";

export type Alloc = (w: number, h: number) => Surface;
export type Free = (s: Surface) => void;
type G = CanvasRenderingContext2D;
export type Noise = (x: number, y: number) => number;

export const WARM = "255,184,112";
const INK = "#05040c";

/* ---------------------------------------------------------------- moth sheets */

/** A sheet cell spans this many wingspan units; the body centre sits at (CELL_OX, CELL_OY). */
export const CELL_UNITS = 1.36;
export const CELL_OX = 0.68;
export const CELL_OY = 0.56;

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
export const PALETTE_COUNT = PALETTES.length;

interface WingPaths {
  fore: Path2D;
  hind: Path2D;
  costa: Path2D;
  foreVeins: Path2D;
  hindVeins: Path2D;
  body: Path2D;
}

function veins(from: [number, number], targets: Array<[number, number]>, bend: number): Path2D {
  const p = new Path2D();
  for (const [tx, ty] of targets) {
    p.moveTo(from[0], from[1]);
    p.quadraticCurveTo((from[0] + tx) / 2, (from[1] + ty) / 2 + bend, tx, ty);
  }
  return p;
}

// Built lazily: Path2D exists only in the browser.
let paths: WingPaths | null = null;
function wingPaths(): WingPaths {
  if (paths) return paths;
  const fore = new Path2D();
  fore.moveTo(0.02, -0.11);
  fore.bezierCurveTo(0.12, -0.215, 0.34, -0.27, 0.5, -0.225);
  fore.quadraticCurveTo(0.475, -0.19, 0.478, -0.15);
  fore.bezierCurveTo(0.47, -0.08, 0.42, -0.005, 0.35, 0.055);
  fore.bezierCurveTo(0.25, 0.105, 0.11, 0.07, 0.02, 0.005);
  fore.closePath();
  const hind = new Path2D();
  hind.moveTo(0.02, -0.035);
  hind.bezierCurveTo(0.17, -0.035, 0.365, 0.01, 0.372, 0.15);
  hind.bezierCurveTo(0.376, 0.24, 0.3, 0.29, 0.235, 0.33);
  hind.bezierCurveTo(0.255, 0.42, 0.3, 0.52, 0.24, 0.615);
  hind.quadraticCurveTo(0.205, 0.69, 0.168, 0.628);
  hind.bezierCurveTo(0.195, 0.53, 0.145, 0.42, 0.105, 0.31);
  hind.bezierCurveTo(0.07, 0.2, 0.04, 0.12, 0.02, 0.06);
  hind.closePath();
  const costa = new Path2D();
  costa.moveTo(0.02, -0.11);
  costa.bezierCurveTo(0.12, -0.215, 0.34, -0.27, 0.49, -0.225);
  const body = new Path2D();
  body.ellipse(0, 0.075, 0.036, 0.13, 0, 0, TAU);
  body.ellipse(0, -0.075, 0.046, 0.058, 0, 0, TAU);
  body.arc(0, -0.145, 0.03, 0, TAU);
  paths = {
    fore,
    hind,
    costa,
    body,
    foreVeins: veins([0.03, -0.07], [[0.46, -0.19], [0.45, -0.1], [0.4, -0.01], [0.31, 0.065], [0.18, 0.075]], 0.025),
    hindVeins: veins([0.03, 0], [[0.34, 0.1], [0.31, 0.22], [0.21, 0.33], [0.215, 0.6], [0.08, 0.26]], 0.02),
  };
  return paths;
}

function eyespot(g: G, x: number, y: number, rx: number, ry: number): void {
  const ring = (k: number, color: string, dx = 0) => {
    g.beginPath();
    g.ellipse(x + dx, y, rx * k, ry * k, 0.3, 0, TAU);
    g.fillStyle = color;
    g.fill();
  };
  ring(1, "rgba(96,58,86,0.85)");
  ring(0.72, "rgba(222,186,110,0.95)");
  ring(0.46, "rgba(236,242,222,0.95)");
  g.beginPath();
  g.ellipse(x + rx * 0.08, y, rx * 0.12, ry * 0.36, 0.3, 0, TAU);
  g.fillStyle = "rgba(70,46,72,0.8)";
  g.fill();
}

function paintWing(g: G, kind: "fore" | "hind", pal: WingPalette): void {
  const p = wingPaths();
  const path = kind === "fore" ? p.fore : p.hind;
  const grad = g.createRadialGradient(0.08, 0, 0.02, 0.12, 0.02, kind === "fore" ? 0.5 : 0.62);
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
  g.stroke(kind === "fore" ? p.foreVeins : p.hindVeins);
  if (kind === "fore") eyespot(g, 0.24, -0.085, 0.026, 0.033);
  else eyespot(g, 0.215, 0.14, 0.035, 0.043);
  g.restore();
  if (kind === "fore") {
    g.strokeStyle = pal.costa;
    g.lineWidth = 0.02;
    g.lineCap = "round";
    g.stroke(p.costa);
  }
  g.strokeStyle = pal.rim;
  g.globalAlpha = 0.75;
  g.lineWidth = 0.008;
  g.stroke(path);
  g.globalAlpha = 1;
}

function paintBody(g: G): void {
  const abdomen = g.createLinearGradient(-0.04, 0, 0.04, 0);
  abdomen.addColorStop(0, "#bdb8a8");
  abdomen.addColorStop(0.5, "#f7f3e8");
  abdomen.addColorStop(1, "#c4bfae");
  g.fillStyle = abdomen;
  g.beginPath();
  g.ellipse(0, 0.075, 0.036, 0.13, 0, 0, TAU);
  g.fill();
  const fuzz = g.createRadialGradient(0, -0.075, 0.02, 0, -0.075, 0.085);
  fuzz.addColorStop(0, "rgba(250,248,238,0.9)");
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
  g.lineCap = "round";
  for (const s of [-1, 1]) {
    const [x0, y0, cx, cy, x1, y1] = [s * 0.012, -0.165, s * 0.035, -0.275, s * 0.105, -0.325];
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
      const len = 0.026 * Math.sin(Math.PI * Math.min(1, t * 1.15));
      g.moveTo(px, py);
      g.lineTo(px - len * 0.9, py + len * 0.2);
      g.moveTo(px, py);
      g.lineTo(px + len * 0.9, py + len * 0.2);
    }
    g.stroke();
  }
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const WING_BOX: Box = { x0: -0.04, y0: -0.34, x1: 0.56, y1: 0.78 };
const BODY_BOX: Box = { x0: -0.17, y0: -0.38, x1: 0.17, y1: 0.27 };

export interface MothSheets {
  cell: number;
  base: Surface[];
  /** Warm rim light on the outer edge facing a light, from the left or the right. */
  rimL: Surface;
  rimR: Surface;
}

/** Staged build of the flap sheets: shared textures, one step per palette, then the rims. */
export function mothSheetSteps(cell: number, alloc: Alloc, free: Free, done: (s: MothSheets) => void): (() => void)[] {
  const u = cell / CELL_UNITS;
  const temps: Surface[] = [];
  const tex = (box: Box, paint: (g: G) => void) => {
    const s = alloc((box.x1 - box.x0) * u, (box.y1 - box.y0) * u);
    s.g.scale(u, u);
    s.g.translate(-box.x0, -box.y0);
    paint(s.g);
    temps.push(s);
    return s.canvas;
  };
  const put = (g: G, t: HTMLCanvasElement, b: Box) => g.drawImage(t, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  const fill = (box: Box, path: () => Path2D, color: string) =>
    tex(box, (g) => {
      g.fillStyle = color;
      g.fill(path());
    });
  const sheet = (fore: HTMLCanvasElement, hind: HTMLCanvasElement, body: HTMLCanvasElement, shade: [HTMLCanvasElement, HTMLCanvasElement] | null) => {
    const s = alloc(cell * FLAP_FRAMES, cell);
    const g = s.g;
    g.imageSmoothingQuality = "high";
    for (let k = 0; k < FLAP_FRAMES; k++) {
      const phase = (k / FLAP_FRAMES) * TAU;
      const openF = flapOpenness(phase);
      const openH = flapOpenness(phase - 0.4);
      const sweep = 0.11 * (1 - openF);
      g.save();
      g.beginPath();
      g.rect(k * cell, 0, cell, cell);
      g.clip();
      g.translate(k * cell + CELL_OX * u, CELL_OY * u);
      g.scale(u, u);
      g.translate(0, Math.sin(phase) * 0.012);
      for (const side of [-1, 1]) {
        for (const [wing, sh, open, rot] of [
          [hind, shade?.[1], openH, sweep * 0.35],
          [fore, shade?.[0], openF, sweep],
        ] as const) {
          g.save();
          g.rotate(-side * rot);
          g.scale(side * open, 1);
          put(g, wing, WING_BOX);
          if (sh) {
            // Raised wings tilt away from the moon and read darker.
            g.globalAlpha = (1 - open) * 0.42;
            put(g, sh, WING_BOX);
            g.globalAlpha = 1;
          }
          g.restore();
        }
      }
      put(g, body, BODY_BOX);
      g.restore();
    }
    return s;
  };
  let shadeF: HTMLCanvasElement;
  let shadeH: HTMLCanvasElement;
  let body: HTMLCanvasElement;
  const base: Surface[] = [];
  const rim = (sil: Surface, side: number): Surface => {
    const w = sil.canvas.width;
    const h = sil.canvas.height;
    const edge = alloc(w, h);
    edge.g.drawImage(sil.canvas, 0, 0);
    edge.g.globalCompositeOperation = "destination-out";
    edge.g.drawImage(sil.canvas, -side * Math.max(1.5, cell * 0.035), 0);
    edge.g.globalCompositeOperation = "source-in";
    edge.g.fillStyle = "rgb(255,214,150)";
    edge.g.fillRect(0, 0, w, h);
    const out = alloc(w, h);
    out.g.drawImage(sil.canvas, 0, 0);
    out.g.globalCompositeOperation = "source-in";
    for (let k = 0; k < FLAP_FRAMES; k++) {
      const x0 = k * cell + CELL_OX * u;
      const grad = out.g.createLinearGradient(x0, 0, side > 0 ? (k + 1) * cell : k * cell, 0);
      grad.addColorStop(0, "rgba(255,190,112,0)");
      grad.addColorStop(1, "rgba(255,190,112,0.18)");
      out.g.fillStyle = grad;
      out.g.fillRect(k * cell, 0, cell, h);
    }
    out.g.globalCompositeOperation = "lighter";
    out.g.globalAlpha = 0.9;
    out.g.drawImage(edge.canvas, 0, 0);
    free(edge);
    return out;
  };
  return [
    () => {
      const p = wingPaths();
      shadeF = fill(WING_BOX, () => p.fore, "rgb(18,20,58)");
      shadeH = fill(WING_BOX, () => p.hind, "rgb(18,20,58)");
      body = tex(BODY_BOX, paintBody);
    },
    ...PALETTES.map((pal) => () => {
      const fore = tex(WING_BOX, (g) => paintWing(g, "fore", pal));
      const hind = tex(WING_BOX, (g) => paintWing(g, "hind", pal));
      base.push(sheet(fore, hind, body, [shadeF, shadeH]));
    }),
    () => {
      const sil = sheet(shadeF, shadeH, fill(BODY_BOX, () => wingPaths().body, "#fff"), null);
      const sheets = { cell, base, rimL: rim(sil, -1), rimR: rim(sil, 1) };
      free(sil);
      for (const t of temps) free(t);
      done(sheets);
    },
  ];
}

/* ---------------------------------------------------------------- moon */

/**
 * The moon disc for a phase: earthshine on the dark limb, the lit part with mare texture, and a
 * soft inner bloom. The crescent lies tilted the way it does in the tropics. Returns the sprite
 * and its CSS size (the disc sits at its centre).
 */
export function paintMoon(alloc: Alloc, r: number, dpr: number, phase: number, noise: Noise): { s: Surface; size: number } {
  const size = r * 3;
  const s = alloc(size * dpr, size * dpr);
  const g = s.g;
  g.scale(dpr, dpr);
  const c = size / 2;
  const { k, waxing } = moonShape(phase);
  // Earthshine.
  const shine = g.createRadialGradient(c + r * 0.3, c + r * 0.2, 0, c, c, r);
  shine.addColorStop(0, "rgba(40,44,74,0.5)");
  shine.addColorStop(0.85, "rgba(30,32,60,0.45)");
  shine.addColorStop(1, "rgba(56,62,100,0.3)");
  g.fillStyle = shine;
  g.beginPath();
  g.arc(c, c, r, 0, TAU);
  g.fill();
  g.save();
  g.translate(c, c);
  g.rotate(waxing ? 0.5 : -0.5);
  if (!waxing) g.scale(-1, 1);
  const lit = new Path2D();
  lit.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
  lit.ellipse(0, 0, Math.max(0.01, Math.abs(k) * r), r, 0, Math.PI / 2, -Math.PI / 2, k > 0);
  const disc = g.createRadialGradient(r * 0.35, r * 0.1, r * 0.1, 0, 0, r);
  disc.addColorStop(0, "#fcf8ee");
  disc.addColorStop(0.7, "#f2ecdc");
  disc.addColorStop(1, "#d9cfba");
  g.fillStyle = disc;
  // A soft terminator: the lit shape is blurred a little where the browser supports it.
  g.filter = `blur(${Math.max(0.4, r * 0.03).toFixed(2)}px)`;
  g.fill(lit);
  g.filter = "none";
  g.clip(lit);
  // Maria: low-frequency noise patches, slightly blue-grey.
  for (let j = -r; j < r; j += 2) {
    for (let i = -r; i < r; i += 2) {
      const v = fbm2D(noise, i / r + 40, j / r - 12, 4);
      if (v > 0.08) {
        g.fillStyle = `rgba(118,122,132,${Math.min(0.42, (v - 0.08) * 1.4).toFixed(3)})`;
        g.fillRect(i, j, 2, 2);
      }
    }
  }
  g.restore();
  g.globalCompositeOperation = "lighter";
  const bloom = g.createRadialGradient(c, c, r * 0.6, c, c, c);
  bloom.addColorStop(0, `rgba(236,232,218,${(0.06 + 0.16 * moonShape(phase).lit).toFixed(3)})`);
  bloom.addColorStop(1, "rgba(200,206,236,0)");
  g.fillStyle = bloom;
  g.fillRect(0, 0, size, size);
  return { s, size };
}

/* ---------------------------------------------------------------- sky plane */

export interface SkySpec {
  w: number;
  /** Box height: the viewport plus the parallax overscan. */
  h: number;
  vh: number;
  moon: { x: number; y: number; r: number; ring: boolean; lit: number };
}

/** The sky gradient with its dither, fast enough to paint at once on a resize. */
export function paintSkyBase(g: G, w: number, h: number, vh: number, rand: () => number): void {
  const sky = g.createLinearGradient(0, 0, 0, h);
  const at = (y: number) => clamp(y / h, 0, 1);
  sky.addColorStop(0, "#05040f");
  sky.addColorStop(at(vh * 0.4), "#0b0a22");
  sky.addColorStop(at(vh * 0.8), "#16122f");
  sky.addColorStop(1, "#1d1636");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  paintDither(g, w, h, rand);
}

/** Density of the milky band (0..1) at a point: it runs from the upper left toward the right middle. */
function bandAt(x: number, y: number, w: number, vh: number): number {
  const nx = x / Math.max(1, w);
  const centre = vh * (0.12 + 0.42 * nx) + vh * 0.05 * Math.sin(nx * 3.1 + 0.6);
  const half = Math.min(w, vh) * 0.2 + w * 0.03;
  const d = (y - centre) / half;
  return Math.exp(-d * d);
}

/** Domain-warped nebula on a coarse grid, one horizontal band of rows per step. */
export function nebulaSteps(alloc: Alloc, spec: SkySpec, noise: Noise, dust: Noise, parts: number, done: (s: Surface, step: number) => void): (() => void)[] {
  const step = 8;
  const gw = Math.ceil(spec.w / step) + 1;
  const gh = Math.ceil(spec.h / step) + 1;
  let s: Surface | null = null;
  const short = Math.min(spec.w, spec.vh);
  const rows = Math.ceil(gh / parts);
  return Array.from({ length: parts }, (_, p) => () => {
    s ??= alloc(gw, gh);
    const j0 = p * rows;
    const j1 = Math.min(gh, j0 + rows);
    if (j1 <= j0) return;
    const img = s.g.createImageData(gw, j1 - j0);
    const d = img.data;
    for (let j = j0; j < j1; j++) {
      for (let i = 0; i < gw; i++) {
        const X = i * step;
        const Y = j * step;
        const u = X / short;
        const v = Y / short;
        const qx = fbm2D(noise, u * 0.9, v * 0.9, 3);
        const qy = fbm2D(noise, u * 0.9 + 5.2, v * 0.9 + 1.3, 3);
        const n = fbm2D(noise, u * 1.7 + 0.9 * qx, v * 1.7 + 0.9 * qy, 4);
        const band = bandAt(X, Y, spec.w, spec.vh);
        const core = band * band;
        const cloud = smoothstep(-0.25, 0.75, n);
        const lanes = smoothstep(0.02, 0.36, fbm2D(dust, u * 2.6 + 0.5 * qx, v * 2.6 + 0.5 * qy, 3));
        const dens = (band * (0.12 + 0.88 * cloud) + core * 0.4) * (1 - 0.45 * lanes * band) + 0.03 * smoothstep(-0.2, 0.9, n);
        const mint = smoothstep(0.2, 0.7, qy) * 0.55;
        const rose = smoothstep(0.3, 0.75, n) * core * 0.7;
        let r = 40 + 64 * core;
        let gg = 36 + 52 * core;
        let b = 104 + 40 * core;
        r += (30 - r) * mint + 50 * rose;
        gg += (86 - gg) * mint + 14 * rose;
        b += (104 - b) * mint + 18 * rose;
        const a = dens * 0.4;
        const k = ((j - j0) * gw + i) * 4;
        d[k] = r * a;
        d[k + 1] = gg * a;
        d[k + 2] = b * a;
        d[k + 3] = 255;
      }
    }
    s.g.putImageData(img, 0, j0);
    if (j1 >= gh || p === parts - 1) done(s, step);
  });
}

/** Nebula, stars, the moon's halo and ring, a vignette and the low garden mist over the base. */
export function finishSky(g: G, spec: SkySpec, nebula: Surface | null, step: number, rand: () => number): void {
  const { w, h, vh, moon } = spec;
  if (nebula) {
    g.globalCompositeOperation = "lighter";
    g.imageSmoothingQuality = "high";
    g.drawImage(nebula.canvas, 0, 0, nebula.canvas.width * step, nebula.canvas.height * step);
  }
  g.globalCompositeOperation = "source-over";
  const count = Math.round((w * h) / 900);
  const tints = ["#dfe5ff", "#dfe5ff", "#eef0ff", "#fff5e4", "#d8f0e2"];
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const mag = rand() ** 3;
    const tint = tints[Math.floor(rand() * tints.length)];
    if (rand() > 0.28 + 0.72 * bandAt(x, y, w, vh)) continue;
    g.globalAlpha = (0.2 + 0.7 * mag) * (1 - 0.5 * smoothstep(vh * 0.55, vh, y));
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
  const halo = g.createRadialGradient(moon.x, moon.y, moon.r * 0.8, moon.x, moon.y, moon.r * 7);
  const a = 0.06 + 0.16 * moon.lit;
  halo.addColorStop(0, `rgba(185,195,230,${a.toFixed(3)})`);
  halo.addColorStop(0.2, `rgba(185,195,230,${(a * 0.4).toFixed(3)})`);
  halo.addColorStop(1, "rgba(150,165,220,0)");
  g.fillStyle = halo;
  g.fillRect(moon.x - moon.r * 7, moon.y - moon.r * 7, moon.r * 14, moon.r * 14);
  if (moon.ring) {
    const ringR = moon.r * 3.9;
    const outer = ringR + moon.r * 0.5;
    const ring = g.createRadialGradient(moon.x, moon.y, 0, moon.x, moon.y, outer);
    const at = (d: number) => clamp(d / outer, 0, 1);
    ring.addColorStop(at(ringR - moon.r * 0.35), "rgba(0,0,0,0)");
    ring.addColorStop(at(ringR - moon.r * 0.08), "rgba(214,176,168,0.04)");
    ring.addColorStop(at(ringR + moon.r * 0.05), "rgba(196,208,240,0.05)");
    ring.addColorStop(1, "rgba(150,172,236,0)");
    g.fillStyle = ring;
    g.fillRect(moon.x - outer, moon.y - outer, outer * 2, outer * 2);
  }
  g.globalCompositeOperation = "source-over";
  const diag = Math.hypot(w, vh);
  const vig = g.createRadialGradient(w / 2, vh * 0.45, diag * 0.24, w / 2, vh * 0.5, diag * 0.75);
  vig.addColorStop(0, "rgba(3,3,12,0)");
  vig.addColorStop(1, "rgba(3,3,12,0.55)");
  g.fillStyle = vig;
  g.fillRect(0, 0, w, h);
  const mist = g.createLinearGradient(0, vh * 0.7, 0, h);
  mist.addColorStop(0, "rgba(120,112,170,0)");
  mist.addColorStop(1, "rgba(120,112,170,0.08)");
  g.fillStyle = mist;
  g.fillRect(0, vh * 0.7, w, h - vh * 0.7);
}

/* ---------------------------------------------------------------- hanging garden plane */

export interface GardenSpec {
  w: number;
  h: number;
  /** Shell edges: blooms stay in the gutters, outside them. */
  left: number;
  right: number;
  phone: boolean;
  /** The moon keeps a clear patch of sky. */
  moon: { x: number; y: number; r: number };
  /** Strands end above this line (the stage horizon at scroll 0), so no vine hangs into the garden bed. */
  floor: number;
  /** Wide screens: a dim second lamp post stands in the left gutter. */
  wide: boolean;
}

function heart(g: G, x: number, y: number, s: number, a: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(-s * 0.55, -s * 0.05, -s * 0.45, -s * 0.66, 0, -s * 1.1);
  g.bezierCurveTo(s * 0.45, -s * 0.66, s * 0.55, -s * 0.05, 0, 0);
  g.fill();
  g.restore();
}

/** A leaf with a moonlit rim on its upper-right edge. */
function rimLeaf(g: G, x: number, y: number, s: number, a: number, body: string, rim: string | null): void {
  if (rim) {
    g.fillStyle = rim;
    heart(g, x + s * 0.08, y - s * 0.08, s, a);
  }
  g.fillStyle = body;
  heart(g, x, y, s, a);
}

/** A moonflower face seen from the front: five fused petals with a pale star and a warm hint. */
export function bloom(g: G, x: number, y: number, r: number, open: number, warm: number, tilt: number, alpha = 1, halo = 3): void {
  g.globalAlpha = alpha;
  if (open <= 0.02) {
    // Closed spiral bud.
    g.save();
    g.translate(x, y);
    g.rotate(tilt);
    const bud = g.createLinearGradient(0, r * 0.6, 0, -r * 1.2);
    bud.addColorStop(0, "#3e4a40");
    bud.addColorStop(1, warm > 0.05 ? `rgb(${Math.round(196 + 40 * warm)},${Math.round(200 + 10 * warm)},170)` : "#b9c4c4");
    g.fillStyle = bud;
    g.beginPath();
    g.moveTo(0, r * 0.6);
    g.bezierCurveTo(r * 0.45, r * 0.1, r * 0.3, -r * 0.8, 0, -r * 1.2);
    g.bezierCurveTo(-r * 0.3, -r * 0.8, -r * 0.45, r * 0.1, 0, r * 0.6);
    g.fill();
    g.strokeStyle = "rgba(240,244,236,0.35)";
    g.lineWidth = Math.max(0.6, r * 0.08);
    g.beginPath();
    g.moveTo(-r * 0.2, r * 0.3);
    g.quadraticCurveTo(r * 0.3, -r * 0.3, -r * 0.05, -r * 1);
    g.stroke();
    g.restore();
    g.globalAlpha = 1;
    return;
  }
  const rr = r * (0.45 + 0.55 * open);
  const glow = g.createRadialGradient(x, y, 0, x, y, rr * halo);
  glow.addColorStop(0, warm > 0.05 ? `rgba(${WARM},${(0.1 + 0.2 * warm).toFixed(3)})` : `rgba(206,222,240,${(0.1 + 0.12 * open).toFixed(3)})`);
  glow.addColorStop(1, "rgba(170,186,220,0)");
  g.fillStyle = glow;
  g.fillRect(x - rr * halo, y - rr * halo, rr * halo * 2, rr * halo * 2);
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  g.scale(1, 0.84);
  g.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const d = i % 2 === 0 ? rr : rr * (0.76 + 0.14 * open);
    if (i === 0) g.moveTo(Math.cos(a) * d, Math.sin(a) * d);
    else g.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  g.closePath();
  const petal = g.createRadialGradient(-rr * 0.2, -rr * 0.25, rr * 0.05, 0, 0, rr);
  petal.addColorStop(0, "#f6f6f2");
  petal.addColorStop(0.3, "#e2e6ee");
  petal.addColorStop(0.8, "#bfc6d8");
  petal.addColorStop(1, "#8f97b0");
  g.fillStyle = petal;
  g.fill();
  if (warm > 0.02) {
    g.fillStyle = `rgba(${WARM},${(0.4 * warm).toFixed(3)})`;
    g.fill();
  }
  g.strokeStyle = "rgba(150,170,160,0.5)";
  g.lineWidth = Math.max(0.5, rr * 0.06);
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2;
    g.moveTo(Math.cos(a) * rr * 0.22, Math.sin(a) * rr * 0.22);
    g.lineTo(Math.cos(a) * rr * 0.92, Math.sin(a) * rr * 0.92);
  }
  g.stroke();
  const eye = g.createRadialGradient(0, 0, 0, 0, 0, rr * 0.3);
  eye.addColorStop(0, "#e8ecb0");
  eye.addColorStop(1, "rgba(160,186,120,0.2)");
  g.fillStyle = eye;
  g.beginPath();
  g.arc(0, 0, rr * 0.3, 0, TAU);
  g.fill();
  g.restore();
  g.globalAlpha = 1;
}

const TONES = [
  { body: "#16122e", rim: null },
  { body: "#0d0b1f", rim: "rgba(132,140,210,0.2)" },
  { body: "#06050e", rim: "rgba(150,158,226,0.36)" },
] as const;

/**
 * Moonflower vines hanging from the leafy canopy at one top corner and down that side's gutter
 * (`side` -1 left, 1 right), in three depths. `sway` (-1, 0, 1) bends every strand from its
 * anchor; the same seed gives the same plants, so the three phases crossfade into a gentle sway.
 * The moon keeps clear sky.
 */
export function paintGarden(g: G, spec: GardenSpec, sway: number, seed: number, side: -1 | 1): void {
  // Each side has its own random stream, so the two sides can be painted in separate steps.
  const rand = createRng(seed + (side < 0 ? 0 : 7919));
  const { w, h, left, right, phone, moon } = spec;
  const clearOfMoon = (x: number, y: number, pad: number) => Math.hypot(x - moon.x, y - moon.y) > moon.r * 2.2 + pad;
  const gut = side < 0 ? left : w - right;
  const x0 = side < 0 ? 0 : w;
  const reach = phone ? clamp(w * 0.12, 30, 60) : clamp(gut + 60, 110, Math.min(w * 0.26, 480));
  const depth = phone ? 22 : clamp(h * 0.08, 36, 96);
  TONES.forEach((tone, layer) => {
    for (let i = 0; i < (phone ? 12 : 30); i++) {
      const t = rand() ** 1.25;
      const x = x0 - side * t * reach * (1 - layer * 0.12);
      const y = -10 + rand() * depth * (1 - t * 0.75) + layer * 3;
      const s = (phone ? 6 : 10) + rand() * (phone ? 6 : 12) * (1 - t * 0.35);
      if (!clearOfMoon(x, y, s)) continue;
      rimLeaf(g, x, y, s, Math.PI + side * 0.25 + (rand() - 0.5) * 1.7, tone.body, tone.rim);
    }
  });
  // Strands hang thicker toward the screen edge and thin out toward the content, so a wide
  // gutter reads as a canopy edge rather than an even curtain.
  const n = clamp(Math.round(gut / (phone ? 24 : 60)), 1, phone ? 2 : 5);
  const strands = Array.from({ length: n }, (_, i) => {
    const off = ((i + 0.5) / n) ** 1.3 * gut * 0.92 + (rand() - 0.5) * 12;
    return {
      x: side < 0 ? off : w - off,
      layer: Math.floor(rand() * 3),
      len: h * (phone ? 0.08 + rand() * 0.1 : 0.14 + rand() * 0.3),
      y0: rand() * depth * 0.5,
    };
  }).sort((a, b) => a.layer - b.layer);
  const floor = spec.floor - 28;
  let faces = phone ? 0 : 1 + Math.floor(rand() * 2);
  for (const st of strands) {
    const tone = TONES[st.layer];
    let len = Math.min(st.len, floor - st.y0);
    while (len > 30 && !clearOfMoon(st.x, st.y0 + len, 10)) len *= 0.85;
    if (len < 24 || !clearOfMoon(st.x, st.y0, 10)) continue;
    const ph = rand() * TAU;
    const wig = 3 + rand() * 5;
    const drift = (rand() - 0.5) * 14;
    const bend = sway * (2 + len * 0.012) * (st.layer === 2 ? 1 : 0.7);
    const at = (t: number) => ({ x: st.x + Math.sin(t * 3.2 + ph) * wig * t + drift * t + bend * t * t, y: st.y0 + len * t });
    // Far strands are soft, near ones carry a real stem the leaves grow from.
    if (st.layer === 0) g.filter = "blur(1px)";
    g.strokeStyle = tone.body;
    g.lineWidth = st.layer === 0 ? 1 : 1.6 + rand() * 0.6;
    g.lineCap = "round";
    g.beginPath();
    for (let k = 0; k <= 20; k++) {
      const p = at(k / 20);
      if (k === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    }
    g.stroke();
    // Leaves in loose clusters with gaps, each angled off the stem, smaller toward the tip.
    const pitch = phone ? 10 : 13;
    let flip = rand() < 0.5 ? 1 : -1;
    for (let d = pitch * (0.5 + rand()); d < len - 6; d += pitch * (0.65 + rand() * 0.7)) {
      if (rand() < 0.25) {
        d += pitch * (1 + rand() * 1.5);
        continue;
      }
      const t = d / len;
      const p = at(t);
      const q = at(Math.min(1, t + 0.02));
      const tangent = Math.atan2(q.y - p.y, q.x - p.x);
      flip = rand() < 0.7 ? -flip : flip;
      const s = ((phone ? 5 : 8) + rand() * (phone ? 4 : 7)) * (1 - 0.7 * t) * (st.layer === 0 ? 0.8 : 1) + 2;
      rimLeaf(g, p.x, p.y, s, tangent + Math.PI / 2 + flip * (1.1 + (rand() - 0.5) * 1), tone.body, tone.rim);
    }
    const tip = at(1);
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(tip.x, tip.y);
    g.bezierCurveTo(tip.x + 5, tip.y + 4, tip.x + 1, tip.y + 10, tip.x - 3, tip.y + 6);
    g.stroke();
    g.filter = "none";
    if (faces > 0 && st.layer > 0 && rand() < 0.6) {
      const p = at(0.35 + rand() * 0.4);
      if ((p.x < left - 18 || p.x > right + 18) && clearOfMoon(p.x, p.y, 18)) {
        bloom(g, p.x + side * -4, p.y + 4, 7 + rand() * 2, 1, 0, (rand() - 0.5) * 0.8, 0.6, 1.4);
        faces--;
      }
    }
  }
  // It stands on the stage lawn behind the gutter bushes (the plane moves with the page).
  if (spec.wide && side < 0 && spec.floor < h) gutterLamp(g, left * 0.42, spec.floor + 6, clamp(h * 0.024, 22, 40));
}

/** The dim second lamp post in the wide left gutter: a dark post and a small lantern with a weak warm halo. */
function gutterLamp(g: G, x: number, base: number, s: number): void {
  const halo = g.createRadialGradient(x, base - s * 4.3, 0, x, base - s * 4.3, s * 4.2);
  halo.addColorStop(0, `rgba(${WARM},0.07)`);
  halo.addColorStop(1, `rgba(${WARM},0)`);
  g.fillStyle = halo;
  g.fillRect(x - s * 4.2, base - s * 8.5, s * 8.4, s * 8.4);
  g.globalAlpha = 0.5;
  g.strokeStyle = INK;
  g.lineWidth = Math.max(1.6, s * 0.12);
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x, base);
  g.lineTo(x, base - s * 4.8);
  g.quadraticCurveTo(x, base - s * 5.4, x + s * 0.7, base - s * 5.4);
  g.lineTo(x + s * 0.9, base - s * 5.1);
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.ellipse(x, base, s * 0.9, s * 0.18, 0, 0, TAU);
  g.fill();
  g.save();
  g.translate(x + s * 0.9, base - s * 5.1);
  lantern(g, s * 0.62, 0.3, 0.55);
  g.restore();
  g.globalAlpha = 1;
}

/* ---------------------------------------------------------------- lanterns */

/**
 * The hanging garden lantern in its own frame (origin at the chain's lower end): a cap, four
 * glazed sides whose frame bars turn with `spin`, and the flame. `flame` 0..1 lights it.
 */
export function lantern(g: G, s: number, spin: number, flame: number): void {
  const w = s * 0.92;
  g.fillStyle = INK;
  g.beginPath();
  g.moveTo(-s * 0.16, 0);
  g.lineTo(s * 0.16, 0);
  g.lineTo(s * 0.6, s * 0.42);
  g.lineTo(-s * 0.6, s * 0.42);
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(0, -s * 0.08, s * 0.09, 0, TAU);
  g.fill();
  const glass = g.createLinearGradient(-w / 2, 0, w / 2, 0);
  const lit = 0.25 + 0.75 * flame;
  glass.addColorStop(0, `rgba(150,96,52,${lit.toFixed(3)})`);
  glass.addColorStop(0.5, `rgba(255,${Math.round(196 + 30 * flame)},150,${lit.toFixed(3)})`);
  glass.addColorStop(1, `rgba(156,100,56,${lit.toFixed(3)})`);
  g.fillStyle = flame > 0.02 ? glass : "#2a2436";
  g.beginPath();
  g.moveTo(-w / 2, s * 0.46);
  g.lineTo(w / 2, s * 0.46);
  g.lineTo(w * 0.42, s * 1.62);
  g.lineTo(-w * 0.42, s * 1.62);
  g.closePath();
  g.fill();
  if (flame > 0.02) {
    g.fillStyle = `rgba(255,250,232,${(0.9 * flame).toFixed(3)})`;
    g.beginPath();
    g.ellipse(0, s * 1.2, s * 0.09, s * 0.2, 0, 0, TAU);
    g.fill();
  }
  // Frame bars on the faces turned toward the viewer.
  g.strokeStyle = INK;
  g.lineWidth = Math.max(0.8, s * 0.07);
  g.beginPath();
  for (let k = 0; k < 4; k++) {
    const a = spin + (k * Math.PI) / 2;
    if (Math.cos(a) < 0) continue;
    const x = Math.sin(a) * w * 0.48;
    g.moveTo(x, s * 0.46);
    g.lineTo(x * 0.86, s * 1.62);
  }
  g.stroke();
  g.fillStyle = INK;
  g.fillRect(-w * 0.52, s * 1.6, w * 1.04, s * 0.14);
  g.beginPath();
  g.moveTo(-s * 0.26, s * 1.74);
  g.lineTo(s * 0.26, s * 1.74);
  g.lineTo(0, s * 1.98);
  g.closePath();
  g.fill();
}

/** A round paper lantern on its own short cord, lit warm. */
export function paperLantern(g: G, x: number, y: number, s: number, flame: number): void {
  const body = g.createRadialGradient(x - s * 0.2, y - s * 0.2, s * 0.1, x, y, s);
  body.addColorStop(0, `rgba(255,236,196,${(0.75 + 0.25 * flame).toFixed(3)})`);
  body.addColorStop(0.6, `rgba(240,170,96,${(0.7 + 0.25 * flame).toFixed(3)})`);
  body.addColorStop(1, "rgba(150,82,40,0.9)");
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(x, y, s * 0.8, s, 0, 0, TAU);
  g.fill();
  g.strokeStyle = "rgba(120,62,30,0.55)";
  g.lineWidth = Math.max(0.6, s * 0.06);
  g.beginPath();
  g.ellipse(x, y, s * 0.36, s, 0, 0, TAU);
  g.moveTo(x, y - s);
  g.lineTo(x, y + s);
  g.stroke();
  g.fillStyle = INK;
  g.fillRect(x - s * 0.36, y - s * 1.08, s * 0.72, s * 0.18);
  g.fillRect(x - s * 0.3, y + s * 0.92, s * 0.6, s * 0.16);
}

/** The low iron garden lantern on a short post (mid and ground windows); the post is baked. */
export function lowLantern(g: G, x: number, y: number, s: number, flame: number): void {
  g.save();
  g.translate(x, y - s * 0.95);
  lantern(g, s * 0.85, 0.4, flame);
  g.restore();
}

/* ---------------------------------------------------------------- window bases */

function tint(alloc: Alloc, mask: Surface, color: string): Surface {
  const t = alloc(mask.canvas.width, mask.canvas.height);
  t.g.drawImage(mask.canvas, 0, 0);
  t.g.globalCompositeOperation = "source-in";
  t.g.fillStyle = color;
  t.g.fillRect(0, 0, t.canvas.width, t.canvas.height);
  return t;
}

/** Unlit and lit copies of one silhouette: moonlit rims for the unlit one, warm rims and wash for the lit one. */
function twoTone(alloc: Alloc, free: Free, mask: Surface, dpr: number, fadeFrom: number, fadeTo: number): { unlit: Surface; lit: Surface } {
  const w = mask.canvas.width;
  const h = mask.canvas.height;
  const make = (rimColor: string, rimDx: number, rimDy: number, body: string, wash: string | null) => {
    const out = alloc(w, h);
    const rim = tint(alloc, mask, rimColor);
    out.g.drawImage(rim.canvas, rimDx * dpr, rimDy * dpr);
    free(rim);
    const fill = tint(alloc, mask, body);
    out.g.drawImage(fill.canvas, 0, 0);
    free(fill);
    if (wash) {
      out.g.globalCompositeOperation = "source-atop";
      out.g.fillStyle = wash;
      out.g.fillRect(0, 0, w, h);
    }
    // Fade the lower edge into the night so the strip never ends on a hard line.
    out.g.globalCompositeOperation = "destination-in";
    const fade = out.g.createLinearGradient(0, fadeFrom * dpr, 0, fadeTo * dpr);
    fade.addColorStop(0, "#000");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    out.g.fillStyle = fade;
    out.g.fillRect(0, 0, w, h);
    return out;
  };
  return {
    unlit: make("rgba(140,148,220,0.5)", 0.9, -1.1, "#07060f", null),
    lit: make(`rgba(${WARM},0.75)`, 0, -1.4, "#1a120c", "rgba(150,92,46,0.3)"),
  };
}

function blade(g: G, x: number, base: number, bh: number, lean: number, bw: number): void {
  const tx = x + lean * bh;
  g.beginPath();
  g.moveTo(x - bw, base + 2);
  g.quadraticCurveTo(x - bw * 0.3 + lean * bh * 0.2, base - bh * 0.6, tx, base - bh);
  g.quadraticCurveTo(x + bw * 0.3 + lean * bh * 0.2, base - bh * 0.6, x + bw, base + 2);
  g.fill();
}

/** Grass as tufts of fanned blades over a short fringe, never an even comb. */
function tufts(g: G, x0: number, x1: number, base: (x: number) => number, height: number, rand: () => number): void {
  for (let x = x0; x < x1; x += 3 + rand() * 4) blade(g, x, base(x), height * (0.14 + rand() * 0.2), (rand() - 0.5) * 0.4, 0.7 + rand() * 0.7);
  for (let x = x0 + rand() * 20; x < x1; x += 18 + rand() * 34) {
    const n = 4 + Math.floor(rand() * 5);
    const hh = height * (0.45 + rand() * 0.6);
    for (let i = 0; i < n; i++) {
      const f = n > 1 ? i / (n - 1) - 0.5 : 0;
      blade(g, x + f * 7, base(x), hh * (1 - Math.abs(f) * 0.7) * (0.75 + rand() * 0.25), f * 0.9 + (rand() - 0.5) * 0.25, 0.9 + rand() * 1.2);
    }
  }
}

/** A low leafy clump anchored on the ground: a hidden core with overlapping leaves for a scalloped crown. */
function mound(g: G, cx: number, base: number, wide: number, tall: number, rand: () => number): void {
  const rx = wide / 2;
  const ry = tall * 0.6;
  g.beginPath();
  g.ellipse(cx, base + 2, rx * 0.82, ry * 0.78, 0, Math.PI, TAU);
  g.fill();
  const leaf = clamp(wide * 0.13, 5, 15);
  for (let i = 0; i < Math.round(wide / 3.5); i++) {
    const a = Math.PI + 0.12 + rand() * (Math.PI - 0.24);
    const k = 0.6 + rand() * 0.32;
    heart(g, cx + Math.cos(a) * rx * k, base + 2 + Math.sin(a) * ry * k, leaf * (0.7 + rand() * 0.6), a + Math.PI / 2 + (rand() - 0.5) * 0.9);
  }
}

/** A bush rooted at `base` whose crown reaches `top`: fanned stems with leaves along them, no hard dome. */
function bush(g: G, cx: number, base: number, wide: number, top: number, rand: () => number): void {
  const tall = Math.max(8, base - top);
  const stems = Math.max(3, Math.round(wide / 12));
  g.lineWidth = 1.2;
  g.lineCap = "round";
  for (let i = 0; i < stems; i++) {
    const f = i / (stems - 1) - 0.5;
    const h = tall * (1 - f * f * 1.6) * (0.82 + rand() * 0.18);
    const x0 = cx + f * wide * 0.18;
    const x1 = cx + f * wide * 0.55;
    const x2 = cx + f * wide * 0.85 + (rand() - 0.5) * 6;
    const y0 = base + 2;
    const y1 = base - h * 0.55;
    const y2 = base - h;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(x1, y1, x2, y2);
    g.stroke();
    const leaves = Math.max(3, Math.round(h / 6));
    for (let k = 0; k < leaves; k++) {
      const t = 0.25 + (0.75 * (k + 0.5)) / leaves;
      const u = 1 - t;
      const x = u * u * x0 + 2 * u * t * x1 + t * t * x2;
      const y = u * u * y0 + 2 * u * t * y1 + t * t * y2;
      heart(g, x, y, clamp(wide * 0.09, 4, 11) * (1.1 - t * 0.4) * (0.8 + rand() * 0.4), f * 1.4 + (k % 2 ? 0.8 : -0.8) * (0.6 + rand() * 0.5));
    }
  }
  // A skirt of leaves hides where the stems meet the lawn.
  for (let i = 0; i < Math.round(wide / 6); i++) {
    const x = cx + (rand() - 0.5) * wide * 0.8;
    heart(g, x, base + 3, 4 + rand() * 5, (x - cx) / wide * 2.4 + (rand() - 0.5) * 0.6);
  }
}

/** A foxglove spire: a curved stalk with leaves low and drooping bells up its upper half. */
function spire(g: G, x: number, base: number, tall: number, rand: () => number, bell: string | null = null): void {
  const lean = (rand() - 0.5) * 10;
  const tipX = x + (rand() - 0.5) * 8;
  const at = (t: number) => {
    const u = 1 - t;
    return { x: u * u * x + 2 * u * t * (x + lean) + t * t * tipX, y: base + 2 - (tall + 2) * t };
  };
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(x, base + 2);
  g.quadraticCurveTo(x + lean, base - tall * 0.5, tipX, base - tall);
  g.stroke();
  for (let k = 0; k < 6; k++) {
    const t = k / 12;
    const p = at(t);
    const s = 10 * (1 - t);
    heart(g, p.x + (k % 2 ? 1 : -1) * s * 0.3, p.y, s, (k % 2 ? 1 : -1) * (1.1 - t));
  }
  const body = g.fillStyle;
  for (let k = 0; k < 9; k++) {
    const t = 0.42 + k * 0.064;
    const p = at(t);
    const side = k % 2 ? 1 : -1;
    const s = 5.2 * (1 - (t - 0.42) * 0.9);
    const bx = p.x + side * s * 0.75;
    const by = p.y + s * 0.4;
    g.fillStyle = bell ?? body;
    g.save();
    g.translate(bx, by);
    g.rotate(side * 0.35);
    g.beginPath();
    g.moveTo(-s * 0.32, -s * 0.5);
    g.quadraticCurveTo(-s * 0.48, s * 0.25, -s * 0.62, s * 0.62);
    g.quadraticCurveTo(0, s * 0.42, s * 0.62, s * 0.62);
    g.quadraticCurveTo(s * 0.48, s * 0.25, s * 0.32, -s * 0.5);
    g.closePath();
    g.fill();
    g.restore();
  }
  g.fillStyle = body;
  for (let k = 0; k < 3; k++) {
    const p = at(0.94 + k * 0.02);
    g.beginPath();
    g.arc(p.x, p.y, 1.6 - k * 0.4, 0, TAU);
    g.fill();
  }
}

/** Stage base: the bed, mounds and spires at both ends and the lamp post with its hook, unlit and lit. */
export function stageBase(alloc: Alloc, free: Free, L: StageLayout, dpr: number, seed: number): { unlit: Surface; lit: Surface } {
  const rand = createRng(seed);
  const mask = alloc(L.w * dpr, L.h * dpr);
  const g = mask.g;
  g.scale(dpr, dpr);
  g.fillStyle = "#fff";
  g.strokeStyle = "#fff";
  const ground = (x: number) => L.bedY + 4 + Math.sin(x * 0.011 + 1.3) * 3 + Math.sin(x * 0.037) * 1.5;
  g.beginPath();
  g.moveTo(0, L.h);
  for (let x = 0; x < L.w; x += 20) g.lineTo(x, ground(x));
  g.lineTo(L.w, ground(L.w));
  g.lineTo(L.w, L.h);
  g.closePath();
  g.fill();
  tufts(g, -10, L.w + 10, ground, clamp(L.h * 0.17, 9, 30), rand);
  // Bushes fill each gutter: one on a narrow gutter, a row of varied ones on a wide gutter.
  const edge = Math.max(36, L.box.x * 0.9);
  const count = Math.max(1, Math.round(edge / 150));
  for (const side of [0, 1]) {
    const at = (off: number) => (side ? L.w - off : off);
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) / count;
      const cx = at(u * edge + (count > 1 ? (rand() - 0.5) * 30 : 0));
      const wide = clamp((edge / count) * 1.3, 48, 210) * (count > 1 ? 0.85 + rand() * 0.3 : 1);
      const tall = Math.min(L.h * 0.5, 70) * (count > 1 ? 0.62 + 0.38 * Math.sin(u * Math.PI) * (0.8 + rand() * 0.2) : 1);
      bush(g, cx, ground(cx), wide, ground(cx) - tall, rand);
      mound(g, cx + (side ? 1 : -1) * wide * 0.25, ground(cx), wide * 0.7, Math.min(L.h * 0.24, 30), rand);
    }
    const sx = at(edge * 0.8);
    if (L.h > 120) spire(g, sx, ground(sx), Math.min(L.h * 0.62, 120), rand);
  }
  // A continuous low bed from the lamp post to the last flower, with leafy clumps between the
  // flowers, so the centrepiece reads as a planted bed rather than a few stems on a lawn.
  if (L.flowers.length) {
    const bx0 = L.postX - 24;
    const bx1 = Math.max(...L.flowers.map((f) => f.x)) + 44;
    const tall = clamp(L.h * 0.1, 12, 22);
    const ph = rand() * TAU;
    const top = (x: number) => ground(x) - tall * (0.72 + 0.28 * Math.sin(x * 0.06 + ph)) * clamp(Math.min(x - bx0, bx1 - x) / 34, 0, 1);
    g.beginPath();
    g.moveTo(bx0, ground(bx0) + 3);
    for (let x = bx0; x < bx1; x += 6) g.lineTo(x, top(x));
    g.lineTo(bx1, ground(bx1) + 3);
    g.closePath();
    g.fill();
    for (let x = bx0 + 14; x < bx1 - 10; x += 9 + rand() * 9) heart(g, x, top(x) + 3, 5 + rand() * 5, (rand() - 0.5) * 1.8);
    const xs = [L.postX, ...L.flowers.map((f) => f.x)].sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i++) {
      if (xs[i + 1] - xs[i] < 70) continue;
      const cx = (xs[i] + xs[i + 1]) / 2 + (rand() - 0.5) * 16;
      bush(g, cx, ground(cx), 30 + rand() * 20, ground(cx) - clamp(L.h * 0.24, 22, 46) * (0.7 + rand() * 0.3), rand);
    }
  }
  for (const f of L.flowers) mound(g, f.x, ground(f.x), clamp(L.h * 0.3, 26, 56), clamp(L.h * 0.16, 12, 30), rand);
  const lw = clamp(L.size * 0.2, 1.6, 3.4);
  g.lineWidth = lw;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(L.postX, ground(L.postX) + 4);
  g.lineTo(L.postX, L.topY + L.size * 1.4);
  g.quadraticCurveTo(L.postX, L.topY, L.postX + L.size * 1.2, L.topY);
  g.lineTo(L.hookX - L.size * 0.5, L.topY);
  g.quadraticCurveTo(L.hookX, L.topY, L.hookX, L.hookY);
  g.stroke();
  g.lineWidth = lw * 0.6;
  g.beginPath();
  g.moveTo(L.postX, L.topY + L.size * 2.4);
  g.quadraticCurveTo(L.postX + L.size * 0.9, L.topY + L.size * 1.1, L.postX + L.size * 2, L.topY);
  g.stroke();
  g.beginPath();
  g.arc(L.postX + L.size * 0.75, L.topY + L.size * 0.85, L.size * 0.32, 0, TAU * 0.8);
  g.stroke();
  const out = twoTone(alloc, free, mask, dpr, L.h * 0.8, L.h);
  free(mask);
  return out;
}

/** Mid base: the lawn with stepping stones, the beds with their landing blooms, the cocoon branch and the low lantern's post. */
export function midBase(alloc: Alloc, M: MidLayout, dpr: number, seed: number): Surface {
  const rand = createRng(seed);
  const s = alloc(M.w * dpr, M.h * dpr);
  const g = s.g;
  g.scale(dpr, dpr);
  const ground = (x: number) => M.groundY + Math.sin(x * 0.009 + 2) * 4;
  const mist = g.createLinearGradient(0, M.groundY - M.h * 0.3, 0, M.h);
  mist.addColorStop(0, "rgba(120,112,170,0)");
  mist.addColorStop(0.45, "rgba(120,112,170,0.1)");
  mist.addColorStop(1, "rgba(120,112,170,0)");
  g.fillStyle = mist;
  g.fillRect(0, M.groundY - M.h * 0.3, M.w, M.h);
  const lawn = g.createLinearGradient(0, M.groundY, 0, M.h);
  lawn.addColorStop(0, "rgba(8,7,16,0.95)");
  lawn.addColorStop(0.6, "rgba(8,7,16,0.7)");
  lawn.addColorStop(1, "rgba(8,7,16,0)");
  g.fillStyle = lawn;
  g.beginPath();
  g.moveTo(0, M.h);
  for (let x = 0; x < M.w; x += 20) g.lineTo(x, ground(x));
  g.lineTo(M.w, ground(M.w));
  g.lineTo(M.w, M.h);
  g.closePath();
  g.fill();
  // Stepping stones of the garden path, set into the lawn with a faint moonlit top.
  for (let i = 0; i < 6; i++) {
    const x = M.box.x + M.box.w * (0.08 + i * 0.17) + (rand() - 0.5) * 14;
    const y = ground(x) + 8 + rand() * 6;
    const rx = 10 + rand() * 6;
    g.fillStyle = "#0f0d1e";
    g.beginPath();
    g.ellipse(x, y, rx, rx * 0.24, 0, 0, TAU);
    g.fill();
    g.fillStyle = "rgba(170,176,226,0.07)";
    g.beginPath();
    g.ellipse(x - rx * 0.15, y - rx * 0.05, rx * 0.6, rx * 0.09, 0, 0, TAU);
    g.fill();
  }
  g.fillStyle = INK;
  g.strokeStyle = INK;
  tufts(g, -10, M.w + 10, (x) => ground(x) + 4, clamp(M.h * 0.13, 8, 24), rand);
  // Each landing bloom sits on its own bush rooted in the lawn; a moonlit pass first gives the rim.
  for (const p of M.spots) {
    const wide = 30 + rand() * 12;
    for (const [color, dx, dy] of [
      ["rgba(150,158,226,0.28)", 1, -1],
      [INK, 0, 0],
    ] as const) {
      g.fillStyle = color;
      g.strokeStyle = color;
      bush(g, p.x + dx, ground(p.x) + 3 + dy, wide, p.y + p.r * 0.6 + dy, createRng(seed + p.x));
    }
  }
  // Shrubs and foxgloves frame the lawn at both ends.
  for (const [x, wide, tall] of [
    [M.box.x - 40, 150, M.h * 0.5],
    [M.box.x + M.box.w + 40, 160, M.h * 0.55],
  ] as const) {
    for (const [color, dx, dy] of [
      ["rgba(150,158,226,0.24)", 1, -1],
      [INK, 0, 0],
    ] as const) {
      g.fillStyle = color;
      g.strokeStyle = color;
      bush(g, x + dx, ground(x) + 2 + dy, wide, ground(x) - tall + dy, createRng(seed + x));
      mound(g, x + wide * 0.32 + dx, ground(x) + 2 + dy, wide * 0.55, tall * 0.4, createRng(seed + x + 1));
    }
    g.fillStyle = INK;
    g.strokeStyle = INK;
    spire(g, x + (x < M.w / 2 ? 1 : -1) * wide * 0.42, ground(x) + 2, Math.min(M.h * 0.62, tall * 1.25), createRng(seed + x + 2), "rgba(196,186,236,0.5)");
  }
  g.fillStyle = INK;
  g.strokeStyle = INK;
  // The branch that holds the cocoons grows out of the right shrub, tapering toward its tip,
  // with a few forked twigs and the leaves clustered near their ends.
  g.lineCap = "round";
  const shrubX = M.box.x + M.box.w + 40;
  const tipX = Math.max(M.box.x + M.box.w * 0.66, shrubX - Math.min(440, M.w * 0.38));
  const P = [
    { x: shrubX, y: ground(shrubX) - M.h * 0.3 },
    { x: shrubX - 40, y: M.branchY - 6 },
    { x: tipX + (shrubX - tipX) * 0.45, y: M.branchY + 8 },
    { x: tipX, y: M.branchY - 6 },
  ];
  const along = (t: number) => {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return { x: a * P[0].x + b * P[1].x + c * P[2].x + d * P[3].x, y: a * P[0].y + b * P[1].y + c * P[2].y + d * P[3].y };
  };
  const ends: { x: number; y: number }[] = [along(1)];
  for (let k = 0; k < 24; k++) {
    const p0 = along(k / 24);
    const p1 = along((k + 1) / 24);
    g.lineWidth = 7 - (5 * k) / 24;
    g.beginPath();
    g.moveTo(p0.x, p0.y);
    g.lineTo(p1.x, p1.y);
    g.stroke();
  }
  for (const [t, dy, len] of [
    [0.42, -1, 46],
    [0.62, 1, 34],
    [0.8, -1, 30],
  ] as const) {
    const p = along(t);
    const e = { x: p.x - len * (0.7 + rand() * 0.2), y: p.y + dy * len * (0.35 + rand() * 0.2) };
    g.lineWidth = 2.2 - t;
    g.beginPath();
    g.moveTo(p.x, p.y);
    g.quadraticCurveTo((p.x + e.x) / 2, p.y + dy * 4, e.x, e.y);
    g.stroke();
    ends.push(e);
  }
  for (const e of ends) {
    for (let i = 0; i < 3; i++) {
      rimLeaf(g, e.x + (rand() - 0.5) * 14, e.y + (rand() - 0.3) * 10, 7 + rand() * 7, Math.PI + (rand() - 0.5) * 1.8, INK, "rgba(132,140,210,0.3)");
    }
  }
  g.fillStyle = INK;
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(M.lamp.x, ground(M.lamp.x) + 4);
  g.lineTo(M.lamp.x, M.lamp.y);
  g.stroke();
  for (const p of M.spots) bloom(g, p.x, p.y, p.r, 1, 0, (rand() - 0.5) * 0.6);
  return s;
}

/** Ground base: the lawn ridge with moonflower clumps and the lantern's post, dark under the footer text. */
export function groundBase(alloc: Alloc, G0: GroundLayout, dpr: number, seed: number): Surface {
  const rand = createRng(seed);
  const s = alloc(G0.w * dpr, G0.h * dpr);
  const g = s.g;
  g.scale(dpr, dpr);
  const far = (x: number) => G0.ridgeY - 26 + Math.sin(x * 0.004 + 0.4) * 14 + Math.sin(x * 0.013) * 5;
  const ridge = (x: number) => G0.ridgeY + Math.sin(x * 0.006 + 0.8) * 6 + Math.sin(x * 0.019) * 2.5;
  const mist = g.createLinearGradient(0, G0.ridgeY - 90, 0, G0.ridgeY + 10);
  mist.addColorStop(0, "rgba(120,112,170,0)");
  mist.addColorStop(1, "rgba(120,112,170,0.12)");
  g.fillStyle = mist;
  g.fillRect(0, G0.ridgeY - 90, G0.w, 100);
  const hill = (f: (x: number) => number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, G0.h);
    for (let x = 0; x < G0.w; x += 16) g.lineTo(x, f(x));
    g.lineTo(G0.w, f(G0.w));
    g.lineTo(G0.w, G0.h);
    g.closePath();
    g.fill();
  };
  hill(far, "#100d22");
  g.fillStyle = "#100d22";
  tufts(g, -10, G0.w + 10, far, 14, rand);
  hill(ridge, "#080713");
  const deep = g.createLinearGradient(0, G0.ridgeY, 0, G0.h);
  deep.addColorStop(0, "rgba(5,4,9,0)");
  deep.addColorStop(0.4, "#050409");
  deep.addColorStop(1, "#050409");
  g.fillStyle = deep;
  g.fillRect(0, G0.ridgeY, G0.w, G0.h - G0.ridgeY);
  for (const [color, dy] of [
    ["rgba(140,148,220,0.4)", -1],
    ["#080713", 0],
  ] as const) {
    g.fillStyle = color;
    tufts(g, -10, G0.w + 10, (x) => ridge(x) + 2 + dy, 24, createRng(seed));
  }
  g.fillStyle = "#080713";
  g.strokeStyle = "#080713";
  for (const p of G0.spots) mound(g, p.x, ridge(p.x) + 2, 46, 30, createRng(seed + p.x));
  g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(G0.lamp.x, ridge(G0.lamp.x) + 2);
  g.lineTo(G0.lamp.x, G0.lamp.y);
  g.stroke();
  // Each moonflower stands on a visible green stem with two leaves; a closed bud or two nods
  // beside some of them on short side stems.
  const stem = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) => {
    for (const [color, width, dx, dy] of [
      ["rgba(140,148,220,0.35)", 2.2, 0.8, -0.6],
      ["#16211c", 1.4, 0, 0],
    ] as const) {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(x0 + dx, y0 + dy);
      g.quadraticCurveTo(cx + dx, cy + dy, x1 + dx, y1 + dy);
      g.stroke();
    }
  };
  g.lineCap = "round";
  for (const p of G0.spots) {
    const r = createRng(seed + p.x * 3);
    const base = ridge(p.x) + 2;
    const scale = 0.7 + r() * 0.4;
    const lean = (r() - 0.5) * 8;
    stem(p.x - lean, base, p.x - 5 + lean * 0.3, (p.y + base) / 2, p.x, p.y);
    for (const side of [-1, 1]) {
      const t = 0.3 + r() * 0.25;
      rimLeaf(g, p.x - lean * (1 - t), base - (base - p.y) * t, 6 + r() * 3, side * (1 + r() * 0.4), "#16211c", "rgba(140,148,220,0.3)");
    }
    if (r() < 0.55) {
      const side = r() < 0.5 ? -1 : 1;
      const bx = p.x - lean * 0.5 + side * (7 + r() * 5);
      const by = p.y + (base - p.y) * (0.25 + r() * 0.2);
      stem(p.x - lean * 0.55, base - (base - p.y) * 0.45, bx - side * 2, by + 4, bx, by);
      bloom(g, bx, by, p.r * 0.7, 0, 0, side * (0.4 + r() * 0.4));
    }
    bloom(g, p.x, p.y, p.r * scale, 0.9 + rand() * 0.1, 0, (rand() - 0.5) * 0.6, 1, 2.1);
  }
  return s;
}

/* ---------------------------------------------------------------- live plants */

/** A stage moonflower: stem and leaves from the bed, its head from bud to bloom, warmed by the lamp. */
export function stageFlower(g: G, x: number, bed: number, stem: number, lean: number, open: number, warm: number, locked: boolean, sway: number): { x: number; y: number; r: number } {
  const tipX = x + (lean + sway) * stem;
  const tipY = bed - stem;
  const leaf = locked ? "#221d26" : warm > 0.05 ? `rgb(${Math.round(16 + 46 * warm)},${Math.round(20 + 22 * warm)},${Math.round(18 + 4 * warm)})` : "#0a110f";
  g.strokeStyle = locked ? "#2e2733" : "#0d1612";
  g.lineWidth = 1.8;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x, bed + 2);
  g.quadraticCurveTo(x + lean * stem * 0.2, bed - stem * 0.6, tipX, tipY);
  g.stroke();
  const r = clamp(stem * 0.2, 7, 15);
  g.fillStyle = leaf;
  for (let k = 0; k < 4; k++) {
    const t = 0.18 + k * 0.17;
    heart(g, x + (tipX - x) * t * t + (k % 2 ? 2 : -2), bed - stem * t, r * (locked ? 0.75 : 1.25 - t * 0.5), (k % 2 ? 1 : -1) * 1.15 + (locked ? 0.7 : 0));
  }
  if (locked) {
    // A dry bud nodding down from the bent stem tip.
    g.save();
    g.translate(tipX, tipY);
    g.rotate(2.3 + sway);
    g.fillStyle = "#4a3f44";
    g.beginPath();
    g.moveTo(0, r * 0.1);
    g.bezierCurveTo(r * 0.3, -r * 0.2, r * 0.18, -r * 0.8, 0, -r * 1.05);
    g.bezierCurveTo(-r * 0.18, -r * 0.8, -r * 0.3, -r * 0.2, 0, r * 0.1);
    g.fill();
    g.restore();
    return { x: tipX, y: tipY, r };
  }
  bloom(g, tipX, tipY, r, open, warm, lean * 0.6);
  return { x: tipX, y: tipY, r };
}

/** A tiny wrought-iron garden gate in front of the locked card's dry stem: wider than tall, a flat top rail and spear finials. */
export function gate(g: G, x: number, bed: number, s: number): void {
  const iron = "#0a0912";
  const w = s * 1.9;
  const top = bed - s * 1.15;
  g.strokeStyle = iron;
  g.fillStyle = iron;
  g.lineWidth = Math.max(1, s * 0.08);
  g.beginPath();
  for (let i = 0; i <= 6; i++) {
    const bx = x - w / 2 + (i / 6) * w;
    const tip = top - (i % 3 === 0 ? s * 0.3 : s * 0.18);
    g.moveTo(bx, bed + 2);
    g.lineTo(bx, tip);
  }
  g.moveTo(x - w / 2, top);
  g.lineTo(x + w / 2, top);
  g.moveTo(x - w / 2, bed - s * 0.35);
  g.lineTo(x + w / 2, bed - s * 0.35);
  g.stroke();
  const f = Math.max(1.2, s * 0.09);
  for (let i = 0; i <= 6; i++) {
    const bx = x - w / 2 + (i / 6) * w;
    const tip = top - (i % 3 === 0 ? s * 0.3 : s * 0.18);
    g.beginPath();
    g.moveTo(bx, tip - f * 1.8);
    g.lineTo(bx + f, tip);
    g.lineTo(bx, tip + f * 0.6);
    g.lineTo(bx - f, tip);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = "rgba(150,156,214,0.45)";
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(x + w / 2 + 0.8, bed);
  g.lineTo(x + w / 2 + 0.8, top - s * 0.3);
  g.moveTo(x - w / 2, top - 0.8);
  g.lineTo(x + w / 2, top - 0.8);
  g.stroke();
}

/** A chrysalis hanging on a silk thread, glowing faintly (one per upcoming novel). */
export function cocoon(g: G, x: number, top: number, y: number, s: number, sway: number, glow: number, tint: string): void {
  const cx = x + sway * (y - top) * 0.06;
  g.strokeStyle = "rgba(214,218,232,0.4)";
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(x, top);
  g.lineTo(cx, y - s * 1.3);
  g.stroke();
  const halo = g.createRadialGradient(cx, y, 0, cx, y, s * 4);
  halo.addColorStop(0, `rgba(214,230,160,${(0.22 * glow).toFixed(3)})`);
  halo.addColorStop(1, "rgba(214,230,160,0)");
  g.fillStyle = halo;
  g.fillRect(cx - s * 4, y - s * 4, s * 8, s * 8);
  const body = g.createLinearGradient(cx - s * 0.7, y - s, cx + s * 0.7, y + s);
  body.addColorStop(0, "#56663f");
  body.addColorStop(0.45, tint);
  body.addColorStop(0.75, "#e8eec2");
  body.addColorStop(1, "#4a5a36");
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(cx, y - s * 1.3);
  g.bezierCurveTo(cx + s * 0.8, y - s * 0.9, cx + s * 0.75, y + s * 0.8, cx, y + s * 1.45);
  g.bezierCurveTo(cx - s * 0.75, y + s * 0.8, cx - s * 0.8, y - s * 0.9, cx, y - s * 1.3);
  g.fill();
  g.strokeStyle = "rgba(248,246,214,0.45)";
  g.lineWidth = 0.6;
  g.beginPath();
  for (const k of [-0.4, 0, 0.4, 0.8]) {
    g.moveTo(cx - s * 0.6, y + s * k);
    g.quadraticCurveTo(cx, y + s * (k + 0.2), cx + s * 0.6, y + s * k);
  }
  g.stroke();
  g.fillStyle = "rgba(235,200,120,0.85)";
  for (const k of [-0.5, 0.3]) {
    g.beginPath();
    g.arc(cx + s * 0.18, y + s * k, s * 0.07, 0, TAU);
    g.fill();
  }
}
