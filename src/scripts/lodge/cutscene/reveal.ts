// Wraps the epigraph paragraph's text in one inline span per grapheme cluster,
// leaving textContent exactly as it was, and reveals the spans with opacity.
// Inline spans and opacity only: no inline-block, no transform, so Thai lines
// break where they would without the spans.
import { revealClusters, visibleCount } from "./reveal-core";
import type { Reveal } from "./scene-types";

export function createReveal(textEl: HTMLElement, onComplete: () => void): Reveal {
  const text = textEl.textContent ?? "";
  const spans = revealClusters(text).map((cluster) => {
    const span = document.createElement("span");
    span.className = "lodge-cutscene__g";
    span.textContent = cluster;
    return span;
  });
  textEl.replaceChildren(...spans);
  textEl.dataset.reveal = "0";
  let shown = 0;
  let completed = false;
  const show = (fraction: number) => {
    const next = visibleCount(fraction, spans.length);
    if (next === shown) return;
    for (let i = Math.min(shown, next); i < Math.max(shown, next); i += 1) spans[i].classList.toggle("is-shown", i < next);
    shown = next;
    textEl.dataset.reveal = String(shown / spans.length);
    if (shown === spans.length && !completed) {
      completed = true;
      onComplete();
    }
  };
  return { count: spans.length, show, showAll: () => show(1) };
}

/** Puts the paragraph back to plain text (the dialog may open again on a replay). */
export function resetReveal(textEl: HTMLElement): void {
  textEl.textContent = textEl.textContent ?? "";
  delete textEl.dataset.reveal;
}
