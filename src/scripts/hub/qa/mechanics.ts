// Mechanics table (spec 3.0, 8.4 item 31). SELF-REPORTED: each row is what the
// theme unit states its theme does for that slot; the contract test only checks
// that every slot is filled, and the e2e fires each slot's keyboard or still path
// to look for a still-checksum or attribute change. Each theme unit owns its rows in
// qa/themes/<key>.ts; this module aggregates them.

import type { HubThemeKey } from "../world/types";
import * as constellation from "./themes/constellation";
import * as firefly from "./themes/firefly";
import * as mothlight from "./themes/mothlight";
import * as pagesStars from "./themes/pages-stars";
import * as skyglass from "./themes/skyglass";

export const MECHANICS_SELF_REPORTED = true;

export const MECHANIC_SLOTS = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12"] as const;
export type MechanicSlot = (typeof MECHANIC_SLOTS)[number];

export interface MechanicRow {
  theme: HubThemeKey;
  slot: MechanicSlot;
  /** What a mouse or pen does. */
  pointer: string;
  /** What touch does. */
  touch: string;
  /** What the keyboard does (hit buttons, focus, Enter, arrows). */
  keyboard: string;
  /** What the reduced-motion and paused still shows after the event. */
  still: string;
}

/** Rows as each theme's own file declares them. */
export const MECHANICS_BY_THEME: Readonly<Record<HubThemeKey, readonly MechanicRow[]>> = {
  "pages-stars": pagesStars.mechanics,
  skyglass: skyglass.mechanics,
  constellation: constellation.mechanics,
  mothlight: mothlight.mechanics,
  firefly: firefly.mechanics,
};

export const MECHANICS: readonly MechanicRow[] = Object.values(MECHANICS_BY_THEME).flat();

/** Every missing or empty cell for the given themes, as readable lines. */
export function mechanicsGaps(rows: readonly MechanicRow[], themes: readonly HubThemeKey[]): string[] {
  const gaps: string[] = [];
  for (const theme of themes) {
    for (const slot of MECHANIC_SLOTS) {
      const matches = rows.filter((row) => row.theme === theme && row.slot === slot);
      if (matches.length !== 1) {
        gaps.push(`${theme} ${slot}: ${matches.length} rows (exactly 1 expected)`);
        continue;
      }
      for (const field of ["pointer", "touch", "keyboard", "still"] as const) {
        if (!matches[0][field].trim()) gaps.push(`${theme} ${slot}: empty ${field}`);
      }
    }
  }
  return gaps;
}
