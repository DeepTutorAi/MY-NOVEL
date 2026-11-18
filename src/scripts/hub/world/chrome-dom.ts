// Small DOM helpers shared by the chrome modules. No DOM access at import time.

import type { HubGlobals } from "./types";

export type Off = () => void;

export const globals = () => window as unknown as HubGlobals & Record<string, unknown>;

/** Adds a listener and returns its remover. */
export function listen<K extends keyof DocumentEventMap>(
  target: Document,
  type: K,
  fn: (event: DocumentEventMap[K]) => void,
  options?: AddEventListenerOptions,
): Off;
export function listen<K extends keyof WindowEventMap>(
  target: Window,
  type: K,
  fn: (event: WindowEventMap[K]) => void,
  options?: AddEventListenerOptions,
): Off;
export function listen<K extends keyof HTMLElementEventMap>(
  target: HTMLElement,
  type: K,
  fn: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): Off;
export function listen(target: EventTarget, type: string, fn: (event: Event) => void, options?: AddEventListenerOptions): Off {
  target.addEventListener(type, fn, options);
  return () => target.removeEventListener(type, fn, options);
}

/** Runs every remover once, newest first; a throwing remover does not stop the rest. */
export function disposeAll(offs: Off[]): void {
  for (const off of offs.splice(0).reverse()) {
    try {
      off();
    } catch (error) {
      console.error(error);
    }
  }
}

/** Runs a loader once and shares its promise; a rejected load is retried on the next call. */
export function lazy<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;
  return () =>
    (promise ??= load().catch((error: unknown) => {
      promise = null;
      throw error;
    }));
}

/** The pick runner and picker sheet chunk (chrome-later.ts), loaded once on first use. */
export const loadLater = lazy(() => import("./chrome-later"));

let announceFrame = 0;

/** Writes `text` into the polite live region. It is cleared first and set on the next
    frame, so a repeated message is read again. */
export function announce(text: string): void {
  const live = document.querySelector<HTMLElement>("[data-hub-announce]");
  if (!live) return;
  live.textContent = "";
  cancelAnimationFrame(announceFrame);
  announceFrame = requestAnimationFrame(() => {
    live.textContent = text;
  });
}

/** Calls window[name](...args) when it is a function; errors are logged, never thrown. */
export function callGlobal(name: string, ...args: unknown[]): unknown {
  const fn = globals()[name];
  if (typeof fn !== "function") return undefined;
  try {
    return fn(...args);
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Writes (or removes, for null) a localStorage key. False when storage threw. */
export function writeLocal(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export const reducedMotionQuery = () => window.matchMedia("(prefers-reduced-motion: reduce)");

/** True under OS reduced motion or the reader's pause switch. */
export function isStill(): boolean {
  return reducedMotionQuery().matches || document.documentElement.dataset.hubMotion === "still";
}

/** Card wrappers keyed by slug (published, locked and upcoming). */
export function wrappersBySlug(): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>();
  for (const wrapper of document.querySelectorAll<HTMLElement>(".novel-card-wrapper")) {
    const slug = wrapper.dataset.novelSlug ?? wrapper.dataset.upcomingSlug;
    if (slug) map.set(slug, wrapper);
  }
  return map;
}

/** The slug of a card wrapper element, or null. */
export function slugOf(wrapper: Element | null): string | null {
  if (!(wrapper instanceof HTMLElement)) return null;
  return wrapper.dataset.novelSlug ?? wrapper.dataset.upcomingSlug ?? null;
}

/** Slug of the novel shown on the resume card, or null while it is hidden. */
export function resumeSlug(): string | null {
  const card = document.querySelector<HTMLElement>("[data-hub-resume]");
  if (!card || card.hidden) return null;
  return card.dataset.resumeSlug || null;
}
