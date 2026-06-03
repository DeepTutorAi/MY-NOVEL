import fs from 'fs';

const text = fs.readFileSync('src/content/tsukinomi/sections/01-discovery.md', 'utf8');
const lines = text.split(/\r?\n/);

console.log("=== SCANNING DIALOGUES IN 01-discovery.md ===");

const englishNameRegex = /"(Hina|Akira|Kaori|Watanabe|Naomi|Daichi)"/i;
const anyEnglishRegex = /"[^"]*[a-zA-Z][^"]*"/;

lines.forEach((line, index) => {
  const lineNum = index + 1;
  const match = line.match(/^([A-Za-z0-9-]+):\s*"(.*)"$/);
  if (match) {
    const [, speaker, speech] = match;
    
    // Check 1: English word inside dialogue
    // (Exclude standard song titles like 'Matsutoya' or 'Yumi Matsutoya' if they are intentional)
    if (/[a-zA-Z]/.test(speech)) {
      // Allow Yumi Matsutoya / Matsutoya / walkman
      if (!/Matsutoya|Yumi|walkman|LINE|Aoyama/i.test(speech)) {
        console.log(`[ENGLISH LEAK] Line ${lineNum} (${speaker}): ${line}`);
      }
    }

    // Check 2: Hina register
    if (speaker === 'Hina') {
      if (speech.includes('นะจ๊ะ') || speech.includes('นะจ้ะ')) {
        console.log(`[HINA Particles] Line ${lineNum}: ${line}`);
      }
      if (speech.includes('ฉัน')) {
        console.log(`[HINA Pronoun] Line ${lineNum} uses ฉัน: ${line}`);
      }
    }

    // Check 3: Haruto & Akira peer register (they should not use ครับ/ผม with each other)
    if (speaker === 'Haruto' && (speech.includes('ครับ') || (speech.includes('ผม') && !/ผมเปีย|เส้นผม|ทรงผม/.test(speech)))) {
      // Find the context (e.g. is he speaking to Akira?)
      // Let's print it out to verify who he is speaking to.
      console.log(`[HARUTO Formal/Male Pronoun] Line ${lineNum}: ${line}`);
    }

    if (speaker === 'Akira' && (speech.includes('ครับ') || (speech.includes('ผม') && !/ผมเปีย|เส้นผม|ทรงผม/.test(speech)))) {
      console.log(`[AKIRA Formal/Male Pronoun] Line ${lineNum}: ${line}`);
    }
  }
});
