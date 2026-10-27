// Rules of chapter 1's cutscene, "dark" (design section 7.3, revised by the
// author): no picture, only the epigraph on black, revealed and then held long
// enough to read before the chapter opens.

export const DARK = {
  revealFromS: 1,
  revealToS: 11,
  endS: 16,
} as const;

export function darkReveal(t: number): number {
  return Math.min(1, Math.max(0, (t - DARK.revealFromS) / (DARK.revealToS - DARK.revealFromS)));
}
