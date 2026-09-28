// Pure timing of the /sea/ home ascent. Scroll progress p (0-1 across the
// hero track) moves through five stages; each owns one atmosphere profile.
import type { SeaZone } from "../../../data/sea/zones";

export const ASCENT_STAGES = {
  ground: [0, 0.1],
  rise: [0.1, 0.35],
  shroud: [0.35, 0.6],
  breach: [0.6, 0.8],
  ceiling: [0.8, 1],
} as const satisfies Record<string, readonly [number, number]>;

const ramp = (p: number, from: number, to: number) => Math.min(1, Math.max(0, (p - from) / (to - from)));

/**
 * Atmosphere override for a progress value: Elaris rain that thins as the
 * ground falls away, Shroud motes and fog banks (no rain), then condensation
 * drips under the water ceiling.
 */
export function atmosphereAt(p: number): [SeaZone, number] {
  if (p < ASCENT_STAGES.rise[1]) return ["elaris", 1 - 0.8 * ramp(p, ...ASCENT_STAGES.rise)];
  if (p < 0.7) return ["shroud", 0.35 + 0.65 * ramp(p, 0.35, 0.45) - 0.4 * ramp(p, 0.6, 0.7)];
  return ["air-shelf", 0.3 + 0.7 * ramp(p, 0.7, 0.9)];
}

/** Atmosphere once the table of contents has taken over the viewport. */
export const AFTER_HERO_ATMOSPHERE: [SeaZone, number] = ["air-shelf", 0.3];
