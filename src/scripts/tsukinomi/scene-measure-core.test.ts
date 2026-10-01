// Unit tests for scene-measure-core.ts: the frame-cost arithmetic, the dropped
// frame count, WCAG 2.3.1 flash counting on synthetic luminance series (steady,
// slow fade, 2 Hz and 5 Hz strobes, a step), the layout verdict and the gzip
// summation. The browser side lives in scene-measure.ts and is proved against
// real pages by running it (see the round report), not here.
import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync } from "node:zlib";
import {
  BUDGETS,
  analyseFlashes,
  analyseFrameTimestamps,
  boxesOverlap,
  budgetFailures,
  chunkClosure,
  chunkNamePattern,
  findTransitions,
  frameCost,
  gzipBytes,
  judgeLayout,
  kilobytes,
  meanRelativeLuminance,
  percentile,
  perSecondLuminance,
  perfSampleFromMetrics,
  regionLuminances,
  relativeLuminance,
  staticImports,
  sumGzipByPattern,
  type Box,
  type ControlSnapshot,
  type LayoutSnapshot,
  type LuminanceSample,
  type PerfSample,
} from "./scene-measure-core";

const near = (actual: number, expected: number, tolerance: number, message?: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, message ?? `expected ${actual} to be within ${tolerance} of ${expected}`);

// --- synthetic luminance series -------------------------------------------

/** One sample every 1/rate seconds for `seconds`, luminance from fn(t). */
function series(seconds: number, rate: number, fn: (t: number) => number): LuminanceSample[] {
  const out: LuminanceSample[] = [];
  const count = Math.round(seconds * rate);
  for (let i = 0; i <= count; i += 1) {
    const t = i / rate;
    out.push({ t, luminance: fn(t) });
  }
  return out;
}

/** A square wave of `hz` full cycles a second: low for the first half cycle, high for the second. */
const square = (hz: number, low: number, high: number) => (t: number) => (Math.floor(t * hz * 2 + 1e-9) % 2 === 0 ? low : high);
const sine = (hz: number, mean: number, amplitude: number) => (t: number) => mean + amplitude * Math.sin(2 * Math.PI * hz * t);

/** Deterministic noise in -amplitude..amplitude, so the tests do not depend on Math.random. */
function noise(amplitude: number): () => number {
  let state = 12345;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return ((state / 0x7fffffff) * 2 - 1) * amplitude;
  };
}

// --- luminance --------------------------------------------------------------

test("relative luminance follows the WCAG formula", () => {
  assert.equal(relativeLuminance(0, 0, 0), 0);
  near(relativeLuminance(255, 255, 255), 1, 1e-12);
  near(relativeLuminance(255, 0, 0), 0.2126, 1e-6);
  near(relativeLuminance(0, 255, 0), 0.7152, 1e-6);
  near(relativeLuminance(0, 0, 255), 0.0722, 1e-6);
  // The textbook value for mid grey #808080 is 0.2159.
  near(relativeLuminance(128, 128, 128), 0.2159, 1e-4);
  // The linear toe: 10/255 is below the 0.04045 knee.
  near(relativeLuminance(10, 10, 10), 10 / 255 / 12.92, 1e-9);
});

test("mean luminance averages linear light per pixel, not the sRGB values", () => {
  // One black and one white pixel: mean linear light is 0.5; the mean sRGB value (128) would give 0.2159.
  const rgb = Uint8Array.from([0, 0, 0, 255, 255, 255]);
  near(meanRelativeLuminance(rgb, 3), 0.5, 1e-12);
  const rgba = Uint8Array.from([0, 0, 0, 255, 255, 255, 255, 0]);
  near(meanRelativeLuminance(rgba, 4), 0.5, 1e-12, "alpha must be ignored");
  assert.equal(meanRelativeLuminance(new Uint8Array(0), 3), 0);
});

test("regionLuminances gives the mean of each grid cell, row by row", () => {
  // 4 x 2 image: left half black, right half white.
  const px = [0, 0, 255, 255, 0, 0, 255, 255];
  const rgb = Uint8Array.from(px.flatMap((v) => [v, v, v]));
  assert.deepEqual(regionLuminances(rgb, 4, 2, 3, 2, 1).map((v) => Math.round(v)), [0, 1]);
  const cells = regionLuminances(rgb, 4, 2, 3, 2, 2);
  assert.equal(cells.length, 4);
  assert.deepEqual(cells.map((v) => Math.round(v)), [0, 1, 0, 1]);
  assert.throws(() => regionLuminances(rgb, 0, 2, 3, 1, 1), RangeError);
});

// --- frame cost ---------------------------------------------------------------

const sample = (timestamp: number, task: number, script = 0, layout = 0, style = 0): PerfSample => ({
  timestamp,
  taskDuration: task,
  scriptDuration: script,
  layoutDuration: layout,
  recalcStyleDuration: style,
});

test("frameCost is the main-thread task time per rAF frame", () => {
  // 5 s window, 300 frames, 0.6 s of tasks: 2 ms a frame, 12 % busy, 60 fps.
  const cost = frameCost(sample(10, 1.0, 0.4, 0.05, 0.02), sample(15, 1.6, 0.7, 0.08, 0.05), 300);
  near(cost.taskMs, 2, 1e-9);
  near(cost.scriptMs, 1, 1e-9);
  near(cost.layoutMs, 0.1, 1e-9);
  near(cost.styleMs, 0.1, 1e-9);
  near(cost.otherMs, 0.8, 1e-9);
  near(cost.busyFraction, 0.12, 1e-9);
  near(cost.fps, 60, 1e-9);
  assert.equal(cost.frames, 300);
  near(cost.windowSeconds, 5, 1e-12);
});

test("frameCost reports the CPU-time counters when the browser has them, and null when it has not", () => {
  const withCpu = (timestamp: number, task: number, thread: number, process: number): PerfSample => ({ ...sample(timestamp, task), threadTime: thread, processTime: process });
  // Wall task time 0.6 s but only 0.3 s of it was the thread running (the rest waiting for a busy CPU); the process, with raster threads, used 0.9 s.
  const cost = frameCost(withCpu(0, 0, 1, 2), withCpu(5, 0.6, 1.3, 2.9), 300);
  near(cost.taskMs, 2, 1e-9);
  assert.ok(cost.threadMs !== null && cost.processMs !== null);
  near(cost.threadMs, 1, 1e-9);
  near(cost.processMs, 3, 1e-9);
  const without = frameCost(sample(0, 0), sample(5, 0.6), 300);
  assert.equal(without.threadMs, null);
  assert.equal(without.processMs, null);
  const mixed = frameCost(withCpu(0, 0, 1, 2), sample(5, 0.6), 300);
  assert.equal(mixed.threadMs, null, "a counter missing from one end of the window is not guessed");
});

test("frameCost is zero for an idle window and never negative in its remainder", () => {
  const idle = frameCost(sample(0, 2, 1, 0, 0), sample(5, 2, 1, 0, 0), 300);
  assert.equal(idle.taskMs, 0);
  assert.equal(idle.otherMs, 0);
  // Layout forced from script is in both counters, so script + layout can exceed the task total.
  const overlapping = frameCost(sample(0, 0, 0, 0, 0), sample(1, 0.06, 0.05, 0.03, 0), 60);
  assert.equal(overlapping.otherMs, 0);
});

test("frameCost rejects a window it cannot trust", () => {
  assert.throws(() => frameCost(sample(0, 0), sample(5, 1), 0), RangeError);
  assert.throws(() => frameCost(sample(0, 0), sample(5, 1), 1.5), RangeError);
  assert.throws(() => frameCost(sample(5, 0), sample(5, 1), 10), /no length/);
  assert.throws(() => frameCost(sample(0, 3), sample(5, 1), 10), /went backwards/);
});

test("perfSampleFromMetrics reads the five metrics by name", () => {
  const metrics = [
    { name: "Documents", value: 3 },
    { name: "Timestamp", value: 100.5 },
    { name: "TaskDuration", value: 4.25 },
    { name: "ScriptDuration", value: 1.5 },
    { name: "LayoutDuration", value: 0.25 },
    { name: "RecalcStyleDuration", value: 0.125 },
  ];
  assert.deepEqual(perfSampleFromMetrics(metrics), sample(100.5, 4.25, 1.5, 0.25, 0.125));
  const withCpu = perfSampleFromMetrics([...metrics, { name: "ThreadTime", value: 4.2 }, { name: "ProcessTime", value: 6.5 }]);
  assert.equal(withCpu.threadTime, 4.2);
  assert.equal(withCpu.processTime, 6.5);
  assert.throws(() => perfSampleFromMetrics(metrics.filter((m) => m.name !== "TaskDuration")), /TaskDuration/);
});

// --- dropped frames -----------------------------------------------------------

const ticks = (count: number, intervalMs: number, start = 1000) => Array.from({ length: count }, (_, i) => start + i * intervalMs);

test("a steady 60 Hz run drops nothing", () => {
  const stats = analyseFrameTimestamps(ticks(301, 1000 / 60));
  assert.equal(stats.dropped, 0);
  assert.equal(stats.droppedRatio, 0);
  assert.equal(stats.longFrames, 0);
  near(stats.medianMs, 16.667, 0.01);
  near(stats.maxMs, 16.667, 0.01);
});

test("jitter inside 1.5 refresh periods is not a drop", () => {
  const stamps = [0, 16.7, 33.3, 58, 66.6, 83.3]; // one 24.7 ms interval
  assert.equal(analyseFrameTimestamps(stamps).dropped, 0);
});

test("a long gap drops the refreshes it spans", () => {
  // 50 ms covers three refresh slots; one carried the frame, two were dropped.
  const stamps = [0, 16.667, 33.333, 83.333, 100];
  const stats = analyseFrameTimestamps(stamps);
  assert.equal(stats.longFrames, 1);
  assert.equal(stats.dropped, 2);
  near(stats.droppedRatio, 2 / (4 + 2), 1e-9);
  near(stats.maxMs, 50, 1e-9);
});

test("a 30 fps page on a 60 Hz display drops every other refresh", () => {
  const stats = analyseFrameTimestamps(ticks(31, 1000 / 30));
  assert.equal(stats.dropped, 30);
  near(stats.droppedRatio, 0.5, 1e-9);
  const onA30HzDisplay = analyseFrameTimestamps(ticks(31, 1000 / 30), 1000 / 30);
  assert.equal(onA30HzDisplay.dropped, 0);
});

test("frame timestamps with fewer than two entries give zeroes", () => {
  assert.equal(analyseFrameTimestamps([]).droppedRatio, 0);
  assert.equal(analyseFrameTimestamps([5]).frames, 1);
  assert.throws(() => analyseFrameTimestamps([0, 1], 0), RangeError);
});

// --- flashes -------------------------------------------------------------------

test("a steady luminance has no swings and no flashes", () => {
  const result = analyseFlashes(series(5, 30, () => 0.3));
  assert.equal(result.transitions, 0);
  assert.equal(result.worstWindowFlashes, 0);
  assert.equal(result.exceedsLimit, false);
  assert.equal(result.worstWindowStartSeconds, null);
  assert.equal(result.coverage, "ok");
});

test("noise under the threshold on a steady picture is ignored", () => {
  const n = noise(0.02);
  const result = analyseFlashes(series(5, 30, () => 0.3 + n()));
  assert.equal(result.transitions, 0);
  assert.equal(result.exceedsLimit, false);
});

test("a slow fade is one swing and no flash", () => {
  const fade = series(5, 30, (t) => 0.1 + (0.8 * t) / 5);
  const swings = findTransitions(fade);
  assert.equal(swings.length, 1);
  assert.equal(swings[0].direction, 1);
  near(swings[0].from, 0.1, 1e-9);
  near(swings[0].to, 0.9, 1e-9);
  const result = analyseFlashes(fade);
  assert.equal(result.worstWindowFlashes, 0);
  assert.equal(result.exceedsLimit, false);
});

test("a slow fade up and down (a 4 s triangle) never puts a pair inside one second", () => {
  const triangle = series(12, 30, (t) => {
    const phase = (t % 4) / 4;
    return 0.1 + 0.8 * (phase < 0.5 ? phase * 2 : 2 - phase * 2);
  });
  const result = analyseFlashes(triangle);
  assert.ok(result.transitions >= 4);
  assert.equal(result.worstWindowFlashes, 0);
  assert.ok(result.totalFlashes >= 2, "over the whole series they are flashes, just slow ones");
  assert.equal(result.exceedsLimit, false);
});

test("a single step is one swing and no flash", () => {
  const step = series(4, 30, (t) => (t < 2 ? 0.1 : 0.6));
  const result = analyseFlashes(step);
  assert.equal(result.transitions, 1);
  assert.equal(result.totalFlashes, 0);
  assert.equal(result.worstWindowFlashes, 0);
  assert.equal(result.exceedsLimit, false);
});

test("a step up and back down is one flash", () => {
  const pulse = series(4, 30, (t) => (t >= 1 && t < 1.3 ? 0.7 : 0.1));
  const result = analyseFlashes(pulse);
  assert.equal(result.transitions, 2);
  assert.equal(result.worstWindowFlashes, 1);
  assert.equal(result.exceedsLimit, false);
});

test("a 2 Hz strobe is two flashes a second and allowed", () => {
  for (const rate of [120, 60, 30]) {
    const result = analyseFlashes(series(5, rate, square(2, 0.1, 0.7)));
    assert.equal(result.worstWindowFlashes, 2, `at ${rate} samples/s`);
    assert.equal(result.exceedsLimit, false);
    assert.equal(result.coverage, "ok");
  }
});

test("a 3 Hz strobe is exactly at the limit and allowed", () => {
  const result = analyseFlashes(series(5, 120, square(3, 0.1, 0.7)));
  assert.equal(result.worstWindowFlashes, 3);
  assert.equal(result.exceedsLimit, false);
});

test("a 4 Hz strobe is over the limit", () => {
  const result = analyseFlashes(series(5, 120, square(4, 0.1, 0.7)));
  assert.ok(result.worstWindowFlashes >= 4, `counted ${result.worstWindowFlashes}`);
  assert.equal(result.exceedsLimit, true);
});

test("a 5 Hz strobe is flagged, as a square wave and as a sine", () => {
  for (const [name, fn] of [
    ["square", square(5, 0.05, 0.85)],
    ["sine", sine(5, 0.45, 0.35)],
  ] as const) {
    for (const rate of [120, 60, 30]) {
      const result = analyseFlashes(series(5, rate, fn));
      assert.equal(result.exceedsLimit, true, `${name} at ${rate} samples/s counted ${result.worstWindowFlashes}`);
      assert.ok(result.worstWindowFlashes >= 4, `${name} at ${rate}: ${result.worstWindowFlashes}`);
      assert.ok(result.worstWindowStartSeconds !== null && result.worstWindowStartSeconds >= 0);
    }
  }
});

test("a 5 Hz strobe is still flagged through a noisy, held-value series", () => {
  const n = noise(0.015);
  const noisy = series(4, 60, (t) => square(5, 0.1, 0.7)(t) + n());
  assert.equal(analyseFlashes(noisy).exceedsLimit, true);
  // A screencast only sends a frame when the picture changes: keep only the samples where the value moved.
  const base = series(4, 240, square(5, 0.1, 0.7));
  const changesOnly = base.filter((s, i) => i === 0 || s.luminance !== base[i - 1].luminance);
  assert.ok(changesOnly.length < base.length / 10);
  assert.equal(analyseFlashes(changesOnly).exceedsLimit, true);
});

test("a strobe whose darker value is 0.80 or brighter does not count", () => {
  // 0.85 <-> 0.99 is a 14 % swing, but both ends are above the ceiling.
  assert.equal(analyseFlashes(series(5, 120, square(5, 0.85, 0.99))).exceedsLimit, false);
  // The same swing starting below the ceiling counts.
  assert.equal(analyseFlashes(series(5, 120, square(5, 0.7, 0.85))).exceedsLimit, true);
});

test("a strobe under 10 percent of the range does not count", () => {
  assert.equal(analyseFlashes(series(5, 120, square(5, 0.3, 0.38))).exceedsLimit, false);
  assert.equal(analyseFlashes(series(5, 120, square(5, 0.3, 0.41))).exceedsLimit, true);
});

test("a series sampled too slowly is reported as sparse", () => {
  const slow = analyseFlashes(series(10, 6, square(0.5, 0.1, 0.7)));
  assert.equal(slow.coverage, "sparse");
  assert.equal(slow.minReliableSampleRateHz, 12);
  assert.equal(analyseFlashes(series(10, 30, square(0.5, 0.1, 0.7))).coverage, "ok");
});

test("samples may arrive out of order and with non-finite values", () => {
  const shuffled = series(2, 60, square(5, 0.1, 0.7)).reverse();
  shuffled.push({ t: Number.NaN, luminance: 0.5 }, { t: 1, luminance: Number.NaN });
  assert.equal(analyseFlashes(shuffled).exceedsLimit, true);
  assert.equal(analyseFlashes([]).samples, 0);
  assert.equal(analyseFlashes([{ t: 0, luminance: 0.5 }]).worstWindowFlashes, 0);
});

test("findTransitions alternates direction and keeps each swing at least the threshold", () => {
  const swings = findTransitions(series(3, 120, square(2, 0.1, 0.7)));
  assert.ok(swings.length >= 5);
  swings.forEach((swing, i) => {
    assert.ok(Math.abs(swing.to - swing.from) >= 0.1);
    if (i > 0) assert.notEqual(swing.direction, swings[i - 1].direction);
    assert.ok(swing.endT >= swing.startT);
  });
});

test("perSecondLuminance folds the series into one-second buckets and skips empty seconds", () => {
  const samples: LuminanceSample[] = [
    { t: 10, luminance: 0.2 },
    { t: 10.5, luminance: 0.4 },
    { t: 11.2, luminance: 0.8 },
    { t: 13.9, luminance: 0.1 },
  ];
  const seconds = perSecondLuminance(samples);
  assert.deepEqual(seconds.map((s) => s.second), [0, 1, 3]);
  near(seconds[0].mean, 0.3, 1e-12);
  assert.equal(seconds[0].min, 0.2);
  assert.equal(seconds[0].max, 0.4);
  assert.equal(seconds[0].samples, 2);
  assert.equal(seconds[2].mean, 0.1);
  assert.deepEqual(perSecondLuminance([]), []);
});

// --- budgets ---------------------------------------------------------------------

test("budgetFailures names every missed budget and ignores checks that did not run", () => {
  assert.deepEqual(budgetFailures({}), []);
  assert.deepEqual(budgetFailures({ desktopMs: 1.99, throttledMs: 6, worstFlashes: 3 }), []);
  const failures = budgetFailures({ desktopMs: 2.5, throttledMs: 7.25, worstFlashes: 5, layoutProblems: ["Skip button is outside the viewport"] });
  assert.equal(failures.length, 4);
  assert.match(failures[0], /desktop 2\.50 ms\/frame.*2 ms budget/);
  assert.match(failures[1], /4x CPU 7\.25/);
  assert.match(failures[2], /5 flashes/);
  assert.match(failures[3], /^layout: Skip button/);
  assert.equal(BUDGETS.desktopMs, 2);
  assert.equal(BUDGETS.throttledMs, 6);
  assert.equal(BUDGETS.flashesPerSecond, 3);
});

// --- layout verdict ---------------------------------------------------------------

const box = (left: number, top: number, width: number, height: number): Box => ({ left, top, width, height, right: left + width, bottom: top + height });
const control = (label: string, b: Box, over: Partial<ControlSnapshot> = {}): ControlSnapshot => ({ label, box: b, visible: true, reachable: true, ...over });
const goodLayout = (): LayoutSnapshot => ({
  viewport: { width: 375, height: 812 },
  rootScrollWidth: 375,
  dialogScrollWidth: 375,
  dialogClientWidth: 375,
  skip: control("Skip", box(300, 20, 60, 44)),
  controls: [control("Play", box(20, 740, 120, 48))],
  text: box(24, 300, 327, 180),
});

test("a layout that fits has no problems", () => {
  assert.deepEqual(judgeLayout(goodLayout(), { expectCutscene: true }), []);
});

test("horizontal scroll, on the page or in the dialog, is a problem", () => {
  const wide = { ...goodLayout(), rootScrollWidth: 420 };
  assert.match(judgeLayout(wide).join("|"), /horizontal scroll: the page is 420px/);
  const dialogWide = { ...goodLayout(), dialogScrollWidth: 500 };
  assert.match(judgeLayout(dialogWide).join("|"), /inside the dialog/);
  assert.deepEqual(judgeLayout({ ...goodLayout(), rootScrollWidth: 376 }), [], "one pixel of rounding is tolerated");
});

test("Skip and controls must be 44 px, inside the viewport, visible, uncovered", () => {
  const small = { ...goodLayout(), skip: control("Skip", box(300, 20, 40, 44)) };
  assert.match(judgeLayout(small).join("|"), /Skip button is 40x44px, under 44px/);
  const short = { ...goodLayout(), controls: [control("Play", box(20, 740, 120, 30))] };
  assert.match(judgeLayout(short).join("|"), /control "Play" is 120x30px/);
  const off = { ...goodLayout(), skip: control("Skip", box(340, 20, 60, 44)) };
  assert.match(judgeLayout(off).join("|"), /Skip button is outside the 375x812 viewport/);
  const hidden = { ...goodLayout(), skip: control("Skip", box(300, 20, 60, 44), { visible: false }) };
  assert.match(judgeLayout(hidden).join("|"), /Skip button is not visible/);
  const covered = { ...goodLayout(), controls: [control("Play", box(20, 740, 120, 48), { reachable: false })] };
  assert.match(judgeLayout(covered).join("|"), /control "Play" is covered/);
  assert.deepEqual(judgeLayout({ ...goodLayout(), skip: control("Skip", box(300, 20, 43.98, 44)) }), [], "float noise under 0.05 px is tolerated");
});

test("the epigraph box must be inside the viewport and clear of the controls", () => {
  const tall = { ...goodLayout(), text: box(24, 300, 327, 600) };
  assert.match(judgeLayout(tall).join("|"), /epigraph text box is outside/);
  const under = { ...goodLayout(), controls: [control("Play", box(20, 350, 120, 48))] };
  assert.match(judgeLayout(under).join("|"), /control "Play" overlaps the epigraph text/);
  assert.equal(boxesOverlap(box(0, 0, 10, 10), box(10, 0, 10, 10)), false, "touching edges do not overlap");
  assert.equal(boxesOverlap(box(0, 0, 10, 10), box(5, 5, 10, 10)), true);
});

test("a cutscene page with no Skip button or no epigraph is a problem; a plain page is not", () => {
  const bare: LayoutSnapshot = { viewport: { width: 375, height: 812 }, rootScrollWidth: 375, dialogScrollWidth: null, dialogClientWidth: null, skip: null, controls: [], text: null };
  assert.deepEqual(judgeLayout(bare), []);
  const problems = judgeLayout(bare, { expectCutscene: true });
  assert.deepEqual(problems, ["no Skip button found in the dialog", "no epigraph text found in the dialog"]);
});

// --- gzip ------------------------------------------------------------------------------

test("chunk name patterns match Vite file names exactly", () => {
  const js = chunkNamePattern("prologue");
  assert.equal(js.test("prologue.AbCd1234.js"), true);
  assert.equal(js.test("prologue.AbCd1234.css"), true);
  assert.equal(js.test("prologue-core.AbCd1234.js"), false);
  assert.equal(js.test("prologue.AbCd1234.js.map"), false);
  assert.equal(js.test("xprologue.AbCd1234.js"), false);
  assert.equal(chunkNamePattern("prologue", ["css"]).test("prologue.AbCd1234.js"), false);
  assert.equal(chunkNamePattern("part-1-autumn-rain").test("part-1-autumn-rain.D_x-9z01.js"), true);
  assert.equal(chunkNamePattern("a.b").test("aXb.AbCd1234.js"), false, "the id is literal, not a regular expression");
});

test("sumGzipByPattern sums what gzip really produces for the matching files only", () => {
  const scene = "const frame = () => requestAnimationFrame(frame);\n".repeat(200);
  const style = ".fog { opacity: 0.4; }\n".repeat(80);
  const other = "export const unrelated = 1;\n".repeat(500);
  const files = [
    { name: "part-1-autumn-rain.AbCd1234.js", content: scene },
    { name: "part-1-autumn-rain.EfGh5678.css", content: style },
    { name: "part-2-twilight-lamp.AbCd1234.js", content: other },
    { name: "part-1-autumn-rain.AbCd1234.js.map", content: other },
  ];
  const total = sumGzipByPattern(files, chunkNamePattern("part-1-autumn-rain"));
  assert.deepEqual(total.files.map((f) => f.name), ["part-1-autumn-rain.AbCd1234.js", "part-1-autumn-rain.EfGh5678.css"]);
  assert.equal(total.files[0].gzipBytes, gzipSync(scene, { level: 9 }).length);
  assert.equal(total.files[1].gzipBytes, gzipSync(style, { level: 9 }).length);
  assert.equal(total.gzipBytes, total.files[0].gzipBytes + total.files[1].gzipBytes);
  assert.equal(total.rawBytes, Buffer.byteLength(scene) + Buffer.byteLength(style));
  assert.ok(total.gzipBytes < total.rawBytes / 10, "repetitive text compresses a lot");
  const none = sumGzipByPattern(files, chunkNamePattern("part-9-nothing"));
  assert.deepEqual(none, { files: [], rawBytes: 0, gzipBytes: 0 });
});

test("gzipBytes accepts bytes and text alike and counts multibyte text in bytes", () => {
  const thai = "ข้อความภาษาไทย".repeat(20);
  assert.equal(gzipBytes(thai), gzipBytes(Buffer.from(thai)));
  const total = sumGzipByPattern([{ name: "x.AbCd1234.js", content: thai }], chunkNamePattern("x"));
  assert.equal(total.rawBytes, Buffer.byteLength(thai));
  assert.ok(total.rawBytes > thai.length);
});

test("staticImports reads static and side-effect imports and skips dynamic ones", () => {
  const source =
    'import{a as b}from"./session.AbCd1234.js";import "./side.AbCd1234.js";import x from \'./graphemes.AbCd1234.js\';' +
    'const later=()=>import("./dynamic.AbCd1234.js");export{b};import{y}from"https://cdn.example/x.js";import{z}from"../up.js";';
  assert.deepEqual(staticImports(source).sort(), ["graphemes.AbCd1234.js", "session.AbCd1234.js", "side.AbCd1234.js"]);
  assert.deepEqual(staticImports("const a = 1;"), []);
});

test("chunkClosure follows static imports transitively, once each, entry first", () => {
  const files: Record<string, string> = {
    "scene.AbCd1234.js": 'import{a}from"./runtime.AbCd1234.js";import{b}from"./audio.AbCd1234.js";',
    "runtime.AbCd1234.js": 'import{c}from"./shared.AbCd1234.js";',
    "audio.AbCd1234.js": 'import{c}from"./shared.AbCd1234.js";import"./gone.AbCd1234.js";',
    "shared.AbCd1234.js": "export const c = 1;",
  };
  const closure = chunkClosure("scene.AbCd1234.js", (name) => files[name]);
  assert.deepEqual(closure, ["scene.AbCd1234.js", "runtime.AbCd1234.js", "audio.AbCd1234.js", "shared.AbCd1234.js"]);
  assert.deepEqual(chunkClosure("missing.AbCd1234.js", (name) => files[name]), []);
  const cyclic: Record<string, string> = { "a.AbCd1234.js": 'import"./b.AbCd1234.js";', "b.AbCd1234.js": 'import"./a.AbCd1234.js";' };
  assert.deepEqual(chunkClosure("a.AbCd1234.js", (name) => cyclic[name]), ["a.AbCd1234.js", "b.AbCd1234.js"]);
});

// --- helpers ---------------------------------------------------------------------------------

test("kilobytes and percentile", () => {
  assert.equal(kilobytes(1024), 1);
  assert.equal(kilobytes(1536), 1.5);
  assert.equal(kilobytes(0), 0);
  assert.equal(percentile([], 0.5), 0);
  assert.equal(percentile([4], 0.95), 4);
  assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3);
  near(percentile([1, 2, 3, 4], 0.5), 2.5, 1e-12);
  near(percentile([0, 10], 0.95), 9.5, 1e-12);
});
