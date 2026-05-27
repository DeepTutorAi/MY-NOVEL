export const ACTS = [
  { number: 1, title: "Welcome", range: [1, 5] },
  { number: 2, title: "Cracks", range: [6, 12] },
  { number: 3, title: "Descent", range: [13, 15] },
  { number: 4, title: "Thaw", range: [16, 18] },
] as const;

export function actForChapter(n: number) {
  const act = ACTS.find((item) => n >= item.range[0] && n <= item.range[1]);

  if (!act) {
    throw new RangeError(`Chapter ${n} is outside the known Hvitveldt act map.`);
  }

  return act;
}
