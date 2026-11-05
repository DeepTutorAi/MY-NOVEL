// Fills the shelf and the resume card from this reader's progress.
import { chapterKey, EXTRA_LAST_KEY, extraKey, isFinishedRecord, isUnlocked, LAST_KEY, LAST_READ_KEY, parseRecord, reachedChapter } from "../progress-core";
import { loadProgress, loadReadList, safeGet, safeRemove } from "../progress";
import { loadVault } from "../vault";
import { EPILOGUE_NUMBER, PROLOGUE_NUMBER } from "../../../data/kusabi/chapter-label";
import { CHAPTER_UNITS, EXTRA_UNITS } from "../../../data/kusabi/units";
import { withBase } from "../../../utils/base-path";

interface Titles {
  chapters: Record<string, { title: string; act: number; actTitle: string }>;
}

interface SavedPlace {
  chapterId: string;
  chapterNumber: number | string;
  chapterTitle: string;
  progress: number;
  updatedAt?: number;
}

const readJson = (key: string): SavedPlace | null => {
  try {
    const raw = safeGet(key);
    const saved = raw ? JSON.parse(raw) : null;
    return saved && typeof saved.chapterId === "string" && typeof saved.chapterTitle === "string" ? saved : null;
  } catch {
    return null;
  }
};

const labelFor = (number: number | string) => {
  const n = Number(number);
  if (n === PROLOGUE_NUMBER) return "บทนำ";
  if (n === EPILOGUE_NUMBER) return "บทส่งท้าย";
  return `บทที่ ${n}`;
};

function renderResume(chapterBase: string, extraBase: string, signal: AbortSignal) {
  const card = document.querySelector<HTMLElement>("[data-resume]");
  const title = document.querySelector<HTMLElement>("[data-resume-title]");
  const link = document.querySelector<HTMLAnchorElement>("[data-resume-link]");
  const clear = document.querySelector<HTMLButtonElement>("[data-resume-clear]");
  if (!card || !title || !link) return;

  const main = readJson(LAST_KEY);
  const extra = readJson(EXTRA_LAST_KEY);
  const useExtra = extra !== null && (main === null || (extra.updatedAt ?? 0) > (main.updatedAt ?? 0));
  const place = useExtra ? extra : main;
  if (!place) {
    card.hidden = true;
    return;
  }
  const base = useExtra ? extraBase : chapterBase;
  title.textContent = `${useExtra ? `เรื่องเสริม ${place.chapterNumber}` : labelFor(place.chapterNumber)}: ${place.chapterTitle}`;
  if (place.progress >= 0.995) {
    link.textContent = "อ่านอีกครั้ง";
    link.href = `${base}${place.chapterId}/`;
  } else {
    link.textContent = `อ่านต่อ ${Math.max(1, Math.round((place.progress || 0) * 100))}%`;
    link.href = `${base}${place.chapterId}/?resume=1`;
  }
  card.hidden = false;
  clear?.addEventListener(
    "click",
    () => {
      safeRemove(LAST_KEY);
      safeRemove(LAST_READ_KEY);
      safeRemove(EXTRA_LAST_KEY);
      safeRemove(useExtra ? extraKey(place.chapterId) : chapterKey(place.chapterId));
      card.hidden = true;
    },
    { signal },
  );
}

export function setupShelf(): () => void {
  const chapterBase = withBase("/kusabi/chapters/");
  const extraBase = withBase("/kusabi/extra/");
  const abort = new AbortController();
  const timers: number[] = [];

  const run = async () => {
    const progress = await loadProgress();
    if (abort.signal.aborted) return;
    const readList = loadReadList();
    const reached = reachedChapter(progress, readList);
    let current = -1;

    for (const unit of CHAPTER_UNITS) {
      const tape = document.querySelector<HTMLElement>(`[data-tape="${unit.id}"]`);
      if (!tape) continue;
      const record = parseRecord(safeGet(chapterKey(unit.id)));
      const read = readList.includes(unit.id) || isFinishedRecord(record);
      const reading = !read && record !== null && record.maxScrollPct > 0.005;
      tape.dataset.state = read ? "read" : reading ? "reading" : "idle";
      tape.style.setProperty("--tape-progress", String(read ? 1 : (record?.maxScrollPct ?? 0)));
      const stamp = tape.querySelector<HTMLElement>("[data-tape-stamp]");
      if (stamp) stamp.hidden = !read;
      if (reading) current = unit.number;
    }

    const last = safeGet(LAST_READ_KEY);
    if (last) {
      const tape = document.querySelector<HTMLElement>(`[data-tape="${last}"]`);
      if (tape) {
        tape.classList.add("is-recent");
        timers.push(window.setTimeout(() => tape.classList.remove("is-recent"), 2600));
      }
    }
    if (current < 0) current = reached;
    document.querySelector<HTMLElement>(`[data-number="${current}"]`)?.setAttribute("data-state", "current");

    const start = document.querySelector<HTMLAnchorElement>("[data-start]");
    const hasPlace = readJson(LAST_KEY) !== null;
    if (start && hasPlace) start.hidden = true;

    const drawer = document.querySelector<HTMLElement>("[data-drawer]");
    const drawerCopy = document.querySelector<HTMLElement>("[data-drawer-copy]");
    if (drawer && drawerCopy && isUnlocked("extra-e01", progress)) {
      drawer.dataset.open = "true";
      const opened = EXTRA_UNITS.filter((unit) => unit.published && isUnlocked(`extra-${unit.id}`, progress)).length;
      drawerCopy.textContent = `ลิ้นชักล่างเปิดแล้ว ${opened} ม้วน`;
    }

    renderResume(chapterBase, extraBase, abort.signal);

    // Only a reader past the opening asks for the titles at all.
    if (reached < 1 && !progress.bypass) return;
    try {
      const titles = await loadVault<Titles>("titles");
      if (abort.signal.aborted) return;
      for (const unit of CHAPTER_UNITS) {
        const entry = titles.chapters[String(unit.number)];
        if (!entry || unit.number > reached) continue;
        const tape = document.querySelector<HTMLElement>(`[data-tape="${unit.id}"]`);
        const title = tape?.querySelector<HTMLElement>("[data-tape-title]");
        const link = tape?.querySelector<HTMLElement>(".tape-link");
        if (title) title.textContent = entry.title;
        if (link) link.setAttribute("aria-label", `${link.dataset.label}: ${entry.title}`);
      }
      const shelves = new Map<number, string>();
      for (const [number, entry] of Object.entries(titles.chapters)) {
        const n = Number(number);
        if (n >= 1 && n <= 12 && n <= reached && !shelves.has(entry.act)) shelves.set(entry.act, entry.actTitle);
      }
      for (const [act, name] of shelves) {
        const element = document.querySelector<HTMLElement>(`[data-shelf-name="${act}"]`);
        if (element) element.textContent = name;
      }
    } catch (error) {
      // The labels stay blank; the links still work.
      console.warn("[kusabi shelf] titles did not load", error);
    }
  };

  void run();
  return () => {
    abort.abort();
    timers.forEach((timer) => window.clearTimeout(timer));
  };
}
