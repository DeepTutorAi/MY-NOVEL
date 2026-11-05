// Pure rules of the reading page.

export const MIN_TRACKED_PROGRESS = 0.005;
export const SAVE_INTERVAL_MS = 800;
export const COMPLETED_PROGRESS = 0.995;

export function scrollRatio(scrollTop: number, scrollHeight: number, viewHeight: number): number {
  const max = scrollHeight - viewHeight;
  if (max <= 0) return 1;
  return Math.min(1, Math.max(0, scrollTop / max));
}

/** The tape counter shows 000 at the first line and 999 at the end. */
export function counterDigits(ratio: number): string {
  const safe = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  return String(Math.floor(safe * 999)).padStart(3, "0");
}

/** Tape moves from the left reel to the right one, so their sizes trade places. */
export function reelSizes(ratio: number): { left: number; right: number } {
  const safe = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  return { left: 1 - 0.42 * safe, right: 0.58 + 0.42 * safe };
}

export function clockLabel(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** "อย่าเร่ง" appears only from CH8 on, where the word is on the wall. */
export const DONT_RUSH_FROM_CHAPTER = 8;
const FAST_VIEWS_PER_SECOND = 3.2;
const FAST_SUSTAIN_MS = 1200;

/**
 * Reports true once the reader has been scrolling very fast for over a second.
 * A single jump (a resume, a heading link) has no duration, so it never counts.
 */
export function createFastScrollDetector(): (scrollTop: number, viewHeight: number, now: number) => boolean {
  let lastTop = 0;
  let lastAt = -1;
  let fastSince = -1;
  return (scrollTop, viewHeight, now) => {
    if (lastAt < 0 || now - lastAt > 300) {
      lastTop = scrollTop;
      lastAt = now;
      fastSince = -1;
      return false;
    }
    const elapsed = now - lastAt;
    if (elapsed <= 0) return false;
    const speed = (scrollTop - lastTop) / Math.max(1, viewHeight) / (elapsed / 1000);
    lastTop = scrollTop;
    lastAt = now;
    if (speed < FAST_VIEWS_PER_SECOND) {
      fastSince = -1;
      return false;
    }
    if (fastSince < 0) fastSince = now;
    return now - fastSince >= FAST_SUSTAIN_MS;
  };
}

export const todayStamp = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
