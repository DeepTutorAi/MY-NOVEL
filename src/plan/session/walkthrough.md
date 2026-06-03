# Walkthrough — Tsukinomi Novel Scan & Polish (Slice 1 & Slice 2)

We have scanned and polished **Slice 1 (Chapters 4-5)** and **Slice 2 (Chapters 6-7)** in `src/content/tsukinomi/sections/`.

---

## Slice 1: Chapters 4 & 5 (Completed)

### [MODIFY] [02-reveal.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/02-reveal.md) (Chapter 4)
1. **Akira's Nickname Correction**:
   - Swapped out stale `พ่อคนบรรลุธรรม` for the correct canon joke nickname `คนตื่นธรรม` in two dialogue turns (line 129 and line 425).
2. **Diary POV Pronoun Corrections**:
   - Adjusted Haruto's internal log notes (lines 939 and 940) which previously read `พ่อนาย` when referencing his own father. Corrected to `พ่อ` (first-person diary perspective) and synced with the actual dialogue lines:
     - `ทานากะ เรียกผมด้วยคำพูดว่า "ดื้อรั้นเหมือนกับพ่อนายไม่มีผิด"` → `ทานากะ เรียกผมด้วยคำพูดว่า "ดื้อเหมือนพ่อไม่มีผิด"` (matching line 335).
     - `บ่งชี้ชัดเจนว่า ทานากะ รับทราบข้อมูลลึกซึ้งเกี่ยวกับการไปเยือนสถานีร้างของพ่อนายแน่นอน` → `บ่งชี้ชัดเจนว่า ทานากะ รับทราบข้อมูลเกี่ยวกับการไปเยือนสถานีร้างของพ่อแน่นอน`.

### [PASSED] [02-reveal.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/02-reveal.md) (Chapter 5)
- **Dialogue & Register check**: Verifying lines of Akira (`คนตื่นธรรม`), Naomi (`จ้ะ/นะจ๊ะ`), and Tanaka Akihiro (`ทาคาฮาชิ`/`ครู`). All matches the character guide matrix perfectly.
- **Timeline/Logic check**: Verified the years mentioned in Watanabe's and Tanaka's recollections (1991, 2018, 2020, 2025). No logical paradoxes or contradictions detected. Left unmodified by design.

---

## Slice 2: Chapters 6 & 7 (Completed)

### [FLAGGED] [02-reveal.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/02-reveal.md) (Chapter 6)
- ⚠️ **Timeline / Canon Date Paradox**:
  - In Chapter 5, newspaper records state that **Suzuki Takashi went missing in the mountains on September 14, 1991**.
  - In Chapter 6 (line 3080), Haruto finds a photo of Daichi, Takashi, and Akihiro with a handwritten note: *"Before visiting the abandoned Tsukinomi Station for the last time, **October 4, 1991**"*.
  - If Takashi went missing on September 14, he could not have taken a photo on October 4.
  - Also, in 1991, Tsukinomi Station was still active (it closed in 1992); the term "abandoned station" (สถานีร้าง) in the note is historically inaccurate for that moment.
  - **Action**: Per voice bible rules, we have **flagged this for the author's decision** instead of auto-correcting. We propose changing the photo date to **September 13/14, 1991** and changing *"abandoned Tsukinomi Station"* (สถานีร้างสึคิโนมิ) to *"Tsukinomi Station"* (สถานีสึคิโนมิ).

### [MODIFY] [03-decision.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/03-decision.md) (Chapter 7)
1. **Tanaka Akihiro (ลุงทานากะ) Register Correction (2 spots)**:
   - Removed overly soft/feminine endings (`จ้ะ` and `นะจ้ะ`) spoken by Tanaka, aligning with his tense/short/guilt-ridden character profile:
     - `Tanaka: "ใช่แล้วล่ะจ้ะหลานชาย..."` → `Tanaka: "ใช่แล้วล่ะหลานชาย..."` (line 442)
     - `Tanaka: "...และระวังความปลอดภัยให้ดีเสมอด้วยนะจ้ะ ฮารุโตะ"` → `Tanaka: "...และระวังความปลอดภัยให้ดีเสมอด้วยนะ ฮารุโตะ"` (line 456)
2. **Suzuki Akira Register Correction (1 spot)**:
   - Removed the feminine soft ending `จ้ะ` from Akira's dialogue to match his snarky schoolfriend register:
     - `Akira: "ก็เหมือนเดิม นอนอ่านมังงะอยู่บ้านนั่นแหละจ้ะ..."` → `Akira: "ก็เหมือนเดิม นอนอ่านมังงะอยู่บ้านนั่นแหละ..."` (line 765)

---

## Slice 3: Chapters 8 & 9 (Completed)

### [MODIFY] [02-reveal.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/02-reveal.md) (Chapter 6 follow-up)
- **Timeline Date Correction**: Adjusted the photo inscription date to `13/14 กันยายน 1991` based on the author's feedback, resolving the timeline paradox with Suzuki Takashi's disappearance date while keeping the term "สถานี" (removing "ร้าง").

### [MODIFY] [03-decision.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/03-decision.md) (Chapters 8 & 9)
1. **Tanaka Akihiro Register Correction (Chapter 8)**:
   - Removed the feminine ending `จ้ะ` from Tanaka's dialogue:
     - `Tanaka: "ไม่ต้องเริ่มให้สวยหรอกจ้ะหลาน..."` → `Tanaka: "ไม่ต้องเริ่มให้สวยหรอกหลาน..."` (line 1393).
2. **Haruto Register Correction (Chapter 9)**:
   - Simplified archaic question tag `งั้นรึ` to a natural teen ending `เลยเหรอ`:
     - `Haruto: "...ตั้งแต่สัปดาห์ที่แล้วเป็นต้นมางั้นรึ"` → `Haruto: "...ตั้งแต่สัปดาห์ที่แล้วเลยเหรอ"` (line 1880).
3. **Watanabe Register Corrections (Chapter 9)**:
   - Standardized Watanabe's pronoun for Haruto to `เธอ` instead of `นาย` to align with the voice bible:
     - Swapped `นาย` to `เธอ` in 14 dialogue turns (lines 2330, 2344, 2348, 2364, 2368, 2378, 2392, 2412, 2426, 2442, 2448, 2488, 2498, 2506, 2516, 2520, 2528, 2594, 2598).
4. **Daichi spelling consistency (Chapter 9)**:
   - Translated 10 occurrences of `พ่อ Daichi` to `พ่อไดจิ` to avoid English/Thai mixture and match the rest of the novel's spelling.
5. **Parent addressing cleanup (Chapter 9)**:
   - Simplified parent references in dialogue and first-person thoughts/narration by Haruto and Hina:
     - Changed `พ่อไดจิ` / `คุณพ่อไดจิ` in Haruto's narration and lines to `พ่อ` / `คุณพ่อ` (lines 833, 1299, 1812, 1844, 1988, 2428).
     - Changed `พ่อไดจิ` in Hina's lines to `คุณพ่อ` (lines 2090, 2122, 2162).
     - Removed "Naomi" from `แม่ Naomi` in Haruto's first-person narration to refer to her simply as `แม่` (lines 1752, 1774, 2208, 2214, 2272).
   - Also updated similar occurrences in `04-mountain.md` (lines 4092, 4100, 5771).

---

## Slice 4: Chapters 10 & 11 (Completed)

### [MODIFY] [03-decision.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/03-decision.md) (Chapter 10)
- **Tanaka Register Correction**:
  - Changed Tanaka's uncle register at school from formal `ผมรักนาย Haruto` to warm `ลุงรักเธอนะ ฮารุโตะ` to match Haruto calling him "ลุง" (line 3614).

### [MODIFY] [04-mountain.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/04-mountain.md) (Chapter 11)
1. **Narration Pronoun Correction**:
   - Fixed pronoun slips in Haruto's narration where he referred to himself as `ฉัน` instead of `ผม` while reading Kaori's diary. Changed 7 lines (lines 333, 347, 373, 375, 379, 381, 399) to keep the narration voice consistent, while preserving `ฉัน` inside Kaori's diary entries.
2. **Dialogue Markup & Name Spelling Consistency**:
   - Fixed a missing closing double quote in line 609 and updated names to Thai script:
     - `Haruto: "...ผม Takahashi Haruto หลานของ Takahashi Genichi ที่เคยเฝ้ากับ Genzo"` $\rightarrow$ `Haruto: "...ผม ทาคาฮาชิ ฮารุโตะ หลานของ เก็นอิจิ ที่เคยเฝ้าศาลเจ้าร่วมกับเก็นโซ"`
3. **Parent Naming Cleanups**:
   - Removed "Naomi" from `Naomi, Hina และผม` in Haruto's narration to refer to her simply as `แม่` (line 892).

---

## Slice 5: Chapters 12 & 13 (Completed)

### [MODIFY] [04-mountain.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/04-mountain.md) (Chapter 11 - Additional Polish)
1. **Kaori's Diary Entries**:
   - Removed all polite ending particles (`ค่ะ`, `คะ`, `นะคะ`) from her private diary entries, as she is writing to herself (lines 337, 341, 351, 359, 382, 384, 393, 399, 402, 404, 406).
   - Standardized references to her father and mother as `คุณพ่อ` (father) and `คุณแม่` (mother).
   - Polished awkward phrasing (e.g., `"gardenia ใหม่"` $\rightarrow$ `"ต้นการ์ดีเนียต้นใหม่"`).
2. **Dialogue Register**:
   - Corrected Haruto's reference to Kaori in line 75 (`"...เธอบอก..."` $\rightarrow$ `"...คุณคาโอริบอก..."`).
   - Improved Haruto's introduction to Yamaba in line 609 to be polite and culturally natural in Thai.

### [MODIFY] [04-mountain.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/04-mountain.md) (Chapter 12)
1. **Family Registers & Dialogue**:
   - Updated the breakfast table dialogue between Haruto, Hina, and Naomi. Hina now uses warm sisterly honorifics (`พี่คะ`, `นะคะ`, `สัญญาไหมคะ`) and Naomi refers to Haruto as `ฮารุโตะ` or `ลูก` using gentle endings (`นะลูก`, `จ้ะ`).
   - Polished Haruto's rooftop chat with Akira, correcting literal translations and aligning his best-friend register (no `ผม/ครับ`).
   - Surgically updated Tanaka's gym-class dialogue (`Tanaka: "...วิ่งกันให้สนุกนะ เด็กๆ"`).
2. **Haruto & Kaori Station Dialogue**:
   - Re-voiced the entire final meeting at the station, aligning registers to Showa-era polite tone (`ฉัน`, `นะคะ`, `คะ?`, `คุณ`).

### [MODIFY] [04-mountain.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/04-mountain.md) (Chapter 13)
1. **Sibling Anchor Letter**:
   - Surgically fixed the literal translation of Hina's anchor letter where `"ผม"` (hair) was translated in a subject position. Replaced with `"เส้นผมนี้"` and `"มัน"` to avoid the masculine pronoun slip.
2. **Dialogue & Climax Peak**:
   - Polished the walk up the mountain, replacing direct translation of `"เริ่มลด"` with `"กำลังค่อยๆ เลือนลางลงทีละน้อย"`.
   - Polished the final farewell dialogue between Haruto and Kaori to align with character registers, while keeping the author's beloved narration intact.
   - Polished Haruto's speech offering the tape to Yamaba to sound natural and respectful in Thai.
   - Kept the 4 `ตาเปียก` flags untouched inside the Chapter 13 climax, as per instructions.

---

## Slice 6: Refined Dialogue Closeness & Register Shift (Ch 4 to Ch 18) (Completed)

We refined the transition timing of the dialogue registers between **Haruto** and **Kaori** to follow a gradual, emotionally driven character arc. 

Instead of dropping all polite endings in Chapter 4 immediately, the registers evolve as their relationship deepens:
- **Chapters 4 & 6 (`02-reveal.md`)**: Both Haruto and Kaori speak politely. Haruto uses `ครับ` and Kaori uses `ค่ะ/นะคะ`, maintaining a respectful but warm Showa schoolgirl tone.
- **Chapters 7-10 (`03-decision.md`)**: Haruto starts dropping `ครับ` subtly when talking to Kaori, using plain or gentle endings (`นะ`, `เหรอ`, `ล่ะ`), while Kaori still retains her polite endings (`ค่ะ/นะคะ`).
- **Chapter 12 (`04-mountain.md`)**:
  - **Before receiving the gardenia flower**: Kaori continues to speak politely with `ค่ะ/นะคะ`.
  - **The Trigger Event**: Haruto brings Kaori a gardenia flower from her mother's house.
  - **After receiving the gardenia flower**: Deeply touched, Kaori unconsciously drops `ค่ะ/นะคะ` entirely and begins addressing Haruto as **`คุณ`** (instead of `ฮารุโตะคุง`), which represents a shift to an intimate, deep connection.
  - This casual, intimate register continues through their final climb and farewell in Chapter 13.

### [MODIFY] [02-reveal.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/02-reveal.md) (Chapters 4-6)
- Restored polite register (`ครับ/ค่ะ/นะคะ`) in Chapters 4 and 6 (lines 453-734, lines 1564-1640, lines 2806-2882).

### [MODIFY] [03-decision.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/03-decision.md) (Chapters 7-10)
- Restored polite register (`ค่ะ/นะคะ`) for Kaori when addressing Haruto (lines 675-708).
- Maintained Haruto's subtle drop of `ครับ` (already casual in the original file).

### [MODIFY] [04-mountain.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/04-mountain.md) (Chapters 11-16)
- Ensured Kaori uses polite register (`ค่ะ/นะคะ`) in Chapter 12 before receiving the flower (lines 1449-1477).
- Applied Kaori's transition to drop `ค่ะ/นะคะ` and use `คุณ` starting from line 1497 (after receiving the flower) through the end of Chapter 13.
- Example:
  - Line 1497 (Gardenia reaction): `Kaori: "...คุณไปบ้านของฉันมาเหรอ?"`
  - Line 1521: `Kaori: "...ขอบคุณนะ... คุณ"`
  - Line 1627: `Kaori: "...คุณ"`
  - Line 1689 ( farewell prep): `Kaori: "...ฉันรักคุณนะ"`

---

## Verification Results

We verified the codebase state with:
- All automated check scripts: `Get-ChildItem scratch/check_*.js | ForEach-Object { node $_.FullName }` (ALL PASSED, 0 issues found)
- `node scratch/check_common_errors.js` (PASSED)
- Astro check: `pnpm check` (PASSED, 0 errors, 0 warnings)
- Astro production build: `pnpm build` (PASSED, 35 pages built successfully)

---

## Slice 7: Chapters 17 & 18 Dialogue & Narration Polish (Completed)

### [MODIFY] [05-ten-years.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/05-ten-years.md)

1. **Akira Farewell Nickname Integration**:
   - Replaced Akira's initial platform address to Haruto at line 1337 with the nostalgic, high-impact adolescent nickname: **`พ่อคนบรรลุธรรม`** (Mr. Enlightened One).
   - This occurs exactly once and for the last time during their farewell:
     - `Akira: "ไง... พ่อคนบรรลุธรรม"`
     - `Haruto: "ยังอุตส่าห์เรียกด้วยคำนั้นอีกนะ"`
     - `Akira: "ก็ฉันจะเรียกนายแบบนั้นเป็นครั้งสุดท้ายแล้วนี่นา... หลังจากนี้คงไม่มีโอกาสได้เรียกอีกนาน"`
   - Maintained all other references as `คนตื่นธรรม` earlier in Chapter 17 to preserve this nickname's unique emotional impact.

2. **Chapter 17 Polish**:
   - **Graduation & Platform Dialogue (Lines 972-1052)**: Refined awkward phrasing (e.g. "ฉันจบ", "นายจบ ฉันก็จบ", "ฉันจะรับ") into natural, peer-to-peer Thai schoolfriend conversations ("จบสักที", "รบกวนด้วยนะ").
   - **Veranda First-Snow Scene (Lines 283-310)**: Rewrote stiff sentences between Haruto and Naomi to carry a gentle, literary tone ("ผมไม่เคยรู้เลยว่าแม่ก็ชอบมายืนที่ระเบียงตอนหิมะแรกตกเหมือนกัน").
   - **Aoyama Tuition Discussion (Lines 351-390)**: Polished mother-son dialogue to flow smoothly while discussing finances and future intentions.
   - **Sketchbook Check (Lines 493-594)**: Rewrote Hina and Haruto's dialogue to read like a natural sibling exchange, using correct pronouns and endings ("พี่คะ", "ฮินะ", "พี่ก็รักฮินะ").
   - **Departure Dialogue (Lines 1353-1406)**: Polished dialogues with Mother and Hina before Haruto boards the Tokyo train.

3. **Chapter 18 Polish**:
   - **Arrival & Reunion (Lines 1471-1537)**: Polished Haruto's narration and Hina/Tanaka reunion dialogues, ensuring spelling of `ชานชาลา` is correct and mirror tics are removed.
   - **Homecoming Welcome (Lines 1581-1601)**: Refined mother-son interactions and maternal advice to sound warm and natural in Thai.
   - **Piano Discussion (Lines 1673-1723)**: Simplified translated phrasing (e.g. "ครูเปียโนอายุห้าสิบ ผู้หญิง" $\rightarrow$ "คุณครูผู้หญิงคนหนึ่ง เธออายุห้าสิบกว่าแล้วล่ะครับ").
   - **Tsukinomi Site Visit (Lines 1825-1869)**: Polished Haruto's reflective narration at the closed station sign, emphasizing physical/body memory over conscious memory.
   - **Watanabe Final Visit (Lines 2354-2437)**: Polish dialogue and narration regarding Watanabe Sota's health, temple inheritance, and life choices.

---

## Slice 8: Intermediate Chapters 7-16 Deep-Dive Verification & Logic Fixes (Completed)

### [MODIFY] [02-reveal.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/02-reveal.md) (Chapter 4)
- **Akira's 2018 Grade Correction (Line 261)**:
  - Akira mentions he was in `ม.2` in 2018. However, since the current year is 2025 (where he is in `ม.6`), in 2018 (7 years prior) he would have been in `ป.5` (Grade 5).
  - Changed `ชั้น ม.2` to `ชั้น ป.5` to align with the active high school timeline.

### [MODIFY] [03-decision.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/03-decision.md) (Chapters 7-10)
1. **Saturday Timeline Reconciliation**:
   - Resolves the discrepancy where Haruto planned to meet Tanaka after 3:00 PM (lines 448 & 827) but Tanaka's text said 1:00 PM (line 923) and Naomi returned at 11:30 AM (leaving Haruto arriving over an hour early).
   - Changed Saturday appointment time in lines 448 & 827 to 1:00 PM (บ่ายโมง / บ่ายโมงตรง).
   - Changed Naomi's return time in line 968 to 12:30 PM (12:30 น.), making Haruto's departure at 12:30 PM and 15-minute bicycle travel sequence arrive perfectly at 12:45 PM for his 1:00 PM appointment.
2. **Tanaka school register (Chapter 10)**:
   - Replaced stilted/cold `ผม/นาย` dialogue pronouns in lines 3560-3620 with `เธอ` and `ลุง/ครู` to match their established uncle-nephew rapport.

### [MODIFY] [04-mountain.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/04-mountain.md) (Chapters 11-16)
- **Diary typo fix (Line 4356)**:
  - Corrected the typo `"ผมรู้ว่าคุณปลอดแล้ว"` (I know you are safe?) to `"ผมรู้ว่าคุณเป็นอิสระแล้ว"` (I know you are free now) in Haruto's reflective journal.

---

## Slice 9: Initial Chapters 1-3 Dialogue & English Leak Polish (Completed)

### [MODIFY] [01-discovery.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/01-discovery.md) (Chapters 1-3)
1. **English Name Leakage in Spoken Lines**:
   - Converted 25+ occurrences of English-scripted names (`Hina`, `Akira`, `Kaori`, `Watanabe`, `Nagano`, `Tokyo`, `Hakuba`, `Anri`, `Suzuki`) inside dialogue double quotes to proper Thai spellings (e.g. `ฮินะ`, `อากิระ`, `คาโอริ`, `วาตานาเบะ`, `นางานะ`, `โตเกียว`, `ฮาคุบะ`, `อันริ`, `ซูซูกิ`).
   - Removed English annotations in parentheses from Kaori's speech (`(Showa pop)`, `(Anri)`, `(Aoyama Gakuin)`) to keep spoken lines natural.
2. **Hina's Register Corrections**:
   - Replaced Hina's self-reference pronouns with Thai names (`ฮินะ`, `หนู`) inside dialogues to maintain consistency with the character bible.
   - Changed Hina's elder-brother particle tag from `นะจ๊ะ` to a natural sisterly tag `นะคะ` in line 1577.
3. **Friend Peer Voice**:
   - Verified that all schoolfriend dialogues (Haruto and Akira) use casual register (`ฉัน/แก/นาย`, plain endings, no `ครับ/ผม`).

---

## Verification Results

We verified the codebase state with:
- All automated check scripts: `Get-ChildItem scratch/check_*.js | ForEach-Object { node $_.FullName }` (ALL PASSED, 0 issues found)
- Astro check: `pnpm check` (PASSED, 0 errors, 0 warnings)
- Astro production build: `pnpm build` (PASSED, 35 pages built successfully)
