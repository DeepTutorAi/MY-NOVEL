// STUB scene for part 5, winter light.
// Plate: the part 5 background washed pale winter. The epigraph is
// revealed one character at a time, held for a beat, then the scene ends.
// Silent. It only satisfies the contract in ../scene-types.ts until the real
// scene is built.
//
// To replace it, overwrite this file wholesale with a module that exports
// play(ctx) and still(ctx) (see scene-types.ts); the registry already points
// here. Put the scene's styles in an optional sibling CSS file imported from
// this module. Run it with ?cutscene=replay on the part's page.
import type { TsukiSceneContext, TsukiSceneHandle } from "../scene-types";
import { playPlateReveal, showPlateStill, type PlateLook } from "./plate-reveal";

const LOOK: PlateLook = {
  tint: "linear-gradient(180deg, rgba(232, 237, 245, 0.12), rgba(205, 211, 224, 0.06))",
  scrim: 0.5,
};

export function play(ctx: TsukiSceneContext): TsukiSceneHandle {
  return playPlateReveal(ctx, LOOK);
}

export function still(ctx: TsukiSceneContext): void {
  showPlateStill(ctx, LOOK);
}
