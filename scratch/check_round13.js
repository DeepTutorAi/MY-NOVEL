import fs from 'fs';

const filePath = 'src/content/tsukinomi/sections/02-reveal.md';
const text = fs.readFileSync(filePath, 'utf8');

const startHeader = '## บทที่ 5 — What She Remembers {#ch-5}';
const startIndex = text.indexOf(startHeader);

if (startIndex === -1) {
  console.error('[STRUCTURE] Could not isolate chapters 5-6 in 02-reveal.md');
  process.exit(1);
}

const scopedText = text.slice(startIndex);
const scopedStartLine = text.slice(0, startIndex).split(/\r?\n/).length;
const scopedLines = scopedText.split(/\r?\n/);
const failures = [];

function report(kind, lineOffset, message) {
  failures.push(`[${kind}] ${filePath}:${scopedStartLine + lineOffset}: ${message}`);
}

const forbiddenNeedles = [
  ['JAPANESE LEAK', 'おはよう', 'Raw Japanese greeting remains'],
  ['JAPANESE LEAK', 'ただいま', 'Raw Japanese homecoming phrase remains'],
  ['JAPANESE LEAK', 'おかえり', 'Raw Japanese welcome-home phrase remains'],
  ['JAPANESE LEAK', 'いただきます', 'Raw Japanese meal phrase remains'],
  ['JAPANESE LEAK', 'โอฮาโย', 'Japanese greeting transliteration remains'],
  ['JAPANESE LEAK', 'ทาไดมะ', 'Japanese homecoming transliteration remains'],
  ['JAPANESE LEAK', 'โอคาเอริ', 'Japanese welcome-home transliteration remains'],
  ['AKIRA NICKNAME', 'buddha', 'English nickname remains; canonical nickname is คนตื่นธรรม'],
  ['AKIRA NICKNAME', 'พ่อพระ', 'Old nickname remains; canonical nickname is คนตื่นธรรม'],
  ['AKIRA NICKNAME', 'คนตื่นรู้', 'Old nickname remains; canonical nickname is คนตื่นธรรม'],
  ['AKIRA NICKNAME', 'พ่อคนใจบุญ', 'Old nickname remains; canonical nickname is คนตื่นธรรม'],
  ['AKIRA NICKNAME', 'พ่อคนบรรลุธรรม', 'Old nickname remains; canonical nickname is คนตื่นธรรม'],
  ['NAMING', 'ทาคาฮาชิคุง', 'Raw honorific address remains'],
  ['NAMING', 'Haruto-san', 'Romanized honorific remains'],
  ['NAMING', 'Kaori-san', 'Romanized honorific remains'],
  ['YAMABA REGISTER', 'Yamaba:', 'Yamaba should not have direct dialogue'],
  ['AI SLUDGE', 'มวลระดับ', 'Stiff abstract phrase remains'],
  ['AI SLUDGE', 'กระทำการ', 'Stiff action phrase remains'],
  ['AI SLUDGE', 'จัดการเดิน', 'Over-mechanical action phrasing remains'],
  ['AI SLUDGE', 'จัดการเปิด', 'Over-mechanical action phrasing remains'],
  ['AI SLUDGE', 'จัดการพิมพ์', 'Over-mechanical action phrasing remains'],
  ['AI SLUDGE', 'ดวงวิญญาณที่แสนเหน็บหนาว', 'Over-intensified Kaori phrasing remains'],
  ['AI SLUDGE', 'แสงประกายแห่งชีวิตแรก', 'Over-intensified Kaori phrasing remains'],
  ['TYPO', 'เดินเดิน', 'Duplicated movement verb remains'],
  ['TYPO', 'กอดกอด', 'Duplicated word remains'],
  ['TYPO', 'เบลสายตา', 'Typo remains'],
  ['TYPO', 'เกอดไหล่', 'Typo remains'],
  ['KAORI VOICE', 'ผมทนรอคอยรถไฟอยู่ที่นี่', 'Kaori quote uses male pronoun in notebook summary'],
];

const allowedSpeakers = new Set([
  'Haruto',
  'Kaori',
  'Akira',
  'Hina',
  'Naomi',
  'Tanaka',
  '7-Eleven Owner',
]);

scopedLines.forEach((line, index) => {
  for (const [kind, needle, message] of forbiddenNeedles) {
    if (line.includes(needle)) {
      report(kind, index, `${message}: ${line}`);
    }
  }

  const dialogueMatch = line.match(/^([^:]+):\s*"(.*)"$/);
  if (dialogueMatch) {
    const [, speaker, speech] = dialogueMatch;

    if (!allowedSpeakers.has(speaker)) {
      report('SPEAKER LABEL', index, `Unexpected or non-Astro-safe speaker label: ${line}`);
    }

    if (speaker === 'Kaori' && /(ผม|ครับ)/.test(speech)) {
      report('KAORI VOICE', index, `Kaori uses masculine/formal male marker: ${line}`);
    }

    if (speaker === 'Yamaba') {
      report('YAMABA VOICE', index, `Yamaba should not have direct dialogue: ${line}`);
    }
  }
});

if (failures.length > 0) {
  console.log('=== ROUND 13 VERIFICATION FAILED ===');
  for (const failure of failures) {
    console.log(failure);
  }
  process.exit(1);
}

console.log('=== ROUND 13 VERIFICATION PASSED ===');
console.log('0 issues found in chapters 5-6 for Kaori voice, Yamaba direct dialogue, stale nicknames, raw Japanese/honorific leakage, speaker labels, and targeted prose-sludge markers.');
