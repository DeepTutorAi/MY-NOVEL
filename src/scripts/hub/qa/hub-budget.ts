// Chunk and stylesheet budgets for the hub (spec 2.15, 5.5 last bullet, 5.6, 8.4 item 24).
// Gzips every chunk in <dist>/_astro, follows static imports from each theme's scene entry
// and from the hub page's module scripts, and reports scene chunks, the shared world chunk
// (counted once), the chrome entry, the inline bridge, each theme CSS file and the hub page
// CSS before and after. Chunks a scene loads with import() are reported as its lazy chunks
// (not gated). KB = 1024 bytes of gzip output (level 9).
//
// Usage: tsx src/scripts/hub/qa/hub-budget.ts [distDir=.qa/dist-hub] [--themes a,b] [--before dist]
//        [--report path] [--dry-run]
// Writes .qa/hub-budget-report.json (.qa/hub-budget-report-<themes>.json with --themes).
// Exits 1 when a pass/fail limit is exceeded. With --themes only the chosen themes' scene
// chunks and CSS files gate the exit code; the shared chunk, chrome entry, bridge and page
// CSS limits are still measured and printed as notes, because other units own them.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { gzipSync } from "node:zlib";

import { HUB_THEMES } from "../theme-core.mjs";
import type { HubThemeKey } from "../world/types";
import { parseArgs, parseThemes } from "./browser";
import { tokenize } from "./css";

const KB = 1024;
// sharedKb 13 (spec 2.15 says 9): build lead decision B2. The shared world chunk is lazy and loads with the scene;
// it also carries output-core and calendar-core, which chrome's lazy modules share, and the scene-runtime the kit wraps.
const LIMITS = { sceneKb: 30, sharedKb: 13, chromeKb: 10, bridgeKb: 1.4, themeCssKb: 5, themeCssTargetKb: 3.5, pageCssGrowthKb: 20 };
/** Scene module per theme. */
const SCENE_MODULES: Record<HubThemeKey, readonly string[]> = {
  "pages-stars": ["library-scene"],
  skyglass: ["skyglass-scene"],
  constellation: ["lightfall-scene"],
  mothlight: ["mothlight-scene"],
  firefly: ["firefly-scene"],
};
const REPORT = ".qa/hub-budget-report.json";
const USAGE = `usage: tsx src/scripts/hub/qa/hub-budget.ts [distDir=.qa/dist-hub] [--themes a,b] [--before dist] [--report path] [--dry-run]`;

const gz = (data: string | Buffer) => gzipSync(data, { level: 9 }).length;
const kb = (bytes: number) => Math.round((bytes / KB) * 100) / 100;

class Chunks {
  private readonly cache = new Map<string, { gzip: number; imports: string[]; lazy: string[] }>();
  constructor(private readonly dir: string) {}
  get(file: string) {
    let entry = this.cache.get(file);
    if (!entry) {
      const text = readFileSync(join(this.dir, file), "utf8");
      const imports = [...text.matchAll(/\bfrom\s*["']\.\/([^"']+\.js)["']|\bimport\s*["']\.\/([^"']+\.js)["']/g)].map((m) => m[1] ?? m[2]);
      const lazy = [...text.matchAll(/\bimport\(\s*["']\.\/([^"']+\.js)["']\s*\)/g)].map((m) => m[1]);
      entry = { gzip: gz(text), imports: [...new Set(imports)], lazy: [...new Set(lazy)] };
      this.cache.set(file, entry);
    }
    return entry;
  }
  /** The file and every chunk it imports statically, transitively. */
  closure(file: string): Set<string> {
    const seen = new Set<string>();
    const stack = [file];
    while (stack.length) {
      const next = stack.pop() as string;
      if (seen.has(next) || !existsSync(join(this.dir, next))) continue;
      seen.add(next);
      stack.push(...this.get(next).imports);
    }
    return seen;
  }
  /** Chunks the given files load with import(), with their static closures. */
  lazyClosure(files: Iterable<string>): Set<string> {
    const out = new Set<string>();
    for (const file of files) {
      if (!existsSync(join(this.dir, file))) continue;
      for (const lazy of this.get(file).lazy) for (const f of this.closure(lazy)) out.add(f);
    }
    return out;
  }
  sum(files: Iterable<string>): number {
    let total = 0;
    for (const file of files) total += this.get(file).gzip;
    return total;
  }
}

/** Comment and whitespace stripping close to what the bundler emits. */
function minifyCss(css: string): string {
  return tokenize(css)
    .map((t) => (t.kind === "text" ? t.text.replace(/\s+/g, " ").replace(/\s*([>+~,:(])\s*/g, "$1").replace(/\s*\)/g, ")").trim() : t.text))
    .join("")
    .replace(/;}/g, "}");
}

function pageCss(dist: string): { files: string[]; gzip: number } {
  const html = readFileSync(join(dist, "index.html"), "utf8");
  const files = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\/_astro\/([^"]+\.css)"/g)].map((m) => m[1]);
  return { files, gzip: files.reduce((sum, file) => sum + gz(readFileSync(join(dist, "_astro", file))), 0) };
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) {
    console.log(USAGE);
    return 0;
  }
  const { opts, rest } = parseArgs(argv, ["dry-run"]);
  const dist = rest[0] ?? ".qa/dist-hub";
  const before = opts.get("before") ?? (existsSync("dist/index.html") ? "dist" : null);
  const picked = opts.has("themes") ? parseThemes(opts.get("themes") ?? "") : null;
  const selected = (key: HubThemeKey) => picked === null || picked.includes(key);
  const reportPath = opts.get("report") ?? (picked ? `.qa/hub-budget-report-${picked.join("+")}.json` : REPORT);
  if (opts.has("dry-run")) {
    console.log(`would measure ${dist}/_astro and ${dist}/index.html${before ? ` against ${before}` : ""}${picked ? ` for ${picked.join(", ")}` : ""}; report ${reportPath}`);
    return 0;
  }
  if (!existsSync(join(dist, "index.html"))) {
    console.error(`${dist}/index.html not found (build first)`);
    return 2;
  }
  const astroDir = join(dist, "_astro");
  const files = readdirSync(astroDir).filter((f) => f.endsWith(".js"));
  const chunks = new Chunks(astroDir);
  const html = readFileSync(join(dist, "index.html"), "utf8");
  const failures: string[] = [];
  const notes: string[] = [];
  /** Limits on parts other units own: gating without --themes, notes with it. */
  const globalFailure = (line: string) => (picked ? notes.push(`over a limit owned by other units: ${line}`) : failures.push(line));

  const pageEntries = [...html.matchAll(/<script type="module" src="\/_astro\/([^"]+\.js)"/g)].map((m) => m[1]);
  const chromeEntries = pageEntries.filter((f) => /^index\.astro_astro_type_script/.test(f));
  const chromeClosure = new Set(chromeEntries.flatMap((f) => [...chunks.closure(f)]));
  if (!chromeEntries.length) notes.push("no index.astro module script in the page: the chrome entry is not built yet");

  const scenes = HUB_THEMES.map((row) => {
    const module = SCENE_MODULES[row.key].find((name) => files.some((f) => f.startsWith(`${name}.`)));
    const entry = module ? files.find((f) => f.startsWith(`${module}.`)) : undefined;
    return { key: row.key, module: module ?? null, entry: entry ?? null, closure: entry ? chunks.closure(entry) : new Set<string>() };
  });
  const reach = new Map<string, number>();
  for (const scene of scenes) for (const file of scene.closure) reach.set(file, (reach.get(file) ?? 0) + 1);
  const shared = new Set([...reach].filter(([file, n]) => n >= 2 && !chromeClosure.has(file)).map(([file]) => file));

  const sceneRows = scenes.filter((scene) => selected(scene.key)).map((scene) => {
    if (!scene.entry) {
      notes.push(`${scene.key}: no scene chunk (${SCENE_MODULES[scene.key].join(" or ")}) in the build`);
      return { key: scene.key, entry: null, themeOnly: [] as string[], gzipKb: null as number | null, lazy: [] as string[], lazyGzipKb: null as number | null };
    }
    const themeOnly = [...scene.closure].filter((f) => f !== scene.entry && !shared.has(f) && !chromeClosure.has(f));
    const gzip = chunks.sum([scene.entry, ...themeOnly]);
    if (kb(gzip) > LIMITS.sceneKb) failures.push(`${scene.key} scene chunk ${kb(gzip)} KB > ${LIMITS.sceneKb} KB`);
    const lazy = [...chunks.lazyClosure(scene.closure)].filter((f) => !scene.closure.has(f) && !shared.has(f) && !chromeClosure.has(f));
    return { key: scene.key, entry: scene.entry, themeOnly, gzipKb: kb(gzip), lazy, lazyGzipKb: kb(chunks.sum(lazy)) };
  });

  const sharedKb = kb(chunks.sum(shared));
  if (sharedKb > LIMITS.sharedKb) globalFailure(`shared world chunk ${sharedKb} KB > ${LIMITS.sharedKb} KB`);
  const chromeKb = kb(chunks.sum(chromeClosure));
  if (chromeKb > LIMITS.chromeKb) globalFailure(`chrome entry ${chromeKb} KB > ${LIMITS.chromeKb} KB`);

  const bridge = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes("__hubTheme") && s.includes("resolveTheme"));
  const bridgeRow = bridge ? { rawBytes: Buffer.byteLength(bridge), gzipKb: kb(gz(bridge)), hasComments: /\/\*|(^|[^:"'])\/\/\s/.test(bridge) } : null;
  if (!bridgeRow) notes.push("no inline script with __hubTheme and resolveTheme in index.html: the bridge is not built yet");
  else {
    if (bridgeRow.gzipKb > LIMITS.bridgeKb) globalFailure(`bridge ${bridgeRow.gzipKb} KB > ${LIMITS.bridgeKb} KB`);
    if (bridgeRow.hasComments) globalFailure("the inline bridge still carries comments (8.4 item 24)");
  }

  const themeCss = HUB_THEMES.filter((row) => selected(row.key)).map((row) => {
    const path = `src/styles/_shared/hub-themes/${row.key}.css`;
    if (!existsSync(path)) return { key: row.key, path, gzipKb: null as number | null, target: null as boolean | null };
    const size = kb(gz(minifyCss(readFileSync(path, "utf8"))));
    if (size > LIMITS.themeCssKb) failures.push(`${row.key}.css ${size} KB > ${LIMITS.themeCssKb} KB`);
    return { key: row.key, path, gzipKb: size, target: size <= LIMITS.themeCssTargetKb };
  });

  const after = pageCss(dist);
  const beforeCss = before && existsSync(join(before, "index.html")) ? pageCss(before) : null;
  const growthKb = beforeCss ? kb(after.gzip - beforeCss.gzip) : null;
  if (growthKb !== null && growthKb > LIMITS.pageCssGrowthKb) globalFailure(`hub page CSS grew ${growthKb} KB > ${LIMITS.pageCssGrowthKb} KB`);

  const report = {
    dist,
    themes: picked ?? HUB_THEMES.map((row) => row.key),
    before,
    limitsKb: LIMITS,
    scenes: sceneRows,
    shared: { files: [...shared], gzipKb: sharedKb },
    chrome: { entries: chromeEntries, files: [...chromeClosure], gzipKb: chromeKb },
    pageEntries: pageEntries.map((f) => ({ file: f, closureGzipKb: kb(chunks.sum(chunks.closure(f))) })),
    bridge: bridgeRow,
    themeCss: { note: "estimated from the source file, minified by the harness, then gzipped", files: themeCss },
    pageCss: { after: { files: after.files, gzipKb: kb(after.gzip) }, before: beforeCss ? { files: beforeCss.files, gzipKb: kb(beforeCss.gzip) } : null, growthKb },
    notes,
    failures,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  for (const row of sceneRows) {
    const lazy = row.lazy.length ? `, lazy ${row.lazyGzipKb} KB in ${row.lazy.length} chunks` : "";
    console.log(`scene  ${row.key.padEnd(14)} ${row.gzipKb === null ? "not built" : `${row.gzipKb} KB`} ${row.entry ? `(${basename(row.entry)} + ${row.themeOnly.length} theme-only${lazy})` : ""}`);
  }
  console.log(`shared world ${sharedKb} KB (${shared.size} chunks); chrome ${chromeKb} KB (${chromeEntries.length} entries, ${chromeClosure.size} chunks)`);
  console.log(`bridge ${bridgeRow ? `${bridgeRow.gzipKb} KB gzip, ${bridgeRow.rawBytes} bytes raw` : "not built"}`);
  for (const row of themeCss) console.log(`css    ${row.key.padEnd(14)} ${row.gzipKb === null ? "not written" : `${row.gzipKb} KB${row.target ? "" : " (over the 3.5 KB target)"}`}`);
  console.log(`page CSS ${kb(after.gzip)} KB${beforeCss ? ` (before ${kb(beforeCss.gzip)} KB, growth ${growthKb} KB)` : ""}`);
  for (const note of notes) console.log(`note: ${note}`);
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.log(`report ${reportPath}`);
  return failures.length ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
