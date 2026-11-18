// Pure pass/fail rules of hub-measure, kept apart so they can be tested without a browser.

export interface LongTask {
  start: number;
  duration: number;
}

/** A cheap scene may hold tier 0 under 4x CPU: its throttled mean is at or below this. */
export const THROTTLE_HOLD_MS = 5;

/**
 * Long tasks the theme answers for: those over minMs that start once the scene reported
 * hub:scene. Tasks before it (page parse, style, router, module load) are reported apart.
 * Without a hub:scene time every task counts, as before.
 */
export function splitLongTasks(tasks: readonly LongTask[], sceneAt: number | null, minMs: number): { scene: LongTask[]; load: LongTask[] } {
  const long = tasks.filter((t) => t.duration > minMs);
  if (sceneAt === null) return { scene: long, load: [] };
  return { scene: long.filter((t) => t.start >= sceneAt), load: long.filter((t) => t.start < sceneAt) };
}

export interface ThrottleResult {
  reachedTierMs: number | null;
  finalTier: number | null;
  drawMsMean: number | null;
}

/**
 * The 4x CPU gate: the governor steps to tier 1 within 5 s, or the scene is cheap enough that
 * it never needs to (final tier 0 with a mean at or below THROTTLE_HOLD_MS). The mean must stay
 * within maxMeanMs either way.
 */
export function throttleFailures(theme: string, t: ThrottleResult, maxMeanMs: number): string[] {
  const failures: string[] = [];
  const reached = t.reachedTierMs !== null && t.reachedTierMs <= 5000;
  const held = t.finalTier === 0 && t.drawMsMean !== null && t.drawMsMean <= THROTTLE_HOLD_MS;
  if (!reached && !held) {
    failures.push(`${theme}: 4x CPU did not reach tier 1 within 5 s (final tier ${t.finalTier}, mean ${t.drawMsMean ?? "-"} ms > ${THROTTLE_HOLD_MS} ms hold)`);
  }
  if (t.drawMsMean !== null && t.drawMsMean > maxMeanMs) failures.push(`${theme}: 4x CPU mean draw ${t.drawMsMean} ms > ${maxMeanMs} ms`);
  return failures;
}
