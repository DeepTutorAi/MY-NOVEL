// Part 3, the warm room: a photograph the sun is eating (design 4.3).
//
// The warm plate of part 3, softened into lamplight and bokeh. A photograph
// lies on the table: the station in autumn rain, two people on the bench
// sharing one pair of earphones (part 1, which the reader has read). A beam of
// late sun slants across the room, dust turning in it, and where it falls on
// the photograph the picture bleaches: colour first, then the shapes.
//
// Holding the photograph (pressing anywhere on the picture, or the control
// "ประคองภาพไว้", which stays pressed until pressed again) shades it from the
// beam: the beam dims, a warm edge comes up round the print and the fading
// slows to a trickle. Letting go lets the sun back in. The scene ends on time
// either way (r2-core.ts, P3); what the reader chose changes nothing in the
// story.
import { createRng, type SceneSize } from "../../../_shared/scene-runtime";
import type { TsukiSceneContext, TsukiSceneHandle } from "../scene-types";
import { injectSceneStyles } from "../styles";
import { drawTextScrim, makeLayer, radialSprite, runCanvasScene, softenedPlate, splitGlyphs, stillCanvas, textBox, type Box, type Ctx } from "./kit";
import { P3, envelope, fadeStep, phase, smooth } from "./r2-core";
import css from "./part-3-warm-room.css?inline";

const SEED = 0x7033;
const HOLD_LABEL = "ประคองภาพไว้";
const WARM = "255, 196, 128";
const SUN = "255, 226, 170";

interface Layout {
  w: number;
  h: number;
  unit: number;
  photo: { x: number; y: number; w: number; h: number; angle: number };
  beam: { x0: number; y0: number; x1: number; y1: number; width: number };
}

function layoutOf(w: number, h: number): Layout {
  const unit = Math.min(w, h);
  const portrait = h > w;
  // On a tall screen the print sits under the epigraph and clear of the controls' row at the bottom.
  const pw = portrait ? w * 0.36 : Math.min(w * 0.2, h * 0.34);
  const photo = {
    x: portrait ? w * 0.5 : w * 0.17,
    y: portrait ? h * 0.75 : h * 0.73,
    w: pw,
    h: pw * 1.18,
    angle: portrait ? -0.05 : -0.12,
  };
  // The beam comes in from high on the far side and lands on the print.
  const beam = { x0: portrait ? w * 0.95 : w * 0.62, y0: -h * 0.05, x1: photo.x, y1: photo.y, width: pw * 1.25 };
  return { w, h, unit, photo, beam };
}

/** The warm room: the plate softened into lamplight, its corners in shadow. */
function paintRoom(c: Ctx, l: Layout, image: HTMLImageElement | null, dpr: number): void {
  c.fillStyle = "#1a1009";
  c.fillRect(0, 0, l.w, l.h);
  if (image) c.drawImage(softenedPlate(image, l.w, l.h, dpr, 3), 0, 0, l.w, l.h);
  c.globalCompositeOperation = "soft-light";
  c.fillStyle = "rgba(255, 170, 90, 0.5)";
  c.fillRect(0, 0, l.w, l.h);
  c.globalCompositeOperation = "source-over";
  const corners = c.createRadialGradient(l.w * 0.5, l.h * 0.45, l.unit * 0.25, l.w * 0.5, l.h * 0.45, Math.hypot(l.w, l.h) * 0.62);
  corners.addColorStop(0, "rgba(10, 5, 2, 0.15)");
  corners.addColorStop(1, "rgba(10, 5, 2, 0.75)");
  c.fillStyle = corners;
  c.fillRect(0, 0, l.w, l.h);
}

/** The photograph's own picture: the station in autumn rain, two people sharing earphones on the bench. */
function paintPicture(w: number, h: number, dpr: number, washed: boolean): HTMLCanvasElement {
  const { canvas, ctx } = makeLayer(w, h, dpr);
  const rng = createRng(SEED + (washed ? 1 : 0));
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  if (washed) {
    sky.addColorStop(0, "#f2e6cf");
    sky.addColorStop(1, "#e2cfae");
  } else {
    sky.addColorStop(0, "#3b3150");
    sky.addColorStop(0.55, "#a2634a");
    sky.addColorStop(1, "#2a2030");
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const ink = washed ? "rgba(150, 120, 90, 0.35)" : "rgba(18, 12, 20, 0.95)";
  // Mountains far off.
  ctx.fillStyle = washed ? "rgba(170, 140, 110, 0.25)" : "rgba(60, 40, 60, 0.85)";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.5);
  for (let x = 0; x <= w; x += w / 14) ctx.lineTo(x, h * (0.36 + rng() * 0.12));
  ctx.lineTo(w, h * 0.55);
  ctx.lineTo(0, h * 0.55);
  ctx.closePath();
  ctx.fill();
  // The eave of the station with its two posts, and the platform.
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(-2, h * 0.16);
  ctx.lineTo(w * 1.02, h * 0.06);
  ctx.lineTo(w * 1.02, h * 0.15);
  ctx.lineTo(-2, h * 0.24);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(w * 0.12, h * 0.22, w * 0.03, h * 0.62);
  ctx.fillRect(w * 0.86, h * 0.13, w * 0.03, h * 0.71);
  ctx.fillRect(0, h * 0.82, w, h * 0.18);
  // The bench and the two of them, one earphone each.
  const by = h * 0.7;
  ctx.fillRect(w * 0.26, by, w * 0.5, h * 0.03);
  ctx.fillRect(w * 0.28, by, w * 0.025, h * 0.12);
  ctx.fillRect(w * 0.72, by, w * 0.025, h * 0.12);
  const figure = (x: number, tall: number) => {
    ctx.beginPath();
    ctx.ellipse(x, by - h * (0.2 * tall), w * 0.045, h * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - w * 0.06, by);
    ctx.quadraticCurveTo(x - w * 0.06, by - h * 0.16 * tall, x, by - h * 0.16 * tall);
    ctx.quadraticCurveTo(x + w * 0.06, by - h * 0.16 * tall, x + w * 0.06, by);
    ctx.closePath();
    ctx.fill();
  };
  figure(w * 0.41, 1.08);
  figure(w * 0.6, 0.98);
  ctx.strokeStyle = washed ? "rgba(150, 120, 90, 0.3)" : "rgba(240, 210, 170, 0.8)";
  ctx.lineWidth = Math.max(0.8, w * 0.006);
  ctx.beginPath();
  ctx.moveTo(w * 0.44, by - h * 0.2);
  ctx.quadraticCurveTo(w * 0.5, by - h * 0.06, w * 0.57, by - h * 0.19);
  ctx.stroke();
  // The lamp under the eave, and rain.
  if (!washed) {
    const lamp = ctx.createRadialGradient(w * 0.5, h * 0.25, 0, w * 0.5, h * 0.25, w * 0.4);
    lamp.addColorStop(0, "rgba(255, 210, 150, 0.55)");
    lamp.addColorStop(1, "rgba(255, 210, 150, 0)");
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.strokeStyle = washed ? "rgba(160, 130, 100, 0.15)" : "rgba(200, 210, 230, 0.35)";
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 70; i++) {
    const x = rng() * w;
    const y = rng() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - w * 0.02, y + h * 0.07);
    ctx.stroke();
  }
  // Film grain.
  for (let i = 0; i < (w * h) / 18; i++) {
    ctx.fillStyle = `rgba(${rng() < 0.5 ? "255,255,255" : "0,0,0"}, ${(rng() * 0.06).toFixed(3)})`;
    ctx.fillRect(rng() * w, rng() * h, 1, 1);
  }
  return canvas;
}

interface Print {
  frame: HTMLCanvasElement;
  /** The picture's window inside the frame canvas, in CSS pixels. */
  inner: { x: number; y: number; w: number; h: number };
}

/** The print: its white border and its shadow on the table, with the picture area left for the frame to fill. */
function paintPrint(l: Layout, dpr: number): Print {
  const { w, h } = l.photo;
  const pad = w * 0.12;
  const { canvas, ctx } = makeLayer(w + pad * 2, h + pad * 2, dpr);
  ctx.translate(pad, pad);
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = w * 0.08;
  ctx.shadowOffsetY = w * 0.03;
  ctx.fillStyle = "#ece3d2";
  ctx.fillRect(0, 0, w, h);
  ctx.shadowColor = "transparent";
  // Paper tone, a little yellowed at the edges.
  const age = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.9);
  age.addColorStop(0, "rgba(255, 250, 238, 0)");
  age.addColorStop(1, "rgba(170, 130, 70, 0.25)");
  ctx.fillStyle = age;
  ctx.fillRect(0, 0, w, h);
  const border = w * 0.07;
  return { frame: canvas, inner: { x: pad + border, y: pad + border, w: w - border * 2, h: h - border * 4.2 } };
}

/** The print on the table with its picture, `fade` (0 to 1) bleached, with a warm edge while it is held. */
function drawPhoto(c: Ctx, l: Layout, print: Print, colour: HTMLCanvasElement, washed: HTMLCanvasElement, fade: number, warmEdge: number, dpr: number): void {
  const { photo } = l;
  const fw = print.frame.width / dpr;
  const fh = print.frame.height / dpr;
  c.save();
  c.translate(photo.x, photo.y);
  c.rotate(photo.angle);
  c.translate(-fw / 2, -fh / 2);
  if (warmEdge > 0.01) {
    c.shadowColor = `rgba(255, 180, 100, ${(0.6 * warmEdge).toFixed(3)})`;
    c.shadowBlur = photo.w * 0.25 * warmEdge;
  }
  c.drawImage(print.frame, 0, 0, fw, fh);
  c.shadowColor = "transparent";
  c.shadowBlur = 0;
  const { x, y, w, h } = print.inner;
  // The colour goes first, then the shapes: the washed print comes up, then paper white over all.
  c.drawImage(colour, x, y, w, h);
  const outer = c.globalAlpha;
  c.globalAlpha = outer * smooth(Math.min(1, fade * 1.4));
  c.drawImage(washed, x, y, w, h);
  c.globalAlpha = outer * smooth(phase(fade, 0.45, 1)) * 0.92;
  c.fillStyle = "#f1e9d8";
  c.fillRect(x, y, w, h);
  c.globalAlpha = outer;
  c.restore();
}

/**
 * The beam of sun, painted once small and stretched into place: soft across,
 * widening along its length, faint where it comes in and full where it falls.
 */
function paintBeam(length: number, width: number): HTMLCanvasElement {
  const { canvas, ctx } = makeLayer(length, width, 1);
  const across = ctx.createLinearGradient(0, 0, 0, width);
  across.addColorStop(0, `rgba(${SUN}, 0)`);
  across.addColorStop(0.3, `rgba(${SUN}, 0.12)`);
  across.addColorStop(0.5, `rgba(${SUN}, 0.24)`);
  across.addColorStop(0.7, `rgba(${SUN}, 0.12)`);
  across.addColorStop(1, `rgba(${SUN}, 0)`);
  ctx.fillStyle = across;
  ctx.beginPath();
  ctx.moveTo(0, width * 0.32);
  ctx.lineTo(length, 0);
  ctx.lineTo(length, width);
  ctx.lineTo(0, width * 0.68);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = "destination-in";
  const along = ctx.createLinearGradient(0, 0, length, 0);
  along.addColorStop(0, "rgba(0, 0, 0, 0)");
  along.addColorStop(0.35, "rgba(0, 0, 0, 0.8)");
  along.addColorStop(0.85, "rgba(0, 0, 0, 1)");
  along.addColorStop(1, "rgba(0, 0, 0, 0.5)");
  ctx.fillStyle = along;
  ctx.fillRect(0, 0, length, width);
  return canvas;
}

interface Mote {
  u: number;
  v: number;
  speed: number;
  phase: number;
  size: number;
}

export function play(ctx: TsukiSceneContext): TsukiSceneHandle {
  injectSceneStyles(css, ctx.signal);
  const { stage, textEl, controls, signal } = ctx;
  const split = splitGlyphs(textEl);
  textEl.classList.add("tsuki-p3-text");
  if (ctx.audio.available()) ctx.audio.setCue("decision");

  // The reader's hold: the control stays pressed until pressed again; a press on the picture holds while it lasts.
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tsuki-cutscene__control tsuki-p3-hold";
  button.textContent = HOLD_LABEL;
  button.setAttribute("aria-pressed", "false");
  let latched = false;
  button.addEventListener(
    "click",
    () => {
      latched = !latched;
      button.setAttribute("aria-pressed", String(latched));
    },
    { signal },
  );
  controls.append(button);

  let l = layoutOf(1, 1);
  let room: HTMLCanvasElement | null = null;
  let colour: HTMLCanvasElement | null = null;
  let washed: HTMLCanvasElement | null = null;
  let print: Print | null = null;
  let bokeh: HTMLCanvasElement | null = null;
  let mote: HTMLCanvasElement | null = null;
  let beamSprite: HTMLCanvasElement | null = null;
  let box: Box | null = null;
  let boxAge = 0;
  let level = 0;
  let shade = 0;
  const rng = createRng(SEED);
  const motes: Mote[] = Array.from({ length: 70 }, () => ({ u: rng(), v: rng(), speed: 0.01 + rng() * 0.03, phase: rng() * 6.28, size: 0.6 + rng() * 1.8 }));
  const lights = Array.from({ length: 14 }, () => ({ x: rng(), y: rng() * 0.7, r: 0.03 + rng() * 0.07, phase: rng() * 6.28 }));

  const layout = (size: Readonly<SceneSize>, image: HTMLImageElement | null) => {
    l = layoutOf(size.width, size.height);
    const r = makeLayer(l.w, l.h, size.dpr);
    paintRoom(r.ctx, l, image, size.dpr);
    room = r.canvas;
    print = paintPrint(l, size.dpr);
    colour = paintPicture(print.inner.w, print.inner.h, size.dpr, false);
    washed = paintPicture(print.inner.w, print.inner.h, size.dpr, true);
    bokeh = radialSprite(64, size.dpr, [
      [0, `rgba(${WARM}, 0.32)`],
      [0.7, `rgba(${WARM}, 0.18)`],
      [0.85, `rgba(${WARM}, 0.08)`],
      [1, `rgba(${WARM}, 0)`],
    ]);
    mote = radialSprite(4, size.dpr, [
      [0, "rgba(255, 244, 220, 1)"],
      [1, "rgba(255, 244, 220, 0)"],
    ]);
    beamSprite = paintBeam(256, 96);
    box = null;
  };

  const drawBeam = (c: Ctx, strength: number, t: number) => {
    if (strength <= 0.005 || !beamSprite) return;
    const { beam } = l;
    const angle = Math.atan2(beam.y1 - beam.y0, beam.x1 - beam.x0);
    const length = Math.hypot(beam.x1 - beam.x0, beam.y1 - beam.y0) * 1.15;
    c.save();
    c.translate(beam.x0, beam.y0);
    c.rotate(angle);
    c.globalCompositeOperation = "lighter";
    c.globalAlpha = strength;
    c.drawImage(beamSprite, 0, -beam.width / 2, length, beam.width);
    // Dust turning in the light, where the light is.
    if (mote) {
      for (const m of motes) {
        const along = (0.3 + ((m.u + t * m.speed) % 1) * 0.7) * length;
        const off = (m.v - 0.5) * beam.width * (0.3 + 0.6 * (along / length)) + Math.sin(t * 0.7 + m.phase) * 6;
        c.globalAlpha = strength * (0.35 + 0.35 * Math.sin(t * 1.3 + m.phase));
        const s = m.size * 2.2;
        c.drawImage(mote, along - s / 2, off - s / 2, s, s);
      }
    }
    c.restore();
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
  };

  return runCanvasScene(ctx, {
    endS: P3.end,
    className: "tsuki-p3-canvas",
    layout,
    onReady() {
      stage.classList.add("tsuki-p3-ready");
      textEl.classList.add("tsuki-p3-in");
    },
    render(c, info) {
      const { t, dt, width: w, height: h } = info;
      c.clearRect(0, 0, w, h);
      if (!info.ready || !room || !print || !colour || !washed) return;
      boxAge -= dt;
      if (!box || boxAge <= 0) {
        box = textBox(stage, textEl);
        boxAge = 0.5;
      }
      const holding = latched || info.pointer.down;
      shade += ((holding ? 1 : 0) - shade) * Math.min(1, dt * 4);
      level = fadeStep(level, dt, holding, t);
      const life = envelope(t, 0, 1.4, P3.end - 1.4, P3.end);

      c.globalAlpha = life;
      c.drawImage(room, 0, 0, w, h);
      // Lamp bokeh drifting slowly.
      if (bokeh) {
        c.globalCompositeOperation = "lighter";
        for (const b of lights) {
          const r = b.r * l.unit;
          const x = b.x * w + Math.sin(t * 0.15 + b.phase) * 10;
          const y = b.y * h + Math.cos(t * 0.12 + b.phase) * 6;
          c.globalAlpha = life * (0.5 + 0.3 * Math.sin(t * 0.4 + b.phase));
          c.drawImage(bokeh, x - r, y - r, r * 2, r * 2);
        }
        c.globalCompositeOperation = "source-over";
      }
      c.globalAlpha = life;
      drawPhoto(c, l, print, colour, washed, level, shade, info.dpr);
      // The sun grows as the afternoon goes, and dims under the reader's hand.
      drawBeam(c, smooth(phase(t, 0.6, 4)) * (1 - shade * 0.75) * life, t);
      c.globalAlpha = 1;
      drawTextScrim(c, box, life);
    },
    cleanup() {
      stage.classList.remove("tsuki-p3-ready");
      textEl.classList.remove("tsuki-p3-text", "tsuki-p3-in");
      split.restore();
    },
  });
}

export function still(ctx: TsukiSceneContext): void {
  injectSceneStyles(css, ctx.signal);
  stillCanvas(
    ctx,
    (c, size, image) => {
      const l = layoutOf(size.width, size.height);
      paintRoom(c, l, image, size.dpr);
      const print = paintPrint(l, size.dpr);
      const colour = paintPicture(print.inner.w, print.inner.h, size.dpr, false);
      const washed = paintPicture(print.inner.w, print.inner.h, size.dpr, true);
      // Half bleached, as the sun has it.
      drawPhoto(c, l, print, colour, washed, 0.45, 0, size.dpr);
      drawTextScrim(c, textBox(ctx.stage, ctx.textEl), 1);
    },
    "tsuki-p3-canvas",
  );
}
