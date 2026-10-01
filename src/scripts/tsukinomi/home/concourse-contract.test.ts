// Source rules for the /tsukinomi/ home concourse (design 4.4, 7 and 9.6): what
// the page must keep, what the new files may say, and that the script cleans up
// after itself. Pure source checks; the behaviour is in concourse.test.ts and
// concourse-core.test.ts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const PAGE = "src/pages/tsukinomi/index.astro";
const COMPONENTS = [
  "src/components/tsukinomi/home/Concourse.astro",
  "src/components/tsukinomi/home/DepartureBoard.astro",
  "src/components/tsukinomi/home/RailLine.astro",
] as const;
const SCRIPT = "src/scripts/tsukinomi/home/concourse.ts";
const CORE = "src/scripts/tsukinomi/home/concourse-core.ts";
const CSS = "src/styles/tsukinomi/home.css";

/** The hero section's markup in the page. */
const hero = (page: string) => {
  const start = page.indexOf('<section class="tsukinomi-home-hero"');
  const end = page.indexOf("</section>", start);
  assert.ok(start > -1 && end > start, "hero section");
  return page.slice(start, end);
};

/** Source with its comments blanked, so prose in them is never mistaken for copy. */
const withoutComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("the page keeps its hero", () => {
  const page = read(PAGE);

  it("has exactly one view-transition element, named as the hub card expects", () => {
    assert.equal((page.match(/transition:name=/g) ?? []).length, 1);
    assert.equal((page.match(/transition:name="novel-hero-tsukinomi"/g) ?? []).length, 1);
    assert.match(hero(page), /transition:name="novel-hero-tsukinomi"/);
  });

  it("keeps the plate, the copy, the four links and the resume card", () => {
    assert.match(page, /backgroundSlotId="hero-station"/);
    const markup = hero(page);
    for (const text of [
      "Tsukinomi no Eki",
      "สถานีทะเลพระจันทร์",
      "ค่ำฝนพาเด็กชายเข้าสถานีร้าง และพบเธอที่ยังนั่งรอขบวนรถไฟที่มาไม่ถึง",
      "เรื่องนี้เดินช้ากว่าเสียงฝนเล็กน้อย อุ่นกว่าความทรงจำเล็กน้อย และปล่อยให้ช่องว่างบางอย่างพูดแทนคำตอบ",
      "เริ่ม → ภาค 1",
      ">สารบัญ<",
      ">ตัวละคร<",
      ">Extra<",
      "data-tsuki-resume",
      "data-tsuki-resume-clear",
      "ล้างตำแหน่ง",
    ]) {
      assert.ok(markup.includes(text), `hero lost: ${text}`);
    }
    assert.match(page, /id="tsukinomi-main"/);
  });

  it("has one h1 and the concourse inside the main landmark, after the hero", () => {
    const main = page.slice(page.indexOf('<main id="tsukinomi-main"'), page.indexOf("</main>"));
    assert.equal((main.match(/<h1\b/g) ?? []).length, 1);
    assert.ok(main.indexOf("<Concourse") > main.indexOf("</section>"), "concourse after the hero");
  });
});

describe("the mount point for the passing train", () => {
  const markup = hero(read(PAGE));
  const mount = /<div\s[^>]*data-train-mount[^>]*><\/div>/.exec(markup)?.[0] ?? "";

  it("is an empty, aria-hidden container inside the hero, after the copy", () => {
    assert.ok(mount, "an empty <div data-train-mount ...></div> in the hero");
    assert.match(mount, /aria-hidden="true"/);
    assert.match(mount, /class="tsukinomi-home-train-mount"/);
    assert.ok(markup.indexOf("data-train-mount") > markup.indexOf("tsukinomi-home-copy"));
  });

  it("is styled to take no pointer, lie under the copy and cover the lower band", () => {
    const css = read(CSS);
    const rule = /\.tsukinomi-home-train-mount\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    assert.match(rule, /pointer-events:\s*none/);
    assert.match(rule, /position:\s*absolute/);
    assert.match(rule, /z-index:\s*0/);
    assert.match(rule, /width:\s*100vw/);
    assert.match(css, /\.tsukinomi-home-page \.tsukinomi-home-copy\s*\{[^}]*z-index:\s*1/);
  });

  it("is hidden where the train is skipped", () => {
    const css = read(CSS);
    const landscape = css.slice(css.indexOf("@media (orientation: landscape) and (max-height: 500px)"));
    assert.match(landscape, /\.tsukinomi-home-train-mount\s*\{[^}]*display:\s*none/);
  });
});

describe("the stylesheet", () => {
  const css = read(CSS);

  it("is imported by every component", () => {
    for (const path of COMPONENTS) assert.match(read(path), /import "\.\.\/\.\.\/\.\.\/styles\/tsukinomi\/home\.css"/, path);
  });

  it("has a reduced-motion branch that ends every animation", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    assert.ok(reduced.length > 0 && css.includes("@media (prefers-reduced-motion: reduce)"));
    assert.match(reduced, /animation:\s*none/);
    assert.match(reduced, /opacity:\s*1/);
    for (const name of ["tsuki-settle", "tsuki-colon", "tsuki-ring"]) {
      assert.ok(css.includes(`@keyframes ${name}`), name);
    }
  });

  it("keeps the concourse and the hero above the tint, which is the only fixed layer", () => {
    assert.match(css, /\.tsuki-concourse-tint\s*\{[^}]*position:\s*fixed[^}]*z-index:\s*0/);
    assert.match(css, /\.tsuki-concourse\s*\{[^}]*z-index:\s*1/);
    assert.equal((css.match(/position:\s*fixed/g) ?? []).length, 1, "only the tint is fixed");
    assert.match(css, /\.tsuki-concourse-tint\s*\{[^}]*pointer-events:\s*none/);
  });

  it("gives every row and hero action a 44 px touch target", () => {
    assert.match(css, /\.tsuki-concourse \.tsuki-board-link\s*\{[^}]*min-height:\s*4\.4rem/);
    assert.match(css, /\.tsukinomi-primary-link,\s*\.tsukinomi-home-page \.tsukinomi-secondary-link\s*\{[^}]*min-height:\s*44px/);
    assert.match(css, /\.tsukinomi-home-resume-actions button\s*\{[^}]*min-height:\s*44px/);
    // The short-landscape rows are 3.2rem = 51 px at the default size, still over 44.
    assert.match(css, /min-height:\s*3\.2rem/);
  });

  it("uses no WebGL and no canvas", () => {
    for (const path of [CSS, SCRIPT, CORE, ...COMPONENTS]) {
      assert.doesNotMatch(read(path), /webgl|getContext|<canvas|OffscreenCanvas/i, path);
    }
  });
});

describe("the script", () => {
  const script = read(SCRIPT);

  it("runs through onPage on Tsukinomi pages", () => {
    assert.match(script, /import \{ onPage \} from "\.\.\/\.\.\/_shared\/lifecycle"/);
    assert.match(script, /onPage\("tsukinomi-concourse", \{ bodyClass: "tsukinomi-page" \}, setupConcourse\)/);
  });

  it("removes every listener it adds, and disconnects what it observes", () => {
    const code = withoutComments(script);
    const added = (code.match(/\.addEventListener\(/g) ?? []).length;
    const removed = (code.match(/\.removeEventListener\(/g) ?? []).length;
    assert.ok(added >= 3, "it does attach listeners");
    assert.equal(added, removed, "addEventListener and removeEventListener must pair up");
    const observers = (code.match(/new IntersectionObserver\(/g) ?? []).length;
    assert.ok(observers >= 2, "it does observe");
    assert.ok((code.match(/\.disconnect\(\)/g) ?? []).length >= observers, "each observer is disconnected");
    assert.match(code, /cancelAnimationFrame/);
  });

  it("only reads storage", () => {
    assert.doesNotMatch(withoutComments(script), /setItem|removeItem|\.clear\(/);
    assert.doesNotMatch(withoutComments(read(CORE)), /setItem|removeItem|\.clear\(|localStorage|document\.|window\./);
  });

  it("makes no network request and reaches into no cutscene code", () => {
    for (const path of [SCRIPT, CORE]) {
      const code = withoutComments(read(path));
      assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|sendBeacon|https?:\/\//, path);
      assert.doesNotMatch(code, /cutscene/i, path);
    }
  });

  it("is only reachable from the concourse component", () => {
    assert.match(read("src/components/tsukinomi/home/Concourse.astro"), /import "\.\.\/\.\.\/\.\.\/scripts\/tsukinomi\/home\/concourse"/);
  });
});

describe("interface copy", () => {
  // Everything a reader can see that the plan allows as new copy (design 4.4 and
  // 9.6), plus phrases this page and the table of contents already use.
  const ALLOWED = new Set([
    "ขบวนสุดท้าย", // new: the departure board's last row (needs the author's approval)
    "สารบัญ", // existing: the table of contents' name, here the board's heading
    "บทนำ", // existing: the prologue's label in the table of contents
    "ภาค", // existing: "ภาค N", the part label in the table of contents
    "อ่านจบแล้ว", // existing: the resume card's finished state
    "อ่านค้างไว้", // existing: the resume card's reading state
  ]);

  it("adds no Thai text beyond the allowed phrases", () => {
    for (const path of [...COMPONENTS, SCRIPT, CORE]) {
      const code = withoutComments(read(path));
      // Thai runs, split on the spaces and digits that join phrases such as "ภาค 3".
      const found = new Set((code.match(/[฀-๿]+/g) ?? []).filter(Boolean));
      for (const text of found) assert.ok(ALLOWED.has(text), `${path} says "${text}", which is not allowed copy`);
    }
  });

  it("says the last row's words exactly", () => {
    assert.match(read(CORE), /LAST_TRAIN_TITLE = "ขบวนสุดท้าย"/);
    assert.match(read(CORE), /NO_TIME = "--:--"/);
  });
});

describe("assets", () => {
  it("references no asset beyond the illustrations folder the plan lists", () => {
    for (const path of [...COMPONENTS, SCRIPT, CORE, CSS]) {
      const refs = withoutComments(read(path)).match(/\/?assets\/[A-Za-z0-9_\-./]+/g) ?? [];
      for (const ref of refs) assert.ok(ref.includes("assets/tsukinomi/images/illustrations"), `${path} references ${ref}`);
    }
    const page = withoutComments(read(PAGE));
    assert.match(page, /ILLUSTRATIONS_PATH = "assets\/tsukinomi\/images\/illustrations"/);
  });
});
