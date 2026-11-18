// Scene kit for hub themes (spec 2.12 with the 8.3 and 8.4 amendments). One loop on
// createScene draws the fixed sky and every visible window canvas, capped at 60 fps.
// The kit owns the still path, modal pause, pointer zones and taps, the quality
// governor, surfaces, staged painting, static-plane transforms, window redraw rates,
// intro gating, error isolation and teardown, so themes only supply hooks. Every
// browser dependency is injectable for tests.

import {
  backingSize,
  capDpr,
  clampDt,
  createScene,
  isTap,
  type PointerState,
  type SceneHandle,
  type SceneSize,
} from "../../_shared/scene-runtime";
import { release, surface } from "../scene-paint";
import { lowerFirst, themeByKey } from "../theme-core.mjs";
import { bus as documentBus } from "./bus";
import { isoWeek, moonPhase } from "./calendar-core";
import { fnv1a } from "./geom";
import { createOutput } from "./output";
import { getPageModel } from "./page-model";
import { createGovernor, startTier } from "./quality-core";
import { createSurfaces } from "./surfaces";
import type {
  Ctx,
  HubContexts,
  HubEventMap,
  HubFrame,
  HubPlanes,
  HubSceneBuild,
  HubSceneHandle,
  HubSceneHooks,
  HubSceneOptions,
  HubSceneStats,
  HubThemeKey,
  IdleCallback,
  IdleDeadlineLike,
  KitDeps,
  PaintQueue,
  Plane,
  Rect,
  SceneEvent,
  SceneEventName,
  SceneOutput,
  StaticPlane,
  Vec,
  WindowName,
  Zone,
} from "./types";

export const KIT_DPR_CAP = 1.5;
/** A frame is drawn only when at least this long has passed since the last drawn frame. */
export const FRAME_MIN_MS = 15;

const MAX_FAILS = 3;
const SCROLL_SETTLE_MS = 150;
const PRESS_MS = 180;
const PRESS_MOVE_PX = 10;
const DRAG_PX = 24;
const STATS_EVERY = 30;
const STATS_EMA = 0.05;
const INTRO_KEY = "piichan-novels:hub-intro:";
/** A window with a redraw rate is due this much before its period ends (frame jitter). */
const WINDOW_SLACK_MS = 4;
/** A paint slice starts another step only while the idle deadline has more than this left. */
const PAINT_RESERVE_MS = 8;
const IDLE_TIMEOUT_MS = 300;
const WINDOW_NAMES: readonly WindowName[] = ["stage", "mid", "ground"];
const FORWARDED: readonly Exclude<SceneEventName, "hub:modal">[] = [
  "hub:theme",
  "hub:reading",
  "hub:attention",
  "hub:press",
  "hub:stage",
  "hub:pick",
];
const TAPPABLE = new Set<Zone>(["open", "stage", "mid", "ground"]);
/** The stage hit button covers most of the stage on phones; a drag that starts on it is still a stage swipe. */
const STAGE_HIT = 'button.hub-window-hit[data-hub-hit="stage"]';

interface WindowState {
  canvas: HTMLCanvasElement;
  ctx: Ctx | null;
  cssW: number;
  cssH: number;
  /** Document rect of the canvas, refreshed on mount, resize and layout. */
  doc: Rect | null;
  visible: boolean;
  /** Must be drawn on the next frame whatever its rate (entered view, resized, layout changed). */
  dirty: boolean;
  lastDraw: number;
}

interface PaintJob {
  key: string;
  steps: (() => void)[];
  onDone?: () => void;
}

const hasIdleCallback = () => typeof window !== "undefined" && typeof window.requestIdleCallback === "function";

function requestIdle(callback: IdleCallback): number {
  if (hasIdleCallback()) return window.requestIdleCallback(callback, { timeout: IDLE_TIMEOUT_MS });
  return window.setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 0 }), 16);
}

function cancelIdle(handle: number): void {
  if (hasIdleCallback()) window.cancelIdleCallback(handle);
  else window.clearTimeout(handle);
}

/** Static planes on coarse pointers are painted at most at this DPR (spec 2.12). */
export const STATIC_DPR_COARSE = 1.25;

/** Backing-store DPR for a static plane or offscreen static: capped at 1.5, at 1.25 on coarse pointers. */
export function staticDpr(viewport: { dpr: number; coarse: boolean }): number {
  return capDpr(viewport.dpr, viewport.coarse ? STATIC_DPR_COARSE : KIT_DPR_CAP);
}

/** How far the kit moves a static plane up for a scroll position: scroll x parallax, wrapped by period, to 0.1 px. */
export function staticOffset(scrollY: number, plane: Pick<StaticPlane, "parallax" | "period">): number {
  let offset = scrollY * plane.parallax;
  if (plane.period && plane.period > 0) offset = ((offset % plane.period) + plane.period) % plane.period;
  return Math.round(offset * 10) / 10;
}

interface Press {
  x: number;
  y: number;
  at: number;
  id: number;
  zone: Zone;
  /** Started in the stage zone or on the stage hit button: a horizontal drag is a stage swipe. */
  swipe: boolean;
  /** Started on the stage hit button: a swipe swallows the click the button would get. */
  onHit: boolean;
  dragged: boolean;
}

function onStageHit(target: EventTarget | null | undefined): boolean {
  const el = target as Element | null | undefined;
  return typeof el?.closest === "function" && el.closest(STAGE_HIT) !== null;
}

function resolveDeps(given: Partial<KitDeps> = {}): KitDeps {
  return {
    createScene: given.createScene ?? createScene,
    ResizeObserver: given.ResizeObserver ?? ResizeObserver,
    IntersectionObserver: given.IntersectionObserver ?? IntersectionObserver,
    now: given.now ?? (() => performance.now()),
    matchMedia: given.matchMedia ?? ((query) => window.matchMedia(query)),
    requestAnimationFrame: given.requestAnimationFrame ?? ((callback) => window.requestAnimationFrame(callback)),
    cancelAnimationFrame: given.cancelAnimationFrame ?? ((handle) => window.cancelAnimationFrame(handle)),
    requestIdle: given.requestIdle ?? requestIdle,
    cancelIdle: given.cancelIdle ?? cancelIdle,
    surfaceFactory: given.surfaceFactory ?? { surface, release },
    page: given.page ?? getPageModel(),
    bus: given.bus ?? documentBus,
    createOutput: given.createOutput ?? createOutput,
    host: given.host ?? window,
    globals: given.globals ?? (window as unknown as Record<string, unknown>),
  };
}

function deviceTier(coarse: boolean) {
  const nav =
    typeof navigator === "undefined"
      ? undefined
      : (navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } });
  return startTier({
    coarse,
    hardwareConcurrency: nav?.hardwareConcurrency,
    deviceMemory: nav?.deviceMemory,
    saveData: nav?.connection?.saveData,
  });
}

function clearCanvas(ctx: Ctx, canvas: HTMLCanvasElement): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function resetCanvas(canvas: HTMLCanvasElement, ctx: Ctx | null): void {
  if (ctx && typeof ctx.reset === "function") ctx.reset();
  else canvas.width = canvas.width;
}

export function createHubScene(
  key: HubThemeKey,
  planes: HubPlanes,
  build: HubSceneBuild,
  options: HubSceneOptions = {},
): HubSceneHandle {
  const deps = resolveDeps(options.deps);
  const { bus, page, host } = deps;
  const html = host.document.documentElement;
  const initName = `__${lowerFirst(themeByKey(key)?.bind ?? key)}Initialized`;
  const params = new URLSearchParams(host.location.search);
  const statsOn = params.get("hubstats") === "1";
  // A theme over the 0.3 ms card style-write gate turns card writes off (5.6); ?hubcardwrites=0
  // does the same for the A/B style-recalc measurement (8.4 item 3).
  const cardWrites = options.cardWrites !== false && params.get("hubcardwrites") !== "0";
  const softReturn = options.softReturn === true;
  const reduceQuery = deps.matchMedia("(prefers-reduced-motion: reduce)");

  const surfaces = createSurfaces(deps.surfaceFactory);
  const out = deps.createOutput({ key, page, bus, now: deps.now });
  const governor = createGovernor(deviceTier(page.getSnapshot().viewport.coarse));
  const cleanups: (() => void)[] = [];

  let dead = false;
  let mounted = false;
  let hooks: HubSceneHooks | null = null;
  let scene: SceneHandle | null = null;
  let running = false;
  let ownerWants = true;
  let switching = html.dataset.hubSwitch !== undefined;
  let motionStill = html.dataset.hubMotion === "still";
  let wasStill = reduceQuery.matches || motionStill;
  const lastModal = bus.last("hub:modal");
  let modalOpen = lastModal?.open === true;
  /** When the pausing modal opened; null while none is open. */
  let modalSince: number | null = modalOpen && lastModal?.kind !== "picker" ? deps.now() : null;
  let modalHeld = modalSince !== null;
  let drawn = false;
  let fails = 0;
  let introChecked = false;
  let lastDrawAt = -1;
  /**
   * Scroll position as of the last scroll event. Reading host.scrollY forces a synchronous style
   * and layout update when anything dirtied style (root writes, timers), so frames and pointer
   * handlers use this instead; scroll events run before animation frames.
   */
  let scrollPos = host.scrollY;
  let lastScrollY = scrollPos;
  let switchPoll = 0;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let press: Press | null = null;
  /** A swipe that started on the stage hit button ended: its click must not tap the button. */
  let swallowClick = false;
  let lastZone: Zone | null = null;
  let lastSlug: string | undefined;
  let cardMs = 0;
  let cardWritesMs = 0;
  let drawWith = -1;
  let drawWithout = -1;
  let jobs: PaintJob[] = [];
  let idleHandle = 0;
  let paintStepMaxMs = 0;

  const stillMode = () => reduceQuery.matches || motionStill;

  const pointer: PointerState = { x: 0, y: 0, nx: 0.5, ny: 0.5, active: false, down: false, justTapped: false, type: "mouse" };
  const staticY: number[] = planes.statics.map(() => 0);
  const shifts = planes.statics.map(() => ({ x: 0, y: 0 }));
  const frame: HubFrame = {
    t: 0,
    dt: 0,
    width: 0,
    height: 0,
    dpr: 1,
    pointer,
    scrollY: scrollPos,
    scrollVel: 0,
    win: { stage: null, mid: null, ground: null },
    page: page.getSnapshot(),
    tier: governor.tier,
    still: false,
    staticY,
  };
  let liveCtx = planes.live.getContext("2d");
  const g: HubContexts = { live: liveCtx as Ctx };

  const wins = Object.fromEntries(
    WINDOW_NAMES.map((name) => {
      const canvas = planes.windows[name];
      const state: WindowState = { canvas, ctx: canvas.getContext("2d"), cssW: 0, cssH: 0, doc: null, visible: false, dirty: true, lastDraw: -Infinity };
      return [name, state];
    }),
  ) as Record<WindowName, WindowState>;
  const byCanvas = new Map<Element, WindowState>(WINDOW_NAMES.map((name) => [wins[name].canvas, wins[name]]));

  for (const name of WINDOW_NAMES) resetCanvas(wins[name].canvas, wins[name].ctx);

  const skyCanvases = [planes.live, ...planes.statics.map((p) => p.canvas)];
  const allCanvases = [...skyCanvases, ...WINDOW_NAMES.map((name) => wins[name].canvas)];
  const staticTransforms = planes.statics.map(() => "");

  const sceneOut: SceneOutput = {
    root: (vars) => out.root(vars),
    card: (slug, vars) => {
      if (!cardWrites) return;
      const t = deps.now();
      out.card(slug, vars);
      cardMs += deps.now() - t;
    },
    heroPoolX: (percent) => out.heroPoolX(percent),
    beat: (slug, kind) => out.beat(slug, kind),
    perch: (target, spec) => out.perch(target, spec),
    unperch: (id) => out.unperch(id),
    label: (slug, at, ms) => out.label(slug, at, ms),
    focusCard: (slug) => out.focusCard(slug),
    still: (rootVars, cardVars) => out.still(rootVars, cardVars),
    resume: () => out.resume(),
    dispose: () => out.dispose(),
    announce: (text) => out.announce?.(text),
  };

  /**
   * Reads every window canvas box. All reads come before any backing-store write: resizing a
   * canvas invalidates layout, so a read after it would force another synchronous layout.
   */
  const readWindows = () => {
    const scrollY = host.scrollY;
    for (const name of WINDOW_NAMES) {
      const w = wins[name];
      const box = w.canvas.getBoundingClientRect();
      w.cssW = box.width;
      w.cssH = box.height;
      w.doc = box.width > 0 && box.height > 0 ? { x: box.left, y: box.top + scrollY, w: box.width, h: box.height } : null;
    }
  };

  /**
   * Sizes each window canvas from the boxes readWindows() took and sets its DPR transform;
   * returns true when a backing store changed. The transform is set every time because the
   * canvases are shared: an earlier kit's reset() leaves an identity transform on a correctly
   * sized store.
   */
  const sizeWindows = (): boolean => {
    const dpr = capDpr(page.getSnapshot().viewport.dpr, KIT_DPR_CAP);
    let changed = false;
    for (const name of WINDOW_NAMES) {
      const w = wins[name];
      if (!w.doc || !w.ctx) continue;
      const bw = backingSize(w.cssW, dpr);
      const bh = backingSize(w.cssH, dpr);
      if (w.canvas.width !== bw || w.canvas.height !== bh) {
        w.canvas.width = bw;
        w.canvas.height = bh;
        w.dirty = true;
        changed = true;
      }
      w.ctx.setTransform(bw / w.cssW, 0, 0, bh / w.cssH, 0, 0);
    }
    return changed;
  };

  const measureWindows = (): boolean => {
    readWindows();
    return sizeWindows();
  };

  const windowRate = (name: WindowName): number => {
    const rate = hooks?.windowHz;
    if (!rate) return Number.POSITIVE_INFINITY;
    try {
      return rate.call(hooks, name, governor.tier);
    } catch (error) {
      console.error(error);
      return Number.POSITIVE_INFINITY;
    }
  };

  /** Whether a visible window is drawn on a loop frame at time t. */
  const windowDue = (name: WindowName, w: WindowState, t: number): boolean => {
    if (w.dirty) return true;
    const hz = windowRate(name);
    if (!(hz > 0)) return false;
    return hz === Number.POSITIVE_INFINITY || t - w.lastDraw >= 1000 / hz - WINDOW_SLACK_MS;
  };

  const markWindows = () => {
    for (const name of WINDOW_NAMES) wins[name].dirty = true;
  };

  /**
   * Brings the shared frame and contexts up to date before any hook runs. With `at` (a loop
   * frame) a window's context is handed out only when its redraw rate is due.
   */
  const syncFrame = (still: boolean, at?: number) => {
    const scrollY = scrollPos;
    frame.scrollY = scrollY;
    frame.page = page.getSnapshot();
    frame.tier = governor.tier;
    frame.still = still;
    for (const name of WINDOW_NAMES) {
      const w = wins[name];
      const on = w.visible && w.doc !== null && w.ctx !== null;
      frame.win[name] = on && w.doc ? { x: w.doc.x, y: w.doc.y - scrollY, w: w.cssW, h: w.cssH } : null;
      g[name] = on && w.ctx && (at === undefined || windowDue(name, w, at)) ? w.ctx : undefined;
    }
  };

  /** Records the windows a drawn frame painted. */
  const windowsDrawn = (t: number) => {
    for (const name of WINDOW_NAMES) {
      if (!g[name]) continue;
      wins[name].dirty = false;
      wins[name].lastDraw = t;
    }
  };

  const clearPlanes = () => {
    if (liveCtx) clearCanvas(liveCtx, planes.live);
    for (const name of WINDOW_NAMES) {
      const ctx = g[name];
      if (ctx) clearCanvas(ctx, wins[name].canvas);
    }
  };

  /** Fills frame.staticY for a scroll position; null is still mode (no parallax). */
  const placeStatics = (scrollY: number | null) => {
    planes.statics.forEach((plane, i) => {
      staticY[i] = scrollY === null ? 0 : staticOffset(scrollY, plane);
    });
  };

  /** Writes each static plane's transform from frame.staticY and the scene's shift (none when still). */
  const moveStatics = (still: boolean) => {
    planes.statics.forEach((plane, i) => {
      const x = still ? 0 : shifts[i].x;
      const y = Math.round((-staticY[i] + (still ? 0 : shifts[i].y)) * 10) / 10;
      const value = `translate3d(${x === 0 ? "0" : `${x}px`}, ${y}px, 0)`;
      if (value === staticTransforms[i]) return;
      plane.canvas.style.transform = value;
      staticTransforms[i] = value;
    });
  };

  const teardown = () => {
    dead = true;
    running = false;
    for (const cleanup of cleanups.splice(0)) cleanup();
    clearTimeout(settleTimer);
    jobs = [];
    if (idleHandle) deps.cancelIdle(idleHandle);
    idleHandle = 0;
    if (switchPoll) deps.cancelAnimationFrame(switchPoll);
    scene?.destroy();
    if (hooks) {
      try {
        hooks.dispose();
      } catch (error) {
        console.error(error);
      }
    }
    out.dispose();
    surfaces.releaseAll();
    if (statsOn) publishStats();
    for (const name of WINDOW_NAMES) resetCanvas(wins[name].canvas, wins[name].ctx);
    // The sky planes belong to this theme's hidden container: drop their backing stores. The
    // window canvases are shared with the next theme, which resizes them on mount.
    for (const canvas of skyCanvases) {
      canvas.width = 0;
      canvas.height = 0;
    }
    for (const canvas of allCanvases) {
      canvas.style.removeProperty("opacity");
      canvas.style.removeProperty("transition");
    }
    for (const plane of planes.statics) plane.canvas.style.removeProperty("transform");
  };

  const fail = () => {
    if (dead) return;
    teardown();
    planes.root.dataset.sceneFailed = "";
    deps.globals[initName] = false;
    bus.emit("hub:scene", { key, status: "failed" });
  };

  /** Runs a hook. A throw before the first drawn frame, or three in a row after it, fails the scene. */
  const guard = (fn: () => void): boolean => {
    try {
      fn();
      return true;
    } catch (error) {
      console.error(error);
      fails++;
      if (!drawn || fails >= MAX_FAILS) fail();
      return false;
    }
  };

  const firstDrawn = (instant: boolean) => {
    if (drawn) return;
    drawn = true;
    for (const canvas of allCanvases) {
      if (instant) canvas.style.transition = "none";
      canvas.style.opacity = "1";
    }
    bus.emit("hub:scene", { key, status: stillMode() ? "still" : "ready" });
  };

  /**
   * Draws one frame outside the loop with time held: the composed still() frame, or, with
   * composed false, render() at dt 0. Statics sit at 0 in still mode (no parallax) and at the
   * scroll offset otherwise, where the next live frame puts them.
   */
  const drawOnce = (composed: boolean) => {
    if (dead || !hooks || !liveCtx || frame.width <= 0 || frame.height <= 0) return;
    const h = hooks;
    const scrollY = scrollPos;
    const still = stillMode();
    frame.dt = 0;
    frame.scrollVel = 0;
    lastScrollY = scrollY;
    syncFrame(composed);
    placeStatics(still ? null : scrollY);
    clearPlanes();
    // The composition may place DOM perches even while still; it replaces the last one's.
    if (composed) out.compose?.(true);
    const ok = guard(() => (composed ? h.still(frame, g) : h.render(frame, g)));
    if (composed) out.compose?.(false);
    pointer.justTapped = false;
    if (dead) return;
    moveStatics(still);
    if (!ok) return;
    windowsDrawn(deps.now());
    fails = 0;
    firstDrawn(true);
  };
  const drawStill = () => drawOnce(true);

  /**
   * A size or layout change while the loop is not running. Still mode recomposes; a held loop
   * (dialog, switch, owner stop) keeps its last frame unless a backing store was cleared.
   */
  const redrawHeld = (cleared: boolean) => {
    if (running) return;
    if (stillMode()) drawStill();
    else if (cleared) drawOnce(false);
  };

  const maybeIntro = () => {
    if (introChecked) return;
    introChecked = true;
    const intro = hooks?.intro;
    if (!intro || softReturn || stillMode() || host.document.hidden) return;
    const storageKey = INTRO_KEY + key;
    try {
      if (host.sessionStorage.getItem(storageKey)) return;
      host.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Storage is blocked: the intro plays on this activation only.
    }
    guard(() => intro.call(hooks));
  };

  const shouldRun = () => !dead && hooks !== null && ownerWants && !switching && !modalHeld && !stillMode();

  const apply = () => {
    if (!scene) return;
    if (shouldRun()) {
      if (running) return;
      running = true;
      lastDrawAt = -1;
      // A still frame drawn outside still mode (switch snapshot, mount under a dialog) froze the output.
      out.resume();
      scene.start();
      maybeIntro();
    } else if (running) {
      running = false;
      lastDrawAt = -1;
      scene.stop();
    }
  };

  const settleMs = () => Math.max(0, hooks?.modalSettleMs ?? 0);

  const publishStats = () => {
    const result: HubSceneStats = {
      ...governor.stats(),
      key,
      // Estimate: draw time on frames with a window on screen minus frames without one.
      windowsMs: drawWith >= 0 && drawWithout >= 0 ? Math.max(0, drawWith - drawWithout) : 0,
      liveSurfaceBytes: surfaces.liveBytes,
      cardWritesMs,
      cardWrites,
      canvasBytes: allCanvases.reduce((sum, canvas) => sum + canvas.width * canvas.height * 4, 0),
      paintStepMaxMs,
    };
    deps.globals.__hubSceneStats = result;
  };

  const recordStats = (drawMs: number, anyWindow: boolean) => {
    cardWritesMs = cardWritesMs + STATS_EMA * (cardMs - cardWritesMs);
    if (anyWindow) drawWith = drawWith < 0 ? drawMs : drawWith + STATS_EMA * (drawMs - drawWith);
    else drawWithout = drawWithout < 0 ? drawMs : drawWithout + STATS_EMA * (drawMs - drawWithout);
    if (!statsOn || governor.stats().frames % STATS_EVERY !== 0) return;
    publishStats();
  };

  const onRender = (_ctx: Ctx, sf: Readonly<{ t: number; width: number; height: number; dpr: number }>) => {
    if (dead || !hooks) return;
    const h = hooks;
    const t0 = deps.now();
    if (lastDrawAt >= 0 && t0 - lastDrawAt < FRAME_MIN_MS) return;
    const interval = lastDrawAt >= 0 ? t0 - lastDrawAt : 0;
    lastDrawAt = t0;
    frame.dt = clampDt(interval / 1000);
    frame.t = sf.t;
    frame.width = sf.width;
    frame.height = sf.height;
    frame.dpr = sf.dpr;
    const scrollY = scrollPos;
    frame.scrollVel = frame.dt > 0 ? (scrollY - lastScrollY) / frame.dt : 0;
    lastScrollY = scrollY;
    syncFrame(false, t0);
    placeStatics(scrollY);
    clearPlanes();
    cardMs = 0;
    const r0 = deps.now();
    const ok = guard(() => h.render(frame, g));
    const drawMs = deps.now() - r0;
    pointer.justTapped = false;
    if (dead) return;
    moveStatics(false);
    if (!ok) return;
    windowsDrawn(t0);
    fails = 0;
    governor.sample(drawMs, interval, t0);
    recordStats(drawMs, g.stage !== undefined || g.mid !== undefined || g.ground !== undefined);
    firstDrawn(false);
    if (modalSince !== null && !modalHeld && t0 - modalSince >= settleMs()) {
      modalHeld = true;
      apply();
    }
  };

  const onResize = (size: Readonly<SceneSize>, ctx: Ctx) => {
    if (dead || !hooks) return;
    const h = hooks;
    liveCtx = ctx;
    g.live = ctx;
    frame.width = size.width;
    frame.height = size.height;
    frame.dpr = size.dpr;
    syncFrame(stillMode());
    if (!guard(() => h.resize(frame))) return;
    markWindows();
    if (mounted) redrawHeld(true);
  };

  /* ---------------------------------------------------------------- pointer */

  const locate = (x: number, y: number): { zone: Zone; slug?: string } => {
    if (modalOpen) return { zone: "modal" };
    const yDoc = y + scrollPos;
    const zone = page.zoneAt(x, yDoc);
    return zone === "card" ? { zone, slug: page.cardAt(x, yDoc)?.slug } : { zone };
  };

  const notify = (zone: Zone, slug: string | undefined, tap: boolean, pressed: boolean, type: string) => {
    lastZone = zone;
    lastSlug = slug;
    const onPointer = hooks?.onPointer;
    if (dead || !onPointer) return;
    guard(() => onPointer.call(hooks, { zone, slug, x: pointer.x, y: pointer.y, tap, press: pressed, type, active: pointer.active }));
  };

  const place = (event: PointerEvent) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.nx = frame.width > 0 ? pointer.x / frame.width : 0.5;
    pointer.ny = frame.height > 0 ? pointer.y / frame.height : 0.5;
    pointer.type = event.pointerType || "mouse";
  };

  const onPointerMove = (e: Event) => {
    const event = e as PointerEvent;
    if (!event.isPrimary) return;
    place(event);
    pointer.active = pointer.type === "mouse" || pointer.down;
    if (press && press.swipe && !press.dragged) {
      const dx = event.clientX - press.x;
      const dy = event.clientY - press.y;
      if (Math.abs(dx) > DRAG_PX && Math.abs(dx) > Math.abs(dy)) {
        press.dragged = true;
        bus.emit("hub:stage", { window: "stage", action: dx < 0 ? "left" : "right", x: event.clientX, y: event.clientY });
      }
    }
    const { zone, slug } = locate(pointer.x, pointer.y);
    notify(zone, slug, false, false, pointer.type);
  };

  const onPointerDown = (e: Event) => {
    const event = e as PointerEvent;
    if (!event.isPrimary) return;
    place(event);
    pointer.active = true;
    pointer.down = true;
    pointer.justTapped = false;
    swallowClick = false;
    const { zone, slug } = locate(pointer.x, pointer.y);
    const onHit = onStageHit(event.target);
    press = { x: event.clientX, y: event.clientY, at: event.timeStamp, id: event.pointerId, zone, swipe: zone === "stage" || onHit, onHit, dragged: false };
    notify(zone, slug, false, false, pointer.type);
  };

  const onRelease = (event: PointerEvent, cancelled: boolean) => {
    if (!event.isPrimary) return;
    // A cancelled touch (the browser took over to scroll) reports 0,0; keep the last real position.
    if (!cancelled) place(event);
    const started = press;
    press = null;
    swallowClick = started !== null && started.onHit && started.dragged;
    pointer.down = false;
    if (pointer.type !== "mouse") pointer.active = false;
    const { zone, slug } = locate(pointer.x, pointer.y);
    let tapped = false;
    let pressed = false;
    if (!cancelled && started && started.id === event.pointerId && !started.dragged && TAPPABLE.has(started.zone) && TAPPABLE.has(zone)) {
      const dx = event.clientX - started.x;
      const dy = event.clientY - started.y;
      const held = event.timeStamp - started.at;
      tapped = isTap(dx, dy, held);
      pressed = held >= PRESS_MS && Math.hypot(dx, dy) < PRESS_MOVE_PX;
    }
    pointer.justTapped = tapped;
    notify(zone, slug, tapped, pressed, pointer.type);
    if (dead) return;
    if ((tapped || pressed) && stillMode()) drawStill();
    else if (!running) pointer.justTapped = false;
  };

  /** Capture on window runs before the hit button's own click listener. Keyboard clicks (detail 0) pass. */
  const onClickCapture = (e: Event) => {
    if (!swallowClick) return;
    swallowClick = false;
    if ((e as MouseEvent).detail === 0 || !onStageHit(e.target)) return;
    e.stopImmediatePropagation();
    e.preventDefault();
  };

  const onPointerUp = (e: Event) => onRelease(e as PointerEvent, false);
  const onPointerCancel = (e: Event) => onRelease(e as PointerEvent, true);

  /** A mouse leaving the window (scene-runtime parity); touch and pen contact ends in pointerup or pointercancel. */
  const onPointerOut = (e: Event) => {
    const event = e as PointerEvent;
    if (event.pointerType !== "mouse" || event.relatedTarget !== null || !event.isPrimary) return;
    pointer.active = false;
    const { zone, slug } = locate(pointer.x, pointer.y);
    notify(zone, slug, false, false, "mouse");
    lastZone = null;
    lastSlug = undefined;
  };

  const onBlur = () => {
    pointer.active = false;
    pointer.down = false;
    press = null;
    swallowClick = false;
  };

  const onScroll = () => {
    scrollPos = host.scrollY;
    if (pointer.active && hooks?.onPointer) {
      const { zone, slug } = locate(pointer.x, pointer.y);
      if (zone !== lastZone || slug !== lastSlug) notify(zone, slug, false, false, pointer.type);
    }
    if (!stillMode()) return;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      settleTimer = undefined;
      if (stillMode()) drawStill();
    }, SCROLL_SETTLE_MS);
  };

  /* ---------------------------------------------------------------- staged painting */

  const pump = (deadline: IdleDeadlineLike) => {
    idleHandle = 0;
    let first = true;
    while (!dead && jobs.length > 0 && (first || deadline.timeRemaining() > PAINT_RESERVE_MS)) {
      first = false;
      const job = jobs[0];
      const step = job.steps.shift();
      if (step) {
        const t = deps.now();
        const ok = guard(step);
        paintStepMaxMs = Math.max(paintStepMaxMs, deps.now() - t);
        if (dead) return;
        if (!ok) {
          jobs.shift();
          continue;
        }
      }
      if (job.steps.length > 0) continue;
      jobs.shift();
      const onDone = job.onDone;
      if (onDone && !guard(onDone)) continue;
      if (dead) return;
      if (!running && stillMode()) drawStill();
    }
    if (!dead && jobs.length > 0) idleHandle = deps.requestIdle(pump);
  };

  const paint: PaintQueue = {
    run(key, steps, onDone) {
      if (dead) return;
      jobs = jobs.filter((job) => job.key !== key);
      jobs.push({ key, steps: [...steps], onDone });
      if (!idleHandle) idleHandle = deps.requestIdle(pump);
    },
    cancel(key) {
      jobs = key === undefined ? [] : jobs.filter((job) => job.key !== key);
      if (jobs.length === 0 && idleHandle) {
        deps.cancelIdle(idleHandle);
        idleHandle = 0;
      }
    },
    get pending() {
      return jobs.reduce((n, job) => n + job.steps.length, 0);
    },
  };

  const shiftStatic = (index: number, x: number, y: number) => {
    const shift = shifts[index];
    if (!shift || !Number.isFinite(x) || !Number.isFinite(y)) return;
    shift.x = Math.round(x * 10) / 10;
    shift.y = Math.round(y * 10) / 10;
  };

  /* ---------------------------------------------------------------- events */

  const toScene = (event: SceneEvent) => {
    const onEvent = hooks?.onEvent;
    if (!dead && onEvent) guard(() => onEvent.call(hooks, event));
  };

  const onModal = (detail: HubEventMap["hub:modal"]) => {
    modalOpen = detail.open;
    toScene({ name: "hub:modal", detail });
    if (dead) return;
    // The picker is a light sheet: the scene keeps running behind it.
    if (detail.kind !== "picker") {
      if (detail.open) {
        if (modalSince === null) {
          modalSince = deps.now();
          if (!running || settleMs() === 0) {
            modalHeld = true;
            apply();
          }
        }
      } else {
        modalSince = null;
        modalHeld = false;
        apply();
      }
    }
    if (stillMode()) drawStill();
  };

  const onMotionChange = () => {
    const still = stillMode();
    if (still === wasStill || dead) return;
    wasStill = still;
    apply();
    if (still) drawStill();
  };

  const pollSwitch = () => {
    switchPoll = 0;
    if (dead) return;
    if (html.dataset.hubSwitch !== undefined) {
      switchPoll = deps.requestAnimationFrame(pollSwitch);
      return;
    }
    switching = false;
    apply();
  };

  /* ---------------------------------------------------------------- mount */

  const now = new Date();
  const seedParam = params.get("seed");
  const seedValue = seedParam !== null && seedParam.trim() !== "" ? Number(seedParam) : Number.NaN;
  const seed = Number.isFinite(seedValue) ? Math.trunc(seedValue) >>> 0 : fnv1a(`${key}:${isoWeek(now)}`);

  try {
    hooks = build({ out: sceneOut, bus, page, surfaces, seed, now, moonPhase: moonPhase(now), paint, shiftStatic });
  } catch (error) {
    console.error(error);
    fail();
  }

  const handle: HubSceneHandle = {
    start() {
      if (dead) return;
      ownerWants = true;
      apply();
    },
    stop() {
      if (dead) return;
      ownerWants = false;
      apply();
    },
    destroy() {
      if (dead) return;
      teardown();
      deps.globals[initName] = false;
    },
    redrawStill() {
      if (!dead && !running) drawStill();
    },
  };

  if (dead) return handle;

  // One layout read for the windows; createScene reads its container next, before any canvas is
  // resized, so the bind forces at most one synchronous layout. The window stores are sized after.
  readWindows();
  const viewportH = page.getSnapshot().viewport.h;
  for (const name of WINDOW_NAMES) {
    const w = wins[name];
    w.visible = w.doc !== null && w.doc.y - scrollPos < viewportH && w.doc.y + w.doc.h - scrollPos > 0;
  }

  let created: SceneHandle | null = null;
  try {
    created = deps.createScene({
      canvas: planes.live,
      container: planes.root,
      dprCap: KIT_DPR_CAP,
      render: onRender,
      resize: onResize,
      // Reduced motion flips inside createScene first; route its still frame through the kit.
      reducedMotionFrame: () => drawStill(),
    });
  } catch (error) {
    console.error(error);
    fail();
  }
  // A hook can fail while createScene is still measuring, before the handle exists.
  if (dead) {
    created?.destroy();
    return handle;
  }
  scene = created;
  sizeWindows();

  const listen = (type: string, fn: (event: Event) => void, opts?: AddEventListenerOptions) => {
    host.addEventListener(type, fn, opts);
    cleanups.push(() => host.removeEventListener(type, fn, opts));
  };
  const passive = { passive: true };
  listen("pointermove", onPointerMove, passive);
  listen("pointerdown", onPointerDown, passive);
  listen("pointerup", onPointerUp, passive);
  listen("pointercancel", onPointerCancel, passive);
  listen("pointerout", onPointerOut, passive);
  listen("click", onClickCapture, { capture: true });
  listen("scroll", onScroll, passive);
  listen("blur", onBlur);

  reduceQuery.addEventListener("change", onMotionChange);
  cleanups.push(() => reduceQuery.removeEventListener("change", onMotionChange));

  cleanups.push(
    bus.on("hub:modal", onModal),
    bus.on("hub:motion", (detail) => {
      motionStill = detail.still;
      onMotionChange();
    }),
    ...FORWARDED.map((name) =>
      bus.on(name, (detail) => {
        toScene({ name, detail } as SceneEvent);
        if (stillMode()) drawStill();
      }),
    ),
    page.subscribe(() => {
      if (dead || !hooks) return;
      const h = hooks;
      const resized = measureWindows();
      syncFrame(stillMode());
      if (resized && !guard(() => h.resize(frame))) return;
      if (!guard(() => h.layout(frame))) return;
      markWindows();
      redrawHeld(resized);
    }),
  );

  const resizeObserver = new deps.ResizeObserver(() => {
    if (dead || !hooks) return;
    const h = hooks;
    if (!measureWindows()) return;
    syncFrame(stillMode());
    if (!guard(() => h.resize(frame))) return;
    redrawHeld(true);
  });
  const intersectionObserver = new deps.IntersectionObserver(
    (entries) => {
      let entered = false;
      for (const entry of entries) {
        const w = byCanvas.get(entry.target);
        if (!w) continue;
        if (entry.isIntersecting && !w.visible) {
          entered = true;
          w.dirty = true;
        }
        w.visible = entry.isIntersecting;
      }
      if (entered && stillMode()) drawStill();
    },
    { rootMargin: "48px 0px" },
  );
  for (const name of WINDOW_NAMES) {
    resizeObserver.observe(wins[name].canvas);
    intersectionObserver.observe(wins[name].canvas);
  }
  cleanups.push(
    () => resizeObserver.disconnect(),
    () => intersectionObserver.disconnect(),
  );

  mounted = true;
  deps.globals[initName] = true;

  // A switch snapshot, a still page and a page paused under a dialog all start from one composed frame.
  if (switching || stillMode() || modalHeld) drawStill();
  if (switching) switchPoll = deps.requestAnimationFrame(pollSwitch);
  apply();
  return handle;
}

/**
 * The planes of a sky root: canvas[data-sky-static] in DOM order with the given parallax,
 * canvas[data-sky-live] and the three shared window canvases. Null when any is missing.
 */
export function collectPlanes(
  root: HTMLElement,
  statics: readonly { parallax: number; period?: number }[] = [],
): HubPlanes | null {
  const live = root.querySelector<HTMLCanvasElement>("canvas[data-sky-live]");
  const staticCanvases = [...root.querySelectorAll<HTMLCanvasElement>("canvas[data-sky-static]")];
  const windowCanvas = (name: WindowName) =>
    root.ownerDocument.querySelector<HTMLCanvasElement>(`[data-hub-window="${name}"] canvas[data-hub-window-canvas]`);
  const stage = windowCanvas("stage");
  const mid = windowCanvas("mid");
  const ground = windowCanvas("ground");
  if (!live || !stage || !mid || !ground || staticCanvases.length < statics.length) return null;
  return {
    root,
    live,
    statics: staticCanvases.map((canvas, i) => ({ canvas, parallax: statics[i]?.parallax ?? 0, period: statics[i]?.period })),
    windows: { stage, mid, ground },
  };
}

/** Converts a point between planes: the sky is viewport px, a window is px from its canvas's top-left. */
export function toPlane(win: HubFrame["win"], from: Plane, to: Plane, x: number, y: number): Vec | null {
  if (from === to) return { x, y };
  let vx = x;
  let vy = y;
  if (from !== "sky") {
    const r = win[from];
    if (!r) return null;
    vx += r.x;
    vy += r.y;
  }
  if (to === "sky") return { x: vx, y: vy };
  const r = win[to];
  if (!r) return null;
  return { x: vx - r.x, y: vy - r.y };
}
