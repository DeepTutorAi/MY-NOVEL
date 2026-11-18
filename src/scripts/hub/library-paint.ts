// Painter for the library theme's gutter bookcases (spec 3.1 layer 4). It draws one
// period of a strip laid out by library-core into a tile: the set-back stack (on a deep
// gutter) and then the near case, one bay level per staged step, each followed by its
// frame (uprights, galleries, rails, sconces, ladder), then the light (haze on the stack,
// candle glow, vignette). A static strip canvas is filled from the tile so the plane wraps
// at the period without a seam. Every surface is lit by the same light function as the
// books (the cell's key plus sconce falloff) and graded, so the wall reads as pools of
// candlelight and moonlit bays in a dark hall.

import { createRng } from "../_shared/scene-runtime";
import {
  BACK_PHASE,
  BACK_VALUE,
  BALUSTRADE,
  BOARD,
  END_PANEL,
  GALLERY,
  GLOW_POOL,
  LEVELS,
  LIGHT,
  OBJECT_SIZE,
  PALETTE,
  RAIL_Y,
  RUNES,
  SHELF_PERIOD,
  footprint,
  lightAt,
  litColor,
  mixRgb,
  periodCopies,
  spineStops,
  tone,
  wallLight,
} from "./library-core";
import type { Bay, Cell, Compartment, FamilyId, Light, Rgb, Sconce, ShelfBook, ShelfObject, ShelfStack, ShelfStrip } from "./library-core";
import { paintDither } from "./scene-paint";
import { lerp } from "./world/geom";

type G = CanvasRenderingContext2D;
type Matrix = readonly [number, number, number, number, number, number];

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const rgb = (c: Rgb, k = 1): string => `rgb(${clamp255(c[0] * k)},${clamp255(c[1] * k)},${clamp255(c[2] * k)})`;
const rgba = (c: Rgb, a: number, k = 1): string =>
  `rgba(${clamp255(c[0] * k)},${clamp255(c[1] * k)},${clamp255(c[2] * k)},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

const WOOD: Rgb = [118, 80, 58];
const LADDER_WOOD: Rgb = [154, 106, 68];
const BACK: Rgb = [70, 52, 50];
const BRASS: Rgb = [232, 184, 104];
const GLASS: Rgb = [196, 210, 240];
const SAND: Rgb = [236, 178, 104];
const WAX: Rgb = [240, 226, 200];
const OCEAN: Rgb = [52, 104, 120];
const LAND: Rgb = [170, 132, 78];
const INK: Rgb = [84, 58, 38];
const MARBLE: Rgb = [206, 200, 190];
const PARCHMENT: Rgb = [214, 194, 152];
const RIBBON: Rgb = [128, 36, 34];
const INK_GLASS: Rgb = [36, 42, 60];
const QUILL: Rgb = [228, 220, 202];
/** Shadows darken toward black, which keeps every family's hue (a blue-black shadow turned plum violet). */
const SHADOW = "0,0,0";

/** A surface colour: the albedo under `light`, shaded by k and graded. */
const lit = (albedo: Rgb, light: Light, k = 1, family: FamilyId | null = null): string => rgb(tone(litColor(albedo, light), family, light, k));

/** Gold leaf: lit like everything else, then pushed toward the highlight where candlelight strikes it. */
function giltOf(light: Light): Rgb {
  const raw = litColor(PALETTE.gilt, light);
  return mixRgb(raw, PALETTE.giltHi, Math.min(0.75, Math.max(0, light.warm - 0.25) * 0.9));
}

/** Where the soft highlight of a spine sits: a little toward the screen edge the moonlight comes from. */
const highlightAt = (k: ShelfStrip): number => (k.side === "left" ? 0.42 : 0.58);

/** The cool rim from above: one crisp line of moonlight blue, strong in moonlit bays. */
function moonRim(g: G, x: number, y: number, w: number, alpha: number): void {
  g.fillStyle = rgba(PALETTE.moonRim, alpha);
  g.fillRect(x, y, w, 1);
}

/* ------------------------------------------------------------------ books */

/** Moves the origin to a book's foot (rotated for a lean) and returns the x its spine starts at. */
function bookFrame(g: G, b: ShelfBook, floor: number): number {
  if (b.lean < 0) {
    g.translate(b.x + b.h * Math.sin(-b.lean), floor);
    g.rotate(b.lean);
    return 0;
  }
  if (b.lean > 0) {
    g.translate(b.x + b.w * Math.cos(b.lean), floor);
    g.rotate(b.lean);
    return -b.w;
  }
  g.translate(b.x, floor);
  return 0;
}

function giltLine(g: G, x0: number, w: number, y: number, gold: Rgb, alpha = 1): void {
  g.fillStyle = rgba(gold, 0.92 * alpha);
  g.fillRect(x0 + 0.6, y, w - 1.2, 0.9);
}

function paintRune(g: G, cx: number, cy: number, size: number, rune: number, gold: Rgb): void {
  g.strokeStyle = rgb(gold, 1.1);
  g.lineWidth = Math.max(0.8, size * 0.16);
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const line of RUNES[rune % RUNES.length]) {
    g.beginPath();
    line.forEach(([u, v], i) => {
      const px = cx + (u - 0.5) * size;
      const py = cy + (v - 1) * size;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.stroke();
  }
}

/** A spine: a flat leather face rolling off at both joints, a soft highlight, endband, bands or label. */
function paintBook(g: G, k: ShelfStrip, bay: Bay, cell: Cell, floor: number, b: ShelfBook): void {
  const light = lightAt(k, cell, b.x + footprint(b) / 2, floor - b.h * 0.55, bay.index);
  const raw = litColor(b.color, light);
  const family = b.card === null ? b.family : null;
  const t = (m: number) => rgb(tone(raw, family, light, m));
  const gold = giltOf(light);
  const { w, h } = b;

  g.save();
  const x0 = bookFrame(g, b, floor);
  const body = g.createLinearGradient(x0, 0, x0 + w, 0);
  for (const [at, shade] of spineStops(w, highlightAt(k))) body.addColorStop(at, t(shade));
  g.fillStyle = body;
  g.fillRect(x0, -h, w, h);

  // Endband under the flat headcap, and the foot darkening into the board's shadow.
  g.fillStyle = `rgba(${SHADOW},0.5)`;
  g.fillRect(x0, -h + 1.5, w, 1);
  const foot = g.createLinearGradient(0, -h * 0.14, 0, 0);
  foot.addColorStop(0, `rgba(${SHADOW},0)`);
  foot.addColorStop(1, `rgba(${SHADOW},0.32)`);
  g.fillStyle = foot;
  g.fillRect(x0, -h * 0.14, w, h * 0.14);

  // Joint grooves where the boards hinge, on wide spines.
  if (w > 18) {
    g.fillStyle = `rgba(${SHADOW},0.38)`;
    g.fillRect(x0 + 2, -h + 2.5, 0.8, h - 2.5);
    g.fillRect(x0 + w - 2.8, -h + 2.5, 0.8, h - 2.5);
  }

  if (b.family === "vellum" && b.card === null && w >= 7) paintVellumTitle(g, b, floor, x0, light, gold);

  if (b.ribs > 0) {
    // Raised bands: a lit ridge over its shadow.
    const giltRibs = b.gilt === "ribs";
    for (let i = 0; i < b.ribs; i++) {
      const y = -h * (0.16 + (i * 0.66) / (b.ribs - 1));
      g.fillStyle = giltRibs ? rgba(gold, 0.9) : t(1.22);
      g.fillRect(x0 + 0.5, y, w - 1, 1);
      g.fillStyle = `rgba(${SHADOW},0.55)`;
      g.fillRect(x0 + 0.5, y + 1, w - 1, 1);
    }
  }

  if (b.gilt === "bands") {
    giltLine(g, x0, w, -h * 0.94, gold);
    giltLine(g, x0, w, -h * 0.9, gold, 0.7);
    giltLine(g, x0, w, -h * 0.1, gold, 0.7);
    giltLine(g, x0, w, -h * 0.065, gold);
    if (b.card === null && w >= 10) {
      g.fillStyle = rgba(gold, 0.88);
      const cy = -h * 0.52;
      g.beginPath();
      g.moveTo(x0 + w / 2, cy - 3);
      g.lineTo(x0 + w / 2 + 2, cy);
      g.lineTo(x0 + w / 2, cy + 3);
      g.lineTo(x0 + w / 2 - 2, cy);
      g.closePath();
      g.fill();
    }
  } else if (b.gilt === "label" && b.label) {
    const top = -h * 0.8;
    const lh = Math.max(5, h * 0.13);
    g.fillStyle = lit(b.label, light);
    g.fillRect(x0 + 0.8, top, w - 1.6, lh);
    giltLine(g, x0, w, top - 1, gold);
    giltLine(g, x0, w, top + lh, gold);
    g.fillStyle = rgba(gold, 0.62);
    for (let y = top + 2; y < top + lh - 1.5; y += 2) g.fillRect(x0 + w * 0.3, y, w * 0.4, 0.7);
  }

  if (b.card !== null) paintRune(g, x0 + w / 2, -h * 0.5, Math.min(w * 0.62, 7), b.rune, gold);
  g.restore();
}

/**
 * A vellum spine's hand-lettered title, varied per book: none on about 30 %, a small dark title
 * panel or a short gilt rule on about 15 %, else 1-4 brown ink lines of 40-90 % of the width set
 * 15-45 % down the spine, so neighbouring ivory books never read as one stamp.
 */
function paintVellumTitle(g: G, b: ShelfBook, floor: number, x0: number, light: Light, gold: Rgb): void {
  const rng = createRng((Math.round(b.x * 8) * 73856093) ^ (Math.round(floor) * 19349663) ^ (b.h * 83492791));
  const r = rng();
  if (r < 0.3) return;
  const { w, h } = b;
  const top = -h * (0.85 - rng() * 0.3);
  if (r < 0.45) {
    if (rng() < 0.5) {
      g.fillStyle = lit([46, 30, 24], light);
      g.fillRect(x0 + 1, top, w - 2, Math.max(5, h * 0.1));
    } else giltLine(g, x0 + w * 0.2, w * 0.6, top, gold);
    return;
  }
  g.fillStyle = rgba(tone(litColor(INK, light), null, light), 0.6);
  const lines = 1 + Math.floor(rng() * 4);
  for (let i = 0; i < lines; i++) {
    const len = w * (0.4 + rng() * 0.5);
    g.fillRect(x0 + (w - len) / 2, top + i * Math.max(2.2, h * 0.045), len, 0.9);
  }
}

function paintBookRim(g: G, floor: number, b: ShelfBook, alpha: number): void {
  g.save();
  const x0 = bookFrame(g, b, floor);
  moonRim(g, x0, -b.h, b.w, alpha);
  g.restore();
}

function paintStack(g: G, k: ShelfStrip, bay: Bay, cell: Cell, floor: number, s: ShelfStack): void {
  let y = floor;
  s.books.forEach((b, i) => {
    const x = s.x + b.dx;
    const light = lightAt(k, cell, x + b.len / 2, y - b.t / 2, bay.index);
    const raw = litColor(b.color, light);
    const t = (m: number) => rgb(tone(raw, b.family, light, m));
    const body = g.createLinearGradient(0, y - b.t, 0, y);
    body.addColorStop(0, t(1.06));
    body.addColorStop(0.35, t(1));
    body.addColorStop(1, t(0.5));
    g.fillStyle = body;
    g.beginPath();
    g.roundRect(x, y - b.t, b.len, b.t, Math.min(1.2, b.t / 3));
    g.fill();
    // Page block at the near end, the side the moon falls on.
    g.fillStyle = `rgba(${SHADOW},0.35)`;
    g.fillRect(x + (k.side === "left" ? b.len - 1.2 : 0.4), y - b.t + 1, 0.8, b.t - 2);
    if (b.gilt) {
      g.fillStyle = rgba(giltOf(light), 0.88);
      g.fillRect(x + b.len * 0.08, y - b.t + 1, 0.9, b.t - 2);
      g.fillRect(x + b.len * 0.92, y - b.t + 1, 0.9, b.t - 2);
      g.fillRect(x + b.len * 0.42, y - b.t / 2 - 0.4, b.len * 0.16, 0.8);
    }
    y -= b.t;
    // The top book carries the full rim; the edges below catch a little of it.
    moonRim(g, x + 0.5, y, b.len - 1, LIGHT[cell.key].rim * (i === s.books.length - 1 ? 1 : 0.35));
  });
}

/* ------------------------------------------------------------------ objects */

/** Hourglass, base 14 x 26: brass frame, glass bulbs, sand split by `variant`. */
function paintHourglass(g: G, light: Light, o: ShelfObject): void {
  const w = 14;
  const h = 26;
  const mid = -h / 2;
  const brass = (m: number) => lit(BRASS, light, m);
  g.fillStyle = brass(0.8);
  g.fillRect(1.5, -h + 2, 1.2, h - 4);
  g.fillRect(w - 2.7, -h + 2, 1.2, h - 4);
  const bulb = (y0: number, y1: number) => {
    g.beginPath();
    g.moveTo(3, y0);
    g.bezierCurveTo(3, y0 + (y1 - y0) * 0.55, w / 2 - 0.8, y1 - 1, w / 2 - 0.6, y1);
    g.lineTo(w / 2 + 0.6, y1);
    g.bezierCurveTo(w / 2 + 0.8, y1 - 1, w - 3, y0 + (y1 - y0) * 0.55, w - 3, y0);
    g.closePath();
  };
  g.fillStyle = rgba(GLASS, 0.08);
  g.strokeStyle = rgba(GLASS, 0.14 + light.rim * 0.3 + light.warm * 0.1);
  g.lineWidth = 0.7;
  bulb(-h + 3, mid);
  g.fill();
  g.stroke();
  g.save();
  g.scale(1, -1);
  g.translate(0, h);
  bulb(-h + 3, mid);
  g.restore();
  g.fill();
  g.stroke();
  const below = 0.15 + o.variant * 0.7;
  g.fillStyle = lit(SAND, light);
  g.beginPath();
  g.moveTo(3.6, -3);
  g.quadraticCurveTo(w / 2, -3 - h * 0.34 * below, w - 3.6, -3);
  g.closePath();
  g.fill();
  const above = (1 - below) * (h / 2 - 5);
  g.beginPath();
  g.moveTo(w / 2 - 0.6 - above * 0.4, mid - 1 - above);
  g.lineTo(w / 2 + 0.6 + above * 0.4, mid - 1 - above);
  g.lineTo(w / 2, mid - 0.4);
  g.closePath();
  g.fill();
  g.fillRect(w / 2 - 0.3, mid, 0.6, h / 2 - 4);
  g.fillStyle = rgba(PALETTE.moonCore, 0.1 + light.rim * 0.5);
  g.fillRect(4, -h + 5, 0.8, h * 0.22);
  for (const y of [-h, -2.6]) {
    const plate = g.createLinearGradient(0, y, 0, y + 2.6);
    plate.addColorStop(0, brass(1.2));
    plate.addColorStop(1, brass(0.5));
    g.fillStyle = plate;
    g.fillRect(0, y, w, 2.6);
  }
}

/** Small globe, base 24 x 32: stand, sphere with land turned by `variant`, axis tilted by `tilt`. */
function paintGlobe(g: G, light: Light, o: ShelfObject, moonLeft: boolean): void {
  const w = 24;
  const h = 32;
  const cx = w / 2;
  const r = w * 0.4;
  const cy = -h + r + 1;
  g.fillStyle = lit(BRASS, light, 0.75);
  g.beginPath();
  g.ellipse(cx, -1.4, w * 0.34, 1.6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(cx - 0.8, cy + r, 1.6, -cy - r - 1.4);
  const lx = moonLeft ? -0.4 : 0.4;
  const sea = litColor(OCEAN, light);
  const sphere = g.createRadialGradient(cx + lx * r, cy - r * 0.4, r * 0.1, cx, cy, r);
  sphere.addColorStop(0, rgb(tone(sea, null, light, 1.5)));
  sphere.addColorStop(0.55, rgb(tone(sea, null, light)));
  sphere.addColorStop(1, rgb(tone(sea, null, light, 0.35)));
  g.fillStyle = sphere;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.clip();
  g.translate(cx, cy);
  g.rotate(o.tilt);
  g.fillStyle = lit(LAND, light, 0.9);
  const turn = (o.variant - 0.5) * 1.2;
  for (const [dx, dy, rx, ry] of [
    [-0.3, -0.25, 0.32, 0.22],
    [0.25, 0.15, 0.28, 0.36],
    [-0.15, 0.5, 0.2, 0.12],
  ] as const) {
    g.beginPath();
    g.ellipse((dx + turn) * r, dy * r, rx * r, ry * r, 0.4, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = rgba(giltOf(light), 0.5);
  g.lineWidth = 0.5;
  g.beginPath();
  g.ellipse(0, 0, r * 0.45, r, 0, 0, Math.PI * 2);
  g.moveTo(-r, 0);
  g.lineTo(r, 0);
  g.stroke();
  g.restore();
  g.save();
  g.translate(cx, cy);
  g.rotate(o.tilt);
  g.strokeStyle = lit(BRASS, light, 1.1);
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(0, 0, r + 1.8, Math.PI * 0.62, Math.PI * 2.38);
  g.stroke();
  g.restore();
  g.fillStyle = rgba(PALETTE.moonCore, 0.12 + light.rim * 0.4);
  g.beginPath();
  g.arc(cx + lx * r * 0.9, cy - r * 0.45, r * 0.18, 0, Math.PI * 2);
  g.fill();
}

/** Bundle of two or three parchment scrolls, base 30 x 17, tied with a red ribbon. */
function paintScrolls(g: G, light: Light, o: ShelfObject, moonLeft: boolean): void {
  const r = 3.2;
  const count = o.variant < 0.5 ? 2 : 3;
  const rolls = [
    { x: 1, y: -r, len: 27 },
    { x: 3.5, y: -r * 2.55 - 0.2, len: 25 },
    { x: 0, y: -r * 4.1 - 0.4, len: 23 },
  ].slice(0, count);
  for (const roll of rolls) {
    const body = g.createLinearGradient(0, roll.y - r, 0, roll.y + r);
    body.addColorStop(0, lit(PARCHMENT, light, 1.05, "vellum"));
    body.addColorStop(0.45, lit(PARCHMENT, light, 0.9, "vellum"));
    body.addColorStop(1, lit(PARCHMENT, light, 0.45, "vellum"));
    g.fillStyle = body;
    g.fillRect(roll.x, roll.y - r, roll.len, r * 2);
    const endX = moonLeft ? roll.x : roll.x + roll.len;
    g.fillStyle = lit(PARCHMENT, light, 1.1, "vellum");
    g.beginPath();
    g.ellipse(endX, roll.y, r * 0.42, r, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = `rgba(${SHADOW},0.45)`;
    g.lineWidth = 0.6;
    g.beginPath();
    g.ellipse(endX, roll.y, r * 0.2, r * 0.55, 0, 0, Math.PI * 2);
    g.stroke();
    moonRim(g, roll.x + 1, roll.y - r, roll.len - 2, light.rim * 0.8);
  }
  const top = rolls[rolls.length - 1].y - r;
  g.fillStyle = lit(RIBBON, light);
  g.fillRect(13, top, 2.2, -top);
  g.fillStyle = `rgba(${SHADOW},0.4)`;
  g.fillRect(15.2, top, 0.6, -top);
}

/** Small marble bust on a plinth, base 17 x 30, gazing one way. */
function paintBust(g: G, light: Light): void {
  const marble = (m: number) => lit(MARBLE, light, m);
  g.fillStyle = lit(WOOD, light, 0.6);
  g.fillRect(2, -5, 13, 5);
  g.fillStyle = lit(WOOD, light, 0.95);
  g.fillRect(1.4, -5.6, 14.2, 1);
  const chest = g.createLinearGradient(1, 0, 16, 0);
  chest.addColorStop(0, marble(0.95));
  chest.addColorStop(0.5, marble(0.8));
  chest.addColorStop(1, marble(0.42));
  g.fillStyle = chest;
  g.beginPath();
  g.moveTo(2, -5.6);
  g.bezierCurveTo(1.6, -10, 4, -13, 7, -13.4);
  g.lineTo(10, -13.4);
  g.bezierCurveTo(13, -13, 15.4, -10, 15, -5.6);
  g.closePath();
  g.fill();
  g.fillStyle = marble(0.7);
  g.fillRect(7.2, -17, 2.8, 4);
  const head = g.createRadialGradient(7.4, -23.5, 0.5, 8.6, -21.5, 5.4);
  head.addColorStop(0, marble(1.08));
  head.addColorStop(1, marble(0.5));
  g.fillStyle = head;
  g.beginPath();
  g.ellipse(8.6, -21.5, 3.9, 5, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(12.3, -22.4);
  g.lineTo(13.4, -20.6);
  g.lineTo(12.2, -20.2);
  g.closePath();
  g.fill();
  g.strokeStyle = rgba(PALETTE.moonCore, light.rim);
  g.lineWidth = 0.9;
  g.beginPath();
  g.arc(8.6, -21.5, 4.4, Math.PI * 1.1, Math.PI * 1.75);
  g.stroke();
}

/** Inkwell with a quill, base 14 x 27. */
function paintInkwell(g: G, light: Light): void {
  g.strokeStyle = lit(QUILL, light, 0.8);
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(6.4, -7);
  g.quadraticCurveTo(8.5, -16, 12.6, -26.5);
  g.stroke();
  const vane = g.createLinearGradient(7, 0, 13, 0);
  vane.addColorStop(0, lit(QUILL, light, 1.02));
  vane.addColorStop(1, lit(QUILL, light, 0.55));
  g.fillStyle = vane;
  g.beginPath();
  g.moveTo(8.4, -13.5);
  g.quadraticCurveTo(7.6, -21, 12.6, -26.5);
  g.quadraticCurveTo(13.4, -19, 9.2, -13);
  g.closePath();
  g.fill();
  const pot = g.createLinearGradient(1.5, 0, 12.5, 0);
  pot.addColorStop(0, lit(INK_GLASS, light, 1.5));
  pot.addColorStop(0.35, lit(INK_GLASS, light, 1));
  pot.addColorStop(1, lit(INK_GLASS, light, 0.45));
  g.fillStyle = pot;
  g.beginPath();
  g.roundRect(1.5, -7.5, 11, 7.5, 2.4);
  g.fill();
  g.fillStyle = lit(BRASS, light, 0.95);
  g.fillRect(4.2, -9, 5.6, 1.6);
  g.fillStyle = rgba(PALETTE.moonCore, 0.12 + light.rim * 0.6);
  g.fillRect(3.2, -6.4, 0.8, 4);
}

function paintObject(g: G, k: ShelfStrip, bay: Bay, cell: Cell, floor: number, o: ShelfObject): void {
  const light = lightAt(k, cell, o.x + o.w / 2, floor - o.h / 2, bay.index);
  const moonLeft = k.side === "left";
  const base = OBJECT_SIZE[o.kind];
  g.save();
  g.translate(o.flip ? o.x + base.w * o.scale : o.x, floor);
  g.scale(o.flip ? -o.scale : o.scale, o.scale);
  const facingLeft = moonLeft !== o.flip;
  if (o.kind === "hourglass") paintHourglass(g, light, o);
  else if (o.kind === "globe") paintGlobe(g, light, o, facingLeft);
  else if (o.kind === "scrolls") paintScrolls(g, light, o, facingLeft);
  else if (o.kind === "bust") paintBust(g, light);
  else paintInkwell(g, light);
  g.restore();
}

/* ------------------------------------------------------------------ cells */

function paintCompartment(g: G, k: ShelfStrip, bay: Bay, cell: Cell, c: Compartment, underSlab: boolean): void {
  const w = bay.x1 - bay.x0;
  const mid = lightAt(k, cell, (bay.x0 + bay.x1) / 2, (c.top + c.floor) / 2, bay.index);
  const back = litColor(BACK, mid);
  const fill = g.createLinearGradient(0, c.top, 0, c.floor);
  fill.addColorStop(0, rgb(tone(back, null, mid, 0.3)));
  fill.addColorStop(0.5, rgb(tone(back, null, mid, 0.62 + mid.sky)));
  fill.addColorStop(1, rgb(tone(back, null, mid, 0.9)));
  g.fillStyle = fill;
  g.fillRect(bay.x0, c.top, w, c.floor - c.top);
  if (cell.key === "moon") {
    // Moonlight from above on the back boards: the upper third tinted toward the vault's lapis.
    const cool = g.createLinearGradient(0, c.top, 0, c.top + (c.floor - c.top) * 0.3);
    cool.addColorStop(0, rgba(PALETTE.lapis, 0.25));
    cool.addColorStop(1, rgba(PALETTE.lapis, 0));
    g.fillStyle = cool;
    g.fillRect(bay.x0, c.top, w, (c.floor - c.top) * 0.3);
  }
  g.fillStyle = `rgba(${SHADOW},0.3)`;
  for (let x = bay.x0 + 17 + ((bay.index * 7) % 11); x < bay.x1 - 4; x += 21) g.fillRect(x, c.top, 0.8, c.floor - c.top);

  // Ambient occlusion on the back boards under the board or slab above.
  const depth = underSlab ? 34 : 24;
  const ao = g.createLinearGradient(0, c.top, 0, c.top + depth);
  ao.addColorStop(0, `rgba(${SHADOW},0.88)`);
  ao.addColorStop(0.4, `rgba(${SHADOW},0.42)`);
  ao.addColorStop(1, `rgba(${SHADOW},0)`);
  g.fillStyle = ao;
  g.fillRect(bay.x0, c.top, w, depth);

  for (const item of c.items) {
    if (item.kind === "book") paintBook(g, k, bay, cell, c.floor, item);
    else if (item.kind === "stack") paintStack(g, k, bay, cell, c.floor, item);
    else paintObject(g, k, bay, cell, c.floor, item);
  }

  // The board above shades the heads of tall books; the books' feet sink into the board's shadow.
  const head = g.createLinearGradient(0, c.top, 0, c.top + 14);
  head.addColorStop(0, `rgba(${SHADOW},0.5)`);
  head.addColorStop(1, `rgba(${SHADOW},0)`);
  g.fillStyle = head;
  g.fillRect(bay.x0, c.top, w, 14);
  const foot = g.createLinearGradient(0, c.floor - 6, 0, c.floor);
  foot.addColorStop(0, `rgba(${SHADOW},0)`);
  foot.addColorStop(1, `rgba(${SHADOW},0.45)`);
  g.fillStyle = foot;
  g.fillRect(bay.x0, c.floor - 6, w, 6);

  // The moon rim on every headcap.
  for (const item of c.items) if (item.kind === "book") paintBookRim(g, c.floor, item, mid.rim);

  if (c.floor >= (cell.level + 1) * k.level) return;
  // The board's front edge, lit along its length: a bright upper fillet, the face, a dark lower lip.
  const boardY = c.floor + BOARD / 2;
  const lights = [0, 0.5, 1].map((t) => lightAt(k, cell, bay.x0 + w * t, boardY, bay.index));
  for (const [shade, y, h] of [
    [1.2, 0, 1.6],
    [0.95, 1.6, 2.4],
    [0.5, 4, BOARD - 4],
  ] as const) {
    const grad = g.createLinearGradient(bay.x0, 0, bay.x1, 0);
    lights.forEach((light, i) => grad.addColorStop(i / 2, lit(WOOD, light, shade)));
    g.fillStyle = grad;
    g.fillRect(bay.x0, c.floor + y, w, h);
  }
  moonRim(g, bay.x0, c.floor, w, mid.rim);
  g.fillStyle = `rgba(${SHADOW},0.7)`;
  g.fillRect(bay.x0, c.floor + BOARD - 0.8, w, 0.8);
}

/** Restricts drawing to the case's own horizontal extent, in its local px (the tile clips the height). */
function clipCase(g: G, k: ShelfStrip): void {
  g.beginPath();
  g.rect(k.x0, -k.period, k.x1 - k.x0, k.period * 3);
  g.clip();
}

/**
 * Runs `paint` once for every whole-period copy of the case's local extent [y0, y1] that lands
 * in the tile, the case drawn `shift` tile px down (the set-back stack's phase).
 */
function eachCopy(g: G, k: ShelfStrip, shift: number, y0: number, y1: number, paint: () => void): void {
  for (const off of periodCopies(y0 * k.scale + shift, y1 * k.scale + shift, SHELF_PERIOD)) {
    g.save();
    g.translate(0, (off + shift) / k.scale);
    paint();
    g.restore();
  }
}

/** Paints the upper (half 0) or lower (half 1) shelves of a bay level; the lower half also lays the shadow along its uprights. */
function paintCell(g: G, k: ShelfStrip, bay: Bay, cell: Cell, m: Matrix, half: 0 | 1, shift: number): void {
  g.save();
  g.setTransform(...m);
  g.beginPath();
  g.rect(Math.max(k.x0, bay.x0), -k.period, Math.min(k.x1, bay.x1) - Math.max(k.x0, bay.x0), k.period * 3);
  g.clip();
  const split = Math.ceil(cell.compartments.length / 2);
  cell.compartments.forEach((c, i) => {
    if ((i < split) === (half === 1)) return;
    eachCopy(g, k, shift, c.top, c.floor + BOARD, () => paintCompartment(g, k, bay, cell, c, i === 0));
  });
  if (half === 1) {
    // Shadow where the shelves meet the uprights.
    const y0 = cell.level * k.level;
    eachCopy(g, k, shift, y0, y0 + k.level, () => {
      for (const [x, dir] of [
        [bay.x0, 1],
        [bay.x1, -1],
      ] as const) {
        const side = g.createLinearGradient(x, 0, x + dir * 10, 0);
        side.addColorStop(0, `rgba(${SHADOW},0.6)`);
        side.addColorStop(1, `rgba(${SHADOW},0)`);
        g.fillStyle = side;
        g.fillRect(Math.min(x, x + dir * 10), y0, 10, k.level);
      }
    });
  }
  g.restore();
}

/* ------------------------------------------------------------------ frame */

/** Spacing of light samples along long wood and brass members. */
const RUN = 16;

/** Light samples every RUN px along a member, both ends included; `at` maps a position to a case point. */
function sampleLight(k: ShelfStrip, from: number, to: number, at: (p: number) => [number, number]): { pos: number[]; light: Light[] } {
  const pos: number[] = [];
  for (let p = from; p < to; p += RUN) pos.push(p);
  pos.push(to);
  return { pos, light: pos.map((p) => wallLight(k, ...at(p))) };
}

/**
 * Fills a member whose light changes along its length: linear pieces between the samples,
 * so candle falloff runs smoothly along it. `cross` is the member's [start, size] across.
 */
function fillLit(
  g: G,
  albedo: Rgb,
  shade: number,
  samples: { pos: number[]; light: Light[] },
  cross: readonly [number, number],
  vertical: boolean,
): void {
  const { pos, light } = samples;
  for (let i = 0; i < pos.length - 1; i++) {
    const a = pos[i];
    const b = pos[i + 1];
    const ca = lit(albedo, light[i], shade);
    const cb = lit(albedo, light[i + 1], shade);
    if (ca === cb) g.fillStyle = ca;
    else {
      const grad = vertical ? g.createLinearGradient(0, a, 0, b) : g.createLinearGradient(a, 0, b, 0);
      grad.addColorStop(0, ca);
      grad.addColorStop(1, cb);
      g.fillStyle = grad;
    }
    if (vertical) g.fillRect(cross[0], a, cross[1], b - a);
    else g.fillRect(a, cross[0], b - a, cross[1]);
  }
}

/** Uprights and the pilaster: a lit face between darker sides, flutes, a cool stone rim on the moon side. */
function paintUprights(g: G, k: ShelfStrip): void {
  const P = k.period;
  const fromLeft = k.side === "left";
  k.uprights.forEach((u, i) => {
    const cx = u.x + u.w / 2;
    const samples = sampleLight(k, 0, P, (y) => [cx, y]);
    const third = u.w / 3;
    fillLit(g, WOOD, 0.78, samples, [u.x, u.w], true);
    // The face toward the moon a little brighter (x1.22 by colour dodge), the far face darker.
    g.save();
    g.globalCompositeOperation = "color-dodge";
    g.fillStyle = "rgb(46,46,46)";
    g.fillRect(fromLeft ? u.x : u.x + third * 2, 0, third, P);
    g.restore();
    g.fillStyle = `rgba(${SHADOW},0.36)`;
    g.fillRect(fromLeft ? u.x + third * 2 : u.x, 0, third, P);
    for (const f of u.pilaster ? [0.36, 0.64] : [0.5]) {
      g.fillStyle = `rgba(${SHADOW},0.5)`;
      g.fillRect(u.x + u.w * f - 0.6, 0, 1.2, P);
      g.fillStyle = "rgba(255,226,190,0.07)";
      g.fillRect(u.x + u.w * f + (fromLeft ? -1.4 : 0.6), 0, 0.8, P);
    }
    // The rim is strongest beside a moonlit bay.
    for (let l = 0; l < LEVELS; l++) {
      const rims = [k.bays[i - 1], k.bays[i]].map((b) => (b ? LIGHT[b.cells[l].key].rim : 0));
      g.fillStyle = rgba(PALETTE.stoneRim, Math.min(0.65, 0.25 + Math.max(...rims)));
      g.fillRect(fromLeft ? u.x : u.x + u.w - 1, l * k.level, 1, k.level);
    }
    if (u.pilaster) {
      for (let l = 0; l < LEVELS; l++) {
        const capY = l * k.level + GALLERY;
        const light = wallLight(k, cx, capY);
        g.fillStyle = lit(WOOD, light, 0.95);
        g.fillRect(u.x - 2, capY, u.w + 4, 5);
        g.fillStyle = lit(BRASS, light);
        g.fillRect(u.x - 2, capY + 5, u.w + 4, 0.9);
      }
    }
  });
}

/** A row member across the case at height y, lit along its length. */
function litRow(g: G, k: ShelfStrip, albedo: Rgb, shade: number, y: number, h: number): void {
  fillLit(g, albedo, shade, sampleLight(k, k.x0, k.x1, (x) => [x, y + h / 2]), [y, h], false);
}

function paintRails(g: G, k: ShelfStrip): void {
  for (let l = 0; l < LEVELS; l++) {
    const y = l * k.level + RAIL_Y;
    litRow(g, k, BRASS, 1.2, y - 1.4, 1);
    litRow(g, k, BRASS, 0.75, y - 0.4, 1);
    litRow(g, k, BRASS, 0.35, y + 0.6, 1);
    for (const u of k.uprights) {
      g.fillStyle = lit(BRASS, wallLight(k, u.x + u.w / 2, y), 0.7);
      g.fillRect(u.x + u.w / 2 - 1.5, y - 3, 3, 6);
    }
  }
}

function paintSconceBody(g: G, k: ShelfStrip, s: Sconce): void {
  const up = k.uprights[s.upright];
  const ux = up.x + up.w / 2;
  // Brass right under its own flame: warm gold, not the green-yellow a full candle term gives.
  const light: Light = { ambient: 0.3, tint: [1, 1, 1], warm: 0.55, rim: 0.2, sky: 0, cap: 1 };
  const brass = (m: number) => lit(BRASS, light, m);
  g.fillStyle = brass(0.6);
  g.beginPath();
  g.ellipse(ux, s.y + 15, 3, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = brass(0.9);
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(ux, s.y + 18);
  g.bezierCurveTo(ux + s.reach * 3, s.y + 23, s.x - s.reach * 2, s.y + 22, s.x, s.y + 15);
  g.stroke();
  g.fillStyle = brass(1);
  g.beginPath();
  g.ellipse(s.x, s.y + 14.5, 5, 1.6, 0, 0, Math.PI * 2);
  g.fill();
  const wax = g.createLinearGradient(s.x - 2.4, 0, s.x + 2.4, 0);
  wax.addColorStop(0, rgb(WAX, 0.72));
  wax.addColorStop(0.45, rgb(WAX, 0.98));
  wax.addColorStop(1, rgb(WAX, 0.6));
  g.fillStyle = wax;
  g.fillRect(s.x - 2.4, s.y + 1, 4.8, 13);
  g.fillStyle = rgb(WAX, 1);
  g.beginPath();
  g.ellipse(s.x, s.y + 1, 2.4, 0.9, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(s.x + 1.2, s.y + 1, 1.2, 4.5);
  g.fillStyle = "rgba(30,20,14,0.9)";
  g.fillRect(s.x - 0.35, s.y - 2, 0.7, 2.6);
}

/** A gradient along a straight member from (x0, y0) to (x1, y1), lit at every sample. */
function memberGradient(g: G, k: ShelfStrip, albedo: Rgb, shade: number, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const grad = g.createLinearGradient(x0, y0, x1, y1);
  const n = Math.max(1, Math.ceil(Math.abs(y1 - y0) / RUN));
  for (let i = 0; i <= n; i++) grad.addColorStop(i / n, lit(albedo, wallLight(k, lerp(x0, x1, i / n), lerp(y0, y1, i / n)), shade));
  return grad;
}

/**
 * The rolling ladder: hooked over the brass rail, its foot out from the case on the walkway
 * below, so it leans in the picture and its shadow on the shelves widens toward the foot.
 */
function paintLadder(g: G, k: ShelfStrip): void {
  const L = k.ladder;
  if (!L) return;
  const H = L.bottom - L.top;
  const cx = (t: number) => lerp(L.hookX, L.footX, t);
  const half = (t: number) => lerp(L.spreadTop, L.spreadBottom, t) / 2;
  const moon = k.side === "left" ? -1 : 1;
  // The shadow falls away from the moon side and down, further the further the ladder stands out.
  const drop = (t: number) => lerp(2, 14, t);
  const rungs: number[] = [];
  for (let y = L.bottom - L.rungStep; y > L.top + 20; y -= L.rungStep) rungs.push(y);

  g.save();
  g.filter = "blur(2.5px)";
  g.strokeStyle = `rgba(${SHADOW},0.5)`;
  g.fillStyle = `rgba(${SHADOW},0.42)`;
  g.lineWidth = 5;
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx(0) + side * half(0) - moon * drop(0), L.top + 3);
    g.lineTo(cx(1) + side * half(1) - moon * drop(1), L.bottom + 5);
    g.stroke();
  }
  for (const y of rungs) {
    const t = (y - L.top) / H;
    g.fillRect(cx(t) - half(t) - moon * drop(t), y + 3 + t * 3, half(t) * 2, 2.6);
  }
  g.restore();

  // Rails: wood lit along their length, a lit edge on the moon side and a dark edge on the other.
  g.lineCap = "butt";
  for (const side of [-1, 1]) {
    const xa = cx(0) + side * half(0);
    const xb = cx(1) + side * half(1);
    g.strokeStyle = memberGradient(g, k, LADDER_WOOD, 0.9, xa, L.top, xb, L.bottom);
    g.lineWidth = 4.6;
    g.beginPath();
    g.moveTo(xa, L.top);
    g.lineTo(xb, L.bottom);
    g.stroke();
    g.strokeStyle = memberGradient(g, k, LADDER_WOOD, 1.3, xa, L.top, xb, L.bottom);
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(xa + moon * 1.5, L.top);
    g.lineTo(xb + moon * 1.5, L.bottom);
    g.stroke();
    g.strokeStyle = `rgba(${SHADOW},0.8)`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(xa - moon * 2.3, L.top);
    g.lineTo(xb - moon * 2.3, L.bottom);
    g.stroke();
  }
  // Level treads between the rails.
  for (const y of rungs) {
    const t = (y - L.top) / H;
    const a = cx(t) - half(t) + 1.5;
    const b = cx(t) + half(t) - 1.5;
    const light = wallLight(k, cx(t), y);
    g.fillStyle = lit(LADDER_WOOD, light, 1.3);
    g.fillRect(a, y, b - a, 1.3);
    g.fillStyle = lit(LADDER_WOOD, light, 0.8);
    g.fillRect(a, y + 1.3, b - a, 1.9);
    g.fillStyle = `rgba(${SHADOW},0.6)`;
    g.fillRect(a, y + 3.2, b - a, 0.8);
  }
  // Hooks over the brass rail, and brass wheels on the walkway slab.
  for (const side of [-1, 1]) {
    const hx = cx(0) + side * half(0);
    const brass = lit(BRASS, wallLight(k, hx, RAIL_Y), 1.1);
    g.strokeStyle = brass;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(hx, L.top + 6);
    g.lineTo(hx, RAIL_Y - 3);
    g.quadraticCurveTo(hx, RAIL_Y - 5.5, hx - moon * 2.5, RAIL_Y - 4);
    g.stroke();
    const wx = cx(1) + side * half(1);
    const light = wallLight(k, wx, L.bottom);
    g.fillStyle = lit(BRASS, light, 0.55);
    g.fillRect(wx - 1.6, L.bottom - 7, 3.2, 3);
    g.fillStyle = lit(BRASS, light, 0.95);
    g.beginPath();
    g.arc(wx, L.bottom - 3.2, 3.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = `rgba(${SHADOW},0.8)`;
    g.beginPath();
    g.arc(wx, L.bottom - 3.2, 1.1, 0, Math.PI * 2);
    g.fill();
    moonRim(g, wx - 2, L.bottom - 6.4, 4, 0.35);
  }
}

/** The gallery walkway at the top of a level: handrail, balusters, newel posts, slab with a gilt bead and dentils. */
function paintGallery(g: G, k: ShelfStrip, y0: number): void {
  const { x0, x1 } = k;
  const fromLeft = k.side === "left";
  const at = (x: number, dy: number) => wallLight(k, x, y0 + dy);
  for (let x = x0 + 3; x < x1; x += 9) {
    const light = at(x, 12);
    const grad = g.createLinearGradient(x - 2.6, 0, x + 2.6, 0);
    grad.addColorStop(0, lit(WOOD, light, 0.4));
    grad.addColorStop(fromLeft ? 0.35 : 0.65, lit(WOOD, light, 1.1));
    grad.addColorStop(1, lit(WOOD, light, 0.35));
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x - 1.4, y0 + 5);
    g.lineTo(x + 1.4, y0 + 5);
    g.lineTo(x + 1.1, y0 + 8);
    g.bezierCurveTo(x + 3.2, y0 + 10, x + 3.2, y0 + 15, x + 1.6, y0 + 17);
    g.lineTo(x + 2.2, y0 + 19.5);
    g.lineTo(x - 2.2, y0 + 19.5);
    g.lineTo(x - 1.6, y0 + 17);
    g.bezierCurveTo(x - 3.2, y0 + 15, x - 3.2, y0 + 10, x - 1.1, y0 + 8);
    g.closePath();
    g.fill();
  }
  for (const u of k.uprights) {
    const light = at(u.x + u.w / 2, 12);
    const post = g.createLinearGradient(u.x, 0, u.x + u.w, 0);
    post.addColorStop(0, lit(WOOD, light, 0.45));
    post.addColorStop(fromLeft ? 0.3 : 0.7, lit(WOOD, light, 1.05));
    post.addColorStop(1, lit(WOOD, light, 0.4));
    g.fillStyle = post;
    g.fillRect(u.x - 1, y0 + 2, u.w + 2, BALUSTRADE - 2);
  }
  // Bottom rail, handrail with its brass cap, then the slab: gilt bead, fascia, shadowed soffit.
  const s0 = y0 + BALUSTRADE;
  for (const [albedo, shade, y, h] of [
    [WOOD, 0.7, y0 + 19.5, BALUSTRADE - 19.5],
    [BRASS, 1.05, y0, 1],
    [BRASS, 0.6, y0 + 1, 1],
    [WOOD, 0.95, y0 + 2, 1.5],
    [WOOD, 0.5, y0 + 3.5, 1.5],
    [BRASS, 0.8, s0, 1.6],
    [WOOD, 0.95, s0 + 1.6, 3],
    [WOOD, 0.78, s0 + 4.6, 3.4],
    [WOOD, 0.58, s0 + 8, 3],
    [WOOD, 0.28, s0 + 11, GALLERY - BALUSTRADE - 11],
  ] as const) {
    litRow(g, k, albedo, shade, y, h);
  }
  moonRim(g, x0, y0, x1 - x0, 0.32);
  g.fillStyle = rgba(PALETTE.moonFall, 0.24);
  g.fillRect(x0, s0 + 1.6, x1 - x0, 0.8);
  for (let x = x0 + 1; x < x1; x += 6) {
    g.fillStyle = lit(WOOD, at(x, 32), 0.8);
    g.fillRect(x, s0 + 12, 3.4, 3.6);
    g.fillStyle = `rgba(${SHADOW},0.6)`;
    g.fillRect(x, s0 + 15.6, 3.4, 0.8);
  }
  g.fillStyle = `rgba(${SHADOW},0.8)`;
  g.fillRect(x0, y0 + GALLERY - 1.2, x1 - x0, 1.2);
}

/** The near case's side face where it steps forward of the set-back stack, lit cool from above. */
function paintEndPanel(g: G, k: ShelfStrip): void {
  if (k.endPanel === null) return;
  const x = k.endPanel;
  const toBack = k.side === "left" ? 1 : -1;
  const front = toBack > 0 ? x : x + END_PANEL;
  fillLit(g, WOOD, 0.62, sampleLight(k, 0, k.period, (y) => [front, y]), [x, END_PANEL], true);
  // Darker toward the stack, away from the light on the front edge.
  const turn = g.createLinearGradient(front, 0, front + toBack * END_PANEL, 0);
  turn.addColorStop(0, `rgba(${SHADOW},0)`);
  turn.addColorStop(1, `rgba(${SHADOW},0.55)`);
  g.fillStyle = turn;
  g.fillRect(x, 0, END_PANEL, k.period);
  for (let l = 0; l < LEVELS; l++) {
    const y0 = l * k.level;
    // The gallery slab's return, then cool light down the face from the top of the level.
    g.fillStyle = lit(WOOD, wallLight(k, front, y0 + 30), 0.4);
    g.fillRect(x, y0 + BALUSTRADE, END_PANEL, GALLERY - BALUSTRADE);
    g.fillStyle = lit(BRASS, wallLight(k, front, y0 + BALUSTRADE), 0.8);
    g.fillRect(x, y0 + BALUSTRADE, END_PANEL, 1.4);
    const cool = g.createLinearGradient(0, y0 + GALLERY, 0, y0 + GALLERY + 120);
    cool.addColorStop(0, rgba(PALETTE.stoneRim, 0.3));
    cool.addColorStop(1, rgba(PALETTE.stoneRim, 0));
    g.fillStyle = cool;
    g.fillRect(x, y0 + GALLERY, END_PANEL, 120);
  }
  g.fillStyle = rgba(PALETTE.moonFall, 0.4);
  g.fillRect(toBack > 0 ? front : front - 1, 0, 1, k.period);
}

/**
 * Additive candle glow: the static, mean-brightness light in the air around each sconce. The
 * pool stays in the sconce's own bay (the uprights hold it), so a neighbour keeps its key.
 */
function paintGlow(g: G, k: ShelfStrip): void {
  g.save();
  g.globalCompositeOperation = "lighter";
  for (const s of k.sconces) {
    const bay = k.bays[s.bay];
    const up = k.uprights[s.upright];
    const bx0 = Math.min(bay.x0, up.x);
    const bx1 = Math.max(bay.x1, up.x + up.w);
    for (const off of periodCopies(s.y - s.radius, s.y + s.radius, k.period)) {
      const cy = s.y - 4 + off;
      const r = s.radius * 0.9;
      const pool = g.createRadialGradient(s.x, cy, 0, s.x, cy, r);
      for (const [t, a] of GLOW_POOL) pool.addColorStop(t, `rgba(255,${Math.round(lerp(170, 120, t))},${Math.round(lerp(90, 40, t))},${a})`);
      g.fillStyle = pool;
      g.fillRect(bx0, cy - r, bx1 - bx0, r * 2);
      const halo = g.createRadialGradient(s.x, cy, 0, s.x, cy, 22);
      halo.addColorStop(0, "rgba(255,206,150,0.2)");
      halo.addColorStop(1, "rgba(255,170,90,0)");
      g.fillStyle = halo;
      g.fillRect(s.x - 22, cy - 22, 44, 44);
    }
  }
  g.restore();
}

/** Darkens the strip toward the screen edge, so the wall recedes into the hall. */
function paintVignette(g: G, strip: ShelfStrip): void {
  const W = strip.width;
  const reach = Math.min(W * 0.6, strip.back ? 200 : 320);
  const strength = (strip.back ? 0.5 : 0.66) * Math.min(1, Math.max(0.45, W / 300));
  const x0 = strip.outerX;
  const x1 = strip.side === "left" ? x0 + reach : x0 - reach;
  const v = g.createLinearGradient(x0, 0, x1, 0);
  v.addColorStop(0, rgba(PALETTE.void, strength));
  v.addColorStop(1, rgba(PALETTE.void, 0));
  g.fillStyle = v;
  g.fillRect(0, 0, W, strip.period);
}

/**
 * The set-back stack sits in nave haze at BACK_VALUE, the haze thickening toward the top of
 * each of its levels, with the near case's shadow across its outer edge.
 */
function paintDepth(g: G, strip: ShelfStrip): void {
  const b = strip.back;
  if (!b) return;
  const x0 = b.originX;
  const x1 = b.originX + b.width * b.scale;
  g.fillStyle = rgba(PALETTE.nave, 1 - BACK_VALUE);
  g.fillRect(x0, 0, x1 - x0, strip.period);
  const level = b.level * b.scale;
  for (let l = 0; l < LEVELS; l++) {
    for (const off of periodCopies(l * level + BACK_PHASE, (l + 1) * level + BACK_PHASE, SHELF_PERIOD)) {
      const top = l * level + BACK_PHASE + off;
      const haze = g.createLinearGradient(0, top, 0, top + level);
      haze.addColorStop(0, rgba(PALETTE.nave, 0.12));
      haze.addColorStop(1, rgba(PALETTE.nave, 0));
      g.fillStyle = haze;
      g.fillRect(x0, top, x1 - x0, level);
    }
  }
  const edge = strip.side === "left" ? x0 : x1;
  const dir = strip.side === "left" ? 1 : -1;
  const shade = g.createLinearGradient(edge, 0, edge + dir * 30, 0);
  shade.addColorStop(0, `rgba(${SHADOW},0.62)`);
  shade.addColorStop(1, `rgba(${SHADOW},0)`);
  g.fillStyle = shade;
  g.fillRect(Math.min(edge, edge + dir * 30), 0, 30, strip.period);
}

/** A case's frame in three staged parts, under its matrix and clip, drawn `shift` tile px down. */
function frameSteps(g: G, k: ShelfStrip, m: Matrix, shift: number): Array<() => void> {
  const local = (paint: () => void) => () => {
    g.save();
    g.setTransform(...m);
    clipCase(g, k);
    eachCopy(g, k, shift, 0, k.period, paint);
    g.restore();
  };
  return [
    local(() => paintUprights(g, k)),
    local(() => {
      for (let l = 0; l < LEVELS; l++) paintGallery(g, k, l * k.level);
    }),
    local(() => {
      paintRails(g, k);
      for (const s of k.sconces) paintSconceBody(g, k, s);
      paintLadder(g, k);
    }),
  ];
}

const caseMatrix = (k: ShelfStrip, dpr: number): Matrix => [dpr * k.scale, 0, 0, dpr * k.scale, dpr * k.originX, 0];

/* ------------------------------------------------------------------ api */

/**
 * Staged steps that paint one period of `strip` into `tile`, a context whose canvas is
 * strip.width x strip.period CSS px at `dpr` (use shelfDpr so period x dpr is whole).
 * The set-back stack's bay levels (two steps each) and frame come first, drawn BACK_PHASE px
 * down so its galleries never line up with the near case's, then the near case's, then one
 * step for the end panel and the light.
 */
export function shelfTileSteps(tile: G, strip: ShelfStrip, dpr: number, seed: number): Array<() => void> {
  const steps: Array<() => void> = [];
  for (const k of strip.back ? [strip.back, strip] : [strip]) {
    const m = caseMatrix(k, dpr);
    const shift = k === strip ? 0 : BACK_PHASE;
    for (const bay of k.bays) {
      for (const cell of bay.cells) steps.push(() => paintCell(tile, k, bay, cell, m, 0, shift), () => paintCell(tile, k, bay, cell, m, 1, shift));
    }
    steps.push(...frameSteps(tile, k, m, shift));
  }
  steps.push(() => {
    tile.save();
    tile.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintDepth(tile, strip);
    paintEndPanel(tile, strip);
    paintGlow(tile, strip);
    paintVignette(tile, strip);
    tile.setTransform(1, 0, 0, 1, 0, 0);
    paintDither(tile, tile.canvas.width, tile.canvas.height, createRng(seed));
    tile.restore();
  });
  return steps;
}

/**
 * Fills a strip canvas of any height from a finished tile, repeating it down by the period,
 * with tile row 0 at `phasePx` device px (round(strip.phase x dpr)). Whole-pixel copies, so
 * every period of the strip is identical to the tile.
 */
export function fillFromTile(target: G, tile: HTMLCanvasElement, phasePx = 0): void {
  const { width, height } = target.canvas;
  const p = ((Math.round(phasePx) % tile.height) + tile.height) % tile.height;
  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.clearRect(0, 0, width, height);
  for (let y = p > 0 ? p - tile.height : 0; y < height; y += tile.height) target.drawImage(tile, 0, y);
  target.restore();
}

/**
 * A candle flame standing on (x, y) in CSS px of `g`'s current transform. `k` is its
 * brightness: 1 is the mean; the live layer flickers it within 12 % (spec 3.1 layer 10).
 */
export function paintFlame(g: G, x: number, y: number, k: number): void {
  const glow = g.createRadialGradient(x, y - 4, 0, x, y - 4, 14);
  glow.addColorStop(0, `rgba(255,190,110,${(0.36 * k).toFixed(3)})`);
  glow.addColorStop(1, "rgba(255,150,70,0)");
  g.fillStyle = glow;
  g.fillRect(x - 14, y - 18, 28, 28);
  const h = 8.5 * (0.92 + 0.08 * k);
  const body = g.createLinearGradient(0, y, 0, y - h);
  body.addColorStop(0, "rgba(120,150,255,0.85)");
  body.addColorStop(0.18, "rgba(255,214,150,0.95)");
  body.addColorStop(0.55, "rgba(255,236,196,1)");
  body.addColorStop(1, "rgba(255,170,80,0.2)");
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(x, y - h);
  g.bezierCurveTo(x + 2.6, y - h * 0.5, x + 2.4, y - 0.6, x, y);
  g.bezierCurveTo(x - 2.4, y - 0.6, x - 2.6, y - h * 0.5, x, y - h);
  g.fill();
}
