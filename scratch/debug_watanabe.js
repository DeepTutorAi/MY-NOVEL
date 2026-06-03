import fs from 'fs';
const content = fs.readFileSync('src/content/tsukinomi/sections/05-ten-years.md', 'utf8');
const lines = content.replace(/\r\n/g, '\n').split('\n');
console.log('=== DEBUG WATANABE ===');
for (let i = 2350; i < 2390; i++) {
  console.log(`${i + 1}: ${JSON.stringify(lines[i])}`);
}
