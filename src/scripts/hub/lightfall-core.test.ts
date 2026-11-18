import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { createRng } from "../_shared/scene-runtime";
import { meteorShower } from "./world/calendar-core";
import { pointInRect } from "./world/geom";
import type { CardInfo, PageSnapshot } from "./world/types";
import {
  CUT_PX,
  DUST_SPEED,
  EDGE,
  LOOM_ROWS,
  PULSE_SPEED,
  RIPPLE_LIFE_S,
  SHOOTING_STAR_MAX_S,
  SHOOTING_STAR_MIN_S,
  SOURCE_PARALLAX,
  STUB_PX,
  clampLateral,
  clearanceAt,
  computeLayout,
  createNodes,
  createPairGrid,
  createRipplePool,
  ensureNodes,
  figureOrder,
  figurePattern,
  figureSlots,
  forEachPairWithin,
  heroPoolPercent,
  knotRadius,
  linkAlpha,
  litCount,
  loomRows,
  netBudget,
  nextShootingStarDelay,
  obstacles,
  reflectionRow,
  rippleAt,
  sampleRibbon,
  sampleSprings,
  sourceY,
  spawnRipple,
  springBend,
  stepRipples,
  tapStrength,
  threadAnchor,
  threadCount,
  threadSag,
  tone,
  twistAngle,
  twistAt,
} from "./lightfall-core";
import type { RibbonPath, Spring, TwistState } from "./lightfall-core";

interface Cell {
  size: { w: number; h: number };
  state: string;
  snapshot: PageSnapshot;
}

const fixtures = JSON.parse(readFileSync(join(process.cwd(), "src/scripts/hub/world/__fixtures__/page-snapshots.json"), "utf8")) as {
  cells: Record<string, Cell>;
};
const CELLS = Object.entries(fixtures.cells);
const cell = (key: string) => fixtures.cells[key].snapshot;
const HUB_1440 = cell("1440x900/S1");
const PHONE_390 = cell("390x844/S1");

const paths = (s: PageSnapshot) => {
  const L = computeLayout(s);
  const obs = obstacles(s);
  return { L, obs, paths: L.ribbons.map((r) => sampleRibbon(r, obs)) };
};

const card = (slug: string, kind: CardInfo["kind"], read: number | null, finished = false, index = 0): CardInfo => ({
  slug,
  kind,
  index,
  accent: "#E53935",
  rect: { x: 0, y: 0, w: 100, h: 100 },
  media: { x: 0, y: 0, w: 100, h: 50 },
  body: { x: 0, y: 50, w: 100, h: 50 },
  read,
  finished,
  stateText: "",
  titleTh: slug,
});

describe("fixtures", () => {
  it("cover the eight sizes with and without a reading record", () => {
    assert.equal(CELLS.length, 16);
    assert.equal(HUB_1440.mode, "desktop");
    assert.equal(PHONE_390.mode, "phone");
  });
});

describe("ribbon routing on the captured pages", () => {
  it("falls from above the screen and ends on the horizon inside the ground window", () => {
    for (const [key, c] of CELLS) {
      const { L, paths: ps } = paths(c.snapshot);
      const ground = c.snapshot.windows.ground;
      assert.ok(L.horizon > ground.y && L.horizon < ground.y + ground.h, `${key}: horizon ${L.horizon} inside the ground window`);
      const stage = c.snapshot.windows.stage;
      ps.forEach((p, r) => {
        if (r === 2 && c.snapshot.colGaps.length && stage.h > 0) {
          assert.ok(p.y[0] > stage.y && p.y[0] < stage.y + stage.h, `${key}: the centre ribbon wells up out of the star pool`);
        } else assert.ok(p.y[0] < 0, `${key} ribbon ${r}: starts above the screen`);
        if (r < 2) assert.ok(Math.abs(p.y[p.n - 1] - L.horizon) < 1, `${key} ribbon ${r}: ends on the horizon`);
      });
    }
  });

  it("keeps the full half-width plus any sway, lean or wave inside clear space wherever it is drawn", () => {
    const rng = createRng(7);
    for (const [key, c] of CELLS) {
      const { obs, paths: ps } = paths(c.snapshot);
      ps.forEach((p, r) => {
        for (let i = 0; i < p.n; i++) {
          if (p.fade[i] <= 0.02) continue;
          const nx = -p.ty[i];
          const ny = p.tx[i];
          for (const push of [-1e4, 1e4, (rng() - 0.5) * 400]) {
            const lateral = clampLateral(push, p.room[i]);
            const x = p.x[i] + nx * lateral;
            const y = p.y[i] + ny * lateral;
            const clear = clearanceAt(obs, x, y);
            assert.ok(clear >= p.half[i] + EDGE - 0.5, `${key} ribbon ${r} sample ${i}: band edge ${p.half[i].toFixed(1)} past clearance ${clear.toFixed(1)}`);
            for (const side of [-1, 1]) {
              const ex = x + nx * p.half[i] * side;
              const ey = y + ny * p.half[i] * side;
              assert.ok(!obs.some((o) => pointInRect(o, ex, ey)), `${key} ribbon ${r} sample ${i}: edge inside an obstacle`);
            }
          }
        }
      });
    }
  });

  it("runs down both desktop gutters beside every card row and down the column gap", () => {
    for (const key of ["1440x900/S0", "1440x900/S1", "1280x800/S1", "2560x1440/S1"]) {
      const s = cell(key);
      const { paths: ps } = paths(s);
      for (const row of s.rows) {
        const y = (row.top + row.bottom) / 2;
        const near = (p: RibbonPath, test: (x: number) => boolean) =>
          [...p.y].some((py, i) => Math.abs(py - y) < 20 && p.fade[i] > 0.9 && test(p.x[i]));
        assert.ok(near(ps[0], (x) => x < s.shell.x), `${key}: left ribbon beside row ${row.top}`);
        assert.ok(near(ps[1], (x) => x > s.shell.x + s.shell.w), `${key}: right ribbon beside row ${row.top}`);
        const gap = s.colGaps[0];
        assert.ok(near(ps[2], (x) => x > gap.x && x < gap.x + gap.w), `${key}: centre ribbon in the column gap at row ${row.top}`);
      }
    }
  });

  it("braids the two side ribbons across every narrow band on phones", () => {
    for (const key of ["390x844/S0", "390x844/S1", "320x568/S1", "700x560/S0"]) {
      const s = cell(key);
      const { paths: ps } = paths(s);
      const W = s.viewport.w;
      for (const band of s.bands.filter((b) => b.h <= 120)) {
        for (const p of ps.slice(0, 2)) {
          const crosses = [...p.x].some((x, i) => Math.abs(x - W / 2) < W * 0.1 && p.y[i] > band.y && p.y[i] < band.y + band.h && p.fade[i] > 0.5);
          assert.ok(crosses, `${key}: a side ribbon crosses the band at ${band.y}`);
        }
      }
    }
  });

  it("never draws the centre ribbon between the hero's text blocks, and leaves no stub at the top", () => {
    for (const [key, c] of CELLS) {
      const s = c.snapshot;
      const { L, paths: ps } = paths(s);
      const p = ps[2];
      if (s.colGaps.length) {
        for (let i = 0; i < p.n; i++) if (p.y[i] < s.windows.stage.y) assert.ok(p.fade[i] < 0.01, `${key}: centre sample at y ${p.y[i].toFixed(0)} is drawn`);
      } else {
        assert.ok(p.fade[p.n - 1] < 0.01, `${key}: the zenith wisp fades out completely`);
        for (let i = 0; i < p.n; i++) assert.ok(p.y[i] < L.topClear, `${key}: the zenith wisp stays above the top bar`);
      }
    }
  });

  it("brings the side arcs into view over the hero and turns them broadly into the gutters", () => {
    for (const key of ["1440x900/S0", "1280x800/S1", "390x844/S0", "844x390/S1"]) {
      const s = cell(key);
      const { L, paths: ps } = paths(s);
      // In short landscape the strip is only a few px tall: the arc shows over the title side only.
      const counts = ps.slice(0, 2).map((p) => {
        let seen = 0;
        for (let i = 0; i < p.n; i++) if (p.y[i] >= 0 && p.y[i] < L.topClear + 1 && p.fade[i] > 0.5) seen++;
        return seen;
      });
      assert.ok(L.compact && s.mode !== "phone" ? Math.max(...counts) >= 10 : Math.min(...counts) >= 10, `${key}: ${counts} arc samples visible in the top strip`);
    }
  });

  it("lets the source ride at 0.4 of the scroll and blend into the page by the pivot", () => {
    const L = computeLayout(HUB_1440);
    assert.equal(sourceY(L, L.apex.y, 0), L.apex.y);
    assert.ok(Math.abs(L.apex.y - SOURCE_PARALLAX * 300 - sourceY(L, L.apex.y, 300)) < 1e-6, "apex moves at the source parallax");
    assert.equal(sourceY(L, 1500, 300), 1200, "points below the pivot move with the page");
    for (let scroll = 0; scroll < (L.pivot - L.apex.y) / (1 - SOURCE_PARALLAX); scroll += 40) {
      let last = -Infinity;
      for (let y = L.apex.y; y < L.pivot + 200; y += 5) {
        const v = sourceY(L, y, scroll);
        assert.ok(v >= last - 1e-9, `scroll ${scroll}: order kept at y ${y}`);
        last = v;
      }
    }
  });

  it("aims the hero pool between the ribbons crossing the hero", () => {
    for (const [key, c] of CELLS) {
      const pct = heroPoolPercent(c.snapshot, paths(c.snapshot).paths);
      assert.ok(pct > 10 && pct < 90, `${key}: pool at ${pct}%`);
    }
  });
});

describe("falling light", () => {
  it("rolls every fold down the ribbon on all three ribbons", () => {
    for (const s of [HUB_1440, PHONE_390]) {
      for (const spec of computeLayout(s).ribbons) {
        for (let d = 0; d < 3000; d += 37) {
          for (let t = 0; t < 60; t += 3.7) {
            const dTheta = (twistAngle(spec, d + 0.5, t, 0) - twistAngle(spec, d - 0.5, t, 0)) / 1;
            const tTheta = (twistAngle(spec, d, t + 0.01, 0) - twistAngle(spec, d, t - 0.01, 0)) / 0.02;
            assert.ok(dTheta > 0 && tTheta < 0, `fold velocity ${-tTheta / dTheta} at d ${d}, t ${t}`);
          }
        }
      }
    }
  });

  it("moves dust and pulses toward larger route length, which runs down the page", () => {
    assert.ok(DUST_SPEED[0] > 0 && DUST_SPEED[1] > DUST_SPEED[0]);
    assert.ok(PULSE_SPEED > 0);
    for (const s of [HUB_1440, PHONE_390]) {
      for (const p of paths(s).paths.slice(0, 2)) {
        let down = 0;
        let up = 0;
        for (let i = 1; i < p.n; i++) {
          const dy = p.y[i] - p.y[i - 1];
          if (dy > 0) down += dy;
          else up -= dy;
        }
        assert.ok(down > 10 * up, `route mostly descends (${down.toFixed(0)} down, ${up.toFixed(0)} up)`);
      }
    }
  });

  it("is brightest at a fold and never negatively thick", () => {
    const out: TwistState = { thickness: 0, fold: 0 };
    for (let a = 0; a < Math.PI * 2; a += 0.05) {
      twistAt(a, out);
      assert.ok(out.thickness > 0 && out.thickness <= 1);
    }
    assert.ok(twistAt(Math.PI / 2, out).fold > 0.99);
    assert.ok(twistAt(0, out).fold < 0.01);
  });

  it("draws wider ribbons with more threads and drops threads by tier", () => {
    assert.ok(threadCount(40, 0) > threadCount(10, 0));
    assert.ok(threadCount(200, 0) <= 32);
    assert.ok(threadCount(200, 1) <= 24);
    assert.equal(threadCount(200, 2), 1);
  });
});

describe("springs and waves", () => {
  it("bends toward a target and settles back, stable at the longest frame", () => {
    const s: Spring = { x: 0, v: 0 };
    for (let i = 0; i < 60; i++) springBend(s, 30, 1 / 60);
    assert.ok(s.x > 20);
    for (let i = 0; i < 600; i++) springBend(s, 0, 1 / 20);
    assert.ok(Math.abs(s.x) < 0.01);
  });

  it("blends evenly between springs along a ribbon", () => {
    const springs = [{ x: 0, v: 0 }, { x: 10, v: 0 }, { x: 0, v: 0 }];
    assert.equal(sampleSprings(springs, 0), 0);
    assert.equal(sampleSprings(springs, 0.5), 10);
    assert.ok(sampleSprings(springs, 0.25) > 0 && sampleSprings(springs, 0.25) < 10);
  });

  it("runs waves both ways along the route, then frees the slot", () => {
    const pool = createRipplePool(2);
    spawnRipple(pool, 0, 1000, 1);
    stepRipples(pool, 0.5);
    assert.ok(rippleAt(pool, 0, 1190) > 0.5 && rippleAt(pool, 0, 810) > 0.5, "both wavefronts");
    assert.ok(rippleAt(pool, 0, 1000) < 0.1, "nothing left at the start");
    assert.equal(rippleAt(pool, 1, 1190), 0, "only on its own ribbon");
    stepRipples(pool, RIPPLE_LIFE_S);
    assert.equal(pool[0].active, false);
    spawnRipple(pool, 0, 1, 1);
    stepRipples(pool, 0.1);
    spawnRipple(pool, 0, 2, 1);
    spawnRipple(pool, 0, 3, 1);
    assert.equal(pool.filter((r) => r.active).length, 2, "the oldest slot is reused");
  });

  it("falls off with the distance between a tap and a ribbon", () => {
    assert.equal(tapStrength(0), 1);
    let last = 1;
    for (let d = 20; d <= 600; d += 20) {
      const k = tapStrength(d);
      assert.ok(k <= last, `not increasing at ${d}`);
      last = k;
    }
    assert.equal(tapStrength(520), 0);
    assert.ok(tapStrength(48) > 0.8, "a pluck within 48 px is near full strength");
  });
});

describe("star net", () => {
  it("seeds every node after the window grows from 800x600 to 1440x900", () => {
    const nodes = createNodes(netBudget(2560, 1440, false).maxNodes);
    const rng = createRng(3);
    const small = netBudget(800, 600, false).maxNodes;
    const big = netBudget(1440, 900, false).maxNodes;
    assert.ok(big > small);
    ensureNodes(nodes, small, rng, 800, 600);
    ensureNodes(nodes, big, rng, 1440, 900);
    assert.equal(nodes.count, big);
    for (let i = 0; i < big; i++) {
      assert.ok(nodes.size[i] > 0 && nodes.alpha[i] > 0, `node ${i} is seeded`);
      assert.ok(nodes.x[i] >= 0 && nodes.x[i] <= 1440 && nodes.y[i] >= 0 && nodes.y[i] <= 900, `node ${i} inside`);
      assert.ok(nodes.vx[i] !== 0 || nodes.vy[i] !== 0, `node ${i} drifts`);
    }
  });

  it("pulls kept nodes inside when the window shrinks", () => {
    const nodes = createNodes(100);
    const rng = createRng(5);
    ensureNodes(nodes, 80, rng, 1440, 900);
    ensureNodes(nodes, 40, rng, 400, 300);
    for (let i = 0; i < 40; i++) assert.ok(nodes.x[i] <= 400 && nodes.y[i] <= 300);
  });

  it("fades links continuously to exactly zero at the cut-off", () => {
    const r2 = 110 * 110;
    assert.equal(linkAlpha(0, r2), 1);
    assert.equal(linkAlpha(r2, r2), 0);
    assert.ok(linkAlpha(r2 * 0.999, r2) < 1e-5, "no step at the cut-off");
    let last = 1;
    for (let d2 = 0; d2 <= r2; d2 += r2 / 50) {
      const a = linkAlpha(d2, r2);
      assert.ok(a <= last);
      last = a;
    }
  });

  it("finds the same pairs as checking every pair", () => {
    const rng = createRng(11);
    const count = 90;
    const xs = Float32Array.from({ length: count }, () => rng() * 900);
    const ys = Float32Array.from({ length: count }, () => rng() * 600);
    const grid = createPairGrid(900, 600, 110, count);
    const found = new Set<string>();
    forEachPairWithin(grid, xs, ys, count, 110, (i, j) => found.add(i < j ? `${i}-${j}` : `${j}-${i}`));
    const brute = new Set<string>();
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) if (Math.hypot(xs[i] - xs[j], ys[i] - ys[j]) < 110) brute.add(`${i}-${j}`);
    assert.deepEqual([...found].sort(), [...brute].sort());
  });
});

describe("reading figures and threads", () => {
  it("lights stars to progress: none before a start, at least one after it, all when finished", () => {
    assert.equal(litCount(null, false, 9), 0);
    assert.equal(litCount(0, false, 9), 0);
    assert.equal(litCount(0.01, false, 9), 1);
    assert.equal(litCount(0.5, false, 10), 5);
    assert.equal(litCount(0.99, true, 9), 9);
  });

  it("gives each novel its own figure inside a unit box, the same on every visit", () => {
    const a = figurePattern("lodge");
    assert.deepEqual(a, figurePattern("lodge"));
    assert.notDeepEqual(a.stars, figurePattern("kusabi").stars);
    assert.ok(a.stars.length >= 8 && a.stars.length <= 13);
    for (const p of a.stars) assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
    for (const [i, j] of a.edges) assert.ok(i < a.stars.length && j < a.stars.length);
  });

  it("orders figures with the novels in progress first and the sealed ones last", () => {
    const order = figureOrder([card("u", "upcoming", null), card("a", "open", null), card("b", "open", 0.3), card("c", "open", 1, true), card("s", "locked", null)]);
    assert.deepEqual(order.map((c) => c.slug), ["b", "c", "a", "s", "u"]);
  });

  it("places sky figures in the strip above the top bar on desktop, clear of every obstacle", () => {
    for (const key of ["1440x900/S0", "1440x900/S1", "2560x1440/S1"]) {
      const s = cell(key);
      const L = computeLayout(s);
      const slots = figureSlots(s, L);
      assert.ok(slots.length >= 3, `${key}: ${slots.length} slots`);
      assert.ok(Math.abs(slots[0].x + slots[0].w / 2 - L.apex.x) < slots[0].w, `${key}: the first slot sits under the zenith`);
      for (const r of slots) assert.ok(obstacles(s).every((o) => r.x + r.w < o.x || o.x + o.w < r.x || r.y + r.h < o.y || o.y + o.h < r.y));
    }
    assert.equal(figureSlots(PHONE_390, computeLayout(PHONE_390)).length, 0, "phones show the figures in the pool");
  });

  it("hangs each card's thread from a visible ribbon point above it", () => {
    for (const [key, c] of CELLS) {
      const s = c.snapshot;
      const { paths: ps } = paths(s);
      let hung = 0;
      for (const info of s.cards) {
        const by = info.rect.y - STUB_PX - (info.kind === "locked" ? CUT_PX : 0);
        const a = threadAnchor(ps, info.rect.x + info.rect.w / 2, by, Math.max(460, s.viewport.w * 0.26));
        if (!a) continue;
        hung++;
        const p = ps[a.ribbon];
        assert.ok(p.y[a.index] < by && p.fade[a.index] >= 0.5, `${key} ${info.slug}`);
      }
      assert.ok(hung >= s.cards.length - 1, `${key}: ${hung} of ${s.cards.length} cards hang from a ribbon`);
    }
  });

  it("pulls a thread taut under tension", () => {
    assert.ok(threadSag(300, 0) > threadSag(300, 0.6));
    assert.ok(threadSag(300, 1) < 3);
  });
});

describe("loom", () => {
  const cards = [
    card("lodge", "open", 0.5, false, 0),
    card("tsukinomi", "open", null, false, 1),
    card("sea", "locked", null, false, 2),
    card("kusabi", "open", 1, true, 3),
    card("hizumi", "upcoming", null, false, 4),
    card("ruin", "upcoming", null, false, 5),
  ];

  it("weaves rows in proportion to progress, only for open novels, never more than the loom holds", () => {
    const rows = loomRows(cards);
    const by = (slug: string) => rows.filter((r) => r.slug === slug).length;
    assert.equal(by("lodge"), 2, "half of a share of four");
    assert.equal(by("tsukinomi"), 0, "not started");
    assert.equal(by("kusabi"), 4, "finished: the whole share");
    assert.equal(by("sea") + by("hizumi") + by("ruin"), 0, "sealed novels weave nothing");
    assert.ok(rows.length <= LOOM_ROWS);
    assert.equal(rows[0].slug, "lodge", "row 0 is the bottom, in reading order");
  });

  it("weaves at least one row once a novel is begun, and nothing without cards", () => {
    assert.equal(loomRows([card("x", "open", 0.001)]).length, 1);
    assert.equal(loomRows([]).length, 0);
    assert.equal(loomRows(cards.map((c) => ({ ...c, read: c.kind === "open" ? 1 : null, finished: c.kind === "open" }))).length, LOOM_ROWS);
  });

  it("grows the selvedge knots with progress and tones accents toward gold", () => {
    assert.ok(knotRadius(1) > knotRadius(0.5) && knotRadius(0.5) > knotRadius(null));
    assert.equal(tone("#e0b46a", 0.38, 1), "224,180,106");
    assert.match(tone("#00F3C5"), /^\d+,\d+,\d+$/);
  });
});

describe("ground reflection", () => {
  it("reads the unfaded source one to one below the horizon and fades with depth", () => {
    const rows = 60;
    let last = Infinity;
    for (let n = 0; n < rows; n++) {
      const r = reflectionRow(n, rows, 80);
      assert.equal(r.src, n, "no stretch");
      assert.ok(r.alpha <= last && r.alpha >= 0);
      last = r.alpha;
    }
    assert.equal(reflectionRow(90, rows, 80).src, 79, "never past the source");
  });
});

describe("shooting stars and calendar", () => {
  it("keep the original five to nine second rhythm", () => {
    assert.equal(SHOOTING_STAR_MIN_S, 5);
    assert.equal(SHOOTING_STAR_MAX_S, 9);
    const rng = createRng(1);
    for (let i = 0; i < 200; i++) {
      const d = nextShootingStarDelay(rng);
      assert.ok(d >= 5 && d <= 9);
    }
  });

  it("returns the Leonids on the evening of 2026-11-18 and nothing at noon", () => {
    assert.equal(meteorShower(new Date(2026, 10, 18, 21, 0)), "leonids");
    assert.equal(meteorShower(new Date(2026, 10, 18, 12, 0)), null);
  });
});
