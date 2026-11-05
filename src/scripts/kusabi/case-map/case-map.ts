// The story map page: locked until the epilogue, then four questions, then the
// keypad, then the map. The questions and the map arrive from the vault, so a
// reader who has not finished never downloads them.
import { CASE_MAP_KEY, isUnlocked, sha256Hex, type KusabiProgress } from "../progress-core";
import { loadProgress, safeSet } from "../progress";
import { loadVault } from "../vault";
import { answerMessage, codeMatches, CODE_LENGTH, normalizeAnswer, pickQuestions, pressClear, pressDigit } from "./keypad-core";

interface Question {
  id: string;
  part: 1 | 2 | 3 | 4;
  text: string;
  digit: number;
  hint: string;
  hashes: string[];
}

interface MapFile {
  stops: Array<{ no: number; x: number; y: number; place: string; chapter: string; text: string; hidden?: boolean }>;
  night: Array<{ when: string; what: string }>;
  knows: Array<{ who: string; what: string; chapter: string }>;
  tapes: Array<{ label: string; what: string; chapter: string }>;
}

interface HistoryFile {
  history: Array<{ when: string; what: string; chapter: string }>;
}

const el = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector);

function make(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderMap(data: MapFile, signal: AbortSignal): void {
  const plan = el("[data-plan]");
  const pins = el("[data-plan-pins]");
  const stops = el("[data-stops]");
  const lift = el<HTMLButtonElement>("[data-plan-lift]");
  if (!plan || !pins || !stops || !lift) return;

  const pinFor = new Map<number, HTMLButtonElement>();
  const rowFor = new Map<number, HTMLElement>();

  const select = (no: number, scroll: boolean) => {
    pinFor.forEach((pin, key) => pin.setAttribute("aria-pressed", String(key === no)));
    rowFor.forEach((row, key) => {
      row.dataset.active = String(key === no);
    });
    if (scroll) rowFor.get(no)?.scrollIntoView({ block: "nearest" });
  };

  for (const stop of data.stops) {
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = "pin";
    pin.style.left = `${stop.x}%`;
    pin.style.top = `${stop.y}%`;
    pin.setAttribute("aria-label", `จุดที่ ${stop.no}: ${stop.place}`);
    pin.setAttribute("aria-pressed", "false");
    pin.hidden = stop.hidden === true;
    pin.append(make("span", undefined, String(stop.no)));
    pin.addEventListener("click", () => select(stop.no, true), { signal });
    pins.append(pin);
    pinFor.set(stop.no, pin);

    const row = make("li", "stop");
    row.dataset.active = "false";
    row.hidden = stop.hidden === true;
    row.append(make("span", "stop-no", String(stop.no).padStart(2, "0")));
    const copy = make("div");
    copy.append(make("p", "stop-place", stop.place), make("p", "stop-chapter", stop.chapter), make("p", "stop-text", stop.text));
    row.append(copy);
    stops.append(row);
    rowFor.set(stop.no, row);
  }

  lift.addEventListener(
    "click",
    () => {
      const lifted = plan.dataset.lifted !== "true";
      plan.dataset.lifted = String(lifted);
      lift.setAttribute("aria-pressed", String(lifted));
      lift.textContent = lifted ? "วางกระดาษลง" : "ดึงขอบกระดาษขึ้น";
      for (const stop of data.stops) {
        if (!stop.hidden) continue;
        pinFor.get(stop.no)?.toggleAttribute("hidden", !lifted);
        rowFor.get(stop.no)?.toggleAttribute("hidden", !lifted);
      }
    },
    { signal },
  );

  const night = el("[data-night]");
  night?.replaceChildren(
    ...data.night.map((entry) => {
      const row = make("li");
      row.append(make("small", undefined, entry.when), make("span", undefined, entry.what));
      return row;
    }),
  );

  const knows = el("[data-knows]");
  knows?.replaceChildren(
    ...data.knows.map((entry) => {
      const row = make("li");
      row.append(make("strong", undefined, `${entry.who} `), make("span", undefined, entry.what), make("br"), make("small", undefined, entry.chapter));
      return row;
    }),
  );

  const ledger = el("[data-ledger]");
  ledger?.replaceChildren(
    ...data.tapes.map((entry) => {
      const row = make("li");
      const copy = make("div");
      copy.append(make("span", undefined, entry.what), make("br"), make("small", undefined, entry.chapter));
      row.append(make("span", "ledger-label", entry.label), copy);
      return row;
    }),
  );
}

async function showMap(progress: KusabiProgress, signal: AbortSignal): Promise<void> {
  el("[data-map-locked]")?.toggleAttribute("hidden", true);
  el("[data-quiz]")?.toggleAttribute("hidden", true);
  el("[data-keypad]")?.toggleAttribute("hidden", true);
  const lead = el("[data-map-lead]");
  if (lead) lead.textContent = "ผังที่ปักหมุดไว้ในห้องนั้น กับสรุปว่าคืนนั้นเกิดอะไรขึ้นบ้าง";
  renderMap(await loadVault<MapFile>("map"), signal);
  if (signal.aborted) return;
  el("[data-map-open]")?.toggleAttribute("hidden", false);

  if (isUnlocked("case-map-history", progress)) {
    const data = await loadVault<HistoryFile>("history");
    const list = el("[data-history]");
    list?.replaceChildren(
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
    if (!isUnlocked("case-map-gate", progress)) return;
    el("[data-map-locked]")?.toggleAttribute("hidden", true);
    const { questions } = await loadVault<{ questions: Question[] }>("quiz");
    if (signal.aborted) return;
    runQuiz(
      pickQuestions(questions, Math.random),
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
  })().catch((error) => console.warn("[kusabi map] did not load", error));

  return () => abort.abort();
}
