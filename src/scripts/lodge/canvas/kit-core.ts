// Pure geometry of the Lodge canvas kit (design section 4.4), tested without a canvas.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where an image of srcW x srcH lands when it covers dstW x dstH, centred. */
export function coverRect(srcW: number, srcH: number, dstW: number, dstH: number): Rect {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}

/** A point given as fractions of the plate, in canvas pixels. */
export function platePoint(rect: Rect, u: number, v: number): { x: number; y: number } {
  return { x: rect.x + rect.w * u, y: rect.y + rect.h * v };
}

/**
 * Smoothstep from 0 to 1 over `durationS`. Large luminance changes run through
 * this with durationS >= 1 so they never count as a flash (WCAG 2.3.1).
 */
export function luminanceRamp(tS: number, durationS: number): number {
  const x = Math.min(1, Math.max(0, tS / durationS));
  return x * x * (3 - 2 * x);
}
