// What the character page and the Extra train must keep true at the source level.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { VaultTier } from "../../data/tsukinomi/characters";
import { buildVaultFiles } from "../../data/tsukinomi/vault";
import { STOP_CHAPTERS, TOTAL_CHAPTERS } from "./station-gates";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const PLATFORM_PAGE = read("src/pages/tsukinomi/characters.astro");
const EXTRA_PAGE = read("src/pages/tsukinomi/extra/index.astro");
const PLATFORM_CSS = read("src/styles/tsukinomi/platform.css");
const EXTRA_CSS = read("src/styles/tsukinomi/extra-train.css");

describe("spoilers stay in the vault", () => {
  it("is not imported by anything that reaches the browser", () => {
    for (const path of ["src/scripts/tsukinomi/platform.ts", "src/scripts/tsukinomi/extra-train.ts", "src/scripts/tsukinomi/station-gates.ts"]) {
      assert.doesNotMatch(read(path), /data\/tsukinomi\/vault/, path);
    }
    assert.doesNotMatch(PLATFORM_PAGE + EXTRA_PAGE, /data\/tsukinomi\/vault/);
  });

  it("shows a new reader only the narrator", () => {
    const publicData = read("src/data/tsukinomi/characters.ts");
    assert.match(publicData, /id: "haruto"/);
    for (const name of ["นาโอมิ", "ฮินะ", "อากิระ", "คาโอริ", "ทานากะ", "ยามาบะ", "วาตานาเบะ", "naomi", "hina", "akira", "kaori", "tanaka", "yamaba", "watanabe"]) {
      assert.ok(!publicData.includes(name), name);
      assert.ok(!PLATFORM_PAGE.includes(name), name);
    }
    assert.doesNotMatch(PLATFORM_PAGE + EXTRA_PAGE, /images\/train|images\/extra/);
  });

  it("keeps file names from telling who opens later", () => {
    const art = read("src/scripts/tsukinomi/process-art.ts");
    for (const sheet of art.matchAll(/out: "([^"]+)"/g)) assert.match(sheet[1], /^[fl]\d\d$/);
  });
});

describe("the route", () => {
  const files = buildVaultFiles() as unknown as Record<string, VaultTier>;
  const tiers = Array.from({ length: TOTAL_CHAPTERS }, (_, index) => files[`c${index + 1}`]);

  it("has a file for every chapter", () => {
    assert.ok(tiers.every((tier) => tier !== undefined));
  });

  it("opens each closed stop at the chapter its sign says", () => {
    const opening = tiers.flatMap((tier, index) => (tier.cards ?? []).map(() => index + 1));
    assert.deepEqual(opening, [...STOP_CHAPTERS]);
  });

  it("opens the people named in the author's order: narrator first, Watanabe and Yamaba well after", () => {
    const openedAt = (id: string) => tiers.findIndex((tier) => tier.cards?.some((card) => card.id === id)) + 1;
    assert.equal(openedAt("kaori"), 2);
    assert.equal(openedAt("tanaka"), 4);
    assert.equal(openedAt("yamaba"), 6);
    assert.equal(openedAt("watanabe"), 9);
  });

  it("never writes about someone before they are on the route", () => {
    const open = new Set(["haruto"]);
    tiers.forEach((tier, index) => {
      for (const card of tier.cards ?? []) open.add(card.id);
      for (const item of [...(tier.notes ?? []), ...(tier.updates ?? [])]) assert.ok(open.has(item.id), `chapter ${index + 1}: ${item.id}`);
    });
  });

  it("does not say Akihiro is Haruto's uncle before chapter 5 tells it", () => {
    const before = JSON.stringify(tiers.slice(0, 4));
    assert.ok(!before.includes("อาของ") && !before.includes("น้องชายแท้"));
    assert.equal(tiers[4].updates?.find((update) => update.id === "tanaka")?.role, "ครูพละ · อาของฮารุโตะ");
  });

  it("keeps bios to plain facts, with no words for character or mood", () => {
    const words = /นิสัย|บุคลิก|เงียบ|อ่อนโยน|สดใส|ร่าเริง|เข้มแข็ง|พูดน้อย|พูดเก่ง|ใจดี|หนักแน่น|ขี้กังวล|ซื่อสัตย์|คิดเยอะ|เศร้า|เสียดาย|โอตาคุ/;
    const later = (buildVaultFiles() as unknown as { later: unknown }).later;
    assert.doesNotMatch(JSON.stringify([tiers, later]) + read("src/data/tsukinomi/characters.ts"), words);
  });
});

describe("the source art never ships", () => {
  const servedFrom = ["src/pages", "src/components", "src/layouts", "src/data", "src/styles", "src/content/tsukinomi"];

  it("is removed from every build", () => {
    assert.match(read("astro.config.mjs"), /TSUKINOMI_SOURCE_ART = \["characters", "extra"\]/);
  });

  // A page asking for one of these would show a broken picture on the live site.
  it("is not asked for by anything the site serves", () => {
    const asked = servedFrom.flatMap((folder) =>
      readdirSync(join(process.cwd(), folder), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => join(entry.parentPath, entry.name))
        .filter((path) => /assets\/tsukinomi\/images\/(characters|extra)\//.test(readFileSync(path, "utf8"))),
    );
    assert.deepEqual(asked, []);
  });
});

describe("the fixed sky never covers the page", () => {
  // Unpositioned content is painted under a fixed layer: this hid the old Extra gate and page titles.
  it("lifts each page's content above it", () => {
    assert.match(PLATFORM_CSS, /\.pf\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*1/);
    assert.match(PLATFORM_CSS, /\.pf-head,\s*\.pf-route\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*1/);
    assert.match(EXTRA_CSS, /\.xt-gate\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*1/);
    assert.match(EXTRA_CSS, /\.xt-terminal\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*1/);
    assert.match(EXTRA_CSS, /\.xt-run\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*1/);
  });
});

describe("the site's reset does not win over the pages' own buttons", () => {
  it("scopes button rules under the page's class", () => {
    assert.match(PLATFORM_CSS, /\.pf \.pf-face\s*\{/);
    assert.match(PLATFORM_CSS, /\.pf \.pf-window img\s*\{/);
    assert.match(PLATFORM_CSS, /\.pf \.pf-ribbon\s*\{\s*display:\s*none/);
    assert.match(EXTRA_CSS, /\.xt \.xt-pic\s*\{/);
    assert.match(EXTRA_CSS, /\.xt-stop \.xt-stop-actions button\s*\{/);
  });
});
