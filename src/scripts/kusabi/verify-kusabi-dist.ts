// Checks a finished build for what must never ship. Run after building:
//
//   pnpm kusabi:verify-dist [buildDir]     (default: dist)
//
// Exits non-zero and lists every problem it found.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { CHAPTER_UNITS, EXTRA_UNITS } from "../../data/kusabi/units";

const dist = join(process.cwd(), process.argv[2] ?? "dist");
const problems: string[] = [];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const TEXT = /\.(html|js|css|json|xml|txt)$/;
const name = (path: string) => relative(dist, path).replaceAll("\\", "/");
const files = walk(dist);
const textFiles = files.filter((path) => TEXT.test(path));
const read = (path: string) => readFileSync(path, "utf8");

// The next novel must not be named or hinted at anywhere on the site.
for (const path of textFiles) {
  if (/hizumi|歪み|ฮิซุมิ/i.test(read(path))) problems.push(`${name(path)} names the next novel`);
}

// No draft, fifties pose, wooden house or revealing file name.
for (const path of files.filter((file) => /assets[\\/]kusabi|_astro/.test(file))) {
  const file = name(path);
  if (file.startsWith("_astro/") && !/chapter-|epilogue|kusabi/i.test(file)) continue;
  if (/50s|draft|shion|killer|adult|boat|wedding|twins|ayame|home-hero/i.test(file)) problems.push(`revealing or retired file: ${file}`);
}

// The pages a new reader lands on carry no reveal in their source.
for (const page of ["kusabi/index.html", "kusabi/characters/index.html", "kusabi/extra/index.html", "kusabi/case-map/index.html", "index.html"]) {
  const path = join(dist, page);
  if (!existsSync(path)) {
    problems.push(`missing page: ${page}`);
    continue;
  }
  const source = read(path);
  const kusabiPart = page === "index.html" ? (source.match(/data-novel-slug="kusabi"[\s\S]{0,2500}/)?.[0] ?? "") : source;
  for (const word of ["ชิอง", "มาโดกะ", "อายาเมะ", "ฆาตกร", "ริสะหาย", "home-hero"]) {
    if (kusabiPart.includes(word)) problems.push(`${page} contains "${word}"`);
  }
}

// Client bundles never carry the vault's contents.
for (const path of textFiles.filter((file) => name(file).startsWith("_astro/") && file.endsWith(".js"))) {
  const source = read(path);
  if (/ชิอง|อายาเมะ|คนสวมหน้ากาก/.test(source)) problems.push(`${name(path)} carries secret text`);
}

// Every published unit has its page; E05 stays out until the author decides.
for (const unit of CHAPTER_UNITS) {
  if (!existsSync(join(dist, `kusabi/chapters/${unit.id}/index.html`))) problems.push(`missing chapter ${unit.id}`);
}
for (const unit of EXTRA_UNITS) {
  const page = existsSync(join(dist, `kusabi/extra/${unit.id}/index.html`));
  const vault = existsSync(join(dist, `kusabi/vault/x${unit.number}.json`));
  if (unit.published && (!page || !vault)) problems.push(`missing Extra ${unit.id}`);
  if (!unit.published && (page || vault)) problems.push(`unpublished Extra ${unit.id} was built`);
}
const unpublished = EXTRA_UNITS.filter((unit) => !unit.published);
for (const unit of unpublished) {
  const draft = read(join(process.cwd(), `src/content/kusabi/extras/${unit.id}.md`));
  const title = draft.match(/^title: "(.+)"$/m)?.[1];
  const sentence = draft.split("\n").find((line) => line.length > 120);
  for (const path of textFiles) {
    const source = read(path);
    if ((title && source.includes(title)) || (sentence && source.includes(sentence))) problems.push(`${name(path)} leaks ${unit.id}`);
  }
}

if (problems.length > 0) {
  console.error(`${problems.length} problem(s):\n${problems.map((problem) => `  ${problem}`).join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`OK: checked ${files.length} files, ${textFiles.length} of them text, in ${relative(process.cwd(), dist)}`);
}
