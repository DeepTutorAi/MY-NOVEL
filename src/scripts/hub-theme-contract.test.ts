// Hub theme contract (spec 5.2 as amended by 8.3 items 5 and 7 and 8.4 item 30).
// The phase-A subset runs by default. The phase-B blocks run when HUB_PHASE=B is
// set or when all five theme CSS files exist. File hashes are not pinned here:
// src/scripts/hub/qa/verify-untouched.ts checks them during integration.

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

import { HUB_THEME_COPY } from "../data/hub/themes";
import { NOVELS, UPCOMING_NOVELS } from "../data/_novels";
import { HUB_THEMES, lowerFirst } from "./hub/theme-core.mjs";
import type { HubThemeKey } from "./hub/world/types";
import { parseCss } from "./hub/qa/css";
import { MECHANICS, MECHANICS_BY_THEME, MECHANICS_SELF_REPORTED, mechanicsGaps } from "./hub/qa/mechanics";
import { lintThemeCss, selectorsOf } from "./hub/qa/theme-lint";

const root = process.cwd();
const abs = (path: string) => join(root, path);
const read = (path: string) => readFileSync(abs(path), "utf8");
const rel = (path: string) => relative(root, path).replaceAll("\\", "/");

const HUB_CSS = "src/styles/_shared/hub.css";
const FIXTURES = "src/scripts/hub/world/__fixtures__/page-snapshots.json";
const CAPTURE = "src/scripts/hub/qa/capture-fixtures.ts";
const themeCssPath = (key: HubThemeKey) => `src/styles/_shared/hub-themes/${key}.css`;
const componentPath = (key: HubThemeKey) =>
  `src/components/_shared/${key.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("")}Background.astro`;

const PHASE_B = process.env.HUB_PHASE === "B" || HUB_THEMES.every((row) => existsSync(abs(themeCssPath(row.key))));
const phaseB = PHASE_B ? false : "phase B: runs with HUB_PHASE=B or once all five theme CSS files exist";

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const scriptBlocks = (astro: string) => [...astro.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");

/** Client files as defined in 2.19, with their scanned text. */
function clientFiles(): { path: string; text: string }[] {
  const scripts = walk(abs("src/scripts/hub"))
    .map(rel)
    .filter((path) => /\.(ts|mts|mjs|js)$/.test(path))
    .filter((path) => !path.startsWith("src/scripts/hub/qa/") && !path.includes("/__fixtures__/") && !/\.test\.ts$/.test(path))
    .map((path) => ({ path, text: read(path) }));
  const hubComponents = [
    ...walk(abs("src/components/_shared")).map(rel).filter((path) => /^src\/components\/_shared\/Hub[^/]*\.astro$/.test(path)),
    ...walk(abs("src/components/_shared/hub")).map(rel).filter((path) => path.endsWith(".astro")),
  ].map((path) => ({ path, text: read(path) }));
  const backgrounds = HUB_THEMES.map((row) => componentPath(row.key))
    .filter((path) => existsSync(abs(path)))
    .map((path) => ({ path: `${path} <script>`, text: scriptBlocks(read(path)) }));
  return [...scripts, ...hubComponents, ...backgrounds];
}

/** The Sea English title and its distinctive parts, read from the novel data, never written here. */
function seaTitleNeedles(): string[] {
  const title = NOVELS.find((novel) => novel.slug === ["s", "e", "a"].join(""))?.titleEn;
  assert.ok(title, "the Sea entry and its English title exist in _novels.ts");
  const words = title.split(/\s+/);
  const windows = words.slice(0, -2).map((_, i) => words.slice(i, i + 3).join(" "));
  return [...new Set([title, title.replace(/^The\s+/, ""), ...windows])];
}

describe("hub theme contract: registry (phase A)", () => {
  it("lists the five themes once each, in picker order, with their containers", () => {
    assert.deepEqual(
      HUB_THEMES.map((row) => row.key),
      ["pages-stars", "skyglass", "constellation", "mothlight", "firefly"],
    );
    for (const row of HUB_THEMES) assert.equal(row.container, `${row.key}-bg-container`);
  });

  it("keeps the four legacy key and bind pairs", () => {
    const pairs = Object.fromEntries(HUB_THEMES.map((row) => [row.key, row.bind]));
    assert.equal(pairs["pages-stars"], "PagesStarsBg");
    assert.equal(pairs.constellation, "DynamicCityBg");
    assert.equal(pairs.mothlight, "MothlightBg");
    assert.equal(pairs.firefly, "FireflyBg");
  });

  it("has Thai copy for every key in registry order, hit labels starting with กด", () => {
    assert.deepEqual(
      HUB_THEME_COPY.map((copy) => copy.key),
      HUB_THEMES.map((row) => row.key),
    );
    for (const copy of HUB_THEME_COPY) {
      assert.match(copy.stageHitTh, /^กด/, `${copy.key} stage label`);
      assert.match(copy.midHitTh, /^กด/, `${copy.key} mid label`);
    }
  });

  it("gives every key a container rule and a theme-only rule in hub.css", () => {
    const selectors = selectorsOf(parseCss(read(HUB_CSS)));
    for (const row of HUB_THEMES) {
      assert.ok(selectors.has(`:root[data-hub-theme="${row.key}"] #${row.container}`), `${row.key}: container rule`);
      assert.ok(selectors.has(`:root[data-hub-theme="${row.key}"] [data-theme-only="${row.key}"]`), `${row.key}: theme-only rule`);
    }
    assert.ok(selectors.has(":root:not([data-hub-theme]) #pages-stars-bg-container"), "no-JS fallback container rule");
  });

  it("gives every key a Background component with its bind, cleanup and initialized globals", () => {
    for (const row of HUB_THEMES) {
      const path = componentPath(row.key);
      assert.ok(existsSync(abs(path)), `${path} exists`);
      const source = read(path);
      const lf = lowerFirst(row.bind);
      for (const name of [`__bind${row.bind}`, `__${lf}Cleanup`, `__${lf}Initialized`]) {
        assert.ok(source.includes(name), `${path} defines ${name}`);
      }
    }
  });
});

describe("hub theme contract: Sea secrecy (phase A)", () => {
  const files = clientFiles();
  const needles = seaTitleNeedles();

  it("finds the client files", () => {
    assert.ok(files.some((file) => file.path === "src/scripts/hub/theme-core.mjs"), "theme-core.mjs is scanned");
    assert.ok(files.some((file) => file.path.endsWith("PagesStarsBackground.astro <script>")), "Background scripts are scanned");
    assert.ok(!files.some((file) => file.path.includes("/__fixtures__/")), "fixtures are not client files");
  });

  it("no client file imports the novel data or names an English title field", () => {
    for (const file of files) {
      assert.doesNotMatch(file.text, /_novels/, `${file.path} imports _novels`);
      assert.doesNotMatch(file.text, /titleEn/, `${file.path} names titleEn`);
    }
  });

  it("no client file contains the Sea English title or a part of it", () => {
    for (const file of files) {
      for (const needle of needles) assert.ok(!file.text.includes(needle), `${file.path} contains a part of the Sea English title`);
    }
  });

  it('no client file contains the string literal "sea"', () => {
    for (const file of files) assert.doesNotMatch(file.text, /(["'`])sea\1/, `${file.path} contains a "sea" literal`);
  });

  it("no client file reads .novel-card-kicker (8.4 item 30)", () => {
    for (const file of files) assert.ok(!file.text.includes("novel-card-kicker"), `${file.path} references novel-card-kicker`);
  });

  it("fixtures carry no English title and the capture script never reads the kicker (8.3 item 7)", (t) => {
    assert.ok(existsSync(abs(CAPTURE)), `${CAPTURE} exists`);
    assert.ok(!read(CAPTURE).includes("novel-card-kicker"), "the capture script reads .novel-card-kicker");
    if (!existsSync(abs(FIXTURES))) {
      t.skip(`${FIXTURES} is not captured yet (A4 runs pnpm hub:fixtures)`);
      return;
    }
    const fixtures = read(FIXTURES);
    for (const novel of [...NOVELS, ...UPCOMING_NOVELS]) {
      assert.ok(!fixtures.includes(novel.titleEn), `fixtures contain the English title of ${novel.slug}`);
    }
    for (const needle of needles) assert.ok(!fixtures.includes(needle), "fixtures contain a part of the Sea English title");
  });
});

describe("hub theme contract: interceptor and layouts (phase A)", () => {
  it("the interceptor renders the theme bridge", () => {
    assert.match(read("src/components/_shared/ProfileStorageInterceptor.astro"), /<HubThemeBridge\b/);
  });

  it("every base layout renders the interceptor", () => {
    const layouts = walk(abs("src/layouts")).map(rel).filter((path) => path.endsWith(".astro") && /<html\b/.test(read(path)));
    assert.ok(layouts.includes("src/layouts/HubLayout.astro"), "HubLayout is a base layout");
    for (const path of layouts) assert.match(read(path), /<ProfileStorageInterceptor\b/, `${path} renders the interceptor`);
  });

  it("only one per-profile prefix list exists in src", () => {
    const literal = ["const", "prefixes", "= ["].join(" ");
    const owners = walk(abs("src"))
      .map(rel)
      .filter((path) => /\.(ts|mts|mjs|js|astro)$/.test(path) && !/\.test\.ts$/.test(path))
      .filter((path) => read(path).includes(literal));
    assert.deepEqual(owners, ["src/components/_shared/ProfileStorageInterceptor.astro"]);
  });
});

describe("hub theme contract: time of day (phase A)", () => {
  it("no hub file sets data-time-of-day", () => {
    const hubFiles = [
      ...clientFiles(),
      ...["src/pages/index.astro", "src/layouts/HubLayout.astro", HUB_CSS].filter((path) => existsSync(abs(path))).map((path) => ({ path, text: read(path) })),
    ];
    for (const file of hubFiles) {
      assert.doesNotMatch(file.text, /time-of-day|timeOfDay/, `${file.path} touches the circadian attribute`);
    }
  });
});

describe("hub theme contract: lazy loading (phase B)", { skip: phaseB }, () => {
  it("no Background component or index.astro script statically imports a scene or the kit", () => {
    const staticImport = /import\s+(?:[^"'`;]*?\sfrom\s*)?["'][^"']*(?:-scene|world\/kit)(?:\.ts)?["']/;
    for (const row of HUB_THEMES) {
      const source = scriptBlocks(read(componentPath(row.key)));
      assert.doesNotMatch(source, staticImport, `${row.key}: static scene or kit import`);
      assert.match(source, /import\(/, `${row.key}: dynamic import`);
      assert.match(source, /\.catch\(/, `${row.key}: the dynamic import is guarded by .catch(`);
    }
    assert.doesNotMatch(scriptBlocks(read("src/pages/index.astro")), staticImport, "index.astro scripts");
  });

  it("each component imports its theme CSS and its Preload starts the import", () => {
    for (const row of HUB_THEMES) {
      const source = read(componentPath(row.key));
      assert.ok(source.includes(`styles/_shared/hub-themes/${row.key}.css`), `${row.key}: theme CSS import`);
      const lf = lowerFirst(row.bind);
      assert.ok(source.includes(`__${lf}Preload`), `${row.key}: __${lf}Preload`);
      assert.doesNotMatch(source, new RegExp(`__${lf}Preload\\s*=\\s*\\(\\)\\s*=>\\s*\\{\\s*\\}`), `${row.key}: Preload is still a no-op`);
    }
  });
});

describe("hub theme contract: theme CSS lint (phase B)", { skip: phaseB }, () => {
  for (const row of HUB_THEMES) {
    it(`${row.key}.css follows the theme CSS contract`, () => {
      assert.ok(existsSync(abs(themeCssPath(row.key))), `${themeCssPath(row.key)} does not exist`);
      const violations = lintThemeCss(row.key, read(themeCssPath(row.key)));
      assert.deepEqual(
        violations.map((v) => `${themeCssPath(row.key)}:${v.line} [${v.rule}] ${v.message}`),
        [],
      );
    });
  }
});

describe("hub theme contract: wipes (phase B)", { skip: phaseB }, () => {
  it("hub.css has a wipe rule for every key", () => {
    const selectors = [...selectorsOf(parseCss(read(HUB_CSS)))];
    for (const row of HUB_THEMES) {
      assert.ok(selectors.some((sel) => sel.includes(`[data-hub-switch="${row.key}"]`)), `${row.key}: wipe rule`);
    }
  });
});

describe("hub theme contract: per-theme QA files", () => {
  it("every row in qa/themes/<key>.ts names its own theme", () => {
    for (const row of HUB_THEMES) {
      const wrong = MECHANICS_BY_THEME[row.key].filter((m) => m.theme !== row.key);
      assert.deepEqual(
        wrong.map((m) => `${m.slot}: ${m.theme}`),
        [],
        `src/scripts/hub/qa/themes/${row.key}.ts`,
      );
    }
  });
});

describe("hub theme contract: mechanics (phase B)", { skip: phaseB }, () => {
  it("every theme fills M1-M12 with pointer, touch, keyboard and still entries (self-reported)", () => {
    assert.equal(MECHANICS_SELF_REPORTED, true);
    assert.deepEqual(
      mechanicsGaps(
        MECHANICS,
        HUB_THEMES.map((row) => row.key),
      ),
      [],
    );
  });
});
