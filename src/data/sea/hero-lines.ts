// Narrative lines of the /sea/ home hero. Every text is quoted verbatim from
// the published prologue (chapters/00.md) or chapter 1 (chapters/01.md);
// src/scripts/sea/sea-home-contract.test.ts enforces this. Nothing here may
// come from later chapters, and no line may speak of height or climbing.

export type SeaHeroStage = "ground" | "rise" | "shroud" | "ceiling";

export interface SeaHeroLine {
  text: string;
  source: "00" | "01";
  stage: SeaHeroStage;
}

/** Shown in the first viewport under the title. */
export const SEA_HERO_EPIGRAPH: SeaHeroLine = {
  text: "ไม่ใช่ฝนที่ตกลงมาจากก้อนเมฆ แต่เป็นฝนที่ตกลงมาจากมหาสมุทร",
  source: "00",
  stage: "ground",
};

/** Revealed in order while the hero scrolls; stacked as plain text without motion. */
export const SEA_HERO_LINES: readonly SeaHeroLine[] = [
  { text: "ฝนที่ตกลงมาแล้วหวนกลับขึ้นฟ้า", source: "01", stage: "rise" },
  { text: "เสียงในท่อไม่ใช่เสียงน้ำ", source: "00", stage: "shroud" },
  { text: "เป็นเสียงของเด็กอีกคน", source: "00", stage: "shroud" },
  { text: "ร้องเพลง", source: "00", stage: "shroud" },
  { text: "ฝันว่ามีบางอย่างอยู่ใต้ทะเลฟ้า กำลังมองขึ้นมา", source: "00", stage: "ceiling" },
];

export const SEA_HERO_SOURCE_LABELS: Record<SeaHeroLine["source"], string> = {
  "00": "บทนำ",
  "01": "บทที่ 1",
};
