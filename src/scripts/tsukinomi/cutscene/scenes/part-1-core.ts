// The pure half of the part 1 cutscene (part-1-autumn-rain.ts): rain on a
// fogged window. Everything here is arithmetic on numbers and arrays, with no
// DOM, canvas or CSS, so node:test can run it; part-1-autumn-rain.ts imports a
// stylesheet and draws, and node cannot load that.
//
// The mechanic, as these pieces fit together:
//
//   - The glass is fogged. A coarse CoverageGrid remembers which cells the
//     reader has cleared, updated incrementally as stamps land, so nothing ever
//     reads pixels back.
//   - The reader wipes by dragging: stampsAlong() turns a pointer segment into
//     evenly spaced brush stamps. If they do nothing, the fog parts by itself
//     on the WipeSchedule, from the epigraph outwards (curtainGeometry,
//     curtainEdges): it starts at AUTO_WIPE_START_S and has gone by
//     AUTO_WIPE_END_S, counted in seconds from the moment the scene is ready.
//     The keyboard's button asks the schedule for the fast wipe, which parts it
//     quicker. The first touch of the reader's hand stops the parting where it
//     is, and what is left of the fog thins out by itself.
//   - The epigraph's haze follows how much of the glass in front of it is clear
//     (revealFor), steered through quantizeReveal so the DOM is written a
//     handful of times in all.
//   - What moves is moved by the compositor (see "Motion for the compositor"
//     below): the rain, the droplets, the parting of the fog and the train's
//     light are planned here as plain numbers.
//
// Length. The fog is gone by FOG_GONE_S (6 s) and the scene ends at SCENE_END_S
// (20 s), so the epigraph is crisp for at least 14 s whatever the reader does
// and the whole scene lasts 20 s.

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Timeline, in seconds from the scene being ready (its plate decoded, or given up on).
/** The automatic wipe starts here: a moment of fully fogged glass first, so the reader sees what is there to wipe. */
export const AUTO_WIPE_START_S = 1.0;
/** The automatic wipe has swept the whole glass by here. */
export const AUTO_WIPE_END_S = 5.4;
/** The thin film left between the strokes fades out over this long once the glass counts as clear. */
export const FOG_FADE_S = 0.6;
/** The fog is completely gone by here, however the reader acted: the plan's end plus the fade. */
export const FOG_GONE_S = AUTO_WIPE_END_S + FOG_FADE_S;
/** The scene resolves handle.done here; the runner fades the dialog out after it. */
export const SCENE_END_S = 20;
/** The last seconds, in which the rain eases off. */
export const OUTRO_S = 2.5;
/** The rain and the plate fade in over this long. */
export const INTRO_S = 0.9;
/** The distant train's light passes behind the glass between these two times (the soundscape is a distant train). */
export const TRAIN_START_S = 9.5;
export const TRAIN_DURATION_S = 3.8;
/** The keyboard's wipe covers this fraction of the plan per second (about 1.4 s for a whole sweep). */
export const FAST_WIPE_SPEED = 0.7;
/** The glass counts as clear once this fraction of the grid is. */
export const CLEAR_FRACTION = 0.97;
/** How many times the epigraph's haze may change in total, each a CSS custom property write. */
export const REVEAL_STEPS = 12;

export const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge1 === edge0) return value >= edge1 ? 1 : 0;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Moves `current` toward `target` with time constant `tau` seconds, independent of the frame rate. */
export function easeToward(current: number, target: number, dt: number, tau: number): number {
  if (!(dt > 0)) return current;
  if (!(tau > 0)) return target;
  return target + (current - target) * Math.exp(-dt / tau);
}

// ---------------------------------------------------------------------------
// Geometry of the layers

/** Source rectangle of an image that covers a box without distortion (CSS background-size: cover, centred). */
export function coverRect(imageWidth: number, imageHeight: number, boxWidth: number, boxHeight: number): Rect {
  if (!(imageWidth > 0 && imageHeight > 0 && boxWidth > 0 && boxHeight > 0)) {
    return { x: 0, y: 0, width: Math.max(0, imageWidth), height: Math.max(0, imageHeight) };
  }
  const scale = Math.max(boxWidth / imageWidth, boxHeight / imageHeight);
  const width = boxWidth / scale;
  const height = boxHeight / scale;
  return { x: (imageWidth - width) / 2, y: (imageHeight - height) / 2, width, height };
}

/** The reader's brush: about a finger's width on a phone, a palm on a desktop. CSS pixels. */
export function brushRadius(width: number, height: number): number {
  const short = Math.min(width, height);
  return Math.min(58, Math.max(28, short * 0.085));
}

/** Fog is soft, so its bitmap is smaller than the screen: at most about 720 px on its long side. */
export function fogScale(width: number, height: number): number {
  const long = Math.max(width, height);
  return long > 0 ? Math.min(1, 720 / long) : 1;
}

/** Rain streaks for a stage of this size: enough to read as rain, few enough to stay cheap. */
export function rainCount(width: number, height: number): number {
  return Math.round(Math.min(90, Math.max(36, (width * height) / 16000)));
}

export function dropletCount(width: number, height: number): number {
  return Math.round(Math.min(14, Math.max(7, (width * height) / 80000)));
}

export function insideRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

/** The box the epigraph's haze is measured in: the text's rectangle, grown a little, in stage coordinates. */
export function growRect(rect: Rect, pad: number): Rect {
  return { x: rect.x - pad, y: rect.y - pad, width: rect.width + 2 * pad, height: rect.height + 2 * pad };
}

// ---------------------------------------------------------------------------
// Coverage

export interface CoverageGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  readonly total: number;
  /** Cells cleared so far. */
  readonly count: number;
  /** Marks every cell whose centre is within `radius` of (cx, cy); returns how many were newly cleared. */
  mark(cx: number, cy: number, radius: number): number;
  /** Whether the cell under the point is clear. Points outside the grid read as clear. */
  isCleared(x: number, y: number): boolean;
  /** Cleared share of the whole grid, 0 to 1. */
  fraction(): number;
  /** Cleared share of the cells whose centres fall inside the rectangle; the whole grid's when the rectangle holds none. */
  fractionIn(rect: Rect): number;
  clearAll(): void;
}

export function createCoverageGrid(width: number, height: number, cell: number): CoverageGrid {
  const size = cell > 0 ? cell : 16;
  const cols = Math.max(1, Math.ceil(width / size));
  const rows = Math.max(1, Math.ceil(height / size));
  const cleared = new Uint8Array(cols * rows);
  let count = 0;

  const grid: CoverageGrid = {
    cols,
    rows,
    cell: size,
    total: cols * rows,
    get count() {
      return count;
    },
    mark(cx, cy, radius) {
      if (!(radius > 0)) return 0;
      const c0 = Math.max(0, Math.floor((cx - radius) / size));
      const c1 = Math.min(cols - 1, Math.floor((cx + radius) / size));
      const r0 = Math.max(0, Math.floor((cy - radius) / size));
      const r1 = Math.min(rows - 1, Math.floor((cy + radius) / size));
      const limit = radius * radius;
      let added = 0;
      for (let row = r0; row <= r1; row++) {
        const dy = (row + 0.5) * size - cy;
        for (let col = c0; col <= c1; col++) {
          const index = row * cols + col;
          if (cleared[index]) continue;
          const dx = (col + 0.5) * size - cx;
          if (dx * dx + dy * dy <= limit) {
            cleared[index] = 1;
            added++;
          }
        }
      }
      count += added;
      return added;
    },
    isCleared(x, y) {
      const col = Math.floor(x / size);
      const row = Math.floor(y / size);
      if (col < 0 || row < 0 || col >= cols || row >= rows) return true;
      return cleared[row * cols + col] === 1;
    },
    fraction: () => count / (cols * rows),
    fractionIn(rect) {
      const c0 = Math.max(0, Math.ceil((rect.x) / size - 0.5));
      const c1 = Math.min(cols - 1, Math.floor((rect.x + rect.width) / size - 0.5));
      const r0 = Math.max(0, Math.ceil((rect.y) / size - 0.5));
      const r1 = Math.min(rows - 1, Math.floor((rect.y + rect.height) / size - 0.5));
      let inside = 0;
      let done = 0;
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          inside++;
          done += cleared[row * cols + col];
        }
      }
      return inside > 0 ? done / inside : count / (cols * rows);
    },
    clearAll() {
      cleared.fill(1);
      count = cols * rows;
    },
  };
  return grid;
}

/** The grid cell size for a brush: half the cleared core's width, so a stamp always covers several cells, within sane bounds. */
export function gridCell(userRadius: number): number {
  return Math.min(28, Math.max(14, userRadius * 0.5));
}

/** Share of a brush stamp's radius that is cleared completely; the rest is a soft edge. Brush sprite and grid agree on it. */
export const BRUSH_CORE = 0.55;

// ---------------------------------------------------------------------------
// The reader's strokes

/**
 * Brush stamps along a pointer segment, `spacing` apart. `carry` is the
 * distance already travelled since the last stamp (0 right after one), so a
 * stroke made of many short segments is spaced evenly as a whole. The start
 * point itself is not stamped: a stroke stamps its first point when it begins.
 * At most `maxPoints` stamps, so a flick across the screen cannot stall a frame.
 */
export function stampsAlong(
  from: Point,
  to: Point,
  spacing: number,
  carry: number,
  maxPoints = 64,
): { points: Point[]; carry: number } {
  const step = spacing > 0 ? spacing : 1;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const points: Point[] = [];
  if (!(length > 0)) return { points, carry };
  let at = step - carry;
  while (at <= length && points.length < maxPoints) {
    const k = at / length;
    points.push({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
    at += step;
  }
  // Past the cap the rest of the segment is dropped: carry restarts from the end.
  const rest = points.length >= maxPoints ? 0 : length - (at - step);
  return { points, carry: Math.max(0, rest) };
}

// ---------------------------------------------------------------------------
// The automatic wipe

export interface WipeSchedule {
  /** Where the automatic hand is on its plan (0 to 1) at scene time t. Never decreases. */
  progressAt(t: number): number;
  /** The reader asked for the fast wipe (the keyboard's button) at scene time t. Only the first request counts. */
  requestFast(t: number): void;
  readonly fastRequested: boolean;
}

/** The unhurried wipe: nothing before AUTO_WIPE_START_S, a gentle ease to the end at AUTO_WIPE_END_S. */
export function autoProgress(t: number): number {
  const x = clamp01((t - AUTO_WIPE_START_S) / (AUTO_WIPE_END_S - AUTO_WIPE_START_S));
  return 0.5 - 0.5 * Math.cos(Math.PI * x);
}

export function createWipeSchedule(): WipeSchedule {
  let fastAt = -1;
  let fastFrom = 0;
  return {
    progressAt(t) {
      const auto = autoProgress(t);
      if (fastAt < 0) return auto;
      return clamp01(Math.max(auto, fastFrom + Math.max(0, t - fastAt) * FAST_WIPE_SPEED));
    },
    requestFast(t) {
      if (fastAt >= 0) return;
      fastAt = Math.max(0, t);
      fastFrom = autoProgress(fastAt);
    },
    get fastRequested() {
      return fastAt >= 0;
    },
  };
}

/**
 * Whether the glass counts as clear, so the leftover film starts to fade (over
 * FOG_FADE_S): the reader or the plan has cleared enough of it, or the plan's
 * time is up. Whatever the reader does, this is true from AUTO_WIPE_END_S on.
 */
export function fogIsClear(t: number, coverage: number): boolean {
  return t >= AUTO_WIPE_END_S || coverage >= CLEAR_FRACTION;
}

// ---------------------------------------------------------------------------
// The epigraph's haze

/** How readable the epigraph is, 0 (hazed) to 1 (crisp), for the share of the glass in front of it that is clear. */
export function revealFor(coverage: number): number {
  return smoothstep(0.1, 0.85, coverage);
}

/** Rounds a reveal to one of REVEAL_STEPS + 1 levels. */
export function quantizeReveal(value: number): number {
  return Math.round(clamp01(value) * REVEAL_STEPS) / REVEAL_STEPS;
}

// ---------------------------------------------------------------------------
// The weather

/** Rain and plate opacity over the scene: fades in, steady, eases off in the last OUTRO_S. */
export function rainEnvelope(t: number): number {
  const intro = smoothstep(0, INTRO_S, t);
  const outro = 1 - 0.65 * smoothstep(SCENE_END_S - OUTRO_S, SCENE_END_S, t);
  return intro * outro;
}

/** The distant train's light: 0 outside its pass, rising and falling smoothly inside it, peaking at 1. */
export function trainEnvelope(t: number): number {
  const x = (t - TRAIN_START_S) / TRAIN_DURATION_S;
  if (x <= 0 || x >= 1) return 0;
  return Math.sin(Math.PI * x) ** 2;
}

/** Where the train's light is, 0 (entering at the left) to 1 (gone at the right). */
export function trainProgress(t: number): number {
  return clamp01((t - TRAIN_START_S) / TRAIN_DURATION_S);
}

/**
 * Where the train's light runs across the glass: a band centred at about
 * three fifths of the way down, moved clear of the epigraph so the light never
 * sits behind a line of text. Below the text if there is room, else above it,
 * else null (a short landscape screen filled by the text: no train).
 */
export function placeTrain(height: number, text: Rect | null, halfBand: number): number | null {
  const preferred = height * 0.6;
  if (!text) return preferred;
  const gap = 12;
  const clash = (y: number) => y + halfBand > text.y && y - halfBand < text.y + text.height;
  if (!clash(preferred)) return preferred;
  const below = text.y + text.height + gap + halfBand;
  if (below + halfBand <= height) return below;
  const above = text.y - gap - halfBand;
  if (above - halfBand >= 0) return above;
  return null;
}

export interface RainStreak {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
  width: number;
}

/** Sideways travel per unit of fall: the wind leans the rain to the left. */
export const RAIN_SLANT = -0.1;

function spawnStreak(streak: RainStreak, width: number, height: number, rng: () => number, scale: number): void {
  const near = rng() < 0.45;
  streak.len = (near ? 24 + rng() * 26 : 10 + rng() * 10) * scale;
  streak.speed = (near ? 900 + rng() * 380 : 520 + rng() * 200) * scale;
  streak.alpha = near ? 0.26 + rng() * 0.22 : 0.12 + rng() * 0.12;
  streak.width = near ? 1.15 : 0.8;
  // Leaning rain crosses the top edge left of where it ends, so spread starts a little beyond the right edge.
  streak.x = rng() * (width + height * 0.12);
  streak.y = rng() * (height + streak.len) - streak.len;
}

export function createRain(count: number, width: number, height: number, rng: () => number): RainStreak[] {
  const scale = Math.min(1.25, Math.max(0.7, height / 800));
  const streaks: RainStreak[] = [];
  for (let index = 0; index < count; index++) {
    const streak: RainStreak = { x: 0, y: 0, len: 0, speed: 0, alpha: 0, width: 1 };
    spawnStreak(streak, width, height, rng, scale);
    streaks.push(streak);
  }
  return streaks;
}

export interface Droplet {
  x: number;
  y: number;
  /** Where it was before the latest step, so the caller can clear the trail it ran over. */
  previousY: number;
  radius: number;
  /** Seconds until the next slide. */
  wait: number;
  /** Seconds the current slide has left; 0 while it sits still. */
  sliding: number;
  speed: number;
}

function resetDroplet(drop: Droplet, width: number, height: number, rng: () => number, anywhere: boolean): void {
  drop.radius = 2.4 + rng() * rng() * 5.2;
  drop.x = rng() * width;
  drop.y = anywhere ? rng() * height : -drop.radius * 2;
  drop.previousY = drop.y;
  drop.wait = 0.8 + rng() * 6;
  drop.sliding = 0;
  drop.speed = 0;
}

export function createDroplets(count: number, width: number, height: number, rng: () => number): Droplet[] {
  const drops: Droplet[] = [];
  for (let index = 0; index < count; index++) {
    const drop: Droplet = { x: 0, y: 0, previousY: 0, radius: 0, wait: 0, sliding: 0, speed: 0 };
    resetDroplet(drop, width, height, rng, true);
    drops.push(drop);
  }
  return drops;
}

/**
 * A droplet sits still, then runs down a short way (faster when it is bigger),
 * then sits again: the stop and go of water on glass. Returns how many ran this
 * step, and leaves each one's previousY to y for the caller's trail.
 */
export function stepDroplets(drops: Droplet[], dt: number, width: number, height: number, rng: () => number, waitScale = 1): number {
  let moved = 0;
  for (const drop of drops) drop.previousY = drop.y;
  if (!(dt > 0)) return 0;
  for (const drop of drops) {
    if (drop.sliding > 0) {
      drop.sliding = Math.max(0, drop.sliding - dt);
      drop.y += drop.speed * dt;
      moved++;
      if (drop.sliding === 0) drop.wait = (1.2 + rng() * 5) * waitScale;
    } else {
      drop.wait -= dt;
      if (drop.wait <= 0) {
        drop.sliding = 0.35 + rng() * 0.9;
        drop.speed = (26 + drop.radius * 9) * (0.7 + rng() * 0.6);
      }
    }
    if (drop.y - drop.radius > height) resetDroplet(drop, width, height, rng, false);
  }
  return moved;
}

// ---------------------------------------------------------------------------
// Remembering the strokes, so a resize can paint the same fog again

export interface StampLog {
  readonly length: number;
  /** Records a stamp as fractions of the stage and of its shorter side. Ignored once the log is full. */
  add(nx: number, ny: number, radiusOverShort: number): void;
  /** Visits the stamps in the order they were made. */
  forEach(visit: (nx: number, ny: number, radiusOverShort: number) => void): void;
  clear(): void;
}

export function createStampLog(capacity = 6000): StampLog {
  const data = new Float32Array(capacity * 3);
  let length = 0;
  return {
    get length() {
      return length;
    },
    add(nx, ny, radiusOverShort) {
      if (length >= capacity) return;
      const at = length * 3;
      data[at] = nx;
      data[at + 1] = ny;
      data[at + 2] = radiusOverShort;
      length++;
    },
    forEach(visit) {
      for (let index = 0; index < length; index++) visit(data[index * 3], data[index * 3 + 1], data[index * 3 + 2]);
    },
    clear() {
      length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Motion for the compositor
// ---------------------------------------------------------------------------
//
// Nothing in this scene is redrawn every frame. A browser that rasterises in
// software hands the compositor a whole canvas again every time anything is
// drawn in it, whatever the drawing was: a mostly empty full-screen canvas with
// a few streaks on it cost the main thread about 1.8 ms a frame (about 8 ms at a
// quarter of the speed), so the rain canvas of an earlier version was most of
// the scene's cost. Every layer is now painted once and what moves is moved by
// the compositor with transform and opacity animations: the rain is two tall
// canvases that slide down their own length and start again, the fog is two
// halves that part from the epigraph outwards, a droplet's slide is a transform
// on a small element, the train's light a transform and an opacity. The
// functions below plan those motions as plain numbers.

/** A clock that can be paused, in the units of `now`: how long the scene has been playing. Same as prologue-core's. */
export interface SceneClock {
  /** Starts the clock; calls after the first do nothing. */
  start(): void;
  /** Stops it counting (the tab is hidden); a no-op when it is not running. */
  hold(): void;
  /** Counting again. */
  release(): void;
  /** Milliseconds counted so far; 0 before start. */
  elapsedMs(): number;
  readonly started: boolean;
  readonly held: boolean;
}

export function createSceneClock(now: () => number = () => performance.now()): SceneClock {
  let startedAt = -1;
  let heldAt = -1;
  let heldTotal = 0;
  return {
    start() {
      if (startedAt < 0) startedAt = now();
    },
    hold() {
      if (startedAt >= 0 && heldAt < 0) heldAt = now();
    },
    release() {
      if (heldAt >= 0) {
        heldTotal += now() - heldAt;
        heldAt = -1;
      }
    },
    elapsedMs() {
      if (startedAt < 0) return 0;
      const upTo = heldAt >= 0 ? heldAt : now();
      return Math.max(0, upTo - startedAt - heldTotal);
    },
    get started() {
      return startedAt >= 0;
    },
    get held() {
      return heldAt >= 0;
    },
  };
}

/** Keyframes of the weather's opacity: `rainEnvelope` sampled over its fade in (the first INTRO_S) and its fade out (the last OUTRO_S). */
export const ENVELOPE_SAMPLES = 10;

export function envelopeSteps(part: "intro" | "outro", samples = ENVELOPE_SAMPLES): Array<{ offset: number; value: number }> {
  const count = Math.max(2, Math.round(samples));
  const from = part === "intro" ? 0 : SCENE_END_S - OUTRO_S;
  const length = part === "intro" ? INTRO_S : OUTRO_S;
  return Array.from({ length: count + 1 }, (_, index) => ({ offset: index / count, value: rainEnvelope(from + (index / count) * length) }));
}

// ---- the rain: two tall canvases ------------------------------------------

export interface RainStroke {
  x: number;
  y: number;
  len: number;
  alpha: number;
  width: number;
}

/**
 * One layer of rain: a canvas `planeWidth` by `planeHeight` (CSS pixels) holding
 * streaks, and the motion that carries it. The pattern repeats every
 * (shiftX, periodY): the canvas is moved by exactly that, over `durationS`, and
 * jumps back, and nothing can be seen to jump, because the streaks at the end
 * of the move are the streaks that were at the start. The rain falls along its
 * own slant, so the move has the slant too (shiftX is RAIN_SLANT of periodY).
 */
export interface RainLayerPlan {
  name: "far" | "near";
  periodY: number;
  shiftX: number;
  planeWidth: number;
  planeHeight: number;
  /** Where the plane's top left sits on the stage when the move starts. */
  left: number;
  top: number;
  durationS: number;
  /** Streaks of one period, in the plane's own pixels, x over `baseWidth`, y over [0, periodY). Each is drawn again one period further along, as often as the plane has room for. */
  strokes: RainStroke[];
  baseWidth: number;
}

const FAR_SHARE = 0.55;
const NEAR_SHARE = 0.45;

/** The two layers of rain for a stage this size, with about the density `rainCount` gives; deterministic for a seed. */
export function planRain(width: number, height: number, rng: () => number): RainLayerPlan[] {
  const scale = Math.min(1.25, Math.max(0.7, height / 800));
  const total = rainCount(width, height);
  const specs = [
    { name: "far" as const, share: FAR_SHARE, period: Math.max(360, Math.min(720, height * 0.8)), speed: 620 * scale, len: [10, 10], speedSpread: 0, alpha: [0.12, 0.12], strokeWidth: 0.8 },
    { name: "near" as const, share: NEAR_SHARE, period: Math.max(480, Math.min(900, height)), speed: 1090 * scale, len: [24, 26], speedSpread: 0, alpha: [0.26, 0.22], strokeWidth: 1.15 },
  ];
  return specs.map((spec) => {
    const periodY = Math.round(spec.period);
    const shiftX = RAIN_SLANT * periodY;
    const planeWidth = Math.ceil(width - shiftX);
    const planeHeight = Math.ceil(height + periodY);
    // Streaks are placed over a strip wide enough that every point of the plane has the right neighbours once the pattern is repeated along the slant.
    const baseWidth = Math.ceil(planeWidth - RAIN_SLANT * planeHeight);
    const count = Math.max(4, Math.round((total * spec.share * baseWidth * periodY) / Math.max(1, width * height)));
    const strokes: RainStroke[] = [];
    for (let index = 0; index < count; index++) {
      strokes.push({
        x: rng() * baseWidth,
        y: rng() * periodY,
        len: (spec.len[0] + rng() * spec.len[1]) * scale,
        alpha: spec.alpha[0] + rng() * spec.alpha[1],
        width: spec.strokeWidth,
      });
    }
    return { name: spec.name, periodY, shiftX, planeWidth, planeHeight, left: 0, top: -periodY, durationS: periodY / spec.speed, strokes, baseWidth };
  });
}

/**
 * Where a stroke is drawn on a plane: its own place and every repeat of it one
 * period further along the slant that still touches the plane. The streak runs
 * from (x - RAIN_SLANT * len, y - len) to (x, y), as a falling streak always did.
 */
export function strokeRepeats(plan: RainLayerPlan, stroke: RainStroke): Point[] {
  const out: Point[] = [];
  for (let k = 0; ; k++) {
    const y = stroke.y + k * plan.periodY;
    if (y - stroke.len > plan.planeHeight) break;
    const x = stroke.x + k * plan.shiftX;
    // The streak spans x from `x` to `x - RAIN_SLANT * len`, which is to the right of x: it touches the plane unless it is wholly left of or right of it.
    if (x - RAIN_SLANT * stroke.len >= 0 && x <= plan.planeWidth) out.push({ x, y });
    if (k > 64) break;
  }
  return out;
}

// ---- droplets: a few sliding elements --------------------------------------

export interface DropletSlide {
  /** Seconds from the scene's start. */
  startS: number;
  durationS: number;
  fromY: number;
  toY: number;
}

export interface DropletPlan {
  x: number;
  radius: number;
  /** Where it sits before its first slide. */
  y: number;
  /** When it appears (0 for the ones on the glass at the start; a droplet that ran off the bottom is replaced by a new one at the top). */
  fromS: number;
  slides: DropletSlide[];
}

/**
 * Plays the droplets of stepDroplets forward to `horizonS` once, so that their
 * slides are known in advance and can be handed to the compositor as plain
 * transforms. A droplet that runs off the glass is replaced, as it always was,
 * by a new one at the top, which is a new plan.
 */
export function planDroplets(count: number, width: number, height: number, rng: () => number, horizonS: number, step = 0.05, waitScale = 1): DropletPlan[] {
  const drops = createDroplets(count, width, height, rng);
  const plans: DropletPlan[] = drops.map((drop) => ({ x: drop.x, radius: drop.radius, y: drop.y, fromS: 0, slides: [] }));
  const current = [...plans];
  // The slide each droplet is in the middle of, if it is.
  const open: Array<DropletSlide | null> = drops.map(() => null);
  for (let at = 0; at < horizonS; at += step) {
    const before = drops.map((drop) => ({ y: drop.y, sliding: drop.sliding, speed: drop.speed }));
    stepDroplets(drops, step, width, height, rng, waitScale);
    const now = at + step;
    drops.forEach((drop, index) => {
      const was = before[index];
      // A droplet that ran off the bottom is replaced in place by a new one at the top.
      const reset = drop.y < was.y;
      const slide = open[index];
      if (slide && (reset || drop.sliding === 0)) {
        slide.toY = reset ? was.y + was.speed * step : drop.y;
        slide.durationS = Math.max(step, now - slide.startS);
        open[index] = null;
      }
      if (reset) {
        const next: DropletPlan = { x: drop.x, radius: drop.radius, y: drop.y, fromS: now, slides: [] };
        plans.push(next);
        current[index] = next;
      } else if (was.sliding === 0 && drop.sliding > 0) {
        // The slide begins now: the step that set it has not moved the droplet yet.
        const begun: DropletSlide = { startS: now, durationS: step, fromY: drop.y, toY: drop.y };
        current[index].slides.push(begun);
        open[index] = begun;
      }
    });
  }
  // A slide still going at the horizon ends there.
  drops.forEach((drop, index) => {
    const slide = open[index];
    if (slide) {
      slide.toY = drop.y;
      slide.durationS = Math.max(step, horizonS - slide.startS);
    }
  });
  return plans;
}

// ---- the fog: two halves that part from the epigraph outwards ----------------

export interface CurtainGeometry {
  /** The line the fog parts from: the middle of the epigraph, clamped to the stage. */
  anchor: number;
  height: number;
  /** Height of the soft edge each half has. */
  soft: number;
  /** The upper half covers [0, upHeight]: from the top of the stage to the anchor and a soft edge beyond it. */
  upHeight: number;
  /** The lower half covers [downTop, height]: from the anchor less a soft edge to the bottom of the stage. */
  downTop: number;
  downHeight: number;
}

export function curtainGeometry(height: number, anchor: number): CurtainGeometry {
  const h = Math.max(1, height);
  const soft = Math.min(110, Math.max(36, h * 0.11));
  const a = Math.min(h, Math.max(0, Number.isFinite(anchor) ? anchor : h / 2));
  const downTop = Math.max(0, a - soft);
  return { anchor: a, height: h, soft, upHeight: Math.min(h, a + soft), downTop, downHeight: h - downTop };
}

/**
 * Where the fog's edges are at plan progress p (0 to 1). The two halves are
 * windows that move away from each other, the upper one up and the lower one
 * down, each by its own height, so that both are gone together at p = 1. The
 * upper half is whole above `up`, the lower half is whole below `down`, between
 * them the glass is clear, and each edge is soft over g.soft pixels beyond it
 * (towards the clear glass).
 */
export function curtainEdges(g: CurtainGeometry, progress: number): { up: number; down: number } {
  const p = clamp01(progress);
  return { up: g.upHeight * (1 - p), down: g.downTop + g.downHeight * p };
}

/** The share of the vertical span [top, bottom] that the parting fog has cleared at progress p, counting a soft edge as half. */
export function curtainCoverage(g: CurtainGeometry, progress: number, top: number, bottom: number): number {
  const span = bottom - top;
  if (!(span > 0)) return clamp01(progress);
  const { up, down } = curtainEdges(g, progress);
  const lo = up - g.soft / 2;
  const hi = down + g.soft / 2;
  const overlap = Math.min(bottom, hi) - Math.max(top, lo);
  return clamp01(overlap / span);
}

export interface CurtainStep {
  /** Position in the move's time, 0 to 1. */
  offset: number;
  /** How far each half's window has moved: upward for the upper half, downward for the lower. */
  up: number;
  down: number;
  progress: number;
}

/**
 * The parting sampled over `durationS` seconds: `progressAt(s)` is where the
 * wipe plan is `s` seconds from now (0 to 1), so a quicker wipe (the keyboard's)
 * is the same motion at another pace.
 */
export function curtainSteps(g: CurtainGeometry, progressAt: (seconds: number) => number, durationS: number, samples = 24): CurtainStep[] {
  const count = Math.max(2, Math.round(samples));
  const steps: CurtainStep[] = [];
  for (let index = 0; index <= count; index++) {
    const offset = index / count;
    const progress = clamp01(progressAt(offset * durationS));
    steps.push({ offset, up: g.upHeight * progress, down: g.downHeight * progress, progress });
  }
  return steps;
}

/** How long, from now, until the plan has run its course (progress 1), or `limit` seconds, looking in `step` second steps. */
export function secondsToClear(progressAt: (seconds: number) => number, limit = 12, step = 0.05): number {
  for (let seconds = 0; seconds <= limit; seconds += step) {
    if (progressAt(seconds) >= 1 - 1e-6) return seconds;
  }
  return limit;
}

// ---- the train's light ------------------------------------------------------

export interface TrainLightStep {
  offset: number;
  /** 0 entering at the left, 1 gone at the right. */
  progress: number;
  /** The light's strength, before the weather's. */
  opacity: number;
}

/** The distant train's light over its pass, sampled; strength is 0.8 of trainEnvelope. */
export function trainLightSteps(samples = 14): TrainLightStep[] {
  const count = Math.max(2, Math.round(samples));
  return Array.from({ length: count + 1 }, (_, index) => {
    const offset = index / count;
    const t = TRAIN_START_S + offset * TRAIN_DURATION_S;
    return { offset, progress: trainProgress(t), opacity: 0.8 * trainEnvelope(t) };
  });
}
