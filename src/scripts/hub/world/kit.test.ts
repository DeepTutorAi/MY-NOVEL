import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import type { SceneOptions } from "../../_shared/scene-runtime";
import { createBus } from "./bus";
import { isoWeek } from "./calendar-core";
import { fnv1a } from "./geom";
import { FRAME_MIN_MS, collectPlanes, createHubScene, staticDpr, staticOffset, toPlane } from "./kit";
import { buildSnapshot } from "./page-model-core";
import type {
  HubBuildContext,
  HubFrame,
  IdleCallback,
  HubPlanes,
  HubPointer,
  HubSceneHooks,
  HubSceneStats,
  HubState,
  KitDeps,
  MediaQueryLike,
  Output,
  PageModel,
  PageSnapshot,
  SceneEvent,
  Surface,
  Zone,
} from "./types";

/* ------------------------------------------------------------------ fakes */

/** Browser-like: reset() and a backing-store resize restore the identity transform. */
class FakeCtx {
  resets = 0;
  clears = 0;
  transform = [1, 0, 0, 1, 0, 0];
  reset() {
    this.resets++;
    this.transform = [1, 0, 0, 1, 0, 0];
  }
  save() {}
  restore() {}
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.transform = [a, b, c, d, e, f];
  }
  clearRect() {
    this.clears++;
  }
}

type StyleRecord = Record<string, string> & { removeProperty(name: string): void };

function fakeStyle(): StyleRecord {
  const style = { opacity: "", transition: "", transform: "" } as unknown as StyleRecord;
  style.removeProperty = (name: string) => {
    style[name] = "";
  };
  return style;
}

class FakeCanvas {
  private backing = { w: 300, h: 150 };
  style = fakeStyle();
  dataset: Record<string, string> = {};
  ctx = new FakeCtx();
  constructor(public box = { left: 0, top: 0, width: 1440, height: 200 }) {}
  get width() {
    return this.backing.w;
  }
  set width(value: number) {
    this.backing.w = value;
    this.ctx.transform = [1, 0, 0, 1, 0, 0];
  }
  get height() {
    return this.backing.h;
  }
  set height(value: number) {
    this.backing.h = value;
    this.ctx.transform = [1, 0, 0, 1, 0, 0];
  }
  getContext() {
    return this.ctx;
  }
  getBoundingClientRect() {
    const b = this.box;
    return { ...b, x: b.left, y: b.top, right: b.left + b.width, bottom: b.top + b.height };
  }
}

class CountingTarget extends EventTarget {
  count = 0;
  override addEventListener(...args: Parameters<EventTarget["addEventListener"]>) {
    this.count++;
    super.addEventListener(...args);
  }
  override removeEventListener(...args: Parameters<EventTarget["removeEventListener"]>) {
    this.count--;
    super.removeEventListener(...args);
  }
}

class FakeHost {
  listeners = new Map<string, Set<(event: Event) => void>>();
  scrollY = 0;
  location = { search: "" };
  storage = new Map<string, string>();
  sessionStorage = {
    getItem: (k: string) => this.storage.get(k) ?? null,
    setItem: (k: string, v: string) => void this.storage.set(k, v),
  };
  document = { hidden: false, documentElement: { dataset: {} as Record<string, string | undefined> } };
  addEventListener(type: string, fn: (event: Event) => void) {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(fn);
  }
  removeEventListener(type: string, fn: (event: Event) => void) {
    this.listeners.get(type)?.delete(fn);
  }
  dispatch(type: string, event: Partial<PointerEvent> = {}) {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn(event as Event);
  }
  get listenerCount() {
    let n = 0;
    for (const set of this.listeners.values()) n += set.size;
    return n;
  }
}

class FakeMedia implements MediaQueryLike {
  matches = false;
  fns = new Set<() => void>();
  addEventListener(_: "change", fn: () => void) {
    this.fns.add(fn);
  }
  removeEventListener(_: "change", fn: () => void) {
    this.fns.delete(fn);
  }
  set(matches: boolean) {
    this.matches = matches;
    for (const fn of [...this.fns]) fn();
  }
}

const observers: { resize: FakeObserver[]; intersection: FakeObserver[] } = { resize: [], intersection: [] };

class FakeObserver {
  observed = new Set<unknown>();
  disconnected = false;
  constructor(public callback: (entries: never[], observer: never) => void) {}
  observe(el: unknown) {
    this.observed.add(el);
  }
  unobserve(el: unknown) {
    this.observed.delete(el);
  }
  disconnect() {
    this.disconnected = true;
    this.observed.clear();
  }
  fire(entries: unknown[]) {
    this.callback(entries as never[], this as never);
  }
}

class FakeResizeObserver extends FakeObserver {
  constructor(callback: ResizeObserverCallback) {
    super(callback as never);
    observers.resize.push(this);
  }
}

class FakeIntersectionObserver extends FakeObserver {
  constructor(callback: IntersectionObserverCallback) {
    super(callback as never);
    observers.intersection.push(this);
  }
}

function snapshot(dpr = 1): PageSnapshot {
  const zero = { x: 0, y: 0, w: 0, h: 0 };
  return buildSnapshot(
    {
      viewport: { w: 1440, h: 900, coarse: false, dpr },
      shell: { x: 180, y: 0, w: 1080, h: 3000 },
      parts: { title: zero, libraryHead: zero, footer: zero },
      windows: { stage: { x: 180, y: 400, w: 1080, h: 200 }, mid: zero, ground: zero },
      hitFractions: { stage: { x: 0, y: 0, w: 1, h: 1 }, mid: { x: 0, y: 0, w: 1, h: 1 } },
      cards: [],
      holes: [],
      cover: [],
      modalOpen: false,
    },
    1,
  );
}

function fakePage(dpr = 1): PageModel & { zone: Zone; fire(): void } {
  const subscribers = new Set<(s: PageSnapshot) => void>();
  const s = snapshot(dpr);
  const page = {
    zone: "open" as Zone,
    getSnapshot: () => s,
    refresh: () => s,
    subscribe(fn: (s: PageSnapshot) => void) {
      subscribers.add(fn);
      return () => void subscribers.delete(fn);
    },
    zoneAt: () => page.zone,
    cardAt: () => null,
    isCovered: () => false,
    holeDistance: () => Infinity,
    toViewport: (r: { x: number; y: number; w: number; h: number }) => r,
    dispose() {},
    fire() {
      for (const fn of [...subscribers]) fn(s);
    },
  };
  return page;
}

/** Mirrors the limiter: still() freezes live writes until resume(). */
function fakeOutput() {
  const calls = { resume: 0, dispose: 0, card: 0, root: 0, beat: 0, frozen: false, compose: [] as boolean[], announced: [] as string[] };
  const output: Output = {
    root() {
      if (!calls.frozen) calls.root++;
    },
    card() {
      calls.card++;
    },
    heroPoolX() {},
    beat() {
      calls.beat++;
    },
    perch: () => 1,
    unperch() {},
    label() {},
    focusCard() {},
    still() {
      calls.frozen = true;
    },
    resume() {
      calls.resume++;
      calls.frozen = false;
    },
    dispose() {
      calls.dispose++;
    },
    compose(on) {
      calls.compose.push(on);
    },
    announce(text) {
      calls.announced.push(text);
    },
  };
  return { output, calls };
}

interface Rig {
  deps: Partial<KitDeps>;
  host: FakeHost;
  html: Record<string, string | undefined>;
  page: ReturnType<typeof fakePage>;
  bus: ReturnType<typeof createBus>;
  target: CountingTarget;
  media: FakeMedia;
  clock: { t: number };
  raf: { calls: number; pending: FrameRequestCallback[]; flush(): void };
  idle: { cancelled: number; pending: Map<number, IdleCallback>; flush(remainingMs: number): void };
  factory: { created: number; released: number };
  scene: {
    options: SceneOptions | null;
    starts: number;
    stops: number;
    destroyed: boolean;
    running: boolean;
    t: number;
    tick(at: number): void;
    resize(w: number, h: number): void;
  };
  globals: Record<string, unknown>;
  output: ReturnType<typeof fakeOutput>;
  planes: HubPlanes;
  canvases: { live: FakeCanvas; stat: FakeCanvas; stage: FakeCanvas; mid: FakeCanvas; ground: FakeCanvas };
  root: { dataset: Record<string, string> };
  events: { name: string; detail: unknown }[];
}

function rig(dpr = 1): Rig {
  observers.resize = [];
  observers.intersection = [];
  const host = new FakeHost();
  const target = new CountingTarget();
  const state: HubState = {};
  const bus = createBus(target, () => state);
  const events: Rig["events"] = [];
  for (const name of ["hub:scene", "hub:stage"] as const) bus.on(name, (detail) => events.push({ name, detail }));
  const media = new FakeMedia();
  const clock = { t: 10_000 };
  const raf = {
    calls: 0,
    pending: [] as FrameRequestCallback[],
    flush() {
      const run = raf.pending.splice(0);
      for (const fn of run) fn(clock.t);
    },
  };
  let idleId = 0;
  const idle: Rig["idle"] = {
    cancelled: 0,
    pending: new Map(),
    /** Runs every idle callback queued so far with a deadline that has remainingMs left (clock held). */
    flush(remainingMs: number) {
      const run = [...idle.pending.values()];
      idle.pending.clear();
      const end = clock.t + remainingMs;
      for (const fn of run) fn({ didTimeout: false, timeRemaining: () => Math.max(0, end - clock.t) });
    },
  };
  const factory = { created: 0, released: 0 };
  const liveCtx = new FakeCtx();
  const scene: Rig["scene"] = {
    options: null,
    starts: 0,
    stops: 0,
    destroyed: false,
    running: false,
    t: 0,
    tick(at: number) {
      clock.t = at;
      scene.t += 1 / 60;
      scene.options?.render(liveCtx as never, { t: scene.t, dt: 0, width: 1440, height: 900, dpr: 1, pointer: {} as never });
    },
    resize(w: number, h: number) {
      scene.options?.resize({ width: w, height: h, dpr: 1 }, liveCtx as never);
    },
  };
  const canvases = {
    live: new FakeCanvas({ left: 0, top: 0, width: 1440, height: 900 }),
    stat: new FakeCanvas({ left: 0, top: 0, width: 1440, height: 900 }),
    stage: new FakeCanvas({ left: 0, top: 400, width: 1440, height: 200 }),
    mid: new FakeCanvas({ left: 0, top: 1600, width: 1440, height: 220 }),
    ground: new FakeCanvas({ left: 0, top: 2600, width: 1440, height: 300 }),
  };
  const root = { dataset: {} as Record<string, string> };
  const planes = {
    root,
    live: canvases.live,
    statics: [{ canvas: canvases.stat, parallax: 0.2, period: 512 }],
    windows: { stage: canvases.stage, mid: canvases.mid, ground: canvases.ground },
  } as unknown as HubPlanes;
  const globals: Record<string, unknown> = {};
  const output = fakeOutput();
  const page = fakePage(dpr);
  const deps: Partial<KitDeps> = {
    createScene: (options) => {
      scene.options = options;
      options.resize({ width: 1440, height: 900, dpr: 1 }, liveCtx as never);
      return {
        start() {
          scene.starts++;
          scene.running = true;
        },
        stop() {
          scene.stops++;
          scene.running = false;
        },
        destroy() {
          scene.destroyed = true;
          scene.running = false;
        },
      };
    },
    ResizeObserver: FakeResizeObserver,
    IntersectionObserver: FakeIntersectionObserver,
    now: () => clock.t,
    matchMedia: () => media,
    requestAnimationFrame: (fn) => {
      raf.calls++;
      raf.pending.push(fn);
      return raf.calls;
    },
    cancelAnimationFrame: () => {},
    requestIdle: (fn) => {
      idle.pending.set(++idleId, fn);
      return idleId;
    },
    cancelIdle: (handle) => {
      if (idle.pending.delete(handle)) idle.cancelled++;
    },
    surfaceFactory: {
      surface(w: number, h: number): Surface {
        factory.created++;
        return { canvas: { width: w, height: h } as HTMLCanvasElement, g: {} as CanvasRenderingContext2D };
      },
      release(...list: HTMLCanvasElement[]) {
        factory.released += list.length;
        for (const c of list) {
          c.width = 0;
          c.height = 0;
        }
      },
    },
    page,
    bus,
    createOutput: () => output.output,
    host: host as never,
    globals,
  };
  return {
    deps,
    host,
    html: host.document.documentElement.dataset,
    page,
    bus,
    target,
    media,
    clock,
    raf,
    idle,
    factory,
    scene,
    globals,
    output,
    planes,
    canvases,
    root,
    events,
  };
}

interface Counts {
  render: number;
  still: number;
  resize: number;
  layout: number;
  intro: number;
  dispose: number;
  pointers: HubPointer[];
  events: SceneEvent[];
  dts: number[];
  ctx: HubBuildContext | null;
}

function hooks(extra: Partial<HubSceneHooks> = {}): { hooks: HubSceneHooks; counts: Counts } {
  const counts: Counts = { render: 0, still: 0, resize: 0, layout: 0, intro: 0, dispose: 0, pointers: [], events: [], dts: [], ctx: null };
  const h: HubSceneHooks = {
    resize: () => void counts.resize++,
    layout: () => void counts.layout++,
    render: (f) => {
      counts.render++;
      counts.dts.push(f.dt);
    },
    still: () => void counts.still++,
    onPointer: (p) => void counts.pointers.push(p),
    onEvent: (e) => void counts.events.push(e),
    intro: () => void counts.intro++,
    dispose: () => void counts.dispose++,
    ...extra,
  };
  return { hooks: h, counts };
}

function mount(r: Rig, h: HubSceneHooks, softReturn = false, onBuild?: (ctx: HubBuildContext) => void) {
  return createHubScene(
    "firefly",
    r.planes,
    (ctx) => {
      onBuild?.(ctx);
      return h;
    },
    { softReturn, deps: r.deps },
  );
}

const tap = (r: Rig, x = 100, y = 100) => {
  const base = { clientX: x, clientY: y, pointerId: 1, pointerType: "touch", isPrimary: true };
  r.host.dispatch("pointerdown", { ...base, timeStamp: 1000 });
  r.host.dispatch("pointerup", { ...base, timeStamp: 1090 });
};

afterEach(() => {
  mock.timers.reset();
});

/* ------------------------------------------------------------------ tests */

describe("kit: surfaces and teardown", () => {
  it("releases every surface it created after build, three resizes and destroy", () => {
    const r = rig();
    let sky: Surface | null = null;
    let ctx: HubBuildContext | null = null;
    const { hooks: h, counts } = hooks({
      resize: () => {
        if (!ctx) return;
        if (sky) ctx.surfaces.release(sky);
        sky = ctx.surfaces.create(1440, 900);
      },
    });
    const handle = mount(r, h, false, (c) => {
      ctx = c;
      c.surfaces.create(64, 64);
      c.surfaces.create(128, 128);
    });
    r.scene.resize(1280, 800);
    r.scene.resize(390, 844);
    r.scene.resize(1440, 900);
    assert.ok(r.factory.created >= 6);
    assert.ok(ctx);
    const built = ctx as HubBuildContext;
    assert.ok(built.surfaces.liveBytes > 0);
    handle.destroy();
    assert.equal(r.factory.created, r.factory.released);
    assert.equal(built.surfaces.created, built.surfaces.released);
    assert.equal(built.surfaces.liveBytes, 0);
    assert.equal(counts.dispose, 1);
    assert.equal(r.output.calls.dispose, 1);
    assert.ok(r.scene.destroyed);
    assert.equal(r.host.listenerCount, 0, "window listeners removed");
    assert.equal(r.target.count, 2, "only the rig's own bus listeners remain");
    assert.ok(observers.resize.every((o) => o.disconnected));
    assert.ok(observers.intersection.every((o) => o.disconnected));
    assert.equal(r.globals.__fireflyBgInitialized, false);
  });

  it("zeroes the live and static sky canvases on destroy and keeps the shared window stores", () => {
    const r = rig();
    const handle = mount(r, hooks().hooks);
    r.scene.tick(20_000);
    const stageWidth = r.canvases.stage.width;
    handle.destroy();
    for (const c of [r.canvases.live, r.canvases.stat]) {
      assert.equal(c.width, 0);
      assert.equal(c.height, 0);
    }
    assert.equal(r.canvases.stage.width, stageWidth, "the next theme reuses the window backing store");
  });

  it("reads every layout box at bind before it resizes any canvas (one forced layout)", () => {
    const r = rig(2);
    const log: string[] = [];
    for (const [name, c] of Object.entries(r.canvases)) {
      const read = c.getBoundingClientRect.bind(c);
      c.getBoundingClientRect = () => {
        log.push(`read ${name}`);
        return read();
      };
      const proto = Object.getPrototypeOf(c) as FakeCanvas;
      const width = Object.getOwnPropertyDescriptor(proto, "width");
      Object.defineProperty(c, "width", {
        get: () => width?.get?.call(c),
        set: (v: number) => {
          log.push(`write ${name}`);
          width?.set?.call(c, v);
        },
      });
    }
    const createScene = r.deps.createScene;
    r.deps.createScene = (options) => {
      log.push("read container");
      return createScene!(options);
    };
    mount(r, hooks().hooks);
    const firstWrite = log.findIndex((entry) => entry.startsWith("write"));
    assert.ok(firstWrite > 0, log.join(", "));
    assert.equal(log.slice(firstWrite).filter((entry) => entry.startsWith("read")).length, 0, log.join(", "));
    assert.ok(log.includes("read container") && log.includes("write stage"));
  });

  it("resets every window canvas on mount and on destroy", () => {
    const r = rig();
    const handle = mount(r, hooks().hooks);
    for (const c of [r.canvases.stage, r.canvases.mid, r.canvases.ground]) assert.equal(c.ctx.resets, 1);
    r.scene.tick(20_000);
    handle.destroy();
    for (const c of [r.canvases.stage, r.canvases.mid, r.canvases.ground]) assert.equal(c.ctx.resets, 2);
    assert.equal(r.canvases.live.style.opacity, "", "inline reveal removed");
  });

  it("keeps the DPR transform on the shared window canvases when a second kit mounts", () => {
    const r = rig(2);
    const first = mount(r, hooks().hooks);
    for (const c of [r.canvases.stage, r.canvases.mid, r.canvases.ground]) {
      assert.deepEqual(c.ctx.transform.slice(0, 4), [1.5, 0, 0, 1.5], "capped DPR on the first mount");
    }
    first.destroy();
    mount(r, hooks().hooks);
    assert.equal(r.canvases.stage.width, 2160, "backing store already sized by the first mount");
    for (const c of [r.canvases.stage, r.canvases.mid, r.canvases.ground]) {
      assert.deepEqual(c.ctx.transform.slice(0, 4), [1.5, 0, 0, 1.5], "capped DPR on the second mount");
    }
    r.page.fire();
    assert.deepEqual(r.canvases.mid.ctx.transform.slice(0, 4), [1.5, 0, 0, 1.5], "kept on a layout change");
  });

  it("names the Initialized global after the bind key", () => {
    const r = rig();
    mount(r, hooks().hooks);
    assert.equal(r.globals.__fireflyBgInitialized, true);
  });
});

describe("kit: loop and frame cap", () => {
  it("starts the loop on mount and draws at most one frame per 15 ms with its own dt", () => {
    const r = rig();
    const { hooks: h, counts } = hooks();
    mount(r, h);
    assert.equal(r.scene.starts, 1);
    for (const at of [20_000, 20_010, 20_016, 20_020, 20_031, 20_032, 20_047]) r.scene.tick(at);
    assert.equal(counts.render, 4);
    assert.deepEqual(
      counts.dts.map((d) => Math.round(d * 1000)),
      [0, 16, 15, 16],
    );
    assert.ok(FRAME_MIN_MS === 15);
  });

  it("emits hub:scene ready after the first drawn frame and reveals the canvases", () => {
    const r = rig();
    mount(r, hooks().hooks);
    assert.equal(r.events.length, 0);
    r.scene.tick(20_000);
    assert.deepEqual(r.events, [{ name: "hub:scene", detail: { key: "firefly", status: "ready" } }]);
    assert.equal(r.canvases.live.style.opacity, "1");
    assert.equal(r.canvases.stage.style.opacity, "1");
    assert.equal(r.canvases.live.style.transition, "", "a normal reveal keeps the CSS fade");
  });

  it("moves statics by parallax modulo their period", () => {
    const r = rig();
    mount(r, hooks().hooks);
    r.host.scrollY = 3000;
    r.host.dispatch("scroll");
    r.scene.tick(20_000);
    assert.equal(r.canvases.stat.style.transform, "translate3d(0, -88px, 0)");
  });

  it("publishes stats only with ?hubstats=1", () => {
    const r = rig();
    r.host.location.search = "?hubstats=1";
    mount(r, hooks().hooks);
    for (let i = 0; i < 30; i++) r.scene.tick(20_000 + i * 17);
    const stats = r.globals.__hubSceneStats as HubSceneStats;
    assert.equal(stats.key, "firefly");
    assert.equal(stats.frames, 30);
    assert.equal(stats.cardWrites, true);
    const quiet = rig();
    mount(quiet, hooks().hooks);
    for (let i = 0; i < 30; i++) quiet.scene.tick(20_000 + i * 17);
    assert.equal(quiet.globals.__hubSceneStats, undefined);
  });

  it("publishes a final stats object with an empty surface ledger on destroy", () => {
    const r = rig();
    r.host.location.search = "?hubstats=1";
    const handle = mount(r, hooks().hooks, false, (c) => {
      c.surfaces.create(64, 64);
    });
    for (let i = 0; i < 30; i++) r.scene.tick(20_000 + i * 17);
    assert.ok((r.globals.__hubSceneStats as HubSceneStats).liveSurfaceBytes > 0);
    handle.destroy();
    const final = r.globals.__hubSceneStats as HubSceneStats;
    assert.equal(final.key, "firefly");
    assert.equal(final.liveSurfaceBytes, 0);
  });

  it("drops card writes with ?hubcardwrites=0", () => {
    const r = rig();
    r.host.location.search = "?hubcardwrites=0";
    let out: Output | null = null;
    mount(r, hooks().hooks, false, (c) => (out = c.out));
    (out as unknown as Output).card("a", { "w-glow": 1 });
    assert.equal(r.output.calls.card, 0);
  });
});

describe("kit: pointer zones and taps", () => {
  it("routes a tap while paused: onPointer gets tap:true and no rAF is scheduled", () => {
    const r = rig();
    r.html.hubMotion = "still";
    const { hooks: h, counts } = hooks();
    mount(r, h);
    const stillsBefore = counts.still;
    tap(r);
    const last = counts.pointers.at(-1);
    assert.equal(last?.tap, true);
    assert.equal(last?.zone, "open");
    assert.equal(r.scene.starts, 0, "the loop never started");
    assert.equal(r.raf.calls, 0, "no rAF scheduled");
    assert.equal(counts.still, stillsBefore + 1, "the tap redraws the still frame");
  });

  it("never turns a press on a card, the UI or under a dialog into a tap", () => {
    for (const zone of ["card", "ui"] as Zone[]) {
      const r = rig();
      const { hooks: h, counts } = hooks();
      mount(r, h);
      r.page.zone = zone;
      tap(r);
      assert.equal(counts.pointers.at(-1)?.tap, false, zone);
      assert.equal(counts.pointers.at(-1)?.zone, zone);
    }
    const r = rig();
    const { hooks: h, counts } = hooks();
    mount(r, h);
    r.bus.emit("hub:modal", { open: true });
    tap(r);
    assert.equal(counts.pointers.at(-1)?.zone, "modal");
    assert.equal(counts.pointers.at(-1)?.tap, false);
  });

  it("reports a still press of 180 ms with little movement", () => {
    const r = rig();
    const { hooks: h, counts } = hooks();
    mount(r, h);
    const base = { clientX: 50, clientY: 60, pointerId: 3, pointerType: "touch", isPrimary: true };
    r.host.dispatch("pointerdown", { ...base, timeStamp: 1000 });
    r.host.dispatch("pointerup", { ...base, clientX: 55, timeStamp: 1200 });
    assert.equal(counts.pointers.at(-1)?.press, true);
  });

  it("turns a horizontal drag in the stage into hub:stage left or right", () => {
    const r = rig();
    const { hooks: h, counts } = hooks();
    mount(r, h);
    r.page.zone = "stage";
    const base = { pointerId: 2, pointerType: "touch", isPrimary: true };
    r.host.dispatch("pointerdown", { ...base, clientX: 300, clientY: 500, timeStamp: 1000 });
    r.host.dispatch("pointermove", { ...base, clientX: 260, clientY: 505, timeStamp: 1050 });
    r.host.dispatch("pointermove", { ...base, clientX: 200, clientY: 505, timeStamp: 1080 });
    r.host.dispatch("pointerup", { ...base, clientX: 200, clientY: 505, timeStamp: 1100 });
    assert.deepEqual(
      r.events.filter((e) => e.name === "hub:stage"),
      [{ name: "hub:stage", detail: { window: "stage", action: "left", x: 260, y: 505 } }],
    );
    assert.ok(counts.events.some((e) => e.name === "hub:stage"), "the scene hears it");
    assert.equal(counts.pointers.at(-1)?.tap, false, "a drag is not a tap");
  });

  it("turns a horizontal drag that starts on the stage hit button into hub:stage, without the button's click", () => {
    const r = rig();
    const { hooks: h, counts } = hooks();
    mount(r, h);
    r.page.zone = "ui"; // the hit rect is a page hole
    const hit = { closest: (selector: string) => (selector.includes('data-hub-hit="stage"') ? {} : null) };
    const base = { pointerId: 4, pointerType: "mouse", isPrimary: true, target: hit as unknown as EventTarget };
    r.host.dispatch("pointerdown", { ...base, clientX: 300, clientY: 500, timeStamp: 1000 });
    r.host.dispatch("pointermove", { ...base, clientX: 330, clientY: 503, timeStamp: 1040 });
    r.host.dispatch("pointerup", { ...base, clientX: 340, clientY: 503, timeStamp: 1080 });
    assert.deepEqual(
      r.events.filter((e) => e.name === "hub:stage"),
      [{ name: "hub:stage", detail: { window: "stage", action: "right", x: 330, y: 503 } }],
    );
    assert.equal(counts.pointers.at(-1)?.tap, false);
    let stopped = 0;
    const click = (detail: number) => ({
      detail,
      target: hit,
      stopImmediatePropagation: () => void stopped++,
      preventDefault() {},
    });
    r.host.dispatch("click", click(1) as never);
    assert.equal(stopped, 1, "the click after the swipe never reaches the button");
    r.host.dispatch("click", click(1) as never);
    assert.equal(stopped, 1, "only that one click");

    // A plain click on the button still taps it, and a horizontal drag elsewhere in the UI is not a swipe.
    r.host.dispatch("pointerdown", { ...base, clientX: 300, clientY: 500, timeStamp: 2000 });
    r.host.dispatch("pointerup", { ...base, clientX: 301, clientY: 500, timeStamp: 2060 });
    r.host.dispatch("click", click(1) as never);
    assert.equal(stopped, 1);
    const ui = { ...base, target: { closest: () => null } as unknown as EventTarget };
    r.host.dispatch("pointerdown", { ...ui, clientX: 300, clientY: 500, timeStamp: 3000 });
    r.host.dispatch("pointermove", { ...ui, clientX: 360, clientY: 500, timeStamp: 3040 });
    r.host.dispatch("pointerup", { ...ui, clientX: 360, clientY: 500, timeStamp: 3080 });
    assert.equal(r.events.filter((e) => e.name === "hub:stage").length, 1);
  });

  it("never reads host.scrollY in a frame or a pointer event, only on scroll", () => {
    const r = rig();
    let reads = 0;
    let y = 120;
    Object.defineProperty(r.host, "scrollY", {
      get: () => {
        reads++;
        return y;
      },
    });
    const seen: number[] = [];
    mount(r, hooks({ render: (f) => void seen.push(f.scrollY) }).hooks);
    reads = 0;
    for (let i = 0; i < 5; i++) r.scene.tick(20_000 + i * 17);
    r.host.dispatch("pointermove", { clientX: 10, clientY: 10, pointerId: 1, pointerType: "mouse", isPrimary: true });
    assert.equal(reads, 0, "a scrollY read forces a style update after root writes");
    y = 480;
    r.host.dispatch("scroll");
    assert.equal(reads, 1);
    r.scene.tick(21_000);
    assert.deepEqual([seen[0], seen.at(-1)], [120, 480]);
  });

  it("re-evaluates the zone on scroll for the last pointer position", () => {
    const r = rig();
    const { hooks: h, counts } = hooks();
    mount(r, h);
    r.host.dispatch("pointermove", { clientX: 10, clientY: 10, pointerId: 1, pointerType: "mouse", isPrimary: true });
    const before = counts.pointers.length;
    r.page.zone = "card";
    r.host.dispatch("scroll");
    assert.equal(counts.pointers.length, before + 1);
    assert.equal(counts.pointers.at(-1)?.zone, "card");
  });
});

describe("kit: still path", () => {
  it("redraws the still frame on every trigger", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    const r = rig();
    r.html.hubMotion = "still";
    const { hooks: h, counts } = hooks();
    const handle = mount(r, h);
    assert.equal(counts.still, 1, "on mount");
    assert.deepEqual(r.events.at(-1), { name: "hub:scene", detail: { key: "firefly", status: "still" } });
    assert.equal(r.canvases.live.style.transition, "none", "still reveals at once");
    r.scene.resize(1280, 800);
    assert.equal(counts.still, 2, "on resize");
    r.page.fire();
    assert.equal(counts.still, 3, "on hub:layout");
    r.bus.emit("hub:reading", {});
    assert.equal(counts.still, 4, "on hub:reading");
    r.host.dispatch("scroll");
    mock.timers.tick(149);
    assert.equal(counts.still, 4);
    mock.timers.tick(1);
    assert.equal(counts.still, 5, "after scroll settles");
    observers.intersection[0].fire([{ target: r.canvases.mid, isIntersecting: true }]);
    assert.equal(counts.still, 6, "when a window enters view");
    r.bus.emit("hub:attention", { slug: "a", kind: "open", source: "focus" });
    assert.equal(counts.still, 7, "after a handled event");
    handle.redrawStill();
    assert.equal(counts.still, 8, "redrawStill()");
    assert.equal(counts.render, 0);
    assert.equal(r.scene.starts, 0);
  });

  it("brackets each composed still frame with out.compose so it may perch, and forwards announce", () => {
    const r = rig();
    r.html.hubMotion = "still";
    let ctx: HubBuildContext | null = null;
    let during: boolean[] = [];
    const { hooks: h } = hooks({ still: () => void (during = [...r.output.calls.compose]) });
    mount(r, h, false, (c) => {
      ctx = c;
    });
    assert.deepEqual(during, [true], "open while the still hook runs");
    assert.deepEqual(r.output.calls.compose, [true, false]);
    (ctx as HubBuildContext | null)?.out.announce("หิ่งห้อยกะพริบพร้อมกันแล้ว");
    assert.deepEqual(r.output.calls.announced, ["หิ่งห้อยกะพริบพร้อมกันแล้ว"]);
  });

  it("follows hub:motion and the reduced-motion query both ways", () => {
    const r = rig();
    const { hooks: h, counts } = hooks();
    mount(r, h);
    assert.equal(r.scene.starts, 1);
    r.html.hubMotion = "still";
    r.bus.emit("hub:motion", { still: true });
    assert.equal(r.scene.running, false);
    assert.equal(counts.still, 1);
    r.html.hubMotion = "full";
    r.bus.emit("hub:motion", { still: false });
    assert.equal(r.scene.running, true);
    assert.equal(r.output.calls.resume, 2, "every start releases the output");
    assert.equal(r.output.calls.frozen, false);
    r.media.set(true);
    assert.equal(r.scene.running, false);
    assert.equal(counts.still, 2);
  });
});

describe("kit: modal pause", () => {
  it("keeps drawing for modalSettleMs after a dialog opens, then stops; resumes on close", () => {
    const r = rig();
    const { hooks: h, counts } = hooks({ modalSettleMs: 100 });
    mount(r, h);
    r.scene.tick(20_000);
    r.bus.emit("hub:modal", { open: true });
    assert.equal(r.scene.stops, 0);
    r.scene.tick(r.clock.t + 50);
    assert.equal(counts.render, 2);
    assert.equal(r.scene.stops, 0);
    r.scene.tick(r.clock.t + 70);
    assert.equal(r.scene.stops, 1);
    assert.equal(r.scene.running, false);
    r.bus.emit("hub:modal", { open: false });
    assert.equal(r.scene.running, true);
    assert.equal(r.scene.starts, 2);
  });

  it("stops at once when there is no settle time", () => {
    const r = rig();
    mount(r, hooks().hooks);
    r.bus.emit("hub:modal", { open: true });
    assert.equal(r.scene.running, false);
  });

  it("ignores the picker sheet", () => {
    const r = rig();
    const { hooks: h, counts } = hooks();
    mount(r, h);
    r.bus.emit("hub:modal", { open: true, kind: "picker" });
    assert.equal(r.scene.stops, 0);
    r.scene.tick(20_000);
    assert.equal(counts.render, 1);
    r.bus.emit("hub:modal", { open: false, kind: "picker" });
    assert.equal(r.scene.running, true);
  });

  it("draws one still frame when it mounts under an open dialog", () => {
    const r = rig();
    r.bus.emit("hub:modal", { open: true });
    const { hooks: h, counts } = hooks();
    mount(r, h);
    assert.equal(counts.still, 1);
    assert.equal(r.scene.starts, 0);
    r.bus.emit("hub:modal", { open: false });
    assert.equal(r.scene.starts, 1);
  });

  it("keeps the last frame under a dialog and releases the output on close", () => {
    const r = rig();
    let out: Output | null = null;
    const { hooks: h, counts } = hooks({
      render: (f) => {
        counts.render++;
        counts.dts.push(f.dt);
        out?.root({ "w-light": 0.5 });
      },
      still: () => {
        counts.still++;
        out?.still({ "w-light": 0.5 }, {});
      },
    });
    mount(r, h, false, (ctx) => {
      out = ctx.out;
    });
    r.host.scrollY = 1000;
    r.host.dispatch("scroll");
    r.scene.tick(20_000);
    const transform = r.canvases.stat.style.transform;
    r.bus.emit("hub:modal", { open: true });
    r.page.fire();
    assert.equal(counts.still, 0, "the dialog's own layout change keeps the last frame");
    assert.equal(counts.render, 1);
    assert.equal(r.canvases.stat.style.transform, transform, "statics stay at the scroll offset");
    r.canvases.stage.box = { ...r.canvases.stage.box, width: 1280 };
    observers.resize[0].fire([]);
    assert.equal(counts.still, 0, "a cleared window is redrawn without the still composition");
    assert.equal(counts.render, 2);
    assert.equal(counts.dts.at(-1), 0, "time is held");
    assert.equal(r.canvases.stat.style.transform, transform);
    assert.equal(r.scene.running, false);
    r.bus.emit("hub:modal", { open: false });
    const landed = r.output.calls.root;
    r.scene.tick(21_000);
    assert.equal(r.output.calls.root, landed + 1, "live writes land after the dialog closes");
  });

  it("releases the output when a dialog closes after a mount under it", () => {
    const r = rig();
    r.bus.emit("hub:modal", { open: true });
    let out: Output | null = null;
    const { hooks: h } = hooks({
      render: () => out?.root({ "w-light": 0.5 }),
      still: () => out?.still({ "w-light": 0.5 }, {}),
    });
    mount(r, h, false, (ctx) => {
      out = ctx.out;
    });
    assert.equal(r.output.calls.frozen, true, "the mount drew the composed still frame");
    r.bus.emit("hub:modal", { open: false });
    r.scene.tick(20_000);
    assert.equal(r.output.calls.root, 1);
  });
});

describe("kit: picker switch", () => {
  it("draws one still frame at once while html[data-hub-switch] is set, then starts after it clears", () => {
    const r = rig();
    r.html.hubSwitch = "firefly";
    const { hooks: h, counts } = hooks();
    mount(r, h);
    assert.equal(counts.still, 1);
    for (const c of Object.values(r.canvases)) {
      assert.equal(c.style.opacity, "1");
      assert.equal(c.style.transition, "none");
    }
    assert.equal(r.scene.starts, 0);
    r.raf.flush();
    assert.equal(r.scene.starts, 0, "still switching");
    delete r.html.hubSwitch;
    r.raf.flush();
    assert.equal(r.scene.starts, 1);
  });

  it("releases the output after the switch and keeps statics at the scroll offset", () => {
    const r = rig();
    r.html.hubSwitch = "firefly";
    r.host.scrollY = 1000;
    r.host.dispatch("scroll");
    let out: Output | null = null;
    const { hooks: h } = hooks({
      render: () => out?.root({ "w-light": 0.5 }),
      still: () => out?.still({ "w-light": 0.5 }, {}),
    });
    mount(r, h, false, (ctx) => {
      out = ctx.out;
    });
    const snapshotTransform = r.canvases.stat.style.transform;
    assert.equal(snapshotTransform, "translate3d(0, -200px, 0)");
    delete r.html.hubSwitch;
    r.raf.flush();
    r.scene.tick(20_000);
    assert.equal(r.output.calls.root, 1, "live writes land after the switch");
    assert.equal(r.canvases.stat.style.transform, snapshotTransform, "no jump when the loop starts");
  });
});

describe("kit: error isolation", () => {
  it("fails a scene whose build throws, and releases what it made", () => {
    const r = rig();
    const quiet = mock.method(console, "error", () => {});
    const handle = createHubScene(
      "firefly",
      r.planes,
      (ctx) => {
        ctx.surfaces.create(32, 32);
        throw new Error("build");
      },
      { deps: r.deps },
    );
    quiet.mock.restore();
    assert.deepEqual(r.events, [{ name: "hub:scene", detail: { key: "firefly", status: "failed" } }]);
    assert.equal(r.factory.created, 1);
    assert.equal(r.factory.released, 1);
    assert.equal(r.globals.__fireflyBgInitialized, false);
    assert.equal(r.root.dataset.sceneFailed, "");
    assert.equal(r.scene.options, null, "createScene never ran");
    handle.destroy();
    handle.start();
  });

  it("fails on a throw in the first render", () => {
    const r = rig();
    const quiet = mock.method(console, "error", () => {});
    mount(
      r,
      hooks({
        render: () => {
          throw new Error("render");
        },
      }).hooks,
    );
    r.scene.tick(20_000);
    quiet.mock.restore();
    assert.equal((r.events.at(-1)?.detail as { status: string }).status, "failed");
    assert.ok(r.scene.destroyed);
  });

  it("survives isolated later throws and fails after three in a row", () => {
    const r = rig();
    const quiet = mock.method(console, "error", () => {});
    let mode: "ok" | "throw" = "ok";
    mount(
      r,
      hooks({
        render: () => {
          if (mode === "throw") throw new Error("later");
        },
      }).hooks,
    );
    let t = 20_000;
    const tick = () => r.scene.tick((t += 17));
    tick();
    mode = "throw";
    tick();
    tick();
    mode = "ok";
    tick();
    assert.ok(!r.scene.destroyed, "two throws then a good frame");
    mode = "throw";
    tick();
    tick();
    assert.ok(!r.scene.destroyed);
    tick();
    quiet.mock.restore();
    assert.ok(r.scene.destroyed);
    assert.equal((r.events.at(-1)?.detail as { status: string }).status, "failed");
  });
});

describe("kit: intro and seed", () => {
  it("plays the intro once per session, never on a soft return or when still", () => {
    const r = rig();
    const first = hooks();
    mount(r, first.hooks).destroy();
    assert.equal(first.counts.intro, 1);
    const again = hooks();
    mount(r, again.hooks);
    assert.equal(again.counts.intro, 0, "already seen this session");

    const soft = rig();
    const s = hooks();
    mount(soft, s.hooks, true);
    assert.equal(s.counts.intro, 0);

    const still = rig();
    still.html.hubMotion = "still";
    const st = hooks();
    mount(still, st.hooks);
    assert.equal(st.counts.intro, 0);
  });

  it("seeds from the key and ISO week, or from ?seed=", () => {
    const r = rig();
    let seed = -1;
    mount(r, hooks().hooks, false, (ctx) => (seed = ctx.seed));
    assert.equal(seed, fnv1a(`firefly:${isoWeek(new Date())}`));
    const fixed = rig();
    fixed.host.location.search = "?seed=42";
    mount(fixed, hooks().hooks, false, (ctx) => {
      seed = ctx.seed;
      assert.ok(ctx.moonPhase >= 0 && ctx.moonPhase < 1);
    });
    assert.equal(seed, 42);
  });
});

describe("kit: planes", () => {
  it("converts points between the sky and window planes", () => {
    const win = { stage: { x: 0, y: 300, w: 1440, h: 200 }, mid: null, ground: { x: 0, y: 700, w: 1440, h: 300 } };
    assert.deepEqual(toPlane(win, "stage", "sky", 10, 20), { x: 10, y: 320 });
    assert.deepEqual(toPlane(win, "sky", "ground", 10, 720), { x: 10, y: 20 });
    assert.deepEqual(toPlane(win, "stage", "ground", 5, 5), { x: 5, y: -395 });
    assert.deepEqual(toPlane(win, "mid", "mid", 1, 2), { x: 1, y: 2 });
    assert.equal(toPlane(win, "mid", "sky", 1, 2), null);
  });

  it("collects the sky and window canvases, or null when one is missing", () => {
    const make = (missing?: string) => {
      const canvases: Record<string, object> = { live: {}, s1: {}, s2: {}, stage: {}, mid: {}, ground: {} };
      if (missing) delete canvases[missing];
      const doc = {
        querySelector: (sel: string) => canvases[/"(\w+)"/.exec(sel)?.[1] ?? ""] ?? null,
      };
      return {
        canvases,
        root: {
          ownerDocument: doc,
          querySelector: () => canvases.live ?? null,
          querySelectorAll: () => [canvases.s1, canvases.s2].filter(Boolean),
        } as unknown as HTMLElement,
      };
    };
    const { root, canvases } = make();
    const planes = collectPlanes(root, [{ parallax: 0.1, period: 400 }, { parallax: 0.3 }]);
    assert.ok(planes);
    assert.equal(planes.live, canvases.live);
    assert.deepEqual(
      planes.statics.map((p) => [p.parallax, p.period]),
      [
        [0.1, 400],
        [0.3, undefined],
      ],
    );
    assert.equal(planes.windows.ground, canvases.ground);
    assert.equal(collectPlanes(make("mid").root), null);
    assert.equal(collectPlanes(make("live").root), null);
    assert.equal(collectPlanes(make("s2").root, [{ parallax: 0 }, { parallax: 0 }]), null);
  });
});

describe("kit: pointer leaving the window", () => {
  it("clears pointer.active when the mouse leaves through the window edge", () => {
    const r = rig();
    const seen: boolean[] = [];
    const { hooks: h, counts } = hooks({ render: (f) => void seen.push(f.pointer.active) });
    mount(r, h);
    r.host.dispatch("pointermove", { clientX: 700, clientY: 10, pointerId: 1, pointerType: "mouse", isPrimary: true });
    assert.equal(counts.pointers.at(-1)?.active, true);
    r.host.dispatch("pointerout", { clientX: 700, clientY: -1, pointerId: 1, pointerType: "mouse", isPrimary: true, relatedTarget: null });
    r.scene.tick(20_000);
    assert.equal(seen.at(-1), false, "the frame's pointer is inactive");
    assert.equal(counts.pointers.at(-1)?.active, false, "onPointer hears the leave");
    const before = counts.pointers.length;
    r.page.zone = "card";
    r.host.dispatch("scroll");
    assert.equal(counts.pointers.length, before, "no zone re-evaluation for a pointer that left");
  });

  it("ignores pointerout between elements and from touch", () => {
    const r = rig();
    const { hooks: h, counts } = hooks();
    mount(r, h);
    r.host.dispatch("pointermove", { clientX: 700, clientY: 10, pointerId: 1, pointerType: "mouse", isPrimary: true });
    r.host.dispatch("pointerout", { clientX: 700, clientY: 12, pointerId: 1, pointerType: "mouse", isPrimary: true, relatedTarget: {} as EventTarget });
    r.host.dispatch("pointerout", { clientX: 700, clientY: 12, pointerId: 2, pointerType: "touch", isPrimary: true, relatedTarget: null });
    assert.equal(counts.pointers.at(-1)?.active, true);
  });
});

describe("kit: card-write switch (5.6 gate)", () => {
  it("drops card writes when the theme turns them off, and keeps beats", () => {
    const r = rig();
    r.host.location.search = "?hubstats=1";
    let out: Output | null = null;
    createHubScene(
      "firefly",
      r.planes,
      (ctx) => {
        out = ctx.out;
        return hooks().hooks;
      },
      { deps: r.deps, cardWrites: false },
    );
    const o = out as unknown as Output;
    o.card("a", { "w-glow": 1 });
    o.beat("a", "wave");
    assert.equal(r.output.calls.card, 0);
    assert.equal(r.output.calls.beat, 1);
    for (let i = 0; i < 30; i++) r.scene.tick(20_000 + i * 17);
    assert.equal((r.globals.__hubSceneStats as HubSceneStats).cardWrites, false);
  });
});

describe("kit: staged painting", () => {
  it("runs steps in idle slices, one per slice when the slice has no time left", () => {
    const r = rig();
    let ctx: HubBuildContext | null = null;
    mount(r, hooks().hooks, false, (c) => (ctx = c));
    const paint = (ctx as unknown as HubBuildContext).paint;
    const ran: string[] = [];
    paint.run("sky", [() => ran.push("a"), () => ran.push("b"), () => ran.push("c")]);
    assert.deepEqual(ran, [], "nothing runs synchronously");
    assert.equal(paint.pending, 3);
    r.idle.flush(0);
    assert.deepEqual(ran, ["a"]);
    r.idle.flush(50);
    assert.deepEqual(ran, ["a", "b", "c"], "a slice with time runs several steps");
    assert.equal(paint.pending, 0);
  });

  it("replaces the unrun steps of a job with the same key and keeps other keys", () => {
    const r = rig();
    let ctx: HubBuildContext | null = null;
    mount(r, hooks().hooks, false, (c) => (ctx = c));
    const paint = (ctx as unknown as HubBuildContext).paint;
    const ran: string[] = [];
    const done: string[] = [];
    paint.run("sky", [() => ran.push("sky1"), () => ran.push("sky2")], () => done.push("old sky"));
    paint.run("mid", [() => ran.push("mid1")], () => done.push("mid"));
    r.idle.flush(0);
    paint.run("sky", [() => ran.push("sky-new")], () => done.push("new sky"));
    r.idle.flush(50);
    assert.deepEqual(ran, ["sky1", "mid1", "sky-new"]);
    assert.deepEqual(done, ["mid", "new sky"]);
    paint.run("sky", [() => ran.push("never")]);
    paint.cancel("sky");
    r.idle.flush(50);
    assert.equal(ran.at(-1), "sky-new");
  });

  it("redraws the still frame when a job finishes in still mode", () => {
    const r = rig();
    r.html.hubMotion = "still";
    const { hooks: h, counts } = hooks();
    let ctx: HubBuildContext | null = null;
    mount(r, h, false, (c) => (ctx = c));
    const before = counts.still;
    (ctx as unknown as HubBuildContext).paint.run("sky", [() => undefined, () => undefined]);
    r.idle.flush(0);
    assert.equal(counts.still, before, "not before the job is done");
    r.idle.flush(0);
    assert.equal(counts.still, before + 1);
  });

  it("drops the rest of a job whose step throws, reports the longest step and cancels on destroy", () => {
    const r = rig();
    r.host.location.search = "?hubstats=1";
    let ctx: HubBuildContext | null = null;
    const handle = mount(r, hooks().hooks, false, (c) => (ctx = c));
    r.scene.tick(20_000);
    const paint = (ctx as unknown as HubBuildContext).paint;
    const ran: string[] = [];
    const quiet = mock.method(console, "error", () => undefined);
    paint.run("a", [
      () => {
        r.clock.t += 30;
        ran.push("slow");
      },
      () => {
        throw new Error("broken step");
      },
      () => ran.push("after"),
    ]);
    r.idle.flush(100);
    quiet.mock.restore();
    assert.deepEqual(ran, ["slow"]);
    assert.equal(r.root.dataset.sceneFailed, undefined, "one throw after the first frame does not fail the scene");
    for (let i = 1; i <= 30; i++) r.scene.tick(r.clock.t + 17);
    assert.equal((r.globals.__hubSceneStats as HubSceneStats).paintStepMaxMs, 30);
    paint.run("b", [() => ran.push("late")]);
    handle.destroy();
    r.idle.flush(50);
    assert.deepEqual(ran, ["slow"], "nothing runs after destroy");
    assert.ok(r.idle.cancelled >= 1);
  });
});

describe("kit: window redraw rate", () => {
  it("passes a window context only when its rate is due and leaves the canvas uncleared otherwise", () => {
    const r = rig();
    const drawn: number[] = [];
    let frameNo = 0;
    const { hooks: h } = hooks({
      windowHz: (name) => (name === "stage" ? 30 : Number.POSITIVE_INFINITY),
      render: (f: HubFrame, g) => {
        frameNo++;
        assert.ok(f.win.stage, "the window stays visible in the frame");
        if (g.stage) drawn.push(frameNo);
      },
    });
    mount(r, h);
    const clears = r.canvases.stage.ctx.clears;
    for (let i = 0; i < 12; i++) r.scene.tick(20_000 + i * (1000 / 60));
    assert.deepEqual(drawn, [1, 3, 5, 7, 9, 11]);
    assert.equal(r.canvases.stage.ctx.clears - clears, 6, "cleared only on frames it is drawn");
  });

  it("draws a 0 Hz window once, then again only after a layout change", () => {
    const r = rig();
    const drawn: number[] = [];
    let frameNo = 0;
    const { hooks: h } = hooks({
      windowHz: () => 0,
      render: (_f, g) => {
        frameNo++;
        if (g.stage) drawn.push(frameNo);
      },
    });
    mount(r, h);
    for (let i = 0; i < 4; i++) r.scene.tick(20_000 + i * 17);
    r.page.fire();
    for (let i = 4; i < 8; i++) r.scene.tick(20_000 + i * 17);
    assert.deepEqual(drawn, [1, 5]);
  });
});

describe("kit: static planes", () => {
  it("reports each plane's scroll offset in the frame and composes a scene shift into its transform", () => {
    const r = rig();
    const offsets: number[][] = [];
    let ctx: HubBuildContext | null = null;
    const { hooks: h } = hooks({
      render: (f) => {
        offsets.push([...f.staticY]);
        ctx?.shiftStatic(0, 3, -2);
      },
    });
    mount(r, h, false, (c) => (ctx = c));
    r.host.scrollY = 3000;
    r.host.dispatch("scroll");
    r.scene.tick(20_000);
    assert.deepEqual(offsets.at(-1), [88]);
    assert.equal(r.canvases.stat.style.transform, "translate3d(3px, -90px, 0)", "the shift lands in the same frame");
  });

  it("drops the shift and the parallax in still mode", () => {
    const r = rig();
    r.html.hubMotion = "still";
    let ctx: HubBuildContext | null = null;
    const offsets: number[][] = [];
    const { hooks: h } = hooks({ still: (f) => void offsets.push([...f.staticY]) });
    const handle = mount(r, h, false, (c) => (ctx = c));
    (ctx as unknown as HubBuildContext).shiftStatic(0, 5, 5);
    r.host.scrollY = 3000;
    r.host.dispatch("scroll");
    handle.redrawStill();
    assert.deepEqual(offsets.at(-1), [0]);
    assert.equal(r.canvases.stat.style.transform, "translate3d(0, 0px, 0)");
  });
});

describe("kit: canvas memory in stats", () => {
  it("reports the backing bytes of the live, static and window canvases", () => {
    const r = rig();
    r.host.location.search = "?hubstats=1";
    mount(r, hooks().hooks);
    for (let i = 0; i < 30; i++) r.scene.tick(20_000 + i * 17);
    const stats = r.globals.__hubSceneStats as HubSceneStats;
    const c = r.canvases;
    const expected = [c.live, c.stat, c.stage, c.mid, c.ground].reduce((sum, canvas) => sum + canvas.width * canvas.height * 4, 0);
    assert.equal(stats.canvasBytes, expected);
    assert.ok(stats.canvasBytes > 1440 * 700 * 4);
  });
});

describe("kit: static plane helpers", () => {
  it("caps static DPR at 1.5, and at 1.25 on coarse pointers", () => {
    assert.equal(staticDpr({ dpr: 3, coarse: true }), 1.25);
    assert.equal(staticDpr({ dpr: 2, coarse: false }), 1.5);
    assert.equal(staticDpr({ dpr: 1, coarse: true }), 1);
  });

  it("computes the same offset the kit writes", () => {
    assert.equal(staticOffset(3000, { parallax: 0.2, period: 512 }), 88);
    assert.equal(staticOffset(1000, { parallax: 0.5 }), 500);
    assert.equal(staticOffset(334, { parallax: 0.15 }), 50.1);
  });
});
