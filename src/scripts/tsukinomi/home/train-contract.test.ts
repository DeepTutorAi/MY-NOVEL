// Source rules for the passing train (design 4.4 and section 5, and the task's
// hard constraints): what the initial script may contain, what the lazy chunk
// may not use, and that nothing but the planned pictures can be requested. Pure
// source checks; the behaviour is in train-core.test.ts, train-loader.test.ts and
// the browser run of the checks.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const HOME = "src/scripts/tsukinomi/home";
const CORE = `${HOME}/train-core.ts`;
const SCENE = `${HOME}/train-scene.ts`;
const LOADER = `${HOME}/train-loader.ts`;
const CONCOURSE = `${HOME}/concourse.ts`;
const CSS = "src/styles/tsukinomi/home.css";
const TRAIN_FILES = [CORE, SCENE, LOADER] as const;

/** Source with its comments blanked, so prose in them is never mistaken for code. */
const withoutComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s\/\/ .*$/gm, "");

/** Every non-test source file under src, as [path, text]. */
function sourceFiles(dir = join(root, "src")): Array<[string, string]> {
  const files: Array<[string, string]> = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...sourceFiles(full));
    else if (/\.(ts|astro|js|mjs)$/.test(name) && !/\.test\.ts$/.test(name)) files.push([full.slice(root.length + 1), readFileSync(full, "utf8")]);
  }
  return files;
}

describe("the initial script stays small and the scene stays lazy", () => {
  const loader = withoutComments(read(LOADER));

  it("the loader imports no train module statically: a module shared with the lazy chunk would be hoisted into the page's script", () => {
    const staticImports = [...loader.matchAll(/^import\s[^;]*from\s+["']([^"']+)["']/gm)].map((match) => match[1]);
    assert.deepEqual(staticImports, ["./concourse-core"]);
    assert.match(loader, /import\("\.\/train-scene"\)/);
  });

  it("only the loader refers to the scene, and only with a dynamic import", () => {
    for (const [path, text] of sourceFiles()) {
      if (path === SCENE || path === LOADER) continue;
      assert.doesNotMatch(withoutComments(text), /train-scene/, `${path} must not name the scene`);
    }
    for (const [path, text] of sourceFiles()) {
      if (path === CORE || path === SCENE) continue;
      assert.doesNotMatch(
        withoutComments(text),
        /from\s+["'][^"']*train-core["']/,
        `${path} must not import train-core (it belongs to the lazy chunk)`,
      );
    }
  });

  it("concourse.ts starts the train through the loader and hands it the furthest part read", () => {
    const script = withoutComments(read(CONCOURSE));
    assert.match(script, /import \{ startTrain \} from "\.\/train-loader"/);
    assert.match(script, /startTrain\(\{[^}]*mount: document\.querySelector<HTMLElement>\("\[data-train-mount\]"\)[^}]*furthestRead: state\.furthestRead/);
    assert.match(script, /cleanups\.push\(startTrain\(/);
  });

  it("waits for first paint, idle and a visible tab before it asks for the scene", () => {
    assert.match(loader, /requestAnimationFrame/);
    assert.match(loader, /requestIdleCallback/);
    assert.match(loader, /document\.hidden/);
    assert.match(loader, /readyState === "complete"/);
  });

  it("never downloads the scene under reduced motion or in short landscape (it asks the same queries live)", () => {
    assert.match(loader, /prefers-reduced-motion: reduce/);
    assert.match(loader, /SHORT_LANDSCAPE_QUERY/);
    assert.match(loader, /trainSkipReason/);
    // The gate runs before the import, and again after it.
    const begin = loader.slice(loader.indexOf("const begin"), loader.indexOf("const schedule"));
    assert.ok(begin.indexOf("reason()") < begin.indexOf('import("./train-scene")'));
    assert.ok(begin.lastIndexOf("reason()") > begin.indexOf('import("./train-scene")'));
  });
});

describe("the scene stays inside the plan's limits", () => {
  const scene = withoutComments(read(SCENE));

  it("is Canvas 2D on scene-runtime and nothing else", () => {
    assert.match(scene, /from "\.\.\/\.\.\/_shared\/scene-runtime"/);
    assert.match(scene, /createScene\(/);
    assert.doesNotMatch(scene, /webgl|WebGL|getContext\(["'](?!2d)/);
  });

  it("uses none of the per-frame costs the budget rules out", () => {
    for (const forbidden of [/shadowBlur/, /getImageData/, /putImageData/, /\.filter\s*=/, /backdrop-filter/, /blur\(/, /willReadFrequently/]) {
      assert.doesNotMatch(scene, forbidden, String(forbidden));
    }
  });

  it("is silent: no Walkman, no Howler, no audio element", () => {
    for (const forbidden of [/walkman/i, /howler/i, /new Audio\(/, /AudioContext/, /createSceneAudio/, /soundscape/i]) {
      assert.doesNotMatch(scene, forbidden, String(forbidden));
    }
  });

  it("requests an image only for a URL in the plan: one Image, its src set from the loader's argument, fed from plan.frames; every other src is a blob URL made here or a copy of that one", () => {
    assert.equal((scene.match(/new Image\(/g) ?? []).length, 1);
    assert.match(scene, /image\.src = src;/);
    assert.match(scene, /loadFrames\(plan\.frames,/);
    assert.match(scene, /async function loadFrameImage\(src: string\)/);
    assert.doesNotMatch(scene, /fetch\(|XMLHttpRequest|sendBeacon/);
    // The painted layers are shown by object URLs (revoked on dispose); a film frame is a copy of the loaded image, so the same URL again.
    assert.match(scene, /URL\.createObjectURL\(blob\)/);
    assert.match(scene, /URL\.revokeObjectURL\(url\)/);
    assert.match(scene, /source\.cloneNode\(false\)/);
    const sources = [...scene.matchAll(/\.src = ([^;]+);/g)].map((match) => match[1]);
    assert.deepEqual(sources.sort(), ["src", "url"]);
  });

  it("puts aria-hidden images in the mount and removes them, and releases their object URLs, when the pass ends or the page is left", () => {
    assert.match(scene, /setAttribute\("aria-hidden", "true"\)/);
    assert.match(scene, /for \(const element of \[backdrop\.image, train\]\) element\.remove\(\)/);
    assert.match(scene, /URL\.revokeObjectURL\(url\)/);
    assert.match(scene, /scene\?\.destroy\(\)/);
    assert.match(scene, /observer\?\.disconnect\(\)/);
    assert.match(scene, /renderer\?\.dispose\(\)/);
  });

  it("moves the train by animations, not by drawing: a transform carries it and an opacity fades the atmosphere, and the frame callback draws nothing", () => {
    assert.match(scene, /train\.animate\(/);
    assert.match(scene, /backdrop\.animate\(/);
    assert.match(scene, /translateX\(/);
    const frame = scene.slice(scene.indexOf("    render() {"), scene.indexOf("    reducedMotionFrame() {"));
    assert.ok(frame.length > 50, "found the frame callback");
    assert.doesNotMatch(frame, /drawImage|clearRect|getContext|fillRect|\.style\./);
    // The loop's canvas never goes into the page: a canvas in the page costs the compositor a handoff every frame.
    assert.match(scene, /const detached = document\.createElement\("canvas"\)/);
    assert.doesNotMatch(scene, /mount\.append\([^)]*detached|appendChild\([^)]*detached/);
  });

  it("holds the pass (clock and animations) while the mount is off screen or the tab is hidden", () => {
    assert.match(scene, /IntersectionObserver/);
    assert.match(scene, /scene\?\.stop\(\)/);
    assert.match(scene, /visibilitychange/);
    assert.match(scene, /clock\.hold\(\)/);
    assert.match(scene, /animation\.pause\(\)/);
  });

  it("leaves nothing on the stage, rather than freezing the train, if reduced motion turns on mid-pass", () => {
    assert.match(scene, /reducedMotionFrame\(\) \{\s*stopAnimations\(\);/);
    assert.match(scene, /element\.style\.opacity = "0"/);
  });
});

describe("what the new files may say", () => {
  it("contain no Thai text (the train adds no interface copy) and no third-party address", () => {
    for (const path of TRAIN_FILES) {
      const source = read(path);
      assert.doesNotMatch(source, /[฀-๿]/, `${path} has Thai text`);
      assert.doesNotMatch(source, /https?:\/\//, `${path} has a URL`);
    }
  });

  it("do not touch storage or the network themselves", () => {
    for (const path of TRAIN_FILES) {
      const code = withoutComments(read(path));
      assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB|document\.cookie/, path);
    }
  });
});

describe("the mount and its styling", () => {
  const css = read(CSS);
  const page = read("src/pages/tsukinomi/index.astro");

  it("the layers the scene adds take no pointer, and are placed by the scene itself (so the stylesheet needs no rule for images)", () => {
    const scene = read(SCENE);
    assert.match(scene, /pointerEvents: "none"/);
    assert.match(scene, /position: "absolute"/);
    assert.match(scene, /maxWidth: "none"/, "the page resets images to max-width: 100%, which would crush a sprite wider than the mount");
  });

  it("the mount lies under the hero copy, takes no pointer, and is dropped in short landscape", () => {
    const mount = /\.tsukinomi-home-train-mount\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    assert.match(mount, /z-index:\s*0/);
    assert.match(mount, /pointer-events:\s*none/);
    assert.match(mount, /overflow:\s*hidden/);
    const short = css.slice(css.indexOf("@media (orientation: landscape) and (max-height: 500px) {\n  .tsukinomi-home-page"));
    assert.match(short, /\.tsukinomi-home-train-mount\s*\{\s*display:\s*none/);
  });

  it("the page embeds the catalogue of illustrations the train filters", () => {
    assert.match(page, /data-train-mount/);
    assert.match(page, /data-illustrations=\{JSON\.stringify\(illustrations\)\}/);
  });

  it("the hero copy sits above the mount in paint order", () => {
    const copy = /\.tsukinomi-home-page \.tsukinomi-home-copy\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    assert.match(copy, /position:\s*relative/);
    assert.match(copy, /z-index:\s*1/);
  });
});
