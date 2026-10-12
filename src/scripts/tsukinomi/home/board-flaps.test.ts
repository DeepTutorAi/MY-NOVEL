import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FLAP_DIGITS, flapFrames, formatClock24, msToNextMinute } from "./board-flaps";

const fixed = (value: number) => () => value;

describe("flapFrames", () => {
  it("ends every run on the card's own digit", () => {
    for (const digit of FLAP_DIGITS) {
      for (const draw of [0, 0.5, 0.999]) {
        const frames = flapFrames(digit, 1, fixed(draw));
        assert.equal(frames.at(-1), digit);
        assert.ok(frames.every((glyph) => FLAP_DIGITS.includes(glyph)));
      }
    }
  });

  it("never flips the colon or the last train's dashes", () => {
    assert.deepEqual(flapFrames(":", 2, Math.random), [":"]);
    assert.deepEqual(flapFrames("-", 0, Math.random), ["-"]);
    assert.deepEqual(flapFrames("", 0, Math.random), [""]);
  });

  it("lets later cards in a row take longer, so the row settles left to right", () => {
    assert.ok(flapFrames("4", 3, fixed(0)).length > flapFrames("4", 0, fixed(0)).length);
  });

  it("survives a random source that misbehaves", () => {
    for (const bad of [Number.NaN, -1, 7, Infinity]) {
      const frames = flapFrames("7", 0, fixed(bad));
      assert.equal(frames.at(-1), "7");
      assert.ok(frames.every((glyph) => FLAP_DIGITS.includes(glyph)), String(bad));
    }
  });
});

describe("the board clock", () => {
  it("shows 24-hour HH:MM with leading zeros", () => {
    assert.equal(formatClock24(new Date(2026, 9, 14, 7, 4)), "07:04");
    assert.equal(formatClock24(new Date(2026, 9, 14, 19, 14)), "19:14");
    assert.equal(formatClock24(new Date(2026, 9, 14, 0, 0)), "00:00");
  });

  it("shows the last train's dashes for a date it cannot read", () => {
    assert.equal(formatClock24(new Date(Number.NaN)), "--:--");
  });

  it("waits for the next minute, and never less than a quarter second", () => {
    assert.equal(msToNextMinute(new Date(2026, 0, 1, 12, 0, 0, 0)), 60_000);
    assert.equal(msToNextMinute(new Date(2026, 0, 1, 12, 0, 30, 0)), 30_000);
    assert.equal(msToNextMinute(new Date(2026, 0, 1, 12, 0, 59, 990)), 250);
  });
});
