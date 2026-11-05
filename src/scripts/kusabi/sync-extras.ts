// Copies the Extra arc from the drafts to the site, the only writer of
// src/content/kusabi/extras/. The draft stays the source of truth; run this after
// editing one.
//
//   pnpm kusabi:sync
//
// Heading and dateline move into frontmatter, CRLF becomes LF, and an entry with
// published: false in src/data/kusabi/units.ts is written as a draft that the
// production build leaves out.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTRA_UNITS } from "../../data/kusabi/units";
import { measureBody } from "../reading-time-core.mjs";

const ROOT = process.cwd();
const SOURCE = join(ROOT, "src/plan/kusabi-house/work/drafts/extra");
const TARGET = join(ROOT, "src/content/kusabi/extras");

/** Shown once the chapter is open, so they may speak of the main story. */
const SUMMARIES: Record<string, string> = {
  e01: "ฤดูใบไม้ผลิ ค.ศ. 2009 ชิองกับอายาเมะเช่าคฤหาสน์หินทำวิจัย และมีเทปม้วนหนึ่งที่เพิ่งได้ป้ายว่ากลับบ้าน",
  e02: "ปลายฤดูใบไม้ร่วง ค.ศ. 2009 ดินสไลด์ น้ำเข้าห้องเตี้ย และบานประตูที่บวมจนเปิดไม่ออก",
  e03: "ผู้ช่วยที่หนีไปย้อนกลับมาที่บ้านหลังนั้น เพื่อเอากระดาษแผ่นเดียว",
  e04: "ฤดูร้อน ค.ศ. 2010 คู่รักนักเดินเขาเข้ามาหลบฝน และชิองจดทุกอย่างที่ผู้ชายทำ",
  e05: "สองวันก่อนแขกคณะสุดท้ายจะมาถึง ชิองเตรียมบ้านเป็นครั้งสุดท้าย",
};

for (const unit of EXTRA_UNITS) {
  const source = readFileSync(join(SOURCE, `${unit.id}.md`), "utf8").replace(/\r\n/g, "\n");
  const match = source.match(/^# E\d+:\s*(.+)\n+(.+)\n+/);
  if (!match) throw new Error(`${unit.id}: expected "# E0N: title" and a dateline at the top`);
  const [head, title, dateline] = match;
  const body = source.slice(head.length).trimEnd();
  const { readingMinutes, wordsThai } = measureBody(body);
  const frontmatter = [
    "---",
    `number: ${unit.number}`,
    `title: ${JSON.stringify(title.trim())}`,
    `slug: ${JSON.stringify(unit.id)}`,
    `dateline: ${JSON.stringify(dateline.trim())}`,
    `summary: ${JSON.stringify(SUMMARIES[unit.id])}`,
    `wordsThai: ${wordsThai}`,
    `readingMinutes: ${readingMinutes}`,
    `draft: ${!unit.published}`,
    "---",
    "",
    "",
  ].join("\n");
  writeFileSync(join(TARGET, `${unit.id}.md`), `${frontmatter}${body}\n`);
  console.log(`${unit.id}: ${title.trim()} (${readingMinutes} min)${unit.published ? "" : " [draft]"}`);
}
