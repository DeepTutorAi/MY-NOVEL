// Chapter 1's cutscene (design section 7.3): from the driver's seat, the
// rental car pushes through the storm on a forest road. Pine trunks drawn in
// graphite pass in and out of the headlights; snow streaks at the glass. Hold
// anywhere, or press "ไฟสูง", for the high beam: it reaches further and, while
// it does, seven trunks too thin to be trees stand in the treeline ahead. They
// are gone when the beam drops. At 15 s the lodge's lights show far ahead.
// Rules in headlights-core.ts.
import { createRng, type SceneFrame, type SceneSize } from "../../../_shared/scene-runtime";
import { makeLayer, paperGrain, runLodgeScene } from "../../canvas/kit";
import { luminanceRamp } from "../../canvas/kit-core";
import type { LodgeSceneContext, LodgeSceneHandle } from "../scene-types";
import { HEADLIGHTS, TRUNK_COUNT, approachBeam, beamTarget, headlightsReveal, lodgeLight, project, trunkVisible, type Point3 } from "./headlights-core";

const HIGH_LABEL = "ไฟสูง";
const SPEED = 13;
const FAR = 130;
const ROAD_HALF = 3.4;

interface Tree {
  x: number;
  z: number;
  height: number;
  width: number;
}

interface Flake {
  x: number;
  y: number;
  z: number;
  len: number;
}

function scene(ctx: LodgeSceneContext, still: boolean) {
  const rng = createRng(206);
  let size: SceneSize | null = null;
  let frameLayer: HTMLCanvasElement | null = null;
  let skyLayer: HTMLCanvasElement | null = null;
  let beam = beamTarget(false);
  let toggled = false;
  let ended = false;

  const trees: Tree[] = [];
  for (let z = 4; z < FAR; z += 3.2 + rng() * 3.5) {
    for (const side of [-1, 1]) {
      if (rng() < 0.2) continue;
      trees.push({ x: side * (ROAD_HALF + 1.6 + rng() * 9), z: z + rng() * 2, height: 9 + rng() * 7, width: 0.28 + rng() * 0.22 });
    }
  }
  // Seven trunks too thin to be trees, standing in the treeline at the edge of the high beam's reach.
  const thin = Array.from({ length: TRUNK_COUNT }, (_, i) => ({
    x: (i % 2 === 0 ? -1 : 1) * (ROAD_HALF + 1.4 + (i * 1.7) % 5),
    z: 58 + i * 3.1,
    height: 11 + ((i * 7) % 4),
  }));
  const flakes: Flake[] = Array.from({ length: 260 }, () => ({ x: (rng() - 0.5) * 16, y: rng() * 5, z: 1 + rng() * 40, len: 0.12 + rng() * 0.2 }));

  const button = document.createElement("button");
  button.type = "button";
  button.className = "lodge-cutscene__control";
  button.dataset.sceneHighbeam = "";
  button.setAttribute("aria-pressed", "false");
  button.textContent = HIGH_LABEL;
  const onToggle = () => {
    toggled = !toggled;
    button.setAttribute("aria-pressed", String(toggled));
  };
  if (!still) {
    button.addEventListener("click", onToggle);
    ctx.controls.append(button);
  }

  /** How lit something at depth z and lateral offset x is by the current beam (0..1). */
  const lit = (x: number, z: number) => {
    const reach = 8 + beam * 90;
    const along = Math.max(0, 1 - z / reach);
    const across = Math.max(0, 1 - Math.abs(x) / (2.6 + z * 0.32));
    return along * (0.35 + 0.65 * across);
  };

  const bake = (next: SceneSize) => {
    size = next;
    const { width: w, height: h } = next;
    const sky = makeLayer(next);
    if (sky) {
      const c = sky.ctx;
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#08080a");
      g.addColorStop(0.34, "#1b1b1c");
      g.addColorStop(0.35, "#151514");
      g.addColorStop(1, "#0b0b0a");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      paperGrain(c, w, h, 4, 1.3);
      skyLayer = sky.canvas;
    }
    // The car's frame: pillars, the top of the windscreen and the dashboard.
    const frame = makeLayer(next);
    if (frame) {
      const c = frame.ctx;
      c.fillStyle = "#050505";
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(w * 0.1, 0);
      c.lineTo(w * 0.02, h * 0.78);
      c.lineTo(0, h * 0.8);
      c.closePath();
      c.moveTo(w, 0);
      c.lineTo(w * 0.9, 0);
      c.lineTo(w * 0.98, h * 0.78);
      c.lineTo(w, h * 0.8);
      c.closePath();
      c.fill();
      c.fillRect(0, 0, w, h * 0.035);
      const dash = c.createLinearGradient(0, h * 0.82, 0, h);
      dash.addColorStop(0, "#0b0b0b");
      dash.addColorStop(1, "#030303");
      c.fillStyle = dash;
      c.beginPath();
      c.moveTo(0, h * 0.84);
      c.quadraticCurveTo(w * 0.5, h * 0.79, w, h * 0.84);
      c.lineTo(w, h);
      c.lineTo(0, h);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(236,231,221,0.07)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, h * 0.84);
      c.quadraticCurveTo(w * 0.5, h * 0.79, w, h * 0.84);
      c.stroke();
      frameLayer = frame.canvas;
    }
  };

  const drawRoad = (c: CanvasRenderingContext2D, w: number, h: number) => {
    const near = 1.5;
    const pts: Point3[] = [
      { x: -ROAD_HALF, y: 0, z: near },
      { x: -ROAD_HALF, y: 0, z: FAR },
      { x: ROAD_HALF, y: 0, z: FAR },
      { x: ROAD_HALF, y: 0, z: near },
    ];
    const p = pts.map((pt) => project(pt, w, h));
    const reach = project({ x: 0, y: 0, z: 8 + beam * 90 }, w, h).y;
    const g = c.createLinearGradient(0, h, 0, h * 0.34);
    g.addColorStop(0, "rgba(176,172,164,0.55)");
    g.addColorStop(Math.min(0.98, Math.max(0.02, (h - reach) / (h * 0.66))), "rgba(120,117,110,0.18)");
    g.addColorStop(1, "rgba(60,58,55,0.05)");
    c.fillStyle = g;
    c.beginPath();
    p.forEach((q, i) => (i === 0 ? c.moveTo(q.x, q.y) : c.lineTo(q.x, q.y)));
    c.closePath();
    c.fill();
  };

  const drawBeam = (c: CanvasRenderingContext2D, w: number, h: number) => {
    const reach = 8 + beam * 90;
    const tip = project({ x: 0, y: 1, z: reach }, w, h);
    const g = c.createRadialGradient(w / 2, h * 0.95, 0, w / 2, tip.y, Math.max(w, h) * (0.55 + beam * 0.4));
    g.addColorStop(0, "rgba(236,232,222,0.22)");
    g.addColorStop(0.5, "rgba(214,210,200,0.08)");
    g.addColorStop(1, "rgba(214,210,200,0)");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(w * 0.08, h);
    c.lineTo(tip.x - w * (0.05 + beam * 0.06), tip.y);
    c.lineTo(tip.x + w * (0.05 + beam * 0.06), tip.y);
    c.lineTo(w * 0.92, h);
    c.closePath();
    c.fill();
  };

  const drawTrunk = (c: CanvasRenderingContext2D, w: number, h: number, x: number, z: number, height: number, width: number, light: number, hatch: boolean) => {
    const base = project({ x, y: 0, z }, w, h);
    const top = project({ x, y: height, z }, w, h);
    const half = Math.max(0.6, (width * base.scale) / 2);
    // Snow fog swallows distance: far trunks fade to the haze, so the thin black ones stand out.
    const fog = 1 - Math.exp(-z / 42);
    const tone = Math.round((14 + light * 120) * (1 - fog) + 36 * fog);
    c.fillStyle = `rgb(${tone},${tone - 2},${tone - 4})`;
    c.fillRect(base.x - half, top.y, half * 2, base.y - top.y);
    // Drooping pine branches, heavier toward the top.
    if (half > 1.2) {
      c.strokeStyle = `rgb(${Math.max(8, tone - 10)},${Math.max(8, tone - 12)},${Math.max(8, tone - 14)})`;
      c.lineWidth = Math.max(1, half * 0.5);
      c.beginPath();
      const span = base.y - top.y;
      for (let k = 0; k < 7; k += 1) {
        const y = top.y + span * (0.06 + k * 0.075);
        const reach = half * (5 + k * 1.6);
        c.moveTo(base.x - half, y);
        c.quadraticCurveTo(base.x - reach * 0.6, y + reach * 0.1, base.x - reach, y + reach * 0.45);
        c.moveTo(base.x + half, y + span * 0.03);
        c.quadraticCurveTo(base.x + reach * 0.6, y + span * 0.03 + reach * 0.1, base.x + reach, y + span * 0.03 + reach * 0.45);
      }
      c.stroke();
    }
    if (hatch && half > 2.5 && light > 0.15) {
      c.strokeStyle = `rgba(10,10,10,${0.35 * light})`;
      c.lineWidth = 1;
      c.beginPath();
      for (let y = top.y; y < base.y; y += 6) {
        c.moveTo(base.x - half, y);
        c.lineTo(base.x + half, y + 4);
      }
      c.stroke();
    }
  };

  const draw = (c: CanvasRenderingContext2D, frame: Readonly<SceneFrame>, moving: boolean) => {
    const { t, dt, width: w, height: h } = frame;
    c.setTransform(frame.dpr, 0, 0, frame.dpr, 0, 0);
    if (moving) {
      const pressing = frame.pointer.down && !(document.activeElement === button);
      beam = approachBeam(beam, toggled || pressing, dt);
      for (const tree of trees) {
        tree.z -= SPEED * dt;
        if (tree.z < 1.2) tree.z += FAR - 4;
      }
    }
    if (skyLayer) c.drawImage(skyLayer, 0, 0, w, h);
    // A faint snow haze where the beam meets the storm near the horizon.
    const haze = c.createRadialGradient(w / 2, h * 0.34, 0, w / 2, h * 0.34, w * (0.18 + beam * 0.22));
    haze.addColorStop(0, `rgba(190,186,178,${0.05 + beam * 0.1})`);
    haze.addColorStop(1, "rgba(190,186,178,0)");
    c.fillStyle = haze;
    c.fillRect(0, 0, w, h);

    const light = moving ? lodgeLight(t) : 1;
    if (light > 0) {
      // The lodge's lit windows, a little left of where the road disappears.
      const r = Math.max(6, w * 0.008);
      for (const [dx, dy] of [[-1.6, 2.2], [0, 2.2], [1.6, 2.2], [0.8, 4.4]]) {
        const p = project({ x: -9 + dx, y: dy, z: 200 }, w, h);
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(240,218,166,${0.9 * light})`);
        g.addColorStop(1, "rgba(240,218,166,0)");
        c.fillStyle = g;
        c.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      }
    }

    drawRoad(c, w, h);
    // Far to near, so nearer trunks cover further ones.
    const thinShow = moving && trunkVisible(beam) ? luminanceRamp(beam - 0.7, 0.15) : 0;
    const sorted = [...trees].sort((a, b) => b.z - a.z);
    let thinDrawn = false;
    for (const tree of sorted) {
      if (!thinDrawn && tree.z < 58) {
        thinDrawn = true;
        if (thinShow > 0) {
          for (const trunk of thin) {
            const base = project({ x: trunk.x, y: 0, z: trunk.z }, w, h);
            const top = project({ x: trunk.x, y: trunk.height, z: trunk.z }, w, h);
            c.fillStyle = `rgba(4,4,4,${0.95 * thinShow})`;
            c.fillRect(base.x - 0.8, top.y, 1.6, base.y - top.y);
          }
        }
      }
      drawTrunk(c, w, h, tree.x, tree.z, tree.height, tree.width, lit(tree.x, tree.z), true);
    }
    drawBeam(c, w, h);

    // Snow rushing at the glass, bright where the beam catches it.
    c.lineCap = "round";
    for (const flake of flakes) {
      const before = project(flake, w, h);
      if (moving) {
        flake.z -= SPEED * dt * 1.05;
        flake.x += 1.4 * dt;
        flake.y -= 0.6 * dt;
        if (flake.z < 0.8 || flake.y < 0) {
          flake.z = 30 + rng() * 12;
          flake.x = (rng() - 0.5) * 16;
          flake.y = rng() * 5;
          continue;
        }
      }
      const after = project(flake, w, h);
      const glow = 0.12 + lit(flake.x, flake.z) * 0.75;
      c.strokeStyle = `rgba(236,231,221,${glow})`;
      c.lineWidth = Math.min(3, 0.6 + after.scale * 0.012);
      c.beginPath();
      c.moveTo(after.x, after.y);
      c.lineTo(moving ? before.x : after.x + 1, moving ? before.y : after.y + 2);
      c.stroke();
    }
    if (frameLayer) c.drawImage(frameLayer, 0, 0, w, h);

    if (moving) {
      ctx.reveal.show(headlightsReveal(t));
      if (t >= HEADLIGHTS.endS && !ended) {
        ended = true;
        ctx.complete();
      }
    }
  };

  const handle = runLodgeScene({ canvas: ctx.canvas, container: ctx.stage, still, layout: bake, draw });
  return {
    handle,
    cleanup: () => {
      button.removeEventListener("click", onToggle);
      button.remove();
      size = null;
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
