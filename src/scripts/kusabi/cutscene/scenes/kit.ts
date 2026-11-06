// A thin runner for the five opening scenes: a canvas, a clock, and the epigraph
// advancing with it. Scenes only say what to draw. Black, stone and one lamp: no
// flashes and nothing faster than the rain, so a cutscene can be read through.
import { createScene, type SceneSize } from "../../../_shared/scene-runtime";
import type { KusabiSceneContext, KusabiSceneHandle } from "../registry";

export const INK = "#080606";
export const LAMP = "232, 180, 94";
export const STONE = "200, 192, 182";

export interface SceneTiming {
  /** When the first character appears and the last one has appeared. */
  revealFrom: number;
  revealTo: number;
  /** How long the scene waits for the reader after the text is complete. */
  linger: number;
  /** Turns the share of the time passed into the share of the text shown. Even if left out. */
  pace?(fraction: number): number;
}

export const DEFAULT_TIMING: SceneTiming = { revealFrom: 0.9, revealTo: 6.5, linger: 7 };

export type DrawScene = (c: CanvasRenderingContext2D, size: SceneSize, t: number) => void;

export function playScene(ctx: KusabiSceneContext, draw: DrawScene, timing: SceneTiming = DEFAULT_TIMING): KusabiSceneHandle {
  let size: SceneSize = { width: 1, height: 1, dpr: 1 };
  let ended = false;
  // Wall-clock time, capped so a hidden tab pauses it: the runtime's own clock
  // slows down with the frame rate, and on a slow phone the text must not.
  let clock = 0;
  let last = performance.now();
  const scene = createScene({
    canvas: ctx.canvas,
    container: ctx.stage,
    dprCap: 1.5,
    render(c) {
      const now = performance.now();
      clock += Math.min((now - last) / 1000, 0.25);
      last = now;
      draw(c, size, clock);
      const fraction = (clock - timing.revealFrom) / (timing.revealTo - timing.revealFrom);
      ctx.reveal(timing.pace ? timing.pace(fraction) : fraction);
      if (!ended && clock >= timing.revealTo + timing.linger) {
        ended = true;
        ctx.complete();
      }
    },
    resize(next) {
      size = next;
    },
  });
  scene.start();
  return { pause: () => scene.stop(), dispose: () => scene.destroy() };
}

/** One composed frame for reduced motion: the scene at the given moment. */
export function stillScene(ctx: KusabiSceneContext, draw: DrawScene, at: number): void {
  const scene = createScene({
    canvas: ctx.canvas,
    container: ctx.stage,
    dprCap: 1.5,
    render() {},
    resize(next, c) {
      draw(c, next, at);
    },
  });
  const size = ctx.stage.getBoundingClientRect();
  const c = ctx.canvas.getContext("2d");
  if (c) draw(c, { width: size.width, height: size.height, dpr: 1 }, at);
  ctx.signal.addEventListener("abort", () => scene.destroy(), { once: true });
}

export function fill(c: CanvasRenderingContext2D, size: SceneSize, color = INK): void {
  c.fillStyle = color;
  c.fillRect(0, 0, size.width, size.height);
}

export function vignette(c: CanvasRenderingContext2D, size: SceneSize, strength = 0.75): void {
  const radius = Math.hypot(size.width, size.height) * 0.62;
  const gradient = c.createRadialGradient(size.width / 2, size.height / 2, radius * 0.35, size.width / 2, size.height / 2, radius);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${strength})`);
  c.fillStyle = gradient;
  c.fillRect(0, 0, size.width, size.height);
}

export function glow(c: CanvasRenderingContext2D, x: number, y: number, radius: number, rgb: string, alpha: number): void {
  const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  c.fillStyle = gradient;
  c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/** Stateless falling lines: position comes from the clock, so a still frame works too. */
export function rain(c: CanvasRenderingContext2D, size: SceneSize, t: number, count: number, alpha: number): void {
  c.strokeStyle = `rgba(205, 208, 214, ${alpha})`;
  c.lineWidth = 0.9;
  c.beginPath();
  for (let i = 0; i < count; i += 1) {
    const seedX = (i * 73.13) % 1;
    const seedY = (i * 37.71) % 1;
    const speed = 480 + ((i * 11) % 7) * 60;
    const x = (seedX * 1.1 - 0.05) * size.width;
    const y = ((seedY * size.height + t * speed) % (size.height + 40)) - 20;
    c.moveTo(x, y);
    c.lineTo(x - 1, y + 14 + (i % 5) * 3);
  }
  c.stroke();
}
