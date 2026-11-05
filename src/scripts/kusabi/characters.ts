// Opens the character book's locked files. Each tier's JSON is fetched only once
// its chapter is finished; before that the browser never asks for it. The text is
// set with textContent, and the merge of the two Shion cards plays once.
import { chapterKey, extraKey, isUnlocked, parseRecord, parseReadList, type KusabiProgress } from "./progress-core";
import { loadProgress, safeGet, safeSet } from "./progress";
import { loadVault } from "./vault";
import { CHAPTER_UNITS, EXTRA_UNITS } from "../../data/kusabi/units";
import type { UnlockId } from "../../data/kusabi/unlocks";
import { withBase } from "../../utils/base-path";

interface VaultCard {
  id: string;
  name: string;
  role: string;
  note: string;
  image?: string;
  replaces?: string[];
  /** Not one of the empty frames shown to a new reader. */
  extraFrame?: boolean;
}

interface VaultNote {
  card: string;
  text: string;
  pen?: boolean;
  struck?: boolean;
}

interface Tier {
  characters?: { cards?: VaultCard[]; notes?: VaultNote[]; book?: "behaviour" };
}

const SEEN_KEY = "kusabi:secret:seen-files";

/** Vault file and the unlock it waits for, in reading order. */
const TIER_ORDER: Array<[string, UnlockId]> = [
  ["t1", "staff"],
  ["t8", "art-8"],
  ["t10", "mask"],
  ["t11", "voice"],
  ["t12", "shion"],
  ["t13", "ayame"],
  ["e1", "extra-e02"],
  ["e2", "extra-e03"],
];

function buildCard(card: VaultCard, fresh: boolean): HTMLElement {
  const article = document.createElement("article");
  article.className = `entry${fresh ? " is-new" : ""}`;
  article.dataset.card = card.id;

  const photo = document.createElement("div");
  photo.className = "entry-photo";
  if (card.image) {
    const image = new Image(480, 600);
    image.src = withBase(`/assets/kusabi/images/${card.image}`);
    image.alt = `ภาพตัวละคร ${card.name}`;
    image.decoding = "async";
    photo.append(image);
  } else {
    const blank = document.createElement("span");
    blank.className = "entry-photo-blank";
    blank.textContent = "ไม่มีรูปถ่าย";
    photo.append(blank);
  }

  const copy = document.createElement("div");
  copy.className = "entry-copy";
  const name = document.createElement("h2");
  name.className = "entry-name";
  name.textContent = card.name;
  const role = document.createElement("p");
  role.className = "entry-role";
  role.textContent = card.role;
  const note = document.createElement("p");
  note.className = "entry-note";
  note.textContent = card.note;
  const notes = document.createElement("ul");
  notes.className = "entry-notes";
  notes.dataset.cardNotes = "";
  copy.append(name, role, note, notes);

  article.append(photo, copy);
  return article;
}

function addNote(entries: HTMLElement, note: VaultNote): void {
  const list = entries.querySelector<HTMLElement>(`[data-card="${note.card}"] [data-card-notes]`);
  if (!list) return;
  const item = document.createElement("li");
  if (note.struck) {
    item.className = "is-struck";
    item.setAttribute("aria-label", "บรรทัดที่ถูกขีดทับ");
  } else {
    if (note.pen) item.className = "is-pen";
    item.textContent = note.text;
  }
  list.append(item);
}

function totalMinutes(): number {
  let seconds = 0;
  for (const unit of CHAPTER_UNITS) seconds += parseRecord(safeGet(chapterKey(unit.id)))?.activeSeconds ?? 0;
  for (const unit of EXTRA_UNITS) seconds += parseRecord(safeGet(extraKey(unit.id)))?.activeSeconds ?? 0;
  return Math.round(seconds / 60);
}

function enterBehaviourBook(root: HTMLElement): void {
  root.dataset.book = "behaviour";
  const kicker = root.querySelector("[data-book-kicker]");
  const title = root.querySelector("[data-book-title]");
  const lead = root.querySelector("[data-book-lead]");
  if (kicker) kicker.textContent = "Notebook";
  if (title) title.textContent = "สมุดที่จดพวกเขาไว้";
  if (lead) lead.textContent = "ชื่อเรียงเป็นแถว ใต้ชื่อมีคำสั้น ๆ และบางบรรทัดถูกขีดทับ";
  const row = root.querySelector<HTMLElement>("[data-last-row]");
  const rowText = root.querySelector<HTMLElement>("[data-last-row-text]");
  if (row && rowText) {
    rowText.textContent = `อ่านมาแล้ว ${totalMinutes()} นาที`;
    row.hidden = false;
  }
}

async function applyTiers(root: HTMLElement, progress: KusabiProgress, signal: AbortSignal): Promise<void> {
  const entries = root.querySelector<HTMLElement>("[data-entries]");
  if (!entries) return;
  const seen = new Set(parseReadList(safeGet(SEEN_KEY)));
  const firstVisit = safeGet(SEEN_KEY) === null;
  const open = TIER_ORDER.filter(([, unlock]) => isUnlocked(unlock, progress));
  const tiers = await Promise.all(open.map(([file]) => loadVault<Tier>(file)));
  if (signal.aborted) return;

  const frames = () => entries.querySelectorAll<HTMLElement>("[data-locked-frame]");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let pendingMerge: { replaced: HTMLElement[]; card: HTMLElement } | null = null;

  for (const tier of tiers) {
    const data = tier.characters;
    if (!data) continue;
    for (const card of data.cards ?? []) {
      const fresh = !firstVisit && !seen.has(card.id);
      const element = buildCard(card, fresh);
      const replaced = (card.replaces ?? [])
        .map((id) => entries.querySelector<HTMLElement>(`[data-card="${id}"]`))
        .filter((node): node is HTMLElement => node !== null);
      if (replaced.length > 0 && fresh && !reduced) {
        // Played once: both old cards stay a moment, then give way to the new one.
        replaced.forEach((node) => node.classList.add("is-merging"));
        element.hidden = true;
        replaced[0].before(element);
        pendingMerge = { replaced, card: element };
      } else if (replaced.length > 0) {
        replaced[0].before(element);
        replaced.forEach((node) => node.remove());
      } else {
        const frame = frames()[0];
        if (frame && !card.extraFrame) frame.replaceWith(element);
        else if (frame) frame.before(element);
        else entries.append(element);
      }
      seen.add(card.id);
    }
    for (const note of data.notes ?? []) addNote(entries, note);
    if (data.book === "behaviour") enterBehaviourBook(root);
  }

  // Notes for a card that was replaced move with the merge: the old card's notes are not carried over on purpose.
  if (pendingMerge) {
    const { replaced, card } = pendingMerge;
    window.setTimeout(() => {
      if (signal.aborted) return;
      replaced.forEach((node) => node.remove());
      card.hidden = false;
      card.classList.add("is-new");
    }, 1800);
  }

  const hint = root.querySelector<HTMLElement>("[data-book-hint]");
  if (hint) hint.hidden = frames().length === 0;
  safeSet(SEEN_KEY, JSON.stringify([...seen]));
}

export function setupCharacters(): () => void {
  const root = document.querySelector<HTMLElement>(".book");
  const abort = new AbortController();
  if (root) {
    void loadProgress()
      .then((progress) => applyTiers(root, progress, abort.signal))
      .catch((error) => {
        console.warn("[kusabi characters] a tier did not load", error);
        const message = root.querySelector<HTMLElement>("[data-book-error]");
        if (message) message.hidden = false;
      });
  }
  return () => abort.abort();
}
