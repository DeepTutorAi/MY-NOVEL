import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeLayout, displayAngle, fitOrbit, flapOpenness, frameForOpenness, placeMoon, rectDistance } from "./mothlight-scene";
import type { Rect } from "./mothlight-scene";

const SIZES: Array<[number, number]> = [
  [1440, 900],
  [1280, 800],
  [390, 844],
  [844, 390],
  [320, 568],
  [568, 320],
  [2560, 1440],
];

describe("mothlight layout", () => {
  it("sizes the moon from the short side so it stays modest on landscape phones", () => {
    for (const [w, h] of SIZES) {
      const layout = computeLayout(w, h);
      const diameterShare = (layout.moon.r * 2) / Math.min(w, h);
      assert.ok(diameterShare <= 0.12, `${w}x${h}: moon diameter is ${(diameterShare * 100).toFixed(1)}% of the short side`);
    }
  });

  it("keeps the moon disc and the lantern inside the screen", () => {
    for (const [w, h] of SIZES) {
      const { moon, lamp } = computeLayout(w, h);
      assert.ok(moon.x - moon.r >= 0 && moon.x + moon.r <= w, `${w}x${h}: moon x`);
      assert.ok(moon.y - moon.r >= 0 && moon.y + moon.r <= h, `${w}x${h}: moon y`);
      assert.ok(lamp.postX > 0 && lamp.hookX < w / 2, `${w}x${h}: lantern stays in the left half`);
      assert.ok(lamp.hookY > h * 0.3 && lamp.hookY < h, `${w}x${h}: lantern hangs in the lower part`);
    }
  });

  it("fits attraction orbits inside the margins on every screen size", () => {
    for (const [w, h] of SIZES) {
      const layout = computeLayout(w, h);
      const { margin } = layout;
      const probes: Array<[number, number, number, number]> = [
        [layout.moon.x, layout.moon.y, layout.moon.r * 3.6 * 1.3, layout.moon.r * 2],
        [layout.lamp.hookX, layout.lamp.hookY, 80, 60],
        [0, 0, 70, 70],
        [w, h, 70, 40],
      ];
      for (const [x, y, rx, ry] of probes) {
        const o = fitOrbit(x, y, rx, ry, layout);
        assert.ok(o.rx >= 0 && o.rx <= rx && o.ry >= 0 && o.ry <= ry);
        assert.ok(o.x - o.rx >= margin - 1e-9 && o.x + o.rx <= w - margin + 1e-9, `${w}x${h}: orbit x within margins`);
        assert.ok(o.y - o.ry >= margin - 1e-9 && o.y + o.ry <= h - margin + 1e-9, `${w}x${h}: orbit y within margins`);
      }
    }
  });

  it("uses fewer moths on small screens", () => {
    const phone = computeLayout(390, 844);
    const desktop = computeLayout(1440, 900);
    assert.ok(phone.nearMoths + phone.farMoths < desktop.nearMoths + desktop.farMoths);
    assert.ok(phone.nearMoths >= 3);
    assert.equal(phone.compact, true);
    assert.equal(desktop.compact, false);
  });
});

describe("mothlight wing flap", () => {
  it("opens fully at phase 0 and closes to the minimum at half a beat", () => {
    assert.equal(flapOpenness(0), 1);
    assert.ok(flapOpenness(Math.PI) < 0.35, "raised wings never vanish edge-on");
    assert.ok(flapOpenness(Math.PI) > 0.25);
    assert.ok(flapOpenness(Math.PI / 2) > 0.5, "wings stay mostly spread through the stroke");
  });

  it("maps openness back to the matching flap frame", () => {
    assert.equal(frameForOpenness(1), 0);
    assert.equal(frameForOpenness(0), 6);
    for (let k = 0; k <= 6; k++) {
      const open = flapOpenness((k / 12) * Math.PI * 2);
      assert.equal(frameForOpenness(open), k);
    }
  });
});

describe("mothlight moon placement", () => {
  const phoneText: Rect[] = [
    { x: 16, y: 14, w: 358, h: 44 },
    { x: 16, y: 80, w: 358, h: 150 },
    { x: 16, y: 250, w: 358, h: 60 },
  ];
  const deskText: Rect[] = [
    { x: 80, y: 70, w: 620, h: 190 },
    { x: 1000, y: 90, w: 340, h: 110 },
  ];

  it("keeps the moon disc clear of page text when the screen has room", () => {
    const layout = computeLayout(1440, 900, deskText);
    for (const r of deskText) {
      assert.ok(rectDistance(layout.moon.x, layout.moon.y, r) >= layout.moon.r * 1.3, "moon clears the text with room for its halo");
    }
  });

  it("tucks a smaller moon into the freest corner on a phone with no free area, without the ring", () => {
    const full = computeLayout(390, 844);
    const tucked = placeMoon(390, 844, full.moon.r, phoneText);
    assert.ok(tucked.r <= full.moon.r);
    assert.equal(tucked.ring, false);
    assert.ok(tucked.x > 0 && tucked.x < 390);
  });

  it("orbits the moon only as far as the text allows", () => {
    const free = computeLayout(1440, 900);
    const boxed = computeLayout(1440, 900, [{ x: 1180, y: 60, w: 200, h: 200 }]);
    assert.ok(boxed.moonOrbit.rx <= free.moonOrbit.rx);
  });
});

describe("mothlight moth display angle", () => {
  it("keeps the dorsal sprite near upright whatever the flight heading", () => {
    for (let a = -Math.PI; a <= Math.PI; a += 0.1) {
      assert.ok(Math.abs(displayAngle(a)) <= 0.8 + 1e-9);
    }
  });

  it("leans toward the side the moth is flying", () => {
    assert.ok(displayAngle(0) > 0);
    assert.ok(displayAngle(Math.PI) < 0);
    assert.ok(Math.abs(displayAngle(-Math.PI / 2)) < 1e-9, "flying straight up is upright");
  });
});
