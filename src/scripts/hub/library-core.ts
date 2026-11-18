// Pure layout and light for the library hub theme (pages-stars, spec 3.1 layer 4): the
// gutter bookcases. A strip is a towering wall of bays; one period holds two gallery
// levels, each a balustrade and floor slab over ten or more shelves, so two different
// levels fill a tall screen before anything repeats. A gutter of DEEP_GUTTER or more also
// gets a set-back stack on its inner side, laid out at full size and drawn at BACK_SCALE,
// so the wall steps back toward the cards. Coordinates are a case's own CSS px: x from the
// strip's left edge (the near case) or from the stack's origin, y within one period. The
// tile wraps at the period, so the static strip moves at 0.35x scroll without a seam.
// DOM-free so it imports in Node; library-paint.ts draws what this module lays out.

import { createRng } from "../_shared/scene-runtime";
import { SHELF_PERIOD } from "./library-book";
import { clamp, fnv1a, lerp } from "./world/geom";
import type { CardKind, HubMode } from "./world/types";

export type Rgb = readonly [number, number, number];
export type StripSide = "left" | "right";
export type LightKey = "candle" | "moon" | "ember" | "shade";
export type FamilyId = "oxblood" | "bottle" | "navy" | "plum" | "calf" | "vellum";
export type GiltStyle = "none" | "bands" | "label" | "ribs";
export type ObjectKind = "hourglass" | "globe" | "scrolls" | "bust" | "inkwell";

/* ------------------------------------------------------------------ constants */

/** Shelf pitch, board to board (spec 3.1: shelves every 64-76 px). */
export const SHELF_PITCH_MIN = 64;
export const SHELF_PITCH_MAX = 76;
/** Front edge of a shelf board. */
export const BOARD = 6;
/** Handrail and balusters of the gallery walkway at the top of each level. */
export const BALUSTRADE = 22;
/** Floor slab and cornice under the balustrade. */
export const SLAB = 18;
export const GALLERY = BALUSTRADE + SLAB;
export { SHELF_PERIOD };
export const LEVELS = 2;
/** One gallery level of the near case. */
export const LEVEL = SHELF_PERIOD / LEVELS;
/** Shelves of a level run from under its slab down to the next level's floor, behind that balustrade. */
export const SHELF_SPAN = LEVEL - SLAB;
export const UPRIGHT = 10;
export const PILASTER = 14;
/** Bays alternate wider and narrower than BAY by up to BAY_SWING. */
export const BAY = 104;
export const BAY_SWING = 0.12;
/** Gutters narrower than this get no bookcase. */
export const MIN_STRIP = 56;
/** Width range of a recorded slot: the room a docking volume needs, no more. */
export const SLOT_MIN = 14;
export const SLOT_MAX = 22;
export const SPINE_MIN = 4;
export const SPINE_MAX = 30;
/** Widest ordinary spine: at most one wider folio per shelf, none in a narrow bookcase. */
export const FOLIO = 22;
/** Title label panels only on spines this narrow; wider pale spines read as tins with one. */
export const LABEL_MAX = 14;
/** Brass rail on the bookcase face just under each slab, relative to the level; the ladder hooks over it. */
export const RAIL_Y = GALLERY + 7;
/** Share of the accent in a card's spine (spec 3.1: 60/40 toward the accent). */
export const CARD_TINT = 0.4;
/** Gutters at least this wide get a set-back stack on the inner side (spec 3.1 wide: a second receding stack). */
export const DEEP_GUTTER = 400;
export const BACK_SHARE = 0.42;
export const BACK_SCALE = 0.8;
/** Value of the set-back stack relative to the near case: a nave haze of 1 - BACK_VALUE lies over it. */
export const BACK_VALUE = 0.45;
/** The set-back stack's galleries sit this far (a multiple of 4) below the near case's, so the two never line up. */
export const BACK_PHASE = 296;
/** Share of a sconce's light that passes the upright into the neighbouring bay. */
export const UPRIGHT_PASS = 0.2;
/** Visible side face of the near case where it steps forward of the set-back stack. */
export const END_PANEL = 14;
/** Candle light fades over this distance from the inner (content) edge; lightness is capped within EDGE_NEAR. */
export const EDGE_FADE = 48;
export const EDGE_NEAR = 24;
export const EDGE_CAP = 0.6;
/** HSL saturation cap where lightness is above 0.45; the painter's +8 % highlight stays under 0.62. */
export const SAT_CAP = 0.58;
/** Rolling ladder lean in degrees, foot out toward the screen edge. */
export const LADDER_LEAN: readonly [number, number] = [6, 10];

/** Spec 3.1 palette entries the bookcases use, as RGB. */
export const PALETTE = {
  void: [7, 6, 12],
  nave: [13, 11, 22],
  gilt: [201, 163, 90],
  giltHi: [242, 212, 140],
  moonCore: [205, 216, 255],
  moonFall: [143, 162, 230],
  /** The moon rim as it lands on dark wood and leather: blue, not grey. */
  moonRim: [122, 158, 238],
  lapis: [24, 32, 74],
  stoneRim: [91, 99, 144],
} as const satisfies Record<string, Rgb>;

/** Leather albedo per family. The first four are the spec's volume colours brought to albedo. */
export const FAMILIES: Readonly<Record<FamilyId, Rgb>> = {
  oxblood: [124, 40, 44],
  bottle: [46, 86, 62],
  navy: [48, 62, 112],
  plum: [96, 50, 98],
  calf: [150, 96, 56],
  vellum: [203, 189, 152],
};
export const FAMILY_IDS = Object.keys(FAMILIES) as FamilyId[];

export interface LightParams {
  /** Ambient level and its colour (per channel). */
  ambient: number;
  tint: Rgb;
  /** Alpha of the cool moon rim on headcaps and board lips. */
  rim: number;
  /** Light falling from above into the top of each compartment (a +k brightening). */
  sky: number;
  /** Warm light present without a sconce nearby. */
  warm: number;
}

/** Lighting keys: neighbouring bays never share one (spec 3.1 gate). */
export const LIGHT: Readonly<Record<LightKey, LightParams>> = {
  candle: { ambient: 0.3, tint: [0.92, 0.88, 0.94], rim: 0.11, sky: 0.05, warm: 0.06 },
  moon: { ambient: 0.34, tint: [0.78, 0.9, 1.16], rim: 0.66, sky: 0.2, warm: 0 },
  ember: { ambient: 0.26, tint: [1.04, 0.88, 0.74], rim: 0.11, sky: 0.04, warm: 0.07 },
  shade: { ambient: 0.2, tint: [0.84, 0.88, 1.04], rim: 0.18, sky: 0.06, warm: 0 },
};
export const LIGHT_KEYS = Object.keys(LIGHT) as LightKey[];
/** Per-channel colour of sconce light. */
export const CANDLE_LIGHT: Rgb = [1.42, 0.98, 0.56];

/** Static candle glow in the air: [distance / radius, alpha] stops of the pool. */
export const GLOW_POOL: ReadonlyArray<readonly [number, number]> = [
  [0, 0.11],
  [0.3, 0.04],
  [1, 0],
];

export const OBJECT_KINDS: readonly ObjectKind[] = ["hourglass", "globe", "scrolls", "bust", "inkwell"];
/** Base size of each shelf object; an instance is scaled 0.8-1.2. */
export const OBJECT_SIZE: Readonly<Record<ObjectKind, { w: number; h: number }>> = {
  hourglass: { w: 14, h: 26 },
  globe: { w: 24, h: 32 },
  scrolls: { w: 30, h: 17 },
  bust: { w: 17, h: 30 },
  inkwell: { w: 14, h: 27 },
};

/** Rune strokes in a 1 x 2 box (x 0..1, y 0..2), one set per card spine. */
export const RUNES: ReadonlyArray<ReadonlyArray<ReadonlyArray<readonly [number, number]>>> = [
  [[[0.5, 0], [0.5, 2]], [[0.5, 0.5], [1, 0.1]], [[0.5, 0.9], [1, 0.5]]],
  [[[0.2, 0], [0.2, 2]], [[0.2, 0.2], [0.85, 0.7], [0.2, 1.2]]],
  [[[0.5, 0], [0.5, 2]], [[0, 0.6], [0.5, 1], [1, 0.6]]],
  [[[0.15, 2], [0.5, 0], [0.85, 2]], [[0.3, 1.2], [0.7, 1.2]]],
  [[[0.2, 0], [0.2, 2]], [[0.8, 0], [0.8, 2]], [[0.2, 0.4], [0.8, 1.6]]],
  [[[0.5, 0], [0.5, 2]], [[0.1, 0.5], [0.9, 0.5]], [[0.2, 1.5], [0.5, 1.15], [0.8, 1.5]]],
  [[[0.8, 0], [0.2, 0.6], [0.8, 1.2], [0.2, 1.8]]],
  [[[0.5, 0], [0.1, 0.8], [0.5, 1.6], [0.9, 0.8], [0.5, 0]], [[0.5, 1.6], [0.5, 2]]],
];

/* ------------------------------------------------------------------ types */

export interface ShelfPlan {
  side: StripSide;
  /** Strip width in CSS px: the free gutter. */
  width: number;
  /** Rolling ladder on the left strip, desktop and wide (spec 3.1 composition). */
  ladder: boolean;
  /** Sconce falloff radius. */
  lightRadius: number;
  /** Widest spine: FOLIO in a narrow bookcase, else SPINE_MAX. */
  spineCap: number;
  /** A set-back stack on the inner side of the gutter. */
  deep: boolean;
}

export interface ShelfCard {
  slug: string;
  accent: string;
}

export interface ShelfInput {
  plan: ShelfPlan;
  seed: number;
  /** Open cards whose nearest bookcase is this strip; one tinted spine each. */
  cards: readonly ShelfCard[];
}

export interface ShelfBook {
  kind: "book";
  /** Left edge of the footprint on the board. */
  x: number;
  /** Spine width and height before any lean. */
  w: number;
  h: number;
  /** Radians; negative tilts the top left onto the left neighbour, positive tilts it right. */
  lean: number;
  family: FamilyId;
  /** Albedo after per-book variation (tone, fading, card tint). */
  color: Rgb;
  gilt: GiltStyle;
  /** Raised bands across the spine (0 or 3-5). */
  ribs: number;
  /** Title label colour on a "label" spine. */
  label: Rgb | null;
  /** Set on the one spine per open card. */
  card: string | null;
  rune: number;
}

export interface StackBook {
  /** Offset from the stack's x. */
  dx: number;
  /** Visible length (the spine lying flat) and thickness. */
  len: number;
  t: number;
  family: FamilyId;
  color: Rgb;
  gilt: boolean;
}

export interface ShelfStack {
  kind: "stack";
  x: number;
  w: number;
  /** Bottom to top. */
  books: StackBook[];
}

export interface ShelfObject {
  kind: ObjectKind;
  x: number;
  w: number;
  h: number;
  /** Instance scale of the base sprite (OBJECT_SIZE). */
  scale: number;
  /** Globe axis tilt in radians (within 15 degrees). */
  tilt: number;
  /** 0..1 instance variation: sand below the neck, globe turn, scroll count. */
  variant: number;
  /** Mirrored (a bust's gaze, a quill's slant). */
  flip: boolean;
}

export type ShelfItem = ShelfBook | ShelfStack | ShelfObject;

export interface Compartment {
  /** Under the board or slab above. */
  top: number;
  /** Top of this compartment's board; books stand here. The last shelf of a level ends behind the next balustrade. */
  floor: number;
  items: ShelfItem[];
}

/** One bay within one gallery level: its own lighting key, families and shelves. */
export interface Cell {
  level: number;
  key: LightKey;
  /** Dominant, secondary and accent family. */
  families: readonly [FamilyId, FamilyId, FamilyId];
  compartments: Compartment[];
}

export interface Bay {
  /** 0 is the bay nearest the cards. */
  index: number;
  x0: number;
  x1: number;
  cells: Cell[];
}

export interface Upright {
  x: number;
  w: number;
  pilaster: boolean;
}

export interface Sconce {
  /** Flame base (top of the candle). */
  x: number;
  y: number;
  bay: number;
  level: number;
  /** Upright it is mounted on. */
  upright: number;
  /** Direction the arm reaches: -1 left, 1 right. */
  reach: -1 | 1;
  radius: number;
}

export interface EmptySlot {
  x: number;
  /** Board top the slot stands on. */
  y: number;
  w: number;
  /** Clear height above the board. */
  h: number;
  bay: number;
}

export interface CardSpine {
  slug: string;
  x: number;
  /** Top of the spine. */
  y: number;
  w: number;
  h: number;
  color: Rgb;
  rune: number;
  bay: number;
}

export interface Ladder {
  /** Centre between the rails where the hooks hang on the brass rail, and its height. */
  hookX: number;
  top: number;
  /** Centre between the wheels on the walkway below; out toward the screen edge. */
  footX: number;
  bottom: number;
  spreadTop: number;
  spreadBottom: number;
  rungStep: number;
}

export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * One bookcase wall in its own CSS px. The strip a theme receives is the near case; on a deep
 * gutter it carries the set-back stack in `back`, whose local px are drawn at `scale` from `originX`.
 */
export interface ShelfStrip {
  side: StripSide;
  /** Width of the case's frame: the gutter for the near case. */
  width: number;
  /** One period in local px; period x scale = SHELF_PERIOD. */
  period: number;
  /** One gallery level in local px. */
  level: number;
  scale: number;
  /** Strip x of local x = 0. */
  originX: number;
  /** Local x range the case fills; its outermost bay runs on past the screen edge. */
  x0: number;
  x1: number;
  bays: Bay[];
  uprights: Upright[];
  sconces: Sconce[];
  slots: EmptySlot[];
  spines: CardSpine[];
  ladder: Ladder | null;
  lightRadius: number;
  /** Outer edge of the strip (the screen edge): 0 for the left strip. */
  outerX: number;
  /** Left x of the near case's visible side face, when a set-back stack stands beside it. */
  endPanel: number | null;
  back: ShelfStrip | null;
  /** Tile row 0 lands this many CSS px down the strip canvas (the right strip is offset from the left). */
  phase: number;
}

/* ------------------------------------------------------------------ plan */

/** Whether a gutter gets a bookcase, and what it holds (spec 3.1 composition by mode). */
export function shelfPlan(mode: HubMode, gutter: number, side: StripSide): ShelfPlan | null {
  if (mode === "phone" || mode === "landscape-short" || gutter < MIN_STRIP) return null;
  const width = Math.floor(gutter);
  return {
    side,
    width,
    ladder: side === "left" && (mode === "desktop" || mode === "wide"),
    lightRadius: mode === "narrow" ? 120 : mode === "wide" ? 190 : 160,
    spineCap: mode === "narrow" ? FOLIO : SPINE_MAX,
    deep: width >= DEEP_GUTTER,
  };
}

/** Open cards per strip: the left column and full-width cards go left, the right column right. */
export function cardsForSide(
  cards: readonly { slug: string; kind: CardKind; accent: string; column: "l" | "r" | "full" }[],
  side: StripSide,
): ShelfCard[] {
  return cards
    .filter((c) => c.kind === "open" && (side === "right" ? c.column === "r" : c.column !== "r"))
    .map((c) => ({ slug: c.slug, accent: c.accent }));
}

/**
 * Vertical offset of a strip's tile. The right strip sits a multiple of 4 px within 0.3-0.7 of
 * a level below the left, so the two strips' galleries never line up. A strip with a ladder
 * opens on its second level, so the level whose candle the ladder may displace starts lower.
 */
export function stripPhase(side: StripSide, seed: number, ladder = false): number {
  if (side === "left") return ladder ? LEVEL : 0;
  const u = createRng((seed ^ 0x51ed27) >>> 0)();
  return 4 * Math.round((LEVEL * (0.3 + 0.4 * u)) / 4);
}

/* ------------------------------------------------------------------ maths */

const gaussian = (rng: () => number): number => {
  const u = Math.max(1e-9, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
};

const pick = <T>(rng: () => number, list: readonly T[]): T => list[Math.floor(rng() * list.length) % list.length];

export const mixRgb = (a: Rgb, b: Rgb, t: number): [number, number, number] => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

export const scaleRgb = (c: Rgb, k: number): [number, number, number] => [c[0] * k, c[1] * k, c[2] * k];

export const roundRgb = (c: Rgb): Rgb => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];

/** #rgb or #rrggbb; null when the text is not a hex colour. */
export function parseHex(text: string): Rgb | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim());
  if (!m) return null;
  const hex = m[1].length === 3 ? [...m[1]].map((ch) => ch + ch).join("") : m[1];
  const n = Number.parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** HSL with hue in degrees and saturation and lightness in 0..1; channels are clamped to 0..255 first. */
export function toHsl(c: Rgb): [number, number, number] {
  const [r, g, b] = c.map((v) => clamp(v, 0, 255) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, d / (1 - Math.abs(2 * l - 1)), l];
}

export function fromHsl(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Signed shortest turn from hue a to hue b, in degrees. */
const hueTurn = (a: number, b: number): number => ((((b - a) % 360) + 540) % 360) - 180;

function clampHue(h: number, lo: number, hi: number): number {
  if (h >= lo && h <= hi) return h;
  return Math.abs(hueTurn(h, lo)) <= Math.abs(hueTurn(h, hi)) ? lo : hi;
}

/**
 * Colour grading after the light, the last colour operation on every spine: candlelight
 * compresses chroma, bright colours keep within SAT_CAP, plum stays plum or wine under every
 * key (never violet), navy stays a dusky blue (never cobalt, silver or lavender), vellum stays
 * warm ivory under the moon, and `cap` bounds lightness (near the content column).
 */
export function grade(c: Rgb, family: FamilyId | null, candle: number, cap = 1): [number, number, number] {
  let [h, s, l] = toHsl(c);
  const warm = clamp(candle, 0, 1);
  s *= 1 - 0.35 * warm;
  if (l > 0.45) s = Math.min(s, SAT_CAP);
  if (family === "plum") {
    h = clampHue(h, 306, 345);
    h += Math.min(1, warm * 2) * hueTurn(h, clampHue(h, 330, 350));
    s = Math.min(s, warm < 0.2 ? 0.3 : 0.5);
    l = Math.min(l, 0.5);
  } else if (family === "navy") {
    h = clampHue(h, 212, 236);
    s = clamp(s, 0.18, 0.45);
    l = Math.min(l, lerp(0.5, 0.32, clamp((warm - 0.1) / 0.3, 0, 1)));
  } else if (family === "vellum") {
    h = clampHue(h, 35, 44);
    s = Math.max(s, 0.18);
    l = Math.min(l, 0.76);
  }
  return fromHsl(h, s, Math.min(l, cap));
}

/** Spine width: long-tailed (log-normal around 9 px) with a rare folio, so a row never reads as a barcode. */
export function spineWidth(rng: () => number): number {
  const w = rng() < 0.05 ? 19 + rng() * 10 : 9 * Math.exp(0.4 * gaussian(rng));
  return clamp(Math.round(w), SPINE_MIN, SPINE_MAX);
}

/** Splits `total` into `count` pitches within [min, max], varied but summing exactly. */
export function splitPitches(total: number, count: number, min: number, max: number, rng: () => number): number[] {
  const raw = Array.from({ length: count }, () => 0.6 + rng() * 0.8);
  const sum = raw.reduce((a, b) => a + b, 0);
  const out = raw.map((r) => clamp(Math.round((r / sum) * total), min, max));
  let diff = total - out.reduce((a, b) => a + b, 0);
  for (let i = 0, guard = 0; diff !== 0 && guard < count * (max - min + 1); i = (i + 1) % count, guard++) {
    const next = out[i] + Math.sign(diff);
    if (next < min || next > max) continue;
    out[i] = next;
    diff -= Math.sign(diff);
  }
  return out;
}

/** Shelf counts that fit the span with every pitch in range. */
export function shelfCounts(span: number, min = SHELF_PITCH_MIN, max = SHELF_PITCH_MAX): number[] {
  const out: number[] = [];
  for (let n = Math.ceil(span / max); n <= Math.floor(span / min); n++) out.push(n);
  return out;
}

/** A DPR at which one period is a whole number of device pixels, so the tile repeats without a seam. */
export function shelfDpr(dpr: number): number {
  return Math.max(1, Math.round(SHELF_PERIOD * dpr)) / SHELF_PERIOD;
}

/** Period offsets at which a vertical extent must be drawn so a tile of height `period` wraps seamlessly. */
export function wrapCopies(y0: number, y1: number, period: number): number[] {
  const out = [0];
  if (y1 > period) out.push(-period);
  if (y0 < 0) out.push(period);
  return out;
}

/** Every whole-period offset at which the extent [y0, y1] overlaps the tile [0, period); each once. */
export function periodCopies(y0: number, y1: number, period: number): number[] {
  const out: number[] = [];
  for (let k = Math.floor(-y1 / period); k * period + y0 < period; k++) if (k * period + y1 > 0) out.push(k * period);
  return out;
}

/**
 * Stops of a spine's face across its width, [offset, shade]: rolled off at both joints, a soft
 * highlight toward the moon (`high`, 0..1). Every stop colour is tone(raw, family, light, shade),
 * graded last, so no later pass moves a spine out of its family's hue band.
 */
export function spineStops(w: number, high: number): ReadonlyArray<readonly [number, number]> {
  if (w < 6) return [[0, 0.62], [0.5, 1.02], [1, 0.55]];
  const r = Math.min(3, 0.2 * w) / w;
  const c = Math.min(1 - r, Math.max(r, high));
  return [[0, 0.55], [r, 0.97], [Math.max(r, c - 0.15), 1], [c, 1.08], [Math.min(1 - r, c + 0.15), 1], [1 - r, 0.93], [1, 0.5]];
}

/** Shades a painter applies to a spine's graded colour: the face stops and the raised band ridge. */
export const SPINE_SHADES = [0.5, 0.55, 0.62, 0.93, 0.97, 1, 1.02, 1.08, 1.22] as const;

/**
 * Warm sconce light at a strip point, wrapped by the period: sum of smooth falloffs, 0..~1.4.
 * With `bay`, the point lies in that bay and the uprights shade it from a sconce lighting
 * another bay (UPRIGHT_PASS), so a candle bay's neighbours keep their own key.
 */
export function warmAt(strip: Pick<ShelfStrip, "sconces" | "period">, x: number, y: number, bay?: number): number {
  let sum = 0;
  for (const s of strip.sconces) {
    let dy = Math.abs(y - s.y) % strip.period;
    if (dy > strip.period / 2) dy = strip.period - dy;
    const d2 = ((x - s.x) ** 2 + dy * dy) / (s.radius * s.radius);
    if (d2 < 1) sum += (1 - d2) * (1 - d2) * (bay === undefined || bay === s.bay ? 1 : UPRIGHT_PASS);
  }
  return sum;
}

/** Alpha of the static candle glow in the air at distance d from a flame whose pool has radius r. */
export function airGlow(d: number, r: number): number {
  const t = d / r;
  for (let i = 1; i < GLOW_POOL.length; i++) {
    const [t0, a0] = GLOW_POOL[i - 1];
    const [t1, a1] = GLOW_POOL[i];
    if (t <= t1) return lerp(a0, a1, clamp((t - t0) / (t1 - t0), 0, 1));
  }
  return 0;
}

export interface Light {
  ambient: number;
  tint: Rgb;
  warm: number;
  rim: number;
  sky: number;
  /** Lightness cap after grading. */
  cap: number;
}

type LightSource = Pick<ShelfStrip, "sconces" | "period" | "side" | "width">;

/** Distance from the case's inner (content) edge, the candle fade there and the lightness cap. */
function edgeTerms(strip: LightSource, x: number): { fade: number; cap: number } {
  const d = strip.side === "left" ? strip.width - x : x;
  return { fade: d >= EDGE_FADE ? 1 : 0.45 + (0.55 * Math.max(0, d)) / EDGE_FADE, cap: d < EDGE_NEAR ? EDGE_CAP : 1 };
}

/** Light at a point of a cell in bay `bay`: its key plus sconce falloff, dimmed beside the content column. */
export function lightAt(strip: LightSource, cell: Pick<Cell, "key">, x: number, y: number, bay?: number): Light {
  const key = LIGHT[cell.key];
  const edge = edgeTerms(strip, x);
  return { ambient: key.ambient, tint: key.tint, warm: (key.warm + warmAt(strip, x, y, bay)) * edge.fade, rim: key.rim, sky: key.sky, cap: edge.cap };
}

/** Light reaching the wall from away from any cell (uprights, gallery): a dim neutral key plus sconces. */
export function wallLight(strip: LightSource, x: number, y: number): Light {
  const edge = edgeTerms(strip, x);
  return { ambient: 0.3, tint: [0.86, 0.88, 1], warm: warmAt(strip, x, y) * edge.fade, rim: 0.3, sky: 0, cap: edge.cap };
}

/** Values above the knee roll off toward 255 instead of clipping, so pale spines by a flame keep their shading. */
export const HIGHLIGHT_KNEE = 176;

export function softClip(v: number): number {
  if (v <= HIGHLIGHT_KNEE) return Math.max(0, v);
  const room = 255 - HIGHLIGHT_KNEE;
  return HIGHLIGHT_KNEE + room * (1 - Math.exp(-(v - HIGHLIGHT_KNEE) / room));
}

/** Lit colour before grading: the albedo times ambient light of the key's colour plus candlelight's colour. */
export function litColor(albedo: Rgb, light: Light): [number, number, number] {
  const warm = light.warm * 1.25;
  return [
    softClip(albedo[0] * (light.ambient * light.tint[0] + warm * CANDLE_LIGHT[0])),
    softClip(albedo[1] * (light.ambient * light.tint[1] + warm * CANDLE_LIGHT[1])),
    softClip(albedo[2] * (light.ambient * light.tint[2] + warm * CANDLE_LIGHT[2])),
  ];
}

/** Share of a point's light that comes from candles, 0..1. */
export function candleWeight(light: Light): number {
  const warm = light.warm * 1.25;
  const ambient = (light.ambient * (light.tint[0] + light.tint[1] + light.tint[2])) / 3;
  return warm <= 0 ? 0 : warm / (ambient + warm);
}

/** A lit colour `raw` (from litColor) shaded by k and graded for its family and light. */
export function tone(raw: Rgb, family: FamilyId | null, light: Light, k = 1): [number, number, number] {
  return grade(scaleRgb(raw, k), family, candleWeight(light), light.cap);
}

/** Footprint width of a book on its board. */
export function footprint(b: Pick<ShelfBook, "w" | "h" | "lean">): number {
  const a = Math.abs(b.lean);
  return a === 0 ? b.w : b.w * Math.cos(a) + b.h * Math.sin(a);
}

/** Horizontal extent of an item on its board. */
export function itemWidth(item: ShelfItem): number {
  return item.kind === "book" ? footprint(item) : item.w;
}

/** Height of an item above its board. */
export function itemHeight(item: ShelfItem): number {
  if (item.kind === "book") {
    const a = Math.abs(item.lean);
    return a === 0 ? item.h : item.h * Math.cos(a) + item.w * Math.sin(a);
  }
  if (item.kind === "stack") return item.books.reduce((s, b) => s + b.t, 0);
  return item.h;
}

/** Centre x of the ladder at height y. */
export function ladderX(l: Ladder, y: number): number {
  return lerp(l.hookX, l.footX, clamp((y - l.top) / (l.bottom - l.top), 0, 1));
}

/** Horizontal extent of the ladder's rails between heights y0 and y1. */
export function ladderSpan(l: Ladder, y0: number, y1: number): [number, number] {
  const xs = [y0, y1].flatMap((y) => {
    const t = clamp((y - l.top) / (l.bottom - l.top), 0, 1);
    const c = lerp(l.hookX, l.footX, t);
    const half = lerp(l.spreadTop, l.spreadBottom, t) / 2 + 3;
    return [c - half, c + half];
  });
  return [Math.min(...xs), Math.max(...xs)];
}

/** Whether a box comes within `margin` px of the ladder. */
export function ladderHits(l: Ladder | null, box: Box, margin = 14): boolean {
  if (!l || box.y1 < l.top || box.y0 > l.bottom) return false;
  const [a, b] = ladderSpan(l, Math.max(box.y0, l.top), Math.min(box.y1, l.bottom));
  return box.x0 < b + margin && box.x1 > a - margin;
}

/** Bounds of a sconce: wall plate on its upright, arm, dish, candle and flame. */
export function sconceBox(s: Sconce, up: Upright): Box {
  return { x0: Math.min(up.x, s.x - 6), x1: Math.max(up.x + up.w, s.x + 6), y0: s.y - 14, y1: s.y + 24 };
}

/* ------------------------------------------------------------------ layout */

interface CaseSpec {
  side: StripSide;
  width: number;
  x0: number;
  x1: number;
  /** Local x of the edge toward the cards; bays run from it out past the outer edge. */
  innerX: number;
  pilaster: boolean;
  level: number;
  scale: number;
  originX: number;
  candles: boolean;
  slots: boolean;
  ladder: boolean;
  spineCap: number;
  lightRadius: number;
}

/** Bays from the inner edge outward, alternating wider and narrower; the outermost runs past the edge. */
function draftBays(spec: CaseSpec, rng: () => number): { spans: [number, number][]; uprights: Upright[] } {
  const out = spec.side === "left" ? -1 : 1;
  const extent = out < 0 ? spec.innerX - spec.x0 : spec.x1 - spec.innerX;
  const toX = (u0: number, u1: number): [number, number] => (out < 0 ? [spec.innerX - u1, spec.innerX - u0] : [spec.innerX + u0, spec.innerX + u1]);
  const spans: [number, number][] = [];
  const inner = spec.pilaster ? PILASTER : UPRIGHT;
  const [ix0, ix1] = toX(0, inner);
  const uprights: Upright[] = [{ x: ix0, w: ix1 - ix0, pilaster: spec.pilaster }];
  let u = inner;
  let swing = rng() < 0.5 ? -1 : 1;
  while (u < extent) {
    const room = extent - u;
    let w: number;
    // A gutter with room for one bay keeps that bay's outer upright on screen.
    if (spans.length === 0 && room <= BAY * (1 + BAY_SWING) + UPRIGHT) w = Math.max(Math.round(BAY * 0.65), room - UPRIGHT);
    else {
      w = Math.round(BAY * (1 + swing * BAY_SWING * (0.4 + 0.6 * rng())));
      swing = -swing;
    }
    spans.push(toX(u, u + w));
    u += w;
    const [ux0, ux1] = toX(u, u + UPRIGHT);
    uprights.push({ x: ux0, w: ux1 - ux0, pilaster: false });
    u += UPRIGHT;
  }
  return { spans, uprights };
}

/** Keys per level and bay: no two side by side or one above the other share one; a candle on every level that can hold one. */
export function pickKeys(bays: number, levels: number, rng: () => number, keys: readonly LightKey[] = LIGHT_KEYS): LightKey[][] {
  const grid: LightKey[][] = [];
  for (let l = 0; l < levels; l++) {
    const row: LightKey[] = [];
    for (let i = 0; i < bays; i++) {
      const above = grid[l - 1]?.[i];
      row.push(pick(rng, keys.filter((k) => k !== row[i - 1] && k !== above)));
    }
    // A sconce on every level where a bay can take the candle key without matching the level above.
    if (keys.includes("candle") && !row.includes("candle")) {
      const i = row.findIndex((_, j) => grid[l - 1]?.[j] !== "candle");
      if (i >= 0) row[i] = "candle";
    }
    grid.push(row);
  }
  return grid;
}

function pickFamilies(avoidDominant: ReadonlySet<FamilyId>, rng: () => number): [FamilyId, FamilyId, FamilyId] {
  const dominant = pick(
    rng,
    FAMILY_IDS.filter((f) => !avoidDominant.has(f)),
  );
  const rest = FAMILY_IDS.filter((f) => f !== dominant);
  const second = pick(rng, rest);
  const third = pick(
    rng,
    rest.filter((f) => f !== second),
  );
  return [dominant, second, third];
}

const familyAt = (families: Cell["families"], rng: () => number): FamilyId => {
  const r = rng();
  return r < 0.5 ? families[0] : r < 0.8 ? families[1] : families[2];
};

/** Per-book albedo: a tone around the family colour, a little hue drift, sometimes sun-faded. */
function bookColor(family: FamilyId, rng: () => number): Rgb {
  let c = scaleRgb(FAMILIES[family], 0.72 + rng() * 0.5);
  c = mixRgb(c, [c[0] * 1.08, c[1], c[2] * 0.9], rng() * 0.6);
  if (rng() < 0.14) c = mixRgb(c, [150, 132, 108], 0.16 + rng() * 0.2);
  return roundRgb(c);
}

function giltStyle(rng: () => number): GiltStyle {
  if (rng() >= 0.3) return "none";
  const r = rng();
  return r < 0.45 ? "bands" : r < 0.75 ? "label" : "ribs";
}

const LABELS: readonly Rgb[] = [
  [30, 22, 20],
  [120, 36, 32],
  [26, 38, 32],
];

/** Breaks (a lean or a stack) come after 5-9 upright books (spec 3.1); a row that cannot fit one yet keeps filling up to 9. */
export const RUN_MIN = 5;
export const RUN_MAX = 9;

interface FillState {
  /** Upright books since the last break, and the run length at which the next break is due. */
  run: number;
  target: number;
}

interface ObjectPlan {
  kind: ObjectKind;
  at: number;
  scale: number;
  tilt: number;
  variant: number;
  flip: boolean;
}

interface CellPlan {
  objects: Map<number, ObjectPlan>;
  slot: { compartment: number; at: number; w: number } | null;
}

function newBook(x: number, w: number, h: number, families: Cell["families"], rng: () => number): ShelfBook {
  const family = familyAt(families, rng);
  let gilt = giltStyle(rng);
  if (gilt === "label" && w > LABEL_MAX) gilt = "bands";
  return {
    kind: "book",
    x,
    w,
    h,
    lean: 0,
    family,
    color: bookColor(family, rng),
    gilt,
    ribs: gilt === "ribs" || (gilt === "none" && rng() < 0.25) ? 3 + Math.floor(rng() * 3) : 0,
    label: gilt === "label" ? pick(rng, LABELS) : null,
    card: null,
    rune: 0,
  };
}

function uprightHeight(interior: number, w: number, rng: () => number): number {
  return Math.round(interior * clamp(0.6 + rng() * 0.26 + (w - 9) * 0.011, 0.54, 0.93));
}

function makeStack(x: number, room: number, interior: number, families: Cell["families"], rng: () => number): ShelfStack | null {
  const count = 2 + Math.floor(rng() * 3);
  const books: StackBook[] = [];
  let height = 0;
  let width = 0;
  let len = Math.min(Math.round(lerp(36, 54, rng())), room - 4);
  if (len < 18) return null;
  for (let i = 0; i < count; i++) {
    const t = 5 + Math.round(rng() * 6);
    if (height + t > interior - 10) break;
    const family = familyAt(families, rng);
    const dx = Math.round((rng() - 0.5) * 5);
    books.push({ dx, len, t, family, color: bookColor(family, rng), gilt: rng() < 0.3 });
    height += t;
    width = Math.max(width, dx + len);
    len = Math.max(Math.min(len, 20), len - Math.round(rng() * 9));
  }
  if (books.length < 2) return null;
  const minDx = Math.min(...books.map((b) => b.dx));
  for (const b of books) b.dx -= minDx;
  width -= minDx;
  if (width > room) return null;
  return { kind: "stack", x, w: width, books };
}

function sizeObject(p: ObjectPlan, interior: number): ShelfObject {
  const base = OBJECT_SIZE[p.kind];
  const scale = Math.min(p.scale, (interior - 6) / base.h);
  return { kind: p.kind, x: 0, w: Math.round(base.w * scale), h: Math.round(base.h * scale), scale, tilt: p.tilt, variant: p.variant, flip: p.flip };
}

/** Fills one compartment left to right with books, leans, stacks, the planned object and slot, and small gaps. */
function fillCompartment(k: ShelfStrip, bay: Bay, cell: Cell, ci: number, plan: CellPlan, state: FillState, spec: CaseSpec, rng: () => number): void {
  const c = cell.compartments[ci];
  const interior = c.floor - c.top;
  const xb = bay.x1 - 2;
  let x = bay.x0 + 1 + Math.round(rng() * 2);
  const op = plan.objects.get(ci) ?? null;
  const object = op ? sizeObject(op, interior) : null;
  let objectPending = object !== null;
  const slot = plan.slot?.compartment === ci ? plan.slot : null;
  let slotPending = slot !== null;
  let pendingRightLean: number | null = null;
  let folios = 0;
  let force = false;
  // The upright book a left lean can rest on: the last item, with no slot or wide gap between.
  const lastBook = (): ShelfBook | null => {
    const last = c.items[c.items.length - 1];
    return last && last.kind === "book" && last.lean === 0 && x - (last.x + last.w) <= 5 ? last : null;
  };
  // Room held back for the planned object and slot, so books never crowd them out (gaps add up to 5 px).
  const reserved = () => (objectPending && object ? object.w + 9 : 0) + (slotPending && slot ? slot.w + 6 : 0);
  const putObject = (o: ShelfObject) => {
    c.items.push({ ...o, x: x + 1 });
    x += o.w + 3;
    objectPending = false;
  };
  const putSlot = (s: { w: number }) => {
    if (spec.slots) k.slots.push({ x, y: c.floor, w: s.w, h: interior, bay: bay.index });
    x += s.w;
    slotPending = false;
  };

  for (let guard = 0; guard < 200; guard++) {
    const room = xb - x - reserved();
    // A planned object or slot goes in at its target, wherever the row has run out of room, or when a break cannot fit before it.
    const due = (at: number) => pendingRightLean === null && (force || x >= lerp(bay.x0, bay.x1, at) || room < SPINE_MIN);
    if (objectPending && object && op && due(op.at)) {
      putObject(object);
      continue;
    }
    if (slotPending && slot && due(slot.at)) {
      putSlot(slot);
      continue;
    }
    force = false;
    if (room < SPINE_MIN) break;

    if (state.run >= state.target && pendingRightLean === null) {
      const prev = lastBook();
      const first = c.items.length === 0;
      const leanFirst = rng() < 0.55;
      const tryLean = (): boolean => {
        const w = clamp(spineWidth(rng), 6, 16);
        const a = 0.14 + rng() * 0.24;
        // A left lean rests on the upright book before it, or on the bay side when it opens the row.
        const toRight = (!first && prev === null) || rng() < 0.32;
        let h = uprightHeight(interior, w, rng);
        if (!toRight && prev) h = Math.min(h, Math.floor((prev.h - 2) / Math.cos(a)));
        if (h < interior * 0.45) return false;
        const book = newBook(x, w, h, cell.families, rng);
        book.lean = toRight ? a : -a;
        const fw = footprint(book);
        if (fw + (toRight ? 12 : 2) > room || itemHeight(book) > interior - 3) return false;
        c.items.push(book);
        x += Math.ceil(fw);
        if (toRight) pendingRightLean = Math.ceil(h * Math.cos(a)) + 2;
        else x += 1 + Math.round(rng() * 4);
        return true;
      };
      const tryStack = (): boolean => {
        const stack = makeStack(x, room - 2, interior, cell.families, rng);
        if (!stack) return false;
        c.items.push(stack);
        x += stack.w + 2 + Math.round(rng() * 3);
        return true;
      };
      // The last book of a row leans right onto the bay side, its angle chosen to fill the row.
      const tryEndLean = (): boolean => {
        const target = bay.x1 - x - 0.5;
        const fit = (h: number, a: number) => w * Math.cos(a) + h * Math.sin(a);
        let w = clamp(spineWidth(rng), 4, 12);
        if (fit(interior - 4 - w, 0.38) < target) w = 12;
        const hMin = Math.ceil(interior * 0.45);
        const hMax = interior - 4 - w;
        let h = clamp(uprightHeight(interior, w, rng), hMin, hMax);
        if (fit(h, 0.14) > target) h = Math.max(hMin, Math.floor((target - w * Math.cos(0.14)) / Math.sin(0.14)));
        if (fit(h, 0.38) < target) h = Math.min(hMax, Math.ceil((target - w * Math.cos(0.38)) / Math.sin(0.38)));
        if (fit(h, 0.14) > target || fit(h, 0.38) < target) return false;
        let lo = 0.14;
        let hi = 0.38;
        for (let i = 0; i < 24; i++) {
          const mid = (lo + hi) / 2;
          if (fit(h, mid) < target) lo = mid;
          else hi = mid;
        }
        const book = newBook(x, w, h, cell.families, rng);
        book.lean = lo;
        if (itemHeight(book) > interior - 3) return false;
        c.items.push(book);
        x += footprint(book);
        return true;
      };
      let placed = leanFirst ? tryLean() || tryStack() : tryStack() || tryLean();
      if (!placed && !objectPending && !slotPending) placed = tryEndLean();
      if (placed) {
        state.run = 0;
        state.target = RUN_MIN + Math.floor(rng() * (RUN_MAX - RUN_MIN + 1));
        continue;
      }
      if (objectPending || slotPending) {
        force = true;
        continue;
      }
      if (state.run >= RUN_MAX) break;
    }

    let w = spineWidth(rng);
    const limit = folios > 0 ? FOLIO : spec.spineCap;
    if (w > limit) w = 10 + Math.round(rng() * (FOLIO - 10));
    if (w > room) {
      if (room < 6) {
        // Out of room before the reserved object or slot: put it in now, then fill what is left.
        if (objectPending || slotPending) {
          force = true;
          continue;
        }
        break;
      }
      w = Math.min(Math.floor(room), limit);
    }
    if (w > FOLIO) folios++;
    let h = uprightHeight(interior, w, rng);
    if (pendingRightLean !== null) {
      h = Math.min(interior - 3, Math.max(h, pendingRightLean));
      pendingRightLean = null;
    }
    c.items.push(newBook(x, w, h, cell.families, rng));
    state.run += 1;
    x += w;
    if (rng() < 0.08) x += 1 + Math.round(rng() * 4);
  }

  // A row that stopped early still holds its planned object and slot: their room was kept free.
  if (objectPending && object) putObject(object);
  if (slotPending && slot) putSlot(slot);

  const leftover = xb - x;
  if (spec.slots && leftover >= SLOT_MIN && c.floor < (cell.level + 1) * k.level) {
    k.slots.push({ x, y: c.floor, w: Math.min(leftover, SLOT_MAX), h: interior, bay: bay.index });
  }
}

/** Places the rolling ladder: hooks on the rail at the top of the first level, foot out toward the screen edge on the walkway below. */
function placeLadder(k: ShelfStrip, rng: () => number): Ladder {
  const top = RAIL_Y - 4;
  const bottom = k.level + BALUSTRADE;
  const spreadTop = 30;
  const spreadBottom = 40;
  const margin = spreadBottom / 2 + 6;
  const innerW = k.uprights[0].w;
  const [a, b] = k.side === "left" ? [k.x0 + margin, k.x1 - innerW - margin] : [k.x0 + innerW + margin, k.x1 - margin];
  const deg = lerp(LADDER_LEAN[0], LADDER_LEAN[1], rng());
  const shift = Math.min(Math.round((bottom - top) * Math.tan((deg * Math.PI) / 180)), Math.max(0, b - a - 4));
  const hookX = Math.round(k.side === "left" ? lerp(a + shift, b, rng()) : lerp(a, b - shift, rng()));
  return { hookX, top, footX: hookX + (k.side === "left" ? -shift : shift), bottom, spreadTop, spreadBottom, rungStep: 27 };
}

/** Free spots for a cell's sconce: an upright of the cell on screen, never the pilaster by the cards, clear of the ladder. */
function sconceSpots(k: ShelfStrip, bay: Bay, cell: Cell): { s: Sconce; outer: boolean }[] {
  const spots: { s: Sconce; outer: boolean }[] = [];
  for (const ui of [bay.index + 1, bay.index]) {
    const up = k.uprights[ui];
    if (!up || up.pilaster || up.x < k.x0 || up.x + up.w > k.x1) continue;
    const cx = up.x + up.w / 2;
    const reach: -1 | 1 = (bay.x0 + bay.x1) / 2 < cx ? -1 : 1;
    for (const c of cell.compartments.slice(2, -2)) {
      const s: Sconce = { x: cx + reach * 9, y: Math.round(c.top + (c.floor - c.top) * 0.36), bay: bay.index, level: cell.level, upright: ui, reach, radius: k.lightRadius };
      if (!ladderHits(k.ladder, sconceBox(s, up))) spots.push({ s, outer: ui === bay.index + 1 });
    }
  }
  return spots;
}

/** A key for a cell that lost its candle, different from its neighbours. */
function rekey(k: ShelfStrip, bay: Bay, cell: Cell): LightKey {
  const taken = [k.bays[bay.index - 1]?.cells[cell.level]?.key, k.bays[bay.index + 1]?.cells[cell.level]?.key, ...bay.cells.filter((c) => c !== cell).map((c) => c.key)];
  return LIGHT_KEYS.find((key) => key !== "candle" && !taken.includes(key)) ?? "shade";
}

/** A sconce on every candle cell; with a ladder, the ladder moves until every sconce is clear of it. */
function mountSconces(k: ShelfStrip, ladder: boolean, rng: () => number): void {
  const candles = k.bays.flatMap((bay) => bay.cells.filter((c) => c.key === "candle").map((cell) => ({ bay, cell })));
  for (let attempt = 0; ; attempt++) {
    if (ladder) k.ladder = placeLadder(k, rng);
    const spots = candles.map(({ bay, cell }) => sconceSpots(k, bay, cell));
    if (ladder && attempt < 15 && spots.some((s) => s.length === 0)) continue;
    candles.forEach(({ bay, cell }, i) => {
      const outer = spots[i].filter((o) => o.outer);
      const inner = spots[i].filter((o) => !o.outer);
      if (outer.length + inner.length === 0) {
        cell.key = rekey(k, bay, cell);
        return;
      }
      k.sconces.push(pick(rng, outer.length > 0 && (inner.length === 0 || rng() < 0.7) ? outer : inner).s);
    });
    return;
  }
}

/** One spine per card in the bay nearest the cards, spread down the period, clear of the ladder. */
function placeCardSpines(k: ShelfStrip, cards: readonly ShelfCard[], rng: () => number): void {
  const bay = k.bays[0];
  const shelves = bay.cells.flatMap((cell) => cell.compartments.slice(0, -1));
  const used = new Set<Compartment>();
  cards.forEach((card, n) => {
    const targetY = ((n + 0.5 + (rng() - 0.5) * 0.4) / cards.length) * k.period;
    const order = shelves.filter((c) => !used.has(c)).sort((a, b) => Math.abs((a.top + a.floor) / 2 - targetY) - Math.abs((b.top + b.floor) / 2 - targetY));
    const mid = (bay.x0 + bay.x1) / 2;
    for (const c of order) {
      const books = c.items.filter(
        (it): it is ShelfBook =>
          it.kind === "book" && it.lean === 0 && it.card === null && it.w >= 8 && !ladderHits(k.ladder, { x0: it.x, x1: it.x + it.w, y0: c.top, y1: c.floor }, 4),
      );
      if (books.length === 0) continue;
      books.sort((a, b) => Math.abs(a.x + a.w / 2 - mid) - Math.abs(b.x + b.w / 2 - mid));
      const book = books[0];
      book.color = roundRgb(mixRgb(FAMILIES[book.family], parseHex(card.accent) ?? PALETTE.gilt, CARD_TINT));
      book.card = card.slug;
      book.rune = fnv1a(card.slug) % RUNES.length;
      book.gilt = "bands";
      book.ribs = 0;
      book.label = null;
      book.h = Math.max(book.h, Math.round((c.floor - c.top) * 0.8));
      used.add(c);
      k.spines.push({ slug: card.slug, x: book.x, y: c.floor - book.h, w: book.w, h: book.h, color: book.color, rune: book.rune, bay: bay.index });
      return;
    }
  });
}

/** One case: bays, levels, shelves, lighting, ladder, sconces, then books, objects and slots. */
function layoutCase(spec: CaseSpec, cards: readonly ShelfCard[], rng: () => number): ShelfStrip {
  const { spans, uprights } = draftBays(spec, rng);
  const keys = pickKeys(spans.length, LEVELS, rng, spec.candles ? LIGHT_KEYS : LIGHT_KEYS.filter((key) => key !== "candle"));
  const k: ShelfStrip = {
    side: spec.side,
    width: spec.width,
    period: spec.level * LEVELS,
    level: spec.level,
    scale: spec.scale,
    originX: spec.originX,
    x0: spec.x0,
    x1: spec.x1,
    bays: [],
    uprights,
    sconces: [],
    slots: [],
    spines: [],
    ladder: null,
    lightRadius: spec.lightRadius,
    outerX: spec.side === "left" ? 0 : spec.width,
    endPanel: null,
    back: null,
    phase: 0,
  };
  const counts = shelfCounts(spec.level - SLAB);

  spans.forEach(([x0, x1], index) => {
    const cells: Cell[] = [];
    for (let level = 0; level < LEVELS; level++) {
      const avoid = new Set<FamilyId>();
      const left = k.bays[index - 1]?.cells[level];
      if (left) avoid.add(left.families[0]);
      if (cells[level - 1]) avoid.add(cells[level - 1].families[0]);
      const pitches = splitPitches(spec.level - SLAB, pick(rng, counts), SHELF_PITCH_MIN, SHELF_PITCH_MAX, rng);
      const compartments: Compartment[] = [];
      let y = level * spec.level + GALLERY;
      for (const p of pitches) {
        compartments.push({ top: y, floor: y + p - BOARD, items: [] });
        y += p;
      }
      compartments[compartments.length - 1].floor = (level + 1) * spec.level + BALUSTRADE - 2;
      cells.push({ level, key: keys[level][index], families: pickFamilies(avoid, rng), compartments });
    }
    k.bays.push({ index, x0, x1, cells });
  });

  mountSconces(k, spec.ladder, rng);

  // Objects: one or two per bay level counting its sconce; a kind never repeats within two bays of a level.
  const kindsAt: ObjectKind[][][] = Array.from({ length: LEVELS }, () => []);
  for (const bay of k.bays) {
    const state: FillState = { run: 0, target: 2 + Math.floor(rng() * 6) };
    for (const cell of bay.cells) {
      const n = cell.compartments.length;
      const sconce = k.sconces.find((s) => s.bay === bay.index && s.level === cell.level);
      const recent = [...(kindsAt[cell.level][bay.index - 1] ?? []), ...(kindsAt[cell.level][bay.index - 2] ?? [])];
      const avail = OBJECT_KINDS.filter((o) => !recent.includes(o));
      const want = sconce ? (rng() < 0.45 ? 1 : 0) : rng() < 0.4 ? 2 : 1;
      const kinds: ObjectKind[] = [];
      while (kinds.length < Math.min(want, avail.length)) kinds.push(pick(rng, avail.filter((o) => !kinds.includes(o))));
      kindsAt[cell.level][bay.index] = kinds;
      // Objects stay out of the sconce's compartment and the half-hidden last shelf.
      const free = cell.compartments.map((_, i) => i).filter((i) => i > 0 && i < n - 1 && !(sconce && sconce.y > cell.compartments[i].top && sconce.y < cell.compartments[i].floor));
      const objects = new Map<number, ObjectPlan>();
      for (const kind of kinds) {
        let ci = pick(rng, free);
        while (objects.has(ci)) ci = pick(rng, free);
        objects.set(ci, { kind, at: 0.15 + rng() * 0.6, scale: 0.8 + rng() * 0.4, tilt: (rng() - 0.5) * 0.52, variant: rng(), flip: rng() < 0.5 });
      }
      const open = cell.compartments.map((_, i) => i).filter((i) => i < n - 1 && !objects.has(i));
      const slot = spec.slots ? { compartment: pick(rng, open), at: 0.2 + rng() * 0.6, w: SLOT_MIN + 2 + Math.round(rng() * (SLOT_MAX - SLOT_MIN - 2)) } : null;
      for (let ci = 0; ci < n; ci++) fillCompartment(k, bay, cell, ci, { objects, slot }, state, spec, rng);
    }
  }

  placeCardSpines(k, cards, rng);
  return k;
}

/** One period of a gutter bookcase: the near case with its records, and on a deep gutter the set-back stack. */
export function layoutShelfStrip(input: ShelfInput): ShelfStrip {
  const { plan } = input;
  const rng = createRng((input.seed ^ fnv1a(`shelves:${plan.side}`)) >>> 0);
  const W = plan.width;
  const left = plan.side === "left";
  const backW = plan.deep ? Math.round(W * BACK_SHARE) : 0;
  const inner = backW === 0 ? (left ? W : 0) : left ? W - backW - END_PANEL : backW + END_PANEL;
  const base = { side: plan.side, spineCap: plan.spineCap, lightRadius: plan.lightRadius };
  const near = layoutCase(
    { ...base, width: W, x0: left ? 0 : inner, x1: left ? inner : W, innerX: inner, pilaster: backW === 0, level: LEVEL, scale: 1, originX: 0, candles: true, slots: true, ladder: plan.ladder },
    input.cards,
    rng,
  );
  near.phase = stripPhase(plan.side, input.seed, plan.ladder);
  if (backW > 0) {
    const wl = backW / BACK_SCALE;
    near.endPanel = left ? inner : inner - END_PANEL;
    near.back = layoutCase(
      { ...base, width: wl, x0: 0, x1: wl, innerX: left ? wl : 0, pilaster: true, level: LEVEL / BACK_SCALE, scale: BACK_SCALE, originX: left ? W - backW : 0, candles: false, slots: false, ladder: false },
      [],
      rng,
    );
  }
  return near;
}

/** Every book of a case with its bay, cell and compartment, for painters and tests. */
export function* stripBooks(strip: ShelfStrip): Generator<{ bay: Bay; cell: Cell; compartment: Compartment; book: ShelfBook }> {
  for (const bay of strip.bays) {
    for (const cell of bay.cells) {
      for (const compartment of cell.compartments) {
        for (const item of compartment.items) if (item.kind === "book") yield { bay, cell, compartment, book: item };
      }
    }
  }
}
