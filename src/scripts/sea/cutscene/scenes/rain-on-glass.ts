// Arc 1 "rain-on-glass" (~8.2s). A night window over the blurred lamps of
// Elaris. The rain slows; three drops on the pane swell and glow to the
// three-note lullaby of chapter 1, "ขึ้น ขึ้น ลง" (up, up, down: the drops sit
// at those pitches); then they run down the glass, clearing trails in the
// condensation, and the arc title surfaces outward from the trails, one
// grapheme at a time. A diagonal wipe clears the pane onto the page.
import { renderSplitTitle } from "../graphemes";
import type { SceneContext, SceneHandle } from "../registry";

// x as a fraction of the title width, lift above the title as a fraction of
// the viewport height (higher pitch sits higher), note in Hz.
const NOTES = [
  { x: 0.1, lift: 0.26, hz: 659.25 },
  { x: 0.52, lift: 0.36, hz: 783.99 },
  { x: 0.92, lift: 0.17, hz: 523.25 },
] as const;

const BEAT = 0.62;
const PULSE_AT = 1.45;
const RUN_AT = PULSE_AT + BEAT * 3 + 0.25;
const RUN_S = 1.7;
const RUN_STAGGER = 0.22;
const WIPE_AT = 6.55;
const WIPE_S = 1.6;

interface Drop {
  el: HTMLElement;
  ring: HTMLElement | null;
  x: number;
  y: number;
  lastY: number;
  scale: number;
  stretch: number;
  running: boolean;
  phase: number;
}

export function play({ stage, titleEl, arcLabelEl, sfx, gsap }: SceneContext): SceneHandle {
  const dialog = stage.closest("dialog") as HTMLElement;
  const rainCanvas = stage.querySelector<HTMLCanvasElement>(".sea-rog-rain");
  const fogCanvas = stage.querySelector<HTMLCanvasElement>(".sea-rog-fog");
  const city = stage.querySelector<HTMLElement>(".sea-rog-city");
  const dropEls = Array.from(stage.querySelectorAll<HTMLElement>(".sea-rog-drop"));
  const rain = rainCanvas?.getContext("2d");
  const fog = fogCanvas?.getContext("2d");
  if (!rainCanvas || !fogCanvas || !rain || !fog || dropEls.length < NOTES.length) {
    throw new Error("rain-on-glass: stage markup incomplete");
  }

  const split = renderSplitTitle(titleEl);
  // One layout read for the whole scene.
  const stageBox = stage.getBoundingClientRect();
  const titleBox = titleEl.getBoundingClientRect();
  const centers = split.graphemes.map((g) => {
    const box = g.getBoundingClientRect();
    return box.left + box.width / 2 - stageBox.left;
  });
  const w = stageBox.width;
  const h = stageBox.height;
  const unit = Math.min(w, h);
  const titleY = titleBox.top + titleBox.height / 2 - stageBox.top;
  const titleLeft = titleBox.left - stageBox.left;
  const titleWidth = Math.max(titleBox.width, unit * 0.3);

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  for (const canvas of [rainCanvas, fogCanvas]) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  rain.scale(dpr, dpr);
  fog.scale(dpr, dpr);

  // Condensation with droplets beaded on the glass.
  const haze = fog.createLinearGradient(0, 0, 0, h);
  haze.addColorStop(0, "rgba(160, 178, 200, 0.13)");
  haze.addColorStop(0.55, "rgba(146, 162, 186, 0.18)");
  haze.addColorStop(1, "rgba(120, 136, 160, 0.26)");
  fog.fillStyle = haze;
  fog.fillRect(0, 0, w, h);
  const beads = Math.round(Math.min(420, (w * h) / 3200));
  for (let i = 0; i < beads; i++) {
    const r = 0.5 + Math.random() ** 3 * unit * 0.006;
    const x = Math.random() * w;
    const y = Math.random() * h;
    fog.fillStyle = "rgba(6, 10, 16, 0.32)";
    fog.beginPath();
    fog.arc(x, y + r * 0.3, r, 0, Math.PI * 2);
    fog.fill();
    fog.fillStyle = "rgba(200, 214, 232, 0.22)";
    fog.beginPath();
    fog.arc(x, y, r * 0.8, 0, Math.PI * 2);
    fog.fill();
    fog.fillStyle = "rgba(255, 238, 214, 0.42)";
    fog.beginPath();
    fog.arc(x - r * 0.3, y - r * 0.3, Math.max(0.4, r * 0.25), 0, Math.PI * 2);
    fog.fill();
  }

  // Rain outside the glass.
  const streakCount = Math.round(Math.min(130, (w * h) / 9000));
  const streaks = Array.from({ length: streakCount }, () => ({
    x: Math.random() * w * 1.1,
    y: Math.random() * h,
    len: 14 + Math.random() * 34,
    speed: 520 + Math.random() * 480,
    alpha: 0.12 + Math.random() * 0.22,
  }));
  const motion = { rate: 1 };

  const size = Math.round(Math.max(20, Math.min(34, unit * 0.045)));
  const drops: Drop[] = NOTES.map((note, i) => {
    const el = dropEls[i];
    el.style.setProperty("--rog-size", `${size}px`);
    return {
      el,
      ring: el.querySelector("i"),
      x: titleLeft + note.x * titleWidth,
      y: titleY - note.lift * h,
      lastY: titleY - note.lift * h,
      scale: 0,
      stretch: 1,
      running: false,
      phase: Math.random() * Math.PI * 2,
    };
  });

  let last = 0;
  const render = (time: number) => {
    const dt = last ? Math.min(0.05, time - last) : 0;
    last = time;

    rain.clearRect(0, 0, w, h);
    rain.lineWidth = 1;
    rain.lineCap = "round";
    for (const s of streaks) {
      s.y += s.speed * motion.rate * dt;
      s.x -= s.speed * motion.rate * dt * 0.12;
      if (s.y - s.len > h) {
        s.y = -s.len;
        s.x = Math.random() * w * 1.1;
      }
      rain.strokeStyle = `rgba(196, 214, 236, ${s.alpha})`;
      rain.beginPath();
      rain.moveTo(s.x, s.y);
      rain.lineTo(s.x + s.len * 0.12, s.y - s.len * Math.max(0.25, motion.rate));
      rain.stroke();
    }

    fog.globalCompositeOperation = "destination-out";
    fog.lineCap = "round";
    fog.shadowColor = "#000";
    fog.shadowBlur = 5;
    for (const d of drops) {
      const wobble = d.running ? Math.sin(d.y * 0.03 + d.phase) * unit * 0.0022 : 0;
      if (d.running && d.y > d.lastY) {
        fog.lineWidth = size * 0.62;
        fog.beginPath();
        fog.moveTo(d.x + wobble, d.lastY);
        fog.lineTo(d.x + wobble, d.y);
        fog.stroke();
      }
      d.lastY = d.y;
      d.el.style.transform = `translate(${d.x + wobble - size / 2}px, ${d.y - size / 2}px) scale(${d.scale}, ${d.scale * d.stretch})`;
    }
    fog.globalCompositeOperation = "source-over";
    fog.shadowBlur = 0;
  };
  gsap.ticker.add(render);

  const tl = gsap.timeline();
  gsap.set(split.graphemes, { opacity: 0, y: "-0.14em", filter: "blur(7px)" });
  gsap.set(arcLabelEl, { opacity: 0 });

  tl.fromTo(stage, { opacity: 0 }, { opacity: 1, duration: 1, ease: "power1.inOut" }, 0);
  if (city) tl.fromTo(city, { scale: 1.1 }, { scale: 1, duration: 8, ease: "none" }, 0);
  tl.to(motion, { rate: 0.15, duration: 2.4, ease: "power2.out" }, 0.3);
  if (sfx) tl.call(() => sfx.noise({ duration: 3.2, filter: "highpass", frequency: 2600, level: 0.35, attack: 0.8 }), [], 0.05);

  drops.forEach((d, i) => {
    tl.to(d.el, { opacity: 1, duration: 0.5 }, 0.8 + i * 0.14);
    tl.to(d, { scale: 0.72, duration: 0.7, ease: "power2.out" }, 0.8 + i * 0.14);

    // The drop sounds its note: swell, glow, ripple.
    const at = PULSE_AT + i * BEAT;
    tl.to(d, { scale: 1.22, duration: 0.24, ease: "power2.out" }, at);
    tl.to(d, { scale: 1, duration: 0.9, ease: "sine.inOut" }, at + 0.24);
    tl.fromTo(d.el, { "--glow": 0 }, { "--glow": 1, duration: 0.24, ease: "power2.out" }, at);
    tl.to(d.el, { "--glow": 0.35, duration: 1.1, ease: "sine.inOut" }, at + 0.24);
    if (d.ring) {
      tl.fromTo(d.ring, { scale: 0.4, opacity: 0.8 }, { scale: 2.6, opacity: 0, duration: 1.3, ease: "power2.out", immediateRender: false }, at);
    }
    if (sfx) tl.call(() => sfx.tone(NOTES[i].hz, { duration: 1.6, level: 0.7 }), [], at);

    // Run down the pane.
    const start = RUN_AT + i * RUN_STAGGER;
    tl.call(() => {
      d.running = true;
    }, [], start);
    tl.to(d, { stretch: 1.35, duration: 0.4, ease: "power1.in" }, start);
    tl.to(d, { y: h + size * 2, duration: RUN_S, ease: "power2.in" }, start);
  });

  // Each grapheme surfaces when the nearest trail has crossed the title line,
  // later the further it sits from that trail.
  const spread = unit * 0.85;
  split.graphemes.forEach((g, index) => {
    let at = Infinity;
    drops.forEach((d, i) => {
      const startY = titleY - NOTES[i].lift * h;
      const fraction = Math.min(1, Math.max(0, (titleY - startY) / (h + size * 2 - startY)));
      const cross = RUN_AT + i * RUN_STAGGER + RUN_S * Math.sqrt(fraction);
      at = Math.min(at, cross + Math.abs(centers[index] - d.x) / spread);
    });
    tl.to(g, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.85, ease: "power2.out" }, Math.min(at, WIPE_AT - 1.4));
  });
  tl.to(arcLabelEl, { opacity: 1, duration: 1, ease: "power1.out" }, 5.2);

  tl.call(() => {
    dialog.dataset.wiping = "";
  }, [], WIPE_AT);
  tl.fromTo(dialog, { "--rog-wipe": "0%" }, { "--rog-wipe": "112%", duration: WIPE_S, ease: "power2.inOut" }, WIPE_AT);
  tl.to({}, { duration: 0.05 }, WIPE_AT + WIPE_S);

  return {
    timeline: tl,
    dispose() {
      gsap.ticker.remove(render);
      // The dialog stays in the DOM; free the viewport-sized backing stores.
      for (const canvas of [rainCanvas, fogCanvas]) canvas.width = canvas.height = 0;
      delete dialog.dataset.wiping;
      dialog.style.removeProperty("--rog-wipe");
      split.restore();
    },
  };
}
