// The half of the prologue cutscene (prologue.ts) that node:test can load: its
// timeline, the pacing of the subtitles and the covers that reveal them, the
// keyframes of the wire's layers, the auto-start rule and the layout of the
// picture. Kept apart from prologue.ts for the same reason as plate-core.ts and
// plate-timing.ts: prologue.ts imports a stylesheet, which node:test cannot
// load. It is arithmetic, plus one small piece that touches the clock (the
// countdown), tested against fake timers.
//
// The picture (design 4.3, row 1): a black screen, a Walkman, one earphone wire
// that draws across the screen to a single earbud (the second earbud stays
// empty), the epigraph as slow subtitles, and a station lamp that lights at some
// stone steps. Two groups of things are placed around the epigraph, never over it:
//
//   wire group   the Walkman, the wire, the earbud it ends in and the empty one
//   steps group  the stone steps, the lamp, its glow and a cassette on a step
//
// Layout works from the free space the epigraph leaves (computeLayout). The
// epigraph stays where the card puts it, so the decoration has to find room above,
// below or beside it, and gives up (mode "bare") when there is none: a reader who
// has made the text very large gets the subtitles and nothing behind them.
//
// All lengths are CSS pixels in the stage's own coordinates (the stage fills the
// screen). Nothing here reads the DOM.

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const rectWidth = (rect: Rect) => rect.right - rect.left;
export const rectHeight = (rect: Rect) => rect.bottom - rect.top;

export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export function intersects(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function inflate(rect: Rect, by: number): Rect {
  return { left: rect.left - by, top: rect.top - by, right: rect.right + by, bottom: rect.bottom + by };
}

export function boundsOf(points: readonly Point[], pad = 0): Rect {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const point of points) {
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  }
  return { left: left - pad, top: top - pad, right: right + pad, bottom: bottom + pad };
}

// ---------------------------------------------------------------------------
// Waiting for the Play button
// ---------------------------------------------------------------------------

/** The scene starts by itself, silent, when the reader has not pressed Play after this long. */
export const AUTO_START_MS = 6000;
/**
 * A reader who is on the Play button (hovering, focused or pressing it) holds
 * the countdown, so the scene does not start under their finger; but never for
 * longer than this in total.
 */
export const AUTO_START_CAP_MS = 12_000;

/** How long to wait from now, given how long the scene has been open. Never negative. */
export function autoStartDelayMs(openForMs: number, baseMs = AUTO_START_MS, capMs = AUTO_START_CAP_MS): number {
  const open = Number.isFinite(openForMs) ? Math.max(0, openForMs) : 0;
  return Math.max(0, Math.min(baseMs, capMs - open));
}

/** What starting the scene asks of the audio. */
export interface StartPlan {
  /** Ask the Walkman to switch itself on. Only a reader's own press is a gesture the browser accepts. */
  requestGesture: boolean;
  /** Play the scene's own tape click. The Walkman clicks by itself when it is switched on, so this is only for a Walkman that was on already. */
  ownClick: boolean;
}

/**
 * How the scene starts its sound. `pressedPlay`: the reader pressed the button (otherwise the
 * countdown ran out); `wasOn`: the Walkman was already on and not muted before this started.
 * Every call the plan leads to is a silent no-op while the Walkman is off.
 */
export function startPlan(pressedPlay: boolean, wasOn: boolean): StartPlan {
  return pressedPlay ? { requestGesture: true, ownClick: wasOn } : { requestGesture: false, ownClick: true };
}

export interface AutoStart {
  /** The reader is (true) or is no longer (false) on the Play button. */
  setEngaged(engaged: boolean): void;
  /** Stops the countdown for good (the scene started some other way, or is over). */
  cancel(): void;
}

/**
 * The countdown to the automatic start: `onStart` runs once, AUTO_START_MS after
 * the scene opened, unless the reader is on the Play button, which holds it; it
 * restarts when they leave, and never runs later than AUTO_START_CAP_MS in total.
 */
export function createAutoStart(onStart: () => void, now: () => number = () => performance.now()): AutoStart {
  const openedAt = now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let over = false;
  const stop = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const arm = () => {
    stop();
    timer = setTimeout(() => {
      if (over) return;
      over = true;
      onStart();
    }, autoStartDelayMs(now() - openedAt));
  };
  arm();
  return {
    setEngaged(engaged) {
      if (over) return;
      if (engaged) stop();
      else arm();
    },
    cancel() {
      over = true;
      stop();
    },
  };
}

// ---------------------------------------------------------------------------
// Subtitles
// ---------------------------------------------------------------------------

/** How long one character takes to fade in. Slow enough to read as a subtitle, not a typewriter. */
export const SUBTITLE_FADE_MS = 1100;
/** First character starting to the last one fully shown. About the middle of the 12 to 18 s the design asks for. */
export const SUBTITLE_REVEAL_MS = 15_000;
/** The class prologue.css reads: it hides the paragraph until its covers are in place. */
export const SUBTITLE_TEXT_CLASS = "tsuki-prologue__text";

// The gap before the next character, in units of one plain character. A space is
// a breath between phrases; the dots of an ellipsis are the long pause.
const WEIGHT_PLAIN = 1;
const WEIGHT_SPACE = 2.4;
const WEIGHT_DOT = 3.2;

export interface SubtitleSchedule {
  /** Start of each character's fade-in, in ms from the first character. delays[0] is 0. */
  readonly delaysMs: readonly number[];
  readonly fadeMs: number;
  /** From the first character starting to the last one fully shown. */
  readonly totalMs: number;
}

/**
 * Paces the epigraph: every character gets a start time, and the whole thing
 * lasts `revealMs`. Characters are not evenly spaced: a space waits a little
 * longer than a letter and each dot of an ellipsis longer still, so the text
 * breathes where the author's does.
 */
export function subtitleSchedule(
  clusters: readonly string[],
  revealMs = SUBTITLE_REVEAL_MS,
  fadeMs = SUBTITLE_FADE_MS,
): SubtitleSchedule {
  if (clusters.length === 0) return { delaysMs: [], fadeMs, totalMs: 0 };
  // The last character starts `fadeMs` before the end and so finishes on it. A text
  // too short for that (or an absurd fade) still gets a non-negative span.
  const span = Math.max(0, revealMs - fadeMs);
  const gaps = clusters.map((cluster) => (/^\s+$/.test(cluster) ? WEIGHT_SPACE : cluster === "." ? WEIGHT_DOT : WEIGHT_PLAIN));
  const before: number[] = [0];
  for (let index = 0; index < gaps.length - 1; index++) before.push(before[index] + gaps[index]);
  const total = before[before.length - 1];
  const delaysMs = before.map((weight) => (total > 0 ? (weight / total) * span : 0));
  return { delaysMs, fadeMs, totalMs: (delaysMs[delaysMs.length - 1] ?? 0) + fadeMs };
}

/** The cluster where `phrase` starts in the text the clusters spell, or -1. */
export function clusterIndexOf(clusters: readonly string[], phrase: string): number {
  if (phrase === "") return -1;
  const at = clusters.join("").indexOf(phrase);
  if (at < 0) return -1;
  let offset = 0;
  for (let index = 0; index < clusters.length; index++) {
    if (offset >= at) return index;
    offset += clusters[index].length;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// The subtitles' covers
// ---------------------------------------------------------------------------
//
// The epigraph is plain text, untouched: a black cover lies over each of its
// lines and slides off it, left to right, with a soft leading edge. Where the
// edge is at any moment is the pacing of subtitleSchedule: a character starts to
// show when the edge's far side reaches it and is whole when its near side has
// passed. That is the per-character fade this replaces, drawn by moving one
// element per line on the compositor instead of animating a hundred spans on
// the main thread (about two thirds of the scene's cost at a quarter of the
// speed). The one thing it cannot do is let the soft edge narrow in a pause: its
// width is fixed, and the edge slows down instead.

/** The box of one character cluster in the card's own coordinates. A cluster with no size (a space at a line's end) has all four zero. */
export interface ClusterBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The clusters first to last (inclusive) that sit on one line of the epigraph, and the line's extent. */
export interface TextLine {
  first: number;
  last: number;
  left: number;
  right: number;
  /** The line's own band: from the middle between it and the line above to the middle between it and the line below. The bands tile the paragraph. */
  top: number;
  bottom: number;
}

const hasSize = (box: ClusterBox) => box.right - box.left > 0.01 && box.bottom - box.top > 0.01;

/**
 * Groups the boxes of a text, cluster by cluster in reading order, into lines.
 * A cluster starts a new line when its middle is below the bottom of the line
 * so far; a cluster without a size belongs to the line it follows. `lineHeight`
 * (the paragraph's line height in pixels, 0 if unknown) gives the bands their
 * height when there is only one line to measure it from.
 */
export function groupLines(boxes: readonly ClusterBox[], lineHeight = 0): TextLine[] {
  interface Work {
    first: number;
    last: number;
    left: number;
    right: number;
    inkTop: number;
    inkBottom: number;
  }
  const work: Work[] = [];
  boxes.forEach((box, index) => {
    const current = work[work.length - 1];
    if (!hasSize(box)) {
      if (current) current.last = index;
      return;
    }
    const middle = (box.top + box.bottom) / 2;
    if (!current || middle > current.inkBottom) {
      work.push({ first: index, last: index, left: box.left, right: box.right, inkTop: box.top, inkBottom: box.bottom });
      return;
    }
    current.last = index;
    current.left = Math.min(current.left, box.left);
    current.right = Math.max(current.right, box.right);
    current.inkTop = Math.min(current.inkTop, box.top);
    current.inkBottom = Math.max(current.inkBottom, box.bottom);
  });
  // Bands: tile the paragraph, each line's from half way up to its neighbour to half way down to the next.
  const centres = work.map((line) => (line.inkTop + line.inkBottom) / 2);
  const pitch = centres.length > 1 ? (centres[centres.length - 1] - centres[0]) / (centres.length - 1) : lineHeight;
  return work.map((line, index) => {
    const height = pitch > 0 ? pitch : line.inkBottom - line.inkTop;
    const top = index > 0 ? (centres[index - 1] + centres[index]) / 2 : centres[index] - height / 2;
    const bottom = index < work.length - 1 ? (centres[index] + centres[index + 1]) / 2 : centres[index] + height / 2;
    return { first: line.first, last: line.last, left: line.left, right: line.right, top, bottom };
  });
}

/** The width of the soft edge, in pixels: how far the text moves along a line in the time one character takes to fade, at the pace of the whole text. */
export function featherFor(lines: readonly TextLine[], delaysMs: readonly number[], fadeMs: number): number {
  let width = 0;
  let time = 0;
  for (const line of lines) {
    const span = (delaysMs[line.last] ?? 0) - (delaysMs[line.first] ?? 0);
    if (span > 0) {
      width += line.right - line.left;
      time += span;
    }
  }
  const pace = time > 0 ? width / time : 0;
  return clamp(pace * fadeMs, 28, 260);
}

export interface SweepFrame {
  /** Milliseconds from the line's own start. */
  ms: number;
  /** Where the cover's left edge, the near side of its soft edge, is, in the card's coordinates. */
  x: number;
}

export interface LineSweep {
  /** When the line starts, in ms after the first character of the epigraph starts. */
  startMs: number;
  durationMs: number;
  /** At least two frames; x never decreases. */
  frames: SweepFrame[];
}

/**
 * How the cover of one line moves. The far side of its soft edge (x + feather)
 * is on a character when that character starts, so the edge follows the
 * characters' starts; after the last one starts it runs on at the pace of one
 * feather per fade until the whole line is clear.
 */
export function lineSweep(line: TextLine, boxes: readonly ClusterBox[], delaysMs: readonly number[], fadeMs: number, feather: number): LineSweep {
  const points: Array<{ ms: number; far: number }> = [];
  for (let index = line.first; index <= line.last; index++) {
    const box = boxes[index];
    if (!box || !hasSize(box)) continue;
    points.push({ ms: delaysMs[index] ?? 0, far: box.left });
  }
  if (points.length === 0) points.push({ ms: delaysMs[line.first] ?? 0, far: line.left });
  const startMs = points[0].ms;
  const last = points[points.length - 1];
  const endMs = Math.max(last.ms + fadeMs, startMs + 1);
  points.push({ ms: endMs, far: Math.max(last.far, line.right) + feather });

  const frames: SweepFrame[] = [];
  let x = -Infinity;
  let ms = -Infinity;
  for (const point of points) {
    // Never backwards in space (a mark that is drawn left of the letter before it) and never two frames at one moment.
    x = Math.max(x, point.far - feather);
    ms = Math.max(ms + 0.001, point.ms - startMs);
    frames.push({ ms, x });
  }
  return { startMs, durationMs: endMs - startMs, frames };
}

/** The words the lamp lights on: "จำชื่อ", remembering a name. */
export const LAMP_PHRASE = "จำชื่อ";
// Where in the text the lamp lights when the phrase is not found (the author
// reworded the epigraph): near the end, as the last clause lands.
const LAMP_FALLBACK = 0.72;
/** The lamp starts to warm this long before its phrase appears, so the light is already on the way when the words arrive. */
const LAMP_LEAD_S = 0.5;

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

/** Seconds, counted from the moment the scene starts (Play pressed or the countdown ended). */
export interface Timeline {
  /** The Walkman wakes and its reels begin to turn. */
  readonly begin: number;
  readonly wireStart: number;
  readonly wireEnd: number;
  /** The second earbud, the empty one, fades in. */
  readonly emptyStart: number;
  readonly emptyEnd: number;
  readonly subtitlesStart: number;
  /** The last character is fully shown. */
  readonly subtitlesEnd: number;
  readonly lampStart: number;
  readonly lampEnd: number;
  /** The scene ends: resolves handle.done. */
  readonly end: number;
}

const WIRE_START_S = 0.5;
const WIRE_DRAW_S = 5.2;
const EMPTY_FADE_S = 1.4;
const SUBTITLES_START_S = 2.4;
export const LAMP_FADE_S = 3.2;
/** The finished text and the lit lamp stay this long before the scene ends, so the last line can be read. */
const HOLD_S = 5;

export function buildTimeline(schedule: SubtitleSchedule, lampCluster: number): Timeline {
  const subtitlesEnd = SUBTITLES_START_S + schedule.totalMs / 1000;
  const lampDelay = schedule.delaysMs[clamp(lampCluster, 0, Math.max(0, schedule.delaysMs.length - 1))] ?? 0;
  // The lamp cannot warm before the scene has begun, nor so late that its glow is cut off by the end.
  const lampStart = clamp(SUBTITLES_START_S + lampDelay / 1000 - LAMP_LEAD_S, 1, Math.max(1, subtitlesEnd - 1));
  const wireEnd = WIRE_START_S + WIRE_DRAW_S;
  return {
    begin: 0,
    wireStart: WIRE_START_S,
    wireEnd,
    emptyStart: wireEnd + 0.2,
    emptyEnd: wireEnd + 0.2 + EMPTY_FADE_S,
    subtitlesStart: SUBTITLES_START_S,
    subtitlesEnd,
    lampStart,
    lampEnd: lampStart + LAMP_FADE_S,
    end: Math.max(subtitlesEnd, lampStart + LAMP_FADE_S) + HOLD_S,
  };
}

/** The cluster the lamp lights on for this text. */
export function lampClusterFor(clusters: readonly string[]): number {
  const found = clusterIndexOf(clusters, LAMP_PHRASE);
  return found >= 0 ? found : Math.floor(clusters.length * LAMP_FALLBACK);
}

/** 0 before `start`, 1 after `end`, linear between. A zero-length span steps. */
export function progressBetween(t: number, start: number, end: number): number {
  if (!(end > start)) return t >= end ? 1 : 0;
  return clamp((t - start) / (end - start), 0, 1);
}

export function easeInOutSine(x: number): number {
  const v = clamp(x, 0, 1);
  return 0.5 - Math.cos(Math.PI * v) / 2;
}

export function easeOutCubic(x: number): number {
  const v = clamp(x, 0, 1);
  return 1 - (1 - v) ** 3;
}

// ---------------------------------------------------------------------------
// Polylines: the wire
// ---------------------------------------------------------------------------

/** A Catmull-Rom spline through the points, sampled `perSegment` times between each pair. */
export function smoothPath(points: readonly Point[], perSegment = 10): Point[] {
  if (points.length < 3) return points.map((point) => ({ ...point }));
  const out: Point[] = [{ ...points[0] }];
  for (let index = 0; index < points.length - 1; index++) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    for (let step = 1; step <= perSegment; step++) {
      const t = step / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (p2.x - p0.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (3 * p1.x - p0.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (p2.y - p0.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (3 * p1.y - p0.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return out;
}

/** Running length along the polyline: lengths[0] is 0 and the last entry is the whole length. */
export function cumulativeLengths(points: readonly Point[]): number[] {
  const lengths: number[] = points.length > 0 ? [0] : [];
  for (let index = 1; index < points.length; index++) {
    lengths.push(lengths[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y));
  }
  return lengths;
}

export interface PathPosition {
  x: number;
  y: number;
  /** Direction of travel, radians (0 is to the right, positive is down). */
  angle: number;
}

/** The point `distance` along the polyline (clamped to its ends) and the direction of the path there. */
export function pointAtLength(points: readonly Point[], lengths: readonly number[], distance: number): PathPosition {
  if (points.length === 0) return { x: 0, y: 0, angle: 0 };
  if (points.length === 1) return { x: points[0].x, y: points[0].y, angle: 0 };
  const total = lengths[lengths.length - 1];
  const at = clamp(distance, 0, total);
  let low = 1;
  let high = points.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (lengths[mid] < at) low = mid + 1;
    else high = mid;
  }
  const a = points[low - 1];
  const b = points[low];
  const span = lengths[low] - lengths[low - 1];
  const f = span > 0 ? (at - lengths[low - 1]) / span : 0;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

/** The polyline from its start to `distance` along it: the part of the wire drawn so far. */
export function pathUpTo(points: readonly Point[], lengths: readonly number[], distance: number): Point[] {
  if (points.length === 0 || distance <= 0) return [];
  const total = lengths[lengths.length - 1];
  if (distance >= total) return points.slice();
  const end = pointAtLength(points, lengths, distance);
  const out: Point[] = [];
  for (let index = 0; index < points.length && lengths[index] <= distance; index++) out.push(points[index]);
  out.push({ x: end.x, y: end.y });
  return out;
}

// ---------------------------------------------------------------------------
// Motion for the compositor
// ---------------------------------------------------------------------------
//
// The wire is not redrawn every frame. It is drawn once, whole, and what moves
// is a handful of layers on the compositor: a black cover that slides off it,
// the earbud riding its tip (a transform and an opacity), the glow that comes
// up when the earbud arrives, and the empty earbud fading in. Each is a Web
// Animations keyframe list sampled here from the same path and easing the
// canvas used to follow, so the picture is the one the canvas drew and the main
// thread does nothing while it plays. The sample count only sets how smooth
// the straight pieces between samples are: the path is a gentle curve, so 56
// pieces over 5 s stay within a fraction of a pixel of it.

/** Keyframes per animation: pieces between them are straight and linear in time. */
export const WIRE_SAMPLES = 56;
/** The earbud's body is this many bud radii behind its tip's centre: the cover edge rides under it. */
export const COVER_UNDER_BUD = 0.6;
/** The glow at the earbud comes up over the last tenth of the wire's length. */
export const GLOW_FROM = 0.9;
export const GLOW_REST = 0.35;
/** The earbud fades in over the first twelfth of the wire's length. */
export const BUD_FADE_LENGTH = 1 / 12;

export interface WireStep {
  /** Position in the wire's time, 0 to 1. */
  offset: number;
  /** How far the wire has been drawn (0 to 1 of its length), after the easing. */
  drawn: number;
  /** The tip of the wire, where the earbud sits, and the direction the wire runs there. */
  x: number;
  y: number;
  angle: number;
  /** The earbud's opacity. */
  alpha: number;
  /** The glow's strength at the tip, GLOW_REST to 1. */
  glow: number;
}

/** The earbud's trip along the wire, sampled at even steps of time, drawn eased as the wire is. */
export function wireSteps(wire: Pick<WireGroup, "path" | "lengths">, samples = WIRE_SAMPLES): WireStep[] {
  const count = Math.max(2, Math.round(samples));
  const total = wire.lengths[wire.lengths.length - 1] ?? 0;
  const steps: WireStep[] = [];
  for (let index = 0; index <= count; index++) {
    const offset = index / count;
    const drawn = easeInOutSine(offset);
    const tip = pointAtLength(wire.path, wire.lengths, total * drawn);
    steps.push({
      offset,
      drawn,
      x: tip.x,
      y: tip.y,
      angle: tip.angle,
      alpha: Math.min(1, drawn / BUD_FADE_LENGTH),
      glow: GLOW_REST + (1 - GLOW_REST) * progressBetween(drawn, GLOW_FROM, 1),
    });
  }
  return steps;
}

/** How many keyframes the glow's rise and the empty earbud's fade-in get: both are short and smooth. */
export const FADE_SAMPLES = 14;

/** The glow's rise at the earbud, from the moment it starts (offset 0) to the wire's end (offset 1). */
export function glowSteps(samples = FADE_SAMPLES): Array<{ offset: number; glow: number }> {
  const count = Math.max(2, Math.round(samples));
  const from = glowStartOffset();
  const out: Array<{ offset: number; glow: number }> = [];
  for (let index = 0; index <= count; index++) {
    const offset = index / count;
    const drawn = easeInOutSine(from + (1 - from) * offset);
    out.push({ offset, glow: GLOW_REST + (1 - GLOW_REST) * progressBetween(drawn, GLOW_FROM, 1) });
  }
  return out;
}

/** The empty earbud fading in (ease-out), over the time it is given. */
export function emptyFadeSteps(samples = FADE_SAMPLES): Array<{ offset: number; opacity: number }> {
  const count = Math.max(2, Math.round(samples));
  return Array.from({ length: count + 1 }, (_, index) => ({ offset: index / count, opacity: easeOutCubic(index / count) }));
}

/** The time (0 to 1 of the wire's duration) at which the glow starts to come up. */
export function glowStartOffset(): number {
  // easeInOutSine is 0.5 - cos(pi x) / 2, so its inverse is acos(1 - 2 y) / pi.
  return Math.acos(1 - 2 * GLOW_FROM) / Math.PI;
}

/** A clock that can be paused, in the units of `now`: how long the scene has really been playing. */
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

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** The Walkman asset's own coordinates (walkman.svg, viewBox 96 by 72). */
export const WALKMAN_VIEWBOX = { width: 96, height: 72 } as const;
/** Where the earphone jack is on the asset: the right edge of the body, level with the cassette window. */
const JACK = { x: 88, y: 30 } as const;
/** cassette-mark.svg viewBox 120 by 72. */
export const CASSETTE_VIEWBOX = { width: 120, height: 72 } as const;

export interface LayoutInput {
  /** Size of the stage. */
  width: number;
  height: number;
  /**
   * What the decoration must stay clear of in the middle of the screen: the
   * epigraph, and in the reduced-motion still the continue button under it.
   * null when it cannot be measured.
   */
  keepOut: Rect | null;
  /**
   * The buttons along the bottom edge (Skip, and the controls beside it). Nothing
   * is placed over them, and the band they stand in is kept clear except between them.
   */
  buttons: readonly Rect[];
  /**
   * The dialog scrolls (the reader's text is very large): the text card then
   * moves over the stage while the stage stays put, so nothing can be placed.
   */
  scrolls: boolean;
}

export interface Bud {
  x: number;
  y: number;
  /** Direction the nozzle points, radians. */
  angle: number;
  /** Half the length of the bud's body. */
  r: number;
}

export interface WireGroup {
  zone: Rect;
  walkman: Rect;
  /** Where the wire leaves the Walkman. */
  jack: Point;
  path: Point[];
  lengths: number[];
  /** The earbud the wire ends in, at rest. */
  bud: Bud;
  /** The one that stays empty, with the loose end of its own short cable. */
  empty: Bud & { stub: Point[] };
  /** Stroke width of the wire. */
  lineWidth: number;
}

export interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface StepLevel {
  /** The vertical face of the step, seen from the front. */
  riser: Rect;
  /** The top of the step: a trapezoid, front edge first, narrower at the back. */
  tread: Point[];
}

export interface StepsGroup {
  zone: Rect;
  /** Basic length everything below is a multiple of. */
  unit: number;
  /** The flight from the bottom step up to the landing, each step narrower than the one below. */
  levels: StepLevel[];
  /** The top step: where the lamp and the cassette stand. */
  landing: { left: number; right: number; y: number };
  /** The bottom edge of the flight, where it fades into the dark. */
  baseY: number;
  lamp: {
    x: number;
    /** Foot of the post, on the landing. */
    footY: number;
    /** Top of the post, where the shade hangs from. */
    headY: number;
    shadeWidth: number;
    shadeHeight: number;
    bulb: Point;
    bulbRadius: number;
  };
  /** A cassette left on the landing beside the lamp, lit when the lamp is. */
  cassette: Rect & { angle: number };
  /** The lamp's glow in the air, and the light it throws on the steps. Both stay inside the zone, clear of the epigraph. */
  halo: Ellipse;
  pool: Ellipse;
}

export interface Layout {
  mode: "composed" | "bare";
  width: number;
  height: number;
  wire: WireGroup | null;
  steps: StepsGroup | null;
  /** The bounding box of every drawn thing, for the tests (and for clearing the dynamic layer). */
  ink: Rect[];
}

const WIRE_MAX_WIDTH = 900;
const WIRE_MIN_WIDTH = 200;
const WIRE_MIN_HEIGHT = 74;
const WALKMAN_MAX_WIDTH = 290;
const STEPS_MIN_UNIT = 7;
const STEPS_MAX_UNIT = 32;
/** A flight at least this big, below the epigraph, is used as it is; a smaller one gives way to a better place. */
const STEPS_GOOD_UNIT = 14;

export function emptyLayout(width: number, height: number): Layout {
  return { mode: "bare", width, height, wire: null, steps: null, ink: [] };
}

/** The free rectangles around the epigraph and the buttons along the bottom. */
function freeZones(input: LayoutInput, keep: Rect) {
  const side = Math.min(input.width, input.height);
  const margin = clamp(side * 0.04, 10, 28);
  const gap = clamp(side * 0.035, 12, 24);
  const bandTop = input.buttons.length > 0 ? Math.min(...input.buttons.map((button) => button.top)) : input.height;
  const aboveBand = bandTop - 10;
  const full = { left: margin, right: input.width - margin };
  // Between the buttons the band is free: a short landscape screen has no room under the
  // epigraph above them, but its middle has all the way down to the screen edge.
  const middle = input.width / 2;
  const leftEdge = Math.max(margin, ...input.buttons.filter((button) => button.left + button.right < middle * 2).map((button) => button.right + gap));
  const rightEdge = Math.min(input.width - margin, ...input.buttons.filter((button) => button.left + button.right >= middle * 2).map((button) => button.left - gap));
  return {
    top: { ...full, top: margin, bottom: keep.top - gap } as Rect,
    bottom: { ...full, top: keep.bottom + gap, bottom: aboveBand } as Rect,
    between: { left: leftEdge, right: rightEdge, top: keep.bottom + gap, bottom: input.height - margin } as Rect,
    left: { left: margin, right: keep.left - gap, top: margin, bottom: aboveBand } as Rect,
    right: { left: keep.right + gap, right: input.width - margin, top: margin, bottom: aboveBand } as Rect,
    gap,
  };
}

const usable = (zone: Rect) => rectWidth(zone) > 0 && rectHeight(zone) > 0;

/**
 * What is left of `zone` once `used` is taken out of it: the zone itself when
 * they do not touch, otherwise the taller of the parts above and below `used`.
 */
function without(zone: Rect, used: Rect | null, gap: number): Rect {
  if (!used || !intersects(zone, inflate(used, gap))) return zone;
  const above = { ...zone, bottom: Math.min(zone.bottom, used.top - gap) };
  const below = { ...zone, top: Math.max(zone.top, used.bottom + gap) };
  return rectHeight(above) >= rectHeight(below) ? above : below;
}

const translate = (point: Point, dy: number): Point => ({ x: point.x, y: point.y + dy });

/** Walkman, wire and the two earbuds, centred in `zone`. null when the zone is too small to read. */
export function placeWire(zone: Rect): WireGroup | null {
  const zoneWidth = Math.min(rectWidth(zone), WIRE_MAX_WIDTH);
  const zoneHeight = rectHeight(zone);
  if (zoneWidth < WIRE_MIN_WIDTH || zoneHeight < WIRE_MIN_HEIGHT) return null;
  const left = zone.left + (rectWidth(zone) - zoneWidth) / 2;
  const right = left + zoneWidth;

  const walkmanWidth = clamp(Math.min(zoneWidth * 0.44, zoneHeight * 0.7 * (WALKMAN_VIEWBOX.width / WALKMAN_VIEWBOX.height)), 72, WALKMAN_MAX_WIDTH);
  const walkmanHeight = (walkmanWidth * WALKMAN_VIEWBOX.height) / WALKMAN_VIEWBOX.width;
  // Built with the Walkman's top edge at y = 0 and moved down at the end, so the whole group sits in the middle of the zone.
  const walkman: Rect = { left, top: 0, right: left + walkmanWidth, bottom: walkmanHeight };
  const jack: Point = {
    x: walkman.left + (walkmanWidth * JACK.x) / WALKMAN_VIEWBOX.width,
    y: (walkmanHeight * JACK.y) / WALKMAN_VIEWBOX.height,
  };

  const r = clamp(walkmanWidth * 0.058, 5, 15);
  const lineWidth = clamp(walkmanWidth / 110, 1.2, 2.4);

  // The two earbuds end up facing each other near the right end of the group: the plugged one
  // on the end of the wire, the empty one a little beyond it, nozzle towards its pair.
  const end: Point = { x: right - r * 10.8, y: walkmanHeight * 0.8 };
  const dx = end.x - jack.x;
  const amplitude = clamp(Math.min(walkmanHeight * 0.5, dx * 0.09), 5, 44);
  // Offsets from the line that eases from the jack down to the earbud, as a fraction of `amplitude`:
  // the cable drops from the jack, rises in a lazy S and settles into the earbud.
  const wave: Array<[number, number]> = [
    [0, 0],
    [0.08, 0.5],
    [0.2, 0.95],
    [0.35, 0.7],
    [0.49, 0.05],
    [0.62, -0.4],
    [0.75, -0.3],
    [0.87, 0.1],
    [0.95, 0.2],
    [1, 0.08],
  ];
  const waypoints = wave.map(([s, offset]) => ({
    x: jack.x + dx * s,
    y: jack.y + (end.y - jack.y) * easeInOutSine(s) + amplitude * offset,
  }));
  const path = smoothPath(waypoints, 9);
  const lengths = cumulativeLengths(path);
  const tip = pointAtLength(path, lengths, lengths[lengths.length - 1]);

  const emptyAt: Point = { x: right - r * 6.2, y: end.y + r * 1.2 };
  const emptyAngle = Math.PI - 0.25;
  // The loose cable leaves the back of the empty bud, curls down once and stops in mid air.
  const back = { x: emptyAt.x - Math.cos(emptyAngle) * r * 1.2, y: emptyAt.y - Math.sin(emptyAngle) * r * 1.2 };
  const stub = smoothPath(
    [
      back,
      { x: back.x + r * 1.6, y: back.y - r * 0.4 },
      { x: back.x + r * 3, y: back.y + r * 0.3 },
      { x: back.x + r * 3.9, y: back.y + r * 1.5 },
    ],
    5,
  );

  // Move the group down so that what it spans, Walkman to loose end, is centred in the zone.
  const reach = boundsOf([...path, ...stub, { x: walkman.left, y: walkman.top }, { x: walkman.right, y: walkman.bottom }, { x: emptyAt.x, y: emptyAt.y + r * 2.4 }, { x: tip.x, y: tip.y - r * 2.4 }], lineWidth);
  const dy = zone.top + (zoneHeight - rectHeight(reach)) / 2 - reach.top;
  return {
    zone,
    walkman: { ...walkman, top: walkman.top + dy, bottom: walkman.bottom + dy },
    jack: translate(jack, dy),
    path: path.map((point) => translate(point, dy)),
    lengths,
    bud: { x: tip.x, y: tip.y + dy, angle: tip.angle, r },
    empty: { x: emptyAt.x, y: emptyAt.y + dy, angle: emptyAngle, r, stub: stub.map((point) => translate(point, dy)) },
    lineWidth,
  };
}

/**
 * Stone steps seen from the front, each narrower than the one below, with a lamp
 * and a cassette on the landing at the top. Bottom-aligned and centred in `zone`.
 * null when the zone is too small to read.
 */
export function placeSteps(zone: Rect): StepsGroup | null {
  const zoneWidth = rectWidth(zone);
  const zoneHeight = rectHeight(zone);
  // Sizes in units: a wide zone gets a broad flight of four steps; a narrow, tall
  // one three steps and a taller lamp. `height` counts the room the glow needs above the lamp.
  const tall = zoneWidth < zoneHeight * 1.1;
  const flight = tall
    ? { count: 3, top: 3.4, inset: 1, post: 3.6, height: 8.7 }
    : { count: 4, top: 5, inset: 1.3, post: 3.4, height: 9.6 };
  const bottomUnits = flight.top + 2 * (flight.count - 1) * flight.inset;
  const unit = Math.min(zoneHeight / flight.height, zoneWidth / bottomUnits, STEPS_MAX_UNIT);
  if (!(unit >= STEPS_MIN_UNIT)) return null;

  const riserHeight = unit * 0.85;
  const treadDepth = unit * 0.3;
  const period = riserHeight + treadDepth;
  const centreX = zone.left + zoneWidth / 2;
  const baseY = zone.bottom;

  const levels: StepLevel[] = [];
  for (let step = 0; step < flight.count; step++) {
    const half = (bottomUnits / 2 - step * flight.inset) * unit;
    const bottom = baseY - step * period;
    const riser: Rect = { left: centreX - half, top: bottom - riserHeight, right: centreX + half, bottom };
    // The back edge of the tread is a little narrower than the front one: the step recedes.
    const back = Math.min(half, treadDepth * 0.9);
    levels.push({
      riser,
      tread: [
        { x: riser.left, y: riser.top },
        { x: riser.right, y: riser.top },
        { x: riser.right - back, y: riser.top - treadDepth },
        { x: riser.left + back, y: riser.top - treadDepth },
      ],
    });
  }
  const top = levels[levels.length - 1];
  const landingY = top.riser.top - treadDepth * 0.45;
  const landing = { left: top.riser.left, right: top.riser.right, y: landingY };

  const post = unit * flight.post;
  const shadeWidth = unit * 1.15;
  const shadeHeight = unit * 0.45;
  const bulbRadius = unit * 0.22;
  const headY = landingY - post;
  const bulb = { x: centreX, y: headY + shadeHeight + bulbRadius * 0.7 };

  // A cassette left leaning on the landing, to one side of the lamp.
  const cassetteWidth = Math.min(unit * 1.8, (top.riser.right - top.riser.left) * 0.34);
  const cassetteHeight = (cassetteWidth * CASSETTE_VIEWBOX.height) / CASSETTE_VIEWBOX.width;
  const cassetteLeft = centreX - (top.riser.right - top.riser.left) * 0.31 - cassetteWidth / 2;
  const cassette = { left: cassetteLeft, top: landingY - cassetteHeight, right: cassetteLeft + cassetteWidth, bottom: landingY, angle: -0.14 };

  // The glow is as tall as the room above the lamp allows, and as wide as the zone allows.
  const roomAbove = Math.max(0, bulb.y - zone.top);
  const halfWidth = zoneWidth / 2;
  const haloRy = Math.min(roomAbove, unit * 3.1);
  const halo: Ellipse = { cx: centreX, cy: bulb.y, rx: Math.min(haloRy * 1.9, unit * 5.4, halfWidth), ry: haloRy };
  // Light thrown down onto the flight; it stops short of the bottom of the zone.
  const poolRy = Math.min(unit * 2.4, baseY - landingY - unit * 0.3, landingY - zone.top);
  const pool: Ellipse = { cx: centreX, cy: landingY, rx: Math.min(unit * 6.5, halfWidth), ry: Math.max(0, poolRy) };

  return {
    zone,
    unit,
    levels,
    landing,
    baseY,
    lamp: { x: centreX, footY: landingY, headY, shadeWidth, shadeHeight, bulb, bulbRadius },
    cassette,
    halo,
    pool,
  };
}

const ellipseBounds = (e: Ellipse): Rect => ({ left: e.cx - e.rx, top: e.cy - e.ry, right: e.cx + e.rx, bottom: e.cy + e.ry });

/** Bounding box of the earbuds: generous (r times the body length plus the nozzle). */
const budBounds = (bud: Bud): Rect => ({ left: bud.x - bud.r * 2.4, top: bud.y - bud.r * 2.4, right: bud.x + bud.r * 2.4, bottom: bud.y + bud.r * 2.4 });

/** Where everything goes, for a stage of this size around this epigraph. */
export function computeLayout(input: LayoutInput): Layout {
  const { width, height } = input;
  if (!(width > 0 && height > 0) || input.scrolls || !input.keepOut) return emptyLayout(width, height);

  const zones = freeZones(input, input.keepOut);
  const ink: Rect[] = [];

  // The wire group goes above the epigraph where there is room (the epigraph sits at
  // the middle of the screen), otherwise below it.
  let wire: WireGroup | null = null;
  for (const zone of [zones.top, zones.bottom]) {
    if (!usable(zone)) continue;
    wire = placeWire(zone);
    if (wire) break;
  }
  const wireBox = wire ? boundsOf([...wire.path, ...wire.empty.stub, { x: wire.walkman.left, y: wire.walkman.top }, { x: wire.walkman.right, y: wire.walkman.bottom }], wire.lineWidth + 1) : null;

  // The steps go below the epigraph, where they are centred in the picture, if they come out at a
  // good size there; otherwise wherever they come out biggest: between the buttons, or beside the epigraph.
  let steps: StepsGroup | null = null;
  for (const candidate of [zones.bottom, zones.between, zones.right, zones.left, zones.top]) {
    if (!usable(candidate)) continue;
    const placed = placeSteps(without(candidate, wireBox, zones.gap));
    if (!placed) continue;
    if (!steps || placed.unit > steps.unit + 0.5) steps = placed;
    if (steps.unit >= STEPS_GOOD_UNIT) break;
  }

  if (wire && wireBox) {
    ink.push(wire.walkman, boundsOf(wire.path, wire.lineWidth), budBounds(wire.bud), budBounds(wire.empty), boundsOf(wire.empty.stub, wire.lineWidth));
  }
  if (steps) {
    ink.push(
      boundsOf(steps.levels.flatMap((level) => [...level.tread, { x: level.riser.left, y: level.riser.bottom }, { x: level.riser.right, y: level.riser.bottom }])),
      { left: steps.lamp.x - steps.lamp.shadeWidth / 2, top: steps.lamp.headY, right: steps.lamp.x + steps.lamp.shadeWidth / 2, bottom: steps.lamp.footY },
      steps.cassette,
      ellipseBounds(steps.halo),
      ellipseBounds(steps.pool),
    );
  }
  if (!wire && !steps) return emptyLayout(width, height);
  return { mode: "composed", width, height, wire, steps, ink };
}
