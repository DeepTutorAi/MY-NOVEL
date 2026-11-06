import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fontKey, lineKey, readingLineShift, toFontStep, toLineStep } from "./reader-type-core";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("the steps", () => {
  it("falls back to the novel's own type on anything unknown", () => {
    assert.equal(toFontStep(null), "normal");
    assert.equal(toFontStep("huge"), "normal");
    assert.equal(toFontStep("xl"), "xl");
    assert.equal(toLineStep("tight"), "normal");
    assert.equal(toLineStep("loose"), "loose");
  });

  it("keeps each novel's settings apart", () => {
    assert.equal(fontKey("lodge"), "lodge:settings:font-size");
    assert.equal(lineKey("tsukinomi"), "tsukinomi:settings:line-height");
  });
});

describe("the reading line", () => {
  const line = 300;

  it("keeps the same point of a block on the line when the block shrinks", () => {
    // Half of a 400px block is above the line. It shrinks to 200px and moves to top 150.
    const shift = readingLineShift({ top: 100, height: 400 }, { top: 150, height: 200 }, line);
    assert.equal(150 + 100 - shift, line);
  });

  it("never carries the next block past the line, however much the text shrinks", () => {
    const before = { top: 40, height: 620 };
    const after = { top: 40, height: 180 };
    const shift = readingLineShift(before, after, line);
    const nextBlockTop = after.top + after.height - shift;
    assert.ok(nextBlockTop > line, `next block at ${nextBlockTop}`);
  });

  it("does not move a block that has not reached the line", () => {
    assert.equal(readingLineShift({ top: 300, height: 100 }, { top: 300, height: 60 }, line), 0);
  });

  it("copes with an empty block", () => {
    assert.equal(readingLineShift({ top: 300, height: 0 }, { top: 310, height: 0 }, line), 10);
  });
});

describe("where it is mounted", () => {
  it("applies before paint on both novels, right after the storage interceptor", () => {
    for (const [path, novel] of [
      ["src/layouts/lodge/LodgeBaseLayout.astro", "lodge"],
      ["src/layouts/tsukinomi/TsukinomiBaseLayout.astro", "tsukinomi"],
    ]) {
      assert.match(read(path), new RegExp(`<ProfileStorageInterceptor />\\s*<ReaderTypeHead novel="${novel}" />`), path);
    }
  });

  it("is in both settings panels", () => {
    assert.match(read("src/components/lodge/audio/AmbientPlayer.astro"), /<ReaderTypeControls novel="lodge" \/>/);
    assert.match(read("src/components/tsukinomi/audio/WalkmanPlayer.astro"), /<ReaderTypeControls novel="tsukinomi" \/>/);
  });

  it("reaches only the chapter text, so the hub is never resized", () => {
    const controls = read("src/components/_shared/ReaderTypeControls.astro");
    const global = controls.slice(controls.indexOf("<style is:global>"));
    for (const rule of global.matchAll(/^\s*html\[[^\n]+$/gm)) {
      assert.match(rule[0], /article\.(chapter|tsukinomi-section)/, rule[0]);
    }
  });

  it("recomputes the rails from its own event, not a resize", () => {
    for (const path of ["src/components/lodge/reading/ReadingProgress.astro", "src/components/tsukinomi/reading/ReadingProgress.astro"]) {
      const source = read(path);
      assert.match(source, /addEventListener\("reader-type-change", requestUpdate\)/, path);
      assert.match(source, /removeEventListener\("reader-type-change", requestUpdate\)/, path);
    }
    assert.doesNotMatch(read("src/scripts/_shared/reader-type.ts"), /new Event\("resize"\)/);
  });
});
