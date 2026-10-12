// Source rules for the reader upgrades of round three (design 4.5): the
// station-name sign, the part-to-part slide, the reading rail, the film frames,
// the chapter marks and the Walkman's cassette. Pure source checks plus the one
// pure helper of part-transition.ts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { CLEAR_AFTER_MS, PART_NAV_ATTRIBUTE, partNavDirection } from "./part-transition";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const HEADER = read("src/components/tsukinomi/reading/SectionHeader.astro");
const NAV = read("src/components/tsukinomi/reading/SectionNav.astro");
const PROGRESS = read("src/components/tsukinomi/reading/ReadingProgress.astro");
const LAYOUT = read("src/layouts/tsukinomi/TsukinomiSectionLayout.astro");
const WALKMAN = read("src/components/tsukinomi/audio/WalkmanPlayer.astro");
const CSS = read("src/styles/tsukinomi/section.css");

/** The body of the first rule whose selector list matches `selector` exactly as written. */
const rule = (css: string, selector: string) => {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `rule ${selector}`);
  return css.slice(at, css.indexOf("}", at));
};

describe("the station-name sign", () => {
  it("keeps the page's one h1 on the board, with the part's number and English name", () => {
    assert.equal((HEADER.match(/<h1\b/g) ?? []).length, 1);
    const board = HEADER.slice(HEADER.indexOf('class="station-sign__board"'), HEADER.indexOf('class="station-sign__band"'));
    for (const part of ['class="section-number"', "<h1>", 'class="section-english"']) assert.ok(board.includes(part), part);
  });

  it("names the neighbouring parts as real links, marked for the slide, in a labelled nav", () => {
    assert.match(HEADER, /<nav class="station-sign__band" aria-label="[^"]+">/);
    assert.match(HEADER, /rel="prev" data-part-nav="prev"/);
    assert.match(HEADER, /rel="next" data-part-nav="next"/);
  });

  it("finds the neighbours itself, so the route still passes only the section", () => {
    assert.match(HEADER, /getCollection\("tsukinomiSections"\)/);
    assert.match(read("src/pages/tsukinomi/sections/[slug].astro"), /<SectionHeader section=\{section\} \/>/);
  });

  it("gives every neighbour link a 44 px target and keeps dark text on the pale board", () => {
    assert.match(rule(CSS, ".station-sign__neighbour"), /min-height:\s*44px/);
    assert.match(rule(CSS, ".section-header .station-sign__board h1"), /color:\s*#17131f/);
  });
});

describe("the slide from part to part", () => {
  it("marks both of the page's own previous and next part links too", () => {
    assert.match(NAV, /rel="prev" data-part-nav="prev"/);
    assert.match(NAV, /rel="next" data-part-nav="next"/);
  });

  it("reads only the two directions", () => {
    assert.equal(partNavDirection("next"), "next");
    assert.equal(partNavDirection("prev"), "prev");
    for (const value of [null, undefined, "", "back", "NEXT"]) assert.equal(partNavDirection(value), null, String(value));
    assert.equal(PART_NAV_ATTRIBUTE, "data-tsuki-part-nav");
    assert.ok(CLEAR_AFTER_MS > 560, "the mark outlasts the slower animation");
  });

  it("animates the view transition only when motion is welcome, keyed on the mark", () => {
    const motion = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: no-preference) {\n  html[data-tsuki-part-nav"));
    assert.ok(motion.length > 0, "the slide sits inside a no-preference block");
    for (const direction of ["next", "prev"]) {
      for (const side of ["old", "new"]) assert.ok(motion.includes(`html[data-tsuki-part-nav="${direction}"]::view-transition-${side}(root)`), `${direction} ${side}`);
    }
  });

  it("is loaded from the header, not from the section layout's cutscene script", () => {
    assert.match(HEADER, /import "\.\.\/\.\.\/\.\.\/scripts\/tsukinomi\/reading\/part-transition"/);
    assert.doesNotMatch(LAYOUT, /part-transition/);
  });
});

describe("the reading rail", () => {
  it("keeps the progress span and adds the ticks and the lamp, all hidden from assistive technology", () => {
    assert.match(PROGRESS, /<div class="tsukinomi-reading-progress" aria-hidden="true" data-tsukinomi-rail>/);
    assert.match(PROGRESS, /<span data-tsukinomi-reading-progress><\/span>/);
    assert.match(PROGRESS, /data-tsukinomi-rail-ticks/);
    assert.match(PROGRESS, /class="tsukinomi-rail-head"/);
  });

  it("places a tick per chapter heading, again only when the layout changes, and drives the lamp by a property", () => {
    assert.match(PROGRESS, /:scope > h2\[id\^="ch-"\]/);
    assert.match(PROGRESS, /if \(key === tickLayoutKey\) return;/);
    assert.match(PROGRESS, /setProperty\("--rail-progress"/);
    assert.match(rule(CSS, ".tsukinomi-rail-head"), /transform:\s*translateX\(calc\(var\(--rail-progress, 0\) \* 100vw\)\)/);
  });
});

describe("the film frames and the chapter marks", () => {
  it("frames each illustration inside its own width, without a size or position change of the figure", () => {
    assert.match(rule(CSS, "article.tsukinomi-section .tsukinomi-illustration"), /width:\s*min\(100%, 34rem\)/);
    const img = rule(CSS, "article.tsukinomi-section .tsukinomi-illustration img");
    assert.match(img, /width:\s*100%/);
    assert.match(img, /padding:/);
    assert.match(img, /repeat-y/);
  });

  it("develops a frame only where scroll-driven animation exists and motion is welcome", () => {
    const at = CSS.indexOf("@supports (animation-timeline: view()) {\n  @media (prefers-reduced-motion: no-preference) {");
    assert.ok(at >= 0);
    assert.ok(CSS.slice(at, at + 400).includes("tsukinomi-film-develop"));
  });

  it("marks each chapter with tape-divider.svg, its URL set with the site base on the article", () => {
    assert.match(LAYOUT, /--tape-divider-mark: url\("\$\{withBase\("\/assets\/tsukinomi\/icons\/tape-divider\.svg"\)\}"\)/);
    const mark = rule(CSS, 'article.tsukinomi-section h2[id^="ch-"]::before');
    assert.match(mark, /mask: var\(--tape-divider-mark\)/);
  });

  it("keeps the resume highlight off the pseudo-element the chapter mark uses", () => {
    assert.match(CSS, /article\.tsukinomi-section \.resume-highlight::after \{/);
    assert.doesNotMatch(CSS, /\.resume-highlight::before/);
  });
});

describe("the Walkman's cassette", () => {
  it("lists the parts as real buttons with their cue, pressed for the current one", () => {
    assert.match(WALKMAN, /<button class="walkman-track" type="button" data-walkman-track=\{track\.cue\} aria-pressed="false">/);
    assert.match(WALKMAN, /track\.setAttribute\("aria-pressed", String\(track\.dataset\.walkmanTrack === currentCue\.id\)\)/);
    assert.match(WALKMAN, /walkmanAudio\.setCue\(id\);/);
  });

  it("takes each track's reading time from the section metadata and gives it a 44 px target", () => {
    assert.match(WALKMAN, /formatReadingTime\(data\.readingMinutes\)/);
    assert.match(WALKMAN, /\.walkman-track \{[^}]*min-height: 44px/);
  });
});
