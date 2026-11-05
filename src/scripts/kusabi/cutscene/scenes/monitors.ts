// CH11: two old screens in the dark (ch11:209 "จอภาพเก่าสองจอ"), showing only
// snow. The static is a slow drift of low contrast, never a flash.
import { createRng, type SceneSize } from "../../../_shared/scene-runtime";
import type { KusabiSceneContext } from "../registry";
import { fill, glow, playScene, stillScene, STONE, vignette } from "./kit";

let tile: HTMLCanvasElement | null = null;

function staticTile(): HTMLCanvasElement {
  if (tile) return tile;
  tile = document.createElement("canvas");
  tile.width = 160;
  tile.height = 160;
  const c = tile.getContext("2d");
  if (c) {
    const rng = createRng(11);
    const image = c.createImageData(160, 160);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = 30 + rng() * 70;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value + 4;
      image.data[i + 3] = 255;
    }
    c.putImageData(image, 0, 0);
  }
  return tile;
}

function screen(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, drift: number) {
  c.save();
  c.beginPath();
  c.roundRect(x, y, w, h, Math.min(w, h) * 0.08);
  c.clip();
  const source = staticTile();
  const stepped = Math.floor(t * 5) / 5;
  const offsetX = (stepped * 61 * drift) % 160;
  const offsetY = (stepped * 97) % 160;
  for (let px = x - offsetX; px < x + w; px += 160) {
    for (let py = y - offsetY; py < y + h; py += 160) c.drawImage(source, px, py);
  }
  c.fillStyle = "rgba(0, 0, 0, 0.3)";
  for (let line = y; line < y + h; line += 4) c.fillRect(x, line, w, 1);
  const bar = y + ((t * 0.09 * drift) % 1) * h;
  c.fillStyle = "rgba(220, 220, 225, 0.05)";
  c.fillRect(x, bar, w, h * 0.09);
  c.restore();
  c.strokeStyle = `rgba(${STONE}, 0.3)`;
  c.lineWidth = 1.4;
  c.beginPath();
  c.roundRect(x, y, w, h, Math.min(w, h) * 0.08);
  c.stroke();
}

function draw(c: CanvasRenderingContext2D, size: SceneSize, t: number) {
  const { width, height } = size;
  fill(c, size, "#070606");
  const narrow = width < height * 0.9;
  const w = narrow ? width * 0.62 : Math.min(width * 0.3, height * 0.42);
  const h = w * 0.76;
  const gap = width * 0.03;
  // The screens leave the middle of the frame to the text.
  const top = height * 0.42 - h;
  const first = narrow ? { x: (width - w) / 2, y: height * 0.4 - h } : { x: width / 2 - w - gap / 2, y: top };
  const second = narrow ? { x: (width - w) / 2, y: height * 0.6 } : { x: width / 2 + gap / 2, y: top };
  c.globalCompositeOperation = "screen";
  glow(c, width / 2, narrow ? height / 2 : top + h / 2, Math.max(w, h) * 1.6, STONE, 0.07);
  c.globalCompositeOperation = "source-over";
  screen(c, first.x, first.y, w, h, t, 1);
  screen(c, second.x, second.y, w, h, t, 1.7);
  c.fillStyle = "rgba(8, 6, 6, 0.16)";
  c.fillRect(0, 0, width, height);
  vignette(c, size, 0.8);
}

export const play = (ctx: KusabiSceneContext) => playScene(ctx, draw);
export const still = (ctx: KusabiSceneContext) => stillScene(ctx, draw, 3);
