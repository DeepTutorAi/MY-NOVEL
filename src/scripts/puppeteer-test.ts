import puppeteer from "puppeteer";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

async function run() {
  console.log("🚀 Starting Puppeteer test...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Set standard viewport
    await page.setViewport({ width: 1280, height: 800 });

    const targetUrl = "http://localhost:4321/";
    console.log(`🌐 Navigating to: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: "networkidle2" });

    // Verify Title
    const title = await page.title();
    console.log(`✨ Page Title: "${title}"`);

    // Verify presence of novel cards
    console.log("🔍 Checking novel cards...");
    await page.waitForSelector(".novel-card", { timeout: 5000 });
    const cardsCount = await page.$$eval(".novel-card", (cards) => cards.length);
    console.log(`📚 Found ${cardsCount} novel card(s) on the hub!`);

    if (cardsCount === 0) {
      throw new Error("No novel cards found on the page.");
    }

    // Capture screenshot
    const qaDir = join(process.cwd(), ".qa");
    if (!existsSync(qaDir)) {
      mkdirSync(qaDir, { recursive: true });
    }
    const screenshotPath = join(qaDir, "puppeteer-landing.png");
    console.log(`📸 Saving screenshot to: ${screenshotPath}`);
    await page.screenshot({ path: screenshotPath });

    console.log("✅ Puppeteer test passed successfully!");
  } catch (error) {
    console.error("❌ Puppeteer test failed:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
