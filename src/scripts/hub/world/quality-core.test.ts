import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CHANGE_GAP_MS,
  DOWN_FRAMES,
  DROP_WINDOW,
  UP_HOLD_MS,
  createGovernor,
  startTier,
} from "./quality-core";
import type { Governor } from "./types";

const FRAME = 1000 / 60;

/** Feeds `count` frames of `drawMs`, one vsync apart (or `intervalMs`), from `t`. Returns the clock. */
function feed(g: Governor, count: number, drawMs: number, t: number, intervalMs = FRAME): number {
  for (let i = 0; i < count; i++) {
    t += intervalMs;
    g.sample(drawMs, intervalMs, t);
  }
  return t;
}

describe("startTier", () => {
  it("starts fine pointers with many cores at full quality", () => {
    assert.equal(startTier({ coarse: false, hardwareConcurrency: 8, deviceMemory: 8 }), 0);
    assert.equal(startTier({ coarse: false, hardwareConcurrency: 16 }), 0);
  });

  it("starts coarse pointers and small devices one tier down", () => {
    assert.equal(startTier({ coarse: true, hardwareConcurrency: 8 }), 1);
    assert.equal(startTier({ coarse: false, hardwareConcurrency: 8, deviceMemory: 4 }), 1);
    assert.equal(startTier({ coarse: false, hardwareConcurrency: 4 }), 1);
  });

  it("starts Save-Data at the lowest tier", () => {
    assert.equal(startTier({ coarse: false, hardwareConcurrency: 16, saveData: true }), 2);
    assert.equal(startTier({ coarse: true, saveData: true }), 2);
  });
});

describe("governor", () => {
  it("steps down only after the EMA stays above 5 ms for 90 frames", () => {
    const g = createGovernor(0);
    let t = feed(g, DOWN_FRAMES - 1, 8, 20_000);
    assert.equal(g.tier, 0);
    t = feed(g, 1, 8, t);
    assert.equal(g.tier, 1);
    assert.ok(t > 0);
  });

  it("does not step down on a short spike", () => {
    const g = createGovernor(0);
    let t = feed(g, 200, 2, 20_000);
    t = feed(g, 20, 30, t);
    feed(g, 200, 2, t);
    assert.equal(g.tier, 0);
  });

  it("changes at most once per 10 s", () => {
    const g = createGovernor(0);
    let t = feed(g, DOWN_FRAMES, 9, 20_000);
    assert.equal(g.tier, 1);
    const changedAt = t;
    t = feed(g, Math.floor((CHANGE_GAP_MS - 100) / FRAME), 9, t);
    assert.equal(g.tier, 1, "a second step within 10 s");
    while (t - changedAt < CHANGE_GAP_MS + 2000) t = feed(g, 1, 9, t);
    assert.equal(g.tier, 2);
  });

  it("steps back up after 6 s below 2.6 ms, never above the start tier", () => {
    const g = createGovernor(1);
    let t = feed(g, DOWN_FRAMES, 9, 20_000);
    assert.equal(g.tier, 2);
    // Let the EMA fall, then hold it low.
    t = feed(g, Math.ceil((CHANGE_GAP_MS + UP_HOLD_MS) / FRAME) + 120, 1, t);
    assert.equal(g.tier, 1);
    feed(g, Math.ceil((CHANGE_GAP_MS + UP_HOLD_MS) / FRAME) * 3, 1, t);
    assert.equal(g.tier, 1, "never above the start tier");
  });

  it("needs the full 6 s hold before stepping up", () => {
    const g = createGovernor(0);
    let t = feed(g, DOWN_FRAMES, 9, 20_000);
    assert.equal(g.tier, 1);
    t = feed(g, Math.ceil(CHANGE_GAP_MS / FRAME), 4, t);
    // Hold the EMA low, then break the hold just before 6 s.
    t = feed(g, Math.floor((UP_HOLD_MS - 500) / FRAME), 1, t);
    t = feed(g, 60, 4, t);
    assert.equal(g.tier, 1);
  });

  it("steps down when frames drop while draws stay cheap, and counts drops", () => {
    const g = createGovernor(0);
    let t = feed(g, DROP_WINDOW, 1, 20_000);
    assert.equal(g.stats().dropped, 0);
    // p90 of the last 120 intervals stays on vsync while at most 11 frames drop.
    t = feed(g, 11, 1, t, FRAME * 2);
    assert.equal(g.tier, 0);
    feed(g, 1, 1, t, FRAME * 2);
    assert.equal(g.tier, 1);
    assert.equal(g.stats().dropped, 12);
  });

  it("treats long gaps as pauses, not drops", () => {
    const g = createGovernor(0);
    let t = feed(g, 30, 1, 20_000);
    t = feed(g, 1, 1, t, 5000);
    feed(g, 200, 1, t);
    assert.equal(g.stats().dropped, 0);
    assert.equal(g.tier, 0);
  });

  it("reports mean, EMA, p95 and frame count", () => {
    const g = createGovernor(0);
    let t = 20_000;
    for (let i = 0; i < 100; i++) {
      t += FRAME;
      g.sample(i < 95 ? 1 : 10, FRAME, t);
    }
    const s = g.stats();
    assert.equal(s.frames, 100);
    assert.ok(Math.abs(s.drawMsMean - 1.45) < 1e-9);
    assert.equal(s.drawMsP95, 10);
    assert.ok(s.drawMsEma > 1 && s.drawMsEma < 10);
    assert.equal(s.tier, 0);
  });
});
