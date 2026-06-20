import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

const musicCueIds = ["discovery", "reveal", "decision", "mountain", "ten-years"] as const;
const soundscapeIds = ["cassette-hiss", "distant-train", "mountain-wind"] as const;
const sfxIds = ["tape-click", "tape-rewind"] as const;

function projectPath(path: string): string {
  return join(root, path);
}

function readProjectFile(path: string): string {
  return readFileSync(projectPath(path), "utf8");
}

function assertFile(path: string): void {
  assert.equal(existsSync(projectPath(path)), true, `${path} should exist`);
}

function assertUsefulAsset(path: string): void {
  assertFile(path);
  assert.ok(statSync(projectPath(path)).size > 8_192, `${path} should be a real audio file, not a stub`);
}

describe("Tsukinomi P5 Walkman audio contract", () => {
  it("declares section-level music cues that match section frontmatter", () => {
    assertFile("src/data/tsukinomi/music-cues.ts");
    const cueData = readProjectFile("src/data/tsukinomi/music-cues.ts");

    for (const cueId of musicCueIds) {
      assert.match(cueData, new RegExp(`id:\\s*"${cueId}"`));
      assert.match(cueData, new RegExp(`srcBase:\\s*"/assets/tsukinomi/audio/music/${cueId}"`));
    }

    assert.match(cueData, /DEFAULT_MUSIC_CUE_ID:\s*MusicCueId\s*=\s*"discovery"/);
    assert.match(cueData, /getMusicCue/);
    assert.match(cueData, /nextMusicCue/);
    assert.match(cueData, /previousMusicCue/);

    const expectedBySection = new Map([
      [0, "discovery"],
      [1, "discovery"],
      [2, "reveal"],
      [3, "decision"],
      [4, "mountain"],
      [5, "ten-years"],
    ]);
    const contentDir = projectPath("src/content/tsukinomi/sections");

    for (const file of readdirSync(contentDir).filter((name) => name.endsWith(".md"))) {
      const markdown = readFileSync(join(contentDir, file), "utf8");
      const number = Number(markdown.match(/^number:\s*(\d+)/m)?.[1]);
      const cueId = markdown.match(/^musicCueId:\s*"([^"]+)"/m)?.[1];

      assert.equal(cueId, expectedBySection.get(number), `${file} should map to its P5 cue`);
    }
  });

  it("ships sourced music, soundscape, and SFX assets with documented license rows", () => {
    for (const cueId of musicCueIds) {
      assertUsefulAsset(`public/assets/tsukinomi/audio/music/${cueId}.mp3`);
      assertUsefulAsset(`public/assets/tsukinomi/audio/music/${cueId}.ogg`);
    }

    for (const soundscapeId of soundscapeIds) {
      assertUsefulAsset(`public/assets/tsukinomi/audio/soundscape/${soundscapeId}.mp3`);
      assertUsefulAsset(`public/assets/tsukinomi/audio/soundscape/${soundscapeId}.ogg`);
    }

    for (const sfxId of sfxIds) {
      assertUsefulAsset(`public/assets/tsukinomi/audio/sfx/${sfxId}.mp3`);
    }

    assertFile("public/assets/tsukinomi/audio/SOURCES.md");
    const sources = readProjectFile("public/assets/tsukinomi/audio/SOURCES.md");
    const manifest = readProjectFile("assets-manifest.md");

    assert.match(sources, /Pixabay Content License/);

    for (const assetId of [...musicCueIds, ...soundscapeIds, ...sfxIds]) {
      assert.match(sources, new RegExp(assetId));
      assert.match(sources, /pixabay\.com/);
    }

    for (const cueId of musicCueIds) {
      assert.match(manifest, new RegExp(`public/assets/tsukinomi/audio/music/${cueId}\\.mp3`));
      assert.match(manifest, new RegExp(`public/assets/tsukinomi/audio/music/${cueId}\\.ogg`));
    }

    for (const soundscapeId of soundscapeIds) {
      assert.match(manifest, new RegExp(`public/assets/tsukinomi/audio/soundscape/${soundscapeId}\\.mp3`));
      assert.match(manifest, new RegExp(`public/assets/tsukinomi/audio/soundscape/${soundscapeId}\\.ogg`));
    }

    for (const sfxId of sfxIds) {
      assert.match(manifest, new RegExp(`public/assets/tsukinomi/audio/sfx/${sfxId}\\.mp3`));
    }

    assert.match(manifest, /Pixabay Content License/);
  });

  it("keeps Walkman state namespaced away from Lodge audio", () => {
    assertFile("src/scripts/tsukinomi/walkman-state.ts");
    const state = readProjectFile("src/scripts/tsukinomi/walkman-state.ts");

    assert.match(state, /tsukinomi:audio:enabled/);
    assert.match(state, /tsukinomi:audio:volume/);
    assert.match(state, /tsukinomi:soundscape:cassette-hiss:enabled/);
    assert.match(state, /tsukinomi:soundscape:distant-train:enabled/);
    assert.match(state, /tsukinomi:soundscape:mountain-wind:enabled/);
    assert.match(state, /DEFAULT_VOLUME\s*=\s*0\.32/);
    assert.match(state, /FADE_IN_MS\s*=\s*4_000/);
    assert.match(state, /FADE_OUT_MS\s*=\s*2_000/);
    assert.match(state, /visibilitychange/);
    assert.match(state, /wasPlayingBeforeHidden/);
    assert.match(state, /new Howl/);
    assert.match(state, /html5:\s*false/);
    assert.match(state, /preload:\s*false/);
    assert.match(state, /this\.enabled\s*=\s*false/);
    assert.doesNotMatch(state, /hvitveldt:audio|hvitveldt:soundscape|AmbientAudio|soundscapeAudio/);
  });

  it("wires the Walkman UI to section cues, mobile access, and reel animation", () => {
    const requiredFiles = [
      "src/components/tsukinomi/audio/WalkmanPlayer.astro",
      "src/components/tsukinomi/reading/WalkmanCorner.astro",
    ];

    for (const file of requiredFiles) {
      assertFile(file);
    }

    const baseLayout = readProjectFile("src/layouts/tsukinomi/TsukinomiBaseLayout.astro");
    const sectionLayout = readProjectFile("src/layouts/tsukinomi/TsukinomiSectionLayout.astro");
    const topBar = readProjectFile("src/components/tsukinomi/navigation/TopBar.astro");
    const player = readProjectFile("src/components/tsukinomi/audio/WalkmanPlayer.astro");
    const corner = readProjectFile("src/components/tsukinomi/reading/WalkmanCorner.astro");

    assert.match(baseLayout, /WalkmanPlayer/);
    assert.match(baseLayout, /WalkmanCorner/);
    assert.match(sectionLayout, /data-music-cue=\{section\.data\.musicCueId\}/);
    assert.match(topBar, /data-walkman-mobile-trigger/);
    assert.match(player, /walkmanAudio/);
    assert.match(player, /data-soundscape="cassette-hiss"/);
    assert.match(player, /data-soundscape="distant-train"/);
    assert.match(player, /data-soundscape="mountain-wind"/);
    assert.match(player, /data-walkman-status/);
    assert.match(player, /data-audio-status/);
    assert.match(player, /audioStatus/);
    assert.match(player, /กำลังโหลดเพลง/);
    assert.match(player, /เล่นเพลงไม่ได้/);
    assert.match(player, /astro:page-load/);
    assert.match(player, /corner\.contains\(target\)/);
    assert.match(player, /mobileTrigger\.contains\(target\)/);
    assert.match(corner, /data-walkman-corner/);
    assert.match(corner, /walkman-led-pulse/);
    assert.match(corner, /walkman-reel/);
    assert.match(corner, /prefers-reduced-motion:\s*reduce/);
    assert.doesNotMatch(player, /hvitveldt:audio|AmbientPlayer/);
  });
});
