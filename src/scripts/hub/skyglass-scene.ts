// Skyglass hub scene on the kit (spec 3.2, re-keyed dark for reading at night): a glass city
// at blue hour under a sunlit orbital ring. Scrolling carries the sky into full night, the far
// city lights up from reading progress, the lobby mobile turns toward the attended novel, a
// capsule crosses the sky-bridge and the plaza pool mirrors the night. Loaded lazily by
// SkyglassBackground.

import { createNoise2D, createRng } from "../_shared/scene-runtime";
import { mistTile } from "./scene-paint";
import {
  GLINT_BEAT_MS,
  GLINT_MS,
  INTRO_MS,
  LOUVRE_SETTLE_MS,
  PAL,
  STILL_P,
  VANE_STEP,
  WindowScheduler,
  callCapsule,
  capsuleAt,
  cityLayout,
  cityPlane,
  cityShare,
  createCapsule,
  createMobile,
  daylightTarget,
  duskVis,
  frontAngle,
  hex,
  impulse,
  layoutFacade,
  litTarget,
  louvreAt,
  mix,
  pageRange,
  placeSun,
  restPsi,
  ringGeometry,
  ringShadow,
  setLouvre,
  skyStops,
  stepDaylight,
  stepMobile,
  sunAngle,
  type CityTower,
  type CityWindow,
  type Facade,
  type Louvre,
  type Mobile,
  type Range,
  type RGB,
  type Ring,
  type SkyStops,
  type StageAction,
  type SunPlace,
} from "./skyglass-core";
import {
  bandSprite,
  ditherTile,
  drawCityWindows,
  drawFacade,
  drawGround,
  drawLouvres,
  drawMid,
  drawRing,
  drawStage,
  glassGradient,
  glowSprite,
  paintCityLayer,
  paintPool,
  paintSky,
  type VaneInfo,
} from "./skyglass-paint";
import { clamp, fnv1a, lerp, pointInRect, smoothstep } from "./world/geom";
import { localDay } from "./world/calendar-core";
import { collectPlanes, createHubScene } from "./world/kit";
import type {
  BindOptions,
  HubBuildContext,
  HubContexts,
  HubFrame,
  HubPlanes,
  HubSceneHandle,
  HubSceneHooks,
  PageSnapshot,
  Rect,
  Surface,
} from "./world/types";

/** One static plane: the sky, at parallax 0 and half resolution. */
const STATICS = [{ parallax: 0 }];

/** Reduced motion or the pause switch (the kit also draws held frames outside still mode). */
const motionStill = () =>
  typeof document !== "undefined" &&
  (document.documentElement.dataset.hubMotion === "still" || window.matchMedia("(prefers-reduced-motion: reduce)").matches);
const FACADE_RATE = 0.35;
const RING_RATE = 0.03;

export function mount(root: HTMLElement, options: Partial<BindOptions> = {}): HubSceneHandle | null {
  const planes = collectPlanes(root, STATICS);
  if (!planes) return null;
  return createHubScene("skyglass", planes, (ctx) => buildSkyglass(ctx, planes), options);
}

/** `now` is the wall clock behind the louvres, glint, capsule and window fades; tests pass the kit's fake clock. */
export function buildSkyglass(ctx: HubBuildContext, planes: HubPlanes, now: () => number = () => performance.now()): HubSceneHooks {
  const { out, surfaces, page } = ctx;
  const skyCanvas = planes.statics[0]?.canvas;
  const skyG = skyCanvas?.getContext("2d");
  if (!skyCanvas || !skyG) throw new Error("skyglass: the sky plane has no 2d context");
  const create = (w: number, h: number) => surfaces.create(w, h);
  const rng = createRng(ctx.seed);
  const daySeed = (ctx.seed ^ fnv1a(localDay(ctx.now))) >>> 0;
  const dayRng = createRng(daySeed);
  const tilt = dayRng() * 2 - 1;

  const dither = ditherTile(create, rng);
  const ditherPattern = skyG.createPattern(dither.canvas, "repeat");
  const halo = glowSprite(create, 256, PAL.horizon, 0.5);
  const warm = glowSprite(create, 128, PAL.window, 0.55);
  const gold = glowSprite(create, 128, hex("#e9c3a0"), 0.42);
  const glint = bandSprite(create, 120, 0.72);
  const shine = bandSprite(create, 280, 0.24);
  const cloudNoise = createNoise2D(daySeed);
  const hazeNoise = createNoise2D(daySeed ^ 0x9e3779b9);
  // Cloud and haze tiles are noise fields: painted in idle steps so the mount stays short.
  const cirrus: HTMLCanvasElement[] = [];
  const haze: HTMLCanvasElement[] = [];
  const tile = (list: HTMLCanvasElement[], noise: (x: number, y: number) => number, color: string, alpha: number) => () => {
    const [r, g, b] = hex(color);
    list.push(mistTile(noise, r, g, b, alpha, create));
  };
  ctx.paint.run("skyglass:tiles", [
    tile(cirrus, cloudNoise, "#7d6a80", 150),
    tile(cirrus, cloudNoise, "#4a5574", 150),
    tile(cirrus, cloudNoise, "#2e3852", 150),
    tile(haze, hazeNoise, "#6f5c6c", 100),
    tile(haze, hazeNoise, "#2c3550", 100),
  ]);

  let W = 0;
  let H = 0;
  let snap: PageSnapshot;
  let range: Range;
  let ring: Ring;
  let ringHoles: Rect[] = [];
  let sun: SunPlace;
  let facade: Facade;
  let city: ReturnType<typeof cityPlane>;
  let towers: CityTower[] = [];
  let windows: CityWindow[] = [];
  let scheduler = new WindowScheduler([]);
  let cityEarly: Surface | null = null;
  let cityNight: Surface | null = null;
  let cityTop = 0;
  let cityReadyAt = Number.NaN;
  let pool: Surface | null = null;
  let poolKey = "";
  let share = 0;
  let vanes: VaneInfo[] = [];
  let upcoming: RGB[] = [];
  let mobile: Mobile = createMobile(6, rng);

  const spring = { x: 0, v: 0 };
  let p = 0;
  let skyKey = "";
  let glassKey = "";
  let glass: CanvasGradient | null = null;
  let lastRoot = "";
  let attended: string | null = null;
  let held: string | null = null;
  let glowSlug: string | null = null;
  let glowAt = -Infinity;
  let focusAmt = 0;
  let glintAt = -Infinity;
  let glintBeatAt = -Infinity;
  let introAt = Number.NaN;
  let stillTurns = 0;
  let midDirty = false;
  const capsule = createCapsule(now(), rng);
  let capsulePos = { u: capsule.at as number, moving: false };
  const louvre: Louvre = { from: 0, to: 0, at: -Infinity };

  const cards = () => snap.cards;
  const focusIndex = () => {
    const slug = attended ?? held;
    return slug ? cards().findIndex((c) => c.slug === slug) : -1;
  };

  /* ------------------------------------------------------------ composition */

  const compose = (s: PageSnapshot) => {
    snap = s;
    range = pageRange(s);
    city = cityPlane(range);
    ring = ringGeometry(s, tilt);
    const heroBottom = range.heroBottom;
    ringHoles = s.holes.filter((r) => r.y < heroBottom);
    sun = placeSun(s);
    facade = layoutFacade(s, createRng(ctx.seed ^ 0x51), sun);
    share = cityShare(s.cards);
    vanes = s.cards.slice(0, 6).map((c) => ({ tint: mix(hex(c.accent), PAL.pearl, 0.5), kind: c.kind, read: c.finished ? 1 : clamp(c.read ?? 0, 0, 1) }));
    upcoming = s.cards.filter((c) => c.kind === "upcoming").slice(0, 2).map((c) => hex(c.accent));
    if (mobile.vanes.length !== vanes.length) mobile = createMobile(vanes.length, rng);
    glassKey = "";
    poolKey = "";
  };
  compose(page.getSnapshot());

  const buildCity = () => {
    if (cityEarly) surfaces.release(cityEarly);
    if (cityNight) surfaces.release(cityNight);
    const stripH = Math.ceil(H * 0.69);
    const width = Math.ceil(W);
    const cr = createRng(ctx.seed ^ 0xc17);
    cityTop = H * 0.08;
    const laid = cityLayout(width, stripH, cityTop + H * 0.06, cr);
    towers = laid.towers;
    windows = laid.windows;
    scheduler = new WindowScheduler(windows.map((w) => w.region));
    scheduler.compose(litTarget(windows.length, share, duskVis(p)));
    cityEarly = create(width, stripH);
    cityNight = create(width, stripH);
    cityReadyAt = Number.NaN;
    const early = cityEarly;
    const night = cityNight;
    ctx.paint.run(
      `city:${width}x${stripH}`,
      ([0, 1, 2] as const).map((layer) => () => {
        paintCityLayer(early.g, towers, layer, false, stripH);
        paintCityLayer(night.g, towers, layer, true, stripH);
      }),
      () => {
        cityReadyAt = now();
        poolKey = "";
      },
    );
  };

  const horizonY = (scrollY: number, still: boolean) => city.top + (still ? 0 : -city.rate * scrollY) + H * 0.16;

  /** Afterglow strength: clear at blue hour, a trace by night. */
  const afterglow = (phase: number) => 1 - 0.8 * clamp(phase, 0, 1);

  /** Repaints the half-resolution sky plane when the sky phase or the horizon moved. */
  const ensureSky = (still: boolean, phase: number, hz: number) => {
    const key = still ? `still:${W}x${H}` : `${W}x${H}:${Math.round(phase * 300)}:${Math.round(hz / 2)}`;
    if (key === skyKey) return;
    skyKey = key;
    paintSky(skyG, skyCanvas.width, skyCanvas.height, W, H, { stops: skyStops(phase), span: hz, sunX: sun.x, horizonY: hz, warm: afterglow(phase) }, ditherPattern);
  };

  const sizeSky = () => {
    const w = Math.max(1, Math.ceil(W / 2));
    const h = Math.max(1, Math.ceil(H / 2));
    if (skyCanvas.width !== w || skyCanvas.height !== h) {
      skyCanvas.width = w;
      skyCanvas.height = h;
    }
    skyKey = "";
  };

  /* ------------------------------------------------------------ the fixed sky */

  const hidden = (scrollY: number) => (x: number, y: number) => {
    const yDoc = y + scrollY;
    if (page.isCovered(x, yDoc, 12)) return true;
    for (const r of ringHoles) if (pointInRect(r, x, yDoc, 12)) return true;
    return false;
  };

  const drawSky = (g: CanvasRenderingContext2D, f: HubFrame, phase: number, still: boolean, t: number) => {
    // Parallax offsets hold at 0 in the still; page rects always follow the real scroll.
    const scrollY = still ? 0 : f.scrollY;
    const hz = horizonY(f.scrollY, still);
    const stops: SkyStops = skyStops(phase);
    const span = hz;
    const dusk = duskVis(phase);
    const intro = Number.isNaN(introAt) || still ? 1 : smoothstep(0, 1, (t - introAt) / INTRO_MS);
    const fine = !snap.viewport.coarse && f.pointer.active && f.pointer.type === "mouse" && !still;

    // The set sun's afterglow low over the horizon: it breathes (20 s, 4 percent) and leans toward a fine pointer.
    const breathe = still ? 1 : 1 + 0.04 * Math.sin((f.t * Math.PI * 2) / 20);
    const shift = fine ? clamp(((f.pointer.x - sun.x) / Math.max(1, W)) * 12, -6, 6) : 0;
    const hs = Math.max(W, H) * 0.42 * breathe;
    g.globalAlpha = intro * 0.4 * afterglow(phase);
    g.drawImage(halo, sun.x + shift - hs / 2, hz - hs * 0.32, hs, hs * 0.5);
    g.globalAlpha = 1;

    drawRing(g, {
      ring,
      dy: -RING_RATE * scrollY,
      shadow: ringShadow(still ? STILL_P : phase),
      p: still ? STILL_P : phase,
      alpha: intro,
      bead: still ? 0.62 : (f.t / 180) % 1,
      hidden: hidden(f.scrollY),
      W,
    });

    const bands = f.tier >= 1 ? 1 : 2;
    const tint = phase * 2;
    const k = Math.min(1, Math.floor(tint));
    const mixT = clamp(tint - k, 0, 1);
    for (let b = 0; b < (cirrus.length === 3 ? bands : 0); b++) {
      const tw = 256 * Math.max(3, W / 380) * (b ? 1.3 : 1);
      const th = 64 * (b ? 3.2 : 2.4);
      const y = H * (b ? 0.2 : 0.06) - scrollY * 0.02;
      const off = -(((f.t * (b ? 2.2 : 3.6)) % tw) + tw) % tw;
      for (const [tile, a] of [
        [cirrus[k], (1 - mixT) * (b ? 0.8 : 1)],
        [cirrus[Math.min(2, k + 1)], mixT * (b ? 0.8 : 1)],
      ] as const) {
        if (a < 0.02) continue;
        g.globalAlpha = a * intro;
        for (let x = off; x < W; x += tw) g.drawImage(tile, x, y, tw + 1, th);
      }
    }
    g.globalAlpha = 1;

    const cityY = city.top - (still ? 0 : city.rate * f.scrollY);
    const cityAlpha = Number.isNaN(cityReadyAt) ? 0 : still ? 1 : clamp((t - cityReadyAt) / 600, 0, 1);
    if (cityEarly && cityNight && cityAlpha > 0) {
      const nightMix = smoothstep(0.12, 0.9, phase);
      if (nightMix < 0.98) {
        g.globalAlpha = cityAlpha;
        g.drawImage(cityEarly.canvas, 0, cityY, W, cityEarly.canvas.height);
      }
      if (nightMix > 0.02) {
        g.globalAlpha = cityAlpha * nightMix;
        g.drawImage(cityNight.canvas, 0, cityY, W, cityNight.canvas.height);
      }
      g.globalAlpha = cityAlpha;
      drawCityWindows(g, windows, (i) => scheduler.alpha(i, t) * dusk, cityY, H, f.tier >= 1);
      g.globalAlpha = 1;
    }
    const hzBand = cityY + H * 0.2;
    const hw = 256 * Math.max(3.2, W / 300);
    for (const [tile, a] of [
      [haze[0], (1 - phase) * 0.5],
      [haze[1], phase * 0.45],
    ] as const) {
      if (!tile || a < 0.02) continue;
      g.globalAlpha = a;
      for (let x = -((f.t * 1.5) % hw); x < W; x += hw) g.drawImage(tile, x, hzBand, hw + 1, H * 0.22);
    }
    g.globalAlpha = 1;

    const lights: { x: number; y: number; k: number }[] = [];
    const evening = 0.5 + 0.5 * phase;
    const focusSlug = attended;
    for (const c of snap.cards) {
      if (c.kind !== "open") continue;
      const r = { x: c.rect.x, y: c.rect.y - f.scrollY, w: c.rect.w, h: c.rect.h };
      if (r.y > H || r.y + r.h < 0) continue;
      const read = c.finished ? 1 : (c.read ?? 0);
      const k = clamp((read > 0 ? evening * (0.3 + 0.7 * read) * 0.9 : 0) + (c.slug === focusSlug ? (still ? 1 : focusAmt) * 0.85 : 0), 0, 1);
      if (k < 0.03) continue;
      const y = r.y + Math.min(r.h * 0.4, 220);
      lights.push({ x: r.x - 8, y, k }, { x: r.x + r.w + 8, y, k });
    }
    lights.sort((a, b) => b.k - a.k);
    for (const l of lights.slice(0, 6)) {
      const size = 240 * (0.6 + 0.4 * l.k);
      g.globalAlpha = l.k * 0.75;
      g.drawImage(warm, l.x - size / 2, l.y - size / 2, size, size);
    }
    g.globalAlpha = 1;

    const gk = `${Math.round(phase * 128)}:${H}:${Math.round(span / 4)}`;
    if (!glass || gk !== glassKey) {
      glassKey = gk;
      glass = glassGradient(g, stops, span, H, phase);
    }
    const glintK = still ? -1 : (t - glintAt) / GLINT_MS;
    drawFacade(g, {
      facade,
      glass,
      dy: -FACADE_RATE * scrollY,
      H,
      dusk,
      night: phase,
      share,
      pointerY: fine ? f.pointer.y : null,
      glintY: glintK >= 0 && glintK <= 1 ? lerp(-0.3 * H, 1.3 * H, glintK) : null,
      glint,
      shine,
      W,
    });

    const closed = still ? louvre.to : louvreAt(louvre, t);
    drawLouvres(g, W, H, closed);
  };

  /* ------------------------------------------------------------ windows */

  const local = (f: HubFrame, name: "stage" | "mid" | "ground") => {
    const r = f.win[name];
    const doc = snap.windows[name];
    return r && doc.w > 0 ? { r, doc } : null;
  };

  const drawStageWindow = (g: CanvasRenderingContext2D, f: HubFrame, still: boolean, dusk: number) => {
    const at = local(f, "stage");
    if (!at) return;
    const { r, doc } = at;
    const hit = snap.windows.stageHit;
    const phone = snap.mode === "phone";
    const vaneH = clamp(hit.h * 0.54, 34, 120);
    const focus = focusIndex();
    let m = mobile;
    if (still) {
      const base = focus >= 0 ? frontAngle(0.3, focus) : 0.3;
      m = {
        theta: base + stillTurns * VANE_STEP,
        omega: 0,
        vanes: mobile.vanes.map((_, i) => ({ psi: i === focus ? 0 : restPsi(i, 0), psiV: 0, sway: 0, swayV: 0, spin: -1 })),
      };
    }
    drawStage(g, {
      w: r.w,
      h: r.h,
      shellL: snap.shell.x - r.x,
      shellR: snap.shell.x + snap.shell.w - r.x,
      cx: hit.x + hit.w / 2 - r.x,
      top: hit.y - doc.y,
      radius: Math.min(hit.w * 0.44, vaneH * 1.8),
      vaneW: vaneH * 0.42,
      vaneH,
      mobile: m,
      vanes,
      focus,
      focusAmt: still ? (focus >= 0 ? 1 : 0) : focusAmt,
      dusk,
      phone,
      glow: warm,
    });
  };

  const drawMidWindow = (g: CanvasRenderingContext2D, f: HubFrame, still: boolean, phase: number) => {
    const at = local(f, "mid");
    if (!at) return;
    const { r, doc } = at;
    const hit = snap.windows.midHit;
    const pos = still ? { u: capsule.at, moving: false } : capsulePos;
    drawMid(g, {
      h: r.h,
      x0: hit.x - r.x,
      x1: hit.x + hit.w - r.x,
      y: hit.y - doc.y + hit.h / 2,
      tube: clamp(hit.h * 0.38, 12, 34),
      capsule: pos.u,
      moving: pos.moving,
      upcoming,
      glow: gold,
      night: phase,
    });
  };

  const drawGroundWindow = (g: CanvasRenderingContext2D, f: HubFrame, still: boolean, phase: number) => {
    const at = local(f, "ground");
    if (!at) return;
    const { r, doc } = at;
    const edge = r.h * 0.32;
    const shellL = snap.shell.x - r.x;
    const pw = Math.round(snap.shell.w * 0.88);
    const top = edge + (r.h - edge) * 0.1;
    // The pool ends at least 16 px above any text or control in the ground window (footer link, footer bar).
    let floor = r.h;
    for (const q of [...snap.holes, snap.parts.footer]) {
      if (q.h > 0 && q.y + q.h > doc.y && q.y < doc.y + doc.h) floor = Math.min(floor, q.y - doc.y - 16);
    }
    const ph = Math.round(Math.min((r.h - edge) * 0.24, floor - top));
    const poolRect = { x: shellL + snap.shell.w * 0.06, y: top, w: pw, h: ph >= 12 ? ph : 0 };
    const reflect = phase;
    const key = `${pw}x${ph}:${Math.round(reflect * 20)}:${Math.round(share * 10)}:${towers.length}`;
    if (pw > 0 && poolRect.h > 0 && key !== poolKey) {
      poolKey = key;
      if (!pool || pool.canvas.width !== pw || pool.canvas.height !== poolRect.h) {
        if (pool) surfaces.release(pool);
        pool = create(pw, poolRect.h);
      }
      paintPool(pool, skyStops(reflect), towers, cityTop + H * 0.06, poolRect.x + r.x, share, duskVis(reflect), createRng(ctx.seed ^ 0x9001));
    }
    drawGround(g, { w: r.w, h: r.h, edge, pool: poolRect, src: pool?.canvas ?? null, ripple: still || f.tier >= 1 ? 0 : 1.6, t: f.t });
  };

  const drawWindows = (f: HubFrame, g: HubContexts, still: boolean, phase: number) => {
    const dusk = duskVis(phase);
    if (g.stage) drawStageWindow(g.stage, f, still, dusk);
    if (g.mid) {
      drawMidWindow(g.mid, f, still, phase);
      midDirty = false;
    }
    if (g.ground) drawGroundWindow(g.ground, f, still, phase);
  };

  /* ------------------------------------------------------------ mechanics */

  const glintNow = (t: number) => {
    glintAt = t;
    if (t - glintBeatAt >= GLINT_BEAT_MS) {
      glintBeatAt = t;
      out.beat(null, "glint");
    }
  };

  let lastStill = false;

  const stage = (action: StageAction) => {
    if (lastStill) stillTurns += action === "left" ? -1 : 1;
    else impulse(mobile, action, rng);
  };

  const midTap = () => {
    const t = now();
    if (lastStill) {
      capsule.at = capsule.at === 0 ? 1 : 0;
      return;
    }
    if (callCapsule(capsule, t)) midDirty = true;
    glintNow(t);
  };

  /* ------------------------------------------------------------ hooks */

  return {
    modalSettleMs: LOUVRE_SETTLE_MS,

    resize(f) {
      W = f.width;
      H = f.height;
      if (f.page !== snap) compose(f.page);
      sizeSky();
      buildCity();
    },

    layout(f) {
      const before = share;
      compose(f.page);
      if (share !== before && windows.length) scheduler.update(now(), litTarget(windows.length, share, duskVis(p)));
    },

    render(f, g) {
      lastStill = false;
      const t = now();
      const frozen = f.tier === 2 && Math.abs(f.scrollVel) > 40;
      p = stepDaylight(spring, f.scrollY, range, frozen ? 0 : f.dt);
      const root = `${Math.round((1 - p) * 64)}:${sunAngle(p)}`;
      if (root !== lastRoot) {
        lastRoot = root;
        out.root({ "w-sky": 1 - p, "w-sun": sunAngle(p) });
      }
      const hz = horizonY(f.scrollY, false);
      ensureSky(false, p, hz);
      const focus = focusIndex();
      focusAmt = clamp(focusAmt + (attended ? f.dt / 0.5 : -f.dt / 0.6), 0, 1);
      stepMobile(mobile, f.dt, f.t, focus);
      if (windows.length) scheduler.update(t, litTarget(windows.length, share, duskVis(p)));
      const wasMoving = capsulePos.moving;
      capsulePos = capsuleAt(capsule, t, rng);
      if (wasMoving && !capsulePos.moving) midDirty = true;
      drawSky(g.live, f, p, false, t);
      drawWindows(f, g, false, p);
      if (attended !== glowSlug) {
        if (glowSlug) out.card(glowSlug, { "w-glow": 0 });
        glowSlug = attended;
        glowAt = -Infinity;
      }
      if (glowSlug && t - glowAt > 400) {
        glowAt = t;
        out.card(glowSlug, { "w-glow": 1 });
      }
    },

    still(f, g) {
      const t = now();
      const cardVars: Record<string, { "w-glow": number }> = {};
      for (const c of snap.cards) cardVars[c.slug] = { "w-glow": c.slug === attended ? 1 : 0 };
      glowSlug = attended;
      lastRoot = "";
      lastStill = motionStill();
      if (!lastStill) {
        // A held frame with motion on (switch snapshot, mount under a dialog): the live composition at time held.
        spring.x = daylightTarget(f.scrollY, range);
        spring.v = 0;
        p = spring.x;
        const hz = horizonY(f.scrollY, false);
        ensureSky(false, p, hz);
        drawSky(g.live, f, p, false, t);
        drawWindows(f, g, false, p);
        out.still({ "w-sky": 1 - p, "w-sun": sunAngle(p) }, cardVars);
        return;
      }
      ensureSky(true, STILL_P, horizonY(0, true));
      if (windows.length) scheduler.compose(litTarget(windows.length, share, 1));
      drawSky(g.live, f, STILL_P, true, t);
      drawWindows(f, g, true, STILL_P);
      out.still({ "w-sky": 1 - STILL_P, "w-sun": sunAngle(STILL_P) }, cardVars);
    },

    onPointer(ptr) {
      if (!ptr.tap) return;
      if (ptr.zone === "open" || ptr.zone === "ground") {
        if (!lastStill) glintNow(now());
      } else if (ptr.zone === "stage") stage("tap");
      else if (ptr.zone === "mid") midTap();
    },

    onEvent(event) {
      switch (event.name) {
        case "hub:stage":
          if (event.detail.window === "stage") stage(event.detail.action);
          else if (event.detail.action === "tap") midTap();
          break;
        case "hub:attention":
          attended = event.detail.slug;
          break;
        case "hub:pick":
          held = event.detail.slug;
          break;
        case "hub:press": {
          const i = cards().findIndex((c) => c.slug === event.detail.slug);
          const v = mobile.vanes[i];
          if (v && !lastStill) v.spin = 0;
          break;
        }
        case "hub:modal":
          if (event.detail.kind !== "picker") setLouvre(louvre, event.detail.open ? 1 : 0, now());
          break;
        default:
          break;
      }
    },

    intro() {
      introAt = now();
      louvre.from = 1;
      louvre.to = 0;
      louvre.at = introAt + 250;
    },

    windowHz(name, tier) {
      if (name === "stage") return tier === 0 ? Number.POSITIVE_INFINITY : tier === 1 ? 30 : 15;
      if (name === "mid") return capsulePos.moving || midDirty ? (tier === 2 ? 30 : Number.POSITIVE_INFINITY) : 0;
      return tier === 0 ? 30 : 0;
    },

    dispose() {
      // The sky plane is the page's canvas, not a surface: free its backing store as well.
      skyCanvas.width = 0;
      skyCanvas.height = 0;
      towers = [];
      windows = [];
      vanes = [];
      cityEarly = null;
      cityNight = null;
      pool = null;
      glass = null;
    },
  };
}
