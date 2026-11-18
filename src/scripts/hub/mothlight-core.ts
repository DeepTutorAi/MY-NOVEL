// Pure maths for the mothlight hub scene (spec 3.4): wing flap and lean, moon placement and
// phase, lamp flicker and swing, light falloff and card lighting, bloom mapping, hung-lantern
// slots, perch timing, landing-spot visibility and the window layouts. No DOM access, so it
// imports cleanly in Node and is unit-tested.

import { clamp, TAU } from "./world/geom";
import { pointInRect, rectDistance } from "./world/rect";
import type { CardInfo, HubMode, PageSnapshot, Rect, Tier, WindowName } from "./world/types";

export { TAU };

/* ---------------------------------------------------------------- wings */

export const FLAP_FRAMES = 12;
const OPEN_MIN = 0.3;
const FLAP_EASE = 0.6;
/** The dorsal sprite leans into its flight direction by at most this much. */
const MAX_LEAN = 0.8;

/** Wing openness (x foreshortening) for a flap phase; 1 = fully spread, OPEN_MIN = raised. */
export function flapOpenness(phase: number): number {
  return OPEN_MIN + (1 - OPEN_MIN) * (0.5 + 0.5 * Math.cos(phase)) ** FLAP_EASE;
}

/** Flap frame whose openness is closest to `open`, searched on the opening half of the cycle. */
export function frameForOpenness(open: number, frames = FLAP_FRAMES): number {
  const c = clamp(clamp((open - OPEN_MIN) / (1 - OPEN_MIN), 0, 1) ** (1 / FLAP_EASE) * 2 - 1, -1, 1);
  return Math.round((Math.acos(c) / TAU) * frames) % frames;
}

/** Screen rotation of the top-down moth sprite: near upright, leaning toward its heading. */
export function displayAngle(heading: number): number {
  return clamp(Math.atan2(Math.cos(heading), Math.max(0.3, -Math.sin(heading))), -MAX_LEAN, MAX_LEAN);
}

export function wrapAngle(a: number): number {
  let r = (a + Math.PI) % TAU;
  if (r < 0) r += TAU;
  return r - Math.PI;
}

/** Near moths on screen for a viewport and governor tier (spec 3.4: 4-12 by tier). */
export function mothCount(w: number, h: number, tier: Tier): number {
  const base = clamp(Math.round((w * h) / 160_000) + 2, 4, 12);
  return tier === 0 ? base : Math.min(base, tier === 1 ? 6 : 4);
}

/** Wingspan in CSS px of a near moth at depth 1. */
export const mothSpan = (short: number) => clamp(short * 0.05, 24, 50);

/* ---------------------------------------------------------------- moon */

export interface MoonPlacement {
  x: number;
  y: number;
  r: number;
  /** Faint 22-degree halo ring; only where there is room for it. */
  ring: boolean;
  /** No free sky for a whole disc: only the moon's glow shows, from the freest corner. */
  glowOnly?: boolean;
}

export const moonRadius = (short: number) => clamp(short * 0.05, 14, 50);

function clearance(x: number, y: number, rects: readonly Rect[]): number {
  let best = Infinity;
  for (const r of rects) best = Math.min(best, rectDistance(x, y, r));
  return best;
}

/**
 * Places the moon in the top of the screen at scroll 0, on the preferred side, with the disc
 * and its inner bloom clear of every rect. The free point nearest a composed anchor wins (the
 * middle of a wide enough gutter), so the profile chip never pushes the moon into the corner.
 * Without room it shrinks, always fully on screen; with no room even for the smallest disc only
 * its glow shows from the corner, never a disc cut by the edge. `need` is the clearance from
 * text in moon radii (landscape-short asks for more, so the moon never crowds the title).
 */
export function placeMoon(width: number, height: number, r0: number, avoid: readonly Rect[], side: "left" | "right", gutter = 0, need = 1.6): MoonPlacement {
  const ring = Math.min(width, height) >= 600;
  const mirror = (x: number) => (side === "right" ? x : width - x);
  const inset = gutter >= r0 * 2.4 ? gutter / 2 : r0 * 1.9 + 12;
  const anchor = { x: mirror(width - inset), y: Math.max(r0 * 2 + 16, height * 0.13) };
  const search = (r: number, need: number, yLo: number, yHi: number) => {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    const step = Math.max(4, r * 0.4);
    const edge = Math.max(10, r * 0.5);
    for (let y = yLo; y <= yHi; y += step) {
      for (let x = edge + r; x <= width - edge - r; x += step) {
        if (clearance(x, y, avoid) < r * need) continue;
        // Distance to the anchor, with the far side of the screen made costly.
        const d = Math.hypot(x - anchor.x, (y - anchor.y) * 1.4) + Math.abs(mirror(x) - width) * 0.25;
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    return best;
  };
  const top = (r: number) => Math.max(10, r * 0.5) + r;
  const inside = search(r0, need, top(r0), height * 0.34);
  if (inside) return { ...inside, r: r0, ring };
  for (const [k, clear] of [
    [0.72, need > 1.6 ? need * 0.9 : 1.3],
    [0.55, need > 1.6 ? need * 0.8 : 1.15],
  ]) {
    const r = Math.max(9, r0 * k);
    const smaller = search(r, clear, top(r), height * 0.34);
    if (smaller) return { ...smaller, r, ring: false };
  }
  const r1 = r0 * 0.72;
  return { x: mirror(width - r1 * 1.4), y: r1 * 0.3, r: r1, ring: false, glowOnly: true };
}

/** How far moths can circle the moon before brushing page text. */
export function moonOrbit(moon: MoonPlacement, span: number, avoid: readonly Rect[]): { rx: number; ry: number } {
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

export interface Orbit {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** Shrinks and shifts an elliptical orbit so it stays inside the screen margins. */
export function fitOrbit(cx: number, cy: number, rx: number, ry: number, width: number, height: number, margin: number): Orbit {
  const fx = Math.max(0, Math.min(rx, (width - 2 * margin) / 2));
  const fy = Math.max(0, Math.min(ry, (height - 2 * margin) / 2));
  return { x: clamp(cx, margin + fx, width - margin - fx), y: clamp(cy, margin + fy, height - margin - fy), rx: fx, ry: fy };
}

/** Side of the screen for the moon: the chip sits top right, so landscape-short uses the left. */
export const moonSide = (mode: HubMode): "left" | "right" => (mode === "landscape-short" ? "left" : "right");

/** Static moon art is cached per phase bucket (spec 2.21: 8 buckets). */
export const MOON_BUCKETS = 8;
export const phaseBucket = (phase: number) => ((Math.round(phase * MOON_BUCKETS) % MOON_BUCKETS) + MOON_BUCKETS) % MOON_BUCKETS;

/**
 * Lit shape of the disc for a phase (0 new, 0.5 full): the illuminated fraction, which limb is
 * lit, and the x-scale of the terminator ellipse (1 at new, 0 at the quarters, -1 at full).
 */
export function moonShape(phase: number): { lit: number; waxing: boolean; k: number } {
  const c = Math.cos(TAU * phase);
  return { lit: (1 - c) / 2, waxing: phase % 1 < 0.5, k: c };
}

/* ---------------------------------------------------------------- lamp */

/** Flame flicker: luminance within 12 % of full, every partial at or below 2 Hz (spec 2.20). */
export const FLICKER_AMP = 0.12;
export const FLICKER_HZ: readonly number[] = [0.53, 1.13, 1.79];
const FLICKER_W = [0.5, 0.3, 0.2];

export function flicker(t: number, phase = 0): number {
  let s = 0;
  for (let i = 0; i < FLICKER_HZ.length; i++) s += FLICKER_W[i] * Math.sin(TAU * FLICKER_HZ[i] * t + phase * (i + 1.7));
  return 1 - FLICKER_AMP * (0.5 + 0.5 * s);
}

export interface Swing {
  angle: number;
  vel: number;
  /** Rotation of the lantern about its hook; its glazed side throws the brighter light. */
  spin: number;
  spinVel: number;
}

export const SWING_MAX = 0.55;
const SWING_K = (TAU / 2.4) ** 2;

/** Damped pendulum (period about 2.4 s) plus the spin about the hook, both settling on their own. */
export function stepSwing(s: Swing, dt: number, breeze: number): void {
  s.vel += (-SWING_K * Math.sin(s.angle) - 0.9 * s.vel + breeze) * dt;
  s.angle = clamp(s.angle + s.vel * dt, -SWING_MAX, SWING_MAX);
  s.spinVel *= Math.exp(-0.8 * dt);
  s.spin = (s.spin + s.spinVel * dt) % TAU;
}

export const pushSwing = (s: Swing, dir: number) => {
  s.vel = clamp(s.vel + dir * 1.5, -2.4, 2.4);
};

export const spinSwing = (s: Swing, dir: number) => {
  s.spinVel = clamp(s.spinVel + dir * 5, -9, 9);
};

/* ---------------------------------------------------------------- light */

export interface Light {
  x: number;
  y: number;
  range: number;
  power: number;
}

/** Light reaching distance d: (1 - d / range)^2, 0 at and beyond the range. */
export function falloff(d: number, range: number): number {
  if (!(range > 0) || d >= range) return 0;
  const k = 1 - Math.max(0, d) / range;
  return k * k;
}

export interface CardLight {
  glow: number;
  /** Where the light comes from, as fractions of the card box (-0.5..1.5). */
  lx: number;
  ly: number;
  /** Index of the light that won, -1 when none reaches the card. */
  source: number;
}

/** A card is lit by the light that reaches it most strongly, measured to its nearest edge. */
export function cardLight(rect: Rect, lights: readonly Light[]): CardLight {
  let source = -1;
  let value = 0;
  lights.forEach((l, i) => {
    const v = l.power * falloff(rectDistance(l.x, l.y, rect), l.range);
    if (v > value) {
      value = v;
      source = i;
    }
  });
  if (source < 0) return { glow: 0, lx: 0.5, ly: -0.25, source };
  const l = lights[source];
  return {
    glow: clamp(value, 0, 1),
    lx: clamp((l.x - rect.x) / Math.max(1, rect.w), -0.5, 1.5),
    ly: clamp((l.y - rect.y) / Math.max(1, rect.h), -0.5, 1.5),
    source,
  };
}

/* ---------------------------------------------------------------- reading */

/** Moonflower openness from reading progress: bud at no reading, open from any start, full only when finished. */
export function bloomOf(read: number | null, finished: boolean): number {
  if (finished) return 1;
  if (read === null || !(read > 0)) return 0;
  return 0.25 + 0.65 * clamp(read, 0, 1);
}

/* ---------------------------------------------------------------- hung lanterns */

export const LANTERN_CAP = 3;

export interface LanternSpot {
  plane: WindowName;
  /** Fractions of the window canvas, so a lantern keeps its place across resizes. */
  u: number;
  v: number;
}

export interface HungLantern extends LanternSpot {
  id: number;
}

/** A tap on a lantern takes it down; elsewhere it hangs one there, taking down the oldest at the cap. */
export function tapLantern(
  list: readonly HungLantern[],
  at: LanternSpot,
  id: number,
  size: (plane: WindowName) => { w: number; h: number },
  hitPx = 26,
): HungLantern[] {
  const s = size(at.plane);
  const hit = list.find((l) => l.plane === at.plane && Math.hypot((l.u - at.u) * s.w, (l.v - at.v) * s.h) <= hitPx);
  if (hit) return list.filter((l) => l !== hit);
  return [...list.slice(Math.max(0, list.length - LANTERN_CAP + 1)), { id, ...at }];
}

/** Keyboard: hang at the next free slot; at the cap, take down the oldest instead. */
export function keyLantern(list: readonly HungLantern[], slots: readonly LanternSpot[], id: number): HungLantern[] {
  if (list.length >= LANTERN_CAP) return list.slice(1);
  const taken = (s: LanternSpot) => list.some((l) => l.plane === s.plane && Math.abs(l.u - s.u) < 0.03 && Math.abs(l.v - s.v) < 0.08);
  const slot = slots.find((s) => !taken(s)) ?? slots[list.length % Math.max(1, slots.length)];
  return slot ? [...list, { id, ...slot }] : list.slice();
}

/* ---------------------------------------------------------------- perches */

/** Perched moths take off above this scroll speed (px/s, spec 2.9). */
export const PERCH_TAKEOFF_SPEED = 300;
/** ... or this long after attention ends. */
export const PERCH_LINGER_MS = 1500;
/** They land again after this long of calm while the card is still attended. */
export const RELAND_CALM_MS = 1000;

export function perchLeaves(speed: number, attended: boolean, endedAt: number | null, now: number): boolean {
  if (Math.abs(speed) > PERCH_TAKEOFF_SPEED) return true;
  return !attended && endedAt !== null && now - endedAt >= PERCH_LINGER_MS;
}

export function mayReland(attended: boolean, calmSince: number | null, now: number): boolean {
  return attended && calmSince !== null && now - calmSince >= RELAND_CALM_MS;
}

/* ---------------------------------------------------------------- landing spots */

/**
 * Indices of the landing spots (document coordinates) a reader can see now: inside the
 * viewport, under no opaque rect (cards, panels, chip) and clear of text by `pad`.
 */
export function visibleSpots(spots: readonly { x: number; y: number }[], s: PageSnapshot, scrollY: number, pad = 12): number[] {
  const out: number[] = [];
  spots.forEach((p, i) => {
    const y = p.y - scrollY;
    if (p.x < pad || p.x > s.viewport.w - pad || y < pad || y > s.viewport.h - pad) return;
    if (s.cover.some((r) => pointInRect(r, p.x, p.y, pad))) return;
    if (s.holes.some((r) => rectDistance(p.x, p.y, r) < pad)) return;
    out.push(i);
  });
  return out;
}

/* ---------------------------------------------------------------- open sky */

/** Viewport rects of open sky where moths may wander: top band, bands, wide gutters and windows in view. */
export function openAreas(s: PageSnapshot, scrollY: number): Rect[] {
  const vw = s.viewport.w;
  const vh = s.viewport.h;
  const out: Rect[] = [];
  const add = (r: Rect, minH = 40) => {
    const y0 = Math.max(0, r.y - scrollY);
    const y1 = Math.min(vh, r.y + r.h - scrollY);
    if (y1 - y0 >= minH && r.w >= 40) out.push({ x: r.x, y: y0, w: r.w, h: y1 - y0 });
  };
  add(s.topBand, 60);
  for (const b of s.bands) add(b);
  for (const name of ["stage", "mid", "ground"] as const) {
    const w = s.windows[name];
    if (w.w > 0) add({ x: 0, y: w.y, w: vw, h: w.h });
  }
  if (s.gutters.left >= 60) out.push({ x: 0, y: 0, w: s.gutters.left, h: vh });
  if (s.gutters.right >= 60) out.push({ x: vw - s.gutters.right, y: 0, w: s.gutters.right, h: vh });
  return out;
}

/* ---------------------------------------------------------------- window layouts */

export interface StageFlower {
  slug: string;
  locked: boolean;
  x: number;
  /** Height of the stem above the bed. */
  stem: number;
  lean: number;
}

export interface StageLayout {
  w: number;
  h: number;
  box: Rect;
  hit: Rect;
  postX: number;
  topY: number;
  /** Chain pivot under the hook's tip. */
  hookX: number;
  hookY: number;
  /** Pivot to lantern centre. */
  reach: number;
  size: number;
  bedY: number;
  flowers: StageFlower[];
}

/** Rect in window canvas coordinates for a document rect (the canvas is full-bleed from x 0). */
export const toCanvas = (doc: Rect, win: Rect, canvasX = 0): Rect => ({ x: doc.x - canvasX, y: doc.y - win.y, w: doc.w, h: doc.h });

/**
 * The stage: a shepherd's-hook lamp post whose lantern hangs in the centre of the hit rect, and
 * one moonflower per published or locked card along a low bed to its right (spec 3.4).
 */
export function stageLayout(w: number, h: number, box: Rect, hit: Rect, cards: readonly CardInfo[], rand: () => number): StageLayout {
  const size = clamp(h * 0.11, 8, 20);
  const hookX = hit.x + hit.w / 2;
  const postX = hookX - clamp(hit.w * 0.36, size * 2, size * 4.2);
  const topY = Math.max(4, hit.y + h * 0.02);
  const hookY = topY + size * 1.1;
  const bedY = h - clamp(h * 0.15, 10, 30);
  const reach = clamp((bedY - hookY) * 0.36, size * 1.6, size * 4);
  const shelf = cards.filter((c) => c.kind !== "upcoming");
  const x0 = Math.max(hit.x + hit.w + size * 2, box.x + box.w * 0.34);
  const x1 = box.x + box.w * 0.97;
  const gap = shelf.length > 1 ? (x1 - x0) / (shelf.length - 1) : 0;
  const flowers = shelf.map((c, i) => ({
    slug: c.slug,
    locked: c.kind === "locked",
    x: shelf.length > 1 ? x0 + gap * i + (rand() - 0.5) * gap * 0.25 : (x0 + x1) / 2,
    stem: (bedY - topY) * (0.42 + rand() * 0.24),
    lean: (rand() - 0.5) * 0.36,
  }));
  return { w, h, box, hit, postX, topY, hookX, hookY, reach, size, bedY, flowers };
}

/** Lantern centre in stage canvas px for a swing angle. */
export const lanternPos = (s: StageLayout, angle: number) => ({
  x: s.hookX + Math.sin(angle) * s.reach,
  y: s.hookY + Math.cos(angle) * s.reach,
});

export interface MidLayout {
  w: number;
  h: number;
  box: Rect;
  /** Low garden lantern on its short post. */
  lamp: { x: number; y: number };
  /** Landing blooms on the beds, always in view while the window is. */
  spots: { x: number; y: number; r: number }[];
  /** Cocoons hanging from the branch, one per upcoming card. */
  cocoons: { x: number; y: number; slug: string }[];
  branchY: number;
  groundY: number;
  /** Keyboard slots for hung lanterns. */
  slots: LanternSpot[];
}

/** The garden path between the shelf and the upcoming cards (spec 3.4 mid window). */
export function midLayout(w: number, h: number, box: Rect, avoid: readonly Rect[], upcoming: readonly CardInfo[], rand: () => number): MidLayout {
  const groundY = h * 0.8;
  // The low lantern stands clear of the window label: right of it when they would meet.
  const lampY = groundY - clamp(h * 0.28, 22, 56);
  let lampX = box.x + box.w * 0.2;
  for (const a of avoid) {
    if (a.x < lampX + 16 && a.x + a.w > lampX - 16 && a.y < groundY && a.y + a.h > lampY - 26) lampX = Math.max(lampX, a.x + a.w + 24);
  }
  const spots: MidLayout["spots"] = [];
  const r = clamp(h * 0.05, 5, 10);
  for (let i = 0; i < 7 && spots.length < 6; i++) {
    const x = box.x + box.w * (0.3 + (i / 6) * 0.42) + (rand() - 0.5) * box.w * 0.03;
    const y = h * (0.5 + rand() * 0.2);
    if (avoid.some((a) => pointInRect(a, x, y, 18)) || Math.abs(x - lampX) < 28) continue;
    spots.push({ x, y, r: r * (0.8 + rand() * 0.4) });
  }
  const branchY = h * 0.12;
  const cocoons = upcoming.map((c, i) => ({
    slug: c.slug,
    x: box.x + box.w * (0.76 + i * 0.11) + (rand() - 0.5) * 10,
    y: branchY + h * (0.2 + rand() * 0.1),
  }));
  return {
    w,
    h,
    box,
    lamp: { x: lampX, y: lampY },
    spots,
    cocoons,
    branchY,
    groundY,
    slots: [0.36, 0.5, 0.64].map((u) => ({ plane: "mid" as const, u: (box.x + box.w * u) / Math.max(1, w), v: 0.34 })),
  };
}

export interface GroundLayout {
  w: number;
  h: number;
  ridgeY: number;
  lamp: { x: number; y: number };
  spots: { x: number; y: number; r: number }[];
}

/** The lawn behind the footer: a ridge above the footer text, a low lantern on it and blooms along it. */
export function groundLayout(w: number, h: number, box: Rect, textTop: number, rand: () => number): GroundLayout {
  const ridgeY = clamp(textTop - 64, h * 0.22, h * 0.6);
  const spots: GroundLayout["spots"] = [];
  for (let i = 0; i < 5; i++) {
    spots.push({ x: box.x + box.w * (0.3 + i * 0.13) + (rand() - 0.5) * 18, y: ridgeY - 6 - rand() * 14, r: clamp(h * 0.025, 5, 9) });
  }
  return { w, h, ridgeY, lamp: { x: box.x + Math.max(28, box.w * 0.12), y: ridgeY - clamp(h * 0.12, 18, 34) }, spots };
}
