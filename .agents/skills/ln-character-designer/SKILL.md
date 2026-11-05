---
name: ln-character-designer
description: Use when designing light novel characters from text, reusing or revising a referenced character, continuing a character draft, creating portraits or expression sets, or diagnosing character identity and style drift.
metadata:
  version: "5.0"
---

# LN Character Designer

Design from zero when requested; preserve a supplied character when the task is
reuse or revision. Face DNA records identity and supports continuity across a
novel. Reply in the user's language; write image prompts in English.

## Read for the task

- Start with [production-workflow.md](references/production-workflow.md) for
  source priority, draft/reuse/edit modes, active locks and file closeout.
- Read [face-dna.md](references/face-dna.md) to design or record identity.
- Read [style-lock.md](references/style-lock.md) to resolve the actual style.
- Use [interview.md](references/interview.md) only for consequential missing facts.
- For a review target or generated candidate, read
  [qc-checklist.md](references/qc-checklist.md); [diagnosis.md](references/diagnosis.md)
  maps observed character faults to targeted repairs.

## 1. Resolve the brief and references

Inspect local images before using them. Record each role and requested change.
Without a narrower user role, a character reference supplies both visible
identity and style. Reuse approved sources; do not replace a primary face or
outfit with an unrelated style/hairstyle reference.

Choose from-zero, reuse, targeted edit, draft continuation or review.
Ask only for missing information that changes the result and cannot be inferred.
When choices are delegated, state reasonable assumptions and continue. Do not
run a fixed three-round interview after a useful visual brief has been supplied.

For a local edit, identify what changes and what remains. For a draft, identify
the requested stage/region; preserve camera, pose and established features.
Do not complete or redesign untouched regions merely to satisfy a template.

## 2. Record or design Face DNA

For a reference, describe observed face shape, eyes/brows, nose/mouth, hair
silhouette, distinguishing details and age/build. Unseen features remain unknown.
Do not add a mole, asymmetry, new hairstyle or altered eyes to make the face unique.

For a new design, concrete traits can avoid an unwanted generic result.
Compare distinctness when the brief needs different characters; the three-axis
idea is an optional design aid, not a threshold. Twins, related faces, recurring
characters and a shared drawing convention may intentionally resemble one another.

## 3. Prepare the active Character Lock

Write a compact concrete paragraph. About 40-60 words is a useful starting point,
not a limit that permits dropping identity details. Preserve given height/build
information in the spec; translate to readable visual instructions as useful.

Keep stable identity sentences separate from scene wardrobe, expression and pose.
Retain the supplied outfit unless changed by the brief. If a new costume or
expression is requested, assemble a consistent active Lock and identify the
override without changing approved canon. Do not rewrite identity to excuse drift.

## 4. Compose and deliver the requested result

For a portrait: active Style Lock + active Character Lock + pose/expression/
framing + active Background Contract + compatible constraints. Use a plain/tone
background for a simple portrait when no background is specified; an atmospheric
or referenced setting follows its own budget.

Use ln-scene-composer when available for scene/panel staging; do not duplicate a
portrait and a scene prompt unless both are requested. Scene work shows its
five-to-seven-line Shot Plan before the prompt. Standalone portraits still name
distance, view, headroom and required hands/props.

For prompt/design-only requests, return text. For an explicit create/edit request,
use the available imagegen workflow and pass inspected references when supported.
Tool unavailability is a limitation to report, not permission to use another paid
service. Do not promise continuity from text instructions alone.

Keep output proportional: brief spec, reusable Lock when useful/requested, and
one ready-to-use prompt or generated result. Offer expression swaps or variants
when requested or useful; do not append them mechanically to a targeted edit.

## 5. Review, repair and close

Before praising a produced image or declaring it usable, complete both QC passes
in [qc-checklist.md](references/qc-checklist.md). Compare reference identity and
linework alongside the requested expression/pose/stage.

Use [diagnosis.md](references/diagnosis.md) to fix execution before redesigning.
A requested cosmetic edit can be performed without inventing a Major fault;
the Minor-only rule governs unsolicited automatic QC retries.
For authorized generation, repair confirmed Blocker/Major only, at most three
additional attempts per source across both skills. Recheck both passes each time;
stop on PASS or report FIX at the cap. Minor-only findings do not trigger regen.

Keep plans/review notes in chat by default; follow the production workflow's
owned-scratch cleanup and concise handoff rather than leaving document stacks.

## Age, proportions and fidelity

- Keep school-age characters age-appropriate and non-sexualized; do not add
  anatomy/body emphasis absent from the brief.
- Preserve an adult's requested build/outfit; do not silently shrink, enlarge or
  age-shift a character to fit an aesthetic default. Measurements supplied by
  the user are requirements, not values that can be certified from pixels.
- Preserve reference palette; describe grayscale tones only for a monochrome job.
- A requested same face, line convention or resemblance is not a QC failure.
