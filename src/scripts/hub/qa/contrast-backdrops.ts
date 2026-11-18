// Declared backdrops for the contrast contract (spec 2.20). Each theme unit
// declares its own in qa/themes/<key>.ts; this module aggregates them. Every list
// holds the extreme colours its scene can show behind that surface: the brightest
// for light text, plus the darkest wherever text or a plate can sit on dark sky.

import type { HubThemeKey } from "../world/types";
import * as constellation from "./themes/constellation";
import * as firefly from "./themes/firefly";
import * as mothlight from "./themes/mothlight";
import * as pagesStars from "./themes/pages-stars";
import * as skyglass from "./themes/skyglass";

export interface ThemeBackdrops {
  /** Sky behind cards, panels and the page background, as opaque CSS colours. */
  page: readonly string[];
  /** Sky behind the hero pool (title, subtitle). Skyglass must include its darkest, #27344d. */
  hero: readonly string[];
  /** Ground window behind the footer pool. */
  footer: readonly string[];
  /** Brightest cover-art edge colours the focus outline can sit against. */
  coverEdges: readonly string[];
  /** Haze plate behind the title group (skyglass): how far it extends past the text box and its blur radius. */
  plate?: { extendPx: number; blurPx: number };
}

const declared: Record<HubThemeKey, ThemeBackdrops | undefined> = {
  "pages-stars": pagesStars.backdrops,
  skyglass: skyglass.backdrops,
  constellation: constellation.backdrops,
  mothlight: mothlight.backdrops,
  firefly: firefly.backdrops,
};

/** Themes that declared backdrops; a theme without an entry fails its contrast test once its CSS exists. */
export const CONTRAST_BACKDROPS: Partial<Record<HubThemeKey, ThemeBackdrops>> = Object.fromEntries(
  Object.entries(declared).filter(([, value]) => value !== undefined),
);
