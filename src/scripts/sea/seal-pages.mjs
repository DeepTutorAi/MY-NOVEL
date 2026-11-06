// Runs after the build: every Sea page is replaced by the gate page carrying that page encrypted.
// Without a password the gate ships with nothing in it, so plain text can never reach the site.
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { deriveSeaKey, sealText } from "./seal-core.mjs";

const MARKER = /<script[^>]*\bid="sea-sealed"[^>]*><\/script>/;

/** @param {string} dir */
async function htmlFiles(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".html")).map((entry) => join(entry.parentPath, entry.name));
}

/**
 * @param {string} seaDir
 * @param {string | undefined} password
 * @returns {Promise<{ pages: number, empty: boolean }>}
 */
export async function sealSeaPages(seaDir, password) {
  const gateDir = join(seaDir, "gate");
  const template = await readFile(join(gateDir, "index.html"), "utf8");
  if (!MARKER.test(template)) throw new Error("The Sea gate page has lost its sealed marker, so the pages cannot be locked.");

  const pages = (await htmlFiles(seaDir)).filter((path) => !path.startsWith(gateDir + sep));
  const key = password ? await deriveSeaKey(password) : null;
  for (const page of pages) {
    const payload = key ? JSON.stringify(await sealText(await readFile(page, "utf8"), key)) : "";
    await writeFile(page, template.replace(MARKER, () => `<script type="application/json" id="sea-sealed">${payload}</script>`));
  }
  await rm(gateDir, { recursive: true, force: true });
  return { pages: pages.length, empty: !key };
}
