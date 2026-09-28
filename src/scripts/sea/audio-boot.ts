import { isSeaMusicCueId } from "../../data/sea/music-cues";
import { onSeaPage } from "./lifecycle";
import { seaAudio } from "./sea-audio-state";

// Every Sea page declares its cue on <body data-music-cue>; follow it on each
// navigation and resume audio that was suspended when the reader left Sea.
onSeaPage("audio-boot", () => {
  seaAudio.init();
  const cue = document.body.dataset.musicCue;
  if (cue && isSeaMusicCueId(cue)) {
    seaAudio.setCue(cue);
  }
  seaAudio.resumeSuspended();
});
