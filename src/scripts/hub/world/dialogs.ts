// Shared dialog behaviour for the hub (spec 2.22, 8.4 item 17). A dialog is open
// while it carries [data-open]. This module is the only owner of Escape and of focus
// restore: it makes the page shell inert, emits hub:modal on every open or close and
// remembers where focus was outside the dialogs. The keyboard part (Tab trap, Escape,
// first tab stop) is chrome-dialog-keys.ts, loaded with the chrome-later chunk when a
// dialog first opens; until it has loaded (or if it fails to), Escape is handled here.

import { loadLater } from "./chrome-dom";
import type { DialogKeys } from "./chrome-dialog-keys";
import type { Bus } from "./types";

export const DIALOG_SELECTOR = '.hub-modal-overlay[role="dialog"]';
export const CLOSE_SELECTOR = "[data-hub-picker-close], [data-edit-profile-close-btn], [data-settings-close-btn], .modal-close-btn";
export const FOCUSABLE =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

const PICKER_ID = "hub-theme-picker";

export function setupDialogs(bus: Bus): () => void {
  const dialogs = [...document.querySelectorAll<HTMLElement>(DIALOG_SELECTOR)];
  const shell = document.querySelector<HTMLElement>("main.hub-shell");
  const open: HTMLElement[] = [];
  let shellMadeInert = false;
  let lastOutside: HTMLElement | null = null;
  let keys: DialogKeys | null = null;
  let disposed = false;

  const withKeys = (fn: (k: DialogKeys) => void) =>
    loadLater()
      .then(({ setupDialogKeys }) => {
        if (disposed) return;
        keys ??= setupDialogKeys(() => open);
        fn(keys);
      })
      .catch((error: unknown) => console.error(error));

  const inDialog = (node: EventTarget | null) => node instanceof Element && dialogs.some((dialog) => dialog.contains(node));
  const kindOf = (dialog: HTMLElement) => (dialog.id === PICKER_ID ? ({ kind: "picker" } as const) : {});

  const setShellInert = (inert: boolean) => {
    if (!shell) return;
    if (inert && !shell.inert) {
      shell.inert = true;
      shellMadeInert = true;
    } else if (!inert && shellMadeInert) {
      shell.inert = false;
      shellMadeInert = false;
    }
  };

  const onOpen = (dialog: HTMLElement) => {
    if (open.includes(dialog)) return;
    open.push(dialog);
    setShellInert(true);
    withKeys((k) => {
      if (open.includes(dialog) && !dialog.contains(document.activeElement)) k.focusFirst(dialog);
    });
    bus.emit("hub:modal", { open: true, ...kindOf(dialog) });
  };

  const onClose = (dialog: HTMLElement) => {
    const index = open.indexOf(dialog);
    if (index < 0) return;
    open.splice(index, 1);
    if (open.length === 0) setShellInert(false);
    const active = document.activeElement;
    if (!active || active === document.body || dialog.contains(active)) {
      const top = open[open.length - 1];
      if (top) withKeys((k) => k.focusFirst(top));
      else if (lastOutside?.isConnected) lastOutside.focus();
    }
    bus.emit("hub:modal", { open: false, ...kindOf(dialog) });
  };

  const sync = (dialog: HTMLElement) => (dialog.hasAttribute("data-open") ? onOpen(dialog) : onClose(dialog));

  const observer = new MutationObserver((records) => {
    for (const record of records) sync(record.target as HTMLElement);
  });
  for (const dialog of dialogs) observer.observe(dialog, { attributes: true, attributeFilter: ["data-open"] });

  const onEscape = (event: KeyboardEvent) => {
    if (keys || event.key !== "Escape" || event.defaultPrevented) return;
    open[open.length - 1]?.querySelector<HTMLElement>(CLOSE_SELECTOR)?.click();
  };

  const onFocusIn = (event: FocusEvent) => {
    if (event.target instanceof HTMLElement && !inDialog(event.target)) lastOutside = event.target;
  };

  // Safari does not focus a clicked button, so the clicked control is the restore target.
  const onClickCapture = (event: MouseEvent) => {
    const control = event.target instanceof Element ? event.target.closest<HTMLElement>(FOCUSABLE) : null;
    if (control && !inDialog(control)) lastOutside = control;
  };

  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("click", onClickCapture, true);
  document.addEventListener("keydown", onEscape);
  for (const dialog of dialogs) if (dialog.hasAttribute("data-open")) onOpen(dialog);

  return () => {
    disposed = true;
    observer.disconnect();
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("click", onClickCapture, true);
    document.removeEventListener("keydown", onEscape);
    keys?.dispose();
    keys = null;
    setShellInert(false);
    open.length = 0;
  };
}
