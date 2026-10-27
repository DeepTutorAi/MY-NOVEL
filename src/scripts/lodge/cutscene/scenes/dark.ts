// Chapter 1's cutscene (design section 7.3, revised by the author): the
// epigraph alone on black. The canvas is filled once per size and never
// repainted; each frame only advances the reveal. Timing in dark-core.ts.
import type { SceneFrame } from "../../../_shared/scene-runtime";
import { runLodgeScene } from "../../canvas/kit";
import type { LodgeSceneContext, LodgeSceneHandle } from "../scene-types";
import { DARK, darkReveal } from "./dark-core";

function scene(ctx: LodgeSceneContext, still: boolean) {
  let ended = false;

  const layout = () => {
    const c = ctx.canvas.getContext("2d");
    if (!c) return;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#000";
    c.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    c.restore();
  };

  const draw = (_c: CanvasRenderingContext2D, frame: Readonly<SceneFrame>, moving: boolean) => {
    if (!moving) return;
    ctx.reveal.show(darkReveal(frame.t));
    if (frame.t >= DARK.endS && !ended) {
      ended = true;
      ctx.complete();
    }
  };

  return runLodgeScene({ canvas: ctx.canvas, container: ctx.stage, still, layout, draw });
}

export function play(ctx: LodgeSceneContext): LodgeSceneHandle {
  const handle = scene(ctx, false);
  return {
    pause: () => handle.stop(),
    dispose: () => handle.destroy(),
  };
}

export function still(ctx: LodgeSceneContext): void {
  ctx.reveal.showAll();
  const handle = scene(ctx, true);
  ctx.signal.addEventListener("abort", () => handle.destroy(), { once: true });
}
