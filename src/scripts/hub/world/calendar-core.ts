// Calendar flavour for the hub scenes (spec 2.21). Pure; every reading of a Date
// except moonPhase uses its local time fields.

import type { MeteorShower } from "./types";

export const SYNODIC_DAYS = 29.530588853;

/** A new moon: 2000-01-06 18:14 UTC. */
const NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);
const DAY_MS = 86_400_000;

/** Phase of the moon, 0..1 with 0 = new and 0.5 = full; mean synodic month, accurate to about a day. */
export function moonPhase(date: Date): number {
  const days = (date.getTime() - NEW_MOON_MS) / DAY_MS;
  const phase = (days / SYNODIC_DAYS) % 1;
  return phase < 0 ? phase + 1 : phase;
}

/** The hour word for each local hour 0..23. */
const HOURS: readonly string[] = [
  "เที่ยงคืน",
  "ตีหนึ่ง",
  "ตีสอง",
  "ตีสาม",
  "ตีสี่",
  "ตีห้า",
  "หกโมงเช้า",
  "เจ็ดโมงเช้า",
  "แปดโมงเช้า",
  "เก้าโมงเช้า",
  "สิบโมงเช้า",
  "สิบเอ็ดโมง",
  "เที่ยงวัน",
  "บ่ายโมง",
  "บ่ายสองโมง",
  "บ่ายสามโมง",
  "สี่โมงเย็น",
  "ห้าโมงเย็น",
  "หกโมงเย็น",
  "หนึ่งทุ่ม",
  "สองทุ่ม",
  "สามทุ่ม",
  "สี่ทุ่ม",
  "ห้าทุ่ม",
];

/** The hour word without its เช้า, เย็น or วัน ending, as used before กว่า and ครึ่ง. */
const stem = (word: string) => word.replace(/(เช้า|เย็น|วัน)$/, "");

/** The time in the traditional Thai six-hour clock, rounded the way people say it aloud. */
export function thaiClockWords(date: Date): string {
  const hour = date.getHours();
  const minute = date.getMinutes();
  if (minute < 10) return HOURS[hour];
  if (minute < 25) return `${stem(HOURS[hour])}กว่า`;
  if (minute < 40) return `${stem(HOURS[hour])}ครึ่ง`;
  return `เกือบ${HOURS[(hour + 1) % 24]}`;
}

/** Peak nights (approximate, fixed each year): month (0-based), first and last evening. */
const SHOWERS: ReadonlyArray<readonly [MeteorShower, number, number, number]> = [
  ["quadrantids", 0, 3, 4],
  ["lyrids", 3, 22, 23],
  ["eta-aquariids", 4, 5, 6],
  ["perseids", 7, 12, 13],
  ["orionids", 9, 21, 22],
  ["leonids", 10, 17, 18],
  ["geminids", 11, 13, 14],
];

/**
 * The meteor shower near its peak tonight, or null. Counts only local evenings
 * from 19:00 to 05:00, a day either side of the listed peak nights.
 */
export function meteorShower(date: Date): MeteorShower | null {
  const hour = date.getHours();
  if (hour >= 5 && hour < 19) return null;
  // The night is named after the evening it began on.
  const evening = new Date(date.getFullYear(), date.getMonth(), date.getDate() - (hour < 5 ? 1 : 0));
  const at = evening.getTime();
  const year = evening.getFullYear();
  for (const [name, month, first, last] of SHOWERS) {
    const from = new Date(year, month, first - 1).getTime();
    const to = new Date(year, month, last + 1).getTime();
    if (at >= from && at <= to) return name;
  }
  return null;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** ISO-8601 week of the local date, such as "2026-W47". */
export function isoWeek(date: Date): string {
  // Thursday of this week decides the week-numbering year.
  const day = (date.getDay() + 6) % 7;
  const thursday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - day + 3);
  const year = thursday.getFullYear();
  // Rounded because a daylight-saving change can make a local day 23 or 25 hours long.
  const dayOfYear = Math.round((thursday.getTime() - new Date(year, 0, 1).getTime()) / DAY_MS);
  return `${year}-W${pad(Math.floor(dayOfYear / 7) + 1)}`;
}

/** Local calendar date, "YYYY-MM-DD". */
export function localDay(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
