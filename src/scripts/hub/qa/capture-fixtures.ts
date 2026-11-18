// Captures page-model fixtures from a built hub (spec 4 U7, 8.3 item 7, 8.4 item 13).
// For every size, with no reading record (S0) and with one seeded through the real
// per-profile reading key (S1), it measures the page as world/page-model.ts does,
// builds the snapshot with page-model-core, and writes both to the fixture file.
// Drift check: a rect that moved more than 2 px from the existing fixture, or between
// two measurements of the same page, fails the run; --accept overwrites after a review.
//
// Usage: tsx src/scripts/hub/qa/capture-fixtures.ts <baseUrl> [--sizes WxH,...] [--theme key]
//        [--out path] [--accept] [--dry-run]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { HUB_FALLBACK } from "../theme-core.mjs";
import { buildSnapshot } from "../world/page-model-core";
import type { HubThemeKey, PageMeasure, PageSnapshot } from "../world/types";
import { FIXTURE_SIZES, hubUrl, launch, measurePage, openCell, parseArgs, parseSizes, parseThemes, seedReading, settle, type HubTarget, type Size } from "./browser";

const DEFAULT_OUT = "src/scripts/hub/world/__fixtures__/page-snapshots.json";
const DRIFT_PX = 2;

const USAGE = `usage: tsx src/scripts/hub/qa/capture-fixtures.ts <baseUrl> [options]
  --sizes WxH,...  sizes to capture (default ${FIXTURE_SIZES.join(",")})
  --theme key      theme to capture under (default ${HUB_FALLBACK}; geometry is shared)
  --out path       fixture file (default ${DEFAULT_OUT})
  --accept         overwrite the fixture even when rects drifted more than ${DRIFT_PX} px
  --dry-run        print the plan and exit`;

interface FixtureCell {
  size: Size;
  state: "S0" | "S1";
  measure: PageMeasure;
  snapshot: PageSnapshot;
}

interface FixtureFile {
  format: 1;
  theme: HubThemeKey;
  cells: Record<string, FixtureCell>;
}

/** Every numeric leaf whose path differs by more than `limit` (or exists on one side only). */
function drift(a: unknown, b: unknown, limit: number, path = ""): string[] {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) > limit ? [`${path}: ${a} -> ${b}`] : [];
  if (Array.isArray(a) && Array.isArray(b)) {
    const out = a.length !== b.length ? [`${path}: ${a.length} items -> ${b.length}`] : [];
    for (let i = 0; i < Math.min(a.length, b.length); i++) out.push(...drift(a[i], b[i], limit, `${path}[${i}]`));
    return out;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const out: string[] = [];
    for (const key of keys) {
      const va = (a as Record<string, unknown>)[key];
      const vb = (b as Record<string, unknown>)[key];
      if (va === undefined || vb === undefined) {
        if (va !== vb) out.push(`${path}.${key}: ${va === undefined ? "added" : "removed"}`);
        continue;
      }
      out.push(...drift(va, vb, limit, `${path}.${key}`));
    }
    return out;
  }
  return a === b ? [] : [`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`];
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) {
    console.log(USAGE);
    return 0;
  }
  const { opts, rest } = parseArgs(argv, ["accept", "dry-run"]);
  const base = rest[0];
  if (!base) {
    console.error(USAGE);
    return 2;
  }
  const sizes = parseSizes(opts.get("sizes") ?? FIXTURE_SIZES.join(","));
  const theme = parseThemes(opts.get("theme") ?? HUB_FALLBACK)[0];
  const out = opts.get("out") ?? DEFAULT_OUT;
  const target: HubTarget = { base: new URL(base).toString(), legacy: false };
  const states = ["S0", "S1"] as const;
  if (opts.has("dry-run")) {
    console.log(`would capture ${sizes.length * 2} cells (${sizes.map((s) => s.label).join(", ")} x S0,S1) from ${hubUrl(target, theme, { seed: "1" })} into ${out}`);
    return 0;
  }

  const browser = await launch();
  const file: FixtureFile = { format: 1, theme, cells: {} };
  const problems: string[] = [];
  try {
    for (const size of sizes) {
      for (const state of states) {
        const id = `${size.label}/${state}`;
        const cell = await openCell(browser, size);
        try {
          if (state === "S1") await seedReading(cell.page, target.base);
          await cell.page.goto(hubUrl(target, theme, { seed: "1" }), { waitUntil: "load" });
          await settle(cell.page, 600);
          const first = await measurePage(cell.page);
          if ("missing" in first) {
            problems.push(`${id}: the page lacks ${first.missing.join(", ")} (phase-A skeleton not built)`);
            continue;
          }
          await settle(cell.page, 600);
          const second = await measurePage(cell.page);
          const unstable = "missing" in second ? ["second measure failed"] : drift(first, second, DRIFT_PX);
          if (unstable.length) problems.push(`${id}: layout still moving between two measures: ${unstable.slice(0, 5).join("; ")}`);
          if (state === "S1" && !first.parts.resume) problems.push(`${id}: the seeded reading record did not show the resume card`);
          if (state === "S0" && first.parts.resume) problems.push(`${id}: the resume card shows without a reading record`);
          if (cell.errors.length) problems.push(`${id}: console errors: ${cell.errors.slice(0, 3).join(" | ")}`);
          file.cells[id] = { size, state, measure: first, snapshot: buildSnapshot(first, 1) };
          console.log(`captured ${id}: mode ${file.cells[id].snapshot.mode}, ${first.cards.length} cards`);
        } finally {
          await cell.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  const fullOut = join(process.cwd(), out);
  const drifted: string[] = [];
  let kept: Record<string, FixtureCell> = {};
  if (existsSync(fullOut)) {
    const previous = JSON.parse(readFileSync(fullOut, "utf8")) as FixtureFile;
    // Cells not recaptured in this run (a --sizes subset) stay as they were.
    if (previous.theme === file.theme) kept = previous.cells;
    for (const [id, cell] of Object.entries(file.cells)) {
      const old = previous.cells[id];
      if (!old) continue;
      drifted.push(...drift(old.measure, cell.measure, DRIFT_PX, id));
    }
  }
  for (const problem of problems) console.error(`FAIL ${problem}`);
  if (drifted.length) {
    console.error(`DRIFT above ${DRIFT_PX} px against ${out} (${drifted.length}):`);
    for (const line of drifted.slice(0, 40)) console.error(`  ${line}`);
  }
  const captured = Object.keys(file.cells).length;
  if (captured === 0) {
    console.error("nothing captured; the fixture file was not written");
    return 1;
  }
  if (problems.length) {
    console.error("the fixture file was not written because of the failures above");
    return 1;
  }
  if (drifted.length && !opts.has("accept")) {
    console.error("the fixture file was not written; review the drift and rerun with --accept");
    return 1;
  }
  const merged: FixtureFile = { ...file, cells: { ...kept, ...file.cells } };
  mkdirSync(dirname(fullOut), { recursive: true });
  writeFileSync(fullOut, `${JSON.stringify(merged, null, 2)}\n`);
  const total = Object.keys(merged.cells).length;
  console.log(`wrote ${captured} captured cells to ${out} (${total} in the file)${drifted.length ? " (drift accepted)" : ""}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
