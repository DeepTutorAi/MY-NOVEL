// Constellation hub scene ("lightfall", spec 3.3) on the hub scene kit. Three gold-silk ribbons
// fall from a point above the top centre, arc over the hero, run down the page's open corridors
// and end at a horizon behind the footer. The star sky is a static plane the compositor moves;
// the live canvas carries the ribbons (a 1/3-resolution glow plus full-resolution silk threads),
// the star net, the reading figures, the threads each card hangs from, dust, shooting stars and
// the pointer lantern. The stage window holds the star pool, the mid window the loom
// (lightfall-loom) and the ground window the horizon with its reflection. Maths live in
// lightfall-core.

import { createNoise2D, createRng, fbm2D } from "../_shared/scene-runtime";
import { meteorShower } from "./world/calendar-core";
import { TAU, clamp, lerp, pointInRect, smoothstep } from "./world/geom";
import { collectPlanes, createHubScene, staticDpr } from "./world/kit";
import { flareSprite, mistTile, radialSprite } from "./scene-paint";
import {
  CUT_PX,
  DUST_SPEED,
  FOLD_OFFSET,
  PULSE_SPEED,
  RIPPLE_LIFE_S,
  RIPPLE_SPEED,
  STUB_PX,
  THREAD_FADE_PX,
  THREAD_LAG,
  clampLateral,
  computeLayout,
  createNodes,
  createPairGrid,
  createRipplePool,
  ensureNodes,
  figureOrder,
  figurePattern,
  figureSlots,
  forEachPairWithin,
  heroPoolPercent,
  linkAlpha,
  litCount,
  nextShootingStarDelay,
  obstacles,
  reflectionRow,
  rippleAt,
  sampleRibbon,
  sampleSprings,
  seedNode,
  sourceY,
  spawnRipple,
  springBend,
  stepRipples,
  tapStrength,
  threadAnchor,
  threadCount,
  threadSag,
  threadPoint,
  twistAngle,
  twistAt,
} from "./lightfall-core";
import type { Figure, LightfallLayout, PairGrid, Ripple, RibbonPath, RibbonSpec, Spring, TwistState } from "./lightfall-core";
import { createLoom } from "./lightfall-loom";
import type {
  BindOptions,
  CardInfo,
  Ctx,
  HubBuildContext,
  HubContexts,
  HubFrame,
  HubPlanes,
  HubPointer,
  HubSceneHandle,
  HubSceneHooks,
  PageSnapshot,
  Rect,
  SceneEvent,
  Surface,
  Vec,
} from "./world/types";

/** The star sky: one static plane at parallax 0.12, tiled vertically by the scene (see wrapSky). */
const STATICS = [{ parallax: 0.12 }];
const LOW = 3;
const NODE_CAP = 96;
const DUST_CAP = 260;
const RING_LIFE_S = 1.5;
const TOUCH_LINGER_S = 2.2;
const MOUSE_IDLE_S = 6;
const SPRING_GAP = 140;
const PLUCK_PX = 48;
const FAST_SCROLL = 600;
const CALM_S = 0.15;
const GLOW_GAP_S = 6;
const ATTENDED_GLOW = 0.42;
/** A fading card glow is written in steps of this size, at most every GLOW_FALL_S (5.6 card-write gate). */
const GLOW_FALL_STEP = 0.16;
const GLOW_FALL_S = 0.2;
/** Share of the dust budget drawn at governor tiers 0, 1 and 2. */
const DUST_SHARE = [1, 0.7, 0.5];
const INTRO_S = 1.6;
const TRACE_S = 0.9;
const GOLD = "224,180,106";
/**
 * Text shading steps (pad, fill), drawn into a 1/SHADE mask that is stretched back with smoothing,
 * so every edge falls off softly: the live light erased behind text, then the hero's dark plates.
 */
const SHADE = 8;
const ERASE: readonly (readonly [number, string])[] = [[18, "rgba(0,0,0,0.35)"], [3, "rgba(0,0,0,0.7)"]];
const PLATE: readonly (readonly [number, string])[] = [[22, "rgba(5,6,12,0.3)"], [3, "rgba(5,6,12,0.6)"]];
/** A thread whose anchor lies further aside than this hangs straight down from a star in the band. */
const HANG_DX = 140;
const HANG_PX = 48;
const TAPPABLE = new Set(["open", "stage", "mid", "ground"]);

export function mount(root: HTMLElement, options: Partial<BindOptions> = {}): HubSceneHandle | null {
  const planes = collectPlanes(root, STATICS);
  if (!planes) return null;
  return createHubScene("constellation", planes, (ctx) => build(ctx, planes), options);
}

interface Ribbon {
  spec: RibbonSpec;
  path: RibbonPath;
  x: Float32Array;
  y: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  /** cos and sin of the twist, and of the threads' shared wobble phase, per sample. */
  cosT: Float32Array;
  sinT: Float32Array;
  cosW: Float32Array;
  sinW: Float32Array;
  width: Float32Array;
  fold: Float32Array;
  springs: Spring[];
  swirl: Spring;
  i0: number;
  i1: number;
  threads: number;
  halfAvg: number;
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
  /** Aimed past the title: crossing it starts the title glint (M8). */
  glint: boolean;
}

interface Ring {
  active: boolean;
  x: number;
  y: number;
  age: number;
  radius: number;
  plane: "sky" | "stage" | "ground";
}

interface Thread {
  card: CardInfo;
  ribbon: number;
  index: number;
  bx: number;
  by: number;
  tension: Spring;
  /** Time a bead started down this thread, or -Infinity. */
  bead: number;
  /** Document y of the star the thread hangs from in the band above its card, or null to hang from the ribbon. */
  hang: number | null;
  /** The hanging star is joined to the ribbon by a faint hairline (only where it crosses no text). */
  tie: boolean;
}

interface SkyFigure {
  card: CardInfo;
  slot: Rect;
  fig: Figure;
}

function build(ctx: HubBuildContext, planes: HubPlanes): HubSceneHooks {
  const rng = createRng(ctx.seed ^ 0x3c3c);
  const noise = createNoise2D(ctx.seed);
  const noise2 = createNoise2D(ctx.seed ^ 0x2b2b);
  const flow = createNoise2D(ctx.seed ^ 0x77);
  const range = (lo: number, hi: number) => lo + rng() * (hi - lo);
  const make = ctx.surfaces.create;
  const shower = meteorShower(ctx.now) !== null;

  const flare = flareSprite(64, "rgba(255,246,224,0.95)", "rgba(255,236,204,0.85)", make);
  const gold = radialSprite(24, [[0, "rgba(255,232,170,1)"], [0.28, "rgba(255,200,110,0.7)"], [1, "rgba(240,160,70,0)"]], make);
  const pale = radialSprite(24, [[0, "rgba(255,252,240,1)"], [0.28, "rgba(255,240,210,0.6)"], [1, "rgba(240,220,200,0)"]], make);
  const glint = radialSprite(96, [[0, "rgba(255,246,220,0.95)"], [0.16, "rgba(255,214,140,0.5)"], [0.5, "rgba(240,150,70,0.1)"], [1, "rgba(220,110,50,0)"]], make);
  const halo = radialSprite(128, [[0, "rgba(255,232,180,0.75)"], [0.25, "rgba(255,190,110,0.32)"], [0.62, "rgba(220,120,60,0.08)"], [1, "rgba(200,90,50,0)"]], make);
  // The ribbons' glow: soft light stamped along each ribbon, so it never shows an edge at any tier.
  const glowSprite = radialSprite(64, [[0, "rgba(255,200,128,1)"], [0.28, "rgba(246,166,96,0.52)"], [0.62, "rgba(185,119,74,0.14)"], [1, "rgba(185,119,74,0)"]], make);
  const ringSprite = radialSprite(128, [[0, "rgba(255,226,170,0)"], [0.74, "rgba(255,226,170,0)"], [0.86, "rgba(255,226,170,0.5)"], [1, "rgba(255,226,170,0)"]], make);
  // The horizon mist tiles are painted in idle steps; the ground draws without them until then.
  const mist: HTMLCanvasElement[] = [];
  ctx.paint.run("mist", [() => void mist.push(mistTile(noise2, 150, 140, 170, 60, make)), () => void mist.push(mistTile(noise, 196, 160, 128, 46, make))]);

  const loom = createLoom(make, (s) => ctx.surfaces.release(s));

  let L: LightfallLayout | null = null;
  let lastFrame: HubFrame | null = null;
  let stillMode = false;
  let twinkleKey = "";
  let ribbons: Ribbon[] = [];
  let threads: Thread[] = [];
  let skyFigures: SkyFigure[] = [];
  let cards: CardInfo[] = [];
  let figures = new Map<string, Figure>();
  let composedVersion = -1;
  let composedSize = "";
  let low: Surface | null = null;
  let shadeMask: Surface | null = null;
  /** Viewport x of the left and right side ribbons at the top of the stage window. */
  let fallFrom: [number, number] | null = null;
  let grid: PairGrid | null = null;
  let skyKey = "";
  let period = 1;
  let simTime = 0;
  let scrollY = 0;
  let threadFade = 1;
  let calm = 0;
  let lastVel = 0;
  let attended: string | null = null;
  let lastAttended: string | null = null;
  let chosen: { slug: string; at: number } | null = null;
  let flareAt = -Infinity;
  let introAt = Number.NaN;
  let introPending = false;
  let frozenRing: Vec | null = null;
  let lightValue = 0;
  let lightWritten = 0;
  let lightAt = -Infinity;
  let reflectKick = 0;
  let nextShootingStarAt = nextShootingStarDelay(rng);
  let nextShowerAt = shower ? nextShootingStarDelay(rng) * 0.5 : Infinity;
  let nextPulseAt = 3;

  const nodes = createNodes(NODE_CAP);
  const linkA = new Int16Array(4096);
  const linkB = new Int16Array(4096);
  const linkK = new Float32Array(4096);
  let links = 0;
  let linkR2 = 1;
  const collectLink = (i: number, j: number, d2: number) => {
    if (links >= 4096) return;
    linkA[links] = i;
    linkB[links] = j;
    linkK[links] = linkAlpha(d2, linkR2) * Math.min(nodes.life[i], nodes.life[j]);
    links++;
  };

  const dust = { d: new Float32Array(DUST_CAP), ribbon: new Uint8Array(DUST_CAP), angle: new Float32Array(DUST_CAP), spin: new Float32Array(DUST_CAP), orbit: new Float32Array(DUST_CAP), speed: new Float32Array(DUST_CAP), age: new Float32Array(DUST_CAP), life: new Float32Array(DUST_CAP), size: new Float32Array(DUST_CAP), phase: new Float32Array(DUST_CAP) };
  const ripples: Ripple[] = createRipplePool(6);
  const rippleHits = ripples.map(() => new Set<string>());
  const rings: Ring[] = Array.from({ length: 8 }, (): Ring => ({ active: false, x: 0, y: 0, age: 0, radius: 1, plane: "sky" }));
  const shootingStars: ShootingStar[] = Array.from({ length: 3 }, () => ({ active: false, x: 0, y: 0, length: 0, speed: 0, angle: 0, age: 0, life: 1, glint: false }));
  const pulse = { active: false, ribbon: 0, d: 0, end: 0 };
  const twist: TwistState = { thickness: 1, fold: 0 };
  const lantern = { x: 0, y: 0, on: false, intensity: 0, movedAt: -10, lingerUntil: -1, mouse: true };
  const glow = new Map<string, { value: number; written: number; at: number; bumpAt: number }>();
  const pt: Vec = { x: 0, y: 0 };

  /* ---------------------------------------------------------------- sky plane */

  /** The low-resolution nebula while its sky job is painting. */
  let nebula: Surface | null = null;

  /** A star plane that tiles every `period` px, so the kit's parallax can wrap it seamlessly. */
  const paintSky = (f: HubFrame) => {
    const canvas = planes.statics[0].canvas;
    const dpr = staticDpr(f.page.viewport);
    const W = f.width;
    const P = Math.max(1, Math.ceil(f.height));
    const key = `${Math.ceil(W * dpr)}x${P}@${dpr}`;
    if (key === skyKey) return;
    skyKey = key;
    period = P;
    canvas.width = Math.ceil(W * dpr);
    canvas.height = Math.ceil(2 * P * dpr);
    const g = canvas.getContext("2d");
    if (!g) return;
    const sr = createRng(ctx.seed ^ 0x1234);
    const scale = 8;
    const nw = Math.ceil(W / scale);
    const nh = Math.ceil(P / scale);
    if (nebula) ctx.surfaces.release(nebula);
    const neb = (nebula = make(nw, nh));
    const image = neb.g.createImageData(nw, nh);
    const nebulaRows = (from: number, to: number) => () => {
      for (let y = from; y < to; y++) {
        const py = y * scale;
        const k = py / P;
        for (let x = 0; x < nw; x++) {
          const px = x * scale;
          // A cross-fade between two noise rows one period apart makes the nebula tile vertically.
          const near = fbm2D(noise, px * 0.0021, py * 0.0024, 4);
          const far = fbm2D(noise, px * 0.0021, (py - P) * 0.0024, 4);
          const cloud = clamp((near * (1 - k) + far * k) * 0.95 + 0.24, 0, 1);
          const tint = clamp(fbm2D(noise2, px * 0.0037 + 4, py * 0.0037, 3) * (1 - k) * 0.9 + 0.5, 0, 1);
          const a = cloud * cloud * (0.75 + 0.25 * Math.sin(k * TAU));
          const i = (y * nw + x) * 4;
          image.data[i] = lerp(120, 170, tint);
          image.data[i + 1] = lerp(40, 110, tint);
          image.data[i + 2] = lerp(92, 64, tint);
          image.data[i + 3] = a * 92;
        }
      }
    };
    const both = (draw: (dy: number) => void) => {
      draw(0);
      draw(P);
      draw(-P);
    };
    // About 1200 nebula samples per step keeps each idle step well under 20 ms.
    const band = Math.max(1, Math.floor(1200 / nw));
    const bands: (() => void)[] = [];
    for (let y = 0; y < nh; y += band) bands.push(nebulaRows(y, Math.min(nh, y + band)));
    const faint = Math.round(clamp((W * P) / 820, 240, 2600));
    const faintStars = (from: number, to: number) => () => {
      for (let i = from; i < to; i++) {
        const x = sr() * W;
        const y = sr() * P;
        const a = 0.16 + sr() * 0.66;
        const hue = sr();
        g.fillStyle = hue < 0.24 ? `rgba(255,224,178,${a})` : hue < 0.4 ? `rgba(198,210,255,${a})` : `rgba(255,252,244,${a})`;
        const s = sr() < 0.07 ? 1.6 : 0.8 + sr() * 0.5;
        both((dy) => g.fillRect(x, y + dy, s, s));
      }
    };
    const stars: (() => void)[] = [];
    for (let i = 0; i < faint; i += 700) stars.push(faintStars(i, Math.min(faint, i + 700)));
    // One job key, so a resize drops the stale steps of the previous size.
    ctx.paint.run("sky", [
      ...bands,
      () => {
        neb.g.putImageData(image, 0, 0);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, P);
        g.imageSmoothingQuality = "high";
        g.drawImage(neb.canvas, 0, 0, W, P);
        ctx.surfaces.release(neb);
        nebula = null;
      },
      ...stars,
      () => {
        g.globalCompositeOperation = "lighter";
        const soft = Math.round(clamp((W * P) / 13000, 36, 170));
        for (let i = 0; i < soft + 18; i++) {
          const big = i >= soft;
          const x = sr() * W;
          const y = sr() * P;
          const s = big ? 16 + sr() * 22 : 4 + sr() * 7;
          g.globalAlpha = big ? 0.5 + sr() * 0.5 : 0.3 + sr() * 0.6;
          both((dy) => g.drawImage(big ? flare : pale, x - s / 2, y + dy - s / 2, s, s));
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(canvas, 0, 0, canvas.width, Math.ceil(P * dpr), 0, Math.ceil(P * dpr), canvas.width, Math.ceil(P * dpr));
      },
    ]);
  };

  /** Keeps the sky plane's offset inside one period: the kit adds this shift to its parallax. */
  const wrapSky = (f: HubFrame) => {
    const raw = f.staticY[0] ?? 0;
    ctx.shiftStatic(0, 0, Math.floor(raw / period) * period);
  };

  const twinkles: { x: number; y: number; size: number; rate: number; phase: number; base: number }[] = [];
  const seedTwinkles = (W: number, P: number) => {
    const tr = createRng(ctx.seed ^ 0x7e11);
    twinkles.length = 0;
    const count = Math.round(clamp((W * P) / 42_000, 10, 34));
    for (let i = 0; i < count; i++) {
      twinkles.push({ x: tr() * W, y: tr() * P, size: 7 + tr() * 11, rate: TAU / (2.2 + tr() * 5), phase: tr() * TAU, base: 0.26 + tr() * 0.5 });
    }
  };

  /* ---------------------------------------------------------------- composition */

  const visibleCover = (s: PageSnapshot, x: number, y: number) => s.cover.some((r) => x > r.x && x < r.x + r.w && y + scrollY > r.y && y + scrollY < r.y + r.h);

  const compose = (f: HubFrame) => {
    const s = f.page;
    const size = `${f.width}x${f.height}`;
    if (s.version === composedVersion && size === composedSize) return;
    const resized = size !== composedSize;
    composedVersion = s.version;
    composedSize = size;
    L = computeLayout(s);
    const obs = obstacles(s);
    const old = ribbons;
    ribbons = L.ribbons.map((spec, r) => {
      const path = sampleRibbon(spec, obs);
      const n = path.n;
      const f32 = () => new Float32Array(n);
      const count = Math.max(2, Math.min(64, Math.ceil(path.length / SPRING_GAP) + 1));
      const kept = old[r]?.springs.length === count ? old[r].springs : Array.from({ length: count }, () => ({ x: 0, v: 0 }));
      return { spec, path, x: f32(), y: f32(), nx: f32(), ny: f32(), cosT: f32(), sinT: f32(), cosW: f32(), sinW: f32(), width: f32(), fold: f32(), springs: kept, swirl: old[r]?.swirl ?? { x: 0, v: 0 }, i0: 0, i1: -1, threads: 1, halfAvg: 1 };
    });
    cards = s.cards;
    // Where the side ribbons pass the top of the stage window: the pool's side falls branch off there.
    const stageTop = s.windows.stage.y;
    const passes = ribbons.slice(0, 2).map((rb) => {
      let x = Number.NaN;
      let best = 60;
      for (let i = 0; i < rb.path.n; i++) {
        const dd = Math.abs(rb.path.y[i] - stageTop);
        if (rb.path.fade[i] > 0.5 && dd < best) {
          best = dd;
          x = rb.path.x[i];
        }
      }
      return x;
    }).filter(Number.isFinite);
    fallFrom = passes.length ? [Math.min(...passes), Math.max(...passes)] : null;
    const reach = Math.max(460, s.viewport.w * 0.26);
    const oldThreads = new Map(threads.map((t) => [t.card.slug, t]));
    threads = [];
    const crosses = (x0: number, y0: number, x1: number, y1: number) => {
      for (let n = 1; n < 12; n++) {
        const x = lerp(x0, x1, n / 12);
        const y = lerp(y0, y1, n / 12);
        if (obs.some((r) => pointInRect({ x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 }, x, y))) return true;
      }
      return false;
    };
    for (const c of cards) {
      const by = c.rect.y - STUB_PX - (c.kind === "locked" ? CUT_PX : 0);
      const bx = c.rect.x + c.rect.w / 2;
      const a = threadAnchor(ribbons.map((rb) => rb.path), bx, by, reach);
      if (!a) continue;
      const ap = ribbons[a.ribbon].path;
      const ax = ap.x[a.index];
      const ay = ap.y[a.index];
      // A long sideways run, or one across text, becomes a thread hanging straight down in the band.
      let hang: number | null = null;
      let tie = false;
      if (Math.abs(bx - ax) > HANG_DX || crosses(ax, ay, bx, by)) {
        let top = by - HANG_PX;
        for (const r of obs) if (bx >= r.x - 6 && bx <= r.x + r.w + 6 && r.y + r.h <= by && r.y + r.h + 6 > top) top = r.y + r.h + 6;
        hang = Math.min(top, by - 12);
        tie = !crosses(ax, ay, bx, hang);
      }
      const prev = oldThreads.get(c.slug);
      threads.push({ card: c, ribbon: a.ribbon, index: a.index, bx, by, tension: prev?.tension ?? { x: 0, v: 0 }, bead: prev?.bead ?? -Infinity, hang, tie });
    }
    for (const c of cards) if (!figures.has(c.slug)) figures.set(c.slug, figurePattern(c.slug));
    const slots = figureSlots(s, L);
    skyFigures = figureOrder(cards)
      .slice(0, slots.length)
      .map((card, i) => ({ card, slot: slots[i], fig: figures.get(card.slug) as Figure }));
    ctx.out.heroPoolX(heroPoolPercent(s, ribbons.map((rb) => rb.path)));
    if (resized || !grid) {
      grid = createPairGrid(f.width, f.height, L.linkDistance, NODE_CAP);
      ensureNodes(nodes, L.maxNodes, rng, f.width, f.height, (x, y) => !visibleCover(s, x, y));
      for (let i = 0; i < DUST_CAP; i++) respawnDust(i, true);
    }
  };

  const respawnDust = (i: number, anywhere: boolean) => {
    const r = Math.floor(rng() * Math.max(1, ribbons.length));
    const rb = ribbons[r];
    dust.ribbon[i] = r;
    const top = rb ? rb.path.d[Math.max(0, rb.i0)] : 0;
    const bottom = rb ? rb.path.d[Math.max(0, Math.min(rb.path.n - 1, rb.i1))] : 0;
    dust.d[i] = anywhere ? lerp(top, bottom, rng()) : top + rng() * 60;
    dust.angle[i] = rng() * TAU;
    dust.spin[i] = range(0.5, 1.5) * (rng() < 0.5 ? -1 : 1);
    dust.orbit[i] = Math.pow(rng(), 1.6) * (L?.compact ? 10 : 34) + 2;
    dust.speed[i] = range(DUST_SPEED[0], DUST_SPEED[1]);
    dust.life[i] = range(5, 14);
    dust.age[i] = anywhere ? dust.life[i] * rng() * 0.8 : 0;
    dust.size[i] = rng() < 0.08 ? range(6, 10) : range(1.6, 4.4);
    dust.phase[i] = rng() * TAU;
  };

  /* ---------------------------------------------------------------- ribbon motion */

  /** Viewport y of a document point on a ribbon: the source lags the page except in still frames. */
  const viewY = (yDoc: number) => (stillMode || !L ? yDoc - scrollY : sourceY(L, yDoc, scrollY));

  /** Moves every ribbon to time t at the current scroll, updating only its visible span. */
  const updateRibbons = (f: HubFrame, t: number) => {
    if (!L) return;
    const H = f.height;
    ribbons.forEach((rb, r) => {
      const { path, spec } = rb;
      let i0 = path.n;
      let i1 = -1;
      for (let i = 0; i < path.n; i++) {
        const v = viewY(path.y[i]);
        if (v > -160 && v < H + 160) {
          if (i < i0) i0 = i;
          i1 = i;
        }
      }
      rb.i0 = Math.max(0, i0 - 2);
      rb.i1 = Math.min(path.n - 1, i1 + 2);
      let halfSum = 0;
      for (let i = rb.i0; i <= rb.i1; i++) {
        const d = path.d[i];
        const room = path.room[i];
        // The sway's reach drifts along the ribbon, so its bends never line up like a rope.
        const amp = Math.min(spec.sway * (0.7 + 0.3 * flow(d * 0.002, spec.phase)), room * 0.6);
        const sway = amp * (Math.sin(d * 0.006 + t * 0.42 + spec.phase) * 0.55 + Math.sin(d * 0.013 - t * 0.31 + spec.phase * 2) * 0.25 + flow(d * 0.004 + spec.phase, t * 0.13) * 0.4);
        const wave = rippleAt(ripples, r, d) * Math.max(14, path.half[i] * 0.9) * Math.sin(d * 0.05 - t * 7);
        const swirl = rb.swirl.x * room * 0.7 * Math.sin(d * 0.012 - t * 2);
        const lateral = clampLateral(sway + sampleSprings(rb.springs, d / path.length) + wave + swirl, room);
        const nx = -path.ty[i];
        const ny = path.tx[i];
        rb.nx[i] = nx;
        rb.ny[i] = ny;
        rb.x[i] = path.x[i] + nx * lateral;
        rb.y[i] = viewY(path.y[i] + ny * lateral);
        const theta = twistAngle(spec, d, t, flow(d * 0.003 + spec.phase * 3, t * 0.05)) + rb.swirl.x * 2.4;
        rb.cosT[i] = Math.cos(theta);
        rb.sinT[i] = Math.sin(theta);
        rb.cosW[i] = Math.cos(i * 0.3 + t * 0.4);
        rb.sinW[i] = Math.sin(i * 0.3 + t * 0.4);
        twistAt(theta, twist);
        rb.width[i] = path.half[i] * (0.82 + 0.18 * (flow(d * 0.004 - spec.phase, t * 0.07) * 0.5 + 0.5));
        rb.fold[i] = twist.fold;
        if (path.fade[i] > 0.5) halfSum += path.half[i];
      }
      rb.halfAvg = halfSum / Math.max(1, rb.i1 - rb.i0 + 1);
      rb.threads = threadCount(rb.halfAvg, f.tier);
    });
  };

  /** Viewport position of a ribbon sample, falling back to its resting place when outside the span. */
  const ribbonPoint = (rb: Ribbon, i: number, out: Vec): Vec => {
    if (i >= rb.i0 && i <= rb.i1) {
      out.x = rb.x[i];
      out.y = rb.y[i];
    } else if (L) {
      out.x = rb.path.x[i];
      out.y = viewY(rb.path.y[i]);
    }
    return out;
  };

  /** The nearest visible ribbon sample to a viewport point. */
  const nearestOnRibbons = (x: number, y: number) => {
    let best = { ribbon: -1, index: 0, dist: Infinity };
    ribbons.forEach((rb, r) => {
      for (let i = rb.i0; i <= rb.i1; i++) {
        if (rb.path.fade[i] < 0.5) continue;
        const dist = Math.hypot(rb.x[i] - x, rb.y[i] - y);
        if (dist < best.dist) best = { ribbon: r, index: i, dist };
      }
    });
    return best;
  };

  /* ---------------------------------------------------------------- mechanics */

  const addRing = (plane: Ring["plane"], x: number, y: number, radius: number) => {
    const ring = rings.find((c) => !c.active) ?? rings[0];
    Object.assign(ring, { active: true, x, y, age: 0, radius, plane });
  };

  /** A wave from a viewport point: strongest on the nearest ribbon, falling off with distance on the others. */
  const wave = (x: number, y: number, pluck: boolean, reach = 520) => {
    ribbons.forEach((rb, r) => {
      let best = -1;
      let dist = Infinity;
      for (let i = rb.i0; i <= rb.i1; i++) {
        if (rb.path.fade[i] < 0.5) continue;
        const dd = Math.hypot(rb.x[i] - x, rb.y[i] - y);
        if (dd < dist) {
          dist = dd;
          best = i;
        }
      }
      const k = pluck && dist <= PLUCK_PX ? 1 : tapStrength(dist, reach);
      if (best < 0 || k < 0.04) return;
      const slot = spawnRipple(ripples, r, rb.path.d[best], k);
      rippleHits[ripples.indexOf(slot)].clear();
    });
    for (let i = 0; i < nodes.count; i++) {
      const dd = Math.hypot(nodes.x[i] - x, nodes.y[i] - y);
      if (dd < 220) nodes.flash[i] = Math.max(nodes.flash[i], 1 - dd / 220);
    }
    reflectKick = 1;
  };

  /** Stage play (M3): ripples on the pool and a wave up all three ribbons. */
  const stageTap = (f: HubFrame, x?: number, y?: number) => {
    const win = f.win.stage;
    const pool = poolGeom(f);
    const px = x !== undefined && win ? x - win.x : pool.cx;
    const py = y !== undefined && win ? y - win.y : pool.cy;
    addRing("stage", px, py, pool.rx * 0.9);
    frozenRing = { x: px, y: py };
    if (win) wave(win.x + pool.cx, win.y + Math.max(0, pool.cy - pool.ry), false, f.width * 1.2);
  };

  const swirl = (dir: number) => {
    for (const rb of ribbons) {
      rb.swirl.v += dir * 7;
      if (stillMode) rb.swirl.x = clamp(rb.swirl.x + dir * 0.6, -0.6, 0.6);
    }
  };

  const onTap = (f: HubFrame, p: HubPointer) => {
    if (p.zone === "stage") stageTap(f, p.x, p.y);
    else if (p.zone === "mid") loom.shuttle(accentOf(lastAttended), simTime);
    else if (stillMode) return;
    else if (p.zone === "ground") {
      const win = f.win.ground;
      if (win) addRing("ground", p.x - win.x, p.y - win.y, 150);
      reflectKick = 1;
    } else {
      const near = nearestOnRibbons(p.x, p.y);
      wave(p.x, p.y, near.dist <= PLUCK_PX);
      if (near.dist > PLUCK_PX) {
        addRing("sky", p.x, p.y, 150);
        const win = f.win.ground;
        if (win && L) addRing("ground", p.x - win.x, L.horizon - scrollY - win.y + 30, 130);
      }
    }
  };

  const accentOf = (slug: string | null) => cards.find((c) => c.slug === slug)?.accent ?? null;

  const glowOf = (slug: string) => {
    let st = glow.get(slug);
    if (!st) {
      st = { value: 0, written: 0, at: -Infinity, bumpAt: -Infinity };
      glow.set(slug, st);
    }
    return st;
  };

  /** A pulse lights a card (M7), at most once per GLOW_GAP_S. */
  const bump = (slug: string, at: number) => {
    const st = glowOf(slug);
    if (at - st.bumpAt < GLOW_GAP_S) return;
    st.value = Math.max(st.value, 0.8);
    st.bumpAt = at;
  };

  /* ---------------------------------------------------------------- simulation */

  const step = (f: HubFrame) => {
    if (!L) return;
    const dt = f.dt;
    const t = (simTime += dt);
    if (introPending) {
      introPending = false;
      introAt = t;
    }

    // Scroll: the canvas threads hide during fast scrolling (8.4 item 28); speed changes kick the springs.
    const vel = Math.abs(f.scrollVel);
    calm = vel > FAST_SCROLL ? 0 : calm + dt;
    threadFade = clamp(threadFade + (vel > FAST_SCROLL ? -10 : calm >= CALM_S ? 4 : 0) * dt, 0, 1);
    const kick = clamp(f.scrollVel - lastVel, -3000, 3000) * 0.0035;
    lastVel = f.scrollVel;

    // Lantern: the pointer as a small warm star; touch only answers taps and still presses.
    const p = f.pointer;
    if (lantern.mouse && p.active && t - lantern.movedAt > MOUSE_IDLE_S) lantern.on = false;
    const lit = lantern.on && (lantern.mouse ? p.active : t < lantern.lingerUntil);
    if (lantern.intensity < 0.02 && lit) {
      lantern.x = p.x;
      lantern.y = p.y;
    }
    const follow = Math.min(1, dt * 9);
    lantern.x += (p.x - lantern.x) * follow;
    lantern.y += (p.y - lantern.y) * follow;
    lantern.intensity = clamp(lantern.intensity + (lit ? 2.6 : -1.6) * dt, 0, 1);

    stepRipples(ripples, dt);
    reflectKick = Math.max(0, reflectKick - dt * 0.8);

    // Springs lean toward the lantern and the attended card, inside each corridor's room.
    const pull = attended ? cards.find((c) => c.slug === attended) : undefined;
    const cx = pull ? pull.rect.x + pull.rect.w / 2 : 0;
    const cy = pull ? pull.rect.y + pull.rect.h * 0.3 - scrollY : 0;
    ribbons.forEach((rb, r) => {
      const { path } = rb;
      rb.springs.forEach((s, k) => {
        const i = Math.round((k / (rb.springs.length - 1)) * (path.n - 1));
        const sx = path.x[i];
        const sy = viewY(path.y[i]);
        const nx = -path.ty[i];
        const ny = path.tx[i];
        let target = 0;
        if (lantern.intensity > 0.01) {
          const dx = lantern.x - sx;
          const dy = lantern.y - sy;
          target += (dx * nx + dy * ny) * lantern.intensity * Math.max(0, 1 - Math.hypot(dx, dy) / (L?.compact ? 180 : 280)) * 0.5;
        }
        if (pull) {
          const dx = cx - sx;
          const dy = cy - sy;
          target += (dx * nx + dy * ny) * Math.max(0, 1 - Math.hypot(dx, dy) / 420) * 0.35;
        }
        s.v += kick * Math.sin(k * 1.7 + r * 2.3);
        springBend(s, k === 0 ? 0 : clamp(target, -path.room[i], path.room[i]), dt);
      });
      springBend(rb.swirl, 0, dt * 0.6);
    });
    updateRibbons(f, t);

    // Waves that pass behind a card ring it (resonance beats; output limits apply).
    ripples.forEach((rp, k) => {
      if (!rp.active) return;
      const rb = ribbons[rp.ribbon];
      if (!rb) return;
      const travel = rp.age * RIPPLE_SPEED;
      const step = rb.path.length / (rb.path.n - 1);
      for (const d of [rp.d - travel, rp.d + travel]) {
        const i = Math.round(d / step);
        if (i < 0 || i >= rb.path.n) continue;
        const x = rb.path.x[i];
        const y = rb.path.y[i];
        for (const c of cards) {
          if (rippleHits[k].has(c.slug)) continue;
          if (y < c.rect.y || y > c.rect.y + c.rect.h || x < c.rect.x - 140 || x > c.rect.x + c.rect.w + 140) continue;
          rippleHits[k].add(c.slug);
          ctx.out.beat(c.slug, "resonance");
        }
      }
    });

    // A pulse falls down one ribbon every few seconds, branching into the threads it passes.
    if (!pulse.active && t >= nextPulseAt && ribbons.length) {
      const r = Math.floor(rng() * ribbons.length);
      const rb = ribbons[r];
      if (rb.i1 > rb.i0) {
        pulse.active = true;
        pulse.ribbon = r;
        pulse.d = rb.path.d[rb.i0];
        pulse.end = rb.path.d[rb.i1];
      }
      nextPulseAt = t + range(3.5, 6.5);
    }
    if (pulse.active) {
      const rb = ribbons[pulse.ribbon];
      const before = pulse.d;
      pulse.d += PULSE_SPEED * dt;
      for (const th of threads) {
        if (th.ribbon !== pulse.ribbon) continue;
        const d = rb.path.d[th.index];
        if (d > before && d <= pulse.d) th.bead = t;
      }
      const i = Math.min(rb.path.n - 1, Math.round(pulse.d / (rb.path.length / (rb.path.n - 1))));
      const py = rb.path.y[i];
      const px = rb.path.x[i];
      for (const c of cards) {
        if (py < c.rect.y || py > c.rect.y + c.rect.h || px < c.rect.x - 160 || px > c.rect.x + c.rect.w + 160) continue;
        bump(c.slug, t);
      }
      if (pulse.d >= pulse.end || pulse.d >= rb.path.length) {
        pulse.active = false;
        if (f.win.ground) reflectKick = Math.max(reflectKick, 0.6);
      }
    }

    // Star net: slow drift, pushed by the lantern, re-seeded softly when it leaves the screen.
    const W = f.width;
    const H = f.height;
    for (let i = 0; i < nodes.count; i++) {
      nodes.x[i] += nodes.vx[i] * dt;
      nodes.y[i] += nodes.vy[i] * dt;
      if (nodes.x[i] < -20 || nodes.x[i] > W + 20 || nodes.y[i] < -20 || nodes.y[i] > H + 20) {
        seedNode(nodes, i, rng, W, H, (x, y) => !visibleCover(f.page, x, y));
      }
      if (lantern.intensity > 0.01) {
        const dx = nodes.x[i] - lantern.x;
        const dy = nodes.y[i] - lantern.y;
        const d = Math.hypot(dx, dy);
        if (d < L.repelRadius && d > 0.01) {
          const push = ((L.repelRadius - d) / L.repelRadius) * 48 * lantern.intensity * dt;
          nodes.x[i] += (dx / d) * push;
          nodes.y[i] += (dy / d) * push;
        }
      }
      nodes.life[i] = Math.min(1, nodes.life[i] + dt * 0.7);
      if (nodes.flash[i] > 0) nodes.flash[i] = Math.max(0, nodes.flash[i] - dt * 1.2);
    }

    // Gold dust falling along the ribbons.
    const dustCount = Math.min(DUST_CAP, Math.round(L.maxDust * DUST_SHARE[f.tier]));
    for (let i = 0; i < dustCount; i++) {
      const rb = ribbons[dust.ribbon[i]];
      if (!rb) continue;
      dust.age[i] += dt;
      dust.d[i] += dust.speed[i] * dt;
      dust.angle[i] += dust.spin[i] * dt;
      const end = rb.path.d[rb.i1] ?? 0;
      const start = rb.path.d[rb.i0] ?? 0;
      if (dust.age[i] >= dust.life[i] || dust.d[i] > end || dust.d[i] < start) respawnDust(i, dust.d[i] < start || dust.d[i] > end + 400);
    }

    // Shooting stars every five to nine seconds; on meteor-shower nights a second stream.
    if (t >= nextShootingStarAt) {
      launchStar(f, rng() < 0.25);
      nextShootingStarAt = t + nextShootingStarDelay(rng);
    }
    if (t >= nextShowerAt) {
      launchStar(f, false);
      nextShowerAt = t + nextShootingStarDelay(rng);
    }
    const title = f.page.parts.title;
    for (const s of shootingStars) {
      if (!s.active) continue;
      s.age += dt;
      s.x += Math.cos(s.angle) * s.speed * dt;
      s.y += Math.sin(s.angle) * s.speed * dt;
      if (s.glint && s.x < title.x + title.w && s.x > title.x && Math.abs(s.y - (title.y - scrollY)) < 90) {
        s.glint = false;
        ctx.out.beat(null, "title-glint");
        lightValue = 1;
      }
      if (s.age >= s.life) s.active = false;
    }
    lightValue = Math.max(0, lightValue - dt * 0.7);

    for (const ring of rings) {
      if (!ring.active) continue;
      ring.age += dt;
      if (ring.age >= (ring.plane === "stage" ? RIPPLE_LIFE_S : RING_LIFE_S)) ring.active = false;
    }
    for (const th of threads) springBend(th.tension, attended === th.card.slug ? 0.55 : 0, dt);
    for (const c of cards) {
      const st = glowOf(c.slug);
      const floor = c.slug === attended ? ATTENDED_GLOW : 0;
      st.value = st.value > floor ? Math.max(floor, st.value - 0.55 * dt) : floor;
    }
  };

  const launchStar = (f: HubFrame, aimed: boolean) => {
    const s = shootingStars.find((c) => !c.active);
    if (!s) return;
    const W = f.width;
    const H = f.height;
    const title = f.page.parts.title;
    const ty = title.y - scrollY;
    const aim = aimed && ty > 20 && ty < H * 0.6;
    s.active = true;
    s.glint = aim;
    s.x = aim ? Math.min(W - 20, title.x + title.w * 0.95 + 140) : range(W * 0.2, W * 0.9);
    s.y = aim ? ty - 150 : range(H * 0.05, H * 0.32);
    s.length = range(70, 130);
    s.speed = range(450, 660);
    s.angle = aim ? Math.atan2(150, -(title.w * 0.5 + 140)) : range(Math.PI * 0.72, Math.PI * 0.82);
    s.age = 0;
    s.life = aim ? 1.25 : range(0.7, 1.03);
  };

  /** A shooting star that streaks down to a viewport point and fades as it arrives (M9). */
  const launchStarTo = (x: number, y: number) => {
    const s = shootingStars.find((c) => !c.active) ?? shootingStars[0];
    Object.assign(s, { active: true, glint: false, x: x + 260, y: y - 190, length: 110, speed: 620, angle: Math.atan2(190, -260), age: 0 });
    s.life = Math.hypot(260, 190) / s.speed;
  };

  /** Where the chosen card's figure is on screen: its sky slot when visible, else its place in the pool. */
  const figureOnScreen = (f: HubFrame, slug: string): Vec | null => {
    const sky = skyFigures.find((sf) => sf.card.slug === slug);
    const raw = f.staticY[0] ?? 0;
    if (sky && sky.slot.y - raw + sky.slot.h > 0) return { x: sky.slot.x + sky.slot.w / 2, y: sky.slot.y - raw + sky.slot.h / 2 };
    const win = f.win.stage;
    const i = cards.findIndex((c) => c.slug === slug);
    if (!win || i < 0) return null;
    const b = poolFigureBox(poolGeom(f), i, cards.length);
    return { x: win.x + b.x + b.w / 2, y: win.y + b.y + b.h / 2 };
  };

  /* ---------------------------------------------------------------- drawing: sky */

  /** Appends one silk thread across the visible span, as a smooth curve through every `stride`-th sample. */
  const traceThread = (g: Ctx, rb: Ribbon, j: number, stride: number) => {
    const a = -1 + (2 * (j + 0.5)) / rb.threads;
    // cos(theta + lag) and sin(i * 0.3 + t * 0.4 + wander) from the per-sample terms.
    const cl = Math.cos(a * THREAD_LAG);
    const sl = Math.sin(a * THREAD_LAG);
    const cw = Math.cos(j * 2.4);
    const sw = Math.sin(j * 2.4);
    let pen = false;
    let px = 0;
    let py = 0;
    for (let i = rb.i0; i <= rb.i1; i += stride) {
      if (rb.path.fade[i] < 0.5) {
        if (pen) g.lineTo(px, py);
        pen = false;
        continue;
      }
      const wd = rb.width[i];
      const h = wd * a * (rb.cosT[i] * cl - rb.sinT[i] * sl) + (rb.sinW[i] * cw + rb.cosW[i] * sw) * (0.5 + wd * 0.02);
      const x = rb.x[i] + rb.nx[i] * h;
      const y = rb.y[i] + rb.ny[i] * h;
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

  /** Glints where the threads cross at each fold, and the falling pulse. */
  const drawLights = (g: Ctx, strength: number) => {
    for (const rb of ribbons) {
      for (let i = rb.i0 + 1; i < rb.i1; i++) {
        const fo = rb.fold[i];
        if (rb.path.fade[i] < 0.5 || fo < 0.5 || fo < rb.fold[i - 1] || fo < rb.fold[i + 1]) continue;
        const size = Math.max(14, rb.width[i] * 1.1);
        const off = -rb.sinT[i] * FOLD_OFFSET * rb.width[i];
        g.globalAlpha = 0.55 * strength * rb.path.fade[i];
        g.drawImage(glint, rb.x[i] + rb.nx[i] * off - size / 2, rb.y[i] + rb.ny[i] * off - size / 2, size, size);
      }
    }
    if (pulse.active) {
      const rb = ribbons[pulse.ribbon];
      const per = rb.path.length / (rb.path.n - 1);
      for (let n = 0; n < 7; n++) {
        const i = Math.round((pulse.d - n * 9) / per);
        if (i < rb.i0 || i > rb.i1 || rb.path.fade[i] < 0.5) continue;
        const size = Math.max(30, rb.width[i] * 1.2) * (1 - n / 9);
        g.globalAlpha = (1 - n / 7) * 0.85 * strength;
        g.drawImage(glint, rb.x[i] - size / 2, rb.y[i] - size / 2, size, size);
      }
    }
    g.globalAlpha = 1;
  };

  /**
   * The ribbons' soft glow: the glow sprite stamped along each ribbon on the 1/3 canvas (spacing
   * about half its radius, alpha scaled to the spacing so every tier gives the same soft light),
   * then the whole low canvas stretched back once, so no edge or seam can show.
   */
  const drawGlow = (g: Ctx, t: number, tier: 0 | 1 | 2) => {
    if (!low || !L) return;
    const lg = low.g;
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.clearRect(0, 0, low.canvas.width, low.canvas.height);
    lg.setTransform(1 / LOW, 0, 0, 1 / LOW, 0, 0);
    lg.globalCompositeOperation = "lighter";
    const peak = L.compact ? 0.2 : 0.24;
    const pad = L.compact ? 7 : 10;
    const sparse = tier === 2 ? 2 : 1;
    ribbons.forEach((rb, index) => {
      if (rb.i1 <= rb.i0) return;
      const breathe = peak * (0.86 + 0.14 * Math.sin(t * 0.7 + index * 2.1));
      const per = rb.path.length / Math.max(1, rb.path.n - 1);
      let i = rb.i0;
      while (i <= rb.i1) {
        const radius = rb.width[i] * 1.5 + pad;
        const stride = Math.max(sparse, Math.round((radius * 0.5) / per));
        const fade = rb.path.fade[i];
        if (fade > 0.02) {
          lg.globalAlpha = clamp(((breathe * fade * (0.4 + 0.6 * Math.abs(rb.cosT[i])) * stride * per) / radius) * 0.9, 0, 1);
          lg.drawImage(glowSprite, rb.x[i] - radius, rb.y[i] - radius, radius * 2, radius * 2);
        }
        i += stride;
      }
    });
    lg.globalAlpha = 1;
    drawLights(lg, 0.7);
    lg.globalCompositeOperation = "source-over";
    g.globalCompositeOperation = "lighter";
    g.imageSmoothingEnabled = true;
    g.drawImage(low.canvas, 0, 0, low.canvas.width * LOW, low.canvas.height * LOW);
  };

  const drawThreads = (g: Ctx) => {
    g.lineWidth = 0.75;
    const styles = ["rgba(255,236,190,0.42)", "rgba(255,186,104,0.36)", "rgba(232,112,62,0.3)"];
    for (const rb of ribbons) {
      for (let pass = 0; pass < 3; pass++) {
        g.strokeStyle = styles[pass];
        g.beginPath();
        for (let j = pass; j < rb.threads; j += 3) traceThread(g, rb, j, 2);
        if (rb.threads === 1 && pass > 0) traceThread(g, rb, 0, 2);
        g.stroke();
      }
    }
  };

  const drawShootingStar = (g: Ctx, s: ShootingStar) => {
    const opacity = Math.sin((s.age / s.life) * Math.PI) * 0.72;
    const tailX = s.x - Math.cos(s.angle) * s.length;
    const tailY = s.y - Math.sin(s.angle) * s.length;
    const gradient = g.createLinearGradient(s.x, s.y, tailX, tailY);
    gradient.addColorStop(0, `rgba(241,233,216,${opacity})`);
    gradient.addColorStop(0.38, `rgba(224,180,106,${opacity * 0.72})`);
    gradient.addColorStop(1, "rgba(224,180,106,0)");
    g.strokeStyle = gradient;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(s.x, s.y);
    g.lineTo(tailX, tailY);
    g.stroke();
    g.globalAlpha = opacity;
    g.drawImage(pale, s.x - 6, s.y - 6, 12, 12);
    g.globalAlpha = 1;
  };

  /** A reading figure: stars lit to progress, a gold thread through it when finished, veiled when sealed. */
  const drawFigure = (g: Ctx, c: CardInfo, fig: Figure, x: number, y: number, w: number, h: number, k: number, flip: boolean, trace: number) => {
    const at = (i: number) => {
      const s = fig.stars[i];
      return { x: x + s.x * w, y: flip ? y + (1 - s.y) * h : y + s.y * h };
    };
    if (c.kind === "locked") {
      // A veiled figure: a few pale stars under a low haze, no lines.
      g.globalAlpha = clamp(0.18 * k, 0, 1);
      for (let i = 0; i < Math.min(7, fig.stars.length); i++) {
        const p = at(i);
        g.drawImage(pale, p.x - 2.5, p.y - 2.5, 5, 5);
      }
      g.globalAlpha = clamp(0.22 * k, 0, 1);
      g.save();
      g.translate(x + w / 2, y + h * 0.55);
      g.scale(w * 0.5, h * 0.16);
      g.drawImage(halo, -1, -1, 2, 2);
      g.restore();
      g.globalAlpha = 1;
      return;
    }
    const upcoming = c.kind === "upcoming";
    const lit = upcoming ? 0 : litCount(c.read, c.finished, fig.stars.length);
    g.lineWidth = c.finished ? 1.3 : 0.8;
    if (upcoming) g.setLineDash([3, 4]);
    // Consecutive edges of the same brightness share one stroke.
    let style = "";
    fig.edges.forEach(([i, j], n) => {
      const a = at(i);
      const b = at(j);
      const on = i < lit && j < lit;
      const traced = n / fig.edges.length < trace;
      const next = `rgba(${GOLD},${clamp((c.finished ? 0.75 : on ? 0.5 : upcoming ? 0.22 : 0.16) * k + (traced ? 0.5 : 0), 0, 1)})`;
      if (next !== style) {
        if (style) g.stroke();
        style = next;
        g.strokeStyle = next;
        g.beginPath();
      }
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
    });
    if (style) g.stroke();
    g.setLineDash([]);
    fig.stars.forEach((_, i) => {
      const p = at(i);
      if (i < lit) {
        const s = (c.finished ? 11 : 9) * (0.85 + 0.15 * k);
        g.globalAlpha = clamp(0.85 * k, 0, 1);
        g.drawImage(gold, p.x - s / 2, p.y - s / 2, s, s);
      } else {
        g.globalAlpha = clamp((upcoming ? 0.3 : 0.4) * k, 0, 1);
        g.drawImage(pale, p.x - 2.5, p.y - 2.5, 5, 5);
      }
    });
    g.globalAlpha = 1;
  };

  const figureK = (c: CardInfo, t: number) => {
    const k = c.slug === attended ? 1.6 : 1;
    return chosen?.slug === c.slug && t - chosen.at < 6 ? Math.max(k, 1.5) : k;
  };
  const traceOf = (c: CardInfo, t: number) => (chosen?.slug === c.slug ? (stillMode ? 1 : clamp((t - chosen.at - 0.5) / TRACE_S, 0, 1)) : 0);

  const drawSuspension = (g: Ctx, t: number) => {
    if (threadFade <= 0.01) return;
    const a: Vec = { x: 0, y: 0 };
    for (const th of threads) {
      const rb = ribbons[th.ribbon];
      if (!rb) continue;
      const by = th.by - scrollY;
      if (by < -60 || by > (L?.height ?? 0) + 260) continue;
      ribbonPoint(rb, th.index, a);
      if (th.hang !== null) {
        const hx = th.bx;
        const hy = th.hang - scrollY;
        if (th.tie) {
          g.strokeStyle = `rgba(255,214,150,${0.07 * threadFade})`;
          g.lineWidth = 0.5;
          g.beginPath();
          g.moveTo(a.x, a.y);
          g.quadraticCurveTo((a.x + hx) / 2, Math.max(a.y, hy) + 10, hx, hy);
          g.stroke();
        }
        g.globalAlpha = clamp(0.7 * threadFade * (th.card.slug === attended ? 1.3 : 1), 0, 1);
        g.drawImage(gold, hx - 4, hy - 4, 8, 8);
        g.globalAlpha = 1;
        a.x = hx;
        a.y = hy;
      }
      const span = Math.hypot(th.bx - a.x, by - a.y);
      const sag = threadSag(span, th.tension.x, by - a.y);
      const c = th.card;
      const read = c.kind === "open" ? (c.read ?? 0) : 0;
      const k = (c.slug === attended ? 1.5 : 1) * (1 + th.tension.x * 0.8) * threadFade;
      const alpha = clamp((c.kind === "upcoming" ? 0.24 : c.kind === "locked" ? 0.3 : 0.26 + 0.55 * read) * k, 0, 1);
      const grad = g.createLinearGradient(a.x, a.y, th.bx, by);
      const fadeAt = clamp(1 - THREAD_FADE_PX / Math.max(1, span), 0, 1);
      grad.addColorStop(0, `rgba(255,214,150,${alpha * 0.7})`);
      grad.addColorStop(fadeAt, `rgba(255,226,170,${alpha})`);
      grad.addColorStop(1, `rgba(255,226,170,${c.kind === "locked" ? alpha * 0.6 : 0})`);
      g.strokeStyle = grad;
      g.lineWidth = c.kind === "open" ? 0.6 + 0.9 * read : 0.7;
      if (c.kind === "upcoming") g.setLineDash([4, 5]);
      g.beginPath();
      for (let n = 0; n <= 14; n++) {
        threadPoint(a.x, a.y, th.bx, by, sag, n / 14, pt);
        if (n === 0) g.moveTo(pt.x, pt.y);
        else g.lineTo(pt.x, pt.y);
      }
      g.stroke();
      g.setLineDash([]);
      if (c.kind === "locked") {
        // A cut thread frays into loose strands.
        g.strokeStyle = `rgba(255,214,150,${alpha * 0.5})`;
        for (const dx of [-5, 0, 6]) {
          g.beginPath();
          g.moveTo(th.bx, by);
          g.quadraticCurveTo(th.bx + dx * 0.4, by + 5, th.bx + dx, by + 9 + Math.abs(dx) * 0.3);
          g.stroke();
        }
      }
      const bt = (t - th.bead) / 0.8;
      if (bt >= 0 && bt <= 1 && !stillMode) {
        threadPoint(a.x, a.y, th.bx, by, sag, bt, pt);
        g.globalAlpha = Math.sin(bt * Math.PI) * threadFade;
        g.drawImage(pale, pt.x - 5, pt.y - 5, 10, 10);
        g.globalAlpha = 1;
      }
    }
  };

  /**
   * Behind page text the live sky's own light is erased, then a soft dark plate covers the static
   * stars too, so no bright point ever sits under a line of type. Both are filled into a 1/SHADE mask
   * and stretched back with smoothing, so the shading falls off softly; they stay inside the shell,
   * clear of the screen-edge ribbons.
   */
  const shadeText = (g: Ctx, s: PageSnapshot, H: number) => {
    if (!shadeMask) return;
    const hits = [s.windows.stageHit, s.windows.midHit];
    const rects = s.holes.filter((r) => !hits.includes(r) && r.y - scrollY + r.h > -24 && r.y - scrollY < H + 24);
    const m = shadeMask.g;
    const mw = shadeMask.canvas.width;
    const mh = shadeMask.canvas.height;
    const left = s.shell.x;
    const right = s.shell.x + s.shell.w;
    const passes: [GlobalCompositeOperation, typeof ERASE, Rect[]][] = [
      ["destination-out", ERASE, rects],
      // The plates sit only behind the hero's text, where the sky is open around it.
      ["source-over", PLATE, rects.filter((r) => r.y < s.topBand.h)],
    ];
    g.imageSmoothingEnabled = true;
    for (const [op, steps, list] of passes) {
      if (!list.length) continue;
      m.setTransform(1, 0, 0, 1, 0, 0);
      m.clearRect(0, 0, mw, mh);
      m.setTransform(1 / SHADE, 0, 0, 1 / SHADE, 0, 0);
      for (const [pad, style] of steps) {
        m.fillStyle = style;
        for (const r of list) {
          const x0 = Math.max(left, r.x - pad);
          const x1 = Math.min(right, r.x + r.w + pad);
          if (x1 > x0) m.fillRect(x0, r.y - scrollY - pad, x1 - x0, r.h + pad * 2);
        }
      }
      g.globalCompositeOperation = op;
      g.drawImage(shadeMask.canvas, 0, 0, mw * SHADE, mh * SHADE);
    }
    g.globalCompositeOperation = "source-over";
  };

  const drawSky = (f: HubFrame, g: Ctx, t: number) => {
    if (!L) return;
    const W = f.width;
    const H = f.height;
    g.globalCompositeOperation = "lighter";
    const raw = f.staticY[0] ?? 0;
    const off = raw % period;
    for (const tw of twinkles) {
      let y = tw.y - off;
      if (y < -20) y += period;
      if (y > H + 20) continue;
      if (visibleCover(f.page, tw.x, y)) continue;
      g.globalAlpha = clamp(tw.base * (0.55 + 0.45 * Math.sin(t * tw.rate + tw.phase)), 0, 1);
      g.drawImage(flare, tw.x - tw.size / 2, y - tw.size / 2, tw.size, tw.size);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";

    // The star net: links ease to nothing at the cut-off; none at tier 1 and above.
    if (grid && f.tier === 0) {
      links = 0;
      linkR2 = L.linkDistance * L.linkDistance;
      forEachPairWithin(grid, nodes.x, nodes.y, nodes.count, L.linkDistance, collectLink);
      g.lineWidth = 0.6;
      for (let b = 0; b < 3; b++) {
        g.strokeStyle = `rgba(${GOLD},${0.06 + b * 0.07})`;
        g.beginPath();
        for (let n = 0; n < links; n++) {
          const kk = linkK[n];
          if (kk < b / 3 || kk >= (b + 1) / 3) continue;
          g.moveTo(nodes.x[linkA[n]], nodes.y[linkA[n]]);
          g.lineTo(nodes.x[linkB[n]], nodes.y[linkB[n]]);
        }
        g.stroke();
      }
    }
    for (let i = 0; i < nodes.count; i++) {
      const size = nodes.size[i] * (1 + nodes.flash[i] * 2.4);
      if (visibleCover(f.page, nodes.x[i], nodes.y[i])) continue;
      g.globalAlpha = clamp((nodes.alpha[i] * (0.7 + Math.sin(t * 0.9 + nodes.phase[i]) * 0.3) + nodes.flash[i]) * nodes.life[i], 0, 1);
      g.drawImage(gold, nodes.x[i] - size / 2, nodes.y[i] - size / 2, size, size);
    }
    g.globalAlpha = 1;

    for (const sf of skyFigures) {
      const y = sf.slot.y - raw;
      if (y + sf.slot.h < 0) continue;
      drawFigure(g, sf.card, sf.fig, sf.slot.x, y, sf.slot.w, sf.slot.h, figureK(sf.card, t), false, traceOf(sf.card, t));
    }

    if (!stillMode) for (const s of shootingStars) if (s.active) drawShootingStar(g, s);

    drawGlow(g, t, f.tier);
    drawThreads(g);
    g.globalCompositeOperation = "lighter";
    drawLights(g, 1);

    // Gold dust falling along the ribbons.
    const dustCount = Math.min(DUST_CAP, Math.round(L.maxDust * DUST_SHARE[f.tier]));
    for (let i = 0; i < dustCount; i++) {
      const rb = ribbons[dust.ribbon[i]];
      if (!rb || rb.i1 <= rb.i0) continue;
      const per = rb.path.length / (rb.path.n - 1);
      const fi = dust.d[i] / per;
      const j = Math.floor(fi);
      if (j < rb.i0 || j >= rb.i1 || rb.path.fade[j] < 0.5) continue;
      const q = fi - j;
      const a = dust.angle[i];
      const radius = (rb.width[j] * 0.6 + dust.orbit[i]) * Math.cos(a);
      const x = rb.x[j] + (rb.x[j + 1] - rb.x[j]) * q + rb.nx[j] * radius;
      const y = rb.y[j] + (rb.y[j + 1] - rb.y[j]) * q + rb.ny[j] * radius;
      const big = dust.size[i] > 5.5;
      const size = dust.size[i] * (big ? 2.4 : 1);
      const env = Math.min(1, dust.age[i] * 1.2) * (1 - smoothstep(dust.life[i] * 0.7, dust.life[i], dust.age[i]));
      g.globalAlpha = env * (0.42 + 0.58 * (Math.sin(a) * 0.5 + 0.5)) * (0.62 + 0.38 * Math.sin(t * 3.1 + dust.phase[i])) * 0.8;
      g.drawImage(big ? flare : i % 5 === 0 ? pale : gold, x - size / 2, y - size / 2, size, size);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";

    drawSuspension(g, t);

    g.globalCompositeOperation = "lighter";
    for (const ring of rings) {
      if (!ring.active || ring.plane !== "sky" || stillMode) continue;
      const q = ring.age / RING_LIFE_S;
      const size = ring.radius * (0.3 + q * 1.5) * 2;
      g.globalAlpha = (1 - q) * 0.72;
      g.drawImage(ringSprite, ring.x - size / 2, ring.y - size / 2, size, size);
    }
    if (lantern.intensity > 0.01 && !stillMode) {
      g.globalAlpha = lantern.intensity * 0.35;
      g.drawImage(halo, lantern.x - 60, lantern.y - 60, 120, 120);
      g.globalAlpha = lantern.intensity;
      g.drawImage(pale, lantern.x - 6, lantern.y - 6, 12, 12);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";

    // Opening (M10): the light unrolls from the zenith in one ramped sweep.
    if (!Number.isNaN(introAt) && !stillMode) {
      const u = (t - introAt) / INTRO_S;
      if (u >= 1) introAt = Number.NaN;
      else {
        const front = lerp(-H * 0.15, H + 220, 1 - (1 - u) * (1 - u));
        const fade = g.createLinearGradient(0, front - 220, 0, front);
        fade.addColorStop(0, "rgba(0,0,0,0)");
        fade.addColorStop(1, "rgba(0,0,0,1)");
        g.globalCompositeOperation = "destination-out";
        g.fillStyle = fade;
        g.fillRect(0, front - 220, W, 220);
        g.fillStyle = "#000";
        g.fillRect(0, front, W, Math.max(0, H - front));
        g.globalCompositeOperation = "source-over";
      }
    }
    shadeText(g, f.page, H);
  };

  /* ---------------------------------------------------------------- stage: the star pool */

  let poolCache: Surface | null = null;
  let poolKey = "";
  /** The falls' vertical gradients by landing height, rebuilt with the pool. */
  const fallGrads = new Map<number, CanvasGradient>();
  const fallPt: Vec = { x: 0, y: 0 };
  /** The three falls of light, as shares of the pool's radius from its centre. */
  const FALLS = [-0.46, 0, 0.46];
  const poolGeom = (f: HubFrame) => {
    const win = f.win.stage;
    const s = f.page;
    const w = win?.w ?? s.viewport.w;
    const h = win?.h ?? s.windows.stage.h;
    const bx = s.shell.x - (win?.x ?? 0);
    const phone = s.mode === "phone";
    return { w, h, cx: bx + s.shell.w / 2, cy: h * 0.6, rx: s.shell.w * (phone ? 0.47 : 0.36), ry: h * (phone ? 0.36 : 0.34) };
  };

  /** The box of figure i of n along the pool, bowed with the water's curve. */
  const poolFigureBox = (p: ReturnType<typeof poolGeom>, i: number, n: number): Rect => {
    const fw = (p.rx * 1.6) / Math.max(1, n);
    const bow = Math.pow((i + 0.5) / n - 0.5, 2) * p.ry * 0.5;
    return { x: p.cx - p.rx * 0.8 + i * fw + fw * 0.1, y: p.cy + p.ry * 0.12 - bow, w: fw * 0.8, h: p.ry * 0.5 };
  };

  const strokeEllipse = (g: Ctx, x: number, y: number, rx: number, ry: number, a0: number, a1: number) => {
    g.beginPath();
    g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, a0, a1);
    g.stroke();
  };

  const paintPool = (f: HubFrame, p: ReturnType<typeof poolGeom>) => {
    const dpr = Math.min(1.5, f.page.viewport.dpr);
    const key = `${p.w}x${p.h}@${dpr}:${p.cx}:${p.rx}`;
    if (key === poolKey && poolCache) return;
    poolKey = key;
    fallGrads.clear();
    if (poolCache) ctx.surfaces.release(poolCache);
    poolCache = make(p.w * dpr, p.h * dpr);
    const g = poolCache.g;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Deep still water, feathered into the sky at its edge.
    g.save();
    g.translate(p.cx, p.cy);
    g.scale(1, p.ry / p.rx);
    const water = g.createRadialGradient(0, 0, 0, 0, 0, p.rx * 1.12);
    water.addColorStop(0, "rgba(15,21,48,0.97)");
    water.addColorStop(0.55, "rgba(11,15,36,0.95)");
    water.addColorStop(0.82, "rgba(8,10,24,0.72)");
    water.addColorStop(1, "rgba(6,8,18,0)");
    g.fillStyle = water;
    g.beginPath();
    g.arc(0, 0, p.rx * 1.12, 0, TAU);
    g.fill();
    g.restore();
    // The sky caught on the far side of the water, and the near shore in shadow.
    g.save();
    g.beginPath();
    g.ellipse(p.cx, p.cy, p.rx * 0.97, p.ry * 0.97, 0, 0, TAU);
    g.clip();
    const sheen = g.createLinearGradient(0, p.cy - p.ry, 0, p.cy + p.ry);
    sheen.addColorStop(0, "rgba(86,92,150,0.3)");
    sheen.addColorStop(0.42, "rgba(60,66,120,0.06)");
    sheen.addColorStop(0.75, "rgba(3,4,10,0)");
    sheen.addColorStop(1, "rgba(3,4,10,0.45)");
    g.fillStyle = sheen;
    g.fillRect(p.cx - p.rx, p.cy - p.ry, p.rx * 2, p.ry * 2);
    const pr = createRng(ctx.seed ^ 0x9e37);
    for (let i = 0; i < 240; i++) {
      const a = pr() * TAU;
      const r = Math.sqrt(pr()) * 0.95;
      const x = p.cx + Math.cos(a) * r * p.rx;
      const y = p.cy + Math.sin(a) * r * p.ry;
      const far = 1 - (y - (p.cy - p.ry)) / (2 * p.ry);
      g.fillStyle = `rgba(255,240,214,${0.12 + pr() * 0.4 * (0.5 + far)})`;
      const s = pr() < 0.1 ? 1.7 : 1.1;
      g.fillRect(x, y, s, s * 0.8);
    }
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i++) {
      const x = p.cx + (pr() - 0.5) * p.rx * 1.5;
      const y = p.cy + (pr() - 0.6) * p.ry * 1.2;
      const s = 8 + pr() * 9;
      g.globalAlpha = 0.5 + pr() * 0.4;
      g.drawImage(flare, x - s / 2, y - s / 2, s, s);
    }
    g.restore();
    // Moonlit rim on the far shore, and a faint one on the near shore.
    const rim = g.createLinearGradient(p.cx - p.rx, 0, p.cx + p.rx, 0);
    rim.addColorStop(0, `rgba(${GOLD},0)`);
    rim.addColorStop(0.5, `rgba(${GOLD},0.62)`);
    rim.addColorStop(1, `rgba(${GOLD},0)`);
    g.strokeStyle = rim;
    g.lineWidth = 6;
    g.globalAlpha = 0.14;
    strokeEllipse(g, p.cx, p.cy, p.rx * 0.98, p.ry * 0.98, Math.PI * 1.04, Math.PI * 1.96);
    g.lineWidth = 3;
    g.globalAlpha = 0.16;
    strokeEllipse(g, p.cx, p.cy, p.rx * 0.98, p.ry * 0.98, Math.PI * 1.04, Math.PI * 1.96);
    g.lineWidth = 1;
    g.globalAlpha = 0.45;
    strokeEllipse(g, p.cx, p.cy, p.rx * 0.98, p.ry * 0.98, Math.PI * 1.04, Math.PI * 1.96);
    g.globalAlpha = 0.2;
    strokeEllipse(g, p.cx, p.cy, p.rx * 0.98, p.ry * 0.98, Math.PI * 0.12, Math.PI * 0.88);
    g.globalAlpha = 1;
  };

  const drawPool = (f: HubFrame, g: Ctx, t: number) => {
    const p = poolGeom(f);
    paintPool(f, p);
    if (!poolCache) return;
    g.drawImage(poolCache.canvas, 0, 0, p.w, p.h);
    g.globalCompositeOperation = "lighter";
    const flareK = stillMode ? 0 : clamp((t - flareAt) / 0.5, 0, 1) * (1 - clamp((t - flareAt - 0.5) / 1.2, 0, 1));
    if (flareK > 0) {
      g.globalAlpha = flareK * 0.6;
      g.save();
      g.translate(p.cx, p.cy);
      g.scale(1, p.ry / p.rx);
      g.drawImage(halo, -p.rx, -p.rx, p.rx * 2, p.rx * 2);
      g.restore();
    }
    if (!stillMode) {
      // A slow sheen crossing the water.
      const run = ((t * 0.045) % 1.4) - 0.2;
      g.globalAlpha = 0.1;
      g.save();
      g.translate(p.cx - p.rx + run * p.rx * 2, p.cy - p.ry * 0.35);
      g.scale(1, 0.18);
      g.drawImage(halo, -p.rx * 0.5, -p.rx * 0.5, p.rx, p.rx);
      g.restore();
    }
    g.globalAlpha = 1;
    // Three falls of light pouring into the pool: the side ones branch off the gutter ribbons at the
    // window's top edge and sweep in, the centre one drops straight down. Each is a few tapered silk
    // strands over a soft glow, fading in from the top and narrowing as it lands.
    const lean = ribbons.length ? ribbons[0].swirl.x * 18 : 0;
    const dx = f.win.stage?.x ?? 0;
    FALLS.forEach((share, n) => {
      const x = p.cx + share * p.rx + lean;
      const land = p.cy - p.ry * 0.32 + Math.abs(share) * p.ry * 0.2;
      const sx = share === 0 || !fallFrom ? x : clamp((share < 0 ? fallFrom[0] : fallFrom[1]) - dx, 0, p.w);
      // Most of the sideways run is spent while the fall is still faint near the top, so the visible
      // part drops into the water rather than streaking across it.
      const cx = lerp(sx, x, 0.85);
      const cy = land * 0.1;
      let grad = fallGrads.get(land);
      if (!grad) {
        grad = g.createLinearGradient(0, 0, 0, land);
        grad.addColorStop(0, "rgba(255,226,170,0)");
        grad.addColorStop(clamp(40 / Math.max(1, land), 0.05, 0.6), "rgba(255,226,170,0.3)");
        grad.addColorStop(1, "rgba(255,240,206,0.6)");
        fallGrads.set(land, grad);
      }
      const at = (u: number) => {
        const v = 1 - u;
        fallPt.x = v * v * sx + 2 * v * u * cx + u * u * x;
        fallPt.y = 2 * v * u * cy + u * u * land;
        return fallPt;
      };
      // The soft glow under the strands.
      for (let k = 1; k <= 10; k++) {
        const u = k / 10;
        const q = at(u);
        const r = lerp(16, 9, u);
        g.globalAlpha = 0.16 * smoothstep(0, 40, q.y);
        g.drawImage(glowSprite, q.x - r, q.y - r, r * 2, r * 2);
      }
      g.globalAlpha = 1;
      g.strokeStyle = grad;
      g.lineWidth = 0.75;
      g.beginPath();
      for (let k = 0; k < 5; k++) {
        const o = (k - 2) / 2;
        for (let j = 0; j <= 16; j++) {
          const u = j / 16;
          const q = at(u);
          const wob = stillMode ? 0 : Math.sin(u * 7 + t * (1.1 + k * 0.3) + n * 2 + k) * 1.2 * (1 - u);
          const px = q.x + o * lerp(7, 1.4, u) + wob;
          if (j === 0) g.moveTo(px, q.y);
          else g.lineTo(px, q.y);
        }
      }
      g.stroke();
      const shimmer = stillMode ? 0.85 : 0.75 + 0.25 * Math.sin(t * 2.2 + n * 1.7);
      g.globalAlpha = 0.85 * shimmer;
      g.save();
      g.translate(x, land);
      g.scale(1, 0.3);
      g.drawImage(halo, -46, -46, 92, 92);
      g.restore();
      // Moonlight on water: broken glints below each landing.
      g.fillStyle = "rgba(255,218,160,0.9)";
      for (let k = 0; k < 7; k++) {
        const y = land + 6 + k * p.ry * 0.085;
        const wave = stillMode ? 0.5 : Math.sin(t * 1.8 + k * 1.3 + n) * 0.5 + 0.5;
        const w = (11 - k * 1.3) * (0.5 + 0.6 * wave);
        g.globalAlpha = 0.34 * (1 - k / 7) * (0.6 + 0.4 * wave);
        g.fillRect(x - w / 2 + Math.sin(k * 2.3 + n) * 2.5, y, w, 0.9);
      }
      // A slow ring opening from each landing.
      const q = stillMode ? 0.45 : (t * 0.28 + n * 0.33) % 1;
      g.globalAlpha = (1 - q) * 0.4;
      g.strokeStyle = `rgba(${GOLD},0.9)`;
      g.lineWidth = 1;
      const r = 8 + q * p.rx * 0.34;
      strokeEllipse(g, x, land + 2, r, r * 0.26, 0, TAU);
      g.globalAlpha = 1;
    });
    // Every card's figure, reflected in the pool and lit to progress.
    cards.forEach((c, i) => {
      const fig = figures.get(c.slug);
      if (!fig) return;
      const b = poolFigureBox(p, i, cards.length);
      drawFigure(g, c, fig, b.x, b.y, b.w, b.h, figureK(c, t), true, traceOf(c, t));
    });
    g.globalCompositeOperation = "lighter";
    // Ripples on the water: rings flattened onto the surface.
    g.strokeStyle = "rgba(255,226,170,0.9)";
    g.lineWidth = 1.2;
    const ripple = (x: number, y: number, r: number, a: number) => {
      g.globalAlpha = a;
      strokeEllipse(g, x, y, r, r * (p.ry / p.rx) * 0.8, 0, TAU);
    };
    for (const ring of rings) {
      if (!ring.active || ring.plane !== "stage" || stillMode) continue;
      const q = ring.age / RIPPLE_LIFE_S;
      for (const lag of [0, 0.14, 0.28]) if (q > lag) ripple(ring.x, ring.y, ring.radius * (q - lag) * 1.3, (1 - q) * 0.75);
    }
    if (stillMode && frozenRing) {
      ripple(frozenRing.x, frozenRing.y, p.rx * 0.32, 0.65);
      ripple(frozenRing.x, frozenRing.y, p.rx * 0.2, 0.4);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  };

  /* ---------------------------------------------------------------- ground: the horizon */

  let groundCache: Surface | null = null;
  let reflSrc: Surface | null = null;
  let groundKey = "";
  const groundGeom = (f: HubFrame) => {
    const win = f.win.ground;
    const s = f.page;
    const w = win?.w ?? s.viewport.w;
    const h = win?.h ?? s.windows.ground.h;
    const hz = L ? L.horizon - s.windows.ground.y : h * 0.4;
    return { w, h, hz, dx: win?.x ?? 0 };
  };

  const paintGround = (f: HubFrame, gm: ReturnType<typeof groundGeom>) => {
    const dpr = Math.min(1.5, f.page.viewport.dpr);
    const key = `${gm.w}x${gm.h}@${dpr}:${gm.hz}`;
    if (key === groundKey && groundCache) return;
    groundKey = key;
    if (groundCache) ctx.surfaces.release(groundCache);
    if (reflSrc) ctx.surfaces.release(reflSrc);
    groundCache = make(gm.w * dpr, gm.h * dpr);
    reflSrc = make(Math.ceil(gm.w / 2), Math.ceil(Math.max(8, gm.hz) / 2));
    const g = groundCache.g;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { w, h, hz } = gm;
    const sky = g.createLinearGradient(0, hz - 140, 0, hz);
    sky.addColorStop(0, "rgba(40,30,44,0)");
    sky.addColorStop(1, "rgba(70,52,52,0.55)");
    g.fillStyle = sky;
    g.fillRect(0, hz - 140, w, 140);
    const ridge = (base: number, amp: number, seed: number, color: string) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, hz + 1);
      for (let x = 0; x <= w + 8; x += 8) g.lineTo(x, base - Math.abs(fbm2D(noise, x * 0.0041 + seed, seed * 0.27, 4)) * amp);
      g.lineTo(w, hz + 1);
      g.closePath();
      g.fill();
    };
    ridge(hz, Math.min(64, hz * 0.45), 2.6, "rgba(30,26,40,0.9)");
    ridge(hz, Math.min(36, hz * 0.26), 7.1, "rgba(12,11,20,0.98)");
    const water = g.createLinearGradient(0, hz, 0, h);
    water.addColorStop(0, "#0e0c16");
    water.addColorStop(0.35, "#080812");
    water.addColorStop(1, "#04050b");
    g.fillStyle = water;
    g.fillRect(0, hz, w, h - hz);
    // The sky's stars caught faintly on the water, dimming with depth.
    const wr = createRng(ctx.seed ^ 0x5eed);
    const count = Math.round(clamp((w * (h - hz)) / 2400, 20, 260));
    for (let i = 0; i < count; i++) {
      const y = hz + 4 + wr() * (h - hz - 4);
      const depth = (y - hz) / Math.max(1, h - hz);
      g.fillStyle = `rgba(255,240,214,${(0.08 + wr() * 0.06) * (1 - depth * 0.8)})`;
      g.fillRect(wr() * w, y, 1.4 + wr() * 1.2, 0.8);
    }
    const line = g.createLinearGradient(0, 0, w, 0);
    line.addColorStop(0, "rgba(255,206,142,0)");
    line.addColorStop(0.5, "rgba(255,206,142,0.4)");
    line.addColorStop(1, "rgba(255,206,142,0)");
    g.fillStyle = line;
    g.fillRect(0, hz, w, 1);
  };

  const drawGround = (f: HubFrame, g: Ctx, t: number) => {
    if (!L) return;
    const gm = groundGeom(f);
    paintGround(f, gm);
    if (!groundCache || !reflSrc) return;
    const { w, h, hz } = gm;
    g.drawImage(groundCache.canvas, 0, 0, w, h);
    const win = f.win.ground;
    if (!win) return;
    // The reflection source: the ribbons' last fall above the horizon, unfaded, at half size.
    const rs = reflSrc.g;
    const rh = reflSrc.canvas.height;
    rs.setTransform(1, 0, 0, 1, 0, 0);
    rs.clearRect(0, 0, reflSrc.canvas.width, rh);
    rs.setTransform(0.5, 0, 0, 0.5, 0, 0);
    rs.globalCompositeOperation = "lighter";
    rs.lineCap = "round";
    for (const rb of ribbons) {
      rs.strokeStyle = "rgba(255,196,120,0.24)";
      rs.lineWidth = Math.max(2, rb.halfAvg * 0.36);
      rs.beginPath();
      let pen = false;
      for (let i = rb.i0; i <= rb.i1; i++) {
        const y = rb.y[i] - win.y;
        if (y < hz - rh * 2 || y > hz) continue;
        if (!pen) rs.moveTo(rb.x[i] - win.x, y);
        else rs.lineTo(rb.x[i] - win.x, y);
        pen = true;
      }
      rs.stroke();
    }
    rs.globalCompositeOperation = "source-over";
    // Mirror it below the horizon, row by row, with a ripple that a tap or a pulse kicks.
    const rows = Math.min(Math.ceil((h - hz) / 2), rh);
    const amp = 1.1 + reflectKick * 2;
    g.globalCompositeOperation = "lighter";
    for (let n = 0; n < rows; n++) {
      const r = reflectionRow(n, rows, rh);
      const dx = (stillMode ? Math.sin(n * 0.9) : Math.sin(n * 0.5 + t * 1.7)) * amp * (1 + n * 0.06);
      g.globalAlpha = r.alpha * 0.8 * (0.55 + 0.45 * Math.sin(n * 1.7 + (stillMode ? 0 : t * 0.9)));
      g.drawImage(reflSrc.canvas, 0, rh - 1 - r.src, reflSrc.canvas.width, 1, dx, hz + n * 2, w, 2);
    }
    // Pools of light where the ribbons end, and mist along the horizon.
    for (const rb of ribbons) {
      const end = rb.path.n - 1;
      if (Math.abs(rb.path.y[end] - L.horizon) > 2) continue;
      const x = rb.path.x[end] - win.x;
      const size = Math.max(110, rb.spec.width * 5) * (1 + (stillMode ? 0 : Math.sin(t * 0.9 + x) * 0.06));
      g.globalAlpha = 0.6 + reflectKick * 0.3;
      g.save();
      g.translate(x, hz);
      g.scale(1, 0.24);
      g.drawImage(halo, -size / 2, -size / 2, size, size);
      g.restore();
    }
    const mistW = Math.max(w, 800);
    const mh = Math.min(70, hz * 0.6);
    const a1 = stillMode ? 0 : (t * 6) % mistW;
    const a2 = stillMode ? 0 : (t * 4.2) % mistW;
    g.globalCompositeOperation = "source-over";
    const [mistA, mistB] = mist;
    if (mistA) {
      g.globalAlpha = 0.42;
      g.drawImage(mistA, -a1, hz - mh * 0.6, mistW, mh);
      g.drawImage(mistA, mistW - a1, hz - mh * 0.6, mistW, mh);
    }
    if (mistB) {
      g.globalAlpha = 0.3;
      g.drawImage(mistB, a2 - mistW, hz - mh * 0.4, mistW, mh * 0.9);
      g.drawImage(mistB, a2, hz - mh * 0.4, mistW, mh * 0.9);
    }
    g.globalCompositeOperation = "lighter";
    for (const ring of rings) {
      if (!ring.active || ring.plane !== "ground" || stillMode) continue;
      const q = ring.age / RING_LIFE_S;
      const size = ring.radius * (0.3 + q * 1.5) * 2;
      g.globalAlpha = (1 - q) * 0.7;
      g.save();
      g.translate(ring.x, Math.max(ring.y, hz + 6));
      g.scale(1, 0.22);
      g.drawImage(ringSprite, -size / 2, -size / 2, size, size);
      g.restore();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  };

  /* ---------------------------------------------------------------- mid: the loom */

  const drawLoom = (f: HubFrame, g: Ctx, t: number) => {
    const win = f.win.mid;
    if (!win) return;
    const s = f.page;
    loom.layout(win.w, win.h, s.shell.x - win.x, s.shell.w, Math.min(1.5, s.viewport.dpr), cards);
    // The left ribbon's resting point beside the loom's top beam feeds the weft.
    const top = win.y + scrollY + win.h * 0.13;
    let fx = Number.NaN;
    let fy = Number.NaN;
    for (const rb of ribbons.slice(0, 2)) {
      let best = 80;
      let bi = -1;
      for (let i = 0; i < rb.path.n; i++) {
        const dd = Math.abs(rb.path.y[i] - top);
        if (rb.path.fade[i] > 0.5 && dd < best) {
          best = dd;
          bi = i;
        }
      }
      if (bi >= 0 && !(rb.path.x[bi] - win.x >= fx)) {
        fx = rb.path.x[bi] - win.x;
        fy = rb.path.y[bi] - win.y - scrollY;
      }
    }
    loom.feedFrom(fx, fy);
    loom.draw(g, t, stillMode);
  };

  /* ---------------------------------------------------------------- output */

  const writeLight = (t: number) => {
    for (const [slug, st] of glow) {
      const delta = st.value - st.written;
      if (delta === 0) continue;
      // Rises go out at once (the output slews them); falls go out in coarse steps, and exactly at rest.
      const resting = st.value === (slug === attended ? ATTENDED_GLOW : 0);
      if (delta > 0 ? delta < 1 / 32 || t - st.at < 0.066 : !resting && (-delta < GLOW_FALL_STEP || t - st.at < GLOW_FALL_S)) continue;
      st.at = t;
      st.written = st.value;
      ctx.out.card(slug, { "w-glow": st.value });
    }
    const fall = lightWritten - lightValue;
    if (fall < 0 || (fall > 0 && (lightValue === 0 || (fall >= GLOW_FALL_STEP && t - lightAt >= GLOW_FALL_S)))) {
      lightWritten = lightValue;
      lightAt = t;
      ctx.out.root({ "w-light": lightValue });
    }
  };

  /* ---------------------------------------------------------------- hooks */

  const drawAll = (f: HubFrame, g: HubContexts) => {
    lastFrame = f;
    scrollY = f.scrollY;
    stillMode = f.still;
    compose(f);
    if (!stillMode) step(f);
    else {
      threadFade = 1;
      updateRibbons(f, simTime);
    }
    wrapSky(f);
    drawSky(f, g.live, simTime);
    if (g.stage) drawPool(f, g.stage, simTime);
    if (g.mid) drawLoom(f, g.mid, simTime);
    if (g.ground) drawGround(f, g.ground, simTime);
  };

  /** The composed reduced-motion and paused frame: everything at rest, the reading map included. */
  const reducedMotionFrame = (f: HubFrame, g: HubContexts) => {
    drawAll(f, g);
    const cardVars: Record<string, { "w-glow": number }> = {};
    for (const c of cards) cardVars[c.slug] = { "w-glow": c.slug === attended ? ATTENDED_GLOW : 0 };
    ctx.out.still({ "w-light": 0 }, cardVars);
  };

  return {
    resize(f) {
      lastFrame = f;
      scrollY = f.scrollY;
      compose(f);
      const lw = Math.ceil(f.width / LOW);
      const lh = Math.ceil(f.height / LOW);
      if (!low || low.canvas.width !== lw || low.canvas.height !== lh) {
        if (low) ctx.surfaces.release(low);
        low = make(lw, lh);
      }
      const sw = Math.ceil(f.width / SHADE) + 1;
      const sh = Math.ceil(f.height / SHADE) + 1;
      if (!shadeMask || shadeMask.canvas.width !== sw || shadeMask.canvas.height !== sh) {
        if (shadeMask) ctx.surfaces.release(shadeMask);
        shadeMask = make(sw, sh);
      }
      paintSky(f);
      const tk = `${Math.ceil(f.width)}x${period}`;
      if (tk !== twinkleKey) {
        twinkleKey = tk;
        seedTwinkles(f.width, period);
      }
    },
    layout(f) {
      lastFrame = f;
      scrollY = f.scrollY;
      compose(f);
    },
    render(f, g) {
      drawAll(f, g);
      writeLight(simTime);
    },
    still: reducedMotionFrame,
    onPointer(p) {
      const tappable = TAPPABLE.has(p.zone);
      lantern.mouse = p.type === "mouse";
      if (lantern.mouse) {
        lantern.on = tappable && p.active;
        if (p.x !== lantern.x || p.y !== lantern.y) lantern.movedAt = simTime;
      } else if (tappable && (p.tap || p.press)) {
        lantern.on = true;
        lantern.lingerUntil = simTime + TOUCH_LINGER_S;
      } else if (!tappable) lantern.on = false;
      if (p.tap && tappable && lastFrame) onTap(lastFrame, p);
    },
    onEvent(e: SceneEvent) {
      const f = lastFrame;
      switch (e.name) {
        case "hub:attention":
          attended = e.detail.slug;
          if (attended) {
            lastAttended = attended;
            const th = threads.find((x) => x.card.slug === attended);
            if (th) th.bead = simTime;
            ctx.out.beat(attended, "tug");
          }
          break;
        case "hub:stage":
          if (!f) break;
          if (e.detail.window === "mid") loom.shuttle(accentOf(lastAttended), simTime);
          else if (e.detail.action === "tap") stageTap(f, e.detail.x, e.detail.y);
          else swirl(e.detail.action === "left" ? -1 : 1);
          break;
        case "hub:pick":
          if (e.detail.slug) {
            chosen = { slug: e.detail.slug, at: simTime };
            flareAt = simTime;
            const at = f ? figureOnScreen(f, e.detail.slug) : null;
            if (at) launchStarTo(at.x, at.y);
          }
          break;
        case "hub:press": {
          const th = threads.find((x) => x.card.slug === e.detail.slug);
          if (th) th.tension.v += 9;
          break;
        }
        default:
          break;
      }
    },
    intro() {
      introPending = true;
    },
    windowHz(name, tier) {
      if (name === "stage") return tier === 0 ? 30 : tier === 1 ? 20 : 15;
      if (name === "mid") return tier < 2 ? 30 : 0;
      return tier === 0 ? 30 : tier === 1 ? 20 : 0;
    },
    dispose() {
      lastFrame = null;
      loom.dispose();
      // The star plane is this theme's own canvas: free its backing store while the theme is away.
      const sky = planes.statics[0].canvas;
      sky.width = 0;
      sky.height = 0;
      ribbons = [];
      threads = [];
      skyFigures = [];
      figures = new Map();
      glow.clear();
      low = null;
      shadeMask = null;
      poolCache = null;
      groundCache = null;
      reflSrc = null;
    },
  };
}
