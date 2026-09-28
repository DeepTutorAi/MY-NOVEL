// Pure helpers for the Sea chapter collection. No astro:* imports so the
// logic can be unit-tested under node --test.
import type { SeaArc } from "../data/sea/arcs";

export interface SeaChapterMeta {
  number: number;
  arc: number;
  title: string;
  draft?: boolean;
}

export interface SeaChapterLike<D extends SeaChapterMeta = SeaChapterMeta> {
  id: string;
  data: D;
}

export interface OpenStratum<C extends SeaChapterLike> {
  sealed: false;
  number: number;
  titleTh: string;
  titleEn: string;
  tint: SeaArc["tint"];
  chapterStart: number;
  chapterEnd: number;
  hasDrafts: boolean;
  chapters: C[];
}

/** An arc with no visible chapters. It deliberately carries no title or tint. */
export interface SealedStratum {
  sealed: true;
  number: number;
  chapterStart: number;
  chapterEnd: number;
}

export type SeaStratum<C extends SeaChapterLike> = OpenStratum<C> | SealedStratum;

/** What the end of a chapter points at when the next chapter is not published. */
export interface SeaSealedNext {
  kind: "arc" | "chapter";
  number: number;
}

/** Drafts are visible in dev only. */
export function isSeaChapterVisible(data: { draft?: boolean }, prod: boolean): boolean {
  return !prod || data.draft !== true;
}

export function sortSeaChapters<C extends SeaChapterLike>(chapters: readonly C[]): C[] {
  return [...chapters].sort((a, b) => a.data.number - b.data.number);
}

export function buildSeaToc<C extends SeaChapterLike>(
  chapters: readonly C[],
  arcs: readonly SeaArc[],
): SeaStratum<C>[] {
  const sorted = sortSeaChapters(chapters);
  return [...arcs]
    .sort((a, b) => a.number - b.number)
    .map((arc): SeaStratum<C> => {
      const arcChapters = sorted.filter((chapter) => chapter.data.arc === arc.number);
      if (arcChapters.length === 0) {
        return {
          sealed: true,
          number: arc.number,
          chapterStart: arc.chapterStart,
          chapterEnd: arc.chapterEnd,
        };
      }
      return {
        sealed: false,
        number: arc.number,
        titleTh: arc.titleTh,
        titleEn: arc.titleEn,
        tint: arc.tint,
        chapterStart: arc.chapterStart,
        chapterEnd: arc.chapterEnd,
        hasDrafts: arcChapters.some((chapter) => chapter.data.draft === true),
        chapters: arcChapters,
      };
    });
}

export function neighbors<C extends SeaChapterLike>(
  chapters: readonly C[],
  id: string,
): { prev: C | null; next: C | null } {
  const sorted = sortSeaChapters(chapters);
  const index = sorted.findIndex((chapter) => chapter.id === id);
  if (index < 0) {
    return { prev: null, next: null };
  }
  return {
    prev: sorted[index - 1] ?? null,
    next: sorted[index + 1] ?? null,
  };
}

export function isArcEntry(chapter: SeaChapterLike, arcs: readonly SeaArc[]): boolean {
  const arc = arcs.find((candidate) => candidate.number === chapter.data.arc);
  return arc !== undefined && arc.entryChapter === chapter.data.number;
}

/** The arc whose chapter range contains the given chapter number. */
export function arcForChapterNumber(number: number, arcs: readonly SeaArc[]): SeaArc | undefined {
  return arcs.find((arc) => number >= arc.chapterStart && number <= arc.chapterEnd);
}
