import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  buildIllustrationCatalog,
  illustrationsUpTo,
  type IllustrationEntry,
  type Palette,
  type SectionMeta,
} from "./concourse-core";
import {
  CARRIAGES_MAX,
  CARRIAGES_MIN,
  FRAME_BITMAP,
  FRAME_WINDOWS,
  LEAD_SECONDS,
  PASS_SECONDS_MAX,
  PASS_SECONDS_MIN,
  TAIL_SECONDS,
  WINDOWS_PER_CARRIAGE,
  WINDOW_ASPECT,
  connectionAllowsFrames,
  createPassClock,
  envelopeAt,
  envelopeSteps,
  isFinished,
  layoutTrain,
  makeTimeline,
  parseCatalog,
  planTrain,
  progressAt,
  trainX0,
  travelEnds,
  type TrainPlan,
} from "./train-core";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

// ---- the real content: section metadata and the illustration files -----------

const SECTIONS_DIR = "src/content/tsukinomi/sections";
const ILLUSTRATIONS_DIR = "public/assets/tsukinomi/images/illustrations";

function frontmatter(source: string): Record<string, string | number> {
  const block = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? "";
  const data: Record<string, string | number> = {};
  for (const line of block.split("\n")) {
    const match = /^([A-Za-z]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const raw = match[2].trim();
    data[match[1]] = /^".*"$/.test(raw) ? raw.slice(1, -1) : /^-?\d+$/.test(raw) ? Number(raw) : raw;
  }
  return data;
}

const SECTIONS: SectionMeta[] = readdirSync(join(root, SECTIONS_DIR))
  .filter((name) => name.endsWith(".md"))
  .sort()
  .map((name) => {
    const data = frontmatter(read(`${SECTIONS_DIR}/${name}`));
    return {
      id: name.replace(/\.md$/, ""),
      number: Number(data.number),
      title: String(data.title),
      chapterRange: String(data.chapterRange),
      readingMinutes: Number(data.readingMinutes),
      palette: String(data.palette) as Palette,
    };
  });

const FILES = readdirSync(join(root, ILLUSTRATIONS_DIR)).filter((name) => name.endsWith(".webp"));
/** The page's catalogue as the mount carries it: URLs under a base, each with its part. */
const CATALOG: IllustrationEntry[] = buildIllustrationCatalog(FILES, SECTIONS).map((entry) => ({
  file: `/MY-NOVEL/${ILLUSTRATIONS_DIR.replace(/^public\//, "")}/${entry.file}`,
  part: entry.part,
}));
const partOf = (url: string) => CATALOG.find((entry) => entry.file === url)?.part ?? null;

const SEEDS = Array.from({ length: 160 }, (_, index) => index * 7919 + 13);
const planFor = (seed: number, furthestRead: number | null | undefined, extra: { allowFrames?: boolean } = {}) =>
  planTrain({ seed, catalog: CATALOG, furthestRead, ...extra });
const framesOf = (plan: TrainPlan) => plan.windows.filter((window) => window.kind === "frame");

describe("the test data is the real catalogue", () => {
  it("has 18 illustrations, every one placed in a part from 1 to 5", () => {
    assert.equal(CATALOG.length, 18);
    assert.ok(CATALOG.every((entry) => entry.part !== null && entry.part >= 1 && entry.part <= 5));
  });
});

describe("parseCatalog", () => {
  it("reads the shape index.astro embeds", () => {
    const raw = JSON.stringify([
      { src: "/MY-NOVEL/a.webp", part: 1 },
      { src: "/MY-NOVEL/b.webp", part: null },
    ]);
    assert.deepEqual(parseCatalog(raw), [
      { file: "/MY-NOVEL/a.webp", part: 1 },
      { file: "/MY-NOVEL/b.webp", part: null },
    ]);
  });

  it("gives an empty catalogue for anything that is not that", () => {
    for (const raw of [undefined, null, "", "not json", "{}", "42", "null", '"a"', "[", '{"src":"x","part":1}']) {
      assert.deepEqual(parseCatalog(raw as string | null | undefined), [], String(raw));
    }
  });

  it("drops entries with no usable url or a part that is not an integer, and keeps the rest", () => {
    const raw = JSON.stringify([
      { src: "", part: 1 },
      { src: "   ", part: 1 },
      { src: 5, part: 1 },
      { part: 1 },
      { src: "/a.webp", part: 1.5 },
      { src: "/b.webp", part: "2" },
      { src: "/c.webp" },
      null,
      [],
      "x",
      { src: "/ok.webp", part: 3 },
    ]);
    assert.deepEqual(parseCatalog(raw), [{ file: "/ok.webp", part: 3 }]);
  });
});

describe("connectionAllowsFrames", () => {
  it("allows frames on an ordinary or unknown connection", () => {
    assert.equal(connectionAllowsFrames(undefined), true);
    assert.equal(connectionAllowsFrames(null), true);
    assert.equal(connectionAllowsFrames({}), true);
    assert.equal(connectionAllowsFrames({ effectiveType: "4g", saveData: false }), true);
    assert.equal(connectionAllowsFrames({ effectiveType: "3g" }), true);
  });

  it("holds them back for save-data and 2G", () => {
    assert.equal(connectionAllowsFrames({ saveData: true }), false);
    assert.equal(connectionAllowsFrames({ effectiveType: "2g" }), false);
    assert.equal(connectionAllowsFrames({ effectiveType: "slow-2g" }), false);
  });
});

describe("timeline", () => {
  it("is lead + travel + tail and stays in 8 to 12 seconds", () => {
    for (const total of [0, 5, 8, 10, 12, 40, Number.NaN, Number.POSITIVE_INFINITY]) {
      const timeline = makeTimeline(total);
      assert.ok(timeline.total >= PASS_SECONDS_MIN && timeline.total <= PASS_SECONDS_MAX, String(total));
      assert.equal(timeline.lead, LEAD_SECONDS);
      assert.equal(timeline.tail, TAIL_SECONDS);
      assert.ok(Math.abs(timeline.lead + timeline.travel + timeline.tail - timeline.total) < 1e-9);
      assert.ok(timeline.travel > 0);
    }
  });

  it("progress is 0 until the lead ends, linear while travelling, 1 after", () => {
    const timeline = makeTimeline(10);
    assert.equal(progressAt(0, timeline), 0);
    assert.equal(progressAt(timeline.lead, timeline), 0);
    assert.equal(progressAt(timeline.lead + timeline.travel, timeline), 1);
    assert.equal(progressAt(99, timeline), 1);
    assert.equal(progressAt(-3, timeline), 0);
    assert.equal(progressAt(Number.NaN, timeline), 0);
    const a = progressAt(timeline.lead + timeline.travel * 0.25, timeline);
    const b = progressAt(timeline.lead + timeline.travel * 0.5, timeline);
    const c = progressAt(timeline.lead + timeline.travel * 0.75, timeline);
    assert.ok(Math.abs(a - 0.25) < 1e-9 && Math.abs(b - 0.5) < 1e-9 && Math.abs(c - 0.75) < 1e-9);
  });

  it("the atmosphere envelope rises over the lead, holds, falls over the tail and is always within 0..1", () => {
    const timeline = makeTimeline(10);
    assert.equal(envelopeAt(0, timeline), 0);
    assert.equal(envelopeAt(timeline.total, timeline), 0);
    assert.equal(envelopeAt(timeline.lead, timeline), 1);
    assert.equal(envelopeAt(timeline.total - timeline.tail, timeline), 1);
    assert.equal(envelopeAt(timeline.total / 2, timeline), 1);
    let previous = 0;
    for (let t = 0; t <= timeline.total + 0.5; t += 0.05) {
      const value = envelopeAt(t, timeline);
      assert.ok(value >= 0 && value <= 1, `t=${t}`);
      // No step: it moves by at most a few percent per 50 ms.
      assert.ok(Math.abs(value - previous) < 0.12, `t=${t}`);
      previous = value;
    }
    assert.equal(envelopeAt(Number.NaN, timeline), 0);
  });

  it("is finished at the end and not before", () => {
    const timeline = makeTimeline(9);
    assert.equal(isFinished(timeline.total - 0.01, timeline), false);
    assert.equal(isFinished(timeline.total, timeline), true);
    assert.equal(isFinished(Number.NaN, timeline), false);
  });
});

describe("the pass's motion for the compositor", () => {
  it("carries the train in one straight line from off one side to off the other, as trainX0 does at the two ends of the travel", () => {
    for (const direction of [1, -1] as const) {
      const { from, to } = travelEnds(1280, 1750, direction);
      assert.equal(from, trainX0(0, 1280, 1750, direction));
      assert.equal(to, trainX0(1, 1280, 1750, direction));
      // Off screen at both ends, and moving the right way.
      if (direction > 0) assert.ok(from <= -1750 && to >= 1280);
      else assert.ok(from >= 1280 && to <= -1750);
      // A straight line is the same train as trainX0 at every progress in between.
      for (const u of [0.1, 0.5, 0.9]) assert.ok(Math.abs(from + (to - from) * u - trainX0(u, 1280, 1750, direction)) < 1e-9);
    }
  });

  it("samples the atmosphere's strength over the pass: smooth rises and falls at the ends, a plateau between", () => {
    for (const total of [8, 10, 12]) {
      const timeline = makeTimeline(total);
      const steps = envelopeSteps(timeline);
      assert.equal(steps[0].offset, 0);
      assert.equal(steps[steps.length - 1].offset, 1);
      assert.equal(steps[0].value, 0);
      assert.equal(steps[steps.length - 1].value, 0);
      for (let index = 1; index < steps.length; index++) assert.ok(steps[index].offset >= steps[index - 1].offset);
      for (const step of steps) assert.equal(step.value, envelopeAt(step.offset * timeline.total, timeline));
      const top = steps.filter((step) => step.value === 1);
      assert.ok(top.length >= 2, "the plateau is held between its two ends");
      // No jump bigger than a tenth of the range from one keyframe to the next: nothing flashes.
      for (let index = 1; index < steps.length; index++) assert.ok(Math.abs(steps[index].value - steps[index - 1].value) < 0.3);
    }
  });

  it("counts the pass by a clock that stops while the pass is held, and carries on from where it stopped", () => {
    let now = 5000;
    const clock = createPassClock(() => now);
    assert.equal(clock.elapsedMs(), 0);
    clock.hold();
    assert.equal(clock.held, false, "a hold before the start does nothing");
    clock.start();
    now = 5800;
    assert.equal(clock.elapsedMs(), 800);
    clock.hold();
    now = 20_000;
    assert.equal(clock.elapsedMs(), 800);
    clock.release();
    now = 20_100;
    assert.equal(clock.elapsedMs(), 900);
    clock.start();
    now = 20_200;
    assert.equal(clock.elapsedMs(), 1000, "a second start is ignored");
  });
});

describe("planTrain: the shape of a train", () => {
  it("is deterministic for a seed and varies across seeds", () => {
    assert.deepEqual(planFor(42, 5), planFor(42, 5));
    const plans = SEEDS.map((seed) => planFor(seed, 5));
    assert.ok(new Set(plans.map((plan) => plan.direction)).size === 2, "both directions occur");
    assert.deepEqual(
      [...new Set(plans.map((plan) => plan.carriages))].sort(),
      [CARRIAGES_MIN, CARRIAGES_MAX],
    );
    assert.ok(new Set(plans.map((plan) => plan.timeline.total.toFixed(1))).size > 10, "pass lengths vary");
  });

  it("has 4 or 5 carriages of 4 windows and a pass of 8 to 12 seconds", () => {
    for (const seed of SEEDS) {
      const plan = planFor(seed, 5);
      assert.ok(plan.carriages >= CARRIAGES_MIN && plan.carriages <= CARRIAGES_MAX);
      assert.equal(plan.windows.length, plan.carriages * WINDOWS_PER_CARRIAGE);
      assert.ok(plan.timeline.total >= PASS_SECONDS_MIN && plan.timeline.total <= PASS_SECONDS_MAX);
      plan.windows.forEach((window, index) => {
        assert.equal(window.index, index);
        assert.equal(window.carriage, Math.floor(index / WINDOWS_PER_CARRIAGE));
      });
    }
  });

  it("direction, length and carriage count do not depend on how much the reader has read", () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const fresh = planFor(seed, null);
      const done = planFor(seed, 5);
      assert.equal(fresh.direction, done.direction);
      assert.equal(fresh.carriages, done.carriages);
      assert.deepEqual(fresh.timeline, done.timeline);
    }
  });

  it("gives every window the field its kind needs and none it does not", () => {
    for (const seed of SEEDS) {
      for (const window of planFor(seed, 3).windows) {
        assert.ok(Number.isFinite(window.phase));
        if (window.kind === "frame") {
          assert.ok(typeof window.src === "string" && window.src !== "");
          assert.equal(window.figure, undefined);
          assert.equal(window.blind, undefined);
        } else if (window.kind === "silhouette") {
          assert.equal(window.src, undefined);
          assert.ok(window.figure);
          assert.ok(window.figure.scale >= 0.85 && window.figure.scale <= 1.1);
          assert.ok(Math.abs(window.figure.dx) <= 1);
        } else {
          assert.equal(window.src, undefined);
          assert.equal(window.figure, undefined);
          assert.ok(window.blind !== undefined && window.blind >= 0 && window.blind < 1);
        }
      }
    }
  });
});

describe("planTrain: the spoiler rule", () => {
  it("a brand-new reader sees no picture and nothing is requested", () => {
    for (const furthest of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, "3" as unknown as number]) {
      for (const seed of SEEDS.slice(0, 60)) {
        const plan = planFor(seed, furthest);
        assert.deepEqual(plan.frames, [], String(furthest));
        assert.equal(framesOf(plan).length, 0);
        assert.ok(plan.windows.every((window) => window.src === undefined));
      }
    }
  });

  it("a brand-new reader sees every window lit, most of them with a dark passenger", () => {
    for (const seed of SEEDS) {
      const plan = planFor(seed, null);
      const silhouettes = plan.windows.filter((window) => window.kind === "silhouette").length;
      assert.ok(silhouettes >= plan.windows.filter((window) => window.frameRow).length);
      assert.ok(silhouettes / plan.windows.length >= 0.4, `seed ${seed}: ${silhouettes}/${plan.windows.length}`);
      assert.ok(plan.windows.every((window) => window.kind === "silhouette" || window.kind === "empty"));
    }
  });

  it("a reader who has read through part N is shown pictures of parts 1 to N only", () => {
    for (const furthest of [1, 2, 3, 4, 5]) {
      const allowed = new Set(illustrationsUpTo(CATALOG, furthest).map((entry) => entry.file));
      for (const seed of SEEDS) {
        const plan = planFor(seed, furthest);
        for (const src of plan.frames) {
          assert.ok(allowed.has(src), `${src} planned for furthestRead=${furthest}`);
          assert.ok((partOf(src) ?? 99) <= furthest);
        }
        for (const window of framesOf(plan)) assert.ok(allowed.has(window.src!));
      }
    }
  });

  it("never plans an illustration of a part above the furthest read, over many seeds", () => {
    for (const furthest of [1, 2, 3, 4]) {
      const forbidden = new Set(CATALOG.filter((entry) => (entry.part ?? 99) > furthest).map((entry) => entry.file));
      for (const seed of SEEDS) {
        const plan = planFor(seed, furthest);
        for (const src of plan.frames) assert.ok(!forbidden.has(src), `${src} at furthestRead=${furthest}`);
      }
    }
  });

  it("shows as many pictures as there are allowed, up to FRAME_WINDOWS, and every allowed picture can appear", () => {
    for (const furthest of [1, 2, 3, 4, 5]) {
      const allowedCount = illustrationsUpTo(CATALOG, furthest).length;
      const seen = new Set<string>();
      for (const seed of SEEDS) {
        const plan = planFor(seed, furthest);
        assert.equal(plan.frames.length, Math.min(FRAME_WINDOWS, allowedCount), `furthest ${furthest}`);
        assert.equal(new Set(plan.frames).size, plan.frames.length, "no picture twice");
        for (const src of plan.frames) seen.add(src);
      }
      assert.equal(seen.size, allowedCount, `every allowed picture shows up for furthestRead=${furthest}`);
    }
  });

  it("a frame-row window with no picture is a silhouette, never an empty window", () => {
    for (const furthest of [null, 1, 2, 3]) {
      for (const seed of SEEDS.slice(0, 60)) {
        for (const window of planFor(seed, furthest).windows) {
          if (window.frameRow && window.kind !== "frame") assert.equal(window.kind, "silhouette");
        }
      }
    }
  });

  it("the frame row is FRAME_WINDOWS windows, pictures only ever sit in it", () => {
    for (const seed of SEEDS) {
      const plan = planFor(seed, 5);
      assert.equal(plan.windows.filter((window) => window.frameRow).length, FRAME_WINDOWS);
      assert.ok(plan.windows.every((window) => window.kind !== "frame" || window.frameRow));
      assert.equal(framesOf(plan).length, FRAME_WINDOWS);
    }
  });

  it("keeps the story's order along the train, head first", () => {
    const order = new Map(CATALOG.map((entry, index) => [entry.file, index]));
    for (const furthest of [3, 5]) {
      for (const seed of SEEDS) {
        const indexes = planFor(seed, furthest).frames.map((src) => order.get(src)!);
        assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b), `seed ${seed}`);
      }
    }
  });

  it("plans no picture when frames are not allowed, however much was read", () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const plan = planFor(seed, 5, { allowFrames: false });
      assert.deepEqual(plan.frames, []);
      assert.equal(framesOf(plan).length, 0);
    }
  });

  it("never plans an illustration whose part is unknown, and ignores one with no catalogue", () => {
    const withStray: IllustrationEntry[] = [...CATALOG, { file: "/stray.webp", part: null }];
    for (const seed of SEEDS) {
      assert.ok(!planTrain({ seed, catalog: withStray, furthestRead: 5 }).frames.includes("/stray.webp"));
    }
    assert.deepEqual(planTrain({ seed: 1, catalog: [], furthestRead: 5 }).frames, []);
    assert.deepEqual(planTrain({ seed: 1, catalog: [{ file: "/x.webp", part: null }], furthestRead: 5 }).frames, []);
  });

  it("reaches different pictures on different visits when the reader has read everything", () => {
    const sets = new Set(SEEDS.slice(0, 30).map((seed) => planFor(seed, 5).frames.join("|")));
    assert.ok(sets.size > 20);
  });
});

describe("layoutTrain", () => {
  const SIZES = [
    { width: 375, height: 134 },
    { width: 390, height: 140 },
    { width: 1280, height: 132 },
    { width: 1920, height: 164 },
    { width: 768, height: 164 },
    { width: 320, height: 100 },
  ];

  it("keeps the body, the windows and the nose inside the canvas", () => {
    for (const size of SIZES) {
      for (const carriages of [CARRIAGES_MIN, CARRIAGES_MAX]) {
        for (const direction of [1, -1] as const) {
          const layout = layoutTrain(size, carriages, direction);
          assert.ok(layout.bodyTop >= 0, "body top");
          assert.ok(layout.bodyBottom <= size.height, "body bottom");
          assert.ok(layout.bodyBottom > size.height - layout.groundH, "the body reaches the platform strip's lip");
          assert.ok(layout.bodyBottom <= size.height - layout.groundH + 2, "and does not run on over the strip");
          assert.ok(layout.groundH > 0 && layout.groundH < size.height / 4);
          assert.equal(layout.windows.length, carriages * WINDOWS_PER_CARRIAGE);
          assert.equal(layout.carriages.length, carriages);
          for (const rect of layout.windows) {
            assert.ok(rect.x >= 0 && rect.x + rect.w <= layout.length, "window inside the sprite");
            assert.ok(rect.y >= layout.bodyTop && rect.y + rect.h <= size.height - layout.groundH, "window above the platform");
          }
        }
      }
    }
  });

  it("scales the whole train from the height: the same height gives the same train at any width", () => {
    const a = layoutTrain({ width: 375, height: 134 }, 5, 1);
    const b = layoutTrain({ width: 1920, height: 134 }, 5, 1);
    assert.deepEqual({ ...a, width: 0 }, { ...b, width: 0 });
  });

  it("makes tall windows that suit a portrait picture", () => {
    for (const size of SIZES) {
      const [first] = layoutTrain(size, 4, 1).windows;
      assert.ok(Math.abs(first.w / first.h - WINDOW_ASPECT) < 0.05);
      // The pre-scaled bitmap is enough for it at the 1.5 DPR cap.
      assert.ok(first.w * 1.5 <= FRAME_BITMAP.width && first.h * 1.5 <= FRAME_BITMAP.height, JSON.stringify(size));
    }
  });

  it("lays windows out without overlap, each carriage's windows inside that carriage", () => {
    for (const direction of [1, -1] as const) {
      const layout = layoutTrain({ width: 1280, height: 132 }, 5, direction);
      const sorted = [...layout.windows].sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].x >= sorted[i - 1].x + sorted[i - 1].w, "no overlap");
      layout.windows.forEach((rect, index) => {
        const car = layout.carriages[Math.floor(index / WINDOWS_PER_CARRIAGE)];
        assert.ok(rect.x >= car.x && rect.x + rect.w <= car.x + car.w, `window ${index} inside its carriage`);
      });
    }
  });

  it("puts the head-most window at the head end of the sprite for either direction", () => {
    const right = layoutTrain({ width: 1280, height: 132 }, 4, 1);
    const left = layoutTrain({ width: 1280, height: 132 }, 4, -1);
    // Moving right: the head is at the right end, so window 0 has the largest x.
    assert.equal(right.windows[0].x, Math.max(...right.windows.map((rect) => rect.x)));
    assert.equal(left.windows[0].x, Math.min(...left.windows.map((rect) => rect.x)));
    // The nose lies beyond window 0 on the head side.
    assert.ok(right.windows[0].x + right.windows[0].w <= right.length - right.noseW);
    assert.ok(left.windows[0].x >= left.noseW);
    // The two layouts are mirror images of each other.
    right.windows.forEach((rect, index) => {
      const mirrored = left.windows[index];
      assert.equal(mirrored.x, right.length - (rect.x + rect.w));
      assert.equal(mirrored.y, rect.y);
      assert.equal(mirrored.w, rect.w);
    });
  });

  it("is lower-third dressing: the train lies inside the lower part of a canvas that is itself the hero's bottom band", () => {
    // The mount is at most 11rem - 0.75rem = 164 px tall and at least 100 px; the train never needs more.
    for (const height of [100, 134, 164]) {
      const layout = layoutTrain({ width: 800, height }, 4, 1);
      assert.ok(layout.bodyTop >= 0.2 * height, `roof gear has room above the body at ${height}`);
    }
  });

  it("survives a degenerate canvas without throwing or going negative", () => {
    for (const size of [{ width: 0, height: 0 }, { width: 1, height: 1 }, { width: 5000, height: 3 }]) {
      const layout = layoutTrain(size, 4, 1);
      assert.ok(Number.isFinite(layout.length) && layout.length > 0);
      assert.ok(layout.windows.every((rect) => Number.isFinite(rect.x) && rect.w >= 0 && rect.h >= 0));
    }
  });
});

describe("trainX0", () => {
  it("starts fully off one edge and ends fully off the other, in either direction", () => {
    const width = 1280;
    const length = 1500;
    assert.equal(trainX0(0, width, length, 1) + length, 0, "moving right: the sprite's right edge is at the left edge");
    assert.equal(trainX0(1, width, length, 1), width);
    assert.equal(trainX0(0, width, length, -1), width);
    assert.equal(trainX0(1, width, length, -1) + length, 0);
  });

  it("moves at one constant speed and never reverses", () => {
    for (const direction of [1, -1] as const) {
      let previous = trainX0(0, 800, 1200, direction);
      let step: number | null = null;
      for (let u = 0.05; u <= 1.0001; u += 0.05) {
        const x = trainX0(u, 800, 1200, direction);
        const delta = x - previous;
        assert.ok(direction > 0 ? delta > 0 : delta < 0);
        if (step !== null) assert.ok(Math.abs(delta - step) < 1e-6);
        step = delta;
        previous = x;
      }
    }
  });

  it("clamps progress outside 0..1 and ignores NaN", () => {
    assert.equal(trainX0(-1, 800, 1200, 1), trainX0(0, 800, 1200, 1));
    assert.equal(trainX0(7, 800, 1200, 1), trainX0(1, 800, 1200, 1));
    assert.equal(trainX0(Number.NaN, 800, 1200, -1), trainX0(0, 800, 1200, -1));
  });

  it("the train is on screen for most of the travel, so a pass is mostly train", () => {
    const width = 1280;
    const length = 1400;
    const seen = [];
    for (let u = 0; u <= 1; u += 0.01) {
      const x = trainX0(u, width, length, 1);
      seen.push(x < width && x + length > 0);
    }
    assert.ok(seen.filter(Boolean).length >= 95);
  });
});

describe("what the page hands the train", () => {
  const page = read("src/pages/tsukinomi/index.astro");

  it("the mount carries the catalogue the scene parses, and it is hidden from assistive technology", () => {
    assert.match(page, /data-train-mount/);
    assert.match(page, /data-illustrations=\{JSON\.stringify\(illustrations\)\}/);
    assert.match(page, /aria-hidden="true"/);
    // The embedded entries use the keys parseCatalog reads.
    assert.match(page, /src: withBase\(/);
    assert.match(page, /part: entry\.part/);
  });
});
