import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAP_ARCS, MAP_BEHIND, MAP_FACTS, MAP_FACTS_LATE, MAP_HISTORY, MAP_MIRROR, MAP_NAMES, MAP_QUESTIONS, MAP_SHORT, MAP_STOPS, MAP_TAPES, MAP_TRUTH, MAP_WOUNDS, QUIZ_BANK } from "../../../data/kusabi/case-map";
import { CODE_LENGTH, codeMatches, normalizeAnswer, pickLateQuestions, pickQuestions, pressClear, pressDigit } from "./keypad-core";

describe("answers", () => {
  it("ignores spacing, punctuation and Thai digits", () => {
    assert.equal(normalizeAnswer(" 23:11 "), "2311");
    assert.equal(normalizeAnswer("๒๓.๑๑"), "2311");
    assert.equal(normalizeAnswer("ซูซูกิ อากิระ"), "ซูซูกิอากิระ");
    assert.equal(normalizeAnswer("“อย่าเร่ง”"), "อย่าเร่ง");
    assert.equal(normalizeAnswer("   "), "");
  });
});

describe("question bank", () => {
  it("has an answer, a digit and a hint for every question, and unique ids", () => {
    const ids = new Set(QUIZ_BANK.map((question) => question.id));
    assert.equal(ids.size, QUIZ_BANK.length);
    for (const question of QUIZ_BANK) {
      assert.ok(question.answers.length > 0, question.id);
      assert.ok(Number.isInteger(question.digit) && question.digit >= 0 && question.digit <= 9, question.id);
      assert.ok(question.hint.length > 0, question.id);
    }
  });

  it("covers all four parts so a round always tests the whole story", () => {
    for (const part of [1, 2, 3, 4]) assert.ok(QUIZ_BANK.some((question) => question.part === part), `part ${part}`);
    for (const random of [() => 0, () => 0.999, () => 0.5]) {
      const picked = pickQuestions(QUIZ_BANK, random);
      assert.deepEqual(picked.map((question) => question.part), [1, 2, 3, 4]);
    }
  });

  it("asks a reader who has not finished only about the end of the book, with no repeats", () => {
    for (const random of [() => 0, () => 0.999, () => 0.5, Math.random]) {
      const picked = pickLateQuestions(QUIZ_BANK, random);
      assert.deepEqual(picked.map((question) => question.part), [3, 3, 4, 4]);
      assert.equal(new Set(picked.map((question) => question.id)).size, CODE_LENGTH);
    }
  });
});

describe("keypad", () => {
  it("takes four digits and ignores the rest", () => {
    let entered = "";
    for (const digit of ["7", "x", "0", "5", "3", "9"]) entered = pressDigit(entered, digit);
    assert.equal(entered, "7053");
    assert.equal(pressClear(entered), "705");
    assert.equal(pressClear(""), "");
    assert.equal(codeMatches("7053", [7, 0, 5, 3]), true);
    assert.equal(codeMatches("7035", [7, 0, 5, 3]), false);
  });
});

describe("map data", () => {
  it("numbers the stops in order and puts each in exactly one part of the book", () => {
    MAP_STOPS.forEach((stop, index) => assert.equal(stop.no, index + 1));
    assert.deepEqual(MAP_ARCS.flatMap((arc) => arc.stops), MAP_STOPS.map((stop) => stop.no));
  });

  it("keeps the Extra arc out of what opens right after the epilogue", () => {
    const early = JSON.stringify([MAP_SHORT, MAP_ARCS, MAP_STOPS, MAP_FACTS, MAP_BEHIND, MAP_WOUNDS, MAP_MIRROR, MAP_QUESTIONS, MAP_NAMES]);
    for (const secret of ["อายาเมะ", "ฮิราซากะ", "2009", "2010", "ผู้ช่วย", "ห้องเล็ก", "หัวหอม"]) assert.ok(!early.includes(secret), secret);
    assert.ok(JSON.stringify(MAP_TRUTH).includes("อายาเมะ"));
    assert.ok(JSON.stringify(MAP_FACTS_LATE).includes("อายาเมะ"));
  });

  it("answers the author's questions about the group's past and keeps each fact short", () => {
    const facts = [...MAP_FACTS.flatMap((entry) => entry.facts), ...MAP_FACTS_LATE];
    for (const topic of ["เรียวยะรู้จักนาโอะก่อนใคร", "ทำไมเธอตกลงคบ", "คำที่เขาไม่พูดอีกเลย", "หนึ่งวันของเขา", "งานอดิเรกที่หมู่บ้านรู้"]) {
      assert.ok(facts.some((fact) => fact.title === topic), topic);
    }
    assert.equal(new Set(facts.map((fact) => fact.title)).size, facts.length);
    for (const fact of facts) {
      assert.ok(fact.text.length > 0 && fact.text.length <= 300, fact.title);
      assert.doesNotMatch(fact.text, /[—–]/, fact.title);
    }
  });

  it("does not repeat the details the kb has wrong or the draft leaves to E05", () => {
    const all = JSON.stringify([MAP_FACTS, MAP_FACTS_LATE, MAP_BEHIND, MAP_WOUNDS, MAP_MIRROR, MAP_QUESTIONS, MAP_NAMES, MAP_TRUTH]);
    // The kb's count includes deaths the book dropped, and has the assistant die where E03 has him run.
    for (const stale of ["17 ศพ", "สิบเจ็ดศพ", "ผู้ร่วมทดลอง", "เหยื่อรายแรก"]) assert.ok(!all.includes(stale), stale);
  });

  it("lists only the tapes the story shows, not an invented full set", () => {
    assert.deepEqual(MAP_TAPES.map((tape) => tape.label), ["คนที่ 3", "คนที่ 7", "คนที่ 9", "คนที่ 11", "กลับบ้าน"]);
  });

  it("leaves E05 out of the history, which opens before it", () => {
    assert.ok(MAP_HISTORY.every((entry) => !entry.chapter.includes("5")));
  });
});
