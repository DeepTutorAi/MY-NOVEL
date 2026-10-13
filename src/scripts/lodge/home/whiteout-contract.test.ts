// Source rules for the /lodge/ home backdrop (whiteout-loader.ts, whiteout-scene.ts):
// it loads lazily, stays decoration, follows the reader's motion choices and
// cleans up after itself. The rules themselves are in whiteout-core.test.ts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { LIVE_CLASS, MOTION_EVENT, MOTION_STORAGE_KEY, motionSwitchOn } from "./whiteout-loader";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const LOADER = "src/scripts/lodge/home/whiteout-loader.ts";
const SCENE = "src/scripts/lodge/home/whiteout-scene.ts";
const PAGE = "src/pages/lodge/index.astro";
const loader = withoutComments(read(LOADER));
const scene = withoutComments(read(SCENE));
const page = read(PAGE);

describe("the whiteout loads lazily", () => {
  it("is only reached through the loader's dynamic import, after the first paint", () => {
    assert.match(loader, /await import\("\.\/whiteout-scene"\)/);
    assert.doesNotMatch(loader, /^import .*whiteout-scene/m);
    assert.doesNotMatch(page, /whiteout-scene/);
    assert.match(loader, /requestAnimationFrame\(\(\) => \{\s*second = window\.requestAnimationFrame/);
  });

  it("keeps the static hero picture as the fallback underneath", () => {
    assert.match(page, /<picture class="home-hero-art"/);
    assert.match(page, /data-whiteout-mount/);
  });
});

describe("the whiteout stays decoration", () => {
  it("is hidden from assistive technology and adds no listeners of its own for clicks", () => {
    assert.match(page, /class="lodge-whiteout" aria-hidden="true" data-whiteout-mount/);
    assert.match(scene, /canvas\.setAttribute\("aria-hidden", "true"\)/);
    assert.doesNotMatch(scene, /addEventListener\("(click|pointerdown|pointerup)"/);
    assert.doesNotMatch(scene + loader, /innerHTML|webgl/i);
  });

  it("writes no storage and requests nothing but its plate", () => {
    assert.doesNotMatch(scene + loader, /setItem|removeItem|\bfetch\(|XMLHttpRequest|sendBeacon/);
  });

  it("makes the site-wide snow canvas step aside while it is live", () => {
    assert.match(read("src/components/lodge/atmosphere/SnowCanvas.astro"), new RegExp(LIVE_CLASS));
  });
});

describe("the whiteout follows the reader's motion choices and the page lifecycle", () => {
  it("uses the existing Lodge snow switch and event", () => {
    assert.equal(MOTION_STORAGE_KEY, "hvitveldt:motion:snow");
    assert.equal(MOTION_EVENT, "hvitveldt:motion-change");
    assert.equal(motionSwitchOn(() => "false"), false);
    assert.equal(motionSwitchOn(() => null), true);
    assert.equal(
      motionSwitchOn(() => {
        throw new Error("blocked");
      }),
      true,
    );
    assert.match(loader, /const wantsStill = \(\) => reducedQuery\.matches \|\| !readSwitch\(\)/);
    assert.match(loader, /window\.addEventListener\(MOTION_EVENT, onMotionChange\)/);
  });

  it("is torn down by the page lifecycle before a soft navigation", () => {
    assert.match(page, /onPage\("lodge-whiteout"/);
    assert.match(loader, /document\.body\.classList\.remove\(LIVE_CLASS\)/);
  });

  it("reports its drift level for tests", () => {
    assert.match(loader, /mount\.dataset\.drift = String\(level\)/);
  });
});
