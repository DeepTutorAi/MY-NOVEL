export const SEA_MUSIC_CUES = [
  {
    id: "sun-sheet",
    number: 1,
    title: "Sun-Sheet (น้ำตื้นสลัว)",
    label: "Layer 1: Sun-Sheet",
    srcBase: "/assets/tsukinomi/audio/music/discovery",
    intent: "Faint sunlight, vertical rain, deep ocean breath.",
  },
  {
    id: "drowned-quarter",
    number: 2,
    title: "Drowned Quarter (เมืองร้างกลับหัว)",
    label: "Layer 2: Drowned Quarter",
    srcBase: "/assets/tsukinomi/audio/music/reveal",
    intent: "Submerged ruins, shadows of reef-hounds, decaying memories.",
  },
  {
    id: "pressure-veil",
    number: 3,
    title: "Pressure Veil (แรงดันสนธยา)",
    label: "Layer 3: Pressure Veil",
    srcBase: "/assets/tsukinomi/audio/music/decision",
    intent: "Heavy twilight pressure, sonar sweeps, metallic creaks.",
  },
  {
    id: "old-pressure",
    number: 4,
    title: "Old Pressure (แรงดันโบราณ)",
    label: "Layer 4: Old Pressure",
    srcBase: "/assets/tsukinomi/audio/music/mountain",
    intent: "Crushing blackness, abyssal Leviathan frequencies.",
  },
  {
    id: "first-memory",
    number: 5,
    title: "First Memory (ก้นบึ้งความทรงจำ)",
    label: "Layer 5: First Memory",
    srcBase: "/assets/tsukinomi/audio/music/ten-years",
    intent: "The ultimate core of the ocean, dissolving human language.",
  },
] as const;

export const SEA_SOUNDSCAPES = [
  {
    id: "rain-drip",
    label: "ฝนตกใส่ท่อทองแดง",
    srcBase: "/assets/tsukinomi/audio/soundscape/cassette-hiss", // placeholder
    defaultVolume: 0.15,
    defaultEnabledOnPlay: true,
  },
  {
    id: "pressure-hum",
    label: "แรงดันน้ำความถี่ต่ำ",
    srcBase: "/assets/tsukinomi/audio/soundscape/mountain-wind", // placeholder
    defaultVolume: 0.12,
    defaultEnabledOnPlay: false,
  },
] as const;

export type SeaMusicCue = (typeof SEA_MUSIC_CUES)[number];
export type SeaMusicCueId = SeaMusicCue["id"];
export type SeaSoundscapeCue = (typeof SEA_SOUNDSCAPES)[number];
export type SeaSoundscapeId = SeaSoundscapeCue["id"];

export const DEFAULT_SEA_CUE_ID: SeaMusicCueId = "sun-sheet";

const seaMusicCueIds = SEA_MUSIC_CUES.map((cue) => cue.id);
const seaSoundscapeIds = SEA_SOUNDSCAPES.map((cue) => cue.id);

export function isSeaMusicCueId(value: string): value is SeaMusicCueId {
  return seaMusicCueIds.includes(value as SeaMusicCueId);
}

export function isSeaSoundscapeId(value: string): value is SeaSoundscapeId {
  return seaSoundscapeIds.includes(value as SeaSoundscapeId);
}

export function getSeaMusicCue(id: SeaMusicCueId) {
  return SEA_MUSIC_CUES.find((cue) => cue.id === id) ?? SEA_MUSIC_CUES[0];
}

export function getSeaSoundscapeCue(id: SeaSoundscapeId) {
  return SEA_SOUNDSCAPES.find((cue) => cue.id === id) ?? SEA_SOUNDSCAPES[0];
}
