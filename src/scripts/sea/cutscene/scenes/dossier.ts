// Arc 3 "dossier" (~7.5s). Rain stops in mid-air and dries into ochre dust:
// the capital's dry ground. A ministry file slides under the lamp, its lines
// redacted; a copper-red stamp comes down; then the bar over the subject line
// burns away along a ragged ember edge and the subject reads out. All file
// text is server-rendered in ArcCutscene.astro for this arc only.
import type { SceneContext, SceneHandle } from "../registry";

interface Drop {
  x: number;
  y: number;
  len: number;
  speed: number;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
}

const STAMP_AT = 3.5;
const BURN_AT = 4.35;
const BURN_S = 1.35;
const EXIT_AT = 6.45;

export function play({ stage, sfx, gsap }: SceneContext): SceneHandle {
  const dialog = stage.closest("dialog") as HTMLElement;
  const air = stage.querySelector<HTMLCanvasElement>(".sea-ds-air");
  const desk = stage.querySelector<HTMLElement>(".sea-ds-desk");
  const file = stage.querySelector<HTMLElement>(".sea-ds-file");
  const stamp = stage.querySelector<HTMLElement>(".sea-ds-stamp");
  const burnCanvas = stage.querySelector<HTMLCanvasElement>(".sea-ds-burn");
  const ctx = air?.getContext("2d");
  const burn = burnCanvas?.getContext("2d");
  if (!air || !desk || !file || !stamp || !burnCanvas || !ctx || !burn) {
    throw new Error("dossier: stage markup incomplete");
  }

  const w = stage.clientWidth;
  const h = stage.clientHeight;
  const unit = Math.min(w, h);
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  air.width = Math.round(w * dpr);
  air.height = Math.round(h * dpr);
  ctx.scale(dpr, dpr);

  // Redaction bar over the subject, drawn at full strength before first paint.
  const bw = burnCanvas.offsetWidth;
  const bh = burnCanvas.offsetHeight;
  burnCanvas.width = Math.round(bw * dpr);
  burnCanvas.height = Math.round(bh * dpr);
  burn.scale(dpr, dpr);
  const ROW = 2;
  const rows = Math.ceil(bh / ROW);
  const ragged = Array.from({ length: rows }, (_, i) => Math.sin(i * 0.9) * 0.45 + Math.sin(i * 2.3 + 1.7) * 0.3 + (Math.random() - 0.5) * 0.5);
  const amp = Math.max(8, bh * 0.35);
  const burnState = { p: 0 };
  const drawBar = () => {
    burn.clearRect(0, 0, bw, bh);
    const front = -amp * 1.5 + burnState.p * (bw + amp * 3);
    for (let r = 0; r < rows; r++) {
      const edge = front + ragged[r] * amp;
      const y = r * ROW;
      if (edge < bw) {
        burn.fillStyle = "#0f0e0c";
        burn.fillRect(Math.max(0, edge), y, bw - Math.max(0, edge), ROW);
      }
      if (burnState.p > 0 && burnState.p < 1 && edge > -4 && edge < bw + 4) {
        burn.fillStyle = "rgba(96, 44, 14, 0.4)";
        burn.fillRect(edge - 14, y, 14, ROW);
        burn.fillStyle = "rgba(255, 150, 60, 0.95)";
        burn.fillRect(edge - 2.5, y, 3, ROW);
      }
    }
  };
  drawBar();

  const drops: Drop[] = Array.from({ length: Math.round(Math.min(150, (w * h) / 7000)) }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    len: 12 + Math.random() * 20,
    speed: 560 + Math.random() * 420,
  }));
  const motes: Mote[] = [];
  const weather = { rate: 1, evap: 0, dust: 0 };

  const spawnDust = (x: number, y: number, count: number, force: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = force * (0.3 + Math.random());
      motes.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.6 - force * 0.4,
        r: 0.6 + Math.random() * 1.6,
        alpha: 0.45 + Math.random() * 0.5,
      });
    }
  };

  let evaporated = false;
  let last = 0;
  const render = (time: number) => {
    const dt = last ? Math.min(0.05, time - last) : 0;
    last = time;
    ctx.clearRect(0, 0, w, h);

    if (weather.evap < 1) {
      const fade = 1 - weather.evap;
      for (const d of drops) {
        d.y += d.speed * weather.rate * dt;
        if (d.y - d.len > h) d.y = -d.len;
        // Streaks shorten into beads as the rain stops; held beads catch the light.
        const len = Math.max(3, d.len * weather.rate);
        ctx.strokeStyle = `rgba(196, 216, 240, ${(0.34 + 0.3 * (1 - weather.rate)) * fade})`;
        ctx.lineWidth = 1 + (1 - weather.rate) * 1.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(d.x, d.y - len);
        ctx.lineTo(d.x, d.y);
        ctx.stroke();
        if (weather.rate < 0.3) {
          ctx.fillStyle = `rgba(255, 246, 228, ${0.7 * (1 - weather.rate) * fade})`;
          ctx.fillRect(d.x - 0.6, d.y - len + 0.4, 1.2, 1.2);
        }
      }
    }
    if (weather.evap > 0 && !evaporated) {
      evaporated = true;
      for (const d of drops) spawnDust(d.x, d.y, 2, unit * 0.012);
    }
    for (const m of motes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.vx *= 0.985;
      m.vy = m.vy * 0.985 - unit * 0.004 * dt;
      ctx.fillStyle = `rgba(206, 156, 84, ${m.alpha * weather.dust})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  gsap.ticker.add(render);

  const tl = gsap.timeline();
  gsap.set(file, { y: h, rotation: 6, autoAlpha: 0 });
  gsap.set(stamp, { opacity: 0, scale: 1.6 });

  tl.fromTo(stage, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power1.out" }, 0);
  if (sfx) tl.call(() => sfx.noise({ duration: 1.6, filter: "highpass", frequency: 2400, level: 0.35, attack: 0.3 }), [], 0);
  // Rain holds still in the air, then dries into dust.
  tl.to(weather, { rate: 0, duration: 0.9, ease: "power3.out" }, 0.5);
  tl.to(weather, { evap: 1, duration: 1.4, ease: "power1.inOut" }, 1.5);
  tl.to(weather, { dust: 1, duration: 1.2, ease: "power1.out" }, 1.5);
  tl.to(desk, { opacity: 1, duration: 1.8, ease: "power1.inOut" }, 1.2);

  tl.to(file, { y: 0, rotation: -1.5, autoAlpha: 1, duration: 1.1, ease: "power3.out" }, 2.3);
  if (sfx) tl.call(() => sfx.noise({ duration: 0.5, filter: "bandpass", frequency: 900, level: 0.3, attack: 0.15 }), [], 2.35);

  // The stamp comes down.
  tl.to(stamp, { opacity: 0.92, scale: 1, duration: 0.16, ease: "power4.in" }, STAMP_AT);
  tl.to(file, {
    keyframes: [
      { x: 2, y: 1.5, duration: 0.05 },
      { x: -2, y: -1, duration: 0.05 },
      { x: 1, y: 0.5, duration: 0.05 },
      { x: 0, y: 0, duration: 0.06 },
    ],
  }, STAMP_AT + 0.16);
  tl.call(() => {
    const box = stamp.getBoundingClientRect();
    const origin = stage.getBoundingClientRect();
    spawnDust(box.left + box.width / 2 - origin.left, box.bottom - origin.top, 26, unit * 0.09);
  }, [], STAMP_AT + 0.16);
  if (sfx) {
    tl.call(() => {
      sfx.noise({ duration: 0.4, filter: "lowpass", frequency: 150, level: 1 });
      sfx.tone(68, { duration: 0.35, level: 0.8 });
    }, [], STAMP_AT + 0.14);
  }

  // The redaction over the subject burns off.
  tl.to(burnState, { p: 1, duration: BURN_S, ease: "power1.inOut", onUpdate: drawBar }, BURN_AT);
  if (sfx) tl.call(() => sfx.noise({ duration: 1.3, filter: "highpass", frequency: 3200, level: 0.3, attack: 0.1 }), [], BURN_AT);

  // Exit: the file is drawn away and the room thins onto the page.
  tl.to(file, { y: -h * 0.12, opacity: 0, duration: 0.9, ease: "power2.in" }, EXIT_AT);
  tl.to(dialog, { opacity: 0, duration: 0.9, ease: "power1.inOut" }, EXIT_AT + 0.15);

  return {
    timeline: tl,
    dispose() {
      gsap.ticker.remove(render);
      // The dialog stays in the DOM; free the canvas backing stores.
      for (const canvas of [air, burnCanvas]) canvas.width = canvas.height = 0;
    },
  };
}
