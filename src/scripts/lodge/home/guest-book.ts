// The optional guest book (design section 5.2) and the guest card it fills,
// which the GUEST RECORDS page and the finale reuse. The name is reader input:
// it goes through guest-core.ts and is only ever written with textContent.
import { GUEST_KEY, guestMonthLabel, normalizeGuestName, parseGuestRecord, type GuestRecord } from "../guest-core";
import type { DriftLevel } from "../progress-core";

const BLANK_NAME = "________";
const STORAGE_NOTICE = "เบราว์เซอร์ไม่อนุญาตให้บันทึก ชื่อจะหายเมื่อปิดหน้า";
/** Who invited the reader, written in once the book is finished (design 8.2). */
const REFERRER = "E. VASQUEZ";

/** The record written this page session when storage refused it. */
let sessionRecord: GuestRecord | null = null;

export function readGuestRecord(): GuestRecord | null {
  if (sessionRecord) return sessionRecord;
  try {
    return parseGuestRecord(window.localStorage.getItem(GUEST_KEY));
  } catch {
    return null;
  }
}

/** Saves the record; returns false when storage refused it (the record is then kept for this session). */
function writeGuestRecord(record: GuestRecord | null): boolean {
  try {
    if (record) window.localStorage.setItem(GUEST_KEY, JSON.stringify(record));
    else window.localStorage.removeItem(GUEST_KEY);
    sessionRecord = null;
    return true;
  } catch {
    sessionRecord = record;
    return false;
  }
}

export function renderGuestCard(root: HTMLElement, record: GuestRecord | null, level: DriftLevel): void {
  const name = root.querySelector<HTMLElement>("[data-guest-name]");
  const month = root.querySelector<HTMLElement>("[data-guest-month]");
  const referred = root.querySelector<HTMLElement>("[data-guest-referred]");
  if (name) name.textContent = record?.name ?? (record?.skipped ? "GUEST" : BLANK_NAME);
  if (month) month.textContent = guestMonthLabel(record?.signedAt ?? new Date().toISOString());
  if (referred) referred.textContent = level === 4 ? REFERRER : "";
  root.dataset.signed = record ? (record.skipped ? "skipped" : "signed") : "blank";
}

export function setupGuestBook(book: HTMLElement, level: DriftLevel): () => void {
  const card = book.querySelector<HTMLElement>("[data-guest-card]");
  const form = book.querySelector<HTMLFormElement>("[data-guest-form]");
  const input = book.querySelector<HTMLInputElement>("#guest-name");
  const actions = book.querySelector<HTMLElement>("[data-guest-actions]");
  const notice = book.querySelector<HTMLElement>("[data-guest-notice]");
  const skip = book.querySelector<HTMLButtonElement>("[data-guest-skip]");
  const edit = book.querySelector<HTMLButtonElement>("[data-guest-edit]");
  const erase = book.querySelector<HTMLButtonElement>("[data-guest-erase]");
  if (!card || !form || !input || !actions || !notice || !skip || !edit || !erase) return () => {};

  const show = (editing: boolean) => {
    const record = readGuestRecord();
    renderGuestCard(card, record, level);
    form.hidden = Boolean(record) && !editing;
    actions.hidden = !record || editing;
  };

  const save = (record: GuestRecord | null) => {
    const saved = writeGuestRecord(record);
    notice.hidden = saved;
    notice.textContent = saved ? "" : STORAGE_NOTICE;
    if (record?.name) card.classList.add("is-writing");
    show(false);
  };

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    const name = normalizeGuestName(input.value);
    if (!name) {
      input.focus();
      return;
    }
    save({ name, signedAt: new Date().toISOString(), skipped: false });
  };
  const onSkip = () => save({ name: null, signedAt: new Date().toISOString(), skipped: true });
  const onEdit = () => {
    input.value = readGuestRecord()?.name ?? "";
    show(true);
    input.focus();
  };
  const onErase = () => {
    save(null);
    input.value = "";
  };
  const onAnimationEnd = () => card.classList.remove("is-writing");

  form.addEventListener("submit", onSubmit);
  skip.addEventListener("click", onSkip);
  edit.addEventListener("click", onEdit);
  erase.addEventListener("click", onErase);
  card.addEventListener("animationend", onAnimationEnd);
  show(false);

  return () => {
    form.removeEventListener("submit", onSubmit);
    skip.removeEventListener("click", onSkip);
    edit.removeEventListener("click", onEdit);
    erase.removeEventListener("click", onErase);
    card.removeEventListener("animationend", onAnimationEnd);
  };
}
