import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { GUEST_NAMES, GUEST_NAME_MAX } from "../../data/hub/guest-names";
import { RETIRED_NAME_HASHES } from "../../data/hub/retired-names";
import { hashName, isRetiredName, migrateProfiles, pickGuestName } from "./guest-names-core.mjs";

const graphemes = (text: string) => [...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(text)].length;

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

// A retired hash paired with a name that is safe to write here: tests build
// their own retired list so no removed word has to appear in the source.
const RETIRED = "retired-test-name";
const RETIRED_HASHES = [hashName(RETIRED)];

describe("guest name list", () => {
  it("has at least 120 names and no duplicates", () => {
    assert.ok(GUEST_NAMES.length >= 120, `only ${GUEST_NAMES.length} names`);
    assert.equal(new Set(GUEST_NAMES).size, GUEST_NAMES.length);
  });

  it("keeps every name within the visible length limit", () => {
    for (const name of GUEST_NAMES) {
      assert.ok(graphemes(name) <= GUEST_NAME_MAX, `${name} is ${graphemes(name)} characters`);
    }
  });

  it("keeps the author's example name", () => {
    assert.ok(GUEST_NAMES.includes("เกาลัดพลังคลื่นเต่า"));
  });

  it("contains none of the retired names", () => {
    const retired = new Set(RETIRED_NAME_HASHES);
    for (const name of GUEST_NAMES) assert.ok(!isRetiredName(name, retired), name);
  });

  it("uses no profanity from a basic word list", () => {
    const banned = ["ควย", "หี", "เหี้ย", "สัส", "เย็ด", "เยี่ยว", "ตูด", "ดาก", "หำ"];
    for (const name of GUEST_NAMES) {
      for (const word of banned) assert.ok(!name.includes(word), `${name} contains ${word}`);
    }
  });

  it("records all 50 retired names, and keeps them out of the hub source", () => {
    assert.equal(RETIRED_NAME_HASHES.length, 50);
    assert.equal(new Set(RETIRED_NAME_HASHES).size, 50);
    const hub = readFileSync(join(process.cwd(), "src/pages/index.astro"), "utf8");
    assert.doesNotMatch(hub, /TROLL_NAMES|getRandomTrollName/);
  });
});

describe("pickGuestName", () => {
  it("never picks a name already in use", () => {
    const names = ["a", "b", "c"];
    for (let i = 0; i < 50; i++) {
      assert.notEqual(pickGuestName(names, ["a", "c"], Math.random), "a");
      assert.equal(pickGuestName(names, ["a", "c"], Math.random), "b");
    }
  });

  it("numbers a name once the whole list is taken, without colliding", () => {
    assert.equal(pickGuestName(["a"], ["a"], seq(0)), "a #2");
    assert.equal(pickGuestName(["a"], ["a", "a #2", "a #3"], seq(0)), "a #4");
  });
});

describe("migrateProfiles", () => {
  const names = ["fresh-1", "fresh-2", "fresh-3"];

  it("renames retired names and keeps every other field", () => {
    const profile = { id: "guest", name: RETIRED, avatar: "x", type: "guest", createdAt: 5 };
    const { profiles, changed } = migrateProfiles([profile], RETIRED_HASHES, names, seq(0));
    assert.equal(changed, true);
    assert.deepEqual(profiles[0], { ...profile, name: "fresh-1" });
  });

  it("renames the numbered form the old fallback produced", () => {
    const { profiles } = migrateProfiles([{ name: `${RETIRED} #512` }], RETIRED_HASHES, names, seq(0));
    assert.equal(profiles[0].name, "fresh-1");
  });

  it("leaves names the reader chose alone", () => {
    const input = [{ name: "ชื่อของฉัน" }, { name: "x #12" }, { name: `${RETIRED}!` }];
    const { profiles, changed } = migrateProfiles(input, RETIRED_HASHES, names, seq(0));
    assert.equal(changed, false);
    assert.deepEqual(profiles, input);
  });

  it("gives each renamed profile a different name, avoiding names in use", () => {
    const input = [{ name: RETIRED }, { name: "fresh-1" }, { name: `${RETIRED} #2` }];
    const { profiles } = migrateProfiles(input, RETIRED_HASHES, names, seq(0));
    const result = profiles.map((p) => p.name);
    assert.equal(new Set(result).size, 3);
    assert.ok(!result.some((name) => name.startsWith(RETIRED)));
  });

  it("tolerates malformed entries", () => {
    const input = [{ name: 42 }, { id: "no-name" }] as unknown as Array<{ name: string }>;
    const { changed } = migrateProfiles(input, RETIRED_HASHES, names, seq(0));
    assert.equal(changed, false);
  });
});

describe("hashName", () => {
  it("is a stable unsigned 32-bit FNV-1a", () => {
    assert.equal(hashName(""), 0x811c9dc5);
    assert.equal(hashName("a"), 0xe40c292c);
  });
});
