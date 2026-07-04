export const MUSIC_CUES = [
  {
    id: "rain-hills",
    number: 1,
    title: "สายฝนและเสียงระดิ่งลม",
    label: "Rain & Wind Chime",
    srcBase: "/assets/tsukinomi/audio/music/discovery",
    intent: "Light rain, brass wind chimes, soft piano reflecting the mountain path.",
  },
  {
    id: "bells-fog",
    number: 2,
    title: "ม่านหมอกเตือนภัย",
    label: "Bells in Fog",
    srcBase: "/assets/lodge/audio/music/gloomy-night",
    intent: "Slow eerie ambiance with distant warning bells and chilling breeze.",
  },
  {
    id: "audio-room",
    number: 3,
    title: "คลื่นสัญญาณในห้องปิดตาย",
    label: "Signal of the Closed Room",
    srcBase: "/assets/lodge/audio/music/eerie-tension",
    intent: "Tense static white noise and ticking gear, psychological trap atmosphere.",
  },
  {
    id: "bride-wedding",
    number: 4,
    title: "พิธีวิวาห์เจ้าสาวภูเขา",
    label: "Bride's Wedding Ceremony",
    srcBase: "/assets/tsukinomi/audio/music/mountain",
    intent: "Dark ambient ritual tone with traditional Japanese instrumental accents.",
  },
  {
    id: "go-home",
    number: 5,
    title: "เพลงคาสเซ็ตต์ขากลับบ้าน",
    label: "Tape of Going Home",
    srcBase: "/assets/tsukinomi/audio/music/ten-years",
    intent: "Bittersweet, melancholic piano and strings, resolving yet incomplete.",
  },
] as const;

export const SOUNDSCAPES = [
  {
    id: "cassette-hiss",
    label: "เสียงซ่าคลื่นเทป (Cassette Hiss)",
    srcBase: "/assets/tsukinomi/audio/soundscape/cassette-hiss",
    defaultVolume: 0.2,
    defaultEnabledOnPlay: true,
  },
  {
    id: "mountain-wind",
    label: "เสียงลมหนาวบนเขา (Mountain Wind)",
    srcBase: "/assets/tsukinomi/audio/soundscape/mountain-wind",
    defaultVolume: 0.15,
    defaultEnabledOnPlay: false,
  },
  {
    id: "distant-train",
    label: "เสียงรถไฟระยะไกล (Distant Train)",
    srcBase: "/assets/tsukinomi/audio/soundscape/distant-train",
    defaultVolume: 0.1,
    defaultEnabledOnPlay: false,
  },
] as const;

export type MusicCue = (typeof MUSIC_CUES)[number];
export type MusicCueId = MusicCue["id"];
export type SoundscapeCue = (typeof SOUNDSCAPES)[number];
export type SoundscapeId = SoundscapeCue["id"];

export const DEFAULT_MUSIC_CUE_ID: MusicCueId = "rain-hills";

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
