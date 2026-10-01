// The pure maths behind scene-measure.ts, the Puppeteer harness that measures
// every Tsukinomi cutscene and the home page the same way (design section 7).
// No browser, no DOM, no file system here, so node:test covers it
// (scene-measure-core.test.ts) and the harness only has to feed it numbers.
//
// Four parts:
//
//   frame cost    what a window of CDP Performance.getMetrics samples says about
//                 main-thread time per animation frame, and how many frames the
//                 browser dropped, from requestAnimationFrame timestamps;
//   flashes       WCAG 2.3.1 "general flash" counting over a luminance series;
//   layout        the verdict on the rectangles the harness reads from the page;
//   gzip          transfer size of the dist chunks a scene is made of.
//
// What "ms per frame" counts, precisely (frameCost):
//
//   (TaskDuration at the end - TaskDuration at the start) / rAF frames in the
//   window. TaskDuration is the cumulative time the renderer's MAIN thread spent
//   inside tasks: page script, style recalculation, layout, paint recording,
//   event handlers, timers and garbage collection of that thread. It is
//   everything the page asks of the main thread, not only the scene, so it is
//   an upper bound for the scene (the idle floor of an empty page is about 0).
//   It does not include the compositor, raster and GPU threads or other
//   processes: a heavy canvas whose rasterisation runs off the main thread is
//   under-counted, which is why the harness also reports fps and dropped
//   frames. Under CPU throttling the harness emulates, a main-thread task is
//   stretched in wall time and TaskDuration is measured in wall time, so the
//   4x figure is the cost a 4x slower phone would see. ScriptDuration,
//   LayoutDuration and RecalcStyleDuration are nested inside tasks, and a
//   forced layout called from script is in both, so the parts are shown for
//   orientation and need not add up to the total; only taskMs is a budget.
//   Two CPU-time figures sit beside it because TaskDuration is wall time: a
//   busy machine or a throttled thread lengthens it without the page doing more
//   work. threadMs (ThreadTime) is what the main thread actually ran, and
//   processMs (ProcessTime) is the whole renderer process, compositor and
//   raster threads included, which is where software rendering hides its
//   cost. Both are only meaningful without CPU throttling: the emulation spins
//   the thread to slow it and that spin is counted (an idle page reads over
//   10 ms of "CPU" per frame at 4x), so the harness leaves them out at 4x. A page whose frame rate collapses can show a large cost per frame
//   and an almost idle main thread at once (busyFraction says which).
//
// What the flash maths does and does not claim (analyseFlashes): see the header
// of that function. In one line: it counts general flashes in a series of mean
// relative luminance samples; it cannot see a flash that is too small to move
// the mean, and a series sampled too slowly proves nothing (coverage says so).
import { gzipSync } from "node:zlib";

// ---------------------------------------------------------------------------
// Budgets (design section 7)
// ---------------------------------------------------------------------------

export const BUDGETS = {
  /** Mean main-thread ms per frame at 1x CPU. */
  desktopMs: 2,
  /** The same at CDP Emulation.setCPUThrottlingRate(4). */
  throttledMs: 6,
  /** WCAG 2.3.1: no more than three flashes in any one second. */
  flashesPerSecond: 3,
} as const;

export interface BudgetInput {
  desktopMs?: number | null;
  throttledMs?: number | null;
  /** Worst one-second flash count found (whole screen or any cell). */
  worstFlashes?: number | null;
  /** Sentences from judgeLayout(), across every viewport; each one is a failure. */
  layoutProblems?: readonly string[];
}

/** The budgets a measurement missed, as sentences. Missing numbers (a check that did not run) are not failures. */
export function budgetFailures(input: BudgetInput, budgets: typeof BUDGETS = BUDGETS): string[] {
  const out: string[] = [];
  if (isNumber(input.desktopMs) && input.desktopMs > budgets.desktopMs) {
    out.push(`desktop ${fixed(input.desktopMs, 2)} ms/frame is over the ${budgets.desktopMs} ms budget`);
  }
  if (isNumber(input.throttledMs) && input.throttledMs > budgets.throttledMs) {
    out.push(`4x CPU ${fixed(input.throttledMs, 2)} ms/frame is over the ${budgets.throttledMs} ms budget`);
  }
  if (isNumber(input.worstFlashes) && input.worstFlashes > budgets.flashesPerSecond) {
    out.push(`${input.worstFlashes} flashes in one second is over the limit of ${budgets.flashesPerSecond}`);
  }
  for (const problem of input.layoutProblems ?? []) out.push(`layout: ${problem}`);
  return out;
}

// ---------------------------------------------------------------------------
// (a) Frame cost
// ---------------------------------------------------------------------------

/** The Performance.getMetrics values the cost needs, all cumulative seconds except timestamp. */
export interface PerfSample {
  /** CDP monotonic clock in seconds. */
  timestamp: number;
  taskDuration: number;
  scriptDuration: number;
  layoutDuration: number;
  recalcStyleDuration: number;
  /** Cumulative CPU seconds of the main thread (ThreadTime); absent in browsers that do not report it. */
  threadTime?: number;
  /** Cumulative CPU seconds of the whole renderer process, compositor and raster threads included (ProcessTime). */
  processTime?: number;
}

export const PERF_METRIC_NAMES = ["Timestamp", "TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration"] as const;

/** Picks the five metrics out of CDP's `{ metrics: [{ name, value }] }` list. Throws when one is missing. */
export function perfSampleFromMetrics(metrics: ReadonlyArray<{ name: string; value: number }>): PerfSample {
  const byName = new Map(metrics.map((metric) => [metric.name, metric.value]));
  const read = (name: (typeof PERF_METRIC_NAMES)[number]): number => {
    const value = byName.get(name);
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Performance.getMetrics returned no ${name}`);
    return value;
  };
  const optional = (name: string): number | undefined => {
    const value = byName.get(name);
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  };
  const sample: PerfSample = {
    timestamp: read("Timestamp"),
    taskDuration: read("TaskDuration"),
    scriptDuration: read("ScriptDuration"),
    layoutDuration: read("LayoutDuration"),
    recalcStyleDuration: read("RecalcStyleDuration"),
  };
  const threadTime = optional("ThreadTime");
  const processTime = optional("ProcessTime");
  if (threadTime !== undefined) sample.threadTime = threadTime;
  if (processTime !== undefined) sample.processTime = processTime;
  return sample;
}

export interface FrameCost {
  frames: number;
  /** Wall-clock length of the window, seconds (CDP Timestamp delta). */
  windowSeconds: number;
  /** The budget figure: main-thread task ms per rAF frame. */
  taskMs: number;
  scriptMs: number;
  layoutMs: number;
  styleMs: number;
  /** taskMs - script - layout - style, never negative: paint recording, event dispatch, GC, everything else. */
  otherMs: number;
  /** Share of the window the main thread was busy, 0..1 (can pass 1 under throttling only through rounding). */
  busyFraction: number;
  /** rAF frames per second the page actually produced. */
  fps: number;
  /**
   * Main-thread CPU ms per frame (ThreadTime): the time the thread really ran, so
   * it excludes waiting for a busy machine and does not stretch under CPU
   * throttling. Null when the browser does not report it.
   */
  threadMs: number | null;
  /**
   * Renderer-process CPU ms per frame (ProcessTime): main thread plus the
   * compositor and raster threads, which software rendering puts in the
   * renderer. Null when the browser does not report it.
   */
  processMs: number | null;
}

/**
 * Mean main-thread cost per animation frame over one window.
 *
 * `frames` is the number of requestAnimationFrame callbacks that ran between the
 * two samples. Counters that run backwards (the renderer process was replaced by
 * a navigation or a crash) make the window meaningless and throw.
 */
export function frameCost(before: PerfSample, after: PerfSample, frames: number): FrameCost {
  if (!Number.isInteger(frames) || frames < 1) throw new RangeError(`frameCost needs at least one frame, got ${frames}`);
  const windowSeconds = after.timestamp - before.timestamp;
  if (!(windowSeconds > 0)) throw new RangeError("the metrics window has no length (Timestamp did not advance)");
  const delta = (key: "taskDuration" | "scriptDuration" | "layoutDuration" | "recalcStyleDuration"): number => {
    const d = after[key] - before[key];
    if (d < -1e-6) throw new RangeError(`${key} went backwards (${d.toFixed(4)} s): the page's process changed during the window`);
    return Math.max(0, d);
  };
  const task = delta("taskDuration");
  const script = delta("scriptDuration");
  const layout = delta("layoutDuration");
  const style = delta("recalcStyleDuration");
  const perFrameMs = (seconds: number) => (seconds * 1000) / frames;
  const optionalDelta = (key: "threadTime" | "processTime"): number | null => {
    const from = before[key];
    const to = after[key];
    return from === undefined || to === undefined ? null : perFrameMs(Math.max(0, to - from));
  };
  return {
    frames,
    windowSeconds,
    taskMs: perFrameMs(task),
    scriptMs: perFrameMs(script),
    layoutMs: perFrameMs(layout),
    styleMs: perFrameMs(style),
    otherMs: Math.max(0, perFrameMs(task - script - layout - style)),
    busyFraction: task / windowSeconds,
    fps: frames / windowSeconds,
    threadMs: optionalDelta("threadTime"),
    processMs: optionalDelta("processTime"),
  };
}

export interface FrameIntervalStats {
  /** rAF callbacks seen. */
  frames: number;
  refreshMs: number;
  meanMs: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
  /** Intervals longer than 1.5 refresh periods. */
  longFrames: number;
  /** Refresh slots in which no frame was produced (a 50 ms gap at 60 Hz misses two). */
  dropped: number;
  /** dropped / (intervals + dropped): the share of display refreshes with no new frame, 0..1. */
  droppedRatio: number;
}

export const DEFAULT_REFRESH_MS = 1000 / 60;

/**
 * Dropped frames from requestAnimationFrame timestamps (milliseconds, any
 * origin, ascending). An interval of d ms covers round(d / refresh) display
 * refreshes of which one carried the frame; the rest are dropped. Intervals up
 * to 1.5 refresh periods are on time (rAF timestamps jitter by a millisecond or
 * two). Assumes a 60 Hz display unless told otherwise.
 */
export function analyseFrameTimestamps(timestampsMs: readonly number[], refreshMs: number = DEFAULT_REFRESH_MS): FrameIntervalStats {
  if (!(refreshMs > 0)) throw new RangeError("refreshMs must be positive");
  const intervals: number[] = [];
  for (let i = 1; i < timestampsMs.length; i += 1) {
    const d = timestampsMs[i] - timestampsMs[i - 1];
    if (Number.isFinite(d) && d >= 0) intervals.push(d);
  }
  if (intervals.length === 0) {
    return { frames: timestampsMs.length, refreshMs, meanMs: 0, medianMs: 0, p95Ms: 0, maxMs: 0, longFrames: 0, dropped: 0, droppedRatio: 0 };
  }
  let longFrames = 0;
  let dropped = 0;
  for (const d of intervals) {
    if (d > refreshMs * 1.5) {
      longFrames += 1;
      dropped += Math.max(1, Math.round(d / refreshMs) - 1);
    }
  }
  const sorted = [...intervals].sort((a, b) => a - b);
  return {
    frames: timestampsMs.length,
    refreshMs,
    meanMs: intervals.reduce((sum, d) => sum + d, 0) / intervals.length,
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted[sorted.length - 1],
    longFrames,
    dropped,
    droppedRatio: dropped / (intervals.length + dropped),
  };
}

// ---------------------------------------------------------------------------
// (b) Luminance and WCAG 2.3.1 flashes
// ---------------------------------------------------------------------------

const SRGB_TO_LINEAR: Float64Array = (() => {
  const table = new Float64Array(256);
  for (let i = 0; i < 256; i += 1) {
    const c = i / 255;
    table[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  return table;
})();

/** WCAG relative luminance of one sRGB colour, channels 0..255, result 0..1. */
export function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (value: number) => SRGB_TO_LINEAR[Math.min(255, Math.max(0, Math.round(value)))];
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

type PixelBuffer = ArrayLike<number>;

/**
 * Mean WCAG relative luminance of a raw pixel buffer: each pixel is converted
 * to linear light and then averaged (averaging the sRGB values first would
 * not be a luminance). `channels` is 3 (RGB) or 4 (RGBA, alpha ignored).
 */
export function meanRelativeLuminance(pixels: PixelBuffer, channels: 3 | 4 = 3): number {
  const count = Math.floor(pixels.length / channels);
  if (count === 0) return 0;
  let sum = 0;
  for (let p = 0; p < count; p += 1) {
    const i = p * channels;
    sum += 0.2126 * SRGB_TO_LINEAR[pixels[i] & 255] + 0.7152 * SRGB_TO_LINEAR[pixels[i + 1] & 255] + 0.0722 * SRGB_TO_LINEAR[pixels[i + 2] & 255];
  }
  return sum / count;
}

/** Mean luminance of each cell of a cols x rows grid laid over the image, row by row. */
export function regionLuminances(pixels: PixelBuffer, width: number, height: number, channels: 3 | 4, cols: number, rows: number): number[] {
  if (width < 1 || height < 1 || cols < 1 || rows < 1) throw new RangeError("regionLuminances needs positive dimensions");
  const sums = new Float64Array(cols * rows);
  const counts = new Uint32Array(cols * rows);
  for (let y = 0; y < height; y += 1) {
    const row = Math.min(rows - 1, Math.floor((y * rows) / height));
    for (let x = 0; x < width; x += 1) {
      const cell = row * cols + Math.min(cols - 1, Math.floor((x * cols) / width));
      const i = (y * width + x) * channels;
      sums[cell] += 0.2126 * SRGB_TO_LINEAR[pixels[i] & 255] + 0.7152 * SRGB_TO_LINEAR[pixels[i + 1] & 255] + 0.0722 * SRGB_TO_LINEAR[pixels[i + 2] & 255];
      counts[cell] += 1;
    }
  }
  return Array.from(sums, (sum, cell) => (counts[cell] ? sum / counts[cell] : 0));
}

export interface LuminanceSample {
  /** Seconds, any origin. */
  t: number;
  /** Mean relative luminance, 0..1. */
  luminance: number;
}

export interface LuminanceTransition {
  direction: 1 | -1;
  from: number;
  to: number;
  /** When the value left its previous extreme (last sample still at it), seconds. */
  startT: number;
  /** When it first reached the new extreme, seconds. */
  endT: number;
}

const COMPARE_EPS = 1e-9;
/** Luminance within this of an extreme counts as still being on it (JPEG noise, rounding). */
const PLATEAU_EPS = 0.002;

interface Pivot {
  value: number;
  firstT: number;
  lastT: number;
}

/**
 * Splits a luminance series into its monotonic swings: the sequence of turning
 * points of a zig-zag filter that ignores every reversal smaller than
 * `minDelta`. A slow fade is one swing however many samples it has; a strobe
 * is one swing per half period. Every returned swing is at least `minDelta`
 * big, and consecutive swings alternate in direction. A held value (screencast
 * frames are only sent when the picture changes) is a plateau: a swing starts
 * at the last sample on the old plateau and ends at the first on the new one.
 */
export function findTransitions(samples: readonly LuminanceSample[], minDelta: number = 0.1): LuminanceTransition[] {
  const series = samples.filter((s) => Number.isFinite(s.t) && Number.isFinite(s.luminance)).sort((a, b) => a.t - b.t);
  if (series.length < 2) return [];
  const threshold = minDelta - COMPARE_EPS;
  const pivots: Pivot[] = [];
  const start = (s: LuminanceSample): Pivot => ({ value: s.luminance, firstT: s.t, lastT: s.t });
  let lo = start(series[0]);
  let hi = start(series[0]);
  let direction: 0 | 1 | -1 = 0;
  let candidate: Pivot = lo;

  for (let i = 1; i < series.length; i += 1) {
    const s = series[i];
    const v = s.luminance;
    if (direction === 0) {
      if (v < lo.value - PLATEAU_EPS) lo = start(s);
      else if (v <= lo.value + PLATEAU_EPS) lo.lastT = s.t;
      if (v > hi.value + PLATEAU_EPS) hi = start(s);
      else if (v >= hi.value - PLATEAU_EPS) hi.lastT = s.t;
      if (v - lo.value >= threshold) {
        pivots.push(lo);
        direction = 1;
        candidate = start(s);
      } else if (hi.value - v >= threshold) {
        pivots.push(hi);
        direction = -1;
        candidate = start(s);
      }
      continue;
    }
    if (direction === 1) {
      if (v > candidate.value + PLATEAU_EPS) candidate = start(s);
      else if (v >= candidate.value - PLATEAU_EPS) candidate.lastT = s.t;
      else if (candidate.value - v >= threshold) {
        pivots.push(candidate);
        direction = -1;
        candidate = start(s);
      }
    } else {
      if (v < candidate.value - PLATEAU_EPS) candidate = start(s);
      else if (v <= candidate.value + PLATEAU_EPS) candidate.lastT = s.t;
      else if (v - candidate.value >= threshold) {
        pivots.push(candidate);
        direction = 1;
        candidate = start(s);
      }
    }
  }
  if (direction !== 0) pivots.push(candidate);

  const out: LuminanceTransition[] = [];
  for (let i = 1; i < pivots.length; i += 1) {
    const a = pivots[i - 1];
    const b = pivots[i];
    out.push({ direction: b.value > a.value ? 1 : -1, from: a.value, to: b.value, startT: a.lastT, endT: b.firstT });
  }
  return out;
}

export interface FlashOptions {
  /** Flashes per second that are still allowed. WCAG 2.3.1: three. */
  limitPerSecond?: number;
  /** Smallest swing that counts, as an absolute relative luminance (10 % of the 0..1 scale). */
  minDelta?: number;
  /** A swing only counts when its darker end is below this (WCAG: 0.80). */
  darkBelow?: number;
  windowSeconds?: number;
}

export interface FlashAnalysis {
  samples: number;
  durationSeconds: number;
  /** Samples per second the series really had, from the median interval (a static picture sends no frames, so the mean would understate it). */
  typicalSampleRateHz: number;
  maxGapSeconds: number;
  /** Swings that were big enough and below the brightness ceiling. */
  transitions: number;
  /** Opposing pairs over the whole series, counted without overlap. */
  totalFlashes: number;
  /** The most flashes inside any one-second window. */
  worstWindowFlashes: number;
  /** Seconds from the first sample to the start of the worst window; null when there is none. */
  worstWindowStartSeconds: number | null;
  limitPerSecond: number;
  /** worstWindowFlashes > limit. */
  exceedsLimit: boolean;
  /** "sparse" when the sampling was too slow to see a flash rate just over the limit, so a pass proves little. */
  coverage: "ok" | "sparse";
  minReliableSampleRateHz: number;
}

/**
 * General flashes per WCAG 2.3.1 over a series of mean relative luminance
 * samples, and the worst one-second window.
 *
 * WCAG: a general flash is a pair of opposing changes in relative luminance of
 * 10 % or more of the maximum (1.0, so 0.1) where the darker value is below
 * 0.80; more than three in any one second fails. Here, findTransitions() gives
 * the swings; a swing counts when it is at least `minDelta` and its darker end
 * is below `darkBelow`; counted swings in a window pair up as an increase
 * followed by a decrease or the reverse, so a strobe at f Hz is f flashes a
 * second (2 f swings) and a single step or a fade is none. A window is every
 * span of `windowSeconds` that starts at a counted swing, and a swing is inside
 * it only when it starts and ends inside it.
 *
 * Limits, which the harness prints next to every result:
 *  - The input is the mean over a whole frame (or a grid cell). WCAG also asks
 *    for a minimum flashing area (about a tenth of the screen); the cell grid
 *    the harness adds is a conservative stand-in, but a flash in a smaller area
 *    than that is not detected, and neither is the red-flash rule.
 *  - Sampling can miss flashes: a series sampled below minReliableSampleRateHz
 *    (3 samples per period of the first rate over the limit) reports
 *    coverage "sparse".
 *  - The screencast is lossy JPEG on a downscaled picture, which adds a few
 *    thousandths of noise to the luminance; swings under 0.1 are not counted.
 */
export function analyseFlashes(samples: readonly LuminanceSample[], options: FlashOptions = {}): FlashAnalysis {
  const limit = options.limitPerSecond ?? BUDGETS.flashesPerSecond;
  const minDelta = options.minDelta ?? 0.1;
  const darkBelow = options.darkBelow ?? 0.8;
  const windowSeconds = options.windowSeconds ?? 1;

  const series = samples.filter((s) => Number.isFinite(s.t) && Number.isFinite(s.luminance)).sort((a, b) => a.t - b.t);
  const counted = findTransitions(series, minDelta).filter((tr) => Math.min(tr.from, tr.to) < darkBelow);

  let worst = 0;
  let worstStart: number | null = null;
  for (const anchor of counted) {
    const inside = counted.filter((tr) => tr.startT >= anchor.startT && tr.endT <= anchor.startT + windowSeconds + COMPARE_EPS);
    const pairs = countOpposingPairs(inside);
    if (pairs > worst) {
      worst = pairs;
      worstStart = anchor.startT - series[0].t;
    }
  }

  const gaps: number[] = [];
  for (let i = 1; i < series.length; i += 1) gaps.push(series[i].t - series[i - 1].t);
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const medianGap = percentile(sortedGaps, 0.5);
  const rate = medianGap > 0 ? 1 / medianGap : 0;
  const minRate = 3 * (limit + 1);
  return {
    samples: series.length,
    durationSeconds: series.length > 1 ? series[series.length - 1].t - series[0].t : 0,
    typicalSampleRateHz: rate,
    maxGapSeconds: sortedGaps.length ? sortedGaps[sortedGaps.length - 1] : 0,
    transitions: counted.length,
    totalFlashes: countOpposingPairs(counted),
    worstWindowFlashes: worst,
    worstWindowStartSeconds: worstStart,
    limitPerSecond: limit,
    exceedsLimit: worst > limit,
    coverage: rate >= minRate ? "ok" : "sparse",
    minReliableSampleRateHz: minRate,
  };
}

export interface LuminanceSecond {
  /** Whole seconds since the first sample. */
  second: number;
  samples: number;
  mean: number;
  min: number;
  max: number;
}

/**
 * The luminance series folded into one-second buckets (design section 7:
 * "sampled luminance per second for each scene"). A second with no sample (a
 * static picture sends no screencast frames) is left out, not filled.
 */
export function perSecondLuminance(samples: readonly LuminanceSample[]): LuminanceSecond[] {
  const series = samples.filter((s) => Number.isFinite(s.t) && Number.isFinite(s.luminance)).sort((a, b) => a.t - b.t);
  if (series.length === 0) return [];
  const origin = series[0].t;
  const buckets = new Map<number, number[]>();
  for (const s of series) {
    const second = Math.floor(s.t - origin + COMPARE_EPS);
    const bucket = buckets.get(second);
    if (bucket) bucket.push(s.luminance);
    else buckets.set(second, [s.luminance]);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([second, values]) => ({
      second,
      samples: values.length,
      mean: values.reduce((sum, v) => sum + v, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    }));
}

/** Greedy, non-overlapping pairs of consecutive swings in opposite directions. */
function countOpposingPairs(transitions: readonly LuminanceTransition[]): number {
  let pending: LuminanceTransition | null = null;
  let pairs = 0;
  for (const tr of transitions) {
    if (pending && pending.direction !== tr.direction) {
      pairs += 1;
      pending = null;
    } else {
      pending = tr;
    }
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// Layout verdict
// ---------------------------------------------------------------------------

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ControlSnapshot {
  /** Short name for messages: the class, the accessible text. */
  label: string;
  box: Box;
  /** Rendered: not hidden, not display:none, not transparent. */
  visible: boolean;
  /** elementFromPoint at the box's centre is the control or inside it: nothing covers it. */
  reachable: boolean;
}

export interface LayoutSnapshot {
  viewport: { width: number; height: number };
  /** document.documentElement.scrollWidth. */
  rootScrollWidth: number;
  /** The cutscene dialog's own scroll and client widths; null on a page with no dialog. */
  dialogScrollWidth: number | null;
  dialogClientWidth: number | null;
  /** Null on a page with no Skip button (the home page). */
  skip: ControlSnapshot | null;
  /** Every other visible button in the dialog. */
  controls: ControlSnapshot[];
  /** The epigraph paragraph's box; null on a page with no epigraph. */
  text: Box | null;
}

export interface LayoutOptions {
  /** Smallest touch target side, CSS px (design: 44). */
  minTarget?: number;
  /** The page must show a Skip button and an epigraph (a cutscene), not only fit. */
  expectCutscene?: boolean;
}

const BOX_TOLERANCE = 0.5;
const SIZE_TOLERANCE = 0.05;

export const boxesOverlap = (a: Box, b: Box): boolean => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;

const insideViewport = (box: Box, viewport: { width: number; height: number }): boolean =>
  box.left >= -BOX_TOLERANCE && box.top >= -BOX_TOLERANCE && box.right <= viewport.width + BOX_TOLERANCE && box.bottom <= viewport.height + BOX_TOLERANCE;

/**
 * What is wrong with one viewport's layout, as sentences; empty when it is
 * fine. The rules (design section 7): the page does not scroll sideways, Skip
 * and every other control are at least 44 px both ways, inside the viewport,
 * visible and not covered, the epigraph box is inside the viewport, and no
 * control sits over the epigraph.
 */
export function judgeLayout(snapshot: LayoutSnapshot, options: LayoutOptions = {}): string[] {
  const minTarget = options.minTarget ?? 44;
  const problems: string[] = [];
  const { viewport } = snapshot;

  if (snapshot.rootScrollWidth > viewport.width + 1) {
    problems.push(`horizontal scroll: the page is ${snapshot.rootScrollWidth}px wide in a ${viewport.width}px viewport`);
  }
  if (snapshot.dialogScrollWidth !== null && snapshot.dialogClientWidth !== null && snapshot.dialogScrollWidth > snapshot.dialogClientWidth + 1) {
    problems.push(`horizontal scroll inside the dialog: ${snapshot.dialogScrollWidth}px of content in ${snapshot.dialogClientWidth}px`);
  }

  const control = (name: string, c: ControlSnapshot) => {
    if (!c.visible) {
      problems.push(`${name} is not visible`);
      return;
    }
    if (c.box.width + SIZE_TOLERANCE < minTarget || c.box.height + SIZE_TOLERANCE < minTarget) {
      problems.push(`${name} is ${round1(c.box.width)}x${round1(c.box.height)}px, under ${minTarget}px`);
    }
    if (!insideViewport(c.box, viewport)) {
      problems.push(`${name} is outside the ${viewport.width}x${viewport.height} viewport (${boxText(c.box)})`);
    }
    if (!c.reachable) problems.push(`${name} is covered by another element at its centre`);
    if (snapshot.text && boxesOverlap(c.box, snapshot.text)) problems.push(`${name} overlaps the epigraph text`);
  };

  if (snapshot.skip) control(`Skip button`, snapshot.skip);
  else if (options.expectCutscene) problems.push("no Skip button found in the dialog");
  for (const c of snapshot.controls) control(`control "${c.label}"`, c);

  if (snapshot.text) {
    if (!insideViewport(snapshot.text, viewport)) {
      problems.push(`the epigraph text box is outside the ${viewport.width}x${viewport.height} viewport (${boxText(snapshot.text)})`);
    }
  } else if (options.expectCutscene) {
    problems.push("no epigraph text found in the dialog");
  }
  return problems;
}

// ---------------------------------------------------------------------------
// (c) gzip size of dist chunks
// ---------------------------------------------------------------------------

export interface ChunkFile {
  name: string;
  content: Uint8Array | string;
}

export interface ChunkSize {
  name: string;
  rawBytes: number;
  gzipBytes: number;
}

export interface ChunkTotal {
  files: ChunkSize[];
  rawBytes: number;
  gzipBytes: number;
}

/** Level 9 gzip: close to what a static host sends for text assets. */
export function gzipBytes(content: Uint8Array | string): number {
  return gzipSync(content, { level: 9 }).length;
}

const byteLength = (content: Uint8Array | string) => (typeof content === "string" ? Buffer.byteLength(content) : content.byteLength);
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The file name Vite gives a chunk: `<id>.<hash>.js` or `.css`, the hash being
 * 6 to 12 base64url characters. Matches the whole file name, so a scene whose
 * id is a prefix of another's does not pick it up.
 */
export function chunkNamePattern(id: string, extensions: readonly string[] = ["js", "css"]): RegExp {
  return new RegExp(`^${escapeRegExp(id)}\\.[A-Za-z0-9_-]{6,12}\\.(?:${extensions.map(escapeRegExp).join("|")})$`);
}

/** Raw and gzip size of every file whose name matches the pattern, and their sums. */
export function sumGzipByPattern(files: readonly ChunkFile[], pattern: RegExp): ChunkTotal {
  const matched = files
    .filter((file) => pattern.test(file.name))
    .map((file): ChunkSize => ({ name: file.name, rawBytes: byteLength(file.content), gzipBytes: gzipBytes(file.content) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    files: matched,
    rawBytes: matched.reduce((sum, f) => sum + f.rawBytes, 0),
    gzipBytes: matched.reduce((sum, f) => sum + f.gzipBytes, 0),
  };
}

/** Sibling files a built chunk imports statically (`import ... from "./x.js"` and `import "./x.js"`), not its dynamic import() calls. */
export function staticImports(source: string): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(/\bfrom\s*["']\.\/([^"'/]+\.js)["']/g)) found.add(match[1]);
  for (const match of source.matchAll(/\bimport\s*["']\.\/([^"'/]+\.js)["']/g)) found.add(match[1]);
  return [...found];
}

/**
 * The chunk and everything it imports statically, transitively, in discovery
 * order with the entry first. `read` returns a file's text or undefined when it
 * is not in the folder (then it is skipped, not an error).
 */
export function chunkClosure(entry: string, read: (name: string) => string | undefined): string[] {
  const seen: string[] = [];
  const queue = [entry];
  while (queue.length) {
    const name = queue.shift() as string;
    if (seen.includes(name)) continue;
    const text = read(name);
    if (text === undefined) continue;
    seen.push(name);
    queue.push(...staticImports(text));
  }
  return seen;
}

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

/** Linear-interpolated percentile of an ascending array; 0 for an empty one. */
export function percentile(sortedAscending: readonly number[], q: number): number {
  if (sortedAscending.length === 0) return 0;
  const position = Math.min(1, Math.max(0, q)) * (sortedAscending.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sortedAscending[lower] + (sortedAscending[upper] - sortedAscending[lower]) * (position - lower);
}

/** Bytes as KB with two decimals (1 KB = 1024 bytes, as the Vite build report prints). */
export const kilobytes = (bytes: number): number => Math.round((bytes / 1024) * 100) / 100;

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const fixed = (value: number, digits: number) => value.toFixed(digits);
const round1 = (value: number) => Math.round(value * 10) / 10;
const boxText = (box: Box) => `left ${round1(box.left)}, top ${round1(box.top)}, right ${round1(box.right)}, bottom ${round1(box.bottom)}`;
