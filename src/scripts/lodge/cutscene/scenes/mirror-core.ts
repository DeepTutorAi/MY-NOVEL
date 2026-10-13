// Rules of chapter 18's cutscene, "the mirror" (design section 7.3): the
// reflection of the epigraph follows the reader half a second late, then turns
// to lead them; its text finishes first; at the end it turns the right way
// round and settles onto the real text.
import { luminanceRamp } from "../../canvas/kit-core";

export const MIRROR = {
  lagS: 0.5,
  leadS: 0.25,
  turnFromS: 12,
  turnS: 2,
  revealFromS: 1,
  revealToS: 12,
  mirrorRevealToS: 10.5,
  mergeFromS: 15.5,
  mergeAtS: 17,
  endS: 19,
} as const;

/** Seconds the reflection is behind the reader; negative once it leads. */
export function reflectionLag(t: number): number {
  return MIRROR.lagS - (MIRROR.lagS + MIRROR.leadS) * luminanceRamp(t - MIRROR.turnFromS, MIRROR.turnS);
}

export function realReveal(t: number): number {
  return Math.min(1, Math.max(0, (t - MIRROR.revealFromS) / (MIRROR.revealToS - MIRROR.revealFromS)));
}

export function mirrorReveal(t: number): number {
  return Math.min(1, Math.max(0, (t - MIRROR.revealFromS) / (MIRROR.mirrorRevealToS - MIRROR.revealFromS)));
}

/** 0 a mirrored ghost beside the text, 1 turned the right way and lying on it. */
export function mergeAmount(t: number): number {
  return luminanceRamp(t - MIRROR.mergeFromS, MIRROR.mergeAtS - MIRROR.mergeFromS);
}

/** Where the reader's stand-in drifts when there is no pointer, in screen fractions. */
export function autoSelf(t: number): { x: number; y: number } {
  return { x: 0.5 + 0.15 * Math.sin(t * 0.45), y: 0.5 + 0.1 * Math.sin(t * 0.7 + 1) };
}
