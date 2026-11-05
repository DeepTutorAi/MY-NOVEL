// Browser side of progress-core.ts. Every read goes through localStorage.getItem,
// which ProfileStorageInterceptor maps to the active profile. New keys stay under
// kusabi:secret: or kusabi:reading:, prefixes the interceptor already scopes.
import { BYPASS_KEY, bypassMatches, parseReadList, READS_KEY, readProgress, type GetItem, type KusabiProgress } from "./progress-core";

export const safeGet: GetItem = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export function safeSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Restricted storage: nothing to remove.
  }
}

export async function loadProgress(): Promise<KusabiProgress> {
  return readProgress(safeGet, await bypassMatches(safeGet(BYPASS_KEY)));
}

/** Without the async bypass check, for code that must not wait a frame. */
export function loadProgressSync(): KusabiProgress {
  return readProgress(safeGet);
}

export const loadReadList = (): string[] => parseReadList(safeGet(READS_KEY));
