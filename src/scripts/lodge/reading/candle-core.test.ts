import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CANDLE_FLOOR, candleHeight, dripsFor, flameState } from "./candle-core";

describe("candleHeight", () => {
  it("burns down from full to a stub as the chapter is read", () => {
    assert.equal(candleHeight(0), 1);
    assert.equal(CANDLE_FLOOR, 0.12);
    assert.equal(candleHeight(1), CANDLE_FLOOR);
    assert.ok(Math.abs(candleHeight(0.5) - (1 + CANDLE_FLOOR) / 2) < 1e-9);
  });

  it("clamps progress outside 0..1", () => {
    assert.equal(candleHeight(-1), 1);
    assert.equal(candleHeight(3), CANDLE_FLOOR);
    assert.equal(candleHeight(Number.NaN), 1);
  });
});

describe("dripsFor", () => {
  it("leaves a drip for every section already passed", () => {
    assert.deepEqual(dripsFor([0.2, 0.5, 0.8], 0.55), [0.2, 0.5]);
    assert.deepEqual(dripsFor([0.2, 0.5, 0.8], 0.1), []);
    assert.deepEqual(dripsFor([], 1), []);
  });
});

describe("flameState", () => {
  it("gutters at the very end and goes out when the chapter is finished", () => {
    assert.equal(flameState(0.5), "lit");
    assert.equal(flameState(0.979), "lit");
    assert.equal(flameState(0.98), "guttering");
    assert.equal(flameState(0.994), "guttering");
    assert.equal(flameState(0.995), "out");
  });
});
