// CH12: a cassette with a blank label, its reels slowing as the tape runs out.
import type { SceneSize } from "../../../_shared/scene-runtime";
import type { KusabiSceneContext } from "../registry";
import { fill, glow, playScene, stillScene, STONE, vignette } from "./kit";

function reel(c: CanvasRenderingContext2D, x: number, y: number, radius: number, wound: number, angle: number) {
  c.fillStyle = "rgba(12, 11, 10, 1)";
  c.beginPath();
  c.arc(x, y, radius * wound, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = `rgba(${STONE}, 0.28)`;
  c.lineWidth = 1;
  c.stroke();
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.strokeStyle = `rgba(${STONE}, 0.62)`;
  c.lineWidth = Math.max(1.2, radius * 0.08);
  c.beginPath();
  c.arc(0, 0, radius * 0.3, 0, Math.PI * 2);
  for (let i = 0; i < 3; i += 1) {
    const a = (i * Math.PI * 2) / 3;
    c.moveTo(Math.cos(a) * radius * 0.08, Math.sin(a) * radius * 0.08);
    c.lineTo(Math.cos(a) * radius * 0.3, Math.sin(a) * radius * 0.3);
  }
  c.stroke();
  c.restore();
}

/** Turning fast at first and coming to rest by the time the text is complete. */
const turned = (t: number) => {
  const end = 8;
  const clamped = Math.min(t, end);
  return 3.2 * (clamped - (clamped * clamped) / (2 * end));
};

function draw(c: CanvasRenderingContext2D, size: SceneSize, t: number) {
  const { width, height } = size;
  fill(c, size, "#0a0908");
  const w = Math.min(width * 0.82, height * 0.62, 560);
  const h = w * 0.62;
  const x = (width - w) / 2;
  // Above the text, which stays at the middle of the frame.
  const y = height * 0.42 - h;
  const cx = width / 2;

  c.globalCompositeOperation = "screen";
  glow(c, cx, y + h / 2, w * 0.8, STONE, 0.05);
  c.globalCompositeOperation = "source-over";

  c.fillStyle = "#191614";
  c.strokeStyle = `rgba(${STONE}, 0.25)`;
  c.lineWidth = 1.2;
  c.beginPath();
  c.roundRect(x, y, w, h, w * 0.025);
  c.fill();
  c.stroke();

  // The blank paper label, the dimmest thing allowed in the frame.
  c.fillStyle = "rgba(216, 209, 194, 0.16)";
  c.fillRect(x + w * 0.06, y + h * 0.08, w * 0.88, h * 0.26);

  c.fillStyle = "#0d0c0b";
  c.beginPath();
  c.roundRect(x + w * 0.22, y + h * 0.44, w * 0.56, h * 0.32, h * 0.05);
  c.fill();
  c.stroke();

  const radius = w * 0.13;
  const reelY = y + h * 0.6;
  const progress = Math.min(1, t / 8);
  const angle = turned(t);
  reel(c, cx - w * 0.17, reelY, radius, 0.55 + 0.12 * (1 - progress), angle);
  reel(c, cx + w * 0.17, reelY, radius, 0.92 - 0.1 * (1 - progress), angle * 0.74);

  vignette(c, size, 0.82);
}

export const play = (ctx: KusabiSceneContext) => playScene(ctx, draw);
export const still = (ctx: KusabiSceneContext) => stillScene(ctx, draw, 8);
