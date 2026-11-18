import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { createRng } from "../_shared/scene-runtime";
import {
  BACK_PHASE,
  BACK_SCALE,
  BACK_VALUE,
  BALUSTRADE,
  BAY,
  BAY_SWING,
  CARD_TINT,
  EDGE_NEAR,
  END_PANEL,
  FAMILIES,
  FOLIO,
  GALLERY,
  HIGHLIGHT_KNEE,
  LABEL_MAX,
  LADDER_LEAN,
  LEVEL,
  LEVELS,
  LIGHT,
  OBJECT_KINDS,
  PALETTE,
  PILASTER,
  RAIL_Y,
  RUNES,
  RUN_MAX,
  RUN_MIN,
  SHELF_PERIOD,
  SHELF_PITCH_MAX,
  SHELF_PITCH_MIN,
  SHELF_SPAN,
  SLOT_MAX,
  SLOT_MIN,
  SPINE_SHADES,
  SPINE_MAX,
  SPINE_MIN,
  airGlow,
  cardsForSide,
  grade,
  itemHeight,
  itemWidth,
  ladderHits,
  ladderX,
  layoutShelfStrip,
  lightAt,
  litColor,
  mixRgb,
  parseHex,
  periodCopies,
  pickKeys,
  roundRgb,
  sconceBox,
  shelfCounts,
  shelfDpr,
  shelfPlan,
  softClip,
  spineWidth,
  splitPitches,
  stripBooks,
  stripPhase,
  toHsl,
  tone,
  warmAt,
  wrapCopies,
} from "./library-core";
import type { Cell, FamilyId, Light, ObjectKind, ShelfBook, ShelfCard, ShelfPlan, ShelfStrip } from "./library-core";
import {
  BURN_START,
  BURST_COOLDOWN_S,
  BURST_MAX,
  BURST_MIN,
  FIGURES,
  INTRO_RAMP_S,
  INTRO_SWEEP_S,
  INTRO_SWEEP_START,
  PAGE_LIFE,
  PAGE_SPEED,
  TRACE_MIN_S,
  TRACE_SUMMON_S,
  TRACE_TAP_S,
  ZONE_BURN_S,
  burstCount,
  canBurst,
  draftPaths,
  figureFor,
  flicker,
  hallLayout,
  introLight,
  lecternBook,
  litStars,
  pageBecomesStar,
  pageFlipPoint,
  pageLifecycle,
  pagePool,
  pageProfile,
  panelOrder,
  placeLancets,
  projectBook,
  risePath,
  slotFor,
  stageShelf,
  traceProgress,
  tracedAtRest,
  twinkle,
} from "./library-book";
import type { PageLife } from "./library-book";
import { buildLibrary } from "./library-scene";
import { createBus } from "./world/bus";
import { fnv1a, lerp } from "./world/geom";
import { createHubScene } from "./world/kit";
import { cardAt, cardColumn, classifyMode, hitRect, holeDistance, isCovered, toViewport, zoneAt } from "./world/page-model-core";
import { rectDistance } from "./world/rect";
import type { CardInfo, HubPlanes, IdleCallback, KitDeps, Output, PageModel, PageSnapshot, Rect, Vec } from "./world/types";
import type { SceneOptions } from "../_shared/scene-runtime";

const FIXTURE = JSON.parse(readFileSync(new URL("./world/__fixtures__/page-snapshots.json", import.meta.url), "utf8")) as {
  cells: Record<string, { snapshot: PageSnapshot }>;
};

const SEEDS = [1, 7, 2026, 0x9e3779b9, 424242];

function stripsFor(cellKey: string, seed: number): ShelfStrip[] {
  const s = FIXTURE.cells[cellKey].snapshot;
  const cards = s.cards.map((c) => ({ ...c, column: cardColumn(s, c) }));
  const out: ShelfStrip[] = [];
  for (const side of ["left", "right"] as const) {
    const plan = shelfPlan(s.mode, side === "left" ? s.gutters.left : s.gutters.right, side);
    if (plan) out.push(layoutShelfStrip({ plan, seed, cards: cardsForSide(cards, side) }));
  }
  return out;
}

/** The hub's three bookcase sizes plus one wide test strip, over several seeds. */
function sampleStrips(): ShelfStrip[] {
  const out: ShelfStrip[] = [];
  for (const seed of SEEDS) {
    for (const cell of ["1280x800/S1", "1440x900/S1", "2560x1440/S1", "1440x900/S0"]) out.push(...stripsFor(cell, seed));
    out.push(layoutShelfStrip({ plan: { side: "left", width: 1440, ladder: true, lightRadius: 160, spineCap: SPINE_MAX, deep: false }, seed, cards: [] }));
  }
  return out;
}

const STRIPS = sampleStrips();
/** Every case: the near cases and their set-back stacks. */
const CASES = STRIPS.flatMap((s) => (s.back ? [s, s.back] : [s]));
const cellsOf = (k: ShelfStrip) => k.bays.flatMap((bay) => bay.cells.map((cell) => ({ bay, cell })));
const NARROW = STRIPS.filter((s) => s.width <= 120);

describe("library shelf plan", () => {
  it("puts bookcases only in narrow, desktop and wide gutters", () => {
    assert.equal(shelfPlan("phone", 400, "left"), null);
    assert.equal(shelfPlan("landscape-short", 200, "left"), null);
    assert.equal(shelfPlan("desktop", 40, "right"), null);
    const narrow = shelfPlan("narrow", 100, "left") as ShelfPlan;
    assert.equal(narrow.width, 100);
    assert.equal(narrow.ladder, false);
    assert.equal(narrow.spineCap, FOLIO, "a narrow bookcase caps spines at the folio width");
    assert.equal(shelfPlan("desktop", 180, "left")?.spineCap, SPINE_MAX);
  });

  it("gives the rolling ladder to the left strip on desktop and wide only", () => {
    assert.equal(shelfPlan("desktop", 180, "left")?.ladder, true);
    assert.equal(shelfPlan("wide", 740, "left")?.ladder, true);
    assert.equal(shelfPlan("desktop", 180, "right")?.ladder, false);
    assert.equal(shelfPlan("narrow", 100, "left")?.ladder, false);
  });

  it("sets a second, receding stack back on deep gutters only", () => {
    assert.equal(shelfPlan("wide", 740, "left")?.deep, true);
    assert.equal(shelfPlan("desktop", 180, "left")?.deep, false);
    assert.equal(shelfPlan("narrow", 100, "right")?.deep, false);
  });

  it("matches the captured fixtures: strips at 1280, 1440 and 2560, none on phones", () => {
    for (const [key, { snapshot }] of Object.entries(FIXTURE.cells)) {
      const plan = shelfPlan(snapshot.mode, snapshot.gutters.left, "left");
      const wantsShelves = key.startsWith("1280x800") || key.startsWith("1440x900") || key.startsWith("2560x1440");
      assert.equal(plan !== null, wantsShelves, key);
    }
  });

  it("assigns one tinted spine per open card to the nearer strip", () => {
    const s = FIXTURE.cells["1440x900/S1"].snapshot;
    const cards = s.cards.map((c) => ({ ...c, column: cardColumn(s, c) }));
    const left = cardsForSide(cards, "left");
    const right = cardsForSide(cards, "right");
    const open = cards.filter((c) => c.kind === "open");
    assert.equal(left.length + right.length, open.length);
    for (const c of [...left, ...right]) assert.equal(cards.find((x) => x.slug === c.slug)?.kind, "open");
    for (const c of left) assert.notEqual(cards.find((x) => x.slug === c.slug)?.column, "r");
    for (const c of right) assert.equal(cards.find((x) => x.slug === c.slug)?.column, "r");
  });
});

describe("library shelf geometry and tiling", () => {
  it("uses a period that is a whole number of device pixels at the kit's DPRs", () => {
    assert.equal(SHELF_PERIOD % 4, 0);
    assert.equal(SHELF_PERIOD, LEVEL * LEVELS);
    for (const dpr of [1, 1.1, 1.25, 1.33, 1.5, 2]) {
      const d = shelfDpr(dpr);
      assert.ok(Number.isInteger(Math.round(SHELF_PERIOD * d * 1e6) / 1e6), `dpr ${dpr}`);
      assert.ok(Math.abs(d - dpr) <= 1 / SHELF_PERIOD, `dpr ${dpr}`);
    }
  });

  it("splits a level into shelves 64-76 px apart that sum exactly", () => {
    assert.deepEqual(shelfCounts(SHELF_SPAN), [10, 11]);
    const rng = createRng(3);
    for (let i = 0; i < 200; i++) {
      const n = shelfCounts(SHELF_SPAN)[i % 2];
      const pitches = splitPitches(SHELF_SPAN, n, SHELF_PITCH_MIN, SHELF_PITCH_MAX, rng);
      assert.equal(pitches.reduce((a, b) => a + b, 0), SHELF_SPAN);
      for (const p of pitches) assert.ok(p >= SHELF_PITCH_MIN && p <= SHELF_PITCH_MAX, `pitch ${p}`);
    }
  });

  it("lays every level's shelves contiguously from under the slab to the next level's floor", () => {
    for (const k of CASES) {
      for (const { cell } of cellsOf(k)) {
        const cs = cell.compartments;
        assert.equal(cs[0].top, cell.level * k.level + GALLERY);
        const tops = [...cs.map((c) => c.top), (cell.level + 1) * k.level + BALUSTRADE];
        for (let i = 0; i < cs.length; i++) {
          const pitch = tops[i + 1] - tops[i];
          assert.ok(pitch >= SHELF_PITCH_MIN && pitch <= SHELF_PITCH_MAX, `pitch ${pitch}`);
          assert.ok(cs[i].floor > cs[i].top);
        }
        assert.equal(cs[cs.length - 1].floor, (cell.level + 1) * k.level + BALUSTRADE - 2);
      }
    }
  });

  it("draws what crosses the period boundary twice, so the tile wraps without a seam", () => {
    assert.deepEqual(wrapCopies(10, 100, 1480), [0]);
    assert.deepEqual(wrapCopies(1400, 1500, 1480), [0, -1480]);
    assert.deepEqual(wrapCopies(-20, 30, 1480), [0, 1480]);
    for (const k of CASES) {
      assert.ok(Math.abs(k.period * k.scale - SHELF_PERIOD) < 1e-9, "every case repeats with the tile");
      for (const { cell } of cellsOf(k)) {
        for (const c of cell.compartments) {
          assert.ok(c.top >= 0, "nothing starts above the tile");
          if (c.floor > k.period) assert.deepEqual(wrapCopies(c.top, c.floor, k.period), [0, -k.period]);
        }
      }
      if (k.ladder) assert.ok(k.ladder.bottom <= k.period, "the ladder stays inside one tile");
    }
  });

  it("offsets the right strip so the two strips' galleries never line up", () => {
    for (const seed of [...SEEDS, 3, 4, 5, 6]) {
      const right = stripPhase("right", seed);
      assert.equal(right % 4, 0, "a multiple of 4 px");
      assert.ok(right >= 0.3 * LEVEL - 2 && right <= 0.7 * LEVEL + 2, `phase ${right}`);
      for (const left of [stripPhase("left", seed), stripPhase("left", seed, true)]) {
        const gap = (((right - left) % LEVEL) + LEVEL) % LEVEL;
        assert.ok(Math.min(gap, LEVEL - gap) >= 0.3 * LEVEL - 2, `galleries ${gap} px apart`);
      }
    }
    for (const seed of SEEDS) {
      for (const strip of stripsFor("1440x900/S1", seed)) assert.equal(strip.phase, stripPhase(strip.side, seed, strip.ladder !== null));
    }
    assert.equal(stripPhase("left", 9, true), LEVEL, "a strip with a ladder opens on its second level");
    assert.equal(stripPhase("left", 9), 0);
  });

  it("keeps the sconce light periodic across the boundary", () => {
    const strip = STRIPS.find((s) => s.sconces.length > 0) as ShelfStrip;
    for (const [x, y] of [
      [20, 3],
      [60, 700],
      [90, 1470],
    ]) {
      assert.ok(Math.abs(warmAt(strip, x, y) - warmAt(strip, x, y + strip.period)) < 1e-9);
      assert.ok(Math.abs(warmAt(strip, x, y) - warmAt(strip, x, y - strip.period)) < 1e-9);
    }
    const s = strip.sconces[0];
    assert.ok(warmAt({ sconces: [s], period: strip.period }, s.x, s.y) > 0.99);
    assert.equal(warmAt({ sconces: [s], period: strip.period }, s.x + s.radius + 1, s.y), 0);
  });

  it("keeps every item inside its bay and compartment, without overlaps", () => {
    for (const k of CASES) {
      for (const { bay, cell } of cellsOf(k)) {
        for (const c of cell.compartments) {
          let end = -Infinity;
          for (const item of c.items) {
            assert.ok(item.x >= bay.x0 - 1e-9, "inside the bay on the left");
            assert.ok(item.x + itemWidth(item) <= bay.x1 + 1e-9, "inside the bay on the right");
            assert.ok(itemHeight(item) <= c.floor - c.top, "below the board above");
            assert.ok(item.x >= end - 1e-9, "no overlap");
            end = item.x + itemWidth(item);
          }
        }
      }
    }
  });
});

describe("library shelf depth on wide gutters", () => {
  const deep = STRIPS.filter((s) => s.back !== null);

  it("sets a smaller, dimmer stack back on the inner side, beside the near case's end panel", () => {
    assert.ok(deep.length >= 10);
    for (const s of deep) {
      const b = s.back as ShelfStrip;
      assert.equal(b.scale, BACK_SCALE);
      assert.ok(Math.abs(b.level * b.scale - LEVEL) < 1e-9, "its galleries share the near case's period");
      const bx0 = b.originX;
      const bx1 = b.originX + b.width * b.scale;
      assert.ok(Math.abs((s.side === "left" ? bx1 : bx0) - (s.side === "left" ? s.width : 0)) < 1e-6, "the stack reaches the cards");
      assert.equal(s.endPanel, s.side === "left" ? s.x1 : s.x0 - END_PANEL);
      const panel = s.endPanel as number;
      assert.ok(Math.abs((s.side === "left" ? panel + END_PANEL : panel) - (s.side === "left" ? bx0 : bx1)) < 1e-6, "the end panel meets the stack");
      assert.equal(b.sconces.length + b.slots.length + b.spines.length, 0, "no sconces, slots or card spines set back");
      assert.equal(b.ladder, null);
      for (const { cell } of cellsOf(b)) assert.notEqual(cell.key, "candle");
      assert.ok(s.bays.length >= 3 && b.bays.length >= 3);
    }
  });

  it("alternates bay widths by up to 12 %, so the wall is not an even grid", () => {
    for (const k of CASES) {
      const full = k.bays.filter((b) => b.x0 >= k.x0 && b.x1 <= k.x1);
      for (const b of full) {
        const w = b.x1 - b.x0;
        if (k.bays.length > 1) assert.ok(w >= Math.floor(BAY * (1 - BAY_SWING)) && w <= Math.ceil(BAY * (1 + BAY_SWING)), `bay ${w}`);
      }
      for (let i = 1; i < k.bays.length - 1; i++) {
        const a = k.bays[i - 1].x1 - k.bays[i - 1].x0;
        const b = k.bays[i].x1 - k.bays[i].x0;
        const c = k.bays[i + 1].x1 - k.bays[i + 1].x0;
        assert.ok(Math.sign(b - a) === -Math.sign(c - b) && b !== a, "wider and narrower bays alternate");
      }
    }
  });

  it("keeps one bay on screen with its outer upright visible in a narrow gutter", () => {
    for (const s of NARROW) {
      assert.equal(s.bays.length, 1);
      const outer = s.uprights[1];
      assert.ok(outer.x >= 0 && outer.x + outer.w <= s.width);
    }
  });
});

describe("library shelf gate: not a barcode", () => {
  const plainBooks = CASES.flatMap((k) => [...stripBooks(k)].filter(({ book }) => book.card === null).map(({ book }) => book));
  const uprights = plainBooks.filter((b) => b.lean === 0).map((b) => b.w);

  it("draws spine widths from a long-tailed distribution", () => {
    const rng = createRng(11);
    const samples = Array.from({ length: 20000 }, () => spineWidth(rng)).sort((a, b) => a - b);
    const q = (p: number) => samples[Math.floor(p * (samples.length - 1))];
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    assert.ok(q(0) >= SPINE_MIN && q(1) <= SPINE_MAX);
    assert.ok(q(0.5) >= 8 && q(0.5) <= 10, `median ${q(0.5)}`);
    assert.ok(mean > q(0.5), "skewed toward wide spines");
    assert.ok(q(0.95) >= 1.7 * q(0.5), `p95 ${q(0.95)}`);
    assert.ok(q(0.99) >= 2.4 * q(0.5), `p99 ${q(0.99)}`);
    assert.ok(q(0.05) <= 0.62 * q(0.5), `p05 ${q(0.05)}`);
  });

  it("shelves books with that spread of widths", () => {
    const sorted = [...uprights].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    assert.ok(sorted.length > 2000);
    assert.ok(sorted[Math.floor(sorted.length * 0.95)] >= 1.6 * median);
    assert.ok(new Set(sorted).size >= 18, "many distinct widths");
  });

  it("allows one folio wider than 22 px per shelf, none in a narrow bookcase", () => {
    for (const k of CASES) {
      const narrow = NARROW.includes(k);
      for (const { cell } of cellsOf(k)) {
        for (const c of cell.compartments) {
          const folios = c.items.filter((it) => it.kind === "book" && it.w > FOLIO).length;
          assert.ok(folios <= (narrow ? 0 : 1), `${folios} folios on a shelf`);
        }
      }
    }
    assert.ok(uprights.some((w) => w > FOLIO), "folios still occur");
  });

  it("keeps title label panels to narrow spines", () => {
    for (const b of plainBooks) if (b.gilt === "label") assert.ok(b.w <= LABEL_MAX, `label on a ${b.w} px spine`);
  });

  it("never lines up four identical spines in a row", () => {
    for (const k of CASES) {
      for (const { cell } of cellsOf(k)) {
        for (const c of cell.compartments) {
          let run = 1;
          for (let i = 1; i < c.items.length; i++) {
            const a = c.items[i - 1];
            const b = c.items[i];
            const same = a.kind === "book" && b.kind === "book" && a.w === b.w && a.h === b.h && a.family === b.family;
            run = same ? run + 1 : 1;
            assert.ok(run < 4);
          }
        }
      }
    }
  });

  it("uses exactly three colour families per bay level, led by the dominant one", () => {
    for (const k of CASES) {
      for (const { cell } of cellsOf(k)) {
        const counts = new Map<FamilyId, number>();
        for (const c of cell.compartments) {
          for (const item of c.items) {
            const fams = item.kind === "book" ? [item.family] : item.kind === "stack" ? item.books.map((b) => b.family) : [];
            for (const f of fams) counts.set(f, (counts.get(f) ?? 0) + 1);
          }
        }
        assert.equal(new Set(cell.families).size, 3);
        for (const f of counts.keys()) assert.ok(cell.families.includes(f), `${f} outside the cell's families`);
        const total = [...counts.values()].reduce((a, b) => a + b, 0);
        if (total >= 12) assert.equal(counts.size, 3, "all three families appear");
        if (total >= 40) assert.ok((counts.get(cell.families[0]) ?? 0) >= (counts.get(cell.families[2]) ?? 0));
      }
    }
  });

  it("changes the dominant family between neighbouring bays and levels", () => {
    for (const k of CASES) {
      k.bays.forEach((bay, i) => {
        bay.cells.forEach((cell, l) => {
          const left = k.bays[i - 1]?.cells[l];
          if (left) assert.notEqual(cell.families[0], left.families[0]);
          if (l > 0) assert.notEqual(cell.families[0], bay.cells[l - 1].families[0]);
        });
      });
    }
  });

  it("gilds about 30 % of books", () => {
    const gilt = plainBooks.filter((b) => b.gilt !== "none").length / plainBooks.length;
    assert.ok(gilt >= 0.25 && gilt <= 0.35, `gilt share ${gilt.toFixed(3)}`);
  });

  it("breaks the rows with a lean or a stack every 5-9 upright books", () => {
    let runs = 0;
    for (const k of CASES) {
      for (const bay of k.bays) {
        let count = 0;
        let seenBreak = false;
        for (const cell of bay.cells) {
          for (const c of cell.compartments) {
            for (const item of c.items) {
              const isBreak = item.kind === "stack" || (item.kind === "book" && item.lean !== 0);
              if (isBreak) {
                if (seenBreak) {
                  assert.ok(count >= RUN_MIN && count <= RUN_MAX, `run of ${count}`);
                  runs++;
                }
                seenBreak = true;
                count = 0;
              } else if (item.kind === "book") count++;
            }
          }
        }
        assert.ok(count <= RUN_MAX || !seenBreak, `trailing run of ${count}`);
      }
    }
    assert.ok(runs > 500);
  });

  it("leans books against a neighbour or the bay side that holds them", () => {
    let endLeans = 0;
    for (const k of CASES) {
      for (const { bay, cell } of cellsOf(k)) {
        for (const c of cell.compartments) {
          c.items.forEach((item, i) => {
            if (item.kind !== "book" || item.lean === 0) return;
            const a = Math.abs(item.lean);
            assert.ok(a >= 0.14 - 1e-9 && a <= 0.38 + 1e-9, "8 to 22 degrees");
            const rest = item.h * Math.cos(a);
            const neighbour = item.lean < 0 ? c.items[i - 1] : c.items[i + 1];
            if (item.lean > 0 && neighbour === undefined) {
              assert.ok(item.x + itemWidth(item) >= bay.x1 - 1, "the last book of a row leans on the bay side");
              endLeans++;
              return;
            }
            if (item.lean > 0) assert.ok(neighbour?.kind === "book" && neighbour.lean === 0, "a right lean is held by the next book");
            if (neighbour?.kind === "book" && neighbour.lean === 0) {
              assert.ok(neighbour.h >= rest - 1e-6, "neighbour reaches the lean");
              if (item.lean < 0) assert.ok(item.x - (neighbour.x + neighbour.w) <= 5 + 1e-9, "a left lean touches the book it rests on");
            }
          });
        }
      }
    }
    assert.ok(endLeans > 50, "rows close with a book leaning on the bay side");
  });

  it("fills shelves: no shelf without a slot under 70 %, at most one shelf per bay level under 60 %", () => {
    let shelves = 0;
    let under75 = 0;
    for (const k of CASES) {
      for (const { bay, cell } of cellsOf(k)) {
        let low = 0;
        for (const c of cell.compartments) {
          const fill = c.items.reduce((a, it) => a + itemWidth(it), 0) / (bay.x1 - bay.x0 - 3);
          const slot = k.slots.some((s) => s.bay === bay.index && s.y === c.floor);
          if (fill < 0.6) low++;
          if (!slot) {
            shelves++;
            assert.ok(fill >= 0.7, `shelf only ${(fill * 100).toFixed(0)} % full`);
            if (fill < 0.75) under75++;
          }
          if (NARROW.includes(k) && slot) assert.ok(fill >= 0.5, `narrow slot shelf ${(fill * 100).toFixed(0)} % full`);
        }
        assert.ok(low <= 1, `${low} shelves under 60 % in one bay level`);
      }
    }
    assert.ok(under75 / shelves <= 0.005, `${under75} of ${shelves} shelves under 75 %`);
  });

  it("places one or two objects per bay level counting its sconce, in varied kinds and sizes", () => {
    for (const k of CASES) {
      for (const { bay, cell } of cellsOf(k)) {
        const objects = cell.compartments.flatMap((c) => c.items.filter((it) => it.kind !== "book" && it.kind !== "stack"));
        const sconces = k.sconces.filter((s) => s.bay === bay.index && s.level === cell.level).length;
        assert.ok(objects.length + sconces >= 1 && objects.length + sconces <= 2, `${objects.length} objects, ${sconces} sconces`);
        for (const o of objects) {
          assert.ok(OBJECT_KINDS.includes(o.kind));
          assert.ok(o.scale >= 0.5 && o.scale <= 1.2 + 1e-9, `scale ${o.scale}`);
          assert.ok(Math.abs(o.tilt) <= (15 * Math.PI) / 180 + 1e-9, "globe tilt within 15 degrees");
        }
      }
    }
  });

  it("never repeats an object kind within two bays of a level, so at most one hourglass per three bays", () => {
    let kinds = 0;
    for (const k of CASES) {
      for (let l = 0; l < LEVELS; l++) {
        const perBay: ObjectKind[][] = k.bays.map((bay) =>
          bay.cells[l].compartments.flatMap((c) => c.items.flatMap((it) => (it.kind === "book" || it.kind === "stack" ? [] : [it.kind]))),
        );
        perBay.forEach((mine, i) => {
          kinds += mine.length;
          for (const near of [perBay[i - 1], perBay[i - 2]]) for (const kind of mine) assert.ok(!near?.includes(kind), `${kind} repeats within two bays`);
        });
      }
    }
    assert.ok(kinds > 200);
    const seen = new Set(CASES.flatMap((k) => cellsOf(k).flatMap(({ cell }) => cell.compartments.flatMap((c) => c.items.map((it) => it.kind)))));
    for (const kind of OBJECT_KINDS) assert.ok(seen.has(kind), `${kind} appears`);
  });
});

describe("library shelf gate: light", () => {
  it("never gives neighbouring bays, or a bay's two levels, the same key", () => {
    for (const k of CASES) {
      k.bays.forEach((bay, i) => {
        bay.cells.forEach((cell, l) => {
          const left = k.bays[i - 1]?.cells[l];
          if (left) assert.notEqual(cell.key, left.key);
          if (l > 0) assert.notEqual(cell.key, bay.cells[l - 1].key);
        });
      });
    }
    const rng = createRng(5);
    for (let bays = 1; bays < 9; bays++) {
      for (let i = 0; i < 60; i++) {
        const grid = pickKeys(bays, LEVELS, rng);
        assert.ok(grid[0].includes("candle"), "a sconce on the first level");
        // One bay cannot hold the candle key on two levels in a row; two or more always can.
        if (bays > 1) for (const row of grid) assert.ok(row.includes("candle"), "a sconce on every level");
        grid.forEach((row, l) =>
          row.forEach((k, j) => {
            assert.notEqual(k, row[j - 1]);
            if (l > 0) assert.notEqual(k, grid[l - 1][j]);
          }),
        );
      }
    }
  });

  it("lights at least one level of every near case with a candle", () => {
    for (const s of STRIPS) assert.ok(s.sconces.length >= 1);
  });

  it("mounts one sconce per candle bay level on an on-screen upright, never the pilaster by the cards", () => {
    for (const k of CASES) {
      for (const { bay, cell } of cellsOf(k)) {
        const mine = k.sconces.filter((s) => s.bay === bay.index && s.level === cell.level);
        assert.equal(mine.length, cell.key === "candle" ? 1 : 0);
        for (const s of mine) {
          assert.ok(s.x >= 0 && s.x <= k.width, "on screen");
          const up = k.uprights[s.upright];
          assert.ok(up.x >= k.x0 - 1e-9 && up.x + up.w <= k.x1 + 1e-9, "on an upright inside the case");
          assert.equal(up.pilaster, false, "not on the pilaster beside the content column");
          const i = cell.compartments.findIndex((c) => s.y > c.top && s.y < c.floor);
          assert.ok(i >= 2 && i <= cell.compartments.length - 3, `compartment ${i}`);
          assert.equal(s.radius, k.lightRadius);
        }
      }
    }
  });

  it("keeps every sconce clear of the ladder", () => {
    let checked = 0;
    for (const k of CASES) {
      for (const s of k.sconces) {
        if (!k.ladder) continue;
        checked++;
        assert.equal(ladderHits(k.ladder, sconceBox(s, k.uprights[s.upright])), false, "a sconce behind the ladder");
      }
    }
    assert.ok(checked > 0);
  });

  it("keeps the candle glow faint at the content column's edge", () => {
    for (const s of STRIPS) {
      for (const sc of s.sconces) {
        const d = s.side === "left" ? s.width - sc.x : sc.x;
        assert.ok(airGlow(d, sc.radius * 0.9) <= 0.04, `glow ${airGlow(d, sc.radius * 0.9).toFixed(3)} at the inner edge`);
      }
    }
    assert.ok(airGlow(0, 100) > 0.1 && airGlow(100, 100) === 0);
  });

  it("caps the lightness of lit spines beside the content column at 0.65", () => {
    for (const s of STRIPS) {
      const x = s.side === "left" ? s.width - EDGE_NEAR + 1 : EDGE_NEAR - 1;
      const sconces = [{ x, y: 300, bay: 0, level: 0, upright: 0, reach: 1 as const, radius: 160 }];
      const light = lightAt({ ...s, sconces }, { key: "candle" }, x, 300);
      for (const family of Object.keys(FAMILIES) as FamilyId[]) {
        const c = tone(litColor(FAMILIES[family], light), family, light, 1.08);
        assert.ok(toHsl(c)[2] <= 0.65 + 1e-9, `${family} at the inner edge`);
      }
    }
  });

  it("lights books warm by a sconce and cool under the moon key", () => {
    const grey = [120, 120, 120] as const;
    const at = (key: keyof typeof LIGHT, warm: number): Light => ({ ...LIGHT[key], warm, cap: 1 });
    const warm = litColor(grey, at("candle", 1));
    assert.ok(warm[0] > warm[1] && warm[1] > warm[2], "candlelight is warm");
    const moon = litColor(grey, at("moon", 0));
    assert.ok(moon[2] > moon[0], "moonlight is cool");
    const shade = litColor(grey, at("shade", 0));
    assert.ok(shade[0] + shade[1] + shade[2] < moon[0] + moon[1] + moon[2], "shade is the darkest key");
    let prev = -1;
    for (let w = 0; w <= 2; w += 0.1) {
      const c = litColor(FAMILIES.oxblood, at("ember", w));
      assert.ok(c[0] >= prev, "more candle never darkens");
      prev = c[0];
    }
  });

  it("draws a strong cool rim in moonlit bays and a faint one by the candles", () => {
    assert.ok(LIGHT.moon.rim >= 0.6 && LIGHT.moon.rim <= 0.7);
    assert.ok(LIGHT.candle.rim >= 0.1 && LIGHT.candle.rim <= 0.12);
    assert.ok(LIGHT.moon.sky >= 0.15 && LIGHT.moon.sky <= 0.2, "moonlight from above brightens the upper compartment 15-20 %");
    for (const key of ["candle", "ember", "shade"] as const) assert.ok(LIGHT[key].sky < LIGHT.moon.sky);
  });

  it("grades lit colour within the palette: no hot pink, cobalt, silver navy or grey vellum", () => {
    const rng = createRng(17);
    for (let i = 0; i < 4000; i++) {
      const family = (Object.keys(FAMILIES) as FamilyId[])[i % 6];
      const key = (Object.keys(LIGHT) as (keyof typeof LIGHT)[])[Math.floor(rng() * 4)];
      const light: Light = { ...LIGHT[key], warm: LIGHT[key].warm + rng() * 1.4, cap: 1 };
      const albedo = roundRgb(mixRgb(FAMILIES[family], [255, 255, 255], rng() * 0.3));
      const c = tone(litColor(albedo, light), family, light, 0.9 + rng() * 0.18);
      const [h, s, l] = toHsl(c);
      if (l > 0.45) assert.ok(s <= 0.62 + 1e-6, `${family} s ${s.toFixed(2)} at l ${l.toFixed(2)}`);
      if (family === "plum") {
        assert.ok(s <= 0.5 + 1e-6);
        if (light.warm > 0.5) assert.ok(h >= 329 && h <= 351, `lit plum hue ${h.toFixed(0)}`);
        if (s > 0.02) assert.ok(h >= 305 && h <= 351, `plum hue ${h.toFixed(0)} under ${key}`);
      }
      if (family === "navy" && s > 0.02) {
        assert.ok(s <= 0.45 + 1e-6 && s >= 0.17, `navy s ${s.toFixed(2)}`);
        assert.ok(h >= 211 && h <= 237, `navy hue ${h.toFixed(0)}`);
      }
      if (family === "vellum") {
        assert.ok(h >= 34 && h <= 51, `vellum hue ${h.toFixed(0)}`);
        if (l > 0.08 && l < 0.92) assert.ok(s >= 0.12 - 1e-6, `vellum s ${s.toFixed(2)}`);
        assert.ok(l <= 0.8 + 1e-6, `vellum l ${l.toFixed(2)}`);
      }
    }
    const lit = (warm: number) => toHsl(grade([200, 90, 40], null, warm))[1];
    assert.ok(lit(1) < lit(0), "candlelight compresses chroma");
  });

  it("rolls highlights off smoothly instead of clipping", () => {
    assert.equal(softClip(100), 100);
    assert.equal(softClip(HIGHLIGHT_KNEE), HIGHLIGHT_KNEE);
    assert.ok(Math.abs(softClip(HIGHLIGHT_KNEE + 0.01) - (HIGHLIGHT_KNEE + 0.01)) < 0.001, "continuous at the knee");
    assert.ok(softClip(400) < 255 && softClip(400) > softClip(300));
    assert.ok(softClip(10000) <= 255);
  });

  it("reads light from the bay level a point belongs to", () => {
    const strip = STRIPS.find((s) => s.sconces.length > 0) as ShelfStrip;
    const cell: Pick<Cell, "key"> = { key: "shade" };
    const far = lightAt({ ...strip, sconces: [] }, cell, strip.side === "left" ? 0 : strip.width, 0);
    assert.equal(far.ambient, LIGHT.shade.ambient);
    assert.equal(far.warm, 0);
    assert.equal(far.cap, 1);
  });
});

/** Near cases and set-back stacks at 1440 and 2560 over 40 seeds (the round-2 gate's sample). */
const GATE_CASES = Array.from({ length: 40 }, (_, i) => 1 + i * 7919).flatMap((seed) =>
  ["1440x900/S1", "2560x1440/S1"].flatMap((cell) => stripsFor(cell, seed).flatMap((k) => (k.back ? [k, k.back] : [k]))),
);

/** The graded colour of every stop a painter lays on each book of a case, with its light. */
function* spineColours(k: ShelfStrip): Generator<{ family: FamilyId; key: Cell["key"]; light: Light; colour: [number, number, number]; card: boolean }> {
  for (const { bay, cell, compartment, book } of stripBooks(k)) {
    const light = lightAt(k, cell, book.x + itemWidth(book) / 2, compartment.floor - book.h * 0.55, bay.index);
    const raw = litColor(book.color, light);
    for (const m of SPINE_SHADES) {
      yield { family: book.family, key: cell.key, light, colour: tone(raw, book.card === null ? book.family : null, light, m), card: book.card !== null };
    }
  }
}

const luminance = (c: readonly number[]) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

describe("library shelf gate: round 3 findings", () => {
  it("keeps plum out of violet under every key, as painted (grading is the last colour step)", () => {
    let coloured = 0;
    let violet = 0;
    for (const k of GATE_CASES) {
      for (const { family, colour, card } of spineColours(k)) {
        const [h, sat, l] = toHsl(colour);
        if (family === "plum" && !card && sat > 0.02) assert.ok(!(h >= 250 && h <= 285), `plum painted at hue ${h.toFixed(0)}`);
        if (sat > 0.2 && l > 0.12) {
          coloured++;
          if (h >= 250 && h <= 300 && sat > 0.3) violet++;
        }
      }
    }
    assert.ok(coloured > 10000);
    assert.ok(violet / coloured < 0.01, `violet share ${((100 * violet) / coloured).toFixed(2)} %`);
  });

  it("paints navy by a candle as a dusky blue: hue 212-236, saturation at least 0.16", () => {
    let checked = 0;
    for (const k of GATE_CASES) {
      for (const { family, key, light, colour, card } of spineColours(k)) {
        if (family !== "navy" || card || (key !== "candle" && light.warm < 0.3)) continue;
        const [h, sat] = toHsl(colour);
        if (sat < 0.02) continue;
        checked++;
        assert.ok(h >= 211.5 && h <= 236.5, `navy hue ${h.toFixed(0)}`);
        assert.ok(sat >= 0.16, `navy saturation ${sat.toFixed(2)}`);
      }
    }
    assert.ok(checked > 1000);
  });

  it("lands the moon rim blue on the headcaps of moonlit bays: hue 220-236, saturation at least 0.18", () => {
    const a = LIGHT.moon.rim;
    const hues: number[] = [];
    for (const k of GATE_CASES) {
      for (const { bay, cell, compartment, book } of stripBooks(k)) {
        if (cell.key !== "moon" || book.family === "vellum" || book.card !== null) continue;
        const light = lightAt(k, cell, book.x + itemWidth(book) / 2, compartment.floor - book.h, bay.index);
        const head = tone(litColor(book.color, light), book.family, light, 1);
        const rim = head.map((v, i) => a * PALETTE.moonRim[i] + (1 - a) * v);
        const [h, sat, l] = toHsl(rim as [number, number, number]);
        hues.push(h);
        assert.ok(h >= 215 && h <= 238, `rim hue ${h.toFixed(0)}`);
        assert.ok(sat >= 0.18, `rim saturation ${sat.toFixed(2)}`);
        assert.ok(l >= 0.4 && l <= 0.62, `rim lightness ${l.toFixed(2)}`);
      }
    }
    hues.sort((x, y) => x - y);
    const median = hues[hues.length >> 1];
    assert.ok(median >= 220 && median <= 232, `median rim hue ${median.toFixed(0)}`);
  });

  it("keeps a candle bay's neighbours in their own key: at most 0.6 of its light at 2560", () => {
    // The light a grey spine receives at each book's place, in the band the sconce lights,
    // compared side by side with the same band of the neighbouring bays.
    let pairs = 0;
    for (let i = 0; i < 40; i++) {
      for (const k of stripsFor("2560x1440/S1", 1 + i * 7919)) {
        const mean = (bayIndex: number, s: ShelfStrip["sconces"][number]) => {
          let sum = 0;
          let n = 0;
          for (const { bay, cell, compartment, book } of stripBooks(k)) {
            const y = compartment.floor - book.h * 0.55;
            if (bay.index !== bayIndex || cell.level !== s.level || Math.abs(y - s.y) > s.radius * 0.7) continue;
            const light = lightAt(k, cell, book.x + itemWidth(book) / 2, y, bay.index);
            sum += luminance(tone(litColor([128, 128, 128], light), null, light, 1));
            n++;
          }
          return n ? sum / n : 0;
        };
        for (const s of k.sconces) {
          const own = mean(s.bay, s);
          for (const j of [s.bay - 1, s.bay + 1]) {
            if (!k.bays[j] || k.bays[j].x1 <= 0 || k.bays[j].x0 >= k.width) continue;
            pairs++;
            const next = mean(j, s);
            assert.ok(next <= 0.6 * own, `bay ${j} at ${next.toFixed(3)} beside a candle bay at ${own.toFixed(3)}`);
          }
        }
      }
    }
    assert.ok(pairs > 100);
  });

  it("drops the set-back stack a level's 0.4 down, so its galleries never line up with the near case's", () => {
    assert.equal(BACK_PHASE % 4, 0);
    assert.ok(BACK_VALUE <= 0.5, "the stack sits deeper in haze");
    const near = [0, LEVEL];
    const back = [BACK_PHASE, BACK_PHASE + LEVEL];
    for (const a of near) {
      for (const b of back) {
        const d = Math.abs(a - b) % SHELF_PERIOD;
        assert.ok(Math.min(d, SHELF_PERIOD - d) >= 0.3 * LEVEL);
      }
    }
  });

  it("draws every extent once per tile copy with periodCopies", () => {
    assert.deepEqual(periodCopies(10, 100, 1000), [0]);
    assert.deepEqual(periodCopies(900, 1100, 1000), [-1000, 0]);
    assert.deepEqual(periodCopies(1100, 1200, 1000), [-1000]);
    assert.deepEqual(periodCopies(-50, 20, 1000), [0, 1000]);
    for (const [y0, y1] of [[296, 1036], [1036, 1776], [-444, 296]]) {
      const covered = periodCopies(y0, y1, SHELF_PERIOD).map((o) => [Math.max(0, y0 + o), Math.min(SHELF_PERIOD, y1 + o)]);
      const total = covered.reduce((sum, [a, b]) => sum + (b - a), 0);
      assert.equal(total, Math.min(SHELF_PERIOD, y1 - y0));
    }
  });
});

describe("library shelf records for the live layers", () => {
  it("records free slots sized for a docking volume in every near bay level", () => {
    for (const k of STRIPS) {
      for (const { bay, cell } of cellsOf(k)) {
        const mine = k.slots.filter((s) => s.bay === bay.index && cell.compartments.some((c) => c.floor === s.y));
        assert.ok(mine.length >= 1, "at least one slot");
      }
      for (const slot of k.slots) {
        assert.ok(slot.w >= SLOT_MIN && slot.w <= SLOT_MAX);
        const bay = k.bays[slot.bay];
        const c = bay.cells.flatMap((cell) => cell.compartments).find((x) => x.floor === slot.y);
        assert.ok(c, "a slot stands on a board");
        assert.ok(c.floor < k.period, "not on the half-hidden last shelf of the period");
        assert.equal(slot.h, c.floor - c.top);
        for (const item of c.items) {
          const overlap = Math.min(slot.x + slot.w, item.x + itemWidth(item)) - Math.max(slot.x, item.x);
          assert.ok(overlap <= 1e-9, "a slot is empty");
        }
      }
    }
  });

  it("tints one upright spine per open card 60/40 toward its accent, with its rune, clear of the ladder", () => {
    const s = FIXTURE.cells["1440x900/S1"].snapshot;
    const open = s.cards.filter((c) => c.kind === "open");
    for (const cell of ["1440x900/S1", "2560x1440/S1"]) {
      for (const seed of SEEDS) {
        const strips = stripsFor(cell, seed);
        const spines = strips.flatMap((strip) => strip.spines);
        assert.deepEqual(spines.map((x) => x.slug).sort(), open.map((c) => c.slug).sort());
        for (const strip of strips) {
          const seen = new Set<number>();
          for (const spine of strip.spines) {
            const found = [...stripBooks(strip)].find(({ book }) => book.card === spine.slug);
            assert.ok(found, "the spine is a book");
            const { book, compartment } = found;
            const accent = parseHex(open.find((c) => c.slug === spine.slug)?.accent ?? "") as readonly [number, number, number];
            assert.deepEqual(book.color, roundRgb(mixRgb(FAMILIES[book.family], accent, CARD_TINT)));
            assert.equal(CARD_TINT, 0.4);
            assert.equal(book.lean, 0);
            assert.equal(book.rune, fnv1a(spine.slug) % RUNES.length);
            assert.equal(spine.bay, 0, "in the bay nearest the cards");
            assert.equal(spine.y + spine.h, compartment.floor);
            assert.ok(spine.x >= 0 && spine.x + spine.w <= strip.width);
            assert.equal(ladderHits(strip.ladder, { x0: spine.x, x1: spine.x + spine.w, y0: compartment.top, y1: compartment.floor }, 4), false);
            assert.ok(!seen.has(compartment.top), "one card spine per shelf");
            seen.add(compartment.top);
          }
        }
      }
    }
  });

  it("falls back to gilt for an accent that is not a hex colour", () => {
    const plan = shelfPlan("desktop", 180, "right") as ShelfPlan;
    const cards: ShelfCard[] = [{ slug: "x", accent: "var(--nope)" }];
    const strip = layoutShelfStrip({ plan, seed: 1, cards });
    const book = [...stripBooks(strip)].find(({ book: b }) => b.card === "x")?.book as ShelfBook;
    assert.deepEqual(book.color, roundRgb(mixRgb(FAMILIES[book.family], PALETTE.gilt, CARD_TINT)));
    assert.equal(parseHex("#abc")?.join(), "170,187,204");
    assert.equal(parseHex("#ECA8B7")?.join(), "236,168,183");
    assert.equal(parseHex("red"), null);
  });

  it("leans the ladder 6-10 degrees from the brass rail, foot out toward the screen edge, inside the case", () => {
    let ladders = 0;
    for (const k of CASES) {
      if (k.side === "right" || NARROW.includes(k) || k.scale !== 1) {
        assert.equal(k.ladder, null);
        continue;
      }
      const l = k.ladder;
      assert.ok(l, "the left near case on desktop and wide has a ladder");
      ladders++;
      assert.equal(l.top, RAIL_Y - 4);
      assert.equal(l.bottom, k.level + BALUSTRADE);
      assert.ok(l.footX < l.hookX, "foot toward the screen edge");
      const deg = (Math.atan((l.hookX - l.footX) / (l.bottom - l.top)) * 180) / Math.PI;
      assert.ok(deg >= LADDER_LEAN[0] - 0.5 && deg <= LADDER_LEAN[1] + 0.1, `lean ${deg.toFixed(1)} degrees`);
      assert.ok(l.footX - l.spreadBottom / 2 >= k.x0, "foot inside the case");
      assert.ok(l.hookX + l.spreadTop / 2 <= k.x1 - (k.back ? 0 : PILASTER), "clear of the pilaster");
      assert.equal(ladderX(l, l.top), l.hookX);
      assert.equal(ladderX(l, l.bottom), l.footX);
    }
    assert.ok(ladders >= 10);
  });

  it("is deterministic for a seed and varies across seeds", () => {
    const plan = shelfPlan("desktop", 180, "left") as ShelfPlan;
    const a = layoutShelfStrip({ plan, seed: 99, cards: [] });
    const b = layoutShelfStrip({ plan, seed: 99, cards: [] });
    const c = layoutShelfStrip({ plan, seed: 100, cards: [] });
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
    const right = layoutShelfStrip({ plan: { ...plan, side: "right", ladder: false }, seed: 99, cards: [] });
    const firstRow = (s: ShelfStrip) => s.bays[0].cells[0].compartments[1].items.map((it) => [it.kind, itemWidth(it)]);
    assert.notDeepEqual(firstRow(a), firstRow(right), "the two strips of a page differ");
  });
});

/* ------------------------------------------------------------------ the hall, figures, pages (library-book) */

const ALL_CELLS = Object.keys(FIXTURE.cells);
const snap = (cell: string) => FIXTURE.cells[cell].snapshot;
const boxesOverlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The theme's stage hit fractions, read from its stylesheet: the desktop block, then the max-width 780px block. */
const STAGE_HIT = (() => {
  const css = readFileSync(new URL("../../styles/_shared/hub-themes/pages-stars.css", import.meta.url), "utf8");
  const values = [...css.matchAll(/--stage-hit-([xywh]):\s*([\d.]+)/g)].map((m) => [m[1], Number(m[2])] as const);
  const block = (from: number) => Object.fromEntries(values.slice(from, from + 4)) as unknown as Rect;
  assert.equal(values.length, 8, "two blocks of stage hit fractions");
  return { desktop: block(0), phone: block(4) };
})();

describe("library hall composition", () => {
  it("uses the one shared layout classifier for the hall and the draft, 700x560 included", () => {
    for (const cell of ALL_CELLS) {
      const s = snap(cell);
      assert.equal(s.mode, classifyMode(s.viewport.w, s.viewport.h, Math.min(s.gutters.left, s.gutters.right)), cell);
      const hall = hallLayout(s);
      assert.equal(hall.mode, s.mode, cell);
      const phone = s.mode === "phone" || s.mode === "landscape-short";
      const paths = draftPaths(s, hall);
      // Phones and short landscape: one draft entering from the left edge; wider screens: one up each gutter.
      assert.equal(paths.length, phone ? 1 : 2, cell);
      if (phone) assert.ok(paths[0].lut.x[0] < 0, `${cell}: enters from the left edge`);
      assert.equal(placeLancets(s).length, s.mode === "desktop" || s.mode === "wide" ? 2 : 0, cell);
    }
    assert.equal(snap("700x560/S0").mode, "phone", "700x560 composes as a phone");
    assert.equal(snap("667x375/S0").mode, "landscape-short");
  });

  it("places at least 3 vault panels on phones and 6 at 1440x900, none on a hole or the rose window", () => {
    const counts: Record<string, number> = {};
    for (const cell of ALL_CELLS) {
      const s = snap(cell);
      const hall = hallLayout(s);
      counts[cell] = hall.panels.length;
      const rose = { x: hall.rose.x - hall.rose.r, y: hall.rose.y - hall.rose.r, w: hall.rose.r * 2, h: hall.rose.r * 2 };
      const guarded = [...s.holes, ...[s.parts.resume, s.parts.start].filter((r): r is Rect => !!r)];
      for (const p of hall.panels) {
        for (const h of guarded) assert.ok(!boxesOverlap(p, h), `${cell}: panel ${JSON.stringify(p)} on hole ${JSON.stringify(h)}`);
        assert.ok(!boxesOverlap(p, rose), `${cell}: panel on the rose window`);
        assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= s.viewport.w, `${cell}: panel off screen`);
      }
      hall.panels.forEach((a, i) => hall.panels.slice(i + 1).forEach((b) => assert.ok(!boxesOverlap(a, b), `${cell}: panels overlap`)));
      for (const h of guarded) assert.ok(rectDistance(hall.rose.x, hall.rose.y, h) >= hall.rose.r, `${cell}: rose window on a hole`);
      if (s.mode === "phone" || s.mode === "landscape-short") assert.ok(hall.figure >= 14 && hall.figure <= 20, `${cell}: phone figure scale`);
    }
    for (const cell of ["390x844/S0", "390x844/S1", "320x568/S0", "320x568/S1"]) assert.ok(counts[cell] >= 3, `${cell}: ${counts[cell]} panels`);
    for (const cell of ["1440x900/S0", "1440x900/S1"]) assert.equal(counts[cell], 6, cell);
  });

  it("orders panels attended, resume, in progress, finished, unread, upcoming, locked", () => {
    const base = snap("1440x900/S1").cards[0];
    const cards: CardInfo[] = [
      { ...base, slug: "a", kind: "open", read: null, finished: false, index: 0 },
      { ...base, slug: "b", kind: "open", read: 0.4, finished: false, index: 1 },
      { ...base, slug: "c", kind: "locked", read: null, finished: false, index: 2 },
      { ...base, slug: "d", kind: "open", read: 1, finished: true, index: 3 },
      { ...base, slug: "e", kind: "upcoming", read: null, finished: false, index: 4 },
      { ...base, slug: "f", kind: "open", read: 0.2, finished: false, index: 5 },
    ];
    assert.deepEqual(panelOrder(cards, "e", "f").map((c) => c.slug), ["e", "f", "b", "d", "a", "c"]);
    assert.deepEqual(panelOrder(cards, null, null).map((c) => c.slug), ["b", "f", "d", "a", "e", "c"]);
  });
});

describe("library reading map", () => {
  it("maps progress to lit stars: 0 gives 0, any start at least 1, read through or finished gives all", () => {
    assert.equal(litStars(null, false, 7), 0);
    assert.equal(litStars(0, false, 7), 0);
    assert.equal(litStars(-0.2, false, 7), 0);
    assert.equal(litStars(0.001, false, 7), 1);
    assert.equal(litStars(0.5, false, 7), 4);
    assert.equal(litStars(1, false, 7), 7);
    assert.equal(litStars(0.3, true, 7), 7);
    let previous = 0;
    for (let i = 1; i <= 100; i++) {
      const n = litStars(i / 100, false, 6);
      assert.ok(n >= 1 && n <= 6 && n >= previous, "monotonic, between 1 and all");
      previous = n;
    }
    const card = snap("1440x900/S1").cards[0];
    assert.equal(tracedAtRest({ ...card, kind: "open", finished: true }), true);
    assert.equal(tracedAtRest({ ...card, kind: "open", finished: false }), false);
    assert.equal(tracedAtRest({ ...card, kind: "locked", finished: true }), false);
  });

  it("gives each charted novel its own figure and the rest a generic one, every edge on a star", () => {
    for (const slug of ["lodge", "tsukinomi", "kusabi", "hizumi", "ruin", "any-new-novel"]) {
      const f = figureFor(slug);
      assert.ok(f.stars.length >= 5 && f.stars.length <= 8, slug);
      for (const [a, b] of f.edges) assert.ok(a < f.stars.length && b < f.stars.length, slug);
      for (const [x, y] of f.stars) assert.ok(Math.abs(x) <= 1 && Math.abs(y) <= 1, slug);
    }
    assert.equal(figureFor("lodge"), FIGURES.lodge);
  });

  it("never traces faster than 0.4 s, and twinkles at most 0.5 Hz within 25 %", () => {
    assert.ok(TRACE_MIN_S >= 0.4 && TRACE_SUMMON_S >= TRACE_MIN_S && TRACE_TAP_S >= TRACE_MIN_S);
    assert.ok(traceProgress(0.39, 0) < 1, "a zero duration still takes 0.4 s");
    assert.equal(traceProgress(0.4, 0), 1);
    assert.ok(traceProgress(0.6, TRACE_SUMMON_S) < 1);
    assert.equal(traceProgress(TRACE_SUMMON_S, TRACE_SUMMON_S), 1);
    for (let i = 0; i < 3000; i++) {
      const k = twinkle(i / 100, 3, 1.3);
      assert.ok(k >= 0.75 - 1e-9 && k <= 1.25 + 1e-9);
    }
    // A rate above 0.5 Hz is capped: the first peak still comes at 0.5 s.
    assert.ok(Math.abs(twinkle(0.5, 3, 0) - 1.25) < 1e-9);
  });
});

describe("library candles and the opening", () => {
  it("keeps candle flicker within 12 % and its dominant frequency at or below 2 Hz", () => {
    const rate = 100;
    const samples: number[] = [];
    for (let i = 0; i < rate * 40; i++) samples.push(flicker(i / rate, 0.7) - 1);
    for (const v of samples) assert.ok(Math.abs(v) <= 0.12 + 1e-9, `flicker ${v}`);
    let best = { f: 0, mag: 0 };
    for (let k = 5; k <= 800; k++) {
      const f = k / 100;
      let re = 0;
      let im = 0;
      for (let i = 0; i < samples.length; i++) {
        const a = (2 * Math.PI * f * i) / rate;
        re += samples[i] * Math.cos(a);
        im += samples[i] * Math.sin(a);
      }
      const mag = Math.hypot(re, im);
      if (mag > best.mag) best = { f, mag };
    }
    assert.ok(best.f <= 2, `dominant flicker at ${best.f.toFixed(2)} Hz`);
  });

  it("sweeps the candles down the hall: each light ramps at least 300 ms, all done by 2.2 s", () => {
    const H = 900;
    for (let y = 0; y <= H; y += 15) {
      let on = -1;
      let full = -1;
      for (let i = 0; i <= 2500; i++) {
        const t = i / 1000;
        const k = introLight(t, y, H);
        if (on < 0 && k > 0) on = t;
        if (full < 0 && k >= 1) full = t;
      }
      assert.ok(on >= INTRO_SWEEP_START, `light at ${y} starts at ${on}`);
      assert.ok(full - on >= 0.3, `light at ${y} ramps in ${(full - on).toFixed(3)} s`);
      assert.ok(full <= 2.2 + 0.002, `light at ${y} done at ${full}`);
    }
    // One continuous front down the hall.
    assert.ok(introLight(1, 100, H) > introLight(1, 600, H));
    assert.ok(INTRO_RAMP_S >= 0.3 && INTRO_SWEEP_START + INTRO_SWEEP_S <= 2.2);
  });
});

describe("library pages", () => {
  const out: Vec = { x: 0, y: 0 };

  it("has a page hump beside the gutter that falls away to the edge (ported)", () => {
    assert.ok(pageProfile(0.33) > pageProfile(0));
    assert.ok(pageProfile(0.33) > pageProfile(1));
    assert.equal(pageProfile(-0.4), pageProfile(0.4));
  });

  it("projects the back of the book above and narrower than the front, inside the lectern hit (ported)", () => {
    const book = lecternBook({ x: 600, y: 30, w: 240, h: 150 });
    const front = { ...projectBook(book, 1, 0, 0, out) };
    const back = { ...projectBook(book, 1, 1, 0, out) };
    assert.ok(back.y < front.y);
    assert.ok(back.x - book.x < front.x - book.x);
    assert.ok(book.w <= 240 * 0.96 + 1e-9 && Math.abs(book.x - 720) < 1e-9);
  });

  it("turns a page: spine fixed, flat right to flat left, highest mid-turn, inside its width (ported)", () => {
    for (const p of [0, 0.2, 0.5, 0.8, 1]) {
      pageFlipPoint(0, p, out);
      assert.ok(Math.abs(out.x) < 1e-9);
    }
    pageFlipPoint(1, 0, out);
    assert.ok(Math.abs(out.x - 1) < 1e-6 && Math.abs(out.y - pageProfile(1)) < 1e-6);
    pageFlipPoint(1, 1, out);
    assert.ok(Math.abs(out.x + 1) < 1e-6 && Math.abs(out.y - pageProfile(1)) < 1e-6);
    pageFlipPoint(1, 0.5, out);
    const mid = out.y;
    assert.ok(out.x > 0, "the edge lags behind mid-turn");
    pageFlipPoint(1, 0.15, out);
    assert.ok(mid > out.y);
    for (let i = 0; i <= 20; i++) {
      for (let j = 0; j <= 10; j++) {
        pageFlipPoint(j / 10, i / 20, out);
        assert.ok(Math.abs(out.x) <= j / 10 + 1e-9);
      }
    }
  });

  it("fades in, stays whole, then burns by age, or by zone once it reaches the vault (ported, extended)", () => {
    const life: PageLife = { opacity: 0, burn: 0 };
    pageLifecycle(0, 30, life);
    assert.equal(life.opacity, 0);
    assert.equal(life.burn, 0);
    pageLifecycle(18, 30, life);
    assert.equal(life.opacity, 1);
    assert.equal(life.burn, 0);
    assert.ok(18 / 30 < BURN_START);
    pageLifecycle(30, 30, life);
    assert.equal(life.burn, 1);
    pageLifecycle(5, 30, life, 4);
    assert.ok(life.burn > 0 && life.burn < 1, "burning in the zone");
    pageLifecycle(4 + ZONE_BURN_S + 0.01, 30, life, 4);
    assert.equal(life.burn, 1, "burnt through in the zone");
    for (let i = -10; i < 100; i++) {
      pageLifecycle(i / 2, 30, life, i > 20 ? 10 : null);
      assert.ok(life.opacity >= 0 && life.opacity <= 1 && life.burn >= 0 && life.burn <= 1);
    }
  });

  it("turns at least 90 % of spawned pages into stars at 390x844 and 1440x900 (Monte Carlo, path-zone burn)", () => {
    for (const cell of ["390x844/S0", "390x844/S1", "1440x900/S0", "1440x900/S1"]) {
      const s = snap(cell);
      const hall = hallLayout(s);
      const rng = createRng(fnv1a(cell));
      const mid = s.windows.mid;
      const stage = s.windows.stage;
      const paths = [
        ...draftPaths(s, hall),
        risePath(s, { x: mid.x + mid.w / 2, y: mid.y + mid.h * 0.4 }, rng),
        risePath(s, { x: stage.x + stage.w * 0.3, y: stage.y + stage.h * 0.5 }, rng),
      ];
      for (const path of paths) {
        let stars = 0;
        const n = 1500;
        for (let i = 0; i < n; i++) {
          const speed = lerp(PAGE_SPEED[0], PAGE_SPEED[1], rng());
          const life = lerp(PAGE_LIFE[0], PAGE_LIFE[1], rng());
          // The scene's spawns: ambient pages a third from the start, the rest up to the zone; rising pages at the start.
          const start = path.doc ? rng() * 0.03 : rng() < 0.3 ? rng() * 0.05 : lerp(0.1, Math.max(0.12, path.burnAt - 0.15), rng());
          if (pageBecomesStar(path, speed, life, start, 0)) stars++;
        }
        assert.ok(stars / n >= 0.9, `${cell} ${path.doc ? "rise" : "draft"} path: ${((100 * stars) / n).toFixed(1)} % became stars`);
      }
    }
  });

  it("keeps the burst's 4-6 pages: ambient pages fill at most 70 % of the pool, and a burst recycles when full", () => {
    const rng = createRng(9);
    for (let i = 0; i < 500; i++) {
      const n = burstCount(rng);
      assert.ok(n >= BURST_MIN && n <= BURST_MAX);
    }
    assert.equal(BURST_MIN, 4);
    assert.equal(BURST_MAX, 6);
    for (const mode of ["wide", "desktop", "narrow", "phone", "landscape-short"] as const) {
      for (const tier of [0, 1, 2] as const) {
        const { pool, ambient } = pagePool(mode, tier);
        assert.ok(ambient <= Math.floor(pool * 0.7), `${mode} tier ${tier}: ambient within 70 %`);
        assert.ok(pool - ambient >= BURST_MAX, `${mode} tier ${tier}: burst reserve`);
        const pages: { active: boolean; reserved: boolean; age: number }[] = [];
        for (let k = 0; k < 40; k++) {
          const idx = slotFor(pages, pool, ambient, false);
          if (idx < 0) break;
          pages[idx] = { active: true, reserved: false, age: 10 + k };
        }
        assert.equal(pages.filter((p) => p.active && !p.reserved).length, ambient, "ambient stops at its cap");
        // A burst into the free reserve.
        const first = burstCount(rng);
        for (let k = 0; k < first; k++) {
          const idx = slotFor(pages, pool, ambient, true);
          assert.ok(idx >= 0 && !pages[idx]?.active, "a burst page takes a free slot");
          pages[idx] = { active: true, reserved: true, age: 1 };
        }
        // Fill the pool to the brim, then burst again: it recycles, ambient pages first, and keeps all its pages.
        while (pages.filter((p) => p.active).length < pool) pages[slotFor(pages, pool, ambient, true)] = { active: true, reserved: true, age: 1 };
        const burst = burstCount(rng);
        const got = new Set<number>();
        for (let k = 0; k < burst; k++) {
          const idx = slotFor(pages, pool, ambient, true);
          assert.ok(idx >= 0, "a burst page always finds a slot");
          if (k < ambient) assert.equal(pages[idx].reserved, false, "recycles an ambient page first");
          pages[idx] = { active: true, reserved: true, age: 0 };
          got.add(idx);
        }
        assert.equal(got.size, burst, `${mode} tier ${tier}: the burst keeps all ${burst} pages`);
      }
    }
  });

  it("keeps the burst cooldown under three flashes a second (ported)", () => {
    let last = -BURST_COOLDOWN_S;
    let bursts = 0;
    for (let i = 0; i < 200; i++) {
      const now = i * 0.05;
      if (canBurst(now, last)) {
        bursts++;
        last = now;
      }
    }
    assert.ok(bursts / 10 < 3 && bursts >= 5);
  });

  it("lays the stage shelf inside its hit rect: one tome per bound card, the folios on the press, a candle by the resume tome", () => {
    for (const cell of ["1440x900/S1", "390x844/S1", "844x390/S1", "320x568/S0", "2560x1440/S1"]) {
      const s = snap(cell);
      const stage = s.windows.stage;
      const hit = hitRect({ x: 0, y: 0, w: stage.w, h: stage.h }, s.viewport.w <= 780 ? STAGE_HIT.phone : STAGE_HIT.desktop);
      const shelf = stageShelf(s.cards, hit, "lodge");
      assert.equal(shelf.tomes.length, s.cards.filter((c) => c.kind !== "upcoming").length, cell);
      const last = shelf.tomes[shelf.tomes.length - 1];
      assert.ok(shelf.press !== null && last.x + last.w <= shelf.press.x, `${cell}: the tomes stop short of the press`);
      for (const t of shelf.tomes) {
        assert.ok(t.x >= hit.x && t.x + t.w <= hit.x + hit.w, `${cell}: tome inside the hit rect`);
        assert.ok(t.h <= shelf.plank.y - hit.y, `${cell}: tome under the top of the hit rect`);
      }
      assert.ok(shelf.candle !== null && shelf.candle.x < hit.x + hit.w, `${cell}: the reading candle`);
      // The plank is sized to the group and centred, so the shelf has no long empty run.
      const p = shelf.plank;
      assert.ok(p.x >= hit.x - 0.5 && p.x + p.w <= hit.x + hit.w + 0.5, `${cell}: plank inside the hit rect`);
      const groupL = shelf.tomes[0].x - p.x;
      const groupR = p.x + p.w - (shelf.press.x + shelf.press.w);
      assert.ok(Math.abs(groupL - groupR) < 1, `${cell}: group centred on the plank (${groupL} vs ${groupR})`);
    }
    assert.equal(SHELF_PERIOD, LEVEL * LEVELS);
  });
});

/* ------------------------------------------------------------------ kit teardown with the painters */

/** A 2D context that accepts every call; gradients, patterns and image data are stubs. */
function fakeCtx(canvas: { width: number; height: number }): CanvasRenderingContext2D {
  const gradient = { addColorStop() {} };
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      if (prop === "canvas") return canvas;
      if (prop === "createLinearGradient" || prop === "createRadialGradient" || prop === "createConicGradient") return () => gradient;
      if (prop === "createPattern") return () => ({ setTransform() {} });
      if (prop === "createImageData") return (w: number, h: number) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
      if (prop === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
      if (prop === "measureText") return () => ({ width: 0 });
      return () => {};
    },
    set(target, prop, value) {
      target[prop as string] = value;
      return true;
    },
  };
  return new Proxy({} as Record<string, unknown>, handler) as unknown as CanvasRenderingContext2D;
}

class PaintCanvas {
  width = 300;
  height = 150;
  style = Object.assign({} as Record<string, string>, {
    removeProperty(this: Record<string, string>, name: string) {
      delete this[name];
    },
  });
  dataset: Record<string, string> = {};
  private readonly ctx = fakeCtx(this);
  constructor(private readonly box = { left: 0, top: 0, width: 1440, height: 900 }) {}
  getContext() {
    return this.ctx;
  }
  getBoundingClientRect() {
    const b = this.box;
    return { ...b, x: b.left, y: b.top, right: b.left + b.width, bottom: b.top + b.height };
  }
}

describe("library scene on the kit: teardown with every painter", () => {
  it("releases every surface after build, staged shelf painting, windows, three resizes and destroy", async () => {
    // The shelf modules load lazily; warm the module cache so their paint jobs queue during the test.
    await import("./library-paint");
    const s = snap("1440x900/S1");
    const created: { w: number; h: number }[] = [];
    let released = 0;
    const scratch: PaintCanvas[] = [];
    const previousDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      createElement: () => {
        const canvas = new PaintCanvas();
        scratch.push(canvas);
        return canvas;
      },
    };
    const idle = new Map<number, IdleCallback>();
    let idleId = 0;
    let clock = 1000;
    const listeners = new Map<string, Set<(e: Event) => void>>();
    const host = {
      scrollY: 0,
      location: { search: "" },
      sessionStorage: { getItem: () => null, setItem() {} },
      document: { hidden: false, documentElement: { dataset: {} as Record<string, string> } },
      addEventListener(type: string, fn: (e: Event) => void) {
        let set = listeners.get(type);
        if (!set) listeners.set(type, (set = new Set()));
        set.add(fn);
      },
      removeEventListener(type: string, fn: (e: Event) => void) {
        listeners.get(type)?.delete(fn);
      },
    };
    const intersections: { callback: IntersectionObserverCallback; observed: Set<unknown> }[] = [];
    class Observer {
      observed = new Set<unknown>();
      constructor(public callback: IntersectionObserverCallback) {}
      observe(el: unknown) {
        this.observed.add(el);
      }
      unobserve(el: unknown) {
        this.observed.delete(el);
      }
      disconnect() {
        this.observed.clear();
      }
    }
    class IO extends Observer {
      constructor(callback: IntersectionObserverCallback) {
        super(callback);
        intersections.push(this);
      }
    }
    const page: PageModel = {
      getSnapshot: () => s,
      refresh: () => s,
      subscribe: () => () => {},
      zoneAt: (x, y) => zoneAt(s, x, y),
      cardAt: (x, y) => cardAt(s, x, y),
      isCovered: (x, y, pad) => isCovered(s, x, y, pad),
      holeDistance: (x, y) => holeDistance(s, x, y),
      toViewport: (r, sy = 0) => toViewport(r, sy),
      dispose() {},
    };
    const output: Output = {
      root() {},
      card() {},
      heroPoolX() {},
      beat() {},
      perch: () => 0,
      unperch() {},
      label() {},
      focusCard() {},
      still() {},
      resume() {},
      dispose() {},
    };
    let scene: SceneOptions | null = null;
    const liveCtx = fakeCtx({ width: 1440, height: 900 });
    const globals: Record<string, unknown> = {};
    const windows = {
      stage: new PaintCanvas({ left: 0, top: 300, width: 1440, height: 198 }),
      mid: new PaintCanvas({ left: 0, top: 520, width: 1440, height: 216 }),
      ground: new PaintCanvas({ left: 0, top: 760, width: 1440, height: 385 }),
    };
    const statics = [0.15, 0.35, 0.35, 0.5].map((parallax, i) => ({ canvas: new PaintCanvas(), parallax, period: i === 1 || i === 2 ? SHELF_PERIOD : undefined }));
    const planes = { root: { dataset: {} }, live: new PaintCanvas(), statics, windows } as unknown as HubPlanes;
    const deps: Partial<KitDeps> = {
      createScene: (options) => {
        scene = options;
        options.resize({ width: 1440, height: 900, dpr: 1 }, liveCtx);
        return { start() {}, stop() {}, destroy() {} };
      },
      ResizeObserver: Observer as never,
      IntersectionObserver: IO as never,
      now: () => clock,
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
      requestAnimationFrame: () => 0,
      cancelAnimationFrame: () => {},
      requestIdle: (fn) => {
        idle.set(++idleId, fn);
        return idleId;
      },
      cancelIdle: (h) => void idle.delete(h),
      surfaceFactory: {
        surface(w: number, h: number) {
          const canvas = new PaintCanvas();
          canvas.width = Math.max(1, Math.ceil(w));
          canvas.height = Math.max(1, Math.ceil(h));
          created.push({ w: canvas.width, h: canvas.height });
          return { canvas: canvas as unknown as HTMLCanvasElement, g: canvas.getContext() };
        },
        release(...list: HTMLCanvasElement[]) {
          released += list.length;
          for (const c of list) {
            c.width = 0;
            c.height = 0;
          }
        },
      },
      page,
      bus: createBus(new EventTarget(), () => ({})),
      createOutput: () => output,
      host: host as never,
      globals,
    };
    /** Runs queued idle work (and the microtasks and timers it starts) until it stays quiet. */
    const settle = async () => {
      let quiet = 0;
      for (let round = 0; round < 2000 && quiet < 25; round++) {
        await new Promise((resolve) => setTimeout(resolve, 1));
        if (idle.size === 0) {
          quiet++;
          continue;
        }
        quiet = 0;
        const run = [...idle.values()];
        idle.clear();
        for (const fn of run) fn({ didTimeout: false, timeRemaining: () => 40 });
      }
    };
    const frames = (count: number, w = 1440, h = 900) => {
      for (let i = 0; i < count; i++) {
        clock += 16.7;
        (scene as SceneOptions | null)?.render(liveCtx, { t: clock / 1000, dt: 1 / 60, width: w, height: h, dpr: 1, pointer: { x: 0, y: 0, nx: 0, ny: 0, active: false, down: false, justTapped: false, type: "mouse" } });
      }
    };
    try {
      const handle = createHubScene("pages-stars", planes, (ctx) => buildLibrary(ctx, planes), { deps, softReturn: true });
      assert.equal(globals.__pagesStarsBgInitialized, true);
      const targets = Object.values(windows);
      for (const io of intersections) {
        const seen = targets.filter((t) => io.observed.has(t));
        if (seen.length) io.callback(seen.map((target) => ({ target, isIntersecting: true }) as unknown as IntersectionObserverEntry), io as never);
      }
      frames(10);
      await settle();
      frames(10);
      for (const [w, h] of [[1280, 800], [1600, 900], [1440, 900]] as const) {
        (scene as SceneOptions | null)?.resize({ width: w, height: h, dpr: 1 }, liveCtx);
        frames(5, w, h);
        await settle();
        frames(5, w, h);
      }
      assert.ok(created.length > 10, `painters made ${created.length} surfaces`);
      assert.ok(created.some((c) => c.h === SHELF_PERIOD), "the bookcase tiles were painted on ledger surfaces");
      handle.destroy();
      await settle();
      assert.equal(released, created.length, `created ${created.length}, released ${released}`);
      assert.ok(scratch.every((c) => c.width === 0 && c.height === 0), "scratch canvases outside the ledger are released too");
      assert.equal(globals.__pagesStarsBgInitialized, false);
      let live = 0;
      for (const set of listeners.values()) live += set.size;
      assert.equal(live, 0, "no host listener left");
    } finally {
      (globalThis as { document?: unknown }).document = previousDocument;
    }
  });
});
