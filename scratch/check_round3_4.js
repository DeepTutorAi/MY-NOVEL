import fs from 'fs';

const revealPath = 'src/content/tsukinomi/sections/02-reveal.md';
const decisionPath = 'src/content/tsukinomi/sections/03-decision.md';

const failures = [];

function lineNumber(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function sliceScope(filePath, startHeader, endHeader = null) {
  const text = fs.readFileSync(filePath, 'utf8');
  const start = text.indexOf(startHeader);
  const end = endHeader ? text.indexOf(endHeader) : text.length;

  if (start === -1 || end === -1 || end <= start) {
    failures.push(`[STRUCTURE] Could not isolate ${startHeader} in ${filePath}`);
    return { filePath, startLine: 1, text: '', lines: [] };
  }

  const scopedText = text.slice(start, end);
  return {
    filePath,
    startLine: lineNumber(text, start),
    text: scopedText,
    lines: scopedText.split(/\r?\n/),
  };
}

const scopes = [
  sliceScope(revealPath, '## บทที่ 5 — What She Remembers {#ch-5}'),
  sliceScope(decisionPath, '## บทที่ 7 — The Decision {#ch-7}', '## บทที่ 9 — Hina Knows {#ch-9}'),
];

function report(scope, kind, index, message) {
  failures.push(`[${kind}] ${scope.filePath}:${scope.startLine + index}: ${message}`);
}

const forbiddenNeedles = [
  ['JAPANESE LEAK', 'おはよう', 'Raw Japanese greeting remains'],
  ['JAPANESE LEAK', 'ただいま', 'Raw Japanese homecoming phrase remains'],
  ['JAPANESE LEAK', 'おかえり', 'Raw Japanese welcome-home phrase remains'],
  ['JAPANESE LEAK', 'โอฮาโย', 'Japanese greeting transliteration remains'],
  ['JAPANESE LEAK', 'ทาไดมะ', 'Japanese homecoming transliteration remains'],
  ['JAPANESE LEAK', 'โอคาเอริ', 'Japanese welcome-home transliteration remains'],
  ['JAPANESE LEAK', 'โอกาเอริ', 'Japanese welcome-home transliteration remains'],
  ['AKIRA NICKNAME', 'buddha', 'English nickname remains; canonical nickname is คนตื่นธรรม'],
  ['AKIRA NICKNAME', 'พ่อพระ', 'Old Thai nickname remains; canonical nickname is คนตื่นธรรม'],
  ['SCRIPT LEAK', "let's_find", 'Scratch placeholder remains in prose'],
  ['NAMING', 'Kaori-san', 'Romanized Kaori-san remains'],
  ['NAMING', 'คาโอริซัง', 'Thai Kaori-san remains'],
  ['AI SLUDGE', 'มวลความ', 'Stiff AI-sludge phrase remains'],
  ['AI SLUDGE', 'แผ่ซ่าน', 'Stiff AI-sludge phrase remains'],
  ['AI SLUDGE', 'กระทำการ', 'Stiff AI-sludge phrase remains'],
  ['AI SLUDGE', 'พฤติกรรมโองการ', 'Stiff AI-sludge phrase remains'],
  ['AI SLUDGE', 'สิ่งทดแทนเปลี่ยนชะตากรรม', 'Stiff abstract phrase remains'],
  ['AI SLUDGE', 'จัดการหยิบ', 'Stiff action phrasing remains'],
  ['AI SLUDGE', 'จัดการเปิด', 'Stiff action phrasing remains'],
  ['AI SLUDGE', 'จัดการพิมพ์', 'Stiff action phrasing remains'],
  ['AI SLUDGE', 'จัดการซุก', 'Stiff action phrasing remains'],
  ['AI SLUDGE', 'จัดการสวม', 'Stiff action phrasing remains'],
  ['AI SLUDGE', 'ขยับก้าว', 'Stiff movement phrasing remains'],
  ['AI SLUDGE', 'บรรจง', 'Over-polished action phrasing remains'],
];

for (const scope of scopes) {
  scope.lines.forEach((line, index) => {
    for (const [kind, needle, message] of forbiddenNeedles) {
      if (line.includes(needle)) {
        report(scope, kind, index, `${message}: ${line}`);
      }
    }

    if (/^Kaori:\s*".*(ผม|ครับ)/.test(line)) {
      report(scope, 'KAORI VOICE', index, `Kaori uses masculine/formal male marker: ${line}`);
    }

    if (/^Akira:\s*".*(คุณคาโอริ|คาโอริ).*?(ผม|ครับ)/.test(line)) {
      report(scope, 'AKIRA-KAORI VOICE', index, `Akira uses stiff ผม/ครับ with Kaori: ${line}`);
    }

    if (/^Yamaba:/.test(line)) {
      report(scope, 'YAMABA VOICE', index, `Yamaba should not have direct dialogue: ${line}`);
    }
  });
}

if (failures.length > 0) {
  console.log('=== ROUND 3-4 VERIFICATION FAILED ===');
  for (const failure of failures) {
    console.log(failure);
  }
  process.exit(1);
}

console.log('=== ROUND 3-4 VERIFICATION PASSED ===');
console.log('0 issues found in chapters 5-8 for Kaori voice, Akira-Kaori voice, raw Japanese leakage, old Akira nickname leakage, Kaori-san naming, Yamaba direct dialogue, script placeholders, and targeted AI-sludge markers.');
