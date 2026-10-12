// Part 4, the snow pact: a blizzard up the mountain (design 4.3).
//
// The dark plate of part 4 under a blizzard driven sideways by gusts. Lamps
// come on one by one up a switchback path to the summit, the faint lights the
// epigraph speaks of. Then the snow gathers: flakes leave the wind and settle
// into the shape of the epigraph's letters, glowing on their own before the
// real text comes up over them and they dim. They hold, and a gust blows them
// apart; the real text stays. Below, the plate's own spider lily, beside its
// footprints that go up and do not come back, glows red (r2-core.ts, P4).
//
// The letters' shape is taken from the real text: each grapheme span of the
// epigraph is drawn, in the epigraph's own font, at its own place into a small
// canvas that is never shown, and the flakes are sent to points sampled from
// it (sampleTargets). Thai is drawn a whole cluster at a time, so its marks
// stay on their letters. The particles only decorate; the text is the DOM's.
import { createRng, type SceneSize } from "../../../_shared/scene-runtime";
import type { TsukiSceneContext, TsukiSceneHandle } from "../scene-types";
import { injectSceneStyles } from "../styles";
import { drawTextScrim, makeLayer, platePoint, radialSprite, runCanvasScene, softenedPlate, splitGlyphs, stillCanvas, textBox, type Box, type Ctx } from "./kit";
import { P4, clamp, envelope, p4Gather, p4LetterGlow, phase, sampleTargets, smooth } from "./r2-core";
import css from "./part-4-snow-pact.css?inline";

const SEED = 0x7034;
const LAMP = "255, 206, 140";
const SNOW = "232, 238, 250";
const HIGAN = "196, 38, 46";
const WIND_VOLUME = 0.35;
const MAX_GATHER = 2000;
/** Flakes that always stay in the storm, however many go to the letters. */
const STORM_KEEPS = 600;
/** The storm is drawn in this many depths, each stroked as one path. */
const BUCKETS = 3;

interface Layout {
  w: number;
  h: number;
  unit: number;
  lamps: Array<{ x: number; y: number }>;
  /** Where the plate's own spider lily stands, mapped from the picture to the screen. */
  lily: { x: number; y: number };
}

/** Where the plate's spider lily is in the picture, as fractions of its width and height. */
const LILY_IN_PLATE = { x: 0.226, y: 0.86 };

function layoutOf(w: number, h: number): Layout {
  const unit = Math.min(w, h);
  const portrait = h > w;
  // A switchback from the lower left up to the summit on the right, lamps along it.
  const start = { x: w * (portrait ? 0.22 : 0.16), y: h * 0.84 };
  const summit = { x: w * (portrait ? 0.7 : 0.78), y: h * 0.14 };
  const turns = 5;
  const lamps: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 9; i++) {
    const k = i / 8;
    const y = start.y + (summit.y - start.y) * k;
    const swing = Math.sin(k * Math.PI * turns) * w * (portrait ? 0.12 : 0.08) * (1 - k * 0.6);
    lamps.push({ x: start.x + (summit.x - start.x) * k + swing, y });
  }
  // The plate is drawn to cover the screen: map the lily through the same fit.
  return { w, h, unit, lamps, lily: platePoint(w, h, LILY_IN_PLATE.x, LILY_IN_PLATE.y) };
}

/** The night mountain: the plate softened and sunk into indigo. */
function paintMountain(c: Ctx, l: Layout, image: HTMLImageElement | null, dpr: number): void {
  c.fillStyle = "#070a16";
  c.fillRect(0, 0, l.w, l.h);
  if (image) {
    c.globalAlpha = 0.9;
    c.drawImage(softenedPlate(image, l.w, l.h, dpr, 1.6), 0, 0, l.w, l.h);
    c.globalAlpha = 1;
  }
  c.globalCompositeOperation = "multiply";
  c.fillStyle = "rgba(70, 86, 140, 0.9)";
  c.fillRect(0, 0, l.w, l.h);
  c.globalCompositeOperation = "source-over";
  const sky = c.createLinearGradient(0, 0, 0, l.h);
  sky.addColorStop(0, "rgba(4, 6, 16, 0.55)");
  sky.addColorStop(0.5, "rgba(4, 6, 16, 0.1)");
  sky.addColorStop(1, "rgba(220, 228, 245, 0.08)");
  c.fillStyle = sky;
  c.fillRect(0, 0, l.w, l.h);
}

/** A lamp up the path: a warm point with a small halo. */
function lampSprite(l: Layout, dpr: number): HTMLCanvasElement {
  return radialSprite(l.unit * 0.035, dpr, [
    [0, "rgba(255, 236, 200, 1)"],
    [0.08, `rgba(${LAMP}, 0.85)`],
    [0.3, `rgba(${LAMP}, 0.25)`],
    [1, `rgba(${LAMP}, 0)`],
  ]);
}

function lilyGlow(l: Layout, dpr: number): HTMLCanvasElement {
  return radialSprite(l.unit * 0.13, dpr, [
    [0, `rgba(${HIGAN}, 0.55)`],
    [0.4, `rgba(${HIGAN}, 0.18)`],
    [1, `rgba(${HIGAN}, 0)`],
  ]);
}

interface Flake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  depth: number;
  size: number;
  /** Index into the targets, or -1 for a flake that stays in the wind. */
  target: number;
  phase: number;
}

/** Points inside the epigraph's letters, from its grapheme spans drawn in its own font. */
function letterTargets(stage: HTMLElement, textEl: HTMLElement, glyphs: HTMLSpanElement[], width: number, height: number): Array<{ x: number; y: number }> {
  const scale = 0.5;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d", { willReadFrequently: true });
  if (!c) return [];
  const style = getComputedStyle(textEl);
  const fontSize = parseFloat(style.fontSize) || 18;
  c.scale(scale, scale);
  c.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  c.textBaseline = "middle";
  c.fillStyle = "#fff";
  const origin = stage.getBoundingClientRect();
  for (const glyph of glyphs) {
    const r = glyph.getBoundingClientRect();
    if (!(r.width > 0)) continue;
    c.fillText(glyph.textContent ?? "", r.left - origin.left, r.top - origin.top + r.height / 2);
  }
  const data = c.getImageData(0, 0, w, h).data;
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  const step = Math.max(2, Math.round(fontSize * scale * 0.16));
  return sampleTargets(alpha, w, h, step, MAX_GATHER).map((p) => ({ x: p.x / scale, y: p.y / scale }));
}

export function play(ctx: TsukiSceneContext): TsukiSceneHandle {
  injectSceneStyles(css, ctx.signal);
  const { stage, textEl } = ctx;
  const split = splitGlyphs(textEl);
  textEl.classList.add("tsuki-p4-text");
  if (ctx.audio.available()) {
    ctx.audio.setCue("mountain");
    ctx.audio.layerSoundscape("mountain-wind", WIND_VOLUME);
  }

  let l = layoutOf(1, 1);
  let base: HTMLCanvasElement | null = null;
  let lamp: HTMLCanvasElement | null = null;
  let redGlow: HTMLCanvasElement | null = null;
  let flakes: Flake[] = [];
  let targets: Array<{ x: number; y: number }> = [];
  let targetsDirty = true;
  let box: Box | null = null;
  let boxAge = 0;
  let textShown = false;
  let blown = false;
  const rng = createRng(SEED);
  const paths: Path2D[] = [];

  const spawn = (f: Flake | null, anywhere: boolean): Flake => {
    const flake = f ?? ({ target: -1 } as Flake);
    flake.depth = 0.35 + rng() * 0.65;
    flake.x = anywhere ? rng() * l.w : -10 - rng() * l.w * 0.2;
    flake.y = anywhere ? rng() * l.h : rng() * l.h * 1.1 - l.h * 0.1;
    flake.vx = (180 + rng() * 160) * flake.depth;
    flake.vy = (70 + rng() * 80) * flake.depth;
    flake.size = 0.7 + flake.depth * 1.8;
    flake.phase = rng() * 6.28;
    return flake;
  };

  const layout = (size: Readonly<SceneSize>, image: HTMLImageElement | null) => {
    l = layoutOf(size.width, size.height);
    const b = makeLayer(l.w, l.h, size.dpr);
    paintMountain(b.ctx, l, image, size.dpr);
    base = b.canvas;
    lamp = lampSprite(l, size.dpr);
    redGlow = lilyGlow(l, size.dpr);
    const count = Math.round(clamp((l.w * l.h) / 520, 900, 2400));
    if (flakes.length === 0) flakes = Array.from({ length: count }, () => spawn(null, true));
    targetsDirty = true;
    box = null;
  };

  const assignTargets = () => {
    targets = letterTargets(stage, textEl, split.glyphs, l.w, l.h);
    targetsDirty = false;
    while (flakes.length < targets.length + STORM_KEEPS) flakes.push(spawn(null, true));
    // The first flakes take the places, one each; the rest stay in the storm.
    flakes.forEach((flake, i) => {
      flake.target = i < targets.length ? i : -1;
    });
  };

  return runCanvasScene(ctx, {
    endS: P4.end,
    className: "tsuki-p4-canvas",
    layout,
    onReady() {
      stage.classList.add("tsuki-p4-ready");
    },
    render(c, info) {
      const { t, dt, width: w, height: h } = info;
      c.clearRect(0, 0, w, h);
      if (!info.ready || !base || !lamp || !redGlow) return;
      boxAge -= dt;
      if (!box || boxAge <= 0) {
        box = textBox(stage, textEl);
        boxAge = 0.5;
      }
      if (targetsDirty && t >= P4.gatherStart - 0.5) assignTargets();
      if (!textShown && t >= P4.textInStart) {
        textShown = true;
        textEl.classList.add("tsuki-p4-in");
      }

      const life = envelope(t, 0, 1.6, P4.end - 1.6, P4.end);
      c.globalAlpha = life;
      c.drawImage(base, 0, 0, w, h);

      // The lamps up the path, one by one, flickering in the wind.
      c.globalCompositeOperation = "lighter";
      const lit = phase(t, P4.lampsStart, P4.lampsEnd) * l.lamps.length;
      const ls = lamp.width / info.dpr;
      l.lamps.forEach((point, i) => {
        const on = smooth(clamp(lit - i, 0, 1));
        if (on <= 0 || !lamp) return;
        const flicker = 0.8 + 0.2 * Math.sin(t * (5 + i) + i * 1.7) * Math.sin(t * 2.3 + i);
        const s = ls * (1 - i * 0.06);
        c.globalAlpha = life * on * flicker;
        c.drawImage(lamp, point.x - s / 2, point.y - s / 2, s, s);
      });

      // The plate's spider lily comes up red in the snow.
      const bloom = smooth(phase(t, P4.lilyStart, P4.lilyStart + 3));
      if (bloom > 0) {
        const gs = redGlow.width / info.dpr;
        c.globalAlpha = life * bloom * (0.8 + 0.2 * Math.sin(t * 1.4));
        c.drawImage(redGlow, l.lily.x - gs / 2, l.lily.y - gs / 2, gs, gs);
      }
      c.globalCompositeOperation = "source-over";
      c.globalAlpha = 1;
      drawTextScrim(c, box, life * 0.8);

      // Gusts swell and fall; the big one blows the letters apart.
      const gust = 1 + 0.6 * Math.max(0, Math.sin(t * 0.45)) ** 3 + 1.4 * envelope(t, P4.holdEnd, P4.holdEnd + 0.4, P4.scatterEnd - 1, P4.scatterEnd);
      const gather = p4Gather(t);
      if (!blown && t >= P4.holdEnd) {
        blown = true;
        for (const flake of flakes) {
          if (flake.target < 0) continue;
          flake.vx = 300 + rng() * 500;
          flake.vy = -120 + rng() * 260;
        }
      }

      for (let i = 0; i < BUCKETS; i++) paths[i] = new Path2D();
      const letterGlow = p4LetterGlow(t);
      c.fillStyle = `rgb(${SNOW})`;
      for (const flake of flakes) {
        const target = flake.target >= 0 ? targets[flake.target] : undefined;
        if (target && gather > 0) {
          // Leaving the wind for a place in the letters, then shimmering there.
          const pull = Math.min(1, dt * (1.5 + 5 * gather)) * gather;
          const jx = Math.sin(t * 2 + flake.phase) * (1 - gather) * 6;
          flake.x += (target.x + jx - flake.x) * pull;
          flake.y += (target.y - flake.y) * pull;
          const shimmer = 0.75 + 0.25 * Math.sin(t * 3 + flake.phase);
          c.globalAlpha = life * (0.35 + 0.6 * gather) * shimmer * letterGlow;
          const s = 1.3 + flake.depth * 0.9;
          c.fillRect(flake.x - s / 2, flake.y - s / 2, s, s);
          continue;
        }
        flake.x += flake.vx * gust * dt;
        flake.y += flake.vy * dt + Math.sin(t * 1.7 + flake.phase) * 12 * dt;
        // A flake blown out of the letters slows back into the storm's own speed.
        flake.vx += (260 * flake.depth - flake.vx) * Math.min(1, dt * 0.6);
        flake.vy += (110 * flake.depth - flake.vy) * Math.min(1, dt * 0.6);
        if (flake.x > w + 20 || flake.y > h + 20 || flake.y < -40) {
          const keep = flake.target;
          spawn(flake, false);
          // Blown-out flakes do not come back to the letters.
          flake.target = blown ? -1 : keep;
        }
        // A streak along the flake's own way through the wind, longer in a gust.
        const vx = flake.vx * gust;
        const speed = Math.hypot(vx, flake.vy) || 1;
        const len = flake.size * (1.5 + gust * 2.2);
        const bucket = Math.min(BUCKETS - 1, Math.floor(((flake.depth - 0.35) / 0.65) * BUCKETS));
        paths[bucket].moveTo(flake.x, flake.y);
        paths[bucket].lineTo(flake.x - (vx / speed) * len, flake.y - (flake.vy / speed) * len);
      }
      c.strokeStyle = `rgb(${SNOW})`;
      c.lineCap = "round";
      for (let i = 0; i < BUCKETS; i++) {
        c.globalAlpha = life * (0.32 + i * 0.22);
        c.lineWidth = 0.8 + i * 0.75;
        c.stroke(paths[i]);
      }
      c.globalAlpha = 1;
    },
    cleanup() {
      stage.classList.remove("tsuki-p4-ready");
      textEl.classList.remove("tsuki-p4-text", "tsuki-p4-in");
      split.restore();
    },
  });
}

export function still(ctx: TsukiSceneContext): void {
  injectSceneStyles(css, ctx.signal);
  stillCanvas(
    ctx,
    (c, size, image) => {
      const l = layoutOf(size.width, size.height);
      paintMountain(c, l, image, size.dpr);
      const lamp = lampSprite(l, size.dpr);
      const s = lamp.width / size.dpr;
      c.globalCompositeOperation = "lighter";
      for (const point of l.lamps) c.drawImage(lamp, point.x - s / 2, point.y - s / 2, s, s);
      const red = lilyGlow(l, size.dpr);
      const rs = red.width / size.dpr;
      c.drawImage(red, l.lily.x - rs / 2, l.lily.y - rs / 2, rs, rs);
      c.globalCompositeOperation = "source-over";
      // Snow hanging in the air.
      const rng = createRng(SEED + 9);
      c.fillStyle = `rgb(${SNOW})`;
      for (let i = 0; i < 600; i++) {
        const depth = 0.35 + rng() * 0.65;
        c.globalAlpha = 0.25 + depth * 0.5;
        const d = 0.8 + depth * 2;
        c.fillRect(rng() * l.w, rng() * l.h, d, d);
      }
      c.globalAlpha = 1;
      drawTextScrim(c, textBox(ctx.stage, ctx.textEl), 1);
    },
    "tsuki-p4-canvas",
  );
}
