import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BURN_START,
  BURST_COOLDOWN_S,
  CONSTELLATION_PATTERNS,
  buildWindLut,
  canBurst,
  computeLayout,
  measureGutters,
  pageFlipPoint,
  pageLifecycle,
  pageProfile,
  projectBook,
  rectDistance,
  windEntry,
} from "./grimoire-core";
import type { AvoidRect, PageLife, Vec } from "./grimoire-core";

const SIZES: Array<[number, number]> = [
  [1440, 900],
  [1280, 800],
  [2560, 1440],
  [390, 844],
  [844, 390],
  [320, 568],
  [568, 320],
];

/** The real hub at 1440x900: title, note, profile chip and a card grid. */
const HUB_1440: AvoidRect[] = [
  { x: 152, y: 117, w: 747, h: 115, soft: false },
  { x: 931, y: 152, w: 341, h: 80, soft: false },
  { x: 1006, y: 56, w: 267, h: 43, soft: false },
  { x: 152, y: 262, w: 550, h: 548, soft: true },
  { x: 722, y: 262, w: 550, h: 548, soft: true },
];

/** The real hub at 390x844: chip, title, subtitle and a full-width card. */
const PHONE_390: AvoidRect[] = [
  { x: 110, y: 40, w: 270, h: 40, soft: false },
  { x: 12, y: 95, w: 360, h: 120, soft: false },
  { x: 12, y: 245, w: 366, h: 480, soft: true },
];

const out: Vec = { x: 0, y: 0 };

describe("grimoire layout", () => {
  it("reads the clear gutters around the cards", () => {
    const g = measureGutters(1440, 900, HUB_1440);
    assert.equal(g.left, 152);
    assert.equal(g.right, 168);
    assert.equal(g.top, 262);
  });

  it("falls back to sensible gutters when the page has no cards", () => {
    const g = measureGutters(1000, 800, []);
    assert.ok(g.left > 0 && g.right > 0 && g.top > 0);
  });

  it("keeps the book's spine on screen and its front edge above the bottom", () => {
    for (const [w, h] of SIZES) {
      const { book } = computeLayout(w, h);
      assert.ok(book.x > 0 && book.x < w, `${w}x${h}: spine x ${book.x}`);
      assert.ok(book.y > h * 0.5 && book.y < h, `${w}x${h}: book y ${book.y}`);
      assert.ok(book.x - book.w / 2 > -book.w * 0.1, `${w}x${h}: book is pushed off the left edge`);
    }
  });

  it("fits the book mostly inside a real left gutter", () => {
    const { book } = computeLayout(1440, 900, HUB_1440);
    const right = book.x + book.w / 2;
    assert.ok(book.w >= 170, `book width ${book.w}`);
    assert.ok(right - 152 < book.w * 0.3, `${Math.round(right - 152)}px of the book is behind the cards`);
  });

  it("scales particle budgets with the screen and caps them", () => {
    for (const [w, h] of SIZES) {
      const L = computeLayout(w, h);
      assert.ok(L.maxPages >= 6 && L.maxPages <= 14);
      assert.ok(L.maxDust >= 180 && L.maxDust <= 520);
    }
    assert.ok(computeLayout(390, 844).maxDust < computeLayout(1440, 900).maxDust);
  });

  it("places constellations clear of text and cards", () => {
    const L = computeLayout(1440, 900, HUB_1440);
    assert.ok(L.constellations.length >= 2, "too few constellations survive the page layout");
    for (const c of L.constellations) {
      for (const r of HUB_1440) {
        assert.ok(rectDistance(c.x, c.y, r) >= c.scale * (r.soft ? 0.9 : 0.5), `constellation at ${c.x},${c.y} touches a page rect`);
      }
    }
  });

  it("puts the moon on screen and clear of the page text when there is room", () => {
    const L = computeLayout(1440, 900, HUB_1440);
    assert.ok(L.moon.x > 0 && L.moon.x < 1440 && L.moon.y > 0 && L.moon.y < 262);
    for (const r of HUB_1440) assert.ok(rectDistance(L.moon.x, L.moon.y, r) > L.moon.r, "moon touches a page rect");
  });

  it("keeps the galaxy clear of the moon on every screen", () => {
    for (const [w, h] of SIZES) {
      const L = computeLayout(w, h, w < 500 ? PHONE_390 : []);
      const g = L.galaxies[0];
      assert.ok(Math.hypot(g.x - L.moon.x, g.y - L.moon.y) > L.moon.r + g.size * 0.5, `${w}x${h}: galaxy overlaps the moon`);
    }
  });

  it("composes phones differently from desktops", () => {
    const upright = computeLayout(390, 844, PHONE_390);
    assert.ok(upright.compact);
    assert.ok(upright.book.x > 390 * 0.3, "an upright phone centres the book a little left of the middle");
    assert.ok(upright.book.w < computeLayout(1440, 900).book.w * 1.01);
    const sideways = computeLayout(844, 390);
    assert.ok(sideways.compact);
    assert.ok(sideways.book.w <= 140, "a phone on its side keeps the book extra small");
    assert.ok(sideways.book.x < 844 * 0.15);
  });

  it("keeps the phone particle budgets from the plan", () => {
    const phone = computeLayout(390, 844);
    assert.equal(phone.maxPages, 7);
    assert.equal(phone.maxDust, 220);
  });

  it("defines constellation edges between real stars", () => {
    for (const p of CONSTELLATION_PATTERNS) {
      for (const [a, b] of p.edges) {
        assert.ok(a < p.stars.length && b < p.stars.length);
      }
    }
  });
});

describe("wind path", () => {
  it("is continuous and evenly spaced", () => {
    for (const [w, h] of SIZES) {
      const L = computeLayout(w, h);
      const lut = buildWindLut(L.wind);
      const step = lut.length / (lut.x.length - 1);
      for (let i = 1; i < lut.x.length; i++) {
        const d = Math.hypot(lut.x[i] - lut.x[i - 1], lut.y[i] - lut.y[i - 1]);
        assert.ok(d < step * 2.5, `${w}x${h}: jump of ${d} at sample ${i}`);
      }
    }
  });

  it("starts at the book and ends off the screen to the right, near the top", () => {
    const L = computeLayout(1440, 900, HUB_1440);
    const lut = buildWindLut(L.wind);
    assert.ok(Math.abs(lut.x[0] - L.book.x) < 1);
    assert.ok(lut.y[0] < L.book.y);
    const last = lut.x.length - 1;
    assert.ok(lut.x[last] > 1440);
    assert.ok(lut.y[last] < 262);
  });

  it("travels through the visible gutter and top band of the real hub", () => {
    const L = computeLayout(1440, 900, HUB_1440);
    const lut = buildWindLut(L.wind);
    let inCards = 0;
    for (let i = 0; i < lut.x.length; i++) {
      for (const r of HUB_1440) {
        if (r.soft && rectDistance(lut.x[i], lut.y[i], r) === 0) {
          inCards++;
          break;
        }
      }
    }
    assert.ok(inCards / lut.x.length < 0.08, `${inCards} of ${lut.x.length} samples are hidden behind cards`);
  });

  it("runs along the clear strip above the text on an upright phone", () => {
    const L = computeLayout(390, 844, PHONE_390);
    const lut = buildWindLut(L.wind);
    const entry = windEntry(lut, L.gutters.top);
    assert.ok(entry > 0.2 && entry < 0.95, `the wind comes out above the cards at ${entry}`);
    const last = lut.x.length - 1;
    let hidden = 0;
    let across = 0;
    for (let i = Math.round(last * 0.82); i <= last; i++) {
      if (lut.x[i] < 110 || lut.x[i] > 390) continue;
      across++;
      if (lut.y[i] > 45) hidden++;
    }
    assert.ok(across > 0 && hidden / across < 0.2, `${hidden} of ${across} top-strip samples run behind the page text`);
  });

  it("swings both ways on the way up an upright phone", () => {
    const L = computeLayout(390, 844, PHONE_390);
    const xs = L.wind.map((p) => p.x);
    assert.ok(xs[1] > xs[0] && xs[2] < xs[1], "the first bends of the path should form an S");
  });

  it("reports no hidden stretch when the path starts above the band", () => {
    assert.equal(windEntry(buildWindLut([{ x: 0, y: 10 }, { x: 50, y: 12 }, { x: 100, y: 8 }]), 60), 0);
  });

  it("has unit tangents", () => {
    const lut = buildWindLut(computeLayout(1280, 800).wind);
    for (let i = 0; i < lut.x.length; i++) {
      assert.ok(Math.abs(Math.hypot(lut.tx[i], lut.ty[i]) - 1) < 0.01);
    }
  });
});

describe("the book", () => {
  it("has a page hump beside the gutter that falls away to the edge", () => {
    assert.ok(pageProfile(0.33) > pageProfile(0));
    assert.ok(pageProfile(0.33) > pageProfile(1));
    assert.equal(pageProfile(-0.4), pageProfile(0.4));
  });

  it("projects the back of the book above and narrower than the front", () => {
    const book = computeLayout(1440, 900).book;
    const front = { ...projectBook(book, 1, 0, 0, out) };
    const back = { ...projectBook(book, 1, 1, 0, out) };
    assert.ok(back.y < front.y);
    assert.ok(back.x - book.x < front.x - book.x);
  });
});

describe("page turn", () => {
  it("keeps the spine fixed through the whole turn", () => {
    for (const p of [0, 0.2, 0.5, 0.8, 1]) {
      pageFlipPoint(0, p, out);
      assert.ok(Math.abs(out.x) < 1e-9, `spine moved at p=${p}`);
    }
  });

  it("starts flat on the right and ends flat on the left", () => {
    pageFlipPoint(1, 0, out);
    assert.ok(Math.abs(out.x - 1) < 1e-6);
    assert.ok(Math.abs(out.y - pageProfile(1)) < 1e-6);
    pageFlipPoint(1, 1, out);
    assert.ok(Math.abs(out.x + 1) < 1e-6);
    assert.ok(Math.abs(out.y - pageProfile(1)) < 1e-6);
  });

  it("lifts the page highest in the middle of the turn, with the edge lagging", () => {
    pageFlipPoint(1, 0.5, out);
    const midHeight = out.y;
    pageFlipPoint(1, 0.15, out);
    assert.ok(midHeight > out.y);
    pageFlipPoint(1, 0.5, out);
    assert.ok(out.x > 0, "the page edge should trail the spine mid-turn");
  });

  it("never leaves the page's own width", () => {
    for (let p = 0; p <= 1; p += 0.05) {
      for (let s = 0; s <= 1; s += 0.1) {
        pageFlipPoint(s, p, out);
        assert.ok(Math.abs(out.x) <= s + 1e-9);
      }
    }
  });
});

describe("page lifecycle", () => {
  const life: PageLife = { opacity: 0, burn: 0 };

  it("fades in, stays intact, then burns to the end", () => {
    pageLifecycle(0, 30, life);
    assert.equal(life.opacity, 0);
    assert.equal(life.burn, 0);
    pageLifecycle(30 * BURN_START, 30, life);
    assert.equal(life.opacity, 1);
    assert.equal(life.burn, 0);
    pageLifecycle(30, 30, life);
    assert.equal(life.burn, 1);
  });

  it("stays in range for any age", () => {
    for (let age = -5; age < 50; age += 0.5) {
      pageLifecycle(age, 30, life);
      assert.ok(life.opacity >= 0 && life.opacity <= 1);
      assert.ok(life.burn >= 0 && life.burn <= 1);
    }
  });
});

describe("repeated tapping", () => {
  it("stays well under three flashes per second", () => {
    let last = -BURST_COOLDOWN_S;
    let bursts = 0;
    for (let now = 0; now < 10; now += 0.05) {
      if (canBurst(now, last)) {
        bursts++;
        last = now;
      }
    }
    assert.ok(bursts / 10 < 3, `${bursts} bursts in 10 seconds`);
    assert.ok(bursts >= 5, "tapping should still answer regularly");
  });
});
