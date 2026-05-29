# Tsukinomi Atmosphere — "จัดเต็ม" story-woven design

> Date: 2026-05-30 · Status: approved (verbal) · Component: `src/components/tsukinomi/atmosphere/SakuraTwilightBackdrop.astro`
> Goal: make the atmosphere *special* and emotionally tied to the story, without breaking the quiet mono-no-aware mood. Keep the existing **sakura-twilight** theme + palette.

## Core idea

One canvas particle engine + CSS layers that read the current section (`document.body.dataset.section` / `data-palette`, already set by `TsukinomiBaseLayout`) and switch an **atmosphere profile** per section. No multiple canvases. Profiles change: particle *kind* + density, distant-train light on/off + intensity, and light/tint emphasis.

## Per-section arc (petal → snow is encoded here)

| Section | palette | particle kind | density (desktop/mobile) | distant train | note |
|---|---|---|---|---|---|
| §1 Walkman & Rain | autumn | petals + faint diagonal rain | 34 / 20 | **arrives-then-fades** (she still waits) | warm amber |
| §2 What She Remembers | twilight | thinning petals + first cold flecks | 26 / 16 | dimmer, farther | twilight violet |
| §3 The Decision | warm-room | **none** (intimate indoor) | 0 / 0 | off | warm lamp glow only |
| §4 The Mountain | snow-pact | **ash/snow**, sparse | 18 / 12 | off (the waiting ends) | darkest night |
| §5 Ten Years | winter-light | soft snow | 26 / 16 | **returns once, then gone for good** | pale bittersweet dawn |
| home | (autumn) | petals | 34 / 20 | slow single pass | inviting best-of + moon |

## Two signature motifs

1. **Distant train that never comes** — a soft low-horizon glow that slowly brightens and swells (approaching), then fades before reaching the platform. Long irregular cycle (~25–40s), low opacity. CSS-driven layer (`.sakura-backdrop__train`) toggled by profile via a `data-train` state on the backdrop root. Emotional core: Kaori waits for a train that won't arrive.
2. **Petal → snow morph** — canvas particles gain a `kind`: `petal` (5-lobe sakura, pink `--sakura`), `rain` (thin streak), `ash` (small grey, slow), `snow` (round pale, drift). Section profile picks the kind(s), so reading deeper *feels* like the season passing.

## Depth / craft

- **Parallax**: particles + mist drift slightly with scroll (small translate factor) for depth.
- **Petal flutter**: petals oscillate `scaleX` as they fall (tumble), not just rotate.
- **Light breath**: existing moon flicker kept; add a faint lamp/god-ray gradient that breathes slowly.
- Keep existing moon + faint clock (subtle). Vignette frame kept.

## Guardrails (non-negotiable)

- `prefers-reduced-motion: reduce` → all particles + train + breathing off; static gradient only.
- Mobile (≤640px): reduced densities (table above), reduced parallax, simpler train.
- One `<canvas>`; capped particle counts; pause on `document.hidden` and `astro:after-swap` re-init (already present).
- Reader-column protection (petals don't draw over `article.tsukinomi-section`) — keep.
- Theme `sakura-twilight` + `tokens.css` palette unchanged.
- `src/scripts/tsukinomi/atmosphere-contract.test.ts` stays green; extend it to lock the new invariants (profiles, particle kinds, train motif, reduce-motion).

## Implementation surface

- `SakuraTwilightBackdrop.astro` — main rewrite (script: profile map keyed by section/palette; particle `kind`; train state; parallax; flutter). Add `.sakura-backdrop__train` layer + styles.
- `atmosphere-contract.test.ts` — extend assertions (TDD: write first, watch fail, implement).
- (incidental) `WalkmanPlayer.astro` — fix closed-panel a11y: toggle `inert` when `data-open="false"`.

## Out of scope

No new deps. No per-section background photos (P6 still user-deferred). No audio changes.
