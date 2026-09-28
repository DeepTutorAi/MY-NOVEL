// SERVER-ONLY. Never import this module from client scripts (<script> blocks
// or files under src/scripts that ship to the browser): it holds the titles of
// unpublished arcs, and bundling it would leak them into public JavaScript.
// Pages read it at build time and pass only the current arc's title down.
import type { SeaZone } from "./zones";

export type SeaArcCutscene = "rain-on-glass" | "porthole" | "dossier" | "sealed-depth";

export interface SeaArc {
  number: number;
  titleTh: string;
  titleEn: string;
  /** draft-marker: taken from the "*จบ อาร์กที่ N: ...*" line in the drafts. */
  titleSource: "draft-marker" | "author" | "proposed";
  chapterStart: number;
  chapterEnd: number;
  /** Chapter whose opening plays the arc cutscene. */
  entryChapter: number;
  cutscene: SeaArcCutscene;
  tint: SeaZone;
}

export const SEA_ARCS: readonly SeaArc[] = [
  {
    number: 1,
    titleTh: "ฝนที่พูดได้",
    titleEn: "The Rain That Spoke",
    titleSource: "author",
    chapterStart: 0,
    chapterEnd: 5,
    entryChapter: 1,
    cutscene: "rain-on-glass",
    tint: "elaris",
  },
  {
    number: 2,
    titleTh: "คนเดินเรือแห่งฟ้ากับนักล่าใบแดง",
    titleEn: "The Sky-Sailor and the Red Hunter",
    titleSource: "draft-marker",
    chapterStart: 6,
    chapterEnd: 10,
    entryChapter: 6,
    cutscene: "porthole",
    tint: "air-shelf",
  },
  {
    number: 3,
    titleTh: "กระทรวงแผ่นดินแห้ง",
    titleEn: "The Ministry of Dry Earth",
    titleSource: "draft-marker",
    chapterStart: 11,
    chapterEnd: 15,
    entryChapter: 11,
    cutscene: "dossier",
    tint: "capital",
  },
  {
    number: 4,
    titleTh: "ถนนจมน้ำ",
    titleEn: "The Drowned Roads",
    titleSource: "proposed",
    chapterStart: 16,
    chapterEnd: 20,
    entryChapter: 16,
    cutscene: "sealed-depth",
    tint: "drowned-quarter",
  },
  {
    number: 5,
    titleTh: "สภาแห่งความตาย",
    titleEn: "The Dead Parliament",
    titleSource: "proposed",
    chapterStart: 21,
    chapterEnd: 27,
    entryChapter: 21,
    cutscene: "sealed-depth",
    tint: "pressure-veil",
  },
  {
    number: 6,
    titleTh: "การย้ายเมือง",
    titleEn: "The Moving of Cities",
    titleSource: "proposed",
    chapterStart: 28,
    chapterEnd: 31,
    entryChapter: 28,
    cutscene: "sealed-depth",
    tint: "old-pressure",
  },
  {
    number: 7,
    titleTh: "เมื่อทะเลร่วงหล่น",
    titleEn: "When the Sea Fell",
    titleSource: "proposed",
    chapterStart: 32,
    chapterEnd: 35,
    entryChapter: 32,
    cutscene: "sealed-depth",
    tint: "first-memory",
  },
];

export function getSeaArc(number: number): SeaArc | undefined {
  return SEA_ARCS.find((arc) => arc.number === number);
}
