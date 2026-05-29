# Tsukinomi Assets

This folder contains the shipped Tsukinomi assets and the pending image slots for the Sakura Twilight theme.

## Runtime Assets

| Folder | Purpose |
|---|---|
| `audio/music/` | Licensed section music cues used by the Walkman player. |
| `audio/soundscape/` | Licensed ambient loops such as cassette hiss, distant train, and mountain wind. |
| `audio/sfx/` | Walkman button and rewind sound effects. |
| `icons/` | Hand-authored SVG interface marks for the Walkman and tape UI. |
| `textures/` | Local film grain texture used by the Tsukinomi layout. |

## Pending User Image Slots

These image slots are intentionally `pending-user-image` until the user supplies or approves the real visual assets. The current runtime uses CSS fallback backgrounds and does not request these paths.

| Slot | Planned base path | Status |
|---|---|---|
| `hero-station` | `/assets/tsukinomi/images/hero-station` | pending-user-image |
| `section-01` | `/assets/tsukinomi/images/backgrounds/section-01` | pending-user-image |
| `section-02` | `/assets/tsukinomi/images/backgrounds/section-02` | pending-user-image |
| `section-03` | `/assets/tsukinomi/images/backgrounds/section-03` | pending-user-image |
| `section-04` | `/assets/tsukinomi/images/backgrounds/section-04` | pending-user-image |
| `section-05` | `/assets/tsukinomi/images/backgrounds/section-05` | pending-user-image |

Source and license details for audio are recorded in `audio/SOURCES.md`. Root-level asset accounting lives in `assets-manifest.md`.
