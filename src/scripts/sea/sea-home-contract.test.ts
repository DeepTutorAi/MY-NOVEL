import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

import { SEA_HERO_EPIGRAPH, SEA_HERO_LINES } from "../../data/sea/hero-lines";
import { atmosphereAt, AFTER_HERO_ATMOSPHERE } from "./home/ascent-core";
import { readMark, resolveResume } from "./home/home-reading-core";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const chapterFile = (id: string) => read(`src/content/the-sea-that-hung-above-the-world/chapters/${id}.md`);

const HOME_FILES = [
  "src/pages/sea/index.astro",
  "src/components/sea/home/AscentHero.astro",
  "src/components/sea/home/StrataToc.astro",
  "src/components/sea/home/SeaResume.astro",
  "src/data/sea/hero-lines.ts",
  "src/scripts/sea/home/ascent.ts",
  "src/scripts/sea/home/ascent-core.ts",
];

function filesUnder(dir: string, pattern: RegExp): string[] {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { recursive: true, encoding: "utf8" })
    .map((entry) => join(absolute, entry))
    .filter((path) => pattern.test(path) && statSync(path).isFile())
    .map((path) => relative(root, path));
}

// Only the <script> blocks of an .astro file ship to the browser.
function clientCode(path: string): string {
  const source = read(path);
  if (!path.endsWith(".astro")) return source;
  return [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]).join("\n");
}

describe("Sea home contract", () => {
  it("quotes every hero line verbatim from the prologue or chapter 1", () => {
    for (const line of [SEA_HERO_EPIGRAPH, ...SEA_HERO_LINES]) {
      assert.ok(["00", "01"].includes(line.source), `${line.text} must come from 00 or 01`);
      const body = chapterFile(line.source).split(/^---$/m).slice(2).join("---");
      assert.ok(body.includes(line.text), `"${line.text}" is not verbatim in chapters/${line.source}.md`);
    }
  });

  it("keeps altitude wording off the homepage and hero", () => {
    const altitude = /ความสูง|การไต่ระดับ|เมตร|altitude|altimeter|metres|meters|\d\s?m\b/i;
    for (const path of HOME_FILES) {
      assert.doesNotMatch(read(path), altitude, path);
    }
  });

  it("never imports the server-only arc data from client code", () => {
    const client = [
      ...filesUnder("src/scripts/sea/home", /\.ts$/),
      ...filesUnder("src/scripts/sea/gl", /\.(ts|glsl)$/),
      ...filesUnder("src/scripts/sea/cutscene", /\.ts$/),
      ...filesUnder("src/components/sea/home", /\.astro$/),
      ...filesUnder("src/components/sea/cutscene", /\.astro$/),
    ].filter((path) => !path.endsWith(".test.ts"));
    assert.ok(client.some((path) => path.endsWith("ascent.ts")));
    assert.ok(client.some((path) => path.endsWith("ceiling-renderer.ts")));
    for (const path of client) {
      assert.doesNotMatch(clientCode(path), /data\/sea\/arcs/, path);
    }
  });

  it("ships the ceiling plate and drops the old cover image", () => {
    const plate = "public/assets/sea/images/ceiling-plate.webp";
    assert.ok(existsSync(join(root, plate)), `${plate} should exist`);
    assert.ok(statSync(join(root, plate)).size > 10_000, `${plate} should be a real image`);
    assert.match(read("assets-manifest.md"), /ceiling-plate\.webp/);
    for (const path of [...HOME_FILES, "src/styles/sea/global.css"]) {
      assert.doesNotMatch(read(path), /hero-sea\.webp/, path);
    }
    assert.match(read("src/pages/sea/index.astro"), /rel="preload"[^>]*fetchpriority="high"/);
  });

  it("uses sticky scrolling, never a ScrollTrigger pin", () => {
    const ascent = read("src/scripts/sea/home/ascent.ts");
    assert.doesNotMatch(ascent, /\bpin\s*:/);
    assert.match(ascent, /import\("gsap"\)/);
    assert.match(ascent, /import\("gsap\/ScrollTrigger"\)/);
    assert.match(ascent, /onSeaPage\(/);
    assert.doesNotMatch(ascent, /window\.addEventListener\(\s*["']astro:/);
    assert.match(read("src/components/sea/home/AscentHero.astro"), /position:\s*sticky/);
  });

  it("sets the hero tier on the incoming document of every ClientRouter swap", () => {
    // Astro skips inline scripts it has already run and restores scroll before
    // running the rest, so a later visit must get its tier during the swap.
    const layout = read("src/layouts/sea/SeaBaseLayout.astro");
    assert.match(layout, /window\.__seaAscentTier\s*=/);
    assert.match(
      layout,
      /document\.addEventListener\("astro:before-swap",[\s\S]*?event\.newDocument\.querySelector\("section\[data-sea-ascent\]"\)[\s\S]*?dataset\.tier = window\.__seaAscentTier\(\)/,
    );
    assert.match(read("src/components/sea/home/AscentHero.astro"), /root\.dataset\.tier = window\.__seaAscentTier\(\)/);
  });

  it("applies a ceiling failure that happens before the live tier starts", () => {
    const ascent = read("src/scripts/sea/home/ascent.ts");
    assert.match(ascent, /let onCeilingFallback = \(reason: string\) => \{\s*earlyFallback = reason;/);
    assert.match(ascent, /if \(failedEarly\) onCeilingFallback\(failedEarly\);\s*else renderer\.start\(\);/);
  });

  it("maps scroll progress to rain, then fog without rain, then ceiling drips", () => {
    assert.deepEqual(atmosphereAt(0), ["elaris", 1]);
    assert.equal(atmosphereAt(0.3)[0], "elaris");
    assert.ok(atmosphereAt(0.3)[1] < atmosphereAt(0.05)[1], "rain thins during the rise");
    assert.equal(atmosphereAt(0.5)[0], "shroud");
    assert.equal(atmosphereAt(0.9)[0], "air-shelf");
    assert.equal(AFTER_HERO_ATMOSPHERE[0], "air-shelf");
  });

  it("resolves the resume chip from v2 and legacy records", () => {
    const units = [
      { id: "00", number: 0 },
      { id: "03", number: 3 },
      { id: "04", number: 4 },
    ];
    const base = "/sea/chapters/";
    assert.deepEqual(resolveResume({ v: 2, chapterId: "03", progress: 0.4 }, units, base), {
      label: "อ่านต่อ · บทที่ 3 · 40%",
      href: "/sea/chapters/03/?resume=1",
      chapterId: "03",
      legacy: false,
    });
    assert.equal(resolveResume({ chapterId: "03", progress: 1 }, units, base)?.href, "/sea/chapters/04/");
    assert.equal(resolveResume({ chapterId: "04", progress: 1 }, units, base)?.label, "อ่านอีกครั้ง · บทที่ 4");
    assert.equal(resolveResume({ arcId: "arc-01", progress: 0.2 }, units, base)?.href, "/sea/chapters/00/?resume=1");
    assert.equal(resolveResume({ chapterId: "09", progress: 0.5 }, units, base), null, "unpublished chapters never show");
    assert.equal(resolveResume({ chapterId: "03", progress: 0.001 }, units, base), null);
    assert.equal(resolveResume(null, units, base), null);
  });

  it("parks ScrollTrigger when the hero is torn down", () => {
    // ScrollTrigger runs its own requestAnimationFrame loop until disabled;
    // left running it kept ticking on every page reached through the router.
    const ascent = read("src/scripts/sea/home/ascent.ts");
    assert.match(ascent, /scrollTriggerApi\.disable\(\)/);
    assert.match(ascent, /ScrollTrigger\.enable\(\)/);
    assert.match(ascent, /mm\.revert\(\);\s*\n\s*parkScrollTriggerIfIdle\(\);/);
  });

  it("formats table-of-contents read marks", () => {
    assert.equal(readMark(null), null);
    assert.equal(readMark(0.001), null);
    assert.deepEqual(readMark(0.42), { text: "42%", spoken: "อ่านแล้ว 42%" });
    assert.deepEqual(readMark(1), { text: "✓", spoken: "อ่านจบแล้ว" });
  });
});
