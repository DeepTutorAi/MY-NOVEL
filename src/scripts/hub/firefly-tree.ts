// Lamphu tree geometry for the firefly hub scene: a branching skeleton, leaf
// pads on its tips, weeping strands and the perches fireflies settle on.
// Pure data, no canvas: painting lives in firefly-scene.ts.

import { createNoise2D, createRng, fbm2D } from "../_shared/scene-runtime";

const TAU = Math.PI * 2;

export type LayoutMode = "wide" | "portrait" | "short";

export interface CrownSpec {
  /** Crown envelope in CSS px. The outline is widest at `belly` (0..1 from top to bottom). */
  x0: number;
  x1: number;
  top: number;
  bottom: number;
  belly: number;
  baseX: number;
  baseY: number;
  forkX: number;
  forkY: number;
  /** Near trees are near-black and painted on the near layer; mid trees stand on the far bank. */
  near: boolean;
  seed: number;
  fireflyShare: number;
  /** Number of weeping branch clusters. */
  sprays: number;
}

/** The slice of the scene layout that tree geometry depends on. */
export interface TreeEnv {
  mode: LayoutMode;
  width: number;
  height: number;
  waterY: number;
  moonX: number;
  moonY: number;
  /** Size scale relative to a 900 px short side. */
  scale: number;
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
  box: Box;
  /** Unit vector from the crown centre toward the moon. */
  lightX: number;
  lightY: number;
}

/** Parallax overscan in CSS px; the scene's layers extend this far past the viewport. */
export const MARGIN = 28;

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
  const lobeAt = (theta: number) => 1 + 0.21 * fbm2D(noise, Math.cos(theta) * 1.7 + spec.seed * 0.37, Math.sin(theta) * 1.7, 3);
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

  const trunkW = size * (spec.near ? 0.085 : 0.075);
  const tipW = Math.max(0.8, 1.3 * s * (spec.near ? 1 : 0.7));
  const fx = spec.forkX;
  const fy = spec.forkY;
  const lean = fx - spec.baseX;
  const trunk = sampleCurve(
    spec.baseX, spec.baseY,
    spec.baseX + lean * 0.15 - trunkW * 0.6 * Math.sign(lean || 1), lerp(spec.baseY, fy, 0.55),
    fx, fy,
    (t) => trunkW * (0.95 + 0.75 * Math.pow(1 - t, 3.5)),
    14,
  );

  // Skeleton: limbs are grown breadth-first so every primary limb exists before
  // secondaries compete for the tip budget. Primaries head for goals spread
  // around the crown; later generations wander outward and sag.
  const raw: RawBranch[] = [];
  const queue: Pending[] = [];
  const tipBudget = spec.near ? 150 : 60;
  const primaries = spec.near ? 6 : 4;
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
  const widthOf = (load: number) => tipW + (trunkW * 0.78 - tipW) * Math.sqrt(load / totalLoad);
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

  // Leaf pads: on every branch tip, along outer limbs, plus fillers so the
  // interior reads as leaf mass and the outline stays ragged. A few overhang.
  const pads: Pad[] = [];
  const minX = -MARGIN - size * 0.1;
  const maxX = W + MARGIN + size * 0.1;
  const minLeaf = (spec.near ? 3.4 : 2.3) * s;
  const maxLeaf = (spec.near ? 14 : 6.5) * s;
  const addPad = (x: number, y: number, force = false): boolean => {
    if (x < minX || x > maxX || y < -MARGIN - size * 0.1) return false;
    const n = outline(x, y);
    if (n > 1.12 || (n > 1 && rng() > 0.18)) return false;
    const shell = smooth(0.35, 0.98, n);
    const r = size * lerp(0.155, 0.08, shell) * (0.75 + rng() * 0.5);
    if (!force) {
      for (const o of pads) {
        const dx = o.x - x;
        const dy = (o.y - y) * 1.2;
        const lim = (o.rx + r) * 0.5;
        if (dx * dx + dy * dy < lim * lim) return false;
      }
    }
    const front = shell > 0.38 || rng() < 0.22;
    pads.push({
      x, y, rx: r, ry: r * (0.5 + rng() * 0.2), shell,
      density: lerp(1, 0.62, shell) * (0.8 + rng() * 0.4) * (front ? 1 : 0.85),
      front, leaf: clamp(r * 0.27, minLeaf, maxLeaf), seed: Math.floor(rng() * 1e9),
    });
    return true;
  };
  for (const br of raw) {
    const n = br.pts.length / 3;
    if (br.depth >= 1 && n >= 2) addPad(br.pts[(n - 1) * 3], br.pts[(n - 1) * 3 + 1] + size * 0.012, true);
    if (br.depth >= 2) for (let k = 1; k < n - 1; k += 2) addPad(br.pts[k * 3], br.pts[k * 3 + 1] + size * 0.015);
  }
  const padTarget = spec.near ? 190 : 88;
  for (let tries = 0; tries < 6000 && pads.length < padTarget; tries++) {
    const x = cx + (rng() * 2 - 1) * rx * 1.05;
    const y = spec.top + rng() * crownH;
    const n = outline(x, y);
    // Bias toward the outline so the silhouette is built from small tufts.
    if (rng() > 0.4 + 0.6 * smooth(0.3, 0.95, n)) continue;
    addPad(x, y);
  }

  // Weeping twigs hang from tufts on the sides and underside; margins first.
  const marginX = (x: number) => L.mode === "wide" && (x < W * 0.12 || x > W * 0.88);
  const hangers = pads
    .filter((p) => p.front && p.shell > 0.5 && p.y > yb - hu * 0.35 && p.x > 4 && p.x < W - 4 && p.y + p.ry < L.waterY - 10)
    .map((p) => ({ p, key: rng() * (marginX(p.x) ? 3 : 1) * (0.5 + (p.y - spec.top) / crownH) }))
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

  const spikes: number[] = [];
  const spikeSpan = Math.min(size * 0.32, 90 * s);
  for (let n = 0; n < (spec.near ? 60 : 20); n++) {
    const d = (rng() - 0.5) * 2;
    spikes.push(
      spec.baseX + d * spikeSpan,
      spec.baseY + (rng() - 0.2) * 5 * s,
      (2.5 + rng() * 9 * (1 - Math.abs(d) * 0.7)) * s,
      (0.7 + rng() * 1.1) * s,
    );
  }

  // Perches sit on the tufts' rims, weighted toward the silhouette so a shared
  // pulse traces the outline; in the wide layout the margin columns get more.
  const rimPads = pads.filter((p) => p.front);
  const perchCount = spec.near ? 900 : 260;
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
    acc += (0.12 + Math.pow(edge, 1.4)) * (marginX(x) ? 2.4 : 1);
    perchCdf[placed] = acc;
    placed++;
  }
  if (acc > 0) for (let n = 0; n < perchCount; n++) perchCdf[n] /= acc;

  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  const grow = (x0: number, y0: number, x1: number, y1: number) => {
    bx0 = Math.min(bx0, x0);
    by0 = Math.min(by0, y0);
    bx1 = Math.max(bx1, x1);
    by1 = Math.max(by1, y1);
  };
  for (const p of pads) {
    const ex = p.rx * 1.35 + p.leaf * 1.2;
    const ey = p.ry * 1.35 + p.leaf * 1.2;
    grow(p.x - ex, p.y - ey, p.x + ex, p.y + ey);
  }
  for (const st of strands) grow(Math.min(st.x0, st.cx, st.x1) - st.leaf * 2, st.y0, Math.max(st.x0, st.cx, st.x1) + st.leaf * 2, st.y1 + st.leaf * 2);
  grow(spec.baseX - Math.max(spikeSpan, trunkW * 2.5) - 4, fy - trunkW, spec.baseX + Math.max(spikeSpan, trunkW * 2.5) + 4, spec.baseY + 16 * s);
  grow(fx - trunkW * 2, fy - trunkW, fx + trunkW * 2, fy + trunkW);
  bx0 = Math.max(bx0, -MARGIN);
  by0 = Math.max(by0, -MARGIN);
  bx1 = Math.min(bx1, W + MARGIN);
  by1 = Math.min(by1, L.height + MARGIN);
  const box: Box = { x: Math.floor(bx0), y: Math.floor(by0), w: Math.max(1, Math.ceil(bx1 - bx0) + 1), h: Math.max(1, Math.ceil(by1 - by0) + 1) };

  const lx = L.moonX - cx;
  const ly = L.moonY - yb;
  const ll = Math.hypot(lx, ly) || 1;
  return {
    spec, cx, bellyY: yb, trunkW, trunk, roots, branches, pads, strands, spikes, perches, perchEdge, perchCdf, box,
    lightX: lx / ll, lightY: ly / ll,
  };
}
