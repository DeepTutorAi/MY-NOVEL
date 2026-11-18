// Theme CSS lint (spec 2.8, 2.9, 8.3 items 9 and 12, 8.4 items 1, 6, 7, 8 and 32).
// Pure: takes the theme key and the file text, returns every violation found.

import type { HubThemeKey } from "../world/types";
import { normalizeSelector, parseCss, parseTimeMs, splitTopLevel, walkAtRules, walkRules, type AtRule, type Decl, type Node } from "./css";

export const THEME_ABBREV: Record<HubThemeKey, string> = {
  "pages-stars": "lib",
  skyglass: "sg",
  constellation: "con",
  mothlight: "ml",
  firefly: "ff",
};

/** Tokens every theme must declare (2.6 as amended by 8.3 items 9 and 12 and 8.4 item 11). */
export const REQUIRED_TOKENS = [
  "--hub-bg", "--hub-ink", "--hub-muted", "--hub-faint", "--hub-line", "--hub-line-strong",
  "--hub-panel", "--hub-panel-strong",
  "--hub-accent", "--hub-accent-ink", "--hub-accent-contrast", "--hub-link-hover",
  "--hub-focus", "--hub-focus-halo-color", "--hub-select-bg", "--hub-select-ink",
  "--hub-pool", "--hub-pool-a", "--hub-pool-b", "--hub-hero-ink", "--hub-hero-muted",
  "--hub-title-font", "--hub-title-weight", "--hub-title-style", "--hub-title-tracking",
  "--hub-title-fill", "--hub-title-solid", "--hub-title-glow", "--hub-text-shadow",
  "--hub-side-bg", "--hub-side-border",
  "--card-radius", "--card-body-bg", "--card-border", "--card-border-hover", "--card-shadow", "--card-shadow-hover",
  "--card-media-bg", "--card-accent-share", "--card-progress-track",
  "--card-seal-ink", "--card-seal-text",
  "--resume-bg", "--resume-border", "--resume-ink", "--resume-action-bg", "--resume-action-border", "--resume-action-ink",
  "--chip-bg", "--chip-border", "--chip-ink",
  "--hit-label-bg", "--hit-label-ink",
  "--modal-overlay", "--modal-bg", "--modal-border",
  "--footer-ink", "--footer-pool", "--footer-pool-a",
  "--stage-hit-x", "--stage-hit-y", "--stage-hit-w", "--stage-hit-h",
  "--mid-hit-x", "--mid-hit-y", "--mid-hit-w", "--mid-hit-h",
] as const;

/** Tokens removed by the amendments; a theme may not set them. */
export const REMOVED_TOKENS = ["--card-title-font", "--hub-focus-halo"] as const;

/** Exact public classes (2.8). */
const PUBLIC_CLASSES = new Set([
  "hub-page", "hub-root", "hub-topbar", "hub-kicker", "hub-theme-btn", "hub-hero", "hub-title-group", "hub-side-note",
  "hub-pick-btn", "novel-card-wrapper", "novel-card", "novel-card-media", "novel-card-body", "novel-card-kicker",
  "novel-card-title", "novel-card-subtitle", "novel-card-meta", "novel-card-footer", "novel-card-state",
  "novel-card-action", "novel-card-progress", "novel-card-continue", "is-disabled", "is-upcoming", "upcoming-seal",
  "has-progress", "hub-window", "hub-window-stage", "hub-window-mid", "hub-window-ground", "hub-window-label",
  "hub-window-hit", "hub-guide", "hub-perch", "hub-world-label", "hub-modal-overlay", "btn-primary", "hub-theme-swatch",
  "profile-icon", "profile-name",
]);

/** Families covered by "and parts" / "and children" in 2.8. */
const PUBLIC_PREFIXES = ["hub-profile-", "resume-card", "hub-start", "hub-library-head", "hub-footer", "hub-modal-card", "modal-", "hub-picker", "hub-guide-"];

/** Live channel variables (2.9) that may feed paint and composite properties only. */
const LIVE_VAR = /var\(\s*(--w-[\w-]+|--card-read|--card-px|--card-py)\b/;

const PAINT_PROPS = /^(opacity|transform|translate|scale|rotate|filter|backdrop-filter|background(-[\w-]+)?|color|border(-(top|right|bottom|left|block|inline)(-(start|end))?)?-color|outline-color|box-shadow|text-shadow|(-webkit-)?mask(-[\w-]+)?|clip-path)$/;

/** Properties a theme may not set on in-flow parts (8.3 item 12). */
const GEOMETRY_PROPS = /^(font-size|line-height|padding(-[\w-]+)?|margin(-[\w-]+)?|width|height|min-[\w-]+|max-[\w-]+|inset(-[\w-]+)?|top|left|right|bottom|border(-(top|right|bottom|left|block|inline)(-(start|end))?)?-width|display|position|grid(-[\w-]+)?|flex(-[\w-]+)?|gap|row-gap|column-gap|font-family|font|word-spacing)$/;

const BORDER_SHORTHAND = /^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?$/;
const LENGTH = /(^|\s)(-?\d*\.?\d+(px|em|rem|vw|vh|svh|lvh|dvh|%|ch|ex)|0|thin|medium|thick)(\s|$)/;

const ALLOWED_AT = new Set(["media", "supports", "keyframes", "property"]);

export interface Violation {
  rule: string;
  line: number;
  message: string;
}

const PSEUDO = /::?(before|after)\b/;
const isPseudoSelector = (selector: string) => PSEUDO.test(selector);

/** Every class name in a selector, including those inside :is() and :not(). */
function classesOf(selector: string): string[] {
  return [...selector.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
}

function isPublicClass(name: string): boolean {
  return PUBLIC_CLASSES.has(name) || PUBLIC_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function animationNames(decl: Decl): string[] {
  if (decl.prop === "animation-name") return splitTopLevel(decl.value).filter((n) => n !== "none");
  if (decl.prop !== "animation") return [];
  return splitTopLevel(decl.value)
    .map((one) => one.split(/\s+/).find((part) => /^[A-Za-z_-][\w-]*$/.test(part) && !ANIMATION_KEYWORDS.has(part)) ?? "")
    .filter((name) => name && name !== "none");
}

const ANIMATION_KEYWORDS = new Set([
  "linear", "ease", "ease-in", "ease-out", "ease-in-out", "step-start", "step-end", "infinite", "normal", "reverse",
  "alternate", "alternate-reverse", "none", "forwards", "backwards", "both", "running", "paused",
]);

function animationDurations(decl: Decl): number[] {
  if (decl.prop === "animation-duration") return splitTopLevel(decl.value).map((t) => parseTimeMs(t) ?? 0);
  if (decl.prop !== "animation") return [];
  return splitTopLevel(decl.value).map((one) => {
    const first = one.split(/\s+/).map(parseTimeMs).find((t) => t !== null);
    return first ?? 0;
  });
}

function keyframeOffsets(at: AtRule): number[] {
  const offsets: number[] = [];
  for (const child of at.children ?? []) {
    if (child.type !== "rule") continue;
    for (const sel of child.selectors) {
      const s = sel.trim().toLowerCase();
      if (s === "from") offsets.push(0);
      else if (s === "to") offsets.push(1);
      else if (/^\d*\.?\d+%$/.test(s)) offsets.push(Number(s.slice(0, -1)) / 100);
    }
  }
  return [...new Set(offsets)].sort((a, b) => a - b);
}

export function lintThemeCss(key: HubThemeKey, css: string): Violation[] {
  const out: Violation[] = [];
  const add = (rule: string, line: number, message: string) => out.push({ rule, line, message });
  let nodes: Node[];
  try {
    nodes = parseCss(css);
  } catch (error) {
    return [{ rule: "parse", line: 0, message: (error as Error).message }];
  }
  const prefix = `:root[data-hub-theme="${key}"]`;
  const preview = `.hub-page [data-hub-theme-preview="${key}"]`;
  const swatch = `.hub-theme-swatch[data-swatch="${key}"]`;
  const abbrev = THEME_ABBREV[key];
  const norm = normalizeSelector;

  // At-rules: allowed kinds, @property and @keyframes names.
  const keyframes = new Map<string, AtRule>();
  for (const at of walkAtRules(nodes)) {
    if (!ALLOWED_AT.has(at.name)) add("at-rule", at.line, `@${at.name} is not allowed in theme CSS`);
    if (at.name === "property" && !at.prelude.startsWith(`--${abbrev}-`)) {
      add("property-prefix", at.line, `@property ${at.prelude} must use the prefix --${abbrev}-`);
    }
    if (at.name === "keyframes") {
      if (!at.prelude.startsWith(`${abbrev}-`)) add("keyframes-prefix", at.line, `@keyframes ${at.prelude} must use the prefix ${abbrev}-`);
      keyframes.set(at.prelude, at);
    }
  }
  for (const name of keyframes.keys()) {
    const beat = /^(.*)-(a|b)$/.exec(name);
    if (!beat) continue;
    const twin = `${beat[1]}-${beat[2] === "a" ? "b" : "a"}`;
    if (!keyframes.has(twin)) add("beat-pair", keyframes.get(name)?.line ?? 0, `@keyframes ${name} has no ${twin}`);
  }

  const visits = walkRules(nodes);
  const declared = new Map<string, string>();
  const absolutePseudo = new Set<string>();
  for (const { rule } of visits) {
    if (!isPseudoSelector(rule.selector)) continue;
    if (rule.decls.some((d) => d.prop === "position" && d.value === "absolute")) {
      for (const sel of rule.selectors) absolutePseudo.add(norm(sel));
    }
  }

  // Custom properties derived from live variables count as live too.
  const liveDerived = new Set<string>();
  for (let changed = true; changed; ) {
    changed = false;
    for (const { rule } of visits) {
      for (const d of rule.decls) {
        if (!d.prop.startsWith("--") || liveDerived.has(d.prop)) continue;
        const usesDerived = [...liveDerived].some((name) => new RegExp(`var\\(\\s*${name}\\b`).test(d.value));
        if (LIVE_VAR.test(d.value) || usesDerived) {
          liveDerived.add(d.prop);
          changed = true;
        }
      }
    }
  }
  const usesLive = (value: string) =>
    LIVE_VAR.test(value) || [...liveDerived].some((name) => new RegExp(`var\\(\\s*${name}\\b`).test(value));

  let colorScheme = false;
  for (const { rule, at, parents } of visits) {
    if (parents.length) add("nesting", rule.line, `nested rule "${rule.selector}" is not allowed`);
    const motionMedia = at.some((a) => a.name === "media" && /prefers-reduced-motion\s*:\s*no-preference/.test(a.prelude));
    const tokenOnly = rule.decls.every((d) => d.prop.startsWith("--"));

    for (const sel of rule.selectors) {
      const s = norm(sel);
      const ok = s.startsWith(prefix) || s.startsWith(preview) || s.startsWith(swatch);
      if (!ok) add("selector-prefix", rule.line, `selector "${sel}" must start with ${prefix}`);
      if (s.startsWith(preview) && !tokenOnly) add("preview-tokens", rule.line, `"${sel}" may only declare tokens`);
      for (const cls of classesOf(s)) {
        if (!isPublicClass(cls)) add("public-parts", rule.line, `".${cls}" in "${sel}" is not a public part (change request to U1)`);
      }
      if (/#[A-Za-z_][\w-]*/.test(s.replace(/\[[^\]]*\]/g, ""))) add("public-parts", rule.line, `id selector in "${sel}" (use the public classes)`);
    }

    const pseudo = rule.selectors.every((sel) => isPseudoSelector(sel));
    const exemptPseudo = pseudo && rule.selectors.every((sel) => absolutePseudo.has(norm(sel)));
    const seal = rule.selectors.every((sel) => /\.upcoming-seal(::?before)?$/.test(norm(sel)));
    const latin = rule.selectors.every((sel) => /:lang\(en\)|\[lang="en"\]|\.hub-title-group h1|\.novel-card-kicker/.test(norm(sel)));
    const focus = rule.selectors.some((sel) => sel.includes(":focus-visible"));

    if (pseudo && rule.decls.some((d) => d.prop === "content" && d.value !== "none") && !exemptPseudo && !seal) {
      add("pseudo-absolute", rule.line, `"${rule.selector}" allocates a pseudo-element that is not position: absolute`);
    }

    for (const d of rule.decls) {
      if (d.important) add("important", d.line, `!important on ${d.prop}`);
      if (d.prop.startsWith("--")) {
        declared.set(d.prop, d.value);
        if (/-font$/.test(d.prop) && !/var\(\s*--font-thai\s*\)\s*$/.test(d.value)) {
          add("font-token", d.line, `${d.prop} must end with var(--font-thai)`);
        }
      }
      if (d.prop === "color-scheme") colorScheme = true;
      if (d.prop === "animation" || d.prop === "animation-name") {
        const names = animationNames(d);
        if (names.length) {
          if (!motionMedia) add("animation-media", d.line, `animation in "${rule.selector}" is outside @media (prefers-reduced-motion: no-preference)`);
          if (!rule.selectors.every((sel) => norm(sel).includes('[data-hub-motion="full"]'))) {
            add("animation-motion", d.line, `animation in "${rule.selector}" needs [data-hub-motion="full"] in every selector`);
          }
        }
        if (rule.selector.includes("[data-w-beat")) {
          const durations = animationDurations(d.prop === "animation-name" ? (rule.decls.find((x) => x.prop === "animation-duration") ?? d) : d);
          names.forEach((name, index) => {
            const ms = durations[index] ?? durations[0] ?? 0;
            if (ms < 600) add("beat-duration", d.line, `beat animation ${name} lasts ${ms} ms (at least 600)`);
            const frames = keyframes.get(name);
            if (!frames) {
              add("beat-keyframes", d.line, `beat animation ${name} has no @keyframes in this file`);
              return;
            }
            if (!/-(a|b)$/.test(name)) add("beat-pair", d.line, `beat animation ${name} must be named <name>-a or <name>-b`);
            const inner = keyframeOffsets(frames).filter((o) => o > 0 && o < 1);
            if (!inner.length) {
              add("beat-ramp", frames.line, `@keyframes ${name} needs a peak stop between 0% and 100%`);
            } else {
              const up = inner[0] * ms;
              const down = (1 - inner[inner.length - 1]) * ms;
              if (up < 300) add("beat-ramp", frames.line, `@keyframes ${name} ramps up in ${Math.round(up)} ms (at least 300)`);
              if (down < 500) add("beat-ramp", frames.line, `@keyframes ${name} ramps down in ${Math.round(down)} ms (at least 500)`);
            }
          });
        }
      }
      if (!d.prop.startsWith("--") && usesLive(d.value) && !PAINT_PROPS.test(d.prop)) {
        add("live-paint-only", d.line, `${d.prop} in "${rule.selector}" uses a live variable (paint and composite properties only)`);
      }
      if (/url\(/i.test(d.value)) {
        for (const m of d.value.matchAll(/url\(\s*(["']?)([^"')]*)\1\s*\)/gi)) {
          if (!m[2].startsWith("data:")) add("url", d.line, `url(${m[2]}) is not a data URI`);
        }
      }
      if (focus && /^(outline(-[\w-]+)?|box-shadow)$/.test(d.prop)) {
        add("focus", d.line, `${d.prop} in a :focus-visible selector (the base rule owns focus)`);
      }
      if (!d.prop.startsWith("--") && !exemptPseudo) {
        const sealAllowed =
          seal &&
          ((/\.upcoming-seal$/.test(norm(rule.selector)) && ["font-size", "letter-spacing"].includes(d.prop) && /^0(px)?$/.test(d.value)) ||
            (/::?before$/.test(norm(rule.selector)) && ["font-size", "width", "height"].includes(d.prop)));
        const geometry =
          GEOMETRY_PROPS.test(d.prop) || (BORDER_SHORTHAND.test(d.prop) && LENGTH.test(d.value)) || d.prop === "letter-spacing";
        if (geometry && !sealAllowed) {
          add("geometry", d.line, `${d.prop} in "${rule.selector}" changes the shared geometry`);
        }
        if (((d.prop === "font-variant" && /small-caps/.test(d.value)) || (d.prop === "text-transform" && /uppercase/.test(d.value))) && !latin) {
          add("thai-text", d.line, `${d.prop}: ${d.value} on a selector that can carry Thai text`);
        }
      }
    }
  }

  for (const token of REQUIRED_TOKENS) {
    if (!declared.has(token)) add("tokens", 0, `required token ${token} is not declared`);
  }
  for (const token of REMOVED_TOKENS) {
    if (declared.has(token)) add("tokens", 0, `${token} was removed by the amendments and may not be set`);
  }
  const seal = declared.get("--card-seal-text");
  if (seal !== undefined && !/^["'].*[฀-๿].*["']$/.test(seal.trim())) {
    add("tokens", 0, "--card-seal-text must be a Thai CSS string");
  }
  if (!colorScheme) add("color-scheme", 0, "the theme does not set color-scheme");
  return out;
}

/** Selectors in hub.css, normalised, for registry rule checks. */
export function selectorsOf(nodes: readonly Node[]): Set<string> {
  const set = new Set<string>();
  for (const { rule } of walkRules(nodes)) for (const sel of rule.selectors) set.add(normalizeSelector(sel));
  return set;
}
