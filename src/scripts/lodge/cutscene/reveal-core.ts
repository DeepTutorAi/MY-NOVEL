// Reveal of a cutscene epigraph (design section 7.1): the full text is in the
// DOM from the start; what the eye sees appears one grapheme cluster at a time,
// so a Thai vowel or tone mark never shows apart from its consonant.
import { splitGraphemes } from "../../_shared/cutscene/graphemes";

export function revealClusters(text: string): string[] {
  return splitGraphemes(text);
}

/** How many of `count` clusters are visible at `fraction` (0..1) of the reveal. */
export function visibleCount(fraction: number, count: number): number {
  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  return Math.round(f * count);
}

/**
 * The reveal changes the DOM at most every REVEAL_STEP_MS, so the epigraph's
 * text is restyled and repainted about ten times a second instead of every
 * frame (measured: per-frame updates cost more than the scene on a slow CPU).
 */
export const REVEAL_STEP_MS = 100;

export function shouldStep(shown: number, next: number, total: number, msSinceLastStep: number): boolean {
  if (next === shown) return false;
  return next === total || msSinceLastStep >= REVEAL_STEP_MS;
}
