// The passing train on the /tsukinomi/ home hero (design 4.4 and section 5): a
// train crosses behind a dark platform strip without stopping. Its windows are
// lit; some of them show film frames of the story's illustrations, the others
// carry dark passenger silhouettes. train-core.ts plans the pass (timeline,
// windows, which pictures); this module paints it. train-loader.ts decides
// whether it is downloaded at all: this chunk is imported dynamically, after
// first paint and idle, and not at all under prefers-reduced-motion or in short
// landscape.
//
// Cost. Nothing is redrawn while the train passes. A browser that rasterises in
// software hands the compositor a whole canvas again every time anything is drawn
// in it, whatever the drawing was (the train's canvas, cleared and redrawn each
// frame, was most of its cost), and does the same every frame for a canvas that
// is moved by an animation. So everything is painted once, on resize, into
// canvases that are not in the page and turned into images, and the compositor
// moves them:
//
//   backdrop   the mist and the platform strip, one image under the train,
//              faded in and out over the pass by an opacity animation
//   train      one element that holds the sprite (the whole train with its lit
//              panes and passengers, wider than the screen), the film frames
//              over their windows, and the light the windows throw on the
//              platform, carried across by one transform animation at the one
//              constant speed the train always had
//
// No blur filter, no shadowBlur, no getImageData, no gradient built per frame.
// The windows' lamps no longer flicker: the swing was a few percent, and each
// window's own flicker would have been an animation of its own.
//
// Film frames. Each allowed illustration is fetched once by an Image and decoded
// (off the main thread: Image.decode) and then shown as it is in its window, cropped
// by object-fit to the window's 4:5 portrait and graded to lamp light by two
// overlays (a warm multiply, a vignette with the dark film edge). Nothing is drawn
// on the main thread: drawing the full-size picture into a canvas, or into an
// ImageBitmap, decodes it again there, a hundred milliseconds a picture at a 4x
// slowdown, while an <img> in the page is decoded by the raster workers. A frame
// that has not arrived when the train reaches its window shows the lit pane instead
// and pops in when it is ready. Only the URLs in plan.frames are ever requested,
// and the plan only contains illustrations the spoiler rule allows (train-core.ts).
//
// Sound. The train is silent. The design allows the distant-train soundscape
// when the Walkman is already on, and that was left out on purpose: the
// soundscape is a 2.4 MB (ogg) or 6.6 MB (mp3) loop that would arrive after
// the train has largely passed (and then fade in over 4 s), switching it on
// writes the reader's persisted soundscape toggle and flickers the Walkman
// panel, and a pass cut short by leaving the page would need the same pagehide
// restore the cutscene session carries. A later pass that wants it can layer it
// through createSceneAudio (cutscene/audio.ts) at the start of the pass and call
// restore() at the end.
//
// Lifecycle. mountTrain() appends the backdrop and the train to the mount
// (aria-hidden, no pointer events), starts the pass once the first frames are
// in (or after FRAME_WAIT_MS), holds it (clock and animations together) while the
// tab is hidden or the mount is off screen, and when the pass ends or destroy()
// is called removes everything, stops the loop and lets go of every picture. The
// scene-runtime loop is kept for what it does well, not for drawing: it measures
// the mount, follows reduced motion and the tab, and runs the frame callback that
// checks the pass's clock; its canvas is never in the page.
import { createRng, createScene } from "../../_shared/scene-runtime";
import type { SceneHandle, SceneSize } from "../../_shared/scene-runtime";
import type { IllustrationEntry } from "./concourse-core";
import {
  FRAME_BITMAP,
  connectionAllowsFrames,
  createPassClock,
  envelopeSteps,
  isFinished,
  layoutTrain,
  parseCatalog,
  planTrain,
  travelEnds,
  type ConnectionHint,
  type Rect,
  type TrainLayout,
  type TrainPlan,
  type WindowPlan,
} from "./train-core";

/** Soft painterly content does not need a full 2x backing store. */
const DPR_CAP = 1.5;
/** The pass starts when the frames are in, or after this long, whichever is first. */
export const FRAME_WAIT_MS = 1800;
/** Pictures fetched and decoded at the same time. */
const LOAD_CONCURRENCY = 3;
/** Where in the picture the window crops it, as object-position's share of the room left over: a little above the middle, where faces are. */
const CROP_FOCUS_Y = 0.3;
/** How bright a film frame is in its window: what the windows' flicker used to average. */
const FRAME_OPACITY = 0.91;

// Colours are the site tokens (src/styles/tsukinomi/tokens.css), as RGB triples for rgba().
const MIST = "205, 211, 224";
const SAKURA = "230, 166, 189";
const SUNSET = "224, 138, 76";
const HIGAN = "179, 36, 43";
const LAMP_HIGH = "#f1c58b";
const LAMP_LOW = "#d4804a";
const FIGURE = "#0c0919";

export type TrainState = "passing" | "done";

export interface TrainSceneOptions {
  /** The hero's [data-train-mount]: its box is the stage, its data-illustrations the catalogue. */
  mount: HTMLElement;
  /** ReadState.furthestRead from concourse-core: the furthest part READ, or null. */
  furthestRead: number | null;
  /** Fixes the variation (the checks use it); default: random. */
  seed?: number;
  /** Called when the pass starts and when it is over. */
  onState?(state: TrainState): void;
}

export interface TrainHandle {
  destroy(): void;
}

// ---- small canvas helpers -------------------------------------------------------

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return canvas.getContext("2d");
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, rgb: string, alpha: number): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  gradient.addColorStop(0.45, `rgba(${rgb}, ${alpha * 0.28})`);
  gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

// ---- the three static layers ----------------------------------------------------

/** The sprite's padding on both ends, in CSS px: room for the headlight glow beyond the nose. */
const spritePad = (layout: TrainLayout) => Math.round(layout.height * 0.4);

/** Mist behind the train, so its dark body reads as a silhouette on the dark plate. */
function paintMist(ctx: CanvasRenderingContext2D, layout: TrainLayout, seed: number): void {
  const { width, height, bodyTop, bodyBottom } = layout;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, `rgba(${MIST}, 0)`);
  gradient.addColorStop(Math.max(0.05, (bodyTop - 4) / height), `rgba(${MIST}, 0.02)`);
  gradient.addColorStop(Math.min(0.95, (bodyTop + (bodyBottom - bodyTop) * 0.45) / height), `rgba(${MIST}, 0.13)`);
  gradient.addColorStop(1, `rgba(${MIST}, 0.05)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // A few soft banks of mist across the band (circles squashed to ellipses).
  const rng = createRng(seed ^ 0x6d697374);
  const banks = Math.max(3, Math.round(width / 300));
  for (let i = 0; i < banks; i++) {
    const x = ((i + rng() * 0.8) / banks) * width;
    const y = bodyTop + (bodyBottom - bodyTop) * (0.25 + rng() * 0.6);
    const radius = (0.9 + rng() * 0.9) * height;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.8, 0.45);
    glow(ctx, 0, 0, radius, MIST, 0.07 + rng() * 0.04);
    ctx.restore();
  }
}

/** The platform edge the train runs behind: a dark strip along the bottom with a lit lip and a dim tactile line. */
function paintPlatform(ctx: CanvasRenderingContext2D, layout: TrainLayout): void {
  const { width, height, groundH } = layout;
  const top = height - groundH;
  const gradient = ctx.createLinearGradient(0, top, 0, height);
  gradient.addColorStop(0, "rgba(28, 23, 52, 0.97)");
  gradient.addColorStop(1, "rgba(10, 8, 22, 0.98)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, top, width, groundH);
  ctx.fillStyle = `rgba(${MIST}, 0.2)`;
  ctx.fillRect(0, top, width, 1);
  // Tactile paving: a dashed amber line a little way in from the edge.
  ctx.fillStyle = `rgba(${SUNSET}, 0.34)`;
  const y = top + Math.round(groundH * 0.34);
  for (let x = 0; x < width; x += 9) ctx.fillRect(x, y, 6, 2);
}

// ---- the sprite -----------------------------------------------------------------

/**
 * The light the windows throw on the platform edge: one warm patch under each
 * window, in sprite coordinates, to be drawn over the platform strip (the strip's
 * own top edge is at y = 0 in this layer).
 */
function paintSpill(ctx: CanvasRenderingContext2D, layout: TrainLayout, scale: number): void {
  const { groundH } = layout;
  ctx.setTransform(scale, 0, 0, scale, spritePad(layout) * scale, 0);
  for (const rect of layout.windows) {
    // A flattened ellipse of light centred on the strip's lip, so patches fade out sideways too.
    const radius = rect.w * 0.95;
    ctx.save();
    ctx.translate(rect.x + rect.w / 2, 0);
    ctx.scale(1, groundH / radius);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, `rgba(${SUNSET}, 0.3)`);
    gradient.addColorStop(0.5, `rgba(${SUNSET}, 0.1)`);
    gradient.addColorStop(1, `rgba(${SUNSET}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(-radius, 0, radius * 2, radius);
    ctx.restore();
  }
}

function paintFigure(
  ctx: CanvasRenderingContext2D,
  cx: number,
  floor: number,
  unit: number,
  scale: number,
): void {
  // Head and shoulders, seated low in the window: the shoulders are an arch from the sill.
  const shoulders = unit * 0.62 * scale;
  const top = floor - unit * 0.44 * scale;
  const headR = unit * 0.125 * scale;
  ctx.beginPath();
  ctx.moveTo(cx - shoulders / 2, floor);
  ctx.quadraticCurveTo(cx - shoulders / 2, top + headR * 1.5, cx - headR * 0.9, top + headR * 1.35);
  ctx.lineTo(cx + headR * 0.9, top + headR * 1.35);
  ctx.quadraticCurveTo(cx + shoulders / 2, top + headR * 1.5, cx + shoulders / 2, floor);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, top + headR * 0.4, headR, 0, Math.PI * 2);
  ctx.fill();
}

function paintWindow(ctx: CanvasRenderingContext2D, rect: Rect, plan: WindowPlan): void {
  const { x, y, w, h } = rect;
  // A faint halo of lamp light round the pane, in two steps (no blur).
  ctx.fillStyle = `rgba(${SUNSET}, 0.07)`;
  roundedRect(ctx, x - 5, y - 5, w + 10, h + 10, 6);
  ctx.fill();
  ctx.fillStyle = `rgba(${SUNSET}, 0.1)`;
  roundedRect(ctx, x - 2.5, y - 2.5, w + 5, h + 5, 4);
  ctx.fill();
  // The frame of the window, then the lit pane.
  ctx.fillStyle = "#0a0816";
  roundedRect(ctx, x - 1.5, y - 1.5, w + 3, h + 3, 3);
  ctx.fill();
  const pane = ctx.createLinearGradient(0, y, 0, y + h);
  pane.addColorStop(0, LAMP_HIGH);
  pane.addColorStop(1, LAMP_LOW);
  ctx.fillStyle = pane;
  roundedRect(ctx, x, y, w, h, 2);
  ctx.fill();

  if (plan.kind === "frame") return;
  ctx.save();
  roundedRect(ctx, x, y, w, h, 2);
  ctx.clip();
  if (plan.kind === "silhouette" && plan.figure) {
    ctx.fillStyle = FIGURE;
    const { shape, dx, scale } = plan.figure;
    const centre = x + w / 2 + dx * w * 0.2;
    if (shape === "pair") {
      paintFigure(ctx, centre - w * 0.2, y + h, w, scale * 0.95);
      paintFigure(ctx, centre + w * 0.22, y + h, w, scale * 0.78);
    } else {
      paintFigure(ctx, centre, y + h + (shape === "child" ? h * 0.1 : 0), w, shape === "child" ? scale * 0.75 : scale);
    }
  } else if (plan.kind === "empty" && plan.blind) {
    const blind = h * plan.blind;
    ctx.fillStyle = "rgba(70, 40, 28, 0.62)";
    ctx.fillRect(x, y, w, blind);
    ctx.fillStyle = "rgba(20, 12, 20, 0.45)";
    for (let line = 3; line < blind; line += 4) ctx.fillRect(x, y + line, w, 1);
  }
  ctx.restore();
}

/** The whole train, at device resolution, ready to be sliced onto the canvas. */
function paintSprite(ctx: CanvasRenderingContext2D, layout: TrainLayout, plan: TrainPlan, scale: number): void {
  const { height, bodyTop, bodyBottom, length, noseW, carriageW, carriageGap, doorW, direction } = layout;
  const bodyH = bodyBottom - bodyTop;
  const pad = spritePad(layout);
  ctx.setTransform(scale, 0, 0, scale, pad * scale, 0);

  const bodyFill = ctx.createLinearGradient(0, bodyTop, 0, bodyBottom);
  bodyFill.addColorStop(0, "#1b1736");
  bodyFill.addColorStop(0.4, "#131029");
  bodyFill.addColorStop(1, "#0b091b");
  // s is the distance from the head tip along the train; the sprite's x depends on the direction.
  const X = (s: number) => (direction > 0 ? length - s : s);
  const span = (s0: number, s1: number) => ({ x: Math.min(X(s0), X(s1)), w: s1 - s0 });

  // Couplings first, so the carriages sit over them.
  ctx.fillStyle = "#0a0817";
  for (let k = 0; k < plan.carriages - 1; k++) {
    const s0 = noseW + k * (carriageW + carriageGap) + carriageW;
    const gap = span(s0 - 1, s0 + carriageGap + 1);
    ctx.fillRect(gap.x, bodyTop + bodyH * 0.14, gap.w, bodyH * 0.8);
  }

  for (let k = 0; k < plan.carriages; k++) {
    const rect = layout.carriages[k];
    const s0 = noseW + k * (carriageW + carriageGap);

    ctx.fillStyle = bodyFill;
    roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, bodyH * 0.09);
    ctx.fill();
    // Lit roofline: the moon on the roof.
    ctx.fillStyle = `rgba(${MIST}, 0.3)`;
    ctx.fillRect(rect.x + bodyH * 0.09, rect.y, rect.w - bodyH * 0.18, 1);
    // Air-conditioner boxes on the roof.
    ctx.fillStyle = "#110e24";
    for (const at of [0.2, 0.62]) {
      const unitW = rect.w * 0.17;
      roundedRect(ctx, rect.x + rect.w * at, rect.y - height * 0.045, unitW, height * 0.05, 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${MIST}, 0.16)`;
      ctx.fillRect(rect.x + rect.w * at + 2, rect.y - height * 0.045, unitW - 4, 1);
      ctx.fillStyle = "#110e24";
    }
    // Belt stripe, and a row of film perforations above and below the windows.
    ctx.fillStyle = `rgba(${SAKURA}, 0.42)`;
    ctx.fillRect(rect.x, rect.y + bodyH * 0.8, rect.w, 2);
    ctx.fillStyle = `rgba(${MIST}, 0.15)`;
    for (const rowY of [rect.y + bodyH * 0.09, rect.y + bodyH * 0.9]) {
      for (let px = rect.x + 6; px < rect.x + rect.w - 8; px += 7) {
        roundedRect(ctx, px, rowY, 3, 3.5, 1);
        ctx.fill();
      }
    }
    // Doors at both ends, each with a narrow lit pane.
    for (const doorS0 of [s0, s0 + carriageW - doorW]) {
      const door = span(doorS0, doorS0 + doorW);
      ctx.fillStyle = "#16122b";
      ctx.fillRect(door.x + 2, rect.y + bodyH * 0.1, door.w - 4, bodyH * 0.7);
      ctx.fillStyle = `rgba(${MIST}, 0.1)`;
      ctx.fillRect(door.x + 2, rect.y + bodyH * 0.1, 1, bodyH * 0.7);
      ctx.fillRect(door.x + door.w - 3, rect.y + bodyH * 0.1, 1, bodyH * 0.7);
      ctx.fillStyle = "rgba(240, 176, 104, 0.8)";
      ctx.fillRect(door.x + door.w * 0.36, rect.y + bodyH * 0.24, door.w * 0.28, bodyH * 0.36);
    }
  }

  // The nose: a raked cab with a dark windscreen, and a headlight.
  const noseTop = bodyTop;
  ctx.beginPath();
  ctx.moveTo(X(noseW + 2), noseTop);
  ctx.quadraticCurveTo(X(noseW * 0.5), noseTop + bodyH * 0.02, X(noseW * 0.12), noseTop + bodyH * 0.42);
  ctx.quadraticCurveTo(X(0), noseTop + bodyH * 0.58, X(noseW * 0.04), noseTop + bodyH * 0.82);
  ctx.lineTo(X(noseW * 0.2), bodyBottom);
  ctx.lineTo(X(noseW + 2), bodyBottom);
  ctx.closePath();
  ctx.fillStyle = bodyFill;
  ctx.fill();
  ctx.strokeStyle = `rgba(${MIST}, 0.3)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(X(noseW + 2), noseTop + 0.5);
  ctx.quadraticCurveTo(X(noseW * 0.5), noseTop + bodyH * 0.02 + 0.5, X(noseW * 0.12), noseTop + bodyH * 0.42);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(X(noseW * 0.88), noseTop + bodyH * 0.14);
  ctx.quadraticCurveTo(X(noseW * 0.5), noseTop + bodyH * 0.16, X(noseW * 0.2), noseTop + bodyH * 0.44);
  ctx.lineTo(X(noseW * 0.3), noseTop + bodyH * 0.54);
  ctx.lineTo(X(noseW * 0.88), noseTop + bodyH * 0.5);
  ctx.closePath();
  ctx.fillStyle = "#0a0816";
  ctx.fill();
  ctx.fillStyle = `rgba(${SUNSET}, 0.22)`;
  ctx.fill();
  ctx.fillStyle = `rgba(${SAKURA}, 0.5)`;
  ctx.fillRect(Math.min(X(noseW * 0.18), X(noseW + 2)), noseTop + bodyH * 0.8, noseW * 0.82 + 2, 2);
  const lampX = X(noseW * 0.1);
  const lampY = noseTop + bodyH * 0.7;
  glow(ctx, lampX, lampY, height * 0.3, "255, 226, 178", 0.55);
  ctx.fillStyle = "#fff4d8";
  ctx.beginPath();
  ctx.arc(lampX, lampY, 2.2, 0, Math.PI * 2);
  ctx.fill();

  // The red tail lamp of the last carriage (the pact's red, small and steady).
  const tailS = noseW + plan.carriages * carriageW + (plan.carriages - 1) * carriageGap;
  const tailX = X(tailS - 3);
  const tailY = noseTop + bodyH * 0.66;
  glow(ctx, tailX, tailY, height * 0.14, HIGAN, 0.65);
  ctx.fillStyle = "#e5535a";
  ctx.beginPath();
  ctx.arc(tailX, tailY, 1.8, 0, Math.PI * 2);
  ctx.fill();

  for (let index = 0; index < layout.windows.length; index++) paintWindow(ctx, layout.windows[index], plan.windows[index]);
}

// ---- the renderer ---------------------------------------------------------------

export interface TrainRenderer {
  /** The backdrop image and the train element, in the order they go into the mount (backdrop first). */
  readonly elements: readonly HTMLElement[];
  /** The sprite's length in CSS px, with the padding it was painted with: the travel is measured against it. */
  readonly layout: TrainLayout;
  /** Resolves when the three images are encoded and set; the pass should not start before. */
  readonly ready: Promise<void>;
  /** Puts a film frame into the window it is for. Does nothing for a source the plan does not hold or one already shown. */
  addFrame(src: string, picture: HTMLImageElement): void;
  dispose(): void;
}

export interface RendererInput {
  plan: TrainPlan;
  size: SceneSize;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

const absolute = (element: HTMLElement, box: { left: number; top: number; width: number; height: number }) => {
  Object.assign(element.style, {
    position: "absolute",
    display: "block",
    maxWidth: "none",
    maxHeight: "none",
    margin: "0",
    pointerEvents: "none",
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  });
};

/**
 * An <img> showing what has been painted on `canvas`, encoded off the main
 * thread; `done` resolves once its source is set. The canvas is not kept.
 */
function imageOf(canvas: HTMLCanvasElement, urls: string[]): { image: HTMLImageElement; done: Promise<void> } {
  const image = document.createElement("img");
  image.alt = "";
  image.decoding = "async";
  image.draggable = false;
  image.setAttribute("aria-hidden", "true");
  const done = new Promise<void>((resolve) => {
    const set = (url: string) => {
      image.src = url;
      resolve();
    };
    if (typeof canvas.toBlob === "function") {
      canvas.toBlob((blob) => {
        if (!blob) return resolve();
        const url = URL.createObjectURL(blob);
        urls.push(url);
        set(url);
      }, "image/png");
    } else {
      set(canvas.toDataURL("image/png"));
    }
  });
  return { image, done };
}

/** Fetches and decodes one illustration, the only request the train makes; null when it cannot be loaded. Exported for the visual checks. */
export async function loadFrameImage(src: string): Promise<HTMLImageElement | null> {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  try {
    await image.decode();
    return image.naturalWidth > 0 && image.naturalHeight > 0 ? image : null;
  } catch {
    return null;
  }
}

/**
 * One film frame: the picture in its window, a warm multiply and a vignette over it, and a dark edge
 * round it, in a box that is held at FRAME_OPACITY. The grade is what the canvas this replaces drew
 * (multiply of rgba(255, 210, 160, 0.42), a radial dark rim, a 3 px edge on a 96 px wide frame), as
 * elements; they are painted once into the train's layer, which only moves after.
 */
function frameElement(source: HTMLImageElement, rect: Rect): HTMLElement {
  const scale = rect.w / FRAME_BITMAP.width;
  const box = document.createElement("div");
  box.setAttribute("aria-hidden", "true");
  absolute(box, { left: rect.x, top: rect.y, width: rect.w, height: rect.h });
  Object.assign(box.style, { overflow: "hidden", opacity: String(FRAME_OPACITY) });

  const picture = source.cloneNode(false) as HTMLImageElement;
  picture.alt = "";
  picture.decoding = "async";
  picture.draggable = false;
  picture.setAttribute("aria-hidden", "true");
  absolute(picture, { left: 0, top: 0, width: rect.w, height: rect.h });
  Object.assign(picture.style, { objectFit: "cover", objectPosition: `50% ${CROP_FOCUS_Y * 100}%` });

  const tint = document.createElement("div");
  absolute(tint, { left: 0, top: 0, width: rect.w, height: rect.h });
  Object.assign(tint.style, { background: "rgba(255, 210, 160, 0.42)", mixBlendMode: "multiply" });

  const rim = document.createElement("div");
  absolute(rim, { left: 0, top: 0, width: rect.w, height: rect.h });
  Object.assign(rim.style, {
    background: `radial-gradient(circle ${round2(rect.h * 0.8)}px at 50% 47%, rgba(12, 8, 24, 0) 31%, rgba(12, 8, 24, 0.42) 100%)`,
    boxShadow: `inset 0 0 0 ${round2(Math.max(1, 3 * scale))}px rgba(10, 8, 22, 0.92)`,
  });

  box.append(picture, tint, rim);
  return box;
}

/**
 * Paints the train's layers for a stage size, once, and returns them as elements.
 * Also the seam the visual checks use. The train element holds the sprite, the
 * light on the platform and the film frames in sprite coordinates (0 at the
 * sprite's left edge, before its padding); the pass moves it by a transform. The
 * backdrop (mist, platform strip) lies under it and the train body stops at the
 * platform's lip, which is why the strip can sit under the train.
 */
export function createTrainRenderer(input: RendererInput): TrainRenderer | null {
  const { plan, size } = input;
  if (size.width < 40 || size.height < 40) return null;
  const dpr = size.dpr;
  const layout = layoutTrain(size, plan.carriages, plan.direction);
  const pad = spritePad(layout);

  const backdropCanvas = makeCanvas(size.width * dpr, size.height * dpr);
  const sprite = makeCanvas((layout.length + 2 * pad) * dpr, size.height * dpr);
  const spill = makeCanvas((layout.length + 2 * pad) * dpr, layout.groundH * dpr);
  const backdropCtx = context2d(backdropCanvas);
  const spriteCtx = context2d(sprite);
  const spillCtx = context2d(spill);
  if (!backdropCtx || !spriteCtx || !spillCtx) return null;
  backdropCtx.scale(dpr, dpr);
  paintMist(backdropCtx, layout, plan.seed);
  paintPlatform(backdropCtx, layout);
  paintSprite(spriteCtx, layout, plan, dpr);
  paintSpill(spillCtx, layout, dpr);

  const urls: string[] = [];
  const backdrop = imageOf(backdropCanvas, urls);
  absolute(backdrop.image, { left: 0, top: 0, width: size.width, height: size.height });
  backdrop.image.style.opacity = "0";

  const train = document.createElement("div");
  train.setAttribute("aria-hidden", "true");
  Object.assign(train.style, { position: "absolute", left: "0px", top: "0px", width: "0px", height: "0px", pointerEvents: "none", willChange: "transform" });
  // Off screen until the pass moves it, at the end the sprite starts from.
  train.style.transform = `translateX(${travelEnds(size.width, layout.length, plan.direction).from}px)`;
  const body = imageOf(sprite, urls);
  absolute(body.image, { left: -pad, top: 0, width: layout.length + 2 * pad, height: size.height });
  const light = imageOf(spill, urls);
  absolute(light.image, { left: -pad, top: size.height - layout.groundH, width: layout.length + 2 * pad, height: layout.groundH });
  // The sprite, then the frames over it, then the light on the platform.
  train.append(body.image);
  const windowsBySrc = new Map<string, WindowPlan[]>();
  for (const window of plan.windows) {
    if (window.kind !== "frame" || window.src === undefined) continue;
    windowsBySrc.set(window.src, [...(windowsBySrc.get(window.src) ?? []), window]);
  }
  const shown = new Set<string>();
  train.append(light.image);

  let disposed = false;
  return {
    elements: [backdrop.image, train],
    layout,
    ready: Promise.all([backdrop.done, body.done, light.done]).then(() => undefined),
    addFrame(src, picture) {
      if (disposed || shown.has(src)) return;
      const windows = windowsBySrc.get(src);
      if (!windows) return;
      shown.add(src);
      for (const window of windows) {
        // Over the sprite and under the light on the platform.
        train.insertBefore(frameElement(picture, layout.windows[window.index]), light.image);
      }
    },
    dispose() {
      disposed = true;
      for (const url of urls) URL.revokeObjectURL(url);
      urls.length = 0;
      for (const element of [backdrop.image, train]) element.remove();
      for (const canvas of [backdropCanvas, sprite, spill]) {
        canvas.width = 0;
        canvas.height = 0;
      }
    },
  };
}

// ---- mounting -------------------------------------------------------------------

const randomSeed = () => Math.floor(Math.random() * 0xffffffff);

function readConnection(): ConnectionHint | null {
  const nav = navigator as Navigator & { connection?: ConnectionHint };
  return nav.connection ?? null;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Loads every URL with a few at a time, putting each picture in `into` as it arrives. Stops early when `alive` turns false. */
async function loadFrames(urls: readonly string[], into: Map<string, HTMLImageElement>, alive: () => boolean, onArrive: (src: string, picture: HTMLImageElement) => void): Promise<void> {
  const queue = [...urls];
  const worker = async () => {
    while (alive()) {
      const src = queue.shift();
      if (src === undefined) return;
      const picture = await loadFrameImage(src);
      if (picture && alive()) {
        into.set(src, picture);
        onArrive(src, picture);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(LOAD_CONCURRENCY, queue.length) }, worker));
}

export function mountTrain(options: TrainSceneOptions): TrainHandle {
  const { mount, furthestRead, onState } = options;
  const seed = options.seed ?? randomSeed();
  const catalog: IllustrationEntry[] = parseCatalog(mount.dataset.illustrations);
  const plan = planTrain({ seed, catalog, furthestRead, allowFrames: connectionAllowsFrames(readConnection()) });
  const total = plan.timeline.total;

  // The loop is kept for what it measures and follows; its canvas never goes into the page.
  const detached = document.createElement("canvas");
  const pictures = new Map<string, HTMLImageElement>();
  const clock = createPassClock();
  let renderer: TrainRenderer | null = null;
  let scene: SceneHandle | null = null;
  let observer: IntersectionObserver | null = null;
  let animations: Animation[] = [];
  let destroyed = false;
  let started = false;
  let onScreen = true;
  let finished = false;
  let size: SceneSize | null = null;

  const alive = () => !destroyed;
  const running = () => onScreen && !document.hidden;

  const stopAnimations = () => {
    for (const animation of animations) animation.cancel();
    animations = [];
  };

  /** Makes the two animations of the pass, `atMs` into it, and lets them run if the pass is running. */
  const animate = (atMs: number) => {
    stopAnimations();
    const current = renderer;
    if (!current || !size) return;
    const [backdrop, train] = current.elements;
    const ends = travelEnds(size.width, current.layout.length, plan.direction);
    const { lead, travel } = plan.timeline;
    // The train moves in a straight line from the end it starts at to the end it leaves by, over the travel part of the pass.
    const carry = train.animate(
      [{ transform: `translateX(${ends.from}px)` }, { transform: `translateX(${ends.to}px)` }],
      { duration: travel * 1000, delay: lead * 1000, fill: "both", easing: "linear" },
    );
    const fade = backdrop.animate(
      envelopeSteps(plan.timeline).map((step) => ({ offset: step.offset, opacity: step.value })),
      { duration: total * 1000, fill: "both", easing: "linear" },
    );
    animations = [carry, fade];
    for (const animation of animations) {
      animation.currentTime = atMs;
      if (!running()) animation.pause();
    }
  };

  const teardown = () => {
    if (destroyed) return;
    destroyed = true;
    observer?.disconnect();
    observer = null;
    document.removeEventListener("visibilitychange", syncRun);
    scene?.destroy();
    scene = null;
    stopAnimations();
    renderer?.dispose();
    renderer = null;
    pictures.clear();
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    // Not inside the frame callback that noticed the end: the loop is torn down after it returns.
    queueMicrotask(() => {
      teardown();
      onState?.("done");
    });
  };

  /** The pass holds (clock and animations) while the tab is hidden or the mount is off screen. */
  function syncRun() {
    if (!started || destroyed || finished) return;
    if (running()) {
      clock.release();
      for (const animation of animations) animation.play();
      scene?.start();
    } else {
      clock.hold();
      for (const animation of animations) animation.pause();
      scene?.stop();
    }
  }

  const build = () => {
    renderer?.dispose();
    renderer = size ? createTrainRenderer({ plan, size }) : null;
    if (!renderer) return;
    mount.append(...renderer.elements);
    for (const [src, picture] of pictures) renderer.addFrame(src, picture);
    const current = renderer;
    void current.ready.then(() => {
      if (destroyed || renderer !== current) return;
      if (started) animate(clock.elapsedMs());
    });
  };

  scene = createScene({
    canvas: detached,
    container: mount,
    dprCap: DPR_CAP,
    resize(next) {
      size = next;
      build();
    },
    render() {
      if (clock.started && isFinished(clock.elapsedMs() / 1000, plan.timeline)) finish();
    },
    // A reader who switches to reduced motion mid-pass gets nothing left on the stage, not a frozen train.
    reducedMotionFrame() {
      stopAnimations();
      for (const element of renderer?.elements ?? []) element.style.opacity = "0";
    },
  });

  document.addEventListener("visibilitychange", syncRun);
  if (typeof IntersectionObserver === "function") {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) onScreen = entry.isIntersecting;
      syncRun();
    });
    observer.observe(mount);
  }

  // Start once the pictures are in, or after FRAME_WAIT_MS; late ones pop in.
  void (async () => {
    await Promise.race([loadFrames(plan.frames, pictures, alive, (src, picture) => renderer?.addFrame(src, picture)), delay(FRAME_WAIT_MS)]);
    if (destroyed) return;
    started = true;
    clock.start();
    if (!running()) clock.hold();
    onState?.("passing");
    // The images are encoded within a few frames; the animations wait for them.
    void (renderer as TrainRenderer | null)?.ready.then(() => {
      if (destroyed) return;
      animate(clock.elapsedMs());
      syncRun();
    });
  })();

  return { destroy: teardown };
}
