// Thai-safe splitting of a string into user-perceived characters, for scenes
// that animate text one character at a time. A grapheme keeps vowels and tone
// marks on their base consonant: splitting a Thai string with split("") puts
// a combining mark in a span of its own, which is painted apart from (and
// shaped without) its consonant.
//
// Sea's src/scripts/sea/cutscene/graphemes.ts re-exports splitGraphemes from
// here and adds the word grouping it needs for title wrapping.

// Combining Thai signs that belong to the preceding letter (used only when
// Intl.Segmenter is unavailable): mai han-akat, sara am, upper/lower vowels,
// tone marks and other diacritics.
const THAI_MARK = /[ัำ-ฺ็-๎]/;

export function splitGraphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("th", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (part) => part.segment);
  }
  const out: string[] = [];
  for (const char of text) {
    if (out.length > 0 && THAI_MARK.test(char)) out[out.length - 1] += char;
    else out.push(char);
  }
  return out;
}
