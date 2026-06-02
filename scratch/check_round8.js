import fs from 'fs';

// Round 8 — current-hygiene pass scoped to Chapter 14 (Coming Home),
// the aftermath of the release in section 04-mountain.md.
//
// Fails on: bare (unlabeled) live dialogue, raw Japanese greeting leaks,
// Akira/Kaori male-pronoun voice, Haruto using formal markers with Akira/Hina,
// Yamaba direct dialogue, stale nicknames, and raw romanized honorifics.
// Mirrors check_round5/6/7 so the section stays consistent.

const filePath = 'src/content/tsukinomi/sections/04-mountain.md';
const text = fs.readFileSync(filePath, 'utf8');
const failures = [];

function lineNumber(index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

const startHeader = '## บทที่ 14 — Coming Home {#ch-14}';
const endHeader = '## บทที่ 15 — Ordinary Light {#ch-15}';
const start = text.indexOf(startHeader);
const end = text.indexOf(endHeader);

if (start === -1 || end === -1 || end <= start) {
  console.error('[STRUCTURE] Could not isolate chapter 14 in 04-mountain.md');
  process.exit(1);
}

const scopedText = text.slice(start, end);
const scopedStartLine = lineNumber(start);
const scopedLines = scopedText.split(/\r?\n/);

function report(kind, lineOffset, message) {
  failures.push(`[${kind}] ${filePath}:${scopedStartLine + lineOffset}: ${message}`);
}

const forbiddenNeedles = [
  // Raw Japanese greeting/phrase leaks (converted to Thai in this pass).
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
  // Naming / honorific drift. Thai forms (ฮารุโตะคุง, ฮารุโตะจัง, คุณนาโอมิ)
  // and the canon deity address Yamaba-sama are intentionally NOT listed.
  ['NAMING', 'Kaori-san', 'Romanized Kaori-san remains'],
  ['NAMING', 'คาโอริซัง', 'Thai Kaori-san remains'],
  ['NAMING', 'Kaori-chan', 'Romanized Kaori-chan remains'],
  ['NAMING', 'Haruto-kun', 'Romanized Haruto-kun remains'],
  ['NAMING', 'Haruto-chan', 'Romanized Haruto-chan remains; use Thai ฮารุโตะจัง'],
  ['NAMING', 'Takahashi-kun', 'Romanized Takahashi-kun remains'],
  ['NAMING', 'Naomi-san', 'Romanized Naomi-san remains; use Thai คุณนาโอมิ'],
  // Stale Akira nicknames (canonical nickname is คนตื่นธรรม).
  ['AKIRA NICKNAME', 'buddha', 'English nickname remains; canonical nickname is คนตื่นธรรม'],
  ['AKIRA NICKNAME', 'พ่อพระ', 'Old Thai nickname remains; canonical nickname is คนตื่นธรรม'],
  // Yamaba must never speak directly.
  ['YAMABA VOICE', 'Yamaba:', 'Yamaba should not have direct dialogue'],
  // Stale Kaori male-pronoun fragments (legacy draft; Kaori is gone in ch14).
  ['KAORI VOICE', 'เสียมันเพื่อผม', 'Kaori stale male-pronoun line remains'],
  ['KAORI VOICE', 'รำลึกถึงผม', 'Kaori stale male-pronoun line remains'],
  // Targeted AI-sludge markers shared with rounds 5/6/7 (regression guard).
  ['AI SLUDGE', 'มวลความ', 'Stiff abstract phrase remains'],
  ['AI SLUDGE', 'แผ่ซ่าน', 'Stiff sensory phrase remains'],
  ['AI SLUDGE', 'กระทำการ', 'Stiff action phrase remains'],
  ['AI SLUDGE', 'จัดแจง', 'Over-planned action phrasing remains'],
  ['AI SLUDGE', 'ขยับก้าว', 'Stiff movement phrasing remains'],
  ['AI SLUDGE', 'บรรจง', 'Over-polished action phrasing remains'],
  ['AI SLUDGE', 'ร้อยเปอร์เซ็นต์', 'Overemphatic phrasing remains'],
  ['SPELLING', 'ชานชลา', 'Misspelling of ชานชาลา remains'],
];

const dialogue = [];

scopedLines.forEach((line, index) => {
  // Live spoken dialogue lives at column 0 and must carry a speaker label.
  // Indented quoted text (Hina's letter, the cassette sticker, Haruto's
  // journal, mother's lullaby, the father's remembered voice) is an
  // audio/text artifact, not live dialogue, so it is exempt — no .trim() here.
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

    // Kaori is not boku-musume: ฉัน only, never ผม/ครับ.
    if (speaker === 'Kaori' && /(ผม|ครับ)/.test(speech)) {
      report('KAORI VOICE', index, `Kaori uses masculine/formal male marker: ${line}`);
    }

    // Akira with Haruto uses ฉัน/แก/นาย, never the formal ผม/ครับ.
    if (speaker === 'Akira' && /(ผม|ครับ)/.test(speech)) {
      report('AKIRA VOICE', index, `Akira uses stale formal male marker with Haruto: ${line}`);
    }

    if (speaker === 'Yamaba') {
      report('YAMABA VOICE', index, `Yamaba should not have direct dialogue: ${line}`);
    }
  }
});

// Haruto keeps ผม/ครับ for his mother, uncle, and father, but must drop to
// ฉัน/แก/นาย/พี่ in direct exchange with Akira or Hina. Use raw-line adjacency
// (the nearest non-blank neighbour) so that a turn separated by narration —
// e.g. Haruto answering his mother, then "Akira พูดขึ้น" introducing a new
// speaker — is not mistaken for Haruto addressing the peer.
function nearestDialogueSpeaker(index, direction) {
  for (let j = index + direction; j >= 0 && j < scopedLines.length; j += direction) {
    const l = scopedLines[j];
    if (l.trim() === '') continue;
    const m = l.match(/^([A-Za-z0-9-]+):\s*"/);
    return m ? m[1] : null; // null === intervening narration / scene transition
  }
  return null;
}

for (const item of dialogue) {
  if (item.speaker !== 'Haruto' || !/(ผม|ครับ)/.test(item.speech)) {
    continue;
  }
  if (/(แม่|คุณแม่|คุณตา|ลุง|พ่อ|Watanabe|Tanaka|Naomi|Daichi)/.test(item.speech)) {
    continue;
  }
  const neighbours = [
    nearestDialogueSpeaker(item.index, -1),
    nearestDialogueSpeaker(item.index, 1),
  ];
  const peer = neighbours.find((speaker) => speaker === 'Hina' || speaker === 'Akira');
  if (peer) {
    report('HARUTO PEER VOICE', item.index, `Haruto uses adult/formal marker in direct exchange with ${peer}: ${item.line}`);
  }
}

if (failures.length > 0) {
  console.log('=== ROUND 8 VERIFICATION FAILED ===');
  for (const failure of failures) {
    console.log(failure);
  }
  process.exit(1);
}

console.log('=== ROUND 8 VERIFICATION PASSED ===');
console.log('0 issues found in chapter 14 for speaker labels, Akira/Kaori voice, Haruto peer voice, Yamaba direct dialogue, Japanese leaks, naming/honorific drift, and targeted AI-sludge markers.');
