---
name: ln-scene-composer
description: Use when composing light novel scene illustrations, staging characters or panels, continuing a scene draft, matching referenced art, or checking camera, composition, anatomy, identity and style. Also applies to ตรวจภาพ, QC, มุมกล้อง, composition and ภาพผิดปกติ.
metadata:
  version: "5.0"
---

# LN Scene Composer

Compose readable light novel scenes while preserving the user's characters,
visual sources and requested stage. Plan before prompting; inspect rendered
pixels before praise. Reply in the user's language; image prompts in English.

## Modes and resources

Start with [production-workflow.md](references/production-workflow.md) for source
priority, active contracts, draft/edit modes and file closeout.
- New/revised scene: [camera-catalog.md](references/camera-catalog.md),
  [camera-and-staging.md](references/camera-and-staging.md),
  [scene-templates.md](references/scene-templates.md),
  [style-lock.md](references/style-lock.md) and [clean-bg.md](references/clean-bg.md).
- Multiple views or detail + main: [panel-layouts.md](references/panel-layouts.md).
- Review target or generated candidate: [qc-checklist.md](references/qc-checklist.md).

Prompt-only returns text. Explicit create/edit requests use the available
imagegen workflow with inspected visual inputs when supported. A review alone
does not authorize generation, paid fallbacks or changes to published assets.

## 1. Resolve sources, stage and brief

Inspect references and label their roles. Without a narrower user role, preserve
a supplied character's visible identity, linework, rendering and palette.
Use approved Character Locks; if absent, record visible traits rather than
inventing new eyes/hair/marks. Use ln-character-designer when available for that
record or an explicitly new design.

Resolve from-zero / reuse / targeted edit / draft continuation / review.
Ask only consequential missing facts. State delegated assumptions and continue;
do not force an interview when the image and brief already answer the question.
For a draft/local edit, preserve existing camera, pose and untouched regions.

Choose the active Style Lock and Background Contract from brief/scoped references.
The default monochrome/CLEAN BG blocks apply only when compatible with that
choice. Do not require the user to request an exception to preserve reference art.

## 2. Show the Shot Plan before the prompt

Name the beat and must-see evidence. Apply the single-frame test: can one
feasible camera show the required faces/contact/detail? If not, simplify within
the brief or offer C/D. Keep an explicitly requested single frame; explain a
real visibility conflict rather than silently changing the layout.

Use named catalog techniques/distances/angles as the starting vocabulary.
The catalog includes G for deliberate ensemble/shared-plane groups. Preserve a
reference/draft's layout even if it needs a plain named description beyond a
preset; do not reshape it just to fit A. Label the choice and its purpose.

When framing is open, offer two short combinations and recommend one, then use
the user's choice or the stated recommendation. When framing is already fixed,
retain it and give a concise reason; do not offer unrelated redesigns.

Show five to seven lines per panel using
[camera-and-staging.md](references/camera-and-staging.md): beat/evidence, frame,
technique, distance/crop, camera/reason, positions/depth, head/torso/gaze,
action/props/background and the visibility test. Combine related fields.
A local edit's plan records preserved framing and the edit boundary.

Show a top-down ASCII plan for spatial multi-character/contact work, plus what
the camera sees. Use a native schematic or ASCII 3x3 projection when useful.
A simple portrait or fixed edit can use a compact projection; do not spend an
image generation on a planning diagram or save one by default.

Close framing reduces anatomical and scenery complexity and remains a useful
default for contact/dialogue/emotion. It does not override an atmospheric scene,
wide action, deliberate crop or established draft requested by the user.

Use depth/overlap/scale/torso turns to communicate intended layered staging.
These are cues, not a quota for all multi-person art. A deliberate same-plane
group, symmetry, shared gaze or three important people are valid choices.
"Behind" must describe a real relationship to the named person and camera;
screen-right alone does not establish it. Apparent scale follows actual height,
camera distance and viewpoint, not an automatic 85% resizing.

Run the five applicable 3D sanity checks. Change unresolved geometry before
prompting; N/A is valid for a single face or detail insert. Judge contact/face
visibility in its assigned panel, with one perspective system per panel.
Intentional occlusion is allowed when the story and limb ownership remain clear.

Use Background Levels as presets. Quiet/tone portraits default to 0, a suggested
place to 1, atmospheric context to 2. A reference or brief can call for richer
context; use its focal hierarchy without forcing empty space or a two-prop cap.

## 3. Compose one consistent English prompt

For one frame:
1. Active Style Lock.
2. Beat, named technique/distance/angles, camera, crop and staging.
3. Active Character Lock for each required person.
4. Named action chain, expression/gaze, overlap, contact and props.
5. Active Background Contract and compatible constraints.

For C/D, describe the overall layout, then each panel's complete camera/action/
Character Locks and Background Contract. Apply the same resolved Style Lock
globally. Use the no-text/border sentence for text-free panels. D's detail inserts
contain no faces; a requested facial inset is labelled a reaction-panel layout.

Keep identity sentences stable. A requested wardrobe/expression edit changes the
active task Lock; remove contradictory old instructions and label the override,
without overwriting approved canon. Reuse active style/background blocks across
candidates so an unrelated repair cannot silently change them.

For important contact, name the acting person's anatomical left/right near/far
shoulder -> elbow -> wrist -> hand -> target. Prefer a readable bent arm when
compatible with the action; don't ban a requested crossed arm or foreshortened
pose. Explain visible origins or logical occlusion. Each held object has an
owner and grip; stacks or multiple requested items are allowed.

Use problem-specific constraints. "Not a side-by-side lineup" belongs to a
layered-depth scene, not a group deliberately posing together. Do not append
"no other limb crosses" to a requested crossed-arm guard. Five-finger wording
does not certify unseen digits. Do not rewrite reference rendering to satisfy
the default flat/non-glossy style.

## 4. Deliver or generate

Show a concise scene/source summary, Shot Plan/diagram and prompt. Variants and
tips are optional when useful, not mandatory output for every local edit.
For create/edit, generate using inspected references when supported, inspect
the result and continue to QC. For existing targets, review them directly.
A reconstructed missing plan is labelled proposed, not historical evidence.

## 5. Two-pass QC before a verdict

Follow [qc-checklist.md](references/qc-checklist.md): nine zones, then fresh
counts/tracing, source comparison, 3D reconstruction where relevant, thumbnail
and editor checks. Include all panels and continuity. Do not copy pass 1 into
pass 2 or imply an independent reviewer was used when none was.

Show two compact tables with ✓ / ✗, **ยืนยันไม่ได้** or N/A and evidence.
Compare against the resolved sources, allowed changes and requested stage.
Do not call intentional twins duplicates, a planned flat group bad depth, a
color reference style drift, or unfinished off-scope draft regions final faults.

End PASS/FIX with reviewed scope, confirmed severities and limits. Minor-only
findings do not cause unsolicited regeneration. A requested cosmetic edit is
still authorized initial work; it does not need an invented Major finding.

## 6. Repair and close

For confirmed Blocker/Major, fix only the demonstrated failure. Repair geometry
in the Shot Plan first; preserve established identity/style and unaffected
regions. Keep the source's visual inputs through revisions where supported.
Do not change the character to make a failed candidate fit.

For authorized automatic repairs, allow at most three additional attempts per
source task shared across both skills/defects/reviewers. Count issued failures.
Stop on PASS; at R3/3 return FIX and remaining evidence. Do not reset the budget
silently. Without a tool, give corrected prompt/changed clauses and state that
the proposed repair has not been rendered.

Keep required QC; reduce documentary overhead. Use chat or one existing handoff,
remove authorized task-owned scratch after verification, and report kept /
removed / remaining only where relevant. Follow the production workflow.

## Multi-character continuity and age

Describe every important participant, not only the first two. Use focal hierarchy
for supporting people instead of automatically blurring/cropping the third.
Distinguish different identities when intended; preserve intentional twins,
shared family traits, synchronized expressions and shared gaze.

Keep school-age characters natural, age-appropriate and non-sexualized.
Do not add body emphasis absent from the brief or erase requested adult build.
Keep palette and costume from the selected source unless the brief changes them.
