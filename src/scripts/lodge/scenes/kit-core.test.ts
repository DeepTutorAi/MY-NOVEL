import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coverRect, hatchLines, luminanceRamp, platePoint } from "./kit-core";

describe("coverRect", () => {
  it("fills a portrait phone with a wide plate by height and centres it", () => {
    const rect = coverRect(1916, 821, 390, 844);
    assert.equal(rect.h, 844);
    assert.ok(rect.w >= 390);
    assert.ok(Math.abs(rect.x + rect.w / 2 - 195) < 1e-9, "centred horizontally");
    assert.equal(rect.y, 0);
  });

  it("fills a wide screen with a tall plate by width", () => {
    const rect = coverRect(1000, 1000, 1600, 800);
    assert.equal(rect.w, 1600);
    assert.equal(rect.x, 0);
    assert.equal(rect.y, -400);
  });
});

describe("platePoint", () => {
  it("maps plate fractions to canvas pixels through the cover rect", () => {
    const rect = { x: -100, y: 0, w: 1000, h: 500 };
    assert.deepEqual(platePoint(rect, 0.5, 0.5), { x: 400, y: 250 });
    assert.deepEqual(platePoint(rect, 0, 1), { x: -100, y: 500 });
  });
});

describe("luminanceRamp", () => {
  it("eases from 0 to 1 over the duration and clamps outside it", () => {
    assert.equal(luminanceRamp(0, 1), 0);
    assert.equal(luminanceRamp(0.5, 1), 0.5);
    assert.equal(luminanceRamp(1, 1), 1);
    assert.equal(luminanceRamp(-1, 1), 0);
    assert.equal(luminanceRamp(3, 1), 1);
  });

  it("never rises faster than twice the linear rate (smoothstep peak slope 1.5)", () => {
    let previous = 0;
    for (let i = 1; i <= 100; i += 1) {
      const value = luminanceRamp(i / 100, 1);
      assert.ok(value >= previous, "monotonic");
      assert.ok(value - previous <= 0.015 + 1e-9, `step ${i} rose ${value - previous}`);
      previous = value;
    }
  });
});

describe("hatchLines", () => {
  it("covers the box with parallel lines at the requested spacing", () => {
    const lines = hatchLines(100, 50, 10, Math.PI / 4);
    // The box spans |w sin a| + |h cos a| across the hatch direction.
    const across = 100 * Math.sin(Math.PI / 4) + 50 * Math.cos(Math.PI / 4);
    assert.ok(lines.length >= Math.ceil(across / 10), `${lines.length} lines for a span of ${across.toFixed(1)}`);
    for (const [x1, y1, x2, y2] of lines) {
      assert.ok(Math.abs(Math.atan2(y2 - y1, x2 - x1) - Math.PI / 4) < 1e-9, "same angle");
    }
    const hitsCentre = lines.some(([x1, y1, x2, y2]) => {
      const cross = (x2 - x1) * (25 - y1) - (y2 - y1) * (50 - x1);
      return Math.abs(cross / Math.hypot(x2 - x1, y2 - y1)) <= 5;
    });
    assert.ok(hitsCentre, "a line passes within half a spacing of the centre");
  });
});
