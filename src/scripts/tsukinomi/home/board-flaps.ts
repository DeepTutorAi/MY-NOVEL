// The departure board's split-flap motion and its station clock (home concourse).
//
//   flaps   the first time the board comes into view, every digit card of the
//           reading-time column flips through a run of digits and lands on its
//           own value, row by row, the way a station board settles. The text
//           that is there before and after is the same text: the cells are
//           aria-hidden decoration (the row says the reading time in words).
//   clock   the board's header shows the reader's own time, HH:MM, kept to the
//           minute. Decoration too: aria-hidden.
//
// Under prefers-reduced-motion nothing flips (the clock still tells the time,
// it changes once a minute). The DOM half runs through onPage on Tsukinomi
// pages that have a board, and removes every observer, timer and listener on
// astro:before-swap.
import { onPage } from "../../_shared/lifecycle";

export const FLAP_DIGITS = "0123456789";
/** Milliseconds a card shows each digit while it flips. */
export const FLAP_STEP_MS = 55;
/** Rows start this far apart, top to bottom. */
export const ROW_STAGGER_MS = 110;

/**
 * The digits a card shows on its way to `target`, ending on it. Cards that are
 * not digits (the colon, the dashes of the last train) never flip. Later cards
 * in a row take a few more steps, so a row settles from left to right.
 */
export function flapFrames(target: string, column: number, random: () => number): string[] {
  if (!FLAP_DIGITS.includes(target) || target.length !== 1) return [target];
  const steps = 5 + Math.max(0, Math.floor(column)) * 2 + Math.floor(clamp01(random()) * 4);
  const frames: string[] = [];
  for (let i = 0; i < steps; i++) frames.push(FLAP_DIGITS[Math.floor(clamp01(random()) * 9.999)]);
  frames.push(target);
  return frames;
}

/** The board clock: 24-hour HH:MM of a date, or the last train's dashes for an invalid one. */
export function formatClock24(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "--:--";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Milliseconds from `date` to the start of the next minute (at least 250, so a timer never spins). */
export function msToNextMinute(date: Date): number {
  const ms = 60_000 - (date.getSeconds() * 1000 + date.getMilliseconds());
  return Math.max(250, ms);
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.9999) : 0.5;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function setupBoardFlaps(): (() => void) | void {
  const board = document.querySelector<HTMLElement>("[data-board]");
  if (!board) return undefined;
  const cleanups: Array<() => void> = [];
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  cleanups.push(() => {
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
  });

  // ---- clock ----------------------------------------------------------------------
  const clock = board.querySelector<HTMLElement>("[data-board-now]");
  if (clock) {
    const tick = () => {
      const now = new Date();
      clock.textContent = formatClock24(now);
      later(tick, msToNextMinute(now));
    };
    tick();
  }

  // ---- flaps ------------------------------------------------------------------------
  const reduced = window.matchMedia(REDUCED_MOTION_QUERY);
  const rows = Array.from(board.querySelectorAll<HTMLElement>("[data-flaps]"));
  if (!reduced.matches && rows.length > 0 && typeof IntersectionObserver !== "undefined") {
    const flip = () => {
      rows.forEach((row, rowIndex) => {
        const cards = Array.from(row.querySelectorAll<HTMLElement>("[data-flap]"));
        cards.forEach((card, column) => {
          const target = card.dataset.flap ?? card.textContent ?? "";
          const frames = flapFrames(target, column, Math.random);
          if (frames.length === 1) return;
          frames.forEach((glyph, step) => {
            later(() => {
              card.textContent = glyph;
              // Restart the fold: the class comes off and goes back on in the next frame.
              card.classList.remove("is-flipping");
              void card.offsetWidth;
              card.classList.add("is-flipping");
              if (step === frames.length - 1) later(() => card.classList.remove("is-flipping"), FLAP_STEP_MS * 2);
            }, rowIndex * ROW_STAGGER_MS + step * FLAP_STEP_MS);
          });
        });
      });
    };
    const seen = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        seen.disconnect();
        flip();
      },
      { threshold: 0.2 },
    );
    seen.observe(board);
    cleanups.push(() => seen.disconnect());
    // Leaving mid-flip puts every card back on its own value.
    cleanups.push(() => {
      for (const card of board.querySelectorAll<HTMLElement>("[data-flap]")) {
        card.textContent = card.dataset.flap ?? card.textContent;
        card.classList.remove("is-flipping");
      }
    });
  }

  return () => {
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  };
}

onPage("tsukinomi-board-flaps", { bodyClass: "tsukinomi-page" }, setupBoardFlaps);
