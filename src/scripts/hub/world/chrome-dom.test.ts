import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { lazy } from "./chrome-dom";

describe("chrome-dom: lazy", () => {
  it("runs the loader once and shares its promise", async () => {
    let calls = 0;
    const load = lazy(async () => ++calls);
    const [a, b] = await Promise.all([load(), load()]);
    assert.equal(a, 1);
    assert.equal(b, 1);
    assert.equal(await load(), 1);
    assert.equal(calls, 1);
  });

  it("retries on the next call after a rejected load", async () => {
    let calls = 0;
    const load = lazy(async () => {
      calls++;
      if (calls === 1) throw new Error("offline");
      return "loaded";
    });
    await assert.rejects(load(), /offline/);
    assert.equal(await load(), "loaded");
    assert.equal(await load(), "loaded");
    assert.equal(calls, 2);
  });
});
