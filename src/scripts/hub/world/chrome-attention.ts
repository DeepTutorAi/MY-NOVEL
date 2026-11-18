// Reader attention and card presses (spec 2.11): hub:attention with data-attended on
// the attended wrapper, and hub:press before a card or continue link navigates.

import { emit } from "./bus";
import { disposeAll, listen, resumeSlug, slugOf, wrappersBySlug, type Off } from "./chrome-dom";
import type { CardKind, HubEventMap, PageModel } from "./types";

type Attention = HubEventMap["hub:attention"];
type Source = Attention["source"];

const DWELL_MS = 250;
const CENTER_IDLE_MS = 250;
const EMIT_DEBOUNCE_MS = 120;
const PRESS_REPEAT_MS = 400;

interface Slot {
  slug: string;
  source: Source;
}

const sameSlot = (a: Slot | null, b: Slot | null) => a?.slug === b?.slug && a?.source === b?.source;

export function setupAttention(page: PageModel): Off {
  const shell = document.querySelector<HTMLElement>("main.hub-shell");
  if (!shell) return () => undefined;
  const wrappers = wrappersBySlug();
  const offs: Off[] = [];
  const kindOf = (slug: string): CardKind | null => page.getSnapshot().cards.find((card) => card.slug === slug)?.kind ?? null;
  const wrapperOf = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>(".novel-card-wrapper") : null;
  const inResume = (target: EventTarget | null) =>
    target instanceof Element && target.closest("[data-resume-link]") !== null;

  let focus: Slot | null = null;
  let hover: Slot | null = null;
  let pendingHover: Slot | null = null;
  let center: Slot | null = null;
  let current: Slot | null = null;
  let attended: HTMLElement | null = null;
  let emitTimer = 0;
  let dwellTimer = 0;
  let centerTimer = 0;

  const flush = () => {
    emitTimer = 0;
    const next = focus ?? hover ?? center;
    const previous = current;
    if (sameSlot(next, previous)) return;
    current = next;
    const wrapper = next ? (wrappers.get(next.slug) ?? null) : null;
    if (attended !== wrapper) {
      attended?.removeAttribute("data-attended");
      wrapper?.setAttribute("data-attended", "");
      attended = wrapper;
    }
    emit(
      "hub:attention",
      next
        ? { slug: next.slug, kind: kindOf(next.slug), source: next.source }
        : { slug: null, kind: null, source: previous?.source ?? "hover" },
    );
  };
  const update = () => {
    window.clearTimeout(emitTimer);
    emitTimer = window.setTimeout(flush, EMIT_DEBOUNCE_MS);
  };

  const slotFor = (target: EventTarget | null, source: Source): Slot | null => {
    if (inResume(target)) {
      const slug = resumeSlug();
      return slug ? { slug, source: "resume" } : null;
    }
    const slug = slugOf(wrapperOf(target));
    return slug ? { slug, source } : null;
  };

  offs.push(
    listen(shell, "pointerover", (event) => {
      if (event.pointerType === "touch") return;
      const slot = slotFor(event.target, "hover");
      if (sameSlot(slot, pendingHover ?? hover)) return;
      window.clearTimeout(dwellTimer);
      pendingHover = null;
      if (!slot) {
        if (hover) {
          hover = null;
          update();
        }
        return;
      }
      pendingHover = slot;
      dwellTimer = window.setTimeout(() => {
        pendingHover = null;
        hover = slot;
        update();
      }, DWELL_MS);
    }),
    listen(shell, "pointerleave", () => {
      window.clearTimeout(dwellTimer);
      pendingHover = null;
      if (hover) {
        hover = null;
        update();
      }
    }),
    listen(shell, "focusin", (event) => {
      focus = slotFor(event.target, "focus");
      update();
    }),
    listen(shell, "focusout", (event) => {
      if (shell.contains(event.relatedTarget as Node | null)) return;
      focus = null;
      update();
    }),
  );

  // Coarse pointers: the card nearest the viewport centre, once scrolling idles.
  const coarse = window.matchMedia("(pointer: coarse)");
  const inBand = new Set<HTMLElement>();
  let observer: IntersectionObserver | null = null;
  const pickCenter = () => {
    centerTimer = 0;
    const mid = window.innerHeight / 2;
    let best: HTMLElement | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const wrapper of inBand) {
      const rect = wrapper.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - mid);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = wrapper;
      }
    }
    const slug = slugOf(best);
    const next: Slot | null = slug ? { slug, source: "center" } : null;
    if (next?.slug === center?.slug) return;
    center = next;
    update();
  };
  const scheduleCenter = () => {
    window.clearTimeout(centerTimer);
    centerTimer = window.setTimeout(pickCenter, CENTER_IDLE_MS);
  };
  const startCenter = () => {
    if (observer || !coarse.matches) return;
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          if (entry.isIntersecting) inBand.add(target);
          else inBand.delete(target);
        }
        scheduleCenter();
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const wrapper of wrappers.values()) observer.observe(wrapper);
  };
  const stopCenter = () => {
    observer?.disconnect();
    observer = null;
    inBand.clear();
    window.clearTimeout(centerTimer);
    if (center) {
      center = null;
      update();
    }
  };
  const onCoarse = () => (coarse.matches ? startCenter() : stopCenter());
  coarse.addEventListener("change", onCoarse);
  offs.push(() => coarse.removeEventListener("change", onCoarse), listen(window, "scroll", () => observer && scheduleCenter(), { passive: true }));
  startCenter();

  // Press: pointerdown or Enter on a card or continue link, before navigation.
  let lastPress = { slug: "", at: Number.NEGATIVE_INFINITY };
  const press = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return;
    const link = target.closest("a.novel-card, a.novel-card-continue");
    const slug = slugOf(wrapperOf(link));
    if (!slug) return;
    const kind = kindOf(slug);
    const now = performance.now();
    if (!kind || (lastPress.slug === slug && now - lastPress.at < PRESS_REPEAT_MS)) return;
    lastPress = { slug, at: now };
    emit("hub:press", { slug, kind });
  };
  offs.push(
    listen(shell, "pointerdown", (event) => {
      if (event.button === 0) press(event.target);
    }),
    listen(shell, "keydown", (event) => {
      if (event.key === "Enter") press(event.target);
    }),
  );

  return () => {
    disposeAll(offs);
    stopCenter();
    window.clearTimeout(emitTimer);
    window.clearTimeout(dwellTimer);
    attended?.removeAttribute("data-attended");
    attended = null;
  };
}
