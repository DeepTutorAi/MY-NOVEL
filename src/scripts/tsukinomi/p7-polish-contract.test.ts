import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function projectPath(path: string): string {
  return join(root, path);
}

function readProjectFile(path: string): string {
  return readFileSync(projectPath(path), "utf8");
}

describe("Tsukinomi P7 polish contract", () => {
  it("keeps reading progress, resume storage, and resume landing at section-block precision", () => {
    const progress = readProjectFile("src/components/tsukinomi/reading/ReadingProgress.astro");
    const sectionCss = readProjectFile("src/styles/tsukinomi/section.css");

    assert.match(progress, /const storageKey = "tsukinomi:reading:last"/);
    assert.match(progress, /`tsukinomi:reading:section:\$\{sectionId\}`/);
    assert.match(progress, /resumeRequested/);
    assert.match(progress, /scrollRestoration/);
    assert.match(progress, /readStored/);
    assert.match(progress, /ANCHOR_SELECTOR/);
    assert.match(progress, /blockIndex/);
    assert.match(progress, /blockExcerpt/);
    assert.match(progress, /history\.replaceState/);
    assert.match(progress, /resume-highlight/);
    assert.match(progress, /pagehide/);
    assert.doesNotMatch(progress, /hvitveldt:reading/);

    assert.match(sectionCss, /\.tsukinomi-reading-progress span[\s\S]*background:\s*var\(--accent-warm\)/);
    assert.match(sectionCss, /article\.tsukinomi-section \.resume-highlight/);
    assert.match(sectionCss, /prefers-reduced-motion:\s*reduce[\s\S]*resume-highlight/);
  });

  it("adds section chapter anchor links without changing the section markdown source", () => {
    const header = readProjectFile("src/components/tsukinomi/reading/SectionHeader.astro");
    const sectionPage = readProjectFile("src/pages/tsukinomi/sections/[slug].astro");

    assert.match(header, /chapterLinks/);
    assert.match(header, /section-chapter-links/);
    assert.match(header, /ในภาคนี้/);
    assert.match(header, /href=\{`#ch-\$\{chapter\.number\}`\}/);
    assert.match(sectionPage, /<SectionHeader section=\{section\} \/>/);
  });

  it("exposes skip-to-content targets across Tsukinomi pages", () => {
    const baseLayout = readProjectFile("src/layouts/tsukinomi/TsukinomiBaseLayout.astro");
    const globalCss = readProjectFile("src/styles/tsukinomi/global.css");
    const homePage = readProjectFile("src/pages/tsukinomi/index.astro");
    const tocPage = readProjectFile("src/pages/tsukinomi/sections/index.astro");
    const sectionLayout = readProjectFile("src/layouts/tsukinomi/TsukinomiSectionLayout.astro");

    assert.match(baseLayout, /class="skip-to-content"/);
    assert.match(baseLayout, /href="#tsukinomi-main"/);
    assert.match(globalCss, /\.skip-to-content/);
    assert.match(homePage, /id="tsukinomi-main"/);
    assert.match(tocPage, /id="tsukinomi-main"/);
    assert.match(sectionLayout, /id="tsukinomi-main"/);
  });

  it("keeps the extra route on the Tsukinomi home hub instead of the section topbar", () => {
    const homePage = readProjectFile("src/pages/tsukinomi/index.astro");
    const topBar = readProjectFile("src/components/tsukinomi/navigation/TopBar.astro");

    assert.match(homePage, /href=\{withBase\("\/tsukinomi\/extra\/"\)\}>Extra<\/a>/);
    assert.doesNotMatch(topBar, /\/tsukinomi\/extra\//);
    assert.doesNotMatch(topBar, />Extra<\/a>/);
  });

  it("keeps the 404 useful for a missing Tsukinomi section route", () => {
    const notFound = readProjectFile("src/components/_shared/NotFoundScene.astro");

    assert.match(notFound, /\/tsukinomi\//);
    assert.match(notFound, /กลับสถานีทะเลพระจันทร์/);
  });

  it("documents the Tsukinomi asset subtree and pending P6 image slots", () => {
    const readmePath = "public/assets/tsukinomi/README.md";

    assert.equal(existsSync(projectPath(readmePath)), true, `${readmePath} should exist`);

    const readme = readProjectFile(readmePath);

    assert.match(readme, /# Tsukinomi Assets/);
    assert.match(readme, /audio\/music/);
    assert.match(readme, /audio\/soundscape/);
    assert.match(readme, /audio\/sfx/);
    assert.match(readme, /icons/);
    assert.match(readme, /textures/);
    assert.match(readme, /pending-user-image/);
    assert.match(readme, /hero-station/);
    assert.match(readme, /section-05/);
  });
});
