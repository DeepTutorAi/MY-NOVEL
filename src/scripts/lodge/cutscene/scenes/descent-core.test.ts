import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DESCENT, STEPS, approachStep, autoSteps, descentDone, descentReveal, hoardVisible, stepFromDrag, symbolGlow } from "./descent-core";

describe("stepping down", () => {
  it("has twelve steps and counts a drag in whole steps", () => {
    assert.equal(STEPS, 12);
    assert.equal(stepFromDrag(0, 90), 0);
    assert.equal(stepFromDrag(89, 90), 0);
    assert.equal(stepFromDrag(185, 90), 2);
    assert.equal(stepFromDrag(-300, 90), 0, "dragging up never climbs");
  });

  it("goes down by itself at a pace that reaches the bottom in time", () => {
    assert.equal(autoSteps(1), 0);
    assert.ok(autoSteps(DESCENT.autoFromS) >= 1);
    assert.equal(autoSteps(30), STEPS);
    const reachedAt = DESCENT.autoFromS + (STEPS - 1) * DESCENT.autoEveryS;
    assert.ok(reachedAt + DESCENT.holdAtBottomS <= 20, `bottom at ${reachedAt}`);
  });

  it("eases the camera toward the target without passing it", () => {
    let s = 0;
    for (let i = 0; i < 100; i += 1) s = approachStep(s, 3, 0.05);
    assert.equal(s, 3);
    assert.equal(approachStep(5, 3, 1), 5, "never climbs back");
  });
});

describe("the bottom", () => {
  it("shows the heap of belongings only at the last step", () => {
    assert.equal(hoardVisible(STEPS - 1), false);
    assert.equal(hoardVisible(STEPS), true);
  });

  it("ends a few seconds after the bottom, and at 19 s at the latest", () => {
    assert.equal(descentDone(10, null), false);
    assert.equal(descentDone(19, null), true);
    assert.equal(descentDone(12, 8), true);
    assert.equal(descentDone(10, 8), false);
  });
});

describe("symbolGlow", () => {
  it("glows only where the torch points", () => {
    assert.ok(symbolGlow(0, 0) > 0.99);
    assert.ok(symbolGlow(0, 0.3) < 0.6);
    assert.equal(symbolGlow(0, Math.PI), 0);
  });
});

describe("descentReveal", () => {
  it("reveals the epigraph from 1 s to 11 s", () => {
    assert.equal(descentReveal(0.5), 0);
    assert.equal(descentReveal(11), 1);
  });
});
