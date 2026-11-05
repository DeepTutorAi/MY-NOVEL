// Layout and motion maths of the "lightfall" hub scene: three twisting ribbons of light
// that fall from one point above the page and part around the cards. No DOM here, so
// everything can be unit tested.

import { clamp, lerp, measureGutters, smoothstep } from "./grimoire-core";
import type { AvoidRect, Gutters, Vec } from "./grimoire-core";

export const RIBBON_SAMPLES = 96;
export const SHOOTING_STAR_MIN_S = 5;
export const SHOOTING_STAR_MAX_S = 9;
export const RIPPLE_LIFE_S = 2.4;

export interface RibbonSpec {
  /** Control points of the resting centreline, from above the screen to the horizon. */
  points: Vec[];
  /** Half-width at its widest, in CSS pixels. */
  width: number;
  /** Half-width while it crosses the band above the page's text. */
  topWidth: number;
  /** How far along the ribbon (0..1) it has come down into its gutter and may open out. */
  openAt: number;
  /** How far the centreline sways sideways. */
  sway: number;
  /** Full twists along the ribbon's length. */
  twists: number;
  phase: number;
  /** Twists per second travelling along the ribbon; the sign sets the direction. */
  speed: number;
}

export interface LightfallLayout {
  width: number;
  height: number;
  compact: boolean;
  gutters: Gutters;
  horizon: number;
  ribbons: RibbonSpec[];
  maxNodes: number;
  maxDust: number;
  linkDistance: number;
  repelRadius: number;
}

/** The middle of the gap between the first row of cards, or the screen's centre without one. */
export function cardGapX(width: number, avoid: readonly AvoidRect[]): number {
  const cards = avoid.filter((r) => r.soft && r.w > 40 && r.h > 40);
  if (cards.length === 0) return width * 0.5;
  const firstY = Math.min(...cards.map((r) => r.y));
  const row = cards.filter((r) => Math.abs(r.y - firstY) < 8).sort((a, b) => a.x - b.x);
  if (row.length < 2) return width * 0.5;
  return (row[0].x + row[0].w + row[1].x) / 2;
}

/** How far along a run of control points the point at `index` lies, by chord length. */
function chordFraction(points: readonly Vec[], index: number): number {
  let total = 0;
  let upTo = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (i === index) upTo = total;
  }
  return total > 0 ? upTo / total : 0;
}

export function computeLayout(width: number, height: number, avoid: readonly AvoidRect[] = []): LightfallLayout {
  const gutters = measureGutters(width, height, avoid);
  const compact = width < 820 || height < 500;
  const band = Math.max(gutters.top, 60);
  const horizon = Math.round(height * (compact ? 0.88 : 0.86));
  const clear = clamp(gutters.clear, 16, band * 0.5);
  const originY = -height * 0.08;
  const gapX = cardGapX(width, avoid);
  const originX = lerp(width * 0.5, gapX, 0.6);
  const edge = compact ? width * 0.02 : width * 0.045;
  const leftX = Math.max(gutters.left * 0.5, edge);
  const rightX = width - Math.max(gutters.right * 0.5, edge);
  const sideWidth = (g: number) => clamp(g * 0.3, compact ? 10 : 16, 120);
  const sideSway = (g: number) => clamp(g * 0.13, 3, 64);
  const topWidth = clamp(clear * 0.3, 5, 16);

  const right: RibbonSpec = {
    points: [
      { x: originX + width * 0.02, y: originY },
      { x: width * 0.7, y: clear * 0.36 },
      { x: lerp(width * 0.7, rightX, 0.82), y: clear * 0.7 },
      { x: rightX, y: band * 0.62 },
      { x: rightX + gutters.right * 0.1, y: height * 0.46 },
      { x: rightX - gutters.right * 0.08, y: height * 0.68 },
      { x: rightX, y: horizon },
    ],
    width: sideWidth(gutters.right),
    topWidth,
    openAt: 0,
    sway: sideSway(gutters.right),
    twists: 1.7,
    phase: 0.4,
    speed: 0.05,
  };
  const left: RibbonSpec = {
    points: [
      { x: originX - width * 0.02, y: originY },
      { x: width * 0.3, y: clear * 0.3 },
      { x: lerp(width * 0.3, leftX, 0.82), y: clear * 0.62 },
      { x: leftX, y: band * 0.66 },
      { x: leftX - gutters.left * 0.08, y: height * 0.5 },
      { x: leftX + gutters.left * 0.1, y: height * 0.7 },
      { x: leftX, y: horizon },
    ],
    width: sideWidth(gutters.left) * 0.86,
    topWidth,
    openAt: 0,
    sway: sideSway(gutters.left),
    twists: 2.05,
    phase: 2.1,
    speed: -0.042,
  };
  const centre: RibbonSpec = {
    points: [
      { x: originX, y: originY },
      { x: lerp(originX, gapX, 0.5), y: clear * 0.9 },
      { x: gapX, y: band * 0.6 },
      { x: gapX, y: band },
      { x: gapX, y: height * 0.6 },
      { x: gapX, y: horizon },
    ],
    width: clamp(width * 0.018, 9, 30),
    topWidth,
    openAt: 0,
    sway: clamp(width * 0.004, 1.5, 6),
    twists: 2.4,
    phase: 4.2,
    speed: 0.06,
  };
  right.openAt = chordFraction(right.points, 3);
  left.openAt = chordFraction(left.points, 3);

  const area = width * height;
  return {
    width,
    height,
    compact,
    gutters,
    horizon,
    ribbons: [left, right, centre],
    maxNodes: Math.round(clamp(area / 14_000, compact ? 18 : 40, 110)),
    maxDust: Math.round(clamp(area / 5_200, compact ? 120 : 160, 300)),
    linkDistance: compact ? 84 : 110,
    repelRadius: compact ? 100 : 140,
  };
}

/** Half-width along the ribbon: slim across the top of the page, opening out in its gutter. */
export function ribbonWidthAt(spec: RibbonSpec, s: number): number {
  const t = clamp(s, 0, 1);
  const open = spec.openAt > 0 ? smoothstep(spec.openAt * 0.72, spec.openAt * 1.2, t) : smoothstep(0, 0.2, t);
  return lerp(spec.topWidth, spec.width, open) * smoothstep(0, 0.05, t + 0.012) * (1 + 0.14 * t);
}

/**
 * The twist angle along a ribbon. The slow terms make the folds fall at uneven distances,
 * so a ribbon reads as loose cloth and not as a chain of equal beads.
 */
export function twistAngle(spec: RibbonSpec, s: number, t: number, drift: number): number {
  return (
    s * spec.twists * Math.PI * 2 +
    t * spec.speed * Math.PI * 2 +
    spec.phase +
    Math.sin(s * 4.1 + spec.phase + t * 0.11) * 1.5 +
    Math.sin(s * 9.3 - t * 0.17 + spec.phase * 2) * 0.45 +
    drift * 1.2
  );
}

/** How many silk threads a ribbon of this width is drawn with. */
export function threadCount(spec: RibbonSpec): number {
  return Math.round(clamp(spec.width * 0.55, 10, 44));
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

export interface Spring {
  x: number;
  v: number;
}

const SPRING_STIFFNESS = 18;
const SPRING_DAMPING = 4.5;

/** One step of the spring that bends a ribbon towards the pointer; with target 0 it settles back. */
export function springBend(spring: Spring, target: number, dt: number): void {
  spring.v += (target - spring.x) * SPRING_STIFFNESS * dt;
  spring.v *= Math.exp(-SPRING_DAMPING * dt);
  spring.x += spring.v * dt;
}

/** A bend or wave at 0..1 along a ribbon, read from a few springs placed evenly along it. */
export function sampleSprings(springs: readonly Spring[], s: number): number {
  const f = clamp(s, 0, 1) * (springs.length - 1);
  const i = Math.min(springs.length - 2, Math.floor(f));
  const t = f - i;
  const u = t * t * (3 - 2 * t);
  return springs[i].x + (springs[i + 1].x - springs[i].x) * u;
}

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
 * Calls `visit` once for each pair closer than `radius`. Each node only looks at its own
 * cell and four forward neighbours, so the work grows with local density rather than with
 * the square of the node count.
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

export interface Ripple {
  active: boolean;
  ribbon: number;
  s: number;
  age: number;
  strength: number;
}

export function createRipplePool(size: number): Ripple[] {
  return Array.from({ length: size }, () => ({ active: false, ribbon: 0, s: 0, age: 0, strength: 0 }));
}

/** Starts a wave at `s`. When every slot is busy the oldest wave gives up its slot. */
export function spawnRipple(pool: Ripple[], ribbon: number, s: number, strength: number): void {
  let slot = pool.find((r) => !r.active);
  if (!slot) slot = pool.reduce((oldest, r) => (r.age > oldest.age ? r : oldest), pool[0]);
  slot.active = true;
  slot.ribbon = ribbon;
  slot.s = s;
  slot.age = 0;
  slot.strength = strength;
}

export function stepRipples(pool: Ripple[], dt: number): void {
  for (const r of pool) {
    if (!r.active) continue;
    r.age += dt;
    if (r.age >= RIPPLE_LIFE_S) r.active = false;
  }
}

/** Two bumps running out from the tap, up and down the ribbon, fading as they go. */
export function rippleAt(pool: readonly Ripple[], ribbon: number, s: number): number {
  let sum = 0;
  for (const r of pool) {
    if (!r.active || r.ribbon !== ribbon) continue;
    const travel = r.age * 0.42;
    const fade = 1 - r.age / RIPPLE_LIFE_S;
    const up = (s - (r.s - travel)) / 0.05;
    const down = (s - (r.s + travel)) / 0.05;
    sum += r.strength * fade * (Math.exp(-up * up) + Math.exp(-down * down));
  }
  return sum;
}

export function nextShootingStarDelay(rng: () => number): number {
  return SHOOTING_STAR_MIN_S + rng() * (SHOOTING_STAR_MAX_S - SHOOTING_STAR_MIN_S);
}
