import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BASE_ATTACK,
  CHORUS_BEATS,
  clampPeriod,
  configureGrid,
  createDriver,
  createFlashField,
  createRhythm,
  createWave,
  DRIVER_MAX_PERIOD,
  DRIVER_MIN_PERIOD,
  DRIVER_RADIUS,
  advanceDriver,
  boostCoupling,
  flashEnvelope,
  flashIntensity,
  frontAt,
  globalOrder,
  MIN_FLASH_INTERVAL,
  rhythmTap,
  seedFirefly,
  SPECIES,
  stepField,
  sweepBetween,
  SYNC_ATTACK,
  triggerFlash,
  type Driver,
  type WaveFront,
} from "./firefly-sync";
import { fireflyCount } from "./firefly-core";
import { createRng } from "../_shared/scene-runtime";

const TAU = Math.PI * 2;

/** A seeded chorus of `count` fireflies over a w x h area, with waves at the given times and an optional driver. */
function simulate(seconds: number, waves: number[], opts: { count?: number; w?: number; h?: number; driver?: Driver | null } = {}) {
  const rng = createRng(5);
  const count = opts.count ?? 180;
  const w = opts.w ?? 500;
  const h = opts.h ?? 600;
  const field = createFlashField(count + 10);
  field.count = count;
  for (let i = 0; i < field.count; i++) {
    seedFirefly(field, i, rng);
    field.x[i] = rng() * w;
    field.y[i] = rng() * h;
  }
  configureGrid(field, w, h, 100);
  const dt = 1 / 60;
  const last = new Float64Array(field.count).fill(-Infinity);
  const flashes: number[][] = Array.from({ length: field.count }, () => []);
  let minGap = Infinity;
  let minAttackSynced = Infinity;
  const orderAt: number[] = [];
  const mean: number[] = [];
  let wave: WaveFront | null = null;
  for (let step = 0; step < seconds * 60; step++) {
    const t = step * dt;
    for (const at of waves) {
      if (Math.abs(t - at) < dt / 2) {
        wave = createWave(t, 1, 0, 0, w);
        boostCoupling(field, t);
      }
    }
    if (opts.driver) advanceDriver(opts.driver, dt);
    stepField(field, t, dt, rng, sweepBetween(wave, t - dt, t), opts.driver ?? null);
    let sum = 0;
    for (let i = 0; i < field.count; i++) {
      if (field.flashAt[i] === t) {
        if (last[i] > -Infinity) minGap = Math.min(minGap, t - last[i]);
        last[i] = t;
        flashes[i].push(t);
        if (field.order[i] > 0.8) minAttackSynced = Math.min(minAttackSynced, field.attack[i]);
      }
      sum += flashIntensity(field, i, t);
    }
    mean.push(sum / field.count);
    if (step % 60 === 0) orderAt.push(globalOrder(field));
  }
  return { field, minGap, orderAt, minAttackSynced, flashes, mean, dt };
}

describe("firefly flash timing", () => {
  it("rises with an eased attack and returns to dark after the decay", () => {
    assert.equal(flashEnvelope(-0.1, 0.06, 0.4), 0);
    assert.equal(flashEnvelope(0, 0.06, 0.4), 0);
    assert.ok(flashEnvelope(0.003, 0.06, 0.4) < 0.01, "attack starts with zero slope");
    assert.ok(Math.abs(flashEnvelope(0.06, 0.06, 0.4) - 1) < 1e-9);
    assert.ok(flashEnvelope(0.26, 0.06, 0.4) > 0.4 && flashEnvelope(0.26, 0.06, 0.4) < 0.6);
    assert.equal(flashEnvelope(0.46, 0.06, 0.4), 0);
    assert.equal(flashEnvelope(1, 0.06, 0.4), 0);
  });

  it("never flashes one firefly faster than the refractory interval", () => {
    assert.ok(MIN_FLASH_INTERVAL >= 0.8);
    for (const species of SPECIES) assert.ok(species.period[0] >= MIN_FLASH_INTERVAL);
    const field = createFlashField(1);
    field.count = 1;
    assert.equal(triggerFlash(field, 0, 10), true);
    assert.equal(triggerFlash(field, 0, 10.5), false);
    assert.equal(triggerFlash(field, 0, 10 + MIN_FLASH_INTERVAL), true);

    const { minGap } = simulate(150, [50, 100]);
    assert.ok(minGap >= MIN_FLASH_INTERVAL - 1e-9, `min gap ${minGap}`);
  });

  it("synchronises the chorus after a wave and softens synced flashes", () => {
    const { orderAt, minAttackSynced } = simulate(90, [40]);
    const before = Math.max(...orderAt.slice(30, 40));
    const after = Math.max(...orderAt.slice(50, 70));
    assert.ok(after > 0.8, `order after wave ${after}`);
    assert.ok(after > before, `order before ${before}, after ${after}`);
    assert.ok(minAttackSynced > BASE_ATTACK && minAttackSynced <= SYNC_ATTACK, `synced attack ${minAttackSynced}`);
  });

  it("lets a firefly at rest run on its own phase: it neither broadcasts nor listens", () => {
    const field = createFlashField(4);
    field.count = 3;
    const half = () => 0.5;
    for (let i = 0; i < 3; i++) {
      seedFirefly(field, i, createRng(i + 1));
      field.x[i] = 10 + i;
      field.y[i] = 10;
      field.couple[i] = 1;
      field.boutEnd[i] = 1e9;
      field.flashAt[i] = -Infinity;
    }
    field.active[0] = 0;
    field.active[1] = 1;
    field.active[2] = 1;
    field.phase[0] = 1;
    field.phase[1] = 4;
    field.phase[2] = 4.2;
    configureGrid(field, 100, 100, 50);
    const dt = 1 / 60;
    const expected = (1 + field.omega[0] * dt) % TAU;
    stepField(field, 1, dt, half);
    assert.ok(Math.abs(field.phase[0] - expected) < 1e-5, `resting phase ${field.phase[0]} vs free run ${expected}`);
    assert.equal(field.order[0], 0);
    assert.ok(field.order[1] > 0.9, "the two active fireflies hear each other");
  });

  it("sweeps a front once across its range and reports what it crossed", () => {
    const wave = createWave(10, 3, 4, 0, 1000, 2);
    assert.ok(Math.abs(wave.ax - 0.6) < 1e-9 && Math.abs(wave.ay - 0.8) < 1e-9, "the axis is a unit vector");
    assert.equal(frontAt(wave, 9), null);
    assert.equal(frontAt(wave, 11), 500);
    assert.equal(frontAt(wave, 12.5), null);
    const a = sweepBetween(wave, 10.5, 11);
    assert.ok(a && Math.abs(a.lo - 250) < 1e-6 && Math.abs(a.hi - 500) < 1e-6);
    const shifted = sweepBetween(wave, 10.5, 11, 100, 50);
    assert.ok(shifted && Math.abs(shifted.lo - (250 - 100)) < 1e-6, "a window field sees the front shifted by its origin");
    assert.equal(sweepBetween(wave, 12.1, 12.2), null);
  });
});

describe("the reader's rhythm as a driver (spec 3.5 M4, 2.20)", () => {
  it("clamps the driver period to 0.8-1.6 s: fast drumming never drives faster than 0.8 s", () => {
    assert.equal(clampPeriod(0.3), DRIVER_MIN_PERIOD);
    assert.equal(clampPeriod(9), DRIVER_MAX_PERIOD);
    assert.equal(clampPeriod(Number.NaN), DRIVER_MAX_PERIOD);
    assert.ok(createDriver(0.2, 0, 0).omega <= TAU / DRIVER_MIN_PERIOD + 1e-12);
    const r = createRhythm();
    for (let k = 0; k < 6; k++) rhythmTap(r, 10 + k * 0.45);
    assert.equal(r.steady, true);
    assert.equal(r.period, DRIVER_MIN_PERIOD);
  });

  it("needs three steady taps (coefficient of variation under 15%) and restarts on a long gap", () => {
    const r = createRhythm();
    rhythmTap(r, 0);
    rhythmTap(r, 1.0);
    assert.equal(r.steady, false, "two taps are not a rhythm yet");
    rhythmTap(r, 2.02);
    assert.equal(r.steady, true);
    assert.ok(Math.abs(r.period - 1.01) < 1e-9);
    rhythmTap(r, 3.6);
    assert.equal(r.steady, false, "an interval of 1.58 s after 1.0 s breaks the run");
    assert.equal(r.beats, 2);
    rhythmTap(r, 7);
    assert.equal(r.beats, 1, "a gap over 2.4 s starts again");
    const slow = createRhythm();
    for (let k = 0; k < 4; k++) rhythmTap(slow, k * 1.9);
    assert.equal(slow.steady, false, "a period over 1.6 s is not a rhythm");
  });

  it("counts steady beats up to the chorus", () => {
    const r = createRhythm();
    for (let k = 0; k < CHORUS_BEATS; k++) rhythmTap(r, k * 1.1 + (k % 2 ? 0.03 : -0.03));
    assert.equal(r.steady, true);
    assert.equal(r.beats, CHORUS_BEATS);
  });

  it("caps flashes: at most 1.25 per second per firefly and at most 3 luminance flashes per second anywhere", () => {
    const driver = createDriver(DRIVER_MIN_PERIOD, 250, 300, Infinity);
    const { flashes, mean, dt } = simulate(40, [5, 25], { driver });
    for (const list of flashes) {
      for (let k = 1; k < list.length; k++) assert.ok(list[k] - list[k - 1] >= MIN_FLASH_INTERVAL - 1e-9, `gap ${list[k] - list[k - 1]}`);
      for (let k = 2; k < list.length; k++) assert.ok(list[k] - list[k - 2] > 1, "never three flashes inside one second");
    }
    // Pulses of the whole chorus: rising crossings of the mean brightness over its median.
    const sorted = [...mean].sort((a, b) => a - b);
    const level = sorted[Math.floor(sorted.length * 0.5)] + 0.02;
    const pulses: number[] = [];
    for (let k = 1; k < mean.length; k++) if (mean[k - 1] < level && mean[k] >= level) pulses.push(k * dt);
    for (let k = 3; k < pulses.length; k++) assert.ok(pulses[k] - pulses[k - 3] > 1, `four chorus pulses within ${pulses[k] - pulses[k - 3]} s`);
  });

  it("entrains fireflies within the driver radius in 2-4 cycles and leaves distant ones alone", () => {
    const rng = createRng(11);
    const field = createFlashField(80);
    field.count = 80;
    for (let i = 0; i < field.count; i++) {
      seedFirefly(field, i, rng);
      field.species[i] = 0;
      field.couple[i] = 1;
      field.active[i] = 1;
      field.boutEnd[i] = 1e9;
      const near = i < 40;
      const a = rng() * TAU;
      const d = near ? rng() * 150 : 900 + rng() * 150;
      field.x[i] = 1200 + Math.cos(a) * d;
      field.y[i] = 1200 + Math.sin(a) * d;
    }
    configureGrid(field, 2400, 2400, 100);
    const period = 1.2;
    const driver = createDriver(period, 1200, 1200);
    assert.equal(driver.radius, DRIVER_RADIUS);
    const dt = 1 / 60;
    const lock = (from: number, to: number) => {
      let c = 0;
      let s = 0;
      for (let i = from; i < to; i++) {
        c += Math.cos(field.phase[i] - driver.phase);
        s += Math.sin(field.phase[i] - driver.phase);
      }
      return Math.hypot(c, s) / (to - from);
    };
    const coherence = (from: number, to: number) => {
      let c = 0;
      for (let i = from; i < to; i++) c += Math.cos(field.phase[i] - driver.phase);
      return c / (to - from);
    };
    for (let step = 0; step < (4 * period) / dt; step++) {
      advanceDriver(driver, dt);
      stepField(field, step * dt, dt, rng, null, driver);
    }
    assert.ok(coherence(0, 40) > 0.85, `near fireflies in phase with the driver after 4 cycles: ${coherence(0, 40)}`);
    assert.ok(lock(40, 80) < 0.6, `distant fireflies are not driven: ${lock(40, 80)}`);
  });
});

describe("firefly counts", () => {
  it("scales by area and pointer type", () => {
    const desktop = fireflyCount(1440, 900, false);
    const phone = fireflyCount(390, 844, true);
    assert.ok(desktop >= 220 && desktop <= 290, `desktop ${desktop}`);
    assert.ok(phone >= 80 && phone <= 110, `phone ${phone}`);
  });
});
