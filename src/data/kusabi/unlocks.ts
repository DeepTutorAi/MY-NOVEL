// What opens when (web-rework-plan.md section 4). Chapter numbers refer to the
// moment the draft reveals the fact, checked against work/drafts/:
//   ch11:793 the voice answers to Shion's name, ch12:99-109 the mask is Shion,
//   epilogue:519 Ayame's name and the "กลับบ้าน" tape first appear.
// Every Extra chapter depends on that last line, so E01 waits for the epilogue.

export type Rule =
  | { chapter: number }
  | { extra: string }
  | { mainRead: number }
  | { caseMap: true }
  | { allOf: Rule[] }
  | { anyOf: Rule[] };

const ART_RULES = {
  "art-0": { chapter: 0 },
  "art-1": { chapter: 1 },
  "art-2": { chapter: 2 },
  "art-3": { chapter: 3 },
  "art-4": { chapter: 4 },
  "art-5": { chapter: 5 },
  "art-6": { chapter: 6 },
  "art-7": { chapter: 7 },
  "art-8": { chapter: 8 },
  "art-9": { chapter: 9 },
  "art-10": { chapter: 10 },
  "art-11": { chapter: 11 },
  "art-12": { chapter: 12 },
  "art-13": { chapter: 13 },
} as const satisfies Record<string, Rule>;

export const UNLOCKS = {
  ...ART_RULES,
  staff: { chapter: 1 },
  mask: { chapter: 10 },
  voice: { chapter: 11 },
  shion: { chapter: 12 },
  ayame: { chapter: 13 },
  "extra-e01": { allOf: [{ mainRead: 10 }, { chapter: 12 }, { chapter: 13 }] },
  "extra-e02": { extra: "e01" },
  "extra-e03": { extra: "e02" },
  "extra-e04": { extra: "e03" },
  "extra-e05": { extra: "e04" },
  // Finished readers go straight to the quiz. Anyone else accepts the spoilers first and gets
  // questions from the end of the book; passing opens the same map for both.
  "case-map-gate": { chapter: 13 },
  "case-map": { caseMap: true },
  "case-map-history": { allOf: [{ chapter: 13 }, { caseMap: true }, { extra: "e04" }] },
  // Pictures in no chapter. The cast group shows the book's ending, Shion and Ayame need
  // E01, and the thank-you closes the last published Extra.
  "moments-book": { chapter: 13 },
  "moments-e01": { extra: "e01" },
  "moments-end": { extra: "e04" },
} as const satisfies Record<string, Rule>;

export type UnlockId = keyof typeof UNLOCKS;

/**
 * The frames for those pictures: enough to draw them empty and nothing more. Their files,
 * captions and alt text are in the vault (moments.ts). Ratios are width over height.
 */
export const MOMENT_GROUPS = [
  { file: "m1", unlock: "moments-book", label: "ท้าย", ratios: [0.914, 1.5, 1.5, 0.914] },
  { file: "m2", unlock: "moments-e01", label: "เสริม 1", ratios: [1.5, 1.5, 1.5, 1.5] },
  { file: "m3", unlock: "moments-end", label: "เสริม 4", ratios: [0.8] },
] as const satisfies ReadonlyArray<{ file: string; unlock: UnlockId; label: string; ratios: readonly number[] }>;

const MORE_IN_FILES = { text: "แฟ้มในหน้าตัวละครมีรายละเอียดเพิ่ม", href: "/kusabi/characters/" };

/** Unlocks the reader hears about when they happen, by the page that shows them. */
export const UNLOCK_NOTICES: Partial<Record<UnlockId, { text: string; href: string }>> = {
  "art-2": MORE_IN_FILES,
  "art-3": MORE_IN_FILES,
  "art-4": MORE_IN_FILES,
  "art-5": { text: "มีแฟ้มใหม่ในหน้าตัวละคร", href: "/kusabi/characters/" },
  "art-6": MORE_IN_FILES,
  "art-7": MORE_IN_FILES,
  "art-8": MORE_IN_FILES,
  "art-9": MORE_IN_FILES,
  staff: { text: "มีแฟ้มใหม่ในหน้าตัวละคร", href: "/kusabi/characters/" },
  mask: { text: "มีแฟ้มใหม่ในหน้าตัวละคร", href: "/kusabi/characters/" },
  voice: { text: "สมุดในหน้าตัวละครเปลี่ยนไป", href: "/kusabi/characters/" },
  shion: { text: "แฟ้มในหน้าตัวละครถูกรวมกันแล้ว", href: "/kusabi/characters/" },
  ayame: { text: "มีชื่อใหม่ในหน้าตัวละคร", href: "/kusabi/characters/" },
  "extra-e01": { text: "เปิดเรื่องเสริมตอนแรกแล้ว", href: "/kusabi/extra/" },
  "extra-e02": { text: "เปิดเรื่องเสริมตอนถัดไปแล้ว", href: "/kusabi/extra/" },
  "extra-e03": { text: "เปิดเรื่องเสริมตอนถัดไปแล้ว", href: "/kusabi/extra/" },
  "extra-e04": { text: "เปิดเรื่องเสริมตอนถัดไปแล้ว", href: "/kusabi/extra/" },
  "case-map-gate": { text: "แผงตัวเลขของแผนผังเปิดให้ลองแล้ว", href: "/kusabi/case-map/" },
  "moments-end": { text: "มีภาพใหม่ในแกลเลอรี", href: "/kusabi/extra/#kusabi-gallery" },
};
