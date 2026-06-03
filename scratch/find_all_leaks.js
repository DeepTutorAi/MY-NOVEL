import fs from 'fs';

const text = fs.readFileSync('src/content/tsukinomi/sections/01-discovery.md', 'utf8');
const lines = text.split(/\r?\n/);

let output = '';

lines.forEach((line, index) => {
  const lineNum = index + 1;
  const match = line.match(/^([A-Za-z0-9-]+):\s*"(.*)"$/);
  if (match) {
    const [, speaker, speech] = match;
    if (/[a-zA-Z]/.test(speech)) {
      output += `${lineNum} (${speaker}): ${speech}\n`;
    }
  }
});

fs.writeFileSync('scratch/leaks.txt', output, 'utf8');
console.log("Wrote leaks to scratch/leaks.txt");
