import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const resultsPath = join(root, "tsukinomi_handoff_results.md");

describe("Tsukinomi P7b handoff results contract", () => {
  it("records bounded rendered QA and Lighthouse evidence for every required route", () => {
    assert.equal(existsSync(resultsPath), true, "tsukinomi_handoff_results.md should exist");

    const results = readFileSync(resultsPath, "utf8");

    assert.match(results, /# Tsukinomi P7b QA Results/);
    assert.match(results, /Date:\s*2026-05-29/);
    assert.match(results, /No `pnpm preview` shell server was used/);
    assert.match(results, /Lighthouse mobile/i);
    assert.match(results, /Rendered QA/i);

    for (const route of [
      "/",
      "/tsukinomi/",
      "/tsukinomi/sections/01-discovery/",
      "/tsukinomi/sections/04-mountain/",
      "/lodge/chapters/01-arrival/",
    ]) {
      assert.equal(results.includes(`| \`${route}\` |`), true, `${route} should be reported`);
    }

    assert.match(results, /\| Performance \| Accessibility \| Status \|/);
    assert.match(results, /Resume card/);
    assert.match(results, /console error\/warning/i);
    assert.match(results, /PASS|BLOCKED/);
  });
});
