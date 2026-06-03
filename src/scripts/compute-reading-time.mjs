// Recompute reading-time estimates for both novels from the actual prose.
//
// Formula (single, consistent rule for every chapter/section):
//   1. Drop the YAML frontmatter.
//   2. Keep only non-blank lines; strip markdown scaffolding that nobody reads
//      aloud (heading markers, {#anchors}, blockquote/list markers, ::: fences,
//      --- rules).
//   3. Count the remaining characters with whitespace removed ("ตัวอักษรที่ไม่
//      เอาเว้นช่องว่าง").
//   4. readingMinutes = max(1, round(readableChars / CHARS_PER_MINUTE)).
//
// CHARS_PER_MINUTE is the only tunable: ~500 non-space characters per minute is
// a comfortable Thai narrative reading pace. Raise it for a faster estimate,
// lower it for a slower/immersive one — every displayed number scales linearly.
//
// Run:  node src/scripts/compute-reading-time.mjs          (dry run, prints a table)
//       node src/scripts/compute-reading-time.mjs --write   (rewrites frontmatter)

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHARS_PER_MINUTE = 500;
const THAI = /[฀-๿]/g;
const WRITE = process.argv.includes("--write");

function stripFrontmatter(source) {
  const match = source.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? source.slice(match[0].length) : source;
}

function readableLines(body) {
  return body
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim() !== "")
    .map((line) =>
      line
        .replace(/\{#[^}]*\}/g, "") // heading anchors {#ch-7}
        .replace(/^\s*#{1,6}\s+/, "") // heading markers
        .replace(/^\s*>\s?/, "") // blockquote
        .replace(/^\s*[-*+]\s+/, "") // list bullets
        .replace(/^\s*:::.*$/, "") // directive fences
        .replace(/^\s*-{3,}\s*$/, ""), // horizontal rules
    )
    .filter((line) => line.trim() !== "");
}

function measure(path) {
  const source = readFileSync(path, "utf8");
  const lines = readableLines(stripFrontmatter(source));
  const joined = lines.join("");
  const readableChars = joined.replace(/\s/g, "").length;
  const thaiChars = (joined.match(THAI) || []).length;
  const readingMinutes = Math.max(1, Math.round(readableChars / CHARS_PER_MINUTE));
  const wordsThai = Math.ceil(thaiChars / 3);
  return { source, readableChars, thaiChars, readingMinutes, wordsThai };
}

function rewriteFrontmatter(source, { readingMinutes, wordsThai }) {
  let out = source;
  if (/^readingMinutes:\s*\d+/m.test(out)) {
    out = out.replace(/^readingMinutes:\s*\d+/m, `readingMinutes: ${readingMinutes}`);
  }
  if (/^wordsThai:\s*\d+/m.test(out)) {
    out = out.replace(/^wordsThai:\s*\d+/m, `wordsThai: ${wordsThai}`);
  }
  return out;
}

function run(label, dir) {
  const files = readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith(".md"))
    .sort();
  let totalMinutes = 0;
  let totalChars = 0;
  console.log(`\n==== ${label} (${CHARS_PER_MINUTE} chars/min) ====`);
  for (const file of files) {
    const path = join(ROOT, dir, file);
    const m = measure(path);
    totalMinutes += m.readingMinutes;
    totalChars += m.readableChars;
    console.log(
      `${file.padEnd(34)} chars=${String(m.readableChars).padStart(6)} -> ${String(m.readingMinutes).padStart(4)} min`,
    );
    if (WRITE) {
      writeFileSync(path, rewriteFrontmatter(m.source, m), "utf8");
    }
  }
  const h = Math.floor(totalMinutes / 60);
  const r = totalMinutes % 60;
  console.log(
    `TOTAL chars=${totalChars} minutes=${totalMinutes} (${h} ชม ${r} นาที ≈ ${(totalMinutes / 60).toFixed(1)}h)`,
  );
  return totalMinutes;
}

run("LODGE", "src/content/lodge/chapters");
run("TSUKINOMI", "src/content/tsukinomi/sections");
console.log(`\n${WRITE ? "Frontmatter updated." : "Dry run — pass --write to apply."}`);
