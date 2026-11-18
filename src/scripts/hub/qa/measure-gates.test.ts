import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { THROTTLE_HOLD_MS, splitLongTasks, throttleFailures } from "./measure-gates";

describe("hub-measure gates", () => {
  it("counts only long tasks that start after hub:scene, and reports the load ones apart", () => {
    const tasks = [
      { start: 100, duration: 90 },
      { start: 900, duration: 60 },
      { start: 1200, duration: 70 },
      { start: 1300, duration: 40 },
    ];
    const split = splitLongTasks(tasks, 1000, 50);
    assert.deepEqual(split.scene, [{ start: 1200, duration: 70 }]);
    assert.deepEqual(split.load, [{ start: 100, duration: 90 }, { start: 900, duration: 60 }]);
    assert.equal(splitLongTasks(tasks, null, 50).scene.length, 3, "without hub:scene every long task counts");
  });

  it("passes a cheap scene that holds tier 0 under 4x CPU, and still fails a slow one", () => {
    assert.deepEqual(throttleFailures("x", { reachedTierMs: null, finalTier: 0, drawMsMean: THROTTLE_HOLD_MS }, 12), []);
    assert.deepEqual(throttleFailures("x", { reachedTierMs: 1800, finalTier: 1, drawMsMean: 9 }, 12), []);
    assert.equal(throttleFailures("x", { reachedTierMs: null, finalTier: 0, drawMsMean: 6.2 }, 12).length, 1);
    assert.equal(throttleFailures("x", { reachedTierMs: 6000, finalTier: 1, drawMsMean: 4 }, 12).length, 1, "a late step is still late");
    assert.equal(throttleFailures("x", { reachedTierMs: 900, finalTier: 2, drawMsMean: 13 }, 12).length, 1);
  });
});
