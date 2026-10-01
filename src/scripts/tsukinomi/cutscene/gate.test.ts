// Pins the inline no-flash gate in TsukinomiCutscene.astro to the shared rule.
// The gate runs before first paint as plain inline JS and cannot import
// core.ts, so its copy of the cooldown and trigger rule is evaluated here and
// compared with core.ts over a table of inputs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { parseCutsceneParams, playedToday as corePlayedToday, shouldPlay } from "../../_shared/cutscene/core";

const component = readFileSync(join(process.cwd(), "src/components/tsukinomi/cutscene/TsukinomiCutscene.astro"), "utf8");
const indexSource = readFileSync(join(process.cwd(), "src/scripts/tsukinomi/cutscene/index.ts"), "utf8");

interface Gate {
  covers(search: string, traverse: boolean, stored: string | null, now: Date, dev: boolean): boolean;
  playedToday(stored: string | null, now: Date): boolean;
}

function loadGate(): Gate {
  const begin = component.indexOf("// gate:begin");
  const end = component.indexOf("// gate:end");
  assert.ok(begin !== -1 && end > begin, "the gate's rule must sit between gate:begin and gate:end markers");
  const body = component.slice(component.indexOf("\n", begin), end);
  return new Function(`${body}\nreturn { covers, playedToday };`)() as Gate;
}

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);

const NOWS = [
  local(2026, 9, 30, 12, 0),
  local(2026, 9, 30, 5, 59), // before the reset: the cooldown day began yesterday at 06:00
  local(2026, 9, 30, 6, 0),
  local(2026, 10, 1, 0, 30),
  local(2026, 10, 25, 12, 0), // around the end of daylight saving in many zones
  local(2026, 3, 29, 12, 0),
];

function storedValues(now: Date): Array<string | null> {
  const day = new Date(now);
  day.setHours(6, 0, 0, 0);
  if (day.getTime() > now.getTime()) day.setDate(day.getDate() - 1);
  const start = day.getTime();
  const at = (ms: number) => new Date(ms).toISOString();
  return [
    null,
    "",
    "   ",
    "garbage",
    "null",
    at(start),
    at(start - 1),
    at(start + 60_000),
    at(now.getTime()),
    at(start - 3_600_000),
    at(start + 86_400_000 - 1),
    at(start + 86_400_000),
    at(start + 86_400_000 * 40),
    String(start),
    String(start - 1),
    String(now.getTime()),
    String(now.getTime() - 25 * 3_600_000),
    String(now.getTime() - 2 * 3_600_000),
    "-5",
    "0",
    "99999999999999999999",
    " 123 ",
  ];
}

const SEARCHES = [
  "",
  "?resume=1",
  "?resume=0",
  "?cutscene=replay",
  "?cutscene=force",
  "?cutscene=force&scene=sealed-depth",
  "?cutscene=replay&resume=1",
  "?cutscene=force&resume=1",
  "?cutscene=other",
  "?x=1&resume=1&y=2",
];

describe("the inline gate in TsukinomiCutscene.astro", () => {
  const gate = loadGate();

  it("reads a stored value exactly as core.playedToday does, ISO or numeric, around the 06:00 reset", () => {
    for (const now of NOWS) {
      for (const stored of storedValues(now)) {
        assert.equal(gate.playedToday(stored, now), corePlayedToday(stored, now), `stored ${JSON.stringify(stored)} at ${now.toString()}`);
      }
    }
  });

  it("decides to cover exactly when core.shouldPlay says the cutscene plays", () => {
    let checked = 0;
    for (const now of NOWS) {
      for (const stored of storedValues(now)) {
        for (const search of SEARCHES) {
          for (const traverse of [false, true]) {
            for (const dev of [false, true]) {
              const params = parseCutsceneParams(search);
              const expected = shouldPlay({
                hasEntry: true,
                resume: params.resume,
                traversal: traverse,
                played: corePlayedToday(stored, now),
                replay: params.replay,
                force: params.force,
                dev,
              });
              assert.equal(
                gate.covers(search, traverse, stored, now, dev),
                expected,
                `search ${search} traverse ${traverse} dev ${dev} stored ${JSON.stringify(stored)} at ${now.toString()}`,
              );
              checked++;
            }
          }
        }
      }
    }
    assert.ok(checked > 5000);
  });

  it("counts an old numeric millisecond value as played today, and never covers a replay or force-in-dev twice over", () => {
    const now = local(2026, 9, 30, 12, 0);
    assert.equal(gate.covers("", false, String(now.getTime() - 3_600_000), now, false), false);
    assert.equal(gate.covers("?cutscene=replay", false, String(now.getTime() - 3_600_000), now, false), true);
    assert.equal(gate.covers("?cutscene=force", false, String(now.getTime() - 3_600_000), now, false), false);
    assert.equal(gate.covers("?cutscene=force", false, String(now.getTime() - 3_600_000), now, true), true);
  });

  it("uses the same played key, cover class and safety timeout as the adapter", () => {
    assert.match(component, /"tsukinomi:cutscene:played:" \+ dialog\.dataset\.part/);
    assert.match(indexSource, /PLAYED_PREFIX = "tsukinomi:cutscene:played:"/);
    assert.match(component, /const COVER = "tsuki-cutscene-pending"/);
    assert.match(indexSource, /COVER_CLASS = "tsuki-cutscene-pending"/);
    assert.match(component, /html\.tsuki-cutscene-pending body::after/);
    assert.match(component, /arm\(2500\)/);
    assert.match(component, /nav\.hold = /);
    assert.match(indexSource, /SCENE_LOAD_BUDGET_MS = 3000/);
    assert.match(indexSource, /__tsukiCutsceneNav\?\.hold\?\.\(SCENE_LOAD_BUDGET_MS\)/);
    assert.match(component, /navigationType === "traverse"/);
    assert.match(component, /document\.addEventListener\("astro:after-swap", cover\)/);
    assert.match(component, /dialog\.hasAttribute\("data-dev"\)/);
  });
});

// The rest of the inline script: the cover class, its safety timer, the
// navigation snapshot and the hold() the adapter calls. It runs here against a
// minimal fake document and a manual clock.
class ManualClock {
  now = 0;
  private next = 1;
  private timers = new Map<number, { at: number; fn: () => void }>();
  setTimeout = (fn: () => void, ms: number) => {
    const id = this.next++;
    this.timers.set(id, { at: this.now + ms, fn });
    return id;
  };
  clearTimeout = (id: number) => {
    this.timers.delete(id);
  };
  get pending() {
    return this.timers.size;
  }
  advance(ms: number) {
    const target = this.now + ms;
    for (;;) {
      const due = [...this.timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.timers.delete(due[0]);
      this.now = due[1].at;
      due[1].fn();
    }
    this.now = target;
  }
}

interface GateOptions {
  search?: string;
  part?: string;
  stored?: string | null;
  dev?: boolean;
  hidden?: boolean;
  readyState?: string;
  navigationType?: string;
  dialog?: boolean;
}

const COVER = "tsuki-cutscene-pending";

function runGate(options: GateOptions = {}) {
  const clock = new ManualClock();
  const classes = new Set<string>();
  const reads: string[] = [];
  const document = Object.assign(new EventTarget(), {
    hidden: options.hidden ?? false,
    readyState: options.readyState ?? "loading",
    documentElement: {
      classList: {
        add: (name: string) => void classes.add(name),
        remove: (name: string) => void classes.delete(name),
        contains: (name: string) => classes.has(name),
      },
    },
    dialog:
      options.dialog === false
        ? null
        : { dataset: { part: options.part ?? "3" }, hasAttribute: (name: string) => name === "data-dev" && options.dev === true },
    querySelector(selector: string) {
      return selector === "dialog.tsuki-cutscene" ? this.dialog : null;
    },
  });
  const location = { pathname: "/tsukinomi/sections/03-decision/", search: options.search ?? "" };
  const localStorage = {
    getItem: (key: string) => {
      reads.push(key);
      return options.stored ?? null;
    },
  };
  const performance = { getEntriesByType: () => [{ type: options.navigationType ?? "navigate" }] };
  const window: Record<string, unknown> = { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout };
  const match = /<script is:inline>([\s\S]*?)<\/script>/.exec(component);
  assert.ok(match, "the component carries one inline gate script");
  new Function("window", "document", "performance", "location", "localStorage", match[1])(window, document, performance, location, localStorage);

  const nav = () => window.__tsukiCutsceneNav as { traverse: boolean; path?: string; search?: string; hold?: (ms: number) => void };
  return {
    clock,
    classes,
    reads,
    document,
    location,
    window,
    nav,
    covered: () => classes.has(COVER),
    // What ClientRouter does: navigation type first, then the new <html> attributes (no cover class), then after-swap.
    navigate(next: { search?: string; type?: string; dialog?: boolean }) {
      document.dispatchEvent(Object.assign(new Event("astro:before-preparation"), { navigationType: next.type ?? "push" }));
      classes.clear();
      location.search = next.search ?? "";
      if (next.dialog === false) document.dialog = null;
      document.dispatchEvent(new Event("astro:after-swap"));
    },
    show(hidden: boolean) {
      document.hidden = hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    },
  };
}

describe("the inline gate script: cover and safety timer", () => {
  it("covers a first visit and lifts the cover itself after 2.5 s if nothing else did", () => {
    const gate = runGate();
    assert.equal(gate.covered(), true);
    assert.deepEqual(gate.reads, ["tsukinomi:cutscene:played:3"]);
    gate.clock.advance(2499);
    assert.equal(gate.covered(), true);
    gate.clock.advance(1);
    assert.equal(gate.covered(), false);
  });

  it("leaves a visit that will not play uncovered: played today, ?resume=1, a history load of this page", () => {
    assert.equal(runGate({ stored: new Date().toISOString() }).covered(), false);
    assert.equal(runGate({ stored: String(Date.now()) }).covered(), false, "the old numeric value counts");
    assert.equal(runGate({ search: "?resume=1" }).covered(), false);
    assert.equal(runGate({ navigationType: "back_forward" }).covered(), false);
    assert.equal(runGate({ dialog: false }).covered(), false, "a page without a cutscene");
    assert.equal(runGate({ stored: new Date().toISOString(), search: "?cutscene=replay" }).covered(), true);
    assert.equal(runGate({ stored: new Date().toISOString(), search: "?cutscene=force" }).covered(), false);
    assert.equal(runGate({ stored: new Date().toISOString(), search: "?cutscene=force", dev: true }).covered(), true);
  });

  it("does not take the page-load navigation type for the one that brought it here", () => {
    // The first soft navigation into a section page is when this script first runs, long after
    // the document load. A document that was itself a back/forward load must not make a normal
    // click into a section look like history traversal.
    const gate = runGate({ readyState: "complete", navigationType: "back_forward" });
    assert.equal(gate.nav().traverse, false);
    assert.equal(gate.covered(), true);
    assert.equal(runGate({ readyState: "loading", navigationType: "back_forward" }).nav().traverse, true);
    assert.equal(runGate({ readyState: "interactive", navigationType: "back_forward" }).nav().traverse, false);
  });

  it("starts the 2.5 s only once the tab is visible", () => {
    const gate = runGate({ hidden: true });
    assert.equal(gate.covered(), true);
    gate.clock.advance(60_000);
    assert.equal(gate.covered(), true, "a hidden tab cannot lapse the cover");
    gate.show(false);
    gate.clock.advance(2499);
    assert.equal(gate.covered(), true);
    gate.clock.advance(1);
    assert.equal(gate.covered(), false);
  });

  it("records the page's address for the adapter, since the reading-progress script strips ?resume=1", () => {
    const gate = runGate({ search: "?resume=1&x=2" });
    assert.equal(gate.nav().path, "/tsukinomi/sections/03-decision/");
    assert.equal(gate.nav().search, "?resume=1&x=2");
  });

  it("is a no-op when it runs a second time", () => {
    const gate = runGate();
    const first = gate.window.__tsukiCutsceneNav;
    const match = /<script is:inline>([\s\S]*?)<\/script>/.exec(component);
    assert.ok(match);
    gate.clock.advance(1000);
    new Function("window", "document", "performance", "location", "localStorage", match[1])(gate.window, gate.document, { getEntriesByType: () => [] }, gate.location, { getItem: () => null });
    assert.equal(gate.window.__tsukiCutsceneNav, first);
    assert.equal(gate.clock.pending, 1, "no second timer");
  });
});

describe("the inline gate script: hold() for the adapter", () => {
  it("restarts the timer with the adapter's budget, so a late adapter keeps its cover", () => {
    const gate = runGate();
    gate.clock.advance(2000); // the deferred modules were slow; the adapter starts only now
    gate.nav().hold?.(3000);
    gate.clock.advance(500); // past the gate's original 2.5 s
    assert.equal(gate.covered(), true, "the first timer was replaced");
    gate.clock.advance(2499);
    assert.equal(gate.covered(), true);
    gate.clock.advance(1);
    assert.equal(gate.covered(), false);
    assert.equal(gate.clock.pending, 0);
  });

  it("never brings back a cover that already lapsed", () => {
    const gate = runGate();
    gate.clock.advance(2500);
    assert.equal(gate.covered(), false);
    gate.nav().hold?.(3000);
    assert.equal(gate.covered(), false, "the reader is looking at the text");
    assert.equal(gate.clock.pending, 0);
  });

  it("does nothing when the runner already lifted the cover", () => {
    const gate = runGate();
    gate.classes.delete(COVER); // the runner opened the dialog
    gate.nav().hold?.(3000);
    assert.equal(gate.covered(), false);
  });

  it("waits for a visible tab before counting the budget", () => {
    const gate = runGate();
    gate.show(true);
    gate.nav().hold?.(3000);
    gate.clock.advance(60_000);
    assert.equal(gate.covered(), true);
    gate.show(false);
    gate.clock.advance(2999);
    assert.equal(gate.covered(), true);
    gate.clock.advance(1);
    assert.equal(gate.covered(), false);
  });
});

describe("the inline gate script: later ClientRouter navigations", () => {
  it("covers again after a swap onto a section that will play, and the old timer cannot lift the new cover early", () => {
    const gate = runGate({ stored: null });
    gate.clock.advance(2000);
    gate.navigate({ search: "" });
    assert.equal(gate.covered(), true);
    gate.clock.advance(2000); // 4000 ms after the first cover: the first timer's lapse is long past
    assert.equal(gate.covered(), true);
    gate.clock.advance(500);
    assert.equal(gate.covered(), false);
    assert.equal(gate.clock.pending, 0);
  });

  it("leaves a traversal and a ?resume=1 navigation alone, and clears the timer of a page it leaves", () => {
    const gate = runGate();
    gate.navigate({ type: "traverse" });
    assert.equal(gate.nav().traverse, true);
    assert.equal(gate.covered(), false);
    assert.equal(gate.clock.pending, 0, "the previous page's timer is gone");
    gate.navigate({ type: "push", search: "?resume=1" });
    assert.equal(gate.nav().traverse, false);
    assert.equal(gate.covered(), false);
    gate.navigate({ type: "push" });
    assert.equal(gate.covered(), true);
  });

  it("keeps the address snapshot current and stops covering on a page with no dialog", () => {
    const gate = runGate();
    gate.navigate({ search: "?resume=1", dialog: false });
    assert.equal(gate.nav().search, "?resume=1");
    assert.equal(gate.covered(), false);
  });
});
