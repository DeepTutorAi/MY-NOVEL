import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { deriveSeaKey, exportSeaKey, importSeaKey, normalizeSeaPassword, openSealed, sealText } from "./seal-core.mjs";
import { sealSeaPages } from "./seal-pages.mjs";

const PAGE = "<!doctype html><html lang=th><body><p>ข้อความในบท ไทยและ English</p></body></html>";
const GATE = `<!doctype html><title>gate</title><script type="application/json" id="sea-sealed"></script><p>ยังไม่เปิด</p>`;

describe("the seal", () => {
  it("opens with the right password, whatever its capitals and spacing", async () => {
    const sealed = await sealText(PAGE, await deriveSeaKey("A Long Title Of The Book"));
    assert.equal(await openSealed(sealed, await deriveSeaKey("  a long   title of the BOOK ")), PAGE);
  });

  it("does not open with a wrong one", async () => {
    const sealed = await sealText(PAGE, await deriveSeaKey("A Long Title Of The Book"));
    await assert.rejects(openSealed(sealed, await deriveSeaKey("A Long Title Of The Boo")));
  });

  it("does not open a changed text", async () => {
    const key = await deriveSeaKey("title");
    const sealed = await sealText(PAGE, key);
    const flipped = sealed.data.slice(0, 8) + (sealed.data[8] === "A" ? "B" : "A") + sealed.data.slice(9);
    await assert.rejects(openSealed({ ...sealed, data: flipped }, key));
  });

  it("keeps the key usable across pages after saving it", async () => {
    const key = await deriveSeaKey("title");
    const sealed = await sealText(PAGE, key);
    assert.equal(await openSealed(sealed, await importSeaKey(await exportSeaKey(key))), PAGE);
  });

  it("gives every page its own random start", async () => {
    const key = await deriveSeaKey("title");
    const [one, two] = [await sealText(PAGE, key), await sealText(PAGE, key)];
    assert.notEqual(one.iv, two.iv);
    assert.notEqual(one.data, two.data);
  });

  it("carries a long chapter", async () => {
    const key = await deriveSeaKey("title");
    const long = "ข้อความยาวหนึ่งบรรทัด ".repeat(40_000);
    assert.equal(await openSealed(await sealText(long, key), key), long);
  });

  it("normalises the password", () => {
    assert.equal(normalizeSeaPassword("  The\t Sea  "), "the sea");
  });
});

describe("the sealed build", () => {
  const made: string[] = [];
  after(() => {
    for (const dir of made) rmSync(dir, { recursive: true, force: true });
  });

  const fixture = (gate = GATE) => {
    const sea = mkdtempSync(join(tmpdir(), "sea-seal-"));
    made.push(sea);
    mkdirSync(join(sea, "gate"));
    mkdirSync(join(sea, "chapters", "00"), { recursive: true });
    writeFileSync(join(sea, "gate", "index.html"), gate);
    writeFileSync(join(sea, "index.html"), PAGE);
    writeFileSync(join(sea, "chapters", "00", "index.html"), PAGE);
    return sea;
  };

  it("replaces every page with the gate carrying that page, and removes the gate's own route", async () => {
    const sea = fixture();
    const result = await sealSeaPages(sea, "title");
    assert.deepEqual(result, { pages: 2, empty: false });
    assert.equal(existsSync(join(sea, "gate")), false);
    for (const path of ["index.html", "chapters/00/index.html"]) {
      const html = readFileSync(join(sea, path), "utf8");
      assert.doesNotMatch(html, /ข้อความในบท/, path);
      assert.match(html, /ยังไม่เปิด/, path);
      const sealed = JSON.parse(/id="sea-sealed">([^<]+)</.exec(html)?.[1] ?? "") as { iv: string; data: string };
      assert.equal(await openSealed(sealed, await deriveSeaKey("title")), PAGE);
    }
  });

  it("ships nothing to open when there is no password", async () => {
    const sea = fixture();
    const result = await sealSeaPages(sea, undefined);
    assert.equal(result.empty, true);
    const html = readFileSync(join(sea, "index.html"), "utf8");
    assert.doesNotMatch(html, /ข้อความในบท/);
    assert.match(html, /id="sea-sealed"><\/script>/);
  });

  it("stops the build if the gate cannot carry the pages", async () => {
    const sea = fixture("<!doctype html><p>no marker</p>");
    await assert.rejects(sealSeaPages(sea, "title"), /sealed marker/);
    assert.equal(readFileSync(join(sea, "index.html"), "utf8"), PAGE);
  });
});
