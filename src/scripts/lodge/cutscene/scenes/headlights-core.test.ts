import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HEADLIGHTS, TRUNK_COUNT, approachBeam, beamTarget, headlightsReveal, lodgeLight, project, trunkVisible } from "./headlights-core";

describe("beam", () => {
  it("reaches 0.85 of the way to the horizon on high beam and 0.35 on low", () => {
    assert.equal(beamTarget(true), 0.85);
    assert.equal(beamTarget(false), 0.35);
  });

  it("lengthens over a full second (a large luminance change, design 3.3) and never overshoots", () => {
    let beam = 0.35;
    for (let i = 0; i < 50; i += 1) beam = approachBeam(beam, true, 0.01);
    assert.ok(Math.abs(beam - 0.6) < 1e-9, `after 0.5 s: ${beam}`);
    for (let i = 0; i < 100; i += 1) beam = approachBeam(beam, true, 0.01);
    assert.equal(beam, 0.85);
    for (let i = 0; i < 100; i += 1) beam = approachBeam(beam, false, 0.01);
    assert.equal(beam, 0.35);
  });
});

describe("the seven thin trunks", () => {
  it("are seven, seen only while the high beam reaches far enough", () => {
    assert.equal(TRUNK_COUNT, 7);
    assert.equal(trunkVisible(0.35), false);
    assert.equal(trunkVisible(0.69), false);
    assert.equal(trunkVisible(0.7), true);
  });
});

describe("timeline", () => {
  it("reveals the epigraph early and shows the lodge's lights near the end, all within 20 s", () => {
    assert.equal(headlightsReveal(0.5), 0);
    assert.equal(headlightsReveal(HEADLIGHTS.revealToS), 1);
    assert.equal(lodgeLight(HEADLIGHTS.lodgeLightAtS - 0.1), 0);
    assert.equal(HEADLIGHTS.lodgeLightAtS, 15);
    assert.ok(lodgeLight(HEADLIGHTS.lodgeLightAtS + 2) > 0.9);
    assert.ok(HEADLIGHTS.endS <= 20);
  });

  it("brings the lodge's lights up slowly (no flash)", () => {
    for (let t = 14; t < 19; t += 0.05) assert.ok(lodgeLight(t + 0.05) - lodgeLight(t) <= 0.05 * 1.5 / 1.5 + 1e-9);
  });
});

describe("project", () => {
  it("puts nearer things lower and further out from the vanishing point", () => {
    const far = project({ x: 2, y: 0, z: 40 }, 1000, 800);
    const near = project({ x: 2, y: 0, z: 5 }, 1000, 800);
    assert.ok(near.x > far.x && near.y > far.y && near.scale > far.scale);
  });
});
