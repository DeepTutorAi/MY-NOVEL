// Chapter 13's cutscene (design section 7.3): an old stone stair under the
// lodge, seen from the top step and lit only by a torch that follows the
// pointer (or wanders by itself). Drag down, scroll, or press "ลงต่อ" to go down
// a step; the stair also goes down by itself so the scene ends in time. Marks
// carved in the walls (invented drum-style figures, not a real script) answer
// the torch as it passes. At the bottom the edge of the beam finds a heap of
// suitcases and bags left by the vanished. Rules in descent-core.ts.
import { createRng, type SceneFrame, type SceneSize } from "../../../_shared/scene-runtime";
import { makeLayer, paperGrain, runLodgeScene } from "../../canvas/kit";
import { luminanceRamp } from "../../canvas/kit-core";
import type { LodgeSceneContext, LodgeSceneHandle } from "../scene-types";
import { STEPS, approachStep, autoSteps, descentDone, descentReveal, hoardVisible, stepFromDrag, symbolGlow } from "./descent-core";

const STEP_LABEL = "ลงต่อ";
const TREAD = 0.34;
const RISE = 0.2;
const EYE = 1.55;
const HALF_W = 0.95;
const HEIGHT = 2.3;
const LOOK_AHEAD = 15;
/** Level passage after the last step, in treads, ending at a back wall. */
const CORRIDOR = 8;
const LAST_SEGMENT = STEPS + CORRIDOR;

const floorAt = (i: number) => -Math.min(i, STEPS) * RISE;
/** Fixed tonal variation per stone course, so the walls are not one flat grey. */
const stoneTone = (i: number) => 0.86 + ((Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1) * 0.28);

type Glyph = Array<[number, number, number, number]>;

/** Invented carved figures in a unit box: drum-style signs, not any real script. */
function makeGlyph(rng: () => number): Glyph {
  const lines: Glyph = [];
  const kind = Math.floor(rng() * 4);
  if (kind === 0) {
    // A sun: ring of rays.
    const rays = 6 + Math.floor(rng() * 4);
    for (let i = 0; i < rays; i += 1) {
      const a = (i / rays) * Math.PI * 2;
      lines.push([Math.cos(a) * 0.16, Math.sin(a) * 0.16, Math.cos(a) * 0.42, Math.sin(a) * 0.42]);
    }
  } else if (kind === 1) {
    // A standing figure with raised arms.
    lines.push([0, -0.35, 0, 0.2], [0, 0.2, -0.22, 0.45], [0, 0.2, 0.22, 0.45], [0, -0.15, -0.3, -0.38], [0, -0.15, 0.3, -0.38], [-0.1, -0.42, 0.1, -0.42]);
  } else if (kind === 2) {
    // A reindeer-like beast: body, legs, antlers.
    lines.push([-0.35, 0, 0.3, 0], [-0.3, 0, -0.32, 0.35], [0.25, 0, 0.27, 0.35], [0.3, 0, 0.42, -0.2], [0.42, -0.2, 0.3, -0.42], [0.42, -0.2, 0.5, -0.4]);
  } else {
    // A crossing of paths with a drum ring.
    lines.push([-0.4, 0, 0.4, 0], [0, -0.4, 0, 0.4], [-0.28, -0.28, 0.28, 0.28]);
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      const b = ((i + 1) / 10) * Math.PI * 2;
      lines.push([Math.cos(a) * 0.45, Math.sin(a) * 0.45, Math.cos(b) * 0.45, Math.sin(b) * 0.45]);
    }
  }
  return lines;
}

function scene(ctx: LodgeSceneContext, still: boolean) {
  const rng = createRng(1313);
  const glyphs = Array.from({ length: STEPS + 4 }, () => makeGlyph(rng));
  let grain: HTMLCanvasElement | null = null;
  let manual = 0;
  let step = still ? STEPS : 0;
  let bottomAt: number | null = null;
  let dragFrom: number | null = null;
  let ended = false;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "lodge-cutscene__control";
  button.dataset.sceneStep = "";
  button.textContent = STEP_LABEL;
  const onButton = () => {
    manual = Math.min(STEPS, Math.max(manual, Math.ceil(step)) + 1);
  };
  let wheel = 0;
  const onWheel = (event: WheelEvent) => {
    wheel += Math.max(0, event.deltaY);
    if (wheel >= 120) {
      wheel = 0;
      onButton();
    }
  };
  if (!still) {
    button.addEventListener("click", onButton);
    ctx.controls.append(button);
    window.addEventListener("wheel", onWheel, { passive: true });
  }

  const bake = (size: SceneSize) => {
    const layer = makeLayer(size);
    if (!layer) return;
    paperGrain(layer.ctx, size.width, size.height, 13, 1.6);
    grain = layer.canvas;
  };

  const draw = (c: CanvasRenderingContext2D, frame: Readonly<SceneFrame>, moving: boolean) => {
    const { t, dt, width: w, height: h, pointer } = frame;
    c.setTransform(frame.dpr, 0, 0, frame.dpr, 0, 0);
    c.fillStyle = "#050505";
    c.fillRect(0, 0, w, h);

    if (moving) {
      if (pointer.down) {
        if (dragFrom === null) dragFrom = pointer.y;
        const steps = stepFromDrag(pointer.y - dragFrom, h * 0.12);
        if (steps > 0) {
          manual = Math.min(STEPS, Math.max(manual, Math.ceil(step)) + steps);
          dragFrom += steps * h * 0.12;
        }
      } else {
        dragFrom = null;
      }
      step = approachStep(step, Math.min(STEPS, Math.max(manual, autoSteps(t))), dt);
      if (bottomAt === null && hoardVisible(step)) bottomAt = t;
    }

    const F = Math.min(w, h) * 0.95;
    const cx = w / 2;
    // Looking down the stair: the vanishing point sits high, so the steps fill the frame.
    const cy = h * 0.12;
    const camZ = step * TREAD;
    const camY = -step * RISE + EYE;
    const project = (x: number, y: number, z: number) => {
      const d = Math.max(0.12, z - camZ);
      const k = F / d;
      return { x: cx + x * k, y: cy - (y - camY) * k, k, d };
    };
    // The torch: the pointer while it is over the scene, else a slow wander round the middle.
    const torch = moving && pointer.active ? { x: pointer.x, y: pointer.y } : { x: cx + Math.sin(t * 0.5) * w * 0.18, y: h * 0.58 + Math.cos(t * 0.37) * h * 0.12 };
    const sigma = Math.min(w, h) * 0.26;
    const lightAt = (sx: number, sy: number, d: number) => {
      const spot = Math.exp(-((sx - torch.x) ** 2 + (sy - torch.y) ** 2) / (2 * sigma * sigma));
      return Math.min(1, Math.exp(-d / 3.8) * (0.26 + 1.25 * spot));
    };
    const quad = (pts: Array<{ x: number; y: number }>, tone: number, light: number) => {
      const v = Math.round(tone * light);
      c.fillStyle = `rgb(${v},${Math.max(0, v - 1)},${Math.max(0, v - 3)})`;
      c.beginPath();
      pts.forEach((p, i) => (i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y)));
      c.closePath();
      c.fill();
    };
    const beamAngle = Math.atan2(torch.y - cy, torch.x - cx);

    const first = Math.max(0, Math.floor(step) - 1);
    const last = Math.min(LAST_SEGMENT, first + LOOK_AHEAD);
    const L = (y: number, z: number) => project(-HALF_W, y, z);
    const R = (y: number, z: number) => project(HALF_W, y, z);
    if (last === LAST_SEGMENT) {
      // The back wall that closes the passage.
      const zb = (LAST_SEGMENT + 1) * TREAD;
      const fl = floorAt(LAST_SEGMENT);
      const mid = project(0, fl + 1, zb);
      quad([L(fl, zb), R(fl, zb), R(fl + HEIGHT, zb), L(fl + HEIGHT, zb)], 125, lightAt(mid.x, mid.y, mid.d));
    }
    for (let i = last; i >= first; i -= 1) {
      const z0 = i * TREAD;
      const z1 = (i + 1) * TREAD;
      if (z1 - camZ <= 0.12) continue;
      const fl = floorAt(i);
      const next = floorAt(i + 1);
      // The ceiling follows the stair's slope instead of stepping with it.
      const top0 = fl + HEIGHT;
      const top1 = next + HEIGHT;
      const tone = stoneTone(i);
      const mid = project(0, fl + 1, (z0 + z1) / 2);
      const light = lightAt(mid.x, mid.y, mid.d);
      const leftMid = L(fl + 1, (z0 + z1) / 2);
      const rightMid = R(fl + 1, (z0 + z1) / 2);
      quad([L(fl, z0), L(fl, z1), L(top1, z1), L(top0, z0)], 175 * tone, lightAt(leftMid.x, leftMid.y, mid.d));
      quad([R(fl, z0), R(fl, z1), R(top1, z1), R(top0, z0)], 175 * stoneTone(i + 7), lightAt(rightMid.x, rightMid.y, mid.d));
      quad([L(top0, z0), R(top0, z0), R(top1, z1), L(top1, z1)], 95, light * 0.85);
      quad([project(-HALF_W, fl, z0), project(HALF_W, fl, z0), project(HALF_W, fl, z1), project(-HALF_W, fl, z1)], 190 * tone, light);
      if (next < fl) {
        quad([project(-HALF_W, fl, z1), project(HALF_W, fl, z1), project(HALF_W, next, z1), project(-HALF_W, next, z1)], 105, light);
        // The worn front edge of the step catches the torch: it is what makes a stair read as one.
        const a = project(-HALF_W, fl, z1);
        const b = project(HALF_W, fl, z1);
        c.strokeStyle = `rgba(226,220,206,${Math.min(0.85, light * 1.1)})`;
        c.lineWidth = Math.max(1, a.k * 0.014);
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
      }
      // Mortar joints on both walls.
      c.strokeStyle = `rgba(0,0,0,${0.55 * Math.min(1, light * 2)})`;
      c.lineWidth = Math.max(0.6, (F / Math.max(0.3, mid.d)) * 0.012);
      c.beginPath();
      for (const side of [-1, 1]) {
        for (let j = 1; j <= 4; j += 1) {
          const y = fl + j * 0.46;
          const a = project(side * HALF_W, y, z0);
          const b = project(side * HALF_W, y, z1);
          c.moveTo(a.x, a.y);
          c.lineTo(b.x, b.y);
        }
        const offset = i % 2 === 0 ? 0 : 0.23;
        for (let j = 0; j < 5; j += 1) {
          const y0 = fl + offset + j * 0.46;
          const a = project(side * HALF_W, y0, z0);
          const b = project(side * HALF_W, Math.min(top0, y0 + 0.23), z0);
          c.moveTo(a.x, a.y);
          c.lineTo(b.x, b.y);
        }
      }
      c.stroke();
      // A carved mark on every third wall stone of the stair.
      if (i % 3 !== 0 && i <= STEPS) {
        const side = i % 3 === 1 ? -1 : 1;
        const at = project(side * HALF_W, fl + 1.35, (z0 + z1) / 2);
        const size = at.k * 0.3;
        const shade = lightAt(at.x, at.y, at.d);
        const glow = symbolGlow(beamAngle, Math.atan2(at.y - cy, at.x - cx)) * Math.min(1, shade * 2.2);
        c.save();
        c.translate(at.x, at.y);
        c.scale(0.45, 1);
        c.lineCap = "round";
        c.lineWidth = Math.max(1, size * 0.05);
        c.strokeStyle = `rgba(0,0,0,${0.7 * Math.min(1, shade * 2)})`;
        c.beginPath();
        for (const [x1, y1, x2, y2] of glyphs[i]) {
          c.moveTo(x1 * size, y1 * size);
          c.lineTo(x2 * size, y2 * size);
        }
        c.stroke();
        if (glow > 0.02) {
          c.strokeStyle = `rgba(232,226,212,${0.55 * glow})`;
          c.lineWidth = Math.max(0.6, size * 0.025);
          c.stroke();
        }
        c.restore();
      }
    }

    // The heap at the bottom, at the edge of the beam.
    const heap = still ? 1 : bottomAt === null ? 0 : luminanceRamp(t - bottomAt, 1);
    if (heap > 0) {
      const fl = floorAt(LAST_SEGMENT);
      // Close enough to sit below the epigraph on screen, well short of the back wall.
      const z = LAST_SEGMENT * TREAD - 0.8;
      const bags: Array<[number, number, number, number]> = [
        [-0.66, 0.02, 0.5, 0.26],
        [-0.14, 0.02, 0.44, 0.2],
        [0.34, 0.03, 0.48, 0.3],
        [-0.46, 0.27, 0.36, 0.16],
        [0.1, 0.21, 0.34, 0.13],
      ];
      bags.forEach(([x, y, bw, bh], index) => {
        const a = project(x, fl + y + bh, z);
        const b = project(x + bw, fl + y, z);
        const shade = lightAt((a.x + b.x) / 2, (a.y + b.y) / 2, a.d) * heap;
        const v = Math.round(18 + 95 * shade);
        c.save();
        c.translate((a.x + b.x) / 2, b.y);
        c.rotate(((index * 37) % 7 - 3) * 0.03);
        c.translate(-(a.x + b.x) / 2, -b.y);
        const body = c.createLinearGradient(0, a.y, 0, b.y);
        body.addColorStop(0, `rgb(${v + 18},${v + 16},${v + 12})`);
        body.addColorStop(1, `rgb(${Math.max(0, v - 14)},${Math.max(0, v - 16)},${Math.max(0, v - 20)})`);
        c.fillStyle = body;
        c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
        // Graphite hatching across the case.
        c.save();
        c.beginPath();
        c.rect(a.x, a.y, b.x - a.x, b.y - a.y);
        c.clip();
        c.strokeStyle = `rgba(0,0,0,${0.22 * heap})`;
        c.lineWidth = 1;
        c.beginPath();
        for (let x = a.x - (b.y - a.y); x < b.x; x += 5) {
          c.moveTo(x, b.y);
          c.lineTo(x + (b.y - a.y), a.y);
        }
        c.stroke();
        c.restore();
        c.strokeStyle = `rgba(0,0,0,${0.6 * heap})`;
        c.lineWidth = Math.max(1, a.k * 0.012);
        c.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
        // Handle.
        const hx = (a.x + b.x) / 2;
        c.beginPath();
        c.moveTo(hx - (b.x - a.x) * 0.15, a.y);
        c.lineTo(hx - (b.x - a.x) * 0.12, a.y - (b.y - a.y) * 0.18);
        c.lineTo(hx + (b.x - a.x) * 0.12, a.y - (b.y - a.y) * 0.18);
        c.lineTo(hx + (b.x - a.x) * 0.15, a.y);
        c.stroke();
        // A strap round the case.
        c.beginPath();
        c.moveTo(a.x + (b.x - a.x) * 0.72, a.y);
        c.lineTo(a.x + (b.x - a.x) * 0.72, b.y);
        c.stroke();
        c.restore();
      });
    }

    // The torch's circle: outside it the stair is close to black.
    const reach = Math.min(w, h) * 0.56;
    const dark = c.createRadialGradient(torch.x, torch.y, reach * 0.35, torch.x, torch.y, reach * 2);
    dark.addColorStop(0, "rgba(0,0,0,0)");
    dark.addColorStop(0.5, "rgba(0,0,0,0.42)");
    dark.addColorStop(1, "rgba(0,0,0,0.8)");
    c.fillStyle = dark;
    c.fillRect(0, 0, w, h);
    if (grain) c.drawImage(grain, 0, 0, w, h);

    if (moving) {
      ctx.reveal.show(descentReveal(t));
      if (descentDone(t, bottomAt) && !ended) {
        ended = true;
        ctx.complete();
      }
    }
  };

  const handle = runLodgeScene({ canvas: ctx.canvas, container: ctx.stage, still, layout: bake, draw });
  return {
    handle,
    cleanup: () => {
      button.removeEventListener("click", onButton);
      window.removeEventListener("wheel", onWheel);
      button.remove();
    },
  };
}

export function play(ctx: LodgeSceneContext): LodgeSceneHandle {
  const { handle, cleanup } = scene(ctx, false);
  return {
    pause: () => handle.stop(),
    dispose: () => {
      cleanup();
      handle.destroy();
    },
  };
}

export function still(ctx: LodgeSceneContext): void {
  ctx.reveal.showAll();
  const { handle, cleanup } = scene(ctx, true);
  ctx.signal.addEventListener(
    "abort",
    () => {
      cleanup();
      handle.destroy();
    },
    { once: true },
  );
}

