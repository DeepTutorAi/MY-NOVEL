# Panel layouts and the single-frame test

Use with [camera-catalog.md](camera-catalog.md) and
[camera-and-staging.md](camera-and-staging.md) when C or D is selected.

## Single-frame test before choosing the camera

Name the beat and the must-see evidence: essential faces, the contact/held
object, and the arm path needed to understand it. Ask:

> Can one camera show the essential contact/detail and important faces clearly,
> without twisting anatomy or assigning contradictory views?

If yes, choose the relevant single-frame technique and run the 3D sanity gate.
If no, use **D** for detail + reaction/context, or **C** for two viewpoints or
locations. Reassign evidence explicitly: e.g. "P1 proves palm-on-back contact;
P2 shows both reactions." Do not force P2 to reveal a surface that faces away
just because it mattered in P1. Every required detail has a visible home.

This is a planning test, not rendered QC. A user who explicitly requests one
unbroken frame needs a feasible revised pose/view; explain if that constraint
cannot show all requested evidence, rather than silently adding panels.

## Shared layout contract

- Default to two panels; never exceed three. C is specifically two views with
  one diagonal divider. D may use two face-free inserts plus one main when a
  distinct requested detail needs the third panel; specify all sizes and two
  separator bars. Do not add a panel to fill empty space.
- State the canvas ratio, reading order, panel positions and approximate sizes.
  Panel areas plus borders/gutters fit the canvas; define whether a percentage
  excludes the separator.
- Use one thin straight black divider for C, or a black separator bar for D.
  No overlapping frame-within-frame clutter. Tell the user before the prompt
  that image models may make panel borders imprecise and QC will check them.
- Each panel has its own five-to-seven-line Shot Plan, catalog distance/angles,
  camera/3D plan where applicable, Background Level and **verbatim active Background Contract**.
  active Style Lock applies unchanged to the whole illustration.
- Repeat each active Character Lock verbatim inside every panel containing that
  character, even when only their hand, shoulder or clothing is visible.
  State the visible portion separately; a full Lock is not a demand for a face.
- One camera and perspective system applies **per panel**. Across C panels in
  different places, do not force a common horizon, overlap or matching scale.
  Within a shared-space panel, preserve its intended depth or shared-plane
  composition rather than imposing a fixed depth-cue count. A clean OTS with one visible person or a detail-only insert marks
  cross-person staging cues N/A, without inventing a second visible body.
- An insert shows only hands, an object or the contact surface: **no faces**,
  including reflections or tiny background faces.
- Keep identity, apparent age/build, costume seams, left/right hand ownership,
  prop design and the action moment consistent across views of the same event.
  State deliberately different times/places instead of implying continuity.
- Include exactly: "no text, no speech bubbles, panel borders are straight and do not overlap".
  Labels such as P1/P2 are prompt organization, not lettering to draw.

## C. Diagonal Split

Use for separate places or two opposed views of an event. Specify the diagonal's
endpoints and the regions on each side. For example:

```text
Portrait canvas 2:3. One thin straight diagonal runs from the left edge at
45 percent of image height to the right edge at 60 percent.
P1 occupies the upper region; P2 occupies the lower region.
Each region is a separate view, not a shared physical plane.
```

Choose a catalog camera and distance for each region. A border's slope is a
layout line, not Dutch tilt: both scene horizons can remain level. Keep faces
and required hands readable around the divider. Preserve a source's deliberate
silhouette crossing when continuing/editing that layout; keep ownership and
reading order clear. For a new layout, clean separation is a useful default.

For two locations, each person's gaze targets something in their own space,
not the other person's eyes across the divider. For a two-view reaction pair,
name the same instant and preserve the participants' positions in world space.

## D. Insert + Main

Default to stacked panels: a top insert about one third of the usable height,
a main panel below about two thirds, separated by a specified black bar.
A small side insert is possible only with its size and location stated clearly.

The insert uses **Close-up (detail)** with a catalog angle, has no faces and a
very quiet background. Show the whole essential hand/object/contact; a wrist
may continue beyond the detail crop, but do not cut at the wrist joint or through
the required hand. Logical off-panel arm continuation is not a detached limb.
The main panel normally uses A for two people, B for a speaking focal face, or
F for a single person. Give it a simpler facial/anatomical job.

For same-event views, preserve the action's left/right side, receiving shoulder,
palm orientation, clothing and prop silhouette. Camera-relative screen-left
may reverse; anatomical left/right does not.

## Prompt assembly for multiple panels

One English block, with the following order:

1. Verbatim active Style Lock and the whole-canvas layout/reading-order description.
2. The exact no-text/border sentence above.
3. P1: catalog technique, distance/angles, camera, crop, staging, action, repeated
   Character Locks for every visible owner, Background Level, verbatim active Background Contract.
4. P2 (and P3 only when justified): the same complete panel-specific fields.
5. A short compatible avoid/constraint line for the active style at the end;
   use DEFAULT AVOID LINE only when the default profile is selected.

These excerpts demonstrate **scene clauses**, not complete copy-paste prompts.
Expand all panel Character/Background Contracts using the assembly contract.

## Golden back-slap examples

These quiet scene clauses illustrate defaults, not a style/background override
for supplied references. Use the resolved active contracts for the actual job.

**Option 1: A, one frame.** Recommend when the single-frame test passes.
Use Bust-up + Eye-level + 3/4 view; orient the recipient's torso to expose the
near upper-back edge without an excessive head turn. A radio is not automatic;
if the brief requests it, assign both holding hands and test its visibility too.

```text
A character-focused scene with a very simple background, layered depth staging.
Bust Up, Eye Level, 3/4 View from the boy's front-left reference position,
level horizon. His torso turns partly away to expose the camera-side upper-back
edge; his head turns only enough for a readable startled profile/three-quarter
face, wide eyes, open mouth and one sweat drop. One step behind, the girl is
farther from the camera, about 80 percent apparent scale, partly overlapped by
his near shoulder, laughing, her torso facing his back. Her near right shoulder,
short bent elbow and neutral wrist lead to an open palm on his upper back near
the right third. Keep the receiving back patch, the acting hand and both
important faces crisp and unblocked. Her non-acting torso is slightly softer.
Not a side-by-side lineup, not a flat profile view.
Each hand has five fingers; no other limb crosses in front of the bodies.
Plain tone background; no held props unless the brief requires them.
```

**Option 2: D, two stacked panels.** Use when contact, both expressions and a
requested radio grip cannot all be read comfortably from one camera.

```text
One landscape 3:2 illustration divided into two stacked panels by one black bar.
The top panel is one third and the bottom panel two thirds of the usable height.
No text, no speech bubbles, panel borders are straight and do not overlap.
Top: Close Up detail, Eye Level + Side View of the girl's anatomical right
open palm landing on the boy's right shoulder-blade area of a dark jacket,
small impact burst and coherent contact shadow, no faces.
Bottom: Layered Depth Staging, Bust Up, Eye Level + 3/4 View of the boy's front.
He reacts with wide startled eyes, open mouth and a sweat drop, holding one
small portable radio against his chest with both hands if requested in the brief.
The girl stands one step deeper, about 80 percent apparent scale, her
non-acting torso partly hidden by his shoulder, laughing. Her acting right arm
continues toward the same back contact established in the insert; the main
camera need not see the rear contact surface again. Keep important faces and
the radio grip clear, with a plain tone background in each panel.
```

The two-panel option trades a harder all-in-one pose for panel-border and
continuity work. It does not waive hand anatomy, contact or the two-pass QC.
