import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { EXTRA_NARRATION } from "../../../data/kusabi/extra-narration";
import { EXTRA_UNITS } from "../../../data/kusabi/units";
import { revealClusters, visibleCount } from "../../lodge/cutscene/reveal-core";
import { CLUSTERS_PER_SECOND, LINE_BREATH_S, narrationPace } from "./narration-core";
import { loadSceneFor } from "./registry";

describe("the pace of the voice", () => {
  it("starts at nothing and ends with everything", () => {
    const { pace } = narrationPace("กาน้ำ\nเดือด");
    assert.equal(pace(0), 0);
    assert.equal(pace(-1), 0);
    assert.equal(pace(1), 1);
    assert.equal(pace(2), 1);
    assert.equal(pace(Number.NaN), 0);
  });

  it("never goes backwards", () => {
    const { pace } = narrationPace(EXTRA_NARRATION.e04);
    let last = 0;
    for (let i = 0; i <= 500; i += 1) {
      const shown = pace(i / 500);
      assert.ok(shown >= last, `at ${i}`);
      last = shown;
    }
  });

  it("holds at the end of a line for a breath", () => {
    const text = "กกกก\nขขขข";
    const { duration, pace } = narrationPace(text);
    assert.equal(duration, 8 / CLUSTERS_PER_SECOND + LINE_BREATH_S);
    const count = revealClusters(text).length;
    const lineEnd = 4 / CLUSTERS_PER_SECOND / duration;
    assert.equal(visibleCount(pace(lineEnd), count), 4);
    // The fifth cluster is the line break itself, so nothing new can be seen during the breath.
    assert.ok(visibleCount(pace(lineEnd + (LINE_BREATH_S * 0.5) / duration), count) <= 5);
    assert.equal(visibleCount(pace(lineEnd + LINE_BREATH_S / duration), count), 5);
    assert.ok(visibleCount(pace(lineEnd + (LINE_BREATH_S + 1 / CLUSTERS_PER_SECOND) / duration), count) === 6);
  });

  it("copes with no text", () => {
    assert.equal(narrationPace("").pace(0.5), 0);
  });

  it("can be read within the time a reader will wait", () => {
    for (const [id, text] of Object.entries(EXTRA_NARRATION)) {
      const { duration } = narrationPace(text);
      assert.ok(duration > 8 && duration < 32, `${id}: ${duration}s`);
    }
  });
});

describe("the text", () => {
  const published = EXTRA_UNITS.filter((unit) => unit.published).map((unit) => unit.id);

  it("covers every published Extra and nothing else", () => {
    assert.deepEqual(Object.keys(EXTRA_NARRATION).sort(), [...published].sort());
  });

  it("never names her or the man on the tapes", () => {
    for (const [id, text] of Object.entries(EXTRA_NARRATION)) assert.doesNotMatch(text, /อายาเมะ|ชิอง/, id);
  });

  it("does not say what happens to her before the chapter that shows it", () => {
    for (const id of ["e01", "e02"]) assert.doesNotMatch(EXTRA_NARRATION[id], /ตาย|เทปของฉัน|ไม่อยู่แล้ว/, id);
  });

  it("keeps to the house style for Thai prose", () => {
    for (const [id, text] of Object.entries(EXTRA_NARRATION)) {
      assert.doesNotMatch(text, /[—–]/, id);
      assert.doesNotMatch(text, /ไม่ใช่.*แต่/, id);
    }
  });

  it("stays out of the browser bundle", () => {
    const source = readFileSync(join(process.cwd(), "src/scripts/kusabi/cutscene/index.ts"), "utf8");
    assert.doesNotMatch(source, /extra-narration/);
  });
});

describe("the registry", () => {
  it("has a scene for each narrated Extra and refuses anything else", async () => {
    await assert.rejects(loadSceneFor("e06"), RangeError);
    await assert.rejects(loadSceneFor("9"), RangeError);
    await assert.rejects(loadSceneFor("toString"), RangeError);
  });
});
