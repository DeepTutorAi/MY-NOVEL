import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";

import { onPage } from "./lifecycle";
import { onSeaPage } from "../sea/lifecycle";

// Just enough of a browser: a document that is an EventTarget with a body
// element carrying a class list, and a window object that holds the guard records.
class FakeBody {
  constructor(private readonly classes: string[]) {}
  classList = { contains: (name: string) => this.classes.includes(name) };
}

class FakeDocument extends EventTarget {
  body: FakeBody | null;
  readyState: "loading" | "interactive" | "complete" = "complete";
  constructor(body: FakeBody | null) {
    super();
    this.body = body;
  }
  /** What ClientRouter does: a new body, then astro:page-load. */
  swapTo(classes: string[]) {
    this.dispatchEvent(new Event("astro:before-swap"));
    this.body = new FakeBody(classes);
    this.dispatchEvent(new Event("astro:page-load"));
  }
}

const saved = new Map<string, PropertyDescriptor | undefined>();
function setGlobal(key: string, value: unknown) {
  if (!saved.has(key)) saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

let doc: FakeDocument;
let win: Record<string, unknown>;

function install(bodyClasses: string[] | null, readyState: FakeDocument["readyState"] = "complete") {
  doc = new FakeDocument(bodyClasses ? new FakeBody(bodyClasses) : null);
  doc.readyState = readyState;
  win = {};
  setGlobal("window", win);
  setGlobal("document", doc);
}

beforeEach(() => install(["sea-page"]));

afterEach(() => {
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete (globalThis as Record<string, unknown>)[key];
  }
  saved.clear();
});

function probe() {
  const log = { setups: 0, cleanups: 0 };
  const setup = () => {
    log.setups++;
    return () => void log.cleanups++;
  };
  return { log, setup };
}

describe("onPage", () => {
  it("sets up at once when the DOM is ready and the body carries the class", () => {
    const { log, setup } = probe();
    onPage("thing", { bodyClass: "sea-page" }, setup);
    assert.equal(log.setups, 1);
    assert.equal(log.cleanups, 0);
  });

  it("waits for astro:page-load while the document is still loading", () => {
    install(["sea-page"], "loading");
    const { log, setup } = probe();
    onPage("thing", { bodyClass: "sea-page" }, setup);
    assert.equal(log.setups, 0);
    doc.dispatchEvent(new Event("astro:page-load"));
    assert.equal(log.setups, 1);
  });

  it("never sets the same page up twice", () => {
    const { log, setup } = probe();
    onPage("thing", { bodyClass: "sea-page" }, setup);
    doc.dispatchEvent(new Event("astro:page-load"));
    doc.dispatchEvent(new Event("astro:page-load"));
    assert.equal(log.setups, 1, "the same body is the same page");
  });

  it("ignores a second registration under the same name", () => {
    const { log, setup } = probe();
    onPage("thing", { bodyClass: "sea-page" }, setup);
    onPage("thing", { bodyClass: "sea-page" }, setup);
    assert.equal(log.setups, 1);
    doc.swapTo(["sea-page"]);
    assert.equal(log.setups, 2, "and only one listener pair exists");
    assert.equal(log.cleanups, 1);
  });

  it("tears down on astro:before-swap and sets up again for the replaced body", () => {
    const { log, setup } = probe();
    onPage("thing", { bodyClass: "sea-page" }, setup);
    doc.swapTo(["sea-page"]);
    assert.deepEqual(log, { setups: 2, cleanups: 1 });
    doc.swapTo(["sea-page"]);
    assert.deepEqual(log, { setups: 3, cleanups: 2 });
  });

  it("tears down and stays off when the next page is not this novel's", () => {
    const { log, setup } = probe();
    onPage("thing", { bodyClass: "sea-page" }, setup);
    doc.swapTo(["lodge-page"]);
    assert.deepEqual(log, { setups: 1, cleanups: 1 });
    doc.swapTo(["sea-page"]);
    assert.deepEqual(log, { setups: 2, cleanups: 1 });
  });

  it("does nothing on a page of another novel", () => {
    install(["tsukinomi-page"]);
    const { log, setup } = probe();
    onPage("thing", { bodyClass: "sea-page" }, setup);
    assert.equal(log.setups, 0);
  });

  it("copes with a setup that returns nothing and with a missing body", () => {
    install(null);
    let setups = 0;
    onPage("quiet", { bodyClass: "sea-page" }, () => void setups++);
    assert.equal(setups, 0);
    doc.body = new FakeBody(["sea-page"]);
    doc.dispatchEvent(new Event("astro:page-load"));
    assert.equal(setups, 1);
    assert.doesNotThrow(() => doc.dispatchEvent(new Event("astro:before-swap")));
  });

  it("is a no-op without a window (server render)", () => {
    const saveWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    delete (globalThis as Record<string, unknown>).window;
    try {
      const { log, setup } = probe();
      assert.doesNotThrow(() => onPage("thing", { bodyClass: "sea-page" }, setup));
      assert.equal(log.setups, 0);
    } finally {
      if (saveWindow) Object.defineProperty(globalThis, "window", saveWindow);
    }
  });

  it("keeps families apart on the default record and leaves the window record shared", () => {
    install(["sea-page", "tsukinomi-page"]);
    const a = probe();
    const b = probe();
    onPage("cutscene", { bodyClass: "sea-page" }, a.setup);
    onPage("cutscene", { bodyClass: "tsukinomi-page" }, b.setup);
    assert.equal(a.log.setups, 1);
    assert.equal(b.log.setups, 1, "same name, different body class: both run");
    assert.deepEqual(Object.keys(win.__pageBound as object).sort(), ["sea-page:cutscene", "tsukinomi-page:cutscene"]);
  });

  it("puts the guard in the window property the caller names", () => {
    const { setup } = probe();
    onPage("thing", { bodyClass: "sea-page", registry: "__customBound" }, setup);
    assert.deepEqual(win.__customBound, { thing: true });
    assert.equal(win.__pageBound, undefined);
  });
});

describe("onSeaPage", () => {
  it("behaves as before: sea-page body, guard in window.__seaBound keyed by name", () => {
    const { log, setup } = probe();
    onSeaPage("reader", setup);
    assert.equal(log.setups, 1);
    assert.deepEqual(win.__seaBound, { reader: true });
    onSeaPage("reader", setup);
    assert.equal(log.setups, 1);
    doc.swapTo(["sea-page"]);
    assert.deepEqual(log, { setups: 2, cleanups: 1 });
    doc.swapTo(["other"]);
    assert.deepEqual(log, { setups: 2, cleanups: 2 });
  });

  it("does not run on a body without sea-page", () => {
    install(["tsukinomi-page"]);
    const { log, setup } = probe();
    onSeaPage("reader", setup);
    assert.equal(log.setups, 0);
  });
});

describe("lifecycle sources", () => {
  it("attach Astro events to document and never to window", () => {
    const shared = readFileSync(new URL("./lifecycle.ts", import.meta.url), "utf8");
    assert.match(shared, /document\.addEventListener\("astro:page-load"/);
    assert.match(shared, /document\.addEventListener\("astro:before-swap"/);
    assert.doesNotMatch(shared, /window\.addEventListener/);
  });
});
