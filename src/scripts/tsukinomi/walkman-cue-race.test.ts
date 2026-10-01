// The Walkman's cue fade-out against fake Howler tracks and a manual clock.
// Switching away from a cue schedules a stop of its track once the fade-out
// ends; switching back inside that window must cancel it, or the track the
// reader is meant to hear is stopped while the Walkman reports "on".
// Seen when a cutscene scene changed the cue and the reader skipped it within
// about two seconds; the Walkman's own next/previous cue buttons had it too.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { MUSIC_CUES, type MusicCueId } from "../../data/tsukinomi/music-cues";
import { installFakeDom, type FakeEnv } from "../_shared/cutscene/fake-dom";
import { WalkmanAudio } from "./walkman-state";

class FakeHowl {
  private next = 1;
  private live = new Set<number>();
  readonly stops: number[] = [];
  readonly fades: Array<{ from: number; to: number; ms: number; id: number }> = [];
  private level = 0;
  state() {
    return "loaded";
  }
  load() {}
  play() {
    const id = this.next++;
    this.live.add(id);
    return id;
  }
  playing(id: number) {
    return this.live.has(id);
  }
  volume(value?: number) {
    if (value === undefined) return this.level;
    this.level = value;
    return this;
  }
  fade(from: number, to: number, ms: number, id: number) {
    this.fades.push({ from, to, ms, id });
  }
  stop(id: number) {
    this.live.delete(id);
    this.stops.push(id);
  }
  pause() {}
  unload() {}
}

interface Internals {
  musicTracks: Map<MusicCueId, { howl: FakeHowl; soundId?: number; stopTimer?: number }>;
  enabled: boolean;
  initialized: boolean;
  playCue(cue: MusicCueId, fadeMs: number): void;
}

let env: FakeEnv;
let walkman: WalkmanAudio;
let inner: Internals;

beforeEach(() => {
  env = installFakeDom("https://x.test/MY-NOVEL/tsukinomi/sections/01-discovery/");
  mock.timers.enable({ apis: ["setTimeout"] });
  env.window.setTimeout = (fn: () => void, ms: number) => setTimeout(fn, ms);
  env.window.clearTimeout = (id: number) => clearTimeout(id);
  walkman = new WalkmanAudio();
  inner = walkman as unknown as Internals;
  // Real Howl objects would need an audio context; the fakes stand in for all five cues.
  for (const cue of MUSIC_CUES) inner.musicTracks.set(cue.id, { howl: new FakeHowl() });
  inner.initialized = true;
  inner.enabled = true;
  inner.playCue("discovery", 0);
});

afterEach(() => {
  mock.timers.reset();
  env.restore();
});

const track = (cue: MusicCueId) => {
  const found = inner.musicTracks.get(cue);
  assert.ok(found);
  return found;
};

describe("WalkmanAudio: switching a cue back inside its fade-out", () => {
  it("keeps the cue playing when it is switched away from and back to within the fade", () => {
    const discovery = track("discovery");
    const soundId = discovery.soundId;
    assert.ok(soundId !== undefined && discovery.howl.playing(soundId));

    walkman.setCue("reveal");
    mock.timers.tick(700);
    walkman.setCue("discovery");
    mock.timers.tick(10_000);

    assert.equal(discovery.howl.playing(soundId), true, "the track the reader is back on must not be stopped by the first switch's timer");
    assert.deepEqual(discovery.howl.stops, []);
    assert.equal(walkman.getCurrentCue(), "discovery");
    assert.equal(track("reveal").howl.playing(track("reveal").soundId ?? -1), false, "the cue switched away from does stop");
  });

  it("still stops a cue that was switched away from and not returned to", () => {
    const discovery = track("discovery");
    const soundId = discovery.soundId;
    assert.ok(soundId !== undefined);
    walkman.setCue("reveal");
    mock.timers.tick(2_099);
    assert.equal(discovery.howl.playing(soundId), true, "still fading out");
    mock.timers.tick(1);
    assert.equal(discovery.howl.playing(soundId), false);
    assert.deepEqual(discovery.howl.stops, [soundId]);
  });

  it("survives repeated quick switches: only the cue it ends on keeps playing", () => {
    walkman.setCue("reveal");
    mock.timers.tick(300);
    walkman.setCue("decision");
    mock.timers.tick(300);
    walkman.setCue("discovery");
    mock.timers.tick(300);
    walkman.setCue("reveal");
    mock.timers.tick(10_000);
    const live = MUSIC_CUES.filter((cue) => {
      const found = track(cue.id);
      return found.soundId !== undefined && found.howl.playing(found.soundId);
    }).map((cue) => cue.id);
    assert.deepEqual(live, ["reveal"]);
  });

  it("clears its own timer once it has run, so a later switch schedules a fresh one", () => {
    const discovery = track("discovery");
    walkman.setCue("reveal");
    mock.timers.tick(2_200);
    assert.equal(discovery.stopTimer, undefined);
    walkman.setCue("discovery");
    walkman.setCue("reveal");
    assert.notEqual(discovery.stopTimer, undefined, "the second fade-out schedules its stop");
  });
});
