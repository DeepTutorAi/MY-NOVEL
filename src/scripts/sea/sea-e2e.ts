// End-to-end smoke check of the Sea pages in headless Chrome (puppeteer).
// Not part of the unit test suite: it needs a running server.
//
//   node --import tsx src/scripts/sea/sea-e2e.ts [baseUrl]
//
// baseUrl defaults to http://localhost:4323 and may carry the site base
// (e.g. http://localhost:4800/MY-NOVEL). Against a dev server the draft arc
// entries (chapters 06 and 11) are exercised as well; against a production
// build those checks are skipped because the routes do not exist.
//
// Node-only script: it reads the server-only arc data to know which titles
// must never render.
import puppeteer, { type Browser, type BrowserContext, type Page } from "puppeteer";
import { SEA_ARCS } from "../../data/sea/arcs";
import { SEA_CHAPTER_MANIFEST } from "./sea-chapter-manifest";

type Status = "PASS" | "FAIL" | "SKIP";
interface Result {
  name: string;
  status: Status;
  detail: string;
}

const BASE = (() => {
  const raw = process.argv[2] ?? "http://localhost:4323";
  return raw.endsWith("/") ? raw : `${raw}/`;
})();
const PLAYED_KEY = (arc: number | string) => `sea:cutscene:played:${arc}`;
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 375, height: 812, isMobile: true, hasTouch: true };
const NAV_TIMEOUT = 60_000;

const results: Result[] = [];
const pageErrors: string[] = [];

const url = (path: string) => new URL(path.replace(/^\//, ""), BASE).href;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function check(name: string, run: () => Promise<string | void>): Promise<void> {
  try {
    const detail = await run();
    results.push({ name, status: "PASS", detail: detail ?? "" });
  } catch (error) {
    results.push({ name, status: "FAIL", detail: error instanceof Error ? error.message : String(error) });
  }
}

const skip = (name: string, detail: string) => results.push({ name, status: "SKIP", detail });

async function routeExists(path: string): Promise<boolean> {
  try {
    const response = await fetch(url(path));
    return response.ok;
  } catch {
    return false;
  }
}

interface PageOptions {
  viewport?: typeof DESKTOP | typeof PHONE;
  reducedMotion?: boolean;
  /** Arc numbers whose cutscene counts as already played. */
  played?: number[];
}

async function openPage(browser: Browser, options: PageOptions = {}): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT);
  page.on("pageerror", (error) => pageErrors.push(`${page.url()}: ${error instanceof Error ? error.message : String(error)}`));
  // tsx keeps function names through an injected __name helper, which does not
  // exist in the page; callbacks passed to page.evaluate need it defined.
  await page.evaluateOnNewDocument("globalThis.__name = (fn) => fn;");
  await page.setViewport(options.viewport ?? DESKTOP);
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: options.reducedMotion ? "reduce" : "no-preference" },
  ]);
  if (options.played?.length) {
    // Written from a Sea page so ProfileStorageInterceptor scopes the keys
    // exactly as the runner will read them.
    await page.goto(url("sea/"), { waitUntil: "domcontentloaded" });
    await page.evaluate((list: string[]) => {
      const now = new Date().toISOString();
      for (const key of list) localStorage.setItem(key, now);
    }, options.played.map(PLAYED_KEY));
  }
  return { context, page };
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function cutsceneState(page: Page) {
  return page.evaluate(() => {
    const dialog = document.querySelector<HTMLDialogElement>("dialog.sea-cutscene");
    const active = document.activeElement;
    return {
      exists: Boolean(dialog),
      open: dialog?.open ?? false,
      state: dialog?.dataset.state ?? "",
      mode: dialog?.dataset.mode ?? "",
      scene: dialog?.dataset.scene ?? "",
      activeId: active?.id ?? "",
      activeSkip: active?.matches("[data-cutscene-skip]") ?? false,
      activeStart: active?.matches("[data-cutscene-start]") ?? false,
      covered: document.documentElement.classList.contains("sea-cutscene-pending"),
      search: location.search,
    };
  });
}

const readKey = (page: Page, key: string) => page.evaluate((k: string) => localStorage.getItem(k), key);

async function waitForPlaying(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const dialog = document.querySelector<HTMLDialogElement>("dialog.sea-cutscene");
      return dialog?.open === true && dialog.dataset.state === "playing";
    },
    { timeout },
  );
}

async function waitForDone(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const dialog = document.querySelector<HTMLDialogElement>("dialog.sea-cutscene");
    return dialog !== null && !dialog.open && dialog.dataset.state === "done";
  });
}

/** Watches for ~2.5s (the gate's safety window) that the cutscene never opens. */
async function assertStaysClosed(page: Page, label: string): Promise<void> {
  const deadline = Date.now() + 2_800;
  while (Date.now() < deadline) {
    const state = await cutsceneState(page);
    assert(state.exists, `${label}: no cutscene dialog on the entry chapter`);
    assert(!state.open && state.state !== "playing", `${label}: cutscene opened (state ${state.state})`);
    await pause(200);
  }
  const state = await cutsceneState(page);
  assert(!state.covered, `${label}: page still covered by sea-cutscene-pending`);
}

// First visits on a dev server compile modules on demand; a slow first load
// can outlast the 2.5s no-flash cover and legitimately drop the cutscene.
async function warmUp(browser: Browser, paths: string[]): Promise<void> {
  const { context, page } = await openPage(browser);
  try {
    for (const path of paths) {
      await page.goto(url(path), { waitUntil: "load" });
      await page
        .waitForFunction(
          () => {
            const state = document.querySelector<HTMLDialogElement>("dialog.sea-cutscene")?.dataset.state;
            return state === undefined || state === "playing" || state === "done";
          },
          { timeout: 20_000 },
        )
        .catch(() => undefined);
    }
  } finally {
    await context.close();
  }
}

async function checkHome(browser: Browser, viewport: typeof DESKTOP | typeof PHONE, label: string): Promise<void> {
  await check(`home first viewport (${label})`, async () => {
    const { context, page } = await openPage(browser, { viewport });
    try {
      await page.goto(url("sea/"), { waitUntil: "load" });
      const report = await page.evaluate(() => {
        const inView = (selector: string) => {
          const element = document.querySelector<HTMLElement>(selector);
          if (!element) return `${selector} missing`;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          if (rect.width === 0 || rect.height === 0 || style.visibility === "hidden") return `${selector} not rendered`;
          if (rect.top < 0 || rect.bottom > window.innerHeight) return `${selector} outside the first viewport`;
          return "";
        };
        const problems = [".sea-topbar", "#sea-title", ".sea-ascent-cta"].map(inView).filter(Boolean);
        const cta = document.querySelector<HTMLElement>(".sea-ascent-cta");
        if (cta) {
          const rect = cta.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          if (!hit?.closest(".sea-ascent-cta")) problems.push(`.sea-ascent-cta is covered by ${hit?.tagName ?? "nothing"}`);
        }
        return {
          problems,
          mains: document.querySelectorAll("main").length,
          h1s: document.querySelectorAll("h1").length,
          text: document.body.innerText,
          scrollX: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      assert(report.problems.length === 0, report.problems.join("; "));
      assert(report.mains === 1, `${report.mains} <main> elements`);
      assert(report.h1s === 1, `${report.h1s} <h1> elements`);
      assert(report.scrollX <= 0, `horizontal overflow of ${report.scrollX}px`);
      const lastChapter = Math.max(...SEA_CHAPTER_MANIFEST.map((entry) => entry.number));
      const sealed = SEA_ARCS.filter((arc) => arc.chapterStart > lastChapter);
      const leaked = sealed.flatMap((arc) => [arc.titleTh, arc.titleEn]).filter((title) => report.text.includes(title));
      assert(leaked.length === 0, `sealed arc titles rendered: ${leaked.join(", ")}`);
      return `topbar, title and CTA visible; sealed arcs ${sealed.map((arc) => arc.number).join(",")} untitled`;
    } finally {
      await context.close();
    }
  });
}

async function checkOverlap(browser: Browser): Promise<void> {
  await check("chapter 01 overlap at 375x812", async () => {
    const { context, page } = await openPage(browser, { viewport: PHONE, played: [1] });
    try {
      await page.goto(url("sea/chapters/01/"), { waitUntil: "load" });
      const overlaps: string[] = [];
      for (const fraction of [0, 0.5]) {
        await page.evaluate((f: number) => {
          const prose = document.querySelector<HTMLElement>(".sea-prose");
          if (!prose) return;
          const top = prose.getBoundingClientRect().top + window.scrollY;
          window.scrollTo(0, top + Math.max(0, prose.offsetHeight - window.innerHeight) * f);
        }, fraction);
        await pause(400);
        const found = await page.evaluate(() => {
          const prose = document.querySelector<HTMLElement>(".sea-prose");
          if (!prose) return ["no .sea-prose"];
          const p = prose.getBoundingClientRect();
          const out: string[] = [];
          for (const element of document.querySelectorAll<HTMLElement>("body *")) {
            const style = getComputedStyle(element);
            if (style.position !== "fixed" && style.position !== "sticky") continue;
            if (element.closest(".sea-topbar, .sea-progress-line, astro-dev-toolbar") || element.tagName === "CANVAS") continue;
            if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
            const r = element.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            // Full-viewport decorative layers (backdrop mist, film grain) take no
            // input and are not layout collisions.
            const fullViewport = r.width >= window.innerWidth && r.height >= window.innerHeight;
            if (style.pointerEvents === "none" && fullViewport) continue;
            const visible = r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
            const hits = r.left < p.right && r.right > p.left && r.top < p.bottom && r.bottom > p.top;
            if (visible && hits) {
              const name = element.id ? `#${element.id}` : `${element.tagName.toLowerCase()}.${[...element.classList].join(".")}`;
              out.push(`${name} [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}]`);
            }
          }
          return out;
        });
        overlaps.push(...found.map((entry) => `${Math.round(fraction * 100)}%: ${entry}`));
      }
      assert(overlaps.length === 0, `fixed/sticky elements over the prose: ${overlaps.join("; ")}`);
      return "no fixed/sticky element over .sea-prose at 0% and 50%";
    } finally {
      await context.close();
    }
  });
}

async function checkDrawer(browser: Browser): Promise<void> {
  await check("drawer open / Escape / focus return (375x812)", async () => {
    const { context, page } = await openPage(browser, { viewport: PHONE, played: [1] });
    try {
      await page.goto(url("sea/chapters/01/"), { waitUntil: "load" });
      await page.click("[data-sea-drawer-open]");
      await page.waitForFunction(() => (document.getElementById("sea-chapter-drawer") as HTMLDialogElement | null)?.open === true);
      const inside = await page.evaluate(() => {
        const dialog = document.getElementById("sea-chapter-drawer");
        return {
          focusInside: Boolean(dialog && document.activeElement && dialog.contains(document.activeElement)),
          expanded: document.querySelector("[data-sea-drawer-open]")?.getAttribute("aria-expanded"),
        };
      });
      assert(inside.focusInside, "focus did not move into the drawer");
      assert(inside.expanded === "true", `aria-expanded is ${inside.expanded} while open`);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => (document.getElementById("sea-chapter-drawer") as HTMLDialogElement | null)?.open === false);
      // The dialog's "close" event, which resets aria-expanded and focus, fires a task later.
      await page
        .waitForFunction(
          () => document.querySelector("[data-sea-drawer-open]")?.getAttribute("aria-expanded") === "false",
          { timeout: 2_000 },
        )
        .catch(() => undefined);
      const after = await page.evaluate(() => ({
        onTrigger: document.activeElement?.matches("[data-sea-drawer-open]") ?? false,
        expanded: document.querySelector("[data-sea-drawer-open]")?.getAttribute("aria-expanded"),
      }));
      assert(after.onTrigger, "focus did not return to the drawer trigger");
      assert(after.expanded === "false", `aria-expanded is ${after.expanded} after close`);
      return "focus in drawer, Escape closes, focus back on trigger";
    } finally {
      await context.close();
    }
  });
}

async function checkCutscene(browser: Browser, chapter: string, arc: number, scene: string): Promise<void> {
  await check(`cutscene arc ${arc} (chapter ${chapter})`, async () => {
    const { context, page } = await openPage(browser);
    try {
      const path = `sea/chapters/${chapter}/`;
      // Cleared from the home page: on the chapter itself the runner would
      // write the key again as soon as the cutscene opens.
      await page.goto(url("sea/"), { waitUntil: "domcontentloaded" });
      await page.evaluate((key: string) => localStorage.removeItem(key), PLAYED_KEY(arc));
      await page.goto(url(path), { waitUntil: "domcontentloaded" });
      await waitForPlaying(page);
      let state = await cutsceneState(page);
      assert(state.scene === scene, `scene is ${state.scene}, expected ${scene}`);
      assert(state.mode === "motion", `mode is ${state.mode}, expected motion`);
      assert(state.activeSkip, "focus is not on the skip button");
      assert((await readKey(page, PLAYED_KEY(arc))) !== null, "played key not written when the cutscene opened");
      await pause(600);
      await page.keyboard.press("Escape");
      await waitForDone(page);
      state = await cutsceneState(page);
      assert(state.activeId === "sea-chapter-title", `focus on #${state.activeId || "(none)"} after Escape`);

      await page.reload({ waitUntil: "domcontentloaded" });
      await assertStaysClosed(page, "reload");
      await page.goto(url(`${path}?resume=1`), { waitUntil: "domcontentloaded" });
      await assertStaysClosed(page, "?resume=1");

      await page.goto(url(`${path}?cutscene=replay`), { waitUntil: "domcontentloaded" });
      await waitForPlaying(page);
      await pause(600);
      await page.keyboard.press("Escape");
      await waitForDone(page);
      state = await cutsceneState(page);
      assert(!state.search.includes("cutscene"), `URL kept ${state.search} after replay`);
      assert(state.activeId === "sea-chapter-title", `focus on #${state.activeId || "(none)"} after replay`);
      return "plays once, Escape -> h1, key set, reload and ?resume=1 stay closed, ?cutscene=replay plays";
    } finally {
      await context.close();
    }
  });
}

async function checkReducedMotion(browser: Browser): Promise<void> {
  await check("cutscene reduced motion (static card)", async () => {
    const { context, page } = await openPage(browser, { reducedMotion: true });
    try {
      await page.goto(url("sea/chapters/01/"), { waitUntil: "domcontentloaded" });
      await waitForPlaying(page);
      const state = await cutsceneState(page);
      assert(state.mode === "still", `mode is ${state.mode}, expected still`);
      assert(state.activeStart, "focus is not on the start button");
      const stageVisible = await page.evaluate(() => {
        const stage = document.querySelector<HTMLElement>("[data-cutscene-stage]");
        return stage ? getComputedStyle(stage).display !== "none" && stage.getBoundingClientRect().height > 0 : false;
      });
      await page.click("[data-cutscene-start]");
      await waitForDone(page);
      const after = await cutsceneState(page);
      assert(after.activeId === "sea-chapter-title", `focus on #${after.activeId || "(none)"} after start`);
      return `still card, start button focused, closes to h1 (scene stage ${stageVisible ? "visible" : "hidden"})`;
    } finally {
      await context.close();
    }
  });
}

async function checkResume(browser: Browser): Promise<void> {
  await check("resume round trip (chapter 03 at ~40%)", async () => {
    const { context, page } = await openPage(browser, { played: [1] });
    try {
      await page.goto(url("sea/chapters/03/"), { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await page.evaluate(() => {
        const prose = document.querySelector<HTMLElement>(".sea-prose");
        if (!prose) return;
        const top = prose.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, top + Math.max(0, prose.offsetHeight - window.innerHeight) * 0.4);
      });
      await pause(1_000);
      await page.evaluate(() => window.scrollBy(0, 2));
      await pause(1_000);
      const saved = await page.evaluate(() => {
        const raw = localStorage.getItem("sea:reading:chapter:03");
        return raw ? (JSON.parse(raw) as { progress: number; blockIndex: number; blockExcerpt: string }) : null;
      });
      assert(saved, "no sea:reading:chapter:03 record after scrolling");
      assert(saved.progress > 0.3 && saved.progress < 0.5, `saved progress ${saved.progress} is not near 40%`);

      await page.goto(url("sea/"), { waitUntil: "load" });
      await page.waitForSelector("[data-sea-resume]:not([hidden]) [data-sea-resume-link]", { visible: true });
      const href = await page.$eval("[data-sea-resume-link]", (link) => (link as HTMLAnchorElement).href);
      assert(/\/sea\/chapters\/03\/\?resume=1/.test(href), `resume chip points at ${href}`);
      await page.click("[data-sea-resume-link]");
      await page.waitForFunction(() => /\/sea\/chapters\/03\/$/.test(location.pathname), { timeout: 20_000 });
      await page.waitForSelector(".sea-resume-highlight", { timeout: 10_000 });
      const landed = await page.evaluate(() => {
        const prose = document.querySelector(".sea-prose");
        const blocks = prose ? [...prose.querySelectorAll(":scope > :is(p, h2, h3, blockquote, .current-divider)")] : [];
        const highlighted = document.querySelector(".sea-resume-highlight");
        return {
          index: highlighted ? blocks.indexOf(highlighted) : -1,
          text: (highlighted?.textContent ?? "").replace(/\s+/g, " ").trim(),
          search: location.search,
        };
      });
      assert(landed.index === saved.blockIndex, `highlighted block ${landed.index}, saved ${saved.blockIndex}`);
      assert(landed.text.startsWith(saved.blockExcerpt), "highlighted block text does not match the saved excerpt");
      assert(!landed.search.includes("resume"), `URL kept ${landed.search}`);
      return `saved ${Math.round(saved.progress * 100)}% at block ${saved.blockIndex}; same block highlighted; ?resume removed`;
    } finally {
      await context.close();
    }
  });
}

function printTable(): void {
  const nameWidth = Math.max(5, ...results.map((result) => result.name.length));
  console.log(`\nSea e2e against ${BASE}\n`);
  console.log(`${"CHECK".padEnd(nameWidth)}  STATUS  DETAIL`);
  console.log(`${"-".repeat(nameWidth)}  ------  ${"-".repeat(40)}`);
  for (const result of results) {
    console.log(`${result.name.padEnd(nameWidth)}  ${result.status.padEnd(6)}  ${result.detail}`);
  }
  const failed = results.filter((result) => result.status === "FAIL").length;
  const skipped = results.filter((result) => result.status === "SKIP").length;
  console.log(`\n${results.length - failed - skipped} passed, ${failed} failed, ${skipped} skipped`);
}

// Puppeteer's pinned Chrome build may not be downloaded; fall back to the
// installed stable Chrome. PUPPETEER_EXECUTABLE_PATH overrides both.
async function launchBrowser(): Promise<Browser> {
  try {
    return await puppeteer.launch({ headless: true });
  } catch (error) {
    if (process.env.PUPPETEER_EXECUTABLE_PATH) throw error;
    console.warn("sea-e2e: bundled Chrome not found, using the installed Chrome channel");
    return puppeteer.launch({ headless: true, channel: "chrome" });
  }
}

async function main(): Promise<void> {
  if (!(await routeExists("sea/"))) {
    console.error(`sea-e2e: ${url("sea/")} is not reachable. Start a dev server or serve dist first.`);
    process.exitCode = 1;
    return;
  }
  const draftEntries = SEA_ARCS.filter((arc) => arc.number > 1 && arc.cutscene !== "sealed-depth").map((arc) => ({
    arc: arc.number,
    chapter: String(arc.entryChapter).padStart(2, "0"),
    scene: arc.cutscene,
  }));
  const availableDrafts: typeof draftEntries = [];
  for (const entry of draftEntries) {
    if (await routeExists(`sea/chapters/${entry.chapter}/`)) availableDrafts.push(entry);
  }

  const browser = await launchBrowser();
  try {
    await warmUp(browser, [
      "sea/",
      "sea/chapters/01/",
      "sea/chapters/03/",
      ...availableDrafts.map((entry) => `sea/chapters/${entry.chapter}/`),
    ]);
    await checkHome(browser, DESKTOP, "1280x800");
    await checkHome(browser, PHONE, "375x812");
    await checkOverlap(browser);
    await checkDrawer(browser);
    await checkCutscene(browser, "01", 1, "rain-on-glass");
    await checkReducedMotion(browser);
    await checkResume(browser);
    for (const entry of draftEntries) {
      if (availableDrafts.includes(entry)) await checkCutscene(browser, entry.chapter, entry.arc, entry.scene);
      else skip(`cutscene arc ${entry.arc} (chapter ${entry.chapter})`, "draft route not served (production build)");
    }
  } finally {
    await browser.close();
  }

  if (pageErrors.length) {
    results.push({ name: "no uncaught page errors", status: "FAIL", detail: pageErrors.slice(0, 5).join(" | ") });
  } else {
    results.push({ name: "no uncaught page errors", status: "PASS", detail: "" });
  }
  printTable();
  if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
}

await main();
