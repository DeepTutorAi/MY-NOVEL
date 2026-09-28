// Canvas atmosphere for Sea pages: one particle system whose profile follows
// body[data-zone]. Performance contract:
// - struct-of-arrays pools sized to MAX_PARTICLES, no allocation per frame;
// - no layout reads per frame: the prose column and chapter end are measured on
//   start, resize, settings change, font load and prose/article resize, then
//   projected with scrollY;
// - palette tokens are read once per zone change, never per particle or frame.
// The helpers above startAtmosphere() are pure so they can be unit tested.

import { isSeaZone, type SeaZone } from "../../../data/sea/zones";
import {
  ATMOSPHERE_PROFILES,
  KIND_COUNT,
  MAX_FOG_SPRITES,
  PALETTE_TOKENS,
  PARTICLE_KINDS,
  type AtmosphereProfile,
  type PaletteToken,
} from "./profiles";

export const MAX_PARTICLES = 120;
export const MOBILE_PARTICLES = 50;
export const SMALL_VIEWPORT = 760;
export const CROSSFADE_MS = 1200;
export const PROSE_PAD = 16;

// Index layout of a profile state vector: per-kind presence, then scalars.
export const STATE_FOG = KIND_COUNT;
export const STATE_GLOW = KIND_COUNT + 1;
export const STATE_LIGHT = KIND_COUNT + 2;
export const STATE_DENSITY = KIND_COUNT + 3;
export const STATE_LENGTH = KIND_COUNT + 4;

export type Rgb = readonly [number, number, number];

/** Culled reading area: viewport-space x range, document-space y range. */
export interface ProseBand {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function capDpr(devicePixelRatio: number, viewportWidth: number): number {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(ratio, viewportWidth <= SMALL_VIEWPORT ? 1.5 : 2);
}

export function particleBudget(viewportWidth: number): number {
  return viewportWidth <= SMALL_VIEWPORT ? MOBILE_PARTICLES : MAX_PARTICLES;
}

/**
 * Culled band in document space. It starts at the top of the prose column, so
 * the chapter header stays open to the atmosphere, and when `end` is given it
 * reaches down and out over the chapter end (end mark and prev/next cards).
 */
export function measureProseBand(
  rect: { left: number; right: number; top: number; bottom: number },
  scrollY: number,
  pad = PROSE_PAD,
  end: { left: number; right: number; bottom: number } | null = null,
): ProseBand {
  const left = end ? Math.min(rect.left, end.left) : rect.left;
  const right = end ? Math.max(rect.right, end.right) : rect.right;
  const bottom = end ? Math.max(rect.bottom, end.bottom) : rect.bottom;
  return { left: left - pad, right: right + pad, top: rect.top + scrollY, bottom: bottom + scrollY };
}

/** True when a viewport-space point lies over the prose column and must not be drawn. */
export function isCulled(x: number, y: number, band: ProseBand | null, scrollY: number): boolean {
  if (!band) return false;
  const docY = y + scrollY;
  return x >= band.left && x <= band.right && docY >= band.top && docY <= band.bottom;
}

/** Eased 0..1 progress of a profile crossfade. */
export function crossfadeWeight(elapsedMs: number, durationMs = CROSSFADE_MS): number {
  if (!(durationMs > 0)) return 1;
  const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
  return t * t * (3 - 2 * t);
}

export function profileState(profile: AtmosphereProfile, out = new Float32Array(STATE_LENGTH)): Float32Array {
  for (let k = 0; k < KIND_COUNT; k += 1) {
    out[k] = profile.density * (profile.kinds[PARTICLE_KINDS[k]]?.share ?? 0);
  }
  out[STATE_FOG] = Math.min(MAX_FOG_SPRITES, Math.max(0, profile.fog));
  out[STATE_GLOW] = profile.glow;
  out[STATE_LIGHT] = profile.light;
  out[STATE_DENSITY] = profile.density;
  return out;
}

export function blendState(from: Float32Array, to: Float32Array, weight: number, out: Float32Array): Float32Array {
  for (let i = 0; i < STATE_LENGTH; i += 1) {
    out[i] = from[i] + (to[i] - from[i]) * weight;
  }
  return out;
}

/** Alpha multiplier for a kind mid-crossfade: its current presence against its peak. */
export function fadeFactor(from: number, to: number, current: number): number {
  const peak = Math.max(from, to);
  return peak > 0 ? Math.min(1, Math.max(0, current / peak)) : 0;
}

export function parseColor(value: string): Rgb | null {
  const text = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].replace(/./g, (d) => d + d) : hex[1];
    return [parseInt(digits.slice(0, 2), 16), parseInt(digits.slice(2, 4), 16), parseInt(digits.slice(4, 6), 16)];
  }
  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
  if (fn) {
    return [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  }
  return null;
}

export function mixRgb(a: Rgb, b: Rgb, amount: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * amount),
    Math.round(a[1] + (b[1] - a[1]) * amount),
    Math.round(a[2] + (b[2] - a[2]) * amount),
  ];
}

// Elaris defaults from tokens.css, used when a token is missing or unparsable.
const FALLBACK_PALETTE: Record<PaletteToken, Rgb> = {
  accent: [0, 229, 255],
  copper: [208, 107, 67],
  muted: [141, 150, 165],
  ink: [234, 239, 248],
  night: [19, 23, 30],
};

const KIND_RAIN = 0;
const KIND_DROP = 1;
const KIND_MOTE = 2;
const KIND_DRIP = 3;
const KIND_DUST = 4;
const KIND_SPORE = 5;
const KIND_BUBBLE = 6;

const RAIN_SLANT = 0.14;
const TAU = Math.PI * 2;
const GLOW_HEIGHT = 0.3;
/** Width of the soft edge where fog and glow fade out around the prose band. */
const BAND_FEATHER = 80;
const MOTION_KEY = "sea:motion:backdrop";

export interface AtmosphereStats {
  fps: number;
  particles: number;
  zone: SeaZone;
  paused: boolean;
}

export interface AtmosphereController {
  destroy(): void;
  /**
   * Drive the profile directly (home hero); null returns to body[data-zone].
   * Colors still come from the body palette, and intensity scales alpha 0-1.
   */
  setOverride(profile: SeaZone | null, intensity?: number): void;
  /** Lower the particle budget (home hero, low-end tier); null restores the device budget. */
  setParticleCap(cap: number | null): void;
  stats(): AtmosphereStats;
}

export interface AtmosphereOptions {
  canvas: HTMLCanvasElement;
  mist?: HTMLElement | null;
}

let active: AtmosphereController | null = null;
let pendingOverride: { profile: SeaZone | null; intensity: number } | null = null;

export function getAtmosphere(): AtmosphereController | null {
  return active;
}

/** Applies to the running controller, or to the next one started on this page. */
export function setAtmosphereOverride(profile: SeaZone | null, intensity = 1): void {
  if (active) {
    active.setOverride(profile, intensity);
  } else {
    pendingOverride = { profile, intensity };
  }
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const rgbString = (c: Rgb) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
const rgbaString = (c: Rgb, a: number) => `rgb(${c[0]} ${c[1]} ${c[2]} / ${a})`;

function readUserMotion(): boolean {
  const attr = document.documentElement.dataset.seaMotion;
  if (attr === "on" || attr === "off") return attr === "on";
  try {
    return localStorage.getItem(MOTION_KEY) !== "off";
  } catch {
    return true;
  }
}

export function startAtmosphere({ canvas, mist = null }: AtmosphereOptions): AtmosphereController | null {
  active?.destroy();

  const context = canvas.getContext("2d");
  if (!context) return null;
  const ctx: CanvasRenderingContext2D = context;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const article = document.querySelector<HTMLElement>("article.sea-chapter");
  const prose = article?.querySelector<HTMLElement>(".sea-prose") ?? document.querySelector<HTMLElement>(".sea-prose");
  const chapterEnd = article?.querySelector<HTMLElement>(".sea-chapter-end") ?? null;

  // Particle pools (struct of arrays).
  const px = new Float32Array(MAX_PARTICLES);
  const py = new Float32Array(MAX_PARTICLES);
  const pvx = new Float32Array(MAX_PARTICLES);
  const pvy = new Float32Array(MAX_PARTICLES);
  const psize = new Float32Array(MAX_PARTICLES);
  const palpha = new Float32Array(MAX_PARTICLES);
  const pphase = new Float32Array(MAX_PARTICLES);
  // Wobble amplitude, or remaining hang time for drips.
  const paux = new Float32Array(MAX_PARTICLES);
  // Fade-in progress for particles spawned inside the viewport.
  const plife = new Float32Array(MAX_PARTICLES);
  const pkind = new Uint8Array(MAX_PARTICLES);
  const plive = new Uint8Array(MAX_PARTICLES);
  const kindLive = new Uint16Array(KIND_COUNT);

  const fx = new Float32Array(MAX_FOG_SPRITES);
  const fy = new Float32Array(MAX_FOG_SPRITES);
  const fvx = new Float32Array(MAX_FOG_SPRITES);
  const fw = new Float32Array(MAX_FOG_SPRITES);
  const fa = new Float32Array(MAX_FOG_SPRITES);
  const flive = new Uint8Array(MAX_FOG_SPRITES);

  const fromState = new Float32Array(STATE_LENGTH);
  const toState = new Float32Array(STATE_LENGTH);
  const curState = new Float32Array(STATE_LENGTH);
  const kindFade = new Float32Array(KIND_COUNT);
  const kindColor: string[] = PARTICLE_KINDS.map(() => rgbString(FALLBACK_PALETTE.muted));

  let width = 0;
  let height = 0;
  let budget = MOBILE_PARTICLES;
  let budgetCap = MAX_PARTICLES;
  let sizeDirty = true;
  let band: ProseBand | null = null;

  let raf = 0;
  let lastFrame = 0;
  let fps = 0;
  let drawn = 0;
  let fading = false;
  let fadeStart = 0;
  let seeded = false;
  let destroyed = false;
  let resizeTimer = 0;

  const bodyZone = document.body.dataset.zone;
  let baseZone: SeaZone = isSeaZone(bodyZone) ? bodyZone : "elaris";
  let overrideZone: SeaZone | null = null;
  let targetZone: SeaZone | null = null;
  let intensity = 1;
  let intensityTarget = 1;

  let fogSprite: HTMLCanvasElement | null = null;
  let glowRgb: Rgb = FALLBACK_PALETTE.accent;
  let glowGradient: CanvasGradient | null = null;
  // Erase masks in local coordinates (reused at any band position): 1 at the
  // band edge, 0 at BAND_FEATHER outward.
  const featherEdge = ctx.createLinearGradient(0, 0, BAND_FEATHER, 0);
  featherEdge.addColorStop(0, "rgba(0, 0, 0, 1)");
  featherEdge.addColorStop(1, "rgba(0, 0, 0, 0)");
  const featherCorner = ctx.createRadialGradient(0, 0, 0, 0, 0, BAND_FEATHER);
  featherCorner.addColorStop(0, "rgba(0, 0, 0, 1)");
  featherCorner.addColorStop(1, "rgba(0, 0, 0, 0)");

  // Clears fog and glow over the prose band with soft edges, so the band never
  // shows as a hard-edged slab. Particles are culled per particle instead.
  const eraseBand = (left: number, top: number, right: number, bottom: number) => {
    const w = right - left;
    const h = bottom - top;
    const F = BAND_FEATHER;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(left, top, w, h);
    ctx.fillStyle = featherEdge;
    const edge = (x: number, y: number, angle: number, length: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillRect(0, 0, F, length);
      ctx.restore();
    };
    // Local +x points outward from each side; local +y runs along it.
    edge(right, top, 0, h);
    edge(left, bottom, Math.PI, h);
    edge(left, top, -Math.PI / 2, w);
    edge(right, bottom, Math.PI / 2, w);
    ctx.fillStyle = featherCorner;
    for (const [x, y, dx, dy] of [
      [left, top, -F, -F],
      [right, top, 0, -F],
      [left, bottom, -F, 0],
      [right, bottom, 0, 0],
    ] as const) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillRect(dx, dy, F, F);
      ctx.restore();
    }
    ctx.restore();
  };

  let userMotion = readUserMotion();
  const motionAllowed = () => !reduceMotion.matches && userMotion;

  const measureCanvas = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    width = rect.width;
    height = rect.height;
    const dpr = capDpr(window.devicePixelRatio, width);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    budget = Math.min(particleBudget(width), budgetCap);
    glowGradient = null;
    sizeDirty = false;
  };

  const recacheBand = () => {
    if (!prose || !prose.isConnected) {
      band = null;
      return;
    }
    const endRect = chapterEnd?.isConnected ? chapterEnd.getBoundingClientRect() : null;
    const articleBottom = article?.isConnected ? article.getBoundingClientRect().bottom : -Infinity;
    const end = endRect
      ? { left: endRect.left, right: endRect.right, bottom: Math.max(endRect.bottom, articleBottom) }
      : null;
    band = measureProseBand(prose.getBoundingClientRect(), window.scrollY, PROSE_PAD, end);
  };

  const readPalette = (): Record<PaletteToken, Rgb> => {
    const style = getComputedStyle(document.body);
    const palette = { ...FALLBACK_PALETTE };
    for (const token of Object.keys(PALETTE_TOKENS) as PaletteToken[]) {
      palette[token] = parseColor(style.getPropertyValue(PALETTE_TOKENS[token])) ?? FALLBACK_PALETTE[token];
    }
    return palette;
  };

  const buildFogSprite = (color: Rgb) => {
    const size = 128;
    const sprite = fogSprite ?? document.createElement("canvas");
    sprite.width = size;
    sprite.height = size;
    const sctx = sprite.getContext("2d");
    if (!sctx) {
      fogSprite = null;
      return;
    }
    const gradient = sctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, rgbaString(color, 0.9));
    gradient.addColorStop(0.45, rgbaString(color, 0.4));
    gradient.addColorStop(1, rgbaString(color, 0));
    sctx.clearRect(0, 0, size, size);
    sctx.fillStyle = gradient;
    sctx.fillRect(0, 0, size, size);
    fogSprite = sprite;
  };

  // Colors for the incoming profile only; kinds that are fading out keep theirs.
  const applyPalette = (profile: AtmosphereProfile) => {
    const palette = readPalette();
    for (let k = 0; k < KIND_COUNT; k += 1) {
      const spec = profile.kinds[PARTICLE_KINDS[k]];
      if (spec) {
        const [from, to, amount] = spec.tint;
        kindColor[k] = rgbString(mixRgb(palette[from], palette[to], amount));
      }
    }
    if (profile.fog > 0) buildFogSprite(mixRgb(palette.muted, palette.ink, 0.3));
    if (profile.glow > 0) {
      glowRgb = mixRgb(palette.accent, palette.night, 0.6);
      glowGradient = null;
    }
  };

  const updateKindFade = () => {
    for (let k = 0; k < KIND_COUNT; k += 1) {
      kindFade[k] = fadeFactor(fromState[k], toState[k], curState[k]);
    }
  };

  const retarget = (immediate: boolean) => {
    const zone = overrideZone ?? baseZone;
    if (zone === targetZone) return;
    targetZone = zone;
    const profile = ATMOSPHERE_PROFILES[zone];
    fromState.set(curState);
    profileState(profile, toState);
    applyPalette(profile);
    if (immediate) {
      fromState.set(toState);
      curState.set(toState);
      fading = false;
    } else {
      fading = true;
      fadeStart = performance.now();
    }
    updateKindFade();
  };

  const pickKind = (): number => {
    let total = 0;
    for (let k = 0; k < KIND_COUNT; k += 1) total += curState[k];
    if (total <= 0) return -1;
    let r = Math.random() * total;
    let last = -1;
    for (let k = 0; k < KIND_COUNT; k += 1) {
      if (curState[k] <= 0) continue;
      last = k;
      r -= curState[k];
      if (r <= 0) return k;
    }
    return last;
  };

  const spawn = (i: number, initial: boolean) => {
    const kind = pickKind();
    if (kind < 0) {
      plive[i] = 0;
      return;
    }
    // Kinds entering a crossfade appear across the viewport instead of only at
    // their edge, so a slow kind does not take a minute to fill the frame.
    const scatter = initial || (fading && toState[kind] > fromState[kind]);
    pkind[i] = kind;
    plive[i] = 1;
    pphase[i] = Math.random() * TAU;
    plife[i] = scatter ? 0 : 1;
    pvx[i] = 0;
    paux[i] = 0;

    switch (kind) {
      case KIND_RAIN:
      case KIND_DROP: {
        const heavy = kind === KIND_DROP;
        pvy[i] = heavy ? rand(820, 980) : rand(520, 760);
        pvx[i] = pvy[i] * RAIN_SLANT;
        psize[i] = heavy ? rand(20, 30) : rand(10, 18);
        palpha[i] = heavy ? rand(0.14, 0.26) : rand(0.07, 0.17);
        px[i] = rand(-height * RAIN_SLANT, width);
        py[i] = scatter ? rand(0, height) : rand(-60, -psize[i]);
        break;
      }
      case KIND_MOTE:
      case KIND_DUST: {
        const dust = kind === KIND_DUST;
        pvx[i] = dust ? rand(5, 16) : rand(8, 24);
        pvy[i] = dust ? rand(-4, 3) : rand(-3, 3);
        psize[i] = dust ? rand(0.7, 1.9) : rand(0.8, 2.2);
        palpha[i] = dust ? rand(0.1, 0.24) : rand(0.08, 0.2);
        paux[i] = dust ? rand(3, 8) : rand(4, 10);
        px[i] = scatter ? rand(0, width) : rand(-20, -4);
        py[i] = rand(0, height);
        break;
      }
      case KIND_DRIP: {
        psize[i] = rand(1, 1.8);
        palpha[i] = rand(0.16, 0.32);
        px[i] = rand(0, width);
        if (scatter) {
          py[i] = rand(0, height);
          pvy[i] = rand(300, 800);
        } else {
          py[i] = 0;
          pvy[i] = 0;
          paux[i] = rand(0.6, 3.2);
        }
        break;
      }
      case KIND_SPORE:
      case KIND_BUBBLE: {
        const bubble = kind === KIND_BUBBLE;
        pvx[i] = bubble ? 0 : rand(-2, 2);
        pvy[i] = bubble ? -rand(18, 52) : -rand(7, 17);
        psize[i] = bubble ? rand(1.2, 3.2) : rand(1, 2.2);
        palpha[i] = bubble ? rand(0.12, 0.3) : rand(0.1, 0.26);
        paux[i] = bubble ? rand(2, 6) : rand(5, 12);
        px[i] = rand(0, width);
        py[i] = scatter ? rand(0, height) : height + rand(6, 24);
        break;
      }
    }
  };

  const spawnFog = (j: number, initial: boolean) => {
    fw[j] = rand(0.45, 0.8) * Math.max(width, 480);
    fx[j] = initial ? rand(-fw[j] * 0.3, width) : -fw[j] * 0.5;
    fy[j] = rand(height * 0.08, height * 0.92);
    fvx[j] = rand(6, 14);
    fa[j] = rand(0.14, 0.26);
    flive[j] = 1;
  };

  // Advances one particle; returns false when it left the viewport.
  const step = (i: number, dt: number): boolean => {
    const kind = pkind[i];
    if (plife[i] < 1) plife[i] = Math.min(1, plife[i] + dt * 1.25);
    if (kind === KIND_DRIP && paux[i] > 0) {
      paux[i] -= dt;
      return true;
    }
    if (kind === KIND_DRIP) pvy[i] = Math.min(pvy[i] + 1400 * dt, 900);
    px[i] += pvx[i] * dt;
    py[i] += pvy[i] * dt;
    const x = px[i];
    const y = py[i];
    switch (kind) {
      case KIND_RAIN:
      case KIND_DROP:
      case KIND_DRIP:
        return y - psize[i] <= height + 4 && x <= width + 40;
      case KIND_SPORE:
      case KIND_BUBBLE:
        return y >= -20 && x >= -20 && x <= width + 20;
      default:
        return x <= width + 20 && y >= -20 && y <= height + 20;
    }
  };

  const drawKind = (kind: number, time: number, scrollY: number, alphaScale: number) => {
    const fade = kindFade[kind] * alphaScale;
    if (fade <= 0.002) return;
    const color = kindColor[kind];
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    const linear = kind === KIND_RAIN || kind === KIND_DROP;
    ctx.lineWidth = kind === KIND_DROP ? 1.6 : kind === KIND_BUBBLE ? 0.8 : 1;

    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      if (!plive[i] || pkind[i] !== kind) continue;
      const alpha = palpha[i] * plife[i] * fade;
      if (alpha < 0.004) continue;
      const wobble = linear || kind === KIND_DRIP ? 0 : Math.sin(time * 0.6 + pphase[i]) * paux[i];
      const x = px[i] + wobble;
      const y = kind === KIND_DRIP && paux[i] > 0 ? 1.5 : py[i];
      if (isCulled(x, y, band, scrollY)) continue;

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      if (linear) {
        ctx.moveTo(x, y);
        ctx.lineTo(x - psize[i] * RAIN_SLANT, y - psize[i]);
        ctx.stroke();
      } else if (kind === KIND_DRIP) {
        if (paux[i] > 0) {
          ctx.arc(x, y, psize[i], 0, TAU);
          ctx.fill();
        } else {
          ctx.moveTo(x, y - Math.min(16, pvy[i] * 0.018));
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, psize[i] * 0.8, 0, TAU);
          ctx.fill();
        }
      } else if (kind === KIND_BUBBLE) {
        ctx.arc(x, y, psize[i], 0, TAU);
        ctx.stroke();
      } else {
        ctx.arc(x, y, psize[i], 0, TAU);
        ctx.fill();
      }
      drawn += 1;
    }
  };

  const frame = (now: number) => {
    raf = 0;
    if (destroyed) return;
    const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 1 / 60;
    if (lastFrame && now > lastFrame) fps = fps ? fps * 0.9 + (1000 / (now - lastFrame)) * 0.1 : 1000 / (now - lastFrame);
    lastFrame = now;
    const time = now / 1000;

    if (fading) {
      const weight = crossfadeWeight(now - fadeStart);
      blendState(fromState, toState, weight, curState);
      updateKindFade();
      if (weight >= 1) fading = false;
    }
    intensity += (intensityTarget - intensity) * Math.min(1, dt * 4);

    const density = fading ? Math.max(fromState[STATE_DENSITY], toState[STATE_DENSITY]) : curState[STATE_DENSITY];
    const slots = Math.min(MAX_PARTICLES, Math.round(budget * density));
    const scrollY = window.scrollY;
    const light = curState[STATE_LIGHT] * intensity;

    kindLive.fill(0);
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      if (i >= slots) {
        plive[i] = 0;
        continue;
      }
      if (!plive[i] || kindFade[pkind[i]] <= 0.001) {
        spawn(i, !seeded);
        if (!plive[i]) continue;
      } else if (!step(i, dt)) {
        spawn(i, false);
        if (!plive[i]) continue;
      }
      kindLive[pkind[i]] += 1;
    }
    seeded = true;

    ctx.clearRect(0, 0, width, height);
    drawn = 0;

    const bandTop = band ? band.top - scrollY : 0;
    const bandBottom = band ? band.bottom - scrollY : 0;

    const glow = curState[STATE_GLOW] * intensity;
    if (glow > 0.01) {
      if (!glowGradient) {
        glowGradient = ctx.createLinearGradient(0, 0, 0, height * GLOW_HEIGHT);
        glowGradient.addColorStop(0, rgbaString(glowRgb, 0.9));
        glowGradient.addColorStop(0.35, rgbaString(glowRgb, 0.35));
        glowGradient.addColorStop(1, rgbaString(glowRgb, 0));
      }
      ctx.globalAlpha = glow * 0.22;
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, width, height * GLOW_HEIGHT);
    }

    const fog = curState[STATE_FOG];
    if (fogSprite && fog > 0.01) {
      const count = Math.min(MAX_FOG_SPRITES, Math.ceil(fog));
      for (let j = 0; j < count; j += 1) {
        if (!flive[j]) spawnFog(j, true);
        fx[j] += fvx[j] * dt;
        if (fx[j] - fw[j] * 0.5 > width) spawnFog(j, false);
        const alpha = fa[j] * clamp01(fog - j) * light;
        if (alpha < 0.004) continue;
        const h = fw[j] * 0.42;
        ctx.globalAlpha = alpha;
        ctx.drawImage(fogSprite, fx[j] - fw[j] * 0.5, fy[j] - h * 0.5, fw[j], h);
      }
    }

    if (band && bandBottom > -BAND_FEATHER && bandTop < height + BAND_FEATHER) {
      // Only the visible stretch of a long band is filled.
      eraseBand(band.left, Math.max(bandTop, -BAND_FEATHER), band.right, Math.min(bandBottom, height + BAND_FEATHER));
    }

    for (let k = 0; k < KIND_COUNT; k += 1) {
      if (kindLive[k]) drawKind(k, time, scrollY, light);
    }

    ctx.globalAlpha = 1;
    raf = window.requestAnimationFrame(frame);
  };

  const stopLoop = () => {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
    lastFrame = 0;
  };

  const clearCanvas = () => {
    ctx.clearRect(0, 0, width, height);
  };

  const sync = () => {
    if (destroyed) return;
    const allowed = motionAllowed();
    if (mist) mist.dataset.motion = allowed ? "on" : "off";
    if (!allowed) {
      stopLoop();
      clearCanvas();
      canvas.hidden = true;
      return;
    }
    canvas.hidden = false;
    if (sizeDirty) measureCanvas();
    if (document.hidden || width === 0) {
      stopLoop();
      return;
    }
    if (!raf) raf = window.requestAnimationFrame(frame);
  };

  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      sizeDirty = true;
      if (!canvas.hidden) measureCanvas();
      recacheBand();
      sync();
    }, 150);
  };

  const onZoneChange = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    const zone = isSeaZone(detail) ? detail : document.body.dataset.zone;
    if (!isSeaZone(zone)) return;
    baseZone = zone;
    retarget(!raf);
  };

  const onMotionChange = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    userMotion = typeof detail === "boolean" ? detail : readUserMotion();
    sync();
  };

  const proseObserver =
    prose && "ResizeObserver" in window ? new ResizeObserver(() => recacheBand()) : null;
  if (proseObserver && prose) {
    proseObserver.observe(prose);
    if (article) proseObserver.observe(article);
  }

  window.addEventListener("resize", onResize);
  window.addEventListener("sea:settings-change", recacheBand);
  window.addEventListener("sea:zone-change", onZoneChange);
  window.addEventListener("sea:motion-change", onMotionChange);
  reduceMotion.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  document.fonts?.ready.then(() => {
    if (!destroyed) recacheBand();
  });

  const controller: AtmosphereController = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      window.clearTimeout(resizeTimer);
      proseObserver?.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("sea:settings-change", recacheBand);
      window.removeEventListener("sea:zone-change", onZoneChange);
      window.removeEventListener("sea:motion-change", onMotionChange);
      reduceMotion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      clearCanvas();
      if (active === controller) active = null;
      pendingOverride = null;
    },
    setOverride(profile, value = 1) {
      if (destroyed) return;
      overrideZone = profile;
      intensityTarget = Number.isFinite(value) ? clamp01(value) : 1;
      if (!raf) intensity = intensityTarget;
      retarget(!raf);
    },
    setParticleCap(cap) {
      if (destroyed) return;
      budgetCap = cap !== null && Number.isFinite(cap) ? Math.max(0, Math.min(MAX_PARTICLES, Math.round(cap))) : MAX_PARTICLES;
      budget = Math.min(particleBudget(width), budgetCap);
    },
    stats() {
      return {
        fps: Math.round(fps),
        particles: drawn,
        zone: targetZone ?? baseZone,
        paused: raf === 0,
      };
    },
  };

  active = controller;
  if (pendingOverride) {
    const { profile, intensity: value } = pendingOverride;
    pendingOverride = null;
    controller.setOverride(profile, value);
  }
  retarget(true);
  recacheBand();
  sync();
  return controller;
}
