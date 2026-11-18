import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashName } from "../guest-names-core.mjs";
import { PICK_GAP_MS, PICK_KEY, pickCandidates, pickNovel, pickSeed } from "./pick-core";
import type { CardInfo, CardKind, PickInput } from "./types";

const box = { x: 0, y: 0, w: 100, h: 100 };

function card(slug: string, index: number, kind: CardKind, read: number | null = null, finished = false): CardInfo {
  return { slug, kind, index, accent: "#ffffff", rect: box, media: box, body: box, read, finished, stateText: "", titleTh: slug };
}

const input = (cards: CardInfo[], extra: Partial<PickInput> = {}): PickInput => ({
  cards,
  resumeSlug: null,
  localDay: "2026-11-18",
  profileId: "guest",
  press: 0,
  ...extra,
});

describe("pick-core constants", () => {
  it("keeps the session key and the pick gap from the spec", () => {
    assert.equal(PICK_KEY, "piichan-novels:hub-pick");
    assert.equal(PICK_GAP_MS, 2600);
  });
});

describe("pickSeed", () => {
  it("is FNV-1a of day and profile joined by a colon", () => {
    assert.equal(pickSeed("2026-11-18", "guest"), hashName("2026-11-18:guest"));
    assert.notEqual(pickSeed("2026-11-18", "guest"), pickSeed("2026-11-19", "guest"));
    assert.notEqual(pickSeed("2026-11-18", "guest"), pickSeed("2026-11-18", "p_1"));
  });
});

describe("pickCandidates", () => {
  const cards = [
    card("a", 0, "open"),
    card("b", 1, "open", 0.4),
    card("c", 2, "locked"),
    card("d", 3, "open", 1, true),
    card("e", 4, "open"),
    card("f", 5, "upcoming"),
    card("g", 6, "open", 0.2),
  ];

  it("keeps only open, unfinished cards that are not the resumed novel", () => {
    const slugs = pickCandidates(cards, "g", 7).map((c) => c.slug).sort();
    assert.deepEqual(slugs, ["a", "b", "e"]);
  });

  it("never offers locked or upcoming cards", () => {
    const slugs = pickCandidates([card("x", 0, "locked"), card("y", 1, "upcoming")], null, 1);
    assert.deepEqual(slugs, []);
  });

  it("puts never-started novels before novels in progress", () => {
    for (const seed of [0, 1, 2, 99, 123456789]) {
      const order = pickCandidates(cards, null, seed);
      const firstStarted = order.findIndex((c) => c.read !== null);
      assert.ok(firstStarted > 0, `seed ${seed}`);
      assert.ok(order.slice(firstStarted).every((c) => c.read !== null), `seed ${seed}`);
    }
  });

  it("is deterministic for a seed and independent of input order", () => {
    const one = pickCandidates(cards, null, 42).map((c) => c.slug);
    const two = pickCandidates([...cards].reverse(), null, 42).map((c) => c.slug);
    assert.deepEqual(one, two);
  });

  it("shuffles: some seed changes the order of the never-started group", () => {
    const many = [0, 1, 2, 3, 4].map((i) => card(`n${i}`, i, "open"));
    const orders = new Set(Array.from({ length: 20 }, (_, seed) => pickCandidates(many, null, seed).map((c) => c.slug).join()));
    assert.ok(orders.size > 1);
  });
});

describe("pickNovel", () => {
  const cards = [card("a", 0, "open"), card("b", 1, "open"), card("c", 2, "open", 0.5), card("z", 3, "locked")];

  it("walks the candidate list press by press and wraps around", () => {
    const order = pickCandidates(cards, null, pickSeed("2026-11-18", "guest")).map((c) => c.slug);
    const picked = [0, 1, 2, 3, 4, 5].map((press) => pickNovel(input(cards, { press })).slug);
    assert.deepEqual(picked, [...order, ...order]);
  });

  it("reports new for a never-started novel and continue for one in progress", () => {
    const results = [0, 1, 2].map((press) => pickNovel(input(cards, { press })));
    for (const result of results) {
      const chosen = cards.find((c) => c.slug === result.slug);
      assert.ok(chosen);
      assert.equal(result.reason, chosen.read === null ? "new" : "continue");
    }
  });

  it("treats a negative or non-finite press as the first press", () => {
    const first = pickNovel(input(cards, { press: 0 }));
    assert.deepEqual(pickNovel(input(cards, { press: -3 })), first);
    assert.deepEqual(pickNovel(input(cards, { press: Number.NaN })), first);
  });

  it("varies with the day and the profile", () => {
    const many = Array.from({ length: 6 }, (_, i) => card(`n${i}`, i, "open"));
    const days = new Set(Array.from({ length: 10 }, (_, d) => pickNovel(input(many, { localDay: `2026-11-${10 + d}` })).slug));
    const profiles = new Set(Array.from({ length: 10 }, (_, p) => pickNovel(input(many, { profileId: `p_${p}` })).slug));
    assert.ok(days.size > 1);
    assert.ok(profiles.size > 1);
  });

  it("returns all-read when every open novel is finished", () => {
    const done = [card("a", 0, "open", 1, true), card("z", 1, "locked"), card("u", 2, "upcoming")];
    assert.deepEqual(pickNovel(input(done)), { slug: null, reason: "all-read" });
    assert.deepEqual(pickNovel(input([])), { slug: null, reason: "all-read" });
  });

  it("offers the unfinished resumed novel when it is the only one left", () => {
    const only = [card("a", 0, "open", 1, true), card("r", 1, "open", 0.3)];
    assert.deepEqual(pickNovel(input(only, { resumeSlug: "r" })), { slug: "r", reason: "continue" });
  });

  it("skips the resumed novel while another candidate exists", () => {
    const two = [card("r", 0, "open", 0.3), card("a", 1, "open")];
    for (const press of [0, 1, 2]) assert.equal(pickNovel(input(two, { resumeSlug: "r", press })).slug, "a");
  });
});
