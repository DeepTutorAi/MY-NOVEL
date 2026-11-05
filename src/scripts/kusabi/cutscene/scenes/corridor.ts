// CH8: a long corridor in torchlight, the floor wet enough to hold the beam.
import { createNoise2D, type SceneSize } from "../../../_shared/scene-runtime";
import type { KusabiSceneContext } from "../registry";
import { fill, glow, playScene, stillScene, STONE, vignette } from "./kit";

const noise = createNoise2D(8);

function draw(c: CanvasRenderingContext2D, size: SceneSize, t: number) {
  const { width, height } = size;
  fill(c, size, "#090808");
  const vanish = { x: width / 2 + noise(t * 0.06, 2) * width * 0.02, y: height * 0.44 };
  const floorY = height * 0.98;

  // Wall and floor lines running to one point.
  c.strokeStyle = `rgba(${STONE}, 0.24)`;
  c.lineWidth = 1;
  c.beginPath();
  for (const edge of [0, width]) {
    for (const y of [0, height * 0.22, height * 0.72, floorY]) {
      c.moveTo(edge, y);
      c.lineTo(vanish.x, vanish.y);
    }
  }
  for (let i = 1; i < 8; i += 1) {
    const depth = (((i + t * 0.05) % 8) / 8) ** 2;
    const y = vanish.y + (floorY - vanish.y) * depth;
    const spread = (width / 2) * depth;
    c.moveTo(vanish.x - spread, y);
    c.lineTo(vanish.x + spread, y);
  }
  c.stroke();

  // The torch wanders, as a held torch does.
  const beamX = vanish.x + noise(t * 0.32, 7) * width * 0.12;
  const beamY = vanish.y + height * 0.03 + noise(t * 0.28, 9) * height * 0.04;
  c.globalCompositeOperation = "screen";
  glow(c, beamX, beamY, Math.min(width, height) * 0.5, STONE, 0.3);
  glow(c, beamX, floorY - height * 0.1, Math.min(width, height) * 0.42, STONE, 0.2);
  c.globalCompositeOperation = "source-over";

  // Rings where the ceiling drips into the floor water.
  c.lineWidth = 0.8;
  for (let i = 0; i < 5; i += 1) {
    const phase = (t * 0.32 + i * 0.21) % 1;
    const x = width * (0.28 + ((i * 0.37) % 1) * 0.44);
    const y = height * (0.76 + ((i * 0.53) % 1) * 0.18);
    const rx = 4 + phase * width * 0.03;
    c.strokeStyle = `rgba(${STONE}, ${0.34 * (1 - phase)})`;
    c.beginPath();
    c.ellipse(x, y, rx, rx * 0.26, 0, 0, Math.PI * 2);
    c.stroke();
  }

  vignette(c, size, 0.7);
}

export const play = (ctx: KusabiSceneContext) => playScene(ctx, draw);
export const still = (ctx: KusabiSceneContext) => stillScene(ctx, draw, 5);
