// The DOM and clock halves of the placeholder plate reveal, against the fake
// DOM. The rule they protect: the epigraph stays real text, whatever the scene
// does to it.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { FakeElement, installFakeDom, type FakeEnv } from "../../../_shared/cutscene/fake-dom";
import { EPIGRAPHS } from "../epigraphs";
import { clampScrim, createRevealClock, splitIntoClusters } from "./plate-core";
import { STAGGER_MS } from "./plate-timing";

let env: FakeEnv;
let now = 0;

beforeEach(() => {
  env = installFakeDom("https://x.test/MY-NOVEL/tsukinomi/sections/01-discovery/");
  now = 0;
  mock.timers.enable({ apis: ["setTimeout"] });
  mock.method(performance, "now", () => now);
});

afterEach(() => {
  mock.restoreAll();
  mock.timers.reset();
  env.restore();
});

function paragraph(text: string): FakeElement {
  const element = new FakeElement(env);
  element.textContent = text;
  return element;
}

// Thai combining signs that must travel with their consonant: mai han-akat, sara am, above and below vowels, tone marks.
const COMBINING = /^[ัำ-ฺ็-๎]/;

describe("splitIntoClusters", () => {
  it("keeps every epigraph's text exactly as it was, character for character", () => {
    for (const [part, text] of Object.entries(EPIGRAPHS)) {
      const element = paragraph(text);
      splitIntoClusters(element as unknown as HTMLElement);
      assert.equal(element.textContent, text, `part ${part}: textContent must not change`);
    }
  });

  it("keeps the last character and counts one span per cluster", () => {
    const element = paragraph("ใต้หลังคา สังกะสี");
    const count = splitIntoClusters(element as unknown as HTMLElement);
    assert.equal(count, element.children.length);
    assert.equal(element.children.at(-1)?.textContent, "สี", "the vowel stays with its consonant and the last cluster is kept");
    assert.equal(element.children.map((child) => child.textContent).join(""), "ใต้หลังคา สังกะสี");
  });

  it("never starts a span with a Thai combining mark, so vowels and tone marks stay on their consonant", () => {
    for (const text of Object.values(EPIGRAPHS)) {
      const element = paragraph(text);
      splitIntoClusters(element as unknown as HTMLElement);
      for (const child of element.children) {
        assert.doesNotMatch(child.textContent, COMBINING, `span ${JSON.stringify(child.textContent)} starts with a combining mark`);
      }
    }
  });

  it("gives each span the class and a staggered animation delay", () => {
    const element = paragraph("กขค");
    splitIntoClusters(element as unknown as HTMLElement);
    assert.deepEqual(
      element.children.map((child) => [child.className, child.style.animationDelay]),
      [
        ["tsuki-g", "0ms"],
        ["tsuki-g", `${STAGGER_MS}ms`],
        ["tsuki-g", `${2 * STAGGER_MS}ms`],
      ],
    );
  });

  it("handles an empty paragraph", () => {
    const element = paragraph("");
    assert.equal(splitIntoClusters(element as unknown as HTMLElement), 0);
    assert.equal(element.textContent, "");
  });
});

describe("clampScrim", () => {
  it("keeps a scrim between 0 and 1 and treats anything unreadable as none", () => {
    assert.equal(clampScrim(0.4), 0.4);
    assert.equal(clampScrim(-1), 0);
    assert.equal(clampScrim(7), 1);
    assert.equal(clampScrim(Number.NaN), 0);
    assert.equal(clampScrim(Number.POSITIVE_INFINITY), 0);
  });
});

describe("createRevealClock", () => {
  const start = (totalMs: number, signal = new AbortController().signal) => {
    let done = false;
    const clock = createRevealClock(totalMs, signal);
    void clock.done.then(() => {
      done = true;
    });
    return {
      clock,
      isDone: () => done,
      advance: async (ms: number) => {
        now += ms;
        mock.timers.tick(ms);
        await Promise.resolve();
      },
    };
  };

  it("ends after the run time, and not a moment before", async () => {
    const run = start(1000);
    await run.advance(999);
    assert.equal(run.isDone(), false);
    await run.advance(1);
    assert.equal(run.isDone(), true);
  });

  it("stands still while the tab is hidden and resumes with the time that was left", async () => {
    // CSS animations stop in a background tab; a plain timer would end the scene unread.
    const run = start(1000);
    await run.advance(400);
    env.document.hidden = true;
    env.document.dispatchEvent(new Event("visibilitychange"));
    await run.advance(60_000);
    assert.equal(run.isDone(), false, "no time passes while hidden");
    env.document.hidden = false;
    env.document.dispatchEvent(new Event("visibilitychange"));
    await run.advance(599);
    assert.equal(run.isDone(), false);
    await run.advance(1);
    assert.equal(run.isDone(), true);
  });

  it("does not start counting in a tab that is hidden to begin with", async () => {
    env.document.hidden = true;
    const run = start(500);
    await run.advance(10_000);
    assert.equal(run.isDone(), false);
    env.document.hidden = false;
    env.document.dispatchEvent(new Event("visibilitychange"));
    await run.advance(500);
    assert.equal(run.isDone(), true);
  });

  it("stops for good on dispose() and on an abort, and removes its listeners", async () => {
    const run = start(1000);
    await run.advance(500);
    run.clock.dispose();
    run.clock.dispose();
    await run.advance(10_000);
    assert.equal(run.isDone(), false, "a disposed scene never reports an ending");
    assert.equal(env.document.listenerCount("visibilitychange"), 0);

    const controller = new AbortController();
    const aborted = start(1000, controller.signal);
    controller.abort();
    await aborted.advance(10_000);
    assert.equal(aborted.isDone(), false);
    assert.equal(env.document.listenerCount("visibilitychange"), 0);
  });
});
