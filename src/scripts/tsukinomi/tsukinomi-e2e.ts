// End-to-end check of the Tsukinomi opening cutscene in headless Chrome
// (puppeteer). Not part of the unit test suite: it needs a running server.
//
//   node --import tsx src/scripts/tsukinomi/tsukinomi-e2e.ts [baseUrl]
//   TSUKI_E2E_ONLY=scroll node --import tsx ...     (only the checks whose name matches)
//
// baseUrl defaults to http://localhost:4321 and may carry the site base (for
// example http://localhost:4800/MY-NOVEL). It runs against a dev server or a
// production build. The unit tests cover the rules (cooldown, state machine,
// adapter wiring); this covers what only a browser can: showModal() in the top
// layer, focus, the scroll lock, the cover, soft navigation, chunk downloads.
//
// First loads on a dev server compile modules on demand; the warm-up visits
// every section once so the timing-sensitive checks measure the page, not Vite.
//
// Not covered here, and reported as unverified by the design (section 7): audible
// audio and the Walkman's restored state, frame time and flash safety per scene
// (the scene rounds measure those), real touch devices, Safari and Firefox.
import puppeteer, { type Browser, type BrowserContext, type Page } from "puppeteer";
import { allRegistryEntries } from "./cutscene/registry";
import { EPIGRAPHS } from "./cutscene/epigraphs";

type Status = "PASS" | "FAIL" | "SKIP";
interface Result {
  name: string;
  status: Status;
  detail: string;
}

const BASE = (() => {
  const raw = process.argv[2] ?? "http://localhost:4321";
  return raw.endsWith("/") ? raw : `${raw}/`;
})();
const PLAYED_KEY = (part: number) => `tsukinomi:cutscene:played:${part}`;
const SECTIONS = [
  { part: 0, slug: "00-introduction" },
  { part: 1, slug: "01-discovery" },
  { part: 2, slug: "02-reveal" },
  { part: 3, slug: "03-decision" },
  { part: 4, slug: "04-mountain" },
  { part: 5, slug: "05-ten-years" },
] as const;
const DESKTOP = { width: 1280, height: 800 };
const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 812, height: 375 },
  { width: 667, height: 375 },
  { width: 915, height: 412 },
] as const;
const NAV_TIMEOUT = 60_000;
// Where the scene chunk of part 1 is requested from, in dev and in a build.
const PART_1_CHUNK = /part-1-autumn-rain/;

const results: Result[] = [];
const pageErrors: string[] = [];
const consoleProblems: string[] = [];
const thirdParties = new Set<string>();
const failedRequests: string[] = [];

const url = (path: string, query = "") => `${new URL(path.replace(/^\//, ""), BASE).href}${query}`;
const sectionUrl = (slug: string, query = "") => url(`tsukinomi/sections/${slug}/`, query);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ONLY = process.env.TSUKI_E2E_ONLY ? new RegExp(process.env.TSUKI_E2E_ONLY, "i") : null;

async function check(name: string, run: () => Promise<string | void>): Promise<void> {
  if (ONLY && !ONLY.test(name)) return;
  try {
    const detail = await run();
    results.push({ name, status: "PASS", detail: detail ?? "" });
  } catch (error) {
    results.push({ name, status: "FAIL", detail: error instanceof Error ? error.message : String(error) });
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function routeExists(path: string): Promise<boolean> {
  try {
    return (await fetch(url(path))).ok;
  } catch {
    return false;
  }
}

interface PageOptions {
  viewport?: { width: number; height: number };
  reducedMotion?: boolean;
  /** Parts whose cutscene counts as already played today. */
  played?: number[];
  /** Root font size, as the reader's text-size setting would change it. */
  fontSize?: string;
  touch?: boolean;
}

async function openPage(browser: Browser, options: PageOptions = {}): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT);
  page.on("pageerror", (error) => pageErrors.push(`${page.url()}: ${error instanceof Error ? error.message : String(error)}`));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warn") consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("request", (request) => {
    const target = request.url();
    if (/^https?:/.test(target) && !target.startsWith(new URL(BASE).origin)) thirdParties.add(new URL(target).host);
  });
  page.on("requestfailed", (request) => failedRequests.push(`${request.url()} ${request.failure()?.errorText ?? ""}`));
  // tsx keeps function names through an injected __name helper, which does not
  // exist in the page; callbacks passed to page.evaluate need it defined.
  await page.evaluateOnNewDocument("globalThis.__name = (fn) => fn;");
  const touch = options.touch ?? false;
  await page.setViewport({ ...(options.viewport ?? DESKTOP), isMobile: touch, hasTouch: touch });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: options.reducedMotion ? "reduce" : "no-preference" }]);
  if (options.fontSize) {
    const size = options.fontSize;
    await page.evaluateOnNewDocument(
      `{ const apply = () => { if (document.documentElement) document.documentElement.style.fontSize = ${JSON.stringify(size)}; else setTimeout(apply, 1); }; apply(); }`,
    );
  }
  if (options.played?.length) {
    // Written from a Tsukinomi page so ProfileStorageInterceptor scopes the keys
    // exactly as the adapter will read them.
    await page.goto(url("tsukinomi/"), { waitUntil: "domcontentloaded" });
    await page.evaluate((keys: string[]) => {
      const now = new Date().toISOString();
      for (const key of keys) localStorage.setItem(key, now);
    }, options.played.map(PLAYED_KEY));
  }
  return { context, page };
}

async function cutsceneState(page: Page) {
  return page.evaluate(() => {
    const dialog = document.querySelector<HTMLDialogElement>("dialog.tsuki-cutscene");
    const active = document.activeElement;
    return {
      exists: Boolean(dialog),
      open: dialog?.open ?? false,
      modal: dialog?.matches(":modal") ?? false,
      state: dialog?.dataset.state ?? "",
      mode: dialog?.dataset.mode ?? "",
      activeSkip: active?.matches("[data-cutscene-skip]") ?? false,
      activeStart: active?.matches("[data-cutscene-start]") ?? false,
      activeIsHeading: active?.matches("article.tsukinomi-section h1") ?? false,
      activeTag: active?.tagName ?? "",
      covered: document.documentElement.classList.contains("tsuki-cutscene-pending"),
      search: location.search,
      scrollY: Math.round(window.scrollY),
    };
  });
}

const sceneRequests = (page: Page) =>
  page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name).filter((name) => /\/scenes\/|part-\d-|prologue|plate-reveal|session|scene-runtime/.test(name)));

async function waitForPlaying(page: Page, timeout = 20_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const dialog = document.querySelector<HTMLDialogElement>("dialog.tsuki-cutscene");
      return dialog?.open === true && dialog.dataset.state === "playing";
    },
    { timeout },
  );
}

async function waitForClosed(page: Page, timeout = 20_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const dialog = document.querySelector<HTMLDialogElement>("dialog.tsuki-cutscene");
      return dialog !== null && !dialog.open && ["finished", "skipped"].includes(dialog.dataset.state ?? "");
    },
    { timeout },
  );
}

/** Watches for the gate's safety window that the cutscene never opens. */
async function assertStaysClosed(page: Page, label: string, ms = 3_200): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const state = await cutsceneState(page);
    assert(state.exists, `${label}: no cutscene dialog on the section page`);
    assert(!state.open && state.state !== "playing", `${label}: the cutscene opened (state ${state.state})`);
    await pause(200);
  }
  const state = await cutsceneState(page);
  assert(!state.covered, `${label}: the page is still covered by tsuki-cutscene-pending`);
}

async function warmUp(browser: Browser): Promise<void> {
  const { context, page } = await openPage(browser);
  try {
    for (const { slug } of SECTIONS) {
      await page.goto(sectionUrl(slug), { waitUntil: "load" });
      await page
        .waitForFunction(() => ["playing", "finished", "skipped"].includes(document.querySelector<HTMLDialogElement>("dialog.tsuki-cutscene")?.dataset.state ?? ""), { timeout: 25_000 })
        .catch(() => undefined);
    }
  } finally {
    await context.close();
  }
}

async function checkEveryPartOpens(browser: Browser): Promise<void> {
  await check("every part opens a modal dialog with its own epigraph as real text", async () => {
    const { context, page } = await openPage(browser);
    try {
      for (const { part, slug } of SECTIONS) {
        await page.goto(sectionUrl(slug, "?cutscene=replay"), { waitUntil: "domcontentloaded" });
        await waitForPlaying(page);
        const found = await page.evaluate(() => {
          const dialog = document.querySelector<HTMLDialogElement>("dialog.tsuki-cutscene");
          const text = document.getElementById("cutscene-text");
          return {
            modal: dialog?.matches(":modal") ?? false,
            part: dialog?.dataset.part,
            text: text?.textContent ?? "",
            label: dialog?.getAttribute("aria-label") ?? "",
            describedBy: dialog?.getAttribute("aria-describedby") ?? "",
            skipActive: document.activeElement?.matches("[data-cutscene-skip]") ?? false,
            covered: document.documentElement.classList.contains("tsuki-cutscene-pending"),
          };
        });
        assert(found.modal, `part ${part}: the dialog is not in the top layer (:modal)`);
        assert(found.part === String(part), `part ${part}: data-part is ${found.part}`);
        assert(found.text === EPIGRAPHS[part], `part ${part}: the epigraph text changed while the scene runs`);
        assert(found.label.length > 0 && found.describedBy === "cutscene-text", `part ${part}: the dialog has no accessible name or description`);
        assert(found.skipActive, `part ${part}: focus is not on Skip`);
        assert(!found.covered, `part ${part}: the cover is still up`);
        await page.keyboard.press("Escape");
        await waitForClosed(page);
      }
      return `parts 0 to 5: :modal, own epigraph (${allRegistryEntries().length - 1} scenes + fallback registered), named, Skip focused`;
    } finally {
      await context.close();
    }
  });
}

async function checkPlayEscapeCooldown(browser: Browser): Promise<void> {
  await check("play, Escape, same-day cooldown, ?resume=1, ?cutscene=replay (part 1)", async () => {
    const { context, page } = await openPage(browser);
    try {
      await page.goto(url("tsukinomi/"), { waitUntil: "domcontentloaded" });
      await page.evaluate((key: string) => localStorage.removeItem(key), PLAYED_KEY(1));
      await page.goto(sectionUrl("01-discovery"), { waitUntil: "domcontentloaded" });
      await waitForPlaying(page);
      let state = await cutsceneState(page);
      assert(state.modal && state.mode === "motion" && state.activeSkip, `first visit: ${JSON.stringify(state)}`);
      assert(state.scrollY === 0, `the page scrolled behind the dialog (${state.scrollY}px)`);
      const stamp = await page.evaluate((key: string) => localStorage.getItem(key), PLAYED_KEY(1));
      assert(stamp !== null && new Date(stamp).toISOString() === stamp, `played key is ${stamp}, expected an ISO string written at open`);
      assert((await sceneRequests(page)).some((name) => PART_1_CHUNK.test(name)), "the scene chunk was not requested for a first visit");
      await pause(500);
      await page.keyboard.press("Escape");
      await waitForClosed(page);
      state = await cutsceneState(page);
      assert(state.state === "finished", `state after Escape is ${state.state}`);
      assert(state.activeIsHeading, `focus is on ${state.activeTag}, not the section heading`);
      assert(!state.modal && !state.covered, "the dialog or the cover is still there after Escape");

      await page.reload({ waitUntil: "domcontentloaded" });
      await assertStaysClosed(page, "same-day reload");
      const second = await sceneRequests(page);
      assert(!second.some((name) => PART_1_CHUNK.test(name)), `the scene chunk was downloaded although the cutscene did not play: ${second.join(", ")}`);

      await page.goto(sectionUrl("01-discovery", "?resume=1"), { waitUntil: "domcontentloaded" });
      await assertStaysClosed(page, "?resume=1");
      await page.goto(url("tsukinomi/"), { waitUntil: "domcontentloaded" });
      await page.evaluate((key: string) => localStorage.removeItem(key), PLAYED_KEY(1));
      await page.goto(sectionUrl("01-discovery", "?resume=1"), { waitUntil: "domcontentloaded" });
      await assertStaysClosed(page, "?resume=1 with no play recorded");
      const key = await page.evaluate((k: string) => localStorage.getItem(k), PLAYED_KEY(1));
      assert(key === null, "?resume=1 recorded a play although nothing was shown");

      await page.goto(sectionUrl("01-discovery", "?cutscene=replay&x=1#frag"), { waitUntil: "domcontentloaded" });
      await waitForPlaying(page);
      state = await cutsceneState(page);
      assert(state.search === "?x=1", `the address kept ${state.search}, expected the replay parameter stripped`);
      await page.keyboard.press("Escape");
      await waitForClosed(page);
      return "plays once, ISO stamp at open, Escape -> heading, reload and ?resume=1 download no scene, replay plays and is stripped";
    } finally {
      await context.close();
    }
  });
}

async function checkSkipButton(browser: Browser): Promise<void> {
  await check("Skip button, Enter and Space on it, triple click", async () => {
    const { context, page } = await openPage(browser);
    try {
      for (const how of ["click", "enter", "space", "triple"] as const) {
        await page.goto(sectionUrl("02-reveal", "?cutscene=replay"), { waitUntil: "domcontentloaded" });
        await waitForPlaying(page);
        if (how === "click") await page.click("[data-cutscene-skip]");
        else if (how === "enter") await page.keyboard.press("Enter");
        else if (how === "space") await page.keyboard.press("Space");
        else await page.click("[data-cutscene-skip]", { count: 3 });
        await waitForClosed(page);
        const state = await cutsceneState(page);
        assert(state.state === "finished" && state.activeIsHeading, `${how}: ${JSON.stringify(state)}`);
      }
      return "all four end finished with focus on the heading";
    } finally {
      await context.close();
    }
  });
}

async function checkNaturalEnd(browser: Browser): Promise<void> {
  await check("the scene ends by itself and hands the page back", async () => {
    const { context, page } = await openPage(browser);
    try {
      await page.goto(sectionUrl("00-introduction", "?cutscene=replay"), { waitUntil: "domcontentloaded" });
      await waitForPlaying(page);
      await waitForClosed(page, 40_000);
      const state = await cutsceneState(page);
      assert(state.state === "finished" && state.activeIsHeading && !state.modal, JSON.stringify(state));
      const leftovers = await page.evaluate(() => ({
        styles: document.querySelectorAll("style[data-tsuki-scene-style]").length,
        canvases: document.querySelectorAll("dialog.tsuki-cutscene canvas").length,
        rootOverflow: document.documentElement.style.overflow,
      }));
      assert(leftovers.styles === 0 && leftovers.canvases === 0, `leftovers: ${JSON.stringify(leftovers)}`);
      assert(leftovers.rootOverflow === "", `the root kept overflow:${leftovers.rootOverflow}`);
      await page.mouse.wheel({ deltaY: 400 });
      await pause(500);
      assert((await cutsceneState(page)).scrollY > 0, "the page does not scroll after the cutscene");
      return "finished by itself, scene styles and canvases removed, root unlocked, page scrolls";
    } finally {
      await context.close();
    }
  });
}

async function checkReducedMotion(browser: Browser): Promise<void> {
  await check("reduced motion: still, continue button, no scroll behind", async () => {
    const { context, page } = await openPage(browser, { reducedMotion: true });
    try {
      await page.goto(sectionUrl("03-decision", "?cutscene=replay"), { waitUntil: "domcontentloaded" });
      await waitForPlaying(page);
      const state = await cutsceneState(page);
      assert(state.mode === "still" && state.activeStart, `still mode: ${JSON.stringify(state)}`);
      const shown = await page.evaluate(() => {
        const skip = document.querySelector<HTMLElement>("[data-cutscene-skip]");
        const start = document.querySelector<HTMLElement>("[data-cutscene-start]");
        const text = document.getElementById("cutscene-text");
        const rect = text?.getBoundingClientRect();
        return {
          skipHidden: skip?.hidden === true,
          startShown: start?.hidden === false,
          textOpacity: text ? Number(getComputedStyle(text).opacity) : -1,
          spans: text?.querySelectorAll(".tsuki-g").length ?? -1,
          inView: rect ? rect.top >= 0 && rect.bottom <= innerHeight : false,
        };
      });
      assert(shown.skipHidden && shown.startShown, "Skip should give way to the continue button");
      assert(shown.textOpacity === 1 && shown.spans === 0, `the still must show the whole text with nothing animating: ${JSON.stringify(shown)}`);
      assert(shown.inView, "the epigraph is not inside the viewport");
      await page.mouse.wheel({ deltaY: 500 });
      await page.keyboard.press("PageDown");
      await pause(400);
      assert((await cutsceneState(page)).scrollY === 0, "the page scrolled behind the still");
      await page.keyboard.press("Enter");
      await waitForClosed(page);
      const after = await cutsceneState(page);
      assert(after.activeIsHeading, `focus is on ${after.activeTag} after the continue button`);
      return "still mode, continue focused, text whole and static, no scroll, Enter closes to the heading";
    } finally {
      await context.close();
    }
  });
}

async function checkScrollLock(): Promise<void> {
  await check("scroll lock: wheel, keys, Space on the dialog, the scrollbar", async () => {
    // Classic scrollbars: the page scrollbar is the input a wheel or key handler cannot stop.
    const browser = await launchBrowser({ ignoreDefaultArgs: ["--hide-scrollbars"] });
    try {
      const { context, page } = await openPage(browser);
      try {
        await page.goto(sectionUrl("01-discovery", "?cutscene=replay"), { waitUntil: "domcontentloaded" });
        await waitForPlaying(page);
        const bar = await page.evaluate(() => ({ strip: innerWidth - document.documentElement.clientWidth, overflow: getComputedStyle(document.documentElement).overflowY }));
        assert(bar.strip === 0 && bar.overflow === "hidden", `the page scrollbar is still there: ${JSON.stringify(bar)}`);
        const x = DESKTOP.width - 5;
        await page.mouse.move(x, 400);
        await page.mouse.wheel({ deltaY: 600 });
        await page.mouse.move(x, 30);
        await page.mouse.down();
        await page.mouse.move(x, 300, { steps: 6 });
        await page.mouse.up();
        await page.mouse.click(x, 700);
        await pause(300);
        assert((await cutsceneState(page)).scrollY === 0, "the scrollbar strip scrolled the page behind the dialog");
        await page.mouse.click(400, 300); // focus moves to the dialog itself
        const moved: string[] = [];
        for (const key of ["Space", "PageDown", "ArrowDown", "End"] as const) {
          await page.keyboard.press(key);
          await pause(250);
          if ((await cutsceneState(page)).scrollY !== 0) moved.push(key);
        }
        await page.mouse.wheel({ deltaY: 800 });
        await pause(300);
        if ((await cutsceneState(page)).scrollY !== 0) moved.push("wheel");
        assert(moved.length === 0, `scrolled the page behind the dialog: ${moved.join(", ")}`);
        assert((await cutsceneState(page)).state === "playing", "a scroll key ended the cutscene");
        return "scrollbar gone, wheel, thumb drag, track click, Space, PageDown, ArrowDown, End: page stays at 0";
      } finally {
        await context.close();
      }
    } finally {
      await browser.close();
    }
  });
}

async function checkSoftNavigation(browser: Browser): Promise<void> {
  await check("soft navigation away mid-scene, and into a part from the home", async () => {
    const { context, page } = await openPage(browser);
    try {
      const home = new URL("tsukinomi/", BASE).pathname;
      await page.goto(sectionUrl("01-discovery", "?cutscene=replay"), { waitUntil: "domcontentloaded" });
      await waitForPlaying(page);
      await page.evaluate((path: string) => {
        const link = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].find((anchor) => new URL(anchor.href).pathname === path);
        if (!link) throw new Error(`no link to ${path} on the section page`);
        link.click();
      }, home);
      await page.waitForFunction((path: string) => location.pathname === path, {}, home);
      const away = await page.evaluate(() => ({
        dialogs: document.querySelectorAll("dialog.tsuki-cutscene[open]").length,
        modal: document.querySelector(":modal") !== null,
        covered: document.documentElement.classList.contains("tsuki-cutscene-pending"),
        rootOverflow: document.documentElement.style.overflow,
      }));
      assert(away.dialogs === 0 && !away.modal && !away.covered, `left a dialog or cover behind: ${JSON.stringify(away)}`);
      assert(away.rootOverflow === "", `the root kept overflow:${away.rootOverflow}`);

      // Into a section by clicking: its cutscene plays once, with no second dialog stacked.
      await page.evaluate((key: string) => localStorage.removeItem(key), PLAYED_KEY(0));
      const intro = await page.evaluate(() => [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].map((anchor) => anchor.href).find((href) => /sections\/00-introduction\/?$/.test(href)) ?? "");
      if (intro) {
        await page.evaluate((target: string) => [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].find((anchor) => anchor.href === target)?.click(), intro);
        await page.waitForFunction(() => location.pathname.includes("/sections/00-introduction"), {});
        await waitForPlaying(page);
        const count = await page.evaluate(() => document.querySelectorAll("dialog.tsuki-cutscene").length);
        assert(count === 1, `${count} cutscene dialogs after a soft navigation`);
        await page.keyboard.press("Escape");
        await waitForClosed(page);
      }
      return intro ? "left the page: no dialog, cover or lock behind; entering a part by click plays exactly one dialog" : "left the page cleanly (no link to the prologue on the home to enter by click)";
    } finally {
      await context.close();
    }
  });
}

async function checkNoFlashCover(browser: Browser): Promise<void> {
  await check("slow scene chunk: held cover keeps the cutscene, a lapsed one drops it", async () => {
    const slow = async (delay: number) => {
      const { context, page } = await openPage(browser);
      try {
        await page.goto(url("tsukinomi/"), { waitUntil: "domcontentloaded" });
        await page.evaluate((key: string) => localStorage.removeItem(key), PLAYED_KEY(1));
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          if (PART_1_CHUNK.test(request.url())) setTimeout(() => void request.continue().catch(() => undefined), delay);
          else void request.continue().catch(() => undefined);
        });
        const started = Date.now();
        await page.goto(sectionUrl("01-discovery"), { waitUntil: "domcontentloaded" });
        // 2.5 s from parse, the gate's own timer; then the adapter's hold, then the budget.
        const outcome = await page
          .waitForFunction(
            () => {
              const dialog = document.querySelector<HTMLDialogElement>("dialog.tsuki-cutscene");
              if (dialog?.open) return "played";
              return dialog?.dataset.state === "skipped" ? "dropped" : false;
            },
            { timeout: 15_000, polling: 50 },
          )
          .then((handle) => handle.jsonValue() as Promise<string>)
          .catch(() => "timeout");
        const state = await cutsceneState(page);
        const stamp = await page.evaluate((key: string) => localStorage.getItem(key), PLAYED_KEY(1));
        return { outcome, ms: Date.now() - started, covered: state.covered, stamp };
      } finally {
        await context.close();
      }
    };
    const late = await slow(2_200);
    assert(late.outcome === "played", `a chunk that arrives 2.2 s late (after the gate's own 2.5 s) should still play: ${JSON.stringify(late)}`);
    assert(late.stamp !== null, "no played stamp after it played");
    const never = await slow(8_000);
    assert(never.outcome === "dropped", `a chunk that arrives far too late should drop the cutscene: ${JSON.stringify(never)}`);
    assert(!never.covered, "the cover is still up after the cutscene was dropped");
    assert(never.stamp === null, "a cutscene that never showed must not be recorded as played");
    return `2.2 s late: played (${late.ms} ms); 8 s late: dropped without a stamp, cover lifted (${never.ms} ms)`;
  });
}

async function checkLayout(browser: Browser): Promise<void> {
  await check("layout at 375x812, 390x844, 812x375, 667x375, 915x412 (motion and still)", async () => {
    const problems: string[] = [];
    for (const viewport of VIEWPORTS) {
      for (const reducedMotion of [false, true]) {
        const { context, page } = await openPage(browser, { viewport, reducedMotion, touch: true });
        try {
          await page.goto(sectionUrl("01-discovery", "?cutscene=replay"), { waitUntil: "domcontentloaded" });
          await waitForPlaying(page);
          await pause(reducedMotion ? 300 : 2_500);
          const found = await page.evaluate(() => {
            const dialog = document.querySelector<HTMLDialogElement>("dialog.tsuki-cutscene");
            const control = document.querySelector<HTMLElement>(dialog?.dataset.mode === "still" ? "[data-cutscene-start]" : "[data-cutscene-skip]");
            const text = document.getElementById("cutscene-text");
            const control_ = control?.getBoundingClientRect();
            const text_ = text?.getBoundingClientRect();
            const hit = control_ ? document.elementFromPoint(control_.left + control_.width / 2, control_.top + control_.height / 2) : null;
            return {
              hScroll: (dialog?.scrollWidth ?? 0) - (dialog?.clientWidth ?? 0),
              pageHScroll: document.documentElement.scrollWidth - innerWidth,
              controlW: control_?.width ?? 0,
              controlH: control_?.height ?? 0,
              controlVisible: control_ ? control_.top >= 0 && control_.bottom <= innerHeight && control_.left >= 0 && control_.right <= innerWidth : false,
              controlHit: control !== null && hit !== null && control.contains(hit),
              textLeft: text_?.left ?? -1,
              textRight: text_?.right ?? -1,
              textTop: text_?.top ?? -1,
              width: innerWidth,
              overflow: (dialog?.scrollHeight ?? 0) - (dialog?.clientHeight ?? 0),
            };
          });
          const tag = `${viewport.width}x${viewport.height} ${reducedMotion ? "still" : "motion"}`;
          if (found.hScroll > 0 || found.pageHScroll > 0) problems.push(`${tag}: horizontal overflow`);
          if (found.controlW < 44 || found.controlH < 44) problems.push(`${tag}: touch target ${Math.round(found.controlW)}x${Math.round(found.controlH)}`);
          if (!found.controlVisible || !found.controlHit) problems.push(`${tag}: the ${reducedMotion ? "continue" : "Skip"} control is not visible and on top`);
          if (found.textLeft < 0 || found.textRight > found.width) problems.push(`${tag}: the text leaves the viewport sideways`);
          if (found.textTop < 0) problems.push(`${tag}: the text starts above the viewport`);
          if (found.overflow > 1) problems.push(`${tag}: the dialog scrolls at the default text size`);
        } finally {
          await context.close();
        }
      }
    }
    assert(problems.length === 0, problems.join("; "));
    return "10 cases: no horizontal scroll, controls at least 44 px, visible and on top, text inside the viewport";
  });
}

async function checkLargeText(browser: Browser): Promise<void> {
  await check("200% text size: the epigraph stays whole and reachable (375x812, 667x375)", async () => {
    for (const viewport of [VIEWPORTS[0], VIEWPORTS[3]]) {
      for (const reducedMotion of [false, true]) {
        const { context, page } = await openPage(browser, { viewport, reducedMotion, fontSize: "200%", touch: true });
        try {
          await page.goto(sectionUrl("03-decision", "?cutscene=replay"), { waitUntil: "domcontentloaded" });
          await waitForPlaying(page);
          await pause(reducedMotion ? 300 : 1_500);
          const tag = `${viewport.width}x${viewport.height} ${reducedMotion ? "still" : "motion"}`;
          const top = await page.evaluate(() => {
            const dialog = document.querySelector<HTMLDialogElement>("dialog.tsuki-cutscene");
            const rect = document.getElementById("cutscene-text")?.getBoundingClientRect();
            return { textTop: rect?.top ?? -1, scrollTop: dialog?.scrollTop ?? -1, overflow: (dialog?.scrollHeight ?? 0) - (dialog?.clientHeight ?? 0) };
          });
          assert(top.textTop >= 0 && top.scrollTop === 0, `${tag}: the first lines are cut off or the dialog opened scrolled (${JSON.stringify(top)})`);
          assert(top.overflow > 1, `${tag}: expected the dialog to need scrolling at 200% text size`);
          await page.mouse.move(viewport.width / 2, viewport.height / 2);
          await page.mouse.wheel({ deltaY: 200 });
          await pause(300);
          const scrolled = await page.evaluate(() => ({ dialog: document.querySelector("dialog.tsuki-cutscene")?.scrollTop ?? 0, page: window.scrollY }));
          assert(scrolled.dialog > 0 && scrolled.page === 0, `${tag}: a wheel should scroll the dialog and not the page (${JSON.stringify(scrolled)})`);
          const end = await page.evaluate(async () => {
            const dialog = document.querySelector<HTMLDialogElement>("dialog.tsuki-cutscene");
            if (dialog) dialog.scrollTop = dialog.scrollHeight;
            await new Promise((resolve) => setTimeout(resolve, 100));
            const text = document.getElementById("cutscene-text")?.getBoundingClientRect();
            const control = document.querySelector<HTMLElement>(dialog?.dataset.mode === "still" ? "[data-cutscene-start]" : "[data-cutscene-skip]")?.getBoundingClientRect();
            return { textBottom: text?.bottom ?? -1, innerHeight, controlVisible: control ? control.top >= 0 && control.bottom <= innerHeight : false };
          });
          assert(end.textBottom <= end.innerHeight && end.controlVisible, `${tag}: the end of the text or the control is not reachable (${JSON.stringify(end)})`);
        } finally {
          await context.close();
        }
      }
    }
    return "text starts at the top, a wheel scrolls the dialog (not the page), the last line and the control come into view";
  });
}

/**
 * Appends two real buttons to the controls slot, as a scene would: the probe,
 * whose clicks are counted in window.__probe, and a companion with a longer Thai
 * label, so the layout is checked with a row of two (which wraps at 200%).
 */
const addProbe = (page: Page) =>
  page.evaluate(() => {
    const slot = document.querySelector<HTMLElement>("[data-cutscene-controls]");
    if (!slot) throw new Error("no controls slot");
    const make = (label: string) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tsuki-cutscene__control";
      button.textContent = label;
      return button;
    };
    const probe = make("probe");
    probe.dataset.e2eProbe = "";
    (window as unknown as { __probe: { clicks: number } }).__probe = { clicks: 0 };
    probe.addEventListener("click", () => void (window as unknown as { __probe: { clicks: number } }).__probe.clicks++);
    slot.append(probe, make("ล้างหมอก"));
  });

const probeState = (page: Page) =>
  page.evaluate(() => {
    const dialog = document.querySelector<HTMLDialogElement>("dialog.tsuki-cutscene");
    const probe = document.querySelector<HTMLElement>("[data-e2e-probe]");
    const skip = document.querySelector<HTMLElement>("[data-cutscene-skip]");
    const text = document.getElementById("cutscene-text");
    const box = (element: Element | null) => {
      const rect = element?.getBoundingClientRect();
      return rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null;
    };
    const centre = probe ? probe.getBoundingClientRect() : null;
    const hit = centre ? document.elementFromPoint(centre.left + centre.width / 2, centre.top + centre.height / 2) : null;
    const all = [...document.querySelectorAll("[data-cutscene-controls] > *")].map((control) => {
      const rect = control.getBoundingClientRect();
      const on = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { box: box(control), hit: on !== null && control.contains(on) };
    });
    return {
      all,
      clicks: (window as unknown as { __probe?: { clicks: number } }).__probe?.clicks ?? -1,
      open: dialog?.open ?? false,
      state: dialog?.dataset.state ?? "",
      dialogScrollTop: dialog?.scrollTop ?? -1,
      scrollY: Math.round(window.scrollY),
      probeIsActive: document.activeElement === probe,
      probe: box(probe),
      skip: box(skip),
      text: box(text),
      hit: hit !== null && probe !== null && probe.contains(hit),
      innerWidth,
      innerHeight,
      scrolls: (dialog?.scrollHeight ?? 0) - (dialog?.clientHeight ?? 0) > 1,
    };
  });

type Box = NonNullable<Awaited<ReturnType<typeof probeState>>["probe"]>;
const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

async function checkControlsSlot(browser: Browser): Promise<void> {
  await check("controls slot: outside aria-hidden, after Skip, Space and Enter press a control, never over the text, emptied on close", async () => {
    const problems: string[] = [];
    const cases = [
      ...VIEWPORTS.map((viewport) => ({ viewport, fontSize: undefined as string | undefined })),
      { viewport: VIEWPORTS[0], fontSize: "200%" },
      { viewport: VIEWPORTS[3], fontSize: "200%" },
    ];
    for (const [index, { viewport, fontSize }] of cases.entries()) {
      const tag = `${viewport.width}x${viewport.height}${fontSize ? ` at ${fontSize}` : ""}`;
      const { context, page } = await openPage(browser, { viewport, fontSize, touch: true });
      try {
        await page.goto(sectionUrl("03-decision", "?cutscene=replay"), { waitUntil: "domcontentloaded" });
        await waitForPlaying(page);
        await pause(400);

        const slot = await page.evaluate(() => {
          const dialog = document.querySelector<HTMLDialogElement>("dialog.tsuki-cutscene");
          const slot = document.querySelector<HTMLElement>("[data-cutscene-controls]");
          const skip = document.querySelector<HTMLElement>("[data-cutscene-skip]");
          const named = (button: Element) => (button.getAttribute("aria-label") ?? button.textContent ?? "").trim().length > 0;
          return {
            exists: slot !== null,
            directChild: slot?.parentElement === dialog,
            hiddenAncestor: slot?.closest("[aria-hidden='true'], [inert]") !== null,
            inStage: slot?.closest("[data-cutscene-stage]") !== null,
            inCard: slot?.closest(".tsuki-cutscene__card") !== null,
            afterSkip: skip && slot ? Boolean(skip.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING) : false,
            children: slot ? [...slot.children].map((child) => ({ tag: child.tagName, type: child.getAttribute("type"), named: named(child) })) : [],
            skipFocused: document.activeElement === skip,
          };
        });
        if (!slot.exists) {
          problems.push(`${tag}: no [data-cutscene-controls] in the dialog`);
          continue;
        }
        if (!slot.directChild || slot.hiddenAncestor || slot.inStage || slot.inCard) problems.push(`${tag}: the slot is not a plain child of the dialog (${JSON.stringify(slot)})`);
        if (!slot.afterSkip) problems.push(`${tag}: the slot does not follow Skip in the DOM`);
        for (const child of slot.children) {
          if (child.tag !== "BUTTON" || child.type !== "button" || !child.named) problems.push(`${tag}: a scene control is not a named <button type=button> (${JSON.stringify(child)})`);
        }

        await addProbe(page);
        // Skip first (autofocus), then the controls in DOM order.
        const first = await page.evaluate(() => document.querySelector("[data-cutscene-controls] button")?.hasAttribute("data-e2e-probe") ?? false);
        await page.keyboard.press("Tab");
        const afterTab = await page.evaluate(() => document.activeElement?.closest("[data-cutscene-controls]") !== null && document.activeElement?.tagName === "BUTTON");
        if (!afterTab) problems.push(`${tag}: Tab from Skip did not reach a control`);
        if (first && !(await probeState(page)).probeIsActive) problems.push(`${tag}: Tab from Skip did not land on the first control`);

        let state = await probeState(page);
        const probe = state.probe;
        if (!probe) {
          problems.push(`${tag}: the probe control is not in the page`);
          continue;
        }
        for (const [at, control] of state.all.entries()) {
          const box = control.box;
          if (!box) continue;
          const name = `control ${at + 1}`;
          if (box.width < 44 || box.height < 44) problems.push(`${tag}: ${name} target ${Math.round(box.width)}x${Math.round(box.height)}, under 44 px`);
          if (box.left < 0 || box.top < 0 || box.right > state.innerWidth || box.bottom > state.innerHeight) problems.push(`${tag}: ${name} is outside the viewport`);
          if (!control.hit) problems.push(`${tag}: something covers ${name}`);
          if (state.skip && overlaps(box, state.skip)) problems.push(`${tag}: ${name} overlaps Skip`);
          if (!state.scrolls && state.text && overlaps(box, state.text)) problems.push(`${tag}: ${name} overlaps the epigraph`);
          for (const other of state.all.slice(at + 1)) if (other.box && overlaps(box, other.box)) problems.push(`${tag}: ${name} overlaps another control`);
        }

        // Space and Enter press a control and do nothing else.
        await page.evaluate(() => document.querySelector<HTMLElement>("[data-e2e-probe]")?.focus({ preventScroll: true }));
        const before = await probeState(page);
        await page.keyboard.press("Space");
        await pause(150);
        state = await probeState(page);
        if (state.clicks !== before.clicks + 1) problems.push(`${tag}: Space on the control fired ${state.clicks - before.clicks} clicks`);
        if (!state.open || state.state !== "playing") problems.push(`${tag}: Space on the control ended the cutscene (${state.state})`);
        if (state.dialogScrollTop !== before.dialogScrollTop || state.scrollY !== 0) problems.push(`${tag}: Space on the control scrolled (dialog ${state.dialogScrollTop}, page ${state.scrollY})`);
        await page.keyboard.press("Enter");
        await pause(150);
        state = await probeState(page);
        if (state.clicks !== before.clicks + 2) problems.push(`${tag}: Enter on the control fired ${state.clicks - before.clicks - 1} clicks`);
        if (!state.open || state.state !== "playing") problems.push(`${tag}: Enter on the control ended the cutscene (${state.state})`);
        // A tap on it is a click too, and not a skip.
        await page.touchscreen.tap(probe.left + probe.width / 2, probe.top + probe.height / 2);
        await pause(150);
        state = await probeState(page);
        if (state.clicks !== before.clicks + 3 || !state.open) problems.push(`${tag}: a tap on the control gave ${state.clicks - before.clicks - 2} clicks, open ${state.open}`);

        // When the dialog scrolls (large text) the text card moves over the stage: at the end of the
        // scroll, the last line is above the controls and Skip.
        if (state.scrolls) {
          const end = await page.evaluate(async () => {
            const dialog = document.querySelector<HTMLDialogElement>("dialog.tsuki-cutscene");
            if (dialog) dialog.scrollTop = dialog.scrollHeight;
            await new Promise((resolve) => setTimeout(resolve, 150));
            const text = document.getElementById("cutscene-text")?.getBoundingClientRect();
            const controls = [...document.querySelectorAll("[data-cutscene-controls] > *")].map((control) => control.getBoundingClientRect());
            const skip = document.querySelector("[data-cutscene-skip]")?.getBoundingClientRect();
            return {
              textBottom: text?.bottom ?? -1,
              controlsTop: Math.min(...controls.map((rect) => rect.top)),
              skipTop: skip?.top ?? -1,
              controlsBottom: Math.max(...controls.map((rect) => rect.bottom)),
              innerHeight,
            };
          });
          if (end.textBottom > Math.min(end.controlsTop, end.skipTop) + 0.5) problems.push(`${tag}: at the end of the scroll the text still reaches the controls (${JSON.stringify(end)})`);
          if (end.controlsBottom > end.innerHeight) problems.push(`${tag}: the controls left the viewport when scrolled (${JSON.stringify(end)})`);
        }

        // Emptied when the dialog closes, whichever way it ends.
        if (index % 2 === 0) await page.keyboard.press("Escape");
        else await page.evaluate(() => document.querySelector<HTMLElement>("[data-cutscene-skip]")?.click());
        await waitForClosed(page);
        const after = await page.evaluate(() => ({
          children: document.querySelector("[data-cutscene-controls]")?.children.length ?? -1,
          probe: document.querySelector("[data-e2e-probe]") !== null,
        }));
        if (after.children !== 0 || after.probe) problems.push(`${tag}: the controls slot still holds ${after.children} children after the dialog closed`);
      } finally {
        await context.close();
      }
    }

    // Reduced motion: the still has nothing to operate, so the slot is out of sight and out of the tab order.
    const still = await openPage(browser, { reducedMotion: true });
    try {
      await still.page.goto(sectionUrl("03-decision", "?cutscene=replay"), { waitUntil: "domcontentloaded" });
      await waitForPlaying(still.page);
      await pause(300);
      await addProbe(still.page);
      const hidden = await still.page.evaluate(() => {
        const slot = document.querySelector<HTMLElement>("[data-cutscene-controls]");
        const probe = document.querySelector<HTMLElement>("[data-e2e-probe]");
        const before = document.activeElement;
        probe?.focus();
        const focusable = document.activeElement === probe;
        (before as HTMLElement | null)?.focus();
        return { display: slot ? getComputedStyle(slot).display : "missing", probeRendered: probe ? probe.getClientRects().length > 0 : null, focusable };
      });
      if (hidden.display !== "none" || hidden.probeRendered || hidden.focusable) problems.push(`reduced motion: the slot is not hidden (${JSON.stringify(hidden)})`);
      await still.page.keyboard.press("Enter");
      await waitForClosed(still.page);
      const left = await still.page.evaluate(() => document.querySelector("[data-cutscene-controls]")?.children.length ?? -1);
      if (left !== 0) problems.push(`reduced motion: ${left} children left in the slot after the still closed`);
    } finally {
      await still.context.close();
    }

    assert(problems.length === 0, problems.join("; "));
    return `${cases.length} cases (5 viewports, 200% at 375x812 and 667x375): outside aria-hidden and after Skip, Tab reaches it, Space, Enter and a tap press it without scrolling or skipping, 44 px and clear of Skip and the text, emptied on Escape and Skip; hidden in the still`;
  });
}

async function checkAudioSilence(browser: Browser): Promise<void> {
  await check("the Walkman is off: the scene requests no audio", async () => {
    const { context, page } = await openPage(browser);
    try {
      const audio: string[] = [];
      page.on("request", (request) => {
        if (/\.(mp3|ogg)(\?|$)/.test(request.url())) audio.push(request.url());
      });
      await page.goto(sectionUrl("00-introduction", "?cutscene=replay"), { waitUntil: "domcontentloaded" });
      await waitForPlaying(page);
      await pause(2_000);
      await page.keyboard.press("Escape");
      await waitForClosed(page);
      assert(audio.length === 0, `audio requested with the Walkman off: ${audio.join(", ")}`);
      return "no mp3 or ogg requested";
    } finally {
      await context.close();
    }
  });
}

function printTable(): void {
  const nameWidth = Math.max(5, ...results.map((result) => result.name.length));
  console.log(`\nTsukinomi cutscene e2e against ${BASE}\n`);
  console.log(`${"CHECK".padEnd(nameWidth)}  STATUS  DETAIL`);
  console.log(`${"-".repeat(nameWidth)}  ------  ${"-".repeat(40)}`);
  for (const result of results) {
    console.log(`${result.name.padEnd(nameWidth)}  ${result.status.padEnd(6)}  ${result.detail}`);
  }
  const failed = results.filter((result) => result.status === "FAIL").length;
  const skipped = results.filter((result) => result.status === "SKIP").length;
  console.log(`\n${results.length - failed - skipped} passed, ${failed} failed, ${skipped} skipped`);
}

// Puppeteer's pinned Chrome build may not be downloaded; PUPPETEER_EXECUTABLE_PATH
// points at an installed one (add --no-sandbox in a wrapper when running as root).
async function launchBrowser(extra: { ignoreDefaultArgs?: string[] } = {}): Promise<Browser> {
  return puppeteer.launch({ headless: true, ...extra });
}

async function main(): Promise<void> {
  if (!(await routeExists("tsukinomi/"))) {
    console.error(`tsukinomi-e2e: ${url("tsukinomi/")} is not reachable. Start a dev server or serve dist first.`);
    process.exitCode = 1;
    return;
  }

  const browser = await launchBrowser();
  try {
    await warmUp(browser);
    await checkEveryPartOpens(browser);
    await checkPlayEscapeCooldown(browser);
    await checkSkipButton(browser);
    await checkNaturalEnd(browser);
    await checkReducedMotion(browser);
    await checkSoftNavigation(browser);
    await checkNoFlashCover(browser);
    await checkLayout(browser);
    await checkLargeText(browser);
    await checkControlsSlot(browser);
    await checkAudioSilence(browser);
  } finally {
    await browser.close();
  }
  await checkScrollLock();

  const record = (name: string, problems: string[]) =>
    results.push({ name, status: problems.length ? "FAIL" : "PASS", detail: problems.slice(0, 5).join(" | ") });
  record("no uncaught page errors", pageErrors);
  // A dev server logs its own noise (HMR, dev toolbar); only the cutscene's own messages matter here.
  record("no console errors or cutscene warnings", consoleProblems.filter((message) => /cutscene|tsukinomi|Failed to load|404|TypeError|ReferenceError/i.test(message)));
  record("no third-party host requested", [...thirdParties].map((host) => `requested ${host}`));
  record("no failed request", failedRequests.filter((entry) => !/ERR_ABORTED/.test(entry)));
  printTable();
  if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
}

await main();
