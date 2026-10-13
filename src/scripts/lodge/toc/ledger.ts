// The GUEST RECORDS contents page (design section 5.3): each chapter's line
// shows how far this profile read it, and the ledger ends with the reader's
// own guest card.
import { renderGuestCard, readGuestRecord } from "../home/guest-book";
import { FINISHED, activeProfileId, finishedChapters, lodgeDrift, readChapterProgress, storageEntries } from "../progress-core";

/** Below this the chapter counts as not opened (matches the home resume card). */
const STARTED = 0.005;

export function ledgerStatus(progress: number | undefined): { text: string; stamp: boolean } {
  if (progress === undefined || progress < STARTED) return { text: "ยังไม่เปิด", stamp: false };
  if (progress >= FINISHED) return { text: "READ", stamp: true };
  return { text: `อ่านไป ${Math.max(1, Math.min(99, Math.round(progress * 100)))}%`, stamp: false };
}

export function setupLedger(root: HTMLElement): void {
  let progress = new Map<number, number>();
  try {
    progress = readChapterProgress(storageEntries(window.localStorage), activeProfileId(window.localStorage));
  } catch {
    // Unreadable storage: every chapter shows as not opened.
  }
  for (const row of root.querySelectorAll<HTMLElement>("[data-ledger-row]")) {
    const status = row.querySelector<HTMLElement>("[data-ledger-status]");
    if (!status) continue;
    const { text, stamp } = ledgerStatus(progress.get(Number(row.dataset.chapterNumber)));
    status.textContent = text;
    status.classList.toggle("is-stamp", stamp);
  }
  const card = root.querySelector<HTMLElement>("[data-guest-card]");
  if (card) renderGuestCard(card, readGuestRecord(), lodgeDrift(finishedChapters(progress, FINISHED)));
  root.dataset.ledger = "ready";
}
