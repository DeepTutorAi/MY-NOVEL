import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface SectionSpec {
  slug: string;
  path: string;
  startLine: number;
  endLine: number;
  chapters: readonly number[];
}

export interface SplitSection {
  spec: SectionSpec;
  lines: string[];
}

export const SECTION_SPECS = [
  {
    slug: "01-discovery",
    path: "src/content/tsukinomi/sections/01-discovery.md",
    startLine: 27,
    endLine: 3085,
    chapters: [1, 2, 3],
  },
  {
    slug: "02-reveal",
    path: "src/content/tsukinomi/sections/02-reveal.md",
    startLine: 3086,
    endLine: 6512,
    chapters: [4, 5, 6],
  },
  {
    slug: "03-decision",
    path: "src/content/tsukinomi/sections/03-decision.md",
    startLine: 6523,
    endLine: 10752,
    chapters: [7, 8, 9, 10],
  },
  {
    slug: "04-mountain",
    path: "src/content/tsukinomi/sections/04-mountain.md",
    startLine: 10753,
    endLine: 17799,
    chapters: [11, 12, 13, 14, 15, 16],
  },
  {
    slug: "05-ten-years",
    path: "src/content/tsukinomi/sections/05-ten-years.md",
    startLine: 17800,
    endLine: 20425,
    chapters: [17, 18],
  },
] as const satisfies readonly SectionSpec[];

const chapterHeadingPattern = /^=== Chapter (\d+) — (.+) ===$/;
const endChapterPattern = /^=== End Chapter \d+ ===$/;
const actBannerPattern = /^(?:END OF ACT \d|ACT \d)\b/;

function normalizeLines(source: string): string[] {
  return source.split(/\r?\n/);
}

function trimTrailingBlankLines(lines: string[]): string[] {
  const result = [...lines];
  while (result.length > 0 && result[result.length - 1] === "") {
    result.pop();
  }
  return result;
}

function assertChapters(section: SplitSection): void {
  const found = section.lines
    .map((line) => line.match(/^## บทที่ (\d+) — /)?.[1])
    .filter((chapter): chapter is string => Boolean(chapter))
    .map(Number);

  if (found.join(",") !== section.spec.chapters.join(",")) {
    throw new Error(
      `${section.spec.slug} expected chapters ${section.spec.chapters.join(", ")} but found ${found.join(", ")}`,
    );
  }
}

export function transformSectionLines(lines: string[]): string[] {
  const output: string[] = [];
  let stripFinalBanner = false;

  for (const line of lines) {
    const cleanLine = line.replace(/\r$/, "");
    const heading = cleanLine.match(chapterHeadingPattern);

    if (stripFinalBanner) {
      continue;
    }

    if (heading) {
      output.push(`## บทที่ ${heading[1]} — ${heading[2]} {#ch-${heading[1]}}`);
      continue;
    }

    if (endChapterPattern.test(cleanLine)) {
      if (cleanLine === "=== End Chapter 18 ===") {
        stripFinalBanner = true;
      }
      continue;
    }

    if (cleanLine === "================================================================" || actBannerPattern.test(cleanLine.trim())) {
      continue;
    }

    if (cleanLine === "=== จบ ===") {
      stripFinalBanner = true;
      continue;
    }

    output.push(cleanLine);
  }

  return trimTrailingBlankLines(output);
}

export function splitTsukinomiSource(source: string): SplitSection[] {
  const lines = normalizeLines(source);

  return SECTION_SPECS.map((spec) => {
    if (lines.length < spec.endLine) {
      throw new Error(
        `Source has ${lines.length} lines, but ${spec.slug} needs line ${spec.endLine}`,
      );
    }

    const section = {
      spec,
      lines: transformSectionLines(lines.slice(spec.startLine - 1, spec.endLine)),
    };

    assertChapters(section);
    return section;
  });
}

export function extractFrontmatter(markdown: string): string {
  const match = markdown.match(/^---\r?\n[\s\S]*?\r?\n---/);
  if (!match) {
    throw new Error("Section markdown is missing frontmatter");
  }

  return match[0].replace(/\r\n/g, "\n");
}

export function buildSectionMarkdown(frontmatter: string, lines: string[]): string {
  return `${frontmatter}\n\n${trimTrailingBlankLines(lines).join("\n")}\n`;
}

export function writeSections({
  sourcePath = "tsukinomi_station.txt",
  rootDir = process.cwd(),
}: {
  sourcePath?: string;
  rootDir?: string;
} = {}): void {
  const source = readFileSync(join(rootDir, sourcePath), "utf8");
  const sections = splitTsukinomiSource(source);

  for (const section of sections) {
    const targetPath = join(rootDir, section.spec.path);
    const frontmatter = extractFrontmatter(readFileSync(targetPath, "utf8"));
    writeFileSync(targetPath, buildSectionMarkdown(frontmatter, section.lines), "utf8");
  }
}

const isMain = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;

if (isMain) {
  writeSections();
}
