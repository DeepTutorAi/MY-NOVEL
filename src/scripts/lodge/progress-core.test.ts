import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHAPTER_KEY_PREFIX,
  FINISHED,
  UNLOCK,
  finishedChapters,
  furthestAtLeast,
  lodgeDrift,
  readChapterProgress,
} from "./progress-core";

const range = (from: number, to: number) => new Set(Array.from({ length: to - from + 1 }, (_, i) => from + i));
const record = (chapterNumber: number, progress: number) => JSON.stringify({ chapterNumber: String(chapterNumber), progress });

describe("lodgeDrift", () => {
  it("follows the level table in the design (section 4.1)", () => {
    assert.equal(lodgeDrift(new Set()), 0);
    assert.equal(lodgeDrift(new Set([1])), 1);
    assert.equal(lodgeDrift(range(1, 5)), 2);
    assert.equal(lodgeDrift(range(1, 12)), 3);
    assert.equal(lodgeDrift(range(1, 18)), 4);
  });

  it("does not let a reader skip ahead into later levels", () => {
    assert.equal(lodgeDrift(new Set([18])), 1);
    assert.equal(lodgeDrift(new Set([5, 18])), 2);
    assert.equal(lodgeDrift(new Set([12, 18])), 1);
  });
});

describe("readChapterProgress", () => {
  it("reads unsuffixed legacy keys and the active profile's keys only", () => {
    const progress = readChapterProgress(
      [
        [`${CHAPTER_KEY_PREFIX}01-arrival`, record(1, 0.5)],
        [`${CHAPTER_KEY_PREFIX}02-first-night:p_me`, record(2, 1)],
        [`${CHAPTER_KEY_PREFIX}03-morning-without-marcus:p_other`, record(3, 1)],
      ],
      "p_me",
    );
    assert.deepEqual([...progress.entries()].sort(), [
      [1, 0.5],
      [2, 1],
    ]);
  });

  it("keeps the highest progress when a chapter appears twice", () => {
    const progress = readChapterProgress(
      [
        [`${CHAPTER_KEY_PREFIX}05-second-night`, record(5, 0.3)],
        [`${CHAPTER_KEY_PREFIX}05-second-night:p_me`, record(5, 0.9)],
      ],
      "p_me",
    );
    assert.equal(progress.get(5), 0.9);
  });

  it("ignores other keys, broken JSON and non-numeric values", () => {
    const progress = readChapterProgress(
      [
        ["hvitveldt:reading:last", record(9, 1)],
        [`${CHAPTER_KEY_PREFIX}06-ben-acts-off`, "{bad"],
        [`${CHAPTER_KEY_PREFIX}07-first-loss`, JSON.stringify({ chapterNumber: "7", progress: "lots" })],
        [`${CHAPTER_KEY_PREFIX}08-the-library`, null],
      ],
      "guest",
    );
    assert.equal(progress.size, 0);
  });
});

describe("thresholds", () => {
  it("counts a chapter finished at 0.995 and not at 0.99", () => {
    const progress = new Map([
      [1, 0.99],
      [2, FINISHED],
    ]);
    assert.deepEqual([...finishedChapters(progress, FINISHED)], [2]);
  });

  it("keeps the characters page unlock at 0.8", () => {
    const progress = new Map([
      [16, 0.81],
      [17, 0.79],
    ]);
    assert.equal(UNLOCK, 0.8);
    assert.equal(furthestAtLeast(progress, UNLOCK), 16);
    assert.equal(furthestAtLeast(new Map(), UNLOCK), 0);
  });
});
