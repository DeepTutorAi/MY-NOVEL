// Chapter 18's cutscene (design section 7.3): a bathroom mirror in Brooklyn,
// under a bare bulb. Behind the real epigraph, the glass holds its reflection:
// the same lines, reversed, a ghost. The reflection follows the reader (the
// pointer, or a slow drift without one) half a second late; from 12 s it turns
// to lead them, and its text finishes before the real one. At the end it turns
// the right way round and settles onto the real text until the two are one.
// The ghost's lines are read from the real text's layout, so they match.
import { splitGraphemes } from "../../../_shared/cutscene/graphemes";
import type { SceneFrame, SceneSize } from "../../../_shared/scene-runtime";
import { makeLayer, paperGrain, runLodgeScene, smudge } from "../../canvas/kit";
import { visibleCount } from "../reveal-core";
import type { LodgeSceneContext, LodgeSceneHandle } from "../scene-types";
import { MIRROR, autoSelf, mergeAmount, mirrorReveal, realReveal, reflectionLag } from "./mirror-core";

interface Line {
  clusters: string[];
  x: number;
  baseline: number;
  /** Index of the line's first cluster in the whole epigraph. */
  start: number;
}

interface Sample {
  t: number;
  x: number;
  y: number;
}

/** The real text's lines, from where its cluster spans sit, in stage coordinates. */
function readLines(textEl: HTMLElement, stage: HTMLElement): { lines: Line[]; box: DOMRect | null; font: string } {
  const origin = stage.getBoundingClientRect();
  const spans = Array.from(textEl.querySelectorAll<HTMLElement>(".lodge-cutscene__g"));
  const lines: Line[] = [];
  let current: Line | null = null;
  let top = Number.NaN;
  spans.forEach((span, index) => {
    const rect = span.getClientRects()[0];
    if (!rect) return;
    if (current === null || Math.abs(rect.top - top) > rect.height * 0.5) {
      top = rect.top;
      current = { clusters: [], x: rect.left - origin.left, baseline: rect.top - origin.top + rect.height * 0.78, start: index };
      lines.push(current);
    }
    current.clusters.push(span.textContent ?? "");
  });
  const style = getComputedStyle(textEl);
  return { lines, box: textEl.getBoundingClientRect(), font: `${style.fontWeight} ${style.fontSize} ${style.fontFamily}` };
}

function scene(ctx: LodgeSceneContext, still: boolean) {
  let room: HTMLCanvasElement | null = null;
  let lines: Line[] = [];
  let font = "16px sans-serif";
  let center = { x: 0, y: 0 };
  let glass = { x: 0, y: 0, w: 0, h: 0 };
  let history: Sample[] = [];
  let ended = false;
  const total = splitGraphemes(ctx.textEl.textContent ?? "").length;

  const layout = (size: SceneSize) => {
    const { width: w, height: h } = size;
    const read = readLines(ctx.textEl, ctx.stage);
    lines = read.lines;
    font = read.font;
    const origin = ctx.stage.getBoundingClientRect();
    const box = read.box;
    const bx = box ? box.left - origin.left : w * 0.2;
    const by = box ? box.top - origin.top : h * 0.35;
    const bw = box ? box.width : w * 0.6;
    const bh = box ? box.height : h * 0.3;
    center = { x: bx + bw / 2, y: by + bh / 2 };
    glass = {
      x: Math.max(w * 0.04, bx - Math.max(28, bw * 0.16)),
      y: Math.max(h * 0.08, by - Math.max(60, bh * 0.45)),
      w: 0,
      h: 0,
    };
    glass.w = Math.min(w * 0.96, bw + (center.x - glass.x - bw / 2) * 2);
    glass.h = Math.min(h * 0.8, bh + (center.y - glass.y - bh / 2) * 2);

    const layer = makeLayer(size);
    if (!layer) return;
    const c = layer.ctx;
    // Tiles under a bare bulb.
    const wall = c.createRadialGradient(w / 2, 0, 0, w / 2, h * 0.2, Math.max(w, h));
    wall.addColorStop(0, "#3a3733");
    wall.addColorStop(0.5, "#1c1a18");
    wall.addColorStop(1, "#0b0a09");
    c.fillStyle = wall;
    c.fillRect(0, 0, w, h);
    const tile = Math.max(36, Math.min(w, h) * 0.075);
    c.strokeStyle = "rgba(0,0,0,0.45)";
    c.lineWidth = 1.5;
    c.beginPath();
    for (let x = (w / 2) % tile; x < w; x += tile) {
      c.moveTo(x, 0);
      c.lineTo(x, h);
    }
    for (let y = 0; y < h; y += tile) {
      c.moveTo(0, y);
      c.lineTo(w, y);
    }
    c.stroke();
    // The glass: darker than the wall, a cold sheen, a silvered edge.
    const sheen = c.createLinearGradient(glass.x, glass.y, glass.x + glass.w, glass.y + glass.h);
    sheen.addColorStop(0, "#1a1a1b");
    sheen.addColorStop(0.45, "#0e0e0f");
    sheen.addColorStop(0.55, "#141415");
    sheen.addColorStop(1, "#090909");
    c.fillStyle = sheen;
    c.fillRect(glass.x, glass.y, glass.w, glass.h);
    c.strokeStyle = "#5e5a54";
    c.lineWidth = 5;
    c.strokeRect(glass.x - 3, glass.y - 3, glass.w + 6, glass.h + 6);
    c.strokeStyle = "rgba(236,231,221,0.12)";
    c.lineWidth = 1;
    c.strokeRect(glass.x + 2, glass.y + 2, glass.w - 4, glass.h - 4);
    // Age spots in the silvering.
    for (let i = 0; i < 14; i += 1) {
      const fx = (Math.sin(i * 91.7) * 0.5 + 0.5) * glass.w;
      const fy = (Math.sin(i * 47.3) * 0.5 + 0.5) * glass.h;
      smudge(c, glass.x + fx, glass.y + fy, 6 + (i % 4) * 5, 0.25, "40,38,34");
    }
    smudge(c, w / 2, 0, Math.min(w, h) * 0.12, 0.35, "236,226,200");
    paperGrain(c, w, h, 18, 1.2);
    room = layer.canvas;
  };

  /** Where the reader's stand-in was (lag > 0) or will be (lag < 0), in stage pixels. */
  const selfAt = (t: number, lag: number, frame: Readonly<SceneFrame>) => {
    if (!(frame.pointer.active && history.length > 1)) {
      const p = autoSelf(t - lag);
      return { x: p.x * frame.width, y: p.y * frame.height };
    }
    const latest = history[history.length - 1];
    if (lag <= 0) {
      // Lead: carry the recent motion forward.
      const past = history.find((s) => latest.t - s.t <= 0.15) ?? history[0];
      const span = Math.max(1e-3, latest.t - past.t);
      return { x: latest.x + ((latest.x - past.x) / span) * -lag, y: latest.y + ((latest.y - past.y) / span) * -lag };
    }
    const when = latest.t - lag;
    for (let i = history.length - 1; i > 0; i -= 1) {
      if (history[i - 1].t <= when) return { x: history[i - 1].x, y: history[i - 1].y };
    }
    return { x: history[0].x, y: history[0].y };
  };

  const draw = (c: CanvasRenderingContext2D, frame: Readonly<SceneFrame>, moving: boolean) => {
    const { t, width: w, height: h } = frame;
    c.setTransform(frame.dpr, 0, 0, frame.dpr, 0, 0);
    if (room) c.drawImage(room, 0, 0, w, h);
    if (moving && frame.pointer.active) {
      history.push({ t, x: frame.pointer.x, y: frame.pointer.y });
      history = history.filter((s) => t - s.t <= 1.2);
    }

    const merge = moving ? mergeAmount(t) : 0;
    const self = moving ? selfAt(t, reflectionLag(t), frame) : { x: w / 2, y: h / 2 };
    const ox = (self.x - w / 2) * 0.12 * (1 - merge);
    const oy = (self.y - h / 2) * 0.08 * (1 - merge);
    const flip = -1 + 2 * merge;
    const shown = moving ? visibleCount(mirrorReveal(t), total) : total;
    // Faint and soft while it is a reflection behind the glass, full only as it lands on the text.
    const alpha = moving ? (0.17 + 0.2 * merge) * (1 - Math.min(1, Math.max(0, (t - MIRROR.mergeAtS) / 1.5))) : 0.17;

    if (alpha > 0) {
      c.save();
      c.beginPath();
      c.rect(glass.x, glass.y, glass.w, glass.h);
      c.clip();
      c.font = font;
      c.filter = merge < 0.9 ? "blur(0.7px)" : "none";
      c.textBaseline = "alphabetic";
      c.fillStyle = `rgba(214,210,200,${alpha})`;
      c.translate(center.x + ox, oy);
      c.scale(flip === 0 ? 0.001 : flip, 1);
      for (const line of lines) {
        const count = Math.max(0, Math.min(line.clusters.length, shown - line.start));
        if (count === 0) continue;
        c.fillText(line.clusters.slice(0, count).join(""), line.x - center.x, line.baseline);
      }
      c.restore();
    }

    if (moving) {
      ctx.reveal.show(realReveal(t));
      if (t >= MIRROR.endS && !ended) {
        ended = true;
        ctx.complete();
      }
    }
  };

  const handle = runLodgeScene({ canvas: ctx.canvas, container: ctx.stage, still, layout, draw });
  // The real text's lines only settle once the face has loaded.
  if (document.fonts?.ready) {
    void document.fonts.ready.then(() => {
      const rect = ctx.stage.getBoundingClientRect();
      if (rect.width > 0) layout({ width: rect.width, height: rect.height, dpr: Math.min(2, window.devicePixelRatio || 1) });
      handle.redrawStill();
    });
  }
  return handle;
}

export function play(ctx: LodgeSceneContext): LodgeSceneHandle {
  const handle = scene(ctx, false);
  return { pause: () => handle.stop(), dispose: () => handle.destroy() };
}

export function still(ctx: LodgeSceneContext): void {
  ctx.reveal.showAll();
  const handle = scene(ctx, true);
  ctx.signal.addEventListener("abort", () => handle.destroy(), { once: true });
}
