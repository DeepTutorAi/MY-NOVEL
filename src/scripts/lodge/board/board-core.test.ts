import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SUSPECTS_KEY, parseSuspects, suspectedLine, toggleSuspect } from "./board-core";

const names = ["Elena Vasquez", "Diana Webb", "Ben Ross"];

describe("suspicion pins", () => {
  it("are stored under a profile-scoped key", () => {
    assert.equal(SUSPECTS_KEY, "hvitveldt:suspects");
  });

  it("keep only names that are on the board, once each", () => {
    assert.deepEqual(parseSuspects('["Diana Webb","Nobody","Diana Webb"]', names), ["Diana Webb"]);
  });

  it("treat anything malformed as no pins", () => {
    assert.deepEqual(parseSuspects(null, names), []);
    assert.deepEqual(parseSuspects("{bad", names), []);
    assert.deepEqual(parseSuspects('{"a":1}', names), []);
    assert.deepEqual(parseSuspects("[1,2]", names), []);
  });

  it("toggle a name on and off without touching the others", () => {
    assert.deepEqual(toggleSuspect(["Ben Ross"], "Diana Webb"), ["Ben Ross", "Diana Webb"]);
    assert.deepEqual(toggleSuspect(["Ben Ross", "Diana Webb"], "Ben Ross"), ["Diana Webb"]);
  });
});

describe("suspectedLine", () => {
  it("names whom the reader suspected and says whether Elena was one of them", () => {
    assert.equal(suspectedLine(["Diana Webb", "Ben Ross"]), "คุณเคยสงสัย Diana Webb, Ben Ross · ไม่เคยสงสัย Elena Vasquez");
    assert.equal(suspectedLine(["Elena Vasquez"]), "คุณเคยสงสัย Elena Vasquez · และคุณสงสัยถูกคน");
    assert.equal(suspectedLine([]), "คุณไม่ได้สงสัยใครเลย · ไม่เคยสงสัย Elena Vasquez");
  });
});
