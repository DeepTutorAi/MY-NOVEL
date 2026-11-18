// The page side of the scene output (spec 2.9, 2.17, 8.5 item 1), loaded lazily by
// chrome.ts on the first hub:out-* event or when the page is idle: perches on card
// wrappers and the chip, the world label, focusCard requests and the guide creature.
// Every node created here is marked [data-hub-runtime], so the page model ignores it.

import { last, on } from "./bus";
import { disposeAll, isStill, listen, wrappersBySlug, type Off } from "./chrome-dom";
import { flightPath, spotOnEdge } from "./chrome-place";
import type { CardInfo, HubEventMap, PageModel, Rect } from "./types";

export type OutName = "hub:out-perch" | "hub:out-unperch" | "hub:out-label" | "hub:out-focus";
export type OutRecord = { [K in OutName]: [K, HubEventMap[K]] }[OutName];

const MAX_PERCHES = 3;
const CLEAR_PX = 16;
const GUIDE_PX = 36;
const DWELL_MS = 600;
const RETURN_MS = 3000;
const FLIGHT_GAP_MS = 1200;
const CHOSEN_MS = 8000;
const PRESS_HIDE_MS = 2000;

/** Text and controls a perch or the guide keeps clear of (spec 2.10 holes, read from the DOM). */
const HOLES =
  "h1, h2, p, small, a:not(.novel-card), button, input, .novel-card-title, .novel-card-subtitle, .novel-card-meta, .novel-card-footer, .upcoming-seal, .profile-name, .profile-icon";

const STATE_LOCKED_TH = "ยังไม่เปิดให้อ่าน";
const STATE_UPCOMING_TH = "เร็วๆ นี้";
const STATE_UNREAD_TH = "ยังไม่ได้เริ่มอ่าน";
const ACTION_TH = "เข้าสู่เรื่อง";

const viewRect = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

/** Visible hole rects (viewport px) whose vertical extent meets [top, bottom]. */
function holesNear(top: number, bottom: number): Rect[] {
  const shell = document.querySelector(".hub-shell");
  if (!shell) return [];
  const rects: Rect[] = [];
  for (const el of shell.querySelectorAll(HOLES)) {
    if (el.closest("[data-hub-runtime], [data-hub-guide]")) continue;
    const r = viewRect(el);
    if (r.w > 2 && r.h > 2 && r.y < bottom && r.y + r.h > top) rects.push(r);
  }
  return rects;
}

/** The state half of a world label (spec 6): the card's own state line, or a default. */
export function stateLine(card: Pick<CardInfo, "kind" | "stateText">): string {
  if (card.kind === "locked") return STATE_LOCKED_TH;
  if (card.kind === "upcoming") return STATE_UPCOMING_TH;
  const text = card.stateText.trim();
  return text && text !== ACTION_TH ? text : STATE_UNREAD_TH;
}

const isTyping = (el: Element | null) =>
  el instanceof HTMLElement && (el.isContentEditable || el.matches("input, textarea, select"));

const modalOpen = () => document.querySelector('.hub-modal-overlay[role="dialog"][data-open]') !== null;

function setupPerches(): { handle(record: OutRecord): boolean; dispose(): void } {
  const perches = new Map<number, HTMLElement>();
  return {
    handle([name, detail]) {
      if (name === "hub:out-unperch") {
        perches.get(detail.id)?.remove();
        perches.delete(detail.id);
        return true;
      }
      if (name !== "hub:out-perch") return false;
      if (perches.has(detail.id) || perches.size >= MAX_PERCHES) return true;
      const host =
        detail.target === "chip" ? document.querySelector<HTMLElement>("[data-profile-widget]") : wrappersBySlug().get(detail.target);
      if (!host) return true;
      const box = viewRect(host);
      if (box.w <= 0 || box.h <= 0) return true;
      const el = document.createElement("span");
      el.className = "hub-perch";
      el.dataset.hubRuntime = "";
      el.dataset.perchKind = detail.kind;
      el.setAttribute("aria-hidden", "true");
      host.append(el);
      const size = { w: el.offsetWidth || 28, h: el.offsetHeight || 18 };
      const spot = spotOnEdge({ x: box.x, y: box.y, w: box.w, h: 0 }, size, holesNear(box.y - size.h - CLEAR_PX, box.y + CLEAR_PX + 4), detail.u, {
        clear: CLEAR_PX,
        maxOverlap: 4,
        margin: 8,
        step: 6,
      });
      el.style.left = `${Math.round(spot.x - box.x)}px`;
      el.style.bottom = `calc(100% - ${Math.round(spot.y + size.h - box.y)}px)`;
      perches.set(detail.id, el);
      return true;
    },
    dispose() {
      for (const el of perches.values()) el.remove();
      perches.clear();
    },
  };
}

function setupLabel(page: PageModel): { handle(record: OutRecord): boolean; dispose(): void } {
  let el: HTMLElement | null = null;
  let timer = 0;
  const hide = () => {
    window.clearTimeout(timer);
    el?.removeAttribute("data-shown");
  };
  const offs = [on("hub:press", hide), on("hub:modal", (detail) => detail.open && hide())];
  return {
    handle([name, detail]) {
      if (name !== "hub:out-label") return false;
      const shell = document.querySelector<HTMLElement>(".hub-shell");
      const card = page.getSnapshot().cards.find((info) => info.slug === detail.slug);
      if (!shell || !card || !card.titleTh) return true;
      if (!el?.isConnected) {
        el = document.createElement("div");
        el.className = "hub-world-label";
        el.dataset.hubRuntime = "";
        el.setAttribute("aria-hidden", "true");
        shell.append(el);
      }
      el.textContent = `${card.titleTh} · ${stateLine(card)}`;
      el.dataset.plane = detail.plane;
      // Anchor in viewport px: the sky is the viewport, a window plane starts at its canvas.
      let ax = detail.x;
      let ay = detail.y;
      if (detail.plane !== "sky") {
        const canvas = document.querySelector(`[data-hub-window="${detail.plane}"] canvas[data-hub-window-canvas]`);
        if (!canvas) return true;
        const c = viewRect(canvas);
        ax += c.x;
        ay += c.y;
      }
      const half = el.offsetWidth / 2 + 8;
      ax = Math.min(Math.max(ax, half), Math.max(half, window.innerWidth - half));
      ay = Math.max(ay, el.offsetHeight + 18);
      const origin = detail.plane === "sky" ? { x: 0, y: 0 } : viewRect(shell);
      el.style.left = `${Math.round(ax - origin.x)}px`;
      el.style.top = `${Math.round(ay - origin.y)}px`;
      el.setAttribute("data-shown", "");
      window.clearTimeout(timer);
      timer = window.setTimeout(hide, Math.max(0, detail.ms));
      return true;
    },
    dispose() {
      disposeAll(offs);
      window.clearTimeout(timer);
      el?.remove();
      el = null;
    },
  };
}

/** focusCard (spec 2.9): scroll only when the card is out of view, never take focus from typing. */
function focusCard(slug: string): void {
  if (modalOpen() || isTyping(document.activeElement)) return;
  const wrapper = wrappersBySlug().get(slug);
  if (!wrapper) return;
  const r = wrapper.getBoundingClientRect();
  const inView = r.height <= window.innerHeight ? r.top >= 0 && r.bottom <= window.innerHeight : r.top >= 0 && r.top < window.innerHeight / 2;
  if (!inView) wrapper.scrollIntoView({ block: "center", behavior: isStill() ? "auto" : "smooth" });
  wrapper.querySelector<HTMLElement>("a.novel-card")?.focus({ preventScroll: true });
}

/**
 * The guide (spec 2.17): rests on the resume card or start panel, flies to a card after
 * 600 ms of hover or focus attention and to a picked card, returns home 3 s after the
 * attention ends, at most one flight per 1.2 s. Hidden while a dialog is open and at once
 * on a press. Under reduced motion or pause it is placed, never flown.
 */
function setupGuide(): Off {
  const el = document.querySelector<HTMLElement>("[data-hub-guide]");
  const shell = document.querySelector<HTMLElement>(".hub-shell");
  if (!el || !shell) return () => undefined;
  let target: string | null = null;
  let hidden = false;
  let anim: Animation | null = null;
  let lastFlight = Number.NEGATIVE_INFINITY;
  let flightTimer = 0;
  let dwellTimer = 0;
  let returnTimer = 0;
  let pressTimer = 0;
  let chosenTimer = 0;

  const home = (): HTMLElement | null => {
    for (const host of document.querySelectorAll<HTMLElement>("[data-hub-resume], [data-hub-start]")) {
      if (!host.hidden && host.getClientRects().length > 0) return host;
    }
    return null;
  };

  const place = (fly: boolean) => {
    window.clearTimeout(flightTimer);
    const host = target === null ? home() : (wrappersBySlug().get(target) ?? null);
    const box = host ? viewRect(host) : null;
    if (hidden || !box || box.w <= 0) {
      anim?.cancel();
      anim = null;
      el.dataset.hubGuide = "";
      return;
    }
    const spot = spotOnEdge(
      { x: box.x, y: box.y, w: box.w, h: 0 },
      { w: GUIDE_PX, h: GUIDE_PX },
      holesNear(box.y - GUIDE_PX - CLEAR_PX, box.y + CLEAR_PX + 6),
      target === null ? 0.9 : 0.82,
      { clear: CLEAR_PX, maxOverlap: 6, margin: 12, step: 8 },
    );
    const s = viewRect(shell);
    const x = spot.x - GUIDE_PX / 2 - s.x;
    const y = spot.y - s.y;
    const shown = el.dataset.hubGuide === "rest" || el.dataset.hubGuide === "fly";
    const g = viewRect(el);
    const from = fly && shown && !isStill() ? { x: g.x - s.x, y: g.y - s.y } : null;
    anim?.cancel();
    anim = null;
    el.style.setProperty("--guide-x", `${Math.round(x)}px`);
    el.style.setProperty("--guide-y", `${Math.round(y)}px`);
    if (!from || Math.hypot(from.x - x, from.y - y) < 4) {
      el.dataset.hubGuide = "rest";
      return;
    }
    const path = flightPath(from.x - x, from.y - y);
    const flight = el.animate(
      path.points.map((p) => ({ transform: `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)` })),
      { duration: path.ms, easing: "cubic-bezier(0.45, 0, 0.25, 1)" },
    );
    anim = flight;
    lastFlight = performance.now();
    el.dataset.hubGuide = "fly";
    flight.finished.then(
      () => {
        if (anim === flight) {
          anim = null;
          el.dataset.hubGuide = "rest";
        }
      },
      () => undefined,
    );
  };

  /** Sets the destination; a flight that would start within 1.2 s of the last one waits. */
  const go = (next: string | null) => {
    target = next;
    window.clearTimeout(flightTimer);
    const wait = lastFlight + FLIGHT_GAP_MS - performance.now();
    if (wait > 0 && !isStill()) flightTimer = window.setTimeout(() => place(true), wait);
    else place(true);
  };

  const settle = () => {
    if (!anim) place(false);
  };

  const offs: Off[] = [
    on("hub:attention", (detail) => {
      window.clearTimeout(dwellTimer);
      if (detail.slug && (detail.source === "hover" || detail.source === "focus")) {
        window.clearTimeout(returnTimer);
        const slug = detail.slug;
        dwellTimer = window.setTimeout(() => go(slug), DWELL_MS);
      } else if (target !== null) {
        window.clearTimeout(returnTimer);
        returnTimer = window.setTimeout(() => go(null), RETURN_MS);
      }
    }),
    on("hub:pick", (detail) => {
      if (!detail.slug) return;
      window.clearTimeout(dwellTimer);
      window.clearTimeout(returnTimer);
      window.clearTimeout(chosenTimer);
      const slug = detail.slug;
      go(slug);
      chosenTimer = window.setTimeout(() => target === slug && go(null), CHOSEN_MS);
    }),
    on("hub:modal", (detail) => {
      hidden = detail.open;
      place(false);
    }),
    on("hub:press", () => {
      hidden = true;
      place(false);
      window.clearTimeout(pressTimer);
      pressTimer = window.setTimeout(() => {
        hidden = modalOpen();
        place(false);
      }, PRESS_HIDE_MS);
    }),
    on("hub:layout", settle),
    on("hub:reading", settle),
    listen(window, "resize", settle),
  ];
  hidden = last("hub:modal")?.open === true;
  place(false);

  return () => {
    disposeAll(offs);
    for (const timer of [flightTimer, dwellTimer, returnTimer, pressTimer, chosenTimer]) window.clearTimeout(timer);
    anim?.cancel();
    el.dataset.hubGuide = "";
    el.style.removeProperty("--guide-x");
    el.style.removeProperty("--guide-y");
  };
}

/** Wires the out-event handlers and the guide, replaying events chrome queued before this chunk loaded. */
export function setupWorld(page: PageModel, queued: readonly OutRecord[]): Off {
  const perches = setupPerches();
  const label = setupLabel(page);
  const handle = (record: OutRecord) => {
    try {
      if (perches.handle(record) || label.handle(record)) return;
      if (record[0] === "hub:out-focus") focusCard(record[1].slug);
    } catch (error) {
      console.error(error);
    }
  };
  for (const record of queued) handle(record);
  const offs: Off[] = [
    on("hub:out-perch", (detail) => handle(["hub:out-perch", detail])),
    on("hub:out-unperch", (detail) => handle(["hub:out-unperch", detail])),
    on("hub:out-label", (detail) => handle(["hub:out-label", detail])),
    on("hub:out-focus", (detail) => handle(["hub:out-focus", detail])),
    setupGuide(),
  ];
  return () => {
    disposeAll(offs);
    perches.dispose();
    label.dispose();
  };
}
