import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EPIGRAPHS, epigraphFor } from "./epigraphs";

// Captured from the inline EPIGRAPHS constant that TsukinomiSectionLayout.astro
// held before it moved here (`git show 1a8244d:src/layouts/tsukinomi/TsukinomiSectionLayout.astro`).
// They are the author's text: a change here or in epigraphs.ts is a change to
// the story and must be deliberate.
const EXPECTED: ReadonlyArray<readonly [number, string]> = [
  [0, "ถ้าวันหนึ่งเพลงเดิมทำให้คุณร้องไห้โดยไม่รู้เหตุผล อย่าเพิ่งเชื่อว่าหัวใจอ่อนแอ... บางทีร่างกายอาจจำชื่อของใครบางคนแทนคุณอยู่ก็ได้"],
  [1, "ใต้หลังคาสังกะสีที่ฝนกระหน่ำตก ณ ชานชาลาสถานีร้างสึคิโนมิ สายหูฟังเส้นบางเชื่อมต่อคนสองคนผ่านเครื่องเล่นวอล์กแมนเก่าๆ... ท่วงทำนองเพลงรักแผ่วเบากำลังละลายความอ้างว้างในหัวใจเด็กหนุ่ม ท่ามกลางเสียงหัวเราะของเด็กสาวผู้โผล่มาพร้อมหยาดน้ำค้างยามเย็นราวไอหมอก"],
  [2, "ตัวโน้ตเพลงเก่าที่สลักเสลาเสียงหัวเราะแสนสดใสของเธอ มันดังก้องอยู่ในโลกใบเล็กที่เวลากำลังหมุนย้อนกลับ... ความสุขแสนสั้นที่ถักทอขึ้นจากเศษเสี้ยวความทรงจำที่ไม่มีจริงของเด็กสาวผู้ไร้เงา ชวนให้หัวใจเต้นผิดจังหวะด้วยความอบอุ่นที่รู้ดีว่าจะต้องสูญสลายไปในไม่ช้า"],
  [3, "หมอกยามเย็นเริ่มคืบคลานบดบังเส้นขอบฟ้า และความทรงจำเกี่ยวกับเธอเริ่มจางหายราวภาพถ่ายเก่าที่ถูกแดดเลีย... คำถามสุดท้ายก่อนรถไฟขบวนข้ามเวลาจะก้าวผ่าน ไม่ใช่ทำอย่างไรให้เธออยู่ต่อ แต่คือหัวใจดวงนี้จะยอมเลือกจดจำความงดงามแสนเจ็บปวด หรือจะปล่อยให้มันเลือนหายไปตลอดกาล"],
  [4, "ก้าวเดินฝ่าพายุหิมะที่พัดคลั่งท่ามกลางความหนาวเหน็บที่แช่แข็งทุกความหวัง แสงไฟรำไรนำทางขึ้นสู่ยอดเขาสถานที่เก็บงำความจริงอันน่าเศร้า... ความจริงของโบกี้รถไฟที่ตกลงมาเมื่อสิบปีก่อน และคำสัญญาในวัยเยาว์ที่ถูกหิมะทับถมแช่แข็งไว้คอยวันให้ท่วงทำนองกลับมาละลายมัน"],
  [5, "สิบปีผ่านพ้น ท่ามกลางกระแสฝูงชนที่เร่งรีบในโตเกียว รถไฟกาลเวลานำพาทุกชีวิตให้เติบโตและลืมเลือนอดีตไป... ทว่าสายลมแผ่วบางที่พัดผ่านตึกสูงยังคงพัดพาทำนองเพลงรักเพลงเดิมจากหูฟังเส้นนั้นกลับมาสะกิดหัวใจ เพื่อเตือนใจว่าบางความรักไม่เคยล่วงโรยไปตามกาลเวลา"],
];

describe("Tsukinomi cutscene epigraphs", () => {
  it("has an epigraph for the prologue and each of parts 1 to 5, non-empty", () => {
    for (let part = 0; part <= 5; part++) {
      const text = epigraphFor(part);
      assert.equal(typeof text, "string", `part ${part} has no epigraph`);
      assert.ok(text !== undefined && text.trim().length > 40, `part ${part} epigraph is empty or too short`);
    }
  });

  it("keeps every epigraph equal to the original text, character for character", () => {
    assert.equal(EXPECTED.length, 6);
    for (const [part, expected] of EXPECTED) {
      assert.equal(epigraphFor(part), expected, `part ${part} epigraph changed`);
      assert.equal(EPIGRAPHS[part], expected);
    }
  });

  it("defines exactly the parts 0 to 5", () => {
    assert.deepEqual(Object.keys(EPIGRAPHS).map(Number).sort(), [0, 1, 2, 3, 4, 5]);
  });

  it("returns undefined for a part without a cutscene, never a prototype property", () => {
    for (const part of [-1, 6, 24, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(epigraphFor(part), undefined, `part ${part}`);
    }
    // Object.hasOwn keeps inherited keys out: "constructor" is not a part number.
    assert.equal(epigraphFor("constructor" as unknown as number), undefined);
  });
});
