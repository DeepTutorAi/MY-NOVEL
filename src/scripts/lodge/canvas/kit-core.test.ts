import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coverRect, luminanceRamp, platePoint } from "./kit-core";

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
