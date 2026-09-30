import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Hub cards as portals into each novel", () => {
  it("gives each card's art the transition name of its novel's home hero", () => {
    const card = read("src/components/_shared/NovelCard.astro");
    assert.match(card, /transition:name=\{`novel-hero-\$\{novel\.slug\}`\}/);

    const heroes: Array<[string, string]> = [
      ["src/pages/lodge/index.astro", "lodge"],
      ["src/pages/tsukinomi/index.astro", "tsukinomi"],
      ["src/components/sea/home/AscentHero.astro", "sea"],
      ["src/pages/kusabi/index.astro", "kusabi"],
    ];
    for (const [path, slug] of heroes) {
      const source = read(path);
      const matches = source.match(new RegExp(`transition:name="novel-hero-${slug}"`, "g")) ?? [];
      assert.equal(matches.length, 1, `${path} must name exactly one hero element novel-hero-${slug}`);
    }

    const novels = read("src/data/_novels.ts");
    for (const [, slug] of heroes) assert.match(novels, new RegExp(`slug: "${slug}"`));
  });

  it("shows per-novel reading progress and a direct continue link on each card", () => {
    const card = read("src/components/_shared/NovelCard.astro");
    assert.match(card, /data-card-state/);
    assert.match(card, /data-card-progress/);
    assert.match(card, /data-card-continue/);
    // The continue link sits beside the card link, never inside it.
    assert.ok(card.indexOf("data-card-continue") > card.indexOf("</a>"), "continue link must follow the card's closing </a>");

    const resume = read("src/components/_shared/ResumeCard.astro");
    assert.match(resume, /const updateNovelCards = /);
    assert.match(resume, /candidate\.index >= 0/);
    for (const slug of ["lodge", "tsukinomi", "sea", "kusabi"]) {
      assert.match(resume, new RegExp(`slug: "${slug}"`));
    }
  });

  it("keeps the hero readable and the profile out of the first screen", () => {
    const hub = read("src/pages/index.astro");
    const topbar = hub.indexOf('class="hub-topbar"');
    const hero = hub.indexOf('class="hub-hero"');
    const widget = hub.indexOf("data-profile-widget");
    assert.ok(topbar > -1 && widget > topbar && widget < hero, "profile widget must live in the top bar above the hero");

    const css = read("src/styles/_shared/hub.css");
    assert.match(css, /\.hub-hero::before\s*\{/);
    assert.match(css, /ellipse closest-side/);
  });
});
