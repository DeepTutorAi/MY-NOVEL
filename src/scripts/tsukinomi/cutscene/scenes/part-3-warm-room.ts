// STUB scene for part 3, warm room.
// Plate: the part 3 background with a warm lamp glow. The epigraph is
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
  tint: "radial-gradient(ellipse at 50% 65%, rgba(224, 138, 76, 0.22), transparent 65%)",
  scrim: 0.4,
};

export function play(ctx: TsukiSceneContext): TsukiSceneHandle {
  return playPlateReveal(ctx, LOOK);
}

export function still(ctx: TsukiSceneContext): void {
  showPlateStill(ctx, LOOK);
}
