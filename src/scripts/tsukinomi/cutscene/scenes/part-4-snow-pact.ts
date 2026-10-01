// STUB scene for part 4, snow pact.
// Plate: the part 4 background washed snow blue. The epigraph is
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
  tint: "linear-gradient(180deg, rgba(159, 182, 221, 0.1), rgba(32, 44, 78, 0.3))",
  scrim: 0.5,
};

export function play(ctx: TsukiSceneContext): TsukiSceneHandle {
  return playPlateReveal(ctx, LOOK);
}

export function still(ctx: TsukiSceneContext): void {
  showPlateStill(ctx, LOOK);
}
