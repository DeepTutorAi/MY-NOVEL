# Camera catalog for light novel scenes

Choose a named **framing technique + shot distance + camera angle(s)** before
writing a prompt. Explain how it serves the beat. The catalog is a starting
vocabulary, not a reason to reshape a user reference/draft. Preserve established
framing and name any needed custom view plainly. G supports deliberate ensemble
art. Resolve style/background from sources and brief before these defaults.

## Shot distances

| Name | Japanese / Thai | Emotion | Use when | Anomaly risk | Prompt phrase |
|---|---|---|---|---|---|
| Close-up | クローズアップ / ใบหน้าใกล้ | Intimacy, shock, vulnerability | A face is the beat; also a face-free hand/object detail insert, explicitly labelled as such | Low for faces; hand detail still needs careful QC | "Close Up of the face"; for inserts, "Close Up detail of the hand and object, no faces" |
| Bust-up | バストアップ / ระดับอก | Clear reaction and readable contact | Default for contact, comedy, dialogue and emotion; clean chest crop | Low; protect acting elbows, hands and headroom | "Bust Up, clean chest crop, complete acting hand" |
| Waist-up | ウエストアップ / ระดับเอว | Gesture and action with some context | A required arm, grip or object does not fit Bust-up | Low relative to wider views; knots and low hands need protection | "Waist Up, clean upper-waist crop" |
| Knee shot | ニーショット / เหนือเข่า | Readable stance without full surroundings | The brief needs legs but not feet | Medium-high; cut above the knee, never through its joint | "Knee Shot, cropped clearly above the knees" |
| Full body | 全身 / เต็มตัว | Physical stance, isolation | Full posture is requested or is part of narration | High: hands, feet and many joints | "Full Body, complete head and feet with margin" |
| Long shot | ロングショット / ภาพไกล | Distance, loneliness, place | Atmosphere or an explicitly requested wide action | High for tiny faces/hands; do not certify unseen detail | "Long Shot, small complete figure, generous empty space" |
| Extreme wide | エクストリーム・ワイド / ไกลมาก | Scale, solitude, setting | The location/negative space is the beat | High for character detail and background invention | "Extreme Wide Shot, tiny figure, restrained setting" |

Bust-up and Waist-up are the low-risk defaults, not an anatomy guarantee.
Normalize older briefs' "medium close-up" to Bust-up and "medium" to Waist-up
when that matches the actual crop; choose by the required contents, not by
adding a new distance name. An insert uses Close-up with a **detail subject**;
"extreme close-up" is descriptive tightness, not another Shot Plan category.

## Camera angles

Height/pitch, view direction and horizon roll describe different dimensions.
Combine catalog names when needed, such as **Eye-level + 3/4 view**. All people
in one panel share one camera and horizon; head/torso turns remain poses.

| Name | Japanese / Thai | Emotion | Use when | Anomaly risk | Prompt phrase |
|---|---|---|---|---|---|
| Eye-level | アイレベル / ระดับสายตา | Neutral, direct, accessible | Default dialogue, reactions and friendly contact | Low; preserve depth and actual height differences | "Eye Level, level horizon" |
| High angle | 俯瞰（ふかん） / มุมสูง | Vulnerability, smallness, overview | Looking down helps reveal a tabletop, palm or weaker position | Medium-high: head enlargement and shortened bodies/limbs | "High Angle, camera above the subject looking down" |
| Top view | 真俯瞰 / มองจากด้านบน | Detachment, layout clarity | A top-facing hand/object or spatial relationship is essential | High: compressed heads and hidden faces | "Top View, camera directly above" |
| Low angle | アオリ / มุมต่ำ | Power, threat, impact | Authority or an upward action is the beat | High: foreshortened arms/hands/legs and unintended body emphasis | "Low Angle, camera below eye level looking up" |
| Bottom view | 真下から / มุมเงยจากล่างมาก | Looming danger, extreme force | An explicitly useful worm's-eye effect | Very high: extreme foreshortening; simplify the pose | "Bottom View, worm's-eye camera close to the ground" |
| Dutch tilt | ダッチアングル / เอียงเส้นขอบฟ้า | Instability, kinetic impact | A dynamic beat or intentionally tilted source layout | High: conflicting horizons; no independent tilts per person | "Dutch Angle, one deliberately tilted horizon" |
| Front | 正面 / ด้านหน้า | Confrontation, clarity | A frontal focal face/body serves the beat | Low, but two frontal bodies can become a flat lineup | "Front View of the focal subject" |
| 3/4 view | 斜め / เฉียงสามส่วน | Depth, readable form and expression | Default oblique staging and contact-side access | Low-medium; state whose reference facing defines the view | "3/4 View, camera front-left of the named reference facing" |
| Side (profile) | 横 / ด้านข้าง | Clear silhouette, lateral movement | A side-on acting arm or walking direction matters | Medium; stagger bodies in depth instead of a flat profile lineup | "Side View, readable profile" |
| Back view | 後ろ / ด้านหลัง | Distance, mystery, contemplation | Clothing/hair continuity or an away-facing figure matters | Medium-high: back hair and clothing can change or merge | "Back View, consistent back hair and jacket seams" |
| Over-the-shoulder (clean) | 肩越し・クリーン / ข้ามไหล่แบบสะอาด | Focused dialogue, subjective relation | View from the partner's shoulder position without a foreground body fragment | Low-medium; specify camera side/height and the unseen partner's position | "Over the Shoulder, clean single, foreground shoulder out of frame" |
| Over-the-shoulder (dirty) | 肩越し・ダーティ / ข้ามไหล่มีฉากหน้า | Relationship, emotional pressure | A recognizable foreground shoulder/nape frames the sharp speaker | Medium: use only a named shoulder or nape, never an arbitrary blurred blob | "Over the Shoulder, dirty single, the listener's right shoulder in the near foreground" |
| POV | 主観 / มุมมองผ่านสายตา | Immersion, discovery | The viewer should see what a named character sees | Medium-high: disembodied hands and unclear ownership | "POV of the named character, camera at their eye position" |

Do not combine "Back View" and "facing the camera" for the same subject in the
same panel. Different panels may deliberately show different sides. To contrast
Low angle for a powerful person with High angle for a vulnerable one, use
separate panels or choose one focal viewpoint; do not assign two cameras inside
one continuous space.

The English phrases in the tables are the model-facing vocabulary. Do not rely
on "Fisheye" alone; an explicitly requested peephole effect needs "peephole" or
"door-scope" plus a catalog camera. "Pan" and "Tracking" are video instructions;
for a still use "motion-feel composition" with an actual shot and angle.

## Framing techniques A-G

| ID / name | Structure | Best use | Guard against |
|---|---|---|---|
| A. Layered Depth Staging | Foreground visible figure roughly 55-70% of panel height; a deeper figure normally 75-90% apparent scale, slightly overlapped; optional very slight softness behind, with important faces/hands crisp | Contact from behind, following, interpersonal distance and tension | A flat two-shot, arbitrary biological resizing, blur hiding essential evidence |
| B. Dirty Single / Over-the-Shoulder | A named near shoulder/nape softly frames the other sharp subject; identify side and facing; clean OTS removes that fragment | Dialogue and emotion; reverse sides only with a new clear camera plan | A random dark blob, an unrequested face in the foreground, obscured focal hands/face |
| C. Diagonal Split | One thin straight diagonal divides two clearly bounded views, each with its own camera | Separate locations, simultaneous or contrasting reactions, or two views of one event | Treating the border as a shared horizon or forcing cross-panel depth/eye contact |
| D. Insert + Main | A face-free hand/object detail panel plus a main context/reaction panel, normally separated by a black bar | Object reveal, magic, reaching and contact invisible from a useful face view | Faces in the insert, mismatched hand/prop/wardrobe, another unnecessary panel |
| E. Symmetry Framing | One serious focal character framed by at most two quiet props | A formal or solemn single-character illustration | Prop/head tangents and scenery exceeding the Background Budget |
| F. Single Portrait | One focal character; separation/halo follows the chosen style; a planned distant/back view can omit the face | Default single-character beat, including one-person atmosphere | Adding an unrequested partner/detail or forcing a face into a planned Back view |
| G. Ensemble / Shared-plane Framing | Two or more important people deliberately share a plane; actual relative heights, balanced or asymmetrical staging; resemblance/shared gaze allowed | Groups, twins, teams, frontal stage scenes or established flat drafts | Blurring the third person, forcing depth or redesigning intentionally matching faces |

For A, preserve actual character height: apparent size comes from camera depth.
The normal scale bands are suggestions when depth is intended, not quotas or
measurements inferred from a reference. G or a fixed draft may use a shared
plane without forced overlap/resizing. An explicitly distant beat can justify a larger size
difference and a softer unimportant distant face; record that choice. Essential
faces and acting hands still need readable edges. For "behind", describe its
relationship to the partner and camera separately. Viewpoint determines whether
the actor is nearer/farther or smaller/larger; screen-right alone is insufficient.

## Situation -> two options

When framing is open, offer two options and explain their benefits, then use
the existing choice or recommendation. Preserve fixed source/brief framing
instead of offering unrelated redesigns. This is not an approval gate.

| Beat / situation | Recommended combination | Second option / reason |
|---|---|---|
| Comic back-slap, tap or greeting | A + Bust-up + Eye-level + 3/4 view of the recipient; visible short bent acting arm | D: Close-up contact insert + A main; separates palm/back evidence from readable faces when one view fails |
| Shock or embarrassment | F + Close-up or Bust-up + Eye-level + 3/4 view, effect marks, Level 0 | C for two opposed reactions; each face can keep a simple pose |
| Dialogue | B + Bust-up + Eye-level + Over-the-shoulder (dirty), Level 0 | B clean OTS; remove the foreground shoulder if it blocks required detail |
| Tension / authority | A + Waist-up + Low angle for the focal dominant subject | C with separate Low angle / High angle views; avoids two incompatible cameras in one panel |
| Object reveal or magic | D: Close-up hand/object insert + Bust-up main | D with Waist-up main; more room for the grip without forcing the detail and both faces into one view |
| Different places or two viewpoints | C + Close-up or Bust-up per panel | C with unequal panel areas; each location/view retains its own camera |
| Fight | A + Waist-up + Low angle + 3/4 view, restrained speed lines | D with a face-free hand/weapon insert; isolates a difficult grip; Dutch tilt only when the action benefits |
| Loneliness / narration of a place | F (one person) or A (several) + Long shot or Extreme wide + Back view + Eye-level, Level 2 | High angle instead of Eye-level for smallness, with simplified anatomy |
| Confession / romance | F for one focal face, A for two + Close-up + Eye-level + 3/4 view, shallow focus, Level 0 | B + Bust-up + Eye-level + Over-the-shoulder (dirty); prioritizes one emotional face |
| Strong interpersonal distance | A + Bust-up foreground + Eye-level + 3/4 view, much deeper smaller partner | A + Waist-up foreground + Back view; strengthen distance without a forced second frontal face |
| Walking together | A + Waist-up + Eye-level + Side (profile), one quiet background prop | A + Waist-up + Eye-level + Back view; simpler faces, preserve hair/clothing backs |
| Single-character expression | F + Bust-up + Eye-level + Front; separation follows chosen style | F + Waist-up + Eye-level + 3/4 view when a gesture is essential |
| Ensemble / intentional twins | G + Waist-up + Eye-level + Front, shared plane and requested resemblance | G + Full body + Eye-level + Front when stance/outfit context matters |

Close action is a useful low-complexity default. Honor a wide brief/reference
or a stance/context that needs wider framing. Briefly explain added anatomy/
background risk before a wide action prompt without making it an approval gate.
Background detail follows the active scene contract, not an automatic prop cap.

## Reading supplied composition references

Label whether a reference supplies layout, depth, rendering, identity or an edit
target. In the three composition examples supplied for this catalog:
- Reference 1 informs C: a diagonal division suggests two viewpoints; do not
  infer separate places or time solely from the division.
- Reference 2 informs D: a face-free hand/object detail leads into a main scene
  with reaction and context. Borrow the storytelling hierarchy, not extra
  ornaments or heavier texture beyond the locks.
- Reference 3 informs A: a large sharp foreground figure and a smaller softer
  distant partner make depth do emotional work. Preserve the reference's
  intentional size contrast instead of forcing a generic equal-sized two-shot.

A reference can teach one technique without being a QC-approved model of every
crop, style or prop choice. Its assigned role helps resolve the active Character/
Style Locks; an incompatible default does not override it.
