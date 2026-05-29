# Assets Manifest

## Visual And Metadata Assets

These are generated or hand-authored, project-owned assets. They are license-safe for local preview and deployment; replace only if the author wants photographic art direction later.

| File | Source | License | Attribution | Status |
|---|---|---|---|---|
| `public/assets/lodge/images/hero-forest.avif` | Generated locally as procedural dark winter forest art; source URL: n/a | Project-owned generated asset | None | Final generated background |
| `public/assets/lodge/images/hero-forest.webp` | Generated locally as procedural dark winter forest art; source URL: n/a | Project-owned generated asset | None | Final generated background |
| `public/assets/lodge/images/hero-forest.jpg` | Generated locally as procedural dark winter forest art; source URL: n/a | Project-owned generated asset | None | Final generated background |
| `public/assets/lodge/images/backgrounds/home-lodge-approach.avif` | Temporary copy of `hero-forest`; replace from prompt bank | Project-owned generated placeholder | None | Home background slot |
| `public/assets/lodge/images/backgrounds/home-lodge-approach.webp` | Temporary copy of `hero-forest`; replace from prompt bank | Project-owned generated placeholder | None | Home background slot |
| `public/assets/lodge/images/backgrounds/home-lodge-approach.jpg` | Temporary copy of `hero-forest`; replace from prompt bank | Project-owned generated placeholder | None | Home background slot |
| `public/assets/_shared/grain.png` | Generated locally with FFmpeg noise filter; source URL: n/a | Project-owned generated texture | None | Final generated texture |
| `public/assets/tsukinomi/textures/film-grain.png` | Generated locally with `src/scripts/tsukinomi/generate-grain.ts` using FFmpeg color/noise filters; source URL: n/a | Project-owned generated texture | None | Final Tsukinomi film grain texture |
| `public/assets/tsukinomi/icons/walkman.svg` | Hand-authored inline SVG; source URL: n/a | Project-owned generated asset | None | Phase 4 Walkman corner mark |
| `public/assets/tsukinomi/icons/tape-divider.svg` | Hand-authored inline SVG; source URL: n/a | Project-owned generated asset | None | Phase 4 tape divider mark |
| `public/assets/tsukinomi/icons/cassette-mark.svg` | Hand-authored inline SVG; source URL: n/a | Project-owned generated asset | None | Phase 4 cassette UI mark |
| `public/og.jpg` | Generated locally from the procedural forest frame with title overlay; source URL: n/a | Project-owned generated asset | None | Open Graph image |
| `public/favicon.png` | Generated locally from the candle mark; source URL: n/a | Project-owned generated asset | None | PNG favicon fallback |
| `public/favicon.svg` | Hand-authored inline SVG candle mark; source URL: n/a | Project-owned generated asset | None | Primary favicon |
| `public/favicon-out.svg` | Hand-authored inline SVG candle-out mark; source URL: n/a | Project-owned generated asset | None | Rare favicon flicker frame |
| `public/humans.txt` | Hand-authored project note; source URL: n/a | Project-owned text asset | None | Human-readable credits |
| `public/robots.txt` | Hand-authored robots policy; source URL: n/a | Project-owned text asset | None | Search crawler policy |
| `public/assets/README.md` | Hand-authored project asset guide | Project-owned text | None | Asset folder map |
| `public/assets/lodge/prompts/hvitveldt-image-prompts.md` | Hand-authored prompt bank | Project-owned text | None | Copy-ready image prompts |
| `public/assets/lodge/prompts/hvitveldt-music-cue-plan.md` | Hand-authored cue plan | Project-owned text | None | Copy-ready music prompts |
| `public/assets/lodge/prompts/claude-hvitveldt-quality-guard.md` | Hand-authored Claude guardrail prompt | Project-owned text | None | Content QA and workflow prompt |

Fonts are self-hosted through the `@fontsource` packages listed in `package.json`.

## Placeholder Audio

These are 30-second silent test tracks generated locally for Phase 5. They keep the audio system verifiable without shipping unlicensed music. Replace with licensed ambience when final sound design is chosen.

| File | Source | License | Attribution | Status |
|---|---|---|---|---|
| `public/assets/lodge/audio/ambient-act1.mp3` | Generated locally with FFmpeg `anullsrc`; source URL: n/a | Project-owned silent placeholder | None | TODO: replace with Act 1 wind/calm ambient |
| `public/assets/lodge/audio/ambient-act1.ogg` | Generated locally with FFmpeg `anullsrc`; source URL: n/a | Project-owned silent placeholder | None | TODO: replace with Act 1 wind/calm ambient |
| `public/assets/lodge/audio/ambient-act2.mp3` | Generated locally with FFmpeg `anullsrc`; source URL: n/a | Project-owned silent placeholder | None | TODO: replace with Act 2 distant creak ambient |
| `public/assets/lodge/audio/ambient-act2.ogg` | Generated locally with FFmpeg `anullsrc`; source URL: n/a | Project-owned silent placeholder | None | TODO: replace with Act 2 distant creak ambient |
| `public/assets/lodge/audio/ambient-act3.mp3` | Generated locally with FFmpeg `anullsrc`; source URL: n/a | Project-owned silent placeholder | None | TODO: replace with Act 3 low drone ambient |
| `public/assets/lodge/audio/ambient-act3.ogg` | Generated locally with FFmpeg `anullsrc`; source URL: n/a | Project-owned silent placeholder | None | TODO: replace with Act 3 low drone ambient |
| `public/assets/lodge/audio/ambient-act4.mp3` | Generated locally with FFmpeg `anullsrc`; source URL: n/a | Project-owned silent placeholder | None | TODO: replace with Act 4 silence/heartbeat ambient |
| `public/assets/lodge/audio/ambient-act4.ogg` | Generated locally with FFmpeg `anullsrc`; source URL: n/a | Project-owned silent placeholder | None | TODO: replace with Act 4 silence/heartbeat ambient |

The current player uses the cue-based files below. They are temporary silent copies until licensed music is selected.

| File | Source | License | Attribution | Status |
|---|---|---|---|---|
| `public/assets/lodge/audio/music/snow-forest.mp3` / `.ogg` | Temporary silent placeholder | Project-owned silent placeholder | None | Replace with Snow Forest cue |
| `public/assets/lodge/audio/music/gloomy-night.mp3` / `.ogg` | Temporary silent placeholder | Project-owned silent placeholder | None | Replace with Gloomy Night cue |
| `public/assets/lodge/audio/music/mystery.mp3` / `.ogg` | Temporary silent placeholder | Project-owned silent placeholder | None | Replace with Mystery cue |
| `public/assets/lodge/audio/music/eerie-tension.mp3` / `.ogg` | Temporary silent placeholder | Project-owned silent placeholder | None | Replace with Eerie Tension cue |
| `public/assets/lodge/audio/music/dark-nightmare.mp3` / `.ogg` | Temporary silent placeholder | Project-owned silent placeholder | None | Replace with Dark Nightmare cue |
| `public/assets/lodge/audio/music/after-climax-quiet.mp3` / `.ogg` | Temporary silent placeholder | Project-owned silent placeholder | None | Replace with After Climax Quiet cue |
| `public/assets/lodge/audio/music/mirror-haunting.mp3` / `.ogg` | Temporary silent placeholder | Project-owned silent placeholder | None | Replace with Mirror Haunting cue |
