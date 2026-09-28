import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { anchorForBlock, findAnchoredBlock } from "./reader/reading-progress";

// Block excerpts in document order; "" marks a current divider.
const excerpts = ["opening", "", "after divider", "middle", "", "", "closing"];
const excerptAt = (index: number) => excerpts[index];

describe("sea reading-progress anchoring", () => {
  it("anchors a text block on itself", () => {
    assert.deepEqual(anchorForBlock(3, excerpts.length, excerptAt), { index: 3, excerpt: "middle" });
  });

  it("anchors a divider on the next text block", () => {
    assert.deepEqual(anchorForBlock(1, excerpts.length, excerptAt), { index: 2, excerpt: "after divider" });
    assert.deepEqual(anchorForBlock(4, excerpts.length, excerptAt), { index: 6, excerpt: "closing" });
  });

  it("keeps the divider when no text block follows it", () => {
    const trailing = ["text", ""];
    assert.deepEqual(anchorForBlock(1, trailing.length, (i) => trailing[i]), { index: 1, excerpt: "" });
  });

  it("restores a saved anchor in place or re-anchors it after blocks shift", () => {
    assert.equal(findAnchoredBlock(2, "after divider", excerpts.length, excerptAt), 2);
    assert.equal(findAnchoredBlock(0, "middle", excerpts.length, excerptAt), 3);
    assert.equal(findAnchoredBlock(99, "closing", excerpts.length, excerptAt), 6);
    assert.equal(findAnchoredBlock(2, "removed paragraph", excerpts.length, excerptAt), null);
  });

  it("resolves legacy empty-excerpt records the same way a save does", () => {
    assert.equal(findAnchoredBlock(1, "", excerpts.length, excerptAt), 2);
    assert.equal(findAnchoredBlock(5, "", excerpts.length, excerptAt), 6);
  });

  it("rejects invalid saved indices", () => {
    assert.equal(findAnchoredBlock(Number.NaN, "middle", excerpts.length, excerptAt), null);
    assert.equal(findAnchoredBlock(-1, "middle", excerpts.length, excerptAt), null);
    assert.equal(findAnchoredBlock(0, "middle", 0, excerptAt), null);
  });
});
