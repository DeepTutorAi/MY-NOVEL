import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { describe, it } from "node:test";

import { HUB_THEME_COPY } from "../../data/hub/themes";
import {
  HUB_FALLBACK,
  HUB_THEMES,
  MOTION_KEY,
  OVERRIDE_KEY,
  ROTATION_EPOCHS,
  lowerFirst,
  resolveTheme,
  themeByKey,
  weeklyTheme,
} from "./theme-core.mjs";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-11-18T12:00:00+07:00");
const ICT_MS = 7 * 60 * 60 * 1000;

// Epochs that have started must never change. Step C may move an unstarted
// epoch; it then updates this list in the same change.
const FROZEN_EPOCHS = [
  { from: "2026-01-05T07:00:00+07:00", order: ["constellation", "mothlight", "firefly", "pages-stars"] },
  { from: "2026-11-23T07:00:00+07:00", order: ["pages-stars", "skyglass", "constellation", "mothlight", "firefly"] },
];

describe("hub theme registry", () => {
  it("lists the five themes in picker order with unique keys, binds and containers", () => {
    assert.deepEqual(
      HUB_THEMES.map((row) => row.key),
      ["pages-stars", "skyglass", "constellation", "mothlight", "firefly"],
    );
    for (const field of ["key", "bind", "container"] as const) {
      assert.equal(new Set(HUB_THEMES.map((row) => row[field])).size, HUB_THEMES.length, field);
    }
    for (const row of HUB_THEMES) {
      assert.equal(row.container, `${row.key}-bg-container`);
      assert.match(row.themeColor, /^#[0-9a-f]{6}$/);
    }
  });

  it("keeps the legacy key and bind pairs", () => {
    const pairs = Object.fromEntries(HUB_THEMES.map((row) => [row.key, row.bind]));
    assert.equal(pairs["constellation"], "DynamicCityBg");
    assert.equal(pairs["mothlight"], "MothlightBg");
    assert.equal(pairs["firefly"], "FireflyBg");
    assert.equal(pairs["pages-stars"], "PagesStarsBg");
    assert.equal(pairs["skyglass"], "SkyglassBg");
  });

  it("exposes the storage keys and fallback", () => {
    assert.equal(OVERRIDE_KEY, "piichan-novels:theme-override");
    assert.equal(MOTION_KEY, "piichan-novels:hub-motion");
    assert.equal(HUB_FALLBACK, "pages-stars");
    assert.ok(themeByKey(HUB_FALLBACK)?.enabled);
  });

  it("lowerFirst lowers only the first letter", () => {
    assert.equal(lowerFirst("DynamicCityBg"), "dynamicCityBg");
    assert.equal(lowerFirst("PagesStarsBg"), "pagesStarsBg");
    assert.equal(lowerFirst(""), "");
  });

  it("themeByKey returns the row or null", () => {
    assert.equal(themeByKey("mothlight")?.bind, "MothlightBg");
    for (const bad of ["", "sky", "Mothlight", "__proto__", "toString", null, undefined, 3]) {
      assert.equal(themeByKey(bad), null, String(bad));
    }
  });
});

describe("rotation epochs", () => {
  it("start on a Monday at 07:00 +07:00 and strictly increase", () => {
    let previous = -Infinity;
    for (const epoch of ROTATION_EPOCHS) {
      assert.match(epoch.from, /T07:00:00\+07:00$/);
      const ms = Date.parse(epoch.from);
      const local = new Date(ms + ICT_MS);
      assert.equal(local.getUTCDay(), 1, epoch.from);
      assert.equal(local.getUTCHours(), 7, epoch.from);
      assert.equal(local.getUTCMinutes() + local.getUTCSeconds() + local.getUTCMilliseconds(), 0, epoch.from);
      assert.ok(ms > previous, `${epoch.from} must follow the previous epoch`);
      previous = ms;
    }
  });

  it("only rotate known, enabled keys, each once per epoch", () => {
    for (const epoch of ROTATION_EPOCHS) {
      assert.ok(epoch.order.length > 0);
      assert.equal(new Set(epoch.order).size, epoch.order.length, epoch.from);
      for (const key of epoch.order) assert.ok(themeByKey(key)?.enabled, `${key} in ${epoch.from}`);
    }
  });

  it("never change once started (snapshot)", () => {
    const started = ROTATION_EPOCHS.filter((epoch) => Date.parse(epoch.from) <= Date.now());
    assert.ok(started.length <= FROZEN_EPOCHS.length, "a started epoch is missing from FROZEN_EPOCHS");
    started.forEach((epoch, index) => assert.deepEqual(epoch, FROZEN_EPOCHS[index]));
  });
});

describe("weeklyTheme", () => {
  it("matches the pinned dates", () => {
    assert.equal(weeklyTheme(at("2026-11-18T12:00:00+07:00")), "mothlight");
    assert.equal(weeklyTheme(at("2026-11-23T06:59:59+07:00")), "mothlight");
    assert.equal(weeklyTheme(at("2026-11-23T07:00:00+07:00")), "pages-stars");
    assert.equal(weeklyTheme(at("2026-11-30T07:00:00+07:00")), "skyglass");
  });

  it("matches the legacy switcher for every week of the first epoch", () => {
    const legacy = ["constellation", "mothlight", "firefly", "pages-stars"];
    const start = at("2026-01-05T07:00:00+07:00");
    const week = 7 * 24 * 60 * 60 * 1000;
    for (let n = 0; n < 46; n++) {
      assert.equal(weeklyTheme(start + n * week), legacy[n % 4], `week ${n}`);
      assert.equal(weeklyTheme(start + n * week + week - 1), legacy[n % 4], `end of week ${n}`);
    }
  });

  it("uses the first order before the first epoch and the fallback for bad input", () => {
    assert.equal(weeklyTheme(at("2025-12-31T00:00:00+07:00")), "constellation");
    assert.equal(weeklyTheme(Number.NaN), HUB_FALLBACK);
    assert.equal(weeklyTheme(Number.POSITIVE_INFINITY), HUB_FALLBACK);
    assert.equal(weeklyTheme(NOW, []), HUB_FALLBACK);
  });

  it("rotates a custom epoch list", () => {
    const epochs = [{ from: "2030-01-07T07:00:00+07:00", order: ["firefly", "skyglass"] as const }];
    assert.equal(weeklyTheme(at("2030-01-07T07:00:00+07:00"), epochs), "firefly");
    assert.equal(weeklyTheme(at("2030-01-14T07:00:00+07:00"), epochs), "skyglass");
    assert.equal(weeklyTheme(at("2030-01-21T07:00:00+07:00"), epochs), "firefly");
  });
});

describe("resolveTheme", () => {
  it("prefers a known ?theme= value without touching the stored override", () => {
    assert.deepEqual(resolveTheme({ param: "firefly", stored: "skyglass", session: null, nowMs: NOW }), {
      key: "firefly",
      source: "param",
      invalidStored: false,
    });
    assert.deepEqual(resolveTheme({ param: "firefly", stored: null, nowMs: NOW }), {
      key: "firefly",
      source: "param",
      invalidStored: false,
    });
  });

  it("ignores an unknown ?theme= value", () => {
    for (const param of ["sky", "", "FIREFLY", "auto"]) {
      assert.deepEqual(resolveTheme({ param, stored: null, session: null, nowMs: NOW }), {
        key: "mothlight",
        source: "weekly",
        invalidStored: false,
      });
    }
  });

  it("uses a stored enabled key", () => {
    assert.deepEqual(resolveTheme({ param: null, stored: "constellation", session: "firefly", nowMs: NOW }), {
      key: "constellation",
      source: "stored",
      invalidStored: false,
    });
  });

  it("reports an invalid stored value so the caller removes it", () => {
    for (const stored of ["orbit", "", "Pages-Stars"]) {
      assert.deepEqual(resolveTheme({ param: null, stored, session: null, nowMs: NOW }), {
        key: "mothlight",
        source: "weekly",
        invalidStored: true,
      });
    }
    assert.equal(resolveTheme({ param: "firefly", stored: "orbit", nowMs: NOW }).invalidStored, true);
  });

  it("falls back to the in-memory session override, then to the week", () => {
    assert.deepEqual(resolveTheme({ param: null, stored: null, session: "skyglass", nowMs: NOW }), {
      key: "skyglass",
      source: "session",
      invalidStored: false,
    });
    assert.deepEqual(resolveTheme({ param: null, stored: null, session: "nope", nowMs: NOW }), {
      key: "mothlight",
      source: "weekly",
      invalidStored: false,
    });
    assert.deepEqual(resolveTheme({ nowMs: at("2026-11-23T07:00:00+07:00") }), {
      key: "pages-stars",
      source: "weekly",
      invalidStored: false,
    });
  });
});

describe("theme-core source", () => {
  const source = readFileSync(new URL("./theme-core.mjs", import.meta.url), "utf8");

  it("survives export stripping for raw inlining", () => {
    const stripped = source.replace(/^export /gm, "");
    assert.doesNotMatch(stripped, /^\s*(import|export)\b/m);
    const fn = new Function(`${stripped}\nreturn { weeklyTheme, resolveTheme, themeByKey };`);
    const api = fn() as { weeklyTheme: (ms: number) => string };
    assert.equal(api.weeklyTheme(NOW), "mothlight");
  });

  it("holds no novel data", () => {
    assert.doesNotMatch(source, /_novels|titleEn|"sea"/);
  });

  it("stays small once comments are stripped (bridge budget, 8.4 item 24)", () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\n\s*\n/g, "\n");
    const gzip = gzipSync(code).length;
    assert.ok(gzip <= 900, `theme-core is ${gzip} bytes gzip without comments`);
  });
});

describe("hub theme copy", () => {
  it("has one row per registry key, in registry order", () => {
    assert.deepEqual(
      HUB_THEME_COPY.map((row) => row.key),
      HUB_THEMES.map((row) => row.key),
    );
  });

  it("fills every field with Thai text and starts hit labels with กด", () => {
    for (const row of HUB_THEME_COPY) {
      for (const field of ["placeTh", "blurbTh", "tryTh", "stageHitTh", "midHitTh"] as const) {
        assert.match(row[field], /^[฀-๿]/, `${row.key}.${field}`);
      }
      assert.ok(row.stageHitTh.startsWith("กด"), row.key);
      assert.ok(row.midHitTh.startsWith("กด"), row.key);
    }
  });
});
