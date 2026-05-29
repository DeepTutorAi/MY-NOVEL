export const MUSIC_CUES = [
  {
    id: "discovery",
    number: 1,
    title: "Walkman & Rain",
    label: "Walkman & Rain",
    srcBase: "/assets/tsukinomi/audio/music/discovery",
    intent: "Light rain, damp maple leaves, soft piano, not horror.",
  },
  {
    id: "reveal",
    number: 2,
    title: "What She Remembers",
    label: "What She Remembers",
    srcBase: "/assets/tsukinomi/audio/music/reveal",
    intent: "Slow melancholic piano with faint strings and unease.",
  },
  {
    id: "decision",
    number: 3,
    title: "The Decision",
    label: "The Decision",
    srcBase: "/assets/tsukinomi/audio/music/decision",
    intent: "Warm room piano with intimate low strings.",
  },
  {
    id: "mountain",
    number: 4,
    title: "The Mountain Path",
    label: "The Mountain Path",
    srcBase: "/assets/tsukinomi/audio/music/mountain",
    intent: "Dark ambient mountain pact tone with subtle Japanese color.",
  },
  {
    id: "ten-years",
    number: 5,
    title: "Ten Years",
    label: "Ten Years",
    srcBase: "/assets/tsukinomi/audio/music/ten-years",
    intent: "Bittersweet piano and soft strings, hopeful but incomplete.",
  },
] as const;

export const SOUNDSCAPES = [
  {
    id: "cassette-hiss",
    label: "Cassette hiss",
    srcBase: "/assets/tsukinomi/audio/soundscape/cassette-hiss",
    defaultVolume: 0.18,
    defaultEnabledOnPlay: true,
  },
  {
    id: "distant-train",
    label: "Distant train",
    srcBase: "/assets/tsukinomi/audio/soundscape/distant-train",
    defaultVolume: 0.12,
    defaultEnabledOnPlay: false,
  },
  {
    id: "mountain-wind",
    label: "Mountain wind",
    srcBase: "/assets/tsukinomi/audio/soundscape/mountain-wind",
    defaultVolume: 0.14,
    defaultEnabledOnPlay: false,
  },
] as const;

export type MusicCue = (typeof MUSIC_CUES)[number];
export type MusicCueId = MusicCue["id"];
export type SoundscapeCue = (typeof SOUNDSCAPES)[number];
export type SoundscapeId = SoundscapeCue["id"];

export const DEFAULT_MUSIC_CUE_ID: MusicCueId = "discovery";

const musicCueIds = MUSIC_CUES.map((cue) => cue.id);
const soundscapeIds = SOUNDSCAPES.map((cue) => cue.id);

export function isMusicCueId(value: string): value is MusicCueId {
  return musicCueIds.includes(value as MusicCueId);
}

export function isSoundscapeId(value: string): value is SoundscapeId {
  return soundscapeIds.includes(value as SoundscapeId);
}

export function getMusicCue(id: MusicCueId) {
  return MUSIC_CUES.find((cue) => cue.id === id) ?? MUSIC_CUES[0];
}

export function getSoundscapeCue(id: SoundscapeId) {
  return SOUNDSCAPES.find((cue) => cue.id === id) ?? SOUNDSCAPES[0];
}

export function nextMusicCue(id: MusicCueId) {
  const currentIndex = musicCueIds.indexOf(id);
  return musicCueIds[(currentIndex + 1) % musicCueIds.length];
}

export function previousMusicCue(id: MusicCueId) {
  const currentIndex = musicCueIds.indexOf(id);
  return musicCueIds[(currentIndex - 1 + musicCueIds.length) % musicCueIds.length];
}
