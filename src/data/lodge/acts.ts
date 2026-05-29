export const ACTS = [
  { number: 1, title: "ต้อนรับ", range: [1, 5] },
  { number: 2, title: "รอยร้าว", range: [6, 12] },
  { number: 3, title: "ดิ่งลง", range: [13, 15] },
  { number: 4, title: "ละลาย", range: [16, 18] },
] as const;

export function actForChapter(n: number) {
  const act = ACTS.find((item) => n >= item.range[0] && n <= item.range[1]);

  if (!act) {
    throw new RangeError(`บทที่ ${n} อยู่นอกแผนช่วงของฮวิตเวลต์`);
  }

  return act;
}
