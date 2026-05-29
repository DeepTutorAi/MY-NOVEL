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
  it("defines the Sakura Twilight design tokens without assuming a user image", () => {
    assert.equal(existsSync(projectPath("src/styles/tsukinomi/tokens.css")), true);

    const tokens = readProjectFile("src/styles/tsukinomi/tokens.css");

    assert.match(tokens, /--bg-image:\s*none;/);
    assert.match(tokens, /PENDING_USER_IMAGE/);
    assert.match(tokens, /--bg-night:\s*#0E0B1E;/);
    assert.match(tokens, /--bg-twilight:\s*#171430;/);
    assert.match(tokens, /--surface:\s*#221D3C;/);
    assert.match(tokens, /--mist:\s*#CDD3E0;/);
    assert.match(tokens, /--sakura:\s*#E6A6BD;/);
    assert.match(tokens, /--sunset:\s*#E08A4C;/);
    assert.match(tokens, /--sunset-deep:\s*#B5562F;/);
    assert.match(tokens, /--higan:\s*#B3242B;/);
    assert.match(tokens, /--moon:\s*#E8EDF5;/);
    assert.match(tokens, /--ink:\s*#ECE6DA;/);
    assert.match(tokens, /--ink-muted:\s*#9A93AB;/);
    assert.doesNotMatch(tokens, /#C24B3A/i);
  });

  it("ships a Sakura Twilight backdrop skeleton with L0-L5, petal freeze, and motion safety", () => {
    const backdropPath = "src/components/tsukinomi/atmosphere/SakuraTwilightBackdrop.astro";
    assert.equal(existsSync(projectPath(backdropPath)), true, `${backdropPath} should exist`);

    const backdrop = readProjectFile(backdropPath);

    assert.match(backdrop, /sakura-backdrop__base/);
    assert.match(backdrop, /background-image:\s*var\(--bg-image\)/);
    assert.match(backdrop, /background-size:\s*cover/);
    assert.match(backdrop, /background-position:\s*center/);
    assert.match(backdrop, /sakura-backdrop__tint/);
    assert.match(backdrop, /sakura-backdrop__moon/);
    assert.match(backdrop, /sakura-backdrop__mist--near/);
    assert.match(backdrop, /sakura-backdrop__mist--middle/);
    assert.match(backdrop, /sakura-backdrop__mist--far/);
    assert.match(backdrop, /sakura-backdrop__petals/);
    assert.match(backdrop, /sakura-backdrop__frame/);
    assert.match(backdrop, /sakura-backdrop__clock/);
    assert.match(backdrop, />7:14</);
    assert.match(backdrop, /opacity:\s*0\.05/);
    assert.match(backdrop, /requestAnimationFrame/);
    assert.match(backdrop, /document\.hidden/);
    assert.match(backdrop, /prefers-reduced-motion:\s*reduce/);
    assert.match(backdrop, /freezeUntil/);
    assert.match(backdrop, /scheduleFreeze/);
    assert.match(backdrop, /8_000/);
    assert.match(backdrop, /15_000/);
    assert.match(backdrop, /1_500/);
    assert.match(backdrop, /desktopPetalCount\s*=\s*36/);
    assert.match(backdrop, /mobilePetalCount\s*=\s*22/);
    assert.doesNotMatch(backdrop, /SnowCanvas|snow-canvas|Maple|maple|Fuji|mountain|ridge|#C24B3A/i);
  });

  it("weaves per-section profiles, particle kinds, and the distant-train motif", () => {
    const backdrop = readProjectFile("src/components/tsukinomi/atmosphere/SakuraTwilightBackdrop.astro");

    // Story-woven: profile resolved per section palette.
    assert.match(backdrop, /palette-/);
    assert.match(backdrop, /"autumn"/);
    assert.match(backdrop, /"twilight"/);
    assert.match(backdrop, /"warm-room"/);
    assert.match(backdrop, /"snow-pact"/);
    assert.match(backdrop, /"winter-light"/);

    // Petal -> snow morph: four particle kinds.
    assert.match(backdrop, /"petal"/);
    assert.match(backdrop, /"rain"/);
    assert.match(backdrop, /"ash"/);
    assert.match(backdrop, /"snow"/);

    // Distant-train-that-never-comes motif.
    assert.match(backdrop, /sakura-backdrop__train/);
    assert.match(backdrop, /data-train/);

    // Depth: light breath layer + scroll parallax.
    assert.match(backdrop, /sakura-backdrop__rays/);
    assert.match(backdrop, /scroll/);

    // Motion safety still covers the new layers.
    assert.match(backdrop, /prefers-reduced-motion:\s*reduce/);
  });

  it("wires TsukinomiBaseLayout to the Sakura Twilight stack only", () => {
    const layout = readProjectFile("src/layouts/tsukinomi/TsukinomiBaseLayout.astro");
    const globalCss = readProjectFile("src/styles/tsukinomi/global.css");

    assert.match(globalCss, /@import "\.\/tokens\.css";/);
    assert.match(layout, /SakuraTwilightBackdrop/);
    assert.match(layout, /WalkmanCorner/);
    assert.match(layout, /GrainOverlay/);
    assert.match(layout, /texture="\/assets\/tsukinomi\/textures\/film-grain\.png"/);
    assert.match(layout, /data-section=\{sectionPalette\}/);
    assert.match(layout, /data-theme="sakura-twilight"/);
    assert.doesNotMatch(layout, /MistVeil|MapleDriftCanvas|StationBackdrop|SnowCanvas|BackgroundFog|ReaderAmbience/);
    assert.doesNotMatch(layout, /section\.data\.backgroundImage|backgroundImage=/);
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
