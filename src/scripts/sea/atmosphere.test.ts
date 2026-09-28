import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SEA_ZONES } from "../../data/sea/zones";
import {
  blendState,
  capDpr,
  crossfadeWeight,
  fadeFactor,
  isCulled,
  measureProseBand,
  mixRgb,
  parseColor,
  particleBudget,
  profileState,
  STATE_DENSITY,
  STATE_FOG,
  STATE_LENGTH,
} from "./atmosphere/engine";
import { ATMOSPHERE_PROFILES, KIND_COUNT, MAX_FOG_SPRITES, PARTICLE_KINDS } from "./atmosphere/profiles";
import { parseZoneShifts, zoneForScene } from "./reader/zone-shifts";

describe("atmosphere profiles", () => {
  it("covers every canon zone and nothing else", () => {
    assert.deepEqual(Object.keys(ATMOSPHERE_PROFILES).sort(), [...SEA_ZONES].sort());
  });

  it("keeps each profile within budget and shares summing to one", () => {
    for (const zone of SEA_ZONES) {
      const profile = ATMOSPHERE_PROFILES[zone];
      assert.ok(profile.density > 0 && profile.density <= 1, `${zone} density`);
      assert.ok(profile.fog >= 0 && profile.fog <= MAX_FOG_SPRITES, `${zone} fog`);
      assert.ok(profile.light > 0 && profile.light <= 1, `${zone} light`);
      const shares = Object.values(profile.kinds).reduce((sum, spec) => sum + (spec?.share ?? 0), 0);
      assert.ok(Math.abs(shares - 1) < 1e-9, `${zone} shares sum to ${shares}`);
      for (const kind of Object.keys(profile.kinds)) {
        assert.ok((PARTICLE_KINDS as readonly string[]).includes(kind), `${zone} kind ${kind}`);
      }
    }
  });

  it("keeps rain out of the dry and foggy zones and in Elaris", () => {
    assert.ok(ATMOSPHERE_PROFILES.elaris.kinds.rain);
    for (const zone of ["shroud", "capital", "mistwood", "air-shelf"] as const) {
      assert.equal(ATMOSPHERE_PROFILES[zone].kinds.rain, undefined, zone);
      assert.equal(ATMOSPHERE_PROFILES[zone].kinds.drop, undefined, zone);
    }
    assert.ok(ATMOSPHERE_PROFILES["air-shelf"].glow > 0);
    assert.ok(ATMOSPHERE_PROFILES.shroud.fog > 0);
  });

  it("dims the sea layers with depth", () => {
    const layers = ["sun-sheet", "drowned-quarter", "pressure-veil", "old-pressure", "first-memory"] as const;
    for (let i = 1; i < layers.length; i += 1) {
      assert.ok(ATMOSPHERE_PROFILES[layers[i]].light < ATMOSPHERE_PROFILES[layers[i - 1]].light, layers[i]);
    }
  });
});

describe("prose culling", () => {
  // Column 300..700 px wide, starting 900 px down the document, 3000 px tall.
  const band = measureProseBand({ left: 300, right: 700, top: 900, bottom: 3900 }, 0);

  it("pads the column horizontally by 16px and keeps document-space extent", () => {
    assert.deepEqual(band, { left: 284, right: 716, top: 900, bottom: 3900 });
    assert.deepEqual(measureProseBand({ left: 0, right: 10, top: -200, bottom: 50 }, 500, 0), {
      left: 0,
      right: 10,
      top: 300,
      bottom: 550,
    });
  });

  it("skips points over the prose and keeps the margins and header", () => {
    assert.equal(isCulled(500, 400, band, 1000), true);
    assert.equal(isCulled(290, 400, band, 1000), true, "inside the 16px pad");
    assert.equal(isCulled(250, 400, band, 1000), false, "left margin");
    assert.equal(isCulled(760, 400, band, 1000), false, "right margin");
    assert.equal(isCulled(500, 400, band, 0), false, "chapter header above the prose");
    assert.equal(isCulled(500, 400, band, 3600), false, "below the prose end");
  });

  it("extends over the chapter end but not above the prose", () => {
    // Chapter end 250..750 wide; the article closes 400 px below the prose.
    const withEnd = measureProseBand({ left: 300, right: 700, top: 900, bottom: 3900 }, 0, 16, {
      left: 250,
      right: 750,
      bottom: 4300,
    });
    assert.deepEqual(withEnd, { left: 234, right: 766, top: 900, bottom: 4300 });
    assert.equal(isCulled(500, 400, withEnd, 3800), true, "behind the end mark and chapter cards");
    assert.equal(isCulled(240, 400, withEnd, 3800), true, "wider chapter cards");
    assert.equal(isCulled(500, 400, withEnd, 0), false, "chapter header above the prose");
    assert.equal(isCulled(500, 400, withEnd, 4000), false, "below the article");
  });

  it("never culls without a prose column", () => {
    assert.equal(isCulled(500, 400, null, 1000), false);
  });
});

describe("device budgets", () => {
  it("caps DPR at 2 and at 1.5 on small viewports", () => {
    assert.equal(capDpr(3, 1440), 2);
    assert.equal(capDpr(1.25, 1440), 1.25);
    assert.equal(capDpr(3, 760), 1.5);
    assert.equal(capDpr(3, 375), 1.5);
    assert.equal(capDpr(1, 375), 1);
    assert.equal(capDpr(0, 1440), 1);
    assert.equal(capDpr(Number.NaN, 1440), 1);
  });

  it("uses the smaller particle budget on small viewports", () => {
    assert.equal(particleBudget(1440), 120);
    assert.equal(particleBudget(761), 120);
    assert.equal(particleBudget(760), 50);
  });
});

describe("crossfade", () => {
  it("eases from 0 to 1 over 1.2s by default", () => {
    assert.equal(crossfadeWeight(0), 0);
    assert.equal(crossfadeWeight(-50), 0);
    assert.equal(crossfadeWeight(600), 0.5);
    assert.equal(crossfadeWeight(1200), 1);
    assert.equal(crossfadeWeight(5000), 1);
    assert.ok(crossfadeWeight(300) < 0.25, "starts slow");
    assert.equal(crossfadeWeight(10, 0), 1);
  });

  it("blends profile states linearly by weight", () => {
    const from = profileState(ATMOSPHERE_PROFILES.elaris);
    const to = profileState(ATMOSPHERE_PROFILES.shroud);
    const out = new Float32Array(STATE_LENGTH);
    blendState(from, to, 0.5, out);
    assert.ok(Math.abs(out[STATE_DENSITY] - 0.65) < 1e-6);
    assert.ok(Math.abs(out[STATE_FOG] - 3) < 1e-6);
    assert.deepEqual(Array.from(blendState(from, to, 1, out)), Array.from(to));
    assert.deepEqual(Array.from(blendState(from, to, 0, out)), Array.from(from));
  });

  it("stores per-kind presence as density times share", () => {
    const state = profileState(ATMOSPHERE_PROFILES.elaris);
    const rain = PARTICLE_KINDS.indexOf("rain");
    assert.ok(Math.abs(state[rain] - 0.85 * 0.93) < 1e-6);
    let total = 0;
    for (let k = 0; k < KIND_COUNT; k += 1) total += state[k];
    assert.ok(Math.abs(total - state[STATE_DENSITY]) < 1e-6);
  });

  it("fades outgoing kinds to zero and incoming kinds up to full", () => {
    assert.equal(fadeFactor(0.8, 0, 0.8), 1);
    assert.equal(fadeFactor(0.8, 0, 0.2), 0.25);
    assert.equal(fadeFactor(0.8, 0, 0), 0);
    assert.equal(fadeFactor(0, 0.4, 0.1), 0.25);
    assert.equal(fadeFactor(0, 0.4, 0.4), 1);
    assert.equal(fadeFactor(0, 0, 0), 0);
  });
});

describe("palette helpers", () => {
  it("parses the token formats used by tokens.css", () => {
    assert.deepEqual(parseColor("#00E5FF"), [0, 229, 255]);
    assert.deepEqual(parseColor(" #abc "), [170, 187, 204]);
    assert.deepEqual(parseColor("rgba(0, 229, 255, 0.015)"), [0, 229, 255]);
    assert.deepEqual(parseColor("rgb(12 34 56 / 0.5)"), [12, 34, 56]);
    assert.equal(parseColor(""), null);
    assert.equal(parseColor("var(--x)"), null);
  });

  it("mixes two colors", () => {
    assert.deepEqual(mixRgb([0, 0, 0], [200, 100, 50], 0.5), [100, 50, 25]);
  });
});

describe("zone shifts", () => {
  it("parses, validates and sorts the data attribute", () => {
    assert.deepEqual(parseZoneShifts('[{"scene":6,"zone":"capital"},{"scene":2,"zone":"shroud"}]'), [
      { scene: 2, zone: "shroud" },
      { scene: 6, zone: "capital" },
    ]);
    assert.deepEqual(parseZoneShifts("[]"), []);
    assert.deepEqual(parseZoneShifts(undefined), []);
    assert.deepEqual(parseZoneShifts("not json"), []);
    assert.deepEqual(parseZoneShifts('[{"scene":1.5,"zone":"shroud"},{"scene":2,"zone":"atlantis"}]'), []);
  });

  it("picks the last shift at or before the current scene", () => {
    const shifts = parseZoneShifts('[{"scene":3,"zone":"shroud"},{"scene":6,"zone":"capital"}]');
    assert.equal(zoneForScene(0, shifts, "elaris"), "elaris");
    assert.equal(zoneForScene(2, shifts, "elaris"), "elaris");
    assert.equal(zoneForScene(3, shifts, "elaris"), "shroud");
    assert.equal(zoneForScene(5, shifts, "elaris"), "shroud");
    assert.equal(zoneForScene(9, shifts, "elaris"), "capital");
  });
});
