import { execSync } from 'child_process';
const diff = execSync('git diff -U0 src/content/tsukinomi/sections/03-decision.md', { encoding: 'utf8' });
const lines = diff.split('\n');
console.log('=== Modified Lines in 03-decision.md ===');
for (const line of lines) {
  if (line.startsWith('@@')) {
    console.log(line);
  }
}
