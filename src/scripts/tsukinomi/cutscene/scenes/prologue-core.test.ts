// The pure half of the prologue cutscene: the pacing and timeline that keep it
// inside the design's 20 to 30 seconds, the auto-start rule, the wire's path
// maths and, above all, the layout rule: nothing decorative is ever placed over
// the epigraph or the buttons, at any screen size or text size.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { fileURLToPath } from "node:url";

import { splitGraphemes } from "../../../_shared/cutscene/graphemes";
import { EPIGRAPHS } from "../epigraphs";
import {
  AUTO_START_CAP_MS,
  AUTO_START_MS,
  BUD_FADE_LENGTH,
  FADE_SAMPLES,
  GLOW_FROM,
  GLOW_REST,
  LAMP_FADE_S,
  LAMP_PHRASE,
  SUBTITLE_FADE_MS,
  SUBTITLE_REVEAL_MS,
  WIRE_SAMPLES,
  autoStartDelayMs,
  boundsOf,
  buildTimeline,
  clusterIndexOf,
  computeLayout,
  createAutoStart,
  createSceneClock,
  cumulativeLengths,
  easeInOutSine,
  easeOutCubic,
  emptyFadeSteps,
  featherFor,
  glowSteps,
  glowStartOffset,
  groupLines,
  inflate,
  intersects,
  lampClusterFor,
  lineSweep,
  pathUpTo,
  placeSteps,
  placeWire,
  pointAtLength,
  progressBetween,
  rectHeight,
  rectWidth,
  smoothPath,
  startPlan,
  subtitleSchedule,
  wireSteps,
  type ClusterBox,
  type Layout,
  type Point,
  type Rect,
} from "./prologue-core";

const clusters = splitGraphemes(EPIGRAPHS[0]);

describe("autoStartDelayMs", () => {
  it("waits the full six seconds from a fresh start", () => {
    assert.equal(AUTO_START_MS, 6000);
    assert.equal(autoStartDelayMs(0), 6000);
  });

  it("restarts the six seconds each time the reader leaves the button, but never past the cap", () => {
    assert.equal(autoStartDelayMs(3000), 6000);
    assert.equal(autoStartDelayMs(8000), 4000);
    assert.equal(autoStartDelayMs(AUTO_START_CAP_MS), 0);
    assert.equal(autoStartDelayMs(AUTO_START_CAP_MS + 5000), 0);
  });

  it("treats a nonsense elapsed time as zero rather than returning NaN", () => {
    for (const bad of [Number.NaN, -10, Number.POSITIVE_INFINITY * 0]) assert.equal(autoStartDelayMs(bad), 6000);
  });
});

describe("createAutoStart", () => {
  let now = 0;
  let started = 0;

  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout"] });
    now = 0;
    started = 0;
  });
  afterEach(() => mock.timers.reset());

  const advance = (ms: number) => {
    now += ms;
    mock.timers.tick(ms);
  };
  const make = () => createAutoStart(() => started++, () => now);

  it("starts the scene once, six seconds after it opened, with nobody on the button", () => {
    make();
    advance(5999);
    assert.equal(started, 0);
    advance(1);
    assert.equal(started, 1);
    advance(60_000);
    assert.equal(started, 1, "only once");
  });

  it("holds the countdown while the reader is on the Play button, and restarts it when they leave, within the cap", () => {
    const countdown = make();
    advance(3000);
    countdown.setEngaged(true);
    advance(5000);
    assert.equal(started, 0, "held: the reader may be about to press it");
    countdown.setEngaged(false);
    advance(3999);
    assert.equal(started, 0);
    advance(1);
    assert.equal(started, 1, "the cap of 12 s in total left 4 s, not 6");
  });

  it("gives the full six seconds back when they leave early", () => {
    const countdown = make();
    advance(1000);
    countdown.setEngaged(true);
    advance(1000);
    countdown.setEngaged(false);
    advance(5999);
    assert.equal(started, 0);
    advance(1);
    assert.equal(started, 1);
  });

  it("never waits past the cap: a reader who has been on the button for 20 s is started the moment they leave", () => {
    const countdown = make();
    countdown.setEngaged(true);
    advance(20_000);
    assert.equal(started, 0);
    countdown.setEngaged(false);
    advance(1);
    assert.equal(started, 1);
  });

  it("does not start after cancel, and engaging or leaving afterwards does nothing", () => {
    const countdown = make();
    countdown.cancel();
    advance(30_000);
    assert.equal(started, 0);
    countdown.setEngaged(false);
    advance(30_000);
    assert.equal(started, 0);
  });

  it("does not arm a second countdown once it has started", () => {
    const countdown = make();
    advance(6000);
    assert.equal(started, 1);
    countdown.setEngaged(true);
    countdown.setEngaged(false);
    advance(30_000);
    assert.equal(started, 1);
  });
});

describe("startPlan", () => {
  it("asks for the gesture only when the reader pressed Play, never for the automatic start", () => {
    assert.equal(startPlan(true, false).requestGesture, true);
    assert.equal(startPlan(true, true).requestGesture, true);
    assert.equal(startPlan(false, false).requestGesture, false);
    assert.equal(startPlan(false, true).requestGesture, false);
  });

  it("adds a click of its own only when the Walkman will not make one itself", () => {
    assert.equal(startPlan(true, false).ownClick, false, "switching the Walkman on already clicks");
    assert.equal(startPlan(true, true).ownClick, true, "it was on already, so nothing clicked");
    assert.equal(startPlan(false, true).ownClick, true);
    assert.equal(startPlan(false, false).ownClick, true, "a no-op while the Walkman is off");
  });
});

describe("subtitleSchedule", () => {
  it("starts the first character at 0 and finishes the last exactly at the reveal length", () => {
    const schedule = subtitleSchedule(clusters);
    assert.equal(schedule.delaysMs.length, clusters.length);
    assert.equal(schedule.delaysMs[0], 0);
    assert.ok(Math.abs(schedule.totalMs - SUBTITLE_REVEAL_MS) < 1e-6, `total ${schedule.totalMs}`);
    assert.ok(Math.abs(schedule.delaysMs[clusters.length - 1] + SUBTITLE_FADE_MS - SUBTITLE_REVEAL_MS) < 1e-6);
  });

  it("never runs backwards and never makes two characters share a start", () => {
    const { delaysMs } = subtitleSchedule(clusters);
    for (let index = 1; index < delaysMs.length; index++) assert.ok(delaysMs[index] > delaysMs[index - 1], `cluster ${index}`);
  });

  it("is slow enough to read as a subtitle: a plain character is at least 100 ms and at most 250 ms after the one before", () => {
    const { delaysMs } = subtitleSchedule(clusters);
    const plain = clusters.map((_cluster, index) => ({ index, gap: index === 0 ? 0 : delaysMs[index] - delaysMs[index - 1], before: clusters[index - 1] }));
    const letters = plain.filter((entry) => entry.index !== 0 && !/^\s+$/.test(entry.before) && entry.before !== ".");
    assert.ok(letters.length > 50);
    for (const entry of letters) assert.ok(entry.gap >= 100 && entry.gap <= 250, `gap ${entry.gap} after "${entry.before}"`);
  });

  it("pauses at a space and longest at the dots of an ellipsis", () => {
    const { delaysMs } = subtitleSchedule(clusters);
    const gapAfter = (index: number) => delaysMs[index + 1] - delaysMs[index];
    const plainGap = gapAfter(0);
    const space = clusters.findIndex((cluster) => /^\s+$/.test(cluster));
    const dot = clusters.indexOf(".");
    assert.ok(space > 0 && dot > 0, "the prologue epigraph has a space and an ellipsis");
    assert.ok(gapAfter(space) > plainGap * 2, "a space waits more than twice a letter");
    assert.ok(gapAfter(dot) > gapAfter(space), "a dot waits longer than a space");
  });

  it("keeps the whole epigraph inside the 12 to 18 s the design asks for", () => {
    const total = subtitleSchedule(clusters).totalMs / 1000;
    assert.ok(total >= 12 && total <= 18, `${total} s`);
  });

  it("copes with no text, one character and a reveal shorter than a fade", () => {
    assert.deepEqual(subtitleSchedule([]).delaysMs, []);
    assert.equal(subtitleSchedule([]).totalMs, 0);
    const one = subtitleSchedule(["ก"]);
    assert.deepEqual(one.delaysMs, [0]);
    const squeezed = subtitleSchedule(["ก", "ข", "ค"], 200, 1000);
    assert.ok(squeezed.delaysMs.every((value) => Number.isFinite(value) && value >= 0));
  });
});

/** Boxes for a text set 10 px a cluster, `perLine` clusters to a line, 39 px apart, as a paragraph would lay it out; a line's last cluster may be a space with no size. */
function setBoxes(count: number, perLine: number, options: { collapseLineEndSpaces?: boolean; left?: number } = {}): ClusterBox[] {
  const boxes: ClusterBox[] = [];
  for (let index = 0; index < count; index++) {
    const line = Math.floor(index / perLine);
    const column = index % perLine;
    const spaceAtEnd = options.collapseLineEndSpaces && column === perLine - 1 && line < Math.floor((count - 1) / perLine);
    boxes.push(
      spaceAtEnd
        ? { left: 0, top: 0, right: 0, bottom: 0 }
        : { left: (options.left ?? 50) + column * 10, top: 5 + line * 39, right: (options.left ?? 50) + column * 10 + 10, bottom: 5 + line * 39 + 28 },
    );
  }
  return boxes;
}

describe("groupLines", () => {
  it("puts consecutive clusters on one line until one sits below it, and covers every cluster exactly once, in order", () => {
    const lines = groupLines(setBoxes(50, 20));
    assert.equal(lines.length, 3);
    assert.deepEqual(lines.map((line) => [line.first, line.last]), [[0, 19], [20, 39], [40, 49]]);
    assert.deepEqual([lines[0].left, lines[0].right], [50, 250]);
    assert.deepEqual([lines[2].left, lines[2].right], [50, 150], "the last line is as long as its own clusters");
  });

  it("keeps a cluster with no size, such as the space a line wraps on, with the line it ends", () => {
    const lines = groupLines(setBoxes(40, 20, { collapseLineEndSpaces: true }));
    assert.deepEqual(lines.map((line) => [line.first, line.last]), [[0, 19], [20, 39]]);
    assert.equal(lines[0].right, 240, "a collapsed space adds no width");
  });

  it("gives every line a band, and the bands tile the paragraph with no gap and no overlap", () => {
    const lines = groupLines(setBoxes(70, 20));
    for (let index = 1; index < lines.length; index++) assert.equal(lines[index].top, lines[index - 1].bottom);
    for (const line of lines) assert.equal(line.bottom - line.top, 39, "a band is one line pitch tall");
    // The middle of a band is the middle of its line's ink: 5 + 14 on the first line.
    assert.equal((lines[0].top + lines[0].bottom) / 2, 19);
  });

  it("takes the height of a lone line's band from the paragraph's line height, and from its ink without one", () => {
    const boxes = setBoxes(10, 20);
    assert.equal(groupLines(boxes, 60)[0].bottom - groupLines(boxes, 60)[0].top, 60);
    assert.equal(groupLines(boxes)[0].bottom - groupLines(boxes)[0].top, 28);
  });

  it("copes with no text and with a text that has no size at all", () => {
    assert.deepEqual(groupLines([]), []);
    assert.deepEqual(groupLines([{ left: 0, top: 0, right: 0, bottom: 0 }]), []);
  });
});

describe("featherFor and lineSweep", () => {
  const delays = (count: number, step: number) => Array.from({ length: count }, (_, index) => index * step);

  it("makes the soft edge as wide as the text moves in the time one character takes to fade, within sane bounds", () => {
    const boxes = setBoxes(40, 20);
    const lines = groupLines(boxes);
    // A line is 200 px wide and its first and last clusters start 1900 ms apart: about 0.105 px/ms, so a 1100 ms fade travels about 116 px.
    const feather = featherFor(lines, delays(40, 100), 1100);
    assert.ok(Math.abs(feather - (200 / 1900) * 1100) < 1e-9, `got ${feather}`);
    assert.equal(featherFor(lines, delays(40, 0), 1100), 28, "no pace at all gets the narrowest edge");
    assert.equal(featherFor(lines, delays(40, 10_000), 1100), 28);
    assert.equal(featherFor(lines, delays(40, 1), 1_000_000), 260);
  });

  it("starts the cover at the first character's left edge less the feather and runs it past the line's end, never backwards", () => {
    const boxes = setBoxes(40, 20);
    const [first] = groupLines(boxes);
    const sweep = lineSweep(first, boxes, delays(40, 100), 1100, 110);
    assert.equal(sweep.startMs, 0);
    assert.equal(sweep.frames[0].ms, 0);
    assert.equal(sweep.frames[0].x, 50 - 110, "the far side of the soft edge is on the first character, so nothing shows yet");
    const end = sweep.frames[sweep.frames.length - 1];
    assert.ok(end.x >= first.right, "the line is whole once the cover's near side is past its last character");
    assert.equal(sweep.durationMs, 19 * 100 + 1100);
    assert.equal(end.ms, sweep.durationMs);
    for (let index = 1; index < sweep.frames.length; index++) {
      assert.ok(sweep.frames[index].ms > sweep.frames[index - 1].ms, "time moves forward at every frame");
      assert.ok(sweep.frames[index].x >= sweep.frames[index - 1].x, "the cover only moves right");
    }
  });

  it("puts the far side of the soft edge on each character at the moment it starts", () => {
    const boxes = setBoxes(40, 20);
    const lines = groupLines(boxes);
    const sweep = lineSweep(lines[1], boxes, delays(40, 100), 1100, 110);
    assert.equal(sweep.startMs, 2000, "the second line starts with its first character");
    const frame = sweep.frames.find((candidate) => candidate.ms === 500);
    assert.ok(frame, "a frame five characters in");
    assert.equal(frame.x + 110, boxes[25].left);
  });

  it("holds the cover still while no character starts (a pause) and never lets two frames share a moment", () => {
    const boxes = setBoxes(6, 20);
    const sweep = lineSweep(groupLines(boxes)[0], boxes, [0, 100, 200, 200, 300, 400], 1000, 50);
    for (let index = 1; index < sweep.frames.length; index++) assert.ok(sweep.frames[index].ms > sweep.frames[index - 1].ms);
  });

  it("sweeps the real epigraph's lines inside the scene's subtitle time", () => {
    const schedule = subtitleSchedule(clusters);
    const boxes = setBoxes(clusters.length, 28);
    const lines = groupLines(boxes);
    const feather = featherFor(lines, schedule.delaysMs, schedule.fadeMs);
    assert.ok(lines.length >= 3);
    let latest = 0;
    for (const line of lines) {
      const sweep = lineSweep(line, boxes, schedule.delaysMs, schedule.fadeMs, feather);
      latest = Math.max(latest, sweep.startMs + sweep.durationMs);
    }
    assert.equal(Math.round(latest), Math.round(schedule.totalMs), "the last line finishes with the last character");
  });
});

describe("clusterIndexOf and the lamp's beat", () => {
  it("finds the cluster a phrase starts on, counting by clusters rather than UTF-16 units", () => {
    const index = clusterIndexOf(clusters, LAMP_PHRASE);
    assert.ok(index > 0);
    assert.ok(clusters.slice(index).join("").startsWith(LAMP_PHRASE));
    assert.equal(clusterIndexOf(clusters, "ไม่มีคำนี้"), -1);
    assert.equal(clusterIndexOf(clusters, ""), -1);
    assert.equal(clusterIndexOf([], "ก"), -1);
  });

  it("lights the lamp on 'จำชื่อ' in the real epigraph, past the middle of the text", () => {
    const index = lampClusterFor(clusters);
    assert.equal(index, clusterIndexOf(clusters, LAMP_PHRASE));
    assert.ok(index / clusters.length > 0.5);
  });

  it("falls back to near the end of the text when the phrase is gone", () => {
    const reworded = splitGraphemes("ข้อความอื่นทั้งหมดที่ไม่มีคำนั้นอยู่เลย");
    const index = lampClusterFor(reworded);
    assert.ok(index > reworded.length / 2 && index < reworded.length);
  });
});

describe("buildTimeline", () => {
  const schedule = subtitleSchedule(clusters);
  const timeline = buildTimeline(schedule, lampClusterFor(clusters));

  it("orders the beats: the wire draws first, the empty bud follows it, the lamp lands inside the subtitles", () => {
    assert.ok(timeline.begin < timeline.wireStart);
    assert.ok(timeline.wireStart < timeline.wireEnd);
    assert.ok(timeline.wireEnd <= timeline.emptyStart && timeline.emptyStart < timeline.emptyEnd);
    assert.ok(timeline.wireStart < timeline.subtitlesStart, "the wire is under way before the words begin");
    assert.ok(timeline.subtitlesStart < timeline.lampStart && timeline.lampStart < timeline.subtitlesEnd);
    assert.ok(Math.abs(timeline.lampEnd - timeline.lampStart - LAMP_FADE_S) < 1e-9, "the lamp fades in over its full time");
  });

  it("holds the finished scene for a few seconds before it ends, so the last line can be read", () => {
    assert.ok(timeline.end - timeline.subtitlesEnd >= 4, `hold ${timeline.end - timeline.subtitlesEnd}`);
    assert.ok(timeline.end >= timeline.lampEnd + 2, "the glow has settled before the end");
  });

  it("runs 20 to 30 s from the start, so with the 6 s wait the scene stays inside 20 to 35 s", () => {
    assert.ok(timeline.end >= 20 && timeline.end <= 30, `${timeline.end} s`);
    assert.ok(timeline.end + AUTO_START_CAP_MS / 1000 <= 35 + 1e-9 || timeline.end + AUTO_START_MS / 1000 <= 35, "the unattended path fits");
    assert.ok(timeline.end + AUTO_START_MS / 1000 <= 35);
  });

  it("keeps the lamp inside the scene whatever beat it is given", () => {
    for (const beat of [-5, 0, 3, clusters.length - 1, clusters.length + 40]) {
      const t = buildTimeline(schedule, beat);
      assert.ok(t.lampStart >= 1 && t.lampStart < t.subtitlesEnd, `beat ${beat}: ${t.lampStart}`);
      assert.ok(t.lampEnd <= t.end);
    }
  });

  it("still gives a sane timeline for an empty epigraph", () => {
    const t = buildTimeline(subtitleSchedule([]), 0);
    for (const value of Object.values(t)) assert.ok(Number.isFinite(value));
    assert.ok(t.end > t.lampEnd);
  });
});

describe("progress and easing", () => {
  it("progressBetween clamps to 0 and 1 and handles a zero-length span", () => {
    assert.equal(progressBetween(-1, 1, 3), 0);
    assert.equal(progressBetween(2, 1, 3), 0.5);
    assert.equal(progressBetween(9, 1, 3), 1);
    assert.equal(progressBetween(1, 2, 2), 0);
    assert.equal(progressBetween(2, 2, 2), 1);
  });

  it("the easings run from 0 to 1 without going backwards or leaving the range", () => {
    for (const ease of [easeInOutSine, easeOutCubic]) {
      assert.equal(ease(0), 0);
      assert.ok(Math.abs(ease(1) - 1) < 1e-12);
      assert.equal(ease(-3), 0);
      assert.ok(Math.abs(ease(7) - 1) < 1e-12);
      let last = 0;
      for (let step = 1; step <= 100; step++) {
        const value = ease(step / 100);
        assert.ok(value >= last && value <= 1 + 1e-12);
        last = value;
      }
    }
    assert.ok(Math.abs(easeInOutSine(0.5) - 0.5) < 1e-12);
  });
});

describe("wireSteps and the other keyframes of the wire's layers", () => {
  const wire = placeWire({ left: 20, top: 20, right: 920, bottom: 240 });
  assert.ok(wire);

  it("samples the earbud's trip at even steps of time, from the jack to the end of the wire", () => {
    const steps = wireSteps(wire);
    assert.equal(steps.length, WIRE_SAMPLES + 1);
    assert.equal(steps[0].offset, 0);
    assert.equal(steps[steps.length - 1].offset, 1);
    assert.deepEqual([steps[0].x, steps[0].y], [wire.path[0].x, wire.path[0].y]);
    const end = wire.path[wire.path.length - 1];
    assert.ok(Math.abs(steps[steps.length - 1].x - end.x) < 1e-6 && Math.abs(steps[steps.length - 1].y - end.y) < 1e-6);
    for (let index = 1; index < steps.length; index++) assert.ok(steps[index].offset > steps[index - 1].offset);
  });

  it("moves the earbud only forward, slowly at first, quickest in the middle and slowly again at the end, like the wire it rides", () => {
    const steps = wireSteps(wire);
    for (let index = 1; index < steps.length; index++) assert.ok(steps[index].x >= steps[index - 1].x - 1e-9, "left to right");
    const advance = (index: number) => steps[index].x - steps[index - 1].x;
    assert.ok(advance(1) < advance(WIRE_SAMPLES / 2));
    assert.ok(advance(WIRE_SAMPLES) < advance(WIRE_SAMPLES / 2));
  });

  it("keeps every step on the wire: the same point and direction pointAtLength gives for the eased distance", () => {
    const total = wire.lengths[wire.lengths.length - 1];
    for (const step of wireSteps(wire)) {
      const expected = pointAtLength(wire.path, wire.lengths, total * easeInOutSine(step.offset));
      assert.ok(Math.abs(step.x - expected.x) < 1e-6 && Math.abs(step.y - expected.y) < 1e-6 && Math.abs(step.angle - expected.angle) < 1e-9);
    }
  });

  it("fades the earbud in over the first twelfth of the wire and brings the glow up over the last tenth", () => {
    const steps = wireSteps(wire);
    assert.equal(steps[0].alpha, 0);
    assert.equal(steps[steps.length - 1].alpha, 1);
    assert.equal(steps[0].glow, GLOW_REST);
    assert.equal(steps[steps.length - 1].glow, 1);
    for (const step of steps) assert.equal(step.alpha, Math.min(1, step.drawn / BUD_FADE_LENGTH));
    for (let index = 1; index < steps.length; index++) {
      assert.ok(steps[index].alpha >= steps[index - 1].alpha);
      assert.ok(steps[index].glow >= steps[index - 1].glow);
    }
    const quiet = steps.filter((step) => step.drawn <= GLOW_FROM);
    assert.ok(quiet.length > 10 && quiet.every((step) => step.glow === GLOW_REST), "no glow before the wire is nine tenths out");
  });

  it("finds the moment the glow starts as the inverse of the wire's easing", () => {
    const from = glowStartOffset();
    assert.ok(from > 0.7 && from < 0.9);
    assert.ok(Math.abs(easeInOutSine(from) - GLOW_FROM) < 1e-9);
  });

  it("gives the glow's rise and the empty earbud's fade-in smooth, ordered keyframes from nothing to everything", () => {
    const glow = glowSteps();
    assert.equal(glow.length, FADE_SAMPLES + 1);
    assert.equal(glow[0].offset, 0);
    assert.equal(glow[glow.length - 1].offset, 1);
    assert.equal(glow[0].glow, GLOW_REST);
    assert.equal(glow[glow.length - 1].glow, 1);
    for (let index = 1; index < glow.length; index++) assert.ok(glow[index].glow >= glow[index - 1].glow);

    const fade = emptyFadeSteps();
    assert.deepEqual([fade[0].opacity, fade[fade.length - 1].opacity], [0, 1]);
    for (let index = 1; index < fade.length; index++) assert.ok(fade[index].opacity > fade[index - 1].opacity);
    assert.ok(fade[1].opacity - fade[0].opacity > fade[fade.length - 1].opacity - fade[fade.length - 2].opacity, "an ease-out: quick first, gentle last");
  });

  it("follows the stage's own wire at every width, with the same step count", () => {
    for (const width of [300, 520, 900, 1400]) {
      const placed = placeWire({ left: 0, top: 0, right: width, bottom: 220 });
      if (!placed) continue;
      assert.equal(wireSteps(placed).length, WIRE_SAMPLES + 1);
    }
  });
});

describe("createSceneClock", () => {
  let now = 1000;
  const clock = () => createSceneClock(() => now);
  beforeEach(() => {
    now = 1000;
  });

  it("counts from the moment it is started, and not before", () => {
    const c = clock();
    assert.equal(c.elapsedMs(), 0);
    assert.equal(c.started, false);
    now = 1500;
    assert.equal(c.elapsedMs(), 0);
    c.start();
    assert.equal(c.started, true);
    now = 2250;
    assert.equal(c.elapsedMs(), 750);
  });

  it("ignores a second start", () => {
    const c = clock();
    c.start();
    now = 1400;
    c.start();
    now = 1900;
    assert.equal(c.elapsedMs(), 900);
  });

  it("stops counting while held and carries on from where it stopped when released", () => {
    const c = clock();
    c.start();
    now = 1300;
    c.hold();
    assert.equal(c.held, true);
    now = 9300;
    assert.equal(c.elapsedMs(), 300, "a hidden tab does not advance the scene");
    c.release();
    assert.equal(c.held, false);
    now = 9500;
    assert.equal(c.elapsedMs(), 500);
  });

  it("does nothing for a hold before the start or a second hold, and for a release that was not held", () => {
    const c = clock();
    c.hold();
    assert.equal(c.held, false);
    c.start();
    c.release();
    now = 1200;
    c.hold();
    now = 1700;
    c.hold();
    now = 2000;
    assert.equal(c.elapsedMs(), 200);
    c.release();
    c.release();
    now = 2100;
    assert.equal(c.elapsedMs(), 300);
  });

  it("adds up several holds", () => {
    const c = clock();
    c.start();
    now = 1100;
    c.hold();
    now = 1600;
    c.release();
    now = 1700;
    c.hold();
    now = 2700;
    c.release();
    now = 2900;
    assert.equal(c.elapsedMs(), 100 + 100 + 200);
  });
});

describe("polylines", () => {
  const square: Point[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ];
  const lengths = cumulativeLengths(square);

  it("measures a polyline", () => {
    assert.deepEqual(lengths, [0, 10, 20]);
    assert.deepEqual(cumulativeLengths([]), []);
    assert.deepEqual(cumulativeLengths([{ x: 1, y: 1 }]), [0]);
  });

  it("finds the point and the direction a given distance along it, clamping at both ends", () => {
    assert.deepEqual(pointAtLength(square, lengths, 5), { x: 5, y: 0, angle: 0 });
    const down = pointAtLength(square, lengths, 15);
    assert.deepEqual({ x: down.x, y: down.y }, { x: 10, y: 5 });
    assert.ok(Math.abs(down.angle - Math.PI / 2) < 1e-12);
    assert.deepEqual({ x: pointAtLength(square, lengths, -4).x, y: pointAtLength(square, lengths, -4).y }, { x: 0, y: 0 });
    assert.deepEqual({ x: pointAtLength(square, lengths, 99).x, y: pointAtLength(square, lengths, 99).y }, { x: 10, y: 10 });
    assert.deepEqual(pointAtLength([], [], 3), { x: 0, y: 0, angle: 0 });
  });

  it("cuts the part drawn so far: nothing before 0, the whole path from its length on, a partial last point between", () => {
    assert.deepEqual(pathUpTo(square, lengths, 0), []);
    assert.deepEqual(pathUpTo(square, lengths, 20), square);
    assert.deepEqual(pathUpTo(square, lengths, 99), square);
    assert.deepEqual(pathUpTo(square, lengths, 15), [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }]);
    assert.deepEqual(pathUpTo(square, lengths, 4), [{ x: 0, y: 0 }, { x: 4, y: 0 }]);
  });

  it("smoothPath passes through its control points and starts and ends on them", () => {
    const control: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: -5 },
      { x: 30, y: 0 },
    ];
    const path = smoothPath(control, 8);
    assert.equal(path.length, 1 + 3 * 8);
    assert.deepEqual(path[0], control[0]);
    for (let index = 0; index < control.length; index++) {
      const at = path[index * 8];
      assert.ok(Math.abs(at.x - control[index].x) < 1e-9 && Math.abs(at.y - control[index].y) < 1e-9, `control point ${index}`);
    }
    assert.deepEqual(smoothPath([{ x: 1, y: 2 }]), [{ x: 1, y: 2 }]);
  });

  it("boundsOf pads and covers every point", () => {
    assert.deepEqual(boundsOf(square, 2), { left: -2, top: -2, right: 12, bottom: 12 });
  });
});

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const VIEWPORTS = [
  [375, 812],
  [390, 844],
  [812, 375],
  [667, 375],
  [915, 412],
  [1280, 800],
  [1920, 1080],
  [768, 1024],
] as const;

/**
 * The epigraph box and the buttons the dialog gives, modelled on TsukinomiCutscene.astro: a
 * centred column up to 36rem wide in a type size that is a clamp of the viewport, line height
 * 1.95, Thai at about 0.56 em per character, vertically centred between the card's paddings.
 * `scale` is the reader's text size (the root font size).
 */
function modelDialog(width: number, height: number, scale = 1) {
  const rem = 16 * scale;
  const vmin = Math.min(width, height) / 100;
  const font = Math.min(1.3 * rem, Math.max(0.98 * rem, 0.8 * rem + 1.1 * vmin));
  const column = Math.min(36 * rem, width - 2 * rem);
  const lines = Math.ceil((clusters.length * 0.56 * font) / column);
  const textHeight = lines * font * 1.95;
  const paddingTop = 4.25 * rem;
  const paddingBottom = Math.max(4.75 * rem, 72);
  const free = height - paddingTop - paddingBottom;
  const top = paddingTop + Math.max(0, (free - textHeight) / 2);
  const keepOut: Rect = { left: (width - column) / 2, right: (width + column) / 2, top, bottom: top + textHeight };
  const skip: Rect = { left: width - 16 - 75 * scale, right: width - 16, top: height - 16 - 44 * scale, bottom: height - 16 };
  const play: Rect = { left: 16, right: 16 + 110 * scale, top: height - 16 - 44 * scale, bottom: height - 16 };
  return { keepOut, buttons: [skip, play], scrolls: textHeight > free + 1 };
}

const CLEARANCE = 8;

function problems(layout: Layout, keepOut: Rect, buttons: readonly Rect[]): string[] {
  const found: string[] = [];
  const stage: Rect = { left: 0, top: 0, right: layout.width, bottom: layout.height };
  layout.ink.forEach((rect, index) => {
    if (rect.left < stage.left - 0.5 || rect.top < stage.top - 0.5 || rect.right > stage.right + 0.5 || rect.bottom > stage.bottom + 0.5) found.push(`ink ${index} leaves the screen ${JSON.stringify(rect)}`);
    if (intersects(rect, inflate(keepOut, CLEARANCE))) found.push(`ink ${index} touches the epigraph ${JSON.stringify(rect)}`);
    for (const button of buttons) if (intersects(rect, inflate(button, 2))) found.push(`ink ${index} touches a button ${JSON.stringify(rect)}`);
  });
  return found;
}

describe("computeLayout", () => {
  it("places both groups, clear of the epigraph and the buttons, at every viewport at the default text size", () => {
    for (const [width, height] of VIEWPORTS) {
      const { keepOut, buttons, scrolls } = modelDialog(width, height);
      const layout = computeLayout({ width, height, keepOut, buttons, scrolls });
      assert.equal(layout.mode, "composed", `${width}x${height}`);
      assert.ok(layout.wire, `${width}x${height}: the Walkman and wire have a place`);
      assert.ok(layout.steps, `${width}x${height}: the lamp and steps have a place`);
      assert.deepEqual(problems(layout, keepOut, buttons), [], `${width}x${height}`);
    }
  });

  it("never touches the epigraph or a button at any text size, placing less or nothing as the text grows", () => {
    for (const [width, height] of VIEWPORTS) {
      for (const scale of [0.85, 1, 1.15, 1.3, 1.5, 1.75, 2]) {
        const { keepOut, buttons, scrolls } = modelDialog(width, height, scale);
        const layout = computeLayout({ width, height, keepOut, buttons, scrolls });
        assert.deepEqual(problems(layout, keepOut, buttons), [], `${width}x${height} at ${scale * 100}%`);
        if (scrolls) assert.equal(layout.mode, "bare", `${width}x${height} at ${scale * 100}%: the card scrolls over the stage`);
      }
    }
  });

  it("keeps the Walkman at least 72 px wide and the lamp at least 7 units, or leaves the group out", () => {
    for (const [width, height] of VIEWPORTS) {
      for (const scale of [1, 1.3, 1.6]) {
        const { keepOut, buttons, scrolls } = modelDialog(width, height, scale);
        const layout = computeLayout({ width, height, keepOut, buttons, scrolls });
        if (layout.wire) assert.ok(rectWidth(layout.wire.walkman) >= 72 - 1e-9);
        if (layout.steps) assert.ok(layout.steps.unit >= 7);
      }
    }
  });

  it("is bare when the dialog scrolls, when nothing could be measured, and when the stage has no size", () => {
    const { keepOut, buttons } = modelDialog(375, 812);
    assert.equal(computeLayout({ width: 375, height: 812, keepOut, buttons, scrolls: true }).mode, "bare");
    assert.equal(computeLayout({ width: 375, height: 812, keepOut: null, buttons, scrolls: false }).mode, "bare");
    assert.equal(computeLayout({ width: 0, height: 0, keepOut, buttons, scrolls: false }).mode, "bare");
    assert.equal(computeLayout({ width: 375, height: 812, keepOut, buttons, scrolls: true }).ink.length, 0);
  });

  it("uses the room above the epigraph for the Walkman and below it for the steps on a tall screen", () => {
    const { keepOut, buttons } = modelDialog(375, 812);
    const layout = computeLayout({ width: 375, height: 812, keepOut, buttons, scrolls: false });
    assert.ok(layout.wire && layout.steps);
    assert.ok(layout.wire.walkman.bottom < keepOut.top);
    assert.ok(layout.steps.zone.top > keepOut.bottom);
  });

  it("finds room for the steps between the buttons on a short landscape screen", () => {
    const { keepOut, buttons } = modelDialog(667, 375);
    const layout = computeLayout({ width: 667, height: 375, keepOut, buttons, scrolls: false });
    assert.ok(layout.steps, "the lamp is not lost in landscape");
    assert.ok(layout.steps.zone.top > keepOut.bottom, "below the epigraph");
    for (const button of buttons) assert.ok(!intersects(layout.steps.zone, button), "between the buttons, not over them");
  });

  it("puts the glow and the light on the steps inside the steps' own zone", () => {
    for (const [width, height] of VIEWPORTS) {
      const { keepOut, buttons, scrolls } = modelDialog(width, height);
      const steps = computeLayout({ width, height, keepOut, buttons, scrolls }).steps;
      assert.ok(steps);
      for (const e of [steps.halo, steps.pool]) {
        assert.ok(e.cx - e.rx >= steps.zone.left - 1e-6 && e.cx + e.rx <= steps.zone.right + 1e-6, `${width}x${height}: sideways`);
        assert.ok(e.cy - e.ry >= steps.zone.top - 1e-6 && e.cy + e.ry <= steps.zone.bottom + 1e-6, `${width}x${height}: vertically`);
      }
    }
  });

  it("is deterministic: the same input gives the same picture", () => {
    const { keepOut, buttons } = modelDialog(1280, 800);
    const input = { width: 1280, height: 800, keepOut, buttons, scrolls: false };
    assert.deepEqual(computeLayout(input), computeLayout(input));
  });
});

describe("placeWire", () => {
  const zone: Rect = { left: 15, top: 15, right: 360, bottom: 300 };

  it("fits the Walkman, the wire and both earbuds inside the zone", () => {
    const wire = placeWire(zone);
    assert.ok(wire);
    const inside = (rect: Rect) => rect.left >= zone.left - 1e-6 && rect.right <= zone.right + 1e-6 && rect.top >= zone.top - 1e-6 && rect.bottom <= zone.bottom + 1e-6;
    assert.ok(inside(wire.walkman));
    assert.ok(inside(boundsOf(wire.path)), "the cable");
    assert.ok(inside(boundsOf(wire.empty.stub)), "the loose end");
    for (const bud of [wire.bud, wire.empty]) assert.ok(inside({ left: bud.x - bud.r, right: bud.x + bud.r, top: bud.y - bud.r, bottom: bud.y + bud.r }));
  });

  it("starts the wire at the Walkman's jack, on its right edge, and keeps the Walkman's own aspect ratio", () => {
    const wire = placeWire(zone);
    assert.ok(wire);
    assert.deepEqual(wire.path[0], wire.jack);
    assert.ok(wire.jack.x > wire.walkman.right - rectWidth(wire.walkman) * 0.1 && wire.jack.x <= wire.walkman.right);
    assert.ok(wire.jack.y > wire.walkman.top && wire.jack.y < wire.walkman.bottom);
    assert.ok(Math.abs(rectWidth(wire.walkman) / rectHeight(wire.walkman) - 96 / 72) < 1e-9);
  });

  it("ends the wire in one earbud and leaves the other apart from it, with no cable between them", () => {
    const wire = placeWire(zone);
    assert.ok(wire);
    const tip = wire.path[wire.path.length - 1];
    assert.ok(Math.hypot(tip.x - wire.bud.x, tip.y - wire.bud.y) < 1e-9, "the plugged earbud sits on the wire's end");
    assert.ok(Math.hypot(wire.empty.x - wire.bud.x, wire.empty.y - wire.bud.y) > wire.bud.r * 3, "the empty earbud is clear of the other");
    // The loose cable belongs to the empty earbud and stops short of the wire.
    const nearest = Math.min(...wire.path.map((point) => Math.min(...wire.empty.stub.map((end) => Math.hypot(end.x - point.x, end.y - point.y)))));
    assert.ok(nearest > wire.bud.r, `the stub comes within ${nearest} of the wire`);
  });

  it("draws a cable that only ever moves forward, left to right", () => {
    const wire = placeWire(zone);
    assert.ok(wire);
    for (let index = 1; index < wire.path.length; index++) assert.ok(wire.path[index].x >= wire.path[index - 1].x - 1e-9, `sample ${index}`);
    assert.equal(wire.lengths.length, wire.path.length);
    assert.ok(wire.lengths[wire.lengths.length - 1] > rectWidth(zone) * 0.3, "a wire that is long enough to read as one");
  });

  it("gives up on a zone too small to read, and caps the group's width on a very wide one", () => {
    assert.equal(placeWire({ left: 0, top: 0, right: 150, bottom: 300 }), null);
    assert.equal(placeWire({ left: 0, top: 0, right: 400, bottom: 50 }), null);
    assert.equal(placeWire({ left: 0, top: 0, right: -5, bottom: 300 }), null);
    const wide = placeWire({ left: 0, top: 0, right: 3000, bottom: 300 });
    assert.ok(wide);
    assert.ok(wide.walkman.left >= 1050 - 1e-6 && wide.empty.x <= 1950, "the group is centred in 900 px, not spread over 3000");
    assert.ok(rectWidth(wide.walkman) <= 290);
  });
});

describe("placeSteps", () => {
  it("builds a flight that narrows towards the landing, with the lamp on top and the glow above it", () => {
    const steps = placeSteps({ left: 15, top: 480, right: 360, bottom: 740 });
    assert.ok(steps);
    assert.equal(steps.levels.length, 4);
    for (let index = 1; index < steps.levels.length; index++) {
      assert.ok(rectWidth(steps.levels[index].riser) < rectWidth(steps.levels[index - 1].riser), "each step is narrower than the one below");
      assert.ok(steps.levels[index].riser.bottom < steps.levels[index - 1].riser.top + 1e-9, "and stands above it");
    }
    assert.ok(steps.lamp.headY < steps.lamp.footY);
    assert.ok(steps.lamp.footY <= steps.levels[3].riser.top);
    assert.ok(steps.halo.cy < steps.lamp.footY, "the glow hangs around the lamp's head, not its foot");
    assert.ok(steps.cassette.bottom <= steps.landing.y + 1e-9 && steps.cassette.right < steps.lamp.x - steps.lamp.shadeWidth / 2, "the cassette lies beside the lamp");
    assert.equal(steps.baseY, 740);
  });

  it("uses three steps and a taller lamp in a narrow, tall zone, and is null where nothing would be legible", () => {
    const tall = placeSteps({ left: 700, top: 120, right: 790, bottom: 300 });
    assert.ok(tall);
    assert.equal(tall.levels.length, 3);
    assert.equal(placeSteps({ left: 0, top: 0, right: 50, bottom: 50 }), null);
    assert.equal(placeSteps({ left: 0, top: 10, right: 400, bottom: 5 }), null);
  });
});

// The scene module imports a stylesheet and draws, so node cannot run it; these read its source for the
// rules the performance budget sets, the way cutscene-contract.test.ts does for the dialog.
describe("prologue scene source rules", () => {
  const read = (name: string) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");
  const code = (name: string) => read(name).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("draws nothing in a frame: the frame callback only checks the clock, and everything that moves is an animation of an element", () => {
    const scene = code("./prologue.ts");
    const frame = scene.slice(scene.indexOf("const onFrame = () =>"), scene.indexOf("const picture = mountPicture(ctx, false, onFrame)"));
    assert.ok(frame.length > 300, "found the frame function");
    assert.doesNotMatch(frame, /getContext|drawImage|fillRect|clearRect|stroke\(|\.style\.|classList\.(?!add\("is-lit"|add)/);
    assert.doesNotMatch(scene, /createCanvasLoop\([^)]*render\(c/, "no loop draws");
    assert.match(scene, /\.animate\(/);
  });

  it("carries only images, never a canvas, by an animation, and keeps the earbud's sprite an <img>", () => {
    const scene = code("./prologue.ts");
    assert.match(scene, /const sprite = document\.createElement\("img"\)/);
    // The elements the animations are made on: the cover and the lines' covers (divs), the earbud wrapper, halo and empty earbud.
    assert.match(scene, /cover\.animate\(/);
    assert.match(scene, /bud,\s*steps\.map/);
  });

  it("styles with no z-index, nothing that blurs or masks, and the page's backdrop not drawn behind the opaque dialog while it plays", () => {
    const css = code("./prologue.css");
    assert.doesNotMatch(css, /z-index|mask-image|backdrop-filter|mix-blend-mode/);
    assert.match(css, /body:has\(dialog\.tsuki-cutscene\[open\]\[data-state="playing"\]\[data-mode="motion"\]\) \.sakura-backdrop \{\s*display: none;/);
    assert.match(css, /max-width: none/, "the page resets canvases and images to max-width: 100%, which would crush a sprite in a zero-size wrapper");
  });

  it("keeps the epigraph's own text node: covers are laid over it, in the card, and the paragraph's text is never replaced", () => {
    const scene = code("./prologue.ts");
    assert.doesNotMatch(scene, /textEl\.(textContent|innerHTML|innerText|replaceChildren|append|remove\()\s*[=(]/);
    assert.match(scene, /card\.append\(wrapper\)/);
  });
});
