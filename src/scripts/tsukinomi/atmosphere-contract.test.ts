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

describe("Tsukinomi P4 atmosphere contract", () => {
  it("ships dedicated Tsukinomi atmosphere components instead of reusing Lodge snow", () => {
    const requiredFiles = [
      "src/components/tsukinomi/atmosphere/MistVeil.astro",
      "src/components/tsukinomi/atmosphere/MapleDriftCanvas.astro",
      "src/components/tsukinomi/atmosphere/StationBackdrop.astro",
      "src/components/tsukinomi/audio/WalkmanCorner.astro",
      "src/components/tsukinomi/reading/SectionDropcap.astro",
    ];

    for (const file of requiredFiles) {
      assert.equal(existsSync(projectPath(file)), true, `${file} should exist`);
    }

    const maple = readProjectFile("src/components/tsukinomi/atmosphere/MapleDriftCanvas.astro");
    assert.match(maple, /document\.body\.dataset\.section/);
    assert.match(maple, /warm-room/);
    assert.match(maple, /snow-pact/);
    assert.match(maple, /article\.tsukinomi-section/);
    assert.match(maple, /prefers-reduced-motion: reduce/);
    assert.match(maple, /astro:after-swap/);
    assert.doesNotMatch(maple, /SnowCanvas|snow-canvas|#C24B3A/i);

    const mist = readProjectFile("src/components/tsukinomi/atmosphere/MistVeil.astro");
    assert.match(mist, /mist-veil/);
    assert.match(mist, /@keyframes/);
    assert.match(mist, /prefers-reduced-motion: reduce/);
    assert.doesNotMatch(mist, /#C24B3A/i);
  });

  it("wires TsukinomiBaseLayout to its own atmosphere stack", () => {
    const layout = readProjectFile("src/layouts/tsukinomi/TsukinomiBaseLayout.astro");

    assert.match(layout, /MistVeil/);
    assert.match(layout, /MapleDriftCanvas/);
    assert.match(layout, /StationBackdrop/);
    assert.match(layout, /WalkmanCorner/);
    assert.match(layout, /GrainOverlay/);
    assert.match(layout, /texture="\/assets\/tsukinomi\/textures\/film-grain\.png"/);
    assert.match(layout, /data-section=\{sectionPalette\}/);
    assert.doesNotMatch(layout, /SnowCanvas|BackgroundFog|ReaderAmbience/);
  });

  it("ships the generated grain texture and hand-authored cassette icons", () => {
    const requiredAssets = [
      "public/assets/tsukinomi/textures/film-grain.png",
      "public/assets/tsukinomi/icons/walkman.svg",
      "public/assets/tsukinomi/icons/tape-divider.svg",
      "public/assets/tsukinomi/icons/cassette-mark.svg",
    ];

    for (const file of requiredAssets) {
      assert.equal(existsSync(projectPath(file)), true, `${file} should exist`);
    }

    const grainHeader = readFileSync(projectPath("public/assets/tsukinomi/textures/film-grain.png")).subarray(0, 8);
    assert.deepEqual([...grainHeader], [137, 80, 78, 71, 13, 10, 26, 10]);

    const walkman = readProjectFile("public/assets/tsukinomi/icons/walkman.svg");
    assert.match(walkman, /<g class="reel-left"/);
    assert.match(walkman, /<g class="reel-right"/);
    assert.doesNotMatch(walkman, /#C24B3A/i);
  });
});
