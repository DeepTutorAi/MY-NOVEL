import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EPIGRAPHS } from "../epigraphs";
import { revealClusters } from "../reveal-core";
import { NOTEBOOK, coverAngle, findWordClusters, notebookReveal, ringGlint } from "./notebook-core";

describe("coverAngle", () => {
  it("stays shut until opened, then turns over 1.6 s", () => {
    assert.equal(coverAngle(3, null), 0);
    assert.equal(coverAngle(4, 4), 0);
    assert.ok(Math.abs(coverAngle(4.8, 4) - Math.PI / 2) < 1e-9);
    assert.equal(coverAngle(5.6, 4), Math.PI);
    assert.equal(coverAngle(30, 4), Math.PI);
  });

  it("opens by itself when the reader does not", () => {
    assert.equal(NOTEBOOK.autoOpenS, 5);
    assert.equal(NOTEBOOK.openS, 1.6);
  });
});

describe("notebookReveal", () => {
  it("reveals the epigraph after the cover has turned and ends within 20 s", () => {
    assert.equal(notebookReveal(6, 5), 0);
    assert.ok(notebookReveal(10, 5) > 0 && notebookReveal(10, 5) < 1);
    assert.equal(notebookReveal(15, 5), 1);
    assert.ok(NOTEBOOK.endAfterOpenS + NOTEBOOK.autoOpenS <= 20);
  });
});

describe("findWordClusters", () => {
  it("finds both ฉัน of the introduction's epigraph as whole clusters", () => {
    const clusters = revealClusters(EPIGRAPHS[0]);
    const ranges = findWordClusters(clusters, "ฉัน");
    assert.equal(ranges.length, 2);
    for (const [start, end] of ranges) assert.equal(clusters.slice(start, end).join(""), "ฉัน");
  });

  it("ignores a match that does not line up with cluster edges", () => {
    assert.deepEqual(findWordClusters(revealClusters("ฉั"), "ฉัน"), []);
  });
});

describe("ringGlint", () => {
  it("stays a faint, slow glint", () => {
    let max = 0;
    for (let t = 0; t < 20; t += 0.05) max = Math.max(max, ringGlint(t));
    assert.ok(max <= 0.15 && max > 0.05);
  });
});
