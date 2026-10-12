import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CARRIAGES,
  FREEZE_EVERY_MAX_S,
  FREEZE_EVERY_MIN_S,
  FREEZE_HOLD_S,
  PASS_INTERVAL_MAX_S,
  PASS_INTERVAL_MIN_S,
  POINTER_FREEZE_RADIUS,
  SCROLL_VEIL_MAX,
  freezeFactor,
  layoutMoonsea,
  litCarriages,
  nextFreezeDelay,
  nextPassDelay,
  petalCount,
  pointerFreeze,
  scrollVeil,
  trainNoseX,
} from "./moonsea-core";

const VIEWPORTS: Array<[number, number]> = [
  [1280, 800],
  [1920, 1080],
  [375, 812],
  [390, 844],
  [812, 375],
  [667, 375],
  [915, 412],
];

describe("layoutMoonsea", () => {
  for (const [width, height] of VIEWPORTS) {
    it(`stacks the scene in order and keeps it on screen at ${width}x${height}`, () => {
      const l = layoutMoonsea(width, height);
      // Sky over ridges over the sea of cloud over the track over the platform.
      assert.ok(l.ridgeTops[0] < l.ridgeTops[1] && l.ridgeTops[1] < l.ridgeTops[2], "ridges recede upwards");
      assert.ok(l.ridgeTops[2] < l.horizonY, "the nearest ridge rises above the sea of cloud");
      assert.ok(l.horizonY < l.railY - l.carHeight, "a whole carriage fits between the cloud and the rails");
      assert.ok(l.railY < l.platformY && l.platformY < l.groundY && l.groundY < height, "track, platform edge, then the ground the props stand on");
      // The moon is in the sky, whole, and clear of the highest ridge.
      assert.ok(l.moon.x - l.moon.r > 0 && l.moon.x + l.moon.r < width, "moon inside the width");
      assert.ok(l.moon.y - l.moon.r > 0, "moon below the top edge");
      assert.ok(l.moon.y + l.moon.r < l.ridgeTops[0], "moon above the far ridge");
      // Props stand on the ground and the lamp head stays on screen.
      assert.ok(l.lamp.y - l.lamp.postHeight > 0, "lamp head on screen");
      assert.ok(l.eaveY > 0 && l.eaveY < l.groundY, "eave between the top and the ground");
      assert.ok(l.lily.y > l.groundY && l.lily.y < height, "the lily is in the foreground");
    });
  }

  it("keeps the left of a wide screen free for the copy: every prop stands right of centre", () => {
    const l = layoutMoonsea(1280, 800);
    for (const x of [l.lamp.x, l.bench.x, l.buildingX, l.moon.x, l.sign?.x ?? Infinity]) assert.ok(x > 640, String(x));
  });

  it("drops the sign and the clock on narrow and tall screens", () => {
    for (const [width, height] of [
      [375, 812],
      [667, 375],
    ] as const) {
      const l = layoutMoonsea(width, height);
      assert.equal(l.sign, null);
      assert.equal(l.clock, null);
    }
    const wide = layoutMoonsea(1280, 800);
    assert.ok(wide.sign && wide.clock);
  });

  it("treats a zero or negative size as one pixel instead of throwing", () => {
    const l = layoutMoonsea(0, -5);
    assert.equal(l.width, 1);
    assert.equal(l.height, 1);
    assert.ok(Number.isFinite(l.moon.r));
  });
});

describe("litCarriages", () => {
  it("lights nothing for a new reader", () => {
    assert.deepEqual(litCarriages(null), [false, false, false, false, false]);
    assert.deepEqual(litCarriages(undefined), [false, false, false, false, false]);
    assert.deepEqual(litCarriages(0), [false, false, false, false, false]);
  });

  it("lights one carriage per part read, in order", () => {
    assert.deepEqual(litCarriages(1), [true, false, false, false, false]);
    assert.deepEqual(litCarriages(3), [true, true, true, false, false]);
    assert.deepEqual(litCarriages(5), [true, true, true, true, true]);
  });

  it("never lights more carriages than the train has, and ignores values that are not part numbers", () => {
    assert.equal(litCarriages(9).length, CARRIAGES);
    assert.ok(litCarriages(9).every(Boolean));
    assert.ok(!litCarriages(-2).some(Boolean));
    assert.ok(!litCarriages(2.5).some(Boolean));
    assert.ok(!litCarriages(Number.NaN).some(Boolean));
  });
});

describe("timing", () => {
  it("waits between passes within the interval, whatever the draw", () => {
    assert.equal(nextPassDelay(0), PASS_INTERVAL_MIN_S);
    assert.equal(nextPassDelay(1), PASS_INTERVAL_MAX_S);
    for (const draw of [-1, 2, Number.NaN, 0.37]) {
      const delay = nextPassDelay(draw);
      assert.ok(delay >= PASS_INTERVAL_MIN_S && delay <= PASS_INTERVAL_MAX_S, String(draw));
    }
  });

  it("stops time within its interval, whatever the draw", () => {
    for (const draw of [0, 1, -3, 7, Number.NaN, 0.5]) {
      const delay = nextFreezeDelay(draw);
      assert.ok(delay >= FREEZE_EVERY_MIN_S && delay <= FREEZE_EVERY_MAX_S, String(draw));
    }
  });

  it("eases the petals to a stop, holds them, and lets them go again without a jump", () => {
    assert.equal(freezeFactor(-1), 1);
    assert.equal(freezeFactor(0), 1);
    assert.equal(freezeFactor(0.5), 0);
    assert.equal(freezeFactor(0.35 + FREEZE_HOLD_S - 0.01), 0);
    assert.equal(freezeFactor(30), 1);
    let previous = freezeFactor(0);
    for (let s = 0.01; s < 4; s += 0.01) {
      const value = freezeFactor(s);
      assert.ok(Math.abs(value - previous) < 0.1, `continuous at ${s.toFixed(2)}`);
      previous = value;
    }
  });

  it("stops petals at the pointer and leaves the ones past the radius alone", () => {
    assert.equal(pointerFreeze(0), 0);
    assert.equal(pointerFreeze(POINTER_FREEZE_RADIUS), 1);
    assert.equal(pointerFreeze(POINTER_FREEZE_RADIUS * 3), 1);
    assert.ok(pointerFreeze(POINTER_FREEZE_RADIUS / 2) > 0 && pointerFreeze(POINTER_FREEZE_RADIUS / 2) < 1);
    assert.equal(pointerFreeze(Number.NaN), 1);
  });
});

describe("trainNoseX", () => {
  it("enters past the right edge and leaves fully past the left", () => {
    assert.ok(trainNoseX(0, 1280, 900) > 1280);
    assert.ok(trainNoseX(1, 1280, 900) + 900 < 0);
    assert.ok(trainNoseX(0.5, 1280, 900) < trainNoseX(0.4, 1280, 900), "moves left");
    assert.equal(trainNoseX(-1, 1280, 900), trainNoseX(0, 1280, 900));
    assert.equal(trainNoseX(2, 1280, 900), trainNoseX(1, 1280, 900));
  });
});

describe("scrollVeil", () => {
  it("is clear over the hero and reaches its cap a screen down", () => {
    assert.equal(scrollVeil(0, 800), 0);
    assert.equal(scrollVeil(800, 800), SCROLL_VEIL_MAX);
    assert.equal(scrollVeil(5000, 800), SCROLL_VEIL_MAX);
    const mid = scrollVeil(300, 800);
    assert.ok(mid > 0 && mid < SCROLL_VEIL_MAX);
  });

  it("is clear for values it cannot use", () => {
    assert.equal(scrollVeil(Number.NaN, 800), 0);
    assert.equal(scrollVeil(100, 0), 0);
  });
});

describe("petalCount", () => {
  it("scales with the screen within bounds", () => {
    assert.equal(petalCount(320, 480), 26);
    assert.equal(petalCount(3840, 2160), 84);
    const desktop = petalCount(1280, 800);
    assert.ok(desktop > 26 && desktop < 84);
  });
});
