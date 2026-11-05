# Two-pass image QC and targeted repair

Use for requested review targets and every generated candidate. Inspect reference
inputs for their roles; a supplied reference alone does not need a published QC
report. Start
with the actual image at available native resolution, its brief, prompt and
Shot Plan and requested stage. A previous assistant's praise or a user's suspected error is a lead,
not visual evidence. Do not praise or announce PASS before both passes finish.

## Active scope, stage and uncertainty

Compare the resolved reference/brief identity, style and background contract,
not a conflicting default. Preserve intentional twins, shared faces, same-plane
groups and requested prop counts. A draft/layout review covers its required
structure or edited region: unfinished final detail outside scope is N/A.
State scope with the verdict, e.g. PASS for layout; final finish not assessed.
A user-requested cosmetic edit may be performed without inventing a Major fault;
Minor-only prohibits unsolicited QC regeneration, not the requested initial edit.

## Evidence and uncertainty

- Name a zone and an observable contour, crop, overlap, tone or mismatch for each
  finding. Use coordinates/crops when they help locate it.
- Inspect native-size details when possible; do not upscale or invent detail to
  count fingers. If a joint, thumb, seam or contact is hidden, write
  **ยืนยันไม่ได้** and state whether resolution, occlusion or missing sources limit it.
- A hand has five digits, but not all five need to be visible in a valid pose.
  Occluded fingers are not evidence of missing fingers. Test thumb side only
  when palm/back orientation can actually be established.
- Head tilt, a bent torso, perspective depth and clothing folds can explain
  apparent differences. Check these alternatives before declaring broken anatomy
  or multiple camera heights.
- Compare body emphasis and clothing with the actual age/build/outfit brief.
  Requested adult curves or a fitted shirt are not defects by themselves. Do not
  invent a cup-size measurement from an image or silently redesign the body.
- An intentionally blank sign is not garbled text. Inspect its usefulness and
  proximity to the head separately. Missing historical prompts/plans stay missing;
  use a labelled proposed plan for repair rather than fabricating one.

## Technique, panel and continuity scope

Check the selected A-F technique against the actual image before accepting
plausible faces. For A, compare foreground/deeper planes, overlap and relative
scale; a flat two-shot when depth/action was planned is Major. A deliberate
same-plane group is valid and does not need forced overlap or size reduction. The scale band is a planning
target, not an exact measurement recoverable from arbitrary head turns.

For C/D, run all nine zones **per panel**, using P1/P2 zone labels, then check:
- Panel count, positions/relative sizes, divider/bar shape, straightness and
  separation; no accidental text, speech bubbles or overlapping borders.
- Each panel's own camera/distance/crop against its own Shot Plan. Separate
  spaces do not need one shared horizon or cross-panel overlap.
- Same-event identity, hairstyle, age/build, clothing seams, props, anatomical
  left/right hand and action continuity. Screen-left may change with viewpoint.
- D insert has no faces, including reflected/background faces; the main panel
  supplies the planned reaction/context. The essential contact/prop evidence
  must be clear in its assigned panel, not necessarily repeated in both.
- Count people/objects by panel and by identity. A planned recurrence across
  panels is not an accidental duplicate face or extra object.

A clean OTS with one visible person or a detail-only insert does not fail the
depth-cue checks merely because a second complete figure is absent.
A recognizable intentional near shoulder/nape in B is not random background
clutter. If the foreground shape has no identifiable source, record that
ambiguity; do not simply call every dark OTS shape an anatomy failure.
Misidentified technique, a broken reading order or unclear required detail is
Major when it changes the planned read. A slightly uneven separator alone is
Minor; it does not justify regen without a confirmed larger problem.

## Pass 1: inspect zones independently

Check every row. In the character row, inspect each character separately and
record which arm/hand belongs to them. Mark deliberate out-of-frame areas N/A.

| Zone | What to inspect |
|---|---|
| 1. Frame / crop | Canvas/panel ratio, layout/divider and catalog shot; cuts at joints, face, hands, props or knots/tails; headroom; bottom/side guard space |
| 2. Camera / perspective / 3D | Named technique/angles versus plan, requested anchor/height/view and one horizon per panel; eye levels allowing head tilt; depth planes, partial overlap, apparent scale and torso turns; behind versus beside; foreshortening |
| 3. Each character | Face, eye shape and gaze; neck/shoulders; torso and clothing with continuous buttons/zips/seams; each arm's count, joints, length and shoulder origin; five-digit hand structure, thumb orientation and grip where visible; draft scope; legs/feet or N/A |
| 4. Interaction / contact | Trace the named near/far shoulder -> elbow -> wrist -> palm -> target; reachability, front/back order, pressure/shadow and response; is the target depth clear rather than merely a palm touching a silhouette edge? |
| 5. Held props | Owner, hand assignment, count required by the brief, scale and readable shape; a prop held with two hands counts once |
| 6. Background | Active background contract, requested atmosphere and prop budget; unwanted/garbled lettering; empty-sign intent; tangents or lines flowing into bodies/heads/frame |
| 7. Style Lock | Resolved source/brief palette, linework, shadow shapes, tone/texture and value hierarchy; grayscale/flat shading/halo only when part of the active style |
| 8. Brief / prompt fidelity | Compare every prompt sentence and every per-panel Shot Plan line, including technique and assigned must-see evidence: action/effects, expression, outfit, each active Character Lock trait and permitted changes; identity continuity or intended resemblance; label N/A or unconfirmed rather than omitting a clause |
| 9. Unrequested changes | Extra people/objects, costume changes, apparent age/build drift, added body emphasis or anatomical detail; compare against what was actually requested |

Give pass 1 its own table: **Zone | Result | Evidence/notes**. Use ✓ or ✗ for
supported conclusions; use **ยืนยันไม่ได้** instead of either symbol when evidence
is insufficient, and N/A for intentionally absent parts. A mixed row can name
both the observed finding and its unconfirmed subchecks.

## Pass 2: fresh inspection, not confirmation of pass 1

Start again from the uncaptioned image and the sources, without using the first
table as a list of expected errors. Make new count/trace notes before comparing
conclusions. An available independent reviewer may take this pass with only raw
artifacts, not pass 1's suspected errors. When one agent does both, say so rather
than claiming a separate reviewer.

| Independent check | Method |
|---|---|
| Count | Independently count people, visible arms/legs, visible digits, buttons and held/background props. Record occlusion and compare counts only where the brief actually fixes them |
| Trace | Follow every arm from its own shoulder to hand, each major hair mass into its root/silhouette, and each gaze line toward its intended target |
| Reconstruct 3D | For each applicable panel draw a top-down ASCII reconstruction from visible overlap, scale and torso turns; keep separate locations separate. Mark unknown positions instead of inventing them; compare with intended Shot Plan geometry, especially contact/behind versus beside; do not force depth into an intentional flat group |
| Compare sources | Read every panel's Shot Plan line by line and prompt sentence by sentence anew; check layout, insert rules and cross-panel identity/wardrobe/prop continuity; preserve an explicit sentence-to-result ledger for long prompts rather than summarizing only the main action |
| Thumbnail | View/review a small version: do the named technique and panel reading order read; what catches the eye first, does the action read, are tangents, dark masses or clutter competing? Recheck suspected detail at native size |
| Editor | Ask what a strict editor would reject and cite visible evidence; do not convert personal preference or an unobservable worry into a defect |

Give pass 2 its own **Check | Result | Evidence/notes** table. Then compare the
two passes. Log each disagreement, the evidence rechecked and the final reasoned
decision. If a fresh check does not support a first-pass suspicion, withdraw or
downgrade it; do not count the repeated sentence as independent confirmation.

## Severity and the PASS / FIX decision

| Severity | Confirmed examples | Action |
|---|---|---|
| Blocker | Broken anatomy or impossible limb chain; wrong action; merged characters; unintended identity duplication; intentional twins/recurring faces are valid; unintended garbled text; accidental crop removing a protected essential hand or face | FIX; eligible for targeted regen after confirmation |
| Major | Camera/staging does not serve the action; planned technique/layout fails, an insert adds a face or continuity changes the action/identity; planned depth becomes a flat lineup or behind becomes beside; camera differs from plan; contact depth is visibly ambiguous; inconsistent confirmed perspective; protected crop/edge pressure; background loses required setting/atmosphere or exceeds its active budget; identity/style drift; edit outside authorized region | FIX; eligible for targeted regen after confirmation |
| Minor | Small line/seam/rendering detail or non-disruptive tangent that does not change identity, action or the planned read | Report only; no regen |

Regeneration needs a Blocker/Major visible in both passes, or an unambiguous
finding independently rechecked at native resolution. Record the zone, what is
visible and why it affects the brief. An unresolved suspicion is not confirmed
twice merely because both tables say "maybe".

- **PASS:** no confirmed Blocker/Major; report Minor findings and the limits of
  hidden/unresolved non-critical details. This is not certification of unseen fingers.
- **FIX:** at least one confirmed Blocker/Major, or a critical required action
  cannot be assessed. In the latter case request/inspect a better source first;
  uncertainty alone is not a regeneration trigger.
- A genuinely compliant image stops here. Do not regenerate for a minor line,
  hidden digit, a planned blank sign, or requested adult proportions.

Reconstruct staging even when faces and the limb chain look plausible. A flat
lineup does not pass planned depth merely because the palm touches a jacket.
Compare distance cues, body overlap, approximate scale and torso turns, without
claiming an exact depth measurement from a blank background. At adequate
resolution, visibly ambiguous contact depth is an observable Major staging
fault. If resolution itself is inadequate, inspect a better source first.

The compact report is two tables, any disagreement/resolution, then:

```text
Verdict: PASS or FIX — state reviewed stage/scope
Confirmed: severity + zone + visible evidence (or none)
Unconfirmed / N/A: item + reason
Regen: yes/no + evidence-based reason; R0/3, R1/3, R2/3 or R3/3
```

## Error -> targeted prompt change

Preserve the active identity, Style Lock and Background Contract across repairs.
Use the selected source profile, not conflicting default blocks. Identify changed
clauses; explicit user changes can update the active contract. Do not overwrite
approved canonical identity merely to accept drift.

| Error | Smallest useful correction |
|---|---|
| Bad crop / edge pressure | Prefer a clean close chest/upper-waist shot; move required hands/props naturally inside and exclude a low knot entirely, or protect it fully if the chosen crop includes it; do not default to widening the whole body |
| Conflicting camera impressions | Within the affected panel, replace separate per-person camera cues with one height/pitch/horizon and shared ground/depth; specify head/torso turns as poses; preserve actual heights; do not merge intentionally separate C/D cameras |
| Flat lineup / behind becomes beside / unclear depth | Restore the intended depth/action by repairing the top-down Shot Plan first: move one person deeper, partially overlap bodies, apply depth-consistent apparent scale and change torso turns; prefer a closer contact-side view and a short bent acting arm |
| Ambiguous arm / contact | Re-run the single-frame test; name left/right shoulder, elbow, wrist, palm and target; simplify or change the view; if contact and faces cannot coexist, use D with a face-free contact insert instead of twisting bodies |
| Confirmed malformed hand | Simplify wrist/gesture or grip; give a single object a clear owner and hand; keep the hand visible for an essential action; never hide the required contact merely to avoid drawing it |
| Busy background / tangent | Keep the requested atmosphere/location evidence; remove demonstrated clutter or tangents, not required scene detail; respect the active budget |
| Rendering too heavy | Restore the selected reference rendering and remove conflicting defaults; use flat/soft/non-glossy instructions only when that is the chosen profile |
| Wrong panel technique / layout | Choose C for two viewpoints/places or D for detail + main; state panel order, area and one clean divider; retain the required evidence in its assigned panel |
| Panel text / border / continuity fault | Remove unintended text/faces in an insert; restate the no-text/border sentence; correct only the affected panel's identity/hand/prop or separator clause, then recheck all panels |

## Bounded regeneration loop

1. Record confirmed repair targets and a changed-line/reason ledger. Repair the
   top-down Shot Plan and all applicable sanity checks first. Re-run the
   single-frame test; use C/D when required evidence cannot share one natural
   view. For geometric faults, change camera/distance/blocking rather than add
   adjectives. Show revised per-panel plans, top views and layout/projection
   before the corrected English prompt.
2. For an authorized image creation/fix task with a working image tool, generate
   the targeted revision. Do not treat tool availability as permission to expand
   a prompt-only or audit-only task, or to spend through another service.
3. Run the entire two-pass QC on the new pixels, all panels and their continuity.
   Keep the report tied to that specific candidate; a repaired prompt does not
   prove a repaired image.
4. Stop on PASS. Allow at most three additional generations for the source image
   (R1/3, R2/3, R3/3), shared across both skills, all defects and reviewers. Count an issued
   generation attempt even if the tool fails; do not silently reset the budget.
5. If R3/3 still has confirmed Blocker/Major, return FIX with remaining defects,
   the latest candidate and prompt. An exhausted budget is not a pass.

Keep required prompt/QC evidence in chat or one existing handoff. Remove authorized
owned scratch files per [production-workflow.md](production-workflow.md), without
erasing final deliverables or unresolved failure evidence.

Without a usable tool, return the corrected prompt and changed lines/reasons,
state that no new image was verified, and ask the user to return the regenerated
image for the same two-pass process. Minor-only findings do not enter this loop.
