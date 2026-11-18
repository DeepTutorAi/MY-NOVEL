import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashName } from "../guest-names-core.mjs";
import {
  TAU,
  buildWindLut,
  clamp,
  fnv1a,
  isBehindCards,
  lerp,
  measureCardCover,
  measureGutters,
  pointInRect,
  rectDistance,
  rectsIntersect,
  smoothstep,
} from "./geom";
import type { AvoidRect, Vec } from "./geom";

/** The hub at 1440x900 before the theme overhaul: title, note, profile chip and a card grid. */
const HUB_1440: AvoidRect[] = [
  { x: 152, y: 117, w: 747, h: 115, soft: false },
  { x: 931, y: 152, w: 341, h: 80, soft: false },
  { x: 1006, y: 56, w: 267, h: 43, soft: false },
  { x: 152, y: 262, w: 550, h: 548, soft: true },
  { x: 722, y: 262, w: 550, h: 548, soft: true },
];

const PATH: Vec[] = [
  { x: 120, y: 760 },
  { x: 90, y: 520 },
  { x: 160, y: 240 },
  { x: 520, y: 80 },
  { x: 980, y: 140 },
  { x: 1500, y: -30 },
];

describe("geom: scalar helpers", () => {
  it("clamps, interpolates and eases", () => {
    assert.equal(clamp(-1, 0, 1), 0);
    assert.equal(clamp(2, 0, 1), 1);
    assert.equal(clamp(0.25, 0, 1), 0.25);
    assert.equal(lerp(10, 20, 0.5), 15);
    assert.equal(smoothstep(0, 1, -1), 0);
    assert.equal(smoothstep(0, 1, 2), 1);
    assert.equal(smoothstep(0, 1, 0.5), 0.5);
    assert.ok(Math.abs(TAU - 2 * Math.PI) < 1e-12);
  });

  it("hashes with FNV-1a, shared with the guest-name core", () => {
    assert.equal(fnv1a(""), 0x811c9dc5);
    assert.equal(fnv1a("pages-stars:2026-W47"), hashName("pages-stars:2026-W47"));
    assert.notEqual(fnv1a("a"), fnv1a("b"));
  });
});

describe("geom: rects", () => {
  const r = { x: 10, y: 20, w: 100, h: 50 };

  it("measures the distance from a point to a rect", () => {
    assert.equal(rectDistance(50, 40, r), 0);
    assert.equal(rectDistance(0, 40, r), 10);
    assert.equal(rectDistance(113, 74, r), 5);
  });

  it("tests points with an optional pad", () => {
    assert.ok(pointInRect(r, 10, 20));
    assert.ok(pointInRect(r, 110, 70));
    assert.ok(!pointInRect(r, 111, 70));
    assert.ok(pointInRect(r, 114, 70, 4));
    assert.ok(!pointInRect(r, 12, 30, -4));
  });

  it("tests rect overlap by interior area", () => {
    assert.ok(rectsIntersect(r, { x: 100, y: 60, w: 20, h: 20 }));
    assert.ok(!rectsIntersect(r, { x: 110, y: 20, w: 20, h: 20 }), "touching edges do not overlap");
    assert.ok(!rectsIntersect(r, { x: 0, y: 0, w: 5, h: 5 }));
  });
});

describe("geom: gutters", () => {
  it("reads the clear gutters around the cards", () => {
    const g = measureGutters(1440, 900, HUB_1440);
    assert.equal(g.left, 152);
    assert.equal(g.right, 168);
    assert.equal(g.top, 262);
  });

  it("falls back to sensible gutters when the page has no cards", () => {
    const g = measureGutters(1000, 800, []);
    assert.ok(g.left > 0 && g.right > 0 && g.top > 0);
  });
});

describe("geom: wind lookup table", () => {
  it("is continuous and evenly spaced", () => {
    const lut = buildWindLut(PATH);
    const step = lut.length / (lut.x.length - 1);
    for (let i = 1; i < lut.x.length; i++) {
      const d = Math.hypot(lut.x[i] - lut.x[i - 1], lut.y[i] - lut.y[i - 1]);
      assert.ok(d < step * 2.5, `jump of ${d} at sample ${i}`);
    }
  });

  it("starts and ends on the control points", () => {
    const lut = buildWindLut(PATH, 128);
    assert.equal(lut.x.length, 128);
    assert.ok(Math.abs(lut.x[0] - PATH[0].x) < 1e-3 && Math.abs(lut.y[0] - PATH[0].y) < 1e-3);
    const last = PATH[PATH.length - 1];
    assert.ok(Math.abs(lut.x[127] - last.x) < 1e-3 && Math.abs(lut.y[127] - last.y) < 1e-3);
  });

  it("has unit tangents", () => {
    const lut = buildWindLut(PATH);
    for (let i = 0; i < lut.x.length; i++) {
      assert.ok(Math.abs(Math.hypot(lut.tx[i], lut.ty[i]) - 1) < 0.01);
    }
  });
});

describe("geom: legacy card cover", () => {
  it("finds the two-column block and its centre gap", () => {
    const cover = measureCardCover(HUB_1440);
    assert.deepEqual(cover, { left: 152, right: 1272, top: 262, bottom: 810, gapLeft: 702, gapRight: 722 });
    assert.equal(measureCardCover([]), null);
  });

  it("hides sprites behind the cards but not in the gutters or the gap", () => {
    const cover = measureCardCover(HUB_1440);
    assert.equal(isBehindCards(cover, 400, 500, 0, 4), true);
    assert.equal(isBehindCards(cover, 80, 500, 0, 4), false);
    assert.equal(isBehindCards(cover, 712, 500, 0, 2), false);
    assert.equal(isBehindCards(cover, 400, 500, 400, 4), false, "scrolled past the cards");
    assert.equal(isBehindCards(null, 400, 500, 0, 4), false);
  });
});
