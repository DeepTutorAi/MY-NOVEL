import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SYNODIC_DAYS, isoWeek, localDay, meteorShower, moonPhase, thaiClockWords } from "./calendar-core";

const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

/** Days from `phase` to `target` along the cycle, the short way round. */
const daysOff = (phase: number, target: number) => {
  const delta = Math.abs(phase - target) % 1;
  return Math.min(delta, 1 - delta) * SYNODIC_DAYS;
};

describe("moonPhase", () => {
  it("finds the full moon of 2024-12-15 within a day", () => {
    assert.ok(daysOff(moonPhase(new Date(Date.UTC(2024, 11, 15, 9, 2))), 0.5) <= 1);
  });

  it("finds the new moon of 2025-01-29 within a day", () => {
    assert.ok(daysOff(moonPhase(new Date(Date.UTC(2025, 0, 29, 12, 36))), 0) <= 1);
  });

  it("stays in 0..1, also before the reference new moon", () => {
    for (const ms of [Date.UTC(1990, 3, 2), Date.UTC(2000, 0, 6, 18, 14), Date.UTC(2031, 8, 9)]) {
      const p = moonPhase(new Date(ms));
      assert.ok(p >= 0 && p < 1, `phase ${p}`);
    }
  });

  it("advances one cycle per synodic month", () => {
    const a = moonPhase(new Date(Date.UTC(2026, 0, 1)));
    const b = moonPhase(new Date(Date.UTC(2026, 0, 1) + SYNODIC_DAYS * 86_400_000));
    assert.ok(daysOff(a, b) < 1e-6);
  });
});

describe("thaiClockWords", () => {
  const at = (h: number, m: number) => thaiClockWords(local(2026, 11, 18, h, m));

  it("names every hour of the six-hour clock", () => {
    assert.equal(at(0, 0), "เที่ยงคืน");
    assert.equal(at(1, 0), "ตีหนึ่ง");
    assert.equal(at(5, 0), "ตีห้า");
    assert.equal(at(6, 0), "หกโมงเช้า");
    assert.equal(at(7, 0), "เจ็ดโมงเช้า");
    assert.equal(at(11, 0), "สิบเอ็ดโมง");
    assert.equal(at(12, 0), "เที่ยงวัน");
    assert.equal(at(13, 0), "บ่ายโมง");
    assert.equal(at(15, 0), "บ่ายสามโมง");
    assert.equal(at(16, 0), "สี่โมงเย็น");
    assert.equal(at(18, 0), "หกโมงเย็น");
    assert.equal(at(19, 0), "หนึ่งทุ่ม");
    assert.equal(at(23, 0), "ห้าทุ่ม");
  });

  it("rounds minutes at the boundaries", () => {
    assert.equal(at(13, 9), "บ่ายโมง");
    assert.equal(at(13, 10), "บ่ายโมงกว่า");
    assert.equal(at(13, 24), "บ่ายโมงกว่า");
    assert.equal(at(13, 25), "บ่ายโมงครึ่ง");
    assert.equal(at(13, 39), "บ่ายโมงครึ่ง");
    assert.equal(at(13, 40), "เกือบบ่ายสองโมง");
    assert.equal(at(13, 59), "เกือบบ่ายสองโมง");
  });

  it("uses the short stem with กว่า and ครึ่ง, and wraps at midnight", () => {
    assert.equal(at(12, 30), "เที่ยงครึ่ง");
    assert.equal(at(18, 15), "หกโมงกว่า");
    assert.equal(at(11, 45), "เกือบเที่ยงวัน");
    assert.equal(at(23, 50), "เกือบเที่ยงคืน");
    assert.equal(at(0, 30), "เที่ยงคืนครึ่ง");
  });
});

describe("meteorShower", () => {
  it("names a shower on its peak evenings and the day either side", () => {
    assert.equal(meteorShower(local(2026, 8, 12, 21)), "perseids");
    assert.equal(meteorShower(local(2026, 8, 11, 19)), "perseids");
    assert.equal(meteorShower(local(2026, 8, 14, 23)), "perseids");
    assert.equal(meteorShower(local(2026, 12, 13, 20)), "geminids");
    assert.equal(meteorShower(local(2026, 11, 18, 22)), "leonids");
  });

  it("counts the small hours as part of the night before", () => {
    assert.equal(meteorShower(local(2026, 8, 15, 4, 59)), "perseids");
    assert.equal(meteorShower(local(2026, 8, 16, 2)), null);
    assert.equal(meteorShower(local(2026, 1, 1, 3)), null, "the night of 31 December");
    assert.equal(meteorShower(local(2026, 1, 3, 1)), "quadrantids", "the night of 2 January");
  });

  it("is quiet in daylight and outside the windows", () => {
    assert.equal(meteorShower(local(2026, 8, 12, 12)), null);
    assert.equal(meteorShower(local(2026, 8, 12, 5)), null);
    assert.equal(meteorShower(local(2026, 8, 12, 18, 59)), null);
    assert.equal(meteorShower(local(2026, 8, 10, 22)), null);
    assert.equal(meteorShower(local(2026, 3, 1, 22)), null);
  });
});

describe("isoWeek and localDay", () => {
  it("numbers ISO weeks, including year edges", () => {
    assert.equal(isoWeek(local(2026, 11, 18)), "2026-W47");
    assert.equal(isoWeek(local(2026, 11, 23)), "2026-W48");
    assert.equal(isoWeek(local(2026, 11, 22)), "2026-W47");
    assert.equal(isoWeek(local(2021, 1, 3)), "2020-W53");
    assert.equal(isoWeek(local(2024, 12, 30)), "2025-W01");
    assert.equal(isoWeek(local(2026, 1, 1)), "2026-W01");
  });

  it("formats the local day", () => {
    assert.equal(localDay(local(2026, 1, 5, 0, 1)), "2026-01-05");
    assert.equal(localDay(local(2026, 11, 18, 23, 59)), "2026-11-18");
  });
});
