// SceneAudio against a fake Walkman that follows the real one's rules: enable()
// turns on the default soundscapes (cassette hiss), setCue() on a Walkman that
// is off only records the cue, disable() drops every soundscape.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_MUSIC_CUE_ID, SOUNDSCAPES, type SoundscapeId } from "../../../data/tsukinomi/music-cues";
import { createSceneAudio, createSilentSceneAudio, type WalkmanLike } from "./audio";

class FakeWalkman implements WalkmanLike {
  enabled = false;
  volume = 0.32;
  cue = "discovery";
  scapeOn: Record<SoundscapeId, boolean> = { "cassette-hiss": false, "distant-train": false, "mountain-wind": false };
  scapeVolume: Record<SoundscapeId, number> = { "cassette-hiss": 0.18, "distant-train": 0.12, "mountain-wind": 0.14 };
  enableFails = false;
  calls: string[] = [];

  init = () => {
    this.calls.push("init");
  };
  isEnabled = () => this.enabled;
  getVolume = () => this.volume;
  getCurrentCue = () => this.cue as ReturnType<WalkmanLike["getCurrentCue"]>;
  isSoundscapeEnabled = (id: SoundscapeId) => this.scapeOn[id];
  getSoundscapeVolume = (id: SoundscapeId) => this.scapeVolume[id];

  enable = async () => {
    this.calls.push("enable");
    if (this.enableFails) return false;
    this.enabled = true;
    this.scapeOn["cassette-hiss"] = true; // defaultEnabledOnPlay
    return true;
  };
  disable = () => {
    this.calls.push("disable");
    this.enabled = false;
    for (const id of Object.keys(this.scapeOn) as SoundscapeId[]) this.scapeOn[id] = false;
  };
  setVolume = (value: number) => {
    this.calls.push(`setVolume:${value}`);
    this.volume = value;
  };
  setCue = (id: string) => {
    this.calls.push(`setCue:${id}`);
    this.cue = id;
  };
  setSoundscapeEnabled = async (id: string, on: boolean) => {
    this.calls.push(`scape:${id}:${on}`);
    this.scapeOn[id as SoundscapeId] = on;
    return true;
  };
  setSoundscapeVolume = (id: string, value: number) => {
    this.calls.push(`scapeVolume:${id}:${value}`);
    this.scapeVolume[id as SoundscapeId] = value;
  };
  playSfx = (id: string) => {
    this.calls.push(`sfx:${id}`);
  };
}

const soundCalls = (walkman: FakeWalkman) => walkman.calls.filter((call) => call !== "init");

describe("createSceneAudio: snapshot and availability", () => {
  it("initialises the Walkman and reports its live state", () => {
    const walkman = new FakeWalkman();
    walkman.enabled = true;
    walkman.scapeOn["distant-train"] = true;
    walkman.scapeVolume["distant-train"] = 0.4;
    const audio = createSceneAudio(walkman);

    assert.deepEqual(walkman.calls, ["init"]);
    assert.equal(audio.available(), true);
    assert.deepEqual(audio.snapshot(), {
      enabled: true,
      volume: 0.32,
      cue: "discovery",
      soundscapes: {
        "cassette-hiss": { enabled: false, volume: 0.18 },
        "distant-train": { enabled: true, volume: 0.4 },
        "mountain-wind": { enabled: false, volume: 0.14 },
      },
    });

    walkman.volume = 0.5;
    assert.equal(audio.snapshot().volume, 0.5, "snapshot() is live, not the copy taken at creation");
  });

  it("is available only while the Walkman is on and not turned down to nothing", () => {
    const walkman = new FakeWalkman();
    const audio = createSceneAudio(walkman);
    assert.equal(audio.available(), false);
    walkman.enabled = true;
    assert.equal(audio.available(), true);
    walkman.volume = 0; // the panel has no mute switch: volume 0 is how a reader mutes
    assert.equal(audio.available(), false);
    walkman.volume = 0.01;
    assert.equal(audio.available(), true);
  });
});

describe("createSceneAudio: silent when the Walkman is off", () => {
  it("does nothing for setCue, layerSoundscape, sfx and restore", () => {
    const walkman = new FakeWalkman();
    const audio = createSceneAudio(walkman);
    audio.setCue("reveal");
    audio.layerSoundscape("distant-train", 0.3);
    audio.sfx("tape-click");
    audio.sfx("tape-rewind");
    audio.restore();
    audio.restore({ keepPlaying: true, cue: "mountain" });
    assert.deepEqual(soundCalls(walkman), []);
    assert.equal(walkman.enabled, false);
  });
});

describe("createSceneAudio: silent when the reader muted the Walkman", () => {
  it("makes no sound at master volume 0: no cue, no layer, no effect", () => {
    const walkman = new FakeWalkman();
    walkman.enabled = true;
    walkman.volume = 0;
    const audio = createSceneAudio(walkman);
    audio.setCue("reveal");
    audio.layerSoundscape("distant-train", 0.3);
    audio.sfx("tape-click");
    assert.deepEqual(soundCalls(walkman), []);
    audio.restore();
    assert.deepEqual(soundCalls(walkman), [], "nothing was changed, so nothing to hand back");
  });

  it("plays no effect while the tab is hidden, but still switches cue and layers", () => {
    const walkman = new FakeWalkman();
    walkman.enabled = true;
    let hidden = true;
    const audio = createSceneAudio(walkman, () => hidden);
    audio.sfx("tape-click");
    assert.deepEqual(soundCalls(walkman), []);
    audio.setCue("reveal");
    hidden = false;
    audio.sfx("tape-click");
    assert.deepEqual(soundCalls(walkman), ["setCue:reveal", "sfx:tape-click"]);
  });
});

describe("createSceneAudio: with the Walkman on", () => {
  it("forwards the cue and the tape sound effects, and ignores unknown effects", () => {
    const walkman = new FakeWalkman();
    walkman.enabled = true;
    const audio = createSceneAudio(walkman);
    audio.setCue("reveal");
    audio.sfx("tape-rewind");
    audio.sfx("tape-click");
    audio.sfx("door-slam" as never);
    assert.deepEqual(soundCalls(walkman), ["setCue:reveal", "sfx:tape-rewind", "sfx:tape-click"]);
  });

  it("layers a soundscape after setting its volume, and leaves one that is already on alone", () => {
    const walkman = new FakeWalkman();
    walkman.enabled = true;
    walkman.scapeOn["cassette-hiss"] = true;
    const audio = createSceneAudio(walkman);

    audio.layerSoundscape("distant-train", 0.3);
    audio.layerSoundscape("cassette-hiss");
    assert.deepEqual(soundCalls(walkman), ["scapeVolume:distant-train:0.3", "scape:distant-train:true"]);
  });

  it("restore() puts soundscape toggles, volumes and the cue back and keeps the Walkman on", () => {
    const walkman = new FakeWalkman();
    walkman.enabled = true;
    walkman.cue = "discovery";
    walkman.scapeOn["cassette-hiss"] = true;
    const audio = createSceneAudio(walkman);

    audio.setCue("mountain");
    audio.layerSoundscape("mountain-wind", 0.6);
    audio.layerSoundscape("cassette-hiss", 0.5);
    walkman.scapeOn["cassette-hiss"] = true;
    assert.equal(walkman.cue, "mountain");

    audio.restore();
    assert.equal(walkman.enabled, true, "previous enabled state is restored, and it was on");
    assert.equal(walkman.cue, "discovery");
    assert.equal(walkman.scapeOn["mountain-wind"], false);
    assert.equal(walkman.scapeVolume["mountain-wind"], 0.14);
    assert.equal(walkman.scapeOn["cassette-hiss"], true, "a toggle the reader already had stays on");
    assert.equal(walkman.scapeVolume["cassette-hiss"], 0.18);
    assert.equal(walkman.calls.includes("disable"), false);
  });

  it("restore({ cue }) wins over the cue taken at the start", () => {
    const walkman = new FakeWalkman();
    walkman.enabled = true;
    walkman.cue = "discovery";
    const audio = createSceneAudio(walkman);
    audio.setCue("mountain");
    audio.restore({ cue: "reveal" });
    assert.equal(walkman.cue, "reveal");
  });

  it("writes back only the soundscapes the scene layered", () => {
    const walkman = new FakeWalkman();
    walkman.enabled = true;
    walkman.scapeVolume["mountain-wind"] = 0.33; // the reader's own setting, never touched by the scene
    const audio = createSceneAudio(walkman);
    audio.layerSoundscape("distant-train", 0.3);
    walkman.calls.length = 0;
    audio.restore();
    assert.deepEqual(soundCalls(walkman), ["scapeVolume:distant-train:0.12", "scape:distant-train:false"]);
    assert.equal(walkman.scapeVolume["mountain-wind"], 0.33);
  });

  it("keeps the volume from before the first layering when a scene layers the same soundscape twice", () => {
    const walkman = new FakeWalkman();
    walkman.enabled = true;
    const audio = createSceneAudio(walkman);
    audio.layerSoundscape("distant-train", 0.3);
    audio.layerSoundscape("distant-train", 0.5);
    audio.restore();
    assert.equal(walkman.scapeVolume["distant-train"], 0.12);
    assert.equal(walkman.scapeOn["distant-train"], false);
  });

  it("still hands the persisted volumes back when the Walkman was switched off first", () => {
    // Leaving /tsukinomi/ mid-scene: the Walkman panel disables it on astro:before-swap, before
    // the runner's own tear-down reaches restore(). disable() clears the toggles; a volume the
    // scene set would otherwise stay persisted.
    const walkman = new FakeWalkman();
    walkman.enabled = true;
    const audio = createSceneAudio(walkman);
    audio.layerSoundscape("distant-train", 0.6);
    walkman.disable();
    walkman.calls.length = 0;
    audio.restore({ cue: "reveal" });
    assert.equal(walkman.scapeVolume["distant-train"], 0.12);
    assert.deepEqual(soundCalls(walkman), ["scapeVolume:distant-train:0.12"], "no toggle, no cue, no second disable");
    assert.equal(walkman.enabled, false);
  });

  it("restores once: a second call changes nothing", () => {
    const walkman = new FakeWalkman();
    walkman.enabled = true;
    const audio = createSceneAudio(walkman);
    audio.layerSoundscape("distant-train", 0.3);
    audio.restore();
    const callsAfterFirst = walkman.calls.length;
    audio.restore();
    assert.equal(walkman.calls.length, callsAfterFirst);
  });
});

describe("createSceneAudio: requestPlayFromGesture", () => {
  it("switches the Walkman on synchronously, inside the caller's gesture", async () => {
    const walkman = new FakeWalkman();
    const audio = createSceneAudio(walkman);

    const pending = audio.requestPlayFromGesture("discovery");
    assert.deepEqual(soundCalls(walkman), ["setCue:discovery", "enable"], "enable() must run before any await");
    assert.equal(await pending, true);
    assert.equal(audio.startedFromGesture, true);
    assert.equal(audio.available(), true);
  });

  it("does nothing, and is not the scene's own action, when the Walkman is already on", async () => {
    const walkman = new FakeWalkman();
    walkman.enabled = true;
    const audio = createSceneAudio(walkman);
    assert.equal(await audio.requestPlayFromGesture(), true);
    assert.equal(walkman.calls.includes("enable"), false);
    assert.equal(audio.startedFromGesture, false);
  });

  it("reports false and leaves nothing to restore when the Walkman cannot start", async () => {
    const walkman = new FakeWalkman();
    walkman.enableFails = true;
    const audio = createSceneAudio(walkman);
    assert.equal(await audio.requestPlayFromGesture(), false);
    assert.equal(audio.startedFromGesture, false);
    walkman.calls.length = 0;
    audio.restore();
    assert.deepEqual(walkman.calls, []);
  });

  it("keeps the Walkman on after restore, with the part cue, and hands back what the scene layered", async () => {
    const walkman = new FakeWalkman();
    walkman.cue = "reveal"; // whatever the previous page left
    const audio = createSceneAudio(walkman);

    await audio.requestPlayFromGesture("discovery");
    assert.equal(walkman.scapeOn["cassette-hiss"], true, "the Walkman's own default turned the hiss on");
    audio.layerSoundscape("distant-train", 0.2);
    walkman.calls.length = 0;

    audio.restore();
    assert.equal(walkman.enabled, true, "the reader's press keeps the Walkman on");
    assert.equal(walkman.calls.includes("disable"), false);
    assert.equal(walkman.cue, "discovery", "the music continues with the part cue into reading");
    assert.equal(walkman.scapeOn["distant-train"], false, "the layer the scene added is taken away");
    assert.equal(walkman.scapeVolume["distant-train"], 0.12);
  });

  it("leaves the hiss that pressing play switched on: that is what the panel's own play gives", async () => {
    // Reverting it would also persist an explicit "off" over a key the reader never set, and
    // the next press of play in the panel would no longer bring the hiss.
    const walkman = new FakeWalkman();
    const audio = createSceneAudio(walkman);
    await audio.requestPlayFromGesture("discovery");
    walkman.calls.length = 0;
    audio.restore();
    assert.equal(walkman.scapeOn["cassette-hiss"], true);
    assert.deepEqual(
      soundCalls(walkman).filter((call) => call.includes("cassette-hiss")),
      [],
      "neither the toggle nor the volume of an untouched soundscape is written",
    );
  });

  it("restore({ keepPlaying: false }) switches the Walkman back off", async () => {
    const walkman = new FakeWalkman();
    const audio = createSceneAudio(walkman);
    await audio.requestPlayFromGesture();
    audio.restore({ keepPlaying: false });
    assert.equal(walkman.enabled, false);
    assert.equal(walkman.calls.includes("disable"), true);
  });
});

describe("createSilentSceneAudio", () => {
  it("is unavailable and every call is a no-op", async () => {
    const audio = createSilentSceneAudio();
    assert.equal(audio.available(), false);
    audio.setCue("reveal");
    audio.layerSoundscape("distant-train", 0.3);
    audio.sfx("tape-click");
    audio.restore({ keepPlaying: true });
    assert.equal(await audio.requestPlayFromGesture(), false);
    assert.equal(audio.startedFromGesture, false);
    const snapshot = audio.snapshot();
    assert.equal(snapshot.enabled, false);
    assert.equal(snapshot.cue, DEFAULT_MUSIC_CUE_ID);
    assert.deepEqual(Object.keys(snapshot.soundscapes).sort(), SOUNDSCAPES.map((s) => s.id).sort());
  });
});
