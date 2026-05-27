# Hvitveldt Image Prompts

ใช้ไฟล์นี้เป็น prompt bank สำหรับสร้างภาพประกอบแนว pencil hand drawing ไม่ลงสี เน้นลายเส้นเหมือนคนวาดจริง ทุก prompt ใส่ Prompt Style หลักไว้แล้ว จึง copy ทีละอันไปใช้ได้ทันที

## 01 Home Background

ตำแหน่งใช้งาน: `public/assets/images/backgrounds/home-lodge-approach.*`

อัตราส่วนแนะนำ: `21:9` สำหรับ desktop hero, export เพิ่ม `16:9` สำหรับ fallback และ OG crop

Safe area: เว้นพื้นที่กลางภาพ 45% ให้มืดและโล่งพอสำหรับชื่อเรื่อง ห้ามวางตัวละครหรือรายละเอียดจัดตรงกลาง

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, not glossy, not AI-looking, no text, no logo, no signature.

Wide establishing shot of Hvitveldt Lodge in a remote snowy Norwegian forest at night, an old wooden lodge half-hidden behind black pine trees, heavy snow falling, one or two weak warm windows, a narrow buried path leading toward the building, empty sky and mist in the center for readable website title, darker tree masses at left and right edges, the lodge silhouette low in the lower third, cold lonely atmosphere, calm dread, readable negative space.

Composition: 21:9 ultra-wide hero background, center safe area clear, important details on lower left and lower right, no close-up faces, no characters in the center, no modern cars, no city lights, no readable words.
```

## 02 Character Reference Sheet

ตำแหน่งใช้งาน: `public/assets/images/characters/`

อัตราส่วนแนะนำ: `3:4` ต่อหนึ่งตัวละคร หรือ `16:9` สำหรับ group reference

หมายเหตุ: ใช้ reference ก่อนสร้างฉากที่เห็นหน้า ถ้ายังไม่มี reference ให้เลือกมุมหลัง ไหล่ มือ หรือ silhouette เพื่อลดปัญหาหน้าตาไม่คงที่

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, not glossy, not AI-looking, no text, no logo, no signature.

Character reference sheet for [CHARACTER NAME], adult survivor in a remote winter lodge horror mystery, consistent face and body design, front view, three-quarter view, side profile, neutral expression, anxious expression, winter clothing layers, practical boots, subtle tired eyes, realistic human proportions, no exaggerated anime style, no beauty retouching.

Composition: 3:4 reference sheet, clear repeated facial structure, simple blank background, small object props allowed only if character-specific, no scene background, no text labels.
```

## 03 Arrival Exterior

ตำแหน่งใช้งาน: `public/assets/images/chapters/01-arrival-exterior.*`

อัตราส่วนแนะนำ: `16:9`

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, not glossy, not AI-looking, no text, no logo, no signature.

A small group of strangers arriving at Hvitveldt Lodge during snowfall, seen mostly from behind and side silhouettes to avoid inconsistent faces, luggage half-sunk in snow, the lodge doors ahead in dim light, pine forest closing around them, footprints already being covered by snow, quiet unease, not action-heavy.

Composition: 16:9 chapter illustration, characters in lower third, lodge entrance slightly off-center, enough empty dark sky and snow haze for cropping, no readable signs, no modern hotel look.
```

## 04 First Night Common Room

ตำแหน่งใช้งาน: `public/assets/images/chapters/02-first-night-common-room.*`

อัตราส่วนแนะนำ: `16:9`

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, not glossy, not AI-looking, no text, no logo, no signature.

Interior common room of an old winter lodge, strangers sitting apart around a low fire, whisky glasses and coats on chairs, candlelight and fireplace glow suggested only through pencil contrast, long shadows on timber walls, everyone looks polite but guarded, one empty chair slightly too noticeable.

Composition: 16:9, fireplace low right, empty chair mid-left, faces small or turned away, central negative space kept readable, no modern TV, no bright cozy cabin mood.
```

## 05 Marcus Missing

ตำแหน่งใช้งาน: `public/assets/images/chapters/03-marcus-missing-hallway.*`

อัตราส่วนแนะนำ: `16:9`

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, not glossy, not AI-looking, no text, no logo, no signature.

A narrow lodge hallway in the morning after Marcus disappears, half-open door, disturbed bedsheets barely visible through the doorway, snow light leaking from a small window, floorboards and wall hooks, a person standing at the far end as a small silhouette, dread through absence rather than violence.

Composition: 16:9, strong hallway perspective, door not centered, no blood, no monster, no readable notes, quiet missing-person tension.
```

## 06 Library Investigation

ตำแหน่งใช้งาน: `public/assets/images/chapters/08-library-investigation.*`

อัตราส่วนแนะนำ: `4:3` หรือ `16:9`

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, not glossy, not AI-looking, no text, no logo, no signature.

Old lodge library with tall shelves, scattered notebooks, maps, and a candle burning low, one hand turning a brittle page, another figure blurred in the background between shelves, dust and cold air visible in pencil shading, mystery mood, investigative, no jump scare.

Composition: 4:3 for inserted illustration or 16:9 for full-width break, foreground hand and page lower third, shelves frame the scene, avoid readable book titles.
```

## 07 Basement Descent

ตำแหน่งใช้งาน: `public/assets/images/chapters/13-basement-descent.*`

อัตราส่วนแนะนำ: `9:16` สำหรับ mobile/side art และ `16:9` สำหรับ desktop insert

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, not glossy, not AI-looking, no text, no logo, no signature.

Steep wooden stairs descending into the lodge basement, darkness below, candle held near the frame edge, rough stone walls, old pipes, frost on the steps, the feeling that the house is becoming narrower, no creature shown, fear comes from the depth and silence.

Composition: 9:16 vertical variant with stairs dropping from upper left to lower center, keep top third less detailed for UI crop; also suitable for 16:9 horizontal crop with darkness on right.
```

## 08 Mirror Ending

ตำแหน่งใช้งาน: `public/assets/images/chapters/18-mirror-ending.*`

อัตราส่วนแนะนำ: `16:9`

```text
Prompt Style หลัก: monochrome pencil hand drawing, graphite on cold off-white paper, no color, no watercolor, no digital painting, visible human pencil strokes, uneven hand pressure, fine cross-hatching, soft smudged shadows, cinematic but quiet, natural imperfect linework, not glossy, not AI-looking, no text, no logo, no signature.

An old mirror in a dark lodge room after everything has ended, frost at the mirror edges, candle almost out, the reflection slightly wrong but subtle, no clear monster, only a faint impossible shape suggested by pencil shadows, abandoned room, quiet final haunting.

Composition: 16:9, mirror off-center, candle lower right, broad dark negative space around reflection, no text, no gore, no dramatic explosion.
```
