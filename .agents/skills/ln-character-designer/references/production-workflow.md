# Production workflow: references, stages and closeout

Use this contract in both character design and scene composition. Resolve the
requested result before choosing an aesthetic or producing documents.

## Source decisions

1. The current user brief defines the requested change and any delegated choices.
2. Inspect supplied images. Unless the user assigns a narrower role, a character
   reference supplies its visible identity, linework, rendering and palette.
   Do not require a special phrase to preserve the supplied style.
3. Respect explicit roles: identity-only, style-only, hairstyle-only, layout draft,
   edit target or approved result. A secondary hair reference does not replace a
   primary face/outfit. A composition reference does not import its cast.
4. Use approved project sources for continuity where the brief does not replace
   them. If competing sources leave a consequential identity/style choice unclear,
   ask one focused question; otherwise state the conservative choice and proceed.
5. Use the default light novel style only for text-only/from-zero work without a
   selected visual style. A user can explicitly request it over a reference.

State a compact source map in chat when useful: identity / style / layout /
background / requested change. Distinguish observed traits, user instructions
and proposed additions. Do not create a separate source-map document by default.

## Choose the working mode

| Mode | Preserve | Work to perform |
|---|---|---|
| From zero / text only | Specified traits and story needs | Design missing features; diversity is useful when the brief calls for it |
| Reuse a character | Reference identity, age/build and distinguishing details; outfit/style unless changed | Carry the same person into new framing, lighting, expression or action |
| Targeted redesign / edit | Everything outside the requested change | Change the named feature; keep a clear changed/retained boundary |
| Continue a draft | Intended pose, camera, layout and established design | Complete only the requested stage/region; do not redesign to satisfy defaults |
| Review | The actual brief, sources and requested stage | Diagnose evidence; an audit alone does not authorize generation |

For draft work, resolve layout / line cleanup / rendering / final as needed.
A rough hand omitted from a layout sketch is not automatically a final-image
anatomy fault. If the sketch leaves a required action unreadable, report that
specific uncertainty. Declare scope, e.g. "PASS for layout; final anatomy and
finish not assessed." Do not present draft acceptance as final approval.

## Active locks and visual inputs

Record a Character Lock from references rather than inventing features.
Keep identity sentences stable. Build one active version for the current task:
use requested wardrobe/expression changes without also issuing contradictory
old costume/pose instructions. Label those changes; do not overwrite approved
project canon unless asked. Word-count targets serve clarity, not fidelity loss.

Resolve one active Style Lock and Background Contract for the task, using the
reference/brief first. Reuse those exact resolved blocks across its candidates
and panels. Keep the provided default blocks available; do not paste a default
that contradicts the selected source. A later user change creates an explicit
new contract, not a defect to regenerate away.

For identity-preserving generation/editing, pass the inspected references to
the image tool when supported; a text summary alone loses visual information.
If the tool cannot consume them, state that fidelity ceiling and provide the
best available prompt/edit path without pretending reference transfer happened.
Use an edit workflow for local changes when available. Do not claim a face or
line style was preserved until the result has been compared with its source.

## Documents and scratch files

Default to decisions, Shot Plans and QC in the conversation. The skills'
required review steps do not require separate Markdown files.

- Keep requested final assets, reusable locks when requested, and any existing
  project records the task needs. Add the final prompt/QC to an existing suitable
  delivery record; otherwise use at most one compact handoff note if persistence
  is needed. A text-only answer usually needs no new file.
- Do not create separate design/spec/plan/progress/QC/change-log documents for
  each step. Keep detailed working ledgers in memory or one run scratch area.
- Before scratch writes, know the run directory and exact files this run owns.
  Use a dedicated temporary directory outside source and published assets.
- At closeout, remove task-owned disposable plans, crops, schematic exports,
  probes and validation intermediates when cleanup is authorized. Check resolved
  paths stay within that run directory; enumerate owned paths rather than using
  broad age/extension globs. Verify removal before saying it was cleaned.
- Cleanup authorization does not extend to user references, approved assets,
  canonical locks, other tasks' files, previous deliverables or linked evidence.
  Do not delete or move these without the required explicit scope/approval.
  Honor the host's filesystem approval rules; this skill grants no permission.
- Keep a latest failed candidate plus its prompt/important QC when the retry cap
  is reached. Do not erase unresolved failure evidence to make closeout look clean.
- Do not create an archive copy of every intermediate by default. If deletion is
  not authorized, leave it untouched and report the specific remaining paths.

Finish with final artifact links, verdict/proof limits, and a brief factual
closeout: kept / removed / remaining, only where applicable. After a handoff
exists, update it rather than producing another summary beside it.
