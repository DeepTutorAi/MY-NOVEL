import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clockLabel, counterDigits, createFastScrollDetector, reelSizes, scrollRatio, todayStamp } from "./reader-core";

describe("reader-core", () => {
  it("measures the scroll ratio and treats a page that fits as finished", () => {
    assert.equal(scrollRatio(0, 2000, 1000), 0);
    assert.equal(scrollRatio(500, 2000, 1000), 0.5);
    assert.equal(scrollRatio(5000, 2000, 1000), 1);
    assert.equal(scrollRatio(0, 800, 1000), 1);
  });

  it("counts 000 to 999 and survives bad input", () => {
    assert.equal(counterDigits(0), "000");
    assert.equal(counterDigits(0.5), "499");
    assert.equal(counterDigits(1), "999");
    assert.equal(counterDigits(Number.NaN), "000");
  });

  it("moves the tape from the left reel to the right", () => {
    const start = reelSizes(0);
    const end = reelSizes(1);
    assert.ok(start.left > start.right);
    assert.ok(end.right > end.left);
    assert.ok(Math.abs(start.left - end.right) < 1e-9);
  });

  it("formats the clock and the day stamp", () => {
    const date = new Date(2012, 7, 4, 3, 7);
    assert.equal(clockLabel(date), "03:07");
    assert.equal(todayStamp(date), "2012-08-04");
  });

  it("flags sustained fast scrolling only", () => {
    const detect = createFastScrollDetector();
    let now = 0;
    let top = 0;
    assert.equal(detect(top, 800, now), false);
    let fired = false;
    for (let i = 0; i < 20; i += 1) {
      now += 100;
      top += 400;
      fired = detect(top, 800, now) || fired;
    }
    assert.equal(fired, true);
  });

  it("ignores normal reading speed and one long jump", () => {
    const slow = createFastScrollDetector();
    let now = 0;
    let top = 0;
    slow(top, 800, now);
    for (let i = 0; i < 40; i += 1) {
      now += 100;
      top += 30;
      assert.equal(slow(top, 800, now), false);
    }
    const jump = createFastScrollDetector();
    jump(0, 800, 0);
    assert.equal(jump(40_000, 800, 16), false);
    assert.equal(jump(40_000, 800, 1000), false);
  });
});
