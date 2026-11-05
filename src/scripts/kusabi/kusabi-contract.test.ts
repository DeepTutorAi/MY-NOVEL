// Guards the promises of the rework that a reader would notice only when broken.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

function walk(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((entry) => {
    const path = `${dir}/${entry}`;
    return statSync(join(root, path)).isDirectory() ? walk(path) : [path];
  });
}

const CLIENT_SCRIPTS = walk("src/scripts/kusabi").filter((path) => path.endsWith(".ts") && !path.endsWith(".test.ts") && !/process-art|sync-extras|kusabi-e2e|verify-kusabi-dist/.test(path));
const PAGES = [...walk("src/pages/kusabi"), ...walk("src/layouts/kusabi"), ...walk("src/components/kusabi")];

describe("spoilers stay out of the first load", () => {
  it("keeps the build-only data out of client scripts", () => {
    for (const path of CLIENT_SCRIPTS) {
      const imports = read(path).match(/from "[^"]+"/g) ?? [];
      for (const line of imports) {
        if (/import type/.test(line)) continue;
        assert.doesNotMatch(line, /data\/kusabi\/(characters|case-map|vault|epigraphs)/, `${path} imports ${line}`);
      }
    }
  });

  it("never names the crossover anywhere in the Kusabi site code", () => {
    for (const path of [...PAGES, ...CLIENT_SCRIPTS, ...walk("src/data/kusabi")]) {
      if (/\.(webp|png|jpg)$/.test(path)) continue;
      assert.doesNotMatch(read(path), /hizumi|歪み|ฮิซุมิ/i, path);
    }
  });

  it("does not spoil the reveal on the pages a new reader sees", () => {
    for (const path of ["src/pages/kusabi/index.astro", "src/components/kusabi/home/TapeShelf.astro", "src/pages/kusabi/characters.astro", "src/pages/kusabi/case-map.astro"]) {
      assert.doesNotMatch(read(path), /ชิอง|ฆาตกร|อายาเมะ|ผู้ควบคุม/, path);
    }
    const hubCard = read("src/data/_novels.ts").split('slug: "kusabi"')[1];
    assert.doesNotMatch(hubCard, /ฆาตกร|ชิอง/);
    assert.doesNotMatch(hubCard, /home-hero/);
  });

  it("keeps public character cards free of the secret cast", () => {
    const source = read("src/data/kusabi/characters.ts").split("CHARACTER_TIERS")[0];
    assert.doesNotMatch(source, /ชิอง|อายาเมะ|หน้ากาก/);
  });
});

describe("images", () => {
  const images = walk("public/assets/kusabi/images");

  it("ships no draft sheet, no fifties pose and no revealing file name", () => {
    for (const path of images) {
      assert.doesNotMatch(path, /50s|draft|shion|killer|adult|boat|twins|wedding|ayame|hero/i, path);
    }
  });

  it("keeps every source image outside public", () => {
    for (const path of ["characters/drafts-v2/shion-madoka-killer-draft-v2.png", "extra/arai-ryoya-50s-poses.png", "legacy/home-hero-v2.webp"]) {
      assert.ok(existsSync(join(root, "output/kusabi-art-source", path)), path);
    }
  });

  it("links every chapter image to a file that exists", () => {
    for (const path of walk("src/content/kusabi/chapters")) {
      for (const match of read(path).matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
        const file = match[1].replace(/^(\.\.\/)+/, "");
        assert.ok(existsSync(join(root, file)), `${path}: ${file}`);
      }
    }
  });
});

describe("Extra arc", () => {
  it("marks E05 as a draft while the author has not decided", () => {
    assert.match(read("src/content/kusabi/extras/e05.md"), /^draft: true$/m);
    assert.match(read("src/data/kusabi/units.ts"), /id: "e05", number: 5, published: false/);
  });

  it("matches its drafts, so the site cannot drift from the source", () => {
    for (const id of ["e01", "e02", "e03", "e04", "e05"]) {
      const draft = read(`src/plan/kusabi-house/work/drafts/extra/${id}.md`).replace(/\r\n/g, "\n");
      const body = draft.replace(/^# E\d+:\s*.+\n+.+\n+/, "").trimEnd();
      const page = read(`src/content/kusabi/extras/${id}.md`);
      assert.ok(page.endsWith(`${body}\n`), `${id} is out of date: run pnpm kusabi:sync`);
    }
  });
});

describe("reading progress", () => {
  it("keeps every storage key old readers already have", () => {
    const core = read("src/scripts/kusabi/progress-core.ts");
    for (const key of ['"kusabi:secret:reads"', '"kusabi:extra-bypassed"', '"kusabi:reading:last"', '"kusabi:reading:last-read"', "`kusabi:reading:chapter:${id}`"]) {
      assert.ok(core.includes(key), key);
    }
  });

  it("stores new per-reader keys under prefixes the profile interceptor already covers", () => {
    const interceptor = read("src/components/_shared/ProfileStorageInterceptor.astro");
    assert.match(interceptor, /"kusabi:secret:"/);
    assert.match(interceptor, /"kusabi:reading:"/);
    assert.match(read("src/scripts/kusabi/progress-core.ts"), /CASE_MAP_KEY = "kusabi:secret:/);
    assert.match(read("src/scripts/kusabi/progress-core.ts"), /NOTICED_KEY = "kusabi:secret:/);
    assert.match(read("src/scripts/kusabi/characters.ts"), /SEEN_KEY = "kusabi:secret:/);
  });

  it("does not let an Extra chapter overwrite the place the hub resumes from", () => {
    assert.match(read("src/scripts/kusabi/reading/reader.ts"), /isExtra \? EXTRA_LAST_KEY : LAST_KEY/);
  });
});

describe("page quality", () => {
  it("has no inline style attributes left in Kusabi pages", () => {
    for (const path of PAGES.filter((file) => file.endsWith(".astro"))) {
      const withoutPlayer = read(path).replace(/style=\{[^}]*\}/g, "");
      if (path.endsWith("TapePlayer.astro")) continue;
      assert.doesNotMatch(withoutPlayer, /\sstyle="/, path);
    }
  });
});
