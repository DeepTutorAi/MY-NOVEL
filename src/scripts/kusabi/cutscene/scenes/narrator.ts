// The Extra chapters: a voice over a slow reel and one lamp. The text carries the scene, so
// nothing here competes with it, and nothing flashes.
import type { SceneSize } from "../../../_shared/scene-runtime";
import { narrationPace } from "../narration-core";
import type { KusabiSceneContext } from "../registry";
import { fill, glow, LAMP, playScene, stillScene, STONE, vignette } from "./kit";

const REVEAL_FROM_S = 1;
const LINGER_S = 12;

function draw(c: CanvasRenderingContext2D, size: SceneSize, t: number) {
  const { width, height } = size;
  fill(c, size);
  const radius = Math.min(width, height) * 0.36;
  const x = width - radius * 0.55;
  const y = height - radius * 0.45;

  c.globalCompositeOperation = "screen";
  glow(c, x - radius * 0.9, y - radius * 0.9, radius * 2.4, LAMP, 0.07 + 0.012 * Math.sin(t * 0.6));
  c.globalCompositeOperation = "source-over";

  c.save();
  c.translate(x, y);
  c.rotate(t * 0.22);
  c.strokeStyle = `rgba(${STONE}, 0.16)`;
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(0, 0, radius, 0, Math.PI * 2);
  c.moveTo(radius * 0.2, 0);
  c.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
  for (let i = 0; i < 3; i += 1) {
    const angle = (i * Math.PI * 2) / 3;
    c.moveTo(Math.cos(angle) * radius * 0.2, Math.sin(angle) * radius * 0.2);
    c.lineTo(Math.cos(angle) * radius * 0.92, Math.sin(angle) * radius * 0.92);
  }
  c.stroke();
  c.restore();

  vignette(c, size, 0.6);
}

export function play(ctx: KusabiSceneContext) {
  const { duration, pace } = narrationPace(ctx.text);
  return playScene(ctx, draw, { revealFrom: REVEAL_FROM_S, revealTo: REVEAL_FROM_S + duration, linger: LINGER_S, pace });
}

export function still(ctx: KusabiSceneContext) {
  stillScene(ctx, draw, 4);
}
