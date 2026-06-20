import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function projectPath(path: string): string {
  return join(root, path);
}

function readProjectFile(path: string): string {
  return readFileSync(projectPath(path), "utf8");
}

describe("Fiction hub visual contract", () => {
  it("uses a safe Sea hub image and labels the story as dark fantasy adventure", () => {
    const novels = readProjectFile("src/data/_novels.ts");
    const manifest = readProjectFile("assets-manifest.md");
    const imagePath = "public/assets/sea/images/hub-sea-dark-adventure.png";

    assert.equal(existsSync(projectPath(imagePath)), true, `${imagePath} should exist`);
    assert.ok(statSync(projectPath(imagePath)).size > 100_000, `${imagePath} should be a real generated image`);
    assert.match(novels, /hub-sea-dark-adventure\.png/);
    assert.match(novels, /ดาร์กแฟนตาซี · ผจญภัย/);
    assert.doesNotMatch(novels, /hero-sea\.png/);
    assert.match(manifest, /hub-sea-dark-adventure\.png/);
    assert.match(manifest, /no author name or in-image text/);
  });

  it("publishes Tsukinomi while keeping a counted Lodge/Extra hint", () => {
    const novels = readProjectFile("src/data/_novels.ts");
    const novelCard = readProjectFile("src/components/_shared/NovelCard.astro");

    assert.match(novels, /slug:\s*"tsukinomi"[\s\S]*status:\s*"เผยแพร่"/);
    assert.match(novelCard, /data-tsuki-card-hint-trigger/);
    assert.match(novelCard, /data-tsuki-card-hint-copy/);
    assert.match(novelCard, /HINT_COOLDOWN_MS = 5 \* 60 \* 1000/);
    assert.match(novelCard, /LODGE_SECRET_REQUIRED = 15/);
    assert.match(novelCard, /TSUKINOMI_SECRET_REQUIRED = 4/);
    assert.match(novelCard, /ตอนนี้/);
    assert.match(novelCard, /เหลืออีก/);
    assert.match(novelCard, /shouldGateCard/);
    assert.match(novelCard, /useImage \? \(/);
    assert.doesNotMatch(novelCard, /รอเปิดสถานี/);
  });

  it("adds restrained shooting stars to the hub background without overwhelming the constellation field", () => {
    const background = readProjectFile("src/components/_shared/ConstellationBackground.astro");

    assert.match(background, /interface ShootingStar/);
    assert.match(background, /nextShootingStarAt/);
    assert.match(background, /drawShootingStar/);
    assert.match(background, /prefers-reduced-motion: reduce/);
    assert.match(background, /randomBetween\(5_000, 9_000\)/);
  });
});
