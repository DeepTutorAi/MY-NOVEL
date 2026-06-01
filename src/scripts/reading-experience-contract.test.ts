import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("shared reading experience contract", () => {
  it("tracks a newly opened Lodge chapter immediately and only treats true-bottom progress as complete", () => {
    const progress = readProjectFile("src/components/lodge/reading/ReadingProgress.astro");
    const home = readProjectFile("src/pages/lodge/index.astro");
    const hubResume = readProjectFile("src/components/_shared/ResumeCard.astro");

    assert.match(progress, /const MIN_TRACKED_PROGRESS = 0\.005/);
    assert.match(progress, /const COMPLETED_PROGRESS = 0\.995/);
    assert.match(progress, /const enteringNewChapter =/);
    assert.match(progress, /normalizedProgress/);
    assert.match(progress, /__hvitveldtReadingProgress/);
    assert.match(progress, /astro:page-load/);
    assert.match(progress, /removeEventListener\("scroll", requestUpdate\)/);
    assert.match(home, /progress >= 0\.005/);
    assert.match(home, /progress < 0\.995/);
    assert.match(hubResume, /progress < 0\.005/);
    assert.match(hubResume, /progress >= 0\.995/);
  });

  it("tracks a newly opened Tsukinomi section immediately and only treats true-bottom progress as complete", () => {
    const progress = readProjectFile("src/components/tsukinomi/reading/ReadingProgress.astro");
    const home = readProjectFile("src/pages/tsukinomi/index.astro");
    const hubResume = readProjectFile("src/components/_shared/ResumeCard.astro");

    assert.match(progress, /const MIN_TRACKED_PROGRESS = 0\.005/);
    assert.match(progress, /const COMPLETED_PROGRESS = 0\.995/);
    assert.match(progress, /const enteringNewSection =/);
    assert.match(progress, /normalizedProgress/);
    assert.match(progress, /__tsukinomiReadingProgress/);
    assert.match(progress, /astro:page-load/);
    assert.match(progress, /removeEventListener\("scroll", requestUpdate\)/);
    assert.match(home, /progress >= 0\.005/);
    assert.match(home, /progress < 0\.995/);
    assert.match(hubResume, /progress < 0\.005/);
    assert.match(hubResume, /progress >= 0\.995/);
  });

  it("exposes background animation controls in both music players and persists them by novel namespace", () => {
    const lodgePlayer = readProjectFile("src/components/lodge/audio/AmbientPlayer.astro");
    const lodgeSnow = readProjectFile("src/components/lodge/atmosphere/SnowCanvas.astro");
    const tsukiPlayer = readProjectFile("src/components/tsukinomi/audio/WalkmanPlayer.astro");
    const tsukiBackdrop = readProjectFile("src/components/tsukinomi/atmosphere/SakuraTwilightBackdrop.astro");

    assert.match(lodgePlayer, /data-snow-toggle/);
    assert.match(lodgePlayer, /hvitveldt:motion:snow/);
    assert.match(lodgeSnow, /hvitveldt:motion:snow/);
    assert.match(lodgeSnow, /hvitveldt:motion-change/);

    assert.match(tsukiPlayer, /data-backdrop-toggle/);
    assert.match(tsukiPlayer, /tsukinomi:motion:backdrop/);
    assert.match(tsukiBackdrop, /tsukinomi:motion:backdrop/);
    assert.match(tsukiBackdrop, /tsukinomi:motion-change/);
  });

  it("keeps the Tsukinomi reader panel visually opaque like the Lodge reader panel", () => {
    const sectionCss = readProjectFile("src/styles/tsukinomi/section.css");

    assert.match(sectionCss, /article\.tsukinomi-section[\s\S]*var\(--surface\) 92%/);
    assert.match(sectionCss, /article\.tsukinomi-section[\s\S]*var\(--bg-night\) 8%/);
    assert.doesNotMatch(sectionCss, /article\.tsukinomi-section[\s\S]*var\(--surface\) 78%/);
  });

  it("keeps root hub resume global while series home resume cards stay story-scoped", () => {
    const hubResume = readProjectFile("src/components/_shared/ResumeCard.astro");
    const lodgeHome = readProjectFile("src/pages/lodge/index.astro");
    const tsukiHome = readProjectFile("src/pages/tsukinomi/index.astro");

    assert.match(hubResume, /hvitveldt:reading:last/);
    assert.match(hubResume, /tsukinomi:reading:last/);
    assert.match(hubResume, /candidates\.sort\(\(a, b\) => b\.updatedAt - a\.updatedAt\)\[0\]/);
    assert.match(lodgeHome, /const resumeStorageKey = "hvitveldt:reading:last"/);
    assert.doesNotMatch(lodgeHome, /tsukinomi:reading:last/);
    assert.match(tsukiHome, /const KEY = "tsukinomi:reading:last"/);
    assert.doesNotMatch(tsukiHome, /hvitveldt:reading:last/);
  });

  it("gives reader pages explicit routes back to the story home and the shared novel hub", () => {
    const lodgeTopbar = readProjectFile("src/components/lodge/navigation/TopBar.astro");
    const lodgeNav = readProjectFile("src/components/lodge/reading/ChapterNav.astro");
    const tsukiTopbar = readProjectFile("src/components/tsukinomi/navigation/TopBar.astro");
    const tsukiNav = readProjectFile("src/components/tsukinomi/reading/SectionNav.astro");

    assert.match(lodgeTopbar, /href=\{withBase\("\/"\)\}[^>]*>ฮับนิยาย/);
    assert.match(lodgeNav, /href=\{withBase\("\/lodge\/"\)\}>หน้าหลักเรื่อง/);
    assert.match(lodgeNav, /href=\{withBase\("\/"\)\}>ฮับนิยาย/);
    assert.match(tsukiTopbar, /href=\{withBase\("\/"\)\}[^>]*>ฮับนิยาย/);
    assert.match(tsukiNav, /href=\{withBase\("\/tsukinomi\/"\)\}>หน้าหลักเรื่อง/);
    assert.match(tsukiNav, /href=\{withBase\("\/"\)\}>ฮับนิยาย/);
  });

  it("prevents the Tsukinomi drop cap from overlapping Thai prose on narrow reader viewports", () => {
    const sectionDropcap = readProjectFile("src/components/tsukinomi/reading/SectionDropcap.astro");

    assert.match(sectionDropcap, /@media \(min-width: 761px\)/);
    assert.match(sectionDropcap, /font-size: 3\.4em/);
    assert.doesNotMatch(sectionDropcap, /font-size: 4\.4em/);
  });
});
