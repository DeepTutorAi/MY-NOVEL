// Picker triggers (spec 2.16). The triggers are enabled at page-load; the sheet's
// behaviour (chrome-picker-run.ts, in the chrome-later chunk) loads on the first hover,
// focus or click of a trigger, so it stays out of the chrome entry.

import { disposeAll, listen, loadLater, type Off } from "./chrome-dom";
import type { PickerSheet } from "./chrome-picker-run";
import type { PageModel } from "./types";

export function setupPicker(page: PageModel | null): Off {
  const picker = document.getElementById("hub-theme-picker");
  const triggers = [...document.querySelectorAll<HTMLButtonElement>("[data-hub-picker-open]")];
  if (!picker) return () => undefined;
  const offs: Off[] = [];
  let disposed = false;
  let sheet: PickerSheet | null = null;

  const load = async () => {
    const { createPickerSheet } = await loadLater();
    if (!disposed) sheet ??= createPickerSheet(picker, triggers, page);
    return sheet;
  };
  const warm = () => {
    load().catch(() => undefined);
  };

  for (const trigger of triggers) {
    trigger.disabled = false;
    trigger.setAttribute("aria-expanded", "false");
    offs.push(
      listen(trigger, "pointerenter", warm),
      listen(trigger, "focus", warm),
      listen(trigger, "click", () => {
        load()
          .then((loaded) => loaded?.open())
          .catch((error: unknown) => console.error(error));
      }),
    );
  }

  return () => {
    disposed = true;
    disposeAll(offs);
    sheet?.dispose();
    sheet = null;
  };
}
