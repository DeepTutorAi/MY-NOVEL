// Elena's handwriting drift (design section 6.3). Chapter 18 describes it day
// by day: from day 3 "ก" flicks, by days 4 and 5 "ข" gains a stroke and "ส" a
// tail. Plain JS so both astro.config.mjs and browser code can import it.

const GLYPHS = { "ก": "k", "ข": "kh", "ส": "s" };
const DAYS = [3, 4, 5];
const segmenter = new Intl.Segmenter("th", { granularity: "grapheme" });

/**
 * Splits text into grapheme clusters (a consonant keeps its vowels and tone
 * marks) and names the drifting letter each cluster starts with. Runs of
 * other clusters are merged.
 * @param {string} text
 * @param {number} day
 * @returns {Array<{ text: string, glyph: "k" | "kh" | "s" | null }>}
 */
export function driftClusters(text, day) {
  if (!DAYS.includes(day)) throw new Error(`hand drift day must be 3, 4 or 5, got ${day}`);
  /** @type {Array<{ text: string, glyph: "k" | "kh" | "s" | null }>} */
  const out = [];
  for (const { segment } of segmenter.segment(text)) {
    const glyph = /** @type {"k" | "kh" | "s" | undefined} */ (GLYPHS[/** @type {keyof typeof GLYPHS} */ (segment[0])]) ?? null;
    const last = out[out.length - 1];
    if (!glyph && last && !last.glyph) last.text += segment;
    else out.push({ text: segment, glyph });
  }
  return out;
}
