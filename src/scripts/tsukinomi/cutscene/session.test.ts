// The cutscene session against the fake DOM, a fake audio and a fake scene
// runtime: what a scene is handed, and what is taken away again when it ends.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { FakeDialog, FakeElement, installFakeDom, type FakeEnv } from "../../_shared/cutscene/fake-dom";
import type { SceneOptions } from "../../_shared/scene-runtime";
import type { RestoreOptions, SceneAudio } from "./audio";
import { registryEntry } from "./registry";
import { createSession, type SessionInit } from "./session";

let env: FakeEnv;
let stage: FakeElement;
let restores: RestoreOptions[];
let built: Array<{ options: SceneOptions; started: number; stopped: number; destroyed: number }>;

beforeEach(() => {
  env = installFakeDom("https://x.test/MY-NOVEL/tsukinomi/sections/01-discovery/");
  stage = new FakeElement(env);
  restores = [];
  built = [];
});

afterEach(() => {
  env.restore();
});

const fakeAudio = (): SceneAudio => ({
  snapshot: () => {
    throw new Error("not used");
  },
  available: () => true,
  setCue: () => {},
  layerSoundscape: () => {},
  sfx: () => {},
  requestPlayFromGesture: async () => true,
  restore: (options) => void restores.push(options ?? {}),
  startedFromGesture: false,
});

const deps = () => ({
  audio: fakeAudio(),
  withBase: (path: string) => `/MY-NOVEL${path}`,
  createScene: (options: SceneOptions) => {
    const scene = { options, started: 0, stopped: 0, destroyed: 0 };
    built.push(scene);
    return {
      start: () => void scene.started++,
      stop: () => void scene.stopped++,
      destroy: () => void scene.destroyed++,
    };
  },
});

function init(overrides: Partial<SessionInit> = {}): SessionInit {
  return {
    dialog: new FakeDialog(env) as unknown as HTMLDialogElement,
    stage: stage as unknown as HTMLElement,
    textEl: new FakeElement(env) as unknown as HTMLElement,
    part: 1,
    entry: registryEntry(1),
    reducedMotion: false,
    skip: () => {},
    pageCue: "discovery",
    ...overrides,
  };
}

const loopOptions = (extra: Partial<Parameters<ReturnType<typeof makeSession>["ctx"]["createCanvasLoop"]>[0]> = {}) => ({
  render: () => {},
  ...extra,
});

function makeSession(overrides: Partial<SessionInit> = {}) {
  return createSession(init(overrides), deps());
}

describe("createSession: what a scene is handed", () => {
  it("passes the dialog, stage, text, part and skip through, and resolves the assets under the site base", () => {
    let skipped = 0;
    const session = makeSession({ skip: () => void skipped++ });
    const { ctx } = session;
    assert.equal(ctx.part, 1);
    assert.equal(ctx.stage, stage as unknown);
    ctx.skip();
    assert.equal(skipped, 1);
    assert.equal(ctx.reducedMotion, false);
    assert.equal(ctx.signal.aborted, false);
    assert.equal(ctx.assets.backgroundUrl, "/MY-NOVEL/assets/tsukinomi/images/backgrounds/section-01.webp");
    assert.match(ctx.assets.backgroundCss, /^image-set\(url\("\/MY-NOVEL\/assets\/tsukinomi\/images\/backgrounds\/section-01\.avif"\)/);
    session.dispose();
  });

  it("gives a reduced-motion session silent audio that never touches the Walkman", async () => {
    const session = createSession(init({ reducedMotion: true }), { withBase: (path) => path });
    assert.equal(session.ctx.reducedMotion, true);
    assert.equal(session.ctx.audio.available(), false);
    assert.equal(await session.ctx.audio.requestPlayFromGesture(), false);
    session.dispose();
  });
});

describe("createSession: canvas loops", () => {
  it("appends an aria-hidden canvas to the stage, marked with its class, and hands the options to the scene runtime", () => {
    const session = makeSession();
    const render = () => {};
    const onPointer = () => {};
    const loop = session.ctx.createCanvasLoop({ render, onPointer, className: "tsuki-rain" });
    const canvas = loop.canvas as unknown as FakeElement;
    assert.deepEqual(stage.children, [canvas]);
    assert.equal(canvas.tagName, "CANVAS");
    assert.equal(canvas.className, "tsuki-cutscene__canvas tsuki-rain");
    assert.equal(canvas.getAttribute("aria-hidden"), "true", "a decorative canvas must stay out of the accessibility tree");
    assert.equal(built.length, 1);
    assert.equal(built[0].options.canvas, canvas as unknown);
    assert.equal(built[0].options.container, stage as unknown);
    assert.equal(built[0].options.render, render);
    assert.equal(built[0].options.onPointer, onPointer);
    session.dispose();
  });

  it("uses a plain class name when the scene gives none", () => {
    const session = makeSession();
    const loop = session.ctx.createCanvasLoop(loopOptions());
    assert.equal((loop.canvas as unknown as FakeElement).className, "tsuki-cutscene__canvas");
    session.dispose();
  });

  it("caps the device pixel ratio at 1.5 unless the scene asks otherwise", () => {
    const session = makeSession();
    session.ctx.createCanvasLoop(loopOptions());
    session.ctx.createCanvasLoop(loopOptions({ dprCap: 2 }));
    assert.deepEqual(
      built.map((scene) => scene.options.dprCap),
      [1.5, 2],
    );
    session.dispose();
  });

  it("forwards start and stop, and pause() stops every loop", () => {
    const session = makeSession();
    const first = session.ctx.createCanvasLoop(loopOptions());
    session.ctx.createCanvasLoop(loopOptions());
    first.start();
    assert.equal(built[0].started, 1);
    first.stop();
    assert.equal(built[0].stopped, 1);
    session.pause();
    assert.deepEqual(
      built.map((scene) => scene.stopped),
      [2, 1],
    );
    session.dispose();
  });

  it("destroys a loop the scene destroyed itself only once, and a loop it forgot on dispose()", () => {
    const session = makeSession();
    const kept = session.ctx.createCanvasLoop(loopOptions());
    const own = session.ctx.createCanvasLoop(loopOptions());
    own.destroy();
    own.destroy();
    assert.equal(built[1].destroyed, 1, "destroy is idempotent");
    assert.equal(stage.children.length, 1, "the canvas of a destroyed loop leaves the stage");
    session.dispose();
    assert.equal(built[0].destroyed, 1, "a forgotten loop does not outlive the cutscene");
    assert.equal(built[1].destroyed, 1);
    assert.equal(stage.children.length, 0);
    assert.equal((kept.canvas as unknown as FakeElement).isConnected, false);
  });
});

describe("createSession: ending", () => {
  it("abort() aborts the signal and is idempotent, before dispose()", () => {
    const session = makeSession();
    session.abort();
    session.abort();
    assert.equal(session.ctx.signal.aborted, true);
    assert.deepEqual(restores, [], "the audio is only handed back by dispose()");
    session.dispose();
  });

  it("dispose() aborts the signal and hands the audio back with the page's cue, once", () => {
    const session = makeSession({ pageCue: "decision" });
    session.dispose();
    session.dispose();
    assert.equal(session.ctx.signal.aborted, true);
    assert.deepEqual(restores, [{ cue: "decision" }]);
  });

  it("passes no cue when the page's cue is missing or not a cue", () => {
    for (const pageCue of [undefined, "", "not-a-cue"]) {
      restores.length = 0;
      makeSession({ pageCue }).dispose();
      assert.deepEqual(restores, [{ cue: undefined }], `pageCue ${JSON.stringify(pageCue)}`);
    }
  });

  it("hands the audio back when the page is hidden for good (reload, closed tab), and not a second time at dispose()", () => {
    // The Walkman persists a layered soundscape the moment it is set; no dispose() runs on a hard exit.
    const session = makeSession({ pageCue: "reveal" });
    env.window.dispatchEvent(new Event("pagehide"));
    assert.deepEqual(restores, [{ cue: "reveal" }]);
    session.dispose();
    assert.equal(env.window.listenerCount("pagehide"), 0, "the listener goes with the session");
  });

  it("stops listening for pagehide once disposed", () => {
    const session = makeSession();
    assert.equal(env.window.listenerCount("pagehide"), 1);
    session.dispose();
    assert.equal(env.window.listenerCount("pagehide"), 0);
    env.window.dispatchEvent(new Event("pagehide"));
    assert.equal(restores.length, 1, "only dispose() restored");
  });
});
