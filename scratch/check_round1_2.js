import fs from 'fs';

const discoveryPath = 'src/content/tsukinomi/sections/01-discovery.md';
const revealPath = 'src/content/tsukinomi/sections/02-reveal.md';

const discovery = fs.readFileSync(discoveryPath, 'utf8');
const reveal = fs.readFileSync(revealPath, 'utf8');

const failures = [];

function lineNumber(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function sliceChapter(filePath, text, startHeader, endHeader = null) {
  const start = text.indexOf(startHeader);
  const end = endHeader ? text.indexOf(endHeader) : text.length;

  if (start === -1 || end === -1 || end <= start) {
    failures.push(`[STRUCTURE] Could not isolate ${startHeader} in ${filePath}`);
    return {
      filePath,
      startLine: 1,
      text: '',
      lines: [],
      chapter: startHeader,
    };
  }

  const scopedText = text.slice(start, end);
  return {
    filePath,
    startLine: lineNumber(text, start),
    text: scopedText,
    lines: scopedText.split(/\r?\n/),
    chapter: startHeader,
  };
}

const chapters = [
  sliceChapter(discoveryPath, discovery, '## บทที่ 1 — The Walkman {#ch-1}', '## บทที่ 2 — Rain {#ch-2}'),
  sliceChapter(discoveryPath, discovery, '## บทที่ 2 — Rain {#ch-2}', '## บทที่ 3 — The Train That Doesn\'t Come {#ch-3}'),
  sliceChapter(discoveryPath, discovery, '## บทที่ 3 — The Train That Doesn\'t Come {#ch-3}'),
  sliceChapter(revealPath, reveal, '## บทที่ 4 — อากิระ Notices {#ch-4}', '## บทที่ 5 — What She Remembers {#ch-5}'),
];

function report(scope, kind, index, message) {
  failures.push(`[${kind}] ${scope.filePath}:${scope.startLine + index}: ${message}`);
}

const forbiddenNeedles = [
  ['JAPANESE LEAK', 'おはよう', 'Raw Japanese greeting remains'],
  ['JAPANESE LEAK', 'ただいま', 'Raw Japanese homecoming phrase remains'],
  ['JAPANESE LEAK', 'おかえり', 'Raw Japanese welcome-home phrase remains'],
  ['JAPANESE LEAK', 'こっちこっち', 'Raw Japanese direction phrase remains'],
  ['JAPANESE LEAK', 'โอฮาโย', 'Japanese greeting transliteration remains'],
  ['JAPANESE LEAK', 'ทาไดมะ', 'Japanese homecoming transliteration remains'],
  ['JAPANESE LEAK', 'โอคาเอริ', 'Japanese welcome-home transliteration remains'],
  ['JAPANESE LEAK', 'โอกาเอริ', 'Japanese welcome-home transliteration remains'],
  ['AKIRA NICKNAME', 'buddha', 'English nickname remains; canonical nickname is คนตื่นธรรม'],
  ['AKIRA NICKNAME', 'พ่อพระ', 'Old Thai nickname remains; canonical nickname is คนตื่นธรรม'],
  ['SCRIPT LEAK', "let's_find_a_better_way", 'Scratch placeholder remains in prose'],
  ['AI SLUDGE', 'มวลความ', 'Stiff AI-sludge phrase remains'],
  ['AI SLUDGE', 'แผ่ซ่าน', 'Stiff AI-sludge phrase remains'],
  ['AI SLUDGE', 'กระทำการ', 'Stiff AI-sludge phrase remains'],
  ['AI SLUDGE', 'เซฟเวลา', 'Casual English verb remains where Thai phrasing is cleaner'],
  ['AI SLUDGE', 'ทำการพูด', 'Stiff verb nominalization remains'],
  ['AI SLUDGE', 'ทำการสอน', 'Stiff verb nominalization remains'],
  ['AI SLUDGE', 'ทำการกวาด', 'Stiff verb nominalization remains'],
  ['AI SLUDGE', 'ทำการสวม', 'Stiff verb nominalization remains'],
];

for (const scope of chapters) {
  scope.lines.forEach((line, index) => {
    for (const [kind, needle, message] of forbiddenNeedles) {
      if (line.includes(needle)) {
        report(scope, kind, index, `${message}: ${line}`);
      }
    }

    if (/^Kaori:\s*".*(ผม|ครับ)/.test(line)) {
      report(scope, 'KAORI VOICE', index, `Kaori uses masculine/formal male marker: ${line}`);
    }

    if (/^Haruto:\s*".*(Kaori-san|คาโอริซัง)/.test(line)) {
      report(scope, 'NAMING', index, `Haruto should use คุณคาโอริ/คุณมิตซูชิมะ in this pass: ${line}`);
    }
  });
}

for (const scope of chapters.slice(0, 3)) {
  scope.lines.forEach((line, index) => {
    if (/^Kaori:\s*".*(ฮารุโตะคุง|คุณฮารุโตะ)/.test(line)) {
      report(scope, 'KAORI NAMING', index, `Kaori is too intimate before Section 2: ${line}`);
    }
  });
}

const repeatedParagraphs = new Map();
for (const scope of chapters) {
  const paragraphs = scope.text
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 120 && !paragraph.startsWith('## '));

  for (const paragraph of paragraphs) {
    const previous = repeatedParagraphs.get(paragraph);
    if (previous) {
      failures.push(`[DUPLICATE] Exact long paragraph repeated: ${previous} and ${scope.filePath}:${scope.startLine}`);
    } else {
      repeatedParagraphs.set(paragraph, `${scope.filePath}:${scope.startLine}`);
    }
  }
}

if (failures.length > 0) {
  console.log('=== ROUND 1-2 VERIFICATION FAILED ===');
  for (const failure of failures) {
    console.log(failure);
  }
  process.exit(1);
}

console.log('=== ROUND 1-2 VERIFICATION PASSED ===');
console.log('0 issues found in chapters 1-4 for raw Japanese greetings, old Akira nickname leakage, Kaori voice/naming, Haruto Kaori-san naming, script placeholders, targeted AI-sludge markers, and exact long-paragraph duplication.');
