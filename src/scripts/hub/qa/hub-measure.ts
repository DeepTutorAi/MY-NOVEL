// Scene budget measurement (spec 5.5, 5.6 as amended by 8.3 item 4, 8.4 items 3 and 4).
// Headless Chrome at 1440x900 DPR 1 per theme with ?hubstats=1&seed=1: settle 3 s, idle 5 s,
// pointer 5 s along the gutters and bands, scroll 6 s to the footer and back; reads
// window.__hubSceneStats after each window and CDP TaskDuration over the idle window.
// Rounds alternate the theme order; the report keeps the median. The card-write gate is an
// A/B run on CDP RecalcStyleDuration per frame with ?hubcardwrites=0. Then a 4x CPU pass and
// a phone pass at 390x844 DPR 2. CPU load and a blank-page baseline are recorded every round.
// The long-task gate counts tasks that start after the scene's first hub:scene; earlier load
// tasks are reported apart. A scene that holds tier 0 under 4x CPU at <= 5 ms mean passes.
//
// Usage: tsx src/scripts/hub/qa/hub-measure.ts <baseUrl | buildDir> [--themes a,b] [--rounds 3]
//        [--skip-throttle] [--skip-phone] [--legacy] [--report path] [--dry-run]
// A build directory is served on a free 127.0.0.1 port for the run. Writes
// .qa/hub-measure-report.json, or .qa/hub-measure-report-<themes>.json with --themes.
// Exits 1 when a pass/fail budget is missed.

import { cpus } from "node:os";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Browser, CDPSession, Page } from "puppeteer";

import { HUB_THEMES, lowerFirst } from "../theme-core.mjs";
import type { HubSceneStats, HubThemeKey } from "../world/types";
import { hubUrl, launch, openCell, parseArgs, parseSize, parseThemes, themeStorage, themesInBuild, type HubTarget, type Size } from "./browser";
import { splitLongTasks, throttleFailures, type LongTask } from "./measure-gates";
import { isBuildDir, serveDist, type ServedDist } from "./serve-dist";

const REPORT = ".qa/hub-measure-report.json";
const MB = 1024 * 1024;
const BUDGET = { drawMsMean: 6, drawMsP95: 9, idleTaskMsPerS: 250, cardRecalcMsPerFrame: 0.3, throttledMean: 12, memoryMb: 48, fireflyPhoneMb: 40, longTaskMs: 50 };
const SETTLE_MS = 3000;
const IDLE_MS = 5000;
const POINTER_MS = 5000;
const SCROLL_MS = 6000;
const USAGE = `usage: tsx src/scripts/hub/qa/hub-measure.ts <baseUrl | buildDir> [--themes a,b] [--rounds 3] [--skip-throttle] [--skip-phone] [--legacy] [--report path] [--dry-run]`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const median = (values: number[]) => {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};
const r2 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);

/** Busy share of all CPUs over `ms` (os.loadavg is always 0 on Windows). */
async function cpuLoad(ms = 500): Promise<number> {
  const snap = () => cpus().reduce((acc, c) => ({ idle: acc.idle + c.times.idle, total: acc.total + Object.values(c.times).reduce((a, b) => a + b, 0) }), { idle: 0, total: 0 });
  const a = snap();
  await sleep(ms);
  const b = snap();
  const total = b.total - a.total;
  return total > 0 ? Math.round((1 - (b.idle - a.idle) / total) * 1000) / 10 : 0;
}

const PROBES = `(() => {
  window.__qaFrames = 0;
  window.__qaLong = [];
  window.__qaSceneAt = null;
  document.addEventListener("hub:scene", () => { if (window.__qaSceneAt === null) window.__qaSceneAt = performance.now(); });
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((ts) => { window.__qaFrames++; cb(ts); });
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__qaLong.push({ start: e.startTime, duration: e.duration }); })
      .observe({ type: "longtask", buffered: true });
  } catch {}
})();`;

async function metrics(client: CDPSession): Promise<Record<string, number>> {
  const { metrics: list } = await client.send("Performance.getMetrics");
  return Object.fromEntries(list.map((m) => [m.name, m.value]));
}

async function stats(page: Page): Promise<HubSceneStats | null> {
  return page.evaluate(() => ((window as unknown as { __hubSceneStats?: unknown }).__hubSceneStats as HubSceneStats | undefined) ?? null);
}

async function frames(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __qaFrames: number }).__qaFrames);
}

interface Opened {
  page: Page;
  client: CDPSession;
  errors: string[];
  close(): Promise<void>;
}

async function openTheme(browser: Browser, target: HubTarget, theme: HubThemeKey, size: Size, params: Record<string, string>, cpuRate = 1): Promise<Opened> {
  const cell = await openCell(browser, size, { storage: themeStorage(target, theme) });
  await cell.page.evaluateOnNewDocument(PROBES);
  const client = await cell.page.createCDPSession();
  await client.send("Performance.enable");
  if (cpuRate !== 1) await client.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
  await cell.page.goto(hubUrl(target, theme, { hubstats: "1", seed: "1", ...params }), { waitUntil: "load" });
  return { page: cell.page, client, errors: cell.errors, close: cell.close };
}

/** Idle window: TaskDuration per second, style recalc per drawn frame, stats at the end. */
async function idleWindow(o: Opened) {
  const m0 = await metrics(o.client);
  const f0 = await frames(o.page);
  await sleep(IDLE_MS);
  const m1 = await metrics(o.client);
  const f1 = await frames(o.page);
  const seconds = IDLE_MS / 1000;
  const frameCount = Math.max(1, f1 - f0);
  return {
    taskMsPerS: ((m1.TaskDuration - m0.TaskDuration) * 1000) / seconds,
    recalcMsPerFrame: ((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000) / frameCount,
    rafPerS: (f1 - f0) / seconds,
    stats: await stats(o.page),
  };
}

/** Pointer paths through the open space: top band, left gutter, hero gap, card gutter, right gutter. */
async function pointerWindow(o: Opened) {
  const geo = await o.page.evaluate(() => {
    scrollTo(0, 0);
    const rect = (s: string) => document.querySelector(s)?.getBoundingClientRect() ?? null;
    const shell = rect(".hub-shell");
    const hero = rect(".hub-hero");
    const title = rect(".hub-hero h1");
    const cards = [...document.querySelectorAll(".novel-card-wrapper")].map((el) => el.getBoundingClientRect()).filter((r) => r.height > 0);
    const block = rect("[data-hub-resume]:not([hidden])") ?? rect("[data-hub-start]") ?? rect('[data-hub-window="stage"]') ?? cards[0] ?? null;
    const firstRow = cards.filter((r) => cards[0] && Math.abs(r.top - cards[0].top) < 8).sort((a, b) => a.left - b.left);
    return {
      vw: innerWidth,
      vh: innerHeight,
      shellLeft: shell?.left ?? 0,
      shellRight: shell?.right ?? innerWidth,
      titleTop: title?.top ?? 60,
      heroBottom: hero?.bottom ?? 200,
      blockTop: block?.top ?? 260,
      gapX: firstRow.length > 1 ? (firstRow[0].right + firstRow[1].left) / 2 : null,
      rowTop: firstRow[0]?.top ?? null,
      rowBottom: firstRow[0] ? Math.min(innerHeight - 4, firstRow[0].bottom) : null,
    };
  });
  const clampY = (y: number) => Math.max(2, Math.min(geo.vh - 2, y));
  const paths: [number, number, number, number][] = [
    [8, clampY(geo.titleTop / 2), geo.vw - 8, clampY(geo.titleTop / 2)],
    [geo.shellLeft / 2, 8, geo.shellLeft / 2, geo.vh - 8],
    [8, clampY((geo.heroBottom + geo.blockTop) / 2), geo.vw - 8, clampY((geo.heroBottom + geo.blockTop) / 2)],
    ...(geo.gapX !== null && geo.rowTop !== null && geo.rowBottom !== null ? [[geo.gapX, clampY(geo.rowTop), geo.gapX, clampY(geo.rowBottom)] as [number, number, number, number]] : []),
    [(geo.shellRight + geo.vw) / 2, 8, (geo.shellRight + geo.vw) / 2, geo.vh - 8],
  ];
  const perPath = POINTER_MS / paths.length;
  for (const [x0, y0, x1, y1] of paths) {
    await o.page.mouse.move(x0, y0);
    const steps = 30;
    for (let i = 1; i <= steps; i++) {
      await o.page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
      await sleep(perPath / steps);
    }
  }
  return { paths: paths.length, stats: await stats(o.page) };
}

/** Scroll to the footer over half the window and back over the other half. */
async function scrollWindow(o: Opened) {
  const height = await o.page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await o.page.mouse.move(4, 300);
  const half = SCROLL_MS / 2;
  const ticks = Math.round(half / 50);
  for (const direction of [1, -1]) {
    for (let i = 0; i < ticks; i++) {
      await o.page.mouse.wheel({ deltaY: (direction * height) / ticks });
      await sleep(50);
    }
  }
  return { distance: height, stats: await stats(o.page) };
}

interface ThemeRound {
  theme: HubThemeKey;
  idleTaskMsPerS: number;
  rafPerS: number;
  recalcOnMsPerFrame: number;
  recalcOffMsPerFrame: number | null;
  offConfirmed: boolean;
  stats: { idle: HubSceneStats | null; pointer: HubSceneStats | null; scroll: HubSceneStats | null };
  longTasks: LongTask[];
  /** Long tasks before hub:scene (page load), reported only. */
  loadLongTasks: LongTask[];
  errors: string[];
}

async function measureRound(browser: Browser, target: HubTarget, theme: HubThemeKey): Promise<ThemeRound> {
  const desk = parseSize("1440x900");
  const a = await openTheme(browser, target, theme, desk, {});
  try {
    await sleep(SETTLE_MS);
    const probe = await a.page.evaluate(() => {
      const w = window as unknown as { __qaLong: LongTask[]; __qaSceneAt: number | null };
      return { tasks: w.__qaLong.slice(), sceneAt: w.__qaSceneAt };
    });
    const longTasks = splitLongTasks(probe.tasks, probe.sceneAt, BUDGET.longTaskMs);
    const idle = await idleWindow(a);
    const pointer = await pointerWindow(a);
    const scroll = await scrollWindow(a);
    const b = await openTheme(browser, target, theme, desk, { hubcardwrites: "0" });
    let off: Awaited<ReturnType<typeof idleWindow>> | null = null;
    try {
      await sleep(SETTLE_MS);
      off = await idleWindow(b);
    } finally {
      await b.close();
    }
    return {
      theme,
      idleTaskMsPerS: idle.taskMsPerS,
      rafPerS: idle.rafPerS,
      recalcOnMsPerFrame: idle.recalcMsPerFrame,
      recalcOffMsPerFrame: off?.recalcMsPerFrame ?? null,
      offConfirmed: off?.stats?.cardWrites === false,
      stats: { idle: idle.stats, pointer: pointer.stats, scroll: scroll.stats },
      longTasks: longTasks.scene,
      loadLongTasks: longTasks.load,
      errors: a.errors,
    };
  } finally {
    await a.close();
  }
}

/** 4x CPU: polls stats for 5 s after the scene starts drawing. */
async function throttlePass(browser: Browser, target: HubTarget, theme: HubThemeKey) {
  const o = await openTheme(browser, target, theme, parseSize("1440x900"), {}, 4);
  try {
    const start = Date.now();
    let first: number | null = null;
    let tierAt: number | null = null;
    let last: HubSceneStats | null = null;
    while (Date.now() - start < 15000) {
      last = await stats(o.page);
      if (last && first === null) first = Date.now();
      if (last && last.tier >= 1 && tierAt === null && first !== null) tierAt = Date.now() - first;
      if (first !== null && Date.now() - first >= 5000) break;
      await sleep(250);
    }
    return { reachedTierMs: tierAt, finalTier: last?.tier ?? null, drawMsMean: r2(last?.drawMsMean), stats: last };
  } finally {
    await o.close();
  }
}

async function phonePass(browser: Browser, target: HubTarget, theme: HubThemeKey) {
  const o = await openTheme(browser, target, theme, parseSize("390x844"), {});
  try {
    await sleep(SETTLE_MS);
    const idle = await idleWindow(o);
    return { taskMsPerS: r2(idle.taskMsPerS), stats: idle.stats };
  } finally {
    await o.close();
  }
}

/** Reads the ledger after the theme's cleanup; only observable when the kit publishes a final stats object. */
async function destroyLedger(browser: Browser, target: HubTarget, theme: HubThemeKey) {
  const o = await openTheme(browser, target, theme, parseSize("1440x900"), {});
  try {
    await sleep(SETTLE_MS);
    const before = await stats(o.page);
    const bind = HUB_THEMES.find((row) => row.key === theme)?.bind ?? "";
    await o.page.evaluate((name: string) => {
      const fn = (window as unknown as Record<string, unknown>)[name];
      if (typeof fn === "function") fn();
    }, `__${lowerFirst(bind)}Cleanup`);
    await sleep(500);
    const after = await stats(o.page);
    let status: "no stats" | "pass" | "fail" | "unverified";
    if (!before) status = "no stats";
    else if (after?.liveSurfaceBytes === 0) status = "pass";
    else if (!after || JSON.stringify(after) === JSON.stringify(before)) status = "unverified";
    else status = "fail";
    return { beforeBytes: before?.liveSurfaceBytes ?? null, afterBytes: after?.liveSurfaceBytes ?? null, status };
  } finally {
    await o.close();
  }
}

async function blankBaseline(browser: Browser): Promise<number> {
  const context = await browser.createBrowserContext();
  try {
    const page = await context.newPage();
    const client = await page.createCDPSession();
    await client.send("Performance.enable");
    await page.goto("about:blank");
    const m0 = await metrics(client);
    await sleep(2000);
    const m1 = await metrics(client);
    return ((m1.TaskDuration - m0.TaskDuration) * 1000) / 2;
  } finally {
    await context.close();
  }
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) {
    console.log(USAGE);
    return 0;
  }
  const { opts, rest } = parseArgs(argv, ["skip-throttle", "skip-phone", "legacy", "dry-run"]);
  const base = rest[0];
  if (!base) {
    console.error(USAGE);
    return 2;
  }
  const dir = isBuildDir(base) ? base : null;
  const rounds = Number(opts.get("rounds") ?? 3);
  if (!Number.isInteger(rounds) || rounds < 1) throw new Error("--rounds must be a positive integer");
  const picked = opts.has("themes") ? parseThemes(opts.get("themes") ?? "") : null;
  const reportPath = opts.get("report") ?? (picked ? `.qa/hub-measure-report-${picked.join("+")}.json` : REPORT);
  if (opts.has("dry-run")) {
    console.log(`would measure ${picked?.join(", ") ?? "every theme in the page"} on ${dir ? `${dir} (served on a free port)` : base} for ${rounds} alternating rounds at 1440x900${opts.has("skip-throttle") ? "" : ", a 4x CPU pass"}${opts.has("skip-phone") ? "" : ", a 390x844 DPR 2 pass"}; report ${reportPath}`);
    return 0;
  }
  const served: ServedDist | null = dir ? await serveDist(dir) : null;
  try {
    return await measure({ base: served?.base ?? new URL(base).toString(), legacy: opts.has("legacy") }, picked, rounds, opts, reportPath);
  } finally {
    await served?.close();
  }
}

async function measure(target: HubTarget, picked: HubThemeKey[] | null, rounds: number, opts: Map<string, string>, reportPath: string): Promise<number> {
  const themes = picked ?? (await themesInBuild(target.base));

  const browser = await launch();
  const roundsOut: { round: number; cpuLoadPct: number; blankTaskMsPerS: number; themes: ThemeRound[] }[] = [];
  const extra: Record<string, { throttle?: unknown; phone?: unknown; ledger?: unknown }> = {};
  try {
    for (let round = 1; round <= rounds; round++) {
      const order = round % 2 ? themes : [...themes].reverse();
      const cpuLoadPct = await cpuLoad();
      const blankTaskMsPerS = await blankBaseline(browser);
      const results: ThemeRound[] = [];
      for (const theme of order) {
        console.log(`round ${round}: ${theme} (cpu ${cpuLoadPct}%)`);
        results.push(await measureRound(browser, target, theme));
      }
      roundsOut.push({ round, cpuLoadPct, blankTaskMsPerS: r2(blankTaskMsPerS) ?? 0, themes: results });
    }
    for (const theme of themes) {
      extra[theme] = {};
      if (!opts.has("skip-throttle")) extra[theme].throttle = await throttlePass(browser, target, theme);
      if (!opts.has("skip-phone")) extra[theme].phone = await phonePass(browser, target, theme);
      extra[theme].ledger = await destroyLedger(browser, target, theme);
    }
  } finally {
    await browser.close();
  }

  const failures: string[] = [];
  const unverified: string[] = [];
  const summary = themes.map((theme) => {
    const rows = roundsOut.map((r) => r.themes.find((t) => t.theme === theme)).filter((t): t is ThemeRound => !!t);
    const last = (row: ThemeRound) => row.stats.scroll ?? row.stats.pointer ?? row.stats.idle;
    const withStats = rows.filter((row) => last(row));
    const drawMean = median(withStats.map((row) => last(row)?.drawMsMean ?? Number.NaN));
    const drawP95 = median(withStats.map((row) => last(row)?.drawMsP95 ?? Number.NaN));
    const idleTask = median(rows.map((row) => row.idleTaskMsPerS));
    const recalcDelta = median(rows.map((row) => (row.recalcOffMsPerFrame === null ? Number.NaN : row.recalcOnMsPerFrame - row.recalcOffMsPerFrame)));
    const memory = Math.max(0, ...withStats.map((row) => last(row)?.liveSurfaceBytes ?? 0));
    const canvases = Math.max(0, ...withStats.map((row) => last(row)?.canvasBytes ?? 0));
    const tiers = withStats.map((row) => last(row)?.tier ?? 0);
    const longTasks = rows.flatMap((row) => row.longTasks);
    const loadLongTasks = rows.flatMap((row) => row.loadLongTasks);
    const errors = [...new Set(rows.flatMap((row) => row.errors))];
    const offConfirmed = rows.every((row) => row.offConfirmed);

    if (!withStats.length) failures.push(`${theme}: no window.__hubSceneStats with ?hubstats=1 (scene not on the kit)`);
    else {
      if (drawMean !== null && drawMean > BUDGET.drawMsMean) failures.push(`${theme}: mean draw ${r2(drawMean)} ms > ${BUDGET.drawMsMean} ms`);
      if (drawP95 !== null && drawP95 > BUDGET.drawMsP95) failures.push(`${theme}: p95 draw ${r2(drawP95)} ms > ${BUDGET.drawMsP95} ms`);
      if (memory > BUDGET.memoryMb * MB) failures.push(`${theme}: live surfaces ${r2(memory / MB)} MB > ${BUDGET.memoryMb} MB`);
      if (tiers.some((t) => t !== 0)) unverified.push(`${theme}: the draw budget applies at tier 0, but the governor ended at tier ${Math.max(...tiers)} in some rounds`);
    }
    if (idleTask !== null && idleTask > BUDGET.idleTaskMsPerS) failures.push(`${theme}: idle main-thread ${r2(idleTask)} ms/s > ${BUDGET.idleTaskMsPerS} ms/s`);
    if (longTasks.length) failures.push(`${theme}: ${longTasks.length} long tasks over ${BUDGET.longTaskMs} ms after the scene mounted (max ${r2(Math.max(...longTasks.map((t) => t.duration)))} ms)`);
    if (errors.length) failures.push(`${theme}: console errors: ${errors.slice(0, 3).join(" | ")}`);
    if (!offConfirmed) unverified.push(`${theme}: the ?hubcardwrites=0 run did not report cardWrites false, so the A/B style-recalc delta is unverified`);

    const t = extra[theme]?.throttle as Awaited<ReturnType<typeof throttlePass>> | undefined;
    if (t) {
      if (t.stats === null) failures.push(`${theme}: 4x CPU pass produced no stats`);
      else {
        failures.push(...throttleFailures(theme, t, BUDGET.throttledMean));
      }
    }
    const p = extra[theme]?.phone as Awaited<ReturnType<typeof phonePass>> | undefined;
    if (p?.stats && theme === "firefly" && p.stats.liveSurfaceBytes > BUDGET.fireflyPhoneMb * MB) {
      failures.push(`firefly: live surfaces at 390x844 DPR 2 ${r2(p.stats.liveSurfaceBytes / MB)} MB > ${BUDGET.fireflyPhoneMb} MB`);
    }
    const ledger = extra[theme]?.ledger as Awaited<ReturnType<typeof destroyLedger>> | undefined;
    if (ledger?.status === "fail") failures.push(`${theme}: ${ledger.afterBytes} live surface bytes after cleanup`);
    if (ledger?.status === "unverified") unverified.push(`${theme}: the surface ledger after cleanup is not observable through __hubSceneStats`);

    return {
      theme,
      drawMsMean: r2(drawMean),
      drawMsP95: r2(drawP95),
      idleTaskMsPerS: r2(idleTask),
      cardRecalcDeltaMsPerFrame: r2(recalcDelta),
      cardWritesWithinGate: recalcDelta === null || !offConfirmed ? null : recalcDelta <= BUDGET.cardRecalcMsPerFrame,
      liveSurfaceMb: r2(memory / MB),
      canvasMb: r2(canvases / MB),
      paintStepMaxMs: r2(Math.max(0, ...withStats.map((row) => last(row)?.paintStepMaxMs ?? 0))),
      longTasks: longTasks.length,
      loadLongTasks: loadLongTasks.length,
      loadLongTaskMaxMs: loadLongTasks.length ? r2(Math.max(...loadLongTasks.map((t) => t.duration))) : null,
      throttle: t ?? null,
      phone: p ?? null,
      ledger: ledger ?? null,
    };
  });

  const report = { base: target.base, legacy: target.legacy, budgets: BUDGET, finishedAt: new Date().toISOString(), summary, rounds: roundsOut, failures, unverified };
  mkdirSync(".qa", { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  for (const row of summary) {
    console.log(`${row.theme.padEnd(14)} draw ${row.drawMsMean ?? "-"} ms (p95 ${row.drawMsP95 ?? "-"}), idle ${row.idleTaskMsPerS ?? "-"} ms/s, card recalc +${row.cardRecalcDeltaMsPerFrame ?? "-"} ms/frame, surfaces ${row.liveSurfaceMb ?? "-"} MB, canvases ${row.canvasMb ?? "-"} MB`);
  }
  for (const line of unverified) console.log(`UNVERIFIED ${line}`);
  for (const line of failures) console.error(`FAIL ${line}`);
  console.log(`report ${reportPath}`);
  return failures.length ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
