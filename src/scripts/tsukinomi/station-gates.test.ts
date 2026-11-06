import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHAPTERS_DONE_KEY,
  REVEALED_KEY,
  SECRET_DEPTHS_KEY,
  bypassMatches,
  chaptersDone,
  extraOpen,
  maxSectionRead,
  parseSecretReads,
  stopNumber,
} from "./station-gates";

describe("parseSecretReads", () => {
  it("keeps real parts once and ignores the prologue and anything else", () => {
    assert.deepEqual(parseSecretReads('["00-introduction","01-discovery","01-discovery","nope",3]'), ["01-discovery"]);
  });

  it("treats missing or broken storage as nothing read", () => {
    assert.deepEqual(parseSecretReads(null), []);
    assert.deepEqual(parseSecretReads("{"), []);
    assert.deepEqual(parseSecretReads('{"a":1}'), []);
  });
});

describe("the Extra gate", () => {
  it("opens at four parts only when part 5 is one of them", () => {
    assert.equal(extraOpen(["01-discovery", "02-reveal", "03-decision", "04-mountain"]), false);
    assert.equal(extraOpen(["01-discovery", "02-reveal", "03-decision", "05-ten-years"]), true);
    assert.equal(extraOpen(["05-ten-years"]), false);
  });
});

describe("chaptersDone", () => {
  const store = (items: Record<string, string>) => (key: string) => items[key] ?? null;

  it("is nothing for a new reader", () => {
    assert.equal(chaptersDone(store({}), []), 0);
  });

  it("takes the chapter the reader recorded, and only a real chapter number", () => {
    assert.equal(chaptersDone(store({ [CHAPTERS_DONE_KEY]: "4" }), []), 4);
    assert.equal(chaptersDone(store({ [CHAPTERS_DONE_KEY]: "99" }), []), 18);
    assert.equal(chaptersDone(store({ [CHAPTERS_DONE_KEY]: "abc" }), []), 0);
    assert.equal(chaptersDone(store({ [CHAPTERS_DONE_KEY]: "-2" }), []), 0);
  });

  it("does not count a part that is only open", () => {
    const items = { "tsukinomi:reading:last": JSON.stringify({ sectionNumber: 4 }), [SECRET_DEPTHS_KEY]: JSON.stringify({ "04-mountain": 0.5 }) };
    assert.equal(chaptersDone(store(items), []), 0);
  });

  it("gives a reader from before the record every part they finished", () => {
    assert.equal(chaptersDone(store({}), ["01-discovery", "02-reveal"]), 6);
    assert.equal(chaptersDone(store({ [SECRET_DEPTHS_KEY]: JSON.stringify({ "03-decision": 0.99 }) }), []), 10);
    assert.equal(chaptersDone(store({ [SECRET_DEPTHS_KEY]: "{" }), []), 0);
    assert.equal(chaptersDone(store({ [REVEALED_KEY]: "true" }), []), 6);
  });

  it("never goes back for a reader further on than the old records say", () => {
    assert.equal(chaptersDone(store({ [CHAPTERS_DONE_KEY]: "12" }), ["01-discovery"]), 12);
  });
});

describe("maxSectionRead", () => {
  const store = (items: Record<string, unknown>) => (key: string) => (key in items ? JSON.stringify(items[key]) : null);

  it("takes the last part opened", () => {
    assert.equal(maxSectionRead(store({ "tsukinomi:reading:last": { sectionNumber: 2 } }), [], "guest"), 2);
  });

  it("counts a section past 60%, and only this profile's", () => {
    const items = {
      "tsukinomi:reading:section:03": { sectionNumber: 3, progress: 0.6 },
      "tsukinomi:reading:section:04": { sectionNumber: 4, progress: 0.59 },
      "tsukinomi:reading:section:05:p_other": { sectionNumber: 5, progress: 1 },
    };
    assert.equal(maxSectionRead(store(items), Object.keys(items), "p_me"), 3);
  });

  it("survives broken records", () => {
    const get = (key: string) => (key === "tsukinomi:reading:last" ? "{" : "not json");
    assert.equal(maxSectionRead(get, ["tsukinomi:reading:section:01"], "guest"), 0);
  });
});

describe("the developer shortcut", () => {
  it("accepts only a token of the shared developer key", async () => {
    assert.equal(await bypassMatches(null), false);
    assert.equal(await bypassMatches("wrong"), false);
  });
});

describe("stopNumber", () => {
  it("numbers the signs from one", () => {
    assert.equal(stopNumber(0), "TS 01");
    assert.equal(stopNumber(7), "TS 08");
  });
});
