// The reading page: saves progress in the format the hub and home page already
// read, drives the tape counter, and announces what a finished chapter opened.
// Runs through onPage, so one page is tracked once and never under the previous
// chapter's id after a ClientRouter navigation.
import { UNLOCK_NOTICES, type UnlockId } from "../../../data/kusabi/unlocks";
import { withBase } from "../../../utils/base-path";
import {
  chapterKey,
  EXTRA_LAST_KEY,
  extraKey,
  FINISH_SCROLL,
  isUnlocked,
  kusabiDrift,
  LAST_KEY,
  LAST_READ_KEY,
  MIN_ACTIVE_SECONDS,
  NOTICED_KEY,
  parseReadList,
  parseRecord,
  READ_SCROLL,
  READS_KEY,
  unlockedIds,
} from "../progress-core";
import { loadProgress, safeGet, safeSet } from "../progress";
import {
  clockLabel,
  COMPLETED_PROGRESS,
  counterDigits,
  createFastScrollDetector,
  DONT_RUSH_FROM_CHAPTER,
  MIN_TRACKED_PROGRESS,
  reelSizes,
  SAVE_INTERVAL_MS,
  scrollRatio,
  todayStamp,
} from "./reader-core";

export const MARKS_KEY = "kusabi:settings:hidden-marks";
export const MARKS_EVENT = "kusabi:marks-change";
const DONT_RUSH_KEY = "kusabi:secret:dont-rush";
const NOTICE_MS = 12_000;
const NOTICE_RECHECK_MS = 3_000;
const NOTICE_FADE_MS = 300;

export const marksEnabled = () => safeGet(MARKS_KEY) !== "off";

function noticedList(): string[] {
  return parseReadList(safeGet(NOTICED_KEY));
}

let noticeTimer = 0;

function showNotice(text: string, href: string): void {
  const toast = document.querySelector<HTMLElement>("[data-unlock-toast]");
  const label = toast?.querySelector<HTMLElement>("[data-unlock-text]");
  const link = toast?.querySelector<HTMLAnchorElement>("[data-unlock-link]");
  if (!toast || !label || !link) return;
  label.textContent = text;
  link.href = withBase(href);
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  const hide = () => {
    // Someone about to follow the link keeps it for as long as they need.
    if (toast.matches(":hover, :focus-within")) {
      noticeTimer = window.setTimeout(hide, NOTICE_RECHECK_MS);
      return;
    }
    toast.classList.remove("is-visible");
    noticeTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, NOTICE_FADE_MS);
  };
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(hide, NOTICE_MS);
}

async function announceUnlocks(firstLoad: boolean): Promise<void> {
  const progress = await loadProgress();
  const open = unlockedIds(progress);
  const raw = safeGet(NOTICED_KEY);
  // A reader who arrives with progress already saved is not told about the past.
  if (raw === null && firstLoad) {
    safeSet(NOTICED_KEY, JSON.stringify(open));
    return;
  }
  const noticed = new Set(noticedList());
  const fresh = open.filter((id) => !noticed.has(id));
  if (fresh.length === 0) return;
  safeSet(NOTICED_KEY, JSON.stringify([...noticed, ...fresh]));
  const notice = fresh.map((id: UnlockId) => UNLOCK_NOTICES[id]).find(Boolean);
  if (notice) showNotice(notice.text, notice.href);
}

function setupMarks(isExtra: boolean): () => void {
  const rec = document.querySelector<HTMLElement>("[data-drift]");
  const recText = rec?.querySelector<HTMLElement>("[data-drift-text]");
  let level = 0;
  let timer = 0;

  const paint = () => {
    if (!rec || !recText) return;
    const on = marksEnabled() && !isExtra;
    rec.hidden = !on || level === 0 || level === 4;
    rec.dataset.level = String(level);
    if (level === 1) recText.textContent = `REC ${clockLabel(new Date())}`;
    if (level === 2) recText.textContent = `REC CAM 03 ${clockLabel(new Date())}`;
    if (level === 3) recText.textContent = "NO SIGNAL";
  };

  void loadProgress().then((progress) => {
    level = kusabiDrift(progress);
    paint();
    if (level === 1 || level === 2) timer = window.setInterval(paint, 30_000);
  });

  window.addEventListener(MARKS_EVENT, paint);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener(MARKS_EVENT, paint);
  };
}

function setupDontRush(chapterNumber: number, isExtra: boolean): () => void {
  const note = document.querySelector<HTMLElement>("[data-dont-rush]");
  if (!note || (!isExtra && chapterNumber < DONT_RUSH_FROM_CHAPTER)) return () => {};
  const detect = createFastScrollDetector();
  let done = false;
  let hideTimer = 0;
  const onScroll = () => {
    if (done || !marksEnabled()) return;
    if (!detect(window.scrollY, window.innerHeight, performance.now())) return;
    done = true;
    const today = todayStamp(new Date());
    if (safeGet(DONT_RUSH_KEY) === today) return;
    safeSet(DONT_RUSH_KEY, today);
    note.hidden = false;
    requestAnimationFrame(() => note.classList.add("is-visible"));
    hideTimer = window.setTimeout(() => {
      note.classList.remove("is-visible");
      hideTimer = window.setTimeout(() => {
        note.hidden = true;
      }, 500);
    }, 2200);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    window.removeEventListener("scroll", onScroll);
    window.clearTimeout(hideTimer);
  };
}

function setupLightbox(article: HTMLElement): () => void {
  const dialog = document.querySelector<HTMLDialogElement>("[data-lightbox]");
  const big = dialog?.querySelector<HTMLImageElement>("img");
  if (!dialog || !big) return () => {};
  const abort = new AbortController();
  const { signal } = abort;
  for (const image of article.querySelectorAll<HTMLImageElement>("figure.kusabi-figure img")) {
    if (image.closest("button")) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kusabi-figure-zoom";
    button.setAttribute("aria-label", "ขยายภาพ");
    image.replaceWith(button);
    button.append(image);
    button.addEventListener(
      "click",
      () => {
        big.src = image.currentSrc || image.src;
        big.alt = image.alt;
        dialog.showModal();
      },
      { signal },
    );
  }
  dialog.addEventListener(
    "click",
    (event) => {
      if (event.target === dialog || (event.target as HTMLElement).closest("[data-lightbox-close]")) dialog.close();
    },
    { signal },
  );
  return () => {
    abort.abort();
    if (dialog.open) dialog.close();
  };
}

function trackReading(article: HTMLElement): () => void {
  const unitId = article.dataset.unitId ?? "";
  const isExtra = article.dataset.unitKind === "extra";
  const number = Number(article.dataset.chapter ?? 0);
  const title = article.dataset.unitTitle ?? "";
  const recordKey = isExtra ? extraKey(unitId) : chapterKey(unitId);
  const lastKey = isExtra ? EXTRA_LAST_KEY : LAST_KEY;

  const saved = parseRecord(safeGet(recordKey));
  let activeSeconds = saved?.activeSeconds ?? 0;
  let maxScrollPct = saved?.maxScrollPct ?? 0;
  let lastSavedAt = 0;
  let finishedBefore = activeSeconds >= MIN_ACTIVE_SECONDS && maxScrollPct >= FINISH_SCROLL;

  const counter = document.querySelector<HTMLElement>("[data-tape-digits]");
  const deck = document.querySelector<HTMLElement>("[data-tape-deck]");
  const stamp = document.querySelector<HTMLElement>("[data-end-stamp]");
  if (stamp) stamp.hidden = !finishedBefore;

  const save = (ratio: number) => {
    if (!Number.isFinite(ratio) || ratio < MIN_TRACKED_PROGRESS) return;
    const now = Date.now();
    if (now - lastSavedAt < SAVE_INTERVAL_MS && ratio < COMPLETED_PROGRESS) return;
    lastSavedAt = now;
    const record = JSON.stringify({
      chapterId: unitId,
      chapterNumber: number,
      chapterTitle: title,
      path: window.location.pathname,
      progress: Number(ratio.toFixed(4)),
      activeSeconds,
      maxScrollPct: Number(maxScrollPct.toFixed(4)),
      updatedAt: now,
    });
    safeSet(lastKey, record);
    safeSet(recordKey, record);
    if (!isExtra) safeSet(LAST_READ_KEY, unitId);
  };

  const checkThresholds = () => {
    if (activeSeconds < MIN_ACTIVE_SECONDS) return;
    if (!isExtra && maxScrollPct >= READ_SCROLL) {
      const reads = parseReadList(safeGet(READS_KEY));
      if (!reads.includes(unitId)) safeSet(READS_KEY, JSON.stringify([...reads, unitId]));
    }
    if (!finishedBefore && maxScrollPct >= FINISH_SCROLL) {
      finishedBefore = true;
      lastSavedAt = 0;
      save(Math.max(maxScrollPct, FINISH_SCROLL));
      if (stamp) stamp.hidden = false;
      void announceUnlocks(false);
    }
  };

  let frame = 0;
  let currentRatio = 0;
  const paintCounter = () => {
    frame = 0;
    if (counter) counter.textContent = counterDigits(currentRatio);
    if (deck) {
      const sizes = reelSizes(currentRatio);
      deck.style.setProperty("--reel-left", String(sizes.left));
      deck.style.setProperty("--reel-right", String(sizes.right));
      deck.style.setProperty("--reel-turn", `${Math.round(window.scrollY * 0.22)}deg`);
    }
  };

  const onScroll = () => {
    currentRatio = scrollRatio(window.scrollY, document.documentElement.scrollHeight, window.innerHeight);
    if (currentRatio > maxScrollPct) maxScrollPct = currentRatio;
    save(currentRatio);
    checkThresholds();
    if (!frame) frame = requestAnimationFrame(paintCounter);
  };

  let interval = 0;
  const startTimer = () => {
    if (interval) return;
    interval = window.setInterval(() => {
      activeSeconds += 1;
      if (activeSeconds % 10 === 0 || activeSeconds === MIN_ACTIVE_SECONDS) {
        lastSavedAt = 0;
        save(currentRatio);
      }
      checkThresholds();
    }, 1000);
  };
  const stopTimer = () => {
    window.clearInterval(interval);
    interval = 0;
  };
  const onVisibility = () => (document.visibilityState === "hidden" ? stopTimer() : startTimer());

  // ?resume=1 returns to the saved place once the page has its height.
  const timers: number[] = [];
  const params = new URLSearchParams(window.location.search);
  const resume = params.get("resume") === "1" && saved !== null && saved.progress > 0.01 && saved.progress < COMPLETED_PROGRESS;
  if (resume && saved) {
    const target = () => Math.max(0, (document.documentElement.scrollHeight - window.innerHeight) * saved.progress);
    window.scrollTo({ top: target(), behavior: "auto" });
    let tries = 0;
    const correct = () => {
      if (Math.abs(window.scrollY - target()) > 8 && tries < 5) {
        tries += 1;
        window.scrollTo({ top: target(), behavior: "auto" });
        timers.push(window.setTimeout(correct, 160));
      }
    };
    timers.push(window.setTimeout(correct, 200));
  }

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (document.visibilityState !== "hidden") startTimer();
  void announceUnlocks(true);

  const cleanMarks = setupMarks(isExtra);
  const cleanRush = setupDontRush(number, isExtra);
  const cleanLightbox = setupLightbox(article);

  return () => {
    stopTimer();
    cancelAnimationFrame(frame);
    window.clearTimeout(noticeTimer);
    timers.forEach((timer) => window.clearTimeout(timer));
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("scroll", onScroll);
    cleanMarks();
    cleanRush();
    cleanLightbox();
  };
}

/** Extra chapters carry data-gate: nothing is shown or counted until it is open. */
export function setupReader(): (() => void) | undefined {
  const article = document.querySelector<HTMLElement>("article[data-unit-id]");
  if (!article) return undefined;
  const gateId = article.dataset.gate as UnlockId | undefined;
  if (!gateId) return trackReading(article);

  let stopped = false;
  let clean: (() => void) | undefined;
  void loadProgress().then((progress) => {
    if (stopped) return;
    const open = isUnlocked(gateId, progress);
    document.querySelector<HTMLElement>("[data-reader-gate]")?.toggleAttribute("hidden", open);
    document.querySelectorAll<HTMLElement>("[data-gated]").forEach((element) => {
      element.hidden = !open;
    });
    if (open) clean = trackReading(article);
  });
  return () => {
    stopped = true;
    clean?.();
  };
}
