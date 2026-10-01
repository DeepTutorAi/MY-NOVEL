import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { isMusicCueId, isSoundscapeId } from "../../../data/tsukinomi/music-cues";
import { TSUKINOMI_BACKGROUND_SLOTS } from "../../../data/tsukinomi/background-slots";
import {
  allRegistryEntries,
  assetPathsFor,
  isScenePart,
  NEUTRAL_ENTRY,
  registryEntry,
  resolveAssets,
  SCENE_PARTS,
} from "./registry";

const root = process.cwd();

// Design sections 4.3 and 5, as stated for this round.
const EXPECTED = [
  { part: 0, id: "prologue", plate: null, icons: ["walkman", "cassette-mark"], sfx: ["tape-click"], cue: "discovery", soundscapes: ["cassette-hiss"] },
  { part: 1, id: "part-1-autumn-rain", plate: "section-01", icons: [], sfx: [], cue: "discovery", soundscapes: ["distant-train"] },
  { part: 2, id: "part-2-twilight-lamp", plate: "section-02", icons: [], sfx: ["tape-rewind"], cue: "reveal", soundscapes: [] },
  { part: 3, id: "part-3-warm-room", plate: "section-03", icons: [], sfx: [], cue: "decision", soundscapes: [] },
  { part: 4, id: "part-4-snow-pact", plate: "section-04", icons: [], sfx: [], cue: "mountain", soundscapes: ["mountain-wind"] },
  { part: 5, id: "part-5-winter-light", plate: "section-05", icons: [], sfx: [], cue: "ten-years", soundscapes: [] },
] as const;

describe("cutscene registry", () => {
  it("covers the prologue and parts 1 to 5 with the planned scene, plate, audio cue and soundscapes", () => {
    assert.deepEqual([...SCENE_PARTS], [0, 1, 2, 3, 4, 5]);
    for (const expected of EXPECTED) {
      const entry = registryEntry(expected.part);
      assert.equal(entry.id, expected.id, `part ${expected.part}`);
      assert.equal(entry.assets.plate, expected.plate);
      assert.deepEqual([...entry.assets.icons], expected.icons);
      assert.deepEqual([...entry.assets.sfx], expected.sfx);
      assert.equal(entry.cue, expected.cue);
      assert.deepEqual([...entry.soundscapes], expected.soundscapes);
      assert.equal(typeof entry.load, "function");
    }
  });

  it("uses only real cue, soundscape and background slot ids", () => {
    const slotIds = new Set<string>(TSUKINOMI_BACKGROUND_SLOTS.map((slot) => slot.id));
    for (const entry of allRegistryEntries()) {
      if (entry.cue) assert.ok(isMusicCueId(entry.cue), `${entry.id} cue ${entry.cue}`);
      for (const soundscape of entry.soundscapes) assert.ok(isSoundscapeId(soundscape), `${entry.id} ${soundscape}`);
      if (entry.assets.plate) assert.ok(slotIds.has(entry.assets.plate), `${entry.id} plate ${entry.assets.plate}`);
    }
  });

  it("has a distinct scene id per entry and a scene file for each, loaded by a literal dynamic import", () => {
    const ids = allRegistryEntries().map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length);
    const registrySource = readFileSync(join(root, "src/scripts/tsukinomi/cutscene/registry.ts"), "utf8");
    for (const id of ids) {
      assert.ok(existsSync(join(root, `src/scripts/tsukinomi/cutscene/scenes/${id}.ts`)), `scenes/${id}.ts should exist`);
      assert.ok(registrySource.includes(`load: () => import("./scenes/${id}")`), `${id} should be loaded by a literal import()`);
    }
  });

  it("loads each entry's own scene: the id of an entry and the module its loader imports are the same file", () => {
    // allRegistryEntries() cannot call load() here (a scene imports a stylesheet, which node:test cannot
    // load), and "the import exists somewhere in the file" would not notice two parts' loaders swapped.
    const registrySource = readFileSync(join(root, "src/scripts/tsukinomi/cutscene/registry.ts"), "utf8");
    const pairs = [...registrySource.matchAll(/id: "([\w-]+)",\s*load: \(\) => import\("\.\/scenes\/([\w-]+)"\)/g)].map((match) => [match[1], match[2]]);
    assert.equal(pairs.length, SCENE_PARTS.length + 1, "six parts and the neutral fallback");
    for (const [id, imported] of pairs) assert.equal(imported, id, `the entry ${id} imports ./scenes/${imported}`);
  });

  it("falls back to the neutral epigraph-only scene for any other part", () => {
    for (const part of [-1, 6, 7, 24, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(isScenePart(part), false, `part ${part}`);
      assert.equal(registryEntry(part), NEUTRAL_ENTRY);
    }
    assert.equal(NEUTRAL_ENTRY.id, "neutral");
    assert.equal(NEUTRAL_ENTRY.assets.plate, null);
    assert.equal(NEUTRAL_ENTRY.cue, null);
    assert.deepEqual([...NEUTRAL_ENTRY.soundscapes], []);
    assert.equal(registryEntry("constructor" as unknown as number), NEUTRAL_ENTRY);
  });
});

describe("cutscene asset roles", () => {
  it("lists the public paths of each entry's assets", () => {
    assert.deepEqual(assetPathsFor(registryEntry(0)), [
      "/assets/tsukinomi/icons/walkman.svg",
      "/assets/tsukinomi/icons/cassette-mark.svg",
      "/assets/tsukinomi/audio/sfx/tape-click.mp3",
      "/assets/tsukinomi/audio/soundscape/cassette-hiss.mp3",
      "/assets/tsukinomi/audio/soundscape/cassette-hiss.ogg",
      "/assets/tsukinomi/audio/music/discovery.mp3",
      "/assets/tsukinomi/audio/music/discovery.ogg",
    ]);
    assert.deepEqual(assetPathsFor(registryEntry(2)), [
      "/assets/tsukinomi/images/backgrounds/section-02.avif",
      "/assets/tsukinomi/images/backgrounds/section-02.webp",
      "/assets/tsukinomi/images/backgrounds/section-02.jpg",
      "/assets/tsukinomi/audio/sfx/tape-rewind.mp3",
      "/assets/tsukinomi/audio/music/reveal.mp3",
      "/assets/tsukinomi/audio/music/reveal.ogg",
    ]);
    assert.deepEqual(assetPathsFor(NEUTRAL_ENTRY), []);
  });

  it("resolves a part's assets under the site base, in both development and production", () => {
    const withBase = (base: string) => (path: string) => `${base}${path.replace(/^\//, "")}`;
    for (const base of ["/", "/MY-NOVEL/"]) {
      const assets = resolveAssets(registryEntry(1).assets, withBase(base));
      assert.equal(assets.backgroundUrl, `${base}assets/tsukinomi/images/backgrounds/section-01.webp`);
      assert.equal(
        assets.backgroundCss,
        `image-set(url("${base}assets/tsukinomi/images/backgrounds/section-01.avif") type("image/avif"), ` +
          `url("${base}assets/tsukinomi/images/backgrounds/section-01.webp") type("image/webp"), ` +
          `url("${base}assets/tsukinomi/images/backgrounds/section-01.jpg"))`,
      );
      assert.deepEqual(assets.icons, {});

      const prologue = resolveAssets(registryEntry(0).assets, withBase(base));
      assert.equal(prologue.backgroundCss, "none");
      assert.equal(prologue.backgroundUrl, null);
      assert.deepEqual(prologue.icons, {
        walkman: `${base}assets/tsukinomi/icons/walkman.svg`,
        "cassette-mark": `${base}assets/tsukinomi/icons/cassette-mark.svg`,
      });
    }
  });
});
