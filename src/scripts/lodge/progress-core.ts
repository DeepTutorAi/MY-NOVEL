// Reading progress rules shared by every Lodge surface that reacts to how far
// the reader got (design section 4.1). Pure: callers pass the storage entries
// in, so profile handling and malformed records are tested without a browser.

export const CHAPTER_KEY_PREFIX = "hvitveldt:reading:chapter:";
const PROFILE_KEY = "piichan-novels:active-profile-id";

/** A chapter counts as finished for spoiler-gated content (matches the home resume card). */
export const FINISHED = 0.995;
/** The existing characters page unlock threshold, kept as it was. */
export const UNLOCK = 0.8;

export type DriftLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Highest saved progress per chapter number. Keys of other profiles (suffixed
 * ":p_<id>" by ProfileStorageInterceptor) are skipped; unsuffixed legacy keys count.
 */
export function readChapterProgress(
  entries: Iterable<readonly [key: string, raw: string | null]>,
  activeProfile: string,
): Map<number, number> {
  const progress = new Map<number, number>();
  for (const [key, raw] of entries) {
    if (!key.startsWith(CHAPTER_KEY_PREFIX) || raw === null) continue;
    if (key.includes(":p_") && !key.endsWith(`:${activeProfile}`)) continue;
    let saved: unknown;
    try {
      saved = JSON.parse(raw);
    } catch {
      continue;
    }
    if (typeof saved !== "object" || saved === null) continue;
    const { chapterNumber, progress: value } = saved as { chapterNumber?: unknown; progress?: unknown };
    const chapter = Number(chapterNumber);
    if (!Number.isInteger(chapter) || typeof value !== "number" || !Number.isFinite(value)) continue;
    progress.set(chapter, Math.max(progress.get(chapter) ?? 0, value));
  }
  return progress;
}

export function finishedChapters(progress: ReadonlyMap<number, number>, threshold: number): Set<number> {
  const finished = new Set<number>();
  for (const [chapter, value] of progress) if (value >= threshold) finished.add(chapter);
  return finished;
}

export function furthestAtLeast(progress: ReadonlyMap<number, number>, threshold: number): number {
  let furthest = 0;
  for (const [chapter, value] of progress) if (value >= threshold) furthest = Math.max(furthest, chapter);
  return furthest;
}

export function lodgeDrift(finished: ReadonlySet<number>): DriftLevel {
  if (!finished.has(5)) return finished.size > 0 ? 1 : 0;
  if (!finished.has(12)) return 2;
  return finished.has(18) ? 4 : 3;
}

export function storageEntries(storage: Storage): Array<[string, string | null]> {
  try {
    const entries: Array<[string, string | null]> = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key !== null) entries.push([key, storage.getItem(key)]);
    }
    return entries;
  } catch {
    return [];
  }
}

export function activeProfileId(storage: Storage): string {
  try {
    return storage.getItem(PROFILE_KEY) || "guest";
  } catch {
    return "guest";
  }
}

/** Finished chapters of the active profile, read from localStorage. */
export function readFinished(storage: Storage, threshold: number = FINISHED): Set<number> {
  return finishedChapters(readChapterProgress(storageEntries(storage), activeProfileId(storage)), threshold);
}
