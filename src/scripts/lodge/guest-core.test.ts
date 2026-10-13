import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { splitGraphemes } from "../_shared/cutscene/graphemes";
import { GUEST_KEY, GUEST_NAME_MAX, guestMonthLabel, normalizeGuestName, parseGuestRecord } from "./guest-core";

describe("normalizeGuestName", () => {
  it("trims, collapses whitespace and drops control characters", () => {
    assert.equal(normalizeGuestName("  เอ   ลีน่า \u0007 "), "เอ ลีน่า");
  });

  it("returns null for an empty or blank name", () => {
    assert.equal(normalizeGuestName(""), null);
    assert.equal(normalizeGuestName("   \n "), null);
  });

  it("caps a long Thai name at 40 whole grapheme clusters", () => {
    const name = normalizeGuestName("กี่".repeat(200));
    assert.ok(name);
    const clusters = splitGraphemes(name);
    assert.equal(GUEST_NAME_MAX, 40);
    assert.equal(clusters.length, 40);
    assert.ok(clusters.every((cluster) => cluster === "กี่"), "no cluster was cut in half");
  });

  it("keeps emoji clusters whole", () => {
    const name = normalizeGuestName("👩‍👩‍👧".repeat(50));
    assert.ok(name);
    assert.equal(splitGraphemes(name).length, 40);
    assert.ok(splitGraphemes(name).every((cluster) => cluster === "👩‍👩‍👧"));
  });
});

describe("parseGuestRecord", () => {
  it("round-trips a valid record", () => {
    const record = { name: "เอลีน่า", signedAt: "2026-10-13T00:00:00.000Z", skipped: false };
    assert.deepEqual(parseGuestRecord(JSON.stringify(record)), record);
    const skipped = { name: null, signedAt: "2026-10-13T00:00:00.000Z", skipped: true };
    assert.deepEqual(parseGuestRecord(JSON.stringify(skipped)), skipped);
  });

  it("treats anything malformed as unsigned", () => {
    assert.equal(parseGuestRecord(null), null);
    assert.equal(parseGuestRecord("{bad"), null);
    assert.equal(parseGuestRecord('{"name":1}'), null);
    assert.equal(parseGuestRecord('{"name":"a","signedAt":"not a date","skipped":false}'), null);
    assert.equal(parseGuestRecord('{"name":"","signedAt":"2026-10-13T00:00:00.000Z","skipped":false}'), null);
  });

  it("re-normalizes a stored name that was edited by hand", () => {
    const raw = JSON.stringify({ name: "  a\u0000b  ", signedAt: "2026-10-13T00:00:00.000Z", skipped: false });
    assert.equal(parseGuestRecord(raw)?.name, "ab");
  });
});

describe("guestMonthLabel", () => {
  it("uses the record style of chapter 3", () => {
    assert.equal(guestMonthLabel("2026-10-13T00:00:00Z"), "Oct 2026");
    assert.equal(guestMonthLabel("2024-02-06T02:00:00Z"), "Feb 2024");
  });
});

describe("profile isolation", () => {
  it("registers every new Lodge key with the profile interceptor", () => {
    const source = readFileSync(join(process.cwd(), "src/components/_shared/ProfileStorageInterceptor.astro"), "utf8");
    for (const key of [GUEST_KEY, "hvitveldt:suspects", "hvitveldt:finale:seen"]) {
      assert.ok(source.includes(`"${key}"`), `${key} missing from the prefix list`);
    }
  });
});
