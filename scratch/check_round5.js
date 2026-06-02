import fs from 'fs';

const filePath = 'src/content/tsukinomi/sections/03-decision.md';
const text = fs.readFileSync(filePath, 'utf8');
const failures = [];

function lineNumber(index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

const startHeader = '## บทที่ 9 — Hina Knows {#ch-9}';
const start = text.indexOf(startHeader);

if (start === -1) {
  console.error('[STRUCTURE] Could not isolate chapters 9-10 in 03-decision.md');
  process.exit(1);
}

const scopedText = text.slice(start);
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
  ['JAPANESE LEAK', 'โอฮาโย', 'Japanese greeting transliteration remains'],
  ['JAPANESE LEAK', 'ทาไดมะ', 'Japanese homecoming transliteration remains'],
  ['JAPANESE LEAK', 'โอคาเอริ', 'Japanese welcome-home transliteration remains'],
  ['JAPANESE LEAK', 'โอกาเอริ', 'Japanese welcome-home transliteration remains'],
  ['NAMING', 'Kaori-san', 'Romanized Kaori-san remains'],
  ['NAMING', 'คาโอริซัง', 'Thai Kaori-san remains'],
  ['AKIRA NICKNAME', 'buddha', 'English nickname remains; canonical nickname is คนตื่นธรรม'],
  ['AKIRA NICKNAME', 'พ่อพระ', 'Old Thai nickname remains; canonical nickname is คนตื่นธรรม'],
  ['AI SLUDGE', 'มวลความ', 'Stiff abstract phrase remains'],
  ['AI SLUDGE', 'แผ่ซ่าน', 'Stiff sensory phrase remains'],
  ['AI SLUDGE', 'กระทำการ', 'Stiff action phrase remains'],
  ['AI SLUDGE', 'พฤติกรรมโองการ', 'Malformed stiff phrase remains'],
  ['AI SLUDGE', 'สิ่งทดแทนเปลี่ยนชะตากรรม', 'Stiff abstract phrase remains'],
  ['AI SLUDGE', 'จัดการหยิบ', 'Stiff action phrasing remains'],
  ['AI SLUDGE', 'จัดการเปิด', 'Stiff action phrasing remains'],
  ['AI SLUDGE', 'จัดการพิมพ์', 'Stiff action phrasing remains'],
  ['AI SLUDGE', 'จัดการซุก', 'Stiff action phrasing remains'],
  ['AI SLUDGE', 'จัดการสวม', 'Stiff action phrasing remains'],
  ['AI SLUDGE', 'จัดแจง', 'Over-planned action phrasing remains'],
  ['AI SLUDGE', 'ขยับก้าว', 'Stiff movement phrasing remains'],
  ['AI SLUDGE', 'บรรจง', 'Over-polished action phrasing remains'],
  ['AI SLUDGE', 'ขยับหัวก้น', 'Malformed action phrase remains'],
  ['AI SLUDGE', 'จดบันทึกจดบันทึก', 'Duplicated verb remains'],
  ['AI SLUDGE', 'ร้อยเปอร์เซ็นต์', 'Overemphatic phrasing remains'],
  ['AI SLUDGE', 'วิกาลวิกาล', 'Duplicated night phrasing remains'],
  ['AI SLUDGE', 'ประประกอบ', 'Typo in ritual phrasing remains'],
  ['HINA VOICE', 'ประกอบพิธีอันใด', 'Hina still speaks in ornate ritual diction'],
  ['HINA VOICE', 'พันธนาการชดใช้กรรม', 'Hina still speaks in ornate ritual diction'],
  ['HINA VOICE', 'เซ่นแลก', 'Hina still speaks in ornate ritual diction'],
  ['HINA VOICE', 'แก้วตาเอ๋ย', 'Haruto/Hina sibling voice remains over-sugared'],
];

const dialogue = [];

scopedLines.forEach((line, index) => {
  for (const [kind, needle, message] of forbiddenNeedles) {
    if (line.includes(needle)) {
      report(kind, index, `${message}: ${line}`);
    }
  }

  const dialogueMatch = line.match(/^([A-Za-z0-9-]+):\s*"(.*)"$/);
  if (dialogueMatch) {
    const [, speaker, speech] = dialogueMatch;
    dialogue.push({ speaker, speech, index, line });

    if (speaker === 'Hina' && /(จ๊ะ|นะจ๊ะ)/.test(speech)) {
      report('HINA VOICE', index, `Hina still uses over-sweet old-fashioned particle: ${line}`);
    }

    if (speaker === 'Kaori' && /(ผม|ครับ)/.test(speech)) {
      report('KAORI VOICE', index, `Kaori uses masculine/formal male marker: ${line}`);
    }

    if (speaker === 'Yamaba') {
      report('YAMABA VOICE', index, `Yamaba should not have direct dialogue: ${line}`);
    }
  }
});

for (let i = 0; i < dialogue.length; i += 1) {
  const item = dialogue[i];
  if (item.speaker !== 'Haruto' || !/(ผม|ครับ|ครับผม)/.test(item.speech)) {
    continue;
  }

  if (/(แม่|คุณตา|ลุง|Owner|Watanabe|Tanaka|Daichi|Kaori|Yamaba)/.test(item.speech)) {
    continue;
  }

  const previous = dialogue[i - 1];
  const next = dialogue[i + 1];
  if (previous?.speaker === 'Hina' || next?.speaker === 'Hina') {
    report('HARUTO-HINA VOICE', item.index, `Haruto uses adult/formal marker in direct exchange with Hina: ${item.line}`);
  }
}

if (failures.length > 0) {
  console.log('=== ROUND 5 VERIFICATION FAILED ===');
  for (const failure of failures) {
    console.log(failure);
  }
  process.exit(1);
}

console.log('=== ROUND 5 VERIFICATION PASSED ===');
console.log('0 issues found in chapters 9-10 for Hina/Haruto voice, raw Japanese leakage, Kaori-san naming, Akira nickname, Yamaba direct dialogue, and targeted AI-sludge markers.');
