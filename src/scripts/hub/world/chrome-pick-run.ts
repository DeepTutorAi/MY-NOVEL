// Pick behaviour (spec 2.17, 8.4 item 21), loaded by chrome-pick.ts on first use: hub:pick,
// a polite announcement, data-chosen for 8 s, and for keyboard picks a "ไปที่เรื่องนี้"
// button instead of a scroll.

import { emit } from "./bus";
import { localDay } from "./calendar-core";
import { announce, isStill, readLocal, resumeSlug, wrappersBySlug } from "./chrome-dom";
import { PICK_GAP_MS, PICK_KEY, pickNovel } from "./pick-core";
import type { HubEventMap, PageModel } from "./types";

type Origin = HubEventMap["hub:pick"]["origin"];

export interface PickRunner {
  /** Handles a click on a pick button or on the "ไปที่เรื่องนี้" button. */
  click(button: HTMLButtonElement, keyboard: boolean): void;
  dispose(): void;
}

const CHOSEN_MS = 8000;
const ACTIVE_PROFILE_KEY = "piichan-novels:active-profile-id";
const ALL_READ_TH = "อ่านจบครบทุกเรื่องที่เปิดอยู่แล้ว เรื่องใหม่กำลังตามมา";
const GO_TH = "ไปที่เรื่องนี้";

const ORIGINS: readonly Origin[] = ["start", "head", "footer"];
const toOrigin = (value: string | undefined): Origin | null => ORIGINS.find((origin) => origin === value) ?? null;

/** Press count fallback when sessionStorage throws. */
let memoryPress = 0;

function readPress(): number {
  try {
    const value = Number.parseInt(sessionStorage.getItem(PICK_KEY) ?? "", 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return memoryPress;
  }
}

function writePress(value: number): void {
  memoryPress = value;
  try {
    sessionStorage.setItem(PICK_KEY, String(value));
  } catch {
    // Storage blocked: the in-memory count keeps the cycle for this page.
  }
}

export function createPickRunner(page: PageModel): PickRunner {
  let lastPickAt = Number.NEGATIVE_INFINITY;
  let chosen: HTMLElement | null = null;
  let chosenTimer = 0;
  let goButton: HTMLButtonElement | null = null;
  let goFrom: HTMLButtonElement | null = null;

  const clearChosen = () => {
    window.clearTimeout(chosenTimer);
    chosen?.removeAttribute("data-chosen");
    chosen = null;
  };

  /** Removes the go button; focus on it returns to the pick button it follows. */
  const removeGo = () => {
    if (goButton && document.activeElement === goButton) goFrom?.focus();
    goButton?.remove();
    goButton = null;
    goFrom = null;
  };

  const expire = () => {
    clearChosen();
    removeGo();
  };

  /** Centres the card, or aligns its top when it is taller than the viewport. */
  const reveal = (wrapper: HTMLElement) =>
    wrapper.scrollIntoView({
      block: wrapper.getBoundingClientRect().height > window.innerHeight ? "start" : "center",
      behavior: isStill() ? "auto" : "smooth",
    });

  const focusCard = (slug: string) => {
    const wrapper = wrappersBySlug().get(slug);
    const link = wrapper?.querySelector<HTMLElement>("a.novel-card");
    if (!wrapper || !link) return;
    reveal(wrapper);
    link.focus({ preventScroll: true });
    removeGo();
  };

  const pick = (button: HTMLButtonElement, keyboard: boolean) => {
    const origin = toOrigin(button.dataset.hubPick);
    const now = performance.now();
    if (!origin || now - lastPickAt < PICK_GAP_MS) return;
    lastPickAt = now;

    const snapshot = page.getSnapshot();
    const press = readPress();
    const result = pickNovel({
      cards: snapshot.cards,
      resumeSlug: resumeSlug(),
      localDay: localDay(new Date()),
      profileId: readLocal(ACTIVE_PROFILE_KEY) || "guest",
      press,
    });
    writePress(press + 1);
    emit("hub:pick", { slug: result.slug, reason: result.reason, origin });

    expire();
    const card = result.slug ? snapshot.cards.find((info) => info.slug === result.slug) : undefined;
    const wrapper = result.slug ? wrappersBySlug().get(result.slug) : undefined;
    if (!result.slug || !card || !wrapper) {
      announce(ALL_READ_TH);
      return;
    }
    announce(`ลองอ่าน “${card.titleTh}” ดูไหม`);
    chosen = wrapper;
    wrapper.setAttribute("data-chosen", "");
    chosenTimer = window.setTimeout(expire, CHOSEN_MS);

    if (keyboard) {
      const slug = result.slug;
      goButton = document.createElement("button");
      goButton.type = "button";
      goButton.className = "hub-pick-btn hub-pick-go";
      goButton.dataset.hubPickGo = slug;
      goButton.setAttribute("data-hub-runtime", "");
      goButton.textContent = GO_TH;
      goFrom = button;
      button.after(goButton);
      return;
    }
    const rect = wrapper.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) reveal(wrapper);
  };

  return {
    click(button, keyboard) {
      const go = button.dataset.hubPickGo;
      if (go) focusCard(go);
      else pick(button, keyboard);
    },
    dispose() {
      clearChosen();
      goButton?.remove();
      goButton = null;
    },
  };
}
