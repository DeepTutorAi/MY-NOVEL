// The Tsukinomi cutscene adapter (index.ts) against the fake DOM, a fake
// registry entry and a fake session module. What it decides for itself: which
// of the page's facts reach the runner (the gate's URL snapshot, the navigation
// type, dev), when the scene and session chunks are downloaded, how a scene's
// ending and failure map onto the runner, the reduced-motion still, the
// no-flash cover hold and where focus lands afterwards. The rules behind these
// (cooldown, state machine, scroll lock) are core.test.ts and runner.test.ts.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { playedStamp } from "../../_shared/cutscene/core";
import { FakeButton, FakeDialog, FakeElement, installFakeDom, type FakeEnv } from "../../_shared/cutscene/fake-dom";
import { COVER_CLASS, PLAYED_PREFIX, SCENE_LOAD_BUDGET_MS, setupTsukinomiCutscene, type AdapterDeps } from "./index";
import type { TsukiRegistryEntry } from "./registry";
import type { TsukiSceneContext, TsukiSceneHandle, TsukiSceneModule } from "./scene-types";
import type { SessionInit, TsukiSession } from "./session";

const PATH = "/MY-NOVEL/tsukinomi/sections/03-decision/";

let env: FakeEnv;
let dialog: FakeDialog;
let skipButton: FakeButton;
let startButton: FakeButton;
let controls: FakeElement;
let heading: FakeElement;
let main: FakeElement;

interface Rig {
  events: string[];
  loads: { scene: number; session: number };
  scene: { plays: TsukiSceneContext[]; stills: TsukiSceneContext[]; disposed: number; finish: () => void; fail: (error: unknown) => void; throwOnPlay: boolean };
  sessions: Array<{ init: SessionInit; ctx: TsukiSceneContext; paused: number; aborted: number; disposed: number }>;
  holds: number[];
  /** Holds back the session module until release() is called. */
  gate?: { release: () => void };
}

let rig: Rig;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const tick = () => sleep(0);

beforeEach(() => {
  env = installFakeDom(`https://x.test${PATH}`);
  dialog = new FakeDialog(env);
  dialog.dataset.part = "3";
  skipButton = new FakeButton(env);
  startButton = new FakeButton(env);
  startButton.hidden = true;
  const stage = new FakeElement(env);
  const textEl = new FakeElement(env);
  controls = new FakeElement(env);
  dialog.queries = {
    "[data-cutscene-stage]": stage,
    "[data-cutscene-controls]": controls,
    "[data-cutscene-text]": textEl,
    "[data-cutscene-skip]": skipButton,
    "[data-cutscene-start]": startButton,
  };
  heading = new FakeElement(env);
  main = new FakeElement(env);
  const article = new FakeElement(env);
  article.dataset.musicCue = "decision";
  env.document.queries = {
    "dialog.tsuki-cutscene": dialog,
    "article.tsukinomi-section": article,
    "article.tsukinomi-section h1": heading,
  };
  env.document.ids = { "tsukinomi-main": main };
  // What the inline gate did before first paint.
  env.document.documentElement.classList.add(COVER_CLASS);
  rig = {
    events: [],
    loads: { scene: 0, session: 0 },
    scene: { plays: [], stills: [], disposed: 0, finish: () => {}, fail: () => {}, throwOnPlay: false },
    sessions: [],
    holds: [],
  };
  env.window.__tsukiCutsceneNav = { hold: (ms: number) => rig.holds.push(ms) };
});

afterEach(() => {
  mock.restoreAll();
  env.restore();
});

const covered = () => env.document.documentElement.classList.contains(COVER_CLASS);

function sceneModule(): TsukiSceneModule {
  return {
    play(ctx) {
      if (rig.scene.throwOnPlay) {
        controls.append(new FakeButton(env)); // a scene may have added a control before it failed
        throw new Error("canvas lost");
      }
      rig.scene.plays.push(ctx);
      const done = new Promise<void>((resolve, reject) => {
        rig.scene.finish = resolve;
        rig.scene.fail = reject;
      });
      const handle: TsukiSceneHandle = {
        done,
        dispose: () => {
          rig.events.push("scene.dispose");
          rig.scene.disposed++;
        },
      };
      return handle;
    },
    still(ctx) {
      rig.scene.stills.push(ctx);
    },
  };
}

function fakeEntry(): TsukiRegistryEntry {
  return {
    id: "fake-scene",
    load: async () => {
      rig.loads.scene++;
      return sceneModule();
    },
    assets: { plate: null, icons: [], sfx: [] },
    cue: null,
    soundscapes: [],
  };
}

const sessionModule = (): typeof import("./session") =>
  ({
    createSession(init: SessionInit): TsukiSession {
      const record = { init, ctx: { reducedMotion: init.reducedMotion, part: init.part } as unknown as TsukiSceneContext, paused: 0, aborted: 0, disposed: 0 };
      rig.sessions.push(record);
      return {
        ctx: record.ctx,
        pause: () => void record.paused++,
        abort: () => {
          rig.events.push("session.abort");
          record.aborted++;
        },
        dispose: () => {
          rig.events.push("session.dispose");
          record.disposed++;
        },
      };
    },
  }) as unknown as typeof import("./session");

function start(overrides: AdapterDeps = {}) {
  return setupTsukinomiCutscene({
    dev: false,
    entry: fakeEntry(),
    loadSession: async () => {
      rig.loads.session++;
      if (rig.gate === undefined) return sessionModule();
      await new Promise<void>((resolve) => {
        rig.gate = { release: resolve };
      });
      return sessionModule();
    },
    ...overrides,
  });
}

describe("setupTsukinomiCutscene: playing", () => {
  it("downloads the scene and the session, opens the dialog and starts the scene with the session's context", async () => {
    const cleanup = start();
    assert.equal(typeof cleanup, "function");
    await tick();
    assert.deepEqual(rig.loads, { scene: 1, session: 1 });
    assert.equal(dialog.open, true);
    assert.equal(dialog.showModalCalls, 1);
    assert.equal(dialog.dataset.mode, "motion");
    assert.equal(rig.scene.plays.length, 1);
    assert.equal(rig.scene.plays[0], rig.sessions[0].ctx, "the scene is handed the session's context");
    assert.equal(rig.sessions[0].init.part, 3);
    assert.equal(rig.sessions[0].init.controls, controls as unknown, "the dialog's controls slot reaches the session, for ctx.controls");
    assert.equal(rig.sessions[0].init.reducedMotion, false);
    assert.equal(rig.sessions[0].init.pageCue, "decision", "the section's own cue goes to the session, to be restored at the end");
    assert.equal(covered(), false, "the runner lifted the no-flash cover when it opened");
    const stored = env.storage.get(`${PLAYED_PREFIX}3`);
    assert.ok(stored && new Date(stored).toISOString() === stored, "an ISO stamp under the part's key");
    cleanup?.();
  });

  it("ends when the scene's done promise resolves: pauses, aborts, disposes the scene before the session, then closes", async () => {
    start();
    await tick();
    rig.scene.finish();
    await sleep(320); // the default 250 ms fade
    assert.equal(dialog.open, false);
    assert.equal(dialog.dataset.state, "finished");
    assert.equal(rig.sessions[0].paused, 1, "the frame loops stop when the finish begins");
    assert.deepEqual(rig.events, ["session.abort", "scene.dispose", "session.dispose"], "abort, then the scene's own dispose, then the session");
    assert.equal(rig.scene.disposed, 1);
    assert.equal(rig.sessions[0].disposed, 1);
  });

  it("lets the scene end itself early through ctx.skip, which is the runner's skip", async () => {
    start();
    await tick();
    rig.sessions[0].init.skip();
    await sleep(320);
    assert.equal(dialog.dataset.state, "finished");
    assert.equal(rig.scene.disposed, 1);
  });

  it("ends the cutscene, with a warning, when the scene's done promise rejects", async () => {
    start();
    await tick();
    rig.scene.fail(new Error("boom"));
    await sleep(320);
    assert.equal(dialog.dataset.state, "finished");
    assert.equal(env.warnings.length, 1);
    assert.match(String(env.warnings[0][0]), /^\[tsukinomi cutscene\] scene ended with an error/);
  });

  it("undoes the session when the scene throws while starting, and closes the dialog", async () => {
    rig.scene.throwOnPlay = true;
    start();
    await tick();
    assert.equal(dialog.open, false);
    assert.equal(rig.sessions.length, 1);
    assert.equal(rig.sessions[0].aborted, 1);
    assert.equal(rig.sessions[0].disposed, 1, "the runner cannot dispose what play() never returned");
    assert.ok(env.warnings.some((args) => /scene failed/.test(String(args[0]))));
  });

  it("tears everything down when the cleanup returned to onPage runs mid-scene, and when the page is swapped out", async () => {
    const cleanup = start();
    await tick();
    cleanup?.();
    assert.equal(dialog.open, false);
    assert.equal(rig.scene.disposed, 1);
    assert.equal(rig.sessions[0].disposed, 1);

    // The same through the router's own event.
    env.storage.clear();
    rig.events.length = 0;
    rig.sessions.length = 0;
    rig.scene.disposed = 0;
    dialog.open = false;
    delete dialog.dataset.state;
    env.document.documentElement.classList.add(COVER_CLASS);
    start();
    await tick();
    env.document.dispatchEvent(new Event("astro:before-swap"));
    assert.equal(dialog.open, false);
    assert.equal(rig.scene.disposed, 1);
  });

  it("does not skip on a tap, however late: the Skip button and Escape are the ways out", async () => {
    let clock = 1000;
    mock.method(performance, "now", () => clock);
    const cleanup = start();
    await tick();
    clock += 60_000; // long past any tap grace a runner could have
    dialog.dispatchEvent(new Event("pointerup"));
    assert.equal(dialog.open, true);
    assert.equal(dialog.dataset.state, "playing");
    cleanup?.();
  });
});

describe("setupTsukinomiCutscene: when it does not play", () => {
  it("downloads neither the scene nor the session when today's play is recorded, and lifts the cover", async () => {
    env.storage.set(`${PLAYED_PREFIX}3`, playedStamp(new Date()));
    start();
    await tick();
    assert.deepEqual(rig.loads, { scene: 0, session: 0 });
    assert.equal(dialog.showModalCalls, 0);
    assert.equal(dialog.dataset.state, "skipped");
    assert.equal(covered(), false);
    assert.deepEqual(rig.holds, [], "nothing to hold the cover for");
  });

  it("accepts the numeric millisecond stamp the old cutscene wrote", async () => {
    env.storage.set(`${PLAYED_PREFIX}3`, String(Date.now() - 3_600_000));
    start();
    await tick();
    assert.deepEqual(rig.loads, { scene: 0, session: 0 });
  });

  it("reads ?resume=1 from the gate's snapshot, since the reading-progress script already stripped it from the address bar", async () => {
    env.window.__tsukiCutsceneNav = { path: PATH, search: "?resume=1", hold: (ms: number) => rig.holds.push(ms) };
    assert.equal(env.location.search, "", "the live address no longer carries it");
    start();
    await tick();
    assert.deepEqual(rig.loads, { scene: 0, session: 0 });
    assert.equal(dialog.dataset.state, "skipped");
  });

  it("ignores a snapshot taken for another page and reads the live address instead", async () => {
    env.window.__tsukiCutsceneNav = { path: "/MY-NOVEL/tsukinomi/", search: "?resume=1", hold: (ms: number) => rig.holds.push(ms) };
    start();
    await tick();
    assert.equal(rig.loads.scene, 1);
    assert.equal(dialog.open, true);
  });

  it("plays a replay request even when today's play is recorded, and strips it from the address bar", async () => {
    env.storage.set(`${PLAYED_PREFIX}3`, playedStamp(new Date()));
    env.setUrl(`https://x.test${PATH}?cutscene=replay`);
    start();
    await tick();
    assert.equal(dialog.open, true);
    assert.deepEqual(env.replaced, [PATH]);
  });

  it("honours ?cutscene=force only in a development build", async () => {
    env.storage.set(`${PLAYED_PREFIX}3`, playedStamp(new Date()));
    env.setUrl(`https://x.test${PATH}?cutscene=force`);
    start({ dev: false });
    await tick();
    assert.equal(rig.loads.scene, 0);

    env.document.documentElement.classList.add(COVER_CLASS);
    const dev = start({ dev: true });
    await tick();
    assert.equal(rig.loads.scene, 1);
    dev?.();
  });

  it("does not play on history traversal, as told by the gate's snapshot", async () => {
    env.window.__tsukiCutsceneNav = { path: PATH, search: "", traverse: true, hold: (ms: number) => rig.holds.push(ms) };
    start();
    await tick();
    assert.equal(rig.loads.scene, 0);
  });

  it("falls back to the navigation timing entry when there is no snapshot, and prefers the snapshot when there is one", async () => {
    mock.method(performance, "getEntriesByType", () => [{ type: "back_forward" }]);
    delete env.window.__tsukiCutsceneNav;
    start();
    await tick();
    assert.equal(rig.loads.scene, 0, "a reload-from-history of this very page is a traversal");

    env.document.documentElement.classList.add(COVER_CLASS);
    env.window.__tsukiCutsceneNav = { traverse: false, hold: (ms: number) => rig.holds.push(ms) };
    const cleanup = start();
    await tick();
    assert.equal(rig.loads.scene, 1, "the snapshot says this was a normal navigation");
    cleanup?.();
  });

  it("drops the cutscene, downloading nothing, when the cover already lapsed", async () => {
    env.document.documentElement.classList.remove(COVER_CLASS);
    start();
    await tick();
    assert.deepEqual(rig.loads, { scene: 0, session: 0 });
    assert.equal(dialog.showModalCalls, 0);
    assert.equal(env.storage.size, 0, "it never showed, so it is not recorded as played");
  });

  it("lifts the cover and does nothing when the dialog is missing a part", () => {
    for (const missing of ["[data-cutscene-stage]", "[data-cutscene-controls]", "[data-cutscene-text]", "[data-cutscene-skip]", "[data-cutscene-start]"]) {
      env.document.documentElement.classList.add(COVER_CLASS);
      const saved = dialog.queries[missing];
      dialog.queries[missing] = null;
      assert.equal(start(), undefined, missing);
      assert.equal(covered(), false, missing);
      dialog.queries[missing] = saved;
    }
    env.document.documentElement.classList.add(COVER_CLASS);
    delete dialog.dataset.part;
    assert.equal(start(), undefined, "no part number");
    assert.equal(covered(), false);
    env.document.documentElement.classList.add(COVER_CLASS);
    env.document.queries["dialog.tsuki-cutscene"] = null;
    assert.equal(start(), undefined, "no dialog");
    assert.equal(covered(), false);
  });
});

describe("setupTsukinomiCutscene: the no-flash cover", () => {
  it("asks the gate to hold the cover for the scene's download budget while it loads", async () => {
    const cleanup = start();
    assert.deepEqual(rig.holds, [SCENE_LOAD_BUDGET_MS]);
    assert.equal(SCENE_LOAD_BUDGET_MS, 3000);
    await tick();
    cleanup?.();
  });

  it("holds it while waiting for a hidden tab too (the gate counts the budget from when the tab shows)", async () => {
    env.document.hidden = true;
    const cleanup = start();
    assert.deepEqual(rig.holds, [SCENE_LOAD_BUDGET_MS]);
    cleanup?.();
  });

  it("does not hold it for a reduced-motion still, which opens at once", async () => {
    env.reduced = true;
    const cleanup = start();
    assert.deepEqual(rig.holds, []);
    assert.equal(dialog.open, true);
    cleanup?.();
  });

  it("copes with a gate that has no hold (an older snapshot object)", async () => {
    env.window.__tsukiCutsceneNav = { path: PATH, search: "" };
    const cleanup = start();
    await tick();
    assert.equal(dialog.open, true);
    cleanup?.();
  });
});

describe("setupTsukinomiCutscene: reduced motion", () => {
  it("shows the dialog at once, still-mode, with the continue button, and composes the still once the chunks have loaded", async () => {
    env.reduced = true;
    const cleanup = start();
    assert.equal(dialog.open, true, "the real text is on screen before any chunk arrives");
    assert.equal(dialog.dataset.mode, "still");
    assert.equal(skipButton.hidden, true);
    assert.equal(startButton.hidden, false);
    await tick();
    assert.equal(rig.scene.plays.length, 0, "no scene runs");
    assert.equal(rig.scene.stills.length, 1);
    assert.equal(rig.sessions[0].init.reducedMotion, true);
    assert.equal(rig.scene.stills[0], rig.sessions[0].ctx);
    cleanup?.();
  });

  it("takes the still's session away again when it closes", async () => {
    env.reduced = true;
    start();
    await tick();
    startButton.dispatchEvent(new Event("click"));
    assert.equal(dialog.open, false);
    assert.equal(rig.sessions[0].aborted, 1);
    assert.equal(rig.sessions[0].disposed, 1);
  });

  it("builds no session at all when the still was closed before the chunks arrived", async () => {
    env.reduced = true;
    rig.gate = { release: () => {} };
    start();
    await tick();
    startButton.dispatchEvent(new Event("click"));
    rig.gate.release();
    await tick();
    assert.equal(rig.sessions.length, 0, "a late chunk changes nothing");
    assert.equal(rig.scene.stills.length, 0);
  });

  it("warns, and leaves the text on screen, when the still's chunks fail to load", async () => {
    env.reduced = true;
    const cleanup = start({
      loadSession: async () => {
        throw new Error("chunk 404");
      },
    });
    await tick();
    assert.equal(dialog.open, true);
    assert.ok(env.warnings.some((args) => /still failed to load/.test(String(args[0]))));
    cleanup?.();
  });
});

describe("setupTsukinomiCutscene: the controls slot", () => {
  const addControls = (count: number) => controls.append(...Array.from({ length: count }, () => new FakeButton(env)));

  it("hands the same container to a reduced-motion session, which is where still() would find it hidden", async () => {
    env.reduced = true;
    const cleanup = start();
    await tick();
    assert.equal(rig.sessions[0].init.controls, controls as unknown);
    cleanup?.();
  });

  it("empties it right after the scene's dispose, whichever way the cutscene ended (the fake session here empties nothing itself)", async () => {
    start();
    await tick();
    addControls(2);
    rig.scene.finish();
    await sleep(320);
    assert.equal(dialog.open, false);
    assert.deepEqual(rig.events, ["session.abort", "scene.dispose", "session.dispose"]);
    assert.deepEqual(controls.children, [], "no close event fires on the fake dialog, so only the adapter's own clearing can have done this");
  });

  it("empties it when a still closes before its session was ever built, and when a scene throws while starting", async () => {
    env.reduced = true;
    rig.gate = { release: () => {} };
    start();
    await tick();
    addControls(1);
    startButton.dispatchEvent(new Event("click"));
    assert.deepEqual(controls.children, [], "the still was closed with no session to empty it");
    rig.gate.release();
    await tick();

    env.reduced = false;
    env.storage.clear(); // the still above recorded today's play
    delete rig.gate;
    dialog.open = false;
    delete dialog.dataset.state;
    env.document.documentElement.classList.add(COVER_CLASS);
    rig.scene.throwOnPlay = true;
    start();
    await tick();
    assert.equal(rig.sessions.at(-1)?.aborted, 1, "the failed start was undone");
    assert.deepEqual(controls.children, [], "the control the failed scene added is gone");
  });

  it("empties it when the dialog closes, even if the session never got to (the browser closed the dialog by itself)", async () => {
    start();
    await tick();
    addControls(2);
    dialog.open = false; // what the browser did
    dialog.dispatchEvent(new Event("close"));
    assert.deepEqual(controls.children, []);
    assert.equal(rig.sessions[0].disposed, 1, "and the runner took the session down too");
  });

  it("empties it, and stops listening, when the cleanup returned to onPage runs", async () => {
    const cleanup = start();
    await tick();
    assert.equal(dialog.listenerCount("close"), 2, "the runner's own close handler and the adapter's");
    addControls(1);
    cleanup?.();
    assert.deepEqual(controls.children, []);
    assert.equal(dialog.listenerCount("close"), 0, "no listener outlives the page");
  });

  it("leaves a scene's controls alone while it plays", async () => {
    const cleanup = start();
    await tick();
    addControls(2);
    await sleep(20);
    assert.equal(controls.children.length, 2);
    assert.equal(dialog.open, true);
    cleanup?.();
  });
});

describe("setupTsukinomiCutscene: after the dialog closes", () => {
  it("returns focus to the section heading, made focusable without becoming a tab stop", async () => {
    start();
    await tick();
    rig.scene.finish();
    await sleep(320);
    assert.equal(heading.getAttribute("tabindex"), "-1");
    assert.equal(heading.focusCalls, 1);
    assert.equal(main.focusCalls, 0);
  });

  it("falls back to <main> when the page has no heading, and leaves an existing tabindex alone", async () => {
    env.document.queries["article.tsukinomi-section h1"] = null;
    main.setAttribute("tabindex", "0");
    start();
    await tick();
    rig.sessions[0].init.skip();
    await sleep(320);
    assert.equal(main.focusCalls, 1);
    assert.equal(main.getAttribute("tabindex"), "0");
  });

  it("keeps the part's own played key, tsukinomi:cutscene:played:<n>", () => {
    assert.equal(PLAYED_PREFIX, "tsukinomi:cutscene:played:");
  });
});
