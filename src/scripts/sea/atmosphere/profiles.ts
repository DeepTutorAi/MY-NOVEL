import type { SeaZone } from "../../../data/sea/zones";

// Particle kinds understood by the atmosphere engine. The numeric id indexes
// the engine's struct-of-arrays pools and per-kind state vectors.
export const PARTICLE_KINDS = ["rain", "drop", "mote", "drip", "dust", "spore", "bubble"] as const;
export type ParticleKind = (typeof PARTICLE_KINDS)[number];
export const KIND_COUNT = PARTICLE_KINDS.length;

// Palette tokens read from body custom properties once per zone change.
export const PALETTE_TOKENS = {
  accent: "--accent-cyan",
  copper: "--accent-copper",
  muted: "--sea-ink-muted",
  ink: "--sea-ink",
  night: "--bg-sea-night",
} as const;
export type PaletteToken = keyof typeof PALETTE_TOKENS;

// A kind's color is mix(from, to, amount) of two palette tokens.
export type Tint = readonly [from: PaletteToken, to: PaletteToken, amount: number];

export interface KindSpec {
  /** Share of the profile's particle slots; shares within a profile sum to 1. */
  share: number;
  tint: Tint;
}

export interface AtmosphereProfile {
  /** Fraction of the device particle budget in use. */
  density: number;
  kinds: Partial<Record<ParticleKind, KindSpec>>;
  /** Number of drifting pre-rendered fog sprites (0-8). */
  fog: number;
  /** Strength of the green-black glow band hanging from the top edge (0-1). */
  glow: number;
  /** Overall light multiplier; falls with depth inside the sea. */
  light: number;
}

export const MAX_FOG_SPRITES = 8;

const rising = (density: number, light: number, tint: Tint): AtmosphereProfile => ({
  density,
  kinds: { bubble: { share: 1, tint } },
  fog: 0,
  glow: 0,
  light,
});

// One profile per canon zone. Each exists for a narrative reason, not decoration.
export const ATMOSPHERE_PROFILES: Record<SeaZone, AtmosphereProfile> = {
  // Elaris lives under a sky that leaks: thin slanted brine rain, cyan-grey,
  // with the occasional heavier drop.
  elaris: {
    density: 0.85,
    kinds: {
      rain: { share: 0.93, tint: ["muted", "accent", 0.3] },
      drop: { share: 0.07, tint: ["ink", "accent", 0.25] },
    },
    fog: 0,
    glow: 0,
    light: 1,
  },
  // The Shroud hides both ground and sea: no rain, only slow lateral motes
  // and a few banks of fog crossing the frame.
  shroud: {
    density: 0.45,
    kinds: { mote: { share: 1, tint: ["muted", "ink", 0.35] } },
    fog: 6,
    glow: 0,
    light: 1,
  },
  // Under the water ceiling the sea is directly overhead: sparse drips of
  // condensation fall from the top edge under a faint green-black glow.
  "air-shelf": {
    density: 0.3,
    kinds: { drip: { share: 1, tint: ["accent", "ink", 0.35] } },
    fog: 0,
    glow: 1,
    light: 1,
  },
  // The Ministry of Dry Earth: no water at all, only drifting ochre dust.
  capital: {
    density: 0.5,
    kinds: { dust: { share: 1, tint: ["copper", "muted", 0.3] } },
    fog: 0,
    glow: 0,
    light: 1,
  },
  // Mistwood breathes upward: slow muted-green spores.
  mistwood: {
    density: 0.45,
    kinds: { spore: { share: 1, tint: ["accent", "muted", 0.45] } },
    fog: 2,
    glow: 0,
    light: 0.9,
  },
  // Inside the sea: rising particles whose light fades layer by layer.
  "sun-sheet": rising(0.6, 1, ["accent", "ink", 0.35]),
  "drowned-quarter": rising(0.5, 0.8, ["accent", "muted", 0.3]),
  "pressure-veil": rising(0.42, 0.6, ["accent", "night", 0.25]),
  "old-pressure": rising(0.32, 0.42, ["accent", "night", 0.4]),
  "first-memory": rising(0.24, 0.3, ["accent", "ink", 0.2]),
};
