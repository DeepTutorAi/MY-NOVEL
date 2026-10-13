// Source rules for the Lodge reader (design section 6): the reading text keeps
// its type, the decorative layers respect reduced motion, and the contents
// menu keeps its links and its secret-read marks.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const globalCss = read("src/styles/lodge/global.css");
const chapterCss = read("src/styles/lodge/chapter.css");

describe("the reading text is untouched", () => {
  it("keeps the reading size, measure and line height", () => {
    assert.match(globalCss, /--measure: clamp\(58ch, 50vw, 68ch\);/);
    assert.match(globalCss, /--reading-size: clamp\(17px, calc\(1\.05vw \+ 14px\), 20px\);/);
    assert.match(globalCss, /--line-height-body: 1\.75;/);
    assert.match(globalCss, /--paper: #0E0D0C;/);
    assert.match(globalCss, /--ink: #ECE7DD;/);
  });
});

describe("the notebook page", () => {
  it("writes the chapter number in Elena's hand", () => {
    assert.match(chapterCss, /\.chapter-number \{[^}]*font-family: var\(--font-hand\)/);
  });

  it("sketches figures in only with scroll timelines and without a reduced-motion preference", () => {
    const block = chapterCss.match(/@supports \(animation-timeline: view\(\)\) \{([\s\S]*?)\n\}/);
    assert.ok(block, "no @supports (animation-timeline: view()) block");
    assert.match(block[1], /@media \(prefers-reduced-motion: no-preference\)/);
    assert.match(block[1], /\.chapter-figure img/);
    assert.match(block[1], /animation-timeline: view\(\)/);
    const outside = chapterCss.replace(block[0], "");
    assert.doesNotMatch(outside, /figure-sketch/, "the sketch animation is used outside the guarded block");
  });

  it("draws site-wide snow as pencil strokes, not dots", () => {
    const snow = read("src/components/lodge/atmosphere/SnowCanvas.astro");
    assert.doesNotMatch(snow, /context\.arc\(/);
    assert.match(snow, /context\.lineTo\(/);
  });
});

describe("the contents menu", () => {
  it("keeps every chapter link and the secret-read marks", () => {
    const menu = read("src/components/lodge/navigation/TableOfContents.astro");
    assert.match(menu, /hvitveldt:secret:reads/);
    assert.match(menu, /data-chapter-id=\{chapter\.id\}/);
    assert.match(menu, /GUEST RECORDS/);
  });
});
