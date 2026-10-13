import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { EPIGRAPHS, epigraphFor } from "./epigraphs";
import { SCENE_CHAPTERS, registryEntry } from "./registry";
import { REVEAL_STEP_MS, revealClusters, shouldStep, visibleCount } from "./reveal-core";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

describe("epigraphs", () => {
  it("are the author's five texts, unchanged from the old layout (main 0f6fa36)", () => {
    assert.deepEqual(Object.keys(EPIGRAPHS).map(Number), [0, 1, 6, 13, 18]);
    assert.equal(sha(EPIGRAPHS[0]), "2083622cc1aa324d510d830d0ad1670835179b4034dc89c7b58ba9ff65eb2450");
    assert.equal(sha(EPIGRAPHS[1]), "8fed9c776769a6a5f056248926236203739faac8545869d340d3fa761ba54b0f");
    assert.equal(sha(EPIGRAPHS[6]), "96e90762c12a68b53bd9aaff54c62334ba970236780f14eb72718f240c0bab1e");
    assert.equal(sha(EPIGRAPHS[13]), "a09beee3441b4fabf0dd36f4b228f92c554cbf4168cd60f55480995861d1d96d");
    assert.equal(sha(EPIGRAPHS[18]), "a3bb9c57535e4323a9179777f7a08823983bc17858c02ee109bc9b1fa9eb5039");
    assert.equal(epigraphFor(2), undefined);
  });
});

describe("registry", () => {
  it("has a scene for exactly the five epigraph chapters, each loaded lazily", () => {
    assert.deepEqual([...SCENE_CHAPTERS], [0, 1, 6, 13, 18]);
    for (const chapter of SCENE_CHAPTERS) assert.equal(typeof registryEntry(chapter).load, "function");
    const source = readFileSync(join(process.cwd(), "src/scripts/lodge/cutscene/registry.ts"), "utf8");
    assert.doesNotMatch(source, /^import .*\/scenes\//m, "no static import of a scene");
  });
});

describe("reveal", () => {
  it("splits an epigraph into whole grapheme clusters that rebuild it exactly", () => {
    for (const text of Object.values(EPIGRAPHS)) {
      const clusters = revealClusters(text);
      assert.equal(clusters.join(""), text);
      assert.ok(clusters.every((cluster) => !/^[ัิ-ฺ็-๎]/.test(cluster)), "a cluster starts with a combining mark");
    }
  });

  it("steps at most ten times a second, except to finish", () => {
    assert.equal(REVEAL_STEP_MS, 100);
    assert.equal(shouldStep(10, 11, 200, 40), false, "a step too soon waits");
    assert.equal(shouldStep(10, 11, 200, 100), true);
    assert.equal(shouldStep(190, 200, 200, 5), true, "reaching the end is never held back");
    assert.equal(shouldStep(10, 10, 200, 500), false, "nothing to do");
  });

  it("shows a share of the clusters, never fewer than none or more than all", () => {
    assert.equal(visibleCount(0, 100), 0);
    assert.equal(visibleCount(0.5, 100), 50);
    assert.equal(visibleCount(1, 100), 100);
    assert.equal(visibleCount(-1, 100), 0);
    assert.equal(visibleCount(2, 100), 100);
  });
});
