import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createNoise2D } from "../_shared/scene-runtime";
import { flareSprite, mistTile, radialSprite, type Surface } from "./scene-paint";

/** A 2D context that accepts every call the sprite painters make. */
function fakeSurface(w: number, h: number): Surface {
  const gradient = { addColorStop() {} };
  const g = {
    globalCompositeOperation: "source-over",
    fillStyle: "",
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    createImageData: (iw: number, ih: number) => ({ data: new Uint8ClampedArray(iw * ih * 4), width: iw, height: ih }),
    putImageData() {},
    fillRect() {},
    translate() {},
    rotate() {},
    beginPath() {},
    moveTo() {},
    quadraticCurveTo() {},
    fill() {},
  };
  return { canvas: { width: w, height: h } as HTMLCanvasElement, g: g as unknown as CanvasRenderingContext2D };
}

describe("scene-paint: sprites through a caller's allocator", () => {
  it("paints radial, flare and mist sprites on surfaces from the given allocator", () => {
    const made: [number, number][] = [];
    const create = (w: number, h: number) => {
      made.push([w, h]);
      return fakeSurface(w, h);
    };
    const radial = radialSprite(32, [[0, "#fff"], [1, "rgba(0,0,0,0)"]], create);
    const flare = flareSprite(48, "#fff", "#ccf", create);
    const mist = mistTile(createNoise2D(1), 255, 255, 255, 120, create);
    assert.deepEqual(made, [
      [32, 32],
      [48, 48],
      [256, 64],
    ]);
    assert.equal(radial.width, 32);
    assert.equal(flare.height, 48);
    assert.equal(mist.width, 256);
  });
});
