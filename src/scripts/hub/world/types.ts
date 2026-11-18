// Frozen interfaces of the hub theme engine (spec 2.9-2.12 and section 8).
// Types and tiny constants only: this module must import cleanly in Node.

import type { SceneFrame, SceneHandle, SceneOptions } from "../../_shared/scene-runtime";
import type { Surface } from "../scene-paint";

export type { Surface };

/* ------------------------------------------------------------------ geometry */

/** CSS pixels. Page-model rects are in document coordinates unless a name says otherwise. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Vec {
  x: number;
  y: number;
}

/* ------------------------------------------------------------------ registry */

export type HubThemeKey = "pages-stars" | "skyglass" | "constellation" | "mothlight" | "firefly";

export interface HubThemeRow {
  key: HubThemeKey;
  /** Global suffix: window.__bind<Bind>, window.__<lowerFirst(bind)>Cleanup | Initialized | Preload. */
  bind: string;
  /** Element id of the theme's display wrapper. */
  container: string;
  themeColor: string;
  enabled: boolean;
}

export interface RotationEpoch {
  /** ISO date, always a Monday at 07:00 +07:00. */
  from: string;
  order: readonly HubThemeKey[];
}

export type ThemeSource = "param" | "stored" | "session" | "weekly";

export interface ResolveInput {
  /** `?theme=` value, if any. */
  param?: string | null;
  /** Stored override, or null when absent or storage threw. */
  stored?: string | null;
  /** In-memory override kept when storage threw on write. */
  session?: string | null;
  nowMs: number;
}

export interface ResolvedTheme {
  key: HubThemeKey;
  source: ThemeSource;
  /** True when `stored` was present but is not an enabled key: the caller removes it. */
  invalidStored: boolean;
}

/* ------------------------------------------------------------------ page model */

export type HubMode = "wide" | "desktop" | "narrow" | "phone" | "landscape-short";
export type CardKind = "open" | "locked" | "upcoming";
export type WindowName = "stage" | "mid" | "ground";
export type HitWindowName = "stage" | "mid";
export type Plane = "sky" | WindowName;
export type Zone = "open" | "stage" | "mid" | "ground" | "card" | "ui" | "modal";

export interface CardInfo {
  /** data-novel-slug or data-upcoming-slug. */
  slug: string;
  /** open: data-status="เผยแพร่"; locked: any other data-novel-slug; upcoming: data-upcoming-slug. */
  kind: CardKind;
  index: number;
  /** Inline --novel-accent of .novel-card. */
  accent: string;
  rect: Rect;
  media: Rect;
  body: Rect;
  /** --card-read on the wrapper, null when unset. */
  read: number | null;
  /** data-card-finished on the wrapper. */
  finished: boolean;
  /** .novel-card-state text. */
  stateText: string;
  /** .novel-card-title text. */
  titleTh: string;
}

export interface PageParts {
  chip?: Rect;
  picker?: Rect;
  title: Rect;
  sideNote?: Rect;
  resume?: Rect;
  start?: Rect;
  libraryHead: Rect;
  footer: Rect;
}

export interface PageWindows {
  stage: Rect;
  mid: Rect;
  ground: Rect;
  /** Window box x the theme's CSS hit fractions, at least 44x44. */
  stageHit: Rect;
  midHit: Rect;
}

export interface Row {
  top: number;
  bottom: number;
}

export interface PageSnapshot {
  version: number;
  mode: HubMode;
  viewport: { w: number; h: number; coarse: boolean; dpr: number };
  shell: Rect;
  gutters: { left: number; right: number };
  topBand: Rect;
  /** Text and controls that must stay clear. */
  holes: Rect[];
  parts: PageParts;
  windows: PageWindows;
  /** Reading order. */
  cards: CardInfo[];
  rows: Row[];
  /** Between card rows, full viewport width. */
  bands: Rect[];
  /** Per row segment, any column count. */
  colGaps: Rect[];
  /** Opaque rects: cards, resume card, start panel, chip, side note, picker button. */
  cover: Rect[];
  modalOpen: boolean;
}

/** Raw measurement handed from page-model.ts to the pure buildSnapshot(). */
export interface PageMeasure {
  viewport: PageSnapshot["viewport"];
  shell: Rect;
  parts: PageParts;
  windows: Record<WindowName, Rect>;
  /** Fractions (0..1) of each hit window box, read from --stage-hit-* and --mid-hit-*. */
  hitFractions: Record<HitWindowName, Rect>;
  cards: CardInfo[];
  holes: Rect[];
  cover: Rect[];
  modalOpen: boolean;
}

export interface Regions {
  topBand: Rect;
  rows: Row[];
  bands: Rect[];
  colGaps: Rect[];
}

export interface PageModel {
  /** Current snapshot; the first call measures synchronously. */
  getSnapshot(): PageSnapshot;
  /** Measures now (synchronously) and notifies subscribers when the result changed. */
  refresh(): PageSnapshot;
  /** Called after every re-measure that bumps the version. Returns unsubscribe. */
  subscribe(fn: (snapshot: PageSnapshot) => void): () => void;
  zoneAt(x: number, yDoc: number): Zone;
  cardAt(x: number, yDoc: number): CardInfo | null;
  isCovered(x: number, yDoc: number, pad?: number): boolean;
  holeDistance(x: number, yDoc: number): number;
  /** Document rect to viewport rect; scrollY defaults to the live scroll position. */
  toViewport(rect: Rect, scrollY?: number): Rect;
  /** Disconnects every observer and listener. Safe to repeat. */
  dispose(): void;
}

/* ------------------------------------------------------------------ live channel (2.9, 8.5 item 1) */

export type RootVarName = "w-light-x" | "w-light-y" | "w-light" | "w-breath" | "w-sky" | "w-sun";
export type CardVarName = "w-glow" | "w-lx" | "w-ly";
export type RootVars = Partial<Record<RootVarName, number>>;
export type CardVars = Partial<Record<CardVarName, number>>;
export type PerchKind = "moth" | "firefly";
export type PerchTarget = string | "chip";

export interface PerchSpec {
  kind: PerchKind;
  /** 0..1 along the top edge of the wrapper or chip. */
  u: number;
}

export interface LabelAnchor {
  /** Sky: viewport CSS px. Window planes: CSS px from the window canvas's top-left corner. */
  x: number;
  y: number;
  plane: Plane;
}

export interface Output {
  root(vars: RootVars): void;
  card(slug: string, vars: CardVars): void;
  heroPoolX(percent: number): void;
  /** null = page-wide (title, footer). */
  beat(slug: string | null, kind: string): void;
  /** Returns the perch id (>= 1), or 0 when refused (3 perches live, or still). */
  perch(target: PerchTarget, spec: PerchSpec): number;
  unperch(id: number): void;
  /** ms defaults to LABEL_MS (2500). */
  label(slug: string, at: LabelAnchor, ms?: number): void;
  /** Scroll into view (smooth unless still) and focus the card link. */
  focusCard(slug: string): void;
  /** One composed write; every other call is a no-op until resume(). */
  still(rootVars: RootVars, cardVars: Record<string, CardVars>): void;
  /** Leaves still mode. */
  resume(): void;
  /** Unperches every perch it made, clears its root and card vars and beat attributes, stops its timers. */
  dispose(): void;
  /**
   * Polite screen-reader text (hub:out-announce), at most one per ANNOUNCE_MS. createOutput and
   * the kit's ctx.out always have it; it is optional here only so older test fakes still type-check.
   */
  announce?(text: string): void;
  /**
   * Kit only: brackets the still composition. compose(true) unperches the last composition's
   * perches and lets out.perch place DOM perches while still; compose(false) closes the bracket.
   */
  compose?(on: boolean): void;
}

/** The output a scene gets as ctx.out: announce is always there. */
export type SceneOutput = Omit<Output, "announce" | "compose"> & { announce(text: string): void };

/** Deferred writes that are due now (Limiter.flush). */
export interface LimiterFlush {
  root: RootVars | null;
  cards: [slug: string, vars: CardVars][];
}

/**
 * Pure limiter state machine used by output.ts (output-core.ts). The rate limit counts writes,
 * not calls: a value that arrives inside a rate gap is kept per variable and written with the
 * next allowed write; calls within BURST_MS of the call that opened a write join that write.
 */
export interface Limiter {
  /** Quantised subset that changed and may be written now (merged with deferred values), or null. */
  root(vars: RootVars): RootVars | null;
  /** Quantised, slew-limited subset to write now (merged with deferred values), or null (rate, threshold or not intersecting). */
  card(slug: string, vars: CardVars, intersecting: boolean): CardVars | null;
  /** Writes every deferred value whose rate window has opened; cards no longer intersecting drop theirs. */
  flush(intersecting: (slug: string) => boolean): LimiterFlush;
  /** Clock time at which the earliest deferred value may be written, or null when none waits. */
  pendingAt(): number | null;
  /** Records card values the still composition wrote, so later writes compare and slew from them. */
  seed(slug: string, vars: CardVars): void;
  /** Records root values the still composition wrote. */
  seedRoot(vars: RootVars): void;
  /** Beat value to write ("a" | "b" alternating per target), or null when refused. null slug = page-wide. */
  beat(slug: string | null): "a" | "b" | null;
  /** New perch id (>= 1), or 0 when 3 are live, or when still unless composed (the still composition places it). */
  perch(composed?: boolean): number;
  /** False when the id was not live. */
  unperch(id: number): boolean;
  readonly still: boolean;
  /** Entering still mode drops deferred values and opens every rate window; written values are kept. */
  setStill(still: boolean): void;
  /** Forgets every rate, slew, beat and perch record. */
  reset(): void;
}

/* ------------------------------------------------------------------ event bus (2.11 + 8.3, 8.5) */

export interface HubEventMap {
  "hub:theme": { key: HubThemeKey; previous: HubThemeKey | null; source: "load" | "picker" | "param" };
  /** A ping; ResumeCard dispatches it inline with no detail, which the bus delivers as {}. */
  "hub:reading": Record<string, never>;
  "hub:attention": { slug: string | null; kind: CardKind | null; source: "hover" | "focus" | "center" | "resume" };
  "hub:press": { slug: string; kind: CardKind };
  /** x, y: viewport CSS px, present only for pointer input. */
  "hub:stage": { window: HitWindowName; action: "tap" | "left" | "right"; x?: number; y?: number };
  "hub:pick": { slug: string | null; reason: "new" | "continue" | "all-read"; origin: "start" | "head" | "footer" };
  /** kind "picker": the kit does not pause for it. */
  "hub:modal": { open: boolean; kind?: "picker" };
  "hub:motion": { still: boolean };
  "hub:layout": { version: number };
  "hub:scene": { key: HubThemeKey; status: "ready" | "still" | "failed" };
  "hub:out-perch": { id: number; target: PerchTarget; kind: PerchKind; u: number };
  "hub:out-unperch": { id: number };
  "hub:out-label": { slug: string; x: number; y: number; plane: Plane; ms: number };
  "hub:out-focus": { slug: string };
  /** Chrome writes text into the polite live region [data-hub-announce]. */
  "hub:out-announce": { text: string };
}

export type HubEventName = keyof HubEventMap;

/** Events whose last detail is kept on window.__hubState and returned by last(). */
export const STICKY_EVENTS = ["hub:theme", "hub:motion", "hub:modal", "hub:layout", "hub:scene", "hub:attention"] as const;
export type StickyEventName = (typeof STICKY_EVENTS)[number];
export type HubState = { [K in StickyEventName]?: HubEventMap[K] };

export interface Bus {
  /** Listens on document for the CustomEvent `name`; fn receives its detail. Returns off. */
  on<K extends HubEventName>(name: K, fn: (detail: HubEventMap[K]) => void): () => void;
  /** Records sticky details first, then dispatches a CustomEvent on document. */
  emit<K extends HubEventName>(name: K, detail: HubEventMap[K]): void;
  last<K extends StickyEventName>(name: K): HubEventMap[K] | undefined;
}

/** Events forwarded to HubSceneHooks.onEvent. */
export type SceneEventName = "hub:theme" | "hub:reading" | "hub:attention" | "hub:press" | "hub:stage" | "hub:pick" | "hub:modal";
export type SceneEvent = { [K in SceneEventName]: { name: K; detail: HubEventMap[K] } }[SceneEventName];

/* ------------------------------------------------------------------ surfaces */

/** The scene-paint shape that surfaces.ts wraps; injectable for tests. */
export interface SurfaceFactory {
  surface(w: number, h: number): Surface;
  release(...canvases: HTMLCanvasElement[]): void;
}

export interface Surfaces {
  create(w: number, h: number): Surface;
  /** Releases one surface; unknown or already released surfaces are ignored. */
  release(surface: Surface): void;
  releaseAll(): void;
  /** Sum of width x height x 4 over live surfaces. */
  readonly liveBytes: number;
  readonly created: number;
  readonly released: number;
}

/* ------------------------------------------------------------------ quality governor */

export type Tier = 0 | 1 | 2;

export interface TierEnv {
  coarse: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  saveData?: boolean;
}

export interface GovernorStats {
  tier: Tier;
  drawMsMean: number;
  drawMsEma: number;
  drawMsP95: number;
  frames: number;
  dropped: number;
}

export interface Governor {
  readonly tier: Tier;
  /** One drawn frame: render time, interval since the previous drawn frame, clock. Returns the tier now. */
  sample(drawMs: number, intervalMs: number, nowMs: number): Tier;
  stats(): GovernorStats;
}

/* ------------------------------------------------------------------ scene kit (2.12, 8.3, 8.4) */

export type Ctx = CanvasRenderingContext2D;

export interface StaticPlane {
  canvas: HTMLCanvasElement;
  parallax: number;
  period?: number;
}

export interface HubPlanes {
  /** Fixed sky root (.hub-sky) inside the theme container. */
  root: HTMLElement;
  /** Cleared every frame; driven by createScene. */
  live: HTMLCanvasElement;
  /** Painted once per size, moved by CSS transform. */
  statics: StaticPlane[];
  /** Shared in-flow canvases. */
  windows: Record<WindowName, HTMLCanvasElement>;
}

export interface HubFrame extends SceneFrame {
  scrollY: number;
  /** px/s */
  scrollVel: number;
  /** Viewport rect of each window canvas while it is on screen, else null. */
  win: Record<WindowName, Rect | null>;
  page: PageSnapshot;
  tier: Tier;
  still: boolean;
  /**
   * Per static plane, in HubPlanes.statics order: how far its compositor transform moves it up
   * this frame (scroll x parallax, wrapped by period; 0 in still mode). A live sprite that sits
   * on plane i at plane y P is at viewport y P - staticY[i].
   */
  staticY: readonly number[];
}

export interface HubContexts {
  live: Ctx;
  stage?: Ctx;
  mid?: Ctx;
  ground?: Ctx;
}

export interface HubPointer {
  zone: Zone;
  slug?: string;
  /** Viewport CSS px. */
  x: number;
  y: number;
  tap: boolean;
  press: boolean;
  type: string;
  /** False once a mouse left the window or a touch or pen contact ended. */
  active: boolean;
}

export interface HubSceneHooks {
  /** Recompose and repaint statics; never reseed. */
  resize(f: HubFrame): void;
  /** Page model changed. */
  layout(f: HubFrame): void;
  render(f: HubFrame, g: HubContexts): void;
  /** Composed reduced-motion frame, including the reading map. */
  still(f: HubFrame, g: HubContexts): void;
  onPointer?(p: HubPointer): void;
  onEvent?(event: SceneEvent): void;
  /** Opening choreography, at most 2.2 s. */
  intro?(): void;
  /** Keep drawing this long after a modal opens (default 0). */
  modalSettleMs?: number;
  /**
   * Redraw rate of a window canvas in Hz at a tier (default: every drawn frame). On a frame
   * where the window is not due its context is left out of HubContexts and the canvas is not
   * cleared, so it keeps its last picture; f.win still reports it. 0 draws it only when it
   * comes into view, after a resize or layout change and in still frames.
   */
  windowHz?(name: WindowName, tier: Tier): number;
  dispose(): void;
}

/** Deadline handed to an idle callback (requestIdleCallback shape). */
export interface IdleDeadlineLike {
  readonly didTimeout: boolean;
  timeRemaining(): number;
}
export type IdleCallback = (deadline: IdleDeadlineLike) => void;

/**
 * Staged painting (spec 5.6: no long task over 50 ms during scene build). Steps run in idle
 * slices: at least one per slice, more while the slice has time left. Keep each step under
 * about 20 ms. Steps run through the kit's error guard; a step that throws drops the rest of
 * its job. When a job finishes in still mode the kit redraws the still frame.
 */
export interface PaintQueue {
  /** Queues steps under `key`; unrun steps of an earlier job with the same key are dropped. */
  run(key: string, steps: readonly (() => void)[], onDone?: () => void): void;
  /** Drops the unrun steps of one job, or of every job without a key. */
  cancel(key?: string): void;
  /** Steps waiting across all jobs. */
  readonly pending: number;
}

export interface HubBuildContext {
  out: SceneOutput;
  bus: Bus;
  page: PageModel;
  surfaces: Surfaces;
  seed: number;
  now: Date;
  /** 0..1, 0 = new moon. */
  moonPhase: number;
  /** Staged idle painting for statics and offscreen surfaces. */
  paint: PaintQueue;
  /**
   * Extra offset in CSS px for static plane `index` (pointer parallax), composed with its scroll
   * offset in the transform the kit writes after render, so it lands in the same frame.
   * Ignored in still mode.
   */
  shiftStatic(index: number, x: number, y: number): void;
}

export type HubSceneBuild = (ctx: HubBuildContext) => HubSceneHooks;

export type HubSceneHandle = SceneHandle & { redrawStill(): void };

export interface BindOptions {
  /** True when the hub was reached by a soft navigation; the kit skips the intro. */
  softReturn: boolean;
}

/** Minimal media query list the kit needs. */
export interface MediaQueryLike {
  readonly matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

/** Window-like host for listeners, scroll, query string, session storage and document state. */
export interface KitHost {
  addEventListener(type: string, listener: (event: Event) => void, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, listener: (event: Event) => void, options?: boolean | EventListenerOptions): void;
  readonly scrollY: number;
  readonly location: { readonly search: string };
  /** Access may throw; the kit wraps every use in try/catch. */
  readonly sessionStorage: Pick<Storage, "getItem" | "setItem">;
  readonly document: { readonly hidden: boolean; readonly documentElement: { readonly dataset: DOMStringMap } };
}

export interface KitDeps {
  createScene: (options: SceneOptions) => SceneHandle;
  ResizeObserver: new (callback: ResizeObserverCallback) => Pick<ResizeObserver, "observe" | "unobserve" | "disconnect">;
  IntersectionObserver: new (
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) => Pick<IntersectionObserver, "observe" | "unobserve" | "disconnect">;
  now: () => number;
  matchMedia: (query: string) => MediaQueryLike;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
  /** requestIdleCallback with a timeout, or a timer fallback. */
  requestIdle: (callback: IdleCallback) => number;
  cancelIdle: (handle: number) => void;
  surfaceFactory: SurfaceFactory;
  page: PageModel;
  bus: Bus;
  createOutput: (options: OutputOptions) => Output;
  host: KitHost;
  /** Where window.__<bind>Initialized and window.__hubSceneStats live. */
  globals: Record<string, unknown>;
}

export interface HubSceneOptions extends Partial<BindOptions> {
  deps?: Partial<KitDeps>;
  /**
   * False turns off out.card variable writes for this theme while beats keep working: the
   * fallback when the theme fails the 0.3 ms card style-write gate (spec 2.9, 5.6). Default true.
   * ?hubcardwrites=0 turns them off as well, for the A/B measurement.
   */
  cardWrites?: boolean;
}

export interface OutputOptions {
  key: HubThemeKey;
  page: PageModel;
  bus: Bus;
  now?: () => number;
}

export interface HubSceneStats extends GovernorStats {
  key: HubThemeKey;
  windowsMs: number;
  liveSurfaceBytes: number;
  cardWritesMs: number;
  /** False when card writes are off for this theme (HubSceneOptions.cardWrites or ?hubcardwrites=0). */
  cardWrites: boolean;
  /** Backing-store bytes of the live, static and window canvases (width x height x 4). */
  canvasBytes: number;
  /** Longest staged paint step so far, in ms. */
  paintStepMaxMs: number;
}

/* ------------------------------------------------------------------ window globals */

export type BindFn = (options?: BindOptions) => void;
export type CleanupFn = () => void;
export type PreloadFn = () => Promise<unknown> | void;

/**
 * Globals shared across inline scripts, components and modules. Per-theme names:
 * __bind<Bind>: BindFn, __<lowerFirst(bind)>Cleanup: CleanupFn,
 * __<lowerFirst(bind)>Initialized: boolean, __<lowerFirst(bind)>Preload: PreloadFn.
 */
export interface HubGlobals {
  __hubState?: HubState;
  /** Set by the bridge's astro:before-swap handler when it swaps in the hub. */
  __hubSoftArrival?: boolean;
  /** Only with ?hubstats=1. */
  __hubSceneStats?: HubSceneStats;
}

/* ------------------------------------------------------------------ pick (pick-core.ts) */

export type PickReason = "new" | "continue" | "all-read";

export interface PickInput {
  cards: readonly CardInfo[];
  resumeSlug: string | null;
  /** Local date "YYYY-MM-DD". */
  localDay: string;
  profileId: string;
  /** Presses so far in this session (sessionStorage piichan-novels:hub-pick). */
  press: number;
}

export interface PickResult {
  slug: string | null;
  reason: PickReason;
}

/* ------------------------------------------------------------------ calendar (calendar-core.ts) */

export type MeteorShower = "quadrantids" | "lyrids" | "eta-aquariids" | "perseids" | "orionids" | "leonids" | "geminids";
