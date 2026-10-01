// Thai-safe splitting for animated cutscene titles. Graphemes keep vowels and
// tone marks on their base consonant; words group graphemes into the units a
// line may break between, so a title wraps like text and never mid-word.

// splitGraphemes lives in src/scripts/_shared/cutscene/graphemes.ts, shared with
// Tsukinomi's cutscene scenes; it is re-exported here so Sea's imports stay as
// they were.
import { splitGraphemes } from "../../_shared/cutscene/graphemes";

export { splitGraphemes };

export interface TitleWord {
  text: string;
  graphemes: string[];
  /** Whitespace and punctuation-only segments: kept as plain text between words. */
  gap: boolean;
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
