// Rules of the quiz and the keypad, shared by the build (which stores hashes of
// the accepted answers) and the browser (which hashes what the reader typed).

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

/** Spaces, punctuation and Thai digits do not decide whether an answer is right. */
export function normalizeAnswer(raw: string): string {
  return raw
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit)))
    .replace(/[\s:.\-"'“”‘’,]/g, "");
}

export const answerMessage = (normalized: string) => `kusabi:${normalized}`;

export interface QuizQuestion {
  id: string;
  /** Which part of the story it tests; one question per part is asked. */
  part: 1 | 2 | 3 | 4;
  text: string;
  /** The digit this answer adds to the keypad code. */
  digit: number;
  hint: string;
  answers: string[];
}

/** One question per part, in story order, with a caller-supplied random source. */
export function pickQuestions<T extends { part: number }>(bank: readonly T[], random: () => number): T[] {
  const picked: T[] = [];
  for (const part of [1, 2, 3, 4]) {
    const options = bank.filter((question) => question.part === part);
    if (options.length === 0) throw new Error(`no question for part ${part}`);
    picked.push(options[Math.min(options.length - 1, Math.floor(random() * options.length))]);
  }
  return picked;
}

export const CODE_LENGTH = 4;

export interface KeypadState {
  entered: string;
}

/** Digits fill the four holes; further presses are ignored until one is cleared. */
export function pressDigit(entered: string, digit: string): string {
  if (!/^\d$/.test(digit)) return entered;
  return entered.length >= CODE_LENGTH ? entered : `${entered}${digit}`;
}

export const pressClear = (entered: string) => entered.slice(0, -1);

export const codeMatches = (entered: string, digits: readonly number[]) => entered === digits.join("");
