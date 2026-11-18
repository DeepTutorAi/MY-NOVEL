import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BEAT_CARD_MS,
  BEAT_PAGE_MS,
  BURST_MS,
  GLOW_RISE_PER_S,
  PERCH_MAX,
  QUANT,
  RATE_HZ,
  createLimiter,
  quantise,
  quantiseAngle,
} from "./output-core";

function clock(start = 1000) {
  let t = start;
  return {
    now: () => t,
    advance(ms: number) {
      t += ms;
    },
  };
}

const GAP = Math.ceil(1000 / RATE_HZ);

describe("quantisation", () => {
  it("snaps to 1/64 and whole degrees", () => {
    assert.equal(QUANT, 1 / 64);
    assert.equal(quantise(0.5), 0.5);
    assert.equal(quantise(0.5 + QUANT * 0.4), 0.5);
    assert.equal(quantise(0.5 + QUANT * 0.6), 0.5 + QUANT);
    assert.equal(quantise(0.26, 0.1), 0.30000000000000004);
    assert.equal(quantiseAngle(41.4), 41);
    assert.equal(quantiseAngle(41.6), 42);
  });
});

describe("root writes", () => {
  it("writes quantised values, only the ones that changed", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    assert.deepEqual(lim.root({ "w-light": 0.501, "w-sun": 120.4 }), { "w-light": 0.5, "w-sun": 120 });
    c.advance(GAP);
    assert.equal(lim.root({ "w-light": 0.502, "w-sun": 119.8 }), null, "nothing changed after quantising");
    c.advance(GAP);
    assert.deepEqual(lim.root({ "w-light": 0.6, "w-sun": 120 }), { "w-light": quantise(0.6) });
  });

  it("writes at most 15 times per second", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    let writes = 0;
    for (let i = 0; i < 600; i++) {
      if (lim.root({ "w-breath": (i % 64) / 64 })) writes++;
      c.advance(1000 / 60);
    }
    assert.ok(writes <= RATE_HZ * 10 + 1, `${writes} writes in 10 s`);
    assert.ok(writes >= 110, `${writes} writes in 10 s: the rate is used`);
  });

  it("ignores non-finite values", () => {
    const lim = createLimiter(clock().now);
    assert.equal(lim.root({ "w-light": Number.NaN }), null);
  });
});

describe("card writes", () => {
  it("writes only to intersecting cards", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    assert.equal(lim.card("a", { "w-lx": 0.5 }, false), null);
    assert.deepEqual(lim.card("a", { "w-lx": 0.5 }, true), { "w-lx": 0.5 });
  });

  it("limits each card to 15 Hz independently", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    assert.ok(lim.card("a", { "w-lx": 0.1 }, true));
    assert.ok(lim.card("b", { "w-lx": 0.1 }, true), "another card is not limited by the first");
    c.advance(GAP - 10);
    assert.equal(lim.card("a", { "w-lx": 0.9 }, true), null);
    c.advance(10);
    assert.ok(lim.card("a", { "w-lx": 0.9 }, true));
  });

  it("skips changes below 1/64", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    lim.card("a", { "w-ly": 0.5 }, true);
    c.advance(GAP);
    assert.equal(lim.card("a", { "w-ly": 0.5 + QUANT * 0.3 }, true), null);
  });

  it("slews glow rises: 0 to 1 takes at least 0.55 s at any call rate", () => {
    for (const step of [1000 / 120, 1000 / 60, GAP, 250, 2000]) {
      const c = clock();
      const lim = createLimiter(c.now);
      let glow = 0;
      let elapsed = 0;
      while (glow < 1 && elapsed < 10_000) {
        const w = lim.card("a", { "w-glow": 1 }, true);
        if (w?.["w-glow"] !== undefined) glow = w["w-glow"];
        if (glow >= 1) break;
        c.advance(step);
        elapsed += step;
      }
      assert.equal(glow, 1);
      assert.ok(elapsed >= 1000 / GLOW_RISE_PER_S - 1, `step ${step} ms: reached 1 after ${elapsed} ms`);
    }
  });

  it("lets glow fall freely", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    for (let i = 0; i < 20; i++) {
      lim.card("a", { "w-glow": 1 }, true);
      c.advance(GAP);
    }
    assert.deepEqual(lim.card("a", { "w-glow": 0 }, true), { "w-glow": 0 });
  });
});

describe("deferred writes (pending values per variable)", () => {
  it("merges a second root() call in the same frame into that frame's write", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    const breath: number[] = [];
    for (let frame = 0; frame < 120; frame++) {
      lim.root({ "w-light": 0.3 + 0.032 * frame });
      const out = lim.root({ "w-breath": 0.25 + (frame % 8) / 64 });
      if (out?.["w-breath"] !== undefined) breath.push(out["w-breath"]);
      c.advance(1000 / 60);
    }
    assert.ok(breath.length >= 20, `w-breath written ${breath.length} times in 2 s`);
  });

  it("keeps a root value deferred by the rate limit and writes it with the next allowed write", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    assert.deepEqual(lim.root({ "w-light": 0.5 }), { "w-light": 0.5 });
    c.advance(BURST_MS + 1);
    assert.equal(lim.root({ "w-breath": 0.25 }), null, "inside the rate gap");
    c.advance(GAP);
    assert.deepEqual(lim.root({ "w-light": 0.75 }), { "w-breath": 0.25, "w-light": 0.75 }, "merged set at the next allowed write");
  });

  it("flushes the last root value after the scene stops writing", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    lim.root({ "w-light": 0.5 });
    c.advance(20);
    assert.equal(lim.root({ "w-light": 0.25 }), null);
    assert.equal(lim.pendingAt(), 1000 + 1000 / RATE_HZ, "the deferred value is due one rate gap after the last write");
    assert.equal(lim.flush(() => true).root, null, "not yet due");
    c.advance(GAP);
    assert.deepEqual(lim.flush(() => true).root, { "w-light": 0.25 });
    assert.equal(lim.pendingAt(), null, "nothing waits after the flush");
  });

  it("flushes a deferred card value and keeps the 15 Hz cap", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    lim.card("a", { "w-lx": 0.1 }, true);
    c.advance(20);
    assert.equal(lim.card("a", { "w-ly": 0.9 }, true), null);
    assert.equal(lim.flush(() => true).cards.length, 0, "not yet due");
    c.advance(GAP - 20);
    assert.deepEqual(lim.flush(() => true).cards, [["a", { "w-ly": 0.90625 }]]);
    c.advance(1);
    assert.equal(lim.card("a", { "w-lx": 0.5 }, true), null, "a flush opens a rate window and no same-frame burst");
  });

  it("drops a deferred card value when the card left the viewport", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    lim.card("a", { "w-lx": 0.1 }, true);
    c.advance(20);
    lim.card("a", { "w-lx": 0.6 }, true);
    c.advance(GAP);
    assert.deepEqual(lim.flush(() => false).cards, []);
    assert.equal(lim.pendingAt(), null);
  });

  it("keeps raising a glow written once until it reaches its target", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    let glow = lim.card("a", { "w-glow": 1 }, true)?.["w-glow"] ?? 0;
    assert.ok(glow > 0 && glow < 1);
    let elapsed = 0;
    for (let guard = 0; glow < 1 && guard < 200; guard++) {
      const at = lim.pendingAt();
      assert.ok(at !== null, `glow stalled at ${glow}`);
      c.advance(at - c.now());
      elapsed = c.now() - 1000;
      for (const [, vars] of lim.flush(() => true).cards) glow = vars["w-glow"] ?? glow;
    }
    assert.equal(glow, 1);
    assert.ok(elapsed >= 1000 / GLOW_RISE_PER_S - 1, `reached 1 after ${elapsed} ms`);
  });

  it("drops deferred values on entering still mode", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    lim.root({ "w-light": 0.5 });
    c.advance(20);
    lim.root({ "w-light": 0.25 });
    lim.setStill(true);
    assert.equal(lim.pendingAt(), null);
  });
});

describe("still composition and resume", () => {
  it("slews the first live glow after resume from the seeded still value", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    lim.setStill(true);
    lim.seed("tsukinomi", { "w-glow": 1, "w-lx": 0.3 });
    c.advance(5000);
    lim.setStill(false);
    assert.equal(lim.card("tsukinomi", { "w-glow": 1, "w-lx": 0.3 }, true), null, "nothing changed against the composed values");
    c.advance(GAP);
    assert.deepEqual(lim.card("tsukinomi", { "w-glow": 0.8 }, true), { "w-glow": 0.796875 }, "falls are free from the seeded value");
  });

  it("keeps the values written in motion across still mode, and opens the rate window", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    for (let i = 0; i < 20; i++) {
      lim.card("a", { "w-glow": 1 }, true);
      c.advance(GAP);
    }
    lim.root({ "w-light": 0.5 });
    lim.setStill(true);
    lim.setStill(false);
    assert.equal(lim.card("a", { "w-glow": 1 }, true), null, "a card the still did not compose keeps its motion value");
    assert.deepEqual(lim.root({ "w-light": 0.75 }), { "w-light": 0.75 }, "the first write after resume is not rate limited");
  });

  it("seedRoot records composed root values", () => {
    const lim = createLimiter(clock().now);
    lim.seedRoot({ "w-sun": 120.4, "w-sky": 0.6 });
    assert.equal(lim.root({ "w-sun": 120, "w-sky": 0.6 }), null);
  });
});

describe("beats", () => {
  it("alternates a and b per target, at most one per card per 2 s", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    assert.equal(lim.beat("a"), "a");
    c.advance(BEAT_CARD_MS - 1);
    assert.equal(lim.beat("a"), null);
    c.advance(1);
    assert.equal(lim.beat("a"), "b");
    c.advance(BEAT_CARD_MS);
    assert.equal(lim.beat("a"), "a");
  });

  it("allows at most 3 beats per second across the page", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    assert.ok(lim.beat("a"));
    assert.ok(lim.beat("b"));
    assert.ok(lim.beat("c"));
    assert.equal(lim.beat("d"), null);
    c.advance(1000);
    assert.ok(lim.beat("d"));
  });

  it("spaces page-wide beats at least 800 ms apart", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    assert.equal(lim.beat(null), "a");
    c.advance(BEAT_PAGE_MS - 1);
    assert.equal(lim.beat(null), null);
    c.advance(1);
    assert.equal(lim.beat(null), "b");
  });

  it("never exceeds 3 beats in any second under a flood of requests", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    const times: number[] = [];
    for (let i = 0; i < 2000; i++) {
      if (lim.beat(`card-${i % 7}`) || lim.beat(null)) times.push(c.now());
      c.advance(7);
    }
    for (let i = 3; i < times.length; i++) assert.ok(times[i] - times[i - 3] >= 1000);
  });
});

describe("perches", () => {
  it("allocates ids from 1, at most 3 live", () => {
    const lim = createLimiter(clock().now);
    const ids = Array.from({ length: PERCH_MAX }, () => lim.perch());
    assert.deepEqual(ids, [1, 2, 3]);
    assert.equal(lim.perch(), 0);
    assert.equal(lim.unperch(2), true);
    assert.equal(lim.unperch(2), false);
    assert.equal(lim.perch(), 4);
  });
});

describe("still mode", () => {
  it("turns every limited call into a no-op until motion returns", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    lim.setStill(true);
    assert.equal(lim.still, true);
    assert.equal(lim.root({ "w-light": 1 }), null);
    assert.equal(lim.card("a", { "w-glow": 1 }, true), null);
    assert.equal(lim.beat("a"), null);
    assert.equal(lim.beat(null), null);
    assert.equal(lim.perch(), 0);
    lim.setStill(false);
    assert.ok(lim.root({ "w-light": 1 }));
  });

  it("lets the still composition place perches up to the cap", () => {
    const lim = createLimiter(clock().now);
    lim.setStill(true);
    assert.equal(lim.perch(), 0, "a live call is refused");
    const ids = Array.from({ length: PERCH_MAX }, () => lim.perch(true));
    assert.deepEqual(ids, [1, 2, 3]);
    assert.equal(lim.perch(true), 0, "the cap still holds");
  });

  it("reset forgets rates, values and perches but keeps beats alternating", () => {
    const c = clock();
    const lim = createLimiter(c.now);
    lim.root({ "w-light": 1 });
    lim.beat("a");
    lim.perch();
    lim.perch();
    lim.perch();
    lim.reset();
    assert.deepEqual(lim.root({ "w-light": 1 }), { "w-light": 1 }, "the same value is written again");
    assert.equal(lim.beat("a"), "b");
    assert.ok(lim.perch() > 0);
  });
});
