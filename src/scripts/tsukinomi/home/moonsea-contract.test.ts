// Source rules for the /tsukinomi/ home sky (moonsea-loader.ts, moonsea-scene.ts):
// it loads lazily, stays decoration, follows the reader's motion choices and
// cleans up after itself. The rules themselves are in moonsea-core.test.ts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { MOTION_EVENT, MOTION_STORAGE_KEY, motionSwitchOn } from "./moonsea-loader";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const LOADER = "src/scripts/tsukinomi/home/moonsea-loader.ts";
const SCENE = "src/scripts/tsukinomi/home/moonsea-scene.ts";
const CORE = "src/scripts/tsukinomi/home/moonsea-core.ts";
const loader = withoutComments(read(LOADER));
const scene = withoutComments(read(SCENE));

describe("the sky loads lazily", () => {
  it("is only reached through the loader's dynamic import", () => {
    assert.match(loader, /await import\("\.\/moonsea-scene"\)/);
    assert.doesNotMatch(loader, /^import .*moonsea-scene/m, "no static import of the scene");
    for (const path of ["src/scripts/tsukinomi/home/concourse.ts", "src/components/tsukinomi/home/Concourse.astro", "src/pages/tsukinomi/index.astro"]) {
      assert.doesNotMatch(read(path), /moonsea-scene/, path);
    }
  });

  it("asks for the chunk only after the first paint, and gives up quietly if it cannot load", () => {
    assert.match(loader, /requestAnimationFrame\(\(\) => \{\s*second = window\.requestAnimationFrame/);
    assert.match(loader, /catch \{\s*if \(!stopped\) mount\.dataset\.moonsea = "failed";/);
  });
});

describe("the sky stays decoration", () => {
  it("draws on Canvas 2D through scene-runtime, with no WebGL", () => {
    assert.match(scene, /createScene\(\{/);
    assert.doesNotMatch(scene + loader, /webgl|OffscreenCanvas/i);
  });

  it("hides its canvas from assistive technology and takes no pointer of its own", () => {
    assert.match(scene, /canvas\.setAttribute\("aria-hidden", "true"\)/);
    assert.doesNotMatch(scene, /addEventListener\("(click|pointerdown|pointerup)"/, "pointer input comes from scene-runtime's passive window listeners");
  });

  it("leaves a tap on a link or a control to the page", () => {
    assert.match(scene, /closest\?\.\("a, button, input, select, textarea, label, \[role='button'\]"\)/);
  });

  it("says nothing in Thai, requests nothing and writes no storage", () => {
    for (const [path, code] of [
      [LOADER, loader],
      [SCENE, scene],
      [CORE, withoutComments(read(CORE))],
    ] as const) {
      assert.doesNotMatch(code, /[฀-๿]/, `${path} adds Thai copy`);
      assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|sendBeacon|https?:\/\/|new Image\(|new Audio\(/, path);
      assert.doesNotMatch(code, /setItem|removeItem|\.clear\(\)/, path);
    }
  });
});

describe("the sky follows the reader's motion choices", () => {
  it("draws a still under reduced motion or with backdrop motion switched off, and switches live", () => {
    assert.match(loader, /const wantsStill = \(\) => reducedQuery\.matches \|\| !readSwitch\(\)/);
    assert.match(loader, /window\.addEventListener\(MOTION_EVENT, onMotionChange\)/);
    assert.match(loader, /reducedQuery\.addEventListener\("change", onMotionChange\)/);
    assert.match(scene, /reducedMotionFrame\(ctx, frame\)/);
  });

  it("reads the same switch and event as the sakura backdrop and the Walkman panel", () => {
    const backdrop = read("src/components/tsukinomi/atmosphere/SakuraTwilightBackdrop.astro");
    assert.ok(backdrop.includes(`"${MOTION_STORAGE_KEY}"`));
    assert.ok(backdrop.includes(`"${MOTION_EVENT}"`));
    assert.ok(read("src/components/tsukinomi/audio/WalkmanPlayer.astro").includes(`"${MOTION_EVENT}"`));
  });

  it("treats the switch as on unless it was turned off, and unreadable storage as on", () => {
    assert.equal(motionSwitchOn(() => null), true);
    assert.equal(motionSwitchOn(() => "true"), true);
    assert.equal(motionSwitchOn(() => "false"), false);
    assert.equal(
      motionSwitchOn(() => {
        throw new Error("blocked");
      }),
      true,
    );
  });
});

describe("the sky cleans up", () => {
  it("pairs every listener it adds with a removal", () => {
    for (const [path, code] of [
      [LOADER, loader],
      [SCENE, scene],
    ] as const) {
      const added = (code.match(/\.addEventListener\(/g) ?? []).length;
      const removed = (code.match(/\.removeEventListener\(/g) ?? []).length;
      assert.equal(added, removed, path);
    }
  });

  it("destroys the scene loop, removes its canvas and stands the backdrop back up", () => {
    assert.match(scene, /scene\.destroy\(\);/);
    assert.match(scene, /canvas\.remove\(\);/);
    assert.match(loader, /handle\?\.destroy\(\);/);
    assert.match(loader, /document\.body\.classList\.remove\(LIVE_CLASS\)/);
    assert.match(loader, /window\.cancelAnimationFrame\(first\);\s*window\.cancelAnimationFrame\(second\);/);
  });
});
