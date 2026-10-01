import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { NOVELS } from "../../data/_novels";

const root = process.cwd();

const BASE_LAYOUT = "src/layouts/tsukinomi/TsukinomiBaseLayout.astro";
const SECTION_LAYOUT = "src/layouts/tsukinomi/TsukinomiSectionLayout.astro";
const CUTSCENE_COMPONENT = "src/components/tsukinomi/cutscene/TsukinomiCutscene.astro";

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

/** The flat `selector { body }` rules (no nesting) of the <style> blocks of an Astro component. */
function cssRules(component: string): Array<{ selector: string; body: string }> {
  const styles = [...component.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join("\n");
  return [...styles.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim(),
    body: match[2],
  }));
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

  it("has no .cutscene-overlay left, and the cutscene dialog has no z-index", () => {
    // The old hand-rolled overlay (and its z-index fight with the backdrop, bug B2)
    // is gone: the cutscene is a native <dialog> in the top layer, which no page
    // layer can cover, so it needs no z-index at all.
    const sectionLayout = readProjectFile(SECTION_LAYOUT);
    const component = readProjectFile(CUTSCENE_COMPONENT);

    for (const dir of ["src/layouts/tsukinomi", "src/components/tsukinomi", "src/styles/tsukinomi"]) {
      for (const file of projectFilesUnder(dir, [".astro", ".css"])) {
        assert.doesNotMatch(readProjectFile(file), /cutscene-overlay|has-cutscene/, `${file} must not carry the old overlay`);
      }
    }
    assert.doesNotMatch(sectionLayout, /z-index:\s*\d+\s*!important/);
    assert.match(component, /<dialog\s+class="tsuki-cutscene"/);

    // `.tsuki-cutscene` and everything inside it: the dialog's own stacking is DOM order.
    const dialogRules = cssRules(component).filter((rule) => /\.tsuki-cutscene(?!-)/.test(rule.selector));
    assert.ok(dialogRules.length > 0, "the dialog should have base styles");
    for (const rule of dialogRules) {
      assert.doesNotMatch(rule.body, /z-index/, `${rule.selector} must not set z-index`);
    }
  });
});
