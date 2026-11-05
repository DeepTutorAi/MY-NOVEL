# Project Agent Guidance

This repository contains the Piichan Novels website and story planning material.
Use the relevant story's current sources and the user's brief when preparing art.

## Illustration skills

Project skills are installed in `.agents/skills/`:

- For character designs, portraits, expression sets, or a reusable Character Lock,
  read `.agents/skills/ln-character-designer/SKILL.md` and its relevant references.
- For scene illustrations, character placement, or quieter backgrounds, read
  `.agents/skills/ln-scene-composer/SKILL.md` and its relevant references.
- For an image featuring an established character, reuse the existing Character
  Lock and approved visual references. Ask only for missing details that affect
  the requested result; skip questions already answered by the brief or sources.

## Image generation

The imported skills prepare prompts. For requests to create, generate, or edit an
image, also load the available `imagegen` skill and use the built-in `image_gen`
tool. Their prompt-only default does not override an explicit image request.
For requests for a prompt or design specification only, return text.

- Resolve identity, style and background from the current brief and scoped
  visual references before using skill defaults. Unless assigned a narrower
  role, preserve the supplied character's visible identity, linework, rendering
  and palette. Use default monochrome only without another selected style.
- Preserve draft framing and untouched regions for local edits. Keep Shot Plans
  and QC in chat by default; follow the skills' production workflow for one
  concise handoff and authorized cleanup of owned scratch files.
- Inspect local reference or edit-target images before using them. Clearly
  distinguish references from the image being edited.
- Use the built-in image tool without adding API keys, packages, or services.
  If it is unavailable or fails, report that limitation. Use a CLI or paid API
  fallback only when the user explicitly requests or approves that route.
- Save project-bound images inside the workspace. Follow the user's destination;
  for website assets, use the relevant `public/assets/<story>/images/` directory.
  Preserve existing assets with a new filename unless replacement was requested.
- Inspect generated output for character identity, composition, background
  density, and requested style. Show the result and report its saved path.
- Treat new designs as proposals until approved. Update story canon, published
  asset references, or deployment only when the task calls for those changes.
