// Typed wrapper over `hub:` CustomEvents on document. Inline scripts dispatch the
// same events directly. Sticky details live on window.__hubState, created on first use.

import { STICKY_EVENTS, type Bus, type HubEventMap, type HubEventName, type HubGlobals, type HubState, type StickyEventName } from "./types";

const sticky = new Set<string>(STICKY_EVENTS);

export function createBus(target: EventTarget, state: () => HubState): Bus & { resetSticky(): void } {
  return {
    on(name, fn) {
      const listener = (event: Event) => fn(((event as CustomEvent).detail ?? {}) as HubEventMap[typeof name]);
      target.addEventListener(name, listener);
      return () => target.removeEventListener(name, listener);
    },
    emit(name, detail) {
      if (sticky.has(name)) (state() as Record<string, unknown>)[name] = detail;
      target.dispatchEvent(new CustomEvent(name, { detail }));
    },
    last(name) {
      return state()[name];
    },
    resetSticky() {
      const record = state() as Record<string, unknown>;
      for (const name of STICKY_EVENTS) delete record[name];
    },
  };
}

let shared: ReturnType<typeof createBus> | null = null;

const page = () =>
  (shared ??= createBus(document, () => ((window as unknown as HubGlobals).__hubState ??= {})));

/** The document bus, for passing to scenes and output. */
export const bus: Bus = {
  on: (name, fn) => page().on(name, fn),
  emit: (name, detail) => page().emit(name, detail),
  last: (name) => page().last(name),
};

export function on<K extends HubEventName>(name: K, fn: (detail: HubEventMap[K]) => void): () => void {
  return page().on(name, fn);
}

export function emit<K extends HubEventName>(name: K, detail: HubEventMap[K]): void {
  page().emit(name, detail);
}

export function last<K extends StickyEventName>(name: K): HubEventMap[K] | undefined {
  return page().last(name);
}

/** Forgets every sticky detail; chrome calls it when the hub page is torn down. */
export function resetSticky(): void {
  page().resetSticky();
}
