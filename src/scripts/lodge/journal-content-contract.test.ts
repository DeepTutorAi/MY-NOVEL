// The 25 journal blocks of the Lodge chapters carry the kind approved in the
// design (section 6.2), on their opening line only.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const DIR = join(process.cwd(), "src/content/lodge/chapters");

const EXPECTED: Record<string, "elena" | "hand" | "print"> = {
  "01:55": "print",
  "01:375": "hand",
  "01:415": "elena",
  "02:552": "elena",
  "03:265": "print",
  "03:525": "hand",
  "03:675": "print",
  "03:918": "print",
  "03:933": "print",
  "03:944": "print",
  "03:950": "print",
  "03:988": "print",
  "03:1005": "print",
  "04:139": "hand",
  "04:147": "hand",
  "04:161": "hand",
  "04:183": "hand",
  "04:207": "hand",
  "04:241": "hand",
  "04:573": "hand",
  "05:155": "elena",
  "06:507": "hand",
  "07:632": "elena",
  "18:66": "print",
  "18:497": "elena",
};

function openings(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of readdirSync(DIR).filter((name) => name.endsWith(".md"))) {
    readFileSync(join(DIR, file), "utf8")
      .split(/\r?\n/)
      .forEach((line, index) => {
        if (line.startsWith(":::สมุดบันทึก")) found.set(`${file.slice(0, 2)}:${index + 1}`, line);
      });
  }
  return found;
}

describe("Lodge journal blocks", () => {
  it("open exactly where the design's table says, each with its kind", () => {
    const found = openings();
    assert.deepEqual([...found.keys()].sort(), Object.keys(EXPECTED).sort());
    for (const [where, kind] of Object.entries(EXPECTED)) {
      assert.equal(found.get(where), `:::สมุดบันทึก{kind=${kind}}`, where);
    }
  });
});
