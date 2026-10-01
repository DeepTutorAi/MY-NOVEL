// The parts of the placeholder plate reveal that act on the DOM and the clock,
// kept apart from plate-reveal.ts for the same reason as plate-timing.ts:
// plate-reveal.ts imports a stylesheet, which node:test cannot load.
//
// The epigraph stays real text: it is split into one <span> per grapheme
// cluster (Thai vowels and tone marks stay with their consonant), so textContent
// never changes; the spans only animate.
import { splitGraphemes } from "../../../_shared/cutscene/graphemes";
import { STAGGER_MS } from "./plate-timing";

/** A scrim opacity as a safe 0 to 1 value; anything unreadable is no scrim. */
export function clampScrim(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Replaces the epigraph's text node by one span per grapheme cluster, same text. Returns the cluster count. */
export function splitIntoClusters(textEl: HTMLElement): number {
  const text = textEl.textContent ?? "";
  const clusters = splitGraphemes(text);
  const fragment = document.createDocumentFragment();
  clusters.forEach((cluster, index) => {
    const span = document.createElement("span");
    span.className = "tsuki-g";
    span.style.animationDelay = `${index * STAGGER_MS}ms`;
    span.textContent = cluster;
    fragment.append(span);
  });
  textEl.replaceChildren(fragment);
  return clusters.length;
}

export interface RevealClock {
  /** Resolves once the scene's run time has elapsed. Left pending after dispose(). */
  readonly done: Promise<void>;
  /** Stops the clock and removes its listener; idempotent. Also what an abort of `signal` does. */
  dispose(): void;
}

/**
 * The scene's clock: `totalMs` of visible time. It runs only while the tab is
 * visible: CSS animations stand still in a background tab, so a plain timer
 * would end the scene before it was read.
 */
export function createRevealClock(totalMs: number, signal: AbortSignal): RevealClock {
  let remaining = totalMs;
  let armedAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;
  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const finish = () => {
    if (finished) return;
    finished = true;
    resolveDone();
  };
  const arm = () => {
    armedAt = performance.now();
    timer = setTimeout(finish, remaining);
  };
  const pause = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    remaining = Math.max(0, remaining - (performance.now() - armedAt));
  };
  const onVisibility = () => {
    if (finished) return;
    if (document.hidden) pause();
    else if (timer === undefined) arm();
  };
  const dispose = () => {
    pause();
    finished = true;
    document.removeEventListener("visibilitychange", onVisibility);
    signal.removeEventListener("abort", dispose);
  };

  document.addEventListener("visibilitychange", onVisibility);
  signal.addEventListener("abort", dispose, { once: true });
  if (!document.hidden) arm();

  return { done, dispose };
}
