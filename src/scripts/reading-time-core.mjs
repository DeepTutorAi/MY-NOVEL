// Shared reading-time measurement used by compute-reading-time.mjs (Lodge and
// Tsukinomi frontmatter) and by the Sea chapter sync script.
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

export const CHARS_PER_MINUTE = 500;
const THAI = /[฀-๿]/g;

/** @param {string} source */
export function stripFrontmatter(source) {
  const match = source.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? source.slice(match[0].length) : source;
}

/** @param {string} body */
export function readableLines(body) {
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

/**
 * Measure markdown that has no frontmatter.
 * @param {string} body
 */
export function measureBody(body) {
  const joined = readableLines(body).join("");
  const readableChars = joined.replace(/\s/g, "").length;
  const thaiChars = (joined.match(THAI) || []).length;
  const readingMinutes = Math.max(1, Math.round(readableChars / CHARS_PER_MINUTE));
  const wordsThai = Math.ceil(thaiChars / 3);
  return { readableChars, thaiChars, readingMinutes, wordsThai };
}

/** @param {string} source */
export function measureMarkdown(source) {
  return measureBody(stripFrontmatter(source));
}
