// The prologue cutscene (design 4.3, row 1): a Walkman in the dark.
//
// A dark room, a pool of warm light on an old table, and a Walkman lying in
// it. The reader presses Play, which is the gesture that lets the Walkman make
// sound: the reels start to turn and its little lamp comes on. The earphone
// wire is pulled out across the table and splits; one branch rises out of the
// picture, to someone listening, the other lies on the table and ends in the
// second earbud, which nobody is wearing (the story's one earphone shared
// between two people). The epigraph comes up as slow subtitles. Then the room
// gives way to stone steps at night, where a station lamp stutters and lights.
// If nobody presses Play it starts by itself after 6 seconds, silent (unless
// the Walkman is already on), because a scene that waits for a click would
// hold a reader who never makes one.
//
// Drawn on one canvas on the shared kit (kit.ts): the room, the Walkman's body,
// the night steps are painted once per size; each frame turns the reels,
// draws the wire as far as it has been pulled, the dust in the light and the
// lamp. The rules (start, audio plan, timeline, wire path, the lamp's first
// light) are in p01-core.ts.
//
// Audio. Pressing Play is the only gesture: requestPlayFromGesture() runs first
// in the click handler. The Walkman plays its own tape-click when it switches
// on, so the scene adds one only if the Walkman was on already. The automatic
// start asks for no gesture, so it makes sound only when the Walkman is on.
//
// Reduced motion: still() is the room with the tape in, the wire drawn and
// the empty earbud on the table, behind the whole epigraph; no Play button.
import { createNoise2D, createRng, fbm2D, type SceneSize } from "../../../_shared/scene-runtime";
import type { TsukiSceneContext, TsukiSceneHandle } from "../scene-types";
import { injectSceneStyles } from "../styles";
import { drawPetal, drawTextScrim, makeLayer, petalSprites, radialSprite, runCanvasScene, splitGlyphs, stillCanvas, textBox, type Box, type Ctx } from "./kit";
import {
  PROLOGUE,
  PROLOGUE_MAX_END_S,
  clamp,
  createAutoStart,
  lampLevel,
  pathUpTo,
  phase,
  prologueEnd,
  smooth,
  startPlan,
  wireFor,
  wireProgress,
  type AutoStart,
  type Point,
  type Wire,
} from "./p01-core";
import css from "./prologue.css?inline";

const SEED = 0x7030;
const PLAY_LABEL = "เล่นเทป";
const WARM = "255, 206, 150";
const noop = () => {};

interface Layout {
  w: number;
  h: number;
  unit: number;
  /** The table's far edge. */
  rest: number;
  walkman: { x: number; y: number; w: number; h: number };
  jack: Point;
  /** The two reels' centres and radius. */
  reels: [Point, Point];
  reelR: number;
  led: Point;
  wire: Wire;
  /** The pool of lamplight on the table. */
  pool: Point & { r: number };
}

function layoutOf(w: number, h: number): Layout {
  const unit = Math.min(w, h);
  const portrait = h > w;
  const rest = h * (portrait ? 0.68 : 0.64);
  const ww = clamp(unit * (portrait ? 0.46 : 0.34), 140, 310);
  const wh = ww * 0.66;
  // Low on the table and clear of the controls' row along the bottom.
  const cy = Math.min(rest + (h - rest) * 0.46, h - 84 - wh / 2);
  const cx = w * (portrait ? 0.34 : 0.27);
  const walkman = { x: cx - ww / 2, y: cy - wh / 2, w: ww, h: wh };
  const jack = { x: walkman.x + ww * 0.97, y: walkman.y + wh * 0.2 };
  const reelY = walkman.y + wh * 0.47;
  const reels: [Point, Point] = [
    { x: walkman.x + ww * 0.34, y: reelY },
    { x: walkman.x + ww * 0.66, y: reelY },
  ];
  return {
    w,
    h,
    unit,
    rest,
    walkman,
    jack,
    reels,
    reelR: wh * 0.13,
    led: { x: walkman.x + ww * 0.88, y: walkman.y + wh * 0.82 },
    wire: wireFor(jack, w, h, rest),
    pool: { x: cx + ww * 0.35, y: cy, r: unit * 0.55 },
  };
}

/** The dark room: a wall in shadow, an old wooden table, the pool of warm light on it. */
function paintRoom(c: Ctx, l: Layout): void {
  const { w, h, rest } = l;
  const wall = c.createLinearGradient(0, 0, 0, rest);
  wall.addColorStop(0, "#040307");
  wall.addColorStop(1, "#0d0a10");
  c.fillStyle = wall;
  c.fillRect(0, 0, w, rest + 1);
  // Table: dark wood with its grain, its far edge catching the light.
  const table = c.createLinearGradient(0, rest, 0, h);
  table.addColorStop(0, "#1c130d");
  table.addColorStop(1, "#090605");
  c.fillStyle = table;
  c.fillRect(0, rest, w, h - rest);
  const noise = createNoise2D(SEED);
  const rng = createRng(SEED + 1);
  for (let y = rest + 2; y < h; y += 2 + rng() * 3) {
    c.strokeStyle = `rgba(${rng() < 0.5 ? "70, 46, 30" : "10, 6, 4"}, ${(0.12 + rng() * 0.18).toFixed(3)})`;
    c.lineWidth = 0.6 + rng();
    c.beginPath();
    for (let x = 0; x <= w; x += 12) {
      const yy = y + fbm2D(noise, x / 260, y / 40, 3) * 4;
      if (x === 0) c.moveTo(x, yy);
      else c.lineTo(x, yy);
    }
    c.stroke();
  }
  c.fillStyle = "rgba(255, 210, 160, 0.12)";
  c.fillRect(0, rest, w, 1);
  // The lamplight, from somewhere above and to the left, pooling on the table.
  c.save();
  c.translate(l.pool.x, l.pool.y);
  c.scale(1, 0.45);
  const pool = c.createRadialGradient(0, 0, 0, 0, 0, l.pool.r);
  pool.addColorStop(0, `rgba(${WARM}, 0.3)`);
  pool.addColorStop(0.45, `rgba(${WARM}, 0.1)`);
  pool.addColorStop(1, `rgba(${WARM}, 0)`);
  c.fillStyle = pool;
  c.fillRect(-l.pool.r, -l.pool.r, l.pool.r * 2, l.pool.r * 2);
  c.restore();
  const shaft = c.createLinearGradient(0, 0, l.pool.x, l.pool.y);
  shaft.addColorStop(0, `rgba(${WARM}, 0)`);
  shaft.addColorStop(1, `rgba(${WARM}, 0.05)`);
  c.fillStyle = shaft;
  c.beginPath();
  c.moveTo(-w * 0.1, -h * 0.05);
  c.lineTo(w * 0.25, -h * 0.05);
  c.lineTo(l.pool.x + l.pool.r * 0.6, l.pool.y);
  c.lineTo(l.pool.x - l.pool.r * 0.5, l.pool.y);
  c.closePath();
  c.fill();
}

/** The Walkman: brushed metal, the cassette behind its window (reels left out, they turn), keys, jack. */
function paintWalkman(c: Ctx, l: Layout): void {
  const { x, y, w, h } = l.walkman;
  const r = h * 0.09;
  // Its shadow on the table.
  c.save();
  c.filter = `blur(${(h * 0.06).toFixed(1)}px)`;
  c.fillStyle = "rgba(0, 0, 0, 0.7)";
  c.beginPath();
  c.ellipse(x + w * 0.52, y + h * 1.0, w * 0.52, h * 0.1, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
  // The keys along the top edge.
  const keys = ["#3a3942", "#2e2d35", "#3a3942", "#2e2d35"];
  keys.forEach((colour, i) => {
    c.fillStyle = colour;
    c.beginPath();
    c.roundRect(x + w * (0.12 + i * 0.12), y - h * 0.06, w * 0.1, h * 0.09, 2);
    c.fill();
  });
  c.fillStyle = "rgba(224, 138, 76, 0.85)";
  c.beginPath();
  c.moveTo(x + w * 0.155, y - h * 0.045);
  c.lineTo(x + w * 0.185, y - h * 0.02);
  c.lineTo(x + w * 0.155, y + h * 0.005);
  c.closePath();
  c.fill();
  // Body.
  const body = c.createLinearGradient(x, y, x, y + h);
  body.addColorStop(0, "#4a4954");
  body.addColorStop(0.12, "#2f2e37");
  body.addColorStop(0.85, "#24232b");
  body.addColorStop(1, "#18171d");
  c.fillStyle = body;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
  // Brushed metal, faint lines across.
  c.save();
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.clip();
  const rng = createRng(SEED + 2);
  for (let yy = y; yy < y + h; yy += 1.5) {
    c.fillStyle = `rgba(255, 255, 255, ${(rng() * 0.025).toFixed(3)})`;
    c.fillRect(x, yy, w, 0.7);
  }
  // Light from the lamp side on the left edge.
  const edge = c.createLinearGradient(x, 0, x + w * 0.4, 0);
  edge.addColorStop(0, `rgba(${WARM}, 0.18)`);
  edge.addColorStop(1, `rgba(${WARM}, 0)`);
  c.fillStyle = edge;
  c.fillRect(x, y, w, h);
  c.restore();
  c.strokeStyle = "rgba(255, 235, 210, 0.25)";
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
  c.stroke();
  // The cassette window.
  const win = { x: x + w * 0.1, y: y + h * 0.16, w: w * 0.8, h: h * 0.58 };
  c.fillStyle = "#0a0a0e";
  c.beginPath();
  c.roundRect(win.x, win.y, win.w, win.h, h * 0.04);
  c.fill();
  // The cassette inside: its label and the tape between the reels.
  c.fillStyle = "#d8cfb6";
  c.fillRect(win.x + win.w * 0.06, win.y + win.h * 0.06, win.w * 0.88, win.h * 0.2);
  c.fillStyle = "rgba(60, 50, 40, 0.55)";
  c.fillRect(win.x + win.w * 0.1, win.y + win.h * 0.12, win.w * 0.5, 1.2);
  c.fillRect(win.x + win.w * 0.1, win.y + win.h * 0.18, win.w * 0.32, 1.2);
  c.fillStyle = "#c97a4a";
  c.fillRect(win.x + win.w * 0.72, win.y + win.h * 0.1, win.w * 0.16, win.h * 0.1);
  c.fillStyle = "#2d1b12";
  c.beginPath();
  c.roundRect(l.reels[0].x - l.reelR * 1.5, l.reels[0].y - l.reelR * 1.5, l.reels[1].x - l.reels[0].x + l.reelR * 3, l.reelR * 3, l.reelR * 1.5);
  c.fill();
  // Glass over it all.
  const glass = c.createLinearGradient(win.x, win.y, win.x + win.w, win.y + win.h);
  glass.addColorStop(0, "rgba(255, 255, 255, 0)");
  glass.addColorStop(0.42, "rgba(255, 255, 255, 0.07)");
  glass.addColorStop(0.5, "rgba(255, 255, 255, 0.01)");
  glass.addColorStop(1, "rgba(255, 255, 255, 0)");
  c.fillStyle = glass;
  c.beginPath();
  c.roundRect(win.x, win.y, win.w, win.h, h * 0.04);
  c.fill();
  // Its name, engraved.
  c.fillStyle = "rgba(220, 210, 195, 0.4)";
  c.font = `600 ${(h * 0.075).toFixed(1)}px "JetBrains Mono", ui-monospace, monospace`;
  c.textBaseline = "middle";
  c.fillText("WALKMAN", x + w * 0.1, y + h * 0.84);
  // The jack on the right edge.
  c.fillStyle = "#0b0b0e";
  c.beginPath();
  c.arc(l.jack.x - w * 0.01, l.jack.y, h * 0.035, 0, Math.PI * 2);
  c.fill();
}

/** A reel: a pale hub with six teeth, turned by `angle`. */
function drawReel(c: Ctx, at: Point, r: number, angle: number): void {
  c.save();
  c.translate(at.x, at.y);
  c.rotate(angle);
  c.fillStyle = "#e9e3d6";
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#1a1418";
  c.beginPath();
  c.arc(0, 0, r * 0.45, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#e9e3d6";
  for (let i = 0; i < 6; i++) {
    c.rotate(Math.PI / 3);
    c.fillRect(-r * 0.08, -r * 0.45, r * 0.16, r * 0.22);
  }
  c.restore();
}

function strokeWire(c: Ctx, points: readonly Point[]): void {
  if (points.length < 2) return;
  const path = new Path2D();
  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) path.lineTo(points[i].x, points[i].y);
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = "#0e0d12";
  c.lineWidth = 3;
  c.stroke(path);
  c.strokeStyle = "rgba(230, 215, 195, 0.45)";
  c.lineWidth = 1;
  c.stroke(path);
}

/** The earbud nobody is wearing, lying on the table, with a faint light of its own. */
function drawEmptyBud(c: Ctx, at: Point, unit: number, glow: number): void {
  const r = clamp(unit * 0.014, 6, 12);
  if (glow > 0) {
    const g = c.createRadialGradient(at.x, at.y, 0, at.x, at.y, r * 5);
    g.addColorStop(0, `rgba(${WARM}, ${(0.28 * glow).toFixed(3)})`);
    g.addColorStop(1, `rgba(${WARM}, 0)`);
    c.fillStyle = g;
    c.fillRect(at.x - r * 5, at.y - r * 5, r * 10, r * 10);
  }
  c.fillStyle = "#1c1b21";
  c.beginPath();
  c.ellipse(at.x, at.y, r, r * 0.85, -0.3, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#33313b";
  c.beginPath();
  c.ellipse(at.x - r * 0.2, at.y - r * 0.15, r * 0.55, r * 0.45, -0.3, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(230, 215, 195, 0.5)";
  c.lineWidth = 1;
  c.beginPath();
  c.ellipse(at.x, at.y, r, r * 0.85, -0.3, Math.PI * 1.1, Math.PI * 1.7);
  c.stroke();
}

interface Steps {
  /** Where the lamp's bulb hangs. */
  bulb: Point;
  /** The top step, which the lamp lights. */
  landing: Point & { w: number };
}

/** The night outside: stone steps up to the station, a lamp post at the top. */
function paintSteps(c: Ctx, l: Layout): Steps {
  const { w, h, unit } = l;
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#070a18");
  sky.addColorStop(0.55, "#131833");
  sky.addColorStop(1, "#0a0b16");
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  const rng = createRng(SEED + 3);
  for (let i = 0; i < (w * h) / 5000; i++) {
    c.fillStyle = `rgba(220, 225, 240, ${(0.1 + rng() * 0.5).toFixed(3)})`;
    c.fillRect(rng() * w, rng() * h * 0.5, rng() < 0.08 ? 1.6 : 0.9, rng() < 0.08 ? 1.6 : 0.9);
  }
  // A ridge far off.
  c.fillStyle = "#0e1124";
  c.beginPath();
  c.moveTo(0, h * 0.62);
  for (let x = 0; x <= w; x += w / 18) c.lineTo(x, h * (0.5 + rng() * 0.08));
  c.lineTo(w, h);
  c.lineTo(0, h);
  c.closePath();
  c.fill();
  // The steps, rising away up the slope, narrower as they go.
  const cx = w * (h > w ? 0.62 : 0.66);
  const bottom = h * 0.98;
  const top = h * 0.6;
  const count = 7;
  let landing = { x: cx, y: top, w: unit * 0.1 };
  for (let i = 0; i < count; i++) {
    const k0 = i / count;
    const k1 = (i + 1) / count;
    const y0 = bottom + (top - bottom) * k0;
    const y1 = bottom + (top - bottom) * k1;
    const half0 = unit * (0.42 - 0.3 * k0 ** 0.8);
    const half1 = unit * (0.42 - 0.3 * k1 ** 0.8);
    const riser = (y0 - y1) * 0.45;
    // Tread.
    const tread = c.createLinearGradient(0, y1, 0, y0 - riser);
    tread.addColorStop(0, "#3a3d52");
    tread.addColorStop(1, "#2a2c3e");
    c.fillStyle = tread;
    c.beginPath();
    c.moveTo(cx - half1, y1);
    c.lineTo(cx + half1, y1);
    c.lineTo(cx + half0, y0 - riser);
    c.lineTo(cx - half0, y0 - riser);
    c.closePath();
    c.fill();
    // Riser in shadow.
    c.fillStyle = "#15161f";
    c.fillRect(cx - half0, y0 - riser, half0 * 2, riser);
    // Worn stone.
    for (let s = 0; s < 40; s++) {
      c.fillStyle = `rgba(${rng() < 0.5 ? "150, 155, 175" : "10, 10, 18"}, ${(0.05 + rng() * 0.08).toFixed(3)})`;
      c.fillRect(cx - half0 + rng() * half0 * 2, y1 + rng() * (y0 - y1), 2 + rng() * 4, 1);
    }
    if (i === count - 1) landing = { x: cx, y: y1, w: half1 * 2 };
    // Grass grown over the ends of the step.
    c.strokeStyle = "#090a12";
    c.lineCap = "round";
    for (const side of [-1, 1]) {
      const edgeX = cx + side * half0;
      for (let g = 0; g < 9; g++) {
        const gx = edgeX + side * (rng() * unit * 0.05 - unit * 0.012);
        const gh = (unit * 0.02 + rng() * unit * 0.045) * (1 - k0 * 0.5);
        c.lineWidth = 1 + rng() * 1.2;
        c.beginPath();
        c.moveTo(gx, y0 - riser * 0.2);
        c.quadraticCurveTo(gx + side * gh * 0.3, y0 - gh * 0.6, gx + side * gh * (0.2 + rng() * 0.5), y0 - gh);
        c.stroke();
      }
    }
  }
  // Mist lying low over the foot of the steps.
  const mist = c.createLinearGradient(0, h * 0.72, 0, h);
  mist.addColorStop(0, "rgba(150, 160, 200, 0)");
  mist.addColorStop(0.6, "rgba(150, 160, 200, 0.1)");
  mist.addColorStop(1, "rgba(150, 160, 200, 0.18)");
  c.fillStyle = mist;
  c.fillRect(0, h * 0.72, w, h * 0.28);
  // The lamp post at the top of the steps.
  const postX = cx + landing.w * 0.42;
  const postTop = top - unit * 0.32;
  c.fillStyle = "#07080e";
  c.fillRect(postX - 2, postTop, 4, top - postTop);
  c.beginPath();
  c.moveTo(postX - unit * 0.03, postTop + unit * 0.012);
  c.lineTo(postX - unit * 0.01, postTop - unit * 0.018);
  c.lineTo(postX + unit * 0.01, postTop - unit * 0.018);
  c.lineTo(postX + unit * 0.03, postTop + unit * 0.012);
  c.closePath();
  c.fill();
  return { bulb: { x: postX, y: postTop + unit * 0.02 }, landing };
}

function paintStill(c: Ctx, l: Layout): void {
  paintRoom(c, l);
  strokeWire(c, l.wire.trunk);
  strokeWire(c, l.wire.worn);
  strokeWire(c, l.wire.empty);
  paintWalkman(c, l);
  drawReel(c, l.reels[0], l.reelR, 0.3);
  drawReel(c, l.reels[1], l.reelR, 1.1);
  drawEmptyBud(c, l.wire.empty[l.wire.empty.length - 1], l.unit, 0.7);
}

interface Mote {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

export function play(ctx: TsukiSceneContext): TsukiSceneHandle {
  injectSceneStyles(css, ctx.signal);
  const { stage, textEl, controls, signal, audio } = ctx;
  const split = splitGlyphs(textEl);
  textEl.classList.add("tsuki-p0-text");
  textEl.style.setProperty("--p0-subtitles", `${PROLOGUE.subtitlesMs}ms`);

  let l = layoutOf(1, 1);
  let room: HTMLCanvasElement | null = null;
  let walkman: HTMLCanvasElement | null = null;
  let night: HTMLCanvasElement | null = null;
  let steps: Steps | null = null;
  let lampGlow: HTMLCanvasElement | null = null;
  let mote: HTMLCanvasElement | null = null;
  let petals: HTMLCanvasElement[] = [];
  let box: Box | null = null;
  let boxAge = 0;
  let sceneT = 0;
  let playAt: number | null = null;
  let reelAngle = 0;
  let subtitlesShown = false;
  const rng = createRng(SEED + 4);
  const motes: Mote[] = Array.from({ length: 46 }, () => ({ x: rng(), y: rng(), r: 0.5 + rng() * 1.4, phase: rng() * 6.28, speed: 0.2 + rng() * 0.6 }));
  const drift = Array.from({ length: 10 }, () => ({ x: rng(), y: rng(), size: 7 + rng() * 6, rot: rng() * 6.28, variant: Math.floor(rng() * 4) }));

  const layout = (size: Readonly<SceneSize>) => {
    l = layoutOf(size.width, size.height);
    const r = makeLayer(l.w, l.h, size.dpr);
    paintRoom(r.ctx, l);
    room = r.canvas;
    const wk = makeLayer(l.w, l.h, size.dpr);
    paintWalkman(wk.ctx, l);
    walkman = wk.canvas;
    const n = makeLayer(l.w, l.h, size.dpr);
    steps = paintSteps(n.ctx, l);
    night = n.canvas;
    lampGlow = radialSprite(l.unit * 0.42, size.dpr, [
      [0, "rgba(255, 236, 200, 1)"],
      [0.05, `rgba(${WARM}, 0.7)`],
      [0.25, `rgba(${WARM}, 0.18)`],
      [1, `rgba(${WARM}, 0)`],
    ]);
    mote = radialSprite(4, size.dpr, [
      [0, "rgba(255, 240, 220, 0.9)"],
      [1, "rgba(255, 240, 220, 0)"],
    ]);
    petals = petalSprites(size.dpr);
    box = null;
  };

  // --- the Play button, and the countdown that starts the tape without it ---
  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.className = "tsuki-cutscene__control tsuki-prologue__play";
  playButton.textContent = PLAY_LABEL;
  controls.append(playButton);
  let countdown: AutoStart | null = null;
  let hovering = false;
  let focused = false;
  let pressed = false;

  const startSound = (click: boolean) => {
    if (click) audio.sfx("tape-click");
    audio.layerSoundscape("cassette-hiss");
    audio.setCue("discovery");
  };

  const begin = (pressedPlay: boolean) => {
    if (playAt !== null || signal.aborted) return;
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
    // Should the Walkman switch on later than at once, the cue and the hiss are asked for again when it reports back.
    const soundedAtOnce = audio.available();
    gesture
      ?.then((ok) => {
        if (ok && !soundedAtOnce && !signal.aborted) startSound(false);
      })
      .catch(noop);
    // The button has done its job. If it holds focus, hand that to Skip before it goes.
    if (document.activeElement === playButton) ctx.dialog.querySelector<HTMLElement>("[data-cutscene-skip]")?.focus({ preventScroll: true });
    playButton.remove();
    playAt = sceneT;
  };

  const engage = () => countdown?.setEngaged(hovering || focused || pressed);
  playButton.addEventListener("click", () => begin(true), { signal });
  playButton.addEventListener("pointerenter", () => ((hovering = true), engage()), { signal });
  playButton.addEventListener("pointerleave", () => ((hovering = false), engage()), { signal });
  playButton.addEventListener("pointerdown", () => ((pressed = true), engage()), { signal });
  for (const end of ["pointerup", "pointercancel"]) playButton.addEventListener(end, () => ((pressed = false), engage()), { signal });
  playButton.addEventListener("focus", () => ((focused = true), engage()), { signal });
  playButton.addEventListener("blur", () => ((focused = false), engage()), { signal });
  countdown = createAutoStart(() => begin(false));
  signal.addEventListener("abort", () => countdown?.cancel(), { once: true });

  return runCanvasScene(ctx, {
    endS: () => prologueEnd(playAt),
    maxEndS: PROLOGUE_MAX_END_S,
    className: "tsuki-p0-canvas",
    layout,
    render(c, info) {
      const { t, dt, width: w, height: h } = info;
      sceneT = t;
      c.clearRect(0, 0, w, h);
      if (!info.ready || !room || !walkman || !night || !steps || !lampGlow) return;
      boxAge -= dt;
      if (!box || boxAge <= 0) {
        box = textBox(stage, textEl);
        boxAge = 0.5;
      }
      const since = playAt === null ? -1 : t - playAt;
      if (!subtitlesShown && since >= PROLOGUE.subtitlesStart) {
        subtitlesShown = true;
        textEl.classList.add("tsuki-p0-in");
      }
      const intro = smooth(phase(t, 0, 1.6));
      const dissolve = since < 0 ? 0 : smooth(phase(since, PROLOGUE.dissolveStart, PROLOGUE.dissolveEnd));
      const outro = since < 0 ? 1 : 1 - smooth(phase(since, PROLOGUE.end - 1.6, PROLOGUE.end));

      // ---- the room ----------------------------------------------------------------
      if (dissolve < 1) {
        c.globalAlpha = intro * (1 - dissolve) * outro;
        c.drawImage(room, 0, 0, w, h);
        // Dust turning slowly in the lamplight, a little livelier once the tape plays.
        if (mote) {
          const lively = since >= 0 ? 1.6 : 1;
          for (const m of motes) {
            const mx = l.pool.x + (m.x - 0.5) * l.pool.r * 1.6 + Math.sin(t * 0.2 * lively + m.phase) * 14;
            const my = l.rest - (l.rest * 0.75) * m.y + ((t * m.speed * 6 * lively) % (l.rest * 0.75));
            c.globalAlpha = intro * (1 - dissolve) * outro * (0.25 + 0.35 * Math.sin(t * m.speed + m.phase) ** 2);
            const s = m.r * 3;
            c.drawImage(mote, mx - s / 2, my - s / 2, s, s);
          }
        }
        c.globalAlpha = intro * (1 - dissolve) * outro;
        // The wire, pulled out as the tape starts.
        const pull = wireProgress(since < 0 ? 0 : phase(since, PROLOGUE.wireStart, PROLOGUE.wireEnd));
        if (pull.trunk > 0) strokeWire(c, pathUpTo(l.wire.trunk, pull.trunk));
        if (pull.branches > 0) {
          strokeWire(c, pathUpTo(l.wire.worn, pull.branches));
          strokeWire(c, pathUpTo(l.wire.empty, pull.branches));
        }
        c.drawImage(walkman, 0, 0, w, h);
        // The reels turn while the tape plays; the little lamp is on.
        if (since >= PROLOGUE.tapeOn) reelAngle += dt * 2.6;
        drawReel(c, l.reels[0], l.reelR, reelAngle);
        drawReel(c, l.reels[1], l.reelR, reelAngle * 0.82 + 0.6);
        const led = since >= PROLOGUE.tapeOn ? 0.85 + 0.15 * Math.sin(t * 2) : 0.12;
        c.fillStyle = `rgba(230, 60, 50, ${led.toFixed(3)})`;
        c.beginPath();
        c.arc(l.led.x, l.led.y, Math.max(1.6, l.walkman.h * 0.025), 0, Math.PI * 2);
        c.fill();
        if (since >= PROLOGUE.tapeOn) {
          const g = c.createRadialGradient(l.led.x, l.led.y, 0, l.led.x, l.led.y, l.walkman.h * 0.12);
          g.addColorStop(0, "rgba(230, 60, 50, 0.35)");
          g.addColorStop(1, "rgba(230, 60, 50, 0)");
          c.fillStyle = g;
          c.fillRect(l.led.x - l.walkman.h * 0.12, l.led.y - l.walkman.h * 0.12, l.walkman.h * 0.24, l.walkman.h * 0.24);
        }
        // The empty earbud, lying where the wire ends.
        if (pull.branches > 0.98) {
          const bud = l.wire.empty[l.wire.empty.length - 1];
          drawEmptyBud(c, bud, l.unit, (0.55 + 0.25 * Math.sin(t * 0.8)) * smooth(phase(since, PROLOGUE.wireEnd, PROLOGUE.wireEnd + 1.2)));
        }
      }

      // ---- the stone steps, where the station lamp lights ------------------------------
      if (dissolve > 0) {
        c.globalAlpha = dissolve * outro;
        c.drawImage(night, 0, 0, w, h);
        const level = lampLevel(since - PROLOGUE.lampOn);
        if (level > 0) {
          const s = lampGlow.width / info.dpr;
          c.globalCompositeOperation = "lighter";
          c.globalAlpha = dissolve * outro * level;
          c.drawImage(lampGlow, steps.bulb.x - s / 2, steps.bulb.y - s / 2, s, s);
          // The light falling on the top steps.
          c.save();
          c.translate(steps.landing.x, steps.landing.y + l.unit * 0.04);
          c.scale(1, 0.35);
          const pool = c.createRadialGradient(0, 0, 0, 0, 0, steps.landing.w * 1.4);
          pool.addColorStop(0, `rgba(${WARM}, 0.35)`);
          pool.addColorStop(1, `rgba(${WARM}, 0)`);
          c.fillStyle = pool;
          c.fillRect(-steps.landing.w * 1.4, -steps.landing.w * 1.4, steps.landing.w * 2.8, steps.landing.w * 2.8);
          c.restore();
          c.globalCompositeOperation = "source-over";
        }
        // A few petals hanging in the air, as the story has them.
        for (const p of drift) {
          const sprite = petals[p.variant];
          if (!sprite) continue;
          drawPetal(c, sprite, p.x * w, p.y * h * 0.8 + Math.sin(t * 0.3 + p.rot) * 4, p.size, p.rot + t * 0.05, p.rot, dissolve * outro * 0.7);
        }
      }
      c.globalAlpha = 1;
      drawTextScrim(c, box, intro * outro);
    },
    cleanup() {
      countdown?.cancel();
      textEl.classList.remove("tsuki-p0-text", "tsuki-p0-in");
      textEl.style.removeProperty("--p0-subtitles");
      split.restore();
    },
  });
}

export function still(ctx: TsukiSceneContext): void {
  injectSceneStyles(css, ctx.signal);
  stillCanvas(
    ctx,
    (c, size) => {
      paintStill(c, layoutOf(size.width, size.height));
      drawTextScrim(c, textBox(ctx.stage, ctx.textEl), 1);
    },
    "tsuki-p0-canvas",
  );
}
