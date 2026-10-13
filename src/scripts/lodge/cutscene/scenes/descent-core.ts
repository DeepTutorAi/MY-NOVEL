// Rules of chapter 13's cutscene, "the descent" (design section 7.3): an old
// stone stair under the lodge, taken one step at a time by drag, wheel or
// button, or slowly by itself; carved marks answer the torch; at the bottom the
// beam's edge finds the belongings of the vanished.

export const STEPS = 12;

export const DESCENT = {
  autoFromS: 1.5,
  autoEveryS: 1.2,
  /** Camera speed toward the target step, in steps per second. */
  stepRate: 1.8,
  holdAtBottomS: 3,
  endS: 19,
  revealFromS: 1,
  revealToS: 11,
} as const;

/** Whole steps for a downward drag of `dy` pixels; dragging up never climbs. */
export function stepFromDrag(dy: number, stepPx: number): number {
  return Math.max(0, Math.floor(dy / stepPx));
}

/** The step the stair has reached by itself at time t: the reader can go faster, never slower. */
export function autoSteps(t: number): number {
  if (t < DESCENT.autoFromS) return 0;
  return Math.min(STEPS, Math.floor((t - DESCENT.autoFromS) / DESCENT.autoEveryS) + 1);
}

export function approachStep(current: number, target: number, dt: number): number {
  if (current >= target) return current;
  return Math.min(target, current + DESCENT.stepRate * dt);
}

export function hoardVisible(step: number): boolean {
  return step >= STEPS - 0.02;
}

export function descentDone(t: number, bottomAt: number | null): boolean {
  return t >= DESCENT.endS || (bottomAt !== null && t - bottomAt >= DESCENT.holdAtBottomS);
}

/** How much a carved mark answers the torch, by the angle between them around the centre of view. */
export function symbolGlow(beamAngle: number, symbolAngle: number): number {
  return Math.pow(Math.max(0, Math.cos(beamAngle - symbolAngle)), 12);
}

export function descentReveal(t: number): number {
  return Math.min(1, Math.max(0, (t - DESCENT.revealFromS) / (DESCENT.revealToS - DESCENT.revealFromS)));
}
