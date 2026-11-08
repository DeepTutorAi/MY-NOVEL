import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  DEV_BYPASS_KEYS,
  DEV_KEY_CHECK,
  DEV_KEY_ITERATIONS,
  DEV_KEY_SALT,
  DEV_KEY_TTL_MS,
  deriveDevToken,
  devTokenCheck,
  hasActiveDevBypass,
  isDevToken,
  packDevToken,
  saveDevBypass,
} from "./dev-key";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("the developer key", () => {
  it("derives with PBKDF2-SHA-256 (published test vectors)", async () => {
    assert.equal(await deriveDevToken("password", "salt", 1), "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b");
    assert.equal(await deriveDevToken("password", "salt", 2), "ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43");
  });

  it("is set, with a real salt and the agreed cost", () => {
    assert.match(DEV_KEY_SALT, /^[0-9a-f]{32}$/);
    assert.match(DEV_KEY_CHECK, /^[0-9a-f]{64}$/);
    assert.equal(DEV_KEY_ITERATIONS, 600_000);
    assert.equal(DEV_KEY_TTL_MS, 3 * 24 * 60 * 60 * 1000);
  });

  it("accepts only a token whose check value is on record", async () => {
    assert.equal(await isDevToken(null), false);
    assert.equal(await isDevToken(""), false);
    assert.equal(await isDevToken("wrong"), false);
    assert.equal((await devTokenCheck("abc")).length, 64);
  });

  it("enforces the 3-day TTL and syncs across all novels", async () => {
    const validToken = await deriveDevToken("MY-NOVEL");
    const now = 1_700_000_000_000;
    const packed = packDevToken(validToken, now);

    assert.equal(await isDevToken(packed, now), true);
    assert.equal(await isDevToken(packed, now + DEV_KEY_TTL_MS - 1), true);
    assert.equal(await isDevToken(packed, now + DEV_KEY_TTL_MS), false);

    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => {
        store.set(key, val);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };

    saveDevBypass(validToken, mockStorage, "kusabi:extra-bypassed", now);
    for (const key of DEV_BYPASS_KEYS) {
      assert.equal(store.get(key), packed, `synced ${key}`);
    }

    assert.equal(await hasActiveDevBypass(mockStorage, undefined, now + 1000), true);
    assert.equal(await hasActiveDevBypass(mockStorage, undefined, now + DEV_KEY_TTL_MS), false);
    for (const key of DEV_BYPASS_KEYS) {
      assert.equal(store.get(key), undefined, `cleaned expired ${key}`);
    }
  });
});

describe("the old passwords", () => {
  it("have left every page that carried them", () => {
    for (const path of [
      "src/components/_shared/NovelCard.astro",
      "src/components/_shared/ResumeCard.astro",
      "src/layouts/tsukinomi/TsukinomiBaseLayout.astro",
      "src/pages/lodge/extra/index.astro",
      "src/scripts/tsukinomi/station-gates.ts",
      "src/scripts/kusabi/progress-core.ts",
    ]) {
      const source = read(path);
      assert.doesNotMatch(source, /[0-9a-f]{64}/, `${path} still holds a digest`);
      assert.doesNotMatch(source, /prompt\(/, `${path} still asks through prompt()`);
    }
  });

  it("every form goes through the one that counts wrong tries", () => {
    for (const path of [
      "src/pages/lodge/extra/index.astro",
      "src/pages/lodge/puzzle.astro",
      "src/scripts/tsukinomi/extra-train.ts",
      "src/scripts/kusabi/extra-room.ts",
    ]) {
      assert.match(read(path), /bindDevKeyForm/, path);
    }
    for (const path of [
      "src/pages/lodge/extra/index.astro",
      "src/pages/lodge/puzzle.astro",
      "src/pages/tsukinomi/extra/index.astro",
      "src/pages/kusabi/extra/index.astro",
    ]) {
      const source = read(path);
      assert.match(source, /data-dev-key/, path);
      assert.match(source, /data-bypass-hint/, path);
    }
  });
});
