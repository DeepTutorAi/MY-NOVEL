import fs from 'fs';

// Round 10 — current-hygiene pass scoped to Chapter 16 (First Frost),
// the final chapter of section 04-mountain.md (so the scope runs to EOF).
//
// Fails on: bare (unlabeled) live dialogue, raw Japanese greeting leaks,
// Akira/Kaori male-pronoun voice, Haruto using formal markers when answering
// Akira/Hina, Yamaba direct dialogue, stale nicknames, and raw honorifics.
// Watanabe MAY use ผม (canon ceremony register) or ตา (warm), so he is not
// pronoun-checked. Mirrors check_round5–9.

const filePath = 'src/content/tsukinomi/sections/04-mountain.md';
const text = fs.readFileSync(filePath, 'utf8');
const failures = [];

function lineNumber(index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

const startHeader = '## บทที่ 16 — First Frost {#ch-16}';
const start = text.indexOf(startHeader);

if (start === -1) {
  console.error('[STRUCTURE] Could not isolate chapter 16 in 04-mountain.md');
  process.exit(1);
}

// Chapter 16 is the last chapter in this file; scope runs from its header to EOF.
const scopedText = text.slice(start);
const scopedStartLine = lineNumber(start);
const scopedLines = scopedText.split(/\r?\n/);

function report(kind, lineOffset, message) {
  failures.push(`[${kind}] ${filePath}:${scopedStartLine + lineOffset}: ${message}`);
}

const forbiddenNeedles = [
  // Raw Japanese greeting/phrase leaks (converted to Thai in this pass). The
  // Heart Sutra, song titles, and the kanji name plates 「…」 are artifact text
  // and are intentionally NOT listed here.
  ['JAPANESE LEAK', 'おはよう', 'Raw Japanese greeting remains'],
  ['JAPANESE LEAK', 'ただいま', 'Raw Japanese homecoming phrase remains'],
  ['JAPANESE LEAK', 'おかえり', 'Raw Japanese welcome-home phrase remains'],
  ['JAPANESE LEAK', 'いただきます', 'Raw Japanese meal phrase remains'],
  ['JAPANESE LEAK', 'いってきます', 'Raw Japanese leaving-home phrase remains'],
  ['JAPANESE LEAK', 'いってらっしゃい', 'Raw Japanese send-off phrase remains'],
  ['JAPANESE LEAK', 'こんにちは', 'Raw Japanese daytime greeting remains'],
  ['JAPANESE LEAK', 'โอฮาโย', 'Japanese greeting transliteration remains'],
  ['JAPANESE LEAK', 'ทาไดมะ', 'Japanese homecoming transliteration remains'],
  // Naming / honorific drift. Thai forms (ฮารุโตะคุง, คุณนาโอมิ, คุณ Sato) are intentional.
  ['NAMING', 'Kaori-san', 'Romanized Kaori-san remains'],
  ['NAMING', 'คาโอริซัง', 'Thai Kaori-san remains'],
  ['NAMING', 'Haruto-kun', 'Romanized Haruto-kun remains'],
  ['NAMING', 'Haruto-chan', 'Romanized Haruto-chan remains'],
  ['NAMING', 'Naomi-san', 'Romanized Naomi-san remains; use Thai คุณนาโอมิ'],
  ['NAMING', 'Sato-san', 'Romanized Sato-san remains; use Thai คุณ Sato'],
  ['NAMING', 'Takahashi-kun', 'Romanized Takahashi-kun remains'],
  // Stale Akira nicknames (canonical nickname is คนตื่นธรรม).
  ['AKIRA NICKNAME', 'buddha', 'English nickname remains; canonical nickname is คนตื่นธรรม'],
  ['AKIRA NICKNAME', 'พ่อพระ', 'Old Thai nickname remains; canonical nickname is คนตื่นธรรม'],
  // Yamaba must never speak directly.
  ['YAMABA VOICE', 'Yamaba:', 'Yamaba should not have direct dialogue'],
  // Stale Kaori male-pronoun fragments (Kaori is gone; guard against regression).
  ['KAORI VOICE', 'เธอใช้ ผม กับ ครับ', 'Stale dossier line: Kaori must use ฉัน'],
  // Setsuko (Kaori's mother) is female and must not use the male pronoun ผม.
  ['SETSUKO VOICE', 'ความทรงจำของลูกผม', 'Setsuko (female) must use ฉัน, not ลูกผม'],
  // Targeted AI-sludge markers shared with rounds 5–9 (regression guard).
  ['AI SLUDGE', 'มวลความ', 'Stiff abstract phrase remains'],
  ['AI SLUDGE', 'แผ่ซ่าน', 'Stiff sensory phrase remains'],
  ['AI SLUDGE', 'กระทำการ', 'Stiff action phrase remains'],
  ['AI SLUDGE', 'จัดแจง', 'Over-planned action phrasing remains'],
  ['SPELLING', 'ชานชลา', 'Misspelling of ชานชาลา remains'],
];

const dialogue = [];

scopedLines.forEach((line, index) => {
  // Live spoken dialogue lives at column 0 and must carry a speaker label.
  // Indented quoted text (Haruto's journal) and the kanji name plates 「…」
  // are artifact, not live dialogue, so they are exempt — no .trim() here.
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

    // Akira (if present) uses ฉัน/แก/นาย, never ผม/ครับ. ผม also means "hair",
    // so "ผมเปีย"/"เส้นผม" descriptions are excluded.
    if (speaker === 'Akira') {
      const usesFormal = /ครับ/.test(speech) || (/ผม/.test(speech) && !/ผมเปีย|เส้นผม/.test(speech));
      if (usesFormal) {
        report('AKIRA VOICE', index, `Akira uses stale formal male marker with Haruto: ${line}`);
      }
    }

    if (speaker === 'Yamaba') {
      report('YAMABA VOICE', index, `Yamaba should not have direct dialogue: ${line}`);
    }
  }
});

// Haruto keeps ผม/ครับ for his mother, the shrine keeper, and elders, but must
// drop to ฉัน/แก/นาย/พี่ when answering Akira or Hina. Flag a Haruto line with a
// formal marker only when the nearest PRECEDING dialogue turn (skipping
// narration) belongs to Akira or Hina, and the line does not address an adult.
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
  if (/(แม่|คุณแม่|คุณตา|ลุง|พ่อ|ครู|ป้า|Watanabe|Tanaka|Naomi|Daichi)/.test(item.speech)) {
    continue;
  }
  const prev = nearestPrecedingSpeaker(item.index);
  if (prev === 'Hina' || prev === 'Akira') {
    report('HARUTO PEER VOICE', item.index, `Haruto uses adult/formal marker when answering ${prev}: ${item.line}`);
  }
}

if (failures.length > 0) {
  console.log('=== ROUND 10 VERIFICATION FAILED ===');
  for (const failure of failures) {
    console.log(failure);
  }
  process.exit(1);
}

console.log('=== ROUND 10 VERIFICATION PASSED ===');
console.log('0 issues found in chapter 16 for speaker labels, Akira/Kaori/Setsuko voice, Haruto peer voice, Yamaba direct dialogue, Japanese leaks, naming/honorific drift, and targeted AI-sludge markers.');
