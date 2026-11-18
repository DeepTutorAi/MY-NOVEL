// The picker's theme switch (spec 2.14 step 5, 2.16, 8.3 item 1), loaded with the picker:
// the stored override, scene preload and the view-transition swap.

import { OVERRIDE_KEY, lowerFirst, themeByKey, weeklyTheme } from "../theme-core.mjs";
import { emit } from "./bus";
import { callGlobal, isStill, readLocal, writeLocal } from "./chrome-dom";
import { activeThemeKey, beginSwitch, bridge, cleanupScenes, clearSwitch, isCurrentSwitch, isNavigating } from "./chrome-theme";
import type { BindOptions, HubThemeKey, PageModel } from "./types";

/** Picker choice kept for this page session when storage cannot be written. */
let sessionChoice: HubThemeKey | null = null;

const PRELOAD_CAP_MS = 300;

/** Starts loading a theme's scene chunk without mounting it. */
export async function preloadTheme(key: HubThemeKey): Promise<unknown> {
  const row = themeByKey(key);
  if (!row) return undefined;
  try {
    return await callGlobal(`__${lowerFirst(row.bind)}Preload`);
  } catch {
    return undefined;
  }
}

function applyRootTheme(key: HubThemeKey): void {
  document.documentElement.dataset.hubTheme = key;
  const color = themeByKey(key)?.themeColor;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (color && meta) meta.content = color;
}

/** The picker's current choice: a stored or session override, else "auto". */
export function currentChoice(): HubThemeKey | "auto" {
  const stored = themeByKey(readLocal(OVERRIDE_KEY));
  if (stored?.enabled) return stored.key;
  return sessionChoice ?? "auto";
}

/** Writes the override (null = automatic). The bridge keeps its own session copy when present. */
export function persistChoice(choice: HubThemeKey | "auto"): void {
  const key = choice === "auto" ? null : choice;
  const api = bridge();
  if (typeof api?.set === "function") {
    try {
      api.set(key);
    } catch (error) {
      console.error(error);
    }
  } else {
    writeLocal(OVERRIDE_KEY, key);
  }
  sessionChoice = key;
}

/** The theme a choice resolves to now: the chosen key, or this week's theme. */
export function choiceTheme(choice: HubThemeKey | "auto", nowMs = Date.now()): HubThemeKey {
  return choice === "auto" ? weeklyTheme(nowMs) : choice;
}

function setWipeOrigin(page: PageModel | null): void {
  const style = document.documentElement.style;
  let x = "50%";
  let y = "100%";
  if (page) {
    const hit = page.toViewport(page.getSnapshot().windows.stageHit);
    const cx = hit.x + hit.w / 2;
    const cy = hit.y + hit.h / 2;
    if (hit.w > 0 && cx >= 0 && cx <= innerWidth && cy >= 0 && cy <= innerHeight) {
      x = `${Math.round(cx)}px`;
      y = `${Math.round(cy)}px`;
    }
  }
  style.setProperty("--hub-wipe-x", x);
  style.setProperty("--hub-wipe-y", y);
}

/**
 * Switches the live theme from the picker. With view transitions available and motion
 * allowed, the snapshot swap waits for the preloaded chunk (at most 300 ms); otherwise
 * the swap is instant. `afterSwap` runs once the new theme is bound (or at once when
 * `to` is already active).
 */
export function switchTheme(
  to: HubThemeKey,
  preload: Promise<unknown> | null,
  page: PageModel | null,
  afterSwap: () => void,
): void {
  const from = activeThemeKey();
  if (to === from) {
    afterSwap();
    return;
  }
  const token = beginSwitch();
  const swap = () => {
    cleanupScenes(to);
    applyRootTheme(to);
    const row = themeByKey(to);
    if (row) callGlobal(`__bind${row.bind}`, { softReturn: false } satisfies BindOptions);
    afterSwap();
    emit("hub:theme", { key: to, previous: from, source: "picker" });
  };

  const html = document.documentElement;
  const instant =
    typeof document.startViewTransition !== "function" ||
    isStill() ||
    isNavigating() ||
    html.hasAttribute("data-astro-transition");
  if (instant) {
    clearSwitch();
    swap();
    return;
  }

  html.dataset.hubSwitch = to;
  // The wipes animate a registered custom property; without registration the mask
  // would jump at the midpoint, so those browsers keep the default crossfade.
  if (!("registerProperty" in CSS)) html.dataset.hubWipe = "off";
  try {
    setWipeOrigin(page);
  } catch (error) {
    console.error(error);
  }
  const ready = preload ?? preloadTheme(to);
  const transition = document.startViewTransition(async () => {
    await Promise.race([ready, new Promise((resolve) => setTimeout(resolve, PRELOAD_CAP_MS))]);
    // Teardown or a newer switch invalidated this one: never touch the next page.
    if (isCurrentSwitch(token)) swap();
  });
  transition.ready.catch(() => undefined);
  transition.finished
    .catch(() => undefined)
    .finally(() => {
      if (isCurrentSwitch(token)) clearSwitch();
    });
}
