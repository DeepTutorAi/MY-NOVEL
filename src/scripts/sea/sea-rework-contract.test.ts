// Cross-cutting contract for the Sea rework (plan phase P5). Checks that span
// the whole Sea tree live here; narrower ones stay with their feature:
// hero lines quoted verbatim from chapters 00/01 are covered by
// sea-home-contract.test.ts, cutscene play rules by cutscene.test.ts.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

import { PLAYED_PREFIX } from "./cutscene/runner";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

function filesUnder(dir: string, pattern: RegExp): string[] {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { recursive: true, encoding: "utf8" })
    .map((entry) => join(absolute, entry))
    .filter((path) => pattern.test(path) && statSync(path).isFile())
    .map((path) => relative(root, path).replaceAll("\\", "/"));
}

/** Source without //, /* *\/ and <!-- --> comments, so prose about a tag is not counted as the tag. */
function withoutComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const count = (source: string, pattern: RegExp) => source.match(new RegExp(pattern.source, "g"))?.length ?? 0;

const SEA_SOURCES = [
  ...filesUnder("src/layouts/sea", /\.astro$/),
  ...filesUnder("src/components/sea", /\.astro$/),
  ...filesUnder("src/pages/sea", /\.astro$/),
  ...filesUnder("src/scripts/sea", /\.ts$/).filter((path) => !path.endsWith(".test.ts")),
  ...filesUnder("src/styles/sea", /\.css$/),
];

const BASE_LAYOUTS = [
  "src/layouts/HubLayout.astro",
  "src/layouts/lodge/LodgeBaseLayout.astro",
  "src/layouts/tsukinomi/TsukinomiBaseLayout.astro",
  "src/layouts/kusabi/KusabiBaseLayout.astro",
  "src/layouts/sea/SeaBaseLayout.astro",
];

describe("Sea rework contract", () => {
  it("scans a real Sea tree", () => {
    // Guards every walk below from passing on an empty file list.
    for (const path of [
      "src/layouts/sea/SeaBaseLayout.astro",
      "src/layouts/sea/SeaChapterLayout.astro",
      "src/pages/sea/index.astro",
      "src/scripts/sea/cutscene/runner.ts",
      "src/scripts/sea/atmosphere/engine.ts",
      "src/styles/sea/global.css",
      "src/components/sea/cutscene/ArcCutscene.astro",
    ]) {
      assert.ok(SEA_SOURCES.includes(path), `${path} should be scanned`);
    }
  });

  it("renders the shared profile storage interceptor from all five base layouts", () => {
    for (const path of BASE_LAYOUTS) {
      const source = read(path);
      assert.match(source, /import ProfileStorageInterceptor from "[./]+\/components\/_shared\/ProfileStorageInterceptor\.astro";/, path);
      assert.match(source, /<ProfileStorageInterceptor \/>/, path);
    }
    for (const path of filesUnder("src/layouts", /\.astro$/)) {
      assert.doesNotMatch(read(path), /const prefixes = \[/, `${path} must use the shared interceptor`);
    }
    const interceptor = read("src/components/_shared/ProfileStorageInterceptor.astro");
    assert.match(interceptor, /const prefixes = \[/);
    assert.equal(PLAYED_PREFIX, "sea:cutscene:played:");
    assert.ok(interceptor.includes(`"${PLAYED_PREFIX}"`), "the interceptor must scope the cutscene played keys");
  });

  it("never listens for Astro lifecycle events on window", () => {
    for (const path of SEA_SOURCES) {
      assert.doesNotMatch(read(path), /window\.addEventListener\(\s*["'`]astro:/, path);
    }
    assert.match(read("src/scripts/_shared/lifecycle.ts"), /document\.addEventListener\(\s*"astro:/);
  });

  it("never breaks Thai words anywhere", () => {
    for (const path of SEA_SOURCES.filter((path) => /\.(css|astro)$/.test(path))) {
      assert.doesNotMatch(read(path), /word-break:\s*break-all/, path);
    }
  });

  it("runs the arc cutscene as an accessible, guarded modal", () => {
    const runner = read("src/scripts/sea/cutscene/runner.ts");
    assert.match(runner, /dialog\.showModal\(\)/);
    assert.match(runner, /addEventListener\("cancel", onCancel\)/);
    assert.match(runner, /removeEventListener\("cancel", onCancel\)/);
    assert.match(runner, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches \|\| root\.dataset\.seaMotion === "off"/);
    // Resume guard: ?resume=1 is parsed and blocks automatic play.
    assert.match(runner, /resume: params\.get\("resume"\) === "1"/);
    assert.match(runner, /return !trigger\.resume && !trigger\.traversal && !trigger\.played;/);
    // Sound effects exist only when the reader turned Sea audio on.
    assert.match(runner, /if \(seaAudio\.isEnabled\(\)\) \{\s*const \{ createSfx \} = await import\("\.\/sfx"\);/);
    assert.equal(count(runner, /createSfx\(/), 1, "createSfx must only be called behind isEnabled()");
    assert.match(runner, /getElementById\("sea-chapter-title"\)[\s\S]{0,40}\.focus\(/);
  });

  it("suspends Sea audio for page reasons and pauses a faded cue unless it restarted", () => {
    const audio = read("src/scripts/sea/sea-audio-state.ts");
    assert.match(audio, /visibilityState === "hidden"\) \{\s*this\.suspend\(\);/);
    assert.match(audio, /!isSeaPath\(to\.pathname\)\) \{\s*this\.suspend\(\);/);
    const fadeOutCue = /private fadeOutCue\([\s\S]*?\n {2}\}/.exec(audio)?.[0] ?? "";
    assert.ok(fadeOutCue, "fadeOutCue should exist");
    assert.match(fadeOutCue, /if \(!this\.playing \|\| this\.currentCue !== cueId\) \{\s*state\.howl\.pause\(soundId\);/);
  });

  it("renders exactly one <main>, owned by SeaBaseLayout", () => {
    assert.equal(count(withoutComments(read("src/layouts/sea/SeaBaseLayout.astro")), /<main\b/), 1);
    for (const path of SEA_SOURCES.filter((path) => path.endsWith(".astro") && !path.endsWith("SeaBaseLayout.astro"))) {
      assert.equal(count(withoutComments(read(path)), /<main\b/), 0, `${path} must not render <main>`);
    }
  });

  it("keeps the retired hero-sea.webp cover off every Sea page", () => {
    for (const path of SEA_SOURCES) {
      assert.doesNotMatch(read(path), /hero-sea\.(webp|png)/, path);
    }
  });

  it("sizes the backdrop by device pixel ratio, stops it when hidden and reads styles once", () => {
    const engine = read("src/scripts/sea/atmosphere/engine.ts");
    const backdrop = read("src/components/sea/atmosphere/SeaRainBackdrop.astro");
    assert.match(engine, /capDpr\(window\.devicePixelRatio,/);
    assert.match(engine, /document\.addEventListener\("visibilitychange", sync\)/);
    assert.match(engine, /document\.removeEventListener\("visibilitychange", sync\)/);
    const reads = count(withoutComments(engine), /getComputedStyle\(/) + count(withoutComments(backdrop), /getComputedStyle\(/);
    assert.ok(reads <= 1, `getComputedStyle is called ${reads} times; palette tokens must be read once`);
  });
});
