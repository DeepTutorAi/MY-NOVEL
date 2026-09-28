// Pure helpers for the /sea/ home: the resume chip and the table-of-contents
// read marks. No DOM or storage access, so node --test can cover them.
import { COMPLETED_PROGRESS as COMPLETED, MIN_TRACKED_PROGRESS as MIN_TRACKED } from "../reader/reading-progress";

export interface SeaHomeUnit {
  id: string;
  number: number;
}

export interface SeaResumeTarget {
  label: string;
  href: string;
  /** Chapter whose saved position the chip points at (for "clear"). */
  chapterId: string;
  legacy: boolean;
}

export const unitLabel = (number: number) => (number === 0 ? "บทนำ" : `บทที่ ${number}`);

/**
 * Resume target from a saved sea:reading:last record. v2 records carry
 * chapterId; v1 records ({ arcId, progress }) came from the old arc layout,
 * which only ever published the prologue, so they resume chapter 00.
 * Chapters that are not in `units` (unpublished) never produce a chip.
 */
export function resolveResume(
  saved: Record<string, unknown> | null,
  units: readonly SeaHomeUnit[],
  chapterBase: string,
): SeaResumeTarget | null {
  if (!saved) return null;
  const legacy = typeof saved.chapterId !== "string" && typeof saved.arcId === "string";
  const chapterId = typeof saved.chapterId === "string" ? saved.chapterId : legacy ? "00" : null;
  const progress = Number(saved.progress);
  const index = units.findIndex((unit) => unit.id === chapterId);
  if (!chapterId || index < 0 || !Number.isFinite(progress) || progress < MIN_TRACKED) return null;

  const unit = units[index];
  if (progress >= COMPLETED) {
    const next = units[index + 1];
    return next
      ? { label: `อ่านต่อ · ${unitLabel(next.number)}`, href: `${chapterBase}${next.id}/`, chapterId, legacy }
      : { label: `อ่านอีกครั้ง · ${unitLabel(unit.number)}`, href: `${chapterBase}${unit.id}/`, chapterId, legacy };
  }
  const percent = Math.max(1, Math.min(99, Math.round(progress * 100)));
  return {
    label: `อ่านต่อ · ${unitLabel(unit.number)} · ${percent}%`,
    href: `${chapterBase}${unit.id}/?resume=1`,
    chapterId,
    legacy,
  };
}

/** Visible read mark and its spoken form, or null when the chapter is unread. */
export function readMark(ratio: number | null): { text: string; spoken: string } | null {
  if (ratio === null || !Number.isFinite(ratio) || ratio < MIN_TRACKED) return null;
  if (ratio >= COMPLETED) return { text: "✓", spoken: "อ่านจบแล้ว" };
  const percent = Math.max(1, Math.min(99, Math.round(ratio * 100)));
  return { text: `${percent}%`, spoken: `อ่านแล้ว ${percent}%` };
}

export const cutscenePlayedKey = (arc: number | string) => `sea:cutscene:played:${arc}`;
