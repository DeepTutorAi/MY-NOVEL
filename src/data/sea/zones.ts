// Canon zones of the Sea story: five above-ground regions followed by the five
// layers inside the sky-ocean. Drives body[data-zone] palettes and the
// atmosphere profile of each chapter.
export const SEA_ZONES = [
  "elaris",
  "shroud",
  "air-shelf",
  "capital",
  "mistwood",
  "sun-sheet",
  "drowned-quarter",
  "pressure-veil",
  "old-pressure",
  "first-memory",
] as const;

export type SeaZone = (typeof SEA_ZONES)[number];

export const SEA_ZONE_LABELS: Record<SeaZone, string> = {
  elaris: "เอลาริส",
  shroud: "ม่านหมอก",
  "air-shelf": "ใต้เพดานน้ำ",
  capital: "กรุงหลวง",
  mistwood: "ป่าหมอก",
  "sun-sheet": "แผ่นตะวัน",
  "drowned-quarter": "ย่านจมน้ำ",
  "pressure-veil": "ม่านแรงดัน",
  "old-pressure": "แรงดันโบราณ",
  "first-memory": "ความทรงจำแรก",
};

export function isSeaZone(value: unknown): value is SeaZone {
  return typeof value === "string" && (SEA_ZONES as readonly string[]).includes(value);
}
