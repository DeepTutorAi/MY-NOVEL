// How far the reader has come, for the character page and the Extra train.
// Pure: the storage is passed in, so node --test covers every rule. The keys are
// the ones the reader's progress already lives under; nothing here resets them.
import { isDevToken } from "../_shared/dev-key";

export const SECRET_READS_KEY = "tsukinomi:reading:secret:reads";
export const SECRET_DEPTHS_KEY = "tsukinomi:reading:secret:depths";
export const LAST_READING_KEY = "tsukinomi:reading:last";
/** The last chapter finished, kept by the reader (ReadingProgress.astro). */
export const CHAPTERS_DONE_KEY = "tsukinomi:reading:chapters:done";
export const REVEALED_KEY = "tsukinomi:characters:revealed";
/** The chapter the reader had reached when they last opened the character page. */
export const SEEN_CHAPTER_KEY = "tsukinomi:characters:seen-chapter";
export const BYPASS_KEY = "tsukinomi:extra-bypassed";

export const TOTAL_SECTIONS = 5;
export const TOTAL_CHAPTERS = 18;
export const UNLOCK_THRESHOLD = 4; // 80% of 5 is 4 sections
export const REQUIRED_FINAL_SECTION_ID = "05-ten-years";
export const SECTION_IDS = ["01-discovery", "02-reveal", "03-decision", "04-mountain", REQUIRED_FINAL_SECTION_ID] as const;
/** The last chapter of each part, in the order of SECTION_IDS. */
const PART_LAST_CHAPTER = [3, 6, 10, 16, 18];
/** A part scrolled this far counts as read, for a reader from before chapters were recorded. */
const PART_DONE_DEPTH = 0.98;
/** The old flag was set on opening part 3, so that reader had finished chapter 6. */
const REVEALED_CHAPTER = 6;

/**
 * The chapter that opens each closed stop on the route, in route order. The vault's
 * cards come in this same order, and a contract test holds the two together.
 */
export const STOP_CHAPTERS: readonly number[] = [1, 1, 1, 2, 4, 6, 9];

/** The number on a stop's sign, like a Japanese station number. */
export const stopNumber = (index: number) => `TS ${String(index + 1).padStart(2, "0")}`;

export type GetItem = (key: string) => string | null;

/** Parts really read (time and depth, ReadingProgress.astro decides), without the prologue. */
export function parseSecretReads(raw: string | null): string[] {
  if (raw === null) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const valid: readonly string[] = SECTION_IDS;
    return [...new Set(list.filter((id): id is string => typeof id === "string" && id !== "00-introduction" && valid.includes(id)))];
  } catch {
    return [];
  }
}

export function extraOpen(reads: readonly string[]): boolean {
  return reads.length >= UNLOCK_THRESHOLD && reads.includes(REQUIRED_FINAL_SECTION_ID);
}

const parseJson = (raw: string | null): Record<string, unknown> | null => {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

/**
 * The last chapter the reader has finished. Opening a part does not count, so a page
 * cannot spoil a chapter nobody has read. A reader from before chapters were recorded
 * keeps every part they finished.
 */
export function chaptersDone(getItem: GetItem, reads: readonly string[]): number {
  const recorded = Number(getItem(CHAPTERS_DONE_KEY));
  let done = Number.isInteger(recorded) ? Math.min(Math.max(recorded, 0), TOTAL_CHAPTERS) : 0;
  const depths = parseJson(getItem(SECRET_DEPTHS_KEY));
  SECTION_IDS.forEach((id, index) => {
    if (reads.includes(id) || Number(depths?.[id] ?? 0) >= PART_DONE_DEPTH) done = Math.max(done, PART_LAST_CHAPTER[index]);
  });
  if (getItem(REVEALED_KEY) === "true") done = Math.max(done, REVEALED_CHAPTER);
  return done;
}

/** The furthest part opened, for the lit carriages of the sky: the last one read, or any section record past 60%. Other profiles' records do not count. */
export function maxSectionRead(getItem: GetItem, keys: readonly string[], activeProfile: string): number {
  let furthest = Number(parseJson(getItem(LAST_READING_KEY))?.sectionNumber ?? 0);
  if (!Number.isFinite(furthest)) furthest = 0;
  for (const key of keys) {
    if (!key.startsWith("tsukinomi:reading:section:")) continue;
    if (key.includes(":p_") && !key.endsWith(`:${activeProfile}`)) continue;
    const saved = parseJson(getItem(key));
    const section = Number(saved?.sectionNumber ?? 0);
    if (Number.isFinite(section) && Number(saved?.progress ?? 0) >= 0.6) furthest = Math.max(furthest, section);
  }
  return furthest;
}

/** Whether a stored value is the developer shortcut. */
export const bypassMatches = isDevToken;
