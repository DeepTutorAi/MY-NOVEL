# Tsukinomi Assets

This folder contains the shipped Tsukinomi assets for the Sakura Twilight theme.

## Runtime Assets

| Folder | Purpose |
|---|---|
| `audio/music/` | Licensed section music cues used by the Walkman player. |
| `audio/soundscape/` | Licensed ambient loops such as cassette hiss, distant train, and mountain wind. |
| `audio/sfx/` | Walkman button and rewind sound effects. |
| `icons/` | Hand-authored SVG interface marks for the Walkman and tape UI. |
| `textures/` | Local film grain texture used by the Tsukinomi layout. |
| `images/illustrations/` | In-content light-novel illustrations placed at canonical story beats. |
| `images/extra/` | AI-generated/AI-assisted farewell and post-reading bonus illustrations; provenance is recorded in the root asset manifest. |

## Authored Image Slots

These image slots contain the approved author-generated artwork. The runtime keeps CSS fallbacks in case an encoded format cannot be loaded.

| Slot | Planned base path | Status |
|---|---|---|
| `hero-station` | `/assets/tsukinomi/images/hero-station` | ready |
| `section-01` | `/assets/tsukinomi/images/backgrounds/section-01` | ready |
| `section-02` | `/assets/tsukinomi/images/backgrounds/section-02` | ready |
| `section-03` | `/assets/tsukinomi/images/backgrounds/section-03` | ready |
| `section-04` | `/assets/tsukinomi/images/backgrounds/section-04` | ready |
| `section-05` | `/assets/tsukinomi/images/backgrounds/section-05` | ready |

## Narrative Illustration Slots

These portrait illustrations are wired into the corresponding section markdown after the
scene beat they depict. They use a shared grayscale light-novel grammar while letting each
scene carry its own composition and emotional focus.

| Slot | File | Story beat | Status |
|---|---|---|---|
| `first-meeting` | `images/illustrations/section-01-first-meeting.png` | Haruto first sees Kaori seated normally on the middle of the station's canonical three bench rows. | ready |
| `rooftop-research` | `images/illustrations/section-02-rooftop-research.png` | Akira gives Haruto the 1991 research note on the school rooftop. | ready |
| `family-table` | `images/illustrations/section-03-family-table.png` | Haruto, Naomi, and Hina share the truth beside the family table. | ready |
| `mountain-exchange` | `images/illustrations/section-04-mountain-exchange.png` | Haruto offers the father's cassette to Yamaba on the mountain. | ready |
| `ten-years-reunion` | `images/illustrations/section-05-ten-years-reunion-hina-long-hair.png` | Adult Haruto returns to Hakuba and meets Hina at the station; Hina's hair length is corrected to the approved character direction. | ready |

The expanded narrative illustration set is wired to specific chapter beats in the section
drafts. Superseded render variants remain in the workspace as rollback copies but are not
referenced by the draft or this table.

| Slot | File | Story beat | Status |
|---|---|---|---|
| `shared-earphone` | `images/illustrations/section-01-shared-earphone.png` | Haruto and Kaori share one earbud on the middle bench of the canonical station layout. | ready |
| `empty-station` | `images/illustrations/chapter-03-empty-station.png` | The same three station benches stand empty while wet footprints stop before them. | ready |
| `microfilm-research` | `images/illustrations/chapter-06-microfilm-research-akira-screen.png` | Akira stops the reel while both boys read a display hidden from the illustration viewer. | ready |
| `shared-song` | `images/illustrations/chapter-08-shared-song-akira-canonical.png` | Kaori and Haruto listen on the middle bench while Akira supports them from the back row. | ready |
| `river-confession` | `images/illustrations/chapter-09-river-confession.png` | Hina describes the waiting girl beneath the old bridge. | ready |
| `abandoned-village` | `images/illustrations/chapter-11-abandoned-village.png` | Haruto studies the 1979 Mizushima family photograph from a close first-person viewpoint; the parents' faces remain obscured. | ready |
| `first-frost` | `images/illustrations/chapter-16-first-frost-no-reflection.png` | Haruto holds the Walkman by the frosted window without a human reflection. | ready |
| `sketchbook` | `images/illustrations/chapter-17-sketchbook.png` | Hina gives Haruto the sketchbook before his departure for Tokyo. | ready |
| `family-breakfast` | `images/illustrations/section-01-family-breakfast-hina-headlock.png` | Hina playfully hooks her arms around a startled Haruto during breakfast while Naomi watches. | ready |
| `pe-race` | `images/illustrations/section-01-pe-race-akira-akihiro.png` | Akira leads the PE run with Haruto trailing while Akihiro times the class from an extreme close foreground. | ready |
| `akihiro-embrace` | `images/illustrations/section-04-akihiro-embrace-haruto.png` | Akihiro embraces Haruto in restrained relief after Haruto returns safely from the mountain ritual. | ready |
| `hina-drawing-yamaba` | `images/illustrations/section-04-hina-drawing-yamaba-alone.png` | Hina draws Yamaba alone at the family table after lunch. | ready |
| `watanabe-farewell` | `images/illustrations/chapter-17-watanabe-farewell-pov.png` | Watanabe passes the folded paper to Haruto in a close first-person farewell composition. | ready |

Source and license details for audio are recorded in `audio/SOURCES.md`. Root-level asset accounting lives in `assets-manifest.md`.
