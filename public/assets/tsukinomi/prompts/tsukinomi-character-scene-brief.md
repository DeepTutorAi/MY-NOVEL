# Tsukinomi — Character & Location Reference Brief (B&W LN Prompt Sheets)

เอกสารข้อมูลอ้างอิงและคลัง Prompt สำเร็จรูปสำหรับการออกแบบตัวละคร (Character Sheets) และฉากสถานที่ (Location Plates) ในรูปแบบ **ภาพวาดขาวดำสไตล์ไลท์โนเวลญี่ปุ่น (Black-and-white Anime/Light Novel Illustration)**

---

## 🎨 ทิศทางศิลปะร่วมกัน (Unified Art Style Direction - Kaori's Benchmark)
ลายเส้นและสไตล์ภาพทั้งหมดได้รับการล็อกมาตรฐานอย่างเข้มงวดให้ตรงกับ **ภาพโมเดลของ Kaori (ภาพที่ 4)** ซึ่งเป็นแบบอย่างความสมบูรณ์แบบสูงสุดของโปรเจกต์นี้ เพื่อป้องกันไม่ให้ลายเส้นของตัวละครอื่นๆ เกิดความเพี้ยนหรือหลุดไปจากโทนเรื่อง:
* **ลายเส้น (Linework):** ลายเส้นหมึกคมกริบและละเอียดอ่อนเป็นพิเศษ (Clean, delicate, and fine ink manga linework) ใช้เส้นขอบที่เรียวบางแต่คมชัดแบบระดับมืออาชีพ ไม่มีรอยฟุ้งหรือลายเส้นที่หนาเกินไป
* **การลงน้ำหนักและสกรีนโทน (Shading & Screentone):** การจัดแสงระดับไฮเอนด์ด้วยการลงเฉดสีดิจิทัลแบบนุ่มนวล (Soft digital screentone halftone shading with smooth gray gradients) และมีระดับคอนทราสต์ที่สวยงามชัดเจน (High-contrast grayscale) 
* **จุดเด่นทางสายตา (Visual Appeal):** เน้นโครงหน้าและสัดส่วนที่เรียวบางเป็นธรรมชาติ (Highly detailed and beautifully proportioned anime aesthetic) ดวงตามีประกายสะท้อนแสงหลายชั้นที่มีมิติละเอียดอ่อน เส้นผมถูกวาดเป็นช่อละเอียดพริ้วไหวพร้อม **ไฮไลท์วงแหวนบนเส้นผม (Angel ring highlights)** ที่เด่นชัด

---

## 📂 วิธีใช้งานคลัง Prompt สำเร็จรูป (Fully Merged & Ready to Use)
Prompt ด้านล่างนี้ได้รับการ **Merge (รวมส่วนผสมทั้งหมด)** ทั้งทิศทางศิลปะจาก Kaori's Benchmark, รูปลักษณ์เฉพาะตัว และคำสั่งจัดหน้า (Format Lock) ไว้ในช่องโค้ด JSON ช่องเดียวอย่างสมบูรณ์แบบโดยไม่ต้องใช้คำสั่งหรือลิงก์อ้างอิงภายนอกที่กำกวม (เช่น ref same image) เพื่อให้ AI สามารถถอดรหัสและเจนภาพออกมาได้คมชัดและตรงสไตล์ที่สุด

---

## A · Location Plates (ฉากสถานที่ / ไม่มีตัวละคร / ไม่มีตัวหนังสือ)

สำหรับสร้างภาพพื้นหลังประกอบฉากที่ล็อกทิศทางศิลปะขาวดำแบบไลท์โนเวลอย่างแม่นยำ

### A1 · Tsukinomi Station (สถานีรถไฟสึคิโนมิ - สถานีร้างกลางหุบเขา)
```json
{
  "prompt": "monochrome black-and-white anime light-novel illustration, single background illustration plate, no characters, no text. An abandoned 1920s Japanese mountain rail station at dusk: dark-tile wooden station building, glassless windows, three rows of weathered wooden benches inside, a broken glass ticket booth, a round wall clock stopped at 7:14, a faded timetable board, twenty stone steps leading up to a wide stone yard, holes in the wooden roof with a dry floor. clean delicate fine ink manga linework, soft digital screentone halftone shading with smooth gray gradients, high-contrast grayscale, printed-novel insert look, still, lonely, uncanny atmosphere.",
  "negative_prompt": "color, colored, full color, sepia, realistic, photorealistic, photograph, 3d, CGI render, semi-realism, soft airbrush, soft grayscale photo, blurry lineless, watermark, signature, artist logo, people, figures, characters, text, writing"
}
```

### A2 · The Middle Bench (เก้าอี้ม้านั่งยาวแถวกลาง - ที่ที่คาโอรินั่งเสมอ)
```json
{
  "prompt": "monochrome black-and-white anime light-novel illustration, single background illustration plate, no characters, no text. Close study of the centre row of weathered wooden station benches inside an abandoned train station, one worn seat slightly polished as if long used, dust motes floating in a shaft of low dramatic evening light, an old 1980s paper milk carton discarded nearby. clean delicate fine ink manga linework, soft digital screentone halftone shading with smooth gray gradients, high-contrast grayscale, printed-novel insert look, nostalgic, heavy absence.",
  "negative_prompt": "color, colored, full color, sepia, realistic, photorealistic, photograph, 3d, CGI render, semi-realism, soft airbrush, blurry, watermark, signature, artist logo, people, figures, characters, text, writing"
}
```

### A3 · The Father's Closed Room (ห้องปิดตายของพ่อ)
```json
{
  "prompt": "monochrome black-and-white anime light-novel illustration, single background illustration plate, no characters, no text. A small traditional Japanese room sealed and unused for years at the end of a hallway, thin layer of dust covering tatami mats, a low bookshelf filled with history books and music records, a small framed 1991 photograph on top, a closed upper drawer of a wooden chest, a faint brown water-stain in a ceiling corner. clean delicate fine ink manga linework, soft digital screentone halftone shading with smooth gray gradients, high-contrast grayscale, printed-novel insert look, quiet grief, doorway view inward.",
  "negative_prompt": "color, colored, full color, sepia, realistic, photorealistic, photograph, 3d, CGI render, semi-realism, soft airbrush, blurry, watermark, signature, artist logo, people, figures, characters, text, writing"
}
```

### A4 · Kitsune-Jinja (ศาลเจ้าสุนัขจิ้งจอกโบราณ)
```json
{
  "prompt": "monochrome black-and-white anime light-novel illustration, single background illustration plate, no characters, no text. A small, old Inari fox shrine hidden away in a deep mountain forest: a faded torii gate, stone-paved forecourt path, a moss-grown chozuya stone water basin, two weathered stone fox statues furred with moss standing guard, giant ancient cedar trees in the background. clean delicate fine ink manga linework, soft digital screentone halftone shading with smooth gray gradients, high-contrast grayscale, printed-novel insert look, sacred, worn, watchful, twilight mist.",
  "negative_prompt": "color, colored, full color, sepia, realistic, photorealistic, photograph, 3d, CGI render, semi-realism, soft airbrush, blurry, watermark, signature, artist logo, people, figures, characters, text, writing"
}
```

### A5 · Abandoned Mizushima Village (หมู่บ้านร้างตระกูลมิซุชิมะ)
```json
{
  "prompt": "monochrome black-and-white anime light-novel illustration, single background illustration plate, no characters, no text. Four derelict wooden traditional Japanese houses around a stone-set central yard high on a forested mountain, empty for thirty years, black-tile roofs sagging, a large ancient immovable sacred stone in the centre of the yard, tall cedar trees closing in from all sides. clean delicate fine ink manga linework, soft digital screentone halftone shading with smooth gray gradients, high-contrast grayscale, printed-novel insert look, cold, forsaken, overcast dark sky.",
  "negative_prompt": "color, colored, full color, sepia, realistic, photorealistic, photograph, 3d, CGI render, semi-realism, soft airbrush, blurry, watermark, signature, artist logo, people, figures, characters, text, writing"
}
```

### A6 · Azuma Riverside & Iron Footbridge (ริมแม่น้ำอาซุมะและสะพานเหล็กเก่า)
```json
{
  "prompt": "monochrome black-and-white anime light-novel illustration, single background illustration plate, no characters, no text. A clear mountain river flowing along a stony gravel bank under an old narrow iron pedestrian bridge, a quiet paved bicycle path alongside with wild autumn grasses swaying. clean delicate fine ink manga linework, soft digital screentone halftone shading with smooth gray gradients, high-contrast grayscale, printed-novel insert look, gentle, nostalgic, tender afternoon light.",
  "negative_prompt": "color, colored, full color, sepia, realistic, photorealistic, photograph, 3d, CGI render, semi-realism, soft airbrush, blurry, watermark, signature, artist logo, people, figures, characters, text, writing"
}
```

---

## B · Character Model Sheets (แผ่นโมเดลตัวละคร / มีความสม่ำเสมอสูง / มีตัวอักษรและไม้บรรทัดวัดความสูงกำกับ)

โมเดลชีตสำเร็จรูปสำหรับการสร้างต้นแบบตัวละครในมุมมองต่างๆ (Turnaround) พร้อมจัดหน้าอย่างเป็นระเบียบตามมาตรฐานงานออกแบบอนิเมะ

### B1 · Takahashi Haruto (ทาคาฮาชิ ฮารุโตะ - พระเอก)
> **[Reworked]** ปรับแก้ให้หน้าตา **"ธรรมดา เรียบง่าย และจับต้องได้"** ไม่ใช่หล่อจัดแบบนายแบบไอดอลเคป๊อป เพื่อให้อิงกับความเป็นจริงและกลมกลืนกับตัวละครอื่น (อากิระ, ฮินะ, แม่นาโอมิ)
* **ความสัมพันธ์ทางหน้าตา (Sibling & Family Resemblance):** เพิ่มการสืบทอดสายเลือดจากแม่นาโอมิและน้องสาวฮินะอย่างเห็นได้ชัด มีแววตาที่ถอดแบบความอ่อนโยนของแม่ โครงหน้ามีลักษณะรูปไข่ค่อนข้างมนและอบอุ่นคล้ายกับฮินะ
* **ใบหน้าและหน้าตา:** ใบหน้าธรรมดาที่ดูสุภาพ เรียบง่าย ไม่สะดุดตา (Ordinary, gentle, plain teenage boy face) ดวงตาทรงอัลมอนด์ที่อ่อนโยน สงบ และเรียบเฉยตามประสาเด็กหนุ่มธรรมดาทั่วไป (ไม่ได้มีความเฉี่ยวคมหรือหล่อสะดุดตาเป็นพิเศษ)
* **ทรงผม:** ทรงผมเรียบง่ายและเป็นธรรมชาติ (Style 1 จากภาพตัวอย่าง หรือทรงผมสากลทั่วไป) ผมสั้นสีดำยุ่งเล็กน้อยอย่างเป็นธรรมชาติ มีปอยผมตกกรอบหน้าอย่างสุภาพ ไม่เซ็ตผมคมหรือจัดทรงเกินงาม

```json
{
  "prompt": "monochrome black-and-white anime light-novel illustration, character model sheet turnaround on plain white background, front full-body, 3/4 front, side profile, back full-body, a row of 3 face expression studies: calm, reserved, and slightly sad. Takahashi Haruto, an ordinary quiet teenage high school boy, height 169cm, featuring a highly visible and natural family resemblance to his mother Naomi and sister Hina, inheriting their soft, gentle, and slightly rounded face shape. has a plain, everyday, and unremarkable face with a gentle, friendly, and soft jawline, and calm almond-shaped dark eyes with a quiet, unassuming gaze. featuring simple, natural, slightly unkempt short black hair (Style 1 from hairstyle chart) that is soft and messy in a realistic teenage way, with fine glossy angel ring hair highlights. wears modern grey school blazer worn a little loose, a slightly loose striped tie, dark trousers, loafers, an old matte-grey cassette walkman with a small 'N' scratch on the lid clipped at his belt. vertical height-scale ruler down the left edge marked with 169cm, small plain text label 'Haruto', small view labels. clean delicate fine ink manga linework, soft digital screentone halftone shading with smooth gray gradients, high-contrast grayscale, printed-novel insert look, unassuming and quiet everyday teenage boy aura.",
  "negative_prompt": "color, colored, full color, sepia, realistic, photorealistic, photograph, 3d, CGI render, semi-realism, soft airbrush, blurry, watermark, signature, artist logo, sexualization, fanservice, naked, revealing, remarkably handsome, k-pop idol, sharp jawline, flower boy, background scenery"
}
```

### B2 · Mizushima Kaori (มิซุชิมะ คาโอริ - นางเอก / วิญญาณสาวผู้เฝ้ารอ)
> **[Kaori's Art Benchmark - LOCKED]** ล็อกดีไซน์ความสวยสมบูรณ์แบบไร้ที่ติ และดวงตาเฉี่ยวมีเสน่ห์ดึงดูดใจตามภาพที่ 4 

```json
{
  "prompt": "monochrome black-and-white anime light-novel illustration, character model sheet turnaround on plain white background, front full-body, 3/4 front, side profile, back full-body, a row of 3 face expression studies: calm, faint mysterious smile, and faraway melancholy. Mizushima Kaori, a quiet melancholy teenage ghost heroine, height 163cm, a gentle understated face with slender almond dark eyes (ตาเรียว) and soft catchlights, a small delicate mouth, a slender cute upturned nose, long single neat braid over one shoulder tied with a dark ribbon, white socks above the ankle, loafers, navy sailor-style school uniform. vertical height-scale ruler down the left edge marked with 163cm, small plain text label 'Kaori', small view labels. clean delicate fine ink manga linework, soft digital screentone halftone shading with smooth gray gradients, high-contrast grayscale, printed-novel insert look, ghostly stillness (braid and uniform skirt hang perfectly still as if untouched by wind).",
  "negative_prompt": "color, colored, full color, sepia, realistic, photorealistic, photograph, 3d, CGI render, semi-realism, soft airbrush, blurry, watermark, signature, artist logo, sexualization, fanservice, naked, revealing, background scenery"
}
```

### B3 · Hina (ฮินะ - น้องสาวของฮารุโตะ)
> **[Hina's Design - APPROVED]** ล็อกดีไซน์ความน่ารักสมบูรณ์แบบตามภาพที่ 1 มีเค้าโครงหน้าเรียวบางที่ละม้ายคล้ายกับพี่ชายและแม่ มีผมที่ยาวเลยไหล่ลงมาเล็กน้อยสลวยเป็นลอนคลื่น และติดกิ๊บริบบิ้นคู่สุดน่ารัก

```json
{
  "prompt": "monochrome black-and-white anime light-novel illustration, character model sheet turnaround on plain white background, front full-body, 3/4 front, side profile, back full-body, a row of 3 cheerful and expressive faces: energetic smile, curiosity, and bright laughter. Hina, Haruto's younger sister, height 150cm, sharing an undeniable and highly visible sibling resemblance to Haruto, inheriting his elegant slender face shape and delicate jawline. features beautiful medium-length dark hair falling gracefully past her shoulders with soft natural waves (reflecting Haruto's soft hair texture), featuring neat styled side-swept bangs framing her face, decorated with a small cute ribbon hair clip on the left side. has delicate, slightly soft almond-shaped dark eyes that mirror Haruto's calm eyes but are larger, bright, warm, and filled with youthful cuteness and sparkling catchlights. wears ordinary middle-school uniform with a neat bow, white socks, and loafers. vertical height-scale ruler down the left edge marked with 150cm, small plain text label 'Hina', small view labels. clean delicate fine ink manga linework, soft digital screentone halftone shading with smooth gray gradients, high-contrast grayscale, printed-novel insert look, sunny and energetic bearing.",
  "negative_prompt": "color, colored, full color, sepia, realistic, photorealistic, photograph, 3d, CGI render, semi-realism, soft airbrush, blurry, watermark, signature, artist logo, sexualization, fanservice, background scenery"
}
```

### B4 · Suzuki Akira (ซูซูกิ อากิระ - เพื่อนสนิทสายโอตาคุ)
> **[Akira's Design - APPROVED]** ล็อกดีไซน์ความเป็นมิตรและดูดีแบบโอตาคุที่เป็นธรรมชาติ ตามภาพที่ 3 ผมสั้นทรง Choppy Spiky Crop (สั้นตั้งฟูเป็นชั้นๆ) ใส่แว่นกรอบสี่เหลี่ยม

```json
{
  "prompt": "monochrome black-and-white anime light-novel illustration, character model sheet turnaround on plain white background, front full-body, 3/4 front, side profile, back full-body, a row of 3 expressive face studies. Suzuki Akira, a lanky teenage otaku schoolboy, height 174cm, slender refined face with clean thin-rimmed rectangular glasses, highly detailed expressive eyes, featuring a short choppy spiky textured dark crop with cropped sides and a slightly messy spiky top (spiky crop hairstyle) giving him a smart yet passionate otaku look. wears modern school blazer with a small anime/band pin on the lapel, a neat tie, trousers, carrying a folder of printouts under one arm. vertical height-scale ruler down the left edge marked with 174cm, small plain text label 'Akira', small view labels. clean delicate fine ink manga linework, soft digital screentone halftone shading with smooth gray gradients, high-contrast grayscale, printed-novel insert look, talkative and loyal bearing with a nervous edge.",
  "negative_prompt": "color, colored, full color, sepia, realistic, photorealistic, photograph, 3d, CGI render, semi-realism, soft airbrush, blurry, watermark, signature, artist logo, sexualization, fanservice, background scenery"
}
```

### B5 · Yamaba-baa / Kuchinashi (ยายแก่แห่งภูเขา / ป้าไร้ปาก - โยไก)
```json
{
  "prompt": "monochrome black-and-white anime light-novel illustration, character model sheet turnaround on plain white background, front full-body, 3/4 front, side profile, back full-body. Yamaba-baa (Kuchinashi), a gaunt ancient mountain crone yokai, height 150cm (hunched over), mouthless face featuring smooth blank pale skin where the mouth should be, hollow sunken eyes, long white hair flowing down to her waist, tattered old black kimono, bare feet, holding a small worn brown book in her hands. vertical height-scale ruler down the left edge marked with 150cm, small plain text label 'Yamaba', small view labels. clean delicate fine ink manga linework, soft digital screentone halftone shading with smooth gray gradients, high-contrast grayscale, printed-novel insert look, deeply uncanny, eerie and sorrowful mood, non-graphic.",
  "negative_prompt": "color, colored, full color, sepia, realistic, photorealistic, photograph, 3d, CGI render, semi-realism, soft airbrush, blurry, watermark, signature, artist logo, sexualization, fanservice, gore, blood, raw flesh, background scenery"
}
```

### B6 · Naomi (นาโอมิ - แม่ของฮารุโตะและฮินะ)
> **[Reworked]** ปรับปรุงรายละเอียดเพื่อล็อกรูปใบหน้าและอารมณ์ความนุ่มนวลอมเศร้าตามภาพที่ 5 ของตัวละครคุณแม่ให้แม่นยำยิ่งขึ้น
* **ใบหน้าและหน้าตา:** ใบหน้ารูปไข่แฝงความเหนื่อยล้าแต่ทว่ายังคงความงดงามและอ่อนโยน ดวงตาเรียวสวยแบบตา สองชั้น (Gentle double eyelids) แววตาสงบนิ่ง อบอุ่น แฝงไปด้วยความเศร้าจากการสูญเสียสามี
* **ทรงผมและรูปลักษณ์:** ผมสีดำรวบเป็นหางม้าต่ำแบบเรียบง่าย (Simple low ponytail) มีปอยผมด้านข้างหล่นล้อมกรอบหน้าอย่างเป็นธรรมชาติ ใส่ผ้ากันเปื้อนสีเทาขรึมทับเสื้อคอกลมแขนยาวกึ่งสบายๆ

```json
{
  "prompt": "monochrome black-and-white anime light-novel illustration, character model sheet turnaround on plain white background, front full-body, 3/4 front, side profile, back full-body, a row of 3 quiet expressions. Naomi, Haruto and Hina's mother, early 40s, height 160cm, a gentle and graceful woman with a warm but weary maternal aura. features a soft, slender oval face with gentle double eyelids and steady, kind, slightly sad eyes holding a quiet, unspoken grief. her dark hair is neatly tied back in a simple low ponytail with soft side strands naturally framing her face. wearing a plain grey kitchen work apron over a comfortable long-sleeved shirt and trousers, simple indoor slippers. vertical height-scale ruler down the left edge marked with 160cm, small plain text label 'Naomi', small view labels. clean delicate fine ink manga linework, soft digital screentone halftone shading with smooth gray gradients, high-contrast grayscale, printed-novel insert look, calm and resilient bearing.",
  "negative_prompt": "color, colored, full color, sepia, realistic, photorealistic, photograph, 3d, CGI render, semi-realism, soft airbrush, blurry, watermark, signature, artist logo, sexualization, fanservice, background scenery"
}
```

### B7 · Tanaka / Akihiro (อาจารย์ทานากะ / น้าอากิฮิโระ - ครูพละ)
> **[Reworked]** ปรับปรุงทรงผมของตัวละครชายรุ่นผู้ใหญ่ให้ดูดีและคมเข้มสไตล์ไลท์โนเวล โดยใช้ **Style 4 จากภาพตัวอย่าง** (ทรงผมปัดข้างเปิดหน้าผากสุดเท่สไตล์ Two-Block / Undercut ที่ดูภูมิฐานและสปอร์ต)

```json
{
  "prompt": "monochrome black-and-white anime light-novel illustration, character model sheet turnaround on plain white background, front full-body, 3/4 front, side profile, back full-body, a row of 3 quiet, slightly regretful expressions. Tanaka Akihiro, PE teacher and uncle, forties, height 176cm, fit athletic build, featuring handsome short sporty textured hair neatly styled with a clean side-part opening up the forehead (Style 4 from hairstyle chart), mature and refined face with a sharp masculine jawline, expressive eyes holding a deep solemn and regretful look. wears sporty track jacket and athletic pants. vertical height-scale ruler down the left edge marked with 176cm, small plain text label 'Akihiro', small view labels. clean delicate fine ink manga linework, soft digital screentone halftone shading with smooth gray gradients, high-contrast grayscale, printed-novel insert look, grounded, kind, and quietly solemn bearing.",
  "negative_prompt": "color, colored, full color, sepia, realistic, photorealistic, photograph, 3d, CGI render, semi-realism, soft airbrush, blurry, watermark, signature, artist logo, sexualization, fanservice, background scenery"
}
```

### B8 · Watanabe (คุณตาบะตะนาเบะ - ผู้ดูแลศาลเจ้า)
```json
{
  "prompt": "monochrome black-and-white anime light-novel illustration, character model sheet turnaround on plain white background, front full-body, 3/4 front, side profile, back full-body, a row of 3 serene expressions. Watanabe, the elderly Shinto shrine keeper, age 78, height 165cm, serene and peaceful face weathered with age, long neat white hair, wearing a traditional white kannushi robe over a deep navy hakama, holding a string of small wooden prayer beads in one hand. vertical height-scale ruler down the left edge marked with 165cm, small plain text label 'Watanabe', small view labels. clean delicate fine ink manga linework, soft digital screentone halftone shading with smooth gray gradients, high-contrast grayscale, printed-novel insert look, patient and knowing bearing.",
  "negative_prompt": "color, colored, full color, sepia, realistic, photorealistic, photograph, 3d, CGI render, semi-realism, soft airbrush, blurry, watermark, signature, artist logo, sexualization, fanservice, background scenery"
}
```

---

## 📊 รายชื่อตัวละครและส่วนสูง (Character Roster & Heights Reference)

| ลำดับ | ตัวละคร (ภาษาไทย) | Character Name | ส่วนสูง (cm) | ลำดับความสำคัญในการทำภาพ |
| :---: | :--- | :--- | :---: | :--- |
| **B1** | Takahashi Haruto (ฮารุโตะ) | Takahashi Haruto | 169 | **หลัก (Core Character)** |
| **B2** | Mizushima Kaori (คาโอริ) | Mizushima Kaori | 163 (Fixed) | **หลัก (Core Character)** |
| **B3** | Hina (ฮินะ) | Hina | 150 | **หลัก (Core Character)** |
| **B4** | Suzuki Akira (อากิระ) | Suzuki Akira | 174 | **หลัก (Core Character)** |
| **B5** | Yamaba-baa / Kuchinashi (ยายแก่ก้นครัว) | Yamaba-baa | ~150 (Hunched) | **ตัวตนลึกลับหลัก (Key Yokai)** |
| **B6** | Naomi (คุณแม่นาโอมิ) | Naomi | 160 | สำคัญ (Important) |
| **B7** | Tanaka / Akihiro (น้าอากิฮิโระ) | Tanaka Akihiro | 176 | สำคัญ (Important) |
| **B8** | Watanabe (คุณตาวาตานาเบะ) | Watanabe | 165 | สนับสนุน (Supporting) |

### 🍂 ตัวละครประกอบเสริม (ไม่มีในภาพแบบจำลอง / อ้างอิงเนื้อเรื่องเท่านั้น)
* **Daichi (ไดจิ):** พ่อของฮารุโตะ (เสียชีวิตแล้ว ปรากฏตัวเฉพาะในภาพถ่ายปี 1991)
* **Mizushima Genzo / Setsuko / Takeshi:** ครอบครัวของคาโอริในอดีต
* **คุณลุงร้านสะดวกซื้อ 7-Eleven**
* **คุณป้าซาโต้ (Auntie Sato)**
* **อาจารย์โมริ (Teacher Mori)**
