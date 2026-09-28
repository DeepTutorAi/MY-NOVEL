// Client side of the /sea/ home reading state: the resume chip in the hero
// and the read marks / cutscene replay links in the table of contents. Both
// read localStorage only; the pages render them hidden or empty so nothing
// shifts when storage is unavailable.
import { onSeaPage } from "../lifecycle";
import { LAST_KEY, chapterKey, readChapterRatio, readStoredJson } from "../reader/reading-progress";
import { cutscenePlayedKey, readMark, resolveResume, type SeaHomeUnit } from "./home-reading-core";

function parseUnits(raw: string | undefined): SeaHomeUnit[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((unit): unit is SeaHomeUnit => typeof unit?.id === "string" && Number.isFinite(unit?.number))
      : [];
  } catch {
    return [];
  }
}

function hasKey(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

export function bindResumeChip(): (() => void) | undefined {
  const chip = document.querySelector<HTMLElement>("[data-sea-resume]");
  const link = chip?.querySelector<HTMLAnchorElement>("[data-sea-resume-link]");
  const clear = chip?.querySelector<HTMLButtonElement>("[data-sea-resume-clear]");
  if (!chip || !link) return undefined;

  const target = resolveResume(
    readStoredJson(LAST_KEY),
    parseUnits(chip.dataset.units),
    chip.dataset.chapterBase ?? "",
  );
  if (!target) return undefined;

  link.textContent = target.label;
  link.href = target.href;
  chip.hidden = false;

  const onClear = () => {
    try {
      localStorage.removeItem(LAST_KEY);
      localStorage.removeItem(chapterKey(target.chapterId));
    } catch {
      // Storage blocked: hiding the chip is still the expected result.
    }
    chip.hidden = true;
    document.querySelector<HTMLElement>(".sea-ascent-cta")?.focus();
  };
  clear?.addEventListener("click", onClear);
  return () => clear?.removeEventListener("click", onClear);
}

export function bindTocMarks(): void {
  for (const mark of document.querySelectorAll<HTMLElement>("[data-read-mark]")) {
    const id = mark.dataset.readMark;
    const result = id ? readMark(readChapterRatio(id)) : null;
    const visible = mark.querySelector<HTMLElement>("[data-read-mark-text]");
    const spoken = mark.querySelector<HTMLElement>("[data-read-mark-spoken]");
    if (!result || !visible || !spoken) continue;
    visible.textContent = result.text;
    spoken.textContent = result.spoken;
    mark.dataset.state = result.text === "✓" ? "done" : "partial";
  }
  for (const replay of document.querySelectorAll<HTMLElement>("[data-cutscene-replay]")) {
    const arc = replay.dataset.cutsceneReplay;
    if (arc && hasKey(cutscenePlayedKey(arc))) replay.hidden = false;
  }
}

onSeaPage("home-resume", bindResumeChip);
onSeaPage("home-toc-marks", () => {
  bindTocMarks();
});
