import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { SEA_ARCS } from "../../data/sea/arcs";
import { SEA_ZONES } from "../../data/sea/zones";
import { SEA_CHAPTER_MANIFEST, type SeaChapterManifestEntry } from "./sea-chapter-manifest";
import {
  GENERATED_NOTICE,
  measureChapter,
  parseDraft,
  renderChapterFile,
  validateManifest,
} from "./sync-sea-chapters";

const root = process.cwd();

const entry = (overrides: Partial<SeaChapterManifestEntry> = {}): SeaChapterManifestEntry => ({
  id: "03",
  number: 3,
  source: "fixture.md",
  arc: 1,
  draft: false,
  zone: "elaris",
  musicCueId: "sun-sheet",
  plate: { place: "ท่าเรือ", pov: ["Ilyra"] },
  ...overrides,
});

describe("parseDraft", () => {
  it("strips the title, POV line and leading rule", () => {
    const parsed = parseDraft(
      "# บทที่ 3: เรืออัลบาทรอส\n\n*POV: Ilyra Venn (กัปตัน)*\n\n---\n\nย่อหน้าแรก\n\nย่อหน้าสอง\n\n*จบ บทที่ 3*\n",
      entry({ expectPov: ["Ilyra"] }),
    );
    assert.equal(parsed.number, 3);
    assert.equal(parsed.title, "เรืออัลบาทรอส");
    assert.equal(parsed.pov, "Ilyra Venn (กัปตัน)");
    assert.equal(parsed.body, "ย่อหน้าแรก\n\nย่อหน้าสอง\n");
    assert.equal(parsed.arcEnd, false);
    assert.deepEqual(parsed.warnings, []);
  });

  it("normalizes CRLF and a BOM, and reads the prologue heading as chapter 0", () => {
    const parsed = parseDraft(
      "﻿# บทนำ\r\n\r\n---\r\n\r\nเมื่อทะเลยกตัวขึ้น\r\n\r\nฝนซาลง\r\n",
      entry({ id: "00", number: 0, plate: { place: "เอลาริส", pov: [] } }),
    );
    assert.equal(parsed.number, 0);
    assert.equal(parsed.title, "บทนำ");
    assert.equal(parsed.pov, null);
    assert.equal(parsed.body, "เมื่อทะเลยกตัวขึ้น\n\nฝนซาลง\n");
    assert.equal(parsed.body.includes("\r"), false);
  });

  it("keeps a chapter without scene headings intact", () => {
    const parsed = parseDraft(
      "# บทที่ 3: เรือ\n\n*POV: Ilyra*\n\n---\n\nหนึ่ง\n\n---\n\nสอง\n\n*จบ บทที่ 3*",
      entry(),
    );
    assert.equal(parsed.sceneCount, 0);
    assert.equal(parsed.body, "หนึ่ง\n\n---\n\nสอง\n");
  });

  it("keeps italic prose lines such as the closing signature in chapter 12", () => {
    const parsed = parseDraft(
      "# บทที่ 12: Salt Ward\n\n*POV: Maera Sol*\n\n---\n\nมีตัวอักษรสองคำ\n\n*พี่ Cael*\n\n*จบ บทที่ 12*\n",
      entry({ id: "12", number: 12, arc: 3 }),
    );
    assert.equal(parsed.body, "มีตัวอักษรสองคำ\n\n*พี่ Cael*\n");
  });

  it("recognizes Thai and English arc-end markers and warns on a title mismatch", () => {
    const thai = parseDraft(
      "# บทที่ 10: เส้นทาง\n\n---\n\nเนื้อ\n\n---\n\n*จบ บทที่ 10*\n\n*จบ อาร์กที่ 2: คนเดินเรือแห่งฟ้ากับนักล่าใบแดง*\n",
      entry({ id: "10", number: 10, arc: 2 }),
    );
    assert.equal(thai.arcEnd, true);
    assert.equal(thai.body, "เนื้อ\n");
    assert.deepEqual(thai.warnings, []);

    const english = parseDraft(
      "# บทที่ 5: ออก\n\nเนื้อ\n\n*จบ บทที่ 5*\n\n*— จบ Arc 1: The Rain That Spoke —*\n",
      entry({ id: "05", number: 5 }),
    );
    assert.equal(english.arcEnd, true);
    assert.deepEqual(english.warnings, []);

    const mismatched = parseDraft(
      "# บทที่ 5: ออก\n\nเนื้อ\n\n*จบ อาร์กที่ 1: ชื่ออื่น*\n",
      entry({ id: "05", number: 5 }),
    );
    assert.equal(mismatched.arcEnd, true);
    assert.equal(mismatched.warnings.length, 1);
    assert.match(mismatched.warnings[0], /ชื่ออื่น/);
  });

  it("throws when the heading or end marker number disagrees with the manifest", () => {
    assert.throws(() => parseDraft("# บทที่ 4: ผิด\n\nเนื้อ\n", entry()), /heading says chapter 4/);
    assert.throws(() => parseDraft("# บทที่ 3: ถูก\n\nเนื้อ\n\n*จบ บทที่ 4*\n", entry()), /end marker says chapter 4/);
    assert.throws(() => parseDraft("บทที่ไม่มีหัว\n", entry()), /first line must be/);
  });

  it("peels a trailing bare rule and rejects stray markers left in the body", () => {
    const parsed = parseDraft("# บทที่ 3: เรือ\n\nเนื้อ\n\n---\n", entry());
    assert.equal(parsed.body, "เนื้อ\n");
    assert.throws(
      () => parseDraft("# บทที่ 3: เรือ\n\n*จบ บทที่ 3*\n\nยังมีต่อ\n", entry()),
      /stray end marker/,
    );
    assert.throws(() => parseDraft("# บทที่ 3: เรือ\n\n# หัวซ้ำ\n\nเนื้อ\n", entry()), /stray top-level heading/);
    assert.throws(() => parseDraft("# บทที่ 3: เรือ\n\n*จบ บทที่ 3*\n", entry()), /body is empty/);
  });

  it("reports POV drift and rejects zone shifts past the last scene", () => {
    const drift = parseDraft("# บทที่ 3: เรือ\n\n*POV: Cael*\n\nเนื้อ\n", entry({ expectPov: ["Ilyra"] }));
    assert.equal(drift.warnings.length, 1);
    assert.throws(
      () => parseDraft("# บทที่ 3: เรือ\n\n## เช้า: หนึ่ง\n\nเนื้อ\n", entry({ zoneShifts: [{ scene: 2, zone: "shroud" }] })),
      /zone shift points at scene 2/,
    );
  });
});

describe("renderChapterFile", () => {
  const manifestEntry = entry({
    plate: { place: "ท่าเรือ", time: "เช้า → ค่ำ", pov: ["Ilyra"] },
    zoneShifts: [{ scene: 1, zone: "shroud" }],
  });
  const source = "# บทที่ 3: เรือ \"Albatross\"\n\n*POV: Ilyra*\n\n---\n\n## เช้า: หนึ่ง\n\nเนื้อหา\n";

  it("writes deterministic frontmatter with the notice as a YAML comment", () => {
    const parsed = parseDraft(source, manifestEntry);
    const rendered = renderChapterFile(manifestEntry, parsed, measureChapter(parsed.body));
    const lines = rendered.split("\n");
    assert.equal(lines[0], "---");
    assert.equal(lines[1], GENERATED_NOTICE);
    assert.ok(lines[1].startsWith("# "));
    assert.equal(lines[4], 'title: "เรือ \\"Albatross\\""');
    assert.match(rendered, /\n {2}time: "เช้า → ค่ำ"\n/);
    assert.match(rendered, /\nzoneShifts: \[\{"scene":1,"zone":"shroud"\}\]\n/);
    assert.match(rendered, /\n---\n\n## เช้า: หนึ่ง\n\nเนื้อหา\n$/);
    assert.equal(rendered.includes("\r"), false);
  });

  it("is idempotent for the same input", () => {
    const render = () => {
      const parsed = parseDraft(source, manifestEntry);
      return renderChapterFile(manifestEntry, parsed, measureChapter(parsed.body));
    };
    assert.equal(render(), render());
  });
});

describe("Sea chapter manifest", () => {
  it("passes validation with unique numbers inside arc ranges", () => {
    validateManifest(SEA_CHAPTER_MANIFEST);
    const numbers = SEA_CHAPTER_MANIFEST.map((e) => e.number);
    assert.equal(new Set(numbers).size, numbers.length);
    assert.deepEqual(numbers, Array.from({ length: 16 }, (_, i) => i));
    for (const e of SEA_CHAPTER_MANIFEST) {
      const arc = SEA_ARCS.find((candidate) => candidate.number === e.arc);
      assert.ok(arc, `chapter ${e.id} arc`);
      assert.ok(e.number >= arc.chapterStart && e.number <= arc.chapterEnd, `chapter ${e.id} range`);
      assert.ok((SEA_ZONES as readonly string[]).includes(e.zone));
    }
  });

  it("publishes the prologue and chapters 1-5 and keeps 6-15 as drafts", () => {
    for (const e of SEA_CHAPTER_MANIFEST) {
      assert.equal(e.draft, e.number >= 6, `chapter ${e.id} draft flag`);
    }
  });

  it("points every entry at an existing draft", () => {
    for (const e of SEA_CHAPTER_MANIFEST) {
      assert.ok(existsSync(join(root, e.source)), `${e.source} should exist`);
    }
  });

  it("keeps the chapter 5 plate free of the Shroud", () => {
    const ch5 = SEA_CHAPTER_MANIFEST.find((e) => e.number === 5)!;
    assert.doesNotMatch(JSON.stringify(ch5.plate), /ม่าน|Shroud/i);
  });

  it("covers chapters 0-35 with contiguous arcs", () => {
    const sorted = [...SEA_ARCS].sort((a, b) => a.number - b.number);
    assert.equal(sorted[0].chapterStart, 0);
    assert.equal(sorted[sorted.length - 1].chapterEnd, 35);
    for (let i = 1; i < sorted.length; i++) {
      assert.equal(sorted[i].chapterStart, sorted[i - 1].chapterEnd + 1);
    }
    for (const arc of sorted) {
      assert.ok(arc.entryChapter >= arc.chapterStart && arc.entryChapter <= arc.chapterEnd);
    }
  });
});

describe("real drafts", () => {
  it("parse cleanly for all manifest entries", () => {
    for (const e of SEA_CHAPTER_MANIFEST) {
      const parsed = parseDraft(readFileSync(join(root, e.source), "utf8"), e);
      assert.equal(parsed.number, e.number);
      assert.ok(parsed.title.length > 0, `chapter ${e.id} title`);
      assert.ok(parsed.body.trim().length > 0, `chapter ${e.id} body`);
      assert.deepEqual(parsed.warnings, [], `chapter ${e.id} warnings`);
    }
  });

  it("marks the arc-closing drafts that carry an arc-end marker", () => {
    const arcEnds = SEA_CHAPTER_MANIFEST.filter(
      (e) => parseDraft(readFileSync(join(root, e.source), "utf8"), e).arcEnd,
    ).map((e) => e.id);
    assert.deepEqual(arcEnds, ["10", "15"]);
  });
});
