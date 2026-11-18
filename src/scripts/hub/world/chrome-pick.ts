// "Pick a novel for me" buttons (spec 2.17, 8.4 item 21). The buttons are enabled at
// page-load; the pick behaviour (chrome-pick-run.ts, in the chrome-later chunk) loads on
// the first hover, focus or click, so it stays out of the chrome entry. Whether a click
// came from the keyboard is read before the load, so a keyboard pick never scrolls.

import { disposeAll, listen, loadLater, type Off } from "./chrome-dom";
import type { PickRunner } from "./chrome-pick-run";
import type { PageModel } from "./types";

const PICK_BUTTON = "button[data-hub-pick], button[data-hub-pick-go]";

export function setupPick(page: PageModel): Off {
  const shell = document.querySelector<HTMLElement>("main.hub-shell");
  if (!shell) return () => undefined;
  const offs: Off[] = [];
  let disposed = false;
  let runner: PickRunner | null = null;

  const load = async () => {
    const { createPickRunner } = await loadLater();
    if (!disposed) runner ??= createPickRunner(page);
    return runner;
  };

  const buttonOf = (event: Event) =>
    event.target instanceof Element ? event.target.closest<HTMLButtonElement>(PICK_BUTTON) : null;

  const warm = (event: Event) => {
    if (buttonOf(event)) load().catch(() => undefined);
  };

  for (const button of shell.querySelectorAll<HTMLButtonElement>("button[data-hub-pick]")) button.disabled = false;

  offs.push(
    listen(shell, "pointerover", warm),
    listen(shell, "focusin", warm),
    listen(shell, "click", (event) => {
      const button = buttonOf(event);
      if (!button || button.disabled) return;
      const keyboard = event.detail === 0;
      load()
        .then((run) => run?.click(button, keyboard))
        .catch((error: unknown) => console.error(error));
    }),
  );

  return () => {
    disposed = true;
    disposeAll(offs);
    runner?.dispose();
    runner = null;
  };
}
