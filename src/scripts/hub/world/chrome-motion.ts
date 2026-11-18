// Motion state (spec 2.16, 2.20): html[data-hub-motion], the stored MOTION_KEY and
// hub:motion from the reader's pause choice and the reduced-motion query. The pause
// switch itself lives in chrome-motion-switch.ts, which loads with the picker.

import { MOTION_KEY } from "../theme-core.mjs";
import { emit } from "./bus";
import { bridge } from "./chrome-theme";
import { readLocal, reducedMotionQuery, writeLocal, type Off } from "./chrome-dom";

/** Pause choice kept for this page session when storage cannot be written. */
let sessionPaused: boolean | null = null;
let paused = false;
let lastStill: boolean | null = null;

function storedPaused(): boolean {
  const attr = document.documentElement.dataset.hubMotion;
  if (attr === "still" || attr === "full") return attr === "still";
  return sessionPaused ?? readLocal(MOTION_KEY) === "still";
}

function persistPaused(value: boolean): void {
  sessionPaused = value;
  const api = bridge();
  if (typeof api?.setMotion === "function") {
    try {
      api.setMotion(value);
      return;
    } catch (error) {
      console.error(error);
    }
  }
  writeLocal(MOTION_KEY, value ? "still" : null);
}

function announce(): void {
  const still = paused || reducedMotionQuery().matches;
  if (still === lastStill) return;
  lastStill = still;
  emit("hub:motion", { still });
}

/** The reader's pause choice (the OS setting is separate). */
export const isPaused = () => paused;

export function setPaused(value: boolean): void {
  paused = value;
  document.documentElement.dataset.hubMotion = value ? "still" : "full";
  persistPaused(value);
  announce();
}

export function setupMotion(): Off {
  const query = reducedMotionQuery();
  paused = storedPaused();
  lastStill = null;
  document.documentElement.dataset.hubMotion = paused ? "still" : "full";
  query.addEventListener("change", announce);
  announce();
  return () => query.removeEventListener("change", announce);
}
