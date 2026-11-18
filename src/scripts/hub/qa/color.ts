// Colour arithmetic for the hub contrast contract (spec 2.20, 8.3 item 9, 8.4 item 23):
// CSS colour parsing with var() substitution, alpha compositing, WCAG contrast,
// and color-mix(in oklch, ...) as CSS Color 5 defines it.

import { splitTopLevel } from "./css";

/** sRGB channels 0..1 (may leave the gamut after oklch arithmetic), alpha 0..1. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Oklch {
  l: number;
  c: number;
  /** Degrees, or NaN when powerless (achromatic). */
  h: number;
  a: number;
}

const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  lime: "#00ff00",
  blue: "#0000ff",
  transparent: "#00000000",
};

export type Vars = ReadonlyMap<string, string>;

/** Replaces var(--x, fallback) recursively. Throws on a missing variable without fallback or on a cycle. */
export function substituteVars(value: string, vars: Vars, seen: readonly string[] = []): string {
  let out = "";
  let i = 0;
  while (i < value.length) {
    const start = value.indexOf("var(", i);
    if (start < 0) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, start);
    let depth = 0;
    let end = start + 3;
    for (; end < value.length; end++) {
      if (value[end] === "(") depth++;
      else if (value[end] === ")" && --depth === 0) break;
    }
    if (end >= value.length) throw new Error(`unbalanced var() in "${value}"`);
    const inner = value.slice(start + 4, end);
    const comma = splitTopLevel(inner);
    const name = comma[0].trim();
    const fallbackStart = inner.indexOf(",");
    const fallback = fallbackStart >= 0 ? inner.slice(fallbackStart + 1).trim() : null;
    if (seen.includes(name)) throw new Error(`var() cycle through ${name}`);
    const raw = vars.get(name);
    if (raw !== undefined) out += substituteVars(raw, vars, [...seen, name]);
    else if (fallback !== null) out += substituteVars(fallback, vars, seen);
    else throw new Error(`undefined variable ${name}`);
    i = end + 1;
  }
  return out.trim();
}

function channel(text: string, scale: number): number {
  const t = text.trim();
  if (t === "none") return 0;
  if (t.endsWith("%")) return (Number(t.slice(0, -1)) / 100) * scale;
  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error(`bad channel "${text}"`);
  return n;
}

function alphaOf(text: string | undefined): number {
  if (text === undefined) return 1;
  const t = text.trim();
  const n = t.endsWith("%") ? Number(t.slice(0, -1)) / 100 : Number(t);
  if (!Number.isFinite(n)) throw new Error(`bad alpha "${text}"`);
  return Math.min(1, Math.max(0, n));
}

/** "a b c / d" or "a, b, c, d" into channel strings and alpha. */
function fnArgs(inner: string): { ch: string[]; alpha?: string } {
  if (inner.includes(",")) {
    const parts = splitTopLevel(inner);
    return { ch: parts.slice(0, 3), alpha: parts[3] };
  }
  const [main, alpha] = inner.split("/");
  return { ch: main.trim().split(/\s+/), alpha: alpha?.trim() };
}

function hexToRgba(hex: string): Rgba {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) throw new Error(`bad hex colour ${hex}`);
  const n = (k: number) => parseInt(h.slice(k, k + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
}

/** Parses one CSS colour (after var() substitution when vars are given). */
export function parseColor(text: string, vars: Vars = new Map()): Rgba {
  const value = substituteVars(text, vars).trim();
  const lower = value.toLowerCase();
  if (lower in NAMED) return hexToRgba(NAMED[lower]);
  if (lower.startsWith("#")) return hexToRgba(lower);
  const fn = /^([a-z-]+)\(([\s\S]*)\)$/.exec(lower);
  if (!fn) throw new Error(`unsupported colour "${value}"`);
  const [, name, inner] = fn;
  if (name === "rgb" || name === "rgba") {
    const { ch, alpha } = fnArgs(inner);
    if (ch.length !== 3) throw new Error(`bad rgb() "${value}"`);
    const [r, g, b] = ch.map((c) => channel(c, 255) / 255);
    return { r, g, b, a: alphaOf(alpha) };
  }
  if (name === "hsl" || name === "hsla") {
    const { ch, alpha } = fnArgs(inner);
    const h = Number(ch[0].replace(/deg$/, ""));
    const s = channel(ch[1], 100) / 100;
    const l = channel(ch[2], 100) / 100;
    const k = (n: number) => (n + h / 30) % 12;
    const f = (n: number) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return { r: f(0), g: f(8), b: f(4), a: alphaOf(alpha) };
  }
  if (name === "oklch") {
    const { ch, alpha } = fnArgs(inner);
    const l = channel(ch[0], 1);
    const c = channel(ch[1], 0.4);
    const h = ch[2].trim() === "none" ? Number.NaN : Number(ch[2].replace(/deg$/, ""));
    return oklchToRgba({ l, c, h, a: alphaOf(alpha) });
  }
  if (name === "color-mix") return colorMix(inner, vars);
  throw new Error(`unsupported colour function "${name}"`);
}

/* ---------------------------------------------------------------- oklch */

const toLinear = (c: number) => (Math.abs(c) <= 0.04045 ? c / 12.92 : Math.sign(c) * ((Math.abs(c) + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (Math.abs(c) <= 0.0031308 ? 12.92 * c : Math.sign(c) * (1.055 * Math.abs(c) ** (1 / 2.4) - 0.055));

export function rgbaToOklch(c: Rgba): Oklch {
  const r = toLinear(c.r);
  const g = toLinear(c.g);
  const b = toLinear(c.b);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.hypot(A, B);
  // CSS Color 4: hue is powerless for achromatic colours.
  const h = C < 2e-4 ? Number.NaN : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c: C, h, a: c.a };
}

/** A missing (NaN) hue renders as 0 degrees, as CSS treats missing components. */
export function oklchToRgba(c: Oklch): Rgba {
  const hr = Number.isNaN(c.h) ? 0 : (c.h * Math.PI) / 180;
  const A = c.c * Math.cos(hr);
  const B = c.c * Math.sin(hr);
  const l_ = c.l + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = c.l - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = c.l - 0.0894841775 * A - 1.291485548 * B;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return {
    r: toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: c.a,
  };
}

/**
 * Chroma below which Chrome treats a colour converted into oklch (from hex, rgb() and the like)
 * as having a missing hue when it interpolates. Measured against Chrome's color-mix output
 * (C 0.0198 loses its hue, C 0.0210 keeps it); colours written as oklch() keep their hue.
 */
export const CHROME_ACHROMATIC_C = 0.02;

/** A colour as color-mix(in oklch) sees it: oklch() and nested oklch mixes keep their hue. */
function mixInput(text: string, vars: Vars): Oklch {
  const value = substituteVars(text, vars).trim().toLowerCase();
  const fn = /^(oklch|color-mix)\(([\s\S]*)\)$/.exec(value);
  if (fn?.[1] === "oklch") {
    const { ch, alpha } = fnArgs(fn[2]);
    const h = ch[2].trim() === "none" ? Number.NaN : Number(ch[2].replace(/deg$/, ""));
    return { l: channel(ch[0], 1), c: channel(ch[1], 0.4), h, a: alphaOf(alpha) };
  }
  if (fn?.[1] === "color-mix") return colorMixOklch(fn[2], vars);
  const o = rgbaToOklch(parseColor(value, vars));
  return o.c < CHROME_ACHROMATIC_C ? { ...o, h: Number.NaN } : o;
}

function colorMix(inner: string, vars: Vars): Rgba {
  return oklchToRgba(colorMixOklch(inner, vars));
}

/** color-mix(in oklch, A p1, B p2) per CSS Color 5: percentage normalisation, premultiplied alpha, shorter hue. */
function colorMixOklch(inner: string, vars: Vars): Oklch {
  const parts = splitTopLevel(inner);
  if (parts.length !== 3 || !/^in\s+oklch(\s+shorter\s+hue)?$/i.test(parts[0])) {
    throw new Error(`only color-mix(in oklch, a, b) is supported, got "${inner}"`);
  }
  const side = (text: string) => {
    const m = /^(.*?)(?:\s+(-?\d*\.?\d+)%)?$/s.exec(text.trim()) as RegExpExecArray;
    let colour = m[1];
    let pct = m[2] === undefined ? null : Number(m[2]);
    const lead = /^(-?\d*\.?\d+)%\s+(.*)$/s.exec(text.trim());
    if (lead) {
      pct = Number(lead[1]);
      colour = lead[2];
    }
    return { colour: mixInput(colour, vars), pct };
  };
  const a = side(parts[1]);
  const b = side(parts[2]);
  let p1 = a.pct;
  let p2 = b.pct;
  if (p1 === null && p2 === null) {
    p1 = 50;
    p2 = 50;
  } else if (p1 === null) p1 = 100 - (p2 as number);
  else if (p2 === null) p2 = 100 - p1;
  const sum = (p1 as number) + (p2 as number);
  if (sum <= 0) throw new Error("color-mix percentages sum to 0");
  const w2 = (p2 as number) / sum;
  const alphaScale = sum < 100 ? sum / 100 : 1;
  return mixOklch(a.colour, b.colour, w2, alphaScale);
}

/** Interpolates in oklch with premultiplied alpha; w2 is the weight of `b`. Missing (NaN) hues take the other side's. */
export function mixOklch(ca: Oklch, cb: Oklch, w2: number, alphaScale = 1): Oklch {
  let ha = ca.h;
  let hb = cb.h;
  if (Number.isNaN(ha) && !Number.isNaN(hb)) ha = hb;
  if (Number.isNaN(hb) && !Number.isNaN(ha)) hb = ha;
  let h = Number.NaN;
  if (!Number.isNaN(ha) && !Number.isNaN(hb)) {
    let d = hb - ha;
    if (d > 180) ha += 360;
    else if (d < -180) hb += 360;
    d = hb - ha;
    h = (((ha + d * w2) % 360) + 360) % 360;
  }
  const w1 = 1 - w2;
  const alpha = ca.a * w1 + cb.a * w2;
  const pre = (x: number, y: number) => (alpha === 0 ? 0 : (x * ca.a * w1 + y * cb.a * w2) / alpha);
  return { l: pre(ca.l, cb.l), c: pre(ca.c, cb.c), h, a: alpha * alphaScale };
}

/** True when every channel is inside 0..1 (with a tiny tolerance). */
export function inGamut(c: Rgba, eps = 1e-6): boolean {
  return [c.r, c.g, c.b].every((v) => v >= -eps && v <= 1 + eps);
}

export const clipToGamut = (c: Rgba): Rgba => ({
  r: Math.min(1, Math.max(0, c.r)),
  g: Math.min(1, Math.max(0, c.g)),
  b: Math.min(1, Math.max(0, c.b)),
  a: c.a,
});

/** CSS Color 4 gamut mapping: reduce oklch chroma until the clipped colour is within deltaEOK 0.02. */
export function gamutMapCss(c: Rgba): Rgba {
  if (inGamut(c)) return c;
  const o = rgbaToOklch(c);
  if (o.l >= 1) return { r: 1, g: 1, b: 1, a: c.a };
  if (o.l <= 0) return { r: 0, g: 0, b: 0, a: c.a };
  const deltaE = (x: Rgba, y: Rgba) => {
    const p = rgbaToOklch(x);
    const q = rgbaToOklch(y);
    const hp = Number.isNaN(p.h) ? 0 : (p.h * Math.PI) / 180;
    const hq = Number.isNaN(q.h) ? 0 : (q.h * Math.PI) / 180;
    return Math.hypot(p.l - q.l, p.c * Math.cos(hp) - q.c * Math.cos(hq), p.c * Math.sin(hp) - q.c * Math.sin(hq));
  };
  let lo = 0;
  let hi = o.c;
  let minInGamut = true;
  let current = c;
  const clipped0 = clipToGamut(c);
  if (deltaE(clipped0, c) < 0.02) return clipped0;
  while (hi - lo > 0.0001) {
    const chroma = (lo + hi) / 2;
    current = oklchToRgba({ ...o, c: chroma });
    if (minInGamut && inGamut(current)) {
      lo = chroma;
      continue;
    }
    const clipped = clipToGamut(current);
    const e = deltaE(clipped, current);
    if (e < 0.02) {
      if (0.02 - e < 0.0001) return clipped;
      minInGamut = false;
      lo = chroma;
    } else hi = chroma;
  }
  return clipToGamut(current);
}

/* ---------------------------------------------------------------- compositing and contrast */

/** Source-over compositing of `fg` on `bg` (both straight alpha). */
export function over(fg: Rgba, bg: Rgba): Rgba {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (f: number, b: number) => (f * fg.a + b * bg.a * (1 - fg.a)) / a;
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a };
}

/** Composites layers bottom-first; the bottom layer must be opaque. */
export function flatten(...layers: Rgba[]): Rgba {
  if (!layers.length || layers[0].a < 1 - 1e-9) throw new Error("the bottom layer must be opaque");
  return layers.slice(1).reduce((acc, layer) => over(layer, acc), layers[0]);
}

export function withAlpha(c: Rgba, a: number): Rgba {
  return { ...c, a: c.a * a };
}

export function relativeLuminance(c: Rgba): number {
  const k = clipToGamut(c);
  return 0.2126 * toLinear(k.r) + 0.7152 * toLinear(k.g) + 0.0722 * toLinear(k.b);
}

/** WCAG 2 contrast ratio of two opaque colours. */
export function contrast(a: Rgba, b: Rgba): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function toHex(c: Rgba): string {
  const k = clipToGamut(c);
  const h = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${h(k.r)}${h(k.g)}${h(k.b)}${k.a < 1 ? h(k.a) : ""}`;
}

/* ---------------------------------------------------------------- Gaussian plate (8.4 item 23) */

/** Standard normal CDF (Abramowitz and Stegun 7.1.26 via erf, error below 1.5e-7). */
export function normalCdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/**
 * Coverage of a blurred rectangle (CSS blur radius = Gaussian sigma) at a point `inset` px inside
 * its straight edge, or at a corner where both edges are `inset` px away.
 */
export function plateCoverage(insetPx: number, blurPx: number, where: "edge" | "corner"): number {
  if (blurPx <= 0) return insetPx >= 0 ? 1 : 0;
  const edge = normalCdf(insetPx / blurPx);
  return where === "edge" ? edge : edge * edge;
}
