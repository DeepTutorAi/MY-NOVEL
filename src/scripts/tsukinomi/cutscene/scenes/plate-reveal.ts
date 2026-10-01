// The placeholder look shared by the neutral fallback scene and the six stub
// scenes: the part's plate fades in behind the epigraph and the epigraph
// appears one character at a time (the old per-character blur-in), then holds
// for a beat and ends. Runtime scales with the epigraph length.
//
// The stub modules (prologue.ts, part-1-autumn-rain.ts, ...) are thin wrappers
// around this. A scene builder replaces its own file wholesale and stops using
// this module; neutral.ts, the permanent fallback for a part without a scene,
// keeps using it. Once all six are replaced this file is only neutral's.
//
// Its styles (plate-reveal.css) are loaded as a string and injected while the
// scene runs (../styles.ts), so they ship with the scene chunk rather than in
// every section page's stylesheet.
//
// The epigraph stays real text (see plate-core.ts: one <span> per grapheme
// cluster, textContent never changes). The DOM and clock logic lives there,
// and the timing in plate-timing.ts, because this module imports a stylesheet
// and node:test cannot load it.
import type { TsukiSceneContext, TsukiSceneHandle } from "../scene-types";
import { injectSceneStyles } from "../styles";
import { clampScrim, createRevealClock, splitIntoClusters } from "./plate-core";
import { FADE_MS, revealTiming } from "./plate-timing";
import plateCss from "./plate-reveal.css?inline";

export interface PlateLook {
  /**
   * A CSS `background` value laid over the plate (a palette wash or a glow),
   * or null for none. Use rgba colours from the palette tokens.
   */
  tint: string | null;
  /** How much black is laid over the plate image, 0 (none) to 1, for the text's contrast. */
  scrim: number;
}

/** Lays the plate into the stage: the part's background (or black), a tint and a scrim. */
export function applyPlate(ctx: TsukiSceneContext, look: PlateLook): void {
  const { stage } = ctx;
  injectSceneStyles(plateCss, ctx.signal);
  stage.classList.add("tsuki-plate");
  stage.style.setProperty("--tsuki-plate-image", ctx.assets.backgroundCss);
  stage.style.setProperty("--tsuki-plate-scrim", String(clampScrim(look.scrim)));
  stage.style.setProperty("--tsuki-plate-tint", look.tint ?? "none");
}

export function playPlateReveal(ctx: TsukiSceneContext, look: PlateLook): TsukiSceneHandle {
  applyPlate(ctx, look);
  const { textEl, signal } = ctx;
  const timing = revealTiming(splitIntoClusters(textEl));
  textEl.style.setProperty("--tsuki-g-fade", `${FADE_MS}ms`);
  textEl.classList.add("tsuki-reveal");
  const clock = createRevealClock(timing.totalMs, signal);
  return { done: clock.done, dispose: clock.dispose };
}

/** The reduced-motion composition: the plate and the whole epigraph, with nothing animating. */
export function showPlateStill(ctx: TsukiSceneContext, look: PlateLook): void {
  applyPlate(ctx, look);
}
