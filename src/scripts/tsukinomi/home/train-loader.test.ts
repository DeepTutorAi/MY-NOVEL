import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseSeed, trainSkipReason, type TrainEnvironment } from "./train-loader";

const OPEN: TrainEnvironment = { reducedMotion: false, shortLandscape: false, hasMount: true, hasCanvas: true };

describe("trainSkipReason", () => {
  it("lets the train run when nothing forbids it", () => {
    assert.equal(trainSkipReason(OPEN), null);
  });

  it("skips under reduced motion", () => {
    assert.equal(trainSkipReason({ ...OPEN, reducedMotion: true }), "reduced-motion");
  });

  it("skips in short landscape", () => {
    assert.equal(trainSkipReason({ ...OPEN, shortLandscape: true }), "short-landscape");
  });

  it("skips with no mount or no canvas support", () => {
    assert.equal(trainSkipReason({ ...OPEN, hasMount: false }), "no-mount");
    assert.equal(trainSkipReason({ ...OPEN, hasCanvas: false }), "no-canvas");
  });

  it("names reduced motion first when several rules apply", () => {
    assert.equal(
      trainSkipReason({ reducedMotion: true, shortLandscape: true, hasMount: false, hasCanvas: false }),
      "reduced-motion",
    );
    assert.equal(trainSkipReason({ ...OPEN, hasMount: false, shortLandscape: true }), "no-mount");
  });
});

describe("parseSeed", () => {
  it("reads a non-negative integer", () => {
    assert.equal(parseSeed("0"), 0);
    assert.equal(parseSeed("7"), 7);
    assert.equal(parseSeed(" 42 "), 42);
    assert.equal(parseSeed("4294967295"), 4294967295);
  });

  it("answers null for anything else, so the scene falls back to a random seed", () => {
    for (const raw of [undefined, null, "", " ", "-1", "1.5", "1e3", "abc", "0x10", "4294967296", "12345678901", "7 8"]) {
      assert.equal(parseSeed(raw as string | null | undefined), null, String(raw));
    }
  });
});
