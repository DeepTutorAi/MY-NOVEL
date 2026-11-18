import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { createRng } from "../_shared/scene-runtime";
import {
  FLICKER_AMP,
  FLICKER_HZ,
  LANTERN_CAP,
  PERCH_TAKEOFF_SPEED,
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
  perchLeaves,
  phaseBucket,
  placeMoon,
  stageLayout,
  stepSwing,
  tapLantern,
  visibleSpots,
  type HungLantern,
  type Light,
  type Swing,
} from "./mothlight-core";
import type { SceneOptions } from "../_shared/scene-runtime";
import { hitRect } from "./world/page-model-core";
import type { HubPlanes, PageSnapshot, Rect } from "./world/types";

const SIZES: Array<[number, number]> = [
  [1440, 900],
  [1280, 800],
  [390, 844],
  [844, 390],
  [320, 568],
  [568, 320],
  [2560, 1440],
];

const fixtures = JSON.parse(readFileSync("src/scripts/hub/world/__fixtures__/page-snapshots.json", "utf8")) as {
  cells: Record<string, { snapshot: PageSnapshot }>;
};
const cells = Object.entries(fixtures.cells);

/** The stage hit fractions mothlight.css declares (desktop, and phone or landscape-short). */
const stageFractions = (s: PageSnapshot): Rect =>
  s.mode === "phone" || s.mode === "landscape-short" ? { x: 0.08, y: 0.05, w: 0.28, h: 0.9 } : { x: 0.14, y: 0.05, w: 0.12, h: 0.9 };

describe("mothlight moon", () => {
  it("sizes the moon from the short side so it stays modest on landscape phones", () => {
    for (const [w, h] of SIZES) {
      const share = (moonRadius(Math.min(w, h)) * 2) / Math.min(w, h);
      assert.ok(share <= 0.12, `${w}x${h}: moon diameter is ${(share * 100).toFixed(1)}% of the short side`);
    }
  });

  it("keeps the moon disc inside the screen on either side", () => {
    for (const [w, h] of SIZES) {
      for (const side of ["left", "right"] as const) {
        const m = placeMoon(w, h, moonRadius(Math.min(w, h)), [], side);
        assert.ok(m.x - m.r >= 0 && m.x + m.r <= w, `${w}x${h} ${side}: moon x`);
        assert.ok(m.y - m.r >= 0 && m.y + m.r <= h, `${w}x${h} ${side}: moon y`);
        assert.equal(m.x > w / 2, side === "right", `${w}x${h}: moon on the ${side}`);
      }
    }
  });

  it("clears the chip, title and side note at scroll 0 at every fixture size, on the composed side", () => {
    for (const [name, { snapshot: s }] of cells) {
      const m = placeMoon(s.viewport.w, s.viewport.h, moonRadius(Math.min(s.viewport.w, s.viewport.h)), [...s.holes, ...s.cover], moonSide(s.mode), s.gutters.right);
      if (m.glowOnly) continue;
      const near = [...s.holes, ...s.cover].reduce((d, r) => Math.min(d, distance(m.x, m.y, r)), Infinity);
      assert.ok(near >= m.r * 1.15 - 1e-9, `${name}: moon ${near.toFixed(1)} px from text (r ${m.r.toFixed(1)})`);
      if (s.mode === "landscape-short") assert.ok(m.x < s.viewport.w / 2, `${name}: landscape-short puts the moon on the left`);
      else if (s.mode !== "phone") assert.ok(m.x > s.viewport.w / 2, `${name}: moon on the right`);
    }
  });

  it("centres the moon in a desktop gutter instead of jamming it into the corner", () => {
    const s = fixtures.cells["1440x900/S1"].snapshot;
    const m = placeMoon(1440, 900, moonRadius(900), [...s.holes, ...s.cover], "right", s.gutters.right);
    assert.equal(m.r, moonRadius(900));
    assert.ok(Math.abs(m.x - (1440 - s.gutters.right / 2)) < 12, `x ${m.x}`);
    assert.ok(m.y >= m.r * 2, `y ${m.y} leaves the top edge alone`);
  });

  it("tucks a smaller moon into a corner on a phone with no free area, without the ring", () => {
    const phoneText: Rect[] = [
      { x: 16, y: 14, w: 358, h: 44 },
      { x: 16, y: 80, w: 358, h: 150 },
      { x: 16, y: 250, w: 358, h: 60 },
    ];
    const full = moonRadius(390);
    const tucked = placeMoon(390, 844, full, phoneText, "right");
    assert.ok(tucked.r < full);
    assert.equal(tucked.ring, false);
    assert.ok(tucked.x > 0 && tucked.x < 390);
  });

  it("never cuts the disc at the screen edge: a smaller whole disc, or only the glow", () => {
    for (const [name, { snapshot: s }] of cells) {
      const { w, h } = s.viewport;
      const m = placeMoon(w, h, moonRadius(Math.min(w, h)), [...s.holes, ...s.cover], moonSide(s.mode), s.gutters.right);
      if (m.glowOnly) continue;
      assert.ok(m.x - m.r >= 0 && m.x + m.r <= w && m.y - m.r >= 0, `${name}: disc inside the screen`);
    }
    const crowded = placeMoon(320, 568, moonRadius(320), [{ x: 0, y: 0, w: 320, h: 568 }], "right");
    assert.equal(crowded.glowOnly, true);
  });

  it("orbits the moon only as far as the text allows", () => {
    const moon = placeMoon(1440, 900, 45, [], "right");
    const free = moonOrbit(moon, 40, []);
    const boxed = moonOrbit(moon, 40, [{ x: moon.x - 200, y: moon.y + 60, w: 400, h: 200 }]);
    assert.ok(boxed.ry < free.ry);
  });

  it("shapes the lit disc from the phase and caches it in 8 buckets", () => {
    assert.ok(moonShape(0).lit < 1e-9);
    assert.ok(Math.abs(moonShape(0.5).lit - 1) < 1e-9);
    assert.ok(Math.abs(moonShape(0.25).lit - 0.5) < 1e-9);
    assert.equal(moonShape(0.2).waxing, true);
    assert.equal(moonShape(0.7).waxing, false);
    assert.equal(phaseBucket(0), 0);
    assert.equal(phaseBucket(0.98), 0);
    assert.equal(phaseBucket(0.5), 4);
    for (let p = 0; p < 1; p += 0.01) assert.ok(phaseBucket(p) >= 0 && phaseBucket(p) < 8);
  });
});

describe("mothlight moths", () => {
  it("fits orbits inside the margins on every screen size", () => {
    for (const [w, h] of SIZES) {
      const margin = 16;
      for (const [x, y, rx, ry] of [
        [0, 0, 70, 70],
        [w, h, 70, 40],
        [w / 2, h / 2, w, h],
      ]) {
        const o = fitOrbit(x, y, rx, ry, w, h, margin);
        assert.ok(o.rx >= 0 && o.rx <= rx && o.ry >= 0 && o.ry <= ry);
        assert.ok(o.x - o.rx >= margin - 1e-9 && o.x + o.rx <= w - margin + 1e-9, `${w}x${h}: orbit x within margins`);
        assert.ok(o.y - o.ry >= margin - 1e-9 && o.y + o.ry <= h - margin + 1e-9, `${w}x${h}: orbit y within margins`);
      }
    }
  });

  it("uses fewer moths on small screens and drops them by tier (4-12)", () => {
    assert.ok(mothCount(390, 844, 0) < mothCount(1440, 900, 0));
    for (const [w, h] of SIZES) {
      const counts = [mothCount(w, h, 0), mothCount(w, h, 1), mothCount(w, h, 2)];
      assert.ok(counts[0] >= 4 && counts[0] <= 12, `${w}x${h}: tier 0 ${counts[0]}`);
      assert.ok(counts[1] <= 6 && counts[2] <= 4 && counts[2] >= 4, `${w}x${h}: tiers ${counts}`);
    }
    assert.ok(mothSpan(390) < mothSpan(900));
  });

  it("opens the wings fully at phase 0 and closes them to the minimum at half a beat", () => {
    assert.equal(flapOpenness(0), 1);
    assert.ok(flapOpenness(Math.PI) < 0.35, "raised wings never vanish edge-on");
    assert.ok(flapOpenness(Math.PI) > 0.25);
    assert.ok(flapOpenness(Math.PI / 2) > 0.5, "wings stay mostly spread through the stroke");
  });

  it("maps openness back to the matching flap frame", () => {
    assert.equal(frameForOpenness(1), 0);
    assert.equal(frameForOpenness(0), 6);
    for (let k = 0; k <= 6; k++) assert.equal(frameForOpenness(flapOpenness((k / 12) * Math.PI * 2)), k);
  });

  it("keeps the dorsal sprite near upright and leaning toward its heading", () => {
    for (let a = -Math.PI; a <= Math.PI; a += 0.1) assert.ok(Math.abs(displayAngle(a)) <= 0.8 + 1e-9);
    assert.ok(displayAngle(0) > 0);
    assert.ok(displayAngle(Math.PI) < 0);
    assert.ok(Math.abs(displayAngle(-Math.PI / 2)) < 1e-9, "flying straight up is upright");
  });
});

describe("mothlight light", () => {
  it("falls off as (1 - d/range)^2 and is zero at and beyond the range", () => {
    assert.equal(falloff(0, 400), 1);
    assert.ok(Math.abs(falloff(100, 400) - 0.5625) < 1e-12);
    assert.ok(Math.abs(falloff(200, 400) - 0.25) < 1e-12);
    assert.equal(falloff(400, 400), 0);
    assert.equal(falloff(900, 400), 0);
    assert.equal(falloff(10, 0), 0);
    for (let d = 0; d < 400; d += 13) assert.ok(falloff(d, 400) >= falloff(d + 13, 400), "monotonic");
  });

  it("lights a card from the light that reaches it most, from that light's side", () => {
    const card: Rect = { x: 500, y: 400, w: 400, h: 500 };
    const left: Light = { x: 380, y: 300, range: 600, power: 1 };
    const right: Light = { x: 1300, y: 700, range: 600, power: 1 };
    const a = cardLight(card, [left, right]);
    assert.equal(a.source, 0);
    assert.ok(a.lx < 0 && a.ly < 0, `light from the upper left: ${a.lx}, ${a.ly}`);
    assert.ok(Math.abs(a.glow - falloff(Math.hypot(120, 100), 600)) < 1e-12);
    const b = cardLight(card, [{ ...left, power: 0.1 }, right]);
    assert.equal(b.source, 1);
    assert.ok(b.lx > 1, "a stronger light on the right wins");
    const none = cardLight(card, [{ x: 0, y: 0, range: 50, power: 1 }]);
    assert.equal(none.source, -1);
    assert.equal(none.glow, 0);
  });

  it("lights the first card row from the stage lantern's side at every fixture size", () => {
    for (const [name, { snapshot: s }] of cells) {
      const stage = s.windows.stage;
      const hit = hitRect(stage, stageFractions(s));
      const layout = stageLayout(s.viewport.w, stage.h, { x: stage.x, y: 0, w: stage.w, h: stage.h }, { x: hit.x, y: hit.y - stage.y, w: hit.w, h: hit.h }, s.cards, createRng(1));
      const lamp = lanternPos(layout, 0);
      assert.ok(lamp.x > hit.x && lamp.x < hit.x + hit.w, `${name}: the lantern hangs inside the hit rect`);
      assert.ok(lamp.y > 0 && lamp.y < layout.bedY, `${name}: the lantern hangs above the bed`);
      const scrollY = Math.max(0, stage.y - s.viewport.h * 0.25);
      const light: Light = { x: lamp.x, y: stage.y + lamp.y - scrollY, range: 700, power: 1 };
      const firstRow = s.cards.filter((c) => s.rows[0] && Math.abs(c.rect.y - s.rows[0].top) < 8);
      for (const card of firstRow) {
        const rect = { ...card.rect, y: card.rect.y - scrollY };
        const lit = cardLight(rect, [light]);
        if (lit.source < 0) continue;
        const centre = rect.x + rect.w / 2;
        assert.equal(lit.lx < 0.5, light.x < centre, `${name} ${card.slug}: light side lx ${lit.lx.toFixed(2)}`);
        assert.ok(lit.ly < 0, `${name} ${card.slug}: light comes from above (ly ${lit.ly.toFixed(2)})`);
      }
    }
  });

  it("flickers within 12 % of full with every partial at or below 2 Hz", () => {
    let lo = 1;
    let hi = 0;
    for (let t = 0; t < 120; t += 0.01) {
      const v = flicker(t, 0.7);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    assert.ok(lo >= 1 - FLICKER_AMP - 1e-9 && hi <= 1 + 1e-9, `${lo}..${hi}`);
    assert.ok(hi - lo > FLICKER_AMP * 0.5, "it does flicker");
    for (const hz of FLICKER_HZ) assert.ok(hz <= 2);
  });

  it("lets a pushed lantern swing and settle within the swing limit", () => {
    const s: Swing = { angle: 0, vel: 2.4, spin: 0, spinVel: 9 };
    let peak = 0;
    for (let i = 0; i < 60 * 12; i++) {
      stepSwing(s, 1 / 60, 0);
      peak = Math.max(peak, Math.abs(s.angle));
    }
    assert.ok(peak > 0.2 && peak <= 0.55, `peak ${peak}`);
    assert.ok(Math.abs(s.angle) < 0.02 && Math.abs(s.spinVel) < 0.01, "settled after 12 s");
  });
});

describe("mothlight reading map", () => {
  it("maps reading to bloom: bud without reading, open from any start, full only when finished", () => {
    assert.equal(bloomOf(null, false), 0);
    assert.equal(bloomOf(0, false), 0);
    assert.ok(bloomOf(0.01, false) >= 0.25);
    assert.ok(bloomOf(1, false) < 1);
    assert.equal(bloomOf(0.4, true), 1);
    assert.equal(bloomOf(null, true), 1);
    let prev = 0;
    for (let r = 0.01; r <= 1; r += 0.01) {
      assert.ok(bloomOf(r, false) >= prev);
      prev = bloomOf(r, false);
    }
  });

  it("puts one stage moonflower per published or locked card right of the lantern", () => {
    for (const [name, { snapshot: s }] of cells) {
      const stage = s.windows.stage;
      const hit = hitRect(stage, stageFractions(s));
      const l = stageLayout(s.viewport.w, stage.h, { x: stage.x, y: 0, w: stage.w, h: stage.h }, { x: hit.x, y: 0, w: hit.w, h: hit.h }, s.cards, createRng(3));
      assert.equal(l.flowers.length, s.cards.filter((c) => c.kind !== "upcoming").length, name);
      assert.equal(l.flowers.filter((f) => f.locked).length, s.cards.filter((c) => c.kind === "locked").length, name);
      for (const f of l.flowers) {
        assert.ok(f.x > hit.x + hit.w && f.x < stage.x + stage.w, `${name}: flower x ${f.x.toFixed(0)}`);
        assert.ok(f.stem > 0 && f.stem < l.bedY, `${name}: stem fits`);
      }
    }
  });

  it("hangs one cocoon per upcoming card and keeps mid landing blooms off the window label", () => {
    const s = fixtures.cells["1440x900/S0"].snapshot;
    const mid = s.windows.mid;
    const label: Rect = { x: mid.x, y: mid.h - 50, w: 200, h: 40 };
    const l = midLayout(s.viewport.w, mid.h, { x: mid.x, y: 0, w: mid.w, h: mid.h }, [label], s.cards.filter((c) => c.kind === "upcoming"), createRng(5));
    assert.equal(l.cocoons.length, 2);
    assert.ok(l.spots.length >= 4);
    for (const p of l.spots) assert.ok(distance(p.x, p.y, label) > 18);
    assert.equal(l.slots.length, LANTERN_CAP);
    const g = groundLayout(s.viewport.w, 380, { x: 180, y: 0, w: 1080, h: 380 }, 270, createRng(2));
    assert.ok(g.ridgeY < 270 - 40 && g.lamp.y < g.ridgeY, "the lawn and its lantern stay above the footer text");
  });

  it("stands the low mid lantern clear of the window label in a short window", () => {
    const box: Rect = { x: 20, y: 0, w: 804, h: 110 };
    const label: Rect = { x: 20, y: 6, w: 230, h: 30 };
    const l = midLayout(844, 110, box, [label], [], createRng(3));
    assert.ok(l.lamp.x - 16 > label.x + label.w, `lamp x ${l.lamp.x.toFixed(0)}`);
    for (const p of l.spots) assert.ok(Math.abs(p.x - l.lamp.x) >= 28, "blooms keep off the lantern");
  });
});

describe("mothlight hung lanterns", () => {
  const size = () => ({ w: 1440, h: 220 });

  it("never hangs more than three, taking down the oldest first", () => {
    let list: HungLantern[] = [];
    for (let i = 1; i <= 8; i++) {
      list = tapLantern(list, { plane: "mid", u: i * 0.1, v: 0.4 }, i, size);
      assert.ok(list.length <= LANTERN_CAP);
    }
    assert.deepEqual(
      list.map((l) => l.id),
      [6, 7, 8],
    );
  });

  it("takes a lantern down when it is tapped again", () => {
    let list = tapLantern([], { plane: "mid", u: 0.5, v: 0.4 }, 1, size);
    list = tapLantern(list, { plane: "stage", u: 0.5, v: 0.4 }, 2, size);
    list = tapLantern(list, { plane: "mid", u: 0.505, v: 0.42 }, 3, size);
    assert.deepEqual(
      list.map((l) => l.id),
      [2],
    );
  });

  it("uses the next free slot from the keyboard, and takes down the oldest at the cap", () => {
    const slots = [0.3, 0.5, 0.7].map((u) => ({ plane: "mid" as const, u, v: 0.34 }));
    let list: HungLantern[] = [];
    for (let i = 1; i <= 3; i++) list = keyLantern(list, slots, i);
    assert.deepEqual(
      list.map((l) => l.u),
      [0.3, 0.5, 0.7],
    );
    list = keyLantern(list, slots, 4);
    assert.deepEqual(
      list.map((l) => l.id),
      [2, 3],
    );
    list = keyLantern(list, slots, 5);
    assert.equal(list.length, 3);
    assert.equal(list[2].u, 0.3, "the freed slot is used again");
  });
});

describe("mothlight perches and landing spots", () => {
  it(`takes off above ${PERCH_TAKEOFF_SPEED} px/s of scroll and 1.5 s after attention ends`, () => {
    assert.equal(perchLeaves(PERCH_TAKEOFF_SPEED - 1, true, null, 0), false);
    assert.equal(perchLeaves(PERCH_TAKEOFF_SPEED + 1, true, null, 0), true);
    assert.equal(perchLeaves(-(PERCH_TAKEOFF_SPEED + 1), true, null, 0), true);
    assert.equal(perchLeaves(0, false, 1000, 2499), false);
    assert.equal(perchLeaves(0, false, 1000, 2500), true);
    assert.equal(perchLeaves(0, false, null, 99_999), false);
    assert.equal(mayReland(true, 1000, 1999), false);
    assert.equal(mayReland(true, 1000, 2000), true);
    assert.equal(mayReland(false, 1000, 5000), false);
  });

  it("keeps only landing spots in view and under no card or panel", () => {
    for (const [name, { snapshot: s }] of cells) {
      const card = s.cards[0].rect;
      const stage = s.windows.stage;
      const spots = [
        { x: card.x + card.w / 2, y: card.y + card.h / 2 },
        { x: stage.x + stage.w * 0.86, y: stage.y + stage.h * 0.7 },
        { x: stage.x + stage.w * 0.86, y: s.viewport.h * 8 },
      ];
      for (const scrollY of [0, Math.max(0, stage.y - 40), card.y]) {
        const ok = visibleSpots(spots, s, scrollY);
        assert.ok(!ok.includes(0), `${name} at ${scrollY}: a spot under a card is never used`);
        assert.ok(!ok.includes(2), `${name} at ${scrollY}: a spot out of view is never used`);
        for (const i of ok) {
          const p = spots[i];
          assert.ok(!s.cover.some((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h), `${name}: spot ${i} uncovered`);
          assert.ok(p.y - scrollY >= 0 && p.y - scrollY <= s.viewport.h, `${name}: spot ${i} in view`);
        }
      }
      const inView = visibleSpots(spots, s, Math.max(0, stage.y + stage.h * 0.7 - s.viewport.h / 2));
      assert.ok(inView.includes(1), `${name}: a stage bloom in view is a landing spot`);
    }
  });
});

function distance(x: number, y: number, r: Rect): number {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/* ------------------------------------------------------------------ scene teardown on the kit */

/** A 2D context that accepts every call; gradients, image data and patterns are inert objects. */
function inertContext(canvas: object): CanvasRenderingContext2D {
  const inert = { addColorStop() {} };
  const own: Record<string, unknown> = { canvas };
  return new Proxy(own, {
    get(target, prop) {
      if (typeof prop === "string" && prop in target) return target[prop];
      if (prop === "createImageData") return (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (typeof prop === "string" && prop.startsWith("create")) return () => inert;
      return () => undefined;
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
}

class InertCanvas {
  width = 300;
  height = 150;
  style = { opacity: "", transition: "", transform: "", removeProperty() {} };
  dataset: Record<string, string> = {};
  private ctx = inertContext(this);
  constructor(private box = { left: 0, top: 0, width: 1440, height: 900 }) {}
  getContext() {
    return this.ctx;
  }
  getBoundingClientRect() {
    const b = this.box;
    return { ...b, x: b.left, y: b.top, right: b.left + b.width, bottom: b.top + b.height };
  }
}

class Watcher {
  disconnected = false;
  constructor(public callback: (entries: unknown[]) => void) {}
  observe() {}
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
}

describe("mothlight scene teardown", () => {
  it("releases every surface after build, staged painting, frames, three resizes and destroy", async () => {
    const g = globalThis as Record<string, unknown>;
    const saved = { document: g.document, Path2D: g.Path2D };
    g.document = { createElement: () => new InertCanvas() };
    g.Path2D = class {
      constructor() {
        return new Proxy(this, { get: (t, p) => (p in t ? (t as Record<string | symbol, unknown>)[p] : () => undefined) });
      }
    };
    try {
      const { createMothlightScene } = await import("./mothlight-scene");
      const { createBus } = await import("./world/bus");
      const s = fixtures.cells["1440x900/S1"].snapshot;
      const listeners = new Map<string, Set<(e: Event) => void>>();
      const host = {
        scrollY: 0,
        location: { search: "" },
        sessionStorage: { getItem: () => null, setItem: () => {} },
        document: { hidden: false, documentElement: { dataset: {} as Record<string, string> } },
        addEventListener(type: string, fn: (e: Event) => void) {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type)?.add(fn);
        },
        removeEventListener(type: string, fn: (e: Event) => void) {
          listeners.get(type)?.delete(fn);
        },
      };
      const watchers: Watcher[] = [];
      const factory = { created: 0, released: 0 };
      const idle = new Map<number, (d: { didTimeout: boolean; timeRemaining(): number }) => void>();
      let idleId = 0;
      let clock = 1000;
      const media = { matches: false, addEventListener() {}, removeEventListener() {} };
      const outCalls = { card: 0, root: 0, dispose: 0 };
      const bus = createBus(new EventTarget(), () => ({}));
      const ref: { options: SceneOptions | null } = { options: null };
      const live = new InertCanvas();
      const page = {
        getSnapshot: () => s,
        refresh: () => s,
        subscribe: () => () => {},
        zoneAt: () => "open" as const,
        cardAt: () => null,
        isCovered: () => false,
        holeDistance: () => Infinity,
        toViewport: (r: Rect) => r,
        dispose() {},
      };
      const globals: Record<string, unknown> = {};
      const windows = {
        stage: new InertCanvas({ left: 0, top: s.windows.stage.y, width: 1440, height: s.windows.stage.h }),
        mid: new InertCanvas({ left: 0, top: s.windows.mid.y, width: 1440, height: s.windows.mid.h }),
        ground: new InertCanvas({ left: 0, top: s.windows.ground.y, width: 1440, height: s.windows.ground.h }),
      };
      const planes = {
        root: { dataset: {} },
        live,
        statics: [0.15, 0.4, 0.4, 0.4].map((parallax) => ({ canvas: new InertCanvas(), parallax })),
        windows,
      } as unknown as HubPlanes;
      const handle = createMothlightScene(planes, {
        deps: {
          createScene: (options) => {
            ref.options = options;
            options.resize({ width: 1440, height: 900, dpr: 1 }, live.getContext());
            return { start() {}, stop() {}, destroy() {} };
          },
          ResizeObserver: Watcher as never,
          IntersectionObserver: class extends Watcher {
            constructor(cb: (entries: unknown[]) => void) {
              super(cb);
              watchers.push(this);
            }
          } as never,
          now: () => clock,
          matchMedia: () => media,
          requestAnimationFrame: () => 1,
          cancelAnimationFrame: () => {},
          requestIdle: (fn) => {
            idle.set(++idleId, fn);
            return idleId;
          },
          cancelIdle: (id) => void idle.delete(id),
          surfaceFactory: {
            surface(w: number, h: number) {
              factory.created++;
              const canvas = new InertCanvas();
              canvas.width = Math.ceil(w);
              canvas.height = Math.ceil(h);
              return { canvas: canvas as unknown as HTMLCanvasElement, g: canvas.getContext() };
            },
            release(...list: HTMLCanvasElement[]) {
              factory.released += list.length;
            },
          },
          page,
          bus,
          createOutput: () => ({
            root: () => void outCalls.root++,
            card: () => void outCalls.card++,
            heroPoolX() {},
            beat() {},
            perch: () => 1,
            unperch() {},
            label() {},
            focusCard() {},
            still() {},
            resume() {},
            dispose: () => void outCalls.dispose++,
          }),
          host: host as never,
          globals,
        },
      });
      const drain = () => {
        for (let guard = 0; guard < 200 && idle.size; guard++) {
          const run = [...idle.values()];
          idle.clear();
          for (const fn of run) fn({ didTimeout: false, timeRemaining: () => 50 });
        }
      };
      const frames = (n: number) => {
        for (let i = 0; i < n; i++) {
          clock += 17;
          ref.options?.render(live.getContext(), { t: clock / 1000, dt: 0.017, width: 1440, height: 900, dpr: 1, pointer: {} as never });
        }
      };
      assert.equal(globals.__mothlightBgInitialized, true, "the scene mounted");
      for (const w of watchers) w.callback(Object.values(windows).map((el) => ({ target: el, isIntersecting: true })));
      drain();
      frames(30);
      bus.emit("hub:attention", { slug: "lodge", kind: "open", source: "hover" });
      bus.emit("hub:stage", { window: "mid", action: "tap" });
      bus.emit("hub:stage", { window: "stage", action: "right" });
      frames(30);
      for (const [w, h] of [
        [1280, 800],
        [390, 844],
        [1440, 900],
      ]) {
        ref.options?.resize({ width: w, height: h, dpr: 1 }, live.getContext());
        drain();
        frames(5);
      }
      assert.ok(outCalls.card > 0 && outCalls.root > 0, "the scene lights cards and the page");
      assert.ok(factory.created > 10, `surfaces made: ${factory.created}`);
      handle.destroy();
      assert.equal(factory.released, factory.created, "every surface released");
      assert.equal(outCalls.dispose, 1);
      assert.equal(globals.__mothlightBgInitialized, false);
      assert.equal([...listeners.values()].reduce((n, set) => n + set.size, 0), 0, "window listeners removed");
    } finally {
      g.document = saved.document;
      g.Path2D = saved.Path2D;
    }
  });
});
