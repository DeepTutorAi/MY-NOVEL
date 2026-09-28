// Reader settings for the Sea section: prose size, line height and backdrop
// motion. The <head> of SeaBaseLayout applies the stored values before first
// paint (and again after every ClientRouter swap); this module owns the
// in-page controls and the events other Sea modules listen to.
//
// Contracts:
// - html[data-sea-font] = s|m|l|xl, html[data-sea-lh] = normal|loose,
//   html[data-sea-motion] = on|off.
// - window "sea:settings-change" { font, lh } after the attributes change.
// - window "sea:motion-change" boolean (true = motion allowed).

export const SEA_FONT_STEPS = ["s", "m", "l", "xl"] as const;
export const SEA_LINE_HEIGHTS = ["normal", "loose"] as const;

export type SeaFontStep = (typeof SEA_FONT_STEPS)[number];
export type SeaLineHeight = (typeof SEA_LINE_HEIGHTS)[number];

export interface SeaReaderSettings {
  font: SeaFontStep;
  lh: SeaLineHeight;
}

export const FONT_KEY = "sea:settings:font-size";
export const LINE_HEIGHT_KEY = "sea:settings:line-height";
export const MOTION_KEY = "sea:motion:backdrop";

const DEFAULT_SETTINGS: SeaReaderSettings = { font: "m", lh: "normal" };

const isFontStep = (value: unknown): value is SeaFontStep =>
  typeof value === "string" && (SEA_FONT_STEPS as readonly string[]).includes(value);

const isLineHeight = (value: unknown): value is SeaLineHeight =>
  typeof value === "string" && (SEA_LINE_HEIGHTS as readonly string[]).includes(value);

const readKey = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeKey = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the
    // attribute still applies for this page view.
  }
};

export function readSettings(): SeaReaderSettings {
  const font = readKey(FONT_KEY);
  const lh = readKey(LINE_HEIGHT_KEY);
  return {
    font: isFontStep(font) ? font : DEFAULT_SETTINGS.font,
    lh: isLineHeight(lh) ? lh : DEFAULT_SETTINGS.lh,
  };
}

/** The reader's backdrop motion preference. Defaults to allowed. */
export function readMotionAllowed(): boolean {
  return readKey(MOTION_KEY) !== "off";
}

export function saveSettings(next: SeaReaderSettings) {
  const root = document.documentElement;
  root.dataset.seaFont = next.font;
  root.dataset.seaLh = next.lh;
  writeKey(FONT_KEY, next.font);
  writeKey(LINE_HEIGHT_KEY, next.lh);
  window.dispatchEvent(new CustomEvent<SeaReaderSettings>("sea:settings-change", { detail: { ...next } }));
}

export function saveMotionAllowed(allowed: boolean) {
  const value = allowed ? "on" : "off";
  document.documentElement.dataset.seaMotion = value;
  writeKey(MOTION_KEY, value);
  window.dispatchEvent(new CustomEvent<boolean>("sea:motion-change", { detail: allowed }));
}

/**
 * Binds the Aa panel rendered by ReaderSettings.astro. Returns a cleanup for
 * onSeaPage, or undefined when the page has no panel (the Sea home page).
 */
export function bindReaderSettings(): (() => void) | undefined {
  const toggle = document.querySelector<HTMLButtonElement>("[data-sea-settings-toggle]");
  const panel = document.getElementById("sea-settings-panel");
  if (!toggle || !panel) return undefined;

  const fontInputs = Array.from(panel.querySelectorAll<HTMLInputElement>('input[name="sea-font"]'));
  const lhInputs = Array.from(panel.querySelectorAll<HTMLInputElement>('input[name="sea-lh"]'));
  const motionInput = panel.querySelector<HTMLInputElement>("[data-sea-motion-toggle]");

  const syncInputs = () => {
    const current = readSettings();
    for (const input of fontInputs) input.checked = input.value === current.font;
    for (const input of lhInputs) input.checked = input.value === current.lh;
    if (motionInput) motionInput.checked = readMotionAllowed();
  };

  const isOpen = () => toggle.getAttribute("aria-expanded") === "true";

  const setOpen = (open: boolean, returnFocus = false) => {
    toggle.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
    if (open) {
      syncInputs();
      const first = panel.querySelector<HTMLInputElement>("input:checked") ?? fontInputs[0];
      first?.focus();
    } else if (returnFocus) {
      toggle.focus();
    }
  };

  const onToggleClick = () => setOpen(!isOpen());

  const onChange = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target === motionInput) {
      saveMotionAllowed(target.checked);
      return;
    }
    const current = readSettings();
    if (target.name === "sea-font" && isFontStep(target.value)) {
      saveSettings({ ...current, font: target.value });
    } else if (target.name === "sea-lh" && isLineHeight(target.value)) {
      saveSettings({ ...current, lh: target.value });
    }
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && isOpen()) {
      event.preventDefault();
      setOpen(false, true);
    }
  };

  const onDocumentPointer = (event: PointerEvent) => {
    if (!isOpen()) return;
    const target = event.target;
    if (target instanceof Node && (panel.contains(target) || toggle.contains(target))) return;
    setOpen(false);
  };

  const onFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (!isOpen() || !(next instanceof Node)) return;
    if (!panel.contains(next) && !toggle.contains(next)) setOpen(false);
  };

  toggle.addEventListener("click", onToggleClick);
  panel.addEventListener("change", onChange);
  panel.addEventListener("keydown", onKeydown);
  toggle.addEventListener("keydown", onKeydown);
  panel.addEventListener("focusout", onFocusOut);
  document.addEventListener("pointerdown", onDocumentPointer);
  syncInputs();

  return () => {
    toggle.removeEventListener("click", onToggleClick);
    panel.removeEventListener("change", onChange);
    panel.removeEventListener("keydown", onKeydown);
    toggle.removeEventListener("keydown", onKeydown);
    panel.removeEventListener("focusout", onFocusOut);
    document.removeEventListener("pointerdown", onDocumentPointer);
  };
}
