# Hvitveldt Image Prompt Bank

ไฟล์นี้เป็น prompt bank สำหรับภาพประกอบนิยายแบบ pencil hand drawing ไม่ลงสี เน้นลายเส้นเหมือนคนวาดจริง ใช้ร่วมกับโฟลเดอร์ `public/assets/lodge/images/`.

## วิธีใช้

- คัดลอกเฉพาะ prompt ในกรอบ `text` ไปใช้กับเครื่องมือสร้างภาพ
- บรรทัด `ใช้ ref:` เป็นโน้ตสำหรับคน ไม่ต้องใส่ลงไปใน prompt
- ถ้าภาพมีตัวละครที่มี ref แล้ว ให้แนบ ref ภาพจาก `public/assets/lodge/images/characters/`
- ถ้าตัวละครยังไม่มี ref ให้ใช้มุมหลัง เงา มือ หรือใบหน้าด้านข้างเล็ก ๆ เพื่อลดปัญหาหน้าไม่คงที่
- ถ้าฉากเป็นเอกสาร ป้าย หรือแฟ้ม ให้ใช้รอยเขียนที่อ่านไม่ออกแทนข้อความจริง เพื่อไม่ให้ AI สร้างตัวอักษรเพี้ยน
- ภาพ imposter ควรใช้ไม่เยอะ แนะนำแค่ `10A` และ `18B` เพื่อให้ยังลึกลับและไม่ทำให้เรื่องดูเป็น monster story เกินไป
- หลายฉากใช้ POV ของ Elena (มือ ไหล่ ผ่านสายตา) แทนการแสดง Elena ทั้งร่าง เพื่อรักษาความรู้สึก first-person ของนิยาย

## Prompt Style หลัก

Prompt Style หลักถูกใส่ไว้ในทุก prompt แล้ว เพื่อให้ก็อบแยกทีละอันได้ทันที:

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.
```

## Ref ที่มีแล้ว

- Home background: `public/assets/lodge/images/backgrounds/Homebackground.png`
- Elena Vasquez: `public/assets/lodge/images/characters/Elena Vasquez.png`
- Diana Webb: `public/assets/lodge/images/characters/Diana Webb.png`
- Vincent Leroux: `public/assets/lodge/images/characters/Vincent Leroux.png`
- Marcus Hale: `public/assets/lodge/images/characters/Marcus Hale.png`
- Sarah Kovac: `public/assets/lodge/images/characters/Sarah Kovac.png`
- Jake Whitmore: `public/assets/lodge/images/characters/Jake Whitmore.png`
- Ben Ross: `public/assets/lodge/images/characters/Ben Ross.png`
- Tom Janssen: `public/assets/lodge/images/characters/Tom Janssen.png`
- Lillian Hale: `public/assets/lodge/images/characters/Lillian Hale.png`
- Sophie Hale: `public/assets/lodge/images/characters/Sophie Hale.png`
- Detective Karlsen: `public/assets/lodge/images/characters/Detective Karlsen.png`
- Subject 8: `public/assets/lodge/images/characters/Subject 8 v1.png`, `public/assets/lodge/images/characters/Subject 8 v2.png`

## Prompt ต้นทางของ ref ตัวละคร

ส่วนนี้เก็บ prompt ต้นทางของ character refs ที่สร้างไว้แล้ว เพื่อใช้ตรวจความคงที่หรือสร้างเวอร์ชันใหม่เมื่อจำเป็น

### Sarah Kovac

ไฟล์แนะนำ: `public/assets/lodge/images/characters/Sarah Kovac.png`

อัตราส่วน: `3:4`

ใช้ ref: ไม่มี

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Character reference sheet for Sarah Kovac, 41, Canadian-Croatian therapist, tall slim build, dark brown shoulder-length hair, thin metal-frame glasses, calm tired face with soft but guarded eyes, dark turtleneck sweater under a heavy winter cardigan, careful empathetic posture, hands often held close to her chest, believable adult face with quiet grief and self-control, no glamorous styling.

Composition: 3:4 character sheet, front view, three-quarter view, side profile, neutral expression, frightened expression, simple blank background, sweater and notebook details, consistent facial structure.
```

### Jake Whitmore

ไฟล์แนะนำ: `public/assets/lodge/images/characters/Jake Whitmore.png`

อัตราส่วน: `3:4`

ใช้ ref: ไม่มี

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Character reference sheet for Jake Whitmore, 27, British war photographer, tall lean build, messy red hair, restless wide grin that exposes slightly uneven teeth and disappears when afraid, gray flannel shirt over jeans, winter jacket worn open too casually, whisky glass as a recurring prop, nervous humor in his eyes, readable as charming but unreliable.

Composition: 3:4 character sheet, front view, three-quarter view, side profile, smirking expression, scared expression, blank background, consistent face, flannel and coat silhouette repeated.
```

### Ben Ross

ไฟล์แนะนำ: `public/assets/lodge/images/characters/Ben Ross.png`

อัตราส่วน: `3:4`

ใช้ ref: ไม่มี

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Character reference sheet for Ben Ross, 24, American travel content creator, youthful nervous face, dark hoodie with a thin gold chain visible at the collar under a winter jacket, small action camera or phone-camera rig as a prop, slightly hunched posture when frightened, eyes too alert from lack of sleep, modern but not flashy.

Composition: 3:4 character sheet, front view, three-quarter view, side profile, anxious expression, blank stare expression, blank background, consistent face and hoodie shape.
```

### Tom Janssen

ไฟล์แนะนำ: `public/assets/lodge/images/characters/Tom Janssen.png`

อัตราส่วน: `3:4`

ใช้ ref: ไม่มี

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Character reference sheet for Tom Janssen, 53, American widower from Minnesota, tired gentle face, short thinning gray hair, light brown work shirt under a dark navy cardigan, heavy grief in his slow careful posture, warm but distant eyes, calloused stiff hands of a lifelong manual worker, believable older man with ordinary clothes.

Composition: 3:4 character sheet, front view, three-quarter view, side profile, sad expression, confused expression, blank background, cardigan shape and weary posture consistent.
```

### Lillian Hale

ไฟล์แนะนำ: `public/assets/lodge/images/characters/Lillian Hale.png`

อัตราส่วน: `3:4`

ใช้ ref: ไม่มี

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Character reference sheet for Lillian Hale, 36, American linguist specializing in Old Norse and Sami, intelligent exhausted face, golden brown hair loosely tied back, practical field sweater, plain wedding band, old notebook and pencil as props, expression of someone who has discovered something too late, grounded realistic features, only ever seen in old photos or memory.

Composition: 3:4 character sheet, front view, three-quarter view, side profile, focused expression, fearful expression, blank background, no readable notes, consistent face.
```

### Sophie Hale

ไฟล์แนะนำ: `public/assets/lodge/images/characters/Sophie Hale.png`

อัตราส่วน: `3:4`

ใช้ ref: ไม่มี

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Character reference sheet for Sophie Walters, 34, British architect, only seen through old photographs and belongings, gentle face, light blue knitted winter sweater, slightly guarded smile, hair partly tucked behind one ear, presence should feel like a memory rather than an active scene, realistic and understated.

Composition: 3:4 character sheet, front view, three-quarter view, side profile, faint smile, serious expression, blank background, old-photo feeling without adding color or readable captions.
```

### Detective Karlsen

ไฟล์แนะนำ: `public/assets/lodge/images/characters/Detective Karlsen.png`

อัตราส่วน: `3:4`

ใช้ ref: ไม่มี

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Character reference sheet for Detective Karlsen, Norwegian investigator from Tromsø in his 50s, tall, lined practical face, plain dark navy winter coat, tired official composure, folder of case files as a recurring prop, eyes that suggest he knows more than he can say, restrained realistic detective design.

Composition: 3:4 character sheet, front view, three-quarter view, side profile, neutral expression, grave expression, blank background, no readable case text.
```

### Subject 8 / Imposter Cue

ไฟล์ที่ใช้จริงตอนนี้: `public/assets/lodge/images/characters/Subject 8 v1.png`, `public/assets/lodge/images/characters/Subject 8 v2.png`

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

ไฟล์ที่ใช้จริงตอนนี้: `public/assets/lodge/images/chapters/01A.png`

อัตราส่วน: `21:9` หรือ `16:9`

ตำแหน่งใช้: หลังย่อหน้า GPS หยุดทำงานและแผนที่กระดาษ ก่อน Elena แนะนำตัวเอง

ใช้ ref: Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Elena Vasquez, 32, Spanish-American journalist with shoulder-length dark wavy hair and tired observant eyes, driving alone through a remote snowy Norwegian forest at 2 a.m. on the 6th of February 2024, seen from the passenger side inside an old rented Volvo four-wheel drive, one hand near a folded paper map on the seat, dead GPS glow implied but not readable, windshield filled with falling snow and black pine trees, quiet dread before arrival.

Composition: 21:9 cinematic interior and road view, Elena in the lower left third, road vanishing into snow at center, no readable dashboard text, no city lights, no bright action.
```

#### 01B - ประตูบ้านพักและ Marcus

ไฟล์ที่ใช้จริงตอนนี้: `public/assets/lodge/images/chapters/01B.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: หลัง Marcus เปิดประตูต้อนรับ Elena ก่อนเข้าภายใน lodge ภาพนี้เป็นจังหวะ doorway ไม่ใช่ภาพยืนยันขนาดทั้งอาคาร

ใช้ ref: Elena Vasquez, Marcus Hale

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Marcus Hale, 39, American host with a lean pale face, short brown hair, precise controlled smile, dark gray fur coat over heavy trousers and leather boots, holding a coffee cup in his left hand, standing on the wide wooden porch of an old isolated Scandinavian lodge while Elena Vasquez approaches through deep snow with her luggage, her dark wavy hair visible under winter layers, a row of iron lanterns casting warm light onto the snow, dark pine forest pressing in at the edges of the frame, first polite welcome with hidden unease.

Composition: 16:9, lodge porch right of center, Elena seen from behind or three-quarter back lower left, Marcus small but recognizable under the lantern light, snow-heavy foreground, no readable sign or carved nameplate.
```

### Chapter 02 - First Night

#### 02A - มื้อค่ำกับบัตรชื่อ

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/02a-dining-name-cards.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: ภาพคั่นกว้างหลังเปิดตอน

ใช้ ref: Elena Vasquez, Diana Webb, Vincent Leroux, Marcus Hale, Sarah Kovac, Jake Whitmore, Ben Ross, Tom Janssen

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

A first-night dinner inside an old Scandinavian winter lodge, around a long twelve-meter dark oak dining table polished to reflect candlelight. Eight people in total: Marcus Hale (39, lean pale American host, short brown hair, precise composed smile) seated at the head of the table in a Chesterfield leather armchair, holding a glass of water with no soup bowl in front of him; seven guests seated along the sides. Elena Vasquez (32, Spanish-American journalist, dark wavy shoulder-length hair, observant eyes) sits on Marcus's right between Sarah Kovac (41, Canadian-Croatian therapist, dark turtleneck under a long cardigan, thin metal-frame glasses) and Diana Webb (37, Australian ex-army medic, dark hair tied back, hard practical eyes, leather boots still on indoors). Vincent Leroux (29, French writer, thick black classic-cut hair, sharp cheekbones, white shirt with the top button open) sits directly opposite Elena. Tom Janssen (53, Minnesota widower, thinning gray hair, navy cardigan over a brown work shirt, weary face) sits at the far end next to Vincent. Jake Whitmore (27, British photographer, messy red hair, gray flannel shirt, whisky glass in hand) and Ben Ross (24, American travel creator in a dark hoodie under his winter jacket) fill the remaining seats. Six bowls of orange-red beetroot soup with crème fraîche and dill garnish sit in front of the guests, alongside wine glasses and small blank handwritten name cards. A heavy brass chandelier and firelight from a stone hearth cast long soft graphite shadows on the wood.

Composition: 16:9, table leading lines vanishing towards Marcus at the head, dim candle light from the chandelier above and side firelight, faces distinct but integrated into the moody graphite sketch, no readable names on cards, high tension under polite conversation.
```

#### 02B - เสียงหลังประตูของ Marcus

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/02b-marcus-door-snow.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: ภาพประกอบแคบข้างย่อหน้า suspense

ใช้ ref: ไม่ใช้ Marcus (เขาอยู่หลังประตู), Elena Vasquez แค่มือหรือไหล่

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

First-person point-of-view standing in a dim lodge hallway lined with dark wooden doors, looking sideways at a heavy door marked only with a single silver letter on it. The narrator's hand and sleeve barely visible in the lower foreground, pressed quietly against the doorframe, her notebook tucked under one arm. From behind the closed door, the suggestion of a male voice speaking very low in an unfamiliar archaic language, conveyed only through the stillness of the air and the listener's held breath. Soft amber light from a brass sconce farther down the corridor, no readable signs, no creature, no human figure shown in full.

Composition: 4:3 vertical hallway perspective, single door dominating right of frame with the lone engraved letter as the eye anchor, hand and sleeve of the narrator in the lower foreground, deep shadowed corridor receding behind, no other characters visible, restrained eavesdropping dread.
```

### Chapter 03 - Morning Without Marcus

#### 03A - อาหารเช้าที่ไม่มีเจ้าบ้าน

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/03a-empty-breakfast-lockdown.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: เปิดตอน

ใช้ ref: Diana Webb (ในระยะปานกลาง), Elena Vasquez (มือถือถ้วยกาแฟ ไม่เห็นหน้าชัด)

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

An almost empty lodge dining room early on a winter morning, pale blue snow-light through tall windows. A breakfast spread of fresh bread, cut fruit, three small wheels of cheese, granola in a glass jar, a French press of still-warm coffee, and a porcelain milk jug laid out on the long oak table, untouched. One Chesterfield chair at the head sits too neatly empty, no host. Diana Webb visible at middle distance in dark long-sleeves and warm-up trousers with her hair tied back, calling toward the kitchen archway. The narrator's hand and forearm in the lower foreground holding a half-full coffee cup, the rest of her body out of frame. No glowing electronic panels, no readable labels.

Composition: 16:9, empty head chair as central focal point, breakfast spread foreground, Diana at middle ground left, narrator's hand framing the lower right corner, cold morning silence, no text on any object.
```

#### 03B - ห้องทำงาน ตู้เซฟ และรูปเก่า

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/03b-office-safe-photo.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: ภาพ object clue

ใช้ ref: Marcus Hale, Lillian Hale (เฉพาะในรูปถ่ายเก่าบนผนัง), Elena Vasquez (เฉพาะมือ)

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

A small lodge office after a forced entry. In the corner stands a tall black wardrobe-sized steel safe with a small digital keypad, its handle still locked. On the wood-panelled wall behind the heavy desk hangs a framed photograph: Marcus Hale standing beside Lillian Hale in front of a pine forest, both wearing wedding bands, both smiling genuinely. On the desk, scattered guest records in a brown lacquered box, an unreadable handwritten ledger, and a second locked laptop. The narrator's hand in the lower foreground reaches toward the photograph frame, sleeve only, no face. The splintered office doorframe, marked with raw axe gouges, is visible behind her shoulder.

Composition: 4:3 close object study, steel safe in the right third, framed photograph as the secondary focal point on the left, narrator's hand and sleeve only, no readable document text, quiet investigative mood.
```

### Chapter 04 - Searching

#### 04A - โต๊ะรวมหลักฐานหน้าเตาผิง

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/04a-guest-records-fireplace.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: ภาพคั่น investigation

ใช้ ref: Diana Webb, Vincent Leroux, Sarah Kovac, Tom Janssen, Ben Ross, Jake Whitmore (ไม่จำเป็นต้องเห็นหน้าทุกคน), Elena Vasquez (เฉพาะมือถือกล่องบนโต๊ะ)

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

A late morning gathering in the lodge living room around a low coffee table near the stone fireplace. On the table: a brown lacquered box of guest record files, a small pulled-apart wifi router with its casing open and antennae bent, two old notebooks brought down from the library, an open thermos, and a metal flask. The narrator's hand in the foreground lowers the records box onto the table; her face is not shown, only sleeve and graphite-shaded knuckles. Diana Webb stands behind the table in dark long-sleeves and warm-up trousers, hair tied back, hands red and chapped from forcing the lockdown panel. Vincent Leroux in a white open-collared shirt sits forward on the leather sofa, notebook on his knee. Sarah Kovac in a dark turtleneck and metal-frame glasses sits next to Tom Janssen in a navy cardigan, both leaning toward the box. Jake Whitmore lingers behind them with damp red hair, holding a whisky glass low. Ben Ross stands apart by the fireplace in his hoodie, hands deep in his pockets. Heavy firelight from the right.

Composition: 16:9, low coffee table as the foreground anchor, narrator's hand entering frame from lower edge, characters arranged in a loose half-circle, fireplace warm and dark on the right, no readable filenames or document text.
```

#### 04B - สมุดของ Lillian

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/04b-lillian-journal-warning.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: object insert ไม่บังการอ่าน

ใช้ ref: ไม่มี

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Close-up of an old leather field journal lying open on a worn lodge bookshelf table, brittle pages filled with dense unreadable handwriting in two languages side by side, a pencil snapped in half beside it, faint coffee ring stains on the paper edge, cold snow-light from a small window above, one page weighed down by a cold pale hand from outside the frame. The object should feel like a warning discovered too late by a stranger.

Composition: 4:3 object-focused image, no readable words, no faces, strong graphite texture, blank margins safe for cropping, single hand as the only human element.
```

### Chapter 05 - Second Night

#### 05A - แผนเฝ้ายามของ Diana

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/05a-watch-plan-fireplace.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: ภาพคั่นกลางตอน

ใช้ ref: Diana Webb, Vincent Leroux, Sarah Kovac (เป็น silhouette), Jake Whitmore (silhouette)

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Diana Webb, 37, Australian ex-army medic with dark hair tied back and hard practical eyes, standing as anchor by the lodge fireplace organizing night watch shifts. On a low side table near her: a Glock 17 pistol with a separated magazine, a heavy steel flashlight, a small handheld emergency radio, and an open spiral notebook with a watch rotation written in unreadable cursive. Vincent Leroux in a white shirt listens from the shadow of the armchair, slim with sharp cheekbones and slightly tousled black hair. Sarah Kovac sits quietly on the far sofa as a soft silhouette in a turtleneck. Jake Whitmore at the edge of the frame is a loose graphite outline holding a whisky glass low. Elena Vasquez is implied only by her open notebook in the foreground, no face shown. The group tries to look rational while fear grows.

Composition: 16:9, Diana standing as compositional anchor center-left, firelight suggested in graphite contrast on the right, weapon visible on table but not heroic, no readable schedule notes, narrator's notebook foreground.
```

#### 05B - กาแฟที่หวานผิดปกติ

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/05b-too-sweet-coffee.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: object insert ใกล้ย่อหน้าความสงสัย

ใช้ ref: Diana Webb แบบเบลอหลังฉาก

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

A heavy ceramic mug of strong dark coffee on a scarred wooden lodge table, far too many loose sugar grains spilled around the saucer as if the pour had been distracted. The narrator's fingers in the foreground hover near the rim of the mug without lifting it, sleeve only, no face. Diana Webb blurred and out of focus in the background near the kitchen archway, recognisable only by the silhouette of tied-back hair and broad shoulders. Ordinary domestic details made suspicious by the slow morning after a long night, quiet paranoia rather than action.

Composition: 4:3 close-up, coffee mug and spilled sugar grains foreground, narrator's hand and sleeve only, Diana as soft graphite silhouette in the deep background, no readable jar labels, shallow tense composition.
```

### Chapter 06 - Ben Acts Off

#### 06A - กาแฟไหม้และ Ben ที่เงียบผิดปกติ

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/06a-burnt-coffee-ben.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: เปิดตอน

ใช้ ref: Ben Ross, Diana Webb, Elena Vasquez (มือถือถ้วยจากมุม)

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Lodge living room mid-morning, a burnt French press of coffee giving off faint smoke from a side table near the fireplace. Ben Ross, 24, in his dark hoodie under a winter jacket, sits unnaturally still on the leather sofa, mug held loosely between his palms, gaze fixed on the floor, expression neutral and slow. Diana Webb sits opposite him in dark long-sleeves with her hair tied back, watching him with practical clinical suspicion. The narrator implied only by a sleeve and hand on the edge of the doorway frame, silently observing. Everyone sleep-deprived and cold.

Composition: 16:9, burnt coffee press as foreground prop on the side table, Ben centered but not in close-up, Diana framing the right edge, narrator's hand at left doorway, no readable appliance labels, restrained tension.
```

#### 06B - Tom เดินลงไปทาง sauna

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/06b-tom-walks-to-sauna.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: ภาพคั่น suspense

ใช้ ref: Tom Janssen

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Tom Janssen, 53, in a navy cardigan over a brown work shirt and warm trousers, walking alone toward the wooden staircase that leads down to the lodge sauna level, his back turned to the viewer, one stiff hand brushing the heavy wood banister. The corridor behind him implied with two faint worried silhouettes lingering far away at the archway of the living room. A plain wooden wall clock visible but with hands rendered as unreadable shapes. Cold afternoon shadows pool in the descending stairwell, the moment before absence becomes danger.

Composition: 16:9 long stairwell perspective, Tom small and off-center in middle distance, deep shadows ahead at the bottom of the stairs, no close-up of his face, no gore, quiet missing-person dread.
```

### Chapter 07 - First Loss

#### 07A - การลงไปตามหา Tom ที่ sauna

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/07a-search-for-tom.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: ภาพคั่นก่อนพบความสูญเสีย

ใช้ ref: Diana Webb, Vincent Leroux, Elena Vasquez (เฉพาะไฟฉายและมือ)

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Diana Webb in a dark field jacket over winter layers, hair tied back, leading the way down a narrow indoor lodge corridor toward the closed sauna door. Vincent Leroux follows half a step behind, slim with sharp cheekbones, white shirt sleeves rolled up, gripping a heavy steel flashlight. The viewer's perspective is the narrator just behind them: a single hand holding a smaller flashlight enters the lower frame, beam falling on dark cedar walls. Faint warm yellow light leaking from under the sauna door at the corridor's end, the wood thresholds smell of resin implied through deep graphite shadowing. The search feels controlled but doomed.

Composition: 16:9 interior corridor, sauna door as vanishing point center-right, Diana foreground left of center, Vincent half-step behind, narrator's flashlight beam intruding from the lower edge, no visible body yet, no readable signs, dread through cold lodge timber and absence.
```

#### 07B - แฟ้มลับใต้หมอนของ Vincent

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/07b-vincent-sophie-photo.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: object clue หลังเฉลยความเชื่อมโยง

ใช้ ref: Vincent Leroux เฉพาะภาพถ่ายเก่า, Marcus Hale เฉพาะภาพถ่ายเก่า, Sophie Hale ในรูปถ่ายเก่าหลายรูป

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

A neatly made guest bed in a lodge room, one pillow lifted slightly, exposing a thin paper folder of old photographs spread out in a fan: a wedding-party snapshot of a young Sophie smiling among guests with Vincent visible in the background; a candid selfie of Sophie looking gaunt and worn in winter clothes; a distant telephoto shot of Sophie in a brown coat outside this same lodge porch; and one close two-person photo of Sophie standing beside Marcus Hale, both small and old-photo soft, with a faint date stamp in a corner. The narrator's hand in the foreground holds the lifted pillow, sleeve only, no face. No active human figure in the bedroom itself, the discovery should feel like a quiet intrusion.

Composition: 4:3, folder of photographs fanned across the lower bed sheet as foreground anchor, lifted pillow shadow on the right, no readable handwriting, no bright lighting, intimate evidence scene without showing Elena.
```

### Chapter 08 - The Library

#### 08A - กล่องหลักฐานในห้องสมุด

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/08a-library-box-reveal.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: เปิดตอนหรือกลางตอน

ใช้ ref: Tom Janssen, Sarah Kovac

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Old lodge library at night, three of the four walls lined with dark wooden bookshelves heavy with unreadable spines, a low table tucked underneath an overstuffed leather armchair in the corner. Sarah Kovac in her dark turtleneck and metal-frame glasses kneels on the rug beside the armchair, her hands pulling open a hidden shallow drawer beneath it. Tom Janssen in his navy cardigan crouches beside her, lifting a yellowing paper box of files out of the drawer, his face tired and grim. A pair of brass reading lamps on a side table give the only warm light. No other characters in the frame.

Composition: 16:9, hidden drawer and box as the foreground anchor, Sarah and Tom kneeling in close two-shot, bookshelves as dark vertical texture forming the background walls, no readable book titles or notes, no other guests visible.
```

#### 08B - Sarah กับ Elena เฝ้ากลางคืน

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/08b-sarah-elena-night-watch.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: ภาพสงบแต่กดดัน

ใช้ ref: Sarah Kovac, Elena Vasquez (สลับมุม side profile), Tom Janssen (silhouette นอน)

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Late night in the lodge living room. Elena Vasquez, shoulder-length dark wavy hair and tired observant eyes, sits in profile facing Sarah Kovac across a low table. Sarah in profile, dark turtleneck, thin metal-frame glasses, hands folded close to her chest. Tom Janssen sleeps on the long leather sofa behind them as a soft graphite silhouette under a heavy wool blanket, deeply unconscious. A low fire in the stone hearth casts long shadows on the wood-panelled walls. Quiet conversation surrounded by fear, but no journalist's hand on a pen, only stillness.

Composition: 4:3 intimate two-person scene, Elena and Sarah in matching profile at the foreground table, sleeping Tom soft and distant on the sofa behind, no readable notes, low fire contrast without color.
```

### Chapter 09 - The Long Night

#### 09A - Vincent เดินตรวจยาม

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/09a-long-night-patrol.png`

อัตราส่วน: `21:9`

ตำแหน่งใช้: ภาพคั่นกว้าง

ใช้ ref: Vincent Leroux

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Vincent Leroux, 29, French writer, slim build, thick black classic-cut hair slightly disordered from the long hour, sharp cheekbones, a dark sweater pulled on over his white shirt, walking a quiet 2 a.m. night patrol down a long lodge corridor with a heavy steel flashlight. The far archway of the living room visible at the deep end of the frame with sleeping shapes huddled near the dying hearth glow. Every closed door he passes feels suspicious; the silver numbers on each panel rendered as unreadable graphite smudges.

Composition: 21:9 wide hallway, Vincent in left third, flashlight beam leading right toward the corridor's vanishing point, deep negative space, no readable clock or labels, slow patient dread.
```

#### 09B - Tom ที่อยู่บนเตียง

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/09b-wrong-tom-answer.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: ภาพประกอบความไม่ไว้วางใจ

ใช้ ref: Tom Janssen (ในมุมเห็นจากหลัง ไม่ชัดใบหน้า), Diana Webb (เห็นเฉพาะแขนถือปืนที่ขอบภาพ)

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

A first-person point-of-view standing just outside the open doorway of a lodge bedroom at night, looking in at a single figure with the silhouette of Tom Janssen sitting upright on the bed in his navy cardigan, back partly turned to the door, face only suggested in a half-shadow profile, eyes not visible. The narrator's shoulder fills the left edge of the frame; Diana Webb's outstretched arm with a low-held pistol enters from the right, hand steady. A single brass lamp on the nightstand provides a small pool of light, the bedroom otherwise dark. The moment of an answer that sounds correct but a person that feels wrong, psychological uncertainty without showing two faces at once.

Composition: 4:3 portrait of a doorway, Tom-shape on the bed center-right, narrator's shoulder framing left, gun-arm intruding from the right edge, no clear second figure, no gore, no creature, no readable text.
```

### Chapter 10 - Escape Attempt

#### 10A - Fake Tom หลังเสียงปืน

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/10a-gunshot-fake-tom.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: ภาพ imposter หลัก ใช้ไม่ต้องเยอะ

ใช้ ref: Diana Webb, Tom Janssen (ใช้สำหรับ Fake Tom เท่านั้น), Sarah Kovac

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Lodge upstairs hallway just after a single pistol shot. Diana Webb in dark long-sleeves with her hair tied back stands in the foreground, her Glock 17 lowered to mid-line, smoke implied only by a faint graphite haze near the muzzle. In the doorway of the bedroom behind her, Fake Tom stands with the shape of Tom Janssen, an older widower in a navy cardigan, but his face half-hidden in mirror-deep shadow and his stance subtly wrong, one shoulder unnaturally still. From a small bullet wound in his forehead, instead of blood, a pale dry desiccated white substance is just beginning to show. Through the opposite open bedroom door, the partial outline of the real Tom's body covered loosely under a wool blanket on the floor, only an arm visible, no gore. Sarah Kovac stands frozen at the far end of the hallway, hand to her mouth.

Composition: 16:9, Fake Tom in doorway shadow center-right, Diana foreground left, the real Tom's covered body implied through the far doorway, Sarah small in the background, no blood focus, no monster anatomy, restrained identity-horror shock.
```

#### 10B - ประตูหนีออกไปใน whiteout

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/10b-failed-escape-whiteout.png`

อัตราส่วน: `21:9`

ตำแหน่งใช้: ภาพคั่น action แบบไม่รบกวนอ่าน

ใช้ ref: Diana Webb, Vincent Leroux, Sarah Kovac, Jake Whitmore, Ben Ross, Elena Vasquez (จากด้านหลัง)

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

The lodge main double doors freshly forced open with a sledgehammer, broken electronic lock panel hanging by torn wires, the doorway framing a violent whiteout storm. Six figures push out through the threshold dragging a small wooden firewood cart loaded with supplies: Diana Webb at the front bracing against the wind with military steadiness, Vincent Leroux clutching a heavy flashlight, Sarah Kovac limping with her arm hooked into Vincent's, Jake Whitmore with his red hair plastered down and an axe slung at his hip, Ben Ross hunched behind them in his hoodie, and the narrator seen from behind in winter layers shielding her face with one arm. Coats and rope whip in the storm, the escape attempt visibly swallowed by snow before it becomes freedom.

Composition: 21:9, doorway as black frame on the left, snowstorm filling the right two-thirds, six small figures clustered at the threshold, no readable signs, high contrast graphite storm.
```

### Chapter 11 - The Long Day

#### 11A - Diana รักษาเท้าของ Sarah

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/11a-diana-treats-sarah.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: ภาพมนุษย์และความเจ็บปวดแบบเงียบ

ใช้ ref: Diana Webb, Sarah Kovac

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Diana Webb, 37, Australian ex-army medic with her hair tied back and hard practical eyes, kneeling beside Sarah Kovac on the rug in front of the lodge fireplace. Sarah, 41, wrapped in heavy wool blankets, her dark turtleneck pulled up, glasses fogged with held-back tears, her bare frostbitten feet soaking in a wide enamel basin of slowly warming water. Diana's hands work a compact army medic kit with gauze, antiseptic and warm cloths, her sleeve marked with a small unreadable patch. Sarah's face is half-turned away, biting her sleeve to keep from screaming as blood returns to her feet. Care and pain inside the trapped lodge.

Composition: 4:3 intimate medical scene, Diana's hands and the basin in the foreground, Sarah's face partly turned away to the right, no gore, no readable medical labels, quiet human stakes.
```

#### 11B - Sarah รอหน้าห้องน้ำ และเงาในกระจก

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/11b-bathroom-sarah-door.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: ภาพประกอบ paranoia

ใช้ ref: Elena Vasquez, Sarah Kovac

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Elena Vasquez, 32, with shoulder-length dark wavy hair, stands in front of a white porcelain basin in a narrow lodge bathroom. Seen from a three-quarter back angle, her body is turned slightly away from the camera, allowing us to see her profile and tired expression. The wall mirror above the basin shows her reflection looking directly back toward the camera with a calm, blank, and slightly unnerving stare. In the background, visible through the half-open bathroom door, Sarah Kovac waits silently in the dim hallway in her dark cardigan, face calm and watchful under a faint corridor sconce. Cold graphite shading.

Composition: 4:3, bathroom doorframe tight on the left, mirror on the back wall centered, Elena seen from a three-quarter back angle showing her profile, mirror reflection facing the viewer directly with a blank unnerving stare, Sarah a soft silhouette in the hallway, no visible text, no monster reveal.
```

### Chapter 12 - Ben Returns

#### 12A - เสียงเคาะจากประตูหน้า

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/12a-ben-at-main-door.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: เปิดตอนหรือจังหวะเคาะประตู

ใช้ ref: Diana Webb, Vincent Leroux, Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Lodge main entry hall just before dawn. Elena Vasquez is visible standing in the kitchen archway, seen in three-quarter profile, showing her tired face and dark wavy shoulder-length hair; she has a detached, slightly empty expression. Beyond her, the forced wooden main door is held shut by an improvised barricade of overturned chairs braced against it. Diana Webb stands in front of the door in dark long-sleeves and her hair tied back, Glock 17 raised steady, her broken-electronics lockpanel dangling beside the frame. Vincent Leroux stands just behind her with a sledgehammer ready in both hands. Through the small frosted glass window above the door, only a vague hooded silhouette is visible from outside, faint and snow-blasted. Snow visibly pressing against the bottom of the door.

Composition: 16:9 cinematic view, Elena in the left mid-ground in three-quarter profile looking toward the door, barricaded door as the central focal point, Diana sharp in the center, Vincent behind her, no readable markings, tense pre-dawn silence.
```

#### 12B - สัญญาณกะพริบตาของ Diana

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/12b-diana-blink-signal.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: ภาพใกล้ตัวละคร

ใช้ ref: Diana Webb, Sarah Kovac, Ben Ross

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

A close, quiet moment near the lodge fireplace between Diana Webb and Sarah Kovac. Diana in three-quarter profile, hard practical eyes giving a small deliberate two-blink signal toward Sarah across the rug, the rest of her face perfectly composed. Sarah in profile in her dark cardigan, returning a single blink of acknowledgement. Behind them, the soft blurred silhouette of Ben sitting on the sofa nursing a mug, framed but not focused. Trust communicated through one controlled gesture between two women who can no longer afford to speak it aloud.

Composition: 4:3, Diana's face and eyes sharp on the right, Sarah in partial profile on the left, background soft and crowded with the blurred third figure, no readable notes, no exaggerated expression.
```

### Chapter 13 - Into the Basement

#### 13A - เปิดฝา bench ใต้ sauna

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/13a-basement-gear.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: เปิดตอน

ใช้ ref: Diana Webb, Vincent Leroux, Sarah Kovac, Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

The inside of the cedar-panelled lodge sauna in the morning. The long wooden bench along one wall has been lifted on its hinges to reveal a hidden hatch beneath, opening downward into pitch-black depth with a worn wooden ladder descending out of sight. Diana Webb crouches at the edge of the hatch in a clean black Australian Defence Force jacket, hair tied back, checking her Glock 17. Vincent Leroux stands behind her in a white shirt and dark sweater, gripping a steel flashlight. Sarah Kovac stands beside him, holding Lillian's journal wrapped in cloth. Elena Vasquez stands at the other side of the hatch, seen in three-quarter profile as she holds a length of climbing rope; her face is visible, showing a cold, blank, and completely detached expression. The group gathers around the dark opening.

Composition: 16:9, raised bench hatch lower center as the dark mouth, Diana crouched at the lip, Vincent and Sarah flanking one side, Elena standing in three-quarter profile on the opposite side holding rope, heavy shadows down the ladder shaft, no readable markings.
```

#### 13B - พบ Marcus ตัวจริง

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/13b-found-marcus-cell.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: ภาพสำคัญท้ายตอน

ใช้ ref: Marcus Hale, Diana Webb, Vincent Leroux, Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

A small ancient stone cell deep below the lodge. Elena Vasquez stands at the cell threshold, seen in three-quarter profile, her dark wavy hair framing her tired face. She holds up a flashlight, its beam illuminating the cell; her expression is flat, calm, and eerily detached. Inside the cell, the real Marcus Hale sits on the damp stone floor, emaciated and gaunt after 32 days of captivity, with a long tangled beard and sunken eyes. Diana Webb crouches in front of Marcus, holding out a water bottle. Vincent Leroux stands just behind Elena, looking on in shock. Damp stone walls, old iron loops, tense discovery.

Composition: 16:9 view, Elena in three-quarter profile at the left foreground holding the flashlight, the beam cutting across to Marcus who sits low against the back wall, Diana in the mid-ground, Vincent behind Elena, no gore, dark moody graphite shadows.
```

### Chapter 14 - Marcus

#### 14A - คำสารภาพของ Marcus

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/14a-marcus-confession.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: กลางตอนช่วงอธิบายความจริง

ใช้ ref: Marcus Hale, Diana Webb, Sarah Kovac, Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

The ancient stone cell deep below the lodge during Marcus's confession. Elena Vasquez sits on a stone block, seen in three-quarter profile, her dark wavy hair framing her face. She has an open notebook and pencil near her, but her hands are still and her face is completely blank and expressionless. Across from her, the real Marcus Hale (emaciated, bearded, exhausted) sits against the cold wall, speaking. Diana Webb sits cross-legged near Marcus in her ADF jacket, listening intently. Sarah Kovac kneels beside Diana, hands folded. A single lantern on the floor casts long shadows. Scattered old papers lie on the stone floor.

Composition: 16:9 view, Elena in three-quarter profile on the left side of the frame, Marcus against the back wall as the focus of the group, Diana and Sarah in the mid-ground, high contrast graphite shading, serious psychological mood.
```

#### 14B - ห้องเก็บของของเหยื่อในถ้ำ

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/14b-subject-eight-board.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: object clue

ใช้ ref: Vincent Leroux, Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

A wide stone subterranean chamber below the lodge, serving as a hoarded collection point. On the floor, dozens of personal items from past guests are piled together in a careful, unsettling mound. Vincent Leroux, in a white shirt and dark trousers, stands on the right, seen in three-quarter profile as he lifts a soft light-blue knitted winter sweater out of an open suitcase. Elena Vasquez stands on the left in three-quarter profile, her face visible and expressionless as she turns a faded luggage tag on a suitcase to read it. The scene has a quiet, haunting atmosphere. Cold graphite shading.

Composition: 4:3 view, the mound of personal belongings filling the background, Vincent on the right and Elena on the left in three-quarter profile looking down at the items, focus on their faces and actions, no readable handwriting, soft pencil shadows.
```

### Chapter 15 - What Vincent Knows

#### 15A - ถ้ำโดมใต้บ้านพักและหลุมลึก

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/15a-ancient-cave-pit.png`

อัตราส่วน: `21:9`

ตำแหน่งใช้: ภาพกว้างก่อน climax

ใช้ ref: Diana Webb, Marcus Hale, Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

A vast ancient cave beneath the lodge: a domed natural chamber roughly 50 meters across with walls covered in eroded Sami runes. At the center of the floor, a perfectly circular pit about three meters in diameter cuts straight down into bottomless black. Three main figures stand along the rim: Diana Webb on the left with a flashlight, the real Marcus Hale gaunt and barefoot near the lip of the pit, and Elena Vasquez at the far right, seen in profile as she holds her flashlight, staring blankly down, with two other silhouetted survivors further back in the shadows. Pale graphite light beams criss-cross the cavern. The space feels ancient.

Composition: 21:9 wide cavern, black pit in the lower center, three distinct figures along the rim (Diana, Marcus, Elena in profile) and two silhouetted figures in the background, flashlight beams as pale graphite streaks, no creature visible, no readable symbols.
```

#### 15B - Marcus กระโดดลงหลุม

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/15b-marcus-jumps-voices.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: climax image

ใช้ ref: Marcus Hale, Diana Webb, Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

The bottomless cave pit at the climax. Marcus Hale's thin emaciated silhouette is caught mid-fall just below the rim, arms loose at his sides in surrender as he drops into perfect black. Along the upper rim, Diana Webb and Elena Vasquez stand frozen in shock, their profiles visible against the rising glow, beside two other silhouetted survivors. From the depths of the pit, a faint pale blue graphite haze rises like glow and breath, with the suggestion of dozens of overlapping human face-shapes blurring into smoke without ever resolving. No monsters, no gore, no creatures.

Composition: 16:9, pit dominating the lower two-thirds, Marcus falling small, Diana and Elena visible along the upper rim with their profiles clear in the rising glow beside two silhouetted figures, faint rising pale glow at the bottom, no readable marks, sacred dread.
```

### Chapter 16 - The Way Up

#### 16A - ปีนกลับผ่านฝา bench

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/16a-climb-back-sauna-bench.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: หลัง climax เพื่อให้คนอ่านได้หายใจ

ใช้ ref: Diana Webb, Sarah Kovac, Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

A low-angle view from inside the dark vertical shaft beneath the sauna, looking up the worn wooden ladder. Diana Webb pushes the lifted bench hatch open above her, with daylight from the sauna leaking in. Sarah Kovac climbs the ladder just below her, holding her bundle. At the bottom of the ladder, Elena Vasquez is starting to climb, looking up toward the light. We see her face clearly from a low angle, showing her dark wavy hair and a blank, distant expression. The shaft is filled with dust and graphite haze. No heroic poses, tired and realistic.

Composition: 16:9 view looking up the ladder shaft, daylight at the top, Diana at the hatch, Sarah on the rungs, Elena at the bottom looking up with her face visible, heavy pencil shadows, dusty atmosphere.
```

#### 16B - วิทยุฉุกเฉิน

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/16b-radio-call-fireplace.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: object/action insert

ใช้ ref: Diana Webb, Sarah Kovac, Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

A heavy battered two-way emergency radio is set out on a low table near the dying fireplace. Diana Webb leans over it, pressing the transmit key with controlled urgency. Sarah Kovac sits nearby on the rug, cradling Lillian's old journal. Elena Vasquez stands slightly apart near the frosty window, looking out into the snow with her back half-turned, her face visible in profile with a completely blank, cold, and detached expression, showing no interest in the radio call. Cold graphite shading.

Composition: 4:3 view, the radio table in the mid-ground with Diana and Sarah, and Elena standing near the window on the right side of the frame in profile, looking detached, soft fireplace shadows and cold window light, no readable labels.
```

### Chapter 17 - Karasjok

#### 17A - เฮลิคอปเตอร์เหนือ Karasjok

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/17a-helicopter-karasjok.png`

อัตราส่วน: `21:9`

ตำแหน่งใช้: เปิดตอนหรือภาพเปลี่ยนสถานที่

ใช้ ref: Elena Vasquez, Diana Webb, Sarah Kovac

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

A rescue helicopter banking low over the small lights of Karasjok village at early morning, snow-buried dark hills below. Inside the cabin, three exhausted survivors are seen through the open side window: Elena Vasquez closest to the glass with tears and a thousand-yard stare, Diana Webb beside her with her ADF jacket still on, and Sarah Kovac wrapped in an emergency blanket holding Lillian's journal. Their faces small and tired. The first view of civilization feels fragile instead of triumphant.

Composition: 21:9, helicopter side window framing the village lights below, three ref characters as small heads in the cabin row, faces small and tired, no readable markings on the aircraft, quiet rescue mood.
```

#### 17B - ห้องโรงพยาบาลของผู้รอดชีวิต

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/17b-hotel-survivors-toast.png`

อัตราส่วน: `16:9`

ตำแหน่งใช้: ภาพพักหลังเหตุการณ์

ใช้ ref: Elena Vasquez, Diana Webb, Sarah Kovac

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

A plain small hospital room in Karasjok at evening, two narrow beds pushed aside. Three survivors gather around a small wheeled bedside table set with plastic cups of white wine. Diana Webb sits closest to the head of one bed in clean borrowed clothes, hair brushed back. Elena Vasquez sits in profile on the second bed in a hospital gown with a knitted blanket over her shoulders. Sarah Kovac sits beside Elena, an IV taped to her hand. All three raise their plastic cups in a quiet toast to Marcus. Winter coats lie folded over the back of a metal hospital chair. Melancholy calm.

Composition: 16:9, three ref characters loosely gathered around the small wheeled hospital table, plastic cups raised low, room plain and unglamorous with a window of snow behind, no readable labels, melancholy calm.
```

### Chapter 18 - Mirror

#### 18A - แฟ้มของ Karlsen และรูปเก่าใน café

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/18a-karlsen-file-subject-eight.png`

อัตราส่วน: `4:3`

ตำแหน่งใช้: object clue ตอนเฉลย

ใช้ ref: Detective Karlsen, Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

A small wooden table inside a quiet Brooklyn café on a winter afternoon. Elena Vasquez sits on one side, seen in three-quarter profile showing her face, her shoulder-length dark wavy hair, and a completely calm, unreadable expression. Across the table sits Detective Karlsen in a dark navy winter coat. Between them, an open case folder lies on the table with several fanned-out photographs and unreadable reports. One old photograph clearly shows Elena's own face from years earlier. Beside the folder are two ceramic cups. Outside the window, a faint snowy street is visible. Cold graphite pencil sketch.

Composition: 4:3 view, Elena in three-quarter profile on the left side, Karlsen facing her on the right, the open folder and old photos sharp on the table between them, soft light from the snowy window, quiet realization mood.
```

#### 18B - กระจก: Elena ที่ไม่ใช่ Elena

ไฟล์แนะนำ: `public/assets/lodge/images/chapters/18b-not-elena-mirror.png`

อัตราส่วน: `4:5` หรือ `16:9`

ตำแหน่งใช้: ภาพปิดท้าย หรือหลังบรรทัดสุดท้าย

ใช้ ref: Elena Vasquez

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, realistic adult proportions, restrained psychological horror, not glossy, not AI-looking, no readable text, no logo, no signature.

Elena Vasquez seen in a small Brooklyn bathroom mirror, shoulder-length dark wavy hair and tired observant eyes, but the reflection is subtly not synchronized with her body — one frame off in eyelid position, one breath out of phase. On the porcelain sink ledge beside her hand: a single thin gold wedding band that she has only just noticed on her own ring finger. Half-tucked behind the mirror's edge, the corner of an open handwritten notebook is visible, the script on its visible margin clearly belonging to someone other than Elena's earlier hand — looped and unreadable, faintly resembling old Sami forms. No corpse, no monster anatomy. The ending implies Elena's identity has been overwritten rather than killed, calm horrifying realization that the person in the mirror is no longer Elena.

Composition: 4:5 intimate mirror portrait or 16:9 final illustration, real Elena partly seen from behind near the basin, reflection facing the viewer with a small wrongness, ring and notebook corner as foreground props, no gore, no dead body, no readable notebook text.
```

## สรุปจังหวะ imposter

- ใช้ `10A - Fake Tom หลังเสียงปืน` เป็นภาพ imposter แบบชัดที่สุดในเนื้อเรื่องหลัก
- ใช้ `18B - กระจก: Elena ที่ไม่ใช่ Elena` เป็นภาพบอกใบ้ตอนจบว่า Elena ถูกกลืน/แทนที่ ไม่ใช่ตายแบบมีศพ
- ภาพอื่น ๆ ที่อาจสะกิดการเปลี่ยนตัวตน เช่น `09B`, `11B`, `12B` ใช้สัญญาณเล็ก ๆ (เงา รอยยิ้มค้าง การกระพริบไม่ sync) แทนการโชว์ imposter แบบเปิดเผย
- ไม่ควรมีภาพ imposter เยอะกว่านี้ในรอบแรก เพราะจะลดความคลุมเครือของเรื่องและทำให้คนอ่านจับทางเร็วเกินไป

## สรุปการใช้ POV / Object / Scenery / Character Visibility

เพื่อรักษาความรู้สึก first-person ของ Elena การพรรณนาภาพในครึ่งแรกจะแบ่งเป็นสามแบบ แต่ในครึ่งหลังจะเน้นการเปิดเผยใบหน้าของเธอเพื่อสื่อถึงภาวะการโดนแทรกซึม:

- **POV (มุมมองบุคคลที่หนึ่ง)**: `02B`, `09B` ใช้สำหรับฉากที่ Elena เป็นผู้สังเกตและความรู้สึกของเธอคือหัวใจของฉาก
- **Over-the-shoulder (เหนือไหล่ Elena)**: ใช้ในภาพครึ่งแรกของนิยายเมื่อต้องการจำกัดมุมมองไม่ให้เห็นใบหน้าเพื่อลดความซ้ำของลูกเล่น "มือโผล่ขอบล่าง"
- **Object close-up (ของเล่ารายละเอียด)**: `04B`, `05B`, `07B` ใช้เพื่อให้หลักฐานพูดเอง โดย Elena ปรากฏแค่มือหรือไหล่
- **Scenery / ensemble / Character Profile (ภาพหมู่ บรรยากาศ หรือใบหน้าตัวละคร)**: `01A`, `01B`, `02A`, `03A`, `04A`, `08A`, `10B`, `11B`, `12A`, `13A`, `13B`, `14A`, `14B`, `15A`, `15B`, `16A`, `16B`, `17A`, `17B`, `18A`, `18B` ใช้เมื่อมีตัวละครหลายคนสำคัญพร้อมกัน หรือเมื่อต้องการแสดงใบหน้าของ Elena
- **การเปิดเผยใบหน้าของ Elena ตั้งแต่บทที่ 11B เป็นต้นไป**: เพื่อไม่ให้ Elena หายไปจากสายตาของผู้อ่านในจังหวะสำคัญที่เธอกำลังจะถูก Subject 8 ยึดร่าง ภาพประกอบตั้งแต่ 11B เป็นต้นไปจะค่อยๆ เผยใบหน้าหรือเสี้ยวหน้าของ Elena (Three-quarter profile) ที่มีสีหน้าว่างเปล่า เย็นชา หรือไร้อารมณ์ความรู้สึกมากขึ้นเรื่อยๆ แทนการบังใบหน้า เพื่อสร้างความกดดันทางจิตวิทยาก่อนถึงบทสรุปในกระจกเงา `18B`
