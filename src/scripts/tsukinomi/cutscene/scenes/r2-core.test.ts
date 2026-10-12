import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BAND_RATE,
  P2,
  P3,
  P4,
  P5,
  REWIND_SPEED,
  SEASONS,
  envelope,
  fadeStep,
  hash01,
  p2Scatter,
  p2Tear,
  p2TimeFlow,
  p4Gather,
  p4LetterGlow,
  p5Season,
  phase,
  sampleTargets,
  tearBands,
} from "./r2-core";

/** Samples f over [from, to] and fails on any step larger than `maxStep`. */
function assertContinuous(f: (t: number) => number, from: number, to: number, maxStep: number, label: string) {
  let previous = f(from);
  for (let t = from + 0.01; t <= to; t += 0.01) {
    const value = f(t);
    assert.ok(Math.abs(value - previous) <= maxStep, `${label} jumps by ${Math.abs(value - previous).toFixed(3)} at ${t.toFixed(2)}`);
    previous = value;
  }
}

describe("timelines", () => {
  it("run in order and last 15 to 25 seconds", () => {
    assert.ok(P2.textInEnd < P2.dropoutStart && P2.dropoutStart < P2.dropoutEnd && P2.dropoutEnd < P2.rewindEnd && P2.rewindEnd < P2.end);
    assert.ok(P3.fadeStart < P3.end);
    assert.ok(P4.gatherStart < P4.gatherEnd && P4.gatherEnd <= P4.textInStart && P4.textInStart < P4.textInEnd && P4.textInEnd < P4.holdEnd && P4.holdEnd < P4.scatterEnd && P4.scatterEnd < P4.end);
    assert.ok(P5.textInStart < P5.threadStart && P5.threadStart < P5.threadEnd && P5.dawnStart < P5.dawnEnd && P5.dawnEnd < P5.end);
    for (const end of [P2.end, P3.end, P4.end, P5.end]) assert.ok(end >= 15 && end <= 25, String(end));
  });

  it("give the reader the epigraph early, so it can be read through the scene", () => {
    assert.ok(P2.textInEnd <= 4);
    assert.ok(P4.textInEnd <= 10);
    assert.ok(P5.textInEnd <= 5);
  });

  it("phase and envelope stay within 0..1 and handle bad input", () => {
    assert.equal(phase(Number.NaN, 0, 1), 0);
    assert.equal(phase(5, 3, 3), 1);
    assert.equal(phase(1, 3, 3), 0);
    for (const t of [-1, 0, 0.5, 2, 9]) {
      const e = envelope(t, 0, 1, 2, 3);
      assert.ok(e >= 0 && e <= 1);
    }
  });
});

describe("part 2: the tape", () => {
  it("runs forward, stops, runs backwards in the rewind and forward again", () => {
    assert.equal(p2TimeFlow(1), 1);
    assert.ok(Math.abs(p2TimeFlow(P2.dropoutEnd - 0.1)) < 0.01, "stopped before the rewind");
    const mid = p2TimeFlow((P2.dropoutEnd + P2.rewindEnd) / 2);
    assert.ok(mid < -REWIND_SPEED * 0.9, "running back fast in the middle of the rewind");
    assert.equal(p2TimeFlow(P2.end), 1);
    assertContinuous(p2TimeFlow, 0, P2.end, 0.2, "time flow");
  });

  it("scatters the letters only during the dropout and brings every one home", () => {
    assert.equal(p2Scatter(P2.textInEnd), 0);
    assert.ok(p2Scatter(P2.dropoutEnd - 0.4) > 0.95);
    assert.equal(p2Scatter(P2.rewindEnd), 0);
    assert.equal(p2Scatter(P2.end), 0);
    assertContinuous(p2Scatter, 0, P2.end, 0.1, "scatter");
  });

  it("tears only around the dropout, and the bands change at most BAND_RATE times a second", () => {
    assert.equal(p2Tear(P2.textInEnd), 0);
    assert.equal(p2Tear(P2.end - 1), 0);
    assert.ok(p2Tear((P2.dropoutStart + P2.rewindEnd) / 2) > 0.9);
    assert.deepEqual(tearBands(3, 0, hash01), []);
    let changes = 0;
    let last = JSON.stringify(tearBands(P2.dropoutStart + 1, 1, hash01));
    for (let t = P2.dropoutStart + 1; t < P2.dropoutStart + 2; t += 0.01) {
      const now = JSON.stringify(tearBands(t, 1, hash01));
      if (now !== last) changes++;
      last = now;
    }
    assert.ok(changes <= BAND_RATE, `${changes} changes in one second`);
  });

  it("keeps every band on screen and its shift small", () => {
    for (let t = P2.dropoutStart; t < P2.rewindEnd; t += 0.37) {
      for (const band of tearBands(t, 1, hash01)) {
        assert.ok(band.y >= 0 && band.y + band.h <= 1.02);
        assert.ok(Math.abs(band.shift) <= 0.05);
      }
    }
  });

  it("hashes to the unit interval, deterministically", () => {
    for (const n of [0, 1, -5, 123456, 2 ** 31]) {
      const v = hash01(n);
      assert.ok(v >= 0 && v < 1);
      assert.equal(hash01(n), v);
    }
  });
});

describe("part 3: the photograph", () => {
  it("does not fade before the sun reaches it", () => {
    assert.equal(fadeStep(0, 1, false, P3.fadeStart - 0.5), 0);
  });

  it("fades fully in fadeSeconds left alone, and holding slows it by holdSlowdown", () => {
    let free = 0;
    let held = 0;
    for (let i = 0; i < P3.fadeSeconds * 10; i++) {
      free = fadeStep(free, 0.1, false, P3.fadeStart + 1);
      held = fadeStep(held, 0.1, true, P3.fadeStart + 1);
    }
    assert.ok(free > 0.999);
    assert.ok(Math.abs(held - 1 / P3.holdSlowdown) < 0.01);
  });

  it("stays between 0 and 1 whatever it is given", () => {
    assert.equal(fadeStep(Number.NaN, 0.1, false, 9), 0.1 / P3.fadeSeconds);
    assert.equal(fadeStep(2, 0.1, false, 9), 1);
    assert.equal(fadeStep(0.5, -1, false, 9), 0.5);
  });
});

describe("part 4: the snow letters", () => {
  it("gathers, holds and lets go", () => {
    assert.equal(p4Gather(P4.gatherStart - 0.1), 0);
    assert.equal(p4Gather(P4.gatherEnd), 1);
    assert.equal(p4Gather(P4.holdEnd - 0.01), 1);
    assert.equal(p4Gather(P4.holdEnd + 0.6), 0);
    assertContinuous(p4Gather, 0, P4.end, 0.1, "gather");
  });

  it("lets the snow letters glow alone first, then dims them under the real text", () => {
    assert.equal(p4LetterGlow(P4.gatherEnd), 1);
    assert.ok(p4LetterGlow(P4.textInEnd) < 0.3);
  });

  it("samples only covered points, on the grid, and thins evenly to the cap", () => {
    const width = 20;
    const height = 10;
    const alpha = new Uint8Array(width * height);
    for (let y = 2; y < 8; y++) for (let x = 4; x < 16; x++) alpha[y * width + x] = 255;
    const all = sampleTargets(alpha, width, height, 2, 1000);
    assert.ok(all.length > 0);
    for (const p of all) assert.equal(alpha[p.y * width + p.x], 255);
    const capped = sampleTargets(alpha, width, height, 2, 5);
    assert.equal(capped.length, 5);
    assert.ok(capped[0].y <= capped[4].y, "thinned in order across the letters");
  });

  it("returns nothing for empty or mismatched input", () => {
    assert.deepEqual(sampleTargets(new Uint8Array(4), 0, 0, 2, 10), []);
    assert.deepEqual(sampleTargets(new Uint8Array(4), 10, 10, 2, 10), []);
    assert.deepEqual(sampleTargets(new Uint8Array(100).fill(255), 10, 10, 2, 0), []);
  });
});

describe("part 5: the years", () => {
  it("turns through every season, in order, and rests on winter", () => {
    const seen: string[] = [];
    for (let t = P5.yearsStart; t < P5.yearsEnd; t += 0.05) {
      const { season } = p5Season(t);
      if (seen.at(-1) !== season) seen.push(season);
    }
    assert.equal(seen.length, P5.years * SEASONS.length);
    for (let i = 0; i < seen.length; i++) assert.equal(seen[i], SEASONS[i % SEASONS.length]);
    assert.equal(p5Season(P5.yearsEnd + 1).season, "winter");
    assert.equal(p5Season(0).season, "winter");
  });

  it("gives each season at least a second, so the turning year never flickers", () => {
    assert.ok((P5.yearsEnd - P5.yearsStart) / (P5.years * SEASONS.length) >= 1);
  });

  it("eases between seasons", () => {
    for (let t = P5.yearsStart; t < P5.yearsEnd; t += 0.13) {
      const { mix } = p5Season(t);
      assert.ok(mix >= 0 && mix <= 1);
    }
  });
});
