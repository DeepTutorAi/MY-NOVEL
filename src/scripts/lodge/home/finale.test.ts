import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FINALE_SEEN_KEY, consumeFinaleFlip } from "./finale";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe("consumeFinaleFlip", () => {
  it("flips once, then never again", () => {
    const storage = new MemoryStorage() as unknown as Storage;
    assert.equal(consumeFinaleFlip(storage), true);
    assert.ok((storage as unknown as MemoryStorage).data.has(FINALE_SEEN_KEY));
    assert.equal(consumeFinaleFlip(storage), false);
  });

  it("does not flip when storage refuses writes, rather than flipping on every visit", () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error("blocked"); } } as unknown as Storage;
    assert.equal(consumeFinaleFlip(storage), false);
  });
});
