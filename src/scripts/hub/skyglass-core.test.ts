import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { createRng, type SceneOptions } from "../_shared/scene-runtime";
import { collectTokens, parseCss } from "./qa/css";
import { contrast, parseColor, rgbaToOklch } from "./qa/color";
import {
  CAPSULE_COOLDOWN_MS,
  CAPSULE_GLIDE_MS,
  CITY_REGIONS,
  CITY_WINDOWS,
  LOUVRE_MS,
  LOUVRE_SETTLE_MS,
  PAL,
  SKY_KEYS,
  SWITCH_FADE_MS,
  SWITCH_MAX_PER_S,
  SWITCH_REGION_MS,
  VANE_STEP,
  WindowScheduler,
  callCapsule,
  capsuleAt,
  cityLayout,
  cityShare,
  createCapsule,
  createMobile,
  daylightTarget,
  frontAngle,
  impulse,
  layoutFacade,
  litTarget,
  louvreAt,
  pageRange,
  placeSun,
  ringGeometry,
  ringPoint,
  ringShadow,
  setLouvre,
  stepDaylight,
  stepMobile,
  stillTurn,
  sunAngle,
  vaneWidth,
  type Louvre,
} from "./skyglass-core";
import { buildSkyglass } from "./skyglass-scene";
import { createBus } from "./world/bus";
import { rectDistance } from "./world/geom";
import { createHubScene } from "./world/kit";
import { cardAt, isCovered, holeDistance, toViewport, zoneAt } from "./world/page-model-core";
import type { CardInfo, HubPlanes, HubState, KitDeps, MediaQueryLike, Output, PageModel, PageSnapshot, Surface } from "./world/types";

const FIXTURE = JSON.parse(readFileSync(new URL("./world/__fixtures__/page-snapshots.json", import.meta.url), "utf8")) as {
  cells: Record<string, { snapshot: PageSnapshot }>;
};
const CELLS = Object.entries(FIXTURE.cells);
const SIZES = [...new Set(CELLS.map(([k]) => k.split("/")[0]))];
const toRgba = (c: readonly number[]) => parseColor(`rgb(${c[0]} ${c[1]} ${c[2]})`);

describe("skyglass palette", () => {
  // 0.079 at three decimals, as art-future measured it (window warm #efc795 is 0.0793).
  const MAX_C = 0.0795;

  it("keeps every sky key and scene colour at OKLCH chroma 0.079 or less (not neon)", () => {
    for (const row of SKY_KEYS) for (const hex of row) assert.ok(rgbaToOklch(parseColor(hex)).c < MAX_C, `${hex} chroma ${rgbaToOklch(parseColor(hex)).c.toFixed(4)}`);
    for (const [name, c] of Object.entries(PAL)) assert.ok(rgbaToOklch(toRgba(c)).c < MAX_C, `${name} chroma ${rgbaToOklch(toRgba(c)).c.toFixed(4)}`);
  });

  it("keeps every sky stop at OKLCH L 0.46 or below, so the page never glares", () => {
    for (const row of SKY_KEYS) for (const hex of row) assert.ok(rgbaToOklch(parseColor(hex)).l <= 0.46, `${hex} L ${rgbaToOklch(parseColor(hex)).l.toFixed(3)}`);
  });
});

describe("skyglass daylight lock (3.2)", () => {
  it(`covers the ${SIZES.length} fixture sizes, S0 and S1`, () => {
    assert.ok(SIZES.length >= 7);
  });

  for (const [key, cell] of CELLS) {
    it(`${key}: p is 0 while the hero is on screen, then monotonic and clamped`, () => {
      const r = pageRange(cell.snapshot);
      assert.ok(r.heroBottom > 0);
      for (let y = 0; y < r.heroBottom; y += 7) assert.equal(daylightTarget(y, r), 0, `target at ${y}`);
      // A fling back up with the spring loaded at dusk: the hero never shows a dusk sky.
      const spring = { x: 0.8, v: 0 };
      for (let y = r.maxScroll; y >= 0; y -= 90) {
        const p = stepDaylight(spring, y, r, 1 / 60);
        if (y < r.heroBottom) assert.equal(p, 0, `smoothed p at ${y}`);
      }
      let last = -1;
      for (let y = -50; y <= r.maxScroll + 200; y += 13) {
        const p = daylightTarget(y, r);
        assert.ok(p >= 0 && p <= 1, `clamped at ${y}`);
        assert.ok(p >= last, `monotonic at ${y}`);
        last = p;
      }
      if (r.maxScroll > r.heroBottom) assert.equal(daylightTarget(r.maxScroll, r), 1);
    });
  }

  it("keeps p at 0 when the page is too short for the range", () => {
    assert.equal(daylightTarget(400, { heroBottom: 300, maxScroll: 280, viewportH: 900 }), 0);
  });

  it("smooths the target with a critically damped spring (no overshoot)", () => {
    const r = { heroBottom: 200, maxScroll: 2200, viewportH: 900 };
    const s = { x: 0, v: 0 };
    let peak = 0;
    for (let i = 0; i < 240; i++) peak = Math.max(peak, stepDaylight(s, 2200, r, 1 / 60));
    assert.ok(peak <= 1 && s.x > 0.999);
    const half = { x: 0, v: 0 };
    for (let i = 0; i < 21; i++) stepDaylight(half, 2200, r, 1 / 60);
    assert.ok(half.x > 0.1 && half.x < 0.9, "blends over a fraction of a second");
  });
});

describe("skyglass ring and sun", () => {
  it("ring shadow is monotonic in p and leaves a sun-side sliver at p = 1", () => {
    let last = -1;
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const f = ringShadow(p);
      assert.ok(f >= last);
      last = f;
    }
    assert.equal(ringShadow(0), 0);
    assert.ok(ringShadow(1) < 0.95 && ringShadow(1) > 0.85);
  });

  it("writes --w-sun in whole degrees, about 40 distinct values over the scroll", () => {
    const values = new Set<number>();
    for (let p = 0; p <= 1; p += 0.001) values.add(sunAngle(p));
    assert.ok([...values].every(Number.isInteger));
    assert.ok(values.size <= 41, `${values.size} values`);
  });

  for (const [key, cell] of CELLS) {
    it(`${key}: sun placement avoids every hole and cover rect`, () => {
      const s = cell.snapshot;
      const sun = placeSun(s);
      if (!sun.on) {
        assert.ok(sun.x > s.viewport.w, "off-screen to the right, only the halo shows");
        return;
      }
      for (const rect of [...s.holes, ...s.cover]) assert.ok(rectDistance(sun.x, sun.y, rect) >= sun.r * 2, `${JSON.stringify(rect)} too close`);
    });

    it(`${key}: the ring arch clears the title or arcs above the top bar`, () => {
      const s = cell.snapshot;
      const g = ringGeometry(s, 0);
      const title = s.parts.title;
      if (s.mode === "phone" || s.mode === "landscape-short") {
        assert.ok(ringPoint(g, 0.5).y <= 14, "apex high in the top band");
        return;
      }
      for (let x = title.x; x <= title.x + title.w; x += 10) {
        const a = Math.acos(Math.max(-1, Math.min(1, (x - g.cx) / g.rx))) / Math.PI;
        const y = ringPoint(g, 1 - a).y;
        assert.ok(y <= title.y - 13, `ring at x ${x} is at y ${y.toFixed(1)}, title top ${title.y}`);
      }
    });
  }
});

describe("skyglass facade", () => {
  for (const [key, cell] of CELLS) {
    it(`${key}: at most 24 blades, all in the gutters; wide has two towers per side and a truss clear of the title`, () => {
      const s = cell.snapshot;
      const f = layoutFacade(s, createRng(7), placeSun(s));
      assert.ok(f.blades.length <= 24 && f.blades.length >= 2);
      for (const b of f.blades) {
        const inLeft = b.x + b.w <= s.shell.x + 0.5;
        const inRight = b.x >= s.shell.x + s.shell.w - 0.5;
        assert.ok(inLeft || inRight, `blade ${b.x}..${b.x + b.w} overlaps the shell`);
      }
      if (s.mode === "wide") {
        assert.equal(f.towers.length, 4);
        assert.ok(f.bridge && f.bridge.x1 <= s.parts.title.x && f.bridge.x0 < f.bridge.x1);
      }
    });
  }
});

describe("skyglass far city and window switch-ons (M2, M8)", () => {
  it("lays out at most 240 window cells in four regions", () => {
    const { towers, windows } = cityLayout(1440, 620, 126, createRng(3));
    assert.ok(towers.length > 30);
    assert.ok(windows.length <= CITY_WINDOWS && windows.length > 100);
    for (const w of windows) assert.ok(w.region >= 0 && w.region < CITY_REGIONS);
  });

  it("lit share follows the read sum: 0.1 + 0.9 x sum / open cards", () => {
    const card = (kind: CardInfo["kind"], read: number | null, finished = false) => ({ kind, read, finished }) as CardInfo;
    assert.equal(cityShare([card("open", null), card("open", null), card("locked", null)]), 0.1);
    assert.ok(Math.abs(cityShare([card("open", 0.5), card("open", null), card("upcoming", null)]) - (0.1 + 0.9 * 0.25)) < 1e-9);
    assert.equal(cityShare([card("open", 0.2, true), card("open", 1)]), 1);
    const s0 = FIXTURE.cells["1440x900/S0"].snapshot;
    const s1 = FIXTURE.cells["1440x900/S1"].snapshot;
    assert.ok(cityShare(s1.cards) > cityShare(s0.cards), "reading lights more of the city");
    let last = -1;
    for (let share = 0; share <= 1; share += 0.05) {
      const n = litTarget(240, share, 1);
      assert.ok(n >= last);
      last = n;
    }
    assert.equal(litTarget(240, 0.5, 1), 120);
  });

  it("switches windows on at most once per 1.5 s per region and twice per second in total", () => {
    const regions = Array.from({ length: 200 }, (_, i) => i % CITY_REGIONS);
    const s = new WindowScheduler(regions);
    const ons: { t: number; region: number }[] = [];
    for (let t = 0; t < 60_000; t += 16) {
      const i = s.update(t, t < 40_000 ? 180 : 20);
      if (i >= 0 && s.alpha(i, t) === 0 && t < 40_000) ons.push({ t, region: regions[i] });
    }
    assert.ok(ons.length > 30, `${ons.length} switch-ons`);
    for (let r = 0; r < CITY_REGIONS; r++) {
      const times = ons.filter((o) => o.region === r).map((o) => o.t);
      for (let k = 1; k < times.length; k++) assert.ok(times[k] - times[k - 1] >= SWITCH_REGION_MS, `region ${r}`);
    }
    for (const a of ons) assert.ok(ons.filter((b) => b.t >= a.t && b.t < a.t + 1000).length <= SWITCH_MAX_PER_S);
    const first = ons[0];
    assert.equal(s.alpha(0, first.t + SWITCH_FADE_MS / 2), 0.5, "fades in over 600 ms");
    assert.ok(s.lit < 180, "and switches off again when the target drops");
  });

  it("composes the lit set at once for the still", () => {
    const s = new WindowScheduler(Array.from({ length: 50 }, (_, i) => i % 4));
    s.compose(20);
    assert.equal(s.lit, 20);
    assert.equal(s.alpha(19, 0), 1);
    assert.equal(s.alpha(20, 0), 0);
  });
});

describe("skyglass mobile (M1, M3, M9, M12)", () => {
  it("never projects a vane to a negative width", () => {
    for (let a = -20; a <= 20; a += 0.013) {
      const w = vaneWidth(30, a, 0.9);
      assert.ok(w >= 0 && w <= 27 + 1e-9);
    }
  });

  it("brings the attended vane to the front, face-on", () => {
    const m = createMobile(6, createRng(2));
    for (let i = 0; i < 300; i++) stepMobile(m, 1 / 60, i / 60, 3);
    assert.ok(Math.abs(m.theta - frontAngle(m.theta, 3)) < 0.05, "hoop aligned");
    assert.ok(Math.abs(Math.cos(m.vanes[3].psi) - 1) < 0.01, "face-on");
  });

  it("swings after an impulse and settles back to the idle drift", () => {
    const m = createMobile(6, createRng(4));
    impulse(m, "tap", createRng(5));
    assert.ok(Math.abs(m.omega) > 1);
    let swung = 0;
    for (let i = 0; i < 1500; i++) {
      stepMobile(m, 1 / 60, i / 60, -1);
      swung = Math.max(swung, Math.abs(m.vanes[0].sway));
    }
    assert.ok(swung > 0.5, "vanes swing on their threads");
    assert.ok(Math.abs(m.omega - 0.08) < 0.05 && Math.abs(m.vanes[0].sway) < 0.5, "and settle");
    impulse(m, "left", createRng(6));
    assert.ok(m.omega < 0, "a left action turns it left");
  });

  it("turns one vane step as the still's instant cut", () => {
    assert.ok(Math.abs(stillTurn(0, "right") - VANE_STEP) < 1e-12);
    assert.ok(Math.abs(stillTurn(0, "left") + VANE_STEP) < 1e-12);
  });
});

describe("skyglass capsule and louvres (M4, dialogs)", () => {
  it("calls the capsule at once with an 8 s cooldown and glides in 5.6 s", () => {
    const rng = createRng(1);
    const c = createCapsule(0, rng);
    c.next = Infinity;
    assert.equal(callCapsule(c, 1000), true);
    assert.equal(capsuleAt(c, 1000 + CAPSULE_GLIDE_MS / 2, rng).moving, true);
    assert.equal(callCapsule(c, 2000), false, "busy while gliding");
    assert.deepEqual(capsuleAt(c, 1000 + CAPSULE_GLIDE_MS + 10, rng), { u: 1, moving: false });
    assert.ok(c.next >= 1000 + CAPSULE_GLIDE_MS + 25000 && c.next <= 1000 + CAPSULE_GLIDE_MS + 45010, "next arrival in 25-45 s");
    assert.equal(callCapsule(c, 1000 + CAPSULE_COOLDOWN_MS - 1), false, "cooldown");
    assert.equal(callCapsule(c, 1000 + CAPSULE_COOLDOWN_MS), true);
  });

  it("closes the louvres within the settle window", () => {
    const l: Louvre = { from: 0, to: 0, at: -Infinity };
    setLouvre(l, 1, 100);
    assert.equal(louvreAt(l, 100), 0);
    assert.ok(louvreAt(l, 100 + LOUVRE_MS / 2) > 0.3);
    assert.equal(louvreAt(l, 100 + LOUVRE_MS), 1);
    assert.ok(LOUVRE_SETTLE_MS >= LOUVRE_MS && LOUVRE_SETTLE_MS < 600);
  });
});

describe("skyglass contrast (dark key)", () => {
  const css = parseCss(readFileSync(new URL("../../styles/_shared/hub-themes/skyglass.css", import.meta.url), "utf8"));
  const tokens = collectTokens(css, [':root[data-hub-theme="skyglass"]']);
  const col = (name: string) => parseColor(`var(${name})`, tokens);

  it("holds 5.0:1 for the subtitle and 8.0:1 for the title over every sky stop that reaches the hero, with no plate and no pool", () => {
    assert.equal(tokens.get("--hub-hero-plate")?.trim(), "none");
    for (const row of SKY_KEYS) {
      for (const sky of row.slice(0, 4)) {
        assert.ok(contrast(col("--hub-hero-muted"), parseColor(sky)) >= 5, `subtitle over ${sky}`);
        assert.ok(contrast(col("--hub-hero-ink"), parseColor(sky)) >= 8, `title over ${sky}`);
      }
    }
  });

  it("keeps the lit doorplate and the card text pairs", () => {
    assert.ok(contrast(col("--resume-action-ink"), parseColor("#e3b98c")) >= 8.5);
    for (const ink of ["--hub-ink", "--hub-muted", "--hub-faint"]) assert.ok(contrast(col(ink), col("--card-body-bg")) >= 7, ink);
    assert.ok(contrast(col("--hub-focus"), col("--card-body-bg")) >= 3 && contrast(col("--hub-focus-halo-color"), col("--hub-focus")) >= 3);
  });
});

/* ------------------------------------------------------------------ the scene on the kit, with fakes */

type Call = [string, unknown[]];

/** A 2D context that accepts every call and records fillRect for the louvre check. */
function fakeCtx(calls: Call[] = []): CanvasRenderingContext2D {
  const gradient = { addColorStop() {} };
  const state: Record<string | symbol, unknown> = {};
  return new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === "createLinearGradient" || key === "createRadialGradient") return () => gradient;
      if (key === "createPattern") return () => ({});
      if (key === "createImageData") return (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (key === "fillRect") return (...args: unknown[]) => void calls.push(["fillRect", args]);
      return () => undefined;
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

function fakeCanvas(box: { left: number; top: number; width: number; height: number }, calls?: Call[]) {
  const ctx = fakeCtx(calls);
  return {
    width: 300,
    height: 150,
    style: { removeProperty() {} } as unknown as CSSStyleDeclaration,
    dataset: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height }),
  };
}

class Media implements MediaQueryLike {
  matches = false;
  addEventListener() {}
  removeEventListener() {}
}

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function rig() {
  const s = FIXTURE.cells["1440x900/S1"].snapshot;
  const clock = { t: 10_000 };
  const factory = { created: 0, released: 0 };
  const liveCalls: Call[] = [];
  const liveCtx = fakeCtx(liveCalls);
  const idle: ((d: { didTimeout: boolean; timeRemaining(): number }) => void)[] = [];
  const scene = { options: null as SceneOptions | null, running: false, stops: 0 };
  const state: HubState = {};
  const bus = createBus(new EventTarget(), () => state);
  const page: PageModel = {
    getSnapshot: () => s,
    refresh: () => s,
    subscribe: () => () => {},
    zoneAt: (x, y) => zoneAt(s, x, y),
    cardAt: (x, y) => cardAt(s, x, y),
    isCovered: (x, y, pad) => isCovered(s, x, y, pad),
    holeDistance: (x, y) => holeDistance(s, x, y),
    toViewport: (r, y = 0) => toViewport(r, y),
    dispose() {},
  };
  const output: Output = {
    root() {},
    card() {},
    heroPoolX() {},
    beat() {},
    perch: () => 0,
    unperch() {},
    label() {},
    focusCard() {},
    still() {},
    resume() {},
    dispose() {},
  };
  const host = {
    scrollY: 0,
    location: { search: "" },
    sessionStorage: { getItem: () => null, setItem() {} },
    document: { hidden: false, documentElement: { dataset: {} } },
    addEventListener() {},
    removeEventListener() {},
  };
  const deps: Partial<KitDeps> = {
    createScene: (options) => {
      scene.options = options;
      options.resize({ width: 1440, height: 900, dpr: 1 }, liveCtx);
      return {
        start: () => void (scene.running = true),
        stop: () => {
          scene.running = false;
          scene.stops++;
        },
        destroy: () => void (scene.running = false),
      };
    },
    ResizeObserver: Observer as never,
    IntersectionObserver: Observer as never,
    now: () => clock.t,
    matchMedia: () => new Media(),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    requestIdle: (fn) => idle.push(fn),
    cancelIdle: () => {},
    surfaceFactory: {
      surface(w: number, h: number): Surface {
        factory.created++;
        return { canvas: { width: w, height: h } as HTMLCanvasElement, g: fakeCtx() };
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
    createOutput: () => output,
    host: host as never,
    globals: {},
  };
  const planes = {
    root: { dataset: {} },
    live: fakeCanvas({ left: 0, top: 0, width: 1440, height: 900 }),
    statics: [{ canvas: fakeCanvas({ left: 0, top: 0, width: 1440, height: 900 }), parallax: 0 }],
    windows: {
      stage: fakeCanvas({ left: 0, top: s.windows.stage.y, width: 1440, height: s.windows.stage.h }),
      mid: fakeCanvas({ left: 0, top: s.windows.mid.y, width: 1440, height: s.windows.mid.h }),
      ground: fakeCanvas({ left: 0, top: s.windows.ground.y, width: 1440, height: s.windows.ground.h }),
    },
  } as unknown as HubPlanes;
  const handle = createHubScene("skyglass", planes, (ctx) => buildSkyglass(ctx, planes, () => clock.t), { deps });
  const tick = (ms = 16) => {
    clock.t += ms;
    liveCalls.length = 0;
    scene.options?.render(liveCtx, { t: clock.t / 1000, dt: ms / 1000, width: 1440, height: 900, dpr: 1, pointer: {} as never });
  };
  const runIdle = () => {
    for (let k = 0; k < 20 && idle.length; k++) idle.shift()?.({ didTimeout: false, timeRemaining: () => 40 });
  };
  return { handle, factory, scene, bus, clock, tick, liveCalls, runIdle, globals: deps.globals as Record<string, unknown> };
}

describe("skyglass scene on the kit", () => {
  it("releases every surface after build, three resizes and destroy", () => {
    const r = rig();
    assert.equal(r.globals.__skyglassBgInitialized, true);
    r.runIdle();
    r.tick();
    for (const [w, h] of [
      [1280, 800],
      [390, 844],
      [1440, 900],
    ]) {
      r.scene.options?.resize({ width: w, height: h, dpr: 1 }, fakeCtx());
      r.runIdle();
      r.tick();
    }
    assert.ok(r.factory.created > 10);
    r.handle.destroy();
    assert.equal(r.factory.created, r.factory.released, "created equals released");
    assert.equal(r.globals.__skyglassBgInitialized, false);
  });

  it("closes the louvres and pauses the loop within 600 ms of a dialog opening", () => {
    const r = rig();
    r.runIdle();
    for (let i = 0; i < 10; i++) r.tick();
    assert.equal(r.scene.running, true);
    const opened = r.clock.t;
    r.bus.emit("hub:modal", { open: true });
    let slats = 0;
    while (r.scene.running && r.clock.t - opened < 1000) {
      r.tick();
      slats = r.liveCalls.filter(([name, args]) => name === "fillRect" && args[2] === 1440 && args[3] === 26).length;
    }
    assert.equal(r.scene.running, false, "the loop paused");
    assert.ok(r.clock.t - opened <= 600, `paused after ${r.clock.t - opened} ms`);
    assert.ok(slats >= Math.floor(900 / 26), `the last frame drew the louvres fully closed (${slats} slats)`);
    r.bus.emit("hub:modal", { open: false });
    assert.equal(r.scene.running, true, "resumes on close");
    r.handle.destroy();
  });

  it("keeps the picker sheet from pausing the scene", () => {
    const r = rig();
    for (let i = 0; i < 4; i++) r.tick();
    r.bus.emit("hub:modal", { open: true, kind: "picker" });
    for (let i = 0; i < 60; i++) r.tick();
    assert.equal(r.scene.running, true);
    r.handle.destroy();
  });
});
