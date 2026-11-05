import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CHAPTER_UNITS } from "../../data/kusabi/units";
import { UNLOCK_NOTICES, UNLOCKS, type UnlockId } from "../../data/kusabi/unlocks";
import {
  BYPASS_H2,
  bypassMatches,
  CASE_MAP_KEY,
  chapterKey,
  countMainRead,
  extraKey,
  FINISH_SCROLL,
  isFinishedRecord,
  isReadRecord,
  isUnlocked,
  kusabiDrift,
  manorState,
  parseReadList,
  parseRecord,
  reachedChapter,
  READS_KEY,
  readProgress,
  sha256Hex,
  unlockedIds,
  type KusabiProgress,
} from "./progress-core";

const record = (maxScrollPct: number, activeSeconds = 400) => JSON.stringify({ progress: maxScrollPct, activeSeconds, maxScrollPct });

function storage(entries: Record<string, string>) {
  return (key: string) => entries[key] ?? null;
}

function finished(numbers: number[], extras: string[] = [], rest: Partial<KusabiProgress> = {}): KusabiProgress {
  return {
    chapters: new Set(numbers),
    extras: new Set(extras),
    mainRead: numbers.filter((n) => n >= 1 && n <= 12).length,
    caseMap: false,
    bypass: false,
    ...rest,
  };
}

const all = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

describe("reading records", () => {
  it("rejects malformed records", () => {
    assert.equal(parseRecord(null), null);
    assert.equal(parseRecord("not json"), null);
    assert.equal(parseRecord("3"), null);
  });

  it("treats a missing maxScrollPct as the saved progress", () => {
    assert.equal(parseRecord(JSON.stringify({ progress: 0.5 }))?.maxScrollPct, 0.5);
  });

  it("needs the end of the page and two minutes to count as finished", () => {
    assert.equal(isFinishedRecord(parseRecord(record(0.97))), false);
    assert.equal(isFinishedRecord(parseRecord(record(FINISH_SCROLL, 119))), false);
    assert.equal(isFinishedRecord(parseRecord(record(FINISH_SCROLL, 120))), true);
  });

  it("keeps the old 70 percent rule for the read mark only", () => {
    assert.equal(isReadRecord(parseRecord(record(0.7, 120))), true);
    assert.equal(isFinishedRecord(parseRecord(record(0.7, 120))), false);
  });

  it("ignores junk in the read list and never counts the prologue or epilogue", () => {
    assert.deepEqual(parseReadList('[1,"a"]'), ["a"]);
    assert.deepEqual(parseReadList("{}"), []);
    assert.equal(countMainRead(["00-introduction", "13-epilogue", "01-hinomori-ryokan", "01-hinomori-ryokan", "unknown"]), 1);
  });
});

describe("readProgress", () => {
  it("reads only the keys it asks for, so profiles stay apart", () => {
    const progress = readProgress(
      storage({
        [chapterKey("01-hinomori-ryokan")]: record(0.99),
        [chapterKey("02-mountain-bride-rumors")]: record(0.75),
        [extraKey("e01")]: record(1),
        [READS_KEY]: JSON.stringify(["01-hinomori-ryokan", "02-mountain-bride-rumors"]),
        [CASE_MAP_KEY]: "open",
      }),
    );
    assert.deepEqual([...progress.chapters], [1]);
    assert.deepEqual([...progress.extras], ["e01"]);
    assert.equal(progress.mainRead, 2);
    assert.equal(progress.caseMap, true);
  });
});

describe("unlock table", () => {
  it("hides the caretaker, the mask and the true file until their chapters", () => {
    assert.equal(isUnlocked("staff", finished([0])), false);
    assert.equal(isUnlocked("staff", finished([1])), true);
    assert.equal(isUnlocked("mask", finished([1, 2, 3, 4, 5, 6, 7, 8, 9])), false);
    assert.equal(isUnlocked("mask", finished([10])), true);
    assert.equal(isUnlocked("shion", finished([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])), false);
    assert.equal(isUnlocked("shion", finished([12])), true);
  });

  it("does not open Shion's file at ten chapters, the old 80 percent bug", () => {
    const tenRead = finished([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(isUnlocked("shion", tenRead), false);
    assert.equal(isUnlocked("voice", tenRead), false);
  });

  it("keeps Ayame and the Extra arc behind the epilogue", () => {
    const main = finished([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.equal(isUnlocked("ayame", main), false);
    assert.equal(isUnlocked("extra-e01", main), false);
    const done = finished([...main.chapters, 13]);
    assert.equal(isUnlocked("ayame", done), true);
    assert.equal(isUnlocked("extra-e01", done), true);
  });

  it("needs ten main chapters read before E01", () => {
    assert.equal(isUnlocked("extra-e01", finished([12, 13])), false);
    assert.equal(isUnlocked("extra-e01", finished([12, 13], [], { mainRead: 10 })), true);
  });

  it("opens the Extra chapters one at a time", () => {
    const done = finished(all);
    assert.equal(isUnlocked("extra-e02", done), false);
    assert.equal(isUnlocked("extra-e02", finished(all, ["e01"])), true);
    assert.equal(isUnlocked("extra-e03", finished(all, ["e01"])), false);
  });

  it("opens the postcards after the map when E05 is not out", () => {
    assert.equal(isUnlocked("postcards", finished(all)), false);
    assert.equal(isUnlocked("postcards", finished(all, [], { caseMap: true })), true);
    assert.equal(isUnlocked("postcards", finished([], ["e05"])), true);
  });

  it("opens the sealed file only when everything published is done", () => {
    const published = ["e01", "e02", "e03", "e04"];
    assert.equal(isUnlocked("sealed", finished(all, published)), false);
    assert.equal(isUnlocked("sealed", finished(all, ["e01"], { caseMap: true })), false);
    assert.equal(isUnlocked("sealed", finished(all.slice(1), published, { caseMap: true })), false);
    assert.equal(isUnlocked("sealed", finished(all, published, { caseMap: true })), true);
  });

  it("lets the developer shortcut open everything, without publishing E05", () => {
    const progress = finished([], [], { bypass: true });
    assert.equal(unlockedIds(progress).length, Object.keys(UNLOCKS).length);
  });

  it("has a matching entry in the table for every notice", () => {
    for (const id of Object.keys(UNLOCK_NOTICES) as UnlockId[]) assert.ok(id in UNLOCKS, id);
  });
});

describe("site state", () => {
  it("adds hidden marks after the chapters that earn them", () => {
    assert.equal(kusabiDrift(finished([1, 2, 3, 4, 5, 6])), 0);
    assert.equal(kusabiDrift(finished([7])), 1);
    assert.equal(kusabiDrift(finished([11])), 2);
    assert.equal(kusabiDrift(finished([12])), 3);
    assert.equal(kusabiDrift(finished([13])), 4);
  });

  it("moves the home scene with the story", () => {
    assert.equal(manorState(finished([1, 2, 3])), "ajar");
    assert.equal(manorState(finished([4])), "closed");
    assert.equal(manorState(finished([13])), "after");
  });

  it("reveals a chapter title only once the reader has reached it", () => {
    assert.equal(reachedChapter(finished([]), []), 1);
    assert.equal(reachedChapter(finished([0, 1]), []), 2);
    assert.equal(reachedChapter(finished([]), ["03-lost-item"]), 4);
    assert.equal(reachedChapter(finished(all), []), 13);
  });
});

describe("developer shortcut", () => {
  it("accepts only a stored value that hashes to the known digest", async () => {
    assert.equal(await bypassMatches(null), false);
    assert.equal(await bypassMatches("wrong"), false);
    assert.equal(BYPASS_H2.length, 64);
    assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("units", () => {
  it("lists exactly the published chapter files", () => {
    const files = readdirSync(join(process.cwd(), "src/content/kusabi/chapters"))
      .filter((name) => name.endsWith(".md"))
      .map((name) => name.replace(/\.md$/, ""))
      .sort();
    assert.deepEqual(CHAPTER_UNITS.map((unit) => unit.id), files);
  });
});
