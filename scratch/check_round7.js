import fs from 'fs';

// Round 7 — current-hygiene pass scoped to Chapter 13 (The Mountain),
// the release/ritual peak of section 04-mountain.md.
//
// Fails on: bare (unlabeled) live dialogue, stale Akira nicknames, raw
// romanized honorifics, Yamaba direct dialogue, and Kaori male-pronoun voice.
// Mirrors check_round6.js so the whole section stays consistent.

const filePath = 'src/content/tsukinomi/sections/04-mountain.md';
const text = fs.readFileSync(filePath, 'utf8');
const failures = [];

function lineNumber(index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

const startHeader = '## บทที่ 13 — The Mountain {#ch-13}';
const endHeader = '## บทที่ 14 — Coming Home {#ch-14}';
const start = text.indexOf(startHeader);
const end = text.indexOf(endHeader);

if (start === -1 || end === -1 || end <= start) {
  console.error('[STRUCTURE] Could not isolate chapter 13 in 04-mountain.md');
  process.exit(1);
}

const scopedText = text.slice(start, end);
const scopedStartLine = lineNumber(start);
const scopedLines = scopedText.split(/\r?\n/);

function report(kind, lineOffset, message) {
  failures.push(`[${kind}] ${filePath}:${scopedStartLine + lineOffset}: ${message}`);
}

const forbiddenNeedles = [
  // Raw Japanese greeting/phrase leaks (none expected, kept for regression).
  ['JAPANESE LEAK', 'おはよう', 'Raw Japanese greeting remains'],
  ['JAPANESE LEAK', 'ただいま', 'Raw Japanese homecoming phrase remains'],
  ['JAPANESE LEAK', 'おかえり', 'Raw Japanese welcome-home phrase remains'],
  ['JAPANESE LEAK', 'いってきます', 'Raw Japanese leaving-home phrase remains'],
  ['JAPANESE LEAK', 'いってらっしゃい', 'Raw Japanese send-off phrase remains'],
  ['JAPANESE LEAK', 'โอฮาโย', 'Japanese greeting transliteration remains'],
  ['JAPANESE LEAK', 'ทาไดมะ', 'Japanese homecoming transliteration remains'],
  // Naming / honorific drift. Yamaba-sama is canon (a deity address) and is
  // intentionally NOT listed here; ฮารุโตะคุง is Kaori's canon late-stage form.
  ['NAMING', 'Kaori-san', 'Romanized Kaori-san remains'],
  ['NAMING', 'คาโอริซัง', 'Thai Kaori-san remains'],
  ['NAMING', 'Kaori-chan', 'Romanized Kaori-chan remains'],
  ['NAMING', 'Haruto-kun', 'Romanized Haruto-kun remains'],
  ['NAMING', 'Takahashi-kun', 'Romanized Takahashi-kun remains'],
  ['NAMING', 'Takahashi-san', 'Romanized Takahashi-san remains'],
  // Stale Akira nicknames (canonical nickname is คนตื่นธรรม).
  ['AKIRA NICKNAME', 'buddha', 'English nickname remains; canonical nickname is คนตื่นธรรม'],
  ['AKIRA NICKNAME', 'พ่อพระ', 'Old Thai nickname remains; canonical nickname is คนตื่นธรรม'],
  // Yamaba must never speak directly.
  ['YAMABA VOICE', 'Yamaba:', 'Yamaba should not have direct dialogue'],
  // Stale Kaori male-pronoun farewell lines (legacy draft fragments).
  ['KAORI VOICE', 'เสียมันเพื่อผม', 'Kaori stale male-pronoun line remains'],
  ['KAORI VOICE', 'ความทรงจำของคุณเกี่ยวกับผมทั้งหมด', 'Kaori stale male-pronoun line remains'],
  ['KAORI VOICE', 'รำลึกถึงผม', 'Kaori stale male-pronoun line remains'],
  ['KAORI VOICE', 'ผมรอลุกมา', 'Kaori stale male-pronoun line remains'],
  ['KAORI VOICE', 'ผมไม่สมควร', 'Kaori stale male-pronoun line remains'],
  // Targeted AI-sludge markers shared with rounds 5/6 (regression guard).
  ['AI SLUDGE', 'มวลความ', 'Stiff abstract phrase remains'],
  ['AI SLUDGE', 'แผ่ซ่าน', 'Stiff sensory phrase remains'],
  ['AI SLUDGE', 'กระทำการ', 'Stiff action phrase remains'],
  ['AI SLUDGE', 'จัดแจง', 'Over-planned action phrasing remains'],
  ['AI SLUDGE', 'ขยับก้าว', 'Stiff movement phrasing remains'],
  ['AI SLUDGE', 'บรรจง', 'Over-polished action phrasing remains'],
  ['AI SLUDGE', 'ร้อยเปอร์เซ็นต์', 'Overemphatic phrasing remains'],
  ['AI SLUDGE', 'วิกาลวิกาล', 'Duplicated night phrasing remains'],
  ['AI SLUDGE', 'ประประกอบ', 'Typo in ritual phrasing remains'],
  ['SPELLING', 'ชานชลา', "Misspelling of ชานชาลา remains"],
];

scopedLines.forEach((line, index) => {
  // Live spoken dialogue lives at column 0 and must carry a speaker label.
  // Indented quoted text (Hina's letter, the cassette sticker title, and the
  // father's voice replaying from tape) is an audio/text artifact, not live
  // dialogue, so it is intentionally exempt — hence no .trim() here.
  if (/^"/.test(line)) {
    report('DIALOGUE LABEL', index, `Spoken dialogue is missing a speaker label: ${line}`);
  }

  for (const [kind, needle, message] of forbiddenNeedles) {
    if (line.includes(needle)) {
      report(kind, index, `${message}: ${line}`);
    }
  }

  // Kaori is not boku-musume: she must use ฉัน, never ผม/ครับ.
  if (/^Kaori:\s*".*(ผม|ครับ)/.test(line)) {
    report('KAORI VOICE', index, `Kaori uses masculine/formal male marker: ${line}`);
  }

  // Akira (if present) must not use formal male markers with Haruto.
  if (/^Akira:\s*".*(ครับ|ผมรอ|ผมรู้นาย)/.test(line)) {
    report('AKIRA VOICE', index, `Akira uses stale formal pronoun with Haruto: ${line}`);
  }

  if (/^Yamaba:/.test(line)) {
    report('YAMABA VOICE', index, `Yamaba should not have direct dialogue: ${line}`);
  }
});

if (failures.length > 0) {
  console.log('=== ROUND 7 VERIFICATION FAILED ===');
  for (const failure of failures) {
    console.log(failure);
  }
  process.exit(1);
}

console.log('=== ROUND 7 VERIFICATION PASSED ===');
console.log('0 issues found in chapter 13 for speaker labels, Kaori/Akira voice, Yamaba direct dialogue, naming/honorific drift, and targeted AI-sludge markers.');
