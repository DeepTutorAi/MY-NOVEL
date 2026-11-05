// Everything a reader may not see yet, split into one JSON file per unlock
// (src/pages/kusabi/vault/[file].json.ts). Build-time only: nothing here may be
// imported by a client script, and kusabi-contract.test.ts checks that.
//
//   titles    chapter titles for the shelf
//   t<N>      opens when chapter N is finished: art and character files
//   e<N>      opens when Extra N is finished: character notes
//   x<N>      opens with the unlock of Extra N: its title and summary
//   m<N>      pictures in no chapter, one file per unlock (moments.ts)
//   quiz     the keypad questions, map: the story plan, history: its Extra part
import { createHash } from "node:crypto";
import { getCollection } from "astro:content";
import { CHARACTER_TIERS } from "./characters";
import { MAP_ARCS, MAP_BEHIND, MAP_CLUES, MAP_FACTS, MAP_FACTS_LATE, MAP_HISTORY, MAP_KNOWS, MAP_MIRROR, MAP_NAMES, MAP_NIGHT, MAP_QUESTIONS, MAP_SHORT, MAP_STOPS, MAP_TAPES, MAP_TRUTH, MAP_WOUNDS, QUIZ_BANK } from "./case-map";
import { MUSIC_CUES } from "./audio-cues";
import { MOMENTS } from "./moments";
import { answerMessage, normalizeAnswer } from "../../scripts/kusabi/case-map/keypad-core";

export interface GalleryImage {
  src: string;
  alt: string;
}

const IMAGE_LINE = /!\[([^\]]*)\]\([^)]*\/images\/([^)]+)\)/g;
const IMAGE_ROOT = "/assets/kusabi/images/";

function chapterArt(body: string): GalleryImage[] {
  return [...body.matchAll(IMAGE_LINE)].map((match) => ({ alt: match[1], src: `${IMAGE_ROOT}${match[2]}` }));
}

const BEHIND = {
  people: [
    { name: "อาราอิ เรียวยะ", type: "ISTJ", core: "สังเกตและอ้างเหตุผล เพื่อป้องกันตัวเองจากการตัดสินใจพลาด" },
    { name: "อามามิยะ นาโอะ", type: "ENTP", core: "เล่นมุกและถ่ายคลิป เพื่อไม่ต้องหยุดอยู่กับความกลัว" },
    { name: "ซากุราบะ ไคโตะ", type: "ISFJ", core: "ปกป้องคนอื่น จนบางครั้งตัดสินใจแทนเขา" },
    { name: "คุโรซาวะ มิซากิ", type: "ESTJ", core: "วางแผนและสั่งการ เพราะกลัวสิ่งที่คุมไม่ได้" },
    { name: "อาซาฮินะ ริสะ", type: "ESFP", core: "ยิ้มและขอโทษ เพื่อไม่ให้ถูกทิ้งไว้ข้างหลัง" },
    { name: "ชิอง มาโดกะ", type: "INFJ", core: "ยืนยันว่าทุกคนต้องเลือกตัวเอง เพื่อให้สิ่งที่เกิดกับเขาเป็นเรื่องธรรมดา" },
  ],
  tapes: MUSIC_CUES.map((cue) => ({ label: `A-${cue.number}`, title: cue.title })),
};

const answerHash = (answer: string) =>
  createHash("sha256").update(answerMessage(normalizeAnswer(answer))).digest("hex");

export async function buildVaultFiles(): Promise<Record<string, unknown>> {
  const chapters = await getCollection("kusabiChapters");
  const extras = (await getCollection("kusabiExtras")).filter((extra) => import.meta.env.DEV || !extra.data.draft);

  const files: Record<string, unknown> = {};

  files.titles = {
    chapters: Object.fromEntries(
      chapters.map((chapter) => [
        String(chapter.data.number),
        { title: chapter.data.thaiTitle || chapter.data.title, act: chapter.data.act, actTitle: chapter.data.actTitle },
      ]),
    ),
  };

  for (const chapter of chapters) {
    const number = chapter.data.number;
    files[`t${number}`] = {
      art: chapterArt(chapter.body ?? ""),
      characters: CHARACTER_TIERS[`t${number}`],
      behind: number === 13 ? BEHIND : undefined,
    };
  }

  for (const key of ["e1", "e2", "e3", "e4"]) files[key] = { characters: CHARACTER_TIERS[key] };

  for (const extra of extras) {
    files[`x${extra.data.number}`] = {
      id: extra.data.slug,
      number: extra.data.number,
      title: extra.data.title,
      summary: extra.data.summary,
      dateline: extra.data.dateline,
      minutes: extra.data.readingMinutes,
    };
  }

  for (const [file, art] of Object.entries(MOMENTS)) files[file] = { art };

  files.quiz = {
    questions: QUIZ_BANK.map(({ answers, ...question }) => ({ ...question, hashes: answers.map(answerHash) })),
  };
  files.map = {
    short: MAP_SHORT,
    arcs: MAP_ARCS,
    stops: MAP_STOPS,
    night: MAP_NIGHT,
    knows: MAP_KNOWS,
    clues: MAP_CLUES,
    tapes: MAP_TAPES,
    facts: MAP_FACTS,
    behind: MAP_BEHIND,
    wounds: MAP_WOUNDS,
    mirror: MAP_MIRROR,
    questions: MAP_QUESTIONS,
    names: MAP_NAMES,
  };
  files.history = { history: MAP_HISTORY, truth: MAP_TRUTH, facts: MAP_FACTS_LATE };

  return files;
}
