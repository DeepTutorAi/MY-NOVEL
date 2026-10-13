// Fate stamps for Karlsen's board (design section 8.4, approved 2026-10-13).
// A stamp appears once the reader has finished its chapter; a later stamp
// crosses out the earlier ones, which stay visible, so the misdirection of the
// book can be read on the card after the finale. Notes never cross anything
// out. `ref` is the chapter line the stamp comes from.

export interface FateStamp {
  chapter: number;
  stamp: string;
  ref: string;
  /** A side note beside the stamps (e.g. what became of a copy). */
  note?: true;
}

export interface CharacterFate {
  /** As on the card in characters.ts. */
  name: string;
  /** The typed file number from the February 2024 roster (ch3:1014-1023), shown from that chapter. */
  fileNumber?: { label: string; chapter: number };
  stamps: FateStamp[];
}

export const FATES: CharacterFate[] = [
  {
    name: "Elena Vasquez",
    fileNumber: { label: "Subject 7", chapter: 3 },
    stamps: [
      { chapter: 12, stamp: "SUBJECT 8?", ref: "ch12:658" },
      { chapter: 15, stamp: "CLEARED", ref: "ch15:395" },
      { chapter: 16, stamp: "SURVIVED", ref: "ch16:389" },
      { chapter: 18, stamp: "SUBJECT 8", ref: "ch18:611" },
    ],
  },
  {
    name: "Marcus Hale",
    stamps: [
      { chapter: 3, stamp: "MISSING", ref: "ch3:855" },
      { chapter: 7, stamp: "DEAD", ref: "ch7:209" },
      { chapter: 7, stamp: "BODY GONE", ref: "ch7:440" },
      { chapter: 13, stamp: "ALIVE", ref: "ch13:519" },
      { chapter: 15, stamp: "SUBJECT 8", ref: "ch15:455" },
      { chapter: 15, stamp: "JUMPED", ref: "ch15:539" },
      { chapter: 18, stamp: "DEAD SINCE 2019", ref: "ch18:142" },
    ],
  },
  {
    name: "Diana Webb",
    fileNumber: { label: "Subject 4", chapter: 3 },
    stamps: [
      { chapter: 15, stamp: "CLEARED", ref: "ch15:345" },
      { chapter: 16, stamp: "SURVIVED", ref: "ch16:389" },
    ],
  },
  {
    name: "Vincent Leroux",
    fileNumber: { label: "Subject 6", chapter: 3 },
    stamps: [
      { chapter: 7, stamp: "LIED", ref: "ch7:695" },
      { chapter: 15, stamp: "CLEARED", ref: "ch15:421" },
      { chapter: 16, stamp: "SURVIVED", ref: "ch16:389" },
    ],
  },
  {
    name: "Lillian Hale",
    fileNumber: { label: "Subject 8 · 2019", chapter: 3 },
    stamps: [
      { chapter: 3, stamp: "DEAD · 2019", ref: "ch3:745" },
      { chapter: 18, stamp: "DNA MISMATCH", ref: "ch18:122" },
    ],
  },
  {
    name: "Sophie Walters",
    fileNumber: { label: "Subject 1 · 2019", chapter: 3 },
    stamps: [
      { chapter: 4, stamp: "MISSING · 2019", ref: "ch4:186" },
      { chapter: 13, stamp: "BELONGINGS FOUND", ref: "ch13:242" },
      { chapter: 16, stamp: "SACRIFICED", ref: "ch16:283" },
    ],
  },
  {
    name: "Subject 8",
    stamps: [
      { chapter: 15, stamp: "MARCUS", ref: "ch15:455" },
      { chapter: 18, stamp: "ELENA", ref: "ch18:629" },
    ],
  },
  {
    name: "Detective Karlsen",
    stamps: [{ chapter: 18, stamp: "CASE OPEN", ref: "ch18:337" }],
  },
  {
    name: "Sarah Kovac",
    fileNumber: { label: "Subject 2", chapter: 3 },
    stamps: [
      { chapter: 15, stamp: "CLEARED", ref: "ch15:335" },
      { chapter: 16, stamp: "SURVIVED", ref: "ch16:389" },
    ],
  },
  {
    name: "Jake Whitmore",
    fileNumber: { label: "Subject 1", chapter: 3 },
    stamps: [
      { chapter: 5, stamp: "NOT JAKE?", ref: "ch5:435" },
      { chapter: 10, stamp: "LEFT", ref: "ch10:397" },
      { chapter: 17, stamp: "PRESUMED DEAD", ref: "ch17:276" },
    ],
  },
  {
    name: "Ben Ross",
    fileNumber: { label: "Subject 3", chapter: 3 },
    stamps: [
      { chapter: 10, stamp: "LEFT", ref: "ch10:387" },
      { chapter: 12, stamp: "REPLACED", ref: "ch12:368" },
      { chapter: 12, stamp: "DEAD", ref: "ch12:380" },
      { chapter: 12, stamp: "COPY BURNED", ref: "ch12:692", note: true },
    ],
  },
  {
    name: "Tom Janssen",
    fileNumber: { label: "Subject 5", chapter: 3 },
    stamps: [
      { chapter: 9, stamp: "DOUBLED", ref: "ch9:293" },
      { chapter: 9, stamp: "DEAD", ref: "ch9:426" },
      { chapter: 9, stamp: "COPY AT LARGE", ref: "ch9:477", note: true },
    ],
  },
];

export interface ShownStamp extends FateStamp {
  /** A later stamp the reader has also reached overturned this one. */
  superseded: boolean;
}

/** The stamps a reader who finished `finished` may see, oldest first. */
export function visibleStamps(fate: CharacterFate, finished: ReadonlySet<number>): ShownStamp[] {
  const shown = fate.stamps.filter((stamp) => finished.has(stamp.chapter));
  const lastMain = shown.reduce((last, stamp, index) => (stamp.note ? last : index), -1);
  return shown.map((stamp, index) => ({ ...stamp, superseded: !stamp.note && index < lastMain }));
}
