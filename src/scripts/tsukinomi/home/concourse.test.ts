// The DOM half of the concourse, run against a small fake DOM: what it marks,
// when it arms the board and the rail, and above all that its clean-up leaves
// nothing behind (no listener, observer or pending frame), which is what a
// ClientRouter navigation away from the home page relies on. Real-browser
// behaviour (scroll, layout, paint) is checked in headless Chrome by hand; see
// the round report.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { TrackedTarget } from "../../_shared/cutscene/fake-dom";
import { LAST_KEY, READS_KEY, RAIL_VERTICAL_QUERY, SHORT_LANDSCAPE_QUERY, sectionProgressKey } from "./concourse-core";
import { setupConcourse } from "./concourse";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const IDS = ["00-introduction", "01-discovery", "02-reveal", "03-decision", "04-mountain", "05-ten-years"];
const PALETTES = ["autumn", "autumn", "twilight", "warm-room", "snow-pact", "winter-light"];

class El extends TrackedTarget {
  dataset: Record<string, string> = {};
  hidden = false;
  textContent = "";
  readonly attrs = new Set<string>();
  readonly classes = new Set<string>();
  readonly props = new Map<string, string>();
  readonly style = {
    setProperty: (name: string, value: string) => void this.props.set(name, value),
    getPropertyValue: (name: string) => this.props.get(name) ?? "",
  };
  readonly classList = { add: (name: string) => void this.classes.add(name), contains: (name: string) => this.classes.has(name) };
  one: Record<string, El | null> = {};
  many: Record<string, El[]> = {};
  rect = { top: 0, height: 0 };
  querySelector(selector: string): El | null {
    return this.one[selector] ?? null;
  }
  querySelectorAll(selector: string): El[] {
    return this.many[selector] ?? [];
  }
  setAttribute(name: string) {
    this.attrs.add(name);
  }
  hasAttribute(name: string) {
    return this.attrs.has(name);
  }
  toggleAttribute(name: string, force?: boolean) {
    const on = force ?? !this.attrs.has(name);
    if (on) this.attrs.add(name);
    else this.attrs.delete(name);
    return on;
  }
  getBoundingClientRect() {
    return this.rect;
  }
}

class FakeQuery extends TrackedTarget {
  matches = false;
}

class FakeObserver {
  static all: FakeObserver[] = [];
  observed = new Set<unknown>();
  disconnected = false;
  constructor(
    readonly callback: (entries: Array<{ isIntersecting: boolean }>) => void,
    readonly options: Record<string, unknown>,
  ) {
    FakeObserver.all.push(this);
  }
  observe(target: unknown) {
    this.observed.add(target);
  }
  disconnect() {
    this.disconnected = true;
    this.observed.clear();
  }
  fire(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}

interface Scene {
  root: El;
  board: El;
  rail: El;
  tint: El;
  rows: El[];
  stations: El[];
  words: El[];
}

interface Env {
  window: TrackedTarget & Record<string, unknown>;
  queries: Map<string, FakeQuery>;
  storage: Map<string, string>;
  frames: Map<number, () => void>;
  scene: Scene;
  query(text: string): FakeQuery;
  flush(): void;
  restore(): void;
}

function buildScene(): Scene {
  const root = new El();
  const board = new El();
  const rail = new El();
  const tint = new El();
  const rows = IDS.map((id, number) => {
    const row = new El();
    row.dataset = { sectionId: id, part: String(number) };
    return row;
  });
  const words = rows.map((row) => {
    const word = new El();
    word.hidden = true;
    row.one["[data-board-state]"] = word;
    return word;
  });
  const stations = PALETTES.slice(1).map((palette, index) => {
    const station = new El();
    station.dataset = { part: String(index + 1), palette };
    return station;
  });
  root.one["[data-board]"] = board;
  root.one["[data-rail]"] = rail;
  root.many["[data-board] [data-section-id]"] = rows;
  root.many["[data-rail] [data-part]"] = stations;
  // The board starts below the fold, the rail well below it.
  board.rect = { top: 1000, height: 560 };
  rail.rect = { top: 1700, height: 200 };
  return { root, board, rail, tint, rows, stations, words };
}

function install(): Env {
  const scene = buildScene();
  const queries = new Map<string, FakeQuery>();
  const storage = new Map<string, string>();
  const frames = new Map<number, () => void>();
  let nextFrame = 1;
  const window = new TrackedTarget() as Env["window"];
  Object.assign(window, {
    innerHeight: 800,
    scrollY: 0,
    localStorage: { getItem: (key: string) => storage.get(key) ?? null },
    matchMedia: (text: string) => {
      const query = queries.get(text) ?? new FakeQuery();
      queries.set(text, query);
      return query;
    },
    requestAnimationFrame: (callback: () => void) => {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id: number) => void frames.delete(id),
  });
  const document = {
    documentElement: { scrollHeight: 2400 },
    querySelector: (selector: string) => (selector === "[data-concourse]" ? scene.root : selector === "[data-concourse-tint]" ? scene.tint : null),
  };
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const set = (key: string, value: unknown) => {
    if (!saved.has(key)) saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  };
  set("window", window);
  set("document", document);
  set("IntersectionObserver", FakeObserver);
  FakeObserver.all = [];
  return {
    window,
    queries,
    storage,
    frames,
    scene,
    query(text) {
      const query = queries.get(text) ?? new FakeQuery();
      queries.set(text, query);
      return query;
    },
    flush() {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback();
    },
    restore() {
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete (globalThis as Record<string, unknown>)[key];
      }
    },
  };
}

let env: Env;
beforeEach(() => {
  env = install();
});
afterEach(() => env.restore());

/** Listeners left on the window, on every media query, and observers not yet disconnected. */
function leftBehind(): { window: number; queries: number; observers: number; frames: number } {
  return {
    window: env.window.listenerCount(),
    queries: [...env.queries.values()].reduce((sum, query) => sum + query.listenerCount(), 0),
    observers: FakeObserver.all.filter((observer) => !observer.disconnected).length,
    frames: env.frames.size,
  };
}

const watchedQuery = (observerIndex: number) => FakeObserver.all[observerIndex];

describe("setupConcourse: marks", () => {
  it("does nothing on a page without the concourse", () => {
    (globalThis as { document: unknown }).document = { querySelector: () => null, documentElement: { scrollHeight: 0 } };
    assert.equal(setupConcourse(), undefined);
    assert.equal(FakeObserver.all.length, 0);
  });

  it("shows a fresh reader's board and rail unmarked", () => {
    setupConcourse();
    assert.ok(env.scene.rows.every((row) => row.dataset.state === "unread"));
    assert.ok(env.scene.words.every((word) => word.hidden && word.textContent === ""));
    assert.ok(env.scene.stations.every((station) => !station.hasAttribute("data-marker")));
    assert.equal(env.scene.root.dataset.furthestRead, "");
    assert.equal(env.scene.root.dataset.furthestOpened, "");
  });

  it("puts the marker on part 3 for read marks on parts 1 to 3", () => {
    env.storage.set(READS_KEY, JSON.stringify(IDS.slice(1, 4)));
    setupConcourse();
    assert.deepEqual(
      env.scene.stations.filter((station) => station.hasAttribute("data-marker")).map((station) => station.dataset.part),
      ["3"],
    );
    assert.deepEqual(
      env.scene.rows.map((row) => row.dataset.state),
      ["unread", "read", "read", "read", "unread", "unread"],
    );
    assert.deepEqual(
      env.scene.words.filter((word) => !word.hidden).map((word) => word.textContent),
      ["อ่านจบแล้ว", "อ่านจบแล้ว", "อ่านจบแล้ว"],
    );
    assert.equal(env.scene.root.dataset.furthestRead, "3");
  });

  it("separates a part being read from a part read", () => {
    env.storage.set(READS_KEY, JSON.stringify([IDS[1]]));
    env.storage.set(sectionProgressKey(IDS[2]), JSON.stringify({ sectionId: IDS[2], progress: 0.3 }));
    env.storage.set(LAST_KEY, JSON.stringify({ sectionId: IDS[2], progress: 0.3 }));
    setupConcourse();
    assert.equal(env.scene.rows[2].dataset.state, "opened");
    assert.equal(env.scene.words[2].textContent, "อ่านค้างไว้");
    assert.equal(env.scene.root.dataset.furthestRead, "1");
    assert.equal(env.scene.root.dataset.furthestOpened, "2");
    assert.equal(env.scene.stations.find((station) => station.hasAttribute("data-marker"))?.dataset.part, "1");
  });

  it("survives corrupt storage", () => {
    env.storage.set(READS_KEY, "{oops");
    env.storage.set(LAST_KEY, "][");
    assert.doesNotThrow(() => setupConcourse());
    assert.equal(env.scene.root.dataset.furthestRead, "");
  });

  it("survives storage that throws", () => {
    env.window.localStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    };
    assert.doesNotThrow(() => setupConcourse());
    assert.ok(env.scene.rows.every((row) => row.dataset.state === "unread"));
  });
});

describe("setupConcourse: modes", () => {
  it("publishes full motion and no direct layout by default", () => {
    setupConcourse();
    assert.equal(env.scene.root.dataset.motion, "full");
    assert.equal(env.scene.root.hasAttribute("data-direct"), false);
  });

  it("keeps the finished picture under reduced motion: board and rail unarmed, rail drawn, no tint", () => {
    env.query(REDUCED_QUERY).matches = true;
    setupConcourse();
    env.flush();
    assert.equal(env.scene.root.dataset.motion, "reduced");
    assert.equal(env.scene.board.hasAttribute("data-armed"), false);
    assert.equal(env.scene.rail.hasAttribute("data-armed"), false);
    assert.equal(env.scene.rail.style.getPropertyValue("--rail-fill"), "1");
    assert.ok(env.scene.stations.every((station) => station.hasAttribute("data-lit")));
    assert.equal(env.scene.tint.style.getPropertyValue("--tint-alpha"), "0");
    assert.equal(FakeObserver.all.some((observer) => observer.options.threshold !== undefined), false, "no settle observer");
  });

  it("shows the board directly on a short landscape screen", () => {
    env.query(SHORT_LANDSCAPE_QUERY).matches = true;
    setupConcourse();
    assert.equal(env.scene.root.hasAttribute("data-direct"), true);
    assert.equal(env.scene.board.hasAttribute("data-armed"), false);
    assert.equal(env.scene.board.classList.contains("is-settled"), false);
  });

  it("follows the reader changing the setting while the page is open", () => {
    setupConcourse();
    env.flush();
    assert.equal(env.scene.rail.hasAttribute("data-armed"), true);
    env.query(REDUCED_QUERY).matches = true;
    env.query(REDUCED_QUERY).dispatchEvent(new Event("change"));
    env.flush();
    assert.equal(env.scene.root.dataset.motion, "reduced");
    assert.equal(env.scene.rail.hasAttribute("data-armed"), false);
    assert.equal(env.scene.rail.style.getPropertyValue("--rail-fill"), "1");
    env.query(SHORT_LANDSCAPE_QUERY).matches = true;
    env.query(SHORT_LANDSCAPE_QUERY).dispatchEvent(new Event("change"));
    assert.equal(env.scene.root.hasAttribute("data-direct"), true);
  });
});

describe("setupConcourse: board", () => {
  it("arms a board that starts below the fold and settles it once it comes into view", () => {
    setupConcourse();
    assert.equal(env.scene.board.hasAttribute("data-armed"), true);
    assert.equal(env.scene.board.classList.contains("is-settled"), false);
    const settle = FakeObserver.all.find((observer) => observer.options.threshold !== undefined)!;
    assert.ok(settle.observed.has(env.scene.board));
    settle.fire(false);
    assert.equal(env.scene.board.classList.contains("is-settled"), false);
    settle.fire(true);
    assert.equal(env.scene.board.classList.contains("is-settled"), true);
    assert.equal(settle.disconnected, true, "done after the first settle");
  });

  it("leaves a board that is already on screen alone", () => {
    env.scene.board.rect = { top: 300, height: 560 };
    setupConcourse();
    assert.equal(env.scene.board.hasAttribute("data-armed"), false);
  });
});

describe("setupConcourse: rail", () => {
  it("starts empty, listens to scroll only while the rail is near, and draws as it scrolls up", () => {
    setupConcourse();
    env.flush();
    assert.equal(env.scene.rail.hasAttribute("data-armed"), true);
    assert.equal(env.scene.rail.style.getPropertyValue("--rail-fill"), "0");
    assert.ok(env.scene.stations.every((station) => !station.hasAttribute("data-lit")));
    assert.equal(env.scene.tint.style.getPropertyValue("--tint-alpha"), "0");
    assert.equal(env.window.listenerCount("scroll"), 0, "no scroll work while the rail is far away");

    const near = FakeObserver.all.find((observer) => observer.options.rootMargin !== undefined)!;
    assert.ok(near.observed.has(env.scene.rail));
    near.fire(true);
    assert.equal(env.window.listenerCount("scroll"), 1);
    assert.equal(env.window.listenerCount("resize"), 1);

    // The rail's top has risen to 450 (the line starts at 600 and takes 360 px): part way.
    env.window.scrollY = 1100;
    env.scene.rail.rect = { top: 450, height: 200 };
    env.window.dispatchEvent(new Event("scroll"));
    env.window.dispatchEvent(new Event("scroll"));
    assert.equal(env.frames.size, 1, "a burst of scroll events schedules one frame");
    env.flush();
    const fill = Number(env.scene.rail.style.getPropertyValue("--rail-fill"));
    assert.ok(fill > 0 && fill < 1, `fill ${fill}`);
    const lit = env.scene.stations.filter((station) => station.hasAttribute("data-lit")).length;
    assert.ok(lit >= 0 && lit < 5);

    // The end of the page: 2400 - 800 = 1600 of scroll, rail top then at 600 - 500 = 100.
    env.window.scrollY = 1600;
    env.scene.rail.rect = { top: 100, height: 200 };
    env.window.dispatchEvent(new Event("scroll"));
    env.flush();
    assert.equal(env.scene.rail.style.getPropertyValue("--rail-fill"), "1");
    assert.equal(env.scene.rail.hasAttribute("data-complete"), true);
    assert.ok(env.scene.stations.every((station) => station.hasAttribute("data-lit")));
    assert.equal(Number(env.scene.tint.style.getPropertyValue("--tint-alpha")), 0.07);
    assert.equal(env.scene.tint.style.getPropertyValue("--tint-a"), "var(--mist)");

    near.fire(false);
    assert.equal(env.window.listenerCount("scroll"), 0);
    assert.equal(env.window.listenerCount("resize"), 0);
  });

  it("tints with the palette of the part under the head and never past the cap", () => {
    setupConcourse();
    const near = watchedQuery(FakeObserver.all.findIndex((observer) => observer.options.rootMargin !== undefined));
    near.fire(true);
    const seen = new Set<string>();
    for (let top = 800; top >= -200; top -= 25) {
      env.scene.rail.rect = { top, height: 200 };
      env.window.scrollY = 800 - top;
      env.window.dispatchEvent(new Event("scroll"));
      env.flush();
      assert.ok(Number(env.scene.tint.style.getPropertyValue("--tint-alpha")) <= 0.07 + 1e-9);
      seen.add(env.scene.tint.style.getPropertyValue("--tint-a"));
      seen.add(env.scene.tint.style.getPropertyValue("--tint-b"));
    }
    for (const token of ["--sakura", "--moon", "--sunset", "--higan", "--mist"]) {
      assert.ok(seen.has(`var(${token})`), `${token} never used`);
    }
  });

  it("colours the line with color-mix where the browser has it and with a plain token where it does not", () => {
    const run = () => {
      env.restore();
      env = install();
      setupConcourse();
      FakeObserver.all.find((observer) => observer.options.rootMargin !== undefined)!.fire(true);
      env.scene.rail.rect = { top: 500, height: 200 };
      env.window.dispatchEvent(new Event("scroll"));
      env.flush();
      return env.scene.rail.style.getPropertyValue("--rail-color");
    };
    assert.match(run(), /^var\(--[a-z-]+\)$/, "no CSS global in this environment: plain token");
    (globalThis as { CSS?: unknown }).CSS = { supports: () => true };
    try {
      assert.match(run(), /^color-mix\(in srgb, var\(--[a-z-]+\) calc\([0-9.]+ \* 100%\), var\(--[a-z-]+\)\)$/);
    } finally {
      delete (globalThis as { CSS?: unknown }).CSS;
    }
  });

  it("never injects anything but a known palette token", () => {
    env.scene.stations[0].dataset.palette = "red; background: url(x)";
    setupConcourse();
    env.flush();
    for (const value of [env.scene.tint.style.getPropertyValue("--tint-a"), env.scene.tint.style.getPropertyValue("--tint-b")]) {
      assert.match(value, /^var\(--[a-z-]+\)$/);
    }
  });

  it("watches the layout switch so the rail is measured again when it turns vertical", () => {
    setupConcourse();
    env.flush();
    env.scene.rail.rect = { top: 100, height: 600 };
    env.query(RAIL_VERTICAL_QUERY).dispatchEvent(new Event("change"));
    assert.equal(env.frames.size, 1);
  });
});

describe("setupConcourse: clean-up", () => {
  it("leaves no listener, observer or frame behind after a normal visit", () => {
    const cleanup = setupConcourse() as () => void;
    assert.equal(typeof cleanup, "function");
    const near = FakeObserver.all.find((observer) => observer.options.rootMargin !== undefined)!;
    near.fire(true); // scroll and resize listeners are on
    env.window.dispatchEvent(new Event("scroll")); // a frame is pending
    const before = leftBehind();
    assert.ok(before.window >= 2 && before.queries >= 3 && before.observers >= 1 && before.frames >= 1, JSON.stringify(before));

    cleanup();
    assert.deepEqual(leftBehind(), { window: 0, queries: 0, observers: 0, frames: 0 });
  });

  it("is complete even when the rail was never near, and when it is called twice", () => {
    const cleanup = setupConcourse() as () => void;
    cleanup();
    assert.deepEqual(leftBehind(), { window: 0, queries: 0, observers: 0, frames: 0 });
    assert.doesNotThrow(cleanup);
    assert.deepEqual(leftBehind(), { window: 0, queries: 0, observers: 0, frames: 0 });
  });

  it("leaves nothing behind under reduced motion or on a short landscape screen either", () => {
    for (const text of [REDUCED_QUERY, SHORT_LANDSCAPE_QUERY]) {
      env.restore();
      env = install();
      env.query(text).matches = true;
      const cleanup = setupConcourse() as () => void;
      cleanup();
      assert.deepEqual(leftBehind(), { window: 0, queries: 0, observers: 0, frames: 0 }, text);
    }
  });

  it("does not render after it has been cleaned up", () => {
    const cleanup = setupConcourse() as () => void;
    env.flush();
    assert.equal(env.scene.rail.style.getPropertyValue("--rail-fill"), "0");
    FakeObserver.all.find((observer) => observer.options.rootMargin !== undefined)!.fire(true);
    env.window.dispatchEvent(new Event("scroll"));
    cleanup();
    env.scene.rail.rect = { top: -400, height: 200 };
    env.flush();
    assert.equal(env.scene.rail.style.getPropertyValue("--rail-fill"), "0");
  });

  it("can be set up again on the next page: a second setup starts from the same state", () => {
    const first = setupConcourse() as () => void;
    first();
    FakeObserver.all = [];
    const second = setupConcourse() as () => void;
    assert.ok(FakeObserver.all.length >= 1);
    second();
    assert.deepEqual(leftBehind(), { window: 0, queries: 0, observers: 0, frames: 0 });
  });
});
