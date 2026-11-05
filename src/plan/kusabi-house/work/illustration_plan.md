# Kusabi House (บ้านสลักไม้) — Autonomous Agent Illustration Guide

## 1. Core Principle (Agent Autonomy & Clean Light Novel Style)

เอกสารนี้ทำหน้าที่เป็น **แนวทางให้ Agent ไปสำรวจและตัดสินใจเอง (Agent-Driven Brief)** โดย**ไม่ใช้ Hardcoded Prompt หรือ JSON Prompt สำเร็จรูป** เพื่อไม่ให้คำสั่งที่ยัดเยียดเกินไปบีบจน AI เจนภาพออกมาแข็งหรือเพี้ยน

### กติกาหลักสำหรับ Agent ที่รับหน้าที่เจนภาพ:
1. **สไตล์งานภาพ (Art Style):**
   - ใช้เพียงโจทย์หลักคือ **"งานภาพสไตล์ Light Novel ที่ลายเส้นคลีน สะอาดตา" (Clean Light Novel Illustration Style)** ขาวดำ/เกรย์สเกล อัตราส่วนแนวตั้ง `2:3`
   - ห้ามใส่คำศัพท์เทคนิคที่ทำให้ภาพสกปรกหรือเพี้ยนเป็นแนวอื่น (เช่น ไม่ต้องยัดคำสั่ง halftone หนาๆ และระวังไม่ให้ลายเส้นไหลไปทางเว็บตูนหรือนิยายวาย)
2. **ให้ Agent ไปค้นหาและตัดสินใจเอง (Self-Directed Exploration & Decision):**
   - ก่อนเจนภาพแต่ละบท ให้ Agent **เข้าไปอ่านเนื้อหาบทนั้นๆ ด้วยตัวเอง** ในโฟลเดอร์ `src/plan/kusabi-house/draft/`
   - ให้ Agent **เปิดดูภาพต้นฉบับในโปรเจกต์ด้วยตัวเอง** เพื่อทำความเข้าใจลายเส้นและหน้าตาตัวละคร:
     - ตัวอย่างงานภาพ Light Novel ที่คลีนและผ่านเกณฑ์แล้ว: `public/assets/tsukinomi/images/illustrations/` และ `public/assets/tsukinomi/images/extra/`
     - แผ่นดีไซน์ตัวละคร (Character Sheets) ของเรื่อง *Kusabi House*: `public/assets/kusabi/images/characters/drafts-v2/`
     - แผ่นดีไซน์ของ **Suzuki Akira (วัยมหาวิทยาลัย)**: `public/assets/tsukinomi/images/extra/suzuki-akira-university-180cm-draft.png` และภาพประกอบใน `public/assets/tsukinomi/images/illustrations/chapter-08-shared-song-akira-canonical.webp`
   - เมื่อดูต้นฉบับแล้ว **ให้ Agent ตัดสินใจเลือกมุมกล้อง การจัดวางองค์ประกอบภาพ และคิดคำสั่งเจนภาพเอง** ให้เข้ากับอารมณ์ของฉากและคงเอกลักษณ์หน้าตาตัวละครตามแผ่นชีต

---

## 2. ขอบเขตจำนวนภาพ (13 บทหลัก = 16 ภาพ)

- **ทำเฉพาะเนื้อเรื่องหลัก 13 บท** (`01-chapter-01.md` ถึง `13-epilogue.md`)
- **ไม่รวม** บทนำ (`00-prologue-v2.md`) และ **ไม่รวม** ตอนพิเศษ (`extra/e01.md` – `e05.md`)
- **โควตาจำนวนภาพ:**
  - **บททั่วไป (10 บท):** บทละ **1 ภาพ** (`CH01`, `CH02`, `CH03`, `CH04`, `CH05`, `CH06`, `CH07`, `CH09`, `CH11`, `Epilogue`)
  - **บทพีค / จุดหักเหสำคัญ (3 บท):** บทละ **2 ภาพ** (`CH08`, `CH10`, `CH12`)

---

## 3. แหล่งไฟล์ต้นฉบับที่ Agent ต้องไปเปิดดูเองก่อนทำแต่ละบท

### 3.1 ไฟล์ Character Sheets อ้างอิงหน้าตาตัวละคร
- **อามามิยะ นาโอะ (Nao Amamiya):** `public/assets/kusabi/images/characters/drafts-v2/nao-amamiya-draft-v2.png`
- **ซูซูกิ อากิระ (Suzuki Akira — วัยมหาวิทยาลัย):** `public/assets/tsukinomi/images/extra/suzuki-akira-university-180cm-draft.png`
- **อาราอิ เรียวะ (Arai Ryoya):** `public/assets/kusabi/images/characters/drafts-v2/arai-ryoya-draft-v2.png`
- **ซากุระบะ ไคโตะ (Kaito Sakuraba):** `public/assets/kusabi/images/characters/drafts-v2/kaito-sakuraba-draft-v2.webp`
- **อาซาฮินะ ริสะ (Risa Asahina):** `public/assets/kusabi/images/characters/drafts-v2/risa-asahina-draft-v2.png`
- **คุโรซาวะ มิซากิ (Misaki Kurosawa):** `public/assets/kusabi/images/characters/drafts-v2/misaki-kurosawa-draft-v2.png`
- **ฮิราซากะ อายาเมะ (Ayame Hirasaka):** `public/assets/kusabi/images/characters/drafts-v2/ayame-hirasaka-draft-v2.png`
- **มาโดกะ ชิอง (Shion Madoka — ชุดผู้ดูแล / ชุดฆาตกรสวมหน้ากาก / ถอดหน้ากาก):**
  - `public/assets/kusabi/images/characters/drafts-v2/shion-madoka-caretaker-draft-v2.png`
  - `public/assets/kusabi/images/characters/drafts-v2/shion-madoka-killer-draft-v2.png`
  - `public/assets/kusabi/images/characters/drafts-v2/shion-madoka-killer-unmasked-draft-v2.png`

---

## 4. ตารางรายการบทและโจทย์ตั้งต้นให้ Agent ไปตัดสินใจต่อเอง

| ลำดับภาพ | บท (ไฟล์ต้นฉบับใน `src/plan/kusabi-house/draft/`) | จำนวนภาพ | แนวทางฉากเบื้องต้น (ให้ Agent อ่านบทและตัดสินใจรายละเอียดเอง) |
| :--- | :--- | :---: | :--- |
| **1** | **CH01** (`01-chapter-01.md`) | 1 | การเดินทางมาถึงหน้าคฤหาสน์ไม้ไร้ตะปู *คาราสึมะเกะ* ท่ามกลางหมอกภูเขา |
| **2** | **CH02** (`02-chapter-02.md`) | 1 | นาโอะสำรวจรอยต่อสลักไม้ในคฤหาสน์ พร้อมภาพซ้อนความทรงจำถึงอากิระ (อิงหน้าตาอากิระวัยมหาลัยจากชีตต้นฉบับ ห้ามใส่กรอบบอลลูนความคิด) |
| **3** | **CH03** (`03-chapter-03.md`) | 1 | ชิองเสิร์ฟชาในห้องโถงใหญ่ ขณะที่อายาเมะเงยหน้าสเก็ตช์ภาพโครงสร้างคานไม้บนเพดาน |
| **4** | **CH04** (`04-chapter-04.md`) | 1 | ไคโตะ เรียวะ และนาโอะ พบว่าสะพานแขวนข้ามหุบเหวถูกตัดขาดท่ามกลางสายฝน |
| **5** | **CH05** (`05-chapter-05.md`) | 1 | การพบศพเรียวะในห้องปิดตาย (*โทจิรุมะ*) ข้างเสาหลักและลิ่มไม้ |
| **6** | **CH06** (`06-chapter-06.md`) | 1 | มิซากิและนาโอะตรวจสอบร่องบานเลื่อนและรอยต่อไม้เทียบกับสมุดบันทึกของเรียวะ |
| **7** | **CH07** (`07-chapter-07.md`) | 1 | ความตื่นตระหนกของริสะบริเวณชานพักบันไดในคืนไฟดับ หลังไคโตะหายตัวไปในความมืด |
| **8** | **CH08 — ภาพที่ 1** (`08-chapter-08.md`) | 2 (1/2) | การพบศพไคโตะและกลไกรอกคานไม้ถ่วงน้ำหนักในโกดังเก่า |
| **9** | **CH08 — ภาพที่ 2** (`08-chapter-08.md`) | 2 (2/2) | ความหวาดระแวงและการปะทะคารมกันรอบเตาผังพื้น (*อิโรริ*) ระหว่างริสะ อายาเมะ มิซากิ และนาโอะ |
| **10** | **CH09** (`09-chapter-09.md`) | 1 | อายาเมะเปิดสมุดสเก็ตช์ให้นาโอะดูภาพตัดขวางโครงสร้างท่อนำเสียงของคฤหาสน์ |
| **11** | **CH10 — ภาพที่ 1** (`10-chapter-10.md`) | 2 (1/2) | ฆาตกรสวมหน้ากากไม้พุ่งจู่โจมออกมาจากผนังกลไกไม้หมุนในทางเดินมืด |
| **12** | **CH10 — ภาพที่ 2** (`10-chapter-10.md`) | 2 (2/2) | นาโอะและมิซากิค้นพบเสาเอก (*ไดโคคุบาชิระ*) และสลักแม่ (*โอยะคุซาบิ*) ใต้พื้นคฤหาสน์ |
| **13** | **CH11** (`11-chapter-11.md`) | 1 | นาโอะ มิซากิ และอายาเมะ ทดสอบเคาะคานไม้เพื่อจับทิศทางเสียงสะท้อนในโครงสร้างบ้าน |
| **14** | **CH12 — ภาพที่ 1** (`12-chapter-12.md`) | 2 (1/2) | ฉากเปิดเผยตัวจริง เมื่อชิองถอดหน้ากากไม้ลงต่อหน้านาโอะและมิซากิในโถงกลาง |
| **15** | **CH12 — ภาพที่ 2** (`12-chapter-12.md`) | 2 (2/2) | วินาทีที่ชิองตอกปลดสลักแม่ (*โอยะคุซาบิ*) จนโครงสร้างคานไม้ทั้งคฤหาสน์ปลดล็อกและพังทลายลงมา |
| **16** | **Epilogue** (`13-epilogue.md`) | 1 | แสงเช้าหลังคฤหาสน์ไม้พังทลาย นาโอะถือสมุดบันทึกของเรียวะและลิ่มไม้ชิ้นเล็กไว้ในมือ โดยมีมิซากิและอายาเมะอยู่ด้านหลัง |
