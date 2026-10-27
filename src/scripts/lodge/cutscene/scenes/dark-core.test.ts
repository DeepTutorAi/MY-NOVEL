import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DARK, darkReveal } from "./dark-core";

describe("dark timeline", () => {
  it("reveals the epigraph from 1 s to 11 s on black, then holds it before the end", () => {
    assert.equal(darkReveal(0), 0);
    assert.equal(darkReveal(DARK.revealFromS), 0);
    assert.ok(Math.abs(darkReveal(6) - 0.5) < 1e-9);
    assert.equal(darkReveal(DARK.revealToS), 1);
    assert.equal(darkReveal(DARK.endS + 5), 1);
    assert.ok(DARK.endS - DARK.revealToS >= 4, "time to read the whole epigraph");
    assert.ok(DARK.endS <= 20);
  });

  it("never runs backwards", () => {
    let previous = 0;
    for (let t = 0; t <= DARK.endS; t += 0.05) {
      const value = darkReveal(t);
      assert.ok(value >= previous);
      previous = value;
    }
  });
});
