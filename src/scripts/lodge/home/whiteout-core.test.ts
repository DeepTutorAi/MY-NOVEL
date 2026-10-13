import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRng } from "../../_shared/scene-runtime";
import {
  FLAKE_DEPTHS,
  FLAKE_TONES,
  FOLLOW_DELAY_S,
  GUST_EVERY_S,
  PRINT_FADE_S,
  STILL_TURN_S,
  STRIDE_PX,
  flakeStyles,
  followerSteps,
  gustVeil,
  nextGustAt,
  placeSteps,
  printAlpha,
  shadowCount,
  shadowTurn,
} from "./whiteout-core";

const straight = [
  { x: 0, y: 100, t: 0 },
  { x: 340, y: 100, t: 2 },
];

describe("placeSteps", () => {
  it("places alternating prints one stride apart along the path", () => {
    const steps = placeSteps(straight, STRIDE_PX);
    assert.equal(STRIDE_PX, 34);
    assert.equal(steps.length, 10);
    assert.deepEqual(steps.slice(0, 3).map((s) => s.side), ["L", "R", "L"]);
    assert.ok(Math.abs(steps[1].x - steps[0].x - 34) < 1e-9);
    assert.ok(steps.every((s) => Math.abs(s.angle) < 1e-9), "walking right");
  });

  it("interpolates the time of each print along the path", () => {
    const steps = placeSteps(straight, STRIDE_PX);
    assert.ok(Math.abs(steps[4].t - (steps[4].x / 340) * 2) < 1e-9);
  });

  it("returns nothing for a path shorter than one stride", () => {
    assert.deepEqual(placeSteps([{ x: 0, y: 0, t: 0 }, { x: 10, y: 0, t: 1 }], STRIDE_PX), []);
  });
});

describe("printAlpha", () => {
  it("fills with snow over eight seconds", () => {
    assert.equal(PRINT_FADE_S, 8);
    assert.equal(printAlpha(0), 1);
    assert.ok(printAlpha(4) > 0 && printAlpha(4) < 1);
    assert.equal(printAlpha(8), 0);
    assert.equal(printAlpha(20), 0);
  });
});

describe("followerSteps", () => {
  const steps = placeSteps(straight, STRIDE_PX);

  it("does not follow before chapter 5 is finished or after the finale", () => {
    assert.deepEqual(followerSteps(steps, 0, 10), []);
    assert.deepEqual(followerSteps(steps, 1, 10), []);
    assert.deepEqual(followerSteps(steps, 4, 10), []);
  });

  it("retraces the reader's prints half a second late at level 2", () => {
    assert.equal(FOLLOW_DELAY_S[2], 0.5);
    const now = steps[3].t + 0.5;
    const follower = followerSteps(steps, 2, now);
    assert.equal(follower.length, 4);
    assert.ok(Math.abs(follower[3].t - now) < 1e-9);
    assert.equal(follower[3].x, steps[3].x);
  });

  it("closes the gap at level 3", () => {
    assert.ok(FOLLOW_DELAY_S[3] < FOLLOW_DELAY_S[2]);
    assert.equal(followerSteps(steps, 3, steps[3].t + FOLLOW_DELAY_S[3]).length, 4);
  });
});

describe("shadows", () => {
  it("shows seven after chapter 5 and six after chapter 12, none otherwise", () => {
    assert.deepEqual([0, 1, 2, 3, 4].map((level) => shadowCount(level as 0 | 1 | 2 | 3 | 4)), [0, 0, 7, 6, 0]);
  });

  it("turn only after the pointer has been still for three seconds, one by one", () => {
    assert.equal(STILL_TURN_S, 3);
    assert.equal(shadowTurn(2.9, 0), 0);
    assert.ok(shadowTurn(3.4, 0) > 0);
    assert.equal(shadowTurn(3.4, 3), 0, "later shadows wait their turn");
    assert.equal(shadowTurn(60, 6), 1);
  });
});

describe("gusts", () => {
  it("schedules the next gust 25 to 45 seconds later", () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i += 1) {
      const at = nextGustAt(rng, 100);
      assert.ok(at >= 100 + GUST_EVERY_S[0] && at <= 100 + GUST_EVERY_S[1]);
    }
  });

  it("rises and falls no faster than one unit per second (no flash)", () => {
    const schedule = [{ at: 5, length: 2 }];
    let previous = gustVeil(0, schedule);
    let peak = 0;
    for (let t = 0.01; t <= 10; t += 0.01) {
      const value = gustVeil(t, schedule);
      assert.ok(Math.abs(value - previous) / 0.01 <= 1 + 1e-6, `slope at ${t.toFixed(2)}`);
      peak = Math.max(peak, value);
      previous = value;
    }
    assert.ok(peak > 0.4, "the gust is visible");
    assert.equal(gustVeil(4.9, schedule), 0);
    assert.equal(gustVeil(7.1, schedule), 0);
  });
});

describe("flake styles", () => {
  it("are one per depth and tone, so every flake of a style is drawn in one stroke", () => {
    const styles = flakeStyles();
    assert.equal(styles.length, FLAKE_DEPTHS.length * FLAKE_TONES);
    FLAKE_DEPTHS.forEach((depth, d) => {
      const tones = styles.slice(d * FLAKE_TONES, (d + 1) * FLAKE_TONES);
      for (let t = 0; t < FLAKE_TONES; t += 1) {
        assert.ok(tones[t].alpha > depth.alpha[0] && tones[t].alpha < depth.alpha[1], `depth ${d} tone ${t}: ${tones[t].alpha}`);
        if (t > 0) assert.ok(tones[t].alpha > tones[t - 1].alpha, "tones rise in alpha");
        assert.equal(tones[t].width, tones[0].width, "one width per depth");
        assert.match(tones[t].color, /^rgba\(236,231,221,0\.\d+\)$/);
      }
    });
  });

  it("draw nearer flakes with a thicker pencil, never under 0.6 px", () => {
    const widths = FLAKE_DEPTHS.map((_, d) => flakeStyles()[d * FLAKE_TONES].width);
    assert.ok(widths[0] >= 0.6 && widths[0] <= widths[1] && widths[1] < widths[2], widths.join(", "));
  });
});
