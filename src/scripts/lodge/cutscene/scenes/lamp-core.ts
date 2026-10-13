// Rules of chapter 6's cutscene, "the lamp" (design section 7.3): the living
// room of plate 06A in darkness, a hand-held light that shows what it touches.
// Everywhere the dark returns at once; where Ben sits the light stays half a
// second too long.

export const LAMP = {
  /** Radius of the light, as a fraction of the shorter side of the screen. */
  radius: 0.24,
  fadeS: 0.12,
  lingerS: 0.5,
  /** How often the light's past positions are kept. */
  trailEveryS: 0.04,
  revealFromS: 1,
  revealToS: 11,
  endS: 18,
} as const;

/** Ben on the sofa, in fractions of plate 06A (1672 x 941). */
const BEN = { u0: 0.32, u1: 0.56, v0: 0.18, v1: 0.86 };

export function inBen(u: number, v: number): boolean {
  return u >= BEN.u0 && u <= BEN.u1 && v >= BEN.v0 && v <= BEN.v1;
}

/** How much of the light is left at a place it left `ageS` ago. */
export function trailAlpha(ageS: number, onBen: boolean): number {
  const span = onBen ? LAMP.lingerS : LAMP.fadeS;
  return Math.min(1, Math.max(0, 1 - ageS / span));
}

/**
 * Where the light wanders when nobody holds it, in fractions of the screen (not
 * of the plate: a narrow screen shows a slice of it). It passes through the
 * middle, where the crop keeps Ben.
 */
export function autoPath(t: number): { x: number; y: number } {
  return { x: 0.5 + 0.34 * Math.sin(t * 0.33 - 0.6), y: 0.46 + 0.14 * Math.sin(t * 0.57 + 1) };
}

/** Radius of the light in CSS pixels: from the shorter side, or the longer one on a tall phone. */
export function lampRadius(w: number, h: number): number {
  const short = Math.min(w, h);
  const long = Math.max(w, h);
  return long / short > 1.7 ? long * 0.16 : short * LAMP.radius;
}

/**
 * The lamp follows the pointer at most two of its own widths per second. A
 * light that jumped with the pointer could be waved fast enough to light and
 * darken a large area several times a second (a general flash, WCAG 2.3.1);
 * at this speed any point changes at most about once a second.
 */
export function followLamp(current: { x: number; y: number }, target: { x: number; y: number }, radius: number, dt: number): { x: number; y: number } {
  const maxStep = 4 * radius * dt;
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= maxStep) return { x: target.x, y: target.y };
  return { x: current.x + (dx / distance) * maxStep, y: current.y + (dy / distance) * maxStep };
}

/** Slow breathing of the fire's glow, around 1. */
export function firelight(t: number): number {
  return 1 + 0.04 * Math.sin(t * 0.8) + 0.02 * Math.sin(t * 1.3 + 1);
}

export function lampReveal(t: number): number {
  return Math.min(1, Math.max(0, (t - LAMP.revealFromS) / (LAMP.revealToS - LAMP.revealFromS)));
}
