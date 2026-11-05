// Opens the character book's locked files. Each tier's JSON is fetched only once
// its chapter is finished; before that the browser never asks for it. A tier can
// add a card, rewrite a card's role and bio, fill its rows, and add a dated line.
// The text is set with textContent, and the merge of the two Shion cards plays once.
import { chapterKey, extraKey, isUnlocked, parseRecord, parseReadList, type KusabiProgress } from "./progress-core";
import { loadProgress, safeGet, safeSet } from "./progress";
import { loadVault } from "./vault";
import { CHAPTER_UNITS, EXTRA_UNITS } from "../../data/kusabi/units";
import type { UnlockId } from "../../data/kusabi/unlocks";
import { withBase } from "../../utils/base-path";

interface VaultField {
  label: string;
  value?: string;
}

interface VaultCard {
  id: string;
  name: string;
  role: string;
  note: string;
  image?: string;
  fields?: VaultField[];
  replaces?: string[];
  /** Not one of the empty frames shown to a new reader. */
  extraFrame?: boolean;
}

interface VaultUpdate {
  card: string;
  name?: string;
  role?: string;
  note?: string;
  fields?: VaultField[];
}

interface VaultNote {
  card: string;
  text: string;
  pen?: boolean;
  struck?: boolean;
}

interface Tier {
  characters?: { cards?: VaultCard[]; updates?: VaultUpdate[]; notes?: VaultNote[]; book?: "behaviour" };
}

const SEEN_KEY = "kusabi:secret:seen-files";

/** Vault file and the unlock it waits for, in reading order. */
const TIER_ORDER: Array<[string, UnlockId]> = [
  ["t1", "staff"],
  ["t2", "art-2"],
  ["t3", "art-3"],
  ["t4", "art-4"],
  ["t5", "art-5"],
  ["t6", "art-6"],
  ["t7", "art-7"],
  ["t8", "art-8"],
  ["t9", "art-9"],
  ["t10", "mask"],
  ["t11", "voice"],
  ["t12", "shion"],
  ["t13", "ayame"],
  ["e1", "extra-e02"],
  ["e2", "extra-e03"],
  ["e3", "extra-e04"],
  ["e4", "extra-e05"],
];

/** Where a line in a file was learned, from the name of the vault file it came from. */
function tierLabel(file: string): string {
  const number = Number(file.slice(1));
  if (file.startsWith("e")) return `เรื่องเสริม ${number}`;
  return number === 13 ? "บทส่งท้าย" : `บท ${number}`;
}

function buildField(field: VaultField): HTMLElement {
  const row = document.createElement("div");
  row.className = "entry-field";
  row.dataset.field = field.label;
  const label = document.createElement("dt");
  label.textContent = field.label;
  const value = document.createElement("dd");
  row.append(label, value);
  fillField(row, field.value);
  return row;
}

function fillField(row: HTMLElement, value?: string): void {
  const cell = row.querySelector("dd");
  if (!cell) return;
  if (value) {
    cell.textContent = value;
    cell.removeAttribute("aria-label");
    delete row.dataset.empty;
  } else {
    cell.setAttribute("aria-label", "ยังไม่ได้จด");
    row.dataset.empty = "true";
  }
}

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

  const head = document.createElement("div");
  head.className = "entry-head";
  const name = document.createElement("h2");
  name.className = "entry-name";
  name.textContent = card.name;
  const role = document.createElement("p");
  role.className = "entry-role";
  role.textContent = card.role;
  head.append(name, role);

  const note = document.createElement("p");
  note.className = "entry-note";
  note.textContent = card.note;

  const top = document.createElement("div");
  top.className = "entry-top";
  top.append(photo, head, note);

  const fields = document.createElement("dl");
  fields.className = "entry-fields";
  fields.dataset.cardFields = "";
  fields.append(...(card.fields ?? []).map(buildField));

  const log = document.createElement("details");
  log.className = "entry-log";
  log.dataset.cardLog = "";
  log.hidden = true;
  const summary = document.createElement("summary");
  summary.dataset.logCount = "";
  const notes = document.createElement("ul");
  notes.className = "entry-notes";
  notes.dataset.cardNotes = "";
  log.append(summary, notes);

  article.append(top, fields, log);
  return article;
}

/** Shows each file's dated lines with their count, opened if the reader has not seen them yet. */
function settleLogs(entries: HTMLElement): void {
  entries.querySelectorAll<HTMLDetailsElement>("[data-card-log]").forEach((log) => {
    const count = log.querySelectorAll("li").length;
    log.hidden = count === 0;
    log.open = log.querySelector(".is-fresh") !== null;
    const summary = log.querySelector("[data-log-count]");
    if (summary) summary.textContent = `บันทึกตามบท ${count} บรรทัด`;
  });
}

/** A later tier rewrites what the reader now knows; a label not drawn yet adds a row. */
function applyUpdate(entries: HTMLElement, update: VaultUpdate, fresh: boolean): void {
  const card = entries.querySelector<HTMLElement>(`[data-card="${update.card}"]`);
  if (!card) return;
  const rewrite = (selector: string, text?: string) => {
    const node = card.querySelector<HTMLElement>(selector);
    if (!node || !text) return;
    node.textContent = text;
    node.classList.toggle("is-fresh", fresh);
  };
  rewrite(".entry-name", update.name);
  rewrite(".entry-role", update.role);
  rewrite(".entry-note", update.note);

  const list = card.querySelector<HTMLElement>("[data-card-fields]");
  if (!list) return;
  for (const field of update.fields ?? []) {
    const rows = Array.from(list.querySelectorAll<HTMLElement>(".entry-field"));
    let row = rows.find((candidate) => candidate.dataset.field === field.label);
    if (row) fillField(row, field.value);
    else {
      row = buildField(field);
      list.append(row);
    }
    row.classList.toggle("is-fresh", fresh);
  }
}

function addNote(entries: HTMLElement, note: VaultNote, where: string, fresh: boolean): void {
  const list = entries.querySelector<HTMLElement>(`[data-card="${note.card}"] [data-card-notes]`);
  if (!list) return;
  const item = document.createElement("li");
  if (fresh) item.classList.add("is-fresh");
  const label = document.createElement("span");
  label.className = "entry-where";
  label.textContent = where;
  const text = document.createElement("span");
  if (note.struck) {
    text.className = "entry-struck";
    text.setAttribute("aria-label", "บรรทัดที่ถูกขีดทับ");
  } else {
    if (note.pen) text.className = "entry-pen";
    text.textContent = note.text;
  }
  item.append(label, text);
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
  const tiers = await Promise.all(open.map(async ([file]) => ({ file, tier: await loadVault<Tier>(file) })));
  if (signal.aborted) return;

  const frames = () => entries.querySelectorAll<HTMLElement>("[data-locked-frame]");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let pendingMerge: { replaced: HTMLElement[]; card: HTMLElement } | null = null;

  for (const { file, tier } of tiers) {
    const data = tier.characters;
    if (!data) continue;
    // Lit once, the first time a returning reader sees what this chapter added.
    const freshTier = !firstVisit && !seen.has(`tier:${file}`);
    seen.add(`tier:${file}`);
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
    for (const update of data.updates ?? []) applyUpdate(entries, update, freshTier);
    for (const note of data.notes ?? []) addNote(entries, note, tierLabel(file), freshTier);
    if (data.book === "behaviour") enterBehaviourBook(root);
  }

  settleLogs(entries);

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
