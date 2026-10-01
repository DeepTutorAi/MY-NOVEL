// Timing of the placeholder plate reveal (plate-reveal.ts), kept apart from it
// because it is pure: plate-reveal.ts imports a stylesheet, which node:test
// cannot load.

/** Delay between two consecutive characters appearing. */
export const STAGGER_MS = 45;
/** How long one character takes to go from blurred and transparent to sharp. */
export const FADE_MS = 900;

const HOLD_BASE_MS = 1800;
const HOLD_PER_CLUSTER_MS = 18;
const HOLD_MIN_MS = 3000;
const HOLD_MAX_MS = 7000;

export interface RevealTiming {
  clusters: number;
  /** From the first character starting to the last one finishing. */
  revealMs: number;
  /** How long the finished text stays before the scene ends. */
  holdMs: number;
  totalMs: number;
}

/**
 * Runtime of the reveal for an epigraph of `clusters` characters: the reveal
 * itself plus a hold that grows with the length, so a long epigraph is given
 * time to be read. About 9 s for the prologue's epigraph and 15 to 16 s for
 * each part's.
 */
export function revealTiming(clusters: number): RevealTiming {
  const count = Number.isFinite(clusters) ? Math.max(0, Math.floor(clusters)) : 0;
  const revealMs = count === 0 ? 0 : (count - 1) * STAGGER_MS + FADE_MS;
  const holdMs = Math.min(HOLD_MAX_MS, Math.max(HOLD_MIN_MS, HOLD_BASE_MS + count * HOLD_PER_CLUSTER_MS));
  return { clusters: count, revealMs, holdMs, totalMs: revealMs + holdMs };
}
