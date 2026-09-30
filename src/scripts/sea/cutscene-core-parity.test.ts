// Sea's cutscene runner keeps its own copies of parseCutsceneParams and
// shouldPlay (its contract test pins those lines in runner.ts) and re-exports
// the rest from the shared core. This test holds the copies to the shared
// rules, so the two cannot drift while both exist.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import * as core from "../_shared/cutscene/core";
import * as sea from "./cutscene/runner";

const FLAGS = ["hasEntry", "resume", "traversal", "played", "replay", "force", "dev"] as const;

describe("Sea's cutscene runner against the shared core", () => {
  it("re-exports the cooldown and URL rules instead of redefining them", () => {
    assert.equal(sea.cooldownDay, core.cooldownDay);
    assert.equal(sea.playedToday, core.playedToday);
    assert.equal(sea.cleanCutsceneUrl, core.cleanCutsceneUrl);
    assert.equal(sea.COOLDOWN_RESET_HOUR, core.COOLDOWN_RESET_HOUR);
  });

  it("decides shouldPlay the same way for every combination of the seven flags", () => {
    for (let bits = 0; bits < 1 << FLAGS.length; bits++) {
      const trigger = Object.fromEntries(FLAGS.map((flag, index) => [flag, (bits & (1 << index)) !== 0])) as unknown as core.CutsceneTrigger;
      assert.equal(sea.shouldPlay(trigger), core.shouldPlay(trigger), JSON.stringify(trigger));
    }
  });

  it("parses the query string the same way", () => {
    for (const search of [
      "",
      "?",
      "?resume=1",
      "?resume=0",
      "?resume=true",
      "?cutscene=replay",
      "?cutscene=force",
      "?cutscene=force&scene=porthole",
      "?cutscene=REPLAY",
      "?cutscene=other&scene=x",
      "?scene=only",
      "?a=1&cutscene=replay&resume=1#hash",
      "cutscene=replay",
    ]) {
      assert.deepEqual(sea.parseCutsceneParams(search), core.parseCutsceneParams(search), search);
    }
  });

  it("writes the played stamp in the format the shared reader expects", () => {
    const source = readFileSync(new URL("./cutscene/runner.ts", import.meta.url), "utf8");
    assert.match(source, /localStorage\.setItem\(PLAYED_PREFIX \+ arc, new Date\(\)\.toISOString\(\)\)/);
    const now = new Date(2026, 8, 28, 9, 0);
    assert.equal(core.playedToday(now.toISOString(), now), true);
  });
});
