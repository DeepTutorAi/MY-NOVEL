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

const waitForWhiteout = (page: Page) =>
  page.waitForFunction(() => document.querySelector<HTMLElement>("[data-whiteout-mount]")?.dataset.whiteout === "live", { timeout: 15_000 });

async function checkWhiteoutLevels(browser: Browser): Promise<void> {
  await check("home whiteout reports the drift level of the reader's finished chapters", async () => {
    const seen: string[] = [];
    for (const [expected, finished] of [
      ["0", {}],
      ["2", finishedThrough(5)],
      ["3", finishedThrough(12)],
      ["1", { 18: 1 }],
    ] as const) {
      await withPage(browser, { seed: progressSeed(finished) }, async (page) => {
        await page.goto(url("lodge/"), { waitUntil: "load" });
        await waitForWhiteout(page);
        const drift = await page.$eval("[data-whiteout-mount]", (el) => (el as HTMLElement).dataset.drift);
        assert(drift === expected, `expected drift ${expected}, got ${drift}`);
        seen.push(drift);
      });
    }
    return `levels ${seen.join(", ")}`;
  });
}

async function checkWhiteoutStill(browser: Browser): Promise<void> {
  await check("home whiteout draws one still frame under reduced motion", async () => {
    await withPage(browser, { reducedMotion: true }, async (page) => {
      await page.goto(url("lodge/"), { waitUntil: "load" });
      await waitForWhiteout(page);
      await page.waitForFunction(() => document.querySelector<HTMLElement>("[data-whiteout-mount]")?.dataset.plate === "ready");
      await pause(300);
      const snap = () => page.$eval(".lodge-whiteout-canvas", (canvas) => (canvas as HTMLCanvasElement).toDataURL("image/png").length);
      const first = await snap();
      await pause(1500);
      assert(first === (await snap()), "the canvas changed under reduced motion");
    });
  });

  await check("home whiteout stops drawing once scrolled to blank paper, and resumes above it", async () => {
    await withPage(browser, {}, async (page) => {
      await page.goto(url("lodge/"), { waitUntil: "load" });
      await waitForWhiteout(page);
      await page.waitForFunction(() => document.querySelector<HTMLElement>("[data-whiteout-mount]")?.dataset.plate === "ready");
      const snap = () => page.$eval(".lodge-whiteout-canvas", (canvas) => (canvas as HTMLCanvasElement).toDataURL("image/png"));
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
      await pause(500);
      const below = await snap();
      await pause(800);
      assert(below === (await snap()), "the faded scene is still being drawn");
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await pause(500);
      const above = await snap();
      await pause(800);
      assert(above !== (await snap()), "the scene did not resume at the top");
    });
  });
}

async function checkWhiteoutNavigation(browser: Browser): Promise<void> {
  await check("home whiteout is torn down on soft navigation and rebuilt once on return", async () => {
    await withPage(browser, {}, async (page) => {
      await page.goto(url("lodge/"), { waitUntil: "load" });
      await waitForWhiteout(page);
      // The top bar's menu also links the contents page, inside a closed <details>.
      await page.click(`.home-secondary-links a[href$="/lodge/chapters/"]`);
      await page.waitForFunction(() => location.pathname.endsWith("/lodge/chapters/"));
      await pause(500);
      const away = await page.evaluate(() => ({
        live: document.body.classList.contains("lodge-whiteout-live"),
        overflow: getComputedStyle(document.body).overflow,
      }));
      assert(!away.live, "lodge-whiteout-live is still on the chapters page");
      assert(away.overflow !== "hidden", "the chapters page cannot scroll");
      await page.goBack();
      await page.waitForFunction(() => document.querySelector<HTMLElement>("[data-whiteout-mount]")?.dataset.whiteout === "live");
      const canvases = await page.$$eval(".lodge-whiteout-canvas", (nodes) => nodes.length);
      assert(canvases === 1, `${canvases} whiteout canvases after returning`);
    });
  });
}

const guestName = (page: Page) => page.$eval("[data-guest-card] [data-guest-name]", (el) => el.textContent?.trim() ?? "");

async function signGuest(page: Page, name: string): Promise<void> {
  await page.$eval("#guest-name", (input) => ((input as HTMLInputElement).value = ""));
  await page.type("#guest-name", name);
  await page.click("[data-guest-sign]");
}

async function checkGuestBook(browser: Browser): Promise<void> {
  await check("guest book: sign, reload, edit, erase and skip", async () => {
    await withPage(browser, {}, async (page) => {
      await page.goto(url("lodge/"), { waitUntil: "load" });
      assert((await guestName(page)) === "________", "an unsigned card shows a blank line");
      await signGuest(page, "  เอลีน่า   วาสเกซ ");
      await page.reload({ waitUntil: "load" });
      assert((await guestName(page)) === "เอลีน่า วาสเกซ", `signed name after reload: ${await guestName(page)}`);
      assert(await page.$eval("[data-guest-form]", (el) => (el as HTMLElement).hidden), "the form stays hidden once signed");
      await page.click("[data-guest-edit]");
      assert((await page.$eval("#guest-name", (el) => (el as HTMLInputElement).value)) === "เอลีน่า วาสเกซ", "edit prefills the name");
      await signGuest(page, "ซาร่า");
      await page.reload({ waitUntil: "load" });
      assert((await guestName(page)) === "ซาร่า", "the edited name persists");
      await page.click("[data-guest-erase]");
      await page.reload({ waitUntil: "load" });
      assert((await guestName(page)) === "________", "erasing returns the blank card");
      await page.click("[data-guest-skip]");
      await page.reload({ waitUntil: "load" });
      assert((await guestName(page)) === "GUEST", "skipping shows GUEST");
    });
  });

  await check("guest book renders a hostile name as text", async () => {
    await withPage(browser, {}, async (page) => {
      await page.goto(url("lodge/"), { waitUntil: "load" });
      await signGuest(page, "<img src=x onerror=alert(1)>");
      assert((await page.$$("[data-guest-card] img")).length === 0, "markup in the name was parsed");
      assert((await guestName(page)).startsWith("<img"), "the name is shown literally");
    });
  });

  await check("guest book keeps a pasted emoji name to 40 whole clusters (the field does not cut them)", async () => {
    const family = "👨‍👩‍👧‍👦";
    await withPage(browser, {}, async (page) => {
      await page.goto(url("lodge/"), { waitUntil: "load" });
      await page.$eval("#guest-name", (input, value) => ((input as HTMLInputElement).value = value), family.repeat(45));
      await page.click("[data-guest-sign]");
      const shown = await guestName(page);
      assert(shown === family.repeat(40), `kept ${[...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(shown)].length} clusters, intact: ${shown === family.repeat(40)}`);
      assert((await page.$eval("#guest-name", (input) => (input as HTMLInputElement).maxLength)) < 0, "the field still caps code units");
    });
  });

  await check("guest book keeps working when storage refuses writes", async () => {
    await withPage(browser, { storageThrows: true }, async (page) => {
      await page.goto(url("lodge/"), { waitUntil: "load" });
      await signGuest(page, "เอลีน่า");
      const notice = await page.$eval("[data-guest-notice]", (el) => ({ hidden: (el as HTMLElement).hidden, text: el.textContent?.trim() }));
      assert(!notice.hidden && notice.text === "เบราว์เซอร์ไม่อนุญาตให้บันทึก ชื่อจะหายเมื่อปิดหน้า", `notice: ${JSON.stringify(notice)}`);
      assert((await guestName(page)) === "เอลีน่า", "the name is kept for the session");
      await page.click(".home-start");
      await page.waitForFunction(() => location.pathname.includes("/lodge/chapters/01-arrival/"));
    });
  });
}

async function checkLedger(browser: Browser): Promise<void> {
  await check("GUEST RECORDS lists every chapter with its reading status and ends with the reader's card", async () => {
    await withPage(browser, { seed: progressSeed({ 1: 1, 2: 0.4 }) }, async (page) => {
      await page.goto(url("lodge/chapters/"), { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector("[data-ledger]")?.getAttribute("data-ledger") === "ready");
      const rows = await page.$$eval("[data-ledger-row]", (nodes) =>
        nodes.map((node) => ({
          id: (node as HTMLElement).dataset.chapterId,
          status: node.querySelector("[data-ledger-status]")?.textContent?.trim() ?? "",
          text: node.textContent ?? "",
          href: node.getAttribute("href") ?? "",
        })),
      );
      assert(rows.length === 19, `${rows.length} rows`);
      assert(rows.every((row, index) => row.id?.startsWith(String(index).padStart(2, "0"))), "rows are in chapter order");
      assert(rows.every((row) => row.href.endsWith(`/lodge/chapters/${row.id}/`)), "every row links its chapter");
      const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
      assert(byId["01-arrival"].status === "READ", `chapter 1: ${byId["01-arrival"].status}`);
      assert(byId["02-first-night"].status === "อ่านไป 40%", `chapter 2: ${byId["02-first-night"].status}`);
      assert(byId["03-morning-without-marcus"].status === "ยังไม่เปิด", `chapter 3: ${byId["03-morning-without-marcus"].status}`);
      assert(!rows.some((row) => row.text.includes("DEPARTED")), "a chapter row says DEPARTED");
      const lastIsCard = await page.$eval("main", (main) => {
        const cards = main.querySelectorAll("[data-guest-card]");
        const rowsInMain = main.querySelectorAll("[data-ledger-row]");
        const last = rowsInMain[rowsInMain.length - 1];
        return cards.length === 1 && Boolean(last.compareDocumentPosition(cards[0]) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      assert(lastIsCard, "the reader's guest card is not the last entry");
    });
  });
}

async function checkCandle(browser: Browser): Promise<void> {
  await check("the reader's candle burns down as the chapter is read", async () => {
    await withPage(browser, { seed: { "hvitveldt:cutscene:played:1": String(Date.now()) } }, async (page) => {
      await page.goto(url("lodge/chapters/03-morning-without-marcus/"), { waitUntil: "load" });
      const read = () =>
        page.$eval(".reader-candle", (el) => ({
          height: Number(getComputedStyle(el).getPropertyValue("--candle-height")),
          flame: (el as HTMLElement).dataset.flame,
          hidden: el.closest(".reader-ambience")?.getAttribute("aria-hidden"),
        }));
      await page.waitForFunction(() => getComputedStyle(document.querySelector(".reader-candle")!).getPropertyValue("--candle-height") !== "");
      const top = await read();
      await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2));
      await pause(600);
      const half = await read();
      assert(top.hidden === "true", "the candle is not aria-hidden");
      assert(half.height < top.height - 0.2, `candle ${top.height} -> ${half.height}`);
      assert(half.flame === "lit", `flame ${half.flame} at half way`);
      return `${top.height.toFixed(2)} -> ${half.height.toFixed(2)}`;
    });
  });
}

const dialogState = (page: Page) =>
  page.evaluate(() => {
    const dialog = document.querySelector<HTMLDialogElement>("dialog.lodge-cutscene");
    return { open: dialog?.open ?? false, state: dialog?.dataset.state ?? "", mode: dialog?.dataset.mode ?? "" };
  });
const waitPlaying = (page: Page) =>
  page.waitForFunction(() => {
    const dialog = document.querySelector<HTMLDialogElement>("dialog.lodge-cutscene");
    return dialog?.open === true && (dialog.dataset.state === "playing" || dialog.dataset.mode === "still");
  });
const waitClosed = (page: Page) => page.waitForFunction(() => !document.querySelector<HTMLDialogElement>("dialog.lodge-cutscene")?.open);

async function checkCutscenes(browser: Browser): Promise<void> {
  const { EPIGRAPHS } = await import("./cutscene/epigraphs");

  await check("cutscene opens with the full epigraph as text and skips at once", async () => {
    await withPage(browser, {}, async (page) => {
      await page.goto(url("lodge/chapters/01-arrival/"), { waitUntil: "domcontentloaded" });
      await waitPlaying(page);
      const text = await page.$eval("#cutscene-text", (el) => el.textContent);
      assert(text === EPIGRAPHS[1], "the epigraph in the DOM differs from the author's text");
      assert(!(await page.evaluate(() => document.body.innerText.includes("▋"))), "the old blinking caret is still there");
      await page.click("[data-cutscene-skip]");
      await waitClosed(page);
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      assert(focused === "H1", `focus went to ${focused}`);
      await page.reload({ waitUntil: "load" });
      await pause(1500);
      assert(!(await dialogState(page)).open, "the cutscene played twice on the same day");
      await page.goto(url("lodge/chapters/01-arrival/", "?cutscene=replay"), { waitUntil: "domcontentloaded" });
      await waitPlaying(page);
      await page.keyboard.press("Escape");
      await waitClosed(page);
    });
  });

  await check("cutscene: opening the notebook by keyboard keeps focus inside the dialog", async () => {
    await withPage(browser, {}, async (page) => {
      await page.goto(url("lodge/chapters/00-introduction/"), { waitUntil: "domcontentloaded" });
      await waitPlaying(page);
      await page.waitForSelector("[data-scene-open]");
      await page.focus("[data-scene-open]");
      await page.keyboard.press("Enter");
      await pause(200);
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return { inDialog: Boolean(el?.closest("dialog.lodge-cutscene")), skip: el?.hasAttribute("data-cutscene-skip") ?? false };
      });
      assert(focused.inDialog && focused.skip, JSON.stringify(focused));
    });
  });

  await check("every epigraph chapter opens its cutscene; other chapters do not", async () => {
    await withPage(browser, {}, async (page) => {
      for (const slug of ["00-introduction", "06-ben-acts-off", "13-into-the-basement", "18-mirror"]) {
        await page.goto(url(`lodge/chapters/${slug}/`), { waitUntil: "domcontentloaded" });
        await waitPlaying(page);
        await page.click("[data-cutscene-skip]");
        await waitClosed(page);
      }
      await page.goto(url("lodge/chapters/02-first-night/"), { waitUntil: "load" });
      assert(!(await page.$("dialog.lodge-cutscene")), "chapter 2 has a cutscene dialog");
    });
  });

  await check("reduced motion shows the still with its continue button", async () => {
    await withPage(browser, { reducedMotion: true }, async (page) => {
      await page.goto(url("lodge/chapters/13-into-the-basement/"), { waitUntil: "domcontentloaded" });
      await waitPlaying(page);
      const state = await dialogState(page);
      assert(state.mode === "still", `mode ${state.mode}`);
      assert(await page.$eval("[data-cutscene-start]", (el) => !(el as HTMLElement).hidden), "no continue button in the still");
      await page.click("[data-cutscene-start]");
      await waitClosed(page);
    });
  });

  await check("going back mid-cutscene leaves the previous page scrollable and the dialog closed", async () => {
    await withPage(browser, {}, async (page) => {
      await page.goto(url("lodge/chapters/"), { waitUntil: "load" });
      await page.click(`.ledger a[href$="/lodge/chapters/06-ben-acts-off/"]`);
      await waitPlaying(page);
      await page.goBack();
      await page.waitForFunction(() => location.pathname.endsWith("/lodge/chapters/"));
      await pause(500);
      const after = await page.evaluate(() => ({
        overflow: getComputedStyle(document.documentElement).overflow + "/" + getComputedStyle(document.body).overflow,
        cover: document.documentElement.classList.contains("lodge-cutscene-pending"),
        open: Boolean(document.querySelector<HTMLDialogElement>("dialog[open]")),
      }));
      assert(!after.overflow.includes("hidden"), `overflow ${after.overflow}`);
      assert(!after.cover && !after.open, JSON.stringify(after));
    });
  });
}

const boardCard = (name: string) => `[data-board-card][data-name="${name}"]`;
const waitBoard = (page: Page) => page.waitForFunction(() => document.querySelector("[data-board]")?.getAttribute("data-board") === "ready");

async function checkBoard(browser: Browser): Promise<void> {
  await check("Karlsen's board: a suspicion pin persists, and works for the session when storage refuses it", async () => {
    await withPage(browser, {}, async (page) => {
      await page.goto(url("lodge/characters/"), { waitUntil: "load" });
      await waitBoard(page);
      await page.click(`${boardCard("Diana Webb")} [data-suspect]`);
      await page.reload({ waitUntil: "load" });
      await waitBoard(page);
      const pressed = await page.$eval(`${boardCard("Diana Webb")} [data-suspect]`, (el) => el.getAttribute("aria-pressed"));
      assert(pressed === "true", `after reload aria-pressed=${pressed}`);
    });
    await withPage(browser, { storageThrows: true }, async (page) => {
      await page.goto(url("lodge/characters/"), { waitUntil: "load" });
      await waitBoard(page);
      await page.click(`${boardCard("Ben Ross")} [data-suspect]`);
      const pressed = await page.$eval(`${boardCard("Ben Ross")} [data-suspect]`, (el) => el.getAttribute("aria-pressed"));
      assert(pressed === "true", "the pin did not toggle without storage");
    });
  });

  await check("Karlsen's board stamps what the reader has finished and crosses out what was overturned", async () => {
    await withPage(browser, { seed: progressSeed(finishedThrough(7)) }, async (page) => {
      await page.goto(url("lodge/characters/"), { waitUntil: "load" });
      await waitBoard(page);
      const marcus = await page.$$eval(`${boardCard("Marcus Hale")} [data-stamp]`, (nodes) => nodes.map((n) => [n.textContent?.trim(), n.classList.contains("is-superseded")]));
      assert(JSON.stringify(marcus) === JSON.stringify([["MISSING", true], ["DEAD", true], ["BODY GONE", false]]), JSON.stringify(marcus));
      // Crossed out for screen readers too, not only by styling.
      const struck = await page.$$eval(`${boardCard("Marcus Hale")} [data-stamp].is-superseded`, (nodes) => nodes.length > 0 && nodes.every((n) => n.querySelector("s, del") !== null));
      assert(struck, "a superseded stamp is crossed out only visually");
      const file = await page.$eval(`${boardCard("Diana Webb")} [data-file-number]`, (el) => ({ hidden: (el as HTMLElement).hidden, text: el.textContent?.trim() }));
      assert(!file.hidden && file.text === "Subject 4", JSON.stringify(file));
    });
    await withPage(browser, {}, async (page) => {
      await page.goto(url("lodge/characters/"), { waitUntil: "load" });
      await waitBoard(page);
      assert((await page.$$("[data-stamp]")).length === 0, "a new reader sees stamps");
      assert(await page.$eval(`${boardCard("Diana Webb")} [data-file-number]`, (el) => (el as HTMLElement).hidden), "a new reader sees file numbers");
    });
  });

  await check("Karlsen's board never scrolls sideways (cards leave overflow visible for the pin)", async () => {
    const sizes = [
      { width: 375, height: 812 },
      { width: 667, height: 375 },
      { width: 700, height: 900 },
      { width: 760, height: 900 },
      { width: 812, height: 375 },
      { width: 1280, height: 800 },
    ];
    const wide: string[] = [];
    for (const viewport of sizes) {
      await withPage(browser, { viewport, seed: progressSeed(finishedThrough(18)) }, async (page) => {
        await page.goto(url("lodge/characters/"), { waitUntil: "load" });
        await waitBoard(page);
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        if (scrollWidth > viewport.width) wide.push(`${viewport.width}x${viewport.height}: ${scrollWidth}px`);
      });
    }
    assert(wide.length === 0, wide.join(", "));
  });

  await check("the Subject 8 card still unlocks after chapter 17 at 80 percent", async () => {
    await withPage(browser, { seed: progressSeed({ 16: 0.9 }) }, async (page) => {
      await page.goto(url("lodge/characters/"), { waitUntil: "load" });
      assert(await page.$eval(boardCard("Subject 8"), (el) => (el as HTMLElement).hidden), "Subject 8 shown after chapter 16");
    });
    await withPage(browser, { seed: progressSeed({ 17: 0.85 }) }, async (page) => {
      await page.goto(url("lodge/characters/"), { waitUntil: "load" });
      assert(!(await page.$eval(boardCard("Subject 8"), (el) => (el as HTMLElement).hidden)), "Subject 8 hidden after chapter 17");
    });
  });
}

async function checkFinale(browser: Browser): Promise<void> {
  const guest = JSON.stringify({ name: "สมชาย", signedAt: "2026-10-13T00:00:00.000Z", skipped: false });

  await check("finale: after all 18 chapters the home is mirrored, the card is referred by E. VASQUEZ, the name drifts", async () => {
    await withPage(browser, { seed: { ...progressSeed(finishedThrough(18)), "hvitveldt:guest": guest } }, async (page) => {
      await page.goto(url("lodge/"), { waitUntil: "load" });
      await waitForWhiteout(page);
      const home = await page.evaluate(() => ({
        drift: document.querySelector<HTMLElement>("[data-whiteout-mount]")?.dataset.drift,
        mirrored: document.querySelector<HTMLElement>("[data-whiteout-mount]")?.dataset.mirrored,
        titleTransform: getComputedStyle(document.querySelector("h1")!).transform,
        note: (() => {
          const el = document.querySelector<HTMLElement>("[data-finale-note]");
          return el && !el.hidden ? el.textContent?.trim() : null;
        })(),
        referred: document.querySelector("[data-guest-card] [data-guest-referred]")?.textContent?.trim(),
        drifted: document.querySelectorAll("[data-guest-card] .hand-g--s").length,
      }));
      assert(home.drift === "4" && home.mirrored === "true", JSON.stringify(home));
      assert(home.titleTransform === "none", `title transform ${home.titleTransform}`);
      assert(home.note === "รอบถัดไป · กุมภาพันธ์ 2026", `note ${home.note}`);
      assert(home.referred === "E. VASQUEZ", `referred ${home.referred}`);
      assert(home.drifted === 1, `${home.drifted} drifted ส in the signature`);
    });
  });

  await check("finale: the board pins the reader's card last and remembers whom they suspected", async () => {
    const seed = { ...progressSeed(finishedThrough(18)), "hvitveldt:guest": guest, "hvitveldt:suspects": JSON.stringify(["Diana Webb"]) };
    await withPage(browser, { seed }, async (page) => {
      await page.goto(url("lodge/characters/"), { waitUntil: "load" });
      await waitBoard(page);
      const board = await page.evaluate(() => {
        const finale = document.querySelector<HTMLElement>("[data-board-finale]");
        const line = document.querySelector<HTMLElement>("[data-board-suspected]");
        return {
          shown: Boolean(finale && !finale.hidden),
          cardLast: Boolean(finale?.querySelector("[data-guest-card]")),
          line: line?.textContent?.trim() ?? "",
          elena: Array.from(document.querySelectorAll('[data-board-card][data-name="Elena Vasquez"] [data-stamp]')).map((n) => n.textContent?.trim()).pop(),
        };
      });
      assert(board.shown && board.cardLast, JSON.stringify(board));
      assert(board.line.includes("Diana Webb") && board.line.includes("ไม่เคยสงสัย Elena Vasquez"), board.line);
      assert(board.elena === "SUBJECT 8", `Elena's last stamp ${board.elena}`);
    });
  });

  await check("finale: a reader who skipped to chapter 18 sees none of it", async () => {
    await withPage(browser, { seed: { ...progressSeed({ 18: 1 }), "hvitveldt:guest": guest } }, async (page) => {
      await page.goto(url("lodge/"), { waitUntil: "load" });
      await waitForWhiteout(page);
      const home = await page.evaluate(() => ({
        drift: document.querySelector<HTMLElement>("[data-whiteout-mount]")?.dataset.drift,
        mirrored: document.querySelector<HTMLElement>("[data-whiteout-mount]")?.dataset.mirrored ?? "false",
        note: document.querySelector<HTMLElement>("[data-finale-note]")?.hidden,
        referred: document.querySelector("[data-guest-card] [data-guest-referred]")?.textContent?.trim(),
      }));
      assert(home.drift === "1" && home.mirrored === "false" && home.note === true && home.referred === "", JSON.stringify(home));
      await page.goto(url("lodge/characters/"), { waitUntil: "load" });
      await waitBoard(page);
      assert(await page.$eval("[data-board-finale]", (el) => (el as HTMLElement).hidden), "the board finale shows");
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
    await checkWhiteoutLevels(browser);
    await checkWhiteoutStill(browser);
    await checkWhiteoutNavigation(browser);
    await checkGuestBook(browser);
    await checkLedger(browser);
    await checkCandle(browser);
    await checkCutscenes(browser);
    await checkBoard(browser);
    await checkFinale(browser);
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
