// "Pages into stars" hub scene: an open grimoire on a ruined dais at dusk, whose
// pages tear loose, ride the wind around the page's cards, burn away into
// stardust, and leave new stars in the sky. Everything is drawn on one canvas.
//
// Everything expensive (sky, nebula, stars, ruins, the book's page block, fern
// sprites) is pre-rendered on resize from a fixed seed, so a resize re-lays the
// scene without reseeding and the frame loop composites a few images and
// advances a small simulation. Pure layout and motion maths live in grimoire-core.

import { createNoise2D, createRng, createScene, fbm2D } from "../_shared/scene-runtime";
import type { SceneFrame, SceneHandle, SceneSize } from "../_shared/scene-runtime";
import {
  CONSTELLATION_PATTERNS,
  TAU,
  BURST_COOLDOWN_S,
  buildWindLut,
  canBurst,
  clamp,
  computeLayout,
  isBehindCards,
  lerp,
  measureCardCover,
  pageFlipPoint,
  pageLifecycle,
  pageProfile,
  projectBook,
  rectDistance,
  smoothstep,
  windEntry,
} from "./grimoire-core";
import type { AvoidRect, BookPlacement, CardCover, GrimoireLayout, PageLife, Vec, WindLut } from "./grimoire-core";
import { flareSprite, mistTile, paintDither, radialSprite, release, surface } from "./scene-paint";

const SEED = 0x67726d;
const DPR_CAP = 1.5;
const MAX_PAGES = 14;
const DUST_CAP = 520;
const EMBER_CAP = 26;
const BORN_CAP = 14;
const SEED_CAP = 6;
const PULSE_CAP = 4;
const PAGE_SEGMENTS = 6;
const FLIP_SEGMENTS = 14;
const BORN_LIFE_S = 40;
const PAPER_LEVELS = 32;

export interface GrimoireOptions {
  /** Page text the stream dims behind and new stars keep clear of. */
  avoid?: string;
  /** Cards the scene is composed around. */
  avoidSoft?: string;
  /** Elements that take the pointer away from the scene. */
  pointerBlock?: string;
}

/* ---------------- sprites only this scene uses ---------------- */

function emberSprite(): HTMLCanvasElement {
  const { canvas, g } = surface(32, 12);
  const grad = g.createLinearGradient(0, 0, 32, 0);
  grad.addColorStop(0, "rgba(255,120,40,0)");
  grad.addColorStop(0.55, "rgba(255,160,70,0.8)");
  grad.addColorStop(1, "rgba(255,238,190,1)");
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, 6);
  g.quadraticCurveTo(18, 0, 32, 6);
  g.quadraticCurveTo(18, 12, 0, 6);
  g.fill();
  return canvas;
}

/** One light shaft: bright at the bottom edge, gone by the top, feathered at the sides. */
function raySprite(): HTMLCanvasElement {
  const { canvas, g } = surface(96, 512);
  const along = g.createLinearGradient(0, 512, 0, 0);
  along.addColorStop(0, "rgba(255,226,170,0.55)");
  along.addColorStop(0.35, "rgba(255,196,130,0.2)");
  along.addColorStop(1, "rgba(255,170,110,0)");
  g.fillStyle = along;
  g.beginPath();
  g.moveTo(40, 512);
  g.lineTo(0, 0);
  g.lineTo(96, 0);
  g.lineTo(56, 512);
  g.closePath();
  g.fill();
  g.globalCompositeOperation = "destination-out";
  const feather = g.createLinearGradient(0, 0, 96, 0);
  feather.addColorStop(0, "rgba(0,0,0,1)");
  feather.addColorStop(0.5, "rgba(0,0,0,0)");
  feather.addColorStop(1, "rgba(0,0,0,1)");
  g.fillStyle = feather;
  g.fillRect(0, 0, 96, 512);
  return canvas;
}

type Rgb = readonly [number, number, number];

const css = (r: number, g: number, b: number): string => `rgb(${Math.round(clamp(r, 0, 255))},${Math.round(clamp(g, 0, 255))},${Math.round(clamp(b, 0, 255))})`;
const mix = (a: Rgb, b: Rgb, t: number): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/* ---------------- sky ---------------- */

function renderNebula(L: GrimoireLayout, noise: (x: number, y: number) => number, noise2: (x: number, y: number) => number): HTMLCanvasElement {
  const { width: W, height: H } = L;
  const scale = 6;
  const w = Math.ceil(W / scale);
  const h = Math.ceil(H / scale);
  const { canvas, g } = surface(w, h);
  const image = g.createImageData(w, h);
  const data = image.data;
  // A diagonal band of sky from the book's side up towards the top-right corner.
  const ax = 0;
  const ay = H * 0.66;
  const bx = W;
  const by = -H * 0.1;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const nx = (by - ay) / len;
  const ny = -(bx - ax) / len;
  const bandWidth = Math.max(H * 0.3, 140);
  for (let y = 0; y < h; y++) {
    const py = y * scale;
    const vertical = 1 - smoothstep(H * 0.42, H * 0.82, py);
    for (let x = 0; x < w; x++) {
      const px = x * scale;
      const d = ((px - ax) * nx + (py - ay) * ny) / bandWidth;
      const band = Math.exp(-d * d * 1.6);
      const n1 = fbm2D(noise, px * 0.0026, py * 0.0026, 5);
      const n2 = fbm2D(noise2, px * 0.0048 + 9, py * 0.0048, 4);
      const cloud = clamp(n1 * 0.9 + 0.32, 0, 1);
      const a = clamp(cloud * cloud * band * vertical * 0.95, 0, 1);
      const t = clamp(n2 * 0.9 + 0.5, 0, 1);
      const i = (y * w + x) * 4;
      // Opaque colour scaled by coverage, added to the sky with "lighter": low-alpha
      // pixels lose their colour precision and upscale into a visible lattice.
      data[i] = lerp(52, 176, t) * a * 0.58;
      data[i + 1] = lerp(92, 48, t) * a * 0.58;
      data[i + 2] = lerp(214, 172, t) * a * 0.58;
      data[i + 3] = 255;
    }
  }
  g.putImageData(image, 0, 0);
  return canvas;
}

function paintGalaxy(gal: GrimoireLayout["galaxies"][number], dpr: number, rng: () => number): Painted {
  const { size, tilt } = gal;
  const half = Math.ceil(size * 1.1);
  const { canvas, g } = surface(half * 2 * dpr, half * 2 * dpr);
  g.setTransform(dpr, 0, 0, dpr, half * dpr, half * dpr);
  g.rotate(tilt);
  g.scale(1, 0.42);
  g.globalCompositeOperation = "lighter";
  const halo = g.createRadialGradient(0, 0, 0, 0, 0, size);
  halo.addColorStop(0, "rgba(232,226,255,0.62)");
  halo.addColorStop(0.16, "rgba(170,160,250,0.26)");
  halo.addColorStop(0.6, "rgba(120,110,220,0.06)");
  halo.addColorStop(1, "rgba(100,100,220,0)");
  g.fillStyle = halo;
  g.beginPath();
  g.arc(0, 0, size, 0, TAU);
  g.fill();
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < 620; i++) {
      const t = Math.pow(rng(), 0.8);
      const r = size * (0.06 + t * 0.94);
      const spread = (rng() + rng() - 1) * (0.28 + t * 0.34);
      const angle = t * Math.PI * 2.4 + arm * Math.PI + spread;
      const a = ((1 - t) * 0.34 + 0.05) * (0.4 + rng() * 0.6);
      const warm = rng() < 0.18;
      g.fillStyle = warm ? `rgba(255,214,190,${a})` : `rgba(198,204,255,${a})`;
      const s = 0.45 + rng() * 0.5;
      g.fillRect(Math.cos(angle) * r, Math.sin(angle) * r, s, s * 2);
    }
  }
  return { canvas, x: gal.x - half, y: gal.y - half, w: half * 2, h: half * 2 };
}

function paintMoon(moon: GrimoireLayout["moon"], dpr: number): Painted {
  const { r } = moon;
  const half = Math.ceil(r * 4.8);
  const { canvas, g } = surface(half * 2 * dpr, half * 2 * dpr);
  g.setTransform(dpr, 0, 0, dpr, half * dpr, half * dpr);
  const glow = g.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 4.6);
  glow.addColorStop(0, "rgba(226,226,255,0.3)");
  glow.addColorStop(0.3, "rgba(170,170,240,0.08)");
  glow.addColorStop(1, "rgba(140,140,230,0)");
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, 0, r * 4.6, 0, TAU);
  g.fill();

  // The whole disc in earthshine hides the stars behind it; the lit crescent goes on top.
  const dark = g.createRadialGradient(r * 0.2, 0, r * 0.1, 0, 0, r);
  dark.addColorStop(0, "rgb(30,28,62)");
  dark.addColorStop(1, "rgb(52,50,92)");
  g.fillStyle = dark;
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.fill();

  const { canvas: lit, g: m } = surface(r * 2.2 * dpr, r * 2.2 * dpr);
  m.setTransform(dpr, 0, 0, dpr, r * 1.1 * dpr, r * 1.1 * dpr);
  const disc = m.createRadialGradient(-r * 0.3, -r * 0.2, r * 0.1, 0, 0, r);
  disc.addColorStop(0, "#fffdf2");
  disc.addColorStop(0.75, "#efe8d6");
  disc.addColorStop(1, "#bdb6c8");
  m.fillStyle = disc;
  m.beginPath();
  m.arc(0, 0, r, 0, TAU);
  m.fill();
  m.globalCompositeOperation = "destination-out";
  m.beginPath();
  m.arc(-r * 0.46, -r * 0.24, r * 0.92, 0, TAU);
  m.fill();
  g.drawImage(lit, -r * 1.1, -r * 1.1, r * 2.2, r * 2.2);
  release(lit);
  return { canvas, x: moon.x - half, y: moon.y - half, w: half * 2, h: half * 2 };
}

function paintRidge(g: CanvasRenderingContext2D, W: number, H: number, base: number, amp: number, noise: (x: number, y: number) => number, seed: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W + 8; x += 8) {
    const n = fbm2D(noise, x * 0.0034 + seed, seed * 0.3, 4);
    g.lineTo(x, H * base - Math.abs(n) * amp - n * amp * 0.25);
  }
  g.lineTo(W, H);
  g.closePath();
  g.fill();
}

function paintBack(L: GrimoireLayout, dpr: number, nebula: HTMLCanvasElement, noise: (x: number, y: number) => number, star: HTMLCanvasElement, flare: HTMLCanvasElement): HTMLCanvasElement {
  const { width: W, height: H } = L;
  const rng = createRng(SEED ^ 0x5151);
  const { canvas: back, g } = surface(W * dpr, H * dpr);
  g.scale(dpr, dpr);

  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#03040f");
  sky.addColorStop(0.2, "#070923");
  sky.addColorStop(0.4, "#120e3c");
  sky.addColorStop(0.56, "#2a145c");
  sky.addColorStop(0.7, "#5c2069");
  sky.addColorStop(0.82, "#a24353");
  sky.addColorStop(0.92, "#d97f4e");
  sky.addColorStop(1, "#efb06c");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // Afterglow sits low on the right, away from the book's own light.
  const bloom = g.createRadialGradient(W * 0.66, H * 1.04, 0, W * 0.66, H * 1.04, Math.max(W, H) * 0.66);
  bloom.addColorStop(0, "rgba(255,206,140,0.42)");
  bloom.addColorStop(0.4, "rgba(240,120,90,0.14)");
  bloom.addColorStop(1, "rgba(200,70,110,0)");
  g.fillStyle = bloom;
  g.fillRect(0, 0, W, H);

  g.globalCompositeOperation = "lighter";
  g.imageSmoothingQuality = "high";
  g.drawImage(nebula, 0, 0, W, H);
  g.globalCompositeOperation = "source-over";

  // Stars: many faint dots, some soft ones, a handful of flares. Dusk washes them out low down.
  const fade = (y: number) => 1 - smoothstep(H * 0.36, H * 0.76, y);
  const faint = Math.round(clamp((W * H) / 900, 240, 2400));
  for (let i = 0; i < faint; i++) {
    const x = rng() * W;
    const y = rng() * H * 0.82;
    const a = fade(y) * (0.18 + rng() * 0.62);
    if (a <= 0.01) continue;
    const hue = rng();
    g.fillStyle = hue < 0.14 ? `rgba(255,222,190,${a})` : hue < 0.4 ? `rgba(190,206,255,${a})` : `rgba(255,255,255,${a})`;
    const s = rng() < 0.08 ? 1.6 : 0.8 + rng() * 0.5;
    g.fillRect(x, y, s, s);
  }
  g.globalCompositeOperation = "lighter";
  const soft = Math.round(clamp((W * H) / 12000, 40, 180));
  for (let i = 0; i < soft; i++) {
    const x = rng() * W;
    const y = rng() * H * 0.72;
    const s = 4 + rng() * 7;
    g.globalAlpha = fade(y) * (0.3 + rng() * 0.6);
    g.drawImage(star, x - s / 2, y - s / 2, s, s);
  }
  const bright = Math.round(clamp((W * H) / 110000, 6, 20));
  for (let i = 0; i < bright; i++) {
    const x = rng() * W;
    const y = rng() * H * 0.6;
    const s = 14 + rng() * 20;
    g.globalAlpha = fade(y) * (0.5 + rng() * 0.5);
    g.drawImage(flare, x - s / 2, y - s / 2, s, s);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";

  // Faint constellation lines live in the back image; the active one is drawn brighter on top.
  g.globalCompositeOperation = "lighter";
  g.lineWidth = 0.7;
  g.strokeStyle = "rgba(170,196,255,0.12)";
  for (const c of L.constellations) {
    const p = CONSTELLATION_PATTERNS[c.pattern];
    g.beginPath();
    for (const [a, b] of p.edges) {
      g.moveTo(c.x + p.stars[a][0] * c.scale, c.y + p.stars[a][1] * c.scale);
      g.lineTo(c.x + p.stars[b][0] * c.scale, c.y + p.stars[b][1] * c.scale);
    }
    g.stroke();
    for (const [sx, sy] of p.stars) {
      g.globalAlpha = 0.65;
      g.drawImage(star, c.x + sx * c.scale - 4, c.y + sy * c.scale - 4, 8, 8);
    }
    g.globalAlpha = 1;
  }
  g.globalCompositeOperation = "source-over";

  paintRidge(g, W, H, 0.915, H * 0.075, noise, 3.2, "rgba(112,48,92,0.5)");
  paintRidge(g, W, H, 0.955, H * 0.05, noise, 8.7, "rgba(66,28,70,0.82)");
  // The hub's footer sits on this stretch once the page is scrolled to its end.
  const shade = g.createLinearGradient(0, H - Math.min(150, H * 0.2), 0, H);
  shade.addColorStop(0, "rgba(14,8,22,0)");
  shade.addColorStop(0.55, "rgba(14,8,22,0.62)");
  shade.addColorStop(1, "rgba(14,8,22,0.86)");
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);
  paintDither(g, W, H, rng);
  return back;
}

/* ---------------- ruins ---------------- */

const STONE_DARK: Rgb = [30, 25, 44];
const STONE_MID: Rgb = [74, 63, 84];
const STONE_WARM: Rgb = [176, 118, 80];

function stoneTone(lit: number, tone: number): [number, number, number] {
  const c = mix(mix(STONE_DARK, STONE_MID, 0.62), STONE_WARM, Math.pow(clamp(lit, 0, 1), 1.75));
  return [c[0] * tone, c[1] * tone, c[2] * tone];
}

function stoneBlock(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lit: number, rng: () => number): void {
  const [r, gr, b] = stoneTone(lit, 0.82 + rng() * 0.36);
  const fill = g.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, css(r * 1.2, gr * 1.17, b * 1.12));
  fill.addColorStop(0.35, css(r, gr, b));
  fill.addColorStop(1, css(r * 0.64, gr * 0.6, b * 0.66));
  g.fillStyle = fill;
  const c = Math.min(h, w) * 0.18;
  const j = () => (rng() - 0.5) * h * 0.1;
  g.beginPath();
  g.moveTo(x + c, y + j());
  g.lineTo(x + w - c, y + j());
  g.quadraticCurveTo(x + w, y, x + w + j(), y + c);
  g.lineTo(x + w + j(), y + h - c);
  g.quadraticCurveTo(x + w, y + h, x + w - c, y + h + j());
  g.lineTo(x + c, y + h + j());
  g.quadraticCurveTo(x, y + h, x + j(), y + h - c);
  g.lineTo(x + j(), y + c);
  g.quadraticCurveTo(x, y, x + c, y + j());
  g.closePath();
  g.fill();
  g.strokeStyle = lit > 0.2 ? `rgba(255,216,160,${0.1 + lit * 0.3})` : "rgba(176,160,226,0.2)";
  g.lineWidth = Math.max(0.6, h * 0.035);
  g.beginPath();
  g.moveTo(x + c, y + h * 0.03);
  g.lineTo(x + w - c, y + h * 0.03);
  g.stroke();
  if (rng() < 0.4) {
    g.strokeStyle = "rgba(14,8,18,0.4)";
    g.lineWidth = 0.7;
    let cx = x + w * (0.2 + rng() * 0.6);
    let cy = y + h * 0.05;
    g.beginPath();
    g.moveTo(cx, cy);
    const segments = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < segments; i++) {
      cx += (rng() - 0.5) * w * 0.2;
      cy += h * (0.2 + rng() * 0.3);
      g.lineTo(cx, Math.min(cy, y + h));
    }
    g.stroke();
  }
  const specks = Math.round((w * h) / 90);
  for (let i = 0; i < specks; i++) {
    g.fillStyle = rng() < 0.5 ? "rgba(255,230,200,0.05)" : "rgba(10,6,14,0.1)";
    g.fillRect(x + rng() * w, y + rng() * h, 1, 1);
  }
}

function mossPatch(g: CanvasRenderingContext2D, x: number, y: number, size: number, lit: number, rng: () => number): void {
  const dark: Rgb = [38, 56, 40];
  const light: Rgb = [132, 134, 62];
  const blobs = 6 + Math.floor(rng() * 8);
  for (let i = 0; i < blobs; i++) {
    const c = mix(dark, light, clamp(lit * 0.8 + rng() * 0.3, 0, 1));
    g.fillStyle = `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${0.45 + rng() * 0.4})`;
    g.beginPath();
    g.ellipse(x + (rng() - 0.5) * size * 2, y + (rng() - 0.4) * size * 0.5, size * (0.2 + rng() * 0.36), size * (0.1 + rng() * 0.16), rng() - 0.5, 0, TAU);
    g.fill();
  }
}

function hangingVine(g: CanvasRenderingContext2D, x: number, y: number, length: number, lit: number, rng: () => number): void {
  const col = mix([28, 44, 34], [120, 124, 60], clamp(lit, 0, 1));
  const stroke = css(col[0], col[1], col[2]);
  g.strokeStyle = stroke;
  g.fillStyle = stroke;
  g.lineWidth = 0.9;
  const bend = (rng() - 0.5) * length * 0.4;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + bend, y + length * 0.5, x + bend * 0.5, y + length);
  g.stroke();
  const leaves = Math.round(length / 7);
  for (let i = 1; i <= leaves; i++) {
    const t = i / leaves;
    const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * (x + bend) + t * t * (x + bend * 0.5);
    const py = y + length * t;
    const size = 1.6 + rng() * 2.2;
    g.beginPath();
    g.ellipse(px + (rng() - 0.5) * 4, py, size, size * 0.55, rng() * 3, 0, TAU);
    g.fill();
  }
}

function brokenColumn(g: CanvasRenderingContext2D, x: number, base: number, w: number, h: number, litLeft: number, rng: () => number): void {
  const dark = stoneTone(0, 0.8);
  const lit = stoneTone(litLeft, 1.12);
  const body = g.createLinearGradient(x, 0, x + w, 0);
  body.addColorStop(0, css(dark[0], dark[1], dark[2]));
  body.addColorStop(0.26, css(lit[0], lit[1], lit[2]));
  body.addColorStop(0.6, css((lit[0] + dark[0]) / 2, (lit[1] + dark[1]) / 2, (lit[2] + dark[2]) / 2));
  body.addColorStop(1, css(dark[0] * 0.7, dark[1] * 0.7, dark[2] * 0.7));
  g.fillStyle = body;
  const top = base - h;
  const teeth = 5;
  g.beginPath();
  g.moveTo(x, base);
  g.lineTo(x, top + h * 0.1);
  for (let i = 1; i <= teeth; i++) {
    g.lineTo(x + (w * i) / teeth, top + h * (i % 2 === 0 ? 0.03 : 0.1) * (1 + rng()));
  }
  g.lineTo(x + w, base);
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(12,8,18,0.34)";
  g.lineWidth = Math.max(0.7, w * 0.03);
  for (let i = 1; i < 5; i++) {
    const fx = x + (w * i) / 5;
    g.beginPath();
    g.moveTo(fx, top + h * 0.16);
    g.lineTo(fx, base);
    g.stroke();
  }
  stoneBlock(g, x - w * 0.16, base - w * 0.18, w * 1.32, w * 0.26, litLeft * 0.7, rng);
}

interface Painted {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
}

function paintRuins(L: GrimoireLayout, dpr: number, noise: (x: number, y: number) => number): Painted {
  const { width: W, height: H, book } = L;
  const U = book.w;
  const by = book.y;
  const rng = createRng(SEED ^ 0x7a7a);
  const reach = Math.min(W, book.x + U * 2.5);
  const top = Math.max(0, Math.floor(by - U * 1.5));
  const rectH = H - top + 2;
  const { canvas, g } = surface(reach * dpr, rectH * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, -top * dpr);

  const lightX = book.x;
  const lightY = by - U * 0.24;
  const litAt = (x: number, y: number) => clamp(1 - Math.hypot(x - lightX, (y - lightY) * 1.15) / (U * 1.12), 0, 1);

  const backY = by - U * 0.44;
  const frontY = by + U * 0.05;
  const rowH = U * 0.088;

  // The broken wall behind the book's left page: courses over a dark backing, so a
  // missing stone reads as a hole in the wall and not as sky. Its top edge is broken
  // unevenly, and one pier on the far side still stands to full height.
  const wallRight = book.x - U * 0.1;
  const rows = 11;
  const pierRight = Math.max(U * 0.12, wallRight * 0.34);
  const wallEdge = (r: number) => {
    const taper = lerp(1, 0.16, Math.pow(r / rows, 1.15));
    const broken = fbm2D(noise, r * 0.46 + 2.4, 7.3, 3) * U * 0.36;
    return Math.max(r / rows < 0.85 ? pierRight : 0, wallRight * taper + broken * (r / rows));
  };
  g.fillStyle = "#15111f";
  g.beginPath();
  g.moveTo(-2, backY);
  for (let r = 0; r < rows; r++) {
    const edge = wallEdge(r) - U * 0.02;
    g.lineTo(edge, backY - r * rowH);
    g.lineTo(edge, backY - (r + 1) * rowH);
  }
  g.lineTo(-2, backY - rows * rowH);
  g.closePath();
  g.fill();
  for (let r = 0; r < rows; r++) {
    const y = backY - (r + 1) * rowH;
    const reachX = wallEdge(r);
    let x = -U * 0.06 - rng() * U * 0.1;
    while (x < reachX) {
      const w = Math.min(U * (0.1 + rng() * 0.16), reachX - x + U * 0.015);
      const gone = r > 1 && x > pierRight && rng() < 0.08 + (r / rows) * 0.2;
      if (!gone) {
        stoneBlock(g, x, y, w, rowH * 1.02, litAt(x + w / 2, y + rowH / 2), rng);
        if (r >= 2 && rng() < 0.22) mossPatch(g, x + w / 2, y + rowH * 0.06, U * 0.04, litAt(x, y), rng);
        if (r >= 3 && rng() < 0.16) hangingVine(g, x + w * rng(), y + rowH * 0.2, U * (0.12 + rng() * 0.3), litAt(x, y), rng);
      }
      x += w;
    }
  }

  // A far stump and a second one behind the right page.
  brokenColumn(g, book.x + U * 0.92, backY + U * 0.05, U * 0.12, U * 0.5, litAt(book.x + U * 0.8, backY) * 0.8, rng);

  // The dais top, paved in rows that narrow towards the back.
  const deckRight = (y: number) => lerp(book.x + U * 0.86, book.x + U * 1.06, clamp((y - backY) / (frontY - backY), 0, 1));
  const courses = 6;
  for (let i = 0; i < courses; i++) {
    const t0 = Math.pow(i / courses, 1.25);
    const t1 = Math.pow((i + 1) / courses, 1.25);
    const y0 = lerp(backY, frontY, t0);
    const y1 = lerp(backY, frontY, t1);
    const end = deckRight(y1);
    const slab = U * lerp(0.14, 0.24, t1);
    let x = -rng() * slab;
    while (x < end) {
      const w = Math.min(slab * (0.7 + rng() * 0.6), end - x + 2);
      const lit = litAt(x + w / 2, (y0 + y1) / 2);
      const [r, gr, b] = stoneTone(lit, 0.9 + rng() * 0.26);
      g.fillStyle = css(r * 1.1, gr * 1.08, b * 1.04);
      g.fillRect(x, y0, w, y1 - y0 + 0.5);
      g.strokeStyle = "rgba(16,10,20,0.5)";
      g.lineWidth = 0.7;
      g.strokeRect(x, y0, w, y1 - y0);
      x += w;
    }
  }

  // Front face and the steps running down to the right.
  let stepY = frontY;
  let stepEnd = book.x + U * 1.06;
  let step = 0;
  while (stepY < H + 2) {
    const rise = U * 0.066;
    let x = -rng() * U * 0.1;
    while (x < stepEnd) {
      const w = U * (0.14 + rng() * 0.14);
      stoneBlock(g, x, stepY, Math.min(w, stepEnd - x + 1), rise, litAt(x + w / 2, stepY) * 0.82, rng);
      x += w;
    }
    const tread = U * 0.034;
    const end = stepEnd + U * 0.17;
    const grad = g.createLinearGradient(0, stepY + rise, 0, stepY + rise + tread);
    const a = stoneTone(litAt(book.x + U * 0.4, stepY + rise) * 0.8, 1.1);
    grad.addColorStop(0, css(a[0], a[1], a[2]));
    grad.addColorStop(1, css(a[0] * 0.8, a[1] * 0.8, a[2] * 0.82));
    g.fillStyle = grad;
    g.fillRect(-2, stepY + rise, end + 2, tread);
    stepY += rise + tread;
    stepEnd = end;
    step++;
    if (step > 40) break;
  }

  // Rubble and growth on the dais.
  for (let i = 0; i < 5; i++) {
    const x = book.x + U * (0.62 + rng() * 0.42);
    const y = lerp(backY, frontY, 0.2 + rng() * 0.6);
    const s = U * (0.04 + rng() * 0.05);
    stoneBlock(g, x, y - s, s * (1.2 + rng()), s, litAt(x, y), rng);
  }
  for (let i = 0; i < 14; i++) {
    const x = rng() * Math.max(book.x + U * 1.1, 40);
    const y = rng() < 0.5 ? frontY + rng() * U * 0.04 : lerp(backY, frontY, rng());
    if (Math.abs(x - book.x) < U * 0.6 && y < frontY) continue;
    mossPatch(g, x, y, U * (0.025 + rng() * 0.03), litAt(x, y), rng);
  }

  // Warm light pooled on the stone around the book, and shadow gathering beyond it.
  g.globalCompositeOperation = "lighter";
  const pool = g.createRadialGradient(lightX, by - U * 0.1, 0, lightX, by - U * 0.1, U * 1);
  pool.addColorStop(0, "rgba(255,178,104,0.22)");
  pool.addColorStop(0.5, "rgba(214,120,72,0.07)");
  pool.addColorStop(1, "rgba(180,90,60,0)");
  g.fillStyle = pool;
  g.fillRect(0, top, reach, rectH);
  g.globalCompositeOperation = "source-atop";
  const edge = g.createLinearGradient(lightX + U * 0.9, 0, reach, 0);
  edge.addColorStop(0, "rgba(10,6,16,0)");
  edge.addColorStop(1, "rgba(10,6,16,0.62)");
  g.fillStyle = edge;
  g.fillRect(0, top, reach, rectH);
  const ground = g.createLinearGradient(0, Math.min(by + U * 0.1, H - 150), 0, H);
  ground.addColorStop(0, "rgba(10,6,16,0)");
  ground.addColorStop(0.6, "rgba(10,6,16,0.5)");
  ground.addColorStop(1, "rgba(10,6,16,0.82)");
  g.fillStyle = ground;
  g.fillRect(0, top, reach, rectH);
  g.globalCompositeOperation = "source-over";

  return { canvas, x: 0, y: top, w: reach, h: rectH };
}

/* ---------------- ferns ---------------- */

interface Clump {
  canvas: HTMLCanvasElement;
  x: number;
  base: number;
  anchorX: number;
  w: number;
  h: number;
  phase: number;
  rate: number;
  give: number;
  shear: number;
}

function buildClump(x: number, base: number, size: number, lit: number, dpr: number, rng: () => number): Clump {
  const w = size * 2.2;
  const h = size * 1.1;
  const { canvas, g } = surface(w * dpr, h * dpr);
  g.scale(dpr, dpr);
  const fronds = 5 + Math.floor(rng() * 4);
  const anchorX = w / 2;
  for (let i = 0; i < fronds; i++) {
    const t = fronds > 1 ? i / (fronds - 1) : 0.5;
    const angle = lerp(-1.25, 1.25, t) + (rng() - 0.5) * 0.16;
    const length = size * (0.62 + rng() * 0.42) * (1 - Math.abs(angle) * 0.18);
    const col = mix([18, 32, 30], [120, 118, 56], clamp(lit * (0.5 + rng() * 0.6), 0, 1));
    const fill = css(col[0], col[1], col[2]);
    const tipX = anchorX + Math.sin(angle) * length;
    const tipY = h - Math.cos(angle) * length * 0.9;
    const ctrlX = anchorX + Math.sin(angle) * length * 0.32;
    const ctrlY = h - Math.cos(angle * 0.5) * length * 0.72;
    g.strokeStyle = fill;
    g.lineWidth = Math.max(0.7, size * 0.012);
    g.beginPath();
    g.moveTo(anchorX, h);
    g.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
    g.stroke();
    g.fillStyle = fill;
    const leaflets = 12 + Math.floor(rng() * 6);
    for (let k = 2; k < leaflets; k++) {
      const q = k / leaflets;
      const u = 1 - q;
      const px = u * u * anchorX + 2 * u * q * ctrlX + q * q * tipX;
      const py = u * u * h + 2 * u * q * ctrlY + q * q * tipY;
      const dx = 2 * u * (ctrlX - anchorX) + 2 * q * (tipX - ctrlX);
      const dy = 2 * u * (ctrlY - h) + 2 * q * (tipY - ctrlY);
      const a = Math.atan2(dy, dx);
      const leaf = size * 0.13 * Math.sin(Math.PI * Math.min(1, q * 1.05)) + 1;
      for (const side of [-1, 1]) {
        const la = a + side * 1.05;
        g.beginPath();
        g.moveTo(px, py);
        g.quadraticCurveTo(px + Math.cos(la - 0.3) * leaf * 0.6, py + Math.sin(la - 0.3) * leaf * 0.6, px + Math.cos(la) * leaf, py + Math.sin(la) * leaf);
        g.quadraticCurveTo(px + Math.cos(la + 0.3) * leaf * 0.6, py + Math.sin(la + 0.3) * leaf * 0.6, px, py);
        g.fill();
      }
    }
  }
  return { canvas, x, base, anchorX, w, h, phase: rng() * TAU, rate: 0.5 + rng() * 0.5, give: 0.02 + rng() * 0.03, shear: 0 };
}

function buildClumps(L: GrimoireLayout, dpr: number): Clump[] {
  const { book, height: H } = L;
  const U = book.w;
  const rng = createRng(SEED ^ 0x1e1e);
  const by = book.y;
  const spots: Array<[number, number, number, number]> = [
    [book.x - U * 0.54, by + U * 0.07, U * 0.3, 0.75],
    [book.x + U * 0.66, by + U * 0.06, U * 0.26, 0.7],
    [book.x + U * 0.08, H + 4, U * 0.34, 0.3],
    [book.x - U * 0.3, H + 6, U * 0.26, 0.2],
    [book.x + U * 0.6, H + 6, U * 0.3, 0.18],
    [book.x + U * 1.24, H + 4, U * 0.34, 0.1],
  ];
  return spots.map(([x, base, size, lit]) => buildClump(x, base, size, lit, dpr, rng));
}

/* ---------------- the book ---------------- */

interface PaintedBook extends Painted {
  glow: HTMLCanvasElement;
}

const tmp: Vec = { x: 0, y: 0 };

function paperColor(level: number): string {
  return PAPER[clamp(Math.round(level * (PAPER_LEVELS - 1)), 0, PAPER_LEVELS - 1)];
}

const PAPER: string[] = [];
const PAPER_BACK: string[] = [];
for (let i = 0; i < PAPER_LEVELS; i++) {
  const t = i / (PAPER_LEVELS - 1);
  const front = mix([116, 86, 66], [244, 228, 192], t);
  PAPER.push(css(front[0], front[1], front[2]));
  const rear = mix([96, 66, 56], [222, 192, 148], t);
  PAPER_BACK.push(css(rear[0], rear[1], rear[2]));
}

function uvPath(g: CanvasRenderingContext2D, book: BookPlacement, pts: ReadonlyArray<readonly [number, number]>, close = false): void {
  g.beginPath();
  pts.forEach(([u, v], i) => {
    projectBook(book, u, v, pageProfile(u), tmp);
    if (i === 0) g.moveTo(tmp.x, tmp.y);
    else g.lineTo(tmp.x, tmp.y);
  });
  if (close) g.closePath();
}

function strokeSpan(g: CanvasRenderingContext2D, book: BookPlacement, u0: number, v0: number, u1: number, v1: number, steps = 10): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) pts.push([lerp(u0, u1, i / steps), lerp(v0, v1, i / steps)]);
  uvPath(g, book, pts);
  g.stroke();
}

/** The gold work printed on the open pages: frames, a seal on the left, runes and rules on the right. */
function drawOrnaments(g: CanvasRenderingContext2D, book: BookPlacement, width: number): void {
  g.lineWidth = width;
  for (const side of [-1, 1]) {
    const a = side * 0.09;
    const b = side * 0.93;
    strokeSpan(g, book, a, 0.07, b, 0.07);
    strokeSpan(g, book, a, 0.93, b, 0.93);
    strokeSpan(g, book, b, 0.07, b, 0.93, 4);
    strokeSpan(g, book, a, 0.07, a, 0.93, 4);
    g.lineWidth = width * 0.6;
    strokeSpan(g, book, side * 0.13, 0.12, side * 0.89, 0.12);
    strokeSpan(g, book, side * 0.13, 0.88, side * 0.89, 0.88);
    g.lineWidth = width;
  }
  // The seal: rings and spokes on the left page.
  const cu = -0.5;
  const cv = 0.5;
  const ringPath = (radius: number) => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU;
      pts.push([cu + Math.cos(a) * radius, cv + Math.sin(a) * radius * 1.5]);
    }
    uvPath(g, book, pts);
    g.stroke();
  };
  ringPath(0.26);
  g.lineWidth = width * 0.6;
  ringPath(0.21);
  ringPath(0.1);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const c = Math.cos(a);
    const s = Math.sin(a) * 1.5;
    strokeSpan(g, book, cu + c * 0.11, cv + s * 0.11, cu + c * 0.2, cv + s * 0.2, 2);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.26;
    const c = Math.cos(a);
    const s = Math.sin(a) * 1.5;
    const c2 = Math.cos(a + Math.PI / 3);
    const s2 = Math.sin(a + Math.PI / 3) * 1.5;
    strokeSpan(g, book, cu + c * 0.1, cv + s * 0.1, cu + c2 * 0.1, cv + s2 * 0.1, 2);
  }
  g.lineWidth = width;
  // A rune band across the top of the right page.
  for (let i = 0; i < 6; i++) {
    const u = 0.2 + i * 0.12;
    const v = 0.78;
    strokeSpan(g, book, u, v - 0.04, u, v + 0.04, 2);
    strokeSpan(g, book, u - 0.03, v + (i % 2 === 0 ? 0.02 : -0.02), u + 0.03, v - (i % 2 === 0 ? 0.02 : -0.02), 2);
  }
}

function paintBook(L: GrimoireLayout, dpr: number): PaintedBook {
  const book = L.book;
  const U = book.w;
  const ox = book.x - U * 0.78;
  const oy = book.y - U * 0.8;
  const w = U * 1.56;
  const h = U * 1.04;
  const rng = createRng(SEED ^ 0xb00c);
  const { canvas, g } = surface(w * dpr, h * dpr);
  g.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr);

  const at = (u: number, v: number, z: number): Vec => {
    const out = { x: 0, y: 0 };
    return projectBook(book, u, v, z, out);
  };

  // Contact shadow on the stone.
  const shade = g.createRadialGradient(book.x, book.y - book.depth * 0.42, U * 0.1, book.x, book.y - book.depth * 0.42, U * 0.72);
  shade.addColorStop(0, "rgba(14,6,14,0.62)");
  shade.addColorStop(0.7, "rgba(14,6,14,0.34)");
  shade.addColorStop(1, "rgba(14,6,14,0)");
  g.fillStyle = shade;
  g.save();
  g.translate(book.x, book.y - book.depth * 0.42);
  g.scale(1, 0.46);
  g.translate(-book.x, -(book.y - book.depth * 0.42));
  g.fillRect(ox, oy - U, w, h + U * 2);
  g.restore();

  // Cover board with thickness.
  const coverZ = -0.05;
  const corners = [at(-1.07, -0.07, coverZ), at(1.07, -0.07, coverZ), at(1.07, 1.06, coverZ), at(-1.07, 1.06, coverZ)];
  const thick = U * 0.022;
  g.fillStyle = "#1a0d24";
  g.beginPath();
  g.moveTo(corners[0].x, corners[0].y);
  g.lineTo(corners[1].x, corners[1].y);
  g.lineTo(corners[1].x, corners[1].y + thick);
  g.lineTo(corners[0].x, corners[0].y + thick);
  g.closePath();
  g.fill();
  const leather = g.createLinearGradient(corners[0].x, 0, corners[1].x, 0);
  leather.addColorStop(0, "#2e1533");
  leather.addColorStop(0.5, "#5a2c4e");
  leather.addColorStop(1, "#351838");
  g.fillStyle = leather;
  g.beginPath();
  corners.forEach((c, i) => (i === 0 ? g.moveTo(c.x, c.y) : g.lineTo(c.x, c.y)));
  g.closePath();
  g.fill();
  const gold = g.createLinearGradient(corners[0].x, 0, corners[1].x, 0);
  gold.addColorStop(0, "#a97a34");
  gold.addColorStop(0.5, "#f0cc7c");
  gold.addColorStop(1, "#b98a3e");
  g.strokeStyle = gold;
  g.lineWidth = Math.max(1, U * 0.009);
  g.stroke();

  // Gold corner caps on the front corners.
  g.fillStyle = gold;
  for (const side of [-1, 1]) {
    const c0 = at(side * 1.07, -0.07, coverZ);
    const c1 = at(side * 0.9, -0.07, coverZ);
    const c2 = at(side * 1.07, 0.1, coverZ);
    g.beginPath();
    g.moveTo(c0.x, c0.y);
    g.lineTo(c1.x, c1.y);
    g.lineTo(c2.x, c2.y);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(c0.x, c0.y);
    g.lineTo(c1.x, c1.y);
    g.lineTo(c1.x, c1.y + thick);
    g.lineTo(c0.x, c0.y + thick);
    g.closePath();
    g.fill();
  }

  // The block of pages seen from the front edge.
  const span = 48;
  const topAt = (i: number) => at(-1 + (2 * i) / span, 0, pageProfile(-1 + (2 * i) / span));
  const stack = g.createLinearGradient(0, book.y - book.lift * 0.3, 0, book.y + U * 0.02);
  stack.addColorStop(0, "#efdcb6");
  stack.addColorStop(0.55, "#c9a97c");
  stack.addColorStop(1, "#8a6a4c");
  g.fillStyle = stack;
  g.beginPath();
  for (let i = 0; i <= span; i++) {
    const p = topAt(i);
    if (i === 0) g.moveTo(p.x, p.y);
    else g.lineTo(p.x, p.y);
  }
  for (let i = span; i >= 0; i--) {
    const p = at(-1 + (2 * i) / span, 0, -0.03);
    g.lineTo(p.x, p.y);
  }
  g.closePath();
  g.fill();
  g.lineWidth = 0.6;
  for (let k = 1; k <= 6; k++) {
    const f = k / 7;
    g.strokeStyle = `rgba(92,62,42,${0.34 - f * 0.12})`;
    g.beginPath();
    for (let i = 0; i <= span; i++) {
      const u = -1 + (2 * i) / span;
      const p = at(u, 0, lerp(-0.03, pageProfile(u), f));
      if (i === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    }
    g.stroke();
  }

  // Side faces.
  for (const side of [-1, 1]) {
    const a = at(side, 0, pageProfile(side));
    const b = at(side, 1, pageProfile(side));
    const c = at(side, 1, -0.03);
    const d = at(side, 0, -0.03);
    g.fillStyle = "#a98a64";
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.lineTo(c.x, c.y);
    g.lineTo(d.x, d.y);
    g.closePath();
    g.fill();
  }

  // The open pages, shaded strip by strip so the curve of the paper reads.
  const strips = 30;
  for (const side of [-1, 1]) {
    for (let i = 0; i < strips; i++) {
      const u0 = (side * i) / strips;
      const u1 = (side * (i + 1)) / strips;
      const a = (i + 0.5) / strips;
      const slope = (pageProfile(u1) - pageProfile(u0)) / (Math.abs(u1 - u0) || 1);
      // Paper facing the gutter's glow is lit; paper falling away to the edge goes darker.
      const level = clamp(0.8 + slope * 0.1 - a * 0.1, 0.4, 1);
      const color = paperColor(level);
      const p0 = at(u0, 0, pageProfile(u0));
      const p1 = at(u1, 0, pageProfile(u1));
      const p2 = at(u1, 1, pageProfile(u1));
      const p3 = at(u0, 1, pageProfile(u0));
      g.fillStyle = color;
      g.strokeStyle = color;
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(p0.x, p0.y);
      g.lineTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
      g.lineTo(p3.x, p3.y);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }

  // Aged tone and the shadow in the gutter.
  const gutterL = at(-0.1, 0, pageProfile(0.1));
  const gutterR = at(0.1, 0, pageProfile(0.1));
  const gutterShade = g.createLinearGradient(gutterL.x, 0, gutterR.x, 0);
  gutterShade.addColorStop(0, "rgba(70,40,26,0)");
  gutterShade.addColorStop(0.5, "rgba(70,40,26,0.6)");
  gutterShade.addColorStop(1, "rgba(70,40,26,0)");
  g.fillStyle = gutterShade;
  uvPath(g, book, [[-0.1, 0], [0, 0], [0.1, 0], [0.1, 1], [0, 1], [-0.1, 1]], true);
  g.fill();

  // Script lines on the right page, under the printed gold.
  g.strokeStyle = "rgba(96,64,46,0.5)";
  g.lineWidth = Math.max(0.6, U * 0.0035);
  for (let i = 0; i < 9; i++) {
    const v = 0.16 + i * 0.06;
    const end = 0.84 - rng() * 0.2;
    strokeSpan(g, book, 0.17, v, end, v);
  }

  // Printed gold.
  g.strokeStyle = gold;
  drawOrnaments(g, book, Math.max(0.8, U * 0.0062));

  // Ribbons hanging over the front edge.
  const ribbon = (u: number, length: number, width: number, color: string, tip: string) => {
    const top0 = at(u - width, 0, pageProfile(u));
    const top1 = at(u + width, 0, pageProfile(u));
    const endY = book.y + length;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(top0.x, top0.y);
    g.lineTo(top1.x, top1.y);
    g.lineTo(top1.x + U * 0.004, endY);
    g.lineTo((top0.x + top1.x) / 2, endY - U * 0.018);
    g.lineTo(top0.x - U * 0.004, endY);
    g.closePath();
    g.fill();
    g.strokeStyle = tip;
    g.lineWidth = Math.max(0.6, U * 0.004);
    g.stroke();
  };
  ribbon(0.03, U * 0.082, 0.028, "#7c2f7e", "#e2b866");
  ribbon(-0.09, U * 0.056, 0.02, "#b98a3e", "#f4d68c");

  // The glow layer: the same gold lit up, for the breathing pulse.
  const { canvas: glow, g: gl } = surface(w * dpr, h * dpr);
  gl.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr);
  gl.strokeStyle = "rgba(255,226,150,0.95)";
  gl.shadowColor = "rgba(255,190,90,0.9)";
  gl.shadowBlur = U * 0.03 * dpr;
  drawOrnaments(gl, book, Math.max(0.9, U * 0.0075));
  gl.shadowBlur = 0;

  return { canvas, x: ox, y: oy, w, h, glow };
}

/* ---------------- moving parts ---------------- */

interface Floater {
  active: boolean;
  /** Position along the wind, 0..1. */
  s: number;
  speed: number;
  /** Free offset from the wind path, pushed around by gusts and the pointer. */
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  aspect: number;
  yaw: number;
  pitch: number;
  roll: number;
  dyaw: number;
  dpitch: number;
  droll: number;
  curl: number;
  curlPhase: number;
  burnFrom: number;
  shedTimer: number;
  jag: Float32Array;
  x: number;
  y: number;
  /** The page's death was already turned into a new star. */
  seeded: boolean;
}

interface Dust {
  s: Float32Array;
  ox: Float32Array;
  oy: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  speed: Float32Array;
  age: Float32Array;
  life: Float32Array;
  size: Float32Array;
  phase: Float32Array;
  kind: Uint8Array;
  count: number;
}

interface Ember {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
}

interface Flip {
  active: boolean;
  p: number;
  duration: number;
  side: 1 | -1;
  tear: boolean;
  torn: boolean;
}

interface StarSeed {
  active: boolean;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  bend: number;
  age: number;
  duration: number;
}

interface BornStar {
  active: boolean;
  x: number;
  y: number;
  age: number;
  size: number;
  phase: number;
}

interface Pulse {
  active: boolean;
  x: number;
  y: number;
  age: number;
  radius: number;
}

interface Twinkle {
  x: number;
  y: number;
  size: number;
  rate: number;
  phase: number;
  base: number;
}

interface LiveConstellation {
  points: Array<[number, number]>;
  edges: ReadonlyArray<readonly [number, number]>;
}

interface Built {
  layout: GrimoireLayout;
  lut: WindLut;
  dim: Float32Array;
  /** Where a page may start on a phone: past the stretch the cards hide. */
  entry: number;
  cover: CardCover | null;
  back: HTMLCanvasElement;
  moon: Painted;
  galaxies: Painted[];
  ruins: Painted;
  book: PaintedBook;
  clumps: Clump[];
  mist: HTMLCanvasElement;
  twinkles: Twinkle[];
  constellations: LiveConstellation[];
}

export function createGrimoireScene(canvas: HTMLCanvasElement, container: HTMLElement, options: GrimoireOptions = {}): SceneHandle {
  const noise = createNoise2D(SEED);
  const noise2 = createNoise2D(SEED ^ 0x2b2b);
  const flowNoise = createNoise2D(SEED ^ 0x77);
  const rng = createRng(SEED ^ 0x3c3c);
  const range = (lo: number, hi: number) => lo + rng() * (hi - lo);

  const star = radialSprite(32, [
    [0, "rgba(255,255,255,1)"],
    [0.14, "rgba(236,240,255,0.8)"],
    [0.38, "rgba(200,212,255,0.16)"],
    [1, "rgba(170,190,255,0)"],
  ]);
  const flare = flareSprite(64, "rgba(255,250,235,0.95)", "rgba(240,240,255,0.85)");
  const sparkGold = flareSprite(32, "rgba(255,226,150,1)", "rgba(255,218,140,0.9)");
  const sprites = [
    radialSprite(24, [[0, "rgba(255,232,170,1)"], [0.28, "rgba(255,200,110,0.7)"], [1, "rgba(240,160,70,0)"]]),
    radialSprite(24, [[0, "rgba(255,252,240,1)"], [0.28, "rgba(255,240,210,0.6)"], [1, "rgba(240,220,200,0)"]]),
    radialSprite(24, [[0, "rgba(222,212,255,1)"], [0.28, "rgba(160,140,250,0.6)"], [1, "rgba(120,110,240,0)"]]),
    radialSprite(24, [[0, "rgba(255,200,130,1)"], [0.28, "rgba(255,140,70,0.65)"], [1, "rgba(240,90,50,0)"]]),
  ];
  const coreGlow = radialSprite(256, [
    [0, "rgba(255,246,214,0.95)"],
    [0.1, "rgba(255,226,160,0.72)"],
    [0.3, "rgba(255,186,104,0.26)"],
    [0.62, "rgba(240,140,80,0.07)"],
    [1, "rgba(230,120,70,0)"],
  ]);
  const pageGlow = radialSprite(64, [
    [0, "rgba(255,226,170,0.5)"],
    [0.5, "rgba(255,190,110,0.12)"],
    [1, "rgba(255,170,90,0)"],
  ]);
  const ring = radialSprite(128, [
    [0, "rgba(255,226,170,0)"],
    [0.72, "rgba(255,226,170,0)"],
    [0.84, "rgba(255,226,170,0.42)"],
    [1, "rgba(255,226,170,0)"],
  ]);
  const ember = emberSprite();
  const ray = raySprite();

  let built: Built | null = null;
  let nebula: HTMLCanvasElement | null = null;
  let nebulaKey = "";
  let scale = 1;
  let scrollTop = 0;
  let dimScroll = Number.NaN;
  let pointerBlocked = false;

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
  let avoidDoc = measureAvoid();

  /* ---------------- pools ---------------- */

  const floaters: Floater[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    floaters.push({
      active: false, s: 0, speed: 0, ox: 0, oy: 0, vx: 0, vy: 0, age: 0, life: 1, size: 1, aspect: 1.3,
      yaw: 0, pitch: 0, roll: 0, dyaw: 0, dpitch: 0, droll: 0, curl: 0, curlPhase: 0, burnFrom: 1, shedTimer: 0,
      jag: new Float32Array(8), x: 0, y: 0, seeded: false,
    });
  }
  const dust: Dust = {
    s: new Float32Array(DUST_CAP),
    ox: new Float32Array(DUST_CAP),
    oy: new Float32Array(DUST_CAP),
    vx: new Float32Array(DUST_CAP),
    vy: new Float32Array(DUST_CAP),
    speed: new Float32Array(DUST_CAP),
    age: new Float32Array(DUST_CAP),
    life: new Float32Array(DUST_CAP),
    size: new Float32Array(DUST_CAP),
    phase: new Float32Array(DUST_CAP),
    kind: new Uint8Array(DUST_CAP),
    count: 0,
  };
  const embers: Ember[] = [];
  for (let i = 0; i < EMBER_CAP; i++) embers.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, size: 1 });
  const seeds: StarSeed[] = [];
  for (let i = 0; i < SEED_CAP; i++) seeds.push({ active: false, fromX: 0, fromY: 0, toX: 0, toY: 0, bend: 0, age: 0, duration: 1 });
  const born: BornStar[] = [];
  for (let i = 0; i < BORN_CAP; i++) born.push({ active: false, x: 0, y: 0, age: 0, size: 1, phase: 0 });
  const pulses: Pulse[] = [];
  for (let i = 0; i < PULSE_CAP; i++) pulses.push({ active: false, x: 0, y: 0, age: 0, radius: 1 });
  const flip: Flip = { active: false, p: 0, duration: 1, side: 1, tear: false, torn: false };

  const lifeOut: PageLife = { opacity: 0, burn: 0 };
  const flipX0 = new Float32Array(FLIP_SEGMENTS + 1);
  const flipY0 = new Float32Array(FLIP_SEGMENTS + 1);
  const flipX1 = new Float32Array(FLIP_SEGMENTS + 1);
  const flipY1 = new Float32Array(FLIP_SEGMENTS + 1);
  const flipU = new Float32Array(FLIP_SEGMENTS + 1);
  const flipZ = new Float32Array(FLIP_SEGMENTS + 1);
  const meshX = new Float32Array((PAGE_SEGMENTS + 1) * 2);
  const meshY = new Float32Array((PAGE_SEGMENTS + 1) * 2);

  let nextFlipAt = 2.5;
  let nextPageAt = 1;
  let dustCarry = 0;
  let glowBoost = 0;
  let lastBurstAt = -BURST_COOLDOWN_S;
  let seededFirst = false;
  let simTime = 0;
  let frameNo = 0;
  const wind = { x: 0, y: 0 };
  const pointerState = { x: 0, y: 0, lastX: -1, lastY: -1, glow: 0, movedAt: -10 };
  const activeConstellation = { index: 0, phase: 0 as 0 | 1 | 2, time: 0 };

  /* ---------------- spawning ---------------- */

  const lutAt = (lut: WindLut, s: number, out: Vec): Vec => {
    const f = clamp(s, 0, 1) * (lut.x.length - 1);
    const i = Math.min(lut.x.length - 2, Math.floor(f));
    const t = f - i;
    out.x = lerp(lut.x[i], lut.x[i + 1], t);
    out.y = lerp(lut.y[i], lut.y[i + 1], t);
    return out;
  };

  const spawnDust = (s: number, ox: number, oy: number, kind: number, size: number, life: number, speed: number, vx = 0, vy = 0) => {
    const limit = built ? built.layout.maxDust : DUST_CAP;
    if (dust.count >= limit) return;
    const i = dust.count++;
    dust.s[i] = s;
    dust.ox[i] = ox;
    dust.oy[i] = oy;
    dust.vx[i] = vx;
    dust.vy[i] = vy;
    dust.speed[i] = speed;
    dust.age[i] = 0;
    dust.life[i] = life;
    dust.size[i] = size;
    dust.phase[i] = rng() * TAU;
    dust.kind[i] = kind;
  };

  const spawnFloater = (L: GrimoireLayout, s: number, ageFraction = 0): Floater | null => {
    const active = floaters.reduce((n, f) => n + (f.active ? 1 : 0), 0);
    if (active >= L.maxPages) return null;
    const f = floaters.find((c) => !c.active);
    if (!f) return null;
    f.active = true;
    f.s = s;
    f.speed = range(58, 104);
    f.ox = range(-8, 8);
    f.oy = range(-8, 8);
    f.vx = 0;
    f.vy = 0;
    f.life = range(22, 36);
    f.age = f.life * ageFraction;
    f.size = L.pageWidth * range(0.78, 1.16);
    f.aspect = range(1.22, 1.42);
    f.yaw = range(-1.2, 1.2);
    f.pitch = range(-1.1, 1.1);
    f.roll = range(-Math.PI, Math.PI);
    f.dyaw = range(-0.55, 0.55);
    f.dpitch = range(0.25, 0.8) * (rng() < 0.5 ? -1 : 1);
    f.droll = range(-0.5, 0.5);
    f.curl = range(0.3, 0.8);
    f.curlPhase = range(0, TAU);
    f.burnFrom = rng() < 0.5 ? 1 : -1;
    f.shedTimer = range(0, 0.4);
    for (let i = 0; i < f.jag.length; i++) f.jag[i] = rng() * 2 - 1;
    f.seeded = false;
    return f;
  };

  const spawnEmber = (B: BookPlacement) => {
    const e = embers.find((c) => !c.active);
    if (!e) return;
    e.active = true;
    e.x = B.x + range(-0.16, 0.16) * B.w;
    e.y = B.y - B.depth * range(0.2, 0.7) - B.lift * 0.2;
    e.vx = range(-16, 22);
    e.vy = range(-74, -30);
    e.age = 0;
    e.life = range(1.4, 3.4);
    e.size = range(0.5, 1.2);
  };

  const skyClear = (x: number, y: number, pad: number): boolean => {
    for (const r of avoidDoc) {
      if (rectDistance(x, y + scrollTop, r) < pad) return false;
    }
    return true;
  };

  /** A spot in the visible sky for a new star: the top band, or a wide gutter. */
  const pickStarSpot = (L: GrimoireLayout, out: Vec): boolean => {
    const { width: W, height: H, gutters } = L;
    const band = Math.max(gutters.top, 60);
    for (let attempt = 0; attempt < 10; attempt++) {
      const zone = rng();
      if (zone < 0.6 || (gutters.right < 70 && gutters.left < 70)) {
        out.x = range(W * 0.05, W * 0.97);
        out.y = range(band * 0.08, band * 0.9);
      } else if (gutters.right >= gutters.left || zone < 0.8) {
        out.x = W - range(gutters.right * 0.15, gutters.right * 0.85);
        out.y = range(band, H * 0.62);
      } else {
        out.x = range(gutters.left * 0.15, gutters.left * 0.85);
        out.y = range(band, H * 0.5);
      }
      if (skyClear(out.x, out.y, 18)) return true;
    }
    return false;
  };

  const spot: Vec = { x: 0, y: 0 };
  const launchStar = (L: GrimoireLayout, x: number, y: number) => {
    const s = seeds.find((c) => !c.active);
    if (!s || !pickStarSpot(L, spot)) return;
    s.active = true;
    s.fromX = x;
    s.fromY = y;
    s.toX = spot.x;
    s.toY = spot.y;
    s.bend = range(-0.24, 0.24);
    s.age = 0;
    s.duration = range(2, 3.4);
  };

  const igniteStar = (x: number, y: number) => {
    let slot = born.find((b) => !b.active);
    if (!slot) slot = born.reduce((oldest, b) => (b.age > oldest.age ? b : oldest), born[0]);
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.age = 0;
    slot.size = range(15, 26);
    slot.phase = range(0, TAU);
  };

  const startFlip = (tear: boolean, duration: number) => {
    if (flip.active) return;
    flip.active = true;
    flip.p = 0;
    flip.duration = duration;
    flip.side = rng() < 0.7 ? 1 : -1;
    flip.tear = tear;
    flip.torn = false;
  };

  const addPulse = (x: number, y: number, radius: number) => {
    const p = pulses.find((c) => !c.active);
    if (!p) return;
    p.active = true;
    p.x = x;
    p.y = y;
    p.age = 0;
    p.radius = radius;
  };

  const burst = (L: GrimoireLayout) => {
    lastBurstAt = simTime;
    glowBoost = 1;
    const count = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      const f = spawnFloater(L, range(0, 0.02));
      if (f) {
        f.vx = range(-90, 140);
        f.vy = range(-160, -50);
        f.size *= 1.1;
      }
    }
    for (let i = 0; i < 70; i++) {
      spawnDust(range(0, 0.04), range(-30, 30), range(-20, 20), rng() < 0.6 ? 0 : rng() < 0.6 ? 1 : 3, range(4, 10), range(2.5, 8), range(60, 170), range(-130, 160), range(-170, -20));
    }
    for (let i = 0; i < 12; i++) spawnEmber(L.book);
    startFlip(false, 0.7);
    addPulse(L.book.x, L.book.y - L.book.depth * 0.5, L.book.w * 1.1);
  };

  const wakeConstellation = (L: GrimoireLayout, x: number, y: number) => {
    let best = -1;
    let bestD = Infinity;
    L.constellations.forEach((c, i) => {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) {
      activeConstellation.index = best;
      activeConstellation.phase = 0;
      activeConstellation.time = 0;
    }
  };

  /** Pages and dust already along the wind, so the scene opens mid-flow (and for the still frame). */
  const seedFlow = (L: GrimoireLayout, lut: WindLut, entry: number) => {
    const pages = Math.ceil(L.maxPages * 0.72);
    for (let i = 0; i < pages; i++) {
      const f = spawnFloater(L, lerp(entry, 1, clamp((i + rng() * 0.6) / pages, 0.01, 0.97)), range(0, 0.55));
      if (f) {
        lutAt(lut, f.s, tmp);
        f.x = tmp.x + f.ox;
        f.y = tmp.y + f.oy;
      }
    }
    const count = Math.round(L.maxDust * 0.82);
    for (let i = 0; i < count; i++) {
      const s = lerp(entry, 1, Math.pow(rng(), 1.15));
      const spread = 12 + s * 62;
      spawnDust(s, range(-spread, spread), range(-spread, spread), pickKind(s), dustSize(), range(5, 15), range(36, 118));
      dust.age[dust.count - 1] = dust.life[dust.count - 1] * rng() * 0.8;
    }
  };

  const pickKind = (s: number): number => {
    const r = rng();
    if (s < 0.25) return r < 0.62 ? 0 : r < 0.85 ? 3 : 1;
    if (s < 0.65) return r < 0.46 ? 0 : r < 0.76 ? 1 : r < 0.9 ? 2 : 3;
    return r < 0.34 ? 0 : r < 0.68 ? 1 : 2;
  };

  const dustSize = (): number => (rng() < 0.08 ? range(7, 12) : range(1.8, 5.2));

  /* ---------------- simulation ---------------- */

  const updateDim = (B: Built) => {
    const { lut, dim } = B;
    const hard = avoidDoc.filter((r) => !r.soft);
    for (let i = 0; i < dim.length; i++) {
      let d = 1;
      for (const r of hard) {
        const top = r.y - scrollTop;
        const dist = rectDistance(lut.x[i], lut.y[i], { x: r.x, y: top, w: r.w, h: r.h });
        if (dist < 26) d = Math.min(d, lerp(0.3, 1, dist / 26));
      }
      dim[i] = d;
    }
    dimScroll = scrollTop;
  };

  const step = (frame: Readonly<SceneFrame>) => {
    if (!built) return;
    const B = built;
    const L = B.layout;
    const lut = B.lut;
    const dt = frame.dt;
    const t = (simTime += dt);
    frameNo++;
    scrollTop = window.scrollY;
    if (Math.abs(scrollTop - dimScroll) > 2) updateDim(B);

    // Pointer: a wind that follows its motion, and a faint light where it rests.
    const pointer = frame.pointer;
    const usable = pointer.active && !pointerBlocked;
    let gx = 0;
    let gy = 0;
    if (usable) {
      if (pointerState.lastX >= 0 && dt > 0) {
        gx = clamp((pointer.x - pointerState.lastX) / dt, -900, 900);
        gy = clamp((pointer.y - pointerState.lastY) / dt, -900, 900);
        if (Math.abs(gx) + Math.abs(gy) > 8) pointerState.movedAt = t;
      }
      pointerState.lastX = pointer.x;
      pointerState.lastY = pointer.y;
    } else {
      pointerState.lastX = -1;
    }
    const glowTarget = usable && t - pointerState.movedAt < 5 ? 1 : 0;
    pointerState.glow += (glowTarget - pointerState.glow) * Math.min(1, dt * 3);
    pointerState.x = pointer.x;
    pointerState.y = pointer.y;
    wind.x += (gx * 0.12 - wind.x) * Math.min(1, dt * 2.4);
    wind.y += (gy * 0.12 - wind.y) * Math.min(1, dt * 2.4);

    if (pointer.justTapped && !pointerBlocked) {
      const b = L.book;
      const onBook = Math.hypot(pointer.x - b.x, (pointer.y - (b.y - b.depth * 0.5)) * 1.4) < b.w * 0.56;
      if (onBook) {
        if (canBurst(t, lastBurstAt)) burst(L);
      } else if (pointer.y < L.height * 0.8) {
        addPulse(pointer.x, pointer.y, 130);
        wakeConstellation(L, pointer.x, pointer.y);
      }
    }

    glowBoost = Math.max(0, glowBoost - dt * 1.1);

    // Turning pages.
    if (!flip.active && t >= nextFlipAt) {
      startFlip(rng() < 0.65, range(1.5, 2.3));
      nextFlipAt = t + range(6, 11);
    }
    if (flip.active) {
      flip.p += dt / flip.duration;
      if (flip.tear && !flip.torn && flip.p >= 0.42) {
        flip.torn = true;
        const f = spawnFloater(L, range(0, 0.012));
        if (f) {
          f.vx = range(-40, 60);
          f.vy = range(-70, -30);
          f.size *= 1.18;
        }
        for (let i = 0; i < 14; i++) {
          spawnDust(range(0, 0.02), range(-18, 18), range(-14, 14), rng() < 0.7 ? 0 : 1, range(3, 7), range(2, 6), range(60, 130), range(-40, 60), range(-60, -10));
        }
      }
      if (flip.p >= (flip.torn ? 0.62 : 1)) flip.active = false;
    }

    // A steady supply of loose pages.
    if (t >= nextPageAt) {
      spawnFloater(L, B.entry > 0 && rng() < 0.75 ? B.entry + range(0, 0.04) : range(0, 0.01));
      nextPageAt = t + range(2.6, 5.2);
    }

    // Floating pages.
    for (const f of floaters) {
      if (!f.active) continue;
      f.age += dt;
      f.s += (f.speed * dt) / lut.length;
      if (f.age >= f.life || f.s >= 1) {
        f.active = false;
        if (f.age >= f.life && !f.seeded && rng() < 0.75) launchStar(L, f.x, f.y);
        continue;
      }
      f.yaw += (f.dyaw + wind.x * 0.002) * dt;
      f.pitch += f.dpitch * dt;
      f.roll += f.droll * dt;

      lutAt(lut, f.s, tmp);
      const baseX = tmp.x;
      const baseY = tmp.y;
      const lane = 10 + f.s * 40;
      const nx = flowNoise(f.curlPhase, t * 0.16 + f.s * 3);
      const ny = flowNoise(f.curlPhase + 11, t * 0.14 + f.s * 3);
      f.vx += (nx * lane - f.ox) * dt * 0.5 + wind.x * dt * 0.6;
      f.vy += (ny * lane - f.oy) * dt * 0.5 + wind.y * dt * 0.6;

      if (usable) {
        const dx = baseX + f.ox - pointer.x;
        const dy = baseY + f.oy - pointer.y;
        const d = Math.hypot(dx, dy);
        const reach = 90;
        if (d < reach && d > 0.01) {
          const push = (1 - d / reach) * 240;
          f.vx += (dx / d) * push * dt;
          f.vy += (dy / d) * push * dt;
          f.dpitch += (f.dpitch > 0 ? 1 : -1) * dt * 2.2;
          // Touching a page scorches it: it reaches its burning stage sooner.
          if (d < 44) f.age = Math.max(f.age, Math.min(f.life * 0.62, f.age + dt * 12));
        }
      }
      f.dpitch = clamp(f.dpitch, -2.4, 2.4);
      const damp = Math.exp(-dt * 1.3);
      f.vx *= damp;
      f.vy *= damp;
      f.ox += f.vx * dt;
      f.oy += f.vy * dt;
      f.x = baseX + f.ox;
      f.y = baseY + f.oy;

      pageLifecycle(f.age, f.life, lifeOut);
      f.shedTimer -= dt;
      if (f.shedTimer <= 0 && lifeOut.opacity > 0.3) {
        const burning = lifeOut.burn > 0;
        f.shedTimer = burning ? range(0.02, 0.07) : range(0.25, 0.55);
        const count = burning ? 2 : 1;
        for (let i = 0; i < count; i++) {
          spawnDust(f.s, f.ox + range(-6, 6), f.oy + range(-6, 6), burning ? (rng() < 0.55 ? 3 : 0) : 0, burning ? range(2.4, 6) : range(1.8, 4), range(2.2, 6), f.speed * range(0.8, 1.3), range(-22, 22), range(-30, 12));
        }
      }
    }

    // Stardust riding the wind.
    const spawnRate = L.maxDust / 9.5;
    dustCarry += spawnRate * dt;
    while (dustCarry >= 1) {
      dustCarry -= 1;
      if (rng() < 0.56) {
        spawnDust(range(0, 0.018), range(-14, 14), range(-10, 10), pickKind(0), dustSize(), range(5, 14), range(44, 126), range(-34, 44), range(-70, -8));
      } else {
        const s = lerp(B.entry, 1, Math.pow(rng(), 1.1));
        const spread = 10 + s * 56;
        spawnDust(s, range(-spread, spread), range(-spread, spread), pickKind(s), dustSize(), range(4, 12), range(36, 110));
      }
    }
    const pushReach = 130;
    for (let i = dust.count - 1; i >= 0; i--) {
      dust.age[i] += dt;
      dust.s[i] += (dust.speed[i] * dt) / lut.length;
      if (dust.age[i] >= dust.life[i] || dust.s[i] >= 1) {
        const last = --dust.count;
        if (i !== last) {
          dust.s[i] = dust.s[last];
          dust.ox[i] = dust.ox[last];
          dust.oy[i] = dust.oy[last];
          dust.vx[i] = dust.vx[last];
          dust.vy[i] = dust.vy[last];
          dust.speed[i] = dust.speed[last];
          dust.age[i] = dust.age[last];
          dust.life[i] = dust.life[last];
          dust.size[i] = dust.size[last];
          dust.phase[i] = dust.phase[last];
          dust.kind[i] = dust.kind[last];
        }
        continue;
      }
      // Half the particles get a fresh swirl each frame; the eye cannot tell, the frame budget can.
      if (((i + frameNo) & 1) === 0) {
        const swirl = flowNoise(dust.s[i] * 7 + dust.phase[i], t * 0.11) * TAU;
        const strength = (12 + 42 * dust.s[i]) * dt * 2;
        dust.vx[i] += Math.cos(swirl) * strength;
        dust.vy[i] += Math.sin(swirl) * strength;
      }
      dust.vx[i] += wind.x * dt * 0.9;
      dust.vy[i] += wind.y * dt * 0.9;
      if (usable) {
        lutAt(lut, dust.s[i], tmp);
        const dx = tmp.x + dust.ox[i] - pointer.x;
        const dy = tmp.y + dust.oy[i] - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < pushReach * pushReach && d2 > 1) {
          const d = Math.sqrt(d2);
          const push = (1 - d / pushReach) * 340 * dt;
          dust.vx[i] += (dx / d) * push;
          dust.vy[i] += (dy / d) * push;
        }
      }
      const damp = 1 - Math.min(0.9, dt * 1.1);
      dust.vx[i] *= damp;
      dust.vy[i] *= damp;
      dust.ox[i] += dust.vx[i] * dt;
      dust.oy[i] += dust.vy[i] * dt;
    }

    // Embers from the gutter.
    if (rng() < dt * 5) spawnEmber(L.book);
    let liveEmbers = 0;
    for (const e of embers) {
      if (!e.active) continue;
      if (liveEmbers >= L.maxEmbers) {
        e.active = false;
        continue;
      }
      liveEmbers++;
      e.age += dt;
      if (e.age >= e.life) {
        e.active = false;
        continue;
      }
      const curl = flowNoise(e.x * 0.012, t * 0.4 + e.life) * 70;
      e.vx += (curl + wind.x) * dt;
      e.vy -= 8 * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }

    // Burned pages travelling up to become stars.
    for (const s of seeds) {
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= s.duration) {
        s.active = false;
        igniteStar(s.toX, s.toY);
      }
    }
    for (const b of born) {
      if (!b.active) continue;
      b.age += dt;
      if (b.age >= BORN_LIFE_S) b.active = false;
    }
    for (const p of pulses) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= 1.3) p.active = false;
    }

    // The constellation currently being traced: draw, hold, fade, next.
    if (L.constellations.length > 0) {
      const c = activeConstellation;
      c.time += dt;
      const limit = c.phase === 0 ? 3.2 : c.phase === 1 ? 6.5 : 2.6;
      if (c.time >= limit) {
        c.time = 0;
        if (c.phase === 2) {
          c.phase = 0;
          c.index = (c.index + 1) % L.constellations.length;
        } else {
          c.phase = (c.phase + 1) as 0 | 1 | 2;
        }
      }
    }
  };

  /* ---------------- drawing ---------------- */

  const drawFlip = (ctx: CanvasRenderingContext2D, book: BookPlacement) => {
    const fade = flip.torn ? clamp(1 - (flip.p - 0.42) / 0.2, 0, 1) : 1;
    if (fade <= 0) return;
    ctx.globalAlpha = fade;
    for (let i = 0; i <= FLIP_SEGMENTS; i++) {
      pageFlipPoint(i / FLIP_SEGMENTS, clamp(flip.p, 0, 1), tmp);
      const u = tmp.x * flip.side;
      const z = tmp.y;
      flipU[i] = u;
      flipZ[i] = z;
      projectBook(book, u, 0.015, z, tmp);
      flipX0[i] = tmp.x;
      flipY0[i] = tmp.y;
      projectBook(book, u, 0.985, z, tmp);
      flipX1[i] = tmp.x;
      flipY1[i] = tmp.y;
    }
    for (let i = 0; i < FLIP_SEGMENTS; i++) {
      const du = Math.abs(flipU[i + 1] - flipU[i]);
      const dz = Math.abs(flipZ[i + 1] - flipZ[i]) * 0.5;
      const facing = du / (Math.hypot(du, dz) || 1);
      const color = paperColor(clamp(0.52 + facing * 0.44 + (1 - i / FLIP_SEGMENTS) * 0.08, 0, 1));
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(flipX0[i], flipY0[i]);
      ctx.lineTo(flipX0[i + 1], flipY0[i + 1]);
      ctx.lineTo(flipX1[i + 1], flipY1[i + 1]);
      ctx.lineTo(flipX1[i], flipY1[i]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(96,64,46,0.32)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let k = 1; k < 8; k++) {
      const q = k / 8;
      for (let i = 2; i < FLIP_SEGMENTS - 1; i++) {
        const x = lerp(flipX0[i], flipX1[i], q);
        const y = lerp(flipY0[i], flipY1[i], q);
        if (i === 2) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,230,180,0.55)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(flipX0[FLIP_SEGMENTS], flipY0[FLIP_SEGMENTS]);
    ctx.lineTo(flipX1[FLIP_SEGMENTS], flipY1[FLIP_SEGMENTS]);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const drawFloater = (ctx: CanvasRenderingContext2D, f: Floater, dim: Float32Array, t: number) => {
    pageLifecycle(f.age, f.life, lifeOut);
    if (lifeOut.opacity <= 0.01) return;
    const idx = Math.floor(clamp(f.s, 0, 1) * (dim.length - 1));
    const alpha = lifeOut.opacity * dim[idx];
    const size = f.size * (1 - 0.34 * f.s);
    const w = size;
    const h = size * f.aspect;

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha * (0.2 + lifeOut.burn * 0.5);
    const gs = size * 3.4;
    ctx.drawImage(pageGlow, f.x - gs / 2, f.y - gs / 2, gs, gs);
    ctx.globalCompositeOperation = "source-over";

    const cy = Math.cos(f.yaw);
    const sy = Math.sin(f.yaw);
    const cp = Math.cos(f.pitch);
    const sp = Math.sin(f.pitch);
    const cr = Math.cos(f.roll);
    const sr = Math.sin(f.roll);
    const m00 = cr * cy + sr * sp * sy;
    const m01 = -sr * cp;
    const m02 = cr * sy - sr * sp * cy;
    const m10 = sr * cy - cr * sp * sy;
    const m11 = cr * cp;
    const m12 = sr * sy + cr * sp * cy;
    const m20 = -cp * sy;
    const m21 = sp;
    const m22 = cp * cy;

    const dir = f.burnFrom;
    for (let j = 0; j <= PAGE_SEGMENTS; j++) {
      const b = (j / PAGE_SEGMENTS - 0.5) * dir;
      const curl = Math.sin(b * Math.PI * 1.5 + f.curlPhase + t * 0.7) * f.curl * w * 0.34;
      for (let k = 0; k < 2; k++) {
        const a = k === 0 ? -0.5 : 0.5;
        const x = a * w;
        const y = b * h;
        const z = curl + a * a * w * 0.1;
        const X = m00 * x + m01 * y + m02 * z;
        const Y = m10 * x + m11 * y + m12 * z;
        const Z = m20 * x + m21 * y + m22 * z;
        const persp = 1 + Z / 520;
        meshX[j * 2 + k] = f.x + X * persp;
        meshY[j * 2 + k] = f.y + Y * persp;
      }
    }

    const cut = lifeOut.burn * PAGE_SEGMENTS * 1.02;
    const stripArea = (w * h) / PAGE_SEGMENTS || 1;
    const shades = f.pitch; // the page is lit a little differently as it tumbles
    ctx.globalAlpha = alpha;
    for (let j = 0; j < PAGE_SEGMENTS; j++) {
      if (j + 1 <= cut) continue;
      const i0 = j * 2;
      const i1 = (j + 1) * 2;
      const ax = meshX[i0];
      const ay = meshY[i0];
      const bx = meshX[i0 + 1];
      const by = meshY[i0 + 1];
      const cx = meshX[i1 + 1];
      const cyy = meshY[i1 + 1];
      const dx = meshX[i1];
      const dy = meshY[i1];
      const area = (cx - ax) * (dy - by) - (cyy - ay) * (dx - bx);
      const facing = clamp(Math.abs(area) / (2 * stripArea), 0, 1);
      const level = clamp(0.4 + facing * 0.56 + Math.sin(shades + j * 0.5) * 0.05, 0, 1);
      const palette = area >= 0 ? PAPER : PAPER_BACK;
      const color = palette[clamp(Math.round(level * (PAPER_LEVELS - 1)), 0, PAPER_LEVELS - 1)];
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      if (j < cut) {
        // The burning edge: a jagged line across the strip.
        const q = cut - j;
        const count = f.jag.length;
        for (let n = 0; n < count; n++) {
          const r = n / (count - 1);
          const e0x = lerp(ax, bx, r);
          const e0y = lerp(ay, by, r);
          const e1x = lerp(dx, cx, r);
          const e1y = lerp(dy, cyy, r);
          const qq = clamp(q + f.jag[n] * 0.3, 0, 1);
          const x = lerp(e0x, e1x, qq);
          const y = lerp(e0y, e1y, qq);
          if (n === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(cx, cyy);
        ctx.lineTo(dx, dy);
      } else {
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineTo(cx, cyy);
        ctx.lineTo(dx, dy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Script lines, while the page is big enough for them to read as writing.
    if (size > 15 && lifeOut.burn < 0.9) {
      ctx.strokeStyle = `rgba(92,62,42,0.36)`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let j = 1; j < PAGE_SEGMENTS; j++) {
        if (j <= cut + 0.6) continue;
        const i = j * 2;
        const lx = lerp(meshX[i], meshX[i + 1], 0.14);
        const ly = lerp(meshY[i], meshY[i + 1], 0.14);
        const rx = lerp(meshX[i], meshX[i + 1], j % 3 === 0 ? 0.62 : 0.86);
        const ry = lerp(meshY[i], meshY[i + 1], j % 3 === 0 ? 0.62 : 0.86);
        ctx.moveTo(lx, ly);
        ctx.lineTo(rx, ry);
      }
      ctx.stroke();
    }

    // The burn line itself.
    if (lifeOut.burn > 0) {
      const j = Math.floor(cut);
      if (j < PAGE_SEGMENTS) {
        const i0 = j * 2;
        const i1 = (j + 1) * 2;
        const q = cut - j;
        const count = f.jag.length;
        ctx.beginPath();
        for (let n = 0; n < count; n++) {
          const r = n / (count - 1);
          const x = lerp(lerp(meshX[i0], meshX[i0 + 1], r), lerp(meshX[i1], meshX[i1 + 1], r), clamp(q + f.jag[n] * 0.3, 0, 1));
          const y = lerp(lerp(meshY[i0], meshY[i0 + 1], r), lerp(meshY[i1], meshY[i1 + 1], r), clamp(q + f.jag[n] * 0.3, 0, 1));
          if (n === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(52,26,16,${alpha * 0.7})`;
        ctx.lineWidth = 2.6;
        ctx.stroke();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(255,150,60,${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,236,190,${alpha * 0.9})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      }
    }
    ctx.globalAlpha = 1;
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    if (!built) return;
    const B = built;
    const L = B.layout;
    const { width: W, height: H } = L;
    const k = scale;
    const t = simTime;
    const book = L.book;

    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(B.back, 0, 0, W, H);

    /* ---- the living sky ---- */
    ctx.drawImage(B.moon.canvas, B.moon.x + Math.sin(t * 0.021) * 5, B.moon.y + Math.cos(t * 0.017) * 3, B.moon.w, B.moon.h);
    ctx.globalCompositeOperation = "lighter";
    B.galaxies.forEach((g, i) => {
      ctx.drawImage(g.canvas, g.x + Math.cos(t * 0.019 + i * 2) * 4, g.y + Math.sin(t * 0.015 + i) * 3, g.w, g.h);
    });
    for (const tw of B.twinkles) {
      if (isBehindCards(B.cover, tw.x, tw.y, scrollTop, tw.size * 2)) continue;
      let boost = 0;
      for (const p of pulses) {
        if (!p.active) continue;
        const wave = p.age * 280;
        const d = Math.hypot(tw.x - p.x, tw.y - p.y);
        if (d < p.radius * 2) boost = Math.max(boost, Math.exp(-Math.pow((d - wave) / 60, 2)));
      }
      ctx.globalAlpha = clamp(tw.base * (0.55 + 0.45 * Math.sin(t * tw.rate + tw.phase)) + boost, 0, 1);
      const s = tw.size * (1 + boost * 0.9);
      ctx.drawImage(flare, tw.x - s / 2, tw.y - s / 2, s, s);
    }

    if (B.constellations.length > 0) {
      const c = B.constellations[activeConstellation.index % B.constellations.length];
      const phase = activeConstellation.phase;
      const time = activeConstellation.time;
      const reveal = phase === 0 ? smoothstep(0, 3.2, time) : 1;
      const level = phase === 2 ? 1 - smoothstep(0, 2.6, time) : 1;
      const edges = c.edges.length;
      ctx.strokeStyle = `rgba(190,214,255,${0.5 * level})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < edges; i++) {
        const local = clamp(reveal * edges - i, 0, 1);
        if (local <= 0) break;
        const [a, b] = c.edges[i];
        const ax = c.points[a][0];
        const ay = c.points[a][1];
        ctx.moveTo(ax, ay);
        ctx.lineTo(lerp(ax, c.points[b][0], local), lerp(ay, c.points[b][1], local));
      }
      ctx.stroke();
      ctx.globalAlpha = level * (0.5 + reveal * 0.5);
      for (const [x, y] of c.points) ctx.drawImage(flare, x - 11, y - 11, 22, 22);
      ctx.globalAlpha = 1;
    }

    // Stars made from burned pages, and faint threads between neighbours.
    ctx.strokeStyle = "rgba(255,226,170,0.13)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let i = 0; i < born.length; i++) {
      const a = born[i];
      if (!a.active) continue;
      for (let j = i + 1; j < born.length; j++) {
        const b = born[j];
        if (!b.active) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) < 170) {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
      }
    }
    ctx.stroke();
    for (const b of born) {
      if (!b.active) continue;
      const ignite = 1 - smoothstep(0, 1.2, b.age);
      const life = 1 - smoothstep(BORN_LIFE_S - 6, BORN_LIFE_S, b.age);
      const twinkle = 0.72 + 0.28 * Math.sin(t * 1.7 + b.phase);
      const s = b.size * (1 + ignite * 1.7);
      ctx.globalAlpha = clamp((twinkle + ignite) * life, 0, 1);
      ctx.drawImage(flare, b.x - s / 2, b.y - s / 2, s, s);
      if (ignite > 0) {
        const rs = b.size * (2 + (1 - ignite) * 3.4);
        ctx.globalAlpha = ignite * 0.8;
        ctx.drawImage(ring, b.x - rs / 2, b.y - rs / 2, rs, rs);
      }
    }
    ctx.globalAlpha = 1;
    for (const s of seeds) {
      if (!s.active) continue;
      const q = smoothstep(0, 1, s.age / s.duration);
      const mx = (s.fromX + s.toX) / 2 - (s.toY - s.fromY) * s.bend;
      const my = (s.fromY + s.toY) / 2 + (s.toX - s.fromX) * s.bend;
      for (let n = 0; n < 5; n++) {
        const r = Math.max(0, q - n * 0.028);
        const u = 1 - r;
        const x = u * u * s.fromX + 2 * u * r * mx + r * r * s.toX;
        const y = u * u * s.fromY + 2 * u * r * my + r * r * s.toY;
        const size = (10 - n * 1.6) * 0.9;
        ctx.globalAlpha = (1 - n / 5) * 0.8;
        ctx.drawImage(sprites[n === 0 ? 1 : 0], x - size / 2, y - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;

    /* ---- mist and light shafts from the book ---- */
    const breath = 0.5 + 0.5 * Math.sin(t * 1.1);
    const mistW = Math.max(W, 800);
    const mistH = H * 0.2;
    const drift = (t * 7) % mistW;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.5;
    ctx.drawImage(B.mist, -drift, H * 0.8, mistW, mistH);
    ctx.drawImage(B.mist, mistW - drift, H * 0.8, mistW, mistH);
    ctx.globalAlpha = 1;

    const srcX = book.x;
    const srcY = book.y - book.depth * 0.5 - book.lift * 0.22;
    const rays = 7;
    for (let i = 0; i < rays; i++) {
      const spread = lerp(-0.92, 0.92, i / (rays - 1));
      const angle = spread + Math.sin(t * 0.17 + i * 1.3) * 0.08;
      const len = book.w * (1.5 + 0.55 * Math.sin(i * 2.4 + 0.5) + 0.12 * Math.sin(t * 0.5 + i));
      const rw = book.w * (0.22 + 0.1 * Math.sin(i * 3.7));
      ctx.globalAlpha = (0.3 + breath * 0.2 + glowBoost * 0.3) * (0.7 + 0.3 * Math.sin(t * 0.8 + i * 2.1));
      const c = Math.cos(angle) * k;
      const s = Math.sin(angle) * k;
      ctx.setTransform(c, s, -s, c, srcX * k, srcY * k);
      ctx.drawImage(ray, -rw / 2, -len, rw, len);
    }
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    /* ---- ruins and the book ---- */
    ctx.drawImage(B.ruins.canvas, B.ruins.x, B.ruins.y, B.ruins.w, B.ruins.h);
    ctx.drawImage(B.book.canvas, B.book.x, B.book.y, B.book.w, B.book.h);

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = clamp(0.34 + breath * 0.44 + glowBoost * 0.3, 0, 1);
    ctx.drawImage(B.book.glow, B.book.x, B.book.y, B.book.w, B.book.h);
    ctx.globalAlpha = clamp(0.22 + breath * 0.1 + glowBoost * 0.5, 0, 1);
    const coreSize = book.w * (0.44 + breath * 0.05 + glowBoost * 0.4);
    ctx.setTransform(k, 0, 0, k * 0.72, srcX * k, srcY * k);
    ctx.drawImage(coreGlow, -coreSize, -coreSize, coreSize * 2, coreSize * 2);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    if (flip.active) drawFlip(ctx, book);

    /* ---- ferns behind the moving pages ---- */
    for (const c of B.clumps) {
      if (c.base > book.y + book.w * 0.2) continue;
      c.shear = Math.sin(t * c.rate + c.phase) * c.give + clamp(wind.x * 0.0009, -0.14, 0.14);
      ctx.setTransform(k, 0, c.shear * k, k, c.x * k, c.base * k);
      ctx.drawImage(c.canvas, -c.anchorX, -c.h, c.w, c.h);
    }
    ctx.setTransform(k, 0, 0, k, 0, 0);

    /* ---- pages ---- */
    for (const f of floaters) {
      // A page reaches about 1.6 times its width from its centre, plus its glow.
      if (f.active && !isBehindCards(B.cover, f.x, f.y, scrollTop, f.size * 2)) drawFloater(ctx, f, B.dim, t);
    }

    /* ---- stardust ---- */
    const lut = B.lut;
    const lx = lut.x;
    const ly = lut.y;
    const n1 = lx.length - 1;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < dust.count; i++) {
      const f = clamp(dust.s[i], 0, 1) * n1;
      const j = Math.min(n1 - 1, f | 0);
      const q = f - j;
      const x = lx[j] + (lx[j + 1] - lx[j]) * q + dust.ox[i];
      const y = ly[j] + (ly[j + 1] - ly[j]) * q + dust.oy[i];
      const age = dust.age[i];
      const life = dust.life[i];
      const env = Math.min(1, age * 1.4) * (1 - smoothstep(life * 0.72, life, age));
      const twinkle = 0.62 + 0.38 * Math.sin(t * 3.2 + dust.phase[i]);
      const size = dust.size[i];
      if (isBehindCards(B.cover, x, y, scrollTop, size)) continue;
      ctx.globalAlpha = env * twinkle * B.dim[j];
      if (size > 6.5) ctx.drawImage(sparkGold, x - size, y - size, size * 2, size * 2);
      else ctx.drawImage(sprites[dust.kind[i]], x - size / 2, y - size / 2, size, size);
    }

    /* ---- embers ---- */
    for (const e of embers) {
      if (!e.active) continue;
      const life = 1 - e.age / e.life;
      const angle = Math.atan2(e.vy, e.vx);
      const c = Math.cos(angle) * k * e.size;
      const s = Math.sin(angle) * k * e.size;
      ctx.setTransform(c, s, -s, c, e.x * k, e.y * k);
      ctx.globalAlpha = life;
      ctx.drawImage(ember, -22, -5, 28, 10);
    }
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalAlpha = 1;

    /* ---- tap rings and the pointer's light ---- */
    for (const p of pulses) {
      if (!p.active) continue;
      const q = p.age / 1.3;
      const size = p.radius * (0.3 + q * 1.5) * 2;
      ctx.globalAlpha = (1 - q) * 0.75;
      ctx.drawImage(ring, p.x - size / 2, p.y - size / 2, size, size);
    }
    if (pointerState.glow > 0.01) {
      const s = 170;
      ctx.globalAlpha = pointerState.glow * 0.1;
      ctx.drawImage(coreGlow, pointerState.x - s / 2, pointerState.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    /* ---- foreground ferns ---- */
    for (const c of B.clumps) {
      if (c.base <= book.y + book.w * 0.2) continue;
      c.shear = Math.sin(t * c.rate + c.phase) * c.give + clamp(wind.x * 0.0012, -0.18, 0.18);
      ctx.setTransform(k, 0, c.shear * k, k, c.x * k, c.base * k);
      ctx.drawImage(c.canvas, -c.anchorX, -c.h, c.w, c.h);
    }
    ctx.setTransform(k, 0, 0, k, 0, 0);
  };

  /* ---------------- layout ---------------- */

  const rebuild = (size: Readonly<SceneSize>) => {
    const L = computeLayout(size.width, size.height, avoidDoc);
    const dpr = size.dpr;
    const key = `${Math.round(L.width)}x${Math.ceil(L.height / 120) * 120}`;
    if (!nebula || key !== nebulaKey) {
      if (nebula) release(nebula);
      nebula = renderNebula(L, noise, noise2);
      nebulaKey = key;
    }
    const twRng = createRng(SEED ^ 0x7e11);
    const twinkles: Twinkle[] = [];
    const count = Math.round(clamp((L.width * L.height) / 42_000, 10, 34));
    const band = Math.max(L.gutters.top, 60);
    for (let i = 0; i < count; i++) {
      const inSide = twRng() < 0.32 && (L.gutters.right > 60 || L.gutters.left > 60);
      const left = L.gutters.left > L.gutters.right ? twRng() < 0.6 : twRng() < 0.4;
      const x = inSide ? (left ? twRng() * L.gutters.left : L.width - twRng() * L.gutters.right) : twRng() * L.width;
      const y = inSide ? band + twRng() * L.height * 0.34 : twRng() * band;
      twinkles.push({ x, y, size: 7 + twRng() * 11, rate: TAU / (2.2 + twRng() * 5), phase: twRng() * TAU, base: 0.3 + twRng() * 0.5 });
    }
    if (built) {
      release(built.back, built.moon.canvas, built.ruins.canvas, built.book.canvas, built.book.glow, built.mist);
      for (const g of built.galaxies) release(g.canvas);
      for (const c of built.clumps) release(c.canvas);
    }
    const lut = buildWindLut(L.wind);
    const spriteRng = createRng(SEED ^ 0x9a1a);
    built = {
      layout: L,
      lut,
      entry: L.compact ? windEntry(lut, L.gutters.top) : 0,
      cover: measureCardCover(avoidDoc),
      dim: new Float32Array(256).fill(1),
      back: paintBack(L, dpr, nebula, noise, star, flare),
      moon: paintMoon(L.moon, dpr),
      galaxies: L.galaxies.map((g) => paintGalaxy(g, dpr, spriteRng)),
      ruins: paintRuins(L, dpr, noise2),
      book: paintBook(L, dpr),
      clumps: buildClumps(L, dpr),
      mist: mistTile(noise2, 255, 196, 158, 92),
      twinkles,
      constellations: L.constellations.map((c) => {
        const p = CONSTELLATION_PATTERNS[c.pattern];
        return {
          points: p.stars.map(([x, y]): [number, number] => [c.x + x * c.scale, c.y + y * c.scale]),
          edges: p.edges,
        };
      }),
    };
    dimScroll = Number.NaN;
    updateDim(built);
    if (!seededFirst) {
      seededFirst = true;
      seedFlow(L, built.lut, built.entry);
    }
  };

  /** Fonts loaded or the profile chip appeared: rebuild only if the composition really moves. */
  const relayout = (): boolean => {
    if (!built) return false;
    const old = built.layout;
    const L = computeLayout(old.width, old.height, avoidDoc);
    const moved =
      Math.abs(L.gutters.left - old.gutters.left) + Math.abs(L.gutters.right - old.gutters.right) + Math.abs(L.gutters.top - old.gutters.top) > 2 ||
      L.constellations.length !== old.constellations.length ||
      Math.abs(L.moon.x - old.moon.x) + Math.abs(L.moon.y - old.moon.y) > 2;
    if (moved && lastSize) rebuild(lastSize);
    else if (built) {
      built.cover = measureCardCover(avoidDoc);
      updateDim(built);
    }
    return moved;
  };

  let lastSize: SceneSize | null = null;

  const handle = createScene({
    canvas,
    container,
    dprCap: DPR_CAP,
    resize(size, ctx) {
      scale = ctx.canvas.width / size.width;
      lastSize = { width: size.width, height: size.height, dpr: size.dpr };
      avoidDoc = measureAvoid();
      rebuild(size);
    },
    render(ctx, frame) {
      step(frame);
      draw(ctx);
    },
    reducedMotionFrame(ctx) {
      simTime = 6.5;
      activeConstellation.phase = 1;
      draw(ctx);
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
