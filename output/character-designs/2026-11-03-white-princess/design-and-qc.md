# White Princess: Experimental Character Design

Date: 2026-11-03 (Asia/Bangkok)

Status: proposal; initial image generated and inspected in two QC passes. Verdict: PASS with two Minor deviations and stated evidence limits. No canon or website asset replacement is authorized.

## Specification and assumptions

- Adult human princess, 23 years old, 164 cm, balanced build. Natural medium bust under an opaque lined gown; the brief's approximate C cup is not an image measurement.
- Proposed body ratio: approximately 7.25 heads; a Bust-up illustration cannot verify full height or full-body ratio.
- Soft white hair with a deep side part, one low loop bun behind the anatomical right ear, and a loose S-shaped strand at the anatomical left cheek.
- Face DNA: long oval face, rounded chin, moderate downturned almond eyes, dense long fanned lashes, low arched brows, slender nose with rounded tip, small closed mouth and anatomical left cheek mole.
- Default expression: gentle, distant gaze with relaxed lids; both eyes share one distant screen-right target.
- Pale gown with a boat neckline, narrow dark scalloped trim, soft draping and sparse snowdrop embroidery. No held objects, animal traits or other characters.
- This conversation contains no earlier character design for an anti-same-face comparison.

## Reusable Character Lock

58 words, counted by whitespace. Reuse the paragraph unchanged.

Human princess, 23, 164 cm, balanced build. Soft white hair: deep side part, low loop bun behind her right ear, loose S-shaped left cheek lock. Long oval face, rounded chin, downturned almond eyes, dense long lashes, low arched brows, slender nose, closed soft mouth, left cheek mole. Pale draped gown, scalloped dark neckline, sparse snowdrop embroidery. Gentle, distant.

## Composition options

1. Recommended: F. Single Portrait + Bust-up + Eye-level + 3/4 view. Shows both eyes, nose volume, hair loop and the upper gown without complex limb staging.
2. Alternative: F. Single Portrait + Close-up + Eye-level + Front. Gives more pixels to the lashes and gaze but less room for the gown and side-bun silhouette.

Decision: use option 1 | Why: face, lashes and upper gown must share one image | Gain: readable adult facial structure and costume | Cost: less gown visible than Waist-up | Alternative: Close-up would reduce the gown evidence.

## Shot Plan

1. Beat: a calm adult princess lost in thought; must see face, lashes, both irises, hair silhouette and upper gown. F. Single Portrait, one portrait 2:3 canvas.
2. Bust-up. Eight percent headroom; entire loop bun and cheek lock inside the frame. Clean lower-chest/upper-ribcage crop below the bust apex; elbows, wrists, hands, waist and legs intentionally outside the frame.
3. Eye-level + 3/4 view, level horizon. Camera front-right of neutral torso facing by about 25 degrees, at eye height.
4. Face slightly left of center, eye line near upper third; empty tone to screen-right. One person; cross-person depth/overlap/scale cues are N/A.
5. Torso projects about 25 degrees screen-right; head turns five degrees back toward camera. Both eyes share a distant off-frame screen-right target slightly above eye level.
6. Upright relaxed neck and shoulders, arms hanging below the crop, no contact or crossed-body reach. Single-frame test: feasible; no panel split required.
7. Zero held or background props. Background Level 0: soft screentone gradient and faint halo only.

## Planned staging

```text
Top view (screen-right = +X; far = +Y)
                  FAR +Y
                    |
                    P  torso/head/gaze toward lower-right
                    |\\ T=25 / H=20 / G~25 degrees
                    | \\
                    C  camera at eye height, looking +Y
                  NEAR -Y

Camera sees: both eyes, a gently oblique face, the anatomical right loop bun
on screen-left, the anatomical left cheek lock on screen-right, both shoulder
roots, neckline and upper bodice. Hands and lower body are outside the crop.

+------------------+------------------+------------------+
| headroom / tone  | full hair crown  | empty tone       |
+------------------+------------------+------------------+
| loop bun         | face / lashes    | gaze -> space    |
+------------------+------------------+------------------+
| shoulder / drape | neckline / gown  | shoulder / tone  |
+------------------+------------------+------------------+
| clean lower-chest crop; no elbows, wrists or hands    |
+----------------------------------------------------+
```

3D planning sanity checks: readable face and untwisted neck are feasible; visible shoulder roots continue into upper arms. Contact, cross-person scale and flat-lineup tests are N/A. The diagram does not prove generated anatomy or actual camera coordinates.

## Generation and verification

- Mode: built-in image_gen, new image, no input image.
- Generation completed: initial R0/3 only; zero additional generations.
- Selected artifact: white-princess-r0.png, 1024 x 1536 pixels, 2,741,299 bytes.
- Source: C:\Users\super\.codex\generated_images\01a1a067-0336-7c51-a23d-ae76d3015801\exec-88debc03-4204-4a0d-8aa2-067305d58f35.png.
- Source/copy SHA256: 1070279159A01018DFCA062D681247BD27EDB72510F5A70AB26D71FBC4CDC411.
- Prompt: white-princess.prompt.txt. Programmatic extraction/comparison confirmed that both installed STYLE LOCK copies match and the prompt preserves STYLE LOCK, CLEAN BG LOCK and AVOID LINE verbatim. Character Lock: 58 whitespace-delimited words.
- Both QC passes were performed by the same agent. Pass 2 restarted from the image, native pixel face crop and a 192 x 288 thumbnail; it was not an independent reviewer.
- Inspection views are diagnostic only. The face crop preserves native pixels without resampling; the selected artwork was not retouched.
- Visual QC is bounded by the image. No full-body, physical clothing measurement, biological-age measurement or hidden-anatomy proof is claimed.

### QC pass 1: all nine zones

| Zone | Result | Evidence / notes |
|---|---|---|
| 1. Frame / crop | ✓; Minor | Portrait 2:3, Bust-up, entire crown and loop bun visible. Lower crop passes through clothing; hands, elbows and legs are intentionally outside the frame. Top headroom is approximately 4%, less than the planned ~8%, without clipping. |
| 2. Camera / perspective / 3D | ✓; ยืนยันไม่ได้ for exact coordinates | One front-oblique portrait, both eyes readable and neck untwisted. The tone-only background cannot prove an exact 25-degree camera or 20-degree face turn. Cross-person depth cues are N/A. |
| 3. Character | ✓; ยืนยันไม่ได้ for body metadata | Visible adult oval face, rounded chin, low brows, long separated upper lashes, visible irises/pupils, left cheek mole, low screen-left bun and screen-right S lock. Shoulder-to-neck contours are continuous. Height, exact age, full-body ratio and cup size cannot be verified. Hands/legs are N/A. |
| 4. Interaction / contact | N/A | No second character, contact or acting hand is required. |
| 5. Held props | ✓ | Zero held objects. No hand is introduced into the frame. |
| 6. Background | ✓ | Level 0, soft tone and faint glow, zero background props; no visible lettering or competing scenery. |
| 7. Style Lock | ✓ | Grayscale appearance, thin ink contours, flat gray shadow shapes, soft screentone, restrained hatching and non-glossy skin. |
| 8. Brief / prompt fidelity | ✓ with limits | White hair, adult facial structure, dense lashes, gentle distant expression, pale draped embroidered gown and single portrait are visible. Exact height, cup size and numerical camera settings are not visual proof. Headroom deviation is recorded in zone 1. |
| 9. Unrequested changes | ✓ | One human woman, no additional characters, no animal ears/fur, no held objects and no added body exposure. |

### QC pass 2: fresh inspection

| Check | Result | Evidence / notes |
|---|---|---|
| Count | ✓; N/A for off-frame digits | One person/face, two visible eyes and brows, one visible human ear, one low bun, one cheek mole and four snowdrop blossoms. Zero held/background props. Two shoulder contours are visible; arm structure is hidden by sleeves and hands/legs are outside the crop. |
| Trace | ✓; ยืนยันไม่ได้ for a precise 3D gaze target | Crown/part hair flows to the low screen-left bun; the separate S lock runs along the screen-right cheek. The native face crop shows long tapered lash strokes, readable pupils and no unambiguous crossed-eye defect. Overall gaze reads screen-right; an exact shared focal distance is not recoverable. |
| Reconstruct 3D | ✓; exact geometry ยืนยันไม่ได้ | One person in a front-oblique view, with a modest difference between head and torso facing. A precise camera height/angle is not measurable from blank tone. Four cross-person depth cues are N/A. Reconstruction appears below. |
| Compare sources | ✓; two Minor deviations | All seven Shot Plan lines and the 55 prompt sentence units were checked. Headroom is ~4% versus ~8%; the neckline reads as a deeper wide scoop than the proposed shallow boat. The Character Lock's scalloped dark neckline and the requested gown remain readable. |
| Thumbnail | ✓ | At 192 x 288, the face/eyes lead; the narrow dark neckline is secondary. Single-portrait layout, intact hair silhouette, quiet background and screen-right gaze space remain readable. |
| Editor rejection test | ✓ | No confirmed Blocker/Major. The two Minor deviations do not change identity, staging or the requested visual emphasis. Physical measurements and hidden anatomy remain unverified. |

### Reconstructed top view from visible evidence

This reconstruction is interpretive; coordinates and exact angles cannot be recovered from the rendered portrait.

```text
                     FAR / unknown depth
                             P ↘ oblique torso/head
                             |
                             C ↑ view toward the face
                     NEAR / camera distance unknown

One visible subject. Exact eye height, angle and distance: unverified.
Contact: N/A. Cross-person distance/overlap/scale/torso cues: N/A.
```

### Comparison between passes

- Both passes support intact framing, visible adult facial structure, separated long lashes, a single low bun, the intended cheek lock, quiet Level 0 background and the requested monochrome rendering.
- Pass 1 identified reduced headroom. The full image and thumbnail in pass 2 support the same Minor finding.
- Pass 2 additionally identified the deeper scoop neckline. Reinspection against the gown sentence confirms a Minor design-detail deviation; it does not remove the scalloped border or change the Character Lock.
- Neither pass supports a Blocker/Major finding. Exact shared gaze distance, exact age, height, head-to-body ratio and cup size remain unverified rather than inferred.
- No other disagreement requires repair.

### Verdict

PASS in the reviewed scope: no confirmed Blocker or Major.

Confirmed Minor findings:
1. Top headroom approximately 4%, less than the planned ~8%.
2. Neckline is a deeper wide scoop than the proposed shallow boat shape.

Regen: no. R0/3 only; zero additional generations used. Minor findings do not authorize regeneration under the bounded loop.

### Verification operations

1. PowerShell source-lock extraction and ordinal text comparison: exit 0. Installed STYLE LOCK copies identical; required source locks preserved; Character Lock 58 words.
2. Copy-Item guarded by destination nonexistence, followed by Get-FileHash SHA256 source/copy comparison and System.Drawing.Image dimension readback: exit 0. Image 1024 x 1536; copy hash matches source.
3. Native-pixel face inspection crop and diagnostic thumbnail creation: exit 0. Final artwork was not modified.
4. Built-in generation completed with an image result; shell exit codes do not apply to this tool.
5. Website build/runtime tests are N/A for this isolated design output; no consuming website or canon references were edited.

## Expression swaps for later reuse

These replace only the expression clause; all identity and style locks remain unchanged. They are not additional generation requests.

- Calm: Relaxed lids, gaze resting on a distant screen-right point, mouth gently closed.
- Soft smile: Relaxed lids, shared screen-right gaze, one mouth corner raised slightly.
- Reflective: Brows lifted faintly toward the center, clear distant gaze, lips softly closed.

## Character-specific notes

- Preserve white hair with sparse gray underside tone; keep the dark trim narrow so it does not compete with the face.
- Do not infer a precise cup size, exact age, height or hidden anatomy from the portrait.
- Keep the loop low beside the ear so the silhouette does not resemble upright animal ears.

## Prompt sentence-to-result ledger

Sentence units follow white-princess.prompt.txt in order; the short technique label is retained as its own unit. These observations refer only to the selected R0 image.

| # | Sentence / clause opening | Result and evidence |
|---|---|---|
| 1 | Monochrome black-and-white Japanese light novel insert illustration, grayscale only. | ✓ ภาพอ่านเป็นภาพประกอบ LN ขาวดำ |
| 2 | Clean thin ink lineart with even, crisp line weight, flat cel shading, soft screentone gradients, minimal hatching, hand-drawn look, official light novel interior art. | ✓ เส้นบาง เงาเทาเป็นรูปทรงแบนและ screentone; ไม่พบการเรนเดอร์หนัก |
| 3 | A soft glowing backlight halo behind the character. | ✓ มีแสงจางแยกผมจากโทนฉาก |
| 4 | No color. | ✓ ไม่เห็นสีในภาพที่ตรวจ |
| 5 | Use case: illustration-story. | N/A ป้ายกำกับประเภทงาน เป็นข้อมูลพรอมต์ |
| 6 | Asset type: experimental original character portrait, a design proposal. | N/A สถานะข้อเสนอออกแบบ เป็นขอบเขตงาน ไม่ใช่ข้อเท็จจริงจากพิกเซล |
| 7 | Create exactly one character-focused image with a very simple background: one adult human princess, calm and gently lost in thought, her face, eyelashes, gaze and upper gown as the subject. | ✓ มีหญิงมนุษย์ผู้ใหญ่หนึ่งคน เน้นหน้า ขนตา แววตาและชุดช่วงบน; บทบาทเจ้าหญิงเป็นข้อมูลการออกแบบ |
| 8 | One uninterrupted portrait canvas, 2:3 aspect ratio; no panels. | ✓ ไฟล์ 1024 x 1536 อัตราส่วน 2:3 ไม่มีแบ่งช่อง |
| 9 | Technique F. | ✓ อ่านเป็น F. Single Portrait |
| 10 | Single Portrait, Bust-up, Eye-level + 3/4 view, level horizon. | ✓ Bust-up มุมหน้าเฉียง; เส้นระดับจริงและระดับกล้องเชิงตัวเลขยืนยันไม่ได้ |
| 11 | The camera is at her eye height, front-right of her neutral torso facing by about 25 degrees. | ยืนยันไม่ได้สำหรับ 25°/ตำแหน่งกล้องจริง; มุมหน้าเฉียงที่เห็นสอดคล้องเชิงคุณภาพ |
| 12 | Her torso remains in that neutral pose, projecting toward screen-right; her head turns five degrees back toward the camera, so the face projects about 20 degrees toward screen-right and both eyes remain readable. | ✓ ตาทั้งสองอ่านได้และหน้า/อกเฉียงไปทางขวาภาพ; ตัวเลข 5°/20° ยืนยันไม่ได้ |
| 13 | Use natural portrait perspective without foreshortening. | ✓ ไม่พบการย่อส่วนจาก perspective อย่างรุนแรง |
| 14 | Place the face slightly left of center, eye line near the upper third, with open tone to screen-right along the gaze. | ✓ หน้าใกล้กึ่งกลางค่อนไปซ้าย แนวตาใกล้หนึ่งส่วนสามบน มีพื้นที่ด้านขวา |
| 15 | Leave about eight percent clear space above the entire hair silhouette. | ✗ Minor: ช่องเหนือผมประมาณ 4% แทน ~8%; ไม่ตัดผม |
| 16 | Keep the complete bun and cheek lock in frame. | ✓ ลูปผมและปอยข้างแก้มอยู่ในกรอบครบ |
| 17 | Show the full neckline, both shoulder roots and upper gown. | ✓ เห็นขอบคอ แนวไหล่ทั้งสอง และชุดช่วงบน |
| 18 | End at a clean lower-chest / upper-ribcage band below the bust apex, with the upper arms continuing naturally out of frame before the elbows. | ✓ ครอปช่วงอก/ผ้า; ตำแหน่ง bust apex ใต้ผ้า ยืนยันไม่ได้ |
| 19 | Elbows, wrists, hands, waist and legs remain outside this intentional crop. | ✓ ไม่มีข้อศอก ข้อมือ มือ เอว หรือขาในกรอบ; N/A สำหรับกายวิภาคส่วนที่ตั้งใจไม่แสดง |
| 20 | Character Lock (verbatim): Human princess, 23, 164 cm, balanced build. | ✓ อ่านเป็นหญิงมนุษย์ผู้ใหญ่รูปร่างสมส่วนในส่วนที่เห็น; อายุ 23 และ 164 ซม. ยืนยันไม่ได้ |
| 21 | Soft white hair: deep side part, low loop bun behind her right ear, loose S-shaped left cheek lock. | ✓ ผมอ่อนแสกข้าง ลูปต่ำฝั่งขวาของเธอและปอย S ฝั่งซ้าย |
| 22 | Long oval face, rounded chin, downturned almond eyes, dense long lashes, low arched brows, slender nose, closed soft mouth, left cheek mole. | ✓ หน้าวงรียาว คางมน ตาอัลมอนด์ ขนตาหนา คิ้วต่ำ จมูกเรียว ปากปิดและไฝแก้มซ้าย |
| 23 | Pale draped gown, scalloped dark neckline, sparse snowdrop embroidery. | ✓ ชุดอ่อน ขอบคอเข้มหยักและลาย snowdrop เฉพาะบริเวณบน |
| 24 | Gentle, distant. | ✓ สีหน้าอ่อนโยน ปากปิดและทิศมองไกลในเชิงการอ่านภาพ; ความคิดภายในยืนยันไม่ได้ |
| 25 | Her apparent age is an adult in her early twenties: a slightly elongated oval face, visible but softly rounded jaw, moderate eye-to-face ratio, defined nose bridge ending in a small rounded tip, and a small closed mouth with a gently raised corner. | ✓ ใบหน้าอ่านเป็นผู้ใหญ่ จมูกและกรามชัดโดยไม่แหลม; อายุจริง 23 ยืนยันไม่ได้ |
| 26 | Keep the tiny mole on her anatomical left cheek. | ✓ จุดไฝปรากฏบนแก้มซ้ายของเธอ ทางขวาภาพ |
| 27 | Human ears only. | ✓ หูที่เห็นเป็นหูมนุษย์; หูอีกข้างถูกผมบัง ยืนยันไม่ได้ |
| 28 | The rabbit-like softness comes entirely from her face and eyelashes, with no animal ears, tail or fur. | ✓ ไม่พบหูสัตว์ ขนสัตว์ หรือหางในส่วนที่แสดง; ลำตัวส่วนล่างนอกภาพเป็น N/A |
| 29 | Make the upper eyelashes long, dense and softly fanned, with separate tapered strands most visible at the outer corners, not a solid eyeliner mask. | ✓ ภาพรายละเอียดพิกเซลเดิมเห็นขนตาเป็นเส้นยาวเรียวแยกกัน โดยเฉพาะหางตา |
| 30 | Let the upper lids rest lightly over the tops of the irises while both irises and pupils remain readable. | ✓ เปลือกตาบนทับม่านตาบางส่วน ยังเห็นม่านตาและรูม่านตาทั้งสอง |
| 31 | Both eyes look toward the same distant point off-frame screen-right, slightly above eye level; their pupils align consistently with that shared target. | ✓ ทิศมองโดยรวมไปขวาภาพ; จุดโฟกัสร่วมและระดับสูงกว่าสายตาที่แน่นอน ยืนยันไม่ได้ |
| 32 | Use one restrained light catch per eye, gentle living focus, relaxed brows and a barely perceptible closed-mouth smile. | ✓ มีจุดรับแสงเด่นหนึ่งจุดต่อดวง คิ้วผ่อนและปากยิ้มบาง |
| 33 | The expression is tender and distant, without crossed eyes or blank pupils. | ✓ ไม่พบตาเขที่ยืนยันได้หรือม่านตาว่างเปล่า |
| 34 | The soft white hair has broad airy locks and a clear deep side part. | ✓ กลุ่มผมสีอ่อนกว้าง โปร่งและแสกข้างชัด |
| 35 | Its single rounded loop bun sits low behind her anatomical right ear, appearing on screen-left, with short loose ends; it is a hair loop below the crown, not an upright animal-ear shape. | ✓ ลูปผมต่ำฝั่งซ้ายภาพอยู่หลังหูขวาของเธอ ไม่ตั้งขึ้นเป็นหูสัตว์ |
| 36 | A loose S-shaped strand frames her anatomical left cheek on screen-right. | ✓ ปอย S อยู่ข้างแก้มซ้ายของเธอทางขวาภาพ |
| 37 | Use a few irregular fine strands, sparse gray underside tone and clean white hair surfaces rather than glossy specular bands. | ✓ มีปอยย่อยและเงาใต้ช่อผมบางส่วน ผิวผมอ่อน ไม่เป็นแถบเงาพลาสติก |
| 38 | Her balanced adult figure has a natural medium bust under a fully lined opaque bodice, conveyed through ordinary fabric volume. | ✓ เห็นปริมาตรลำตัวธรรมชาติใต้ผ้า; โครงสร้างซับในจริงและ cup size ยืนยันไม่ได้ |
| 39 | The gown has a wide boat neckline above the cleavage, a narrow dark scalloped border, softly falling outer fabric across the shoulders and upper arms, and sparse snowdrop embroidery confined to the neckline and a small upper-bodice area. | ✗ Minor: คอเว้ากว้างลึกกว่าคอปาดตื้น; ขอบหยักเข้ม ผ้าพลิ้วและลายปักเฉพาะจุดยังครบ |
| 40 | Keep the remaining cloth broad and quiet with a few flowing folds. | ✓ ผ้าส่วนใหญ่เรียบ มีรอยพับขนาดใหญ่เพียงบางแนว |
| 41 | Separate pale hair, pale gown and skin using thin contours and selective gray tone; the darkest small accents are the eyelashes and narrow neckline trim. | ✓ ผม ผิว และผ้าแยกด้วยเส้นและโทน; ขนตาและขอบคอเป็นจุดเข้มหลัก |
| 42 | The posture is upright and relaxed, shoulders lowered, neck untwisted. | ✓ ศีรษะตั้ง ไหล่ผ่อน คอไม่บิดผิดปกติ |
| 43 | No held objects and no other characters; no limb crosses in front of her torso. | ✓ ไม่มีของถือ คนอื่น หรือแขนพาดหน้าลำตัว |
| 44 | Background Level 0, zero props. | ✓ ฉาก Level 0 พร็อพศูนย์ |
| 45 | The background is only a soft tone gradient with a gentle glow. | ✓ พื้นหลังโทนไล่อ่อนและแสงจาง |
| 46 | Background: keep it minimal and quiet. | ✓ ฉากหลังไม่แย่งจุดสนใจ |
| 47 | Most of the frame behind the characters is empty soft tone or a screentone gradient, with at most two simple props drawn in thin, light lines that are clearly lighter and thinner than the characters' lines. | ✓ มีพร็อพศูนย์ อยู่ภายในข้อจำกัดไม่เกินสองชิ้น |
| 48 | Leave large areas of the frame empty. | ✓ มีพื้นที่โทนว่างด้านขวาและรอบศีรษะ |
| 49 | A thin white gap separates the characters from the background. | ✓ ขอบสว่าง/halo ช่วยแยกซิลูเอต; ช่องขาวอิสระรอบทุกเส้นยืนยันไม่ได้ |
| 50 | Do not fill the scene with buildings, foliage, furniture, crowds, shelves, patterns or fine texture. | ✓ ไม่พบอาคาร ใบไม้ เฟอร์นิเจอร์ ฝูงคน หรือฉากลายละเอียด; เม็ด tone เบาอยู่ในรูปแบบ screentone |
| 51 | For this Level 0 portrait, the allowed prop count is zero. | ✓ พร็อพพื้นหลังศูนย์ |
| 52 | Keep the screen-right gaze space and upper corners empty. | ✓ ด้านขวาภาพและมุมบนเป็นโทนว่าง |
| 53 | The halo is faint backlight in the tone, not a drawn ring. | ✓ halo เป็นความสว่างจาง ไม่ใช่วงแหวนวาดเป็นเส้น |
| 54 | Keep flat cel shadow shapes and a restrained screentone finish; no decorative border, lettering or speech bubbles. | ✓ เงาแบนและ tone เบา ไม่มีกรอบตกแต่ง ตัวอักษรหรือบอลลูนคำพูด |
| 55 | Avoid: color, 3D render, photorealism, painterly or airbrushed rendering, glossy plastic skin, over-rendered detail, heavy hatching, noisy texture, text, watermark, extra fingers or malformed hands. | ✓ ไม่พบสี/3D/ภาพถ่าย/ผิวพลาสติก/ลายเส้นหนัก/ตัวอักษร/ลายน้ำ; นิ้วและมือ N/A เพราะนอกกรอบ |

