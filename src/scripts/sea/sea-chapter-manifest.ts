// Which drafts are published into src/content/the-sea-that-hung-above-the-world/chapters
// and the hand-written metadata that the drafts do not carry. The drafts under
// src/plan remain the source of truth for the prose; run `pnpm sea:sync` after
// editing either side.
//
// Plates are shown at the top of each chapter, so they must stay spoiler-safe
// (the chapter 5 plate must not mention the Shroud).
import type { SeaZone } from "../../data/sea/zones";

export type SeaMusicCueSlot = "sun-sheet" | "drowned-quarter" | "pressure-veil" | "old-pressure" | "first-memory";

export interface SeaPlate {
  place: string;
  time?: string;
  pov: string[];
}

export interface SeaZoneShift {
  /** 1-based index of the `##` scene heading where the zone changes. */
  scene: number;
  zone: SeaZone;
}

export interface SeaChapterManifestEntry {
  id: string;
  number: number;
  /** Repository-relative path of the draft. */
  source: string;
  arc: number;
  draft: boolean;
  zone: SeaZone;
  zoneShifts?: SeaZoneShift[];
  musicCueId: SeaMusicCueSlot;
  plate: SeaPlate;
  /** Names that must appear in the draft's POV line; a miss is reported as drift. */
  expectPov?: string[];
}

const DRAFTS = "src/plan/the-sea-that-hung-above-the-world/work/drafts";

export const SEA_CHAPTER_MANIFEST: readonly SeaChapterManifestEntry[] = [
  {
    id: "00",
    number: 0,
    source: `${DRAFTS}/prologue.md`,
    arc: 1,
    draft: false,
    zone: "elaris",
    musicCueId: "sun-sheet",
    plate: { place: "เอลาริส", time: "ยุคหลังทะเลยกตัว", pov: [] },
  },
  {
    id: "01",
    number: 1,
    source: `${DRAFTS}/arc1/chapter_01.md`,
    arc: 1,
    draft: false,
    zone: "elaris",
    musicCueId: "sun-sheet",
    plate: { place: "เอลาริส · เมืองภูเขา", time: "หนึ่งวัน · เช้า → ดึก", pov: ["Cael"] },
    expectPov: ["Cael"],
  },
  {
    id: "02",
    number: 2,
    source: `${DRAFTS}/arc1/chapter_02.md`,
    arc: 1,
    draft: false,
    zone: "elaris",
    musicCueId: "sun-sheet",
    plate: { place: "เอลาริส · สิบปีก่อน", pov: ["Nio"] },
    expectPov: ["Nio"],
  },
  {
    id: "03",
    number: 3,
    source: `${DRAFTS}/arc1/chapter_03.md`,
    arc: 1,
    draft: false,
    zone: "elaris",
    musicCueId: "sun-sheet",
    plate: { place: "ท่าเรือเอลาริส · เรือ Albatross", pov: ["Ilyra"] },
    expectPov: ["Ilyra"],
  },
  {
    id: "04",
    number: 4,
    source: `${DRAFTS}/arc1/chapter_04.md`,
    arc: 1,
    draft: false,
    zone: "elaris",
    musicCueId: "sun-sheet",
    plate: { place: "ท่าเรือเอลาริส · หุบเขาทางตะวันตก", time: "เช้า → ค่ำ", pov: ["Cael"] },
    expectPov: ["Cael"],
  },
  {
    id: "05",
    number: 5,
    source: `${DRAFTS}/arc1/chapter_05.md`,
    arc: 1,
    draft: false,
    zone: "elaris",
    // Scene 6 is "บ่ายแก่: ม่าน" (into the Shroud), scene 7 "เย็น: เหนือม่าน" (above it).
    zoneShifts: [
      { scene: 6, zone: "shroud" },
      { scene: 7, zone: "air-shelf" },
    ],
    musicCueId: "sun-sheet",
    plate: { place: "เอลาริส · ก่อนรุ่งสาง", pov: ["Cael", "Ilyra"] },
    expectPov: ["Cael", "Ilyra"],
  },
  {
    id: "06",
    number: 6,
    source: `${DRAFTS}/arc1/chapter_06.md`,
    arc: 2,
    draft: true,
    zone: "air-shelf",
    musicCueId: "drowned-quarter",
    plate: { place: "ใต้ทะเลฟ้า", time: "คืนแรก → เย็นวันรุ่งขึ้น", pov: ["Cael"] },
    expectPov: ["Cael"],
  },
  {
    id: "07",
    number: 7,
    source: `${DRAFTS}/arc2/chapter_07.md`,
    arc: 2,
    draft: true,
    zone: "air-shelf",
    // Scene 6 "ที่อีกฟากของโลก: หอจดหมายเหตุกรุงหลวง" follows Sera in the capital.
    zoneShifts: [{ scene: 6, zone: "capital" }],
    musicCueId: "drowned-quarter",
    plate: { place: "เมืองจมใต้ทะเลฟ้า · กรุงหลวง", time: "เช้า → ค่ำ", pov: ["Ilyra", "เซลาควิลล์"] },
    // The draft's POV line spells the name in Thai script (เซลาควิลล์) for this chapter.
    expectPov: ["Ilyra", "เซลาควิลล์"],
  },
  {
    id: "08",
    number: 8,
    source: `${DRAFTS}/arc2/chapter_08.md`,
    arc: 2,
    draft: true,
    zone: "air-shelf",
    musicCueId: "drowned-quarter",
    plate: { place: "ทะเลฟ้า · รอบนอกเมืองจม", time: "เช้า → กลางคืน", pov: ["Cael"] },
    expectPov: ["Cael"],
  },
  {
    id: "09",
    number: 9,
    source: `${DRAFTS}/arc2/chapter_09.md`,
    arc: 2,
    draft: true,
    zone: "shroud",
    // Scene 5 "ที่อีกฟากของโลก: หอจดหมายเหตุ กรุงหลวง" follows Sera in the capital.
    zoneShifts: [{ scene: 5, zone: "capital" }],
    musicCueId: "drowned-quarter",
    plate: { place: "เขตหมอกเหนือ · กรุงหลวง", time: "เช้า → ค่ำ", pov: ["Ilyra", "เซลาควิลล์"] },
    expectPov: ["Ilyra", "Sera"],
  },
  {
    id: "10",
    number: 10,
    source: `${DRAFTS}/arc2/chapter_10.md`,
    arc: 2,
    draft: true,
    zone: "air-shelf",
    musicCueId: "drowned-quarter",
    plate: { place: "เส้นทางเหนือสู่กรุงหลวง", time: "สองวัน", pov: ["Cael"] },
    expectPov: ["Cael"],
  },
  {
    id: "11",
    number: 11,
    source: `${DRAFTS}/arc2/chapter_11.md`,
    arc: 3,
    draft: true,
    zone: "capital",
    musicCueId: "pressure-veil",
    plate: { place: "กรุงหลวง · หอจดหมายเหตุ", time: "หนึ่งวันหนึ่งคืน", pov: ["เซลาควิลล์"] },
    expectPov: ["Sera"],
  },
  {
    id: "12",
    number: 12,
    source: `${DRAFTS}/arc2/chapter_12.md`,
    arc: 3,
    draft: true,
    zone: "capital",
    musicCueId: "pressure-veil",
    plate: { place: "กรุงหลวง", time: "ก่อนรุ่งสาง → คืน", pov: ["Maera", "Nio"] },
    expectPov: ["Maera", "Nio"],
  },
  {
    id: "13",
    number: 13,
    source: `${DRAFTS}/arc2/chapter_13.md`,
    arc: 3,
    draft: true,
    zone: "capital",
    musicCueId: "pressure-veil",
    plate: { place: "กรุงหลวง · ท่อไอน้ำ", time: "กลางคืน", pov: ["เซลาควิลล์"] },
    expectPov: ["Sera"],
  },
  {
    id: "14",
    number: 14,
    source: `${DRAFTS}/arc2/chapter_14.md`,
    arc: 3,
    draft: true,
    zone: "mistwood",
    musicCueId: "pressure-veil",
    plate: { place: "เรือ Albatross · ป่าหมอก", time: "เช้าวันแรก → พลบค่ำวันถัดมา", pov: ["Cael"] },
    expectPov: ["Cael"],
  },
  {
    id: "15",
    number: 15,
    source: `${DRAFTS}/arc2/chapter_15.md`,
    arc: 3,
    draft: true,
    zone: "capital",
    // Scene 3 "ครึ่งหลัง — Cael: การอนุญาต" is Cael's half in Mistwood.
    zoneShifts: [{ scene: 3, zone: "mistwood" }],
    musicCueId: "pressure-veil",
    plate: { place: "กรุงหลวง · ป่าหมอก", time: "กลางวัน → ค่ำ", pov: ["เซลาควิลล์", "Cael"] },
    expectPov: ["Sera", "Cael"],
  },
];
