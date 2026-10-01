import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { formatReadingTime } from "../../../utils/reading-time";
import {
  COMPLETED_PROGRESS,
  LAST_KEY,
  LAST_TRAIN_TITLE,
  MIN_TRACKED_PROGRESS,
  NO_TIME,
  PALETTES,
  PALETTE_TOKEN,
  RAIL_VERTICAL_QUERY,
  READS_KEY,
  SHORT_LANDSCAPE_QUERY,
  STATION_COUNT,
  TINT_MAX_ALPHA,
  buildBoardRows,
  buildIllustrationCatalog,
  deriveReadState,
  formatClock,
  illustrationPart,
  illustrationsUpTo,
  markerStation,
  parseChapterRange,
  parseJson,
  partLabel,
  railProgress,
  railState,
  readStateFromStorage,
  recordProgress,
  resolvePart,
  sectionProgressKey,
  stationPalettes,
  stationPosition,
  tintAt,
  type Palette,
  type SectionMeta,
} from "./concourse-core";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

// ---- the real content metadata ---------------------------------------------

const SECTIONS_DIR = "src/content/tsukinomi/sections";

function frontmatter(source: string): Record<string, string | number> {
  const block = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? "";
  const data: Record<string, string | number> = {};
  for (const line of block.split("\n")) {
    const match = /^([A-Za-z]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const raw = match[2].trim();
    data[match[1]] = /^".*"$/.test(raw) ? raw.slice(1, -1) : /^-?\d+$/.test(raw) ? Number(raw) : raw;
  }
  return data;
}

const sectionFiles = readdirSync(join(root, SECTIONS_DIR)).filter((name) => name.endsWith(".md")).sort();
const bodies = new Map<string, string>();
const SECTIONS: SectionMeta[] = sectionFiles.map((name) => {
  const source = read(`${SECTIONS_DIR}/${name}`);
  const data = frontmatter(source);
  const id = name.replace(/\.md$/, "");
  bodies.set(id, source);
  return {
    id,
    number: Number(data.number),
    title: String(data.title),
    chapterRange: String(data.chapterRange),
    readingMinutes: Number(data.readingMinutes),
    palette: String(data.palette) as Palette,
  };
});

const UNITS = SECTIONS.map(({ id, number }) => ({ id, number }));
const idOf = (number: number) => SECTIONS.find((section) => section.number === number)!.id;
const storageOf = (values: Record<string, string>): Pick<Storage, "getItem"> => ({
  getItem: (key) => (key in values ? values[key] : null),
});

describe("the content this module reads", () => {
  it("has the prologue and parts 1 to 5, and every palette the module knows", () => {
    assert.deepEqual(
      SECTIONS.map((section) => section.number),
      [0, 1, 2, 3, 4, 5],
    );
    for (const section of SECTIONS) assert.ok((PALETTES as readonly string[]).includes(section.palette), section.id);
    assert.equal(STATION_COUNT, SECTIONS.filter((section) => section.number >= 1).length);
  });
});

// ---- departure board -------------------------------------------------------

describe("formatClock", () => {
  it("writes minutes as HH:MM", () => {
    assert.equal(formatClock(3), "00:03");
    assert.equal(formatClock(59), "00:59");
    assert.equal(formatClock(60), "01:00");
    assert.equal(formatClock(112), "01:52");
    assert.equal(formatClock(261), "04:21");
  });

  it("answers --:-- for anything that is not a positive number of minutes", () => {
    for (const value of [0, -4, Number.NaN, Number.POSITIVE_INFINITY, null, undefined]) {
      assert.equal(formatClock(value as number | null | undefined), NO_TIME);
    }
  });
});

describe("buildBoardRows against the real section metadata", () => {
  const rows = buildBoardRows(SECTIONS);

  it("has one row for the prologue and each part, in order, then the last train", () => {
    assert.equal(rows.length, 7);
    assert.deepEqual(
      rows.slice(0, 6).map((row) => row.number),
      [0, 1, 2, 3, 4, 5],
    );
    assert.deepEqual(
      rows.slice(0, 6).map((row) => row.id),
      sectionFiles.map((name) => name.replace(/\.md$/, "")),
    );
    assert.ok(rows.slice(0, 6).every((row) => row.kind === "section"));
    assert.equal(rows[6].kind, "last");
  });

  it("carries title, chapter range and reading time straight from the frontmatter", () => {
    for (const row of rows.slice(0, 6)) {
      const section = SECTIONS.find((candidate) => candidate.id === row.id)!;
      assert.equal(row.title, section.title);
      assert.equal(row.chapterRange, section.chapterRange);
      assert.equal(row.readingMinutes, section.readingMinutes);
      assert.equal(row.clock, formatClock(section.readingMinutes));
      assert.equal(row.readingText, formatReadingTime(section.readingMinutes));
      assert.equal(row.label, section.number === 0 ? "บทนำ" : `ภาค ${section.number}`);
    }
  });

  it("ends with the last-train row: a title, --:--, no link target and no metadata", () => {
    const last = rows[6];
    assert.equal(last.title, "ขบวนสุดท้าย");
    assert.equal(last.title, LAST_TRAIN_TITLE);
    assert.equal(last.clock, "--:--");
    assert.equal(last.id, null);
    assert.equal(last.number, null);
    assert.equal(last.chapterRange, null);
    assert.equal(last.readingMinutes, null);
    assert.equal(last.readingText, null);
  });

  it("orders by section number whatever order the collection hands them over in", () => {
    const shuffled = [SECTIONS[3], SECTIONS[0], SECTIONS[5], SECTIONS[1], SECTIONS[4], SECTIONS[2]];
    assert.deepEqual(buildBoardRows(shuffled), rows);
  });

  it("does not mutate its input", () => {
    const input = [SECTIONS[2], SECTIONS[1]];
    buildBoardRows(input);
    assert.deepEqual(
      input.map((section) => section.number),
      [2, 1],
    );
  });

  it("still ends with the last train when there are no sections", () => {
    assert.deepEqual(
      buildBoardRows([]).map((row) => row.kind),
      ["last"],
    );
  });

  it("labels the prologue and the parts as the table of contents does", () => {
    assert.equal(partLabel(0), "บทนำ");
    assert.equal(partLabel(3), "ภาค 3");
  });
});

// ---- read state ------------------------------------------------------------

describe("the keys and thresholds mirror ReadingProgress.astro and the table of contents", () => {
  const progress = read("src/components/tsukinomi/reading/ReadingProgress.astro");

  it("uses the same storage keys", () => {
    assert.ok(progress.includes(`"${READS_KEY}"`), "read-marks key");
    assert.ok(progress.includes(`"${LAST_KEY}"`), "last key");
    assert.ok(progress.includes("`tsukinomi:reading:section:${sectionId}`"), "per-section key");
    assert.equal(sectionProgressKey("01-discovery"), "tsukinomi:reading:section:01-discovery");
    assert.ok(read("src/pages/tsukinomi/sections/index.astro").includes(`"${READS_KEY}"`), "table of contents key");
  });

  it("uses the same progress thresholds", () => {
    assert.match(progress, new RegExp(`MIN_TRACKED_PROGRESS = ${MIN_TRACKED_PROGRESS}`));
    assert.match(progress, new RegExp(`COMPLETED_PROGRESS = ${COMPLETED_PROGRESS}`));
  });
});

describe("deriveReadState", () => {
  const reads = (...numbers: number[]) => JSON.stringify(numbers.map(idOf));

  it("puts the marker at part 3 for read marks on parts 1 to 3", () => {
    const state = readStateFromStorage(storageOf({ [READS_KEY]: reads(1, 2, 3) }), UNITS);
    assert.equal(state.furthestRead, 3);
    assert.equal(state.furthestOpened, 3);
    assert.deepEqual(
      [0, 1, 2, 3, 4, 5].map((number) => state.status[number]),
      ["unread", "read", "read", "read", "unread", "unread"],
    );
    assert.equal(markerStation(state.furthestRead), 2);
  });

  it("reads the furthest part, not the longest run: marks on 1 and 4 give 4", () => {
    assert.equal(readStateFromStorage(storageOf({ [READS_KEY]: reads(1, 4) }), UNITS).furthestRead, 4);
  });

  it("is empty for a reader with nothing stored", () => {
    const state = readStateFromStorage(storageOf({}), UNITS);
    assert.equal(state.furthestRead, null);
    assert.equal(state.furthestOpened, null);
    assert.ok(Object.values(state.status).every((status) => status === "unread"));
    assert.equal(markerStation(state.furthestRead), null);
  });

  it("is empty when storage is blocked, absent or throws", () => {
    for (const storage of [
      null,
      {
        getItem: () => {
          throw new Error("SecurityError");
        },
      },
    ]) {
      const state = readStateFromStorage(storage, UNITS);
      assert.equal(state.furthestRead, null);
      assert.equal(state.furthestOpened, null);
    }
  });

  it("survives corrupt values under every key", () => {
    const corrupt = [
      "{",
      "not json",
      "null",
      "true",
      "42",
      '"01-discovery"',
      "[null, 3, {}, [], false]",
      '{"progress":"lots"}',
      "[[[[",
      "",
    ];
    for (const value of corrupt) {
      const values: Record<string, string> = { [READS_KEY]: value, [LAST_KEY]: value };
      for (const unit of UNITS) values[sectionProgressKey(unit.id)] = value;
      assert.doesNotThrow(() => readStateFromStorage(storageOf(values), UNITS), value);
    }
    const state = readStateFromStorage(
      storageOf({ [READS_KEY]: "{", [LAST_KEY]: "}", [sectionProgressKey(idOf(2))]: "oops" }),
      UNITS,
    );
    assert.equal(state.furthestRead, null);
    assert.equal(state.furthestOpened, null);
  });

  it("ignores ids that are not sections and never guesses at them", () => {
    const state = readStateFromStorage(
      storageOf({ [READS_KEY]: JSON.stringify(["99-nope", "", "chapter-01", null, 17, "01-discovery-copy"]) }),
      UNITS,
    );
    assert.equal(state.furthestRead, null);
  });

  it("accepts older shapes: numbers or numeric strings in the read list, records keyed by chapterId", () => {
    assert.equal(readStateFromStorage(storageOf({ [READS_KEY]: "[1,2]" }), UNITS).furthestRead, 2);
    assert.equal(readStateFromStorage(storageOf({ [READS_KEY]: '["3"]' }), UNITS).furthestRead, 3);
    assert.equal(readStateFromStorage(storageOf({ [READS_KEY]: '{"02-reveal":true,"04-mountain":false}' }), UNITS).furthestRead, 2);
    const old = readStateFromStorage(
      storageOf({ [LAST_KEY]: JSON.stringify({ chapterId: idOf(2), progress: 1 }) }),
      UNITS,
    );
    assert.equal(old.furthestRead, 2);
  });

  it("counts a section whose saved progress is complete as read, even without a read mark", () => {
    const state = readStateFromStorage(
      storageOf({ [sectionProgressKey(idOf(1))]: JSON.stringify({ sectionId: idOf(1), progress: 1 }) }),
      UNITS,
    );
    assert.equal(state.status[1], "read");
    assert.equal(state.furthestRead, 1);
  });

  it("separates opened from read at the thresholds", () => {
    const at = (progress: number | string) =>
      readStateFromStorage(
        storageOf({ [sectionProgressKey(idOf(2))]: JSON.stringify({ sectionId: idOf(2), progress }) }),
        UNITS,
      ).status[2];
    assert.equal(at(0), "unread");
    assert.equal(at(MIN_TRACKED_PROGRESS - 0.001), "unread");
    assert.equal(at(MIN_TRACKED_PROGRESS), "opened");
    assert.equal(at(0.5), "opened");
    assert.equal(at("0.5"), "opened");
    assert.equal(at(COMPLETED_PROGRESS - 0.001), "opened");
    assert.equal(at(COMPLETED_PROGRESS), "read");
    assert.equal(at(1), "read");
    assert.equal(at(7), "read");
    assert.equal(at(-1), "unread");
  });

  it("keeps opened apart from read: a reader mid-way through part 4 has the marker on part 3", () => {
    const state = readStateFromStorage(
      storageOf({
        [READS_KEY]: reads(1, 2, 3),
        [sectionProgressKey(idOf(4))]: JSON.stringify({ sectionId: idOf(4), progress: 0.4 }),
        [LAST_KEY]: JSON.stringify({ sectionId: idOf(4), progress: 0.4 }),
      }),
      UNITS,
    );
    assert.equal(state.furthestRead, 3);
    assert.equal(state.furthestOpened, 4);
    assert.equal(state.status[4], "opened");
  });

  it("uses the last-read record when the per-section record was cleared", () => {
    const state = readStateFromStorage(
      storageOf({ [LAST_KEY]: JSON.stringify({ sectionId: idOf(3), progress: 0.2 }) }),
      UNITS,
    );
    assert.equal(state.status[3], "opened");
    assert.equal(state.furthestRead, null);
  });

  it("lets a read mark outlast cleared progress", () => {
    // The home page's "clear position" button removes the progress keys, never the marks.
    const state = readStateFromStorage(storageOf({ [READS_KEY]: reads(2) }), UNITS);
    assert.equal(state.status[2], "read");
  });

  it("gives the prologue a status but no marker", () => {
    const state = readStateFromStorage(storageOf({ [READS_KEY]: reads(0) }), UNITS);
    assert.equal(state.status[0], "read");
    assert.equal(state.furthestRead, 0);
    assert.equal(markerStation(state.furthestRead), null);
    assert.deepEqual(illustrationsUpTo(buildIllustrationCatalog(["section-01-a.webp"], SECTIONS), state.furthestRead), []);
  });

  it("derives the same state from parsed values as from storage", () => {
    const state = deriveReadState(
      { reads: [idOf(1)], last: { sectionId: idOf(2), progress: 0.3 }, sections: {} },
      UNITS,
    );
    assert.equal(state.furthestRead, 1);
    assert.equal(state.furthestOpened, 2);
  });
});

describe("parsing helpers", () => {
  it("parseJson answers undefined for anything it cannot parse", () => {
    assert.equal(parseJson(null), undefined);
    assert.equal(parseJson(undefined), undefined);
    assert.equal(parseJson(""), undefined);
    assert.equal(parseJson("{"), undefined);
    assert.deepEqual(parseJson('["a"]'), ["a"]);
  });

  it("resolvePart maps ids and numbers and refuses the rest", () => {
    assert.equal(resolvePart("03-decision", UNITS), 3);
    assert.equal(resolvePart(" 03-decision ", UNITS), 3);
    assert.equal(resolvePart(3, UNITS), 3);
    assert.equal(resolvePart("3", UNITS), 3);
    assert.equal(resolvePart("03", UNITS), 3);
    for (const bad of [6, 3.5, -1, "6", "03-nope", "", {}, [], null, undefined, true, Number.NaN]) {
      assert.equal(resolvePart(bad, UNITS), null, String(bad));
    }
  });

  it("recordProgress clamps and refuses non-numbers", () => {
    assert.equal(recordProgress({ progress: 0.25 }), 0.25);
    assert.equal(recordProgress({ progress: "0.25" }), 0.25);
    assert.equal(recordProgress({ progress: 9 }), 1);
    assert.equal(recordProgress({ progress: -9 }), 0);
    for (const bad of [null, undefined, "x", [], 5, { progress: null }, { progress: "" }, { progress: "x" }, { progress: [] }, { progress: true }, { progress: Number.NaN }]) {
      assert.equal(recordProgress(bad), null, JSON.stringify(bad));
    }
  });
});

// ---- rail ------------------------------------------------------------------

describe("stationPosition and railState", () => {
  it("puts five stations in equal slots", () => {
    assert.deepEqual(
      [0, 1, 2, 3, 4].map((index) => stationPosition(index, 5)),
      [0.1, 0.3, 0.5, 0.7, 0.9],
    );
  });

  it("lights nothing at the start and everything at the end", () => {
    const start = railState(0);
    assert.equal(start.fill, 0);
    assert.equal(start.active, -1);
    assert.deepEqual(start.lit, [false, false, false, false, false]);
    const end = railState(1);
    assert.equal(end.fill, 1);
    assert.equal(end.active, 4);
    assert.deepEqual(end.lit, [true, true, true, true, true]);
  });

  it("lights a station exactly when the head reaches its centre", () => {
    assert.equal(railState(0.0999).active, -1);
    assert.equal(railState(0.1).active, 0);
    assert.equal(railState(0.2999).active, 0);
    assert.equal(railState(0.3).active, 1);
    assert.equal(railState(0.5).active, 2);
    assert.equal(railState(0.8999).active, 3);
    assert.equal(railState(0.9).active, 4);
    assert.equal(railState(0.9).fill, 0.9);
  });

  it("lights stations in order and never un-lights one as progress grows", () => {
    let previous = -1;
    for (let step = 0; step <= 200; step += 1) {
      const { active } = railState(step / 200);
      assert.ok(active >= previous, `progress ${step / 200}`);
      previous = active;
    }
  });

  it("clamps and survives bad progress", () => {
    assert.equal(railState(-3).fill, 0);
    assert.equal(railState(4).fill, 1);
    assert.equal(railState(Number.NaN).fill, 0);
    assert.equal(railState(Number.NaN).active, -1);
    assert.equal(railState(Number.POSITIVE_INFINITY).fill, 0);
  });

  it("works for other station counts", () => {
    assert.deepEqual(railState(0.5, 2).lit, [true, false]);
    assert.equal(railState(1, 3).lit.length, 3);
  });
});

describe("markerStation", () => {
  it("maps part n to station n - 1", () => {
    assert.deepEqual(
      [1, 2, 3, 4, 5].map((part) => markerStation(part)),
      [0, 1, 2, 3, 4],
    );
  });

  it("has no marker for nothing read, the prologue alone or a bad value", () => {
    for (const value of [null, 0, -1, Number.NaN]) assert.equal(markerStation(value), null);
  });

  it("never points past the last station", () => {
    assert.equal(markerStation(9), 4);
  });
});

describe("railProgress", () => {
  it("is 0 while the rail is below the anchor and 1 once it has travelled its own height", () => {
    assert.equal(railProgress({ top: 1200, height: 400 }, 800, { anchor: 0.7 }), 0);
    assert.equal(railProgress({ top: 560, height: 400 }, 800, { anchor: 0.7 }), 0); // top exactly at 0.7 * 800
    assert.equal(railProgress({ top: 160, height: 400 }, 800, { anchor: 0.7 }), 1); // one rail height later
    assert.equal(railProgress({ top: -500, height: 400 }, 800, { anchor: 0.7 }), 1);
  });

  it("is linear between, and starts at 0.75 of the viewport by default", () => {
    assert.equal(railProgress({ top: 400, height: 400 }, 800, { anchor: 0.7 }), 0.4);
    assert.equal(railProgress({ top: 600, height: 400 }, 800), 0);
    assert.equal(railProgress({ top: 400, height: 400 }, 800), 0.5);
  });

  it("honours the anchor, clamped to the viewport", () => {
    assert.equal(railProgress({ top: 400, height: 400 }, 800, { anchor: 0.5 }), 0);
    assert.equal(railProgress({ top: 200, height: 400 }, 800, { anchor: 0.5 }), 0.5);
    assert.equal(railProgress({ top: 800, height: 400 }, 800, { anchor: 9 }), 0);
  });

  it("stretches a short rail over minTravel so it does not draw in one flick", () => {
    assert.equal(railProgress({ top: 400, height: 200 }, 800, { minTravel: 400 }), 0.5);
    assert.equal(railProgress({ top: 400, height: 200 }, 800), 1);
  });

  it("completes at the end of the page, not later, when the page is short", () => {
    // A 200 px rail that will rest at top 520: the anchor (600) would leave only 80 px to draw in,
    // so the line draws from the rail entering the viewport (800) to the end of the page.
    const options = { restTop: 520 };
    assert.equal(railProgress({ top: 800, height: 200 }, 800, options), 0);
    assert.equal(railProgress({ top: 660, height: 200 }, 800, options), 0.5);
    assert.equal(railProgress({ top: 520, height: 200 }, 800, options), 1);
    assert.equal(railProgress({ top: 520, height: 200 }, 800), 0.4); // without it the line stops short
  });

  it("copes with a page that ends with the rail still near the bottom", () => {
    assert.equal(railProgress({ top: 750, height: 200 }, 800, { restTop: 700 }), 0.5);
    assert.equal(railProgress({ top: 700, height: 200 }, 800, { restTop: 700 }), 1);
    // Rail resting at or below the fold: nothing to scroll through, so it is complete only once it is where it will rest.
    assert.equal(railProgress({ top: 900, height: 200 }, 800, { restTop: 900 }), 1);
    assert.equal(railProgress({ top: 950, height: 200 }, 800, { restTop: 900 }), 0);
  });

  it("is not stretched by a page with room to spare", () => {
    const rail = { top: 300, height: 400 };
    assert.equal(railProgress(rail, 800, { restTop: -2000 }), railProgress(rail, 800));
    assert.equal(railProgress({ top: 300, height: 200 }, 800, { restTop: -2000, minTravel: 400 }), 0.75);
  });

  it("with minTravel and a short page, draws over the scroll that is left and completes at the end", () => {
    const options = { minTravel: 360, restTop: 300 };
    assert.equal(railProgress({ top: 800, height: 200 }, 800, options), 0);
    assert.equal(railProgress({ top: 550, height: 200 }, 800, options), 0.5);
    assert.equal(railProgress({ top: 300, height: 200 }, 800, options), 1);
  });

  it("never goes backwards as the rail scrolls up, and stays within 0..1", () => {
    for (const options of [{}, { restTop: 380 }, { restTop: 700, minTravel: 300 }, { minTravel: 500, restTop: 100 }]) {
      let previous = 0;
      for (let top = 1000; top >= -600; top -= 7) {
        const value = railProgress({ top, height: 300 }, 800, options);
        assert.ok(value >= previous && value >= 0 && value <= 1, `${JSON.stringify(options)} top ${top}`);
        previous = value;
      }
    }
  });

  it("is 1 at the end of the page whatever the layout", () => {
    for (const [height, rest, minTravel] of [[200, 520, 0], [415, 285, 0], [200, 240, 360], [415, 600, 0], [90, 700, 500]]) {
      assert.equal(railProgress({ top: rest, height }, 800, { restTop: rest, minTravel }), 1, `height ${height} rest ${rest}`);
    }
  });

  it("gives 0 for measurements that are not finite or a viewport with no height", () => {
    assert.equal(railProgress({ top: Number.NaN, height: 400 }, 800), 0);
    assert.equal(railProgress({ top: 0, height: Number.POSITIVE_INFINITY }, 800), 0);
    assert.equal(railProgress({ top: 0, height: 400 }, 0), 0);
    assert.equal(railProgress({ top: 0, height: 400 }, Number.NaN), 0);
  });

  it("ignores a restTop or minTravel that is not a number", () => {
    assert.equal(railProgress({ top: 400, height: 400 }, 800, { restTop: Number.NaN, minTravel: Number.NaN }), 0.5);
  });

  it("never divides by zero on a rail with no height", () => {
    assert.ok(Number.isFinite(railProgress({ top: 100, height: 0 }, 800)));
    assert.ok(Number.isFinite(railProgress({ top: 100, height: 0 }, 800, { restTop: 100 })));
  });
});

// ---- tint and palettes -----------------------------------------------------

describe("tintAt", () => {
  it("is off at the start, full at the first station, and blends between stations", () => {
    assert.deepEqual(tintAt(0), { from: 0, to: 0, mix: 0, strength: 0 });
    assert.equal(tintAt(0.05).strength, 0.5);
    assert.deepEqual(tintAt(0.1), { from: 0, to: 0, mix: 0, strength: 1 });
    assert.deepEqual(tintAt(0.2), { from: 0, to: 1, mix: 0.5, strength: 1 });
    assert.deepEqual(tintAt(0.3), { from: 1, to: 2, mix: 0, strength: 1 });
    assert.equal(tintAt(0.5).from, 2);
    assert.equal(tintAt(0.5).mix, 0);
    assert.equal(tintAt(0.8).from, 3);
    assert.equal(tintAt(0.8).to, 4);
    assert.deepEqual(tintAt(0.9), { from: 4, to: 4, mix: 0, strength: 1 });
    assert.deepEqual(tintAt(1), { from: 4, to: 4, mix: 0, strength: 1 });
  });

  it("is continuous: a tiny step in progress never jumps the blend", () => {
    const blend = (progress: number) => {
      const state = tintAt(progress);
      // The tint colour as a position along the station axis, 0..4.
      return state.strength * (state.from + (state.to - state.from) * state.mix);
    };
    let previous = blend(0);
    for (let step = 1; step <= 1000; step += 1) {
      const current = blend(step / 1000);
      assert.ok(Math.abs(current - previous) < 0.02, `jump at ${step / 1000}`);
      previous = current;
    }
  });

  it("keeps mix and strength in 0..1 for any input", () => {
    for (const progress of [-5, -0.1, 0, 0.123, 0.5, 0.999, 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { mix, strength, from, to } = tintAt(progress);
      assert.ok(mix >= 0 && mix <= 1, String(progress));
      assert.ok(strength >= 0 && strength <= 1, String(progress));
      assert.ok(from >= 0 && from < 5 && to >= 0 && to < 5 && to >= from, String(progress));
    }
  });
});

describe("the part to palette mapping", () => {
  it("takes each station's palette from the section metadata, parts 1 to 5 in order", () => {
    assert.deepEqual(stationPalettes(SECTIONS), ["autumn", "twilight", "warm-room", "snow-pact", "winter-light"]);
    assert.deepEqual(
      stationPalettes(SECTIONS),
      SECTIONS.filter((section) => section.number >= 1).map((section) => section.palette),
    );
  });

  it("falls back to autumn for a part missing from the metadata", () => {
    assert.deepEqual(stationPalettes(SECTIONS.slice(0, 3)), ["autumn", "twilight", "autumn", "autumn", "autumn"]);
  });

  it("has a token for every palette the content schema allows, and each token exists in tokens.css", () => {
    const schema = /palette:\s*z\.enum\(\[([^\]]+)\]\)/.exec(read("src/content.config.ts"))?.[1] ?? "";
    const allowed = [...schema.matchAll(/"([a-z-]+)"/g)].map((match) => match[1]);
    assert.deepEqual([...allowed].sort(), [...PALETTES].sort());
    const tokens = read("src/styles/tsukinomi/tokens.css");
    for (const palette of PALETTES) {
      const token = PALETTE_TOKEN[palette];
      assert.ok(token, palette);
      assert.match(tokens, new RegExp(`${token}:\\s*#[0-9A-Fa-f]{6}`), `${palette} -> ${token}`);
    }
  });

  it("section.css names each palette the board tints with", () => {
    const css = read("src/styles/tsukinomi/section.css");
    for (const palette of PALETTES.filter((name) => name !== "autumn")) {
      assert.ok(css.includes(`palette-${palette}`), palette);
    }
  });
});

describe("the tint never costs text its contrast", () => {
  const tokens = read("src/styles/tsukinomi/tokens.css");
  const hex = (name: string) => {
    const match = new RegExp(`${name}:\\s*#([0-9A-Fa-f]{6})`).exec(tokens);
    assert.ok(match, `token ${name}`);
    const value = parseInt(match[1], 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
  };
  const luminance = ([r, g, b]: readonly number[]) => {
    const channel = (value: number) => {
      const s = value / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const contrast = (a: readonly number[], b: readonly number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const mix = (over: readonly number[], under: readonly number[], alpha: number) =>
    over.map((value, index) => value * alpha + under[index] * (1 - alpha));

  it("keeps the strongest tint low", () => {
    assert.ok(TINT_MAX_ALPHA > 0 && TINT_MAX_ALPHA <= 0.1, String(TINT_MAX_ALPHA));
  });

  it("keeps the part labels (station colour mixed 45 percent into the ink) at 4.5:1 on the night ground", () => {
    for (const palette of PALETTES) {
      const label = mix(hex(PALETTE_TOKEN[palette]), hex("--ink"), 0.45);
      const tinted = mix(hex(PALETTE_TOKEN[palette]), hex("--bg-night"), TINT_MAX_ALPHA);
      assert.ok(contrast(label, tinted) >= 4.5, `label ${palette}: ${contrast(label, tinted).toFixed(2)}`);
    }
    const css = read("src/styles/tsukinomi/home.css");
    assert.ok(css.includes("color-mix(in srgb, var(--station-color) 45%, var(--concourse-ink))"), "home.css mixes the label colour as the test assumes");
  });

  it("keeps the dimmest station text at 4.5:1 while the line has not reached it", () => {
    const css = read("src/styles/tsukinomi/home.css");
    const opacity = Number(/--rail-unlit-opacity:\s*([0-9.]+)/.exec(css)?.[1]);
    assert.ok(opacity > 0 && opacity <= 1, "unlit opacity");
    const night = hex("--bg-night");
    const dimmed = mix(hex("--ink-muted"), night, opacity);
    assert.ok(contrast(dimmed, night) >= 4.5, `ink-muted at ${opacity}: ${contrast(dimmed, night).toFixed(2)}`);
  });

  it("keeps body text at 7:1 and the dimmest text at 4.5:1 over every tinted ground", () => {
    for (const ground of ["--surface", "--bg-night"]) {
      for (const palette of PALETTES) {
        const tinted = mix(hex(PALETTE_TOKEN[palette]), hex(ground), TINT_MAX_ALPHA);
        assert.ok(contrast(hex("--ink"), tinted) >= 7, `ink on ${ground} + ${palette}`);
        assert.ok(contrast(hex("--ink-muted"), tinted) >= 4.5, `ink-muted on ${ground} + ${palette}`);
      }
    }
  });
});

// ---- illustrations and the spoiler rule ------------------------------------

describe("parseChapterRange", () => {
  it("reads the ranges the metadata uses", () => {
    assert.deepEqual(parseChapterRange("บทที่ 1–3"), { from: 1, to: 3 });
    assert.deepEqual(parseChapterRange("บทที่ 11–16"), { from: 11, to: 16 });
    assert.deepEqual(parseChapterRange("บทที่ 7-10"), { from: 7, to: 10 });
    assert.deepEqual(parseChapterRange("บทที่ 5"), { from: 5, to: 5 });
  });

  it("answers null for the prologue's range and for nonsense", () => {
    assert.equal(parseChapterRange("เกริ่นนำ"), null);
    assert.equal(parseChapterRange(""), null);
    assert.equal(parseChapterRange("บทที่ 9–2"), null);
  });
});

describe("illustration to part mapping", () => {
  const DIR = "public/assets/tsukinomi/images/illustrations";
  const files = readdirSync(join(root, DIR)).filter((name) => name.endsWith(".webp"));
  const catalog = buildIllustrationCatalog(files, SECTIONS);

  it("finds the 18 illustrations", () => {
    assert.equal(files.length, 18);
    assert.equal(catalog.length, 18);
  });

  it("places every one in a part from 1 to 5", () => {
    for (const entry of catalog) {
      assert.ok(entry.part !== null && entry.part >= 1 && entry.part <= 5, `${entry.file} -> ${entry.part}`);
    }
  });

  it("agrees with the section each one is actually embedded in", () => {
    for (const entry of catalog) {
      const hosts = SECTIONS.filter((section) => bodies.get(section.id)!.includes(`illustrations/${entry.file}`));
      assert.equal(hosts.length, 1, `${entry.file} is embedded in ${hosts.length} sections`);
      assert.equal(entry.part, hosts[0].number, entry.file);
    }
  });

  it("covers every part from 1 to 5 at least once", () => {
    assert.deepEqual(
      [...new Set(catalog.map((entry) => entry.part))],
      [1, 2, 3, 4, 5],
    );
  });

  it("derives chapter-NN files from the chapter ranges, not a table", () => {
    assert.equal(illustrationPart("chapter-03-empty-station.webp", SECTIONS), 1);
    assert.equal(illustrationPart("chapter-06-microfilm-research-akira-screen.webp", SECTIONS), 2);
    assert.equal(illustrationPart("chapter-09-river-confession.webp", SECTIONS), 3);
    assert.equal(illustrationPart("chapter-11-abandoned-village.webp", SECTIONS), 4);
    assert.equal(illustrationPart("chapter-16-first-frost-no-reflection.webp", SECTIONS), 4);
    assert.equal(illustrationPart("chapter-17-sketchbook.webp", SECTIONS), 5);
    // Renumber the ranges and the illustration follows the chapter.
    const shifted = SECTIONS.map((section) => (section.number === 5 ? { ...section, chapterRange: "บทที่ 16–18" } : section.number === 4 ? { ...section, chapterRange: "บทที่ 11–15" } : section));
    assert.equal(illustrationPart("chapter-16-first-frost-no-reflection.webp", shifted), 5);
  });

  it("reads section-0N files by their number and accepts a path", () => {
    assert.equal(illustrationPart("section-02-rooftop-research.webp", SECTIONS), 2);
    assert.equal(illustrationPart("/assets/tsukinomi/images/illustrations/section-04-hina.webp", SECTIONS), 4);
  });

  it("gives null to names it cannot place, and to parts that do not exist", () => {
    assert.equal(illustrationPart("portrait-haruto.webp", SECTIONS), null);
    assert.equal(illustrationPart("chapter-99-lost.webp", SECTIONS), null);
    assert.equal(illustrationPart("section-09-lost.webp", SECTIONS), null);
    assert.equal(illustrationPart("section-1-short.webp", SECTIONS), null);
    assert.equal(illustrationPart("", SECTIONS), null);
  });

  it("orders the catalog by part, then name, with unplaced files last", () => {
    const sorted = buildIllustrationCatalog(["z-unknown.webp", "section-02-b.webp", "section-01-b.webp", "section-01-a.webp"], SECTIONS);
    assert.deepEqual(
      sorted.map((entry) => entry.file),
      ["section-01-a.webp", "section-01-b.webp", "section-02-b.webp", "z-unknown.webp"],
    );
  });
});

describe("the spoiler rule", () => {
  const files = readdirSync(join(root, "public/assets/tsukinomi/images/illustrations")).filter((name) => name.endsWith(".webp"));
  const catalog = buildIllustrationCatalog(files, SECTIONS);
  const partsOf = (value: number | null | undefined) => [...new Set(illustrationsUpTo(catalog, value).map((entry) => entry.part))];

  it("shows a new reader nothing", () => {
    assert.deepEqual(illustrationsUpTo(catalog, null), []);
    assert.deepEqual(illustrationsUpTo(catalog, undefined), []);
    assert.deepEqual(illustrationsUpTo(catalog, 0), []);
  });

  it("shows the parts up to the furthest read and none beyond", () => {
    assert.deepEqual(partsOf(1), [1]);
    assert.deepEqual(partsOf(2), [1, 2]);
    assert.deepEqual(partsOf(3), [1, 2, 3]);
    assert.deepEqual(partsOf(5), [1, 2, 3, 4, 5]);
    assert.equal(illustrationsUpTo(catalog, 5).length, 18);
  });

  it("never lets a later part through, whatever the furthest part", () => {
    for (let furthest = 0; furthest <= 5; furthest += 1) {
      for (const entry of illustrationsUpTo(catalog, furthest)) {
        assert.ok(entry.part !== null && entry.part <= furthest, `${entry.file} at ${furthest}`);
      }
    }
  });

  it("never shows an illustration whose part is unknown", () => {
    const withStray = [...catalog, { file: "stray.webp", part: null }];
    assert.ok(!illustrationsUpTo(withStray, 5).some((entry) => entry.file === "stray.webp"));
  });

  it("treats a value that is not a number as nothing read", () => {
    for (const value of [Number.NaN, Number.NEGATIVE_INFINITY, "3" as unknown as number]) {
      assert.deepEqual(illustrationsUpTo(catalog, value), [], String(value));
    }
  });

  it("follows read, not opened: a reader who has only opened part 3 sees parts 1 and 2", () => {
    const state = readStateFromStorage(
      storageOf({
        [READS_KEY]: JSON.stringify([idOf(1), idOf(2)]),
        [sectionProgressKey(idOf(3))]: JSON.stringify({ sectionId: idOf(3), progress: 0.5 }),
      }),
      UNITS,
    );
    assert.deepEqual(partsOf(state.furthestRead), [1, 2]);
  });
});

describe("home.css and the script agree on their media queries", () => {
  const css = read("src/styles/tsukinomi/home.css");

  it("uses the mobile portrait query for the vertical rail and stacked rows", () => {
    assert.equal(RAIL_VERTICAL_QUERY, "(max-width: 760px)");
    assert.ok(css.includes(`@media ${RAIL_VERTICAL_QUERY}`));
    assert.ok(read("src/styles/tsukinomi/global.css").includes(`@media ${RAIL_VERTICAL_QUERY}`), "global.css switches its home column at the same width");
  });

  it("uses the short-landscape query for the train band and the direct board", () => {
    assert.ok(css.includes(`@media ${SHORT_LANDSCAPE_QUERY}`));
  });
});

describe("short landscape", () => {
  it("is a landscape rule on height, shared with the compact hero in global.css", () => {
    assert.equal(SHORT_LANDSCAPE_QUERY, "(orientation: landscape) and (max-height: 500px)");
    assert.ok(read("src/styles/tsukinomi/global.css").includes(`@media ${SHORT_LANDSCAPE_QUERY}`));
  });
});
