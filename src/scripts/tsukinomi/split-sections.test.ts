import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  SECTION_SPECS,
  buildSectionMarkdown,
  extractFrontmatter,
  splitTsukinomiSource,
  transformSectionLines,
} from "./split-sections";

describe("Tsukinomi section splitter", () => {
  it("rewrites chapter headings, strips markers, and preserves dividers", () => {
    const result = transformSectionLines([
      "=== Chapter 2 — Rain ===",
      "",
      "ฝนเริ่มตก",
      "",
      "* * *",
      "",
      "=== End Chapter 2 ===",
      "",
      "================================================================",
      "              END OF ACT 1 / DISCOVERY",
      "================================================================",
      "",
      "=== จบ ===",
      "",
      "final banner",
    ]);

    assert.deepEqual(result, [
      "## บทที่ 2 — Rain {#ch-2}",
      "",
      "ฝนเริ่มตก",
      "",
      "* * *",
    ]);
  });

  it("preserves existing frontmatter when composing markdown", () => {
    const frontmatter = extractFrontmatter(
      '---\nnumber: 1\ntitle: "บทแรก: เครื่องเล่นเทป กับ ฝน"\n---\n\n> stub: เนื้อหารอ Phase 3\n',
    );

    assert.equal(
      buildSectionMarkdown(frontmatter, ["## บทที่ 1 — The Walkman {#ch-1}", "", "ประโยคแรก"]),
      '---\nnumber: 1\ntitle: "บทแรก: เครื่องเล่นเทป กับ ฝน"\n---\n\n## บทที่ 1 — The Walkman {#ch-1}\n\nประโยคแรก\n',
    );
  });

  it("splits the real source into the five canonical section bodies", () => {
    const source = readFileSync("tsukinomi_station.txt", "utf8");
    const sections = splitTsukinomiSource(source);

    assert.equal(sections.length, 5);
    assert.deepEqual(sections.map((section) => section.spec.slug), SECTION_SPECS.map((spec) => spec.slug));

    const discovery = sections[0].lines.join("\n");
    assert.match(discovery, /## บทที่ 1 — The Walkman \{#ch-1\}/);
    assert.match(discovery, /## บทที่ 2 — Rain \{#ch-2\}/);
    assert.match(discovery, /## บทที่ 3 — The Train That Doesn't Come \{#ch-3\}/);
    assert.doesNotMatch(discovery, /Chapter 4/);

    const mountain = sections[3].lines.join("\n");
    assert.match(mountain, /## บทที่ 11 — Mizushima House \{#ch-11\}/);
    assert.match(mountain, /## บทที่ 16 — First Frost \{#ch-16\}/);
    assert.match(mountain, /ของในลิ้นชัก/);
    assert.doesNotMatch(mountain, /Chapter 17/);

    const tenYears = sections[4].lines.join("\n");
    assert.match(tenYears, /## บทที่ 18 — Ten Years \{#ch-18\}/);
    assert.doesNotMatch(tenYears, /=== จบ ===/);
    assert.doesNotMatch(tenYears, /Tsukinomi no Eki — Mizushima Kaori/);
  });
});
