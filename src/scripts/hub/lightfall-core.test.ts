import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildWindLut, isBehindCards, measureCardCover, rectDistance } from "./grimoire-core";
import type { AvoidRect } from "./grimoire-core";
import {
  FOLD_OFFSET,
  RIBBON_SAMPLES,
  RIPPLE_LIFE_S,
  SHOOTING_STAR_MAX_S,
  SHOOTING_STAR_MIN_S,
  THREAD_LAG,
  cardGapX,
  computeLayout,
  createPairGrid,
  createRipplePool,
  forEachPairWithin,
  nextShootingStarDelay,
  ribbonWidthAt,
  rippleAt,
  sampleSprings,
  spawnRipple,
  springBend,
  stepRipples,
  threadCount,
  twistAngle,
  twistAt,
} from "./lightfall-core";
import type { Spring, TwistState } from "./lightfall-core";

const SIZES: Array<[number, number]> = [
  [1440, 900],
  [1280, 800],
  [2560, 1440],
  [390, 844],
  [844, 390],
  [320, 568],
];

const HUB_1440: AvoidRect[] = [
  { x: 152, y: 117, w: 524, h: 115, soft: false },
  { x: 931, y: 152, w: 341, h: 80, soft: false },
  { x: 1006, y: 56, w: 267, h: 43, soft: false },
  { x: 152, y: 262, w: 550, h: 548, soft: true },
  { x: 722, y: 262, w: 550, h: 548, soft: true },
];

describe("lightfall layout", () => {
  it("finds the gap between the first two cards", () => {
    assert.equal(cardGapX(1440, HUB_1440), 712);
  });

  it("falls back to the centre with one column or none", () => {
    assert.equal(cardGapX(1000, []), 500);
    assert.equal(cardGapX(1000, [{ x: 20, y: 200, w: 960, h: 400, soft: true }]), 500);
  });

  it("keeps every ribbon on screen from the top down to the horizon", () => {
    for (const [w, h] of SIZES) {
      const L = computeLayout(w, h);
      assert.ok(L.horizon > h * 0.7 && L.horizon < h, `${w}x${h}: horizon ${L.horizon}`);
      for (const spec of L.ribbons) {
        const lut = buildWindLut(spec.points, RIBBON_SAMPLES);
        const last = lut.x.length - 1;
        assert.ok(lut.y[0] < 0, `${w}x${h}: a ribbon should start above the screen`);
        assert.ok(Math.abs(lut.y[last] - L.horizon) < 1, `${w}x${h}: a ribbon should end on the horizon`);
        for (let i = 0; i <= last; i++) {
          assert.ok(lut.x[i] > -spec.width && lut.x[i] < w + spec.width, `${w}x${h}: ribbon leaves the screen at x ${lut.x[i]}`);
        }
      }
    }
  });

  it("frames the cards on a wide screen instead of hiding behind them", () => {
    const L = computeLayout(1440, 900, HUB_1440);
    const [left, right] = L.ribbons;
    for (const spec of [left, right]) {
      const lut = buildWindLut(spec.points, RIBBON_SAMPLES);
      let hidden = 0;
      for (let i = 0; i < lut.x.length; i++) {
        for (const r of HUB_1440) {
          if (r.soft && rectDistance(lut.x[i], lut.y[i], r) === 0) {
            hidden++;
            break;
          }
        }
      }
      assert.equal(hidden, 0, "a side ribbon runs behind a card");
    }
  });

  it("runs above the page's text on its way to the gutters", () => {
    const L = computeLayout(1440, 900, HUB_1440);
    for (const spec of L.ribbons.slice(0, 2)) {
      const lut = buildWindLut(spec.points, RIBBON_SAMPLES);
      for (let i = 0; i < lut.x.length; i++) {
        for (const r of HUB_1440) {
          if (!r.soft) assert.ok(rectDistance(lut.x[i], lut.y[i], r) > 0, `side ribbon crosses text at ${lut.x[i]},${lut.y[i]}`);
        }
      }
    }
  });

  it("drops the centre ribbon down the gap between the cards", () => {
    const L = computeLayout(1440, 900, HUB_1440);
    const lut = buildWindLut(L.ribbons[2].points, RIBBON_SAMPLES);
    for (let i = 0; i < lut.x.length; i++) {
      if (lut.y[i] > 300) assert.ok(Math.abs(lut.x[i] - 712) < 2, `centre ribbon strays to ${lut.x[i]}`);
    }
  });

  it("scales the ribbons and budgets with the screen", () => {
    assert.ok(computeLayout(2560, 1440).ribbons[1].width > computeLayout(390, 844, [{ x: 12, y: 245, w: 366, h: 480, soft: true }]).ribbons[1].width);
    for (const [w, h] of SIZES) {
      const L = computeLayout(w, h);
      assert.ok(L.maxNodes <= 110 && L.maxDust <= 300);
    }
  });
});

describe("card cover", () => {
  const twoRows: AvoidRect[] = [
    { x: 160, y: 262, w: 550, h: 548, soft: true },
    { x: 730, y: 262, w: 550, h: 548, soft: true },
    { x: 160, y: 830, w: 550, h: 548, soft: true },
    { x: 730, y: 830, w: 550, h: 548, soft: true },
    { x: 160, y: 117, w: 500, h: 115, soft: false },
  ];

  it("spans every card and finds the gap between the columns", () => {
    assert.deepEqual(measureCardCover(twoRows), { left: 160, right: 1280, top: 262, bottom: 1378, gapLeft: 710, gapRight: 730 });
  });

  it("has nothing to hide without cards", () => {
    assert.equal(measureCardCover([]), null);
    assert.equal(isBehindCards(null, 500, 500, 0, 4), false);
  });

  it("hides only what the cards really cover", () => {
    const cover = measureCardCover(twoRows);
    assert.equal(isBehindCards(cover, 400, 500, 0, 4), true);
    assert.equal(isBehindCards(cover, 80, 500, 0, 4), false, "left gutter");
    assert.equal(isBehindCards(cover, 720, 500, 0, 4), false, "gap between the columns");
    assert.equal(isBehindCards(cover, 400, 100, 0, 4), false, "above the cards");
  });

  it("keeps a sprite that still pokes out past a card's edge", () => {
    const cover = measureCardCover(twoRows);
    assert.equal(isBehindCards(cover, 162, 500, 0, 10), false);
    assert.equal(isBehindCards(cover, 400, 264, 0, 10), false);
  });

  it("follows the cards as the page scrolls", () => {
    const cover = measureCardCover(twoRows);
    assert.equal(isBehindCards(cover, 400, 100, 400, 4), true, "scrolled up over the top band");
    assert.equal(isBehindCards(cover, 400, 1000, 400, 4), false, "below the last card");
  });

  it("treats a single column as having no gap", () => {
    const cover = measureCardCover([{ x: 12, y: 245, w: 366, h: 480, soft: true }]);
    assert.equal(isBehindCards(cover, 195, 400, 0, 4), true);
  });
});

describe("ribbon twist", () => {
  const out: TwistState = { thickness: 0, fold: 0 };

  it("never has a negative thickness, even fully twisted", () => {
    for (let theta = 0; theta < Math.PI * 4; theta += 0.01) {
      twistAt(theta, out);
      assert.ok(out.thickness >= 0.06 && out.thickness <= 1);
      assert.ok(out.fold >= 0 && out.fold <= 1);
    }
  });

  it("is brightest at a fold and quiet on the open cloth", () => {
    twistAt(0, out);
    assert.ok(out.fold < 0.01);
    twistAt(Math.PI / 2, out);
    assert.ok(out.fold > 0.99);
  });

  it("places the fold's light where the threads really cross", () => {
    const steps = 2000;
    let sum = 0;
    for (let i = 0; i <= steps; i++) {
      const a = -1 + (2 * i) / steps;
      sum += a * Math.sin(THREAD_LAG * a);
    }
    assert.ok(Math.abs(sum / (steps + 1) - FOLD_OFFSET) < 0.005, `mean offset ${sum / (steps + 1)}`);
  });

  it("stays slim across the top of the page and opens out in the gutter", () => {
    for (const spec of computeLayout(1440, 900, HUB_1440).ribbons.slice(0, 2)) {
      assert.ok(spec.openAt > 0.2 && spec.openAt < 0.8, `opens at ${spec.openAt}`);
      assert.ok(ribbonWidthAt(spec, 0) >= 0);
      assert.ok(ribbonWidthAt(spec, spec.openAt * 0.5) <= spec.topWidth * 1.14);
      assert.ok(ribbonWidthAt(spec, 1) > spec.width);
    }
  });

  it("clears the profile chip while crossing the top", () => {
    const L = computeLayout(1440, 900, HUB_1440);
    const chip = HUB_1440[2];
    const spec = L.ribbons[1];
    const lut = buildWindLut(spec.points, RIBBON_SAMPLES);
    for (let i = 0; i < lut.x.length; i++) {
      const edge = ribbonWidthAt(spec, i / (lut.x.length - 1));
      assert.ok(rectDistance(lut.x[i], lut.y[i], chip) >= Math.min(edge, 6), `ribbon touches the chip at ${lut.x[i]},${lut.y[i]}`);
    }
  });

  it("folds at uneven distances along its length", () => {
    const spec = computeLayout(1440, 900, HUB_1440).ribbons[0];
    const folds: number[] = [];
    let previous = Math.cos(twistAngle(spec, 0, 3, 0));
    for (let i = 1; i <= 2000; i++) {
      const s = i / 2000;
      const now = Math.cos(twistAngle(spec, s, 3, 0));
      if (now * previous < 0) folds.push(s);
      previous = now;
    }
    assert.ok(folds.length >= 2, `only ${folds.length} folds`);
    const gaps = folds.slice(1).map((s, i) => s - folds[i]);
    assert.ok(Math.max(...gaps) > Math.min(...gaps) * 1.4, `folds are evenly spaced: ${gaps.join(", ")}`);
  });

  it("draws wider ribbons with more threads, within limits", () => {
    const wide = computeLayout(2560, 1440).ribbons[0];
    const narrow = computeLayout(390, 844, [{ x: 12, y: 245, w: 366, h: 480, soft: true }]).ribbons[0];
    assert.ok(threadCount(wide) > threadCount(narrow));
    assert.ok(threadCount(narrow) >= 10 && threadCount(wide) <= 44);
  });
});

describe("spring bend", () => {
  it("moves towards the pointer", () => {
    const spring: Spring = { x: 0, v: 0 };
    for (let i = 0; i < 20; i++) springBend(spring, 50, 1 / 60);
    assert.ok(spring.x > 10);
  });

  it("returns to zero once the pointer has gone", () => {
    const spring: Spring = { x: 60, v: 10 };
    for (let i = 0; i < 300; i++) springBend(spring, 0, 1 / 60);
    assert.ok(Math.abs(spring.x) < 0.5, `still at ${spring.x}`);
  });

  it("stays stable at the longest frame the runtime allows", () => {
    const spring: Spring = { x: 100, v: 0 };
    for (let i = 0; i < 200; i++) springBend(spring, 0, 0.05);
    assert.ok(Math.abs(spring.x) < 1);
  });

  it("blends evenly between the springs along a ribbon", () => {
    const springs: Spring[] = [{ x: 0, v: 0 }, { x: 10, v: 0 }, { x: 0, v: 0 }];
    assert.equal(sampleSprings(springs, 0), 0);
    assert.equal(sampleSprings(springs, 0.5), 10);
    assert.equal(sampleSprings(springs, 1), 0);
  });
});

describe("node grid", () => {
  const random = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  it("finds the same pairs as checking every pair", () => {
    for (const [count, radius, seed] of [[110, 110, 7], [40, 60, 21], [200, 30, 3], [2, 500, 9]] as const) {
      const rng = random(seed);
      const xs = new Float32Array(count);
      const ys = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        xs[i] = rng() * 1440;
        ys[i] = rng() * 900;
      }
      const brute = new Set<string>();
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          if ((xs[i] - xs[j]) ** 2 + (ys[i] - ys[j]) ** 2 < radius * radius) brute.add(`${i}:${j}`);
        }
      }
      const found = new Set<string>();
      const grid = createPairGrid(1440, 900, radius, count);
      forEachPairWithin(grid, xs, ys, count, radius, (i, j) => {
        const key = `${Math.min(i, j)}:${Math.max(i, j)}`;
        assert.ok(!found.has(key), `pair ${key} was visited twice`);
        found.add(key);
      });
      assert.deepEqual([...found].sort(), [...brute].sort());
    }
  });

  it("keeps nodes that were pushed off screen", () => {
    const xs = [-30, -20];
    const ys = [950, 960];
    const grid = createPairGrid(1440, 900, 100, 2);
    let pairs = 0;
    forEachPairWithin(grid, xs, ys, 2, 100, () => pairs++);
    assert.equal(pairs, 1);
  });
});

describe("tap ripples", () => {
  it("run both ways along the ribbon, then end and free their slot", () => {
    const pool = createRipplePool(2);
    spawnRipple(pool, 1, 0.5, 1);
    stepRipples(pool, 0.5);
    assert.ok(rippleAt(pool, 1, 0.5 - 0.21) > 0.5, "the wave should have moved up");
    assert.ok(rippleAt(pool, 1, 0.5 + 0.21) > 0.5, "the wave should have moved down");
    assert.equal(rippleAt(pool, 0, 0.29), 0, "another ribbon stays still");
    stepRipples(pool, RIPPLE_LIFE_S);
    assert.ok(pool.every((r) => !r.active));
    assert.equal(rippleAt(pool, 1, 0.29), 0);
  });

  it("reuses the oldest slot instead of growing when tapped repeatedly", () => {
    const pool = createRipplePool(3);
    for (let i = 0; i < 40; i++) {
      spawnRipple(pool, 0, 0.5, 1);
      stepRipples(pool, 0.03);
    }
    assert.equal(pool.length, 3);
  });
});

describe("shooting stars", () => {
  it("keep the original five to nine second rhythm", () => {
    assert.equal(SHOOTING_STAR_MIN_S, 5);
    assert.equal(SHOOTING_STAR_MAX_S, 9);
    assert.equal(nextShootingStarDelay(() => 0), 5);
    assert.ok(nextShootingStarDelay(() => 0.999) < 9);
  });
});
