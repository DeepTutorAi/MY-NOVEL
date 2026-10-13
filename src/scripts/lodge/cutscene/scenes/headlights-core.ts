// Rules of chapter 1's cutscene, "headlights" (design section 7.3): a night
// drive into the storm. The high beam reaches further and, while it does, seven
// trunks that are too thin stand in the treeline; with the beam low they are
// gone. Near the end the lodge's lights appear ahead.
import { luminanceRamp } from "../../canvas/kit-core";

export const HEADLIGHTS = {
  revealFromS: 1,
  revealToS: 11,
  lodgeLightAtS: 15,
  lodgeLightRampS: 1.5,
  endS: 19,
  /** Seconds the beam takes from low to high: a large luminance change, so at least 1 s (design 3.3). */
  beamSwingS: 1,
} as const;

export const TRUNK_COUNT = 7;
const LOW = 0.35;
const HIGH = 0.85;
const TRUNKS_FROM = 0.7;

/** How far the beam reaches, as a fraction of the way to the horizon. */
export function beamTarget(high: boolean): number {
  return high ? HIGH : LOW;
}

export function approachBeam(current: number, high: boolean, dt: number): number {
  const target = beamTarget(high);
  const step = ((HIGH - LOW) / HEADLIGHTS.beamSwingS) * dt;
  return current < target ? Math.min(target, current + step) : Math.max(target, current - step);
}

export function trunkVisible(beam: number): boolean {
  return beam >= TRUNKS_FROM;
}

export function headlightsReveal(t: number): number {
  return Math.min(1, Math.max(0, (t - HEADLIGHTS.revealFromS) / (HEADLIGHTS.revealToS - HEADLIGHTS.revealFromS)));
}

export function lodgeLight(t: number): number {
  return luminanceRamp(t - HEADLIGHTS.lodgeLightAtS, HEADLIGHTS.lodgeLightRampS);
}

export interface Point3 {
  /** Metres right of the road's centre line. */
  x: number;
  /** Metres above the road. */
  y: number;
  /** Metres ahead of the camera. */
  z: number;
}

/** Perspective from the driver's seat: vanishing point at (0.5 w, 0.34 h), above the epigraph; camera 1.2 m above the road. */
export function project(p: Point3, w: number, h: number): { x: number; y: number; scale: number } {
  const focal = Math.max(w, h) * 0.62;
  const scale = focal / Math.max(0.1, p.z);
  return { x: w * 0.5 + p.x * scale, y: h * 0.34 + (1.2 - p.y) * scale, scale };
}
