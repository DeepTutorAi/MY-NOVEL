// "Lightfall" hub scene: three twisting ribbons of gold light fall from one point above
// the page, part around the cards and reflect on dark ground, under a slow net of stars.
//
// The sky is pre-rendered on resize from a fixed seed. Each frame the ribbons are redrawn
// as soft lobes on a canvas a third of the screen's size, enlarged additively (with a much
// smaller copy for bloom), and fine silk threads are drawn on top at full resolution.
// Pure layout and motion maths live in lightfall-core.

import { createNoise2D, createRng, createScene, fbm2D } from "../_shared/scene-runtime";
import type { SceneFrame, SceneHandle, SceneSize } from "../_shared/scene-runtime";
import { TAU, buildWindLut, clamp, isBehindCards, lerp, measureCardCover, rectDistance, smoothstep } from "./grimoire-core";
import type { AvoidRect, CardCover, WindLut } from "./grimoire-core";
import {
  FOLD_OFFSET,
  RIBBON_SAMPLES,
  THREAD_LAG,
  computeLayout,
  createPairGrid,
  createRipplePool,
  forEachPairWithin,
  nextShootingStarDelay,
  ribbonWidthAt,
  rippleAt,
  sampleSprings,
  spawnRipple,
  springBend,
  stepRipples,
  threadCount,
  twistAngle,
  twistAt,
} from "./lightfall-core";
import type { LightfallLayout, PairGrid, RibbonSpec, Spring, TwistState } from "./lightfall-core";
import { flareSprite, mistTile, paintDither, radialSprite, release, surface } from "./scene-paint";

const SEED = 0x6c6661;
const DPR_CAP = 1.5;
const LOW_SCALE = 3;
const BLOOM_SCALE = 2;
const NODE_CAP = 110;
const DUST_CAP = 300;
const SPRINGS_PER_RIBBON = 7;
const TOUCH_LINGER_S = 2.2;
const MOUSE_IDLE_S = 6;
const STILL_T = 14;
const RING_LIFE_S = 1.5;
const LINK_BUCKETS = 3;

export interface LightfallOptions {
  /** Page text the light stays out of. */
  avoid?: string;
  /** Of `avoid`: elements whose box is much wider than their text; only the text is avoided. */
  avoidTextOnly?: string;
  /** Cards the scene is composed around. */
  avoidSoft?: string;
  /** Elements that take the pointer away from the scene. */
  pointerBlock?: string;
}

/* ---------------- sky ---------------- */

function renderNebula(L: LightfallLayout, noise: (x: number, y: number) => number, noise2: (x: number, y: number) => number): HTMLCanvasElement {
  const { width: W, height: H, horizon } = L;
  const scale = 6;
  const w = Math.ceil(W / scale);
  const h = Math.ceil(H / scale);
  const { canvas, g } = surface(w, h);
  const image = g.createImageData(w, h);
  const data = image.data;
  for (let y = 0; y < h; y++) {
    const py = y * scale;
    const fade = 1 - smoothstep(horizon * 0.55, horizon, py);
    for (let x = 0; x < w; x++) {
      const px = x * scale;
      const cloud = clamp(fbm2D(noise, px * 0.0021, py * 0.0024, 5) * 0.95 + 0.26, 0, 1);
      const t = clamp(fbm2D(noise2, px * 0.0037 + 4, py * 0.0037, 4) * 0.9 + 0.5, 0, 1);
      const a = cloud * cloud * fade;
      const i = (y * w + x) * 4;
      // Opaque colour scaled by coverage, added to the sky with "lighter", as in the book scene.
      data[i] = lerp(112, 150, t) * a * 0.36;
      data[i + 1] = lerp(26, 96, t) * a * 0.36;
      data[i + 2] = lerp(44, 40, t) * a * 0.36;
      data[i + 3] = 255;
    }
  }
  g.putImageData(image, 0, 0);
  return canvas;
}

function paintRidge(g: CanvasRenderingContext2D, W: number, base: number, H: number, amp: number, noise: (x: number, y: number) => number, seed: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, H);
  g.lineTo(0, base);
  for (let x = 0; x <= W + 8; x += 8) {
    const n = fbm2D(noise, x * 0.0041 + seed, seed * 0.27, 4);
    g.lineTo(x, base - Math.abs(n) * amp);
  }
  g.lineTo(W, H);
  g.closePath();
  g.fill();
}

function paintBack(L: LightfallLayout, dpr: number, nebula: HTMLCanvasElement, noise: (x: number, y: number) => number, star: HTMLCanvasElement, flare: HTMLCanvasElement): HTMLCanvasElement {
  const { width: W, height: H, horizon } = L;
  const rng = createRng(SEED ^ 0x1234);
  const { canvas, g } = surface(W * dpr, H * dpr);
  g.scale(dpr, dpr);

  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#02030a");
  sky.addColorStop(0.32, "#060914");
  sky.addColorStop(0.58, "#0d1020");
  sky.addColorStop(0.78, "#1a1a29");
  sky.addColorStop(0.93, "#322e37");
  sky.addColorStop(1, "#4b3f3d");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, horizon + 1);

  g.globalCompositeOperation = "lighter";
  g.imageSmoothingQuality = "high";
  g.drawImage(nebula, 0, 0, W, H);

  const low = (y: number) => 1 - smoothstep(horizon * 0.5, horizon * 0.92, y);
  g.globalCompositeOperation = "source-over";
  const faint = Math.round(clamp((W * H) / 820, 240, 2600));
  for (let i = 0; i < faint; i++) {
    const x = rng() * W;
    const y = rng() * horizon;
    const a = low(y) * (0.16 + rng() * 0.66);
    if (a <= 0.01) continue;
    const hue = rng();
    g.fillStyle = hue < 0.24 ? `rgba(255,224,178,${a})` : hue < 0.4 ? `rgba(198,210,255,${a})` : `rgba(255,252,244,${a})`;
    const s = rng() < 0.07 ? 1.6 : 0.8 + rng() * 0.5;
    g.fillRect(x, y, s, s);
  }
  g.globalCompositeOperation = "lighter";
  const soft = Math.round(clamp((W * H) / 13000, 36, 170));
  for (let i = 0; i < soft; i++) {
    const x = rng() * W;
    const y = rng() * horizon * 0.86;
    const s = 4 + rng() * 7;
    g.globalAlpha = low(y) * (0.3 + rng() * 0.6);
    g.drawImage(star, x - s / 2, y - s / 2, s, s);
  }
  const bright = Math.round(clamp((W * H) / 120000, 6, 18));
  for (let i = 0; i < bright; i++) {
    const x = rng() * W;
    const y = rng() * horizon * 0.72;
    const s = 16 + rng() * 22;
    g.globalAlpha = low(y) * (0.5 + rng() * 0.5);
    g.drawImage(flare, x - s / 2, y - s / 2, s, s);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";

  paintRidge(g, W, horizon + 1, H, H * 0.05, noise, 2.6, "rgba(40,34,44,0.75)");
  paintRidge(g, W, horizon + 1, H, H * 0.026, noise, 7.1, "rgba(16,13,20,0.96)");

  const ground = g.createLinearGradient(0, horizon, 0, H);
  ground.addColorStop(0, "#0e0b11");
  ground.addColorStop(0.5, "#07060b");
  ground.addColorStop(1, "#030307");
  g.fillStyle = ground;
  g.fillRect(0, horizon, W, H - horizon);
  g.fillStyle = "rgba(255,206,142,0.18)";
  g.fillRect(0, horizon, W, 1);

  paintDither(g, W, H, rng);
  return canvas;
}

/* ---------------- ribbon state ---------------- */

interface RibbonState {
  spec: RibbonSpec;
  lut: WindLut;
  x: Float32Array;
  y: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  theta: Float32Array;
  width: Float32Array;
  thick: Float32Array;
  fold: Float32Array;
  /** This sample currently sits on the page's text (depends on the scroll position). */
  hide: Uint8Array;
  bend: Spring[];
  threads: number;
  threadStyle: CanvasGradient[];
}

interface Twinkle {
  x: number;
  y: number;
  size: number;
  rate: number;
  phase: number;
  base: number;
}

interface Built {
  layout: LightfallLayout;
  ribbons: RibbonState[];
  back: HTMLCanvasElement;
  low: HTMLCanvasElement;
  lowG: CanvasRenderingContext2D;
  bloom: HTMLCanvasElement;
  bloomG: CanvasRenderingContext2D;
  reflection: HTMLCanvasElement;
  reflectionG: CanvasRenderingContext2D;
  /** Stops the ribbons' glow just above the horizon; built once for the small canvas. */
  horizonFade: CanvasGradient;
  cover: CardCover | null;
  twinkles: Twinkle[];
  grid: PairGrid;
}

/** A shooting star keeps the rhythm and look of the original constellation background. */
interface ShootingStar {
  active: boolean;
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  age: number;
  life: number;
}

interface Ring {
  active: boolean;
  x: number;
  y: number;
  age: number;
  radius: number;
  ground: boolean;
}

function textBounds(el: Element): { x: number; y: number; w: number; h: number } | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim()) continue;
    range.selectNodeContents(n);
    const box = range.getBoundingClientRect();
    if (box.width < 1) continue;
    l = Math.min(l, box.left);
    t = Math.min(t, box.top);
    r = Math.max(r, box.right);
    b = Math.max(b, box.bottom);
  }
  return l < r ? { x: l, y: t, w: r - l, h: b - t } : null;
}

export function createLightfallScene(canvas: HTMLCanvasElement, container: HTMLElement, options: LightfallOptions = {}): SceneHandle {
  const noise = createNoise2D(SEED);
  const noise2 = createNoise2D(SEED ^ 0x2b2b);
  const flow = createNoise2D(SEED ^ 0x77);
  const rng = createRng(SEED ^ 0x3c3c);
  const range = (lo: number, hi: number) => lo + rng() * (hi - lo);

  const star = radialSprite(32, [
    [0, "rgba(255,255,255,1)"],
    [0.14, "rgba(255,244,226,0.8)"],
    [0.38, "rgba(240,210,170,0.16)"],
    [1, "rgba(220,190,150,0)"],
  ]);
  const flare = flareSprite(64, "rgba(255,246,224,0.95)", "rgba(255,236,204,0.85)");
  const gold = radialSprite(24, [[0, "rgba(255,232,170,1)"], [0.28, "rgba(255,200,110,0.7)"], [1, "rgba(240,160,70,0)"]]);
  const pale = radialSprite(24, [[0, "rgba(255,252,240,1)"], [0.28, "rgba(255,240,210,0.6)"], [1, "rgba(240,220,200,0)"]]);
  const glint = radialSprite(96, [
    [0, "rgba(255,246,220,0.95)"],
    [0.16, "rgba(255,214,140,0.5)"],
    [0.5, "rgba(240,150,70,0.1)"],
    [1, "rgba(220,110,50,0)"],
  ]);
  const pool = radialSprite(256, [
    [0, "rgba(255,232,180,0.7)"],
    [0.22, "rgba(255,186,110,0.28)"],
    [0.6, "rgba(220,110,60,0.07)"],
    [1, "rgba(200,90,50,0)"],
  ]);
  const ringSprite = radialSprite(128, [
    [0, "rgba(255,226,170,0)"],
    [0.74, "rgba(255,226,170,0)"],
    [0.86, "rgba(255,226,170,0.42)"],
    [1, "rgba(255,226,170,0)"],
  ]);
  const mistA = mistTile(noise2, 196, 172, 160, 64);
  const mistB = mistTile(noise, 208, 164, 132, 50);

  let built: Built | null = null;
  let nebula: HTMLCanvasElement | null = null;
  let nebulaKey = "";
  let scale = 1;
  let scrollTop = 0;
  let hideScroll = Number.NaN;
  let pointerBlocked = false;
  let lastSize: SceneSize | null = null;

  /* ---------------- page text and cards ---------------- */

  const measureAvoid = (): AvoidRect[] => {
    const out: AvoidRect[] = [];
    const sy = window.scrollY;
    const add = (selector: string | undefined, soft: boolean) => {
      if (!selector) return;
      for (const el of document.querySelectorAll(selector)) {
        const tight = options.avoidTextOnly && el.matches(options.avoidTextOnly) ? textBounds(el) : null;
        if (tight) {
          out.push({ x: tight.x, y: tight.y + sy, w: tight.w, h: tight.h, soft });
          continue;
        }
        const b = el.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) continue;
        out.push({ x: b.left, y: b.top + sy, w: b.width, h: b.height, soft });
      }
    };
    add(options.avoid, false);
    add(options.avoidSoft, true);
    return out;
  };
  let avoidDoc = measureAvoid();

  /* ---------------- pools ---------------- */

  const nodes = {
    x: new Float32Array(NODE_CAP),
    y: new Float32Array(NODE_CAP),
    vx: new Float32Array(NODE_CAP),
    vy: new Float32Array(NODE_CAP),
    size: new Float32Array(NODE_CAP),
    alpha: new Float32Array(NODE_CAP),
    phase: new Float32Array(NODE_CAP),
    flash: new Float32Array(NODE_CAP),
    count: 0,
  };
  const linkA = [new Int16Array(4096), new Int16Array(4096), new Int16Array(4096)];
  const linkB = [new Int16Array(4096), new Int16Array(4096), new Int16Array(4096)];
  const linkCount = new Int32Array(LINK_BUCKETS);
  let linkR2 = 1;
  const collectLink = (i: number, j: number, d2: number) => {
    const b = Math.min(LINK_BUCKETS - 1, Math.floor((d2 / linkR2) * LINK_BUCKETS));
    const n = linkCount[b];
    if (n >= 4096) return;
    linkA[b][n] = i;
    linkB[b][n] = j;
    linkCount[b] = n + 1;
  };

  const dust = {
    s: new Float32Array(DUST_CAP),
    ribbon: new Uint8Array(DUST_CAP),
    angle: new Float32Array(DUST_CAP),
    spin: new Float32Array(DUST_CAP),
    orbit: new Float32Array(DUST_CAP),
    speed: new Float32Array(DUST_CAP),
    age: new Float32Array(DUST_CAP),
    life: new Float32Array(DUST_CAP),
    size: new Float32Array(DUST_CAP),
    phase: new Float32Array(DUST_CAP),
  };

  const ripples = createRipplePool(6);
  const rings: Ring[] = [];
  for (let i = 0; i < 5; i++) rings.push({ active: false, x: 0, y: 0, age: 0, radius: 1, ground: false });
  const shootingStars: ShootingStar[] = [];
  for (let i = 0; i < 2; i++) shootingStars.push({ active: false, x: 0, y: 0, length: 0, speed: 0, angle: 0, age: 0, life: 1 });
  const pulse = { active: false, ribbon: 0, s: 0, speed: 0.3 };
  const twist: TwistState = { thickness: 1, fold: 0 };
  const lantern = { x: 0, y: 0, intensity: 0, lastX: -1, lastY: -1, movedAt: -10, lingerUntil: -1 };

  let simTime = 0;
  let nextShootingStarAt = nextShootingStarDelay(rng);
  let nextPulseAt = 4;
  let reflectKick = 0;

  /* ---------------- seeding ---------------- */

  const seedNodes = (L: LightfallLayout) => {
    nodes.count = L.maxNodes;
    for (let i = 0; i < L.maxNodes; i++) {
      nodes.x[i] = rng() * L.width;
      nodes.y[i] = rng() * L.horizon;
      nodes.vx[i] = (rng() - 0.5) * 20;
      nodes.vy[i] = (rng() - 0.5) * 20;
      nodes.size[i] = 2.6 + rng() * 4.6;
      nodes.alpha[i] = 0.22 + rng() * 0.46;
      nodes.phase[i] = rng() * TAU;
    }
  };

  const respawnDust = (i: number, anywhere: boolean) => {
    const L = built?.layout;
    const count = built ? built.ribbons.length : 3;
    // The side ribbons carry more dust: more of them can be seen.
    dust.ribbon[i] = rng() < 0.86 ? Math.floor(rng() * 2) : Math.min(2, count - 1);
    dust.s[i] = anywhere ? rng() : range(0.82, 1);
    dust.angle[i] = rng() * TAU;
    dust.spin[i] = range(0.5, 1.5) * (rng() < 0.5 ? -1 : 1);
    dust.orbit[i] = Math.pow(rng(), 1.6) * (L?.compact ? 22 : 56) + 2;
    dust.speed[i] = range(14, 46);
    dust.life[i] = range(5, 14);
    dust.age[i] = anywhere ? dust.life[i] * rng() * 0.8 : 0;
    dust.size[i] = rng() < 0.08 ? range(6, 10) : range(1.6, 4.6);
    dust.phase[i] = rng() * TAU;
  };

  /* ---------------- ribbon motion ---------------- */

  const updateRibbon = (r: RibbonState, index: number, t: number) => {
    const { spec, lut } = r;
    const last = RIBBON_SAMPLES - 1;
    const phase = spec.phase;
    for (let i = 0; i <= last; i++) {
      const s = i / last;
      const open = spec.openAt > 0 ? smoothstep(spec.openAt * 0.7, spec.openAt * 1.15, s) : smoothstep(0, 0.3, s);
      const taper = open * (1 - smoothstep(0.92, 1, s) * 0.6);
      const sway =
        spec.sway *
        taper *
        (Math.sin(s * 6.2 + t * 0.42 + phase) * 0.55 + Math.sin(s * 13 - t * 0.31 + phase * 2) * 0.25 + flow(s * 3.4 + phase, t * 0.13) * 0.6);
      const wave = rippleAt(ripples, index, s);
      const lateral = sway + sampleSprings(r.bend, s) + wave * Math.max(14, spec.width * 0.6) * Math.sin(s * 40 - t * 7);
      const nx = -lut.ty[i];
      const ny = lut.tx[i];
      r.nx[i] = nx;
      r.ny[i] = ny;
      r.x[i] = lut.x[i] + nx * lateral;
      r.y[i] = lut.y[i] + ny * lateral;
      const theta = twistAngle(spec, s, t, flow(s * 2.2 + phase * 3, t * 0.05));
      twistAt(theta, twist);
      const width = ribbonWidthAt(spec, s) * (1 + flow(s * 2.7 - phase, t * 0.07) * 0.3);
      r.theta[i] = theta;
      r.width[i] = width;
      r.thick[i] = width * twist.thickness;
      r.fold[i] = twist.fold;
    }
  };

  const updateHide = (B: Built) => {
    const hard = avoidDoc.filter((a) => !a.soft);
    for (const r of B.ribbons) {
      for (let i = 0; i < RIBBON_SAMPLES; i++) {
        let hide = 0;
        const x = r.lut.x[i];
        const y = r.lut.y[i];
        for (const a of hard) {
          if (rectDistance(x, y, { x: a.x, y: a.y - scrollTop, w: a.w, h: a.h }) < 12) {
            hide = 1;
            break;
          }
        }
        r.hide[i] = hide;
      }
    }
    hideScroll = scrollTop;
  };

  /* ---------------- simulation ---------------- */

  const addRing = (x: number, y: number, radius: number, ground: boolean) => {
    const ring = rings.find((c) => !c.active);
    if (!ring) return;
    ring.active = true;
    ring.x = x;
    ring.y = y;
    ring.age = 0;
    ring.radius = radius;
    ring.ground = ground;
  };

  const tapAt = (B: Built, x: number, y: number) => {
    // Waves start on the closest point of each ribbon, strongest on the nearest.
    let closest = Infinity;
    const best = B.ribbons.map((r) => {
      let dist = Infinity;
      let at = 0;
      for (let i = 0; i < RIBBON_SAMPLES; i++) {
        const d = Math.hypot(r.x[i] - x, r.y[i] - y);
        if (d < dist) {
          dist = d;
          at = i;
        }
      }
      closest = Math.min(closest, dist);
      return { dist, at };
    });
    best.forEach(({ dist, at }, index) => {
      const strength = dist === closest ? 1 : 0.4;
      spawnRipple(ripples, index, at / (RIBBON_SAMPLES - 1), strength);
    });
    addRing(x, y, 150, false);
    for (let i = 0; i < nodes.count; i++) {
      const d = Math.hypot(nodes.x[i] - x, nodes.y[i] - y);
      if (d < 220) nodes.flash[i] = 1 - d / 220;
    }
    reflectKick = 1;
    const L = B.layout;
    if (y > L.horizon) addRing(x, y, 170, true);
    else addRing(x, L.horizon + (L.height - L.horizon) * 0.4, 130, true);
  };

  const step = (frame: Readonly<SceneFrame>) => {
    if (!built) return;
    const B = built;
    const L = B.layout;
    const dt = frame.dt;
    const t = (simTime += dt);
    scrollTop = window.scrollY;
    if (Math.abs(scrollTop - hideScroll) > 2) updateHide(B);

    // The pointer, with a touch lingering a moment after the finger lifts.
    const pointer = frame.pointer;
    const free = !pointerBlocked;
    const mouse = pointer.type === "mouse";
    if (pointer.active && free && (pointer.x !== lantern.lastX || pointer.y !== lantern.lastY)) {
      lantern.lastX = pointer.x;
      lantern.lastY = pointer.y;
      lantern.movedAt = t;
    }
    if (!mouse && pointer.active && free) lantern.lingerUntil = t + TOUCH_LINGER_S;
    const idle = mouse && t - lantern.movedAt > MOUSE_IDLE_S;
    const target = (pointer.active && free && !idle) || (!mouse && t < lantern.lingerUntil) ? 1 : 0;
    if (lantern.intensity < 0.02 && target > 0) {
      lantern.x = pointer.x;
      lantern.y = pointer.y;
    }
    if (free) {
      const follow = Math.min(1, dt * 9);
      lantern.x += (pointer.x - lantern.x) * follow;
      lantern.y += (pointer.y - lantern.y) * follow;
    }
    const rate = target > lantern.intensity ? 2.6 : 1.6;
    lantern.intensity += clamp(target - lantern.intensity, -rate * dt, rate * dt);

    if (pointer.justTapped && free) tapAt(B, pointer.x, pointer.y);
    reflectKick = Math.max(0, reflectKick - dt * 0.8);
    stepRipples(ripples, dt);

    // Ribbons lean towards the pointer through springs, then settle back.
    const reach = L.compact ? 180 : 280;
    for (const r of B.ribbons) {
      const lut = r.lut;
      for (let k = 0; k < r.bend.length; k++) {
        const i = Math.round((k / (r.bend.length - 1)) * (RIBBON_SAMPLES - 1));
        const dx = lantern.x - lut.x[i];
        const dy = lantern.y - lut.y[i];
        const d = Math.hypot(dx, dy);
        const falloff = lantern.intensity * Math.max(0, 1 - d / reach);
        const along = dx * -lut.ty[i] + dy * lut.tx[i];
        springBend(r.bend[k], k === 0 ? 0 : clamp(along * falloff * 0.5, -70, 70), dt);
      }
    }
    B.ribbons.forEach((r, i) => updateRibbon(r, i, t));

    // A pulse of light runs down one ribbon every so often and spreads on the ground.
    if (!pulse.active && t >= nextPulseAt) {
      pulse.active = true;
      pulse.ribbon = Math.floor(rng() * B.ribbons.length);
      pulse.s = 0;
      pulse.speed = range(0.24, 0.34);
    }
    if (pulse.active) {
      pulse.s += pulse.speed * dt;
      if (pulse.s >= 1) {
        pulse.active = false;
        nextPulseAt = t + range(7, 12);
        const r = B.ribbons[pulse.ribbon];
        addRing(r.x[RIBBON_SAMPLES - 1], L.horizon + (L.height - L.horizon) * 0.3, 150, true);
        reflectKick = Math.max(reflectKick, 0.6);
      }
    }

    // Net of stars: slow drift with wrap-around, pushed away from the pointer.
    const repel = L.repelRadius;
    for (let i = 0; i < nodes.count; i++) {
      nodes.x[i] += nodes.vx[i] * dt;
      nodes.y[i] += nodes.vy[i] * dt;
      if (nodes.x[i] < 0) nodes.x[i] = L.width;
      else if (nodes.x[i] > L.width) nodes.x[i] = 0;
      if (nodes.y[i] < 0) nodes.y[i] = L.horizon;
      else if (nodes.y[i] > L.horizon) nodes.y[i] = 0;
      if (lantern.intensity > 0.01) {
        const dx = nodes.x[i] - lantern.x;
        const dy = nodes.y[i] - lantern.y;
        const d = Math.hypot(dx, dy);
        if (d < repel && d > 0.01) {
          const push = ((repel - d) / repel) * 48 * lantern.intensity * dt;
          nodes.x[i] += (dx / d) * push;
          nodes.y[i] += (dy / d) * push;
        }
      }
      if (nodes.flash[i] > 0) nodes.flash[i] = Math.max(0, nodes.flash[i] - dt * 1.2);
    }

    // Gold dust climbing the ribbons.
    for (let i = 0; i < L.maxDust; i++) {
      dust.age[i] += dt;
      const r = B.ribbons[dust.ribbon[i]];
      dust.s[i] -= (dust.speed[i] * dt) / r.lut.length;
      dust.angle[i] += dust.spin[i] * dt;
      if (dust.age[i] >= dust.life[i] || dust.s[i] <= 0.04) respawnDust(i, false);
    }

    // Shooting stars, every five to nine seconds.
    if (t >= nextShootingStarAt) {
      const s = shootingStars.find((c) => !c.active);
      if (s) {
        s.active = true;
        s.x = range(L.width * 0.2, L.width * 0.9);
        s.y = range(L.height * 0.06, L.height * 0.34);
        s.length = range(70, 130);
        s.speed = range(450, 660);
        s.angle = range(Math.PI * 0.72, Math.PI * 0.82);
        s.age = 0;
        s.life = range(0.7, 1.03);
      }
      nextShootingStarAt = t + nextShootingStarDelay(rng);
    }
    for (const s of shootingStars) {
      if (!s.active) continue;
      s.age += dt;
      s.x += Math.cos(s.angle) * s.speed * dt;
      s.y += Math.sin(s.angle) * s.speed * dt;
      if (s.age >= s.life) s.active = false;
    }

    for (const ring of rings) {
      if (!ring.active) continue;
      ring.age += dt;
      if (ring.age >= RING_LIFE_S) ring.active = false;
    }
  };

  /* ---------------- drawing ---------------- */

  /** Appends one thread to the current path, as a smooth curve through every `stride`-th sample. */
  const traceThread = (g: CanvasRenderingContext2D, r: RibbonState, j: number, t: number, stride: number) => {
    const last = RIBBON_SAMPLES - 1;
    const a = -1 + (2 * (j + 0.5)) / r.threads;
    const lag = a * THREAD_LAG;
    const wander = j * 2.4;
    let pen = false;
    let px = 0;
    let py = 0;
    for (let i = 0; i <= last; i += stride) {
      if (r.hide[i]) {
        if (pen) g.lineTo(px, py);
        pen = false;
        continue;
      }
      const h = r.width[i] * a * Math.cos(r.theta[i] + lag) + Math.sin(i * 0.16 + wander + t * 0.4) * (0.6 + r.width[i] * 0.02);
      const x = r.x[i] + r.nx[i] * h;
      const y = r.y[i] + r.ny[i] * h;
      if (!pen) {
        g.moveTo(x, y);
        pen = true;
      } else {
        g.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
      }
      px = x;
      py = y;
    }
    if (pen) g.lineTo(px, py);
  };

  /** Bright points that belong to the ribbons: the crossings at each fold and a running pulse. */
  const drawLights = (g: CanvasRenderingContext2D, B: Built, strength: number) => {
    for (const r of B.ribbons) {
      for (let i = 1; i < RIBBON_SAMPLES - 1; i++) {
        if (r.hide[i] || r.fold[i] < 0.5 || r.fold[i] < r.fold[i - 1] || r.fold[i] < r.fold[i + 1]) continue;
        const size = Math.max(14, r.width[i] * 1.1);
        const offset = -Math.sin(r.theta[i]) * FOLD_OFFSET * r.width[i];
        g.globalAlpha = 0.55 * strength;
        g.drawImage(glint, r.x[i] + r.nx[i] * offset - size / 2, r.y[i] + r.ny[i] * offset - size / 2, size, size);
      }
    }
    if (pulse.active) {
      const r = B.ribbons[pulse.ribbon];
      const last = RIBBON_SAMPLES - 1;
      for (let n = 0; n < 7; n++) {
        const s = pulse.s - n * 0.012;
        if (s < 0) break;
        const i = Math.min(last, Math.round(s * last));
        if (r.hide[i]) continue;
        const size = Math.max(30, r.width[i] * 1.2) * (1 - n / 9);
        g.globalAlpha = (1 - n / 7) * 0.85 * strength;
        g.drawImage(glint, r.x[i] - size / 2, r.y[i] - size / 2, size, size);
      }
    }
    g.globalAlpha = 1;
  };

  /**
   * The ribbons' soft glow, on the small canvas: every third thread again, drawn thick enough to
   * merge into a sheet. Blurred, it brightens by itself where the threads bunch, and it is what
   * the bloom and the reflection on the ground are made from.
   */
  const drawGlowLayer = (B: Built, t: number) => {
    const g = B.lowG;
    const L = B.layout;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, B.low.width, B.low.height);
    const k = 1 / LOW_SCALE;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.globalCompositeOperation = "lighter";
    B.ribbons.forEach((r, index) => {
      g.globalAlpha = 0.86 + 0.14 * Math.sin(t * 0.7 + index * 2.1);
      g.lineWidth = Math.max(3, (r.spec.width / r.threads) * 7.5);
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass === 0 ? "rgba(255,176,98,0.2)" : "rgba(186,66,58,0.17)";
        g.beginPath();
        for (let j = 0; j < r.threads; j += 3) {
          const centre = Math.abs(-1 + (2 * (j + 0.5)) / r.threads) < 0.5;
          if (centre === (pass === 0)) traceThread(g, r, j, t, 6);
        }
        g.stroke();
      }
    });
    g.globalAlpha = 1;
    drawLights(g, B, 0.7);

    // Nothing of the ribbons below the horizon, and only a trace behind the page's text.
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = B.horizonFade;
    g.fillRect(0, L.horizon - L.height * 0.05, L.width, L.height * 0.05);
    g.fillStyle = "#000";
    g.fillRect(0, L.horizon, L.width, L.height - L.horizon);
    for (const a of avoidDoc) {
      if (a.soft) continue;
      const y = a.y - scrollTop;
      if (y + a.h < -20 || y > L.height + 20) continue;
      g.fillStyle = "rgba(0,0,0,0.5)";
      g.fillRect(a.x - 14, y - 14, a.w + 28, a.h + 28);
      g.fillStyle = "rgba(0,0,0,0.6)";
      g.fillRect(a.x, y, a.w, a.h);
    }
    g.globalCompositeOperation = "source-over";

    const bg = B.bloomG;
    bg.setTransform(1, 0, 0, 1, 0, 0);
    bg.globalCompositeOperation = "copy";
    bg.imageSmoothingEnabled = true;
    bg.drawImage(B.low, 0, 0, B.bloom.width, B.bloom.height);
  };

  /**
   * The silk: many fine lines across the ribbon's width. Each line's twist runs slightly ahead
   * of or behind its neighbour's, so a fold rolls over softly instead of pinching to a point,
   * and the light gathers by itself wherever the lines bunch together.
   */
  const drawThreads = (ctx: CanvasRenderingContext2D, B: Built, t: number) => {
    ctx.lineWidth = 0.75;
    for (const r of B.ribbons) {
      for (let pass = 0; pass < 3; pass++) {
        ctx.strokeStyle = r.threadStyle[pass];
        ctx.beginPath();
        for (let j = pass; j < r.threads; j += 3) traceThread(ctx, r, j, t, 3);
        ctx.stroke();
      }
    }
  };

  const drawShootingStar = (ctx: CanvasRenderingContext2D, s: ShootingStar) => {
    const opacity = Math.sin((s.age / s.life) * Math.PI) * 0.72;
    const tailX = s.x - Math.cos(s.angle) * s.length;
    const tailY = s.y - Math.sin(s.angle) * s.length;
    const gradient = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
    gradient.addColorStop(0, `rgba(238,232,221,${opacity})`);
    gradient.addColorStop(0.38, `rgba(207,154,94,${opacity * 0.72})`);
    gradient.addColorStop(1, "rgba(207,154,94,0)");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
    ctx.globalAlpha = opacity;
    ctx.drawImage(pale, s.x - 6, s.y - 6, 12, 12);
    ctx.globalAlpha = 1;
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    if (!built) return;
    const B = built;
    const L = B.layout;
    const { width: W, height: H, horizon } = L;
    const k = scale;
    const t = simTime;

    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(B.back, 0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    for (const tw of B.twinkles) {
      if (isBehindCards(B.cover, tw.x, tw.y, scrollTop, tw.size)) continue;
      ctx.globalAlpha = clamp(tw.base * (0.55 + 0.45 * Math.sin(t * tw.rate + tw.phase)), 0, 1);
      ctx.drawImage(flare, tw.x - tw.size / 2, tw.y - tw.size / 2, tw.size, tw.size);
    }
    ctx.globalAlpha = 1;

    // Net of stars: pairs come from the grid, stroked in three brightness groups.
    linkCount.fill(0);
    linkR2 = L.linkDistance * L.linkDistance;
    forEachPairWithin(B.grid, nodes.x, nodes.y, nodes.count, L.linkDistance, collectLink);
    ctx.lineWidth = 0.6;
    for (let b = 0; b < LINK_BUCKETS; b++) {
      ctx.strokeStyle = `rgba(207,154,94,${0.2 - b * 0.06})`;
      ctx.beginPath();
      for (let n = 0; n < linkCount[b]; n++) {
        const i = linkA[b][n];
        const j = linkB[b][n];
        ctx.moveTo(nodes.x[i], nodes.y[i]);
        ctx.lineTo(nodes.x[j], nodes.y[j]);
      }
      ctx.stroke();
    }
    for (let i = 0; i < nodes.count; i++) {
      const flash = nodes.flash[i];
      const size = nodes.size[i] * (1 + flash * 2.4);
      if (isBehindCards(B.cover, nodes.x[i], nodes.y[i], scrollTop, size)) continue;
      ctx.globalAlpha = clamp(nodes.alpha[i] * (0.7 + Math.sin(t * 0.9 + nodes.phase[i]) * 0.3) + flash, 0, 1);
      ctx.drawImage(gold, nodes.x[i] - size / 2, nodes.y[i] - size / 2, size, size);
    }
    ctx.globalAlpha = 1;

    for (const s of shootingStars) if (s.active) drawShootingStar(ctx, s);

    /* ---- ribbons ---- */
    drawGlowLayer(B, t);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(B.bloom, 0, 0, W, H);
    drawThreads(ctx, B, t);
    drawLights(ctx, B, 1);

    /* ---- gold dust ---- */
    const last = RIBBON_SAMPLES - 1;
    for (let i = 0; i < L.maxDust; i++) {
      const r = B.ribbons[dust.ribbon[i]];
      const f = clamp(dust.s[i], 0, 1) * last;
      const j = Math.min(last - 1, f | 0);
      const q = f - j;
      const a = dust.angle[i];
      const radius = (r.thick[j] + dust.orbit[i]) * Math.cos(a);
      const x = r.x[j] + (r.x[j + 1] - r.x[j]) * q + r.nx[j] * radius;
      const y = r.y[j] + (r.y[j + 1] - r.y[j]) * q + r.ny[j] * radius + Math.sin(a * 1.3 + dust.phase[i]) * 5;
      if (y > horizon) continue;
      const size = dust.size[i] * (dust.size[i] > 5.5 ? 2.4 : 1);
      if (isBehindCards(B.cover, x, y, scrollTop, size)) continue;
      const age = dust.age[i];
      const life = dust.life[i];
      const env = Math.min(1, age * 1.2) * (1 - smoothstep(life * 0.7, life, age));
      const near = 1 - dust.orbit[i] / 60;
      const depth = 0.42 + 0.58 * (Math.sin(a) * 0.5 + 0.5);
      const twinkle = 0.62 + 0.38 * Math.sin(t * 3.1 + dust.phase[i]);
      ctx.globalAlpha = env * depth * twinkle * (0.3 + near * 0.7) * (r.hide[j] ? 0.25 : 1);
      if (dust.size[i] > 5.5) ctx.drawImage(flare, x - size / 2, y - size / 2, size, size);
      else ctx.drawImage(i % 5 === 0 ? pale : gold, x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;

    /* ---- reflection: the ribbon layer flipped over the horizon, rippling and fading ---- */
    const rg = B.reflectionG;
    const rows = B.reflection.height;
    const lowW = B.low.width;
    const lowHorizon = horizon / LOW_SCALE;
    const amp = (1 + reflectKick * 5) / LOW_SCALE;
    rg.setTransform(1, 0, 0, 1, 0, 0);
    rg.clearRect(0, 0, lowW, rows);
    for (let n = 0; n < rows; n++) {
      const sy = lowHorizon - 2 - n * 0.8;
      if (sy < 0) break;
      const dx = Math.sin(n * 0.5 + t * 1.7) * amp * (1 + n * 0.3) + Math.sin(n * 0.16 - t * 0.8) * 0.5;
      rg.globalAlpha = 0.85 * Math.pow(1 - n / rows, 1.3);
      rg.drawImage(B.low, 0, sy, lowW, 1, dx, n, lowW, 1);
    }
    ctx.drawImage(B.reflection, 0, horizon, W, H - horizon);

    /* ---- light pooling where each ribbon meets the ground, with mist along the horizon ---- */
    B.ribbons.forEach((r, index) => {
      const x = r.x[last];
      const size = Math.max(90, r.spec.width * 5.5) * (1 + Math.sin(t * 0.9 + index * 2) * 0.06);
      ctx.globalAlpha = 0.62;
      ctx.setTransform(k, 0, 0, k * 0.24, x * k, horizon * k);
      ctx.drawImage(pool, -size / 2, -size / 2, size, size);
    });
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const mistW = Math.max(W, 800);
    const mistH = H * 0.13;
    const a1 = (t * 6) % mistW;
    const a2 = (t * 4.2) % mistW;
    ctx.globalAlpha = 0.5;
    ctx.drawImage(mistA, -a1, horizon - mistH * 0.62, mistW, mistH);
    ctx.drawImage(mistA, mistW - a1, horizon - mistH * 0.62, mistW, mistH);
    ctx.globalAlpha = 0.34;
    ctx.drawImage(mistB, a2 - mistW, horizon - mistH * 0.4, mistW, mistH * 0.9);
    ctx.drawImage(mistB, a2, horizon - mistH * 0.4, mistW, mistH * 0.9);
    ctx.globalAlpha = 1;

    /* ---- rings and the pointer's light ---- */
    for (const ring of rings) {
      if (!ring.active) continue;
      const q = ring.age / RING_LIFE_S;
      const size = ring.radius * (0.3 + q * 1.5) * 2;
      ctx.globalAlpha = (1 - q) * 0.72;
      if (ring.ground) {
        ctx.setTransform(k, 0, 0, k * 0.22, ring.x * k, ring.y * k);
        ctx.drawImage(ringSprite, -size / 2, -size / 2, size, size);
        ctx.setTransform(k, 0, 0, k, 0, 0);
      } else {
        ctx.drawImage(ringSprite, ring.x - size / 2, ring.y - size / 2, size, size);
      }
    }
    if (lantern.intensity > 0.01) {
      const s = 200;
      ctx.globalAlpha = lantern.intensity * 0.12;
      ctx.drawImage(pool, lantern.x - s / 2, lantern.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  };

  /* ---------------- layout ---------------- */

  const makeRibbon = (spec: RibbonSpec, ctx: CanvasRenderingContext2D, L: LightfallLayout): RibbonState => {
    const lut = buildWindLut(spec.points, RIBBON_SAMPLES);
    // Quieter across the top of the page, where the title is, and gone at the horizon.
    const band = clamp(L.gutters.top / L.horizon, 0.05, 0.6);
    const fadeStyle = (r: number, g: number, b: number, a: number) => {
      const grad = ctx.createLinearGradient(0, 0, 0, L.horizon);
      grad.addColorStop(0, `rgba(${r},${g},${b},${a * 0.5})`);
      grad.addColorStop(band, `rgba(${r},${g},${b},${a})`);
      grad.addColorStop(0.92, `rgba(${r},${g},${b},${a})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      return grad;
    };
    return {
      spec,
      lut,
      x: new Float32Array(RIBBON_SAMPLES),
      y: new Float32Array(RIBBON_SAMPLES),
      nx: new Float32Array(RIBBON_SAMPLES),
      ny: new Float32Array(RIBBON_SAMPLES),
      theta: new Float32Array(RIBBON_SAMPLES),
      width: new Float32Array(RIBBON_SAMPLES),
      thick: new Float32Array(RIBBON_SAMPLES),
      fold: new Float32Array(RIBBON_SAMPLES),
      hide: new Uint8Array(RIBBON_SAMPLES),
      bend: Array.from({ length: SPRINGS_PER_RIBBON }, () => ({ x: 0, v: 0 })),
      threads: threadCount(spec),
      threadStyle: [fadeStyle(255, 236, 190, 0.4), fadeStyle(255, 186, 104, 0.34), fadeStyle(232, 112, 62, 0.3)],
    };
  };

  const rebuild = (size: Readonly<SceneSize>, ctx: CanvasRenderingContext2D) => {
    const L = computeLayout(size.width, size.height, avoidDoc);
    const dpr = size.dpr;
    const key = `${Math.round(L.width)}x${Math.ceil(L.height / 120) * 120}`;
    if (!nebula || key !== nebulaKey) {
      if (nebula) release(nebula);
      nebula = renderNebula(L, noise, noise2);
      nebulaKey = key;
    }
    const twRng = createRng(SEED ^ 0x7e11);
    const twinkles: Twinkle[] = [];
    const count = Math.round(clamp((L.width * L.height) / 42_000, 10, 34));
    for (let i = 0; i < count; i++) {
      twinkles.push({
        x: twRng() * L.width,
        y: twRng() * L.horizon * 0.8,
        size: 7 + twRng() * 11,
        rate: TAU / (2.2 + twRng() * 5),
        phase: twRng() * TAU,
        base: 0.26 + twRng() * 0.5,
      });
    }
    if (built) release(built.back, built.low, built.bloom, built.reflection);
    const low = surface(L.width / LOW_SCALE, L.height / LOW_SCALE);
    const bloom = surface(L.width / LOW_SCALE / BLOOM_SCALE, L.height / LOW_SCALE / BLOOM_SCALE);
    const reflection = surface(L.width / LOW_SCALE, Math.max(1, (L.height - L.horizon) / LOW_SCALE));
    const previous = built;
    const horizonFade = low.g.createLinearGradient(0, L.horizon - L.height * 0.05, 0, L.horizon);
    horizonFade.addColorStop(0, "rgba(0,0,0,0)");
    horizonFade.addColorStop(1, "rgba(0,0,0,0.8)");
    built = {
      layout: L,
      ribbons: L.ribbons.map((spec) => makeRibbon(spec, ctx, L)),
      back: paintBack(L, dpr, nebula, noise, star, flare),
      low: low.canvas,
      lowG: low.g,
      bloom: bloom.canvas,
      bloomG: bloom.g,
      reflection: reflection.canvas,
      reflectionG: reflection.g,
      horizonFade,
      cover: measureCardCover(avoidDoc),
      twinkles,
      grid: createPairGrid(L.width, L.height, L.linkDistance, NODE_CAP),
    };
    built.ribbons.forEach((r, i) => {
      const old = previous?.ribbons[i];
      if (old) r.bend = old.bend;
      updateRibbon(r, i, simTime);
    });
    hideScroll = Number.NaN;
    scrollTop = window.scrollY;
    updateHide(built);
    if (!previous) {
      seedNodes(L);
      for (let i = 0; i < DUST_CAP; i++) respawnDust(i, true);
    } else {
      // Keep the nodes in play when the window changes size: only the extra ones go.
      nodes.count = Math.min(NODE_CAP, L.maxNodes);
      for (let i = 0; i < nodes.count; i++) {
        nodes.x[i] = Math.min(nodes.x[i], L.width);
        nodes.y[i] = Math.min(nodes.y[i], L.horizon);
      }
    }
  };

  let mainCtx: CanvasRenderingContext2D | null = null;

  /** Fonts loaded or the profile chip appeared: rebuild only if the composition really moves. */
  const relayout = (): boolean => {
    if (!built || !lastSize || !mainCtx) return false;
    const old = built.layout;
    const L = computeLayout(old.width, old.height, avoidDoc);
    const moved =
      Math.abs(L.gutters.left - old.gutters.left) + Math.abs(L.gutters.right - old.gutters.right) + Math.abs(L.gutters.top - old.gutters.top) + Math.abs(L.gutters.clear - old.gutters.clear) > 2;
    if (moved) rebuild(lastSize, mainCtx);
    else {
      built.cover = measureCardCover(avoidDoc);
      updateHide(built);
    }
    return moved;
  };

  const handle = createScene({
    canvas,
    container,
    dprCap: DPR_CAP,
    resize(size, ctx) {
      scale = ctx.canvas.width / size.width;
      lastSize = { width: size.width, height: size.height, dpr: size.dpr };
      mainCtx = ctx;
      avoidDoc = measureAvoid();
      rebuild(size, ctx);
    },
    render(ctx, frame) {
      step(frame);
      draw(ctx);
    },
    reducedMotionFrame(ctx) {
      simTime = STILL_T;
      if (built) built.ribbons.forEach((r, i) => updateRibbon(r, i, STILL_T));
      draw(ctx);
    },
    onPointer(_pointer, event) {
      if (event.type !== "pointermove" && event.type !== "pointerdown") return;
      const target = event.target;
      pointerBlocked = !!options.pointerBlock && target instanceof Element && target.closest(options.pointerBlock) !== null;
    },
  });

  let started = false;
  let destroyed = false;
  let avoidTimer: ReturnType<typeof setTimeout> | undefined;
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const refreshAvoid = () => {
    if (destroyed) return;
    avoidDoc = measureAvoid();
    // A still frame is only redrawn on demand; start() repaints it.
    if (relayout() && started && reduceQuery.matches) handle.start();
  };
  const selectors = [options.avoid, options.avoidSoft].filter((s): s is string => !!s).join(",");
  const avoidObserver =
    selectors && typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          clearTimeout(avoidTimer);
          avoidTimer = setTimeout(refreshAvoid, 120);
        })
      : null;
  if (avoidObserver) for (const el of document.querySelectorAll(selectors)) avoidObserver.observe(el);
  // Text bounds change when the web fonts arrive, even if no element's box does.
  void document.fonts?.ready.then(refreshAvoid);

  return {
    start() {
      started = true;
      handle.start();
    },
    stop() {
      started = false;
      handle.stop();
    },
    destroy() {
      started = false;
      destroyed = true;
      clearTimeout(avoidTimer);
      avoidObserver?.disconnect();
      handle.destroy();
    },
  };
}
