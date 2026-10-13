// Karlsen's board on the characters page (design section 8.1): suspicion pins
// the reader sets, file numbers and fate stamps that appear as the reader
// finishes the chapters that establish them. All text is written with
// textContent; stored pins are filtered against the names on the board.
import { FATES, visibleStamps } from "../../../data/lodge/fates";
import { readGuestRecord, renderGuestCard } from "../home/guest-book";
import { FINISHED, lodgeDrift, readFinished } from "../progress-core";
import { SUSPECTS_KEY, parseSuspects, suspectedLine, toggleSuspect } from "./board-core";

/** Pins set while storage refused writes, kept for this page session. */
let sessionPins: string[] | null = null;

function readPins(names: readonly string[]): string[] {
  if (sessionPins) return sessionPins;
  try {
    return parseSuspects(window.localStorage.getItem(SUSPECTS_KEY), names);
  } catch {
    return [];
  }
}

function writePins(pins: string[]): void {
  try {
    window.localStorage.setItem(SUSPECTS_KEY, JSON.stringify(pins));
    sessionPins = null;
  } catch {
    sessionPins = pins;
  }
}

export function setupBoard(root: HTMLElement): () => void {
  const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-board-card]"));
  const names = cards.map((card) => card.dataset.name ?? "");
  let finished = new Set<number>();
  try {
    finished = readFinished(window.localStorage, FINISHED);
  } catch {
    // Unreadable storage: a board for a new reader.
  }

  for (const card of cards) {
    const fate = FATES.find((entry) => entry.name === card.dataset.name);
    const file = card.querySelector<HTMLElement>("[data-file-number]");
    const list = card.querySelector<HTMLElement>("[data-stamps]");
    if (!fate) continue;
    if (file && fate.fileNumber) {
      file.textContent = fate.fileNumber.label;
      file.hidden = !finished.has(fate.fileNumber.chapter);
    }
    if (list) {
      list.replaceChildren(
        ...visibleStamps(fate, finished).map((stamp) => {
          const item = document.createElement("li");
          item.className = "board-stamp";
          item.dataset.stamp = "";
          if (stamp.superseded) item.classList.add("is-superseded");
          if (stamp.note) item.classList.add("is-note");
          // Overturned stamps are struck through in the markup, so screen readers hear it too.
          if (stamp.superseded) item.append(Object.assign(document.createElement("s"), { textContent: stamp.stamp }));
          else item.textContent = stamp.stamp;
          return item;
        }),
      );
    }
  }

  // The finale (design 8.2): the reader's own card is pinned last, with whom they suspected.
  const finale = root.querySelector<HTMLElement>("[data-board-finale]");
  const ended = lodgeDrift(finished) === 4;
  if (finale) {
    finale.hidden = !ended;
    const card = finale.querySelector<HTMLElement>("[data-guest-card]");
    if (ended && card) renderGuestCard(card, readGuestRecord(), 4);
  }

  const render = () => {
    const pins = readPins(names);
    for (const card of cards) {
      const button = card.querySelector<HTMLButtonElement>("[data-suspect]");
      button?.setAttribute("aria-pressed", String(pins.includes(card.dataset.name ?? "")));
    }
    const line = finale?.querySelector<HTMLElement>("[data-board-suspected]");
    if (ended && line) line.textContent = suspectedLine(pins);
  };
  const onClick = (event: Event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-suspect]");
    const name = button?.closest<HTMLElement>("[data-board-card]")?.dataset.name;
    if (!button || !name) return;
    writePins(toggleSuspect(readPins(names), name));
    render();
  };
  root.addEventListener("click", onClick);
  render();
  root.dataset.board = "ready";
  return () => root.removeEventListener("click", onClick);
}
