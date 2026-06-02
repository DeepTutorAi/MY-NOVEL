import fs from 'fs';

const filePath = 'src/content/tsukinomi/sections/03-decision.md';
const text = fs.readFileSync(filePath, 'utf8');

const startHeader = '## บทที่ 7 — The Decision {#ch-7}';
const endHeader = '## บทที่ 9 — Hina Knows {#ch-9}';
const startIndex = text.indexOf(startHeader);
const endIndex = text.indexOf(endHeader);

if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
  console.error('[STRUCTURE] Could not isolate chapters 7-8 in 03-decision.md');
  process.exit(1);
}

const scopedText = text.slice(startIndex, endIndex);
const scopedStartLine = text.slice(0, startIndex).split(/\r?\n/).length;
const scopedLines = scopedText.split(/\r?\n/);
const failures = [];

function report(kind, lineOffset, message) {
  failures.push(`[${kind}] Line ${scopedStartLine + lineOffset}: ${message}`);
}

const forbiddenText = [
  ['SPELLING', 'ชานชลา', "Found 'ชานชลา' -> should be 'ชานชาลา'"],
  ['JAPANESE LEAK', 'โอฮาโย', 'Found Japanese transliteration'],
  ['JAPANESE LEAK', 'ทาไดมะ', 'Found Japanese transliteration'],
  ['JAPANESE LEAK', 'โอคาเอริ', 'Found Japanese transliteration'],
  ['JAPANESE LEAK', 'โอกาเอริ', 'Found Japanese transliteration'],
  ['SCRIPT LEAK', '// Wait', 'Found scratch-script comment in prose'],
  ['TYPO', 'พี่โอเสร็จ', 'Found typo in Hina dialogue'],
  ['TYPO', 'ใหมู่', 'Found typo, should be ใหม่'],
  ['TYPO', 'แคี่', 'Found typo, should be แค่'],
  ['SIDDHAM', '色即เป็น空', 'Found malformed Heart Sutra phrase, should be 色即是空'],
  ['AI SLUDGE', 'รักษาระยะห่างกึ่งกลางทางสังคม', 'Found COVID-era/social-distance phrasing'],
  ['AI SLUDGE', 'สืบฝ่าเท้า', 'Found stiff AI-sludge movement phrase'],
  ['AI SLUDGE', 'วิรุฬห์วิญญาณ', 'Found malformed spiritual phrase'],
  ['AI SLUDGE', 'จัดวางคอมพิวเตอร์ Laptop', 'Found stiff laptop phrasing'],
  ['AI SLUDGE', 'ป้อนแป้นพิมพ์', 'Found stiff typing phrasing'],
  ['AI SLUDGE', 'ประสบความสำเร็จสืบฝ่าเท้า', 'Found stiff success phrasing'],
  ['LOGIC', 'อย่าชานชาลาแห่งนี้', 'Found missing verb before platform reference'],
];

for (const [kind, needle, message] of forbiddenText) {
  scopedLines.forEach((line, index) => {
    if (line.includes(needle)) {
      report(kind, index, `${message}: ${line}`);
    }
  });
}

let urgentQuestionCount = 0;
for (let index = 0; index < scopedLines.length; index += 1) {
  const line = scopedLines[index];

  if (line.startsWith('Kaori:')) {
    if (line.includes('ผม') || line.includes('ครับ')) {
      report('KAORI VOICE', index, `Kaori uses masculine/formal male marker: ${line}`);
    }
    const kaoriSpeech = line.replace(/^Kaori:\s*/, '');
    if (/[A-Za-z]/.test(kaoriSpeech)) {
      report('KAORI LEAK', index, `Kaori dialogue contains English characters: ${line}`);
    }
  }

  if (line.startsWith('Akira:') && (line.includes('buddha') || line.includes('พ่อพระ'))) {
    report('AKIRA LEAK', index, `Akira uses stale nickname instead of คนตื่นธรรม: ${line}`);
  }

  if (line === 'Haruto: "มีอะไรด่วนเหรอวะอากิระ?"') {
    urgentQuestionCount += 1;
  }
}

if (urgentQuestionCount > 1) {
  failures.push(`[DUPLICATE] Haruto urgent classroom question appears ${urgentQuestionCount} times`);
}

const ch7Text = scopedText.slice(0, scopedText.indexOf('## บทที่ 8 — Two Cassettes {#ch-8}'));
for (const phrase of ['ฟังเทปม้วนนี้ให้ครบสิบครั้ง', 'กลับบ้านมากินข้าวเย็นกับแม่และฮินะ', 'เสียงร้องเพลงของพ่อในเทปนี้จะหายไป']) {
  if (ch7Text.includes(phrase)) {
    failures.push(`[LOGIC] Chapter 7 leaks father-letter content before Haruto opens the envelope: ${phrase}`);
  }
}

if (failures.length > 0) {
  console.log('=== CHAPTER 7-8 VERIFICATION FAILED ===');
  for (const failure of failures) {
    console.log(failure);
  }
  process.exit(1);
}

console.log('=== CHAPTER 7-8 VERIFICATION PASSED ===');
console.log('0 issues found in scope: spelling, Japanese leaks, Kaori voice, Akira nickname, AI-sludge markers, duplicate classroom exchange, and father-letter timing.');
