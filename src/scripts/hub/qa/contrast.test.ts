// Contrast contract (spec 2.20, 5.2, 8.3 item 9, 8.4 item 23). Parses each theme's
// token block, resolves it over the hub.css defaults as the cascade does, and
// composites every translucent layer over the theme's declared backdrops.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { NOVELS, UPCOMING_NOVELS } from "../../../data/_novels";
import { HUB_THEMES } from "../theme-core.mjs";
import type { HubThemeKey } from "../world/types";
import { collectTokens, parseCss, type Node } from "./css";
import { CONTRAST_BACKDROPS, type ThemeBackdrops } from "./contrast-backdrops";
import {
  clipToGamut,
  contrast,
  flatten,
  gamutMapCss,
  mixOklch,
  normalCdf,
  over,
  parseColor,
  plateCoverage,
  rgbaToOklch,
  toHex,
  withAlpha,
  type Rgba,
  type Vars,
} from "./color";

const root = process.cwd();
const HUB_CSS = "src/styles/_shared/hub.css";
const themeCssPath = (key: HubThemeKey) => `src/styles/_shared/hub-themes/${key}.css`;
const read = (path: string) => readFileSync(join(root, path), "utf8");

/** The six real accents named in 2.20; the test also checks they match the novel data. */
const SPEC_ACCENTS = ["#D2D7DF", "#ECA8B7", "#00F3C5", "#E53935", "#A99BFF", "#8CCFFF"];

const near = (actual: number, expected: number, eps: number, label: string) =>
  assert.ok(Math.abs(actual - expected) <= eps, `${label}: ${actual} is not within ${eps} of ${expected}`);

describe("contrast arithmetic", () => {
  it("computes WCAG contrast", () => {
    near(contrast(parseColor("#000"), parseColor("#fff")), 21, 1e-9, "black on white");
    near(contrast(parseColor("#777777"), parseColor("#ffffff")), 4.478, 0.002, "#777 on white");
  });

  it("parses the colour forms the tokens use, with var() substitution", () => {
    const vars: Vars = new Map([
      ["--pool", "8 7 6"],
      ["--a", ".5"],
      ["--x", "var(--y, #102030)"],
    ]);
    assert.deepEqual(toHex(parseColor("rgb(var(--pool) / var(--a))", vars)), "#08070680");
    assert.equal(toHex(parseColor("var(--x)", vars)), "#102030");
    assert.equal(toHex(parseColor("rgba(238, 232, 221, .14)")), "#eee8dd24");
    assert.equal(toHex(parseColor("hsl(0 100% 50%)")), "#ff0000");
    assert.throws(() => parseColor("var(--missing)", vars), /undefined variable/);
  });

  it("composites straight alpha source-over", () => {
    const mid = over(withAlpha(parseColor("#ffffff"), 0.5), parseColor("#000000"));
    near(mid.r, 0.5, 1e-9, "50% white over black");
    assert.equal(toHex(flatten(parseColor("#000"), parseColor("rgb(255 0 0 / .5)"), parseColor("rgb(0 0 255 / .5)"))), "#400080");
    assert.throws(() => flatten(parseColor("rgb(0 0 0 / .5)")), /opaque/);
  });

  it("converts sRGB to OKLCH like the CSS Color 4 sample code", () => {
    const red = rgbaToOklch(parseColor("#ff0000"));
    near(red.l, 0.62796, 1e-4, "red L");
    near(red.c, 0.25768, 1e-4, "red C");
    near(red.h, 29.2339, 1e-2, "red h");
    assert.ok(Number.isNaN(rgbaToOklch(parseColor("#808080")).h), "grey hue is powerless");
    assert.equal(toHex(parseColor("oklch(0.62796 0.25768 29.2339)")), "#ff0000");
  });

  it("reproduces color-mix(in oklch): shorter hue, missing percentages, powerless hue, alpha scale", () => {
    const mixed = rgbaToOklch(parseColor("color-mix(in oklch, red, blue)"));
    near(mixed.l, (0.62796 + 0.45201) / 2, 1e-4, "L");
    near(mixed.c, (0.25768 + 0.31321) / 2, 1e-4, "C");
    near(mixed.h, ((29.2339 + 360 + 264.052) / 2) % 360, 0.05, "h (shorter arc through 0)");
    const greyRed = mixOklch(rgbaToOklch(parseColor("#808080")), rgbaToOklch(parseColor("#ff0000")), 0.5);
    near(greyRed.h, 29.2339, 0.05, "achromatic side takes the other hue");
    // Reference values read from Chrome's computed style for these exact mixes (2026-11-18).
    const chrome: [string, [number, number, number]][] = [
      ["color-mix(in oklch, #E53935 55%, #eee8dd)", [0.75426, 0.122193, 27.0285]],
      ["color-mix(in oklch, #00F3C5 55%, #eee8dd)", [0.892203, 0.0984877, 172.378]],
      ["color-mix(in oklch, #8CCFFF 40%, #101010)", [0.434749, 0.0383444, 240.567]],
      ["color-mix(in oklch, #A99BFF 55%, #eee8dd)", [0.827754, 0.0854142, 288.881]],
    ];
    for (const [mix, [l, c, h]] of chrome) {
      const got = rgbaToOklch(parseColor(mix));
      near(got.l, l, 2e-4, `${mix} L`);
      near(got.c, c, 2e-4, `${mix} C`);
      near(got.h, h, 0.05, `${mix} h`);
    }
    const scaled = parseColor("color-mix(in oklch, red 30%, blue 30%)");
    near(scaled.a, 0.6, 1e-9, "sum below 100% scales alpha");
    const share = rgbaToOklch(parseColor("color-mix(in oklch, #ff0000 55%, #ffffff)"));
    near(share.c, 0.25768 * 0.55, 1e-4, "55% share of chroma against white");
  });

  it("maps out-of-gamut results back into sRGB", () => {
    const outside = parseColor("oklch(0.7 0.4 145)");
    assert.equal([outside.r, outside.g, outside.b].some((v) => v < 0 || v > 1), true);
    const mapped = gamutMapCss(outside);
    assert.ok([mapped.r, mapped.g, mapped.b].every((v) => v >= 0 && v <= 1));
  });

  it("models the Gaussian plate falloff at the edge and the corner", () => {
    near(normalCdf(0), 0.5, 1e-7, "CDF(0)");
    near(normalCdf(2.5), 0.99379, 1e-5, "CDF(2.5)");
    near(plateCoverage(45, 18, "edge"), 0.99379, 1e-5, "edge at 2.5 sigma");
    near(plateCoverage(45, 18, "corner"), 0.99379 ** 2, 1e-5, "corner at 2.5 sigma");
    near(plateCoverage(0, 18, "edge"), 0.5, 1e-7, "edge of the box");
  });

  it("uses the six accents of the novel data", () => {
    const accents = [...NOVELS, ...UPCOMING_NOVELS].map((novel) => novel.accent.toUpperCase());
    assert.deepEqual([...new Set(accents)].sort(), [...SPEC_ACCENTS].sort());
  });
});

/* ---------------------------------------------------------------- per-theme pairs */

interface Envs {
  page: Map<string, string>;
  card: (accent: string) => Map<string, string>;
}

function themeEnvs(key: HubThemeKey, base: Node[], theme: Node[]): Envs {
  const p = `:root[data-hub-theme="${key}"]`;
  // The base tokens sit on :where(.hub-root) at zero specificity, so a theme need not redeclare them.
  const rootEnv = new Map([
    ...collectTokens(base, [":where(.hub-root)", ":root[data-hub-theme]", ":root"]),
    ...collectTokens(theme, [p, `${p}.hub-root`]),
  ]);
  const page = new Map([
    ...rootEnv,
    ...collectTokens(base, [".hub-page"]),
    ...collectTokens(theme, [`${p} .hub-page`, `${p} body`, `${p} body.hub-page`]),
  ]);
  const baseCard = collectTokens(base, [".hub-page :is(.novel-card, .novel-card-continue)", ".hub-page .novel-card"]);
  const themeCard = collectTokens(theme, [
    `${p} .novel-card`,
    `${p} .hub-page .novel-card`,
    `${p} .hub-page :is(.novel-card, .novel-card-continue)`,
    `${p} :is(.novel-card, .novel-card-continue)`,
  ]);
  return {
    page,
    card: (accent) => new Map([...page, ...baseCard, ...themeCard, ["--novel-accent", accent]]),
  };
}

interface Finding {
  pair: string;
  ratio: number;
  min: number;
  detail: string;
}

/** Colour literals inside a fill (gradient stops or a plain colour). */
function colourStops(fill: string): string[] {
  const found = fill.match(/#[0-9a-f]{3,8}\b|(?:rgba?|hsla?|oklch|color-mix)\((?:[^()]|\([^()]*\))*\)/gi) ?? [];
  return found.length ? found : [fill];
}

function evaluateTheme(envs: Envs, bd: ThemeBackdrops): Finding[] {
  const out: Finding[] = [];
  const col = (name: string, env: Vars = envs.page) => parseColor(`var(${name})`, env);
  const check = (pair: string, ratio: number, min: number, detail: string) => out.push({ pair, ratio, min, detail });
  const opaque = (c: Rgba, under: Rgba) => (c.a >= 1 ? c : flatten(under, c));
  const text = (fg: Rgba, bg: Rgba) => contrast(opaque(fg, bg), bg);

  const pageBackdrops = bd.page.map((c) => parseColor(c));
  const heroBackdrops = bd.hero.map((c) => parseColor(c));
  const footerBackdrops = bd.footer.map((c) => parseColor(c));

  const surfaces: { name: string; colour: Rgba }[] = [];
  for (const [i, backdrop] of pageBackdrops.entries()) {
    surfaces.push({ name: `--card-body-bg over ${bd.page[i]}`, colour: opaque(col("--card-body-bg"), backdrop) });
    surfaces.push({ name: `--hub-panel over ${bd.page[i]}`, colour: opaque(col("--hub-panel"), backdrop) });
  }
  const pool = parseColor("rgb(var(--footer-pool) / var(--footer-pool-a))", envs.page);
  for (const [i, backdrop] of footerBackdrops.entries()) {
    surfaces.push({ name: `footer pool over ${bd.footer[i]}`, colour: flatten(backdrop, pool) });
  }
  for (const surface of surfaces) {
    for (const ink of ["--hub-ink", "--hub-muted", "--hub-faint"]) {
      check(`${ink} on ${surface.name}`, text(col(ink), surface.colour), 4.5, toHex(surface.colour));
    }
    if (surface.name.startsWith("--card-body-bg")) check(`--hub-ink on ${surface.name}`, text(col("--hub-ink"), surface.colour), 7, "ink on the card body");
    if (surface.name.startsWith("footer pool")) check(`--footer-ink on ${surface.name}`, text(col("--footer-ink"), surface.colour), 4.5, "footer text");
  }

  // Hero: backdrop, pool inner stop, then the haze plate where the theme has one.
  const heroPool = parseColor("rgb(var(--hub-pool) / var(--hub-pool-a))", envs.page);
  const plateFill = envs.page.get("--hub-hero-plate")?.trim();
  const plateStops = plateFill && plateFill !== "none" ? colourStops(plateFill).map((c) => parseColor(c, envs.page)) : [];
  if (plateStops.length && !bd.plate) {
    check("hero plate geometry", 0, 1, "--hub-hero-plate is set but contrast-backdrops declares no plate {extendPx, blurPx}");
  }
  for (const [i, backdrop] of heroBackdrops.entries()) {
    const under = flatten(backdrop, heroPool);
    const layers: { name: string; colour: Rgba }[] = [];
    if (plateStops.length && bd.plate) {
      for (const where of ["edge", "corner"] as const) {
        const cover = plateCoverage(bd.plate.extendPx, bd.plate.blurPx, where);
        for (const stop of plateStops) {
          layers.push({ name: `plate ${toHex(stop)} at the ${where} (${cover.toFixed(4)}) over ${bd.hero[i]}`, colour: over(withAlpha(stop, cover), under) });
        }
      }
    } else {
      layers.push({ name: `pool inner stop over ${bd.hero[i]}`, colour: under });
    }
    for (const layer of layers) {
      for (const ink of ["--hub-hero-ink", "--hub-hero-muted"]) {
        check(`${ink} on ${layer.name}`, text(col(ink), layer.colour), 4.5, toHex(layer.colour));
      }
    }
  }

  // Card accent ink for the six accents, with the color-mix arithmetic reproduced.
  for (const accent of SPEC_ACCENTS) {
    const env = envs.card(accent);
    const body = opaque(col("--card-body-bg", env), pageBackdrops[0]);
    const ink = col("--card-accent-ink", env);
    const ratio = Math.min(text(gamutMapCss(ink), body), text(clipToGamut(ink), body));
    check(`--card-accent-ink (${accent}) on --card-body-bg`, ratio, 4.5, `${toHex(ink)} on ${toHex(body)}`);
  }

  const pageBg = opaque(col("--hub-bg"), pageBackdrops[0]);
  check("--hub-accent-contrast on --hub-accent", text(col("--hub-accent-contrast"), opaque(col("--hub-accent"), pageBg)), 4.5, "button text");

  // Focus pair (8.3 item 9): outline against card body, page and cover edges; halo against the outline.
  const focus = col("--hub-focus");
  const halo = col("--hub-focus-halo-color");
  const focusGrounds = [
    ...pageBackdrops.map((b, i) => ({ name: `card body over ${bd.page[i]}`, colour: opaque(col("--card-body-bg"), b) })),
    { name: "page background", colour: pageBg },
    ...bd.coverEdges.map((c) => ({ name: `cover edge ${c}`, colour: parseColor(c) })),
  ];
  for (const ground of focusGrounds) {
    const outline = opaque(focus, ground.colour);
    check(`--hub-focus against ${ground.name}`, contrast(outline, ground.colour), 3, toHex(outline));
    check(`--hub-focus-halo-color against the outline on ${ground.name}`, contrast(opaque(halo, ground.colour), outline), 3, toHex(opaque(halo, ground.colour)));
  }
  return out;
}

describe("contrast pipeline on a synthetic theme", () => {
  const base = parseCss(`
    .hub-page { --hub-bg: #0a0908; --hub-ink: #eee8dd; --hub-muted: #a99f91; --hub-faint: #71695f; --hub-panel: #12100e;
      --hub-accent: #cf9a5e; --hub-accent-contrast: #0a0908; --hub-focus: #d7a061; --hub-focus-halo-color: #000000;
      --hub-pool: 8 7 6; --hub-pool-a: .8; --hub-hero-ink: var(--hub-ink); --hub-hero-muted: var(--hub-muted); --hub-hero-plate: none;
      --card-body-bg: var(--hub-panel); --card-accent-share: 55%; --footer-ink: #71695f; --footer-pool: 8 7 6; --footer-pool-a: .82; }
    .hub-page .novel-card { --card-accent-ink: color-mix(in oklch, var(--novel-accent) var(--card-accent-share), var(--hub-ink)); }
  `);
  const P = ':root[data-hub-theme="skyglass"]';
  const theme = parseCss(`
    ${P} .hub-page { --hub-faint: #8f877b; --card-body-bg: #000000; --hub-hero-plate: linear-gradient(rgb(20 26 40 / .9), rgb(20 26 40 / .7)); }
    ${P} .novel-card { --card-accent-share: 40%; }
  `);
  const bd: ThemeBackdrops = { page: ["#203040"], hero: ["#27344d", "#9db8d2"], footer: ["#101820"], coverEdges: ["#ffffff"], plate: { extendPx: 45, blurPx: 18 } };
  const findings = evaluateTheme(themeEnvs("skyglass", base, theme), bd);
  const find = (pair: string) => {
    const hit = findings.find((f) => f.pair === pair);
    assert.ok(hit, `no finding named "${pair}"`);
    return hit;
  };

  it("applies theme tokens over the base defaults, the way the cascade does", () => {
    near(find("--hub-ink on --card-body-bg over #203040").ratio, contrast(parseColor("#eee8dd"), parseColor("#000000")), 1e-9, "card body from the theme");
    near(find("--hub-faint on --hub-panel over #203040").ratio, contrast(parseColor("#8f877b"), parseColor("#12100e")), 1e-9, "faint from the theme, panel from the base");
  });

  it("collects the zero-specificity :where(.hub-root) block and the shared card block as base tokens", () => {
    const rootBase = parseCss(`
      :where(.hub-root) { --hub-ink: #eee8dd; --hub-panel: #12100e; }
      .hub-page :is(.novel-card, .novel-card-continue) { --card-accent-ink: color-mix(in oklch, var(--novel-accent) 55%, var(--hub-ink)); }
    `);
    const themeOnly = parseCss(`${P} { --hub-bg: #000000; }`);
    const envs = themeEnvs("skyglass", rootBase, themeOnly);
    assert.equal(envs.page.get("--hub-ink"), "#eee8dd");
    assert.equal(envs.page.get("--hub-bg"), "#000000");
    assert.equal(toHex(parseColor("var(--card-accent-ink)", envs.card("#E53935"))), toHex(parseColor("color-mix(in oklch, #E53935 55%, #eee8dd)")));
  });

  it("composites the footer pool over the declared ground", () => {
    const pool = flatten(parseColor("#101820"), parseColor("rgb(8 7 6 / .82)"));
    near(find("--footer-ink on footer pool over #101820").ratio, contrast(parseColor("#71695f"), pool), 1e-9, "footer ink");
  });

  it("puts the haze plate at its edge and corner coverage over every hero backdrop", () => {
    const under = flatten(parseColor("#9db8d2"), parseColor("rgb(8 7 6 / .8)"));
    const corner = plateCoverage(45, 18, "corner");
    const expected = over(withAlpha(parseColor("rgb(20 26 40 / .7)"), corner), under);
    const name = `--hub-hero-ink on plate ${toHex(parseColor("rgb(20 26 40 / .7)"))} at the corner (${corner.toFixed(4)}) over #9db8d2`;
    near(find(name).ratio, contrast(parseColor("#eee8dd"), expected), 1e-9, "corner of the lighter stop");
    assert.equal(findings.filter((f) => f.pair.startsWith("--hub-hero-ink on plate")).length, 2 * 2 * 2);
  });

  it("mixes the card accent ink from the theme's share for each accent", () => {
    const ink = parseColor("color-mix(in oklch, #E53935 40%, #eee8dd)");
    near(find("--card-accent-ink (#E53935) on --card-body-bg").ratio, contrast(ink, parseColor("#000000")), 1e-6, "accent ink");
    assert.equal(findings.filter((f) => f.pair.startsWith("--card-accent-ink")).length, 6);
  });

  it("checks the focus outline and the halo against it", () => {
    near(find("--hub-focus against cover edge #ffffff").ratio, contrast(parseColor("#d7a061"), parseColor("#ffffff")), 1e-9, "outline on a white cover edge");
    assert.ok(find("--hub-focus against cover edge #ffffff").ratio < 3, "a pale cover edge is reported against an amber outline");
    near(find("--hub-focus-halo-color against the outline on page background").ratio, contrast(parseColor("#000000"), parseColor("#d7a061")), 1e-9, "halo");
  });
});

describe("theme contrast pairs", () => {
  const baseNodes = existsSync(join(root, HUB_CSS)) ? parseCss(read(HUB_CSS)) : null;
  for (const row of HUB_THEMES) {
    const path = themeCssPath(row.key);
    const skip = !existsSync(join(root, path)) ? `skipped: ${path} does not exist yet (theme unit work, phase B)` : false;
    it(`${row.key}: every 2.20 pair meets its minimum over the declared backdrops`, { skip }, () => {
      assert.ok(baseNodes, `${HUB_CSS} is missing`);
      const bd = CONTRAST_BACKDROPS[row.key];
      assert.ok(bd, `${row.key}: declare its backdrops in src/scripts/hub/qa/contrast-backdrops.ts`);
      assert.ok(bd.page.length && bd.hero.length && bd.footer.length && bd.coverEdges.length, `${row.key}: every backdrop list needs at least one colour`);
      for (const c of [...bd.page, ...bd.hero, ...bd.footer, ...bd.coverEdges]) {
        assert.equal(parseColor(c).a, 1, `${row.key}: backdrop ${c} must be opaque`);
      }
      if (row.key === "skyglass") {
        assert.ok(bd.hero.map((c) => c.toLowerCase()).includes("#27344d"), "skyglass hero backdrops must include #27344d (5.2)");
        assert.ok(bd.plate, "skyglass declares its haze plate geometry");
        assert.ok(bd.plate.extendPx >= 2.5 * bd.plate.blurPx, `skyglass plate extends ${bd.plate.extendPx}px, at least 2.5 sigma (${2.5 * bd.plate.blurPx}px) is required (8.4 item 23)`);
      }
      const envs = themeEnvs(row.key, baseNodes, parseCss(read(path)));
      const failures = evaluateTheme(envs, bd).filter((f) => !(f.ratio >= f.min));
      assert.deepEqual(
        failures.map((f) => `${f.pair}: ${f.ratio.toFixed(2)} < ${f.min} (${f.detail})`),
        [],
      );
    });
  }
});
