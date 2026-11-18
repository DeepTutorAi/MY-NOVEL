import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import type { SceneOptions } from "../_shared/scene-runtime";
import { bankLayout, boatX, houseGlow } from "./firefly-bank";
import { computeLayout, crossingOrder, isControlHole, moonClearance, moonSpot, SIDE, TOP } from "./firefly-core";
import { mount } from "./firefly-scene";
import { buildTree, inGutter, pickWeighted, type TreeEnv } from "./firefly-tree";
import { createBus } from "./world/bus";
import type { CardInfo, HubState, KitDeps, Output, PageModel, PageSnapshot, Surface } from "./world/types";

interface Cell {
  size: { w: number; h: number };
  snapshot: PageSnapshot;
}
const FIXTURES = JSON.parse(readFileSync(join(process.cwd(), "src/scripts/hub/world/__fixtures__/page-snapshots.json"), "utf8")) as {
  cells: Record<string, Cell>;
};
const SIZES = ["1440x900", "1280x800", "2560x1440", "390x844", "844x390", "320x568", "700x560", "667x375"];
const cell = (key: string) => {
  const c = FIXTURES.cells[key];
  assert.ok(c, `fixture ${key}`);
  return c.snapshot;
};

const envOf = (s: PageSnapshot): TreeEnv => {
  const L = computeLayout(s, s.viewport.w, s.viewport.h);
  return {
    width: L.width,
    height: L.treeBottom,
    waterY: L.waterY,
    moonX: L.moon.x,
    moonY: L.moon.y,
    scale: L.scale,
    gutterL: L.gutterL,
    gutterR: L.gutterR,
    side: L.side,
    top: TOP,
  };
};

describe("firefly layout from the page model (spec 3.5, 8.3 item 8)", () => {
  for (const size of SIZES) {
    for (const state of ["S0", "S1"]) {
      it(`roots the trees in the real gutters at ${size}/${state}`, () => {
        const s = cell(`${size}/${state}`);
        const L = computeLayout(s, s.viewport.w, s.viewport.h);
        assert.equal(L.mode, s.mode);
        assert.equal(L.gutterL, s.gutters.left);
        assert.equal(L.gutterR, s.gutters.right);
        const rooted = L.trees.filter((t) => t.rooted && t.near);
        assert.equal(rooted.length, 2, "one main tree per gutter");
        for (const t of rooted) {
          const left = t.baseX < L.width / 2;
          // The trunk stands in its gutter, never behind the shell (the old layout used 0.12 W).
          if (left) assert.ok(t.baseX >= -SIDE - 10 && t.baseX <= Math.max(8, L.gutterL), `left trunk at ${t.baseX}, gutter ${L.gutterL}`);
          else assert.ok(t.baseX <= L.width + SIDE + 10 && t.baseX >= L.width - Math.max(8, L.gutterR), `right trunk at ${t.baseX}, gutter ${L.gutterR}`);
        }
        // Sprays down the gutters reach at most a little past the shell edge.
        for (const t of L.trees.filter((t) => !t.rooted && t.top > L.height * 0.4)) {
          const left = t.baseX < L.width / 2;
          if (left) assert.ok(t.x1 <= L.gutterL + 14, `left spray reaches ${t.x1}`);
          else assert.ok(t.x0 >= L.width - L.gutterR - 14, `right spray reaches ${t.x0}`);
        }
        // The plane covers the whole scroll travel.
        assert.ok(L.treeBottom >= L.height + L.scrollMax * 0.3, "tree plane covers the scroll");
        assert.ok(L.skyH >= L.height + L.scrollMax * 0.15, "sky plane covers the scroll");
      });
    }
  }

  it("weights perches by the real gutters, not by 0.12 W", () => {
    const s = cell("1440x900/S1");
    const env = envOf(s);
    assert.equal(inGutter(env, 175), true);
    assert.equal(inGutter(env, 200), false, "200 px is behind the shell at 1440 although it is past 0.12 W");
    const wide = envOf(cell("2560x1440/S0"));
    assert.equal(inGutter(wide, 600), true, "600 px is in the 740 px gutter at 2560 although it is past 0.12 W");
  });

  it("keeps the moon clear of the title, chip and picker at every size", () => {
    for (const size of SIZES) {
      const s = cell(`${size}/S0`);
      const m = moonSpot(s, s.viewport.w, s.viewport.h);
      if (size === "667x375") {
        assert.equal(m.r, 0, "no room in the 667x375 top band: no moon");
        continue;
      }
      assert.ok(m.r > 0, `${size}: a moon`);
      const clear = moonClearance(m.r);
      for (const h of s.holes) {
        const dx = Math.max(h.x - m.x, 0, m.x - (h.x + h.w));
        const dy = Math.max(h.y - m.y, 0, m.y - (h.y + h.h));
        const need = isControlHole(s, h) ? clear.control : clear.text;
        assert.ok(Math.hypot(dx, dy) >= need - 1e-6, `${size}: moon at ${m.x},${m.y} is ${Math.hypot(dx, dy)} px from a hole (needs ${need})`);
      }
      assert.ok(m.y - m.r >= 0 && m.x > 0 && m.x < s.viewport.w, `${size}: moon on screen`);
    }
  });

  it("orders the chorus front across the cards: top-left first, then right and down", () => {
    const desk = cell("1440x900/S1");
    const order = crossingOrder(desk.cards, 600, 900).map((c) => c.slug);
    const [tl, tr, bl, br] = desk.cards.map((c) => c.slug);
    assert.equal(order[0], tl, "the top-left card first");
    assert.ok(order.indexOf(tl) < order.indexOf(tr) && order.indexOf(bl) < order.indexOf(br), "left column before right in each row");
    assert.ok(order.indexOf(tl) < order.indexOf(bl) && order.indexOf(tr) < order.indexOf(br), "upper row before lower row in each column");
    assert.equal(order.length, 4, "the four cards on screen at this scroll");
    const phone = cell("390x844/S1");
    const atTop = crossingOrder(phone.cards, 900, 844).map((c) => c.slug);
    const expected = phone.cards.filter((c) => c.rect.y - 900 < 844 && c.rect.y + c.rect.h - 900 > 0).map((c) => c.slug);
    assert.deepEqual(atTop, expected, "a single column is crossed from the top down");
    assert.deepEqual(crossingOrder(desk.cards, 5000, 900), [], "cards off screen are left out");
  });
});

describe("lamphu tree geometry", () => {
  it("is deterministic for a given layout", () => {
    const s = cell("1440x900/S1");
    const L = computeLayout(s, 1440, 900);
    const env = envOf(s);
    const a = buildTree(L.trees[0], env);
    const b = buildTree(L.trees[0], env);
    assert.deepEqual(a.pads, b.pads);
    assert.deepEqual(Array.from(a.perches), Array.from(b.perches));
    assert.deepEqual(a.branches, b.branches);
  });

  for (const size of ["1440x900", "390x844", "844x390", "2560x1440"]) {
    it(`builds finite, bounded geometry with visible perches at ${size}`, () => {
      const s = cell(`${size}/S1`);
      const L = computeLayout(s, s.viewport.w, s.viewport.h);
      const env = envOf(s);
      for (const spec of L.trees) {
        const tree = buildTree(spec, env);
        assert.ok(tree.pads.length >= (spec.near ? 40 : 30), `pads ${tree.pads.length}`);
        assert.ok(tree.branches.length > 3, `branches ${tree.branches.length}`);
        for (const br of [tree.trunk, ...tree.roots, ...tree.branches]) {
          assert.ok(br.pts.length >= 6 && br.pts.length % 3 === 0);
          assert.ok(br.pts.every(Number.isFinite), "limb points are finite");
        }
        for (const p of tree.pads) {
          assert.ok(Number.isFinite(p.x + p.y + p.rx + p.ry + p.leaf) && p.leaf > 0);
          assert.ok(p.shell >= 0 && p.shell <= 1);
        }
        const { box } = tree;
        assert.ok(box.x >= -L.side - 3 && box.y >= -TOP - 3 && box.x + box.w <= L.width + L.side + 4 && box.y + box.h <= L.treeBottom + 4, "box stays inside the plane");
        assert.equal(tree.trunkBox !== null, spec.rooted, "only rooted trees draw a trunk to the water");
        const n = tree.perchEdge.length;
        let visible = 0;
        for (let i = 0; i < n; i++) {
          const x = tree.perches[i * 2];
          const y = tree.perches[i * 2 + 1];
          if (x > 0 && x < L.width && y > 0 && y < L.treeBottom) visible++;
          if (i > 0) assert.ok(tree.perchCdf[i] >= tree.perchCdf[i - 1], "cdf is monotone");
        }
        assert.ok(visible / n > 0.9, `visible perches ${visible}/${n}`);
        assert.ok(Math.abs(tree.perchCdf[n - 1] - 1) < 1e-4);
      }
    });
  }

  it("closes the crown: no pad centre lies far outside the envelope", () => {
    const s = cell("1440x900/S1");
    const L = computeLayout(s, 1440, 900);
    const spec = L.trees.find((t) => t.rooted && t.near);
    assert.ok(spec);
    const tree = buildTree(spec, envOf(s));
    const rx = (spec.x1 - spec.x0) / 2;
    for (const p of tree.pads) {
      assert.ok(Math.abs(p.x - tree.cx) <= rx * 1.13, "pad within the crown width");
      assert.ok(p.y >= spec.top - 60 && p.y <= spec.bottom + 20, "pad within the crown height");
    }
  });

  it("picks the first perch whose cumulative weight reaches u", () => {
    const cdf = Float32Array.from([0.1, 0.4, 0.4, 1]);
    assert.equal(pickWeighted(cdf, 0), 0);
    assert.equal(pickWeighted(cdf, 0.11), 1);
    assert.equal(pickWeighted(cdf, 0.4), 1);
    assert.equal(pickWeighted(cdf, 0.9), 3);
  });
});

describe("the far bank (mid window)", () => {
  const card = (slug: string, kind: CardInfo["kind"], read: number | null, finished = false): CardInfo => ({
    slug,
    kind,
    index: 0,
    accent: "#8CCFFF",
    rect: { x: 0, y: 0, w: 1, h: 1 },
    media: { x: 0, y: 0, w: 1, h: 1 },
    body: { x: 0, y: 0, w: 1, h: 1 },
    read,
    finished,
    stateText: "",
    titleTh: "",
  });

  it("builds one house per published or locked card, with the right kind, and a boat lantern per upcoming card", () => {
    for (const size of SIZES) {
      const s = cell(`${size}/S1`);
      const r = s.windows.mid;
      const box = { w: s.viewport.w, h: r.h, boxX: r.x - (r.x + r.w / 2 - s.viewport.w / 2), boxW: r.w };
      const bank = bankLayout(s.cards, box, 1, 7);
      const built = s.cards.filter((c) => c.kind !== "upcoming");
      assert.equal(bank.houses.length, built.length, `${size}: houses`);
      assert.deepEqual(bank.houses.map((h) => h.slug), built.map((c) => c.slug));
      for (const h of bank.houses) {
        const c = built.find((x) => x.slug === h.slug);
        assert.ok(c);
        assert.equal(h.shut, c.kind === "locked", `${h.slug}: shutters only on the locked house`);
        if (h.shut) assert.equal(h.glow, 0, "a locked house has no lamp");
        assert.ok(h.x - h.w / 2 >= box.boxX && h.x + h.w / 2 <= box.boxX + box.boxW, `${size}: ${h.slug} inside the window box`);
      }
      assert.equal(bank.boats.length, s.cards.filter((c) => c.kind === "upcoming").length, `${size}: boats`);
    }
  });

  it("varies with the card count and kinds", () => {
    const box = { w: 1440, h: 216, boxX: 180, boxW: 1080 };
    const two = bankLayout([card("a", "open", 0.5), card("b", "locked", null)], box, 1, 1);
    assert.equal(two.houses.length, 2);
    assert.deepEqual(two.houses.map((h) => h.kind), ["open", "locked"]);
    const six = bankLayout([card("a", "open", null), card("b", "open", 0.2), card("c", "open", 1, true), card("d", "open", null), card("u", "upcoming", null), card("v", "upcoming", null)], box, 1, 1);
    assert.equal(six.houses.length, 4);
    assert.equal(six.boats.length, 2);
    const xs = six.houses.map((h) => h.x);
    assert.deepEqual([...xs].sort((p, q) => p - q), xs, "houses keep the reading order from left to right");
    assert.equal(six.houses[2].finished, true, "a finished novel moors a lantern at its house");
  });

  it("lights a house by progress: dark unread, warm from the first page, full when finished", () => {
    assert.equal(houseGlow(null, false), 0);
    assert.equal(houseGlow(0, false), 0);
    assert.ok(houseGlow(0.01, false) >= 0.32);
    assert.ok(houseGlow(0.5, false) > houseGlow(0.1, false));
    assert.equal(houseGlow(0.4, true), 1);
  });

  it("brings the upcoming boats closer without ever arriving", () => {
    const bank = bankLayout([card("u", "upcoming", null)], { w: 1440, h: 216, boxX: 180, boxW: 1080 }, 1, 1);
    const boat = bank.boats[0];
    let prev = Infinity;
    for (const t of [0, 10, 60, 300, 3600]) {
      const x = boatX(boat, t);
      assert.ok(x < prev && x > boat.rest, `at ${t} s the boat is at ${x}, rest ${boat.rest}`);
      prev = x;
    }
  });

  it("shows every upcoming boat lantern on the river from the first frame (the still included)", () => {
    const box = { w: 1440, h: 216, boxX: 180, boxW: 1080 };
    const bank = bankLayout([card("u", "upcoming", null), card("v", "upcoming", null)], box, 1, 1);
    for (const boat of bank.boats) {
      const x = boatX(boat, 0);
      assert.ok(x > box.boxX && x < box.boxX + box.boxW, `boat ${boat.slug} starts at ${x}, inside the window box`);
    }
  });

  it("keeps the far-bank houses legible on a phone and in landscape-short", () => {
    const cards = [card("a", "open", 0.5), card("b", "open", null), card("c", "open", 1, true), card("d", "locked", null)];
    const phone = bankLayout(cards, { w: 390, h: 180, boxX: 17, boxW: 356 }, 0.5, 1, "phone");
    const short = bankLayout(cards, { w: 844, h: 110, boxX: 60, boxW: 724 }, 0.5, 1, "landscape-short");
    for (const h of phone.houses) assert.ok(h.w >= 30, `phone house ${h.slug} is ${h.w} px wide`);
    for (const h of short.houses) assert.ok(h.w >= 24, `landscape-short house ${h.slug} is ${h.w} px wide`);
  });
});

/* ------------------------------------------------------------------ scene on the kit with fakes */

class FakeCanvas {
  width = 300;
  height = 150;
  draws = 0;
  style: Record<string, string> & { removeProperty(name: string): void; setProperty(name: string, v: string): void };
  ctx: CanvasRenderingContext2D;
  constructor(public box = { left: 0, top: 0, width: 0, height: 0 }) {
    const style = {} as FakeCanvas["style"];
    style.removeProperty = (name: string) => void delete style[name];
    style.setProperty = (name: string, v: string) => void (style[name] = v);
    this.style = style;
    this.ctx = fakeCtx(this);
  }
  getContext() {
    return this.ctx;
  }
  getBoundingClientRect() {
    const b = this.box;
    return { ...b, x: b.left, y: b.top, right: b.left + b.width, bottom: b.top + b.height };
  }
}

/** A 2D context that accepts every call; gradients and patterns are inert, drawImage is counted. */
function fakeCtx(canvas: FakeCanvas): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = { canvas };
  const gradient = { addColorStop() {} };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === "createLinearGradient" || prop === "createRadialGradient" || prop === "createPattern") return () => gradient;
      if (prop === "drawImage") return () => void canvas.draws++;
      if (typeof prop === "string") return () => undefined;
      return undefined;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

class FakeObserver {
  static all: FakeObserver[] = [];
  constructor(public callback: (entries: never[], observer: never) => void) {
    FakeObserver.all.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

interface Rig {
  handle: NonNullable<ReturnType<typeof mount>>;
  options: () => SceneOptions;
  statics: FakeCanvas[];
  windows: Record<"stage" | "mid" | "ground", FakeCanvas>;
  flushPaint(): void;
  frame(): void;
  ledger: { live: number; peak: number; created: number; released: number };
  bus: ReturnType<typeof createBus>;
  globals: Record<string, unknown>;
  liveDraws: () => number;
  live: FakeCanvas;
}

function rig(snapshotIn: PageSnapshot): Rig {
  const snapshot = structuredClone(snapshotIn);
  const vw = snapshot.viewport.w;
  const vh = snapshot.viewport.h;
  const statics = [0, 1, 2, 3].map(() => new FakeCanvas());
  const live = new FakeCanvas({ left: 0, top: 0, width: vw, height: vh });
  const win = (name: "stage" | "mid" | "ground") => new FakeCanvas({ left: 0, top: snapshot.windows[name].y, width: vw, height: snapshot.windows[name].h });
  const windows = { stage: win("stage"), mid: win("mid"), ground: win("ground") };
  const root = {
    dataset: {} as Record<string, string>,
    querySelector: (sel: string) => (sel === "canvas[data-sky-live]" ? live : null),
    querySelectorAll: () => statics,
    ownerDocument: {
      querySelector: (sel: string) => (sel.includes('"stage"') ? windows.stage : sel.includes('"mid"') ? windows.mid : sel.includes('"ground"') ? windows.ground : null),
    },
  };
  const state: HubState = {};
  const bus = createBus(new EventTarget(), () => state);
  const page: PageModel = {
    getSnapshot: () => snapshot,
    refresh: () => snapshot,
    subscribe: () => () => undefined,
    zoneAt: () => "open",
    cardAt: () => null,
    isCovered: () => false,
    holeDistance: () => Infinity,
    toViewport: (r) => r,
    dispose() {},
  };
  const output: Output = {
    root() {},
    card() {},
    heroPoolX() {},
    beat() {},
    perch: () => 1,
    unperch() {},
    label() {},
    focusCard() {},
    still() {},
    resume() {},
    dispose() {},
  };
  const ledger = { live: 0, peak: 0, created: 0, released: 0 };
  const sizes = new Map<HTMLCanvasElement, number>();
  const idle: ((d: { didTimeout: boolean; timeRemaining(): number }) => void)[] = [];
  let sceneOptions: SceneOptions | null = null;
  let clock = 10_000;
  let t = 0;
  const host = {
    scrollY: 0,
    location: { search: "?seed=1" },
    sessionStorage: { getItem: () => null, setItem: () => undefined },
    document: { hidden: false, documentElement: { dataset: {} as Record<string, string> } },
    addEventListener() {},
    removeEventListener() {},
  };
  const globals: Record<string, unknown> = {};
  const staticBytes = () => statics.reduce((sum, c) => sum + c.width * c.height * 4, 0);
  const deps: Partial<KitDeps> = {
    createScene: (options) => {
      sceneOptions = options;
      options.resize({ width: vw, height: vh, dpr: Math.min(1.5, snapshot.viewport.dpr) }, live.ctx);
      return { start() {}, stop() {}, destroy() {} };
    },
    ResizeObserver: FakeObserver as never,
    IntersectionObserver: FakeObserver as never,
    now: () => clock,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => undefined,
    requestIdle: (fn) => idle.push(fn),
    cancelIdle: () => undefined,
    surfaceFactory: {
      surface(w: number, h: number): Surface {
        const canvas = new FakeCanvas();
        canvas.width = Math.ceil(w);
        canvas.height = Math.ceil(h);
        const c = canvas as unknown as HTMLCanvasElement;
        sizes.set(c, canvas.width * canvas.height * 4);
        ledger.created++;
        ledger.live += canvas.width * canvas.height * 4;
        ledger.peak = Math.max(ledger.peak, ledger.live + staticBytes());
        return { canvas: c, g: canvas.ctx };
      },
      release(...list: HTMLCanvasElement[]) {
        for (const c of list) {
          ledger.released++;
          ledger.live -= sizes.get(c) ?? 0;
          sizes.delete(c);
          c.width = 0;
          c.height = 0;
        }
      },
    },
    page,
    bus,
    createOutput: () => output,
    host: host as never,
    globals,
  };
  FakeObserver.all = [];
  const handle = mount(root as unknown as HTMLElement, { deps });
  assert.ok(handle, "mount returns a handle");
  // Every window is on screen for the frame tests.
  const io = FakeObserver.all[1];
  io.callback(Object.values(windows).map((target) => ({ target, isIntersecting: true })) as never[], io as never);
  return {
    handle,
    options: () => {
      assert.ok(sceneOptions);
      return sceneOptions;
    },
    statics,
    windows,
    ledger,
    bus,
    globals,
    flushPaint() {
      for (let guard = 0; idle.length && guard < 500; guard++) {
        const fn = idle.shift();
        fn?.({ didTimeout: false, timeRemaining: () => 40 });
        ledger.peak = Math.max(ledger.peak, ledger.live + staticBytes());
      }
      assert.equal(idle.length, 0, "every staged paint job ran");
    },
    frame() {
      clock += 17;
      t += 0.017;
      sceneOptions?.render(live.ctx, { t, dt: 0.017, width: vw, height: vh, dpr: 1, pointer: { x: 0, y: 0, nx: 0.5, ny: 0.5, active: false, down: false, justTapped: false, type: "mouse" } });
    },
    liveDraws: () => live.draws,
    live,
  };
}

const MB = 1024 * 1024;

describe("firefly scene on the kit: teardown and memory cap", () => {
  for (const [label, dpr, capMb] of [["1440x900 DPR 1", 1, 48], ["1440x900 DPR 2", 2, 40]] as const) {
    it(`stays under ${capMb} MB of static surfaces at ${label}, plays every mechanic, and releases everything`, () => {
      const s = structuredClone(cell("1440x900/S1"));
      s.viewport.dpr = dpr;
      s.cards = s.cards.map((c, i) => (i === 0 ? { ...c, read: 0.42 } : i === 1 ? { ...c, read: 1, finished: true } : c));
      const r = rig(s);
      r.flushPaint();
      assert.equal(r.globals.__fireflyBgInitialized, true);
      for (const c of r.statics) assert.ok(c.width > 0 && c.height > 0, "every static plane is sized");
      for (let k = 0; k < 40; k++) r.frame();
      assert.ok(r.liveDraws() > 50, "the sky draws fireflies");
      for (const name of ["stage", "mid", "ground"] as const) assert.ok(r.windows[name].draws > 0, `the ${name} window draws`);
      // Mechanics: attention and perch, stage call and paddle, rhythm, pick, press, dialog.
      const open = s.cards.find((c) => c.kind === "open");
      assert.ok(open);
      r.bus.emit("hub:attention", { slug: open.slug, kind: "open", source: "focus" });
      r.bus.emit("hub:stage", { window: "stage", action: "tap" });
      r.bus.emit("hub:stage", { window: "stage", action: "left" });
      for (let k = 0; k < 3; k++) {
        r.bus.emit("hub:stage", { window: "mid", action: "tap" });
        for (let j = 0; j < 4; j++) r.frame();
      }
      r.bus.emit("hub:pick", { slug: open.slug, reason: "new", origin: "head" });
      for (let k = 0; k < 140; k++) r.frame();
      r.bus.emit("hub:press", { slug: open.slug, kind: "open" });
      r.bus.emit("hub:modal", { open: true });
      for (let k = 0; k < 5; k++) r.frame();
      r.bus.emit("hub:modal", { open: false });
      // Three resizes, each repainting the planes and windows.
      for (const [w, h] of [[1280, 800], [1440, 860], [1440, 900]]) {
        r.options().resize({ width: w, height: h, dpr: 1 }, r.statics[0].ctx);
        r.flushPaint();
        r.frame();
      }
      const peakMb = r.ledger.peak / MB;
      assert.ok(peakMb <= capMb, `peak static surfaces ${peakMb.toFixed(1)} MB at ${label}`);
      r.handle.destroy();
      assert.equal(r.ledger.live, 0, "no live surface bytes after destroy");
      assert.equal(r.ledger.created, r.ledger.released, "every surface created was released");
      for (const c of r.statics) assert.equal(c.width * c.height, 0, "static planes are released on destroy");
      assert.equal(r.live.width * r.live.height, 0, "the live canvas backing is dropped on destroy");
      assert.equal(r.globals.__fireflyBgInitialized, false);
    });
  }
});
