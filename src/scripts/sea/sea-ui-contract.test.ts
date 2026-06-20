import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function projectPath(path: string): string {
  return join(root, path);
}

function readProjectFile(path: string): string {
  return readFileSync(projectPath(path), "utf8");
}

describe("Sea initial UI rework contract", () => {
  it("uses a story-scene hero image instead of the old cover-style image", () => {
    const heroPath = "public/assets/sea/images/hero-sea-v2.png";
    const homePage = readProjectFile("src/pages/sea/index.astro");
    const globalStyles = readProjectFile("src/styles/sea/global.css");
    const baseLayout = readProjectFile("src/layouts/sea/SeaBaseLayout.astro");
    const assetManifest = readProjectFile("assets-manifest.md");

    assert.equal(existsSync(projectPath(heroPath)), true, `${heroPath} should exist`);
    assert.ok(statSync(projectPath(heroPath)).size > 100_000, `${heroPath} should be a real generated image`);
    assert.match(homePage, /hero-sea-v2\.png/);
    assert.match(globalStyles, /sea-home-visual/);
    assert.match(globalStyles, /background-image:\s*linear-gradient/);
    assert.match(baseLayout, /hero-sea-v2\.png/);
    assert.match(assetManifest, /hero-sea-v2\.png/);
    assert.match(assetManifest, /sky-ocean above Elaris/);
  });

  it("removes the height altimeter and replaces the progress bar with a vertical current artifact", () => {
    const arcLayout = readProjectFile("src/layouts/sea/SeaArcLayout.astro");
    const homePage = readProjectFile("src/pages/sea/index.astro");
    const sonarPlayer = readProjectFile("src/components/sea/audio/SonarPlayer.astro");
    const backdrop = readProjectFile("src/components/sea/atmosphere/SeaRainBackdrop.astro");

    assert.doesNotMatch(arcLayout, /altimeter|Altitude|ALT|altitude|ความสูง|m</);
    assert.doesNotMatch(homePage, /การไต่ระดับ|ความสูง/);
    assert.doesNotMatch(sonarPlayer, /Altitude|altitude|ความสูง/);
    assert.doesNotMatch(backdrop, /Altitude|altitude|ความสูง/);
    assert.match(arcLayout, /sea-current-rail/);
    assert.match(arcLayout, /sea-current-orb/);
    assert.match(arcLayout, /sea-current-depth/);
    assert.match(arcLayout, /--sea-read-y/);
    assert.match(arcLayout, /style\.setProperty\("--sea-read-y"/);
    assert.doesNotMatch(arcLayout, /sea-current-fill|sea-current-track|style\.width/);
    assert.match(arcLayout, /data-current-label/);
    assert.match(arcLayout, /กระแสน้ำฟ้า/);
    assert.match(sonarPlayer, /Current Rail & Sonar/);
  });

  it("gives the Sea reader a non-Lodge relic system", () => {
    const arcLayout = readProjectFile("src/layouts/sea/SeaArcLayout.astro");

    assert.match(arcLayout, /sea-reader-relic/);
    assert.match(arcLayout, /btn-relic-icon/);
    assert.match(arcLayout, /sea-transition-relic/);
    assert.doesNotMatch(arcLayout, /sea-reader-sigil|sky-ocean-seal|btn-sigil-icon|ผนึกทะเลฟ้า/);
    assert.doesNotMatch(arcLayout, /btn-wheel-icon/);
    assert.doesNotMatch(arcLayout, /valve-pipes-svg/);
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
});
