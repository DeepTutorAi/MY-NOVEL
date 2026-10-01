// STUB scene for part 2, twilight lamp.
// Plate: the part 2 background washed twilight blue. The epigraph is
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
  tint: "linear-gradient(180deg, rgba(205, 211, 224, 0.1), rgba(37, 36, 74, 0.3))",
  scrim: 0.45,
};

export function play(ctx: TsukiSceneContext): TsukiSceneHandle {
  return playPlateReveal(ctx, LOOK);
}

export function still(ctx: TsukiSceneContext): void {
  showPlateStill(ctx, LOOK);
}
