// End-to-end checks of the Lodge rework in headless Chrome (puppeteer). Not part
// of the unit test suite: it needs a running server.
//
//   pnpm lodge:e2e [baseUrl]
//   LODGE_E2E_ONLY=guest pnpm lodge:e2e ...     (only the checks whose name matches)
//
// baseUrl defaults to http://localhost:4321 and may carry the site base (for
// example http://localhost:4470/MY-NOVEL). The unit tests cover the rules; this
// covers what only a browser can: storage through ProfileStorageInterceptor,
// soft navigation, focus, reduced motion and the rendered DOM.
//
// Not covered here: frame time and flash safety (pnpm lodge:measure), real touch
// devices, Safari, Firefox and audible audio.
import puppeteer, { type Browser, type BrowserContext, type Page } from "puppeteer";

type Status = "PASS" | "FAIL";
interface Result {
  name: string;
  status: Status;
  detail: string;
}

const BASE = (() => {
  const raw = process.argv[2] ?? "http://localhost:4321";
  return raw.endsWith("/") ? raw : `${raw}/`;
})();
const DESKTOP = { width: 1280, height: 800 };
const NAV_TIMEOUT = 60_000;
const ONLY = process.env.LODGE_E2E_ONLY ? new RegExp(process.env.LODGE_E2E_ONLY, "i") : null;

const results: Result[] = [];
const pageErrors: string[] = [];
const consoleProblems: string[] = [];
const thirdParties = new Set<string>();
const failedRequests: string[] = [];

export const url = (path: string, query = "") => `${new URL(path.replace(/^\//, ""), BASE).href}${query}`;

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function check(name: string, run: () => Promise<string | void>): Promise<void> {
  if (ONLY && !ONLY.test(name)) return;
  try {
    const detail = await run();
    results.push({ name, status: "PASS", detail: detail ?? "" });
  } catch (error) {
    results.push({ name, status: "FAIL", detail: error instanceof Error ? error.message : String(error) });
  }
}

interface PageOptions {
  viewport?: { width: number; height: number };
  reducedMotion?: boolean;
  /** Keys written through the page's own localStorage (and so through ProfileStorageInterceptor) before the test navigates. */
  seed?: Record<string, string>;
  /** Make localStorage.setItem throw, as in a locked-down browser. */
  storageThrows?: boolean;
}

async function openPage(browser: Browser, options: PageOptions = {}): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT);
  page.on("pageerror", (error) => pageErrors.push(`${page.url()}: ${error instanceof Error ? error.message : String(error)}`));
  page.on("console", (message) => {
    if (message.type() === "error") consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("request", (request) => {
    const target = request.url();
    if (/^https?:/.test(target) && !target.startsWith(new URL(BASE).origin)) thirdParties.add(new URL(target).host);
  });
  page.on("requestfailed", (request) => failedRequests.push(`${request.url()} ${request.failure()?.errorText ?? ""}`));
  // tsx keeps function names through an injected __name helper that the page lacks.
  await page.evaluateOnNewDocument("globalThis.__name = (fn) => fn;");
  await page.setViewport(options.viewport ?? DESKTOP);
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: options.reducedMotion ? "reduce" : "no-preference" }]);
  if (options.seed) {
    await page.goto(url("lodge/chapters/"), { waitUntil: "domcontentloaded" });
    await page.evaluate((entries: Array<[string, string]>) => {
      for (const [key, value] of entries) localStorage.setItem(key, value);
    }, Object.entries(options.seed));
  }
  if (options.storageThrows) {
    await page.evaluateOnNewDocument(`Storage.prototype.setItem = function () { throw new DOMException("blocked", "SecurityError"); };`);
  }
  return { context, page };
}

/** Reading records for chapters 1..n at the given progress, in the shape ReadingProgress saves. */
export function progressSeed(chapters: Record<number, number>): Record<string, string> {
  const slugs: Record<number, string> = {
    1: "01-arrival", 2: "02-first-night", 3: "03-morning-without-marcus", 4: "04-searching", 5: "05-second-night",
    6: "06-ben-acts-off", 7: "07-first-loss", 8: "08-the-library", 9: "09-the-long-night", 10: "10-escape-attempt",
    11: "11-the-long-day", 12: "12-ben-returns", 13: "13-into-the-basement", 14: "14-marcus", 15: "15-what-vincent-knows",
    16: "16-the-way-up", 17: "17-karasjok", 18: "18-mirror",
  };
  const seed: Record<string, string> = {};
  for (const [chapter, progress] of Object.entries(chapters)) {
    const id = slugs[Number(chapter)];
    seed[`hvitveldt:reading:chapter:${id}`] = JSON.stringify({ chapterId: id, chapterNumber: chapter, chapterTitle: "", progress });
  }
  return seed;
}

export const finishedThrough = (last: number, extra: number[] = []): Record<number, number> =>
  Object.fromEntries([...Array.from({ length: last }, (_, i) => i + 1), ...extra].map((n) => [n, 1]));

async function withPage<T>(browser: Browser, options: PageOptions, run: (page: Page) => Promise<T>): Promise<T> {
  const { context, page } = await openPage(browser, options);
  try {
    return await run(page);
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const PAGES = ["lodge/", "lodge/chapters/", "lodge/chapters/01-arrival/", "lodge/characters/", "lodge/puzzle/", "lodge/extra/"];

async function checkPagesLoad(browser: Browser): Promise<void> {
  await check("every Lodge page answers 200 and renders its main landmark", async () => {
    await withPage(browser, {}, async (page) => {
      for (const path of PAGES) {
        const response = await page.goto(url(path), { waitUntil: "load" });
        assert(response?.ok(), `${path} answered ${response?.status()}`);
        assert(await page.$("main"), `${path} has no <main>`);
      }
    });
  });
}

async function checkChapterReadable(browser: Browser): Promise<void> {
  await check("a chapter shows its text when the cutscene was already played", async () => {
    await withPage(browser, { seed: { "hvitveldt:cutscene:played:1": String(Date.now()) } }, async (page) => {
      await page.goto(url("lodge/chapters/01-arrival/"), { waitUntil: "load" });
      const paragraphs = await page.$$eval("article.chapter p", (nodes) => nodes.length);
      assert(paragraphs > 50, `only ${paragraphs} paragraphs`);
    });
  });
}

function printTable(): void {
  const width = Math.max(...results.map((result) => result.name.length));
  for (const result of results) console.log(`${result.status.padEnd(5)} ${result.name.padEnd(width)}  ${result.detail}`);
  const failed = results.filter((result) => result.status === "FAIL").length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
}

async function main(): Promise<void> {
  try {
    if (!(await fetch(url("lodge/"))).ok) throw new Error("not ok");
  } catch {
    console.error(`lodge-e2e: ${url("lodge/")} is not reachable. Start a dev server or serve dist first.`);
    process.exitCode = 1;
    return;
  }
  // Puppeteer's pinned Chrome may not be downloaded; PUPPETEER_EXECUTABLE_PATH points at an installed one.
  const browser = await puppeteer.launch({ headless: true });
  try {
    await checkPagesLoad(browser);
    await checkChapterReadable(browser);
  } finally {
    await browser.close();
  }

  const record = (name: string, problems: string[]) =>
    results.push({ name, status: problems.length ? "FAIL" : "PASS", detail: problems.slice(0, 5).join(" | ") });
  record("no uncaught page errors", pageErrors);
  record("no console errors", consoleProblems.filter((message) => !/\[vite\]|\[astro\]/i.test(message)));
  record("no third-party host requested", [...thirdParties].map((host) => `requested ${host}`));
  record("no failed request", failedRequests.filter((entry) => !/ERR_ABORTED/.test(entry)));
  printTable();
  if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
}

await main();
