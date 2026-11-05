// The home backdrop: the approved manor plate, its iron lamp, the door, rain and
// mist. The door follows the reader (manorState): ajar with light behind it,
// shut after CH4, and after the epilogue the lamp is out and the rain has stopped.
// No flashes: everything moves slowly so the page stays calm behind the text.
import { createNoise2D, createRng, createScene, type SceneFrame, type SceneSize } from "../../_shared/scene-runtime";
import type { ManorState } from "../progress-core";
import { lampLevel, placePlate, PLATE_POINTS, platePoint, rainCount, scrollDim, type PlatePlacement } from "./manor-core";

interface Streak {
  x: number;
  y: number;
  length: number;
  speed: number;
  band: number;
}

interface Ripple {
  nx: number;
  ny: number;
  age: number;
  life: number;
  size: number;
}

const BANDS = [0.1, 0.16, 0.26];
const BACKGROUND = "#0b0908";

// Open forecourt water around the five figures, as fractions of the plate.
const RIPPLE_ZONES: Array<[number, number, number, number]> = [
  [0.08, 0.92, 0.588, 0.606],
  [0.06, 0.17, 0.6, 0.76],
  [0.84, 0.97, 0.6, 0.74],
];

export interface ManorHandle {
  setStill(still: boolean): void;
  destroy(): void;
}

export function mountManor(options: {
  mount: HTMLElement;
  plate: HTMLImageElement;
  state: ManorState;
  still: boolean;
}): ManorHandle {
  const { mount, plate, state } = options;
  const canvas = document.createElement("canvas");
  canvas.className = "kusabi-manor-canvas";
  mount.append(canvas);

  const raining = state !== "after";
  const rng = createRng(2012);
  const noise = createNoise2D(311);
  let still = options.still;
  let place: PlatePlacement = placePlate(1, 1);
  let size: SceneSize = { width: 1, height: 1, dpr: 1 };
  let plateLayer: HTMLCanvasElement | null = null;
  let streaks: Streak[] = [];
  let ripples: Ripple[] = [];
  let dim = scrollDim(window.scrollY, window.innerHeight);

  const spawnRipple = (): Ripple => {
    const [left, right, top, bottom] = RIPPLE_ZONES[Math.floor(rng() * RIPPLE_ZONES.length)];
    return {
      nx: left + rng() * (right - left),
      ny: top + rng() * (bottom - top),
      age: rng() * 1.4,
      life: 1 + rng() * 0.8,
      size: 5 + rng() * 9,
    };
  };

  // The plate is painted once per size with its edges faded into the page, so a
  // frame only has to copy it.
  const buildPlateLayer = () => {
    const layer = document.createElement("canvas");
    layer.width = Math.max(1, Math.round(size.width * size.dpr));
    layer.height = Math.max(1, Math.round(size.height * size.dpr));
    const c = layer.getContext("2d");
    if (!c) return null;
    c.scale(size.dpr, size.dpr);
    c.drawImage(plate, place.x, place.y, place.width, place.height);
    c.globalCompositeOperation = "destination-in";
    const bottomEnd = Math.min(size.height, place.y + place.height);
    const fade = c.createLinearGradient(0, bottomEnd - size.height * 0.42, 0, bottomEnd);
    fade.addColorStop(0, "rgba(0,0,0,1)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = fade;
    c.fillRect(0, 0, size.width, size.height);
    if (place.beside) {
      const edge = c.createLinearGradient(place.x, 0, place.x + place.width * 0.34, 0);
      edge.addColorStop(0, "rgba(0,0,0,0)");
      edge.addColorStop(1, "rgba(0,0,0,1)");
      c.fillStyle = edge;
      c.fillRect(0, 0, size.width, size.height);
    }
    return layer;
  };

  const drawDoor = (c: CanvasRenderingContext2D, level: number) => {
    const gapLeft = platePoint(place, PLATE_POINTS.gapLeft, PLATE_POINTS.doorTop);
    const gapRight = platePoint(place, PLATE_POINTS.gapRight, PLATE_POINTS.doorBottom);
    const gapWidth = gapRight.x - gapLeft.x;
    const gapHeight = gapRight.y - gapLeft.y;
    if (state === "ajar") {
      c.save();
      c.globalCompositeOperation = "screen";
      const light = c.createLinearGradient(gapLeft.x, 0, gapRight.x, 0);
      light.addColorStop(0, `rgba(232, 180, 94, ${0.2 + 0.2 * level})`);
      light.addColorStop(1, "rgba(232, 180, 94, 0.02)");
      c.fillStyle = light;
      c.fillRect(gapLeft.x, gapLeft.y, gapWidth, gapHeight);
      c.restore();
      return;
    }
    // A shut door: the leaf is carried across the gap in the plate's own grey.
    const leaf = c.createLinearGradient(gapLeft.x, 0, gapRight.x, 0);
    leaf.addColorStop(0, "#3d3833");
    leaf.addColorStop(1, "#2a2622");
    c.fillStyle = leaf;
    c.fillRect(gapLeft.x, gapLeft.y, gapWidth, gapHeight);
    c.strokeStyle = "rgba(0, 0, 0, 0.55)";
    c.lineWidth = Math.max(1, place.width / 900);
    c.beginPath();
    c.moveTo(gapLeft.x, gapLeft.y);
    c.lineTo(gapLeft.x, gapRight.y);
    c.stroke();
  };

  const drawLamp = (c: CanvasRenderingContext2D, level: number) => {
    const lamp = platePoint(place, PLATE_POINTS.lampX, PLATE_POINTS.lampY);
    const radius = place.width * 0.16;
    c.save();
    c.globalCompositeOperation = "screen";
    const glow = c.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, radius);
    glow.addColorStop(0, `rgba(232, 180, 94, ${0.42 * level})`);
    glow.addColorStop(0.28, `rgba(232, 180, 94, ${0.14 * level})`);
    glow.addColorStop(1, "rgba(232, 180, 94, 0)");
    c.fillStyle = glow;
    c.fillRect(lamp.x - radius, lamp.y - radius, radius * 2, radius * 2);
    c.restore();
  };

  const drawMist = (c: CanvasRenderingContext2D, t: number) => {
    c.save();
    for (let i = 0; i < 3; i += 1) {
      const drift = noise(t * 0.03, i * 7.3);
      const x = place.x + place.width * (0.25 + i * 0.25 + drift * 0.14);
      const y = place.y + place.height * (0.55 + i * 0.012);
      const rx = place.width * 0.42;
      const gradient = c.createRadialGradient(x, y, 0, x, y, rx);
      gradient.addColorStop(0, "rgba(190, 186, 180, 0.075)");
      gradient.addColorStop(1, "rgba(190, 186, 180, 0)");
      c.fillStyle = gradient;
      c.fillRect(x - rx, y - rx, rx * 2, rx * 2);
    }
    c.restore();
  };

  const drawRipples = (c: CanvasRenderingContext2D, dt: number) => {
    c.save();
    c.lineWidth = 0.8;
    for (let i = 0; i < ripples.length; i += 1) {
      const ripple = ripples[i];
      ripple.age += dt;
      if (ripple.age > ripple.life) {
        ripples[i] = spawnRipple();
        ripples[i].age = 0;
        continue;
      }
      const phase = ripple.age / ripple.life;
      const point = platePoint(place, ripple.nx, ripple.ny);
      const rx = (ripple.size * phase * place.width) / 500;
      c.strokeStyle = `rgba(220, 216, 208, ${0.26 * (1 - phase)})`;
      c.beginPath();
      c.ellipse(point.x, point.y, rx, rx * 0.34, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  };

  const drawRain = (c: CanvasRenderingContext2D, dt: number) => {
    c.save();
    c.lineCap = "round";
    BANDS.forEach((alpha, band) => {
      c.strokeStyle = `rgba(205, 208, 214, ${alpha})`;
      c.lineWidth = band === 2 ? 1.1 : 0.8;
      c.beginPath();
      for (const streak of streaks) {
        if (streak.band !== band) continue;
        streak.y += streak.speed * dt;
        streak.x -= streak.speed * dt * 0.06;
        if (streak.y > size.height + streak.length) {
          streak.y = -streak.length;
          streak.x = rng() * (size.width + 60);
        }
        if (streak.x < -10) streak.x += size.width + 20;
        c.moveTo(streak.x, streak.y);
        c.lineTo(streak.x - streak.length * 0.06, streak.y + streak.length);
      }
      c.stroke();
    });
    c.restore();
  };

  const paint = (c: CanvasRenderingContext2D, t: number, dt: number) => {
    c.fillStyle = BACKGROUND;
    c.fillRect(0, 0, size.width, size.height);
    const plateAlpha = 1 - 0.86 * dim;
    if (plateLayer && plateAlpha > 0.01) {
      c.save();
      c.globalAlpha = plateAlpha;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(plateLayer, 0, 0);
      c.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      c.restore();
      c.save();
      c.globalAlpha = plateAlpha;
      const level = state === "after" ? 0 : lampLevel(noise(t * 0.55, 3.1));
      drawDoor(c, level);
      if (state !== "after") {
        drawLamp(c, level);
        drawRipples(c, dt);
      }
      drawMist(c, t);
      c.restore();
    }
    if (raining) drawRain(c, dt);
  };

  const scene = createScene({
    canvas,
    container: mount,
    dprCap: 1.5,
    render(c, frame: Readonly<SceneFrame>) {
      if (!still) paint(c, frame.t, frame.dt);
    },
    resize(next, c) {
      size = { width: next.width, height: next.height, dpr: next.dpr };
      place = placePlate(next.width, next.height);
      plateLayer = buildPlateLayer();
      const count = rainCount(next.width, next.height, raining);
      streaks = Array.from({ length: count }, () => ({
        x: rng() * (next.width + 60),
        y: rng() * next.height,
        length: 10 + rng() * 22,
        speed: 380 + rng() * 360,
        band: Math.floor(rng() * BANDS.length),
      }));
      ripples = Array.from({ length: next.width < 700 ? 8 : 14 }, spawnRipple);
      if (still) paint(c, 0, 0);
    },
    reducedMotionFrame(c) {
      paint(c, 0, 0);
    },
  });

  const repaintStill = () => {
    if (!still && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = canvas.getContext("2d");
    if (c) paint(c, 0, 0);
  };

  let scrollFrame = 0;
  const onScroll = () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      dim = scrollDim(window.scrollY, window.innerHeight);
      repaintStill();
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  if (!still) scene.start();
  else repaintStill();

  return {
    setStill(next) {
      if (next === still) return;
      still = next;
      if (still) {
        scene.stop();
        repaintStill();
      } else {
        scene.start();
      }
    },
    destroy() {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(scrollFrame);
      scene.destroy();
      canvas.remove();
    },
  };
}
