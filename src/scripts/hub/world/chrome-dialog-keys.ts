// Keyboard side of the shared dialog behaviour (spec 2.22, 8.4 item 17), loaded with
// the chrome-later chunk when a dialog first opens: the Tab trap, Escape (delegated to
// the dialog's close button) and the first tab stop used for initial and restored focus.

import { CLOSE_SELECTOR, FOCUSABLE } from "./dialogs";

function isFocusable(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled || el.tabIndex < 0) return false;
  return el.getClientRects().length > 0;
}

/** Tab stops inside `root` in DOM order; a radio group contributes its checked radio (or its first). */
function tabStops(root: HTMLElement): HTMLElement[] {
  const seenGroups = new Set<string>();
  const stops: HTMLElement[] = [];
  for (const el of root.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (!isFocusable(el)) continue;
    if (el instanceof HTMLInputElement && el.type === "radio" && el.name) {
      if (seenGroups.has(el.name)) continue;
      const group = [...root.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(el.name)}"]`)];
      seenGroups.add(el.name);
      stops.push(group.find((radio) => radio.checked && isFocusable(radio)) ?? el);
      continue;
    }
    stops.push(el);
  }
  return stops;
}

export interface DialogKeys {
  /** Focuses the first tab stop of `dialog`. */
  focusFirst(dialog: HTMLElement): void;
  dispose(): void;
}

/** Handles Escape and Tab for the topmost dialog in `stack()` (open order, newest last). */
export function setupDialogKeys(stack: () => readonly HTMLElement[]): DialogKeys {
  const onKeyDown = (event: KeyboardEvent) => {
    const open = stack();
    const dialog = open[open.length - 1];
    if (!dialog || event.defaultPrevented) return;
    if (event.key === "Escape") {
      const close = dialog.querySelector<HTMLElement>(CLOSE_SELECTOR);
      if (!close) return;
      event.preventDefault();
      close.click();
      return;
    }
    if (event.key !== "Tab") return;
    const stops = tabStops(dialog);
    if (stops.length === 0) {
      event.preventDefault();
      return;
    }
    const first = stops[0];
    const last = stops[stops.length - 1];
    const active = document.activeElement;
    const outside = !dialog.contains(active);
    if (event.shiftKey && (outside || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (outside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener("keydown", onKeyDown);
  return {
    focusFirst: (dialog) => tabStops(dialog)[0]?.focus(),
    dispose: () => document.removeEventListener("keydown", onKeyDown),
  };
}
