import fs from "fs";

const scopes = [
  {
    file: "src/content/tsukinomi/sections/01-discovery.md",
    start: "## บทที่ 2 — Rain {#ch-2}",
    end: null,
    chapters: "2-3",
  },
  {
    file: "src/content/tsukinomi/sections/02-reveal.md",
    start: "## บทที่ 4 — อากิระ Notices {#ch-4}",
    end: "## บทที่ 5 — What She Remembers {#ch-5}",
    chapters: "4",
  },
];

const allowedSpeakers = new Set([
  "Haruto",
  "Kaori",
  "Akira",
  "Hina",
  "Naomi",
  "Tanaka",
  "Sato",
  "Shopkeeper",
  "ทุกคน",
]);

const forbidden = [
  ["RAW JAPANESE MEAL", /いただきます/],
  ["STALE NICKNAME", /พ่อคนตื่นรู้|คนตื่นรู้/],
  ["HONORIFIC DRIFT", /Haruto-san|Kaori-san/],
  ["THAI SPEAKER LABEL", /^ครูทานากะ:/],
  ["YAMABA DIRECT DIALOGUE", /^Yamaba:/],
  ["KAORI MALE VOICE", /^Kaori:\s*".*(ผม|ครับ)/],
  ["PROSE SLUDGE", /มวลระดับ|กระทำการ|จัดการเดิน|จัดการเปิด|จัดการพิมพ์|ดวงวิญญาณที่แสน|แสงประกายแห่งชีวิตแรก|เดินเดิน|กอดกอด|เบลสายตา|เกอดไหล่/],
  ["OVER-EXPLAINED REGISTER", /ตระหนักรับทราบ|เผชิญหน้ากับความสูญเสีย|โหดร้ายอันแสน|ลึกซึ้งกว่านั้นมาก|เป็นเวลาเกือบสามวินาทีเต็ม/],
];

const issues = [];
let nicknameCount = 0;

for (const scope of scopes) {
  const content = fs.readFileSync(scope.file, "utf8");
  const start = content.indexOf(scope.start);
  if (start === -1) {
    issues.push(`[MISSING SCOPE] ${scope.file}: ${scope.start}`);
    continue;
  }
  const end = scope.end ? content.indexOf(scope.end, start + scope.start.length) : content.length;
  const slice = content.slice(start, end === -1 ? content.length : end);
  const baseLine = content.slice(0, start).split(/\r?\n/).length;
  const lines = slice.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNo = baseLine + index;
    const speakerMatch = line.match(/^([A-Za-z][A-Za-z0-9 .-]{0,39}|ทุกคน):\s*"/);
    if (speakerMatch && !allowedSpeakers.has(speakerMatch[1])) {
      issues.push(`[SPEAKER LABEL] ${scope.file}:${lineNo}: unexpected speaker label "${speakerMatch[1]}"`);
    }

    const nicknameMatches = line.match(/พ่อคนบรรลุธรรม/g);
    if (nicknameMatches) nicknameCount += nicknameMatches.length;

    forbidden.forEach(([label, pattern]) => {
      if (pattern.test(line)) {
        issues.push(`[${label}] ${scope.file}:${lineNo}: ${line}`);
      }
    });
  });
}

if (nicknameCount > 4) {
  issues.push(`[NICKNAME BUDGET] พ่อคนบรรลุธรรม appears ${nicknameCount} times in chapters 2-4; keep it sparse.`);
}

if (issues.length) {
  console.error("=== ROUND 14 VERIFICATION FAILED ===");
  console.error(issues.join("\n"));
  process.exit(1);
}

console.log("=== ROUND 14 VERIFICATION PASSED ===");
console.log(`0 issues found in chapters 2-4; พ่อคนบรรลุธรรม count=${nicknameCount}/4.`);
