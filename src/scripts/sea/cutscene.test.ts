import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { splitGraphemes, splitWords } from "./cutscene/graphemes";
import { isSceneId } from "./cutscene/registry";
import {
  cleanCutsceneUrl,
  cooldownDay,
  parseCutsceneParams,
  playedToday,
  shouldPlay,
  type CutsceneTrigger,
} from "./cutscene/runner";

const fresh: CutsceneTrigger = {
  hasEntry: true,
  resume: false,
  traversal: false,
  played: false,
  replay: false,
  force: false,
  dev: false,
};

describe("shouldPlay", () => {
  it("plays on a first, forward visit to an arc entry chapter", () => {
    assert.equal(shouldPlay(fresh), true);
  });

  it("never plays off the entry chapter, even when asked to", () => {
    assert.equal(shouldPlay({ ...fresh, hasEntry: false }), false);
    assert.equal(shouldPlay({ ...fresh, hasEntry: false, replay: true }), false);
    assert.equal(shouldPlay({ ...fresh, hasEntry: false, force: true, dev: true }), false);
  });

  it("stays quiet once played, on resume and on back/forward traversal", () => {
    assert.equal(shouldPlay({ ...fresh, played: true }), false);
    assert.equal(shouldPlay({ ...fresh, resume: true }), false);
    assert.equal(shouldPlay({ ...fresh, traversal: true }), false);
  });

  it("replays on ?cutscene=replay regardless of the other guards", () => {
    assert.equal(shouldPlay({ ...fresh, played: true, resume: true, traversal: true, replay: true }), true);
  });

  it("honours ?cutscene=force only in dev", () => {
    assert.equal(shouldPlay({ ...fresh, played: true, force: true, dev: false }), false);
    assert.equal(shouldPlay({ ...fresh, played: true, force: true, dev: true }), true);
  });
});

describe("once-per-day cooldown (resets at 06:00 local time)", () => {
  const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute);
  const stamp = (day: number, hour: number, minute = 0) => at(day, hour, minute).toISOString();

  it("spans from the latest 06:00 to the next one", () => {
    assert.deepEqual(cooldownDay(at(28, 10)), { start: at(28, 6).getTime(), end: at(29, 6).getTime() });
    assert.deepEqual(cooldownDay(at(28, 3)), { start: at(27, 6).getTime(), end: at(28, 6).getTime() });
    assert.deepEqual(cooldownDay(at(28, 6)), { start: at(28, 6).getTime(), end: at(29, 6).getTime() });
  });

  it("counts a play only within the current cooldown day", () => {
    assert.equal(playedToday(stamp(28, 7), at(28, 10)), true);
    assert.equal(playedToday(stamp(28, 5, 59), at(28, 10)), false);
    assert.equal(playedToday(stamp(27, 23), at(28, 10)), false);
    assert.equal(playedToday(stamp(27, 22), at(28, 3)), true);
    assert.equal(playedToday(stamp(27, 5), at(28, 3)), false);
  });

  it("treats missing or unreadable values as not played", () => {
    assert.equal(playedToday(null, at(28, 10)), false);
    assert.equal(playedToday("e2e", at(28, 10)), false);
  });
});

describe("cutscene URL parameters", () => {
  it("parses resume, replay, force and the dev scene override", () => {
    assert.deepEqual(parseCutsceneParams("?resume=1"), { resume: true, replay: false, force: false, scene: null });
    assert.deepEqual(parseCutsceneParams("?cutscene=replay"), { resume: false, replay: true, force: false, scene: null });
    assert.deepEqual(parseCutsceneParams("?cutscene=force&scene=porthole"), {
      resume: false,
      replay: false,
      force: true,
      scene: "porthole",
    });
    assert.equal(parseCutsceneParams("?resume=0").resume, false);
  });

  it("removes only the cutscene parameters when cleaning the URL", () => {
    assert.equal(cleanCutsceneUrl("https://x.test/sea/chapters/01/?cutscene=replay"), "/sea/chapters/01/");
    assert.equal(
      cleanCutsceneUrl("https://x.test/MY-NOVEL/sea/chapters/06/?cutscene=force&scene=dossier&a=1#t"),
      "/MY-NOVEL/sea/chapters/06/?a=1#t",
    );
    assert.equal(cleanCutsceneUrl("https://x.test/sea/chapters/01/?scene=x"), "/sea/chapters/01/?scene=x");
  });

  it("keeps the inline gate in SeaBaseLayout on the same rule", () => {
    const layout = readFileSync(new URL("../../layouts/sea/SeaBaseLayout.astro", import.meta.url), "utf8");
    assert.match(layout, /"sea:cutscene:played:" \+ arc/);
    assert.match(layout, /start\.setHours\(6, 0, 0, 0\)/);
    assert.match(layout, /mode === "replay"/);
    assert.match(layout, /params\.get\("resume"\) === "1"/);
    assert.match(layout, /nav\.traverse/);
    assert.match(layout, /sea-cutscene-pending/);
    assert.match(layout, /2500/);
    assert.match(layout, /navigationType === "traverse"/);
  });
});

describe("Thai grapheme splitting", () => {
  it("keeps vowels and tone marks on their base consonant", () => {
    assert.deepEqual(splitGraphemes("ฝนที่พูดได้"), ["ฝ", "น", "ที่", "พู", "ด", "ไ", "ด้"]);
    assert.deepEqual(splitGraphemes("แห้ง"), ["แ", "ห้", "ง"]);
    assert.equal(splitGraphemes("กระทรวงแผ่นดินแห้ง").join(""), "กระทรวงแผ่นดินแห้ง");
    for (const g of splitGraphemes("คนเดินเรือแห่งฟ้ากับนักล่าใบแดง")) {
      assert.doesNotMatch(g, /^[ัิ-ฺ็-๎]/, `grapheme "${g}" starts with a combining mark`);
    }
  });

  it("groups graphemes into words so titles wrap between words", () => {
    const words = splitWords("ฝนที่พูดได้");
    assert.deepEqual(
      words.map((word) => word.text),
      ["ฝน", "ที่", "พูด", "ได้"],
    );
    assert.deepEqual(words[1].graphemes, ["ที่"]);
    const subject = splitWords("เรื่อง: กระทรวงแผ่นดินแห้ง");
    assert.equal(subject.map((word) => word.text).join(""), "เรื่อง: กระทรวงแผ่นดินแห้ง");
    assert.ok(subject.some((word) => word.gap && word.text === " "));
  });
});

describe("scene registry", () => {
  it("knows the four scenes and nothing else", () => {
    for (const id of ["rain-on-glass", "porthole", "dossier", "sealed-depth"]) assert.equal(isSceneId(id), true);
    assert.equal(isSceneId("toString"), false);
    assert.equal(isSceneId(undefined), false);
  });
});
