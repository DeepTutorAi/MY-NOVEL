// Neutral Lodge cutscene: the epigraph revealed over charcoal paper with a
// light pencil-stroke snowfall. Any chapter can use it; it is the fallback
// while a chapter has no scene of its own.
import { createRng } from "../../../_shared/scene-runtime";
import { paperGrain, pencilFlake, runLodgeScene, makeLayer } from "../../canvas/kit";
import type { LodgeSceneContext, LodgeSceneHandle } from "../scene-types";

const REVEAL = { from: 1, to: 10 };
const END_S = 16;

function scene(ctx: LodgeSceneContext, still: boolean) {
  const rng = createRng(ctx.chapter + 11);
  let paper: HTMLCanvasElement | null = null;
  let flakes: Array<{ x: number; y: number; v: number; len: number; a: number }> = [];
  let ended = false;
  return runLodgeScene({
    canvas: ctx.canvas,
    container: ctx.stage,
    still,
    layout(size) {
      const layer = makeLayer(size);
      if (!layer) return;
      layer.ctx.fillStyle = "#121110";
      layer.ctx.fillRect(0, 0, size.width, size.height);
      paperGrain(layer.ctx, size.width, size.height, 3, 1.4);
      paper = layer.canvas;
      flakes = Array.from({ length: Math.round((size.width * size.height) / 9000) }, () => ({
        x: rng() * size.width,
        y: rng() * size.height,
        v: 14 + rng() * 30,
        len: 1.5 + rng() * 4,
        a: 0.12 + rng() * 0.3,
      }));
    },
    draw(c, frame, moving) {
      c.setTransform(frame.dpr, 0, 0, frame.dpr, 0, 0);
      if (paper) c.drawImage(paper, 0, 0, frame.width, frame.height);
      for (const flake of flakes) {
        if (moving) {
          flake.y += flake.v * frame.dt;
          flake.x += flake.v * 0.35 * frame.dt;
          if (flake.y > frame.height + 8) flake.y = -8;
          if (flake.x > frame.width + 8) flake.x = -8;
        }
        pencilFlake(c, flake.x, flake.y, flake.len, Math.atan2(1, 0.35) + Math.PI, flake.a);
      }
      if (!moving) return;
      ctx.reveal.show((frame.t - REVEAL.from) / (REVEAL.to - REVEAL.from));
      if (frame.t >= END_S && !ended) {
        ended = true;
        ctx.complete();
      }
    },
  });
}

export function play(ctx: LodgeSceneContext): LodgeSceneHandle {
  const handle = scene(ctx, false);
  return { pause: () => handle.stop(), dispose: () => handle.destroy() };
}

export function still(ctx: LodgeSceneContext): void {
  ctx.reveal.showAll();
  const handle = scene(ctx, true);
  ctx.signal.addEventListener("abort", () => handle.destroy(), { once: true });
}
