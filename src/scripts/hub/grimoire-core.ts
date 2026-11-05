// Pure layout and motion maths for the "pages into stars" hub scene. Everything
// here is DOM-free so it can be tested; grimoire-scene.ts does the drawing.
//
// The hub's cards cover most of a desktop screen, leaving the top band and the
// two side gutters visible, so the scene is composed around them: the book sits
// in the left gutter and the wind carries its pages up that gutter, across the
// top band and out past the top-right corner.

export const TAU = Math.PI * 2;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** `soft` rects are cards the scene may pass behind; hard rects hold text. */
export interface AvoidRect extends Rect {
  soft: boolean;
}

export interface Vec {
  x: number;
  y: number;
}

export interface Gutters {
  left: number;
  right: number;
  top: number;
  /** Height of the open strip above the page's topmost text. */
  clear: number;
}

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

export interface ConstellationPlacement {
  pattern: number;
  x: number;
  y: number;
  scale: number;
}

export interface GrimoireLayout {
  width: number;
  height: number;
  compact: boolean;
  gutters: Gutters;
  book: BookPlacement;
  wind: Vec[];
  moon: { x: number; y: number; r: number };
  galaxies: Array<{ x: number; y: number; size: number; tilt: number }>;
  constellations: ConstellationPlacement[];
  maxPages: number;
  maxDust: number;
  maxEmbers: number;
  pageWidth: number;
}

export function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function rectDistance(px: number, py: number, r: Rect): number {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** The clear space around the cards at the top of the page (no scroll). */
export function measureGutters(width: number, height: number, avoid: readonly AvoidRect[]): Gutters {
  const cards = avoid.filter((r) => r.soft && r.w > 40 && r.h > 40);
  if (cards.length === 0) {
    return { left: width * 0.18, right: width * 0.18, top: height * 0.3, clear: height * 0.12 };
  }
  let left = width;
  let right = width;
  let top = height;
  for (const r of cards) {
    left = Math.min(left, r.x);
    right = Math.min(right, width - (r.x + r.w));
    top = Math.min(top, r.y);
  }
  let clear = top;
  for (const r of avoid) {
    if (!r.soft) clear = Math.min(clear, r.y);
  }
  return { left: Math.max(0, left), right: Math.max(0, right), top: clamp(top, 0, height), clear: clamp(clear, 0, height) };
}

/** Book size and position: fits the left gutter, and may slip behind the cards when there is no room. */
export function placeBook(width: number, height: number, gutters: Gutters): BookPlacement {
  const short = Math.min(width, height);
  const proportions = (w: number) => ({ w, depth: w * 0.36, lift: w * 0.24 });
  // Phones: the cards fill the width, so the book sits low enough to show below the last
  // card at the end of the page and through the gaps between cards while scrolling.
  if (width < 820 && height >= width) {
    return { x: width * 0.42, y: height - clamp(height * 0.075, 44, 70), ...proportions(clamp(width * 0.42, 130, 190)) };
  }
  if (height < 500) {
    const w = clamp(short * 0.34, 110, 140);
    return { x: w * 0.47, y: height - clamp(height * 0.1, 30, 50), ...proportions(w) };
  }
  const lo = clamp(short * 0.3, 150, 175);
  const hi = clamp(short * 0.46, 180, 480);
  const w = clamp(gutters.left * 1.28, lo, hi);
  const x = Math.max(w * 0.47, Math.min(gutters.left * 0.56, width * 0.42));
  const y = height - clamp(height * 0.12, 54, 150);
  return { x, y, ...proportions(w) };
}

/** The block of opaque cards, in page coordinates: anything fully behind it need not be drawn. */
export interface CardCover {
  left: number;
  right: number;
  top: number;
  bottom: number;
  gapLeft: number;
  gapRight: number;
}

export function measureCardCover(avoid: readonly AvoidRect[]): CardCover | null {
  const cards = avoid.filter((r) => r.soft && r.w > 40 && r.h > 40);
  if (cards.length === 0) return null;
  const firstY = Math.min(...cards.map((r) => r.y));
  const row = cards.filter((r) => Math.abs(r.y - firstY) < 8).sort((a, b) => a.x - b.x);
  return {
    left: Math.min(...cards.map((r) => r.x)),
    right: Math.max(...cards.map((r) => r.x + r.w)),
    top: firstY,
    bottom: Math.max(...cards.map((r) => r.y + r.h)),
    gapLeft: row.length > 1 ? row[0].x + row[0].w : 0,
    gapRight: row.length > 1 ? row[1].x : 0,
  };
}

/** True when a sprite of radius `pad` at this screen position is hidden behind the cards. */
export function isBehindCards(cover: CardCover | null, x: number, y: number, scrollTop: number, pad: number): boolean {
  if (!cover) return false;
  const top = cover.top - scrollTop + pad;
  const bottom = cover.bottom - scrollTop - pad;
  if (y <= top || y >= bottom) return false;
  if (x <= cover.left + pad || x >= cover.right - pad) return false;
  return x < cover.gapLeft - pad || x > cover.gapRight + pad;
}

/** Control points of the wind: up the left gutter, across the top band, out past the top-right corner. */
export function computeWind(width: number, height: number, gutters: Gutters, book: BookPlacement): Vec[] {
  const startY = book.y - book.depth * 0.55;
  const band = Math.max(gutters.top, 60);
  if (height < 500) {
    // Phone on its side: a low, level run along the only open band.
    const topY = clamp(gutters.clear * 0.5, 12, band * 0.3);
    return [
      { x: book.x, y: startY },
      { x: width * 0.03, y: lerp(startY, band, 0.5) },
      { x: width * 0.04, y: band * 0.6 },
      { x: width * 0.22, y: topY },
      { x: width * 0.5, y: topY * 0.8 },
      { x: width * 0.78, y: topY * 1.1 },
      { x: width + 40, y: topY * 0.4 },
    ];
  }
  if (width < 820) {
    // Phone upright: an S up the screen, then along the strip above the page's text.
    const topY = clamp(gutters.clear * 0.5, 14, band * 0.24);
    return [
      { x: book.x, y: startY },
      { x: width * 0.78, y: lerp(startY, band, 0.3) },
      { x: width * 0.16, y: lerp(startY, band, 0.66) },
      { x: width * 0.05, y: band * 0.86 },
      { x: width * 0.07, y: band * 0.38 },
      { x: width * 0.32, y: topY },
      { x: width * 0.62, y: topY * 0.8 },
      { x: width * 0.88, y: topY * 1.1 },
      { x: width + 40, y: topY * 0.3 },
    ];
  }
  const leftX = Math.max(gutters.left * 0.46, width * 0.03);
  const rightGutter = Math.max(gutters.right, width * 0.05);
  const topY = clamp(band * 0.24, 20, 96);
  return [
    { x: book.x, y: startY },
    { x: lerp(book.x, leftX, 0.7), y: lerp(startY, band, 0.34) },
    { x: leftX * 0.86, y: lerp(startY, band, 0.72) },
    { x: leftX + width * 0.03, y: band * 0.62 },
    { x: width * 0.24, y: topY * 1.1 },
    { x: width * 0.5, y: topY * 0.72 },
    { x: width * 0.74, y: topY * 1.5 },
    { x: width - rightGutter * 0.7, y: band * 0.5 },
    { x: width - rightGutter * 0.24, y: band * 0.2 },
    { x: width + 50, y: -30 },
  ];
}

export interface WindLut {
  /** Evenly spaced by arc length: x, y, unit tangent x, unit tangent y. */
  x: Float32Array;
  y: Float32Array;
  tx: Float32Array;
  ty: Float32Array;
  length: number;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3);
}

/** Resamples a Catmull-Rom spline through `points` to `samples` points spaced evenly along its length. */
export function buildWindLut(points: readonly Vec[], samples = 256): WindLut {
  const raw: Vec[] = [];
  const steps = 32;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let j = 0; j < steps; j++) {
      const t = j / steps;
      raw.push({ x: catmullRom(p0.x, p1.x, p2.x, p3.x, t), y: catmullRom(p0.y, p1.y, p2.y, p3.y, t) });
    }
  }
  raw.push({ ...points[points.length - 1] });

  const dist = new Float64Array(raw.length);
  for (let i = 1; i < raw.length; i++) {
    dist[i] = dist[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y);
  }
  const length = dist[raw.length - 1];
  const lut: WindLut = {
    x: new Float32Array(samples),
    y: new Float32Array(samples),
    tx: new Float32Array(samples),
    ty: new Float32Array(samples),
    length,
  };
  let k = 0;
  for (let i = 0; i < samples; i++) {
    const target = (i / (samples - 1)) * length;
    while (k < raw.length - 2 && dist[k + 1] < target) k++;
    const span = dist[k + 1] - dist[k];
    const f = span > 0 ? (target - dist[k]) / span : 0;
    lut.x[i] = lerp(raw[k].x, raw[k + 1].x, f);
    lut.y[i] = lerp(raw[k].y, raw[k + 1].y, f);
  }
  for (let i = 0; i < samples; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(samples - 1, i + 1);
    const dx = lut.x[b] - lut.x[a];
    const dy = lut.y[b] - lut.y[a];
    const d = Math.hypot(dx, dy) || 1;
    lut.tx[i] = dx / d;
    lut.ty[i] = dy / d;
  }
  return lut;
}

/** Height of the page block above the cover at horizontal position u (-1..1): a hump beside the gutter, falling to the edge. */
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

function easeFlip(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

/**
 * A turning page in the book's u/z plane, at distance s (0 at the spine, 1 at the
 * edge) and turn progress p (0 resting right, 1 resting left). The edge lags
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

export const BURN_START = 0.62;

export function pageLifecycle(age: number, life: number, out: PageLife): PageLife {
  const t = life > 0 ? clamp(age / life, 0, 1) : 1;
  out.opacity = smoothstep(0, Math.min(0.08, 1.2 / Math.max(life, 1)), t);
  out.burn = t <= BURN_START ? 0 : (t - BURN_START) / (1 - BURN_START);
  return out;
}

/** Star patterns in a unit box, with the lines that join them. */
export const CONSTELLATION_PATTERNS: ReadonlyArray<{ stars: ReadonlyArray<readonly [number, number]>; edges: ReadonlyArray<readonly [number, number]> }> = [
  {
    stars: [[-1, 0.2], [-0.55, -0.1], [-0.1, 0], [0.3, 0.3], [0.85, 0.1], [0.95, -0.5], [0.35, -0.45]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  {
    stars: [[-0.3, -1], [0.35, -0.95], [-0.1, -0.2], [0.15, 0.05], [-0.55, 0.85], [0.55, 0.95]],
    edges: [[0, 2], [1, 3], [2, 3], [2, 4], [3, 5]],
  },
  {
    stars: [[-0.9, -0.5], [-0.4, 0.3], [0, -0.3], [0.45, 0.4], [0.95, -0.35]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    stars: [[0, -0.9], [-0.55, -0.2], [0.55, -0.15], [0, 0.15], [-0.35, 0.9], [0.45, 0.8]],
    edges: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5]],
  },
  {
    stars: [[-1, 0], [-0.5, -0.45], [0.05, -0.2], [0.5, -0.55], [1, -0.15], [0.45, 0.45]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]],
  },
];

function constellationClear(x: number, y: number, scale: number, avoid: readonly AvoidRect[]): boolean {
  for (const r of avoid) {
    if (rectDistance(x, y, r) < scale * (r.soft ? 0.95 : 0.55)) return false;
  }
  return true;
}

/** Spots that stay on screen: along the top band, then down the gutters when they are wide enough. */
export function placeConstellations(width: number, height: number, gutters: Gutters, avoid: readonly AvoidRect[]): ConstellationPlacement[] {
  const band = Math.max(gutters.top, 60);
  const out: ConstellationPlacement[] = [];
  const bandScale = clamp(band * 0.2, 22, 64);
  const margin = bandScale * 1.1;
  const slots: Array<[number, number, number]> = [];
  const across = clamp(Math.round(width / 300), 2, 7);
  for (let i = 0; i < across; i++) {
    const x = lerp(margin, width - margin, (i + 0.5) / across);
    slots.push([x, band * (i % 2 === 0 ? 0.28 : 0.42), bandScale]);
  }
  const sideScale = (g: number) => clamp(g * 0.34, 20, 90);
  if (gutters.right >= 90) {
    const s = sideScale(gutters.right);
    slots.push([width - gutters.right * 0.5, height * 0.42, s], [width - gutters.right * 0.5, height * 0.66, s]);
  }
  if (gutters.left >= 200) {
    slots.push([gutters.left * 0.5, height * 0.34, sideScale(gutters.left)]);
  }
  let pattern = 0;
  for (const [x, y, scale] of slots) {
    if (!constellationClear(x, y, scale, avoid)) continue;
    out.push({ pattern: pattern % CONSTELLATION_PATTERNS.length, x, y, scale });
    pattern++;
  }
  return out;
}

function placeMoon(width: number, gutters: Gutters, avoid: readonly AvoidRect[]): { x: number; y: number; r: number } {
  const band = Math.max(gutters.top, 60);
  const r = clamp(Math.min(width, band * 2.4) * 0.05, 9, 34);
  const candidates: Vec[] = [
    { x: width - Math.max(gutters.right, 60) * 0.5, y: band * 0.26 },
    { x: width * 0.66, y: band * 0.24 },
    { x: width * 0.44, y: band * 0.2 },
    { x: width * 0.84, y: band * 0.62 },
    { x: width * 0.22, y: band * 0.16 },
  ];
  let best = candidates[0];
  let bestClear = -Infinity;
  for (const c of candidates) {
    let clear = Infinity;
    for (const a of avoid) clear = Math.min(clear, rectDistance(c.x, c.y, a));
    if (clear > bestClear) {
      bestClear = clear;
      best = c;
    }
    if (clear > r * 2.4) break;
  }
  return { x: best.x, y: best.y, r };
}

export function computeLayout(width: number, height: number, avoid: readonly AvoidRect[] = []): GrimoireLayout {
  const gutters = measureGutters(width, height, avoid);
  const book = placeBook(width, height, gutters);
  const area = width * height;
  const band = Math.max(gutters.top, 60);
  const compact = width < 820 || height < 500;
  const moon = placeMoon(width, gutters, avoid);
  const galaxySize = compact ? clamp(band * 0.16, 20, 34) : clamp(band * 0.3, 22, 66);
  const galaxyY = band * (compact ? 0.1 : 0.16);
  const galaxyX =
    [0.36, 0.58, 0.2, 0.76]
      .map((f) => width * f)
      .find((x) => Math.hypot(x - moon.x, galaxyY - moon.y) > moon.r * 2.4 + galaxySize) ?? width * 0.36;
  const galaxies: GrimoireLayout["galaxies"] = [{ x: galaxyX, y: galaxyY, size: galaxySize, tilt: -0.5 }];
  if (gutters.right >= 80) {
    galaxies.push({ x: width - gutters.right * 0.46, y: height * 0.54, size: clamp(gutters.right * 0.42, 22, 90), tilt: 0.6 });
  }
  return {
    width,
    height,
    compact,
    gutters,
    book,
    wind: computeWind(width, height, gutters, book),
    moon,
    galaxies,
    constellations: placeConstellations(width, height, gutters, avoid),
    maxPages: Math.round(clamp(area / 90_000, compact ? 7 : 6, 14)),
    maxDust: Math.round(clamp(area / 2_600, compact ? 220 : 180, 520)),
    maxEmbers: compact ? 12 : 26,
    pageWidth: clamp(book.w * 0.17, 20, 46),
  };
}

/** How far along the wind the path first comes out above the cards, 0..1. */
export function windEntry(lut: WindLut, band: number): number {
  const last = lut.y.length - 1;
  for (let i = 0; i <= last; i++) {
    if (lut.y[i] < band) return i / last;
  }
  return 0;
}

export const BURST_COOLDOWN_S = 1.2;

/** A burst flashes the whole book; this keeps repeated tapping well under 3 flashes per second. */
export function canBurst(now: number, lastBurstAt: number): boolean {
  return now - lastBurstAt >= BURST_COOLDOWN_S;
}
