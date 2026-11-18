import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { stateLine } from "./chrome-world";

describe("stateLine (world label, spec 6)", () => {
  it("uses the card's own state line for an open card", () => {
    assert.equal(stateLine({ kind: "open", stateText: " อ่านต่อบทที่ 3 " }), "อ่านต่อบทที่ 3");
  });

  it("says the reader has not started an open card without a state line", () => {
    assert.equal(stateLine({ kind: "open", stateText: "" }), "ยังไม่ได้เริ่มอ่าน");
    assert.equal(stateLine({ kind: "open", stateText: "เข้าสู่เรื่อง" }), "ยังไม่ได้เริ่มอ่าน");
  });

  it("uses the fixed lines for locked and upcoming cards", () => {
    assert.equal(stateLine({ kind: "locked", stateText: "อ่านต่อ" }), "ยังไม่เปิดให้อ่าน");
    assert.equal(stateLine({ kind: "upcoming", stateText: "" }), "เร็วๆ นี้");
  });
});
