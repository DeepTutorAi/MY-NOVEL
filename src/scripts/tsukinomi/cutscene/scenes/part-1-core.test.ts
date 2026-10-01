// The pure half of the part 1 cutscene: the coverage grid, the reader's strokes,
// the automatic wipe's schedule and the way the fog parts, the epigraph's haze,
// the weather (rain, droplets, the train's light) planned for the compositor,
// the clock and the stamp log. The rules they protect: the fog is gone by
// FOG_GONE_S however the reader acts, the keyboard's wipe is quick, the rain
// loops without a seam and the epigraph is readable for long enough.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { createRng } from "../../../_shared/scene-runtime";
import {
  AUTO_WIPE_END_S,
  AUTO_WIPE_START_S,
  CLEAR_FRACTION,
  ENVELOPE_SAMPLES,
  FAST_WIPE_SPEED,
  FOG_FADE_S,
  FOG_GONE_S,
  INTRO_S,
  OUTRO_S,
  RAIN_SLANT,
  REVEAL_STEPS,
  SCENE_END_S,
  TRAIN_DURATION_S,
  TRAIN_START_S,
  autoProgress,
  brushRadius,
  clamp01,
  coverRect,
  createCoverageGrid,
  createDroplets,
  createRain,
  createSceneClock,
  createStampLog,
  createWipeSchedule,
  curtainCoverage,
  curtainEdges,
  curtainGeometry,
  curtainSteps,
  dropletCount,
  easeToward,
  envelopeSteps,
  fogIsClear,
  fogScale,
  gridCell,
  growRect,
  insideRect,
  placeTrain,
  planDroplets,
  planRain,
  quantizeReveal,
  rainCount,
  rainEnvelope,
  revealFor,
  secondsToClear,
  smoothstep,
  stampsAlong,
  stepDroplets,
  strokeRepeats,
  trainEnvelope,
  trainLightSteps,
  trainProgress,
} from "./part-1-core";

// The five layout viewports of the design's section 7, plus a desktop.
const SIZES = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 812, height: 375 },
  { width: 667, height: 375 },
  { width: 915, height: 412 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const;

describe("small maths", () => {
  it("clamps to 0..1 and treats non-numbers as 0", () => {
    assert.equal(clamp01(-3), 0);
    assert.equal(clamp01(7), 1);
    assert.equal(clamp01(0.25), 0.25);
    assert.equal(clamp01(Number.NaN), 0);
  });

  it("smoothstep is 0 below, 1 above and monotone between", () => {
    assert.equal(smoothstep(0.2, 0.8, 0.1), 0);
    assert.equal(smoothstep(0.2, 0.8, 0.9), 1);
    let last = 0;
    for (let v = 0.2; v <= 0.8; v += 0.01) {
      const s = smoothstep(0.2, 0.8, v);
      assert.ok(s >= last);
      last = s;
    }
    assert.equal(smoothstep(0.5, 0.5, 0.4), 0, "a zero-width edge is a step, not a division by zero");
  });

  it("easeToward moves toward the target without overshoot, whatever the frame rate", () => {
    const one = easeToward(0, 1, 1, 0.5);
    let many = 0;
    for (let i = 0; i < 60; i++) many = easeToward(many, 1, 1 / 60, 0.5);
    assert.ok(one > 0 && one < 1);
    assert.ok(Math.abs(one - many) < 1e-9, "one 1 s step equals sixty 1/60 s steps");
    assert.equal(easeToward(0.3, 1, 0, 0.5), 0.3, "no time passed, no move");
    assert.equal(easeToward(0.3, 1, 0.1, 0), 1, "no time constant: straight to the target");
  });
});

describe("timeline", () => {
  it("keeps the fog's end inside 6 s and leaves the epigraph readable for at least 8 s after it", () => {
    assert.ok(AUTO_WIPE_START_S >= 0 && AUTO_WIPE_START_S < AUTO_WIPE_END_S);
    assert.ok(AUTO_WIPE_END_S < FOG_GONE_S);
    assert.ok(FOG_GONE_S <= 6 + 1e-9, "the fog is gone within 6 s of the scene being ready");
    assert.ok(Math.abs(FOG_GONE_S - AUTO_WIPE_END_S - FOG_FADE_S) < 1e-9, "the film's fade starts when the plan ends");
    assert.ok(SCENE_END_S >= 20 && SCENE_END_S <= 30, "20 to 30 s in all");
    assert.ok(SCENE_END_S - FOG_GONE_S >= 8, "the epigraph stays crisp for at least 8 s");
  });

  it("puts the train's pass after the fog and before the rain eases off", () => {
    assert.ok(TRAIN_START_S > FOG_GONE_S);
    assert.ok(TRAIN_START_S + TRAIN_DURATION_S < SCENE_END_S - OUTRO_S);
  });
});

describe("layout helpers", () => {
  it("coverRect crops the image to the box's aspect, centred, without distortion", () => {
    const wide = coverRect(1536, 864, 375, 812); // portrait box on a landscape image
    assert.ok(Math.abs(wide.width / wide.height - 375 / 812) < 1e-9);
    assert.equal(wide.height, 864, "the full height is used");
    assert.ok(Math.abs(wide.x - (1536 - wide.width) / 2) < 1e-9);
    const same = coverRect(1536, 864, 1920, 1080);
    assert.deepEqual({ ...same, x: Math.round(same.x), y: Math.round(same.y) }, { x: 0, y: 0, width: 1536, height: 864 });
    const tall = coverRect(1536, 864, 1000, 100); // a very wide box crops top and bottom
    assert.equal(tall.width, 1536);
    assert.ok(tall.height < 864);
  });

  it("coverRect survives degenerate sizes", () => {
    assert.deepEqual(coverRect(0, 0, 100, 100), { x: 0, y: 0, width: 0, height: 0 });
    assert.deepEqual(coverRect(100, 50, 0, 10), { x: 0, y: 0, width: 100, height: 50 });
  });

  it("brushRadius stays between a finger and a palm", () => {
    for (const { width, height } of SIZES) {
      const r = brushRadius(width, height);
      assert.ok(r >= 28 && r <= 58, `${width}x${height}: ${r}`);
    }
    assert.ok(brushRadius(375, 812) < brushRadius(1280, 800));
  });

  it("fogScale never upsizes and keeps the bitmap near 720 px on its long side", () => {
    assert.equal(fogScale(400, 300), 1);
    assert.ok(Math.abs(fogScale(1440, 900) * 1440 - 720) < 1e-9);
    assert.equal(fogScale(0, 0), 1);
  });

  it("keeps the particle counts small", () => {
    for (const { width, height } of SIZES) {
      assert.ok(rainCount(width, height) >= 36 && rainCount(width, height) <= 90);
      assert.ok(dropletCount(width, height) >= 7 && dropletCount(width, height) <= 14);
    }
  });

  it("growRect pads all four sides", () => {
    assert.deepEqual(growRect({ x: 10, y: 20, width: 100, height: 50 }, 5), { x: 5, y: 15, width: 110, height: 60 });
  });

  it("insideRect includes its edges and excludes everything else", () => {
    const box = { x: 10, y: 20, width: 100, height: 50 };
    assert.equal(insideRect(10, 20, box), true);
    assert.equal(insideRect(110, 70, box), true);
    assert.equal(insideRect(60, 45, box), true);
    assert.equal(insideRect(9.9, 45, box), false);
    assert.equal(insideRect(60, 70.1, box), false);
  });

  it("gridCell stays within bounds", () => {
    assert.equal(gridCell(10), 14);
    assert.equal(gridCell(58), 28);
    assert.equal(gridCell(40), 20);
  });
});

describe("coverage grid", () => {
  it("starts fogged, counts cells as stamps land and never counts one twice", () => {
    const grid = createCoverageGrid(200, 100, 10);
    assert.equal(grid.cols, 20);
    assert.equal(grid.rows, 10);
    assert.equal(grid.total, 200);
    assert.equal(grid.fraction(), 0);
    const added = grid.mark(100, 50, 25);
    assert.ok(added > 0);
    assert.equal(grid.count, added);
    assert.equal(grid.mark(100, 50, 25), 0, "the same stamp again adds nothing");
    assert.equal(grid.fraction(), added / 200);
  });

  it("marks only cells whose centre is inside the radius", () => {
    const grid = createCoverageGrid(100, 100, 10);
    grid.mark(50, 50, 4);
    assert.equal(grid.count, 0, "no cell centre (5, 15, ...) lies within 4 of (50, 50)");
    grid.mark(55, 55, 1);
    assert.equal(grid.count, 1, "the centre of the cell at (5, 5) is exactly there");
    assert.equal(grid.isCleared(55, 55), true);
    assert.equal(grid.isCleared(45, 55), false);
  });

  it("ignores stamps outside the grid and a zero radius, and reads points outside as clear", () => {
    const grid = createCoverageGrid(100, 100, 10);
    assert.equal(grid.mark(-500, -500, 30), 0);
    assert.equal(grid.mark(500, 500, 30), 0);
    assert.equal(grid.mark(50, 50, 0), 0);
    assert.equal(grid.isCleared(-1, 50), true);
    assert.equal(grid.isCleared(50, 1000), true);
  });

  it("measures a rectangle on its own, and falls back to the whole grid for an empty one", () => {
    const grid = createCoverageGrid(100, 100, 10);
    grid.mark(25, 25, 40); // the top-left quarter, with a margin
    assert.equal(grid.fractionIn({ x: 0, y: 0, width: 50, height: 50 }), 1);
    assert.equal(grid.fractionIn({ x: 60, y: 60, width: 40, height: 40 }), 0);
    assert.equal(grid.fractionIn({ x: 1000, y: 1000, width: 5, height: 5 }), grid.fraction(), "no cell inside: the whole grid's share");
    grid.clearAll();
    assert.equal(grid.fraction(), 1);
    assert.equal(grid.fractionIn({ x: 0, y: 0, width: 100, height: 100 }), 1);
    assert.equal(grid.count, grid.total);
  });

  it("copes with a zero-sized stage", () => {
    const grid = createCoverageGrid(0, 0, 10);
    assert.ok(grid.total >= 1);
    assert.ok(Number.isFinite(grid.fraction()));
  });
});

describe("stampsAlong", () => {
  it("places stamps one spacing apart along the segment", () => {
    const { points, carry } = stampsAlong({ x: 0, y: 0 }, { x: 100, y: 0 }, 20, 0);
    assert.deepEqual(points, [20, 40, 60, 80, 100].map((x) => ({ x, y: 0 })));
    assert.equal(carry, 0);
  });

  it("carries the leftover distance, so many short segments space like one long one", () => {
    const whole = stampsAlong({ x: 0, y: 0 }, { x: 100, y: 60 }, 13, 0).points;
    const parts: { x: number; y: number }[] = [];
    let carry = 0;
    let last = { x: 0, y: 0 };
    for (let i = 1; i <= 25; i++) {
      const to = { x: (100 * i) / 25, y: (60 * i) / 25 };
      const result = stampsAlong(last, to, 13, carry);
      parts.push(...result.points);
      carry = result.carry;
      last = to;
    }
    assert.equal(parts.length, whole.length);
    parts.forEach((p, i) => {
      assert.ok(Math.abs(p.x - whole[i].x) < 1e-9 && Math.abs(p.y - whole[i].y) < 1e-9, `stamp ${i}`);
    });
  });

  it("stamps nothing for a zero-length move and keeps the carry", () => {
    assert.deepEqual(stampsAlong({ x: 5, y: 5 }, { x: 5, y: 5 }, 10, 4), { points: [], carry: 4 });
  });

  it("caps the stamps of one flick", () => {
    const { points } = stampsAlong({ x: 0, y: 0 }, { x: 100000, y: 0 }, 5, 0, 64);
    assert.equal(points.length, 64);
  });
});

describe("wipe schedule: the glass clears itself", () => {
  it("does nothing before AUTO_WIPE_START_S, then eases to the end of the plan at AUTO_WIPE_END_S", () => {
    assert.equal(autoProgress(0), 0);
    assert.equal(autoProgress(AUTO_WIPE_START_S), 0);
    assert.ok(autoProgress((AUTO_WIPE_START_S + AUTO_WIPE_END_S) / 2) > 0.45);
    assert.equal(autoProgress(AUTO_WIPE_END_S), 1);
    assert.equal(autoProgress(100), 1);
    let last = 0;
    for (let t = 0; t <= 8; t += 0.05) {
      const value = autoProgress(t);
      assert.ok(value >= last);
      last = value;
    }
  });

  it("without the reader doing anything, the plan has run its course by AUTO_WIPE_END_S, which is inside FOG_GONE_S, and the parting has cleared the whole glass", () => {
    const schedule = createWipeSchedule();
    assert.equal(schedule.progressAt(AUTO_WIPE_END_S), 1);
    assert.ok(AUTO_WIPE_END_S + FOG_FADE_S <= FOG_GONE_S + 1e-9);
    for (const { width, height } of SIZES) {
      for (const anchor of [height / 2, 0, height, height * 0.2]) {
        const g = curtainGeometry(height, anchor);
        assert.equal(curtainCoverage(g, schedule.progressAt(AUTO_WIPE_END_S), 0, height), 1, `${width}x${height} anchored at ${anchor}`);
        assert.ok(curtainCoverage(g, schedule.progressAt(AUTO_WIPE_START_S), 0, height) < 1e-9, "nothing is cleared before the plan starts");
      }
    }
    assert.equal(fogIsClear(AUTO_WIPE_END_S, 0), true);
    assert.equal(fogIsClear(AUTO_WIPE_END_S - 0.5, 0.2), false, "a reader who has wiped little still has fog until the plan is done");
    assert.equal(fogIsClear(0, CLEAR_FRACTION), true, "a reader who cleared it early does not have to wait");
  });

  it("the fast wipe clears the glass in about 1.4 s, from wherever the automatic one had got", () => {
    for (const requestAt of [0, 0.5, 2.5, 4]) {
      const schedule = createWipeSchedule();
      schedule.requestFast(requestAt);
      const rest = secondsToClear((seconds) => schedule.progressAt(requestAt + seconds));
      assert.ok(rest <= 1 / FAST_WIPE_SPEED + 0.1, `requested at ${requestAt}: ${rest} s to go`);
    }
    // Asked for at the very start it is the whole 1.4 s, not the automatic 5.4.
    const schedule = createWipeSchedule();
    schedule.requestFast(0);
    assert.ok(secondsToClear((seconds) => schedule.progressAt(seconds)) > 1.2);
  });

  it("never runs slower than the automatic wipe, never goes backwards, and only the first request counts", () => {
    const schedule = createWipeSchedule();
    assert.equal(schedule.fastRequested, false);
    schedule.requestFast(2);
    schedule.requestFast(0.1);
    assert.equal(schedule.fastRequested, true);
    let last = 0;
    for (let t = 0; t <= 9; t += 0.05) {
      const value = schedule.progressAt(t);
      assert.ok(value >= autoProgress(t) - 1e-12);
      assert.ok(value >= last - 1e-12);
      assert.ok(value <= 1);
      last = value;
    }
    const later = createWipeSchedule();
    later.requestFast(2);
    assert.ok(Math.abs(schedule.progressAt(2.7) - later.progressAt(2.7)) < 1e-12, "the second request changed nothing");
  });

  it("keeps the schedule finite for odd times", () => {
    const schedule = createWipeSchedule();
    for (const t of [-5, 0, Number.NaN, 1e9]) assert.ok(Number.isFinite(schedule.progressAt(t)));
  });
});

describe("the epigraph's haze", () => {
  it("is hazed with the glass fogged, crisp once most of it is clear, and rises with coverage", () => {
    assert.equal(revealFor(0), 0);
    assert.equal(revealFor(0.05), 0);
    assert.equal(revealFor(0.9), 1);
    assert.equal(revealFor(1), 1);
    let last = 0;
    for (let c = 0; c <= 1; c += 0.01) {
      const value = revealFor(c);
      assert.ok(value >= last);
      last = value;
    }
  });

  it("quantizes to a few steps, so the DOM is written only when the level changes", () => {
    const seen = new Set<number>();
    for (let v = 0; v <= 1; v += 0.001) seen.add(quantizeReveal(v));
    assert.equal(seen.size, REVEAL_STEPS + 1);
    assert.equal(quantizeReveal(-1), 0);
    assert.equal(quantizeReveal(2), 1);
    assert.equal(quantizeReveal(Number.NaN), 0);
  });
});

describe("weather", () => {
  it("fades the rain in over the intro, holds it, and eases it off without ending it", () => {
    assert.equal(rainEnvelope(0), 0);
    assert.equal(rainEnvelope(INTRO_S), 1);
    assert.equal(rainEnvelope(10), 1);
    const end = rainEnvelope(SCENE_END_S);
    assert.ok(end > 0.3 && end < 0.4);
    let last = 1;
    for (let t = SCENE_END_S - OUTRO_S; t <= SCENE_END_S; t += 0.05) {
      const value = rainEnvelope(t);
      assert.ok(value <= last + 1e-12);
      last = value;
    }
  });

  it("passes the train's light once, smoothly", () => {
    assert.equal(trainEnvelope(TRAIN_START_S - 1), 0);
    assert.equal(trainEnvelope(TRAIN_START_S), 0);
    assert.ok(Math.abs(trainEnvelope(TRAIN_START_S + TRAIN_DURATION_S / 2) - 1) < 1e-9);
    assert.equal(trainEnvelope(TRAIN_START_S + TRAIN_DURATION_S), 0);
    assert.equal(trainProgress(0), 0);
    assert.equal(trainProgress(99), 1);
    // It never jumps: neighbouring samples 1/60 s apart differ by far less than the 10 percent a flash needs.
    for (let t = 0; t < SCENE_END_S; t += 1 / 60) {
      assert.ok(Math.abs(trainEnvelope(t + 1 / 60) - trainEnvelope(t)) < 0.05);
    }
  });

  it("keeps the train's light clear of the epigraph: below it if there is room, else above, else none", () => {
    const band = 50;
    const clear = (y: number | null, text: { y: number; height: number }) =>
      y === null || y + band <= text.y || y - band >= text.y + text.height;
    assert.equal(placeTrain(800, null, band), 480, "no text box: three fifths down");
    const middle = { x: 300, y: 290, width: 600, height: 220 };
    const below = placeTrain(800, middle, band);
    assert.ok(below !== null && below > middle.y + middle.height, "below the text");
    assert.ok(clear(below, middle));
    const low = { x: 0, y: 500, width: 300, height: 260 };
    const above = placeTrain(800, low, band);
    assert.ok(above !== null && above < low.y, "above the text when there is no room below");
    assert.ok(clear(above, low));
    const tall = { x: 0, y: 5, width: 300, height: 360 };
    assert.equal(placeTrain(375, tall, band), null, "no room anywhere: no train");
    const top = { x: 0, y: 20, width: 300, height: 100 };
    assert.equal(placeTrain(800, top, band), 480, "text well above the preferred band: stays there");
    for (const height of [375, 412, 800, 812, 1080]) {
      for (let y = 0; y <= height; y += 25) {
        const box = { x: 0, y, width: 200, height: Math.min(300, height - y) };
        assert.ok(clear(placeTrain(height, box, band), box), `height ${height}, text at ${y}`);
      }
    }
  });

  it("lays rain out the same way for a seed, with finite streaks inside the glass", () => {
    const run = () => createRain(60, 1280, 800, createRng(77));
    const a = run();
    assert.deepEqual(a, run());
    assert.equal(a.length, 60);
    for (const s of a) {
      for (const value of [s.x, s.y, s.len, s.speed, s.alpha, s.width]) assert.ok(Number.isFinite(value));
      assert.ok(s.y - s.len <= 800 && s.y <= 800, "no streak starts below the glass");
      assert.ok(s.speed > 0 && s.len > 0 && s.alpha > 0 && s.alpha < 1);
    }
  });

  it("droplets sit still, run down in short slides and start again from the top after leaving", () => {
    const rng = createRng(21);
    const drops = createDroplets(14, 800, 600, rng);
    let slides = 0;
    let maxStep = 0;
    for (let i = 0; i < 60 * 40; i++) {
      slides += stepDroplets(drops, 1 / 60, 800, 600, rng) > 0 ? 1 : 0;
      for (const d of drops) {
        assert.ok(Number.isFinite(d.y) && Number.isFinite(d.x));
        assert.ok(d.y >= d.previousY || d.previousY > 0 || d.y < 0, "a droplet only runs down, apart from starting over");
        if (d.y >= d.previousY) maxStep = Math.max(maxStep, d.y - d.previousY);
      }
    }
    assert.ok(slides > 0, "something ran in 40 s");
    assert.ok(maxStep < 8, `a droplet moved ${maxStep} px in one frame: it runs, it does not jump`);
    for (const d of drops) assert.ok(d.y - d.radius <= 600 + 2, "no droplet is left below the glass");
  });

  it("droplets stay put when no time passes", () => {
    const rng = createRng(3);
    const drops = createDroplets(5, 300, 300, rng);
    const before = drops.map((d) => d.y);
    assert.equal(stepDroplets(drops, 0, 300, 300, rng), 0);
    assert.deepEqual(drops.map((d) => d.y), before);
  });
});

describe("the clock", () => {
  let now = 1000;
  const clock = () => createSceneClock(() => now);
  beforeEach(() => {
    now = 1000;
  });

  it("counts from the moment it is started, stops while held, and carries on from where it stopped", () => {
    const c = clock();
    assert.equal(c.elapsedMs(), 0);
    assert.equal(c.started, false);
    now = 1500;
    assert.equal(c.elapsedMs(), 0, "not before the start");
    c.start();
    now = 2250;
    assert.equal(c.elapsedMs(), 750);
    c.hold();
    assert.equal(c.held, true);
    now = 9250;
    assert.equal(c.elapsedMs(), 750, "a hidden tab does not advance the scene");
    c.release();
    now = 9450;
    assert.equal(c.elapsedMs(), 950);
  });

  it("ignores a second start, a hold before the start, a second hold and a release that was not held", () => {
    const c = clock();
    c.hold();
    assert.equal(c.held, false);
    c.start();
    now = 1400;
    c.start();
    c.release();
    now = 1600;
    c.hold();
    now = 2600;
    c.hold();
    c.release();
    now = 2700;
    assert.equal(c.elapsedMs(), 600 + 100);
  });
});

describe("the weather's envelope for the compositor", () => {
  it("fades in over the intro and eases off over the outro, as rainEnvelope does", () => {
    const intro = envelopeSteps("intro");
    const outro = envelopeSteps("outro");
    assert.equal(intro.length, ENVELOPE_SAMPLES + 1);
    assert.deepEqual([intro[0].offset, intro[intro.length - 1].offset], [0, 1]);
    assert.equal(intro[0].value, 0);
    assert.equal(intro[intro.length - 1].value, 1);
    assert.equal(outro[0].value, 1);
    assert.ok(Math.abs(outro[outro.length - 1].value - rainEnvelope(SCENE_END_S)) < 1e-12);
    for (let index = 1; index < intro.length; index++) assert.ok(intro[index].value >= intro[index - 1].value);
    for (let index = 1; index < outro.length; index++) assert.ok(outro[index].value <= outro[index - 1].value);
    assert.ok(intro[3].value === rainEnvelope(INTRO_S * (3 / ENVELOPE_SAMPLES)));
    assert.ok(outro[3].value === rainEnvelope(SCENE_END_S - OUTRO_S + OUTRO_S * (3 / ENVELOPE_SAMPLES)));
  });
});

describe("rain planned as two tall canvases", () => {
  const plansFor = (width: number, height: number, seed = 5) => planRain(width, height, createRng(seed));

  it("is two layers, far and near, the same for a seed", () => {
    const plans = plansFor(1280, 800);
    assert.deepEqual(plans.map((plan) => plan.name), ["far", "near"]);
    assert.deepEqual(plansFor(1280, 800), plans);
    assert.notDeepEqual(plansFor(1280, 800, 6), plans);
  });

  it("moves each layer by exactly one period along the slant, so that its end is its beginning", () => {
    for (const { width, height } of SIZES) {
      for (const plan of plansFor(width, height)) {
        assert.equal(plan.shiftX, RAIN_SLANT * plan.periodY);
        assert.ok(plan.periodY >= 360 && plan.periodY <= 900);
        assert.ok(plan.durationS > 0.2 && plan.durationS < 3, `${plan.name} loops every ${plan.durationS} s`);
      }
    }
    const [far, near] = plansFor(1280, 800);
    assert.ok(far.periodY / far.durationS < near.periodY / near.durationS, "the near rain falls faster than the far");
  });

  it("covers the whole stage at every point of the move, never showing the edge of a plane", () => {
    for (const { width, height } of SIZES) {
      for (const plan of plansFor(width, height)) {
        for (let p = 0; p <= 1.0001; p += 0.05) {
          const left = plan.left + p * plan.shiftX;
          const top = plan.top + p * plan.periodY;
          assert.ok(left <= 1e-9, `${plan.name} ${width}x${height} p=${p}: left edge ${left}`);
          assert.ok(left + plan.planeWidth >= width - 1e-9, `${plan.name} p=${p}: right edge ${left + plan.planeWidth} < ${width}`);
          assert.ok(top <= 1e-9, `${plan.name} p=${p}: top edge ${top}`);
          assert.ok(top + plan.planeHeight >= height - 1e-9, `${plan.name} p=${p}: bottom edge ${top + plan.planeHeight} < ${height}`);
        }
      }
    }
  });

  it("has about as many streaks on the stage as rainCount says, split between the layers", () => {
    for (const { width, height } of SIZES) {
      const plans = plansFor(width, height);
      let onStage = 0;
      for (const plan of plans) {
        const area = plan.baseWidth * plan.periodY;
        // The strokes of one period spread over `area`; the stage is width * height of it.
        onStage += (plan.strokes.length * width * height) / area;
      }
      const expected = rainCount(width, height);
      assert.ok(onStage > expected * 0.6 && onStage < expected * 1.6, `${width}x${height}: ${onStage.toFixed(1)} against ${expected}`);
    }
  });

  it("repeats a streak one period further along the slant for as long as it touches the plane, and never off it", () => {
    const [far] = plansFor(1280, 800);
    const plan = { ...far, planeWidth: 1380, planeHeight: 1380, periodY: 600, shiftX: RAIN_SLANT * 600 };
    const stroke = { x: 700, y: 100, len: 30, alpha: 0.3, width: 1 };
    const repeats = strokeRepeats(plan, stroke);
    assert.deepEqual(repeats.map((at) => at.y), [100, 700, 1300]);
    assert.deepEqual(repeats.map((at) => at.x), [700, 700 + RAIN_SLANT * 600, 700 + RAIN_SLANT * 1200]);
    for (const at of repeats) {
      assert.ok(at.y >= 0 && at.y - 30 <= plan.planeHeight);
      assert.ok(at.x - RAIN_SLANT * 30 >= 0 && at.x <= plan.planeWidth);
    }
    assert.deepEqual(strokeRepeats(plan, { ...stroke, x: 100000 }), [], "a streak off the right edge is not drawn");
  });

  it("makes the first and the last frame of the move the same picture: every streak at one end has its repeat at the other", () => {
    for (const plan of plansFor(1280, 800)) {
      for (const stroke of plan.strokes) {
        const at = strokeRepeats(plan, stroke);
        // A repeat that is inside the plane for k also has its successor inside unless it left the bottom or the right.
        for (let index = 1; index < at.length; index++) {
          assert.ok(Math.abs(at[index].y - at[index - 1].y - plan.periodY) < 1e-9);
          assert.ok(Math.abs(at[index].x - at[index - 1].x - plan.shiftX) < 1e-9);
        }
      }
    }
  });
});

describe("droplets planned as slides", () => {
  const plan = (seed = 9, horizon = 21) => planDroplets(12, 1280, 800, createRng(seed), horizon);

  it("is the same for a seed", () => {
    assert.deepEqual(plan(), plan());
    assert.notDeepEqual(plan(), plan(10));
  });

  it("has every droplet sit, then run down in short slides, each starting after the last has ended", () => {
    const plans = plan();
    assert.ok(plans.length >= 12);
    let slides = 0;
    for (const p of plans) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.radius > 0);
      let previousEnd = p.fromS;
      let y = p.y;
      for (const slide of p.slides) {
        slides++;
        assert.ok(slide.durationS > 0 && slide.durationS <= 1.4, `a slide of ${slide.durationS} s`);
        assert.ok(slide.startS >= previousEnd - 1e-9, "no slide starts before the last one ended");
        assert.ok(Math.abs(slide.fromY - y) < 1.5, `starts where the last stopped: ${slide.fromY} against ${y}`);
        assert.ok(slide.toY > slide.fromY, "a droplet only runs down");
        assert.ok(slide.toY - slide.fromY < 160, "a short way");
        previousEnd = slide.startS + slide.durationS;
        y = slide.toY;
      }
    }
    assert.ok(slides >= 12, `${slides} slides in 21 s`);
  });

  it("replaces a droplet that ran off the glass with a new one at the top, which appears when it did", () => {
    const plans = plan(3, 60);
    const later = plans.filter((p) => p.fromS > 0);
    assert.ok(later.length > 0, "something ran off the glass in a minute");
    for (const p of later) assert.ok(p.y < 0, "a new droplet starts above the glass");
    for (const p of plans) assert.ok(p.slides.every((slide) => slide.startS >= p.fromS));
  });

  it("keeps the number of slides running at once small", () => {
    const plans = plan(4);
    const slides = plans.flatMap((p) => p.slides);
    let busiest = 0;
    for (let t = 0; t < 21; t += 0.05) busiest = Math.max(busiest, slides.filter((slide) => slide.startS <= t && t < slide.startS + slide.durationS).length);
    assert.ok(busiest <= 8, `${busiest} at once`);
  });

  it("rests longer when the pace is slowed, so there are fewer slides", () => {
    const slow = planDroplets(12, 1280, 800, createRng(9), 21, 0.05, 2).flatMap((p) => p.slides).length;
    const normal = planDroplets(12, 1280, 800, createRng(9), 21, 0.05, 1).flatMap((p) => p.slides).length;
    assert.ok(slow < normal, `${slow} against ${normal}`);
  });
});

describe("the fog parting from the epigraph", () => {
  it("covers the whole stage with the two sheets, which overlap by a soft edge on each side of the anchor", () => {
    for (const height of [375, 412, 800, 812, 1080]) {
      for (const anchor of [0, height * 0.3, height / 2, height, -50, height + 50, Number.NaN]) {
        const g = curtainGeometry(height, anchor);
        assert.ok(g.anchor >= 0 && g.anchor <= height);
        assert.equal(g.upHeight, Math.min(height, g.anchor + g.soft));
        assert.equal(g.downTop, Math.max(0, g.anchor - g.soft));
        assert.equal(g.downHeight, height - g.downTop);
        assert.ok(g.upHeight >= g.downTop, "the sheets overlap or meet: no seam");
        assert.ok(g.soft >= 36 && g.soft <= 110);
      }
    }
  });

  it("starts with the glass wholly fogged and ends with it wholly clear, the edges moving apart", () => {
    const g = curtainGeometry(800, 400);
    const start = curtainEdges(g, 0);
    const end = curtainEdges(g, 1);
    assert.equal(start.up, g.upHeight);
    assert.equal(start.down, g.downTop);
    assert.deepEqual(end, { up: 0, down: 800 });
    let last = curtainEdges(g, 0);
    for (let p = 0.05; p <= 1.0001; p += 0.05) {
      const edges = curtainEdges(g, p);
      assert.ok(edges.up <= last.up && edges.down >= last.down, "the upper edge only goes up, the lower one only down");
      last = edges;
    }
    assert.deepEqual(curtainEdges(g, -3), start);
    assert.deepEqual(curtainEdges(g, 9), end);
  });

  it("clears the part of the glass nearest the epigraph first, and every part by the end", () => {
    const g = curtainGeometry(800, 400);
    const text = [340, 460] as const;
    const far = [20, 100] as const;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      assert.ok(curtainCoverage(g, p, ...text) >= curtainCoverage(g, p, ...far) - 1e-12, `p=${p}`);
    }
    assert.ok(curtainCoverage(g, 0, ...text) < 1e-9);
    assert.equal(curtainCoverage(g, 1, ...far), 1);
    assert.equal(curtainCoverage(g, 1, 0, 800), 1);
    let last = 0;
    for (let p = 0; p <= 1.0001; p += 0.02) {
      const value = curtainCoverage(g, p, ...text);
      assert.ok(value >= last - 1e-12);
      last = value;
    }
    assert.equal(curtainCoverage(g, 0.5, 100, 100), 0.5, "an empty span reads as the plan's own progress");
  });

  it("samples the plan into keyframes: how far each sheet has moved, from nothing to its whole height", () => {
    const g = curtainGeometry(800, 300);
    const schedule = createWipeSchedule();
    const rest = secondsToClear((seconds) => schedule.progressAt(seconds));
    assert.ok(Math.abs(rest - AUTO_WIPE_END_S) < 0.06, `the whole plan takes ${rest} s from the start`);
    const steps = curtainSteps(g, (seconds) => schedule.progressAt(seconds), rest, 24);
    assert.equal(steps.length, 25);
    assert.deepEqual([steps[0].offset, steps[24].offset], [0, 1]);
    assert.deepEqual([steps[0].up, steps[0].down], [0, 0]);
    assert.ok(Math.abs(steps[24].up - g.upHeight) < 1e-6 && Math.abs(steps[24].down - g.downHeight) < 1e-6);
    for (let index = 1; index < steps.length; index++) {
      assert.ok(steps[index].up >= steps[index - 1].up && steps[index].down >= steps[index - 1].down);
    }
    // The wait before the plan starts is part of the motion: the sheets do not move for AUTO_WIPE_START_S.
    assert.equal(steps.filter((step) => step.progress === 0).length > 3, true);
  });

  it("finds how long the plan has left, from now, in a quicker plan too, and never longer than the limit", () => {
    const schedule = createWipeSchedule();
    assert.equal(secondsToClear((seconds) => schedule.progressAt(6 + seconds)), 0, "a finished plan has nothing left");
    assert.equal(secondsToClear(() => 0.2, 4), 4, "a plan that never finishes is cut at the limit");
    const fast = createWipeSchedule();
    fast.requestFast(1);
    const slow = secondsToClear((seconds) => schedule.progressAt(1 + seconds));
    assert.ok(secondsToClear((seconds) => fast.progressAt(1 + seconds)) < slow);
  });
});

describe("the train's light planned as keyframes", () => {
  it("passes once across the glass, rising and falling smoothly, 0.8 at the most", () => {
    const steps = trainLightSteps();
    assert.deepEqual([steps[0].offset, steps[steps.length - 1].offset], [0, 1]);
    assert.deepEqual([steps[0].progress, steps[steps.length - 1].progress], [0, 1]);
    assert.equal(steps[0].opacity, 0);
    assert.equal(steps[steps.length - 1].opacity, 0);
    const peak = Math.max(...steps.map((step) => step.opacity));
    assert.ok(peak <= 0.8 + 1e-12 && peak > 0.7);
    for (let index = 1; index < steps.length; index++) {
      assert.ok(steps[index].progress >= steps[index - 1].progress);
      assert.ok(Math.abs(steps[index].opacity - steps[index - 1].opacity) < 0.25, "no jump from one keyframe to the next");
    }
  });
});

describe("stamp log", () => {
  it("replays the stamps in order and clears", () => {
    const log = createStampLog(10);
    log.add(0.1, 0.2, 0.05);
    log.add(0.5, 0.5, 0.06);
    const seen: number[][] = [];
    log.forEach((x, y, r) => seen.push([Math.round(x * 100), Math.round(y * 100), Math.round(r * 100)]));
    assert.deepEqual(seen, [[10, 20, 5], [50, 50, 6]]);
    assert.equal(log.length, 2);
    log.clear();
    assert.equal(log.length, 0);
    let visited = 0;
    log.forEach(() => visited++);
    assert.equal(visited, 0);
  });

  it("ignores stamps beyond its capacity", () => {
    const log = createStampLog(3);
    for (let i = 0; i < 10; i++) log.add(i / 10, 0, 0.1);
    assert.equal(log.length, 3);
  });
});

// The scene module itself imports a stylesheet and draws, so node cannot run it; these read its source
// for the rules the design and the performance budget set, the way cutscene-contract.test.ts does.
describe("part 1 scene source rules", () => {
  const read = (name: string) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");
  const code = (name: string) => read(name).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("exports play and still as the contract asks, and loads its styles as a string it injects in both", () => {
    const scene = code("./part-1-autumn-rain.ts");
    assert.match(scene, /export function play\(ctx: TsukiSceneContext\): TsukiSceneHandle/);
    assert.match(scene, /export function still\(ctx: TsukiSceneContext\): void/);
    assert.match(scene, /import css from "\.\/part-1-autumn-rain\.css\?inline";/);
    assert.equal(scene.match(/injectSceneStyles\(css, ctx\.signal\)/g)?.length, 2, "play and still each inject the styles");
  });

  it("never blurs or reads pixels per frame: no shadowBlur, no getImageData, no canvas filter, no timer loops", () => {
    const scene = code("./part-1-autumn-rain.ts");
    assert.doesNotMatch(scene, /shadowBlur|getImageData|\.filter\s*=|setInterval/);
    // createImageData and putImageData fill the noise map once, in makeNoiseMap().
    const render = scene.slice(scene.indexOf("const render ="), scene.indexOf("loop = ctx.createCanvasLoop"));
    assert.ok(render.length > 500, "found the frame function");
    assert.doesNotMatch(render, /createImageData|putImageData|createRadialGradient|createLinearGradient|document\.createElement|getBoundingClientRect/);
  });

  it("drives audio only through ctx.audio, only when it is available, and never starts a gesture of its own", () => {
    const scene = code("./part-1-autumn-rain.ts");
    assert.match(scene, /if \(ctx\.audio\.available\(\)\) \{\s*ctx\.audio\.setCue\("discovery"\);\s*ctx\.audio\.layerSoundscape\("distant-train", SOUNDSCAPE_VOLUME\);/);
    assert.doesNotMatch(scene, /requestPlayFromGesture|new Audio|Howl/);
    const stillSource = scene.slice(scene.indexOf("export function still"));
    assert.doesNotMatch(stillSource, /ctx\.audio|createRevealClock|setTimeout|setInterval|requestAnimationFrame/, "the still plays no audio and runs no timer");
  });

  it("keeps the wipe control a real button with a name, in ctx.controls, and the epigraph untouched but for a class and a property", () => {
    const scene = code("./part-1-autumn-rain.ts");
    assert.match(scene, /const WIPE_LABEL = "เช็ดกระจก";/);
    assert.match(scene, /button\.type = "button";/);
    assert.match(scene, /button\.textContent = WIPE_LABEL;/);
    assert.match(scene, /ctx\.controls\.append\(button\)/);
    assert.doesNotMatch(scene, /textEl\.(textContent|innerHTML|innerText|replaceChildren|append|remove\()/);
    assert.doesNotMatch(scene, /stage\.append\(button/, "no control goes in the aria-hidden stage");
  });

  it("keeps the frame cost low: layers that move are images or small canvases that are never redrawn, no masks, no animated blur, and the page's backdrop is not drawn behind the opaque dialog", () => {
    const scene = code("./part-1-autumn-rain.ts");
    const css = code("./part-1-autumn-rain.css");
    // A canvas that is carried by an animation is handed to the compositor again every frame: the rain and the plate are images.
    assert.match(scene, /function paintRainPlane\([\s\S]*?\): HTMLImageElement \{/);
    assert.match(scene, /const plate = document\.createElement\("img"\)/);
    assert.match(css, /\.tsuki-p1-rain \{\s*display: none;/, "the loop's own canvas, which draws nothing, is not in the page");
    assert.doesNotMatch(css, /mask-image|backdrop-filter|mix-blend-mode/, "a mask or a blend makes the compositor draw the stage into a surface of its own first");
    assert.doesNotMatch(css, /transition:[^;]*\bfilter\b/, "the epigraph's blur is stepped, not animated");
    assert.match(css, /body:has\(dialog\.tsuki-cutscene\[open\]\[data-state="playing"\]\[data-mode="motion"\]\) \.sakura-backdrop \{\s*display: none;/);
    // The animated scene never draws in a frame: no canvas context is used by the frame function.
    const render = scene.slice(scene.indexOf("const render ="), scene.indexOf("loop = ctx.createCanvasLoop"));
    assert.doesNotMatch(render, /getContext|drawImage|fillRect|clearRect|stroke\(/);
  });

  it("styles with no z-index, no hard-coded asset URL, a reduced-motion branch and a fallback for the epigraph's haze", () => {
    const css = code("./part-1-autumn-rain.css");
    assert.doesNotMatch(css, /z-index/);
    assert.doesNotMatch(read("./part-1-autumn-rain.ts"), /["'`(]\/assets\//);
    assert.match(read("./part-1-autumn-rain.css"), /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /--tsuki-p1-reveal: 1;/, "without the scene setting it the epigraph is crisp");
  });
});
