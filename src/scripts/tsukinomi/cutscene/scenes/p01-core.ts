// The pure rules of the prologue and part 1 cutscenes (prologue.ts,
// part-1-autumn-rain.ts): when the prologue starts and what that asks of the
// audio, its timeline after Play, the earphone wire's path, the station lamp's
// first flicker; part 1's fog parting by itself, the passing train, the drops
// that run down the glass and how clear the epigraph is. No DOM, no canvas,
// so node --test covers all of it.

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

export interface Point {
  x: number;
  y: number;
}

// ---- the prologue: waiting for Play ---------------------------------------------

/** The scene starts by itself, silent, when the reader has not pressed Play after this long. */
export const AUTO_START_MS = 6000;
/**
 * A reader who is on the Play button (hovering, focused or pressing it) holds
 * the countdown, so the scene does not start under their finger; but never for
 * longer than this in total.
 */
export const AUTO_START_CAP_MS = 12_000;

/** How long to wait from now, given how long the scene has been open. Never negative. */
export function autoStartDelayMs(openForMs: number, baseMs = AUTO_START_MS, capMs = AUTO_START_CAP_MS): number {
  const open = Number.isFinite(openForMs) ? Math.max(0, openForMs) : 0;
  return Math.max(0, Math.min(baseMs, capMs - open));
}

/** What starting the scene asks of the audio. */
export interface StartPlan {
  /** Ask the Walkman to switch itself on. Only a reader's own press is a gesture the browser accepts. */
  requestGesture: boolean;
  /** Play the scene's own tape click. The Walkman clicks by itself when it is switched on, so this is only for a Walkman that was on already. */
  ownClick: boolean;
}

/**
 * How the scene starts its sound. `pressedPlay`: the reader pressed the button (otherwise the
 * countdown ran out); `wasOn`: the Walkman was already on and not muted before this started.
 * Every call the plan leads to is a silent no-op while the Walkman is off.
 */
export function startPlan(pressedPlay: boolean, wasOn: boolean): StartPlan {
  return pressedPlay ? { requestGesture: true, ownClick: wasOn } : { requestGesture: false, ownClick: true };
}

export interface AutoStart {
  /** The reader is (true) or is no longer (false) on the Play button. */
  setEngaged(engaged: boolean): void;
  /** Stops the countdown for good (the scene started some other way, or is over). */
  cancel(): void;
}

/**
 * The countdown to the automatic start: `onStart` runs once, AUTO_START_MS after
 * the scene opened, unless the reader is on the Play button, which holds it; it
 * restarts when they leave, and never runs later than AUTO_START_CAP_MS in total.
 */
export function createAutoStart(onStart: () => void, now: () => number = () => performance.now()): AutoStart {
  const openedAt = now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let over = false;
  const stop = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const arm = () => {
    stop();
    timer = setTimeout(() => {
      if (over) return;
      over = true;
      onStart();
    }, autoStartDelayMs(now() - openedAt));
  };
  arm();
  return {
    setEngaged(engaged) {
      if (over) return;
      if (engaged) stop();
      else arm();
    },
    cancel() {
      over = true;
      stop();
    },
  };
}

// ---- the prologue: after Play -------------------------------------------------------
//
// Seconds after Play (or the automatic start). The tape starts, the wire is
// pulled out across the screen and splits, the subtitles come up slowly, then
// the room gives way to the stone steps, where the station lamp lights.

export const PROLOGUE = {
  /** The reels start turning and the little lamp on the Walkman comes on. */
  tapeOn: 0.15,
  wireStart: 0.6,
  wireEnd: 4.4,
  subtitlesStart: 1.0,
  /** From the first letter to the last. */
  subtitlesMs: 9000,
  dissolveStart: 11.5,
  dissolveEnd: 14,
  lampOn: 14.4,
  /** The scene ends this long after Play. */
  end: 22,
} as const;

/** The prologue's natural end in scene seconds, or Infinity while Play has not happened. */
export function prologueEnd(playAt: number | null): number {
  return playAt === null ? Infinity : playAt + PROLOGUE.end;
}

/** The latest the prologue can end: the countdown's cap, then the whole run after Play. */
export const PROLOGUE_MAX_END_S = AUTO_START_CAP_MS / 1000 + PROLOGUE.end;

/**
 * The station lamp's first light, `since` seconds after it was switched on:
 * two short stutters (dim, not dark, and well apart, so nothing flashes), then
 * it warms up to full. 0 before it is switched on.
 */
export function lampLevel(since: number): number {
  if (!Number.isFinite(since) || since < 0) return 0;
  if (since < 0.25) return 0.45 * smooth(since / 0.25);
  if (since < 0.6) return 0.25;
  if (since < 0.85) return 0.55;
  if (since < 1.2) return 0.3;
  return 0.3 + 0.7 * smooth(phase(since, 1.2, 2.6));
}

/** Points along a cubic Bézier, `samples` + 1 of them. */
export function bezier(p0: Point, p1: Point, p2: Point, p3: Point, samples = 40): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

/** Length along a polyline at each point. */
export function cumulativeLengths(points: readonly Point[]): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) out.push(out[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  return out;
}

/** The part of a polyline from its start to `fraction` (0..1) of its length, ending exactly there. */
export function pathUpTo(points: readonly Point[], fraction: number): Point[] {
  if (points.length === 0) return [];
  const lengths = cumulativeLengths(points);
  const total = lengths[lengths.length - 1];
  const target = clamp(fraction, 0, 1) * total;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (lengths[i] <= target) {
      out.push(points[i]);
      continue;
    }
    const span = lengths[i] - lengths[i - 1] || 1;
    const k = (target - lengths[i - 1]) / span;
    out.push({ x: points[i - 1].x + (points[i].x - points[i - 1].x) * k, y: points[i - 1].y + (points[i].y - points[i - 1].y) * k });
    break;
  }
  return out;
}

export interface Wire {
  /** From the jack to the split. */
  trunk: Point[];
  /** From the split up and out of the picture: the earbud someone is wearing. */
  worn: Point[];
  /** From the split down onto the table: the earbud nobody is wearing. */
  empty: Point[];
}

/**
 * The earphone wire from the Walkman's jack across the table: it runs right,
 * splits, and one branch rises out of the top of the screen while the other
 * curls down onto the table and ends in the empty earbud. `rest` is the
 * table's top edge; nothing lies above it but the rising branch.
 */
export function wireFor(jack: Point, width: number, height: number, rest: number): Wire {
  const split = { x: clamp(jack.x + width * 0.36, jack.x + 40, width * 0.82), y: rest + (height - rest) * 0.35 };
  const trunk = bezier(jack, { x: jack.x + width * 0.08, y: jack.y + height * 0.06 }, { x: split.x - width * 0.16, y: split.y + height * 0.08 }, split, 36);
  const worn = bezier(split, { x: split.x + width * 0.08, y: split.y - height * 0.08 }, { x: split.x + width * 0.04, y: height * 0.08 }, { x: split.x + width * 0.12, y: -height * 0.06 }, 36);
  const emptyEnd = { x: clamp(split.x + width * 0.14, 0, width * 0.94), y: rest + (height - rest) * 0.62 };
  const empty = bezier(split, { x: split.x + width * 0.02, y: split.y + height * 0.07 }, { x: emptyEnd.x - width * 0.09, y: emptyEnd.y + height * 0.04 }, emptyEnd, 30);
  return { trunk, worn, empty };
}

/** How far each part of the wire is drawn when `progress` (0..1) of the whole pull is done: the trunk first, then both branches together. */
export function wireProgress(progress: number): { trunk: number; branches: number } {
  const p = clamp(progress, 0, 1);
  return { trunk: smooth(phase(p, 0, 0.5)), branches: smooth(phase(p, 0.45, 1)) };
}

// ---- part 1: rain on the glass ----------------------------------------------------

export const PART1 = {
  /** The fog starts to part by itself, from the epigraph outwards. */
  autoClearStart: 1.0,
  /** By now the fog has parted all the way, whatever the reader did. */
  autoClearEnd: 5.6,
  trainStart: 9.5,
  trainDuration: 4.2,
  /** The rain eases off towards the end. */
  easeStart: 16.5,
  end: 20,
} as const;

/** The radius of the clearing the fog has parted to by itself at `t`, out to `reach`. */
export function autoClearRadius(t: number, reach: number): number {
  return reach * smooth(phase(t, PART1.autoClearStart, PART1.autoClearEnd));
}

/** Where the train's light is across the screen at `t`: 0 entering on the right, 1 gone on the left; null outside its pass. */
export function trainAt(t: number): number | null {
  if (t < PART1.trainStart || t > PART1.trainStart + PART1.trainDuration) return null;
  return phase(t, PART1.trainStart, PART1.trainStart + PART1.trainDuration);
}

/** How heavy the rain is: full, easing off at the end. */
export function rainLevel(t: number): number {
  return 1 - 0.55 * smooth(phase(t, PART1.easeStart, PART1.end));
}

/** Clearing steps for the epigraph: it sharpens in this many steps as the glass in front of it clears. */
export const REVEAL_STEPS = 10;

/**
 * How clear the epigraph is (0 hazed to 1 crisp) for the share of the glass in
 * front of it that is still fogged, in REVEAL_STEPS steps, so its style only
 * changes when a step is crossed.
 */
export function revealLevel(fogged: number): number {
  const clear = 1 - clamp(Number.isFinite(fogged) ? fogged : 1, 0, 1);
  return Math.round(smooth(phase(clear, 0.1, 0.85)) * REVEAL_STEPS) / REVEAL_STEPS;
}
