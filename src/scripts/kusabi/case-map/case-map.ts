// The story plan page: four questions, then the keypad, then the plan. A reader who has
// not finished accepts the spoilers first and is asked about the end of the book. The
// questions and the plan arrive from the vault, so nobody downloads them before that.
import { CASE_MAP_KEY, isUnlocked, sha256Hex, type KusabiProgress } from "../progress-core";
import { loadProgress, safeSet } from "../progress";
import { loadVault } from "../vault";
import { answerMessage, codeMatches, CODE_LENGTH, normalizeAnswer, pickLateQuestions, pickQuestions, pressClear, pressDigit } from "./keypad-core";

interface Question {
  id: string;
  part: 1 | 2 | 3 | 4;
  text: string;
  digit: number;
  hint: string;
  hashes: string[];
}

interface MapFile {
  short: string[];
  arcs: Array<{ title: string; chapters: string; what: string; stops: number[] }>;
  stops: Array<{ no: number; place: string; chapter: string; text: string }>;
  night: Array<{ when: string; what: string }>;
  knows: Array<{ who: string; what: string; chapter: string }>;
  clues: Array<{ what: string; first: string; then: string }>;
  tapes: Array<{ label: string; what: string; chapter: string }>;
  facts: Array<{ group: string; facts: Fact[] }>;
  behind: Array<{ when: string; what: string }>;
  wounds: Array<{ who: string; what: string }>;
  mirror: string[];
  questions: Array<{ q: string; a: string }>;
  names: string[];
}

interface Fact {
  title: string;
  text: string;
}

interface HistoryFile {
  history: Array<{ when: string; what: string; chapter: string }>;
  truth: string[];
  facts: Fact[];
}

const el = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector);

function make(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A plain list of sentences into the list element with this data attribute. */
function fillLines(selector: string, lines: string[]): void {
  el(selector)?.replaceChildren(...lines.map((line) => make("li", undefined, line)));
}

/** A row with a small label beside its text, the shape most of this page is made of. */
function fillRows<T>(selector: string, rows: T[], label: (row: T) => string, text: (row: T) => string): void {
  el(selector)?.replaceChildren(
    ...rows.map((row) => {
      const item = make("li");
      item.append(make("small", undefined, label(row)), make("span", undefined, text(row)));
      return item;
    }),
  );
}

function factList(facts: Fact[]): HTMLElement {
  const list = make("ul", "facts");
  list.append(
    ...facts.map((fact) => {
      const item = make("li", "fact");
      item.append(make("p", "fact-title", fact.title), make("p", "fact-text", fact.text));
      return item;
    }),
  );
  return list;
}

function renderMap(data: MapFile): void {
  fillLines("[data-short]", data.short);

  const stopFor = new Map(data.stops.map((stop) => [stop.no, stop]));
  el("[data-arcs]")?.replaceChildren(
    ...data.arcs.map((arc) => {
      const section = make("section", "arc");
      const head = make("div", "arc-head");
      head.append(make("h3", "arc-title", arc.title), make("span", "arc-chapters", arc.chapters));
      const stops = make("ol", "stops");
      stops.append(
        ...arc.stops.flatMap((no) => {
          const stop = stopFor.get(no);
          if (!stop) return [];
          const row = make("li", "stop");
          row.append(make("span", "stop-no", String(stop.no).padStart(2, "0")));
          const copy = make("div");
          copy.append(make("p", "stop-place", stop.place), make("p", "stop-chapter", stop.chapter), make("p", "stop-text", stop.text));
          row.append(copy);
          return [row];
        }),
      );
      section.append(head, make("p", "arc-what", arc.what), stops);
      return section;
    }),
  );

  fillRows("[data-night]", data.night, (entry) => entry.when, (entry) => entry.what);

  el("[data-knows]")?.replaceChildren(
    ...data.knows.map((entry) => {
      const row = make("li");
      row.append(make("strong", undefined, `${entry.who} `), make("span", undefined, entry.what), make("br"), make("small", undefined, entry.chapter));
      return row;
    }),
  );

  el("[data-clues]")?.replaceChildren(
    ...data.clues.map((clue) => {
      const row = make("li", "clue");
      row.append(make("p", "clue-what", clue.what), make("p", "clue-first", clue.first), make("p", "clue-then", clue.then));
      return row;
    }),
  );

  el("[data-ledger]")?.replaceChildren(
    ...data.tapes.map((entry) => {
      const row = make("li");
      const copy = make("div");
      copy.append(make("span", undefined, entry.what), make("br"), make("small", undefined, entry.chapter));
      row.append(make("span", "ledger-label", entry.label), copy);
      return row;
    }),
  );

  el("[data-facts]")?.replaceChildren(
    ...data.facts.map((entry) => {
      const section = make("section", "map-part");
      section.append(make("h3", undefined, entry.group), factList(entry.facts));
      return section;
    }),
  );

  fillRows("[data-behind]", data.behind, (entry) => entry.when, (entry) => entry.what);
  fillRows("[data-wounds]", data.wounds, (entry) => entry.who, (entry) => entry.what);
  fillLines("[data-mirror]", data.mirror);
  fillLines("[data-names]", data.names);

  el("[data-questions]")?.replaceChildren(
    ...data.questions.flatMap((entry) => [make("dt", undefined, entry.q), make("dd", undefined, entry.a)]),
  );
}

async function showMap(progress: KusabiProgress, signal: AbortSignal): Promise<void> {
  el("[data-map-locked]")?.toggleAttribute("hidden", true);
  el("[data-quiz]")?.toggleAttribute("hidden", true);
  el("[data-keypad]")?.toggleAttribute("hidden", true);
  const lead = el("[data-map-lead]");
  if (lead) lead.textContent = "โครงเรื่องทั้งเล่ม เบาะแสที่วางไว้ และสิ่งที่นิยายไม่ได้เล่า";
  renderMap(await loadVault<MapFile>("map"));
  if (signal.aborted) return;
  el("[data-map-open]")?.toggleAttribute("hidden", false);

  if (isUnlocked("case-map-history", progress)) {
    const data = await loadVault<HistoryFile>("history");
    if (signal.aborted) return;
    fillLines("[data-truth]", data.truth);
    el("[data-facts-late]")?.replaceChildren(factList(data.facts));
    el("[data-history]")?.replaceChildren(
      ...data.history.map((entry) => {
        const row = make("li");
        const copy = make("div");
        copy.append(make("span", undefined, entry.what), make("br"), make("small", undefined, entry.chapter));
        row.append(make("small", undefined, entry.when), copy);
        return row;
      }),
    );
    el("[data-history-wrap]")?.toggleAttribute("hidden", false);
    el("[data-history-hint]")?.toggleAttribute("hidden", true);
  }
}

function runKeypad(digits: number[], onOpen: () => void, signal: AbortSignal): void {
  const panel = el("[data-keypad]");
  const holes = el("[data-keypad-holes]");
  const error = el("[data-keypad-error]");
  if (!panel || !holes) return;
  panel.hidden = false;
  let entered = "";

  const paint = () => {
    Array.from(holes.children).forEach((hole, index) => {
      hole.textContent = entered[index] ?? "";
    });
  };

  const press = (digit: string) => {
    entered = pressDigit(entered, digit);
    if (error) error.hidden = true;
    panel.dataset.wrong = "false";
    paint();
  };

  const enter = () => {
    if (entered.length < CODE_LENGTH) return;
    if (codeMatches(entered, digits)) {
      onOpen();
      return;
    }
    entered = "";
    paint();
    if (error) error.hidden = false;
    panel.dataset.wrong = "true";
  };

  panel.querySelectorAll<HTMLButtonElement>("[data-key]").forEach((key) => {
    key.addEventListener("click", () => press(key.dataset.key ?? ""), { signal });
  });
  panel.querySelector("[data-key-clear]")?.addEventListener(
    "click",
    () => {
      entered = pressClear(entered);
      paint();
    },
    { signal },
  );
  panel.querySelector("[data-key-enter]")?.addEventListener("click", enter, { signal });
  document.addEventListener(
    "keydown",
    (event) => {
      if (panel.hidden || event.target instanceof HTMLInputElement) return;
      if (/^[0-9]$/.test(event.key)) press(event.key);
      if (event.key === "Backspace") {
        entered = pressClear(entered);
        paint();
      }
      if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) enter();
    },
    { signal },
  );
  panel.querySelector<HTMLButtonElement>('[data-key="1"]')?.focus();
}

function runQuiz(questions: Question[], onDone: (digits: number[]) => void, signal: AbortSignal): void {
  const quiz = el("[data-quiz]");
  const form = el<HTMLFormElement>("[data-quiz-form]");
  const text = el("[data-quiz-text]");
  const input = el<HTMLInputElement>("[data-quiz-input]");
  const error = el("[data-quiz-error]");
  const digitList = el("[data-quiz-digits]");
  if (!quiz || !form || !text || !input || !error || !digitList) return;

  quiz.hidden = false;
  digitList.replaceChildren(...questions.map(() => make("li", undefined, "?")));
  let index = 0;

  const ask = () => {
    text.textContent = `ข้อ ${index + 1}: ${questions[index].text}`;
    input.value = "";
    error.hidden = true;
  };

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      const current = questions[index];
      const answer = normalizeAnswer(input.value);
      if (!answer) return;
      const hash = await sha256Hex(answerMessage(answer));
      if (signal.aborted) return;
      if (!current.hashes.includes(hash)) {
        error.textContent = `ยังไม่ถูก ลองย้อนไปดู${current.hint}`;
        error.hidden = false;
        input.focus();
        return;
      }
      const slot = digitList.children[index] as HTMLElement;
      slot.textContent = String(current.digit);
      slot.dataset.done = "true";
      index += 1;
      if (index === questions.length) {
        form.hidden = true;
        onDone(questions.map((question) => question.digit));
        return;
      }
      ask();
      input.focus();
    },
    { signal },
  );
  ask();
}

/** Resolves when a reader who has not finished ticks the box and presses the button. */
function acceptSpoilers(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const consent = el<HTMLInputElement>("[data-map-consent]");
    const tease = el<HTMLButtonElement>("[data-map-tease]");
    if (!consent || !tease) return;
    consent.addEventListener(
      "change",
      () => {
        tease.hidden = !consent.checked;
      },
      { signal },
    );
    tease.addEventListener("click", () => resolve(), { signal, once: true });
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

export function setupCaseMap(): () => void {
  const abort = new AbortController();
  const { signal } = abort;

  void (async () => {
    const progress = await loadProgress();
    if (signal.aborted) return;
    if (isUnlocked("case-map", progress)) {
      await showMap(progress, signal);
      return;
    }
    const finished = isUnlocked("case-map-gate", progress);
    if (!finished) await acceptSpoilers(signal);
    if (signal.aborted) return;
    el("[data-map-locked]")?.toggleAttribute("hidden", true);
    el("[data-quiz-gotcha]")?.toggleAttribute("hidden", finished);
    const { questions } = await loadVault<{ questions: Question[] }>("quiz");
    if (signal.aborted) return;
    runQuiz(
      (finished ? pickQuestions : pickLateQuestions)(questions, Math.random),
      (digits) => {
        runKeypad(
          digits,
          () => {
            safeSet(CASE_MAP_KEY, "open");
            void loadProgress().then((next) => showMap(next, signal));
          },
          signal,
        );
      },
      signal,
    );
    if (!finished) el("[data-quiz-input]")?.focus();
  })().catch((error) => console.warn("[kusabi map] did not load", error));

  return () => abort.abort();
}
