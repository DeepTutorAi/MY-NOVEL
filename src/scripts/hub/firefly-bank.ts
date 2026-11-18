// The far bank in the mid window (spec 3.5): one stilt house per published or locked
// card, lit by reading progress, and a distant boat lantern for each upcoming novel. The
// layout is pure and tested; the painters receive contexts and allocate nothing global.

import { createNoise2D, createRng } from "../_shared/scene-runtime";
import { leafPath } from "./firefly-tree";
import type { CardInfo } from "./world/types";

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface House {
  slug: string;
  kind: "open" | "locked";
  accent: string;
  /** Centre x of the house (window px). */
  x: number;
  w: number;
  h: number;
  stilt: number;
  roof: number;
  windows: number;
  /** Lamp warmth 0..1 from the reading record. */
  glow: number;
  finished: boolean;
  /** Locked: shutters closed, no lamp, no reflection. */
  shut: boolean;
}

export interface Boat {
  slug: string;
  accent: string;
  /** Starts beyond the right edge and eases toward `rest`, stopping short of it. */
  from: number;
  rest: number;
  y: number;
  /** Seconds for the gap to shrink by 1/e. */
  tau: number;
}

export interface Bank {
  w: number;
  h: number;
  boxX: number;
  boxW: number;
  scale: number;
  waterY: number;
  /** Height of the bank above the waterline every PROFILE_STEP px, from x = 0. */
  profile: Float32Array;
  houses: House[];
  boats: Boat[];
  seed: number;
}

export const PROFILE_STEP = 4;

/** Lamp warmth from progress: dark until started, warm from the first page, full when finished. */
export function houseGlow(read: number | null, finished: boolean): number {
  if (finished) return 1;
  if (read === null || !(read > 0)) return 0;
  return clamp(0.32 + 0.68 * read, 0, 1);
}

export function bankLayout(
  cards: readonly CardInfo[],
  win: { w: number; h: number; boxX: number; boxW: number },
  scale: number,
  seed: number,
  /** The page model's layout mode: phone and landscape-short get a legible floor on house size. */
  mode?: string,
): Bank {
  const { w, h, boxX, boxW } = win;
  const s = clamp(scale, 0.5, 1.25);
  const rng = createRng(seed * 31 + 7);
  const noise = createNoise2D(seed + 19);
  const phone = mode === "phone";
  // On a phone the bank fills more of the window, so the empty sky above it shrinks.
  const waterY = Math.round(h * (phone ? 0.62 : 0.56));
  const built = cards.filter((c) => c.kind !== "upcoming");
  const upcoming = cards.filter((c) => c.kind === "upcoming");
  const margin = boxW * 0.07;
  const usable = boxW - margin * 2;
  const floor = phone ? 30 : mode === "landscape-short" ? 24 : 0;
  const slot = usable / Math.max(1, built.length);
  // Houses stay legible on small windows (floor), but never wider than their slot.
  const unit = Math.min(Math.max(floor, Math.min(50, h * 0.22) * s * (boxW < 500 ? 0.8 : 1)), slot / 1.5);
  const houses: House[] = built.map((card, i) => {
    const cx = boxX + margin + (usable * (i + 0.5)) / Math.max(1, built.length) + (rng() - 0.5) * usable * 0.06;
    const hw = unit * (1.05 + rng() * 0.35);
    return {
      slug: card.slug,
      kind: card.kind === "locked" ? "locked" : "open",
      accent: card.accent,
      x: cx,
      w: hw,
      h: unit * (0.55 + rng() * 0.15),
      stilt: unit * (0.32 + rng() * 0.16),
      roof: unit * (0.42 + rng() * 0.14),
      windows: hw > 30 ? 2 : 1,
      glow: card.kind === "locked" ? 0 : houseGlow(card.read, card.finished),
      finished: card.kind !== "locked" && card.finished,
      shut: card.kind === "locked",
    };
  });
  const boats: Boat[] = upcoming.map((card, i) => ({
    slug: card.slug,
    accent: card.accent,
    // On the river from the first frame (and in the still), drifting in from the right.
    from: boxX + boxW * (0.9 + 0.06 * i),
    rest: boxX + boxW * (0.62 + 0.14 * i),
    y: waterY + (h - waterY) * (0.3 + 0.24 * i),
    tau: 70 + i * 25,
  }));
  const samples = Math.ceil(w / PROFILE_STEP) + 1;
  const profile = new Float32Array(samples);
  const farH = h * 0.15;
  for (let k = 0; k < samples; k++) {
    const x = k * PROFILE_STEP;
    profile[k] = Math.max(2 * s, farH * (0.18 + 0.12 * noise(x * 0.006, 21)) + 1.2 * s * noise(x * 0.3, 23));
  }
  return { w, h, boxX, boxW, scale: s, waterY, profile, houses, boats, seed };
}

/** Position of an upcoming boat after `t` seconds on the page: it slows toward a point short of `rest`. */
export function boatX(boat: Boat, t: number): number {
  return boat.rest + (boat.from - boat.rest) * (0.16 + 0.84 * Math.exp(-Math.max(0, t) / boat.tau));
}

/** A warm lamp colour leaning toward a novel's accent. */
export function lampColour(accent: string, glow: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(accent.trim());
  const base = [255, 196, 112];
  const tint = m ? [0, 2, 4].map((i) => Number.parseInt(m[1].slice(i, i + 2), 16)) : base;
  const mix = base.map((v, i) => Math.round(v * 0.72 + tint[i] * 0.28));
  return `rgba(${mix[0]},${mix[1]},${mix[2]},${clamp(glow, 0, 1).toFixed(3)})`;
}

const FAR_DISTANT = "#0c1a24";
const FAR_BANK = "#08161f";
const HOUSE = "#071119";

/** Coconut palm: slender leaning trunk with drooping feathered fronds. */
function palm(g: CanvasRenderingContext2D, x: number, y: number, h: number, lean: number, s: number, rng: () => number): void {
  const tx = x + lean * h;
  const ty = y - h;
  g.beginPath();
  g.moveTo(x - 1.3 * s, y);
  g.quadraticCurveTo(x + lean * h * 0.1, y - h * 0.55, tx, ty);
  g.lineTo(tx + 1.4 * s, ty);
  g.quadraticCurveTo(x + lean * h * 0.1 + 1.6 * s, y - h * 0.55, x + 1.3 * s, y);
  g.fill();
  const n = 8 + Math.floor(rng() * 4);
  g.beginPath();
  for (let k = 0; k < n; k++) {
    const ang = -Math.PI / 2 + ((k + rng() * 0.6) / n - 0.5) * Math.PI * 1.7;
    const len = h * (0.24 + rng() * 0.12);
    const ex = tx + Math.cos(ang) * len;
    const ey = ty + Math.sin(ang) * len * 0.55 + len * 0.45 * (1 - Math.abs(Math.sin(ang)) * 0.6);
    const mx = tx + Math.cos(ang) * len * 0.55;
    const my = ty + Math.sin(ang) * len * 0.6 - len * 0.12;
    const w = len * 0.08;
    g.moveTo(tx, ty);
    g.quadraticCurveTo(mx, my - w, ex, ey);
    g.quadraticCurveTo(mx, my + w, tx, ty);
  }
  g.fill();
}

/** Nipa palm clump: stemless fronds rising from the waterline. */
function nipa(g: CanvasRenderingContext2D, x: number, y: number, h: number, s: number, rng: () => number): void {
  const n = 5 + Math.floor(rng() * 4);
  g.beginPath();
  for (let k = 0; k < n; k++) {
    const ang = -Math.PI / 2 + ((k + rng() * 0.5) / n - 0.5) * 1.9;
    const len = h * (0.65 + rng() * 0.45);
    const bx = x + (rng() - 0.5) * 4 * s;
    const ex = bx + Math.cos(ang) * len * 1.05;
    const ey = y + Math.sin(ang) * len * 0.8 + len * 0.25;
    const mx = bx + Math.cos(ang) * len * 0.5;
    const my = y + Math.sin(ang) * len * 0.75;
    const w = Math.max(0.8, len * 0.08);
    g.moveTo(bx - w * 0.5, y);
    g.quadraticCurveTo(mx - w, my, ex, ey);
    g.quadraticCurveTo(mx + w, my + w * 0.6, bx + w * 0.5, y);
  }
  g.fill();
}

/** One stilt house: stilts, wall, roof, a plank to the water, its windows lit or shuttered. */
function house(g: CanvasRenderingContext2D, b: Bank, hs: House, warm: HTMLCanvasElement): void {
  const s = b.scale;
  const floor = b.waterY - hs.stilt;
  const x0 = hs.x - hs.w / 2;
  g.fillStyle = HOUSE;
  g.strokeStyle = HOUSE;
  g.lineWidth = Math.max(0.8, s);
  g.beginPath();
  for (let p = 0; p <= 3; p++) {
    const px = x0 + (hs.w * p) / 3;
    g.moveTo(px, floor);
    g.lineTo(px + (p - 1.5) * 0.4, b.waterY + 1.5 * s);
  }
  g.stroke();
  g.fillRect(x0 - 2 * s, floor - 1, hs.w + 4 * s, 1.6 * s);
  g.fillRect(x0, floor - hs.h, hs.w, hs.h);
  g.beginPath();
  const eave = 4 * s;
  g.moveTo(x0 - eave, floor - hs.h + 1.2 * s);
  g.quadraticCurveTo(hs.x - hs.w * 0.22, floor - hs.h - hs.roof * 0.3, hs.x, floor - hs.h - hs.roof);
  g.quadraticCurveTo(hs.x + hs.w * 0.22, floor - hs.h - hs.roof * 0.3, x0 + hs.w + eave, floor - hs.h + 1.2 * s);
  g.closePath();
  g.fill();
  // A plank jetty from the house to the water.
  g.fillRect(hs.x + hs.w * 0.2, b.waterY - 2.2 * s, hs.w * 0.7, 1.3 * s);
  const ww = Math.max(2.2, hs.w * 0.14);
  const wh = Math.max(3, hs.h * 0.42);
  for (let k = 0; k < hs.windows; k++) {
    const wx = x0 + ((k + 0.5) / hs.windows) * hs.w - ww / 2;
    const wy = floor - hs.h * 0.7;
    if (hs.shut) {
      // Closed shutters: two dark leaves with slats, no light.
      g.fillStyle = "#1c140e";
      g.fillRect(wx - 0.6, wy, ww + 1.2, wh);
      g.fillStyle = "#0a0705";
      for (let y = wy + 1; y < wy + wh; y += 1.6 * s) g.fillRect(wx - 0.6, y, ww + 1.2, 0.5);
      g.fillRect(wx + ww / 2 - 0.3, wy, 0.6, wh);
      continue;
    }
    const lit = hs.glow;
    g.fillStyle = lit > 0 ? lampColour(hs.accent, 0.35 + 0.65 * lit) : "#141c22";
    g.fillRect(wx, wy, ww, wh);
    if (lit > 0) {
      g.globalAlpha = 0.3 + 0.5 * lit;
      const gr = hs.w * (0.3 + 0.35 * lit);
      g.drawImage(warm, wx + ww / 2 - gr, wy + wh / 2 - gr, gr * 2, gr * 2);
      g.globalAlpha = 1;
    }
    g.fillStyle = HOUSE;
  }
  if (hs.finished) {
    // A lantern moored at its jetty: a post and a warm light low over the water.
    const lx = hs.x + hs.w * 0.86;
    const ly = b.waterY - 7 * s;
    g.fillStyle = HOUSE;
    g.fillRect(lx - 0.5 * s, ly, 1 * s, 7 * s);
    g.fillStyle = lampColour(hs.accent, 1);
    g.beginPath();
    g.arc(lx, ly - 1.4 * s, 1.6 * s, 0, TAU);
    g.fill();
    g.globalAlpha = 0.7;
    const gr = 12 * s;
    g.drawImage(warm, lx - gr, ly - 1.4 * s - gr, gr * 2, gr * 2);
    g.globalAlpha = 1;
  }
}

/**
 * Steps that paint the bank art (window px from the top of the window to just below
 * the waterline, transparent sky) into `art` at `dpr`, and the river's mirror source
 * (flipped bank, lamp streaks, depth tint) into `mirror` at `mirrorDpr`.
 */
export function bankSteps(
  b: Bank,
  art: CanvasRenderingContext2D,
  dpr: number,
  mirror: CanvasRenderingContext2D,
  mirrorDpr: number,
  artCanvas: HTMLCanvasElement,
  warm: HTMLCanvasElement,
): (() => void)[] {
  const s = b.scale;
  const W = b.w;
  const artH = b.waterY + 6;
  const riverH = b.h - b.waterY;
  const steps: (() => void)[] = [];
  steps.push(() => {
    art.setTransform(1, 0, 0, 1, 0, 0);
    art.clearRect(0, 0, art.canvas.width, art.canvas.height);
    art.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rng = createRng(b.seed + 3);
    const noise = createNoise2D(b.seed + 5);
    const farH = b.h * 0.24;
    // Distant treeline: crowns of uneven width and height, open stretches, a few palms.
    art.fillStyle = FAR_DISTANT;
    art.beginPath();
    art.moveTo(-4, b.waterY + 1);
    const crowns: number[] = [];
    for (let x = -60; x < W + 60; ) {
      if (rng() < 0.12) {
        x += (20 + rng() * 50) * s;
        continue;
      }
      const hw = (6 + Math.pow(rng(), 1.8) * 34) * s;
      crowns.push(x, hw, farH * (0.35 + rng() * 0.55));
      x += hw * (0.7 + rng() * 1.1);
    }
    for (let x = -4; x <= W + 4; x += 3) {
      let hgt = farH * (0.22 + 0.12 * noise(x * 0.004, 7));
      for (let c = 0; c < crowns.length; c += 3) {
        const q = (x - crowns[c]) / crowns[c + 1];
        if (q > -1 && q < 1) hgt = Math.max(hgt, crowns[c + 2] * Math.sqrt(1 - q * q));
      }
      hgt += 1.4 * s * noise(x * 0.21, 3);
      art.lineTo(x, b.waterY - hgt);
    }
    art.lineTo(W + 4, b.waterY + 1);
    art.closePath();
    art.fill();
    for (let n = 0, count = Math.round(W / 190); n < count; n++) {
      palm(art, rng() * W, b.waterY - farH * 0.25, (22 + rng() * 18) * s, (rng() - 0.5) * 0.25, s * 0.75, rng);
    }
    const haze = art.createLinearGradient(0, b.waterY - farH * 2, 0, b.waterY);
    haze.addColorStop(0, "rgba(40,90,110,0)");
    haze.addColorStop(1, "rgba(50,100,120,0.1)");
    art.fillStyle = haze;
    art.fillRect(0, b.waterY - farH * 2, W, farH * 2);
    // The near bank: a low earth line with nipa clumps, shrubs and palm groups.
    art.fillStyle = FAR_BANK;
    art.beginPath();
    art.moveTo(-4, b.waterY + 1);
    for (let k = 0; k < b.profile.length; k++) art.lineTo(k * PROFILE_STEP, b.waterY - b.profile[k]);
    art.lineTo(W + 4, b.waterY + 1);
    art.closePath();
    art.fill();
    for (let n = 0, count = Math.round(W / 40); n < count; n++) {
      const x = rng() * W;
      if (b.houses.some((hs) => Math.abs(x - hs.x) < hs.w * 0.7)) continue;
      nipa(art, x, b.waterY + 0.5, (6 + rng() * 9) * s, s, rng);
    }
    for (let n = 0, count = Math.max(3, Math.round(W / 210)); n < count; n++) {
      const x = rng() * W;
      if (b.houses.some((hs) => Math.abs(x - hs.x) < hs.w)) continue;
      const group = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < group; k++) {
        palm(art, x + (k - 1) * (5 + rng() * 7) * s, b.waterY - 1, (26 + rng() * 26) * s * (b.h < 140 ? 0.7 : 1), (rng() - 0.5) * 0.45, s, rng);
      }
    }
  });
  steps.push(() => {
    art.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rng = createRng(b.seed + 11);
    // Shrubs hugging the waterline between the houses.
    art.fillStyle = FAR_BANK;
    for (let n = 0, count = Math.round(W / 80); n < count; n++) {
      const x = ((n + rng()) / count) * W;
      const rw = (6 + rng() * 11) * s;
      const rh = rw * (0.5 + rng() * 0.3);
      const cy = b.waterY - rh * 0.55;
      const leaf = clamp(rw * 0.34, 2.2 * s, 5 * s);
      art.beginPath();
      const count2 = Math.ceil((Math.PI * rw * rh * 1.5) / (leaf * leaf * 0.17));
      for (let k = 0; k < count2; k++) {
        const a = rng() * TAU;
        const d = Math.sqrt(rng());
        const px = x + Math.cos(a) * rw * d;
        const py = Math.min(b.waterY + 0.5, cy + Math.sin(a) * rh * d);
        const len = leaf * (0.75 + rng() * 0.6);
        leafPath(art, px, py, Math.atan2(Math.sin(a) * 0.5 + 0.5, Math.cos(a)) + (rng() - 0.5) * 1.3, len, len * 0.3);
      }
      art.fill();
    }
    for (const hs of b.houses) house(art, b, hs, warm);
    const mist = art.createLinearGradient(0, b.waterY - b.h * 0.12, 0, b.waterY + 2);
    mist.addColorStop(0, "rgba(120,170,185,0)");
    mist.addColorStop(1, "rgba(140,185,200,0.12)");
    art.fillStyle = mist;
    art.fillRect(0, b.waterY - b.h * 0.12, W, b.h * 0.12 + 2);
  });
  steps.push(() => {
    const md = mirrorDpr;
    mirror.setTransform(1, 0, 0, 1, 0, 0);
    mirror.clearRect(0, 0, mirror.canvas.width, mirror.canvas.height);
    // The river's own colour first, then the flipped bank over it.
    const base = mirror.createLinearGradient(0, 0, 0, riverH * md);
    base.addColorStop(0, "#0c2230");
    base.addColorStop(1, "#050d15");
    mirror.fillStyle = base;
    mirror.fillRect(0, 0, mirror.canvas.width, mirror.canvas.height);
    mirror.setTransform(md / dpr, 0, 0, -md / dpr, 0, b.waterY * md);
    mirror.drawImage(artCanvas, 0, 0, Math.ceil(W * dpr), Math.ceil(artH * dpr), 0, 0, Math.ceil(W * dpr), Math.ceil(artH * dpr));
    mirror.setTransform(md, 0, 0, md, 0, -b.waterY * md);
    for (const hs of b.houses) {
      if (hs.shut) {
        // No reflection for a shuttered house.
        mirror.fillStyle = "rgba(6,16,24,0.88)";
        mirror.fillRect(hs.x - hs.w * 0.7, b.waterY, hs.w * 1.4, riverH);
        continue;
      }
      const glow = Math.max(hs.glow, hs.finished ? 1 : 0);
      if (glow <= 0) continue;
      // Each lit window stretches into a column of light on the water.
      const len = riverH * (0.45 + 0.5 * glow);
      const lg = mirror.createLinearGradient(0, b.waterY, 0, b.waterY + len);
      lg.addColorStop(0, lampColour(hs.accent, 0.55 * glow));
      lg.addColorStop(1, lampColour(hs.accent, 0));
      mirror.fillStyle = lg;
      mirror.fillRect(hs.x - hs.w * 0.28, b.waterY, hs.w * 0.56, len);
    }
    const tint = mirror.createLinearGradient(0, b.waterY, 0, b.h);
    tint.addColorStop(0, "rgba(4,12,22,0.1)");
    tint.addColorStop(0.3, "rgba(4,12,22,0.38)");
    tint.addColorStop(1, "rgba(2,6,12,0.72)");
    mirror.fillStyle = tint;
    mirror.fillRect(0, b.waterY, W, riverH);
    mirror.fillStyle = "rgba(150,195,215,0.16)";
    mirror.fillRect(0, b.waterY, W, 1);
  });
  return steps;
}

/** Ripple offset of a river row r px below the waterline (window px). */
export function rippleOffset(r: number, depth: number, t: number, wind: number): number {
  const d = clamp(r / Math.max(1, depth), 0, 1);
  const amp = (0.3 + 3.4 * d * Math.sqrt(d)) * (1 + 0.4 * wind);
  const q = Math.sqrt(Math.max(0, r));
  return amp * (0.65 * Math.sin(q * 3.1 - t * 1.5) + 0.35 * Math.sin(q * 1.3 + t * 0.8 + 1.3));
}
