import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LAMP, autoPath, firelight, inBen, lampReveal, trailAlpha } from "./lamp-core";

describe("Ben's place on plate 06A", () => {
  it("covers the man on the sofa and not the people beside him", () => {
    assert.equal(inBen(0.43, 0.32), true, "his face");
    assert.equal(inBen(0.44, 0.7), true, "his knees");
    assert.equal(inBen(0.13, 0.4), false, "Elena in the doorway");
    assert.equal(inBen(0.86, 0.45), false, "Diana in the armchair");
  });
});

describe("trailAlpha", () => {
  it("lets the light leave the room at once but linger half a second on Ben", () => {
    assert.equal(LAMP.lingerS, 0.5);
    assert.equal(trailAlpha(0.2, false), 0, "anywhere else the dark returns within 0.12 s");
    assert.ok(trailAlpha(0.2, true) > 0.5, "on Ben the light is still there");
    assert.equal(trailAlpha(0.5, true), 0);
    assert.equal(trailAlpha(0, false), 1);
  });
});

describe("autoPath", () => {
  it("sweeps the room inside the frame and crosses Ben", () => {
    let crossed = false;
    for (let t = 0; t < 18; t += 0.05) {
      const { u, v } = autoPath(t);
      assert.ok(u > 0.08 && u < 0.92 && v > 0.2 && v < 0.8, `${u},${v} at ${t}`);
      if (inBen(u, v)) crossed = true;
    }
    assert.ok(crossed);
  });
});

describe("firelight", () => {
  it("breathes slowly, never faster than 0.08 per second", () => {
    for (let t = 0; t < 20; t += 0.01) assert.ok(Math.abs(firelight(t + 0.01) - firelight(t)) / 0.01 <= 0.08 + 1e-9);
  });
});

describe("timeline", () => {
  it("reveals the epigraph and ends within 20 s", () => {
    assert.equal(lampReveal(0.5), 0);
    assert.equal(lampReveal(LAMP.revealToS), 1);
    assert.ok(LAMP.endS <= 20);
  });
});
