import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  BACKGROUND_SLOT_IDS,
  HOME_BACKGROUND_SLOT,
  TSUKINOMI_BACKGROUND_SLOTS,
  backgroundSlotIdForSection,
  getTsukinomiBackgroundSlot,
} from "../../data/tsukinomi/background-slots";

const root = process.cwd();

function projectPath(path: string): string {
  return join(root, path);
}

function readProjectFile(path: string): string {
  return readFileSync(projectPath(path), "utf8");
}

describe("Tsukinomi P6a background slot contract", () => {
  it("declares one pending user-image slot for the home hero and each section", () => {
    const expectedIds = ["hero-station", "section-01", "section-02", "section-03", "section-04", "section-05"] as const;

    assert.deepEqual(BACKGROUND_SLOT_IDS, expectedIds);
    assert.equal(TSUKINOMI_BACKGROUND_SLOTS.length, expectedIds.length);
    assert.equal(HOME_BACKGROUND_SLOT.id, "hero-station");

    for (const id of expectedIds) {
      const slot = getTsukinomiBackgroundSlot(id);

      assert.equal(slot.id, id);
      assert.equal(slot.status, "pending-user-image");
      assert.equal(slot.cssImage, "none");
      assert.equal(slot.needsUserAsset, true);
      assert.match(slot.label, /\S/);
      assert.doesNotMatch(JSON.stringify(slot), /unsplash|generated|fake|mock/i);
    }

    assert.equal(getTsukinomiBackgroundSlot("hero-station").expectedImageBase, "/assets/tsukinomi/images/hero-station");
    assert.equal(
      getTsukinomiBackgroundSlot("section-01").expectedImageBase,
      "/assets/tsukinomi/images/backgrounds/section-01",
    );
    assert.equal(
      getTsukinomiBackgroundSlot("section-05").expectedImageBase,
      "/assets/tsukinomi/images/backgrounds/section-05",
    );

    assert.equal(backgroundSlotIdForSection(1), "section-01");
    assert.equal(backgroundSlotIdForSection(5), "section-05");
  });

  it("wires layouts to slot metadata without requesting missing image files", () => {
    const baseLayout = readProjectFile("src/layouts/tsukinomi/TsukinomiBaseLayout.astro");
    const sectionLayout = readProjectFile("src/layouts/tsukinomi/TsukinomiSectionLayout.astro");
    const homePage = readProjectFile("src/pages/tsukinomi/index.astro");

    assert.match(baseLayout, /backgroundSlotId/);
    assert.match(baseLayout, /data-background-slot=\{backgroundSlotId\}/);
    assert.match(baseLayout, /data-background-status=\{backgroundStatus\}/);
    assert.match(baseLayout, /<SakuraTwilightBackdrop/);
    assert.doesNotMatch(baseLayout, /url\(["']?\/assets\/tsukinomi\/images/i);
    assert.doesNotMatch(baseLayout, /section\.data\.backgroundImage/);

    assert.match(sectionLayout, /backgroundSlotIdForSection/);
    assert.match(sectionLayout, /backgroundSlotId=\{backgroundSlotIdForSection\(section\.data\.number\)\}/);
    assert.doesNotMatch(sectionLayout, /backgroundImage=/);

    assert.match(homePage, /backgroundSlotId="hero-station"/);
  });

  it("keeps the Sakura Twilight backdrop image-ready while using a CSS-only fallback now", () => {
    const tokens = readProjectFile("src/styles/tsukinomi/tokens.css");
    const backdrop = readProjectFile("src/components/tsukinomi/atmosphere/SakuraTwilightBackdrop.astro");

    assert.match(tokens, /--bg-image:\s*none;/);
    assert.match(tokens, /--bg-fallback-image:/);
    assert.match(tokens, /body\[data-background-slot="hero-station"\]/);
    assert.match(tokens, /body\[data-background-slot="section-01"\]/);
    assert.match(tokens, /body\[data-background-slot="section-05"\]/);

    assert.match(backdrop, /background-image:\s*var\(--bg-image\),\s*var\(--bg-fallback-image\)/);
    assert.match(backdrop, /--bg-fallback-position/);
    assert.match(backdrop, /--bg-fallback-size/);
    assert.doesNotMatch(backdrop, /\/assets\/tsukinomi\/images/i);
    assert.doesNotMatch(backdrop, /Unsplash|sharp|generated|mock/i);
  });

  it("documents that P6 image assets remain pending and does not create image files yet", () => {
    const manifest = readProjectFile("assets-manifest.md");

    assert.match(manifest, /Tsukinomi P6 image slots/i);
    assert.match(manifest, /pending-user-image/i);
    assert.match(manifest, /\/assets\/tsukinomi\/images\/hero-station/);
    assert.match(manifest, /\/assets\/tsukinomi\/images\/backgrounds\/section-05/);
    assert.doesNotMatch(manifest, /Unsplash.*Tsukinomi|Tsukinomi.*Unsplash/i);

    assert.equal(existsSync(projectPath("public/assets/tsukinomi/images")), false);
  });
});
