import fs from 'fs';

const filePath = 'src/content/tsukinomi/sections/03-decision.md';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize CRLF to LF for reliable string matching
content = content.replace(/\r\n/g, '\n');

console.log('=== Starting Final Polish: Peer Regressions & Akira-Kaori Greets ===');

const replacements = [
  // 1. Haruto-to-Akira Peer Regressions in Rooftop Lunch Scene (lines 337-377)
  {
    find: `Haruto: "ขึ้นไปแน่นอนครับ"`,
    replace: `Haruto: "ขึ้นไปแน่นอนแก"`
  },
  {
    find: `Haruto: "ต่อให้พายุฝนจะกระหน่ำเทลงมาหนักเพียงใด ผมก็จำเป็นต้องขึ้นไปหาเธอครับ"`,
    replace: `Haruto: "ต่อให้ฝนจะตกหนักปานฟ้ารั่ว ฉันก็ต้องขึ้นไปหาเธอว่ะ"`
  },
  {
    find: `Haruto: "ทว่า... นายเคยเอ่ยปากตกลงสัญญาไว้ไม่ใช่เหรอว่าจะปักหลักเฝ้ารอคอยความปลอดภัยอยู่แค่ตรงแถวชายขอบป่าด้านนอกเท่านั้นน่ะครับ?"`,
    replace: `Haruto: "แต่แกเคยสัญญาไว้ไม่ใช่เหรอว่าจะรออยู่แค่ชายป่าข้างนอกน่ะ?"`
  },
  {
    find: `Haruto: "...นาย... จิตใจของนายไม่ได้นึกกลัวดวงวิญญาณลี้ลับขึ้นมาแล้วงั้นเหรอครับ?"`,
    replace: `Haruto: "...แก... ไม่กลัวผีแล้วเหรอวะ?"`
  },
  {
    find: `Haruto: "กลัวขนาดนั้นแล้วทำไมถึงยังอยากไปด้วยกันล่ะครับ?"`,
    replace: `Haruto: "กลัวขนาดนั้นแล้วทำไมยังอยากไปด้วยกันล่ะวะ?"`
  },
  {
    find: `Haruto: "...แต่ก่อนหน้านี้ นายไม่เคยมีมิติมองเห็นตัวตนของเธอมาก่อนเลยไม่ใช่เหรอครับ?"`,
    replace: `Haruto: "...แต่ก่อนหน้านี้ แกไม่เคยมองเห็นเธอเลยไม่ใช่เหรอวะ?"`
  },
  {
    find: `Haruto: "ตกลงครับ... บ่ายนี้พวกเราเข้าไปในสถานีด้วยกัน"`,
    replace: `Haruto: "ตกลง... บ่ายนี้พวกเราเข้าไปในสถานีด้วยกัน"`
  },

  // 2. Akira to Kaori Dialogue Polishing
  {
    find: `Akira: "...ครับ ยินดีที่ได้พบเช่นกันครับ"`,
    replace: `Akira: "ยินดีที่ได้พบเหมือนกันนะคุณคาโอริ"`
  },
  {
    find: `Akira: "...ใช่ครับ ผมมองเห็นเงาร่างรายละเอียดและสีเสื้อกระโปรงนักเรียนสีกรมท่าของ คุณคาโอริ แจ่มชัดดีเยี่ยมทุกประการเลยล่ะครับ"`,
    replace: `Akira: "ใช่ ฉันเห็นคุณคาโอริในชุดนักเรียนสีกรมท่าชัดเจนดีทุกอย่างเลย"`
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
    console.log(`[WARNING] Could not match final chunk: "${normFind.substring(0, 50)}..."`);
  }
}

// Convert back to CRLF before writing
fs.writeFileSync(filePath, content.replace(/\n/g, '\r\n'), 'utf8');
console.log(`=== Completed apply_rework_final.js ===`);
