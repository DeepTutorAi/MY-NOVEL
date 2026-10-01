// Part 1, autumn: rain on a fogged window (design 4.3). The reader enters the
// part looking through a misted pane at the rainy station of the part's
// background. Dragging wipes the glass clear (finger or mouse), and as the pane
// in front of the epigraph clears, the epigraph comes into focus.
//
// Input fallbacks, so nobody has to find the gesture: the fog parts by itself
// from the epigraph outwards (from 1.0 s to 5.4 s, the rows nearest the text
// first), and a real button in the controls slot, "เช็ดกระจก", clears it in
// about a second and a half by keyboard, tap or screen reader. The rules are in
// part-1-core.ts.
//
// Timeline, in seconds from the scene being ready (the plate decoded, or given
// up on after 1.5 s):
//
//    0.0  plate and rain fade in over the fully fogged glass, epigraph hazed
//    1.0  the fog starts to part from the epigraph (the reader may wipe from the first frame)
//    5.4  the fog is gone, however the reader acted; the epigraph is crisp
//    9.5  a distant train's light passes behind the glass (3.8 s)
//   17.5  the rain eases off
//   20.0  the scene ends
//
// Nothing is redrawn every frame. A browser that rasterises in software hands
// the compositor a whole canvas again every time anything is drawn in it,
// whatever the drawing was (a mostly empty full-screen canvas with a few
// streaks on it cost the main thread about 1.8 ms a frame, 8 ms at a quarter of
// the speed), so the rain canvas of an earlier version was most of the scene's
// cost. Every layer is painted once, when the stage is laid out, and what moves
// is moved by the compositor, with transform and opacity animations made by
// this file from the plans in part-1-core.ts. Layers in ctx.stage, back to front,
// ordered by the DOM (no z-index), all inside one container. The loop's own
// canvas draws nothing and is not in the page (a full-screen canvas that is only
// there to be touched still costs the compositor a handoff every frame): the
// pointer events land on the stage instead, which the stylesheet gives the grab
// cursor and, while there is fog to wipe, touch-action: none.
//
//   plate    an image made once per size from a canvas that is not in the page:
//            the background softened once (a down-and-up scale), an amber wash,
//            a vignette
//   rain     two tall images (far and near), each painted once with its
//            streaks and carried down its own length, over and over, by a
//            transform animation; a soft dark veil over them keeps the rain
//            gentler behind the epigraph. They lie under the fog, so wiped
//            glass shows them and fogged glass hardly does, as before.
//   fog      two small canvases at a fraction of the resolution (fog is soft):
//            the upper half and the lower half of a frosted, lightened copy of
//            the plate with low-frequency noise, each with a soft edge painted
//            into the side that faces the epigraph. The animation slides them
//            away from it, so the fog parts from the middle outwards. Wiping is
//            a soft brush stamped with destination-out into whichever sheets it
//            touches, when the reader's finger moves; the first touch stops the
//            sheets where they are and lets the rest of the fog thin out by
//            itself, so a wipe never moves with the fog.
//   train    the strip of warm bokeh, slid across once
//   drops    droplets on the glass: small elements, each carried down a short
//            way, now and then, by a transform animation worked out beforehand
//
// Animations are made only when they are about to run (the droplets' slides, the
// train, the fade out) or while they run (everything else), and taken away when
// they are done, so that what is animating at any moment is what is moving.
//
// The epigraph's haze is a CSS custom property written when its level changes (in
// twelve steps at most: no transition blends them, because an animated blur costs
// the main thread about two milliseconds a frame in a software renderer).
// The epigraph is never touched except for that class and property: its text,
// its DOM and its screen-reader reading are the dialog's.
//
// Reduced motion (still()): the plate, a frosted rim of fog around a cleared
// middle, a few static streaks and droplets, the epigraph crisp. No loop, no
// timer, no audio, no control.
import { backingSize, capDpr, createNoise2D, createRng, fbm2D, type PointerState, type SceneFrame } from "../../../_shared/scene-runtime";
import type { TsukiCanvasLoop, TsukiSceneContext, TsukiSceneHandle } from "../scene-types";
import { injectSceneStyles } from "../styles";
import {
  BRUSH_CORE,
  INTRO_S,
  OUTRO_S,
  RAIN_SLANT,
  SCENE_END_S,
  TRAIN_DURATION_S,
  TRAIN_START_S,
  brushRadius,
  coverRect,
  createCoverageGrid,
  createDroplets,
  createRain,
  createSceneClock,
  createStampLog,
  createWipeSchedule,
  curtainCoverage,
  curtainGeometry,
  curtainSteps,
  dropletCount,
  easeToward,
  envelopeSteps,
  fogIsClear,
  fogScale,
  gridCell,
  growRect,
  placeTrain,
  planDroplets,
  planRain,
  quantizeReveal,
  rainCount,
  revealFor,
  secondsToClear,
  stampsAlong,
  strokeRepeats,
  trainLightSteps,
  type CoverageGrid,
  type CurtainGeometry,
  type Droplet,
  type DropletPlan,
  type Point,
  type RainLayerPlan,
  type RainStreak,
  type Rect,
} from "./part-1-core";
import { createRevealClock } from "./plate-core";
import css from "./part-1-autumn-rain.css?inline";

const SEED = 0x0a17;
/** How long the scene waits for the plate before it plays without it. */
const READY_TIMEOUT_MS = 1500;
/** The keyboard's way to wipe the glass: a short imperative, the accessible name of the button. */
const WIPE_LABEL = "เช็ดกระจก";
/** The distant train layered over the music: a little above the Walkman's default of 0.12, still far away. */
const SOUNDSCAPE_VOLUME = 0.2;
const RAIN_COLOUR = "rgb(206, 223, 246)";
/** Fog is soft: its bitmap is at most this many pixels on its long side, and the stage's size scales it. */
const FOG_LONG_SIDE_PX = 256;
/** The fog's own opacity once the scene is ready (the stylesheet sets the same). */
const FOG_OPACITY = 0.95;
/** The rain and the plate are painted at no more than this pixel ratio: streaks are soft and a phone's own 3x would triple a canvas the size of the screen for nothing. */
const RAIN_PIXEL_RATIO_CAP = 1.25;

/** Droplets rest this much longer between runs than they once did: each run is an animation the compositor has to keep, and the glass is just as wet. */
const DROPLET_WAIT_SCALE = 1.4;

const round2 = (value: number) => Math.round(value * 100) / 100;

// ---------------------------------------------------------------------------
// Painting. Everything below draws into canvases and runs when a size or the
// plate changes, never per frame.

/** The two canvases the reduced-motion still paints: the plate and one sheet of fog. */
interface Layers {
  readonly plate: HTMLCanvasElement;
  readonly fog: HTMLCanvasElement;
  readonly plateCtx: CanvasRenderingContext2D;
  readonly fogCtx: CanvasRenderingContext2D;
}

function createLayers(stage: HTMLElement): Layers | null {
  const make = (name: string): [HTMLCanvasElement, CanvasRenderingContext2D | null] => {
    const canvas = document.createElement("canvas");
    canvas.className = `tsuki-cutscene__canvas tsuki-p1-${name}`;
    canvas.setAttribute("aria-hidden", "true");
    stage.append(canvas);
    return [canvas, canvas.getContext("2d")];
  };
  const [plate, plateCtx] = make("plate");
  const [fog, fogCtx] = make("fog");
  if (!plateCtx || !fogCtx) {
    plate.remove();
    fog.remove();
    return null;
  }
  return { plate, fog, plateCtx, fogCtx };
}

/** Sizes the plate and fog backing stores for a stage of this CSS size; returns the fog's scale from CSS pixels. */
function sizeLayers(layers: Layers, width: number, height: number, devicePixelRatio: number): number {
  const plateDpr = capDpr(devicePixelRatio, 1.5);
  layers.plate.width = backingSize(width, plateDpr);
  layers.plate.height = backingSize(height, plateDpr);
  const scale = fogScale(width, height);
  layers.fog.width = backingSize(width, scale);
  layers.fog.height = backingSize(height, scale);
  return scale;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2d canvas unavailable");
  return [canvas, context];
}

/** Draws the image covering the box, scaled down to `soften` of its size and back up: one cheap blur, once. */
function drawSoftened(target: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, soften: number): void {
  const crop = coverRect(image.naturalWidth, image.naturalHeight, width, height);
  const [small, smallCtx] = makeCanvas(width * soften, height * soften);
  smallCtx.imageSmoothingQuality = "high";
  smallCtx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, small.width, small.height);
  target.imageSmoothingQuality = "high";
  target.drawImage(small, 0, 0, small.width, small.height, 0, 0, width, height);
}

/** The pane as it looks from inside, before any fog: the part's background, softened, washed amber, with a vignette and a dark pool for the text. */
function paintPlate(layers: Pick<Layers, "plate" | "plateCtx">, width: number, height: number, image: HTMLImageElement | null): void {
  const c = layers.plateCtx;
  c.setTransform(layers.plate.width / width, 0, 0, layers.plate.height / height, 0, 0);
  c.globalCompositeOperation = "source-over";
  c.fillStyle = "#060912";
  c.fillRect(0, 0, width, height);
  if (image) drawSoftened(c, image, width, height, 0.26);

  const wash = c.createLinearGradient(0, 0, 0, height);
  wash.addColorStop(0, "rgba(224, 138, 76, 0.05)");
  wash.addColorStop(1, "rgba(58, 38, 52, 0.22)");
  c.fillStyle = wash;
  c.fillRect(0, 0, width, height);

  const reach = Math.hypot(width, height) / 2;
  const vignette = c.createRadialGradient(width / 2, height / 2, reach * 0.35, width / 2, height / 2, reach);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.46)");
  c.fillStyle = vignette;
  c.fillRect(0, 0, width, height);

  // The epigraph sits in the middle, where the lit station is brightest: a dark pool keeps it readable.
  c.save();
  c.translate(width / 2, height / 2);
  c.scale(1, Math.max(0.4, Math.min(1.4, height / (width * 0.62))));
  const pool = c.createRadialGradient(0, 0, 0, 0, 0, width * 0.42);
  pool.addColorStop(0, "rgba(3, 5, 12, 0.4)");
  pool.addColorStop(1, "rgba(3, 5, 12, 0)");
  c.fillStyle = pool;
  c.fillRect(-width, -width, width * 2, width * 2);
  c.restore();

  c.fillStyle = "rgba(0, 0, 0, 0.12)";
  c.fillRect(0, 0, width, height);
}

/** A small map of low-frequency noise, white where the fog is thicker and black where it is thinner, to be stretched over the fog. */
function makeNoiseMap(): HTMLCanvasElement {
  const columns = 96;
  const rows = 60;
  const [canvas, c] = makeCanvas(columns, rows);
  const noise = createNoise2D(SEED);
  const data = c.createImageData(columns, rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const n = fbm2D(noise, x * 0.065, y * 0.065, 3);
      const at = (y * columns + x) * 4;
      const light = n > 0 ? 255 : 0;
      data.data[at] = light;
      data.data[at + 1] = light;
      data.data[at + 2] = light;
      data.data[at + 3] = Math.round(Math.min(1, Math.abs(n) * 1.4) * 0.08 * 255);
    }
  }
  c.putImageData(data, 0, 0);
  return canvas;
}

/** Frosted glass: the plate blurred hard (a scale-down and up in two steps), lightened with a cool milky veil, mottled by the noise. */
function paintFog(layers: Pick<Layers, "fog" | "fogCtx">, noise: HTMLCanvasElement, image: HTMLImageElement | null): void {
  const c = layers.fogCtx;
  const { width, height } = layers.fog;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = 1;
  c.fillStyle = "#1a2236";
  c.fillRect(0, 0, width, height);
  if (image) {
    const crop = coverRect(image.naturalWidth, image.naturalHeight, width, height);
    const [tiny, tinyCtx] = makeCanvas(Math.max(12, width / 16), Math.max(8, height / 16));
    tinyCtx.imageSmoothingQuality = "high";
    tinyCtx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, tiny.width, tiny.height);
    const [mid, midCtx] = makeCanvas(Math.max(24, width / 5), Math.max(16, height / 5));
    midCtx.imageSmoothingQuality = "high";
    midCtx.drawImage(tiny, 0, 0, mid.width, mid.height);
    c.imageSmoothingQuality = "high";
    c.drawImage(mid, 0, 0, width, height);
  }
  const veil = c.createLinearGradient(0, 0, 0, height);
  veil.addColorStop(0, "rgba(104, 124, 160, 0.56)");
  veil.addColorStop(1, "rgba(140, 152, 176, 0.6)");
  c.fillStyle = veil;
  c.fillRect(0, 0, width, height);
  c.imageSmoothingQuality = "high";
  c.drawImage(noise, 0, 0, width, height);
}

/** Fades the edge of a sheet of fog that faces the epigraph to nothing over `edgePx` pixels, so the fog parts with a soft edge and the sheets overlap without a seam. */
function bakeSoftEdge(c: CanvasRenderingContext2D, canvas: HTMLCanvasElement, side: "up" | "down", edgePx: number): void {
  const edge = Math.min(canvas.height, Math.max(2, Math.round(edgePx)));
  const from = side === "up" ? canvas.height - edge : 0;
  const gradient = c.createLinearGradient(0, from, 0, from + edge);
  // An ease rather than a straight ramp: the fog thins slowly at first and then goes.
  const stops: Array<[number, number]> = [[0, 0], [0.25, 0.06], [0.5, 0.5], [0.75, 0.94], [1, 1]];
  for (const [at, alpha] of stops) gradient.addColorStop(at, `rgba(0, 0, 0, ${side === "up" ? alpha : 1 - alpha})`);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "destination-out";
  c.globalAlpha = 1;
  c.fillStyle = gradient;
  c.fillRect(0, from, canvas.width, edge);
  c.restore();
}

/** A soft round brush as an alpha sprite: fully clear in its core, feathered to nothing at its radius. */
function makeBrush(radius: number): HTMLCanvasElement {
  const size = Math.max(4, Math.ceil(radius * 2) + 2);
  const [canvas, c] = makeCanvas(size, size);
  const centre = size / 2;
  const gradient = c.createRadialGradient(centre, centre, 0, centre, centre, Math.max(1, radius));
  gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
  gradient.addColorStop(BRUSH_CORE, "rgba(0, 0, 0, 1)");
  gradient.addColorStop(0.8, "rgba(0, 0, 0, 0.45)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  c.fillStyle = gradient;
  c.fillRect(0, 0, size, size);
  return canvas;
}

/** The beaded edge of a wipe: a faint light ring just outside a brush's reach, painted on fog that is still there. */
function makeRim(radius: number): HTMLCanvasElement {
  const reach = radius * 1.18;
  const size = Math.max(4, Math.ceil(reach * 2) + 2);
  const [canvas, c] = makeCanvas(size, size);
  const centre = size / 2;
  const gradient = c.createRadialGradient(centre, centre, 0, centre, centre, Math.max(1, reach));
  gradient.addColorStop(0, "rgba(218, 230, 248, 0)");
  gradient.addColorStop(0.5, "rgba(218, 230, 248, 0)");
  gradient.addColorStop(0.84, "rgba(218, 230, 248, 0.1)");
  gradient.addColorStop(1, "rgba(218, 230, 248, 0)");
  c.fillStyle = gradient;
  c.fillRect(0, 0, size, size);
  return canvas;
}

/** A droplet on the glass: a faint lens with a dark lower rim, a bright highlight and a warm glint of the station lamp. */
function makeDropletSprite(): HTMLCanvasElement {
  const [canvas, c] = makeCanvas(64, 64);
  c.translate(32, 32);
  const body = c.createRadialGradient(-7, -9, 2, 0, 0, 28);
  body.addColorStop(0, "rgba(236, 245, 255, 0.36)");
  body.addColorStop(0.55, "rgba(176, 202, 236, 0.16)");
  body.addColorStop(1, "rgba(70, 96, 140, 0.3)");
  c.fillStyle = body;
  c.beginPath();
  c.arc(0, 0, 28, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = 2.2;
  c.strokeStyle = "rgba(4, 8, 20, 0.34)";
  c.beginPath();
  c.arc(0, 0, 26, Math.PI * 0.2, Math.PI * 0.8);
  c.stroke();
  c.strokeStyle = "rgba(226, 238, 255, 0.34)";
  c.beginPath();
  c.arc(0, 0, 26, Math.PI * 1.1, Math.PI * 1.55);
  c.stroke();
  c.fillStyle = "rgba(255, 255, 255, 0.85)";
  c.beginPath();
  c.ellipse(-9, -11, 6, 3.2, -0.6, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "rgba(255, 196, 130, 0.4)";
  c.beginPath();
  c.ellipse(5, 13, 9, 3.5, 0.3, 0, Math.PI * 2);
  c.fill();
  return canvas;
}

/** The lit windows of a train far away: a row of soft warm bokeh, to be slid across the glass once. */
function makeTrainStrip(): HTMLCanvasElement {
  const [canvas, c] = makeCanvas(520, 96);
  const body = c.createLinearGradient(0, 24, 0, 72);
  body.addColorStop(0, "rgba(255, 200, 140, 0)");
  body.addColorStop(0.5, "rgba(255, 200, 140, 0.11)");
  body.addColorStop(1, "rgba(255, 200, 140, 0)");
  c.fillStyle = body;
  c.fillRect(0, 24, 520, 48);
  for (let index = 0; index < 8; index++) {
    c.save();
    c.translate(36 + index * 64, 48);
    c.scale(1.2, 0.46);
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, 38);
    glow.addColorStop(0, "rgba(255, 224, 170, 0.62)");
    glow.addColorStop(0.5, "rgba(255, 190, 120, 0.2)");
    glow.addColorStop(1, "rgba(255, 170, 100, 0)");
    c.fillStyle = glow;
    c.fillRect(-40, -40, 80, 80);
    c.restore();
  }
  return canvas;
}

/** Streak and droplet drawing for the still: the animated scene paints them once into canvases and sprites of their own. */
function drawStreak(c: CanvasRenderingContext2D, streak: RainStreak, alpha: number): void {
  if (alpha < 0.01) return;
  c.globalAlpha = alpha;
  c.lineWidth = streak.width;
  c.beginPath();
  c.moveTo(streak.x - RAIN_SLANT * streak.len, streak.y - streak.len);
  c.lineTo(streak.x, streak.y);
  c.stroke();
}

function drawDroplet(c: CanvasRenderingContext2D, sprite: HTMLCanvasElement, drop: Droplet, alpha: number): void {
  c.globalAlpha = alpha;
  const radius = drop.radius;
  c.drawImage(sprite, drop.x - radius, drop.y - radius * 1.2, radius * 2, radius * 2.5);
}

/** Loads the plate; resolves null if it cannot be had. With a timeout it gives up after that many ms. */
function loadPlate(url: string | null, signal: AbortSignal, timeoutMs: number | null): Promise<HTMLImageElement | null> {
  if (!url || signal.aborted) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (value: HTMLImageElement | null) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => settle(null);
    signal.addEventListener("abort", onAbort, { once: true });
    if (timeoutMs !== null) timer = setTimeout(() => settle(null), timeoutMs);
    image.decoding = "async";
    image.src = url;
    image.decode().then(
      () => settle(image),
      () => settle(null),
    );
  });
}

const overButton = (target: EventTarget | null): boolean => target instanceof Element && target.closest("button") !== null;

// ---------------------------------------------------------------------------
// Animations that are made when they are due and taken away when they are done
// ---------------------------------------------------------------------------

/** The Web Animations of the scene: they are held and released with the tab and cancelled together. */
interface MotionSet {
  /** Starts an animation of `element`, `atMs` into it, and calls `onDone` once it has run its course. */
  start(element: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions, atMs: number, onDone?: () => void): Animation;
  hold(): void;
  release(): void;
  cancelAll(): void;
}

function createMotionSet(): MotionSet {
  const live = new Set<Animation>();
  let held = false;
  return {
    start(element, frames, options, atMs, onDone) {
      const animation = element.animate(frames, options);
      animation.currentTime = Math.max(0, atMs);
      if (held) animation.pause();
      live.add(animation);
      animation.finished.then(
        () => {
          if (!live.delete(animation)) return;
          onDone?.();
        },
        () => {},
      );
      return animation;
    },
    hold() {
      held = true;
      for (const animation of live) animation.pause();
    },
    release() {
      held = false;
      for (const animation of live) animation.play();
    },
    cancelAll() {
      for (const animation of [...live]) {
        live.delete(animation);
        animation.cancel();
      }
    },
  };
}

/** Writes an animation's last frame into its element's own style and takes the animation away. */
function settleAnimation(animation: Animation): void {
  try {
    animation.commitStyles();
  } catch {
    // an element that is not rendered cannot commit; the style it already has stays
  }
  animation.cancel();
}

interface DueEvent {
  atS: number;
  run(): void;
}

/** Runs each event once, the first time the scene's clock has reached it; `events` need not be sorted. */
function createDueQueue(events: DueEvent[]) {
  const queue = [...events].sort((a, b) => a.atS - b.atS);
  let next = 0;
  return {
    tick(localS: number) {
      while (next < queue.length && queue[next].atS <= localS) queue[next++].run();
    },
  };
}

// ---------------------------------------------------------------------------
// The weather: rain, droplets and the train's light
// ---------------------------------------------------------------------------

interface Weather {
  /** Starts what is due at `localS` seconds into the scene. Cheap; called every frame. */
  tick(localS: number): void;
  hold(): void;
  release(): void;
  dispose(): void;
}

interface WeatherInput {
  /** The host under the fog: the rain goes in it. */
  below: HTMLElement;
  /** The host over the fog: the train's light and the droplets go in it. */
  above: HTMLElement;
  width: number;
  height: number;
  /** Pixel ratio of the rain's canvases. */
  ratio: number;
  /** The epigraph's box in stage coordinates, or null when it could not be measured. */
  text: Rect | null;
  rng: () => number;
  /** Where the scene is now, in seconds: 0 at the start, later when the stage is laid out again in the middle of the scene. */
  localS: number;
  dropletSpriteUrl: string;
  trainStrip: HTMLCanvasElement;
  held: boolean;
}

/**
 * One layer of rain painted once: its streaks, and every repeat of them down the slant, on a transparent
 * canvas, which is then turned into an image. The plane is carried by an animation, and a canvas that is
 * carried is handed to the compositor again every frame (measured: a plane this size cost 3 ms a frame as
 * a canvas and a fifth of that as an image), where an image is handed over once.
 */
function paintRainPlane(plan: RainLayerPlan, ratio: number, owned: Array<() => void>): HTMLImageElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(plan.planeWidth * ratio));
  canvas.height = Math.max(1, Math.round(plan.planeHeight * ratio));
  const c = canvas.getContext("2d");
  if (c) {
    c.scale(ratio, ratio);
    c.strokeStyle = RAIN_COLOUR;
    c.lineCap = "round";
    for (const stroke of plan.strokes) {
      c.globalAlpha = stroke.alpha;
      c.lineWidth = stroke.width;
      c.beginPath();
      for (const at of strokeRepeats(plan, stroke)) {
        c.moveTo(at.x - RAIN_SLANT * stroke.len, at.y - stroke.len);
        c.lineTo(at.x, at.y);
      }
      c.stroke();
    }
  }
  const image = document.createElement("img");
  image.alt = "";
  image.decoding = "async";
  image.draggable = false;
  image.setAttribute("aria-hidden", "true");
  // Encoded off the main thread; the plane shows when it is ready, which is long before the weather has faded in.
  if (typeof canvas.toBlob === "function") {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      owned.push(() => URL.revokeObjectURL(url));
      image.src = url;
    }, "image/png");
  } else {
    image.src = canvas.toDataURL("image/png");
  }
  return image;
}

/**
 * A soft dark veil over the rain, round the epigraph: the rain is gentler there, as it always was, and the
 * plate behind it a little darker, which only helps the text. A mask would do it more exactly and costs
 * the compositor a pass over the whole stage; this is one small layer that never changes.
 */
function textVeil(text: Rect | null): HTMLElement | null {
  if (!text) return null;
  const rx = Math.max(140, text.width * 0.8 + 40);
  const ry = Math.max(70, text.height * 0.8 + 40);
  const veil = document.createElement("div");
  veil.className = "tsuki-p1-veil";
  Object.assign(veil.style, {
    left: `${round2(text.x + text.width / 2 - rx)}px`,
    top: `${round2(text.y + text.height / 2 - ry)}px`,
    width: `${round2(rx * 2)}px`,
    height: `${round2(ry * 2)}px`,
  });
  return veil;
}

function mountWeather(input: WeatherInput): Weather {
  const { below, above, width, height, ratio, text, rng, localS, held } = input;
  const motion = createMotionSet();
  if (held) motion.hold();
  const events: DueEvent[] = [];
  const cleanup: Array<() => void> = [];
  let disposed = false;
  // The scene's time at the moment an event runs, which is never earlier than its own.
  let latest = localS;
  const localNow = () => latest;

  // --- the rain ---
  const rainBox = document.createElement("div");
  rainBox.className = "tsuki-p1-rainbox";
  for (const plan of planRain(width, height, rng)) {
    const plane = paintRainPlane(plan, ratio, cleanup);
    plane.className = `tsuki-p1-rainplane tsuki-p1-rainplane--${plan.name}`;
    Object.assign(plane.style, {
      left: `${plan.left}px`,
      top: `${plan.top}px`,
      width: `${plan.planeWidth}px`,
      height: `${plan.planeHeight}px`,
    });
    rainBox.append(plane);
    // The two layers do not fall in step with each other, or with the last time the stage was laid out.
    const duration = plan.durationS * 1000;
    const phase = rng() * duration;
    motion.start(
      plane,
      [{ transform: "translate(0px, 0px)" }, { transform: `translate(${round2(plan.shiftX)}px, ${plan.periodY}px)` }],
      { duration, iterations: Number.POSITIVE_INFINITY, easing: "linear" },
      phase + localS * 1000,
    );
  }
  const veil = textVeil(text);
  if (veil) rainBox.append(veil);
  below.append(rainBox);

  // --- the droplets ---
  const dropBox = document.createElement("div");
  dropBox.className = "tsuki-p1-dropbox";
  above.append(dropBox);
  const dropRng = createRng(0x0d20 ^ Math.round(width * 7 + height));
  const drops: DropletPlan[] = planDroplets(dropletCount(width, height), width, height, dropRng, SCENE_END_S + 1, 0.05, DROPLET_WAIT_SCALE);
  for (const plan of drops) {
    const element = document.createElement("div");
    element.className = "tsuki-p1-drop";
    const radius = plan.radius;
    Object.assign(element.style, {
      left: `${round2(plan.x - radius)}px`,
      top: `${round2(plan.y - radius * 1.2)}px`,
      width: `${round2(radius * 2)}px`,
      height: `${round2(radius * 2.5)}px`,
      backgroundImage: `url(${input.dropletSpriteUrl})`,
    });
    // Where it is now: past the slides that are over.
    let y = plan.y;
    for (const slide of plan.slides) if (slide.startS + slide.durationS <= localS) y = slide.toY;
    if (y !== plan.y) element.style.transform = `translateY(${round2(y - plan.y)}px)`;
    // The lens is a box of its own, not a ::before: a pseudo-element is styled again on every frame its droplet moves.
    const lens = document.createElement("i");
    lens.className = "tsuki-p1-lens";
    element.append(lens);
    dropBox.append(element);
    for (const slide of plan.slides) {
      if (slide.startS + slide.durationS <= localS) continue;
      events.push({
        atS: slide.startS,
        run() {
          if (disposed) return;
          const animation = motion.start(
            element,
            [{ transform: `translateY(${round2(slide.fromY - plan.y)}px)` }, { transform: `translateY(${round2(slide.toY - plan.y)}px)` }],
            { duration: slide.durationS * 1000, easing: "linear", fill: "forwards" },
            (localNow() - slide.startS) * 1000,
            () => settleAnimation(animation),
          );
        },
      });
    }
  }
  // The weather comes in over the first moments and eases off at the end.
  const envelope = (box: HTMLElement) => {
    const outroAt = SCENE_END_S - OUTRO_S;
    const frames = (part: "intro" | "outro") => envelopeSteps(part).map((step) => ({ offset: step.offset, opacity: step.value }));
    box.style.opacity = "0";
    if (localS < INTRO_S) {
      const intro = motion.start(box, frames("intro"), { duration: INTRO_S * 1000, fill: "forwards", easing: "linear" }, localS * 1000, () => settleAnimation(intro));
    } else {
      box.style.opacity = "1";
    }
    if (localS >= outroAt) {
      const outro = motion.start(box, frames("outro"), { duration: OUTRO_S * 1000, fill: "forwards", easing: "linear" }, (localS - outroAt) * 1000, () => settleAnimation(outro));
    } else {
      events.push({
        atS: outroAt,
        run() {
          if (disposed) return;
          const outro = motion.start(box, frames("outro"), { duration: OUTRO_S * 1000, fill: "forwards", easing: "linear" }, (localNow() - outroAt) * 1000, () => settleAnimation(outro));
        },
      });
    }
  };
  envelope(rainBox);
  envelope(dropBox);

  // --- the train's light ---
  const strip = Math.min(width * 0.6, 560);
  const band = strip * (96 / 520);
  const bandY = placeTrain(height, text ? { x: text.x, y: text.y, width: text.width, height: text.height } : null, band / 2);
  const trainEnds = TRAIN_START_S + TRAIN_DURATION_S;
  if (bandY !== null && localS < trainEnds) {
    const light = input.trainStrip;
    light.className = "tsuki-p1-train";
    light.setAttribute("aria-hidden", "true");
    Object.assign(light.style, { left: "0px", top: `${round2(bandY - band / 2)}px`, width: `${round2(strip)}px`, height: `${round2(band)}px`, opacity: "0" });
    above.append(light);
    cleanup.push(() => light.remove());
    const frames = trainLightSteps().map((step) => ({
      offset: step.offset,
      transform: `translateX(${round2(-strip + step.progress * (width + strip))}px)`,
      opacity: step.opacity,
    }));
    events.push({
      atS: TRAIN_START_S,
      run() {
        if (disposed) return;
        motion.start(light, frames, { duration: TRAIN_DURATION_S * 1000, fill: "forwards", easing: "linear" }, (localNow() - TRAIN_START_S) * 1000, () => light.remove());
      },
    });
  }

  const due = createDueQueue(events);
  return {
    tick(now) {
      latest = now;
      if (!disposed) due.tick(now);
    },
    hold: () => motion.hold(),
    release: () => motion.release(),
    dispose() {
      if (disposed) return;
      disposed = true;
      motion.cancelAll();
      for (const undo of cleanup) undo();
      rainBox.remove();
      dropBox.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// The fog: two sheets that part from the epigraph
// ---------------------------------------------------------------------------

interface FogSheet {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  /** Where the sheet sits on the stage when it has not moved, in CSS pixels. */
  readonly top: number;
  readonly height: number;
  readonly side: "up" | "down";
  /** How far it has been moved from there, in pixels (negative is up); it only moves while the fog parts, and stays where it was stopped. */
  offset: number;
}

// ---------------------------------------------------------------------------
// The scene

export function play(ctx: TsukiSceneContext): TsukiSceneHandle {
  injectSceneStyles(css, ctx.signal);
  const { stage, textEl, dialog } = ctx;

  // Everything this scene adds is undone through `life`: by the scene's own dispose() and by ctx.signal.
  const life = new AbortController();
  const signal = life.signal;
  ctx.signal.addEventListener("abort", () => life.abort(), { once: true });

  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    resolveDone();
  };

  // Audio: only when the Walkman is already on (ctx.audio is silent otherwise); never a gesture of its own.
  if (ctx.audio.available()) {
    ctx.audio.setCue("discovery");
    ctx.audio.layerSoundscape("distant-train", SOUNDSCAPE_VOLUME);
  }

  // One container for the picture's layers, so that the loop's own canvas, which takes the touches, comes last and stays on top.
  const layersRoot = document.createElement("div");
  layersRoot.className = "tsuki-p1-layers";
  // The plate is painted into a canvas of its own that is never in the page, then shown as an image: a canvas
  // that is in the page costs the compositor a handoff every frame, which an image does not.
  const plateBitmap = document.createElement("canvas");
  const plateCtx = plateBitmap.getContext("2d");
  const plate = document.createElement("img");
  plate.className = "tsuki-p1-plate";
  plate.alt = "";
  plate.decoding = "async";
  plate.draggable = false;
  plate.setAttribute("aria-hidden", "true");
  if (!plateCtx) {
    // No 2D canvas at all: the epigraph is plain, and the scene is a timed hold of it.
    const clock = createRevealClock(SCENE_END_S * 1000, signal);
    void clock.done.then(finish);
    return { done, dispose: () => life.abort() };
  }
  const rainHost = document.createElement("div");
  const fogHost = document.createElement("div");
  const aboveHost = document.createElement("div");
  for (const host of [rainHost, fogHost, aboveHost]) host.className = "tsuki-p1-host";
  layersRoot.append(plate, rainHost, fogHost, aboveHost);
  stage.append(layersRoot);

  const noiseMap = makeNoiseMap();
  const dropletSprite = makeDropletSprite();
  const dropletSpriteUrl = dropletSprite.toDataURL("image/png");
  const trainStrip = makeTrainStrip();
  const brushes = new Map<number, HTMLCanvasElement>();
  const rims = new Map<number, HTMLCanvasElement>();
  const schedule = createWipeSchedule();
  const log = createStampLog();
  const clock = createSceneClock();
  const fogMotion = createMotionSet();

  let width = 0;
  let height = 0;
  let short = 0;
  let pixelRatio = 1;
  let fog = 1;
  let userRadius = 0;
  let grid: CoverageGrid = createCoverageGrid(1, 1, 16);
  let geometry: CurtainGeometry = curtainGeometry(1, 0.5);
  let sheets: FogSheet[] = [];
  /** The fog parts by itself ("curtain") until the reader's hand takes over; then what is left of it thins out ("fade"). */
  let fogMode: "curtain" | "fade" = "curtain";
  let frozenProgress = 0;
  let fadeFromS = 0;
  let fadeSeconds = 1;
  let weather: Weather | null = null;
  let image: HTMLImageElement | null = null;
  let imageSettled = false;
  let ready = false;
  let fogClear = false;
  let coverageDirty = true;
  let boxDirty = true;
  let textBox: Rect | null = null;
  let userCoverage = 0;
  let shown = 0;
  let level = -1;
  let lastFrameS = 0;
  let stroke: { last: Point; carry: number } | null = null;
  let frames = 0;
  let scrolls = false;
  let appliedTouchAction = "none";
  let loop: TsukiCanvasLoop | null = null;
  const localS = () => clock.elapsedMs() / 1000;

  // --- the epigraph's haze -------------------------------------------------
  textEl.classList.add("tsuki-p1-text");
  textEl.style.setProperty("--tsuki-p1-reveal", "0");

  const measureText = () => {
    const box = textEl.getBoundingClientRect();
    const origin = stage.getBoundingClientRect();
    textBox =
      box.width > 0 && box.height > 0
        ? growRect({ x: box.left - origin.left, y: box.top - origin.top, width: box.width, height: box.height }, 16)
        : null;
    boxDirty = false;
    coverageDirty = true;
  };
  dialog.addEventListener("scroll", () => (boxDirty = true), { passive: true, signal });

  // --- the keyboard's wipe ---------------------------------------------------
  // A real button in the controls slot (the stage is aria-hidden): click covers pointer, keyboard and
  // assistive technology alike. It asks the schedule for the fast wipe, which parts the fog quicker.
  const wipeNow = () => {
    if (fogClear || !ready || schedule.fastRequested) return;
    schedule.requestFast(localS());
    restartFog();
  };
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tsuki-cutscene__control tsuki-p1-wipe";
  button.textContent = WIPE_LABEL;
  button.addEventListener("click", wipeNow, { signal });
  ctx.controls.append(button);
  // With focus on the dialog itself (no button focused) Space and Enter do the same.
  dialog.addEventListener(
    "keydown",
    (event) => {
      if ((event.key === " " || event.key === "Enter") && event.target === dialog && !event.repeat) wipeNow();
    },
    { signal },
  );

  // --- the fog -------------------------------------------------------------
  const brush = (radius: number): HTMLCanvasElement => {
    const key = Math.round(radius * fog * 2);
    let sprite = brushes.get(key);
    if (!sprite) {
      sprite = makeBrush(radius * fog);
      brushes.set(key, sprite);
    }
    return sprite;
  };

  const rim = (radius: number): HTMLCanvasElement => {
    const key = Math.round(radius * fog * 2);
    let sprite = rims.get(key);
    if (!sprite) {
      sprite = makeRim(radius * fog);
      rims.set(key, sprite);
    }
    return sprite;
  };

  /** Where a sheet is on the stage now. */
  const sheetTop = (sheet: FogSheet) => sheet.top + sheet.offset;

  /** One brush stamp on the fog: first the beaded edge on the fog that remains, then the clearing itself, in each sheet it reaches. */
  const blit = (x: number, y: number, radius: number) => {
    const sprite = brush(radius);
    const edge = rim(radius);
    const reach = radius * 1.18;
    for (const sheet of sheets) {
      const top = sheetTop(sheet);
      if (y + reach < top || y - reach > top + sheet.height) continue;
      const c = sheet.context;
      const at = (y - top) * fog;
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-atop";
      c.drawImage(edge, x * fog - edge.width / 2, at - edge.height / 2);
      c.globalCompositeOperation = "destination-out";
      c.drawImage(sprite, x * fog - sprite.width / 2, at - sprite.height / 2);
    }
  };

  /** A wipe: clears the fog under a brush, remembers the stamp (so a resize can repaint it) and the cells it cleared. */
  const stamp = (x: number, y: number, radius: number) => {
    blit(x, y, radius);
    grid.mark(x, y, radius * BRUSH_CORE);
    log.add(x / width, y / height, radius / short);
    coverageDirty = true;
  };

  const clearSheets = () => {
    for (const sheet of sheets) sheet.canvas.remove();
    sheets = [];
  };

  /** How far a sheet has moved when the parting is at plan progress p: the upper one up, the lower one down. */
  const offsetAt = (side: "up" | "down", p: number) => (side === "up" ? -geometry.upHeight * p : geometry.downHeight * p);

  /** Builds the two sheets of fog from the plate, at the current size, and puts back every stroke so far. */
  const buildFog = () => {
    fogMotion.cancelAll();
    clearSheets();
    if (fogClear || width <= 0 || height <= 0) return;
    const scale = fog;
    const [master, masterCtx] = makeCanvas(width * scale, height * scale);
    paintFog({ fog: master, fogCtx: masterCtx }, noiseMap, image);
    // Where the sheets are: apart as far as the parting has gone, or as far as it was when the reader's hand stopped it.
    const progress = fogMode === "fade" ? frozenProgress : schedule.progressAt(localS());
    const make = (side: "up" | "down", top: number, h: number): FogSheet | null => {
      const canvas = document.createElement("canvas");
      canvas.className = "tsuki-p1-fog tsuki-p1-fogsheet";
      canvas.setAttribute("aria-hidden", "true");
      const sy = Math.round(top * scale);
      canvas.width = master.width;
      canvas.height = Math.max(1, Math.round(h * scale));
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(master, 0, sy, master.width, canvas.height, 0, 0, master.width, canvas.height);
      bakeSoftEdge(context, canvas, side, geometry.soft * scale);
      Object.assign(canvas.style, { top: `${round2(top)}px`, height: `${round2(h)}px` });
      const offset = offsetAt(side, progress);
      canvas.style.transform = `translateY(${round2(offset)}px)`;
      fogHost.append(canvas);
      return { canvas, context, top, height: h, side, offset };
    };
    const up = make("up", 0, geometry.upHeight);
    const down = make("down", geometry.downTop, geometry.downHeight);
    sheets = [up, down].filter((sheet): sheet is FogSheet => sheet !== null);
    log.forEach((nx, ny, radiusOverShort) => {
      const radius = radiusOverShort * short;
      blit(nx * width, ny * height, radius);
      grid.mark(nx * width, ny * height, radius * BRUSH_CORE);
    });
  };

  /** Sets the parting going from where the schedule is now: the sheets move away from the epigraph, and are gone when the plan is done. */
  const startCurtain = () => {
    fogMotion.cancelAll();
    if (fogClear || sheets.length === 0) return;
    const now = localS();
    const at = (seconds: number) => schedule.progressAt(now + seconds);
    const rest = secondsToClear(at);
    if (at(0) >= 1 || rest <= 0) {
      clearFog(false);
      return;
    }
    const durationMs = Math.max(50, rest * 1000);
    const steps = curtainSteps(geometry, at, rest);
    for (const sheet of sheets) {
      const own = (step: (typeof steps)[number]) => (sheet.side === "up" ? -step.up : step.down);
      fogMotion.start(sheet.canvas, steps.map((step) => ({ offset: step.offset, transform: `translateY(${round2(own(step))}px)` })), { duration: durationMs, easing: "linear", fill: "forwards" }, 0);
    }
  };

  /** The reader's hand takes over: the sheets stop where they are, so that what is wiped stays where it was wiped, and the rest of the fog thins out by itself. */
  const interruptCurtain = () => {
    if (fogClear || fogMode !== "curtain" || sheets.length === 0) return;
    const p = schedule.progressAt(localS());
    fogMotion.cancelAll();
    for (const sheet of sheets) {
      sheet.offset = offsetAt(sheet.side, p);
      sheet.canvas.style.transform = `translateY(${round2(sheet.offset)}px)`;
    }
    frozenProgress = p;
    fogMode = "fade";
    startFade();
  };

  /** Thins the fog out over as long as the plan has left to run (the keyboard's wipe shortens it). */
  const startFade = () => {
    fogMotion.cancelAll();
    if (fogClear || sheets.length === 0) return;
    const now = localS();
    const rest = secondsToClear((seconds) => schedule.progressAt(now + seconds));
    fadeFromS = now;
    fadeSeconds = Math.max(0.6, rest);
    for (const sheet of sheets) {
      fogMotion.start(sheet.canvas, [{ opacity: FOG_OPACITY }, { opacity: 0 }], { duration: fadeSeconds * 1000, easing: "linear", fill: "forwards" }, 0);
    }
  };

  const restartFog = () => (fogMode === "curtain" ? startCurtain() : startFade());

  /** How much of the fog is left, 1 to 0, while it thins out. */
  const fadeLevel = (local: number) => (fogMode === "fade" ? Math.min(1, Math.max(0, 1 - (local - fadeFromS) / fadeSeconds)) : 1);

  /**
   * The glass counts as clear: whatever fog is left goes (it fades unless the plan has already taken it all), the
   * wipe button is done with, and the epigraph is crisp.
   */
  const clearFog = (fade: boolean) => {
    if (fogClear) return;
    fogClear = true;
    grid.clearAll();
    coverageDirty = true;
    fogMotion.cancelAll();
    for (const sheet of sheets) {
      sheet.canvas.classList.add("tsuki-p1-fog--gone");
      if (!fade) sheet.canvas.style.visibility = "hidden";
    }
    stage.classList.add("tsuki-p1-idle");
    // The wipe button is done: out of the tab order and the accessibility tree, but still in the layout so the text card does not shift.
    if (button === document.activeElement) dialog.querySelector<HTMLElement>("[data-cutscene-skip]")?.focus();
    button.classList.add("tsuki-p1-wipe--done");
  };

  // --- laying the layers out -----------------------------------------------
  let plateUrl = "";
  /** Hands the painted plate to the image, encoded off the main thread. */
  const showPlate = () => {
    plateBitmap.toBlob((blob) => {
      if (!blob || signal.aborted) return;
      const url = URL.createObjectURL(blob);
      plate.src = url;
      if (plateUrl) URL.revokeObjectURL(plateUrl);
      plateUrl = url;
    }, "image/png");
  };

  /** Paints the plate and the fog for the current size, and lays the weather out again. Runs on every resize. */
  const paintStatic = () => {
    paintPlate({ plate: plateBitmap, plateCtx }, width, height, image);
    showPlate();
    coverageDirty = true;
    const anchor = textBox ? Math.min(height, Math.max(0, textBox.y + textBox.height / 2)) : height / 2;
    geometry = curtainGeometry(height, anchor);
    buildWeather();
    buildFog();
    if (fogClear) grid.clearAll();
    if (ready) restartFog();
  };

  const buildWeather = () => {
    weather?.dispose();
    weather = null;
    if (!ready || width <= 0 || height <= 0) return;
    const now = localS();
    const built = mountWeather({
      below: rainHost,
      above: aboveHost,
      width,
      height,
      ratio: Math.min(pixelRatio, RAIN_PIXEL_RATIO_CAP),
      text: textBox,
      rng: createRng(SEED ^ Math.round(width * 31 + height)),
      localS: now,
      dropletSpriteUrl,
      trainStrip,
      held: clock.held,
    });
    weather = built;
  };

  const layout = (w: number, h: number, dpr: number) => {
    width = w;
    height = h;
    short = Math.min(w, h);
    pixelRatio = dpr;
    userRadius = brushRadius(w, h);
    fog = Math.min(1, FOG_LONG_SIDE_PX / Math.max(w, h));
    brushes.clear();
    rims.clear();
    grid = createCoverageGrid(w, h, gridCell(userRadius));
    plateBitmap.width = backingSize(w, Math.min(dpr, 1.5));
    plateBitmap.height = backingSize(h, Math.min(dpr, 1.5));
    measureText();
    stroke = null;
    if (imageSettled) paintStatic();
  };

  // --- the reader's hand ---------------------------------------------------
  const onPointer = (pointer: Readonly<PointerState>, event: PointerEvent) => {
    if (!ready || fogClear) {
      stroke = null;
      return;
    }
    if (event.type === "pointerdown") {
      if (overButton(event.target)) {
        stroke = null;
        return;
      }
      stroke = { last: { x: pointer.x, y: pointer.y }, carry: 0 };
      interruptCurtain();
      stamp(pointer.x, pointer.y, userRadius);
    } else if (event.type === "pointermove") {
      if (!stroke || !pointer.down) return;
      const to = { x: pointer.x, y: pointer.y };
      const result = stampsAlong(stroke.last, to, userRadius * 0.3, stroke.carry);
      for (const p of result.points) stamp(p.x, p.y, userRadius);
      stroke = { last: to, carry: result.carry };
    } else {
      // pointerup, pointercancel (a scroll gesture took the touch) and pointerout all end the stroke.
      stroke = null;
    }
  };

  // --- every frame: the clock's beats; nothing is drawn ----------------------
  const render = () => {
    if (!ready) return;
    const local = localS();
    const dt = Math.min(0.1, Math.max(0, local - lastFrameS));
    lastFrameS = local;
    frames++;

    // The canvas takes every touch while there is fog to wipe, except that a dialog which scrolls (a
    // large text size) keeps its vertical pan, and a clear glass has nothing left to take them for.
    if (frames % 45 === 1) scrolls = dialog.scrollHeight > dialog.clientHeight + 1;
    const touchAction = scrolls || fogClear ? "pan-y" : "none";
    if (touchAction !== appliedTouchAction) {
      appliedTouchAction = touchAction;
      stage.style.setProperty("touch-action", touchAction);
    }
    if (boxDirty) measureText();

    weather?.tick(local);

    // The glass is clear when the reader has wiped nearly all of it, or the plan has run its course.
    if (!fogClear) {
      const planDone = schedule.progressAt(local) >= 1;
      if (planDone || fogIsClear(local, grid.fraction())) clearFog(!planDone);
    }

    // The epigraph comes into focus as the glass in front of it clears: by the reader's hand, or by the fog parting.
    if (coverageDirty) {
      userCoverage = textBox ? grid.fractionIn(textBox) : grid.fraction();
      coverageDirty = false;
    }
    let coverage = userCoverage;
    if (!fogClear && textBox) {
      const progress = fogMode === "curtain" ? schedule.progressAt(local) : frozenProgress;
      const parted = curtainCoverage(geometry, progress, textBox.y, textBox.y + textBox.height);
      coverage = 1 - (1 - userCoverage) * (1 - parted) * fadeLevel(local);
    }
    shown = easeToward(shown, fogClear ? 1 : revealFor(coverage), dt, 0.28);
    const next = quantizeReveal(shown);
    if (next !== level) {
      level = next;
      textEl.style.setProperty("--tsuki-p1-reveal", String(next));
    }

    if (local >= SCENE_END_S) finish();
  };

  loop = ctx.createCanvasLoop({
    render,
    resize: (size) => layout(size.width, size.height, size.dpr),
    onPointer,
    className: "tsuki-p1-rain",
    dprCap: 1,
  });

  // The tab: the clock and every animation stop together, so that nothing runs ahead of the scene behind a hidden tab.
  const onVisibility = () => {
    if (document.hidden) {
      clock.hold();
      weather?.hold();
      fogMotion.hold();
    } else {
      clock.release();
      weather?.release();
      fogMotion.release();
    }
  };
  document.addEventListener("visibilitychange", onVisibility, { signal });

  // Play begins once the plate is in (or given up on), so the first thing seen is the glass, not a pop-in.
  void loadPlate(ctx.assets.backgroundUrl, signal, READY_TIMEOUT_MS).then((loaded) => {
    if (signal.aborted) return;
    image = loaded;
    imageSettled = true;
    ready = true;
    clock.start();
    stage.classList.add("tsuki-p1-ready");
    if (width > 0) paintStatic();
  });

  loop.start();

  // A safety net for a loop that never runs (no area, no animation frames): the scene still ends.
  const safety = createRevealClock(READY_TIMEOUT_MS + (SCENE_END_S + 3) * 1000, signal);
  void safety.done.then(finish);

  signal.addEventListener(
    "abort",
    () => {
      safety.dispose();
      loop?.destroy();
      weather?.dispose();
      fogMotion.cancelAll();
      layersRoot.remove();
      if (plateUrl) URL.revokeObjectURL(plateUrl);
      stage.classList.remove("tsuki-p1-ready", "tsuki-p1-idle");
      stage.style.removeProperty("touch-action");
      textEl.classList.remove("tsuki-p1-text");
      textEl.style.removeProperty("--tsuki-p1-reveal");
    },
    { once: true },
  );

  return { done, dispose: () => life.abort() };
}

// ---------------------------------------------------------------------------
// Reduced motion

/**
 * The static composition: the plate, a frosted rim of fog round a cleared
 * middle (so the epigraph sits on the clear plate, not on fog), a few droplets
 * and a handful of streaks, all drawn once. No loop runs, nothing is timed,
 * the Walkman is not touched, and the epigraph is left exactly as the dialog
 * shows it.
 */
export function still(ctx: TsukiSceneContext): void {
  injectSceneStyles(css, ctx.signal);
  const { stage } = ctx;
  const layers = createLayers(stage);
  if (!layers) return;

  const noiseMap = makeNoiseMap();
  const dropletSprite = makeDropletSprite();
  let width = 0;
  let height = 0;
  let image: HTMLImageElement | null = null;
  let imageSettled = false;
  let needsDraw = true;

  const paintBackground = () => {
    paintPlate(layers, width, height, image);
    paintFog(layers, noiseMap, image);
    const c = layers.fogCtx;
    const { width: fw, height: fh } = layers.fog;
    // Wipe the middle clear, leaving the mist gathered at the edges.
    const reach = Math.hypot(fw, fh) / 2;
    const clearing = c.createRadialGradient(fw / 2, fh / 2, 0, fw / 2, fh / 2, reach);
    clearing.addColorStop(0, "rgba(0, 0, 0, 1)");
    clearing.addColorStop(0.52, "rgba(0, 0, 0, 1)");
    clearing.addColorStop(0.92, "rgba(0, 0, 0, 0.35)");
    clearing.addColorStop(1, "rgba(0, 0, 0, 0.1)");
    c.globalCompositeOperation = "destination-out";
    c.fillStyle = clearing;
    c.fillRect(0, 0, fw, fh);
  };

  const drawTop = (c: CanvasRenderingContext2D, frame: Readonly<SceneFrame>) => {
    c.clearRect(0, 0, frame.width, frame.height);
    const seeded = createRng(SEED + 1);
    c.strokeStyle = RAIN_COLOUR;
    c.lineCap = "round";
    for (const streak of createRain(Math.round(rainCount(frame.width, frame.height) * 0.6), frame.width, frame.height, seeded)) {
      drawStreak(c, streak, streak.alpha * 0.8);
    }
    for (const drop of createDroplets(dropletCount(frame.width, frame.height), frame.width, frame.height, seeded)) {
      drawDroplet(c, dropletSprite, drop, 1);
    }
    c.globalAlpha = 1;
  };

  const loop = ctx.createCanvasLoop({
    // Under reduced motion the runtime calls reducedMotionFrame on start and after a resize and never
    // runs a frame; should it run frames anyway, draw once per size and leave the canvas alone after.
    render: (c, frame) => {
      if (!needsDraw) return;
      needsDraw = false;
      drawTop(c, frame);
    },
    reducedMotionFrame: drawTop,
    resize: (size) => {
      width = size.width;
      height = size.height;
      needsDraw = true;
      sizeLayers(layers, width, height, size.dpr);
      if (imageSettled) paintBackground();
    },
    className: "tsuki-p1-rain",
    dprCap: 1.5,
  });

  void loadPlate(ctx.assets.backgroundUrl, ctx.signal, null).then((loaded) => {
    if (ctx.signal.aborted) return;
    image = loaded;
    imageSettled = true;
    if (width > 0) paintBackground();
    stage.classList.add("tsuki-p1-ready");
  });
  // The runtime draws the still frame on start() and never runs an animation frame under reduced motion.
  loop.start();

  ctx.signal.addEventListener(
    "abort",
    () => {
      layers.plate.remove();
      layers.fog.remove();
      stage.classList.remove("tsuki-p1-ready");
    },
    { once: true },
  );
}
