// DOM probe for the hub page model (spec 2.10). Measures the page into a
// PageMeasure, builds the snapshot with page-model-core and keeps it fresh from
// observers. One instance per hub body, shared by chrome and the scene kit.
// Cards are read from their title and state lines only, never from the kicker.

import { emit, on } from "./bus";
import {
  buildSnapshot,
  cardAt as coreCardAt,
  holeDistance as coreHoleDistance,
  isCovered as coreIsCovered,
  toViewport as coreToViewport,
  zoneAt as coreZoneAt,
} from "./page-model-core";
import type { CardInfo, CardKind, HitWindowName, PageMeasure, PageModel, PageParts, PageSnapshot, Rect, WindowName } from "./types";

const DEBOUNCE_MS = 100;
const OPEN_STATUS = "เผยแพร่";
const ZERO: Rect = { x: 0, y: 0, w: 0, h: 0 };
const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };
const WINDOWS: readonly WindowName[] = ["stage", "mid", "ground"];
/** Custom properties written by the runtime at frame rate; changes to them never move layout. */
const CUSTOM_PROPS = /--[\w-]+\s*:[^;]*;?/g;

const round = (v: number) => Math.round(v * 2) / 2;

function docRect(el: Element | null): Rect | undefined {
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return undefined;
  return { x: round(r.left + window.scrollX), y: round(r.top + window.scrollY), w: round(r.width), h: round(r.height) };
}

function readFractions(el: Element | null, prefix: HitWindowName): Rect {
  if (!el) return FULL;
  const style = getComputedStyle(el);
  const read = (name: string, fallback: number) => {
    const v = Number.parseFloat(style.getPropertyValue(`--${prefix}-hit-${name}`));
    return Number.isFinite(v) ? v : fallback;
  };
  return { x: read("x", 0), y: read("y", 0), w: read("w", 1), h: read("h", 1) };
}

function measureCards(shell: Element): CardInfo[] {
  const cards: CardInfo[] = [];
  for (const wrapper of shell.querySelectorAll<HTMLElement>(".novel-card-wrapper")) {
    const rect = docRect(wrapper);
    const upcoming = wrapper.dataset.upcomingSlug;
    const slug = wrapper.dataset.novelSlug ?? upcoming;
    if (!rect || !slug) continue;
    const kind: CardKind = upcoming !== undefined ? "upcoming" : wrapper.dataset.status === OPEN_STATUS ? "open" : "locked";
    const card = wrapper.querySelector<HTMLElement>(".novel-card");
    const read = Number.parseFloat(wrapper.style.getPropertyValue("--card-read"));
    const state = wrapper.querySelector(".novel-card-state") ?? wrapper.querySelector(".novel-card-action");
    cards.push({
      slug,
      kind,
      index: cards.length,
      accent: card?.style.getPropertyValue("--novel-accent").trim() ?? "",
      rect,
      media: docRect(wrapper.querySelector(".novel-card-media")) ?? rect,
      body: docRect(wrapper.querySelector(".novel-card-body")) ?? rect,
      read: Number.isFinite(read) ? read : null,
      finished: wrapper.hasAttribute("data-card-finished"),
      stateText: state?.textContent?.trim() ?? "",
      titleTh: wrapper.querySelector(".novel-card-title")?.textContent?.trim() ?? "",
    });
  }
  return cards;
}

function measure(shell: HTMLElement): { measure: PageMeasure; observed: Element[] } {
  const q = (selector: string) => shell.querySelector(selector);
  const box = shell.getBoundingClientRect();
  const style = getComputedStyle(shell);
  const padLeft = Number.parseFloat(style.paddingLeft) || 0;
  const padRight = Number.parseFloat(style.paddingRight) || 0;
  // Horizontally the content box (where the cards sit), vertically the whole shell.
  const shellRect: Rect = {
    x: round(box.left + window.scrollX + padLeft),
    y: round(box.top + window.scrollY),
    w: round(box.width - padLeft - padRight),
    h: round(box.height),
  };

  const windowEls = Object.fromEntries(WINDOWS.map((name) => [name, q(`[data-hub-window="${name}"]`)])) as Record<WindowName, Element | null>;
  const resumeEl = q("[data-hub-resume]");
  const startEl = q("[data-hub-start]");
  const chipEl = q("[data-profile-widget]");
  const pickerEl = q(".hub-topbar [data-hub-picker-open]");
  const sideNoteEl = q(".hub-side-note");
  const titleEl = q(".hub-hero h1");
  const libraryHeadEl = q(".hub-library-head");
  const footerEl = q(".hub-footer");

  const parts: PageParts = {
    chip: docRect(chipEl),
    picker: docRect(pickerEl),
    title: docRect(titleEl) ?? ZERO,
    sideNote: docRect(sideNoteEl),
    resume: docRect(resumeEl),
    start: docRect(startEl),
    libraryHead: docRect(libraryHeadEl) ?? ZERO,
    footer: docRect(footerEl) ?? ZERO,
  };
  const windows = {
    stage: docRect(windowEls.stage) ?? ZERO,
    mid: docRect(windowEls.mid) ?? ZERO,
    ground: docRect(windowEls.ground) ?? ZERO,
  };
  const hitFractions = {
    stage: readFractions(windowEls.stage, "stage"),
    mid: readFractions(windowEls.mid, "mid"),
  };

  const holeEls = [
    titleEl,
    q(".hub-title-group > p"),
    q(".hub-kicker"),
    sideNoteEl,
    chipEl,
    ...shell.querySelectorAll("[data-hub-picker-open]"),
    resumeEl,
    startEl,
    libraryHeadEl,
    q(".hub-window-label"),
    ...(footerEl ? [...footerEl.children].filter((el) => !el.matches("[data-hub-window]")) : []),
  ];
  const holes = holeEls.map(docRect).filter((r): r is Rect => r !== undefined);

  const cards = measureCards(shell);
  const cover = [...cards.map((c) => c.rect), parts.resume, parts.start, parts.chip, parts.sideNote, parts.picker].filter(
    (r): r is Rect => r !== undefined,
  );

  const modalOpen = document.querySelector('.hub-modal-overlay[role="dialog"][data-open]') !== null;

  const observed = [
    shell,
    ...shell.querySelectorAll(".novel-card-wrapper"),
    ...Object.values(windowEls),
    ...holeEls,
    footerEl,
  ].filter((el): el is Element => el !== null);

  return {
    measure: {
      viewport: {
        w: window.innerWidth,
        h: window.innerHeight,
        coarse: window.matchMedia("(pointer: coarse)").matches,
        dpr: window.devicePixelRatio || 1,
      },
      shell: shellRect,
      parts,
      windows,
      hitFractions,
      cards,
      holes,
      cover,
      modalOpen,
    },
    observed,
  };
}

const EMPTY_MEASURE: PageMeasure = {
  viewport: { w: 0, h: 0, coarse: false, dpr: 1 },
  shell: ZERO,
  parts: { title: ZERO, libraryHead: ZERO, footer: ZERO },
  windows: { stage: ZERO, mid: ZERO, ground: ZERO },
  hitFractions: { stage: FULL, mid: FULL },
  cards: [],
  holes: [],
  cover: [],
  modalOpen: false,
};

/** True when a mutation can change layout: not a runtime node, not a custom-property-only style write. */
function relevant(m: MutationRecord): boolean {
  const target = m.target as Element;
  if (m.type === "childList") {
    const nodes = [...m.addedNodes, ...m.removedNodes];
    return nodes.some((n) => !(n instanceof Element && n.matches("[data-hub-runtime]")));
  }
  if (target.closest?.("[data-hub-runtime]")) return false;
  if (m.attributeName === "style") {
    const before = (m.oldValue ?? "").replace(CUSTOM_PROPS, "").trim();
    const after = (target.getAttribute("style") ?? "").replace(CUSTOM_PROPS, "").trim();
    return before !== after;
  }
  return true;
}

function createDomPageModel(body: HTMLElement): PageModel {
  let snapshot: PageSnapshot | null = null;
  let signature = "";
  let version = 0;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let frame = 0;
  let observed: Element[] = [];
  const subscribers = new Set<(s: PageSnapshot) => void>();

  const resizeObserver = new ResizeObserver(() => schedule());
  const mutationObserver = new MutationObserver((records) => {
    if (records.some(relevant)) schedule();
  });

  const observe = (elements: Element[]) => {
    if (elements.length === observed.length && elements.every((el, i) => el === observed[i])) return;
    observed = elements;
    resizeObserver.disconnect();
    for (const el of elements) resizeObserver.observe(el);
  };

  const read = (): PageSnapshot => {
    const shell = body.querySelector<HTMLElement>(".hub-shell");
    let next: PageMeasure = EMPTY_MEASURE;
    if (shell) {
      const result = measure(shell);
      next = result.measure;
      if (!disposed) observe([...new Set(result.observed)]);
    }
    const nextSignature = JSON.stringify(next);
    if (snapshot && nextSignature === signature) return snapshot;
    signature = nextSignature;
    version++;
    snapshot = buildSnapshot(next, version);
    if (!disposed && version > 1) {
      const current = snapshot;
      for (const fn of [...subscribers]) fn(current);
      emit("hub:layout", { version });
    }
    return snapshot;
  };

  const schedule = () => {
    if (disposed) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!disposed) read();
      });
    }, DEBOUNCE_MS);
  };

  const onResize = () => schedule();
  window.addEventListener("resize", onResize);
  // toViewport runs at frame rate (card writes); window.scrollY there would force a style update
  // after every root write. Scroll events run before animation frames, so this stays current.
  let scrollY = window.scrollY;
  const onScroll = () => {
    scrollY = window.scrollY;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  const offReading = on("hub:reading", schedule);
  const offModal = on("hub:modal", schedule);
  document.fonts?.ready.then(schedule, () => {});
  const shell = body.querySelector(".hub-shell");
  if (shell) {
    mutationObserver.observe(shell, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ["hidden", "class", "style"],
    });
  }

  const model: PageModel = {
    getSnapshot: () => snapshot ?? read(),
    refresh: () => read(),
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    zoneAt: (x, yDoc) => coreZoneAt(model.getSnapshot(), x, yDoc),
    cardAt: (x, yDoc) => coreCardAt(model.getSnapshot(), x, yDoc),
    isCovered: (x, yDoc, pad) => coreIsCovered(model.getSnapshot(), x, yDoc, pad),
    holeDistance: (x, yDoc) => coreHoleDistance(model.getSnapshot(), x, yDoc),
    toViewport: (rect, y = scrollY) => coreToViewport(rect, y),
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      offReading();
      offModal();
      subscribers.clear();
      if (current?.model === model) current = null;
    },
  };
  return model;
}

let current: { body: HTMLElement; model: PageModel } | null = null;

/** The page model of the current hub body; a new body (soft navigation) disposes the old model. */
export function getPageModel(): PageModel {
  const body = document.body;
  if (current?.body === body) return current.model;
  current?.model.dispose();
  const model = createDomPageModel(body);
  current = { body, model };
  return model;
}

export function disposePageModel(): void {
  current?.model.dispose();
  current = null;
}
