// Rules of the home page whiteout (design section 5.1): footprints, the
// follower that retraces them, the shadows at the treeline and the gusts.
// Pure, so the canon gates and the no-flash limits are tested without a canvas.
import { luminanceRamp } from "../canvas/kit-core";
import type { DriftLevel } from "../progress-core";

export const STRIDE_PX = 34;
export const PRINT_FADE_S = 8;
/** How far behind the follower walks, by drift level (design 5.1). */
export const FOLLOW_DELAY_S: Readonly<Record<2 | 3, number>> = { 2: 0.5, 3: 0.3 };
export const STILL_TURN_S = 3;
const TURN_STAGGER_S = 0.4;
const TURN_LENGTH_S = 0.8;
export const GUST_EVERY_S: readonly [number, number] = [25, 45];
export const GUST_LENGTH_S: readonly [number, number] = [2, 3];
/** Peak veil opacity. With a rise of at least 1 s the slope stays under 1 per second. */
const GUST_PEAK = 0.55;

export interface PathPoint {
  x: number;
  y: number;
  t: number;
}

export interface Step extends PathPoint {
  /** Walking direction in radians. */
  angle: number;
  side: "L" | "R";
}

export interface Gust {
  at: number;
  length: number;
}

export function placeSteps(path: readonly PathPoint[], stride: number): Step[] {
  const steps: Step[] = [];
  let travelled = 0;
  let nextAt = 0;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0) continue;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    while (nextAt < travelled + length) {
      const f = (nextAt - travelled) / length;
      steps.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, t: a.t + (b.t - a.t) * f, angle, side: steps.length % 2 === 0 ? "L" : "R" });
      nextAt += stride;
    }
    travelled += length;
  }
  return travelled < stride ? [] : steps;
}

export function printAlpha(ageS: number): number {
  return Math.min(1, Math.max(0, 1 - ageS / PRINT_FADE_S));
}

export function followerSteps(steps: readonly Step[], level: DriftLevel, nowS: number): Step[] {
  if (level !== 2 && level !== 3) return [];
  const delay = FOLLOW_DELAY_S[level];
  return steps.filter((step) => step.t + delay <= nowS + 1e-9).map((step) => ({ ...step, t: step.t + delay }));
}

export function shadowCount(level: DriftLevel): number {
  return level === 2 ? 7 : level === 3 ? 6 : 0;
}

/** 0 facing away, 1 facing the viewer. */
export function shadowTurn(stillForS: number, index: number): number {
  return luminanceRamp(stillForS - STILL_TURN_S - index * TURN_STAGGER_S, TURN_LENGTH_S);
}

export function gustVeil(tS: number, schedule: readonly Gust[]): number {
  let veil = 0;
  for (const gust of schedule) {
    const u = (tS - gust.at) / gust.length;
    if (u <= 0 || u >= 1) continue;
    const half = gust.length / 2;
    const value = u < 0.5 ? luminanceRamp(tS - gust.at, half) : luminanceRamp(gust.at + gust.length - tS, half);
    veil = Math.max(veil, value * GUST_PEAK);
  }
  return veil;
}

export function nextGustAt(rng: () => number, afterS: number): number {
  return afterS + GUST_EVERY_S[0] + rng() * (GUST_EVERY_S[1] - GUST_EVERY_S[0]);
}

export function gustLength(rng: () => number): number {
  return GUST_LENGTH_S[0] + rng() * (GUST_LENGTH_S[1] - GUST_LENGTH_S[0]);
}
