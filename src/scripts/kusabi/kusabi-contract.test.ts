// Guards the promises of the rework that a reader would notice only when broken.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import sharp from "sharp";
import { CHARACTER_TIERS, PUBLIC_CARDS } from "../../data/kusabi/characters";
import { MOMENTS } from "../../data/kusabi/moments";
import { MOMENT_GROUPS } from "../../data/kusabi/unlocks";

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
        assert.doesNotMatch(line, /data\/kusabi\/(characters|case-map|vault|epigraphs|extra-narration|moments)/, `${path} imports ${line}`);
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

describe("character files", () => {
  const order = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10", "t11", "t12", "t13", "e1", "e2", "e3", "e4"];
  /** The first tier a word may appear in, and the tiers it may not appear in before that. */
  const firstAllowed: Array<[string, string]> = [
    ["คนสวมหน้ากาก", "t10"],
    ["ชิอง มาโดกะ", "t12"],
    ["อายาเมะ", "t13"],
    ["ฮิราซากะ", "e1"],
    ["ผู้ช่วยวิจัย", "e2"],
    ["คู่รักที่มาหลบฝน", "e4"],
  ];

  it("has a vault file behind every tier", () => {
    assert.deepEqual(Object.keys(CHARACTER_TIERS).sort(), [...order].sort());
    const script = read("src/scripts/kusabi/characters.ts");
    for (const tier of order) assert.ok(script.includes(`["${tier}", "`), `${tier} is not in TIER_ORDER`);
  });

  it("only changes a file that is already open by that chapter", () => {
    const open = new Set(PUBLIC_CARDS.map((card) => card.id));
    for (const tier of order) {
      const data = CHARACTER_TIERS[tier];
      for (const card of data.cards ?? []) {
        for (const id of card.replaces ?? []) open.delete(id);
        open.add(card.id);
      }
      for (const update of data.updates ?? []) assert.ok(open.has(update.card), `${tier} updates ${update.card}`);
      for (const note of data.notes ?? []) assert.ok(open.has(note.card), `${tier} notes ${note.card}`);
    }
  });

  it("does not name anyone before the chapter that reveals them", () => {
    for (const [word, first] of firstAllowed) {
      for (const tier of order.slice(0, order.indexOf(first))) {
        assert.ok(!JSON.stringify(CHARACTER_TIERS[tier]).includes(word), `${tier} says ${word}`);
      }
    }
  });

  it("keeps guest rows generic, because their labels are in the first page a reader sees", () => {
    for (const card of PUBLIC_CARDS) {
      assert.deepEqual(card.fields?.map((field) => field.label), ["อายุ", "ชั้นปี", "ส่วนสูง", "ห้องพัก", "ติดตัว", "นิสัย", "กลัวอะไร", "ไม่ได้บอกใคร"]);
    }
  });
});

describe("images", () => {
  // The author keeps the source sheets here. astro.config.mjs removes them from every
  // build and verify-kusabi-dist.ts proves it, so only the rest may ship.
  const SOURCE_ART = /images[\\/](characters|extra|home-hero)/;
  const images = walk("public/assets/kusabi/images");
  const shipped = images.filter((path) => !SOURCE_ART.test(path));

  it("ships no draft sheet, no fifties pose and no revealing file name", () => {
    assert.ok(shipped.length > 0);
    for (const path of shipped) {
      assert.doesNotMatch(path, /50s|draft|shion|killer|adult|boat|twins|wedding|ayame|hero/i, path);
    }
  });

  it("keeps the source images in the author's folder and out of the build", () => {
    for (const path of ["characters/drafts-v2/shion-madoka-killer-draft-v2.png", "characters/drafts-v2/kaito-sakuraba-draft-v2.webp", "extra/arai-ryoya-50s-poses.webp", "extra/moments/cast-02-five-pairs.webp", "home-hero-v2.webp"]) {
      assert.ok(existsSync(join(root, "public/assets/kusabi/images", path)), path);
    }
    assert.match(read("astro.config.mjs"), /KUSABI_SOURCE_ART = \["characters", "extra", "home-hero\.webp", "home-hero-v2\.webp"\]/);
  });

  it("holds the pictures of the characters' future back from the site", () => {
    assert.ok(!images.some((path) => /[\\/]album[\\/]/.test(path)), "the album is back");
    for (const path of ["risa-kaito-wedding-short-hair-special-1dea97b4.webp", "misaki-twins-special-aa2d8800.webp", "site-crops/a01.webp", "site-crops/s05.webp"]) {
      assert.ok(existsSync(join(root, "public/assets/kusabi/images/extra", path)), path);
    }
    assert.doesNotMatch(read("src/data/kusabi/vault.ts"), /album\/|images\/extra/);
  });

  it("keeps everything in the extra folder as WebP", () => {
    assert.deepEqual(images.filter((path) => path.includes("/images/extra/") && !path.endsWith(".webp")), []);
  });

  it("gives each picture outside the book a neutral file, a frame of its shape and a caption from the drafts", async () => {
    const drafts = ["arc1/chapter_01.md", "arc3/epilogue.md", "extra/e01.md"].map((path) => read(`src/plan/kusabi-house/work/drafts/${path}`)).join("\n");
    assert.equal(MOMENT_GROUPS.flatMap((group) => group.ratios).length, 9);
    for (const group of MOMENT_GROUPS) {
      const pictures = MOMENTS[group.file];
      assert.equal(pictures.length, group.ratios.length, group.file);
      for (const [index, picture] of pictures.entries()) {
        assert.match(picture.src, /^\/assets\/kusabi\/images\/gallery\/m\d{2}\.webp$/);
        const { width, height } = await sharp(join(root, "public", picture.src)).metadata();
        assert.ok(Math.abs(Number(width) / Number(height) - group.ratios[index]) < 0.01, `${picture.src} is ${width}x${height}`);
        assert.ok(drafts.includes(picture.caption), picture.caption);
      }
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
