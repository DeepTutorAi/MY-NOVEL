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
    assert.equal(scriptsHash(read("src/pages/lodge/puzzle.astro")), "9f0e8f702cdb049caf71bcdbe766844b0ac5075789d86f3b49f68f25d9b91451");
    assert.equal(scriptsHash(read("src/pages/lodge/extra/index.astro")), "ca4508e3690ae29fec9381395124ee4b8a3e8c73212fecb0e21a3148e5c3f613");
  });

  it("wear the graphite paper of the rework", () => {
    assert.match(read("src/styles/lodge/polish.css"), /\.puzzle-shell[^{]*\{[^}]*var\(--paper-grain\)/);
    assert.match(read("src/pages/lodge/extra/index.astro"), /\.lodge-extra \{[^}]*var\(--paper-grain\)/);
  });
});
