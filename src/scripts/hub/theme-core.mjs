// Hub theme registry and resolution. Inlined raw (exports stripped) into the
// head bridge on every page; the bind contract is documented in the spec, 2.5.

/** @typedef {import("./world/types").HubThemeKey} HubThemeKey */
/** @typedef {import("./world/types").HubThemeRow} HubThemeRow */
/** @typedef {import("./world/types").RotationEpoch} RotationEpoch */
/** @typedef {import("./world/types").ResolveInput} ResolveInput */
/** @typedef {import("./world/types").ResolvedTheme} ResolvedTheme */

/** @type {readonly HubThemeRow[]} */
export const HUB_THEMES = [
  { key: "pages-stars", bind: "PagesStarsBg", container: "pages-stars-bg-container", themeColor: "#07060c", enabled: true },
  { key: "skyglass", bind: "SkyglassBg", container: "skyglass-bg-container", themeColor: "#9db8d2", enabled: true },
  { key: "constellation", bind: "DynamicCityBg", container: "constellation-bg-container", themeColor: "#060812", enabled: true },
  { key: "mothlight", bind: "MothlightBg", container: "mothlight-bg-container", themeColor: "#06050b", enabled: true },
  { key: "firefly", bind: "FireflyBg", container: "firefly-bg-container", themeColor: "#050a10", enabled: true },
];

// Append-only: a new epoch starts at a future Monday 07:00 +07:00; never edit a started one.
/** @type {readonly RotationEpoch[]} */
export const ROTATION_EPOCHS = [
  { from: "2026-01-05T07:00:00+07:00", order: ["constellation", "mothlight", "firefly", "pages-stars"] },
  { from: "2026-11-23T07:00:00+07:00", order: ["pages-stars", "skyglass", "constellation", "mothlight", "firefly"] },
];

/** @type {HubThemeKey} */
export const HUB_FALLBACK = "pages-stars";
export const OVERRIDE_KEY = "piichan-novels:theme-override";
export const MOTION_KEY = "piichan-novels:hub-motion";

/**
 * @param {string} bind
 * @returns {string}
 */
export function lowerFirst(bind) {
  return bind.charAt(0).toLowerCase() + bind.slice(1);
}

/**
 * @param {unknown} key
 * @returns {HubThemeRow | null}
 */
export function themeByKey(key) {
  return HUB_THEMES.find((row) => row.key === key) ?? null;
}

/**
 * @param {number} nowMs
 * @param {readonly RotationEpoch[]} [epochs]
 * @returns {HubThemeKey}
 */
export function weeklyTheme(nowMs, epochs = ROTATION_EPOCHS) {
  if (!Number.isFinite(nowMs) || epochs.length === 0) return HUB_FALLBACK;
  let epoch = epochs[0];
  for (const next of epochs) if (Date.parse(next.from) <= nowMs) epoch = next;
  const weeks = Math.floor((nowMs - Date.parse(epoch.from)) / 604800000);
  return epoch.order[weeks >= 0 ? weeks % epoch.order.length : 0];
}

/**
 * @param {ResolveInput} input
 * @returns {ResolvedTheme}
 */
export function resolveTheme({ param, stored, session, nowMs }) {
  const storedRow = themeByKey(stored);
  const invalidStored = stored != null && !storedRow?.enabled;
  const paramRow = themeByKey(param);
  if (paramRow) return { key: paramRow.key, source: "param", invalidStored };
  if (storedRow && !invalidStored) return { key: storedRow.key, source: "stored", invalidStored };
  const sessionRow = themeByKey(session);
  if (sessionRow?.enabled) return { key: sessionRow.key, source: "session", invalidStored };
  return { key: weeklyTheme(nowMs), source: "weekly", invalidStored };
}
