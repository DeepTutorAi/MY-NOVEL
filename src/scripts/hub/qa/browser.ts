// Shared puppeteer helpers for the hub QA scripts: viewports, fresh contexts,
// theme selection, seeded reading records and the page measure.

import puppeteer, { type Browser, type BrowserContext, type Page } from "puppeteer";

import { HUB_THEMES, MOTION_KEY, OVERRIDE_KEY } from "../theme-core.mjs";
import type { HubThemeKey, PageMeasure } from "../world/types";

export interface Size {
  w: number;
  h: number;
  dpr: number;
  touch: boolean;
  label: string;
}

/** The fixture and acceptance sizes (2.3, 4, 8.4 item 13). */
export const FIXTURE_SIZES = ["1440x900", "1280x800", "2560x1440", "390x844", "844x390", "320x568", "700x560", "667x375"] as const;

const TOUCH = new Set(["390x844", "844x390", "320x568", "667x375"]);
const DPR2 = new Set(["390x844", "720x450"]);
export const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

export function parseSize(text: string): Size {
  const match = /^(\d+)x(\d+)$/.exec(text.trim());
  if (!match) throw new Error(`bad size "${text}" (expected WxH)`);
  const label = `${match[1]}x${match[2]}`;
  return { w: Number(match[1]), h: Number(match[2]), dpr: DPR2.has(label) ? 2 : 1, touch: TOUCH.has(label), label };
}

export const parseSizes = (list: string) => list.split(",").filter(Boolean).map(parseSize);

export function parseThemes(list: string): HubThemeKey[] {
  const keys = HUB_THEMES.map((row) => row.key);
  return list
    .split(",")
    .filter(Boolean)
    .map((key) => {
      const row = keys.find((k) => k === key.trim());
      if (!row) throw new Error(`unknown theme "${key}" (known: ${keys.join(", ")})`);
      return row;
    });
}

/** Reads `--name value` and `--flag` options; positional arguments come back in `rest`. */
export function parseArgs(argv: readonly string[], flags: readonly string[]): { opts: Map<string, string>; rest: string[] } {
  const opts = new Map<string, string>();
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      rest.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (flags.includes(name)) opts.set(name, "true");
    else {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`--${name} needs a value`);
      opts.set(name, value);
      i++;
    }
  }
  return { opts, rest };
}

export function launch(): Promise<Browser> {
  return puppeteer.launch({ channel: "chrome", headless: true, args: ["--no-first-run", "--no-default-browser-check"] });
}

export interface HubTarget {
  base: string;
  /** Pre-overhaul build: the theme comes from the stored override, not ?theme=. */
  legacy: boolean;
}

export interface Cell {
  context: BrowserContext;
  page: Page;
  errors: string[];
  close(): Promise<void>;
}

export interface CellOptions {
  reducedMotion?: boolean;
  /** Stored before any script runs (device-global keys only). */
  storage?: Record<string, string>;
}

/**
 * A fixed guest profile, stored before the page runs, so the chip shows the same name in every
 * context (a fresh profile otherwise gets a random guest name and the chip width varies).
 */
export const QA_PROFILE_STORAGE: Readonly<Record<string, string>> = {
  "piichan-novels:profiles": JSON.stringify([{ id: "guest", name: "ผู้อ่านทดสอบ", avatar: "👤" }]),
  "piichan-novels:active-profile-id": "guest",
};

/** A fresh incognito context and page sized and emulated for `size`, with error capture and the QA profile. */
export async function openCell(browser: Browser, size: Size, options: CellOptions = {}): Promise<Cell> {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  // tsx keeps function names with a __name helper that does not exist in the page.
  await page.evaluateOnNewDocument("globalThis.__name = (fn) => fn;");
  await page.evaluateOnNewDocument(
    (entries: Record<string, string>) => {
      try {
        for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
      } catch {
        // Storage blocked: the page falls back to its defaults.
      }
    },
    { ...QA_PROFILE_STORAGE, ...options.storage },
  );
  if (size.touch) await page.setUserAgent({ userAgent: ANDROID_UA });
  await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: size.dpr, isMobile: size.touch, hasTouch: size.touch });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: options.reducedMotion ? "reduce" : "no-preference" }]);
  return { context, page, errors, close: () => context.close() };
}

/** Storage that selects a theme on a legacy build, plus the pause key when asked. */
export function themeStorage(target: HubTarget, theme: HubThemeKey, paused = false): Record<string, string> {
  const storage: Record<string, string> = {};
  if (target.legacy) storage[OVERRIDE_KEY] = theme;
  if (paused) storage[MOTION_KEY] = "still";
  return storage;
}

export function hubUrl(target: HubTarget, theme: HubThemeKey, params: Record<string, string> = {}): string {
  const url = new URL(target.base);
  if (!target.legacy) url.searchParams.set("theme", theme);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export interface ReadingSeed {
  storageKey: string;
  record: { chapterId: string; chapterNumber: number; chapterTitle: string; progress: number; updatedAt: number };
}

/**
 * Seeds a Lodge reading record (S1) through the page's own interceptor, so it lands under the
 * active profile's key exactly as a reader's progress would. The chapter comes from the unit list
 * the hub itself renders.
 */
export async function seedReading(page: Page, base: string): Promise<ReadingSeed> {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  const html = await page.content();
  const match = /lodgeUnits = (\[[^\n]*?\]);/.exec(html);
  if (!match) throw new Error("the hub page carries no lodgeUnits list (ResumeCard define:vars)");
  const units = JSON.parse(match[1]) as { id: string; number: number; title: string }[];
  const unit = units[Math.min(1, units.length - 1)];
  if (!unit) throw new Error("the Lodge unit list is empty");
  const seed: ReadingSeed = {
    storageKey: "hvitveldt:reading:last",
    record: { chapterId: unit.id, chapterNumber: unit.number, chapterTitle: unit.title, progress: 0.42, updatedAt: Date.now() },
  };
  await page.evaluate((s: ReadingSeed) => localStorage.setItem(s.storageKey, JSON.stringify(s.record)), seed);
  return seed;
}

/** Waits for fonts, two frames and a short quiet period. */
export async function settle(page: Page, ms = 400): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Measures the page the way world/page-model.ts does (spec 2.10): same selectors, document
 * coordinates rounded to 0.5 px, the shell's content box horizontally. Reads only the card
 * title and state lines, never the English line above the title.
 */
export function measurePage(page: Page): Promise<PageMeasure | { missing: string[] }> {
  return page.evaluate(() => {
    const round = (v: number) => Math.round(v * 2) / 2;
    const zero = { x: 0, y: 0, w: 0, h: 0 };
    const docRect = (el: Element | null) => {
      if (!el) return undefined;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return undefined;
      return { x: round(r.left + scrollX), y: round(r.top + scrollY), w: round(r.width), h: round(r.height) };
    };
    const shell = document.querySelector<HTMLElement>(".hub-shell");
    const missing: string[] = [];
    if (!shell) return { missing: [".hub-shell"] };
    const q = (selector: string) => shell.querySelector(selector);
    for (const name of ["stage", "mid", "ground"]) if (!q(`[data-hub-window="${name}"]`)) missing.push(`[data-hub-window="${name}"]`);
    if (!q(".hub-library-head")) missing.push(".hub-library-head");
    if (missing.length) return { missing };

    const box = shell.getBoundingClientRect();
    const style = getComputedStyle(shell);
    const padLeft = Number.parseFloat(style.paddingLeft) || 0;
    const padRight = Number.parseFloat(style.paddingRight) || 0;
    const shellRect = { x: round(box.left + scrollX + padLeft), y: round(box.top + scrollY), w: round(box.width - padLeft - padRight), h: round(box.height) };
    const fractions = (el: Element | null, prefix: string) => {
      if (!el) return { x: 0, y: 0, w: 1, h: 1 };
      const cs = getComputedStyle(el);
      const read = (name: string, fallback: number) => {
        const v = Number.parseFloat(cs.getPropertyValue(`--${prefix}-hit-${name}`));
        return Number.isFinite(v) ? v : fallback;
      };
      return { x: read("x", 0), y: read("y", 0), w: read("w", 1), h: read("h", 1) };
    };
    const stageEl = q('[data-hub-window="stage"]');
    const midEl = q('[data-hub-window="mid"]');
    const groundEl = q('[data-hub-window="ground"]');
    const resumeEl = q("[data-hub-resume]");
    const startEl = q("[data-hub-start]");
    const chipEl = q("[data-profile-widget]");
    const pickerEl = q(".hub-topbar [data-hub-picker-open]");
    const sideNoteEl = q(".hub-side-note");
    const titleEl = q(".hub-hero h1");
    const libraryHeadEl = q(".hub-library-head");
    const footerEl = q(".hub-footer");
    const parts = {
      chip: docRect(chipEl),
      picker: docRect(pickerEl),
      title: docRect(titleEl) ?? zero,
      sideNote: docRect(sideNoteEl),
      resume: docRect(resumeEl),
      start: docRect(startEl),
      libraryHead: docRect(libraryHeadEl) ?? zero,
      footer: docRect(footerEl) ?? zero,
    };
    const holeEls = [
      titleEl,
      q(".hub-title-group > p"),
      q(".hub-kicker"),
      sideNoteEl,
      chipEl,
      ...shell.querySelectorAll("[data-hub-picker-open]"),
      resumeEl,
      startEl,
      libraryHeadEl,
      q(".hub-window-label"),
      ...(footerEl ? [...footerEl.children].filter((el) => !el.matches("[data-hub-window]")) : []),
    ];
    const holes = holeEls.map(docRect).filter((r) => r !== undefined);
    const cards = [];
    for (const wrapper of shell.querySelectorAll<HTMLElement>(".novel-card-wrapper")) {
      const rect = docRect(wrapper);
      const upcoming = wrapper.dataset.upcomingSlug;
      const slug = wrapper.dataset.novelSlug ?? upcoming;
      if (!rect || !slug) continue;
      const kind = upcoming !== undefined ? "upcoming" : wrapper.dataset.status === "เผยแพร่" ? "open" : "locked";
      const card = wrapper.querySelector<HTMLElement>(".novel-card");
      const read = Number.parseFloat(wrapper.style.getPropertyValue("--card-read"));
      const state = wrapper.querySelector(".novel-card-state") ?? wrapper.querySelector(".novel-card-action");
      cards.push({
        slug,
        kind,
        index: cards.length,
        accent: card?.style.getPropertyValue("--novel-accent").trim() ?? "",
        rect,
        media: docRect(wrapper.querySelector(".novel-card-media")) ?? rect,
        body: docRect(wrapper.querySelector(".novel-card-body")) ?? rect,
        read: Number.isFinite(read) ? read : null,
        finished: wrapper.hasAttribute("data-card-finished"),
        stateText: state?.textContent?.trim() ?? "",
        titleTh: wrapper.querySelector(".novel-card-title")?.textContent?.trim() ?? "",
      });
    }
    const cover = [...cards.map((c) => c.rect), parts.resume, parts.start, parts.chip, parts.sideNote, parts.picker].filter((r) => r !== undefined);
    return {
      viewport: { w: innerWidth, h: innerHeight, coarse: matchMedia("(pointer: coarse)").matches, dpr: devicePixelRatio || 1 },
      shell: shellRect,
      parts,
      windows: { stage: docRect(stageEl) ?? zero, mid: docRect(midEl) ?? zero, ground: docRect(groundEl) ?? zero },
      hitFractions: { stage: fractions(stageEl, "stage"), mid: fractions(midEl, "mid") },
      cards,
      holes,
      cover,
      modalOpen: document.querySelector('.hub-modal-overlay[role="dialog"][data-open]') !== null,
    } as PageMeasure;
  });
}

/** Themes whose sky container exists in the served hub page. */
export async function themesInBuild(base: string): Promise<HubThemeKey[]> {
  const html = await (await fetch(base)).text();
  return HUB_THEMES.filter((row) => html.includes(`id="${row.container}"`)).map((row) => row.key);
}
