// Unit tests of the shared cutscene runner against a minimal fake DOM: only
// what runner.ts touches (a dialog, two buttons, document, location, storage).
// Real-browser behaviour (showModal in the top layer, focus, scroll lock) is
// covered by the e2e harness, not here.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";

import { playedStamp } from "./core";
import { createCutsceneRunner, type CutsceneRunnerConfig, type CutsceneSceneHandle } from "./runner";

class FakeElement extends EventTarget {
  hidden = false;
  isConnected = true;
  dataset: Record<string, string> = {};
  focusCalls = 0;
  constructor(readonly env: Env) {
    super();
  }
  focus() {
    this.focusCalls++;
    this.env.document.activeElement = this;
  }
}

class FakeDialog extends FakeElement {
  open = false;
  showModalCalls = 0;
  closeCalls = 0;
  failToOpen = false;
  showModal() {
    this.showModalCalls++;
    if (this.failToOpen || this.open) throw new Error("InvalidStateError");
    this.open = true;
  }
  close() {
    this.closeCalls++;
    this.open = false;
  }
}

class FakeDocument extends EventTarget {
  hidden = false;
  body = {};
  activeElement: unknown = this.body;
}

interface Env {
  document: FakeDocument;
  storage: Map<string, string>;
  replaced: string[];
  warnings: unknown[][];
}

const GLOBAL_KEYS = ["document", "localStorage", "location", "history", "matchMedia"] as const;
const saved = new Map<string, PropertyDescriptor | undefined>();
const realWarn = console.warn;

function setGlobal(key: string, value: unknown) {
  if (!saved.has(key)) saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

let env: Env;
let dialog: FakeDialog;
let skipButton: FakeElement;
let startButton: FakeElement;
let location: { href: string; pathname: string; search: string; hash: string };
let reduced = false;
let storageBroken: "get" | "set" | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const tick = () => sleep(0);

function setUrl(href: string) {
  const url = new URL(href);
  location = { href, pathname: url.pathname, search: url.search, hash: url.hash };
  setGlobal("location", location);
}

beforeEach(() => {
  const document = new FakeDocument();
  env = { document, storage: new Map(), replaced: [], warnings: [] };
  dialog = new FakeDialog(env);
  skipButton = new FakeElement(env);
  startButton = new FakeElement(env);
  startButton.hidden = true;
  reduced = false;
  storageBroken = null;
  setGlobal("document", document);
  setGlobal("localStorage", {
    getItem: (key: string) => {
      if (storageBroken === "get") throw new Error("denied");
      return env.storage.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (storageBroken === "set") throw new Error("denied");
      env.storage.set(key, value);
    },
  });
  setGlobal("history", { state: null, replaceState: (_state: unknown, _title: string, url: string) => env.replaced.push(url) });
  setGlobal("matchMedia", () => ({ matches: reduced }));
  setUrl("https://x.test/MY-NOVEL/tsukinomi/part-3/");
  console.warn = (...args: unknown[]) => {
    env.warnings.push(args);
  };
});

afterEach(() => {
  console.warn = realWarn;
  for (const key of GLOBAL_KEYS) {
    const descriptor = saved.get(key);
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete (globalThis as Record<string, unknown>)[key];
  }
  saved.clear();
});

interface Probe {
  loads: number;
  prepares: number;
  plays: number;
  stills: number;
  disposed: number;
  paused: number;
  opens: { still: boolean }[];
  closes: { reason: string; still: boolean }[];
  complete: () => void;
  cover: { active: boolean; lifted: number };
  focusTarget: FakeElement;
}

function make(overrides: Partial<CutsceneRunnerConfig<{ name: string }>> = {}) {
  const probe: Probe = {
    loads: 0,
    prepares: 0,
    plays: 0,
    stills: 0,
    disposed: 0,
    paused: 0,
    opens: [],
    closes: [],
    complete: () => {},
    cover: { active: true, lifted: 0 },
    focusTarget: new FakeElement(env),
  };
  const config: CutsceneRunnerConfig<{ name: string }> = {
    dialog: dialog as unknown as HTMLDialogElement,
    skipButton: skipButton as unknown as HTMLElement,
    startButton: startButton as unknown as HTMLElement,
    playedKey: "tsukinomi:cutscene:played:3",
    loadScene: async () => {
      probe.loads++;
      return { name: "scene" };
    },
    play: (_loaded, ctx) => {
      probe.plays++;
      probe.complete = ctx.complete;
      const handle: CutsceneSceneHandle = {
        pause: () => void probe.paused++,
        dispose: () => void probe.disposed++,
      };
      return handle;
    },
    still: () => {
      probe.stills++;
    },
    onOpen: (info) => void probe.opens.push(info),
    onClose: (info) => void probe.closes.push(info),
    focusAfterClose: probe.focusTarget as unknown as HTMLElement,
    cover: {
      isActive: () => probe.cover.active,
      lift: () => void probe.cover.lifted++,
    },
    fadeOutMs: 0,
    ...overrides,
  };
  return { probe, runner: createCutsceneRunner(config) };
}

const cancelable = (type: string) => new Event(type, { cancelable: true });

describe("createCutsceneRunner: playing", () => {
  it("opens the dialog as a modal, writes the played key and runs the scene", async () => {
    const { probe, runner } = make();
    runner.start();
    await tick();
    assert.equal(runner.state, "playing");
    assert.equal(probe.loads, 1);
    assert.equal(probe.plays, 1);
    assert.equal(dialog.showModalCalls, 1);
    assert.equal(dialog.open, true);
    assert.equal(dialog.dataset.state, "playing");
    assert.equal(dialog.dataset.mode, "motion");
    assert.equal(skipButton.focusCalls, 1, "focus starts on the skip control");
    assert.equal(probe.cover.lifted, 1);
    assert.deepEqual(probe.opens, [{ still: false }]);
    const stored = env.storage.get("tsukinomi:cutscene:played:3");
    assert.ok(stored);
    assert.equal(new Date(stored).toISOString(), stored, "the key holds an ISO string");
    assert.ok(Math.abs(Date.parse(stored) - Date.now()) < 5000);
  });

  it("finishes when the scene signals completion and returns focus", async () => {
    const { probe, runner } = make();
    runner.start();
    await tick();
    probe.complete();
    assert.equal(await runner.settled, "finished");
    assert.equal(runner.state, "finished");
    assert.equal(dialog.open, false);
    assert.equal(dialog.dataset.state, "finished");
    assert.equal(probe.paused, 1);
    assert.equal(probe.disposed, 1);
    assert.equal(probe.focusTarget.focusCalls, 1);
    assert.deepEqual(probe.closes, [{ reason: "complete", still: false }]);
  });

  it("takes focus back to the element that had it when no target is configured", async () => {
    const opener = new FakeElement(env);
    env.document.activeElement = opener;
    const { runner } = make({ focusAfterClose: undefined });
    runner.start();
    await tick();
    assert.equal(opener.focusCalls, 0);
    runner.skip();
    await runner.settled;
    assert.equal(opener.focusCalls, 1);
  });

  it("runs the default fade before closing", async () => {
    const { probe, runner } = make({ fadeOutMs: 30 });
    runner.start();
    await tick();
    runner.skip();
    assert.equal(runner.state, "finishing");
    assert.equal(dialog.dataset.state, "finishing");
    assert.equal(dialog.open, true);
    await sleep(60);
    assert.equal(runner.state, "finished");
    assert.equal(probe.closes.length, 1);
  });

  it("lets a caller-supplied fade replace the default and stops it on abort", async () => {
    let stopped = 0;
    let finishFade: () => void = () => {};
    const { runner } = make({
      fadeOut: (_dialog, done) => {
        finishFade = done;
        return () => void stopped++;
      },
    });
    runner.start();
    await tick();
    runner.skip();
    assert.equal(runner.state, "finishing");
    finishFade();
    assert.equal(runner.state, "finished");
    assert.equal(stopped, 1, "the fade is stopped as part of the clean-up");
  });

  it("strips forced-replay parameters from the address bar once it opens", async () => {
    setUrl("https://x.test/MY-NOVEL/tsukinomi/part-3/?cutscene=replay#top");
    const { runner } = make();
    runner.start();
    await tick();
    assert.deepEqual(env.replaced, ["/MY-NOVEL/tsukinomi/part-3/#top"]);
  });
});

describe("createCutsceneRunner: when it does not play", () => {
  it("never loads the scene when today's play is recorded (ISO string)", async () => {
    env.storage.set("tsukinomi:cutscene:played:3", playedStamp(new Date()));
    const { probe, runner } = make();
    runner.start();
    await tick();
    assert.equal(await runner.settled, "skipped");
    assert.equal(probe.loads, 0);
    assert.equal(dialog.showModalCalls, 0);
    assert.equal(probe.cover.lifted, 1);
    assert.deepEqual(probe.opens, []);
    assert.deepEqual(probe.closes, []);
    assert.equal(dialog.dataset.state, "skipped");
  });

  it("honours the legacy numeric-millisecond value the old Tsukinomi cutscene wrote", async () => {
    env.storage.set("tsukinomi:cutscene:played:3", String(Date.now()));
    const { probe, runner } = make();
    runner.start();
    await tick();
    assert.equal(probe.loads, 0);
    assert.equal(runner.state, "skipped");
  });

  it("plays again once the recorded play is from before the last 06:00", async () => {
    env.storage.set("tsukinomi:cutscene:played:3", String(Date.now() - 2 * 24 * 3600_000));
    const { probe, runner } = make();
    runner.start();
    await tick();
    assert.equal(probe.loads, 1);
    assert.equal(runner.state, "playing");
  });

  it("treats an unreadable value as not played", async () => {
    env.storage.set("tsukinomi:cutscene:played:3", "garbage");
    const { probe, runner } = make();
    runner.start();
    await tick();
    assert.equal(probe.loads, 1);
  });

  it("stays quiet on ?resume=1 and on history traversal, but replays when asked", async () => {
    setUrl("https://x.test/MY-NOVEL/tsukinomi/part-3/?resume=1");
    let made = make();
    made.runner.start();
    await tick();
    assert.equal(made.probe.loads, 0);

    setUrl("https://x.test/MY-NOVEL/tsukinomi/part-3/");
    made = make({ traversal: true });
    made.runner.start();
    await tick();
    assert.equal(made.probe.loads, 0);

    env.storage.set("tsukinomi:cutscene:played:3", playedStamp(new Date()));
    setUrl("https://x.test/MY-NOVEL/tsukinomi/part-3/?cutscene=replay&resume=1");
    made = make({ traversal: true });
    made.runner.start();
    await tick();
    assert.equal(made.probe.loads, 1);
    assert.equal(made.runner.state, "playing");
  });

  it("honours ?cutscene=force only in dev, and never off a page without a cutscene", async () => {
    env.storage.set("tsukinomi:cutscene:played:3", playedStamp(new Date()));
    setUrl("https://x.test/a/?cutscene=force");
    let made = make({ dev: false });
    made.runner.start();
    await tick();
    assert.equal(made.probe.loads, 0);
    made = make({ dev: true });
    made.runner.start();
    await tick();
    assert.equal(made.probe.loads, 1);
    made.runner.destroy();

    setUrl("https://x.test/a/?cutscene=replay");
    made = make({ hasEntry: false });
    made.runner.start();
    await tick();
    assert.equal(made.probe.loads, 0);
  });

  it("reads the forced-replay parameters from config.search when given", async () => {
    // The page's own URL was already rewritten; the gate's snapshot carries the request.
    env.storage.set("tsukinomi:cutscene:played:3", playedStamp(new Date()));
    const { probe, runner } = make({ search: "?cutscene=replay" });
    runner.start();
    await tick();
    assert.equal(probe.loads, 1);
  });

  it("survives unavailable storage: it plays, and a write failure is ignored", async () => {
    storageBroken = "get";
    let made = make();
    made.runner.start();
    await tick();
    assert.equal(made.runner.state, "playing");
    made.runner.destroy();

    env.storage.clear();
    storageBroken = "set";
    made = make();
    made.runner.start();
    await tick();
    assert.equal(made.runner.state, "playing");
    assert.equal(env.warnings.length, 0);
  });

  it("drops the cutscene when the scene fails to load", async () => {
    const { probe, runner } = make({
      loadScene: async () => {
        throw new Error("chunk 404");
      },
    });
    runner.start();
    await tick();
    assert.equal(await runner.settled, "skipped");
    assert.equal(dialog.showModalCalls, 0);
    assert.equal(env.storage.size, 0, "a cutscene that never showed is not recorded as played");
    assert.equal(probe.cover.lifted, 1);
    assert.equal(env.warnings.length, 1);
    assert.match(String(env.warnings[0][0]), /^\[cutscene\] cutscene skipped/);
  });

  it("drops the cutscene when the cover was already lifted, unless forced", async () => {
    let made = make();
    made.probe.cover.active = false;
    made.runner.start();
    await tick();
    assert.equal(made.probe.loads, 1, "the load began while the cover was up...");
    assert.equal(made.runner.state, "skipped", "...but it is not shown over readable text");
    assert.equal(dialog.showModalCalls, 0);

    setUrl("https://x.test/a/?cutscene=replay");
    made = make();
    made.probe.cover.active = false;
    made.runner.start();
    await tick();
    assert.equal(made.runner.state, "playing");
  });

  it("checks the cover again after prepare()", async () => {
    const made = make({
      prepare: async () => {
        made.probe.prepares++;
        made.probe.cover.active = false;
      },
    });
    made.runner.start();
    await tick();
    assert.equal(made.probe.prepares, 1);
    assert.equal(made.runner.state, "skipped");
    assert.equal(dialog.showModalCalls, 0);
  });

  it("drops the cutscene when the dialog cannot be opened", async () => {
    dialog.failToOpen = true;
    const { probe, runner } = make();
    runner.start();
    await tick();
    assert.equal(runner.state, "skipped");
    assert.equal(env.storage.size, 0);
    assert.equal(probe.plays, 0);
    assert.deepEqual(probe.opens, []);
  });
});

describe("createCutsceneRunner: the tab and the page", () => {
  it("waits for a visible tab before loading anything", async () => {
    env.document.hidden = true;
    const { probe, runner } = make();
    runner.start();
    await tick();
    assert.equal(runner.state, "pending");
    assert.equal(probe.loads, 0);
    env.document.hidden = false;
    env.document.dispatchEvent(new Event("visibilitychange"));
    await tick();
    assert.equal(probe.loads, 1);
    assert.equal(runner.state, "playing");
  });

  it("ignores visibilitychange while the tab is still hidden", async () => {
    env.document.hidden = true;
    const { probe, runner } = make();
    runner.start();
    env.document.dispatchEvent(new Event("visibilitychange"));
    await tick();
    assert.equal(probe.loads, 0);
    assert.equal(runner.state, "pending");
  });

  it("aborts on astro:before-swap while waiting: nothing loads afterwards", async () => {
    env.document.hidden = true;
    const { probe, runner } = make();
    runner.start();
    env.document.dispatchEvent(new Event("astro:before-swap"));
    assert.equal(runner.state, "skipped");
    env.document.hidden = false;
    env.document.dispatchEvent(new Event("visibilitychange"));
    await tick();
    assert.equal(probe.loads, 0);
    assert.equal(probe.cover.lifted, 1);
  });

  it("aborts mid-scene on astro:before-swap: closes, disposes, keeps focus and URL alone", async () => {
    setUrl("https://x.test/MY-NOVEL/tsukinomi/part-3/?cutscene=replay");
    const { probe, runner } = make();
    runner.start();
    await tick();
    const replacedAtOpen = env.replaced.length;
    env.document.dispatchEvent(new Event("astro:before-swap"));
    assert.equal(await runner.settled, "finished");
    assert.equal(dialog.open, false);
    assert.equal(probe.disposed, 1);
    assert.equal(probe.focusTarget.focusCalls, 0);
    assert.equal(env.replaced.length, replacedAtOpen);
    assert.deepEqual(probe.closes, [{ reason: "aborted", still: false }]);
  });

  it("drops a scene that finished loading after the page was left", async () => {
    let release: () => void = () => {};
    const { probe, runner } = make({
      loadScene: () =>
        new Promise((resolve) => {
          release = () => resolve({ name: "late" });
        }),
    });
    runner.start();
    await tick();
    assert.equal(runner.state, "loading");
    runner.destroy();
    release();
    await tick();
    assert.equal(dialog.showModalCalls, 0);
    assert.equal(probe.plays, 0);
    assert.equal(runner.state, "skipped");
  });

  it("does nothing after destroy, and destroy is idempotent", async () => {
    const { probe, runner } = make();
    runner.destroy();
    runner.destroy();
    runner.start();
    await tick();
    assert.equal(probe.loads, 0);
    assert.equal(runner.state, "skipped");
  });

  it("stops listening once settled", async () => {
    const { probe, runner } = make();
    runner.start();
    await tick();
    runner.skip();
    await runner.settled;
    dialog.dispatchEvent(cancelable("cancel"));
    env.document.dispatchEvent(new Event("astro:before-swap"));
    skipButton.dispatchEvent(new Event("click"));
    assert.equal(probe.closes.length, 1);
    assert.equal(probe.disposed, 1);
    assert.equal(probe.cover.lifted, 2, "once at open and once at the end, never again");
  });
});

describe("createCutsceneRunner: ways to skip", () => {
  it("skips on the skip button, and a second press is ignored", async () => {
    const { probe, runner } = make({ fadeOutMs: 20 });
    runner.start();
    await tick();
    skipButton.dispatchEvent(new Event("click"));
    skipButton.dispatchEvent(new Event("click"));
    assert.equal(runner.state, "finishing");
    await runner.settled;
    assert.deepEqual(probe.closes, [{ reason: "skip", still: false }]);
    assert.equal(probe.paused, 1);
  });

  it("skips on Escape and cancels the browser's own close", async () => {
    const { probe, runner } = make();
    runner.start();
    await tick();
    const cancel = cancelable("cancel");
    dialog.dispatchEvent(cancel);
    assert.equal(cancel.defaultPrevented, true);
    assert.equal(await runner.settled, "finished");
    assert.equal(probe.closes[0].reason, "skip");
  });

  it("cleans up without a fade when the browser closes the dialog itself", async () => {
    const { probe, runner } = make({ fadeOutMs: 500 });
    runner.start();
    await tick();
    dialog.open = false;
    dialog.dispatchEvent(new Event("close"));
    assert.equal(runner.state, "finished");
    assert.deepEqual(probe.closes, [{ reason: "closed", still: false }]);
    assert.equal(probe.disposed, 1);
  });

  it("does not skip on a tap unless tap-to-skip is configured", async () => {
    const { runner } = make();
    runner.start();
    await tick();
    await sleep(20);
    dialog.dispatchEvent(new Event("pointerup"));
    assert.equal(runner.state, "playing");
  });

  it("skips on a tap only after the grace period", async () => {
    const { runner } = make({ tapSkipGraceMs: 40 });
    runner.start();
    await tick();
    dialog.dispatchEvent(new Event("pointerup"));
    assert.equal(runner.state, "playing", "a tap inside the grace is ignored");
    await sleep(60);
    dialog.dispatchEvent(new Event("pointerup"));
    assert.equal(runner.state, "finished");
  });

  it("skip() acts like the button and is a no-op before the dialog opens", async () => {
    const { probe, runner } = make();
    runner.skip();
    assert.equal(runner.state, "idle");
    runner.start();
    await tick();
    runner.skip();
    assert.equal(await runner.settled, "finished");
    assert.equal(probe.closes[0].reason, "skip");
  });

  it("ignores a completion signal that arrives after a skip", async () => {
    const { probe, runner } = make({ fadeOutMs: 20 });
    runner.start();
    await tick();
    runner.skip();
    probe.complete();
    await runner.settled;
    assert.equal(probe.closes.length, 1);
    assert.equal(probe.closes[0].reason, "skip");
  });
});

describe("createCutsceneRunner: page-scroll lock", () => {
  it("blocks wheel, touch-move and scroll keys while open", async () => {
    const { runner } = make();
    runner.start();
    await tick();
    for (const type of ["wheel", "touchmove"]) {
      const event = cancelable(type);
      dialog.dispatchEvent(event);
      assert.equal(event.defaultPrevented, true, type);
    }
    for (const key of ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]) {
      const event = Object.assign(cancelable("keydown"), { key });
      dialog.dispatchEvent(event);
      assert.equal(event.defaultPrevented, true, key);
    }
    for (const key of ["Enter", " ", "Tab", "a"]) {
      const event = Object.assign(cancelable("keydown"), { key });
      dialog.dispatchEvent(event);
      assert.equal(event.defaultPrevented, false, `${JSON.stringify(key)} keeps working`);
    }
  });

  it("releases the lock after the dialog closed", async () => {
    const { runner } = make();
    runner.start();
    await tick();
    runner.skip();
    await runner.settled;
    const event = cancelable("wheel");
    dialog.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
  });
});

describe("createCutsceneRunner: reduced motion", () => {
  it("shows the static still without loading a scene", async () => {
    reduced = true;
    const { probe, runner } = make();
    runner.start();
    await tick();
    assert.equal(probe.loads, 0, "the scene module is never downloaded");
    assert.equal(probe.plays, 0);
    assert.equal(probe.stills, 1);
    assert.equal(runner.state, "playing");
    assert.equal(dialog.showModalCalls, 1);
    assert.equal(dialog.dataset.mode, "still");
    assert.equal(skipButton.hidden, true);
    assert.equal(startButton.hidden, false);
    assert.equal(startButton.focusCalls, 1);
    assert.ok(env.storage.has("tsukinomi:cutscene:played:3"));
    assert.deepEqual(probe.opens, [{ still: true }]);
  });

  it("closes the still at once, without a fade, on the start button", async () => {
    reduced = true;
    const { probe, runner } = make({ fadeOutMs: 5000 });
    runner.start();
    await tick();
    startButton.dispatchEvent(new Event("click"));
    assert.equal(runner.state, "finished");
    assert.deepEqual(probe.closes, [{ reason: "skip", still: true }]);
    assert.equal(probe.focusTarget.focusCalls, 1);
  });

  it("keeps the skip button visible when there is no start button", async () => {
    reduced = true;
    const { runner } = make({ startButton: undefined });
    runner.start();
    await tick();
    assert.equal(skipButton.hidden, false);
    assert.equal(skipButton.focusCalls, 1);
    assert.equal(dialog.dataset.mode, "still");
    runner.destroy();
  });

  it("runs the still's cleanup when it closes", async () => {
    reduced = true;
    let cleaned = 0;
    const { runner } = make({ still: () => () => void cleaned++ });
    runner.start();
    await tick();
    runner.skip();
    assert.equal(cleaned, 1);
  });

  it("uses the caller's own reduced-motion test when given", async () => {
    // Sea also treats its own motion switch as reduced motion.
    reduced = false;
    const { probe, runner } = make({ reducedMotion: () => true });
    runner.start();
    await tick();
    assert.equal(probe.loads, 0);
    assert.equal(dialog.dataset.mode, "still");
  });

  it("still drops the still when the cover was already lifted, unless forced", async () => {
    reduced = true;
    const { probe, runner } = make();
    probe.cover.active = false;
    runner.start();
    await tick();
    assert.equal(runner.state, "skipped");
    assert.equal(dialog.showModalCalls, 0);
  });
});

describe("createCutsceneRunner: failing scenes and hooks", () => {
  it("closes cleanly when the scene throws while starting", async () => {
    const { probe, runner } = make({
      play: () => {
        throw new Error("canvas lost");
      },
    });
    runner.start();
    await tick();
    assert.equal(await runner.settled, "finished");
    assert.equal(dialog.open, false);
    assert.deepEqual(probe.closes, [{ reason: "error", still: false }]);
    assert.equal(probe.cover.lifted, 2);
  });

  it("keeps closing when the onOpen and onClose hooks throw", async () => {
    const { runner } = make({
      onOpen: () => {
        throw new Error("open hook");
      },
      onClose: () => {
        throw new Error("close hook");
      },
    });
    runner.start();
    await tick();
    runner.skip();
    assert.equal(await runner.settled, "finished");
    assert.equal(dialog.open, false);
    assert.equal(env.warnings.length, 2);
  });

  it("keeps closing when the scene's dispose throws", async () => {
    const { runner } = make({ play: () => ({ dispose: () => { throw new Error("dispose"); } }) });
    runner.start();
    await tick();
    runner.skip();
    assert.equal(await runner.settled, "finished");
    assert.equal(dialog.open, false);
  });

  it("prefixes warnings with the configured label", async () => {
    const { runner } = make({
      label: "tsukinomi",
      loadScene: async () => {
        throw new Error("nope");
      },
    });
    runner.start();
    await tick();
    assert.match(String(env.warnings[0][0]), /^\[tsukinomi\] /);
  });
});

describe("the shared runner stays generic", () => {
  const source = readFileSync(new URL("./runner.ts", import.meta.url), "utf8");
  // Comments explain the two consumers by name; the code must not know either.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

  it("imports only ./core and no animation library or novel-specific module", () => {
    const specifiers = [...code.matchAll(/\bfrom\s+"([^"]+)"|\bimport\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1] ?? match[2]);
    assert.deepEqual(specifiers, ["./core"]);
    assert.doesNotMatch(code, /gsap|\bsea\b|tsukinomi|lodge|kusabi/i, "no library or novel-specific name in code");
  });

  it("listens for Astro lifecycle events on document, never window", () => {
    assert.match(code, /document\.addEventListener\("astro:before-swap"/);
    assert.doesNotMatch(code, /window\.addEventListener\(\s*["'`]astro:/);
  });
});
