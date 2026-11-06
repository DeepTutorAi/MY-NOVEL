// The puzzle map and Extra pages get the graphite look only (design 8.3): the
// spoiler gate and the secret-read count stay as they were on main 0f6fa36, pinned
// here by hash, and both pages use the paper grain. The Extra page's hash changed
// once, on purpose, when its unlock moved to the shared developer key.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const scriptsHash = (source: string) =>
  createHash("sha256")
    .update([...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]).join("\n---\n"))
    .digest("hex");

describe("puzzle and Extra pages", () => {
  it("keep their gate and unlock scripts byte for byte", () => {
    assert.equal(scriptsHash(read("src/pages/lodge/puzzle.astro")), "4d40d9d7baf75975e06c3b06184a4581b4fcdca77af6a302d15aea6573fb43c0");
    assert.equal(scriptsHash(read("src/pages/lodge/extra/index.astro")), "2d3463a03da2848f384bc2a1a16ee3b8e3ed562cbd9bb3266af068ff9d4b9dc0");
  });

  it("wear the graphite paper of the rework", () => {
    assert.match(read("src/styles/lodge/polish.css"), /\.puzzle-shell[^{]*\{[^}]*var\(--paper-grain\)/);
    assert.match(read("src/pages/lodge/extra/index.astro"), /\.lodge-extra \{[^}]*var\(--paper-grain\)/);
  });
});
