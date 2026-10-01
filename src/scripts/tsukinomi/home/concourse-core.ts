// The pure half of the /tsukinomi/ home concourse (design section 4.4): what the
// departure board lists, what the rail and the page tint do as the reader
// scrolls, how far the reader has got, and which illustrations the passing
// train may show. No DOM and no storage access of its own (storage comes in as a
// getItem function), so node --test covers all of it. concourse.ts is the DOM
// half. The same split as Sea's home-reading-core.
//
// Read state. The table of contents (sections/index.astro) marks a section
// read when tsukinomi:reading:secret:reads, the array ReadingProgress writes
// once a section has had 18 active minutes and 80 percent depth, contains its
// id. ReadingProgress also saves tsukinomi:reading:section:<id> and
// tsukinomi:reading:last ({ sectionId, progress, ... }) while the reader
// scrolls. The concourse reads the same three keys and derives, per section:
//
//   read     in the read-marks array, or saved progress at or past 99.5 percent
//   opened   saved progress of at least 0.5 percent, short of read
//   unread   anything else
//
// Every value is untrusted: missing, corrupt, hand-edited or left by an older
// build (records keyed by chapterId, a read list of numbers). Nothing throws; a
// value that cannot be understood counts as absent.
//
// "Furthest read" (the rail marker) and the spoiler rule are both defined on
// read, not opened: a reader who has only opened part 3 has not seen all of it,
// so the passing train must not yet show its illustrations. See
// illustrationsUpTo().
//
// Station maths. The rail has one station per part (parts 1 to 5; the prologue
// is a board row only), laid out in equal slots, so station i sits at
// (i + 0.5) / count along the line and the line runs a half slot past both end
// stations. railProgress() turns the rail's position in the viewport into a
// 0..1 fraction; railState() and tintAt() turn that into lit stations, the
// active station and the blend between two parts' palette tokens.
import { formatReadingTime } from "../../../utils/reading-time";

// ---- shared constants -------------------------------------------------------

/** Parts with a station on the rail: 1 to 5. The prologue (0) has none. */
export const STATION_COUNT = 5;

/**
 * The short-landscape rule: below this the passing train is skipped and the
 * board is shown directly. home.css repeats the exact string (a contract test
 * keeps the two equal); the train reads it through matchMedia(). It matches the
 * compact-hero rule in src/styles/tsukinomi/global.css so both flip together.
 */
export const SHORT_LANDSCAPE_QUERY = "(orientation: landscape) and (max-height: 500px)";

/** Mobile portrait: the rail runs vertically and the board rows stack. home.css repeats the string. */
export const RAIL_VERTICAL_QUERY = "(max-width: 760px)";

/** Interface copy the plan allows (design 4.4 and 9.6): the departure board's last row. */
export const LAST_TRAIN_TITLE = "ขบวนสุดท้าย";
export const NO_TIME = "--:--";

/**
 * What a board row says, to assistive technology, about a part the reader has
 * read or opened. Both phrases already exist on this page (the resume card).
 */
export const STATE_TEXT: Readonly<Record<"read" | "opened", string>> = {
  read: "อ่านจบแล้ว",
  opened: "อ่านค้างไว้",
};

// ---- storage keys and thresholds (mirrors of ReadingProgress.astro) ---------

export const READS_KEY = "tsukinomi:reading:secret:reads";
export const LAST_KEY = "tsukinomi:reading:last";
export const sectionProgressKey = (id: string) => `tsukinomi:reading:section:${id}`;
/** Same values as MIN_TRACKED_PROGRESS / COMPLETED_PROGRESS in ReadingProgress.astro (a test compares them). */
export const MIN_TRACKED_PROGRESS = 0.005;
export const COMPLETED_PROGRESS = 0.995;

// ---- section metadata -------------------------------------------------------

export const PALETTES = ["autumn", "twilight", "warm-room", "snow-pact", "winter-light"] as const;
export type Palette = (typeof PALETTES)[number];

/** What the concourse needs of a section's frontmatter. */
export interface SectionMeta {
  id: string;
  number: number;
  title: string;
  chapterRange: string;
  readingMinutes: number;
  palette: Palette;
}

/** The frontmatter fields the concourse reads, as a content-collection entry carries them. */
export interface SectionEntry {
  id: string;
  data: Omit<SectionMeta, "id">;
}

export const sectionMeta = (entry: SectionEntry): SectionMeta => ({
  id: entry.id,
  number: entry.data.number,
  title: entry.data.title,
  chapterRange: entry.data.chapterRange,
  readingMinutes: entry.data.readingMinutes,
  palette: entry.data.palette,
});

export interface ReadUnit {
  id: string;
  number: number;
}

const byNumber = <T extends { number: number }>(items: readonly T[]) => [...items].sort((a, b) => a.number - b.number);

/** "บทนำ" for the prologue and "ภาค N" otherwise: the labels the table of contents already uses. */
export const partLabel = (number: number) => (number === 0 ? "บทนำ" : `ภาค ${number}`);

// ---- departure board --------------------------------------------------------

export interface BoardRow {
  kind: "section" | "last";
  /** Section slug, which is also the page path; null on the last-train row. */
  id: string | null;
  number: number | null;
  label: string;
  title: string;
  chapterRange: string | null;
  readingMinutes: number | null;
  /** The clock cell: the reading time as HH:MM, or --:-- on the last-train row. */
  clock: string;
  /** The reading time in words, as the table of contents shows it; null on the last-train row. */
  readingText: string | null;
}

/** Minutes as HH:MM (112 -> "01:52"). Anything that is not a positive whole number is "--:--". */
export function formatClock(minutes: number | null | undefined): string {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return NO_TIME;
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** One row for the prologue and each part, in order, then the last-train row. */
export function buildBoardRows(sections: readonly SectionMeta[]): BoardRow[] {
  const rows: BoardRow[] = byNumber(sections).map((section) => ({
    kind: "section",
    id: section.id,
    number: section.number,
    label: partLabel(section.number),
    title: section.title,
    chapterRange: section.chapterRange,
    readingMinutes: section.readingMinutes,
    clock: formatClock(section.readingMinutes),
    readingText: formatReadingTime(section.readingMinutes),
  }));
  rows.push({
    kind: "last",
    id: null,
    number: null,
    label: "",
    title: LAST_TRAIN_TITLE,
    chapterRange: null,
    readingMinutes: null,
    clock: NO_TIME,
    readingText: null,
  });
  return rows;
}

// ---- read state -------------------------------------------------------------

export type PartStatus = "unread" | "opened" | "read";

export interface ReadState {
  /** Status of every unit, keyed by section number. */
  status: Record<number, PartStatus>;
  /** Highest section number that is read, or null. 0 means only the prologue. */
  furthestRead: number | null;
  /** Highest section number that is opened or read, or null. */
  furthestOpened: number | null;
}

export interface StoredReadInputs {
  /** Parsed tsukinomi:reading:secret:reads. */
  reads: unknown;
  /** Parsed tsukinomi:reading:last. */
  last: unknown;
  /** Parsed tsukinomi:reading:section:<id>, by section id. */
  sections: Readonly<Record<string, unknown>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** JSON.parse that answers undefined instead of throwing. */
export function parseJson(raw: string | null | undefined): unknown {
  if (typeof raw !== "string" || raw === "") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * Section number a stored identifier stands for, or null. Accepts a section id,
 * and (older or hand-edited values) a section number as a number or numeric
 * string. An unknown id is never guessed at.
 */
export function resolvePart(identifier: unknown, units: readonly ReadUnit[]): number | null {
  if (typeof identifier === "string") {
    const text = identifier.trim();
    const byId = units.find((unit) => unit.id === text);
    if (byId) return byId.number;
    if (/^\d{1,2}$/.test(text)) return units.find((unit) => unit.number === Number(text))?.number ?? null;
    return null;
  }
  if (typeof identifier === "number" && Number.isInteger(identifier)) {
    return units.find((unit) => unit.number === identifier)?.number ?? null;
  }
  return null;
}

/** Progress ratio of a saved record, clamped to 0..1, or null when it has none. */
export function recordProgress(record: unknown): number | null {
  if (!isRecord(record)) return null;
  const value = record.progress;
  if (value === null || value === "" || typeof value === "boolean" || Array.isArray(value)) return null;
  const progress = Number(value);
  return Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : null;
}

/** Section a saved record belongs to. ReadingProgress once wrote chapterId, copied from Lodge. */
function recordPart(record: unknown, units: readonly ReadUnit[]): number | null {
  if (!isRecord(record)) return null;
  return resolvePart(record.sectionId ?? record.chapterId, units);
}

function readMarkParts(reads: unknown, units: readonly ReadUnit[]): Set<number> {
  const parts = new Set<number>();
  const identifiers: unknown[] = Array.isArray(reads)
    ? reads
    : isRecord(reads)
      ? Object.keys(reads).filter((key) => Boolean(reads[key]))
      : [];
  for (const identifier of identifiers) {
    const part = resolvePart(identifier, units);
    if (part !== null) parts.add(part);
  }
  return parts;
}

export function deriveReadState(inputs: StoredReadInputs, units: readonly ReadUnit[]): ReadState {
  const status: Record<number, PartStatus> = {};
  for (const unit of units) status[unit.number] = "unread";

  const progressByPart = new Map<number, number>();
  const note = (part: number | null, progress: number | null) => {
    if (part === null || progress === null) return;
    progressByPart.set(part, Math.max(progressByPart.get(part) ?? 0, progress));
  };
  for (const unit of units) {
    const record = inputs.sections[unit.id];
    // A record is trusted for the section it names; one stored under another
    // section's key counts for the section it names, not the one it sits under.
    note(recordPart(record, units) ?? unit.number, recordProgress(record));
  }
  note(recordPart(inputs.last, units), recordProgress(inputs.last));

  for (const [part, progress] of progressByPart) {
    if (progress >= COMPLETED_PROGRESS) status[part] = "read";
    else if (progress >= MIN_TRACKED_PROGRESS && status[part] !== "read") status[part] = "opened";
  }
  for (const part of readMarkParts(inputs.reads, units)) status[part] = "read";

  const furthest = (wanted: (value: PartStatus) => boolean): number | null => {
    let best: number | null = null;
    for (const unit of units) {
      if (wanted(status[unit.number]) && (best === null || unit.number > best)) best = unit.number;
    }
    return best;
  };
  return {
    status,
    furthestRead: furthest((value) => value === "read"),
    furthestOpened: furthest((value) => value !== "unread"),
  };
}

/** Reads the three keys through getItem (localStorage, or null when storage is blocked) and derives the state. */
export function readStateFromStorage(
  storage: Pick<Storage, "getItem"> | null,
  units: readonly ReadUnit[],
): ReadState {
  const get = (key: string): unknown => {
    try {
      return parseJson(storage?.getItem(key));
    } catch {
      return undefined;
    }
  };
  const sections: Record<string, unknown> = {};
  for (const unit of units) sections[unit.id] = get(sectionProgressKey(unit.id));
  return deriveReadState({ reads: get(READS_KEY), last: get(LAST_KEY), sections }, units);
}

// ---- rail: scroll progress to stations --------------------------------------

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

/** A hair of tolerance so a head that lands on a station by rounding still counts as there. */
const EPSILON = 1e-9;

/** Where station `index` sits along the line, 0..1: the centre of its slot. */
export const stationPosition = (index: number, count: number) => (index + 0.5) / count;

export interface RailProgressOptions {
  /**
   * Where in the viewport the line starts to draw, as a fraction of its height:
   * the line is empty while the rail's top is below it. Default 0.75.
   */
  anchor?: number;
  /**
   * Scroll distance the line takes to draw when the rail is shorter than this.
   * The horizontal rail is a couple of hundred pixels tall and would otherwise
   * draw in one flick. Default 0.
   */
  minTravel?: number;
  /**
   * The rail's top, in viewport pixels, once the page is scrolled to its end
   * (its current top minus the scroll still left). The line completes no later
   * than that, so a short page ends with a finished rail instead of one that
   * snaps shut on the last pixel, and a long one is not stretched.
   */
  restTop?: number;
}

/**
 * How much of the line is drawn: 0 while the rail's top is below `anchor` of the
 * viewport, rising linearly as the rail scrolls up over max(rail height,
 * minTravel), 1 after. When the page ends before that (restTop), the line draws
 * between the rail entering the bottom of the viewport and the end of the page
 * instead, so it is always complete at the end. Non-finite measurements give 0.
 */
export function railProgress(
  rail: { top: number; height: number },
  viewportHeight: number,
  options: RailProgressOptions = {},
): number {
  if (![rail.top, rail.height, viewportHeight].every(Number.isFinite) || viewportHeight <= 0) return 0;
  const rest = options.restTop !== undefined && Number.isFinite(options.restTop) ? options.restTop : null;
  const travel = Math.max(1, rail.height, Number.isFinite(options.minTravel) ? options.minTravel! : 0);
  let start = viewportHeight * clamp01(options.anchor ?? 0.75);
  let end = start - travel;
  if (rest !== null && rest > end) {
    start = viewportHeight;
    end = rest;
  }
  if (end >= start) return rail.top <= end ? 1 : 0;
  return clamp01((start - rail.top) / (start - end));
}

export interface RailState {
  /** Line fill, 0..1. */
  fill: number;
  /** Index of the last station the head has passed, or -1. */
  active: number;
  /** Per station: has the head reached it. */
  lit: boolean[];
}

export function railState(progress: number, count: number = STATION_COUNT): RailState {
  const fill = Number.isFinite(progress) ? clamp01(progress) : 0;
  const lit = Array.from({ length: count }, (_, index) => fill + EPSILON >= stationPosition(index, count));
  return { fill, active: lit.lastIndexOf(true), lit };
}

/** Station index (0-based) for the furthest part read, or null when no part from 1 up has been read. */
export function markerStation(furthestRead: number | null, count: number = STATION_COUNT): number | null {
  if (furthestRead === null || !Number.isFinite(furthestRead) || furthestRead < 1) return null;
  return Math.min(count, Math.floor(furthestRead)) - 1;
}

// ---- page tint --------------------------------------------------------------

/**
 * The token each part's palette tints the page with: the accent that palette
 * already carries in section.css (the radial glow at the top of its page).
 * snow-pact uses the red thread of the pact so it stays apart from warm-room's amber.
 */
export const PALETTE_TOKEN: Readonly<Record<Palette, string>> = {
  autumn: "--sakura",
  twilight: "--moon",
  "warm-room": "--sunset",
  "snow-pact": "--higan",
  "winter-light": "--mist",
};

/**
 * Strongest the tint ever is, as the share of the token colour mixed over the
 * page. Low enough that body text keeps its contrast (a test measures it).
 */
export const TINT_MAX_ALPHA = 0.07;

/** Palette of each rail station, in station order: parts 1..count taken from the section metadata. */
export function stationPalettes(sections: readonly SectionMeta[], count: number = STATION_COUNT): Palette[] {
  const parts = byNumber(sections).filter((section) => section.number >= 1);
  return Array.from({ length: count }, (_, index) => parts.find((p) => p.number === index + 1)?.palette ?? "autumn");
}

export interface TintState {
  /** Station the tint blends from and to (indexes into the station palettes). */
  from: number;
  to: number;
  /** 0 = all `from`, 1 = all `to`. */
  mix: number;
  /** 0 before the line reaches the first station, rising to 1 there. */
  strength: number;
}

/**
 * Blend between neighbouring stations' palettes as the head moves between
 * their centres; before the first station the tint fades in, after the last it
 * holds. Continuous in progress, so the page tint never steps.
 */
export function tintAt(progress: number, count: number = STATION_COUNT): TintState {
  const p = Number.isFinite(progress) ? clamp01(progress) : 0;
  const first = stationPosition(0, count);
  const last = stationPosition(count - 1, count);
  if (p <= first) return { from: 0, to: 0, mix: 0, strength: first > 0 ? p / first : 1 };
  if (p >= last) return { from: count - 1, to: count - 1, mix: 0, strength: 1 };
  // Station boundaries are multiples of the slot; the epsilon keeps 0.3 (which
  // is 0.19999999999999998 slots past 0.1) from falling back into the slot before.
  const slots = (p - first) * count;
  const from = Math.min(count - 2, Math.floor(slots + EPSILON));
  return { from, to: from + 1, mix: clamp01(slots - from), strength: 1 };
}

// ---- illustrations and the spoiler rule -------------------------------------

export interface IllustrationEntry {
  file: string;
  /** Part the illustration belongs to, or null when the name or the metadata cannot place it. */
  part: number | null;
}

/** First and last chapter of a chapterRange such as "บทที่ 4–6" or "บทที่ 5"; null for "เกริ่นนำ". */
export function parseChapterRange(range: string): { from: number; to: number } | null {
  const match = /(\d+)\s*(?:[–—-]\s*(\d+))?/.exec(range);
  if (!match) return null;
  const from = Number(match[1]);
  const to = match[2] === undefined ? from : Number(match[2]);
  return Number.isFinite(from) && Number.isFinite(to) && from <= to ? { from, to } : null;
}

/**
 * Part of an illustration file. section-0N-*.webp names its part outright;
 * chapter-NN-*.webp is placed by the part whose chapterRange contains chapter
 * NN, so nothing is hardcoded and a renumbered range moves its illustrations.
 */
export function illustrationPart(file: string, sections: readonly SectionMeta[]): number | null {
  const name = file.split("/").pop() ?? file;
  const bySection = /^section-(\d{2})-/.exec(name);
  if (bySection) {
    const part = Number(bySection[1]);
    return sections.some((section) => section.number === part) ? part : null;
  }
  const byChapter = /^chapter-(\d{2})-/.exec(name);
  if (byChapter) {
    const chapter = Number(byChapter[1]);
    for (const section of byNumber(sections)) {
      const range = parseChapterRange(section.chapterRange);
      if (range && chapter >= range.from && chapter <= range.to) return section.number;
    }
  }
  return null;
}

/** Every illustration file with its part, ordered by part and then name. */
export function buildIllustrationCatalog(files: readonly string[], sections: readonly SectionMeta[]): IllustrationEntry[] {
  return files
    .map((file) => ({ file, part: illustrationPart(file, sections) }))
    .sort((a, b) => (a.part ?? 99) - (b.part ?? 99) || a.file.localeCompare(b.file));
}

/**
 * The spoiler rule for the passing train: an illustration may be shown only
 * when its part is at or before the furthest part the reader has read. Pass
 * ReadState.furthestRead. A reader with nothing read (null), only the prologue
 * (0) or a value that is not a number sees none; an illustration whose part is
 * unknown is never shown.
 */
export function illustrationsUpTo(
  catalog: readonly IllustrationEntry[],
  furthestRead: number | null | undefined,
): IllustrationEntry[] {
  if (typeof furthestRead !== "number" || !Number.isFinite(furthestRead) || furthestRead < 1) return [];
  return catalog.filter((entry) => entry.part !== null && entry.part >= 1 && entry.part <= furthestRead);
}
