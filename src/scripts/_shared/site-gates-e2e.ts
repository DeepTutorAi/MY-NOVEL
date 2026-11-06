// End-to-end check of what is shared across the novels: the reading settings, the developer key
// and the closed Sea, in headless Chrome. It needs a production build on a local server, sealed
// with the password, because a dev server does not seal anything:
//
//   GITHUB_ACTIONS=true SEA_SITE_PASSWORD=... pnpm exec astro build --outDir .qa/dist-hub
//   SEA_SITE_PASSWORD=... DEV_KEY_PASSWORD=... pnpm exec tsx src/scripts/_shared/site-gates-e2e.ts http://localhost:4471/MY-NOVEL
//
// Passwords come from the environment only. Without them, the checks that open things are skipped
// and say so. It wears the attempt counters down on purpose, each in its own browser context.
import puppeteer, { type Browser, type Page } from "puppeteer";
import { DEV_ATTEMPTS_KEY, DEV_KEY_HINT } from "./dev-key-form";

const BASE = (() => {
  const raw = process.argv[2] ?? "http://localhost:4471/MY-NOVEL";
  return raw.endsWith("/") ? raw : `${raw}/`;
})();
const url = (path: string) => new URL(path.replace(/^\//, ""), BASE).href;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const SEA_PASSWORD = process.env.SEA_SITE_PASSWORD;
const DEV_PASSWORD = process.env.DEV_KEY_PASSWORD;
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 360, height: 740, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const NARROW = { width: 320, height: 568, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

const pageErrors: string[] = [];
let failures = 0;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function check(name: string, run: () => Promise<string | void>): Promise<void> {
  try {
    const detail = await run();
    console.log(`PASS  ${name}${detail ? `  (${detail})` : ""}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL  ${name}\n      ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function open(browser: Browser, viewport: Parameters<Page["setViewport"]>[0] = DESKTOP, seed?: Record<string, string>) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(viewport);
  page.on("pageerror", (error) => pageErrors.push(error instanceof Error ? error.message : String(error)));
  await page.evaluateOnNewDocument((entries: Record<string, string>) => {
    if (sessionStorage.getItem("__seeded")) return;
    sessionStorage.setItem("__seeded", "1");
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, seed ?? {});
  return { context, page };
}

const visit = async (page: Page, path: string, settle = 700) => {
  await page.goto(url(path), { waitUntil: "load", timeout: 60_000 });
  await pause(settle);
};

const isHidden = (page: Page, selector: string) =>
  page.$eval(selector, (node) => getComputedStyle(node).display === "none" || (node as HTMLElement).hidden);

// ---- reading settings ----------------------------------------------------------------------------

const NOVELS = [
  { novel: "lodge", article: "article.chapter" },
  { novel: "tsukinomi", article: "article.tsukinomi-section" },
] as const;

async function firstChapterHref(page: Page, listPath: string, prefix: string): Promise<string> {
  await visit(page, listPath, 300);
  const href = await page.evaluate((start: string) => {
    const links = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].map((link) => new URL(link.href).pathname);
    return links.find((path) => path.includes(start) && !path.endsWith(start)) ?? "";
  }, prefix);
  assert(href, `no chapter link under ${prefix}`);
  return `${new URL(href, BASE).href}?resume=1`;
}

async function checkReaderType(browser: Browser): Promise<void> {
  for (const { novel, article } of NOVELS) {
    await check(`${novel}: text size and line spacing apply to the chapter, survive a reload, and stay off the hub`, async () => {
      const { context, page } = await open(browser);
      const list = novel === "lodge" ? "/lodge/chapters/" : "/tsukinomi/sections/";
      const prefix = novel === "lodge" ? "/lodge/chapters/" : "/tsukinomi/sections/";
      const target = await firstChapterHref(page, list, prefix);
      await page.goto(target, { waitUntil: "load", timeout: 60_000 });
      await pause(800);
      const read = () =>
        page.$eval(article, (node) => {
          const paragraph = node.querySelector(":scope > p") ?? node;
          const style = getComputedStyle(paragraph);
          return { size: style.fontSize, line: parseFloat(style.lineHeight) / parseFloat(style.fontSize), width: node.getBoundingClientRect().width };
        });
      const before = await read();
      const pick = async (group: string, value: string) => {
        await page.evaluate(
          (name: string, step: string, kind: string) => {
            const input = document.querySelector<HTMLInputElement>(`[data-reader-type="${kind}"] input[data-reader-${name}][value="${step}"]`);
            if (!input) throw new Error(`no ${name} ${step}`);
            input.click();
          },
          group,
          value,
          novel,
        );
        await pause(150);
      };
      await pick("font", "xl");
      await pick("line", "loose");
      const big = await read();
      assert(big.size === "26px", `size ${big.size}`);
      assert(Math.abs(big.line - 2.25) < 0.01, `line ${big.line}`);
      assert(big.width <= 801, `the column widened to ${big.width}`);
      await page.reload({ waitUntil: "load" });
      await pause(800);
      const kept = await read();
      assert(kept.size === "26px", `after reload: ${kept.size}`);
      assert(await page.$eval(`[data-reader-type="${novel}"] input[data-reader-font][value="xl"]`, (input) => (input as HTMLInputElement).checked), "the control forgot the step");
      await pick("font", "normal");
      await pick("line", "normal");
      const back = await read();
      assert(back.size === before.size, `back to ${back.size}, was ${before.size}`);
      await pick("font", "xl");
      await visit(page, "/", 500);
      const hub = await page.evaluate(() => getComputedStyle(document.body).fontSize);
      assert(hub !== "26px", `the hub is at ${hub}`);
      await context.close();
      return `${before.size} -> ${big.size}`;
    });
  }

  await check("tsukinomi: changing size mid-chapter keeps the place and finishes no chapter", async () => {
    const { context, page } = await open(browser, DESKTOP);
    const target = await firstChapterHref(page, "/tsukinomi/sections/", "/tsukinomi/sections/");
    await page.goto(target, { waitUntil: "load", timeout: 60_000 });
    await pause(800);
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('[data-reader-type="tsukinomi"] input[data-reader-font][value="xl"]');
      input?.click();
    });
    await pause(200);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.evaluate((top: number) => window.scrollTo({ top, behavior: "instant" }), Math.round(height * 0.3));
    await pause(500);
    const place = () =>
      page.evaluate(() => {
        const line = innerHeight * 0.35;
        const blocks = [...document.querySelectorAll("article.tsukinomi-section > *")];
        let current: Element | undefined;
        for (const block of blocks) {
          if (block.getBoundingClientRect().top > line) break;
          current = block;
        }
        const rect = current?.getBoundingClientRect();
        return { text: (current?.textContent ?? "").slice(0, 24), inside: rect ? (line - rect.top) / rect.height : 0 };
      });
    const done = () => page.evaluate(() => Number(localStorage.getItem("tsukinomi:reading:chapters:done:guest")) || 0);
    const before = await place();
    const doneBefore = await done();
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('[data-reader-type="tsukinomi"] input[data-reader-font][value="small"]');
      input?.click();
    });
    await pause(600);
    const after = await place();
    assert(before.text === after.text, `the reader moved from "${before.text}" to "${after.text}"`);
    assert(Math.abs(before.inside - after.inside) < 0.05, `the place inside the block moved: ${before.inside} -> ${after.inside}`);
    assert((await done()) === doneBefore, `chapters done went from ${doneBefore} to ${await done()}`);
    await context.close();
    return `held "${before.text}"`;
  });
}

// ---- developer key ------------------------------------------------------------------------------

const DEV_PAGES = [
  { name: "lodge", path: "/lodge/extra/" },
  { name: "tsukinomi", path: "/tsukinomi/extra/" },
  { name: "kusabi", path: "/kusabi/extra/" },
] as const;

async function tryKey(page: Page, value: string): Promise<void> {
  await page.evaluate(() => {
    const details = document.querySelector<HTMLDetailsElement>("details[data-dev-key]");
    if (details) details.open = true;
  });
  await page.$eval("[data-bypass-input]", (input) => {
    (input as HTMLInputElement).value = "";
  });
  await page.type("[data-bypass-input]", value);
  await page.click("[data-bypass-btn]");
  await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>("[data-bypass-btn]")?.disabled, { timeout: 20_000 });
  await pause(100);
}

async function checkDevKey(browser: Browser): Promise<void> {
  await check("developer key: the hint comes on the third wrong try, the form goes on the fifth and stays gone", async () => {
    const { context, page } = await open(browser);
    await visit(page, "/kusabi/extra/");
    await tryKey(page, "wrong one");
    await tryKey(page, "wrong two");
    assert(await isHidden(page, "[data-bypass-hint]"), "the hint came early");
    await tryKey(page, "wrong three");
    assert(!(await isHidden(page, "[data-bypass-hint]")), "no hint after three");
    const hint = await page.$eval("[data-bypass-hint]", (node) => node.textContent ?? "");
    assert(hint === DEV_KEY_HINT, `hint reads: ${hint}`);
    await tryKey(page, "wrong four");
    assert(!(await isHidden(page, "[data-dev-key]")), "gone too early");
    await tryKey(page, "wrong five");
    assert(await isHidden(page, "[data-dev-key]"), "the form did not go");
    await page.reload({ waitUntil: "load" });
    await pause(600);
    assert(await isHidden(page, "[data-dev-key]"), "a reload brought it back");
    for (const { path } of DEV_PAGES) {
      await visit(page, path);
      assert(await isHidden(page, "[data-dev-key]"), `${path} still offers the form`);
    }
    // A new tab of the same browser, and a day of real time later.
    const tab = await context.newPage();
    await tab.goto(url("/lodge/extra/"), { waitUntil: "load" });
    await pause(500);
    assert(await isHidden(tab, "[data-dev-key]"), "a new tab offers the form");
    await tab.evaluate((key: string) => {
      const state = JSON.parse(localStorage.getItem(key) ?? "{}") as { lockedUntil: number };
      state.lockedUntil = Date.now() - 1000;
      localStorage.setItem(key, JSON.stringify(state));
    }, DEV_ATTEMPTS_KEY);
    await tab.reload({ waitUntil: "load" });
    await pause(500);
    assert(!(await isHidden(tab, "[data-dev-key]")), "the form did not return after the wait");
    assert(await isHidden(tab, "[data-bypass-hint]"), "the hint outlived the wait");
    await context.close();
  });

  if (!DEV_PASSWORD) {
    console.log("SKIP  developer key opens all three novels (DEV_KEY_PASSWORD is not set)");
    return;
  }
  await check("developer key: one password opens all three novels and clears the count", async () => {
    const { context, page } = await open(browser);
    for (const { name, path } of DEV_PAGES) {
      await visit(page, path);
      await tryKey(page, "wrong one");
      await tryKey(page, DEV_PASSWORD);
      await pause(800);
      const stored = await page.evaluate((novel: string) => localStorage.getItem(`${novel === "lodge" ? "hvitveldt" : novel}:extra-bypassed:guest`), name);
      assert(stored && /^[0-9a-f]{64}$/.test(stored), `${name}: nothing saved`);
      assert((await page.evaluate((key: string) => localStorage.getItem(key), DEV_ATTEMPTS_KEY)) === null, `${name}: the count stayed`);
    }
    await visit(page, "/lodge/extra/");
    assert(await page.$eval("[data-extra-content]", (node) => !(node as HTMLElement).hidden), "Lodge's Extra stayed closed");
    await visit(page, "/kusabi/extra/");
    assert(await page.$eval("[data-extra-gate]", (node) => (node as HTMLElement).hidden || getComputedStyle(node).display === "none"), "Kusabi's Extra stayed closed");
    await visit(page, "/tsukinomi/extra/", 1500);
    assert(await page.$eval("[data-train-run]", (node) => !(node as HTMLElement).hidden), "Tsukinomi's train stayed closed");
    await context.close();
  });
}

// ---- closed Sea ---------------------------------------------------------------------------------

async function tryGate(page: Page, value: string): Promise<void> {
  await page.evaluate(() => {
    const details = document.querySelector<HTMLDetailsElement>("details[data-gate-dev]");
    if (details) details.open = true;
  });
  await page.$eval("[data-gate-input]", (input) => {
    (input as HTMLInputElement).value = "";
  });
  await page.type("[data-gate-input]", value);
  await page.click("[data-gate-open]");
}

async function checkSea(browser: Browser): Promise<void> {
  await check("hub: Sea says coming soon, leads to the gate, and the other novels stay open", async () => {
    const { context, page } = await open(browser);
    const response = await page.goto(url("/"), { waitUntil: "load" });
    const html = (await response?.text()) ?? "";
    assert(!html.includes("The Sea That Hung"), "the English title is on the hub");
    const cards = await page.$$eval("[data-novel-slug]", (nodes) =>
      nodes.map((node) => ({ slug: (node as HTMLElement).dataset.novelSlug, locked: !!node.querySelector(".is-disabled"), text: node.textContent ?? "" })),
    );
    for (const card of cards) assert(card.locked === (card.slug === "sea"), `${card.slug} locked: ${card.locked}`);
    const sea = cards.find((card) => card.slug === "sea");
    assert(sea?.text.includes("เร็วๆ นี้") && sea.text.includes("ยังไม่เปิดให้อ่าน"), "the card does not say it");
    await page.click('[data-novel-slug="sea"] a');
    await page.waitForSelector("[data-gate-dev]", { timeout: 15_000 });
    assert(page.url().includes("/sea/"), page.url());
    await context.close();
  });

  await check("sea: the source of every page holds no story, and direct links meet the gate", async () => {
    const { context, page } = await open(browser, NARROW);
    for (const path of ["/sea/", "/sea/chapters/00/", "/sea/chapters/05/", "/sea/arcs/arc-01/01-introduction/"]) {
      const response = await page.goto(url(path), { waitUntil: "load" });
      assert(response?.status() === 200, `${path} answered ${response?.status()}`);
      const source = (await response?.text()) ?? "";
      assert(source.includes('id="sea-sealed"'), `${path} is not sealed`);
      assert(!/The Sea That Hung|sea-prose|THE SEA/.test(source), `${path} shows the novel in its source`);
      assert(/noindex/.test(source), `${path} can be indexed`);
      await pause(300);
      const seen = await page.$eval("body", (node) => node.textContent ?? "");
      assert(seen.includes("ยังไม่เปิดให้อ่าน"), `${path} does not say it is closed`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert(overflow <= 0, `${path} scrolls sideways by ${overflow}px`);
    }
    await context.close();
  });

  await check("sea: three wrong tries wait five hours, even after a reload", async () => {
    const { context, page } = await open(browser);
    await visit(page, "/sea/");
    for (const guess of ["one", "two"]) {
      await tryGate(page, guess);
      await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>("[data-gate-open]")?.disabled, { timeout: 20_000 });
      await pause(100);
      assert(!(await isHidden(page, "[data-gate-error]")), `no error after "${guess}"`);
      assert(!(await isHidden(page, "[data-gate-row]")), "locked too early");
    }
    await tryGate(page, "three");
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>("[data-gate-open]")?.disabled, { timeout: 20_000 });
    await pause(100);
    assert(await isHidden(page, "[data-gate-row]"), "not locked after three");
    const wait = await page.$eval("[data-gate-wait]", (node) => node.textContent ?? "");
    assert(/ลองใหม่ได้/.test(wait), `wait reads: ${wait}`);
    const until = await page.evaluate(() => (JSON.parse(localStorage.getItem("sea:gate-attempts") ?? "{}") as { lockedUntil: number }).lockedUntil - Date.now());
    assert(Math.abs(until - 5 * 3_600_000) < 60_000, `waits ${until}ms`);
    await page.reload({ waitUntil: "load" });
    await pause(400);
    assert(await isHidden(page, "[data-gate-row]"), "a reload lifted the wait");
    await context.close();
    return wait;
  });

  if (!SEA_PASSWORD) {
    console.log("SKIP  sea opens with the password (SEA_SITE_PASSWORD is not set)");
    return;
  }
  await check("sea: the right password opens the real page, with the hub link first, and the next page opens by itself", async () => {
    const { context, page } = await open(browser, PHONE);
    await visit(page, "/sea/chapters/01/");
    await tryGate(page, `  ${SEA_PASSWORD.toLowerCase()} `);
    await page.waitForSelector("body.sea-page", { timeout: 20_000 });
    await pause(800);
    const first = await page.$eval(".sea-topbar-nav a, .sea-topbar-nav button", (node) => node.textContent?.trim());
    assert(first === "ฮับนิยาย", `the first item is ${first}`);
    assert(await page.$eval(".sea-prose", (node) => (node.textContent ?? "").length > 500), "no chapter text");
    assert(page.url().includes("/sea/chapters/01/"), page.url());
    const key = await page.evaluate(() => localStorage.getItem("sea:site-key"));
    assert(key && !key.includes(SEA_PASSWORD), "the key was not saved, or holds the password");
    assert((await page.evaluate(() => localStorage.getItem("sea:gate-attempts"))) === null, "the count stayed");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert(overflow <= 0, `the chapter scrolls sideways by ${overflow}px`);

    await page.goto(url("/sea/chapters/02/"), { waitUntil: "load" });
    await page.waitForSelector("body.sea-page", { timeout: 20_000 });
    await pause(300);
    assert(await page.$eval(".sea-prose", (node) => (node.textContent ?? "").length > 500), "the next chapter did not open");

    await page.goto(url("/sea/#sea-toc"), { waitUntil: "load" });
    await page.waitForSelector("body.sea-page", { timeout: 20_000 });
    await pause(1200);
    const toc = await page.$eval("#sea-toc", (node) => node.getBoundingClientRect().top);
    assert(toc < innerHeightOf(PHONE), `the contents are not in view: ${toc}`);

    // A saved key from before a password change is dropped, and the form returns.
    await page.evaluate(() => localStorage.setItem("sea:site-key", btoa("x".repeat(32))));
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector("[data-gate-dev]", { timeout: 20_000 });
    await pause(300);
    assert((await page.evaluate(() => localStorage.getItem("sea:site-key"))) === null, "a bad key stayed");
    assert(await page.evaluate(() => getComputedStyle(document.body).visibility === "visible"), "the gate stayed hidden");
    await context.close();
  });
}

const innerHeightOf = (viewport: { height: number }) => viewport.height;

async function main(): Promise<void> {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    await checkReaderType(browser);
    await checkDevKey(browser);
    await checkSea(browser);
  } finally {
    await browser.close();
  }
  if (pageErrors.length) {
    failures += 1;
    console.log(`FAIL  no uncaught page errors\n      ${[...new Set(pageErrors)].slice(0, 5).join(" | ")}`);
  } else {
    console.log("PASS  no uncaught page errors");
  }
  console.log(failures ? `${failures} failed` : "all passed");
  if (failures) process.exitCode = 1;
}

await main();
