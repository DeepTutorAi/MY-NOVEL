// Rules of the text size and line spacing settings on Lodge and Tsukinomi. The steps are
// Kusabi's. "normal" means the novel's own type, so no attribute is set for it.

export const FONT_STEPS = ["small", "normal", "large", "xl"] as const;
export const LINE_STEPS = ["normal", "loose"] as const;

export type FontStep = (typeof FONT_STEPS)[number];
export type LineStep = (typeof LINE_STEPS)[number];
export type ReaderTypeNovel = "lodge" | "tsukinomi";

export const READER_TYPE_EVENT = "reader-type-change";

/** Where the reading is on screen. Tsukinomi counts a chapter as finished at this same line. */
export const READING_LINE = 0.35;

export const fontKey = (novel: ReaderTypeNovel) => `${novel}:settings:font-size`;
export const lineKey = (novel: ReaderTypeNovel) => `${novel}:settings:line-height`;

export function toFontStep(value: string | null): FontStep {
  return (FONT_STEPS as readonly string[]).includes(value ?? "") ? (value as FontStep) : "normal";
}

export function toLineStep(value: string | null): LineStep {
  return value === "loose" ? "loose" : "normal";
}

export interface BlockBox {
  top: number;
  height: number;
}

/**
 * How far to scroll so the same point of a block stays on the reading line after its height
 * changes. Text below that point therefore stays below the line: a smaller size cannot carry an
 * unread heading past it and mark that chapter finished.
 */
export function readingLineShift(before: BlockBox, after: BlockBox, line: number): number {
  const into = before.height > 0 ? Math.min(1, Math.max(0, (line - before.top) / before.height)) : 0;
  return after.top + into * after.height - line;
}
