// Pins the inline no-flash gate in LodgeCutscene.astro to the shared rule in
// core.ts: the gate runs before first paint as plain inline JS and cannot
// import core.ts, so its copy is evaluated here over a table of inputs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseCutsceneParams, playedToday as corePlayedToday, shouldPlay } from "../../_shared/cutscene/core";

const component = readFileSync(join(process.cwd(), "src/components/lodge/cutscene/LodgeCutscene.astro"), "utf8");
const indexSource = readFileSync(join(process.cwd(), "src/scripts/lodge/cutscene/index.ts"), "utf8");

interface Gate {
  covers(search: string, traverse: boolean, stored: string | null, now: Date, dev: boolean): boolean;
  playedToday(stored: string | null, now: Date): boolean;
}

function loadGate(): Gate {
  const begin = component.indexOf("// gate:begin");
  const end = component.indexOf("// gate:end");
  assert.ok(begin !== -1 && end > begin, "the gate's rule must sit between gate:begin and gate:end markers");
  return new Function(`${component.slice(component.indexOf("\n", begin), end)}\nreturn { covers, playedToday };`)() as Gate;
}

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);
const NOWS = [local(2026, 10, 13, 12, 0), local(2026, 10, 13, 5, 59), local(2026, 10, 13, 6, 0), local(2026, 10, 25, 12, 0)];

function storedValues(now: Date): Array<string | null> {
  const day = new Date(now);
  day.setHours(6, 0, 0, 0);
  if (day.getTime() > now.getTime()) day.setDate(day.getDate() - 1);
  const start = day.getTime();
  return [null, "", "garbage", new Date(start).toISOString(), new Date(start - 1).toISOString(), String(start), String(start - 1), String(now.getTime() - 25 * 3_600_000), String(now.getTime() - 3_600_000), "-5"];
}

const SEARCHES = ["", "?resume=1", "?cutscene=replay", "?cutscene=force", "?cutscene=replay&resume=1", "?cutscene=other"];

describe("the inline gate in LodgeCutscene.astro", () => {
  const gate = loadGate();

  it("reads a stored value exactly as core.playedToday does", () => {
    for (const now of NOWS) for (const stored of storedValues(now)) assert.equal(gate.playedToday(stored, now), corePlayedToday(stored, now));
  });

  it("covers exactly when core.shouldPlay says the cutscene plays", () => {
    for (const now of NOWS)
      for (const stored of storedValues(now))
        for (const search of SEARCHES)
          for (const traverse of [false, true])
            for (const dev of [false, true]) {
              const params = parseCutsceneParams(search);
              const expected = shouldPlay({ hasEntry: true, resume: params.resume, traversal: traverse, played: corePlayedToday(stored, now), replay: params.replay, force: params.force, dev });
              assert.equal(gate.covers(search, traverse, stored, now, dev), expected, `${search} ${traverse} ${dev} ${stored}`);
            }
  });

  it("counts the old overlay's millisecond stamp as played today", () => {
    const now = local(2026, 10, 13, 12, 0);
    assert.equal(gate.covers("", false, String(now.getTime() - 3_600_000), now, false), false);
    assert.equal(gate.covers("?cutscene=replay", false, String(now.getTime() - 3_600_000), now, false), true);
  });

  it("uses the same played key and cover class as the adapter", () => {
    assert.match(component, /"hvitveldt:cutscene:played:" \+ dialog\.dataset\.chapter/);
    assert.match(indexSource, /PLAYED_PREFIX = "hvitveldt:cutscene:played:"/);
    assert.match(component, /const COVER = "lodge-cutscene-pending"/);
    assert.match(indexSource, /COVER_CLASS = "lodge-cutscene-pending"/);
    assert.match(component, /html\.lodge-cutscene-pending body::after/);
  });
});
