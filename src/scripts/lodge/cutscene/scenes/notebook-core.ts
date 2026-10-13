// Timing of the introduction's cutscene, "the notebook" (design section 7.3):
// a closed notebook that the reader opens, or that opens by itself; the
// epigraph appears on its pages; the word "ฉัน" is in Elena's hand.
import { luminanceRamp } from "../../canvas/kit-core";

export const NOTEBOOK = {
  /** The cover turns by itself if the reader has not opened it. */
  autoOpenS: 5,
  /** How long the cover takes to turn. */
  openS: 1.6,
  /** Reveal of the epigraph, counted from the moment the cover starts to turn. */
  revealFromS: 2,
  revealToS: 9.5,
  /** The scene ends this long after the cover started to turn. */
  endAfterOpenS: 14.5,
} as const;

/** 0 shut, π fully open. `openedAt` is null until the cover starts to turn. */
export function coverAngle(t: number, openedAt: number | null): number {
  if (openedAt === null) return 0;
  return Math.PI * luminanceRamp(t - openedAt, NOTEBOOK.openS);
}

export function notebookReveal(t: number, openedAt: number): number {
  return Math.min(1, Math.max(0, (t - openedAt - NOTEBOOK.revealFromS) / (NOTEBOOK.revealToS - NOTEBOOK.revealFromS)));
}

/** Cluster ranges [start, end) that spell `word` exactly. */
export function findWordClusters(clusters: readonly string[], word: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (let start = 0; start < clusters.length; start += 1) {
    let text = "";
    for (let end = start; end < clusters.length && text.length < word.length; end += 1) {
      text += clusters[end];
      if (text === word) ranges.push([start, end + 1]);
    }
  }
  return ranges;
}

/** Brightness of the ring's glint: faint and slow, never a flash. */
export function ringGlint(t: number): number {
  return 0.04 + 0.08 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.9), 3);
}
