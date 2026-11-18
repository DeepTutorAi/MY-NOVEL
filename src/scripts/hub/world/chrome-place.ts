// Pure placement on a top edge (spec 2.9 perches, 2.17 guide): the spot along an edge
// where a small box sitting on that edge stays clearest of text and control rects.
// No DOM access, so it imports cleanly in Node and is unit-tested.

import type { Rect } from "./types";

export interface EdgeSpot {
  /** Centre x of the box. */
  x: number;
  /** Top y of the box. */
  y: number;
  /** Gap to the nearest hole (Infinity when there is none). */
  clearance: number;
}

export interface EdgeOptions {
  /** Wanted gap to every hole. */
  clear: number;
  /** Most the box may sink below the edge (it is tried from this down to 0). */
  maxOverlap: number;
  /** Space kept between the box and the edge's ends. */
  margin: number;
  /** Distance between candidate positions. */
  step: number;
}

/** Shortest distance between two rects; 0 when they touch or overlap. */
export function rectGap(a: Rect, b: Rect): number {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
  return Math.hypot(dx, dy);
}

/**
 * Places a `size` box on the top edge of `edge`, starting at fraction `u` of its width.
 * Candidates are tried nearest to `u` first, each with the deepest overlap first; the
 * first one that keeps `clear` from every hole wins. Without such a spot the clearest
 * candidate wins, ties going to the one nearest `u`.
 */
export function spotOnEdge(edge: Rect, size: { w: number; h: number }, holes: readonly Rect[], u: number, options: EdgeOptions): EdgeSpot {
  const lo = edge.x + options.margin + size.w / 2;
  const hi = edge.x + edge.w - options.margin - size.w / 2;
  const want = edge.x + Math.min(1, Math.max(0, Number.isFinite(u) ? u : 0.5)) * edge.w;
  const preferred = hi < lo ? edge.x + edge.w / 2 : Math.min(hi, Math.max(lo, want));
  const xs = [preferred];
  if (hi >= lo) {
    const step = Math.max(1, options.step);
    for (let d = step; preferred - d >= lo || preferred + d <= hi; d += step) {
      if (preferred - d >= lo) xs.push(preferred - d);
      if (preferred + d <= hi) xs.push(preferred + d);
    }
  }
  const overlaps: number[] = [];
  for (let o = Math.max(0, options.maxOverlap); o > 0; o -= 2) overlaps.push(o);
  overlaps.push(0);

  let best: EdgeSpot | null = null;
  for (const x of xs) {
    for (const overlap of overlaps) {
      const y = edge.y - size.h + overlap;
      const box = { x: x - size.w / 2, y, w: size.w, h: size.h };
      let clearance = Number.POSITIVE_INFINITY;
      for (const hole of holes) clearance = Math.min(clearance, rectGap(box, hole));
      if (clearance >= options.clear) return { x, y, clearance };
      if (!best || clearance > best.clearance) best = { x, y, clearance };
    }
  }
  return best ?? { x: preferred, y: edge.y - size.h, clearance: Number.POSITIVE_INFINITY };
}

/** A point on a cubic Bezier from p0 to p3 at t (0..1). */
export function bezierPoint(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const s = 1 - t;
  return s * s * s * p0 + 3 * s * s * t * p1 + 3 * s * t * t * p2 + t * t * t * p3;
}

/**
 * Flight offsets for the guide: `samples + 1` points from the start offset (dx, dy) to
 * (0, 0) along a cubic Bezier that arcs upward by up to 120 px, and the flight time
 * (900-1400 ms, longer for longer flights).
 */
export function flightPath(dx: number, dy: number, samples = 12): { points: { x: number; y: number }[]; ms: number } {
  const distance = Math.hypot(dx, dy);
  const lift = Math.min(120, distance * 0.35);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    points.push({
      x: bezierPoint(dx, dx * 0.7, dx * 0.3, 0, t),
      y: bezierPoint(dy, dy * 0.7 - lift, dy * 0.3 - lift, 0, t),
    });
  }
  return { points, ms: Math.round(Math.min(1400, Math.max(900, 900 + distance * 0.5))) };
}
