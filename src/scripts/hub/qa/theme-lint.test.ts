import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CssSyntaxError, collectTokens, parseCss, splitTopLevel, tokenize, walkRules } from "./css";
import { REQUIRED_TOKENS, lintThemeCss } from "./theme-lint";

const P = ':root[data-hub-theme="mothlight"]';

function tokenBlock(): string {
  const lines = REQUIRED_TOKENS.map((name) => {
    if (name === "--card-seal-text") return `  ${name}: "ยังอยู่ในดักแด้";`;
    if (name === "--hub-title-font") return `  ${name}: "Cormorant Garamond", var(--font-thai);`;
    return `  ${name}: #101010;`;
  });
  return `${P} .hub-page {\n  color-scheme: dark;\n${lines.join("\n")}\n}\n`;
}

const VALID = `${tokenBlock()}
@property --ml-glow { syntax: "<number>"; inherits: true; initial-value: 0; }
${P} .novel-card::before {
  content: "";
  position: absolute;
  inset: 0;
  opacity: calc(var(--w-glow) * 0.8);
  background: radial-gradient(circle at calc(var(--w-lx) * 100%) 50%, rgb(255 230 180 / .3), transparent);
}
${P} .upcoming-seal { font-size: 0; letter-spacing: 0; text-transform: none; }
${P} .upcoming-seal::before { content: var(--card-seal-text) / ""; font-size: .78rem; width: auto; height: auto; background: none; }
${P} .novel-card-kicker:lang(en) { text-transform: uppercase; }
@media (prefers-reduced-motion: no-preference) {
  ${P}[data-hub-motion="full"] .novel-card-wrapper[data-w-beat="a"] .novel-card::after { animation: ml-pulse-a 900ms ease-out; }
  ${P}[data-hub-motion="full"] .novel-card-wrapper[data-w-beat="b"] .novel-card::after { animation: ml-pulse-b 900ms ease-out; }
}
@keyframes ml-pulse-a { from { opacity: 0; } 35% { opacity: 1; } to { opacity: 0; } }
@keyframes ml-pulse-b { from { opacity: 0; } 35% { opacity: 1; } to { opacity: 0; } }
.hub-theme-swatch[data-swatch="mothlight"] { background: linear-gradient(#000, #123); }
.hub-page [data-hub-theme-preview="mothlight"] { --hub-bg: #06050b; }
`;

const rules = (css: string) => lintThemeCss("mothlight", css).map((v) => v.rule);

describe("hub qa css reader", () => {
  it("tokenizes around comments, strings and parentheses", () => {
    const tokens = tokenize('a { content: "x;}"; /* ; { */ background: url(data:image/svg+xml;utf8,<svg>) }');
    assert.deepEqual(
      tokens.map((t) => t.kind),
      ["text", "{", "text", ";", "text", "}"],
    );
  });

  it("parses rules, at-rules and declarations with line numbers", () => {
    const nodes = parseCss("a, b { color: red !important }\n@media (x) {\n  c { --t: 1px  2px; }\n}\n@import url(x.css);");
    const visits = walkRules(nodes);
    assert.equal(visits.length, 2);
    assert.deepEqual(visits[0].rule.selectors, ["a", "b"]);
    assert.equal(visits[0].rule.decls[0].important, true);
    assert.equal(visits[1].at[0].prelude, "(x)");
    assert.equal(visits[1].rule.line, 3);
    assert.equal(visits[1].rule.decls[0].value, "1px  2px");
  });

  it("rejects malformed input", () => {
    assert.throws(() => parseCss("a { color: red"), CssSyntaxError);
    assert.throws(() => parseCss("a { color: red } }"), CssSyntaxError);
    assert.throws(() => parseCss("color: red;"), CssSyntaxError);
  });

  it("splits only on top-level commas", () => {
    assert.deepEqual(splitTopLevel(':is(a, b) c, d[x="1,2"]'), [":is(a, b) c", 'd[x="1,2"]']);
  });

  it("collects tokens for a selector, normalising attribute quotes", () => {
    const nodes = parseCss(`:root[data-hub-theme=x] .hub-page { --a: 1; } @media (y) { :root[data-hub-theme="x"] .hub-page { --a: 2; } }`);
    assert.equal(collectTokens(nodes, [':root[data-hub-theme="x"] .hub-page']).get("--a"), "1");
  });
});

describe("hub theme css lint", () => {
  it("accepts a theme that follows the contract", () => {
    assert.deepEqual(lintThemeCss("mothlight", VALID), []);
  });

  it("requires the theme prefix and public parts", () => {
    assert.ok(rules(`${VALID}.hub-page .novel-card { color: red; }`).includes("selector-prefix"));
    assert.ok(rules(`${VALID}${P} .hub-shell { color: red; }`).includes("public-parts"));
    assert.ok(rules(`${VALID}${P} #hub-title { color: red; }`).includes("public-parts"));
    assert.ok(rules(`${VALID}.hub-page [data-hub-theme-preview="mothlight"] { color: red; }`).includes("preview-tokens"));
  });

  it("bans !important, root-absolute urls and focus overrides", () => {
    assert.ok(rules(`${VALID}${P} .novel-card { color: red !important; }`).includes("important"));
    assert.ok(rules(`${VALID}${P} .novel-card { background: url("/assets/x.png"); }`).includes("url"));
    assert.ok(rules(`${VALID}${P} .novel-card:focus-visible { outline: 0; }`).includes("focus"));
    assert.ok(rules(`${VALID}${P} .novel-card:focus-visible { box-shadow: none; }`).includes("focus"));
  });

  it("keeps animations behind the motion gates", () => {
    assert.ok(rules(`${VALID}${P} .hub-guide { animation: ml-flit-a 1s; }`).includes("animation-media"));
    assert.ok(rules(`${VALID}@media (prefers-reduced-motion: no-preference) { ${P} .hub-guide { animation: ml-pulse-a 1s; } }`).includes("animation-motion"));
  });

  it("checks beat keyframes: prefix, pairs, 600 ms and ramps", () => {
    const shortBeat = VALID.replace(/900ms/g, "400ms");
    assert.ok(rules(shortBeat).includes("beat-duration"));
    assert.ok(rules(`${VALID}@keyframes glow-a { to { opacity: 1; } }`).includes("keyframes-prefix"));
    assert.ok(rules(VALID.replace(/@keyframes ml-pulse-b[^\n]*\n/, "")).includes("beat-pair"));
    const steep = VALID.replace(/35%/g, "10%");
    assert.ok(rules(steep).includes("beat-ramp"));
  });

  it("keeps live variables on paint and composite properties", () => {
    assert.ok(rules(`${VALID}${P} .novel-card-body { padding-top: calc(var(--w-glow) * 4px); }`).includes("live-paint-only"));
    const derived = `${VALID}${P} .novel-card { --ml-lift: var(--card-read); }\n${P} .novel-card-title { margin-left: var(--ml-lift); }`;
    assert.ok(rules(derived).includes("live-paint-only"));
  });

  it("bans geometry on in-flow parts but not on absolute pseudo-elements", () => {
    assert.ok(rules(`${VALID}${P} .novel-card-title { font-size: 2rem; }`).includes("geometry"));
    assert.ok(rules(`${VALID}${P} .hub-profile-widget { border: 2px solid red; }`).includes("geometry"));
    assert.ok(!rules(`${VALID}${P} .hub-profile-widget { border: solid red; }`).includes("geometry"));
    assert.ok(rules(`${VALID}${P} .novel-card-title { letter-spacing: .1em; }`).includes("geometry"));
    assert.ok(rules(`${VALID}${P} .novel-card-title { font-family: serif; }`).includes("geometry"));
    assert.ok(rules(`${VALID}${P} .novel-card-media::before { content: ""; width: 10px; }`).includes("pseudo-absolute"));
  });

  it("keeps Thai text out of uppercase and small caps", () => {
    assert.ok(rules(`${VALID}${P} .novel-card-title { text-transform: uppercase; }`).includes("thai-text"));
    assert.ok(rules(`${VALID}${P} .novel-card-state { font-variant: small-caps; }`).includes("thai-text"));
  });

  it("requires every token, a Thai seal text, font tokens ending in the Thai font, and color-scheme", () => {
    assert.ok(rules(VALID.replace("  --hub-ink: #101010;\n", "")).includes("tokens"));
    assert.ok(rules(VALID.replace('"ยังอยู่ในดักแด้"', '"sealed"')).includes("tokens"));
    assert.ok(rules(VALID.replace('"Cormorant Garamond", var(--font-thai)', '"Cormorant Garamond", serif')).includes("font-token"));
    assert.ok(rules(VALID.replace("color-scheme: dark;", "")).includes("color-scheme"));
    assert.ok(rules(`${VALID}${P} .hub-page { --card-title-font: var(--font-thai); }`).includes("tokens"));
  });

  it("checks @property prefixes and reports parse errors", () => {
    assert.ok(rules(`${VALID}@property --glow { syntax: "<number>"; inherits: true; initial-value: 0; }`).includes("property-prefix"));
    assert.deepEqual(rules(`${VALID}${P} .novel-card {`), ["parse"]);
  });
});
