// Lamphu tree geometry and painting for the firefly hub scene: a branching skeleton, leaf
// pads on its tips, weeping strands and the perches fireflies settle on, then a staged
// painter that draws a crown through three scratch surfaces into the plane canvases.
// Imports cleanly in Node: painters only receive contexts, nothing touches the DOM.

import { createNoise2D, createRng, fbm2D } from "../_shared/scene-runtime";
import type { Surface } from "./scene-paint";

const TAU = Math.PI * 2;
const LOBE_STEPS = 256;

export interface CrownSpec {
  /** Crown envelope in plane px. The outline is widest at `belly` (0..1 from top to bottom). */
  x0: number;
  x1: number;
  top: number;
  bottom: number;
  belly: number;
  baseX: number;
  baseY: number;
  forkX: number;
  forkY: number;
  /** Near trees are near-black; others stand further back in a lighter, bluer value. */
  near: boolean;
  /** A rooted tree has a trunk to the water with roots and breathing roots; others hang from a limb. */
  rooted: boolean;
  seed: number;
  fireflyShare: number;
  /** Number of weeping branch clusters. */
  sprays: number;
  /** Lobe depth of the crown outline (default 0.21); higher reads more ragged. */
  ragged?: number;
  /** Multiplier on the leaf-tuft count (default 1), for a small crown that must read as a full mass. */
  density?: number;
}

/** The slice of the scene layout that tree geometry depends on. */
export interface TreeEnv {
  width: number;
  /** Plane height: perches below it are not visible at any scroll position. */
  height: number;
  waterY: number;
  moonX: number;
  moonY: number;
  /** Size scale relative to a 900 px short side. */
  scale: number;
  /** Real gutters from the page model: perches there are weighted up (they are seen beside the cards). */
  gutterL: number;
  gutterR: number;
  /** Horizontal and top overscan of the planes. */
  side: number;
  top: number;
}

/** A limb as (x, y, width) triples from base to tip. */
export interface Branch {
  pts: number[];
}

/** A tuft of leaves: an ellipse that the painter fills with drooping leaves. */
export interface Pad {
  x: number;
  y: number;
  rx: number;
  ry: number;
  /** 0 inside the crown, 1 on its outline. */
  shell: number;
  density: number;
  front: boolean;
  /** Leaf length in CSS px. */
  leaf: number;
  seed: number;
}

/** A weeping twig: a quadratic curve with leaves hanging along it. */
export interface Strand {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  leaf: number;
  seed: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TreeGeom {
  spec: CrownSpec;
  cx: number;
  bellyY: number;
  trunkW: number;
  trunk: Branch;
  roots: Branch[];
  branches: Branch[];
  pads: Pad[];
  strands: Strand[];
  /** Pneumatophore spikes as flat (x, y, height, width) quadruples. */
  spikes: number[];
  perches: Float32Array;
  perchEdge: Float32Array;
  /** Cumulative perch weights (normalised to 1) for weighted picks. */
  perchCdf: Float32Array;
  /** Crown, strands and fork: what the painter draws through its scratch surfaces. */
  box: Box;
  /** Trunk, roots and breathing roots of a rooted tree, drawn straight into the planes. */
  trunkBox: Box | null;
  /** Unit vector from the crown centre toward the moon. */
  lightX: number;
  lightY: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Index of the first cumulative weight >= u. */
export function pickWeighted(cdf: Float32Array, u: number): number {
  let lo = 0;
  let hi = cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Whether a plane x lies in a visible gutter (beside the cards). */
export function inGutter(env: Pick<TreeEnv, "width" | "gutterL" | "gutterR">, x: number): boolean {
  return x < env.gutterL || x > env.width - env.gutterR;
}

interface RawBranch {
  pts: number[];
  parent: number;
  /** Point index on the parent where this branch starts. */
  at: number;
  depth: number;
  load: number;
  children: number[];
}

interface Pending {
  x: number;
  y: number;
  ang: number;
  depth: number;
  parent: number;
  at: number;
  /** Maximum outline radius this limb may reach. */
  limit: number;
  /** Segment budget. */
  segs: number;
  /** Goal point for primary limbs, otherwise NaN. */
  gx: number;
  gy: number;
}

function turnToward(ang: number, target: number, k: number): number {
  let d = target - ang;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return ang + d * k;
}

/** Trunk and roots are sampled from quadratic curves into the same triple format as limbs. */
function sampleCurve(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, width: (t: number) => number, steps = 10): Branch {
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push(mt * mt * x0 + 2 * mt * t * cx + t * t * x1, mt * mt * y0 + 2 * mt * t * cy + t * t * y1, width(t));
  }
  return { pts };
}

function boundsOf(pts: number[], pad: number): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 3) {
    const w = pts[i + 2];
    x0 = Math.min(x0, pts[i] - w);
    x1 = Math.max(x1, pts[i] + w);
    y0 = Math.min(y0, pts[i + 1] - w);
    y1 = Math.max(y1, pts[i + 1] + w);
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

export function unionBox(a: Box | null, b: Box | null): Box | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

export function buildTree(spec: CrownSpec, L: TreeEnv): TreeGeom {
  const rng = createRng(spec.seed * 7919 + 13);
  const noise = createNoise2D(spec.seed);
  const s = L.scale;
  const W = L.width;
  const cx = (spec.x0 + spec.x1) / 2;
  const rx = (spec.x1 - spec.x0) / 2;
  const crownH = spec.bottom - spec.top;
  const yb = spec.top + spec.belly * crownH;
  const hu = yb - spec.top;
  const hd = spec.bottom - yb;
  const size = Math.min(rx, crownH * 0.8);
  // The lobes depend on the angle alone, so they are sampled once into a periodic
  // table; the outline is evaluated tens of thousands of times per crown.
  const lobes = new Float32Array(LOBE_STEPS + 1);
  for (let k = 0; k < LOBE_STEPS; k++) {
    const theta = (k / LOBE_STEPS) * TAU - Math.PI;
    lobes[k] = 1 + (spec.ragged ?? 0.21) * fbm2D(noise, Math.cos(theta) * 1.7 + spec.seed * 0.37, Math.sin(theta) * 1.7, 3);
  }
  lobes[LOBE_STEPS] = lobes[0];
  const lobeAt = (theta: number) => {
    const t = ((theta + Math.PI) / TAU) * LOBE_STEPS;
    const k = Math.min(LOBE_STEPS - 1, Math.max(0, Math.floor(t)));
    return lobes[k] + (lobes[k + 1] - lobes[k]) * (t - k);
  };
  // 0 at the crown's centre, 1 on the lobed outline. The dome and the shallow
  // underside meet at the widest point, so the outline always closes.
  const outline = (x: number, y: number): number => {
    const u = (x - cx) / rx;
    const above = y < yb;
    const w = above ? (yb - y) / hu : (y - yb) / hd;
    const p = above ? 2.05 : 1.85;
    const r = Math.pow(Math.pow(Math.abs(u), p) + Math.pow(Math.abs(w), p), 1 / p);
    return r / lobeAt(Math.atan2(above ? -w : w, u));
  };

  const trunkW = Math.max(3 * s, size * (spec.near ? 0.085 : 0.075)) * (spec.rooted ? 1 : 0.62);
  const tipW = Math.max(0.8, 1.3 * s * (spec.near ? 1 : 0.7));
  const fx = spec.forkX;
  const fy = spec.forkY;
  const lean = fx - spec.baseX;
  let trunk: Branch;
  if (spec.rooted) {
    // A standing trunk: tapers about 2.2:1 from the root flare to the fork, bows toward the
    // canal and bends gently along its length, so it never reads as a straight post.
    const len = Math.hypot(fx - spec.baseX, fy - spec.baseY);
    const steps = clamp(Math.ceil(len / 24), 18, 140);
    const gutter = spec.baseX < W / 2 ? L.gutterL : L.gutterR;
    const toward = Math.sign(lean || (spec.baseX < W / 2 ? 1 : -1));
    const amp = Math.min(0.08 * gutter, 16 * s, trunkW * 1.2);
    const bow = toward * Math.min(0.12 * gutter, 28 * s);
    const cycles = Math.max(1, len / (900 * Math.max(0.6, s)));
    const phase = rng() * TAU;
    const pts: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const env = Math.sqrt(Math.sin(Math.PI * t));
      const x = lerp(spec.baseX, fx, t) + bow * Math.sin(Math.PI * t) + amp * env * Math.sin(TAU * cycles * t + phase);
      pts.push(x, lerp(spec.baseY, fy, t), trunkW * (1.3 - 0.72 * t) + trunkW * 1.1 * Math.pow(1 - t, 10));
    }
    trunk = { pts };
  } else {
    trunk = sampleCurve(
      spec.baseX, spec.baseY,
      spec.baseX + lean * 0.15 - trunkW * 0.6 * Math.sign(lean || 1), lerp(spec.baseY, fy, 0.55),
      fx, fy,
      (t) => trunkW * (0.95 + 0.25 * Math.pow(1 - t, 3.5)),
      8,
    );
  }

  // Skeleton: limbs are grown breadth-first so every primary limb exists before
  // secondaries compete for the tip budget. Primaries head for goals spread
  // around the crown; later generations wander outward and sag.
  const raw: RawBranch[] = [];
  const queue: Pending[] = [];
  const tipBudget = spec.near ? (spec.rooted ? 150 : 90) : 60;
  const primaries = spec.near ? (spec.rooted ? 6 : 4) : 4;
  for (let k = 0; k < primaries; k++) {
    // Goals sweep from the crown's left flank over the top to its right flank.
    const f = (k + 0.5 + (rng() - 0.5) * 0.4) / primaries;
    const th = Math.PI * (1 + f * 1.0);
    const reachF = 0.62 + rng() * 0.22;
    const gx = cx + Math.cos(th) * rx * reachF;
    const gy = yb + Math.sin(th) * hu * reachF;
    queue.push({
      x: fx, y: fy, ang: Math.atan2(gy - fy, gx - fx) + (rng() - 0.5) * 0.5, depth: 0, parent: -1, at: 0,
      limit: 0.98, segs: Math.round(lerp(8, 12, rng())), gx, gy,
    });
  }
  let tips = primaries;
  const segLen = size * (spec.near ? 0.075 : 0.085);
  for (let q = 0; q < queue.length && raw.length < 400; q++) {
    const p = queue[q];
    const pts: number[] = [p.x, p.y, 0];
    let x = p.x;
    let y = p.y;
    let ang = p.ang;
    const children: number[] = [];
    const idx = raw.length;
    const sideSign = rng() < 0.5 ? -1 : 1;
    for (let k = 1; k <= p.segs; k++) {
      const seg = segLen * (p.depth === 0 ? 1.15 : lerp(0.95, 0.6, Math.min(1, p.depth / 4))) * (0.85 + rng() * 0.3);
      if (Number.isFinite(p.gx)) {
        const want = Math.atan2(p.gy - y, p.gx - x);
        ang = turnToward(ang, want, 0.22);
        if (Math.hypot(p.gx - x, p.gy - y) < seg) break;
      } else if (p.depth >= 2) {
        ang = turnToward(ang, Math.PI / 2, 0.06 + p.depth * 0.015);
      } else {
        ang = turnToward(ang, -Math.PI / 2, 0.04);
      }
      ang += (rng() - 0.5) * (p.depth === 0 ? 0.32 : 0.55);
      const nx = x + Math.cos(ang) * seg;
      const ny = y + Math.sin(ang) * seg - (p.depth === 0 ? seg * 0.08 : 0);
      if (outline(nx, ny) > p.limit) break;
      x = nx;
      y = ny;
      pts.push(x, y, 0);
      if (p.depth < 4 && k >= 2 && k < p.segs && tips < tipBudget && rng() < (p.depth === 0 ? 0.55 : p.depth === 1 ? 0.42 : 0.3)) {
        tips++;
        const dev = (0.55 + rng() * 0.6) * sideSign * (children.length % 2 === 0 ? 1 : -1);
        const childIdx = queue.length;
        queue.push({
          x, y, ang: ang + dev, depth: p.depth + 1, parent: idx, at: pts.length / 3 - 1,
          limit: clamp(p.limit + (rng() - 0.5) * 0.06, 0.7, 1.02), segs: Math.round(lerp(3, 7, rng()) * (p.depth >= 2 ? 0.75 : 1)),
          gx: Number.NaN, gy: Number.NaN,
        });
        children.push(childIdx);
      }
    }
    raw.push({ pts, parent: p.parent, at: p.at, depth: p.depth, load: 0, children });
  }
  // Pending indices equal raw indices because both grow in queue order.
  for (let b = raw.length - 1; b >= 0; b--) {
    const br = raw[b];
    br.load = 1;
    for (const c of br.children) if (raw[c]) br.load += raw[c].load;
  }
  const totalLoad = raw.reduce((a, b) => a + (b.parent < 0 ? b.load : 0), 0) || 1;
  // Limbs keep visible thickness down to the tufts, so the crown hangs from the trunk.
  const widthOf = (load: number) => tipW + (trunkW * (spec.rooted ? 0.62 : 0.78) - tipW) * Math.pow(load / totalLoad, 0.4);
  for (const br of raw) {
    const n = br.pts.length / 3;
    let acc = 1;
    for (let k = n - 1; k >= 0; k--) {
      for (const c of br.children) if (raw[c] && raw[c].at === k) acc += raw[c].load;
      br.pts[k * 3 + 2] = widthOf(acc);
    }
  }
  const branches: Branch[] = raw.filter((b) => b.pts.length >= 6).map((b) => ({ pts: b.pts }));

  const roots: Branch[] = [];
  const spikes: number[] = [];
  if (spec.rooted) {
    for (let k = 0; k < 5; k++) {
      const side = k % 2 === 0 ? -1 : 1;
      const reach = trunkW * (0.9 + rng() * 1.3);
      const y0 = spec.baseY - trunkW * (0.6 + rng() * 0.9);
      const w0 = trunkW * (0.4 + rng() * 0.2);
      const w1 = Math.max(1, trunkW * 0.08);
      roots.push(sampleCurve(
        spec.baseX + side * trunkW * 0.2, y0,
        spec.baseX + side * reach * 0.55, y0 + trunkW * 0.3,
        spec.baseX + side * reach, spec.baseY + (rng() * 2 + 1) * s,
        (t) => lerp(w0, w1, t), 6,
      ));
    }
    const spikeSpan = Math.min(size * 0.32, 90 * s);
    for (let n = 0; n < (spec.near ? 50 : 18); n++) {
      const d = (rng() - 0.5) * 2;
      spikes.push(
        spec.baseX + d * spikeSpan,
        spec.baseY + (rng() - 0.2) * 5 * s,
        (2.5 + rng() * 9 * (1 - Math.abs(d) * 0.7)) * s,
        (0.7 + rng() * 1.1) * s,
      );
    }
  }

  // Leaf pads: on every branch tip, along outer limbs, plus fillers so the
  // interior reads as leaf mass and the outline stays ragged. A few overhang.
  const pads: Pad[] = [];
  const minX = -L.side - size * 0.1;
  const maxX = W + L.side + size * 0.1;
  const minY = -L.top - size * 0.1;
  const minLeaf = (spec.near ? 3.4 : 2.3) * s;
  const maxLeaf = (spec.near ? 14 : 6.5) * s;
  // Pads are binned by position so the spacing test visits neighbours only. A bin
  // is wider than the largest spacing radius (0.19 size), so the 3x3 block around
  // a candidate holds every pad it could clash with.
  const bin = Math.max(1, size * 0.2);
  const bins = new Map<number, Pad[]>();
  const binKey = (bx: number, by: number) => bx * 65536 + by;
  const addPad = (x: number, y: number, force = false, n = outline(x, y)): boolean => {
    if (x < minX || x > maxX || y < minY) return false;
    if (n > 1.12 || (n > 1 && rng() > 0.18)) return false;
    const shell = smooth(0.35, 0.98, n);
    const r = size * lerp(0.155, 0.08, shell) * (0.75 + rng() * 0.5);
    const bx = Math.floor(x / bin);
    const by = Math.floor(y / bin);
    if (!force) {
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const near = bins.get(binKey(bx + i, by + j));
          if (!near) continue;
          for (const o of near) {
            const dx = o.x - x;
            const dy = (o.y - y) * 1.2;
            const lim = (o.rx + r) * 0.5;
            if (dx * dx + dy * dy < lim * lim) return false;
          }
        }
      }
    }
    const front = shell > 0.38 || rng() < 0.22;
    const pad: Pad = {
      x, y, rx: r, ry: r * (0.5 + rng() * 0.2), shell,
      density: lerp(1, 0.62, shell) * (0.8 + rng() * 0.4) * (front ? 1 : 0.85),
      front, leaf: clamp(r * 0.27, minLeaf, maxLeaf), seed: Math.floor(rng() * 1e9),
    };
    pads.push(pad);
    const key = binKey(bx, by);
    const list = bins.get(key);
    if (list) list.push(pad);
    else bins.set(key, [pad]);
    return true;
  };
  for (const br of raw) {
    const n = br.pts.length / 3;
    if (br.depth >= 1 && n >= 2) addPad(br.pts[(n - 1) * 3], br.pts[(n - 1) * 3 + 1] + size * 0.012, true);
    if (br.depth >= 2) for (let k = 1; k < n - 1; k += 2) addPad(br.pts[k * 3], br.pts[k * 3 + 1] + size * 0.015);
  }
  const padTarget = Math.round((spec.near ? (spec.rooted ? 190 : 110) : 88) * (spec.density ?? 1));
  // Fillers are drawn only where a pad may land (a crown can reach past the page edges).
  const fillL = Math.max(cx - rx * 1.05, minX);
  const fillW = Math.min(cx + rx * 1.05, maxX) - fillL;
  for (let tries = 0; fillW > 0 && tries < 6000 * (spec.density ?? 1) && pads.length < padTarget; tries++) {
    const x = fillL + rng() * fillW;
    const y = spec.top + rng() * crownH;
    const n = outline(x, y);
    // Bias toward the outline so the silhouette is built from small tufts.
    if (rng() > 0.4 + 0.6 * smooth(0.3, 0.95, n)) continue;
    addPad(x, y, false, n);
  }

  // Weeping twigs hang from tufts on the sides and underside; those over the gutters first.
  const hangers = pads
    .filter((p) => p.front && p.shell > 0.5 && p.y > yb - hu * 0.35 && p.x > -L.side + 4 && p.x < W + L.side - 4 && p.y + p.ry < L.waterY - 10)
    .map((p) => ({ p, key: rng() * (inGutter(L, p.x) ? 3 : 1) * (0.5 + (p.y - spec.top) / crownH) }))
    .sort((a, b) => b.key - a.key);
  const strands: Strand[] = [];
  for (const { p } of hangers.slice(0, spec.sprays)) {
    const count = 2 + Math.floor(rng() * 3);
    for (let k = 0; k < count; k++) {
      const len = crownH * (0.07 + rng() * 0.1) * (k === 0 ? 1 : 0.6 + rng() * 0.3);
      const curl = (p.x < cx ? -1 : 1) * (rng() < 0.8 ? 1 : -1);
      const x0 = p.x + (rng() - 0.5) * p.rx * 1.3;
      const y0 = p.y + p.ry * (0.35 + rng() * 0.3);
      strands.push({
        x0, y0, cx: x0 + curl * len * (0.28 + rng() * 0.3), cy: y0 + len * (0.05 + rng() * 0.2),
        x1: x0 + curl * len * (0.05 + rng() * 0.22), y1: y0 + len, leaf: clamp(len * 0.12, minLeaf, maxLeaf * 0.9), seed: Math.floor(rng() * 1e9),
      });
    }
  }

  // Perches sit on the tufts' rims, weighted toward the silhouette so a shared
  // pulse traces the outline; perches in the visible gutters get more.
  const rimPads = pads.filter((p) => p.front);
  const perchCount = spec.near ? (spec.rooted ? 900 : 360) : 260;
  const perches = new Float32Array(perchCount * 2);
  const perchEdge = new Float32Array(perchCount);
  const perchCdf = new Float32Array(perchCount);
  const edgePad = 8 * s;
  let acc = 0;
  let placed = 0;
  for (let tries = 0; placed < perchCount; tries++) {
    let x: number;
    let y: number;
    let edge: number;
    if (strands.length && rng() < 0.1) {
      const st = strands[Math.floor(rng() * strands.length)];
      const t = 0.2 + rng() * 0.8;
      const mt = 1 - t;
      x = mt * mt * st.x0 + 2 * mt * t * st.cx + t * t * st.x1;
      y = mt * mt * st.y0 + 2 * mt * t * st.cy + t * t * st.y1;
      edge = 0.8;
    } else {
      const src = rimPads.length ? rimPads : pads;
      const p = src[Math.floor(rng() * src.length)];
      if (!p) break;
      const a = rng() * TAU;
      const rr = 0.55 + 0.45 * rng();
      x = p.x + Math.cos(a) * p.rx * rr;
      y = p.y + Math.sin(a) * p.ry * rr;
      const ox = p.x - cx;
      const oy = p.y - yb;
      const ol = Math.hypot(ox, oy) || 1;
      const facing = (Math.cos(a) * ox + Math.sin(a) * oy) / ol;
      edge = p.shell * (0.45 + 0.55 * Math.max(0, facing));
    }
    const visible = x > edgePad && x < W - edgePad && y > edgePad && y < L.height - edgePad;
    if (!visible && tries < perchCount * 30) continue;
    perches[placed * 2] = x;
    perches[placed * 2 + 1] = y;
    perchEdge[placed] = edge;
    acc += (0.12 + Math.pow(edge, 1.4)) * (inGutter(L, x) ? 2.4 : 1);
    perchCdf[placed] = acc;
    placed++;
  }
  if (acc > 0) for (let n = 0; n < perchCount; n++) perchCdf[n] /= acc;

  let box: Box | null = null;
  for (const p of pads) {
    const ex = p.rx * 1.35 + p.leaf * 1.2;
    const ey = p.ry * 1.35 + p.leaf * 1.2;
    box = unionBox(box, { x: p.x - ex, y: p.y - ey, w: ex * 2, h: ey * 2 });
  }
  for (const st of strands) {
    const x0 = Math.min(st.x0, st.cx, st.x1) - st.leaf * 2;
    box = unionBox(box, { x: x0, y: st.y0, w: Math.max(st.x0, st.cx, st.x1) + st.leaf * 2 - x0, h: st.y1 - st.y0 + st.leaf * 2 });
  }
  for (const b of branches) box = unionBox(box, boundsOf(b.pts, 2));
  box = unionBox(box, { x: fx - trunkW * 2, y: fy - trunkW, w: trunkW * 4, h: trunkW * 2 });
  let trunkBox: Box | null = null;
  if (spec.rooted) {
    trunkBox = boundsOf(trunk.pts, 4);
    for (const r of roots) trunkBox = unionBox(trunkBox, boundsOf(r.pts, 2));
    const spikeSpan = Math.min(size * 0.32, 90 * s);
    trunkBox = unionBox(trunkBox, { x: spec.baseX - spikeSpan - 4, y: spec.baseY - 14 * s, w: spikeSpan * 2 + 8, h: 22 * s });
  } else {
    box = unionBox(box, boundsOf(trunk.pts, 2));
  }
  const crownBox = box ?? { x: cx, y: spec.top, w: 1, h: 1 };
  const x0 = Math.max(crownBox.x, -L.side - 2);
  const y0 = Math.max(crownBox.y, -L.top - 2);
  const x1 = Math.min(crownBox.x + crownBox.w, W + L.side + 2);
  const y1 = Math.min(crownBox.y + crownBox.h, L.height + 2);
  const finalBox: Box = { x: Math.floor(x0), y: Math.floor(y0), w: Math.max(1, Math.ceil(x1 - x0) + 1), h: Math.max(1, Math.ceil(y1 - y0) + 1) };

  const lx = L.moonX - cx;
  const ly = L.moonY - yb;
  const ll = Math.hypot(lx, ly) || 1;
  return {
    spec, cx, bellyY: yb, trunkW, trunk, roots, branches, pads, strands, spikes, perches, perchEdge, perchCdf,
    box: finalBox, trunkBox, lightX: lx / ll, lightY: ly / ll,
  };
}

/* ------------------------------------------------------------------ painting */

export interface TreePalette {
  limb: string;
  back: string;
  front: string;
  /** "r,g,b" of the moonlit sheen on the back leaf mass. */
  highlight: string;
  rim: string;
  rimAlpha: number;
  sheen: number;
}

export const NEAR_PALETTE: TreePalette = { limb: "#020605", back: "#0a1813", front: "#030a08", highlight: "120,170,150", rim: "#a9cdbf", rimAlpha: 0.6, sheen: 0.1 };
/** The stage branch: the back leaf mass stays close to the front value, so no lighter block shows behind it. */
export const STAGE_PALETTE: TreePalette = { ...NEAR_PALETTE, back: "#06110d", sheen: 0.05 };
export const MID_PALETTE: TreePalette ={ limb: "#0a191b", back: "#163330", front: "#0d2325", highlight: "130,180,170", rim: "#a3c8c1", rimAlpha: 0.34, sheen: 0.12 };

/** A plane canvas: its rect in plane px and its backing context at `dpr`. */
export interface PaintTarget {
  g: CanvasRenderingContext2D;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Three scratch surfaces, at least as large (in backing px) as every crown box of the job. */
export interface Scratch {
  T: Surface;
  F: Surface;
  R: Surface;
}

/** Smooth tapered outline of a limb given as (x, y, width) triples; overlapping limbs union under nonzero fill. */
function branchPath(ctx: CanvasRenderingContext2D, pts: number[]): void {
  const n = pts.length / 3;
  if (n < 2) return;
  const lx: number[] = [];
  const ly: number[] = [];
  const rx: number[] = [];
  const ry: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1) * 3;
    const b = Math.min(n - 1, i + 1) * 3;
    const dx = pts[b] - pts[a];
    const dy = pts[b + 1] - pts[a + 1];
    const len = Math.hypot(dx, dy) || 1;
    const w = pts[i * 3 + 2] / 2;
    const nx = (-dy / len) * w;
    const ny = (dx / len) * w;
    lx.push(pts[i * 3] + nx);
    ly.push(pts[i * 3 + 1] + ny);
    rx.push(pts[i * 3] - nx);
    ry.push(pts[i * 3 + 1] - ny);
  }
  const side = (xs: number[], ys: number[], reverse: boolean) => {
    const order = xs.map((_, i) => (reverse ? xs.length - 1 - i : i));
    const first = order[0];
    if (reverse) ctx.lineTo(xs[first], ys[first]);
    else ctx.moveTo(xs[first], ys[first]);
    for (let k = 1; k < order.length - 1; k++) {
      const c = order[k];
      const d = order[k + 1];
      ctx.quadraticCurveTo(xs[c], ys[c], (xs[c] + xs[d]) / 2, (ys[c] + ys[d]) / 2);
    }
    const last = order[order.length - 1];
    ctx.lineTo(xs[last], ys[last]);
  };
  side(lx, ly, false);
  side(rx, ry, true);
  ctx.closePath();
}

/** A pointed leaf from (x, y) along `ang`: two quadratic curves, no ellipse. */
export function leafPath(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, wid: number): void {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const mx = x + dx * len * 0.45;
  const my = y + dy * len * 0.45;
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(mx - dy * wid, my + dx * wid, x + dx * len, y + dy * len);
  ctx.quadraticCurveTo(mx + dy * wid, my - dx * wid, x, y);
}

/** Leaf tuft: leaves fan out from the pad centre and sag under gravity; noise opens lace gaps toward the outline. */
function padLeaves(g: CanvasRenderingContext2D, p: Pad, gap: (x: number, y: number) => number, gapFreq: number, coverage: number): void {
  const rng = createRng(p.seed);
  const area = Math.PI * p.rx * p.ry;
  const count = Math.min(560, Math.ceil((p.density * coverage * area) / (p.leaf * p.leaf * 0.17)));
  const thr = 0.88 - 0.8 * p.shell;
  const droop = 0.42 + 0.2 * p.shell;
  const nx = (p.seed % 977) * 0.13;
  for (let k = 0; k < count; k++) {
    const a = rng() * TAU;
    const u = Math.pow(rng(), 0.6);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const edge = 1 + 0.2 * gap(ca * 1.3 + nx, sa * 1.3);
    const x = p.x + ca * p.rx * u * edge;
    const y = p.y + sa * p.ry * u * edge;
    if (gap(x * gapFreq, y * gapFreq) > thr) continue;
    const ang = Math.atan2(sa * (1 - droop) * 0.8 + droop, ca * (1 - droop)) + (rng() - 0.5) * 1.15;
    const len = p.leaf * (0.75 + rng() * 0.6) * (0.9 + 0.35 * u);
    leafPath(g, x, y, ang, len, len * 0.3);
  }
}

const intersects = (a: Box, t: PaintTarget) => a.x < t.x + t.w && a.x + a.w > t.x && a.y < t.y + t.h && a.y + a.h > t.y;

/** Front pads painted per step, so no step runs long (spec 5.6). */
const PADS_PER_STEP = 48;

/**
 * The steps that paint one tree into the plane canvases: the trunk straight into the
 * targets, then the crown through the scratch surfaces, blitted where it overlaps each
 * target. `dpr` is the backing scale of the targets and of the scratch surfaces.
 */
export function treeSteps(
  geom: TreeGeom,
  pal: TreePalette,
  targets: readonly PaintTarget[],
  scratch: Scratch,
  dpr: number,
  scale: number,
  /** Fades the crown to transparent over this many px from the first target's left and top edges. */
  feather?: { left: number; top: number },
): (() => void)[] {
  const steps: (() => void)[] = [];
  const s = scale;
  const spec = geom.spec;
  const box = geom.box;
  const bw = Math.ceil(box.w * dpr);
  const bh = Math.ceil(box.h * dpr);
  const T = scratch.T.g;
  const F = scratch.F.g;
  const R = scratch.R.g;
  const gapNoise = createNoise2D(spec.seed + 101);
  const crownSize = Math.min((spec.x1 - spec.x0) / 2, (spec.bottom - spec.top) * 0.8);
  const gapFreq = 1 / Math.max(18, crownSize * 0.11);
  const toBox = (g: CanvasRenderingContext2D) => g.setTransform(dpr, 0, 0, dpr, -box.x * dpr, -box.y * dpr);
  const clear = (g: CanvasRenderingContext2D) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.clearRect(0, 0, bw, bh);
  };
  const tint = (g: CanvasRenderingContext2D, color: string) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = color;
    g.fillRect(0, 0, bw, bh);
    g.globalCompositeOperation = "source-over";
  };
  const reach = Math.max(spec.x1 - spec.x0, spec.bottom - spec.top) * 0.6;

  if (geom.trunkBox) {
    const tb = geom.trunkBox;
    steps.push(() => {
      for (const t of targets) {
        if (!intersects(tb, t)) continue;
        const g = t.g;
        g.setTransform(dpr, 0, 0, dpr, -t.x * dpr, -t.y * dpr);
        // Moonlit rim in broken runs of 2-4 samples (about 30-80 px), then the trunk over it,
        // shifted away from the moon, so only short crescents of light stay on the bark.
        const shift = 1.5 * Math.max(0.75, s);
        const pts = geom.trunk.pts;
        const n = pts.length / 3;
        const rr = createRng(spec.seed * 31 + 7);
        g.fillStyle = pal.rim;
        for (let i = 0; i < n - 1; ) {
          const end = Math.min(n - 1, i + 2 + Math.floor(rr() * 3));
          g.globalAlpha = Math.min(0.35, pal.rimAlpha * (0.2 + 0.38 * rr()));
          g.beginPath();
          branchPath(g, pts.slice(i * 3, end * 3 + 3));
          g.fill();
          i = end + 1 + Math.floor(rr() * 3);
        }
        g.globalAlpha = 1;
        g.translate(-geom.lightX * shift, -geom.lightY * shift);
        g.fillStyle = pal.limb;
        g.beginPath();
        branchPath(g, geom.trunk.pts);
        g.fill();
        g.translate(geom.lightX * shift, geom.lightY * shift);
        g.beginPath();
        for (const r of geom.roots) branchPath(g, r.pts);
        for (let n = 0; n < geom.spikes.length; n += 4) {
          const x = geom.spikes[n];
          const y = geom.spikes[n + 1];
          const h = geom.spikes[n + 2];
          const w = geom.spikes[n + 3];
          g.moveTo(x - w, y);
          g.lineTo(x + w * 0.15, y - h);
          g.lineTo(x + w, y);
          g.closePath();
        }
        g.fill();
      }
    });
  }

  // 1. Back plane: interior leaf mass, a lighter value behind the limbs.
  steps.push(() => {
    clear(T);
    clear(F);
    T.fillStyle = "#fff";
    toBox(T);
    T.beginPath();
    for (const p of geom.pads) if (!p.front) padLeaves(T, p, gapNoise, gapFreq, 0.95);
    T.fill();
    tint(T, pal.back);
    toBox(T);
    T.globalCompositeOperation = "source-atop";
    const hx = geom.cx + geom.lightX * reach * 0.6;
    const hy = geom.bellyY + geom.lightY * reach * 0.6;
    const vg = T.createRadialGradient(hx, hy, 0, hx, hy, reach * 1.1);
    vg.addColorStop(0, `rgba(${pal.highlight},${pal.sheen})`);
    vg.addColorStop(1, `rgba(${pal.highlight},0)`);
    T.fillStyle = vg;
    T.fillRect(box.x, box.y, box.w, box.h);
    T.globalCompositeOperation = "source-over";
  });

  // 2. Limbs (and the attaching limb of a hanging crown), darkest, with a faint moonlit edge.
  steps.push(() => {
    toBox(T);
    T.fillStyle = pal.limb;
    T.beginPath();
    if (!spec.rooted) branchPath(T, geom.trunk.pts);
    for (const b of geom.branches) branchPath(T, b.pts);
    T.fill();
    toBox(F);
    F.fillStyle = "#fff";
    F.beginPath();
    for (const b of geom.branches) if (b.pts[2] > 2.5) branchPath(F, b.pts);
    F.fill();
    R.setTransform(1, 0, 0, 1, 0, 0);
    R.globalCompositeOperation = "source-over";
    R.clearRect(0, 0, bw, bh);
    R.drawImage(scratch.F.canvas, 0, 0, bw, bh, 0, 0, bw, bh);
    const limbShift = 1.6 * dpr * Math.max(0.75, s);
    R.globalCompositeOperation = "destination-out";
    R.drawImage(scratch.F.canvas, 0, 0, bw, bh, -geom.lightX * limbShift, -geom.lightY * limbShift, bw, bh);
    R.globalCompositeOperation = "source-in";
    R.fillStyle = pal.rim;
    R.fillRect(0, 0, bw, bh);
    R.globalCompositeOperation = "source-over";
    T.setTransform(1, 0, 0, 1, 0, 0);
    T.globalAlpha = pal.rimAlpha * 0.4;
    T.drawImage(scratch.R.canvas, 0, 0, bw, bh, 0, 0, bw, bh);
    T.globalAlpha = 1;
    clear(F);
  });

  // 3. Front leaf mass with lace gaps, in slices.
  const front = geom.pads.filter((p) => p.front);
  for (let k = 0; k < front.length; k += PADS_PER_STEP) {
    const slice = front.slice(k, k + PADS_PER_STEP);
    steps.push(() => {
      F.fillStyle = "#fff";
      toBox(F);
      F.beginPath();
      for (const p of slice) padLeaves(F, p, gapNoise, gapFreq, 1.45);
      F.fill();
    });
  }

  const rimPass = (shift: number, alpha: number) => {
    R.setTransform(1, 0, 0, 1, 0, 0);
    R.globalCompositeOperation = "source-over";
    R.clearRect(0, 0, bw, bh);
    R.drawImage(scratch.F.canvas, 0, 0, bw, bh, 0, 0, bw, bh);
    R.globalCompositeOperation = "destination-out";
    R.drawImage(scratch.F.canvas, 0, 0, bw, bh, -geom.lightX * shift, -geom.lightY * shift, bw, bh);
    // Strongest on the moon side, fading across the crown and below its widest line.
    const mx = (geom.cx - box.x) * dpr;
    const my = (geom.bellyY - box.y) * dpr;
    const span = reach * dpr;
    R.globalCompositeOperation = "source-in";
    const lg = R.createLinearGradient(mx - geom.lightX * span, my - geom.lightY * span, mx + geom.lightX * span, my + geom.lightY * span);
    lg.addColorStop(0, "rgba(0,0,0,0)");
    lg.addColorStop(0.45, `${pal.rim}00`);
    lg.addColorStop(1, pal.rim);
    R.fillStyle = lg;
    R.fillRect(0, 0, bw, bh);
    R.globalCompositeOperation = "destination-in";
    const top = (spec.top - box.y) * dpr;
    const vg2 = R.createLinearGradient(0, top, 0, my + (spec.bottom - geom.bellyY) * dpr * 0.5);
    vg2.addColorStop(0, "rgba(0,0,0,1)");
    vg2.addColorStop(0.7, "rgba(0,0,0,0.45)");
    vg2.addColorStop(1, "rgba(0,0,0,0)");
    R.fillStyle = vg2;
    R.fillRect(0, 0, bw, bh);
    F.setTransform(1, 0, 0, 1, 0, 0);
    F.globalCompositeOperation = "source-atop";
    F.globalAlpha = alpha;
    F.drawImage(scratch.R.canvas, 0, 0, bw, bh, 0, 0, bw, bh);
    F.globalAlpha = 1;
    F.globalCompositeOperation = "source-over";
  };
  const rimD = 1.3 * dpr * Math.max(0.75, s);

  // 4. Tint and the two moonlit rims.
  steps.push(() => {
    tint(F, pal.front);
    rimPass(rimD * 5, pal.rimAlpha * 0.2);
    rimPass(rimD, pal.rimAlpha);
  });

  // 5. Composite, weeping twigs, then blit into every plane canvas the crown overlaps.
  steps.push(() => {
    T.setTransform(1, 0, 0, 1, 0, 0);
    T.drawImage(scratch.F.canvas, 0, 0, bw, bh, 0, 0, bw, bh);
    toBox(T);
    T.fillStyle = pal.front;
    T.strokeStyle = pal.front;
    T.lineWidth = Math.max(0.8, 1.1 * s);
    T.lineCap = "round";
    T.beginPath();
    for (const st of geom.strands) {
      T.moveTo(st.x0, st.y0);
      T.quadraticCurveTo(st.cx, st.cy, st.x1, st.y1);
    }
    T.stroke();
    T.beginPath();
    for (const st of geom.strands) {
      const rng = createRng(st.seed);
      const n = Math.max(4, Math.ceil(Math.hypot(st.x1 - st.x0, st.y1 - st.y0) / (st.leaf * 0.62)));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const mt = 1 - t;
        const x = mt * mt * st.x0 + 2 * mt * t * st.cx + t * t * st.x1;
        const y = mt * mt * st.y0 + 2 * mt * t * st.cy + t * t * st.y1;
        const tx = 2 * mt * (st.cx - st.x0) + 2 * t * (st.x1 - st.cx);
        const ty = 2 * mt * (st.cy - st.y0) + 2 * t * (st.y1 - st.cy);
        const along = Math.atan2(ty, tx);
        const len = st.leaf * (1.25 - 0.55 * t) * (0.8 + rng() * 0.4);
        const sideSign = k % 2 === 0 ? 1 : -1;
        leafPath(T, x, y, along + sideSign * (0.75 + rng() * 0.5), len, len * 0.3);
      }
      leafPath(T, st.x1, st.y1, Math.PI / 2 + (rng() - 0.5) * 0.6, st.leaf * 0.9, st.leaf * 0.27);
    }
    T.fill();
    const t0 = targets[0];
    if (feather && t0) {
      // Eased alpha ramps from the target's edges: no leaf reaches an edge at full value.
      T.setTransform(1, 0, 0, 1, 0, 0);
      T.globalCompositeOperation = "destination-in";
      const ramp = (g: CanvasGradient) => {
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(0.35, "rgba(0,0,0,0.22)");
        g.addColorStop(0.7, "rgba(0,0,0,0.72)");
        g.addColorStop(1, "#000");
        return g;
      };
      if (feather.left > 0) {
        const x = (t0.x - box.x) * dpr;
        T.fillStyle = ramp(T.createLinearGradient(x, 0, x + feather.left * dpr, 0));
        T.fillRect(0, 0, bw, bh);
      }
      if (feather.top > 0) {
        const y = (t0.y - box.y) * dpr;
        T.fillStyle = ramp(T.createLinearGradient(0, y, 0, y + feather.top * dpr));
        T.fillRect(0, 0, bw, bh);
      }
      T.globalCompositeOperation = "source-over";
    }
    for (const t of targets) {
      if (!intersects(box, t)) continue;
      t.g.setTransform(1, 0, 0, 1, 0, 0);
      t.g.globalAlpha = 1;
      t.g.globalCompositeOperation = "source-over";
      t.g.drawImage(scratch.T.canvas, 0, 0, bw, bh, Math.round((box.x - t.x) * dpr), Math.round((box.y - t.y) * dpr), bw, bh);
    }
  });
  return steps;
}
