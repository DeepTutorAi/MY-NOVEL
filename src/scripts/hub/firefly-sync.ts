// Flash timing and phase synchronisation for the hub firefly scene.
//
// Each firefly is a phase oscillator. Neighbours (found through a coarse
// spatial grid) pull each other's phases together Kuramoto-style, so partial
// synchrony and travelling waves emerge on their own. A periodic "wave" event
// sweeps a front across the scene that triggers flashes as it passes and
// briefly raises the coupling so the canopy pulses together before drifting
// apart again. The module has no DOM dependency so the flash-safety limits can
// be unit tested.

const TAU = Math.PI * 2;

/** Minimum time between two flashes of one firefly (seconds): at most 1.25 flashes/s. */
export const MIN_FLASH_INTERVAL = 0.8;
/** Eased attack of a lone flash. */
export const BASE_ATTACK = 0.06;
/** Eased attack used once the neighbourhood is in sync, so shared pulses stay soft. */
export const SYNC_ATTACK = 0.2;
export const BASE_COUPLING = 0.55;
export const WAVE_COUPLING_BOOST = 1.6;
export const WAVE_COUPLING_DECAY_S = 12;
export const WAVE_SWEEP_S = 2.6;

export interface Species {
  /** Free-running flash period range in seconds (always >= MIN_FLASH_INTERVAL). */
  period: readonly [number, number];
  decay: readonly [number, number];
  /** Coupling scale: 1 joins the chorus fully, 0 flashes independently. */
  coupling: number;
  weight: number;
}

export const SPECIES: readonly Species[] = [
  { period: [0.98, 1.12], decay: [0.3, 0.44], coupling: 1, weight: 0.76 },
  { period: [1.3, 1.6], decay: [0.44, 0.58], coupling: 0.45, weight: 0.2 },
  { period: [1.9, 2.7], decay: [0.52, 0.68], coupling: 0, weight: 0.04 },
];

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const u = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return u * u * (3 - 2 * u);
}

/**
 * Brightness (0..1) of a flash `tau` seconds after it started: an eased
 * (smoothstep) rise over `attack`, then an eased (smoothstep) fall over `decay`.
 */
export function flashEnvelope(tau: number, attack: number, decay: number): number {
  if (!(tau > 0) || !(attack > 0) || !(decay > 0)) return 0;
  if (tau < attack) {
    const u = tau / attack;
    return u * u * (3 - 2 * u);
  }
  const u = (tau - attack) / decay;
  if (u >= 1) return 0;
  return 1 - u * u * (3 - 2 * u);
}

export interface FlashField {
  readonly capacity: number;
  count: number;
  /** Positions used for neighbourhoods and wave fronts (CSS px). */
  x: Float32Array;
  y: Float32Array;
  phase: Float32Array;
  omega: Float32Array;
  couple: Float32Array;
  decay: Float32Array;
  attack: Float32Array;
  peak: Float32Array;
  flashAt: Float64Array;
  respondAt: Float64Array;
  active: Uint8Array;
  boutEnd: Float64Array;
  /** Local order parameter (0..1) seen by each firefly on the last step. */
  order: Float32Array;
  species: Uint8Array;
  cellSize: number;
  cols: number;
  rows: number;
  cellCos: Float32Array;
  cellSin: Float32Array;
  cellCount: Float32Array;
  wave: WaveState;
}

export interface WaveState {
  /** Scene time of the last wave start; -Infinity before the first. */
  startedAt: number;
  nextAt: number;
  running: boolean;
  front: number;
  direction: 1 | -1;
  minX: number;
  maxX: number;
}

export function createFlashField(capacity: number): FlashField {
  return {
    capacity,
    count: 0,
    x: new Float32Array(capacity),
    y: new Float32Array(capacity),
    phase: new Float32Array(capacity),
    omega: new Float32Array(capacity),
    couple: new Float32Array(capacity),
    decay: new Float32Array(capacity),
    attack: new Float32Array(capacity).fill(BASE_ATTACK),
    peak: new Float32Array(capacity).fill(1),
    flashAt: new Float64Array(capacity).fill(-Infinity),
    respondAt: new Float64Array(capacity).fill(Infinity),
    active: new Uint8Array(capacity),
    boutEnd: new Float64Array(capacity),
    order: new Float32Array(capacity),
    species: new Uint8Array(capacity),
    cellSize: 1,
    cols: 1,
    rows: 1,
    cellCos: new Float32Array(1),
    cellSin: new Float32Array(1),
    cellCount: new Float32Array(1),
    wave: { startedAt: -Infinity, nextAt: 14, running: false, front: 0, direction: 1, minX: 0, maxX: 0 },
  };
}

export function pickSpecies(r: number): number {
  let acc = 0;
  for (let s = 0; s < SPECIES.length; s++) {
    acc += SPECIES[s].weight;
    if (r < acc) return s;
  }
  return 0;
}

/** Seeds one oscillator. `rand` supplies uniform [0, 1) values. */
export function seedFirefly(field: FlashField, i: number, rand: () => number): void {
  const s = pickSpecies(rand());
  const spec = SPECIES[s];
  const period = Math.max(MIN_FLASH_INTERVAL, spec.period[0] + rand() * (spec.period[1] - spec.period[0]));
  field.species[i] = s;
  field.omega[i] = TAU / period;
  field.couple[i] = spec.coupling;
  field.decay[i] = spec.decay[0] + rand() * (spec.decay[1] - spec.decay[0]);
  field.phase[i] = rand() * TAU;
  field.flashAt[i] = -Infinity;
  field.respondAt[i] = Infinity;
  field.active[i] = rand() < 0.72 ? 1 : 0;
  field.boutEnd[i] = 2 + rand() * 18;
  field.attack[i] = BASE_ATTACK;
  field.peak[i] = 1;
}

export function configureGrid(field: FlashField, width: number, height: number, cellSize: number): void {
  const size = Math.max(24, cellSize);
  const cols = Math.max(1, Math.ceil(width / size) + 1);
  const rows = Math.max(1, Math.ceil(height / size) + 1);
  field.cellSize = size;
  if (cols * rows !== field.cellCos.length) {
    field.cellCos = new Float32Array(cols * rows);
    field.cellSin = new Float32Array(cols * rows);
    field.cellCount = new Float32Array(cols * rows);
  }
  field.cols = cols;
  field.rows = rows;
}

function cellOf(field: FlashField, i: number): number {
  const cx = Math.min(field.cols - 1, Math.max(0, Math.floor(field.x[i] / field.cellSize)));
  const cy = Math.min(field.rows - 1, Math.max(0, Math.floor(field.y[i] / field.cellSize)));
  return cy * field.cols + cx;
}

/**
 * Starts a flash now when the refractory interval allows it. Returns false
 * (and leaves the firefly dark) when it flashed less than MIN_FLASH_INTERVAL ago.
 */
export function triggerFlash(field: FlashField, i: number, t: number): boolean {
  if (t - field.flashAt[i] < MIN_FLASH_INTERVAL) return false;
  const sync = smoothstep(0.45, 0.9, field.order[i]);
  field.flashAt[i] = t;
  field.attack[i] = BASE_ATTACK + (SYNC_ATTACK - BASE_ATTACK) * sync;
  // Shared pulses are slightly dimmer than lone flashes.
  field.peak[i] = 1 - 0.28 * sync;
  field.phase[i] = 0;
  return true;
}

export function flashIntensity(field: FlashField, i: number, t: number): number {
  return flashEnvelope(t - field.flashAt[i], field.attack[i], field.decay[i]) * field.peak[i];
}

export function couplingAt(field: FlashField, t: number): number {
  const since = t - field.wave.startedAt;
  if (!(since >= 0)) return BASE_COUPLING;
  return BASE_COUPLING + WAVE_COUPLING_BOOST * Math.exp(-since / WAVE_COUPLING_DECAY_S);
}

/** Starts a synchronising sweep across [minX, maxX]. */
export function startWave(field: FlashField, t: number, direction: 1 | -1, minX: number, maxX: number): void {
  const wave = field.wave;
  wave.running = true;
  wave.startedAt = t;
  wave.direction = direction;
  wave.minX = minX;
  wave.maxX = maxX;
  wave.front = direction > 0 ? minX : maxX;
}

/**
 * Advances all oscillators by dt. `rand` supplies uniform [0, 1) values.
 * Wave scheduling (when to call startWave) is left to the caller.
 */
export function stepField(field: FlashField, t: number, dt: number, rand: () => number): void {
  const n = field.count;
  if (n === 0 || !(dt > 0)) return;
  const cos = field.cellCos;
  const sin = field.cellSin;
  const cnt = field.cellCount;
  cos.fill(0);
  sin.fill(0);
  cnt.fill(0);

  // Only fireflies in a flashing bout broadcast their phase.
  for (let i = 0; i < n; i++) {
    if (!field.active[i] || field.couple[i] === 0) continue;
    const c = cellOf(field, i);
    const p = field.phase[i];
    cos[c] += Math.cos(p);
    sin[c] += Math.sin(p);
    cnt[c] += 1;
  }

  const wave = field.wave;
  let frontFrom = 0;
  let frontTo = 0;
  if (wave.running) {
    const span = Math.max(1, wave.maxX - wave.minX);
    const speed = span / WAVE_SWEEP_S;
    frontFrom = wave.front;
    wave.front += wave.direction * speed * dt;
    frontTo = wave.front;
    if ((wave.direction > 0 && wave.front > wave.maxX) || (wave.direction < 0 && wave.front < wave.minX)) {
      wave.running = false;
    }
  }
  const lo = Math.min(frontFrom, frontTo);
  const hi = Math.max(frontFrom, frontTo);
  const k = couplingAt(field, t);
  const cols = field.cols;
  const rows = field.rows;
  const noiseAmp = 0.9 * Math.sqrt(dt);

  for (let i = 0; i < n; i++) {
    if (t >= field.boutEnd[i]) {
      const wasActive = field.active[i] === 1;
      field.active[i] = wasActive ? (rand() < 0.35 ? 0 : 1) : 1;
      field.boutEnd[i] = t + (field.active[i] ? 8 + rand() * 22 : 3 + rand() * 8);
    }

    const p = field.phase[i];
    let dphi = field.omega[i];
    const couple = field.couple[i];
    if (couple > 0) {
      const c = cellOf(field, i);
      const cx = c % cols;
      const cy = (c - cx) / cols;
      let sc = 0;
      let ss = 0;
      let sn = 0;
      for (let oy = -1; oy <= 1; oy++) {
        const ry = cy + oy;
        if (ry < 0 || ry >= rows) continue;
        for (let ox = -1; ox <= 1; ox++) {
          const rx = cx + ox;
          if (rx < 0 || rx >= cols) continue;
          const cc = ry * cols + rx;
          sc += cos[cc];
          ss += sin[cc];
          sn += cnt[cc];
        }
      }
      if (field.active[i]) {
        sc -= Math.cos(p);
        ss -= Math.sin(p);
        sn -= 1;
      }
      if (sn > 0.5) {
        // K/n * sum(sin(phi_j - phi_i)) without atan2.
        const cp = Math.cos(p);
        const sp = Math.sin(p);
        dphi += (k * couple * (ss * cp - sc * sp)) / sn;
        field.order[i] = Math.sqrt(sc * sc + ss * ss) / sn;
      } else {
        field.order[i] = 0;
      }
    } else {
      field.order[i] = 0;
    }

    let next = p + dphi * dt + (rand() - 0.5) * noiseAmp;
    if (next < 0) next += TAU;

    if (frontFrom !== frontTo) {
      const xi = field.x[i];
      if (xi >= lo && xi < hi && couple > 0) {
        field.active[i] = 1;
        field.boutEnd[i] = Math.max(field.boutEnd[i], t + 12 + rand() * 10);
        if (triggerFlash(field, i, t)) {
          next = 0;
        }
      }
    }

    if (t >= field.respondAt[i]) {
      field.respondAt[i] = Infinity;
      if (triggerFlash(field, i, t)) next = 0;
    }

    if (next >= TAU) {
      next -= TAU;
      if (field.active[i]) triggerFlash(field, i, t);
      next = next % TAU;
    }
    field.phase[i] = next;
  }
}

/** Mean-field order parameter (0..1) over all coupled fireflies. */
export function globalOrder(field: FlashField): number {
  let c = 0;
  let s = 0;
  let m = 0;
  for (let i = 0; i < field.count; i++) {
    if (field.couple[i] < 1) continue;
    c += Math.cos(field.phase[i]);
    s += Math.sin(field.phase[i]);
    m += 1;
  }
  return m > 0 ? Math.sqrt(c * c + s * s) / m : 0;
}
