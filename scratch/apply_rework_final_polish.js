import fs from 'fs';

const filePath = 'src/content/tsukinomi/sections/03-decision.md';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize CRLF to LF
content = content.replace(/\r\n/g, '\n');

console.log('=== Final-Final Polish ===');

const replacements = [
  {
    find: `Haruto: "...ข้อนั้นสมเหตุสมผลและจริงแท้ที่สุดเลยครับ"`,
    replace: `Haruto: "...จริงของแกนะ เรื่องนั้นมันก็สมเหตุสมผลดี"`
  },
  {
    find: `Haruto: "ผมกำลังทอดสายตาจ้องมองผืนท้องฟ้าอยู่น่ะครับ"`,
    replace: `Haruto: "ฉันกำลังมองดูท้องฟ้าน่ะ"`
  },
  {
    find: `Haruto: "...ใช่ครับ หนาทึบมากจริงๆ"`,
    replace: `Haruto: "...ใช่ ทึบมากเลยว่ะ"`
  },
  {
    find: `Haruto: "...ครับ คงจะเป็นเช่นนั้น"`,
    replace: `Haruto: "...เออ คงงั้นแหละ"`
  },
  {
    find: `Akira: "ครับ คุณคาโอริ?"\n\nKaori: "ในเสี้ยวจิตวิญญาณของคุณเวลานี้... คุณกำลังเกาะกุมกระแสความชอกช้ำใจจากการสูญเสียลูกพี่ลูกน้อง (Cousin) ร่วมสายเลือดที่พากันสาบสูญหายตัวไปลึกลับอยู่ใช่ไหม?"`,
    replace: `Akira: "คุณคาโอริ?"\n\nKaori: "ในตอนนี้... คุณกำลังโศกเศร้าจากการสูญเสียลูกพี่ลูกน้องร่วมสายเลือดที่หายสาบสูญไปอยู่ใช่ไหมคะ?"`
  }
];

let successCount = 0;
for (const r of replacements) {
  const normFind = r.find.replace(/\r\n/g, '\n');
  const normReplace = r.replace.replace(/\r\n/g, '\n');
  if (content.includes(normFind)) {
    content = content.replace(normFind, normReplace);
    successCount++;
    console.log(`[SUCCESS] Replaced: "${normFind.substring(0, 50)}..."`);
  } else {
    console.log(`[WARNING] Could not match final-final chunk: "${normFind.substring(0, 50)}..."`);
  }
}

// Convert back to CRLF before writing
fs.writeFileSync(filePath, content.replace(/\n/g, '\r\n'), 'utf8');
console.log(`=== Completed apply_rework_final_polish.js ===`);
