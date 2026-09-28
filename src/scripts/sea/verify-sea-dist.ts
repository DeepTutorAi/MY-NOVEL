// Post-build guard for the Sea output: only published chapters may reach dist.
//
// Checks, against sea-chapter-manifest.ts and data/sea/arcs.ts:
//   - dist/sea/chapters holds exactly the published chapter ids (draft === false);
//     a missing directory fails too, which catches a build that ran against an
//     empty content collection;
//   - no html/js/css/json/xml/txt/md/svg file under dist mentions a draft
//     chapter's route, its source path, or its first paragraph;
//   - no such file carries the Thai or English title of an arc that has no
//     published chapter, or a draft chapter's title (published Sea chapter
//     prose is excluded, since the story may use those words in-world);
//   - no Sea working material (prompts/, */drafts/ under assets/sea) was
//     copied from public/;
//   - the legacy arc URL still redirects to the prologue;
//   - the other novels' collection routes are not empty, which catches a
//     build that silently ran against a cleared content store.
//
// Run after `pnpm build` (also after `GITHUB_ACTIONS=true pnpm build`):
//   pnpm sea:verify-dist
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { SEA_ARCS } from "../../data/sea/arcs";
import { SEA_CHAPTER_MANIFEST } from "./sea-chapter-manifest";
import { SEA_CHAPTERS_DIR } from "./sync-sea-chapters";

const SCANNED_EXTENSIONS = new Set([".html", ".js", ".mjs", ".css", ".json", ".xml", ".txt", ".webmanifest", ".md", ".svg"]);
// Sea working material that must stay out of the deployed site.
const WORKING_ASSET = /^assets\/sea\/(?:.*\/)?(?:prompts|drafts[^/]*)\//;
// Collection-driven routes of the other novels; an empty one means the build
// ran against a cleared content store.
const CONTROL_ROUTES = ["lodge/chapters", "kusabi/chapters", "tsukinomi/sections"];
// Shorter draft titles (e.g. "ม่าน") are ordinary words and would match anywhere.
const MIN_TITLE_NEEDLE = 6;
const LEGACY_REDIRECT = "sea/arcs/arc-01/01-introduction/index.html";
// Characters that markdown, smartypants or HTML escaping may rewrite; probes
// are taken from runs of text that contain none of them.
const UNSTABLE_CHARS = /["'`&<>*_[\]()\\—–\-.…!?:;\n]/;
const PROBE_MIN = 24;
const PROBE_MAX = 80;

interface DistFile {
  path: string;
  text: string;
}

interface Needle {
  label: string;
  value: string;
  /** Skip published Sea chapter prose when searching for this needle. */
  outsideProse?: boolean;
}

export function frontmatterTitle(markdown: string): string | null {
  const text = markdown.replace(/\r\n?/g, "\n");
  const block = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? "";
  const match = /^title:\s*(".*")\s*$/m.exec(block);
  return match ? (JSON.parse(match[1]) as string) : null;
}

export function stripFrontmatter(markdown: string): string {
  const text = markdown.replace(/\r\n?/g, "\n");
  const match = /^---\n[\s\S]*?\n---\n/.exec(text);
  return match ? text.slice(match[0].length) : text;
}

/**
 * A stable plain-text probe for the first substantial paragraph of a chapter:
 * the longest run of the paragraph that markdown rendering leaves unchanged.
 */
export function firstParagraphProbe(body: string): string | null {
  for (const block of body.split(/\n\s*\n/)) {
    const line = block.trim();
    if (!line || line.startsWith("#") || /^-{3,}$/.test(line) || line.startsWith(":::")) continue;
    const runs = line
      .split(UNSTABLE_CHARS)
      .map((run) => run.trim())
      .sort((a, b) => b.length - a.length);
    const best = runs[0];
    if (best && best.length >= PROBE_MIN) return best.slice(0, PROBE_MAX).trim();
  }
  return null;
}

/** Removes the `.sea-prose` element (author prose) from a chapter page. */
export function stripSeaProse(html: string): string {
  const open = /<div\b[^>]*\bclass="sea-prose\b[^"]*"[^>]*>/.exec(html);
  if (!open) return html;
  const tag = /<(\/?)div\b[^>]*>/g;
  tag.lastIndex = open.index + open[0].length;
  let depth = 1;
  for (let match = tag.exec(html); match; match = tag.exec(html)) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return html.slice(0, open.index) + html.slice(tag.lastIndex);
  }
  return html.slice(0, open.index);
}

function decodeScriptEscapes(text: string): string {
  return text
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\//g, "/");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

export function verifySeaDist(root: string): { errors: string[]; notes: string[] } {
  const errors: string[] = [];
  const notes: string[] = [];
  const dist = join(root, "dist");
  const chaptersDir = join(dist, "sea", "chapters");

  if (!existsSync(dist)) return { errors: ["dist/ is missing. Run pnpm build first."], notes };

  const published = SEA_CHAPTER_MANIFEST.filter((entry) => !entry.draft);
  const drafts = SEA_CHAPTER_MANIFEST.filter((entry) => entry.draft);
  const publishedIds = published.map((entry) => entry.id).sort();

  if (!existsSync(chaptersDir)) {
    errors.push(
      "dist/sea/chapters is missing: the build produced no Sea chapters " +
        "(an empty seaChapters collection, often a stale content cache). Rebuild and verify again.",
    );
  } else {
    const built = readdirSync(chaptersDir)
      .filter((name) => statSync(join(chaptersDir, name)).isDirectory())
      .sort();
    const missing = publishedIds.filter((id) => !built.includes(id));
    const extra = built.filter((id) => !publishedIds.includes(id));
    if (missing.length) errors.push(`dist/sea/chapters lacks published chapters: ${missing.join(", ")}`);
    if (extra.length) errors.push(`dist/sea/chapters has unpublished chapters: ${extra.join(", ")}`);
    for (const id of publishedIds.filter((id) => built.includes(id))) {
      if (!existsSync(join(chaptersDir, id, "index.html"))) errors.push(`dist/sea/chapters/${id}/index.html is missing`);
    }
  }

  const redirect = join(dist, LEGACY_REDIRECT);
  if (!existsSync(redirect)) {
    errors.push(`legacy redirect dist/${LEGACY_REDIRECT} is missing`);
  } else if (!readFileSync(redirect, "utf8").includes("sea/chapters/00/")) {
    errors.push(`legacy redirect dist/${LEGACY_REDIRECT} does not point at sea/chapters/00/`);
  }

  for (const route of CONTROL_ROUTES) {
    const dir = join(dist, route);
    const pages = existsSync(dir) ? readdirSync(dir).filter((name) => existsSync(join(dir, name, "index.html"))) : [];
    if (pages.length === 0) {
      errors.push(`dist/${route} has no pages: the build likely ran against a cleared content store. Rebuild and verify again.`);
    }
  }

  const chapterSource = (id: string) => {
    const file = join(root, SEA_CHAPTERS_DIR, `${id}.md`);
    if (!existsSync(file)) {
      errors.push(`${SEA_CHAPTERS_DIR}/${id}.md is missing. Run pnpm sea:sync.`);
      return "";
    }
    return readFileSync(file, "utf8");
  };
  const chapterBody = (id: string) => stripFrontmatter(chapterSource(id));

  const needles: Needle[] = [];
  for (const entry of drafts) {
    needles.push({ label: `route of draft ${entry.id}`, value: `/sea/chapters/${entry.id}/` });
    needles.push({ label: `source of draft ${entry.id}`, value: entry.source });
    needles.push({ label: `source of draft ${entry.id}`, value: entry.source.replaceAll("/", "\\") });
    needles.push({ label: `content file of draft ${entry.id}`, value: `${SEA_CHAPTERS_DIR}/${entry.id}.md` });
    const probe = firstParagraphProbe(chapterBody(entry.id));
    if (probe) needles.push({ label: `first paragraph of draft ${entry.id}`, value: probe });
    else errors.push(`draft ${entry.id}: no paragraph long enough to probe`);
    const title = frontmatterTitle(chapterSource(entry.id));
    if (title && [...title].length >= MIN_TITLE_NEEDLE) {
      needles.push({ label: `title of draft ${entry.id}`, value: title, outsideProse: true });
    }
  }

  const publishedArcs = new Set(published.map((entry) => entry.arc));
  const sealedArcs = SEA_ARCS.filter((arc) => !publishedArcs.has(arc.number));
  for (const arc of sealedArcs) {
    needles.push({ label: `title of unpublished arc ${arc.number}`, value: arc.titleTh, outsideProse: true });
    // Without the article, so "a failed Dead Parliament" still matches "The Dead Parliament".
    needles.push({ label: `title of unpublished arc ${arc.number}`, value: arc.titleEn.replace(/^The /, ""), outsideProse: true });
  }

  const allPaths = walk(dist);
  const working = allPaths
    .map((path) => relative(dist, path).replaceAll("\\", "/"))
    .filter((path) => WORKING_ASSET.test(path));
  if (working.length) {
    const shown = working.slice(0, 5).map((path) => `dist/${path}`).join(", ");
    errors.push(
      `Sea working material copied from public/ (${working.length} files): ${shown}` +
        (working.length > 5 ? ` (+${working.length - 5} more)` : ""),
    );
  }

  const files: DistFile[] = allPaths.filter((path) => SCANNED_EXTENSIONS.has(extname(path).toLowerCase())).map((path) => {
    const raw = readFileSync(path, "utf8");
    return { path: relative(dist, path).replaceAll("\\", "/"), text: /\.(m?js|json)$/.test(path) ? decodeScriptEscapes(raw) : raw };
  });
  const isChapterPage = (path: string) => /^sea\/chapters\/[^/]+\/index\.html$/.test(path);

  const hits = new Map<string, string[]>();
  for (const file of files) {
    const withoutProse = isChapterPage(file.path) ? stripSeaProse(file.text) : file.text;
    for (const needle of needles) {
      const haystack = needle.outsideProse ? withoutProse : file.text;
      if (!haystack.includes(needle.value)) continue;
      const key = `${needle.label}: "${needle.value}"`;
      hits.set(key, [...(hits.get(key) ?? []), `dist/${file.path}`]);
    }
  }
  for (const [needle, paths] of hits) {
    const shown = paths.slice(0, 5).join(", ") + (paths.length > 5 ? ` (+${paths.length - 5} more)` : "");
    errors.push(`${needle} found in ${shown}`);
  }

  // Positive controls: the probes and title search must find published
  // material, otherwise a clean result above would prove nothing.
  const byPath = new Map(files.map((file) => [file.path, file.text]));
  for (const entry of published) {
    const page = byPath.get(`sea/chapters/${entry.id}/index.html`);
    if (!page) continue;
    const probe = firstParagraphProbe(chapterBody(entry.id));
    if (!probe) errors.push(`published ${entry.id}: no paragraph long enough to probe`);
    else if (!page.includes(probe)) errors.push(`probe self-check failed: published ${entry.id} page lacks "${probe}"`);
  }
  for (const arc of SEA_ARCS.filter((arc) => publishedArcs.has(arc.number))) {
    if (![...byPath.values()].some((text) => text.includes(arc.titleTh))) {
      errors.push(`title self-check failed: published arc ${arc.number} title "${arc.titleTh}" appears nowhere in dist`);
    }
  }

  notes.push(
    `published chapters: ${publishedIds.join(", ")}`,
    `draft chapters checked: ${drafts.map((entry) => entry.id).join(", ") || "none"}`,
    `sealed arcs checked: ${sealedArcs.map((arc) => arc.number).join(", ") || "none"}`,
    `files scanned: ${files.length}`,
  );
  return { errors, notes };
}

const isMain = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;

if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const { errors, notes } = verifySeaDist(root);
  for (const note of notes) console.log(note);
  if (errors.length) {
    console.error(`sea:verify-dist FAILED (${errors.length}):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
  } else {
    console.log("sea:verify-dist: OK");
  }
}
