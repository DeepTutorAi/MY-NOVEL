import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  buildSnapshot,
  cardAt,
  cardColumn,
  classifyMode,
  hitRect,
  holeDistance,
  isCovered,
  regions,
  toViewport,
  zoneAt,
} from "./page-model-core";
import type { CardInfo, CardKind, HubMode, PageMeasure, PageSnapshot, Rect } from "./types";

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

function card(slug: string, kind: CardKind, index: number, r: Rect): CardInfo {
  return {
    slug,
    kind,
    index,
    accent: "#8CCFFF",
    rect: r,
    media: rect(r.x, r.y, r.w, 290),
    body: rect(r.x, r.y + 290, r.w, r.h - 290),
    read: null,
    finished: false,
    stateText: "",
    titleTh: slug,
  };
}

/**
 * A synthetic 1440x900 hub (two columns, shell 1080 wide at x 180): hero, optional resume card,
 * stage, library head, two rows of published cards, the mid window, one row of upcoming cards and
 * the footer with the ground window behind it.
 */
function desktop(withResume: boolean): PageMeasure {
  const shift = withResume ? 150 : 0;
  const top = 660 + shift;
  const cards = [
    card("a", "open", 0, rect(180, top, 524, 520)),
    card("b", "open", 1, rect(736, top, 524, 520)),
    card("c", "open", 2, rect(180, top + 576, 524, 520)),
    card("d", "locked", 3, rect(736, top + 576, 524, 520)),
    card("e", "upcoming", 4, rect(180, top + 1392, 524, 520)),
    card("f", "upcoming", 5, rect(736, top + 1392, 524, 520)),
  ];
  const resume = withResume ? rect(180, 262, 1080, 138) : undefined;
  const parts = {
    chip: rect(990, 56, 270, 44),
    picker: rect(1100, 110, 160, 44),
    title: rect(180, 117, 700, 80),
    sideNote: rect(920, 152, 340, 80),
    resume,
    libraryHead: rect(180, 600 + shift, 1080, 40),
    footer: rect(180, top + 2000, 1080, 380),
  };
  const windows = {
    stage: rect(180, 410 + shift, 1080, 198),
    mid: rect(180, top + 1136, 1080, 216),
    ground: rect(180, top + 2000, 1080, 380),
  };
  return {
    viewport: { w: 1440, h: 900, coarse: false, dpr: 1 },
    shell: rect(180, 0, 1080, top + 2380),
    parts,
    windows,
    hitFractions: { stage: rect(0.4, 0.2, 0.2, 0.6), mid: rect(0.45, 0.1, 0.01, 0.1) },
    cards,
    holes: [parts.title, parts.sideNote, parts.chip, parts.picker, parts.libraryHead, ...(resume ? [resume] : [])],
    cover: [...cards.map((c) => c.rect), parts.chip, parts.sideNote, parts.picker, ...(resume ? [resume] : [])],
    modalOpen: false,
  };
}

/** A 390x844 phone: one full-width column. */
function phone(): PageMeasure {
  const cards = [card("a", "open", 0, rect(16, 640, 358, 520)), card("b", "open", 1, rect(16, 1192, 358, 520))];
  return {
    viewport: { w: 390, h: 844, coarse: true, dpr: 3 },
    shell: rect(16, 0, 358, 2400),
    parts: { title: rect(16, 86, 358, 48), libraryHead: rect(16, 590, 358, 32), footer: rect(16, 1900, 358, 300) },
    windows: { stage: rect(16, 432, 358, 135), mid: rect(16, 1740, 358, 140), ground: rect(16, 1900, 358, 300) },
    hitFractions: { stage: rect(0.3, 0.2, 0.4, 0.6), mid: rect(0.3, 0.2, 0.4, 0.6) },
    cards,
    holes: [],
    cover: cards.map((c) => c.rect),
    modalOpen: false,
  };
}

describe("classifyMode", () => {
  const gutter = (w: number) => Math.max(0, (w - 1080) / 2);

  it("classifies the seven acceptance sizes and 667x375", () => {
    assert.equal(classifyMode(1440, 900, gutter(1440)), "desktop");
    assert.equal(classifyMode(1280, 800, gutter(1280)), "narrow");
    assert.equal(classifyMode(2560, 1440, gutter(2560)), "wide");
    assert.equal(classifyMode(390, 844, 16), "phone");
    assert.equal(classifyMode(844, 390, 20), "landscape-short");
    assert.equal(classifyMode(320, 568, 16), "phone");
    assert.equal(classifyMode(700, 560, 16), "phone", "700x560 matches the single-column CSS");
    assert.equal(classifyMode(667, 375, 20), "landscape-short");
  });

  it("lets landscape-short win over every other mode", () => {
    assert.equal(classifyMode(1400, 500, 300), "landscape-short");
    assert.equal(classifyMode(700, 450, 16), "landscape-short");
    assert.equal(classifyMode(500, 500, 16), "phone", "square is not landscape");
  });

  it("splits narrow, desktop and wide on the gutter", () => {
    assert.equal(classifyMode(1300, 900, 119.9), "narrow");
    assert.equal(classifyMode(1300, 900, 120), "desktop");
    assert.equal(classifyMode(1600, 900, 259.9), "desktop");
    assert.equal(classifyMode(1600, 900, 260), "wide");
    assert.equal(classifyMode(781, 900, 300), "wide");
  });
});

describe("hitRect", () => {
  it("scales the window box by the fractions", () => {
    assert.deepEqual(hitRect(rect(100, 200, 1000, 200), rect(0.4, 0.25, 0.2, 0.5)), rect(500, 250, 200, 100));
  });

  it("is at least 44x44", () => {
    const r = hitRect(rect(0, 0, 300, 100), rect(0.5, 0.5, 0.01, 0.1));
    assert.deepEqual(r, rect(150, 50, 44, 44));
  });
});

describe("regions", () => {
  it("groups any grid shape into rows, bands and column gaps", () => {
    const m = desktop(false);
    const r = regions(m);
    assert.equal(r.rows.length, 3);
    assert.deepEqual(r.rows[0], { top: 660, bottom: 1180 });
    assert.equal(r.bands.length, 2);
    assert.deepEqual(r.bands[0], rect(0, 1180, 1440, 56));
    assert.equal(r.bands[1].h, 296, "the band around the mid window reaches the upcoming row");
    assert.equal(r.colGaps.length, 3);
    assert.deepEqual(r.colGaps[0], rect(704, 660, 32, 520));
  });

  it("ends the top band at the resume card when there is one, else at the stage", () => {
    assert.equal(regions(desktop(true)).topBand.h, 262);
    assert.equal(regions(desktop(false)).topBand.h, 410);
    assert.equal(regions(desktop(true)).topBand.w, 1440);
  });

  it("finds no column gaps in a single column", () => {
    const r = regions(phone());
    assert.equal(r.rows.length, 2);
    assert.equal(r.colGaps.length, 0);
    assert.deepEqual(r.bands, [rect(0, 1160, 390, 32)]);
  });
});

describe("buildSnapshot", () => {
  it("computes gutters, mode and hit rects, and adds the hits to the holes", () => {
    const m = desktop(true);
    const s = buildSnapshot(m, 7);
    assert.equal(s.version, 7);
    assert.deepEqual(s.gutters, { left: 180, right: 180 });
    assert.equal(s.mode, "desktop");
    assert.deepEqual(s.windows.stageHit, rect(180 + 0.4 * 1080, 560 + 0.2 * 198, 0.2 * 1080, 0.6 * 198));
    assert.deepEqual(s.windows.midHit.w, 44);
    assert.equal(s.holes.length, m.holes.length + 2);
    assert.deepEqual(s.holes.at(-2), s.windows.stageHit);
  });

  it("classifies a phone and keeps every card in reading order", () => {
    const s = buildSnapshot(phone(), 1);
    assert.equal(s.mode, "phone");
    assert.deepEqual(
      s.cards.map((c) => c.slug),
      ["a", "b"],
    );
  });

  it("does not add hit rects for windows that are missing", () => {
    const m = phone();
    m.windows.mid = rect(0, 0, 0, 0);
    const s = buildSnapshot(m, 1);
    assert.equal(s.holes.length, 1);
  });
});

describe("cover, holes and zones", () => {
  it("covers sprites behind cards and the resume card, not in gaps or gutters", () => {
    const s = buildSnapshot(desktop(true), 1);
    assert.ok(isCovered(s, 400, 1000, 8));
    assert.ok(isCovered(s, 700, 330, 8), "the resume card is opaque");
    assert.ok(!isCovered(s, 720, 1000, 0), "the column gap");
    assert.ok(!isCovered(s, 100, 1000, 0), "the left gutter");
    assert.ok(!isCovered(s, 186, 1000, 8), "a sprite overlapping the card edge still shows");
  });

  it("does not cover the resume area when there is no resume card", () => {
    const s = buildSnapshot(desktop(false), 1);
    assert.ok(!isCovered(s, 700, 330, 8));
  });

  it("measures the distance to the nearest hole", () => {
    const s = buildSnapshot(desktop(false), 1);
    assert.equal(holeDistance(s, 500, 150), 0, "inside the title");
    assert.equal(holeDistance(s, 500, 207), 10);
    assert.equal(holeDistance(buildSnapshot({ ...phone(), windows: { stage: rect(0, 0, 0, 0), mid: rect(0, 0, 0, 0), ground: rect(0, 0, 0, 0) } }, 1), 1, 1), Infinity);
  });

  it("finds the card under a point", () => {
    const s = buildSnapshot(desktop(false), 1);
    assert.equal(cardAt(s, 800, 700)?.slug, "b");
    assert.equal(cardAt(s, 720, 700), null);
  });

  it("names the zone under a point", () => {
    const s = buildSnapshot(desktop(true), 1);
    assert.equal(zoneAt(s, 800, 1000), "card");
    assert.equal(zoneAt(s, 500, 150), "ui", "the title");
    assert.equal(zoneAt(s, 700, 330), "ui", "the resume card");
    assert.equal(zoneAt(s, 650, 610), "ui", "the stage hit button");
    assert.equal(zoneAt(s, 250, 600), "stage");
    assert.equal(zoneAt(s, 250, 810 + 1136 + 20), "mid");
    assert.equal(zoneAt(s, 250, 810 + 2100), "ground");
    assert.equal(zoneAt(s, 60, 1000), "open");
    assert.equal(zoneAt(s, 720, 1000), "open", "the column gap");
    assert.equal(zoneAt({ ...s, modalOpen: true }, 60, 1000), "modal");
  });
});

describe("toViewport and cardColumn", () => {
  it("moves document rects into the viewport", () => {
    assert.deepEqual(toViewport(rect(10, 1200, 30, 40), 1000), rect(10, 200, 30, 40));
  });

  it("assigns l, r and full columns", () => {
    const s = buildSnapshot(desktop(false), 1);
    assert.deepEqual(
      s.cards.map((c) => cardColumn(s, c)),
      ["l", "r", "l", "r", "l", "r"],
    );
    const p = buildSnapshot(phone(), 1);
    assert.deepEqual(
      p.cards.map((c) => cardColumn(p, c)),
      ["full", "full"],
    );
  });
});

/* Captured from the built hub by qa/capture-fixtures.ts (pnpm hub:fixtures). */
interface FixtureCell {
  size: { w: number; h: number; label: string };
  state: "S0" | "S1";
  measure: PageMeasure;
  snapshot: PageSnapshot;
}

const FIXTURE = JSON.parse(readFileSync(new URL("./__fixtures__/page-snapshots.json", import.meta.url), "utf8")) as {
  format: number;
  cells: Record<string, FixtureCell>;
};
const CELLS = Object.entries(FIXTURE.cells);

const CAPTURED_MODES: Record<string, HubMode> = {
  "1440x900": "desktop",
  "1280x800": "narrow",
  "2560x1440": "wide",
  "390x844": "phone",
  "844x390": "landscape-short",
  "320x568": "phone",
  "700x560": "phone",
  "667x375": "landscape-short",
};

const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

describe("captured page snapshots", () => {
  it("hold every acceptance size in S0 and S1", () => {
    assert.equal(FIXTURE.format, 1);
    const expected = Object.keys(CAPTURED_MODES).flatMap((size) => [`${size}/S0`, `${size}/S1`]);
    assert.deepEqual(CELLS.map(([id]) => id).sort(), expected.sort());
  });

  it("rebuild exactly from their measures", () => {
    for (const [id, cell] of CELLS) {
      const built = JSON.parse(JSON.stringify(buildSnapshot(cell.measure, cell.snapshot.version))) as PageSnapshot;
      assert.deepEqual(built, cell.snapshot, id);
    }
  });

  it("classify every size as section 2.3 says", () => {
    for (const [id, cell] of CELLS) assert.equal(cell.snapshot.mode, CAPTURED_MODES[cell.size.label], id);
  });

  it("show the resume card in S1 and the start panel in S0, ending the top band", () => {
    for (const [id, cell] of CELLS) {
      const { parts, topBand } = cell.snapshot;
      const panel = cell.state === "S1" ? parts.resume : parts.start;
      assert.ok(panel, `${id}: ${cell.state === "S1" ? "resume card" : "start panel"} measured`);
      assert.equal(cell.state === "S1" ? parts.start : parts.resume, undefined, `${id}: only one of the two is shown`);
      assert.equal(topBand.y + topBand.h, panel.y, `${id}: the top band ends at the panel`);
    }
  });

  it("order the stage, published rows, mid window, upcoming rows and ground window down the page", () => {
    for (const [id, cell] of CELLS) {
      const s = cell.snapshot;
      const published = s.cards.filter((c) => c.kind !== "upcoming");
      const upcoming = s.cards.filter((c) => c.kind === "upcoming");
      assert.ok(published.length > 0 && upcoming.length > 0, id);
      const lastPublished = Math.max(...published.map((c) => c.rect.y + c.rect.h));
      assert.ok(s.windows.stage.y + s.windows.stage.h <= Math.min(...s.cards.map((c) => c.rect.y)), `${id}: stage above the cards`);
      assert.ok(lastPublished <= s.windows.mid.y, `${id}: mid window after the published cards`);
      assert.ok(s.windows.mid.y + s.windows.mid.h <= Math.min(...upcoming.map((c) => c.rect.y)), `${id}: mid window before the upcoming cards`);
      assert.ok(Math.max(...s.cards.map((c) => c.rect.y + c.rect.h)) <= s.windows.ground.y, `${id}: ground window after every card`);
    }
  });

  it("lay out two columns from 781 px wide and one column below", () => {
    for (const [id, cell] of CELLS) {
      const s = cell.snapshot;
      const columns = new Set(s.cards.map((c) => cardColumn(s, c)));
      if (cell.size.w >= 781) {
        assert.deepEqual([...columns].sort(), ["l", "r"], id);
        assert.equal(s.colGaps.length, s.rows.length, `${id}: one column gap per row`);
      } else {
        assert.deepEqual([...columns], ["full"], id);
        assert.equal(s.colGaps.length, 0, id);
      }
      assert.equal(s.rows.length, s.cards.length / columns.size, id);
    }
  });

  it("name the zone under each card, hit button, window and gutter", () => {
    for (const [id, cell] of CELLS) {
      const s = cell.snapshot;
      for (const c of s.cards) {
        const p = centre(c.rect);
        assert.equal(zoneAt(s, p.x, p.y), "card", `${id}: ${c.slug}`);
        assert.equal(cardAt(s, p.x, p.y)?.slug, c.slug, `${id}: ${c.slug}`);
      }
      for (const hit of [s.windows.stageHit, s.windows.midHit]) {
        const p = centre(hit);
        assert.equal(zoneAt(s, p.x, p.y), "ui", `${id}: hit button`);
      }
      const stage = s.windows.stage;
      assert.equal(zoneAt(s, stage.x + 4, stage.y + stage.h / 2), "stage", `${id}: stage edge`);
      const mid = s.windows.mid;
      assert.equal(zoneAt(s, mid.x + mid.w - 4, mid.y + 4), "mid", `${id}: mid corner`);
      if (s.gutters.left > 8) assert.equal(zoneAt(s, s.gutters.left / 2, s.rows[0].top + 10), "open", `${id}: left gutter`);
    }
  });

  it("carry the Thai title of every card", () => {
    for (const [id, cell] of CELLS) {
      for (const c of cell.snapshot.cards) assert.match(c.titleTh, /^[฀-๿ ]+$/, `${id}: ${c.slug}`);
    }
  });
});
