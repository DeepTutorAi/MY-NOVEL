// Measurement harness for the Tsukinomi cutscenes and the home page (design
// section 7): frame cost, flash safety, layout at five viewports and the gzip
// size of a scene's chunk, measured the same way for every target so the
// numbers of one round can be compared with the next.
//
//   pnpm tsukinomi:measure <baseUrl> [options]
//   pnpm exec tsx src/scripts/tsukinomi/scene-measure.ts http://localhost:4321 --dist dist --json out.json
//
//   --targets a,b,c   prologue, part-1 .. part-5, home (default: all seven);
//                     also home-scroll (the home page scrolled top to bottom) and
//                     url:<path> (any page, relative to baseUrl, measured like home)
//   --checks list     frame, flash, layout, gzip (default: all four; gzip needs --dist)
//   --dist dir        a built site: report the gzip size of each scene's chunk
//                     (with --checks gzip alone no server or browser is needed)
//   --json file       also write every number to a JSON file
//   --window-ms n     length of one frame-cost window (default 5000)
//   --windows n       consecutive windows to average (default 1)
//   --settle-ms n     wait after the scene starts before the first window (default 1500;
//                     7000 for the prologue, see SETTLE_OVERRIDES)
//   --page-ms n       length of the flash capture for pages (home, url:) (default 12000)
//   --max-scene-ms n  longest a scene may play during the flash capture (default 60000)
//   --viewports list  WxH,WxH (default the five design viewports plus 1280x800)
//   --no-throttle     skip the 4x CPU pass
//   --no-warmup       do not visit each target once first (a dev server compiles on first visit)
//   --no-touch        use a mouse, not touch emulation, at the phone viewports
//   --ignore-console re   console errors matching this regular expression are not counted
//   --home-chunk re   dist chunk-name pattern of the home page's script (default concourse)
//   --chrome path     Chromium binary (default PUPPETEER_EXECUTABLE_PATH, then /opt/pw-browsers)
//
// Exit code: 0 all budgets met, 2 a budget or layout rule missed, 1 the harness
// could not measure something (the table still prints every number it has).
//
// Every pass opens a fresh browser context, so no cooldown stamp, cache or
// earlier scene leaks into the next, and a scene is always replayed with
// ?cutscene=replay.
//
// METHOD
//
//   Frame cost. After the scene reports data-state="playing" (and the settle
//   time), a requestAnimationFrame counter runs in the page and CDP
//   Performance.getMetrics is sampled every second for the window. Cost is the
//   delta of TaskDuration (cumulative main-thread task time) divided by the rAF
//   frames in the window; see the header of scene-measure-core.ts for exactly
//   what that counts. The pass runs at 1280x800 with no throttling and again
//   with Emulation.setCPUThrottlingRate(4). Dropped frames come from the rAF
//   timestamps against a 60 Hz refresh. The counter stops by itself when the
//   scene ends, so a short scene reports the seconds it had. Beside the budget
//   figure each line shows the main thread's busy share of the window, its CPU
//   ms per frame (ThreadTime: unlike TaskDuration it is not stretched by a busy
//   machine) and the whole renderer process's CPU ms per frame (compositor and
//   raster threads included). The "harness floor" is the same measurement of an
//   empty page: the counter and the browser producing frames cost that much in
//   every figure.
//
//   Flash safety. Page.startScreencast (jpeg, 320 px wide, every frame) runs for
//   the scene's whole duration (pages: --page-ms). Each frame is decoded with
//   sharp, scaled to 48x30 and reduced to the mean WCAG relative luminance of the
//   whole frame and of each cell of a 3x3 grid; analyseFlashes() counts general
//   flashes per WCAG 2.3.1 in the worst one-second window of each series. The
//   budget uses the worse of the whole-frame and the worst-cell count (a cell is
//   about 11 % of the screen, close to WCAG's minimum flashing area).
//
//   Layout. At each viewport the scene is replayed and, about 1 s and 3.5 s
//   after it starts, the page is read: no horizontal scroll, Skip and every
//   other visible control in the dialog at least 44 x 44 CSS px, inside the
//   viewport and not covered, the epigraph box inside the viewport and clear of
//   the controls. Phone viewports use touch emulation (pointer: coarse). Any
//   console error or uncaught page error during a target is reported with it.
//   Pages other than scenes (home, url:) are checked for horizontal scroll and
//   console errors only: they have no Skip button, and their many inline links
//   are not 44 px targets by design.
//
//   Gzip. For --dist, the chunk named after the scene (registry id) in
//   dist/_astro, its CSS if it has a separate file, and the chunks it imports
//   statically, at gzip level 9. Scene CSS is imported with ?inline, so it is
//   already inside the JS figure; the unminified source CSS is listed beside it.
//
// LIMITS (printed again under the table)
//
//   - Numbers from a dev server include Vite's HMR client and unminified code;
//     the orchestrator measures the production build for the report.
//   - Headless Chromium renders in software (no GPU): rasterisation that a
//     phone's GPU would do is on the CPU here, off the main thread, so it is not
//     in the main-thread figure (the renderer-process figure includes it). Frame
//     cost is a main-thread cost; fps and dropped frames show when the whole
//     pipeline could not keep up. A page with heavy filters or blends can fall
//     to a few frames a second here while its main thread idles: then the
//     per-frame figure is large and the busy share small, and both are reported.
//   - The machine is shared and TaskDuration is wall time, so another process
//     competing for the CPU inflates it; the load average is printed, and
//     the CPU-time figures are the cross-check.
//   - 4x throttling slows the renderer's main thread only. It is an emulation of a
//     slow phone, not a measurement of one.
//   - Flash analysis sees only changes in the mean of the whole screen and of nine
//     cells. A flash in a smaller area, a red flash and any flash between two
//     screencast frames are not detected. The screencast rate achieved is
//     reported; below 12 frames a second the result is marked sparse.
//   - A scene that needs input (the prologue's Play, part 1's wiping, part 3's
//     hold) is measured on its no-input path, which is what plays by itself.
//   - One run is one sample: expect a few tenths of a millisecond of noise
//     between runs; compare numbers from the same machine.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { type Browser, type BrowserContext, type CDPSession, type Page } from "puppeteer";
import sharp from "sharp";
import { registryEntry } from "./cutscene/registry";
import {
  BUDGETS,
  analyseFlashes,
  analyseFrameTimestamps,
  budgetFailures,
  chunkClosure,
  chunkNamePattern,
  frameCost,
  gzipBytes,
  judgeLayout,
  kilobytes,
  meanRelativeLuminance,
  perSecondLuminance,
  perfSampleFromMetrics,
  regionLuminances,
  sumGzipByPattern,
  type ChunkFile,
  type FlashAnalysis,
  type FrameCost,
  type FrameIntervalStats,
  type LayoutSnapshot,
  type LuminanceSample,
  type LuminanceSecond,
  type PerfSample,
} from "./scene-measure-core";

// ---------------------------------------------------------------------------
// Targets and options
// ---------------------------------------------------------------------------

interface Target {
  name: string;
  kind: "scene" | "page";
  /** Path below the base URL, with any query. */
  path: string;
  part?: number;
  /** The page is scrolled top to bottom while it is measured. */
  scroll?: boolean;
}

const SCENE_TARGETS: Record<string, { part: number; slug: string }> = {
  prologue: { part: 0, slug: "00-introduction" },
  "part-1": { part: 1, slug: "01-discovery" },
  "part-2": { part: 2, slug: "02-reveal" },
  "part-3": { part: 3, slug: "03-decision" },
  "part-4": { part: 4, slug: "04-mountain" },
  "part-5": { part: 5, slug: "05-ten-years" },
};
const DEFAULT_TARGETS = ["prologue", "part-1", "part-2", "part-3", "part-4", "part-5", "home"];

/**
 * Targets whose first seconds are not the scene proper. The prologue waits for
 * the reader to press Play and starts by itself after 6 s without input (design
 * section 4.3), so its first window opens after that.
 */
const SETTLE_OVERRIDES: Record<string, number> = { prologue: 7000 };

const DESKTOP = { width: 1280, height: 800 };
const DESIGN_VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 812, height: 375 },
  { width: 667, height: 375 },
  { width: 915, height: 412 },
  DESKTOP,
];

type Check = "frame" | "flash" | "layout" | "gzip";

interface Options {
  base: string;
  targets: Target[];
  checks: Set<Check>;
  dist: string | null;
  json: string | null;
  windowMs: number;
  windows: number;
  settleMs: number | null;
  pageMs: number;
  maxSceneMs: number;
  viewports: { width: number; height: number }[];
  throttle: boolean;
  warmup: boolean;
  touch: boolean;
  ignoreConsole: RegExp | null;
  homeChunk: RegExp;
  chrome: string | null;
}

function fail(message: string): never {
  console.error(`scene-measure: ${message}`);
  process.exit(1);
}

function parseArgs(argv: readonly string[]): Options {
  const flags = new Map<string, string | true>();
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const [name, inline] = arg.slice(2).split(/=(.*)/s, 2);
    const booleans = ["no-throttle", "no-warmup", "no-touch", "help"];
    if (inline !== undefined) flags.set(name, inline);
    else if (booleans.includes(name)) flags.set(name, true);
    else {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) fail(`--${name} needs a value`);
      flags.set(name, value);
      i += 1;
    }
  }
  if (flags.has("help")) {
    console.log("See the comment at the top of src/scripts/tsukinomi/scene-measure.ts for the options.");
    process.exit(0);
  }
  const text = (name: string) => {
    const value = flags.get(name);
    return typeof value === "string" ? value : null;
  };
  const integer = (name: string, fallback: number, min = 1) => {
    const value = text(name);
    if (value === null) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min) fail(`--${name} must be an integer of at least ${min}, got "${value}"`);
    return parsed;
  };

  const rawBase = positional[0] ?? "http://localhost:4321";
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  const targets: Target[] = [];
  for (const name of (text("targets") ?? DEFAULT_TARGETS.join(",")).split(",").map((n) => n.trim()).filter(Boolean)) {
    const scene = SCENE_TARGETS[name];
    if (scene) targets.push({ name, kind: "scene", part: scene.part, path: `tsukinomi/sections/${scene.slug}/?cutscene=replay` });
    else if (name === "home") targets.push({ name, kind: "page", path: "tsukinomi/" });
    else if (name === "home-scroll") targets.push({ name, kind: "page", path: "tsukinomi/", scroll: true });
    else if (name.startsWith("url:")) targets.push({ name, kind: "page", path: name.slice(4).replace(/^\//, "") });
    else fail(`unknown target "${name}" (prologue, part-1..part-5, home, home-scroll, url:<path>)`);
  }
  if (targets.length === 0) fail("no targets");

  const checks = new Set<Check>();
  for (const name of (text("checks") ?? "frame,flash,layout,gzip").split(",").map((n) => n.trim()).filter(Boolean)) {
    if (!["frame", "flash", "layout", "gzip"].includes(name)) fail(`unknown check "${name}" (frame, flash, layout, gzip)`);
    checks.add(name as Check);
  }

  let viewports = DESIGN_VIEWPORTS;
  const viewportText = text("viewports");
  if (viewportText) {
    viewports = viewportText.split(",").map((entry) => {
      const match = /^(\d+)x(\d+)$/.exec(entry.trim());
      if (!match) fail(`--viewports wants WxH,WxH, got "${entry}"`);
      return { width: Number(match[1]), height: Number(match[2]) };
    });
  }

  const dist = text("dist");
  if (dist && !existsSync(path.join(dist, "_astro"))) fail(`--dist ${dist} has no _astro folder: is it a built site?`);
  const settle = text("settle-ms");

  return {
    base,
    targets,
    checks,
    dist,
    json: text("json"),
    windowMs: integer("window-ms", 5000, 1000),
    windows: integer("windows", 1),
    settleMs: settle === null ? null : integer("settle-ms", 1500, 0),
    pageMs: integer("page-ms", 12_000, 2000),
    maxSceneMs: integer("max-scene-ms", 60_000, 5000),
    viewports,
    throttle: !flags.has("no-throttle"),
    warmup: !flags.has("no-warmup"),
    touch: !flags.has("no-touch"),
    ignoreConsole: text("ignore-console") ? new RegExp(text("ignore-console") as string) : null,
    homeChunk: new RegExp(text("home-chunk") ?? "concourse"),
    chrome: text("chrome"),
  };
}

// ---------------------------------------------------------------------------
// Browser plumbing
// ---------------------------------------------------------------------------

const NAV_TIMEOUT = 60_000;
const DEFAULT_SETTLE_MS = 1500;
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const targetUrl = (base: string, relative: string) => new URL(relative, base).href;

/** The Chromium to drive: --chrome, PUPPETEER_EXECUTABLE_PATH, the newest under PLAYWRIGHT_BROWSERS_PATH (or /opt/pw-browsers); else Puppeteer's own. */
function findChrome(explicit: string | null): string | undefined {
  const given = explicit ?? process.env.PUPPETEER_EXECUTABLE_PATH;
  if (given) return given;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  const folders = readdirSync(root)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const folder of folders) {
    const candidate = path.join(root, folder, "chrome-linux", "chrome");
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

async function launchBrowser(options: Options): Promise<Browser> {
  const args: string[] = [];
  // Chromium refuses to start its sandbox as root (a container).
  if (typeof process.getuid === "function" && process.getuid() === 0) args.push("--no-sandbox");
  return puppeteer.launch({ headless: true, executablePath: findChrome(options.chrome), args });
}

/**
 * Installed in every document before its scripts run. __name: tsx wraps named
 * functions in a helper that does not exist in the page. __measure: a
 * requestAnimationFrame counter that keeps every frame timestamp, stops by
 * itself when the cutscene dialog leaves the "playing" state (so a scene that
 * ends inside a window is not diluted by idle frames), and an optional
 * top-to-bottom scroll driver. A string, not a function, so it is not rewritten.
 */
const PAGE_SCRIPT = `
globalThis.__name = (fn) => fn;
(() => {
  const m = { running: false, frames: 0, stamps: [], watch: false };
  globalThis.__measure = m;
  const loop = (ts) => {
    if (!m.running) return;
    if (m.watch) {
      const dialog = document.querySelector("dialog.tsuki-cutscene");
      if (!dialog || dialog.dataset.state !== "playing") { m.running = false; return; }
    }
    m.frames += 1;
    m.stamps.push(ts);
    requestAnimationFrame(loop);
  };
  m.start = (watch) => { m.frames = 0; m.stamps = []; m.watch = !!watch; m.running = true; requestAnimationFrame(loop); };
  m.read = () => ({ frames: m.frames, running: m.running, stamps: m.stamps.length });
  m.finish = () => { m.running = false; return m.stamps; };
  m.scroll = (ms) => {
    const begin = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - begin) / ms);
      const max = document.documentElement.scrollHeight - innerHeight;
      scrollTo({ top: max * progress, behavior: "instant" });
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
})();
`;

interface MeasureApi {
  start(watch: boolean): void;
  read(): { frames: number; running: boolean; stamps: number };
  finish(): number[];
  scroll(ms: number): void;
}

interface PageOptions {
  viewport?: { width: number; height: number };
  touch?: boolean;
}

interface Session {
  context: BrowserContext;
  page: Page;
  client: CDPSession;
  close(): Promise<void>;
}

/** One fresh context and page, its console errors and uncaught page errors added to `errors`. */
async function openSession(browser: Browser, errors: Set<string>, options: Options, pageOptions: PageOptions = {}): Promise<Session> {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(45_000);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT);
  const note = (text: string) => {
    if (options.ignoreConsole?.test(text)) return;
    errors.add(text.slice(0, 300));
  };
  page.on("pageerror", (error) => note(`page error: ${error instanceof Error ? error.message : String(error)}`));
  page.on("console", (message) => {
    if (message.type() === "error") note(`console error: ${message.text()}${message.location().url ? ` (${message.location().url})` : ""}`);
  });
  await page.evaluateOnNewDocument(PAGE_SCRIPT);
  const touch = pageOptions.touch ?? false;
  await page.setViewport({ ...(pageOptions.viewport ?? DESKTOP), deviceScaleFactor: 1, isMobile: touch, hasTouch: touch });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  const client = await page.createCDPSession();
  return { context, page, client, close: () => context.close().catch(() => undefined) };
}

async function waitForPlaying(page: Page, timeout = 45_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const dialog = document.querySelector<HTMLDialogElement>("dialog.tsuki-cutscene");
      return dialog?.open === true && dialog.dataset.state === "playing";
    },
    { timeout, polling: "raf" },
  );
}

/** Resolves true when the dialog has ended (finished or skipped), false when `timeout` ms passed first. */
async function waitForEnded(page: Page, timeout: number): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => {
        const dialog = document.querySelector<HTMLDialogElement>("dialog.tsuki-cutscene");
        return dialog !== null && !dialog.open && ["finished", "skipped"].includes(dialog.dataset.state ?? "");
      },
      { timeout, polling: 250 },
    );
    return true;
  } catch {
    return false;
  }
}

/** Opens the target and returns once the scene plays (scenes) or the page has loaded (pages). */
async function openTarget(session: Session, target: Target, options: Options): Promise<void> {
  const url = targetUrl(options.base, target.path);
  const response = await session.page.goto(url, { waitUntil: target.kind === "scene" ? "domcontentloaded" : "load" });
  if (!response?.ok()) throw new Error(`${url} answered ${response ? response.status() : "nothing"}`);
  if (target.kind === "scene") await waitForPlaying(session.page);
}

const settleFor = (target: Target, options: Options): number => options.settleMs ?? SETTLE_OVERRIDES[target.name] ?? DEFAULT_SETTLE_MS;

// ---------------------------------------------------------------------------
// Frame cost
// ---------------------------------------------------------------------------

interface FrameRun {
  cpuThrottle: 1 | 4;
  cost: FrameCost;
  intervals: FrameIntervalStats;
  /** Worst single second of the window, task ms per frame (a peak the mean hides). */
  peakSecondMs: number;
  /** Worst whole window when --windows is more than one. */
  worstWindowMs: number;
  windowsMeasured: number;
  /** Seconds measured (can be less than asked when the scene ended). */
  seconds: number;
  sceneEnded: boolean;
}

interface Tick {
  perf: PerfSample;
  frames: number;
  running: boolean;
  stamps: number;
}

async function takeTick(session: Session): Promise<Tick> {
  const [metrics, state] = await Promise.all([
    session.client.send("Performance.getMetrics"),
    session.page.evaluate(() => (globalThis as unknown as { __measure: MeasureApi }).__measure.read()),
  ]);
  return { perf: perfSampleFromMetrics(metrics.metrics), frames: state.frames, running: state.running, stamps: state.stamps };
}

interface SampleSpec {
  /** Stop counting when the cutscene dialog leaves "playing" (scenes). */
  watchDialog: boolean;
  /** Scroll the page top to bottom over this many ms while sampling; 0 for no scrolling. */
  scrollMs: number;
  /** Seconds to sample, one CDP reading per second. */
  seconds: number;
  /** Length of one window, ms (the worst of several windows is reported next to the mean). */
  windowMs: number;
}

/** Samples an already open and settled page; the caller has enabled Performance and set any throttling. */
async function sampleFrames(session: Session, cpuThrottle: 1 | 4, spec: SampleSpec): Promise<FrameRun> {
  await session.page.evaluate(
    (watchDialog: boolean, scrollMs: number) => {
      const api = (globalThis as unknown as { __measure: MeasureApi }).__measure;
      api.start(watchDialog);
      if (scrollMs > 0) api.scroll(scrollMs);
    },
    spec.watchDialog,
    spec.scrollMs,
  );
  const opened = Date.now();
  const ticks: Tick[] = [await takeTick(session)];
  for (let second = 1; second <= spec.seconds; second += 1) {
    await pause(Math.max(0, opened + second * 1000 - Date.now()));
    const tick = await takeTick(session);
    if (!tick.running && spec.watchDialog) break; // the scene ended during this second: its frames are not a scene's
    ticks.push(tick);
  }
  const stamps = await session.page.evaluate(() => (globalThis as unknown as { __measure: MeasureApi }).__measure.finish());
  if (ticks.length < 2) throw new Error("the scene ended within a second of the window opening: nothing to measure");

  const last = ticks[ticks.length - 1];
  const measured = ticks.length - 1;
  const cost = frameCost(ticks[0].perf, last.perf, last.frames - ticks[0].frames);
  const perSecond: number[] = [];
  for (let i = 1; i < ticks.length; i += 1) {
    const frames = ticks[i].frames - ticks[i - 1].frames;
    if (frames > 0) perSecond.push(frameCost(ticks[i - 1].perf, ticks[i].perf, frames).taskMs);
  }
  const windowSecs = Math.max(1, Math.round(spec.windowMs / 1000));
  const windowMeans: number[] = [];
  for (let start = 0; start + windowSecs <= measured; start += windowSecs) {
    const frames = ticks[start + windowSecs].frames - ticks[start].frames;
    if (frames > 0) windowMeans.push(frameCost(ticks[start].perf, ticks[start + windowSecs].perf, frames).taskMs);
  }
  return {
    cpuThrottle,
    // The CPU throttle spins the thread to slow it, so ThreadTime and ProcessTime count that spin: only valid at 1x.
    cost: cpuThrottle === 1 ? cost : { ...cost, threadMs: null, processMs: null },
    intervals: analyseFrameTimestamps(stamps.slice(ticks[0].stamps, last.stamps)),
    peakSecondMs: Math.max(...perSecond, 0),
    worstWindowMs: Math.max(...windowMeans, cost.taskMs),
    windowsMeasured: Math.max(1, windowMeans.length),
    seconds: measured,
    sceneEnded: measured < spec.seconds,
  };
}

async function measureFrames(browser: Browser, target: Target, options: Options, cpuThrottle: 1 | 4, errors: Set<string>): Promise<FrameRun> {
  const session = await openSession(browser, errors, options);
  try {
    await session.client.send("Performance.enable");
    await openTarget(session, target, options);
    if (cpuThrottle !== 1) await session.client.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottle });
    await pause(settleFor(target, options));
    const seconds = Math.round((options.windowMs * options.windows) / 1000);
    return await sampleFrames(session, cpuThrottle, {
      watchDialog: target.kind === "scene",
      scrollMs: target.scroll ? seconds * 1000 : 0,
      seconds,
      windowMs: options.windowMs,
    });
  } finally {
    await session.close();
  }
}

/**
 * The cost of the harness itself: an empty page with the same rAF counter, at
 * 1x and 4x. Every figure above includes it (the counter's callback and the
 * browser producing a frame), so it is printed beside them, not subtracted.
 */
async function measureFloor(browser: Browser, options: Options): Promise<{ desktop: FrameRun; throttled?: FrameRun }> {
  const run = async (cpuThrottle: 1 | 4) => {
    const session = await openSession(browser, new Set(), options);
    try {
      await session.client.send("Performance.enable");
      await session.page.goto("data:text/html,<!doctype html><title>floor</title>", { waitUntil: "load" });
      if (cpuThrottle !== 1) await session.client.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottle });
      await pause(500);
      return await sampleFrames(session, cpuThrottle, { watchDialog: false, scrollMs: 0, seconds: 3, windowMs: 3000 });
    } finally {
      await session.close();
    }
  };
  const desktop = await run(1);
  return { desktop, throttled: options.throttle ? await run(4) : undefined };
}

// ---------------------------------------------------------------------------
// Flash safety
// ---------------------------------------------------------------------------

const SCREENCAST = { format: "jpeg" as const, quality: 55, maxWidth: 320, maxHeight: 200, everyNthFrame: 1 };
const ANALYSIS_SIZE = { width: 48, height: 30 };
const GRID = { cols: 3, rows: 3 };

interface FlashRun {
  frames: number;
  durationSeconds: number;
  /** Screencast frames a second the browser produced (median interval). */
  typicalFps: number;
  maxGapMs: number;
  whole: FlashAnalysis;
  worstCell: { cell: string; analysis: FlashAnalysis };
  /** The count the budget uses: the larger of the whole frame and the worst cell. */
  worstFlashes: number;
  luminance: { min: number; max: number };
  perSecond: LuminanceSecond[];
  /** The scene was still playing when --max-scene-ms ran out. */
  truncated: boolean;
  /** One frame only: the picture never changed, so there is nothing that could flash. */
  staticPicture: boolean;
}

async function measureFlashes(browser: Browser, target: Target, options: Options, errors: Set<string>): Promise<FlashRun> {
  const session = await openSession(browser, errors, options);
  try {
    await openTarget(session, target, options);
    if (target.kind === "page") await pause(settleFor(target, options));

    const frames: { t: number; data: string }[] = [];
    session.client.on("Page.screencastFrame", (event) => {
      frames.push({ t: event.metadata.timestamp ?? Date.now() / 1000, data: event.data });
      session.client.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => undefined);
    });
    await session.client.send("Page.startScreencast", SCREENCAST);
    let truncated = false;
    if (target.kind === "scene") {
      truncated = !(await waitForEnded(session.page, options.maxSceneMs));
    } else {
      if (target.scroll) {
        await session.page.evaluate((ms: number) => (globalThis as unknown as { __measure: MeasureApi }).__measure.scroll(ms), options.pageMs);
      }
      await pause(options.pageMs);
    }
    await session.client.send("Page.stopScreencast").catch(() => undefined);
    if (frames.length === 0) throw new Error("the screencast delivered no frame: nothing to analyse");

    const whole: LuminanceSample[] = [];
    const cells: LuminanceSample[][] = Array.from({ length: GRID.cols * GRID.rows }, () => []);
    for (const frame of frames) {
      const { data } = await sharp(Buffer.from(frame.data, "base64"))
        .resize(ANALYSIS_SIZE.width, ANALYSIS_SIZE.height, { fit: "fill" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      whole.push({ t: frame.t, luminance: meanRelativeLuminance(data, 3) });
      regionLuminances(data, ANALYSIS_SIZE.width, ANALYSIS_SIZE.height, 3, GRID.cols, GRID.rows).forEach((luminance, i) => cells[i].push({ t: frame.t, luminance }));
    }
    const wholeAnalysis = analyseFlashes(whole);
    let worst = { cell: "none", analysis: analyseFlashes([]) };
    cells.forEach((series, i) => {
      const analysis = analyseFlashes(series);
      if (analysis.worstWindowFlashes > worst.analysis.worstWindowFlashes || worst.cell === "none") {
        worst = { cell: `r${Math.floor(i / GRID.cols) + 1}c${(i % GRID.cols) + 1}`, analysis };
      }
    });
    const luminances = whole.map((s) => s.luminance);
    return {
      frames: frames.length,
      durationSeconds: wholeAnalysis.durationSeconds,
      typicalFps: wholeAnalysis.typicalSampleRateHz,
      maxGapMs: wholeAnalysis.maxGapSeconds * 1000,
      whole: wholeAnalysis,
      worstCell: worst,
      worstFlashes: Math.max(wholeAnalysis.worstWindowFlashes, worst.analysis.worstWindowFlashes),
      luminance: { min: Math.min(...luminances), max: Math.max(...luminances) },
      perSecond: perSecondLuminance(whole),
      truncated,
      staticPicture: frames.length === 1,
    };
  } finally {
    await session.close();
  }
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface LayoutRun {
  viewports: { size: string; problems: string[] }[];
  problems: string[];
}

/** Read inside the page. Kept free of outer names: it is serialised into the browser. */
function readLayout(): LayoutSnapshot {
  const toBox = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
  const dialog = document.querySelector<HTMLDialogElement>("dialog.tsuki-cutscene");
  const visible = (el: Element) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return !(el as HTMLElement).hidden && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.01 && rect.width > 0 && rect.height > 0;
  };
  const snap = (el: Element) => {
    const rect = el.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const name = (el.textContent || el.getAttribute("aria-label") || el.className || el.tagName).toString().trim().replace(/\s+/g, " ").slice(0, 30);
    return { label: name, box: toBox(rect), visible: visible(el), reachable: hit !== null && (hit === el || el.contains(hit)) };
  };
  const skip = dialog?.querySelector("[data-cutscene-skip]") ?? null;
  const controls = dialog
    ? [...dialog.querySelectorAll('button, a[href], [role="button"], input, select, textarea')].filter((el) => el !== skip && visible(el)).map(snap)
    : [];
  const text = dialog?.querySelector("#cutscene-text") ?? null;
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    rootScrollWidth: document.documentElement.scrollWidth,
    dialogScrollWidth: dialog ? dialog.scrollWidth : null,
    dialogClientWidth: dialog ? dialog.clientWidth : null,
    skip: skip ? snap(skip) : null,
    controls,
    text: text ? toBox(text.getBoundingClientRect()) : null,
  };
}

async function measureLayout(browser: Browser, target: Target, options: Options, errors: Set<string>): Promise<LayoutRun> {
  const runs: LayoutRun["viewports"] = [];
  for (const viewport of options.viewports) {
    const phone = options.touch && viewport.width < 1000;
    const size = `${viewport.width}x${viewport.height}`;
    const session = await openSession(browser, errors, options, { viewport, touch: phone });
    const problems = new Set<string>();
    try {
      await openTarget(session, target, options);
      const looks = target.kind === "scene" ? [900, 2600] : [900];
      for (const wait of looks) {
        await pause(wait);
        const stillPlaying = target.kind !== "scene" || (await session.page.evaluate(() => document.querySelector<HTMLDialogElement>("dialog.tsuki-cutscene")?.dataset.state === "playing"));
        if (!stillPlaying) break;
        const snapshot = await session.page.evaluate(readLayout);
        // Judge against the size asked for, not window.innerWidth: under mobile emulation Chromium widens the
        // layout viewport to fit overflowing content, which would hide exactly the overflow being looked for.
        snapshot.viewport = { width: viewport.width, height: viewport.height };
        for (const problem of judgeLayout(snapshot, { expectCutscene: target.kind === "scene" })) problems.add(problem);
      }
    } catch (error) {
      problems.add(`could not read the layout: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await session.close();
    }
    runs.push({ size, problems: [...problems] });
  }
  return { viewports: runs, problems: runs.flatMap((run) => run.problems.map((problem) => `${run.size}: ${problem}`)) };
}

// ---------------------------------------------------------------------------
// Gzip of dist chunks
// ---------------------------------------------------------------------------

interface GzipRun {
  chunk: { name: string; rawKB: number; gzipKB: number }[];
  css: { name: string; rawKB: number; gzipKB: number }[];
  /** Chunks the scene chunk imports statically (shared code). */
  imports: { name: string; rawKB: number; gzipKB: number }[];
  /** Unminified source of the CSS the scene inlines with ?inline. */
  inlineCssSourceGzipKB: number | null;
  /** The scene chunk, its own CSS files and its static imports, gzip KB. */
  totalGzipKB: number;
  note?: string;
}

const SCENES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "cutscene", "scenes");

function measureGzip(distDir: string, target: Target, options: Options): GzipRun {
  const astroDir = path.join(distDir, "_astro");
  const names = readdirSync(astroDir);
  const files: ChunkFile[] = names.filter((name) => /\.(?:js|css)$/.test(name)).map((name) => ({ name, content: readFileSync(path.join(astroDir, name)) }));
  const rows = (list: { name: string; rawBytes: number; gzipBytes: number }[]) => list.map((f) => ({ name: f.name, rawKB: kilobytes(f.rawBytes), gzipKB: kilobytes(f.gzipBytes) }));

  let jsPattern: RegExp;
  let cssPattern: RegExp;
  let sourceId: string | null = null;
  if (target.kind === "scene") {
    sourceId = registryEntry(target.part as number).id;
    jsPattern = chunkNamePattern(sourceId, ["js"]);
    cssPattern = chunkNamePattern(sourceId, ["css"]);
  } else if (target.name === "home" || target.name === "home-scroll") {
    jsPattern = new RegExp(`^(?:${options.homeChunk.source}).*\\.js$`);
    cssPattern = new RegExp(`^(?:${options.homeChunk.source}).*\\.css$`);
  } else {
    return { chunk: [], css: [], imports: [], inlineCssSourceGzipKB: null, totalGzipKB: 0, note: "no chunk is defined for a url: target" };
  }

  const chunk = sumGzipByPattern(files, jsPattern);
  const css = sumGzipByPattern(files, cssPattern);
  const byName = new Map(files.map((file) => [file.name, file]));
  const read = (name: string) => {
    const file = byName.get(name);
    return file && typeof file.content !== "string" ? Buffer.from(file.content).toString("utf8") : undefined;
  };
  const importNames = [...new Set(chunk.files.flatMap((f) => chunkClosure(f.name, read)).filter((name) => !chunk.files.some((f) => f.name === name)))];
  const imports = sumGzipByPattern(files, new RegExp(`^(?:${importNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") || "$^"})$`));

  let inlineCss: number | null = null;
  if (sourceId) {
    const scenePath = path.join(SCENES_DIR, `${sourceId}.ts`);
    if (existsSync(scenePath)) {
      const cssFiles = [...readFileSync(scenePath, "utf8").matchAll(/from\s+["']\.\/([^"']+\.css)\?inline["']/g)].map((m) => path.join(SCENES_DIR, m[1]));
      inlineCss = kilobytes(cssFiles.filter(existsSync).reduce((sum, file) => sum + gzipBytes(readFileSync(file)), 0));
    }
  }
  return {
    chunk: rows(chunk.files),
    css: rows(css.files),
    imports: rows(imports.files),
    inlineCssSourceGzipKB: inlineCss,
    totalGzipKB: kilobytes(chunk.gzipBytes + css.gzipBytes + imports.gzipBytes),
    note: chunk.files.length === 0 ? `no chunk named ${jsPattern.source} in ${astroDir} (the build may not include it)` : undefined,
  };
}

// ---------------------------------------------------------------------------
// One target
// ---------------------------------------------------------------------------

interface TargetResult {
  target: string;
  url: string;
  frame: { desktop?: FrameRun; throttled?: FrameRun };
  flash?: FlashRun;
  layout?: LayoutRun;
  gzip?: GzipRun;
  consoleErrors: string[];
  /** Budget and layout misses: they decide the exit code. */
  failures: string[];
  /** Notes that are not failures: partial windows, sparse sampling, things that could not be measured. */
  notes: string[];
  /** Checks that threw: the harness could not measure. */
  errors: string[];
}

async function guarded<T>(label: string, result: TargetResult, run: () => Promise<T>): Promise<T | undefined> {
  const started = Date.now();
  try {
    const value = await run();
    progress(`    ${label} ok (${((Date.now() - started) / 1000).toFixed(1)} s)`);
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`${label}: ${message.split("\n")[0]}`);
    progress(`    ${label} FAILED: ${message.split("\n")[0]}`);
    return undefined;
  }
}

const progress = (line: string) => console.error(line);

async function measureTarget(browser: Browser, target: Target, options: Options): Promise<TargetResult> {
  const errors = new Set<string>();
  const result: TargetResult = { target: target.name, url: targetUrl(options.base, target.path), frame: {}, consoleErrors: [], failures: [], notes: [], errors: [] };
  progress(`${target.name}  ${result.url}`);

  if (options.warmup && (options.checks.has("frame") || options.checks.has("flash") || options.checks.has("layout"))) {
    await guarded("warm-up", result, async () => {
      const session = await openSession(browser, new Set(), options);
      try {
        await openTarget(session, target, options);
      } finally {
        await session.close();
      }
    });
  }

  if (options.checks.has("frame")) {
    result.frame.desktop = await guarded("frame cost 1x", result, () => measureFrames(browser, target, options, 1, errors));
    if (options.throttle) result.frame.throttled = await guarded("frame cost 4x", result, () => measureFrames(browser, target, options, 4, errors));
  }
  if (options.checks.has("flash")) result.flash = await guarded("flash capture", result, () => measureFlashes(browser, target, options, errors));
  if (options.checks.has("layout")) result.layout = await guarded("layout", result, () => measureLayout(browser, target, options, errors));
  if (options.checks.has("gzip")) {
    if (options.dist) result.gzip = await guarded("gzip", result, async () => measureGzip(options.dist as string, target, options));
    else result.notes.push("gzip: no --dist given");
  }

  result.consoleErrors = [...errors];
  for (const run of [result.frame.desktop, result.frame.throttled]) {
    if (run?.sceneEnded) result.notes.push(`frame ${run.cpuThrottle}x: the scene ended after ${run.seconds} s of the ${Math.round((options.windowMs * options.windows) / 1000)} s asked`);
  }
  if (result.flash?.truncated) result.notes.push(`flash: the scene was still playing at --max-scene-ms (${options.maxSceneMs} ms); only that part was analysed`);
  if (result.flash?.staticPicture) result.notes.push("flash: the picture never changed (one screencast frame), so nothing can flash");
  else if (result.flash && (result.flash.whole.coverage === "sparse" || result.flash.worstCell.analysis.coverage === "sparse")) {
    result.notes.push(
      `flash: the screencast sent about ${result.flash.typicalFps.toFixed(1)} frames a second (it sends one when the picture changes, so a calm scene sends few). Under ${result.flash.whole.minReliableSampleRateHz} a second a strobe just over the limit could slip between frames: a pass is weaker evidence`,
    );
  }
  if (result.gzip?.note) result.notes.push(`gzip: ${result.gzip.note}`);
  if (result.consoleErrors.length) result.failures.push(`${result.consoleErrors.length} console or page error(s)`);

  result.failures.push(
    ...budgetFailures({
      desktopMs: result.frame.desktop?.cost.taskMs,
      throttledMs: result.frame.throttled?.cost.taskMs,
      worstFlashes: result.flash?.worstFlashes,
      layoutProblems: result.layout?.problems,
    }),
  );
  return result;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const f1 = (value: number | undefined) => (value === undefined ? "-" : value.toFixed(1));
const f2 = (value: number | undefined) => (value === undefined ? "-" : value.toFixed(2));
const percent = (ratio: number | undefined) => (ratio === undefined ? "-" : `${(ratio * 100).toFixed(1)}%`);

function renderTable(rows: string[][]): string {
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => (row[column] ?? "").length)));
  return rows.map((row) => row.map((cell, column) => cell.padEnd(widths[column])).join("  ").trimEnd()).join("\n");
}

function summaryRows(results: TargetResult[]): string[][] {
  const rows = [["target", "1x ms", "4x ms", "fps 1x", "drop 1x", "drop 4x", "busy 1x", "flashes/s", "sc fps", "layout", "console", "verdict"]];
  for (const r of results) {
    const flash = r.flash;
    const flashText = flash ? `${flash.worstFlashes}${flash.whole.worstWindowFlashes !== flash.worstFlashes ? ` (cell ${flash.worstCell.cell})` : ""}` : "-";
    const layoutText = r.layout ? (r.layout.problems.length ? `${r.layout.problems.length} problem(s)` : "ok") : "-";
    const verdict = r.errors.length ? "ERROR" : r.failures.length ? "FAIL" : "ok";
    rows.push([
      r.target,
      f2(r.frame.desktop?.cost.taskMs),
      f2(r.frame.throttled?.cost.taskMs),
      f1(r.frame.desktop?.cost.fps),
      percent(r.frame.desktop?.intervals.droppedRatio),
      percent(r.frame.throttled?.intervals.droppedRatio),
      percent(r.frame.desktop?.cost.busyFraction),
      flashText,
      flash ? flash.typicalFps.toFixed(0) : "-",
      layoutText,
      r.consoleErrors.length ? String(r.consoleErrors.length) : r.frame.desktop || r.flash || r.layout ? "0" : "-",
      verdict,
    ]);
  }
  return rows;
}

function printReport(results: TargetResult[], options: Options, meta: Record<string, unknown>): void {
  const lines: string[] = [];
  lines.push("");
  lines.push(`scene-measure  ${options.base}  (${meta.server})  ${meta.chrome}  ${meta.cpu} x${meta.cpus}`);
  lines.push(`budgets: ${BUDGETS.desktopMs} ms/frame at 1x, ${BUDGETS.throttledMs} ms at 4x, at most ${BUDGETS.flashesPerSecond} flashes in any second`);
  lines.push("");
  lines.push(renderTable(summaryRows(results)));
  const load = meta.loadAverage as { before: number; after: number };
  lines.push(`machine load (1 min average) ${load.before.toFixed(1)} before and ${load.after.toFixed(1)} after on ${meta.cpus} cores${Math.max(load.before, load.after) > Number(meta.cpus) * 0.75 ? ": busy, other processes compete for the CPU, so expect noisy numbers" : ""}`);
  const floorMs = meta.floorMs as { desktop: number; throttled: number | null } | null;
  if (floorMs) {
    lines.push(`harness floor (an empty page with the same frame counter, included in every figure above): ${floorMs.desktop.toFixed(2)} ms at 1x${floorMs.throttled !== null ? `, ${floorMs.throttled.toFixed(2)} ms at 4x` : ""}`);
  }

  for (const r of results) {
    const detail: string[] = [];
    for (const run of [r.frame.desktop, r.frame.throttled]) {
      if (!run) continue;
      const c = run.cost;
      detail.push(
        `  frames ${run.cpuThrottle}x: ${c.taskMs.toFixed(2)} ms/frame over ${c.frames} frames in ${run.seconds} s (script ${c.scriptMs.toFixed(2)}, layout ${c.layoutMs.toFixed(2)}, style ${c.styleMs.toFixed(2)}, other ${c.otherMs.toFixed(2)}); ` +
          `main thread ${(c.busyFraction * 100).toFixed(0)}% busy${c.threadMs === null || c.processMs === null ? "" : `, ${c.threadMs.toFixed(2)} ms CPU/frame, renderer process ${c.processMs.toFixed(2)} ms CPU/frame`}; ${c.fps.toFixed(1)} fps; peak second ${run.peakSecondMs.toFixed(2)} ms` +
          `${run.windowsMeasured > 1 ? `, worst window ${run.worstWindowMs.toFixed(2)} ms` : ""}; ` +
          `rAF interval median ${run.intervals.medianMs.toFixed(1)} ms, p95 ${run.intervals.p95Ms.toFixed(1)}, max ${run.intervals.maxMs.toFixed(1)}; dropped ${run.intervals.dropped} (${percent(run.intervals.droppedRatio)})`,
      );
    }
    if (r.flash) {
      const fl = r.flash;
      detail.push(
        `  flashes: ${fl.worstFlashes} worst second (whole screen ${fl.whole.worstWindowFlashes}, worst cell ${fl.worstCell.cell} ${fl.worstCell.analysis.worstWindowFlashes}); ` +
          `${fl.frames} screencast frames in ${fl.durationSeconds.toFixed(1)} s (${fl.typicalFps.toFixed(1)} fps typical, longest gap ${fl.maxGapMs.toFixed(0)} ms); ` +
          `screen luminance ${fl.luminance.min.toFixed(3)} to ${fl.luminance.max.toFixed(3)}; swings counted ${fl.whole.transitions}`,
      );
      detail.push(`  luminance per second (mean): ${fl.perSecond.map((s) => s.mean.toFixed(2)).join(" ")}`);
    }
    if (r.layout) {
      detail.push(`  layout: ${r.layout.viewports.map((v) => `${v.size} ${v.problems.length ? `${v.problems.length} problem(s)` : "ok"}`).join(", ")}`);
      for (const problem of r.layout.problems) detail.push(`    - ${problem}`);
    }
    if (r.gzip && r.gzip.chunk.length + r.gzip.css.length > 0) {
      const g = r.gzip;
      const part = (list: { name: string; gzipKB: number; rawKB: number }[]) => list.map((f) => `${f.name} ${f.gzipKB.toFixed(2)} KB gzip (${f.rawKB.toFixed(2)} raw)`).join("; ");
      detail.push(`  gzip: chunk ${part(g.chunk)}${g.css.length ? `; css ${part(g.css)}` : "; css inlined in the chunk"}${g.inlineCssSourceGzipKB !== null ? ` (inline css source ${g.inlineCssSourceGzipKB.toFixed(2)} KB gzip, unminified)` : ""}`);
      if (g.imports.length) detail.push(`        static imports: ${part(g.imports)}`);
      detail.push(`        total ${g.totalGzipKB.toFixed(2)} KB gzip`);
    }
    for (const error of r.consoleErrors) detail.push(`  ${error}`);
    for (const note of r.notes) detail.push(`  note: ${note}`);
    for (const error of r.errors) detail.push(`  ERROR ${error}`);
    for (const failure of r.failures) detail.push(`  FAIL ${failure}`);
    lines.push("", `${r.target}${detail.length ? "" : ": nothing measured"}`, ...detail);
  }

  lines.push("");
  lines.push("method: main-thread task ms per rAF frame (CDP TaskDuration delta / frames, includes everything on the main thread); flash count per WCAG 2.3.1 on the whole-screen and 3x3 cell mean luminance of screencast frames.");
  lines.push("limits: " + (meta.server === "dev server" ? "DEV SERVER numbers include HMR and unminified code; the production build is measured from `pnpm build` + preview. " : "") + "software-rendered headless Chromium; 4x is emulated; small-area and red flashes are not detected; one run is one sample.");
  const failing = results.filter((r) => r.failures.length || r.errors.length).length;
  lines.push(`${results.length - failing} of ${results.length} targets within budget${failing ? `, ${failing} not` : ""}`);
  console.log(lines.join("\n"));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  // Size-only runs (--checks gzip) read the dist folder and need neither a server nor a browser.
  const needsBrowser = (["frame", "flash", "layout"] as const).some((check) => options.checks.has(check));

  let server = "not contacted";
  let browser: Browser | null = null;
  if (needsBrowser) {
    const first = options.targets[0];
    const probe = await fetch(targetUrl(options.base, first.kind === "scene" ? "tsukinomi/" : first.path)).catch(() => null);
    if (!probe?.ok) fail(`${options.base} is not reachable (${probe ? probe.status : "no response"}). Start a dev server or serve a build first.`);
    server = (await probe.text()).includes("/@vite/client") ? "dev server" : "no Vite client: a build or a static server";
    browser = await launchBrowser(options);
    const launched = browser;
    const closeAndExit = (code: number) => {
      launched.close().finally(() => process.exit(code));
    };
    process.on("SIGINT", () => closeAndExit(130));
    process.on("SIGTERM", () => closeAndExit(143));
  }

  const loadBefore = os.loadavg()[0];
  const results: TargetResult[] = [];
  let chromeVersion = "no browser";
  let floor: Awaited<ReturnType<typeof measureFloor>> | undefined;
  try {
    if (browser) {
      chromeVersion = await browser.version();
      if (options.checks.has("frame")) {
        progress("harness floor (empty page)");
        try {
          floor = await measureFloor(browser, options);
        } catch (error) {
          progress(`    floor FAILED: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    // measureTarget only touches the browser for the checks that need one, which are off when it is null.
    for (const target of options.targets) results.push(await measureTarget(browser as Browser, target, options));
  } finally {
    await browser?.close();
  }

  const meta = {
    date: new Date().toISOString(),
    base: options.base,
    server,
    chrome: chromeVersion,
    node: process.version,
    cpu: os.cpus()[0]?.model ?? "unknown cpu",
    cpus: os.cpus().length,
    budgets: BUDGETS,
    loadAverage: { before: loadBefore, after: os.loadavg()[0] },
    floorMs: floor ? { desktop: floor.desktop.cost.taskMs, throttled: floor.throttled?.cost.taskMs ?? null } : null,
    options: { windowMs: options.windowMs, windows: options.windows, settleMs: options.settleMs, pageMs: options.pageMs, viewports: options.viewports, throttle: options.throttle },
  };
  printReport(results, options, meta);
  if (options.json) {
    writeFileSync(options.json, `${JSON.stringify({ meta, results }, null, 2)}\n`);
    console.error(`wrote ${options.json}`);
  }
  if (results.some((r) => r.failures.length)) process.exitCode = 2;
  else if (results.some((r) => r.errors.length)) process.exitCode = 1;
}

await main();
