import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LAMP, autoPath, firelight, followLamp, inBen, lampRadius, lampReveal, trailAlpha } from "./lamp-core";

describe("Ben's place on plate 06A", () => {
  it("covers the man on the sofa and not the people beside him", () => {
    assert.equal(inBen(0.43, 0.32), true, "his face");
    assert.equal(inBen(0.44, 0.7), true, "his knees");
    assert.equal(inBen(0.13, 0.4), false, "Elena in the doorway");
    assert.equal(inBen(0.86, 0.45), false, "Diana in the armchair");
  });
});

describe("trailAlpha", () => {
  it("lets the light leave the room at once but linger half a second on Ben", () => {
    assert.equal(LAMP.lingerS, 0.5);
    assert.equal(trailAlpha(0.2, false), 0, "anywhere else the dark returns within 0.12 s");
    assert.ok(trailAlpha(0.2, true) > 0.5, "on Ben the light is still there");
    assert.equal(trailAlpha(0.5, true), 0);
    assert.equal(trailAlpha(0, false), 1);
  });
});

describe("autoPath", () => {
  it("wanders the screen, not the plate, so a narrow screen still sees it, and crosses the middle where Ben is", () => {
    let crossed = false;
    for (let t = 0; t < 18; t += 0.05) {
      const { x, y } = autoPath(t);
      assert.ok(x > 0.1 && x < 0.9 && y > 0.2 && y < 0.8, `${x},${y} at ${t}`);
      if (Math.abs(x - 0.5) < 0.06 && y > 0.3 && y < 0.6) crossed = true;
    }
    assert.ok(crossed);
  });
});

describe("lampRadius", () => {
  it("stays large enough on a tall phone screen", () => {
    assert.ok(lampRadius(390, 844) >= 130);
    assert.ok(Math.abs(lampRadius(1280, 800) - 192) < 1e-9);
  });
});

describe("firelight", () => {
  it("breathes slowly, never faster than 0.08 per second", () => {
    for (let t = 0; t < 20; t += 0.01) assert.ok(Math.abs(firelight(t + 0.01) - firelight(t)) / 0.01 <= 0.08 + 1e-9);
  });
});

describe("timeline", () => {
  it("reveals the epigraph and ends within 20 s", () => {
    assert.equal(lampReveal(0.5), 0);
    assert.equal(lampReveal(LAMP.revealToS), 1);
    assert.ok(LAMP.endS <= 20);
  });
});

describe("followLamp (flash safety)", () => {
  it("moves the light at most two of its own widths per second, however fast the pointer goes", () => {
    const radius = 100;
    const step = followLamp({ x: 0, y: 0 }, { x: 1000, y: 0 }, radius, 0.1);
    assert.ok(Math.abs(step.x - 2 * radius * 2 * 0.1) < 1e-9, `moved ${step.x}`);
    assert.deepEqual(followLamp({ x: 0, y: 0 }, { x: 10, y: 0 }, radius, 0.1), { x: 10, y: 0 }, "a short move lands");
  });

  it("cannot light and darken any point more than once a second when the pointer is waved at 4 Hz", () => {
    const radius = 100;
    const dt = 1 / 120;
    let lamp = { x: 0, y: 0 };
    const point = { x: 0, y: 0 };
    let lit = true;
    const switches: number[] = [];
    for (let t = 0; t < 6; t += dt) {
      const pointer = { x: Math.sin(t * Math.PI * 8) * 400, y: 0 };
      lamp = followLamp(lamp, pointer, radius, dt);
      const now = Math.hypot(lamp.x - point.x, lamp.y - point.y) < radius;
      if (now !== lit) switches.push(t);
      lit = now;
    }
    for (let i = 0; i + 2 < switches.length; i += 1) {
      assert.ok(switches[i + 2] - switches[i] >= 1, `a full dark-light-dark cycle in ${(switches[i + 2] - switches[i]).toFixed(2)} s`);
    }
  });
});
