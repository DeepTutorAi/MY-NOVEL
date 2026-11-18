import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { flightPath, rectGap, spotOnEdge } from "./chrome-place";

const OPTIONS = { clear: 16, maxOverlap: 6, margin: 12, step: 8 };
const EDGE = { x: 100, y: 400, w: 600, h: 0 };
const GUIDE = { w: 36, h: 36 };

describe("rectGap", () => {
  it("is 0 for touching or overlapping rects and the straight or corner distance otherwise", () => {
    assert.equal(rectGap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 }), 0);
    assert.equal(rectGap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), 0);
    assert.equal(rectGap({ x: 0, y: 0, w: 10, h: 10 }, { x: 30, y: 0, w: 5, h: 5 }), 20);
    assert.equal(rectGap({ x: 0, y: 0, w: 10, h: 10 }, { x: 13, y: 14, w: 5, h: 5 }), 5);
  });
});

describe("spotOnEdge", () => {
  it("sits on the edge at the preferred fraction, sunk by the deepest overlap, when nothing is near", () => {
    const spot = spotOnEdge(EDGE, GUIDE, [], 0.5, OPTIONS);
    assert.equal(spot.x, 400);
    assert.equal(spot.y, 400 - 36 + 6);
    assert.equal(spot.clearance, Number.POSITIVE_INFINITY);
  });

  it("keeps the box inside the edge's margins", () => {
    assert.equal(spotOnEdge(EDGE, GUIDE, [], 0, OPTIONS).x, 100 + 12 + 18);
    assert.equal(spotOnEdge(EDGE, GUIDE, [], 1, OPTIONS).x, 700 - 12 - 18);
  });

  it("moves along the edge until it is 16 px clear of a hole above the edge", () => {
    const hole = { x: 360, y: 340, w: 80, h: 40 };
    const spot = spotOnEdge(EDGE, GUIDE, [hole], 0.5, OPTIONS);
    const box = { x: spot.x - 18, y: spot.y, w: 36, h: 36 };
    assert.ok(rectGap(box, hole) >= 16, `gap ${rectGap(box, hole)}`);
    assert.ok(Math.abs(spot.x - 400) <= 80, `stays near the preferred point, x ${spot.x}`);
  });

  it("rises out of the edge before it moves away when a hole sits just under the edge", () => {
    const hole = { x: 380, y: 416, w: 40, h: 20 };
    const spot = spotOnEdge(EDGE, GUIDE, [hole], 0.5, OPTIONS);
    assert.equal(spot.x, 400);
    assert.equal(spot.y, 400 - 36);
    assert.equal(spot.clearance, 16);
  });

  it("returns the clearest spot when no spot reaches the wanted gap", () => {
    const holes = [{ x: 0, y: 340, w: 800, h: 20 }];
    const spot = spotOnEdge(EDGE, GUIDE, holes, 0.5, OPTIONS);
    assert.equal(spot.clearance, 10);
    assert.equal(spot.x, 400);
    assert.equal(spot.y, 400 - 36 + 6, "the deepest overlap is the clearest from a hole above");
  });

  it("centres on an edge narrower than the box", () => {
    const spot = spotOnEdge({ x: 10, y: 50, w: 20, h: 0 }, GUIDE, [], 0.9, OPTIONS);
    assert.equal(spot.x, 20);
  });
});

describe("flightPath", () => {
  it("starts at the offset, ends at the destination and arcs upward", () => {
    const { points } = flightPath(-300, 200);
    assert.deepEqual(points[0], { x: -300, y: 200 });
    assert.deepEqual(points[points.length - 1], { x: 0, y: 0 });
    const straightMid = 100;
    assert.ok(points[6].y < straightMid, `mid point y ${points[6].y} lies above the straight line`);
  });

  it("takes 900 to 1400 ms, longer for longer flights", () => {
    assert.equal(flightPath(10, 0).ms, 905);
    assert.equal(flightPath(400, 300).ms, 1150);
    assert.equal(flightPath(4000, 0).ms, 1400);
  });
});
