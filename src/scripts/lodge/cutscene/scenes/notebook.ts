// The introduction's cutscene (design section 7.3): a dark room, a wooden
// table, a closed black notebook and a gold ring beside it, in the pale light
// of a snowy window whose falling flakes cross the table as shadows. "เปิดสมุด"
// turns the cover (it turns by itself after 5 s); the epigraph appears over
// the open pages, and both "ฉัน" are in Elena's hand, the second already a
// little unlike the first. Timing in notebook-core.ts.
import { createNoise2D, createRng, fbm2D, type SceneFrame, type SceneSize } from "../../../_shared/scene-runtime";
import { makeLayer, paperGrain, runLodgeScene, smudge } from "../../canvas/kit";
import type { LodgeSceneContext, LodgeSceneHandle } from "../scene-types";
import { NOTEBOOK, coverAngle, findWordClusters, notebookReveal, ringGlint } from "./notebook-core";

const OPEN_LABEL = "เปิดสมุด";

interface Layout {
  w: number;
  h: number;
  cx: number;
  cy: number;
  pw: number;
  ph: number;
  light: Array<[number, number]>;
}

/** Seen from above: the table fills the frame, the open notebook holds the epigraph. */
function layoutFor(w: number, h: number): Layout {
  const pw = Math.min(w * 0.45, 400, (h * 0.8) / 1.3);
  const ph = pw * 1.3;
  const light: Array<[number, number]> = [
    [w * 0.4, -h * 0.05],
    [w * 1.05, -h * 0.05],
    [w * 0.92, h * 1.05],
    [w * 0.12, h * 1.05],
  ];
  return { w, h, cx: w / 2, cy: h * 0.48, pw, ph, light };
}

const TILT = -0.045;

/** Marks the epigraph's "ฉัน" in Elena's hand; the last one drifts a little. */
function markHand(textEl: HTMLElement): void {
  const spans = Array.from(textEl.querySelectorAll<HTMLElement>(".lodge-cutscene__g"));
  const ranges = findWordClusters(spans.map((span) => span.textContent ?? ""), "ฉัน");
  ranges.forEach(([start, end], index) => {
    for (let i = start; i < end; i += 1) {
      spans[i].classList.add("is-hand");
      if (index === ranges.length - 1 && ranges.length > 1) spans[i].classList.add("is-drift");
    }
  });
}

function scene(ctx: LodgeSceneContext, still: boolean) {
  const rng = createRng(2024);
  const noise = createNoise2D(206);
  let L: Layout | null = null;
  let base: HTMLCanvasElement | null = null;
  let lightLayer: HTMLCanvasElement | null = null;
  let pagesGrain: HTMLCanvasElement | null = null;
  let openBook: HTMLCanvasElement | null = null;
  let flakes: Array<{ x: number; y: number; v: number; r: number }> = [];
  let openedAt: number | null = still ? -NOTEBOOK.openS : null;
  let wantsOpen = false;
  let ended = false;

  markHand(ctx.textEl);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "lodge-cutscene__control";
  button.dataset.sceneOpen = "";
  button.textContent = OPEN_LABEL;
  // A focused control must not vanish under the keyboard: focus goes to the skip button.
  const retireButton = () => {
    if (document.activeElement === button) button.closest("dialog")?.querySelector<HTMLElement>("[data-cutscene-skip]")?.focus();
    button.remove();
  };
  const onOpen = () => {
    wantsOpen = true;
    retireButton();
  };
  if (!still) {
    button.addEventListener("click", onOpen, { once: true });
    ctx.controls.append(button);
  }

  const bake = (size: SceneSize) => {
    L = layoutFor(size.width, size.height);
    openBook = null;
    const { w, h } = L;
    const layer = makeLayer(size);
    if (!layer) return;
    const c = layer.ctx;
    c.fillStyle = "#2a2621";
    c.fillRect(0, 0, w, h);
    // Table planks: long horizontal grain in graphite, a seam every so often.
    const tableTop = 0;
    for (let y = tableTop; y < h; y += 2) {
      for (let x = 0; x < w; x += 6) {
        const grain = fbm2D(noise, x / 420, y / 9, 3);
        c.fillStyle = `rgba(${grain > 0 ? "70,64,56" : "8,7,6"},${Math.abs(grain) * 0.22})`;
        c.fillRect(x, y, 6, 2);
      }
    }
    c.strokeStyle = "rgba(6,5,5,0.55)";
    c.lineWidth = 1.2;
    for (let y = h * 0.11; y < h; y += Math.max(70, h * 0.19)) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y + 4);
      c.stroke();
    }
    paperGrain(c, w, h, 9, 1.2);
    const edges = c.createRadialGradient(L.cx, L.cy, Math.min(w, h) * 0.25, L.cx, L.cy, Math.max(w, h) * 0.72);
    edges.addColorStop(0, "rgba(0,0,0,0)");
    edges.addColorStop(1, "rgba(0,0,0,0.78)");
    c.fillStyle = edges;
    c.fillRect(0, 0, w, h);
    base = layer.canvas;

    // The window's light on the table, with the shadow of its cross bars.
    const light = makeLayer(size);
    if (light) {
      const lc = light.ctx;
      lc.beginPath();
      L.light.forEach(([x, y], i) => (i === 0 ? lc.moveTo(x, y) : lc.lineTo(x, y)));
      lc.closePath();
      const fill = lc.createLinearGradient(L.light[0][0], L.light[0][1], L.light[3][0], L.light[3][1]);
      fill.addColorStop(0, "rgba(206,204,198,0.11)");
      fill.addColorStop(1, "rgba(206,204,198,0.04)");
      lc.fillStyle = fill;
      lc.fill();
      lc.save();
      lc.clip();
      lc.strokeStyle = "rgba(8,8,8,0.5)";
      lc.lineWidth = Math.max(6, w * 0.012);
      lc.beginPath();
      lc.moveTo(w * 0.74, -h * 0.05);
      lc.lineTo(w * 0.52, h * 1.05);
      lc.moveTo(w * 0.2, h * 0.62);
      lc.lineTo(w * 1.05, h * 0.5);
      lc.stroke();
      lc.restore();
      lightLayer = light.canvas;
    }
    const grain = makeLayer({ width: Math.round(L.pw), height: Math.round(L.ph), dpr: size.dpr });
    if (grain) {
      paperGrain(grain.ctx, L.pw, L.ph, 31, 2.2);
      pagesGrain = grain.canvas;
    }
    flakes = Array.from({ length: 90 }, () => ({ x: rng() * w, y: rng() * h, v: 18 + rng() * 26, r: 2 + rng() * 3 }));
  };

  const inLight = (x: number, y: number) => {
    if (!L) return false;
    // Point in the convex light quad.
    let sign = 0;
    for (let i = 0; i < 4; i += 1) {
      const [ax, ay] = L.light[i];
      const [bx, by] = L.light[(i + 1) % 4];
      const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
      if (cross !== 0) {
        if (sign === 0) sign = Math.sign(cross);
        else if (Math.sign(cross) !== sign) return false;
      }
    }
    return true;
  };

  const page = (c: CanvasRenderingContext2D, x: number, top: number, width: number, height: number, tone: string, ruled: boolean, gutterLeft: boolean) => {
    c.fillStyle = tone;
    c.fillRect(x, top, width, height);
    if (ruled) {
      c.strokeStyle = "rgba(236,231,221,0.07)";
      c.lineWidth = 1;
      for (let y = top + height * 0.11; y < top + height * 0.95; y += height * 0.052) {
        c.beginPath();
        c.moveTo(x + width * 0.08, y);
        c.lineTo(x + width * 0.94, y);
        c.stroke();
      }
    }
    // The gutter darkens toward the spine.
    const g = gutterLeft ? c.createLinearGradient(x, 0, x + width * 0.18, 0) : c.createLinearGradient(x + width, 0, x + width * 0.82, 0);
    g.addColorStop(0, "rgba(0,0,0,0.45)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(x, top, width, height);
  };

  const drawBook = (c: CanvasRenderingContext2D, angle: number) => {
    if (!L) return;
    const { cx, cy, pw, ph } = L;
    const open = angle / Math.PI;
    c.save();
    c.translate(cx, cy);
    c.rotate(TILT);
    const spine = (1 - Math.min(1, open * 1.4)) * -pw / 2;
    const top = -ph / 2;
    smudge(c, spine + pw * (0.5 - open * 0.5) + 6, 10, pw * (1.15 + open * 0.6), 0.6, "0,0,0");
    // Right page (always under the cover).
    page(c, spine, top, pw, ph, "#3d3a34", true, true);
    if (pagesGrain) c.drawImage(pagesGrain, spine, top, pw, ph);
    const width = pw * Math.cos(angle);
    if (width >= 0) {
      // The cover, still over the right page: black leather, a pressed border, the elastic band.
      const g = c.createLinearGradient(spine, top, spine + width, top + ph);
      g.addColorStop(0, "#151413");
      g.addColorStop(0.55, "#0a0909");
      g.addColorStop(1, "#181615");
      c.fillStyle = g;
      c.fillRect(spine, top - 2, width + 3, ph + 4);
      c.strokeStyle = "rgba(236,231,221,0.07)";
      c.lineWidth = 1;
      c.strokeRect(spine + Math.min(width, pw) * 0.06, top + ph * 0.04, Math.max(0, width * 0.88), ph * 0.92);
      if (angle < 0.05) {
        c.fillStyle = "#050505";
        c.fillRect(spine + width * 0.86, top - 3, Math.max(3, pw * 0.024), ph + 6);
        c.fillStyle = "rgba(236,231,221,0.08)";
        c.fillRect(spine + width * 0.86, top - 3, 1, ph + 6);
      }
    } else {
      // The inside of the cover, now the left page.
      page(c, spine + width, top, -width, ph, "#36332e", open > 0.98, false);
      if (pagesGrain && open > 0.98) c.drawImage(pagesGrain, spine + width, top, -width, ph);
    }
    c.fillStyle = "rgba(0,0,0,0.55)";
    c.fillRect(spine - 1, top, 2, ph);
    c.restore();
  };

  const drawRing = (c: CanvasRenderingContext2D, t: number) => {
    if (!L) return;
    // Beside the notebook on a wide screen, below it on a tall one.
    const portrait = L.h > L.w;
    const x = portrait ? L.cx + L.pw * 0.45 : L.cx + L.pw * 1.16;
    const y = portrait ? L.cy + L.ph * 0.66 : L.cy + L.ph * 0.3;
    const r = Math.max(10, L.pw * 0.075);
    smudge(c, x + 3, y + 5, r * 1.8, 0.4, "0,0,0");
    c.strokeStyle = "#9c8551";
    c.lineWidth = r * 0.28;
    c.beginPath();
    c.ellipse(x, y, r, r * 0.42, -0.2, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = `rgba(250,236,196,${0.18 + ringGlint(t) * 2})`;
    c.lineWidth = r * 0.1;
    c.beginPath();
    c.ellipse(x, y, r, r * 0.42, -0.2, Math.PI * 1.1, Math.PI * 1.45);
    c.stroke();
  };

  const draw = (c: CanvasRenderingContext2D, frame: Readonly<SceneFrame>, moving: boolean) => {
    const { t, dt, width: w, height: h } = frame;
    c.setTransform(frame.dpr, 0, 0, frame.dpr, 0, 0);
    if (base) c.drawImage(base, 0, 0, w, h);
    const angle = still || !moving ? Math.PI : coverAngle(t, openedAt);
    if (angle >= Math.PI) {
      // Once open the notebook no longer changes: draw it once per size.
      if (!openBook) {
        const layer = makeLayer(frame);
        if (layer) {
          drawBook(layer.ctx, Math.PI);
          openBook = layer.canvas;
        }
      }
      if (openBook) c.drawImage(openBook, 0, 0, w, h);
    } else {
      drawBook(c, angle);
    }
    if (lightLayer) c.drawImage(lightLayer, 0, 0, w, h);
    // Shadows of the falling snow, only inside the window's light.
    c.fillStyle = "rgba(8,8,8,0.42)";
    for (const flake of flakes) {
      if (moving) {
        flake.y += flake.v * dt;
        flake.x -= flake.v * 0.45 * dt;
        if (flake.y > h) {
          flake.y = h * 0.28;
          flake.x = w * (0.45 + rng() * 0.6);
        }
      }
      if (inLight(flake.x, flake.y)) {
        c.beginPath();
        c.ellipse(flake.x, flake.y, flake.r * 0.6, flake.r, -0.4, 0, Math.PI * 2);
        c.fill();
      }
    }
    if (moving) {
      if (openedAt === null && (wantsOpen || t >= NOTEBOOK.autoOpenS)) {
        openedAt = t;
        retireButton();
      }
      ctx.reveal.show(openedAt === null ? 0 : notebookReveal(t, openedAt));
      if (openedAt !== null && t - openedAt >= NOTEBOOK.endAfterOpenS && !ended) {
        ended = true;
        ctx.complete();
      }
    }
    drawRing(c, moving ? t : 0);
  };

  const handle = runLodgeScene({ canvas: ctx.canvas, container: ctx.stage, still, layout: bake, draw });
  return {
    handle,
    cleanup: () => {
      button.removeEventListener("click", onOpen);
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
