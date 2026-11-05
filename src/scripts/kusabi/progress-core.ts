// Reading progress rules shared by every Kusabi page. Pure: callers pass a
// getItem, so ProfileStorageInterceptor's per-profile keys are honoured in the
// browser and tests need no DOM.
//
// Two thresholds on purpose. "Read" (the checkmark and the stored list)
// keeps its original 70% so nobody loses a checkmark. "Finished" drives every
// unlock and needs the end of the page: the reveals sit at about 78% of CH11 and
// 73% of the epilogue, so 70% would open a file before its scene.
import { CHAPTER_UNITS, EXTRA_UNITS, PROLOGUE_ID, EPILOGUE_ID, MAIN_CHAPTER_COUNT } from "../../data/kusabi/units";
import { UNLOCKS, type Rule, type UnlockId } from "../../data/kusabi/unlocks";

export const READ_SCROLL = 0.7;
export const MIN_ACTIVE_SECONDS = 120;
export const FINISH_SCROLL = 0.98;

export const READS_KEY = "kusabi:secret:reads";
export const BYPASS_KEY = "kusabi:extra-bypassed";
export const CASE_MAP_KEY = "kusabi:secret:case-map";
export const NOTICED_KEY = "kusabi:secret:noticed";
export const LAST_KEY = "kusabi:reading:last";
export const LAST_READ_KEY = "kusabi:reading:last-read";
export const EXTRA_LAST_KEY = "kusabi:reading:extra-last";
export const chapterKey = (id: string) => `kusabi:reading:chapter:${id}`;
export const extraKey = (id: string) => `kusabi:reading:extra:${id}`;

/** H2 = sha256(H1), H1 = sha256(password). The stored value is H1. */
export const BYPASS_H2 = "9c5144f57cc6d4eb640c116097b92fd94f5a4370379d732604003d2a15fef6de";

export interface ReadingRecord {
  progress: number;
  activeSeconds: number;
  maxScrollPct: number;
}

export type GetItem = (key: string) => string | null;

export function parseRecord(raw: string | null): ReadingRecord | null {
  if (raw === null) return null;
  let saved: unknown;
  try {
    saved = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof saved !== "object" || saved === null) return null;
  const { progress, activeSeconds, maxScrollPct } = saved as Record<string, unknown>;
  const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  return {
    progress: number(progress),
    activeSeconds: number(activeSeconds),
    maxScrollPct: Math.max(number(maxScrollPct), number(progress)),
  };
}

export const isFinishedRecord = (record: ReadingRecord | null): boolean =>
  record !== null && record.maxScrollPct >= FINISH_SCROLL && record.activeSeconds >= MIN_ACTIVE_SECONDS;

export const isReadRecord = (record: ReadingRecord | null): boolean =>
  record !== null && record.maxScrollPct >= READ_SCROLL && record.activeSeconds >= MIN_ACTIVE_SECONDS;

export function parseReadList(raw: string | null): string[] {
  if (raw === null) return [];
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Main chapters in the stored read list; the prologue and epilogue do not count. */
export function countMainRead(ids: readonly string[]): number {
  return new Set(ids.filter((id) => id !== PROLOGUE_ID && id !== EPILOGUE_ID && CHAPTER_UNITS.some((unit) => unit.id === id))).size;
}

export interface KusabiProgress {
  /** Numbers of the chapters finished, 0 (prologue) to 13 (epilogue). */
  chapters: Set<number>;
  extras: Set<string>;
  mainRead: number;
  caseMap: boolean;
  bypass: boolean;
}

export function readProgress(getItem: GetItem, bypass = false): KusabiProgress {
  const chapters = new Set<number>();
  for (const unit of CHAPTER_UNITS) {
    if (isFinishedRecord(parseRecord(getItem(chapterKey(unit.id))))) chapters.add(unit.number);
  }
  const extras = new Set<string>();
  for (const unit of EXTRA_UNITS) {
    if (isFinishedRecord(parseRecord(getItem(extraKey(unit.id))))) extras.add(unit.id);
  }
  return {
    chapters,
    extras,
    mainRead: Math.max(countMainRead(parseReadList(getItem(READS_KEY))), [...chapters].filter((n) => n >= 1 && n <= MAIN_CHAPTER_COUNT).length),
    caseMap: getItem(CASE_MAP_KEY) === "open",
    bypass,
  };
}

export function ruleHolds(rule: Rule, progress: KusabiProgress): boolean {
  if ("chapter" in rule) return progress.chapters.has(rule.chapter);
  if ("extra" in rule) return progress.extras.has(rule.extra);
  if ("mainRead" in rule) return progress.mainRead >= rule.mainRead;
  if ("caseMap" in rule) return progress.caseMap;
  if ("allOf" in rule) return rule.allOf.every((part) => ruleHolds(part, progress));
  return rule.anyOf.some((part) => ruleHolds(part, progress));
}

export function isUnlocked(id: UnlockId, progress: KusabiProgress): boolean {
  return progress.bypass || ruleHolds(UNLOCKS[id], progress);
}

export function unlockedIds(progress: KusabiProgress): UnlockId[] {
  return (Object.keys(UNLOCKS) as UnlockId[]).filter((id) => isUnlocked(id, progress));
}

/**
 * Hidden marks on the reading pages (design D8): 0 nothing, 1 REC after the first
 * watcher screen (end of CH7), 2 adds the camera label after CH11, 3 the signal
 * is lost after CH12, 4 the house is quiet again after the epilogue.
 */
export type DriftLevel = 0 | 1 | 2 | 3 | 4;

export function kusabiDrift(progress: KusabiProgress): DriftLevel {
  if (progress.chapters.has(13)) return 4;
  if (progress.chapters.has(12)) return 3;
  if (progress.chapters.has(11)) return 2;
  return progress.chapters.has(7) ? 1 : 0;
}

/** The home scene: the door stands ajar, closes after CH4, and the rain stops after the epilogue. */
export type ManorState = "ajar" | "closed" | "after";

export function manorState(progress: KusabiProgress): ManorState {
  if (progress.chapters.has(13)) return "after";
  return progress.chapters.has(4) ? "closed" : "ajar";
}

/** The chapter list shows a title once the reader has reached that chapter. */
export function reachedChapter(progress: KusabiProgress, readList: readonly string[]): number {
  let reached = 1;
  for (const unit of CHAPTER_UNITS) {
    if (progress.chapters.has(unit.number) || readList.includes(unit.id)) reached = Math.max(reached, unit.number + 1);
  }
  return progress.bypass ? 13 : Math.min(reached, 13);
}

export async function sha256Hex(message: string): Promise<string> {
  const bytes = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function bypassMatches(storedH1: string | null): Promise<boolean> {
  if (!storedH1) return false;
  try {
    return (await sha256Hex(storedH1)) === BYPASS_H2;
  } catch {
    return false;
  }
}
