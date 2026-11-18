// Quality governor for hub scenes (spec 2.12 and 8.4 item 4). Pure: the kit feeds it
// the measured render time and the interval between drawn frames.

import type { Governor, GovernorStats, Tier, TierEnv } from "./types";

export const EMA_ALPHA = 0.05;
/** Step down when the draw EMA stays above this for DOWN_FRAMES frames. */
export const DOWN_MS = 5.0;
export const DOWN_FRAMES = 90;
/** Step up (never above the start tier) when the EMA stays below this for UP_HOLD_MS. */
export const UP_MS = 2.6;
export const UP_HOLD_MS = 6000;
/** At most one tier change per this many ms. */
export const CHANGE_GAP_MS = 10000;
/** Frame-drop signal: p90 of the last DROP_WINDOW intervals above DROP_FACTOR x the vsync estimate. */
export const DROP_WINDOW = 120;
export const DROP_FACTOR = 1.5;

/** Intervals longer than this are pauses (hidden tab, stopped loop), not dropped frames. */
const PAUSE_MS = 1000;
/** Draw samples kept for the p95 statistic. */
const P95_WINDOW = 240;

export function startTier(env: TierEnv): Tier {
  if (env.saveData) return 2;
  if (env.coarse) return 1;
  if (env.deviceMemory !== undefined && env.deviceMemory <= 4) return 1;
  if (env.hardwareConcurrency !== undefined && env.hardwareConcurrency <= 4) return 1;
  return 0;
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

export function createGovernor(start: Tier): Governor {
  let tier: Tier = start;
  let frames = 0;
  let dropped = 0;
  let sum = 0;
  let ema = 0;
  let above = 0;
  let belowSince: number | null = null;
  let lastChange = -Infinity;
  let vsync = Infinity;
  const draws: number[] = [];
  let intervals: number[] = [];

  const change = (next: Tier, nowMs: number) => {
    tier = next;
    lastChange = nowMs;
    above = 0;
    belowSince = null;
    intervals = [];
  };

  return {
    get tier() {
      return tier;
    },

    sample(drawMs, intervalMs, nowMs) {
      frames++;
      sum += drawMs;
      ema = frames === 1 ? drawMs : ema + EMA_ALPHA * (drawMs - ema);
      draws.push(drawMs);
      if (draws.length > P95_WINDOW) draws.shift();

      if (intervalMs > 0 && intervalMs < PAUSE_MS) {
        vsync = Math.min(vsync, intervalMs);
        if (intervalMs > DROP_FACTOR * vsync) dropped++;
        intervals.push(intervalMs);
        if (intervals.length > DROP_WINDOW) intervals.shift();
      }

      above = ema > DOWN_MS ? above + 1 : 0;
      if (ema < UP_MS) belowSince ??= nowMs;
      else belowSince = null;

      if (nowMs - lastChange < CHANGE_GAP_MS) return tier;

      const slow = above >= DOWN_FRAMES;
      const dropping =
        ema <= DOWN_MS && intervals.length >= DROP_WINDOW && percentile(intervals, 0.9) > DROP_FACTOR * vsync;
      if ((slow || dropping) && tier < 2) {
        change((tier + 1) as Tier, nowMs);
      } else if (belowSince !== null && nowMs - belowSince >= UP_HOLD_MS && tier > start) {
        change((tier - 1) as Tier, nowMs);
      }
      return tier;
    },

    stats(): GovernorStats {
      return {
        tier,
        drawMsMean: frames > 0 ? sum / frames : 0,
        drawMsEma: ema,
        drawMsP95: percentile(draws, 0.95),
        frames,
        dropped,
      };
    },
  };
}
