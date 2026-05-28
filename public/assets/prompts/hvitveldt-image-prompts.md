# Hvitveldt Image Prompt Bank

ไฟล์นี้เป็น prompt bank สำหรับภาพประกอบนิยายแบบ pencil hand drawing ไม่ลงสี เน้นลายเส้นเหมือนคนวาดจริง ใช้ร่วมกับโฟลเดอร์ `public/assets/images/`.

## วิธีใช้

- คัดลอกเฉพาะ prompt ในกรอบ `text` ไปใช้กับเครื่องมือสร้างภาพ
- บรรทัด `ใช้ ref:` เป็นโน้ตสำหรับคน ไม่ต้องใส่ลงไปใน prompt
- ถ้าภาพมีตัวละครที่มี ref แล้ว ให้แนบ ref ภาพจาก `public/assets/images/characters/`
- ถ้าตัวละครยังไม่มี ref ให้ใช้มุมหลัง เงา มือ หรือใบหน้าด้านข้างเล็ก ๆ เพื่อลดปัญหาหน้าไม่คงที่
- ถ้าฉากเป็นเอกสาร ป้าย หรือแฟ้ม ให้ใช้รอยเขียนที่อ่านไม่ออกแทนข้อความจริง เพื่อไม่ให้ AI สร้างตัวอักษรเพี้ยน
- ภาพ imposter ควรใช้ไม่เยอะ แนะนำแค่ `10A` และ `18B` เพื่อให้ยังลึกลับและไม่ทำให้เรื่องดูเป็น monster story เกินไป

## Prompt Style หลัก

Prompt Style หลักถูกใส่ไว้ในทุก prompt แล้ว เพื่อให้ก็อบแยกทีละอันได้ทันที:

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.
```

## Ref ที่มีแล้ว

- Home background: `public/assets/images/backgrounds/Homebackground.png`
- Elena Vasquez: `public/assets/images/characters/Elena Vasquez.png`
- Diana Webb: `public/assets/images/characters/Diana Webb.png`
- Vincent Leroux: `public/assets/images/characters/Vincent Leroux.png`
- Marcus Hale: `public/assets/images/characters/Marcus Hale.png`
- Sarah Kovac: `public/assets/images/characters/Sarah Kovac.png`
- Jake Whitmore: `public/assets/images/characters/Jake Whitmore.png`
- Ben Ross: `public/assets/images/characters/Ben Ross.png`
- Tom Janssen: `public/assets/images/characters/Tom Janssen.png`
- Lillian Hale: `public/assets/images/characters/Lillian Hale.png`
- Sophie Hale: `public/assets/images/characters/Sophie Hale.png`
- Detective Karlsen: `public/assets/images/characters/Detective Karlsen.png`
- Subject 8: `public/assets/images/characters/Subject 8 v1.png`, `public/assets/images/characters/Subject 8 v2.png`

## Prompt ต้นทางของ ref ตัวละคร

ส่วนนี้เก็บ prompt ต้นทางของ character refs ที่สร้างไว้แล้ว เพื่อใช้ตรวจความคงที่หรือสร้างเวอร์ชันใหม่เมื่อจำเป็น

### Sarah Kovac

ไฟล์แนะนำ: `public/assets/images/characters/Sarah Kovac.png`

อัตราส่วน: `3:4`

ใช้ ref: ไม่มี

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Character reference sheet for Sarah Kovac, 41, Canadian-Croatian therapist, calm tired face, soft but guarded eyes, shoulder-length practical hair, dark winter cardigan under a heavy coat, careful empathetic posture, hands often held close to her chest, believable adult face with quiet grief and self-control, no glamorous styling.

Composition: 3:4 character sheet, front view, three-quarter view, side profile, neutral expression, frightened expression, simple blank background, small cardigan and notebook details, consistent facial structure.
```

### Jake Whitmore

ไฟล์แนะนำ: `public/assets/images/characters/Jake Whitmore.png`

อัตราส่วน: `3:4`

ใช้ ref: ไม่มี

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Character reference sheet for Jake Whitmore, 27, British photographer, messy hair, restless grin that disappears when afraid, lean build, camera strap around his neck, winter coat worn open too casually, whisky glass as a recurring prop, nervous humor in his eyes, readable as charming but unreliable.

Composition: 3:4 character sheet, front view, three-quarter view, side profile, smirking expression, scared expression, blank background, consistent face, camera strap and coat silhouette repeated.
```

### Ben Ross

ไฟล์แนะนำ: `public/assets/images/characters/Ben Ross.png`

อัตราส่วน: `3:4`

ใช้ ref: ไม่มี

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Character reference sheet for Ben Ross, 24, American travel influencer, youthful nervous face, hoodie under winter jacket, phone camera rig or small action camera as a prop, slightly hunched posture when frightened, eyes too alert from lack of sleep, modern but not flashy.

Composition: 3:4 character sheet, front view, three-quarter view, side profile, anxious expression, blank stare expression, blank background, consistent face and hoodie shape.
```

### Tom Janssen

ไฟล์แนะนำ: `public/assets/images/characters/Tom Janssen.png`

อัตราส่วน: `3:4`

ใช้ ref: ไม่มี

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Character reference sheet for Tom Janssen, 53, American widower, tired gentle face, short thinning hair, old cardigan over winter layers, heavy grief in his posture, warm but distant eyes, hands that look slightly stiff from cold, believable older man with ordinary clothes.

Composition: 3:4 character sheet, front view, three-quarter view, side profile, sad expression, confused expression, blank background, cardigan shape and weary posture consistent.
```

### Lillian Hale

ไฟล์แนะนำ: `public/assets/images/characters/Lillian Hale.png`

อัตราส่วน: `3:4`

ใช้ ref: ไม่มี

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Character reference sheet for Lillian Hale, adult researcher connected to an old Norwegian lodge case, intelligent exhausted face, practical field sweater, loose hair partly pinned back, old notebook and pencil as props, expression of someone who has discovered something too late, grounded realistic features.

Composition: 3:4 character sheet, front view, three-quarter view, side profile, focused expression, fearful expression, blank background, no readable notes, consistent face.
```

### Sophie Hale

ไฟล์แนะนำ: `public/assets/images/characters/Sophie Hale.png`

อัตราส่วน: `3:4`

ใช้ ref: ไม่มี

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Character reference sheet for Sophie Hale, young adult woman remembered through old photos and belongings, gentle face, winter sweater, slightly guarded smile, hair partly tucked behind one ear, presence should feel like a memory rather than an active scene, realistic and understated.

Composition: 3:4 character sheet, front view, three-quarter view, side profile, faint smile, serious expression, blank background, old-photo feeling without adding color or readable captions.
```

### Detective Karlsen

ไฟล์แนะนำ: `public/assets/images/characters/Detective Karlsen.png`

อัตราส่วน: `3:4`

ใช้ ref: ไม่มี

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Character reference sheet for Detective Karlsen, Norwegian investigator in his 50s, lined practical face, plain dark coat, tired official composure, folder of case files as a prop, eyes that suggest he knows more than he can say, restrained realistic detective design.

Composition: 3:4 character sheet, front view, three-quarter view, side profile, neutral expression, grave expression, blank background, no readable case text.
```

### Subject 8 / Imposter Cue

ไฟล์ที่ใช้จริงตอนนี้: `public/assets/images/characters/Subject 8 v1.png`, `public/assets/images/characters/Subject 8 v2.png`

อัตราส่วน: `3:4`

ใช้ ref: ไม่มี หรือใช้ ref ของตัวละครที่ถูกแทนที่ในฉากนั้นเท่านั้น

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Visual reference cue for an identity-stealing impostor in a psychological winter lodge mystery, not a monster design, a human silhouette that feels almost correct but subtly wrong, face partly hidden by mirror shadow, hands slightly too still, reflection not matching the body exactly, calm dread instead of gore, ordinary human outline with one unsettling mismatch.

Composition: 3:4 mood reference, mostly silhouette and reflection, no fixed face, no creature anatomy, no teeth, no claws, no gore, blank background with a mirror edge and soft graphite smudges.
```

## ภาพประกอบราย Chapter

### Chapter 01 - Arrival

#### 01A - ถนนหิมะก่อนถึงบ้านพัก

ไฟล์ที่ใช้จริงตอนนี้: `public/assets/images/chapters/01A.png`

อัตราส่วน: `21:9` หรือ `16:9`

ตำแหน่งใช้: หลังย่อหน้า GPS หยุดทำงานและแผนที่กระดาษ ก่อน Elena แนะนำตัวเอง

ใช้ ref: Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Elena Vasquez, 32, Spanish-American journalist with shoulder-length dark wavy hair and tired observant eyes, driving alone through a remote snowy Norwegian forest at 2 a.m., seen from the passenger side inside an old car, one hand near a paper map, dead GPS glow implied but not readable, windshield filled with falling snow and black pine trees, quiet dread before arrival.

Composition: 21:9 cinematic interior and road view, Elena in the lower left third, road vanishing into snow at center, no readable dashboard text, no city lights, no bright action.
```

#### 01B - ประตูบ้านพักและ Marcus

ไฟล์ที่ใช้จริงตอนนี้: `public/assets/images/chapters/01B.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: หลัง Marcus เปิดประตูต้อนรับ Elena ก่อนเข้าภายใน lodge ภาพนี้เป็นจังหวะ doorway ไม่ใช่ภาพยืนยันขนาดทั้งอาคาร

ใช้ ref: Elena Vasquez, Marcus Hale

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Marcus Hale, 39, American host with a lean pale face, neat hair, precise smile, and composed posture, standing in the open doorway of an old isolated lodge while Elena Vasquez approaches through snow with luggage, her dark wavy hair visible under winter layers, warm doorway light barely holding back the dark forest, first polite welcome with hidden unease.

Composition: 16:9, lodge doorway right of center, Elena seen from behind or three-quarter back, Marcus small but recognizable, snow-heavy foreground, no readable sign.
```

### Chapter 02 - First Night

#### 02A - มื้อค่ำกับบัตรชื่อ

ไฟล์แนะนำ: `public/assets/images/chapters/02a-dining-name-cards.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: ภาพคั่นกว้างหลังเปิดตอน

ใช้ ref: Elena Vasquez, Diana Webb, Vincent Leroux, Marcus Hale, Sarah Kovac, Jake Whitmore, Ben Ross, Tom Janssen

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

A dinner scene with eight people gathered around a long twelve-meter dark oak dining table inside an old Scandinavian winter lodge on the first night. Marcus Hale (39, lean pale host) sits at the head of the table in a Chesterfield leather chair with a precise, controlled smile, holding a glass of water, with NO soup bowl in front of him. Seated around the table are seven guests: Elena Vasquez (32, Spanish-American journalist, observant eyes, dark wavy shoulder-length hair) sitting on Marcus's right, sandwiched between Sarah Kovač (41, therapist with a calm tired face, wearing a dark cardigan) and Diana Webb (37, ex-army medic with tied-back hair and hard practical eyes). Vincent Leroux (29, slim French writer, unkempt dark hair, sharp cheekbones) sits directly opposite Elena. Tom Janssen (53, Minnesota widower with thinning short hair and a weary sad face) sits at the far end next to Vincent. Jake Whitmore (27, messy hair, holding a glass of whisky) and Ben Ross (24, travel influencer wearing a casual winter hoodie) are also seated. Six bowls of orange-colored beetroot soup are placed in front of the guests, along with wine glasses and blank name cards.

Composition: 16:9, table leading lines vanishing towards Marcus at the head, dim candle light from a brass chandelier above and firelight casting long, soft graphite shadows, faces distinct but integrated into the moody graphite sketch, no readable names on cards, high tension under polite conversation.
```

#### 02B - เสียงหลังประตูของ Marcus

ไฟล์แนะนำ: `public/assets/images/chapters/02b-marcus-door-snow.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: ภาพประกอบแคบข้างย่อหน้า suspense

ใช้ ref: Elena Vasquez, Marcus Hale

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Elena Vasquez standing tense in a dim lodge hallway outside Marcus Hale's closed room, her notebook held close, Marcus appearing suddenly at the far end with snow on one shoulder, lean pale face and controlled smile, the hallway too quiet, the sense that he has just been speaking in a language Elena should not understand.

Composition: 4:3 vertical hallway perspective, Elena foreground in partial profile, Marcus small in background, door edge dominant, no readable labels, no monster reveal.
```

### Chapter 03 - Morning Without Marcus

#### 03A - อาหารเช้าที่ไม่มีเจ้าบ้าน

ไฟล์แนะนำ: `public/assets/images/chapters/03a-empty-breakfast-lockdown.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: เปิดตอน

ใช้ ref: Diana Webb, Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Morning dining room after Marcus disappears, breakfast already prepared but untouched, one empty chair too neat, Diana Webb with tied-back hair and hard practical eyes checking the situation, Elena Vasquez watching from the side with journalist stillness, a lockdown panel near the wall glowing as an unreadable block, everyone else half-awake and frightened in the background.

Composition: 16:9, empty chair central, breakfast table foreground, Diana and Elena on opposite sides, no readable panel numbers or text.
```

#### 03B - ห้องทำงาน ตู้เซฟ และรูปเก่า

ไฟล์แนะนำ: `public/assets/images/chapters/03b-office-safe-photo.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: ภาพ object clue

ใช้ ref: Elena Vasquez, Marcus Hale เฉพาะในรูปถ่ายเก่า

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Old lodge office after a forced search, a black safe under a desk, scattered guest records with unreadable handwriting, an old photograph of Marcus Hale with a woman beside him, Marcus lean and pale in the photo but too composed, Elena Vasquez's hand reaching toward the evidence, axe marks implied on the damaged door frame outside the room.

Composition: 4:3 close object study, safe and photograph dominant, Elena only as hand and sleeve, no readable document text, quiet investigative mood.
```

### Chapter 04 - Searching

#### 04A - โต๊ะรวมหลักฐานหน้าเตาผิง

ไฟล์แนะนำ: `public/assets/images/chapters/04a-guest-records-fireplace.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: ภาพคั่น investigation

ใช้ ref: Elena Vasquez, Diana Webb, Vincent Leroux

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

The group gathers around a low table near the fireplace, Elena Vasquez with dark wavy hair sorting old guest records, Diana Webb standing with red cold hands after trying the doors, Vincent Leroux slim and watchful with a notebook, a broken router, blank pages, and wet coats spread across the table, everyone realizing the lodge is a trap.

Composition: 16:9, table evidence in foreground, fireplace low right, ref characters clear but not too close, other guests as smaller silhouettes, no readable file names.
```

#### 04B - สมุดของ Lillian

ไฟล์แนะนำ: `public/assets/images/chapters/04b-lillian-journal-warning.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: object insert ไม่บังการอ่าน

ใช้ ref: ไม่มี

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Close-up of an old field journal on a wooden lodge table, brittle pages filled with unreadable frantic handwriting marks, a pencil snapped beside it, faint coffee stains, snow light from a window, one page pressed down by a cold hand, the object should feel like a warning discovered too late.

Composition: 4:3 object-focused image, no readable words, no faces, strong graphite texture, blank margins safe for cropping.
```

### Chapter 05 - Second Night

#### 05A - แผนเฝ้ายามของ Diana

ไฟล์แนะนำ: `public/assets/images/chapters/05a-watch-plan-fireplace.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: ภาพคั่นกลางตอน

ใช้ ref: Diana Webb, Elena Vasquez, Vincent Leroux

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Diana Webb, athletic ex-army medic with tied-back hair and hard practical eyes, organizing night watches by the fireplace, a pistol and flashlight on the table, Elena Vasquez seated with a tense notebook, Vincent Leroux listening from shadow with sharp cheekbones and unkempt hair, Jake drinking at the edge as a loose silhouette, the group trying to look rational while fear grows.

Composition: 16:9, Diana standing as anchor, firelight suggested in graphite contrast, weapon visible but not heroic, no readable schedule notes.
```

#### 05B - ชาที่หวานผิดปกติ

ไฟล์แนะนำ: `public/assets/images/chapters/05b-too-sweet-tea.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: object insert ใกล้ย่อหน้าความสงสัย

ใช้ ref: Elena Vasquez, Diana Webb แบบเบลอหลังฉาก

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

A cup of tea on a dark wooden table with too many sugar grains spilled around the saucer, Elena Vasquez's fingers hovering near the cup, Diana Webb blurred in the background by the kitchen doorway, ordinary domestic details made suspicious, quiet paranoia rather than action.

Composition: 4:3 close-up, tea cup foreground, Elena only as hand and sleeve, Diana as soft silhouette, no readable labels, shallow tense composition.
```

### Chapter 06 - Ben Acts Off

#### 06A - กาแฟไหม้และ Ben ที่เงียบผิดปกติ

ไฟล์แนะนำ: `public/assets/images/chapters/06a-burnt-coffee-ben.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: เปิดตอน

ใช้ ref: Elena Vasquez, Diana Webb

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Lodge kitchen in the morning, burnt coffee pot smoking faintly, Ben Ross, 24, American travel influencer in a hoodie under a winter jacket, standing too still with a blank nervous face, Diana Webb watching him with practical suspicion, Elena Vasquez at the doorway silently observing, everyone sleep-deprived and cold.

Composition: 16:9, coffee pot foreground, Ben center but not close-up, Diana and Elena framing the scene, no readable appliance labels, restrained tension.
```

#### 06B - Tom เดินหายไป

ไฟล์แนะนำ: `public/assets/images/chapters/06b-tom-walks-away.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: ภาพคั่น suspense

ใช้ ref: ไม่มี หรือ Elena Vasquez ถ้าอยู่ไกลในฉาก

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Tom Janssen, 53, an older American widower in an old cardigan over winter layers, walking alone away from the common room down a long lodge corridor, his back turned, one hand brushing the wall, the others only suggested far behind as worried silhouettes, a clock shape on the wall but no readable time, the moment before absence becomes danger.

Composition: 16:9 long corridor, Tom small and off-center, deep shadows ahead, no close face, no gore, quiet missing-person dread.
```

### Chapter 07 - First Loss

#### 07A - การออกตามหา Tom

ไฟล์แนะนำ: `public/assets/images/chapters/07a-search-for-tom.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: ภาพคั่นก่อนพบความสูญเสีย

ใช้ ref: Diana Webb, Vincent Leroux

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Diana Webb in a field jacket and winter layers, tied-back hair and hard practical eyes, leading a search through a dark lodge threshold while Vincent Leroux follows with a flashlight, slim and tense with sharp cheekbones, snow blowing through an opened side door, footprints fading too fast, the search feeling controlled but doomed.

Composition: 16:9, doorway and snow glare on one side, Diana foreground, Vincent behind, no visible body, no readable signs, dread through cold and absence.
```

#### 07B - รูป Sophie กับ Marcus ในห้องของ Vincent

ไฟล์แนะนำ: `public/assets/images/chapters/07b-vincent-sophie-photo.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: object clue หลังเฉลยความเชื่อมโยง

ใช้ ref: Vincent Leroux, Marcus Hale เฉพาะภาพถ่ายเก่า

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Vincent Leroux's guest room with an old photograph on the desk, Vincent slim with slightly long unkempt hair standing half in shadow, the photo showing Marcus Hale beside a young woman remembered as Sophie, both faces small and old-photo soft, Elena's investigative presence implied by an open notebook near the edge, private grief exposed.

Composition: 4:3, photograph and notebook foreground, Vincent background in profile, no readable writing, no bright lighting, intimate evidence scene.
```

### Chapter 08 - The Library

#### 08A - กล่องหลักฐานในห้องสมุด

ไฟล์แนะนำ: `public/assets/images/chapters/08a-library-box-reveal.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: เปิดตอนหรือกลางตอน

ใช้ ref: Elena Vasquez, Vincent Leroux, Diana Webb ถ้าอยู่ในฉาก

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Old lodge library with shelves of dark books, an evidence box opened on a table, Elena Vasquez leaning in with tired observant eyes and dark wavy hair, Vincent Leroux standing tense beside her, Diana Webb near the door as watchful guard, loose photos and old journals spread out with unreadable marks, a sense that the room knows more than the people.

Composition: 16:9, evidence box center, bookshelves as dark vertical texture, characters around the table, no readable book titles or notes.
```

#### 08B - Sarah กับ Elena เฝ้ากลางคืน

ไฟล์แนะนำ: `public/assets/images/chapters/08b-sarah-elena-night-watch.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: ภาพสงบแต่กดดัน

ใช้ ref: Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Elena Vasquez, shoulder-length dark wavy hair and tired observant eyes, sitting awake near a low fire with Sarah Kovac, a Canadian-Croatian therapist in her 40s with a calm tired face and dark cardigan, both women speaking quietly while Tom sleeps blurred in the background, warmth surrounded by fear.

Composition: 4:3 intimate two-person scene, Elena and Sarah in profile, sleeping figure soft and distant, no readable notes, low fire contrast without color.
```

### Chapter 09 - The Long Night

#### 09A - Vincent เดินตรวจยาม

ไฟล์แนะนำ: `public/assets/images/chapters/09a-long-night-patrol.png`

อัตราส่วน: `21:9`

ตำแหน่งใช้: ภาพคั่นกว้าง

ใช้ ref: Vincent Leroux

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Vincent Leroux, 29, French writer with a slim build, slightly long unkempt hair, sharp cheekbones, and a dark sweater under his winter coat, walking a night patrol through a long lodge corridor with a flashlight, the common room visible far behind with sleeping shapes, every closed door feeling suspicious.

Composition: 21:9 wide hallway, Vincent in left third, flashlight beam leading right, deep negative space in the corridor, no readable clock or labels, slow dread.
```

#### 09B - Tom ที่ตอบถูกแต่ผิด

ไฟล์แนะนำ: `public/assets/images/chapters/09b-wrong-tom-answer.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: ภาพประกอบความไม่ไว้วางใจ

ใช้ ref: Elena Vasquez ถ้าเห็นผู้สังเกตด้านข้าง

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Tom Janssen, older widower in a worn cardigan, sitting upright on a sofa in dim firelight, his expression almost kind but slightly empty, Elena Vasquez watching from the edge with narrowed tired eyes, the moment when an answer sounds correct but the person feels wrong, psychological uncertainty without showing a monster.

Composition: 4:3, Tom centered but face partly shadowed, Elena as side observer, sofa and fire low in frame, no gore, no dramatic attack.
```

### Chapter 10 - Escape Attempt

#### 10A - Fake Tom หลังเสียงปืน

ไฟล์แนะนำ: `public/assets/images/chapters/10a-gunshot-fake-tom.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: ภาพ imposter หลัก ใช้ไม่ต้องเยอะ

ใช้ ref: Diana Webb, Vincent Leroux

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Diana Webb, athletic ex-army medic with tied-back hair and hard practical eyes, holding a gun low after a shot, Vincent Leroux frozen behind her, and Fake Tom standing in a lodge doorway with the shape of Tom Janssen, an older widower in a cardigan, but his face half-hidden and subtly wrong, one real body only partly obscured on the floor under blankets, no gore, pure identity horror.

Composition: 16:9, Fake Tom in doorway shadow, Diana foreground, Vincent background, real body implied not explicit, no blood focus, no monster anatomy, restrained shock.
```

#### 10B - ประตูหนีออกไปใน whiteout

ไฟล์แนะนำ: `public/assets/images/chapters/10b-failed-escape-whiteout.png`

อัตราส่วน: `21:9`

ตำแหน่งใช้: ภาพคั่น action แบบไม่รบกวนอ่าน

ใช้ ref: Elena Vasquez, Diana Webb, Vincent Leroux

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

The lodge door forced open into a violent whiteout, Elena Vasquez shielding her face, Diana Webb bracing against the wind with military steadiness, Vincent Leroux clutching a flashlight, rope and coats whipping in the storm, the escape attempt swallowed by snow before it becomes freedom.

Composition: 21:9, doorway as black frame, snowstorm filling the center, characters small and struggling at the threshold, no readable signs, high contrast graphite storm.
```

### Chapter 11 - The Long Day

#### 11A - Diana รักษาเท้าของ Sarah

ไฟล์แนะนำ: `public/assets/images/chapters/11a-diana-treats-sarah.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: ภาพมนุษย์และความเจ็บปวดแบบเงียบ

ใช้ ref: Diana Webb

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Diana Webb, 37, Australian ex-army medic with tied-back hair and hard practical eyes, kneeling beside Sarah Kovac, a therapist in her 40s wrapped in blankets, treating frostbitten feet with a compact medic kit and warm cloths, Sarah trying not to scream, care and pain inside the trapped lodge.

Composition: 4:3 intimate medical scene, Diana's hands and kit foreground, Sarah's face partly turned away, no gore, no readable medical labels, quiet human stakes.
```

#### 11B - Sarah รอหน้าห้องน้ำ

ไฟล์แนะนำ: `public/assets/images/chapters/11b-bathroom-sarah-door.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: ภาพประกอบ paranoia

ใช้ ref: Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Elena Vasquez in a narrow lodge bathroom doorway, shoulder-length dark wavy hair damp from exhaustion, staring at Sarah Kovac waiting silently outside the door in a dark cardigan, Sarah's face calm but unreadable, mirror edge catching both women imperfectly, the ordinary room becoming threatening through stillness.

Composition: 4:3, bathroom door frame tight, Elena foreground, Sarah just beyond the threshold, partial mirror reflection, no visible text, no monster reveal.
```

### Chapter 12 - Ben Returns

#### 12A - เสียงเคาะจากประตูหน้า

ไฟล์แนะนำ: `public/assets/images/chapters/12a-ben-at-main-door.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: เปิดตอนหรือจังหวะเคาะประตู

ใช้ ref: Diana Webb, Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Diana Webb with tied-back hair and hard practical eyes aiming a gun toward the locked main door, Elena Vasquez standing behind her with notebook clutched tight, Ben Ross visible only as a vague hoodie-shaped figure through frosted glass after being gone for hours, snow pressing against the door from outside.

Composition: 16:9, door and frosted glass central, Diana foreground left, Elena behind, Ben distorted by glass, no readable door markings, tense silence.
```

#### 12B - สัญญาณกะพริบตาของ Diana

ไฟล์แนะนำ: `public/assets/images/chapters/12b-diana-blink-signal.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: ภาพใกล้ตัวละคร

ใช้ ref: Diana Webb, Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Close tense moment between Diana Webb and Elena Vasquez near the fireplace, Diana's hard practical eyes giving a small silent blink signal, Elena understanding without speaking, other survivors blurred behind them, Ben's returned presence implied off-frame, trust communicated through one controlled gesture.

Composition: 4:3, Diana's face and eyes sharp, Elena in partial profile, background soft and crowded, no readable notes, no exaggerated expression.
```

### Chapter 13 - Into the Basement

#### 13A - เตรียมลงชั้นใต้ดิน

ไฟล์แนะนำ: `public/assets/images/chapters/13a-basement-gear.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: เปิดตอน

ใช้ ref: Diana Webb, Elena Vasquez, Vincent Leroux

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Diana Webb in an old army jacket over winter layers, athletic and focused, checking a flashlight and weapon before the basement descent, Elena Vasquez beside her with notebook and fearful concentration, Vincent Leroux slim and guilty-looking behind them, Sarah in Tom's cardigan as a soft silhouette, the open basement hatch below them like a dark mouth.

Composition: 16:9, hatch lower center, Diana as leader, Elena and Vincent flanking, no readable jacket patch, no monster, heavy shadows down the stairs.
```

#### 13B - พบ Marcus ตัวจริง

ไฟล์แนะนำ: `public/assets/images/chapters/13b-found-marcus-cell.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: ภาพสำคัญท้ายตอน

ใช้ ref: Marcus Hale, Diana Webb, Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

The real Marcus Hale found captive in a basement room, lean pale face broken by exhaustion instead of a precise smile, neat hair now disordered, Diana Webb crouching in front of him to verify his identity, Elena Vasquez holding a flashlight from the doorway, damp stone walls and old restraints implied without gore, the host suddenly becoming a victim.

Composition: 16:9, Marcus low in center, Diana crouched foreground, Elena doorway silhouette, flashlight beam across stone, no blood focus, no readable marks.
```

### Chapter 14 - Marcus

#### 14A - คำสารภาพของ Marcus

ไฟล์แนะนำ: `public/assets/images/chapters/14a-marcus-confession.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: กลางตอนช่วงอธิบายความจริง

ใช้ ref: Marcus Hale, Diana Webb, Elena Vasquez, Vincent Leroux

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Marcus Hale, exhausted and broken, explaining the old research and the thing beneath the lodge while seated on the basement floor, Diana Webb listening with controlled suspicion, Elena Vasquez recording details with tired observant eyes, Vincent Leroux standing apart in guilt, Sarah's outline near the stairs, damp stone and old papers around them.

Composition: 16:9, Marcus seated center, group in semicircle, flashlight and candle contrast, no readable documents, serious confession mood.
```

#### 14B - หลักฐาน Subject 8

ไฟล์แนะนำ: `public/assets/images/chapters/14b-subject-eight-board.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: object clue

ใช้ ref: Elena Vasquez เฉพาะมือหรือเงา

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Close-up of a basement evidence board and scattered research pages about an eighth subject, unreadable names scratched out, a ring shape sketched in the margin, Elena Vasquez's hand hovering above the papers, old photos pinned at odd angles with faces partly hidden, the clue feels important but not fully solved yet.

Composition: 4:3 object-focused, hands and papers only, no readable text or clear names, ring shape subtle, graphite smudges and pinholes.
```

### Chapter 15 - What Vincent Knows

#### 15A - ถ้ำใต้บ้านพักและหลุมลึก

ไฟล์แนะนำ: `public/assets/images/chapters/15a-ancient-cave-pit.png`

อัตราส่วน: `21:9`

ตำแหน่งใช้: ภาพกว้างก่อน climax

ใช้ ref: Diana Webb, Vincent Leroux, Marcus Hale, Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Ancient cave beneath the lodge, a bottomless black pit cutting through the stone floor, Diana Webb leading with a flashlight, Vincent Leroux tense and ashamed, Marcus Hale pale and exhausted near the edge, Elena Vasquez watching from behind with journalistic focus turning to terror, the space feels older than the house.

Composition: 21:9 wide cavern, pit as black center mass, characters small along the rim, flashlight beams as pale graphite streaks, no creature visible, no readable symbols.
```

#### 15B - Marcus กระโดดลงหลุม

ไฟล์แนะนำ: `public/assets/images/chapters/15b-marcus-jumps-voices.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: climax image

ใช้ ref: Marcus Hale

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Marcus Hale's thin silhouette falling into a bottomless cave pit, his composed host identity completely gone, the survivors only as small shocked shapes on the rim, faint human face-like smudges and graphite streaks rising from the darkness to suggest voices without showing monsters, sacrifice and horror in one still moment.

Composition: 16:9, pit dominating lower center, Marcus falling small but readable, survivors on upper rim, no gore, no creature, no readable marks.
```

### Chapter 16 - The Way Up

#### 16A - ทางออกผ่านห้องซาวน่า

ไฟล์แนะนำ: `public/assets/images/chapters/16a-climb-back-sauna-bench.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: หลัง climax เพื่อให้คนอ่านได้หายใจ

ใช้ ref: Diana Webb, Vincent Leroux, Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Survivors climbing up through a broken sauna bench passage, Diana Webb pushing the door open with exhausted strength, Vincent Leroux helping from behind, Elena Vasquez covered in dust and fear but still alert, wooden slats splintered, cold air entering like rescue, relief mixed with disbelief.

Composition: 16:9, low angle from inside the passage, Diana leading upward, Elena and Vincent behind, no blood focus, no bright heroic pose.
```

#### 16B - วิทยุฉุกเฉิน

ไฟล์แนะนำ: `public/assets/images/chapters/16b-radio-call-fireplace.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: object/action insert

ใช้ ref: Diana Webb, Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Emergency radio on a lodge table near the dying fireplace, Diana Webb leaning over it with controlled urgency, Elena Vasquez sitting nearby holding Lillian's notebook and Sophie's sweater, both women exhausted, the room still dangerous but finally connected to the outside world.

Composition: 4:3, radio foreground, Diana's hands clear, Elena in background, no readable radio labels, no clean modern tech look, quiet aftermath.
```

### Chapter 17 - Karasjok

#### 17A - เฮลิคอปเตอร์เหนือ Karasjok

ไฟล์แนะนำ: `public/assets/images/chapters/17a-helicopter-karasjok.png`

อัตราส่วน: `21:9`

ตำแหน่งใช้: เปิดตอนหรือภาพเปลี่ยนสถานที่

ใช้ ref: Elena Vasquez, Diana Webb, Vincent Leroux

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Rescue helicopter above the small lights of Karasjok at night, snow and dark hills below, Elena Vasquez seen inside the helicopter window with tears and exhaustion, Diana Webb and Vincent Leroux as quiet survivors beside her, the first view of civilization feeling fragile instead of triumphant.

Composition: 21:9, helicopter interior edge framing the village lights below, faces small and tired, no readable markings on the aircraft, quiet rescue mood.
```

#### 17B - ห้องโรงแรมของผู้รอดชีวิต

ไฟล์แนะนำ: `public/assets/images/chapters/17b-hotel-survivors-toast.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: ภาพพักหลังเหตุการณ์

ใช้ ref: Elena Vasquez, Diana Webb, Vincent Leroux

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Small hotel room after the rescue, Elena Vasquez, Diana Webb, and Vincent Leroux sitting together in exhausted silence, simple glasses raised in a quiet toast to Marcus, winter coats over chair backs, emergency blankets folded nearby, the survivors alive but not healed.

Composition: 16:9, three ref characters around a small table, hotel room plain and unglamorous, glasses small, no readable labels, melancholy calm.
```

### Chapter 18 - Mirror

#### 18A - แฟ้มของ Karlsen และรูปเก่า

ไฟล์แนะนำ: `public/assets/images/chapters/18a-karlsen-file-subject-eight.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: object clue ตอนเฉลย

ใช้ ref: Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Detective Karlsen's case folder opened on a Brooklyn apartment table, old photographs and unreadable reports spread out, one old photo showing Elena Vasquez's face from years earlier, Elena standing over the file with shoulder-length dark wavy hair and a frozen expression, the impossible evidence presented calmly.

Composition: 4:3, folder and photo foreground, Elena's upper body in shadow behind it, no readable report text, no dramatic police-office look, quiet impossible realization.
```

#### 18B - กระจก: Elena ที่ไม่ใช่ Elena

ไฟล์แนะนำ: `public/assets/images/chapters/18b-not-elena-mirror.png`

อัตราส่วน: `4:5` หรือ `16:9`

ตำแหน่งใช้: ภาพปิดท้าย หรือหลังบรรทัดสุดท้าย

ใช้ ref: Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Elena Vasquez in a Brooklyn bathroom mirror, shoulder-length dark wavy hair and tired observant eyes, but the reflection is subtly not synchronized with her body, one hand near a ring on the sink, an open notebook with unreadable changed handwriting nearby, the ending implies Elena's identity has been overwritten rather than showing a corpse, calm horrifying realization that the person in the mirror is no longer Elena.

Composition: 4:5 intimate mirror portrait or 16:9 final illustration, real Elena partly from behind, reflection facing viewer with a slight wrongness, no gore, no dead body, no monster anatomy, no readable notebook text.
```

## สรุปจังหวะ imposter

- ใช้ `10A - Fake Tom หลังเสียงปืน` เป็นภาพ imposter แบบชัดที่สุดในเนื้อเรื่องหลัก
- ใช้ `18B - กระจก: Elena ที่ไม่ใช่ Elena` เป็นภาพบอกใบ้ตอนจบว่า Elena ถูกกลืน/แทนที่ ไม่ใช่ตายแบบมีศพ
- ไม่ควรมีภาพ imposter เยอะกว่านี้ในรอบแรก เพราะจะลดความคลุมเครือของเรื่องและทำให้คนอ่านจับทางเร็วเกินไป
