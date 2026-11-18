// The theme picker sheet (spec 2.16 with 8.3 items 1, 2 and 10), loaded by
// chrome-picker.ts on first use. Opening, closing, live preview and preload, and the
// delayed, rate-limited switch. Escape, focus trap, inert and hub:modal belong to dialogs.ts.

import { themeByKey, weeklyTheme } from "../theme-core.mjs";
import { disposeAll, listen, type Off } from "./chrome-dom";
import { setupMotionSwitch } from "./chrome-motion-switch";
import { choiceTheme, currentChoice, persistChoice, preloadTheme, switchTheme } from "./chrome-switch";
import { activeThemeKey } from "./chrome-theme";
import type { HubThemeKey, PageModel } from "./types";

type Choice = HubThemeKey | "auto";

const APPLY_DELAY_MS = 400;
const SWITCH_GAP_MS = 1000;

const toChoice = (value: string): Choice | null => (value === "auto" ? "auto" : (themeByKey(value)?.key ?? null));

/** Place name of a theme, read from its server-rendered picker option. */
function placeName(picker: HTMLElement, key: HubThemeKey): string {
  const radio = picker.querySelector<HTMLInputElement>(`input[name="hub-theme"][value="${key}"]`);
  const name = radio?.closest("label")?.querySelector(".hub-picker-name");
  return name?.textContent?.trim() ?? "";
}

export interface PickerSheet {
  open(): void;
  dispose(): void;
}

export function createPickerSheet(picker: HTMLElement, triggers: readonly HTMLButtonElement[], page: PageModel | null): PickerSheet {
  const card = picker.querySelector<HTMLElement>("[data-hub-theme-preview]");
  const radios = [...picker.querySelectorAll<HTMLInputElement>('input[type="radio"][name="hub-theme"]')];
  const options = picker.querySelector<HTMLElement>("fieldset") ?? picker;
  const preloads = new Map<HubThemeKey, Promise<unknown>>();
  const offs: Off[] = [setupMotionSwitch(picker)];

  let pending: Choice | null = null;
  let applyTimer = 0;
  let lastSwitchAt = Number.NEGATIVE_INFINITY;

  const setExpanded = (value: boolean) => {
    for (const trigger of triggers) trigger.setAttribute("aria-expanded", String(value));
  };

  const setPreview = (key: HubThemeKey) => {
    if (card) card.dataset.hubThemePreview = key;
  };

  const preview = (choice: Choice) => {
    const key = choiceTheme(choice);
    setPreview(key);
    if (!preloads.has(key)) preloads.set(key, preloadTheme(key));
  };

  const checkedChoice = (): Choice => toChoice(radios.find((radio) => radio.checked)?.value ?? "") ?? currentChoice();

  const fillAutoPlace = () => {
    const slot = picker.querySelector<HTMLElement>("[data-hub-auto-place]");
    if (slot) slot.textContent = placeName(picker, weeklyTheme(Date.now()));
  };

  const apply = () => {
    applyTimer = 0;
    const choice = pending;
    if (choice === null) return;
    const wait = lastSwitchAt + SWITCH_GAP_MS - performance.now();
    if (wait > 0) {
      applyTimer = window.setTimeout(apply, wait);
      return;
    }
    pending = null;
    const target = choiceTheme(choice);
    if (target !== activeThemeKey()) lastSwitchAt = performance.now();
    switchTheme(target, preloads.get(target) ?? null, page, () => persistChoice(choice));
  };

  const scheduleApply = (choice: Choice) => {
    pending = choice;
    window.clearTimeout(applyTimer);
    applyTimer = window.setTimeout(apply, APPLY_DELAY_MS);
  };

  const open = () => {
    if (picker.hasAttribute("data-open")) return;
    const choice = pending ?? currentChoice();
    for (const radio of radios) radio.checked = radio.value === choice;
    fillAutoPlace();
    setPreview(activeThemeKey());
    picker.setAttribute("data-open", "");
    setExpanded(true);
    (radios.find((radio) => radio.checked) ?? radios[0])?.focus();
  };

  const close = () => {
    if (!picker.hasAttribute("data-open")) return;
    picker.removeAttribute("data-open");
    setExpanded(false);
  };

  for (const closer of picker.querySelectorAll<HTMLElement>("[data-hub-picker-close]")) {
    offs.push(listen(closer, "click", close));
  }
  offs.push(
    listen(picker, "click", (event) => {
      if (event.target === picker) close();
    }),
  );

  const optionValue = (target: EventTarget | null): Choice | null => {
    if (!(target instanceof Element)) return null;
    const radio = target instanceof HTMLInputElement ? target : target.closest("label")?.control;
    return radio instanceof HTMLInputElement && radios.includes(radio) ? toChoice(radio.value) : null;
  };

  offs.push(
    listen(options, "pointerover", (event) => {
      const choice = optionValue(event.target);
      if (choice) preview(choice);
    }),
    listen(options, "pointerleave", () => setPreview(choiceTheme(checkedChoice()))),
    listen(options, "focusin", (event) => {
      const choice = optionValue(event.target);
      if (choice) preview(choice);
    }),
    listen(options, "change", (event) => {
      const choice = optionValue(event.target);
      if (!choice) return;
      preview(choice);
      scheduleApply(choice);
    }),
    listen(document, "astro:before-preparation", close),
  );

  return {
    open,
    dispose() {
      disposeAll(offs);
      window.clearTimeout(applyTimer);
      if (pending !== null) persistChoice(pending);
      pending = null;
      close();
      preloads.clear();
    },
  };
}
