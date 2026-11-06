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

describe("Tsukinomi P6 background slot contract (images live)", () => {
  it("declares a ready image slot for the home hero and each section", () => {
    const expectedIds = ["hero-station", "section-01", "section-02", "section-03", "section-04", "section-05"] as const;

    assert.deepEqual(BACKGROUND_SLOT_IDS, expectedIds);
    assert.equal(TSUKINOMI_BACKGROUND_SLOTS.length, expectedIds.length);
    assert.equal(HOME_BACKGROUND_SLOT.id, "hero-station");

    for (const id of expectedIds) {
      const slot = getTsukinomiBackgroundSlot(id);

      assert.equal(slot.id, id);
      assert.equal(slot.status, "ready");
      assert.equal(slot.needsUserAsset, false);
      assert.match(slot.label, /\S/);
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

  it("ships processed avif/webp/jpg files for every slot", () => {
    assert.equal(existsSync(projectPath("public/assets/tsukinomi/images")), true);

    for (const slot of TSUKINOMI_BACKGROUND_SLOTS) {
      for (const ext of ["avif", "webp", "jpg"] as const) {
        const file = `public${slot.expectedImageBase}.${ext}`;
        assert.equal(existsSync(projectPath(file)), true, `${file} should exist`);
      }
    }
  });

  it("wires the layout to render the slot image base-correctly with a CSS fallback", () => {
    const baseLayout = readProjectFile("src/layouts/tsukinomi/TsukinomiBaseLayout.astro");
    const sectionLayout = readProjectFile("src/layouts/tsukinomi/TsukinomiSectionLayout.astro");
    const homePage = readProjectFile("src/pages/tsukinomi/index.astro");
    const tokens = readProjectFile("src/styles/tsukinomi/tokens.css");
    const backdrop = readProjectFile("src/components/tsukinomi/atmosphere/SakuraTwilightBackdrop.astro");

    assert.match(baseLayout, /backgroundSlotId/);
    assert.match(baseLayout, /data-background-status=\{backgroundStatus\}/);
    assert.match(baseLayout, /<SakuraTwilightBackdrop/);
    assert.match(baseLayout, /status === "ready"/);
    assert.match(baseLayout, /image-set\(/);
    assert.match(baseLayout, /withBase\(`\$\{imageBase\}\.avif`\)/);
    assert.match(baseLayout, /expectedImageBase/);

    assert.match(sectionLayout, /backgroundSlotIdForSection/);
    assert.match(sectionLayout, /backgroundSlotId=\{.*backgroundSlotIdForSection\(section\.data\.number\)\}/);
    assert.match(homePage, /backgroundSlotId="hero-station"/);

    // The procedural gradient stays as the graceful fallback under the photo.
    assert.match(tokens, /--bg-fallback-image:/);
    assert.match(backdrop, /background-image:\s*var\(--bg-image\),\s*var\(--bg-fallback-image\)/);
  });

  it("documents the generated background images in the manifest", () => {
    const manifest = readProjectFile("assets-manifest.md");

    assert.match(manifest, /Tsukinomi.*image/i);
    assert.match(manifest, /\/assets\/tsukinomi\/images\/hero-station/);
    assert.match(manifest, /\/assets\/tsukinomi\/images\/backgrounds\/section-05/);
    assert.match(manifest, /avif/i);
    assert.doesNotMatch(manifest, /Unsplash.*Tsukinomi|Tsukinomi.*Unsplash/i);
  });
});
