import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { splitGraphemes } from "./graphemes";

describe("splitGraphemes", () => {
  it("keeps vowels and tone marks on their base consonant", () => {
    assert.deepEqual(splitGraphemes("ฝนที่พูดได้"), ["ฝ", "น", "ที่", "พู", "ด", "ไ", "ด้"]);
    assert.deepEqual(splitGraphemes("แห้ง"), ["แ", "ห้", "ง"]);
  });

  it("never starts a cluster with a combining mark and never drops a character", () => {
    const text = "ความทรงจำเกี่ยวกับเธอเริ่มจางหายราวภาพถ่ายเก่าที่ถูกแดดเลีย... ทว่าสายลมแผ่วบาง";
    const clusters = splitGraphemes(text);
    assert.equal(clusters.join(""), text);
    for (const cluster of clusters) {
      assert.doesNotMatch(cluster, /^[ัิ-ฺ็-๎]/, `cluster "${cluster}" starts with a combining mark`);
    }
  });

  it("handles empty input, spaces and non-Thai text", () => {
    assert.deepEqual(splitGraphemes(""), []);
    assert.deepEqual(splitGraphemes("a b"), ["a", " ", "b"]);
    assert.equal(splitGraphemes("ฮารุโตะ 17 ปี").join(""), "ฮารุโตะ 17 ปี");
  });
});
