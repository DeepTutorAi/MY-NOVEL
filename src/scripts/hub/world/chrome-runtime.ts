// Runtime writes owned by chrome (spec 2.9, 8.4 items 9, 10 and 29): --w-accent and
// data-col on every card wrapper, --resume-accent on the resume card, and the kicker's
// Thai clock words. The clock words load as their own small chunk and --card-px/py
// (chrome-pointer.ts) with the chrome-later chunk, to keep the chrome entry in budget.

import { on } from "./bus";
import { disposeAll, resumeSlug, wrappersBySlug, type Off } from "./chrome-dom";
import type { PageModel, PageSnapshot } from "./types";

const FULL_WIDTH_SHARE = 0.75;

export function setVar(el: HTMLElement, name: string, value: string | null): void {
  if (value === null || value === "") {
    if (el.style.getPropertyValue(name)) el.style.removeProperty(name);
  } else if (el.style.getPropertyValue(name) !== value) {
    el.style.setProperty(name, value);
  }
}

function writeCards(snapshot: PageSnapshot): void {
  const wrappers = wrappersBySlug();
  const { shell } = snapshot;
  const middle = shell.x + shell.w / 2;
  for (const card of snapshot.cards) {
    const wrapper = wrappers.get(card.slug);
    if (!wrapper) continue;
    setVar(wrapper, "--w-accent", card.accent || null);
    const col = card.rect.w >= shell.w * FULL_WIDTH_SHARE ? "full" : card.rect.x + card.rect.w / 2 < middle ? "l" : "r";
    if (wrapper.dataset.col !== col) wrapper.dataset.col = col;
  }
}

function writeResumeAccent(snapshot: PageSnapshot): void {
  const resume = document.querySelector<HTMLElement>("[data-hub-resume]");
  if (!resume) return;
  const slug = resumeSlug();
  const accent = slug ? snapshot.cards.find((card) => card.slug === slug)?.accent : undefined;
  setVar(resume, "--resume-accent", accent || null);
}

function writeKicker(): void {
  const clock = document.querySelector<HTMLElement>("[data-hub-kicker] [data-hub-clock]");
  if (!clock) return;
  import("./calendar-core")
    .then(({ thaiClockWords }) => {
      if (clock.isConnected) clock.textContent = thaiClockWords(new Date());
    })
    .catch((error: unknown) => console.error(error));
}

export function setupRuntime(page: PageModel): Off {
  const apply = (snapshot: PageSnapshot) => {
    writeCards(snapshot);
    writeResumeAccent(snapshot);
  };
  apply(page.getSnapshot());
  writeKicker();
  const offs = [
    page.subscribe(apply),
    on("hub:reading", () => writeResumeAccent(page.getSnapshot())),
  ];
  return () => {
    disposeAll(offs);
  };
}
