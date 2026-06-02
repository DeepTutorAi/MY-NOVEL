import fs from 'fs';
const lines = fs.readFileSync('src/content/tsukinomi/sections/03-decision.md', 'utf8').split('\n');
for (let i = 12; i < 2237; i++) {
  const l = lines[i];
  if (l && l.includes('"')) {
    if (!/^[A-Za-z0-9\sก-๙\(\)\-\,\.\+\u0e00-\u0e7f]+:\s*"/.test(l)) {
      console.log(`${i+1}: ${l}`);
    }
  }
}
