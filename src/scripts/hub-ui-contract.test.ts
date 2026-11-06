import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { NOVELS } from "../data/_novels";

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
    const imagePath = "public/assets/sea/images/hub-sea-dark-adventure.webp";

    assert.equal(existsSync(projectPath(imagePath)), true, `${imagePath} should exist`);
    assert.ok(statSync(projectPath(imagePath)).size > 50_000, `${imagePath} should be a real generated image`);
    assert.match(novels, /hub-sea-dark-adventure\.(png|webp)/);
    assert.match(novels, /ดาร์กแฟนตาซี · ผจญภัย/);
    assert.doesNotMatch(novels, /hero-sea\.(png|webp)/);
    assert.match(manifest, /hub-sea-dark-adventure\.(png|webp)/);
    assert.match(manifest, /no author name or in-image text/);
  });

  it("publishes every novel but Sea, and the locked card names no English title", () => {
    const novelCard = readProjectFile("src/components/_shared/NovelCard.astro");

    assert.deepEqual(
      NOVELS.filter((novel) => novel.status !== "เผยแพร่").map((novel) => novel.slug),
      ["sea"],
    );
    assert.match(novelCard, /useImage \? \(/);
    assert.doesNotMatch(novelCard, /<script/);
    const locked = novelCard.slice(novelCard.indexOf('class="novel-card is-disabled"'));
    assert.doesNotMatch(locked, /titleEn/);
    assert.match(locked, /ยังไม่เปิดให้อ่าน/);
  });

  it("adds restrained shooting stars to the hub background without overwhelming the constellation field", () => {
    const core = readProjectFile("src/scripts/hub/lightfall-core.ts");
    const scene = readProjectFile("src/scripts/hub/lightfall-scene.ts");

    assert.match(scene, /interface ShootingStar/);
    assert.match(scene, /nextShootingStarAt/);
    assert.match(scene, /drawShootingStar/);
    assert.match(scene, /reducedMotionFrame/);
    assert.match(core, /SHOOTING_STAR_MIN_S = 5/);
    assert.match(core, /SHOOTING_STAR_MAX_S = 9/);
  });
});
