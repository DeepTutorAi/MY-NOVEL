// Pins the inline no-flash gate in KusabiCutscene.astro to the shared rule in
// core.ts: the gate runs before first paint and cannot import core.ts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseCutsceneParams, playedToday as corePlayedToday, shouldPlay } from "../../_shared/cutscene/core";
import { SCENE_CHAPTERS } from "./registry";
import { EPIGRAPHS } from "../../../data/kusabi/epigraphs";

const component = readFileSync(join(process.cwd(), "src/components/kusabi/cutscene/KusabiCutscene.astro"), "utf8");

interface Gate {
  covers(search: string, traverse: boolean, stored: string | null, now: Date, dev: boolean): boolean;
  playedToday(stored: string | null, now: Date): boolean;
}

function loadGate(): Gate {
  const begin = component.indexOf("// gate:begin");
  const end = component.indexOf("// gate:end");
  assert.ok(begin !== -1 && end > begin);
  return new Function(`${component.slice(component.indexOf("\n", begin), end)}\nreturn { covers, playedToday };`)() as Gate;
}

describe("cutscene gate", () => {
  const gate = loadGate();
  const now = new Date(2026, 10, 5, 12, 0, 0, 0);
  const stamps = [null, "", "garbage", String(now.getTime() - 1000), new Date(2026, 10, 4, 12).toISOString(), new Date(2026, 10, 5, 7).toISOString()];
  const searches = ["", "?resume=1", "?cutscene=replay", "?cutscene=force"];

  it("agrees with core.ts on what counts as played today", () => {
    for (const stored of stamps) assert.equal(gate.playedToday(stored, now), corePlayedToday(stored, now), String(stored));
  });

  it("covers the page exactly when the runner would play", () => {
    for (const search of searches) {
      for (const stored of stamps) {
        for (const traverse of [false, true]) {
          for (const dev of [false, true]) {
            const params = parseCutsceneParams(search);
            const expected = shouldPlay({ hasEntry: true, replay: params.replay, force: params.force, resume: params.resume, traversal: traverse, played: corePlayedToday(stored, now), dev });
            assert.equal(gate.covers(search, traverse, stored, now, dev), expected, `${search} ${stored} ${traverse} ${dev}`);
          }
        }
      }
    }
  });
});

describe("cutscene data", () => {
  it("has an epigraph for each scene and a scene for each epigraph", () => {
    assert.deepEqual(Object.keys(EPIGRAPHS).map(Number).sort((a, b) => a - b), [...SCENE_CHAPTERS]);
  });

  it("does not say what the chapter reveals", () => {
    for (const text of Object.values(EPIGRAPHS)) assert.doesNotMatch(text, /ชิอง|หน้ากาก|ฆาตกร|ริสะ|อายาเมะ/);
  });
});
