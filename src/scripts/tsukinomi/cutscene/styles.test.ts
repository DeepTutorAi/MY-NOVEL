import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { injectSceneStyles } from "./styles";

// Just enough DOM for injectSceneStyles: createElement("style") and document.head.append.
class FakeStyle {
  dataset: Record<string, string> = {};
  textContent = "";
  parent: FakeHead | null = null;
  remove() {
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
}
class FakeHead {
  children: FakeStyle[] = [];
  append(child: FakeStyle) {
    child.parent = this;
    this.children.push(child);
  }
}

const original = Object.getOwnPropertyDescriptor(globalThis, "document");
let head: FakeHead;

beforeEach(() => {
  head = new FakeHead();
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { head, createElement: (tag: string) => (tag === "style" ? new FakeStyle() : assert.fail(`unexpected ${tag}`)) },
  });
});

afterEach(() => {
  if (original) Object.defineProperty(globalThis, "document", original);
  else delete (globalThis as { document?: unknown }).document;
});

describe("injectSceneStyles", () => {
  it("adds one style element with the css to the head and removes it when the signal aborts", () => {
    const controller = new AbortController();
    injectSceneStyles(".a { color: red }", controller.signal);
    assert.equal(head.children.length, 1);
    assert.equal(head.children[0].textContent, ".a { color: red }");
    assert.ok("tsukiSceneStyle" in head.children[0].dataset);
    controller.abort();
    assert.equal(head.children.length, 0);
  });

  it("does nothing for a signal that already aborted", () => {
    const controller = new AbortController();
    controller.abort();
    injectSceneStyles(".a {}", controller.signal);
    assert.equal(head.children.length, 0);
  });
});
