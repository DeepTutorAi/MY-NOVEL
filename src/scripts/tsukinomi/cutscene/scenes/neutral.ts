// The fallback scene for a part that has none of its own (registry.ts): the
// epigraph on a black plate, revealed one character at a time, silent. It is
// permanent, unlike the six stubs, and shares its look with them through
// plate-reveal.ts.
import type { TsukiSceneContext, TsukiSceneHandle } from "../scene-types";
import { playPlateReveal, showPlateStill, type PlateLook } from "./plate-reveal";

const LOOK: PlateLook = { tint: null, scrim: 0 };

export function play(ctx: TsukiSceneContext): TsukiSceneHandle {
  return playPlateReveal(ctx, LOOK);
}

export function still(ctx: TsukiSceneContext): void {
  showPlateStill(ctx, LOOK);
}
