# Tsukinomi Extra art prompts

ใช้ Image Gen + สกิล Light Novel

Three light novel images for the Extra page, of the adults who have no picture there
yet. None of these moments appears in the book.

| No. | File | Type | Who | Ratio |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `naomi-dry-goods-shop-v1.png` | Solo | Naomi | Portrait 3:4 |
| 2 | `naomi-akihiro-shop-talk-v1.png` | Two people | Naomi, Akihiro | Landscape 4:3 |
| 3 | `watanabe-tea-engawa-v1.png` | Solo | Watanabe | Landscape 4:3 |

Save every result as a PNG in
`C:\Users\super\Desktop\test\public\assets\tsukinomi\images\extra\`. Do not replace any
existing file there, and do not edit anything under `src`; the site picks the pictures
up in a later pass.

## References

Open the listed files and draw from them. Do not guess or redesign anyone: faces, hair
and clothes come from the sheets of each image below. Every reference is read-only, so
do not edit, overwrite, move or redraw it, and save only the new file named for the image.
The sheets are for identity only: no ruler, labels or sheet layout in the result.

Style references, for all three images:

- Line and tone: `C:\Users\super\Desktop\test\public\assets\tsukinomi\images\extra\thank-you-haruto-hina-kaori.webp`
- Adults in soft light: `C:\Users\super\Desktop\test\public\assets\tsukinomi\images\extra\kaori-hina-adult-hands-reunion-v1.png`
- An interior at evening, background detail: `C:\Users\super\Desktop\test\public\assets\tsukinomi\images\extra\akira-haruto-future-izakaya-dinner-v1.png`

Character references, by image:

| Image | Who | Path |
| :--- | :--- | :--- |
| 1, 2 | Naomi: main sheet | `C:\Users\super\Desktop\test\public\assets\tsukinomi\images\extra\naomi-expressions-160cm-draft-v2.png` |
| 1, 2 | Naomi: second view | `C:\Users\super\Desktop\test\public\assets\tsukinomi\images\characters\Naomi.webp` |
| 2 | Akihiro: main sheet | `C:\Users\super\Desktop\test\public\assets\tsukinomi\images\extra\tanaka-akihiro-expressions-176cm-draft.png` |
| 2 | Akihiro: second view | `C:\Users\super\Desktop\test\public\assets\tsukinomi\images\characters\Tanaka Akihiro.webp` |
| 3 | Watanabe: main sheet | `C:\Users\super\Desktop\test\public\assets\tsukinomi\images\characters\Watanabe.webp` |
| 3 | Watanabe: how the book renders him, for style only | `C:\Users\super\Desktop\test\public\assets\tsukinomi\images\illustrations\chapter-17-watanabe-farewell-pov.webp` |

Story sources:

- The shop, images 1 and 2: `C:\Users\super\Desktop\test\src\content\tsukinomi\sections\01-discovery.md`, line 638
- Watanabe's tea, image 3: `C:\Users\super\Desktop\test\src\content\tsukinomi\sections\05-ten-years.md`, lines 462 and 517

## Blocks

Each prompt is the style block, then the block of each person in the image, then the
scene block.

### Style

```text
Monochrome black-and-white Japanese light novel illustration, grayscale only. Fine clean ink lines with controlled weight, soft gray wash and delicate screentone, gentle contrast, softly detailed grayscale background with gentle depth of field, hand-drawn look, official light novel art. Match the rendering of the attached style references. No color. No readable text anywhere: signs, jar labels and shelf tags stay blank. No watermark, no border, no sheet layout, no height ruler. Natural hands with five fingers. Adults keep their real age in the face.
```

### Naomi

```text
NAOMI: middle-aged Japanese woman, 160 cm, slim, tired but upright. Dark hair with a soft part, tied in a loose low ponytail at the nape, thin strands falling beside the face. Gentle downturned eyes, fine lines at the eyes and mouth. Pale loose long-sleeved shirt with a small round neck and the sleeves rolled to the forearm, plain gray bib apron with wide neck straps, a tie knotted at the front of the waist and two front pockets. Match the face and clothes of the attached Naomi sheet.
```

### Akihiro

```text
AKIHIRO: middle-aged Japanese man, 176 cm, a fit school sports teacher. Short dark hair swept up and back, faint lines at the eyes and forehead, strong jaw, clean-shaven. White zip track jacket with dark raglan sleeves, a white stripe down each sleeve and a dark stand collar. Match the face and clothes of the attached Akihiro sheet.
```

### Watanabe

```text
WATANABE: Japanese shrine keeper aged 78, 165 cm, small and thin. Long straight white hair combed back from a high lined forehead, half tied at the back of the head, the rest falling past the shoulders. Deep forehead wrinkles, crow's feet, soft heavy eyelids, a gentle mouth. White haori with a small flower crest on each side of the chest, white kimono crossed at the neck, black hakama with a black sash knotted at the front. Match the face and clothes of the attached Watanabe sheet.
```

## Image 1: Closing time

File: `naomi-dry-goods-shop-v1.png`. Blocks: Style, Naomi.

- Beat: the shop is closing. She is drying her hands when someone she knows comes to the door, and she looks up. The reader should feel she is about to say "welcome home".
- Frame: Single Portrait, Waist Up, Eye Level, 3/4 view, portrait 3:4. The counter's edge crosses the frame just below her apron tie, so the knot stays inside.
- Positions: she stands behind the counter, a little right of centre. The space she looks into stays open on the left.
- Directions: torso 3/4 toward screen left, head turned further, gaze level at a door out of frame on the left. Faint tired smile, the eyes doing most of it.
- Action: both hands at apron height, right hand holding a folded cotton hand towel, left fingers pressed into it.
- Background, level 2: shelves of honey jars, pickled fruit, bags of beans, bundles of dried seaweed, small boxes of needles, folded handkerchiefs. One bare bulb with an enamel shade overhead.
- Second option if the hands fail: Bust Up, hands out of frame, the towel over her shoulder.

```text
Closing time in Naomi's small dry-goods shop in a Japanese mountain town. Single portrait, Waist Up, Eye Level with a level horizon, 3/4 view, portrait 3:4. Naomi stands behind an old wooden counter, a little right of centre; the counter's edge crosses the frame just below her apron tie, with the knot fully visible. Her torso turns 3/4 toward screen left and her head turns further, gaze level toward a shop door out of frame on the left, as if someone she knows has just come home. A faint tired smile, gentle eyes, a strand of hair loose from the day. Both hands at apron height: her right hand holds a folded cotton hand towel and the fingers of her left hand press into it, drying them. On the counter sit a worn wooden abacus and a closed ledger, nobody touching them. Behind her, floor-to-ceiling wooden shelves softly out of focus: jars of mountain honey, pickled fruit, paper bags of beans, bundles of dried seaweed, small boxes of sewing needles, folded handkerchiefs, every label blank. One bare bulb with an enamel shade hangs overhead, and the last evening light from the door falls on the left side of her face. She is alone in the frame.
```

## Image 2: After closing

File: `naomi-akihiro-shop-talk-v1.png`. Blocks: Style, Naomi, Akihiro.

- Beat: he has stopped by after school. She pours him roasted tea and he tells her something about the children. He is her late husband's younger brother: warmth and respect, like family, with no romance. He sits, and she stands.
- Frame: Shared-plane two-shot, Waist Up, Eye Level at about 125 cm, 3/4 view of both, landscape 4:3. Both faces and the pour are fully visible.
- Positions: the counter runs away from the camera through the centre of the frame, about 70 cm wide. Naomi is on the left behind it, Akihiro on the right on a low stool. The counter stays between them and they do not touch.
- Directions: Naomi's torso faces screen right, turned a little to camera, with her eyes on the cup. Akihiro's torso faces screen left, turned a little to camera, looking up at her.
- Action: her right hand grips the teapot's overhead handle, her left fingertips rest on the lid, and tea runs into his cup. His two hands hold the cup steady on the counter.
- Height check: he is 176 cm but seated, so his eyes sit a little below hers.
- Second option if the pour fails: she has just set the teapot down, and both hold their cups.

```text
After closing in Naomi's small dry-goods shop, a quiet family moment. Shared-plane two-shot, Waist Up, Eye Level at about 125 cm with a level horizon, landscape 4:3. An old wooden counter about 70 cm wide runs away from the camera through the centre of the frame. Naomi stands on the left behind the counter, torso facing screen right and turned slightly toward the camera, eyes lowered to the cup, a small private smile as if she has heard an old family joke again. Akihiro sits on a low wooden stool on the right, torso facing screen left and turned slightly toward the camera, shoulders a little bowed in respect, looking up at her with a soft, slightly shy smile, like a younger brother. Because he is seated, his eyes sit a little below hers, and he is visibly broader than she is. Her right hand grips the overhead cane handle of an old round earthenware teapot and her left fingertips rest on its lid; a thin stream of tea runs into a plain tall cup on the counter in front of him. Both his hands hold that cup steady on the counter, receiving it politely. A second cup of tea, steaming, waits on her side. The counter stays between them, they do not touch, and there is no romantic tension. Behind them, softly out of focus: shelves of jars and bundled dried goods along both walls with blank labels, and at the far end a half-lowered shutter with the dusk street beyond it. One bare bulb with an enamel shade hangs above the counter, making a warm pool of light on the two of them while the shop's corners fall into soft shadow. No other people.
```

## Image 3: Tea on the veranda

File: `watanabe-tea-engawa-v1.png`. Blocks: Style, Watanabe.

- Beat: an ordinary autumn afternoon at the Kitsune shrine. He sips warm tea and waits, as he does in the book. A second cup is poured beside him for a visitor who has not arrived yet, and that cup is the story of the picture.
- Frame: Single Portrait, Waist Up, Eye Level at seated height, 3/4 view, landscape 4:3. He takes the left third and the garden takes the rest.
- Distinct from chapter 17: no snow, no table, nothing handed over, not facing the viewer.
- Directions: torso and head 3/4 toward screen right, eyes closed.
- Action: right hand wraps the side of the chawan, left palm supports its base, the rim just touching his lower lip so the corners of his smile still show. The prayer beads loop over his left wrist.
- Background, level 2: garden in soft focus, a small stone fox on a low pedestal, a few falling leaves. Low afternoon light from the right.
- Second option if the mouth reads badly: the cup lowered to chest height, breathing out after the sip.

```text
An ordinary autumn afternoon at a small old Japanese mountain shrine. Single portrait, Waist Up, Eye Level at seated height with a level horizon, 3/4 view, landscape 4:3. Watanabe sits on a weathered wooden veranda in the left third of the frame, his torso and head turned 3/4 toward screen right, eyes peacefully closed, sipping tea. His right hand wraps the side of a plain rough ceramic chawan and his left palm supports its base, with the rim just touching his lower lip so the corners of his serene smile still show. A thin curl of steam rises past his face. Dark wooden prayer beads with a long tag loop loosely over his left wrist. Beside him on the veranda boards sits a small wooden tray with a round teapot and a second chawan, already poured and steaming, set out for a visitor who has not arrived. The right two thirds of the frame open onto the shrine garden in soft focus: maple branches, a few leaves falling, moss and stepping stones, and one small stone fox statue on a low pedestal with a gentle expression. No snow. Low afternoon light comes from the right, brightening his white haori and white hair, while the dark wooden interior and a shoji screen sit behind him in shadow. He is alone in the frame.
```
