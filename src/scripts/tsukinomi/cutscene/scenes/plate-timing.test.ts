import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { splitGraphemes } from "../../../_shared/cutscene/graphemes";
import { EPIGRAPHS } from "../epigraphs";
import { FADE_MS, revealTiming, STAGGER_MS } from "./plate-timing";

describe("revealTiming", () => {
  it("adds a hold to the reveal, and the total is their sum", () => {
    const timing = revealTiming(100);
    assert.equal(timing.clusters, 100);
    assert.equal(timing.revealMs, 99 * STAGGER_MS + FADE_MS);
    assert.equal(timing.totalMs, timing.revealMs + timing.holdMs);
  });

  it("grows with the epigraph length but bounds the hold", () => {
    const short = revealTiming(10);
    const long = revealTiming(150);
    const huge = revealTiming(10_000);
    assert.ok(short.totalMs < long.totalMs);
    assert.equal(short.holdMs, 3000, "the hold has a floor");
    assert.equal(huge.holdMs, 7000, "the hold has a ceiling");
    assert.ok(long.holdMs > short.holdMs && long.holdMs < huge.holdMs);
  });

  it("handles an empty or invalid count without producing NaN", () => {
    for (const count of [0, -5, Number.NaN, 2.9]) {
      const timing = revealTiming(count);
      assert.ok(Number.isFinite(timing.totalMs) && timing.totalMs > 0, `count ${count}`);
    }
    assert.equal(revealTiming(0).revealMs, 0);
  });

  it("keeps every real epigraph under half a minute, the prologue shorter than the parts", () => {
    const totals = Object.entries(EPIGRAPHS).map(([part, text]) => ({
      part: Number(part),
      totalMs: revealTiming(splitGraphemes(text).length).totalMs,
    }));
    for (const { part, totalMs } of totals) {
      assert.ok(totalMs >= 5_000 && totalMs <= 30_000, `part ${part} runs ${totalMs} ms`);
    }
    const prologue = totals.find((entry) => entry.part === 0);
    assert.ok(prologue);
    for (const entry of totals.filter((t) => t.part !== 0)) assert.ok(prologue.totalMs < entry.totalMs);
  });
});
