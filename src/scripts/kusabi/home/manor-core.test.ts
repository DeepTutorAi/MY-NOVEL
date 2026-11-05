import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lampLevel, placePlate, PLATE_POINTS, PLATE_RATIO, platePoint, rainCount, scrollDim } from "./manor-core";

describe("placePlate", () => {
  it("keeps the plate's shape in every viewport", () => {
    for (const [w, h] of [[1440, 900], [390, 844], [844, 390], [768, 1024], [2560, 1080]]) {
      const place = placePlate(w, h);
      assert.ok(Math.abs(place.width / place.height - PLATE_RATIO) < 1e-9, `${w}x${h}`);
    }
  });

  it("sits beside the copy on a wide screen, leaving the left side for text", () => {
    const place = placePlate(1440, 900);
    assert.equal(place.beside, true);
    assert.ok(place.x >= 1440 * 0.3);
    assert.equal(place.x + place.width, 1440);
  });

  it("fills the width on a phone with the door in the upper half", () => {
    const place = placePlate(390, 844);
    assert.equal(place.beside, false);
    assert.ok(place.x <= 0 && place.x + place.width >= 390);
    const door = platePoint(place, PLATE_POINTS.gapLeft, PLATE_POINTS.doorCentreY);
    assert.ok(door.y > 0 && door.y < 844 / 2, `door at ${door.y}`);
  });

  it("keeps the door on screen on a landscape phone", () => {
    const place = placePlate(844, 390);
    const door = platePoint(place, PLATE_POINTS.gapLeft, PLATE_POINTS.doorCentreY);
    assert.ok(door.x > 0 && door.x < 844 && door.y > 0 && door.y < 390);
  });
});

describe("weather and light", () => {
  it("stops the rain when asked and bounds the drop count", () => {
    assert.equal(rainCount(1440, 900, false), 0);
    assert.equal(rainCount(320, 480, true), 70);
    assert.equal(rainCount(3840, 2160, true), 240);
  });

  it("clamps the scroll dim to 0..1", () => {
    assert.equal(scrollDim(-10, 800), 0);
    assert.equal(scrollDim(10_000, 800), 1);
    assert.equal(scrollDim(0, 0), 0);
  });

  it("keeps the lamp lit but lets it dip", () => {
    assert.ok(lampLevel(0) > 0.7);
    assert.ok(lampLevel(-0.9) < lampLevel(-0.7));
    assert.ok(lampLevel(-1) > 0);
  });
});
