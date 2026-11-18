// Theme binding for the hub chrome (spec 2.14): the active key, scene bind and cleanup,
// and the switch markers that page teardown and navigation reset. The picker's switch
// itself lives in chrome-switch.ts, which loads with the picker.

import { HUB_FALLBACK, HUB_THEMES, lowerFirst, themeByKey } from "../theme-core.mjs";
import { callGlobal, globals } from "./chrome-dom";
import type { BindOptions, HubThemeKey } from "./types";

/** The head bridge's API, when the bridge is on the page (spec 2.14 step 1). */
interface ThemeBridge {
  set?(key: HubThemeKey | null): void;
  setMotion?(still: boolean): void;
}

export const bridge = () => globals().__hubTheme as ThemeBridge | undefined;

let navigating = false;
let switchToken = 0;

/** The theme named on the root, or the no-JS fallback when it is absent or unknown. */
export function activeThemeKey(): HubThemeKey {
  return themeByKey(document.documentElement.dataset.hubTheme)?.key ?? HUB_FALLBACK;
}

/** Calls __<bind>Cleanup for every registry row except `except`. */
export function cleanupScenes(except: HubThemeKey | null = null): void {
  for (const row of HUB_THEMES) {
    if (row.key !== except) callGlobal(`__${lowerFirst(row.bind)}Cleanup`);
  }
}

/** Stops every other scene, then calls __bind<Bind>(options) for `key`. */
export function bindTheme(key: HubThemeKey, options: BindOptions): void {
  cleanupScenes(key);
  const row = themeByKey(key);
  if (row) callGlobal(`__bind${row.bind}`, options);
}

/** True while the theme's scene reports itself live. */
export function sceneLive(key: HubThemeKey): boolean {
  const row = themeByKey(key);
  return Boolean(row && globals()[`__${lowerFirst(row.bind)}Initialized`] === true);
}

export function setNavigating(value: boolean): void {
  navigating = value;
}

/** True between astro:before-preparation and the next page's chrome setup. */
export const isNavigating = () => navigating;

/** Starts a switch and returns its token; teardown invalidates every earlier token. */
export const beginSwitch = () => ++switchToken;

export const isCurrentSwitch = (token: number) => token === switchToken;

/** Removes the switch marker and the wipe origin from the root. */
export function clearSwitch(): void {
  const html = document.documentElement;
  delete html.dataset.hubSwitch;
  html.style.removeProperty("--hub-wipe-x");
  html.style.removeProperty("--hub-wipe-y");
}

/** Cancels the switch markers when the page is torn down mid-switch. */
export function resetSwitch(): void {
  switchToken++;
  navigating = false;
  clearSwitch();
}
