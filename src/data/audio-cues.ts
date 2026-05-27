export const MUSIC_CUES = [
  {
    id: "snow-forest",
    number: 1,
    title: "Snow Forest",
    label: "ป่าสนหิมะ",
    srcBase: "/assets/audio/music/snow-forest",
    intent: "สงบ หนาว โดดเดี่ยว อ่านง่าย ไม่หลอนเกิน",
  },
  {
    id: "gloomy-night",
    number: 2,
    title: "Dark Piano Ambient",
    label: "คืนมืดหม่น",
    srcBase: "/assets/audio/music/gloomy-night",
    intent: "เปียโนมืด อึมครึม ใช้ตอนความผิดปกติเริ่มชัด",
  },
  {
    id: "mystery",
    number: 3,
    title: "Dark Ambient Mystery",
    label: "ปริศนา",
    srcBase: "/assets/audio/music/mystery",
    intent: "เริ่มสืบ เริ่มไม่ไว้ใจกัน แต่ยังไม่เร่ง",
  },
  {
    id: "eerie-tension",
    number: 4,
    title: "Eerie Dark Ambient",
    label: "แรงกดดัน",
    srcBase: "/assets/audio/music/eerie-tension",
    intent: "กดดันช้า ๆ ไม่ใช่ jump scare",
  },
  {
    id: "dark-nightmare",
    number: 5,
    title: "Ambient Dark Nightmare",
    label: "ฝันร้ายใต้ดิน",
    srcBase: "/assets/audio/music/dark-nightmare",
    intent: "หนักที่สุด ใช้เฉพาะช่วงลงใต้ดินหรือความจริงปะทะหน้า",
  },
  {
    id: "after-climax-quiet",
    number: 6,
    title: "After Climax Quiet",
    label: "หายใจหลังไคลแมกซ์",
    srcBase: "/assets/audio/music/after-climax-quiet",
    intent: "เบา โล่ง แต่ยังเย็น ใช้หลังความตึงคลี่ลง",
  },
  {
    id: "mirror-haunting",
    number: 7,
    title: "Haunting Dark Atmosphere",
    label: "กระจก",
    srcBase: "/assets/audio/music/mirror-haunting",
    intent: "ปิดท้ายเย็น ๆ หลอนค้าง ไม่ระเบิด",
  },
] as const;

export type MusicCue = (typeof MUSIC_CUES)[number];
export type MusicCueId = MusicCue["id"];

export const DEFAULT_MUSIC_CUE_ID: MusicCueId = "snow-forest";

const chapterDefaults = new Map<number, MusicCueId>([
  [1, "snow-forest"],
  [2, "snow-forest"],
  [3, "gloomy-night"],
  [4, "gloomy-night"],
  [5, "gloomy-night"],
  [6, "mystery"],
  [7, "mystery"],
  [8, "mystery"],
  [9, "eerie-tension"],
  [10, "eerie-tension"],
  [11, "after-climax-quiet"],
  [12, "eerie-tension"],
  [13, "dark-nightmare"],
  [14, "dark-nightmare"],
  [15, "dark-nightmare"],
  [16, "after-climax-quiet"],
  [17, "after-climax-quiet"],
  [18, "mirror-haunting"],
]);

const cueWindows = new Map<number, Array<{ from: number; to: number; cue: MusicCueId }>>([
  [9, [{ from: 0, to: 0.22, cue: "mystery" }, { from: 0.22, to: 1, cue: "eerie-tension" }]],
  [
    10,
    [
      { from: 0, to: 0.3, cue: "eerie-tension" },
      { from: 0.3, to: 0.78, cue: "dark-nightmare" },
      { from: 0.78, to: 1, cue: "eerie-tension" },
    ],
  ],
  [12, [{ from: 0, to: 0.7, cue: "eerie-tension" }, { from: 0.7, to: 1, cue: "mystery" }]],
  [16, [{ from: 0, to: 0.34, cue: "dark-nightmare" }, { from: 0.34, to: 1, cue: "after-climax-quiet" }]],
]);

export function getMusicCue(id: MusicCueId) {
  return MUSIC_CUES.find((cue) => cue.id === id) ?? MUSIC_CUES[0];
}

export function musicCueForChapter(chapterNumber: number, progress = 0) {
  const safeProgress = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const windows = cueWindows.get(chapterNumber);

  if (windows) {
    const matched = windows.find((window) => safeProgress >= window.from && safeProgress < window.to);

    if (matched) {
      return getMusicCue(matched.cue);
    }
  }

  return getMusicCue(chapterDefaults.get(chapterNumber) ?? DEFAULT_MUSIC_CUE_ID);
}
