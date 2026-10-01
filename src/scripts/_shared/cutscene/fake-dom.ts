// A minimal fake DOM for the cutscene unit tests (runner.test.ts and the
// Tsukinomi adapter and session tests). Test support only: nothing shipped
// imports it. It models exactly what the cutscene code touches, so the tests
// run under node:test with no browser; real-browser behaviour (showModal in the
// top layer, focus, scroll lock) is the end-to-end script's job.
//
//   const env = installFakeDom("https://x.test/a/");   // in beforeEach
//   ...
//   env.restore();                                      // in afterEach
//
// installFakeDom() replaces the globals the code reads (document, window,
// localStorage, location, history, matchMedia) and captures console.warn.

/** An EventTarget that remembers which listeners are attached, so a test can tell a real clean-up from one that only went quiet. */
export class TrackedTarget extends EventTarget {
  private attached = new Map<string, Set<unknown>>();
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) {
    if (listener) (this.attached.get(type) ?? this.attached.set(type, new Set()).get(type)!).add(listener);
    super.addEventListener(type, listener, options);
  }
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) {
    if (listener) this.attached.get(type)?.delete(listener);
    super.removeEventListener(type, listener, options);
  }
  listenerCount(type?: string): number {
    if (type !== undefined) return this.attached.get(type)?.size ?? 0;
    return [...this.attached.values()].reduce((sum, set) => sum + set.size, 0);
  }
}

export class FakeElement extends TrackedTarget {
  hidden = false;
  isConnected = true;
  className = "";
  dataset: Record<string, string> = {};
  focusCalls = 0;
  parent: FakeElement | null = null;
  /** True for a document fragment: appending it moves its children instead. */
  isFragment = false;
  children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  tagName = "DIV";
  /** Inline style: declared properties by name, plus the camelCase ones scenes assign (animationDelay, overflow). */
  readonly style: Record<string, string> & { setProperty(name: string, value: string): void } = {
    setProperty(this: Record<string, string>, name: string, value: string) {
      this[name] = value;
    },
  } as never;
  readonly classes = new Set<string>();
  readonly classList = {
    add: (...names: string[]) => names.forEach((name) => this.classes.add(name)),
    remove: (...names: string[]) => names.forEach((name) => this.classes.delete(name)),
    contains: (name: string) => this.classes.has(name),
  };
  /** What querySelector(selector) returns, by selector text. */
  queries: Record<string, FakeElement | null> = {};
  private ownText = "";
  constructor(readonly env: FakeEnv) {
    super();
  }
  get textContent(): string {
    return this.children.length > 0 ? this.children.map((child) => child.textContent).join("") : this.ownText;
  }
  set textContent(value: string) {
    this.children = [];
    this.ownText = value;
  }
  append(...nodes: FakeElement[]) {
    for (const node of nodes) {
      if (node.isFragment) {
        this.append(...node.children);
        node.children = [];
        continue;
      }
      node.parent = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes: FakeElement[]) {
    this.children = [];
    this.ownText = "";
    this.append(...nodes);
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
    this.isConnected = false;
  }
  focus() {
    this.focusCalls++;
    this.env.document.activeElement = this;
  }
  // The only selector the runner asks about is "a control", and a button is one.
  closest(): FakeElement | null {
    return this instanceof FakeButton ? this : null;
  }
  querySelector(selector: string): FakeElement | null {
    return this.queries[selector] ?? null;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  hasAttribute(name: string) {
    return this.attributes.has(name);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
}

export class FakeButton extends FakeElement {}

export class FakeDialog extends FakeElement {
  open = false;
  /** Layout metrics: equal means nothing to scroll. */
  scrollHeight = 800;
  clientHeight = 800;
  scrollTop = 0;
  /** Simulates the browser scrolling the focused control into view when the dialog opens. */
  scrollsOnShow = false;
  showModalCalls = 0;
  closeCalls = 0;
  failToOpen = false;
  showModal() {
    this.showModalCalls++;
    if (this.failToOpen || this.open) throw new Error("InvalidStateError");
    this.open = true;
    if (this.scrollsOnShow) this.scrollTop = 500;
  }
  close() {
    this.closeCalls++;
    this.open = false;
  }
}

export class FakeDocument extends TrackedTarget {
  hidden = false;
  visibilityState: "visible" | "hidden" = "visible";
  body = {};
  readonly documentElement = {
    style: { overflow: "" },
    classList: ((classes: Set<string>) => ({
      add: (name: string) => void classes.add(name),
      remove: (name: string) => void classes.delete(name),
      contains: (name: string) => classes.has(name),
    }))(new Set<string>()),
  };
  activeElement: unknown = this.body;
  /** What querySelector(selector) returns, by selector text. */
  queries: Record<string, FakeElement | null> = {};
  /** What getElementById(id) returns. */
  ids: Record<string, FakeElement | null> = {};
  /** Set by installFakeDom: elements made here belong to this environment. */
  env!: FakeEnv;
  createElement(tagName: string): FakeElement {
    const element = new FakeElement(this.env);
    element.tagName = tagName.toUpperCase();
    return element;
  }
  createDocumentFragment(): FakeElement {
    const fragment = new FakeElement(this.env);
    fragment.isFragment = true;
    return fragment;
  }
  querySelector(selector: string): FakeElement | null {
    return this.queries[selector] ?? null;
  }
  getElementById(id: string): FakeElement | null {
    return this.ids[id] ?? null;
  }
}

export interface FakeLocation {
  href: string;
  pathname: string;
  search: string;
  hash: string;
}

export interface FakeEnv {
  document: FakeDocument;
  /** The fake window: an event target that also carries window.__tsukiCutsceneNav and the like. */
  window: TrackedTarget & Record<string, unknown>;
  storage: Map<string, string>;
  /** URLs passed to history.replaceState. */
  replaced: string[];
  /** Arguments of every console.warn. */
  warnings: unknown[][];
  location: FakeLocation;
  /** What matchMedia("(prefers-reduced-motion: reduce)").matches reports. */
  reduced: boolean;
  /** Makes localStorage.getItem or setItem throw. */
  storageBroken: "get" | "set" | null;
  setUrl(href: string): void;
  restore(): void;
}

const GLOBAL_KEYS = ["document", "window", "localStorage", "location", "history", "matchMedia"] as const;

export function installFakeDom(initialUrl: string): FakeEnv {
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const realWarn = console.warn;
  const setGlobal = (key: string, value: unknown) => {
    if (!saved.has(key)) saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  };

  const document = new FakeDocument();
  const env: FakeEnv = {
    document,
    window: new TrackedTarget() as FakeEnv["window"],
    storage: new Map(),
    replaced: [],
    warnings: [],
    location: { href: "", pathname: "", search: "", hash: "" },
    reduced: false,
    storageBroken: null,
    setUrl(href) {
      const url = new URL(href);
      env.location = { href, pathname: url.pathname, search: url.search, hash: url.hash };
      setGlobal("location", env.location);
    },
    restore() {
      console.warn = realWarn;
      for (const key of GLOBAL_KEYS) {
        const descriptor = saved.get(key);
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete (globalThis as Record<string, unknown>)[key];
      }
      saved.clear();
    },
  };

  document.env = env;
  setGlobal("document", document);
  setGlobal("window", env.window);
  setGlobal("localStorage", {
    getItem: (key: string) => {
      if (env.storageBroken === "get") throw new Error("denied");
      return env.storage.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (env.storageBroken === "set") throw new Error("denied");
      env.storage.set(key, value);
    },
  });
  setGlobal("history", { state: null, replaceState: (_state: unknown, _title: string, url: string) => env.replaced.push(url) });
  setGlobal("matchMedia", () => ({ matches: env.reduced }));
  env.setUrl(initialUrl);
  console.warn = (...args: unknown[]) => {
    env.warnings.push(args);
  };
  return env;
}
