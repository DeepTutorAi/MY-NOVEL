// Drawing for the skyglass theme (spec 3.2): the sky plane, the far-city strips and
// every live layer and window set piece. Callers pass contexts and plain numbers;
// every offscreen canvas comes from the kit's surfaces ledger.

import { clamp, lerp } from "./world/geom";
import type { Surface } from "./world/types";
import {
  PAL,
  TAU,
  mix,
  ringPoint,
  rgba,
  sampleStops,
  spinOffset,
  type CityTower,
  type CityWindow,
  type Facade,
  type Mobile,
  type RGB,
  type Ring,
  type SkyStops,
} from "./skyglass-core";

type G = CanvasRenderingContext2D;
export type Create = (w: number, h: number) => Surface;

/* ------------------------------------------------------------------ shared sprites */

/** A soft round light: a radial gradient from `color` at `a` to transparent. */
export function glowSprite(create: Create, size: number, color: RGB, a: number, hard = 0): HTMLCanvasElement {
  const { canvas, g } = create(size, size);
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, rgba(color, a));
  if (hard > 0) grad.addColorStop(hard, rgba(color, a * 0.85));
  grad.addColorStop(0.45, rgba(color, a * 0.32));
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return canvas;
}

/** A 64x64 tile of faint noise so long gradients do not band. */
export function ditherTile(create: Create, rng: () => number): Surface {
  const s = create(64, 64);
  const image = s.g.createImageData(64, 64);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = rng() < 0.5 ? 0 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 3 + rng() * 3;
  }
  s.g.putImageData(image, 0, 0);
  return s;
}

/* ------------------------------------------------------------------ sky plane */

export interface SkyPaint {
  stops: SkyStops;
  /** Viewport y that stop position 1 maps to (the horizon line, or the viewport bottom for the still). */
  span: number;
  sunX: number;
  horizonY: number;
  /** 0..1 strength of the afterglow band low over the horizon. */
  warm: number;
}

/** Paints the sky into the half-resolution static plane (w x h backing, viewport W x H). */
export function paintSky(g: G, w: number, h: number, W: number, H: number, sky: SkyPaint, dither: CanvasPattern | null): void {
  g.setTransform(w / W, 0, 0, h / H, 0, 0);
  const { pos, rgb } = sky.stops;
  const end = pos[pos.length - 1] * sky.span;
  const grad = g.createLinearGradient(0, 0, 0, Math.max(1, end));
  pos.forEach((p, i) => grad.addColorStop(clamp(p / pos[pos.length - 1], 0, 1), rgba(rgb[i])));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  if (sky.warm > 0.01) {
    // A flattened ellipse, so the afterglow stays a band at the horizon instead of washing the hero.
    const r = W * 0.7;
    g.save();
    g.translate(sky.sunX, sky.horizonY);
    g.scale(1, 0.32);
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, r);
    glow.addColorStop(0, rgba(PAL.horizon, 0.3 * sky.warm));
    glow.addColorStop(0.45, rgba(PAL.rose, 0.1 * sky.warm));
    glow.addColorStop(1, rgba(PAL.rose, 0));
    g.fillStyle = glow;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
  }
  if (dither) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = dither;
    g.fillRect(0, 0, w, h);
  }
}

/* ------------------------------------------------------------------ far city strip */

/** Blue-hour and night keys per depth layer (far to near), with the haze each base fades into. */
const CITY_EARLY: readonly RGB[] = [hex3(0x2b3552), hex3(0x222b43), hex3(0x1a2133)];
const CITY_NIGHT: readonly RGB[] = [hex3(0x1a2238), hex3(0x151b2d), hex3(0x0f1421)];
const HAZE_EARLY = hex3(0x3a4462);
const HAZE_NIGHT = hex3(0x202942);

function hex3(n: number): RGB {
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * One layer of the far city into a strip surface, in the blue-hour or the night key. The two
 * nearer layers carry a sparse, steady scatter of dim lived-in windows; the reading-driven
 * windows are drawn brighter on top of it every frame.
 */
export function paintCityLayer(g: G, towers: readonly CityTower[], layer: 0 | 1 | 2, night: boolean, height: number): void {
  const body = (night ? CITY_NIGHT : CITY_EARLY)[layer];
  const haze = night ? HAZE_NIGHT : HAZE_EARLY;
  const edge = night ? mix(body, PAL.finEdge, 0.3) : mix(body, PAL.rose, 0.55);
  const shade = mix(body, PAL.finDusk, 0.4);
  for (const t of towers) {
    if (t.layer !== layer) continue;
    const fall = Math.min(height, t.top + 260);
    const grad = g.createLinearGradient(0, t.top, 0, fall);
    grad.addColorStop(0, rgba(body));
    grad.addColorStop(1, rgba(mix(body, haze, 0.35)));
    g.fillStyle = grad;
    const x = t.x;
    const w = t.w;
    const y = t.top;
    g.beginPath();
    if (t.crown === 1) {
      g.rect(x + w * 0.2, y, w * 0.6, 14);
      g.rect(x, y + 14, w, height - y - 14);
    } else if (t.crown === 2) {
      g.moveTo(x, y + Math.min(26, w * 0.6));
      g.lineTo(x + w, y);
      g.lineTo(x + w, height);
      g.lineTo(x, height);
    } else if (t.crown === 3) {
      g.moveTo(x, y + w * 0.5);
      g.arc(x + w / 2, y + w * 0.5, w / 2, Math.PI, 0);
      g.lineTo(x + w, height);
      g.lineTo(x, height);
    } else g.rect(x, y, w, height - y);
    g.fill();
    if (t.mast > 0) g.fillRect(x + w / 2 - 0.5, y - t.mast, 1, t.mast);
    const top = t.crown === 1 ? y + 14 : t.crown === 3 ? y + w * 0.5 : y;
    g.fillStyle = rgba(edge, (layer === 2 ? 0.5 : 0.32) * (night ? 0.6 : 1));
    g.fillRect(x + w - 1.5, top, 1.5, height - top);
    g.fillStyle = rgba(shade, 0.16);
    g.fillRect(x, top, Math.max(1, w * 0.18), height - top);
    if (layer > 0) {
      g.fillStyle = rgba(PAL.window, night ? 0.3 : 0.22);
      g.beginPath();
      for (let wy = top + 8; wy < Math.min(height - 6, top + 170); wy += 7) {
        for (let wx = x + 3; wx < x + w - 4; wx += 6) {
          if ((Math.imul(Math.round(wx) * 31 + Math.round(wy) * 17 + layer * 7, 2654435761) >>> 0) / 4294967296 < 0.08) g.rect(wx, wy, 2, 3);
        }
      }
      g.fill();
    }
  }
}

/** Lit far windows, batched into four alpha buckets. */
export function drawCityWindows(g: G, windows: readonly CityWindow[], alpha: (i: number) => number, y0: number, H: number, half: boolean): void {
  const buckets: CityWindow[][] = [[], [], [], []];
  for (const w of windows) {
    if (half && w.rank % 2) continue;
    const a = alpha(w.rank);
    if (a < 0.06) continue;
    const y = w.y + y0;
    if (y < -4 || y > H) continue;
    buckets[Math.min(3, Math.floor(a * 4))].push(w);
  }
  buckets.forEach((list, b) => {
    if (!list.length) return;
    if (b === 3) {
      // A soft bloom under the brightest bucket so the reading-lit windows read as glowing rooms.
      g.fillStyle = rgba(PAL.window, 0.14);
      g.beginPath();
      for (const w of list) g.rect(w.x - 1.5, w.y + y0 - 1.5, 5.5, 6.5);
      g.fill();
    }
    g.fillStyle = rgba(b === 3 ? hex3(0xf3d7b1) : PAL.window, 0.36 + b * 0.2);
    g.beginPath();
    for (const w of list) g.rect(w.x, w.y + y0, 2.5, 3.5);
    g.fill();
  });
}

/* ------------------------------------------------------------------ orbital ring */

export interface RingDraw {
  ring: Ring;
  dy: number;
  shadow: number;
  p: number;
  alpha: number;
  /** Lap position of the transit bead, 0..1, or -1 for none. */
  bead: number;
  /** True for points the ring must not be drawn at (covered or behind hero text). */
  hidden: (x: number, y: number) => boolean;
  W: number;
}

/** The ring: main band, a hairline 6 px inside, station modules and the transit bead. */
export function drawRing(g: G, d: RingDraw): void {
  const { ring, dy, W } = d;
  const west = ringPoint(ring, 0).x;
  const east = ringPoint(ring, 1).x;
  const cut = west + (east - west) * d.shadow;
  // Still in sunlight high above the night: warm at blue hour, pearl by night.
  const lit = mix(hex3(0xf2dcc0), PAL.ringLit, d.p);
  const grad = g.createLinearGradient(west, 0, east, 0);
  const span = Math.max(1, east - west);
  const b = clamp((cut - west) / span, 0, 1);
  grad.addColorStop(0, rgba(PAL.ringShadow, 0.85 * d.alpha));
  grad.addColorStop(Math.max(0, b - 0.015), rgba(PAL.ringShadow, 0.85 * d.alpha));
  grad.addColorStop(Math.min(1, b + 0.015), rgba(lit, 0.95 * d.alpha));
  grad.addColorStop(1, rgba(lit, 0.95 * d.alpha));
  g.lineCap = "round";
  const width = clamp(W / 560, 1.6, 3.4);
  const inner: Ring = { cx: ring.cx, cy: ring.cy, rx: ring.rx - 6, ry: ring.ry - 6 };
  const halo = rgba(lit, 0.07 * d.alpha);
  for (const [r, lw, a, style] of [
    [ring, width * 3.2, 1, halo],
    [ring, width, 1, grad],
    [inner, Math.max(0.7, width * 0.35), 0.55, grad],
  ] as const) {
    g.strokeStyle = style;
    g.globalAlpha = a;
    g.lineWidth = lw;
    g.beginPath();
    let open = false;
    for (let i = 0; i <= 160; i++) {
      const pt = ringPoint(r, i / 160);
      const y = pt.y + dy;
      if (pt.x < -30 || pt.x > W + 30 || d.hidden(pt.x, y)) {
        open = false;
        continue;
      }
      if (open) g.lineTo(pt.x, y);
      else g.moveTo(pt.x, y);
      open = true;
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  g.strokeStyle = grad;
  g.lineWidth = width * 1.9;
  g.lineCap = "butt";
  g.beginPath();
  for (let k = 1; k < 16; k++) {
    const a = k / 16;
    const p0 = ringPoint(ring, a - 0.004);
    const p1 = ringPoint(ring, a + 0.004);
    if (d.hidden(p0.x, p0.y + dy) || d.hidden(p1.x, p1.y + dy)) continue;
    g.moveTo(p0.x, p0.y + dy);
    g.lineTo(p1.x, p1.y + dy);
  }
  g.stroke();
  if (d.bead >= 0) {
    const q = ringPoint(ring, d.bead);
    if (!d.hidden(q.x, q.y + dy) && q.x > 0 && q.x < W) {
      g.fillStyle = rgba(PAL.sun, 0.9 * d.alpha * (d.bead > d.shadow ? 1 : 0.45));
      g.beginPath();
      g.arc(q.x, q.y + dy, width * 0.95, 0, TAU);
      g.fill();
    }
  }
}

/* ------------------------------------------------------------------ near facade */

export interface FacadeDraw {
  facade: Facade;
  /** Shared vertical glass gradient (0..H). */
  glass: CanvasGradient;
  dy: number;
  H: number;
  /** How strongly lit windows read (duskVis). */
  dusk: number;
  /** Sky phase: 0 blue hour, 1 night. */
  night: number;
  share: number;
  pointerY: number | null;
  glintY: number | null;
  glint: HTMLCanvasElement | null;
  shine: HTMLCanvasElement | null;
  W: number;
}

/** Vertical glass gradient: dark tinted glass reflecting the night sky, the afterglow caught near the horizon. */
export function glassGradient(g: G, sky: SkyStops, span: number, H: number, night: number): CanvasGradient {
  const tint = mix(PAL.finGlass, PAL.finDusk, 0.3 + 0.5 * night);
  const low = mix(PAL.finGlass, PAL.finDusk, 0.6 + 0.3 * night);
  const grad = g.createLinearGradient(0, 0, 0, H);
  const hz = clamp(span / H, 0.3, 0.98);
  grad.addColorStop(0, rgba(mix(sampleStops(sky, 0.1), tint, 0.55), 0.82));
  grad.addColorStop(hz * 0.55, rgba(mix(sampleStops(sky, 0.5), tint, 0.45), 0.76));
  grad.addColorStop(hz - 0.03, rgba(mix(sampleStops(sky, 0.97), tint, 0.3), 0.76));
  grad.addColorStop(Math.min(1, hz + 0.05), rgba(low, 0.86));
  grad.addColorStop(1, rgba(mix(low, PAL.plaza, 0.5), 0.92));
  return grad;
}

interface Edge {
  x: number;
  w: number;
  side: 1 | -1;
  y: number;
}

/** Afterglow-side highlight and shade-side line on every blade and tower. */
function edges(g: G, list: readonly Edge[], H: number, night: number): void {
  g.fillStyle = rgba(mix(PAL.pearl, PAL.horizon, 0.45 - 0.3 * night), 0.42 - 0.14 * night);
  for (const b of list) g.fillRect(b.side > 0 ? b.x + b.w - 1.5 : b.x, b.y, 1.5, H - b.y);
  g.fillStyle = rgba(PAL.finDusk, 0.35);
  for (const b of list) g.fillRect(b.side > 0 ? b.x : b.x + b.w - 1, b.y, 1, H - b.y);
}

/** Fins, towers with set-back crowns, the sky-bridge truss, floor lines, the pointer shine and the glint. */
export function drawFacade(g: G, d: FacadeDraw): void {
  const { facade, H, dy, dusk } = d;
  g.fillStyle = d.glass;
  for (const b of facade.blades) g.fillRect(b.x, 0, b.w, H);
  const towers = facade.towers;
  for (const t of towers) {
    const y = t.top + dy;
    g.fillRect(t.x, y, t.w, H - y);
    g.fillRect(t.x + t.w * 0.14, y - 26, t.w * 0.72, 26);
    g.fillRect(t.x + t.w * 0.3, y - 44, t.w * 0.4, 18);
    g.fillRect(t.x + t.w * 0.5 - 1, y - 92, 2, 48);
  }
  const floor = facade.floor;
  const off = ((dy % floor) + floor) % floor;
  g.fillStyle = rgba(PAL.finDusk, 0.1 + 0.3 * dusk);
  g.beginPath();
  for (const b of facade.blades) for (let y = off - floor; y < H; y += floor) g.rect(b.x, y, b.w, 2);
  for (const t of towers) {
    const y0 = t.top + dy;
    for (let y = Math.max(y0, off - 22); y < H; y += 22) if (y >= y0) g.rect(t.x, y, t.w, 2);
    for (let x = t.x + 12; x < t.x + t.w - 4; x += 14) g.rect(x, Math.max(0, y0), 1, H);
  }
  g.fill();
  g.fillStyle = rgba(PAL.pearl, 0.12);
  g.beginPath();
  for (const b of facade.blades) for (let y = off - floor; y < H; y += floor) g.rect(b.x, y - 1, b.w, 1);
  g.fill();
  if (towers.length) {
    // Three warm buckets (dim, lit, brightest) keyed by a hash, so the rooms do not read as one tile.
    const lit: [number, number][][] = [[], [], []];
    towers.forEach((t, ti) => {
      const y0 = t.top + dy;
      for (let row = 0, y = y0 + 6; y < H; row++, y += 22) {
        if (y < -22) continue;
        for (let col = 0, x = t.x + 3; x < t.x + t.w - 10; col++, x += 14) {
          const h = (Math.imul(row * 73 + col * 151 + ti * 997, 2654435761) >>> 0) / 4294967296;
          if (h < 0.12 + d.share * 0.5) lit[Math.floor((h * 977) % 3)].push([x, y]);
        }
      }
    });
    const tones: readonly RGB[] = [hex3(0xe9b98a), PAL.window, hex3(0xf3d7b1)];
    lit.forEach((list, k) => {
      if (!list.length) return;
      g.fillStyle = rgba(tones[k], [0.4, 0.62, 0.85][k] * dusk);
      g.beginPath();
      for (const [x, y] of list) g.rect(x, y, 10, 12);
      g.fill();
    });
  }
  if (facade.bridge) {
    const br = facade.bridge;
    const y = br.y + dy;
    if (y > -40 && y < H + 40) {
      g.fillStyle = d.glass;
      g.fillRect(br.x0, y, br.x1 - br.x0, 12);
      g.strokeStyle = rgba(PAL.finEdge, 0.7);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(br.x0, y + 20);
      g.lineTo(br.x1, y + 20);
      for (let x = br.x0, k = 0; x < br.x1; x += 14, k++) {
        g.moveTo(x, y + (k % 2 ? 12 : 20));
        g.lineTo(Math.min(br.x1, x + 14), y + (k % 2 ? 20 : 12));
      }
      g.stroke();
      g.fillStyle = rgba(PAL.window, 0.45);
      g.fillRect(br.x0, y, br.x1 - br.x0, 1);
    }
  }
  const all: Edge[] = [
    ...facade.blades.map((b) => ({ x: b.x, w: b.w, side: b.side, y: 0 })),
    ...towers.map((t) => ({ x: t.x, w: t.w, side: (t.x < d.W / 2 ? 1 : -1) as 1 | -1, y: Math.max(0, t.top + dy) })),
  ];
  edges(g, all, H, d.night);
  if (d.pointerY !== null && d.shine) for (const b of all) g.drawImage(d.shine, b.x, d.pointerY - 140, b.w, 280);
  if (d.glintY !== null && d.glint) {
    for (const b of all) g.drawImage(d.glint, b.x, d.glintY + (b.x - d.W / 2) * 0.32 - 60, b.w, 120);
  }
}

/** A vertical light band sprite (glint and pointer shine). */
export function bandSprite(create: Create, h: number, a: number): HTMLCanvasElement {
  const { canvas, g } = create(4, h);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, rgba(PAL.pearl, 0));
  grad.addColorStop(0.5, rgba(PAL.pearl, a));
  grad.addColorStop(1, rgba(PAL.pearl, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, h);
  return canvas;
}

/* ------------------------------------------------------------------ louvres */

/** Horizontal dark-glass slats over the viewport; closed 0 (open) to 1 (shut). */
export function drawLouvres(g: G, W: number, H: number, closed: number): void {
  if (closed <= 0.003) return;
  const pitch = H > 600 ? 26 : 20;
  const t = pitch * closed;
  const tilt = 1 - closed;
  for (let y = -pitch + ((H % pitch) / 2); y < H; y += pitch) {
    const grad = g.createLinearGradient(0, y, 0, y + t);
    grad.addColorStop(0, rgba(mix(PAL.finGlass, PAL.finEdge, 0.3), 0.95));
    grad.addColorStop(0.45, rgba(mix(PAL.finGlass, PAL.finDusk, 0.2 + tilt * 0.4), 0.95));
    grad.addColorStop(1, rgba(PAL.finDusk, 0.97));
    g.fillStyle = grad;
    g.fillRect(0, y, W, t);
    g.fillStyle = rgba(PAL.pearl, 0.1 * closed);
    g.fillRect(0, y, W, 1);
  }
}

/* ------------------------------------------------------------------ stage: the vane mobile */

export interface VaneInfo {
  tint: RGB;
  kind: "open" | "locked" | "upcoming";
  read: number;
}

export interface StageDraw {
  w: number;
  h: number;
  /** Shell left and right edges in canvas px (structure fades past them). */
  shellL: number;
  shellR: number;
  cx: number;
  top: number;
  radius: number;
  vaneW: number;
  vaneH: number;
  mobile: Mobile;
  vanes: readonly VaneInfo[];
  focus: number;
  focusAmt: number;
  dusk: number;
  phone: boolean;
  glow: HTMLCanvasElement;
}

function fadeX(g: G, w: number, l: number, r: number, color: RGB, a: number): CanvasGradient {
  const grad = g.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, rgba(color, 0));
  grad.addColorStop(clamp(l / w, 0.01, 0.49), rgba(color, a));
  grad.addColorStop(clamp(r / w, 0.51, 0.99), rgba(color, a));
  grad.addColorStop(1, rgba(color, 0));
  return grad;
}

/** The lobby seen through glass at night: curtain wall, lit floor, interior glow and the six-vane mobile of tinted glass. */
export function drawStage(g: G, d: StageDraw): void {
  const { w, h, mobile } = d;
  const floorY = h - 9;
  g.fillStyle = fadeX(g, w, d.shellL, d.shellR, mix(PAL.finGlass, PAL.finDusk, 0.5), 0.34);
  g.fillRect(0, 6, w, floorY - 6);
  const lamp = g.createLinearGradient(0, 6, 0, floorY);
  lamp.addColorStop(0, rgba(PAL.window, 0));
  lamp.addColorStop(1, rgba(PAL.window, 0.07));
  g.fillStyle = lamp;
  g.fillRect(0, 6, w, floorY - 6);
  g.fillStyle = rgba(PAL.window, 0.025);
  for (const [x, sw] of [
    [d.cx + d.radius * 1.4, d.radius * 0.5],
    [d.cx + d.radius * 2.3, d.radius * 0.28],
  ] as const) {
    g.beginPath();
    g.moveTo(x, 9);
    g.lineTo(x + sw, 9);
    g.lineTo(x + sw - h * 0.9, floorY);
    g.lineTo(x - h * 0.9, floorY);
    g.fill();
  }
  g.globalAlpha = 0.35 + 0.25 * d.dusk;
  g.drawImage(d.glow, d.cx - d.radius * 2.8, d.top - d.radius * 0.4, d.radius * 5.6, h * 1.25);
  g.globalAlpha = 1;
  // The sculpture's floor shadow: an ellipse that fades to nothing at its rim.
  g.save();
  g.translate(d.cx, floorY);
  g.scale(1, 0.2);
  const shadow = g.createRadialGradient(0, 0, 0, 0, 0, d.radius * 1.3);
  shadow.addColorStop(0, rgba(hex3(0x070a10), 0.4));
  shadow.addColorStop(1, rgba(hex3(0x070a10), 0));
  g.fillStyle = shadow;
  g.beginPath();
  g.arc(0, 0, d.radius * 1.3, 0, TAU);
  g.fill();
  g.restore();
  g.fillStyle = fadeX(g, w, d.shellL, d.shellR, PAL.pearl, 0.2);
  g.fillRect(0, 5, w, 1);
  g.fillRect(0, floorY, w, 1);
  const under = g.createLinearGradient(0, floorY + 1, 0, h);
  under.addColorStop(0, rgba(PAL.window, 0.08));
  under.addColorStop(1, rgba(PAL.window, 0));
  g.fillStyle = under;
  g.fillRect(0, floorY + 1, w, h - floorY - 1);
  g.fillStyle = fadeX(g, w, d.shellL, d.shellR, PAL.pearl, 0.05);
  const mullion = d.phone ? 72 : 120;
  const mid = (d.shellL + d.shellR) / 2;
  for (let x = mid - Math.ceil(mid / mullion) * mullion; x < w; x += mullion) g.fillRect(x, 9, 1, floorY - 9);
  // Atrium depth: a glass balustrade across the lobby.
  g.fillStyle = fadeX(g, w, d.shellL, d.shellR, PAL.pearl, 0.06);
  g.fillRect(0, Math.round(h * 0.7), w, 1);

  const order = mobile.vanes.map((v, i) => {
    const phi = mobile.theta + i * (TAU / 6);
    return { i, v, x: d.cx + d.radius * Math.sin(phi), z: Math.cos(phi) };
  });
  order.sort((a, b) => a.z - b.z);
  const hoopY = d.top + 6;
  const ry = d.radius * 0.16;
  g.lineWidth = 1;
  g.strokeStyle = rgba(PAL.pearl, 0.22);
  g.beginPath();
  g.moveTo(d.cx, 0);
  g.lineTo(d.cx, hoopY - ry);
  g.stroke();
  g.lineWidth = 1.5;
  g.strokeStyle = rgba(PAL.ringLit, 0.5);
  g.beginPath();
  g.ellipse(d.cx, hoopY, d.radius, ry, 0, 0, TAU);
  g.stroke();
  g.lineWidth = 1;
  for (const { i, v, x, z } of order) {
    if (d.phone && z < -0.4) continue;
    const info = d.vanes[i];
    if (!info) continue;
    const s = 0.8 + 0.2 * (z + 1) * 0.5;
    const psi = v.psi + spinOffset(v.spin);
    const c = Math.cos(psi);
    const vw = Math.max(1.5, Math.abs(d.vaneW * s * c));
    const vh = d.vaneH * s;
    const vx = x + v.sway * 0.25;
    const vy = hoopY + ry * z + 10 + (i % 3) * d.vaneH * 0.14;
    const depth = 0.5 + 0.5 * (z + 1) * 0.5;
    const left = vx - vw / 2;
    g.strokeStyle = rgba(PAL.pearl, 0.18 * depth);
    g.beginPath();
    g.moveTo(x, hoopY + ry * z);
    g.lineTo(vx, vy);
    g.stroke();
    const back = c < 0;
    let fill: RGB = info.tint;
    let a = (back ? 0.3 : 0.5) * depth;
    if (info.kind === "locked") {
      fill = mix(PAL.finGlass, PAL.pearl, 0.35);
      a = 0.5 * depth;
    } else if (info.kind === "upcoming") {
      fill = mix(PAL.finGlass, PAL.pearl, 0.25);
      a = 0.3 * depth;
    }
    // Soft shadow on the glass behind, then the tinted pane lit from above.
    g.fillStyle = rgba(hex3(0x070a10), 0.3 * depth);
    g.fillRect(left + 3, vy + 4, vw, vh);
    if (info.kind === "open" && info.read > 0) {
      g.globalAlpha = (0.3 + 0.5 * info.read) * depth;
      g.drawImage(d.glow, vx - vh * 0.75, vy - vh * 0.25, vh * 1.5, vh * 1.5);
      g.globalAlpha = 1;
    }
    const body = g.createLinearGradient(0, vy, 0, vy + vh);
    body.addColorStop(0, rgba(mix(fill, PAL.finGlass, 0.25), a));
    body.addColorStop(1, rgba(mix(fill, PAL.finDusk, back ? 0.65 : 0.5), a * 0.85));
    g.fillStyle = body;
    g.fillRect(left, vy, vw, vh);
    if (info.kind === "open" && info.read > 0) {
      g.fillStyle = rgba(PAL.window, (0.18 + 0.32 * d.dusk) * (0.35 + 0.65 * info.read) * depth);
      g.fillRect(left, vy, vw, vh);
      const fh = vh * Math.max(0.1, info.read);
      const lit = g.createLinearGradient(0, vy + vh - fh, 0, vy + vh);
      lit.addColorStop(0, rgba(PAL.window, 0.35 * depth));
      lit.addColorStop(1, rgba(hex3(0xffe4bd), 0.9 * depth));
      g.fillStyle = lit;
      g.fillRect(left, vy + vh - fh, vw, fh);
    }
    if (info.kind === "locked") {
      g.fillStyle = rgba(PAL.finDusk, 0.4 * depth);
      for (let fy = vy + 3; fy < vy + vh - 2; fy += 3) g.fillRect(left, fy, vw, 1);
    }
    if (info.kind === "upcoming") {
      g.strokeStyle = rgba(PAL.pearl, 0.16 * depth);
      g.beginPath();
      g.moveTo(left, vy + vh * 0.72);
      g.lineTo(left + vw, vy + vh * 0.3);
      g.stroke();
      g.fillStyle = rgba(PAL.pearl, 0.3 * depth);
      g.beginPath();
      g.moveTo(left + vw, vy);
      g.lineTo(left + vw - Math.min(vw, 9), vy);
      g.lineTo(left + vw, vy + 9);
      g.fill();
    }
    const spec = info.kind === "upcoming" ? 0 : Math.max(0, Math.cos(psi - 0.5)) ** 10;
    if (spec > 0.02) {
      g.fillStyle = rgba(PAL.sun, 0.5 * spec * depth);
      g.fillRect(left, vy + vh * 0.1, vw, vh * 0.2);
    }
    // Lit glass edges: the ring-side edge and the top catch the light; no dark outline.
    g.fillStyle = rgba(PAL.pearl, (back ? 0.25 : 0.6) * depth);
    g.fillRect(left + vw - 1, vy, 1, vh);
    g.fillStyle = rgba(PAL.pearl, (back ? 0.2 : 0.45) * depth);
    g.fillRect(left, vy, vw, 1);
    if (i === d.focus && d.focusAmt > 0.01 && info.kind !== "upcoming") {
      const k = d.focusAmt * c * c;
      const px = vx - d.radius * (0.55 + 0.9 * Math.sin(psi));
      g.globalAlpha = Math.min(1, k * 1.4);
      g.drawImage(d.glow, px - d.vaneW * 2.6, floorY - d.vaneW * 0.8, d.vaneW * 5.2, d.vaneW * 1.6);
      g.globalAlpha = 1;
    }
  }
}

/* ------------------------------------------------------------------ mid: the sky-bridge */

export interface MidDraw {
  h: number;
  x0: number;
  x1: number;
  y: number;
  tube: number;
  capsule: number;
  moving: boolean;
  upcoming: readonly RGB[];
  glow: HTMLCanvasElement;
  /** Sky phase: 0 blue hour, 1 night. */
  night: number;
}

/** Sky-bridge between two towers at blue hour, the ring framed above, two unlit towers rising behind, the capsule. */
export function drawMid(g: G, d: MidDraw): void {
  const { h, x0, x1, y, tube } = d;
  const span = x1 - x0;
  const tw = clamp(span * 0.09, 30, 90);
  const after = mix(PAL.rose, hex3(0xe2b99a), 0.35);
  const fade = 1 - 0.6 * d.night;
  // The faint afterglow between the towers, fading out to the sides and toward night.
  const veil = g.createLinearGradient(0, 0, 0, h);
  veil.addColorStop(0, rgba(after, 0));
  veil.addColorStop(0.45, rgba(mix(after, PAL.finGlass, 0.45), 0.3 * fade));
  veil.addColorStop(0.8, rgba(mix(after, PAL.finDusk, 0.6), 0.22 * fade));
  veil.addColorStop(1, rgba(after, 0));
  g.fillStyle = veil;
  g.fillRect(x0 - tw * 3, 0, span + tw * 6, h);
  g.globalCompositeOperation = "destination-out";
  for (const [ex, dir] of [
    [x0 - tw * 3, 1],
    [x1 + tw * 3, -1],
  ] as const) {
    const edge = g.createLinearGradient(ex, 0, ex + dir * tw * 4, 0);
    edge.addColorStop(0, "rgba(0,0,0,1)");
    edge.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = edge;
    g.fillRect(Math.min(ex, ex + dir * tw * 4), 0, tw * 4, h);
  }
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 0.5;
  g.drawImage(d.glow, x0 + span * 0.1, y - tube * 3.2, span * 0.8, tube * 6.4);
  g.globalAlpha = 1;
  g.strokeStyle = rgba(PAL.ringLit, 0.7);
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(x0 - tw * 1.4, h * 0.2);
  g.quadraticCurveTo((x0 + x1) / 2, -h * 0.06, x1 + tw * 1.4, h * 0.2);
  g.stroke();
  d.upcoming.forEach((tint, k) => {
    const cx = x0 + span * (k ? 0.68 : 0.32);
    const bw = clamp(span * 0.07, 20, 60);
    const top = h * (k ? 0.3 : 0.18);
    g.fillStyle = rgba(mix(PAL.finGlass, tint, 0.1), 0.7);
    g.fillRect(cx - bw / 2, top + h * 0.22, bw, h * 0.92 - top - h * 0.22);
    g.strokeStyle = rgba(PAL.pearl, 0.12);
    g.lineWidth = 1;
    g.beginPath();
    for (let gy = top; gy < h * 0.92; gy += 7) {
      g.moveTo(cx - bw / 2, gy);
      g.lineTo(cx + bw / 2, gy);
    }
    for (let gx = cx - bw / 2; gx <= cx + bw / 2 + 0.5; gx += bw / 4) {
      g.moveTo(gx, top);
      g.lineTo(gx, h * 0.92);
    }
    g.moveTo(cx + bw / 2 - 4, top);
    g.lineTo(cx + bw / 2 - 4, top - h * 0.12);
    g.lineTo(cx - bw * 1.2, top - h * 0.12);
    g.stroke();
  });
  for (const tx of [x0 - tw, x1]) {
    const lit = tx > x0;
    // Tower body with a two-step set-back crown; the base runs on into the city below.
    const crown = h * 0.08;
    const body = g.createLinearGradient(0, crown, 0, h);
    body.addColorStop(0, rgba(PAL.finDusk, 0.9));
    body.addColorStop(1, rgba(PAL.finDusk, 0.96));
    g.fillStyle = body;
    g.fillRect(tx, crown, tw, h - crown);
    g.fillRect(tx + tw * 0.14, crown - 12, tw * 0.72, 12);
    g.fillRect(tx + tw * 0.32, crown - 20, tw * 0.36, 8);
    const face = g.createLinearGradient(tx, 0, tx + tw, 0);
    face.addColorStop(0, rgba(after, lit ? 0.02 : 0.12));
    face.addColorStop(1, rgba(after, lit ? 0.14 : 0.02));
    g.fillStyle = face;
    g.fillRect(tx, crown, tw, h - crown);
    g.fillStyle = rgba(PAL.finEdge, 0.08);
    for (let fy = crown + 6; fy < h; fy += 8) g.fillRect(tx, fy, tw, 1);
    g.fillStyle = rgba(PAL.window, 0.62);
    for (let fy = crown + 10, k = 0; fy < h - 4; fy += 8, k++) if ((k * 7 + (lit ? 3 : 0)) % 6 === 0) g.fillRect(tx + 3, fy, tw - 6, 2);
    g.fillStyle = rgba(mix(PAL.pearl, after, 0.4), 0.4);
    g.fillRect(lit ? tx : tx + tw - 1, crown, 1, h - crown);
  }
  const ty = y - tube / 2;
  const glass = g.createLinearGradient(0, ty, 0, ty + tube);
  glass.addColorStop(0, rgba(mix(PAL.pearl, PAL.finGlass, 0.5), 0.34));
  glass.addColorStop(0.35, rgba(PAL.finGlass, 0.42));
  glass.addColorStop(1, rgba(PAL.finDusk, 0.75));
  g.fillStyle = glass;
  g.beginPath();
  g.roundRect(x0, ty, span, tube, tube / 2);
  g.fill();
  g.fillStyle = rgba(PAL.pearl, 0.5);
  g.fillRect(x0 + tube / 2, ty + 1.5, span - tube, 1);
  g.fillStyle = rgba(PAL.window, 0.45);
  g.fillRect(x0 + tube / 2, y + tube * 0.2, span - tube, 1.2);
  g.strokeStyle = rgba(PAL.finDusk, 0.5);
  g.lineWidth = 1;
  g.beginPath();
  for (let x = x0 + tube; x < x1 - tube * 0.6; x += 34) {
    g.moveTo(x, ty + 3);
    g.lineTo(x, ty + tube - 2);
  }
  g.stroke();
  g.strokeStyle = rgba(PAL.finEdge, 0.35);
  g.beginPath();
  g.moveTo(x0 + tube * 0.3, ty + tube + 7);
  g.lineTo(x1 - tube * 0.3, ty + tube + 7);
  for (let x = x0 + tube * 0.3, k = 0; x < x1 - tube * 0.3; x += 22, k++) {
    g.moveTo(x, ty + tube + (k % 2 ? 0 : 7));
    g.lineTo(Math.min(x1 - tube * 0.3, x + 22), ty + tube + (k % 2 ? 7 : 0));
  }
  g.stroke();
  const cw = clamp(span * 0.1, 40, 90);
  const ch = tube * 0.62;
  const cx = lerp(x0 + tube * 0.4 + cw / 2, x1 - tube * 0.4 - cw / 2, d.capsule);
  if (d.moving) {
    const sweep = g.createLinearGradient(cx - cw * 2.5, 0, cx + cw * 2.5, 0);
    sweep.addColorStop(0, rgba(PAL.pearl, 0));
    sweep.addColorStop(0.5, rgba(PAL.pearl, 0.35));
    sweep.addColorStop(1, rgba(PAL.pearl, 0));
    g.fillStyle = sweep;
    g.fillRect(cx - cw * 2.5, ty + 1, cw * 5, tube * 0.32);
  }
  g.globalAlpha = 0.3;
  g.drawImage(d.glow, cx - cw, y - ch * 1.6, cw * 2, ch * 3.2);
  g.globalAlpha = 1;
  g.fillStyle = rgba(PAL.ringLit, 0.92);
  g.beginPath();
  g.roundRect(cx - cw / 2, y - ch / 2, cw, ch, ch / 2);
  g.fill();
  // A row of warm cabin windows.
  g.fillStyle = rgba(PAL.window, 0.95);
  const dot = Math.max(2, ch * 0.22);
  for (let k = 0; k < 4; k++) g.fillRect(cx - cw * 0.3 + (k * cw * 0.6) / 3 - dot / 2, y - dot / 2, dot, dot);
}

/* ------------------------------------------------------------------ ground: plaza and pool */

export interface GroundDraw {
  w: number;
  h: number;
  edge: number;
  /** The pool in window px; h 0 when the footer leaves no room for it. */
  pool: { x: number; y: number; w: number; h: number };
  src: HTMLCanvasElement | null;
  ripple: number;
  t: number;
}

/** Dark stone plaza of large pavers and a still, dark pool mirroring the night. */
export function drawGround(g: G, d: GroundDraw): void {
  const { w, h, edge } = d;
  const stone = g.createLinearGradient(0, edge, 0, h);
  stone.addColorStop(0, rgba(hex3(0x1c2230)));
  stone.addColorStop(0.35, rgba(PAL.plaza));
  stone.addColorStop(1, rgba(hex3(0x0b0f15)));
  g.fillStyle = stone;
  g.fillRect(0, edge, w, h - edge);
  g.fillStyle = rgba(PAL.pearl, 0.14);
  g.fillRect(0, edge, w, 1);
  // Large pavers: three irregular courses with offset joints, barely visible.
  g.fillStyle = rgba(PAL.pearl, 0.025);
  g.beginPath();
  let prev = edge;
  [0.22, 0.47, 0.78].forEach((f, k) => {
    const y = Math.round(edge + (h - edge) * f);
    g.rect(0, y, w, 1);
    for (let x = 40 + (k % 2) * 95; x < w; x += 190) g.rect(Math.round(x), prev, 1, y - prev);
    prev = y;
  });
  g.fill();
  const p = d.pool;
  if (!d.src || p.w <= 0 || p.h <= 0) return;
  // Fine horizontal rows shifted by a slow sine read as water, not as blocks.
  const rows = d.ripple > 0 ? Math.min(24, Math.ceil(p.h / 3)) : 1;
  const sh = d.src.height / rows;
  for (let k = 0; k < rows; k++) {
    const dx = d.ripple * Math.sin(d.t * 0.7 + k * 0.55);
    g.drawImage(d.src, 0, k * sh, d.src.width, sh, p.x + dx, p.y + (k * p.h) / rows, p.w, p.h / rows + 0.5);
  }
  g.fillStyle = fadeX(g, w, p.x + p.w * 0.2, p.x + p.w * 0.8, PAL.pearl, 0.15);
  g.fillRect(p.x, p.y, p.w, 1);
}

/** The pool's reflection: the low night sky, dark tower reflections fading with depth, warm window streaks; an elliptical rim. */
export function paintPool(s: Surface, sky: SkyStops, towers: readonly CityTower[], skyline: number, x0: number, share: number, dusk: number, rng: () => number): void {
  const { canvas, g } = s;
  const w = canvas.width;
  const h = canvas.height;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "source-over";
  g.clearRect(0, 0, w, h);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, rgba(mix(sampleStops(sky, 0.95), PAL.plaza, 0.45)));
  grad.addColorStop(0.4, rgba(mix(sampleStops(sky, 0.6), PAL.plaza, 0.6)));
  grad.addColorStop(1, rgba(PAL.plaza));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  let tallest = 1;
  for (const t of towers) if (t.layer > 0) tallest = Math.max(tallest, skyline + 40 - t.top);
  const reflect = mix(CITY_NIGHT[2], PAL.plaza, 0.2);
  for (const t of towers) {
    if (t.layer === 0 || t.x + t.w < x0 || t.x > x0 + w) continue;
    const depth = ((skyline + 40 - t.top) / tallest) * h * 0.6;
    const fall = g.createLinearGradient(0, 0, 0, depth);
    fall.addColorStop(0, rgba(reflect, t.layer === 2 ? 0.5 : 0.3));
    fall.addColorStop(1, rgba(reflect, 0));
    g.fillStyle = fall;
    g.fillRect(t.x - x0, 0, t.w, depth);
    if (rng() < 0.25 + 0.6 * share) {
      const len = h * (0.2 + rng() * 0.35);
      const streak = g.createLinearGradient(0, 0, 0, len);
      streak.addColorStop(0, rgba(PAL.window, 0.45 * dusk));
      streak.addColorStop(1, rgba(PAL.window, 0));
      g.fillStyle = streak;
      g.fillRect(t.x - x0 + t.w * (0.2 + rng() * 0.6), 0, 1.5, len);
    }
  }
  g.globalCompositeOperation = "destination-in";
  g.save();
  g.translate(w / 2, 0);
  g.scale(w / 2 / Math.max(1, h), 1);
  const rim = g.createRadialGradient(0, 0, 0, 0, 0, h);
  rim.addColorStop(0, "rgba(0,0,0,1)");
  rim.addColorStop(0.72, "rgba(0,0,0,1)");
  rim.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = rim;
  g.fillRect(-h, 0, h * 2, h);
  g.restore();
  g.globalCompositeOperation = "source-over";
}
