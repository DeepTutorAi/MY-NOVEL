import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { createBus } from "./bus";
import { createOutput } from "./output";
import { ANNOUNCE_MS } from "./output-core";
import type { CardInfo, HubState, PageModel, PageSnapshot, Rect } from "./types";

/* ------------------------------------------------------------------ fakes */

class FakeElement {
  props = new Map<string, string>();
  dataset: Record<string, string | undefined> = {};
  isConnected = true;
  style = {
    setProperty: (name: string, value: string) => void this.props.set(name, value),
    removeProperty: (name: string) => void this.props.delete(name),
  };
  constructor(slug?: string) {
    if (slug) this.dataset.novelSlug = slug;
  }
}

function fakeDocument(slugs: string[]) {
  const page = new FakeElement();
  const hero = new FakeElement();
  const footer = new FakeElement();
  const wrappers = slugs.map((slug) => new FakeElement(slug));
  return {
    page,
    wrappers,
    querySelector: (selector: string) => (selector === ".hub-page" ? page : selector === ".hub-hero" ? hero : null),
    querySelectorAll: (selector: string) => (selector === ".novel-card-wrapper" ? wrappers : selector === ".hub-hero, .hub-footer" ? [hero, footer] : []),
  };
}

function fakePage(slugs: string[]): PageModel {
  const rect: Rect = { x: 0, y: 100, w: 300, h: 200 };
  const cards = slugs.map((slug, index) => ({ slug, index, rect }) as unknown as CardInfo);
  const snapshot = { version: 1, viewport: { w: 1440, h: 900, coarse: false, dpr: 1 }, cards } as unknown as PageSnapshot;
  return {
    getSnapshot: () => snapshot,
    refresh: () => snapshot,
    subscribe: () => () => undefined,
    zoneAt: () => "open",
    cardAt: () => null,
    isCovered: () => false,
    holeDistance: () => Infinity,
    toViewport: (r) => r,
    dispose() {},
  };
}

const clock = { t: 1000 };
/** Moves the injected clock and the mocked timers together, 1 ms at a time. */
const advance = (ms: number) => {
  const end = clock.t + ms;
  while (clock.t < end) {
    const step = Math.min(1, end - clock.t);
    clock.t += step;
    mock.timers.tick(step);
  }
};

function setup(slugs = ["a", "b"]) {
  const doc = fakeDocument(slugs);
  (globalThis as unknown as { document: unknown }).document = doc;
  const state: HubState = {};
  const bus = createBus(new EventTarget(), () => state);
  const out = createOutput({ key: "firefly", page: fakePage(slugs), bus, now: () => clock.t });
  const glow = (i: number) => doc.wrappers[i].props.get("--w-glow");
  const events: { name: string; detail: unknown }[] = [];
  for (const name of ["hub:out-perch", "hub:out-unperch", "hub:out-announce"] as const) bus.on(name, (detail) => events.push({ name, detail }));
  return { doc, out, bus, events, glow, root: (name: string) => doc.page.props.get(`--${name}`) };
}

beforeEach(() => {
  clock.t = 1000;
  mock.timers.enable({ apis: ["setTimeout"] });
});

afterEach(() => {
  mock.timers.reset();
  delete (globalThis as unknown as { document?: unknown }).document;
});

/* ------------------------------------------------------------------ tests */

describe("output: rate limit counts writes, not calls", () => {
  it("lands two root variables written in separate calls in the same frame", () => {
    const { out, root } = setup();
    const seen = new Set<string>();
    for (let frame = 0; frame < 30; frame++) {
      out.root({ "w-light": 0.2 + frame / 64 });
      out.root({ "w-breath": 0.1 + (frame % 5) / 64 });
      seen.add(`${root("w-light")}|${root("w-breath")}`);
      advance(1000 / 60);
    }
    assert.ok(root("w-breath") !== undefined, "w-breath reached the DOM");
    assert.ok([...seen].filter((s) => !s.endsWith("|undefined")).length >= 6, `${seen.size} distinct writes`);
  });

  it("writes the last root value after the scene stops writing", () => {
    const { out, root } = setup();
    out.root({ "w-light": 0.5 });
    advance(20);
    out.root({ "w-light": 0.25 });
    assert.equal(root("w-light"), "0.5", "inside the 15 Hz gap");
    advance(60);
    assert.equal(root("w-light"), "0.25", "the deferred value lands without another call");
  });

  it("writes the last card value after the scene stops writing", () => {
    const { out, doc } = setup();
    out.card("a", { "w-lx": 0.25 });
    advance(20);
    out.card("a", { "w-lx": 0.75 });
    assert.equal(doc.wrappers[0].props.get("--w-lx"), "0.25");
    advance(60);
    assert.equal(doc.wrappers[0].props.get("--w-lx"), "0.75");
  });

  it("keeps raising a glow written once to its target at the slew limit", () => {
    const { out, glow } = setup();
    out.card("a", { "w-glow": 1 });
    const first = Number(glow(0));
    assert.ok(first > 0 && first < 0.2, `first step ${first}`);
    advance(500);
    assert.ok(Number(glow(0)) < 1, "0 to 1 takes at least 0.55 s");
    advance(200);
    assert.equal(glow(0), "1");
  });
});

describe("output: still then resume", () => {
  it("does not dim a card lit by the still composition on unpause", () => {
    const { out, glow } = setup();
    out.still({ "w-light": 0.5 }, { a: { "w-glow": 1 } });
    assert.equal(glow(0), "1");
    advance(3000);
    out.resume();
    for (let i = 0; i < 20; i++) {
      out.card("a", { "w-glow": 1 });
      assert.equal(glow(0), "1", `frame ${i} after resume`);
      advance(1000 / 60);
    }
  });

  it("drops a deferred value when the still composition takes over", () => {
    const { out, root } = setup();
    out.root({ "w-light": 0.5 });
    advance(20);
    out.root({ "w-light": 0.25 });
    out.still({ "w-light": 0.75 }, {});
    advance(200);
    assert.equal(root("w-light"), "0.75");
  });

  it("lets the still composition place DOM perches and replaces them on the next composition", () => {
    const { out, events } = setup();
    const named = (name: string) => events.filter((e) => e.name === name);
    out.still({}, {});
    assert.equal(out.perch("card-top", { kind: "moth", u: 0.5 }), 0, "a perch outside the composition is refused while still");
    out.compose?.(true);
    const first = out.perch("a", { kind: "moth", u: 0.4 });
    out.still({ "w-light": 0.5 }, {});
    out.compose?.(false);
    assert.ok(first > 0, "the composition perches while still");
    assert.equal(named("hub:out-unperch").length, 0, "still() inside the composition keeps it");
    out.compose?.(true);
    assert.deepEqual(named("hub:out-unperch").at(-1)?.detail, { id: first }, "the next composition clears the last one's");
    const second = out.perch("a", { kind: "moth", u: 0.4 });
    out.compose?.(false);
    out.resume();
    assert.deepEqual(named("hub:out-unperch").at(-1)?.detail, { id: second }, "leaving still mode clears the composed perch");
  });

  it("stops its flush timer on dispose", () => {
    const { out, root } = setup();
    out.root({ "w-light": 0.5 });
    advance(20);
    out.root({ "w-light": 0.25 });
    out.dispose();
    advance(200);
    assert.equal(root("w-light"), undefined, "dispose removed the variable and nothing wrote it back");
  });
});

describe("output: announce", () => {
  it("emits hub:out-announce with trimmed text, at most once per 10 s per page", () => {
    const { out, bus, events } = setup();
    const texts = () => events.filter((e) => e.name === "hub:out-announce").map((e) => (e.detail as { text: string }).text);
    out.announce?.("  ");
    out.announce?.(" หิ่งห้อยกะพริบพร้อมกันแล้ว ");
    out.announce?.("อีกครั้ง");
    assert.deepEqual(texts(), ["หิ่งห้อยกะพริบพร้อมกันแล้ว"]);
    const other = createOutput({ key: "mothlight", page: fakePage(["a"]), bus, now: () => clock.t });
    other.announce?.("ธีมใหม่");
    assert.equal(texts().length, 1, "a second output on the same page shares the window");
    advance(ANNOUNCE_MS);
    out.announce?.("อีกครั้ง");
    assert.deepEqual(texts(), ["หิ่งห้อยกะพริบพร้อมกันแล้ว", "อีกครั้ง"]);
    out.dispose();
    advance(ANNOUNCE_MS);
    out.announce?.("หลังปิด");
    assert.equal(texts().length, 2, "nothing after dispose");
  });
});
