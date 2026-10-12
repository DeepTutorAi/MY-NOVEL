// Part 1, autumn: rain on a fogged window (design 4.3).
//
// The reader enters the part looking through a misted pane at the rainy
// station of the part's background. Rain falls outside in three depths. The
// glass is fogged: dragging a finger or the mouse across it wipes it clear,
// and the fog also parts by itself from the epigraph outwards, so it is gone
// by about six seconds whatever the reader does; a real button in the
// controls slot, "เช็ดกระจก", wipes it in one sweep by keyboard, tap or screen
// reader. Drops cling to the glass and now and then one runs down, leaving a
// clear track in the fog behind it. A train's lights pass behind the glass.
// The epigraph sharpens as the glass in front of it clears. The timings and
// rules are in p01-core.ts (PART1).
//
// Drawn on one canvas on the shared kit (kit.ts). The plate and the fog's
// texture are painted once per size; the fog itself is a small canvas that
// wipes are cut out of (destination-out) and that is drawn scaled up over the
// picture each frame.
//
// Reduced motion (still()): the plate behind clear glass with a rim of fog
// at the edges and a few drops; no loop, no timer, no audio, no control.
import { createNoise2D, createRng, fbm2D, type SceneSize } from "../../../_shared/scene-runtime";
import type { TsukiSceneContext, TsukiSceneHandle } from "../scene-types";
import { injectSceneStyles } from "../styles";
import { drawCover, drawTextScrim, makeLayer, radialSprite, runCanvasScene, softenedPlate, stillCanvas, textBox, type Box } from "./kit";
import { PART1, autoClearRadius, clamp, phase, rainLevel, revealLevel, smooth, trainAt, type Point } from "./p01-core";
import css from "./part-1-autumn-rain.css?inline";

const SEED = 0x7031;
const WIPE_LABEL = "เช็ดกระจก";
const SOUNDSCAPE_VOLUME = 0.2;
/** The fog canvas is this fraction of the screen: fog is soft, it needs few pixels. */
const FOG_SCALE = 0.34;
const RAIN = "206, 223, 246";
const WARM = "255, 205, 140";
const BUCKETS = 3;
/** Seconds the button's sweep takes. */
const SWEEP_S = 1.5;

interface Drop {
  x: number;
  y: number;
  r: number;
}

interface Runner extends Drop {
  wait: number;
  speed: number;
  wobble: number;
}

interface Streak {
  x: number;
  y: number;
  len: number;
  speed: number;
  depth: number;
}

function makeDropSprite(dpr: number): HTMLCanvasElement {
  const size = 32;
  const { canvas, ctx } = makeLayer(size, size, dpr);
  const c = size / 2;
  const body = ctx.createRadialGradient(c - 3, c - 4, 1, c, c, c - 1);
  body.addColorStop(0, "rgba(255, 255, 255, 0.6)");
  body.addColorStop(0.4, "rgba(215, 228, 248, 0.25)");
  body.addColorStop(0.82, "rgba(40, 46, 66, 0.22)");
  body.addColorStop(1, "rgba(10, 12, 20, 0)");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(c, c, c - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.beginPath();
  ctx.ellipse(c - 4, c - 5, 2.6, 1.6, -0.6, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

/** The fog's own look: the plate softened to nothing, lightened, cooled, with a grain of condensation. */
function paintFogTexture(width: number, height: number, image: HTMLImageElement | null): HTMLCanvasElement {
  const { canvas, ctx } = makeLayer(width, height, 1);
  ctx.fillStyle = "#56607a";
  ctx.fillRect(0, 0, width, height);
  if (image) {
    ctx.globalAlpha = 0.9;
    ctx.drawImage(softenedPlate(image, width, height, 1, 6), 0, 0, width, height);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "rgba(196, 206, 228, 0.42)";
  ctx.fillRect(0, 0, width, height);
  const noise = createNoise2D(SEED);
  const img = ctx.getImageData(0, 0, width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const n = fbm2D(noise, x / 22, y / 22, 3) * 18 + (Math.random() - 0.5) * 10;
      const i = (y * width + x) * 4;
      img.data[i] = clamp(img.data[i] + n, 0, 255);
      img.data[i + 1] = clamp(img.data[i + 1] + n, 0, 255);
      img.data[i + 2] = clamp(img.data[i + 2] + n, 0, 255);
      img.data[i + 3] = 236;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Cuts a soft round hole in the fog at (x, y), in fog pixels. */
function wipe(fog: CanvasRenderingContext2D, x: number, y: number, r: number, strength = 1): void {
  const g = fog.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
  g.addColorStop(0.6, `rgba(0, 0, 0, ${strength * 0.85})`);
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  fog.fillStyle = g;
  fog.beginPath();
  fog.arc(x, y, r, 0, Math.PI * 2);
  fog.fill();
}

/** Wipes along a segment with overlapping stamps. */
function wipeAlong(fog: CanvasRenderingContext2D, a: Point, b: Point, r: number): void {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (r * 0.35)));
  for (let i = 1; i <= steps; i++) wipe(fog, a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps, r);
}

export function play(ctx: TsukiSceneContext): TsukiSceneHandle {
  injectSceneStyles(css, ctx.signal);
  const { stage, textEl, controls, signal } = ctx;
  textEl.classList.add("tsuki-p1-text");
  textEl.style.setProperty("--p1-reveal", "0");
  stage.classList.add("tsuki-p1-wiping");

  // Audio: only when the Walkman is already on; never a gesture of its own.
  if (ctx.audio.available()) {
    ctx.audio.setCue("discovery");
    ctx.audio.layerSoundscape("distant-train", SOUNDSCAPE_VOLUME);
  }

  let w = 1;
  let h = 1;
  let plate: HTMLCanvasElement | null = null;
  let fogTexture: HTMLCanvasElement | null = null;
  let fog: HTMLCanvasElement | null = null;
  let fogCtx: CanvasRenderingContext2D | null = null;
  let dropSprite: HTMLCanvasElement | null = null;
  let bokeh: HTMLCanvasElement | null = null;
  let drops: Drop[] = [];
  let runners: Runner[] = [];
  let streaks: Streak[] = [];
  let box: Box | null = null;
  let boxAge = 0;
  let measureAge = 0;
  let level = -1;
  let fogGone = false;
  let lastPointer: Point | null = null;
  let sweepFrom = -1;
  let lastSweep = 0;
  let lastClear = 0;
  let sceneT = 0;
  const rng = createRng(SEED);
  const paths: Path2D[] = [];

  // The keyboard's (and screen reader's, and anyone's) way to clear the glass.
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tsuki-cutscene__control tsuki-p1-wipe";
  button.textContent = WIPE_LABEL;
  button.addEventListener(
    "click",
    () => {
      if (sweepFrom < 0) sweepFrom = sceneT;
    },
    { signal },
  );
  controls.append(button);

  const spawnRunner = (r: Runner | null): Runner => {
    const runner = r ?? ({} as Runner);
    runner.x = w * (0.05 + rng() * 0.9);
    runner.y = h * rng() * 0.5;
    runner.r = 3 + rng() * 4;
    runner.wait = 0.8 + rng() * 5;
    runner.speed = 70 + rng() * 120;
    runner.wobble = rng() * 6.28;
    return runner;
  };

  const layout = (size: Readonly<SceneSize>, image: HTMLImageElement | null) => {
    w = size.width;
    h = size.height;
    const p = makeLayer(w, h, size.dpr);
    p.ctx.fillStyle = "#0b0d16";
    p.ctx.fillRect(0, 0, w, h);
    if (image) drawCover(p.ctx, image, w, h);
    p.ctx.fillStyle = "rgba(8, 8, 18, 0.18)";
    p.ctx.fillRect(0, 0, w, h);
    plate = p.canvas;
    const fw = Math.max(16, Math.round(w * FOG_SCALE));
    const fh = Math.max(16, Math.round(h * FOG_SCALE));
    fogTexture = paintFogTexture(fw, fh, image);
    // A new size starts a new pane of fog, unless the glass is already clear.
    fog = document.createElement("canvas");
    fog.width = fw;
    fog.height = fh;
    fogCtx = fog.getContext("2d", { willReadFrequently: true });
    lastClear = 0;
    if (fogCtx && !fogGone) {
      fogCtx.drawImage(fogTexture, 0, 0);
      fogCtx.globalCompositeOperation = "destination-out";
    }
    dropSprite = makeDropSprite(size.dpr);
    bokeh = radialSprite(Math.min(w, h) * 0.06, size.dpr, [
      [0, `rgba(${WARM}, 0.9)`],
      [0.4, `rgba(${WARM}, 0.35)`],
      [1, `rgba(${WARM}, 0)`],
    ]);
    const dropCount = Math.round(clamp((w * h) / 7000, 50, 220));
    drops = Array.from({ length: dropCount }, () => ({ x: rng() * w, y: rng() * h, r: 2 + rng() ** 2.2 * 8 }));
    runners = Array.from({ length: 9 }, () => spawnRunner(null));
    const streakCount = Math.round(clamp((w * h) / 2600, 160, 600));
    streaks = Array.from({ length: streakCount }, () => ({ x: rng() * w * 1.2, y: rng() * h, len: 10 + rng() * 26, speed: 700 + rng() * 600, depth: rng() }));
    box = null;
  };

  /** How much of the glass in front of the epigraph is still fogged, from the fog canvas itself. */
  const foggedOverText = (): number => {
    if (!fogCtx || !fog || !box || fogGone) return fogGone ? 0 : 1;
    const x = Math.max(0, Math.floor(box.x * FOG_SCALE));
    const y = Math.max(0, Math.floor(box.y * FOG_SCALE));
    const bw = Math.min(fog.width - x, Math.ceil(box.w * FOG_SCALE));
    const bh = Math.min(fog.height - y, Math.ceil(box.h * FOG_SCALE));
    if (bw <= 0 || bh <= 0) return 0;
    const data = fogCtx.getImageData(x, y, bw, bh).data;
    let sum = 0;
    let n = 0;
    for (let i = 3; i < data.length; i += 16) {
      sum += data[i];
      n++;
    }
    return n ? sum / n / 236 : 0;
  };

  return runCanvasScene(ctx, {
    endS: PART1.end,
    className: "tsuki-p1-canvas",
    layout,
    render(c, info) {
      const { t, dt } = info;
      sceneT = t;
      c.clearRect(0, 0, w, h);
      if (!info.ready || !plate || !fog || !fogCtx || !dropSprite || !bokeh) return;
      boxAge -= dt;
      if (!box || boxAge <= 0) {
        box = textBox(stage, textEl);
        boxAge = 0.5;
      }
      const life = smooth(phase(t, 0, 0.9)) * (1 - smooth(phase(t, PART1.end - 2.2, PART1.end)));

      // ---- the world outside ---------------------------------------------------------
      c.globalAlpha = life;
      c.drawImage(plate, 0, 0, w, h);
      const train = trainAt(t);
      if (train !== null) {
        const envelope = Math.sin(train * Math.PI);
        const y = h * 0.52;
        c.globalCompositeOperation = "lighter";
        for (let i = 0; i < 9; i++) {
          const x = w * (1.15 - train * 1.6) + i * w * 0.07;
          const s = (bokeh.width / info.dpr) * (0.7 + (i % 3) * 0.2);
          c.globalAlpha = life * envelope * 0.8;
          c.drawImage(bokeh, x - s / 2, y - s / 2 + Math.sin(i * 1.7) * 6, s, s);
        }
        c.globalCompositeOperation = "source-over";
      }
      // Rain in three depths, each stroked as one path, slanting with the wind.
      const rain = rainLevel(t);
      for (let i = 0; i < BUCKETS; i++) paths[i] = new Path2D();
      for (const s of streaks) {
        s.y += s.speed * (0.6 + s.depth * 0.6) * dt;
        s.x -= s.speed * 0.1 * dt;
        if (s.y > h + 30) {
          s.y = -30 - rng() * 60;
          s.x = rng() * w * 1.2;
        }
        const b = Math.min(BUCKETS - 1, Math.floor(s.depth * BUCKETS));
        paths[b].moveTo(s.x, s.y);
        paths[b].lineTo(s.x + s.len * 0.1, s.y - s.len * (0.6 + s.depth * 0.6));
      }
      c.strokeStyle = `rgb(${RAIN})`;
      c.lineCap = "round";
      for (let i = 0; i < BUCKETS; i++) {
        c.globalAlpha = life * rain * (0.12 + i * 0.12);
        c.lineWidth = 0.7 + i * 0.6;
        c.stroke(paths[i]);
      }

      // ---- the fog on the glass, and what clears it ------------------------------------
      if (!fogGone) {
        const center = box ? { x: (box.x + box.w / 2) * FOG_SCALE, y: (box.y + box.h / 2) * FOG_SCALE } : { x: fog.width / 2, y: fog.height / 2 };
        // It parts by itself from the epigraph outwards.
        // A new ring is cut only once the clearing has grown a little: one cut per frame of the whole
        // clearing is most of a frame's work on a canvas the page reads back from.
        const reach = Math.hypot(fog.width, fog.height) * 0.75;
        const r = autoClearRadius(t, reach);
        if (r > 2 && r - lastClear >= 3) {
          lastClear = r;
          fogCtx.save();
          fogCtx.translate(center.x, center.y);
          fogCtx.scale(1.5, 1);
          wipe(fogCtx, 0, 0, r, 0.85);
          fogCtx.restore();
        }
        // The reader's finger.
        const pointer = info.pointer;
        const brush = Math.max(8, Math.min(fog.width, fog.height) * 0.09);
        if (pointer.down) {
          const at = { x: pointer.x * FOG_SCALE, y: pointer.y * FOG_SCALE };
          wipeAlong(fogCtx, lastPointer ?? at, at, brush);
          lastPointer = at;
        } else lastPointer = null;
        // The button's sweep: back and forth down the pane.
        if (sweepFrom >= 0) {
          const k = clamp((t - sweepFrom) / SWEEP_S, 0, 1);
          for (let s = lastSweep; s <= k; s += 0.01) {
            const row = Math.floor(s * 4);
            const along = (s * 4) % 1;
            const x = (row % 2 === 0 ? along : 1 - along) * fog.width;
            wipe(fogCtx, x, (row + 0.5) * (fog.height / 4), fog.height / 4);
          }
          lastSweep = k;
        }
        if (t >= PART1.autoClearEnd + 0.4 || (sweepFrom >= 0 && t - sweepFrom > SWEEP_S + 0.2)) {
          fogGone = true;
          stage.classList.remove("tsuki-p1-wiping");
          if (document.activeElement === button) ctx.dialog.querySelector<HTMLElement>("[data-cutscene-skip]")?.focus({ preventScroll: true });
          button.remove();
        }
      }
      // Drops that run down the glass clear a track behind them.
      for (const runner of runners) {
        if (runner.wait > 0) {
          runner.wait -= dt;
          continue;
        }
        const from = { x: runner.x * FOG_SCALE, y: runner.y * FOG_SCALE };
        runner.y += runner.speed * dt;
        runner.x += Math.sin(t * 3 + runner.wobble) * 8 * dt;
        // A thin, half-cleared track: condensation gathers again round a running drop.
        if (!fogGone) {
          const to = { x: runner.x * FOG_SCALE, y: runner.y * FOG_SCALE };
          const r = Math.max(1, runner.r * FOG_SCALE * 0.55);
          const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (r * 0.5)));
          for (let i = 1; i <= steps; i++) wipe(fogCtx, from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps, r, 0.22);
        }
        if (runner.y > h + 10) spawnRunner(runner);
      }
      if (!fogGone || t < PART1.autoClearEnd + 1.5) {
        // The last of the fog evaporates over a second once it has parted.
        const fade = fogGone ? 1 - phase(t, PART1.autoClearEnd + 0.4, PART1.autoClearEnd + 1.5) : 1;
        c.globalAlpha = life * 0.94 * fade;
        c.imageSmoothingEnabled = true;
        c.drawImage(fog, 0, 0, w, h);
      }

      // ---- on the glass: drops, and the runners ------------------------------------------
      for (const d of drops) {
        c.globalAlpha = life * 0.8;
        c.drawImage(dropSprite, d.x - d.r, d.y - d.r, d.r * 2, d.r * 2);
      }
      for (const runner of runners) {
        if (runner.wait > 0) continue;
        c.globalAlpha = life;
        c.drawImage(dropSprite, runner.x - runner.r, runner.y - runner.r * 1.2, runner.r * 2, runner.r * 2.4);
      }
      c.globalAlpha = 1;
      drawTextScrim(c, box, life * 0.85);

      // ---- the epigraph sharpens as its glass clears ----------------------------------------
      measureAge -= dt;
      if (measureAge <= 0) {
        measureAge = 0.2;
        const next = revealLevel(foggedOverText());
        if (next !== level) {
          level = next;
          textEl.style.setProperty("--p1-reveal", String(level));
        }
      }
    },
    cleanup() {
      stage.classList.remove("tsuki-p1-wiping");
      textEl.classList.remove("tsuki-p1-text");
      textEl.style.removeProperty("--p1-reveal");
    },
  });
}

export function still(ctx: TsukiSceneContext): void {
  injectSceneStyles(css, ctx.signal);
  stillCanvas(
    ctx,
    (c, size, image) => {
      const { width: w, height: h } = size;
      c.fillStyle = "#0b0d16";
      c.fillRect(0, 0, w, h);
      if (image) drawCover(c, image, w, h);
      // A rim of fog round clear glass in the middle.
      const fw = Math.max(16, Math.round(w * FOG_SCALE));
      const fh = Math.max(16, Math.round(h * FOG_SCALE));
      const fog = paintFogTexture(fw, fh, image);
      const fctx = fog.getContext("2d");
      if (fctx) {
        fctx.globalCompositeOperation = "destination-out";
        const g = fctx.createRadialGradient(fw / 2, fh / 2, 0, fw / 2, fh / 2, Math.hypot(fw, fh) / 2);
        g.addColorStop(0, "rgba(0, 0, 0, 1)");
        g.addColorStop(0.55, "rgba(0, 0, 0, 1)");
        g.addColorStop(1, "rgba(0, 0, 0, 0.2)");
        fctx.fillStyle = g;
        fctx.fillRect(0, 0, fw, fh);
      }
      c.globalAlpha = 0.9;
      c.drawImage(fog, 0, 0, w, h);
      c.globalAlpha = 0.8;
      const sprite = makeDropSprite(size.dpr);
      const rng = createRng(SEED + 1);
      for (let i = 0; i < 90; i++) {
        const r = 1.2 + rng() ** 2 * 5;
        c.drawImage(sprite, rng() * w - r, rng() * h - r, r * 2, r * 2);
      }
      c.globalAlpha = 1;
      drawTextScrim(c, textBox(ctx.stage, ctx.textEl), 0.85);
    },
    "tsuki-p1-canvas",
  );
}
