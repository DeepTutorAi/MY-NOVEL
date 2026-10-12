// The pure rules of the round-two cutscenes (parts 2 to 5): their timelines,
// how time runs in part 2's tape dropout, how part 3's photograph fades and how
// holding it slows that, where part 4's snow gathers into the epigraph, and how
// part 5's ten years pass. No DOM, no canvas, no clock, so node --test covers it.
// The scene modules (part-2-twilight-lamp.ts ...) paint what these decide.

export function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

/** Where `t` is between `start` and `end`, 0 to 1. */
export function phase(t: number, start: number, end: number): number {
  if (!Number.isFinite(t)) return 0;
  if (end <= start) return t >= end ? 1 : 0;
  return clamp((t - start) / (end - start), 0, 1);
}

export function smooth(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Fades in over [a, b] and out over [c, d]. */
export function envelope(t: number, a: number, b: number, c: number, d: number): number {
  return smooth(phase(t, a, b)) * (1 - smooth(phase(t, c, d)));
}

// ---- part 2: the twilight lamp -------------------------------------------------
//
// Petals fall under the lamp; the bench and every petal cast a shadow away from
// the lamp, the girl on the bench casts none. Then the tape drops out: the
// picture tears into sideways bands, the petals stop, the epigraph's letters
// scatter. The tape rewinds: everything runs backwards, fast, the letters fly
// home. Then time runs forward again.

export const P2 = {
  /** The epigraph is fully in by this time, so it is read before the tape fails. */
  textInEnd: 3.2,
  dropoutStart: 8.4,
  dropoutEnd: 10.4,
  rewindEnd: 12.6,
  end: 21,
} as const;

/**
 * How fast and which way the scene's time runs at `t`: 1 forward, 0 stopped,
 * negative backwards. It eases to a stop as the tape drops out, runs back at
 * up to REWIND_SPEED during the rewind and eases forward again.
 */
export const REWIND_SPEED = 3.2;
export function p2TimeFlow(t: number): number {
  if (t < P2.dropoutStart) return 1;
  if (t < P2.dropoutEnd) return 1 - smooth(phase(t, P2.dropoutStart, P2.dropoutStart + 0.7));
  if (t < P2.rewindEnd) {
    const k = phase(t, P2.dropoutEnd, P2.rewindEnd);
    return -REWIND_SPEED * Math.sin(Math.PI * k);
  }
  return smooth(phase(t, P2.rewindEnd, P2.rewindEnd + 1.2));
}

/** How far the epigraph's letters have scattered, 0 (home) to 1. */
export function p2Scatter(t: number): number {
  if (t < P2.dropoutStart + 0.3) return 0;
  if (t < P2.dropoutEnd) return smooth(phase(t, P2.dropoutStart + 0.3, P2.dropoutEnd - 0.4));
  return 1 - smooth(phase(t, P2.dropoutEnd + 0.2, P2.rewindEnd - 0.2));
}

/** Strength of the tape's tearing bands, 0 to 1. */
export function p2Tear(t: number): number {
  return envelope(t, P2.dropoutStart, P2.dropoutStart + 0.5, P2.rewindEnd - 0.6, P2.rewindEnd + 0.3);
}

export interface TearBand {
  /** Top of the band, as a fraction of the screen height. */
  y: number;
  /** Height as a fraction of the screen height. */
  h: number;
  /** Sideways shift as a fraction of the screen width (sign is direction). */
  shift: number;
}

/**
 * The tearing bands at `t`. They change a few times a second (BAND_RATE), not
 * every frame: they shift the picture sideways and never change its
 * brightness, so the tear cannot flash (WCAG 2.3.1 counts brightness changes).
 */
export const BAND_RATE = 3;
export function tearBands(t: number, strength: number, random: (seed: number) => number): TearBand[] {
  if (!(strength > 0)) return [];
  const step = Math.floor(t * BAND_RATE);
  const count = 2 + Math.floor(random(step * 7 + 1) * 3);
  const bands: TearBand[] = [];
  for (let i = 0; i < count; i++) {
    const r = (k: number) => random(step * 97 + i * 13 + k);
    bands.push({
      y: r(1) * 0.92,
      h: (0.015 + r(2) * 0.06) * (0.6 + strength * 0.4),
      shift: (r(3) - 0.5) * 0.09 * strength,
    });
  }
  return bands;
}

/** A small deterministic hash to [0, 1), so the bands are the same for the same instant. */
export function hash01(n: number): number {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// ---- part 3: the warm room ------------------------------------------------------
//
// A photograph of the station lies on the table. Sunlight eats it: the picture
// fades towards white. Holding it (a press anywhere, or the control) slows the
// fading to a trickle; letting go lets it fade. The scene ends on time whatever
// the reader does: the choice is the reader's own, the story does not change.

export const P3 = {
  textInEnd: 3.4,
  /** The photograph starts to fade. */
  fadeStart: 2.6,
  /** Without holding, fully faded this long after fadeStart. */
  fadeSeconds: 9,
  /** Holding makes the fading this much slower. */
  holdSlowdown: 7,
  end: 17.5,
} as const;

/** The photograph's fade (0 sharp to 1 gone) after `dt` more seconds, holding or not. */
export function fadeStep(level: number, dt: number, holding: boolean, t: number): number {
  const base = clamp(Number.isFinite(level) ? level : 0, 0, 1);
  if (!(dt > 0) || t < P3.fadeStart) return base;
  const rate = 1 / P3.fadeSeconds / (holding ? P3.holdSlowdown : 1);
  return clamp(base + dt * rate, 0, 1);
}

// ---- part 4: the snow pact ------------------------------------------------------
//
// A blizzard up the mountain. Lamps light one by one up the path. Snow gathers
// into the shape of the epigraph's letters behind the real text, holds, and is
// blown apart; the real text stays. A spider lily glows in the snow below.

export const P4 = {
  lampsStart: 1.6,
  lampsEnd: 7.5,
  gatherStart: 2.6,
  gatherEnd: 6.6,
  /** The real text comes up over the settled snow, which dims under it. */
  textInStart: 7.2,
  textInEnd: 9.8,
  holdEnd: 14,
  scatterEnd: 16.6,
  lilyStart: 14.4,
  end: 24,
} as const;

/** How bright the settled snow letters are: full while they are all there is, faint once the real text is up. */
export function p4LetterGlow(t: number): number {
  return 1 - 0.78 * smooth(phase(t, P4.textInStart, P4.textInEnd));
}

/** How strongly a gathering flake is pulled to its place in the letters, 0 to 1. */
export function p4Gather(t: number): number {
  if (t < P4.gatherStart) return 0;
  if (t < P4.holdEnd) return smooth(phase(t, P4.gatherStart, P4.gatherEnd));
  return 1 - smooth(phase(t, P4.holdEnd, P4.holdEnd + 0.5));
}

/**
 * Places for the gathering snow: points on a `step` grid where the letters'
 * coverage (`alpha`, one byte per pixel, row-major) is at least half, thinned
 * evenly to at most `max`.
 */
export function sampleTargets(alpha: ArrayLike<number>, width: number, height: number, step: number, max: number): Array<{ x: number; y: number }> {
  const s = Math.max(1, Math.floor(step));
  const points: Array<{ x: number; y: number }> = [];
  if (!(width > 0 && height > 0) || alpha.length < width * height) return points;
  for (let y = Math.floor(s / 2); y < height; y += s) {
    for (let x = Math.floor(s / 2); x < width; x += s) {
      if (alpha[y * width + x] >= 128) points.push({ x, y });
    }
  }
  if (points.length <= max || max <= 0) return max <= 0 ? [] : points;
  const out: Array<{ x: number; y: number }> = [];
  const stride = points.length / max;
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * stride)]);
  return out;
}

// ---- part 5: winter light ------------------------------------------------------
//
// Ten years in a few seconds, at the place where the station stood: the
// seasons wash over the clearing again and again (spring, summer, autumn,
// winter) while the wooden sign stays where it is. The wind carries one thread
// of the old song (a line of light, the earphone's wire) and one sakura petal
// through; the seasons come to rest on this winter's dawn, and the light comes up.

export const P5 = {
  textInStart: 1.2,
  textInEnd: 4.4,
  /** The years pass: the seasons turn this many times. */
  yearsStart: 0.4,
  yearsEnd: 10.4,
  years: 2,
  /** The wind and the thread of the song cross the screen. */
  threadStart: 7.2,
  threadEnd: 12.4,
  /** The winter dawn comes up as the years come to rest. */
  dawnStart: 9.6,
  dawnEnd: 14.2,
  end: 22,
} as const;

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

/**
 * Where the turning year is at `t`: the season and the share of the way into
 * the next (0..1, eased so a season holds before it gives way). Before the
 * years start and after they end it rests on winter.
 */
export function p5Season(t: number): { season: Season; next: Season; mix: number } {
  if (t < P5.yearsStart || t >= P5.yearsEnd) return { season: "winter", next: "winter", mix: 0 };
  const turns = phase(t, P5.yearsStart, P5.yearsEnd) * P5.years * SEASONS.length;
  const index = Math.floor(turns);
  const within = turns - index;
  // The last turn ends on winter and stays there.
  const season = SEASONS[index % SEASONS.length];
  const next = index + 1 >= P5.years * SEASONS.length ? "winter" : SEASONS[(index + 1) % SEASONS.length];
  return { season, next, mix: smooth(phase(within, 0.55, 1)) };
}
