// The pure half of the passing train on the /tsukinomi/ home hero (design 4.4
// and section 5): how long one pass lasts, how the carriages and their windows
// are laid out for a canvas of a given size, and which window shows which
// illustration or a passenger silhouette. No DOM and no canvas here, so
// node --test covers all of it; train-scene.ts paints what this module plans and
// train-loader.ts decides whether the scene is downloaded at all.
//
// One pass per page load. The timeline is lead (the atmosphere fades in while
// the train is still off screen), travel (the train crosses the canvas at one
// constant speed, from one edge to the other, never stopping) and tail (the
// atmosphere fades out), 8 to 12 seconds in all, picked by the seed.
//
// What is seeded: the direction, 4 or 5 carriages, the length of the pass, which
// windows hold the film frames, which pictures are drawn and the passengers. A
// scene given the same seed and the same reading progress plans the same train.
//
// Spoiler rule (design 4.4: frames of parts the reader has not reached are dark
// silhouettes, so new readers see no later scenes). The train has a fixed row of
// FRAME_WINDOWS film-frame windows. The pictures that may fill them are exactly
// illustrationsUpTo(catalog, furthestRead) from concourse-core.ts: an
// illustration of a part above the furthest part READ (a read mark, not merely an
// opened part) is never planned, so it is never requested from the network. A
// frame window with no allowed picture left is a lit window with a dark
// passenger silhouette. So:
//
//   a brand-new reader (nothing read, or only the prologue) sees every window lit,
//   about two thirds of them with a dark passenger silhouette, no picture at
//   all, and the page requests no illustration;
//   a reader who has read parts 1 to 3 sees pictures from those parts only, as
//   many as fit (at most FRAME_WINDOWS), the rest of the frame row silhouettes;
//   a reader who has read every part sees FRAME_WINDOWS pictures out of all 18,
//   a different eight on each visit.
//
// The pictures keep the story's order along the train, head first. At most
// FRAME_WINDOWS illustrations are downloaded per pass (a few MB for the whole
// book would be a lot to spend on decoration), and none at all when the
// connection asks to save data.
//
// Geometry. Window 0 is the head-most window and indexes grow toward the tail,
// so "story order" and "order of appearance" are the same thing whichever way the
// train runs; layoutTrain() turns an index into a rectangle in sprite
// coordinates (0 at the sprite's left edge) for the direction. Everything scales
// from the canvas height, so the train looks the same on every screen and only its
// travel distance depends on the width.
import { createRng } from "../../_shared/scene-runtime";
import { illustrationsUpTo, type IllustrationEntry } from "./concourse-core";

// ---- constants --------------------------------------------------------------

/** Windows that can hold a film frame. This is also the most pictures a pass downloads. */
export const FRAME_WINDOWS = 8;
export const CARRIAGES_MIN = 4;
export const CARRIAGES_MAX = 5;
export const WINDOWS_PER_CARRIAGE = 4;
/** One pass in all, seconds: lead + travel + tail. */
export const PASS_SECONDS_MIN = 8;
export const PASS_SECONDS_MAX = 12;
export const LEAD_SECONDS = 0.8;
export const TAIL_SECONDS = 0.8;
/** The size a film frame's grade is drawn for (its edge is scaled from it), and what a window never needs to be larger than at a 1.5 DPR cap. */
export const FRAME_BITMAP = { width: 96, height: 120 } as const;
/** Window width over height. The illustrations are 2:3 portraits, so the windows are tall. */
export const WINDOW_ASPECT = 0.8;

// ---- catalogue --------------------------------------------------------------

/**
 * The catalogue the page embeds in the mount's data-illustrations: a JSON array
 * of { src, part }. Returns the entries as IllustrationEntry with `file` holding
 * the URL, which is what illustrationsUpTo() filters. Anything that is not an
 * object with a non-empty string src and an integer or null part is dropped;
 * garbage in gives an empty catalogue, never a throw.
 */
export function parseCatalog(raw: string | null | undefined): IllustrationEntry[] {
  if (typeof raw !== "string" || raw === "") return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const entries: IllustrationEntry[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const { src, part } = item as { src?: unknown; part?: unknown };
    if (typeof src !== "string" || src.trim() === "") continue;
    if (part !== null && !(typeof part === "number" && Number.isInteger(part))) continue;
    entries.push({ file: src, part });
  }
  return entries;
}

/** The slice of navigator.connection the train looks at. */
export interface ConnectionHint {
  saveData?: boolean;
  effectiveType?: string;
}

/** False when the reader asked to save data or is on a 2G link: the train still passes, with silhouettes only. */
export function connectionAllowsFrames(connection: ConnectionHint | null | undefined): boolean {
  if (!connection) return true;
  if (connection.saveData === true) return false;
  return connection.effectiveType !== "slow-2g" && connection.effectiveType !== "2g";
}

// ---- timeline ---------------------------------------------------------------

export interface Timeline {
  lead: number;
  travel: number;
  tail: number;
  total: number;
}

/** A timeline of `total` seconds (clamped to the 8 to 12 s range) with the fixed lead and tail. */
export function makeTimeline(total: number): Timeline {
  const clamped = Math.min(PASS_SECONDS_MAX, Math.max(PASS_SECONDS_MIN, Number.isFinite(total) ? total : PASS_SECONDS_MIN));
  return { lead: LEAD_SECONDS, tail: TAIL_SECONDS, travel: clamped - LEAD_SECONDS - TAIL_SECONDS, total: clamped };
}

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const smooth = (value: number) => {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
};

/** How far across the train is, 0 before it enters and 1 once it has left; linear in time (constant speed). */
export function progressAt(t: number, timeline: Timeline): number {
  if (!Number.isFinite(t)) return 0;
  return clamp01((t - timeline.lead) / timeline.travel);
}

/** Strength of the atmosphere (mist, platform) around the pass: 0 to 1 over the lead, 1 to 0 over the tail. */
export function envelopeAt(t: number, timeline: Timeline): number {
  if (!Number.isFinite(t) || t <= 0 || t >= timeline.total) return 0;
  const rise = smooth(t / timeline.lead);
  const fall = smooth((timeline.total - t) / timeline.tail);
  return Math.min(rise, fall);
}

export const isFinished = (t: number, timeline: Timeline) => Number.isFinite(t) && t >= timeline.total;

// ---- the plan ---------------------------------------------------------------

export type WindowKind = "frame" | "silhouette" | "empty";
export type FigureShape = "adult" | "child" | "pair";

export interface WindowPlan {
  /** 0 is the head-most window. */
  index: number;
  carriage: number;
  kind: WindowKind;
  /** The illustration URL of a "frame" window; absent otherwise. */
  src?: string;
  /** What a "silhouette" window shows. dx is the horizontal offset in half-window units (-1..1), scale 0.85 to 1.1. */
  figure?: { shape: FigureShape; dx: number; scale: number };
  /** Blind pulled down over an "empty" window, as a share of its height. */
  blind?: number;
  /** Phase of this window's lamp flicker, radians. */
  phase: number;
  /** Whether this window belongs to the film-frame row, whatever it ends up showing. */
  frameRow: boolean;
}

export interface TrainPlan {
  seed: number;
  /** 1 runs left to right (head at the right end of the sprite), -1 right to left. */
  direction: 1 | -1;
  carriages: number;
  timeline: Timeline;
  windows: WindowPlan[];
  /** The distinct pictures to request, in train order. Always a subset of what the spoiler rule allows. */
  frames: string[];
}

export interface PlanInput {
  seed: number;
  /** The page's catalogue, as parseCatalog() returns it. */
  catalog: readonly IllustrationEntry[];
  /** ReadState.furthestRead from concourse-core: the furthest part READ, or null. */
  furthestRead: number | null | undefined;
  /** False for no pictures whatever the reader has read (save-data). Default true. */
  allowFrames?: boolean;
}

/** n distinct positions, one in each of n consecutive blocks of [0, count): spread out, increasing, seeded. */
function spreadPositions(count: number, n: number, rng: () => number): number[] {
  const positions: number[] = [];
  for (let j = 0; j < n; j++) {
    const start = Math.floor((j * count) / n);
    const end = Math.max(start + 1, Math.floor(((j + 1) * count) / n));
    positions.push(start + Math.floor(rng() * (end - start)));
  }
  return positions;
}

function pickFigure(rng: () => number): NonNullable<WindowPlan["figure"]> {
  const roll = rng();
  const shape: FigureShape = roll < 0.62 ? "adult" : roll < 0.8 ? "child" : "pair";
  return { shape, dx: Number((rng() * 1.2 - 0.6).toFixed(3)), scale: Number((0.9 + rng() * 0.2).toFixed(3)) };
}

export function planTrain(input: PlanInput): TrainPlan {
  const rng = createRng(input.seed);
  const direction: 1 | -1 = rng() < 0.5 ? 1 : -1;
  const carriages = CARRIAGES_MIN + (rng() < 0.5 ? 0 : CARRIAGES_MAX - CARRIAGES_MIN);
  const timeline = makeTimeline(PASS_SECONDS_MIN + (PASS_SECONDS_MAX - PASS_SECONDS_MIN) * rng());
  const count = carriages * WINDOWS_PER_CARRIAGE;

  // The frame row: FRAME_WINDOWS windows spread along the train.
  const rowSize = Math.min(FRAME_WINDOWS, count);
  const row = spreadPositions(count, rowSize, rng);

  // Which pictures may be shown, and which of the row's windows get one. Story
  // order is the catalogue order (part, then name), kept along the train head first.
  const allowed = input.allowFrames === false ? [] : illustrationsUpTo(input.catalog, input.furthestRead);
  const shown = Math.min(rowSize, allowed.length);
  const pool = allowed.map((_, index) => index);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, shown).sort((a, b) => a - b);
  const slots = row.map((_, index) => index);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const framed = slots.slice(0, shown).sort((a, b) => a - b);
  const srcByWindow = new Map<number, string>();
  framed.forEach((slot, order) => srcByWindow.set(row[slot], allowed[chosen[order]].file));

  const windows: WindowPlan[] = [];
  for (let index = 0; index < count; index++) {
    const base = {
      index,
      carriage: Math.floor(index / WINDOWS_PER_CARRIAGE),
      phase: Number((rng() * Math.PI * 2).toFixed(3)),
      frameRow: row.includes(index),
    };
    const src = srcByWindow.get(index);
    if (src !== undefined) {
      windows.push({ ...base, kind: "frame", src });
    } else if (base.frameRow || rng() < 0.45) {
      windows.push({ ...base, kind: "silhouette", figure: pickFigure(rng) });
    } else {
      windows.push({ ...base, kind: "empty", blind: [0, 0, 0.3, 0.55][Math.floor(rng() * 4)] });
    }
  }

  return {
    seed: input.seed,
    direction,
    carriages,
    timeline,
    windows,
    frames: windows.flatMap((window) => (window.src === undefined ? [] : [window.src])),
  };
}

// ---- layout -----------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TrainLayout {
  /** Canvas size the layout was made for, CSS px. */
  width: number;
  height: number;
  direction: 1 | -1;
  /** Height of the platform strip at the bottom edge, which hides the train's wheels. The body ends at its lip. */
  groundH: number;
  bodyTop: number;
  bodyBottom: number;
  /** Sprite length, nose included. */
  length: number;
  noseW: number;
  carriageW: number;
  carriageGap: number;
  /** Door panel width at each end of a carriage. */
  doorW: number;
  /** Carriage rectangles, head-most first, in sprite coordinates. */
  carriages: Rect[];
  /** Window rectangles by window index, head-most first, in sprite coordinates. */
  windows: Rect[];
}

/**
 * Carriages and windows for a canvas, in sprite coordinates (0 at the sprite's
 * left edge). Everything scales from the canvas height.
 */
export function layoutTrain(size: { width: number; height: number }, carriages: number, direction: 1 | -1): TrainLayout {
  const height = Math.max(1, size.height);
  const groundH = Math.round(height * 0.16);
  const bodyH = Math.round(height * 0.64);
  // The body ends 1 px under the platform strip's lip, so the wheels are behind the strip.
  const bodyBottom = height - groundH + 1;
  const bodyTop = bodyBottom - bodyH;

  const windowH = Math.round(bodyH * 0.5);
  const windowW = Math.round(windowH * WINDOW_ASPECT);
  const windowY = bodyTop + Math.round(bodyH * 0.2);
  const pitch = Math.round(windowW * 1.45);
  const doorW = windowW;
  const carriageW = 2 * doorW + WINDOWS_PER_CARRIAGE * pitch;
  const carriageGap = Math.max(4, Math.round(height * 0.05));
  const noseW = Math.round(bodyH * 0.5);
  const length = noseW + carriages * carriageW + (carriages - 1) * carriageGap;

  // `s` is the distance from the head tip along the train; a span [s0, s1] becomes x-range per direction.
  const span = (s0: number, s1: number) => (direction > 0 ? length - s1 : s0);
  const carriageRects: Rect[] = [];
  const windowRects: Rect[] = [];
  for (let k = 0; k < carriages; k++) {
    const s0 = noseW + k * (carriageW + carriageGap);
    carriageRects.push({ x: span(s0, s0 + carriageW), y: bodyTop, w: carriageW, h: bodyH });
    for (let j = 0; j < WINDOWS_PER_CARRIAGE; j++) {
      const w0 = s0 + doorW + j * pitch + Math.round((pitch - windowW) / 2);
      windowRects.push({ x: span(w0, w0 + windowW), y: windowY, w: windowW, h: windowH });
    }
  }
  return {
    width: size.width,
    height,
    direction,
    groundH,
    bodyTop,
    bodyBottom,
    length,
    noseW,
    carriageW,
    carriageGap,
    doorW,
    carriages: carriageRects,
    windows: windowRects,
  };
}

/**
 * Left edge of the sprite on the canvas at progress u (0..1): fully off screen
 * at both ends and moving at one constant speed in between.
 */
export function trainX0(u: number, width: number, length: number, direction: 1 | -1): number {
  const p = clamp01(Number.isFinite(u) ? u : 0);
  const travel = width + length;
  return direction > 0 ? -length + p * travel : width - p * travel;
}

// ---- motion for the compositor ----------------------------------------------
//
// Nothing is redrawn while the train passes. Its picture is painted once, whole,
// and two things move on the compositor: the whole train, carried across by one
// transform over the travel part of the pass at the one constant speed it always
// had, and the atmosphere behind it, faded in and out by an opacity. In a browser
// that rasterises in software a canvas that is redrawn every frame costs the main
// thread a fixed amount plus its area however little is drawn in it.

/** Where the sprite's left edge is at the start and at the end of the travel: the carrying animation is a straight line between them. */
export function travelEnds(width: number, length: number, direction: 1 | -1): { from: number; to: number } {
  return { from: trainX0(0, width, length, direction), to: trainX0(1, width, length, direction) };
}

export interface EnvelopeStep {
  /** Position in the whole pass, 0 to 1. */
  offset: number;
  /** envelopeAt at that moment. */
  value: number;
}

/**
 * The atmosphere's strength over the whole pass as opacity keyframes: sampled
 * `perEdge` times over the lead and again over the tail, where it changes, and
 * only at the ends of the plateau between them.
 */
export function envelopeSteps(timeline: Timeline, perEdge = 8): EnvelopeStep[] {
  const count = Math.max(2, Math.round(perEdge));
  const times: number[] = [];
  for (let index = 0; index <= count; index++) times.push((timeline.lead * index) / count);
  for (let index = 0; index <= count; index++) times.push(timeline.total - timeline.tail + (timeline.tail * index) / count);
  return times.map((t) => ({ offset: t / timeline.total, value: envelopeAt(t, timeline) }));
}

/** A clock that can be paused, in the units of `now`: how long the pass has really been running. */
export interface PassClock {
  start(): void;
  hold(): void;
  release(): void;
  elapsedMs(): number;
  readonly started: boolean;
  readonly held: boolean;
}

export function createPassClock(now: () => number = () => performance.now()): PassClock {
  let startedAt = -1;
  let heldAt = -1;
  let heldTotal = 0;
  return {
    start() {
      if (startedAt < 0) startedAt = now();
    },
    hold() {
      if (startedAt >= 0 && heldAt < 0) heldAt = now();
    },
    release() {
      if (heldAt >= 0) {
        heldTotal += now() - heldAt;
        heldAt = -1;
      }
    },
    elapsedMs() {
      if (startedAt < 0) return 0;
      const upTo = heldAt >= 0 ? heldAt : now();
      return Math.max(0, upTo - startedAt - heldTotal);
    },
    get started() {
      return startedAt >= 0;
    },
    get held() {
      return heldAt >= 0;
    },
  };
}
