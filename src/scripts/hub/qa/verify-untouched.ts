// Confirms the files the theme overhaul must not touch still hold their
// phase-A bytes. Run by the integration steps, not committed as a test, so the
// author can edit these files later without breaking the suite.
// Usage: tsx src/scripts/hub/qa/verify-untouched.ts

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PINNED: readonly [string, string][] = [
  ["src/scripts/_shared/scene-runtime.ts", "f7d20f045b861d0b3d923959960ab429569ddac8b5a9d87eaf8659fa7a4e588b"],
  ["src/components/_shared/NovelCard.astro", "2899a340ae2b6fb86e935893722b007985d224b0f363611bfc4b31c337a47fc4"],
  ["src/components/_shared/UpcomingNovelCard.astro", "4559680e52d001329b60e203a53a01d10dbe89438887e8040558ffcfe3d17b17"],
];

if (process.argv.includes("--help")) {
  console.log("usage: tsx src/scripts/hub/qa/verify-untouched.ts\nChecks the sha256 of the files the hub overhaul must not change.");
  process.exit(0);
}

let failed = 0;
for (const [path, expected] of PINNED) {
  const full = join(process.cwd(), path);
  if (!existsSync(full)) {
    console.error(`MISSING  ${path}`);
    failed++;
    continue;
  }
  const actual = createHash("sha256").update(readFileSync(full)).digest("hex");
  if (actual === expected) console.log(`ok       ${path}`);
  else {
    console.error(`CHANGED  ${path}\n  expected ${expected}\n  actual   ${actual}`);
    failed++;
  }
}
process.exit(failed ? 1 : 0);
