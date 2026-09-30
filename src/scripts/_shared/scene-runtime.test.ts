import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { backingSize, capDpr, clampDt, createNoise2D, createRng, fbm2D, isTap, MAX_DT } from "./scene-runtime";

describe("hub scene runtime helpers", () => {
  it("clamps frame dt to a 1/20 s ceiling and rejects invalid values", () => {
    assert.equal(MAX_DT, 1 / 20);
    assert.equal(clampDt(0.016), 0.016);
    assert.equal(clampDt(0.2), MAX_DT);
    assert.equal(clampDt(30), MAX_DT, "a long pause must not produce a jump");
    assert.equal(clampDt(-0.1), 0);
    assert.equal(clampDt(Number.NaN), 0);
    assert.equal(clampDt(Number.POSITIVE_INFINITY), 0);
    assert.equal(clampDt(0.5, 0.1), 0.1);
  });

  it("caps device pixel ratio and falls back to 1 for invalid input", () => {
    assert.equal(capDpr(3, 2), 2);
    assert.equal(capDpr(1.5, 2), 1.5);
    assert.equal(capDpr(2.625, 1.5), 1.5);
    assert.equal(capDpr(0, 2), 1);
    assert.equal(capDpr(Number.NaN, 2), 1);
    assert.equal(capDpr(2, 0), 1);
    assert.equal(backingSize(390.5, 2), 781);
    assert.equal(backingSize(0, 2), 1);
  });

  it("classifies short, still presses as taps", () => {
    assert.equal(isTap(3, 4, 120), true);
    assert.equal(isTap(30, 0, 120), false);
    assert.equal(isTap(0, 0, 900), false);
  });

  it("produces a deterministic PRNG stream in [0, 1)", () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const c = createRng(1235);
    const seqA = Array.from({ length: 64 }, a);
    const seqB = Array.from({ length: 64 }, b);
    const seqC = Array.from({ length: 64 }, c);
    assert.deepEqual(seqA, seqB);
    assert.notDeepEqual(seqA, seqC);
    for (const value of seqA) assert.ok(value >= 0 && value < 1);

    const rng = createRng(7);
    let sum = 0;
    const n = 20_000;
    for (let i = 0; i < n; i++) sum += rng();
    assert.ok(Math.abs(sum / n - 0.5) < 0.02, "mean should be close to 0.5");
  });

  it("keeps 2D noise deterministic, continuous and within [-1, 1]", () => {
    const noise = createNoise2D(42);
    const same = createNoise2D(42);
    const other = createNoise2D(43);
    let min = Infinity;
    let max = -Infinity;
    let differs = false;
    const rng = createRng(99);
    for (let i = 0; i < 20_000; i++) {
      const x = (rng() - 0.5) * 400;
      const y = (rng() - 0.5) * 400;
      const v = noise(x, y);
      assert.equal(v, same(x, y));
      if (v !== other(x, y)) differs = true;
      min = Math.min(min, v);
      max = Math.max(max, v);
      assert.ok(Math.abs(noise(x + 1e-4, y) - v) < 0.01, "noise must be continuous");
    }
    assert.ok(min >= -1 && max <= 1, `range [${min}, ${max}]`);
    assert.ok(max - min > 1, "noise should use most of its range");
    assert.ok(differs, "different seeds should give different fields");

    for (let i = 0; i < 2_000; i++) {
      const v = fbm2D(noise, rng() * 50, rng() * 50, 5);
      assert.ok(v >= -1 && v <= 1);
    }
  });
});
