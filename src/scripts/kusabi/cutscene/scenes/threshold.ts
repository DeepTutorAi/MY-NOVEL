// CH4: the front of the manor at dusk, seen close. The iron lamp over a door that
// stands ajar, rain behind, and a slow walk towards the gap. Never shows it close.
import { createNoise2D, type SceneSize } from "../../../_shared/scene-runtime";
import { lampLevel } from "../../home/manor-core";
import type { KusabiSceneContext } from "../registry";
import { fill, glow, LAMP, playScene, rain, stillScene, STONE, vignette } from "./kit";

const noise = createNoise2D(4);

function draw(c: CanvasRenderingContext2D, size: SceneSize, t: number) {
  const { width, height } = size;
  fill(c, size, "#0c0b0a");
  rain(c, size, t, 70, 0.14);

  const zoom = 1 + Math.min(1, t / 16) * 0.26;
  const unit = Math.min(width, height) * 0.0026 * zoom;
  const cx = width / 2;
  const base = height * 0.86;
  const doorWidth = 120 * unit;
  const doorHeight = 230 * unit;
  const left = cx - doorWidth / 2;
  const top = base - doorHeight;

  // Stone jambs and arch.
  c.strokeStyle = `rgba(${STONE}, 0.36)`;
  c.lineWidth = Math.max(1, 1.4 * unit);
  c.beginPath();
  c.moveTo(left - 26 * unit, base);
  c.lineTo(left - 26 * unit, top - 8 * unit);
  c.arc(cx, top - 8 * unit, doorWidth / 2 + 26 * unit, Math.PI, 0);
  c.lineTo(left + doorWidth + 26 * unit, base);
  c.stroke();

  // The leaf, turned a little inward, and the dark it leaves.
  const gap = doorWidth * 0.3;
  c.fillStyle = "#020202";
  c.fillRect(left + doorWidth - gap, top, gap, doorHeight);
  c.fillStyle = "#1d1a17";
  c.fillRect(left, top, doorWidth - gap, doorHeight);
  c.strokeStyle = "rgba(0, 0, 0, 0.6)";
  c.lineWidth = 1;
  c.strokeRect(left + 9 * unit, top + 12 * unit, doorWidth - gap - 18 * unit, doorHeight * 0.38);
  c.strokeRect(left + 9 * unit, top + doorHeight * 0.5, doorWidth - gap - 18 * unit, doorHeight * 0.42);

  const level = lampLevel(noise(t * 0.55, 1.7));
  const lampY = top - 34 * unit;
  c.globalCompositeOperation = "screen";
  glow(c, cx, lampY, 190 * unit, LAMP, 0.34 * level);
  glow(c, left + doorWidth - gap * 0.5, base - doorHeight * 0.5, 80 * unit, LAMP, 0.05 * level);
  c.globalCompositeOperation = "source-over";
  c.fillStyle = `rgba(${LAMP}, ${0.5 + 0.5 * level})`;
  c.fillRect(cx - 4 * unit, lampY - 7 * unit, 8 * unit, 13 * unit);
  c.strokeStyle = "rgba(0, 0, 0, 0.9)";
  c.lineWidth = Math.max(1, unit);
  c.strokeRect(cx - 5 * unit, lampY - 8 * unit, 10 * unit, 15 * unit);

  vignette(c, size);
}

export const play = (ctx: KusabiSceneContext) => playScene(ctx, draw);
export const still = (ctx: KusabiSceneContext) => stillScene(ctx, draw, 6);
