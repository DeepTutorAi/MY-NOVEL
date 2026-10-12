import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AUTO_START_CAP_MS,
  AUTO_START_MS,
  PART1,
  PROLOGUE,
  PROLOGUE_MAX_END_S,
  REVEAL_STEPS,
  autoClearRadius,
  autoStartDelayMs,
  bezier,
  createAutoStart,
  cumulativeLengths,
  lampLevel,
  pathUpTo,
  prologueEnd,
  rainLevel,
  revealLevel,
  startPlan,
  trainAt,
  wireFor,
  wireProgress,
} from "./p01-core";

describe("the prologue waits for Play", () => {
  it("starts by itself after AUTO_START_MS, and a reader on the button never holds it past the cap", () => {
    assert.equal(autoStartDelayMs(0), AUTO_START_MS);
    assert.equal(autoStartDelayMs(AUTO_START_CAP_MS - 1000), 1000);
    assert.equal(autoStartDelayMs(AUTO_START_CAP_MS + 5000), 0);
    assert.equal(autoStartDelayMs(Number.NaN), AUTO_START_MS);
  });

  it("asks for the gesture only when the reader pressed Play, and clicks itself only for a Walkman already on", () => {
    assert.deepEqual(startPlan(true, false), { requestGesture: true, ownClick: false });
    assert.deepEqual(startPlan(true, true), { requestGesture: true, ownClick: true });
    assert.deepEqual(startPlan(false, false), { requestGesture: false, ownClick: true });
  });

  it("runs the countdown once, holds it while the reader is on the button, and stops on cancel", async () => {
    let clock = 0;
    let started = 0;
    const auto = createAutoStart(() => started++, () => clock);
    auto.setEngaged(true);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(started, 0);
    auto.cancel();
    auto.setEngaged(false);
    assert.equal(started, 0);
    clock = AUTO_START_CAP_MS + 1;
    const late = createAutoStart(() => started++, () => clock);
    // Opened "after" the cap: it starts at once.
    clock += AUTO_START_CAP_MS;
    late.setEngaged(false);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(started, 1);
  });
});

describe("the prologue after Play", () => {
  it("runs its beats in order and ends a fixed time after Play", () => {
    assert.ok(PROLOGUE.tapeOn < PROLOGUE.wireStart && PROLOGUE.wireStart < PROLOGUE.wireEnd);
    assert.ok(PROLOGUE.subtitlesStart + PROLOGUE.subtitlesMs / 1000 < PROLOGUE.dissolveStart, "the subtitles are all up before the room goes");
    assert.ok(PROLOGUE.dissolveStart < PROLOGUE.dissolveEnd && PROLOGUE.dissolveEnd <= PROLOGUE.lampOn && PROLOGUE.lampOn < PROLOGUE.end);
    assert.equal(prologueEnd(null), Infinity);
    assert.equal(prologueEnd(6), 6 + PROLOGUE.end);
    assert.equal(PROLOGUE_MAX_END_S, AUTO_START_CAP_MS / 1000 + PROLOGUE.end);
  });

  it("lights the lamp with two dim stutters, never dark between them, then warms it to full", () => {
    assert.equal(lampLevel(-1), 0);
    assert.equal(lampLevel(Number.NaN), 0);
    assert.equal(lampLevel(10), 1);
    let drops = 0;
    let previous = lampLevel(0.3);
    for (let s = 0.31; s < 3; s += 0.01) {
      const value = lampLevel(s);
      assert.ok(value >= 0.25 || s < 0.25, `never back to dark at ${s.toFixed(2)}`);
      if (value < previous - 0.05) drops++;
      previous = value;
    }
    assert.ok(drops <= 2, `${drops} stutters`);
  });
});

describe("the earphone wire", () => {
  const wire = wireFor({ x: 400, y: 600 }, 1280, 800, 512);

  it("runs from the jack, splits, sends one branch out of the top and lays the other on the table", () => {
    assert.deepEqual(wire.trunk[0], { x: 400, y: 600 });
    assert.deepEqual(wire.worn[0], wire.trunk[wire.trunk.length - 1]);
    assert.deepEqual(wire.empty[0], wire.trunk[wire.trunk.length - 1]);
    assert.ok(wire.worn[wire.worn.length - 1].y < 0, "the worn branch leaves the picture at the top");
    const bud = wire.empty[wire.empty.length - 1];
    assert.ok(bud.y > 512 && bud.y < 800 && bud.x > 0 && bud.x < 1280, "the empty earbud lies on the table, on screen");
  });

  it("is pulled out trunk first, then both branches, smoothly", () => {
    assert.deepEqual(wireProgress(0), { trunk: 0, branches: 0 });
    assert.deepEqual(wireProgress(1), { trunk: 1, branches: 1 });
    assert.equal(wireProgress(0.4).branches, 0);
    assert.ok(wireProgress(0.6).trunk === 1 && wireProgress(0.6).branches > 0);
  });

  it("cuts a path at a fraction of its length, ending exactly there", () => {
    const line = bezier({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }, 30);
    const half = pathUpTo(line, 0.5);
    const lengths = cumulativeLengths(half);
    assert.ok(Math.abs(lengths[lengths.length - 1] - 15) < 0.01);
    const none = pathUpTo(line, 0);
    assert.deepEqual(none[none.length - 1], line[0], "nothing pulled out: the path ends where it starts");
    assert.deepEqual(pathUpTo([], 0.5), []);
  });
});

describe("part 1: the glass", () => {
  it("parts the fog from nothing to the full reach, by itself, between its two times", () => {
    assert.equal(autoClearRadius(PART1.autoClearStart - 0.1, 100), 0);
    assert.equal(autoClearRadius(PART1.autoClearEnd, 100), 100);
    assert.ok(PART1.autoClearEnd <= 6, "gone by about six seconds, as the design says");
  });

  it("passes the train once, right to left, and eases the rain off at the end", () => {
    assert.equal(trainAt(PART1.trainStart - 0.1), null);
    assert.equal(trainAt(PART1.trainStart), 0);
    assert.equal(trainAt(PART1.trainStart + PART1.trainDuration), 1);
    assert.equal(trainAt(PART1.trainStart + PART1.trainDuration + 0.1), null);
    assert.equal(rainLevel(1), 1);
    assert.ok(rainLevel(PART1.end) < 0.5);
  });

  it("sharpens the epigraph in steps as the glass in front of it clears", () => {
    assert.equal(revealLevel(1), 0);
    assert.equal(revealLevel(0), 1);
    assert.equal(revealLevel(Number.NaN), 0);
    for (let f = 0; f <= 1; f += 0.05) {
      const level = revealLevel(f);
      assert.equal(Math.round(level * REVEAL_STEPS), level * REVEAL_STEPS);
    }
    assert.ok(revealLevel(0.3) > revealLevel(0.7), "clearer glass, clearer text");
  });
});
