# Tsukinomi — Background Image Brief (gen prompts)

These are the **6 background images** the site is waiting on (the `pending-user-image` slots
in `src/data/tsukinomi/background-slots.ts`). They are *backgrounds* — they sit far behind the
prose at low opacity under the sakura-twilight gradient, so keep them moody and uncluttered, with
calm/dark areas where text will sit. (In-content chapter illustrations are **not** part of this list.)

## Global style (paste into every prompt)

> painterly, cinematic, melancholic mono-no-aware mood; **sakura-twilight palette** — deep indigo
> night `#0E0B1E`, twilight violet `#171430`, soft sakura pink `#E6A6BD`, warm lamp amber `#E0A36A`,
> pale moon `#E8EDF5`, cool mist `#CDD3E0`; **no people, no text, no watermark, no logos**; soft
> focus, low contrast, gentle film grain; composition leaves a calm darker center for overlaid text.

Aspect **16:9** for all. Target sizes: hero `2400×1350`, sections `1920×1080`.

## Slots & prompts

| Slot | File base (drop here) |
|---|---|
| hero-station | `public/assets/tsukinomi/images/hero-station` |
| section-01 | `public/assets/tsukinomi/images/backgrounds/section-01` |
| section-02 | `public/assets/tsukinomi/images/backgrounds/section-02` |
| section-03 | `public/assets/tsukinomi/images/backgrounds/section-03` |
| section-04 | `public/assets/tsukinomi/images/backgrounds/section-04` |
| section-05 | `public/assets/tsukinomi/images/backgrounds/section-05` |

**hero-station** (home)
> An abandoned rural Japanese mountain railway station at deep twilight; empty platform, a faded
> wooden station sign, a pale moon behind thin mist, distant indigo mountains, a few sakura petals
> drifting, one faint warm lamp. Wide establishing shot, quiet and lonely. [+ global style]

**section-01 — rainy autumn approach** (§1, warm)
> A quiet uphill path toward an old hillside station in light autumn rain; wet fallen leaves and a
> few sakura petals, warm amber light glowing against indigo dusk, soft mist. Gentle, lonely. [+ global style]

**section-02 — foggy twilight reveal** (§2, cooler)
> A foggy rural valley at violet twilight; layered misty ridgelines, a faint old railway crossing,
> a thin band of fading amber at the horizon, petals turning to first cold flecks. Wistful, uneasy. [+ global style]

**section-03 — warm interior memory** (§3, warmest)
> Inside a small old Japanese home at night; warm lamp glow on tatami and a low table, indigo
> darkness through the window, a small blurred cassette player on the table. Intimate, tender, safe. [+ global style]

**section-04 — moonlit night ascent** (§4, darkest)
> A dark forested mountainside at night under a pale moon; snow beginning to fall through tall cedar
> trees, deep indigo and cold blue, a single faint distant light. Solemn, cold, the heaviest mood. [+ global style]

**section-05 — pale winter return** (§5, bittersweet)
> An empty rural platform in pale winter dawn; light snow, a lone weathered wooden sign where a
> station once stood, soft grey-blue and cream light with a faint warm sunrise. Still, bittersweet, hopeful. [+ global style]

## After you generate

1. Drop each image (PNG/JPG/WebP) at its file base above.
2. Tell me — I can add a `sharp` pipeline (`src/scripts/tsukinomi/process-images.ts`) to emit
   `.avif` + `.webp` + `.jpg` at the right sizes with the per-section tint, then flip each slot's
   `status` to `ready` and the background appears automatically (the procedural gradient is the
   fallback until then).
3. Record source + license for each in `assets-manifest.md`.

> Optional extras (not required by the layout): a Tsukinomi-specific OG share image — the
> `hero-station` render can double as this.
