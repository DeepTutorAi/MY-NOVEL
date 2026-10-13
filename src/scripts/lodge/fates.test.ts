import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { characterGroups } from "../../data/lodge/characters";
import { FATES, visibleStamps } from "../../data/lodge/fates";

const names = characterGroups.flatMap((group) => group.characters.map((character) => character.name));
const range = (from: number, to: number) => new Set(Array.from({ length: to - from + 1 }, (_, i) => from + i));

describe("fate table (design 8.4)", () => {
  it("covers every card, by the names the cards use", () => {
    assert.deepEqual([...FATES.map((fate) => fate.name)].sort(), [...names].sort());
  });

  it("keeps every stamp inside the book, in chapter order", () => {
    for (const fate of FATES) {
      const chapters = fate.stamps.map((stamp) => stamp.chapter);
      assert.ok(chapters.every((n) => n >= 1 && n <= 18), fate.name);
      assert.deepEqual(chapters, [...chapters].sort((a, b) => a - b), `${fate.name} out of order`);
      if (fate.fileNumber) assert.ok(fate.fileNumber.chapter >= 1 && fate.fileNumber.chapter <= 18);
    }
  });

  it("matches the approved finals", () => {
    const finals = Object.fromEntries(FATES.map((fate) => [fate.name, visibleStamps(fate, range(1, 18)).filter((s) => !s.superseded && !s.note).map((s) => s.stamp)]));
    assert.deepEqual(finals["Elena Vasquez"], ["SUBJECT 8"]);
    assert.deepEqual(finals["Marcus Hale"], ["DEAD SINCE 2019"]);
    assert.deepEqual(finals["Tom Janssen"], ["DEAD"]);
    assert.deepEqual(finals["Ben Ross"], ["DEAD"]);
    assert.deepEqual(finals["Jake Whitmore"], ["PRESUMED DEAD"]);
    assert.deepEqual(finals["Sophie Walters"], ["SACRIFICED"]);
    assert.deepEqual(finals["Detective Karlsen"], ["CASE OPEN"]);
  });
});

describe("visibleStamps", () => {
  const marcus = FATES.find((fate) => fate.name === "Marcus Hale");

  it("shows only what the reader has finished, crossing out what a later chapter overturned", () => {
    assert.ok(marcus);
    const shown = visibleStamps(marcus, range(1, 7));
    assert.deepEqual(
      shown.map((s) => [s.stamp, s.superseded]),
      [
        ["MISSING", true],
        ["DEAD", true],
        ["BODY GONE", false],
      ],
    );
    // A stamp needs only its own chapter finished (design 8.1): a reader who read
    // chapter 18 alone has read that reveal, and sees nothing from chapters they skipped.
    assert.deepEqual(
      visibleStamps(marcus, new Set([18])).map((s) => [s.stamp, s.superseded]),
      [["DEAD SINCE 2019", false]],
    );
  });

  it("never lets a note cross out a stamp", () => {
    const tom = FATES.find((fate) => fate.name === "Tom Janssen");
    assert.ok(tom);
    const shown = visibleStamps(tom, range(1, 9));
    assert.deepEqual(
      shown.map((s) => [s.stamp, s.superseded]),
      [
        ["DOUBLED", true],
        ["DEAD", false],
        ["COPY AT LARGE", false],
      ],
    );
  });
});

describe("card copy (design 12, decision 9)", () => {
  const card = (name: string) => characterGroups.flatMap((group) => group.characters).find((character) => character.name === name);

  it("names Sophie as the chapters do and fixes the roles the text contradicts", () => {
    assert.equal(card("Sophie Hale"), undefined);
    assert.equal(card("Sophie Walters")?.image, "/assets/lodge/images/characters/Sophie Hale.webp");
    assert.equal(card("Sophie Walters")?.role, "สถาปนิกชาวอังกฤษในเอกสารเก่าของลอดจ์");
    assert.equal(card("Elena Vasquez")?.role, "นักข่าวอิสระจากนิวยอร์ก ผู้เล่าเรื่องหลักของบันทึก");
    assert.equal(card("Lillian Hale")?.role, "นักภาษาศาสตร์ที่ผูกอยู่กับอดีตของฮวิตเวลต์");
  });
});
