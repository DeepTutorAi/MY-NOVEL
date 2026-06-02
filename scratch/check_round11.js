import fs from 'fs';

// Round 11 — current-hygiene pass scoped to Chapter 17 (Through Winter)
// in section 05-ten-years.md.
//
// Fails on: bare live dialogue, raw Japanese greeting leaks, Akira formal
// voice with Haruto, Haruto formal voice when answering Akira/Hina, Yamaba
// direct dialogue, stale nicknames, raw honorifics, and targeted prose tics
// found during the Ch17 read-through.

const filePath = 'src/content/tsukinomi/sections/05-ten-years.md';
const text = fs.readFileSync(filePath, 'utf8');
const failures = [];

function lineNumber(index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

const startHeader = '## บทที่ 17 — Through Winter {#ch-17}';
const endHeader = '## บทที่ 18 — Ten Years {#ch-18}';
const start = text.indexOf(startHeader);
const end = text.indexOf(endHeader);

if (start === -1 || end === -1 || end <= start) {
  console.error('[STRUCTURE] Could not isolate chapter 17 in 05-ten-years.md');
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
  ['JAPANESE LEAK', 'いただきます', 'Raw Japanese meal phrase remains'],
  ['JAPANESE LEAK', 'いってきます', 'Raw Japanese leaving-home phrase remains'],
  ['JAPANESE LEAK', 'いってらっしゃい', 'Raw Japanese send-off phrase remains'],
  ['JAPANESE LEAK', 'こんにちは', 'Raw Japanese daytime greeting remains'],
  ['JAPANESE LEAK', 'โอฮาโย', 'Japanese greeting transliteration remains'],
  ['JAPANESE LEAK', 'ทาไดมะ', 'Japanese homecoming transliteration remains'],
  ['JAPANESE LEAK', 'โอคาเอริ', 'Japanese welcome-home transliteration remains'],
  ['NAMING', 'Kaori-san', 'Romanized Kaori-san remains'],
  ['NAMING', 'คาโอริซัง', 'Thai Kaori-san remains'],
  ['NAMING', 'Haruto-kun', 'Romanized Haruto-kun remains'],
  ['NAMING', 'Haruto-chan', 'Romanized Haruto-chan remains'],
  ['NAMING', 'Naomi-san', 'Romanized Naomi-san remains; use Thai คุณนาโอมิ'],
  ['NAMING', 'Sato-san', 'Romanized Sato-san remains'],
  ['NAMING', 'Takahashi-kun', 'Romanized Takahashi-kun remains'],
  ['AKIRA NICKNAME', 'buddha', 'English nickname remains; canonical nickname is คนตื่นธรรม'],
  ['AKIRA NICKNAME', 'พ่อพระ', 'Old Thai nickname remains; canonical nickname is คนตื่นธรรม'],
  ['AKIRA NICKNAME', 'คนตื่นรู้', 'Old nickname remains; canonical nickname is คนตื่นธรรม'],
  ['YAMABA VOICE', 'Yamaba:', 'Yamaba should not have direct dialogue'],
  ['PROSE TIC', 'ตาเปียก', 'Rejected wet-eye phrasing remains; use tears/eyes welling naturally'],
  ['PROSE TIC', 'ตาเธอเปียก', 'Rejected wet-eye phrasing remains'],
  ['PROSE TIC', 'ตาแม่เปียก', 'Rejected wet-eye phrasing remains'],
  ['PROSE TIC', 'แม่แต่งหน้าผ่าน', 'Unnatural Thai phrasing remains'],
  ['PROSE TIC', 'ที่หมายสีฟ้า', 'Unnatural bookmark phrasing remains'],
  ['PROSE TIC', 'น้ำหนักเป็นจาก', 'Unnatural translated phrasing remains'],
  ['AI SLUDGE', 'มวลความ', 'Stiff abstract phrase remains'],
  ['AI SLUDGE', 'แผ่ซ่าน', 'Stiff sensory phrase remains'],
  ['AI SLUDGE', 'กระทำการ', 'Stiff action phrase remains'],
  ['AI SLUDGE', 'จัดแจง', 'Over-planned action phrasing remains'],
  ['SPELLING', 'ชานชลา', 'Misspelling of ชานชาลา remains'],
];

const dialogue = [];

scopedLines.forEach((line, index) => {
  // Live spoken dialogue lives at column 0 and must carry a speaker label.
  // Indented quoted text, notebook entries, lists, and formal letters are
  // artifacts, so they are intentionally exempt.
  if (/^"/.test(line)) {
    report('DIALOGUE LABEL', index, `Spoken dialogue is missing a speaker label: ${line}`);
  }

  for (const [kind, needle, message] of forbiddenNeedles) {
    if (line.includes(needle)) {
      report(kind, index, `${message}: ${line}`);
    }
  }

  const dialogueMatch = line.match(/^([A-Za-z0-9-]+):\s*"(.*)"$/);
  if (dialogueMatch) {
    const [, speaker, speech] = dialogueMatch;
    dialogue.push({ speaker, speech, index, line });

    if (speaker === 'Kaori' && /(ผม|ครับ)/.test(speech)) {
      report('KAORI VOICE', index, `Kaori uses masculine/formal male marker: ${line}`);
    }

    if (speaker === 'Akira') {
      const speechWithoutQuotedMemory = speech.replace(/'[^']*'/g, '');
      const usesFormal =
        /ครับ/.test(speechWithoutQuotedMemory) ||
        (/ผม/.test(speechWithoutQuotedMemory) && !/ผมเปีย|เส้นผม/.test(speechWithoutQuotedMemory));
      if (usesFormal) {
        report('AKIRA VOICE', index, `Akira uses stale formal male marker with Haruto: ${line}`);
      }
    }

    if (speaker === 'Yamaba') {
      report('YAMABA VOICE', index, `Yamaba should not have direct dialogue: ${line}`);
    }
  }
});

function nearestPrecedingSpeaker(index) {
  for (let j = index - 1; j >= 0; j -= 1) {
    const l = scopedLines[j];
    if (l.trim() === '') continue;
    const m = l.match(/^([A-Za-z0-9-]+):\s*"/);
    return m ? m[1] : null;
  }
  return null;
}

for (const item of dialogue) {
  if (item.speaker !== 'Haruto' || !/(ผม|ครับ)/.test(item.speech)) {
    continue;
  }
  if (/(แม่|คุณแม่|คุณตา|ลุง|พ่อ|ครู|ป้า|Watanabe|Tanaka|Naomi|Daichi|Mori)/.test(item.speech)) {
    continue;
  }
  const prev = nearestPrecedingSpeaker(item.index);
  if (prev === 'Hina' || prev === 'Akira') {
    report('HARUTO PEER VOICE', item.index, `Haruto uses adult/formal marker when answering ${prev}: ${item.line}`);
  }
}

if (failures.length > 0) {
  console.log('=== ROUND 11 VERIFICATION FAILED ===');
  for (const failure of failures) {
    console.log(failure);
  }
  process.exit(1);
}

console.log('=== ROUND 11 VERIFICATION PASSED ===');
console.log('0 issues found in chapter 17 for speaker labels, Akira/Kaori voice, Haruto peer voice, Yamaba direct dialogue, Japanese leaks, naming/honorific drift, and targeted prose tics.');
