// Part 2, twilight: the lamp and the girl with no shadow (design 4.3).
//
// The violet plate of part 2, a platform lamp switched on at dusk, a bench
// under it. Petals fall through the light and every one of them throws a
// shadow on the platform, away from the lamp; so does the bench, so does the
// Walkman left on it. The girl sitting beside it, a pale shape in the lamp's
// light, throws none.
//
// Then the tape drops out (r2-core.ts, P2): the picture tears into bands that
// slide sideways, the petals stop in the air and the epigraph's letters drift
// apart. The tape rewinds (the rewind sound, when the Walkman is on): the
// petals fly back up, the letters fly home. Then time runs forward again and
// the scene ends.
//
// Flash safety: the tear moves strips of the picture sideways a few times a
// second and never changes its brightness; nothing on screen blinks.
//
// The epigraph stays real text: it is split into inline spans per grapheme
// cluster (kit.ts) that the stylesheet fades in and that the scatter only
// offsets with relative positioning, so lines never re-break.
import { createRng, type SceneSize } from "../../../_shared/scene-runtime";
import type { TsukiSceneContext, TsukiSceneHandle } from "../scene-types";
import { injectSceneStyles } from "../styles";
import {
  drawPetal,
  drawTextScrim,
  makeLayer,
  petalSprites,
  radialSprite,
  runCanvasScene,
  softenedPlate,
  splitGlyphs,
  stillCanvas,
  textBox,
  type Box,
  type Ctx,
} from "./kit";
import { P2, hash01, p2Scatter, p2Tear, p2TimeFlow, tearBands } from "./r2-core";
import css from "./part-2-twilight-lamp.css?inline";

const SEED = 0x7032;
const LAMP = "255, 214, 160";
const MIST = "205, 211, 224";

interface Layout {
  w: number;
  h: number;
  unit: number;
  groundY: number;
  lamp: { x: number; y: number };
  bench: { x: number; y: number; w: number };
}

function layoutOf(w: number, h: number): Layout {
  const unit = Math.min(w, h);
  const groundY = h * (h > w ? 0.78 : 0.74);
  const lampX = w * (h > w ? 0.78 : 0.7);
  return {
    w,
    h,
    unit,
    groundY,
    lamp: { x: lampX, y: groundY - h * (h > w ? 0.42 : 0.5) },
    bench: { x: lampX - unit * 0.34, y: groundY + unit * 0.02, w: unit * 0.26 },
  };
}

interface Petal {
  x: number;
  y: number;
  z: number;
  vy: number;
  vx: number;
  size: number;
  rot: number;
  spin: number;
  tumble: number;
  variant: number;
}

function spawn(rng: () => number, l: Layout, anywhere: boolean, p?: Petal): Petal {
  const petal = p ?? ({} as Petal);
  petal.z = rng();
  petal.x = l.w * (0.05 + rng() * 1.0);
  petal.y = anywhere ? rng() * l.groundY : -20 - rng() * 60;
  petal.vy = 22 + rng() * 26;
  petal.vx = -6 - rng() * 12;
  petal.size = (6 + rng() * 7) * (0.6 + petal.z * 0.6) * (l.unit / 800 + 0.5);
  petal.rot = rng() * Math.PI * 2;
  petal.spin = (rng() - 0.5) * 1.8;
  petal.tumble = rng() * Math.PI * 2;
  petal.variant = Math.floor(rng() * 4);
  return petal;
}

/** The plate, graded to cold twilight, with the platform plane and the lamp's pool baked in. */
function paintBase(c: Ctx, l: Layout, image: HTMLImageElement | null, dpr: number): void {
  c.fillStyle = "#0d0b1d";
  c.fillRect(0, 0, l.w, l.h);
  if (image) {
    c.globalAlpha = 0.85;
    c.drawImage(softenedPlate(image, l.w, l.h, dpr, 2.4), 0, 0, l.w, l.h);
    c.globalAlpha = 1;
  }
  // Cold violet grade and a darker sky over the lamp's world.
  c.globalCompositeOperation = "multiply";
  c.fillStyle = "rgba(92, 78, 150, 0.85)";
  c.fillRect(0, 0, l.w, l.h);
  c.globalCompositeOperation = "source-over";
  const fall = c.createLinearGradient(0, 0, 0, l.h);
  fall.addColorStop(0, "rgba(8, 6, 20, 0.55)");
  fall.addColorStop(0.6, "rgba(8, 6, 20, 0.15)");
  fall.addColorStop(1, "rgba(8, 6, 20, 0.6)");
  c.fillStyle = fall;
  c.fillRect(0, 0, l.w, l.h);

  // The platform: a darker plane the shadows fall on, with its stone edge catching the last light.
  const plane = c.createLinearGradient(0, l.groundY, 0, l.h);
  plane.addColorStop(0, "rgba(14, 11, 26, 0.92)");
  plane.addColorStop(1, "rgba(6, 5, 12, 0.98)");
  c.fillStyle = plane;
  c.fillRect(0, l.groundY, l.w, l.h - l.groundY);
  c.fillStyle = `rgba(${MIST}, 0.22)`;
  c.fillRect(0, l.groundY, l.w, 1);

  // The pool of lamplight on the stone.
  c.save();
  c.translate(l.lamp.x, l.groundY + (l.h - l.groundY) * 0.35);
  c.scale(1, 0.3);
  const pool = c.createRadialGradient(0, 0, 0, 0, 0, l.unit * 0.55);
  pool.addColorStop(0, `rgba(${LAMP}, 0.32)`);
  pool.addColorStop(0.5, `rgba(${LAMP}, 0.1)`);
  pool.addColorStop(1, `rgba(${LAMP}, 0)`);
  c.fillStyle = pool;
  c.fillRect(-l.unit * 0.6, -l.unit * 0.6, l.unit * 1.2, l.unit * 1.2);
  c.restore();
}

/** Where a point at height `y` above the ground at `x` throws its shadow, for a lamp at `lamp`. */
function shadowX(l: Layout, x: number, y: number): number {
  const height = Math.max(4, l.groundY - y);
  const lampHeight = Math.max(8, l.groundY - l.lamp.y);
  const k = Math.min(3.5, lampHeight / Math.max(4, lampHeight - height));
  return l.lamp.x + (x - l.lamp.x) * k;
}

/** Bench, Walkman, the lamp post, and the shadows of the bench and the Walkman (none for her). */
function paintProps(c: Ctx, l: Layout): void {
  const { bench, unit } = l;
  const seatY = bench.y - unit * 0.09;
  const left = bench.x - bench.w / 2;
  const shadowDepth = (l.h - l.groundY) * 0.42;

  // Shadows first, on the stone: stretched away from the lamp, soft at the edges.
  c.filter = `blur(${Math.max(1, unit * 0.006).toFixed(1)}px)`;
  c.fillStyle = "rgba(2, 1, 6, 0.4)";
  const sl = shadowX(l, left, seatY);
  const sr = shadowX(l, left + bench.w, seatY);
  c.beginPath();
  c.moveTo(left, bench.y);
  c.lineTo(left + bench.w, bench.y);
  c.lineTo(sr, bench.y + shadowDepth);
  c.lineTo(sl, bench.y + shadowDepth * 0.9);
  c.closePath();
  c.fill();
  // The Walkman's small shadow, at the right end of the seat.
  const wx = left + bench.w * 0.78;
  c.beginPath();
  c.ellipse(shadowX(l, wx, seatY - unit * 0.02), bench.y + shadowDepth * 0.6, unit * 0.03, unit * 0.008, 0, 0, Math.PI * 2);
  c.fill();
  c.filter = "none";

  // Bench.
  c.fillStyle = "#0b0912";
  for (const fx of [0.08, 0.88]) c.fillRect(left + bench.w * fx, seatY, unit * 0.012, bench.y - seatY);
  c.fillRect(left, seatY - unit * 0.012, bench.w, unit * 0.014);
  c.fillRect(left, seatY - unit * 0.07, bench.w, unit * 0.012);
  c.fillRect(left, seatY - unit * 0.1, bench.w, unit * 0.012);
  c.fillStyle = `rgba(${LAMP}, 0.22)`;
  c.fillRect(left, seatY - unit * 0.012, bench.w, 1);
  // The Walkman on the seat.
  c.fillStyle = "#1a1722";
  c.fillRect(wx - unit * 0.018, seatY - unit * 0.035, unit * 0.036, unit * 0.024);
  c.fillStyle = `rgba(${LAMP}, 0.35)`;
  c.fillRect(wx - unit * 0.012, seatY - unit * 0.03, unit * 0.024, unit * 0.006);

  // Lamp post and shade.
  const post = Math.max(3, unit * 0.008);
  c.fillStyle = "#08070d";
  c.fillRect(l.lamp.x - post / 2, l.lamp.y, post, l.groundY - l.lamp.y + 4);
  c.beginPath();
  c.moveTo(l.lamp.x - unit * 0.035, l.lamp.y + unit * 0.012);
  c.lineTo(l.lamp.x - unit * 0.012, l.lamp.y - unit * 0.02);
  c.lineTo(l.lamp.x + unit * 0.012, l.lamp.y - unit * 0.02);
  c.lineTo(l.lamp.x + unit * 0.035, l.lamp.y + unit * 0.012);
  c.closePath();
  c.fill();
}

/**
 * The girl, seen from the side, sitting and facing the lamp: long hair down her
 * back, hands in her lap. Painted pale and softened, a shape of light rather
 * than a figure, with lamplight on the side that faces it.
 */
function paintGirl(l: Layout, dpr: number): HTMLCanvasElement {
  const u = l.unit;
  const w = u * 0.2;
  const h = u * 0.27;
  const pad = u * 0.02;
  const { canvas, ctx } = makeLayer(w + pad * 2, h + pad * 2, dpr);
  ctx.translate(pad, pad);
  const X = (f: number) => f * w;
  const Y = (f: number) => f * h;

  const shape = new Path2D();
  // Head, a little bowed.
  shape.ellipse(X(0.52), Y(0.14), X(0.105), Y(0.092), -0.15, 0, Math.PI * 2);
  // Hair falling down her back to the waist.
  shape.moveTo(X(0.46), Y(0.06));
  shape.bezierCurveTo(X(0.3), Y(0.12), X(0.3), Y(0.38), X(0.34), Y(0.56));
  shape.lineTo(X(0.46), Y(0.55));
  shape.bezierCurveTo(X(0.44), Y(0.36), X(0.46), Y(0.22), X(0.5), Y(0.1));
  shape.closePath();
  // Neck and the slope of the shoulders into the back and the chest.
  shape.moveTo(X(0.47), Y(0.22));
  shape.bezierCurveTo(X(0.44), Y(0.28), X(0.4), Y(0.3), X(0.4), Y(0.36));
  shape.lineTo(X(0.42), Y(0.6));
  shape.lineTo(X(0.62), Y(0.6));
  shape.bezierCurveTo(X(0.63), Y(0.46), X(0.64), Y(0.34), X(0.58), Y(0.27));
  shape.lineTo(X(0.55), Y(0.22));
  shape.closePath();
  // The skirt over her lap, out to the knees.
  shape.moveTo(X(0.38), Y(0.56));
  shape.bezierCurveTo(X(0.55), Y(0.53), X(0.75), Y(0.55), X(0.86), Y(0.6));
  shape.bezierCurveTo(X(0.9), Y(0.64), X(0.88), Y(0.69), X(0.82), Y(0.7));
  shape.lineTo(X(0.4), Y(0.7));
  shape.closePath();
  // Shins and the small shoes.
  shape.moveTo(X(0.76), Y(0.68));
  shape.lineTo(X(0.84), Y(0.68));
  shape.lineTo(X(0.83), Y(0.95));
  shape.lineTo(X(0.77), Y(0.95));
  shape.closePath();
  shape.ellipse(X(0.82), Y(0.965), X(0.055), Y(0.02), 0, 0, Math.PI * 2);

  // The arm, from the shoulder to the hands in her lap.
  const arm = new Path2D();
  arm.moveTo(X(0.55), Y(0.3));
  arm.quadraticCurveTo(X(0.6), Y(0.45), X(0.68), Y(0.55));

  const body = ctx.createLinearGradient(X(0.3), 0, X(0.9), 0);
  body.addColorStop(0, `rgba(${MIST}, 0.34)`);
  body.addColorStop(1, "rgba(255, 238, 214, 0.55)");
  ctx.filter = `blur(${Math.max(0.6, u * 0.0025).toFixed(2)}px)`;
  ctx.fillStyle = body;
  ctx.fill(shape);
  ctx.strokeStyle = "rgba(255, 238, 214, 0.42)";
  ctx.lineWidth = X(0.05);
  ctx.lineCap = "round";
  ctx.stroke(arm);
  ctx.filter = "none";

  // An edge of lamplight on her face and knees, and a faint glow about her.
  ctx.globalCompositeOperation = "source-atop";
  const rim = ctx.createLinearGradient(X(0.5), 0, X(0.95), 0);
  rim.addColorStop(0, "rgba(255, 220, 170, 0)");
  rim.addColorStop(1, "rgba(255, 220, 170, 0.5)");
  ctx.fillStyle = rim;
  ctx.fillRect(-pad, -pad, w + pad * 2, h + pad * 2);
  ctx.globalCompositeOperation = "destination-over";
  const aura = ctx.createRadialGradient(X(0.55), Y(0.45), 0, X(0.55), Y(0.45), h * 0.6);
  aura.addColorStop(0, `rgba(${MIST}, 0.12)`);
  aura.addColorStop(1, `rgba(${MIST}, 0)`);
  ctx.fillStyle = aura;
  ctx.fillRect(-pad, -pad, w + pad * 2, h + pad * 2);
  return canvas;
}

export function play(ctx: TsukiSceneContext): TsukiSceneHandle {
  injectSceneStyles(css, ctx.signal);
  const { stage, textEl } = ctx;
  const split = splitGlyphs(textEl);
  textEl.classList.add("tsuki-p2-text");

  if (ctx.audio.available()) ctx.audio.setCue("reveal");

  let l = layoutOf(1, 1);
  let base: HTMLCanvasElement | null = null;
  let props: HTMLCanvasElement | null = null;
  let girl: HTMLCanvasElement | null = null;
  let glow: HTMLCanvasElement | null = null;
  let sprites: HTMLCanvasElement[] = [];
  let petals: Petal[] = [];
  let box: Box | null = null;
  let boxAge = 0;
  let worldT = 0;
  let rewound = false;
  let lastScatter = -1;
  const rng = createRng(SEED);
  const offsets = split.glyphs.map(() => ({ dx: (rng() - 0.5) * 2, dy: (rng() - 0.5) * 2 }));
  split.glyphs.forEach((glyph, i) => {
    glyph.style.setProperty("--dx", offsets[i].dx.toFixed(3));
    glyph.style.setProperty("--dy", offsets[i].dy.toFixed(3));
  });

  const layout = (size: Readonly<SceneSize>, image: HTMLImageElement | null) => {
    l = layoutOf(size.width, size.height);
    const b = makeLayer(l.w, l.h, size.dpr);
    paintBase(b.ctx, l, image, size.dpr);
    base = b.canvas;
    const p = makeLayer(l.w, l.h, size.dpr);
    paintProps(p.ctx, l);
    props = p.canvas;
    girl = paintGirl(l, size.dpr);
    glow = radialSprite(l.unit * 0.36, size.dpr, [
      [0, `rgba(${LAMP}, 0.9)`],
      [0.06, `rgba(${LAMP}, 0.45)`],
      [0.3, `rgba(${LAMP}, 0.1)`],
      [1, `rgba(${LAMP}, 0)`],
    ]);
    sprites = petalSprites(size.dpr);
    const count = Math.round(Math.min(90, Math.max(36, (l.w * l.h) / 14000)));
    if (petals.length === 0) petals = Array.from({ length: count }, () => spawn(rng, l, true));
    box = null;
  };

  const handle = runCanvasScene(ctx, {
    endS: P2.end,
    className: "tsuki-p2-canvas",
    layout,
    onReady() {
      stage.classList.add("tsuki-p2-ready");
      textEl.classList.add("tsuki-p2-in");
    },
    render(c, info) {
      const { t, dt, width: w, height: h } = info;
      if (!base || !props || !girl || !glow) return;
      c.clearRect(0, 0, w, h);
      if (!info.ready) return;
      boxAge -= dt;
      if (!box || boxAge <= 0) {
        box = textBox(stage, textEl);
        boxAge = 0.5;
      }

      const flow = p2TimeFlow(t);
      worldT += dt * flow;
      const intro = Math.min(1, t / 1.4);

      c.globalAlpha = intro;
      c.drawImage(base, 0, 0, w, h);
      c.drawImage(props, 0, 0, w, h);
      c.globalAlpha = 1;

      // The light cone and the lamp, humming.
      const hum = 0.9 + 0.06 * Math.sin(worldT * 3.1) + 0.04 * Math.sin(worldT * 11.3);
      const cone = c.createLinearGradient(0, l.lamp.y, 0, l.groundY);
      cone.addColorStop(0, `rgba(${LAMP}, ${(0.2 * hum * intro).toFixed(3)})`);
      cone.addColorStop(1, `rgba(${LAMP}, 0)`);
      c.fillStyle = cone;
      c.beginPath();
      c.moveTo(l.lamp.x - l.unit * 0.03, l.lamp.y + l.unit * 0.012);
      c.lineTo(l.lamp.x + l.unit * 0.03, l.lamp.y + l.unit * 0.012);
      c.lineTo(l.lamp.x + l.unit * 0.42, l.groundY + (h - l.groundY) * 0.3);
      c.lineTo(l.lamp.x - l.unit * 0.42, l.groundY + (h - l.groundY) * 0.3);
      c.closePath();
      c.fill();
      c.globalCompositeOperation = "lighter";
      c.globalAlpha = hum * intro;
      const gs = glow.width / info.dpr;
      c.drawImage(glow, l.lamp.x - gs / 2, l.lamp.y + l.unit * 0.02 - gs / 2, gs, gs);
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";

      // Her: pale, breathing a little in the light. No shadow is drawn for her.
      const gw = girl.width / info.dpr;
      const gh = girl.height / info.dpr;
      const breathe = 0.85 + 0.15 * Math.sin(worldT * 0.9);
      const flicker = flow < 0.2 && t > P2.dropoutStart ? 0.55 + 0.45 * Math.sin(t * 17) : 1;
      c.globalAlpha = intro * breathe * flicker;
      c.drawImage(girl, l.bench.x - l.bench.w * 0.35 - gw / 2, l.bench.y - gh * 0.92, gw, gh);
      c.globalAlpha = 1;

      // Petals and their shadows: time runs at `flow` (it stops, and runs backwards in the rewind).
      for (const petal of petals) {
        const step = dt * flow;
        petal.y += petal.vy * step;
        petal.x += (petal.vx + Math.sin(worldT * 0.8 + petal.z * 9) * 8) * step;
        petal.rot += petal.spin * step;
        petal.tumble += 2.2 * step;
        if (petal.y > l.groundY + (h - l.groundY) * petal.z * 0.9 || petal.x < -30) spawn(rng, l, false, petal);
        else if (petal.y < -60 && flow < 0) {
          petal.y = l.groundY - 4;
        }
        // The shadow on the stone, only where the lamp reaches.
        const reach = 1 - Math.min(1, Math.abs(petal.x - l.lamp.x) / (l.unit * 0.6));
        if (reach > 0.02 && petal.y > l.lamp.y) {
          const sx = shadowX(l, petal.x, petal.y);
          const sy = l.groundY + (h - l.groundY) * (0.1 + petal.z * 0.8);
          c.fillStyle = `rgba(2, 1, 6, ${(0.45 * reach * intro).toFixed(3)})`;
          c.beginPath();
          c.ellipse(sx, sy, petal.size * 0.5, petal.size * 0.18, 0, 0, Math.PI * 2);
          c.fill();
        }
        const sprite = sprites[petal.variant];
        if (sprite) drawPetal(c, sprite, petal.x, petal.y, petal.size, petal.rot, petal.tumble, (0.55 + petal.z * 0.4) * intro);
      }

      drawTextScrim(c, box, intro);

      // The tape: bands of the picture slide sideways, with fine scanlines over the whole.
      const tear = p2Tear(t);
      if (tear > 0) {
        const bands = tearBands(t, tear, hash01);
        const cw = c.canvas.width;
        const sy = c.canvas.height / h;
        for (const band of bands) {
          const y = band.y * h;
          const bh = band.h * h;
          const shift = band.shift * w;
          c.drawImage(c.canvas, 0, y * sy, cw, bh * sy, shift, y, w, bh);
        }
        c.fillStyle = `rgba(0, 0, 0, ${(0.16 * tear).toFixed(3)})`;
        for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
      }

      // The epigraph's letters scatter and fly home.
      const scatter = p2Scatter(t);
      const rounded = Math.round(scatter * 40) / 40;
      if (rounded !== lastScatter) {
        lastScatter = rounded;
        textEl.style.setProperty("--scatter", rounded.toFixed(3));
      }

      if (!rewound && t >= P2.dropoutEnd - 0.15) {
        rewound = true;
        ctx.audio.sfx("tape-rewind");
      }
    },
    cleanup() {
      stage.classList.remove("tsuki-p2-ready");
      textEl.classList.remove("tsuki-p2-text", "tsuki-p2-in");
      textEl.style.removeProperty("--scatter");
      split.restore();
    },
  });
  return handle;
}

export function still(ctx: TsukiSceneContext): void {
  injectSceneStyles(css, ctx.signal);
  stillCanvas(
    ctx,
    (c, size, image) => {
      const l = layoutOf(size.width, size.height);
      paintBase(c, l, image, size.dpr);
      paintProps(c, l);
      const girl = paintGirl(l, size.dpr);
      const gw = girl.width / size.dpr;
      const gh = girl.height / size.dpr;
      c.globalAlpha = 0.9;
      c.drawImage(girl, l.bench.x - l.bench.w * 0.35 - gw / 2, l.bench.y - gh * 0.92, gw, gh);
      c.globalAlpha = 1;
      const glow = radialSprite(l.unit * 0.36, size.dpr, [
        [0, `rgba(${LAMP}, 0.85)`],
        [0.08, `rgba(${LAMP}, 0.35)`],
        [1, `rgba(${LAMP}, 0)`],
      ]);
      const gs = glow.width / size.dpr;
      c.globalCompositeOperation = "lighter";
      c.drawImage(glow, l.lamp.x - gs / 2, l.lamp.y - gs / 2, gs, gs);
      c.globalCompositeOperation = "source-over";
      // Petals hanging in the air, as the story has them.
      const rng = createRng(SEED + 1);
      const sprites = petalSprites(size.dpr);
      for (let i = 0; i < 40; i++) {
        const p = spawn(rng, l, true);
        drawPetal(c, sprites[p.variant], p.x, p.y, p.size, p.rot, p.tumble, 0.75);
      }
      drawTextScrim(c, textBox(ctx.stage, ctx.textEl), 1);
    },
    "tsuki-p2-canvas",
  );
}
