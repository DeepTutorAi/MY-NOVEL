// Library hub scene on the kit (pages-stars, spec 3.1): a night reading hall under a vault
// painted as a star chart. Static planes: the far hall with the rose window (0.15), the two
// gutter bookcases (0.35, tiled; painted by library-paint, loaded only where a gutter holds
// one) and the vault with its lancet windows (0.5). Live: moon shafts, motes, the novels'
// figures, flying volumes, loose pages that burn into stars, candles. Windows: the stage
// shelf of tomes, the lectern with the grimoire, the inlaid reading floor. Loaded lazily by
// PagesStarsBackground.

import { createNoise2D, createRng } from "../_shared/scene-runtime";
import type { ShelfStrip } from "./library-core";
import {
  BURST_COOLDOWN_S,
  INTRO_SWEEP_S,
  PAGE_LIFE,
  PAGE_SPEED,
  SCROLL_TURN_PX,
  SHELF_PERIOD,
  TRACE_SUMMON_S,
  TRACE_TAP_S,
  burstCount,
  canBurst,
  draftPaths,
  figureFor,
  flicker,
  hallLayout,
  introLight,
  lecternBook,
  litStars,
  lutAt,
  moteCount,
  orbitAt,
  pageFlipPoint,
  pageLifecycle,
  pagePool,
  pageProfile,
  panelOrder,
  projectBook,
  risePath,
  slotFor,
  stageShelf,
  traceProgress,
  tracedAtRest,
  twinkle,
  volumeOrbits,
} from "./library-book";
import type { BookPlacement, DraftPath, Hall, Orbit, PageLife, StageShelf, Tome } from "./library-book";
import { flareSprite, paintDither, radialSprite } from "./scene-paint";
import type { Surface } from "./scene-paint";
import { TAU, buildWindLut, clamp, lerp, pointInRect, smoothstep } from "./world/geom";
import { collectPlanes, createHubScene, staticDpr } from "./world/kit";
import { cardColumn } from "./world/page-model-core";
import type {
  BindOptions,
  CardInfo,
  CardVars,
  Ctx,
  HubBuildContext,
  HubContexts,
  HubFrame,
  HubPlanes,
  HubPointer,
  HubSceneHandle,
  HubSceneHooks,
  PageSnapshot,
  Rect,
  SceneEvent,
  Vec,
  WindowName,
} from "./world/types";

/** canvas[data-sky-static] in DOM order: far hall, left and right bookcases, vault. */
const HALL = 0;
const SHELF_L = 1;
const SHELF_R = 2;
const VAULT = 3;
const STATICS = [{ parallax: 0.15 }, { parallax: 0.35, period: SHELF_PERIOD }, { parallax: 0.35, period: SHELF_PERIOD }, { parallax: 0.5 }];

export function mount(root: HTMLElement, options: Partial<BindOptions> = {}): HubSceneHandle | null {
  const planes = collectPlanes(root, STATICS);
  if (!planes) return null;
  return createHubScene("pages-stars", planes, (ctx) => buildLibrary(ctx, planes), options);
}

type Rgb = readonly [number, number, number];
type ShelfModules = [typeof import("./library-core"), typeof import("./library-paint")];

const css = (c: Rgb, k = 1, a = 1): string =>
  `rgba(${Math.round(clamp(c[0] * k, 0, 255))},${Math.round(clamp(c[1] * k, 0, 255))},${Math.round(clamp(c[2] * k, 0, 255))},${clamp(a, 0, 1).toFixed(3)})`;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const hex = (text: string, fallback: Rgb): Rgb => {
  const m = /^#([0-9a-f]{6})$/i.exec(text.trim());
  if (!m) return fallback;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/* ------------------------------------------------------------------ palette (spec 3.1) */

const VOID: Rgb = [7, 6, 12];
const NAVE: Rgb = [13, 11, 22];
const STONE: Rgb = [42, 36, 51];
const STONE_RIM: Rgb = [91, 99, 144];
const LAPIS_A: Rgb = [15, 21, 51];
const LAPIS_B: Rgb = [24, 32, 74];
const GILT: Rgb = [201, 163, 90];
const GILT_HI: Rgb = [242, 212, 140];
const AGED: Rgb = [141, 115, 64];
const MOON: Rgb = [205, 216, 255];
const MOON_FALL: Rgb = [143, 162, 230];
const CANDLE: Rgb = [255, 207, 134];
const CANDLE_FALL: Rgb = [255, 157, 74];
const OXBLOOD: Rgb = [74, 28, 34];
const WOOD: Rgb = [70, 46, 34];
const BRASS: Rgb = [200, 156, 84];
const PAPER_LEVELS = 32;
const PAPER: string[] = [];
const PAPER_BACK: string[] = [];
for (let i = 0; i < PAPER_LEVELS; i++) {
  const t = i / (PAPER_LEVELS - 1);
  PAPER.push(css(mix([116, 86, 66], [244, 228, 192], t)));
  PAPER_BACK.push(css(mix([96, 66, 56], [222, 192, 148], t)));
}
const paper = (level: number, back = false) => (back ? PAPER_BACK : PAPER)[clamp(Math.round(level * (PAPER_LEVELS - 1)), 0, PAPER_LEVELS - 1)];

/* ------------------------------------------------------------------ pools */

interface Page {
  active: boolean;
  path: DraftPath;
  s: number;
  speed: number;
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
  burnFrom: 1 | -1;
  shed: number;
  jag: Float32Array;
  x: number;
  y: number;
  zoneAge: number | null;
  target: string | null;
  /** A burst or ritual page: never counted against the ambient cap. */
  reserved: boolean;
  /** Pick ritual page: flies to its card and fades instead of burning. */
  homing: boolean;
}

interface Comet {
  active: boolean;
  fromX: number;
  fromY: number;
  slug: string;
  star: number;
  bend: number;
  age: number;
  duration: number;
}

interface Volume {
  orbit: Orbit;
  slug: string | null;
  tint: Rgb;
  /** Docking: 0 flying, 1 approaching a slot, 2 docked, 3 leaving. */
  state: 0 | 1 | 2 | 3;
  since: number;
  slot: { side: 0 | 1; x: number; y: number; w: number } | null;
  from: Vec;
  x: number;
  y: number;
  heading: number;
}

interface Ring {
  x: number;
  y: number;
  age: number;
  r: number;
  plane: "sky" | "ground";
}

interface StripState {
  strip: ShelfStrip;
  /** Viewport x of strip x = 0. */
  left: number;
}

const PAGE_SEGMENTS = 6;
const FLIP_SEGMENTS = 14;
const COMET_CAP = 8;
const BORN_LIFE_S = 40;
const MOTE_CAP = 360;

/* ------------------------------------------------------------------ painters: far hall and rose window */

/** The hall's base gradient: painted at once on a resize, so the plane is never empty while the rest stages. */
function paintHallCoat(g: Ctx, w: number, h: number): void {
  const base = g.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, css(VOID));
  base.addColorStop(0.45, css(NAVE));
  base.addColorStop(1, css([18, 13, 20]));
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
}

/** A gutter's bookcase as one dark wood fill, shown until its tile is painted. */
function paintShelfCoat(g: Ctx | null, w: number, h: number): void {
  if (!g) return;
  const wood = g.createLinearGradient(0, 0, w, 0);
  wood.addColorStop(0, css(WOOD, 0.3));
  wood.addColorStop(0.5, css(WOOD, 0.45));
  wood.addColorStop(1, css(WOOD, 0.3));
  g.fillStyle = wood;
  g.fillRect(0, 0, w, h);
}

function paintHallBase(g: Ctx, hall: Hall, w: number, h: number): void {
  paintHallCoat(g, w, h);
  // The nave recedes to the rose window: wall bays of distant shelves converge on it.
  const { x: vx, y: vy } = hall.rose;
  const top = -h * 0.25;
  const bottom = h;
  for (const side of [-1, 1]) {
    const edge = side < 0 ? 0 : w;
    for (let d = 1.15; d < 14; d *= 1.32) {
      const x = vx + (edge - vx) / d;
      const x2 = vx + (edge - vx) / (d * 1.32);
      const y0 = vy + (top - vy) / d;
      const y1 = vy + (bottom - vy) / d;
      const shade = 0.5 + 0.5 / d;
      g.fillStyle = css(STONE, 0.42 * shade, 0.5);
      g.fillRect(Math.min(x, x2), y0, Math.abs(x2 - x) * 0.92, y1 - y0);
      g.fillStyle = css(STONE_RIM, 1, 0.08 / d + 0.02);
      g.fillRect(Math.min(x, x2), y0, 1, y1 - y0);
      const rows = 9;
      for (let r = 1; r < rows; r++) {
        const y = lerp(y0, y1, r / rows);
        g.fillStyle = css(GILT, 0.5, 0.05 / Math.sqrt(d));
        g.fillRect(Math.min(x, x2), y, Math.abs(x2 - x) * 0.92, 1);
      }
      if (d < 6) {
        const cy = lerp(y0, y1, 0.42);
        const glow = g.createRadialGradient(x, cy, 0, x, cy, 26 / d + 6);
        glow.addColorStop(0, css(CANDLE, 1, 0.22 / d));
        glow.addColorStop(1, css(CANDLE_FALL, 1, 0));
        g.fillStyle = glow;
        g.fillRect(x - 40, cy - 40, 80, 80);
      }
    }
  }
  // Moonlit haze at the far end.
  const haze = g.createRadialGradient(vx, vy, 0, vx, vy, Math.max(w, h) * 0.6);
  haze.addColorStop(0, css(LAPIS_B, 1.5, 0.5));
  haze.addColorStop(0.3, css(LAPIS_A, 1, 0.22));
  haze.addColorStop(1, css(LAPIS_A, 1, 0));
  g.fillStyle = haze;
  g.fillRect(0, 0, w, h);
}

/** A 12-petal rose window with lapis, violet and teal panes and the real moon phase in its clear centre. */
function paintRose(g: Ctx, rose: Hall["rose"], phase: number): void {
  const { x, y, r } = rose;
  if (r <= 0) return;
  const halo = g.createRadialGradient(x, y, r * 0.6, x, y, r * 3.2);
  halo.addColorStop(0, css(MOON_FALL, 1, 0.2));
  halo.addColorStop(0.4, css([90, 96, 170], 1, 0.07));
  halo.addColorStop(1, css(LAPIS_A, 1, 0));
  g.fillStyle = halo;
  g.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
  g.fillStyle = css(STONE, 0.7);
  g.beginPath();
  g.arc(x, y, r * 1.14, 0, TAU);
  g.fill();
  const panes: Rgb[] = [
    [52, 70, 140],
    [86, 66, 132],
    [44, 104, 116],
  ];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU - Math.PI / 2;
    // Panes held 40% toward stone so the glass reads desaturated, not as a bright flower.
    const pane = mix(panes[i % 3], STONE, 0.4);
    const r0 = r * 0.42;
    const r1 = r * 0.98;
    const half = (TAU / 12) * 0.36;
    const grad = g.createRadialGradient(x, y, r0, x, y, r1);
    grad.addColorStop(0, css(pane, 1.15));
    grad.addColorStop(1, css(pane, 0.65));
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x + Math.cos(a - half) * r0, y + Math.sin(a - half) * r0);
    g.lineTo(x + Math.cos(a - half) * r1 * 0.82, y + Math.sin(a - half) * r1 * 0.82);
    g.quadraticCurveTo(x + Math.cos(a - half * 0.7) * r1, y + Math.sin(a - half * 0.7) * r1, x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    g.quadraticCurveTo(x + Math.cos(a + half * 0.7) * r1, y + Math.sin(a + half * 0.7) * r1, x + Math.cos(a + half) * r1 * 0.82, y + Math.sin(a + half) * r1 * 0.82);
    g.lineTo(x + Math.cos(a + half) * r0, y + Math.sin(a + half) * r0);
    g.closePath();
    g.fill();
    g.strokeStyle = css(STONE, 0.45);
    g.lineWidth = Math.max(0.8, r * 0.05);
    g.stroke();
    // A small foil between petals.
    const fa = a + TAU / 24;
    g.fillStyle = css(pane, 0.9);
    g.beginPath();
    g.arc(x + Math.cos(fa) * r * 0.86, y + Math.sin(fa) * r * 0.86, r * 0.07, 0, TAU);
    g.fill();
  }
  g.strokeStyle = css(STONE_RIM, 1, 0.7);
  g.lineWidth = 1;
  g.beginPath();
  g.arc(x, y, r * 1.12, 0, TAU);
  g.stroke();
  // Clear centre pane: night sky with the moon at today's phase.
  const cr = r * 0.36;
  g.fillStyle = css([14, 18, 46]);
  g.beginPath();
  g.arc(x, y, cr, 0, TAU);
  g.fill();
  paintMoonPhase(g, x, y, cr * 0.72, phase);
  g.strokeStyle = css(GILT, 0.9, 0.7);
  g.lineWidth = Math.max(0.8, r * 0.04);
  g.beginPath();
  g.arc(x, y, cr, 0, TAU);
  g.stroke();
}

/** The moon at `phase` (0 new, 0.5 full): earthshine disc, then the lit part bounded by the terminator. */
function paintMoonPhase(g: Ctx, x: number, y: number, r: number, phase: number): void {
  g.fillStyle = css([40, 42, 74]);
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  const waxing = phase < 0.5;
  const k = Math.cos(phase * TAU);
  g.fillStyle = css([246, 240, 222]);
  g.beginPath();
  // The lit limb: right half while waxing, left half while waning.
  g.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !waxing);
  // The terminator: an ellipse of x-radius r|k|, bulging toward the dark side before quarter.
  g.ellipse(x, y, r * Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === waxing);
  g.closePath();
  g.fill();
  const glow = g.createRadialGradient(x, y, r * 0.8, x, y, r * 2.2);
  glow.addColorStop(0, css(MOON, 1, 0.25 * (1 - Math.abs(k) * 0.5)));
  glow.addColorStop(1, css(MOON, 1, 0));
  g.fillStyle = glow;
  g.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
}

/* ------------------------------------------------------------------ painters: vault and lancets */

/** The vault's lapis ground, fading out below the band; it replaces whatever the plane held. */
function paintVaultCoat(g: Ctx, hall: Hall, w: number, h: number): void {
  const { band } = hall;
  const fade = band + 56;
  g.clearRect(0, 0, w, h);
  const web = g.createLinearGradient(0, 0, 0, fade);
  web.addColorStop(0, css(LAPIS_A, 0.75));
  web.addColorStop(0.5, css(LAPIS_A, 1, 0.97));
  web.addColorStop(band / fade, css(LAPIS_B, 0.75, 0.8));
  web.addColorStop(1, css(LAPIS_B, 0.6, 0));
  g.fillStyle = web;
  g.fillRect(0, 0, w, fade);
}

/** The star-chart vault: lapis webbing with faint engraved parallels and meridians, gold-leaf stars. */
function paintVaultWeb(g: Ctx, hall: Hall, w: number, h: number, rng: () => number): void {
  const { band } = hall;
  const { x: vx, y: vy, r } = hall.rose;
  const open = r * 2.3;
  const fade = band + 56;
  paintVaultCoat(g, hall, w, h);
  // A soft moonlit bloom around the oculus.
  const bloom = g.createRadialGradient(vx, vy, open, vx, vy, open * 5);
  bloom.addColorStop(0, css(LAPIS_B, 1.7, 0.45));
  bloom.addColorStop(1, css(LAPIS_B, 1, 0));
  g.fillStyle = bloom;
  g.fillRect(vx - open * 5, 0, open * 10, fade);
  g.lineWidth = 0.6;
  for (let k = 1; k < 7; k++) {
    g.strokeStyle = css(AGED, 1, 0.09);
    g.beginPath();
    g.arc(vx, vy, open * Math.pow(1.9, k), 0, TAU);
    g.stroke();
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    g.strokeStyle = css(AGED, 1, 0.06);
    g.beginPath();
    g.moveTo(vx + Math.cos(a) * open * 1.9, vy + Math.sin(a) * open * 1.9);
    g.lineTo(vx + Math.cos(a) * w * 1.5, vy + Math.sin(a) * w * 1.5);
    g.stroke();
  }
  // Gold-leaf stars.
  const count = Math.round((w * band) / 650);
  for (let i = 0; i < count; i++) {
    const sx = rng() * w;
    const sy = Math.pow(rng(), 0.8) * band;
    if (Math.hypot(sx - vx, sy - vy) < open) continue;
    const big = rng() < 0.05;
    g.fillStyle = css(rng() < 0.7 ? GILT : GILT_HI, 1, (0.25 + rng() * 0.55) * (1 - sy / (band * 1.4)));
    const size = big ? 1.6 : 0.6 + rng() * 0.8;
    g.fillRect(sx, sy, size, size);
    if (big) {
      g.fillRect(sx - 2, sy + size / 2 - 0.3, size + 4, 0.6);
      g.fillRect(sx + size / 2 - 0.3, sy - 2, 0.6, size + 4);
    }
  }
}

/** Gilt-edged stone ribs that spring from the gutter pillars (or the screen edges) and arch into the oculus. */
function paintRibs(g: Ctx, hall: Hall, s: PageSnapshot): void {
  const { band, w } = hall;
  const { x: vx, y: vy, r } = hall.rose;
  const open = r * 2.3;
  const phone = hall.mode === "phone" || hall.mode === "landscape-short";
  const springers: Vec[] = phone
    ? [{ x: 0, y: band * 0.5 }, { x: 0, y: band }, { x: w, y: band * 0.3 }, { x: w, y: band }, { x: w * 0.6, y: band + 30 }]
    : [
        { x: s.gutters.left, y: band + 12 },
        { x: w - s.gutters.right, y: band + 12 },
        { x: 0, y: band * 0.55 },
        { x: w, y: band * 0.55 },
        { x: lerp(s.gutters.left, w - s.gutters.right, 0.42), y: band + 40 },
        { x: lerp(s.gutters.left, w - s.gutters.right, 0.8), y: band + 30 },
      ];
  const ribPath = (sp: Vec, dx: number, dy: number) => {
    const a = Math.atan2(sp.y - vy, sp.x - vx);
    const ox = vx + Math.cos(a) * open;
    const oy = vy + Math.sin(a) * open;
    g.beginPath();
    g.moveTo(sp.x + dx, sp.y + dy);
    g.quadraticCurveTo(lerp(sp.x, ox, 0.25) + dx, lerp(sp.y, oy, 0.85) + dy, ox + dx, oy + dy);
  };
  g.lineCap = "round";
  for (const sp of springers) {
    g.strokeStyle = css(STONE, 0.55);
    g.lineWidth = phone ? 7 : 11;
    ribPath(sp, 0, 0);
    g.stroke();
    g.strokeStyle = css(STONE, 0.95);
    g.lineWidth = phone ? 4 : 7;
    ribPath(sp, 0, 0);
    g.stroke();
    g.lineWidth = 0.9;
    g.strokeStyle = css(GILT, 1, 0.5);
    ribPath(sp, phone ? -1.6 : -3, -1);
    g.stroke();
    g.strokeStyle = css(STONE_RIM, 1, 0.35);
    ribPath(sp, phone ? 1 : 2, 0);
    g.stroke();
  }
  if (open <= 0) return;
  // Two transverse ribs ring the oculus.
  for (const k of [2.2, phone ? 3.4 : 4.4]) {
    g.lineWidth = phone ? 3 : 5;
    g.strokeStyle = css(STONE, 0.75);
    g.beginPath();
    g.arc(vx, vy, open * k, 0, TAU);
    g.stroke();
    g.lineWidth = 0.8;
    g.strokeStyle = css(GILT, 1, 0.4);
    g.beginPath();
    g.arc(vx, vy, open * k - (phone ? 1.5 : 2.5), 0, TAU);
    g.stroke();
  }
  // The oculus: the far hall and its rose window show through.
  g.globalCompositeOperation = "destination-out";
  const hole = g.createRadialGradient(vx, vy, open * 0.86, vx, vy, open);
  hole.addColorStop(0, "rgba(0,0,0,1)");
  hole.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = hole;
  g.beginPath();
  g.arc(vx, vy, open, 0, TAU);
  g.fill();
  g.globalCompositeOperation = "source-over";
  g.lineWidth = 2.4;
  g.strokeStyle = css(STONE, 0.9);
  g.beginPath();
  g.arc(vx, vy, open, 0, TAU);
  g.stroke();
  g.lineWidth = 0.9;
  g.strokeStyle = css(GILT, 1, 0.7);
  g.beginPath();
  g.arc(vx, vy, open + 2, 0, TAU);
  g.stroke();
}

/** Oval cartouches for the figures: deep lapis inside a gilt ring and a fine inner ring, bosses at the ends. */
function paintPanels(g: Ctx, hall: Hall): void {
  for (const p of hall.panels) {
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const fill = g.createRadialGradient(cx, cy - p.h * 0.2, 0, cx, cy, p.w / 2);
    fill.addColorStop(0, css([20, 28, 66]));
    fill.addColorStop(1, css([8, 11, 32]));
    g.fillStyle = fill;
    g.beginPath();
    g.ellipse(cx, cy, p.w / 2, p.h / 2, 0, 0, TAU);
    g.fill();
    g.strokeStyle = css(GILT, 1, 0.7);
    g.lineWidth = 1;
    g.stroke();
    g.strokeStyle = css(AGED, 1, 0.45);
    g.lineWidth = 0.6;
    g.beginPath();
    g.ellipse(cx, cy, p.w / 2 - 2.5, p.h / 2 - 2.5, 0, 0, TAU);
    g.stroke();
    g.fillStyle = css(GILT_HI, 1, 0.8);
    for (const dx of [-p.w / 2, p.w / 2]) {
      g.beginPath();
      g.arc(cx + dx, cy, 1.7, 0, TAU);
      g.fill();
    }
  }
}

/** A lancet bay set into the bookcase wall: ashlar surround, pointed arch with two lights, sill and cornice. */
function paintLancet(g: Ctx, l: Hall["lancets"][number], rng: () => number): void {
  const bayW = l.w * 2.3;
  const x0 = l.x - bayW / 2;
  const bottom = l.bottom + 26;
  // Ashlar courses, lit cool from the window.
  for (let y = 0, row = 0; y < bottom; y += 22, row++) {
    for (let x = x0 - (row % 2) * 24; x < x0 + bayW; ) {
      const bw = 38 + rng() * 26;
      const lit = clamp(1 - Math.abs(x + bw / 2 - l.x) / bayW, 0, 1);
      g.fillStyle = css(mix(STONE, STONE_RIM, lit * 0.18), 0.55 + rng() * 0.14 + lit * 0.12);
      g.fillRect(Math.max(x0, x), y, Math.min(bw, x0 + bayW - x) - 1.2, 20.8);
      g.fillStyle = css(STONE_RIM, 1, 0.12 + lit * 0.12);
      g.fillRect(Math.max(x0, x), y, Math.min(bw, x0 + bayW - x) - 1.2, 0.8);
      x += bw;
    }
  }
  const edge = g.createLinearGradient(x0, 0, x0 + bayW, 0);
  edge.addColorStop(0, "rgba(0,0,0,0.55)");
  edge.addColorStop(0.18, "rgba(0,0,0,0)");
  edge.addColorStop(0.82, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.55)");
  g.fillStyle = edge;
  g.fillRect(x0, 0, bayW, bottom);
  // The pointed arch.
  const hw = l.w / 2;
  const spring = l.top + l.w * 0.87;
  const arch = (inset: number) => {
    const x = l.x;
    g.beginPath();
    g.moveTo(x - hw + inset, l.bottom);
    g.lineTo(x - hw + inset, spring);
    g.arc(x + hw, spring, l.w - inset, Math.PI, Math.PI * 1.335, false);
    g.arc(x - hw, spring, l.w - inset, Math.PI * 1.665, 0, false);
    g.lineTo(x + hw - inset, l.bottom);
    g.closePath();
  };
  g.fillStyle = css(STONE, 0.4);
  arch(-6);
  g.fill();
  const sky = g.createLinearGradient(0, l.top, 0, l.bottom);
  sky.addColorStop(0, css([16, 24, 66]));
  sky.addColorStop(0.6, css([30, 40, 96]));
  sky.addColorStop(1, css([48, 58, 120]));
  g.fillStyle = sky;
  arch(0);
  g.fill();
  g.save();
  arch(0);
  g.clip();
  for (let i = 0; i < 26; i++) {
    g.fillStyle = css(MOON, 1, 0.25 + rng() * 0.6);
    const s = rng() < 0.15 ? 1.6 : 0.9;
    g.fillRect(l.x - hw + rng() * l.w, l.top + rng() * (l.bottom - l.top) * 0.75, s, s);
  }
  const glow = g.createRadialGradient(l.x, l.bottom, 0, l.x, l.bottom, l.w * 1.6);
  glow.addColorStop(0, css(MOON_FALL, 1, 0.35));
  glow.addColorStop(1, css(MOON_FALL, 1, 0));
  g.fillStyle = glow;
  g.fillRect(l.x - l.w, l.top, l.w * 2, l.bottom - l.top);
  // Mullion, two small lights and a roundel in the head.
  g.fillStyle = css(STONE, 0.5);
  g.fillRect(l.x - 1.6, spring - l.w * 0.2, 3.2, l.bottom - spring + l.w * 0.2);
  g.strokeStyle = css(STONE, 0.5);
  g.lineWidth = 2.6;
  g.beginPath();
  g.arc(l.x, spring - l.w * 0.48, l.w * 0.2, 0, TAU);
  g.stroke();
  for (const side of [-1, 1]) {
    g.beginPath();
    g.arc(l.x + side * hw * 0.5, spring - l.w * 0.02, hw * 0.5, Math.PI, 0);
    g.stroke();
  }
  for (let y = spring + 40; y < l.bottom; y += 46) {
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(l.x - hw, y);
    g.lineTo(l.x + hw, y);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = css(STONE_RIM, 1, 0.6);
  g.lineWidth = 1;
  arch(-1);
  g.stroke();
  // Sill and cornice: the bookcases rise beneath.
  g.fillStyle = css(STONE, 0.95);
  g.fillRect(l.x - hw - 8, l.bottom, l.w + 16, 6);
  g.fillStyle = css(STONE_RIM, 1, 0.5);
  g.fillRect(l.x - hw - 8, l.bottom, l.w + 16, 1);
  g.fillStyle = css(WOOD, 0.9);
  g.fillRect(x0, bottom - 8, bayW, 8);
  g.fillStyle = css(GILT, 0.9, 0.7);
  g.fillRect(x0, bottom - 8, bayW, 1);
  const shadow = g.createLinearGradient(0, bottom, 0, bottom + 26);
  shadow.addColorStop(0, "rgba(0,0,0,0.6)");
  shadow.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = shadow;
  g.fillRect(x0, bottom, bayW, 26);
}

/* ------------------------------------------------------------------ painters: windows */

/** The binding press with unbound folios and hanging threads, the plank and its brackets. */
function paintStageBase(g: Ctx, shelf: StageShelf, h: number, hit: Rect, ray: HTMLCanvasElement): void {
  // A shaft of rose-window light falling across the shelf, feathered at its sides and faded out
  // toward the window's top and bottom edges so it never shows the canvas box. The surface is
  // empty here, so the fade masks the shaft alone.
  g.save();
  g.globalAlpha = 0.3;
  g.translate(hit.x + hit.w * 0.22, -h * 0.2);
  g.rotate(-0.42);
  g.drawImage(ray, -hit.w * 0.3, 0, hit.w * 0.6, h * 1.6);
  g.restore();
  const fade = g.createLinearGradient(0, 0, 0, h);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(0.25, "rgba(0,0,0,1)");
  fade.addColorStop(0.9, "rgba(0,0,0,0.85)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  g.globalCompositeOperation = "destination-in";
  g.fillStyle = fade;
  g.fillRect(0, 0, hit.x + hit.w * 2, h);
  g.globalCompositeOperation = "source-over";
  // A flattened pool of the same light on the plank.
  const cx = hit.x + hit.w * 0.42;
  const ry = Math.min(h - shelf.plank.y, shelf.plank.y) * 0.9;
  g.save();
  g.translate(cx, shelf.plank.y);
  g.scale(1, ry / (hit.w * 0.45));
  const pool = g.createRadialGradient(0, 0, 0, 0, 0, hit.w * 0.45);
  pool.addColorStop(0, css(MOON_FALL, 1, 0.09));
  pool.addColorStop(1, css(MOON_FALL, 1, 0));
  g.fillStyle = pool;
  g.fillRect(-hit.w * 0.45, -hit.w * 0.45, hit.w * 0.9, hit.w * 0.9);
  g.restore();
  const p = shelf.plank;
  // Wooden corbels under the plank: a filled quarter-round with a gilt top edge.
  const cw = Math.min(14, p.h * 1.6);
  const ch = Math.min(18, h - p.y - p.h - 2);
  for (const [bx, dir] of [[p.x + p.w * 0.1, 1], [p.x + p.w * 0.9, -1]] as const) {
    g.fillStyle = css(WOOD, 0.8);
    g.beginPath();
    g.moveTo(bx - (dir * cw) / 2, p.y + p.h);
    g.lineTo(bx + (dir * cw) / 2, p.y + p.h);
    g.quadraticCurveTo(bx + (dir * cw) / 2, p.y + p.h + ch, bx - (dir * cw) / 2, p.y + p.h + ch);
    g.closePath();
    g.fill();
    g.fillStyle = css(GILT, 1, 0.4);
    g.fillRect(bx - cw / 2, p.y + p.h, cw, 1);
  }
  const plank = g.createLinearGradient(0, p.y, 0, p.y + p.h);
  plank.addColorStop(0, css(WOOD, 1.7));
  plank.addColorStop(0.25, css(WOOD, 1.15));
  plank.addColorStop(1, css(WOOD, 0.55));
  g.fillStyle = plank;
  g.fillRect(p.x, p.y, p.w, p.h);
  g.fillStyle = css(GILT, 1, 0.7);
  g.fillRect(p.x, p.y, p.w, 1);
  const contact = g.createLinearGradient(0, p.y + p.h, 0, p.y + p.h + 14);
  contact.addColorStop(0, "rgba(0,0,0,0.5)");
  contact.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = contact;
  g.fillRect(p.x, p.y + p.h, p.w, 14);
  if (shelf.press) {
    const r = shelf.press;
    g.fillStyle = css(WOOD, 1.1);
    g.fillRect(r.x, r.y + r.h * 0.62, r.w, r.h * 0.38);
    g.fillRect(r.x + 2, r.y - r.h * 0.5, 4, r.h * 1.12);
    g.fillRect(r.x + r.w - 6, r.y - r.h * 0.5, 4, r.h * 1.12);
    g.fillStyle = css(WOOD, 1.4);
    g.fillRect(r.x, r.y - r.h * 0.56, r.w, 5);
    g.fillStyle = css(BRASS, 0.9);
    g.fillRect(r.x + r.w / 2 - 1.5, r.y - r.h * 0.56 - 6, 3, r.h * 0.6);
    g.fillRect(r.x + r.w / 2 - 8, r.y - r.h * 0.56 - 7, 16, 2);
    // Two unbound folios: stacked signatures with threads hanging from the spine.
    for (let i = 0; i < 2; i++) {
      const fx = r.x + 9 + i * (r.w - 18) * 0.5;
      const fw = (r.w - 22) * 0.46;
      for (let k = 0; k < 6; k++) {
        g.fillStyle = paper(0.62 + (k % 3) * 0.1 - i * 0.08);
        g.fillRect(fx + (k % 2), r.y + r.h * 0.62 - (k + 1) * 3.2, fw, 2.6);
      }
      g.strokeStyle = css([226, 210, 180], 1, 0.7);
      g.lineWidth = 0.6;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(fx + fw * (0.2 + k * 0.3), r.y + r.h * 0.62 - 2);
        g.quadraticCurveTo(fx + fw * (0.25 + k * 0.3), r.y + r.h * 0.9, fx + fw * (0.18 + k * 0.32), r.y + r.h + 4 + k * 3);
        g.stroke();
      }
    }
  }
}

/** One tome on the stage shelf: accent-tinted leather, gilt bands, ribbon, seal, straps for the locked one. */
function paintTome(g: Ctx, t: Tome, floor: number, lift: number, tilt: number, glow: number): void {
  const accent = hex(t.accent, GILT);
  const leather = t.kind === "locked" ? mix(OXBLOOD, [20, 18, 24], 0.55) : mix(OXBLOOD, accent, 0.4);
  g.save();
  g.translate(t.x + t.w / 2, floor - lift);
  g.rotate(tilt);
  const x = -t.w / 2;
  const top = -t.h;
  const body = g.createLinearGradient(x, 0, x + t.w, 0);
  body.addColorStop(0, css(leather, 0.45));
  body.addColorStop(0.3, css(leather, 1.05 + glow * 0.3));
  body.addColorStop(0.7, css(leather, 0.9));
  body.addColorStop(1, css(leather, 0.4));
  g.fillStyle = body;
  g.fillRect(x, top, t.w, t.h);
  g.fillStyle = css(MOON, 1, 0.35);
  g.fillRect(x, top, t.w, 1);
  for (const f of [0.08, 0.12, 0.86, 0.9]) {
    g.fillStyle = css(GILT, 1, 0.85);
    g.fillRect(x + 1, top + t.h * f, t.w - 2, 1);
  }
  g.fillStyle = css([20, 14, 12], 1, 0.85);
  g.fillRect(x + t.w * 0.18, top + t.h * 0.24, t.w * 0.64, t.h * 0.16);
  g.fillStyle = css(GILT, 1, 0.7);
  g.fillRect(x + t.w * 0.28, top + t.h * 0.3, t.w * 0.44, 1);
  if (t.kind === "locked") {
    for (const f of [0.42, 0.66]) {
      g.fillStyle = css([28, 20, 18]);
      g.fillRect(x - 1, top + t.h * f, t.w + 2, Math.max(3, t.h * 0.06));
      g.fillStyle = css(BRASS, 0.7);
      g.fillRect(x - 1, top + t.h * f, t.w + 2, 0.8);
    }
    g.fillStyle = css(BRASS, 1);
    g.fillRect(x + t.w / 2 - 4, top + t.h * 0.5, 8, 9);
    g.fillStyle = css([30, 22, 16]);
    g.fillRect(x + t.w / 2 - 0.8, top + t.h * 0.5 + 3, 1.6, 4);
  } else if (t.read > 0 || t.finished) {
    // Ribbon bookmark from the head: its length is the reading progress.
    const ribbon = mix(accent, GILT, 0.3);
    const len = 8 + (t.finished ? 1 : t.read) * t.h * 0.7;
    g.fillStyle = css(ribbon, 0.85);
    g.beginPath();
    g.moveTo(x + t.w * 0.62, top);
    g.lineTo(x + t.w * 0.62 + 3.4, top);
    g.lineTo(x + t.w * 0.62 + 3.4, top + len);
    g.lineTo(x + t.w * 0.62 + 1.7, top + len - 2.6);
    g.lineTo(x + t.w * 0.62, top + len);
    g.closePath();
    g.fill();
    if (t.finished) {
      const sy = top + t.h * 0.56;
      const seal = g.createRadialGradient(x + t.w / 2 - 1, sy - 1, 0, x + t.w / 2, sy, Math.min(7, t.w * 0.36));
      seal.addColorStop(0, css(GILT_HI));
      seal.addColorStop(1, css(GILT, 0.7));
      g.fillStyle = seal;
      g.beginPath();
      g.arc(x + t.w / 2, sy, Math.min(7, t.w * 0.36), 0, TAU);
      g.fill();
    }
  }
  if (glow > 0.01) {
    g.globalCompositeOperation = "lighter";
    g.fillStyle = css(accent, 1, 0.22 * glow);
    g.fillRect(x, top, t.w, t.h);
    g.globalCompositeOperation = "source-over";
  }
  g.restore();
}

/** The lectern: carved stand, the open grimoire, stacks of books, candelabra and armillary stands. */
function paintLectern(g: Ctx, book: BookPlacement, w: number, h: number, hit: Rect): void {
  const U = book.w;
  // The candle pool as an ellipse squashed to fit the window, so it fades out inside the canvas.
  const poolY = h * 0.8;
  const pool = g.createRadialGradient(0, 0, 0, 0, 0, U * 1.5);
  pool.addColorStop(0, css(CANDLE_FALL, 1, 0.16));
  pool.addColorStop(1, css(CANDLE_FALL, 1, 0));
  g.save();
  g.translate(book.x, poolY);
  g.scale(1, Math.min(1, (h - poolY) / (U * 1.5), (0.42 * h) / (U * 1.5)));
  g.fillStyle = pool;
  g.fillRect(-U * 1.5, -U * 1.5, U * 3, U * 3);
  g.restore();
  // Column and feet.
  const colW = U * 0.12;
  const col = g.createLinearGradient(book.x - colW, 0, book.x + colW, 0);
  col.addColorStop(0, css(WOOD, 0.5));
  col.addColorStop(0.4, css(WOOD, 1.3));
  col.addColorStop(1, css(WOOD, 0.45));
  g.fillStyle = col;
  g.fillRect(book.x - colW / 2, book.y, colW, h - book.y - 6);
  for (let k = 0; k < 4; k++) {
    g.fillStyle = css(WOOD, 1.1 - k * 0.1);
    g.fillRect(book.x - colW * (0.7 + k * 0.05), book.y + (h - book.y) * (0.2 + k * 0.2), colW * (1.4 + k * 0.1), 3);
  }
  g.fillStyle = css(WOOD, 0.9);
  g.beginPath();
  g.ellipse(book.x, h - 5, U * 0.32, 5, 0, 0, TAU);
  g.fill();
  // Slanted top under the book.
  const tl = { x: 0, y: 0 };
  const tr = { x: 0, y: 0 };
  projectBook(book, -1.12, -0.1, -0.12, tl);
  projectBook(book, 1.12, -0.1, -0.12, tr);
  g.fillStyle = css(WOOD, 0.75);
  g.beginPath();
  g.moveTo(tl.x, tl.y);
  g.lineTo(tr.x, tr.y);
  g.lineTo(tr.x - U * 0.04, tr.y + U * 0.07);
  g.lineTo(tl.x + U * 0.04, tl.y + U * 0.07);
  g.closePath();
  g.fill();
  g.fillStyle = css(GILT, 1, 0.5);
  g.fillRect(tl.x, tl.y, tr.x - tl.x, 1);
  paintGrimoire(g, book, false);
  // Stacks of books on the floor beside the lectern.
  for (const side of [-1, 1]) {
    let y = h - 4;
    const cx = book.x + side * Math.min(w * 0.36, hit.w * 0.9 + U * 0.3);
    for (let k = 0; k < 4; k++) {
      const len = U * (0.34 - k * 0.04);
      const t = 6 + ((k * 5) % 4);
      const c = [OXBLOOD, [29, 51, 40] as Rgb, [27, 35, 64] as Rgb, [58, 31, 61] as Rgb][(k + (side > 0 ? 1 : 0)) % 4];
      const grad = g.createLinearGradient(0, y - t, 0, y);
      grad.addColorStop(0, css(c, 1.5));
      grad.addColorStop(1, css(c, 0.6));
      g.fillStyle = grad;
      g.fillRect(cx - len / 2 + (k % 2) * 3, y - t, len, t);
      g.fillStyle = css(GILT, 1, 0.5);
      g.fillRect(cx - len / 2 + (k % 2) * 3 + len * 0.1, y - t + 1, 1, t - 2);
      y -= t;
    }
  }
}

/** The open grimoire (ported): cover with thickness, page block, open pages, printed gold. `glow` paints only the gold for the breath layer. */
function paintGrimoire(g: Ctx, book: BookPlacement, glow: boolean): void {
  const U = book.w;
  const at = (u: number, v: number, z: number): Vec => projectBook(book, u, v, z, { x: 0, y: 0 });
  const path = (pts: ReadonlyArray<readonly [number, number]>) => {
    g.beginPath();
    pts.forEach(([u, v], i) => {
      const p = at(u, v, pageProfile(u));
      if (i === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    });
  };
  const span = (u0: number, v0: number, u1: number, v1: number, steps = 10) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) pts.push([lerp(u0, u1, i / steps), lerp(v0, v1, i / steps)]);
    path(pts);
    g.stroke();
  };
  const ornaments = (width: number) => {
    g.lineWidth = width;
    for (const side of [-1, 1]) {
      span(side * 0.09, 0.07, side * 0.93, 0.07);
      span(side * 0.09, 0.93, side * 0.93, 0.93);
      span(side * 0.93, 0.07, side * 0.93, 0.93, 4);
      span(side * 0.09, 0.07, side * 0.09, 0.93, 4);
    }
    const ring = (radius: number) => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 40; i++) pts.push([-0.5 + Math.cos((i / 40) * TAU) * radius, 0.5 + Math.sin((i / 40) * TAU) * radius * 1.5]);
      path(pts);
      g.stroke();
    };
    ring(0.26);
    g.lineWidth = width * 0.6;
    ring(0.21);
    ring(0.1);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      span(-0.5 + Math.cos(a) * 0.11, 0.5 + Math.sin(a) * 0.165, -0.5 + Math.cos(a) * 0.2, 0.5 + Math.sin(a) * 0.3, 2);
    }
  };
  if (glow) {
    g.strokeStyle = "rgba(255,226,150,0.95)";
    g.shadowColor = "rgba(255,190,90,0.9)";
    g.shadowBlur = U * 0.03;
    ornaments(Math.max(0.9, U * 0.0075));
    g.shadowBlur = 0;
    return;
  }
  const corners = [at(-1.07, -0.07, -0.05), at(1.07, -0.07, -0.05), at(1.07, 1.06, -0.05), at(-1.07, 1.06, -0.05)];
  const thick = U * 0.022;
  g.fillStyle = "#1a0d14";
  g.beginPath();
  g.moveTo(corners[0].x, corners[0].y);
  g.lineTo(corners[1].x, corners[1].y);
  g.lineTo(corners[1].x, corners[1].y + thick);
  g.lineTo(corners[0].x, corners[0].y + thick);
  g.closePath();
  g.fill();
  const leather = g.createLinearGradient(corners[0].x, 0, corners[1].x, 0);
  leather.addColorStop(0, "#2e1520");
  leather.addColorStop(0.5, "#5a2c34");
  leather.addColorStop(1, "#351820");
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
  // Page block seen from the front edge, side faces, open pages strip by strip.
  const n = 48;
  g.fillStyle = "#c9a97c";
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const p = at(-1 + (2 * i) / n, 0, pageProfile(-1 + (2 * i) / n));
    if (i === 0) g.moveTo(p.x, p.y);
    else g.lineTo(p.x, p.y);
  }
  for (let i = n; i >= 0; i--) {
    const p = at(-1 + (2 * i) / n, 0, -0.03);
    g.lineTo(p.x, p.y);
  }
  g.closePath();
  g.fill();
  for (const side of [-1, 1]) {
    for (let i = 0; i < 30; i++) {
      const u0 = (side * i) / 30;
      const u1 = (side * (i + 1)) / 30;
      const slope = (pageProfile(u1) - pageProfile(u0)) / (Math.abs(u1 - u0) || 1);
      const color = paper(clamp(0.82 + slope * 0.1 - ((i + 0.5) / 30) * 0.12, 0.4, 1));
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
  g.strokeStyle = "rgba(96,64,46,0.45)";
  g.lineWidth = Math.max(0.6, U * 0.0035);
  for (let i = 0; i < 9; i++) span(-0.84, 0.16 + i * 0.06, -0.17 - ((i * 7) % 5) * 0.03, 0.16 + i * 0.06);
  g.strokeStyle = gold;
  ornaments(Math.max(0.8, U * 0.0062));
}

/** The reading floor: inlaid marble in perspective with a brass compass and a zodiac ring. */
function paintFloor(g: Ctx, w: number, h: number, rng: () => number): void {
  const base = g.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, css(NAVE, 1, 0));
  base.addColorStop(0.18, css([20, 16, 26]));
  base.addColorStop(1, css([10, 8, 14]));
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h * 0.42;
  const rx = Math.min(w * 0.42, 520);
  const ry = Math.min(h * 0.3, rx * 0.22);
  // Tiles in perspective toward a horizon above the canvas.
  const horizon = -h * 1.4;
  g.strokeStyle = css(AGED, 1, 0.1);
  g.lineWidth = 0.8;
  for (let i = -24; i <= 24; i++) {
    g.beginPath();
    g.moveTo(cx + i * 6, horizon);
    g.lineTo(cx + i * w * 0.09, h);
    g.stroke();
  }
  for (let k = 1; k < 9; k++) {
    const y = horizon + (h - horizon) * (1 - 1 / (1 + k * 0.45));
    if (y < 0) continue;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = css([150, 140, 170], 1, 0.04);
    g.beginPath();
    const vx = rng() * w;
    const vy = h * (0.15 + rng() * 0.8);
    g.moveTo(vx, vy);
    g.bezierCurveTo(vx + 30, vy + 6, vx + 50, vy - 4, vx + 90, vy + 3);
    g.stroke();
  }
  // Compass and zodiac ring.
  g.save();
  g.translate(cx, cy);
  g.scale(1, ry / rx);
  const brass = (a: number) => css(BRASS, 1, a);
  for (const [r, a, lw] of [
    [rx, 0.55, 2],
    [rx * 0.92, 0.4, 1],
    [rx * 0.7, 0.35, 1],
  ] as const) {
    g.strokeStyle = brass(a);
    g.lineWidth = lw * (rx / ry) * 0.5;
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    g.strokeStyle = brass(0.4);
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(Math.cos(a) * rx * 0.7, Math.sin(a) * rx * 0.7);
    g.lineTo(Math.cos(a) * rx * 0.92, Math.sin(a) * rx * 0.92);
    g.stroke();
    g.fillStyle = brass(0.5);
    const ma = a + TAU / 24;
    g.beginPath();
    g.arc(Math.cos(ma) * rx * 0.81, Math.sin(ma) * rx * 0.81, rx * 0.018, 0, TAU);
    g.fill();
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const len = i % 4 === 0 ? 0.62 : i % 2 === 0 ? 0.42 : 0.3;
    const side = a + TAU / 32;
    const side2 = a - TAU / 32;
    g.fillStyle = i % 2 === 0 ? brass(0.5) : css(GILT_HI, 1, 0.25);
    g.beginPath();
    g.moveTo(Math.cos(a) * rx * len, Math.sin(a) * rx * len);
    g.lineTo(Math.cos(side) * rx * 0.09, Math.sin(side) * rx * 0.09);
    g.lineTo(Math.cos(side2) * rx * 0.09, Math.sin(side2) * rx * 0.09);
    g.closePath();
    g.fill();
  }
  g.restore();
  // Warm spill from sconces at the sides and a few fallen pages.
  for (const sx of [0, w]) {
    const spill = g.createRadialGradient(sx, h * 0.3, 0, sx, h * 0.3, Math.min(w * 0.4, 420));
    spill.addColorStop(0, css(CANDLE_FALL, 1, 0.16));
    spill.addColorStop(1, css(CANDLE_FALL, 1, 0));
    g.fillStyle = spill;
    g.fillRect(sx - 420, 0, 840, h);
  }
  for (let i = 0; i < 5; i++) {
    const px = w * (0.1 + rng() * 0.8);
    const py = h * (0.15 + rng() * 0.35);
    g.save();
    g.translate(px, py);
    g.rotate((rng() - 0.5) * 1.4);
    g.scale(1, 0.4);
    g.fillStyle = paper(0.55 + rng() * 0.2);
    g.fillRect(-9, -12, 18, 24);
    g.restore();
  }
  // Keep the footer text's floor dark.
  const pool = g.createLinearGradient(0, h * 0.55, 0, h);
  pool.addColorStop(0, "rgba(7,6,12,0)");
  pool.addColorStop(1, "rgba(7,6,12,0.82)");
  g.fillStyle = pool;
  g.fillRect(0, h * 0.55, w, h * 0.45);
}

/* ------------------------------------------------------------------ the scene */

export function buildLibrary(ctx: HubBuildContext, planes: HubPlanes): HubSceneHooks {
  const { out, surfaces, page } = ctx;
  const create = (w: number, h: number) => surfaces.create(w, h);
  const rng = createRng(ctx.seed);
  const range = (lo: number, hi: number) => lo + rng() * (hi - lo);
  const noise = createNoise2D(ctx.seed ^ 0x6c1b);

  const starDot = radialSprite(16, [[0, "rgba(255,236,190,1)"], [0.35, "rgba(242,212,140,0.55)"], [1, "rgba(201,163,90,0)"]], create);
  const flare = flareSprite(48, "rgba(255,244,214,0.95)", "rgba(242,212,140,0.8)", create);
  const motes = [
    radialSprite(16, [[0, "rgba(255,232,180,1)"], [0.3, "rgba(242,200,120,0.55)"], [1, "rgba(201,163,90,0)"]], create),
    radialSprite(16, [[0, "rgba(232,238,255,1)"], [0.3, "rgba(205,216,255,0.5)"], [1, "rgba(143,162,230,0)"]], create),
    radialSprite(16, [[0, "rgba(255,214,150,1)"], [0.3, "rgba(255,140,60,0.65)"], [1, "rgba(255,122,46,0)"]], create),
  ];
  const warmGlow = radialSprite(128, [[0, "rgba(255,207,134,0.55)"], [0.35, "rgba(255,157,74,0.16)"], [1, "rgba(255,122,46,0)"]], create);
  const pageGlow = radialSprite(64, [[0, "rgba(255,226,170,0.5)"], [0.5, "rgba(255,190,110,0.12)"], [1, "rgba(255,170,90,0)"]], create);
  const ringSprite = radialSprite(128, [[0, "rgba(242,212,140,0)"], [0.72, "rgba(242,212,140,0)"], [0.84, "rgba(242,212,140,0.42)"], [1, "rgba(242,212,140,0)"]], create);
  const ray = (() => {
    const s = create(64, 512);
    const along = s.g.createLinearGradient(0, 0, 0, 512);
    along.addColorStop(0, "rgba(205,216,255,0.9)");
    along.addColorStop(0.4, "rgba(143,162,230,0.35)");
    along.addColorStop(1, "rgba(143,162,230,0)");
    s.g.fillStyle = along;
    s.g.beginPath();
    s.g.moveTo(24, 0);
    s.g.lineTo(40, 0);
    s.g.lineTo(64, 512);
    s.g.lineTo(0, 512);
    s.g.closePath();
    s.g.fill();
    s.g.globalCompositeOperation = "destination-out";
    const feather = s.g.createLinearGradient(0, 0, 64, 0);
    feather.addColorStop(0, "rgba(0,0,0,1)");
    feather.addColorStop(0.5, "rgba(0,0,0,0)");
    feather.addColorStop(1, "rgba(0,0,0,1)");
    s.g.fillStyle = feather;
    s.g.fillRect(0, 0, 64, 512);
    return s.canvas;
  })();

  /* ---------------- state ---------------- */

  let snap: PageSnapshot = page.getSnapshot();
  let hall: Hall = hallLayout(snap);
  let paths: DraftPath[] = draftPaths(snap, hall);
  let hallKey = "";
  let vaultKey = "";
  let W = 0;
  let H = 0;
  let scrollY = 0;
  let simT = 0;
  let tier: 0 | 1 | 2 = 0;
  let attended: string | null = null;
  let resume: string | null = null;
  /** Panel slot index per slug. */
  let panelOf = new Map<string, number>();
  const traces = new Map<string, { at: number; duration: number }>();
  const born = new Map<string, number>();
  let pressFlare: { slug: string; at: number } | null = null;
  /** Swing in degrees of each lancet's shafts toward the attended card (M1) plus a little with scroll (M6). */
  const swing = { left: 0, right: 0, leftTarget: 0, rightTarget: 0, scroll: 0 };
  let lastFrame: HubFrame | null = null;
  let introAt: number | null = null;
  let lastBurstAt = -BURST_COOLDOWN_S;
  let nextPageAt = 1.2;
  let nextDockAt = 40 + rng() * 30;
  let breath = 0.5;
  let scrollTurn = 0;
  let lastScroll = 0;
  let pointerGlow = 0;
  const pointer: { x: number; y: number; active: boolean; fine: boolean } = { x: 0, y: 0, active: false, fine: true };

  const pages: Page[] = [];
  const comets: Comet[] = [];
  const rings: Ring[] = [];
  for (let i = 0; i < COMET_CAP; i++) comets.push({ active: false, fromX: 0, fromY: 0, slug: "", star: 0, bend: 0, age: 0, duration: 1 });
  const mote = {
    x: new Float32Array(MOTE_CAP),
    y: new Float32Array(MOTE_CAP),
    vx: new Float32Array(MOTE_CAP),
    vy: new Float32Array(MOTE_CAP),
    age: new Float32Array(MOTE_CAP),
    life: new Float32Array(MOTE_CAP),
    size: new Float32Array(MOTE_CAP),
    kind: new Uint8Array(MOTE_CAP),
    count: 0,
  };
  let volumes: Volume[] = [];
  const flip = { active: false, p: 0, duration: 1, side: 1 as 1 | -1, tear: false, torn: false };
  let nextFlipAt = 3;
  const stage = { pull: null as string | null, pullAt: -10, tiltDir: 0, tiltAt: -10, slide: null as { slug: string; at: number } | null };
  let wave: { at: number; x: number; y: number } | null = null;

  /* ---------------- shelves (lazy) ---------------- */

  let shelfMods: ShelfModules | null = null;
  let shelfLoad: Promise<ShelfModules> | null = null;
  const strips: (StripState | null)[] = [null, null];
  let shelfKey = "";
  const bookSlide = { side: 0, x: 0, y: 0, w: 0, h: 0, color: [0, 0, 0] as Rgb, at: -10 };
  const spineLift = new Map<string, number>();

  /* ---------------- windows ---------------- */

  let stageSurf: Surface | null = null;
  let stageKey = "";
  let stageLayout: StageShelf | null = null;
  let stageHit: Rect = { x: 0, y: 0, w: 0, h: 0 };
  let lectern: { surf: Surface; glow: Surface; book: BookPlacement; key: string; dpr: number } | null = null;
  let lecternBookAt: BookPlacement | null = null;
  let midHit: Rect = { x: 0, y: 0, w: 0, h: 0 };
  let floor: { surf: Surface; key: string; dpr: number } | null = null;
  let groundDirty = false;

  /**
   * Staged steps grouped into drains: each queued step runs the next steps until about 14 ms
   * have passed, so an idle slice does more than one small step without a long task. One drain
   * per step is queued; the drain that runs the last step drops the job's spare drains, so the
   * next job (the other gutter) does not wait one idle callback per spare drain.
   */
  const budgeted = (key: string, steps: readonly (() => void)[]): void => {
    let next = 0;
    let calls = 0;
    const drain = () => {
      calls++;
      const start = performance.now();
      while (next < steps.length) {
        steps[next++]();
        if (performance.now() - start > 14) break;
      }
      // Only while spare drains remain: with none left the queue retires the job itself.
      if (next >= steps.length && calls < steps.length) ctx.paint.cancel(key);
    };
    ctx.paint.run(key, steps.map(() => drain));
  };

  /* ---------------- layout ---------------- */

  const winBox = (name: WindowName, f: HubFrame): { w: number; h: number; left: number } => {
    const r = f.win[name];
    const box = snap.windows[name];
    return { w: r?.w ?? W, h: r?.h ?? box.h, left: r?.x ?? 0 };
  };

  const refreshCards = () => {
    const inProgress = snap.cards.filter((c) => c.kind === "open" && !c.finished && (c.read ?? 0) > 0).sort((a, b) => (b.read ?? 0) - (a.read ?? 0));
    resume = inProgress[0]?.slug ?? null;
    assignPanels();
  };

  const assignPanels = () => {
    const order = panelOrder(snap.cards, attended, resume);
    const next = new Map<string, number>();
    order.slice(0, hall.panels.length).forEach((c, i) => next.set(c.slug, i));
    panelOf = next;
  };

  const sizeStatic = (i: number, cssW: number, cssH: number, dpr: number): Ctx | null => {
    const c = planes.statics[i]?.canvas;
    if (!c) return null;
    const bw = Math.max(0, Math.round(cssW * dpr));
    const bh = Math.max(0, Math.round(cssH * dpr));
    if (c.width !== bw || c.height !== bh) {
      c.width = bw;
      c.height = bh;
    }
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;
    const g = c.getContext("2d");
    g?.setTransform(dpr, 0, 0, dpr, 0, 0);
    return g;
  };

  const paintStatics = (f: HubFrame) => {
    const scrollRange = Math.max(0, snap.windows.ground.y + snap.windows.ground.h - H);
    const hallH = Math.ceil(H + scrollRange * 0.15 + 4);
    const hk = `${W}x${H}:${hallH}:${hall.rose.x},${hall.rose.y},${hall.rose.r}`;
    if (hk !== hallKey) {
      hallKey = hk;
      const g = sizeStatic(HALL, W, hallH, 1);
      if (g) {
        paintHallCoat(g, W, hallH);
        const local = hall;
        ctx.paint.run(`hall:${hk}`, [
          () => paintHallBase(g, local, W, hallH),
          () => {
            paintRose(g, local.rose, ctx.moonPhase);
            paintDither(g, W, hallH, createRng(ctx.seed));
          },
        ]);
      }
    }
    const lancetBottom = hall.lancets.reduce((m, l) => Math.max(m, l.bottom + 70), 0);
    const vaultH = Math.ceil(Math.max(hall.band + 60, lancetBottom));
    const vk = `${W}x${H}:${vaultH}:${JSON.stringify(hall.panels)}:${hall.rose.x},${hall.rose.y}:${snap.gutters.left},${snap.gutters.right}`;
    if (vk !== vaultKey) {
      vaultKey = vk;
      const g = sizeStatic(VAULT, W, vaultH, 1);
      if (g) {
        paintVaultCoat(g, hall, W, vaultH);
        const local = hall;
        const localSnap = snap;
        const vrng = createRng(ctx.seed ^ 0x7a017);
        ctx.paint.run(`vault:${vk}`, [
          () => paintVaultWeb(g, local, W, vaultH, vrng),
          () => paintRibs(g, local, localSnap),
          () => {
            paintPanels(g, local);
            for (const l of local.lancets) paintLancet(g, l, vrng);
            paintDither(g, W, vaultH, createRng(ctx.seed ^ 3));
          },
        ]);
      }
    }
    ensureShelves(f);
  };

  const ensureShelves = (f: HubFrame) => {
    const wantL = snap.mode !== "phone" && snap.mode !== "landscape-short" && snap.gutters.left >= 56;
    const wantR = snap.mode !== "phone" && snap.mode !== "landscape-short" && snap.gutters.right >= 56;
    if (!wantL && !wantR) {
      strips[0] = strips[1] = null;
      shelfKey = "";
      sizeStatic(SHELF_L, 0, 0, 1);
      sizeStatic(SHELF_R, 0, 0, 1);
      return;
    }
    shelfLoad ??= Promise.all([import("./library-core"), import("./library-paint")]);
    const key = `${W}x${H}:${snap.mode}:${snap.gutters.left},${snap.gutters.right}:${snap.cards.map((c) => c.slug + cardColumn(snap, c)).join(",")}`;
    if (key === shelfKey) return;
    shelfKey = key;
    if (!shelfMods) {
      // Until the bookcase modules load, each gutter shows the dark of its bookcase.
      if (wantL) paintShelfCoat(sizeStatic(SHELF_L, snap.gutters.left, H + SHELF_PERIOD + 2, 1), snap.gutters.left, H + SHELF_PERIOD + 2);
      if (wantR) paintShelfCoat(sizeStatic(SHELF_R, snap.gutters.right, H + SHELF_PERIOD + 2, 1), snap.gutters.right, H + SHELF_PERIOD + 2);
    }
    const viewport = f.page.viewport;
    void shelfLoad
      .then((mods) => {
        shelfMods = mods;
        if (key !== shelfKey) return;
        layShelves(mods, viewport);
      })
      .catch(() => {
        shelfLoad = null;
        shelfKey = "";
      });
  };

  const layShelves = (mods: ShelfModules, viewport: PageSnapshot["viewport"]) => {
    const [core, paint] = mods;
    const cards = snap.cards.map((c) => ({ ...c, column: cardColumn(snap, c) }));
    const dpr = core.shelfDpr(staticDpr(viewport));
    (["left", "right"] as const).forEach((side, i) => {
      const gutter = side === "left" ? snap.gutters.left : snap.gutters.right;
      const plan = core.shelfPlan(snap.mode, gutter, side);
      const index = i === 0 ? SHELF_L : SHELF_R;
      if (!plan) {
        strips[i] = null;
        sizeStatic(index, 0, 0, 1);
        return;
      }
      const strip = core.layoutShelfStrip({ plan, seed: ctx.seed, cards: core.cardsForSide(cards, side) });
      strips[i] = { strip, left: side === "left" ? 0 : W - plan.width };
      const g = sizeStatic(index, plan.width, H + SHELF_PERIOD + 2, dpr);
      if (!g) return;
      paintShelfCoat(g, plan.width, H + SHELF_PERIOD + 2);
      const tile = surfaces.create(strip.width * dpr, SHELF_PERIOD * dpr);
      budgeted(`shelf:${side}:${shelfKey}`, [
        ...paint.shelfTileSteps(tile.g, strip, dpr, ctx.seed),
        () => {
          paint.fillFromTile(g, tile.canvas, Math.round(strip.phase * dpr));
          surfaces.release(tile);
        },
      ]);
    });
  };

  const recompose = (f: HubFrame) => {
    snap = f.page;
    W = f.width;
    H = f.height;
    hall = hallLayout(snap);
    paths = draftPaths(snap, hall);
    refreshCards();
    const orbits = volumeOrbits(snap, hall, createRng(ctx.seed ^ 0x5011));
    if (volumes.length !== orbits.length) {
      const progress = snap.cards.filter((c) => c.kind === "open" && (c.read ?? 0) > 0);
      volumes = orbits.map((orbit, i) => {
        const card = progress[i % Math.max(1, progress.length)];
        const tint = card ? mix(OXBLOOD, hex(card.accent, GILT), 0.4) : ([OXBLOOD, [29, 51, 40], [27, 35, 64], [58, 31, 61]] as Rgb[])[i % 4];
        return { orbit, slug: card?.slug ?? null, tint, state: 0, since: 0, slot: null, from: { x: 0, y: 0 }, x: 0, y: 0, heading: 0 };
      });
    } else {
      volumes.forEach((v, i) => {
        v.orbit = orbits[i];
        v.state = 0;
        v.slot = null;
      });
    }
    paintStatics(f);
    stageKey = "";
    lecternBookAt = null;
  };

  /* ---------------- figures ---------------- */

  /** Viewport position of star `i` of the card's figure, following the vault plane. */
  const starAt = (slug: string, i: number, vaultY: number, outv: Vec): boolean => {
    const slot = panelOf.get(slug);
    if (slot === undefined) return false;
    const p = hall.panels[slot];
    const fig = figureFor(slug);
    const st = fig.stars[i % fig.stars.length];
    outv.x = p.x + p.w / 2 + st[0] * p.w * 0.34;
    outv.y = p.y + p.h / 2 + st[1] * p.h * 0.32 - vaultY;
    return true;
  };

  const cardBySlug = (slug: string | null): CardInfo | undefined => (slug ? snap.cards.find((c) => c.slug === slug) : undefined);

  const drawFigures = (g: Ctx, f: HubFrame, still: boolean) => {
    const vaultY = f.staticY[VAULT] ?? 0;
    const tmp = { x: 0, y: 0 };
    const t = simT;
    for (const card of snap.cards) {
      const slot = panelOf.get(card.slug);
      if (slot === undefined) continue;
      const p = hall.panels[slot];
      const py = p.y - vaultY;
      if (py + p.h < -10 || py > H + 10) continue;
      if (card.kind === "locked") {
        // A diagonal oxblood cloth draped across the lapis panel, hemmed in gilt, with the
        // uncharted dots faint beside it: pages never fly to it.
        const fig = figureFor(card.slug);
        g.fillStyle = css(GILT, 1, 0.12);
        for (let i = 0; i < fig.stars.length; i++) {
          const st = fig.stars[i];
          g.beginPath();
          g.arc(p.x + p.w / 2 + st[0] * p.w * 0.34, py + p.h / 2 + st[1] * p.h * 0.32, 1.1, 0, TAU);
          g.fill();
        }
        g.save();
        g.beginPath();
        g.ellipse(p.x + p.w / 2, py + p.h / 2, p.w / 2 - 1.5, p.h / 2 - 1.5, 0, 0, TAU);
        g.clip();
        g.translate(p.x + p.w / 2, py + p.h / 2);
        g.rotate(-0.5);
        const band = p.h * 0.46;
        g.fillStyle = "rgba(74,28,34,0.85)";
        g.fillRect(-p.w, -band / 2, p.w * 2, band);
        g.fillStyle = "rgba(107,42,49,0.4)";
        g.fillRect(-p.w, -band * 0.18, p.w * 2, 1.2);
        g.fillRect(-p.w, band * 0.16, p.w * 2, 1);
        g.fillStyle = "rgba(201,163,90,0.55)";
        g.fillRect(-p.w, -band / 2, p.w * 2, 0.8);
        g.fillRect(-p.w, band / 2 - 0.8, p.w * 2, 0.8);
        g.restore();
        continue;
      }
      const fig = figureFor(card.slug);
      const lit = card.kind === "upcoming" ? 0 : litStars(card.read, card.finished, fig.stars.length);
      const trace = traces.get(card.slug);
      let traced = card.kind === "open" && tracedAtRest(card) ? 1 : 0;
      if (trace) traced = Math.max(traced, still ? 1 : traceProgress(t - trace.at, trace.duration));
      if (introAt !== null && !still && card.finished) traced *= smoothstep(introAt + 0.9, introAt + 1.9, t);
      const press = pressFlare && pressFlare.slug === card.slug ? pressEnvelope(t - pressFlare.at) : 0;
      const attend = card.slug === attended ? 1 : 0;
      // Lines.
      if (traced > 0 && card.kind === "open") {
        g.strokeStyle = css(GILT_HI, 1, 0.55 + 0.25 * attend);
        g.lineWidth = 0.9;
        g.beginPath();
        const total = fig.edges.length;
        const shown = traced * total;
        fig.edges.forEach(([a, b], k) => {
          if (k >= shown) return;
          const part = Math.min(1, shown - k);
          starAt(card.slug, a, vaultY, tmp);
          const ax = tmp.x;
          const ay = tmp.y;
          starAt(card.slug, b, vaultY, tmp);
          g.moveTo(ax, ay);
          g.lineTo(lerp(ax, tmp.x, part), lerp(ay, tmp.y, part));
        });
        g.stroke();
      }
      // Stars.
      fig.stars.forEach((_, i) => {
        starAt(card.slug, i, vaultY, tmp);
        const bornAt = born.get(`${card.slug}:${i}`);
        const transient = bornAt !== undefined ? clamp(1 - (t - bornAt) / BORN_LIFE_S, 0, 1) * smoothstep(0, 0.8, t - bornAt) : 0;
        const isLit = i < lit;
        const ramp = introAt !== null && !still ? introLight(t - introAt, tmp.y, H) : 1;
        const on = Math.max(isLit ? 1 : 0, transient, attend * 0.35) * ramp;
        if (on > 0.02 || press > 0) {
          const tw = still ? 1 : twinkle(t, 0.18 + (i % 4) * 0.08, i * 1.7 + card.index);
          const size = (card.kind === "upcoming" ? 7 : 11) * (0.85 + 0.15 * tw) * (1 + press * 0.6);
          g.globalCompositeOperation = "lighter";
          g.globalAlpha = clamp(on * (0.75 + 0.25 * tw) + press * 0.6, 0, 1);
          g.drawImage(flare, tmp.x - size, tmp.y - size, size * 2, size * 2);
          g.globalAlpha = 1;
          g.globalCompositeOperation = "source-over";
        } else {
          g.globalAlpha = card.kind === "upcoming" ? 0.35 : 0.6;
          g.drawImage(starDot, tmp.x - 2.5, tmp.y - 2.5, 5, 5);
          g.globalAlpha = 1;
        }
      });
      if (attend && !still) {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = 0.18;
        g.drawImage(warmGlow, p.x - p.w * 0.2, py - p.h * 0.6, p.w * 1.4, p.h * 2.2);
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      }
    }
  };

  /** Press flare: ramps up over 0.35 s, back down over 0.9 s. */
  const pressEnvelope = (dt: number): number => (dt < 0 ? 0 : dt < 0.35 ? smoothstep(0, 0.35, dt) : 1 - smoothstep(0.35, 1.25, dt));

  /* ---------------- pages ---------------- */

  const spawnPage = (path: DraftPath, s: number, reserved: boolean, target: string | null): Page | null => {
    const pool = pagePool(snap.mode, tier);
    const index = slotFor(pages, pool.pool, pool.ambient, reserved);
    if (index < 0) return null;
    let p = pages[index];
    if (!p) {
      p = {
        active: false, path, s: 0, speed: 0, ox: 0, oy: 0, vx: 0, vy: 0, age: 0, life: 1, size: 1, aspect: 1.3,
        yaw: 0, pitch: 0, roll: 0, dyaw: 0, dpitch: 0, droll: 0, curl: 0, curlPhase: 0, burnFrom: 1, shed: 0,
        jag: new Float32Array(8), x: 0, y: 0, zoneAge: null, target: null, reserved: false, homing: false,
      };
      pages.push(p);
    }
    const phone = snap.mode === "phone" || snap.mode === "landscape-short";
    Object.assign(p, {
      active: true, path, s, speed: range(PAGE_SPEED[0], PAGE_SPEED[1]), ox: range(-8, 8), oy: range(-8, 8), vx: 0, vy: 0,
      age: 0, life: range(PAGE_LIFE[0], PAGE_LIFE[1]), size: (phone ? 18 : 26) * range(0.8, 1.15), aspect: range(1.22, 1.42),
      yaw: range(-1.2, 1.2), pitch: range(-1.1, 1.1), roll: range(-Math.PI, Math.PI), dyaw: range(-0.55, 0.55),
      dpitch: range(0.25, 0.8) * (rng() < 0.5 ? -1 : 1), droll: range(-0.5, 0.5), curl: range(0.3, 0.8), curlPhase: range(0, TAU),
      burnFrom: rng() < 0.5 ? 1 : -1, shed: range(0, 0.4), zoneAge: s >= path.burnAt ? 0 : null, target, reserved, homing: false,
    });
    for (let i = 0; i < p.jag.length; i++) p.jag[i] = rng() * 2 - 1;
    return p;
  };

  /** A target for a page's comet: the given card, else a charted open or upcoming figure (in-progress ones three times as often). */
  const pickTarget = (prefer: string | null): string | null => {
    const ok = (c: CardInfo | undefined) => c && c.kind !== "locked" && panelOf.has(c.slug);
    if (prefer && ok(cardBySlug(prefer))) return prefer;
    const pool: string[] = [];
    for (const c of snap.cards) {
      if (!ok(c)) continue;
      pool.push(c.slug);
      if ((c.read ?? 0) > 0 && !c.finished) pool.push(c.slug, c.slug);
    }
    return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
  };

  const launchComet = (x: number, y: number, slug: string | null) => {
    if (!slug) return;
    const c = comets.find((k) => !k.active);
    if (!c) return;
    const fig = figureFor(slug);
    const card = cardBySlug(slug);
    const lit = card ? litStars(card.read, card.finished, fig.stars.length) : 0;
    // Prefer an unlit star, so a page-born star visits it for 40 s.
    const star = lit < fig.stars.length ? lit + Math.floor(rng() * (fig.stars.length - lit)) : Math.floor(rng() * fig.stars.length);
    Object.assign(c, { active: true, fromX: x, fromY: y, slug, star, bend: range(-0.3, 0.3), age: 0, duration: range(1.6, 2.6) });
  };

  const docToView = (p: DraftPath, y: number) => (p.doc ? y - scrollY : y);

  const stepPages = (dt: number) => {
    const tmp = { x: 0, y: 0 };
    const life: PageLife = { opacity: 0, burn: 0 };
    for (const p of pages) {
      if (!p.active) continue;
      p.age += dt;
      p.s += (p.speed * dt) / p.path.lut.length;
      if (p.zoneAge === null && p.s >= p.path.burnAt) p.zoneAge = p.age;
      pageLifecycle(p.age, p.life, life, p.homing ? null : p.zoneAge);
      if (life.burn >= 1 || p.s >= 1 || p.age >= p.life) {
        if (life.burn >= 1) launchComet(p.x, p.y, p.target ?? pickTarget(null));
        p.active = false;
        continue;
      }
      p.yaw += p.dyaw * dt;
      p.pitch += p.dpitch * dt;
      p.roll += p.droll * dt;
      lutAt(p.path.lut, p.s, tmp);
      const lane = 10 + p.s * 30;
      const nx = noise(p.curlPhase, simT * 0.16 + p.s * 3);
      const ny = noise(p.curlPhase + 11, simT * 0.14 + p.s * 3);
      p.vx += (nx * lane - p.ox) * dt * 0.5;
      p.vy += (ny * lane - p.oy) * dt * 0.5;
      if (pointer.active && pointer.fine && tier === 0) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d = Math.hypot(dx, dy);
        if (d < 120 && d > 0.01) {
          // A local draft around the pointer: a small vortex rather than a push.
          const k = (1 - d / 120) * 180 * dt;
          p.vx += (-dy / d) * k + (dx / d) * k * 0.3;
          p.vy += (dx / d) * k + (dy / d) * k * 0.3;
        }
      }
      const damp = Math.exp(-dt * 1.3);
      p.vx *= damp;
      p.vy *= damp;
      p.ox += p.vx * dt;
      p.oy += p.vy * dt;
      p.x = tmp.x + p.ox;
      p.y = docToView(p.path, tmp.y) + p.oy;
      p.shed -= dt;
      if (p.shed <= 0 && life.opacity > 0.3) {
        const burning = life.burn > 0;
        p.shed = burning ? range(0.03, 0.08) : range(0.3, 0.6);
        spawnMote(p.x + range(-5, 5), p.y + range(-5, 5), burning ? 2 : 0, burning ? range(1.6, 3.4) : range(1.2, 2.4), range(1.5, 3.5), range(-20, 20), range(-30, 6));
      }
    }
  };

  const meshX = new Float32Array((PAGE_SEGMENTS + 1) * 2);
  const meshY = new Float32Array((PAGE_SEGMENTS + 1) * 2);
  const lifeOut: PageLife = { opacity: 0, burn: 0 };

  /** The 3D page mesh with its burn edge (ported from the grimoire scene). */
  const drawPage = (g: Ctx, p: Page, ox: number, oy: number, t: number) => {
    pageLifecycle(p.age, p.life, lifeOut, p.homing ? null : p.zoneAge);
    if (lifeOut.opacity <= 0.01) return;
    const x = p.x - ox;
    const y = p.y - oy;
    const alpha = lifeOut.opacity * dimAt(p.x, p.y);
    const w = p.size;
    const h = p.size * p.aspect;
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = alpha * (0.18 + lifeOut.burn * 0.5);
    g.drawImage(pageGlow, x - w * 1.7, y - w * 1.7, w * 3.4, w * 3.4);
    g.globalCompositeOperation = "source-over";
    const cy = Math.cos(p.yaw);
    const sy = Math.sin(p.yaw);
    const cp = Math.cos(p.pitch);
    const sp = Math.sin(p.pitch);
    const cr = Math.cos(p.roll);
    const sr = Math.sin(p.roll);
    const m00 = cr * cy + sr * sp * sy;
    const m01 = -sr * cp;
    const m02 = cr * sy - sr * sp * cy;
    const m10 = sr * cy - cr * sp * sy;
    const m11 = cr * cp;
    const m12 = sr * sy + cr * sp * cy;
    const m20 = -cp * sy;
    const m21 = sp;
    const m22 = cp * cy;
    for (let j = 0; j <= PAGE_SEGMENTS; j++) {
      const b = (j / PAGE_SEGMENTS - 0.5) * p.burnFrom;
      const curl = Math.sin(b * Math.PI * 1.5 + p.curlPhase + t * 0.7) * p.curl * w * 0.34;
      for (let k = 0; k < 2; k++) {
        const a = k === 0 ? -0.5 : 0.5;
        const px = a * w;
        const py = b * h;
        const pz = curl + a * a * w * 0.1;
        const X = m00 * px + m01 * py + m02 * pz;
        const Y = m10 * px + m11 * py + m12 * pz;
        const Z = m20 * px + m21 * py + m22 * pz;
        const persp = 1 + Z / 520;
        meshX[j * 2 + k] = x + X * persp;
        meshY[j * 2 + k] = y + Y * persp;
      }
    }
    const cut = lifeOut.burn * PAGE_SEGMENTS * 1.02;
    const stripArea = (w * h) / PAGE_SEGMENTS || 1;
    g.globalAlpha = alpha;
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
      const color = paper(clamp(0.4 + facing * 0.56 + Math.sin(p.pitch + j * 0.5) * 0.05, 0, 1), area < 0);
      g.fillStyle = color;
      g.strokeStyle = color;
      g.lineWidth = 0.5;
      g.beginPath();
      if (j < cut) {
        const q = cut - j;
        for (let n = 0; n < p.jag.length; n++) {
          const r = n / (p.jag.length - 1);
          const qq = clamp(q + p.jag[n] * 0.3, 0, 1);
          const px = lerp(lerp(ax, bx, r), lerp(dx, cx, r), qq);
          const py = lerp(lerp(ay, by, r), lerp(dy, cyy, r), qq);
          if (n === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.lineTo(cx, cyy);
        g.lineTo(dx, dy);
      } else {
        g.moveTo(ax, ay);
        g.lineTo(bx, by);
        g.lineTo(cx, cyy);
        g.lineTo(dx, dy);
      }
      g.closePath();
      g.fill();
      g.stroke();
    }
    if (w > 15 && lifeOut.burn < 0.9) {
      g.strokeStyle = "rgba(92,62,42,0.36)";
      g.lineWidth = 0.6;
      g.beginPath();
      for (let j = 1; j < PAGE_SEGMENTS; j++) {
        if (j <= cut + 0.6) continue;
        const i = j * 2;
        g.moveTo(lerp(meshX[i], meshX[i + 1], 0.14), lerp(meshY[i], meshY[i + 1], 0.14));
        g.lineTo(lerp(meshX[i], meshX[i + 1], j % 3 === 0 ? 0.62 : 0.86), lerp(meshY[i], meshY[i + 1], j % 3 === 0 ? 0.62 : 0.86));
      }
      g.stroke();
    }
    if (lifeOut.burn > 0) {
      const j = Math.floor(cut);
      if (j < PAGE_SEGMENTS) {
        const i0 = j * 2;
        const i1 = (j + 1) * 2;
        const q = cut - j;
        g.beginPath();
        for (let n = 0; n < p.jag.length; n++) {
          const r = n / (p.jag.length - 1);
          const qq = clamp(q + p.jag[n] * 0.3, 0, 1);
          const px = lerp(lerp(meshX[i0], meshX[i0 + 1], r), lerp(meshX[i1], meshX[i1 + 1], r), qq);
          const py = lerp(lerp(meshY[i0], meshY[i0 + 1], r), lerp(meshY[i1], meshY[i1 + 1], r), qq);
          if (n === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokeStyle = `rgba(52,26,16,${alpha * 0.7})`;
        g.lineWidth = 2.6;
        g.stroke();
        g.globalCompositeOperation = "lighter";
        g.strokeStyle = `rgba(255,150,60,${alpha})`;
        g.lineWidth = 1.5;
        g.stroke();
        g.strokeStyle = `rgba(255,236,190,${alpha * 0.9})`;
        g.lineWidth = 0.6;
        g.stroke();
        g.globalCompositeOperation = "source-over";
      }
    }
    g.globalAlpha = 1;
  };

  /** Pages and motes dim near text and controls (holes), so nothing bright passes behind words. */
  const dimAt = (x: number, y: number): number => {
    const d = page.holeDistance(x, y + scrollY);
    return d >= 26 ? 1 : lerp(0.25, 1, Math.max(0, d) / 26);
  };

  /* ---------------- motes ---------------- */

  const spawnMote = (x: number, y: number, kind: number, size: number, lifeS: number, vx: number, vy: number) => {
    const cap = Math.min(MOTE_CAP, Math.round(moteCount(snap.mode, W, H) * (tier >= 1 ? 0.5 : 1)));
    if (mote.count >= cap) return;
    const i = mote.count++;
    mote.x[i] = x;
    mote.y[i] = y;
    mote.vx[i] = vx;
    mote.vy[i] = vy;
    mote.age[i] = 0;
    mote.life[i] = lifeS;
    mote.size[i] = size;
    mote.kind[i] = kind;
  };

  /** An open spot for an ambient mote: gutters, the top band and the bands between rows, never behind a card. */
  const openSpot = (outv: Vec): boolean => {
    for (let k = 0; k < 6; k++) {
      outv.x = rng() * W;
      outv.y = rng() * H;
      if (!page.isCovered(outv.x, outv.y + scrollY, 2)) return true;
    }
    return false;
  };

  const stepMotes = (dt: number) => {
    const target = Math.round(moteCount(snap.mode, W, H) * (tier >= 1 ? 0.5 : 1));
    const spot = { x: 0, y: 0 };
    let spawn = Math.min(8, Math.ceil(((target - mote.count) / Math.max(1, target)) * 8));
    while (spawn-- > 0 && openSpot(spot)) {
      spawnMote(spot.x, spot.y, rng() < 0.62 ? 0 : 1, range(1, 2.6), range(5, 12), range(-6, 6), range(-10, -2));
    }
    for (let i = mote.count - 1; i >= 0; i--) {
      mote.age[i] += dt;
      if (mote.age[i] >= mote.life[i] || mote.y[i] < -20 || mote.y[i] > H + 20) {
        const last = --mote.count;
        if (i !== last) {
          mote.x[i] = mote.x[last];
          mote.y[i] = mote.y[last];
          mote.vx[i] = mote.vx[last];
          mote.vy[i] = mote.vy[last];
          mote.age[i] = mote.age[last];
          mote.life[i] = mote.life[last];
          mote.size[i] = mote.size[last];
          mote.kind[i] = mote.kind[last];
        }
        continue;
      }
      if ((i & 3) === (Math.floor(simT * 60) & 3)) {
        const swirl = noise(mote.x[i] * 0.006, mote.y[i] * 0.006 + simT * 0.05) * TAU;
        mote.vx[i] += Math.cos(swirl) * 10 * dt * 4;
        mote.vy[i] += Math.sin(swirl) * 10 * dt * 4 - (mote.kind[i] === 2 ? 14 : 2) * dt * 4;
      }
      const damp = 1 - Math.min(0.9, dt * 0.8);
      mote.vx[i] *= damp;
      mote.vy[i] *= damp;
      mote.x[i] += mote.vx[i] * dt;
      mote.y[i] += mote.vy[i] * dt;
    }
  };

  const drawMotes = (g: Ctx, still: boolean) => {
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < mote.count; i++) {
      const life = mote.life[i];
      const a = still ? 0.7 : Math.min(1, mote.age[i] / 0.8) * Math.min(1, (life - mote.age[i]) / 1.2);
      const x = mote.x[i];
      const y = mote.y[i];
      const lightUp = 0.35 + shaftAt(x, y) * 2.4;
      const s = mote.size[i] * (mote.kind[i] === 2 ? 2.2 : 2.6);
      g.globalAlpha = clamp(a * lightUp * dimAt(x, y), 0, 1);
      g.drawImage(motes[mote.kind[i]], x - s, y - s, s * 2, s * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  };

  /* ---------------- shafts ---------------- */

  interface Shaft {
    x: number;
    y: number;
    angle: number;
    width: number;
    length: number;
    clip0: number;
    clip1: number;
    alpha: number;
    phase: number;
  }
  let shafts: Shaft[] = [];

  const layShafts = (vaultY: number) => {
    shafts = [];
    for (const l of hall.lancets) {
      const inward = l.side === "left" ? 1 : -1;
      const g = l.side === "left" ? snap.gutters.left : snap.gutters.right;
      const clip0 = l.side === "left" ? 0 : W - g + 12;
      const clip1 = l.side === "left" ? g - 12 : W;
      for (let k = 0; k < 3; k++) {
        shafts.push({
          x: l.x + (k - 1) * l.w * 0.28,
          y: l.top + (l.bottom - l.top) * (0.35 + k * 0.12) - vaultY,
          // A positive rotation turns the ray's +y axis toward -x, so an inward lean is negative
          // on the left lancet and positive on the right.
          angle: (-inward * (20 + k * 3 + (l.side === "left" ? swing.left : swing.right)) + swing.scroll) * (Math.PI / 180),
          width: l.w * (0.8 + k * 0.16),
          // Light falls into the hall and is spent within about 300 px.
          length: Math.min(H * (0.75 + k * 0.1), 280 + k * 30),
          clip0,
          clip1,
          alpha: 0.09 + (k === 1 ? 0.03 : 0),
          phase: k * 2.1 + (l.side === "left" ? 0 : 1.3),
        });
      }
    }
  };

  /** Brightness of the moon shafts at a viewport point (for the motes that brighten inside them). */
  const shaftAt = (x: number, y: number): number => {
    let sum = 0;
    for (const s of shafts) {
      if (x < s.clip0 || x > s.clip1) continue;
      const dy = y - s.y;
      if (dy < 0 || dy > s.length) continue;
      const cx = s.x - Math.sin(s.angle) * dy;
      const half = (s.width * (0.4 + (dy / s.length) * 0.6)) / 2;
      const d = Math.abs(x - cx);
      if (d < half) sum += s.alpha * (1 - d / half) * (1 - dy / s.length);
    }
    return sum;
  };

  const drawShafts = (g: Ctx, still: boolean) => {
    if (!shafts.length) return;
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const s of shafts) {
      const breatheS = still || tier >= 1 ? 1 : 0.72 + 0.28 * Math.sin((simT * TAU) / (8 + (s.phase % 4)) + s.phase);
      g.save();
      g.beginPath();
      g.rect(s.clip0, 0, s.clip1 - s.clip0, H);
      g.clip();
      g.translate(s.x, s.y);
      g.rotate(s.angle);
      g.globalAlpha = clamp(s.alpha * breatheS, 0, 0.18);
      g.drawImage(ray, -s.width / 2, 0, s.width, s.length);
      g.restore();
    }
    g.restore();
  };

  /* ---------------- candles ---------------- */

  interface Flame {
    x: number;
    y: number;
    phase: number;
  }
  const flames: Flame[] = [];

  /** Every sconce flame on screen this frame, in viewport px. */
  const visibleSconces = (f: HubFrame) => {
    flames.length = 0;
    strips.forEach((st, i) => {
      if (!st) return;
      const off = f.staticY[i === 0 ? SHELF_L : SHELF_R] ?? 0;
      for (const s of st.strip.sconces) {
        for (let k = -1; k <= Math.ceil(H / SHELF_PERIOD) + 1; k++) {
          const y = s.y + st.strip.phase - off + k * SHELF_PERIOD;
          if (y > -30 && y < H + 30) flames.push({ x: st.left + s.x, y, phase: s.x * 0.13 + s.y * 0.07 });
        }
      }
    });
  };

  const drawFlames = (g: Ctx, still: boolean) => {
    const paintFlame = shelfMods?.[1].paintFlame;
    for (const fl of flames) {
      const k = (still ? 1 : flicker(simT, fl.phase)) * (introAt !== null && !still ? introLight(simT - introAt, fl.y, H) : 1);
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.22 * k;
      g.drawImage(warmGlow, fl.x - 70, fl.y - 74, 140, 140);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      if (paintFlame && k > 0.05) paintFlame(g, fl.x, fl.y, k);
    }
  };

  /** Soft warm light in the bands between card rows; on touch it leans toward the attended card's accent. */
  const drawBandLight = (g: Ctx, still: boolean) => {
    const accent = hex(cardBySlug(attended)?.accent ?? "", CANDLE);
    for (const b of snap.bands) {
      const y = b.y - scrollY;
      if (y + b.h < 0 || y > H) continue;
      const k = still ? 1 : flicker(simT, b.y * 0.01);
      const near = attended && !pointer.fine ? bandNearAttended(b) : 0;
      const c = mix(CANDLE, accent, near * 0.7);
      // An ellipse on each shell edge that fades to nothing at the band's top and bottom, so it
      // warms the plank ends without drawing a hard-edged strip over the bookcases.
      for (const side of [0, 1]) {
        const gutter = side === 0 ? snap.gutters.left : snap.gutters.right;
        const r = clamp(gutter * 0.6, 60, 160);
        const gx = side === 0 ? gutter : W - gutter;
        const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
        grad.addColorStop(0, css(c, 1, (0.05 + near * 0.05) * k));
        grad.addColorStop(1, css(c, 1, 0));
        g.save();
        g.translate(gx, y + b.h / 2);
        g.scale(1, b.h / 2 / r);
        g.fillStyle = grad;
        g.fillRect(-r, -r, r * 2, r * 2);
        g.restore();
      }
    }
  };

  const bandNearAttended = (b: Rect): number => {
    const c = cardBySlug(attended);
    if (!c) return 0;
    const above = Math.abs(b.y + b.h - c.rect.y) < 4;
    const below = Math.abs(b.y - (c.rect.y + c.rect.h)) < 4;
    return above || below ? 1 : 0;
  };

  /* ---------------- volumes ---------------- */

  const drawVolume = (g: Ctx, v: Volume, open: number) => {
    const size = snap.mode === "phone" || snap.mode === "landscape-short" ? 12 : 16;
    g.save();
    g.translate(v.x, v.y);
    g.rotate(v.heading * 0.25);
    const tmp = { x: 0, y: 0 };
    // Covers as wings on the hinge, through the page-turn curve.
    for (const side of [-1, 1]) {
      pageFlipPoint(1, 0.5 - side * open * 0.42, tmp);
      const reach = Math.abs(tmp.x) * size;
      const lift = tmp.y * size * 0.5;
      g.fillStyle = css(v.tint, side < 0 ? 1.1 : 0.75);
      g.beginPath();
      g.moveTo(0, -size * 0.62);
      g.lineTo(side * reach, -size * 0.62 - lift);
      g.lineTo(side * reach, size * 0.62 - lift);
      g.lineTo(0, size * 0.62);
      g.closePath();
      g.fill();
      g.strokeStyle = css(GILT, 1, 0.65);
      g.lineWidth = 0.7;
      g.stroke();
    }
    if (open > 0.2) {
      g.fillStyle = paper(0.75);
      g.fillRect(-1.6, -size * 0.55, 3.2, size * 1.1);
    }
    g.fillStyle = css(v.tint, 0.55);
    g.fillRect(-1.2, -size * 0.64, 2.4, size * 1.28);
    g.restore();
  };

  const slotView = (v: Volume, f: HubFrame): Vec | null => {
    if (!v.slot) return null;
    const st = strips[v.slot.side];
    if (!st) return null;
    const off = f.staticY[v.slot.side === 0 ? SHELF_L : SHELF_R] ?? 0;
    let y = v.slot.y + st.strip.phase - off;
    y = ((y % SHELF_PERIOD) + SHELF_PERIOD) % SHELF_PERIOD;
    return { x: st.left + v.slot.x + v.slot.w / 2, y };
  };

  const stepVolumes = (f: HubFrame) => {
    const tmp = { x: 0, y: 0 };
    for (const v of volumes) {
      const heading = orbitAt(v.orbit, simT, tmp);
      if (v.state === 0) {
        v.x = tmp.x;
        v.y = tmp.y;
        v.heading = heading;
        continue;
      }
      const target = slotView(v, f);
      const age = simT - v.since;
      if (!target) {
        v.state = 0;
        continue;
      }
      if (v.state === 1) {
        const k = smoothstep(0, 3, age);
        v.x = lerp(v.from.x, target.x, k);
        v.y = lerp(v.from.y, target.y - 10, k);
        if (age >= 3) {
          v.state = 2;
          v.since = simT;
        }
      } else if (v.state === 2) {
        v.x = target.x;
        v.y = target.y - 10;
        if (age > 16) {
          v.state = 3;
          v.since = simT;
          v.from = { x: v.x, y: v.y };
        }
      } else {
        const k = smoothstep(0, 3, age);
        v.x = lerp(v.from.x, tmp.x, k);
        v.y = lerp(v.from.y, tmp.y, k);
        if (age >= 3) v.state = 0;
      }
    }
    if (simT >= nextDockAt) {
      nextDockAt = simT + 45 + rng() * 30;
      dock(f);
    }
  };

  /** About once a minute a flying volume settles into a recorded empty slot on screen. */
  const dock = (f: HubFrame) => {
    const v = volumes.find((k) => k.state === 0);
    if (!v) return;
    const options: { side: 0 | 1; x: number; y: number; w: number }[] = [];
    strips.forEach((st, i) => {
      if (!st) return;
      const off = f.staticY[i === 0 ? SHELF_L : SHELF_R] ?? 0;
      for (const s of st.strip.slots) {
        const y = ((s.y + st.strip.phase - off) % SHELF_PERIOD + SHELF_PERIOD) % SHELF_PERIOD;
        if (y > 80 && y < H - 40) options.push({ side: i as 0 | 1, x: s.x, y: s.y, w: s.w });
      }
    });
    if (!options.length) return;
    v.slot = options[Math.floor(rng() * options.length)];
    v.state = 1;
    v.since = simT;
    v.from = { x: v.x, y: v.y };
  };

  /* ---------------- comets and rings ---------------- */

  const stepComets = (dt: number) => {
    for (const c of comets) {
      if (!c.active) continue;
      c.age += dt;
      if (c.age >= c.duration) {
        c.active = false;
        born.set(`${c.slug}:${c.star}`, simT);
        out.beat(c.slug, "star");
      }
    }
    for (const [key, at] of born) if (simT - at > BORN_LIFE_S) born.delete(key);
    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i].age += dt;
      if (rings[i].age > 1.3) rings.splice(i, 1);
    }
  };

  const drawComets = (g: Ctx, f: HubFrame) => {
    const tmp = { x: 0, y: 0 };
    const vaultY = f.staticY[VAULT] ?? 0;
    g.globalCompositeOperation = "lighter";
    for (const c of comets) {
      if (!c.active || !starAt(c.slug, c.star, vaultY, tmp)) continue;
      const k = smoothstep(0, 1, c.age / c.duration);
      const mx = (c.fromX + tmp.x) / 2 + (tmp.y - c.fromY) * c.bend;
      const my = (c.fromY + tmp.y) / 2 - (tmp.x - c.fromX) * c.bend;
      for (let j = 0; j < 7; j++) {
        const q = Math.max(0, k - j * 0.025);
        const x = (1 - q) * (1 - q) * c.fromX + 2 * (1 - q) * q * mx + q * q * tmp.x;
        const y = (1 - q) * (1 - q) * c.fromY + 2 * (1 - q) * q * my + q * q * tmp.y;
        const s = (7 - j) * 1.1;
        g.globalAlpha = (1 - j / 7) * 0.8;
        g.drawImage(motes[0], x - s, y - s, s * 2, s * 2);
      }
    }
    for (const r of rings) {
      if (r.plane !== "sky") continue;
      const k = r.age / 1.3;
      const s = r.r * (0.4 + k * 0.6);
      g.globalAlpha = (1 - k) * 0.9;
      g.drawImage(ringSprite, r.x - s, r.y - s, s * 2, s * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  };

  /* ---------------- shelf interaction (desktop) ---------------- */

  /** Viewport rect of the attended card's spine in its bookcase, when on screen. */
  const spineView = (slug: string, f: HubFrame): { x: number; y: number; w: number; h: number; side: 0 | 1; rune: number; color: Rgb } | null => {
    for (let i = 0; i < 2; i++) {
      const st = strips[i];
      const sp = st?.strip.spines.find((s) => s.slug === slug);
      if (!st || !sp) continue;
      const off = f.staticY[i === 0 ? SHELF_L : SHELF_R] ?? 0;
      for (let k = -1; k <= Math.ceil(H / SHELF_PERIOD) + 1; k++) {
        const y = sp.y + st.strip.phase - off + k * SHELF_PERIOD;
        if (y > -sp.h && y < H) return { x: st.left + sp.x, y, w: sp.w, h: sp.h, side: i as 0 | 1, rune: sp.rune, color: sp.color };
      }
    }
    return null;
  };

  const drawSpineLift = (g: Ctx, f: HubFrame, still: boolean) => {
    for (const [slug, at] of spineLift) {
      const sv = spineView(slug, f);
      const k = still ? (slug === attended ? 1 : 0) : slug === attended ? smoothstep(0, 0.35, simT - at) : 1 - smoothstep(0, 0.35, simT - at);
      if (!sv || k <= 0.01) {
        if (slug !== attended && simT - at > 0.4) spineLift.delete(slug);
        continue;
      }
      const lift = 6 * k;
      g.fillStyle = "rgba(4,3,6,0.9)";
      g.fillRect(sv.x - 0.5, sv.y + sv.h - lift - 1, sv.w + 1, lift + 1);
      const body = g.createLinearGradient(sv.x, 0, sv.x + sv.w, 0);
      body.addColorStop(0, css(sv.color, 0.35));
      body.addColorStop(0.45, css(sv.color, 0.75 + 0.3 * k));
      body.addColorStop(1, css(sv.color, 0.3));
      g.fillStyle = body;
      g.fillRect(sv.x, sv.y - lift, sv.w, sv.h);
      g.fillStyle = css(GILT_HI, 1, 0.8);
      g.fillRect(sv.x + 0.6, sv.y - lift + sv.h * 0.06, sv.w - 1.2, 0.9);
      g.fillRect(sv.x + 0.6, sv.y - lift + sv.h * 0.92, sv.w - 1.2, 0.9);
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.55 * k;
      const r = Math.max(10, sv.w * 1.4);
      g.drawImage(warmGlow, sv.x + sv.w / 2 - r, sv.y - lift + sv.h * 0.5 - r, r * 2, r * 2);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
    if (simT - bookSlide.at < 0.9) {
      const st = strips[bookSlide.side];
      if (st) {
        const k = Math.sin(clamp((simT - bookSlide.at) / 0.9, 0, 1) * Math.PI);
        const off = f.staticY[bookSlide.side === 0 ? SHELF_L : SHELF_R] ?? 0;
        const y = (((bookSlide.y + st.strip.phase - off) % SHELF_PERIOD) + SHELF_PERIOD) % SHELF_PERIOD;
        g.fillStyle = "rgba(4,3,6,0.9)";
        g.fillRect(st.left + bookSlide.x, y + bookSlide.h - 8 * k, bookSlide.w, 8 * k);
        g.fillStyle = css(bookSlide.color, 0.75);
        g.fillRect(st.left + bookSlide.x, y - 8 * k, bookSlide.w, bookSlide.h);
      }
    }
  };

  /** A tap on a bookcase: the book under it slides out 8 px and back with a dust puff; a docked volume nearby takes off. */
  const tapShelf = (x: number, y: number, f: HubFrame): boolean => {
    const core = shelfMods?.[0];
    if (!core) return false;
    for (let i = 0; i < 2; i++) {
      const st = strips[i];
      if (!st || x < st.left || x > st.left + st.strip.width) continue;
      const off = f.staticY[i === 0 ? SHELF_L : SHELF_R] ?? 0;
      const ly = ((((y + off - st.strip.phase) % SHELF_PERIOD) + SHELF_PERIOD) % SHELF_PERIOD);
      const lx = x - st.left;
      for (const { book, compartment, bay, cell } of core.stripBooks(st.strip)) {
        if (book.lean !== 0 || lx < book.x || lx > book.x + book.w || ly > compartment.floor || ly < compartment.floor - book.h) continue;
        const light = core.lightAt(st.strip, cell, lx, ly, bay.index);
        const c = core.tone(core.litColor(book.color, light), book.family, light, 1);
        Object.assign(bookSlide, { side: i, x: book.x, y: compartment.floor - book.h, w: book.w, h: book.h, color: c, at: simT });
        for (let k = 0; k < 10; k++) spawnMote(x + range(-8, 8), y + range(-8, 8), 0, range(1, 2.2), range(1, 2.4), range(-30, 30), range(-24, 4));
        for (const v of volumes) {
          if (v.state === 2 && Math.hypot(v.x - x, v.y - y) < 160) {
            v.state = 3;
            v.since = simT;
            v.from = { x: v.x, y: v.y };
          }
        }
        return true;
      }
      return true;
    }
    return false;
  };

  /* ---------------- stage, lectern, floor ---------------- */

  const stageHitRect = (f: HubFrame): Rect => {
    const box = snap.windows.stage;
    const left = winBox("stage", f).left;
    const h = snap.windows.stageHit;
    return { x: h.x - left, y: h.y - box.y, w: h.w, h: h.h };
  };

  const midHitRect = (f: HubFrame): Rect => {
    const box = snap.windows.mid;
    const left = winBox("mid", f).left;
    const h = snap.windows.midHit;
    return { x: h.x - left, y: h.y - box.y, w: h.w, h: h.h };
  };

  const ensureStage = (f: HubFrame) => {
    const { w, h } = winBox("stage", f);
    stageHit = stageHitRect(f);
    const key = `${w}x${h}:${JSON.stringify(stageHit)}:${snap.cards.map((c) => `${c.slug}${c.read}${c.finished}`).join()}:${resume}`;
    if (key === stageKey) return;
    stageKey = key;
    stageLayout = stageShelf(snap.cards, stageHit, resume);
    const dpr = staticDpr(snap.viewport);
    if (stageSurf) surfaces.release(stageSurf);
    stageSurf = create(w * dpr, h * dpr);
    stageSurf.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintStageBase(stageSurf.g, stageLayout, h, stageHit, ray);
  };

  const ensureLectern = (f: HubFrame) => {
    const { w, h } = winBox("mid", f);
    midHit = midHitRect(f);
    const book = lecternBook(midHit);
    lecternBookAt = book;
    const key = `${w}x${h}:${JSON.stringify(midHit)}`;
    if (lectern?.key === key) return;
    const dpr = staticDpr(snap.viewport);
    if (lectern) {
      surfaces.release(lectern.surf);
      surfaces.release(lectern.glow);
    }
    const surf = create(w * dpr, h * dpr);
    const glow = create(w * dpr, h * dpr);
    lectern = { surf, glow, book, key, dpr };
    ctx.paint.run(`lectern:${key}`, [
      () => {
        surf.g.setTransform(dpr, 0, 0, dpr, 0, 0);
        paintLectern(surf.g, book, w, h, midHit);
      },
      () => {
        glow.g.setTransform(dpr, 0, 0, dpr, 0, 0);
        paintGrimoire(glow.g, book, true);
      },
    ]);
  };

  const ensureFloor = (f: HubFrame) => {
    const { w, h } = winBox("ground", f);
    const key = `${w}x${h}`;
    if (floor?.key === key) return;
    const dpr = Math.min(1.25, staticDpr(snap.viewport));
    if (floor) surfaces.release(floor.surf);
    const surf = create(w * dpr, h * dpr);
    floor = { surf, key, dpr };
    groundDirty = true;
    const frng = createRng(ctx.seed ^ 0xf100);
    ctx.paint.run(`floor:${key}`, [
      () => {
        surf.g.setTransform(dpr, 0, 0, dpr, 0, 0);
        paintFloor(surf.g, w, h, frng);
      },
    ], () => {
      groundDirty = true;
    });
  };

  const blit = (g: Ctx, s: Surface | null, w: number, h: number) => {
    if (s && s.canvas.width > 0) g.drawImage(s.canvas, 0, 0, w, h);
  };

  const drawStage = (g: Ctx, f: HubFrame, still: boolean) => {
    ensureStage(f);
    const { w, h } = winBox("stage", f);
    blit(g, stageSurf, w, h);
    const shelf = stageLayout;
    if (!shelf) return;
    shelf.tomes.forEach((t, i) => {
      const pulled = t.resume || t.slug === stage.pull || t.slug === attended;
      const pullK = still ? (pulled ? 1 : 0) : t.slug === stage.pull ? smoothstep(0, 0.4, simT - stage.pullAt) * (1 - smoothstep(3, 3.6, simT - stage.pullAt)) : pulled ? 1 : 0;
      const tiltAge = simT - stage.tiltAt - i * 0.07;
      const tilt = still || tiltAge < 0 || tiltAge > 1.4 ? 0 : stage.tiltDir * 0.14 * Math.sin(tiltAge * Math.PI * 1.4) * (1 - tiltAge / 1.4);
      paintTome(g, t, shelf.plank.y, (t.resume ? 3 : 0) + pullK * 5, tilt, t.slug === attended ? 1 : 0);
    });
    if (shelf.candle) {
      const c = shelf.candle;
      g.fillStyle = css([236, 222, 196]);
      g.fillRect(c.x - 2.5, c.y - 16, 5, 16);
      g.fillStyle = css(BRASS);
      g.fillRect(c.x - 6, c.y - 2, 12, 2);
      const k = still ? 1 : flicker(simT, 4.2);
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.5 * k;
      g.drawImage(warmGlow, c.x - 40, c.y - 60, 80, 80);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      shelfMods?.[1].paintFlame(g, c.x, c.y - 16, k);
      if (!shelfMods) {
        g.fillStyle = css(CANDLE, 1, 0.95);
        g.beginPath();
        g.ellipse(c.x, c.y - 21, 2.2, 5 * (0.92 + 0.08 * k), 0, 0, TAU);
        g.fill();
      }
    }
  };

  const flipX0 = new Float32Array(FLIP_SEGMENTS + 1);
  const flipY0 = new Float32Array(FLIP_SEGMENTS + 1);
  const flipX1 = new Float32Array(FLIP_SEGMENTS + 1);
  const flipY1 = new Float32Array(FLIP_SEGMENTS + 1);
  const flipU = new Float32Array(FLIP_SEGMENTS + 1);
  const flipZ = new Float32Array(FLIP_SEGMENTS + 1);

  const drawFlip = (g: Ctx, book: BookPlacement) => {
    if (!flip.active) return;
    const tmp = { x: 0, y: 0 };
    for (let i = 0; i <= FLIP_SEGMENTS; i++) {
      pageFlipPoint(i / FLIP_SEGMENTS, flip.p, tmp);
      flipU[i] = tmp.x * flip.side;
      flipZ[i] = tmp.y;
      projectBook(book, flipU[i], 0.015, flipZ[i], tmp);
      flipX0[i] = tmp.x;
      flipY0[i] = tmp.y;
      projectBook(book, flipU[i], 0.985, flipZ[i], tmp);
      flipX1[i] = tmp.x;
      flipY1[i] = tmp.y;
    }
    for (let i = 0; i < FLIP_SEGMENTS; i++) {
      const du = Math.abs(flipU[i + 1] - flipU[i]);
      const dz = Math.abs(flipZ[i + 1] - flipZ[i]) * 0.5;
      const color = paper(clamp(0.52 + (du / (Math.hypot(du, dz) || 1)) * 0.44, 0, 1));
      g.fillStyle = color;
      g.strokeStyle = color;
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(flipX0[i], flipY0[i]);
      g.lineTo(flipX0[i + 1], flipY0[i + 1]);
      g.lineTo(flipX1[i + 1], flipY1[i + 1]);
      g.lineTo(flipX1[i], flipY1[i]);
      g.closePath();
      g.fill();
      g.stroke();
    }
  };

  /** Glyphs blooming on the grimoire's blank right page: stories on their way. */
  const drawGlyphs = (g: Ctx, book: BookPlacement, still: boolean) => {
    const tmp = { x: 0, y: 0 };
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = "rgba(255,214,140,0.9)";
    g.lineWidth = Math.max(0.7, book.w * 0.005);
    for (let i = 0; i < 14; i++) {
      const u = 0.2 + (i % 5) * 0.14;
      const v = 0.2 + Math.floor(i / 5) * 0.22;
      const k = still ? 0.6 : 0.5 + 0.5 * Math.sin(simT * 0.35 + i * 1.9);
      if (k < 0.15) continue;
      g.globalAlpha = k * 0.55;
      projectBook(book, u, v, pageProfile(u), tmp);
      const s = book.w * 0.022;
      g.beginPath();
      g.moveTo(tmp.x - s, tmp.y);
      g.lineTo(tmp.x + s * 0.4, tmp.y - s * 0.8);
      g.lineTo(tmp.x + s, tmp.y + s * 0.2);
      if (i % 3 === 0) {
        g.moveTo(tmp.x, tmp.y - s);
        g.lineTo(tmp.x, tmp.y + s * 0.6);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  };

  const drawMid = (g: Ctx, f: HubFrame, still: boolean) => {
    ensureLectern(f);
    const { w, h } = winBox("mid", f);
    if (!lectern || !lecternBookAt) return;
    blit(g, lectern.surf, w, h);
    const book = lecternBookAt;
    const b = still ? 0.6 : breath;
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.25 + 0.45 * b + (simT - lastBurstAt < 1 ? (1 - (simT - lastBurstAt)) * 0.6 : 0);
    blit(g, lectern.glow, w, h);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    drawGlyphs(g, book, still);
    drawFlip(g, book);
    // Candelabra with three candles, and the armillary sphere turning slowly.
    const U = book.w;
    const cx = Math.max(U * 0.3, book.x - U * 0.95);
    const base = h - 6;
    g.strokeStyle = css(BRASS, 0.9);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx, base);
    g.lineTo(cx, base - U * 0.5);
    g.moveTo(cx - U * 0.16, base - U * 0.42);
    g.quadraticCurveTo(cx, base - U * 0.3, cx + U * 0.16, base - U * 0.42);
    g.stroke();
    for (const dx of [-U * 0.16, 0, U * 0.16]) {
      const top = base - U * (dx === 0 ? 0.6 : 0.5);
      g.fillStyle = css([236, 222, 196]);
      g.fillRect(cx + dx - 2.4, top, 4.8, U * 0.08);
      const k = still ? 1 : flicker(simT, dx * 0.1 + 2);
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.35 * k;
      g.drawImage(warmGlow, cx + dx - 44, top - 50, 88, 88);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      if (shelfMods) shelfMods[1].paintFlame(g, cx + dx, top, k);
      else {
        g.fillStyle = css(CANDLE, 1, 0.95);
        g.beginPath();
        g.ellipse(cx + dx, top - 5, 2.2, 5 * (0.92 + 0.08 * k), 0, 0, TAU);
        g.fill();
      }
    }
    const ax = Math.min(w - U * 0.3, book.x + U * 0.95);
    const ar = U * 0.17;
    const ay = base - U * 0.32 - ar;
    g.strokeStyle = css(BRASS, 0.8);
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(ax, base);
    g.lineTo(ax, ay + ar);
    g.stroke();
    const turn = still ? 0.6 : simT * 0.25;
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = css(k === 0 ? GILT_HI : BRASS, 1, 0.85);
      g.lineWidth = k === 0 ? 1.4 : 1;
      g.beginPath();
      g.ellipse(ax, ay, ar, ar * Math.abs(Math.cos(turn + k * 1.05)) + 0.5, k * 0.5 - 0.4, 0, TAU);
      g.stroke();
    }
    g.fillStyle = css(GILT_HI, 1, 0.9);
    g.beginPath();
    g.arc(ax, ay, 2.2, 0, TAU);
    g.fill();
  };

  const drawGround = (g: Ctx, f: HubFrame, still: boolean) => {
    ensureFloor(f);
    const { w, h } = winBox("ground", f);
    blit(g, floor?.surf ?? null, w, h);
    groundDirty = false;
    if (wave && !still) {
      const k = (simT - wave.at) / 1.4;
      if (k >= 1) wave = null;
      else {
        g.save();
        g.globalCompositeOperation = "lighter";
        g.translate(wave.x, wave.y);
        g.scale(1, 0.24);
        const r = 30 + k * Math.min(w * 0.45, 560);
        g.strokeStyle = css(GILT_HI, 1, 0.45 * (1 - k));
        g.lineWidth = 10;
        g.beginPath();
        g.arc(0, 0, r, 0, TAU);
        g.stroke();
        g.restore();
      }
    }
  };

  /* ---------------- mechanics ---------------- */

  const peelPages = (slug: string, f: HubFrame) => {
    const card = cardBySlug(slug);
    if (!card || card.kind === "locked") return;
    const sv = spineView(slug, f);
    const count = 2 + (rng() < 0.5 ? 1 : 0);
    for (let k = 0; k < count; k++) {
      if (sv) {
        const from = { x: sv.x + sv.w / 2, y: sv.y + scrollY };
        const p = spawnPage(risePath(snap, from, rng), 0.02 * k, true, slug);
        if (p) p.size *= 0.85;
      } else {
        const path = paths[rng() < 0.5 ? 0 : paths.length - 1];
        spawnPage(path, Math.max(0, path.burnAt - 0.25 - k * 0.04), true, slug);
      }
    }
  };

  const columnOf = (slug: string): number => {
    const c = cardBySlug(slug);
    if (!c) return 0;
    const col = cardColumn(snap, c);
    return col === "l" ? -1 : col === "r" ? 1 : 0;
  };

  const attend = (slug: string | null, f: HubFrame, still: boolean) => {
    const prev = attended;
    attended = slug;
    if (prev && prev !== slug) {
      out.card(prev, { "w-glow": 0 });
      spineLift.set(prev, simT);
    }
    assignPanels();
    swing.leftTarget = 0;
    swing.rightTarget = 0;
    if (!slug) return;
    const card = cardBySlug(slug);
    traces.set(slug, { at: simT, duration: TRACE_SUMMON_S });
    spineLift.set(slug, simT);
    // The nearest lancet's shafts lean up to 8 degrees further toward the card's column.
    const col = columnOf(slug);
    if (col < 0) swing.leftTarget = 8;
    else if (col > 0) swing.rightTarget = 8;
    if (card) {
      const lx = clamp((keyLight.x - card.rect.x) / Math.max(1, card.rect.w), -0.5, 1.5);
      const ly = clamp((keyLight.y + scrollY - card.rect.y) / Math.max(1, card.rect.h), -0.5, 1.5);
      out.card(slug, { "w-glow": 1, "w-lx": lx, "w-ly": ly });
    }
    out.beat(slug, "pull");
    if (!still && prev !== slug) peelPages(slug, f);
  };

  const releaseFromTome = (slug: string, f: HubFrame, count: number, homing = false) => {
    const shelf = stageLayout;
    const r = f.win.stage;
    const t = shelf?.tomes.find((k) => k.slug === slug);
    if (!shelf || !t) return;
    const left = r?.x ?? 0;
    const docTop = snap.windows.stage.y;
    const card = cardBySlug(slug);
    for (let k = 0; k < count; k++) {
      const from = { x: left + t.x + t.w / 2, y: docTop + shelf.plank.y - t.h - 4 };
      const path = homing && card ? homePath(from, { x: card.rect.x + card.rect.w / 2, y: card.rect.y + 8 }) : risePath(snap, from, rng);
      const p = spawnPage(path, k * 0.025, true, slug);
      if (p) {
        p.homing = homing;
        p.vx = range(-40, 40);
        p.vy = range(-60, -20);
      }
    }
  };

  /** The pick ritual's page: a curve from the tome that circles once and settles on its card (no burn). */
  const homePath = (from: Vec, to: Vec): DraftPath => {
    const mid = { x: (from.x + to.x) / 2 + 80, y: Math.min(from.y, to.y) - 90 };
    return { lut: buildWindLut([from, { x: from.x - 40, y: from.y - 60 }, mid, { x: to.x + 30, y: to.y - 50 }, to]), burnAt: 1, doc: true };
  };

  const burst = (f: HubFrame) => {
    lastBurstAt = simT;
    const book = lecternBookAt;
    const r = f.win.mid;
    if (!book) return;
    const left = r?.x ?? 0;
    const docTop = snap.windows.mid.y;
    const n = burstCount(rng);
    for (let k = 0; k < n; k++) {
      const from = { x: left + book.x + range(-book.w * 0.3, book.w * 0.3), y: docTop + book.y - book.depth * 0.6 };
      const p = spawnPage(risePath(snap, from, rng), range(0, 0.03), true, pickTarget(null));
      if (p) {
        p.vx = range(-90, 140);
        p.vy = range(-160, -50);
        p.size *= 1.1;
      }
    }
    for (let k = 0; k < 40; k++) {
      const x = left + book.x + range(-30, 30);
      const y = docTop + book.y - book.depth * 0.5 - scrollY;
      spawnMote(x, y, rng() < 0.6 ? 0 : 2, range(1.2, 3), range(1.5, 4), range(-120, 140), range(-150, -20));
    }
    startFlip(false, 0.7);
    if (f.win.ground) {
      const gw = winBox("ground", f);
      wave = { at: simT, x: gw.w / 2, y: gw.h * 0.42 };
    }
  };

  const startFlip = (tear: boolean, duration: number) => {
    if (flip.active) return;
    Object.assign(flip, { active: true, p: 0, duration, side: rng() < 0.7 ? 1 : -1, tear, torn: false });
  };

  const stageTap = (f: HubFrame) => {
    const slug = resume ?? snap.cards.find((c) => c.kind === "open" && !c.finished && !(c.read ?? 0))?.slug ?? null;
    if (!slug) return;
    stage.pull = slug;
    stage.pullAt = simT;
    releaseFromTome(slug, f, 3);
  };

  /** Vault tap: the nearest figure within 220 px traces at once, labels its card and takes the reader there. */
  const tapVault = (x: number, y: number, f: HubFrame): boolean => {
    const vaultY = f.staticY[VAULT] ?? 0;
    const tmp = { x: 0, y: 0 };
    let best: string | null = null;
    let bestD = 220;
    for (const [slug, slot] of panelOf) {
      const p = hall.panels[slot];
      tmp.x = p.x + p.w / 2;
      tmp.y = p.y + p.h / 2 - vaultY;
      const d = Math.hypot(tmp.x - x, tmp.y - y);
      if (d < bestD) {
        bestD = d;
        best = slug;
      }
    }
    rings.push({ x, y, age: 0, r: 60, plane: "sky" });
    if (!best) {
      for (let k = 0; k < 8; k++) spawnMote(x + range(-10, 10), y + range(-10, 10), 1, range(1, 2), range(1, 2.5), range(-40, 40), range(-40, 20));
      return true;
    }
    traces.set(best, { at: simT, duration: TRACE_TAP_S });
    const p = hall.panels[panelOf.get(best) ?? 0];
    out.label(best, { x: p.x + p.w / 2, y: p.y + p.h + 6 - vaultY, plane: "sky" });
    out.focusCard(best);
    return true;
  };

  /* ---------------- the key light (M7) ---------------- */

  const keyLight = { x: 0, y: 0, k: 0.4 };

  const updateKeyLight = (f: HubFrame, still: boolean) => {
    const title = snap.parts.title;
    const tx = title.x + title.w * 0.3;
    const ty = title.y + title.h / 2 - scrollY;
    let best: { x: number; y: number; k: number } | null = null;
    let bestD = Infinity;
    const consider = (x: number, y: number, k: number) => {
      const d = Math.hypot(x - tx, y - ty);
      if (d < bestD) {
        bestD = d;
        best = { x, y, k };
      }
    };
    for (const fl of flames) consider(fl.x, fl.y, still ? 1 : flicker(simT, fl.phase));
    if (f.win.stage && stageLayout?.candle) consider(f.win.stage.x + stageLayout.candle.x, f.win.stage.y + stageLayout.candle.y - 18, still ? 1 : flicker(simT, 4.2));
    if (f.win.mid && lecternBookAt) consider(f.win.mid.x + Math.max(lecternBookAt.w * 0.3, lecternBookAt.x - lecternBookAt.w * 0.95), f.win.mid.y + f.win.mid.h * 0.4, still ? 1 : flicker(simT, 2));
    const chosen = best as { x: number; y: number; k: number } | null;
    if (chosen) Object.assign(keyLight, chosen);
    else Object.assign(keyLight, { x: hall.rose.x, y: hall.rose.y - (f.staticY[HALL] ?? 0), k: 0.45 });
  };

  const rootVars = () => ({
    "w-light-x": clamp(keyLight.x / Math.max(1, W), 0, 1),
    "w-light-y": clamp(keyLight.y / Math.max(1, H), 0, 1),
    "w-light": clamp(0.55 * keyLight.k, 0, 1),
    "w-breath": breath,
  });

  /* ---------------- frames ---------------- */

  const step = (f: HubFrame) => {
    const dt = f.dt;
    simT += dt;
    tier = f.tier;
    breath = 0.5 + 0.5 * Math.sin(simT * 1.1);
    const ease = Math.min(1, dt * 1.6);
    swing.left += (swing.leftTarget - swing.left) * ease;
    swing.right += (swing.rightTarget - swing.right) * ease;
    swing.scroll += (clamp(f.scrollVel * 0.004, -3, 3) - swing.scroll) * ease;
    pointerGlow += ((pointer.active && pointer.fine && tier === 0 ? 1 : 0) - pointerGlow) * Math.min(1, dt * 3);
    // Ambient pages ride the draft.
    if (simT >= nextPageAt && paths.length) {
      const path = paths[Math.floor(rng() * paths.length)];
      spawnPage(path, rng() < 0.3 ? range(0, 0.05) : range(0.1, Math.max(0.12, path.burnAt - 0.15)), false, null);
      nextPageAt = simT + range(3, 6);
    }
    // The grimoire turns a page every 6-11 s, and every 220 px of scroll while the mid window shows.
    if (f.win.mid) {
      scrollTurn += Math.abs(scrollY - lastScroll);
      if (scrollTurn >= SCROLL_TURN_PX) {
        scrollTurn = 0;
        startFlip(false, 1.4);
      }
    }
    lastScroll = scrollY;
    if (!flip.active && simT >= nextFlipAt) {
      startFlip(true, range(1.5, 2.3));
      nextFlipAt = simT + range(6, 11);
    }
    if (flip.active) {
      flip.p += dt / flip.duration;
      if (flip.p >= 1) flip.active = false;
    }
    if (introAt !== null && simT - introAt > 2.2) introAt = null;
    stepPages(dt);
    stepMotes(dt);
    stepVolumes(f);
    stepComets(dt);
    // Embers rise from the sconces now and then.
    if (flames.length && rng() < dt * 3) {
      const fl = flames[Math.floor(rng() * flames.length)];
      spawnMote(fl.x, fl.y - 6, 2, range(0.8, 1.6), range(1, 2.4), range(-10, 10), range(-50, -24));
    }
  };

  const drawSky = (g: Ctx, f: HubFrame, still: boolean) => {
    const vaultY = f.staticY[VAULT] ?? 0;
    layShafts(vaultY);
    visibleSconces(f);
    drawShafts(g, still);
    drawBandLight(g, still);
    drawFlames(g, still);
    drawSpineLift(g, f, still);
    drawFigures(g, f, still);
    drawMotes(g, still);
    const open = (v: Volume, i: number) => (v.state === 2 ? 0 : still || tier >= 1 ? 0.7 : 0.5 + 0.5 * Math.sin(simT * TAU * v.orbit.flap + i));
    volumes.forEach((v, i) => {
      if (v.y < -30 || v.y > H + 30) return;
      // Dimmed near text and chrome holes (kicker, chip), as pages and motes are.
      g.globalAlpha = dimAt(v.x, v.y);
      drawVolume(g, v, open(v, i));
      g.globalAlpha = 1;
    });
    drawComets(g, f);
    if (pointerGlow > 0.02 && !still) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.2 * pointerGlow;
      g.drawImage(warmGlow, pointer.x - 60, pointer.y - 60, 120, 120);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
  };

  /** Pages draw on the window canvas they are inside (in front of its objects), else on the sky. */
  const drawPages = (gx: HubContexts, f: HubFrame) => {
    for (const p of pages) {
      if (!p.active) continue;
      let drawn = false;
      for (const name of ["stage", "mid"] as const) {
        const r = f.win[name];
        const g = gx[name];
        if (!r || !g || !pointInRect(r, p.x, p.y)) continue;
        drawPage(g, p, r.x, r.y, simT);
        drawn = true;
        break;
      }
      if (!drawn && p.y > -60 && p.y < H + 60) drawPage(gx.live, p, 0, 0, simT);
    }
  };

  const drawWindows = (gx: HubContexts, f: HubFrame, still: boolean) => {
    if (gx.stage) drawStage(gx.stage, f, still);
    if (gx.mid) drawMid(gx.mid, f, still);
    if (gx.ground) drawGround(gx.ground, f, still);
  };

  const cardVars = (): Record<string, CardVars> => {
    const vars: Record<string, CardVars> = {};
    if (attended) vars[attended] = { "w-glow": 1 };
    return vars;
  };

  /** The reduced-motion still: shafts at rest, three pages mid-air (one half-burned with its tail), two volumes open, candles at mean. */
  const composeStill = () => {
    const path = paths[0];
    if (!path) return;
    const pose = createRng(ctx.seed ^ 0x57111);
    for (const p of pages) p.active = false;
    const tail: Vec[] = [];
    [path.burnAt - 0.2, path.burnAt - 0.08, Math.min(0.97, path.burnAt + 0.05)].forEach((s, i) => {
      const p = spawnPage(path, s, true, null);
      if (!p) return;
      p.age = i === 2 ? p.life * 0.5 : p.life * 0.2;
      p.zoneAge = i === 2 ? p.age - 1.1 : null;
      p.yaw = pose() - 0.5;
      p.pitch = pose() - 0.5;
      p.roll = (pose() - 0.5) * 2;
      const pt = lutAt(path.lut, s, { x: 0, y: 0 });
      p.x = pt.x;
      p.y = docToView(path, pt.y);
      if (i === 2) for (let k = 1; k < 7; k++) tail.push(lutAt(path.lut, s - k * 0.012, { x: 0, y: 0 }));
    });
    mote.count = 0;
    for (const t of tail) spawnMote(t.x, docToView(path, t.y), 2, 1.6, 10, 0, 0);
    const spot = { x: 0, y: 0 };
    const n = Math.round(moteCount(snap.mode, W, H) * 0.4);
    for (let k = 0; k < n; k++) if (openSpot(spot)) spawnMote(spot.x, spot.y, pose() < 0.6 ? 0 : 1, 1 + pose() * 1.4, 10, 0, 0);
    const tmp = { x: 0, y: 0 };
    volumes.forEach((v, i) => {
      v.heading = orbitAt(v.orbit, i * 7, tmp);
      v.x = tmp.x;
      v.y = tmp.y;
      v.state = 0;
    });
  };

  /* ---------------- hooks ---------------- */

  return {
    resize(f) {
      lastFrame = f;
      scrollY = f.scrollY;
      recompose(f);
    },
    layout(f) {
      lastFrame = f;
      scrollY = f.scrollY;
      recompose(f);
    },
    render(f, gx) {
      lastFrame = f;
      scrollY = f.scrollY;
      step(f);
      drawSky(gx.live, f, false);
      drawWindows(gx, f, false);
      drawPages(gx, f);
      updateKeyLight(f, false);
      out.root(rootVars());
    },
    still(f, gx) {
      lastFrame = f;
      scrollY = f.scrollY;
      composeStill();
      drawSky(gx.live, f, true);
      drawWindows(gx, f, true);
      drawPages(gx, f);
      for (const p of pages) p.active = false;
      updateKeyLight(f, true);
      out.still(rootVars(), cardVars());
    },
    onPointer(p: HubPointer) {
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.active = p.active;
      pointer.fine = p.type === "mouse";
      if (!p.tap) return;
      const f = lastFrame;
      if (!f) return;
      if (p.zone === "stage") stageTap(f);
      else if (p.zone === "mid") {
        if (canBurst(simT, lastBurstAt)) burst(f);
      } else if (p.zone === "ground") {
        const r = f.win.ground;
        if (r) wave = { at: simT, x: p.x - r.x, y: p.y - r.y };
      } else if (p.zone === "open") {
        const vaultBottom = hall.band - (f.staticY[VAULT] ?? 0);
        if (!(p.y > vaultBottom && tapShelf(p.x, p.y, f))) tapVault(p.x, p.y, f);
      }
    },
    onEvent(e: SceneEvent) {
      const f = lastFrame;
      if (!f) return;
      const still = f.still;
      if (e.name === "hub:attention") attend(e.detail.slug, f, still);
      else if (e.name === "hub:reading") {
        snap = page.getSnapshot();
        refreshCards();
        stageKey = "";
      } else if (e.name === "hub:press") pressFlare = { slug: e.detail.slug, at: simT };
      else if (e.name === "hub:stage") {
        if (e.detail.window === "mid") {
          if (e.detail.action === "tap" && canBurst(simT, lastBurstAt)) burst(f);
          else if (e.detail.action !== "tap") startFlip(false, 1.2);
        } else if (e.detail.action === "tap") stageTap(f);
        else {
          stage.tiltDir = e.detail.action === "left" ? -1 : 1;
          stage.tiltAt = simT;
        }
      } else if (e.name === "hub:pick") {
        const slug = e.detail.slug;
        if (slug && f.win.stage) {
          stage.pull = slug;
          stage.pullAt = simT;
          releaseFromTome(slug, f, 1, true);
        }
      }
    },
    intro() {
      introAt = simT;
      nextFlipAt = simT + 1.5;
      for (const c of snap.cards) if (c.finished) traces.set(c.slug, { at: simT + 0.9, duration: INTRO_SWEEP_S * 0.6 });
    },
    windowHz(name, t) {
      if (name === "ground") return wave || groundDirty ? (t === 2 ? 30 : Infinity) : 0;
      return t === 2 ? 30 : Infinity;
    },
    dispose() {
      ctx.paint.cancel();
      pages.length = 0;
      volumes = [];
      mote.count = 0;
      strips[0] = strips[1] = null;
      stageSurf = null;
      lectern = null;
      floor = null;
      shelfMods = null;
    },
  };
}
