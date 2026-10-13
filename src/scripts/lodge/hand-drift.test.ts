import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { driftClusters } from "../../plugins/hand-drift.mjs";
import { remarkHand } from "../../plugins/remark-hand.mjs";

describe("driftClusters", () => {
  it("keeps a consonant with its vowels and tone marks", () => {
    assert.deepEqual(driftClusters("กี่", 5), [{ text: "กี่", glyph: "k" }]);
    assert.deepEqual(driftClusters("ส้ม", 3), [
      { text: "ส้", glyph: "s" },
      { text: "ม", glyph: null },
    ]);
    assert.deepEqual(driftClusters("ข", 4), [{ text: "ข", glyph: "kh" }]);
  });

  it("only knows the days the chapter describes", () => {
    assert.throws(() => driftClusters("ก", 2), /day/);
    assert.throws(() => driftClusters("ก", 6), /day/);
  });
});

describe("remarkHand", () => {
  it("turns :hand[...]{day} into a span with the drifting letters wrapped whole", () => {
    const node = { type: "textDirective", name: "hand", attributes: { day: "5" }, children: [{ type: "text", value: "สกี" }] };
    const tree = { type: "root", children: [{ type: "paragraph", children: [node] }] };
    remarkHand()(tree, { path: "18-mirror.md" });
    const data = (node as unknown as { data: { hName: string; hProperties: { className: string[] }; hChildren: unknown[] } }).data;
    assert.equal(data.hName, "span");
    assert.deepEqual(data.hProperties.className, ["hand", "hand--day-5"]);
    assert.deepEqual(data.hChildren, [
      { type: "element", tagName: "span", properties: { className: ["hand-g", "hand-g--s"] }, children: [{ type: "text", value: "ส" }] },
      { type: "element", tagName: "span", properties: { className: ["hand-g", "hand-g--k"] }, children: [{ type: "text", value: "กี" }] },
    ]);
  });

  it("fails the build on a day the chapter does not describe", () => {
    const node = { type: "textDirective", name: "hand", attributes: { day: "9" }, children: [{ type: "text", value: "ก" }] };
    assert.throws(() => remarkHand()({ type: "root", children: [node] }, { path: "x.md" }), /x\.md/);
  });
});

describe("chapter 18 markup", () => {
  it("marks the drift only where chapter 18 describes it", () => {
    const dir = join(process.cwd(), "src/content/lodge/chapters");
    const found: string[] = [];
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".md"))) {
      readFileSync(join(dir, file), "utf8")
        .split(/\r?\n/)
        .forEach((line, index) => {
          for (const match of line.matchAll(/:hand\[([^\]]+)\]\{day=(\d)\}/g)) found.push(`${file.slice(0, 2)}:${index + 1}:${match[1]}:${match[2]}`);
        });
    }
    assert.deepEqual(found, ["18:521:ก:3", "18:529:ก:5", "18:531:ข:5", "18:533:ส:5", "18:545:21 มิถุนายน 2024 บรูคลิน:5"]);
  });

  it("styles the drift without inline-block or transform, so Thai lines break as before", () => {
    const css = readFileSync(join(process.cwd(), "src/styles/lodge/chapter.css"), "utf8");
    const rules = [...css.matchAll(/([^{}]*\.hand[^{}]*)\{([^}]*)\}/g)];
    assert.ok(rules.length > 0, "no .hand rules");
    for (const [, selector, body] of rules) {
      assert.doesNotMatch(body, /inline-block|transform\s*:/, selector.trim());
    }
  });
});
