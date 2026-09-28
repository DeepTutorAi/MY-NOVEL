// Mid-chapter zone changes. article.sea-chapter declares data-base-zone and
// data-zone-shifts='[{"scene":N,"zone":"..."}]'; as the reader passes
// h2.sea-scene#scene-N the active zone is written to body[data-zone] and
// announced with a window 'sea:zone-change' event.

import { isSeaZone, type SeaZone } from "../../../data/sea/zones";

export interface ZoneShift {
  scene: number;
  zone: SeaZone;
}

// A heading counts as reached once its top passes 45% of the viewport height,
// the bottom edge of the observer band below.
const OBSERVER_MARGIN = "-40% 0px -55% 0px";
const REACHED_LINE = 0.45;

export function parseZoneShifts(raw: string | undefined): ZoneShift[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const shifts: ZoneShift[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const { scene, zone } = item as { scene?: unknown; zone?: unknown };
    if (typeof scene === "number" && Number.isInteger(scene) && scene >= 0 && isSeaZone(zone)) {
      shifts.push({ scene, zone });
    }
  }
  return shifts.sort((a, b) => a.scene - b.scene);
}

/** Zone of the last shift at or before `scene`; `base` before the first shift. */
export function zoneForScene(scene: number, shifts: readonly ZoneShift[], base: SeaZone): SeaZone {
  let zone = base;
  for (const shift of shifts) {
    if (shift.scene > scene) break;
    zone = shift.zone;
  }
  return zone;
}

export function mountZoneShifts(): (() => void) | undefined {
  const article = document.querySelector<HTMLElement>("article.sea-chapter");
  if (!article) return undefined;

  const shifts = parseZoneShifts(article.dataset.zoneShifts);
  if (shifts.length === 0) return undefined;

  const baseAttr = article.dataset.baseZone;
  const bodyZone = document.body.dataset.zone;
  const base = isSeaZone(baseAttr) ? baseAttr : isSeaZone(bodyZone) ? bodyZone : null;
  if (!base) return undefined;

  const sceneOf = new Map<Element, number>();
  for (const heading of article.querySelectorAll<HTMLElement>("h2.sea-scene[id^='scene-']")) {
    const match = /^scene-(\d+)$/.exec(heading.id);
    if (match) sceneOf.set(heading, Number(match[1]));
  }
  if (sceneOf.size === 0) return undefined;

  const reached = new Set<number>();

  const apply = () => {
    let scene = 0;
    for (const n of reached) if (n > scene) scene = n;
    const zone = zoneForScene(scene, shifts, base);
    if (document.body.dataset.zone === zone) return;
    document.body.dataset.zone = zone;
    window.dispatchEvent(new CustomEvent("sea:zone-change", { detail: zone }));
  };

  const mark = (scene: number, top: number, line: number) => {
    if (top < line) reached.add(scene);
    else reached.delete(scene);
  };

  // IntersectionObserver misses headings that jump across the band in one
  // step (anchor jumps, restored scroll), so positions are re-read once
  // scrolling settles.
  const reconcile = () => {
    const line = window.innerHeight * REACHED_LINE;
    for (const [heading, scene] of sceneOf) mark(scene, heading.getBoundingClientRect().top, line);
    apply();
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const scene = sceneOf.get(entry.target);
        if (scene === undefined) continue;
        const line = entry.rootBounds ? entry.rootBounds.bottom : window.innerHeight * REACHED_LINE;
        mark(scene, entry.boundingClientRect.top, line);
      }
      apply();
    },
    { rootMargin: OBSERVER_MARGIN },
  );
  for (const heading of sceneOf.keys()) observer.observe(heading);

  // Debounced rather than scrollend: programmatic per-frame scrolling fires
  // scrollend on every step and would turn the reconcile into a per-frame read.
  let settleTimer = 0;
  const onScroll = () => {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(reconcile, 150);
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  reconcile();

  return () => {
    observer.disconnect();
    window.clearTimeout(settleTimer);
    window.removeEventListener("scroll", onScroll);
  };
}
