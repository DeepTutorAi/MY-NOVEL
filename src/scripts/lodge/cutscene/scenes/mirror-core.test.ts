import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MIRROR, autoSelf, mergeAmount, mirrorReveal, realReveal, reflectionLag } from "./mirror-core";

describe("reflectionLag", () => {
  it("follows half a second late, then leads by a quarter second from 14 s", () => {
    assert.equal(reflectionLag(3), 0.5);
    assert.equal(reflectionLag(11.9), 0.5);
    assert.equal(reflectionLag(14), -0.25);
    assert.equal(reflectionLag(18), -0.25);
  });

  it("turns from lag to lead smoothly, never stepping", () => {
    let previous = reflectionLag(12);
    for (let t = 12.01; t <= 14; t += 0.01) {
      const value = reflectionLag(t);
      assert.ok(value <= previous + 1e-12, "only ever moves toward leading");
      assert.ok(previous - value < 0.02, `jump at ${t.toFixed(2)}`);
      previous = value;
    }
  });
});

describe("reveal", () => {
  it("lets the reflection finish its text 1.5 s before the real text", () => {
    assert.equal(mirrorReveal(MIRROR.mirrorRevealToS), 1);
    assert.equal(realReveal(MIRROR.revealToS), 1);
    assert.equal(MIRROR.revealToS - MIRROR.mirrorRevealToS, 1.5);
    assert.ok(mirrorReveal(8) > realReveal(8));
  });
});

describe("merge", () => {
  it("brings the reflection onto the real text by 17 s and ends within 20 s", () => {
    assert.equal(mergeAmount(15), 0);
    assert.equal(mergeAmount(MIRROR.mergeAtS), 1);
    assert.equal(MIRROR.mergeAtS, 17);
    assert.ok(MIRROR.endS <= 20);
  });
});

describe("autoSelf", () => {
  it("moves the reader's stand-in slowly inside the middle of the screen", () => {
    for (let t = 0; t < 20; t += 0.1) {
      const p = autoSelf(t);
      assert.ok(p.x > 0.3 && p.x < 0.7 && p.y > 0.35 && p.y < 0.65);
      const q = autoSelf(t + 0.1);
      assert.ok(Math.hypot(q.x - p.x, q.y - p.y) < 0.03, "slow");
    }
  });
});
