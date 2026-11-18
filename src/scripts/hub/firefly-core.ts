// Pure layout for the firefly hub scene (spec 3.5, 8.3 item 8): plane sizes, the lamphu
// crowns placed in the real gutters from the page model, the moon spot clear of the
// chrome, firefly counts and the order in which a chorus front crosses the cards.
// Imports cleanly in Node: no window or document access.

import type { CrownSpec } from "./firefly-tree";
import type { CardInfo, HubMode, PageSnapshot, Rect, WindowName } from "./world/types";

/** Overscan of the tree and sky planes: above the viewport, and at the sides for the pointer parallax. */
export const TOP = 64;
export const SIDE = 32;
/** Scroll parallax of the sky (stars and moon) and of the lamphu planes. */
export const SKY_PARALLAX = 0.15;
export const TREE_PARALLAX = 0.3;
/** Most tree fireflies the scene allocates. */
export const MAX_TREE_FIREFLIES = 420;
export const MAX_DRIFTERS = 48;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface MoonSpot {
  /** Sky-plane position at scroll 0 (viewport px); r is 0 when the top band has no room for it. */
  x: number;
  y: number;
  r: number;
}

export interface FireflyLayout {
  mode: HubMode;
  width: number;
  height: number;
  /** Size scale relative to a 900 px short side. */
  scale: number;
  coarse: boolean;
  gutterL: number;
  gutterR: number;
  /** Horizontal overscan of the planes (0 on coarse pointers: no pointer parallax there). */
  side: number;
  /** Document scroll range. */
  scrollMax: number;
  /** Sky plane height (from -TOP), covering the scroll travel at SKY_PARALLAX. */
  skyH: number;
  /** Tree plane bottom (plane y), covering the scroll travel at TREE_PARALLAX. */
  treeBottom: number;
  /** Plane y where the canopy canvas ends and the column canvases take over. */
  canopyCut: number;
  /** Where roots meet the water (plane y). */
  waterY: number;
  moon: MoonSpot;
  trees: CrownSpec[];
  /** Tree fireflies and band drifters. */
  counts: { tree: number; drift: number };
}

/** Firefly count by viewport area; coarse pointers (phones, tablets) get fewer. */
export function fireflyCount(width: number, height: number, coarse: boolean): number {
  const base = 60 + (Math.max(0, width) * Math.max(0, height)) / 6500;
  return Math.round(clamp(base * (coarse ? 0.85 : 1), 50, 320));
}

/** How far the document scrolls: the ground window reaches the bottom of the page. */
export function scrollRange(page: PageSnapshot): number {
  const g = page.windows.ground;
  const bottom = Math.max(g.y + g.h, page.shell.y + page.shell.h);
  return Math.max(0, bottom - page.viewport.h);
}

const roundUp = (v: number, step: number) => Math.ceil(v / step) * step;

/** Clearance of the moon from text (title, kicker, subtitle, side note) and from opaque controls (chip, picker). */
export const moonClearance = (r: number) => ({ text: r * 2.2 + 6, control: r + 4 });

const sameRect = (a: Rect | undefined, b: Rect) => !!a && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.w - b.w) < 1 && Math.abs(a.h - b.h) < 1;

/** Whether a hole is an opaque control (chip or picker button) rather than text. */
export const isControlHole = (page: PageSnapshot, h: Rect) => sameRect(page.parts.chip, h) || sameRect(page.parts.picker, h);

/**
 * The moon: a spot in the top band that keeps clear of the title, kicker, side note, chip
 * and picker, nearest a preferred position for the mode (spec 3.5 composition): high
 * above the hero on wide screens, top left of centre in short landscape, above the chip
 * on phones.
 */
export function moonSpot(page: PageSnapshot, width: number, height: number): MoonSpot {
  const mode = page.mode;
  const r = mode === "phone" ? 7 : mode === "landscape-short" ? clamp(height * 0.03, 8, 12) : clamp(height * 0.018, 10, 22);
  const pref =
    mode === "phone"
      ? { x: width * 0.5, y: r + 2 }
      : mode === "landscape-short"
        ? { x: width * 0.42, y: height * 0.1 }
        : { x: width * 0.6, y: r + 14 };
  const clear = moonClearance(r);
  const band = Math.max(page.topBand.h, r * 4 + 12);
  let best: MoonSpot | null = null;
  let bestScore = Infinity;
  const step = Math.max(4, Math.round(width / 120));
  for (let y = r + 2; y <= Math.min(band - r, height * 0.4); y += 2) {
    for (let x = width * 0.12; x <= width * 0.88; x += step) {
      let ok = true;
      for (const h of page.holes) {
        if (rectDistance(h, x, y) < (isControlHole(page, h) ? clear.control : clear.text)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const score = Math.hypot(x - pref.x, (y - pref.y) * 1.6);
      if (score < bestScore) {
        bestScore = score;
        best = { x, y, r };
      }
    }
  }
  // No clear spot in a crowded top band (667x375): the moon stays out of this sky.
  return best ?? { x: pref.x, y: pref.y, r: 0 };
}

function rectDistance(r: Rect, x: number, y: number): number {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

interface Side {
  dir: 1 | -1;
  gutter: number;
  /** Viewport x of the outer edge (0 or width). */
  edge: number;
}

/** Mirrors an x offset from a side's outer edge into viewport x. */
const sx = (side: Side, offset: number) => side.edge + side.dir * offset;

function crown(
  side: Side,
  a: number,
  b: number,
  top: number,
  bottom: number,
  extra: Omit<CrownSpec, "x0" | "x1" | "top" | "bottom">,
): CrownSpec {
  const p = sx(side, a);
  const q = sx(side, b);
  return { x0: Math.min(p, q), x1: Math.max(p, q), top, bottom, ...extra };
}

/** Crowns for one gutter: the main tree with its long trunk, the overhang across the top band, and sprays down the gutter. */
function sideCrowns(L: Pick<FireflyLayout, "mode" | "width" | "height" | "scale" | "treeBottom" | "waterY" | "canopyCut">, side: Side, seed: number): CrownSpec[] {
  const { mode, width: W, height: H, scale: s } = L;
  const g = side.gutter;
  const out: CrownSpec[] = [];
  const left = side.dir === 1;
  const rootY = L.waterY;
  let trunkX: number;
  if (mode === "wide") {
    trunkX = g * 0.42;
    out.push(
      crown(side, trunkX - g * 0.58, Math.min(g + 70 * s, trunkX + g * 0.62), -H * 0.07, H * 0.5, {
        belly: 0.62, baseX: sx(side, trunkX), baseY: rootY, forkX: sx(side, trunkX + g * 0.05), forkY: H * 0.44,
        near: true, rooted: true, seed: seed + 1, fireflyShare: 0.3, sprays: 11,
      }),
    );
    out.push(
      crown(side, g * 0.55, g + 0.16 * (W - 2 * g), -H * 0.1, H * 0.12, {
        belly: 0.55, baseX: sx(side, trunkX + g * 0.12), baseY: H * 0.3, forkX: sx(side, g * 0.7), forkY: H * 0.06,
        near: true, rooted: false, seed: seed + 2, fireflyShare: 0.12, sprays: 5,
      }),
    );
    // A smaller tree further back, standing on the far bank of the gutter.
    out.push(
      crown(side, g * 0.62, g * 0.98, H * 0.52, H * 0.86, {
        belly: 0.66, baseX: sx(side, g * 0.8), baseY: rootY, forkX: sx(side, g * 0.8), forkY: H * 0.8,
        near: false, rooted: true, seed: seed + 3, fireflyShare: 0.08, sprays: 3,
      }),
    );
  } else if (mode === "desktop" || mode === "narrow") {
    trunkX = mode === "desktop" ? g * 0.42 : Math.max(6, g * 0.3);
    const reach = mode === "desktop" ? g + 40 * s : g + 50 * s;
    out.push(
      crown(side, -150 * s - g * 0.35, reach, -H * 0.08, H * 0.34, {
        belly: 0.6, baseX: sx(side, trunkX), baseY: rootY, forkX: sx(side, trunkX + g * 0.12), forkY: H * 0.3,
        near: true, rooted: true, seed: seed + 1, fireflyShare: 0.3, sprays: 9,
      }),
    );
    out.push(
      crown(side, g * 0.3, Math.max(g + 120, W * (left ? 0.4 : 0.3)), -H * 0.13, H * (left ? 0.07 : 0.05), {
        belly: 0.55, baseX: sx(side, trunkX + g * 0.2), baseY: H * 0.24, forkX: sx(side, g * 0.75), forkY: H * 0.02,
        near: true, rooted: false, seed: seed + 2, fireflyShare: 0.14, sprays: 6,
      }),
    );
  } else if (mode === "landscape-short") {
    trunkX = Math.max(4, g * 0.25);
    out.push(
      crown(side, -0.2 * W, left ? 0.24 * W : 0.3 * W, -H * 0.32, H * (left ? 0.2 : 0.24), {
        belly: 0.6, baseX: sx(side, trunkX), baseY: rootY, forkX: sx(side, trunkX + 10), forkY: H * 0.16,
        near: true, rooted: true, seed: seed + 1, fireflyShare: 0.32, sprays: 6,
      }),
    );
  } else {
    // Phone: the canopy edge in the top band, trunks as slivers at the screen edges.
    trunkX = -3;
    out.push(
      crown(side, -0.55 * W, left ? 0.34 * W : 0.24 * W, -H * 0.17, H * (left ? 0.095 : 0.075), {
        belly: 0.58, baseX: sx(side, trunkX), baseY: rootY, forkX: sx(side, 4), forkY: H * 0.06,
        near: true, rooted: true, seed: seed + 1, fireflyShare: 0.3, sprays: 5,
      }),
    );
  }

  // Sprays down the gutter, so fireflies keep the reader company beside the cards.
  const reach = mode === "wide" ? g * 0.78 : mode === "phone" || mode === "landscape-short" ? g + 6 : g + 8;
  const back = mode === "wide" ? g * 0.06 : mode === "desktop" ? 70 * s : 90 * s;
  const step = H * (mode === "phone" ? 0.5 : 0.62);
  const sprayH = H * (mode === "phone" ? 0.16 : mode === "landscape-short" ? 0.34 : 0.24);
  let y = Math.max(L.canopyCut + sprayH * 0.15, H * 0.5) + (left ? 0 : step * 0.5);
  let k = 0;
  while (y + sprayH < L.treeBottom - H * 0.12) {
    out.push(
      crown(side, -back, reach, y, y + sprayH, {
        belly: 0.58, baseX: sx(side, trunkX), baseY: y + sprayH * 0.95, forkX: sx(side, Math.min(reach * 0.45, trunkX + 30)), forkY: y + sprayH * 0.75,
        near: true, rooted: false, seed: seed + 10 + k, fireflyShare: 0.1, sprays: mode === "wide" ? 5 : 3,
      }),
    );
    y += step;
    k++;
  }
  return out;
}

export function computeLayout(page: PageSnapshot, width: number, height: number): FireflyLayout {
  const W = width;
  const H = height;
  const mode = page.mode;
  const coarse = page.viewport.coarse;
  const scale = clamp(Math.min(W, H) / 900, 0.5, 1.25);
  const scrollMax = scrollRange(page);
  const treeTravel = roundUp(scrollMax * TREE_PARALLAX, 64);
  const skyTravel = roundUp(scrollMax * SKY_PARALLAX, 64);
  const treeBottom = H + treeTravel + 48;
  const canopyCut = Math.round(H * (mode === "phone" ? 0.16 : mode === "landscape-short" ? 0.3 : mode === "wide" ? 0.58 : 0.4));
  const base = {
    mode,
    width: W,
    height: H,
    scale,
    coarse,
    gutterL: Math.max(0, page.gutters.left),
    gutterR: Math.max(0, page.gutters.right),
    side: coarse ? 0 : SIDE,
    scrollMax,
    skyH: H + skyTravel + TOP + 16,
    treeBottom,
    canopyCut,
    waterY: treeBottom - 24,
  };
  const trees = [
    ...sideCrowns(base, { dir: 1, gutter: base.gutterL, edge: 0 }, 11),
    ...sideCrowns(base, { dir: -1, gutter: base.gutterR, edge: W }, 41),
  ];
  const visible = H + Math.min(treeTravel, H);
  const tree = Math.min(MAX_TREE_FIREFLIES, Math.round(fireflyCount(W, H, coarse) * (visible / H) * 0.82));
  const drift = Math.min(MAX_DRIFTERS, Math.round(fireflyCount(W, H, coarse) * 0.12));
  return { ...base, moon: moonSpot(page, W, H), trees, counts: { tree, drift } };
}

/* ------------------------------------------------------------------ windows */

export interface WindowBox {
  /** Canvas size (full-bleed: the viewport width, the window height). */
  w: number;
  h: number;
  /** The shell-width window box inside the canvas (window-local px). */
  boxX: number;
  boxW: number;
}

/** The full-bleed canvas of a window and where its shell-width box sits in it. */
export function windowBox(page: PageSnapshot, name: WindowName): WindowBox {
  const r = page.windows[name];
  const w = page.viewport.w;
  const canvasX = r.x + r.w / 2 - w / 2;
  return { w, h: r.h, boxX: r.x - canvasX, boxW: r.w };
}

/* ------------------------------------------------------------------ chorus front */

/** Direction of the chorus wave: down and to the right, so it reads across the card grid. */
export const WAVE_AXIS = { ax: 0.86, ay: 0.51 } as const;

/** Where a front along WAVE_AXIS sits when it reaches a viewport point. */
export const frontCoord = (x: number, y: number) => WAVE_AXIS.ax * x + WAVE_AXIS.ay * y;

/** The front range that covers a viewport, with a margin either side. */
export function frontSpan(width: number, height: number, margin = 60): { from: number; to: number } {
  return { from: -margin, to: frontCoord(width, height) + margin };
}

/**
 * The visible cards in the order a chorus front reaches them, with the front coordinate
 * of each card's centre. Cards outside the viewport are left out.
 */
export function crossingOrder(cards: readonly Pick<CardInfo, "slug" | "rect">[], scrollY: number, viewH: number): { slug: string; u: number }[] {
  return cards
    .filter((c) => c.rect.y - scrollY < viewH && c.rect.y + c.rect.h - scrollY > 0)
    .map((c) => ({ slug: c.slug, u: frontCoord(c.rect.x + c.rect.w / 2, c.rect.y - scrollY + c.rect.h / 2) }))
    .sort((a, b) => a.u - b.u);
}
