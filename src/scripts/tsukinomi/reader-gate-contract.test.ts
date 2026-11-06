import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

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

/** The flat `selector { body }` rules (no nesting) of the <style> blocks of an Astro component. */
function cssRules(component: string): Array<{ selector: string; body: string }> {
  const styles = [...component.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join("\n");
  return [...styles.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim(),
    body: match[2],
  }));
}

describe("Tsukinomi reader gate and cutscene layering contract", () => {
  it("never sends a reader away from a section page", () => {
    for (const path of [BASE_LAYOUT, SECTION_LAYOUT]) {
      assert.doesNotMatch(readProjectFile(path), /location\.(replace|assign)|location\.href\s*=/, path);
    }
  });

  it("keeps the time-of-day script", () => {
    const layout = readProjectFile(BASE_LAYOUT);

    assert.match(layout, /function setTimeOfDay\(hour\)/);
    assert.match(layout, /new Date\(\)\.getHours\(\)/);
    assert.match(layout, /window\.__timeOfDayBound/);
    assert.match(layout, /astro:after-swap/);
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
