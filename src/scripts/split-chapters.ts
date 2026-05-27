import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { actForChapter } from "../utils/act-for-chapter";

interface ChapterSource {
  number: number;
  title: string;
  bodyLines: string[];
}

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, "hvitveldt_lodge.txt");
const CHAPTERS_DIR = path.join(ROOT, "src", "content", "chapters");
const EXTRAS_DIR = path.join(ROOT, "src", "content", "extras");

const CHAPTER_START_RE = /^=== Chapter (\d+) — (.+) ===$/;
const CHAPTER_END_RE = /^=== End Chapter (\d+) ===$/;
const PUZZLE_MAP_RE = /^\s*PUZZLE MAP\b/;
const SEPARATOR_RE = /^=+$/;
const HR_RE = /^\s*\*\s+\*\s+\*\s*$/;
const THAI_CHAR_RE = /[\u0E00-\u0E7F]/g;

function slugifyTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function yamlString(value: string) {
  return JSON.stringify(value);
}

function normalizeBody(lines: string[]) {
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (HR_RE.test(line)) {
      output.push("---");
      continue;
    }

    if (/^ {2,}\S/.test(line)) {
      const block: string[] = [];

      while (index < lines.length) {
        const blockLine = lines[index] ?? "";
        const nextLine = lines[index + 1] ?? "";
        const isIndented = /^ {2,}\S/.test(blockLine);
        const isBlankInsideBlock =
          blockLine.trim() === "" && index + 1 < lines.length && /^ {2,}\S/.test(nextLine);

        if (!isIndented && !isBlankInsideBlock) {
          break;
        }

        block.push(isIndented ? blockLine.replace(/^ {2}/, "") : "");
        index += 1;
      }

      index -= 1;
      output.push(":::journal", ...trimOuterBlankLines(block), ":::");
      continue;
    }

    output.push(line);
  }

  return trimOuterBlankLines(output).join("\n").replace(/\n{3,}/g, "\n\n");
}

function trimOuterBlankLines(lines: string[]) {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start]?.trim() === "") {
    start += 1;
  }

  while (end > start && lines[end - 1]?.trim() === "") {
    end -= 1;
  }

  return lines.slice(start, end);
}

function extractChapters(lines: string[]) {
  const chapters: ChapterSource[] = [];
  let index = 0;

  while (index < lines.length) {
    const startMatch = lines[index]?.match(CHAPTER_START_RE);

    if (!startMatch) {
      index += 1;
      continue;
    }

    const number = Number(startMatch[1]);
    const title = startMatch[2] ?? "";
    const bodyLines: string[] = [];
    index += 1;

    while (index < lines.length) {
      const endMatch = lines[index]?.match(CHAPTER_END_RE);

      if (endMatch) {
        const endNumber = Number(endMatch[1]);

        if (endNumber !== number) {
          throw new Error(`Chapter ${number} closed by mismatched end marker ${endNumber}.`);
        }

        break;
      }

      bodyLines.push(lines[index] ?? "");
      index += 1;
    }

    if (index >= lines.length) {
      throw new Error(`Chapter ${number} is missing its end marker.`);
    }

    chapters.push({ number, title, bodyLines });
    index += 1;
  }

  return chapters;
}

function extractPuzzleMap(lines: string[]) {
  const puzzleIndex = lines.findIndex((line) => PUZZLE_MAP_RE.test(line));

  if (puzzleIndex === -1) {
    throw new Error("Could not find PUZZLE MAP appendix.");
  }

  const raw = lines.slice(puzzleIndex + 1);
  const contentStart = raw.findIndex(
    (line) => line.trim() !== "" && !SEPARATOR_RE.test(line.trim()),
  );

  if (contentStart === -1) {
    throw new Error("PUZZLE MAP appendix is empty.");
  }

  const contentLines = raw.slice(contentStart);
  const contentEnd = contentLines.findIndex((line) => SEPARATOR_RE.test(line.trim()));
  const puzzleLines = contentEnd === -1 ? contentLines : contentLines.slice(0, contentEnd);

  return normalizePuzzleBody(puzzleLines);
}

function normalizePuzzleBody(lines: string[]) {
  return trimOuterBlankLines(lines)
    .map((line) => {
      if (HR_RE.test(line)) {
        return "---";
      }

      return line.replace(/^ {2}/, "");
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function chapterMarkdown(chapter: ChapterSource) {
  const act = actForChapter(chapter.number);
  const body = normalizeBody(chapter.bodyLines);
  const thaiChars = body.match(THAI_CHAR_RE)?.length ?? 0;
  const wordsThai = Math.ceil(thaiChars / 3);
  const readingMinutes = Math.max(1, Math.ceil(wordsThai / 250));

  return [
    "---",
    `number: ${chapter.number}`,
    `title: ${yamlString(chapter.title)}`,
    'thaiTitle: ""',
    `act: ${act.number}`,
    `actTitle: ${yamlString(act.title)}`,
    'summary: ""',
    `wordsThai: ${wordsThai}`,
    `readingMinutes: ${readingMinutes}`,
    "---",
    "",
    body,
    "",
  ].join("\n");
}

async function main() {
  const source = await readFile(SOURCE_PATH, "utf8");
  const lines = source.split(/\r?\n/);
  const chapters = extractChapters(lines);

  if (chapters.length !== 18) {
    throw new Error(`Expected 18 chapters, found ${chapters.length}.`);
  }

  const seenNumbers = new Set(chapters.map((chapter) => chapter.number));

  for (let expected = 1; expected <= 18; expected += 1) {
    if (!seenNumbers.has(expected)) {
      throw new Error(`Missing chapter ${expected}.`);
    }
  }

  await rm(CHAPTERS_DIR, { recursive: true, force: true });
  await rm(EXTRAS_DIR, { recursive: true, force: true });
  await mkdir(CHAPTERS_DIR, { recursive: true });
  await mkdir(EXTRAS_DIR, { recursive: true });

  for (const chapter of chapters) {
    const filename = `${String(chapter.number).padStart(2, "0")}-${slugifyTitle(
      chapter.title,
    )}.md`;
    await writeFile(path.join(CHAPTERS_DIR, filename), chapterMarkdown(chapter), "utf8");
  }

  const puzzleMarkdown = [
    "---",
    'title: "Puzzle Map"',
    'slug: "puzzle-map"',
    "---",
    "",
    extractPuzzleMap(lines),
    "",
  ].join("\n");

  await writeFile(path.join(EXTRAS_DIR, "puzzle-map.md"), puzzleMarkdown, "utf8");

  console.log(`Wrote ${chapters.length} chapters and 1 puzzle map.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
