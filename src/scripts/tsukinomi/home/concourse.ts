// Client half of the /tsukinomi/ home concourse (design 4.4); the rules live in
// concourse-core.ts. It does four things on the home page and nothing anywhere
// else:
//
//   marks     reads the reader's read marks and progress from localStorage and
//             shows them: each board row's state, the marker on the rail
//   board     settles the departure board's rows into view the first time it
//             scrolls into sight
//   rail      draws the rail line as the reader scrolls past it, lights its
//             stations, and tints the page with the palette of the part under
//             the line's head (--tint-* on the tint layer, --rail-* on the rail)
//   mode      publishes data-motion and data-direct on the root so the passing
//             train reads the same switches
//
// Nothing animates without a reason to: under prefers-reduced-motion the board
// stays in its final state, the rail is fully drawn and the page is untinted;
// in the short-landscape layout the board is shown directly. Scrolling work runs
// only while the rail is within a screen of the viewport (IntersectionObserver
// gates a requestAnimationFrame-throttled scroll listener).
//
// Lifecycle: onPage (src/scripts/_shared/lifecycle.ts) sets this up on every
// Tsukinomi page that has the concourse and tears it down on astro:before-swap,
// so a ClientRouter navigation leaves no observer, listener or frame behind.
import { onPage } from "../../_shared/lifecycle";
import {
  PALETTE_TOKEN,
  RAIL_VERTICAL_QUERY,
  SHORT_LANDSCAPE_QUERY,
  STATE_TEXT,
  TINT_MAX_ALPHA,
  markerStation,
  railProgress,
  railState,
  readStateFromStorage,
  tintAt,
  type Palette,
  type ReadUnit,
} from "./concourse-core";
import { startTrain } from "./train-loader";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/** The board settles once this much of it has come into view. */
const SETTLE_VISIBLE = 0.1;
/** The board is only armed when it starts below this fraction of the viewport. */
const ARM_BELOW = 0.85;
/** The line starts to draw when the rail's top rises above this fraction of the viewport. */
const DRAW_START = 0.75;
/** The horizontal rail is short, so it takes this share of a viewport of scrolling to draw. */
const HORIZONTAL_TRAVEL = 0.45;

function storageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** color-mix() is Chrome 111, Safari 16.2, Firefox 113; the tint layer simply stays plain where it is missing. */
const supportsColorMix = () =>
  typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("color", "color-mix(in srgb, red 50%, blue)");

const tokenOf = (palette: string | undefined) => PALETTE_TOKEN[palette as Palette] ?? PALETTE_TOKEN.autumn;

export function setupConcourse(): (() => void) | void {
  const root = document.querySelector<HTMLElement>("[data-concourse]");
  if (!root) return undefined;

  const board = root.querySelector<HTMLElement>("[data-board]");
  const rail = root.querySelector<HTMLElement>("[data-rail]");
  const tint = document.querySelector<HTMLElement>("[data-concourse-tint]");
  const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-board] [data-section-id]"));
  const stations = Array.from(root.querySelectorAll<HTMLElement>("[data-rail] [data-part]"));
  const cleanups: Array<() => void> = [];

  // ---- marks: what the reader has read -------------------------------------
  const units: ReadUnit[] = rows
    .map((row) => ({ id: row.dataset.sectionId ?? "", number: Number(row.dataset.part) }))
    .filter((unit) => unit.id !== "" && Number.isInteger(unit.number));
  const state = readStateFromStorage(storageOrNull(), units);

  for (const row of rows) {
    const status = state.status[Number(row.dataset.part)] ?? "unread";
    row.dataset.state = status;
    const words = row.querySelector<HTMLElement>("[data-board-state]");
    if (!words) continue;
    words.textContent = status === "unread" ? "" : STATE_TEXT[status];
    words.hidden = status === "unread";
  }
  root.dataset.furthestRead = state.furthestRead === null ? "" : String(state.furthestRead);
  root.dataset.furthestOpened = state.furthestOpened === null ? "" : String(state.furthestOpened);
  const marked = markerStation(state.furthestRead, stations.length);
  if (marked !== null) stations[marked]?.setAttribute("data-marker", "");

  // ---- mode: the switches the train reads too ----------------------------------
  const reducedQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  const directQuery = window.matchMedia(SHORT_LANDSCAPE_QUERY);
  // Crossing it turns the rail from horizontal (short, stretched over a minimum travel) to vertical.
  const verticalQuery = window.matchMedia(RAIL_VERTICAL_QUERY);

  const canMix = supportsColorMix();
  let lastFill = -1;
  let lastTintKey = "";
  const lit: boolean[] = stations.map(() => false);

  const render = () => {
    if (!rail) return;
    const reduced = reducedQuery.matches;
    const height = window.innerHeight;
    const rect = rail.getBoundingClientRect();
    // Where the rail will sit when the page is scrolled to its end: the line completes there.
    const scrollLeft = Math.max(0, document.documentElement.scrollHeight - height - window.scrollY);
    const progress = reduced
      ? 1
      : railProgress({ top: rect.top, height: rect.height }, height, {
          anchor: DRAW_START,
          minTravel: verticalQuery.matches ? 0 : height * HORIZONTAL_TRAVEL,
          restTop: rect.top - scrollLeft,
        });
    const rails = railState(progress, stations.length);

    const fill = Number(rails.fill.toFixed(4));
    if (fill !== lastFill) {
      lastFill = fill;
      rail.style.setProperty("--rail-fill", String(fill));
      rail.toggleAttribute("data-complete", fill >= 1);
    }
    stations.forEach((station, index) => {
      if (lit[index] === rails.lit[index]) return;
      lit[index] = rails.lit[index];
      station.toggleAttribute("data-lit", lit[index]);
    });

    // The tint and the line's colour follow the palette under the head.
    const blend = tintAt(progress, stations.length);
    const from = tokenOf(stations[blend.from]?.dataset.palette);
    const to = tokenOf(stations[blend.to]?.dataset.palette);
    const alpha = reduced ? 0 : blend.strength * TINT_MAX_ALPHA;
    const key = `${from}|${to}|${blend.mix.toFixed(3)}|${alpha.toFixed(4)}`;
    if (key === lastTintKey) return;
    lastTintKey = key;
    const mix = String(Number(blend.mix.toFixed(3)));
    rail.style.setProperty(
      "--rail-color",
      canMix ? `color-mix(in srgb, var(${to}) calc(${mix} * 100%), var(${from}))` : `var(${blend.mix < 0.5 ? from : to})`,
    );
    if (tint) {
      tint.style.setProperty("--tint-a", `var(${from})`);
      tint.style.setProperty("--tint-b", `var(${to})`);
      tint.style.setProperty("--tint-mix", mix);
      tint.style.setProperty("--tint-alpha", String(Number(alpha.toFixed(4))));
    }
  };

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      render();
    });
  };

  let scrolling = false;
  const startScrolling = () => {
    if (scrolling) return;
    scrolling = true;
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
  };
  const stopScrolling = () => {
    if (!scrolling) return;
    scrolling = false;
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
  };

  const applyMode = () => {
    root.dataset.motion = reducedQuery.matches ? "reduced" : "full";
    root.toggleAttribute("data-direct", directQuery.matches);
    // Armed means the rail starts undrawn and the script draws it; reduced motion keeps the finished picture.
    rail?.toggleAttribute("data-armed", !reducedQuery.matches);
    lastFill = -1;
    lastTintKey = "";
    schedule();
  };
  const onModeChange = () => applyMode();
  for (const query of [reducedQuery, directQuery, verticalQuery]) {
    query.addEventListener("change", onModeChange);
    cleanups.push(() => query.removeEventListener("change", onModeChange));
  }
  applyMode();
  // The passing train (train-loader.ts): the scene is fetched after first paint and idle, never under reduced motion or in short landscape.
  cleanups.push(startTrain({ mount: document.querySelector<HTMLElement>("[data-train-mount]"), furthestRead: state.furthestRead }));

  // ---- rail: scroll work only while the rail is near the viewport -----------------------
  if (rail && typeof IntersectionObserver !== "undefined") {
    const near = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) startScrolling();
          else stopScrolling();
        }
        // On the way out the head has passed (progress 1) or not yet arrived (0): settle there.
        schedule();
      },
      { rootMargin: "100% 0px 100% 0px" },
    );
    near.observe(rail);
    cleanups.push(() => near.disconnect());
  } else {
    // No observer: keep the scroll handler on and let the rAF throttle do the work.
    startScrolling();
  }
  cleanups.push(stopScrolling);
  cleanups.push(() => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
  });

  // ---- board: settle into view once ---------------------------------------------------------
  if (board && !reducedQuery.matches && !directQuery.matches && typeof IntersectionObserver !== "undefined") {
    if (board.getBoundingClientRect().top > window.innerHeight * ARM_BELOW) {
      board.setAttribute("data-armed", "");
      const settle = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          board.classList.add("is-settled");
          settle.disconnect();
        },
        { threshold: SETTLE_VISIBLE },
      );
      settle.observe(board);
      cleanups.push(() => settle.disconnect());
    }
  }

  return () => {
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  };
}

onPage("tsukinomi-concourse", { bodyClass: "tsukinomi-page" }, setupConcourse);
