// Source-level contract of the Tsukinomi opening cutscene (design section 7):
// the rules that must keep holding as the six scenes are replaced one by one.
// Behaviour in a real browser is covered by the end-to-end run, not here.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

import { SCENE_PARTS, allRegistryEntries, assetPathsFor, registryEntry } from "./cutscene/registry";

const root = process.cwd();

const COMPONENT = "src/components/tsukinomi/cutscene/TsukinomiCutscene.astro";
const SECTION_LAYOUT = "src/layouts/tsukinomi/TsukinomiSectionLayout.astro";
const CUTSCENE_DIR = "src/scripts/tsukinomi/cutscene";
const SCENES_DIR = `${CUTSCENE_DIR}/scenes`;
const SHARED_RUNNER = "src/scripts/_shared/cutscene/runner.ts";

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function filesUnder(dir: string, extensions: readonly string[], skip: (path: string) => boolean = () => false): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(root, dir))) {
    const path = `${dir}/${entry}`;
    if (skip(path)) continue;
    if (statSync(join(root, path)).isDirectory()) found.push(...filesUnder(path, extensions, skip));
    else if (extensions.some((extension) => entry.endsWith(extension))) found.push(path);
  }
  return found;
}

const isTest = (path: string) => path.endsWith(".test.ts");

/** Source without block comments and whole-line // comments, so prose cannot match a code pattern. */
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** The non-test source of the cutscene: scripts, scenes, the dialog component. */
function cutsceneSources(): string[] {
  return [
    ...filesUnder(CUTSCENE_DIR, [".ts", ".css"], isTest),
    COMPONENT,
  ];
}

/** The flat `selector { body }` rules (no nesting) of the <style> blocks of an Astro component. */
function cssRules(component: string): Array<{ selector: string; body: string }> {
  const styles = [...component.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join("\n");
  return [...styles.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim(),
    body: match[2],
  }));
}

describe("Tsukinomi cutscene contract: dialog", () => {
  it("is a native <dialog> opened with showModal() by the shared runner, never show() or an overlay div", () => {
    const component = read(COMPONENT);
    assert.match(component, /<dialog\s+class="tsuki-cutscene"/);
    assert.match(component, /data-part=\{part\}/);
    assert.match(component, /data-scene=\{scene\.id\}/);

    assert.match(read(SHARED_RUNNER), /dialog\.showModal\(\)/);
    const adapter = read(`${CUTSCENE_DIR}/index.ts`);
    assert.match(adapter, /createCutsceneRunner</);
    assert.match(adapter, /from "\.\.\/\.\.\/_shared\/cutscene\/runner"/);
    assert.match(adapter, /from "\.\.\/\.\.\/_shared\/lifecycle"/);
    assert.match(adapter, /onPage\("tsukinomi-cutscene", \{ bodyClass: "tsukinomi-page" \}/);
    for (const path of cutsceneSources().filter((file) => file.endsWith(".ts"))) {
      assert.doesNotMatch(read(path), /\.show\(\)|\.showModal\(\)/, `${path}: only the runner opens the dialog`);
    }
  });

  it("has no z-index on the dialog or anything inside it: it is in the top layer", () => {
    const rules = cssRules(read(COMPONENT)).filter((rule) => /\.tsuki-cutscene(?!-)/.test(rule.selector));
    assert.ok(rules.length >= 5, "the component should style the dialog");
    for (const rule of rules) assert.doesNotMatch(rule.body, /z-index/, `${rule.selector} must not set z-index`);
    for (const path of filesUnder(SCENES_DIR, [".css"])) {
      assert.doesNotMatch(read(path).replace(/\/\*[\s\S]*?\*\//g, ""), /z-index/, `${path} must not set z-index: scenes order their layers by DOM order`);
    }
  });

  it("lays stage, text card and Skip in one grid cell, in DOM order, so text taller than the screen scrolls instead of being cut off", () => {
    // Seen at 200% text size on a phone: a centred, non-scrolling card lost its first lines. The
    // stage and the Skip button must be sticky: a wheel or touch over a fixed element scrolls the
    // viewport (which the runner locks), not the dialog.
    const rules = cssRules(read(COMPONENT));
    const rule = (selector: string) => rules.find((candidate) => candidate.selector === selector)?.body ?? "";
    assert.match(rule(".tsuki-cutscene[open]"), /display: grid/, "[open] only: a display on the bare class would keep a closed dialog on screen");
    assert.doesNotMatch(rule(".tsuki-cutscene"), /display:/);
    assert.match(rule(".tsuki-cutscene"), /overflow-y: auto/);
    assert.match(rule(".tsuki-cutscene"), /overscroll-behavior: contain/);
    for (const selector of [".tsuki-cutscene__stage", ".tsuki-cutscene__card", ".tsuki-cutscene__skip", ".tsuki-cutscene__controls"]) {
      assert.match(rule(selector), /grid-area: 1 \/ 1/, selector);
      assert.match(rule(selector), /position: (?:sticky|relative)/, `${selector} is positioned, so the DOM order is the paint order`);
    }
    assert.match(rule(".tsuki-cutscene__stage"), /position: sticky/);
    assert.match(rule(".tsuki-cutscene__skip"), /position: sticky/);
    assert.match(rule(".tsuki-cutscene__controls"), /position: sticky/);
    for (const { selector, body } of rules.filter((candidate) => candidate.selector.startsWith(".tsuki-cutscene"))) {
      if (selector === ".tsuki-cutscene") continue; // the dialog itself fills the viewport
      assert.doesNotMatch(body, /position: fixed/, `${selector}: fixed would leave the dialog's scroll chain`);
    }
  });

  it("keeps the real-text epigraph, a visible focusable skip control and the continue button in the dialog", () => {
    const component = read(COMPONENT);
    assert.match(component, /<p class="tsuki-cutscene__text" id="cutscene-text" data-cutscene-text>\{epigraph\}<\/p>/);
    assert.match(component, /aria-describedby="cutscene-text"/);
    assert.match(component, /aria-label=\{label\}/);
    assert.match(component, /<button type="button" class="tsuki-cutscene__skip" data-cutscene-skip autofocus>ข้าม<\/button>/);
    assert.match(component, /id="cutscene-continue" data-cutscene-start hidden>เดินทางต่อ<\/button>/);
    assert.match(component, /class="tsuki-cutscene__stage" data-cutscene-stage aria-hidden="true"/);
    // The skip button must not be hidden or hidden-by-default: visible from the first frame.
    assert.doesNotMatch(component, /data-cutscene-skip[^>]*\bhidden\b/);
    // Touch target and focus order: the stage comes first, so it paints under the text.
    assert.match(component, /\.tsuki-cutscene \.tsuki-cutscene__skip,\s*\.tsuki-cutscene \.tsuki-cutscene__continue,\s*\.tsuki-cutscene \.tsuki-cutscene__control \{[^}]*min-height: 44px/);
    assert.ok(component.indexOf("tsuki-cutscene__stage") < component.indexOf("tsuki-cutscene__card"));
  });
});

/** The attribute text of every ancestor, outermost first, of the first element whose open tag contains `marker`. */
function ancestorTags(markup: string, marker: string): string[] {
  const voidElements = new Set(["area", "br", "hr", "img", "input", "link", "meta", "source", "wbr"]);
  const stack: Array<{ name: string; attributes: string }> = [];
  // Attribute text may hold quoted strings and {expressions} (which can hold quotes and ">" ).
  const tag = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"'{]|"[^"]*"|'[^']*'|\{[^}]*\})*?)(\/?)>/g;
  for (const match of markup.matchAll(tag)) {
    const [, closing, name, attributes, selfClosing] = match;
    if (closing) {
      while (stack.length > 0 && stack.pop()?.name !== name);
      continue;
    }
    if (attributes.includes(marker)) return stack.map((entry) => entry.attributes);
    if (!selfClosing && !voidElements.has(name)) stack.push({ name, attributes });
  }
  throw new Error(`no element with ${marker}`);
}

describe("Tsukinomi cutscene contract: controls slot", () => {
  const component = read(COMPONENT);
  // The component's header comment names <dialog> too, so start at the element itself.
  const dialogMarkup = component.slice(component.search(/<dialog\s+class="tsuki-cutscene"/), component.indexOf("</dialog>") + "</dialog>".length);

  it("has an empty [data-cutscene-controls] container that is a direct child of the dialog, outside the aria-hidden stage and the text card", () => {
    assert.match(dialogMarkup, /<div class="tsuki-cutscene__controls" data-cutscene-controls><\/div>/, "empty in the markup: a scene fills it");
    const ancestors = ancestorTags(dialogMarkup, "data-cutscene-controls");
    assert.equal(ancestors.length, 1, `the container should sit directly in the dialog, found ancestors: ${JSON.stringify(ancestors)}`);
    assert.match(ancestors[0], /class="tsuki-cutscene"/);
    for (const attributes of ancestors) assert.doesNotMatch(attributes, /aria-hidden|\binert\b/, "a control in an aria-hidden or inert ancestor is unreachable");
    // The helper itself: the stage is aria-hidden and the text card is a sibling, so neither may hold the container.
    assert.match(ancestorTags(dialogMarkup, "data-cutscene-stage").join(" "), /class="tsuki-cutscene"/);
    assert.match(ancestorTags(dialogMarkup, "data-cutscene-start").join(" "), /class="tsuki-cutscene__card"/, "the helper sees a nested element's ancestors");
    assert.match(dialogMarkup, /class="tsuki-cutscene__stage" data-cutscene-stage aria-hidden="true"><\/div>/, "the stage is closed before the container, which is not inside it");
  });

  it("comes after Skip in the DOM, so Skip stays first in focus order and keeps the autofocus", () => {
    const order = ["data-cutscene-stage", "data-cutscene-text", "data-cutscene-start", "data-cutscene-skip", "data-cutscene-controls"].map((marker) => dialogMarkup.indexOf(marker));
    assert.ok(order.every((index) => index >= 0), "every part is in the dialog");
    assert.deepEqual([...order].sort((a, b) => a - b), order, "stage, text, continue, Skip, then the controls");
    assert.equal(dialogMarkup.match(/\bautofocus\b/g)?.length, 1, "only Skip is autofocused");
    assert.match(dialogMarkup, /data-cutscene-skip autofocus/);
  });

  it("is sticky beside Skip, one shared control look at 44 px with a focus ring, hidden when empty and in the still, and sets no z-index", () => {
    const rules = cssRules(component);
    const rule = (selector: string) => rules.find((candidate) => candidate.selector === selector)?.body ?? "";
    assert.match(rule(".tsuki-cutscene__controls"), /grid-area: 1 \/ 1/);
    assert.match(rule(".tsuki-cutscene__controls"), /position: sticky/);
    assert.match(rule(".tsuki-cutscene__controls"), /align-self: end/);
    assert.match(rule(".tsuki-cutscene__controls"), /margin-right: calc\([^;]*\d+(?:\.\d+)?rem\)/, "reserves the width of Skip in rem, so a larger text size keeps them apart");
    assert.match(rule(".tsuki-cutscene__controls"), /flex-wrap: wrap/, "a control that does not fit wraps instead of running under Skip");
    assert.match(rule(".tsuki-cutscene__controls > *"), /pointer-events: auto/);
    assert.match(rule(".tsuki-cutscene .tsuki-cutscene__control"), /padding:/);
    assert.match(rule(".tsuki-cutscene__control:focus-visible"), /outline: 2px solid/);
    // The card's bottom band grows with the slot's measured height (see session.ts), so wrapped controls never reach the last line.
    assert.match(rule(".tsuki-cutscene__card"), /padding-bottom: max\([^;]*var\(--tsuki-controls-reserve, 0px\)/);
    assert.match(read(`${CUTSCENE_DIR}/session.ts`), /CONTROLS_RESERVE_PROPERTY = "--tsuki-controls-reserve"/);
    // The page's `.tsukinomi-page button` reset beats a lone class, so the look is prefixed with the dialog class.
    assert.match(read("src/styles/tsukinomi/global.css"), /\.tsukinomi-page button,[^{]*\{[^}]*border: 0;[^}]*background: none;/);
    assert.doesNotMatch(component, /^\s*\.tsuki-cutscene__(?:skip|continue|control)\s*,/m, "an unprefixed look would lose to the page's button reset");
    const hidden = rules.find((candidate) => /\.tsuki-cutscene__controls:empty/.test(candidate.selector));
    assert.ok(hidden, "an empty slot is display: none");
    assert.match(hidden.selector, /\.tsuki-cutscene\[data-mode="still"\] \.tsuki-cutscene__controls/, "the reduced-motion still hides the slot");
    assert.match(hidden.body, /display: none/);
    for (const candidate of rules.filter((entry) => /controls?\b/.test(entry.selector))) assert.doesNotMatch(candidate.body, /z-index|position: fixed/, candidate.selector);
    // The runner blocks Space on the dialog but lets it through on a control, and only the Skip button skips.
    assert.match(read(SHARED_RUNNER), /event\.key === " " && !isControl\(event\.target\)/);
    assert.match(read(SHARED_RUNNER), /skipButton\.addEventListener\("click", onSkipClick\)/);
  });

  it("reaches scenes as ctx.controls: declared in the contract, passed by the adapter, emptied by the session and again when the dialog closes", () => {
    assert.match(read(`${CUTSCENE_DIR}/scene-types.ts`), /readonly controls: HTMLElement;/);
    const adapter = read(`${CUTSCENE_DIR}/index.ts`);
    assert.match(adapter, /querySelector<HTMLElement>\("\[data-cutscene-controls\]"\)/);
    assert.match(adapter, /dialog,\s*stage,\s*controls,/);
    assert.match(adapter, /dialog\.addEventListener\("close", clearControls\)/);
    const session = read(`${CUTSCENE_DIR}/session.ts`);
    assert.match(session, /controls: init\.controls,/);
    assert.match(session, /init\.controls\.replaceChildren\(\);/);
  });
});

describe("Tsukinomi cutscene contract: old overlay removed", () => {
  it("leaves no .cutscene-overlay in Tsukinomi or shared code (Lodge and Kusabi keep their own, out of scope)", () => {
    // Scoped by path: the Lodge and Kusabi chapter layouts legitimately still use
    // .cutscene-overlay / has-cutscene, so they are not scanned. Everything else
    // in src (Tsukinomi, Sea, the hub, _shared, styles) must be free of it.
    const isOtherNovel = (path: string) => /\/(?:lodge|kusabi)\//.test(path);
    const scanned = filesUnder("src", [".astro", ".ts", ".css", ".js", ".mjs"], (path) => isTest(path) || path.startsWith("src/plan") || isOtherNovel(path));
    assert.ok(scanned.some((path) => path.startsWith("src/layouts/tsukinomi/")), "the Tsukinomi layouts must be scanned");
    assert.ok(scanned.some((path) => path.startsWith("src/scripts/_shared/")), "shared scripts must be scanned");
    assert.deepEqual(scanned.filter((path) => /cutscene-overlay|has-cutscene/.test(read(path))), []);
  });

  it("renders the dialog and loads the adapter from the section layout, with no inline cutscene script or EPIGRAPHS", () => {
    const layout = read(SECTION_LAYOUT);
    assert.match(layout, /import TsukinomiCutscene from "\.\.\/\.\.\/components\/tsukinomi\/cutscene\/TsukinomiCutscene\.astro"/);
    assert.match(layout, /import \{ epigraphFor \} from "\.\.\/\.\.\/scripts\/tsukinomi\/cutscene\/epigraphs"/);
    assert.match(layout, /<TsukinomiCutscene part=\{section\.data\.number\} epigraph=\{epigraphText\}/);
    assert.match(layout, /<script>\s*(\/\/[^\n]*\n\s*)?import "\.\.\/\.\.\/scripts\/tsukinomi\/cutscene\/index";\s*<\/script>/);
    assert.doesNotMatch(layout, /EPIGRAPHS/);
    assert.doesNotMatch(layout, /cooldownKey|runTsukiAnimation|fade-char/);
    assert.doesNotMatch(layout, /<script is:inline[^>]*>[^<]*cutscene/);
  });

  it("leaves the unlock toast and its reveal rule as they were", () => {
    const layout = read(SECTION_LAYOUT);
    assert.match(layout, /data-unlock-toast hidden role="status" aria-live="polite"/);
    assert.match(layout, /const REVEAL_SECTION = 3;/);
    assert.match(layout, /const SHOWN_KEY = "tsukinomi:characters:toast-shown";/);
    assert.match(layout, /localStorage\.setItem\("tsukinomi:characters:revealed", "true"\);/);
    assert.match(layout, /document\.addEventListener\("astro:page-load", setupUnlockToast\);/);
  });
});

describe("Tsukinomi cutscene contract: reduced motion", () => {
  it("has a reduced-motion branch: the runner shows the still, the adapter and every scene provide it", () => {
    assert.match(read(SHARED_RUNNER), /prefers-reduced-motion: reduce/);
    assert.match(read(SHARED_RUNNER), /dataset\.mode = still \? "still" : "motion"/);
    const adapter = read(`${CUTSCENE_DIR}/index.ts`);
    assert.match(adapter, /still\(\) \{/);
    assert.match(adapter, /openSession\(loaded\.session, true\)/);
    assert.match(adapter, /loaded\.scene\.still\(session\.ctx\)/);

    const scenes = allRegistryEntries().map((entry) => `${SCENES_DIR}/${entry.id}.ts`);
    assert.equal(scenes.length, 7);
    for (const path of scenes) {
      const source = read(path);
      assert.match(source, /export function play\(ctx: TsukiSceneContext\): TsukiSceneHandle/, path);
      assert.match(source, /export function still\(ctx: TsukiSceneContext\): void/, path);
    }
    assert.match(read(`${SCENES_DIR}/plate-reveal.css`), /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(read(`${CUTSCENE_DIR}/session.ts`), /createSilentSceneAudio\(\) : createSceneAudio/);
  });
});

describe("Tsukinomi cutscene contract: scenes load lazily", () => {
  it("imports a scene module only through a dynamic import() in the registry", () => {
    const registry = read(`${CUTSCENE_DIR}/registry.ts`);
    const dynamic = [...registry.matchAll(/import\("\.\/scenes\/([\w-]+)"\)/g)].map((match) => match[1]);
    assert.deepEqual(dynamic.sort(), allRegistryEntries().map((entry) => entry.id).sort());

    // No static import or re-export of anything under a scenes/ folder, except inside scenes/ itself.
    // `import x from "..."`, `import type {...} from "..."`, `export * from "..."` and `import "..."`.
    const staticScene = /^\s*(?:import|export)\s+(?:[\w*${}\s,]+\s+from\s+)?["'][^"']*\/scenes\/[^"']*["']/m;
    const offenders = filesUnder("src", [".astro", ".ts", ".js", ".mjs"], (path) => isTest(path) || path.startsWith(`${SCENES_DIR}/`))
      .filter((path) => staticScene.test(read(path)));
    assert.deepEqual(offenders, [], "scene modules must only be reached through registry.ts's dynamic import()");

    // The adapter reaches the scene through the registry entry and imports the session lazily too.
    const adapter = read(`${CUTSCENE_DIR}/index.ts`);
    assert.match(adapter, /entry\.load\(\)/);
    assert.match(adapter, /import\("\.\/session"\)/);
    assert.deepEqual(
      [...adapter.matchAll(/^import (?!type)[^;]*from "\.\/session";/gm)],
      [],
      "the session (scene-runtime, Walkman wrapper) must only be imported dynamically",
    );
  });

  it("loads a scene's styles as a string (?inline) and injects them, never as a bare CSS import", () => {
    // Astro hoists the CSS of everything a page script can reach, dynamic imports included, into the
    // stylesheet of every section page (seen in a production build), so a bare import would ship the
    // scene's styles on every visit. ?inline keeps them in the scene chunk; see styles.ts.
    const offenders = filesUnder(SCENES_DIR, [".ts"], isTest).filter((path) => /^\s*import\s+["'][^"']+\.css["']/m.test(read(path)));
    assert.deepEqual(offenders, []);
    const reveal = read(`${SCENES_DIR}/plate-reveal.ts`);
    assert.match(reveal, /import plateCss from "\.\/plate-reveal\.css\?inline";/);
    assert.match(reveal, /injectSceneStyles\(plateCss, ctx\.signal\)/);
    // The DOM and clock halves are in plate-core.ts (unit-tested); this file only has to wire them up.
    assert.match(reveal, /splitIntoClusters\(textEl\)/);
    assert.match(reveal, /"--tsuki-plate-scrim", String\(clampScrim\(look\.scrim\)\)/);
    assert.match(reveal, /createRevealClock\(timing\.totalMs, signal\)/);
    assert.match(reveal, /return \{ done: clock\.done, dispose: clock\.dispose \}/);
  });

  it("keeps scene code off hard-coded asset URLs and WebGL", () => {
    for (const path of [...filesUnder(SCENES_DIR, [".ts", ".css"], isTest)]) {
      const source = read(path);
      // Assets come from ctx.assets, which already carries the site base (GitHub Pages serves under /MY-NOVEL/).
      assert.doesNotMatch(source, /["'`(]\/assets\//, `${path} must not hard-code an /assets/ URL`);
      assert.doesNotMatch(source, /BASE_URL/, `${path} must use ctx.assets, not BASE_URL`);
    }
    for (const path of cutsceneSources()) {
      assert.doesNotMatch(read(path), /webgl|getContext\(\s*["'](?:webgl|experimental-webgl|webgpu)/i, `${path}: Canvas 2D and CSS only`);
    }
  });
});

describe("Tsukinomi cutscene contract: registry assets", () => {
  it("covers the prologue and parts 1 to 5, and every asset path exists on disk", () => {
    assert.deepEqual([...SCENE_PARTS], [0, 1, 2, 3, 4, 5]);
    let checked = 0;
    for (const entry of allRegistryEntries()) {
      for (const path of assetPathsFor(entry)) {
        assert.ok(path.startsWith("/assets/tsukinomi/"), `${entry.id}: ${path} should live under /assets/tsukinomi/`);
        assert.ok(existsSync(join(root, "public", path)), `${entry.id}: public${path} should exist`);
        checked++;
      }
    }
    assert.ok(checked >= 30, `expected many asset paths, checked ${checked}`);
    for (const part of SCENE_PARTS) assert.notEqual(registryEntry(part).id, "neutral");
  });
});

describe("Tsukinomi cutscene contract: audio and third parties", () => {
  it("drives audio only through the existing walkmanAudio singleton: no new Howl, no new Audio", () => {
    for (const path of cutsceneSources()) {
      const source = read(path);
      assert.doesNotMatch(source, /new Howl\b|new Audio\b|\bHowl\(|new AudioContext|new webkitAudioContext|from "howler"|createBufferSource/, `${path} must not create audio of its own`);
      assert.doesNotMatch(source, /document\.createElement\(\s*["'](?:audio|video)["']\s*\)/, path);
    }
    assert.match(read(`${CUTSCENE_DIR}/session.ts`), /import \{ walkmanAudio \} from "\.\.\/walkman-state"/);
    assert.match(read(`${CUTSCENE_DIR}/session.ts`), /createSceneAudio\(walkmanAudio\)/);
    // audio.ts talks to a WalkmanAudio-shaped object and imports its type only.
    const audio = read(`${CUTSCENE_DIR}/audio.ts`);
    assert.match(audio, /import type \{ SfxId, WalkmanAudio \} from "\.\.\/walkman-state"/);
    assert.doesNotMatch(audio, /import \{[^}]*\} from "\.\.\/walkman-state"/);
    // The one addition to the Walkman: a public way to play a tape effect.
    assert.match(read("src/scripts/tsukinomi/walkman-state.ts"), /playSfx\(id: SfxId\) \{\s*this\.playOneShot\(id\);/);
  });

  it("requests no third-party origin", () => {
    const sources = [...cutsceneSources(), SECTION_LAYOUT, `${CUTSCENE_DIR}/scenes/plate-reveal.css`];
    for (const path of sources) {
      assert.doesNotMatch(read(path), /https?:\/\//i, `${path} must not name a third-party origin`);
    }
  });

  it("keeps the old played-key prefix and accepts old numeric values through the shared rule", () => {
    assert.match(read(`${CUTSCENE_DIR}/index.ts`), /PLAYED_PREFIX = "tsukinomi:cutscene:played:"/);
    assert.match(read(`${CUTSCENE_DIR}/index.ts`), /playedKey: `\$\{PLAYED_PREFIX\}\$\{part\}`/);
    assert.match(read(COMPONENT), /"tsukinomi:cutscene:played:" \+ dialog\.dataset\.part/);
    assert.match(read("src/scripts/_shared/cutscene/core.ts"), /\^-\?\\d\+\$/);
  });

  it("uses relative imports that resolve, so the adapter builds", () => {
    for (const path of filesUnder(CUTSCENE_DIR, [".ts"], isTest)) {
      for (const match of stripComments(read(path)).matchAll(/(?:from|import\()\s*["'](\.[^"'?]+)(?:\?[^"']*)?["']/g)) {
        const target = join(root, relative(root, join(root, path, "..", match[1])));
        const candidates = [".ts", ".css", "/index.ts", ""].map((suffix) => `${target}${suffix}`);
        assert.ok(candidates.some((file) => existsSync(file) && statSync(file).isFile()), `${path}: ${match[1]} does not resolve`);
      }
    }
  });
});
