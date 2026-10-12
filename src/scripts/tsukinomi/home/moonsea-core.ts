// The pure half of the /tsukinomi/ home sky ("the moon sea", moonsea-scene.ts):
// where things sit on a screen of a given size, how many of the last train's
// carriages are lit for a reader, when the train passes, when time stops for
// the petals, and how the scene dims under the concourse as the page scrolls.
// No DOM, no canvas and no clock of its own, so node --test covers all of it.
//
// The picture, back to front: a twilight sky with the low "sea of the moon"
// (a valley filled with cloud that the moon lights like water), three ridges
// of the Northern Alps, the track, the last train when it passes, and the
// abandoned platform in the foreground with its lamp, its station sign, the
// eave with the clock stopped at 7:14, and a spider lily by the steps. The
// left of a wide screen and the lower middle of a tall one stay calm and dark:
// the hero copy lies there.

/** The parts that have a carriage (and a station on the rail): 1 to 5. */
export const CARRIAGES = 5;

/** The first pass starts this long after the scene is ready, so the reader sees the platform first. */
export const FIRST_PASS_DELAY_S = 2.6;
export const PASS_INTERVAL_MIN_S = 34;
export const PASS_INTERVAL_MAX_S = 58;
/** Seconds the whole train takes to cross the screen, nose in to tail out. */
export const PASS_SECONDS = 9;

/** Every so often time stops for the petals (the story's frozen drift). */
export const FREEZE_EVERY_MIN_S = 13;
export const FREEZE_EVERY_MAX_S = 24;
export const FREEZE_HOLD_S = 1.7;
/** Petals within this many CSS pixels of the pointer stop where they are. */
export const POINTER_FREEZE_RADIUS = 96;

/** How dark the scene gets under the concourse, at most. */
export const SCROLL_VEIL_MAX = 0.62;

export interface Point {
  x: number;
  y: number;
}

export interface MoonseaLayout {
  width: number;
  height: number;
  /** A tall screen: the copy fills the middle, the scene keeps to the top and the bottom. */
  portrait: boolean;
  /** Narrow: the station sign and the clock are left out, the building shrinks to its eave. */
  compact: boolean;
  /** Short side, the unit most sizes are taken from. */
  unit: number;
  moon: Point & { r: number };
  /** Where the sea of cloud meets the foot of the far ridge. */
  horizonY: number;
  /** Tops of the three ridges at their highest, from far to near. */
  ridgeTops: [number, number, number];
  /** The rail heads the train runs on. */
  railY: number;
  /** Height of a carriage body, wheels to roof. */
  carHeight: number;
  carLength: number;
  /** The platform's front edge: everything below is platform. */
  platformY: number;
  /** Where the lamp post, the sign and the building stand on the platform. */
  groundY: number;
  lamp: Point & { postHeight: number };
  sign: (Point & { width: number }) | null;
  /** Left edge of the station building (it runs off the right of the screen). */
  buildingX: number;
  /** The eave's lowest point. */
  eaveY: number;
  clock: (Point & { r: number }) | null;
  bench: Point & { width: number };
  lily: Point;
}

export function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

export function layoutMoonsea(width: number, height: number): MoonseaLayout {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const portrait = h > w * 1.1;
  const compact = w < 760;
  const unit = Math.min(w, h);

  const horizonY = h * (portrait ? 0.5 : 0.585);
  const railY = h * (portrait ? 0.79 : 0.775);
  const carHeight = clamp(unit * 0.085, 30, 66);
  const platformY = railY + carHeight * 0.18;
  const groundY = platformY + (h - platformY) * (portrait ? 0.5 : 0.42);

  const moonR = clamp(unit * (portrait ? 0.085 : 0.078), 24, 78);
  const moon = {
    x: w * (portrait ? 0.7 : 0.735),
    y: h * (portrait ? 0.14 : 0.205),
    r: moonR,
  };

  const ridgeTops: [number, number, number] = [
    horizonY - h * (portrait ? 0.17 : 0.27),
    horizonY - h * (portrait ? 0.11 : 0.165),
    horizonY - h * (portrait ? 0.05 : 0.075),
  ];

  // Narrow landscape screens push the props right, clear of the title.
  const postHeight = clamp(groundY - h * (portrait ? 0.46 : 0.36), carHeight * 2.4, h * 0.6);
  const lamp = { x: w * (portrait ? 0.86 : compact ? 0.79 : 0.665), y: groundY, postHeight };
  const buildingX = w * (portrait ? 0.93 : compact ? 0.88 : 0.83);
  const eaveY = groundY - postHeight * (portrait ? 0.92 : 0.86);
  const sign = compact || portrait ? null : { x: w * 0.755, y: groundY, width: clamp(unit * 0.17, 96, 170) };
  const clock = compact || portrait ? null : { x: buildingX + w * 0.05, y: eaveY + carHeight * 0.55, r: clamp(unit * 0.026, 10, 22) };
  const bench = { x: w * (portrait ? 0.62 : compact ? 0.66 : 0.555), y: groundY, width: clamp(unit * 0.15, 70, 150) };
  // The spider lily grows at the lamp's foot, where its light reaches it.
  const lily = { x: lamp.x + carHeight * (portrait ? -1.2 : 1.1), y: h - (h - groundY) * 0.3 };

  return {
    width: w,
    height: h,
    portrait,
    compact,
    unit,
    moon,
    horizonY,
    ridgeTops,
    railY,
    carHeight,
    carLength: carHeight * 3.6,
    platformY,
    groundY,
    lamp,
    sign,
    buildingX,
    eaveY,
    clock,
    bench,
    lily,
  };
}

/**
 * Which carriages have their lamps on. Carriage i (0 first behind the cab)
 * belongs to part i + 1 and is lit once the reader has read that part, so a
 * new reader sees an empty, dark train and every finished part lights a car.
 * A value that is not a part number counts as nothing read.
 */
export function litCarriages(furthestRead: number | null | undefined, count: number = CARRIAGES): boolean[] {
  const read = typeof furthestRead === "number" && Number.isInteger(furthestRead) ? clamp(furthestRead, 0, count) : 0;
  return Array.from({ length: count }, (_, index) => index < read);
}

/** Seconds from the end of one pass to the start of the next, from a random draw in [0, 1). */
export function nextPassDelay(random: number): number {
  const r = Number.isFinite(random) ? clamp(random, 0, 1) : 0.5;
  return PASS_INTERVAL_MIN_S + r * (PASS_INTERVAL_MAX_S - PASS_INTERVAL_MIN_S);
}

/** Seconds until the next stop of time, from a random draw in [0, 1). */
export function nextFreezeDelay(random: number): number {
  const r = Number.isFinite(random) ? clamp(random, 0, 1) : 0.5;
  return FREEZE_EVERY_MIN_S + r * (FREEZE_EVERY_MAX_S - FREEZE_EVERY_MIN_S);
}

/**
 * How much of the petals' motion is left during a stop of time that started
 * `since` seconds ago: eases down to nothing, holds, and eases back, so a
 * petal never jumps. 1 outside a stop.
 */
export function freezeFactor(since: number): number {
  if (!Number.isFinite(since) || since < 0) return 1;
  const easeIn = 0.35;
  const easeOut = 0.6;
  if (since < easeIn) return 1 - smooth(since / easeIn);
  if (since < easeIn + FREEZE_HOLD_S) return 0;
  const back = since - easeIn - FREEZE_HOLD_S;
  if (back < easeOut) return smooth(back / easeOut);
  return 1;
}

/** How much a petal at `distance` from the pointer still moves: 0 at the pointer, 1 past the radius. */
export function pointerFreeze(distance: number, radius: number = POINTER_FREEZE_RADIUS): number {
  if (!Number.isFinite(distance) || radius <= 0) return 1;
  return smooth(clamp(distance / radius, 0, 1));
}

/** Where the train's nose is at `u` (0..1) of a pass: it enters from the right and leaves on the left. */
export function trainNoseX(u: number, width: number, trainLength: number): number {
  const p = clamp(u, 0, 1);
  const from = width + 8;
  const to = -trainLength - 8;
  return from + (to - from) * p;
}

/**
 * The darkening laid over the scene as the page scrolls into the concourse:
 * nothing over the hero, SCROLL_VEIL_MAX by the time a screen has scrolled.
 */
export function scrollVeil(scrollY: number, viewportHeight: number): number {
  if (!(viewportHeight > 0) || !Number.isFinite(scrollY)) return 0;
  return SCROLL_VEIL_MAX * smooth(clamp(scrollY / (viewportHeight * 0.85), 0, 1));
}

/** How many petals drift on a screen of this size. */
export function petalCount(width: number, height: number): number {
  return Math.round(clamp((width * height) / 15000, 26, 84));
}

function smooth(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}
