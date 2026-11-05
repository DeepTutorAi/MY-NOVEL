# Waiting After Rain: Character and Scene Record

Date: 2026-11-03 (Asia/Bangkok)
Status: selected R1 image inspected in two QC passes; PASS in the reviewed scope, with explicit unverified details. R0 was FIX and is retained as repair evidence.
Scope: one new illustration using only the central girl from an identity/style reference. The supplied image is not an edit target. No website or canon integration is included.

## Reference and character extraction

Reference: C:\Users\super\Downloads\ChatGPT Image 10 มิ.ย. 2569 03_52_05.png

Observed in the central girl: a short youthful oval face, small tapered chin, large blue oval eyes with relatively level upper lids, thin partly fringe-covered brows, a tiny nose and small closed mouth. Long pale blue-gray hair has separated fringe locks, long cheek locks and one high curved ahoge. Visible clothing includes navy sailor trim with twin pale lines, a muted red bow, a light outer garment/cardigan and navy pleats. She carries one cream notebook with a tree illustration and left-edge binding.

Age 16–17 is supplied by the brief, not a measured visual fact. Exact height, full-body head ratio and skirt/cardigan hem lengths are not established by the cropped reference. A standard knee-length skirt is a proposal for the unseen portion. The scene's two-handed grip and waiting pose are new staging, not the source pose.

Anti-same-face comparison with the earlier princess: short rather than long face; larger oval rather than downturned almond eyes; long loose blue hair and ahoge rather than a white loop bun; tiny rather than developed nose. Reference identity takes priority over artificial differentiation.

## Character Lock

59 whitespace-delimited words. Preserve unchanged in the scene prompt and any repair.

Schoolgirl, 16–17, slim build. Long pale blue-gray hair, separated bangs, long cheek locks, one curved ahoge. Short oval face, tapered chin, large blue oval eyes, thin brows, tiny nose, small closed mouth. Reserved expression. Navy sailor collar with twin pale stripes, muted red bow, light cardigan, navy pleated skirt. One cream notebook bearing a simple tree drawing, no text.

## Style exception

The user explicitly authorizes soft muted color for this illustration. Replace the source monochrome opening with soft muted colors and remove the no-color sentence and color prohibition. Keep the rest of the thin-ink/flat-cel style wording, CLEAN BG LOCK and Background Level 2 budget. Do not edit the installed skill files.

Applied style:
Japanese light novel insert illustration, soft muted colors. Clean thin ink lineart with even, crisp line weight, flat cel shading, soft screentone gradients, minimal hatching, hand-drawn look, official light novel interior art. A soft glowing backlight halo behind the character.

Applied avoid line:
Avoid: 3D render, photorealism, painterly or airbrushed rendering, glossy plastic skin, over-rendered detail, heavy hatching, noisy texture, text, watermark, extra fingers or malformed hands.

## Composition options

1. Recommended and selected: F. Single Portrait + Knee shot + Eye-level + 3/4 view. Keeps notebook, both arm paths, complete cardigan hem and damp ground visible; close left-third placement protects facial readability.
2. Alternative: F. Single Portrait + Waist-up + Eye-level + 3/4 view. Larger face and simpler body coverage, but the lower cardigan hem and wet ground lose room.

Decision: option 1 | Why: the brief requires face, hands, hem motion and atmosphere together | Gain: one coherent view of the complete gesture and breeze | Cost: a smaller face than Waist-up and more visible anatomy to inspect | Alternative: Waist-up would favor identity detail at the expense of the requested hem/ground evidence.

## Shot Plan

1. Quiet hope with slight loneliness while waiting after rain; face, recognizable hair, two-handed notebook hold, damp platform and breeze are must-see. F. Single Portrait, one landscape 3:2 frame.
2. Knee shot, clean mid-thigh crop well above knee joints. Protect complete ahoge, headroom, elbows, hands, notebook/binding and cardigan hem; knees and feet intentionally outside.
3. Eye-level + 3/4 view, level horizon; camera front-right of her neutral torso facing by about 20 degrees.
4. Girl close on the left third; face crisp in the upper-left area. Empty screen-right sky/platform carries the waiting direction; bench and lamp are farther away and faint, separated from her silhouette.
5. Torso projects about 20 degrees screen-right; head turns another 15 degrees toward her anatomical left. Chin raised slightly; both eyes share a distant screen-right target just above eye height.
6. Right near shoulder -> own-side bent elbow -> short forearm -> neutral wrist -> notebook lower screen-left edge; left far arm mirrors the own-side path to the lower screen-right edge. Book upright against lower chest/upper abdomen below bow, cover toward camera; no crossed arms. Single-frame test: feasible.
7. Exactly one held object, supported by both hands. Background Level 2 with exactly two scene objects: one empty bench and one lamp post. Broad sky/platform planes and simple damp reflections carry light; no train or other people.

## Planned geometry

```text
TOP VIEW                       FAR
                         L (lamp)
                   B (bench)
              open platform toward screen-right train approach -->
        P ↘ torso 20 / head 35 / gaze right and slightly up
        [notebook against front; hands at its two lower edges]
        |
        C ↑ eye-height view
                               NEAR

P = the girl; C = camera; B/L = two faint deeper scene objects.
Cross-person distance/overlap/scale/torso cues: N/A.

PROJECTED GRID
+----------------------+----------------------+----------------------+
| full ahoge / headroom| open cool sky        | pale warm sky opening|
+----------------------+----------------------+----------------------+
| face / gaze ->       | waiting space        | faint lamp           |
| sailor collar / bow  |                      |                      |
+----------------------+----------------------+----------------------+
| elbows / two hands   | faint empty bench    | damp platform        |
| full notebook / hem  | broad reflections    | open plane           |
+----------------------+----------------------+----------------------+
| clean mid-thigh crop, safely above knees; knees/feet outside       |
+------------------------------------------------------------------+
```

What the camera sees: both eyes and a gentle three-quarter face; visible hair/ahoge; sailor collar and bow; right near shoulder-to-hand chain and readable far left chain; one tree-cover notebook contacting the lower torso; cardigan hem; upper skirt; quiet wet platform, one faint bench and one lamp. Hidden digits behind the notebook are not presumed visible.

Planning 3D sanity checks: book/hand contact can face camera; face remains readable with a modest neck turn; both acting arm roots and elbow paths are assigned; distant prop scale must follow depth; cross-person flat-lineup test is N/A. The diagrams do not prove rendered anatomy.

## Generation and QC

- Mode: built-in image_gen. Initial generation used the original identity/style reference. R1 used that original as input 1 and the generated R0 as edit target input 2.
- Total generations: 2 (R0 plus one authorized repair, R1/3). Stop after R1 PASS; do not use R2/R3.
- Selected image: station-after-rain-r1.png, 1536 x 1024 pixels, 2,092,190 bytes.
- Selected source: C:\Users\super\.codex\generated_images\01a1a067-0336-7c51-a23d-ae76d3015801\exec-8a043667-a8df-4228-9c7d-5700c4864262.png.
- SHA256: D453B5C815E9134A0CDFAF90AB4EF11B7BFDA763BDD5F65C30F29C112C2F0211. Workspace copy matches the generated source.
- Final prompt: station-after-rain-r1.prompt.txt. Initial prompt remains station-after-rain.prompt.txt.
- R0 was FIX for a confirmed shot-distance/crop Major. Its complete two-pass QC, revised plan, diagrams and changed-line ledger are in r0-qc-and-r1-plan.md.
- Both R1 QC passes were performed by the same agent, not a separate reviewer. Pass 1 used the full selected file; pass 2 restarted with the original central girl's face crop, R1 face/hand crops at native pixels and a 300 x 200 thumbnail.
- Diagnostic crops did not resample face/hand pixels. The selected artwork was not retouched.
- Exact identity equality across different head views, age, height, unseen anatomy and camera coordinates are not certified.

### R1 QC pass 1: all nine zones

| Zone | Result | Evidence / notes |
|---|---|---|
| 1. Frame / crop | ✓ | Landscape 3:2. Hips, complete skirt hem and a short thigh area appear before the crop; knees/feet intentionally outside. Full ahoge has about 8% top space. Hands, elbows, notebook/binding and cardigan hem are clear of the frame. |
| 2. Camera / perspective / 3D | ✓ in visible scope; exact geometry ยืนยันไม่ได้ | One screen-right three-quarter face with a slight chin lift and no visible neck torsion. True horizon, eye-height and 20/35-degree numerical settings cannot be recovered from the soft scene. Cross-person depth checks N/A. |
| 3. Character | ✓ with limits | Compared with the central reference girl: short youthful oval face, tapered chin, blue oval eyes, separated fringe, cheek locks, curved ahoge and long blue-gray hair remain readable. Exact identity equality, age and full-body ratios cannot be established. Five digits per hand cannot be certified through the grip. |
| 4. Contact / limb chain | ✓ with occlusion limits | Both hands contact opposite lower notebook edges. Near right shoulder/elbow/wrist path is readable. The far upper arm is partly behind torso/book; cuff and hand meet the opposite edge. No visibly crossed forearms or detached hand. |
| 5. Held props | ✓ | Exactly one cream notebook, left-edge spiral, tree drawing on cover, no text. Book lies against lower chest/upper abdomen below the bow. |
| 6. Background | ✓ | Level 2: one faint bench and one lamp on the deep right, open sky/platform planes and wet reflections. No other people or train, no signage or station buildings. |
| 7. Authorized style | ✓ | Soft muted color exception, thin character contours, flat skin/clothing shadows, restrained texture and integrated warm rim. Hair remains pale blue-gray against the cream cardigan and lower-contrast sky. |
| 8. Brief / prompt fidelity | ✓ with limits | Waiting gaze, breeze in hair/hem, two-handed book hold, complete clothing and cool/warm post-rain atmosphere visible. Exact skirt length relative to an unseen knee and whether the tiny lip mark is fully closed are ยืนยันไม่ได้. |
| 9. Unrequested changes | ✓ with source limits | No extra character or held object. Buttons, cardigan hem and unseen skirt details are proposals; they are not claimed as observations from the source. |

### R1 QC pass 2: fresh inspection

| Check | Result | Evidence / notes |
|---|---|---|
| Count | ✓; hidden digits ยืนยันไม่ได้ | One girl, two visible eyes, two arm/cuff paths and hands, one notebook, two visible cardigan buttons, one bench and one lamp. Knees/feet are N/A. Full five-digit counts are not visible through wrapping/occlusion. |
| Trace | ✓ with limits | Fresh near-arm trace runs shoulder -> elbow -> wrist -> screen-left book hand; far cuff/hand belongs to the opposite side. Separated fringe, long locks and one curved ahoge connect. Both eyes read toward screen-right; a precise shared 3D focus is unverified. |
| Reconstruct 3D | ✓ in visible scope | One near girl, small/faint bench and lamp deeper right; see reconstruction below. Exact distances, true horizon and camera height cannot be measured. All four cross-person cues N/A. |
| Compare sources | ✓ with non-critical unknowns | Original and R1 face crops preserve major face/eye/hair cues despite a changed head pitch/view. All seven revised Shot Plan lines and 43 prompt sentence units were checked. Mid-thigh-region crop and top guard space repair are visible. Fine lip closure and full knee-relative skirt length remain unverified. |
| Thumbnail | ✓ | At 300 x 200, one girl/blue hair and cream notebook lead, with large screen-right waiting space. Bench/lamp remain secondary. Cool ambient color, warm opening and wet reflections support the after-rain evening beat. |
| Editor rejection test | PASS | No confirmed Blocker/Major in R1. No new defect is inferred from hidden digits, unseen knees or an ambiguous small mouth mark. Stop; no further generation. |

### Reconstructed top view from R1

This is a qualitative reconstruction; exact coordinates are not recoverable.

```text
                        L  (small/faint, deep right)
                  B
       P ↘ torso/head/gaze toward open screen-right space
       [book against torso; two lower-side grips]
       |
       C ↑ front-oblique view, distance unknown

One visible person; cross-person distance/overlap/scale/torso checks: N/A.
The farther placement of props is supported by their smaller scale and softer contrast.
```

### Comparison and verdict

- R0's confirmed crop/shot-distance Major is repaired: R1 shows hips, a substantial skirt area and thigh-level crop, rather than ending immediately under the cardigan.
- Complete ahoge has approximately 8% top space in R1; no clipping or near-border crowding remains.
- Both R1 passes support the recognizable eye/hair/costume cues, two-handed notebook contact and quiet two-object background.
- Pass 1 raised a possible tiny mouth opening. The native-pixel view does not support a reliable fully-closed versus slightly-parted conclusion; record ยืนยันไม่ได้, not a confirmed defect.
- Neither pass can count every digit behind the notebook or certify unseen full-body dimensions.
- No other disagreement requires repair.

Verdict: PASS for selected R1, with no confirmed Blocker or Major.
Regen: no. One of three additional attempts was used; stop at R1/3.

### Verification operations

- PowerShell extraction and ordinal comparison against installed style/background sources: exit 0 for the initial prompt; final prompt is rechecked after report write.
- Authorized style changes replace the monochrome opening with soft muted colors and remove both the no-color sentence and the color prohibition. CLEAN BG LOCK remains verbatim; Character Lock remains 59 words.
- Guarded Copy-Item, Get-FileHash SHA256 source/copy comparison and System.Drawing dimension readback: exit 0 for both R0 and R1.
- Native inspection crops and diagnostic thumbnails: exit 0; selected artwork unmodified.
- Built-in generation returned image results for R0 and R1. Shell exit codes do not apply to the image tool.
- Website build/runtime tests are N/A for these isolated illustration artifacts.

### Expression variants for later reuse

These replace only the expression sentence; they are not additional image requests.

- Quiet hope: Eyes attentive toward the distant screen-right approach, brows relaxed, mouth small and neutral.
- Reflective: Eyes resting on the same distant direction, inner brows lifted faintly, mouth softly closed.
- Calm anticipation: Chin slightly raised, clear shared gaze toward screen-right, a barely perceptible smile.

Tip: keep the blue local hair color and muted red bow in the Character Lock; change scene light without recoloring them. Treat newly visible hem/buttons/skirt length as proposals until approved.

## Final prompt sentence-to-result ledger

The 43 sentence units follow station-after-rain-r1.prompt.txt in order. Results concern only selected R1. R0's unchanged identity/style/content clauses were also checked in its nine-zone and fresh-pass record; its explicit framing failures are retained in r0-qc-and-r1-plan.md.

| # | Sentence | Result / evidence |
|---|---|---|
| 1 | Japanese light novel insert illustration, soft muted colors. | ✓ โทนอ่อนแบบภาพประกอบ LN |
| 2 | Clean thin ink lineart with even, crisp line weight, flat cel shading, soft screentone gradients, minimal hatching, hand-drawn look, official light novel interior art. | ✓ เส้นตัวละครบาง เงาผิว/เสื้อผ้าแบน และ tone เบา |
| 3 | A soft glowing backlight halo behind the character. | ✓ แสงขอบอุ่นนุ่มเชื่อมกับแสงเย็น |
| 4 | Use case: illustration-story. | N/A หมวดงานของพรอมต์ |
| 5 | Revise the framing of input image 2 into one landscape 3:2 illustration of the same schoolgirl waiting alone on a small railway platform just after the rain stops in the evening. | ✓ ภาพ 1536 x 1024 อัตราส่วน 3:2 คนเดียวรอในฉากหลังฝน |
| 6 | Input image 1 is the original identity and style reference, not an edit target: use ONLY the pale blue-haired girl in the CENTER, her face, eye shape, hair silhouette, uniform and notebook; exclude both flanking people completely. | ✓ ใช้จุดจำของเด็กสาวกลางภาพ ไม่ปรากฏอีกสองคน; ความเหมือนทุกพิกเซลยืนยันไม่ได้ |
| 7 | Input image 2 is the generated scene to revise: change only its camera distance and framing as specified below, preserving her identity, pose, two-handed grip, notebook, lighting, colors and two quiet background objects. | ✓ ระยะภาพถอยและครอปเปลี่ยน โดยคงท่า สมุด พาเลต และฉากสองชิ้น; ความเท่ากันทุกพิกเซลยืนยันไม่ได้ |
| 8 | Technique F. | ✓ F. Single Portrait |
| 9 | Single Portrait, Knee shot, Eye-level + 3/4 view, one level horizon. | ✓ ภาพเดี่ยว มุมหน้าเฉียงและครอปช่วงต้นขา; eye-height/เส้นขอบฟ้าจริงยืนยันไม่ได้ |
| 10 | Pull the camera back from input image 2 to a true mid-thigh crop, keeping her in the left third and the same view direction: the full hips and a substantial length of skirt below the cardigan must be visible before the bottom border, rather than cutting immediately beneath the cardigan. | ✓ เห็นสะโพก กระโปรงช่วงยาวใต้คาร์ดิแกน และต้นขาก่อนพ้นกรอบ |
| 11 | Fit the complete curved ahoge at least six percent of image height below the top border, while keeping her face crisp with both eyes readable and keeping the original youthful proportions. | ✓ ปอยโค้งครบ มีช่องเหนือหัวประมาณ 8%; ตาทั้งสองยังอ่านได้ |
| 12 | Preserve generous open screen-right waiting space toward the unseen arriving train. | ✓ พื้นที่ด้านขวาโล่ง ไม่มีรถไฟ |
| 13 | Crop the thigh region clearly above the knee joints, with her entire cardigan hem, both elbows, both hands, the complete notebook and its binding comfortably inside; knees and feet remain intentionally outside. | ✓ มือ ข้อศอก สมุด สันสมุด และชายคาร์ดิแกนครบ; เข่า/เท้าตั้งใจอยู่นอกภาพ |
| 14 | The eye-height camera is front-right of her neutral torso facing by about 20 degrees; her torso projects toward screen-right and her head turns a further 15 degrees toward her anatomical left, producing a gentle screen-right three-quarter face. | ✓ หน้าและอกเฉียงขวาในเชิงภาพ; 20/15 องศาและตำแหน่งกล้องจริงยืนยันไม่ได้ |
| 15 | She lifts her chin only slightly, eyes looking together toward a distant point off-frame screen-right just above eye level, never at the camera or the notebook. | ✓ เงยคางเล็กน้อย สายตาไปขวาภาพ ไม่มองสมุดหรือกล้อง; จุดโฟกัสร่วมในสามมิติยืนยันไม่ได้ |
| 16 | Keep the reference's small closed mouth and restrained brows; quiet hope and slight loneliness come from the attentive distant gaze and empty waiting space, without crying or an exaggerated smile. | ✓ อ่านความสนใจและพื้นที่รอได้ ไม่ร้องไห้หรือยิ้มเกิน; ปากปิดสนิทยืนยันไม่ได้จากเส้นเล็ก |
| 17 | Character Lock (verbatim): Schoolgirl, 16–17, slim build. | ✓ อ่านเป็นวัยเรียนและรูปร่างเพรียวในส่วนที่เห็น; อายุจริง 16–17 ยืนยันไม่ได้ |
| 18 | Long pale blue-gray hair, separated bangs, long cheek locks, one curved ahoge. | ✓ ผมฟ้าเทายาว หน้าม้าแยกช่อ ปอยแก้มและปอยโค้งหนึ่งเส้น |
| 19 | Short oval face, tapered chin, large blue oval eyes, thin brows, tiny nose, small closed mouth. | ✓ ใบหน้า/ตา/คิ้ว/จมูกเล็กตามลักษณะหลัก; ปิดริมฝีปากสนิทยืนยันไม่ได้ |
| 20 | Reserved expression. | ✓ สีหน้าสงบ ไม่แสดงอารมณ์เกิน |
| 21 | Navy sailor collar with twin pale stripes, muted red bow, light cardigan, navy pleated skirt. | ✓ คอกรมแถบอ่อนคู่ โบแดงหม่น คาร์ดิแกนอ่อนและกระโปรงพลีตกรม |
| 22 | One cream notebook bearing a simple tree drawing, no text. | ✓ สมุดครีมหนึ่งเล่ม รูปต้นไม้ ไม่มีข้อความ |
| 23 | Preserve the reference's blue irises, short youthful oval face, small tapered chin and separated fringe with the same high single curved ahoge; do not borrow features from the other two people. | ✓ จุดจำหลักจาก reference ยังอ่านได้; มุมศีรษะต่างกันจึงไม่รับรองความเหมือนเชิงเมตริก |
| 24 | Keep the pale blue-gray hair locally blue under the evening light, distinct from the desaturated sky and cream cardigan. | ✓ ผมยังเป็นฟ้าอ่อนเทา มีเส้นและแสงขอบแยกจากฟ้าและคาร์ดิแกน |
| 25 | Her complete age-appropriate uniform includes the navy sailor collar, twin pale trim lines, muted red bow, pale cardigan and a normal knee-length navy pleated skirt; the skirt length is a proposed unseen detail, not evidence from the reference. | ✓ เครื่องแต่งกายครบตามส่วนที่เห็น; ความยาวกระโปรงเทียบเข่าจริงยืนยันไม่ได้เพราะเข่าไม่อยู่ในภาพ |
| 26 | Hold the single cream notebook upright and flat against her lower chest and upper abdomen, below the bow, with its simple tree cover facing the camera and no lettering. | ✓ สมุดแนบอกล่าง/ท้องบนใต้โบ ปกต้นไม้หันกล้อง ไม่มีตัวอักษร |
| 27 | Her near anatomical right shoulder leads to an elbow bent beside her own waist, then a short forearm and neutral wrist to the notebook's screen-left lower edge; her far left shoulder, elbow and forearm lead to its screen-right lower edge without crossing the other arm. | ✓ แขนขวาด้านใกล้ต่อไหล่-ศอก-ข้อมือ-มือซ้ายภาพ; แขนไกลบางส่วนถูกบัง แต่ปลายแขน/มืออยู่ขอบตรงข้าม ไม่เห็นแขนไขว้ |
| 28 | Both hands gently support the lower side edges, thumbs on the front and other digits naturally wrapping behind, leaving the central tree readable; each hand has five fingers; no other limb crosses in front of the body. | ✓ สองมือพยุงขอบล่างสองด้าน ต้นไม้กลางปกอ่านได้; ห้านิ้ว/ตำแหน่งนิ้วโป้งทุกด้านยืนยันไม่ได้เพราะการอ้อมปกและการบัง |
| 29 | A light breeze carries a few long hair ends and the loose cardigan hem gently toward screen-left, preserving the main long-hair silhouette. | ✓ ปลายผมและชายคาร์ดิแกนพลิ้วไปซ้ายภาพ โดยทรงผมยาวหลักยังอยู่ |
| 30 | Cool blue-gray after-rain light is mixed with a faint warm peach opening in the sky at screen-right, giving a soft integrated rim/halo and restrained flat reflections on broad damp platform patches, with no active rainfall. | ✓ แสงเย็นกับช่องฟ้าอุ่นและเงาสะท้อนชื้น ไม่มีฝนกำลังตกในภาพ |
| 31 | Keep skin and clothes in clean flat cel shadow shapes, not painterly modelling. | ✓ ผิวและเสื้อผ้าใช้รูปเงาแบน |
| 32 | Background Level 2. | ✓ Background Level 2 |
| 33 | The setting appears as a faint, out-of-focus empty bench and one lamp post on the deeper screen-right platform, with a large empty area of sky and platform. | ✓ ม้านั่งหนึ่งตัวและเสาไฟหนึ่งต้นด้านขวาลึกกว่า มีพื้นที่ฟ้า/พื้นโล่ง |
| 34 | These are the only two scenery objects; the platform and sky are quiet broad planes, with a simple unadorned edge receding toward the right, not elaborate tracks or architecture. | ✓ ฉากสถานีมีสองพร็อพ ระนาบพื้นและเส้นขอบเรียบ ไม่มีราง/อาคารละเอียด |
| 35 | Separate both faint props from her silhouette, hair and face. | ✓ ฉากสองชิ้นแยกจากซิลูเอตผมและหน้า |
| 36 | Background: keep it minimal and quiet. | ✓ พื้นหลังไม่แย่งตัวละคร |
| 37 | Most of the frame behind the characters is empty soft tone or a screentone gradient, with at most two simple props drawn in thin, light lines that are clearly lighter and thinner than the characters' lines. | ✓ พร็อพสองชิ้นจางและ contrast ต่ำกว่าตัวละคร |
| 38 | Leave large areas of the frame empty. | ✓ พื้นที่ว่างด้านขวาและเหนือฉากมาก |
| 39 | A thin white gap separates the characters from the background. | ✓ แสงขอบอ่อนแยกซิลูเอต; ช่องขาวอิสระรอบทุกเส้นยืนยันไม่ได้ |
| 40 | Do not fill the scene with buildings, foliage, furniture, crowds, shelves, patterns or fine texture. | ✓ ไม่มีอาคาร ใบไม้ ฝูงคน ชั้นวางหรือลายฉากเพิ่ม; มี tone/ผิวเงาสะท้อนเบา |
| 41 | Use lighter, thinner contours and lower contrast for those two distant props; interpret the fine white separation as a soft light edge, not a thick cutout. | ✓ เส้นฉากเบาและขอบแสงไม่เป็นเส้นตัดหนา |
| 42 | Keep the right half open and quiet, without additional people, trains, station buildings, signs, wires or fences. | ✓ ไม่พบคนเพิ่ม รถไฟ ป้าย สายไฟ รั้ว หรืออาคาร |
| 43 | Avoid: 3D render, photorealism, painterly or airbrushed rendering, glossy plastic skin, over-rendered detail, heavy hatching, noisy texture, text, watermark, extra fingers or malformed hands. | ✓ ไม่พบ 3D/ภาพถ่าย/ผิวพลาสติก/ข้อความ/ลายน้ำ; ไม่พบมือผิดรูปที่ยืนยันได้ แต่ไม่รับรองนิ้วที่บัง |



