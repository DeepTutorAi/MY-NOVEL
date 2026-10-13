// Suspicion pins on Karlsen's board (design section 8.1). Stored names are
// reader data: anything not on the board is dropped on read.

export const SUSPECTS_KEY = "hvitveldt:suspects";

export function parseSuspects(raw: string | null, knownNames: readonly string[]): string[] {
  if (raw === null) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const known = new Set(knownNames);
  return [...new Set(value.filter((name): name is string => typeof name === "string" && known.has(name)))];
}

export function toggleSuspect(list: readonly string[], name: string): string[] {
  return list.includes(name) ? list.filter((item) => item !== name) : [...list, name];
}

const HOST = "Elena Vasquez";

/** The finale's handwritten line on the board (design 8.2): whom the reader suspected, and Elena. */
export function suspectedLine(pins: readonly string[]): string {
  const who = pins.length > 0 ? `คุณเคยสงสัย ${pins.join(", ")}` : "คุณไม่ได้สงสัยใครเลย";
  return `${who} · ${pins.includes(HOST) ? "และคุณสงสัยถูกคน" : `ไม่เคยสงสัย ${HOST}`}`;
}
