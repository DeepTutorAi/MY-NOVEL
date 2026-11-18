// Hub e2e (spec 5.4 with 8.3 items 2, 9, 10, 11, 12 and 8.4 items 5, 13, 21 and 31).
// Runs the per-cell checks on every theme in the build, at every size, with (S1) and
// without (S0) a seeded reading record, then the flows: reduced motion and pause, the
// dialogs, soft navigation, the picker by keyboard and on phones, rapid switching, the
// pause switch, the wipes, pick, attention parity, the scene-output handlers (perches,
// world label, focusCard, guide), touch and the mechanics paths.
//
// Theme-owned checks (computed styles, pixel probe, card light, still checksums) pass or
// fail on their own; in phase A a miss is reported as skipped with the measured value and
// the owning theme unit, in phase B it is a failure naming that unit. Flows that need a
// scene on the kit run against the themes that report hub:scene; until one does they are
// reported as "waiting for a kit theme" (skipped in phase A, failed in phase B).
//
// Usage: tsx src/scripts/hub/qa/hub-e2e.ts <baseUrl> [--themes a,b] [--sizes WxH,...]
//        [--states S0,S1] [--no-flows] [--phase A|B] [--legacy] [--report path] [--dry-run]
// Writes the report to --report, or .qa/hub-e2e-report-<themes>.json with --themes, or
// .qa/hub-e2e-report.json; screenshots go to a folder of their own per run under
// .qa/hub-shots/e2e/, so parallel runs never overwrite each other. Exits 1 on any failure.

import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { Browser, KeyInput, Page } from "puppeteer";

import { HUB_THEMES, MOTION_KEY, OVERRIDE_KEY, lowerFirst, weeklyTheme } from "../theme-core.mjs";
import type { HubThemeKey, Rect } from "../world/types";
import { FIXTURE_SIZES, hubUrl, launch, openCell, parseArgs, parseSize, parseSizes, parseThemes, seedReading, settle, themeStorage, themesInBuild, type Cell, type HubTarget, type Size } from "./browser";

const REPORT = ".qa/hub-e2e-report.json";
const SHOTS_ROOT = ".qa/hub-shots/e2e";
const ZOOM_SIZE = "720x450";
const TOPBAR_SIZES = new Set(["844x390", "720x450", "667x375"]);
const PROBE_SIZES = new Set(["1440x900", "390x844"]);
const BOX_TOLERANCE = 1;
const KIT_WAIT_MS = 3000;
/** The longest modalSettleMs in the spec (skyglass louvres): a scene may keep drawing this long after hub:modal. */
const MODAL_SETTLE_MAX_MS = 520;
const OPEN_STATUS = "เผยแพร่";
const NAME_ERROR_TH = "โปรดระบุชื่อก่อนบันทึก";

/** The unit that owns each theme's scene and skin (phase B). */
const UNIT: Record<HubThemeKey, string> = {
  "pages-stars": "U2 library",
  skyglass: "U3 skyglass",
  constellation: "U4 constellation",
  mothlight: "U5 mothlight",
  firefly: "U6 firefly",
};

const USAGE = `usage: tsx src/scripts/hub/qa/hub-e2e.ts <baseUrl> [options]
  --themes a,b     themes to run (default: every theme whose container is in the page)
  --sizes WxH,...  sizes (default ${FIXTURE_SIZES.join(",")}; ${ZOOM_SIZE} is always added for overflow and topbar)
  --states S0,S1   reading states (default S0,S1)
  --no-flows       skip every flow (reduced motion, pause, dialogs, navigation, picker, pick, attention, output, touch, mechanics)
  --phase A|B      B turns every theme-owned miss and every waiting check into a failure (default: HUB_PHASE or A)
  --legacy         pre-overhaul build: select themes through the stored override instead of ?theme=
  --report path    report file (default .qa/hub-e2e-report-<themes>.json with --themes, else ${REPORT});
                   screenshots go to ${SHOTS_ROOT}/<report name>-<time>/
  --dry-run        print the matrix and exit`;

type Status = "pass" | "fail" | "skip";
interface Check {
  name: string;
  status: Status;
  detail?: string;
}

class Recorder {
  readonly checks: Check[] = [];
  constructor(private readonly phaseB: boolean) {}
  expect(name: string, ok: boolean, detail?: string): boolean {
    this.checks.push({ name, status: ok ? "pass" : "fail", detail });
    return ok;
  }
  skip(name: string, reason: string): void {
    this.checks.push({ name, status: "skip", detail: reason });
  }
  /** A check whose result belongs to a theme unit: a miss fails in phase B and is skipped in phase A. */
  owned(name: string, ok: boolean, detail: string, owner: string): boolean {
    if (ok) this.checks.push({ name, status: "pass", detail });
    else if (this.phaseB) this.checks.push({ name, status: "fail", detail: `${detail} [owner: ${owner}]` });
    else this.checks.push({ name, status: "skip", detail: `phase B: waits for ${owner}; measured: ${detail}` });
    return ok;
  }
  /** A check that needs something not in the build yet (a scene on the kit): skipped in phase A, failed in phase B. */
  waiting(name: string, what: string): void {
    this.checks.push({ name, status: this.phaseB ? "fail" : "skip", detail: `waiting for ${what}` });
  }
}

type Box = Rect;
type Boxes = Record<string, Box | null>;
type Styles = Record<string, string>;

interface CellReport {
  id: string;
  theme: HubThemeKey;
  size: string;
  state: string;
  checks: Check[];
  boxes?: Boxes;
  styles?: Styles;
  screenshot?: string;
}

interface QaEvent {
  t: number;
  name: string;
  detail: Record<string, unknown>;
}

/** Instrumentation installed before any page script: theme at DOMContentLoaded, hub events, rAF and detached-canvas counters. */
const INSTRUMENT = `(() => {
  const qa = (window.__qa = { dclTheme: undefined, dclMotion: undefined, scenes: [], events: [], raf: 0, detachedDraws: 0, swaps: [] });
  document.addEventListener("DOMContentLoaded", () => {
    qa.dclTheme = document.documentElement.dataset.hubTheme ?? null;
    qa.dclMotion = document.documentElement.dataset.hubMotion ?? null;
  });
  document.addEventListener("hub:scene", (e) => qa.scenes.push({ t: performance.now(), detail: e.detail }));
  for (const name of ["hub:stage", "hub:attention", "hub:pick", "hub:theme", "hub:modal", "hub:press", "hub:motion"]) {
    document.addEventListener(name, (e) => qa.events.push({ t: performance.now(), name, detail: e.detail ?? {} }));
  }
  document.addEventListener("astro:after-swap", () => qa.swaps.push({ path: location.pathname, theme: document.documentElement.dataset.hubTheme ?? null }));
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((ts) => { qa.raf++; cb(ts); });
  const seen = new WeakSet();
  const proto = CanvasRenderingContext2D.prototype;
  for (const name of ["fillRect", "strokeRect", "clearRect", "drawImage", "fill", "stroke", "fillText", "putImageData"]) {
    const original = proto[name];
    proto[name] = function (...args) {
      const canvas = this.canvas;
      if (canvas && canvas.isConnected) seen.add(canvas);
      else if (canvas && seen.has(canvas)) qa.detachedDraws++;
      return original.apply(this, args);
    };
  }
})();`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const intersects = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (r: Rect | null, vw: number, vh: number) => !!r && r.w > 0 && r.h > 0 && r.x >= -0.5 && r.y >= -0.5 && r.x + r.w <= vw + 0.5 && r.y + r.h <= vh + 0.5;
const fmt = (r: Rect | null) => (r ? `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.w)}x${Math.round(r.h)}` : "missing");
const containerOf = (theme: HubThemeKey) => HUB_THEMES.find((row) => row.key === theme)?.container ?? "";

/** Polls `probe` every 100 ms until it returns true or `ms` passes; returns the last result. */
async function poll(probe: () => Promise<boolean>, ms: number, every = 100): Promise<boolean> {
  const end = Date.now() + ms;
  for (;;) {
    if (await probe()) return true;
    if (Date.now() >= end) return false;
    await sleep(every);
  }
}

async function openHub(browser: Browser, target: HubTarget, theme: HubThemeKey | null, size: string, options: { reducedMotion?: boolean; paused?: boolean; reading?: boolean; params?: Record<string, string> } = {}): Promise<Cell> {
  const storage = theme ? themeStorage(target, theme, options.paused) : options.paused ? { [MOTION_KEY]: "still" } : {};
  const cell = await openCell(browser, parseSize(size), { reducedMotion: options.reducedMotion, storage });
  await cell.page.evaluateOnNewDocument(INSTRUMENT);
  if (options.reading) await seedReading(cell.page, target.base);
  const url = theme ? hubUrl(target, theme, options.params) : target.base;
  await cell.page.goto(url, { waitUntil: "load" });
  return cell;
}

/** Viewport rects (scrollY 0) of the parts the fold and layout checks need. */
async function readLayout(page: Page) {
  return page.evaluate(() => {
    scrollTo(0, 0);
    const vis = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
    const one = (selector: string) => vis(document.querySelector(selector));
    const h1 = document.querySelector<HTMLElement>(".hub-hero h1");
    const resume = one("[data-hub-resume]");
    const boxes: Record<string, { x: number; y: number; w: number; h: number } | null> = {
      h1: one(".hub-hero h1"),
      subtitle: one(".hub-title-group > p"),
      chip: one("[data-profile-widget]"),
      picker: one(".hub-topbar [data-hub-picker-open]"),
      "resume-or-start": resume ?? one("[data-hub-start]"),
      stage: one('[data-hub-window="stage"]'),
      libraryHead: one(".hub-library-head"),
      mid: one('[data-hub-window="mid"]'),
      footer: one(".hub-footer"),
    };
    for (const wrapper of document.querySelectorAll<HTMLElement>(".novel-card-wrapper")) {
      const slug = wrapper.dataset.novelSlug ?? wrapper.dataset.upcomingSlug ?? "?";
      boxes[`card:${slug}`] = vis(wrapper);
    }
    const canvases = [...document.querySelectorAll<HTMLCanvasElement>("canvas.hub-window-canvas")].map((c) => c.getBoundingClientRect().width);
    return {
      vw: innerWidth,
      vh: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      h1Overflow: h1 ? h1.scrollWidth - h1.clientWidth : null,
      topbar: one(".hub-topbar"),
      resume,
      resumeLink: one("[data-resume-link]"),
      resumeClear: one("[data-hub-resume] [data-resume-clear]"),
      start: one("[data-hub-start]"),
      startPick: one('[data-hub-pick="start"]'),
      stageHit: one('[data-hub-hit="stage"]'),
      firstCard: one(".novel-card-wrapper"),
      canvases,
      boxes,
    };
  });
}

/** Computed paint styles of the parts that must differ between themes (spec 5.4). */
async function readStyles(page: Page): Promise<Styles> {
  return page.evaluate(() => {
    const pick = (selector: string, props: string[]) => {
      const el = document.querySelector(selector);
      if (!el) return "missing";
      const cs = getComputedStyle(el);
      return props.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";");
    };
    const paint = ["color", "background-color", "background-image", "border-top-color", "border-radius", "box-shadow", "font-family"];
    return {
      card: pick(".novel-card", paint),
      title: pick(".hub-hero h1", [...paint, "filter"]),
      chip: pick("[data-profile-widget]", paint),
      picker: pick(".hub-topbar [data-hub-picker-open]", paint),
      footer: pick(".hub-footer-row", paint),
      resume: pick("[data-hub-resume]:not([hidden]), [data-hub-start]", paint),
      dialog: pick(".hub-picker-card", paint),
    };
  });
}

async function activeInitialized(page: Page): Promise<string[]> {
  const rows = HUB_THEMES.map((row) => ({ key: row.key, flag: `__${lowerFirst(row.bind)}Initialized` }));
  return page.evaluate((list: { key: string; flag: string }[]) => {
    const w = window as unknown as Record<string, unknown>;
    return list.filter((row) => w[row.flag] === true).map((row) => row.key);
  }, rows);
}

/** Polls up to `ms` for exactly one initialized scene; returns the last reading. */
async function waitInitialized(page: Page, ms: number): Promise<string[]> {
  const end = Date.now() + ms;
  let live = await activeInitialized(page);
  while (live.length !== 1 && Date.now() < end) {
    await sleep(100);
    live = await activeInitialized(page);
  }
  return live;
}

async function sceneEvents(page: Page): Promise<{ t: number; detail: { key?: string; status?: string } }[]> {
  return page.evaluate(() => (window as unknown as { __qa: { scenes: { t: number; detail: { key?: string; status?: string } }[] } }).__qa.scenes);
}

async function qaEvents(page: Page, name?: string): Promise<QaEvent[]> {
  const events = await page.evaluate(() => (window as unknown as { __qa: { events: QaEvent[] } }).__qa.events);
  return name ? events.filter((e) => e.name === name) : events;
}

async function pageNow(page: Page): Promise<number> {
  return page.evaluate(() => performance.now());
}

/** True once the theme's scene has reported through the kit (hub:scene); legacy scenes never do. */
async function onKit(page: Page, theme: HubThemeKey): Promise<boolean> {
  return (await sceneEvents(page)).some((e) => e.detail?.key === theme);
}

async function waitKit(page: Page, theme: HubThemeKey, ms = KIT_WAIT_MS): Promise<boolean> {
  return poll(() => onKit(page, theme), ms);
}

/** rAF callbacks over `ms`, counted by the injected wrapper (the harness itself uses timers only). */
async function rafOver(page: Page, ms: number): Promise<number> {
  const before = await page.evaluate(() => (window as unknown as { __qa: { raf: number } }).__qa.raf);
  await sleep(ms);
  const after = await page.evaluate(() => (window as unknown as { __qa: { raf: number } }).__qa.raf);
  return after - before;
}

/** Visible canvases in the theme container whose pixels are all transparent. */
async function emptyCanvases(page: Page, container: string): Promise<{ total: number; empty: string[] }> {
  return page.evaluate((id: string) => {
    const host = document.getElementById(id);
    const canvases = host ? [...host.querySelectorAll("canvas")] : [];
    const visible = canvases.filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(c).display !== "none" && c.width > 0 && c.height > 0;
    });
    const probe = document.createElement("canvas");
    probe.width = 64;
    probe.height = 64;
    const g = probe.getContext("2d", { willReadFrequently: true });
    const empty: string[] = [];
    for (const [i, c] of visible.entries()) {
      if (!g) break;
      g.clearRect(0, 0, 64, 64);
      g.drawImage(c, 0, 0, 64, 64);
      const data = g.getImageData(0, 0, 64, 64).data;
      let any = false;
      for (let k = 3; k < data.length; k += 4) if (data[k] > 0) { any = true; break; }
      if (!any) empty.push(`${c.className || "canvas"}#${i}`);
    }
    return { total: visible.length, empty };
  }, container);
}

/** A 48x48 pixel digest of a canvas ("empty" when every pixel is transparent, "missing" without one). */
async function canvasSum(page: Page, selector: string): Promise<string> {
  return page.evaluate((sel: string) => {
    const c = document.querySelector<HTMLCanvasElement>(sel);
    if (!c || c.width === 0 || c.height === 0) return "missing";
    const probe = document.createElement("canvas");
    probe.width = 48;
    probe.height = 48;
    const g = probe.getContext("2d", { willReadFrequently: true });
    if (!g) return "missing";
    g.drawImage(c, 0, 0, 48, 48);
    const data = g.getImageData(0, 0, 48, 48).data;
    let hash = 2166136261;
    let any = false;
    for (let k = 0; k < data.length; k++) {
      if (k % 4 === 3 && data[k] > 0) any = true;
      hash = Math.imul(hash ^ (data[k] >> 2), 16777619) >>> 0;
    }
    return any ? hash.toString(16) : "empty";
  }, selector);
}

const windowCanvas = (name: "stage" | "mid" | "ground") => `[data-hub-window="${name}"] canvas[data-hub-window-canvas]`;

async function scrollToSelector(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.scrollIntoView({ block: "center", behavior: "instant" });
    return true;
  }, selector);
}

async function themeNow(page: Page): Promise<string | null> {
  return page.evaluate(() => document.documentElement.dataset.hubTheme ?? null);
}

async function activeMatches(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel: string) => document.activeElement?.matches(sel) ?? false, selector);
}

/** Card light on a wrapper: --w-glow above 0 or a beat attribute (spec 5.4 attention parity). */
async function cardLit(page: Page, slug: string): Promise<{ glow: number; beat: string | null }> {
  return page.evaluate((s: string) => {
    const w = document.querySelector<HTMLElement>(`.novel-card-wrapper[data-novel-slug="${s}"]`);
    if (!w) return { glow: 0, beat: null };
    const glow = Number.parseFloat(getComputedStyle(w).getPropertyValue("--w-glow"));
    return { glow: Number.isFinite(glow) ? glow : 0, beat: w.getAttribute("data-w-beat") };
  }, slug);
}

/**
 * Contrast of each text part against the brightest (light text) or darkest (dark text)
 * pixel behind it, with the text itself hidden (spec 5.4 pixel probe).
 */
async function pixelProbe(page: Page): Promise<{ part: string; ratio: number; detail: string }[]> {
  const parts: [string, string][] = [
    ["title", ".hub-hero h1"],
    ["subtitle", ".hub-title-group > p"],
    ["side note", ".hub-side-note"],
    ["footer", ".hub-footer-row"],
  ];
  const results: { part: string; ratio: number; detail: string }[] = [];
  await page.addStyleTag({
    content:
      "[data-qa-hide], [data-qa-hide] * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; } [data-qa-hide='fill'] { background: none !important; filter: none !important; }",
  });
  for (const [part, selector] of parts) {
    const info = await page.evaluate((sel: string) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el || el.getClientRects().length === 0) return null;
      el.scrollIntoView({ block: "center", behavior: "instant" });
      const cs = getComputedStyle(el);
      const color = sel.endsWith("h1") ? cs.getPropertyValue("--hub-title-solid").trim() || cs.color : cs.color;
      el.setAttribute("data-qa-hide", sel.endsWith("h1") ? "fill" : "");
      const r = el.getBoundingClientRect();
      // Screenshot clips are in document coordinates: the visible part of the box, shifted by the scroll.
      const x = Math.max(0, r.left);
      const y = Math.max(0, r.top);
      return { color, x: x + scrollX, y: y + scrollY, w: Math.min(r.right, innerWidth) - x, h: Math.min(r.bottom, innerHeight) - y };
    }, selector);
    if (!info || info.w < 2 || info.h < 2) {
      await page.evaluate((sel: string) => document.querySelector(sel)?.removeAttribute("data-qa-hide"), selector);
      continue;
    }
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const shot = await page.screenshot({ clip: { x: info.x, y: info.y, width: info.w, height: info.h }, encoding: "base64" });
    const measured = await page.evaluate(
      async (b64: string, color: string) => {
        const lum = (r: number, g: number, b: number) => {
          const f = (v: number) => {
            const c = v / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const swatch = document.createElement("canvas");
        swatch.width = 1;
        swatch.height = 1;
        const sg = swatch.getContext("2d", { willReadFrequently: true });
        if (!sg) return null;
        sg.fillStyle = color;
        sg.fillRect(0, 0, 1, 1);
        const [tr, tg, tb] = sg.getImageData(0, 0, 1, 1).data;
        const textL = lum(tr, tg, tb);
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const g = c.getContext("2d", { willReadFrequently: true });
        if (!g) return null;
        g.drawImage(img, 0, 0);
        const data = g.getImageData(0, 0, c.width, c.height).data;
        // Light text is judged against the bright end of the backdrop, dark text against the dark
        // end. The 99.5th percentile stands for the brightest (darkest) sample, so single
        // antialiased sparkle pixels do not decide the result; the true extreme is reported too.
        const light = textL > 0.18;
        const values: number[] = [];
        for (let k = 0; k < data.length; k += 4) values.push(lum(data[k], data[k + 1], data[k + 2]));
        values.sort((p, q) => (light ? q - p : p - q));
        const worst = values[Math.min(values.length - 1, Math.floor(values.length * 0.005))] ?? 0;
        const extreme = values[0] ?? 0;
        const ratio = (Math.max(textL, worst) + 0.05) / (Math.min(textL, worst) + 0.05);
        return { ratio, text: `rgb(${tr} ${tg} ${tb})`, worst, extreme };
      },
      shot as string,
      info.color,
    );
    await page.evaluate((sel: string) => document.querySelector(sel)?.removeAttribute("data-qa-hide"), selector);
    if (measured) results.push({ part, ratio: measured.ratio, detail: `${measured.ratio.toFixed(2)}:1, text ${measured.text}, backdrop luminance p99.5 ${measured.worst.toFixed(3)} (extreme ${measured.extreme.toFixed(3)})` });
  }
  await page.evaluate(() => scrollTo(0, 0));
  return results;
}

async function runCell(page: Page, rec: Recorder, ctx: { theme: HubThemeKey; size: Size; state: string; errors: string[] }): Promise<{ boxes: Boxes; styles: Styles }> {
  const { theme, size, state, errors } = ctx;
  const dcl = await page.evaluate(() => (window as unknown as { __qa: { dclTheme: unknown } }).__qa.dclTheme);
  rec.expect("html[data-hub-theme] at DOMContentLoaded", dcl === theme, `got ${JSON.stringify(dcl)}`);

  const start = Date.now();
  let scene: { key?: string; status?: string } | undefined;
  while (Date.now() - start < 2000) {
    scene = (await sceneEvents(page)).find((e) => e.detail?.key === theme && (e.detail.status === "ready" || e.detail.status === "still"))?.detail;
    if (scene) break;
    await sleep(100);
  }
  if (scene) rec.expect("hub:scene ready or still within 2 s", true, scene.status);
  else rec.waiting("hub:scene ready or still within 2 s", `the ${theme} scene on the kit (${UNIT[theme]})`);
  const live = await waitInitialized(page, 2000);
  rec.expect("exactly one __*Initialized is true, the active theme's", live.length === 1 && live[0] === theme, `live: [${live.join(", ")}]`);

  await settle(page, 300);
  const layout = await readLayout(page);
  rec.expect("no horizontal scroll", layout.scrollWidth === layout.clientWidth, `scrollWidth ${layout.scrollWidth}, clientWidth ${layout.clientWidth}`);
  rec.expect("h1 fits on one line (scrollWidth <= clientWidth)", layout.h1Overflow !== null && layout.h1Overflow <= 0, `overflow ${layout.h1Overflow}`);

  const { vw, vh } = layout;
  if (["390x844", "320x568", "844x390"].includes(size.label)) {
    if (state === "S1") {
      rec.expect("fold: resume link inside the first viewport", inside(layout.resumeLink, vw, vh), fmt(layout.resumeLink));
      rec.expect("fold: resume clear inside the first viewport", inside(layout.resumeClear, vw, vh), fmt(layout.resumeClear));
    } else {
      rec.expect('fold: [data-hub-pick="start"] inside the first viewport', inside(layout.startPick, vw, vh), fmt(layout.startPick));
    }
    if (size.label === "320x568") {
      const stage = layout.boxes.stage;
      const visibleH = stage ? Math.max(0, Math.min(stage.y + stage.h, vh) - Math.max(stage.y, 0)) : 0;
      rec.expect("fold: at least 50% of the stage box inside the first viewport", !!stage && visibleH >= stage.h / 2, `${fmt(stage)}, ${Math.round(visibleH)} px visible`);
    } else {
      rec.expect("fold: stage hit button inside the first viewport", inside(layout.stageHit, vw, vh), fmt(layout.stageHit));
    }
  }
  if (size.label === "1440x900") {
    rec.expect("fold: title visible", inside(layout.boxes.h1, vw, vh), fmt(layout.boxes.h1));
    const panel = state === "S1" ? layout.resume : layout.start;
    rec.expect(`fold: ${state === "S1" ? "resume card" : "start panel"} visible`, inside(panel, vw, vh), fmt(panel));
    rec.expect("fold: at least 40 px of the first card row visible", !!layout.firstCard && layout.firstCard.y <= vh - 40, fmt(layout.firstCard));
  }
  if (TOPBAR_SIZES.has(size.label)) {
    const bar = layout.topbar;
    const hits = [layout.boxes.h1, layout.boxes.subtitle].filter((r): r is Rect => !!r && !!bar && intersects(bar, r));
    rec.expect("topbar overlaps neither the h1 nor the subtitle", !!bar && hits.length === 0, `topbar ${fmt(bar)}, h1 ${fmt(layout.boxes.h1)}, subtitle ${fmt(layout.boxes.subtitle)}`);
  }
  rec.expect(
    "window canvases are as wide as the viewport",
    layout.canvases.length === 3 && layout.canvases.every((w) => Math.abs(w - vw) <= 1),
    `${layout.canvases.length} canvases, widths [${layout.canvases.map(Math.round).join(", ")}], viewport ${vw}`,
  );

  const styles = await readStyles(page);
  if (PROBE_SIZES.has(size.label) && state === "S0") {
    for (const probe of await pixelProbe(page)) {
      rec.owned(`pixel probe: ${probe.part} text at least 4.5:1 against the brightest or darkest pixel behind it`, probe.ratio >= 4.5, probe.detail, UNIT[theme]);
    }
  }

  rec.expect("no console errors", errors.length === 0, errors.slice(0, 5).join(" | "));
  return { boxes: layout.boxes, styles };
}

/** Focuses a hit button and fires Enter (and the arrows for the stage); checks hub:stage and the still checksum. */
async function hitChecks(page: Page, rec: Recorder, theme: HubThemeKey, label: string): Promise<void> {
  for (const name of ["stage", "mid"] as const) {
    const selector = `[data-hub-hit="${name}"]`;
    await scrollToSelector(page, selector);
    await sleep(500);
    const enabled = await page.evaluate((sel: string) => !(document.querySelector<HTMLButtonElement>(sel)?.disabled ?? true), selector);
    rec.expect(`${label}: ${name} hit button enabled once the scene reports`, enabled);
    if (!enabled) continue;
    const before = await canvasSum(page, windowCanvas(name));
    const since = await pageNow(page);
    await page.focus(selector);
    await page.keyboard.press("Enter");
    await sleep(350);
    const afterTap = await canvasSum(page, windowCanvas(name));
    const keys: KeyInput[] = name === "stage" ? ["ArrowLeft", "ArrowRight"] : [];
    for (const key of keys) {
      await page.keyboard.press(key);
      await sleep(150);
    }
    const actions = (await qaEvents(page, "hub:stage")).filter((e) => e.t >= since && e.detail.window === name).map((e) => String(e.detail.action));
    const wanted = name === "stage" ? ["tap", "left", "right"] : ["tap"];
    rec.expect(`${label}: ${name} hit Enter${name === "stage" ? ", ArrowLeft and ArrowRight emit" : " emits"} hub:stage`, wanted.every((a) => actions.includes(a)), `actions [${actions.join(", ")}]`);
    rec.owned(`${label}: ${name} hit changes the ${name} window still`, before !== afterTap && afterTap !== "empty", `${before} → ${afterTap}`, UNIT[theme]);
  }
}

async function stillFlow(page: Page, rec: Recorder, theme: HubThemeKey, mode: "reduced" | "pause"): Promise<void> {
  const row = HUB_THEMES.find((r) => r.key === theme);
  if (mode === "pause") {
    const motion = await page.evaluate(() => document.documentElement.dataset.hubMotion ?? null);
    rec.expect('html[data-hub-motion="still"] with the stored pause', motion === "still", `got ${JSON.stringify(motion)}`);
  }
  await sleep(2500);
  const kit = await onKit(page, theme);
  const frames = await rafOver(page, 1000);
  if (frames === 0 || kit || mode === "reduced") rec.expect("no rAF callbacks over 1 s after settling", frames === 0, `${frames} callbacks`);
  else rec.waiting("no rAF callbacks over 1 s after settling", `the ${theme} scene on the kit (${UNIT[theme]}); the legacy scene ran ${frames} callbacks`);
  const canvases = await emptyCanvases(page, row?.container ?? "");
  rec.expect("the theme's visible canvases are drawn", canvases.total > 0 && canvases.empty.length === 0, `${canvases.total} visible, empty: [${canvases.empty.join(", ")}]`);
  const guide = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>("[data-hub-guide]");
    if (!el) return null;
    return { state: el.dataset.hubGuide ?? null, visible: getComputedStyle(el).visibility === "visible", animations: el.getAnimations().length };
  });
  rec.expect("guide placed and not animating", !!guide && guide.state === "rest" && guide.visible && guide.animations === 0, JSON.stringify(guide));
  if (!kit) {
    rec.waiting("window canvases drawn in the still", `the ${theme} scene on the kit (${UNIT[theme]})`);
    rec.waiting("hit buttons: Enter and arrows emit hub:stage and change the still", `the ${theme} scene on the kit (${UNIT[theme]})`);
    return;
  }
  const blank: string[] = [];
  for (const name of ["stage", "mid", "ground"] as const) {
    await scrollToSelector(page, `[data-hub-window="${name}"]`);
    await sleep(450);
    const sum = await canvasSum(page, windowCanvas(name));
    if (sum === "empty" || sum === "missing") blank.push(`${name}: ${sum}`);
  }
  rec.owned("window canvases drawn in the still", blank.length === 0, blank.join(", ") || "stage, mid and ground drawn", UNIT[theme]);
  await hitChecks(page, rec, theme, mode === "pause" ? "paused" : "reduced motion");
}

async function softNavigationFlow(page: Page, rec: Recorder, base: string): Promise<void> {
  await page.goto(base, { waitUntil: "load" });
  await settle(page, 500);
  const theme = await themeNow(page);
  rec.expect("hub resolves a theme without ?theme=", theme !== null, `got ${JSON.stringify(theme)}`);
  const legs: [string, string][] = [
    ["lodge", "/lodge/"],
    ["tsukinomi", "/tsukinomi/"],
  ];
  for (const [slug, path] of legs) {
    const link = await page.$(`.novel-card-wrapper[data-novel-slug="${slug}"] a.novel-card[href*="${path}"]`);
    if (!rec.expect(`hub → ${slug}: card link found`, !!link)) return;
    const swapsBefore = await page.evaluate(() => (window as unknown as { __qa?: { swaps: unknown[] } }).__qa?.swaps.length ?? -1);
    await link?.click();
    await page.waitForFunction((p: string) => location.pathname.includes(p), { timeout: 15000 }, path);
    await settle(page, 600);
    const soft = await page.evaluate((n: number) => ((window as unknown as { __qa?: { swaps: unknown[] } }).__qa?.swaps.length ?? -1) > n && n >= 0, swapsBefore);
    if (!rec.expect(`hub → ${slug}: soft navigation (astro:after-swap)`, soft)) return;
    await page.evaluate(() => {
      (window as unknown as { __qa: { detachedDraws: number } }).__qa.detachedDraws = 0;
    });
    await sleep(1000);
    const detached = await page.evaluate(() => (window as unknown as { __qa: { detachedDraws: number } }).__qa.detachedDraws);
    rec.expect(`hub → ${slug}: no 2D draws on removed hub canvases over 1 s`, detached === 0, `${detached} draws`);
    const left = await activeInitialized(page);
    rec.expect(`hub → ${slug}: no hub scene stays live`, left.length === 0, `live: [${left.join(", ")}]`);

    const home = await page.$('a[href="/"]');
    if (!rec.expect(`${slug} → hub: link to the hub found`, !!home)) return;
    await home?.click();
    await page.waitForFunction(() => location.pathname === "/" && !!document.querySelector(".hub-shell"), { timeout: 15000 });
    const swap = await page.evaluate(() => {
      const swaps = (window as unknown as { __qa?: { swaps: { path: string; theme: string | null }[] } }).__qa?.swaps ?? [];
      return swaps[swaps.length - 1] ?? null;
    });
    rec.expect(`${slug} → hub: data-hub-theme already set at astro:after-swap`, swap?.path === "/" && swap.theme === theme, JSON.stringify(swap));
    await settle(page, 800);
    const live = await waitInitialized(page, 2000);
    rec.expect(`${slug} → hub: exactly one scene live`, live.length === 1 && live[0] === theme, `live: [${live.join(", ")}]`);
    const chipShown = await page.evaluate(() => {
      const chip = document.querySelector<HTMLElement>("[data-profile-widget]");
      return !!chip && getComputedStyle(chip).display !== "none" && chip.getBoundingClientRect().width > 0;
    });
    rec.expect(`${slug} → hub: profile chip visible`, chipShown);
    const edit = await page.$("[data-profile-edit-btn]");
    await edit?.click();
    await sleep(300);
    const opened = await page.evaluate(() => {
      const dialog = document.querySelector<HTMLElement>("[data-edit-profile-modal]");
      return !!dialog && getComputedStyle(dialog).display !== "none";
    });
    rec.expect(`${slug} → hub: chip Edit opens its dialog`, !!edit && opened);
    await page.keyboard.press("Escape");
    await sleep(300);
  }
}

async function dialogFlow(page: Page, rec: Recorder, theme: HubThemeKey, target: HubTarget): Promise<void> {
  await page.goto(hubUrl(target, theme), { waitUntil: "load" });
  await settle(page, 800);
  const kit = await waitKit(page, theme, 1500);
  const edit = await page.$("[data-profile-edit-btn]");
  if (!rec.expect("edit button found", !!edit)) return;
  await page.evaluate(() => {
    (window as unknown as { __qaAlerts: number }).__qaAlerts = 0;
    window.alert = () => {
      (window as unknown as { __qaAlerts: number }).__qaAlerts++;
    };
  });
  await edit?.focus();
  await page.keyboard.press("Enter");
  await sleep(400);
  const state = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>("[data-edit-profile-modal]");
    return {
      open: !!dialog && dialog.hasAttribute("data-open") && getComputedStyle(dialog).display !== "none",
      inert: !!document.querySelector("main.hub-shell")?.hasAttribute("inert"),
      focusInside: !!dialog && dialog.contains(document.activeElement),
    };
  });
  rec.expect("edit dialog opens with [data-open]", state.open);
  rec.expect("main.hub-shell is inert while the dialog is open", state.inert);
  rec.expect("focus moves into the dialog", state.focusInside);
  let escaped = false;
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const within = await page.evaluate(() => !!document.querySelector("[data-edit-profile-modal]")?.contains(document.activeElement));
    if (!within) escaped = true;
  }
  rec.expect("Tab cycles inside the dialog", !escaped);
  // Count only after the scene's modal settle time, measured in page time from hub:modal.
  const opened = (await qaEvents(page, "hub:modal")).filter((e) => e.detail.open === true).pop();
  if (opened) {
    const wait = opened.t + MODAL_SETTLE_MAX_MS + 100 - (await pageNow(page));
    if (wait > 0) await sleep(wait);
  }
  const frames = await rafOver(page, 1000);
  if (frames === 0 || kit) rec.expect("the scene stops while the dialog is open (rAF flat over 1 s)", frames === 0, `${frames} callbacks`);
  else rec.waiting("the scene stops while the dialog is open (rAF flat over 1 s)", `the ${theme} scene on the kit (${UNIT[theme]}); the legacy scene ran ${frames} callbacks`);
  const nameInput = await page.$("#edit-profile-name");
  if (nameInput) {
    await nameInput.click({ count: 3 });
    await page.keyboard.press("Backspace");
    const save = await page.$("[data-edit-profile-modal] .btn-primary");
    await save?.click();
    await sleep(300);
    const error = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>("[data-profile-name-error]");
      return { shown: !!el && !el.hidden, text: el?.textContent?.trim() ?? "", alerts: (window as unknown as { __qaAlerts: number }).__qaAlerts };
    });
    rec.expect("an empty name shows the inline error and no alert", error.shown && error.text === NAME_ERROR_TH && error.alerts === 0, JSON.stringify(error));
  } else rec.expect("name input found", false);
  await page.keyboard.press("Escape");
  await sleep(400);
  const after = await page.evaluate(() => ({
    closed: !document.querySelector("[data-edit-profile-modal]")?.hasAttribute("data-open"),
    inert: !!document.querySelector("main.hub-shell")?.hasAttribute("inert"),
    focus: document.activeElement?.matches("[data-profile-edit-btn]") ?? false,
  }));
  rec.expect("Escape closes the dialog", after.closed);
  rec.expect("inert is removed after closing", !after.inert);
  rec.expect("focus returns to the edit button", after.focus);
}

/** Both profile dialogs fit short and narrow viewports: the card stays inside the
    viewport, its close button shows, and its primary action is reachable by scrolling
    the card itself (2.20, never clip). */
async function dialogFitFlow(browser: Browser, target: HubTarget, rec: Recorder, theme: HubThemeKey): Promise<void> {
  const dialogs = [
    { name: "edit profile", open: "[data-profile-edit-btn]", dialog: "[data-edit-profile-modal]", close: "[data-edit-profile-modal] .modal-close-btn", action: "[data-save-profile-btn]" },
    { name: "settings", open: "[data-profile-settings-btn]", dialog: "[data-settings-modal]", close: "[data-settings-close-btn]", action: "[data-add-guest-btn]" },
  ];
  for (const size of ["844x390", "667x375", "320x568"]) {
    const cell = await openHub(browser, target, theme, size, { reading: true });
    try {
      await settle(cell.page, 600);
      for (const d of dialogs) {
        await cell.page.evaluate(() => scrollTo(0, 0));
        await cell.page.click(d.open);
        await sleep(450);
        const fit = await cell.page.evaluate((q: typeof d) => {
          const box = (sel: string) => {
            const r = document.querySelector(sel)?.getBoundingClientRect();
            return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
          };
          const card = document.querySelector<HTMLElement>(`${q.dialog} .hub-modal-card`);
          const cardBox = box(`${q.dialog} .hub-modal-card`);
          const closeBox = box(q.close);
          if (card) card.scrollTop = card.scrollHeight;
          const actionBox = box(q.action);
          if (card) card.scrollTop = 0;
          return { cardBox, closeBox, actionBox, vw: innerWidth, vh: innerHeight };
        }, d);
        const ok = inside(fit.cardBox, fit.vw, fit.vh) && inside(fit.closeBox, fit.vw, fit.vh) && inside(fit.actionBox, fit.vw, fit.vh);
        rec.expect(`${size} ${d.name}: the card fits the viewport, the close button shows and the action is reachable`, ok, `card ${fmt(fit.cardBox)}, close ${fmt(fit.closeBox)}, action after scrolling the card ${fmt(fit.actionBox)}`);
        await cell.page.keyboard.press("Escape");
        await sleep(350);
      }
      rec.expect(`${size}: no console errors`, cell.errors.length === 0, cell.errors.slice(0, 5).join(" | "));
    } finally {
      await cell.close();
    }
  }
}

/* ------------------------------------------------------------------ picker flows */

const PICKER_OPEN = "#hub-theme-picker[data-open]";
const TOPBAR_PICKER = ".hub-topbar [data-hub-picker-open]";

async function pickerOpen(page: Page): Promise<boolean> {
  return page.evaluate((sel: string) => document.querySelector(sel) !== null, PICKER_OPEN);
}

async function radioValues(page: Page): Promise<string[]> {
  return page.evaluate(() => [...document.querySelectorAll<HTMLInputElement>('input[name="hub-theme"]')].map((r) => r.value));
}

async function focusedRadio(page: Page): Promise<{ radio: boolean; checked: boolean; value: string }> {
  return page.evaluate(() => {
    const a = document.activeElement;
    const radio = a instanceof HTMLInputElement && a.name === "hub-theme";
    return { radio, checked: radio && (a as HTMLInputElement).checked, value: radio ? (a as HTMLInputElement).value : "" };
  });
}

async function storedOverride(page: Page): Promise<string | null> {
  return page.evaluate((key: string) => localStorage.getItem(key), OVERRIDE_KEY);
}

async function pickerKeyboardFlow(browser: Browser, target: HubTarget, rec: Recorder): Promise<void> {
  const cell = await openHub(browser, target, null, "1440x900");
  const { page } = cell;
  try {
    await settle(page, 800);
    const start = await themeNow(page);
    const weekly = weeklyTheme(Date.now());
    rec.expect("without an override the hub shows this week's theme", start === weekly, `${start} (weekly ${weekly})`);
    let reached = false;
    for (let i = 0; i < 25 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await activeMatches(page, TOPBAR_PICKER);
    }
    if (!rec.expect("Tab reaches the picker button", reached)) return;
    await page.keyboard.press("Enter");
    const opened = await poll(() => pickerOpen(page), 2000);
    rec.expect("Enter opens the picker", opened);
    const focus = await focusedRadio(page);
    rec.expect('focus lands on the checked radio ("อัตโนมัติ" without an override)', focus.radio && focus.checked && focus.value === "auto", JSON.stringify(focus));
    const values = await radioValues(page);
    let idx = values.indexOf(focus.value);
    let presses = 0;
    let next = "";
    do {
      idx = (idx + 1) % values.length;
      presses++;
      next = values[idx];
    } while ((next === "auto" || next === start) && presses < values.length);
    const since = await pageNow(page);
    for (let i = 0; i < presses; i++) await page.keyboard.press("ArrowDown");
    await sleep(250);
    rec.expect("the theme does not change before 400 ms", (await themeNow(page)) === start, `still ${await themeNow(page)}`);
    const applied = await poll(async () => (await themeNow(page)) === next, 2500);
    rec.expect("ArrowDown applies the next theme after 400 ms", applied, `${start} → ${next} (${presses} presses)`);
    const switched = (await qaEvents(page, "hub:theme")).find((e) => e.t >= since && e.detail.source === "picker");
    rec.expect("the switch waited at least 400 ms after the last arrow", !!switched && switched.t - since >= 400, switched ? `${Math.round(switched.t - since)} ms` : "no hub:theme from the picker");
    rec.expect("the choice is stored", (await storedOverride(page)) === next, `stored ${await storedOverride(page)}`);
    const nextKey = next as HubThemeKey;
    const drawn = await poll(async () => {
      const r = await emptyCanvases(page, containerOf(nextKey));
      return r.total > 0 && r.empty.length === 0;
    }, 1000);
    rec.owned("switch with the picker open: the new scene's canvases are non-empty within 1 s (8.3 item 2)", drawn, `${nextKey} canvases`, UNIT[nextKey]);
    rec.expect("the picker stays open while the theme switches", await pickerOpen(page));
    await page.keyboard.press("Escape");
    await sleep(300);
    rec.expect("Escape closes the picker", !(await pickerOpen(page)));
    rec.expect("focus returns to the picker button", await activeMatches(page, TOPBAR_PICKER));

    await page.reload({ waitUntil: "load" });
    await settle(page, 600);
    rec.expect("the choice survives a reload", (await themeNow(page)) === next, `got ${await themeNow(page)}`);

    await page.focus(TOPBAR_PICKER);
    await page.keyboard.press("Enter");
    await poll(() => pickerOpen(page), 2000);
    const again = await focusedRadio(page);
    rec.expect("on reopening, focus lands on the stored choice", again.radio && again.checked && again.value === next, JSON.stringify(again));
    const ups = values.indexOf(next) - values.indexOf("auto");
    await sleep(1100);
    for (let i = 0; i < ups; i++) await page.keyboard.press("ArrowUp");
    const back = await poll(async () => (await storedOverride(page)) === null && (await themeNow(page)) === weekly, 3000);
    rec.expect('"อัตโนมัติ" removes the stored key and returns to this week\'s theme', back, `stored ${await storedOverride(page)}, theme ${await themeNow(page)}`);
    await page.keyboard.press("Escape");

    const param = HUB_THEMES.map((row) => row.key).find((key) => key !== weekly) ?? weekly;
    const url = new URL(target.base);
    url.searchParams.set("theme", param);
    await page.goto(url.toString(), { waitUntil: "load" });
    await settle(page, 400);
    rec.expect("?theme= selects the theme", (await themeNow(page)) === param, `got ${await themeNow(page)}`);
    rec.expect("?theme= is not stored", (await storedOverride(page)) === null, `stored ${await storedOverride(page)}`);
    rec.expect("no console errors", cell.errors.length === 0, cell.errors.slice(0, 5).join(" | "));
  } finally {
    await cell.close();
  }
}

async function rapidSwitchFlow(browser: Browser, target: HubTarget, rec: Recorder): Promise<void> {
  // Start from a stored choice so the burst ends on another theme and a switch must happen.
  const cell = await openCell(browser, parseSize("1440x900"), { storage: { [OVERRIDE_KEY]: "pages-stars" } });
  const { page } = cell;
  try {
    await page.evaluateOnNewDocument(INSTRUMENT);
    await page.goto(target.base, { waitUntil: "load" });
    await settle(page, 800);
    await page.focus(TOPBAR_PICKER);
    await page.keyboard.press("Enter");
    if (!rec.expect("the picker opens", await poll(() => pickerOpen(page), 2000))) return;
    // The burst is measured in page time from the keydown events themselves, so harness
    // round trips and a loaded host do not count against it.
    await page.evaluate(() => {
      const keys: number[] = [];
      (window as unknown as { __qaKeys: number[] }).__qaKeys = keys;
      document.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") keys.push(event.timeStamp);
      }, true);
    });
    const since = await pageNow(page);
    // Presses follow a fixed 90 ms schedule; a slow press shortens the next wait instead
    // of stretching the burst.
    const t0 = Date.now();
    for (let i = 0; i < 10; i++) {
      await sleep(Math.max(0, t0 + i * 90 - Date.now()));
      await page.keyboard.press("ArrowDown");
    }
    const keyTimes = await page.evaluate(() => (window as unknown as { __qaKeys: number[] }).__qaKeys);
    const burst = keyTimes.length === 10 ? keyTimes[9] - keyTimes[0] : Number.POSITIVE_INFINITY;
    await sleep(3500);
    const switches = (await qaEvents(page, "hub:theme")).filter((e) => e.t >= since && e.detail.source === "picker");
    const gaps = switches.slice(1).map((e, i) => e.t - switches[i].t);
    rec.expect(
      "10 arrow presses within 1 s apply at most 2 switches, at least 1 s apart",
      burst <= 1000 && switches.length >= 1 && switches.length <= 2 && gaps.every((g) => g >= 1000),
      `burst ${Math.round(burst)} ms page time (first to last of ${keyTimes.length} keydowns), ${switches.length} switches, gaps [${gaps.map(Math.round).join(", ")}]`,
    );
    const final = await page.evaluate(() => document.querySelector<HTMLInputElement>('input[name="hub-theme"]:checked')?.value ?? "");
    rec.expect("the theme ends on the last selected option", (await themeNow(page)) === final, `theme ${await themeNow(page)}, selected ${final}`);
    const live = await waitInitialized(page, 2500);
    rec.expect("one scene live after settling", live.length === 1 && live[0] === (await themeNow(page)), `live: [${live.join(", ")}], theme ${await themeNow(page)}`);
    rec.expect("no console errors", cell.errors.length === 0, cell.errors.slice(0, 5).join(" | "));
  } finally {
    await cell.close();
  }
}

async function pickerPhoneFlow(browser: Browser, target: HubTarget, rec: Recorder, theme: HubThemeKey, kit: boolean): Promise<void> {
  for (const size of ["844x390", "320x568"]) {
    const cell = await openHub(browser, target, theme, size);
    const { page } = cell;
    try {
      await settle(page, 800);
      if (kit) await waitKit(page, theme);
      await page.tap(TOPBAR_PICKER);
      if (!rec.expect(`${size}: tapping the picker button opens the sheet`, await poll(() => pickerOpen(page), 2000))) continue;
      await sleep(400);
      const reach = await page.evaluate(() => {
        const hit = (el: HTMLElement | null) => {
          if (!el) return { found: false, inView: false, onTop: false, h: 0 };
          el.scrollIntoView({ block: "nearest", behavior: "instant" });
          const r = el.getBoundingClientRect();
          const inView = r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth && r.height > 0;
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { found: true, inView, onTop: !!top && (top === el || el.contains(top)), h: Math.round(r.height) };
        };
        const group = document.querySelector<HTMLElement>("[data-hub-motion-group]");
        return {
          done: hit(document.querySelector<HTMLElement>("[data-hub-picker-close]")),
          groupShown: !!group && !group.hidden,
          pause: hit(document.querySelector<HTMLElement>("[data-hub-motion-switch]")),
          rows: [...document.querySelectorAll<HTMLElement>(".hub-picker-option")].map((o) => Math.round(o.getBoundingClientRect().height)),
        };
      });
      rec.expect(`${size}: "เสร็จ" is reachable (in view, on top, at least 44 px tall)`, reach.done.inView && reach.done.onTop && reach.done.h >= 44, JSON.stringify(reach.done));
      rec.expect(`${size}: picker option rows are at least 44 px tall`, reach.rows.length > 0 && reach.rows.every((h) => h >= 44), `[${reach.rows.join(", ")}]`);
      if (!kit) rec.waiting(`${size}: the pause switch is reachable`, "a kit theme (the switch shows once the active scene is on the kit)");
      else rec.expect(`${size}: the pause switch is reachable`, reach.groupShown && reach.pause.inView && reach.pause.onTop, JSON.stringify({ shown: reach.groupShown, ...reach.pause }));
      await page.tap("[data-hub-picker-close]");
      await sleep(300);
      rec.expect(`${size}: "เสร็จ" closes the sheet`, !(await pickerOpen(page)));
      rec.expect(`${size}: no console errors`, cell.errors.length === 0, cell.errors.slice(0, 5).join(" | "));
    } finally {
      await cell.close();
    }
  }
}

async function pauseSwitchFlow(browser: Browser, target: HubTarget, rec: Recorder, theme: HubThemeKey): Promise<void> {
  const cell = await openHub(browser, target, theme, "1440x900");
  const { page } = cell;
  try {
    await settle(page, 600);
    if (!rec.expect(`${theme} reports hub:scene`, await waitKit(page, theme))) return;
    await page.click(TOPBAR_PICKER);
    await poll(() => pickerOpen(page), 2000);
    const shown = await page.evaluate(() => !(document.querySelector<HTMLElement>("[data-hub-motion-group]")?.hidden ?? true));
    if (!rec.expect("the pause switch shows for a kit scene", shown)) return;
    await page.click("[data-hub-motion-switch]");
    await sleep(200);
    const on = await page.evaluate((key: string) => ({
      checked: document.querySelector("[data-hub-motion-switch]")?.getAttribute("aria-checked"),
      motion: document.documentElement.dataset.hubMotion,
      stored: localStorage.getItem(key),
    }), MOTION_KEY);
    rec.expect('the switch turns on: aria-checked, html[data-hub-motion="still"], stored "still"', on.checked === "true" && on.motion === "still" && on.stored === "still", JSON.stringify(on));
    await page.click("[data-hub-picker-close]");
    await sleep(2000);
    const frames = await rafOver(page, 1000);
    rec.expect("paused: no rAF callbacks over 1 s", frames === 0, `${frames} callbacks`);
    const canvases = await emptyCanvases(page, containerOf(theme));
    rec.expect("paused: the scene's canvases stay drawn", canvases.total > 0 && canvases.empty.length === 0, `${canvases.total} visible, empty [${canvases.empty.join(", ")}]`);
    const box = await page.evaluate(() => {
      const el = document.querySelector('[data-hub-hit="stage"]');
      el?.scrollIntoView({ block: "center", behavior: "instant" });
      const r = el?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    });
    await sleep(400);
    const since = await pageNow(page);
    const before = await canvasSum(page, windowCanvas("stage"));
    if (box) await page.mouse.click(box.x, box.y);
    await sleep(400);
    const taps = (await qaEvents(page, "hub:stage")).filter((e) => e.t >= since);
    rec.expect("paused: a tap on the stage still reaches the scene (hub:stage)", taps.length > 0, `${taps.length} events`);
    const after = await canvasSum(page, windowCanvas("stage"));
    rec.owned("paused: the tap redraws the still", before !== after && after !== "empty", `${before} → ${after}`, UNIT[theme]);
    await page.click(TOPBAR_PICKER);
    await poll(() => pickerOpen(page), 2000);
    await page.click("[data-hub-motion-switch]");
    await page.click("[data-hub-picker-close]");
    await sleep(600);
    const off = await page.evaluate((key: string) => ({ motion: document.documentElement.dataset.hubMotion, stored: localStorage.getItem(key) }), MOTION_KEY);
    rec.expect('the switch turns off: html[data-hub-motion="full"], key removed', off.motion === "full" && off.stored === null, JSON.stringify(off));
    const resumed = await rafOver(page, 1000);
    rec.expect("motion resumes after the switch turns off", resumed > 0, `${resumed} callbacks`);
    rec.expect("no console errors", cell.errors.length === 0, cell.errors.slice(0, 5).join(" | "));
  } finally {
    await cell.close();
  }
}

/**
 * Samples the view transition of the next switch: wipe animation, --hub-wipe values and the
 * mask. It returns nothing, so evaluating it does not wait for the sample promise.
 */
const WIPE_SAMPLER = `(() => { window.__qaWipe = new Promise((resolve) => {
  const html = document.documentElement;
  const samples = [];
  let started = false;
  const done = (value) => { observer.disconnect(); resolve(value); };
  const observer = new MutationObserver(() => {
    if (started || html.dataset.hubSwitch === undefined) return;
    started = true;
    const name = html.dataset.hubSwitch;
    const t0 = performance.now();
    const off = html.dataset.hubWipe === "off";
    const tick = () => {
      const anims = document.getAnimations()
        .filter((a) => String(a.effect && a.effect.pseudoElement || "").includes("view-transition"))
        .map((a) => ({ name: a.animationName || "", pseudo: a.effect.pseudoElement }));
      const cs = getComputedStyle(html, "::view-transition-new(root)");
      samples.push({ t: performance.now() - t0, anims, wipe: cs.getPropertyValue("--hub-wipe").trim(), mask: cs.maskImage || cs.webkitMaskImage || "" });
      // Sample until the transition ends (chrome removes data-hub-switch), at most 2 s.
      if (html.dataset.hubSwitch !== undefined && performance.now() - t0 < 2000) requestAnimationFrame(tick);
      else done({ switch: name, off, samples });
    };
    requestAnimationFrame(tick);
  });
  observer.observe(html, { attributes: true, attributeFilter: ["data-hub-switch"] });
  setTimeout(() => done({ switch: null, off: false, samples }), 3500);
}); })();`;

interface WipeResult {
  switch: string | null;
  off: boolean;
  samples: { t: number; anims: { name: string; pseudo: string }[]; wipe: string; mask: string }[];
}

async function pickTheme(page: Page, key: string): Promise<void> {
  await page.evaluate((k: string) => {
    const radio = document.querySelector<HTMLInputElement>(`input[name="hub-theme"][value="${k}"]`);
    radio?.closest("label")?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, key);
  await page.click(`input[name="hub-theme"][value="${key}"]`);
}

async function wipeFlow(browser: Browser, target: HubTarget, rec: Recorder, themes: HubThemeKey[]): Promise<void> {
  const cell = await openHub(browser, target, null, "1440x900");
  const { page } = cell;
  try {
    await settle(page, 800);
    await page.click(TOPBAR_PICKER);
    await poll(() => pickerOpen(page), 2000);
    const start = await themeNow(page);
    const order = [...themes.filter((k) => k !== start), ...themes.filter((k) => k === start)];
    if (order[0] === start) {
      // Every theme under test is the one the page opened on: switch away to another
      // enabled theme first, so the switch back is a real one.
      const away = await page.evaluate((from: string | null) => [...document.querySelectorAll<HTMLInputElement>('input[name="hub-theme"]:not(:disabled)')].map((r) => r.value).find((v) => v !== from) ?? null, start);
      if (rec.expect("another enabled theme to switch away from the start theme", away !== null, `start ${start}`) && away) {
        await sleep(1100);
        await pickTheme(page, away);
        rec.expect(`switch away to ${away} applies`, await poll(async () => (await themeNow(page)) === away, 2500), `theme ${await themeNow(page)}`);
      }
    }
    for (const key of order) {
      await sleep(1100);
      await page.evaluate(WIPE_SAMPLER);
      await pickTheme(page, key);
      const result = (await page.evaluate(() => (window as unknown as { __qaWipe: Promise<unknown> }).__qaWipe)) as WipeResult;
      const applied = await poll(async () => (await themeNow(page)) === key, 1500);
      rec.expect(`switch to ${key} applies`, applied, `theme ${await themeNow(page)}`);
      if (result.switch !== key) {
        rec.expect(`switch to ${key} runs as a view transition with data-hub-switch="${key}"`, false, `data-hub-switch ${JSON.stringify(result.switch)}`);
        continue;
      }
      const wipeAnim = result.samples.some((s) => s.anims.some((a) => a.name === "hub-wipe" && a.pseudo === "::view-transition-new(root)"));
      const mid = result.samples.map((s) => Number.parseFloat(s.wipe)).filter((v) => v > 0.02 && v < 0.98);
      const masked = result.samples.some((s) => s.mask.includes("gradient"));
      if (result.off) {
        const fade = result.samples.some((s) => s.anims.some((a) => a.name.includes("view-transition-fade")));
        rec.expect(`switch to ${key}: fallback crossfade where the wipe is off`, fade, `${result.samples.length} samples`);
      } else {
        rec.expect(
          `switch to ${key}: the per-theme wipe animates ::view-transition-new(root) (hub-wipe, --hub-wipe between 0 and 1, gradient mask)`,
          wipeAnim && mid.length > 0 && masked,
          `animation ${wipeAnim}, ${mid.length} mid samples, mask ${masked}`,
        );
      }
    }
    rec.expect("no console errors", cell.errors.length === 0, cell.errors.slice(0, 5).join(" | "));
  } finally {
    await cell.close();
  }
  for (const mode of ["reduced", "pause"] as const) {
    const still = await openHub(browser, target, null, "1440x900", { reducedMotion: mode === "reduced", paused: mode === "pause" });
    try {
      await settle(still.page, 800);
      await still.page.click(TOPBAR_PICKER);
      await poll(() => pickerOpen(still.page), 2000);
      const start = await themeNow(still.page);
      const key = themes.find((k) => k !== start) ?? themes[0];
      await still.page.evaluate(WIPE_SAMPLER);
      const since = Date.now();
      await pickTheme(still.page, key);
      const applied = await poll(async () => (await themeNow(still.page)) === key, 1500, 25);
      const elapsed = Date.now() - since;
      const result = (await still.page.evaluate(() => (window as unknown as { __qaWipe: Promise<unknown> }).__qaWipe)) as WipeResult;
      rec.expect(`${mode === "reduced" ? "reduced motion" : "pause"}: the switch is an instant swap (no view transition)`, applied && result.switch === null && elapsed < 1200, `applied ${applied} after ${elapsed} ms, data-hub-switch ${JSON.stringify(result.switch)}`);
    } finally {
      await still.close();
    }
  }
}

/* ------------------------------------------------------------------ pick */

async function chosen(page: Page): Promise<{ slugs: string[]; open: boolean; finished: boolean }> {
  return page.evaluate((status: string) => {
    const els = [...document.querySelectorAll<HTMLElement>(".novel-card-wrapper[data-chosen]")];
    return {
      slugs: els.map((w) => w.dataset.novelSlug ?? w.dataset.upcomingSlug ?? "?"),
      open: els.every((w) => w.dataset.status === status && w.dataset.novelSlug !== undefined),
      finished: els.some((w) => w.hasAttribute("data-card-finished")),
    };
  }, OPEN_STATUS);
}

async function pickFlow(browser: Browser, target: HubTarget, rec: Recorder, theme: HubThemeKey): Promise<void> {
  const cases: { size: string; state: "S0" | "S1"; reduced?: boolean }[] = [
    { size: "1440x900", state: "S0" },
    { size: "1440x900", state: "S1" },
    { size: "390x844", state: "S0" },
    { size: "1440x900", state: "S0", reduced: true },
  ];
  for (const c of cases) {
    const label = `${c.size} ${c.state}${c.reduced ? " reduced motion" : ""}`;
    const cell = await openHub(browser, target, theme, c.size, { reading: c.state === "S1", reducedMotion: c.reduced });
    const { page } = cell;
    try {
      await settle(page, 900);
      const selector = c.state === "S0" ? '[data-hub-pick="start"]' : '[data-hub-pick="head"]';
      await scrollToSelector(page, selector);
      await sleep(200);
      const url = page.url();
      const resume = await page.evaluate(() => document.querySelector<HTMLElement>("[data-hub-resume]:not([hidden])")?.dataset.resumeSlug ?? null);
      const box = await page.evaluate((sel: string) => {
        const r = document.querySelector(sel)?.getBoundingClientRect();
        return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
      }, selector);
      if (!rec.expect(`${label}: pick button found`, !!box)) continue;
      if (c.size === "390x844") await page.touchscreen.tap(box!.x, box!.y);
      else await page.mouse.click(box!.x, box!.y);
      await sleep(c.reduced ? 120 : 500);
      const first = await chosen(page);
      const live = await page.evaluate(() => document.querySelector("[data-hub-announce]")?.textContent?.trim() ?? "");
      rec.expect(`${label}: the live region names the pick`, live.length > 0, live);
      rec.expect(`${label}: focus stays on the pick button`, await activeMatches(page, selector));
      rec.expect(`${label}: the URL is unchanged`, page.url() === url, page.url());
      rec.expect(`${label}: one open, unfinished card is chosen${resume ? " and it is not the resumed novel" : ""}`, first.slugs.length === 1 && first.open && !first.finished && first.slugs[0] !== resume, JSON.stringify({ ...first, resume }));
      const picks = await qaEvents(page, "hub:pick");
      rec.expect(`${label}: hub:pick carries the chosen slug`, picks.length === 1 && picks[0].detail.slug === first.slugs[0], JSON.stringify(picks.map((p) => p.detail)));
      if (c.reduced) {
        const view = await page.evaluate((slug: string) => {
          const r = document.querySelector(`.novel-card-wrapper[data-novel-slug="${slug}"]`)?.getBoundingClientRect();
          const guide = document.querySelector<HTMLElement>("[data-hub-guide]");
          return { visible: !!r && r.top < innerHeight && r.bottom > 0, guideAnimations: guide?.getAnimations().length ?? -1 };
        }, first.slugs[0] ?? "");
        rec.expect(`${label}: the chosen card is in view at once and the guide does not fly`, view.visible && view.guideAnimations === 0, JSON.stringify(view));
      }
      await sleep(2700);
      await scrollToSelector(page, selector);
      await sleep(150);
      await page.click(selector);
      await sleep(c.reduced ? 120 : 500);
      const second = await chosen(page);
      const candidates = await page.evaluate((status: string) => document.querySelectorAll(`.novel-card-wrapper[data-status="${status}"]:not([data-card-finished])`).length, OPEN_STATUS);
      const expectCycle = candidates - (resume ? 1 : 0) > 1;
      rec.expect(`${label}: a repeated press cycles to another card`, second.slugs.length === 1 && (!expectCycle || second.slugs[0] !== first.slugs[0]), `${first.slugs[0]} → ${second.slugs[0]} (${candidates} open cards)`);
      rec.expect(`${label}: no console errors`, cell.errors.length === 0, cell.errors.slice(0, 5).join(" | "));
    } finally {
      await cell.close();
    }
  }

  const cell = await openHub(browser, target, theme, "1440x900");
  const { page } = cell;
  try {
    await settle(page, 900);
    const scrollBefore = await page.evaluate(() => scrollY);
    await page.focus('[data-hub-pick="start"]');
    const scrollFocused = await page.evaluate(() => scrollY);
    await page.keyboard.press("Enter");
    await sleep(500);
    const after = await page.evaluate(() => ({ scrollY, go: !!document.querySelector("button[data-hub-pick-go]") }));
    rec.expect("keyboard pick: no scroll, a ไปที่เรื่องนี้ button appears", after.scrollY === scrollFocused && after.go, JSON.stringify({ scrollBefore, scrollFocused, ...after }));
    const pickedSlug = (await chosen(page)).slugs[0] ?? "";
    await page.keyboard.press("Tab");
    const onGo = await activeMatches(page, "button[data-hub-pick-go]");
    await page.keyboard.press("Enter");
    await sleep(800);
    const focused = await page.evaluate(() => document.activeElement?.closest<HTMLElement>(".novel-card-wrapper")?.dataset.novelSlug ?? null);
    rec.expect("keyboard pick: ไปที่เรื่องนี้ is the next tab stop and focuses the chosen card", onGo && focused === pickedSlug, `${focused} vs ${pickedSlug}`);
  } finally {
    await cell.close();
  }
}

/* ------------------------------------------------------------------ attention parity */

/**
 * Waits up to `ms` for hub:attention on `slug` from `source` (since page time `since`)
 * and for the card to light above `base`: --w-glow above its value before the hover or
 * focus (themes with ambient card light start above 0), or a new beat.
 */
async function waitAttention(page: Page, slug: string, source: string, since: number, base: { glow: number; beat: string | null }, ms: number): Promise<{ events: number; lit: boolean; now: { glow: number; beat: string | null } }> {
  const end = Date.now() + ms;
  let events = 0;
  let lit = false;
  let now = base;
  while (Date.now() < end) {
    events = (await qaEvents(page, "hub:attention")).filter((e) => e.t >= since && e.detail.slug === slug && e.detail.source === source).length;
    now = await cardLit(page, slug);
    lit = now.glow > base.glow + 0.01 || (now.beat !== null && now.beat !== base.beat);
    if (events > 0 && lit) break;
    await sleep(100);
  }
  return { events, lit, now };
}

async function attentionFlow(browser: Browser, target: HubTarget, rec: Recorder, theme: HubThemeKey): Promise<void> {
  const cell = await openHub(browser, target, theme, "1440x900");
  const { page } = cell;
  try {
    await settle(page, 600);
    const kit = await waitKit(page, theme);
    const slugs = await page.evaluate((status: string) => [...document.querySelectorAll<HTMLElement>(`.novel-card-wrapper[data-status="${status}"]`)].map((w) => w.dataset.novelSlug ?? ""), OPEN_STATUS);
    const [focusSlug, hoverSlug] = [slugs[0], slugs[1] ?? slugs[0]];
    await scrollToSelector(page, `.novel-card-wrapper[data-novel-slug="${hoverSlug}"]`);
    await sleep(300);
    const box = await page.evaluate((s: string) => {
      const r = document.querySelector(`.novel-card-wrapper[data-novel-slug="${s}"]`)?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 3 } : null;
    }, hoverSlug);
    const hoverBase = await cardLit(page, hoverSlug);
    let since = await pageNow(page);
    if (box) await page.mouse.move(box.x, box.y, { steps: 4 });
    const hover = await waitAttention(page, hoverSlug, "hover", since, hoverBase, 1200);
    rec.expect("hover on a card emits hub:attention (source hover)", hover.events > 0);
    const hoverDetail = `before ${JSON.stringify(hoverBase)}, after ${JSON.stringify(hover.now)}`;
    if (kit) rec.owned("hover: the card lights (--w-glow rises above its value before the hover, or a beat) within 1.2 s", hover.lit, hoverDetail, UNIT[theme]);
    else rec.waiting("hover: the card lights (--w-glow rises above its value before the hover, or a beat) within 1.2 s", `the ${theme} scene on the kit (${UNIT[theme]})`);

    await page.mouse.move(4, 4);
    await sleep(800);
    await page.focus(".hub-library-head [data-hub-pick]");
    const focusBase = await cardLit(page, focusSlug);
    since = await pageNow(page);
    await page.keyboard.press("Tab");
    const onCard = await page.evaluate((s: string) => document.activeElement?.closest<HTMLElement>(".novel-card-wrapper")?.dataset.novelSlug === s, focusSlug);
    rec.expect("Tab from the library heading focuses the first card", onCard);
    const focus = await waitAttention(page, focusSlug, "focus", since, focusBase, 1200);
    rec.expect("Tab focus on a card emits hub:attention (source focus)", focus.events > 0);
    const focusDetail = `before ${JSON.stringify(focusBase)}, after ${JSON.stringify(focus.now)}`;
    if (kit) rec.owned("focus: the card lights (--w-glow rises above its value before the focus, or a beat) within 1.2 s", focus.lit, focusDetail, UNIT[theme]);
    else rec.waiting("focus: the card lights (--w-glow rises above its value before the focus, or a beat) within 1.2 s", `the ${theme} scene on the kit (${UNIT[theme]})`);
    rec.expect("no console errors", cell.errors.length === 0, cell.errors.slice(0, 5).join(" | "));
  } finally {
    await cell.close();
  }
}

/* ------------------------------------------------------------------ scene output: perches, label, focusCard, guide */

function dispatch(page: Page, name: string, detail: unknown): Promise<void> {
  return page.evaluate((n: string, d: unknown) => {
    document.dispatchEvent(new CustomEvent(n, { detail: d }));
  }, name, detail);
}

async function guideState(page: Page) {
  return page.evaluate(() => {
    const g = document.querySelector<HTMLElement>("[data-hub-guide]");
    if (!g) return null;
    const r = g.getBoundingClientRect();
    return { state: g.dataset.hubGuide ?? "", visible: getComputedStyle(g).visibility === "visible", animations: g.getAnimations().length, x: r.left, y: r.top, w: r.width, h: r.height };
  });
}

async function rectOf(page: Page, selector: string): Promise<Rect | null> {
  return page.evaluate((sel: string) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  }, selector);
}

/** True when `g` rests on the top edge of `host`: its bottom within the edge and 6 px below it, and it lies over the host. */
const onTopEdge = (g: Rect, host: Rect) => g.y + g.h >= host.y - 0.5 && g.y + g.h <= host.y + 6.5 && g.x + g.w / 2 >= host.x && g.x + g.w / 2 <= host.x + host.w;

async function outputFlow(browser: Browser, target: HubTarget, rec: Recorder, theme: HubThemeKey): Promise<void> {
  const cell = await openHub(browser, target, theme, "1440x900", { reading: true });
  const { page } = cell;
  try {
    await settle(page, 1500);
    const g0 = await guideState(page);
    const resume = await rectOf(page, "[data-hub-resume]");
    rec.expect("guide rests on the resume card's top edge", !!g0 && !!resume && g0.state === "rest" && g0.visible && onTopEdge(g0, resume), JSON.stringify({ g0, resume }));

    const slugs = await page.evaluate((status: string) => [...document.querySelectorAll<HTMLElement>(`.novel-card-wrapper[data-status="${status}"]`)].map((w) => w.dataset.novelSlug ?? ""), OPEN_STATUS);
    const slug = slugs[1] ?? slugs[0];
    const card = `.novel-card-wrapper[data-novel-slug="${slug}"]`;
    const box = await page.evaluate((sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + 60 } : null;
    }, card);
    if (box) await page.mouse.move(box.x, box.y, { steps: 3 });
    let flew = false;
    const flyEnd = Date.now() + 1800;
    while (Date.now() < flyEnd && !flew) {
      const g = await guideState(page);
      flew = !!g && g.state === "fly" && g.animations > 0;
      if (!flew) await sleep(60);
    }
    rec.expect("after 600 ms of hover attention the guide flies (WAAPI)", flew);
    await sleep(1600);
    const g1 = await guideState(page);
    const cardRect = await rectOf(page, card);
    rec.expect("the guide lands on the attended card's top edge", !!g1 && !!cardRect && g1.state === "rest" && onTopEdge(g1, cardRect), JSON.stringify({ g1, cardRect }));
    await page.mouse.move(4, 4);
    await sleep(3000 + 1600);
    const g2 = await guideState(page);
    const resume2 = await rectOf(page, "[data-hub-resume]");
    rec.expect("the guide returns home 3 s after attention ends", !!g2 && !!resume2 && onTopEdge(g2, resume2), JSON.stringify({ g2, resume2 }));

    await page.click("[data-profile-edit-btn]");
    await sleep(300);
    const gModal = await guideState(page);
    rec.expect("the guide is hidden while a dialog is open", !!gModal && !gModal.visible, JSON.stringify(gModal));
    await page.keyboard.press("Escape");
    await sleep(300);
    const gBack = await guideState(page);
    rec.expect("the guide comes back when the dialog closes", !!gBack && gBack.visible, JSON.stringify(gBack));
    const cardBox = await rectOf(page, `${card} a.novel-card`);
    if (cardBox) {
      await page.mouse.move(cardBox.x + 20, cardBox.y + 20);
      await page.mouse.down();
      await sleep(50);
      const gPress = await guideState(page);
      rec.expect("the guide hides at once on hub:press", !!gPress && !gPress.visible, JSON.stringify(gPress));
      await page.mouse.move(4, 4);
      await page.mouse.up();
    }

    // Perches.
    await page.evaluate(() => scrollTo(0, 0));
    await dispatch(page, "hub:out-perch", { id: 901, target: slugs[0], kind: "moth", u: 0.5 });
    await dispatch(page, "hub:out-perch", { id: 902, target: "chip", kind: "firefly", u: 0.5 });
    await dispatch(page, "hub:out-perch", { id: 903, target: slugs[1] ?? slugs[0], kind: "moth", u: 0.2 });
    await dispatch(page, "hub:out-perch", { id: 904, target: slugs[2] ?? slugs[0], kind: "moth", u: 0.8 });
    await sleep(150);
    const perches = await page.evaluate(() => {
      const holes = [...document.querySelectorAll(".hub-shell :is(h1, h2, p, small, a:not(.novel-card), button, .novel-card-title, .profile-name)")]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 2 && r.height > 2);
      const gap = (a: DOMRect, b: DOMRect) => Math.hypot(Math.max(b.left - a.right, a.left - b.right, 0), Math.max(b.top - a.bottom, a.top - b.bottom, 0));
      return [...document.querySelectorAll<HTMLElement>(".hub-perch")].map((p) => {
        const r = p.getBoundingClientRect();
        const host = p.parentElement;
        const hostRect = host?.getBoundingClientRect();
        return {
          host: host?.matches("[data-profile-widget]") ? "chip" : (host?.dataset.novelSlug ?? host?.dataset.upcomingSlug ?? "?"),
          runtime: p.hasAttribute("data-hub-runtime"),
          kind: p.dataset.perchKind ?? null,
          hidden: p.getAttribute("aria-hidden") === "true",
          events: getComputedStyle(p).pointerEvents,
          onEdge: !!hostRect && r.bottom >= hostRect.top - 0.5 && r.bottom <= hostRect.top + 4.5,
          clearance: Math.min(...holes.filter((h) => !host?.matches("[data-profile-widget]") || !host.contains(document.elementFromPoint(h.left + 1, h.top + 1))).map((h) => gap(r, h))),
        };
      });
    });
    rec.expect("at most 3 perches; the fourth is refused", perches.length === 3, `${perches.length} perches`);
    rec.expect(
      "perches are span.hub-perch[data-hub-runtime][data-perch-kind], aria-hidden, without pointer events, on the host's top edge",
      perches.length > 0 && perches.every((p) => p.runtime && p.kind && p.hidden && p.events === "none" && p.onEdge),
      JSON.stringify(perches),
    );
    const cardPerches = perches.filter((p) => p.host !== "chip");
    rec.expect("card perches keep 16 px from text and controls", cardPerches.length > 0 && cardPerches.every((p) => p.clearance >= 16), JSON.stringify(cardPerches.map((p) => Math.round(p.clearance))));
    rec.expect("the chip perch sits on the chip", perches.some((p) => p.host === "chip"));
    await dispatch(page, "hub:out-unperch", { id: 901 });
    await dispatch(page, "hub:out-unperch", { id: 902 });
    await dispatch(page, "hub:out-unperch", { id: 903 });
    await sleep(100);
    rec.expect("hub:out-unperch removes the perches", (await page.$$(".hub-perch")).length === 0);

    // World label.
    await dispatch(page, "hub:out-label", { slug: slugs[0], x: 400, y: 300, plane: "sky", ms: 700 });
    await sleep(120);
    const sky = await page.evaluate(() => {
      const els = document.querySelectorAll<HTMLElement>(".hub-world-label");
      const l = els[0];
      return l ? { count: els.length, text: l.textContent ?? "", shown: l.hasAttribute("data-shown"), runtime: l.hasAttribute("data-hub-runtime"), hidden: l.getAttribute("aria-hidden") === "true", position: getComputedStyle(l).position, opacity: getComputedStyle(l).opacity } : null;
    });
    const title = await page.evaluate((s: string) => document.querySelector(`.novel-card-wrapper[data-novel-slug="${s}"] .novel-card-title`)?.textContent?.trim() ?? "", slugs[0]);
    rec.expect("a sky label is one fixed div.hub-world-label[data-hub-runtime], aria-hidden, reading {titleTh} · {state}", !!sky && sky.count === 1 && sky.shown && sky.runtime && sky.hidden && sky.position === "fixed" && sky.text.startsWith(`${title} · `), JSON.stringify(sky));
    await dispatch(page, "hub:out-label", { slug: slugs[1] ?? slugs[0], x: 300, y: 40, plane: "stage", ms: 700 });
    await sleep(120);
    const stage = await page.evaluate(() => {
      const els = document.querySelectorAll<HTMLElement>(".hub-world-label");
      const l = els[0];
      return l ? { count: els.length, position: getComputedStyle(l).position, shown: l.hasAttribute("data-shown") } : null;
    });
    rec.expect("a window label reuses the one element, absolute in the shell", !!stage && stage.count === 1 && stage.position === "absolute" && stage.shown, JSON.stringify(stage));
    await sleep(900);
    rec.expect("the label hides after its time", !(await page.evaluate(() => document.querySelector(".hub-world-label")?.hasAttribute("data-shown") ?? false)));

    // focusCard.
    const far = (await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".novel-card-wrapper a.novel-card")].map((a) => a.closest<HTMLElement>(".novel-card-wrapper")?.dataset.novelSlug ?? "").pop())) ?? "";
    await page.evaluate(() => scrollTo(0, 0));
    await dispatch(page, "hub:out-focus", { slug: far });
    await sleep(1200);
    const focusFar = await page.evaluate((s: string) => {
      const w = document.querySelector(`.novel-card-wrapper[data-novel-slug="${s}"]`);
      const r = w?.getBoundingClientRect();
      return { focused: document.activeElement === w?.querySelector("a.novel-card"), inView: !!r && r.top < innerHeight && r.bottom > 0, scrollY };
    }, far);
    rec.expect("focusCard scrolls an off-screen card into view and focuses its link", focusFar.focused && focusFar.inView && focusFar.scrollY > 0, JSON.stringify(focusFar));
    const steady = await page.evaluate(() => scrollY);
    await dispatch(page, "hub:out-focus", { slug: far });
    await sleep(500);
    rec.expect("focusCard does not scroll a card that is already in view", (await page.evaluate(() => scrollY)) === steady);
    await page.evaluate(() => scrollTo(0, 0));
    await page.click("[data-profile-edit-btn]");
    await sleep(300);
    await page.focus("#edit-profile-name");
    await dispatch(page, "hub:out-focus", { slug: slugs[0] });
    await sleep(300);
    rec.expect("focusCard never runs while a dialog is open", await activeMatches(page, "#edit-profile-name"));
    await page.keyboard.press("Escape");
    await sleep(300);
    // The hub's own text fields all sit in dialogs, so a probe field outside them
    // exercises the typing guard on its own.
    await page.evaluate(() => {
      const field = document.createElement("input");
      field.type = "text";
      field.id = "qa-typing-probe";
      field.setAttribute("aria-label", "qa");
      document.querySelector("main.hub-shell")?.prepend(field);
    });
    await page.focus("#qa-typing-probe");
    await page.keyboard.type("ab");
    await dispatch(page, "hub:out-focus", { slug: slugs[0] });
    await sleep(300);
    rec.expect("focusCard never takes focus from a reader typing in a field", await activeMatches(page, "#qa-typing-probe"));
    await page.evaluate(() => document.getElementById("qa-typing-probe")?.remove());
    const said = "หิ่งห้อยกะพริบพร้อมกันแล้ว";
    const heard = async () => {
      await dispatch(page, "hub:out-announce", { text: said });
      return poll(() => page.evaluate((t: string) => document.querySelector("[data-hub-announce]")?.textContent === t, said), 1000, 50);
    };
    const first = await heard();
    const cleared = await page.evaluate(() => {
      const live = document.querySelector("[data-hub-announce]");
      document.dispatchEvent(new CustomEvent("hub:out-announce", { detail: { text: live?.textContent ?? "" } }));
      return live?.textContent === "";
    });
    rec.expect("hub:out-announce writes its text into the polite live region, cleared first so a repeat is read again", first && cleared && (await heard()), `first ${first}, cleared on repeat ${cleared}`);
    rec.expect("no console errors", cell.errors.length === 0, cell.errors.slice(0, 5).join(" | "));
  } finally {
    await cell.close();
  }

  const still = await openHub(browser, target, theme, "1440x900", { reading: true, reducedMotion: true });
  try {
    await settle(still.page, 1500);
    const slug = await still.page.evaluate((status: string) => [...document.querySelectorAll<HTMLElement>(`.novel-card-wrapper[data-status="${status}"]`)].map((w) => w.dataset.novelSlug ?? "")[1] ?? "", OPEN_STATUS);
    const card = `.novel-card-wrapper[data-novel-slug="${slug}"]`;
    const box = await rectOf(still.page, card);
    if (box) await still.page.mouse.move(box.x + box.w / 2, box.y + 60, { steps: 3 });
    let sawFlight = false;
    const end = Date.now() + 1600;
    while (Date.now() < end) {
      const g = await guideState(still.page);
      if (g && (g.state === "fly" || g.animations > 0)) sawFlight = true;
      await sleep(80);
    }
    const g = await guideState(still.page);
    const cardRect = await rectOf(still.page, card);
    rec.expect("reduced motion: the guide appears placed on the card without flying", !sawFlight && !!g && !!cardRect && g.state === "rest" && onTopEdge(g, cardRect), JSON.stringify({ sawFlight, g, cardRect }));
  } finally {
    await still.close();
  }
}

/* ------------------------------------------------------------------ touch */

async function touchFlow(browser: Browser, target: HubTarget, rec: Recorder, themes: HubThemeKey[], kit: HubThemeKey[]): Promise<void> {
  const theme = kit[0] ?? themes[0];
  const cell = await openHub(browser, target, theme, "390x844");
  const { page } = cell;
  try {
    await settle(page, 1000);
    if (kit.length > 0) {
      await waitKit(page, theme);
      const stage = await page.evaluate(() => {
        const el = document.querySelector('[data-hub-window="stage"]');
        el?.scrollIntoView({ block: "center", behavior: "instant" });
        const r = el?.getBoundingClientRect();
        return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width } : null;
      });
      await sleep(400);
      if (stage) {
        const since = await pageNow(page);
        await page.touchscreen.touchStart(stage.x + 60, stage.y);
        for (let i = 1; i <= 6; i++) {
          await page.touchscreen.touchMove(stage.x + 60 - i * 22, stage.y + i);
          await sleep(16);
        }
        await page.touchscreen.touchEnd();
        await sleep(300);
        const swipes = (await qaEvents(page, "hub:stage")).filter((e) => e.t >= since).map((e) => String(e.detail.action));
        rec.owned("touch: a horizontal swipe in the stage becomes hub:stage left", swipes.includes("left"), `[${swipes.join(", ")}]`, "B0 kit (touch semantics)");
      }
      // On phones the hit button covers the stage centre, so a swipe often starts on it.
      const hit = await page.evaluate(() => {
        const r = document.querySelector('[data-hub-hit="stage"]')?.getBoundingClientRect();
        return r && r.width > 0 && r.height > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
      });
      if (rec.expect("touch: the stage hit button is on the page", !!hit) && hit) {
        await sleep(400);
        const since = await pageNow(page);
        await page.touchscreen.touchStart(hit.x, hit.y);
        for (let i = 1; i <= 6; i++) {
          await page.touchscreen.touchMove(hit.x + i * 22, hit.y + i);
          await sleep(16);
        }
        await page.touchscreen.touchEnd();
        await sleep(300);
        const actions = (await qaEvents(page, "hub:stage")).filter((e) => e.t >= since).map((e) => String(e.detail.action));
        rec.owned(
          "touch: a horizontal swipe that starts on the stage hit button becomes hub:stage right, not a tap",
          actions.includes("right") && !actions.includes("tap"),
          `[${actions.join(", ")}]`,
          "B0 kit (touch semantics)",
        );
      }
    } else {
      rec.waiting("touch: a horizontal swipe in the stage becomes hub:stage left", "a kit theme");
      rec.waiting("touch: a horizontal swipe that starts on the stage hit button becomes hub:stage right, not a tap", "a kit theme");
    }

    await page.evaluate(() => scrollTo(0, 0));
    const link = await page.evaluate(() => {
      const a = document.querySelector<HTMLAnchorElement>('.novel-card-wrapper[data-novel-slug="lodge"] a.novel-card');
      a?.scrollIntoView({ block: "center", behavior: "instant" });
      const r = a?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + 80, href: a?.getAttribute("href") ?? "" } : null;
    });
    await sleep(400);
    if (!rec.expect("touch: the Lodge card is on the page", !!link)) return;
    const since = await pageNow(page);
    await page.touchscreen.tap(link!.x, link!.y);
    const navigated = await poll(() => page.evaluate(() => location.pathname.includes("/lodge/")), 15000, 150);
    rec.expect("touch: a tap on a card navigates", navigated);
    const events = await qaEvents(page);
    const stageTaps = events.filter((e) => e.t >= since && e.name === "hub:stage").length;
    const presses = events.filter((e) => e.t >= since && e.name === "hub:press").length;
    rec.expect("touch: the card tap triggers no scene tap (no hub:stage) and one hub:press", stageTaps === 0 && presses === 1, `${stageTaps} hub:stage, ${presses} hub:press`);
  } finally {
    await cell.close();
  }

  if (!kit.includes("mothlight")) {
    rec.waiting("touch: a vertical swipe over the mothlight sky never lights the hand lantern", "mothlight on the kit (U5)");
    return;
  }
  const moth = await openHub(browser, target, "mothlight", "390x844");
  try {
    const { page: mp } = moth;
    await settle(mp, 1200);
    await waitKit(mp, "mothlight");
    // Open sky between the resume or start panel and the stage window.
    const spot = await mp.evaluate(() => {
      const panel = document.querySelector<HTMLElement>("[data-hub-resume]:not([hidden])") ?? document.querySelector<HTMLElement>("[data-hub-start]");
      const stage = document.querySelector('[data-hub-window="stage"]');
      const a = panel?.getBoundingClientRect();
      const b = stage?.getBoundingClientRect();
      return a && b ? { x: innerWidth - 8, y: (a.bottom + b.top) / 2 } : null;
    });
    if (!spot) {
      rec.expect("touch: an open-sky point exists for the lantern check", false);
      return;
    }
    const glow = () =>
      mp.evaluate((p: { x: number; y: number }) => {
        const c = document.querySelector<HTMLCanvasElement>("#mothlight-bg-container canvas[data-sky-live]");
        if (!c || c.width === 0) return -1;
        const sx = c.width / c.clientWidth;
        const sy = c.height / c.clientHeight;
        const size = 90;
        const x = Math.max(0, Math.round((p.x - size) * sx));
        const y = Math.max(0, Math.round((p.y - size) * sy));
        const probe = document.createElement("canvas");
        probe.width = 40;
        probe.height = 40;
        const g = probe.getContext("2d", { willReadFrequently: true });
        if (!g) return -1;
        g.drawImage(c, x, y, Math.round(size * 2 * sx), Math.round(size * 2 * sy), 0, 0, 40, 40);
        const d = g.getImageData(0, 0, 40, 40).data;
        let sum = 0;
        for (let k = 0; k < d.length; k += 4) sum += ((0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) * d[k + 3]) / 255;
        return sum / (d.length / 4);
      }, spot);
    const baseline: number[] = [];
    for (let i = 0; i < 6; i++) {
      baseline.push(await glow());
      await sleep(120);
    }
    const base = Math.max(...baseline);
    await mp.touchscreen.touchStart(spot.x, spot.y);
    let swipePeak = 0;
    for (let i = 1; i <= 10; i++) {
      await mp.touchscreen.touchMove(spot.x, spot.y - i * 24);
      swipePeak = Math.max(swipePeak, await glow());
    }
    await mp.touchscreen.touchEnd();
    for (let i = 0; i < 4; i++) {
      await sleep(100);
      swipePeak = Math.max(swipePeak, await glow());
    }
    await sleep(1500);
    await mp.evaluate(() => scrollTo(0, 0));
    await sleep(800);
    const base2: number[] = [];
    for (let i = 0; i < 4; i++) {
      base2.push(await glow());
      await sleep(120);
    }
    await mp.touchscreen.touchStart(spot.x, spot.y);
    let pressPeak = 0;
    for (let i = 0; i < 6; i++) {
      await sleep(100);
      pressPeak = Math.max(pressPeak, await glow());
    }
    await mp.touchscreen.touchEnd();
    const lift = 6;
    const pressLit = pressPeak > Math.max(...base2) + lift;
    rec.owned("touch: a still press of 180 ms in open sky lights the hand lantern (positive control)", pressLit, `peak ${pressPeak.toFixed(1)} vs baseline ${Math.max(...base2).toFixed(1)}`, UNIT.mothlight);
    rec.owned(
      "touch: a vertical swipe over the mothlight sky never lights the hand lantern",
      pressLit && swipePeak <= base + lift,
      `swipe peak ${swipePeak.toFixed(1)} vs baseline ${base.toFixed(1)}${pressLit ? "" : " (inconclusive without the positive control)"}`,
      UNIT.mothlight,
    );
  } finally {
    await moth.close();
  }
}

/* ------------------------------------------------------------------ mechanics (8.4 item 31) */

async function mechanicsFlow(browser: Browser, target: HubTarget, rec: Recorder, theme: HubThemeKey): Promise<void> {
  const owner = UNIT[theme];
  const sums: Record<string, string> = {};
  for (const state of ["S0", "S1"] as const) {
    const cell = await openHub(browser, target, theme, "1440x900", { reducedMotion: true, reading: state === "S1", params: { seed: "1" } });
    try {
      await settle(cell.page, 1200);
      await waitKit(cell.page, theme);
      await scrollToSelector(cell.page, '[data-hub-window="stage"]');
      await sleep(500);
      sums[state] = await canvasSum(cell.page, windowCanvas("stage"));
    } finally {
      await cell.close();
    }
  }
  rec.owned(`${theme} M2 reading map: the stage still differs with and without a reading record`, sums.S0 !== sums.S1 && sums.S1 !== "empty", `${sums.S0} vs ${sums.S1}`, owner);

  const cell = await openHub(browser, target, theme, "1440x900", { reducedMotion: true, params: { seed: "1" } });
  const { page } = cell;
  try {
    await settle(page, 1200);
    await waitKit(page, theme);
    const sky = `#${containerOf(theme)} canvas[data-sky-live]`;
    const skyBefore = await canvasSum(page, sky);
    const stageBefore = await canvasSum(page, windowCanvas("stage"));
    await page.focus(".hub-library-head [data-hub-pick]");
    await page.keyboard.press("Tab");
    await sleep(600);
    const attended = await page.evaluate(() => document.querySelector(".novel-card-wrapper[data-attended]") !== null);
    rec.expect(`${theme} M1 attention: focusing a card sets data-attended`, attended);
    const stageAfterFocus = await canvasSum(page, windowCanvas("stage"));
    const skyAfter = await canvasSum(page, sky);
    rec.owned(`${theme} M1 attention: the still answers the focused card (sky or stage checksum changes)`, skyAfter !== skyBefore || stageAfterFocus !== stageBefore, `sky ${skyBefore} → ${skyAfter}, stage ${stageBefore} → ${stageAfterFocus}`, owner);
    const vars = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>(".hub-page")?.getAttribute("style") ?? "";
      const cards = [...document.querySelectorAll<HTMLElement>(".novel-card-wrapper")].some((w) => /--w-(glow|lx|ly)/.test(w.getAttribute("style") ?? ""));
      return { root: /--w-/.test(root), cards };
    });
    rec.owned(`${theme} M7 light: the still writes the live variables once (root or cards)`, vars.root || vars.cards, JSON.stringify(vars), owner);
    for (const [slot, name] of [["M3", "stage"], ["M4", "mid"]] as const) {
      await scrollToSelector(page, `[data-hub-hit="${name}"]`);
      await sleep(450);
      const before = await canvasSum(page, windowCanvas(name));
      await page.focus(`[data-hub-hit="${name}"]`);
      await page.keyboard.press("Enter");
      await sleep(400);
      const after = await canvasSum(page, windowCanvas(name));
      rec.owned(`${theme} ${slot} ${name} play: Enter on the hit button changes the still`, before !== after && after !== "empty", `${before} → ${after}`, owner);
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.click('[data-hub-pick="start"]');
    await sleep(300);
    rec.expect(`${theme} M9 pick: the pick sets data-chosen at once`, (await chosen(page)).slugs.length === 1);
    const cardBox = await rectOf(page, ".novel-card-wrapper a.novel-card");
    if (cardBox) {
      await page.evaluate(() => document.querySelector(".novel-card-wrapper")?.scrollIntoView({ block: "center", behavior: "instant" }));
      const r = await rectOf(page, ".novel-card-wrapper a.novel-card");
      if (r) {
        await page.mouse.move(r.x + 20, r.y + 20);
        await page.mouse.down();
        await sleep(60);
        const guide = await guideState(page);
        rec.expect(`${theme} M12 press: a press hides the guide at once`, !!guide && !guide.visible, JSON.stringify(guide));
        await page.mouse.move(2, 2);
        await page.mouse.up();
      }
    }
    for (const slot of ["M5", "M6", "M8", "M10", "M11"]) {
      rec.skip(`${theme} ${slot}: keyboard or still path`, "no event to fire: M5 is reached through M3 and M4, M6, M8 and M10 have no still change, M11 is a static skin (spec 3.0)");
    }
    rec.expect("no console errors", cell.errors.length === 0, cell.errors.slice(0, 5).join(" | "));
  } finally {
    await cell.close();
  }
}

/* ------------------------------------------------------------------ aggregation */

/** In landscape-short the title is fit-content, so its width is its text width in the
    theme's title font (a theme token); only its position and height must match there. */
function intrinsicWidth(name: string, size: string): boolean {
  const [w, h] = size.split("x").map(Number);
  return name === "h1" && w > h && h <= 500;
}

function compareBoxes(cells: CellReport[], rec: Recorder): void {
  const groups = new Map<string, CellReport[]>();
  for (const cell of cells) {
    if (!cell.boxes) continue;
    const key = `${cell.size}/${cell.state}`;
    groups.set(key, [...(groups.get(key) ?? []), cell]);
  }
  for (const [key, group] of groups) {
    if (group.length < 2) {
      rec.skip(`layout boxes match across themes at ${key}`, `only ${group.length} theme ran`);
      continue;
    }
    const names = new Set(group.flatMap((cell) => Object.keys(cell.boxes ?? {})));
    const diffs: string[] = [];
    for (const name of names) {
      const ref = group[0].boxes?.[name] ?? null;
      for (const other of group.slice(1)) {
        const box = other.boxes?.[name] ?? null;
        if (!ref || !box) {
          if (ref !== box) diffs.push(`${name}: ${group[0].theme} ${fmt(ref)} vs ${other.theme} ${fmt(box)}`);
          continue;
        }
        const dw = intrinsicWidth(name, group[0].size) ? 0 : Math.abs(ref.w - box.w);
        const delta = Math.max(Math.abs(ref.x - box.x), Math.abs(ref.y - box.y), dw, Math.abs(ref.h - box.h));
        if (delta > BOX_TOLERANCE) diffs.push(`${name}: ${group[0].theme} ${fmt(ref)} vs ${other.theme} ${fmt(box)}`);
      }
    }
    rec.expect(`layout boxes match within ${BOX_TOLERANCE} px across ${group.length} themes at ${key}`, diffs.length === 0, diffs.slice(0, 8).join("; "));
  }
}

/** Computed styles of the skinned parts must differ from every other theme (spec 5.4), per size and state. */
function compareStyles(cells: CellReport[], rec: Recorder): void {
  const groups = new Map<string, CellReport[]>();
  for (const cell of cells) {
    if (!cell.styles) continue;
    const key = `${cell.size}/${cell.state}`;
    groups.set(key, [...(groups.get(key) ?? []), cell]);
  }
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    for (const cell of group) {
      const same: string[] = [];
      for (const other of group) {
        if (other === cell) continue;
        for (const part of Object.keys(cell.styles ?? {})) {
          if (cell.styles?.[part] === other.styles?.[part]) same.push(`${part} = ${other.theme}`);
        }
      }
      rec.owned(`computed styles of card, title, chip, picker button, footer, resume and dialog card differ from every other theme (${cell.theme} at ${key})`, same.length === 0, same.slice(0, 8).join(", ") || "all differ", UNIT[cell.theme]);
    }
  }
}

async function findKitThemes(browser: Browser, target: HubTarget, themes: HubThemeKey[]): Promise<HubThemeKey[]> {
  const kit: HubThemeKey[] = [];
  for (const theme of themes) {
    const cell = await openHub(browser, target, theme, "1440x900");
    try {
      if (await waitKit(cell.page, theme)) kit.push(theme);
    } finally {
      await cell.close();
    }
  }
  return kit;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) {
    console.log(USAGE);
    return 0;
  }
  const { opts, rest } = parseArgs(argv, ["no-flows", "legacy", "dry-run"]);
  const base = rest[0];
  if (!base) {
    console.error(USAGE);
    return 2;
  }
  const phase = (opts.get("phase") ?? process.env.HUB_PHASE ?? "A").toUpperCase();
  if (phase !== "A" && phase !== "B") throw new Error(`--phase must be A or B, got ${phase}`);
  const phaseB = phase === "B";
  const target: HubTarget = { base: new URL(base).toString(), legacy: opts.has("legacy") };
  const sizes = parseSizes(opts.get("sizes") ?? FIXTURE_SIZES.join(","));
  const states = (opts.get("states") ?? "S0,S1").split(",").filter(Boolean);
  for (const s of states) if (s !== "S0" && s !== "S1") throw new Error(`unknown state ${s}`);
  const flows = !opts.has("no-flows");
  const picked = opts.has("themes") ? parseThemes(opts.get("themes") ?? "") : null;
  const reportPath = opts.get("report") ?? (picked ? `.qa/hub-e2e-report-${picked.join("+")}.json` : REPORT);
  const runId = `${basename(reportPath, ".json")}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const SHOTS = `${SHOTS_ROOT}/${runId}`;

  if (opts.has("dry-run")) {
    const themes = picked ?? ["(themes found in the page)"];
    console.log(`phase ${phase}${target.legacy ? ", legacy build" : ""}`);
    console.log(`cells: ${themes.join(", ")} x ${sizes.map((s) => s.label).join(", ")} x ${states.join(", ")}, plus ${ZOOM_SIZE} S0 per theme`);
    console.log(flows ? "flows: reduced motion, pause, dialogs per theme; soft navigation; picker keyboard, phones, rapid switching, pause switch, wipes; pick; attention and mechanics per kit theme; scene output; touch" : "flows: off");
    console.log(`report: ${reportPath}; screenshots: ${SHOTS}/`);
    return 0;
  }

  const inBuild = await themesInBuild(target.base);
  const themes = picked ?? inBuild;
  const missing = themes.filter((t) => !inBuild.includes(t));
  mkdirSync(join(process.cwd(), SHOTS), { recursive: true });

  const cells: CellReport[] = [];
  const flowReports: { name: string; checks: Check[] }[] = [];
  const global = new Recorder(phaseB);
  for (const key of missing) global.expect(`theme ${key} has its container in the page`, false);
  for (const row of HUB_THEMES) if (!inBuild.includes(row.key)) global.waiting(`theme ${row.key} in the build`, `the ${row.key} theme unit`);

  const runFlow = async (name: string, fn: (rec: Recorder) => Promise<void>) => {
    const rec = new Recorder(phaseB);
    try {
      await fn(rec);
    } catch (error) {
      rec.expect("flow ran to completion", false, String(error));
    }
    flowReports.push({ name, checks: rec.checks });
    const fails = rec.checks.filter((c) => c.status === "fail").length;
    console.log(`${fails ? "FAIL" : "ok  "} flow: ${name} (${rec.checks.length} checks, ${fails} failed)`);
  };

  const browser = await launch();
  try {
    const ran = themes.filter((t) => inBuild.includes(t));
    for (const theme of ran) {
      const matrix: { size: Size; state: string }[] = [
        ...sizes.flatMap((size) => states.map((state) => ({ size, state }))),
        { size: parseSize(ZOOM_SIZE), state: "S0" },
      ];
      for (const { size, state } of matrix) {
        const id = `${theme}/${size.label}/${state}`;
        const rec = new Recorder(phaseB);
        const cell = await openCell(browser, size, { storage: themeStorage(target, theme) });
        const report: CellReport = { id, theme, size: size.label, state, checks: rec.checks };
        try {
          await cell.page.evaluateOnNewDocument(INSTRUMENT);
          if (state === "S1") await seedReading(cell.page, target.base);
          await cell.page.goto(hubUrl(target, theme), { waitUntil: "load" });
          if (size.label === ZOOM_SIZE) {
            await settle(cell.page, 600);
            const layout = await readLayout(cell.page);
            rec.expect("no horizontal scroll at 200% zoom", layout.scrollWidth === layout.clientWidth, `scrollWidth ${layout.scrollWidth}, clientWidth ${layout.clientWidth}`);
            const bar = layout.topbar;
            const hits = [layout.boxes.h1, layout.boxes.subtitle].filter((r): r is Rect => !!r && !!bar && intersects(bar, r));
            rec.expect("topbar overlaps neither the h1 nor the subtitle", !!bar && hits.length === 0, `topbar ${fmt(bar)}`);
          } else {
            const result = await runCell(cell.page, rec, { theme, size, state, errors: cell.errors });
            report.boxes = result.boxes;
            report.styles = result.styles;
          }
          const shot = `${SHOTS}/${theme}-${size.label}-${state}.png`;
          await cell.page.evaluate(() => scrollTo(0, 0));
          await cell.page.screenshot({ path: join(process.cwd(), shot) });
          report.screenshot = shot;
        } catch (error) {
          rec.expect("cell ran to completion", false, String(error));
        } finally {
          await cell.close();
        }
        cells.push(report);
        const fails = rec.checks.filter((c) => c.status === "fail").length;
        console.log(`${fails ? "FAIL" : "ok  "} ${id} (${rec.checks.length} checks, ${fails} failed)`);
      }

      if (flows) {
        for (const mode of ["reduced", "pause"] as const) {
          await runFlow(`${theme}: ${mode === "reduced" ? "reduced motion" : "pause"}`, async (rec) => {
            const cell = await openHub(browser, target, theme, "1440x900", { reducedMotion: mode === "reduced", paused: mode === "pause" });
            try {
              await stillFlow(cell.page, rec, theme, mode);
              rec.expect("no console errors", cell.errors.length === 0, cell.errors.slice(0, 5).join(" | "));
            } finally {
              await cell.close();
            }
          });
        }
        await runFlow(`${theme}: dialogs`, async (rec) => {
          const cell = await openCell(browser, parseSize("1440x900"), { storage: themeStorage(target, theme) });
          try {
            await cell.page.evaluateOnNewDocument(INSTRUMENT);
            await dialogFlow(cell.page, rec, theme, target);
          } finally {
            await cell.close();
          }
        });
      }
    }

    if (flows) {
      const kit = await findKitThemes(browser, target, ran);
      console.log(`kit themes: [${kit.join(", ")}]`);
      await runFlow("soft navigation hub → Lodge → hub → Tsukinomi → hub", async (rec) => {
        const cell = await openCell(browser, parseSize("1440x900"));
        try {
          await cell.page.evaluateOnNewDocument(INSTRUMENT);
          await softNavigationFlow(cell.page, rec, target.base);
          rec.expect("no console errors", cell.errors.length === 0, cell.errors.slice(0, 5).join(" | "));
        } finally {
          await cell.close();
        }
      });
      if (target.legacy) {
        flowReports.push({ name: "picker and chrome flows", checks: [{ name: "picker, pick, attention, output, touch and mechanics flows", status: "skip", detail: "legacy build has no picker" }] });
      } else {
        await runFlow("profile dialogs fit short and narrow viewports", (rec) => dialogFitFlow(browser, target, rec, ran[0]));
        await runFlow("picker by keyboard (focus, ArrowDown after 400 ms, Escape, reload, อัตโนมัติ, ?theme= not stored)", (rec) => pickerKeyboardFlow(browser, target, rec));
        await runFlow("rapid switching (10 presses in 1 s apply at most 2 switches 1 s apart)", (rec) => rapidSwitchFlow(browser, target, rec));
        await runFlow("picker on phones at 844x390 and 320x568 (8.3 item 10)", (rec) => pickerPhoneFlow(browser, target, rec, kit[0] ?? ran[0], kit.length > 0));
        await runFlow("pause switch", async (rec) => {
          if (kit.length === 0) rec.waiting("pause switch: rAF flat, canvases drawn, taps still work", "a kit theme");
          else await pauseSwitchFlow(browser, target, rec, kit[0]);
        });
        await runFlow("wipes or fallback crossfade on picker switches", (rec) => wipeFlow(browser, target, rec, ran));
        await runFlow("pick from the start panel and the library heading, S0 and S1", (rec) => pickFlow(browser, target, rec, ran[0]));
        for (const theme of ran) await runFlow(`${theme}: attention parity (hover and Tab focus)`, (rec) => attentionFlow(browser, target, rec, theme));
        await runFlow("scene output: perches, world label, focusCard, guide", (rec) => outputFlow(browser, target, rec, kit[0] ?? ran[0]));
        await runFlow("touch: card tap, stage swipe, mothlight sky swipe", (rec) => touchFlow(browser, target, rec, ran, kit));
        for (const theme of ran) {
          await runFlow(`${theme}: mechanics keyboard and still paths (8.4 item 31)`, async (rec) => {
            if (kit.includes(theme)) await mechanicsFlow(browser, target, rec, theme);
            else rec.waiting(`${theme}: mechanics keyboard and still paths`, `the ${theme} scene on the kit (${UNIT[theme]})`);
          });
        }
        await runFlow("skyglass focused card pixel check (8.3 item 9)", async (rec) => {
          if (!ran.includes("skyglass")) {
            rec.waiting("skyglass focused card: outline at least 3:1 against the card and the page, halo at least 3:1 against the outline", "skyglass in the build (U3)");
            return;
          }
          await focusRingFlow(browser, target, rec);
        });
      }
    }
  } finally {
    await browser.close();
  }

  compareBoxes(cells, global);
  compareStyles(cells, global);
  const all = [...global.checks, ...cells.flatMap((c) => c.checks), ...flowReports.flatMap((f) => f.checks)];
  const summary = {
    pass: all.filter((c) => c.status === "pass").length,
    fail: all.filter((c) => c.status === "fail").length,
    skip: all.filter((c) => c.status === "skip").length,
  };
  const report = { base: target.base, phase, legacy: target.legacy, themes, finishedAt: new Date().toISOString(), summary, global: global.checks, cells, flows: flowReports };
  mkdirSync(join(process.cwd(), ".qa"), { recursive: true });
  mkdirSync(dirname(join(process.cwd(), reportPath)), { recursive: true });
  writeFileSync(join(process.cwd(), reportPath), `${JSON.stringify(report, null, 2)}\n`);

  for (const check of global.checks) if (check.status === "fail") console.error(`FAIL ${check.name}: ${check.detail ?? ""}`);
  for (const flow of flowReports) {
    for (const check of flow.checks) if (check.status === "fail") console.error(`FAIL [${flow.name}] ${check.name}: ${check.detail ?? ""}`);
  }
  const failedNames = new Map<string, number>();
  for (const cell of cells) for (const check of cell.checks) if (check.status === "fail") failedNames.set(check.name, (failedNames.get(check.name) ?? 0) + 1);
  for (const [name, count] of failedNames) console.error(`FAIL in ${count} cells: ${name}`);
  console.log(`hub e2e: ${summary.pass} passed, ${summary.fail} failed, ${summary.skip} skipped; report ${reportPath}`);
  return summary.fail ? 1 : 0;
}

/** Focus ring on a skyglass card (8.3 item 9): outline vs card body and page, halo vs outline, from pixels. */
async function focusRingFlow(browser: Browser, target: HubTarget, rec: Recorder): Promise<void> {
  const cell = await openHub(browser, target, "skyglass", "1440x900");
  const { page } = cell;
  try {
    await settle(page, 1200);
    await page.focus(".hub-library-head [data-hub-pick]");
    await page.keyboard.press("Tab");
    await sleep(500);
    const ring = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      if (!a?.matches("a.novel-card")) return null;
      a.scrollIntoView({ block: "center", behavior: "instant" });
      const r = a.getBoundingClientRect();
      const cs = getComputedStyle(a);
      return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, outline: cs.outlineColor, offset: Number.parseFloat(cs.outlineOffset) || 0, width: Number.parseFloat(cs.outlineWidth) || 0 };
    });
    if (!rec.expect("skyglass: Tab focuses a card", !!ring)) return;
    await sleep(300);
    const r = ring!;
    const pad = r.offset + r.width + 12;
    const clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y + r.h / 2 - 20), width: pad + 24, height: 40 };
    const shot = await page.screenshot({ clip, encoding: "base64" });
    const measured = await page.evaluate(
      async (b64: string, ringInfo: { offset: number; width: number }, padPx: number) => {
        const lum = (d: Uint8ClampedArray, i: number) => {
          const f = (v: number) => {
            const c = v / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2]);
        };
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const g = c.getContext("2d", { willReadFrequently: true });
        if (!g) return null;
        g.drawImage(img, 0, 0);
        const scale = c.width / (padPx + 24);
        const row = Math.round(c.height / 2);
        const at = (cssX: number) => lum(g.getImageData(Math.round(cssX * scale), row, 1, 1).data, 0);
        const cardEdge = padPx;
        const outline = at(cardEdge - ringInfo.offset - ringInfo.width / 2);
        const halo = at(cardEdge - ringInfo.offset / 2);
        const body = at(cardEdge + 8);
        const pageBg = at(2);
        const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        return { outlineBody: ratio(outline, body), outlinePage: ratio(outline, pageBg), haloOutline: ratio(halo, outline) };
      },
      shot as string,
      { offset: r.offset, width: r.width },
      pad,
    );
    rec.owned(
      "skyglass focused card: outline at least 3:1 against the card and the page, halo at least 3:1 against the outline",
      !!measured && measured.outlineBody >= 3 && measured.outlinePage >= 3 && measured.haloOutline >= 3,
      JSON.stringify(measured),
      UNIT.skyglass,
    );
  } finally {
    await cell.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
