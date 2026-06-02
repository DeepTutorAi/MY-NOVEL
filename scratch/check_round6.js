import fs from 'fs';

const filePath = 'src/content/tsukinomi/sections/04-mountain.md';
const text = fs.readFileSync(filePath, 'utf8');
const failures = [];

function lineNumber(index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

const startHeader = '## บทที่ 11 — Mizushima House {#ch-11}';
const endHeader = '## บทที่ 13 — The Mountain {#ch-13}';
const start = text.indexOf(startHeader);
const end = text.indexOf(endHeader);

if (start === -1 || end === -1 || end <= start) {
  console.error('[STRUCTURE] Could not isolate chapters 11-12 in 04-mountain.md');
  process.exit(1);
}

const scopedText = text.slice(start, end);
const scopedStartLine = lineNumber(start);
const scopedLines = scopedText.split(/\r?\n/);

function report(kind, lineOffset, message) {
  failures.push(`[${kind}] ${filePath}:${scopedStartLine + lineOffset}: ${message}`);
}

const forbiddenNeedles = [
  ['JAPANESE LEAK', 'おはよう', 'Raw Japanese greeting remains'],
  ['JAPANESE LEAK', 'ただいま', 'Raw Japanese homecoming phrase remains'],
  ['JAPANESE LEAK', 'おかえり', 'Raw Japanese welcome-home phrase remains'],
  ['JAPANESE LEAK', 'いってきます', 'Raw Japanese leaving-home phrase remains'],
  ['JAPANESE LEAK', 'いってらっしゃい', 'Raw Japanese send-off phrase remains'],
  ['JAPANESE LEAK', 'いただきます', 'Raw Japanese meal phrase remains'],
  ['JAPANESE LEAK', 'Konban', 'Romanized Japanese greeting remains'],
  ['NAMING', 'Kaori-san', 'Romanized Kaori-san remains'],
  ['NAMING', 'คาโอริซัง', 'Thai Kaori-san remains'],
  ['NAMING', 'Haruto-kun', 'Romanized Haruto-kun remains'],
  ['AKIRA NICKNAME', 'buddha', 'English nickname remains; canonical nickname is คนตื่นธรรม'],
  ['AKIRA NICKNAME', 'พ่อพระ', 'Old Thai nickname remains; canonical nickname is คนตื่นธรรม'],
  ['YAMABA VOICE', 'Yamaba:', 'Yamaba should not have direct dialogue'],
  ['KAORI VOICE', 'ผมรักคุณ Haruto-kun', 'Kaori stale male-pronoun line remains'],
  ['KAORI VOICE', 'ผมไม่สมควร', 'Kaori stale male-pronoun line remains'],
  ['KAORI VOICE', 'ผมไม่รู้จักพ่อคุณ', 'Kaori stale male-pronoun line remains'],
  ['KAORI VOICE', 'เสียมันเพื่อผม', 'Kaori stale male-pronoun line remains'],
  ['KAORI VOICE', 'ความทรงจำของคุณเกี่ยวกับผมทั้งหมด', 'Kaori stale male-pronoun line remains'],
  ['KAORI VOICE', 'รำลึกถึงผม', 'Kaori stale male-pronoun line remains'],
  ['KAORI VOICE', 'ผมรอลุกมา', 'Kaori stale male-pronoun line remains'],
  ['AKIRA VOICE', 'ผมรู้นาย', 'Akira stale formal pronoun with Haruto remains'],
  ['AKIRA VOICE', '"...ผมเคารพ"', 'Akira stale formal pronoun with Haruto remains'],
  ['AKIRA VOICE', 'นั่งโต๊ะข้างผม', 'Akira stale formal pronoun with Haruto remains'],
  ['AKIRA VOICE', 'นายรู้ผมรัก', 'Akira stale formal pronoun with Haruto remains'],
  ['AKIRA VOICE', 'ผมไม่ขึ้นวันนี้', 'Akira stale formal pronoun with Haruto remains'],
  ['AKIRA VOICE', 'ผมรอที่บ้าน', 'Akira stale formal pronoun with Haruto remains'],
  ['AKIRA VOICE', 'ผมรอนาย', 'Akira stale formal pronoun with Haruto remains'],
  ['HINA VOICE', 'พี่ดูแลดอก Hina', 'Hina object should not be misnamed as a flower'],
  ['HINA VOICE', 'ทำจากผมที่เคยตัด', 'Hina hair line is ambiguous with first-person pronoun'],
  ['AI SLUDGE', 'มวลความ', 'Stiff abstract phrase remains'],
  ['AI SLUDGE', 'แผ่ซ่าน', 'Stiff sensory phrase remains'],
  ['AI SLUDGE', 'กระทำการ', 'Stiff action phrase remains'],
  ['AI SLUDGE', 'จัดแจง', 'Over-planned action phrasing remains'],
  ['AI SLUDGE', 'ขยับก้าว', 'Stiff movement phrasing remains'],
  ['AI SLUDGE', 'บรรจง', 'Over-polished action phrasing remains'],
  ['AI SLUDGE', 'ร้อยเปอร์เซ็นต์', 'Overemphatic phrasing remains'],
  ['AI SLUDGE', 'วิกาลวิกาล', 'Duplicated night phrasing remains'],
  ['AI SLUDGE', 'ประประกอบ', 'Typo in ritual phrasing remains'],
];

scopedLines.forEach((line, index) => {
  if (/^"/.test(line.trim())) {
    report('DIALOGUE LABEL', index, `Spoken dialogue is missing a speaker label: ${line}`);
  }

  for (const [kind, needle, message] of forbiddenNeedles) {
    if (line.includes(needle)) {
      report(kind, index, `${message}: ${line}`);
    }
  }

  if (/^Kaori:\s*".*(ผม|ครับ)/.test(line)) {
    report('KAORI VOICE', index, `Kaori uses masculine/formal male marker: ${line}`);
  }

  if (/^Yamaba:/.test(line)) {
    report('YAMABA VOICE', index, `Yamaba should not have direct dialogue: ${line}`);
  }
});

if (failures.length > 0) {
  console.log('=== ROUND 6 VERIFICATION FAILED ===');
  for (const failure of failures) {
    console.log(failure);
  }
  process.exit(1);
}

console.log('=== ROUND 6 VERIFICATION PASSED ===');
console.log('0 issues found in chapters 11-12 for Kaori/Akira/Hina voice, raw Japanese leakage, Yamaba direct dialogue, naming drift, and targeted AI-sludge markers.');
