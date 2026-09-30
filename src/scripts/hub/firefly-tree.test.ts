import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeLayout } from "./firefly-scene";
import { buildTree, MARGIN, pickWeighted } from "./firefly-tree";

const SIZES: ReadonlyArray<readonly [number, number]> = [
  [1440, 900],
  [390, 844],
  [844, 390],
];

describe("lamphu tree geometry", () => {
  it("is deterministic for a given layout", () => {
    const L = computeLayout(1440, 900);
    const a = buildTree(L.trees[0], L);
    const b = buildTree(L.trees[0], L);
    assert.deepEqual(a.pads, b.pads);
    assert.deepEqual(Array.from(a.perches), Array.from(b.perches));
    assert.deepEqual(a.branches, b.branches);
  });

  for (const [w, h] of SIZES) {
    it(`builds finite, bounded geometry at ${w}x${h}`, () => {
      const L = computeLayout(w, h);
      for (const spec of L.trees) {
        const tree = buildTree(spec, L);
        assert.ok(tree.pads.length >= (spec.near ? 100 : 40), `pads ${tree.pads.length}`);
        assert.ok(tree.branches.length > 8, `branches ${tree.branches.length}`);
        for (const b of [tree.trunk, ...tree.roots, ...tree.branches]) {
          assert.ok(b.pts.length >= 6 && b.pts.length % 3 === 0);
          assert.ok(b.pts.every(Number.isFinite), "limb points are finite");
        }
        for (const p of tree.pads) {
          assert.ok(Number.isFinite(p.x + p.y + p.rx + p.ry + p.leaf) && p.leaf > 0);
          assert.ok(p.shell >= 0 && p.shell <= 1);
        }
        const { box } = tree;
        assert.ok(box.x >= -MARGIN && box.y >= -MARGIN && box.x + box.w <= w + MARGIN + 2 && box.y + box.h <= h + MARGIN + 2, "box stays inside the overscan");
      }
    });

    it(`keeps perches on screen and normalises weights at ${w}x${h}`, () => {
      const L = computeLayout(w, h);
      for (const spec of L.trees) {
        const tree = buildTree(spec, L);
        const n = tree.perchEdge.length;
        let visible = 0;
        for (let i = 0; i < n; i++) {
          const x = tree.perches[i * 2];
          const y = tree.perches[i * 2 + 1];
          if (x > 0 && x < w && y > 0 && y < h) visible++;
          if (i > 0) assert.ok(tree.perchCdf[i] >= tree.perchCdf[i - 1], "cdf is monotone");
        }
        assert.ok(visible / n > 0.9, `visible perches ${visible}/${n}`);
        assert.ok(Math.abs(tree.perchCdf[n - 1] - 1) < 1e-4);
      }
    });
  }

  it("closes the crown: no pad centre lies far outside the envelope", () => {
    const L = computeLayout(1440, 900);
    const spec = L.trees[0];
    const tree = buildTree(spec, L);
    const rx = (spec.x1 - spec.x0) / 2;
    for (const p of tree.pads) {
      assert.ok(Math.abs(p.x - tree.cx) <= rx * 1.13, "pad within the crown width");
      assert.ok(p.y >= spec.top - 60 && p.y <= spec.bottom + 20, "pad within the crown height");
    }
  });

  it("picks the first perch whose cumulative weight reaches u", () => {
    const cdf = Float32Array.from([0.1, 0.4, 0.4, 1]);
    assert.equal(pickWeighted(cdf, 0), 0);
    assert.equal(pickWeighted(cdf, 0.11), 1);
    assert.equal(pickWeighted(cdf, 0.4), 1);
    assert.equal(pickWeighted(cdf, 0.9), 3);
  });
});
