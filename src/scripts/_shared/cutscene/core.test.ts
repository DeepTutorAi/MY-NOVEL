import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  canTransition,
  cleanCutsceneUrl,
  COOLDOWN_RESET_HOUR,
  cooldownDay,
  isSettled,
  parseCutsceneParams,
  parsePlayedStamp,
  playedStamp,
  playedToday,
  shouldPlay,
  transition,
  type CutsceneEvent,
  type CutsceneState,
  type CutsceneTrigger,
} from "./core";

// Local-time builders: the rule is "06:00 local", so the tests must not assume a zone.
const local = (day: number, hour: number, minute = 0, second = 0, ms = 0) =>
  new Date(2026, 8, day, hour, minute, second, ms);
const iso = (date: Date) => date.toISOString();

const fresh: CutsceneTrigger = {
  hasEntry: true,
  resume: false,
  traversal: false,
  played: false,
  replay: false,
  force: false,
  dev: false,
};

describe("cooldownDay", () => {
  it("resets at 06:00 local", () => {
    assert.equal(COOLDOWN_RESET_HOUR, 6);
  });

  it("spans from the latest 06:00 to the next one", () => {
    assert.deepEqual(cooldownDay(local(28, 10)), { start: local(28, 6).getTime(), end: local(29, 6).getTime() });
    assert.deepEqual(cooldownDay(local(28, 3)), { start: local(27, 6).getTime(), end: local(28, 6).getTime() });
  });

  it("switches day exactly at 06:00:00, not a second before", () => {
    const before = cooldownDay(local(28, 5, 59, 59));
    const at = cooldownDay(local(28, 6, 0, 0));
    assert.equal(before.start, local(27, 6).getTime());
    assert.equal(before.end, local(28, 6).getTime());
    assert.equal(at.start, local(28, 6).getTime());
    assert.equal(at.end, local(29, 6).getTime());
    assert.equal(cooldownDay(local(28, 5, 59, 59, 999)).end, local(28, 6).getTime());
  });

  it("rolls over month and year ends", () => {
    const newYear = cooldownDay(new Date(2026, 0, 1, 3, 0));
    assert.equal(newYear.start, new Date(2025, 11, 31, 6).getTime());
    assert.equal(newYear.end, new Date(2026, 0, 1, 6).getTime());
    const monthEnd = cooldownDay(new Date(2026, 8, 30, 23, 0));
    assert.equal(monthEnd.end, new Date(2026, 9, 1, 6).getTime());
  });

  it("keeps 06:00 local across a clock change", () => {
    // Clocks change in late March and late October/early November in most zones; the day then
    // lasts 23 or 25 hours but still runs from 06:00 to 06:00 local.
    for (const [month, day] of [[2, 29], [2, 8], [9, 25], [10, 1], [10, 4]] as const) {
      const now = new Date(2026, month, day, 12, 0);
      assert.deepEqual(cooldownDay(now), {
        start: new Date(2026, month, day, 6).getTime(),
        end: new Date(2026, month, day + 1, 6).getTime(),
      });
    }
  });

  it("never throws on an invalid Date", () => {
    const { start, end } = cooldownDay(new Date(Number.NaN));
    assert.ok(Number.isNaN(start) && Number.isNaN(end));
  });
});

describe("playedToday with an ISO string (Sea's format)", () => {
  it("counts a play only within the current cooldown day", () => {
    assert.equal(playedToday(iso(local(28, 7)), local(28, 10)), true);
    assert.equal(playedToday(iso(local(28, 5, 59)), local(28, 10)), false);
    assert.equal(playedToday(iso(local(27, 23)), local(28, 10)), false);
    assert.equal(playedToday(iso(local(27, 22)), local(28, 3)), true);
    assert.equal(playedToday(iso(local(27, 5)), local(28, 3)), false);
  });

  it("is on the right side of the 06:00 boundary at 05:59:59 versus 06:00:00", () => {
    const stamp = iso(local(28, 5, 59, 59));
    // A play at 05:59:59 still counts until 06:00:00 (same cooldown day)...
    assert.equal(playedToday(stamp, local(28, 5, 59, 59, 500)), true);
    // ...and stops counting the moment the day resets.
    assert.equal(playedToday(stamp, local(28, 6, 0, 0)), false);
    // A play at exactly 06:00:00 belongs to the new day.
    assert.equal(playedToday(iso(local(28, 6, 0, 0)), local(28, 6, 0, 0)), true);
    assert.equal(playedToday(iso(local(28, 6, 0, 0)), local(28, 5, 59, 59)), false);
    // The next reset ends the new day.
    assert.equal(playedToday(iso(local(28, 6)), local(29, 5, 59, 59)), true);
    assert.equal(playedToday(iso(local(28, 6)), local(29, 6, 0, 0)), false);
  });

  it("round-trips what the runner writes", () => {
    const now = local(28, 9, 30);
    assert.equal(playedToday(playedStamp(now), now), true);
    assert.equal(playedStamp(now), now.toISOString());
  });

  it("accepts an ISO string with an explicit offset", () => {
    const now = local(28, 10);
    assert.equal(playedToday(new Date(now.getTime() - 3600_000).toISOString().replace("Z", "+00:00"), now), true);
  });
});

describe("playedToday with a legacy millisecond string (Tsukinomi's old format)", () => {
  it("accepts digits as milliseconds since the epoch", () => {
    const now = local(28, 10);
    assert.equal(playedToday(String(local(28, 7).getTime()), now), true);
    assert.equal(playedToday(String(local(28, 5, 59).getTime()), now), false);
    assert.equal(playedToday(String(local(27, 23).getTime()), now), false);
  });

  it("reads the real legacy value from the old layout", () => {
    // Date.now() written by the previous Tsukinomi cutscene on 2026-09-30.
    const stamp = "1790803177728";
    const at = Number(stamp);
    assert.equal(playedToday(stamp, new Date(at + 60_000)), true);
    assert.equal(playedToday(stamp, new Date(at + 3 * 24 * 3600_000)), false);
  });

  it("agrees with the ISO reading of the same instant", () => {
    const now = local(28, 10);
    for (const stamp of [local(28, 6), local(28, 5, 59, 59), local(28, 12), local(29, 6), local(27, 6)]) {
      assert.equal(playedToday(String(stamp.getTime()), now), playedToday(iso(stamp), now), iso(stamp));
    }
  });

  it("tolerates surrounding whitespace", () => {
    const now = local(28, 10);
    assert.equal(playedToday(` ${local(28, 7).getTime()}\n`, now), true);
    assert.equal(playedToday(` ${iso(local(28, 7))} `, now), true);
  });
});

describe("playedToday with unreadable values", () => {
  const now = local(28, 10);

  it("treats null, undefined and empty as not played", () => {
    assert.equal(playedToday(null, now), false);
    assert.equal(playedToday(undefined, now), false);
    assert.equal(playedToday("", now), false);
    assert.equal(playedToday("   ", now), false);
  });

  it("treats garbage and NaN as not played", () => {
    for (const stored of ["e2e", "NaN", "undefined", "null", "true", "{}", "[]", "1e999", "Infinity", "--", "12abc", "not a date"]) {
      assert.equal(playedToday(stored, now), false, stored);
    }
  });

  it("treats negative values as not played", () => {
    assert.equal(playedToday("-1", now), false);
    assert.equal(playedToday(`-${local(28, 7).getTime()}`, now), false);
    assert.equal(playedToday("1900-01-01T00:00:00.000Z", now), false);
  });

  it("treats far-future and out-of-range values as not played", () => {
    assert.equal(playedToday("99999999999999999999", now), false);
    assert.equal(playedToday("8640000000000001", now), false);
    assert.equal(playedToday("9999-12-31T00:00:00.000Z", now), false);
    assert.equal(playedToday(String(local(30, 12).getTime()), now), false, "two days ahead");
    assert.equal(playedToday(iso(local(29, 6)), now), false, "the next reset");
  });

  it("never throws, whatever the input", () => {
    for (const stored of [null, undefined, "", "\u0000", "\u{1F600}", "9".repeat(400), "-".repeat(400), "1.5", "0x10", "0"]) {
      assert.doesNotThrow(() => playedToday(stored, now));
    }
    for (const stored of [42, {}, [], true, Symbol("x")] as unknown[]) {
      assert.equal(playedToday(stored as string, now), false);
    }
    assert.equal(playedToday(iso(local(28, 7)), new Date(Number.NaN)), false);
  });

  it("exposes the parsed instant for callers that want it", () => {
    assert.equal(parsePlayedStamp("0"), 0);
    assert.equal(parsePlayedStamp("1790803177728"), 1790803177728);
    assert.equal(parsePlayedStamp("2026-09-28T07:00:00.000Z"), Date.UTC(2026, 8, 28, 7));
    assert.equal(parsePlayedStamp("nope"), null);
    assert.equal(parsePlayedStamp("-1"), null);
    assert.equal(parsePlayedStamp(null), null);
  });
});

describe("shouldPlay", () => {
  it("plays on a first, forward visit to a page that carries a cutscene", () => {
    assert.equal(shouldPlay(fresh), true);
  });

  it("never plays on a page without a cutscene, even when asked to", () => {
    assert.equal(shouldPlay({ ...fresh, hasEntry: false }), false);
    assert.equal(shouldPlay({ ...fresh, hasEntry: false, replay: true }), false);
    assert.equal(shouldPlay({ ...fresh, hasEntry: false, force: true, dev: true }), false);
  });

  it("stays quiet once played, on resume and on back/forward traversal", () => {
    assert.equal(shouldPlay({ ...fresh, played: true }), false);
    assert.equal(shouldPlay({ ...fresh, resume: true }), false);
    assert.equal(shouldPlay({ ...fresh, traversal: true }), false);
  });

  it("replays on ?cutscene=replay regardless of the other guards", () => {
    assert.equal(shouldPlay({ ...fresh, played: true, resume: true, traversal: true, replay: true }), true);
  });

  it("honours ?cutscene=force only in dev", () => {
    assert.equal(shouldPlay({ ...fresh, played: true, force: true, dev: false }), false);
    assert.equal(shouldPlay({ ...fresh, played: true, force: true, dev: true }), true);
  });
});

describe("cutscene URL parameters", () => {
  it("parses resume, replay, force and the dev scene override", () => {
    assert.deepEqual(parseCutsceneParams("?resume=1"), { resume: true, replay: false, force: false, scene: null });
    assert.deepEqual(parseCutsceneParams("?cutscene=replay"), { resume: false, replay: true, force: false, scene: null });
    assert.deepEqual(parseCutsceneParams("?cutscene=force&scene=porthole"), {
      resume: false,
      replay: false,
      force: true,
      scene: "porthole",
    });
    assert.equal(parseCutsceneParams("?resume=0").resume, false);
    assert.deepEqual(parseCutsceneParams(""), { resume: false, replay: false, force: false, scene: null });
    assert.equal(parseCutsceneParams("?cutscene=other").replay, false);
  });

  it("removes only the cutscene parameters when cleaning the URL", () => {
    assert.equal(cleanCutsceneUrl("https://x.test/tsukinomi/part-1/?cutscene=replay"), "/tsukinomi/part-1/");
    assert.equal(
      cleanCutsceneUrl("https://x.test/MY-NOVEL/tsukinomi/part-3/?cutscene=force&scene=photo&a=1#t"),
      "/MY-NOVEL/tsukinomi/part-3/?a=1#t",
    );
    assert.equal(cleanCutsceneUrl("https://x.test/tsukinomi/part-1/?scene=x"), "/tsukinomi/part-1/?scene=x");
    assert.equal(cleanCutsceneUrl("https://x.test/a/?resume=1"), "/a/?resume=1");
  });
});

describe("the state machine", () => {
  const states: CutsceneState[] = ["idle", "pending", "loading", "playing", "finishing", "finished", "skipped"];
  const events: CutsceneEvent[] = ["queue", "visible", "open", "finish", "close", "abandon", "abort"];

  const legal: Record<string, CutsceneState> = {
    "idle queue": "pending",
    "idle abandon": "skipped",
    "idle abort": "skipped",
    "pending visible": "loading",
    "pending abandon": "skipped",
    "pending abort": "skipped",
    "loading open": "playing",
    "loading abandon": "skipped",
    "loading abort": "skipped",
    "playing finish": "finishing",
    "playing close": "finished",
    "playing abort": "finished",
    "finishing close": "finished",
    "finishing abort": "finished",
  };

  it("takes exactly the documented transitions", () => {
    for (const state of states) {
      for (const event of events) {
        const expected = legal[`${state} ${event}`];
        assert.equal(transition(state, event), expected ?? state, `${state} + ${event}`);
        assert.equal(canTransition(state, event), expected !== undefined, `${state} + ${event}`);
      }
    }
  });

  it("walks the happy path and the reduced-motion path", () => {
    let state: CutsceneState = "idle";
    for (const event of ["queue", "visible", "open", "finish", "close"] as const) state = transition(state, event);
    assert.equal(state, "finished");
    // The still card closes without the fade.
    state = "idle";
    for (const event of ["queue", "visible", "open", "close"] as const) state = transition(state, event);
    assert.equal(state, "finished");
  });

  it("ends as skipped when it never opened, and as finished when it had", () => {
    assert.equal(transition("idle", "abandon"), "skipped");
    assert.equal(transition("idle", "abort"), "skipped");
    assert.equal(transition("pending", "abort"), "skipped");
    assert.equal(transition("loading", "abort"), "skipped");
    assert.equal(transition("playing", "abort"), "finished");
    assert.equal(transition("finishing", "abort"), "finished");
  });

  it("leaves finished and skipped for good", () => {
    for (const state of ["finished", "skipped"] as const) {
      assert.equal(isSettled(state), true);
      for (const event of events) assert.equal(transition(state, event), state);
    }
    for (const state of ["idle", "pending", "loading", "playing", "finishing"] as const) {
      assert.equal(isSettled(state), false);
    }
  });

  it("rejects out-of-order events without changing state", () => {
    assert.equal(transition("idle", "open"), "idle");
    assert.equal(transition("pending", "open"), "pending");
    assert.equal(transition("loading", "finish"), "loading");
    assert.equal(transition("finishing", "finish"), "finishing", "a second skip is ignored");
    assert.equal(transition("playing", "queue"), "playing");
    assert.equal(transition("playing", "abandon"), "playing", "an opened dialog cannot be abandoned, only closed");
  });

  it("ignores unknown states and events instead of throwing", () => {
    assert.equal(transition("toString" as CutsceneState, "queue"), "toString");
    assert.equal(transition("__proto__" as CutsceneState, "queue"), "__proto__");
    assert.equal(transition("idle", "constructor" as CutsceneEvent), "idle");
    assert.equal(transition("idle", "toString" as CutsceneEvent), "idle");
  });
});

describe("core.ts stays pure and in step with the Sea inline gate", () => {
  const source = readFileSync(new URL("./core.ts", import.meta.url), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

  it("uses no DOM, storage, clock or router API", () => {
    for (const forbidden of [/\bdocument\b/, /\bwindow\b/, /localStorage|sessionStorage/, /\bhistory\b/, /\blocation\b/, /Date\.now\(/, /new Date\(\)/, /import\.meta/, /\bimport\s/]) {
      assert.doesNotMatch(code, forbidden, String(forbidden));
    }
  });

  it("uses the reset hour that the inline gate in SeaBaseLayout hard-codes", () => {
    const layout = readFileSync(new URL("../../../layouts/sea/SeaBaseLayout.astro", import.meta.url), "utf8");
    assert.match(layout, new RegExp(`start\\.setHours\\(${COOLDOWN_RESET_HOUR}, 0, 0, 0\\)`));
  });
});
