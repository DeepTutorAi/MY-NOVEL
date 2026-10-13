// Chapter 6's cutscene (design section 7.3): the living room of plate 06A in
// darkness, a faint fire breathing in the grate. The reader's pointer is a
// lamp that shows what it touches; without a pointer the lamp wanders the room
// by itself. Wherever the lamp leaves, the dark returns at once, except on Ben,
// where the light stays half a second too long. Rules in lamp-core.ts.
import type { SceneFrame, SceneSize } from "../../../_shared/scene-runtime";
import { erase, loadPlate, makeLayer, paperGrain, runLodgeScene } from "../../canvas/kit";
import { coverRect, platePoint, type Rect } from "../../canvas/kit-core";
import type { LodgeSceneContext, LodgeSceneHandle } from "../scene-types";
import { LAMP, autoPath, firelight, followLamp, inBen, lampRadius, lampReveal, trailAlpha } from "./lamp-core";

const PLATE = "chapters/06A.webp";
const FIRE = { u: 0.72, v: 0.46 };
/** The dark is drawn at half resolution: it is all soft gradients. */
const MASK_SCALE = 0.5;

interface TrailPoint {
  u: number;
  v: number;
  t: number;
}

function scene(ctx: LodgeSceneContext, still: boolean) {
  const abort = new AbortController();
  let plate: HTMLImageElement | null = null;
  let size: SceneSize | null = null;
  let rect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  let base: HTMLCanvasElement | null = null;
  let mask: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
  let trail: TrailPoint[] = [];
  let lastTrailAt = -Infinity;
  /** Where the lamp is, in stage pixels; it follows its target at a capped speed (flash safety). */
  let lampAt: { x: number; y: number } | null = null;
  let ended = false;

  const bake = (next: SceneSize) => {
    size = next;
    const { width: w, height: h } = next;
    const layer = makeLayer(next);
    if (!layer) return;
    const c = layer.ctx;
    c.fillStyle = "#0b0a09";
    c.fillRect(0, 0, w, h);
    if (plate) {
      rect = coverRect(plate.naturalWidth, plate.naturalHeight, w, h);
      // Keep Ben in view when the screen is narrow: anchor the crop on him.
      if (rect.w > w) rect.x = Math.min(0, Math.max(w - rect.w, w * 0.5 - rect.w * 0.44));
      c.filter = "grayscale(1) contrast(1.08) brightness(0.86)";
      c.drawImage(plate, rect.x, rect.y, rect.w, rect.h);
      c.filter = "none";
    }
    paperGrain(c, w, h, 61, 1.1);
    base = layer.canvas;
    const maskSize = { width: Math.ceil(w * MASK_SCALE), height: Math.ceil(h * MASK_SCALE), dpr: 1 };
    mask = makeLayer(maskSize);
  };

  const toPlate = (x: number, y: number) => ({ u: (x - rect.x) / rect.w, v: (y - rect.y) / rect.h });

  const light = (m: CanvasRenderingContext2D, u: number, v: number, radius: number, alpha: number) => {
    const p = platePoint(rect, u, v);
    const x = p.x * MASK_SCALE;
    const y = p.y * MASK_SCALE;
    const r = radius * MASK_SCALE;
    const g = m.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${alpha})`);
    g.addColorStop(0.55, `rgba(0,0,0,${alpha * 0.7})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    m.fillStyle = g;
    m.fillRect(x - r, y - r, r * 2, r * 2);
  };

  const draw = (c: CanvasRenderingContext2D, frame: Readonly<SceneFrame>, moving: boolean) => {
    const { t, width: w, height: h } = frame;
    c.setTransform(frame.dpr, 0, 0, frame.dpr, 0, 0);
    if (base) c.drawImage(base, 0, 0, w, h);
    if (!mask) return;
    const radius = lampRadius(w, h);

    // Where the lamp is now: the pointer while one is over the scene, else its own wander.
    const wander = autoPath(t);
    const target = frame.pointer.active ? { x: frame.pointer.x, y: frame.pointer.y } : { x: wander.x * w, y: wander.y * h };
    lampAt = lampAt === null ? target : followLamp(lampAt, target, radius, frame.dt);
    const here = moving ? toPlate(lampAt.x, lampAt.y) : { u: 0.44, v: 0.4 };
    if (moving && t - lastTrailAt >= LAMP.trailEveryS) {
      lastTrailAt = t;
      trail.push({ ...here, t });
      trail = trail.filter((point) => t - point.t <= LAMP.lingerS);
    }

    const m = mask.ctx;
    m.globalCompositeOperation = "source-over";
    m.clearRect(0, 0, mask.canvas.width, mask.canvas.height);
    m.fillStyle = "rgba(5,5,5,0.95)";
    m.fillRect(0, 0, mask.canvas.width, mask.canvas.height);
    erase(m, () => {
      light(m, FIRE.u, FIRE.v, radius * 1.3, 0.32 * (moving ? firelight(t) : 1));
      for (const point of trail) {
        const alpha = trailAlpha(t - point.t, inBen(point.u, point.v));
        if (alpha > 0) light(m, point.u, point.v, radius, alpha);
      }
      light(m, here.u, here.v, radius, 1);
    });
    c.drawImage(mask.canvas, 0, 0, w, h);

    if (moving) {
      ctx.reveal.show(lampReveal(t));
      if (t >= LAMP.endS && !ended) {
        ended = true;
        ctx.complete();
      }
    }
  };

  const handle = runLodgeScene({ canvas: ctx.canvas, container: ctx.stage, still, layout: bake, draw });
  void loadPlate(ctx.assetUrl(PLATE), abort.signal)
    .then((image) => {
      plate = image;
      if (size) bake(size);
      handle.redrawStill();
    })
    .catch(() => {
      // Without the plate the room stays dark and the lamp shows paper.
    });
  return { handle, cleanup: () => abort.abort() };
}

export function play(ctx: LodgeSceneContext): LodgeSceneHandle {
  const { handle, cleanup } = scene(ctx, false);
  return {
    pause: () => handle.stop(),
    dispose: () => {
      cleanup();
      handle.destroy();
    },
  };
}

export function still(ctx: LodgeSceneContext): void {
  ctx.reveal.showAll();
  const { handle, cleanup } = scene(ctx, true);
  ctx.signal.addEventListener(
    "abort",
    () => {
      cleanup();
      handle.destroy();
    },
    { once: true },
  );
}
