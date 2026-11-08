// The character page: a route of stops. A new reader sees the narrator and closed
// stops. Each finished chapter opens its vault file, which may add a person, change
// what the reader now knows about one, or add a line to their log. Nothing of a chapter
// the reader has not finished is in the page source or in the network log.
import type { LaterEntry, PersonCard, PersonRow, VaultTier } from "../../data/tsukinomi/characters";
import { hasActiveDevBypass } from "../_shared/dev-key";
import { withBase } from "../../utils/base-path";
import { startMoonsea } from "./home/moonsea-loader";
import {
  BYPASS_KEY,
  SEEN_CHAPTER_KEY,
  SECRET_READS_KEY,
  STOP_CHAPTERS,
  TOTAL_CHAPTERS,
  TOTAL_SECTIONS,
  bypassMatches,
  chaptersDone,
  maxSectionRead,
  parseSecretReads,
} from "./station-gates";

const PROFILE_KEY = "piichan-novels:active-profile-id";
const art = (stem: string) => withBase(`/assets/tsukinomi/images/platform/${stem}.webp`);

const safeGet = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Restricted storage: only the "new" marks are lost.
  }
};

const storedKeys = (): string[] => {
  try {
    return Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index) ?? "");
  } catch {
    return [];
  }
};

async function fetchVault<T>(file: string): Promise<T> {
  const response = await fetch(withBase(`/tsukinomi/vault/${file}.json`));
  if (!response.ok) throw new Error(`vault ${file}: ${response.status}`);
  return (await response.json()) as T;
}

const setField = (card: HTMLElement, field: string, text: string) => {
  const node = card.querySelector<HTMLElement>(`[data-field="${field}"]`);
  if (node) node.textContent = text;
};

const portraitOf = (card: HTMLElement) => card.querySelector<HTMLImageElement>("[data-portrait]");

/** Changes a row by its label, or adds it if the card does not have it yet. An empty value hides the row. */
function setRow(card: HTMLElement, { label, value }: PersonRow): HTMLElement | null {
  const list = card.querySelector<HTMLElement>("[data-rows]");
  if (!list) return null;
  let row = Array.from(list.querySelectorAll<HTMLElement>("[data-row]")).find((candidate) => candidate.dataset.row === label);
  if (!row) {
    row = document.createElement("div");
    row.className = "pf-row";
    row.dataset.row = label;
    const term = document.createElement("dt");
    term.textContent = label;
    row.append(term, document.createElement("dd"));
    list.append(row);
  }
  const definition = row.querySelector("dd");
  if (definition) definition.textContent = value;
  row.hidden = value === "";
  return row;
}

function addNote(card: HTMLElement, chapter: number, text: string, fresh: boolean) {
  const item = document.createElement("li");
  item.className = "pf-note";
  item.classList.toggle("is-fresh", fresh);
  const where = document.createElement("span");
  where.className = "pf-note-where";
  where.textContent = `บทที่ ${chapter}`;
  const body = document.createElement("span");
  body.textContent = text;
  item.append(where, body);
  card.querySelector("[data-log]")?.append(item);
}

function buildCard(template: HTMLTemplateElement, person: PersonCard, number: string): HTMLElement {
  const card = template.content.firstElementChild?.cloneNode(true) as HTMLElement;
  card.dataset.card = person.id;
  setField(card, "number", number);
  setField(card, "kanji", person.kanji);
  setField(card, "name", person.name);
  setField(card, "romaji", person.romaji);
  setField(card, "role", person.role);
  for (const row of person.rows) setRow(card, row);
  const portrait = portraitOf(card);
  if (portrait) {
    portrait.src = art(person.art);
    portrait.alt = `ภาพตัวละคร ${person.name}`;
  }
  if (person.faces) {
    card.querySelectorAll<HTMLButtonElement>(".pf-face").forEach((button, index) => {
      const src = art(`${person.art}-face-${index + 1}`);
      button.dataset.face = src;
      const image = button.querySelector("img");
      if (image) image.src = src;
    });
  } else {
    card.querySelector("[data-faces]")?.remove();
  }
  return card;
}

export function setupPlatform(): () => void {
  const root = document.querySelector<HTMLElement>("[data-platform]");
  const route = root?.querySelector<HTMLElement>("[data-route]");
  const template = root?.querySelector<HTMLTemplateElement>("[data-card-template]");
  if (!root || !route || !template) return () => {};
  const abort = new AbortController();
  const { signal } = abort;
  let sky: { setSnow(snow: boolean): void } | null = null;

  const cardOf = (id: string) => route.querySelector<HTMLElement>(`[data-card="${id}"]`);

  const showError = (caught: unknown) => {
    console.warn("[tsukinomi characters] part of the route did not load", caught);
    const message = root.querySelector<HTMLElement>("[data-platform-error]");
    if (message) message.hidden = false;
  };

  route.addEventListener(
    "click",
    (event) => {
      const face = (event.target as Element).closest<HTMLButtonElement>("[data-face]");
      const card = face?.closest<HTMLElement>("[data-card]");
      const portrait = card && portraitOf(card);
      if (!face || !card || !portrait) return;
      const pressed = face.getAttribute("aria-pressed") === "true";
      for (const other of card.querySelectorAll("[data-face]")) other.setAttribute("aria-pressed", "false");
      face.setAttribute("aria-pressed", pressed ? "false" : "true");
      portrait.dataset.home ??= portrait.src;
      portrait.src = pressed ? portrait.dataset.home : (face.dataset.face ?? portrait.dataset.home);
    },
    { signal },
  );

  /** Opens every chapter up to the one the reader has finished, in reading order. */
  const applyChapters = async (done: number) => {
    const tiers = await Promise.all(Array.from({ length: done }, (_, index) => fetchVault<VaultTier>(`c${index + 1}`)));
    if (signal.aborted) return;
    const seenRaw = safeGet(SEEN_CHAPTER_KEY);
    const seen = seenRaw === null ? done : Number(seenRaw) || 0;

    tiers.forEach((tier, index) => {
      const chapter = index + 1;
      const fresh = chapter > seen;
      for (const person of tier.cards ?? []) {
        const stop = route.querySelector<HTMLElement>("[data-stop]");
        const card = buildCard(template, person, stop?.querySelector("[data-stop-number]")?.textContent ?? "");
        card.classList.toggle("is-new", fresh);
        if (stop) stop.replaceWith(card);
        else route.append(card);
      }
      for (const update of tier.updates ?? []) {
        const card = cardOf(update.id);
        if (!card) continue;
        if (update.role) setField(card, "role", update.role);
        for (const row of update.rows ?? []) setRow(card, row)?.classList.toggle("is-fresh", fresh);
      }
      for (const note of tier.notes ?? []) {
        const card = cardOf(note.id);
        if (card) addNote(card, chapter, note.text, fresh);
      }
    });
    safeSet(SEEN_CHAPTER_KEY, String(done));
  };

  // ---- ten years on -------------------------------------------------------------------------
  let later: Record<string, LaterEntry> | null = null;
  interface Then {
    role: string;
    portrait: string;
    rows: PersonRow[];
  }
  const then = new Map<string, Then>();

  const setEra = async (era: "then" | "later") => {
    if (era === "later" && !later) {
      const file = await fetchVault<{ people: Record<string, LaterEntry> }>("later");
      if (signal.aborted) return;
      later = file.people;
    }
    if (!later) return;
    root.dataset.era = era;
    for (const button of root.querySelectorAll<HTMLElement>("[data-era-to]")) {
      button.setAttribute("aria-pressed", button.dataset.eraTo === era ? "true" : "false");
    }
    sky?.setSnow(era === "later");

    for (const card of route.querySelectorAll<HTMLElement>("[data-card]")) {
      const id = card.dataset.card ?? "";
      const entry = later[id];
      // Whoever is not in the picture any more leaves the route.
      card.hidden = era === "later" && !entry;
      if (!entry) continue;
      const portrait = portraitOf(card);
      if (!portrait) continue;
      if (!then.has(id)) {
        then.set(id, {
          role: card.querySelector('[data-field="role"]')?.textContent ?? "",
          portrait: portrait.dataset.home ?? portrait.src,
          rows: (entry.rows ?? []).map(({ label }) => ({
            label,
            value: card.querySelector(`[data-row="${label}"] dd`)?.textContent ?? "",
          })),
        });
      }
      const before = then.get(id) as Then;
      const isLater = era === "later";
      setField(card, "role", isLater && entry.role ? entry.role : before.role);
      for (const row of isLater ? (entry.rows ?? []) : before.rows) setRow(card, row);
      delete portrait.dataset.home;
      portrait.src = isLater && entry.art ? art(entry.art) : before.portrait;
      for (const face of card.querySelectorAll("[data-face]")) face.setAttribute("aria-pressed", "false");
      card.dataset.gone = isLater && entry.gone ? "true" : "";
    }
  };

  root.querySelector("[data-era-switch]")?.addEventListener(
    "click",
    (event) => {
      const era = (event.target as Element).closest<HTMLElement>("[data-era-to]")?.dataset.eraTo;
      if (era === "then" || era === "later") void setEra(era).catch(showError);
    },
    { signal },
  );

  // ---- how far the reader has come ------------------------------------------------------------
  let stopSky = () => {};
  const start = async () => {
    const reads = parseSecretReads(safeGet(SECRET_READS_KEY));
    let bypassed = false;
    try {
      bypassed = await hasActiveDevBypass(window.localStorage, BYPASS_KEY);
    } catch {
      bypassed = await bypassMatches(safeGet(BYPASS_KEY));
    }
    const done = bypassed ? TOTAL_CHAPTERS : chaptersDone(safeGet, reads);
    if (signal.aborted) return;
    const furthest = bypassed ? TOTAL_SECTIONS : maxSectionRead(safeGet, storedKeys(), safeGet(PROFILE_KEY) ?? "guest");
    stopSky = startMoonsea({
      mount: root.querySelector<HTMLElement>("[data-moonsea-mount]"),
      furthestRead: furthest > 0 ? furthest : null,
      stage: "open",
      onReady: (scene) => {
        sky = scene;
        if (root.dataset.era === "later") scene.setSnow(true);
      },
    });
    await applyChapters(done);
    if (signal.aborted) return;
    const opened = route.querySelectorAll("[data-card]").length;
    const stats = root.querySelector("[data-route-stats]");
    const reading = done > 0 ? `อ่านจบถึงบทที่ ${done} จาก ${TOTAL_CHAPTERS}` : "ยังไม่ได้เริ่มอ่าน";
    if (stats) stats.textContent = `${reading} · เปิดแล้ว ${opened} จาก ${STOP_CHAPTERS.length + 1} ป้าย`;
    if (done >= TOTAL_CHAPTERS) {
      const eraSwitch = root.querySelector<HTMLElement>("[data-era-switch]");
      if (eraSwitch) eraSwitch.hidden = false;
    }
  };
  void start().catch(showError);

  return () => {
    abort.abort();
    stopSky();
  };
}
