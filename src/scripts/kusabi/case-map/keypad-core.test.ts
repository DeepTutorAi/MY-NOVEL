import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAP_HISTORY, MAP_STOPS, MAP_TAPES, QUIZ_BANK } from "../../../data/kusabi/case-map";
import { codeMatches, normalizeAnswer, pickQuestions, pressClear, pressDigit } from "./keypad-core";

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
  it("numbers the stops in order and keeps pins on the plan", () => {
    MAP_STOPS.forEach((stop, index) => {
      assert.equal(stop.no, index + 1);
      assert.ok(stop.x >= 0 && stop.x <= 100 && stop.y >= 0 && stop.y <= 100, stop.place);
    });
  });

  it("lists only the tapes the story shows, not an invented full set", () => {
    assert.deepEqual(MAP_TAPES.map((tape) => tape.label), ["คนที่ 3", "คนที่ 7", "คนที่ 9", "คนที่ 11", "กลับบ้าน"]);
  });

  it("leaves E05 out of the history while it is unpublished", () => {
    assert.ok(MAP_HISTORY.every((entry) => !entry.chapter.includes("5")));
  });
});
