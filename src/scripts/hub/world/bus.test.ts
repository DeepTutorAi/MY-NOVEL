import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createBus } from "./bus";
import type { HubState } from "./types";

class FakeTarget implements EventTarget {
  readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  readonly dispatched: Event[] = [];

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (!listener) return;
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(listener);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener) this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: Event): boolean {
    this.dispatched.push(event);
    for (const listener of [...(this.listeners.get(event.type) ?? [])]) {
      if (typeof listener === "function") listener(event);
      else listener.handleEvent(event);
    }
    return true;
  }

  count(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

const setup = () => {
  const target = new FakeTarget();
  const state: HubState = {};
  return { target, state, bus: createBus(target, () => state) };
};

describe("hub bus", () => {
  it("dispatches a CustomEvent with the hub: name and detail", () => {
    const { target, bus } = setup();
    bus.emit("hub:press", { slug: "lodge", kind: "open" });
    assert.equal(target.dispatched.length, 1);
    const event = target.dispatched[0] as CustomEvent;
    assert.equal(event.type, "hub:press");
    assert.deepEqual(event.detail, { slug: "lodge", kind: "open" });
  });

  it("delivers the detail to listeners and off() removes them", () => {
    const { target, bus } = setup();
    const seen: unknown[] = [];
    const off = bus.on("hub:stage", (detail) => seen.push(detail));
    bus.emit("hub:stage", { window: "stage", action: "tap" });
    off();
    bus.emit("hub:stage", { window: "mid", action: "left" });
    assert.deepEqual(seen, [{ window: "stage", action: "tap" }]);
    assert.equal(target.count("hub:stage"), 0);
    off();
    assert.equal(target.count("hub:stage"), 0);
  });

  it("delivers {} for events dispatched inline without a detail", () => {
    const { target, bus } = setup();
    const seen: unknown[] = [];
    bus.on("hub:reading", (detail) => seen.push(detail));
    target.dispatchEvent(new CustomEvent("hub:reading"));
    assert.deepEqual(seen, [{}]);
  });

  it("keeps the last detail of sticky events only", () => {
    const { state, bus } = setup();
    assert.equal(bus.last("hub:modal"), undefined);
    bus.emit("hub:modal", { open: true, kind: "picker" });
    bus.emit("hub:modal", { open: false });
    bus.emit("hub:theme", { key: "firefly", previous: null, source: "load" });
    bus.emit("hub:press", { slug: "kusabi", kind: "open" });
    assert.deepEqual(bus.last("hub:modal"), { open: false });
    assert.deepEqual(bus.last("hub:theme"), { key: "firefly", previous: null, source: "load" });
    assert.deepEqual(Object.keys(state).sort(), ["hub:modal", "hub:theme"]);
  });

  it("records the sticky value before listeners run", () => {
    const { bus } = setup();
    let seen: unknown;
    bus.on("hub:motion", () => (seen = bus.last("hub:motion")));
    bus.emit("hub:motion", { still: true });
    assert.deepEqual(seen, { still: true });
  });

  it("resetSticky forgets every sticky value", () => {
    const { state, bus } = setup();
    bus.emit("hub:layout", { version: 3 });
    bus.emit("hub:scene", { key: "skyglass", status: "ready" });
    bus.resetSticky();
    assert.equal(bus.last("hub:layout"), undefined);
    assert.deepEqual(state, {});
  });

  it("reads state lazily on every call", () => {
    const target = new FakeTarget();
    let calls = 0;
    const state: HubState = {};
    const bus = createBus(target, () => {
      calls++;
      return state;
    });
    assert.equal(calls, 0);
    bus.emit("hub:layout", { version: 1 });
    assert.equal(calls, 1);
  });

  it("imports in Node without touching window or document", async () => {
    const module = await import("./bus");
    assert.equal(typeof module.on, "function");
    assert.equal("window" in globalThis, false);
  });
});
