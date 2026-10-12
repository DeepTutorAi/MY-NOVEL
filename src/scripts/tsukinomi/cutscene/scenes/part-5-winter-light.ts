// Part 5, winter light: ten years in a few seconds (design 4.3).
//
// The pale dawn plate of part 5: the empty clearing where the station stood,
// its wooden sign still there. Time runs fast over it: lights race along the
// horizon like the years' traffic, and the seasons wash over the clearing
// again and again (petals, green, falling leaves, snow) while the sign stays
// where it is. Then the wind carries one thread of the old song through, a
// line of light like the earphone's wire with a single sakura petal at its
// head; the seasons come to rest on this winter's dawn, the light comes up,
// and the snow falls gently (r2-core.ts, P5).
//
// Flash safety: the seasons are colour washes of about the same brightness,
// eased into one another; nothing blinks, and the dawn comes up in one long
// fade.
import { createRng, type SceneSize } from "../../../_shared/scene-runtime";
import type { TsukiSceneContext, TsukiSceneHandle } from "../scene-types";
import { injectSceneStyles } from "../styles";
import {
  drawPetal,
  drawTextScrim,
  makeLayer,
  petalSprites,
  platePoint,
  radialSprite,
  runCanvasScene,
  softenedPlate,
  splitGlyphs,
  stillCanvas,
  textBox,
  type Box,
  type Ctx,
} from "./kit";
import { P5, SEASONS, envelope, p5Season, phase, smooth, type Season } from "./r2-core";
import css from "./part-5-winter-light.css?inline";

const SEED = 0x7035;
const WARM = "255, 214, 160";
const DAWN = "255, 236, 206";

/** Each season's wash, all of about the same brightness so a turn of the year never flashes. */
const WASH: Readonly<Record<Season, [number, number, number]>> = {
  spring: [240, 172, 196],
  summer: [140, 202, 150],
  autumn: [226, 150, 84],
  winter: [176, 196, 232],
};

/** Where the plate's rising sun is in the picture, as fractions of its width and height. */
const SUN_IN_PLATE = { x: 0.795, y: 0.41 };

interface Layout {
  w: number;
  h: number;
  unit: number;
  /** The far horizon the lights race along. */
  horizonY: number;
  /** The plate's sun, on screen. */
  sun: { x: number; y: number };
}

function layoutOf(w: number, h: number): Layout {
  return { w, h, unit: Math.min(w, h), horizonY: h * 0.58, sun: platePoint(w, h, SUN_IN_PLATE.x, SUN_IN_PLATE.y) };
}

/** The seasons' falling things: a petal, a leaf of summer green, an autumn leaf, a snowflake. */
function seasonSprites(dpr: number): Record<Season, HTMLCanvasElement> {
  const petal = petalSprites(dpr)[1];
  const leaf = (fill: string) => {
    const { canvas, ctx } = makeLayer(24, 24, dpr);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(12, 2);
    ctx.quadraticCurveTo(22, 10, 12, 22);
    ctx.quadraticCurveTo(2, 10, 12, 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.beginPath();
    ctx.moveTo(12, 3);
    ctx.lineTo(12, 21);
    ctx.stroke();
    return canvas;
  };
  const flake = radialSprite(12, dpr, [
    [0, "rgba(255, 255, 255, 1)"],
    [0.35, "rgba(255, 255, 255, 0.6)"],
    [1, "rgba(255, 255, 255, 0)"],
  ]);
  return { spring: petal, summer: leaf("#7fbf7a"), autumn: leaf("#d9783a"), winter: flake };
}

interface Faller {
  /** The season it fell in. */
  season: Season;
  x: number;
  y: number;
  vy: number;
  sway: number;
  size: number;
  rot: number;
  spin: number;
}

interface Streak {
  x: number;
  y: number;
  speed: number;
  length: number;
  warm: boolean;
}

/** How strongly a season colours the clearing while the years run, and this winter once they stop. */
const YEARS_WASH = 0.55;
const REST_WASH = 0.25;

function paintClearing(c: Ctx, l: Layout, image: HTMLImageElement | null, dpr: number): void {
  c.fillStyle = "#cfd3dc";
  c.fillRect(0, 0, l.w, l.h);
  if (image) c.drawImage(softenedPlate(image, l.w, l.h, dpr, 1.2), 0, 0, l.w, l.h);
}

/** The clearing coloured by one season's wash, painted once. */
function washedClearing(l: Layout, image: HTMLImageElement | null, season: Season, strength: number): HTMLCanvasElement {
  const { canvas, ctx } = makeLayer(l.w, l.h, 1);
  paintClearing(ctx, l, image, 1);
  const [r, g, b] = WASH[season];
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = strength;
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, l.w, l.h);
  return canvas;
}

export function play(ctx: TsukiSceneContext): TsukiSceneHandle {
  injectSceneStyles(css, ctx.signal);
  const { stage, textEl } = ctx;
  const split = splitGlyphs(textEl);
  textEl.classList.add("tsuki-p5-text");
  if (ctx.audio.available()) ctx.audio.setCue("ten-years");

  let l = layoutOf(1, 1);
  let plate: HTMLCanvasElement | null = null;
  const washed = {} as Record<Season, HTMLCanvasElement>;
  let fallSprites: Record<Season, HTMLCanvasElement> | null = null;
  let petal: HTMLCanvasElement | null = null;
  let spark: HTMLCanvasElement | null = null;
  let sun: HTMLCanvasElement | null = null;
  let fallers: Faller[] = [];
  let streaks: Streak[] = [];
  let box: Box | null = null;
  let boxAge = 0;
  let textShown = false;
  const rng = createRng(SEED);

  const spawnFaller = (f: Faller | null, anywhere: boolean): Faller => {
    const faller = f ?? ({ season: "winter" } as Faller);
    faller.x = rng() * l.w;
    faller.y = anywhere ? rng() * l.h : -20;
    // Time-lapse speed: a few seconds from the top to the snow.
    faller.vy = l.h * (0.22 + rng() * 0.2);
    faller.sway = rng() * 6.28;
    faller.size = l.unit * (0.012 + rng() * 0.014);
    faller.rot = rng() * 6.28;
    faller.spin = (rng() - 0.5) * 2;
    return faller;
  };

  const layout = (size: Readonly<SceneSize>, image: HTMLImageElement | null) => {
    l = layoutOf(size.width, size.height);
    // The plates are soft already: one backing pixel per CSS pixel is enough for them.
    plate = washedClearing(l, image, "winter", REST_WASH);
    for (const season of SEASONS) washed[season] = washedClearing(l, image, season, YEARS_WASH);
    fallSprites = seasonSprites(size.dpr);
    petal = petalSprites(size.dpr)[0];
    spark = radialSprite(6, size.dpr, [
      [0, "rgba(255, 246, 228, 1)"],
      [0.3, `rgba(${WARM}, 0.5)`],
      [1, `rgba(${WARM}, 0)`],
    ]);
    sun = radialSprite(l.unit * 0.42, size.dpr, [
      [0, `rgba(${DAWN}, 0.7)`],
      [0.2, `rgba(${DAWN}, 0.25)`],
      [1, `rgba(${DAWN}, 0)`],
    ]);
    if (fallers.length === 0) fallers = Array.from({ length: 90 }, () => spawnFaller(null, true));
    box = null;
  };

  /** The thread of the song: a gently waving line of light across the screen, its head at `head` (0..1). */
  const drawThread = (c: Ctx, head: number, t: number, alpha: number): { x: number; y: number } => {
    const { w, h } = l;
    const points: Array<{ x: number; y: number }> = [];
    const samples = 60;
    const headX = w * 1.1 - head * w * 1.3;
    for (let i = 0; i <= samples; i++) {
      const x = headX + (i / samples) * w * 1.1;
      const y = h * 0.72 - (x / w) * h * 0.2 + Math.sin(x * 0.005 + t * 1.6) * h * 0.06 + Math.sin(x * 0.016 - t * 2.1) * h * 0.018;
      points.push({ x, y });
    }
    c.save();
    c.globalCompositeOperation = "lighter";
    for (const [width, a] of [
      [14, 0.07],
      [5, 0.2],
      [1.6, 0.95],
    ] as const) {
      c.strokeStyle = `rgba(${WARM}, ${(a * alpha).toFixed(3)})`;
      c.lineWidth = width;
      c.beginPath();
      points.forEach((p, i) => (i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y)));
      c.stroke();
    }
    // Sparks shed along it, like notes.
    if (spark) {
      for (let i = 0; i < 14; i++) {
        const k = ((i / 14 + t * 0.15) % 1) * 0.85;
        const p = points[Math.floor(k * samples)];
        const s = 5 + 4 * Math.sin(t * 3 + i);
        c.globalAlpha = alpha * (1 - k) * 0.8;
        c.drawImage(spark, p.x - s / 2, p.y - s / 2 - Math.sin(t * 2 + i) * 6, s, s);
      }
    }
    c.restore();
    return points[0];
  };

  return runCanvasScene(ctx, {
    endS: P5.end,
    className: "tsuki-p5-canvas",
    layout,
    onReady() {
      stage.classList.add("tsuki-p5-ready");
    },
    render(c, info) {
      const { t, dt, width: w, height: h } = info;
      c.clearRect(0, 0, w, h);
      if (!info.ready || !plate || !fallSprites) return;
      boxAge -= dt;
      if (!box || boxAge <= 0) {
        box = textBox(stage, textEl);
        boxAge = 0.5;
      }
      if (!textShown && t >= P5.textInStart) {
        textShown = true;
        textEl.classList.add("tsuki-p5-in");
      }
      const life = envelope(t, 0, 1.2, P5.end - 1.4, P5.end);
      const rest = smooth(phase(t, P5.dawnStart, P5.dawnEnd));
      const years = 1 - rest;

      // The seasons wash over the clearing, each one baked once and cross-faded into the next;
      // this winter's dawn is what is left when they stop.
      const turn = p5Season(t);
      c.globalAlpha = life;
      c.drawImage(washed[turn.season], 0, 0, w, h);
      if (turn.mix > 0.002) {
        c.globalAlpha = life * turn.mix;
        c.drawImage(washed[turn.next], 0, 0, w, h);
      }
      if (rest > 0.002) {
        c.globalAlpha = life * rest;
        c.drawImage(plate, 0, 0, w, h);
      }

      // What falls in each season, changing with it.
      // Each one keeps the season it fell in, so one season's leaves are still falling as the next begins.
      const current = turn.mix < 0.5 ? turn.season : turn.next;
      for (const faller of fallers) {
        faller.y += faller.vy * (0.35 + 0.65 * years) * dt;
        faller.rot += faller.spin * dt;
        if (faller.y > h + 20) {
          spawnFaller(faller, false);
          faller.season = current;
        }
        const x = faller.x + Math.sin(t * 0.8 + faller.sway) * l.unit * 0.02;
        const snow = faller.season === "winter";
        drawPetal(c, fallSprites[faller.season], x, faller.y, faller.size * (snow ? 0.7 : 1), faller.rot, snow ? 0 : t * 2 + faller.sway, life * 0.85);
      }

      // Lights racing along the far horizon: the years' traffic.
      if (years > 0.01) {
        if (streaks.length < 6 && rng() < dt * 3) {
          const right = rng() < 0.5;
          const length = w * (0.1 + rng() * 0.25);
          streaks.push({ x: right ? -length : w, y: l.horizonY + (rng() - 0.5) * h * 0.04, speed: (right ? 1 : -1) * w * (1.2 + rng() * 1.4), length, warm: rng() < 0.6 });
        }
        c.globalCompositeOperation = "lighter";
        streaks = streaks.filter((s) => {
          s.x += s.speed * dt;
          const colour = s.warm ? WARM : "220, 232, 255";
          const g = c.createLinearGradient(s.x, 0, s.x + s.length, 0);
          g.addColorStop(0, `rgba(${colour}, 0)`);
          g.addColorStop(s.speed > 0 ? 0.92 : 0.08, `rgba(${colour}, 0.55)`);
          g.addColorStop(1, `rgba(${colour}, 0)`);
          c.globalAlpha = life * years;
          c.fillStyle = g;
          c.fillRect(s.x, s.y, s.length, Math.max(1.2, h * 0.003));
          return s.x < w + 20 && s.x + s.length > -20;
        });
        c.globalCompositeOperation = "source-over";
      }

      // The dawn coming up when the years have stopped.
      if (rest > 0.01 && sun) {
        const s = sun.width / info.dpr;
        c.globalCompositeOperation = "lighter";
        c.globalAlpha = life * rest * 0.75;
        c.drawImage(sun, l.sun.x - s / 2, l.sun.y - s / 2, s, s);
        c.globalCompositeOperation = "source-over";
        c.globalAlpha = 1;
      }

      // The thread of the song, with its petal.
      const threadAlpha = envelope(t, P5.threadStart, P5.threadStart + 0.8, P5.threadEnd - 1, P5.threadEnd) * life;
      if (threadAlpha > 0.01) {
        const head = drawThread(c, smooth(phase(t, P5.threadStart, P5.threadEnd)), t, threadAlpha);
        if (petal) drawPetal(c, petal, head.x, head.y - 4, l.unit * 0.03, t * 1.4, t * 2.6, threadAlpha);
      }

      drawTextScrim(c, box, life * 0.95);
    },
    cleanup() {
      stage.classList.remove("tsuki-p5-ready");
      textEl.classList.remove("tsuki-p5-text", "tsuki-p5-in");
      split.restore();
    },
  });
}

export function still(ctx: TsukiSceneContext): void {
  injectSceneStyles(css, ctx.signal);
  stillCanvas(
    ctx,
    (c, size, image) => {
      // Where the years come to rest: this winter's dawn over the clearing, snow in the air.
      const l = layoutOf(size.width, size.height);
      c.drawImage(washedClearing(l, image, "winter", REST_WASH), 0, 0, l.w, l.h);
      const rng = createRng(SEED + 2);
      c.fillStyle = "rgba(255, 255, 255, 0.75)";
      for (let i = 0; i < 160; i++) {
        const s = 0.6 + rng() * 1.8;
        c.fillRect(rng() * l.w, rng() * l.h, s, s);
      }
      drawTextScrim(c, textBox(ctx.stage, ctx.textEl), 0.95);
    },
    "tsuki-p5-canvas",
  );
}
