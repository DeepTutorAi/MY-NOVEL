// The Extra room: which tapes are open, the gallery, and the developer shortcut.
// Gallery pictures are requested only after their unlock; a locked frame has no
// image URL at all, so nothing shows in the network log.
import { BYPASS_H2, BYPASS_KEY, extraKey, isFinishedRecord, isUnlocked, parseRecord, sha256Hex, type KusabiProgress } from "./progress-core";
import { loadProgress, safeGet, safeSet } from "./progress";
import { loadVault } from "./vault";
import { CHAPTER_UNITS, EXTRA_UNITS, MAIN_CHAPTER_COUNT } from "../../data/kusabi/units";
import { MOMENT_GROUPS, type UnlockId } from "../../data/kusabi/unlocks";
import { withBase } from "../../utils/base-path";

interface GalleryImage {
  src: string;
  alt: string;
  caption?: string;
}

interface ArtFile {
  art?: GalleryImage[];
  behind?: {
    people: Array<{ name: string; type: string; core: string }>;
    tapes: Array<{ label: string; title: string }>;
  };
}

interface ExtraFile {
  id: string;
  number: number;
  title: string;
  summary?: string;
  dateline?: string;
  minutes?: number;
}

function imageFor(item: GalleryImage): HTMLImageElement {
  const image = new Image();
  image.src = withBase(item.src);
  image.alt = item.alt;
  image.loading = "lazy";
  image.decoding = "async";
  return image;
}

function openFrame(frame: HTMLButtonElement, item: GalleryImage, signal: AbortSignal): void {
  frame.disabled = false;
  frame.setAttribute("aria-label", item.alt ? `ขยายภาพ: ${item.alt}` : "ขยายภาพ");
  frame.querySelector(".frame-label")?.remove();
  frame.replaceChildren(imageFor(item));
  frame.addEventListener(
    "click",
    () => {
      const dialog = document.querySelector<HTMLDialogElement>("[data-lightbox]");
      const big = dialog?.querySelector("img");
      if (!dialog || !big) return;
      big.src = withBase(item.src);
      big.alt = item.alt;
      const caption = dialog.querySelector<HTMLElement>("[data-lightbox-caption]");
      if (caption) {
        caption.textContent = item.caption ?? "";
        caption.hidden = !item.caption;
      }
      dialog.showModal();
    },
    { signal },
  );
}

async function renderExtras(progress: KusabiProgress): Promise<void> {
  const open = isUnlocked("extra-e01", progress);
  const gate = document.querySelector<HTMLElement>("[data-extra-gate]");
  if (gate) gate.hidden = open;
  const count = document.querySelector<HTMLElement>("[data-extra-count]");
  const meter = document.querySelector<HTMLElement>("[data-extra-meter]");
  const read = Math.min(progress.mainRead, MAIN_CHAPTER_COUNT);
  if (count) count.textContent = `อ่านบทหลักแล้ว ${read} จาก ${MAIN_CHAPTER_COUNT} บท`;
  if (meter) meter.style.width = `${Math.round((read / MAIN_CHAPTER_COUNT) * 100)}%`;

  await Promise.all(
    EXTRA_UNITS.map(async (unit) => {
      const row = document.querySelector<HTMLElement>(`[data-extra="${unit.id}"]`);
      if (!row) return;
      const state = row.querySelector<HTMLElement>("[data-extra-state]");
      const unlocked = unit.published && isUnlocked(`extra-${unit.id}` as UnlockId, progress);
      if (!unlocked) {
        if (state) state.textContent = unit.published ? "ยังไม่มีป้าย" : "ยังไม่เปิด";
        return;
      }
      const data = await loadVault<ExtraFile>(`x${unit.number}`);
      row.dataset.open = "true";
      const title = row.querySelector<HTMLElement>("[data-extra-title]");
      if (title) {
        const link = document.createElement("a");
        link.href = withBase(`/kusabi/extra/${data.id}/`);
        link.textContent = data.title;
        title.replaceChildren(link);
      }
      const finished = isFinishedRecord(parseRecord(safeGet(extraKey(unit.id))));
      if (state) state.textContent = finished ? "ฟังแล้ว" : `${data.minutes ?? ""} นาที`;
      if (data.summary) {
        const summary = document.createElement("p");
        summary.className = "extra-summary";
        summary.textContent = data.summary;
        row.append(summary);
      }
    }),
  );
}

async function renderGallery(progress: KusabiProgress, signal: AbortSignal): Promise<void> {
  const gallery = document.querySelector<HTMLElement>("[data-gallery]");
  if (!gallery) return;
  if (isUnlocked("voice", progress)) gallery.dataset.crt = "true";

  const fill = async (selector: string, file: string) => {
    const frames = gallery.querySelectorAll<HTMLButtonElement>(selector);
    if (frames.length === 0) return;
    const data = await loadVault<ArtFile>(file);
    data.art?.forEach((item, index) => {
      if (frames[index]) openFrame(frames[index], item, signal);
    });
  };

  await Promise.all([
    ...CHAPTER_UNITS.filter((unit) => isUnlocked(`art-${unit.number}` as UnlockId, progress)).map((unit) => fill(`[data-frame="t${unit.number}"]`, `t${unit.number}`)),
    ...MOMENT_GROUPS.filter((group) => isUnlocked(group.unlock, progress)).map((group) => fill(`[data-moment="${group.file}"]`, group.file)),
  ]);
}

async function renderBehind(progress: KusabiProgress): Promise<void> {
  if (!isUnlocked("ayame", progress)) return;
  const section = document.querySelector<HTMLElement>("[data-behind]");
  const people = document.querySelector<HTMLElement>("[data-behind-people]");
  const tapes = document.querySelector<HTMLElement>("[data-behind-tapes]");
  const data = await loadVault<ArtFile>("t13");
  if (!section || !people || !tapes || !data.behind) return;
  people.replaceChildren(
    ...data.behind.people.map((person) => {
      const row = document.createElement("div");
      row.className = "behind-row";
      for (const text of [person.name, person.type, person.core]) {
        const cell = document.createElement("span");
        cell.textContent = text;
        row.append(cell);
      }
      return row;
    }),
  );
  tapes.replaceChildren(
    ...data.behind.tapes.map((tape) => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = tape.label;
      item.append(label, tape.title);
      return item;
    }),
  );
  section.hidden = false;
}

export function setupExtraRoom(): () => void {
  const abort = new AbortController();
  const { signal } = abort;

  const render = async () => {
    const progress = await loadProgress();
    if (signal.aborted) return;
    await Promise.all([renderExtras(progress), renderGallery(progress, signal), renderBehind(progress)]);
  };

  const input = document.querySelector<HTMLInputElement>("[data-bypass-input]");
  const button = document.querySelector<HTMLButtonElement>("[data-bypass-btn]");
  const error = document.querySelector<HTMLElement>("[data-bypass-error]");
  const submit = async () => {
    const password = input?.value.trim();
    if (!password) return;
    const h1 = await sha256Hex(password);
    const ok = (await sha256Hex(h1)) === BYPASS_H2;
    if (error) error.hidden = ok;
    if (!ok) return;
    safeSet(BYPASS_KEY, h1);
    await render();
  };
  button?.addEventListener("click", () => void submit(), { signal });
  input?.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") void submit();
    },
    { signal },
  );

  const dialog = document.querySelector<HTMLDialogElement>("[data-lightbox]");
  dialog?.addEventListener(
    "click",
    (event) => {
      if (event.target === dialog || (event.target as HTMLElement).closest("[data-lightbox-close]")) dialog.close();
    },
    { signal },
  );

  void render().catch((caught) => console.warn("[kusabi extra] a file did not load", caught));
  return () => {
    abort.abort();
    if (dialog?.open) dialog.close();
  };
}
