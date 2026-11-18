// Generic geometry helpers shared by every hub scene. Pure and DOM-free.
// measureCardCover and isBehindCards are the legacy two-column cover test kept
// for the scenes that still use it; new code uses the page model instead.

import { hashName } from "../guest-names-core.mjs";
import type { Rect, Vec } from "./types";

export { pointInRect, rectDistance, rectsIntersect } from "./rect";

export type { Rect, Vec };

export const TAU = Math.PI * 2;

/** `soft` rects are cards the scene may pass behind; hard rects hold text. */
export interface AvoidRect extends Rect {
  soft: boolean;
}

export interface Gutters {
  left: number;
  right: number;
  top: number;
  /** Height of the open strip above the page's topmost text. */
  clear: number;
}

export interface WindLut {
  /** Evenly spaced by arc length: x, y, unit tangent x, unit tangent y. */
  x: Float32Array;
  y: Float32Array;
  tx: Float32Array;
  ty: Float32Array;
  length: number;
}

/** The block of opaque cards, in page coordinates: anything fully behind it need not be drawn. */
export interface CardCover {
  left: number;
  right: number;
  top: number;
  bottom: number;
  gapLeft: number;
  gapRight: number;
}

/** FNV-1a 32-bit hash of a string. */
export const fnv1a: (text: string) => number = hashName;

export function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** The clear space around the cards at the top of the page (no scroll). */
export function measureGutters(width: number, height: number, avoid: readonly AvoidRect[]): Gutters {
  const cards = avoid.filter((r) => r.soft && r.w > 40 && r.h > 40);
  if (cards.length === 0) {
    return { left: width * 0.18, right: width * 0.18, top: height * 0.3, clear: height * 0.12 };
  }
  let left = width;
  let right = width;
  let top = height;
  for (const r of cards) {
    left = Math.min(left, r.x);
    right = Math.min(right, width - (r.x + r.w));
    top = Math.min(top, r.y);
  }
  let clear = top;
  for (const r of avoid) {
    if (!r.soft) clear = Math.min(clear, r.y);
  }
  return { left: Math.max(0, left), right: Math.max(0, right), top: clamp(top, 0, height), clear: clamp(clear, 0, height) };
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3);
}

/** Resamples a Catmull-Rom spline through `points` to `samples` points spaced evenly along its length. */
export function buildWindLut(points: readonly Vec[], samples = 256): WindLut {
  const raw: Vec[] = [];
  const steps = 32;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let j = 0; j < steps; j++) {
      const t = j / steps;
      raw.push({ x: catmullRom(p0.x, p1.x, p2.x, p3.x, t), y: catmullRom(p0.y, p1.y, p2.y, p3.y, t) });
    }
  }
  raw.push({ ...points[points.length - 1] });

  const dist = new Float64Array(raw.length);
  for (let i = 1; i < raw.length; i++) {
    dist[i] = dist[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y);
  }
  const length = dist[raw.length - 1];
  const lut: WindLut = {
    x: new Float32Array(samples),
    y: new Float32Array(samples),
    tx: new Float32Array(samples),
    ty: new Float32Array(samples),
    length,
  };
  let k = 0;
  for (let i = 0; i < samples; i++) {
    const target = (i / (samples - 1)) * length;
    while (k < raw.length - 2 && dist[k + 1] < target) k++;
    const span = dist[k + 1] - dist[k];
    const f = span > 0 ? (target - dist[k]) / span : 0;
    lut.x[i] = lerp(raw[k].x, raw[k + 1].x, f);
    lut.y[i] = lerp(raw[k].y, raw[k + 1].y, f);
  }
  for (let i = 0; i < samples; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(samples - 1, i + 1);
    const dx = lut.x[b] - lut.x[a];
    const dy = lut.y[b] - lut.y[a];
    const d = Math.hypot(dx, dy) || 1;
    lut.tx[i] = dx / d;
    lut.ty[i] = dy / d;
  }
  return lut;
}

export function measureCardCover(avoid: readonly AvoidRect[]): CardCover | null {
  const cards = avoid.filter((r) => r.soft && r.w > 40 && r.h > 40);
  if (cards.length === 0) return null;
  const firstY = Math.min(...cards.map((r) => r.y));
  const row = cards.filter((r) => Math.abs(r.y - firstY) < 8).sort((a, b) => a.x - b.x);
  return {
    left: Math.min(...cards.map((r) => r.x)),
    right: Math.max(...cards.map((r) => r.x + r.w)),
    top: firstY,
    bottom: Math.max(...cards.map((r) => r.y + r.h)),
    gapLeft: row.length > 1 ? row[0].x + row[0].w : 0,
    gapRight: row.length > 1 ? row[1].x : 0,
  };
}

/** True when a sprite of radius `pad` at this screen position is hidden behind the cards. */
export function isBehindCards(cover: CardCover | null, x: number, y: number, scrollTop: number, pad: number): boolean {
  if (!cover) return false;
  const top = cover.top - scrollTop + pad;
  const bottom = cover.bottom - scrollTop - pad;
  if (y <= top || y >= bottom) return false;
  if (x <= cover.left + pad || x >= cover.right - pad) return false;
  return x < cover.gapLeft - pad || x > cover.gapRight + pad;
}
