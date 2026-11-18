// Pure maths of the skyglass theme (spec 3.2, re-keyed dark): the sky lock and its spring,
// the blue-hour-to-night sky palettes, ring shadow, afterglow placement, the far-city window
// scheduler, the vane mobile, the transit capsule and the louvres. DOM-free, so it imports in Node.

import { clamp, lerp, rectDistance, smoothstep } from "./world/geom";
import type { CardInfo, HubMode, PageSnapshot, Rect } from "./world/types";

export const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ colour */

export type RGB = readonly [number, number, number];

export function hex(text: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(text.trim());
  if (!m) return [238, 241, 244];
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toLin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const toGam = (v: number) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

/** Mix in linear light, t = 0 gives a. */
export function mix(a: RGB, b: RGB, t: number): RGB {
  return [0, 1, 2].map((i) => toGam(lerp(toLin(a[i]), toLin(b[i]), t))) as unknown as RGB;
}

export function rgba(c: RGB, a = 1): string {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.round(clamp(a, 0, 1) * 1000) / 1000})`;
}

/** Night palette (every colour at OKLCH chroma 0.079 or less, tested). */
export const PAL = {
  sun: hex("#fbf3e6"),
  ringLit: hex("#f1ece3"),
  ringShadow: hex("#3c4559"),
  finGlass: hex("#2a3548"),
  finEdge: hex("#8399ad"),
  finDusk: hex("#1c2431"),
  window: hex("#efc795"),
  plaza: hex("#121821"),
  pearl: hex("#eef1f4"),
  horizon: hex("#d29c7f"),
  rose: hex("#b48892"),
  shadow: hex("#3a4560"),
} as const;

/* ------------------------------------------------------------------ sky */

/** Stop positions as fractions of the distance from the zenith to the horizon line. */
export const SKY_POS = [0, 0.24, 0.46, 0.66, 0.8, 0.92, 1, 1.25] as const;
/**
 * Blue hour (a faint afterglow band only at the horizon), late blue hour and night. Deep
 * blue-indigo, never black; every stop stays at OKLCH L 0.46 or below so the page never glares.
 */
export const SKY_KEYS: readonly (readonly string[])[] = [
  ["#18213a", "#1d2843", "#24314f", "#2d3b5c", "#3a4462", "#4d4b66", "#5b5266", "#262c40"],
  ["#131a2f", "#172038", "#1d2843", "#24304d", "#2e3753", "#3a3c58", "#45405a", "#1e2335"],
  ["#0e1426", "#11182c", "#151d33", "#1a233b", "#202942", "#272d47", "#2e3049", "#161b2b"],
];
const SKY_RGB = SKY_KEYS.map((row) => row.map(hex));

export interface SkyStops {
  pos: number[];
  rgb: RGB[];
}

/** Sky stops at sky phase p (0 blue hour, 0.5 late blue hour, 1 night). */
export function skyStops(p: number): SkyStops {
  const t = clamp(p, 0, 1) * 2;
  const k = t < 1 ? 0 : 1;
  const f = t - k;
  return { pos: [...SKY_POS], rgb: SKY_RGB[k].map((c, i) => mix(c, SKY_RGB[k + 1][i], f)) };
}

export function sampleStops(s: SkyStops, t: number): RGB {
  const { pos, rgb } = s;
  if (t <= pos[0]) return rgb[0];
  for (let i = 1; i < pos.length; i++) {
    if (t <= pos[i]) return mix(rgb[i - 1], rgb[i], (t - pos[i - 1]) / Math.max(1e-6, pos[i] - pos[i - 1]));
  }
  return rgb[rgb.length - 1];
}

/* ------------------------------------------------------------------ daylight lock (3.2) */

export interface Range {
  /** Document y of the hero's bottom edge (the top band's lower edge). */
  heroBottom: number;
  maxScroll: number;
  viewportH: number;
}

export function pageRange(s: PageSnapshot): Range {
  const ground = s.windows.ground;
  const end = ground.h > 0 ? ground.y + ground.h : s.shell.y + s.shell.h;
  return { heroBottom: s.topBand.y + s.topBand.h, maxScroll: Math.max(0, end - s.viewport.h), viewportH: s.viewport.h };
}

/** p = clamp((scrollY - heroBottom) / max(1, maxScroll - heroBottom), 0, 1); 0 when the page is too short. */
export function daylightTarget(scrollY: number, r: Range): number {
  if (r.maxScroll <= r.heroBottom) return 0;
  return clamp((scrollY - r.heroBottom) / Math.max(1, r.maxScroll - r.heroBottom), 0, 1);
}

/** Upper bound for the smoothed p: 0 while any part of the hero is on screen, never below the target. */
export function daylightCap(scrollY: number, r: Range): number {
  return clamp((scrollY - r.heroBottom) / Math.max(1, Math.min(r.maxScroll - r.heroBottom, r.viewportH * 0.5)), 0, 1);
}

export const SPRING_TAU = 0.35;

export interface Spring {
  x: number;
  v: number;
}

/** Exact step of a critically damped spring toward target. */
export function springStep(s: Spring, target: number, dt: number, tau = SPRING_TAU): void {
  if (dt <= 0) return;
  const w = 1 / tau;
  const d = s.x - target;
  const c = s.v + w * d;
  const e = Math.exp(-w * dt);
  s.x = target + (d + c * dt) * e;
  s.v = (s.v - w * c * dt) * e;
}

/** One frame of the sky phase: spring toward the target, never above the hero cap. */
export function stepDaylight(s: Spring, scrollY: number, r: Range, dt: number): number {
  springStep(s, daylightTarget(scrollY, r), dt);
  const cap = daylightCap(scrollY, r);
  if (s.x > cap) {
    s.x = cap;
    s.v = Math.min(0, s.v);
  }
  s.x = clamp(s.x, 0, 1);
  return s.x;
}

/** Share of the ring in Earth's shadow; monotonic, with a sun-side sliver left at p = 1. */
export function ringShadow(p: number): number {
  return 0.92 * (1 - (1 - clamp(p, 0, 1)) ** 1.6);
}

/** --w-sun in whole degrees (41 distinct values over the scroll). */
export function sunAngle(p: number): number {
  return Math.round(54 + 40 * clamp(p, 0, 1));
}

/** How strongly lit windows read against the sky: already clear at blue hour, full by night. */
export const duskVis = (p: number) => 0.65 + 0.35 * smoothstep(0, 0.8, p);

/** p of the still composition (--w-sky 0.6): late blue hour. */
export const STILL_P = 0.4;

/* ------------------------------------------------------------------ geometry by mode */

/** Viewport y of the far-city skyline band at scroll 0, and its parallax rate (0.08, capped on long pages). */
export function cityPlane(r: Range): { top: number; rate: number; travel: number } {
  const rate = r.maxScroll > 0 ? Math.min(0.08, (r.viewportH * 0.24) / r.maxScroll) : 0.08;
  return { top: r.viewportH * 0.55, rate, travel: rate * r.maxScroll };
}

export interface Ring {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** A flat elliptical arch across the top band that clears the title where the page allows. */
export function ringGeometry(s: PageSnapshot, tilt: number): Ring {
  const { w: W, h: H } = s.viewport;
  const title = s.parts.title;
  const cx = W * (0.5 + tilt * 0.06);
  const rx = W * 0.78;
  const edgeU = Math.max(cx, W - cx) / rx;
  if (s.mode === "phone" || s.mode === "landscape-short") {
    const top = s.parts.chip ? s.parts.chip.y : s.shell.y + 16;
    const apex = clamp(top * 0.3, 5, 14);
    const ry = 14 / (1 - Math.sqrt(1 - Math.min(0.97, edgeU) ** 2));
    return { cx, cy: apex + ry, rx, ry };
  }
  const apex = clamp(H * 0.03, 10, 34);
  const limit = title.h > 0 ? title.y - 14 : H * 0.2;
  const far = Math.max(Math.abs(title.x - cx), Math.abs(title.x + title.w - cx));
  const u = Math.min(0.97, far / rx);
  const room = limit - apex;
  const ry = room > 12 ? clamp(room / (1 - Math.sqrt(1 - u * u)), H * 0.12, H * 1.4) : H * 0.25;
  return { cx, cy: apex + ry, rx, ry };
}

/** Point on the upper arc; a runs from 0 (west end) to 1 (east end). */
export function ringPoint(g: Ring, a: number): { x: number; y: number } {
  const th = Math.PI + a * Math.PI;
  return { x: g.cx + g.rx * Math.cos(th), y: g.cy + g.ry * Math.sin(th) };
}

export interface SunPlace {
  x: number;
  y: number;
  r: number;
  on: boolean;
}

/** Where the set sun's afterglow centres: a clearance search against every hole and cover rect at scroll 0; off-screen right when nothing fits. */
export function placeSun(s: PageSnapshot): SunPlace {
  const { w: W, h: H } = s.viewport;
  const r = clamp(Math.min(W, H) * 0.026, 10, 26);
  const need = r * 2.4 + 12;
  const yTop = r + 10;
  const yBottom = Math.min(H * 0.4, s.topBand.y + s.topBand.h) - r;
  // Rects more than 2 * need from the search band cannot change a candidate's distance term.
  const reach = need * 2;
  const rects: Rect[] = [...s.holes, ...s.cover].filter((q) => q.y - reach <= yBottom && q.y + q.h + reach >= yTop && q.x + q.w + reach >= W * 0.45);
  let best: { x: number; y: number } | null = null;
  let bestScore = -Infinity;
  for (let y = yTop; y <= yBottom; y += 6) {
    for (let x = W * 0.45; x <= W - r - 10; x += 6) {
      let d = Infinity;
      for (const rect of rects) {
        d = Math.min(d, rectDistance(x, y, rect));
        if (d < need) break;
      }
      if (d < need) continue;
      const score = x / W - Math.abs(y / H - 0.12) * 1.4 + Math.min(1, d / (need * 2)) * 0.1;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best ? { ...best, r, on: true } : { x: W + r * 0.6, y: Math.max(r + 8, H * 0.1), r, on: false };
}

export interface Blade {
  x: number;
  w: number;
  /** +1 when its sunlit edge is on the right. */
  side: 1 | -1;
}

export interface Tower {
  x: number;
  w: number;
  /** Plane y of the crown at scroll 0. */
  top: number;
}

export interface Facade {
  blades: Blade[];
  towers: Tower[];
  /** Sky-bridge truss between the two left towers (wide only). */
  bridge: { x0: number; x1: number; y: number } | null;
  /** Floor spacing of the near facade, in px. */
  floor: number;
}

/** Near glass fins in the gutters (at most 24) and, on wide screens, two towers per side. */
export function layoutFacade(s: PageSnapshot, rng: () => number, sun?: SunPlace): Facade {
  const { w: W, h: H } = s.viewport;
  const mode: HubMode = s.mode;
  const blades: Blade[] = [];
  const towers: Tower[] = [];
  let bridge: Facade["bridge"] = null;
  const left = s.gutters.left;
  const right = s.gutters.right;
  const rightStart = W - right;
  const edge = (gw: number) => Math.max(6, Math.min(gw - 3, 12));
  if (mode === "phone" || mode === "landscape-short" || left < 40) {
    blades.push({ x: 0, w: edge(left), side: 1 }, { x: W - edge(right), w: edge(right), side: -1 });
  } else if (mode === "narrow" || left < 120) {
    blades.push({ x: left * 0.18, w: Math.max(14, left * 0.42), side: 1 });
    blades.push({ x: rightStart + right * 0.4, w: Math.max(14, right * 0.42), side: -1 });
  } else {
    const fill = (x0: number, x1: number, side: 1 | -1) => {
      let x = x0 + 6 + rng() * 10;
      while (x < x1 - 16 && blades.length < 24) {
        const w = 14 + rng() * 30;
        if (x + w > x1 - 6) break;
        if (sun?.on && x < sun.x + sun.r * 2.4 && x + w > sun.x - sun.r * 2.4) {
          x = sun.x + sun.r * 2.4 + 4;
          continue;
        }
        blades.push({ x, w, side });
        x += w + 12 + rng() * 26;
      }
    };
    if (mode === "wide") {
      const tw = (gw: number) => clamp(gw * 0.2, 90, 170);
      const lt = tw(left);
      towers.push({ x: left * 0.08, w: lt, top: H * (0.16 + rng() * 0.06) });
      towers.push({ x: left * 0.5, w: lt * 0.82, top: H * (0.3 + rng() * 0.06) });
      towers.push({ x: rightStart + right * 0.16, w: tw(right) * 0.86, top: H * (0.26 + rng() * 0.06) });
      towers.push({ x: rightStart + right * 0.62, w: tw(right), top: H * (0.14 + rng() * 0.06) });
      const a = towers[0];
      const b = towers[1];
      bridge = { x0: a.x + a.w, x1: b.x, y: Math.max(a.top, b.top) + H * 0.34 };
      fill(left * 0.8, left - 8, 1);
      fill(rightStart + 8, rightStart + right * 0.14, -1);
    } else {
      fill(0, left - 4, 1);
      fill(rightStart + 4, W, -1);
    }
  }
  return { blades: blades.slice(0, 24), towers, bridge, floor: mode === "phone" ? 88 : 118 };
}

/* ------------------------------------------------------------------ far city */

export interface CityTower {
  x: number;
  w: number;
  top: number;
  layer: 0 | 1 | 2;
  /** 0 flat, 1 set-back, 2 slanted, 3 rounded crown. */
  crown: 0 | 1 | 2 | 3;
  mast: number;
}

export interface CityWindow {
  x: number;
  y: number;
  region: number;
  rank: number;
}

export const CITY_WINDOWS = 240;
export const CITY_REGIONS = 4;

/**
 * Towers of the far city strip (strip coordinates): three depth layers whose heights follow a
 * smooth cluster envelope, and up to 240 window cells near the tops of the two nearer layers.
 */
export function cityLayout(width: number, height: number, skyline: number, rng: () => number): { towers: CityTower[]; windows: CityWindow[] } {
  const towers: CityTower[] = [];
  const phase = rng() * TAU;
  const unit = clamp(height * 0.16, 50, 150);
  for (const layer of [0, 1, 2] as const) {
    let x = -rng() * 40;
    while (x < width) {
      const w = [16, 12, 16][layer] + rng() * [30, 34, 40][layer];
      const env = 0.5 + 0.5 * Math.sin((x / Math.max(1, width)) * TAU * 1.2 + phase + layer * 1.9);
      const spire = rng() < 0.07 ? 0.55 : 0;
      const h = unit * ([0.9, 0.75, 0.55][layer] * (0.35 + 0.65 * env) * (0.55 + 0.45 * rng()) + spire);
      const crown = (rng() < 0.5 ? 0 : 1 + Math.floor(rng() * 3)) as CityTower["crown"];
      towers.push({ x, w, top: skyline + layer * unit * 0.22 - h, layer, crown, mast: rng() < 0.16 ? 5 + rng() * 14 : 0 });
      x += w + [-6, 3, 8][layer] + rng() * [10, 18, 36][layer];
    }
  }
  const cells: { x: number; y: number }[] = [];
  for (const t of towers) {
    if (t.layer === 0) continue;
    for (let y = t.top + 10; y < Math.min(height - 6, t.top + unit * 1.1); y += 6) {
      for (let x = t.x + 3; x < t.x + t.w - 4; x += 5) cells.push({ x, y });
    }
  }
  const windows: CityWindow[] = [];
  const n = Math.min(CITY_WINDOWS, cells.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (cells.length - i));
    [cells[i], cells[j]] = [cells[j], cells[i]];
    const c = cells[i];
    windows.push({ x: c.x, y: c.y, region: clamp(Math.floor((c.x / Math.max(1, width)) * CITY_REGIONS), 0, CITY_REGIONS - 1), rank: i });
  }
  return { towers, windows };
}

/** Lit share of the far city at full dusk: 0.1 + 0.9 x (sum of read) / (open cards). */
export function cityShare(cards: readonly CardInfo[]): number {
  const open = cards.filter((c) => c.kind === "open");
  if (!open.length) return 0.1;
  const sum = open.reduce((acc, c) => acc + clamp(c.finished ? 1 : (c.read ?? 0), 0, 1), 0);
  return 0.1 + (0.9 * sum) / open.length;
}

/** Windows wanted on at a dusk level: the share of the grid, three quarters already lit before dusk. */
export function litTarget(total: number, share: number, dusk: number): number {
  return Math.round(total * clamp(share, 0, 1) * (0.75 + 0.25 * clamp(dusk, 0, 1)));
}

export const SWITCH_REGION_MS = 1500;
export const SWITCH_MAX_PER_S = 2;
export const SWITCH_FADE_MS = 600;

/**
 * Switches far windows on and off one at a time: at most one per 1.5 s in a region and two
 * per second in total, each fading over 600 ms (2.20 flash rules, M8).
 */
export class WindowScheduler {
  private on: Float64Array;
  private off: Float64Array;
  private regionAt: number[];
  private recent: number[] = [];
  lit = 0;

  constructor(private readonly regions: readonly number[]) {
    this.on = new Float64Array(regions.length).fill(Number.NaN);
    this.off = new Float64Array(regions.length).fill(Number.NaN);
    this.regionAt = new Array(CITY_REGIONS).fill(-Infinity);
  }

  /** Sets the first `count` windows (by rank) fully on at once: the composed state. */
  compose(count: number): void {
    const n = clamp(Math.round(count), 0, this.regions.length);
    this.on.fill(Number.NaN);
    this.off.fill(Number.NaN);
    for (let i = 0; i < n; i++) this.on[i] = -Infinity;
    this.lit = n;
  }

  /** Moves one step toward `target` lit windows if the rate limits allow; returns the index switched, or -1. */
  update(now: number, target: number): number {
    this.recent = this.recent.filter((t) => now - t < 1000);
    if (this.recent.length >= SWITCH_MAX_PER_S) return -1;
    const want = clamp(Math.round(target), 0, this.regions.length);
    if (want > this.lit) {
      const i = this.lit;
      const region = this.regions[i];
      if (now - this.regionAt[region] < SWITCH_REGION_MS) return -1;
      this.on[i] = now;
      this.off[i] = Number.NaN;
      this.regionAt[region] = now;
      this.recent.push(now);
      this.lit++;
      return i;
    }
    if (want < this.lit) {
      const i = this.lit - 1;
      this.off[i] = now;
      this.recent.push(now);
      this.lit--;
      return i;
    }
    return -1;
  }

  /** 0..1 brightness of window i at `now` (fade-in or fade-out over 600 ms). */
  alpha(i: number, now: number): number {
    const off = this.off[i];
    if (!Number.isNaN(off)) return clamp(1 - (now - off) / SWITCH_FADE_MS, 0, 1);
    const on = this.on[i];
    if (Number.isNaN(on)) return 0;
    return on === -Infinity ? 1 : clamp((now - on) / SWITCH_FADE_MS, 0, 1);
  }
}

/* ------------------------------------------------------------------ vane mobile (stage, M1, M3, M9, M12) */

export const VANE_STEP = TAU / 6;

export interface Vane {
  psi: number;
  psiV: number;
  sway: number;
  swayV: number;
  spin: number;
}

export interface Mobile {
  theta: number;
  omega: number;
  vanes: Vane[];
}

export function createMobile(count: number, rng: () => number): Mobile {
  return {
    theta: 0.3,
    omega: 0.08,
    vanes: Array.from({ length: count }, () => ({ psi: (rng() - 0.5) * 1.2, psiV: 0, sway: 0, swayV: 0, spin: -1 })),
  };
}

/** Projected width of a vane turned by psi about its thread: never negative. */
export function vaneWidth(width: number, psi: number, scale = 1): number {
  return Math.abs(width * scale * Math.cos(psi));
}

/** Hoop angle that brings vane i to the front, nearest to the current angle. */
export function frontAngle(theta: number, index: number): number {
  const target = -index * VANE_STEP;
  return target + Math.round((theta - target) / TAU) * TAU;
}

const nearestZero = (psi: number) => psi - Math.round(psi / TAU) * TAU;

/** Rest facing of vane i at time t: a slow, small turn. */
export const restPsi = (i: number, t: number) => 0.55 * Math.sin(t * 0.13 + i * 1.7);

/** One step of the mobile: idle drift, hoop alignment toward the attended vane, damped swings, press spins. */
export function stepMobile(m: Mobile, dt: number, t: number, focus: number): void {
  if (dt <= 0) return;
  if (focus >= 0) {
    const target = frontAngle(m.theta, focus);
    m.omega += (-(m.theta - target) * 4.5 - m.omega * 3.2) * dt;
  } else {
    m.omega += (0.08 - m.omega) * Math.min(1, dt * 0.45);
  }
  m.theta += m.omega * dt;
  m.vanes.forEach((v, i) => {
    const goal = i === focus ? 0 : restPsi(i, t);
    const off = i === focus ? nearestZero(v.psi) : v.psi - goal;
    v.psiV += (-off * (i === focus ? 14 : 3.2) - v.psiV * (i === focus ? 6.5 : 0.9)) * dt;
    v.psi += v.psiV * dt;
    v.swayV += (-v.sway * 32 - v.swayV * 1.6) * dt;
    v.sway += v.swayV * dt;
    if (v.spin >= 0) {
      v.spin += dt / 1.2;
      if (v.spin >= 1) v.spin = -1;
    }
  });
}

export type StageAction = "tap" | "left" | "right";

/** Angular impulse (tap) or directional impulse (left, right). */
export function impulse(m: Mobile, action: StageAction, rng: () => number): void {
  const dir = action === "left" ? -1 : action === "right" ? 1 : rng() < 0.5 ? -1 : 1;
  m.omega += dir * (action === "tap" ? 2.4 : 2.0);
  for (const v of m.vanes) {
    v.psiV += (rng() - 0.5) * 6 + dir * 1.5;
    v.swayV += dir * (26 + rng() * 22);
  }
}

/** The still's instant cut for a stage action: the hoop turns one vane step. */
export function stillTurn(theta: number, action: StageAction): number {
  return theta + (action === "left" ? -VANE_STEP : VANE_STEP);
}

/** Eased extra turn of a vane spinning once after a press. */
export const spinOffset = (spin: number) => (spin < 0 ? 0 : TAU * (spin < 0.5 ? 2 * spin * spin : 1 - (-2 * spin + 2) ** 2 / 2));

/* ------------------------------------------------------------------ transit capsule (mid, M4) */

export const CAPSULE_GLIDE_MS = 5600;
export const CAPSULE_COOLDOWN_MS = 8000;

export interface Capsule {
  /** Start of the current glide, or NaN when parked. */
  start: number;
  next: number;
  /** Station the capsule is parked at: 0 west, 1 east. */
  at: 0 | 1;
  lastCall: number;
}

export function createCapsule(now: number, rng: () => number): Capsule {
  return { start: Number.NaN, next: now + 4000 + rng() * 12000, at: 0, lastCall: -Infinity };
}

/** Next arrival 25-45 s after the last one. */
export function scheduleCapsule(c: Capsule, now: number, rng: () => number): void {
  c.next = now + 25000 + rng() * 20000;
}

/** A call from the bridge: the capsule leaves now unless it moved in the last 8 s. */
export function callCapsule(c: Capsule, now: number): boolean {
  if (now - c.lastCall < CAPSULE_COOLDOWN_MS || !Number.isNaN(c.start)) return false;
  c.lastCall = now;
  c.start = now;
  return true;
}

/** Position along the bridge (0 west, 1 east) and whether it is gliding. */
export function capsuleAt(c: Capsule, now: number, rng: () => number): { u: number; moving: boolean } {
  if (Number.isNaN(c.start) && now >= c.next) {
    c.start = now;
    c.lastCall = now;
  }
  if (Number.isNaN(c.start)) return { u: c.at, moving: false };
  const k = clamp((now - c.start) / CAPSULE_GLIDE_MS, 0, 1);
  const e = k * k * (3 - 2 * k);
  const u = c.at === 0 ? e : 1 - e;
  if (k >= 1) {
    c.at = c.at === 0 ? 1 : 0;
    c.start = Number.NaN;
    scheduleCapsule(c, now, rng);
    return { u: c.at, moving: false };
  }
  return { u, moving: true };
}

/* ------------------------------------------------------------------ louvres, glint, intro */

export const LOUVRE_MS = 500;
/** modalSettleMs: the louvres finish closing inside it and the loop pauses right after. */
export const LOUVRE_SETTLE_MS = 520;
export const GLINT_MS = 1200;
export const GLINT_BEAT_MS = 2000;
export const INTRO_MS = 1200;

export interface Louvre {
  from: number;
  to: number;
  at: number;
}

/** 0 open, 1 closed, eased over 500 ms. */
export function louvreAt(l: Louvre, now: number): number {
  const k = clamp((now - l.at) / LOUVRE_MS, 0, 1);
  return lerp(l.from, l.to, k * k * (3 - 2 * k));
}

export function setLouvre(l: Louvre, to: number, now: number): void {
  l.from = louvreAt(l, now);
  l.to = to;
  l.at = now;
}
