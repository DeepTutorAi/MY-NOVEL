// Canvas helpers shared by the hub's painted scenes: offscreen surfaces, soft sprites,
// a dither tile for long gradients and a horizontally tiling band of mist.

import { fbm2D } from "../_shared/scene-runtime";

const TAU = Math.PI * 2;

export interface Surface {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
}

export function surface(w: number, h: number): Surface {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(w));
  canvas.height = Math.max(1, Math.ceil(h));
  return { canvas, g: canvas.getContext("2d") as CanvasRenderingContext2D };
}

export function release(...canvases: HTMLCanvasElement[]): void {
  for (const c of canvases) {
    c.width = 0;
    c.height = 0;
  }
}

export function radialSprite(size: number, stops: ReadonlyArray<readonly [number, string]>): HTMLCanvasElement {
  const { canvas, g } = surface(size, size);
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return canvas;
}

/** A soft dot with four thin spikes, for bright stars and big sparks. */
export function flareSprite(size: number, core: string, spike: string): HTMLCanvasElement {
  const { canvas, g } = surface(size, size);
  const r = size / 2;
  g.globalCompositeOperation = "lighter";
  const halo = g.createRadialGradient(r, r, 0, r, r, r * 0.5);
  halo.addColorStop(0, core);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = halo;
  g.fillRect(0, 0, size, size);
  g.translate(r, r);
  for (let i = 0; i < 2; i++) {
    g.rotate((i * Math.PI) / 2);
    const grad = g.createLinearGradient(-r, 0, r, 0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.5, spike);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(-r, 0);
    g.quadraticCurveTo(0, -size * 0.022, r, 0);
    g.quadraticCurveTo(0, size * 0.022, -r, 0);
    g.fill();
  }
  return canvas;
}

/** A faint random tile laid over the sky so its long gradients do not show bands. */
export function paintDither(g: CanvasRenderingContext2D, w: number, h: number, rng: () => number): void {
  const { canvas, g: t } = surface(128, 128);
  const image = t.createImageData(128, 128);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = rng() < 0.5 ? 0 : 255;
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 2 + rng() * 2;
  }
  t.putImageData(image, 0, 0);
  const pattern = g.createPattern(canvas, "repeat");
  if (pattern) {
    g.fillStyle = pattern;
    g.fillRect(0, 0, w, h);
  }
  release(canvas);
}

/** A band of mist that tiles horizontally: its noise walks a circle, so both ends match. */
export function mistTile(noise: (x: number, y: number) => number, r: number, g: number, b: number, alpha: number): HTMLCanvasElement {
  const w = 256;
  const h = 64;
  const { canvas, g: ctx } = surface(w, h);
  const image = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const v = 1 - Math.abs(y / h - 0.55) * 2;
    for (let x = 0; x < w; x++) {
      const a = (x / w) * TAU;
      const n = fbm2D(noise, Math.cos(a) * 1.4 + 5, Math.sin(a) * 1.4 + y * 0.03, 4);
      const i = (y * w + x) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = Math.max(0, Math.min(1, (n * 0.8 + 0.45) * v)) * alpha;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
