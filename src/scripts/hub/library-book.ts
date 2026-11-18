// Pure maths for the library scene (pages-stars, spec 3.1) outside the bookcases: the hall's
// composition by mode (rose window, vault band, lancets, panel slots), the per-novel figures
// and their reading map, the draft paths pages ride and where they burn, the grimoire and its
// page mesh maths (ported from grimoire-core), page pool and burst reserve, candle flicker,
// the opening sweep, the stage shelf and the lectern. DOM-free, so it imports in Node.

import { buildWindLut, clamp, fnv1a, lerp, rectDistance, smoothstep } from "./world/geom";
import type { WindLut } from "./world/geom";
import type { CardInfo, HubMode, PageSnapshot, Rect, Vec } from "./world/types";

export type { WindLut };

/**
 * Period of the gutter bookcase tile: two gallery levels of 740 px. A multiple of 4, so period x
 * DPR is whole at DPR 1, 1.25 and 1.5. The scene declares its static planes with it before the
 * bookcase modules load.
 */
export const SHELF_PERIOD = 1480;

/* ------------------------------------------------------------------ book (ported) */

export interface BookPlacement {
  /** Centre of the spine at the front edge of the book. */
  x: number;
  y: number;
  /** Full width of the open book. */
  w: number;
  /** Projected depth from the front edge to the back edge. */
  depth: number;
  /** Screen pixels per unit of page height above the cover. */
  lift: number;
}

/** Height of the page block above the cover at u (-1..1): a hump beside the gutter, falling to the edge. */
export function pageProfile(u: number): number {
  const a = Math.min(1, Math.abs(u));
  return 0.04 + 0.26 * Math.sin(Math.PI * Math.pow(a, 0.62));
}

/** Book space to screen space. u: -1..1 across, v: 0 at the front edge to 1 at the back, z: page height units. */
export function projectBook(book: BookPlacement, u: number, v: number, z: number, out: Vec): Vec {
  const half = book.w / 2;
  out.x = book.x + u * half * (1 - 0.2 * v) + 0.1 * half * v;
  out.y = book.y - v * book.depth - z * book.lift - u * half * 0.035;
  return out;
}

const easeFlip = (p: number): number => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

/**
 * A turning page (or a volume's cover on its hinge) in the u/z plane, at distance s (0 at the
 * spine, 1 at the edge) and turn progress p (0 resting right, 1 resting left). The edge lags
 * behind the spine by a curve that is strongest mid-turn.
 */
export function pageFlipPoint(s: number, p: number, out: Vec): Vec {
  const q = clamp(p, 0, 1);
  const theta = Math.PI * easeFlip(q);
  const lag = Math.sin(Math.PI * q) * 0.62;
  const angle = theta - lag * Math.pow(s, 1.3);
  const lifted = Math.sin(Math.max(0, Math.min(Math.PI, angle)));
  out.x = s * Math.cos(angle);
  out.y = pageProfile(out.x) * (1 - lifted) + s * lifted * 1.7;
  return out;
}

export interface PageLife {
  opacity: number;
  /** 0 intact, 1 fully burned away. */
  burn: number;
}

/** Share of its life after which a page that never reached the vault starts burning by age. */
export const BURN_START = 0.62;
/** How long a page takes to burn once its path enters the burn zone. */
export const ZONE_BURN_S = 2.2;

/**
 * Opacity and burn of a page. It burns by path zone once it entered the vault (`zoneAge`, its
 * age at entry) or, failing that, by age after BURN_START of its life; the faster one wins.
 */
export function pageLifecycle(age: number, life: number, out: PageLife, zoneAge: number | null = null): PageLife {
  const t = life > 0 ? clamp(age / life, 0, 1) : 1;
  out.opacity = smoothstep(0, Math.min(0.08, 1.2 / Math.max(life, 1)), t);
  const byAge = t <= BURN_START ? 0 : (t - BURN_START) / (1 - BURN_START);
  const byZone = zoneAge === null ? 0 : clamp((age - zoneAge) / ZONE_BURN_S, 0, 1);
  out.burn = Math.max(byAge, byZone);
  return out;
}

export const BURST_COOLDOWN_S = 1.2;

/** A burst flashes the whole book; this keeps repeated tapping well under 3 flashes per second. */
export function canBurst(now: number, lastBurstAt: number): boolean {
  return now - lastBurstAt >= BURST_COOLDOWN_S;
}

/* ------------------------------------------------------------------ pools */

/** Page speed along a path, px/s, and life, s (the grimoire's values). */
export const PAGE_SPEED: readonly [number, number] = [58, 104];
export const PAGE_LIFE: readonly [number, number] = [22, 36];
export const BURST_MIN = 4;
export const BURST_MAX = 6;

/**
 * The page pool per mode. Ambient pages fill at most 70 % of it, so the burst's 4-6 pages
 * always find free slots (the grimoire's burst was silently clipped at the cap).
 */
export function pagePool(mode: HubMode, tier: 0 | 1 | 2 = 0): { pool: number; ambient: number } {
  const pool = mode === "wide" ? 20 : mode === "phone" || mode === "landscape-short" ? 10 : 16;
  const ambient = tier === 2 ? 4 : Math.floor(pool * 0.7);
  return { pool, ambient: Math.min(ambient, pool - BURST_MAX) };
}

/** Pages a burst releases: 4-6, always. */
export function burstCount(rng: () => number): number {
  return BURST_MIN + Math.floor(rng() * (BURST_MAX - BURST_MIN + 1));
}

/** Motes (structure-of-arrays pool): at most 360 on desktop, 160 on phones. */
export function moteCount(mode: HubMode, w: number, h: number): number {
  const phone = mode === "phone" || mode === "landscape-short";
  return Math.round(clamp((w * h) / 4200, phone ? 70 : 140, phone ? 160 : 360));
}

/** Flying volumes: 5 wide, 3 desktop and narrow, 2 phone, 1 landscape-short. */
export function volumeCount(mode: HubMode): number {
  return mode === "wide" ? 5 : mode === "phone" ? 2 : mode === "landscape-short" ? 1 : 3;
}

/* ------------------------------------------------------------------ hall composition */

export interface Rose {
  x: number;
  y: number;
  r: number;
}

export interface Lancet {
  side: "left" | "right";
  /** Centre x, width, arch springing to sill. */
  x: number;
  w: number;
  top: number;
  bottom: number;
}

export interface Hall {
  mode: HubMode;
  w: number;
  h: number;
  /** Height of the vault band at scroll 0 (viewport px). */
  band: number;
  rose: Rose;
  lancets: Lancet[];
  /** Vault panel slots in viewport px at scroll 0, most prominent first. */
  panels: Rect[];
  /** Figure scale inside a panel (spec: 14-20 px on phones). */
  figure: number;
}

const PANEL_PAD = 3;

/** True when the rect keeps `pad` px from every hole and stays inside the viewport. */
function clearOf(r: Rect, holes: readonly Rect[], w: number, pad: number): boolean {
  if (r.x < 1 || r.y < 1 || r.x + r.w > w - 1) return false;
  for (const h of holes) {
    if (r.x < h.x + h.w + pad && r.x + r.w > h.x - pad && r.y < h.y + h.h + pad && r.y + r.h > h.y - pad) return false;
  }
  return true;
}

/** Holes that matter at scroll 0: those starting in the top band, plus the top band's lower edge as a floor. */
function topHoles(s: PageSnapshot): Rect[] {
  const limit = s.topBand.h;
  const holes = s.holes.filter((h) => h.y < limit + 40);
  if (s.parts.resume) holes.push(s.parts.resume);
  if (s.parts.start) holes.push(s.parts.start);
  return holes;
}

/**
 * The rose window: the largest circle (r 10-30, 30 on desktop) that stays 6 px clear of every
 * hole, tried at the top-left first on phones (clear of the chip) and over the gap between the
 * kicker and the chip on wider screens. When no circle fits (a packed short landscape header)
 * the radius is 0: no window is drawn and the nave converges on a point above the screen.
 */
export function placeRose(s: PageSnapshot): Rose {
  const holes = topHoles(s);
  const W = s.viewport.w;
  const phone = s.mode === "phone" || s.mode === "landscape-short";
  const maxR = phone ? (s.mode === "landscape-short" ? 26 : 30) : 30;
  const fits = (x: number, y: number, r: number) =>
    y - r >= 2 && x - r >= 2 && x + r <= W - 2 && holes.every((h) => rectDistance(x, y, h) >= r + 6);
  const xs: number[] = [];
  if (phone) for (let x = 14; x < W * 0.7; x += 4) xs.push(x);
  else {
    // Above the title, between the shell's edge and the chip: the nave's vanishing point.
    const chip = s.parts.chip?.x ?? W * 0.6;
    const mid = s.shell.x + Math.min(s.parts.title.w * 0.5, (chip - s.shell.x) * 0.5);
    for (let d = 0; d < (chip - s.shell.x) / 2; d += 6) xs.push(mid - d, mid + d);
  }
  for (let r = maxR; r >= 10; r -= 2) {
    for (const x of xs) {
      for (let y = r + 4; y < s.topBand.h; y += 4) if (fits(x, y, r)) return { x, y, r };
    }
  }
  return { x: W / 2, y: -24, r: 0 };
}

/**
 * Panel size per mode: figure scale s; an oval cartouche 2.5s by 1.9s, flattened to 2.3s by
 * 1.2s on phones so three fit in the strip above the chip.
 */
export function panelSize(mode: HubMode): { s: number; w: number; h: number } {
  const phone = mode === "phone" || mode === "landscape-short";
  const s = phone ? 14 : mode === "narrow" ? 18 : 22;
  return { s, w: Math.round(s * (phone ? 2.3 : 2.5)), h: Math.round(s * (phone ? 1.2 : 1.9)) };
}

/**
 * Panel slots in the vault band, clear of every hole and of the rose window, at least 10 px
 * apart: rows from the top down, each row from the rose window outward. `want` caps the count.
 */
export function placePanels(s: PageSnapshot, rose: Rose, want: number): Rect[] {
  const { w: pw, h: ph } = panelSize(s.mode);
  const holes = [...topHoles(s), { x: rose.x - rose.r - 6, y: rose.y - rose.r - 6, w: rose.r * 2 + 12, h: rose.r * 2 + 12 }];
  const W = s.viewport.w;
  const out: Rect[] = [];
  const phone = s.mode === "phone" || s.mode === "landscape-short";
  // Phones fill the strip above the chip from the rose window on; wider screens spread a
  // staggered frieze out from the rose window, about a panel apart.
  const gap = phone ? 10 : pw * 0.6;
  // Short landscape keeps its panels level with the chip, beside the title.
  const top = s.mode === "landscape-short" && s.parts.chip ? s.parts.chip.y + s.parts.chip.h : s.topBand.h;
  const band = Math.max(top, ph + 4);
  const xs: number[] = [];
  for (let d = 0; d < W; d += 6) xs.push(rose.x + d - pw / 2, rose.x - d - pw / 2);
  const ys: number[] = [];
  for (let y = 1; y + ph <= band; y += 3) ys.push(y);
  const free = (r: Rect) =>
    clearOf(r, holes, W, PANEL_PAD) && !out.some((o) => r.x < o.x + o.w + gap && r.x + r.w > o.x - gap && r.y < o.y + o.h + gap && r.y + r.h > o.y - gap);
  if (phone) {
    for (const y of ys) {
      for (const x of xs) {
        if (out.length >= want) return out;
        const r: Rect = { x: Math.round(x), y, w: pw, h: ph };
        if (free(r)) out.push(r);
      }
    }
    return out;
  }
  for (const x of xs) {
    if (out.length >= want) break;
    const lift = out.length % 2 ? 9 : 2;
    const order = [...ys].sort((a, b) => Math.abs(a - lift) - Math.abs(b - lift));
    for (const y of order) {
      const r: Rect = { x: Math.round(x), y, w: pw, h: ph };
      if (free(r)) {
        out.push(r);
        break;
      }
    }
  }
  return out;
}

/** The lancet windows: one tall arched window at the top of each gutter on desktop and wide. */
export function placeLancets(s: PageSnapshot): Lancet[] {
  if (s.mode !== "desktop" && s.mode !== "wide") return [];
  const out: Lancet[] = [];
  for (const side of ["left", "right"] as const) {
    const g = side === "left" ? s.gutters.left : s.gutters.right;
    const w = Math.round(clamp(g * 0.4, 52, 120));
    const x = side === "left" ? g * 0.5 : s.viewport.w - g * 0.5;
    const top = 70;
    out.push({ side, x, w, top, bottom: Math.round(top + clamp(s.viewport.h * 0.5, 300, 640)) });
  }
  return out;
}

/** The whole hall composition for a page snapshot (one shared classifier: snapshot.mode). */
export function hallLayout(s: PageSnapshot): Hall {
  const rose = placeRose(s);
  const phone = s.mode === "phone" || s.mode === "landscape-short";
  const band = phone ? s.topBand.h : Math.max(s.topBand.h, 220);
  return {
    mode: s.mode,
    w: s.viewport.w,
    h: s.viewport.h,
    band,
    rose,
    lancets: placeLancets(s),
    panels: placePanels(s, rose, Math.max(6, s.cards.length)),
    figure: panelSize(s.mode).s,
  };
}

/* ------------------------------------------------------------------ figures and the reading map */

export interface Figure {
  stars: ReadonlyArray<readonly [number, number]>;
  edges: ReadonlyArray<readonly [number, number]>;
}

/** Each novel's own figure in a unit box (spec 1.4 of the art notes); others use the generic set. */
export const FIGURES: Readonly<Record<string, Figure>> = {
  // A lantern hanging over a doorway.
  lodge: {
    stars: [[-0.55, 0.9], [-0.55, 0.05], [0.55, 0.05], [0.55, 0.9], [0, -0.92], [-0.22, -0.5], [0, -0.18], [0.22, -0.5]],
    edges: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [7, 4]],
  },
  // A crescent over a rail line.
  tsukinomi: {
    stars: [[0.15, -0.95], [-0.35, -0.75], [-0.48, -0.3], [-0.2, 0.05], [-0.9, 0.72], [0, 0.72], [0.9, 0.72]],
    edges: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6]],
  },
  // A wedge with a reel.
  kusabi: {
    stars: [[-0.95, 0.85], [0.05, 0.85], [-0.95, -0.35], [0.55, -0.75], [0.85, -0.35], [0.55, 0.05], [0.25, -0.35]],
    edges: [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  // A ship's bow.
  hizumi: {
    stars: [[-0.95, 0.35], [0.45, 0.35], [0.95, -0.25], [-0.75, 0.8], [0.25, 0.8], [0, -0.95], [0, 0.35]],
    edges: [[0, 1], [1, 2], [0, 3], [3, 4], [4, 1], [5, 6]],
  },
  // A spire.
  ruin: {
    stars: [[0, -0.95], [-0.28, -0.15], [0.28, -0.15], [-0.42, 0.88], [0.42, 0.88], [0, 0.35]],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4], [1, 2]],
  },
};

const GENERIC: readonly Figure[] = [
  { stars: [[-1, 0.2], [-0.55, -0.1], [-0.1, 0], [0.3, 0.3], [0.85, 0.1], [0.95, -0.5], [0.35, -0.45]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  { stars: [[-0.3, -1], [0.35, -0.95], [-0.1, -0.2], [0.15, 0.05], [-0.55, 0.85], [0.55, 0.95]], edges: [[0, 2], [1, 3], [2, 3], [2, 4], [3, 5]] },
  { stars: [[-0.9, -0.5], [-0.4, 0.3], [0, -0.3], [0.45, 0.4], [0.95, -0.35]], edges: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { stars: [[0, -0.9], [-0.55, -0.2], [0.55, -0.15], [0, 0.15], [-0.35, 0.9], [0.45, 0.8]], edges: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5]] },
];

export function figureFor(slug: string): Figure {
  return FIGURES[slug] ?? GENERIC[fnv1a(slug) % GENERIC.length];
}

/** Stars lit by reading progress: 0 gives 0, any start at least 1, all when read through. */
export function litStars(read: number | null, finished: boolean, count: number): number {
  if (finished) return count;
  if (read === null || read <= 0) return 0;
  return Math.min(count, Math.max(1, Math.ceil(read * count)));
}

/** Whether a figure's lines are traced at rest: finished novels only (summons trace live). */
export const tracedAtRest = (card: Pick<CardInfo, "kind" | "finished">): boolean => card.kind === "open" && card.finished;

/** Panel priority (spec 3.1 phone): attended, resume, in progress, finished, unread open, upcoming, locked. */
export function panelOrder(cards: readonly CardInfo[], attended: string | null, resume: string | null): CardInfo[] {
  const rank = (c: CardInfo): number => {
    if (c.slug === attended) return 0;
    if (c.slug === resume) return 1;
    if (c.kind === "open" && !c.finished && (c.read ?? 0) > 0) return 2;
    if (c.kind === "open" && c.finished) return 3;
    if (c.kind === "open") return 4;
    if (c.kind === "upcoming") return 5;
    return 6;
  };
  return [...cards].sort((a, b) => rank(a) - rank(b) || a.index - b.index);
}

/** Minimum and default trace durations (spec: 0.9 s on a summon, 0.6 s on a vault tap, never under 0.4 s). */
export const TRACE_MIN_S = 0.4;
export const TRACE_SUMMON_S = 0.9;
export const TRACE_TAP_S = 0.6;

/** Share of a figure's lines drawn `t` s into a trace of `duration` s (clamped to at least TRACE_MIN_S). */
export function traceProgress(t: number, duration: number): number {
  return clamp(t / Math.max(TRACE_MIN_S, duration), 0, 1);
}

/** Twinkle of a lit star: at most 0.5 Hz and within ±25 %. */
export function twinkle(t: number, rate: number, phase: number): number {
  return 1 + 0.25 * Math.sin(t * Math.PI * 2 * Math.min(0.5, rate) + phase);
}

/* ------------------------------------------------------------------ light */

/** Candle flicker as a brightness factor: within ±12 % and dominated by components at or below 1.6 Hz. */
export function flicker(t: number, phase: number): number {
  const a = Math.sin(Math.PI * 2 * 1.6 * t + phase);
  const b = Math.sin(Math.PI * 2 * 0.63 * t + phase * 2.3);
  const c = Math.sin(Math.PI * 2 * 0.27 * t + phase * 0.7);
  return 1 + 0.12 * (0.35 * a + 0.4 * b + 0.25 * c);
}

/** The opening: statics fade in over 0.6 s, then one candle sweep runs down the hall over 1.6 s. */
export const INTRO_SWEEP_START = 0.6;
export const INTRO_SWEEP_S = 1.6;
/** Each light ramps over at least 300 ms as the front passes (spec 2.20). */
export const INTRO_RAMP_S = 0.36;

/** Brightness 0..1 of a light at viewport height y (0..h) at intro time t; ends by 2.2 s. */
export function introLight(t: number, y: number, h: number): number {
  const start = INTRO_SWEEP_START + clamp(y / Math.max(1, h), 0, 1) * (INTRO_SWEEP_S - INTRO_RAMP_S);
  return smoothstep(start, start + INTRO_RAMP_S, t);
}

/* ------------------------------------------------------------------ draft paths */

export interface DraftPath {
  lut: WindLut;
  /** Share of the path after which the page is in the burn zone (the vault, or the open band). */
  burnAt: number;
  /** Points are document px (scroll with the page) rather than viewport px. */
  doc: boolean;
}

/** Arc-length share at which a LUT first passes above `y`, or 1 when it never does. */
export function zoneEntry(lut: WindLut, y: number): number {
  const last = lut.y.length - 1;
  for (let i = 0; i <= last; i++) if (lut.y[i] < y) return i / last;
  return 1;
}

/** Remaining length a path needs after entering its burn zone, so the fastest page burns through first. */
export const BURN_RUN = ZONE_BURN_S * PAGE_SPEED[1] * 1.35;

function finish(points: Vec[], zoneY: number, doc: boolean): DraftPath {
  const lut = buildWindLut(points);
  let burnAt = zoneEntry(lut, zoneY);
  // The burn must be able to finish before the path ends.
  burnAt = Math.min(burnAt, 1 - BURN_RUN / Math.max(lut.length, 1));
  return { lut, burnAt: clamp(burnAt, 0.05, 0.95), doc };
}

/**
 * Ambient draft paths in viewport px: up each gutter past the shelves into the vault on
 * desktop, wide and narrow; along the open strip above the chip on phones and in short
 * landscape (pages enter from the left edge).
 */
export function draftPaths(s: PageSnapshot, hall: Hall): DraftPath[] {
  const W = s.viewport.w;
  const H = s.viewport.h;
  const band = hall.band;
  if (s.mode === "phone" || s.mode === "landscape-short") {
    const top = Math.max(6, Math.min(16, (s.parts.chip?.y ?? 24) * 0.5));
    const low = s.mode === "phone" ? Math.min(band * 0.4, (s.parts.title?.y ?? 80) - 10) : top + 18;
    return [
      finish(
        [
          { x: -40, y: low },
          { x: W * 0.06, y: low * 0.8 },
          { x: W * 0.14, y: top * 1.3 },
          { x: W * 0.32, y: top },
          { x: W * 0.55, y: top * 1.4 },
          { x: W * 0.78, y: top * 0.8 },
          { x: W + 40, y: top * 0.5 },
        ],
        band,
        false,
      ),
    ];
  }
  const out: DraftPath[] = [];
  for (const side of ["left", "right"] as const) {
    const g = side === "left" ? s.gutters.left : s.gutters.right;
    const gx = (f: number) => (side === "left" ? g * f : W - g * f);
    const across = (f: number) => (side === "left" ? W * f : W - W * f);
    const top = clamp(band * 0.12, 14, 40);
    out.push(
      finish(
        [
          { x: gx(0.5), y: H + 40 },
          { x: gx(0.32), y: H * 0.72 },
          { x: gx(0.66), y: H * 0.46 },
          { x: gx(0.42), y: Math.max(band * 1.1, H * 0.26) },
          { x: gx(0.7), y: band * 0.5 },
          { x: across(0.22), y: top * 1.4 },
          { x: across(0.36), y: top },
          { x: across(0.47), y: top * 0.6 },
          { x: across(0.56), y: -30 },
        ],
        band * 0.85,
        false,
      ),
    );
  }
  return out;
}

/**
 * A path in document px from a point in a window (a tome, the grimoire, a bookcase spine) up
 * into the draft: toward the nearer gutter and up it on wide screens, straight up with a sway
 * on phones. It burns after a short climb, so the page turns to stardust on screen.
 */
export function risePath(s: PageSnapshot, from: Vec, rng: () => number): DraftPath {
  const W = s.viewport.w;
  const phone = s.mode === "phone" || s.mode === "landscape-short";
  const sway = (rng() - 0.5) * 2;
  const climb = phone ? 360 : 520;
  const pts: Vec[] = [{ x: from.x, y: from.y }];
  if (phone) {
    for (let i = 1; i <= 5; i++) pts.push({ x: clamp(from.x + Math.sin(i * 1.3 + sway * 3) * W * 0.18, 8, W - 8), y: from.y - (climb * i) / 5 });
  } else {
    const left = from.x < W / 2;
    const g = left ? s.gutters.left : s.gutters.right;
    const gx = left ? g * 0.5 : W - g * 0.5;
    pts.push({ x: lerp(from.x, gx, 0.35), y: from.y - 60 - rng() * 30 });
    pts.push({ x: lerp(from.x, gx, 0.85), y: from.y - 170 });
    pts.push({ x: gx + sway * g * 0.2, y: from.y - 320 });
    pts.push({ x: gx - sway * g * 0.15, y: from.y - climb });
    pts.push({ x: gx, y: from.y - climb - 260 });
  }
  const lut = buildWindLut(pts);
  const burnAt = clamp((phone ? 120 : 230) / lut.length, 0.08, 1 - BURN_RUN / lut.length);
  return { lut, burnAt, doc: true };
}

/** Point at arc share s along a LUT. */
export function lutAt(lut: WindLut, s: number, out: Vec): Vec {
  const f = clamp(s, 0, 1) * (lut.x.length - 1);
  const i = Math.min(lut.x.length - 2, Math.floor(f));
  const t = f - i;
  out.x = lerp(lut.x[i], lut.x[i + 1], t);
  out.y = lerp(lut.y[i], lut.y[i + 1], t);
  return out;
}

/**
 * One page's flight in isolation (for the Monte Carlo test and the still): whether it burns
 * through before its path ends. Pages that burn through become stars.
 */
export function pageBecomesStar(path: DraftPath, speed: number, life: number, startS: number, startAge: number, dt = 1 / 30): boolean {
  let s = startS;
  let age = startAge;
  let zoneAge: number | null = s >= path.burnAt ? age : null;
  const out: PageLife = { opacity: 0, burn: 0 };
  for (let guard = 0; guard < 20000; guard++) {
    age += dt;
    s += (speed * dt) / path.lut.length;
    if (zoneAge === null && s >= path.burnAt) zoneAge = age;
    pageLifecycle(age, life, out, zoneAge);
    if (out.burn >= 1) return true;
    if (s >= 1 || age >= life) return false;
  }
  return false;
}

/* ------------------------------------------------------------------ volumes */

export interface Orbit {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Seconds per orbit (30-60 s). */
  period: number;
  phase: number;
  /** Cover beat rate in Hz. */
  flap: number;
}

/** Orbits through the top strip and the gutters (spec 3.1 layer 7). */
export function volumeOrbits(s: PageSnapshot, hall: Hall, rng: () => number): Orbit[] {
  const n = volumeCount(s.mode);
  const W = s.viewport.w;
  const H = s.viewport.h;
  const out: Orbit[] = [];
  for (let i = 0; i < n; i++) {
    const base = { period: 30 + rng() * 30, phase: rng() * Math.PI * 2, flap: 0.5 + rng() * 0.4 };
    const strip = s.mode === "phone" || s.mode === "landscape-short" || i % 3 === 2;
    if (strip) {
      out.push({ ...base, cx: W * (0.3 + rng() * 0.4), cy: hall.band * 0.22, rx: W * (0.3 + rng() * 0.15), ry: Math.max(6, hall.band * 0.12) });
    } else {
      const g = i % 2 === 0 ? s.gutters.left : s.gutters.right;
      out.push({ ...base, cx: i % 2 === 0 ? g * 0.5 : W - g * 0.5, cy: H * (0.42 + rng() * 0.2), rx: Math.max(14, g * 0.3), ry: H * (0.28 + rng() * 0.1) });
    }
  }
  return out;
}

/** Position on an orbit at time t, with its heading (radians). */
export function orbitAt(o: Orbit, t: number, out: Vec): number {
  const a = o.phase + (t / o.period) * Math.PI * 2;
  out.x = o.cx + Math.cos(a) * o.rx;
  out.y = o.cy + Math.sin(a) * o.ry;
  return Math.atan2(Math.cos(a) * o.ry, -Math.sin(a) * o.rx);
}

/* ------------------------------------------------------------------ windows */

export interface Tome {
  slug: string;
  kind: CardInfo["kind"];
  x: number;
  w: number;
  h: number;
  /** Ribbon length 0..1 (--card-read). */
  read: number;
  finished: boolean;
  resume: boolean;
  accent: string;
}

export interface StageShelf {
  plank: Rect;
  tomes: Tome[];
  /** The binding press with the unbound folios, when any card is upcoming. */
  press: Rect | null;
  /** The reading candle beside the resume tome. */
  candle: Vec | null;
}

/**
 * The stage: a short shelf in the hit rect (window-canvas px) with one tome per open or locked
 * card and the upcoming cards as folios on a binding press at its end.
 */
export function stageShelf(cards: readonly CardInfo[], hit: Rect, resume: string | null): StageShelf {
  const plankH = Math.max(6, Math.round(hit.h * 0.09));
  const plankY = Math.round(hit.y + hit.h * 0.86);
  const bound = cards.filter((c) => c.kind !== "upcoming");
  const loose = cards.filter((c) => c.kind === "upcoming");
  const pressW = loose.length ? Math.min(hit.w * 0.28, hit.h * 0.9) : 0;
  const maxH = plankY - hit.y - 4;
  const pressGap = loose.length ? clamp(maxH * 0.3, 16, 60) : 0;
  const room = hit.w * 0.9 - pressW - pressGap;
  const tw = clamp(Math.min(room / Math.max(1, bound.length) - 8, maxH * 0.34), 9, 56);
  const widths = bound.map((_, i) => Math.round(tw * (0.9 + ((i * 7) % 5) * 0.06)));
  const gap = Math.max(4, Math.round(tw * 0.22));
  const tomesW = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1);
  // The group sits centred on a plank sized to it, so the shelf has no empty run.
  const content = tomesW + pressGap + pressW;
  const x0 = hit.x + Math.max(0, (hit.w - content) / 2);
  const margin = Math.min(60, x0 - hit.x);
  const plank: Rect = { x: x0 - margin, y: plankY, w: content + margin * 2, h: plankH };
  const tomes: Tome[] = [];
  let x = x0;
  bound.forEach((c, i) => {
    const h = Math.round(maxH * (0.74 + ((fnv1a(c.slug) % 17) / 17) * 0.22));
    tomes.push({ slug: c.slug, kind: c.kind, x, w: widths[i], h, read: clamp(c.read ?? 0, 0, 1), finished: c.finished, resume: c.slug === resume, accent: c.accent });
    x += widths[i] + gap;
  });
  const resumeTome = tomes.find((t) => t.resume);
  return {
    plank,
    tomes,
    press: loose.length ? { x: x0 + tomesW + pressGap, y: plankY - Math.round(maxH * 0.42), w: pressW, h: Math.round(maxH * 0.42) } : null,
    candle: resumeTome ? { x: resumeTome.x + resumeTome.w + Math.max(3, gap / 2), y: plankY } : null,
  };
}

/** The lectern's grimoire inside the mid hit rect (window-canvas px). */
export function lecternBook(hit: Rect): BookPlacement {
  const w = Math.min(hit.w * 0.96, hit.h * 1.7);
  return { x: hit.x + hit.w / 2, y: hit.y + hit.h * 0.66, w, depth: w * 0.36, lift: w * 0.24 };
}

/** Pages a scroll of `dy` px turns while the mid window is visible: one per 220 px. */
export const SCROLL_TURN_PX = 220;

/**
 * Pool slot for a new page: a free slot (or a new one while the pool has room); an ambient page
 * only while fewer than `ambient` ambient pages fly. A burst or ritual page never fails: with
 * the pool full it recycles the oldest page, an ambient one first. -1 when refused.
 */
export function slotFor(pages: readonly { active: boolean; reserved: boolean; age: number }[], pool: number, ambient: number, reserved: boolean): number {
  let free = -1;
  let ambientLive = 0;
  let live = 0;
  pages.forEach((p, i) => {
    if (!p.active) {
      if (free < 0) free = i;
      return;
    }
    live++;
    if (!p.reserved) ambientLive++;
  });
  if (!reserved && ambientLive >= ambient) return -1;
  if (live < pool) return free >= 0 ? free : pages.length < pool ? pages.length : -1;
  if (!reserved) return -1;
  let oldest = -1;
  pages.forEach((p, i) => {
    if (!p.active) return;
    const o = oldest < 0 ? null : pages[oldest];
    if (!o || (o.reserved && !p.reserved) || (o.reserved === p.reserved && p.age > o.age)) oldest = i;
  });
  return oldest;
}
