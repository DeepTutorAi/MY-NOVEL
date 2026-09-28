import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SEA_ARCS } from "../../data/sea/arcs";
import {
  arcForChapterNumber,
  buildSeaToc,
  isArcEntry,
  isSeaChapterVisible,
  neighbors,
  type SeaChapterLike,
} from "../../utils/sea-chapters-core";

const chapter = (number: number, arc: number, draft = false): SeaChapterLike => ({
  id: String(number).padStart(2, "0"),
  data: { number, arc, title: `title ${number}`, draft },
});

const published = [0, 1, 2, 3, 4, 5].map((n) => chapter(n, 1));
const drafts = [6, 7, 8, 9, 10].map((n) => chapter(n, 2, true)).concat([11, 12, 13, 14, 15].map((n) => chapter(n, 3, true)));
const all = [...published, ...drafts];

describe("Sea chapter visibility", () => {
  it("hides drafts in production and shows them in dev", () => {
    assert.equal(isSeaChapterVisible({ draft: true }, true), false);
    assert.equal(isSeaChapterVisible({ draft: true }, false), true);
    assert.equal(isSeaChapterVisible({ draft: false }, true), true);
    assert.equal(isSeaChapterVisible({}, true), true);
  });
});

describe("buildSeaToc", () => {
  it("opens only arcs with visible chapters and keeps chapter order", () => {
    const prodChapters = all.filter((c) => isSeaChapterVisible(c.data, true));
    const strata = buildSeaToc([...prodChapters].reverse(), SEA_ARCS);

    assert.equal(strata.length, SEA_ARCS.length);
    const [first, ...rest] = strata;
    assert.equal(first.sealed, false);
    if (!first.sealed) {
      assert.equal(first.titleTh, "ฝนที่พูดได้");
      assert.deepEqual(first.chapters.map((c) => c.id), ["00", "01", "02", "03", "04", "05"]);
      assert.equal(first.hasDrafts, false);
    }
    for (const stratum of rest) {
      assert.equal(stratum.sealed, true);
    }
  });

  it("gives sealed strata no title fields at all", () => {
    const strata = buildSeaToc(published, SEA_ARCS);
    const sealed = strata.filter((stratum) => stratum.sealed);
    assert.equal(sealed.length, 6);
    for (const stratum of sealed) {
      assert.deepEqual(Object.keys(stratum).sort(), ["chapterEnd", "chapterStart", "number", "sealed"]);
      const serialized = JSON.stringify(stratum);
      const arc = SEA_ARCS.find((candidate) => candidate.number === stratum.number)!;
      assert.equal(serialized.includes(arc.titleTh), false);
      assert.equal(serialized.includes(arc.titleEn), false);
    }
  });

  it("marks arcs that contain drafts in dev", () => {
    const strata = buildSeaToc(all, SEA_ARCS);
    const arc2 = strata.find((stratum) => stratum.number === 2);
    assert.ok(arc2 && !arc2.sealed);
    if (arc2 && !arc2.sealed) {
      assert.equal(arc2.hasDrafts, true);
      assert.equal(arc2.chapters.length, 5);
    }
    assert.equal(strata.find((stratum) => stratum.number === 4)?.sealed, true);
  });
});

describe("neighbors", () => {
  it("returns previous and next by chapter number", () => {
    const { prev, next } = neighbors([...published].reverse(), "03");
    assert.equal(prev?.id, "02");
    assert.equal(next?.id, "04");
  });

  it("returns null at the edges and for unknown ids", () => {
    assert.equal(neighbors(published, "00").prev, null);
    assert.equal(neighbors(published, "05").next, null);
    assert.deepEqual(neighbors(published, "99"), { prev: null, next: null });
  });
});

describe("isArcEntry", () => {
  it("marks chapter 1 (not the prologue) as the Arc 1 entry", () => {
    assert.equal(isArcEntry(chapter(0, 1), SEA_ARCS), false);
    assert.equal(isArcEntry(chapter(1, 1), SEA_ARCS), true);
    assert.equal(isArcEntry(chapter(2, 1), SEA_ARCS), false);
  });

  it("marks the first chapter of Arcs 2 and 3", () => {
    assert.equal(isArcEntry(chapter(6, 2), SEA_ARCS), true);
    assert.equal(isArcEntry(chapter(11, 3), SEA_ARCS), true);
    assert.equal(isArcEntry(chapter(7, 2), SEA_ARCS), false);
  });
});

describe("arcForChapterNumber", () => {
  it("finds the arc whose range contains a chapter", () => {
    assert.equal(arcForChapterNumber(0, SEA_ARCS)?.number, 1);
    assert.equal(arcForChapterNumber(6, SEA_ARCS)?.number, 2);
    assert.equal(arcForChapterNumber(16, SEA_ARCS)?.number, 4);
    assert.equal(arcForChapterNumber(36, SEA_ARCS), undefined);
  });
});
