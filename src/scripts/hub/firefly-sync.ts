// Flash timing and phase synchronisation for the hub firefly scene.
//
// Each firefly is a phase oscillator. Neighbours (found through a coarse spatial grid)
// pull each other's phases together Kuramoto-style, so partial synchrony and travelling
// waves emerge on their own. A chorus wave is a front that sweeps across the scene: every
// firefly it passes flashes and the coupling is raised for a while, so the canopy pulses
// together before drifting apart again. The reader's steady taps become an external
// driver that nearby fireflies entrain to. Pure and DOM-free, so the flash-safety limits
// are unit tested (spec 2.20).

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

/** The reader's rhythm as a driver: period limits, reach and strength (spec 3.5 M4). */
export const DRIVER_MIN_PERIOD = 0.8;
export const DRIVER_MAX_PERIOD = 1.6;
export const DRIVER_RADIUS = 260;
export const DRIVER_GAIN = 4.2;
/** Taps further apart than this start a new run. */
export const RHYTHM_BREAK_S = 2.4;
/** Largest coefficient of variation of the tap intervals that still counts as steady. */
export const RHYTHM_CV_MAX = 0.15;
/** Steady beats after which the driver spreads to the whole canopy, and for how long. */
export const CHORUS_BEATS = 8;
export const CHORUS_S = 20;
/** A local driver keeps running this many periods after the last steady tap. */
export const DRIVER_HOLD_PERIODS = 4;

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
  /** Positions used for neighbourhoods, fronts and the driver (CSS px of the field's plane). */
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
  /** In a flashing bout: broadcasts its phase and listens to its neighbours. */
  active: Uint8Array;
  boutEnd: Float64Array;
  /** Stepped this frame (on screen); others keep their phase until they return. */
  live: Uint8Array;
  /** Local order parameter (0..1) seen by each firefly on the last step. */
  order: Float32Array;
  species: Uint8Array;
  cellSize: number;
  cols: number;
  rows: number;
  cellCos: Float32Array;
  cellSin: Float32Array;
  cellCount: Float32Array;
  /** Scene time of the last coupling boost (a chorus wave start); -Infinity before the first. */
  boostAt: number;
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
    live: new Uint8Array(capacity).fill(1),
    order: new Float32Array(capacity),
    species: new Uint8Array(capacity),
    cellSize: 1,
    cols: 1,
    rows: 1,
    cellCos: new Float32Array(1),
    cellSin: new Float32Array(1),
    cellCount: new Float32Array(1),
    boostAt: -Infinity,
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
  field.live[i] = 1;
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

/** Raises the coupling from now on (a chorus wave started). */
export function boostCoupling(field: FlashField, t: number): void {
  field.boostAt = t;
}

export function couplingAt(field: FlashField, t: number): number {
  const since = t - field.boostAt;
  if (!(since >= 0)) return BASE_COUPLING;
  return BASE_COUPLING + WAVE_COUPLING_BOOST * Math.exp(-since / WAVE_COUPLING_DECAY_S);
}

/**
 * The part of a front swept during one step: every firefly whose coordinate along the
 * front's axis, u = ax * x + ay * y, lies in [lo, hi) is crossed. (ax, ay) is a unit
 * direction; the front moves toward increasing u.
 */
export interface Sweep {
  ax: number;
  ay: number;
  lo: number;
  hi: number;
}

/** A sweeping chorus front in one coordinate frame: u(t) = from + speed * (t - startedAt) until it reaches `to`. */
export interface WaveFront {
  startedAt: number;
  from: number;
  to: number;
  speed: number;
  ax: number;
  ay: number;
}

/** A front from `from` to `to` that takes WAVE_SWEEP_S (or `seconds`). */
export function createWave(t: number, ax: number, ay: number, from: number, to: number, seconds = WAVE_SWEEP_S): WaveFront {
  const len = Math.hypot(ax, ay) || 1;
  return { startedAt: t, from, to, speed: Math.max(1, to - from) / Math.max(0.1, seconds), ax: ax / len, ay: ay / len };
}

/** Front position at t, or null before the start or after it passed `to`. */
export function frontAt(wave: WaveFront, t: number): number | null {
  if (t < wave.startedAt) return null;
  const u = wave.from + wave.speed * (t - wave.startedAt);
  return u > wave.to ? null : u;
}

/** Whether the front is still on its way at t. */
export function waveRunning(wave: WaveFront | null, t: number): boolean {
  return wave !== null && t >= wave.startedAt && wave.from + wave.speed * (t - wave.startedAt) <= wave.to;
}

/**
 * The interval swept between t0 and t1 for a field whose frame is offset by (dx, dy)
 * from the wave's frame (a window field: its canvas origin in viewport px). Null when
 * the front was not moving in that interval.
 */
export function sweepBetween(wave: WaveFront | null, t0: number, t1: number, dx = 0, dy = 0): Sweep | null {
  if (!wave || t1 <= wave.startedAt) return null;
  const a = wave.from + wave.speed * (Math.max(t0, wave.startedAt) - wave.startedAt);
  if (a > wave.to) return null;
  const b = Math.min(wave.to + 1e-6, wave.from + wave.speed * (t1 - wave.startedAt));
  if (!(b > a)) return null;
  const shift = wave.ax * dx + wave.ay * dy;
  return { ax: wave.ax, ay: wave.ay, lo: a - shift, hi: b - shift };
}

/** An external oscillator the fireflies near it entrain to (the reader's rhythm). */
export interface Driver {
  /** 0..TAU; the driver "flashes" when it wraps. */
  phase: number;
  omega: number;
  x: number;
  y: number;
  /** Infinity drives the whole field. */
  radius: number;
  gain: number;
}

/** A driver at the clamped period, phase 0 now (the tap is the flash). */
export function createDriver(period: number, x: number, y: number, radius = DRIVER_RADIUS): Driver {
  return { phase: 0, omega: TAU / clampPeriod(period), x, y, radius, gain: DRIVER_GAIN };
}

export function clampPeriod(period: number): number {
  return Math.min(DRIVER_MAX_PERIOD, Math.max(DRIVER_MIN_PERIOD, Number.isFinite(period) ? period : DRIVER_MAX_PERIOD));
}

export function advanceDriver(driver: Driver, dt: number): void {
  driver.phase = (driver.phase + driver.omega * Math.max(0, dt)) % TAU;
}

/** Driver weight at distance d: 1 at the centre, easing to 0 at the radius. */
export function driverWeight(driver: Driver, d: number): number {
  if (driver.radius === Infinity) return 1;
  return 1 - smoothstep(driver.radius * 0.55, driver.radius, d);
}

/**
 * Advances all live oscillators by dt. `rand` supplies uniform [0, 1) values. A sweep
 * flashes the fireflies it crosses; a driver pulls nearby phases toward its own. Fireflies
 * at rest (outside a bout) neither broadcast nor listen, so they come out of a rest on
 * their own phase.
 */
export function stepField(
  field: FlashField,
  t: number,
  dt: number,
  rand: () => number,
  sweep: Sweep | null = null,
  driver: Driver | null = null,
): void {
  const n = field.count;
  if (n === 0 || !(dt > 0)) return;
  const cos = field.cellCos;
  const sin = field.cellSin;
  const cnt = field.cellCount;
  cos.fill(0);
  sin.fill(0);
  cnt.fill(0);

  for (let i = 0; i < n; i++) {
    if (!field.live[i] || !field.active[i] || field.couple[i] === 0) continue;
    const c = cellOf(field, i);
    const p = field.phase[i];
    cos[c] += Math.cos(p);
    sin[c] += Math.sin(p);
    cnt[c] += 1;
  }

  const k = couplingAt(field, t);
  const cols = field.cols;
  const rows = field.rows;
  const noiseAmp = 0.9 * Math.sqrt(dt);

  for (let i = 0; i < n; i++) {
    if (!field.live[i]) continue;
    if (t >= field.boutEnd[i]) {
      const wasActive = field.active[i] === 1;
      field.active[i] = wasActive ? (rand() < 0.35 ? 0 : 1) : 1;
      field.boutEnd[i] = t + (field.active[i] ? 8 + rand() * 22 : 3 + rand() * 8);
    }

    const p = field.phase[i];
    let dphi = field.omega[i];
    const couple = field.couple[i];
    field.order[i] = 0;
    if (couple > 0 && field.active[i]) {
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
      sc -= Math.cos(p);
      ss -= Math.sin(p);
      sn -= 1;
      if (sn > 0.5) {
        // K/n * sum(sin(phi_j - phi_i)) without atan2.
        const cp = Math.cos(p);
        const sp = Math.sin(p);
        dphi += (k * couple * (ss * cp - sc * sp)) / sn;
        field.order[i] = Math.sqrt(sc * sc + ss * ss) / sn;
      }
      if (driver) {
        const w = driverWeight(driver, Math.hypot(field.x[i] - driver.x, field.y[i] - driver.y));
        if (w > 0) {
          dphi += driver.gain * couple * w * Math.sin(driver.phase - p);
          field.order[i] = Math.max(field.order[i], w * 0.95);
        }
      }
    }

    let next = p + dphi * dt + (rand() - 0.5) * noiseAmp;
    if (next < 0) next += TAU;

    if (sweep && couple > 0) {
      const u = sweep.ax * field.x[i] + sweep.ay * field.y[i];
      if (u >= sweep.lo && u < sweep.hi) {
        field.active[i] = 1;
        field.boutEnd[i] = Math.max(field.boutEnd[i], t + 12 + rand() * 10);
        if (triggerFlash(field, i, t)) next = 0;
      }
    }

    if (t >= field.respondAt[i]) {
      field.respondAt[i] = Infinity;
      if (triggerFlash(field, i, t)) next = 0;
    }

    if (next >= TAU) {
      next -= TAU;
      if (field.active[i]) triggerFlash(field, i, t);
      next %= TAU;
    }
    field.phase[i] = next;
  }
}

/** Mean-field order parameter (0..1) over the live, fully coupled fireflies. */
export function globalOrder(field: FlashField): number {
  let c = 0;
  let s = 0;
  let m = 0;
  for (let i = 0; i < field.count; i++) {
    if (field.couple[i] < 1 || !field.live[i]) continue;
    c += Math.cos(field.phase[i]);
    s += Math.sin(field.phase[i]);
    m += 1;
  }
  return m > 0 ? Math.sqrt(c * c + s * s) / m : 0;
}

/* ------------------------------------------------------------------ the reader's rhythm */

export interface Rhythm {
  /** Tap times of the current run (at most the last five). */
  taps: number[];
  /** Taps in the current run. */
  beats: number;
  /** Mean interval of the run, clamped to the driver's period range. */
  period: number;
  /** At least three taps whose intervals vary by less than RHYTHM_CV_MAX. */
  steady: boolean;
}

export function createRhythm(): Rhythm {
  return { taps: [], beats: 0, period: DRIVER_MAX_PERIOD, steady: false };
}

/**
 * Records a tap at time t (seconds). Faster taps are clamped to the minimum period
 * before the steadiness test, so drumming quickly drives the fireflies at 0.8 s, never
 * faster. A gap over RHYTHM_BREAK_S, or an interval that breaks the steadiness of the
 * run, starts a new run.
 */
export function rhythmTap(r: Rhythm, t: number): Rhythm {
  const last = r.taps[r.taps.length - 1];
  if (last === undefined || !(t > last) || t - last > RHYTHM_BREAK_S) {
    r.taps = [t];
    r.beats = 1;
    r.steady = false;
    r.period = DRIVER_MAX_PERIOD;
    return r;
  }
  r.taps.push(t);
  if (r.taps.length > 5) r.taps.shift();
  r.beats += 1;
  const intervals: number[] = [];
  for (let i = 1; i < r.taps.length; i++) intervals.push(Math.max(DRIVER_MIN_PERIOD, r.taps[i] - r.taps[i - 1]));
  if (intervals.length < 2) {
    r.steady = false;
    r.period = clampPeriod(intervals[0]);
    return r;
  }
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const sd = Math.sqrt(intervals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / intervals.length);
  if (sd / mean >= RHYTHM_CV_MAX || mean > DRIVER_MAX_PERIOD) {
    // The run broke: the last two taps start a new one.
    r.taps = r.taps.slice(-2);
    r.beats = 2;
    r.steady = false;
    r.period = clampPeriod(r.taps[1] - r.taps[0]);
    return r;
  }
  r.steady = true;
  r.period = clampPeriod(mean);
  return r;
}
