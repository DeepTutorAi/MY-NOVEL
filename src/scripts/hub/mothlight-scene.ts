// Mothlight hub scene on the scene kit (spec 3.4): a violet night garden under tonight's moon.
// Luna moths circle the swinging stage lantern, rest on moonflowers in the stage, mid and
// ground windows, land on the cards the reader attends to (as DOM perches) and answer the
// hand lantern and the lanterns the reader hangs. Lamplight reaches the page through ctx.out:
// every visible card is lit from its nearest light, and the title, resume tag and footer
// follow the lamp. Pure maths lives in mothlight-core.ts, painting in mothlight-paint.ts.

import { createNoise2D, createRng, type PointerState } from "../_shared/scene-runtime";
import {
  FLAP_FRAMES,
  TAU,
  bloomOf,
  cardLight,
  displayAngle,
  falloff,
  fitOrbit,
  flapOpenness,
  flicker,
  frameForOpenness,
  groundLayout,
  keyLantern,
  lanternPos,
  mayReland,
  midLayout,
  moonOrbit,
  moonRadius,
  moonShape,
  moonSide,
  mothCount,
  mothSpan,
  openAreas,
  perchLeaves,
  phaseBucket,
  placeMoon,
  pushSwing,
  spinSwing,
  stageLayout,
  stepSwing,
  tapLantern,
  visibleSpots,
  wrapAngle,
  type GroundLayout,
  type HungLantern,
  type Light,
  type MidLayout,
  type MoonPlacement,
  type StageLayout,
  type Swing,
} from "./mothlight-core";
import {
  CELL_OX,
  CELL_OY,
  CELL_UNITS,
  PALETTE_COUNT,
  cocoon,
  finishSky,
  gate,
  groundBase,
  lantern,
  lowLantern,
  midBase,
  mothSheetSteps,
  nebulaSteps,
  paintGarden,
  paintMoon,
  paintSkyBase,
  paperLantern,
  stageBase,
  stageFlower,
  type Alloc,
  type Free,
  type MothSheets,
} from "./mothlight-paint";
import { radialSprite } from "./scene-paint";
import { clamp, smoothstep } from "./world/geom";
import { collectPlanes, createHubScene, KIT_DPR_CAP, staticDpr } from "./world/kit";
import type {
  BindOptions,
  CardInfo,
  CardVars,
  Ctx,
  HubBuildContext,
  HubContexts,
  HubFrame,
  HubPlanes,
  HubPointer,
  HubSceneHandle,
  HubSceneHooks,
  HubSceneOptions,
  PageSnapshot,
  Rect,
  SceneEvent,
  Surface,
  WindowName,
} from "./world/types";

/** canvas[data-sky-static] in DOM order: the sky, then three sway phases of the hanging garden. */
const STATICS = [{ parallax: 0.15 }, { parallax: 0.4 }, { parallax: 0.4 }, { parallax: 0.4 }];
/** The sky box is this much taller than the viewport; its parallax eases into that travel. */
const SKY_OVERSCAN = 0.25;
/** The hanging garden is soft and far: painted below CSS resolution. */
const GARDEN_SCALE = 0.6;
const MAX_DUST = [240, 120, 60] as const;
const FAR_MOTHS = 3;
const MAX_POINTER_MOTHS = 3;
const MOUSE_IDLE_S = 6;
const TOUCH_LINGER_S = 2.2;
const HOLD_S = 0.18;
/**
 * Root variables are registered and inherited, so every root write restyles the whole page
 * (about 350 elements). They drive only the faint title rim and the resume glow, so they are
 * written at most once a second in steps of 1/16; the limiter then skips values that did not change.
 */
const ROOT_EVERY_S = 1;
const ROOT_STEP = 16;
const CARD_EVERY_S = 0.08;
const WINDOWS: readonly WindowName[] = ["stage", "mid", "ground"];

type Goal = "wander" | "moon" | "lamp" | "pointer" | "flower" | "card" | "chip";
type Phase = "fly" | "dart" | "retreat" | "rest" | "takeoff" | "perch";

interface Moth {
  id: number;
  far: boolean;
  type: number;
  depth: number;
  x: number;
  y: number;
  heading: number;
  disp: number;
  speed: number;
  cruise: number;
  turn: number;
  flapPhase: number;
  flapRate: number;
  flapping: boolean;
  glideTimer: number;
  goal: Goal;
  goalTimer: number;
  side: number;
  phase: Phase;
  phaseTimer: number;
  retreatHeading: number;
  anchorX: number;
  anchorY: number;
  /** Lamp goal: "stage" | "mid" | "ground" | "h<id>". */
  lamp: string;
  spot: number;
  restClock: number;
  restTilt: number;
  restCooldown: number;
  warm: number;
  litX: number;
  dustCarry: number;
  sepX: number;
  sepY: number;
  orbitScale: number;
  orbitAspect: number;
  orbitTilt: number;
  precess: number;
  /** Card slug or "chip" for the card and chip goals. */
  target: string;
  lander: boolean;
  u: number;
  perchId: number;
  perchUntil: number;
  swirlUntil: number;
}

interface Spot {
  plane: WindowName;
  x: number;
  y: number;
  r: number;
  claimedBy: number;
}

interface Held {
  live: Surface[];
  pending: Surface[];
}

export function mount(root: HTMLElement, options: Partial<BindOptions> = {}): HubSceneHandle | null {
  const planes = collectPlanes(root, STATICS);
  if (!planes) return null;
  return createMothlightScene(planes, options);
}

/** The scene on a set of planes; `mount` collects them from the sky root. */
export function createMothlightScene(planes: HubPlanes, options: HubSceneOptions = {}): HubSceneHandle {
  return createHubScene("mothlight", planes, (ctx) => build(ctx, planes), options);
}

function build(ctx: HubBuildContext, planes: HubPlanes): HubSceneHooks {
  const { out, surfaces, paint } = ctx;
  const rng = createRng(ctx.seed ^ 0x3c3c);
  const noise = createNoise2D(ctx.seed);
  const dustNoise = createNoise2D(ctx.seed ^ 0x2b2b);
  const flightNoise = createNoise2D(ctx.seed ^ 0x77);
  const range = (lo: number, hi: number) => lo + rng() * (hi - lo);

  /* ------------------------------------------------------------ assets */

  const held = new Map<string, Held>();
  /** Runs a staged paint job whose surfaces replace the asset's previous ones when it completes. */
  const job = (name: string, steps: (alloc: Alloc, free: Free) => (() => void)[], commit: () => void) => {
    let h = held.get(name);
    if (!h) held.set(name, (h = { live: [], pending: [] }));
    const own = h;
    for (const s of own.pending) surfaces.release(s);
    own.pending = [];
    const alloc: Alloc = (w, hh) => {
      const s = surfaces.create(w, hh);
      own.pending.push(s);
      return s;
    };
    const free: Free = (s) => {
      surfaces.release(s);
      own.pending = own.pending.filter((x) => x !== s);
    };
    paint.run(name, steps(alloc, free), () => {
      for (const s of own.live) surfaces.release(s);
      own.live = own.pending;
      own.pending = [];
      commit();
    });
  };
  /** Synchronous asset: releases the previous surfaces and keeps the new ones. */
  const now$ = (name: string, make: (alloc: Alloc) => void) => {
    let h = held.get(name);
    if (!h) held.set(name, (h = { live: [], pending: [] }));
    for (const s of h.live) surfaces.release(s);
    const own = h;
    own.live = [];
    make((w, hh) => {
      const s = surfaces.create(w, hh);
      own.live.push(s);
      return s;
    });
  };

  const sprite = (size: number, stops: [number, string][]) => radialSprite(size, stops, surfaces.create);
  const glow = sprite(256, [
    [0, "rgba(255,232,190,0.9)"],
    [0.07, "rgba(246,200,138,0.6)"],
    [0.25, "rgba(220,160,96,0.24)"],
    [0.55, "rgba(207,154,94,0.07)"],
    [1, "rgba(207,154,94,0)"],
  ]);
  const pool = sprite(128, [
    [0, "rgba(236,170,104,0.5)"],
    [0.4, "rgba(207,140,84,0.2)"],
    [1, "rgba(207,140,84,0)"],
  ]);
  const mothGlow = sprite(64, [
    [0, "rgba(196,232,196,0.5)"],
    [0.35, "rgba(190,220,204,0.16)"],
    [1, "rgba(170,200,200,0)"],
  ]);
  const mote = sprite(32, [
    [0, "rgba(232,244,240,0.95)"],
    [0.2, "rgba(200,226,232,0.4)"],
    [1, "rgba(170,200,226,0)"],
  ]);
  const dot = sprite(16, [
    [0, "rgba(255,244,214,1)"],
    [0.35, "rgba(250,220,168,0.55)"],
    [1, "rgba(240,200,140,0)"],
  ]);
  const star = sprite(32, [
    [0, "rgba(255,255,255,1)"],
    [0.12, "rgba(236,240,255,0.85)"],
    [0.35, "rgba(200,212,255,0.18)"],
    [1, "rgba(170,190,255,0)"],
  ]);

  let sheets: MothSheets | null = null;
  let sheetCell = 0;
  type Art = { s: Surface; key: string };
  type StageArt = { unlit: Surface; lit: Surface; key: string };
  let moonArt: { s: Surface; size: number; key: string } | null = null;
  let stageArt: StageArt | null = null;
  let midArt: Art | null = null;
  let groundArt: Art | null = null;
  let relight: Surface | null = null;
  let skyKey = "";
  let gardenKey = "";

  /* ------------------------------------------------------------ layout state */

  let W = 0;
  let H = 0;
  let span = 40;
  let margin = 16;
  let snap: PageSnapshot = ctx.page.getSnapshot();
  let moon: MoonPlacement = { x: 0, y: 0, r: 20, ring: false };
  let moonRing = { rx: 60, ry: 60 };
  let stage: StageLayout | null = null;
  let mid: MidLayout | null = null;
  let ground: GroundLayout | null = null;
  /** Document position of each window canvas's top-left corner. */
  const winDoc: Record<WindowName, { x: number; y: number; w: number; h: number } | null> = { stage: null, mid: null, ground: null };
  let spots: Spot[] = [];
  /** Displayed bloom per stage flower (eases toward the reading state). */
  const blooms = new Map<string, number>();
  let finishedSlugs = new Set<string>();
  let ptr: PointerState | null = null;
  let lastWin: HubFrame["win"] = { stage: null, mid: null, ground: null };

  /* ------------------------------------------------------------ world state */

  const swing: Swing = { angle: 0.04, vel: 0, spin: 0, spinVel: 0 };
  let stillPose = 0;
  let stillSpin = 0;
  let flame = 1;
  let door = 0;
  let flick = 1;
  let clock = 0;
  let scrollY = 0;
  let scrollSpeed = 0;
  let calmSince: number | null = 0;
  let skyShift = 0;
  let wasStill = false;
  let introAt = -1;
  let introPending = false;
  let introBoost = 1;
  let flockPlaced = false;
  let lanterns: HungLantern[] = [];
  let nextLantern = 1;
  let stageTaps = 0;
  /** The attended card, and when attention left each card (ms of scene time). */
  let attSlug: string | null = null;
  const ended = new Map<string, number>();
  let curTier: 0 | 1 | 2 = 0;
  let pick: { slug: string; at: number } | null = null;
  let nextChipAt = 40 + rng() * 50;
  const hand = { x: -999, y: -999, px: 0, py: 0, intensity: 0, movedAt: 0, lingerUntil: -1, free: false, active: false, mouse: true };
  const hold = { since: -1, x: 0, y: 0, ok: false };
  let lastRootAt = -1;
  const cardAt = new Map<string, number>();

  const moths: Moth[] = [];
  const dust = { x: new Float32Array(240), y: new Float32Array(240), vx: new Float32Array(240), vy: new Float32Array(240), age: new Float32Array(240), life: new Float32Array(240), size: new Float32Array(240), count: 0 };
  const lights: (Light & { key: string })[] = [];
  /** The stage lantern's own viewport position (the light entry carries the spin sweep). */
  let lampV = { x: 0, y: 0 };
  const holesV: Rect[] = [];
  const coverV: Rect[] = [];

  /* ------------------------------------------------------------ geometry helpers */

  const travel = (y: number) => {
    const cap = H * SKY_OVERSCAN;
    return cap > 0 ? cap * (1 - Math.exp((-0.15 * Math.max(0, y)) / cap)) : 0;
  };
  /** Canvas-local to viewport for a window plane (also when it is off screen). */
  const view = (plane: WindowName, x: number, y: number) => {
    const d = winDoc[plane];
    return d ? { x: d.x + x, y: d.y + y - scrollY } : null;
  };
  const isHit = (r: Rect) => [snap.windows.stageHit, snap.windows.midHit].some((h) => h.x === r.x && h.y === r.y && h.w === r.w && h.h === r.h);
  const cardRect = (c: CardInfo): Rect => ({ x: c.rect.x, y: c.rect.y - scrollY, w: c.rect.w, h: c.rect.h });
  const cardBySlug = (slug: string | null) => (slug ? (snap.cards.find((c) => c.slug === slug) ?? null) : null);
  const inView = (y: number, pad = 0) => y > -pad && y < H + pad;
  /** Document y of the first garden horizon (the stage bed, else the mid lawn, else the footer ridge). */
  const horizonDoc = () => {
    if (stage && winDoc.stage) return winDoc.stage.y + stage.bedY;
    if (mid && winDoc.mid) return winDoc.mid.y + mid.groundY;
    if (ground && winDoc.ground) return winDoc.ground.y + ground.ridgeY;
    return Number.POSITIVE_INFINITY;
  };

  /* ------------------------------------------------------------ layout */

  const relayout = (f: HubFrame) => {
    snap = f.page;
    const vw = snap.viewport.w;
    const short = Math.min(W || vw, H || snap.viewport.h);
    span = mothSpan(short);
    margin = clamp(short * 0.03, 10, 24);
    const avoid = [...snap.holes, ...snap.cover];
    moon = placeMoon(W || vw, H || snap.viewport.h, moonRadius(short), avoid, moonSide(snap.mode), snap.gutters.right, snap.mode === "landscape-short" ? 2.4 : 1.6);
    moonRing = moonOrbit(moon, span, avoid);
    const rand = createRng(ctx.seed ^ 0x51a7);
    for (const name of WINDOWS) {
      const box = snap.windows[name];
      winDoc[name] = box.w > 0 && box.h > 0 ? { x: box.x + box.w / 2 - vw / 2, y: box.y, w: vw, h: box.h } : null;
    }
    const local = (name: WindowName, r: Rect): Rect => {
      const d = winDoc[name];
      return d ? { x: r.x - d.x, y: r.y - d.y, w: r.w, h: r.h } : r;
    };
    const sd = winDoc.stage;
    stage = sd ? stageLayout(vw, sd.h, local("stage", snap.windows.stage), local("stage", snap.windows.stageHit), snap.cards, rand) : null;
    const md = winDoc.mid;
    if (md) {
      const box = local("mid", snap.windows.mid);
      const labels = snap.holes.filter((r) => !isHit(r) && r.y >= md.y && r.y < md.y + md.h && r.x < box.x + box.w).map((r) => local("mid", r));
      mid = midLayout(vw, md.h, box, labels, snap.cards.filter((c) => c.kind === "upcoming"), rand);
    } else mid = null;
    const gd = winDoc.ground;
    if (gd) {
      const texts = snap.holes.filter((r) => r.y >= gd.y && r.y < gd.y + gd.h);
      const top = texts.length ? Math.min(...texts.map((r) => r.y)) - gd.y : gd.h * 0.7;
      ground = groundLayout(vw, gd.h, local("ground", snap.windows.ground), top, rand);
    } else ground = null;
    finishedSlugs = new Set(snap.cards.filter((c) => c.finished).map((c) => c.slug));
    rebuildSpots();
    bakeWindows(snap);
  };

  const rebuildSpots = () => {
    const old = spots;
    const next: Spot[] = [];
    if (stage) {
      for (const fl of stage.flowers) {
        const card = cardBySlug(fl.slug);
        if (fl.locked || !card || card.finished || bloomOf(card.read, card.finished) < 0.25) continue;
        next.push({ plane: "stage", x: fl.x + fl.lean * fl.stem, y: stage.bedY - fl.stem, r: clamp(fl.stem * 0.16, 5, 12), claimedBy: -1 });
      }
    }
    if (mid) for (const p of mid.spots) next.push({ plane: "mid", x: p.x, y: p.y, r: p.r, claimedBy: -1 });
    if (ground) for (const p of ground.spots) next.push({ plane: "ground", x: p.x, y: p.y, r: p.r, claimedBy: -1 });
    const same = old.length === next.length && old.every((s, i) => s.plane === next[i].plane);
    for (const m of moths) {
      if (m.spot < 0) continue;
      if (same) {
        next[m.spot].claimedBy = m.id;
        continue;
      }
      if (m.phase === "rest") liftOff(m);
      m.spot = -1;
      if (m.goal === "flower") setGoal(m, "wander");
    }
    spots = next;
  };

  const bakeWindows = (s: PageSnapshot) => {
    const dpr = Math.min(Math.max(1, s.viewport.dpr), KIT_DPR_CAP);
    if (stage) {
      const st = stage;
      const key = `${st.w}x${st.h}@${dpr}:${Math.round(st.hookX)}`;
      const side = Math.ceil(relightRadius(st) * 2 * dpr);
      if (!relight || relight.canvas.width !== side) now$("relight", (alloc) => (relight = alloc(side, side)));
      if (stageArt?.key !== key) {
        job(
          "stage",
          (alloc, free) => [
            () => {
              const art = stageBase(alloc, free, st, dpr, ctx.seed ^ 0x9f1a);
              pendingStage = { ...art, key };
            },
          ],
          () => {
            stageArt = pendingStage;
          },
        );
      }
    }
    if (mid) {
      const md = mid;
      const key = `${md.w}x${md.h}@${dpr}:${md.spots.length}:${md.cocoons.length}`;
      if (midArt?.key !== key) {
        job("mid", (alloc) => [() => (pendingMid = { s: midBase(alloc, md, dpr, ctx.seed ^ 0x4d1d), key })], () => {
          midArt = pendingMid;
        });
      }
    }
    if (ground) {
      const gd = ground;
      const key = `${gd.w}x${gd.h}@${dpr}:${Math.round(gd.ridgeY)}`;
      if (groundArt?.key !== key) {
        job("ground", (alloc) => [() => (pendingGround = { s: groundBase(alloc, gd, dpr, ctx.seed ^ 0x6a0d), key })], () => {
          groundArt = pendingGround;
        });
      }
    }
  };
  let pendingStage: StageArt | null = null;
  let pendingMid: Art | null = null;
  let pendingGround: Art | null = null;

  const paintSky = (f: HubFrame) => {
    const sky = planes.statics[0].canvas;
    const dpr = staticDpr(f.page.viewport);
    const boxH = Math.round(H * (1 + SKY_OVERSCAN));
    const key = `${W}x${boxH}@${dpr}:${Math.round(moon.x)},${Math.round(moon.y)},${moon.r}:${phaseBucket(ctx.moonPhase)}`;
    if (key === skyKey) return;
    skyKey = key;
    sky.width = Math.round(W * dpr);
    sky.height = Math.round(boxH * dpr);
    const g = sky.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintSkyBase(g, W, boxH, H, createRng(ctx.seed ^ 0xd1));
    const spec = { w: W, h: boxH, vh: H, moon: { ...moon, lit: moonShape(ctx.moonPhase).lit } };
    let neb: Surface | null = null;
    let step = 8;
    job(
      "sky",
      (alloc, free) => [
        ...nebulaSteps(alloc, spec, noise, dustNoise, 4, (s, st) => {
          neb = s;
          step = st;
        }),
        () => {
          g.setTransform(dpr, 0, 0, dpr, 0, 0);
          finishSky(g, spec, neb, step, createRng(ctx.seed ^ 0x5a7));
          if (neb) free(neb);
        },
      ],
      () => {},
    );
  };

  const paintGardens = (f: HubFrame) => {
    const scale = GARDEN_SCALE * Math.min(1.25, f.page.viewport.dpr);
    const left = snap.shell.x;
    const right = snap.shell.x + snap.shell.w;
    const floor = Math.round(horizonDoc());
    const key = `${W}x${H}@${scale}:${Math.round(left)}:${f.tier}:${Math.round(moon.x)},${Math.round(moon.y)}:${floor}:${snap.mode}`;
    if (key === gardenKey) return;
    gardenKey = key;
    const spec = { w: W, h: H, left, right, phone: snap.mode === "phone" || snap.mode === "landscape-short", moon, floor, wide: snap.mode === "wide" };
    const sways = [0, -1, 1];
    // One step per side of each plane keeps every idle step short.
    const steps = planes.statics.slice(1).flatMap((plane, i) => {
      const c = plane.canvas;
      const sideStep = (side: -1 | 1) => () => {
        if (side < 0) {
          c.width = Math.round(W * scale);
          c.height = Math.round(H * scale);
        }
        // Tier 1 and 2 drop the sway: the two extra phases stay blank.
        if (i > 0 && f.tier > 0) return;
        const g = c.getContext("2d");
        if (!g) return;
        g.setTransform(scale, 0, 0, scale, 0, 0);
        paintGarden(g, spec, sways[i], ctx.seed ^ 0x6a4d, side);
      };
      return [sideStep(-1), sideStep(1)];
    });
    paint.run("garden", steps);
  };

  const paintMoonArt = (dpr: number) => {
    const key = `${moon.r}@${dpr}:${phaseBucket(ctx.moonPhase)}`;
    if (moonArt?.key === key) return;
    now$("moon", (alloc) => {
      const art = paintMoon(alloc, moon.r, dpr, phaseBucket(ctx.moonPhase) / 8, noise);
      moonArt = { ...art, key };
    });
  };

  const buildSheets = (dpr: number) => {
    const cell = Math.ceil(span * 1.15 * CELL_UNITS * dpr);
    if (cell === sheetCell) return;
    sheetCell = cell;
    let made: MothSheets | null = null;
    job(
      "sheets",
      (alloc, free) =>
        mothSheetSteps(cell, alloc, free, (s) => {
          made = s;
        }),
      () => {
        sheets = made;
      },
    );
  };

  /* ------------------------------------------------------------ moths */

  const makeMoth = (i: number, far: boolean): Moth => {
    const depth = far ? range(0.36, 0.52) : range(0.72, 1.12);
    return {
        id: i,
        far,
        type: i % PALETTE_COUNT,
        depth,
        x: range(0, Math.max(1, W)),
        y: range(0, Math.max(1, H) * 0.6),
        heading: range(-Math.PI, Math.PI),
        disp: 0,
        speed: 0,
        cruise: (far ? 38 : 70) * depth * (0.85 + rng() * 0.3),
        turn: 0,
        flapPhase: rng() * TAU,
        flapRate: far ? range(4.2, 5.6) : range(3, 4.2),
        flapping: true,
        glideTimer: range(1, 4),
        goal: "wander",
        goalTimer: 0,
        side: 1,
        phase: "fly",
        phaseTimer: 0,
        retreatHeading: 0,
        anchorX: 0,
        anchorY: 0,
        lamp: "stage",
        spot: -1,
        restClock: rng() * TAU,
        restTilt: 0,
        restCooldown: range(2, 10),
        warm: 0,
        litX: 0,
        dustCarry: 0,
        sepX: 0,
        sepY: 0,
        orbitScale: range(0.75, 1.25),
        orbitAspect: range(0.62, 1),
        orbitTilt: range(0, Math.PI),
        precess: (rng() < 0.5 ? -1 : 1) * range(0.05, 0.14),
        target: "",
        lander: false,
        u: 0.5,
        perchId: 0,
        perchUntil: 0,
        swirlUntil: 0,
    };
  };
  const spawn = () => {
    for (let i = 0; i < 12 + FAR_MOTHS; i++) moths.push(makeMoth(i, i >= 12));
  };
  const activeCount = (tier: 0 | 1 | 2) => mothCount(W, H, tier);
  const isActive = (m: Moth, tier: 0 | 1 | 2) => (m.far ? m.id - 12 < (tier === 0 ? FAR_MOTHS : 1) : m.id < activeCount(tier));

  const clearAt = (x: number, y: number, pad: number) => holesV.every((r) => distTo(x, y, r) >= pad);

  const pickAnchor = (m: Moth) => {
    const areas = openAreas(snap, scrollY);
    const total = areas.reduce((n, r) => n + r.w * r.h, 0);
    const pad = span * m.depth * 0.8;
    for (let attempt = 0; attempt < 10; attempt++) {
      // Larger open areas in view get more of the flock, so moths follow the reader.
      let pickAt = rng() * total;
      const a = areas.find((r) => (pickAt -= r.w * r.h) <= 0) ?? { x: 0, y: 0, w: W, h: H * 0.4 };
      m.anchorX = clamp(a.x + rng() * a.w, margin, W - margin);
      m.anchorY = clamp(a.y + rng() * a.h, margin, H - margin);
      if (clearAt(m.anchorX, m.anchorY, pad) && !coverV.some((r) => inside(m.anchorX, m.anchorY, r))) return;
    }
  };

  const releaseSpot = (m: Moth) => {
    const s = spots[m.spot];
    if (s && s.claimedBy === m.id) s.claimedBy = -1;
    m.spot = -1;
  };

  const spotView = (s: Spot) => view(s.plane, s.x, s.y - s.r * 0.25);

  const claimSpot = (m: Moth): boolean => {
    const docs = spots.map((s) => {
      const v = spotView(s);
      return v ? { x: v.x, y: v.y + scrollY } : { x: -1e4, y: -1e4 };
    });
    let best = -1;
    let bestD = Infinity;
    for (const i of visibleSpots(docs, { ...snap, holes: snap.holes.filter((r) => !isHit(r)) }, scrollY, 10)) {
      if (spots[i].claimedBy >= 0) continue;
      const d = Math.hypot(docs[i].x - m.x, docs[i].y - scrollY - m.y) * (0.6 + rng() * 0.8);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) return false;
    spots[best].claimedBy = m.id;
    m.spot = best;
    return true;
  };

  /** Viewport position and orbit size of a lamp by key, or null when it is not on screen. */
  const lampAt = (key: string) => {
    const l = lights.find((x) => x.key === key);
    return l && inView(l.y, 30) && l.x > -30 && l.x < W + 30 ? l : null;
  };
  const nearestLamp = (m: Moth) => {
    let best = "";
    let bestD = Infinity;
    for (const l of lights) {
      if (l.key === "hand" || !lampAt(l.key)) continue;
      const d = Math.hypot(l.x - m.x, l.y - m.y);
      if (d < bestD) {
        bestD = d;
        best = l.key;
      }
    }
    return best;
  };

  const setGoal = (m: Moth, goal: Goal) => {
    if (m.goal === "flower" && goal !== "flower") releaseSpot(m);
    m.goal = goal;
    m.goalTimer = range(8, 18);
    m.side = rng() < 0.5 ? 1 : -1;
    if (goal === "lamp") {
      m.lamp = nearestLamp(m);
      if (!m.lamp) m.goal = "moon";
    }
    if (goal === "flower" && !claimSpot(m)) m.goal = "wander";
    if (m.goal === "wander") pickAnchor(m);
  };

  const pickGoal = (m: Moth): Goal => {
    const r = rng();
    const room = clamp(Math.min(moonRing.rx, moonRing.ry) / (span * 1.6), 0.3, 1);
    if (m.far) return r < 0.5 * room ? "moon" : "wander";
    if (r < 0.32) return "lamp";
    if (r < 0.32 + 0.14 * room) return "moon";
    if (r < 0.74 && m.restCooldown <= 0) return "flower";
    return "wander";
  };

  const liftOff = (m: Moth) => {
    if (m.phase === "rest" && m.spot >= 0) {
      const v = spotView(spots[m.spot]);
      if (v) {
        m.x = v.x;
        m.y = v.y;
      }
    }
    if (m.perchId) {
      out.unperch(m.perchId);
      m.perchId = 0;
    }
    m.phase = "takeoff";
    m.phaseTimer = 0.7;
    m.heading = -Math.PI / 2 + range(-0.6, 0.6);
    m.restCooldown = range(8, 18);
    releaseSpot(m);
  };

  const emitDust = (x: number, y: number, vx: number, vy: number, s: number, cap: number) => {
    let i = dust.count;
    if (i >= cap) i = Math.floor(rng() * cap);
    else dust.count++;
    dust.x[i] = x + (rng() - 0.5) * s * 0.6;
    dust.y[i] = y + (rng() - 0.5) * s * 0.3;
    dust.vx[i] = vx * 0.15 + (rng() - 0.5) * 14;
    dust.vy[i] = vy * 0.1 + 6 + rng() * 12;
    dust.age[i] = 0;
    dust.life[i] = 1.4 + rng() * 1.8;
    dust.size[i] = 0.7 + rng() * 1.5;
  };

  const push = { x: 0, y: 0, inside: false };
  /**
   * Steering away from page text. Cards and panels are opaque and above the sky, so moths may
   * cross behind them; only text would clash with a moth showing through between glyphs.
   */
  const avoidPush = (m: Moth, s: number, skip: Rect | null) => {
    push.x = 0;
    push.y = 0;
    push.inside = false;
    const pad = s * 0.75 + 6;
    for (const r of holesV) {
      if (r === skip || r.y > H + pad || r.y + r.h < -pad) continue;
      const qx = clamp(m.x, r.x, r.x + r.w);
      const qy = clamp(m.y, r.y, r.y + r.h);
      const dx = m.x - qx;
      const dy = m.y - qy;
      const d = Math.hypot(dx, dy);
      if (d > 0) {
        if (d < pad) {
          push.x += (dx / d) * (1 - d / pad) * 2.4;
          push.y += (dy / d) * (1 - d / pad) * 2.4;
        }
        continue;
      }
      const mn = Math.min(m.x - r.x, r.x + r.w - m.x, m.y - r.y, r.y + r.h - m.y);
      if (mn === m.x - r.x) push.x -= 3;
      else if (mn === r.x + r.w - m.x) push.x += 3;
      else if (mn === m.y - r.y) push.y -= 3;
      else push.y += 3;
      push.inside = true;
    }
  };

  const orbit = { x: 0, y: 0, rx: 0, ry: 0, rot: 0, tx: 0, ty: 0, bump: 0 };
  /** Fills `orbit` with the moth's own ellipse around its light and the point it darts at. */
  const orbitFor = (m: Moth, t: number): boolean => {
    if (m.goal === "moon") {
      const s = m.orbitScale * (m.far ? 1.15 : 1);
      orbit.x = moon.x;
      orbit.y = moon.y - skyShift;
      orbit.rx = moonRing.rx * Math.min(1, s);
      orbit.ry = moonRing.ry * Math.min(1, s * m.orbitAspect + 0.2);
      orbit.rot = 0.3 * Math.sin(t * m.precess * 2 + m.orbitTilt);
      orbit.tx = orbit.x;
      orbit.ty = orbit.y;
      orbit.bump = 0;
      return true;
    }
    const l = m.goal === "pointer" ? (hand.intensity > 0.05 ? { x: hand.x, y: hand.y } : null) : lampAt(m.lamp);
    if (!l) return false;
    const fast = m.swirlUntil > t;
    const base = m.goal === "pointer" ? span * 1.7 : clamp(span * 2.2, 50, 110);
    const o = fitOrbit(l.x, l.y, base * m.orbitScale * (fast ? 0.7 : 1), base * m.orbitScale, W, H, margin);
    orbit.x = o.x;
    orbit.y = o.y;
    orbit.rx = o.rx;
    orbit.ry = o.ry * m.orbitAspect;
    orbit.rot = m.orbitTilt + t * m.precess;
    orbit.tx = l.x;
    orbit.ty = l.y;
    orbit.bump = m.goal === "pointer" ? 8 : span * 0.35;
    return true;
  };

  const stepMoth = (m: Moth, dt: number, t: number, tier: 0 | 1 | 2) => {
    const s = span * m.depth;
    m.goalTimer -= dt;
    m.phaseTimer -= dt;
    m.restCooldown -= dt;

    if (m.phase === "perch") {
      const card = m.target === "chip" ? null : cardBySlug(m.target);
      const host = m.target === "chip" ? chipRect() : card ? cardRect(card) : null;
      if (host) {
        m.x = host.x + m.u * host.w;
        m.y = host.y - 4;
      }
      const attended = m.target !== "chip" && attSlug === m.target;
      const leave =
        !host ||
        (m.target === "chip" ? t > m.perchUntil || scrollSpeed > 300 || !inView(host.y) : perchLeaves(scrollSpeed, attended, ended.get(m.target) ?? null, t * 1000));
      if (leave) {
        const slug = m.target;
        liftOff(m);
        if (attended) {
          // Hover above the card and land again after a second of calm.
          m.goal = "card";
          m.target = slug;
          m.goalTimer = 30;
        } else setGoal(m, "wander");
      }
      return;
    }

    const pointerOn = hand.intensity > 0.3;
    if (!m.far && pointerOn && m.goal !== "pointer" && m.goal !== "card" && m.goal !== "chip" && (m.phase === "fly" || m.phase === "rest") && pointerMoths < MAX_POINTER_MOTHS && rng() < dt * 1.2) {
      if (Math.hypot(hand.x - m.x, hand.y - m.y) < Math.hypot(W, H) * (0.3 + rng() * 0.35)) {
        if (m.phase === "rest") liftOff(m);
        setGoal(m, "pointer");
        pointerMoths++;
      }
    }
    // The pointer goal is kept while the hand lantern stays lit.
    if (m.goal === "pointer" && hand.intensity < 0.12) setGoal(m, pickGoal(m));
    if (m.goalTimer <= 0 && m.phase === "fly" && m.goal !== "pointer" && m.goal !== "card" && m.goal !== "chip") setGoal(m, pickGoal(m));

    if (m.phase === "rest") {
      const sp = spots[m.spot];
      const v = sp ? spotView(sp) : null;
      if (!sp || !v) {
        m.phase = "fly";
      } else {
        m.x = v.x;
        m.y = v.y;
        m.restClock += dt * (TAU / 4.6);
        m.speed = 0;
        if (m.phaseTimer <= 0) {
          liftOff(m);
          setGoal(m, rng() < 0.5 ? "wander" : "lamp");
        }
        return;
      }
    }

    let desired = m.heading;
    let speedMul = 1;
    let maxTurn = m.far ? 2.2 : 3;
    let forceFlap = false;
    let near = false;
    let skip: Rect | null = null;

    if (m.phase === "takeoff") {
      desired = -Math.PI / 2;
      speedMul = 0.8;
      forceFlap = true;
      if (m.phaseTimer <= 0) m.phase = "fly";
    } else if (m.phase === "retreat") {
      desired = m.retreatHeading;
      speedMul = 1.6;
      maxTurn = 5;
      forceFlap = true;
      if (m.phaseTimer <= 0) m.phase = "fly";
    } else if (m.goal === "flower" && m.spot >= 0) {
      const v = spotView(spots[m.spot]);
      if (!v || !inView(v.y, 40)) {
        setGoal(m, "wander");
      } else {
        const d = Math.hypot(v.x - m.x, v.y - m.y);
        desired = Math.atan2(v.y - m.y, v.x - m.x);
        speedMul = clamp(d / 160, 0.3, 1);
        maxTurn = 4.5;
        near = d < 60;
        if (d < 50) {
          const pull = Math.min(1, dt * (2 + (50 - d) * 0.08));
          m.x += (v.x - m.x) * pull;
          m.y += (v.y - m.y) * pull;
        }
        if (d < 3 + s * 0.05) {
          m.phase = "rest";
          m.phaseTimer = range(8, 16);
          m.restTilt = range(-0.3, 0.3);
          m.restClock = 0;
          m.disp = m.restTilt;
          return;
        }
      }
    } else if (m.goal === "card" || m.goal === "chip") {
      const card = m.goal === "card" ? cardBySlug(m.target) : null;
      const host = m.goal === "chip" ? chipRect() : card ? cardRect(card) : null;
      const attended = m.goal === "chip" || attSlug === m.target || (pick?.slug === m.target && t - pick.at < 6);
      if (!host || !attended || m.goalTimer <= 0 || (m.goal === "chip" && (t > m.perchUntil || !inView(host.y)))) {
        setGoal(m, "wander");
      } else if (m.swirlUntil > t) {
        m.lamp = "stage";
        desired = steerOrbit(m, t);
      } else {
        skip = m.goal === "chip" ? (holesV.find((r) => Math.abs(r.x - host.x) < 1 && Math.abs(r.y - host.y) < 1) ?? null) : null;
        const landAt = { x: host.x + m.u * host.w, y: host.y - 4 };
        const hoverAt = { x: host.x + (0.5 + 0.38 * Math.sin(t * 0.7 + m.id)) * host.w, y: clamp(host.y - 30 - 12 * Math.sin(t * 1.3 + m.id * 2), margin, H - margin) };
        const calm = mayReland(true, calmSince, t * 1000) && inView(landAt.y, -12);
        const tgt = m.lander && calm ? landAt : hoverAt;
        const d = Math.hypot(tgt.x - m.x, tgt.y - m.y);
        desired = Math.atan2(tgt.y - m.y, tgt.x - m.x);
        speedMul = clamp(d / 140, 0.35, 1.2);
        maxTurn = 4.5;
        near = d < 50;
        if (m.lander && calm && d < 40) {
          const pull = Math.min(1, dt * (3 + (40 - d) * 0.1));
          m.x += (tgt.x - m.x) * pull;
          m.y += (tgt.y - m.y) * pull;
          if (d < 4) {
            const id = out.perch(m.goal === "chip" ? "chip" : m.target, { kind: "moth", u: m.u });
            if (id > 0) {
              m.perchId = id;
              m.phase = "perch";
              if (m.goal === "card") out.beat(m.target, "perch");
              else m.perchUntil = t + range(6, 10);
              return;
            }
            m.lander = false;
          }
        }
      }
    } else if (m.goal === "wander") {
      if (Math.hypot(m.anchorX - m.x, m.anchorY - m.y) < 50) pickAnchor(m);
      desired = Math.atan2(m.anchorY - m.y, m.anchorX - m.x) + flightNoise(m.id * 5.3, t * 0.12) * 1.1;
    } else if (!orbitFor(m, t)) {
      setGoal(m, "wander");
    } else if (m.phase === "dart") {
      desired = Math.atan2(orbit.ty - m.y, orbit.tx - m.x);
      speedMul = 1.5;
      maxTurn = 7;
      forceFlap = true;
      if (Math.hypot(orbit.tx - m.x, orbit.ty - m.y) < orbit.bump + s * 0.2 || m.phaseTimer <= 0) {
        m.phase = "retreat";
        m.phaseTimer = range(0.4, 0.8);
        m.retreatHeading = desired + Math.PI + range(-0.7, 0.7);
        for (let k = 0; k < 6; k++) emitDust(m.x, m.y, 0, 0, s, MAX_DUST[tier]);
      }
    } else {
      desired = steerOrbit(m, t);
      if (orbit.bump > 0 && m.swirlUntil <= t && rng() < dt * 0.3) {
        m.phase = "dart";
        m.phaseTimer = 0.9;
      }
    }

    const zone = margin * 2;
    let px = 0;
    let py = 0;
    if (m.x < zone) px += (zone - m.x) / zone;
    if (m.x > W - zone) px -= (m.x - (W - zone)) / zone;
    if (m.y < zone) py += (zone - m.y) / zone;
    if (m.y > H - zone) py -= (m.y - (H - zone)) / zone;
    avoidPush(m, s, skip);
    const sep = near ? 0 : 1;
    const vx = Math.cos(desired) + px * 2.2 + push.x + m.sepX * sep;
    const vy = Math.sin(desired) + py * 2.2 + push.y + m.sepY * sep;
    desired = Math.atan2(vy, vx);
    if (push.inside) maxTurn = Math.max(maxTurn, 5);

    const turbulence = flightNoise(t * 0.55 + m.id * 17.1, m.id * 3.3) * (m.phase === "fly" ? 1.1 : 0.4);
    const targetTurn = clamp(wrapAngle(desired - m.heading) * 3.2, -maxTurn, maxTurn) + turbulence;
    m.turn += (targetTurn - m.turn) * Math.min(1, dt * 6);
    m.heading = wrapAngle(m.heading + m.turn * dt);
    m.disp += (displayAngle(m.heading) - m.disp) * Math.min(1, dt * 5);

    m.glideTimer -= dt;
    const hard = Math.abs(m.turn) > 1.5;
    if (m.flapping) {
      if (!forceFlap && m.glideTimer <= 0 && !hard) {
        m.flapping = false;
        m.glideTimer = range(0.5, 1.3);
      }
    } else if (forceFlap || hard || m.glideTimer <= 0) {
      m.flapping = true;
      m.glideTimer = range(1.6, 4.5);
    }
    if (m.flapping) m.flapPhase += TAU * m.flapRate * (1 + 0.7 * Math.min(1, Math.abs(m.turn) / 2.5) + (forceFlap ? 0.35 : 0)) * dt;
    else {
      const into = m.flapPhase % TAU;
      m.flapPhase += Math.min(into === 0 ? 0 : TAU - into, TAU * m.flapRate * 0.8 * dt);
    }
    if (m.flapPhase > TAU * 1000) m.flapPhase %= TAU;

    const target = m.cruise * clamp(span / 40, 0.7, 1.15) * introBoost * speedMul * (m.flapping ? 1 : 0.85) * (push.inside ? 1.3 : 1);
    m.speed += (target - m.speed) * Math.min(1, dt * 2.5);
    m.x = clamp(m.x + Math.cos(m.heading) * m.speed * dt, -40, W + 40);
    m.y = clamp(m.y + Math.sin(m.heading) * m.speed * dt + (m.flapping ? 0 : 7 * m.depth * dt), -40, H + 40);
  };

  /** Steers along the moth's own tilted ellipse, in the ellipse's normalised frame. */
  const steerOrbit = (m: Moth, t: number): number => {
    if (!orbitFor(m, t)) return m.heading;
    const c = Math.cos(orbit.rot);
    const sn = Math.sin(orbit.rot);
    const rx = Math.max(8, orbit.rx);
    const ry = Math.max(8, orbit.ry);
    const dx = m.x - orbit.x;
    const dy = m.y - orbit.y;
    const lx = (dx * c + dy * sn) / rx;
    const ly = (-dx * sn + dy * c) / ry;
    const d = Math.hypot(lx, ly) || 1e-3;
    const a = Math.atan2(-ly, -lx) - m.side * clamp(Math.PI / 2 - 1.15 * (d - 1), 0.3, 2.3);
    const ux = Math.cos(a) * rx;
    const uy = Math.sin(a) * ry;
    return Math.atan2(ux * sn + uy * c, ux * c - uy * sn);
  };

  let pointerMoths = 0;

  const separate = () => {
    for (const m of moths) {
      m.sepX = 0;
      m.sepY = 0;
    }
    for (let i = 0; i < moths.length; i++) {
      const a = moths[i];
      if (a.phase === "rest" || a.phase === "perch") continue;
      for (let j = i + 1; j < moths.length; j++) {
        const b = moths[j];
        if (b.phase === "rest" || b.phase === "perch" || a.far !== b.far) continue;
        const lim = span * 1.2 * Math.max(a.depth, b.depth);
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= lim * lim) continue;
        const d = Math.sqrt(d2) || 1e-3;
        const k = (1 - d / lim) * 1.6;
        a.sepX += (dx / d) * k;
        a.sepY += (dy / d) * k;
        b.sepX -= (dx / d) * k;
        b.sepY -= (dy / d) * k;
      }
    }
  };

  /** Warm light on a moth from every light, for its rim and its wing dust. */
  const warmLight = (m: Moth, dt: number) => {
    let wx = 0;
    let wy = 0;
    let total = 0;
    for (const l of lights) {
      const dx = l.x - m.x;
      const dy = l.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      const k = falloff(d, l.range * 0.4) * l.power;
      total += k;
      wx += (dx / d) * k;
      wy += (dy / d) * k;
    }
    const warm = Math.min(1, total * 1.4);
    const wl = Math.hypot(wx, wy) || 1;
    const local = (wx / wl) * Math.cos(m.disp) + (wy / wl) * Math.sin(m.disp);
    const k = dt === 0 ? 1 : Math.min(1, dt * 5);
    m.warm += (warm - m.warm) * k;
    m.litX += (local - m.litX) * k;
  };

  /* ------------------------------------------------------------ lights and page */

  const chipRect = (): Rect | null => {
    const c = snap.parts.chip;
    return c ? { x: c.x, y: c.y - scrollY, w: c.w, h: c.h } : null;
  };

  const buildLights = (t: number) => {
    lights.length = 0;
    const R = clamp(H * 0.85, 380, 780);
    if (stage) {
      const lp = lanternPos(stage, swing.angle);
      const v = view("stage", lp.x, lp.y);
      // The glazed side throws more light: spinning sweeps it across the cards.
      const beam = Math.sin(swing.spin);
      if (v) lampV = v;
      if (v) lights.push({ key: "stage", x: v.x + beam * R * 0.45 * Math.min(1, Math.abs(swing.spinVel) / 2 + 0.25), y: v.y, range: R, power: flame * flick * (1 + door * 0.35) });
    }
    if (mid) {
      const v = view("mid", mid.lamp.x, mid.lamp.y);
      if (v) lights.push({ key: "mid", x: v.x, y: v.y, range: R * 0.75, power: 0.72 * flame * flicker(t, 2.1) });
    }
    if (ground) {
      const v = view("ground", ground.lamp.x, ground.lamp.y);
      if (v) lights.push({ key: "ground", x: v.x, y: v.y, range: R * 0.7, power: 0.7 * flame * flicker(t, 4.3) });
    }
    for (const l of lanterns) {
      const d = winDoc[l.plane];
      if (!d) continue;
      const v = view(l.plane, l.u * d.w, l.v * d.h);
      if (v) lights.push({ key: `h${l.id}`, x: v.x, y: v.y, range: R * 0.6, power: 0.78 * flicker(t, l.id * 1.37) });
    }
    if (hand.intensity > 0.02) lights.push({ key: "hand", x: hand.x, y: hand.y, range: R * 0.55, power: 0.85 * hand.intensity });
  };

  const cardVars = (c: CardInfo, still: boolean): CardVars => {
    const rect = cardRect(c);
    const lit = cardLight(rect, lights);
    let { glow, lx, ly } = lit;
    if (c.slug === attSlug) {
      glow = Math.max(glow, 0.62);
      lx = 0.5;
      ly = -0.2;
    }
    if (pick && c.slug === pick.slug && (still || clock - pick.at < 4)) glow = Math.max(glow, 0.7);
    const q = (v: number) => Math.round(v * 32) / 32;
    return { "w-glow": q(glow), "w-lx": q(lx), "w-ly": q(ly) };
  };

  const rootVars = (t: number) => {
    let key: (Light & { key: string }) | null = null;
    for (const l of lights) if (l.key !== "hand" && inView(l.y, 60) && (!key || l.power > key.power)) key = l;
    const q = (v: number) => Math.round(v * ROOT_STEP) / ROOT_STEP;
    return {
      "w-light-x": q(key ? clamp(key.x / Math.max(1, W), 0, 1) : 0.5),
      "w-light-y": q(key ? clamp(key.y / Math.max(1, H), 0, 1) : 0.3),
      "w-light": q(key ? clamp(key.power, 0, 1) : 0.2),
      "w-breath": q(0.5 + 0.5 * Math.sin((TAU * t) / 9)),
    };
  };

  const writeOut = (t: number) => {
    if (t - lastRootAt >= ROOT_EVERY_S || t < lastRootAt) {
      lastRootAt = t;
      out.root(rootVars(t));
    }
    for (const c of snap.cards) {
      const r = cardRect(c);
      if (r.y + r.h <= 0 || r.y >= H) continue;
      const last = cardAt.get(c.slug) ?? -1;
      if (t - last < CARD_EVERY_S && t >= last) continue;
      cardAt.set(c.slug, t);
      out.card(c.slug, cardVars(c, false));
    }
  };

  /* ------------------------------------------------------------ frame */

  const syncFrame = (f: HubFrame) => {
    W = f.width;
    H = f.height;
    snap = f.page;
    scrollY = f.scrollY;
    lastWin = f.win;
    ptr = f.pointer;
    // Still mode keeps the sky at rest; a switch snapshot puts it where the next live frame will.
    skyShift = f.staticY[0] === 0 ? 0 : travel(scrollY);
    ctx.shiftStatic(0, 0, f.staticY[0] - skyShift);
    // The hanging garden frames the hero and leaves with it, so the stage lawn never rises past
    // the vines (they end above it at scroll 0).
    const gardenShift = f.staticY[0] === 0 ? 0 : Math.min(scrollY, H * 1.5);
    for (let i = 1; i < planes.statics.length; i++) ctx.shiftStatic(i, 0, f.staticY[i] - gardenShift);
    holesV.length = 0;
    coverV.length = 0;
    // Hit buttons are invisible controls over the set pieces: moths may fly and land there.
    for (const r of snap.holes) if (!isHit(r)) holesV.push({ x: r.x, y: r.y - scrollY, w: r.w, h: r.h });
    for (const r of snap.cover) coverV.push({ x: r.x, y: r.y - scrollY, w: r.w, h: r.h });
  };

  const updateHand = (t: number, dt: number) => {
    if (hand.mouse) {
      const idle = t - hand.movedAt > MOUSE_IDLE_S;
      const target = hand.active && hand.free && !idle ? 1 : 0;
      if (hand.intensity < 0.02 && target && ptr) {
        hand.x = ptr.x;
        hand.y = ptr.y;
      }
      if (hand.free && ptr) {
        const k = Math.min(1, dt * 9);
        hand.x += (ptr.x - hand.x) * k;
        hand.y += (ptr.y - hand.y) * k;
      }
      const rate = target > hand.intensity ? 2.6 : 1.6;
      hand.intensity += clamp(target - hand.intensity, -rate * dt, rate * dt);
      return;
    }
    // Touch: only a still press of 180 ms or a tap lights it, never a scroll swipe.
    if (hold.since >= 0 && ptr?.down && hold.ok && t - hold.since >= HOLD_S) {
      hand.x = hold.x;
      hand.y = hold.y;
      hand.lingerUntil = t + TOUCH_LINGER_S;
    }
    const target = t < hand.lingerUntil ? 1 : 0;
    const rate = target > hand.intensity ? 4 : 1.6;
    hand.intensity += clamp(target - hand.intensity, -rate * dt, rate * dt);
  };

  const rebase = (t: number) => {
    // Still-to-motion handoff: fresh timers, so posed moths do not all take off at once.
    for (const m of moths) {
      m.goalTimer = range(4, 14);
      m.phaseTimer = m.phase === "rest" ? range(3, 14) : range(0.2, 1);
      m.glideTimer = range(0.5, 3);
    }
    lastRootAt = -1;
    cardAt.clear();
    nextChipAt = t + range(40, 90);
  };

  const step = (f: HubFrame) => {
    const t = f.t;
    const dt = f.dt;
    clock = t;
    if (wasStill) {
      wasStill = false;
      rebase(t);
    }
    if (introPending) {
      introPending = false;
      introAt = t;
      // Moths arrive from the edge nearest the place each one is heading for.
      for (const m of moths) {
        if (m.phase === "rest") releaseSpot(m);
        m.phase = "fly";
        setGoal(m, "wander");
        const ax = m.anchorX;
        const ay = m.anchorY;
        const side = Math.min(ax, W - ax, ay);
        m.x = side === ax ? -24 : side === W - ax ? W + 24 : ax + range(-60, 60);
        m.y = side === ay ? -24 : ay + range(-60, 60);
        m.heading = Math.atan2(ay - m.y, ax - m.x);
      }
    }
    const intro = introAt >= 0 ? t - introAt : 99;
    introBoost = 1 + 1.6 * (1 - smoothstep(0.6, 1.6, intro));
    flame = smoothstep(0, 0.8, intro);
    flick = f.tier === 2 ? 1 : flicker(t);
    door = pick ? Math.max(0, smoothstep(0, 0.4, t - pick.at) - smoothstep(0.6, 1.8, t - pick.at)) : 0;
    const speed = Math.abs(f.scrollVel);
    scrollSpeed += (speed - scrollSpeed) * Math.min(1, dt * 12);
    if (scrollSpeed < 60) calmSince ??= t * 1000;
    else calmSince = null;

    stepSwing(swing, dt, 0.06 * noise(t * 0.25, 9.1));
    updateHand(t, dt);
    buildLights(t);

    const tier = f.tier;
    pointerMoths = moths.filter((m) => m.goal === "pointer").length;
    separate();
    if (t >= nextChipAt) {
      nextChipAt = t + range(40, 90);
      const chip = chipRect();
      const busy = moths.filter((m) => m.phase === "perch").length;
      if (chip && inView(chip.y, -10) && busy < 2) {
        const m = moths.find((x) => isActive(x, tier) && !x.far && x.phase === "fly" && x.goal !== "card");
        if (m) {
          m.goal = "chip";
          m.target = "chip";
          m.lander = true;
          m.u = range(0.25, 0.75);
          m.perchUntil = t + 30;
          m.goalTimer = 30;
        } else nextChipAt = t + range(5, 10);
      } else nextChipAt = t + range(5, 10);
    }
    const cap = MAX_DUST[tier];
    for (const m of moths) {
      if (!isActive(m, tier)) {
        if (m.phase === "perch" || m.phase === "rest") liftOff(m);
        m.phase = "fly";
        continue;
      }
      stepMoth(m, dt, t, tier);
      if (m.far || m.phase === "perch") continue;
      warmLight(m, dt);
      if (m.warm > 0.08 && m.phase !== "rest") {
        m.dustCarry += dt * m.warm * (m.flapping ? 16 : 6);
        while (m.dustCarry >= 1) {
          m.dustCarry -= 1;
          emitDust(m.x, m.y, Math.cos(m.heading) * m.speed, Math.sin(m.heading) * m.speed, span * m.depth, cap);
        }
      }
    }
    let i = 0;
    while (i < dust.count) {
      dust.age[i] += dt;
      if (dust.age[i] >= dust.life[i] || i >= cap) {
        const last = --dust.count;
        dust.x[i] = dust.x[last];
        dust.y[i] = dust.y[last];
        dust.vx[i] = dust.vx[last];
        dust.vy[i] = dust.vy[last];
        dust.age[i] = dust.age[last];
        dust.life[i] = dust.life[last];
        dust.size[i] = dust.size[last];
        continue;
      }
      dust.vy[i] += 5 * dt;
      dust.vx[i] *= 1 - Math.min(1, dt * 0.8);
      dust.x[i] += (dust.vx[i] + Math.sin(t * 1.3 + i) * 4) * dt;
      dust.y[i] += dust.vy[i] * dt;
      i++;
    }
    for (const fl of stage?.flowers ?? []) {
      const card = cardBySlug(fl.slug);
      const want = card ? bloomOf(card.read, card.finished) * smoothstep(0.3, 1.5, intro) : 0;
      const cur = blooms.get(fl.slug) ?? want;
      blooms.set(fl.slug, cur + (want - cur) * Math.min(1, dt * 3));
    }
  };

  /* ------------------------------------------------------------ still composition */

  const composeStill = (f: HubFrame) => {
    clock = f.t;
    wasStill = true;
    flame = 1;
    flick = 1;
    door = 0;
    hand.intensity = 0;
    swing.angle = stillPose;
    swing.vel = 0;
    swing.spin = stillSpin;
    swing.spinVel = 0;
    dust.count = 0;
    buildLights(f.t);
    for (const fl of stage?.flowers ?? []) {
      const card = cardBySlug(fl.slug);
      blooms.set(fl.slug, card ? bloomOf(card.read, card.finished) : 0);
    }
    for (const sp of spots) sp.claimedBy = -1;
    const order = spots.map((_, i) => i).sort((a, b) => (spots[a].plane === "stage" ? 0 : 1) - (spots[b].plane === "stage" ? 0 : 1));
    const still = createRng(0x5717);
    const placed: { x: number; y: number; r: number }[] = [];
    const lamp = lights.find((l) => l.key === "stage" && inView(l.y, -20)) ?? lights.find((l) => l.key !== "hand" && inView(l.y, -20));
    const lampAngles = [-0.45, 0.5, -1.25, 1.2, -2];
    const moonAngles = [0.62 * Math.PI, 0.95 * Math.PI, 0.3 * Math.PI, 1.3 * Math.PI];
    let rested = 0;
    let lampSlot = 0;
    let moonSlot = 0;
    for (const m of moths) {
      m.perchId = 0;
      m.turn = 0;
      m.spot = -1;
      m.warm = 0;
      if (!isActive(m, f.tier)) continue;
      if (!m.far && rested < Math.min(3, order.length)) {
        const i = order[rested++];
        spots[i].claimedBy = m.id;
        m.spot = i;
        m.goal = "flower";
        m.phase = "rest";
        m.restTilt = (still() - 0.5) * 0.4;
        m.restClock = Math.PI / 2 - 0.35 + rested;
        const v = spotView(spots[i]);
        if (v) {
          m.x = v.x;
          m.y = v.y;
        }
        m.disp = m.restTilt;
        continue;
      }
      const onMoon = m.far || !lamp || moonSlot < lampSlot;
      const r = 0.8 + still() * 0.4;
      const o = onMoon ? { x: moon.x, y: moon.y - skyShift, rx: moonRing.rx, ry: moonRing.ry } : fitOrbit(lamp.x, lamp.y, span * 2.2, span * 1.8, W, H, margin);
      let a = onMoon ? moonAngles[moonSlot % 4] : lampAngles[lampSlot % 5];
      const reach = (span * m.depth) / 2;
      for (let k = 0; k < 16; k++) {
        m.x = clamp(o.x + Math.cos(a) * o.rx * r, margin + reach, W - margin - reach);
        m.y = clamp(o.y + Math.sin(a) * o.ry * r, margin + reach, H - margin - reach);
        if (clearAt(m.x, m.y, span * m.depth) && placed.every((p) => Math.hypot(p.x - m.x, p.y - m.y) >= (p.r + reach) * 1.25)) break;
        a += 0.7;
      }
      m.goal = onMoon ? "moon" : "lamp";
      m.lamp = lamp?.key ?? "stage";
      m.phase = "fly";
      m.heading = a + Math.PI / 2 + (still() - 0.5) * 0.6;
      m.disp = displayAngle(m.heading);
      m.flapPhase = TAU * (Math.floor(still() * 5) / FLAP_FRAMES);
      placed.push({ x: m.x, y: m.y, r: reach });
      if (onMoon) moonSlot++;
      else lampSlot++;
      if (!m.far) warmLight(m, 0);
    }
  };

  /* ------------------------------------------------------------ drawing */

  const drawMoth = (g: Ctx, m: Moth, x: number, y: number, k: number, rest: boolean) => {
    if (!sheets) return;
    const s = span * m.depth;
    if (m.far) {
      const d = s * 0.55;
      g.setTransform(k, 0, 0, k, x * k, y * k);
      g.globalAlpha = 0.34 + 0.08 * Math.cos(m.flapPhase);
      g.drawImage(mote, -d / 2, -d / 2, d, d);
      g.globalAlpha = 1;
      return;
    }
    let frame: number;
    let open: number;
    if (rest) {
      open = 0.62 + 0.38 * Math.sin(m.restClock);
      frame = frameForOpenness(open);
    } else {
      frame = Math.floor((((m.flapPhase % TAU) + TAU) % TAU) / TAU * FLAP_FRAMES) % FLAP_FRAMES;
      open = flapOpenness((frame / FLAP_FRAMES) * TAU);
    }
    const c = Math.cos(m.disp);
    const sn = Math.sin(m.disp);
    const bank = rest ? 1 : 1 - 0.22 * Math.min(1, Math.abs(m.turn) / 3);
    g.setTransform(c * bank * k, sn * bank * k, -sn * k, c * k, x * k, y * k);
    const cell = sheets.cell;
    const size = s * CELL_UNITS;
    const ox = -CELL_OX * s;
    const oy = -CELL_OY * s;
    const sx = frame * cell;
    const halo = s * 1.5;
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.2;
    g.drawImage(mothGlow, -halo / 2, -halo / 2 + s * 0.08, halo, halo);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.drawImage(sheets.base[m.type].canvas, sx, 0, cell, cell, ox, oy, size, size);
    const side = Math.abs(m.litX);
    const fade = smoothstep(0, 0.4, side);
    if (m.warm > 0.03 && fade > 0.01) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = Math.min(1, m.warm * (0.35 + 0.75 * side)) * fade;
      g.drawImage((m.litX >= 0 ? sheets.rimR : sheets.rimL).canvas, sx, 0, cell, cell, ox, oy, size, size);
      const glint = s * 0.3;
      g.globalAlpha = Math.min(1, m.warm * side * 0.7) * fade;
      g.drawImage(star, (m.litX >= 0 ? 1 : -1) * 0.4 * open * s - glint / 2, -0.19 * s - glint / 2, glint, glint);
      g.globalCompositeOperation = "source-over";
    }
    g.globalAlpha = 1;
  };

  /** The moth that rests on a finished novel's flower (always there, also in the still). */
  const resident = makeMoth(99, false);

  const drawLive = (g: Ctx, f: HubFrame, still: boolean) => {
    const k = g.canvas.width / Math.max(1, f.width);
    const intro = introAt >= 0 && !still ? clock - introAt : 99;
    if (moonArt && !moon.glowOnly) {
      const rise = 20 * (1 - smoothstep(0, 1.5, intro));
      const half = moonArt.size / 2;
      const y = moon.y - skyShift + rise;
      // The moon sets behind the garden: nothing of it shows below the horizon in view.
      const horizon = horizonDoc() + 2 - scrollY;
      if (horizon > y - half) {
        g.setTransform(k, 0, 0, k, 0, 0);
        const cut = horizon < y + half;
        if (cut) {
          g.save();
          g.beginPath();
          g.rect(0, y - half - 1, W, horizon - (y - half - 1));
          g.clip();
        }
        g.drawImage(moonArt.s.canvas, moon.x - half, y - half, moonArt.size, moonArt.size);
        if (cut) g.restore();
      }
    }
    // Soft halos of the window lamps on the sky, where a one-frame lag is invisible. The still
    // is not redrawn during a scroll, so it keeps them inside the windows only. Large fills cost
    // most on a slow device: tier 1 keeps the stage lamp's halo, tier 2 none.
    if (!still && f.tier < 2) {
      g.setTransform(k, 0, 0, k, 0, 0);
      const base = clamp(H * 0.3, 120, 300);
      for (const l of lights) {
        if (l.key === "hand" || l.y < -base || l.y > H + base) continue;
        const stageLamp = l.key === "stage";
        if (f.tier === 1 && !stageLamp) continue;
        const r = base * (stageLamp ? 1 : 0.7);
        glowAt(g, stageLamp ? lampV.x : l.x, stageLamp ? lampV.y : l.y, r, (stageLamp ? 0.34 : 0.24) * Math.min(1, l.power));
      }
    }
    for (const m of moths) if (m.far && isActive(m, f.tier)) drawMoth(g, m, m.x, m.y, k, false);
    for (const m of moths) if (!m.far && isActive(m, f.tier) && m.phase !== "rest" && m.phase !== "perch") drawMoth(g, m, m.x, m.y, k, false);
    g.setTransform(k, 0, 0, k, 0, 0);
    g.globalCompositeOperation = "lighter";
    if (hand.intensity > 0.005) {
      const pg = clamp(Math.min(W, H) * 0.26, 100, 250) * (0.85 + 0.15 * hand.intensity);
      g.globalAlpha = 0.75 * hand.intensity;
      g.drawImage(glow, hand.x - pg, hand.y - pg, pg * 2, pg * 2);
      g.globalAlpha = 0.9 * hand.intensity;
      g.drawImage(dot, hand.x - 7, hand.y - 7, 14, 14);
    }
    for (let i = 0; i < dust.count; i++) {
      const life = 1 - dust.age[i] / dust.life[i];
      const s = dust.size[i] * 3;
      g.globalAlpha = life * life * 0.9;
      g.drawImage(dot, dust.x[i] - s / 2, dust.y[i] - s / 2, s, s);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  };

  const restingOn = (g: Ctx, plane: WindowName, k: number, tier: 0 | 1 | 2) => {
    for (const m of moths) {
      if (m.phase !== "rest" || !isActive(m, tier)) continue;
      const sp = spots[m.spot];
      if (!sp || sp.plane !== plane) continue;
      drawMoth(g, m, sp.x, sp.y - sp.r * 0.25, k, true);
    }
    g.setTransform(k, 0, 0, k, 0, 0);
  };

  const glowAt = (g: Ctx, x: number, y: number, r: number, a: number) => {
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = a;
    g.drawImage(glow, x - r, y - r, r * 2, r * 2);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  };

  const hungIn = (g: Ctx, plane: WindowName, w: number, h: number, t: number) => {
    for (const l of lanterns) {
      if (l.plane !== plane) continue;
      const x = l.u * w;
      const y = l.v * h;
      const s = clamp(h * 0.07, 6, 12);
      g.strokeStyle = "rgba(200,190,170,0.4)";
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, y - s);
      g.stroke();
      const fl = flicker(t, l.id * 1.37);
      glowAt(g, x, y, Math.max(8, Math.min(s * 7, y * 0.95, (h - y) * 0.95)), 0.55 * fl);
      paperLantern(g, x, y, s, fl);
    }
  };

  const drawStage = (g: Ctx, f: HubFrame, t: number) => {
    const L = stage;
    const win = f.win.stage;
    if (!L || !win) return;
    const k = g.canvas.width / Math.max(1, win.w);
    const dprW = k;
    g.setTransform(k, 0, 0, k, 0, 0);
    const lp = lanternPos(L, swing.angle);
    const light = flame * flick * (1 + door * 0.35);
    if (stageArt) {
      g.drawImage(stageArt.unlit.canvas, 0, 0, L.w, L.h);
      // Live relight: the lit copy shows through a radial mask at the lantern. Only the part of
      // the mask's square inside the window is processed (the square is taller than the strip).
      const R = relightRadius(L);
      const size = Math.ceil(R * 2 * dprW);
      const x0 = Math.max(0, lp.x - R);
      const y0 = Math.max(0, lp.y - R);
      const x1 = Math.min(L.w, lp.x + R);
      const y1 = Math.min(L.h, lp.y + R);
      if (relight && light > 0.02 && relight.canvas.width >= size && x1 > x0 && y1 > y0) {
        const bw = Math.min(size, Math.ceil((x1 - x0) * dprW));
        const bh = Math.min(size, Math.ceil((y1 - y0) * dprW));
        const rg = relight.g;
        rg.setTransform(1, 0, 0, 1, 0, 0);
        rg.globalCompositeOperation = "source-over";
        rg.clearRect(0, 0, bw, bh);
        // Square coordinates shifted so the band's corner lands at the surface origin.
        rg.setTransform(1, 0, 0, 1, -(x0 - (lp.x - R)) * dprW, -(y0 - (lp.y - R)) * dprW);
        const mask = rg.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        mask.addColorStop(0, `rgba(0,0,0,${Math.min(1, 0.95 * light).toFixed(3)})`);
        mask.addColorStop(0.45, `rgba(0,0,0,${(0.45 * light).toFixed(3)})`);
        mask.addColorStop(1, "rgba(0,0,0,0)");
        rg.fillStyle = mask;
        rg.fillRect(0, 0, size, size);
        rg.setTransform(1, 0, 0, 1, 0, 0);
        rg.globalCompositeOperation = "source-in";
        rg.drawImage(stageArt.lit.canvas, x0 * dprW, y0 * dprW, bw, bh, 0, 0, bw, bh);
        g.drawImage(relight.canvas, 0, 0, bw, bh, x0, y0, bw / dprW, bh / dprW);
      }
    }
    // Warm pool on the bed under the lantern.
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.65 * light;
    const pw = clamp(L.h * 1.3, 90, 260);
    g.drawImage(pool, lp.x - pw, L.bedY - pw * 0.08, pw * 2, pw * 0.2);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    const reach = clamp(L.h * 2.4, 160, 480);
    const sway = 0.04 * Math.sin(t * 0.9);
    for (const fl of L.flowers) {
      const open = blooms.get(fl.slug) ?? 0;
      const warm = falloff(Math.hypot(fl.x - lp.x, L.bedY - fl.stem - lp.y), reach) * light;
      const head = stageFlower(g, fl.x, L.bedY, fl.stem, fl.lean, open, warm, fl.locked, fl.locked ? 0 : sway * (0.5 + fl.lean));
      if (fl.locked) gate(g, fl.x + 2, L.bedY, clamp(L.h * 0.12, 7, 16));
      if (finishedSlugs.has(fl.slug)) {
        resident.depth = 0.82;
        resident.type = 1;
        resident.restClock = (t * TAU) / 3.3;
        resident.disp = 0.1;
        resident.turn = 0;
        resident.warm = warm;
        resident.litX = lp.x < head.x ? -1 : 1;
        drawMoth(g, resident, head.x, head.y - head.r * 0.3, k, true);
        g.setTransform(k, 0, 0, k, 0, 0);
      }
    }
    restingOn(g, "stage", k, f.tier);
    hungIn(g, "stage", L.w, L.h, t);
    // Chain and lantern, swinging from the hook.
    g.save();
    g.translate(L.hookX, L.hookY);
    g.rotate(-swing.angle);
    g.strokeStyle = "#05040c";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, L.reach - L.size * 1.1);
    g.stroke();
    g.translate(0, L.reach - L.size * 1.05);
    lantern(g, L.size, swing.spin, light);
    g.restore();
    glowAt(g, lp.x, lp.y, clamp(Math.min(lp.y, L.h - lp.y) * 0.95, 16, 120), 0.62 * light);
  };

  const drawMid = (g: Ctx, f: HubFrame, t: number) => {
    const M = mid;
    const win = f.win.mid;
    if (!M || !win) return;
    const k = g.canvas.width / Math.max(1, win.w);
    g.setTransform(k, 0, 0, k, 0, 0);
    if (midArt) g.drawImage(midArt.s.canvas, 0, 0, M.w, M.h);
    const fl = flame * flicker(t, 2.1);
    glowAt(g, M.lamp.x, M.lamp.y, clamp(Math.min(M.lamp.y, M.h - M.lamp.y) * 0.95, 16, 110), 0.55 * fl);
    lowLantern(g, M.lamp.x, M.lamp.y + clamp(M.h * 0.1, 8, 18), clamp(M.h * 0.09, 8, 18), fl);
    const accents = snap.cards.filter((c) => c.kind === "upcoming").map((c) => c.accent || "#b9e3c6");
    M.cocoons.forEach((c, i) => {
      cocoon(g, c.x, M.branchY, c.y, clamp(M.h * 0.07, 7, 15), Math.sin(t * 0.6 + i * 1.9), 0.75 + 0.25 * Math.sin(t * 0.45 + i), mixAccent(accents[i] ?? "#b9e3c6"));
    });
    hungIn(g, "mid", M.w, M.h, t);
    restingOn(g, "mid", k, f.tier);
  };

  const drawGround = (g: Ctx, f: HubFrame, t: number) => {
    const G0 = ground;
    const win = f.win.ground;
    if (!G0 || !win) return;
    const k = g.canvas.width / Math.max(1, win.w);
    g.setTransform(k, 0, 0, k, 0, 0);
    if (groundArt) g.drawImage(groundArt.s.canvas, 0, 0, G0.w, G0.h);
    const fl = flame * flicker(t, 4.3);
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.5 * fl;
    g.drawImage(pool, G0.lamp.x - 120, G0.ridgeY - 18, 240, 40);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    glowAt(g, G0.lamp.x, G0.lamp.y, clamp(Math.min(G0.lamp.y, G0.h - G0.lamp.y) * 0.95, 16, 130), 0.55 * fl);
    lowLantern(g, G0.lamp.x, G0.lamp.y + clamp(G0.h * 0.06, 9, 18), clamp(G0.h * 0.055, 9, 18), fl);
    hungIn(g, "ground", G0.w, G0.h, t);
    restingOn(g, "ground", k, f.tier);
  };

  const draw = (f: HubFrame, gs: HubContexts, still: boolean) => {
    const t = still ? clock : f.t;
    drawLive(gs.live, f, still);
    if (gs.stage) drawStage(gs.stage, f, t);
    if (gs.mid) drawMid(gs.mid, f, t);
    if (gs.ground) drawGround(gs.ground, f, t);
  };

  /* ------------------------------------------------------------ input */

  const windowLocal = (plane: WindowName, x: number, y: number) => {
    const r = lastWin[plane];
    return r ? { x: x - r.x, y: y - r.y, w: r.w, h: r.h } : null;
  };

  const tapWindow = (plane: WindowName, x: number, y: number) => {
    const p = windowLocal(plane, x, y);
    if (!p) return;
    if (plane === "stage" && stage) {
      const fl = stage.flowers.find((s) => Math.hypot(s.x + s.lean * s.stem - p.x, stage!.bedY - s.stem - p.y) < 22);
      if (fl) {
        out.label(fl.slug, { x: p.x, y: p.y - 12, plane: "stage" });
        return;
      }
    }
    if (plane === "mid" && mid) {
      const i = mid.cocoons.findIndex((c) => Math.hypot(c.x - p.x, c.y - p.y) < 22);
      if (i >= 0) {
        out.label(mid.cocoons[i].slug, { x: p.x, y: p.y - 14, plane: "mid" });
        return;
      }
    }
    lanterns = tapLantern(lanterns, { plane, u: p.x / Math.max(1, p.w), v: clamp(p.y / Math.max(1, p.h), 0.12, 0.85) }, nextLantern++, (pl) => ({
      w: winDoc[pl]?.w ?? W,
      h: winDoc[pl]?.h ?? 200,
    }));
  };

  const onPointer = (p: HubPointer) => {
    const mouse = p.type === "mouse";
    hand.mouse = mouse;
    if (mouse) {
      if (p.x !== hand.px || p.y !== hand.py) hand.movedAt = clock;
      hand.px = p.x;
      hand.py = p.y;
      hand.active = p.active;
      hand.free = p.zone === "open";
    } else if (ptr?.down) {
      if (hold.since < 0) {
        hold.since = clock;
        hold.x = p.x;
        hold.y = p.y;
        hold.ok = p.zone === "open";
      } else if (Math.hypot(p.x - hold.x, p.y - hold.y) > 10) hold.ok = false;
    } else hold.since = -1;
    if (!p.tap) return;
    if (p.zone === "stage" || p.zone === "mid" || p.zone === "ground") tapWindow(p.zone, p.x, p.y);
    else if (p.zone === "open" && !mouse) {
      hand.x = p.x;
      hand.y = p.y;
      hand.lingerUntil = clock + TOUCH_LINGER_S;
    }
  };

  const dispatchTo = (slug: string, kind: string | null, count: number, landers: number, anywhere: boolean) => {
    const card = cardBySlug(slug);
    // Moths keep away from the locked gate.
    if (!card || kind === "locked") return;
    const r = cardRect(card);
    if (!anywhere && !(r.y + r.h > 0 && r.y < H)) return;
    const free = moths
      .filter((m) => !m.far && isActive(m, curTier) && m.phase !== "perch" && m.goal !== "chip")
      .sort((a, b) => Math.hypot(a.x - (r.x + r.w / 2), a.y - r.y) - Math.hypot(b.x - (r.x + r.w / 2), b.y - r.y))
      .slice(0, count);
    free.forEach((m, i) => {
      if (m.phase === "rest") liftOff(m);
      releaseSpot(m);
      m.goal = "card";
      m.target = slug;
      m.lander = i < landers;
      m.u = landers > 1 ? (i === 0 ? 0.24 : 0.74) : 0.3 + rng() * 0.4;
      m.goalTimer = 30;
    });
  };

  const onEvent = (e: SceneEvent) => {
    switch (e.name) {
      case "hub:attention": {
        const { slug, kind } = e.detail;
        if (slug === attSlug) break;
        if (attSlug) ended.set(attSlug, clock * 1000);
        attSlug = slug;
        if (slug) {
          ended.delete(slug);
          dispatchTo(slug, kind, 2 + Math.floor(rng() * 3), rng() < 0.5 ? 1 : 2, false);
        }
        break;
      }
      case "hub:press": {
        for (const m of moths) {
          if (m.target !== e.detail.slug || (m.goal !== "card" && m.phase !== "perch")) continue;
          if (m.phase === "perch") liftOff(m);
          m.goal = "wander";
          m.phase = "retreat";
          m.phaseTimer = range(0.5, 0.9);
          m.retreatHeading = -Math.PI / 2 + range(-1.2, 1.2);
        }
        break;
      }
      case "hub:stage": {
        const { window: w, action, x, y } = e.detail;
        if (w === "stage") {
          if (action === "tap") {
            stageTaps++;
            stillPose = stageTaps % 2 ? 0.32 : -0.32;
            pushSwing(swing, x !== undefined && stage && lastWin.stage ? (x < lastWin.stage.x + lanternPos(stage, swing.angle).x ? 1 : -1) : stageTaps % 2 ? 1 : -1);
            for (const m of moths) {
              if (m.goal === "lamp" && m.lamp === "stage" && m.phase !== "rest") {
                m.phase = "retreat";
                m.phaseTimer = range(0.5, 1);
                m.retreatHeading = range(-Math.PI, Math.PI);
              }
            }
          } else {
            const dir = action === "left" ? -1 : 1;
            stillSpin += (dir * Math.PI) / 2;
            spinSwing(swing, dir);
          }
        } else if (x !== undefined && y !== undefined) tapWindow("mid", x, y);
        else lanterns = keyLantern(lanterns, mid?.slots ?? [], nextLantern++);
        break;
      }
      case "hub:pick": {
        const slug = e.detail.slug;
        if (!slug) break;
        pick = { slug, at: clock };
        const stageOn = lastWin.stage !== null;
        dispatchTo(slug, cardBySlug(slug)?.kind ?? null, 4, 1, true);
        if (stageOn) for (const m of moths) if (m.goal === "card" && m.target === slug) m.swirlUntil = clock + 0.7;
        break;
      }
      case "hub:modal": {
        if (e.detail.open && e.detail.kind !== "picker") {
          for (const m of moths) {
            if (m.phase !== "perch") continue;
            m.perchId = 0;
            liftOff(m);
            setGoal(m, "wander");
          }
        }
        break;
      }
      default:
        break;
    }
  };

  spawn();

  return {
    resize(f) {
      syncFrame(f);
      relayout(f);
      paintSky(f);
      paintGardens(f);
      paintMoonArt(Math.min(f.dpr || 1, KIT_DPR_CAP));
      buildSheets(Math.min(f.dpr || 1, KIT_DPR_CAP));
      for (const m of moths) {
        if (m.goal === "wander") pickAnchor(m);
        if (!flockPlaced) {
          // The first size is known only now: start the flock spread over the open sky.
          m.x = m.anchorX + range(-40, 40);
          m.y = m.anchorY + range(-40, 40);
        }
        m.x = clamp(m.x, -20, W + 20);
        m.y = clamp(m.y, -20, H + 20);
      }
      flockPlaced = true;
    },
    layout(f) {
      syncFrame(f);
      relayout(f);
      // The moon and the gutters follow the page model; both repaint only when they moved.
      paintSky(f);
      paintGardens(f);
    },
    render(f, gs) {
      curTier = f.tier;
      syncFrame(f);
      step(f);
      draw(f, gs, false);
      writeOut(f.t);
    },
    still(f, gs) {
      curTier = f.tier;
      syncFrame(f);
      composeStill(f);
      draw(f, gs, true);
      const cards: Record<string, CardVars> = {};
      for (const c of snap.cards) cards[c.slug] = cardVars(c, true);
      out.still({ ...rootVars(0), "w-breath": 0.5 }, cards);
    },
    onPointer,
    onEvent,
    intro() {
      introPending = true;
    },
    windowHz(name, tier) {
      if (name === "stage") return tier === 0 ? Number.POSITIVE_INFINITY : tier === 1 ? 30 : 15;
      if (name === "mid") return tier === 0 ? 30 : tier === 1 ? 20 : 10;
      return tier === 0 ? 20 : tier === 1 ? 12 : 6;
    },
    dispose() {
      // Drop every plane's backing store so the hidden theme container holds no pixels; the
      // next mount sizes and paints them again.
      for (const canvas of [planes.live, ...planes.statics.map((p) => p.canvas)]) {
        canvas.width = 0;
        canvas.height = 0;
      }
      moths.length = 0;
      lights.length = 0;
      spots = [];
      held.clear();
      sheets = null;
      moonArt = null;
      stageArt = null;
      midArt = null;
      groundArt = null;
      relight = null;
    },
  };
}

const relightRadius = (L: StageLayout) => clamp(L.h * 1.9, 120, 380);

function distTo(x: number, y: number, r: Rect): number {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

const inside = (x: number, y: number, r: Rect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** The upcoming card's accent softened toward the chrysalis jade. */
function mixAccent(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#b9cf9a";
  const n = Number.parseInt(m[1], 16);
  const mix = (c: number, j: number) => Math.round(c * 0.35 + j * 0.65);
  return `rgb(${mix((n >> 16) & 255, 190)},${mix((n >> 8) & 255, 206)},${mix(n & 255, 150)})`;
}
