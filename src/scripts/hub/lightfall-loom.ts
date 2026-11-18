// The mid window of the constellation hub scene: a loom of light (spec 3.3). Sixty-four warp
// hairlines run between two light beams; the tapestry is woven from reading progress and kept in
// a cached surface; reading knots sit on the left selvedge; the right-hand warps stay empty for
// the novels still on their way. Live parts: the weft fed in from the left, light along the
// beams, the shuttle and the beads it releases.

import { TAU, clamp, lerp } from "./world/geom";
import type { CardInfo, Surface } from "./world/types";
import { LOOM_COLS, LOOM_EMPTY, LOOM_ROWS, knotRadius, loomRows, tone } from "./lightfall-core";

const GOLD = "224,180,106";
const SHUTTLE_S = 1.1;
const BEAD_CAP = 6;

interface Bead {
  x: number;
  rgb: string;
  /** When the shuttle that released it set off. */
  at: number;
}

export interface Loom {
  /** Recomposes for a window canvas of w x h CSS px whose shell box spans [bx, bx + bw]. */
  layout(w: number, h: number, bx: number, bw: number, dpr: number, cards: readonly CardInfo[]): void;
  /** Where the weft is fed in from: the left ribbon's point beside the top beam, in window px. */
  feedFrom(x: number, y: number): void;
  /** Sends the shuttle across, releasing a bead of this accent (hex) or gold. */
  shuttle(accent: string | null, t: number): void;
  draw(g: CanvasRenderingContext2D, t: number, still: boolean): void;
  dispose(): void;
}

export function createLoom(create: (w: number, h: number) => Surface, release: (s: Surface) => void): Loom {
  let cache: Surface | null = null;
  let key = "";
  let rowsKey = "";
  let w = 0;
  let h = 0;
  let x0 = 0;
  let x1 = 0;
  let top = 0;
  let bottom = 0;
  let cellH = 0;
  let woven = 0;
  let shuttleAt = -Infinity;
  let feedX = 0;
  let feedY = Number.NaN;
  let shuttleRgb = GOLD;
  /** Accent of a crossing the next draw starts, after the weave grew. */
  let pending: string | null = null;
  const beads: Bead[] = [];

  const cross = (accent: string | null, t: number) => {
    shuttleRgb = accent ? tone(accent, 0.3, 1) : GOLD;
    shuttleAt = t;
  };

  const col = (i: number) => lerp(x0, x1, i / (LOOM_COLS - 1));
  const weaveY = () => bottom - woven * cellH;

  const paint = (s: Surface, dpr: number, cards: readonly CardInfo[]) => {
    const g = s.g;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    // Night-glass backing so the weave reads against the stars.
    const back = g.createLinearGradient(0, top - 18, 0, bottom + 18);
    back.addColorStop(0, "rgba(7,9,20,0)");
    back.addColorStop(0.18, "rgba(7,9,20,0.82)");
    back.addColorStop(0.82, "rgba(7,9,20,0.82)");
    back.addColorStop(1, "rgba(7,9,20,0)");
    g.fillStyle = back;
    g.fillRect(x0 - 30, top - 18, x1 - x0 + 60, bottom - top + 36);
    // Feathered at both ends as well, so the backing never shows a hard edge against the sky.
    const side = g.createLinearGradient(x0 - 30, 0, x1 + 30, 0);
    const k = Math.min(0.3, 60 / Math.max(1, x1 - x0 + 60));
    side.addColorStop(0, "rgba(0,0,0,0)");
    side.addColorStop(k, "#000");
    side.addColorStop(1 - k, "#000");
    side.addColorStop(1, "rgba(0,0,0,0)");
    g.globalCompositeOperation = "destination-in";
    g.fillStyle = side;
    g.fillRect(x0 - 30, top - 18, x1 - x0 + 60, bottom - top + 36);
    g.globalCompositeOperation = "source-over";

    // Warps: the woven share, then two empty sections for the upcoming novels.
    const empty = LOOM_COLS - 2 * LOOM_EMPTY;
    g.lineWidth = 0.7;
    for (let i = 0; i < LOOM_COLS; i++) {
      const x = Math.round(col(i)) + 0.5;
      const warp = g.createLinearGradient(0, top, 0, bottom);
      const a = i < empty ? 0.42 : 0.2;
      warp.addColorStop(0, `rgba(${GOLD},${a})`);
      warp.addColorStop(0.5, `rgba(${GOLD},${a * 0.6})`);
      warp.addColorStop(1, `rgba(${GOLD},${a})`);
      g.strokeStyle = warp;
      g.setLineDash(i < empty ? [] : [3, 4]);
      g.beginPath();
      g.moveTo(x, top);
      g.lineTo(x, bottom);
      g.stroke();
    }
    g.setLineDash([]);

    // The tapestry, derived from reading: each row three weft threads in its novel's accent toned
    // toward gold, passing over and under the warps.
    const rows = loomRows(cards, LOOM_ROWS);
    const cw = (x1 - x0) / (LOOM_COLS - 1);
    const pick = cellH / 3;
    const ph = Math.max(1, pick * 0.62);
    rows.forEach((row, r) => {
      // A float over the warp is a lit thread with a sheen along its crown; under the warp it sinks into shadow.
      const body = `rgba(${tone(row.accent, 0.62, 0.92)},0.9)`;
      const crown = `rgba(${tone(row.accent, 0.85, 1)},0.8)`;
      const sunk = `rgba(${tone(row.accent, 0.5, 0.7)},0.15)`;
      for (let k = 0; k < 3; k++) {
        const y = bottom - (r + 1) * cellH + k * pick + pick * 0.2;
        for (let c = 0; c < empty - 1; c++) {
          const x = col(c);
          if ((c + r + k) % 2 === 0) {
            g.fillStyle = body;
            g.fillRect(x - 0.3, y, cw + 0.6, ph);
            g.fillStyle = crown;
            g.fillRect(x + cw * 0.18, y + ph * 0.15, cw * 0.64, Math.max(0.6, ph * 0.32));
          } else {
            g.fillStyle = sunk;
            g.fillRect(x + 1.2, y + ph * 0.2, cw - 2.4, ph * 0.6);
          }
        }
      }
      g.fillStyle = "rgba(255,240,206,0.3)";
      g.fillRect(x0, bottom - (r + 1) * cellH + pick * 0.2, col(empty - 1) - x0, 0.6);
    });
    // The woven cloth gives off its own light: a blurred copy laid back over it.
    if (rows.length) {
      const wy = bottom - rows.length * cellH - 6;
      const ww = col(empty - 1) - x0 + 12;
      const wh = bottom - wy + 6;
      const blur = create(Math.max(1, (ww * dpr) / 6), Math.max(1, (wh * dpr) / 6));
      blur.g.imageSmoothingQuality = "high";
      blur.g.drawImage(s.canvas, (x0 - 6) * dpr, wy * dpr, ww * dpr, wh * dpr, 0, 0, blur.canvas.width, blur.canvas.height);
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.3;
      g.drawImage(blur.canvas, x0 - 6, wy, ww, wh);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      release(blur);
    }

    // Light beams over the loom, fading out before the gutters.
    for (const y of [top, bottom]) {
      const beam = g.createLinearGradient(x0 - 140, 0, x1 + 140, 0);
      beam.addColorStop(0, `rgba(${GOLD},0)`);
      beam.addColorStop(0.16, `rgba(${GOLD},0.8)`);
      beam.addColorStop(0.84, `rgba(${GOLD},0.8)`);
      beam.addColorStop(1, `rgba(${GOLD},0)`);
      g.fillStyle = beam;
      g.fillRect(x0 - 140, y - 0.75, x1 - x0 + 280, 1.5);
      g.globalAlpha = 0.16;
      g.fillRect(x0 - 140, y - 4, x1 - x0 + 280, 8);
      g.globalAlpha = 1;
    }
    // Heddle marks over the two empty sections.
    for (const s0 of [empty, empty + LOOM_EMPTY]) {
      g.strokeStyle = `rgba(${GOLD},0.5)`;
      g.beginPath();
      g.moveTo(col(s0) - 3, top + 7);
      g.lineTo(col(s0) - 3, top + 3);
      g.lineTo(col(s0 + LOOM_EMPTY - 1) + 3, top + 3);
      g.lineTo(col(s0 + LOOM_EMPTY - 1) + 3, top + 7);
      g.stroke();
    }

    // Reading knots on the left selvedge: one per open novel, a star once it is finished.
    const open = cards.filter((c) => c.kind === "open");
    open.forEach((c, i) => {
      const y = lerp(bottom - cellH, top + cellH, open.length > 1 ? i / (open.length - 1) : 0.5);
      const x = x0 - 14;
      const r = knotRadius(c.read);
      g.fillStyle = `rgba(${tone(c.accent, 0.6, 1)},${c.read ? 0.95 : 0.4})`;
      if (c.finished) {
        g.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU - Math.PI / 2;
          const rr = k % 2 ? r * 0.45 : r * 1.6;
          g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        g.fill();
      } else {
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      }
      g.strokeStyle = `rgba(${GOLD},0.35)`;
      g.beginPath();
      g.moveTo(x + r, y);
      g.lineTo(x0, y);
      g.stroke();
    });
  };

  return {
    layout(width, height, bx, bw, dpr, cards) {
      w = width;
      h = height;
      x0 = bx + bw * 0.1;
      x1 = bx + bw * 0.9;
      top = Math.round(h * 0.13);
      bottom = Math.round(Math.min(h * 0.66, h - 58));
      cellH = (bottom - top - 8) / LOOM_ROWS;
      const rows = loomRows(cards, LOOM_ROWS);
      const nextRows = rows.map((r) => r.slug).join();
      const k = `${Math.ceil(w * dpr)}x${Math.ceil(h * dpr)}:${bx}:${bw}:${nextRows}:${cards.map((c) => `${c.read}${c.finished}`).join()}`;
      if (rowsKey && nextRows !== rowsKey && rows.length > woven) pending = rows[rows.length - 1].accent;
      rowsKey = nextRows;
      woven = rows.length;
      if (k === key) return;
      key = k;
      if (!cache || cache.canvas.width !== Math.ceil(w * dpr) || cache.canvas.height !== Math.ceil(h * dpr)) {
        if (cache) release(cache);
        cache = create(w * dpr, h * dpr);
      }
      beads.length = 0;
      paint(cache, dpr, cards);
    },

    feedFrom(x, y) {
      feedX = x;
      feedY = y;
    },

    shuttle(accent, t) {
      cross(accent, t);
      if (beads.length >= BEAD_CAP) beads.shift();
      beads.push({ x: lerp(x0, x1, 0.15 + ((beads.length * 0.37) % 0.7)), rgb: shuttleRgb, at: t });
    },

    draw(g, t, still) {
      if (!cache || w <= 0) return;
      if (pending !== null) {
        cross(pending, t);
        pending = null;
      }
      g.drawImage(cache.canvas, 0, 0, w, h);
      const y = weaveY() - 2;
      // The weft fed in from the left ribbon as it falls past the loom.
      const fx = Number.isFinite(feedY) ? Math.min(feedX, x0 - 20) : 0;
      const fy = Number.isFinite(feedY) ? feedY : top + 4;
      const feed = g.createLinearGradient(fx, 0, x0, 0);
      feed.addColorStop(0, `rgba(${GOLD},0.1)`);
      feed.addColorStop(1, `rgba(255,226,160,0.85)`);
      g.strokeStyle = feed;
      g.lineCap = "round";
      for (let k = 0; k < 3; k++) {
        const wave = still ? 0 : Math.sin(t * 1.3 + k * 2.1) * 3;
        g.lineWidth = k === 0 ? 1.6 : 0.7;
        g.beginPath();
        g.moveTo(fx, fy + k * 5);
        g.bezierCurveTo(lerp(fx, x0, 0.45), fy + wave + k * 4, lerp(fx, x0, 0.7), y + wave, x0, y);
        g.stroke();
      }
      g.lineCap = "butt";
      if (!still) {
        // A light travelling along each beam.
        const run = ((t * 0.12) % 1.4) - 0.2;
        const bxPos = lerp(x0, x1, run);
        const glow = g.createRadialGradient(0, 0, 0, 0, 0, 40);
        glow.addColorStop(0, "rgba(255,236,196,0.55)");
        glow.addColorStop(1, "rgba(255,236,196,0)");
        g.fillStyle = glow;
        for (const by of [top, bottom]) {
          g.save();
          g.translate(bxPos, by);
          g.scale(1, 0.2);
          g.fillRect(-40, -40, 80, 80);
          g.restore();
        }
      }
      // The shuttle crossing the weaving line, leaving a fading weft.
      const p = clamp((t - shuttleAt) / SHUTTLE_S, 0, 1);
      if (!still && p < 1) {
        const sx = lerp(x0, x1, p);
        g.fillStyle = `rgba(${shuttleRgb},${0.55 * (1 - p * 0.5)})`;
        g.fillRect(x0, y - 0.8, sx - x0, 1.6);
        const glow = g.createRadialGradient(sx, y, 0, sx, y, 12);
        glow.addColorStop(0, "rgba(255,246,222,0.95)");
        glow.addColorStop(0.35, `rgba(${shuttleRgb},0.6)`);
        glow.addColorStop(1, `rgba(${shuttleRgb},0)`);
        g.fillStyle = glow;
        g.fillRect(sx - 12, y - 12, 24, 24);
      }
      // The weft the shuttle laid, and the beads it released resting on it with their glow.
      const laid = still ? beads : beads.filter((b) => t - b.at >= SHUTTLE_S);
      if (laid.length) {
        const last = laid[laid.length - 1].rgb;
        const weft = g.createLinearGradient(x0, 0, x1, 0);
        weft.addColorStop(0, `rgba(${last},0.5)`);
        weft.addColorStop(1, `rgba(${last},0.12)`);
        g.fillStyle = weft;
        g.fillRect(x0, y - 2.5, x1 - x0, 5);
      }
      for (const b of laid) {
        const glow = g.createRadialGradient(b.x, y, 0, b.x, y, 13);
        glow.addColorStop(0, "rgba(255,246,222,0.9)");
        glow.addColorStop(0.3, `rgba(${b.rgb},0.6)`);
        glow.addColorStop(1, `rgba(${b.rgb},0)`);
        g.fillStyle = glow;
        g.fillRect(b.x - 13, y - 13, 26, 26);
        g.fillStyle = `rgba(${b.rgb},0.95)`;
        g.beginPath();
        g.arc(b.x, y, 2.8, 0, TAU);
        g.fill();
      }
    },

    dispose() {
      if (cache) release(cache);
      cache = null;
      beads.length = 0;
    },
  };
}
