import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NO_ATTEMPTS, attemptStatus, parseAttempts, recordWrong, settleAttempts, type AttemptPolicy, type AttemptState } from "./attempt-limit";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const DEV: AttemptPolicy = { hintAfter: 3, lockAfter: 5, windowMs: DAY, lockMs: DAY };
const SEA: AttemptPolicy = { lockAfter: 3, lockMs: 5 * HOUR };

const wrongTimes = (policy: AttemptPolicy, times: number, at = 1000): AttemptState => {
  let state = NO_ATTEMPTS;
  for (let i = 0; i < times; i += 1) state = recordWrong(state, at + i, policy);
  return state;
};

describe("the developer shortcut's rules", () => {
  it("shows nothing for two wrong tries, the hint from the third", () => {
    assert.equal(attemptStatus(wrongTimes(DEV, 2), 2000, DEV).showHint, false);
    assert.equal(attemptStatus(wrongTimes(DEV, 3), 2000, DEV).showHint, true);
  });

  it("does not lock on the fourth, locks on the fifth", () => {
    assert.equal(attemptStatus(wrongTimes(DEV, 4), 2000, DEV).locked, false);
    assert.equal(attemptStatus(wrongTimes(DEV, 5), 2000, DEV).locked, true);
  });

  it("stays locked for a full day of real time, then starts over", () => {
    const state = wrongTimes(DEV, 5);
    assert.equal(attemptStatus(state, state.lockedUntil - 1, DEV).locked, true);
    const after = attemptStatus(state, state.lockedUntil, DEV);
    assert.equal(after.locked, false);
    assert.equal(after.showHint, false);
    assert.equal(after.left, 5);
  });

  it("forgets tries older than a day when no lock happened", () => {
    const state = wrongTimes(DEV, 4);
    assert.equal(settleAttempts(state, state.firstWrongAt + DAY - 1, DEV).wrong, 4);
    assert.deepEqual(settleAttempts(state, state.firstWrongAt + DAY, DEV), NO_ATTEMPTS);
  });

  it("does not count more tries during a lock", () => {
    const state = wrongTimes(DEV, 5);
    assert.deepEqual(recordWrong(state, 2000, DEV), state);
  });
});

describe("the Sea gate's rules", () => {
  it("locks on the third wrong try for five hours and has no hint", () => {
    assert.equal(attemptStatus(wrongTimes(SEA, 2), 2000, SEA).locked, false);
    const state = wrongTimes(SEA, 3);
    assert.equal(attemptStatus(state, state.lockedUntil - 1, SEA).locked, true);
    assert.equal(state.lockedUntil - 1002, 5 * HOUR);
    assert.equal(attemptStatus(state, 2000, SEA).showHint, false);
    assert.equal(attemptStatus(state, state.lockedUntil, SEA).locked, false);
  });

  it("keeps earlier wrong tries with no time window", () => {
    const state = wrongTimes(SEA, 2);
    assert.equal(attemptStatus(state, 1000 + 30 * DAY, SEA).left, 1);
  });
});

describe("what comes back from storage", () => {
  it("treats anything malformed as no tries", () => {
    for (const raw of [null, "", "{", "null", "3", '{"wrong":"5"}', '{"wrong":-1,"firstWrongAt":0,"lockedUntil":0}']) {
      assert.deepEqual(parseAttempts(raw), NO_ATTEMPTS, String(raw));
    }
  });

  it("round-trips a real state", () => {
    const state = wrongTimes(DEV, 3);
    assert.deepEqual(parseAttempts(JSON.stringify(state)), state);
  });

  it("does not let a clock set back stretch the wait", () => {
    const state = wrongTimes(DEV, 5);
    const back = state.lockedUntil - 3 * DAY;
    assert.equal(settleAttempts(state, back, DEV).lockedUntil, back + DAY);
  });
});
