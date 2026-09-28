import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { rehypeSeaScenes } from "../../../astro.config.mjs";

const root = process.cwd();

function projectPath(path: string): string {
  return join(root, path);
}

function readProjectFile(path: string): string {
  return readFileSync(projectPath(path), "utf8");
}

describe("Sea initial UI rework contract", () => {
  it("uses a story-scene hero image instead of the old cover-style image", () => {
    const heroPath = "public/assets/sea/images/hero-sea-v2.webp";
    const homePage = readProjectFile("src/pages/sea/index.astro");
    const globalStyles = readProjectFile("src/styles/sea/global.css");
    const baseLayout = readProjectFile("src/layouts/sea/SeaBaseLayout.astro");
    const assetManifest = readProjectFile("assets-manifest.md");

    assert.equal(existsSync(projectPath(heroPath)), true, `${heroPath} should exist`);
    assert.ok(statSync(projectPath(heroPath)).size > 50_000, `${heroPath} should be a real generated image`);
    assert.match(homePage, /hero-sea-v2\.(png|webp)/);
    assert.match(globalStyles, /sea-home-visual/);
    assert.match(globalStyles, /background-image:\s*linear-gradient/);
    assert.match(baseLayout, /hero-sea-v2\.(png|webp)/);
    assert.match(assetManifest, /hero-sea-v2\.(png|webp)/);
    assert.match(assetManifest, /sky-ocean above Elaris/);
  });

  it("removes the height altimeter and replaces the progress bar with a vertical current artifact", () => {
    const chapterLayout = readProjectFile("src/layouts/sea/SeaChapterLayout.astro");
    const currentRail = readProjectFile("src/components/sea/reading/CurrentRail.astro");
    const readingProgress = readProjectFile("src/scripts/sea/reader/reading-progress.ts");
    const homePage = readProjectFile("src/pages/sea/index.astro");
    const sonarPlayer = readProjectFile("src/components/sea/audio/SonarPlayer.astro");
    const backdrop = readProjectFile("src/components/sea/atmosphere/SeaRainBackdrop.astro");

    // Altitude read-outs stay banned. Bare /ALT/ and /m</ were too broad:
    // "SALT" (Salt Ward, salt rain) contains ALT, and any word ending in "m"
    // before a closing tag matched m<. Only a whole-word ALT or a number
    // followed by "m<" (a height such as "2,000m<") counts. The ALT check
    // stays case-sensitive so HTML alt= attributes do not match.
    const altitudePattern = /altimeter|altitude|ความสูง|\d\s?m</i;
    const altLabelPattern = /\bALT\b/;
    for (const source of [chapterLayout, currentRail, readingProgress]) {
      assert.doesNotMatch(source, altitudePattern);
      assert.doesNotMatch(source, altLabelPattern);
    }
    assert.doesNotMatch(homePage, /การไต่ระดับ|ความสูง/);
    assert.doesNotMatch(sonarPlayer, /Altitude|altitude|ความสูง/);
    assert.doesNotMatch(backdrop, /Altitude|altitude|ความสูง/);
    assert.match(chapterLayout, /<CurrentRail\s[^>]*\/>/);
    assert.match(currentRail, /sea-current-rail/);
    assert.match(currentRail, /sea-current-orb/);
    assert.match(currentRail, /sea-current-depth/);
    assert.match(currentRail, /--sea-read-y/);
    // The chapter layout binds reading-progress.ts, which drives the rail.
    assert.match(chapterLayout, /bindReadingProgress/);
    assert.match(readingProgress, /style\.setProperty\("--sea-read-y"/);
    assert.doesNotMatch(chapterLayout, /sea-current-fill|sea-current-track|style\.width/);
    assert.doesNotMatch(readingProgress, /sea-current-fill|sea-current-track|style\.width/);
    assert.doesNotMatch(currentRail, /sea-current-fill|sea-current-track|style\.width/);
    assert.match(currentRail, /data-current-label/);
    assert.match(currentRail, /กระแสน้ำฟ้า/);
    assert.match(sonarPlayer, /Current Rail & Sonar/);
  });

  it("gives the Sea reader a non-Lodge relic system", () => {
    const chapterLayout = readProjectFile("src/layouts/sea/SeaChapterLayout.astro");

    assert.match(chapterLayout, /sea-reader-relic/);
    assert.match(chapterLayout, /btn-relic-icon/);
    assert.match(chapterLayout, /sea-transition-relic/);
    assert.doesNotMatch(chapterLayout, /sea-reader-sigil|sky-ocean-seal|btn-sigil-icon|ผนึกทะเลฟ้า/);
    assert.doesNotMatch(chapterLayout, /btn-wheel-icon/);
    assert.doesNotMatch(chapterLayout, /valve-pipes-svg/);
    assert.equal(existsSync(projectPath("src/layouts/sea/SeaArcLayout.astro")), false);
  });

  it("routes Sea markdown dividers away from the Lodge rune", () => {
    const astroConfig = readProjectFile("astro.config.mjs");
    const globalStyles = readProjectFile("src/styles/sea/global.css");

    assert.match(astroConfig, /isSea/);
    assert.match(astroConfig, /the-sea-that-hung-above-the-world/);
    assert.match(astroConfig, /current-divider/);
    assert.match(astroConfig, /current-drop/);
    assert.match(globalStyles, /\.current-divider/);
    assert.match(globalStyles, /\.current-drop/);
    assert.doesNotMatch(globalStyles, /\.rune-divider/);
  });

  it("turns a mid-chapter POV line under a scene heading into a scene plate", () => {
    // Chapter 07 carries the real case: "## ที่อีกฟากของโลก: ..." followed by
    // "*POV: Sera Quill — ...*". Keep the fixture tied to the generated file.
    const chapter07 = readProjectFile("src/content/the-sea-that-hung-above-the-world/chapters/07.md");
    const povLine = "POV: Sera Quill — หอจดหมายเหตุแผนที่ ชั้นใต้ดินสอง กรุงหลวง เวลาเดียวกัน";
    assert.ok(chapter07.includes(`## ที่อีกฟากของโลก: หอจดหมายเหตุกรุงหลวง\n\n*${povLine}*`));

    const text = (value: string) => ({ type: "text", value });
    const element = (tagName: string, children: unknown[], properties: Record<string, unknown> = {}) => ({
      type: "element",
      tagName,
      properties,
      children,
    });
    const tree = {
      type: "root",
      children: [
        element("h2", [text("ที่อีกฟากของโลก: หอจดหมายเหตุกรุงหลวง")]),
        text("\n"),
        element("p", [element("em", [text(povLine)])]),
        text("\n"),
        element("p", [text("หมึกลบแผนที่ได้ แต่มันไม่ลบแผ่นดิน")]),
        text("\n"),
        element("p", [element("em", [text("POV: ไม่ได้อยู่ใต้หัวฉาก")])]),
      ],
    };
    const file = { path: `${root}/src/content/the-sea-that-hung-above-the-world/chapters/07.md` };

    (rehypeSeaScenes() as (tree: unknown, file: unknown) => void)(tree, file);

    const [heading, , plate, , prose, , stray] = tree.children as Array<{
      properties?: { id?: string; className?: string[] };
      children: Array<{ type: string; value?: string; tagName?: string }>;
    }>;
    assert.equal(heading.properties?.id, "scene-1");
    assert.deepEqual(heading.properties?.className, ["sea-scene"]);
    assert.deepEqual(plate.properties?.className, ["sea-scene-plate"]);
    assert.equal(plate.children.length, 1);
    assert.equal(plate.children[0].value, "Sera Quill — หอจดหมายเหตุแผนที่ ชั้นใต้ดินสอง กรุงหลวง เวลาเดียวกัน");
    assert.equal(prose.properties?.className, undefined);
    assert.equal(stray.properties?.className, undefined, "a POV line that does not follow a scene heading stays prose");
    assert.equal(stray.children[0].tagName, "em");
  });

  it("wires the reader chrome through the shared contracts", () => {
    const chapterLayout = readProjectFile("src/layouts/sea/SeaChapterLayout.astro");
    const baseLayout = readProjectFile("src/layouts/sea/SeaBaseLayout.astro");
    const settings = readProjectFile("src/scripts/sea/settings.ts");
    const drawer = readProjectFile("src/scripts/sea/reader/drawer.ts");
    const readingProgress = readProjectFile("src/scripts/sea/reader/reading-progress.ts");
    const sonarPlayer = readProjectFile("src/components/sea/audio/SonarPlayer.astro");
    const globalStyles = readProjectFile("src/styles/sea/global.css");

    assert.match(chapterLayout, /data-base-zone=\{zone\}/);
    assert.match(chapterLayout, /data-zone-shifts=\{JSON\.stringify\(zoneShifts\)\}/);
    assert.match(baseLayout, /astro:after-swap/);
    assert.match(baseLayout, /sea:settings:font-size/);
    assert.match(settings, /"sea:settings-change"/);
    assert.match(settings, /"sea:motion-change"/);
    assert.match(drawer, /showModal\(\)/);
    assert.match(readingProgress, /history\.replaceState\(history\.state,/);
    assert.match(readingProgress, /:scope > :is\(p, h2, h3, blockquote, \.current-divider\)/);
    assert.match(sonarPlayer, /userToggle\(\)/);
    assert.match(sonarPlayer, /aria-pressed/);
    assert.match(sonarPlayer, /role="status"/);
    assert.doesNotMatch(sonarPlayer, /outline:\s*none/);
    for (const source of [chapterLayout, baseLayout, settings, drawer, readingProgress, sonarPlayer]) {
      assert.doesNotMatch(source, /window\.addEventListener\(\s*["']astro:/);
    }
    assert.doesNotMatch(globalStyles, /word-break:\s*break-all|line-break:\s*anywhere/);
  });
});
