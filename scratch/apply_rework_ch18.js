import fs from 'fs';

const filePath = 'src/content/tsukinomi/sections/05-ten-years.md';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize CRLF to LF
content = content.replace(/\r\n/g, '\n');

console.log('=== Chapter 18 Watanabe Final Visit Polish ===');

const replacements = [
  {
    find: `คุณตา Watanabe นอนพักอยู่บนเตียง\n\nผมเจอเขาตอนสามโมง\n\nเขาผอมกว่าที่ผมจำ ผมขาวยังหวีเรียบ ตายังชัด แต่เสียงเขาเบา\n\nWatanabe: "Haruto"\n\nHaruto: "...คุณตา"\n\nWatanabe: "นายมา"\n\nHaruto: "...ผมมา"\n\nเขายกมือ ผมรับ จับเบาๆ\n\nมือคุณตาเย็น เหี่ยว\n\nWatanabe: "นายจบ ป.โท?"\n\nHaruto: "ผมเรียนต่อ ป.เอก ครับ"\n\nWatanabe: "ดี ดี"\n\nHaruto: "คุณตา"\n\nWatanabe: "อืม"\n\nHaruto: "ขอบคุณ"`,
    replace: `คุณตา Watanabe นอนพักอยู่บนเตียง\n\nผมเข้าเยี่ยมท่านตอนประมาณบ่ายสามโมง\n\nเขาดูซูบผอมลงกว่าในความทรงจำของผม ผมสีขาวโพลนยังคงหวีเรียบเป็นระเบียบ แววตายังดูแจ่มใส แต่ทว่าน้ำเสียงกลับแผ่วเบาลงไปมาก\n\nWatanabe: "ฮารุโตะ"\n\nHaruto: "...ครับคุณตา"\n\nWatanabe: "มาแล้วเร็วนะ"\n\nHaruto: "...ครับ ผมมาแล้ว"\n\nเขายื่นมือออกมา ผมจึงเอื้อมมือไปจับไว้เบาๆ\n\nมือของคุณตาเย็นชื้นและเหี่ยวย่นตามกาลเวลา\n\nWatanabe: "เรียนจบปริญญาโทแล้วใช่ไหม"\n\nHaruto: "ตอนนี้ผมเรียนต่อปริญญาเอกอยู่ครับ"\n\nWatanabe: "ดีแล้ว... ดีจริงๆ"\n\nHaruto: "คุณตาครับ"\n\nWatanabe: "อืม"\n\nHaruto: "ผมขอบคุณคุณตามากนะครับ"`
  },
  {
    find: `Watanabe: "ผมเป็นแค่คนเฝ้าศาล Haruto"\n\nHaruto: "คุณตาเป็นมากกว่านั้น สำหรับผม"\n\nคุณตาหัวเราะเบาๆ ในแบบที่คุณตาหัวเราะ\n\nWatanabe: "นายเอาอะไรของผมไป?"\n\nHaruto: "...ป้ายไม้ของคุณตา Genichi"\n\nWatanabe: "นายยังเก็บ?"\n\nHaruto: "ผมเก็บ"\n\nWatanabe: "ดี"\n\nHaruto: "คุณตา"\n\nWatanabe: "อืม"\n\nHaruto: "ผมจะรับเรื่องไหม — สายของ Takahashi"`,
    replace: `Watanabe: "ฉันก็เป็นแค่คนเฝ้าศาลธรรมดาๆ เท่านั้นแหละ ฮารุโตะ"\n\nHaruto: "คุณตาเป็นมากกว่านั้นสำหรับผมเยอะเลยครับ"\n\nคุณตาหัวเราะออกมาเบาๆ ในแบบของท่านเอง\n\nWatanabe: "แล้วนี่... เธอเอาของของฉันชิ้นไหนติดตัวไปโตเกียวด้วยล่ะ"\n\nHaruto: "...ป้ายไม้ของคุณตาเก็นอิจิครับ"\n\nWatanabe: "เธอยังเก็บมันไว้อยู่สินะ"\n\nHaruto: "ครับ ผมยังเก็บไว้อย่างดีครับ"\n\nWatanabe: "ดีแล้ว"\n\nHaruto: "คุณตาครับ"\n\nWatanabe: "อืม"\n\nHaruto: "เรื่องสืบทอดสายตระกูลของทาคาฮาชิ... ผมควรจะรับช่วงต่อดีไหมครับ"`
  },
  {
    find: `Watanabe: "นายตัดสินใจ?"\n\nHaruto: "ผมยังไม่ตัดสินใจ — แต่ผมคิด"\n\nWatanabe: "นายมี Hina"\n\nHaruto: "...ครับ"\n\nWatanabe: "Hina จะรับ"\n\nมือคุณตายังเย็นในมือผม\n\nWatanabe: "แต่ Hina ต้องเลือกของเธอเอง — ไม่ใช่ของนาย"\n\nHaruto: "...ครับ"\n\nWatanabe: "นายเลือกสำหรับตัวนาย — เลือกสำหรับชีวิตของนาย — ไม่ใช่สำหรับสาย"\n\nHaruto: "...ครับ"\n\nคุณตา Watanabe ปล่อยมือผม\n\nWatanabe: "ผมรอ Haruto"\n\nHaruto: "...คุณตารออะไร"\n\nWatanabe: "ผมรอให้ทุกอย่างจบลง"\n\nHaruto: "...ครับ"`,
    replace: `Watanabe: "เธอตัดสินใจแล้วงั้นเหรอ"\n\nHaruto: "ผมยังไม่ได้ตัดสินใจเด็ดขาดหรอกครับ... แต่ก็คิดเรื่องนี้อยู่เหมือนกัน"\n\nWatanabe: "เธอยังมีฮินะอยู่ทั้งคนนะ"\n\nHaruto: "...ครับ"\n\nWatanabe: "ฮินะจะเป็นคนรับช่วงต่อนั่นเอง"\n\nฝ่ามือของคุณตายังคงเย็นเฉียบอยู่ในมือผม\n\nWatanabe: "แต่ฮินะก็ต้องเลือกทางเดินของเธอเองด้วย... ไม่ใช่เป็นเพราะการตัดสินใจของเธอ"\n\nHaruto: "...ครับ"\n\nWatanabe: "ตัวเธอเองก็ต้องเลือกเพื่อตัวเอง... เลือกเพื่อชีวิตของตัวเธอเอง ไม่ใช่เพื่อการสืบทอดสายตระกูลหรอกนะ"\n\nHaruto: "...ครับ"\n\nคุณตา Watanabe ปล่อยมือจากผม\n\nWatanabe: "ฉันยังเฝ้ารอนะ ฮารุโตะ"\n\nHaruto: "...คุณตารออะไรอยู่เหรอครับ"\n\nWatanabe: "ฉันรอให้ทุกสิ่งทุกอย่างมันสิ้นสุดลงน่ะ"\n\nHaruto: "...ครับ"`
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
    console.log(`[WARNING] Could not match chunk: "${normFind.substring(0, 50)}..."`);
  }
}

// Convert back to CRLF before writing
fs.writeFileSync(filePath, content.replace(/\n/g, '\r\n'), 'utf8');
console.log(`=== Completed apply_rework_ch18.js (${successCount}/${replacements.length} succeeded) ===`);
