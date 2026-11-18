// Computed-style snapshot of the hub chrome (spec 4 U7: the token pass must not
// change how the four existing themes look). `capture` records computed styles of
// the shared chrome per theme, size and reading state; `diff` compares two captures.
//
// Usage: tsx src/scripts/hub/qa/style-snapshot.ts capture <baseUrl> --out file.json
//          [--themes a,b] [--sizes WxH,...] [--legacy]
//        tsx src/scripts/hub/qa/style-snapshot.ts diff <before.json> <after.json>

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { HubThemeKey } from "../world/types";
import { hubUrl, launch, openCell, parseArgs, parseSizes, parseThemes, seedReading, settle, themeStorage, themesInBuild, type HubTarget } from "./browser";

const USAGE = `usage:
  tsx src/scripts/hub/qa/style-snapshot.ts capture <baseUrl> --out file.json [--themes a,b] [--sizes WxH,...] [--legacy]
  tsx src/scripts/hub/qa/style-snapshot.ts diff <before.json> <after.json>`;

/** Shared chrome that exists before and after the overhaul, with optional pseudo-element. */
const TARGETS: readonly [string, string, string | null][] = [
  ["body", "body", null],
  ["hero pool", ".hub-hero", "::before"],
  ["title", ".hub-hero h1", null],
  ["subtitle", ".hub-title-group > p", null],
  ["side note", ".hub-side-note", null],
  ["chip", "[data-profile-widget]", null],
  ["chip edit", "[data-profile-edit-btn]", null],
  ["resume card", "[data-hub-resume]", null],
  ["resume link", "[data-resume-link]", null],
  ["resume clear", "[data-resume-clear]", null],
  ["card", '.novel-card-wrapper[data-status="เผยแพร่"] .novel-card', null],
  ["card media shade", '.novel-card-wrapper[data-status="เผยแพร่"] .novel-card-media', "::after"],
  ["card body", '.novel-card-wrapper[data-status="เผยแพร่"] .novel-card-body', null],
  ["card title", '.novel-card-wrapper[data-status="เผยแพร่"] .novel-card-title', null],
  ["card subtitle", '.novel-card-wrapper[data-status="เผยแพร่"] .novel-card-subtitle', null],
  ["card meta", '.novel-card-wrapper[data-status="เผยแพร่"] .novel-card-meta', null],
  ["card state", '.novel-card-wrapper[data-status="เผยแพร่"] .novel-card-state', null],
  ["card action", '.novel-card-wrapper[data-status="เผยแพร่"] .novel-card-action', null],
  ["card progress", '.novel-card-wrapper[data-status="เผยแพร่"] .novel-card-progress', null],
  ["locked card", ".novel-card.is-disabled", null],
  ["upcoming card", ".novel-card.is-upcoming", null],
  ["upcoming seal", ".upcoming-seal", null],
  ["footer", ".hub-footer", null],
  ["dialog card", "[data-edit-profile-modal] .hub-modal-card", null],
  ["primary button", "[data-edit-profile-modal] .btn-primary", null],
];

const PROPS = [
  "color", "background-color", "background-image", "border-top-color", "border-top-width", "border-top-left-radius",
  "box-shadow", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-shadow",
  "text-transform", "opacity", "filter", "padding-top", "padding-left", "margin-top", "transform", "outline-color",
] as const;

interface Capture {
  base: string;
  cells: Record<string, Record<string, Record<string, string> | null>>;
}

async function capture(base: string, out: string, opts: Map<string, string>): Promise<number> {
  const target: HubTarget = { base: new URL(base).toString(), legacy: opts.has("legacy") };
  const themes: HubThemeKey[] = opts.has("themes") ? parseThemes(opts.get("themes") ?? "") : await themesInBuild(target.base);
  const sizes = parseSizes(opts.get("sizes") ?? "1440x900,390x844");
  const result: Capture = { base: target.base, cells: {} };
  const browser = await launch();
  try {
    for (const theme of themes) {
      for (const size of sizes) {
        for (const state of ["S0", "S1"]) {
          const cell = await openCell(browser, size, { storage: themeStorage(target, theme) });
          try {
            if (state === "S1") await seedReading(cell.page, target.base);
            await cell.page.goto(hubUrl(target, theme), { waitUntil: "load" });
            await settle(cell.page, 800);
            const styles = await cell.page.evaluate(
              (targets: [string, string, string | null][], props: string[]) => {
                const out: Record<string, Record<string, string> | null> = {};
                for (const [name, selector, pseudo] of targets) {
                  const el = document.querySelector(selector);
                  if (!el) {
                    out[name] = null;
                    continue;
                  }
                  const cs = getComputedStyle(el, pseudo);
                  const entry: Record<string, string> = {};
                  for (const prop of props) entry[prop] = cs.getPropertyValue(prop);
                  out[name] = entry;
                }
                return out;
              },
              TARGETS.map((t) => [...t] as [string, string, string | null]),
              [...PROPS],
            );
            result.cells[`${theme}/${size.label}/${state}`] = styles;
            console.log(`captured ${theme}/${size.label}/${state}`);
          } finally {
            await cell.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`wrote ${Object.keys(result.cells).length} cells to ${out}`);
  return 0;
}

function diff(beforePath: string, afterPath: string): number {
  const before = JSON.parse(readFileSync(beforePath, "utf8")) as Capture;
  const after = JSON.parse(readFileSync(afterPath, "utf8")) as Capture;
  let changes = 0;
  for (const [cell, parts] of Object.entries(before.cells)) {
    const next = after.cells[cell];
    if (!next) {
      console.log(`${cell}: not in ${afterPath}`);
      continue;
    }
    for (const [part, styles] of Object.entries(parts)) {
      const other = next[part];
      if (!styles || !other) {
        if (styles !== other) {
          console.log(`${cell} ${part}: ${styles ? "present" : "absent"} -> ${other ? "present" : "absent"}`);
          changes++;
        }
        continue;
      }
      for (const [prop, value] of Object.entries(styles)) {
        if (other[prop] !== value) {
          console.log(`${cell} ${part} ${prop}: ${value} -> ${other[prop]}`);
          changes++;
        }
      }
    }
  }
  console.log(changes ? `${changes} computed-style changes` : "no computed-style changes");
  return changes ? 1 : 0;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || !argv.length) {
    console.log(USAGE);
    return argv.length ? 0 : 2;
  }
  const { opts, rest } = parseArgs(argv, ["legacy"]);
  const [command, a, b] = rest;
  if (command === "capture" && a && opts.has("out")) return capture(a, opts.get("out") ?? "", opts);
  if (command === "diff" && a && b) return diff(a, b);
  console.error(USAGE);
  return 2;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
