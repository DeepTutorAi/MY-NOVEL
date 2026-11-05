// End-to-end checks of the Kusabi site in headless Chrome. Needs a running server.
//
//   pnpm kusabi:e2e [baseUrl]
//   KUSABI_E2E_ONLY=home pnpm kusabi:e2e ...     (only the checks whose name matches)
//   KUSABI_E2E_SHOTS=dir pnpm kusabi:e2e ...     (save screenshots there)
//
// The unit tests cover the rules; this covers what only a browser can: storage
// through ProfileStorageInterceptor, the network log, soft navigation and the
// rendered pages at each stage of reading.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import puppeteer, { type Browser, type BrowserContext, type Page } from "puppeteer";
import { CHAPTER_UNITS } from "../../data/kusabi/units";

interface Result {
  name: string;
  ok: boolean;
  detail: string;
}

const BASE = (() => {
  const raw = process.argv[2] ?? "http://localhost:4489";
  return raw.endsWith("/") ? raw : `${raw}/`;
})();
const ONLY = process.env.KUSABI_E2E_ONLY ? new RegExp(process.env.KUSABI_E2E_ONLY, "i") : null;
const SHOTS = process.env.KUSABI_E2E_SHOTS ?? "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const PHONE_LANDSCAPE = { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const SMALL_PHONE = { width: 320, height: 568, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

const url = (path: string) => new URL(path.replace(/^\//, ""), BASE).href;
const results: Result[] = [];
const pageErrors: string[] = [];
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let activeBrowser: Browser | null = null;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function check(name: string, run: () => Promise<string | void>): Promise<void> {
  if (ONLY && !ONLY.test(name)) return;
  const started = Date.now();
  let result: Result;
  try {
    result = { name, ok: true, detail: (await run()) ?? "" };
  } catch (error) {
    result = { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
  // A failed check leaves its pages open, and their scenes would slow every later one.
  await Promise.all((activeBrowser?.browserContexts() ?? []).filter((context) => context !== activeBrowser?.defaultBrowserContext()).map((context) => context.close().catch(() => {})));
  results.push(result);
  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`${result.ok ? "PASS" : "FAIL"}  ${name} [${seconds}s]${result.detail ? `  (${result.detail})` : ""}`);
}

const finishedRecord = (id: string, number: number) =>
  JSON.stringify({ chapterId: id, chapterNumber: number, chapterTitle: "t", progress: 1, activeSeconds: 600, maxScrollPct: 1, updatedAt: Date.now() });

/** Storage for a reader who has finished chapters up to and including `upTo`. */
function readerStorage(upTo: number, extras: string[] = [], caseMap = false): Record<string, string> {
  const units = CHAPTER_UNITS.filter((unit) => unit.number <= upTo);
  const store: Record<string, string> = {
    "kusabi:secret:reads": JSON.stringify(units.map((unit) => unit.id)),
  };
  for (const unit of units) store[`kusabi:reading:chapter:${unit.id}`] = finishedRecord(unit.id, unit.number);
  extras.forEach((id, index) => {
    store[`kusabi:reading:extra:${id}`] = finishedRecord(id, index + 1);
  });
  if (caseMap) store["kusabi:secret:case-map"] = "open";
  return store;
}

interface Session {
  context: BrowserContext;
  page: Page;
  requests: string[];
}

async function openSession(browser: Browser, store: Record<string, string>, viewport = DESKTOP): Promise<Session> {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(viewport);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => pageErrors.push(error instanceof Error ? error.message : String(error)));
  page.on("console", (message) => {
    // The E05 check visits that missing page on purpose.
    const expected = /favicon|WebSocket/.test(message.text()) || (message.location().url ?? "").includes("/extra/e05");
    if (message.type() === "error" && !expected) pageErrors.push(`${message.text()} ${message.location().url ?? ""}`);
  });
  // Written through the page's own interceptor, the way the site writes them.
  await page.evaluateOnNewDocument((entries: Record<string, string>) => {
    if (sessionStorage.getItem("__seeded")) return;
    sessionStorage.setItem("__seeded", "1");
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(`${key}:guest`, value);
    // Cutscenes have their own check below; here they would only cover the page.
    for (const chapter of [0, 4, 8, 11, 12]) localStorage.setItem(`kusabi:cutscene:played:${chapter}:guest`, new Date().toISOString());
  }, store);
  return { context, page, requests };
}

async function visit(page: Page, path: string, settle = 900): Promise<void> {
  await page.goto(url(path), { waitUntil: "load", timeout: 60_000 });
  await pause(settle);
}

const shot = async (page: Page, name: string, fullPage = false) => {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.jpg`) as `${string}.jpg`, type: "jpeg", quality: 78, fullPage });
};

const pageText = (page: Page) => page.evaluate(() => document.body.innerText);
const html = (page: Page) => page.evaluate(() => document.documentElement.outerHTML);

async function noHorizontalScroll(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `${label}: page scrolls sideways by ${overflow}px`);
}

const SPOILER_WORDS = /ชิอง|ฆาตกร|อายาเมะ|ริสะหาย|ศพที่บอกคำตอบ|หลังริสะหาย|เสียงของริสะ/;
const FORBIDDEN_FILES = /50s|drafts?|shion|killer|adult|boat|wedding|twins|home-hero/i;

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
  activeBrowser = browser;
  try {
    await check("home: a new reader sees no spoiler and no locked file is requested", async () => {
      const { context, page, requests } = await openSession(browser, {});
      await visit(page, "/kusabi/", 2000);
      const text = await pageText(page);
      assert(!SPOILER_WORDS.test(text), `spoiler on screen: ${text.match(SPOILER_WORDS)?.[0]}`);
      const source = await html(page);
      assert(!/ฆาตกร|อายาเมะ|ริสะหาย/.test(source), "spoiler in the HTML source");
      const vault = requests.filter((request) => /\/vault\/(?!titles)/.test(request));
      assert(vault.length === 0, `requested ${vault.join(", ")}`);
      assert(!requests.some((request) => FORBIDDEN_FILES.test(request)), "requested a forbidden file");
      assert((await page.$$eval(".tape", (tapes) => tapes.length)) === 14, "the shelf must hold 14 tapes");
      await noHorizontalScroll(page, "home desktop");
      await shot(page, "home-desktop");
      await context.close();
      return "14 tapes, no spoiler, no vault file";
    });

    await check("home: the labels fill in only as far as the reader has reached", async () => {
      const { context, page } = await openSession(browser, readerStorage(3));
      await visit(page, "/kusabi/", 1500);
      const labels = await page.$$eval(".tape", (tapes) =>
        tapes.map((tape) => [Number((tape as HTMLElement).dataset.number), tape.querySelector("[data-tape-title]")?.textContent ?? ""] as const),
      );
      for (const [number, title] of labels) {
        if (number <= 4) assert(title.length > 0, `tape ${number} should have a label`);
        else assert(title === "", `tape ${number} should be blank but says ${title}`);
      }
      await shot(page, "home-after-ch3", true);
      await context.close();
    });

    await check("home: the door and the rain follow the story", async () => {
      const states: Array<[number, string]> = [[-1, "ajar"], [4, "closed"], [13, "after"]];
      for (const [upTo, expected] of states) {
        const { context, page } = await openSession(browser, upTo < 0 ? {} : readerStorage(upTo));
        await visit(page, "/kusabi/", 2200);
        const state = await page.$eval("[data-manor-mount]", (mount) => (mount as HTMLElement).dataset.state);
        assert(state === expected, `after ${upTo}: door is ${state}, expected ${expected}`);
        await shot(page, `home-state-${expected}`);
        await context.close();
      }
    });

    await check("home: phone and landscape phone", async () => {
      for (const [name, viewport] of [["phone", PHONE], ["landscape", PHONE_LANDSCAPE]] as const) {
        const { context, page } = await openSession(browser, {}, viewport);
        await visit(page, "/kusabi/", 1800);
        await noHorizontalScroll(page, `home ${name}`);
        await shot(page, `home-${name}`);
        await page.evaluate(() => document.getElementById("kusabi-shelf")?.scrollIntoView({ behavior: "instant" }));
        await pause(400);
        await shot(page, `shelf-${name}`);
        await context.close();
      }
    });

    await check("hub: the Kusabi card uses the stone manor and no spoiler", async () => {
      const { context, page, requests } = await openSession(browser, {});
      await visit(page, "/", 1500);
      assert(requests.some((request) => request.includes("/assets/kusabi/images/cover/card.webp")), "the hub did not load the new card");
      const card = await page.$eval('[data-novel-slug="kusabi"]', (node) => (node as HTMLElement).innerText);
      assert(!/ฆาตกร/.test(card), "the card still says ฆาตกร");
      await context.close();
    });

    await check("reader: progress is saved in the old format and survives", async () => {
      const seeded = { [`kusabi:reading:chapter:01-hinomori-ryokan`]: JSON.stringify({ chapterId: "01-hinomori-ryokan", chapterNumber: 1, chapterTitle: "เก่า", progress: 0.4, activeSeconds: 200, maxScrollPct: 0.4, updatedAt: 1 }) };
      const { context, page } = await openSession(browser, seeded);
      await visit(page, "/kusabi/chapters/01-hinomori-ryokan/?resume=1", 1200);
      const resumed = await page.evaluate(() => window.scrollY / (document.documentElement.scrollHeight - innerHeight));
      assert(Math.abs(resumed - 0.4) < 0.05, `resume landed at ${resumed}`);
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight * 0.6, behavior: "instant" }));
      await pause(1100);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("kusabi:reading:last") ?? "null"));
      assert(saved?.chapterId === "01-hinomori-ryokan" && saved.activeSeconds >= 200, "last-read record is wrong");
      await context.close();
    });

    await check("reader: moving to the next chapter tracks the new chapter only", async () => {
      const { context, page } = await openSession(browser, readerStorage(1));
      await visit(page, "/kusabi/chapters/02-mountain-bride-rumors/", 800);
      await page.evaluate(() => {
        document.querySelector<HTMLAnchorElement>(".end-next")?.click();
      });
      await page.waitForFunction(() => location.pathname.includes("03-lost-item"), { timeout: 20_000 });
      await pause(800);
      await page.evaluate(() => window.scrollTo({ top: 3000, behavior: "instant" }));
      await pause(1100);
      const last = await page.evaluate(() => JSON.parse(localStorage.getItem("kusabi:reading:last") ?? "null")?.chapterId);
      assert(last === "03-lost-item", `the last record belongs to ${last}`);
      await context.close();
    });

    await check("reader: desktop and phone layout, figure opens full size", async () => {
      for (const [name, viewport] of [["desktop", DESKTOP], ["phone", PHONE]] as const) {
        const { context, page } = await openSession(browser, readerStorage(4), viewport);
        await visit(page, "/kusabi/chapters/05-the-first-room/", 1000);
        await noHorizontalScroll(page, `reader ${name}`);
        await shot(page, `reader-top-${name}`);
        const figure = await page.$("figure.kusabi-figure button");
        assert(figure, "the illustration has no zoom button");
        await figure.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
        await pause(700);
        await shot(page, `reader-figure-${name}`);
        await figure.click();
        await pause(300);
        const open = await page.$eval("[data-lightbox]", (dialog) => (dialog as HTMLDialogElement).open);
        assert(open, "the viewer did not open");
        await page.keyboard.press("Escape");
        await pause(200);
        const closed = await page.$eval("[data-lightbox]", (dialog) => !(dialog as HTMLDialogElement).open);
        assert(closed, "Escape did not close the viewer");
        await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
        await pause(500);
        await shot(page, `reader-end-${name}`);
        await context.close();
      }
    });

    await check("reader: REC appears after CH7, can be turned off, and goes quiet after the epilogue", async () => {
      const levels: Array<[number, boolean]> = [[6, false], [7, true], [13, false]];
      for (const [upTo, visible] of levels) {
        const { context, page } = await openSession(browser, readerStorage(upTo));
        await visit(page, "/kusabi/chapters/09-after-risa/", 900);
        const shown = await page.$eval("[data-drift]", (node) => !(node as HTMLElement).hidden);
        assert(shown === visible, `after ${upTo}: REC visible ${shown}`);
        if (visible) {
          await shot(page, "reader-rec");
          await page.evaluate(() => {
            localStorage.setItem("kusabi:settings:hidden-marks", "off");
            window.dispatchEvent(new CustomEvent("kusabi:marks-change"));
          });
          await pause(100);
          const off = await page.$eval("[data-drift]", (node) => (node as HTMLElement).hidden);
          assert(off, "the switch did not hide REC");
        }
        await context.close();
      }
    });

    await check("reader: finishing a chapter announces the unlock once", async () => {
      const seeded = readerStorage(9);
      seeded["kusabi:reading:chapter:10-risas-voice"] = JSON.stringify({ chapterId: "10-risas-voice", chapterNumber: 10, chapterTitle: "t", progress: 0.5, activeSeconds: 700, maxScrollPct: 0.5, updatedAt: 1 });
      const { context, page } = await openSession(browser, seeded);
      await visit(page, "/kusabi/chapters/10-risas-voice/", 800);
      assert(await page.$eval("[data-unlock-toast]", (node) => (node as HTMLElement).hidden), "toast before the end");
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
      await pause(1000);
      const text = await page.$eval("[data-unlock-toast]", (node) => (node as HTMLElement).hidden ? "" : node.textContent ?? "");
      assert(text.includes("แฟ้มใหม่"), `toast says "${text}"`);
      assert(!SPOILER_WORDS.test(text), "the toast itself spoils");
      await shot(page, "reader-unlock-toast");
      const box = await page.$eval("[data-unlock-toast]", (node) => node.getBoundingClientRect().right);
      const column = await page.$eval(".kusabi-prose", (node) => node.getBoundingClientRect().left);
      assert(box <= column, `the toast covers the text: it ends at ${box}, the text starts at ${column}`);
      await pause(12_800);
      assert(await page.$eval("[data-unlock-toast]", (node) => (node as HTMLElement).hidden), "the toast never went away");
      await context.close();
    });

    await check("cutscene: plays, reveals the text, and can be skipped", async () => {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport(DESKTOP);
      await page.goto(url("/kusabi/chapters/12-the-house-closes/"), { waitUntil: "load", timeout: 60_000 });
      await page.waitForFunction(() => document.querySelector<HTMLDialogElement>("dialog.kusabi-cutscene")?.open === true, { timeout: 15_000 });
      await pause(5000);
      const shown = await page.$$eval(".kusabi-cutscene__g.is-shown", (spans) => spans.length);
      assert(shown > 5, `only ${shown} characters revealed`);
      await shot(page, "cutscene-12");
      await page.click("[data-cutscene-skip]");
      await pause(600);
      assert(await page.$eval("dialog.kusabi-cutscene", (dialog) => !(dialog as HTMLDialogElement).open), "skip did not close it");
      await context.close();
    });

    await check("cutscene: all five scenes run on desktop and phone without errors", async () => {
      const chapters = [[0, "00-introduction"], [4, "04-kusabi-house"], [8, "08-risa-is-gone"], [11, "11-marks-that-never-left"], [12, "12-the-house-closes"]] as const;
      for (const [number, id] of chapters) {
        for (const [name, viewport] of [["desktop", DESKTOP], ["phone", PHONE]] as const) {
          const context = await browser.createBrowserContext();
          const page = await context.newPage();
          await page.setViewport(viewport);
          page.on("pageerror", (error) => pageErrors.push(`${id}: ${error instanceof Error ? error.message : String(error)}`));
          await page.goto(url(`/kusabi/chapters/${id}/?cutscene=replay`), { waitUntil: "load", timeout: 60_000 });
          await page.waitForFunction(() => document.querySelector<HTMLDialogElement>("dialog.kusabi-cutscene")?.open === true, { timeout: 15_000 });
          await pause(4500);
          await shot(page, `cutscene-${number}-${name}`);
          await context.close();
        }
      }
    });

    await check("cutscene: reduced motion shows a still and the text at once", async () => {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport(DESKTOP);
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
      await page.goto(url("/kusabi/chapters/08-risa-is-gone/"), { waitUntil: "load", timeout: 60_000 });
      await page.waitForFunction(() => document.querySelector<HTMLDialogElement>("dialog.kusabi-cutscene")?.dataset.mode === "still", { timeout: 15_000 });
      await pause(800);
      assert(await page.$eval("[data-cutscene-start]", (node) => !(node as HTMLElement).hidden), "no continue button");
      await shot(page, "cutscene-still");
      await context.close();
    });

    await check("characters: a new reader sees five files and no name or picture of the rest", async () => {
      const { context, page, requests } = await openSession(browser, {});
      await visit(page, "/kusabi/characters/", 1200);
      const text = await pageText(page);
      assert(!/ชิอง|มาโดกะ|อายาเมะ|หน้ากาก/.test(text), "secret cast on screen");
      const source = await html(page);
      assert(!/ชิอง|มาโดกะ|อายาเมะ/.test(source), "secret cast in the HTML");
      assert((await page.$$eval(".entry:not(.is-locked)", (cards) => cards.length)) === 5, "expected five open files");
      assert(!requests.some((request) => /f0[6-9]\.webp/.test(request)), "a locked portrait was requested");
      assert(!requests.some((request) => /\/vault\//.test(request)), "the vault was asked");
      await noHorizontalScroll(page, "characters");
      await shot(page, "characters-new-reader", true);
      await context.close();
    });

    await check("characters: each stage opens only what it should", async () => {
      const stages: Array<[number, string[], string[]]> = [
        [1, ["มาโดกะคุง", "เจ้าของเรียวกัง"], ["ชิอง", "คนสวมหน้ากาก", "อายาเมะ"]],
        [10, ["มาโดกะคุง", "คนสวมหน้ากาก", "หายไปจากทางแยก"], ["ชิอง", "อายาเมะ"]],
        [11, ["สมุดที่จดพวกเขาไว้", "ยิ้ม", "ขอโทษ", "มาโดกะคุง"], ["ชิอง มาโดกะ", "อายาเมะ"]],
        [12, ["ชิอง มาโดกะ"], ["อายาเมะ", "มาโดกะคุง"]],
        [13, ["ชิอง มาโดกะ", "อายาเมะ", "หกเข็ม"], ["ฮิราซากะ"]],
      ];
      for (const [upTo, present, absent] of stages) {
        const seeded = readerStorage(upTo);
        // A returning reader: no merge animation holds the page.
        seeded["kusabi:secret:seen-files"] = JSON.stringify(["staff", "owner", "mask", "shion", "ayame"]);
        const { context, page } = await openSession(browser, seeded);
        await visit(page, "/kusabi/characters/", 1500);
        const text = await pageText(page);
        for (const word of present) assert(text.includes(word), `after ${upTo}: "${word}" is missing`);
        for (const word of absent) assert(!text.includes(word), `after ${upTo}: "${word}" is showing`);
        await shot(page, `characters-after-${upTo}`, true);
        await context.close();
      }
    });

    await check("characters: the Shion merge plays once on a real first visit", async () => {
      const seeded = readerStorage(12);
      seeded["kusabi:secret:seen-files"] = JSON.stringify(["staff", "owner", "mask"]);
      const { context, page } = await openSession(browser, seeded);
      await visit(page, "/kusabi/characters/", 500);
      assert((await page.$$eval(".entry.is-merging", (nodes) => nodes.length)) === 2, "the two cards should merge");
      await pause(2200);
      assert((await page.$$eval('[data-card="staff"], [data-card="mask"]', (nodes) => nodes.length)) === 0, "old cards remain");
      assert(await page.$eval('[data-card="shion"]', (node) => !(node as HTMLElement).hidden), "new card hidden");
      await context.close();
    });

    await check("extra: locked for a reader at CH12, E05 is never offered", async () => {
      const { context, page, requests } = await openSession(browser, readerStorage(12));
      await visit(page, "/kusabi/extra/", 1200);
      assert(await page.$eval("[data-extra-gate]", (node) => !(node as HTMLElement).hidden), "the gate is gone");
      assert(!requests.some((request) => /\/vault\/x\d/.test(request)), "an Extra file was requested");
      await visit(page, "/kusabi/extra/e01/", 900);
      assert(await page.$eval("article[data-unit-id]", (node) => (node as HTMLElement).hidden), "E01's text is visible");
      assert(await page.$eval("[data-reader-gate]", (node) => !(node as HTMLElement).hidden), "E01's gate is hidden");
      await shot(page, "extra-e01-locked");
      const missing = await page.goto(url("/kusabi/extra/e05/"), { waitUntil: "load", timeout: 60_000 });
      if (!process.env.KUSABI_E2E_DEV) assert(missing?.status() === 404, `E05 answered ${missing?.status()}`);
      await context.close();
    });

    await check("extra: opens one tape at a time and tracks separately from the hub", async () => {
      const { context, page } = await openSession(browser, readerStorage(13));
      await visit(page, "/kusabi/extra/", 1500);
      const open = await page.$$eval('.extra-tape[data-open="true"]', (rows) => rows.map((row) => (row as HTMLElement).dataset.extra));
      assert(open.length === 1 && open[0] === "e01", `open: ${open.join(",")}`);
      await shot(page, "extra-room", true);
      await visit(page, "/kusabi/extra/e01/", 1000);
      assert(await page.$eval("article[data-unit-id]", (node) => !(node as HTMLElement).hidden), "E01 did not open");
      await noHorizontalScroll(page, "extra reader");
      await shot(page, "extra-e01");
      await page.evaluate(() => window.scrollTo({ top: 4000, behavior: "instant" }));
      await pause(1100);
      const records = await page.evaluate(() => ({
        extra: JSON.parse(localStorage.getItem("kusabi:reading:extra-last") ?? "null")?.chapterId,
        main: JSON.parse(localStorage.getItem("kusabi:reading:last") ?? "null")?.chapterId,
      }));
      assert(records.extra === "e01", "the Extra place was not saved");
      assert(records.main !== "e01", "the Extra overwrote the hub's resume place");
      await context.close();
    });

    await check("gallery: frames open with progress; postcards and the sealed file stay shut", async () => {
      const { context, page, requests } = await openSession(browser, readerStorage(3));
      await visit(page, "/kusabi/extra/#kusabi-gallery", 1500);
      const openFrames = await page.$$eval(".frame:not(:disabled)", (frames) => frames.length);
      assert(openFrames === 4, `expected 4 open pictures after CH3, got ${openFrames}`);
      assert(!requests.some((request) => /album\/|chapter-1[0-2]|epilogue/.test(request)), "a locked picture was requested");
      assert(await page.$eval("[data-postcards]", (node) => (node as HTMLElement).hidden), "postcards are visible");
      assert((await pageText(page)).includes("ยังไม่มีคดี"), "the sealed file's label is missing");
      await context.close();
    });

    await check("gallery: the sealed file opens last and says nothing", async () => {
      const { context, page, requests } = await openSession(browser, readerStorage(13, ["e01", "e02", "e03", "e04"], true));
      await visit(page, "/kusabi/extra/#kusabi-gallery", 1800);
      assert(await page.$eval("[data-sealed-frames]", (node) => !(node as HTMLElement).hidden), "the file did not open");
      const faces = await page.$$eval("[data-sealed-frames] img", (images) => images.length);
      assert(faces === 5, `${faces} faces`);
      const words = await page.$eval("[data-sealed]", (node) => (node as HTMLElement).innerText.trim());
      assert(words === "", `the sealed file says: ${words}`);
      assert(!requests.some((request) => FORBIDDEN_FILES.test(request)), "a revealing file name was requested");
      await noHorizontalScroll(page, "gallery");
      await shot(page, "gallery-everything", true);
      await context.close();
    });

    await check("case map: locked before the epilogue and downloads nothing", async () => {
      const { context, page, requests } = await openSession(browser, readerStorage(12));
      await visit(page, "/kusabi/case-map/", 1000);
      assert(await page.$eval("[data-map-locked]", (node) => !(node as HTMLElement).hidden), "not locked");
      assert(!requests.some((request) => /\/vault\/(quiz|map|history)/.test(request)), "the quiz or the map was requested");
      await shot(page, "map-locked");
      await context.close();
    });

    await check("case map: wrong answers give a hint, right ones give digits, the keypad opens the map", async () => {
      const { context, page } = await openSession(browser, readerStorage(13));
      await visit(page, "/kusabi/case-map/", 1300);
      await page.type("[data-quiz-input]", "ไม่ใช่แน่นอน");
      await page.keyboard.press("Enter");
      await pause(200);
      const hint = await page.$eval("[data-quiz-error]", (node) => node.textContent ?? "");
      assert(hint.includes("ลองย้อนไปดู"), `no hint: ${hint}`);
      await shot(page, "map-quiz-wrong");

      const answers: Record<string, string> = {
        "มีบ้านกี่หลัง": "๓๗",
        "ชื่อเต็มว่าอะไร": "ซูซูกิ อากิระ",
        "บอกเวลากี่โมง": "23:11",
        "รหัสที่มิซากิกด": "0307",
        "คนที่เท่าไร": "9",
        "กี่เส้น": "14",
        "ห้องน้ำท่วมคืออะไร": "อย่าเร่ง",
        "ในผนังหลังห้องน้ำท่วม": "คนที่ 11",
        "จอภาพกี่จอ": "2",
        "ใต้ชื่อของริสะ": "ยิ้ม",
        "เรียกชื่ออะไร": "คุณชิอง",
        "มีชื่อใคร": "อายาเมะ",
        "มีคำว่าอะไร": "กลับบ้าน",
        "กี่เข็ม": "หก",
      };
      for (let round = 0; round < 4; round += 1) {
        const question = await page.$eval("[data-quiz-text]", (node) => node.textContent ?? "");
        const key = Object.keys(answers).find((part) => question.includes(part));
        assert(key, `no answer for: ${question}`);
        await page.$eval("[data-quiz-input]", (input) => {
          (input as HTMLInputElement).value = "";
        });
        await page.type("[data-quiz-input]", answers[key]);
        await page.keyboard.press("Enter");
        await pause(250);
      }
      const digits = await page.$$eval("[data-quiz-digits] li", (items) => items.map((item) => item.textContent).join(""));
      assert(/^\d{4}$/.test(digits), `digits: ${digits}`);
      assert(await page.$eval("[data-keypad]", (node) => !(node as HTMLElement).hidden), "the keypad did not appear");
      await shot(page, "map-keypad");

      for (const digit of "0000") await page.click(`[data-key="${digit}"]`);
      await page.click("[data-key-enter]");
      await pause(150);
      if (digits !== "0000") assert(await page.$eval("[data-keypad-error]", (node) => !(node as HTMLElement).hidden), "a wrong code was accepted");

      for (const digit of digits) await page.click(`[data-key="${digit}"]`);
      await page.click("[data-key-enter]");
      await pause(1200);
      assert(await page.$eval("[data-map-open]", (node) => !(node as HTMLElement).hidden), "the map did not open");
      const stored = await page.evaluate(() => localStorage.getItem("kusabi:secret:case-map"));
      assert(stored === "open", "the unlock was not saved");
      await visit(page, "/kusabi/case-map/", 1000);
      assert(await page.$eval("[data-map-open]", (node) => !(node as HTMLElement).hidden), "the map did not stay open");
      await context.close();
      return `code ${digits}`;
    });

    await check("case map: lifting the paper shows the hidden rooms; phone layout holds", async () => {
      for (const [name, viewport] of [["desktop", DESKTOP], ["phone", PHONE]] as const) {
        const { context, page } = await openSession(browser, readerStorage(13, ["e01", "e02", "e03", "e04"], true), viewport);
        await visit(page, "/kusabi/case-map/", 1300);
        const before = await page.$$eval(".pin:not([hidden])", (pins) => pins.length);
        await page.click("[data-plan-lift]");
        await pause(700);
        const after = await page.$$eval(".pin:not([hidden])", (pins) => pins.length);
        assert(before === 10 && after === 12, `pins ${before} then ${after}`);
        await page.click(".pin:not([hidden])");
        assert((await page.$$eval('.stop[data-active="true"]', (rows) => rows.length)) === 1, "the pin selected nothing");
        assert(await page.$eval("[data-history-wrap]", (node) => !(node as HTMLElement).hidden), "history is hidden");
        await noHorizontalScroll(page, `map ${name}`);
        await page.evaluate(() => scrollTo(0, 0));
        await pause(200);
        await shot(page, `map-open-${name}`, true);
        await context.close();
      }
    });

    await check("sizes: every page fits a phone, a landscape phone and a very small phone", async () => {
      const pages = [
        ["home", "/kusabi/"],
        ["characters", "/kusabi/characters/"],
        ["extra", "/kusabi/extra/"],
        ["map", "/kusabi/case-map/"],
        ["reader", "/kusabi/chapters/05-the-first-room/"],
        ["side-story", "/kusabi/extra/e01/"],
      ] as const;
      const sizes = [["phone", PHONE], ["landscape", PHONE_LANDSCAPE], ["small", SMALL_PHONE]] as const;
      const store = readerStorage(13, ["e01", "e02", "e03", "e04"], true);
      for (const [sizeName, viewport] of sizes) {
        const { context, page } = await openSession(browser, store, viewport);
        for (const [pageName, path] of pages) {
          const label = `${pageName} ${sizeName}`;
          await visit(page, path, 900);
          await noHorizontalScroll(page, label);
          const bar = await page.$eval(".kusabi-topbar", (node) => {
            const links = [...node.querySelectorAll<HTMLElement>(".kusabi-topbar-link, .kusabi-topbar-mark")];
            return {
              right: Math.max(...links.map((link) => link.getBoundingClientRect().right)),
              tallest: Math.max(...links.map((link) => link.getBoundingClientRect().height)),
            };
          });
          assert(bar.right <= viewport.width, `${label}: the top bar ends at ${bar.right}`);
          assert(bar.tallest <= 46, `${label}: a top bar label wraps (${bar.tallest}px tall)`);
          await shot(page, `size-${sizeName}-${pageName}`);
        }
        await context.close();
      }
    });

    await check("profiles: progress of one profile does not open files for another", async () => {
      const { context, page } = await openSession(browser, readerStorage(13));
      await visit(page, "/kusabi/characters/", 1200);
      assert((await pageText(page)).includes("อายาเมะ"), "guest should see Ayame");
      await page.evaluate(() => localStorage.setItem("piichan-novels:active-profile-id", "p_test"));
      await visit(page, "/kusabi/characters/", 1200);
      assert(!(await pageText(page)).includes("อายาเมะ"), "another profile sees Ayame");
      await context.close();
    });

    await check("old reader: the checkmark and the 70 percent list still count", async () => {
      const { context, page } = await openSession(browser, {
        "kusabi:secret:reads": JSON.stringify(["01-hinomori-ryokan"]),
        "kusabi:reading:chapter:01-hinomori-ryokan": JSON.stringify({ chapterId: "01-hinomori-ryokan", chapterNumber: 1, chapterTitle: "t", progress: 0.72, activeSeconds: 150, maxScrollPct: 0.72, updatedAt: 1 }),
      });
      await visit(page, "/kusabi/", 1200);
      const state = await page.$eval('[data-tape="01-hinomori-ryokan"]', (node) => (node as HTMLElement).dataset.state);
      assert(state === "read", `state is ${state}`);
      const title = await page.$eval('[data-tape="02-mountain-bride-rumors"] [data-tape-title]', (node) => node.textContent ?? "");
      assert(title.length > 0, "the next tape should be labelled");
      await visit(page, "/kusabi/characters/", 1000);
      assert(!(await pageText(page)).includes("มาโดกะคุง"), "70 percent must not open a file");
      await context.close();
    });

    await check("keyboard: the keypad and the settings can be reached without a mouse", async () => {
      const { context, page } = await openSession(browser, {});
      await visit(page, "/kusabi/", 900);
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      assert(focused === "A" || focused === "BUTTON", `first tab stop is ${focused}`);
      await context.close();
    });

    await check("no page raised an error", async () => {
      assert(pageErrors.length === 0, [...new Set(pageErrors)].slice(0, 6).join(" | "));
    });
  } finally {
    await browser.close();
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exitCode = failed.length > 0 ? 1 : 0;
}

await main();
