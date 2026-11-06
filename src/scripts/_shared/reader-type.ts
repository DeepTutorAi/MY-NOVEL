// Binds the controls in ReaderTypeControls.astro. ReaderTypeHead.astro applies the saved values
// before first paint; this applies a change and keeps the reader's place in the text.
import {
  READER_TYPE_EVENT,
  READING_LINE,
  fontKey,
  lineKey,
  readingLineShift,
  toFontStep,
  toLineStep,
  type ReaderTypeNovel,
} from "./reader-type-core";

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Restricted storage: the setting still applies to this page.
  }
};

const setStep = (name: string, value: string): void => {
  const root = document.documentElement;
  if (value === "normal") root.removeAttribute(name);
  else root.setAttribute(name, value);
};

/** The last block that has reached the reading line, or the first block when none has. */
const blockOnLine = (article: Element, line: number): Element | null => {
  let found: Element | null = null;
  for (const block of article.children) {
    if (!found) found = block;
    if (block.getBoundingClientRect().top > line) break;
    found = block;
  }
  return found;
};

const keepReadingPlace = (apply: () => void): void => {
  const article = document.querySelector("article.chapter, article.tsukinomi-section");
  const line = window.innerHeight * READING_LINE;
  const block = article ? blockOnLine(article, line) : null;
  const before = block?.getBoundingClientRect();
  apply();
  if (block && before) {
    const shift = readingLineShift(before, block.getBoundingClientRect(), line);
    if (shift !== 0) window.scrollBy({ top: shift, behavior: "instant" });
  }
  // A custom event, because a real resize would also rebuild the snow and the sky.
  window.dispatchEvent(new CustomEvent(READER_TYPE_EVENT));
};

const bindOne = (root: HTMLElement): void => {
  const novel = root.dataset.readerType as ReaderTypeNovel;
  const check = (group: string, value: string) => {
    const input = root.querySelector<HTMLInputElement>(`input[data-reader-${group}][value="${value}"]`);
    if (input) input.checked = true;
  };
  check("font", toFontStep(read(fontKey(novel))));
  check("line", toLineStep(read(lineKey(novel))));

  if (root.dataset.bound === "true") return;
  root.dataset.bound = "true";
  root.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.checked) return;
    if (input.hasAttribute("data-reader-font")) {
      const step = toFontStep(input.value);
      write(fontKey(novel), step);
      keepReadingPlace(() => setStep(`data-${novel}-font`, step));
    } else if (input.hasAttribute("data-reader-line")) {
      const step = toLineStep(input.value);
      write(lineKey(novel), step);
      keepReadingPlace(() => setStep(`data-${novel}-lh`, step));
    }
  });
};

export function bindReaderTypeControls(): void {
  document.querySelectorAll<HTMLElement>("[data-reader-type]").forEach(bindOne);
}
