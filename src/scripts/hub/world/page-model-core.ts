// Pure page geometry for the hub (spec 2.3 and 2.10): composition mode, regions
// between cards, cover and hole tests, hit rects. page-model.ts measures the DOM
// into a PageMeasure; everything here works on that data alone.

import { pointInRect, rectDistance } from "./rect";
import type { CardInfo, HubMode, PageMeasure, PageSnapshot, Rect, Regions, Row, Zone } from "./types";

/** Smallest hit target, as in hub.css. */
const HIT_MIN = 44;
/** Cards whose tops differ by less than this share a grid row. */
const ROW_TOLERANCE = 8;
/** A card at least this share of the shell width spans the full row. */
const FULL_WIDTH_SHARE = 0.75;

/** Composition mode. `gutter` is the narrower side gutter beside the shell, in CSS px. */
export function classifyMode(w: number, h: number, gutter: number): HubMode {
  if (w > h && h <= 500) return "landscape-short";
  if (w <= 780) return "phone";
  if (gutter < 120) return "narrow";
  if (gutter < 260) return "desktop";
  return "wide";
}

/** The window box scaled by the theme's hit fractions, grown to at least 44x44 from its top-left. */
export function hitRect(windowRect: Rect, fractions: Rect): Rect {
  return {
    x: windowRect.x + fractions.x * windowRect.w,
    y: windowRect.y + fractions.y * windowRect.h,
    w: Math.max(HIT_MIN, fractions.w * windowRect.w),
    h: Math.max(HIT_MIN, fractions.h * windowRect.h),
  };
}

function cardRows(cards: readonly CardInfo[]): { row: Row; cards: CardInfo[] }[] {
  const sorted = [...cards].filter((c) => c.rect.w > 0 && c.rect.h > 0).sort((a, b) => a.rect.y - b.rect.y);
  const rows: { row: Row; cards: CardInfo[] }[] = [];
  for (const card of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(card.rect.y - last.row.top) < ROW_TOLERANCE) {
      last.cards.push(card);
      last.row.bottom = Math.max(last.row.bottom, card.rect.y + card.rect.h);
    } else {
      rows.push({ row: { top: card.rect.y, bottom: card.rect.y + card.rect.h }, cards: [card] });
    }
  }
  return rows;
}

/** Top band above the first block under the hero, card rows, bands between rows and gaps between columns. */
export function regions(m: PageMeasure): Regions {
  const grouped = cardRows(m.cards);
  const rows = grouped.map((g) => g.row);
  const firstBlock = [m.parts.resume, m.parts.start, m.windows.stage, grouped[0]?.cards[0]?.rect]
    .filter((r): r is Rect => r !== undefined && r.w > 0 && r.h > 0)
    .reduce((top, r) => Math.min(top, r.y), Infinity);
  const topBand: Rect = { x: 0, y: 0, w: m.viewport.w, h: Number.isFinite(firstBlock) ? Math.max(0, firstBlock) : m.viewport.h };

  const bands: Rect[] = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    const h = rows[i + 1].top - rows[i].bottom;
    if (h > 0) bands.push({ x: 0, y: rows[i].bottom, w: m.viewport.w, h });
  }

  const colGaps: Rect[] = [];
  for (const { row, cards } of grouped) {
    const byX = [...cards].sort((a, b) => a.rect.x - b.rect.x);
    for (let i = 0; i + 1 < byX.length; i++) {
      const left = byX[i].rect.x + byX[i].rect.w;
      const w = byX[i + 1].rect.x - left;
      if (w > 0) colGaps.push({ x: left, y: row.top, w, h: row.bottom - row.top });
    }
  }
  return { topBand, rows, bands, colGaps };
}

export function buildSnapshot(m: PageMeasure, version: number): PageSnapshot {
  const left = Math.max(0, m.shell.x);
  const right = Math.max(0, m.viewport.w - (m.shell.x + m.shell.w));
  const stageHit = hitRect(m.windows.stage, m.hitFractions.stage);
  const midHit = hitRect(m.windows.mid, m.hitFractions.mid);
  const hits = [
    m.windows.stage.w > 0 && m.windows.stage.h > 0 ? stageHit : null,
    m.windows.mid.w > 0 && m.windows.mid.h > 0 ? midHit : null,
  ].filter((r): r is Rect => r !== null);
  const { topBand, rows, bands, colGaps } = regions(m);
  return {
    version,
    mode: classifyMode(m.viewport.w, m.viewport.h, Math.min(left, right)),
    viewport: { ...m.viewport },
    shell: { ...m.shell },
    gutters: { left, right },
    topBand,
    holes: [...m.holes, ...hits],
    parts: { ...m.parts },
    windows: { ...m.windows, stageHit, midHit },
    cards: [...m.cards],
    rows,
    bands,
    colGaps,
    cover: [...m.cover],
    modalOpen: m.modalOpen,
  };
}

/** True when a sprite of radius `pad` centred at (x, yDoc) is fully hidden behind one opaque rect. */
export function isCovered(s: PageSnapshot, x: number, yDoc: number, pad = 0): boolean {
  for (const r of s.cover) {
    if (pointInRect(r, x, yDoc, -pad)) return true;
  }
  return false;
}

/** Distance to the nearest text or control rect; Infinity when there is none. */
export function holeDistance(s: PageSnapshot, x: number, yDoc: number): number {
  let best = Infinity;
  for (const r of s.holes) best = Math.min(best, rectDistance(x, yDoc, r));
  return best;
}

export function cardAt(s: PageSnapshot, x: number, yDoc: number): CardInfo | null {
  for (const card of s.cards) {
    if (pointInRect(card.rect, x, yDoc)) return card;
  }
  return null;
}

/** What a pointer at (x, yDoc) is over. Only open, stage, mid and ground may become scene taps. */
export function zoneAt(s: PageSnapshot, x: number, yDoc: number): Zone {
  if (s.modalOpen) return "modal";
  if (cardAt(s, x, yDoc)) return "card";
  for (const r of s.holes) if (pointInRect(r, x, yDoc)) return "ui";
  for (const r of s.cover) if (pointInRect(r, x, yDoc)) return "ui";
  if (pointInRect(s.windows.stage, x, yDoc) && s.windows.stage.w > 0) return "stage";
  if (pointInRect(s.windows.mid, x, yDoc) && s.windows.mid.w > 0) return "mid";
  if (pointInRect(s.windows.ground, x, yDoc) && s.windows.ground.w > 0) return "ground";
  return "open";
}

/** Document rect to viewport rect. */
export function toViewport(rect: Rect, scrollY: number): Rect {
  return { x: rect.x, y: rect.y - scrollY, w: rect.w, h: rect.h };
}

/** data-col for a card wrapper: "full" when it spans the row, else the half of the shell it sits in. */
export function cardColumn(s: PageSnapshot, card: CardInfo): "l" | "r" | "full" {
  if (card.rect.w >= s.shell.w * FULL_WIDTH_SHARE) return "full";
  return card.rect.x + card.rect.w / 2 < s.shell.x + s.shell.w / 2 ? "l" : "r";
}
