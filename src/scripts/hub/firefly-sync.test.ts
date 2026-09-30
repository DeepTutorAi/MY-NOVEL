import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BASE_ATTACK,
  configureGrid,
  createFlashField,
  flashEnvelope,
  globalOrder,
  MIN_FLASH_INTERVAL,
  seedFirefly,
  SPECIES,
  startWave,
  stepField,
  SYNC_ATTACK,
  triggerFlash,
} from "./firefly-sync";
import { computeLayout, fireflyCount, layoutMode } from "./firefly-scene";
import { createRng } from "../_shared/scene-runtime";

function simulate(seconds: number, waves: number[]) {
  const rng = createRng(5);
  const field = createFlashField(200);
  field.count = 180;
  for (let i = 0; i < field.count; i++) {
    seedFirefly(field, i, rng);
    field.x[i] = rng() * 500;
    field.y[i] = rng() * 600;
  }
  configureGrid(field, 500, 600, 100);
  const dt = 1 / 60;
  const last = new Float64Array(field.count).fill(-Infinity);
  const perSecond = new Map<number, number>();
  let minGap = Infinity;
  let minAttackSynced = Infinity;
  const orderAt: number[] = [];
  for (let step = 0; step < seconds * 60; step++) {
    const t = step * dt;
    for (const w of waves) if (Math.abs(t - w) < dt / 2) startWave(field, t, 1, 0, 500);
    stepField(field, t, dt, rng);
    for (let i = 0; i < field.count; i++) {
      if (field.flashAt[i] === t) {
        if (last[i] > -Infinity) minGap = Math.min(minGap, t - last[i]);
        last[i] = t;
        const sec = Math.floor(t);
        perSecond.set(sec, (perSecond.get(sec) ?? 0) + 1);
        if (field.order[i] > 0.8) minAttackSynced = Math.min(minAttackSynced, field.attack[i]);
      }
    }
    if (step % 60 === 0) orderAt.push(globalOrder(field));
  }
  return { field, minGap, orderAt, minAttackSynced };
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
});

describe("firefly scene layout", () => {
  it("picks a composition by aspect ratio", () => {
    assert.equal(layoutMode(1440, 900), "wide");
    assert.equal(layoutMode(390, 844), "portrait");
    assert.equal(layoutMode(844, 390), "short");
    const portrait = computeLayout(390, 844);
    assert.ok(portrait.trees.filter((t) => t.near).length === 1, "portrait keeps one near tree mass");
    const short = computeLayout(844, 390);
    assert.ok(short.moonR <= 12);
    for (const tree of short.trees.filter((t) => t.near)) {
      assert.ok(tree.x1 < 844 * 0.25 || tree.x0 > 844 * 0.75, "near trees stay out of the middle");
    }
  });

  it("scales the firefly count by area and pointer type", () => {
    const desktop = fireflyCount(1440, 900, false);
    const phone = fireflyCount(390, 844, true);
    assert.ok(desktop >= 220 && desktop <= 290, `desktop ${desktop}`);
    assert.ok(phone >= 80 && phone <= 110, `phone ${phone}`);
  });
});
