// "Fireflies by the canal" (spec 3.5): the hub's firefly world on the scene kit.
//
// Planes: a sky of stars and the real-phase moon, and the lamphu trees in the real gutters
// (a canopy plane over the top band and one column per gutter), all moved by the kit's
// compositor transforms; fireflies live on the sky canvas. The stage window is the near
// jetty with the lowest branch and the long-tail boat, the mid window the far bank where
// every novel is a stilt house, the ground window the reeds and dark water under the
// footer. The page side goes only through ctx.out. Geometry lives in firefly-core.ts,
// firefly-tree.ts and firefly-bank.ts, flash timing in firefly-sync.ts.

import { createNoise2D, createRng } from "../_shared/scene-runtime";
import { bankLayout, bankSteps, boatX, lampColour, PROFILE_STEP, rippleOffset, type Bank } from "./firefly-bank";
import {
  computeLayout,
  crossingOrder,
  frontCoord,
  frontSpan,
  SKY_PARALLAX,
  TOP,
  TREE_PARALLAX,
  WAVE_AXIS,
  windowBox,
  type FireflyLayout,
  type WindowBox,
} from "./firefly-core";
import {
  advanceDriver,
  boostCoupling,
  CHORUS_BEATS,
  CHORUS_S,
  configureGrid,
  createDriver,
  createFlashField,
  createRhythm,
  createWave,
  DRIVER_HOLD_PERIODS,
  flashIntensity,
  rhythmTap,
  seedFirefly,
  smoothstep as smooth,
  stepField,
  sweepBetween,
  waveRunning,
  type Driver,
  type FlashField,
  type WaveFront,
} from "./firefly-sync";
import { buildTree, MID_PALETTE, NEAR_PALETTE, pickWeighted, STAGE_PALETTE, treeSteps, unionBox, type Box, type PaintTarget, type Scratch, type TreeEnv, type TreeGeom } from "./firefly-tree";
import { radialSprite } from "./scene-paint";
import { collectPlanes, createHubScene, staticDpr } from "./world/kit";
import type { CardInfo, Ctx, HubBuildContext, HubFrame, HubPlanes, HubPointer, HubSceneHandle, HubSceneHooks, HubSceneOptions, PageSnapshot, SceneEvent, Surface, Tier, WindowName } from "./world/types";

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** One entry per canvas[data-sky-static], in DOM order: sky, left column, right column, canopy. */
const STATICS = [{ parallax: SKY_PARALLAX }, { parallax: TREE_PARALLAX }, { parallax: TREE_PARALLAX }, { parallax: TREE_PARALLAX }];
const SKY = 0;
const COL_L = 1;
const COL_R = 2;
const CANOPY = 3;
/** Firefly statics are painted at DPR 1 (spec 8.4 item 32). */
const PLANE_DPR = 1;

const CALL_SIZE = 16;
const PERCH_SIZE = 5;
const STAGE_CAP = 56;
const MID_CAP = 56;
const GROUND_CAP = 22;
const SWELL_GAP_S = 2;
/** A perch is let go this long after attention leaves its card. */
const PERCH_RELEASE_S = 1.2;
const SCROLL_TAKEOFF = 300;
/** Polite announcement when the reader's taps lock the rhythm (spec 3.5 M4); once per page visit. */
const RHYTHM_TEXT = "หิ่งห้อยกะพริบตามคุณแล้ว";
let rhythmAnnounced = false;
/** Where the jetty starts along the stage box (0..1). */
const JETTY_AT = 0.66;

export function mount(root: HTMLElement, options: HubSceneOptions = {}): HubSceneHandle | null {
  const planes = collectPlanes(root, STATICS);
  if (!planes) return null;
  return createHubScene("firefly", planes, (ctx) => build(ctx, planes), options);
}

/* ------------------------------------------------------------------ populations */

/** A set of fireflies on one plane: the flash field plus where each one lives and flies. */
interface Pop {
  field: FlashField;
  /** 0 on a perch (tree, branch, bank), 1 drifting over a band or the water. */
  kind: Uint8Array;
  homeX: Float32Array;
  homeY: Float32Array;
  edge: Float32Array;
  size: Float32Array;
  bright: Float32Array;
  /** Brightness in the still frame (the lit outline). */
  calm: Float32Array;
  /** A faint glow kept between flashes (a dense cluster stays readable). */
  floor: Float32Array;
  roll: Float32Array;
  wA: Float32Array;
  wF1: Float32Array;
  wF2: Float32Array;
  wP1: Float32Array;
  wP2: Float32Array;
  /** Attraction: target, timing and whether the target is in document px (a card edge). */
  tx: Float32Array;
  ty: Float32Array;
  tDoc: Uint8Array;
  aStart: Float64Array;
  aArrive: Float64Array;
  aEnd: Float64Array;
  /** Handed to a DOM perch: not drawn. */
  hidden: Uint8Array;
  /** Where it was drawn last (canvas px of its plane). */
  x: Float32Array;
  y: Float32Array;
}

function createPop(capacity: number, rand: () => number): Pop {
  const f = () => new Float32Array(capacity);
  const pop: Pop = {
    field: createFlashField(capacity),
    kind: new Uint8Array(capacity),
    homeX: f(),
    homeY: f(),
    edge: f(),
    size: f(),
    bright: f(),
    calm: f(),
    floor: f(),
    roll: f(),
    wA: f(),
    wF1: f(),
    wF2: f(),
    wP1: f(),
    wP2: f(),
    tx: f(),
    ty: f(),
    tDoc: new Uint8Array(capacity),
    aStart: new Float64Array(capacity).fill(-1),
    aArrive: new Float64Array(capacity).fill(-1),
    aEnd: new Float64Array(capacity).fill(-10),
    hidden: new Uint8Array(capacity),
    x: f(),
    y: f(),
  };
  for (let i = 0; i < capacity; i++) {
    seedFirefly(pop.field, i, rand);
    pop.roll[i] = rand();
    pop.wF1[i] = 0.15 + rand() * 0.35;
    pop.wF2[i] = 0.12 + rand() * 0.3;
    pop.wP1[i] = rand() * TAU;
    pop.wP2[i] = rand() * TAU;
  }
  return pop;
}

/** How far a firefly has been pulled toward its attraction target (0..1). */
function attraction(pop: Pop, i: number, t: number): number {
  if (!(t > pop.aStart[i] && t < pop.aEnd[i] + 2.2)) return 0;
  return smooth(pop.aStart[i], pop.aArrive[i], t) * (1 - smooth(pop.aEnd[i], pop.aEnd[i] + 2.2, t));
}

const busy = (pop: Pop, i: number, t: number) => pop.hidden[i] === 1 || t < pop.aEnd[i] + 2.2;

/** The `count` nearest free, live fireflies to (x, y), by last drawn position. */
function nearestFree(pop: Pop, x: number, y: number, t: number, count: number): number[] {
  const near: { i: number; d: number }[] = [];
  for (let i = 0; i < pop.field.count; i++) {
    if (busy(pop, i, t) || !pop.field.live[i]) continue;
    near.push({ i, d: Math.hypot(pop.x[i] - x, pop.y[i] - y) });
  }
  near.sort((a, b) => a.d - b.d);
  return near.slice(0, count).map((n) => n.i);
}

/** Sends the `count` nearest free fireflies (by last drawn position) to a loose swarm around (x, y). */
function callSwarm(pop: Pop, x: number, y: number, t: number, count: number, spread: number, reach: number, hover: number): number[] {
  const near: { i: number; d: number }[] = [];
  for (let i = 0; i < pop.field.count; i++) {
    if (busy(pop, i, t) || !pop.field.live[i]) continue;
    const d = Math.hypot(pop.x[i] - x, pop.y[i] - y);
    if (d < reach) near.push({ i, d });
  }
  near.sort((a, b) => a.d - b.d);
  const chosen = near.slice(0, count);
  chosen.forEach(({ i, d }, c) => {
    const ang = Math.random() * TAU;
    const rr = Math.sqrt(Math.random());
    pop.tx[i] = x + Math.cos(ang) * rr * spread;
    pop.ty[i] = y + Math.sin(ang) * rr * spread * 0.65;
    pop.tDoc[i] = 0;
    pop.aStart[i] = t + 0.1 + c * 0.03;
    pop.aArrive[i] = pop.aStart[i] + 0.9 + (d / reach) * 1.0;
    pop.aEnd[i] = pop.aArrive[i] + hover + Math.random() * 3;
    const field = pop.field;
    // The cascade answers once the swarm has arrived, nearest first.
    const arrived = pop.aArrive[i] + 0.12;
    field.respondAt[i] = Math.max(arrived, t + 1.2) + (c / Math.max(1, chosen.length - 1)) * 0.9;
    field.active[i] = 1;
    field.boutEnd[i] = Math.max(field.boutEnd[i], pop.aEnd[i]);
  });
  return chosen.map((c) => c.i);
}

/* ------------------------------------------------------------------ sprites */

function fireflyStops(rgb: string): [number, string][] {
  return [
    [0, "rgba(255,255,244,1)"],
    [0.05, "rgba(248,255,226,1)"],
    [0.1, `rgba(${rgb},0.76)`],
    [0.19, `rgba(${rgb},0.36)`],
    [0.32, `rgba(${rgb},0.13)`],
    [0.55, `rgba(${rgb},0.035)`],
    [1, `rgba(${rgb},0)`],
  ];
}

interface Sprites {
  ff: HTMLCanvasElement[];
  bokeh: HTMLCanvasElement;
  call: HTMLCanvasElement;
  ring: HTMLCanvasElement;
  warm: HTMLCanvasElement;
  soft: HTMLCanvasElement;
}

function makeSprites(create: (w: number, h: number) => Surface): Sprites {
  return {
    ff: [radialSprite(64, fireflyStops("214,255,110"), create), radialSprite(64, fireflyStops("150,255,150"), create), radialSprite(64, fireflyStops("255,214,120"), create)],
    bokeh: radialSprite(64, [[0, "rgba(225,255,170,0.3)"], [0.5, "rgba(205,255,140,0.22)"], [0.8, "rgba(180,240,120,0.1)"], [1, "rgba(160,230,110,0)"]], create),
    call: radialSprite(64, [[0, "rgba(255,255,250,1)"], [0.05, "rgba(245,255,225,1)"], [0.12, "rgba(215,255,150,0.5)"], [0.3, "rgba(160,235,120,0.13)"], [1, "rgba(90,200,120,0)"]], create),
    ring: radialSprite(96, [[0, "rgba(190,255,150,0)"], [0.6, "rgba(190,255,150,0)"], [0.8, "rgba(210,255,170,0.45)"], [0.9, "rgba(190,255,150,0.14)"], [1, "rgba(190,255,150,0)"]], create),
    warm: radialSprite(64, [[0, "rgba(255,226,170,1)"], [0.12, "rgba(255,190,110,0.55)"], [0.4, "rgba(255,150,70,0.12)"], [1, "rgba(255,120,60,0)"]], create),
    soft: radialSprite(32, [[0, "rgba(255,255,255,1)"], [1, "rgba(255,255,255,0)"]], create),
  };
}

/* ------------------------------------------------------------------ sky painting */

/** The moon with its real phase: 0 new, 0.5 full; waxing is lit on the right. */
function paintMoon(g: CanvasRenderingContext2D, mx: number, my: number, R: number, phase: number, seed: number): void {
  const lit = (1 - Math.cos(phase * TAU)) / 2;
  const halo = 0.35 + 0.65 * lit;
  const ring = g.createRadialGradient(mx, my, R * 2.6, mx, my, R * 4.6);
  ring.addColorStop(0, "rgba(170,200,230,0)");
  ring.addColorStop(0.45, `rgba(175,205,235,${(0.05 * halo).toFixed(3)})`);
  ring.addColorStop(1, "rgba(170,200,230,0)");
  g.fillStyle = ring;
  g.fillRect(mx - R * 5, my - R * 5, R * 10, R * 10);
  const glow = g.createRadialGradient(mx, my, R * 0.9, mx, my, R * 3.4);
  glow.addColorStop(0, `rgba(215,230,245,${(0.36 * halo).toFixed(3)})`);
  glow.addColorStop(0.3, `rgba(170,200,230,${(0.12 * halo).toFixed(3)})`);
  glow.addColorStop(1, "rgba(140,175,215,0)");
  g.fillStyle = glow;
  g.fillRect(mx - R * 3.6, my - R * 3.6, R * 7.2, R * 7.2);
  const sky = g.createRadialGradient(mx, my, R, mx, my, R * 16);
  sky.addColorStop(0, `rgba(90,130,180,${(0.08 * halo).toFixed(3)})`);
  sky.addColorStop(1, "rgba(90,130,180,0)");
  g.fillStyle = sky;
  g.fillRect(mx - R * 16, my - R * 16, R * 32, R * 32);
  // Earthshine on the dark limb.
  g.fillStyle = "rgba(40,56,76,0.55)";
  g.beginPath();
  g.arc(mx, my, R, 0, TAU);
  g.fill();
  if (lit < 0.02) return;
  const c = Math.cos(phase * TAU);
  const side = phase < 0.5 ? 1 : -1;
  g.save();
  g.translate(mx, my);
  g.scale(side, 1);
  g.beginPath();
  g.arc(0, 0, R, -Math.PI / 2, Math.PI / 2, false);
  // The terminator: an ellipse on the lit side for a crescent, on the dark side for a gibbous moon.
  g.ellipse(0, 0, R * Math.abs(c), R, 0, Math.PI / 2, -Math.PI / 2, c > 0);
  g.closePath();
  const disc = g.createRadialGradient(-R * 0.25, -R * 0.25, R * 0.1, 0, 0, R);
  disc.addColorStop(0, "#f4f8fc");
  disc.addColorStop(0.7, "#dde7f1");
  disc.addColorStop(1, "#b8c8d9");
  g.fillStyle = disc;
  g.fill();
  g.clip();
  const rng = createRng(seed + 3);
  g.fillStyle = "#8e9fb5";
  for (let n = 0; n < 7; n++) {
    const a = rng() * TAU;
    const d = rng() * R * 0.6;
    g.globalAlpha = 0.1 + rng() * 0.08;
    g.beginPath();
    g.arc(Math.cos(a) * d, Math.sin(a) * d, R * (0.18 + rng() * 0.25), 0, TAU);
    g.fill();
  }
  g.restore();
  g.globalAlpha = 1;
}

/** Stars, a faint band of sky glow and the moon, on transparency over the CSS sky gradient. */
function paintSky(g: CanvasRenderingContext2D, L: FireflyLayout, moonPhase: number, seed: number, soft: HTMLCanvasElement): void {
  const W = L.width + L.side * 2;
  const H = L.skyH;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  g.setTransform(PLANE_DPR, 0, 0, PLANE_DPR, L.side * PLANE_DPR, TOP * PLANE_DPR);
  // A faint milky band across the upper sky.
  const band = createRng(seed + 9);
  for (let k = 0; k < 9; k++) {
    const t = k / 8;
    const bx = lerp(-L.width * 0.1, L.width * 1.1, t);
    const by = lerp(L.height * 0.55, -L.height * 0.05, t) + (band() - 0.5) * 40;
    const r = Math.min(L.width, L.height) * (0.18 + band() * 0.12);
    const rg = g.createRadialGradient(bx, by, 0, bx, by, r);
    rg.addColorStop(0, "rgba(120,150,200,0.05)");
    rg.addColorStop(1, "rgba(120,150,200,0)");
    g.fillStyle = rg;
    g.fillRect(bx - r, by - r, r * 2, r * 2);
  }
  const srng = createRng(seed + 1);
  const temps = ["#a9c3ff", "#cddcff", "#f4f6ff", "#fff3dc", "#ffd7a6"];
  const count = Math.round((W * H) / 760);
  const M = L.moon;
  for (let n = 0; n < count; n++) {
    const x = srng() * W - L.side;
    const y = srng() * H - TOP;
    const b = Math.pow(srng(), 3.2);
    const fade = M.r > 0 ? clamp(Math.hypot(x - M.x, y - M.y) / (M.r * 9), 0.08, 1) : 1;
    const alpha = (0.14 + 0.86 * b) * fade * (y < L.height ? 1 : 0.8);
    const tr = srng();
    if (alpha < 0.03) continue;
    g.globalAlpha = alpha;
    g.fillStyle = temps[tr < 0.12 ? 0 : tr < 0.35 ? 1 : tr < 0.72 ? 2 : tr < 0.92 ? 3 : 4];
    const sz = 0.5 + b * 1.1;
    g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    if (b > 0.8) {
      g.globalAlpha = alpha * 0.3;
      const gr = 2 + b * 3.5;
      g.drawImage(soft, x - gr, y - gr, gr * 2, gr * 2);
    }
  }
  g.globalAlpha = 1;
  if (M.r > 0) paintMoon(g, M.x, M.y, M.r, moonPhase, seed);
}

/* ------------------------------------------------------------------ reeds */

interface Reeds {
  n: number;
  x: Float32Array;
  h: Float32Array;
  w: Float32Array;
  lean: Float32Array;
  stiff: Float32Array;
  phase: Float32Array;
  freq: Float32Array;
  group: Uint8Array;
}

function buildReeds(box: WindowBox, height: number, scale: number, seed: number): Reeds {
  const rng = createRng(seed + 41);
  const target = Math.round(clamp(box.w / 5, 60, 320));
  const xs: number[] = [];
  const hs: number[] = [];
  for (let n = 0; n < target * 4 && xs.length < target; n++) {
    const x = rng() * box.w;
    // Dense in the gutters and the corners, low and sparse behind the footer text.
    const inner = x > box.boxX + box.boxW * 0.12 && x < box.boxX + box.boxW * 0.88;
    const e = Math.abs(x / box.w - 0.5) * 2;
    const corner = Math.pow(clamp((e - 0.3) / 0.7, 0, 1), 1.2);
    if (rng() > (inner ? 0.12 : 0.35) + corner * 0.65) continue;
    xs.push(x);
    hs.push(height * (inner ? 0.18 + 0.3 * corner : 0.35 + 0.65 * corner) * (0.45 + 0.55 * rng()) + 6 * scale);
  }
  const n = xs.length;
  const reeds: Reeds = {
    n,
    x: Float32Array.from(xs),
    h: Float32Array.from(hs),
    w: new Float32Array(n),
    lean: new Float32Array(n),
    stiff: new Float32Array(n),
    phase: new Float32Array(n),
    freq: new Float32Array(n),
    group: new Uint8Array(n),
  };
  for (let k = 0; k < n; k++) {
    reeds.w[k] = (1.1 + rng() * 1.8) * Math.max(0.7, scale);
    const side = reeds.x[k] < box.w / 2 ? -1 : 1;
    reeds.lean[k] = side * (0.05 + rng() * 0.2) + (rng() - 0.5) * 0.25;
    reeds.stiff[k] = 0.7 + rng() * 0.6;
    reeds.phase[k] = rng() * TAU;
    reeds.freq[k] = 0.5 + rng() * 0.6;
    reeds.group[k] = rng() < 0.45 ? 0 : 1;
  }
  return reeds;
}

/* ------------------------------------------------------------------ the scene */

interface PlaneRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface WindowState {
  box: WindowBox;
  /** Window rect in document px (shell width). */
  doc: { x: number; y: number; w: number; h: number };
}

interface PerchState {
  slug: string;
  members: number[];
  landAt: number;
  id: number;
  /** Scene time at which it lets go, or Infinity while attention stays. */
  releaseAt: number;
  u: number;
}

interface Ring {
  plane: "sky" | WindowName;
  x: number;
  y: number;
  t: number;
  /** In document px (rings on windows are window px and need no conversion). */
  doc: boolean;
}

function build(ctx: HubBuildContext, planes: HubPlanes): HubSceneHooks {
  const { out, page, surfaces, paint } = ctx;
  const create = (w: number, h: number) => surfaces.create(w, h);
  const rand = createRng(ctx.seed);
  const noise = createNoise2D(ctx.seed + 5);
  const sprites = makeSprites(create);
  const statics = planes.statics.map((p) => p.canvas);
  const sctx = statics.map((c) => c.getContext("2d"));

  const sky = createPop(420 + 48, rand);
  const stage = createPop(STAGE_CAP, rand);
  const mid = createPop(MID_CAP, rand);
  const ground = createPop(GROUND_CAP, rand);
  const pops: Record<"sky" | WindowName, Pop> = { sky, stage, mid, ground };

  let L: FireflyLayout | null = null;
  let trees: TreeGeom[] = [];
  let treeKey = "";
  let skyKey = "";
  const planeRects: PlaneRect[] = [];
  let treeFF = 0;
  let driftFF = 0;
  let treeOf = new Int16Array(sky.field.capacity);

  const wins: Record<WindowName, WindowState | null> = { stage: null, mid: null, ground: null };
  const winKeys: Record<WindowName, string> = { stage: "", mid: "", ground: "" };
  let stageArt: Surface | null = null;
  let stageGeom: TreeGeom | null = null;
  let bank: Bank | null = null;
  let bankArt: Surface | null = null;
  let mirror: Surface | null = null;
  let groundWater: Surface | null = null;
  let reeds: Reeds | null = null;
  const jobScratch = new Map<string, Surface[]>();

  // Pointer parallax (fine pointer only), smoothed in -0.5..0.5.
  let parX = 0;
  let parY = 0;
  // Wind for reeds and ripples.
  let gustX = Infinity;
  let gustSpeed = 0;
  let gustWidth = 1;
  let gustStrength = 0;
  let nextGustAt = 3;
  let wind = 0;

  // Chorus waves, the reader's rhythm and the opening.
  let wave: WaveFront | null = null;
  let waveCross = new Set<string>();
  let wavePeaked = false;
  let nextWaveAt = -1;
  let pickSlug: string | null = null;
  let breathAt = -10;
  let driver: Driver | null = null;
  let driverDoc = { x: 0, y: 0 };
  let driverUntil = -1;
  let chorusUntil = -1;
  let rhythm = createRhythm();
  let introPending = false;
  let introAt = -10;

  // Attention, perches and card light.
  let attendSlug: string | null = null;
  let perch: PerchState | null = null;
  const swellAt = new Map<string, number>();
  const glowNow = new Map<string, number>();
  const glowSent = new Map<string, number>();
  const rings: Ring[] = [];

  // The boat at the jetty: position along the stage box (0..1) and velocity.
  let boatPos = 0.42;
  let boatVel = 0;
  const wakes: { x: number; t: number; dir: number }[] = [];
  let lastWakeAt = -1;

  // Still-mode state: shown at once, never queued for later (spec 3.5, M3-M5).
  let stillGathered = false;
  let stillBeats = 0;
  let stillSync = false;
  let wasStill = false;

  /* ---------------- layout ---------------- */

  const treeEnv = (lay: FireflyLayout): TreeEnv => ({
    width: lay.width,
    height: lay.treeBottom,
    waterY: lay.waterY,
    moonX: lay.moon.x,
    moonY: lay.moon.y,
    scale: lay.scale,
    gutterL: lay.gutterL,
    gutterR: lay.gutterR,
    side: lay.side,
    top: TOP,
  });

  const setBox = (canvas: HTMLCanvasElement, r: PlaneRect) => {
    const w = Math.max(1, Math.ceil(r.w * PLANE_DPR));
    const h = Math.max(1, Math.ceil(r.h * PLANE_DPR));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const st = canvas.style;
    st.left = `${r.x}px`;
    st.top = `${r.y}px`;
    st.width = `${r.w}px`;
    st.height = `${r.h}px`;
  };

  const releaseScratch = (key: string) => {
    for (const s of jobScratch.get(key) ?? []) surfaces.release(s);
    jobScratch.delete(key);
  };

  const makeScratch = (key: string, boxes: Box[], dpr: number): Scratch => {
    releaseScratch(key);
    let w = 1;
    let h = 1;
    for (const b of boxes) {
      w = Math.max(w, Math.ceil(b.w * dpr));
      h = Math.max(h, Math.ceil(b.h * dpr));
    }
    const list = [create(w, h), create(w, h), create(w, h)];
    jobScratch.set(key, list);
    return { T: list[0], F: list[1], R: list[2] };
  };

  /**
   * Recomposes the tree planes when the gutters, mode or plane height changed. Each crown
   * is grown in its own paint step (spec 5.6: no long task during the build); the planes
   * and the tree fireflies keep the previous crowns until the new set is complete.
   */
  const layoutTrees = (lay: FireflyLayout) => {
    const key = [lay.mode, lay.width, lay.height, lay.gutterL, lay.gutterR, lay.treeBottom, lay.side].join(":");
    if (key === treeKey) return;
    treeKey = key;
    const env = treeEnv(lay);
    const specs = [...lay.trees].sort((a, b) => Number(a.near) - Number(b.near));
    const built: TreeGeom[] = [];
    paint.run(
      "trees",
      specs.map((spec) => () => {
        built.push(buildTree(spec, env));
      }),
      () => applyTrees(lay, built),
    );
  };

  const applyTrees = (lay: FireflyLayout, built: TreeGeom[]) => {
    trees = built;
    // The canopy canvas holds every crown that starts near the top; columns take the rest.
    let cut = lay.canopyCut;
    for (const t of trees) if (t.spec.top < lay.height * 0.2) cut = Math.max(cut, t.box.y + t.box.h + 2);
    cut = Math.round(clamp(cut, lay.height * 0.08, lay.treeBottom - 8));
    let left: Box | null = null;
    let right: Box | null = null;
    for (const t of trees) {
      const parts = [t.box.y + t.box.h > cut ? t.box : null, t.trunkBox && t.trunkBox.y + t.trunkBox.h > cut ? t.trunkBox : null];
      for (const b of parts) {
        if (!b) continue;
        if (t.spec.baseX < lay.width / 2) left = unionBox(left, b);
        else right = unionBox(right, b);
      }
    }
    const bottom = lay.treeBottom + 16;
    const colL: PlaneRect = { x: -lay.side, y: cut, w: Math.max(8, Math.min(lay.width / 2, (left ? left.x + left.w : 0) + 6) + lay.side), h: bottom - cut };
    const rx = Math.max(lay.width / 2, (right ? right.x : lay.width) - 6);
    const colR: PlaneRect = { x: rx, y: cut, w: Math.max(8, lay.width + lay.side - rx), h: bottom - cut };
    const canopy: PlaneRect = { x: -lay.side, y: -TOP, w: lay.width + lay.side * 2, h: cut + TOP };
    planeRects[COL_L] = colL;
    planeRects[COL_R] = colR;
    planeRects[CANOPY] = canopy;
    setBox(statics[COL_L], colL);
    setBox(statics[COL_R], colR);
    setBox(statics[CANOPY], canopy);
    placeTreeFireflies(L ?? lay);

    const targets: PaintTarget[] = [];
    for (const i of [COL_L, COL_R, CANOPY]) {
      const g = sctx[i];
      if (!g) continue;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, statics[i].width, statics[i].height);
      targets.push({ g, ...planeRects[i] });
    }
    const scratch = makeScratch("trees", trees.map((t) => t.box), PLANE_DPR);
    const steps = trees.flatMap((t) => treeSteps(t, t.spec.near ? NEAR_PALETTE : MID_PALETTE, targets, scratch, PLANE_DPR, lay.scale));
    paint.run("tree-art", steps, () => releaseScratch("trees"));
  };

  const layoutSky = (lay: FireflyLayout) => {
    const key = [lay.width, lay.skyH, lay.side, lay.moon.x, lay.moon.y, lay.moon.r].join(":");
    if (key === skyKey) return;
    skyKey = key;
    const r: PlaneRect = { x: -lay.side, y: -TOP, w: lay.width + lay.side * 2, h: lay.skyH };
    planeRects[SKY] = r;
    setBox(statics[SKY], r);
    const g = sctx[SKY];
    if (g) paint.run("sky", [() => paintSky(g, lay, ctx.moonPhase, ctx.seed, sprites.soft)]);
  };

  /** Tree fireflies take perches on the crowns (plane px); drifters take spots over the bands (document px). */
  const placeTreeFireflies = (lay: FireflyLayout) => {
    // No crowns yet (the first set is still growing): drifters only.
    treeFF = trees.length > 0 ? lay.counts.tree : 0;
    driftFF = lay.counts.drift;
    sky.field.count = treeFF + driftFF;
    let shareSum = 0;
    for (const t of trees) shareSum += t.spec.fireflyShare;
    const s = Math.max(0.7, lay.scale);
    if (treeOf.length < sky.field.capacity) treeOf = new Int16Array(sky.field.capacity);
    for (let i = 0; i < treeFF; i++) {
      const target = sky.roll[i] * shareSum;
      let acc = 0;
      let k = 0;
      for (; k < trees.length - 1; k++) {
        acc += trees[k].spec.fireflyShare;
        if (target < acc) break;
      }
      treeOf[i] = k;
      const t = trees[k];
      const n = t ? pickWeighted(t.perchCdf, ((i * 7919 + 13) % 10007) / 10007) : 0;
      sky.kind[i] = 0;
      sky.homeX[i] = t ? t.perches[n * 2] : 0;
      sky.homeY[i] = t ? t.perches[n * 2 + 1] : 0;
      sky.edge[i] = t ? t.perchEdge[n] : 0;
      const sr = (sky.roll[i] * 7.31) % 1;
      const near = t?.spec.near ?? true;
      sky.size[i] = (near ? 12 + sr * sr * 15 : 8 + sr * 5) * s;
      sky.bright[i] = near ? 0.8 + sr * 0.2 : 0.65 + sr * 0.2;
      sky.wA[i] = (near ? 2 + sr * 4 : 1.2 + sr * 2) * lay.scale;
      sky.calm[i] = sky.roll[i] < 0.78 ? 0.12 + 0.62 * sky.edge[i] * (0.7 + 0.3 * sr) : 0;
      sky.floor[i] = near && sr > 0.55 ? 0.04 : 0;
    }
    placeDrifters(lay);
  };

  const placeDrifters = (lay: FireflyLayout) => {
    const snapshot = page.getSnapshot();
    const bands = snapshot.bands.filter((b) => b.h > 12);
    const total = bands.reduce((a, b) => a + b.h, 0);
    const s = Math.max(0.7, lay.scale);
    for (let j = 0; j < driftFF; j++) {
      const i = treeFF + j;
      sky.kind[i] = 1;
      treeOf[i] = -1;
      const u = sky.roll[i] * total;
      let acc = 0;
      let band = bands[0];
      for (const b of bands) {
        acc += b.h;
        band = b;
        if (u <= acc) break;
      }
      const sr = (sky.roll[i] * 13.7) % 1;
      if (band) {
        sky.homeX[i] = band.x + ((sky.roll[i] * 97.1) % 1) * band.w;
        sky.homeY[i] = band.y + band.h * (0.25 + 0.5 * ((sky.roll[i] * 31.3) % 1));
      } else {
        sky.homeX[i] = ((sky.roll[i] * 97.1) % 1) * lay.width;
        sky.homeY[i] = lay.height * 0.5;
      }
      sky.size[i] = (14 + sr * 10) * s;
      sky.bright[i] = 0.7 + sr * 0.25;
      sky.wA[i] = Math.min(10, (band?.h ?? 40) * 0.22);
      sky.calm[i] = sky.roll[i] < 0.4 ? 0.45 : 0;
      sky.floor[i] = 0.05;
    }
  };

  /* ---------------- windows ---------------- */

  const winDoc = (snapshot: PageSnapshot, name: WindowName) => snapshot.windows[name];

  /** Window px of a document point inside a window. */
  const toWindow = (name: WindowName, x: number, yDoc: number) => {
    const w = wins[name];
    if (!w) return null;
    return { x: x - (w.doc.x - w.box.boxX), y: yDoc - w.doc.y };
  };

  const surfaceFor = (old: Surface | null, w: number, h: number): Surface => {
    const bw = Math.max(1, Math.ceil(w));
    const bh = Math.max(1, Math.ceil(h));
    if (old && old.canvas.width === bw && old.canvas.height === bh) return old;
    if (old) surfaces.release(old);
    return create(bw, bh);
  };

  const lanterns = (snapshot: PageSnapshot) =>
    snapshot.cards.filter((c) => c.kind === "open" && ((c.read ?? 0) > 0 || c.finished)).map((c) => ({ accent: c.accent, glow: c.finished ? 1 : 0.35 + 0.65 * (c.read ?? 0) }));

  const layoutStage = (snapshot: PageSnapshot, lay: FireflyLayout) => {
    const box = windowBox(snapshot, "stage");
    const sd = staticDpr(snapshot.viewport);
    const hold = lanterns(snapshot);
    const key = [box.w, box.h, box.boxX, box.boxW, sd, lay.mode, JSON.stringify(hold)].join(":");
    wins.stage = { box, doc: winDoc(snapshot, "stage") };
    if (key === winKeys.stage || box.h < 8) return;
    winKeys.stage = key;
    const art = (stageArt = surfaceFor(stageArt, box.w * sd, box.h * sd));
    const phone = lay.mode === "phone";
    const waterY = box.h * (lay.mode === "landscape-short" ? 0.62 : 0.68);
    // The lowest lamphu branch enters from the left edge and droops toward the water. Its
    // crown stays inside the canvas and is feathered out before the left and top edges, so
    // no straight cut shows where the window meets the sky.
    const x1 = box.boxX + box.boxW * (phone ? 0.46 : 0.3);
    const x0 = -Math.max(12, x1 * 0.06);
    const spec = {
      x0,
      x1,
      top: box.h * 0.05,
      bottom: box.h * (phone ? 0.6 : 0.64),
      belly: 0.4,
      baseX: x0 - 14,
      baseY: box.h * 0.3,
      forkX: x0 + (x1 - x0) * 0.24,
      forkY: box.h * 0.26,
      near: true,
      rooted: false,
      seed: 61,
      fireflyShare: 1,
      sprays: phone ? 7 : 11,
      ragged: 0.34,
      density: 2.6,
    };
    const env: TreeEnv = { width: box.w, height: box.h, waterY, moonX: box.w * 0.8, moonY: -box.h, scale: lay.scale, gutterL: 0, gutterR: 0, side: 0, top: 0 };
    stageGeom = buildTree(spec, env);
    placeStage(lay, waterY);
    const scratch = makeScratch("stage", [stageGeom.box], sd);
    const target: PaintTarget = { g: art.g, x: 0, y: 0, w: box.w, h: box.h };
    const feather = { left: Math.max(24, x1 * 0.22), top: box.h * 0.24 };
    const steps = [
      () => {
        paintStageWater(art.g, box, sd, waterY, lay.scale, hold);
        featherSides(art.g, box, sd);
      },
      ...treeSteps(stageGeom, STAGE_PALETTE, [target], scratch, sd, lay.scale, feather),
    ];
    paint.run("stage", steps, () => releaseScratch("stage"));
  };

  /** The water strip, the jetty with its lamp and one hanging lantern per novel in progress. */
  const paintStageWater = (g: Ctx, box: WindowBox, dpr: number, waterY: number, scale: number, hold: { accent: string; glow: number }[]) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = Math.max(0.6, scale);
    const W = box.w;
    const H = box.h;
    const water = g.createLinearGradient(0, waterY - 8, 0, H);
    water.addColorStop(0, "rgba(10,30,42,0)");
    water.addColorStop(0.12, "rgba(10,30,42,0.9)");
    water.addColorStop(0.45, "#06131c");
    water.addColorStop(0.78, "rgba(4,11,17,0.7)");
    water.addColorStop(1, "rgba(4,11,17,0)");
    g.fillStyle = water;
    g.fillRect(0, waterY - 8, W, H - waterY + 8);
    g.fillStyle = "rgba(150,195,215,0.12)";
    g.fillRect(0, waterY, W, 1);
    // A low far bank behind the water, so the strip reads as a canal.
    const rng = createRng(ctx.seed + 71);
    g.fillStyle = "#0b1d28";
    g.beginPath();
    g.moveTo(0, waterY + 0.5);
    for (let x = 0; x <= W + 6; x += 6) g.lineTo(x, waterY - (2 + 4 * Math.abs(noise(x * 0.01, 3)) + (rng() < 0.08 ? 6 : 0)) * s);
    g.lineTo(W, waterY + 0.5);
    g.closePath();
    g.fill();
    // The jetty: posts into the water and a plank deck reaching in from the right.
    const jx = box.boxX + box.boxW * JETTY_AT;
    const jEnd = Math.min(W + 4, box.boxX + box.boxW + Math.min(24 * s, (W - box.boxX - box.boxW) * 0.5));
    const deckY = waterY - 10 * s;
    g.fillStyle = "#120b06";
    g.fillRect(jx, deckY, jEnd - jx, 4 * s);
    g.fillStyle = "#3a2516";
    g.fillRect(jx, deckY, jEnd - jx, 1.2 * s);
    g.fillStyle = "#0d0805";
    const postH = (H - deckY) * 0.7;
    for (let px = jx + 4 * s; px < jEnd - 2; px += 26 * s) g.fillRect(px, deckY, 3 * s, postH);
    // Lamp post and its lantern at the head of the jetty.
    const lx = jx + 10 * s;
    const top = Math.max(6 * s, deckY - H * 0.46);
    g.fillRect(lx - 1.5 * s, top, 3 * s, deckY - top);
    g.fillRect(lx - 1.5 * s, top, 14 * s, 2 * s);
    g.fillStyle = "#ffd48f";
    g.fillRect(lx + 9 * s, top + 3 * s, 5 * s, 7 * s);
    // Hanging lanterns along the rail: one per novel in progress, warmer the further read.
    const span = Math.max(40, jEnd - jx - 40 * s);
    hold.forEach((l, k) => {
      const x = jx + 34 * s + (span * (k + 0.5)) / Math.max(1, hold.length);
      const y = deckY - 14 * s;
      g.strokeStyle = "rgba(20,12,6,0.9)";
      g.lineWidth = Math.max(0.8, s);
      g.beginPath();
      g.moveTo(x, deckY);
      g.lineTo(x, y - 4 * s);
      g.stroke();
      g.fillStyle = lampColour(l.accent, 0.5 + 0.5 * l.glow);
      g.beginPath();
      g.ellipse(x, y, 3 * s, 4 * s, 0, 0, TAU);
      g.fill();
      g.globalAlpha = 0.35 + 0.5 * l.glow;
      const gr = 16 * s;
      g.drawImage(sprites.warm, x - gr, y - gr, gr * 2, gr * 2);
      // Its reflection: a short warm column on the water.
      const rg = g.createLinearGradient(0, waterY, 0, waterY + (H - waterY) * 0.9);
      rg.addColorStop(0, lampColour(l.accent, 0.3 * l.glow));
      rg.addColorStop(1, lampColour(l.accent, 0));
      g.globalAlpha = 1;
      g.fillStyle = rg;
      g.fillRect(x - 2.5 * s, waterY + 2, 5 * s, (H - waterY) * 0.9);
    });
    // The jetty lamp's own reflection.
    const rg = g.createLinearGradient(0, waterY, 0, H);
    rg.addColorStop(0, "rgba(255,200,120,0.32)");
    rg.addColorStop(1, "rgba(255,170,90,0)");
    g.fillStyle = rg;
    g.fillRect(lx + 8 * s, waterY + 2, 7 * s, H - waterY - 2);
  };

  /**
   * Fades a window's water and bank out over the gutters (destination-in), so the near lamphu
   * trees standing in the gutters stay in front of the far bank and the canal strip.
   */
  const featherSides = (g: Ctx, box: WindowBox, dpr: number) => {
    const W = box.w;
    const l1 = Math.max(0, box.boxX - 8);
    const r0 = Math.min(W, box.boxX + box.boxW + 8);
    if (W <= 0 || (l1 <= 0 && r0 >= W)) return;
    const stops: [number, number][] = [];
    if (l1 > 0) stops.push([0, 0], [Math.max(0, l1 - 48) / W, 0], [l1 / W, 1]);
    else stops.push([0, 1]);
    if (r0 < W) stops.push([r0 / W, 1], [Math.min(W, r0 + 48) / W, 0], [1, 0]);
    else stops.push([1, 1]);
    g.save();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = "destination-in";
    const lg = g.createLinearGradient(0, 0, W, 0);
    for (const [at, a] of stops) lg.addColorStop(at, `rgba(0,0,0,${a})`);
    g.fillStyle = lg;
    g.fillRect(0, 0, W, g.canvas.height / dpr);
    g.restore();
  };

  const placeStage = (lay: FireflyLayout, waterY: number) => {
    const w = wins.stage;
    if (!w || !stageGeom) return;
    const s = Math.max(0.7, lay.scale);
    const n = lay.mode === "phone" || lay.mode === "landscape-short" ? 30 : 46;
    stage.field.count = Math.min(STAGE_CAP, n + 6);
    for (let i = 0; i < stage.field.count; i++) {
      if (i < n) {
        const k = pickWeighted(stageGeom.perchCdf, ((i * 4111 + 7) % 9973) / 9973);
        stage.kind[i] = 0;
        stage.homeX[i] = stageGeom.perches[k * 2];
        stage.homeY[i] = stageGeom.perches[k * 2 + 1];
        stage.edge[i] = stageGeom.perchEdge[k];
        stage.size[i] = (12 + stage.roll[i] * 12) * s;
        stage.bright[i] = 0.8 + stage.roll[i] * 0.2;
        stage.wA[i] = (1.5 + stage.roll[i] * 3) * lay.scale;
        stage.calm[i] = stage.roll[i] < 0.8 ? 0.25 + 0.55 * stage.edge[i] : 0;
        stage.floor[i] = 0.08 + 0.1 * stage.edge[i];
      } else {
        stage.kind[i] = 1;
        stage.homeX[i] = w.box.boxX + w.box.boxW * (0.15 + 0.7 * ((stage.roll[i] * 17.3) % 1));
        stage.homeY[i] = waterY - (8 + 18 * ((stage.roll[i] * 7.7) % 1)) * s;
        stage.size[i] = 14 * s;
        stage.bright[i] = 0.75;
        stage.wA[i] = 9 * s;
        stage.calm[i] = stage.roll[i] < 0.5 ? 0.4 : 0;
        stage.floor[i] = 0.05;
      }
    }
    configureGrid(stage.field, w.box.w, w.box.h, 80);
  };

  const layoutMid = (snapshot: PageSnapshot, lay: FireflyLayout) => {
    const box = windowBox(snapshot, "mid");
    const sd = staticDpr(snapshot.viewport);
    const cards = snapshot.cards.map((c) => `${c.slug}:${c.kind}:${c.read ?? "-"}:${c.finished ? 1 : 0}`).join("|");
    const key = [box.w, box.h, box.boxX, box.boxW, sd, lay.mode, cards].join(":");
    wins.mid = { box, doc: winDoc(snapshot, "mid") };
    if (key === winKeys.mid || box.h < 8) return;
    winKeys.mid = key;
    const b = (bank = bankLayout(snapshot.cards, box, lay.scale, ctx.seed, lay.mode));
    const artH = b.waterY + 6;
    const art = (bankArt = surfaceFor(bankArt, box.w * sd, artH * sd));
    const riverH = Math.max(1, box.h - b.waterY);
    const mir = (mirror = surfaceFor(mirror, box.w, riverH));
    placeMid(lay);
    paint.run("mid", [
      ...bankSteps(b, art.g, sd, mir.g, 1, art.canvas, sprites.warm),
      () => {
        featherSides(art.g, box, sd);
        featherSides(mir.g, box, 1);
      },
    ]);
  };

  const placeMid = (lay: FireflyLayout) => {
    if (!bank) return;
    const b = bank;
    const s = Math.max(0.6, lay.scale);
    const n = Math.min(MID_CAP, Math.round(clamp(b.w / 26, 20, MID_CAP)));
    mid.field.count = n;
    for (let i = 0; i < n; i++) {
      const x = ((mid.roll[i] * 53.7 + i / n) % 1) * b.w;
      const k = clamp(Math.round(x / PROFILE_STEP), 0, b.profile.length - 1);
      mid.kind[i] = 0;
      mid.homeX[i] = x;
      mid.homeY[i] = b.waterY - b.profile[k] * (0.4 + 0.9 * ((mid.roll[i] * 9.1) % 1)) - 3 * s;
      mid.size[i] = (8 + mid.roll[i] * 7) * s;
      mid.floor[i] = mid.roll[i] > 0.6 ? 0.06 : 0;
      mid.bright[i] = 0.65 + mid.roll[i] * 0.3;
      mid.wA[i] = 1.2 * s;
      mid.calm[i] = mid.roll[i] < 0.55 ? 0.3 + 0.4 * mid.roll[i] : 0;
    }
    configureGrid(mid.field, b.w, b.h, 70);
  };

  const layoutGround = (snapshot: PageSnapshot, lay: FireflyLayout) => {
    const box = windowBox(snapshot, "ground");
    const key = [box.w, box.h, box.boxX, box.boxW].join(":");
    wins.ground = { box, doc: winDoc(snapshot, "ground") };
    if (key === winKeys.ground || box.h < 8) return;
    winKeys.ground = key;
    const waterTop = box.h * 0.4;
    reeds = buildReeds(box, box.h * 0.42, lay.scale, ctx.seed);
    const strip = (groundWater = surfaceFor(groundWater, 4, Math.max(1, box.h - waterTop)));
    paint.run("ground", [
      () => {
        const g = strip.g;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, 4, strip.canvas.height);
        const lg = g.createLinearGradient(0, 0, 0, strip.canvas.height);
        lg.addColorStop(0, "rgba(14,38,50,0)");
        lg.addColorStop(0.08, "rgba(12,32,44,0.85)");
        lg.addColorStop(0.45, "#06121a");
        lg.addColorStop(1, "#03080c");
        g.fillStyle = lg;
        g.fillRect(0, 0, 4, strip.canvas.height);
      },
    ]);
    const s = Math.max(0.6, lay.scale);
    const n = Math.min(GROUND_CAP, Math.round(clamp(box.w / 70, 8, GROUND_CAP)));
    ground.field.count = n;
    for (let i = 0; i < n; i++) {
      const sideRoll = (ground.roll[i] * 11.3) % 1;
      const inner = box.boxX + box.boxW * 0.1;
      const x = sideRoll < 0.5 ? sideRoll * 2 * inner : box.w - (sideRoll - 0.5) * 2 * inner;
      ground.kind[i] = 1;
      ground.homeX[i] = x;
      ground.homeY[i] = waterTop - (10 + 50 * ((ground.roll[i] * 5.9) % 1)) * s;
      ground.size[i] = (12 + ground.roll[i] * 9) * s;
      ground.bright[i] = 0.75;
      ground.wA[i] = 10 * s;
      ground.calm[i] = ground.roll[i] < 0.5 ? 0.4 : 0;
      ground.floor[i] = 0.04;
    }
    configureGrid(ground.field, box.w, box.h, 90);
  };

  const recompose = (f: HubFrame) => {
    const snapshot = f.page;
    const width = f.width || snapshot.viewport.w;
    const height = f.height || snapshot.viewport.h;
    if (width <= 0 || height <= 0) return;
    const lay = computeLayout(snapshot, width, height);
    L = lay;
    configureGrid(sky.field, width, height, Math.max(70, Math.min(width, height) * 0.11));
    layoutSky(lay);
    layoutTrees(lay);
    if (driftFF !== lay.counts.drift || treeFF !== (trees.length > 0 ? lay.counts.tree : 0)) placeTreeFireflies(lay);
    else placeDrifters(lay);
    layoutStage(snapshot, lay);
    layoutMid(snapshot, lay);
    layoutGround(snapshot, lay);
  };

  /* ---------------- per-frame positions ---------------- */

  const shiftX = () => -parX * 10;
  const shiftY = () => -parY * 4;

  /** Viewport position of sky firefly i without attraction. */
  const skyBase = (f: HubFrame, i: number, t: number, moving: boolean) => {
    const wa = moving ? sky.wA[i] : 0;
    if (sky.kind[i] === 1) {
      const ns = sky.roll[i] * 100;
      const dx = moving ? 46 * Math.sin(t * 0.07 * (1 + sky.wF1[i]) + sky.wP1[i]) + 14 * noise(t * 0.05 + ns, ns) : 0;
      return { x: sky.homeX[i] + dx, y: sky.homeY[i] - f.scrollY + (moving ? wa * Math.sin(t * sky.wF2[i] + sky.wP2[i]) : 0) };
    }
    const sy = f.staticY[COL_L] ?? 0;
    return {
      x: sky.homeX[i] + (moving ? shiftX() : 0) + wa * Math.sin(t * sky.wF1[i] + sky.wP1[i]),
      y: sky.homeY[i] - sy + (moving ? shiftY() : 0) + wa * 0.6 * Math.sin(t * sky.wF2[i] + sky.wP2[i]),
    };
  };

  /** Positions every firefly of a population for this frame (canvas px of its plane). */
  const movePop = (pop: Pop, f: HubFrame, t: number, base: (i: number) => { x: number; y: number }, s: number) => {
    for (let i = 0; i < pop.field.count; i++) {
      const p = base(i);
      let x = p.x;
      let y = p.y;
      const a = attraction(pop, i, t);
      if (a > 0) {
        const tx = pop.tx[i] + Math.sin(t * 0.7 + pop.wP1[i]) * 7 * s * (pop.tDoc[i] ? 0.3 : 1);
        const ty = (pop.tDoc[i] ? pop.ty[i] - f.scrollY : pop.ty[i]) + Math.sin(t * 0.55 + pop.wP2[i]) * 5 * s * (pop.tDoc[i] ? 0.2 : 1);
        x += (tx - x) * a;
        y += (ty - y) * a - Math.sin(a * Math.PI) * 14 * s;
      }
      pop.x[i] = x;
      pop.y[i] = y;
      pop.field.x[i] = x;
      pop.field.y[i] = y;
    }
  };

  const windowBase = (pop: Pop, t: number, moving: boolean) => (i: number) => {
    const wa = moving ? pop.wA[i] : 0;
    if (pop.kind[i] === 1 && moving) {
      return {
        x: pop.homeX[i] + 30 * Math.sin(t * 0.09 * (1 + pop.wF1[i]) + pop.wP1[i]),
        y: pop.homeY[i] + wa * Math.sin(t * pop.wF2[i] + pop.wP2[i]),
      };
    }
    return { x: pop.homeX[i] + wa * Math.sin(t * pop.wF1[i] + pop.wP1[i]), y: pop.homeY[i] + wa * 0.6 * Math.sin(t * pop.wF2[i] + pop.wP2[i]) };
  };

  /* ---------------- drawing ---------------- */

  /** 1 away from text, down to 0.3 right behind it (sky fireflies only). */
  const quiet = (snapshot: PageSnapshot, x: number, yDoc: number): number => {
    let f = 1;
    const pad = 18;
    for (const h of snapshot.holes) {
      const dx = Math.max(h.x - x, 0, x - (h.x + h.w));
      const dy = Math.max(h.y - yDoc, 0, yDoc - (h.y + h.h));
      const d = Math.max(dx, dy);
      if (d < pad) f = Math.min(f, 0.3 + 0.7 * (d / pad));
    }
    return f;
  };

  const covered = (snapshot: PageSnapshot, x: number, yDoc: number, pad: number) => {
    for (const r of snapshot.cover) {
      if (x - pad >= r.x && x + pad <= r.x + r.w && yDoc - pad >= r.y && yDoc + pad <= r.y + r.h) return true;
    }
    return false;
  };

  /** Wake gate of the opening: dark until the front passes, then a slow ramp (>= 300 ms per light). */
  const introGate = (t: number, vy: number, height: number): number => {
    const e = t - introAt;
    if (e > 2.2 || e < 0) return 1;
    const tf = 0.15 + 1.45 * clamp(vy / Math.max(1, height), 0, 1);
    return smooth(tf, tf + 0.45, e);
  };
  const introGlow = (t: number, vy: number, height: number): number => {
    const e = t - introAt;
    if (e > 2.2 || e < 0) return 0;
    const tf = 0.15 + 1.45 * clamp(vy / Math.max(1, height), 0, 1);
    return 0.7 * smooth(tf, tf + 0.35, e) * (1 - smooth(tf + 0.35, tf + 1.2, e));
  };

  /**
   * Draws a population. `level` gives each firefly's brightness; `yDoc` converts a canvas y
   * to document px for the hole and cover tests (sky only).
   */
  const drawPop = (
    g: Ctx,
    pop: Pop,
    level: (i: number) => number,
    opts: { snapshot?: PageSnapshot; scrollY?: number; limit?: number; reflectY?: number; reflectTo?: number; scale: number },
  ) => {
    const n = Math.min(pop.field.count, opts.limit ?? pop.field.count);
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      if (pop.hidden[i]) continue;
      let glow = level(i);
      if (glow < 0.012) continue;
      const x = pop.x[i];
      const y = pop.y[i];
      const r = pop.size[i] * (0.85 + 0.25 * Math.min(1, glow));
      if (opts.snapshot && opts.scrollY !== undefined) {
        const yDoc = y + opts.scrollY;
        if (covered(opts.snapshot, x, yDoc, r * 0.3)) continue;
        glow *= quiet(opts.snapshot, x, yDoc);
      }
      g.globalAlpha = Math.min(1, glow);
      g.drawImage(sprites.ff[pop.field.species[i]], x - r, y - r, r * 2, r * 2);
      if (opts.reflectY !== undefined && opts.reflectTo !== undefined) {
        const ry = 2 * opts.reflectY - y;
        if (ry > opts.reflectY + 1 && ry < opts.reflectTo) {
          g.globalAlpha = Math.min(1, glow) * 0.38 * (1 - (ry - opts.reflectY) / Math.max(1, opts.reflectTo - opts.reflectY));
          g.drawImage(sprites.ff[pop.field.species[i]], x - r * 0.85, ry - r * 1.4, r * 1.7, r * 2.8);
        }
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  };

  const liveLevel = (pop: Pop, t: number, height: number, offsetY: number) => (i: number) => {
    let e = flashIntensity(pop.field, i, t) * pop.bright[i] + pop.floor[i];
    if (introAt >= 0 && t - introAt < 2.2) {
      const vy = pop.y[i] + offsetY;
      e = e * introGate(t, vy, height) + introGlow(t, vy, height) * pop.bright[i];
    }
    return e;
  };

  const drawRings = (g: Ctx, plane: Ring["plane"], t: number, scrollY: number, s: number) => {
    g.globalCompositeOperation = "lighter";
    for (const ring of rings) {
      if (ring.plane !== plane) continue;
      const tau = t - ring.t;
      if (tau < 0 || tau > 1.6) continue;
      const y = ring.doc ? ring.y - scrollY : ring.y;
      const a = tau < 0.12 ? smooth(0, 0.12, tau) : 1 - smooth(0.12, 1.6, tau);
      const r = 30 * s * (0.8 + 0.3 * a);
      g.globalAlpha = a * 0.85;
      g.drawImage(sprites.call, ring.x - r, y - r, r * 2, r * 2);
      const spread = smooth(0, 1.6, tau);
      const rr = (14 + 80 * spread) * s;
      g.globalAlpha = (1 - spread) * 0.65;
      g.drawImage(sprites.ring, ring.x - rr, y - rr * (plane === "mid" ? 0.35 : 1), rr * 2, rr * 2 * (plane === "mid" ? 0.35 : 1));
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  };

  const boatLen = (box: WindowBox) => clamp(box.boxW * 0.2, 80, 220);

  /** Paddle range along the stage box: the stern pole stays in the window, the bow stops short of the jetty. */
  const boatRange = (): [number, number] => {
    const box = wins.stage?.box;
    if (!box || box.boxW <= 0) return [0.22, 0.5];
    const len = boatLen(box) / box.boxW;
    const lo = Math.max(0.12, 0.8 * len + 0.02);
    const hi = JETTY_AT - 0.56 * len - 0.03;
    return hi > lo ? [lo, hi] : [(lo + hi) / 2, (lo + hi) / 2];
  };

  const drawBoat = (g: Ctx, box: WindowBox, waterY: number, s: number, t: number, moving: boolean) => {
    const len = boatLen(box);
    const [lo, hi] = boatRange();
    const bx = box.boxX + box.boxW * clamp(boatPos, lo, hi);
    const bob = moving ? Math.sin(t * 1.9) * 0.8 * s : 0;
    const by = waterY + 3 * s + bob;
    const tilt = moving ? clamp(boatVel * 0.25, -0.05, 0.05) + Math.sin(t * 1.3) * 0.012 : 0;
    const hull = (sign: 1 | -1, alpha: number, fill: string) => {
      g.save();
      g.translate(bx, by);
      g.rotate(tilt * sign);
      g.scale(1, sign);
      g.globalAlpha = alpha;
      g.fillStyle = fill;
      const h = 7 * s;
      g.beginPath();
      g.moveTo(-len / 2, -h * 0.6);
      g.lineTo(len * 0.34, -h);
      g.quadraticCurveTo(len * 0.5, -h * 1.4, len * 0.56, -h * 2.8);
      g.quadraticCurveTo(len * 0.5, -h * 0.2, len * 0.3, 0);
      g.quadraticCurveTo(-len * 0.1, h * 0.3, -len / 2, -h * 0.1);
      g.closePath();
      g.fill();
      // The canopy roof and the long-tail pole at the stern.
      g.fillRect(-len * 0.2, -h * 3.2, len * 0.34, h * 0.45);
      g.fillRect(-len * 0.18, -h * 3, 1.2 * s, h * 2.2);
      g.fillRect(len * 0.12, -h * 3, 1.2 * s, h * 2.2);
      g.beginPath();
      g.moveTo(-len * 0.48, -h * 0.9);
      g.lineTo(-len * 0.78, h * 0.4);
      g.lineTo(-len * 0.77, h * 0.6);
      g.lineTo(-len * 0.46, -h * 0.6);
      g.closePath();
      g.fill();
      g.restore();
    };
    // Its reflection: a moonlit copy broken into ripple bands.
    g.save();
    g.beginPath();
    for (let y = by + 1; y < by + 7 * s * 3.2; y += 4.5) g.rect(bx - len, y, len * 2, 2.6);
    g.clip();
    hull(-1, 0.16, "rgb(120,160,185)");
    g.restore();
    hull(1, 1, "#0d0906");
    g.globalAlpha = 1;
    // Moonlight along the gunwale, so the hull reads against the dark water.
    g.strokeStyle = "rgba(150,185,205,0.38)";
    g.lineWidth = Math.max(0.8, 0.9 * s);
    g.beginPath();
    g.moveTo(bx - len / 2, by - 4.2 * s);
    g.lineTo(bx + len * 0.34, by - 7 * s);
    g.quadraticCurveTo(bx + len * 0.5, by - 9.8 * s, bx + len * 0.56, by - 19.6 * s);
    g.stroke();
    // The boat's little lamp under the canopy.
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.85;
    const gr = 14 * s;
    g.drawImage(sprites.warm, bx - len * 0.03 - gr, by - 16 * s - gr, gr * 2, gr * 2);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    if (!moving) return;
    // Wake: two short diverging arms behind the stern that widen and fade over 1.5 s.
    g.strokeStyle = "rgb(170,210,225)";
    g.lineWidth = Math.max(0.8, s * 0.9);
    for (const w of wakes) {
      const age = t - w.t;
      if (age < 0 || age > 1.5) continue;
      const arm = (10 + age * 22) * s * (0.8 + 0.4 * ((w.t * 7.3) % 1));
      const x = box.boxX + box.boxW * w.x;
      const y = waterY + 5 * s;
      g.globalAlpha = (1 - age / 1.5) * 0.25;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - w.dir * arm, y - arm * 0.09 * (1 + age * 0.5));
      g.moveTo(x, y + 1);
      g.lineTo(x - w.dir * arm, y + arm * 0.16 * (1 + age * 0.5));
      g.stroke();
    }
    g.globalAlpha = 1;
  };

  const drawStage = (g: Ctx, f: HubFrame, t: number, moving: boolean) => {
    const w = wins.stage;
    if (!w || !stageArt || !L) return;
    const box = w.box;
    const waterY = box.h * (L.mode === "landscape-short" ? 0.62 : 0.68);
    g.drawImage(stageArt.canvas, 0, 0, stageArt.canvas.width, stageArt.canvas.height, 0, 0, box.w, box.h);
    const s = Math.max(0.6, L.scale);
    // Moonlit glints on the strip.
    g.fillStyle = "#d4e6f2";
    const grng = createRng(ctx.seed + 31);
    for (let k = 0; k < 26; k++) {
      const x = grng() * box.w;
      const y = waterY + 3 + grng() * (box.h - waterY - 6);
      const speed = 1 + grng() * 2.4;
      const ph = grng() * TAU;
      let a = moving ? Math.sin(t * speed + ph) : 0.4 + 0.3 * Math.sin(ph);
      if (a <= 0) continue;
      a = a * a * 0.4;
      const dx = moving ? rippleOffset(y - waterY, box.h - waterY, t, wind) : 0;
      g.globalAlpha = a;
      g.fillRect(x + dx, y, (3 + grng() * 9) * s, 1);
    }
    g.globalAlpha = 1;
    // The jetty lamp breathes a little (<= 12% luminance, < 2 Hz).
    const lampX = box.boxX + box.boxW * JETTY_AT + 10 * s + 11.5 * s;
    const top = Math.max(6 * s, waterY - 10 * s - box.h * 0.46);
    const flick = moving ? 1 + 0.06 * Math.sin(t * 4.1) + 0.04 * Math.sin(t * 6.7 + 1) : 1;
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.75 * flick;
    const lr = 26 * s;
    g.drawImage(sprites.warm, lampX - lr, top + 6.5 * s - lr, lr * 2, lr * 2);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    drawBoat(g, box, waterY, s, t, moving);
    const level = moving
      ? liveLevel(stage, t, f.height, f.win.stage?.y ?? 0)
      : (i: number) => (stillGathered ? 0.85 : stage.calm[i]) * stage.bright[i];
    drawPop(g, stage, level, { scale: s, reflectY: waterY, reflectTo: box.h });
    if (moving) drawRings(g, "stage", t, f.scrollY, s);
  };

  const drawMid = (g: Ctx, f: HubFrame, t: number, moving: boolean) => {
    const b = bank;
    if (!b || !bankArt || !mirror || !L) return;
    const sd = bankArt.canvas.width / Math.max(1, b.w);
    g.drawImage(bankArt.canvas, 0, 0, bankArt.canvas.width, bankArt.canvas.height, 0, 0, b.w, bankArt.canvas.height / sd);
    const riverH = b.h - b.waterY;
    const src = mirror.canvas;
    let row = 0;
    const devH = src.height;
    while (row < devH) {
      const depth = row / Math.max(1, riverH);
      const hs = Math.max(1, Math.round(1 + 2.2 * depth + 2.5 * depth * depth));
      const dx = moving ? rippleOffset(row + hs * 0.5, riverH, t, wind) : rippleOffset(row, riverH, 0.7, 0) * 0.4;
      // The river fades into the band below the window.
      g.globalAlpha = 1 - smooth(0.62, 1, depth);
      g.drawImage(src, 0, row, src.width, hs, dx, b.waterY + row, src.width, hs);
      row += hs;
    }
    g.globalAlpha = 1;
    const s = b.scale;
    // Upcoming novels: boat lanterns on their way, never arriving.
    g.globalCompositeOperation = "lighter";
    for (const boat of b.boats) {
      const x = boatX(boat, t) + (moving ? Math.sin(t * 0.6 + boat.y) * 1.5 : 0);
      const y = boat.y + (moving ? Math.sin(t * 1.1 + boat.tau) * 0.8 : 0);
      g.globalCompositeOperation = "source-over";
      g.fillStyle = "#04090d";
      g.beginPath();
      g.ellipse(x, y + 2 * s, 11 * s, 2.2 * s, 0, 0, TAU);
      g.fill();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.85;
      g.fillStyle = lampColour(boat.accent, 1);
      g.beginPath();
      g.arc(x + 4 * s, y - 3 * s, 1.5 * s, 0, TAU);
      g.fill();
      const gr = 12 * s;
      g.globalAlpha = 0.6;
      g.drawImage(sprites.warm, x + 4 * s - gr, y - 3 * s - gr, gr * 2, gr * 2);
      g.globalAlpha = 0.3;
      g.drawImage(sprites.warm, x + 4 * s - gr * 0.4, y + 2 * s, gr * 0.8, gr * 1.6);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    const level = moving
      ? liveLevel(mid, t, f.height, f.win.mid?.y ?? 0)
      : (i: number) => (i < Math.round((mid.field.count * stillBeats) / CHORUS_BEATS) ? 0.9 : mid.calm[i]) * mid.bright[i];
    drawPop(g, mid, level, { scale: s, reflectY: b.waterY, reflectTo: b.h });
    if (moving) drawRings(g, "mid", t, f.scrollY, s);
    else if (stillBeats > 0) {
      // Each counted beat shows as a ring of light on the river.
      g.globalCompositeOperation = "lighter";
      for (let k = 0; k < Math.min(stillBeats, CHORUS_BEATS); k++) {
        const rr = (16 + k * 9) * s;
        g.globalAlpha = 0.5 - k * 0.04;
        const cx = b.boxX + b.boxW * 0.62;
        const cy = b.waterY + riverH * 0.45;
        g.drawImage(sprites.ring, cx - rr, cy - rr * 0.3, rr * 2, rr * 0.6);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
  };

  const drawGround = (g: Ctx, f: HubFrame, t: number, moving: boolean) => {
    const w = wins.ground;
    if (!w || !reeds || !groundWater || !L) return;
    const box = w.box;
    const waterTop = box.h * 0.4;
    g.drawImage(groundWater.canvas, 0, 0, groundWater.canvas.width, groundWater.canvas.height, 0, waterTop, box.w, box.h - waterTop);
    const s = Math.max(0.6, L.scale);
    g.fillStyle = "#cfe2ee";
    const grng = createRng(ctx.seed + 37);
    for (let k = 0; k < 18; k++) {
      const x = grng() * box.w;
      const y = waterTop + 8 + grng() * (box.h - waterTop - 16) * 0.5;
      const ph = grng() * TAU;
      let a = moving ? Math.sin(t * (0.8 + grng() * 1.6) + ph) : 0.4 + 0.3 * Math.sin(ph);
      if (a <= 0) continue;
      a = a * a * 0.22;
      g.globalAlpha = a;
      g.fillRect(x + (moving ? rippleOffset(y - waterTop, box.h - waterTop, t, wind) : 0), y, (4 + grng() * 10) * s, 1);
    }
    g.globalAlpha = 1;
    const r = reeds;
    const baseY = waterTop + 10 * s;
    for (let group = 0; group < 2; group++) {
      g.beginPath();
      for (let n = 0; n < r.n; n++) {
        if (r.group[n] !== group) continue;
        const x = r.x[n];
        const h = r.h[n];
        let bend = r.lean[n];
        if (moving) {
          const q = (x - gustX) / gustWidth;
          const gust = q > -3 && q < 3 ? gustStrength * Math.exp(-q * q) : 0;
          bend += (0.05 * Math.sin(t * r.freq[n] + r.phase[n] + x * 0.004) + (gust * 0.32 + wind * 0.05)) / r.stiff[n];
        }
        const rw = r.w[n];
        const tx = x + Math.sin(bend) * h;
        const ty = baseY - Math.cos(bend) * h;
        const cx = x + Math.sin(bend * 0.45) * h * 0.55;
        const cy = baseY - Math.cos(bend * 0.45) * h * 0.55;
        g.moveTo(x - rw, baseY + 4);
        g.quadraticCurveTo(cx - rw * 0.45, cy, tx, ty);
        g.quadraticCurveTo(cx + rw * 0.45, cy, x + rw, baseY + 4);
      }
      g.fillStyle = group === 0 ? "#0a1822" : "#020508";
      g.fill();
    }
    const level = moving ? liveLevel(ground, t, f.height, f.win.ground?.y ?? 0) : (i: number) => ground.calm[i] * ground.bright[i];
    drawPop(g, ground, level, { scale: s, reflectY: waterTop + 10 * s, reflectTo: box.h * 0.7 });
    if (moving) drawRings(g, "ground", t, f.scrollY, s);
  };

  /* ---------------- events ---------------- */

  const cardOf = (slug: string | null) => (slug ? (page.getSnapshot().cards.find((c) => c.slug === slug) ?? null) : null);

  const visible = (f: HubFrame, c: CardInfo) => c.rect.y - f.scrollY < f.height && c.rect.y + c.rect.h - f.scrollY > 0;

  /** Lets the perched cluster go: the DOM perch is removed and its fireflies fly home from the frame. */
  const releasePerch = (t: number) => {
    if (!perch) return;
    if (perch.id > 0) out.unperch(perch.id);
    for (const i of perch.members) {
      sky.hidden[i] = 0;
      sky.aEnd[i] = Math.min(sky.aEnd[i], t);
    }
    perch = null;
  };

  /** M1: the nearest fireflies fly to the frame's top edge and settle there as a DOM perch. */
  const summon = (f: HubFrame, slug: string, t: number, linger: number) => {
    const card = cardOf(slug);
    if (!card || !visible(f, card) || !L) return;
    if (perch && perch.slug === slug) {
      perch.releaseAt = linger;
      return;
    }
    releasePerch(t);
    const s = Math.max(0.7, L.scale);
    const u = 0.5;
    const ex = card.rect.x + card.rect.w * u;
    const ey = card.rect.y - f.scrollY;
    const members = nearestFree(sky, ex, ey, t, PERCH_SIZE).map((i, k) => {
      const d = Math.hypot(sky.x[i] - ex, sky.y[i] - ey);
      sky.tx[i] = ex + (k - (PERCH_SIZE - 1) / 2) * 6 * s;
      sky.ty[i] = card.rect.y - 3 - (k % 2) * 3;
      sky.tDoc[i] = 1;
      sky.aStart[i] = t;
      sky.aArrive[i] = t + 0.9 + Math.min(0.7, d / 900);
      sky.aEnd[i] = card.kind === "open" ? Infinity : sky.aArrive[i] + 1.6;
      sky.field.active[i] = 1;
      // They flash together on arrival; the refractory interval still holds.
      sky.field.respondAt[i] = sky.aArrive[i] + 0.1;
      return i;
    });
    if (card.kind !== "open" || members.length === 0) return;
    perch = { slug, members, landAt: Math.max(...members.map((i) => sky.aArrive[i])) + 0.15, id: 0, releaseAt: linger, u };
  };

  /** M12: the frame's fireflies scatter into the air. */
  const scatter = (f: HubFrame, slug: string, t: number) => {
    const card = cardOf(slug);
    if (!card || !L) return;
    const s = Math.max(0.7, L.scale);
    const members = perch?.slug === slug ? perch.members : [];
    if (perch?.slug === slug) {
      perch.id = 0;
      perch = null;
    }
    const ex = card.rect.x + card.rect.w * 0.5;
    const ey = card.rect.y - f.scrollY;
    // Without a perched cluster, the fireflies nearest the frame take off instead.
    const flyers = members.length > 0 ? members : nearestFree(sky, ex, ey, t, PERCH_SIZE);
    for (const i of flyers) {
      sky.hidden[i] = 0;
      sky.x[i] = ex + (Math.random() - 0.5) * 30 * s;
      sky.y[i] = ey;
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      sky.tx[i] = sky.x[i] + Math.cos(ang) * (80 + Math.random() * 80) * s;
      sky.ty[i] = ey + Math.sin(ang) * (60 + Math.random() * 60) * s;
      sky.tDoc[i] = 0;
      sky.aStart[i] = t - 0.9;
      sky.aArrive[i] = t + 0.6;
      sky.aEnd[i] = t + 0.8;
    }
  };

  const stageFocus = () => {
    const snapshot = page.getSnapshot();
    const hit = snapshot.windows.stageHit;
    return toWindow("stage", hit.x + hit.w * 0.5, hit.y + hit.h * 0.4);
  };

  const midFocus = () => {
    const snapshot = page.getSnapshot();
    const hit = snapshot.windows.midHit;
    return { x: hit.x + hit.w * 0.5, yDoc: hit.y + hit.h * 0.5 };
  };

  /** Starts a chorus wave now (or toward a chosen card). */
  const startWave = (f: HubFrame, t: number, toU?: number) => {
    const span = frontSpan(f.width, f.height);
    const to = toU ?? span.to;
    wave = createWave(t, WAVE_AXIS.ax, WAVE_AXIS.ay, span.from, to, toU === undefined ? 2.6 : 1.1);
    waveCross = new Set();
    wavePeaked = false;
    for (const pop of [sky, stage, mid, ground]) boostCoupling(pop.field, t);
  };

  /** M4: the page says once per visit that the fireflies have taken the reader's beat. */
  const announceRhythm = () => {
    if (rhythmAnnounced) return;
    rhythmAnnounced = true;
    out.announce(RHYTHM_TEXT);
  };

  let pendingPick: string | null = null;
  let pendingBeat: { x: number; yDoc: number } | null = null;
  const pendingCalls: { plane: "sky" | WindowName; x: number; y: number }[] = [];
  let pendingPress: string | null = null;
  let frameRef: HubFrame | null = null;

  /* ---------------- hooks ---------------- */

  return {
    resize(f) {
      frameRef = f;
      recompose(f);
    },

    layout(f) {
      frameRef = f;
      recompose(f);
    },

    windowHz(name: WindowName, tier: Tier) {
      if (name === "stage") return tier < 2 ? Infinity : 30;
      return tier === 0 ? 30 : tier === 1 ? 20 : 0;
    },

    intro() {
      introPending = true;
    },

    render(f, g) {
      frameRef = f;
      if (!L) return;
      const lay = L;
      const t = f.t;
      const dt = f.dt;
      if (wasStill) {
        // Back from a still: nothing queued under it plays now.
        wasStill = false;
        stillGathered = false;
        stillBeats = 0;
        stillSync = false;
      }
      if (introPending) {
        introPending = false;
        introAt = t;
        nextWaveAt = t + 9;
      }
      if (nextWaveAt < 0) nextWaveAt = t + 7 + Math.random() * 3;
      const s = Math.max(0.7, lay.scale);

      // Pointer parallax on fine pointers: trees and sky shift a few px.
      const p = f.pointer;
      const tx = p.active && p.type === "mouse" ? clamp(p.nx - 0.5, -0.5, 0.5) : 0;
      const ty = p.active && p.type === "mouse" ? clamp(p.ny - 0.5, -0.5, 0.5) : 0;
      const k = dt > 0 ? 1 - Math.exp(-dt * 2.2) : 1;
      parX += (tx - parX) * k;
      parY += (ty - parY) * k;
      if (!lay.coarse) {
        ctx.shiftStatic(SKY, -parX * 4, -parY * 2);
        for (const i of [COL_L, COL_R, CANOPY]) ctx.shiftStatic(i, shiftX(), shiftY());
      }

      // Wind for the reeds and ripples.
      if (t >= nextGustAt && gustX > f.width + gustWidth * 2) {
        gustWidth = f.width * (0.18 + Math.random() * 0.14);
        gustX = -gustWidth * 2;
        gustSpeed = f.width / (3 + Math.random() * 2);
        gustStrength = 0.6 + Math.random() * 0.6;
        nextGustAt = t + 7 + Math.random() * 9;
      }
      gustX += gustSpeed * dt;
      wind += ((gustX > -gustWidth && gustX < f.width + gustWidth ? gustStrength : 0) - wind) * (1 - Math.exp(-dt * 1.5));

      // Queued input from events (applied here, where time and the frame are known).
      for (const call of pendingCalls.splice(0)) {
        rings.push({ plane: call.plane, x: call.x, y: call.y, t, doc: false });
        callSwarm(pops[call.plane], call.x, call.y, t, CALL_SIZE, 46 * s, call.plane === "sky" ? Math.max(200, Math.min(f.width, f.height) * 0.42) : 420 * s, 6);
      }
      if (pendingPress) {
        scatter(f, pendingPress, t);
        pendingPress = null;
      }
      if (pendingPick) {
        const card = cardOf(pendingPick);
        if (card) {
          const fully = card.rect.y - f.scrollY >= 0 && card.rect.y + card.rect.h - f.scrollY <= f.height;
          const vy = fully ? card.rect.y - f.scrollY + card.rect.h / 2 : f.height / 2;
          startWave(f, t, frontCoord(card.rect.x + card.rect.w / 2, vy));
          pickSlug = card.slug;
        }
        pendingPick = null;
      }
      if (pendingBeat) {
        const tap = rhythmTap(rhythm, performance.now() / 1000);
        rings.push({ plane: "mid", ...(toWindow("mid", pendingBeat.x, pendingBeat.yDoc) ?? { x: 0, y: 0 }), t, doc: false });
        // The bank answers each tap at once with its nearest fireflies.
        for (let i = 0; i < mid.field.count; i += 3) mid.field.respondAt[i] = Math.min(mid.field.respondAt[i], t + 0.05);
        if (tap.steady) {
          driver = createDriver(tap.period, 0, 0);
          driverDoc = { x: pendingBeat.x, y: pendingBeat.yDoc };
          driverUntil = t + DRIVER_HOLD_PERIODS * tap.period;
          if (tap.beats >= CHORUS_BEATS && chorusUntil < t) {
            chorusUntil = t + CHORUS_S;
            out.beat(null, "chorus");
            announceRhythm();
          }
        }
        pendingBeat = null;
      }
      if (driver) {
        advanceDriver(driver, dt);
        if (chorusUntil > t) {
          driver.radius = Infinity;
          driverUntil = Math.max(driverUntil, chorusUntil);
        }
        if (t > driverUntil) driver = null;
      }

      // The chorus wave: scheduled every 28-40 s.
      if (!waveRunning(wave, t) && t >= nextWaveAt) {
        startWave(f, t);
        nextWaveAt = t + 28 + Math.random() * 12;
      }
      const tPrev = t - dt;
      const front = wave && waveRunning(wave, t) ? wave.from + wave.speed * (t - wave.startedAt) : null;

      // Sky fireflies: positions, liveness, then one Kuramoto step.
      const nSky = sky.field.count;
      const driftLimit = f.tier >= 1 ? treeFF + Math.round(driftFF * 0.6) : nSky;
      movePop(sky, f, t, (i) => skyBase(f, i, t, true), s);
      for (let i = 0; i < nSky; i++) {
        const on = sky.x[i] > -40 && sky.x[i] < f.width + 40 && sky.y[i] > -40 && sky.y[i] < f.height + 40 && i < driftLimit;
        sky.field.live[i] = on ? 1 : 0;
      }
      const skyDriver = driver ? { ...driver, x: driverDoc.x, y: driverDoc.y - f.scrollY } : null;
      stepField(sky.field, t, dt, Math.random, sweepBetween(wave, tPrev, t), skyDriver);

      // Window fireflies step only while their window is on screen.
      for (const name of ["stage", "mid", "ground"] as const) {
        const r = f.win[name];
        const pop = pops[name];
        if (!r) {
          pop.field.live.fill(0, 0, pop.field.count);
          continue;
        }
        pop.field.live.fill(1, 0, pop.field.count);
        movePop(pop, f, t, windowBase(pop, t, true), s);
        const local = driver ? { ...driver, x: driverDoc.x - r.x, y: driverDoc.y - f.scrollY - r.y } : null;
        stepField(pop.field, t, dt, Math.random, sweepBetween(wave, tPrev, t, r.x, r.y), local);
      }

      // Perch: land, then hand over to the DOM; take off when the page scrolls fast.
      if (perch) {
        if (Math.abs(f.scrollVel) > SCROLL_TAKEOFF && perch.id > 0) releasePerch(t);
        else if (perch.id === 0 && t >= perch.landAt) {
          const id = out.perch(perch.slug, { kind: "firefly", u: perch.u });
          if (id > 0) {
            perch.id = id;
            for (const i of perch.members) sky.hidden[i] = 1;
          } else perch.landAt = t + 1;
        }
        if (perch && t >= perch.releaseAt) releasePerch(t);
      }

      // Card light: attention, chorus swells and the pick (M1, M7, M8, M9).
      const order = crossingOrder(f.page.cards, f.scrollY, f.height);
      if (front !== null && wave) {
        const prev = wave.from + wave.speed * Math.max(0, tPrev - wave.startedAt);
        for (const c of order) {
          if (waveCross.has(c.slug) || c.u > front || c.u < prev - 1) continue;
          waveCross.add(c.slug);
          const card = cardOf(c.slug);
          if (!card || card.kind !== "open") continue;
          if (t - (swellAt.get(c.slug) ?? -10) >= SWELL_GAP_S) {
            swellAt.set(c.slug, t);
            out.beat(c.slug, "wave");
          }
        }
        if (!wavePeaked && front >= (wave.from + wave.to) / 2) {
          wavePeaked = true;
          breathAt = t;
        }
      }
      if (pickSlug && wave && !waveRunning(wave, t)) {
        const slug = pickSlug;
        pickSlug = null;
        summon(f, slug, t, t + 6);
        swellAt.set(slug, t);
        out.beat(slug, "wave");
      }
      for (const card of f.page.cards) {
        if (card.kind !== "open" || !visible(f, card)) continue;
        const attended = attendSlug === card.slug ? 0.75 : 0;
        const at = swellAt.get(card.slug) ?? -10;
        const e = t - at;
        const swell = e < 0 || e > 1.7 ? 0 : 0.7 * (e < 0.4 ? smooth(0, 0.4, e) : 1 - smooth(0.4, 1.7, e));
        const target = Math.max(attended, swell);
        const cur = glowNow.get(card.slug) ?? 0;
        // Falls are shaped here (>= 900 ms); rises are slew-limited by the output.
        const next = target >= cur ? target : Math.max(target, cur - dt / 0.9);
        glowNow.set(card.slug, next);
        const sent = glowSent.get(card.slug);
        if (sent === undefined || Math.abs(sent - next) >= 1 / 64 || (next === 0 && sent !== 0)) {
          glowSent.set(card.slug, next);
          out.card(card.slug, { "w-glow": next });
        }
      }
      const be = t - breathAt;
      const breath = be < 0 || be > 2 ? 0 : be < 0.6 ? smooth(0, 0.6, be) : 1 - smooth(0.6, 2, be);
      out.root({ "w-breath": breath });

      // Draw: sky fireflies, rings, then the windows that are due.
      const live = g.live;
      drawPop(live, sky, liveLevel(sky, t, f.height, 0), { snapshot: f.page, scrollY: f.scrollY, limit: driftLimit, scale: s });
      drawRings(live, "sky", t, f.scrollY, s);
      if (g.stage) {
        if (boatVel !== 0) {
          boatVel *= Math.exp(-dt * 0.9);
          boatPos += boatVel * dt;
          const [lo, hi] = boatRange();
          if (boatPos < lo || boatPos > hi) {
            // Bounce off the jetty or the bank only when moving into it.
            if ((boatPos < lo && boatVel < 0) || (boatPos > hi && boatVel > 0)) boatVel *= -0.3;
            boatPos = clamp(boatPos, lo, hi);
          }
          if (Math.abs(boatVel) < 0.004) boatVel = 0;
          if (Math.abs(boatVel) > 0.02 && t - lastWakeAt > 0.22) {
            lastWakeAt = t;
            const box = wins.stage?.box;
            const half = box && box.boxW > 0 ? (0.5 * boatLen(box)) / box.boxW : 0.07;
            wakes.push({ x: boatPos - Math.sign(boatVel) * half, t, dir: Math.sign(boatVel) });
            if (wakes.length > 10) wakes.shift();
          }
        }
        drawStage(g.stage, f, t, true);
      }
      if (g.mid) drawMid(g.mid, f, t, f.tier < 2);
      if (g.ground) drawGround(g.ground, f, t, f.tier < 2);
      while (rings.length && t - rings[0].t > 2) rings.shift();
    },

    still(f, g) {
      frameRef = f;
      wasStill = true;
      if (!L) return;
      const lay = L;
      const s = Math.max(0.7, lay.scale);
      const t = f.t;
      // Rest positions, the canopy outline lit, or in sync after eight steady beats.
      movePop(sky, f, t, (i) => skyBase(f, i, t, false), s);
      const attended = cardOf(attendSlug);
      const near = attended && visible(f, attended) ? { top: attended.rect.y - f.scrollY, bottom: attended.rect.y + attended.rect.h - f.scrollY } : null;
      const level = (i: number) => {
        if (stillSync && sky.kind[i] === 0) return 0.82 * sky.bright[i];
        let v = sky.calm[i] * sky.bright[i];
        // The trees beside the attended card light up around it.
        if (near && sky.kind[i] === 0 && sky.y[i] > near.top - 30 && sky.y[i] < near.bottom + 30) v = Math.max(v, 0.7 * sky.bright[i]);
        return v;
      };
      drawPop(g.live, sky, level, { snapshot: f.page, scrollY: f.scrollY, scale: s });
      if (g.stage) {
        movePop(stage, f, t, windowBase(stage, t, false), s);
        if (stillGathered) {
          const focus = stageFocus();
          if (focus) {
            for (let i = 0; i < stage.field.count; i++) {
              const a = (i * 2.399) % TAU;
              const rr = Math.sqrt((i + 0.5) / stage.field.count) * 40 * s;
              stage.x[i] = focus.x + Math.cos(a) * rr;
              stage.y[i] = focus.y + Math.sin(a) * rr * 0.6;
            }
          }
        }
        drawStage(g.stage, f, t, false);
      }
      if (g.mid) {
        movePop(mid, f, t, windowBase(mid, t, false), s);
        drawMid(g.mid, f, t, false);
      }
      if (g.ground) {
        movePop(ground, f, t, windowBase(ground, t, false), s);
        drawGround(g.ground, f, t, false);
      }
      const cards: Record<string, { "w-glow": number }> = {};
      for (const card of f.page.cards) {
        if (card.kind !== "open") continue;
        cards[card.slug] = { "w-glow": card.slug === attendSlug ? 0.7 : card.finished ? 0.35 : 0 };
      }
      out.still({ "w-breath": stillSync ? 0.6 : 0 }, cards);
    },

    onPointer(p: HubPointer) {
      if (!(p.tap || p.press) || !frameRef || !L) return;
      if (frameRef.still) return;
      if (p.zone === "open") pendingCalls.push({ plane: "sky", x: p.x, y: p.y });
      else if (p.zone === "stage" || p.zone === "mid" || p.zone === "ground") {
        const r = frameRef.win[p.zone];
        if (r) pendingCalls.push({ plane: p.zone, x: p.x - r.x, y: p.y - r.y });
      }
    },

    onEvent(event: SceneEvent) {
      const f = frameRef;
      const still = f?.still ?? false;
      switch (event.name) {
        case "hub:attention": {
          const { slug } = event.detail;
          attendSlug = slug;
          if (!f || still) return;
          if (slug) summon(f, slug, f.t, Infinity);
          else if (perch) perch.releaseAt = f.t + PERCH_RELEASE_S;
          if (slug && perch && perch.slug !== slug) perch.releaseAt = f.t;
          return;
        }
        case "hub:press": {
          if (perch?.slug === event.detail.slug) perch.id = 0;
          if (!still) pendingPress = event.detail.slug;
          return;
        }
        case "hub:pick": {
          if (!still && event.detail.slug) pendingPick = event.detail.slug;
          return;
        }
        case "hub:stage": {
          const d = event.detail;
          if (d.window === "stage") {
            if (d.action === "tap") {
              if (still) {
                stillGathered = true;
                return;
              }
              const r = f?.win.stage;
              const at = d.x !== undefined && d.y !== undefined && r ? { x: d.x - r.x, y: d.y - r.y } : stageFocus();
              if (at) pendingCalls.push({ plane: "stage", ...at });
              return;
            }
            const dir = d.action === "left" ? -1 : 1;
            if (still) {
              const [lo, hi] = boatRange();
              boatPos = clamp(clamp(boatPos, lo, hi) + dir * 0.08, lo, hi);
            }
            else boatVel = clamp(boatVel + dir * 0.2, -0.45, 0.45);
            return;
          }
          if (d.action !== "tap") return;
          if (still) {
            stillBeats = Math.min(CHORUS_BEATS, stillBeats + 1);
            if (stillBeats >= CHORUS_BEATS) {
              stillSync = true;
              announceRhythm();
            }
            return;
          }
          const focus = midFocus();
          const scrollY = f?.scrollY ?? 0;
          pendingBeat = d.x !== undefined && d.y !== undefined ? { x: d.x, yDoc: d.y + scrollY } : focus;
          return;
        }
        case "hub:modal": {
          if (event.detail.open && event.detail.kind !== "picker" && perch) {
            // The output removes every perch when a dialog opens.
            perch.id = 0;
            releasePerch(f?.t ?? 0);
          }
          return;
        }
        case "hub:reading":
        case "hub:theme":
          return;
      }
    },

    dispose() {
      for (const key of [...jobScratch.keys()]) releaseScratch(key);
      // The live canvas keeps a viewport-sized backing after the runtime stops; drop it so a
      // hidden theme container holds no pixels (createScene sizes it again on the next mount).
      planes.live.width = 0;
      planes.live.height = 0;
      for (const canvas of statics) {
        canvas.width = 0;
        canvas.height = 0;
        for (const prop of ["left", "top", "width", "height"]) canvas.style.removeProperty(prop);
      }
      trees = [];
      stageGeom = null;
      bank = null;
      reeds = null;
      stageArt = null;
      bankArt = null;
      mirror = null;
      groundWater = null;
      perch = null;
      frameRef = null;
      L = null;
    },
  };
}
