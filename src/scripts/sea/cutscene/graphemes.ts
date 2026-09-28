// Thai-safe splitting for animated cutscene titles. Graphemes keep vowels and
// tone marks on their base consonant; words group graphemes into the units a
// line may break between, so a title wraps like text and never mid-word.

export interface TitleWord {
  text: string;
  graphemes: string[];
  /** Whitespace and punctuation-only segments: kept as plain text between words. */
  gap: boolean;
}

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

export function splitWords(text: string): TitleWord[] {
  const segments =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? Array.from(new Intl.Segmenter("th", { granularity: "word" }).segment(text), (part) => part.segment)
      : text.split(/(\s+)/).filter(Boolean);
  return segments.map((segment) => ({
    text: segment,
    graphemes: splitGraphemes(segment),
    gap: /^[\s\p{P}]+$/u.test(segment),
  }));
}

export interface SplitTitle {
  /** One element per grapheme, in reading order. */
  graphemes: HTMLElement[];
  restore(): void;
}

/**
 * Replaces the element's visible text with word/grapheme spans (aria-hidden)
 * and keeps the real text in a visually hidden span for screen readers.
 */
export function renderSplitTitle(el: HTMLElement, text = el.textContent ?? ""): SplitTitle {
  const original = Array.from(el.childNodes);
  const visible = document.createElement("span");
  visible.className = "sea-cut-split";
  visible.setAttribute("aria-hidden", "true");
  const graphemes: HTMLElement[] = [];

  for (const word of splitWords(text)) {
    const wordEl = document.createElement("span");
    wordEl.className = word.gap ? "sea-cut-gap" : "sea-cut-word";
    for (const grapheme of word.graphemes) {
      if (/^\s+$/.test(grapheme)) {
        wordEl.append(grapheme);
        continue;
      }
      const g = document.createElement("span");
      g.className = "sea-cut-g";
      g.textContent = grapheme;
      wordEl.append(g);
      graphemes.push(g);
    }
    visible.append(wordEl);
  }

  const spoken = document.createElement("span");
  spoken.className = "sea-visually-hidden";
  spoken.textContent = text;
  el.replaceChildren(visible, spoken);

  return {
    graphemes,
    restore() {
      el.replaceChildren(...original);
    },
  };
}
