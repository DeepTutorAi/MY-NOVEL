// Prologue: a windowless room, the water climbing the wall, and the small drilled
// hole the man finds before his torch dies (prologue, "ช่องเล็ก ๆ บนผนังฝั่งซ้าย").
import { createNoise2D, type SceneSize } from "../../../_shared/scene-runtime";
import type { KusabiSceneContext } from "../registry";
import { fill, glow, playScene, stillScene, STONE, vignette } from "./kit";

const noise = createNoise2D(11);

function draw(c: CanvasRenderingContext2D, size: SceneSize, t: number) {
  const { width, height } = size;
  fill(c, size, "#0b0a09");

  // Boards of the wall, barely there.
  c.strokeStyle = `rgba(${STONE}, 0.1)`;
  c.lineWidth = 1;
  c.beginPath();
  for (let x = width * 0.06; x < width; x += Math.max(70, width * 0.09)) {
    c.moveTo(x, 0);
    c.lineTo(x, height);
  }
  c.stroke();

  const hole = { x: width * 0.2, y: height * 0.3 };
  glow(c, hole.x, hole.y, Math.min(width, height) * 0.09, STONE, 0.22);
  c.fillStyle = "#020202";
  c.beginPath();
  c.arc(hole.x, hole.y, 3.2, 0, Math.PI * 2);
  c.fill();

  const rise = Math.min(1, t / 14);
  const level = height * (0.88 - 0.36 * rise);
  c.beginPath();
  c.moveTo(0, height);
  for (let x = 0; x <= width + 12; x += 12) {
    const wave = noise(x * 0.004, t * 0.22) * 7 + noise(x * 0.016, t * 0.42) * 2.2;
    c.lineTo(x, level + wave);
  }
  c.lineTo(width, height);
  c.closePath();
  const water = c.createLinearGradient(0, level, 0, height);
  water.addColorStop(0, "rgba(78, 84, 90, 0.8)");
  water.addColorStop(1, "rgba(10, 11, 12, 0.96)");
  c.fillStyle = water;
  c.fill();

  c.strokeStyle = `rgba(${STONE}, 0.46)`;
  c.lineWidth = 1;
  c.beginPath();
  for (let x = 0; x <= width + 12; x += 12) {
    const wave = noise(x * 0.004, t * 0.22) * 7 + noise(x * 0.016, t * 0.42) * 2.2;
    if (x === 0) c.moveTo(x, level + wave);
    else c.lineTo(x, level + wave);
  }
  c.stroke();

  vignette(c, size, 0.6);
}

export const play = (ctx: KusabiSceneContext) => playScene(ctx, draw);
export const still = (ctx: KusabiSceneContext) => stillScene(ctx, draw, 9);
