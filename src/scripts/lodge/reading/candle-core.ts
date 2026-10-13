// The reader's candle as chapter progress (design section 6.5): it burns down
// as the chapter is read, drips at each section passed and goes out at the end.
import { FINISHED } from "../progress-core";

export const CANDLE_FLOOR = 0.12;
const GUTTER_FROM = 0.98;

export const PROGRESS_EVENT = "hvitveldt:reading-progress";

export interface ReadingProgressDetail {
  /** 0..1 through the chapter. */
  progress: number;
  /** Where each section break sits, as 0..1 through the chapter. */
  sectionMarks: number[];
}

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

export function candleHeight(progress: number): number {
  return 1 - clamp01(progress) * (1 - CANDLE_FLOOR);
}

export function dripsFor(marks: readonly number[], progress: number): number[] {
  return marks.filter((mark) => mark <= progress);
}

export function flameState(progress: number): "lit" | "guttering" | "out" {
  if (progress >= FINISHED) return "out";
  return progress >= GUTTER_FROM ? "guttering" : "lit";
}
