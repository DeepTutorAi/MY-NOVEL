// The puzzle map and Extra pages get the graphite look only (design 8.3): the
// spoiler gate, the secret-read count and the unlock code stay exactly as they
// were on main 0f6fa36, pinned here by hash; and both pages use the paper grain.
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
    assert.equal(scriptsHash(read("src/pages/lodge/extra/index.astro")), "a858c7ffaa77f408e5bfcf1a7ea65e67cf91ecf82efabbabe374818b3c95a9a9");
  });

  it("wear the graphite paper of the rework", () => {
    assert.match(read("src/styles/lodge/polish.css"), /\.puzzle-shell[^{]*\{[^}]*var\(--paper-grain\)/);
    assert.match(read("src/pages/lodge/extra/index.astro"), /\.lodge-extra \{[^}]*var\(--paper-grain\)/);
  });
});
