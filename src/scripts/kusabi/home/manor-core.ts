// Geometry of the home scene, kept pure for tests. The plate is the approved
// chapter 3 illustration (1024 x 1536); positions below are fractions of it.

export const PLATE_RATIO = 1024 / 1536;

/** Door leaf, the dark gap beside it, the iron lamp over them, and the forecourt water. */
export const PLATE_POINTS = {
  doorLeft: 492 / 1024,
  gapLeft: 535 / 1024,
  gapRight: 558 / 1024,
  doorTop: 705 / 1536,
  doorBottom: 820 / 1536,
  lampX: 525 / 1024,
  lampY: 682 / 1536,
  doorCentreY: 762 / 1536,
} as const;

export interface PlatePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  /** True when the copy sits beside the plate and its left edge must fade. */
  beside: boolean;
}

export function placePlate(viewWidth: number, viewHeight: number): PlatePlacement {
  const beside = viewWidth / Math.max(1, viewHeight) >= 1.05;
  if (beside) {
    let height = viewHeight * 1.22;
    let width = height * PLATE_RATIO;
    const widest = viewWidth * 0.68;
    if (width > widest) {
      width = widest;
      height = width / PLATE_RATIO;
    }
    return {
      x: viewWidth - width,
      y: viewHeight * 0.46 - PLATE_POINTS.doorCentreY * height,
      width,
      height,
      beside,
    };
  }
  const width = viewWidth * 1.12;
  const height = width / PLATE_RATIO;
  return {
    x: (viewWidth - width) / 2,
    y: Math.min(0, viewHeight * 0.3 - PLATE_POINTS.doorCentreY * height),
    width,
    height,
    beside,
  };
}

export function platePoint(place: PlatePlacement, nx: number, ny: number): { x: number; y: number } {
  return { x: place.x + nx * place.width, y: place.y + ny * place.height };
}

/** Drops on screen: never zero while it rains, and light enough for a phone. */
export function rainCount(viewWidth: number, viewHeight: number, raining: boolean): number {
  if (!raining) return 0;
  return Math.round(Math.min(240, Math.max(70, (viewWidth * viewHeight) / 8000)));
}

/** How far the plate has sunk into the dark as the page scrolls to the shelf. */
export function scrollDim(scrollY: number, viewHeight: number): number {
  if (viewHeight <= 0) return 0;
  return Math.min(1, Math.max(0, scrollY / (viewHeight * 0.85)));
}

/** A lamp that breathes and sometimes dips; `n` is noise in [-1, 1]. */
export function lampLevel(n: number): number {
  const base = 0.74 + 0.16 * n;
  return n < -0.72 ? base * 0.55 : base;
}
