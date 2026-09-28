// Reading progress for one Sea chapter: saves where the reader is, restores it
// on ?resume=1, and drives the current rail (>=1024px) and the thin progress
// line (<1024px). Ported from the Tsukinomi ReadingProgress component with
// two fixes: blocks are the direct children of .sea-prose only (R2), and
// removing ?resume=1 keeps the ClientRouter's history.state (R1).

export const MIN_TRACKED_PROGRESS = 0.005;
export const COMPLETED_PROGRESS = 0.995;
export const LAST_KEY = "sea:reading:last";
export const chapterKey = (id: string) => `sea:reading:chapter:${id}`;

/** Anchorable blocks of a chapter, in document order. Shared with the drawer. */
export const SEA_BLOCK_SELECTOR = ":scope > :is(p, h2, h3, blockquote, .current-divider)";

const SAVE_INTERVAL_MS = 750;
const EXCERPT_GRAPHEMES = 48;
const REANCHOR_WINDOW = 40;
const RESUME_FALLBACK_MS = 1400;
const MAX_CORRECTIONS = 5;
const HIGHLIGHT_MS = 2600;

export interface SeaChapterProgress {
  v: 2;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  arcNumber: number;
  path: string;
  progress: number;
  blockIndex: number;
  maxBlockIndex: number;
  blockExcerpt: string;
  blockCount: number;
  updatedAt: number;
}

export function readStoredJson(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Progress ratio saved for a chapter, or null. Chapter 00 also accepts the
 * v1 record shape ({ arcId, progress }) left in sea:reading:last by the old
 * arc layout, which only ever published the prologue.
 */
export function readChapterRatio(chapterId: string): number | null {
  const saved = readStoredJson(chapterKey(chapterId));
  if (saved && saved.chapterId === chapterId && Number.isFinite(saved.progress)) {
    return Number(saved.progress);
  }
  if (chapterId === "00") {
    const last = readStoredJson(LAST_KEY);
    if (last && typeof last.chapterId !== "string" && typeof last.arcId === "string" && Number.isFinite(last.progress)) {
      return Number(last.progress);
    }
  }
  return null;
}

type GraphemeSegmenter = { segment(input: string): Iterable<{ segment: string }> };

let segmenter: GraphemeSegmenter | null | undefined;

const getSegmenter = (): GraphemeSegmenter | null => {
  if (segmenter !== undefined) return segmenter;
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale: string, options: object) => GraphemeSegmenter })
    .Segmenter;
  try {
    segmenter = Segmenter ? new Segmenter("th", { granularity: "grapheme" }) : null;
  } catch {
    segmenter = null;
  }
  return segmenter;
};

/** First graphemes of a block, so Thai vowels and tone marks stay on their consonant. */
export function blockExcerpt(element: Element): string {
  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
  const seg = getSegmenter();
  const out: string[] = [];
  if (seg) {
    for (const { segment } of seg.segment(text)) {
      out.push(segment);
      if (out.length >= EXCERPT_GRAPHEMES) break;
    }
    return out.join("");
  }
  return Array.from(text).slice(0, EXCERPT_GRAPHEMES).join("");
}

/**
 * Block a saved position is anchored on: the block itself when it has text,
 * otherwise the next block that does. Current dividers carry no text, so an
 * empty excerpt could never re-anchor after a re-sync shifts the blocks.
 */
export function anchorForBlock(
  index: number,
  count: number,
  excerptAt: (index: number) => string,
): { index: number; excerpt: string } {
  for (let candidate = index; candidate < count; candidate += 1) {
    const excerpt = excerptAt(candidate);
    if (excerpt) return { index: candidate, excerpt };
  }
  return { index, excerpt: "" };
}

/**
 * Index of the block to resume on, or null when the saved anchor no longer
 * matches (the caller then falls back to the saved ratio). A saved index whose
 * block no longer carries the excerpt is searched for within REANCHOR_WINDOW
 * blocks on either side.
 */
export function findAnchoredBlock(
  savedIndex: number,
  savedExcerpt: string,
  count: number,
  excerptAt: (index: number) => string,
): number | null {
  if (!Number.isInteger(savedIndex) || savedIndex < 0 || count === 0) return null;
  const clamped = Math.min(savedIndex, count - 1);
  // Records written before anchoring skipped dividers can hold an empty
  // excerpt; resolve them the same way a save would today.
  if (!savedExcerpt) return anchorForBlock(clamped, count, excerptAt).index;
  if (excerptAt(clamped) === savedExcerpt) return clamped;
  for (let offset = 1; offset <= REANCHOR_WINDOW; offset += 1) {
    for (const candidate of [clamped - offset, clamped + offset]) {
      if (candidate >= 0 && candidate < count && excerptAt(candidate) === savedExcerpt) return candidate;
    }
  }
  return null;
}

const motionAllowed = () =>
  document.documentElement.dataset.seaMotion !== "off" &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function bindReadingProgress(): (() => void) | undefined {
  const article = document.querySelector<HTMLElement>("article.sea-chapter");
  const prose = article?.querySelector<HTMLElement>(".sea-prose");
  const chapterId = article?.dataset.chapterId;
  if (!article || !prose || !chapterId) return undefined;

  const chapterNumber = Number(article.dataset.chapterNumber);
  const chapterTitle = article.dataset.chapterTitle ?? "";
  const arcNumber = Number(article.dataset.arcNumber);
  const blocks = Array.from(prose.querySelectorAll<HTMLElement>(SEA_BLOCK_SELECTOR));
  const excerptAt = (index: number) => blockExcerpt(blocks[index]);
  const orb = document.getElementById("sea-current-orb");
  const percentDisplay = document.getElementById("sea-current-percent");
  const lineFill = document.querySelector<HTMLElement>("[data-sea-progress-line]");

  const stored = readStoredJson(chapterKey(chapterId));
  let maxBlockIndex =
    stored && stored.chapterId === chapterId && Number.isInteger(stored.maxBlockIndex)
      ? Math.min(Number(stored.maxBlockIndex), blocks.length - 1)
      : -1;

  const timers = new Set<number>();
  let frame = 0;
  let lastSavedAt = 0;
  let lastSavedProgress = -1;
  let restoring = false;
  let previousRestoration: ScrollRestoration | null = null;
  let loadListener: (() => void) | null = null;
  let highlighted: HTMLElement | null = null;

  const setTimer = (callback: () => void, ms: number) => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, ms);
    timers.add(timer);
  };

  const getRatio = () => {
    const rect = prose.getBoundingClientRect();
    const scrollable = Math.max(1, rect.height - window.innerHeight);
    return Math.min(Math.max(-rect.top, 0), scrollable) / scrollable;
  };

  // Last block whose top has passed 35% of the viewport. Block tops increase
  // in document order, so a binary search keeps layout reads to O(log n).
  const findCurrentBlockIndex = () => {
    const threshold = window.innerHeight * 0.35;
    let low = 0;
    let high = blocks.length - 1;
    let found = 0;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (blocks[mid].getBoundingClientRect().top <= threshold) {
        found = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return found;
  };

  const publishMaxBlock = () => {
    article.dataset.maxBlock = String(maxBlockIndex);
  };

  // Callers inside a frame pass the ratio they already measured, before any
  // style write, so saving never forces a second layout.
  const save = (force = false, ratio = getRatio()) => {
    if (restoring || blocks.length === 0) return;
    if (!Number.isFinite(ratio) || ratio < MIN_TRACKED_PROGRESS) return;
    const now = Date.now();
    // Reaching the end is written at once; later end-area scrolling is throttled like the rest.
    const completing = ratio >= COMPLETED_PROGRESS && lastSavedProgress < 1;
    if (!force && !completing && now - lastSavedAt < SAVE_INTERVAL_MS) return;
    lastSavedAt = now;

    const blockIndex = findCurrentBlockIndex();
    if (blockIndex > maxBlockIndex) {
      maxBlockIndex = blockIndex;
      publishMaxBlock();
    }
    const anchor = anchorForBlock(blockIndex, blocks.length, excerptAt);
    const record: SeaChapterProgress = {
      v: 2,
      chapterId,
      chapterNumber,
      chapterTitle,
      arcNumber,
      path: window.location.pathname,
      progress: Number((ratio >= COMPLETED_PROGRESS ? 1 : ratio).toFixed(4)),
      blockIndex: anchor.index,
      maxBlockIndex,
      blockExcerpt: anchor.excerpt,
      blockCount: blocks.length,
      updatedAt: now,
    };
    lastSavedProgress = record.progress;
    try {
      const serialized = JSON.stringify(record);
      localStorage.setItem(LAST_KEY, serialized);
      localStorage.setItem(chapterKey(chapterId), serialized);
    } catch {
      // Storage unavailable: progress simply is not remembered.
    }
  };

  const paint = () => {
    frame = 0;
    const ratio = getRatio();
    save(false, ratio);
    const percent = ratio * 100;
    orb?.style.setProperty("--sea-read-y", `${100 - percent}%`);
    if (percentDisplay) percentDisplay.textContent = `${Math.round(percent)}%`;
    if (lineFill) lineFill.style.transform = `scaleX(${ratio})`;
  };

  const requestPaint = () => {
    if (!frame) frame = requestAnimationFrame(paint);
  };

  const onPageHide = () => save(true);

  // --- Resume -------------------------------------------------------------

  const resolveResumeTarget = (): { block: HTMLElement | null; ratio: number | null } => {
    const saved = readStoredJson(chapterKey(chapterId));
    if (saved && saved.chapterId === chapterId) {
      const excerpt = typeof saved.blockExcerpt === "string" ? saved.blockExcerpt : "";
      const index = findAnchoredBlock(Number(saved.blockIndex), excerpt, blocks.length, excerptAt);
      if (index !== null) return { block: blocks[index], ratio: null };
    }
    const ratio = readChapterRatio(chapterId);
    if (ratio !== null && ratio >= MIN_TRACKED_PROGRESS && ratio < COMPLETED_PROGRESS) {
      return { block: null, ratio };
    }
    return { block: null, ratio: null };
  };

  const clearResumeParam = () => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("resume")) return;
    url.searchParams.delete("resume");
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const finishRestore = (repaint = true) => {
    restoring = false;
    if (previousRestoration !== null) {
      try {
        history.scrollRestoration = previousRestoration;
      } catch {
        // Ignore browsers that refuse the change.
      }
      previousRestoration = null;
    }
    if (repaint) requestPaint();
  };

  const startResume = () => {
    const { block, ratio } = resolveResumeTarget();
    clearResumeParam();
    if (!block && ratio === null) return;

    restoring = true;
    if ("scrollRestoration" in history) {
      previousRestoration = history.scrollRestoration;
      try {
        history.scrollRestoration = "manual";
      } catch {
        previousRestoration = null;
      }
    }

    const computeTarget = () => {
      if (block) {
        return Math.max(0, block.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3);
      }
      const rect = prose.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      return top + Math.max(0, rect.height - window.innerHeight) * (ratio ?? 0);
    };

    const highlight = () => {
      if (!block) return;
      highlighted = block;
      block.classList.add("sea-resume-highlight");
      block.classList.toggle("is-static", !motionAllowed());
      setTimer(() => {
        block.classList.remove("sea-resume-highlight", "is-static");
        highlighted = null;
      }, HIGHLIGHT_MS);
    };

    let corrections = 0;
    const settle = () => {
      const desired = computeTarget();
      if (Math.abs(window.scrollY - desired) > 8 && corrections < MAX_CORRECTIONS) {
        corrections += 1;
        window.scrollTo({ top: desired, behavior: "auto" });
        setTimer(settle, 160);
        return;
      }
      finishRestore();
      highlight();
    };

    let started = false;
    const begin = () => {
      if (started) return;
      started = true;
      window.scrollTo({ top: computeTarget(), behavior: "auto" });
      setTimer(settle, 200);
    };

    // Web fonts and late images change block positions; wait for both, but
    // never longer than the fallback.
    setTimer(begin, RESUME_FALLBACK_MS);
    const loaded =
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            loadListener = () => resolve();
            window.addEventListener("load", loadListener, { once: true });
          });
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    Promise.all([loaded, fontsReady]).then(
      () => setTimer(begin, 80),
      () => setTimer(begin, 80),
    );
  };

  publishMaxBlock();
  window.addEventListener("scroll", requestPaint, { passive: true });
  window.addEventListener("resize", requestPaint);
  window.addEventListener("sea:settings-change", requestPaint);
  window.addEventListener("pagehide", onPageHide);

  if (new URLSearchParams(window.location.search).get("resume") === "1") {
    startResume();
  }
  requestPaint();

  return () => {
    // Keep the latest position when leaving through the ClientRouter, where
    // pagehide does not fire.
    save(true);
    window.removeEventListener("scroll", requestPaint);
    window.removeEventListener("resize", requestPaint);
    window.removeEventListener("sea:settings-change", requestPaint);
    window.removeEventListener("pagehide", onPageHide);
    if (loadListener) window.removeEventListener("load", loadListener);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    for (const timer of timers) window.clearTimeout(timer);
    timers.clear();
    highlighted?.classList.remove("sea-resume-highlight", "is-static");
    if (restoring) finishRestore(false);
  };
}
