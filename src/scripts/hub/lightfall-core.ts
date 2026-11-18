// Layout and motion maths of the constellation hub scene ("lightfall"): three gold-silk
// ribbons routed through the page's open corridors, their twist, springs and ripples, the
// star net, the reading figures, the suspension threads and the loom. No DOM here, so
// everything can be unit tested in Node.

import { createRng } from "../_shared/scene-runtime";
import { TAU, buildWindLut, clamp, fnv1a, lerp, rectDistance, smoothstep } from "./world/geom";
import type { CardInfo, HubMode, PageSnapshot, Rect, Vec } from "./world/types";

export const SHOOTING_STAR_MIN_S = 5;
export const SHOOTING_STAR_MAX_S = 9;
export const RIPPLE_LIFE_S = 2.4;
/** How fast a wave runs along a ribbon, px/s. */
export const RIPPLE_SPEED = 380;
/** The source of the light moves at this share of the scroll (M6). */
export const SOURCE_PARALLAX = 0.4;
/** Distance between route samples, px. */
export const RIBBON_STEP = 9;
/** Distance kept between the light and any text or card, px. */
export const EDGE = 4;
/** Height of the CSS thread stub above each card's knot (wrapper::before). */
export const STUB_PX = 26;
/** The canvas thread fades out over its last px, where the CSS stub fades in. */
export const THREAD_FADE_PX = 24;
/** Locked cards: the canvas thread ends this much higher and frays. */
export const CUT_PX = 30;
export const LOOM_COLS = 64;
export const LOOM_ROWS = 12;
/** Warps per empty section kept for each upcoming novel. */
export const LOOM_EMPTY = 8;
/** Speed range of the gold dust falling along a ribbon, px/s (positive is downward). */
export const DUST_SPEED: readonly [number, number] = [16, 48];
/** Speed of a light pulse running down a ribbon, px/s. */
export const PULSE_SPEED = 300;

/* ---------------------------------------------------------------- routing */

export interface RibbonSpec {
  /** Control points of the resting centreline in document px, from above the page to the horizon. */
  points: Vec[];
  /** Widest half-width the ribbon may open to. */
  width: number;
  /** Largest sideways sway. */
  sway: number;
  /** Route length of one full twist, px. */
  lambda: number;
  /** Speed at which the folds fall down the ribbon, px/s (positive is downward). */
  fall: number;
  phase: number;
  /** Document y range the ribbon passes behind the hero and the windows without being drawn. */
  hide: [number, number] | null;
  /** Route length over which the end fades out completely (default: a 30 px fade to 40 %). */
  tail?: number;
}

export interface LightfallLayout {
  mode: HubMode;
  width: number;
  height: number;
  compact: boolean;
  apex: Vec;
  /** Document y where the source parallax has blended back to the page's own scroll. */
  pivot: number;
  /** Height of the clear strip above the top bar. */
  topClear: number;
  /** Document y of the horizon in the ground window. */
  horizon: number;
  ribbons: RibbonSpec[];
  maxNodes: number;
  maxDust: number;
  linkDistance: number;
  repelRadius: number;
}

const area = (r: Rect) => r.w > 0 && r.h > 0;
const same = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

/** Text, controls and opaque panels the light keeps clear of (the hit rects sit inside windows). */
export function obstacles(s: PageSnapshot): Rect[] {
  const hits = [s.windows.stageHit, s.windows.midHit];
  return [...s.cover, ...s.holes.filter((h) => !hits.some((r) => same(r, h)))].filter(area);
}

/** Distance from a point to the nearest obstacle; the screen edges are not obstacles. */
export function clearanceAt(obs: readonly Rect[], x: number, y: number): number {
  let best = Infinity;
  for (const r of obs) best = Math.min(best, rectDistance(x, y, r));
  return best;
}

/** Height of the open strip above the top bar. */
export function topClearance(s: PageSnapshot): number {
  let top = s.topBand.h;
  for (const r of obstacles(s)) if (r.y < s.topBand.h) top = Math.min(top, r.y);
  return Math.max(0, top);
}

/** First y below which an obstacle spans x, scanning down from the top band. */
function blockedFrom(obs: readonly Rect[], x: number, below: number): number {
  let y = Infinity;
  for (const r of obs) if (r.y >= below && x >= r.x - 10 && x <= r.x + r.w + 10) y = Math.min(y, r.y);
  return y;
}

export function computeLayout(s: PageSnapshot): LightfallLayout {
  const W = s.viewport.w;
  const H = s.viewport.h;
  const mode = s.mode;
  const phone = mode === "phone";
  const compact = phone || mode === "landscape-short";
  const obs = obstacles(s);
  const topClear = topClearance(s);
  const rows = s.rows;
  const firstRow = rows.length ? rows[0].top : s.topBand.h + 200;
  const lastRow = rows.length ? rows[rows.length - 1].bottom : firstRow;
  const ground = s.windows.ground;
  const footerText = s.holes.filter((r) => area(ground) && r.y > ground.y && r.y < ground.y + ground.h).reduce((y, r) => Math.min(y, r.y), Infinity);
  const sceneTop = area(ground) ? ground.y : lastRow + 60;
  const sceneH = Number.isFinite(footerText) ? Math.max(60, footerText - sceneTop) : 180;
  const horizon = sceneTop + sceneH * 0.5;

  const gL = s.gutters.left;
  const gR = s.gutters.right;
  const side = (g: number) => (mode === "wide" ? g * 0.62 : compact ? g * 0.3 : g * 0.5);
  const xl = side(gL);
  const xr = W - side(gR);
  const gap = s.colGaps[0];
  const gx = gap ? gap.x + gap.w / 2 : W / 2;
  const apex = { x: lerp(W / 2, gx, 0.6), y: -H * 0.07 };
  // The side ribbons sweep out from the zenith through the open strip above the top bar, then turn
  // broadly down into the gutters, so the arc over the hero stays in view at scroll 0.
  const open = topClear >= 36;
  const arcY = open ? Math.max(14, topClear * 0.36) : Math.max(3, topClear * 0.5);
  const turnY = open ? topClear - 4 : Math.max(4, topClear * 0.6);
  const entry = Math.max(turnY + 120, topClear + 104);
  const sideHalf = (g: number) =>
    mode === "wide" ? clamp(g * 0.16, 30, 120) : compact ? 6 : mode === "narrow" ? clamp(g * 0.26, 10, 26) : clamp(g * 0.26, 14, 60);
  const sideSway = (g: number) => (compact ? 3 : clamp(g * 0.08, 3, 40));

  const sideRoute = (dir: -1 | 1): Vec[] => {
    const x0 = dir < 0 ? xl : xr;
    const pts: Vec[] = [
      { x: apex.x + dir * W * 0.02, y: apex.y },
      { x: lerp(apex.x, x0, 0.45), y: arcY },
      { x: lerp(x0, dir < 0 ? gL : W - gR, 0.6), y: turnY },
      { x: x0, y: entry },
    ];
    let x = x0;
    let at = entry;
    if (phone) {
      // Braid: the two side ribbons swap edges in every narrow band between card rows.
      for (const b of s.bands) {
        if (b.h > 120 || b.y < at + 80) continue;
        const to = x === xl ? xr : xl;
        const sgn = to > x ? 1 : -1;
        pts.push({ x, y: b.y - 64 }, { x, y: b.y - 30 }, { x: x + sgn * 6, y: b.y + 5 }, { x: W / 2, y: b.y + b.h / 2 });
        pts.push({ x: to - sgn * 6, y: b.y + b.h - 5 }, { x: to, y: b.y + b.h + 30 }, { x: to, y: b.y + b.h + 64 });
        x = to;
        at = b.y + b.h + 64;
      }
    }
    // A gentle lean inward over the open ground, landing on the horizon.
    const land = lerp(x, W / 2, compact ? 0.08 : 0.14);
    pts.push({ x, y: Math.max(at + 40, sceneTop - 60) }, { x: land, y: horizon });
    return pts;
  };

  const ribbons: RibbonSpec[] = [
    { points: sideRoute(-1), width: sideHalf(gL), sway: sideSway(gL), lambda: 600, fall: 40, phase: 2.1, hide: null },
    { points: sideRoute(1), width: sideHalf(gR) * 0.9, sway: sideSway(gR), lambda: 540, fall: 46, phase: 0.4, hide: null },
  ];
  // With a column gap the centre ribbon wells up out of the star pool (under its centre fall) and
  // runs down the gap to the horizon; without one it is only a short wisp of light at the zenith.
  const stage = s.windows.stage;
  let centre: Vec[];
  let hide: [number, number] | null = null;
  let tail: number | undefined;
  if (gap && area(stage)) {
    // Even spacing down the gap keeps the spline from bulging back up out of the pool.
    const y0 = stage.y + stage.h * 0.6;
    const y1 = firstRow - 30;
    const step = Math.max(80, y1 - y0);
    centre = [{ x: gx, y: y0 }];
    for (let y = y1; y < lastRow + 20; y += step) centre.push({ x: gx, y });
    centre.push({ x: gx, y: lastRow + 20 }, { x: W / 2, y: horizon });
  } else if (gap) {
    centre = [apex, { x: gx, y: Math.min(topClear * 0.5, 40) }, { x: gx, y: firstRow - 30 }, { x: gx, y: lastRow + 20 }, { x: W / 2, y: horizon }];
    const from = Math.max(topClear - EDGE, blockedFrom(obs, gx, 0) - 12);
    if (firstRow - 24 > from) hide = [from, firstRow - 24];
  } else {
    centre = [apex, { x: gx, y: Math.max(4, topClear * 0.6) }];
    tail = Math.max(30, -apex.y);
  }
  ribbons.push({ points: centre, width: compact ? 6 : 9, sway: 3, lambda: 420, fall: 52, phase: 4.2, hide, tail });

  return {
    mode,
    width: W,
    height: H,
    compact,
    apex,
    pivot: Math.max(s.topBand.h, topClear + 60),
    topClear,
    horizon,
    ribbons,
    ...netBudget(W, H, compact),
  };
}

/** Star-net and dust budgets for a viewport. */
export function netBudget(w: number, h: number, compact: boolean) {
  const pix = w * h;
  return {
    maxNodes: Math.round(clamp(pix / 16_000, compact ? 18 : 36, 96)),
    maxDust: Math.round(clamp(pix / 6_000, compact ? 90 : 140, 260)),
    linkDistance: compact ? 84 : 110,
    repelRadius: compact ? 100 : 140,
  };
}

/** A ribbon's resting centreline sampled every RIBBON_STEP px, in document px. */
export interface RibbonPath {
  n: number;
  x: Float32Array;
  y: Float32Array;
  tx: Float32Array;
  ty: Float32Array;
  /** Arc length from the source. */
  d: Float32Array;
  length: number;
  /** Half-width the corridor allows. */
  half: Float32Array;
  /** Sideways room left for sway, lean and waves after the half-width. */
  room: Float32Array;
  /** Visibility at rest: 0 behind text, panels and the hidden range, 1 in open corridors. */
  fade: Float32Array;
}

export function sampleRibbon(spec: RibbonSpec, obs: readonly Rect[]): RibbonPath {
  let chord = 0;
  for (let i = 1; i < spec.points.length; i++) chord += Math.hypot(spec.points[i].x - spec.points[i - 1].x, spec.points[i].y - spec.points[i - 1].y);
  const n = Math.round(clamp((chord * 1.08) / RIBBON_STEP, 24, 1400));
  const lut = buildWindLut(spec.points, n);
  const d = new Float32Array(n);
  const half = new Float32Array(n);
  const room = new Float32Array(n);
  const fade = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    d[i] = (i / (n - 1)) * lut.length;
    const free = clearanceAt(obs, lut.x[i], lut.y[i]) - EDGE;
    half[i] = clamp(free * 0.55, 0.6, spec.width);
    room[i] = Math.max(0, free - half[i]);
    const end = spec.tail ? smoothstep(lut.length - spec.tail, lut.length, d[i]) : smoothstep(lut.length - 30, lut.length, d[i]) * 0.6;
    let f = smoothstep(1.5, 9, free) * smoothstep(0, 40, d[i]) * (1 - end);
    if (spec.hide) {
      const [a, b] = spec.hide;
      f *= 1 - smoothstep(a - 16, a, lut.y[i]) * (1 - smoothstep(b, b + 30, lut.y[i]));
    }
    fade[i] = f;
  }
  return { n, x: lut.x, y: lut.y, tx: lut.tx, ty: lut.ty, d, length: lut.length, half, room, fade };
}

/** Viewport y of a document point: the source rides at SOURCE_PARALLAX and blends to the page by the pivot. */
export function sourceY(L: Pick<LightfallLayout, "apex" | "pivot">, yDoc: number, scrollY: number): number {
  const p = SOURCE_PARALLAX + (1 - SOURCE_PARALLAX) * clamp((yDoc - L.apex.y) / (L.pivot - L.apex.y), 0, 1);
  return yDoc - p * scrollY;
}

/** Keeps the sum of sway, lean, waves and swirl inside the corridor. */
export function clampLateral(value: number, room: number): number {
  return clamp(value, -room, room);
}

/* ---------------------------------------------------------------- twist */

/**
 * The twist angle at route length d (px) and time t. Every term moves toward larger d, so the
 * folds roll down the ribbon; the slow terms keep the folds at uneven distances.
 */
export function twistAngle(spec: Pick<RibbonSpec, "lambda" | "fall" | "phase">, d: number, t: number, drift: number): number {
  return (
    ((d - spec.fall * t) / spec.lambda) * TAU +
    spec.phase +
    Math.sin(d / (spec.lambda * 0.55) + spec.phase - t * 0.11) * 1.5 +
    Math.sin(d / (spec.lambda * 0.26) - t * 0.17 + spec.phase * 2) * 0.45 +
    drift * 1.2
  );
}

/** How many silk threads a ribbon of this half-width is drawn with at a quality tier. */
export function threadCount(half: number, tier: 0 | 1 | 2): number {
  if (tier === 2) return 1;
  const n = Math.round(clamp(half * 0.55, 8, 32));
  return tier === 1 ? Math.min(n, 24) : n;
}

export interface TwistState {
  /** Visible thickness, never below a thin sliver. */
  thickness: number;
  /** How close this point is to a fold, 0..1: folds catch the light. */
  fold: number;
}

export function twistAt(theta: number, out: TwistState): TwistState {
  const a = Math.abs(Math.cos(theta));
  out.thickness = 0.06 + 0.94 * a;
  out.fold = Math.pow(1 - a, 6);
  return out;
}

/** Each thread's twist runs ahead of or behind the centre by this much across the width. */
export const THREAD_LAG = 0.62;

/** Mean of a * sin(THREAD_LAG * a) over the width: where the lines cross at a fold, off-centre. */
export const FOLD_OFFSET = 0.2;

/* ---------------------------------------------------------------- springs and waves */

export interface Spring {
  x: number;
  v: number;
}

const SPRING_STIFFNESS = 18;
const SPRING_DAMPING = 4.5;

/** One step of the spring that bends a ribbon; with target 0 it settles back. */
export function springBend(spring: Spring, target: number, dt: number): void {
  spring.v += (target - spring.x) * SPRING_STIFFNESS * dt;
  spring.v *= Math.exp(-SPRING_DAMPING * dt);
  spring.x += spring.v * dt;
}

/** A bend at 0..1 along a ribbon, read from springs placed evenly along it. */
export function sampleSprings(springs: readonly Spring[], s: number): number {
  const f = clamp(s, 0, 1) * (springs.length - 1);
  const i = Math.min(springs.length - 2, Math.floor(f));
  const t = f - i;
  const u = t * t * (3 - 2 * t);
  return springs[i].x + (springs[i + 1].x - springs[i].x) * u;
}

export interface Ripple {
  active: boolean;
  ribbon: number;
  /** Route length where the wave started, px. */
  d: number;
  age: number;
  strength: number;
}

export function createRipplePool(size: number): Ripple[] {
  return Array.from({ length: size }, () => ({ active: false, ribbon: 0, d: 0, age: 0, strength: 0 }));
}

/** Starts a wave at route length d. When every slot is busy the oldest wave gives up its slot. */
export function spawnRipple(pool: Ripple[], ribbon: number, d: number, strength: number): Ripple {
  let slot = pool.find((r) => !r.active);
  if (!slot) slot = pool.reduce((oldest, r) => (r.age > oldest.age ? r : oldest), pool[0]);
  slot.active = true;
  slot.ribbon = ribbon;
  slot.d = d;
  slot.age = 0;
  slot.strength = strength;
  return slot;
}

export function stepRipples(pool: Ripple[], dt: number): void {
  for (const r of pool) {
    if (!r.active) continue;
    r.age += dt;
    if (r.age >= RIPPLE_LIFE_S) r.active = false;
  }
}

/** Two bumps running out from the tap, up and down the ribbon, fading as they go. */
export function rippleAt(pool: readonly Ripple[], ribbon: number, d: number): number {
  let sum = 0;
  for (const r of pool) {
    if (!r.active || r.ribbon !== ribbon) continue;
    const travel = r.age * RIPPLE_SPEED;
    const fade = 1 - r.age / RIPPLE_LIFE_S;
    const up = (d - (r.d - travel)) / 46;
    const down = (d - (r.d + travel)) / 46;
    sum += r.strength * fade * (Math.exp(-up * up) + Math.exp(-down * down));
  }
  return sum;
}

/** Strength of a tap's wave on a ribbon this far away: 1 at the ribbon, 0 from `reach` on. */
export function tapStrength(distance: number, reach = 520): number {
  const k = 1 - clamp(distance / reach, 0, 1);
  return k * k;
}

export function nextShootingStarDelay(rng: () => number): number {
  return SHOOTING_STAR_MIN_S + rng() * (SHOOTING_STAR_MAX_S - SHOOTING_STAR_MIN_S);
}

/* ---------------------------------------------------------------- star net */

/** Reusable buffers for finding nearby pairs of nodes without allocating each frame. */
export interface PairGrid {
  head: Int32Array;
  next: Int32Array;
  cols: number;
  rows: number;
  cell: number;
}

export function createPairGrid(width: number, height: number, radius: number, capacity: number): PairGrid {
  const cell = Math.max(1, radius);
  const cols = Math.ceil(width / cell) + 1;
  const rows = Math.ceil(height / cell) + 1;
  return { head: new Int32Array(cols * rows), next: new Int32Array(capacity), cols, rows, cell };
}

/**
 * Calls `visit` once for each pair closer than `radius`. Each node only looks at its own cell and
 * four forward neighbours, so the work grows with local density rather than with the square of
 * the node count.
 */
export function forEachPairWithin(
  grid: PairGrid,
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  count: number,
  radius: number,
  visit: (i: number, j: number, d2: number) => void,
): void {
  const { head, next, cols, rows, cell } = grid;
  head.fill(-1);
  for (let i = 0; i < count; i++) {
    const cx = clamp(Math.floor(xs[i] / cell), 0, cols - 1);
    const cy = clamp(Math.floor(ys[i] / cell), 0, rows - 1);
    const c = cy * cols + cx;
    next[i] = head[c];
    head[c] = i;
  }
  const r2 = radius * radius;
  const check = (a: number, b: number) => {
    const dx = xs[a] - xs[b];
    const dy = ys[a] - ys[b];
    const d2 = dx * dx + dy * dy;
    if (d2 < r2) visit(a, b, d2);
  };
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      for (let a = head[cy * cols + cx]; a !== -1; a = next[a]) {
        for (let b = next[a]; b !== -1; b = next[b]) check(a, b);
        if (cx + 1 < cols) for (let b = head[cy * cols + cx + 1]; b !== -1; b = next[b]) check(a, b);
        if (cy + 1 < rows) {
          if (cx > 0) for (let b = head[(cy + 1) * cols + cx - 1]; b !== -1; b = next[b]) check(a, b);
          for (let b = head[(cy + 1) * cols + cx]; b !== -1; b = next[b]) check(a, b);
          if (cx + 1 < cols) for (let b = head[(cy + 1) * cols + cx + 1]; b !== -1; b = next[b]) check(a, b);
        }
      }
    }
  }
}

/** Alpha of a link between two nodes d2 apart (squared): eases to exactly 0 at the cut-off. */
export function linkAlpha(d2: number, r2: number): number {
  const k = 1 - clamp(d2 / r2, 0, 1);
  return k * k;
}

export interface Nodes {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
  phase: Float32Array;
  flash: Float32Array;
  /** Fades a node in after it is placed, so its links never pop. */
  life: Float32Array;
  count: number;
}

export function createNodes(capacity: number): Nodes {
  const f = () => new Float32Array(capacity);
  return { x: f(), y: f(), vx: f(), vy: f(), size: f(), alpha: f(), phase: f(), flash: f(), life: f(), count: 0 };
}

/** Places node i at a fresh point inside w x h, preferring points `open` accepts. */
export function seedNode(nodes: Nodes, i: number, rng: () => number, w: number, h: number, open: (x: number, y: number) => boolean = () => true): void {
  let x = rng() * w;
  let y = rng() * h;
  for (let k = 0; k < 6 && !open(x, y); k++) {
    x = rng() * w;
    y = rng() * h;
  }
  nodes.x[i] = x;
  nodes.y[i] = y;
  nodes.vx[i] = (rng() - 0.5) * 18;
  nodes.vy[i] = (rng() - 0.5) * 18;
  nodes.size[i] = 2.6 + rng() * 4.6;
  nodes.alpha[i] = 0.22 + rng() * 0.46;
  nodes.phase[i] = rng() * TAU;
  nodes.flash[i] = 0;
  nodes.life[i] = 0;
}

/** Resizes the net: every node gets a seeded place, kept ones are pulled inside the new bounds. */
export function ensureNodes(nodes: Nodes, count: number, rng: () => number, w: number, h: number, open?: (x: number, y: number) => boolean): void {
  const n = Math.min(count, nodes.x.length);
  for (let i = 0; i < n; i++) {
    if (i < nodes.count && nodes.size[i] > 0) {
      nodes.x[i] = Math.min(nodes.x[i], w);
      nodes.y[i] = Math.min(nodes.y[i], h);
    } else {
      seedNode(nodes, i, rng, w, h, open);
    }
  }
  nodes.count = n;
}

/* ---------------------------------------------------------------- reading figures */

export interface Figure {
  /** Star positions in a unit box. */
  stars: Vec[];
  /** Lines between stars, as index pairs. */
  edges: [number, number][];
}

/** A small constellation per novel, the same on every visit. */
export function figurePattern(slug: string): Figure {
  const rng = createRng(fnv1a(`figure:${slug}`));
  const count = 7 + Math.floor(rng() * 6);
  const stars: Vec[] = [];
  let x = 0.08 + rng() * 0.2;
  let y = 0.3 + rng() * 0.4;
  for (let i = 0; i < count; i++) {
    stars.push({ x: clamp(x, 0.04, 0.96), y: clamp(y, 0.06, 0.94) });
    x += 0.06 + rng() * 0.11;
    y += (rng() - 0.5) * 0.45;
    if (y < 0.1 || y > 0.9) y = clamp(1 - y, 0.12, 0.88);
  }
  const edges: [number, number][] = [];
  for (let i = 1; i < count; i++) edges.push([i - 1, i]);
  const branch = 2 + Math.floor(rng() * (count - 3));
  stars.push({ x: stars[branch].x + 0.03, y: clamp(stars[branch].y + (stars[branch].y > 0.5 ? -0.3 : 0.3), 0.06, 0.94) });
  edges.push([branch, stars.length - 1]);
  return { stars, edges };
}

/** Stars lit for a reading fraction: none before a start, at least one after it, all when finished. */
export function litCount(read: number | null, finished: boolean, count: number): number {
  if (finished) return count;
  if (read === null || !(read > 0)) return 0;
  return clamp(Math.round(read * count), 1, count);
}

/** Who gets a sky figure first: novels in progress, then finished, unread, locked, upcoming. */
export function figureOrder(cards: readonly CardInfo[]): CardInfo[] {
  const rank = (c: CardInfo) =>
    c.kind === "upcoming" ? 5 : c.kind === "locked" ? 4 : c.finished ? 2 : (c.read ?? 0) > 0 ? 1 : 3;
  return [...cards].sort((a, b) => rank(a) - rank(b) || (b.read ?? 0) - (a.read ?? 0) || a.index - b.index);
}

/**
 * Sky slots for figures at scroll 0: the strip above the top bar between the arcs and, on wide
 * screens, the outer gutters. Slots stay clear of every obstacle and the zenith strand.
 */
export function figureSlots(s: PageSnapshot, L: LightfallLayout): Rect[] {
  const obs = obstacles(s);
  const slots: Rect[] = [];
  const W = L.width;
  const free = (r: Rect) => obs.every((o) => r.x + r.w + 8 < o.x || o.x + o.w + 8 < r.x || r.y + r.h + 8 < o.y || o.y + o.h + 8 < r.y);
  // Clear of the side ribbons' arcs as well, so a figure never sits on the light.
  const arcs = L.ribbons.slice(0, 2).map((spec) => sampleRibbon(spec, obs));
  const offArc = (r: Rect) =>
    arcs.every((p) => {
      for (let i = 0; i < p.n; i++) {
        if (p.fade[i] < 0.3 || p.y[i] < -4) continue;
        const pad = p.half[i] * 0.6 + 8;
        if (p.x[i] > r.x - pad && p.x[i] < r.x + r.w + pad && p.y[i] > r.y - pad && p.y[i] < r.y + r.h + pad) return false;
      }
      return true;
    });
  const y0 = 16;
  const h = L.topClear - y0 - 12;
  if (h >= 28 && !L.compact) {
    const w = clamp(h * 2.6, 90, 140);
    const left = W * 0.21;
    const right = W * 0.79;
    // Centred under the zenith, where the two arcs rise out of view, then outward (the first
    // slot, for the novel in progress, is the centre one).
    for (let k = 0; k < 12; k++) {
      const x = L.apex.x - w / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (w + 18);
      if (x < left || x + w > right) continue;
      const r = { x, y: y0, w, h };
      if (free(r) && offArc(r)) slots.push(r);
    }
  }
  if (L.mode === "wide") {
    for (const outer of [s.gutters.left * 0.62 - 150, W - s.gutters.right * 0.62 + 150]) {
      const w = 130;
      const x = outer < W / 2 ? Math.max(16, outer - w) : outer;
      if (x + w > W - 8 || outer - w < 8) continue;
      for (let y = L.topClear + 40; y + 80 < L.height * 0.85; y += 170) {
        const r = { x, y, w, h: 80 };
        if (free(r) && offArc(r)) slots.push(r);
      }
    }
  }
  return slots;
}

/* ---------------------------------------------------------------- suspension threads */

export interface ThreadAnchor {
  ribbon: number;
  index: number;
}

/** The ribbon sample a card's thread hangs from: visible, above the thread's end and near it. */
export function threadAnchor(paths: readonly RibbonPath[], bx: number, by: number, reach = 460): ThreadAnchor | null {
  let best: ThreadAnchor | null = null;
  let bestScore = Infinity;
  paths.forEach((p, ribbon) => {
    for (let i = 0; i < p.n; i++) {
      if (p.fade[i] < 0.5 || p.y[i] > by - 12) continue;
      const dx = p.x[i] - bx;
      const dy = by - p.y[i];
      const dist = Math.hypot(dx, dy);
      if (dist > reach || dy > 240) continue;
      // Prefer anchors above the card over long sideways spans.
      const score = dist + Math.abs(dx) * 0.35;
      if (score < bestScore) {
        bestScore = score;
        best = { ribbon, index: i };
      }
    }
  });
  return best;
}

/**
 * Sag of a thread hanging `drop` px down over `span` px: slack at rest, taut when tugged (tension 1),
 * never so slack that it would dip below its end and climb back up to it.
 */
export function threadSag(span: number, tension: number, drop = Infinity): number {
  return Math.min(span * 0.16 * (1 - clamp(tension, 0, 1)) + 2, Math.max(1, drop * 0.22));
}

/** A point along a hanging thread, t from the anchor (0) to its end (1). */
export function threadPoint(ax: number, ay: number, bx: number, by: number, sag: number, t: number, out: Vec): Vec {
  out.x = lerp(ax, bx, t);
  out.y = lerp(ay, by, t) + sag * 4 * t * (1 - t);
  return out;
}

/* ---------------------------------------------------------------- loom */

export interface LoomRow {
  slug: string;
  accent: string;
}

/**
 * The tapestry derived from reading (never stored): each open novel weaves rows in proportion to
 * its progress, at least one once begun and all of its share when finished. Row 0 is the bottom.
 */
export function loomRows(cards: readonly CardInfo[], rows = LOOM_ROWS): LoomRow[] {
  const open = cards.filter((c) => c.kind === "open");
  if (!open.length) return [];
  const cap = Math.max(1, Math.floor(rows / open.length));
  const out: LoomRow[] = [];
  for (const c of open) {
    const woven = litCount(c.read, c.finished, cap);
    for (let i = 0; i < woven && out.length < rows; i++) out.push({ slug: c.slug, accent: c.accent });
  }
  return out;
}

/** Radius of a reading knot on the selvedge: grows with progress. */
export function knotRadius(read: number | null): number {
  return 2 + 4 * clamp(read ?? 0, 0, 1);
}

/** An accent toned toward the loom's gold, as "r,g,b". */
export function tone(hex: string, gold = 0.38, dim = 0.82): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const v = m ? Number.parseInt(m[1], 16) : 0xe0b46a;
  const mix = (c: number, g: number) => Math.round(lerp(c, g, gold) * dim);
  return `${mix((v >> 16) & 255, 224)},${mix((v >> 8) & 255, 180)},${mix(v & 255, 106)}`;
}

/* ---------------------------------------------------------------- ground reflection */

/**
 * Source row and alpha for reflection row n (0 at the horizon) of `rows`: the mirror reads the
 * dedicated unfaded buffer one to one (no stretch) and fades with depth.
 */
export function reflectionRow(n: number, rows: number, srcRows: number): { src: number; alpha: number } {
  return { src: Math.min(srcRows - 1, n), alpha: 0.85 * Math.pow(1 - clamp(n / rows, 0, 1), 1.3) };
}

/* ---------------------------------------------------------------- hero pool */

/**
 * Percentage of the hero pool box (the hero plus its side bleed) for the pool centre: between the
 * nearest ribbons crossing the hero on either side of the title, clamped to the title.
 */
export function heroPoolPercent(s: PageSnapshot, paths: readonly RibbonPath[]): number {
  const t = s.parts.title;
  const midY = t.y + t.h / 2;
  const cx = t.x + t.w / 2;
  let left = -Infinity;
  let right = Infinity;
  for (const p of paths) {
    for (let i = 0; i < p.n; i++) {
      if (p.fade[i] < 0.5 || Math.abs(p.y[i] - midY) > 40) continue;
      if (p.x[i] < cx) left = Math.max(left, p.x[i]);
      else right = Math.min(right, p.x[i]);
    }
  }
  if (!Number.isFinite(left)) left = s.shell.x;
  if (!Number.isFinite(right)) right = s.shell.x + s.shell.w;
  const bleed = clamp((s.viewport.w - s.shell.w) / 2 - 8, 0, 72);
  const box = { x: s.shell.x - bleed, w: s.shell.w + 2 * bleed };
  const x = clamp((left + right) / 2, t.x + t.w * 0.25, t.x + t.w * 0.6);
  return box.w > 0 ? clamp(((x - box.x) / box.w) * 100, 0, 100) : 50;
}
