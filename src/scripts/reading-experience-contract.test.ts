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
    assert.match(home, /COMPLETED_PROGRESS = 0\.995/);
    assert.match(home, /units\[index \+ 1\]/);
    assert.match(hubResume, /progress < 0\.005/);
    assert.match(hubResume, /COMPLETED_PROGRESS = 0\.995/);
    assert.match(hubResume, /units\[index \+ 1\]/);
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
    assert.match(home, /COMPLETED_PROGRESS = 0\.995/);
    assert.match(home, /units\[index \+ 1\]/);
    assert.match(hubResume, /progress < 0\.005/);
    assert.match(hubResume, /COMPLETED_PROGRESS = 0\.995/);
    assert.match(hubResume, /units\[index \+ 1\]/);
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

  it("keeps the reading marker alive at completion by handing the reader the next unit", () => {
    const hubResume = readProjectFile("src/components/_shared/ResumeCard.astro");
    const lodgeHome = readProjectFile("src/pages/lodge/index.astro");
    const tsukiHome = readProjectFile("src/pages/tsukinomi/index.astro");

    for (const source of [hubResume, lodgeHome, tsukiHome]) {
      assert.match(source, /COMPLETED_PROGRESS = 0\.995/);
      assert.match(source, /units\[index \+ 1\]/);
      assert.match(source, /อ่านจบ/);
    }
  });

  it("implements secret reading progress tracking and locked extra pages with bypass keys", () => {
    const lodgeProgress = readProjectFile("src/components/lodge/reading/ReadingProgress.astro");
    const tsukiProgress = readProjectFile("src/components/tsukinomi/reading/ReadingProgress.astro");
    const lodgeExtra = readProjectFile("src/pages/lodge/extra/index.astro");
    const tsukiExtra = readProjectFile("src/pages/tsukinomi/extra/index.astro");

    // Secret tracking keys & conditions
    assert.match(lodgeProgress, /hvitveldt:secret:timers/);
    assert.match(lodgeProgress, /hvitveldt:secret:reads/);
    assert.match(lodgeProgress, /SECRET_THRESHOLD_SEC = 420/); // 7 minutes
    assert.match(lodgeProgress, /lastInteraction < 60000/);

    assert.match(tsukiProgress, /tsukinomi:reading:secret:timers/);
    assert.match(tsukiProgress, /tsukinomi:reading:secret:reads/);
    assert.match(tsukiProgress, /SECRET_THRESHOLD_SEC = 1080/); // 18 minutes
    assert.match(tsukiProgress, /lastInteraction < 60000/);

    // Extra page requirements: bypass passwords and 80% threshold checks
    assert.match(lodgeExtra, /lodge-bypass-gate-2026/);
    assert.match(lodgeExtra, /UNLOCK_THRESHOLD = 15/);
    assert.match(lodgeExtra, /hvitveldt:extra-bypassed/);

    assert.match(tsukiExtra, /tsukinomi-bypass-gate-2026/);
    assert.match(tsukiExtra, /UNLOCK_THRESHOLD = 4/);
    assert.match(tsukiExtra, /tsukinomi:extra-bypassed/);
  });

  it("implements TOC read indicators and accurate IP timezone tracking", () => {
    const lodgeFullToc = readProjectFile("src/pages/lodge/chapters/index.astro");
    const lodgeMiniToc = readProjectFile("src/components/lodge/navigation/TableOfContents.astro");
    const tsukiSectionsToc = readProjectFile("src/pages/tsukinomi/sections/index.astro");
    const lodgeLayout = readProjectFile("src/layouts/lodge/LodgeBaseLayout.astro");
    const tsukiLayout = readProjectFile("src/layouts/tsukinomi/TsukinomiBaseLayout.astro");

    // Lodge TOC indicators
    assert.match(lodgeFullToc, /hvitveldt:secret:reads/);
    assert.match(lodgeFullToc, /\.toc-row\.is-read::after/);
    assert.match(lodgeMiniToc, /hvitveldt:secret:reads/);
    assert.match(lodgeMiniToc, /\.toc-panel-row\.is-read strong::after/);

    // Tsukinomi TOC indicators (Train stamp collection)
    assert.match(tsukiSectionsToc, /tsukinomi:reading:secret:reads/);
    assert.match(tsukiSectionsToc, /\.tsukinomi-toc-row\.is-read \.toc-number::after/);
    assert.match(tsukiSectionsToc, /🚂/);

    // IP timezone hour extraction (no local timezone getHours() conversion)
    assert.match(lodgeLayout, /data\.datetime\.substring/);
    assert.match(lodgeLayout, /data\.datetime\.indexOf\('T'\)/);
    assert.match(tsukiLayout, /data\.datetime\.substring/);
    assert.match(tsukiLayout, /data\.datetime\.indexOf\('T'\)/);
  });

  it("implements Introductions and Cutscene Epigraphs for both novels", () => {
    const lodgeIntro = readProjectFile("src/content/lodge/chapters/00-introduction.md");
    const tsukiIntro = readProjectFile("src/content/tsukinomi/sections/00-introduction.md");
    const lodgeChapterLayout = readProjectFile("src/layouts/lodge/LodgeChapterLayout.astro");
    const tsukiSectionLayout = readProjectFile("src/layouts/tsukinomi/TsukinomiSectionLayout.astro");
    const lodgeExtra = readProjectFile("src/pages/lodge/extra/index.astro");
    const tsukiExtra = readProjectFile("src/pages/tsukinomi/extra/index.astro");
    const lodgeNav = readProjectFile("src/components/lodge/reading/ChapterNav.astro");
    const tsukiNav = readProjectFile("src/components/tsukinomi/reading/SectionNav.astro");
    const lodgeHeader = readProjectFile("src/components/lodge/reading/ChapterHeader.astro");
    const tsukiHeader = readProjectFile("src/components/tsukinomi/reading/SectionHeader.astro");
    const config = readProjectFile("src/content.config.ts");

    // Introductions exist with number 0 and have narrator-voice previews without spoilers
    assert.match(lodgeIntro, /number:\s*0/);
    assert.match(lodgeIntro, /ปฐมบท/);
    assert.match(lodgeIntro, /ฮวิตเวลต์ ลอดจ์/);
    assert.match(tsukiIntro, /number:\s*0/);
    assert.match(tsukiIntro, /บทนำ/);
    assert.match(tsukiIntro, /สถานีสึคิโนมิ/);

    // Schema supports number 0
    assert.match(config, /number: z\.number\(\)\.int\(\)\.min\(0\)/);

    // Cutscene Epigraphs defined in layouts and check for has-cutscene / cutscene-overlay
    assert.match(lodgeChapterLayout, /hasCutscene/);
    assert.match(lodgeChapterLayout, /cutscene-overlay/);
    assert.match(lodgeChapterLayout, /typewriter/);
    assert.match(lodgeChapterLayout, /has-cutscene/);

    assert.match(tsukiSectionLayout, /hasCutscene/);
    assert.match(tsukiSectionLayout, /cutscene-overlay/);
    assert.match(tsukiSectionLayout, /fade-char/);
    assert.match(tsukiSectionLayout, /has-cutscene/);

    // Extra pages exclude introduction (00-introduction)
    assert.match(lodgeExtra, /id !== "00-introduction"/);
    assert.match(tsukiExtra, /id !== "00-introduction"/);

    // Navigation and headers handle introduction
    assert.match(lodgeNav, /previous\.data\.number === 0/);
    assert.match(tsukiNav, /previous\.data\.number === 0/);
    assert.match(lodgeHeader, /isIntro \? "เกริ่นนำ"/);
    assert.match(tsukiHeader, /isIntro \? "Introduction"/);
  });
});
