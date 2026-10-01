// The prologue cutscene (design 4.3, row 1): a black screen and a Walkman.
//
// The reader presses Play, which is the gesture that lets the Walkman make
// sound. One earphone wire draws itself across the screen to a single earbud;
// the second earbud stays empty, unplugged: the story's one earphone shared
// between two people. The epigraph appears as slow subtitles, and when the
// words reach "จำชื่อ" (remembering a name) a station lamp warms up at some
// stone steps. If nobody presses Play it starts by itself after 6 seconds,
// silent (unless the Walkman is already on), because a scene that waits for a
// click would hold a reader who never makes one.
//
// Everything here follows the contract in ../scene-types.ts. The arithmetic
// (timeline, subtitle pacing, wire path, layout around the epigraph) is in
// prologue-core.ts, which node:test can load; this file is the DOM, the canvas
// and the audio.
//
// Nothing here is redrawn every frame. In a browser that rasterises in
// software, presenting a canvas that changed costs the main thread a fixed
// amount plus its area whatever was drawn in it (measured: a full-screen canvas
// with a tiny drawing in it cost about 1.8 ms a frame, a thumbnail-sized one
// about 0.6), so the frame loop of an earlier version spent most of its time
// handing a mostly empty screen to the compositor. Every layer is now painted
// once, when the stage is laid out, and what moves is moved by the compositor:
//
//   static canvas   the steps and the lamp post. Painted when the stage is laid
//                   out, never in a frame loop.
//   lamp glow       a CSS gradient that fades its opacity in over 3 s.
//   Walkman         walkman.svg fetched once and inlined. Its two reels and its
//                   little lamp are lifted out of the drawing into elements of
//                   their own, so that turning them is an HTML transform.
//   cassette        cassette-mark.svg as an <img> on the landing, dim until the lamp lights.
//   wire            one canvas with the whole wire, hidden under a black cover
//                   that slides off it as the wire is pulled out; the earbud at
//                   its tip is a small sprite carried along the path by a
//                   transform animation, with its glow and the empty earbud
//                   fading in on opacity animations. The animations are
//                   keyframe lists sampled from the path (prologue-core.ts).
//   subtitles       the epigraph's own text, one <span> per grapheme cluster, each
//                   faded in by a CSS animation with its own delay.
//
// The scene's clock is the page's own (performance.now(), held while the tab is
// hidden), the same clock the animations run on, and a frame callback only
// checks it for the next beat: the subtitles starting, the lamp lighting, the
// end. It draws nothing.
//
// The picture is placed around the epigraph, never over it, from the epigraph's
// own rectangle (computeLayout). When the reader's text size is so large that the
// dialog scrolls, the card moves over the stage and nothing can be kept clear of
// it, so the picture steps aside ("bare") and the subtitles play alone.
//
// Audio. Pressing Play is the only gesture: requestPlayFromGesture() runs first
// in the click handler. The Walkman plays its own tape-click when it switches on,
// so the scene adds one only if the Walkman was on already. The automatic start
// asks for no gesture, so it makes sound only when the Walkman is already on.
//
// Reduced motion: still() is the finished picture (wire drawn, lamp lit) behind
// the whole epigraph, with nothing moving and no Play button.
import { splitGraphemes } from "../../../_shared/cutscene/graphemes";
import type { TsukiCanvasLoop, TsukiSceneContext, TsukiSceneHandle } from "../scene-types";
import { injectSceneStyles } from "../styles";
import {
  COVER_UNDER_BUD,
  WALKMAN_VIEWBOX,
  boundsOf,
  buildTimeline,
  computeLayout,
  createAutoStart,
  createSceneClock,
  emptyLayout,
  SUBTITLE_TEXT_CLASS,
  emptyFadeSteps,
  featherFor,
  glowSteps,
  glowStartOffset,
  groupLines,
  inflate,
  lampClusterFor,
  lineSweep,
  rectHeight,
  rectWidth,
  startPlan,
  subtitleSchedule,
  wireSteps,
  type AutoStart,
  type Bud,
  type ClusterBox,
  type Layout,
  type Rect,
  type StepsGroup,
  type SubtitleSchedule,
  type Timeline,
  type WireGroup,
} from "./prologue-core";
import prologueCss from "./prologue.css?inline";

/** The Play control's label and accessible name: new copy, for the author to approve. */
const PLAY_LABEL = "เล่นเทป";

const TAU = Math.PI * 2;
const noop = () => {};
/**
 * The dialog counts as scrolling (the reader's text is too large for the screen) only past this
 * many pixels. The card then moves over the stage; a few pixels of overflow move it too little
 * to reach the picture, which keeps at least 12 px clear of it.
 */
const SCROLL_TOLERANCE_PX = 4;

// The palette is the assets' own (walkman.svg, cassette-mark.svg) and the site's night colours.
const INK = {
  wire: "#a39478",
  budBody: "#241d14",
  budLit: "#f0b97a",
  budDim: "#857559",
  stoneRiser: "#1a1730",
  stoneEdge: "#38344f",
  stoneTread: "#2a2741",
  stoneTreadEdge: "#4f4b6c",
  stoneJoint: "rgba(70, 66, 98, 0.55)",
  iron: "#6b5f4f",
  shade: "#2b251f",
  shadeRim: "#8a7c66",
  bulbOff: "#57472f",
} as const;

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function drawStepsAndLamp(c: CanvasRenderingContext2D, steps: StepsGroup): void {
  const u = steps.unit;
  c.save();
  c.lineJoin = "round";
  c.lineCap = "round";

  steps.levels.forEach((level, index) => {
    const { riser, tread } = level;
    const width = rectWidth(riser);
    const height = rectHeight(riser);
    c.fillStyle = INK.stoneRiser;
    c.fillRect(riser.left, riser.top, width, height);
    // Joints between the blocks of the riser, never in the same place on two steps.
    c.strokeStyle = INK.stoneJoint;
    c.lineWidth = 1;
    c.beginPath();
    for (let joint = 0; joint < 3; joint++) {
      const x = riser.left + width * (0.2 + joint * 0.29 + ((index * 0.11 + joint * 0.05) % 0.09));
      c.moveTo(x, riser.top);
      c.lineTo(x, riser.bottom);
    }
    c.stroke();
    c.strokeStyle = INK.stoneEdge;
    c.beginPath();
    c.moveTo(riser.left + 0.5, riser.bottom);
    c.lineTo(riser.left + 0.5, riser.top);
    c.moveTo(riser.right - 0.5, riser.bottom);
    c.lineTo(riser.right - 0.5, riser.top);
    c.stroke();

    c.beginPath();
    c.moveTo(tread[0].x, tread[0].y);
    for (let corner = 1; corner < tread.length; corner++) c.lineTo(tread[corner].x, tread[corner].y);
    c.closePath();
    c.fillStyle = INK.stoneTread;
    c.fill();
    c.strokeStyle = INK.stoneTreadEdge;
    c.stroke();
  });

  // The lowest step dissolves into the dark instead of ending on a hard line.
  const level = steps.levels[0];
  const fadeTop = steps.baseY - rectHeight(level.riser) * 1.5;
  c.globalCompositeOperation = "destination-out";
  const fade = c.createLinearGradient(0, fadeTop, 0, steps.baseY);
  fade.addColorStop(0, "rgba(0, 0, 0, 0)");
  fade.addColorStop(1, "rgba(0, 0, 0, 0.96)");
  c.fillStyle = fade;
  c.fillRect(level.riser.left - 2, fadeTop, rectWidth(level.riser) + 4, steps.baseY - fadeTop + 1);
  c.globalCompositeOperation = "source-over";

  // The lamp: an iron post on the landing with a shade, and the bulb under it (dark until the lamp lights).
  const { lamp } = steps;
  const post = Math.max(1.4, u * 0.13);
  c.fillStyle = INK.iron;
  c.fillRect(lamp.x - u * 0.45, lamp.footY - u * 0.16, u * 0.9, u * 0.16);
  c.strokeStyle = INK.iron;
  c.lineWidth = post;
  c.beginPath();
  c.moveTo(lamp.x, lamp.footY - u * 0.14);
  c.lineTo(lamp.x, lamp.headY + lamp.shadeHeight * 0.6);
  c.stroke();
  c.beginPath();
  c.moveTo(lamp.x - lamp.shadeWidth / 2, lamp.headY + lamp.shadeHeight);
  c.quadraticCurveTo(lamp.x, lamp.headY - lamp.shadeHeight * 0.7, lamp.x + lamp.shadeWidth / 2, lamp.headY + lamp.shadeHeight);
  c.closePath();
  c.fillStyle = INK.shade;
  c.fill();
  c.strokeStyle = INK.shadeRim;
  c.lineWidth = Math.max(1, u * 0.06);
  c.stroke();
  c.beginPath();
  c.arc(lamp.bulb.x, lamp.bulb.y, lamp.bulbRadius, 0, TAU);
  c.fillStyle = INK.bulbOff;
  c.fill();
  c.restore();
}

/** One earbud: a small oval with a nozzle at the front, lying along `bud.angle`. */
function drawBud(c: CanvasRenderingContext2D, bud: Bud, glow: number, alpha: number, lit: boolean): void {
  const { r } = bud;
  c.save();
  c.translate(bud.x, bud.y);
  c.rotate(bud.angle);
  c.globalAlpha = alpha;
  if (glow > 0) {
    const halo = c.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
    halo.addColorStop(0, `rgba(240, 185, 120, ${0.42 * glow})`);
    halo.addColorStop(1, "rgba(240, 185, 120, 0)");
    c.fillStyle = halo;
    c.beginPath();
    c.arc(0, 0, r * 2.4, 0, TAU);
    c.fill();
  }
  c.lineWidth = Math.max(1, r * 0.13);
  c.strokeStyle = lit ? INK.budLit : INK.budDim;
  c.fillStyle = INK.budBody;
  // The nozzle, then the body over its root.
  c.beginPath();
  if (typeof c.roundRect === "function") c.roundRect(r * 0.55, -r * 0.34, r * 0.85, r * 0.68, r * 0.25);
  else c.rect(r * 0.55, -r * 0.34, r * 0.85, r * 0.68);
  c.fill();
  c.stroke();
  c.beginPath();
  c.ellipse(0, 0, r, r * 0.78, 0, 0, TAU);
  c.fill();
  c.stroke();
  c.restore();
}

function strokePath(c: CanvasRenderingContext2D, points: ReadonlyArray<{ x: number; y: number }>): void {
  if (points.length < 2) return;
  c.beginPath();
  c.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index++) c.lineTo(points[index].x, points[index].y);
  c.stroke();
}

/** The wire, whole, as a stroke on a transparent canvas. */
function drawWirePath(c: CanvasRenderingContext2D, wire: WireGroup): void {
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = INK.wire;
  c.lineWidth = wire.lineWidth;
  strokePath(c, wire.path);
  c.restore();
}

/**
 * The empty earbud with the loose end of its own cable, as it looks fully faded
 * in. The cable is drawn at full strength and the bud a little under it, as it
 * always was; the layer's own opacity then brings both in together.
 */
function drawEmpty(c: CanvasRenderingContext2D, wire: WireGroup): void {
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  // Its own loose cable, ending in mid air, then the earbud: left as it is, with nothing to play it.
  c.strokeStyle = INK.budDim;
  c.lineWidth = wire.lineWidth;
  strokePath(c, wire.empty.stub);
  const end = wire.empty.stub[wire.empty.stub.length - 1];
  c.fillStyle = INK.wire;
  c.beginPath();
  c.arc(end.x, end.y, wire.lineWidth * 0.9, 0, TAU);
  c.fill();
  drawBud(c, wire.empty, 0, 0.85, false);
  c.restore();
}

/** The reduced-motion still: the finished wire, the earbud at its end glowing, and the empty earbud. */
function drawFinishedWire(c: CanvasRenderingContext2D, wire: WireGroup): void {
  drawWirePath(c, wire);
  drawBud(c, wire.bud, 1, 1, true);
  drawEmpty(c, wire);
}

/** What the static canvas holds: the steps and lamp, and in the reduced-motion still the finished wire too. */
function paintStatic(c: CanvasRenderingContext2D, layout: Layout, still: boolean): void {
  c.clearRect(0, 0, layout.width, layout.height);
  if (layout.mode === "bare") return;
  if (layout.steps) drawStepsAndLamp(c, layout.steps);
  if (still && layout.wire) drawFinishedWire(c, layout.wire);
}

// ---------------------------------------------------------------------------
// The picture's layers
// ---------------------------------------------------------------------------

/** walkman.svg's own coordinates (viewBox 96 by 72): the two reels, and the little lamp at the bottom right. */
const WALKMAN_REELS = [
  { name: "left", selector: ".reel-left", box: { x: 25, y: 20, size: 18 } },
  { name: "right", selector: ".reel-right", box: { x: 53, y: 20, size: 18 } },
] as const;
const WALKMAN_LED = { selector: 'circle[cx="77"]', x: 74, y: 47, size: 6 } as const;

/**
 * Moves the reels and the lamp out of the Walkman's drawing into elements laid
 * over it, at the same place and size, so that turning a reel or breathing the
 * lamp is a transform or an opacity on an HTML element, which the compositor
 * runs, instead of an animation inside the SVG that the main thread paints.
 */
function liftMovingParts(svg: Element, host: HTMLElement, viewBox: { width: number; height: number }): void {
  const place = (element: HTMLElement, x: number, y: number, size: number) => {
    element.style.left = `${(x / viewBox.width) * 100}%`;
    element.style.top = `${(y / viewBox.height) * 100}%`;
    element.style.width = `${(size / viewBox.width) * 100}%`;
    element.style.height = `${(size / viewBox.height) * 100}%`;
  };
  for (const reel of WALKMAN_REELS) {
    const group = svg.querySelector(reel.selector);
    if (!group) continue;
    const { x, y, size } = reel.box;
    const holder = document.createElement("span");
    holder.className = `tsuki-prologue__reel tsuki-prologue__reel--${reel.name}`;
    place(holder, x, y, size);
    const own = document.createElementNS(svg.namespaceURI, "svg");
    own.setAttribute("viewBox", `${x} ${y} ${size} ${size}`);
    own.setAttribute("aria-hidden", "true");
    own.setAttribute("focusable", "false");
    const moved = group.cloneNode(true) as Element;
    moved.removeAttribute("class");
    own.append(moved);
    holder.append(own);
    group.remove();
    host.append(holder);
  }
  const lamp = svg.querySelector(WALKMAN_LED.selector);
  if (lamp) {
    const fill = lamp.getAttribute("fill") ?? INK.budLit;
    const dot = document.createElement("span");
    dot.className = "tsuki-prologue__led";
    place(dot, WALKMAN_LED.x, WALKMAN_LED.y, WALKMAN_LED.size);
    dot.style.background = fill;
    lamp.remove();
    host.append(dot);
  }
}

/** Fetches walkman.svg once and inlines it, so its reels and lamp can be lifted out and move on their own. An <img> is the fallback. */
async function inlineWalkman(url: string, host: HTMLElement, signal: AbortSignal): Promise<void> {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`walkman.svg ${response.status}`);
    const parsed = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
    const svg = parsed.documentElement;
    if (signal.aborted) return;
    if (svg.nodeName.toLowerCase() !== "svg" || parsed.querySelector("parsererror")) throw new Error("walkman.svg is not an svg");
    svg.querySelector("title")?.remove();
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const imported = document.importNode(svg, true);
    host.append(imported);
    liftMovingParts(imported, host, WALKMAN_VIEWBOX);
  } catch (error) {
    if (signal.aborted) return;
    console.warn("[tsukinomi cutscene] the Walkman could not be inlined, using an image", error);
    const image = document.createElement("img");
    image.alt = "";
    image.src = url;
    host.append(image);
  }
}

interface Picture {
  readonly layout: () => Layout;
  /** Sets what the wire's layers must do after the layout changed. Called now and after every relayout. */
  onLayout(listener: (layout: Layout) => void): void;
  relayout(): void;
  /** Starts the frame callback given to mountPicture, once per animation frame, until the picture is disposed. */
  startFrames(): void;
  /** The pixel ratio the picture's canvases use. */
  readonly pixelRatio: () => number;
  dispose(): void;
}

/**
 * Builds the layers every mode shares (the steps, the glow, the Walkman, the cassette),
 * places them around the epigraph and keeps them placed when the stage or the text resizes.
 */
function mountPicture(ctx: TsukiSceneContext, still: boolean, onFrame: () => void = noop): Picture {
  const { stage, textEl, dialog, controls, signal } = ctx;
  stage.classList.add("tsuki-prologue");
  if (still) stage.classList.add("is-still");

  const walkman = document.createElement("div");
  walkman.className = "tsuki-prologue__walkman";
  const glow = document.createElement("div");
  glow.className = "tsuki-prologue__glow";
  let cassette: HTMLImageElement | null = null;
  const cassetteUrl = ctx.assets.icons["cassette-mark"];
  if (cassetteUrl) {
    cassette = document.createElement("img");
    cassette.className = "tsuki-prologue__cassette";
    cassette.alt = "";
    cassette.decoding = "async";
    cassette.draggable = false;
    cassette.src = cassetteUrl;
  }

  let layout: Layout = emptyLayout(0, 0);
  let staticContext: CanvasRenderingContext2D | null = null;
  let lastControls: Rect | null = null;
  let listener: ((layout: Layout) => void) | null = null;
  let disposed = false;

  const px = (value: number) => `${Math.round(value * 100) / 100}px`;

  const place = (next: Layout) => {
    stage.classList.toggle("is-bare", next.mode === "bare");
    walkman.style.display = next.wire ? "" : "none";
    if (next.wire) {
      const box = next.wire.walkman;
      Object.assign(walkman.style, { left: px(box.left), top: px(box.top), width: px(rectWidth(box)), height: px(rectHeight(box)) });
    }
    glow.style.display = next.steps ? "" : "none";
    if (cassette) cassette.style.display = next.steps ? "" : "none";
    const steps = next.steps;
    if (!steps) return;
    const zone = steps.zone;
    Object.assign(glow.style, { left: px(zone.left), top: px(zone.top), width: px(rectWidth(zone)), height: px(rectHeight(zone)) });
    // The gradients are positioned inside the glow's own box, which is the steps' zone.
    const set = (name: string, value: number) => glow.style.setProperty(name, px(value));
    set("--bulb-x", steps.lamp.bulb.x - zone.left);
    set("--bulb-y", steps.lamp.bulb.y - zone.top);
    set("--bulb-r", Math.max(2, steps.lamp.bulbRadius * 2.6));
    set("--halo-x", steps.halo.cx - zone.left);
    set("--halo-y", steps.halo.cy - zone.top);
    set("--halo-rx", Math.max(2, steps.halo.rx));
    set("--halo-ry", Math.max(2, steps.halo.ry));
    set("--pool-x", steps.pool.cx - zone.left);
    set("--pool-y", steps.pool.cy - zone.top);
    set("--pool-rx", Math.max(2, steps.pool.rx));
    set("--pool-ry", Math.max(2, steps.pool.ry));
    if (cassette) {
      const box = steps.cassette;
      Object.assign(cassette.style, {
        left: px(box.left),
        top: px(box.top),
        width: px(rectWidth(box)),
        height: px(rectHeight(box)),
        transform: `rotate(${box.angle}rad)`,
        transformOrigin: "50% 100%",
      });
    }
  };

  const relayout = () => {
    if (disposed) return;
    const origin = stage.getBoundingClientRect();
    const visible = (box: DOMRect) => box.width > 0 && box.height > 0;
    const relative = (box: DOMRect): Rect => ({
      left: box.left - origin.left,
      top: box.top - origin.top,
      right: box.right - origin.left,
      bottom: box.bottom - origin.top,
    });

    // The epigraph, and in the still the continue button under it: the picture keeps clear of both.
    let keepOut: Rect | null = null;
    const textBox = textEl.getBoundingClientRect();
    if (visible(textBox)) {
      keepOut = relative(textBox);
      const start = dialog.querySelector<HTMLElement>("[data-cutscene-start]");
      const startBox = start && !start.hidden ? start.getBoundingClientRect() : null;
      if (startBox && visible(startBox)) {
        const extra = relative(startBox);
        keepOut = { left: Math.min(keepOut.left, extra.left), top: Math.min(keepOut.top, extra.top), right: Math.max(keepOut.right, extra.right), bottom: Math.max(keepOut.bottom, extra.bottom) };
      }
    }
    // Skip and the controls. The controls slot is remembered once measured: it is empty (and
    // collapsed) after Play goes, and the picture should not move when that happens.
    const buttons: Rect[] = [];
    const skip = dialog.querySelector<HTMLElement>("[data-cutscene-skip]")?.getBoundingClientRect();
    if (skip && visible(skip)) buttons.push(relative(skip));
    if (controls.childElementCount > 0) {
      const box = controls.getBoundingClientRect();
      if (visible(box)) lastControls = relative(box);
    }
    if (lastControls) buttons.push(lastControls);

    layout = computeLayout({
      width: origin.width,
      height: origin.height,
      keepOut,
      buttons,
      scrolls: dialog.scrollHeight - dialog.clientHeight > SCROLL_TOLERANCE_PX,
    });
    place(layout);
    if (staticContext) paintStatic(staticContext, layout, still);
    listener?.(layout);
  };

  // Back to front: the steps, the light on them, the Walkman, the cassette. The wire's layers are added by play().
  // The loop draws nothing: its canvas is painted when it is resized, and its frames only run onFrame.
  let pixelRatio = 1;
  const staticLoop: TsukiCanvasLoop = ctx.createCanvasLoop({
    className: "tsuki-prologue__canvas",
    render: () => onFrame(),
    resize: (size, context) => {
      staticContext = context;
      pixelRatio = size.dpr;
      relayout();
    },
  });
  stage.append(glow, walkman);
  if (cassette) stage.append(cassette);

  const walkmanUrl = ctx.assets.icons.walkman;
  if (walkmanUrl) void inlineWalkman(walkmanUrl, walkman, signal);

  relayout();
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(relayout) : null;
  observer?.observe(stage);
  observer?.observe(textEl);

  return {
    layout: () => layout,
    onLayout(next) {
      listener = next;
      next(layout);
    },
    relayout,
    startFrames: () => staticLoop.start(),
    pixelRatio: () => pixelRatio,
    dispose() {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      staticLoop.destroy();
      walkman.remove();
      glow.remove();
      cassette?.remove();
      stage.classList.remove("tsuki-prologue", "is-still", "is-ready", "is-playing", "is-lit", "is-bare", "is-held");
    },
  };
}

// ---------------------------------------------------------------------------
// The wire's layers
// ---------------------------------------------------------------------------

interface WireLayer {
  /** Starts the motion, `elapsedMs` into the scene: 0 when it begins, later when the picture is laid out again mid-scene. */
  run(elapsedMs: number): void;
  /** Called every frame with the scene's elapsed time: starts the animations that wait for a moment of their own. */
  tick(elapsedMs: number): void;
  /** The tab is hidden: stop the animations where they are. */
  hold(): void;
  release(): void;
  dispose(): void;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function positioned<T extends HTMLElement>(element: T, box: Rect): T {
  Object.assign(element.style, {
    left: `${round2(box.left)}px`,
    top: `${round2(box.top)}px`,
    width: `${round2(rectWidth(box))}px`,
    height: `${round2(rectHeight(box))}px`,
  });
  return element;
}

function layerCanvas(box: Rect, ratio: number, paint: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rectWidth(box) * ratio));
  canvas.height = Math.max(1, Math.round(rectHeight(box) * ratio));
  canvas.setAttribute("aria-hidden", "true");
  const c = canvas.getContext("2d");
  if (c) {
    c.setTransform(ratio, 0, 0, ratio, -box.left * ratio, -box.top * ratio);
    paint(c);
  }
  return canvas;
}

/**
 * The wire drawn whole, once, with the layers that move it on: see the header.
 * Everything is placed in stage coordinates from `wire`; the animations are
 * created paused-free at run() and the two that wait (the glow, the empty
 * earbud) are created paused and started by tick(), so that at any moment only
 * the animations that are really moving exist as running ones.
 */
function mountWire(stage: HTMLElement, wire: WireGroup, timeline: Timeline, ratio: number): WireLayer {
  const r = wire.bud.r;
  const pathBox = boundsOf(wire.path, wire.lineWidth + 2);
  const reach = r * 2.4;
  const emptyBox = inflate(boundsOf([...wire.empty.stub, { x: wire.empty.x - reach, y: wire.empty.y - reach }, { x: wire.empty.x + reach, y: wire.empty.y + reach }]), wire.lineWidth + 2);

  // The wire itself and its cover. The cover is black, as the stage is, so while it is over the wire the screen looks empty.
  const root = positioned(document.createElement("div"), pathBox);
  root.className = "tsuki-prologue__wire";
  const wireCanvas = layerCanvas(pathBox, ratio, (c) => drawWirePath(c, wire));
  wireCanvas.className = "tsuki-prologue__wire-line";
  const cover = document.createElement("div");
  cover.className = "tsuki-prologue__cover";
  const steps = wireSteps(wire);
  const coverX = (step: { x: number }) => round2(step.x - r * COVER_UNDER_BUD - pathBox.left);
  cover.style.transform = `translateX(${coverX(steps[0])}px)`;
  root.append(wireCanvas, cover);

  // The empty earbud and its loose cable.
  const empty = positioned(document.createElement("div"), emptyBox);
  empty.className = "tsuki-prologue__empty";
  empty.style.opacity = "0";
  empty.append(layerCanvas(emptyBox, ratio, (c) => drawEmpty(c, wire)));

  // The plugged earbud: a halo behind a sprite, both centred on the wrapper's origin, which the transform carries along the wire.
  const bud = document.createElement("div");
  bud.className = "tsuki-prologue__bud";
  bud.style.opacity = "0";
  const spriteBox: Rect = { left: -reach, top: -reach, right: reach, bottom: reach };
  const halo = positioned(document.createElement("div"), spriteBox);
  halo.className = "tsuki-prologue__halo";
  halo.style.opacity = String(steps[0].glow);
  // An image, not the canvas it was painted on: a canvas that is carried by an animation is handed to the compositor again every frame.
  const sprite = document.createElement("img");
  sprite.alt = "";
  sprite.draggable = false;
  sprite.src = layerCanvas(spriteBox, ratio, (c) => drawBud(c, { x: 0, y: 0, angle: 0, r }, 0, 1, true)).toDataURL("image/png");
  positioned(sprite, spriteBox);
  sprite.className = "tsuki-prologue__bud-sprite";
  bud.append(halo, sprite);

  stage.append(root, empty, bud);

  const wireMs = (timeline.wireEnd - timeline.wireStart) * 1000;
  const wireAt = timeline.wireStart * 1000;
  const haloAt = wireAt + glowStartOffset() * wireMs;
  const haloMs = wireAt + wireMs - haloAt;
  const emptyAt = timeline.emptyStart * 1000;
  const emptyMs = (timeline.emptyEnd - timeline.emptyStart) * 1000;

  let running = false;
  let held = false;
  let disposed = false;
  const live: Animation[] = [];
  let haloAnimation: Animation | null = null;
  let emptyAnimation: Animation | null = null;
  let haloStarted = false;
  let emptyStarted = false;

  /** When an animation has finished, its last frame becomes the element's own style and the animation goes. */
  const settle = (animation: Animation, element: HTMLElement, hide = false) => {
    animation.finished.then(
      () => {
        if (disposed) return;
        if (hide) element.style.display = "none";
        else {
          try {
            animation.commitStyles();
          } catch {
            // an element that is not rendered cannot commit; the animation's fill still holds the frame
            return;
          }
        }
        animation.cancel();
        const at = live.indexOf(animation);
        if (at >= 0) live.splice(at, 1);
      },
      () => {},
    );
  };

  const animate = (element: HTMLElement, frames: Keyframe[], duration: number, delay: number, start: number | null) => {
    const animation = element.animate(frames, { duration, delay, fill: "both", easing: "linear" });
    if (start === null) animation.pause();
    else animation.currentTime = start;
    if (held) animation.pause();
    return animation;
  };

  return {
    run(elapsedMs) {
      if (running || disposed) return;
      running = true;
      const coverAnimation = animate(cover, steps.map((step) => ({ offset: step.offset, transform: `translateX(${coverX(step)}px)` })), wireMs, wireAt, elapsedMs);
      const budAnimation = animate(
        bud,
        steps.map((step) => ({ offset: step.offset, transform: `translate(${round2(step.x)}px, ${round2(step.y)}px) rotate(${step.angle.toFixed(4)}rad)`, opacity: step.alpha })),
        wireMs,
        wireAt,
        elapsedMs,
      );
      settle(coverAnimation, cover, true);
      settle(budAnimation, bud);
      live.push(coverAnimation, budAnimation);
      haloAnimation = animate(halo, glowSteps().map((step) => ({ offset: step.offset, opacity: step.glow })), haloMs, 0, null);
      emptyAnimation = animate(empty, emptyFadeSteps().map((step) => ({ offset: step.offset, opacity: step.opacity })), emptyMs, 0, null);
      settle(haloAnimation, halo);
      settle(emptyAnimation, empty);
    },
    tick(elapsedMs) {
      if (!running || held || disposed) return;
      if (!haloStarted && haloAnimation && elapsedMs >= haloAt) {
        haloStarted = true;
        haloAnimation.currentTime = elapsedMs - haloAt;
        haloAnimation.play();
        live.push(haloAnimation);
      }
      if (!emptyStarted && emptyAnimation && elapsedMs >= emptyAt) {
        emptyStarted = true;
        emptyAnimation.currentTime = elapsedMs - emptyAt;
        emptyAnimation.play();
        live.push(emptyAnimation);
      }
    },
    hold() {
      held = true;
      for (const animation of live) animation.pause();
    },
    release() {
      held = false;
      for (const animation of live) animation.play();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const animation of [...live, haloAnimation, emptyAnimation]) animation?.cancel();
      live.length = 0;
      root.remove();
      empty.remove();
      bud.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// The subtitles' covers
// ---------------------------------------------------------------------------

interface SubtitleLayer {
  tick(elapsedMs: number): void;
  hold(): void;
  release(): void;
  dispose(): void;
}

/** Each cluster's box, in the origin's coordinates, read from the paragraph's single text node; null when it is not one. */
function measureClusters(textEl: HTMLElement, clusters: readonly string[], origin: DOMRect): ClusterBox[] | null {
  const node = textEl.firstChild;
  if (textEl.childNodes.length !== 1 || !(node instanceof Text) || node.data !== clusters.join("")) return null;
  const range = document.createRange();
  const boxes: ClusterBox[] = [];
  let offset = 0;
  for (const cluster of clusters) {
    range.setStart(node, offset);
    range.setEnd(node, offset + cluster.length);
    const box = range.getBoundingClientRect();
    boxes.push({ left: box.left - origin.left, top: box.top - origin.top, right: box.right - origin.left, bottom: box.bottom - origin.top });
    offset += cluster.length;
  }
  return boxes;
}

/**
 * Room round a line's box that its cover also hides, in ems: a tone mark on a tall letter can rise above
 * the line's own box, and the glow round the text spills out of it. The line spacing leaves more than this
 * empty above and below every line, so the neighbouring line's letters stay clear of it.
 */
const COVER_PAD_EM = 0.3;

/**
 * Lays a cover over each line of the epigraph and lets each slide off in its
 * time (see "The subtitles' covers" in prologue-core.ts). The animation of a
 * line is made paused and started by tick() when its moment comes, and the
 * line's elements are removed when it is done, so that only the lines that are
 * being revealed are animating. `elapsedMs` is where the scene is now, so that a
 * layer built in the middle of the scene (the text re-wrapped) starts in step.
 * Null when the text cannot be measured; the caller then shows it plainly.
 */
function mountSubtitles(card: HTMLElement, textEl: HTMLElement, clusters: readonly string[], schedule: SubtitleSchedule, timeline: Timeline, elapsedMs: number, held: boolean): SubtitleLayer | null {
  const origin = card.getBoundingClientRect();
  const boxes = measureClusters(textEl, clusters, origin);
  if (!boxes) return null;
  const lines = groupLines(boxes, Number.parseFloat(getComputedStyle(textEl).lineHeight) || 0);
  if (lines.length === 0) return null;
  const feather = featherFor(lines, schedule.delaysMs, schedule.fadeMs);
  const pad = (Number.parseFloat(getComputedStyle(textEl).fontSize) || 16) * COVER_PAD_EM;

  interface Cover {
    wrapper: HTMLElement;
    animation: Animation;
    startAt: number;
    endAt: number;
    started: boolean;
  }
  const covers: Cover[] = [];
  let disposed = false;
  let isHeld = held;

  for (const line of lines) {
    const sweep = lineSweep(line, boxes, schedule.delaysMs, schedule.fadeMs, feather);
    const startAt = timeline.subtitlesStart * 1000 + sweep.startMs;
    const endAt = startAt + sweep.durationMs;
    if (endAt <= elapsedMs) continue;
    const box: Rect = { left: line.left - pad, top: line.top - pad, right: line.right + pad, bottom: line.bottom + pad };
    const wrapper = positioned(document.createElement("div"), box);
    wrapper.className = "tsuki-prologue__line";
    wrapper.setAttribute("aria-hidden", "true");
    const cover = document.createElement("div");
    cover.className = "tsuki-prologue__sweep";
    const first = sweep.frames[0].x;
    cover.style.width = `${round2(box.right - first + 2)}px`;
    cover.style.setProperty("--tsuki-feather", `${round2(feather)}px`);
    const at = (x: number) => `translateX(${round2(x - box.left)}px)`;
    cover.style.transform = at(first);
    wrapper.append(cover);
    card.append(wrapper);
    const animation = cover.animate(
      sweep.frames.map((frame) => ({ offset: Math.min(1, frame.ms / sweep.durationMs), transform: at(frame.x) })),
      { duration: sweep.durationMs, fill: "both", easing: "linear" },
    );
    animation.pause();
    covers.push({ wrapper, animation, startAt, endAt, started: false });
  }

  return {
    tick(now) {
      if (disposed || isHeld) return;
      for (const cover of covers) {
        if (!cover.started && now >= cover.startAt) {
          cover.started = true;
          cover.animation.currentTime = now - cover.startAt;
          cover.animation.play();
        }
        if (cover.started && now >= cover.endAt && cover.wrapper.isConnected) {
          cover.animation.cancel();
          cover.wrapper.remove();
        }
      }
    },
    hold() {
      isHeld = true;
      for (const cover of covers) if (cover.started && cover.wrapper.isConnected) cover.animation.pause();
    },
    release() {
      isHeld = false;
      for (const cover of covers) if (cover.started && cover.wrapper.isConnected) cover.animation.play();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const cover of covers) {
        cover.animation.cancel();
        cover.wrapper.remove();
      }
      covers.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------

export function play(ctx: TsukiSceneContext): TsukiSceneHandle {
  injectSceneStyles(prologueCss, ctx.signal);
  const { stage, textEl, controls, audio, signal } = ctx;

  let resolveDone: () => void = noop;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  let finished = false;
  let disposed = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    resolveDone();
  };

  const clusters = splitGraphemes(textEl.textContent ?? "");
  const schedule = subtitleSchedule(clusters);
  const timeline = buildTimeline(schedule, lampClusterFor(clusters));
  const card = textEl.parentElement ?? stage;
  // Hidden until its covers are in place, so a frame that paints before they are does not show the text early.
  textEl.classList.add(SUBTITLE_TEXT_CLASS, "is-waiting");

  // --- the clock and the beats: the scene's only frame callback draws nothing ---
  const clock = createSceneClock();
  let lit = false;
  let wireLayer: WireLayer | null = null;
  let subtitleLayer: SubtitleLayer | null = null;
  const onFrame = () => {
    if (!clock.started || finished || disposed) return;
    const elapsed = clock.elapsedMs();
    const t = elapsed / 1000;
    if (!lit && t >= timeline.lampStart) {
      lit = true;
      stage.classList.add("is-lit");
    }
    if (t >= timeline.end) {
      finish();
      return;
    }
    wireLayer?.tick(elapsed);
    subtitleLayer?.tick(elapsed);
  };
  const picture = mountPicture(ctx, false, onFrame);
  picture.onLayout((layout) => {
    wireLayer?.dispose();
    wireLayer = layout.wire ? mountWire(stage, layout.wire, timeline, picture.pixelRatio()) : null;
    if (clock.started) {
      wireLayer?.run(clock.elapsedMs());
      if (clock.held) wireLayer?.hold();
    }
  });

  // The covers follow the text: laid out again whenever it re-wraps (a resize, a font that arrives late).
  let textBox = "";
  const placeSubtitles = () => {
    if (disposed) return;
    const box = textEl.getBoundingClientRect();
    const signature = `${Math.round(box.width)}x${Math.round(box.height)}@${Math.round(box.left)},${Math.round(box.top)}`;
    if (signature === textBox && subtitleLayer) return;
    textBox = signature;
    subtitleLayer?.dispose();
    subtitleLayer = mountSubtitles(card, textEl, clusters, schedule, timeline, clock.elapsedMs(), clock.held);
    // Without covers (the text could not be measured) the text is simply there.
    textEl.classList.remove("is-waiting");
  };
  placeSubtitles();
  const textObserver = typeof ResizeObserver === "function" ? new ResizeObserver(placeSubtitles) : null;
  textObserver?.observe(textEl);
  void document.fonts?.ready.then(placeSubtitles);
  document.fonts?.addEventListener("loadingdone", placeSubtitles, { signal });

  // --- the Play button ---
  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.className = "tsuki-cutscene__control tsuki-prologue__play";
  playButton.textContent = PLAY_LABEL;
  controls.append(playButton);
  picture.relayout();

  let hovering = false;
  let focused = false;
  let pressed = false;
  let countdown: AutoStart | null = null;

  const begin = (pressedPlay: boolean) => {
    if (clock.started || finished || disposed) return;
    countdown?.cancel();
    const plan = startPlan(pressedPlay, audio.available());
    let gesture: Promise<boolean> | null = null;
    if (plan.requestGesture) {
      try {
        // First, inside the click: this is the gesture the browser needs. A failure leaves the scene silent.
        gesture = Promise.resolve(audio.requestPlayFromGesture("discovery"));
      } catch {
        // silent
      }
    }
    startSound(plan.ownClick);
    // The real Walkman switches on synchronously, so everything above already sounded. Should an
    // implementation switch on later, the cue and the hiss are asked for again when it reports back.
    const soundedAtOnce = audio.available();
    gesture
      ?.then((ok) => {
        if (ok && !soundedAtOnce && !signal.aborted) startSound(false);
      })
      .catch(noop);

    // The Play button has done its job. If it holds focus, hand that to Skip before it goes.
    if (document.activeElement === playButton) dialogSkip()?.focus({ preventScroll: true });
    playButton.remove();
    picture.relayout();

    stage.classList.add("is-playing");
    clock.start();
    wireLayer?.run(0);
    picture.startFrames();
  };

  const startSound = (click: boolean) => {
    if (click) audio.sfx("tape-click");
    audio.layerSoundscape("cassette-hiss");
    audio.setCue("discovery");
  };
  const dialogSkip = () => ctx.dialog.querySelector<HTMLElement>("[data-cutscene-skip]");

  // The countdown holds while the reader is on the Play button (hovering, focused or pressing it),
  // so the scene does not start under their finger, and restarts when they leave it.
  const engage = () => countdown?.setEngaged(hovering || focused || pressed);
  playButton.addEventListener("click", () => begin(true), { signal });
  playButton.addEventListener("pointerenter", () => ((hovering = true), engage()), { signal });
  playButton.addEventListener("pointerleave", () => ((hovering = false), engage()), { signal });
  playButton.addEventListener("pointerdown", () => ((pressed = true), engage()), { signal });
  for (const end of ["pointerup", "pointercancel"]) playButton.addEventListener(end, () => ((pressed = false), engage()), { signal });
  playButton.addEventListener("focus", () => ((focused = true), engage()), { signal });
  playButton.addEventListener("blur", () => ((focused = false), engage()), { signal });
  countdown = createAutoStart(() => begin(false));

  // --- the rest of the lifecycle ---
  // While the tab is hidden the clock stops, and the animations with it: the page's own clock keeps
  // running behind a hidden tab, so left alone they would be ahead of the scene when it comes back.
  const onVisibility = () => {
    stage.classList.toggle("is-held", document.hidden);
    if (document.hidden) {
      clock.hold();
      wireLayer?.hold();
      subtitleLayer?.hold();
    } else {
      clock.release();
      wireLayer?.release();
      subtitleLayer?.release();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  onVisibility();
  // The runner plays this scene only while motion is allowed; if the reader turns it off now, end gracefully.
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onReduce = () => {
    if (reduceQuery.matches) finish();
  };
  reduceQuery.addEventListener("change", onReduce);

  stage.classList.add("is-ready");

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    countdown?.cancel();
    document.removeEventListener("visibilitychange", onVisibility);
    reduceQuery.removeEventListener("change", onReduce);
    wireLayer?.dispose();
    wireLayer = null;
    textObserver?.disconnect();
    subtitleLayer?.dispose();
    subtitleLayer = null;
    textEl.classList.remove(SUBTITLE_TEXT_CLASS, "is-waiting");
    playButton.remove();
    picture.dispose();
    signal.removeEventListener("abort", dispose);
  };
  signal.addEventListener("abort", dispose, { once: true });

  return { done, dispose };
}

/** The reduced-motion composition: the finished picture (wire out, lamp lit) behind the whole epigraph, nothing moving. */
export function still(ctx: TsukiSceneContext): void {
  injectSceneStyles(prologueCss, ctx.signal);
  const picture = mountPicture(ctx, true);
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    picture.dispose();
    ctx.signal.removeEventListener("abort", cleanup);
  };
  ctx.signal.addEventListener("abort", cleanup, { once: true });
  if (ctx.signal.aborted) cleanup();
}
