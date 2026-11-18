// DOM side of the scene output channel (spec 2.9, 8.5 item 1). Scenes never touch
// the DOM: they call this object, which passes every write through the limiter,
// writes live variables and beats, and hands perches, labels and focus requests
// to chrome as hub:out-* events. Root variables go on .hub-page, card variables
// and beats on .novel-card-wrapper, page-wide beats on .hub-hero and .hub-footer.
// Values the rate limit deferred are written by a timer when their window opens, so
// the last value lands even after the scene stops writing. Announcements go to chrome's
// polite live region as hub:out-announce, one per ANNOUNCE_MS per page (per bus).

import { clamp } from "./geom";
import { ANNOUNCE_MS, LABEL_MS, createLimiter, quantise, quantiseAngle } from "./output-core";
import type { Bus, CardInfo, CardVarName, CardVars, Output, OutputOptions, RootVarName, RootVars } from "./types";

const WRAPPER = ".novel-card-wrapper";
const PAGE_BEAT_TARGETS = ".hub-hero, .hub-footer";

const rootValue = (name: RootVarName, v: number) => (name === "w-sun" ? `${v}deg` : String(v));

/** Last announcement time per bus: one bus per page, shared by every theme's output. */
const announcedAt = new WeakMap<Bus, number>();

export function createOutput({ page, bus, now = () => performance.now() }: OutputOptions): Output {
  const limiter = createLimiter(now);
  const perches = new Set<number>();
  const rootWritten = new Set<RootVarName>();
  const cardWritten = new Set<HTMLElement>();
  const beatWritten = new Set<HTMLElement>();
  let heroWritten: HTMLElement | null = null;
  let heroValue = "";
  let rootEl: HTMLElement | null = null;
  let wrappers = new Map<string, HTMLElement>();
  let cards = new Map<string, CardInfo>();
  let cardsVersion = -1;
  let disposed = false;
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  let flushAt = Infinity;
  /** Inside the kit's still composition: perches are allowed and still() keeps them. */
  let composing = false;

  const root = () => {
    if (!rootEl?.isConnected) rootEl = document.querySelector<HTMLElement>(".hub-page");
    return rootEl;
  };

  const wrapper = (slug: string) => {
    const cached = wrappers.get(slug);
    if (cached?.isConnected) return cached;
    wrappers = new Map();
    for (const el of document.querySelectorAll<HTMLElement>(WRAPPER)) {
      const key = el.dataset.novelSlug ?? el.dataset.upcomingSlug;
      if (key) wrappers.set(key, el);
    }
    return wrappers.get(slug) ?? null;
  };

  const intersecting = (slug: string) => {
    const snapshot = page.getSnapshot();
    if (snapshot.version !== cardsVersion) {
      cards = new Map(snapshot.cards.map((c) => [c.slug, c]));
      cardsVersion = snapshot.version;
    }
    const info = cards.get(slug);
    if (!info) return false;
    const r = page.toViewport(info.rect);
    return r.y < snapshot.viewport.h && r.y + r.h > 0;
  };

  const writeRoot = (vars: RootVars) => {
    const el = root();
    if (!el) return;
    for (const name of Object.keys(vars) as RootVarName[]) {
      const v = vars[name];
      if (v === undefined) continue;
      el.style.setProperty(`--${name}`, rootValue(name, v));
      rootWritten.add(name);
    }
  };

  const writeCard = (el: HTMLElement, vars: CardVars) => {
    for (const name of Object.keys(vars) as CardVarName[]) {
      const v = vars[name];
      if (v === undefined) continue;
      el.style.setProperty(`--${name}`, String(v));
    }
    cardWritten.add(el);
  };

  const cancelFlush = () => {
    clearTimeout(flushTimer);
    flushTimer = undefined;
    flushAt = Infinity;
  };

  /** Arms the timer for the earliest deferred value, or clears it when nothing waits. */
  const schedule = () => {
    const at = disposed ? null : limiter.pendingAt();
    if (at === null) {
      cancelFlush();
      return;
    }
    if (flushTimer !== undefined && flushAt <= at) return;
    cancelFlush();
    flushAt = at;
    flushTimer = setTimeout(flush, Math.max(0, Math.ceil(at - now())));
  };

  const flush = () => {
    flushTimer = undefined;
    flushAt = Infinity;
    if (disposed) return;
    const due = limiter.flush(intersecting);
    if (due.root) writeRoot(due.root);
    for (const [slug, vars] of due.cards) {
      const el = wrapper(slug);
      if (el) writeCard(el, vars);
    }
    schedule();
  };

  const unperchAll = () => {
    for (const id of [...perches]) {
      perches.delete(id);
      limiter.unperch(id);
      bus.emit("hub:out-unperch", { id });
    }
  };

  const offPress = bus.on("hub:press", unperchAll);
  const offModal = bus.on("hub:modal", (detail) => {
    if (detail.open) unperchAll();
  });

  return {
    root(vars) {
      if (disposed) return;
      const out = limiter.root(vars);
      if (out) writeRoot(out);
      schedule();
    },

    card(slug, vars) {
      if (disposed || limiter.still) return;
      const el = wrapper(slug);
      if (!el) return;
      const out = limiter.card(slug, vars, intersecting(slug));
      if (out) writeCard(el, out);
      schedule();
    },

    heroPoolX(percent) {
      if (disposed || !Number.isFinite(percent)) return;
      const el = document.querySelector<HTMLElement>(".hub-hero");
      const value = `${Math.round(clamp(percent, 0, 100) * 10) / 10}%`;
      if (!el || (el === heroWritten && value === heroValue)) return;
      el.style.setProperty("--hub-hero-pool-x", value);
      heroWritten = el;
      heroValue = value;
    },

    beat(slug, kind) {
      if (disposed) return;
      const targets = slug === null ? [...document.querySelectorAll<HTMLElement>(PAGE_BEAT_TARGETS)] : [wrapper(slug)];
      const els = targets.filter((el): el is HTMLElement => el !== null);
      if (els.length === 0) return;
      const value = limiter.beat(slug);
      if (!value) return;
      for (const el of els) {
        el.dataset.wBeatKind = kind;
        el.dataset.wBeat = value;
        beatWritten.add(el);
      }
    },

    perch(target, spec) {
      if (disposed) return 0;
      const id = limiter.perch(composing);
      if (id === 0) return 0;
      perches.add(id);
      bus.emit("hub:out-perch", { id, target, kind: spec.kind, u: clamp(spec.u, 0, 1) });
      return id;
    },

    unperch(id) {
      if (!perches.delete(id)) return;
      limiter.unperch(id);
      bus.emit("hub:out-unperch", { id });
    },

    label(slug, at, ms = LABEL_MS) {
      if (disposed) return;
      bus.emit("hub:out-label", { slug, x: at.x, y: at.y, plane: at.plane, ms });
    },

    focusCard(slug) {
      if (disposed) return;
      bus.emit("hub:out-focus", { slug });
    },

    still(rootVars, cardVars) {
      if (disposed) return;
      // compose(true) already cleared the last composition; perches placed in this one stay.
      if (!composing) unperchAll();
      // Deferred values are void; what the composition writes is seeded into the limiter, so
      // the first live writes after resume() compare and slew from what the DOM shows.
      limiter.setStill(true);
      cancelFlush();
      const composed: RootVars = {};
      for (const name of Object.keys(rootVars) as RootVarName[]) {
        const v = rootVars[name];
        if (v !== undefined && Number.isFinite(v)) composed[name] = name === "w-sun" ? quantiseAngle(v) : quantise(v);
      }
      writeRoot(composed);
      limiter.seedRoot(composed);
      for (const slug of Object.keys(cardVars)) {
        const el = wrapper(slug);
        if (!el) continue;
        const vars: CardVars = {};
        for (const name of Object.keys(cardVars[slug]) as CardVarName[]) {
          const v = cardVars[slug][name];
          if (v !== undefined && Number.isFinite(v)) vars[name] = quantise(v);
        }
        writeCard(el, vars);
        limiter.seed(slug, vars);
      }
    },

    resume() {
      if (limiter.still) unperchAll();
      limiter.setStill(false);
    },

    compose(on) {
      if (disposed) return;
      if (on) unperchAll();
      composing = on;
    },

    announce(text) {
      const value = text.trim();
      if (disposed || value === "") return;
      const t = now();
      const last = announcedAt.get(bus);
      if (last !== undefined && t - last < ANNOUNCE_MS) return;
      announcedAt.set(bus, t);
      bus.emit("hub:out-announce", { text: value });
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      cancelFlush();
      offPress();
      offModal();
      unperchAll();
      limiter.reset();
      const el = root();
      for (const name of rootWritten) el?.style.removeProperty(`--${name}`);
      for (const card of cardWritten) {
        for (const name of ["w-glow", "w-lx", "w-ly"] as const) card.style.removeProperty(`--${name}`);
      }
      for (const target of beatWritten) {
        delete target.dataset.wBeat;
        delete target.dataset.wBeatKind;
      }
      heroWritten?.style.removeProperty("--hub-hero-pool-x");
      rootWritten.clear();
      cardWritten.clear();
      beatWritten.clear();
      wrappers.clear();
    },
  };
}
