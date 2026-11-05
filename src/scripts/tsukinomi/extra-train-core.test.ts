import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paceWindows, scrollForPoint, trainProgress, trainTravel, type TrainPicture } from "./extra-train-core";

const picture = (caption: string): TrainPicture => ({ src: `/${caption}.webp`, width: 3, height: 4, alt: caption, caption });

describe("paceWindows", () => {
  it("opens and closes on the night, with one empty window between pictures", () => {
    const kinds = paceWindows([picture("a"), picture("b")]).map((window) => window.kind);
    assert.deepEqual(kinds, ["view", "picture", "view", "picture", "view"]);
  });

  it("numbers the carriages in riding order and takes any number of pictures", () => {
    const windows = paceWindows(Array.from({ length: 7 }, (_, index) => picture(String(index))));
    const cars = windows.flatMap((window) => (window.kind === "picture" ? [window.car] : []));
    assert.deepEqual(cars, [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(windows.length, 15);
  });

  it("keeps the order it was given, so the thank-you stays last", () => {
    const windows = paceWindows([picture("first"), picture("thanks")]);
    const last = windows.filter((window) => window.kind === "picture").at(-1);
    assert.equal(last?.kind === "picture" ? last.picture.caption : "", "thanks");
  });
});

describe("the run", () => {
  it("never travels backwards when the track fits the screen", () => {
    assert.equal(trainTravel(800, 1440), 0);
    assert.equal(trainTravel(3000, 1440), 1560);
  });

  it("stays at the ends before and after the run", () => {
    assert.equal(trainProgress(0, 100, 1000), 0);
    assert.equal(trainProgress(600, 100, 1000), 0.5);
    assert.equal(trainProgress(5000, 100, 1000), 1);
    assert.equal(trainProgress(600, 100, 0), 0);
  });

  it("finds the scroll that centres a window, inside the run", () => {
    assert.equal(scrollForPoint(1000, 100, 2000, 800), 700);
    assert.equal(scrollForPoint(10, 100, 2000, 800), 100);
    assert.equal(scrollForPoint(99999, 100, 2000, 800), 2100);
  });
});
