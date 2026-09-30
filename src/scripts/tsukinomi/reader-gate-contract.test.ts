import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { NOVELS } from "../../data/_novels";

const root = process.cwd();

const BASE_LAYOUT = "src/layouts/tsukinomi/TsukinomiBaseLayout.astro";
const SECTION_LAYOUT = "src/layouts/tsukinomi/TsukinomiSectionLayout.astro";

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function projectFilesUnder(dir: string, extensions: readonly string[]): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(root, dir))) {
    const path = `${dir}/${entry}`;
    if (statSync(join(root, path)).isDirectory()) {
      found.push(...projectFilesUnder(path, extensions));
    } else if (extensions.some((extension) => entry.endsWith(extension))) {
      found.push(path);
    }
  }
  return found;
}

/** The gate script as emitted by the layout: from its status check to the script's closing tag. */
function gatedRegion(layout: string): { start: number; end: number; text: string } {
  const start = layout.search(/requiresUnlockGate\s*&&\s*\(\s*<script is:inline>/);
  assert.notEqual(start, -1, "the gate script must be wrapped in a requiresUnlockGate check");
  const closing = layout.indexOf("</script>", start);
  assert.notEqual(closing, -1, "the gated script must be closed");
  const end = closing + "</script>".length;
  return { start, end, text: layout.slice(start, end) };
}

function withoutGatedRegion(layout: string): string {
  const { start, end } = gatedRegion(layout);
  return layout.slice(0, start) + layout.slice(end);
}

/** Declaration body of a rule whose selector list is exactly `selector`. */
function ruleBody(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `rule ${selector} should exist`);
  return match[1];
}

function zIndexes(source: string): number[] {
  return [...source.matchAll(/z-index:\s*(-?\d+)/g)].map((match) => Number(match[1]));
}

describe("Tsukinomi reader gate and cutscene layering contract", () => {
  it("derives the unlock gate from the novel status in _novels.ts", () => {
    const layout = readProjectFile(BASE_LAYOUT);
    const novelsSource = readProjectFile("src/data/_novels.ts");

    assert.match(layout, /import \{[^}]*\bNOVELS\b[^}]*\} from "\.\.\/\.\.\/data\/_novels";/);
    assert.match(layout, /\.find\(\(novel\) => novel\.slug === "tsukinomi"\)/);
    assert.match(layout, /const requiresUnlockGate = tsukinomiNovel\?\.status !== "เผยแพร่";/);

    // The literal compared in the layout must be a real NovelStatus, and the novel must exist.
    assert.match(novelsSource, /export type NovelStatus = [^;]*"เผยแพร่"/);
    assert.ok(
      NOVELS.some((novel) => novel.slug === "tsukinomi"),
      "_novels.ts must keep a tsukinomi entry for the layout to read",
    );
  });

  it("emits the redirect only inside the status-gated script", () => {
    const layout = readProjectFile(BASE_LAYOUT);
    const region = gatedRegion(layout);

    // The unlock logic stays available behind the check, so re-locking the novel restores it.
    assert.match(region.text, /window\.location\.replace\(target\)/);
    assert.match(region.text, /if \(!isUnlocked && requiresTsukinomiUnlock\)/);
    assert.match(region.text, /PUBLIC_TSUKINOMI_PATHS/);

    // Nothing outside the gated block may navigate the reader away.
    const ungated = withoutGatedRegion(layout);
    assert.doesNotMatch(ungated, /location\.replace/);
    assert.doesNotMatch(ungated, /location\.assign/);
    assert.doesNotMatch(ungated, /location\.href\s*=/);

    const sectionLayout = readProjectFile(SECTION_LAYOUT);
    assert.doesNotMatch(sectionLayout, /location\.(replace|assign)|location\.href\s*=/);
  });

  it("keeps the time-of-day script outside the gate", () => {
    const ungated = withoutGatedRegion(readProjectFile(BASE_LAYOUT));

    assert.match(ungated, /function setTimeOfDay\(hour\)/);
    assert.match(ungated, /new Date\(\)\.getHours\(\)/);
    assert.match(ungated, /window\.__timeOfDayBound/);
    assert.match(ungated, /astro:after-swap/);
  });

  it("does not request worldtimeapi from either Tsukinomi layout", () => {
    for (const path of [BASE_LAYOUT, SECTION_LAYOUT]) {
      assert.doesNotMatch(readProjectFile(path), /worldtimeapi/i, `${path} must not reference worldtimeapi`);
    }
    // The Lodge layout shares the same time-of-day helper and must stay clean too.
    assert.doesNotMatch(readProjectFile("src/layouts/lodge/LodgeBaseLayout.astro"), /worldtimeapi/i);
  });

  it("paints the cutscene overlay above the backdrop, its petals and every other page layer", () => {
    const sectionLayout = readProjectFile(SECTION_LAYOUT);
    const backdropComponent = readProjectFile("src/components/tsukinomi/atmosphere/SakuraTwilightBackdrop.astro");

    const overlayZ = zIndexes(ruleBody(sectionLayout, ".cutscene-overlay"));
    assert.equal(overlayZ.length, 1, ".cutscene-overlay must declare exactly one z-index");
    const overlay = overlayZ[0];

    // Backdrop layers: its base rule plus any override the section layout applies to them.
    const backdropLayers = [
      ...zIndexes(backdropComponent),
      ...[...sectionLayout.matchAll(/([^{}]*sakura-backdrop[^{}]*)\{([^}]*)\}/g)].flatMap((match) => zIndexes(match[2])),
    ];
    assert.ok(backdropLayers.length > 0, "the backdrop z-index values should be readable from the source");
    for (const z of backdropLayers) {
      assert.ok(overlay > z, `overlay z-index ${overlay} must exceed backdrop layer z-index ${z}`);
    }

    // `.cutscene-content` lives inside the overlay's own stacking context, so it does not compete.
    const sectionOutsideOverlay = sectionLayout
      .replace(/(?:^|\n)\s*\.cutscene-overlay\s*\{[^}]*\}/, "")
      .replace(/(?:^|\n)\s*\.cutscene-content\s*\{[^}]*\}/, "");
    const pageLayers = [
      ...zIndexes(sectionOutsideOverlay),
      ...zIndexes(readProjectFile(BASE_LAYOUT)),
      ...["src/styles/tsukinomi", "src/components/tsukinomi"].flatMap((dir) =>
        projectFilesUnder(dir, [".css", ".astro"]).flatMap((file) => zIndexes(readProjectFile(file))),
      ),
      ...zIndexes(readProjectFile("src/components/_shared/GrainOverlay.astro")),
    ];
    for (const z of pageLayers) {
      assert.ok(overlay > z, `overlay z-index ${overlay} must exceed page layer z-index ${z}`);
    }
  });

  it("does not raise the backdrop above the overlay while a cutscene is active", () => {
    const sectionLayout = readProjectFile(SECTION_LAYOUT);

    assert.doesNotMatch(sectionLayout, /body\.has-cutscene\s+\.sakura-backdrop[^{]*\{[^}]*z-index/);
    assert.doesNotMatch(sectionLayout, /z-index:\s*\d+\s*!important/);
  });
});
