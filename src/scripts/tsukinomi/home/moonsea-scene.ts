// The /tsukinomi/ home sky: the abandoned mountain station above "the sea of the
// moon", drawn on one full-screen canvas behind the hero and the concourse.
// moonsea-core.ts holds the rules (layout, lit carriages, timing); this module
// paints them. moonsea-loader.ts imports it dynamically and mounts it.
//
// Same architecture as the hub's Mothlight and Firefly scenes: everything
// expensive is painted once per size into canvases that are not in the page
// (the sky with its nebula and stars, the ridges, the sea of cloud, the track,
// the platform with its props, the train, the mist bands, the sprites), and
// the frame loop composites those images and advances a small simulation:
//
//   sky       a few bright stars twinkle, now and then a meteor
//   moon      the disc and its breathing halo; its road of light shivers on
//             the cloud, and valley lights glow through it
//   mist      two bands that drift, one on the far valley, one pooled over the
//             platform in front of the track
//   train     the last train crosses without stopping every half minute or so;
//             one carriage per part the reader has read has its lamps on, and
//             the lit windows throw light on the platform edge
//   lamp      the platform lamp hums, with moths, and stutters when time stops
//   petals    sakura petals drift and tumble. Every so often time stops: the
//             petals and the mist hang still for a breath, the way they do in
//             the story. The pointer stops the petals near it; a tap sends a
//             ring of moonlight through them.
//
// The scene clock that drives the mist, the glints and the moths slows with the
// stops of time. The train runs on its own clock: it is the one thing that
// never stops.
//
// The canvas is aria-hidden and takes no pointer events (scene-runtime listens
// on the window). Reduced motion, or the reader's own "no backdrop motion"
// switch, draws one composed still: petals hanging in the air, no train, no loop.
import { createNoise2D, createRng, createScene, fbm2D } from "../../_shared/scene-runtime";
import type { PointerState, SceneFrame, SceneSize } from "../../_shared/scene-runtime";
import {
  FIRST_PASS_DELAY_S,
  PASS_SECONDS,
  POINTER_FREEZE_RADIUS,
  clamp,
  freezeFactor,
  layoutMoonsea,
  litCarriages,
  nextFreezeDelay,
  nextPassDelay,
  petalCount,
  pointerFreeze,
  scrollVeil,
  trainNoseX,
  type MoonseaLayout,
} from "./moonsea-core";

const TAU = Math.PI * 2;
const SEED = 0x7473756b;
/** Painterly content does not need a full 2x backing store. */
const DPR_CAP = 1.5;
const TWINKLE_STARS = 46;
const GLINTS = 34;
const MOTHS = 4;
const TAP_RING_S = 1.4;
const TAP_PUSH_RADIUS = 190;

// Palette (the image brief): deep night, twilight blue, cold orange, faded
// sakura, pale mist, lamp amber, blood red for the spider lily.
const NIGHT = "#0b0918";
const ORANGE = "224, 138, 76";
const SAKURA = "230, 166, 189";
const MIST = "205, 211, 224";
const LAMP = "255, 211, 150";
const MOONLIGHT = "236, 232, 222";
const HIGAN = "179, 36, 43";

export interface MoonseaOptions {
  /** Fixed, full-screen, aria-hidden element; the canvas fills it. */
  mount: HTMLElement;
  /** Furthest part read (1 to 5), or null: how many of the train's carriages are lit. */
  furthestRead: number | null;
  /** Draw the still and never start the loop (the reader switched backdrop motion off). */
  still?: boolean;
  seed?: number;
}

export interface MoonseaHandle {
  /** Switches between the moving scene and the still (the reader's motion switch). */
  setStill(still: boolean): void;
  destroy(): void;
}

type Ctx = CanvasRenderingContext2D;

interface Layer {
  canvas: HTMLCanvasElement;
  ctx: Ctx;
}

interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  spin: number;
  tumble: number;
  tumbleSpeed: number;
  depth: number;
  variant: number;
  alpha: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  base: number;
}

interface Glint {
  x: number;
  y: number;
  len: number;
  phase: number;
  speed: number;
}

interface Ring {
  x: number;
  y: number;
  age: number;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
}

interface Baked {
  layout: MoonseaLayout;
  back: Layer;
  track: Layer;
  fore: Layer;
  veil: Layer;
  moonDisc: HTMLCanvasElement;
  moonHalo: HTMLCanvasElement;
  mistFar: HTMLCanvasElement;
  mistNear: HTMLCanvasElement;
  train: HTMLCanvasElement;
  trainGlow: HTMLCanvasElement;
  trainSpill: HTMLCanvasElement;
  trainLength: number;
  headlight: { x: number; y: number };
  lampBulb: { x: number; y: number };
  lampGlow: HTMLCanvasElement;
  lampPool: HTMLCanvasElement;
  stars: Star[];
  glints: Glint[];
  valleyLights: Array<{ x: number; y: number; r: number; phase: number }>;
}

function makeLayer(width: number, height: number, dpr: number): Layer {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  const ctx = canvas.getContext("2d") as Ctx;
  ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  return { canvas, ctx };
}

function rgba(rgb: string, alpha: number): string {
  return `rgba(${rgb}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

function radialSprite(radius: number, dpr: number, stops: Array<[number, string]>): HTMLCanvasElement {
  const size = Math.max(2, Math.ceil(radius * 2));
  const { canvas, ctx } = makeLayer(size, size, dpr);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, radius);
  for (const [at, colour] of stops) g.addColorStop(at, colour);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

// ---- sky ---------------------------------------------------------------------------

function paintSky(c: Ctx, l: MoonseaLayout, rng: () => number, noise: (x: number, y: number) => number): Star[] {
  const { width: w, height: h, horizonY } = l;

  const sky = c.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, "#07060f");
  sky.addColorStop(0.32, "#0f0c22");
  sky.addColorStop(0.62, "#1a1534");
  sky.addColorStop(0.84, "#2c2142");
  sky.addColorStop(1, "#4a2c44");
  c.fillStyle = sky;
  c.fillRect(0, 0, w, horizonY + 2);

  // The last of a cold sunset behind the range.
  const dusk = c.createRadialGradient(w * 0.38, horizonY + h * 0.05, 0, w * 0.38, horizonY + h * 0.05, w * 0.75);
  dusk.addColorStop(0, rgba(ORANGE, 0.34));
  dusk.addColorStop(0.35, rgba(ORANGE, 0.12));
  dusk.addColorStop(1, rgba(ORANGE, 0));
  c.fillStyle = dusk;
  c.fillRect(0, 0, w, horizonY + 2);

  // Nebula and the faint river of the galaxy: noise at a quarter scale, smoothed up.
  const scale = 4;
  const nw = Math.max(8, Math.ceil(w / scale));
  const nh = Math.max(8, Math.ceil(horizonY / scale));
  const neb = document.createElement("canvas");
  neb.width = nw;
  neb.height = nh;
  const nctx = neb.getContext("2d") as Ctx;
  const img = nctx.createImageData(nw, nh);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const px = x / nw;
      const py = y / nh;
      // A band running from the upper left down towards the moon.
      const bandCentre = 0.12 + px * 0.55;
      const band = Math.exp(-((py - bandCentre) ** 2) / 0.03);
      const n = fbm2D(noise, px * 3.2, py * 3.2 + 7, 5);
      const wisps = clamp(n * 0.9 + 0.25, 0, 1) ** 2;
      const fade = clamp(1 - py * 0.9, 0, 1);
      const a = clamp(wisps * (0.25 + band * 0.75) * fade, 0, 1);
      const pink = clamp(0.5 + fbm2D(noise, px * 2 + 40, py * 2, 3) * 0.8, 0, 1);
      const i = (y * nw + x) * 4;
      img.data[i] = 120 + pink * 110;
      img.data[i + 1] = 92 + pink * 50;
      img.data[i + 2] = 168 + (1 - pink) * 50;
      img.data[i + 3] = a * 58;
    }
  }
  nctx.putImageData(img, 0, 0);
  c.save();
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  c.globalCompositeOperation = "screen";
  c.drawImage(neb, 0, 0, w, horizonY);
  c.restore();

  // Stars: many faint, a few bright. The brightest are kept to twinkle.
  const count = Math.round(clamp((w * horizonY) / 1500, 120, 900));
  const twinkle: Star[] = [];
  for (let i = 0; i < count; i++) {
    const x = rng() * w;
    const y = rng() ** 1.35 * horizonY * 0.96;
    const big = rng() < 0.06;
    const r = big ? 0.9 + rng() * 0.9 : 0.35 + rng() * 0.6;
    const nearHorizon = 1 - clamp((y - horizonY * 0.55) / (horizonY * 0.45), 0, 1) * 0.7;
    const base = (big ? 0.55 + rng() * 0.4 : 0.18 + rng() * 0.45) * nearHorizon;
    if (big && twinkle.length < TWINKLE_STARS) {
      twinkle.push({ x, y, r: r * 1.6, phase: rng() * TAU, speed: 0.6 + rng() * 1.8, base });
      continue;
    }
    c.fillStyle = rgba(rng() < 0.2 ? SAKURA : MIST, base);
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  }
  return twinkle;
}

/** A jagged range: ridged noise sharpened into peaks. */
function ridgeHeights(width: number, step: number, noise: (x: number, y: number) => number, salt: number, roughness: number): number[] {
  const out: number[] = [];
  for (let x = 0; x <= width + step; x += step) {
    const u = x / 900;
    let ridged = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    for (let o = 0; o < 5; o++) {
      const n = 1 - Math.abs(noise(u * freq * roughness + salt, salt * 0.37 + o * 11));
      ridged += n * n * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    out.push(ridged / norm);
  }
  return out;
}

function paintRidge(
  c: Ctx,
  l: MoonseaLayout,
  index: number,
  noise: (x: number, y: number) => number,
  rng: () => number,
): void {
  const { width: w, horizonY } = l;
  const top = l.ridgeTops[index];
  const amplitude = horizonY - top;
  const step = 3;
  const salt = 13 + index * 29;
  const heights = ridgeHeights(w, step, noise, salt, index === 0 ? 2.4 : index === 1 ? 1.8 : 1.3);
  const points: Array<[number, number]> = heights.map((value, i) => {
    const x = i * step;
    // Peaks gather towards the middle-right on the far ridge, so the copy's side stays low.
    const lean = index === 0 ? 0.55 + 0.45 * Math.sin(clamp(x / w, 0, 1) * Math.PI * 0.9 + 0.35) : 1;
    const y = horizonY + 4 - amplitude * (0.22 + 0.78 * value ** 1.5) * lean;
    return [x, y];
  });

  const colours: Array<[string, string]> = [
    ["#3a3358", "#231d3a"],
    ["#241f3c", "#17132a"],
    ["#151124", "#0e0b19"],
  ];
  const [hi, lo] = colours[index];
  const fill = c.createLinearGradient(0, top, 0, horizonY + 6);
  fill.addColorStop(0, hi);
  fill.addColorStop(1, lo);

  c.beginPath();
  c.moveTo(-2, horizonY + 8);
  for (const [x, y] of points) c.lineTo(x, y);
  c.lineTo(w + 2, horizonY + 8);
  c.closePath();
  c.fillStyle = fill;
  c.fill();

  // Snow on the far peaks and a moonlit rim on the slopes that face the moon.
  const moonSide = Math.sign(l.moon.x - w / 2) || 1;
  c.lineCap = "round";
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const slope = ((y1 - y0) / step) * moonSide;
    const facing = clamp(slope * 0.9, 0, 1);
    const height = clamp((horizonY - y1) / amplitude, 0, 1);
    // Snow clings to the highest peaks, brightest on the moon's side, and only a little way down.
    if (index === 0 && height > 0.62) {
      const depth = Math.min((height - 0.62) * amplitude * 0.35, amplitude * 0.08);
      const snow = c.createLinearGradient(0, y1, 0, y1 + depth);
      snow.addColorStop(0, rgba(MOONLIGHT, 0.1 + facing * 0.32));
      snow.addColorStop(1, rgba(MOONLIGHT, 0));
      c.fillStyle = snow;
      c.fillRect(x1 - step / 2, y1, step + 0.5, depth);
    }
    if (facing > 0.04) {
      c.strokeStyle = rgba(MOONLIGHT, facing * (index === 0 ? 0.42 : index === 1 ? 0.24 : 0.12));
      c.lineWidth = index === 0 ? 1.4 : 1;
      c.beginPath();
      c.moveTo(x0, y0 + 0.6);
      c.lineTo(x1, y1 + 0.6);
      c.stroke();
    }
  }

  // Cedars along the nearest ridge.
  if (index === 2) {
    c.fillStyle = lo;
    let x = -10;
    while (x < w + 10) {
      const i = clamp(Math.round(x / step), 0, points.length - 1);
      const base = points[i][1];
      const tall = (10 + rng() * 22) * (l.unit / 800 + 0.4);
      drawCedar(c, x, base + 3, tall, tall * 0.34);
      x += 4 + rng() * 11;
    }
  }

  // Mist settling in the valley in front of the ridge.
  const veil = c.createLinearGradient(0, horizonY - amplitude * 0.45, 0, horizonY + 6);
  veil.addColorStop(0, rgba(MIST, 0));
  veil.addColorStop(1, rgba(MIST, index === 0 ? 0.16 : index === 1 ? 0.12 : 0.08));
  c.fillStyle = veil;
  c.fillRect(0, horizonY - amplitude * 0.45, w, amplitude * 0.45 + 6);
}

function drawCedar(c: Ctx, x: number, base: number, height: number, halfWidth: number): void {
  c.beginPath();
  c.moveTo(x, base - height);
  const tiers = 4;
  for (let t = 1; t <= tiers; t++) {
    const y = base - height + (height * t) / tiers;
    const span = halfWidth * (0.45 + (0.55 * t) / tiers);
    c.lineTo(x + span, y);
    if (t < tiers) c.lineTo(x + span * 0.45, y - height * 0.04);
  }
  for (let t = tiers; t >= 1; t--) {
    const y = base - height + (height * t) / tiers;
    const span = halfWidth * (0.45 + (0.55 * t) / tiers);
    if (t < tiers) c.lineTo(x - span * 0.45, y - height * 0.04);
    c.lineTo(x - span, y);
  }
  c.closePath();
  c.fill();
}

/** The sea of cloud filling the valley, lit like water by the moon. */
function paintCloudSea(c: Ctx, l: MoonseaLayout, noise: (x: number, y: number) => number): void {
  const { width: w, horizonY, railY, moon } = l;
  const top = horizonY - 2;
  const bottom = railY + 4;
  const depth = bottom - top;
  // The cloud rises out of the valley: its top is feathered over the foot of the near ridge.
  const feather = Math.max(18, l.carHeight * 0.7);

  const base = c.createLinearGradient(0, top - feather, 0, bottom);
  const f = feather / (depth + feather);
  base.addColorStop(0, "rgba(61, 54, 87, 0)");
  base.addColorStop(f * 0.55, "rgba(61, 54, 87, 0.7)");
  base.addColorStop(f, "#3d3657");
  base.addColorStop(f + (1 - f) * 0.18, "#2a2443");
  base.addColorStop(f + (1 - f) * 0.6, "#171329");
  base.addColorStop(1, "#0e0b1a");
  c.fillStyle = base;
  c.fillRect(0, top - feather, w, depth + feather);

  // Billows: noise at a third scale, lighter on the crests.
  const scale = 3;
  const cw = Math.max(8, Math.ceil(w / scale));
  const ch = Math.max(4, Math.ceil(depth / scale));
  const tex = document.createElement("canvas");
  tex.width = cw;
  tex.height = ch;
  const tctx = tex.getContext("2d") as Ctx;
  const img = tctx.createImageData(cw, ch);
  for (let y = 0; y < ch; y++) {
    const py = y / ch;
    // Perspective: billows flatten and shrink towards the horizon.
    const stretch = 1 + (1 - py) * 4;
    for (let x = 0; x < cw; x++) {
      const px = x / cw;
      const n = fbm2D(noise, px * 6, (py * 6) * stretch * 0.6 + 90, 5);
      const crest = clamp(n * 1.3 + 0.1, 0, 1) ** 1.6;
      const i = (y * cw + x) * 4;
      img.data[i] = 200;
      img.data[i + 1] = 196;
      img.data[i + 2] = 226;
      img.data[i + 3] = crest * (36 + (1 - py) * 40);
    }
  }
  tctx.putImageData(img, 0, 0);
  c.save();
  c.imageSmoothingEnabled = true;
  c.drawImage(tex, 0, top, w, depth);
  c.restore();

  // The moon's road across the cloud, kept below the cloud's top.
  c.save();
  c.beginPath();
  c.rect(0, top, w, depth);
  c.clip();
  c.translate(moon.x, top);
  c.scale(1, depth / (moon.r * 5));
  const road = c.createRadialGradient(0, 0, 0, 0, 0, moon.r * 5);
  road.addColorStop(0, rgba(MOONLIGHT, 0.38));
  road.addColorStop(0.3, rgba(MOONLIGHT, 0.14));
  road.addColorStop(1, rgba(MOONLIGHT, 0));
  c.fillStyle = road;
  c.beginPath();
  c.ellipse(0, 0, moon.r * 2.2, moon.r * 5, 0, 0, TAU);
  c.fill();
  c.restore();

  // The cloud's top catches the moon in a soft band.
  const seam = c.createLinearGradient(0, top - feather * 0.6, 0, top + feather * 0.8);
  seam.addColorStop(0, rgba(MIST, 0));
  seam.addColorStop(0.5, rgba(MIST, 0.12));
  seam.addColorStop(1, rgba(MIST, 0));
  c.fillStyle = seam;
  c.fillRect(0, top - feather * 0.6, w, feather * 1.4);
}

function makeMoon(l: MoonseaLayout, dpr: number, noise: (x: number, y: number) => number): { disc: HTMLCanvasElement; halo: HTMLCanvasElement } {
  const r = l.moon.r;
  const size = Math.ceil(r * 2 + 4);
  const { canvas: disc, ctx } = makeLayer(size, size, dpr);
  // Shaded per pixel at the sprite's own resolution: soft dark seas (the maria
  // the story's title is named for), fine highland grain, and a darker limb.
  const px = disc.width;
  const img = ctx.createImageData(px, px);
  const pr = (r / size) * px;
  const pc = px / 2;
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const dx = (x + 0.5 - pc) / pr;
      const dy = (y + 0.5 - pc) / pr;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      const edge = clamp((1 - Math.sqrt(d2)) * pr, 0, 1);
      const maria = clamp(fbm2D(noise, dx * 1.25 + 300, dy * 1.25 - 40, 4) * 1.8 + 0.05, 0, 1) ** 1.3;
      const grain = fbm2D(noise, dx * 9 + 70, dy * 9 + 70, 3) * 0.06;
      const limb = Math.sqrt(1 - d2) ** 0.35;
      const light = (0.98 - maria * 0.32 + grain) * (0.72 + 0.28 * limb);
      const i = (y * px + x) * 4;
      img.data[i] = 252 * light;
      img.data[i + 1] = 246 * light;
      img.data[i + 2] = 236 * light;
      img.data[i + 3] = 255 * edge;
    }
  }
  ctx.putImageData(img, 0, 0);

  const halo = radialSprite(r * 6, dpr, [
    [0, rgba(MOONLIGHT, 0.42)],
    [0.16, rgba(MOONLIGHT, 0.2)],
    [0.4, rgba(SAKURA, 0.06)],
    [1, rgba(SAKURA, 0)],
  ]);
  return { disc, halo };
}

/** A wide band of mist that tiles seamlessly sideways (noise sampled on a cylinder). */
function makeMist(width: number, height: number, dpr: number, noise: (x: number, y: number) => number, salt: number, strength: number): HTMLCanvasElement {
  const scale = 4;
  const mw = Math.max(16, Math.ceil(width / scale));
  const mh = Math.max(4, Math.ceil(height / scale));
  const small = document.createElement("canvas");
  small.width = mw;
  small.height = mh;
  const sctx = small.getContext("2d") as Ctx;
  const img = sctx.createImageData(mw, mh);
  const radius = 2.2;
  for (let x = 0; x < mw; x++) {
    const a = (x / mw) * TAU;
    const nx = Math.cos(a) * radius + salt;
    const nz = Math.sin(a) * radius;
    for (let y = 0; y < mh; y++) {
      const py = y / mh;
      const profile = Math.sin(py * Math.PI) ** 1.4;
      const n = fbm2D(noise, nx + py * 1.4, nz + py * 2.2 + salt, 4);
      const a2 = clamp(n * 0.9 + 0.45, 0, 1) * profile;
      const i = (y * mw + x) * 4;
      img.data[i] = 205;
      img.data[i + 1] = 209;
      img.data[i + 2] = 228;
      img.data[i + 3] = a2 * 255 * strength;
    }
  }
  sctx.putImageData(img, 0, 0);
  const { canvas, ctx } = makeLayer(width, height, dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, width, height);
  return canvas;
}

// ---- track and platform ----------------------------------------------------------

function paintTrack(c: Ctx, l: MoonseaLayout, rng: () => number): void {
  const { width: w, railY, carHeight, platformY } = l;
  const bedTop = railY - carHeight * 0.05;
  const bed = c.createLinearGradient(0, bedTop, 0, platformY + 2);
  bed.addColorStop(0, "#0c0a15");
  bed.addColorStop(1, "#08070e");
  c.fillStyle = bed;
  c.fillRect(0, bedTop, w, platformY - bedTop + 2);
  // Sleepers.
  c.fillStyle = "rgba(60, 52, 70, 0.55)";
  for (let x = rng() * 20; x < w; x += carHeight * 0.42) {
    c.fillRect(x, railY + 1, carHeight * 0.16, carHeight * 0.07);
  }
  // Rails with moonlight along their heads.
  for (const [y, alpha] of [
    [railY, 0.5],
    [railY + carHeight * 0.09, 0.32],
  ] as const) {
    c.fillStyle = "#1c1a26";
    c.fillRect(0, y - 1, w, 2.4);
    c.fillStyle = rgba(MOONLIGHT, alpha);
    c.fillRect(0, y - 1, w, 0.9);
  }
}

function paintForeground(c: Ctx, l: MoonseaLayout, rng: () => number): { bulb: { x: number; y: number } } {
  const { width: w, height: h, platformY, carHeight } = l;

  // Platform: a coping of old stone, then the worn surface.
  const coping = carHeight * 0.16;
  const copingFill = c.createLinearGradient(0, platformY, 0, platformY + coping);
  copingFill.addColorStop(0, "#4a4560");
  copingFill.addColorStop(0.25, "#2b2739");
  copingFill.addColorStop(1, "#16131f");
  c.fillStyle = copingFill;
  c.fillRect(0, platformY, w, coping);
  c.fillStyle = rgba(MOONLIGHT, 0.32);
  c.fillRect(0, platformY, w, 1);
  c.strokeStyle = "rgba(8, 6, 14, 0.7)";
  c.lineWidth = 1;
  for (let x = rng() * 40; x < w; x += carHeight * (0.9 + rng() * 0.5)) {
    c.beginPath();
    c.moveTo(x, platformY + 1);
    c.lineTo(x + 1, platformY + coping);
    c.stroke();
  }
  const surface = c.createLinearGradient(0, platformY + coping, 0, h);
  surface.addColorStop(0, "#14111d");
  surface.addColorStop(0.5, "#0d0b15");
  surface.addColorStop(1, "#06050b");
  c.fillStyle = surface;
  c.fillRect(0, platformY + coping, w, h - platformY - coping);
  // Worn speckle.
  for (let i = 0; i < (w * (h - platformY)) / 900; i++) {
    const x = rng() * w;
    const y = platformY + coping + rng() * (h - platformY - coping);
    c.fillStyle = `rgba(150, 140, 170, ${(0.03 + rng() * 0.05).toFixed(3)})`;
    c.fillRect(x, y, 1 + rng() * 2, 1);
  }
  // Petals that have already settled.
  for (let i = 0; i < Math.round(w / 26); i++) {
    const x = rng() * w;
    const y = platformY + coping + 2 + rng() ** 0.7 * (h - platformY - coping - 4);
    const s = 1.6 + rng() * 2.6 * (0.6 + (y - platformY) / (h - platformY));
    c.fillStyle = rgba(SAKURA, 0.18 + rng() * 0.22);
    c.beginPath();
    c.ellipse(x, y, s, s * 0.45, rng() * TAU, 0, TAU);
    c.fill();
  }

  paintBuilding(c, l, rng);
  paintBench(c, l);
  if (l.sign) paintSign(c, l);
  const bulb = paintLampPost(c, l);
  paintLily(c, l, rng);
  return { bulb };
}

function paintBuilding(c: Ctx, l: MoonseaLayout, rng: () => number): void {
  const { width: w, groundY, eaveY, buildingX, carHeight, clock } = l;
  const wallTop = eaveY - carHeight * 0.6;
  // Wall of dark boards.
  c.fillStyle = "#100d18";
  c.fillRect(buildingX, wallTop, w - buildingX + 2, groundY - wallTop);
  c.strokeStyle = "rgba(70, 62, 90, 0.35)";
  c.lineWidth = 1;
  for (let x = buildingX + 6; x < w; x += 7 + rng() * 4) {
    c.beginPath();
    c.moveTo(x, wallTop + 4);
    c.lineTo(x, groundY);
    c.stroke();
  }
  // A glassless window with the dark waiting room behind it.
  const winW = Math.min((w - buildingX) * 0.42, carHeight * 1.4);
  if (winW > 12) {
    const wx = buildingX + (w - buildingX) * 0.3;
    const wy = eaveY + carHeight * 0.9;
    const wh = carHeight * 0.95;
    const inner = c.createLinearGradient(wx, wy, wx, wy + wh);
    inner.addColorStop(0, "#04030a");
    inner.addColorStop(1, "#120e1c");
    c.fillStyle = inner;
    c.fillRect(wx, wy, winW, wh);
    c.strokeStyle = "#2a2536";
    c.lineWidth = 2;
    c.strokeRect(wx, wy, winW, wh);
    c.beginPath();
    c.moveTo(wx + winW / 2, wy);
    c.lineTo(wx + winW / 2, wy + wh);
    c.stroke();
  }
  // The eave: a tiled roof reaching over the platform, on two posts.
  const eaveLeft = buildingX - (w - buildingX) * 0.55 - carHeight * 0.8;
  const roofTop = wallTop - carHeight * 0.55;
  c.fillStyle = "#0a0811";
  c.beginPath();
  c.moveTo(eaveLeft - 6, eaveY);
  c.lineTo(eaveLeft + carHeight * 0.4, roofTop + carHeight * 0.25);
  c.lineTo(w + 4, roofTop);
  c.lineTo(w + 4, eaveY + 4);
  c.closePath();
  c.fill();
  // Tile rows catching the moon.
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    c.strokeStyle = rgba(MOONLIGHT, 0.06 + t * 0.05);
    c.beginPath();
    c.moveTo(eaveLeft + carHeight * 0.4 * (1 - t) - 6 * (1 - t), roofTop + carHeight * 0.25 + (eaveY - roofTop - carHeight * 0.25) * t);
    c.lineTo(w + 4, roofTop + (eaveY + 4 - roofTop) * t);
    c.stroke();
  }
  c.strokeStyle = rgba(MOONLIGHT, 0.22);
  c.beginPath();
  c.moveTo(eaveLeft - 6, eaveY);
  c.lineTo(eaveLeft + carHeight * 0.4, roofTop + carHeight * 0.25);
  c.stroke();
  c.fillStyle = "#0d0a14";
  for (const px of [eaveLeft + carHeight * 0.3, buildingX - carHeight * 0.2]) {
    c.fillRect(px, eaveY, carHeight * 0.1, groundY - eaveY);
  }
  // The clock, stopped at 7:14.
  if (clock) {
    c.strokeStyle = "#0a0811";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(clock.x, eaveY);
    c.lineTo(clock.x, clock.y - clock.r);
    c.stroke();
    c.fillStyle = "#cfc8bd";
    c.beginPath();
    c.arc(clock.x, clock.y, clock.r, 0, TAU);
    c.fill();
    c.strokeStyle = "#2b2533";
    c.lineWidth = Math.max(1.5, clock.r * 0.14);
    c.stroke();
    c.lineCap = "round";
    const hourAngle = ((7 + 14 / 60) / 12) * TAU - Math.PI / 2;
    const minuteAngle = (14 / 60) * TAU - Math.PI / 2;
    c.strokeStyle = "#1b1622";
    c.lineWidth = Math.max(1.2, clock.r * 0.12);
    c.beginPath();
    c.moveTo(clock.x, clock.y);
    c.lineTo(clock.x + Math.cos(hourAngle) * clock.r * 0.5, clock.y + Math.sin(hourAngle) * clock.r * 0.5);
    c.stroke();
    c.lineWidth = Math.max(1, clock.r * 0.08);
    c.beginPath();
    c.moveTo(clock.x, clock.y);
    c.lineTo(clock.x + Math.cos(minuteAngle) * clock.r * 0.8, clock.y + Math.sin(minuteAngle) * clock.r * 0.8);
    c.stroke();
    // Dim under the eave.
    c.fillStyle = "rgba(10, 8, 20, 0.35)";
    c.beginPath();
    c.arc(clock.x, clock.y, clock.r + 1, 0, TAU);
    c.fill();
  }
}

function paintBench(c: Ctx, l: MoonseaLayout): void {
  const { bench, carHeight } = l;
  const seatY = bench.y - carHeight * 0.48;
  const left = bench.x - bench.width / 2;
  c.fillStyle = "#0c0a13";
  // Legs.
  for (const fx of [0.1, 0.86]) c.fillRect(left + bench.width * fx, seatY, carHeight * 0.07, bench.y - seatY);
  // Seat and backrest slats.
  for (let i = 0; i < 3; i++) c.fillRect(left, seatY - i * carHeight * 0.075, bench.width, carHeight * 0.05);
  for (let i = 0; i < 2; i++) c.fillRect(left, seatY - carHeight * (0.36 + i * 0.12), bench.width, carHeight * 0.06);
  c.fillRect(left + bench.width * 0.12, seatY - carHeight * 0.5, carHeight * 0.05, carHeight * 0.5);
  c.fillRect(left + bench.width * 0.84, seatY - carHeight * 0.5, carHeight * 0.05, carHeight * 0.5);
  c.fillStyle = rgba(MOONLIGHT, 0.14);
  c.fillRect(left, seatY - carHeight * 0.48, bench.width, 1);
  c.fillRect(left, seatY - carHeight * 0.15, bench.width, 1);
}

function paintSign(c: Ctx, l: MoonseaLayout): void {
  const sign = l.sign;
  if (!sign) return;
  const { carHeight } = l;
  const boardW = sign.width;
  const boardH = boardW * 0.42;
  const boardBottom = sign.y - carHeight * 0.95;
  const left = sign.x - boardW / 2;
  const top = boardBottom - boardH;
  c.fillStyle = "#0b0912";
  c.fillRect(left + boardW * 0.12, top, 3, sign.y - top);
  c.fillRect(left + boardW * 0.88 - 3, top, 3, sign.y - top);
  // Board, pale in the moonlight, its paint gone at the corners.
  const face = c.createLinearGradient(left, top, left + boardW, boardBottom);
  face.addColorStop(0, "#bdb8c6");
  face.addColorStop(1, "#8f8a9c");
  c.fillStyle = face;
  c.fillRect(left, top, boardW, boardH);
  c.fillStyle = "#26304a";
  c.fillRect(left, top + boardH * 0.66, boardW, boardH * 0.12);
  c.fillStyle = "#1a1622";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `600 ${(boardH * 0.34).toFixed(1)}px "Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", serif`;
  c.fillText("つきのみ", sign.x, top + boardH * 0.33);
  c.font = `500 ${(boardH * 0.12).toFixed(1)}px "Cormorant Garamond", Georgia, serif`;
  c.fillText("T S U K I N O M I", sign.x, top + boardH * 0.57);
  c.fillStyle = "#cfcad8";
  c.font = `${(boardH * 0.1).toFixed(1)}px "Noto Serif JP", serif`;
  c.textAlign = "left";
  c.fillText("←", left + boardW * 0.05, top + boardH * 0.72);
  c.textAlign = "right";
  c.fillText("→", left + boardW * 0.95, top + boardH * 0.72);
  // Weathering.
  c.fillStyle = "rgba(20, 16, 30, 0.35)";
  c.fillRect(left, top + boardH * 0.9, boardW, boardH * 0.1);
}

function paintLampPost(c: Ctx, l: MoonseaLayout): { x: number; y: number } {
  const { lamp, carHeight } = l;
  const topY = lamp.y - lamp.postHeight;
  const thick = Math.max(3, carHeight * 0.075);
  c.fillStyle = "#0a0810";
  c.fillRect(lamp.x - thick / 2, topY, thick, lamp.postHeight);
  c.fillRect(lamp.x - thick * 1.4, lamp.y - carHeight * 0.22, thick * 2.8, carHeight * 0.22);
  c.fillStyle = rgba(MOONLIGHT, 0.16);
  c.fillRect(lamp.x + thick / 2 - 1, topY, 1, lamp.postHeight);
  // A bracket reaching out, a shade, and the bulb under it.
  const reach = carHeight * 0.55;
  const armY = topY + carHeight * 0.08;
  c.strokeStyle = "#0a0810";
  c.lineWidth = Math.max(2, thick * 0.55);
  c.beginPath();
  c.moveTo(lamp.x, armY + carHeight * 0.2);
  c.quadraticCurveTo(lamp.x, armY, lamp.x - reach, armY);
  c.stroke();
  const shadeW = carHeight * 0.42;
  const shadeY = armY + carHeight * 0.05;
  c.fillStyle = "#14101c";
  c.beginPath();
  c.moveTo(lamp.x - reach - shadeW / 2, shadeY + carHeight * 0.18);
  c.lineTo(lamp.x - reach - shadeW * 0.18, shadeY);
  c.lineTo(lamp.x - reach + shadeW * 0.18, shadeY);
  c.lineTo(lamp.x - reach + shadeW / 2, shadeY + carHeight * 0.18);
  c.closePath();
  c.fill();
  return { x: lamp.x - reach, y: shadeY + carHeight * 0.24 };
}

function paintLily(c: Ctx, l: MoonseaLayout, rng: () => number): void {
  const { lily, carHeight } = l;
  const scale = carHeight / 60;
  const glow = c.createRadialGradient(lily.x, lily.y - 18 * scale, 0, lily.x, lily.y - 18 * scale, 60 * scale);
  glow.addColorStop(0, rgba(HIGAN, 0.22));
  glow.addColorStop(1, rgba(HIGAN, 0));
  c.fillStyle = glow;
  c.fillRect(lily.x - 60 * scale, lily.y - 78 * scale, 120 * scale, 120 * scale);
  for (let f = 0; f < 5; f++) {
    const fx = lily.x + (f - 2) * 9 * scale + (rng() - 0.5) * 6 * scale;
    const stemH = (26 + rng() * 22) * scale;
    const fy = lily.y - stemH;
    c.strokeStyle = "#1c2a1e";
    c.lineWidth = 1.4 * scale + 0.4;
    c.beginPath();
    c.moveTo(fx + (rng() - 0.5) * 4, lily.y + 4);
    c.quadraticCurveTo(fx + (rng() - 0.5) * 8 * scale, lily.y - stemH * 0.5, fx, fy);
    c.stroke();
    // Six curling petals and long stamens, the spider lily's shape.
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * TAU + rng() * 0.4;
      const len = (6 + rng() * 3) * scale;
      c.strokeStyle = rgba(HIGAN, 0.92);
      c.lineWidth = 1.6 * scale + 0.3;
      c.beginPath();
      c.moveTo(fx, fy);
      c.quadraticCurveTo(fx + Math.cos(a) * len, fy + Math.sin(a) * len - 3 * scale, fx + Math.cos(a + 0.6) * len * 0.9, fy + Math.sin(a + 0.6) * len * 0.9 - 6 * scale);
      c.stroke();
      c.strokeStyle = rgba(HIGAN, 0.65);
      c.lineWidth = 0.6 * scale + 0.2;
      c.beginPath();
      c.moveTo(fx, fy);
      c.quadraticCurveTo(fx + Math.cos(a) * len * 1.6, fy + Math.sin(a) * len * 1.3 - 6 * scale, fx + Math.cos(a - 0.3) * len * 2.1, fy + Math.sin(a - 0.3) * len * 1.6 - 10 * scale);
      c.stroke();
    }
  }
}

// ---- the train ------------------------------------------------------------------------

interface TrainSprites {
  body: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  spill: HTMLCanvasElement;
  length: number;
  headlight: { x: number; y: number };
}

function makeTrain(l: MoonseaLayout, lit: boolean[], dpr: number, rng: () => number): TrainSprites {
  const carH = l.carHeight;
  const carL = l.carLength;
  const gap = carH * 0.12;
  const cars = 1 + lit.length;
  const length = cars * carL + (cars - 1) * gap;
  const pad = carH * 0.6;
  const height = carH + pad * 2;
  const body = makeLayer(length, height, dpr);
  const glow = makeLayer(length, height, dpr);
  // The light falls on the coping and the strip of platform in front of the props.
  const spillH = Math.max(8, (l.groundY - l.platformY) * 0.9);
  const spill = makeLayer(length, spillH, dpr);
  const b = body.ctx;
  const g = glow.ctx;
  const s = spill.ctx;
  const top = pad;
  const windowTop = top + carH * 0.24;
  const windowH = carH * 0.34;

  for (let car = 0; car < cars; car++) {
    const x = car * (carL + gap);
    const isCab = car === 0;
    const on = !isCab && lit[car - 1];
    // Body.
    const shell = b.createLinearGradient(0, top, 0, top + carH);
    shell.addColorStop(0, "#3a3650");
    shell.addColorStop(0.1, "#262338");
    shell.addColorStop(0.75, "#1b1929");
    shell.addColorStop(1, "#0e0c16");
    b.fillStyle = shell;
    b.beginPath();
    if (isCab) {
      // The nose faces left, the way the train runs.
      b.moveTo(x + carH * 0.5, top);
      b.lineTo(x + carL, top);
      b.lineTo(x + carL, top + carH * 0.88);
      b.lineTo(x + carH * 0.08, top + carH * 0.88);
      b.quadraticCurveTo(x - carH * 0.04, top + carH * 0.5, x + carH * 0.12, top + carH * 0.18);
      b.quadraticCurveTo(x + carH * 0.22, top, x + carH * 0.5, top);
    } else {
      b.roundRect(x, top, carL, carH * 0.88, carH * 0.08);
    }
    b.fill();
    // Moonlit roof edge and the faded stripe under the windows.
    b.fillStyle = rgba(MOONLIGHT, 0.35);
    b.fillRect(x + (isCab ? carH * 0.45 : carH * 0.05), top, carL - (isCab ? carH * 0.45 : carH * 0.1), 1.2);
    b.fillStyle = rgba(SAKURA, 0.2);
    b.fillRect(x + (isCab ? carH * 0.1 : 0), windowTop + windowH + carH * 0.08, carL - (isCab ? carH * 0.1 : 0), carH * 0.05);
    // Bogies and wheels.
    b.fillStyle = "#07060c";
    for (const at of [0.2, 0.8]) {
      const bx = x + carL * at;
      b.fillRect(bx - carH * 0.32, top + carH * 0.84, carH * 0.64, carH * 0.1);
      for (const off of [-0.18, 0.18]) {
        b.beginPath();
        b.arc(bx + off * carH, top + carH * 0.95, carH * 0.075, 0, TAU);
        b.fill();
      }
    }

    // Windows.
    const firstWindow = isCab ? carH * 1.15 : carH * 0.32;
    const usable = carL - firstWindow - carH * 0.32;
    const count = isCab ? 2 : 5;
    const winW = (usable / count) * 0.74;
    for (let i = 0; i < count; i++) {
      const wx = x + firstWindow + (usable / count) * i + (usable / count - winW) / 2;
      if (on) {
        const pane = b.createLinearGradient(0, windowTop, 0, windowTop + windowH);
        pane.addColorStop(0, "#ffe1ad");
        pane.addColorStop(1, "#e9a25c");
        b.fillStyle = pane;
        b.fillRect(wx, windowTop, winW, windowH);
        // Now and then a passenger's shoulder against the light.
        if (rng() < 0.35) {
          b.fillStyle = "rgba(40, 24, 30, 0.75)";
          const px = wx + winW * (0.2 + rng() * 0.5);
          b.beginPath();
          b.ellipse(px, windowTop + windowH * 0.55, winW * 0.13, windowH * 0.18, 0, 0, TAU);
          b.fill();
          b.fillRect(px - winW * 0.22, windowTop + windowH * 0.7, winW * 0.44, windowH * 0.3);
        }
        const halo = g.createRadialGradient(wx + winW / 2, windowTop + windowH / 2, 0, wx + winW / 2, windowTop + windowH / 2, winW * 1.3);
        halo.addColorStop(0, rgba(LAMP, 0.5));
        halo.addColorStop(1, rgba(LAMP, 0));
        g.fillStyle = halo;
        g.fillRect(wx - winW, windowTop - winW, winW * 3, windowH + winW * 2);
        // The light the window throws down on the platform edge.
        const spillTop = 0;
        const fall = s.createLinearGradient(0, spillTop, 0, spillH);
        fall.addColorStop(0, rgba(LAMP, 0.2));
        fall.addColorStop(0.35, rgba(LAMP, 0.08));
        fall.addColorStop(1, rgba(LAMP, 0));
        s.fillStyle = fall;
        s.beginPath();
        s.moveTo(wx, spillTop);
        s.lineTo(wx + winW, spillTop);
        s.lineTo(wx + winW * 1.25, spillH);
        s.lineTo(wx - winW * 0.25, spillH);
        s.closePath();
        s.fill();
      } else {
        // Dark glass with the moon sliding on it.
        b.fillStyle = "#0b0a14";
        b.fillRect(wx, windowTop, winW, windowH);
        const sheen = b.createLinearGradient(wx, windowTop, wx + winW, windowTop + windowH);
        sheen.addColorStop(0, rgba(MIST, 0));
        sheen.addColorStop(0.45, rgba(MIST, 0.1));
        sheen.addColorStop(0.55, rgba(MIST, 0.02));
        sheen.addColorStop(1, rgba(MIST, 0));
        b.fillStyle = sheen;
        b.fillRect(wx, windowTop, winW, windowH);
      }
    }
    // Doors.
    if (!isCab) {
      b.strokeStyle = "rgba(0, 0, 0, 0.45)";
      b.lineWidth = 1;
      for (const at of [0.06, 0.94]) {
        const dx = x + carL * at;
        b.strokeRect(dx - carH * 0.12, top + carH * 0.18, carH * 0.24, carH * 0.66);
      }
    }
    // Coupler gap.
    if (car < cars - 1) {
      b.fillStyle = "#06050a";
      b.fillRect(x + carL, top + carH * 0.3, gap, carH * 0.45);
    }
  }
  // Cab: the driver's glass is dark, the headlight is on.
  const headlight = { x: carH * 0.16, y: top + carH * 0.66 };
  b.fillStyle = "#fff6dc";
  b.beginPath();
  b.arc(headlight.x, headlight.y, carH * 0.055, 0, TAU);
  b.fill();
  b.fillStyle = "rgba(220, 70, 60, 0.85)";
  b.beginPath();
  b.arc(headlight.x + carH * 0.05, top + carH * 0.3, carH * 0.03, 0, TAU);
  b.fill();
  return { body: body.canvas, glow: glow.canvas, spill: spill.canvas, length, headlight };
}

// ---- petals --------------------------------------------------------------------------

function makePetalSprites(dpr: number): HTMLCanvasElement[] {
  const tints = [
    ["#f3c6d6", "#d98aa6"],
    ["#f7d9e3", "#e3a5bb"],
    ["#eab3c6", "#c7768f"],
    ["#fde8ee", "#e9b3c4"],
  ];
  return tints.map(([light, dark]) => {
    const size = 24;
    const { canvas, ctx } = makeLayer(size, size, dpr);
    const g = ctx.createLinearGradient(4, 4, 20, 20);
    g.addColorStop(0, light);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    // A sakura petal: rounded, with the notch at its tip.
    ctx.moveTo(12, 21);
    ctx.bezierCurveTo(3, 16, 3, 6, 9, 3.5);
    ctx.lineTo(12, 6.5);
    ctx.lineTo(15, 3.5);
    ctx.bezierCurveTo(21, 6, 21, 16, 12, 21);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(12, 20);
    ctx.lineTo(12, 8);
    ctx.stroke();
    return canvas;
  });
}

function spawnPetal(p: Petal | null, l: MoonseaLayout, rng: () => number, anywhere: boolean): Petal {
  const depth = 0.45 + rng() * 0.75;
  const petal: Petal = p ?? ({} as Petal);
  petal.depth = depth;
  petal.size = (5 + rng() * 6) * depth * (l.unit / 900 + 0.55);
  petal.x = anywhere ? rng() * l.width : l.width * (0.15 + rng() * 1.0);
  petal.y = anywhere ? rng() * l.height : -20 - rng() * l.height * 0.2;
  petal.vx = -(8 + rng() * 16) * depth;
  petal.vy = (12 + rng() * 18) * depth;
  petal.rot = rng() * TAU;
  petal.spin = (rng() - 0.5) * 1.6;
  petal.tumble = rng() * TAU;
  petal.tumbleSpeed = 1.2 + rng() * 2.4;
  petal.variant = Math.floor(rng() * 4);
  petal.alpha = clamp(0.35 + depth * 0.5, 0, 0.95);
  return petal;
}

// ---- the scene ---------------------------------------------------------------------------

export function mountMoonsea(options: MoonseaOptions): MoonseaHandle {
  const { mount } = options;
  const seed = options.seed ?? SEED;
  const lit = litCarriages(options.furthestRead);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "tsuki-moonsea__canvas";
  mount.append(canvas);

  let baked: Baked | null = null;
  let petalSprites: HTMLCanvasElement[] = [];
  let starSprite: HTMLCanvasElement | null = null;
  let glowDot: HTMLCanvasElement | null = null;
  let petals: Petal[] = [];
  const rings: Ring[] = [];
  let meteor: Meteor | null = null;
  let nextMeteorAt = 9;
  const simRng = createRng(seed ^ 0x51);

  // Clocks: the world clock slows when time stops; the train keeps real time.
  let worldT = 0;
  let freezeStart = -1;
  let nextFreezeAt = nextFreezeDelay(simRng());
  let passStart = FIRST_PASS_DELAY_S;
  let still = Boolean(options.still);
  let lastScroll = -1;
  let bakedFonts = false;
  let destroyed = false;

  const bake = (size: Readonly<SceneSize>) => {
    const l = layoutMoonsea(size.width, size.height);
    const dpr = size.dpr;
    const rng = createRng(seed);
    const noise = createNoise2D(seed);

    const back = makeLayer(l.width, l.height, dpr);
    const stars = paintSky(back.ctx, l, rng, noise);
    paintRidge(back.ctx, l, 0, noise, rng);
    paintRidge(back.ctx, l, 1, noise, rng);
    paintRidge(back.ctx, l, 2, noise, rng);
    paintCloudSea(back.ctx, l, noise);

    const track = makeLayer(l.width, l.height, dpr);
    paintTrack(track.ctx, l, rng);

    const fore = makeLayer(l.width, l.height, dpr);
    const { bulb } = paintForeground(fore.ctx, l, rng);

    // The copy's side of the screen is kept dark, and the edges fall away.
    const veil = makeLayer(l.width, l.height, dpr);
    const side = veil.ctx.createLinearGradient(0, 0, l.width * (l.portrait ? 1 : 0.62), 0);
    side.addColorStop(0, `rgba(6, 5, 14, ${l.portrait ? 0.5 : 0.62})`);
    side.addColorStop(1, "rgba(6, 5, 14, 0)");
    veil.ctx.fillStyle = side;
    veil.ctx.fillRect(0, 0, l.width, l.height);
    if (l.portrait) {
      const middle = veil.ctx.createLinearGradient(0, l.height * 0.22, 0, l.height * 0.85);
      middle.addColorStop(0, "rgba(6, 5, 14, 0)");
      middle.addColorStop(0.5, "rgba(6, 5, 14, 0.4)");
      middle.addColorStop(1, "rgba(6, 5, 14, 0)");
      veil.ctx.fillStyle = middle;
      veil.ctx.fillRect(0, 0, l.width, l.height);
    }
    const vignette = veil.ctx.createRadialGradient(l.width * 0.6, l.height * 0.45, l.unit * 0.3, l.width * 0.6, l.height * 0.45, Math.hypot(l.width, l.height) * 0.62);
    vignette.addColorStop(0, "rgba(4, 3, 10, 0)");
    vignette.addColorStop(1, "rgba(4, 3, 10, 0.55)");
    veil.ctx.fillStyle = vignette;
    veil.ctx.fillRect(0, 0, l.width, l.height);

    const moon = makeMoon(l, dpr, noise);
    const mistFar = makeMist(l.width, Math.max(24, (l.horizonY - l.ridgeTops[2]) * 1.4), dpr, noise, 3.1, 0.5);
    const mistNear = makeMist(l.width, Math.max(24, l.carHeight * 2.4), dpr, noise, 8.7, 0.42);
    const train = makeTrain(l, lit, dpr, rng);
    const lampGlow = radialSprite(l.carHeight * 2.2, dpr, [
      [0, rgba(LAMP, 0.9)],
      [0.07, rgba(LAMP, 0.42)],
      [0.25, rgba(LAMP, 0.09)],
      [0.6, rgba(LAMP, 0.02)],
      [1, rgba(LAMP, 0)],
    ]);
    const lampPool = radialSprite(l.carHeight * 3, dpr, [
      [0, rgba(LAMP, 0.3)],
      [0.5, rgba(LAMP, 0.1)],
      [1, rgba(LAMP, 0)],
    ]);

    const glints: Glint[] = [];
    for (let i = 0; i < GLINTS; i++) {
      const v = rng();
      const y = l.horizonY + (l.railY - l.horizonY) * (0.04 + v ** 1.6 * 0.86);
      const spread = l.moon.r * (0.6 + v * 2.4);
      glints.push({
        x: l.moon.x + (rng() - 0.5) * spread * 2,
        y,
        len: (3 + rng() * 10) * (0.5 + v),
        phase: rng() * TAU,
        speed: 0.8 + rng() * 2.2,
      });
    }
    const valleyLights = Array.from({ length: l.compact ? 7 : 12 }, () => ({
      x: l.width * (0.12 + rng() * 0.8),
      y: l.horizonY + (l.railY - l.horizonY) * (0.08 + rng() * 0.35),
      r: 1 + rng() * 1.6,
      phase: rng() * TAU,
    }));

    baked = {
      layout: l,
      back,
      track,
      fore,
      veil,
      moonDisc: moon.disc,
      moonHalo: moon.halo,
      mistFar,
      mistNear,
      train: train.body,
      trainGlow: train.glow,
      trainSpill: train.spill,
      trainLength: train.length,
      headlight: train.headlight,
      lampBulb: bulb,
      lampGlow,
      lampPool,
      stars,
      glints,
      valleyLights,
    };

    petalSprites = makePetalSprites(dpr);
    starSprite = radialSprite(5, dpr, [
      [0, "rgba(255, 255, 255, 1)"],
      [0.25, rgba(MIST, 0.5)],
      [1, rgba(MIST, 0)],
    ]);
    glowDot = radialSprite(8, dpr, [
      [0, rgba(LAMP, 0.9)],
      [0.35, rgba(LAMP, 0.25)],
      [1, rgba(LAMP, 0)],
    ]);
    const wanted = petalCount(l.width, l.height);
    const prng = createRng(seed ^ 0x9e37);
    // Keep petals already in flight; only add or drop to the new count.
    if (petals.length === 0) petals = Array.from({ length: wanted }, () => spawnPetal(null, l, prng, true));
    else if (petals.length < wanted) for (let i = petals.length; i < wanted; i++) petals.push(spawnPetal(null, l, prng, true));
    else petals.length = wanted;
  };

  const drawFrame = (ctx: Ctx, frame: Readonly<SceneFrame>, moving: boolean) => {
    if (!baked) return;
    const b = baked;
    const l = b.layout;
    const { width: w, height: h } = l;
    const t = frame.t;
    const dt = moving ? frame.dt : 0;

    // ---- clocks -------------------------------------------------------------
    let globalFreeze = 1;
    if (moving) {
      if (freezeStart < 0 && t >= nextFreezeAt) freezeStart = t;
      if (freezeStart >= 0) {
        globalFreeze = freezeFactor(t - freezeStart);
        if (t - freezeStart > 3) {
          freezeStart = -1;
          nextFreezeAt = t + nextFreezeDelay(simRng());
        }
      }
    }
    worldT += dt * (0.15 + 0.85 * globalFreeze);
    const wt = moving ? worldT : 3.3;

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = NIGHT;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(b.back.canvas, 0, 0, w, h);

    // ---- sky -----------------------------------------------------------------
    if (starSprite) {
      for (const star of b.stars) {
        const a = star.base * (0.55 + 0.45 * Math.sin(wt * star.speed + star.phase));
        if (a < 0.03) continue;
        ctx.globalAlpha = a;
        const s = star.r * 3.2;
        ctx.drawImage(starSprite, star.x - s / 2, star.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    }
    if (moving) {
      if (!meteor && t >= nextMeteorAt) {
        meteor = {
          x: w * (0.25 + simRng() * 0.6),
          y: l.ridgeTops[0] * (0.15 + simRng() * 0.4),
          vx: -(w * 0.35 + simRng() * w * 0.2),
          vy: l.height * 0.12,
          age: 0,
          life: 0.9,
        };
        nextMeteorAt = t + 18 + simRng() * 26;
      }
      if (meteor) {
        meteor.age += dt;
        const k = meteor.age / meteor.life;
        if (k >= 1) meteor = null;
        else {
          const hx = meteor.x + meteor.vx * meteor.age;
          const hy = meteor.y + meteor.vy * meteor.age;
          const tail = 0.12;
          const tx = hx - meteor.vx * tail;
          const ty = hy - meteor.vy * tail;
          const trail = ctx.createLinearGradient(hx, hy, tx, ty);
          const a = Math.sin(k * Math.PI) * 0.8;
          trail.addColorStop(0, rgba(MOONLIGHT, a));
          trail.addColorStop(1, rgba(MOONLIGHT, 0));
          ctx.strokeStyle = trail;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
      }
    }

    // ---- moon ----------------------------------------------------------------
    const breath = 0.88 + 0.12 * Math.sin(wt * 0.35);
    const haloSize = b.moonHalo.width / frame.dpr;
    ctx.globalAlpha = breath;
    ctx.drawImage(b.moonHalo, l.moon.x - haloSize / 2, l.moon.y - haloSize / 2, haloSize, haloSize);
    ctx.globalAlpha = 1;
    const discSize = b.moonDisc.width / frame.dpr;
    ctx.drawImage(b.moonDisc, l.moon.x - discSize / 2, l.moon.y - discSize / 2, discSize, discSize);

    // ---- the moon's road and the valley -------------------------------------------
    ctx.globalCompositeOperation = "lighter";
    for (const glint of b.glints) {
      const a = Math.max(0, Math.sin(wt * glint.speed + glint.phase)) ** 3 * 0.55;
      if (a < 0.02) continue;
      ctx.fillStyle = rgba(MOONLIGHT, a);
      ctx.fillRect(glint.x - glint.len / 2, glint.y, glint.len, 1);
    }
    if (glowDot) {
      for (const light of b.valleyLights) {
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(wt * 0.7 + light.phase);
        const s = light.r * 6;
        ctx.drawImage(glowDot, light.x - s / 2, light.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "source-over";

    // Far mist drifting along the valley.
    const farH = b.mistFar.height / frame.dpr;
    const farY = l.horizonY - farH * 0.55;
    const farShift = ((wt * 6) % w + w) % w;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(b.mistFar, -farShift, farY, w, farH);
    ctx.drawImage(b.mistFar, w - farShift, farY, w, farH);
    ctx.globalAlpha = 1;

    // ---- track, the mist pooled on it, and the last train in front of the mist ---------
    ctx.drawImage(b.track.canvas, 0, 0, w, h);
    const nearH = b.mistNear.height / frame.dpr;
    const nearY = l.platformY - nearH * 0.62;
    const nearShift = ((-wt * 10) % w + w) % w;
    ctx.globalAlpha = 0.7;
    ctx.drawImage(b.mistNear, -nearShift, nearY, w, nearH);
    ctx.drawImage(b.mistNear, w - nearShift, nearY, w, nearH);
    ctx.globalAlpha = 1;
    let trainU = -1;
    if (moving) {
      const since = t - passStart;
      if (since >= PASS_SECONDS) passStart = t + nextPassDelay(simRng());
      else if (since >= 0) trainU = since / PASS_SECONDS;
    }
    const trainHeight = b.train.height / frame.dpr;
    // The sprite has padding above and below the body; this puts the wheels on the rail.
    const trainTop = l.railY - l.carHeight * 1.02 - (trainHeight - l.carHeight) / 2;
    let trainX = 0;
    if (trainU >= 0) {
      trainX = trainNoseX(trainU, w, b.trainLength);
      // The headlight's beam runs ahead along the rails.
      const hx = trainX + b.headlight.x;
      const hy = trainTop + b.headlight.y;
      const beam = ctx.createLinearGradient(hx, hy, hx - w * 0.45, hy);
      beam.addColorStop(0, rgba(LAMP, 0.42));
      beam.addColorStop(1, rgba(LAMP, 0));
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(hx, hy - 2);
      ctx.lineTo(hx - w * 0.45, hy - l.carHeight * 0.55);
      ctx.lineTo(hx - w * 0.45, hy + l.carHeight * 0.35);
      ctx.lineTo(hx, hy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.drawImage(b.train, trainX, trainTop, b.trainLength, trainHeight);
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(b.trainGlow, trainX, trainTop, b.trainLength, trainHeight);
      if (glowDot) {
        const s = l.carHeight * 1.4;
        ctx.drawImage(glowDot, hx - s / 2, hy - s / 2, s, s);
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // A thinner wisp of the same mist curls round the wheels.
    if (trainU >= 0) {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(b.mistNear, -nearShift, nearY + nearH * 0.2, w, nearH);
      ctx.drawImage(b.mistNear, w - nearShift, nearY + nearH * 0.2, w, nearH);
      ctx.globalAlpha = 1;
    }

    // ---- platform -----------------------------------------------------------------------
    ctx.drawImage(b.fore.canvas, 0, 0, w, h);
    if (trainU >= 0) {
      // The building stands in the way of the light on its side of the platform.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, l.platformY, l.buildingX, b.trainSpill.height / frame.dpr);
      ctx.clip();
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(b.trainSpill, trainX, l.platformY, b.trainLength, b.trainSpill.height / frame.dpr);
      ctx.restore();
    }

    // The lamp: a steady hum, a stutter when time stops.
    let lampLevel = 0.92 + 0.05 * Math.sin(wt * 2.3) + 0.03 * Math.sin(wt * 7.1);
    if (freezeStart >= 0) {
      const since = t - freezeStart;
      if (since < 0.5) lampLevel *= since % 0.16 < 0.08 ? 0.35 : 1;
    }
    const pool = b.lampPool.width / frame.dpr;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = lampLevel;
    ctx.save();
    ctx.translate(b.lampBulb.x, l.groundY);
    ctx.scale(1, 0.32);
    ctx.drawImage(b.lampPool, -pool / 2, -pool / 2, pool, pool);
    ctx.restore();
    const glow = b.lampGlow.width / frame.dpr;
    ctx.drawImage(b.lampGlow, b.lampBulb.x - glow / 2, b.lampBulb.y - glow / 2, glow, glow);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(255, 240, 210, ${(0.6 + lampLevel * 0.4).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(b.lampBulb.x, b.lampBulb.y - l.carHeight * 0.03, Math.max(1.5, l.carHeight * 0.05), 0, TAU);
    ctx.fill();

    // Moths around the lamp.
    ctx.fillStyle = "rgba(246, 236, 220, 0.75)";
    for (let i = 0; i < MOTHS; i++) {
      const a = wt * (1.3 + i * 0.37) + i * 1.7;
      const rx = l.carHeight * (0.45 + i * 0.12);
      const ry = l.carHeight * (0.25 + i * 0.05);
      const mx = b.lampBulb.x + Math.cos(a) * rx + Math.sin(a * 2.3) * 4;
      const my = b.lampBulb.y + l.carHeight * 0.15 + Math.sin(a * 1.1) * ry;
      const flap = 0.6 + 0.4 * Math.abs(Math.sin(wt * 22 + i));
      ctx.beginPath();
      ctx.ellipse(mx, my, 1.8 * flap + 0.4, 1, 0, 0, TAU);
      ctx.fill();
    }

    // ---- petals ------------------------------------------------------------------------------
    const pointer = frame.pointer;
    let frozenNear = 0;
    for (const petal of petals) {
      let k = globalFreeze;
      if (pointer.active) {
        const local = pointerFreeze(Math.hypot(petal.x - pointer.x, petal.y - pointer.y));
        if (local < 0.6) frozenNear++;
        k *= local;
      }
      if (moving) {
        const step = dt * k;
        const breeze = Math.sin(wt * 0.4 + petal.y * 0.004) * 10 * petal.depth;
        // The train pulls a wake of air behind it.
        let wake = 0;
        if (trainU >= 0 && petal.y > l.railY - l.carHeight * 2.4 && petal.y < l.platformY + l.carHeight) {
          const behind = petal.x - trainX;
          if (behind > -40 && behind < b.trainLength + w * 0.3) wake = -120 * petal.depth * (1 - clamp(behind / (b.trainLength + w * 0.3), 0, 1));
        }
        petal.vx += (wake * 2 - (petal.vx + 12 * petal.depth)) * Math.min(1, dt * 0.8) * (wake ? 1 : 0.3);
        petal.x += (petal.vx + breeze) * step;
        petal.y += petal.vy * step;
        petal.rot += petal.spin * step;
        petal.tumble += petal.tumbleSpeed * step;
        if (petal.y > h + 24 || petal.x < -40 || petal.x > w + 60) spawnPetal(petal, l, simRng, false);
      }
      const sprite = petalSprites[petal.variant];
      if (!sprite) continue;
      const s = petal.size;
      ctx.globalAlpha = petal.alpha;
      ctx.save();
      ctx.translate(petal.x, petal.y);
      ctx.rotate(petal.rot);
      ctx.scale(Math.max(0.12, Math.abs(Math.cos(petal.tumble))), 1);
      ctx.drawImage(sprite, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Where the pointer holds time still, a faint ring of moonlight.
    if (pointer.active && frozenNear > 0 && moving) {
      ctx.strokeStyle = rgba(MOONLIGHT, Math.min(0.16, frozenNear * 0.04));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, POINTER_FREEZE_RADIUS * 0.8, 0, TAU);
      ctx.stroke();
    }

    // Taps: a ring of moonlight that scatters the petals it passes.
    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i];
      ring.age += dt;
      const k = ring.age / TAP_RING_S;
      if (k >= 1) {
        rings.splice(i, 1);
        continue;
      }
      const radius = TAP_PUSH_RADIUS * (0.15 + 0.85 * Math.sqrt(k));
      ctx.strokeStyle = rgba(MOONLIGHT, (1 - k) * 0.35);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, TAU);
      ctx.stroke();
    }

    // ---- veils ----------------------------------------------------------------------------------
    ctx.drawImage(b.veil.canvas, 0, 0, w, h);
    const scroll = typeof window !== "undefined" ? window.scrollY : 0;
    lastScroll = scroll;
    const veilAlpha = scrollVeil(scroll, h);
    if (veilAlpha > 0.002) {
      ctx.fillStyle = `rgba(6, 5, 14, ${veilAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
  };

  const onPointer = (pointer: Readonly<PointerState>, event: PointerEvent) => {
    if (!pointer.justTapped || !baked || event.type !== "pointerup") return;
    // A tap on a link or a control is the reader's, not the sky's.
    const target = event.target as Element | null;
    if (target?.closest?.("a, button, input, select, textarea, label, [role='button']")) return;
    rings.push({ x: pointer.x, y: pointer.y, age: 0 });
    for (const petal of petals) {
      const dx = petal.x - pointer.x;
      const dy = petal.y - pointer.y;
      const d = Math.hypot(dx, dy);
      if (d > TAP_PUSH_RADIUS || d === 0) continue;
      const push = (1 - d / TAP_PUSH_RADIUS) * 160;
      petal.vx += (dx / d) * push;
      petal.y += (dy / d) * 4;
      petal.spin += (simRng() - 0.5) * 4;
    }
  };

  const scene = createScene({
    canvas,
    container: mount,
    dprCap: DPR_CAP,
    render(ctx, frame) {
      if (still) return;
      drawFrame(ctx, frame, true);
    },
    resize(size, ctx) {
      bake(size);
      if (still || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        drawFrame(ctx, { t: 0, dt: 0, width: size.width, height: size.height, dpr: size.dpr, pointer: STILL_POINTER }, false);
      }
    },
    onPointer,
    reducedMotionFrame(ctx, frame) {
      drawFrame(ctx, frame, false);
    },
  });

  // The sign's lettering needs the site's Japanese face, whose kana subset only
  // loads when asked for (canvas text never asks); repaint once it is in.
  if (document.fonts && typeof document.fonts.load === "function") {
    void document.fonts.load('600 40px "Noto Serif JP"', "つきのみ←→").catch(() => []).then(() => {
      if (bakedFonts || !baked || destroyed) return;
      bakedFonts = true;
      const ctx = canvas.getContext("2d");
      const l = baked.layout;
      bake({ width: l.width, height: l.height, dpr: canvas.width / l.width });
      if (ctx && (still || window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
        drawFrame(ctx, { t: 0, dt: 0, width: l.width, height: l.height, dpr: canvas.width / l.width, pointer: STILL_POINTER }, false);
      }
    });
  }

  // The still has to follow the page as it scrolls under the concourse (its veil).
  const onScroll = () => {
    if (!still || !baked) return;
    if (Math.abs(window.scrollY - lastScroll) < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const l = baked.layout;
    drawFrame(ctx, { t: 0, dt: 0, width: l.width, height: l.height, dpr: canvas.width / l.width, pointer: STILL_POINTER }, false);
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  // A still was already drawn by the first resize; only the moving scene needs the loop.
  if (!still) scene.start();

  return {
    setStill(next: boolean) {
      if (destroyed || next === still) return;
      still = next;
      if (still) {
        scene.stop();
        lastScroll = -1;
        onScroll();
      } else {
        scene.start();
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      scene.destroy();
      window.removeEventListener("scroll", onScroll);
      canvas.remove();
      baked = null;
      petals = [];
    },
  };
}

const STILL_POINTER: PointerState = {
  x: 0,
  y: 0,
  nx: 0.5,
  ny: 0.5,
  active: false,
  down: false,
  justTapped: false,
  type: "mouse",
};
