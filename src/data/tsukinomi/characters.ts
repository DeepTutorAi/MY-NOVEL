// What any visitor may see on the character page (src/pages/tsukinomi/characters.astro):
// the narrator and nothing about anyone else. Everyone else, and what the chapters add,
// lives in vault.ts and reaches the browser only after the reader has got that far.

/** One line of general information on a card: status and plain facts, never a description of character. */
export interface PersonRow {
  label: string;
  value: string;
}

export interface PersonCard {
  id: string;
  kanji: string;
  name: string;
  romaji: string;
  role: string;
  rows: PersonRow[];
  /** Neutral stem under images/platform/: <art>.webp is the half body, <art>-face-N.webp the expressions. */
  art: string;
  /** Whether the model sheet has a row of expressions to cut. */
  faces: boolean;
}

/** What finishing one chapter adds: the vault's /tsukinomi/vault/c<N>.json. */
export interface VaultTier {
  /** People who open with this chapter, in route order. */
  cards?: PersonCard[];
  /** Changes what the reader now knows about someone already open. */
  updates?: Array<{ id: string; role?: string; rows?: PersonRow[] }>;
  /** A line in someone's log, tagged with this chapter. */
  notes?: Array<{ id: string; text: string }>;
}

/** One person's card ten years on. Someone with no entry has left the route. */
export interface LaterEntry {
  role?: string;
  rows?: PersonRow[];
  art?: string;
  gone?: boolean;
}

export const FIRST_PERSON: PersonCard = {
  id: "haruto",
  kanji: "高橋 陽翔",
  name: "ทาคาฮาชิ ฮารุโตะ",
  romaji: "TAKAHASHI HARUTO",
  role: "ผู้เล่าเรื่อง · นักเรียนชั้น ม.6",
  rows: [
    { label: "อายุ", value: "17 ปี" },
    { label: "ส่วนสูง", value: "169 ซม." },
    { label: "โรงเรียน", value: "มัธยมปลายฮาคุบะ ห้อง 3-B" },
    { label: "บ้าน", value: "บนเนินเหนือเมืองฮาคุบะ" },
    { label: "ติดตัว", value: "วอล์กแมนของพ่อ" },
  ],
  art: "f01",
  faces: true,
};
