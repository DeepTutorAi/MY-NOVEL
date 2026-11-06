// Reading units of the novel. These ids are the content entry ids and part of
// the reader's localStorage keys, so changing one loses that reader's progress.
// Safe for client bundles: ids and flags only, never titles.

export const CHAPTER_UNITS = [
  { id: "00-introduction", number: 0 },
  { id: "01-hinomori-ryokan", number: 1 },
  { id: "02-mountain-bride-rumors", number: 2 },
  { id: "03-lost-item", number: 3 },
  { id: "04-kusabi-house", number: 4 },
  { id: "05-the-first-room", number: 5 },
  { id: "06-the-double-door", number: 6 },
  { id: "07-the-body-that-answers", number: 7 },
  { id: "08-risa-is-gone", number: 8 },
  { id: "09-after-risa", number: 9 },
  { id: "10-risas-voice", number: 10 },
  { id: "11-marks-that-never-left", number: 11 },
  { id: "12-the-house-closes", number: 12 },
  { id: "13-epilogue", number: 13 },
] as const;

export const EXTRA_UNITS = [
  { id: "e01", number: 1, published: true },
  { id: "e02", number: 2, published: true },
  { id: "e03", number: 3, published: true },
  { id: "e04", number: 4, published: true },
  { id: "e05", number: 5, published: true },
] as const;

export const PROLOGUE_ID = CHAPTER_UNITS[0].id;
export const EPILOGUE_ID = CHAPTER_UNITS[13].id;
export const MAIN_CHAPTER_COUNT = 12;

export type ExtraId = (typeof EXTRA_UNITS)[number]["id"];
