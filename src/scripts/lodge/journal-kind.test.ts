import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JOURNAL_KINDS, journalClassName } from "../../plugins/remark-journal-kind.mjs";

describe("journalClassName", () => {
  it("adds the kind as a modifier class", () => {
    assert.deepEqual(JOURNAL_KINDS, ["elena", "hand", "print"]);
    assert.deepEqual(journalClassName({ kind: "elena" }, "x.md:1"), ["journal", "journal--elena"]);
    assert.deepEqual(journalClassName({ kind: "print" }, "x.md:1"), ["journal", "journal--print"]);
  });

  it("fails the build with the location when the kind is missing or unknown", () => {
    assert.throws(() => journalClassName({}, "03-morning.md:918"), /03-morning\.md:918: journal kind missing or unknown/);
    assert.throws(() => journalClassName(undefined, "a.md:2"), /a\.md:2/);
    assert.throws(() => journalClassName({ kind: "diary" }, "b.md:3"), /b\.md:3/);
  });
});
