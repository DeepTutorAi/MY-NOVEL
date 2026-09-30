# Tsukinomi web rework: design and scope

Status: draft for author review. Written 2026-09-30. No implementation has started.
Related work: the Sea rework (commit 5628578), whose cutscene runner is generalised here, and the hub rework (commit 81c895d), whose `src/scripts/hub/scene-runtime.ts` is reused.

## 1. Purpose and success criteria

Give "สถานีทะเลพระจันทร์" (Tsukinomi no Eki) the same standard of craft as Sea and the hub: a home page and reader that feel like part of the story, one unique opening cutscene for the prologue and each of the five parts, and better use of the assets that already exist. Reading stays the priority.

The rework is done when:

1. A first-time reader can open any section by direct link or refresh without being redirected, and every cutscene text and control is visible and reachable.
2. The prologue and each of parts 1 to 5 has its own cutscene with its own mechanic, plays at most once per day per part (06:00 local reset), can be skipped at any moment, and never delays the reader by more than the cutscene length.
3. The home page shows the station concourse concept (section 4.4) and reflects the reader's progress.
4. The reader keeps the current reading column width, type and contrast. Decorative layers never overlap text.
5. Every existing music cue, soundscape, sound effect, background and illustration has a defined role (section 5). Nothing new has to be recorded or drawn.
6. Gates in section 7 pass: tests, type check, build, production guard, end-to-end run, frame-time budget.

## 2. Baseline (measured on the live site, 2026-09-30)

| Finding | Evidence |
|---|---|
| B1. Direct link or refresh of any section page redirects a new reader to the hub. | Fresh browser context, `/tsukinomi/sections/00-introduction/` and `/01-discovery/` both end at `/MY-NOVEL/`. Cause: `TsukinomiBaseLayout.astro` still runs the unlock gate added in commit 4992e63 ("lock Tsukinomi") while `NovelCard.astro` only gates a card when `status !== "เผยแพร่"` and Tsukinomi is published. Navigating from the home page works only because ClientRouter does not re-run the inline script. |
| B2. Cutscene text and continue button are invisible. | `body.has-cutscene .sakura-backdrop { z-index: 998 !important; background: #000 }` paints above `.cutscene-overlay` (z-index 997). DOM shows the epigraph at full opacity and the button at `elementsFromPoint`, but screenshots (headless and headed Chrome) are black with petals. Page scroll is locked while this state is active. |
| B3. Third-party request on every Lodge and Tsukinomi page. | `fetch('https://worldtimeapi.org/api/ip')` failed with `ERR_CONNECTION_RESET`. Already removed in the working tree (uncommitted); a contract test now forbids it. |
| Home page is one screen. | `scrollHeight` 900 at 1440x900. It is a static plate, petals, title and four links. |
| Reader is a flat panel over the section background. | Screenshot of section 1 after the cutscene. |
| Existing cutscene is text fading in on black, identical for every part. | `EPIGRAPHS` in `TsukinomiSectionLayout.astro`, inline script, rolling 24 hour cooldown. |
| Audio assets are reachable only through manual Walkman controls. | 5 music cues and 3 soundscapes are used by `WalkmanAudio` (`src/scripts/tsukinomi/walkman-state.ts`); 2 sound effects are used by the player buttons. |
| 51 MB of unreferenced character-sheet drafts ship in `public/assets/tsukinomi/images/extra/`. | 21 PNG files, roughly 2 MB each, not referenced from `src`. Total asset folder is 114 MB. |

## 3. Scope

In scope:

- R0 bug fixes B1, B2 (minimal) and B3.
- A shared cutscene engine (section 4.2) and six cutscenes (section 4.3).
- The home page concourse (section 4.4).
- Reader upgrades (section 4.5): station-sign header, rail progress, part transitions, illustration treatment, chapter-break mark, cassette panel.
- The asset role map (section 5).

Out of scope:

- Any change to novel text, chapter order or section metadata.
- Lodge, Kusabi, Sea and the hub, except the shared cutscene-core extraction and the `scene-runtime` relocation described in section 4.2.
- Characters page and Extra page, except that the gate fix must leave the Extra unlock behaviour unchanged.
- Recording, generating or commissioning new audio or images.
- WebGL. All scenes use Canvas 2D and CSS.

Deferred (candidates for a later pass): character portraits as "passenger tickets", end-of-part contact-sheet recap, moving unreferenced drafts out of `public/` (needs an author decision, see section 9).

## 4. Design

### 4.1 Concept

Two motifs already in the story become the frame: the last train that never stops (space, navigation, progress) and the Walkman with one earphone (time, memory, sound). The five parts already carry season palettes: autumn, twilight, warm room, snow pact, winter light. A cutscene is the reader entering that season.

Decision: build one shared engine and six bespoke scenes | Why: each part has a different emotional beat and palette | Gain: distinct identity per part, one tested lifecycle | Cost: six scene modules to build and measure | Alternative: one parameterised text animation, rejected because it repeats the current weakness.

### 4.2 Shared cutscene engine

Problem it solves: B2 was a z-index conflict between hand-rolled overlays and page layers. A native `<dialog>` opened with `showModal()` sits in the top layer, so no page layer can cover it.

Modules (paths indicative, final names fixed in the implementation plan):

- `src/scripts/_shared/cutscene/core.ts`: pure logic. Cooldown (reset at 06:00 local, same rule as Sea: `cooldownDay`, `playedToday`), query parameters for forced replay, state machine (`idle`, `pending`, `loading`, `playing`, `finished`, `skipped`).
- `src/scripts/_shared/cutscene/runner.ts`: dialog lifecycle, skip and Escape handling, focus return, page-scroll lock, reduced-motion handling, dynamic import of the scene module only when it will actually play.
- `src/scripts/_shared/lifecycle.ts`: the ClientRouter page-lifecycle helper generalised from `onSeaPage`.
- `src/scripts/tsukinomi/cutscene/`: `registry.ts` (part number to scene loader and asset list), one module per scene, `epigraphs.ts` (the existing `EPIGRAPHS` text moved out of the layout, unchanged).
- `src/scripts/hub/scene-runtime.ts` moves to `src/scripts/_shared/scene-runtime.ts` (with its test); hub imports are updated. Scenes use its frame-time loop, visibility pause, debounced resize, live reduced-motion and seeded random.

Decision: extract Sea's cutscene core into the shared module and make Sea consume it | Why: cooldown and lifecycle rules would otherwise exist twice and drift | Gain: one tested implementation for Sea and Tsukinomi (and later Lodge and Kusabi) | Cost: touches shipped Sea code | Alternative: copy into Tsukinomi, rejected as duplication. Guard: the existing Sea cutscene tests must pass with import-path changes only. If they cannot, fall back to the copy and report why.

Behaviour rules for every scene:

- Plays once per day per part. Storage key `tsukinomi:cutscene:played:<n>` is kept; both the old numeric millisecond value and an ISO string are accepted.
- The epigraph text is always real DOM text inside the dialog (also for screen readers), never only pixels.
- Skip control is visible from the first frame and reachable by keyboard. Escape skips.
- Audio starts only after a user gesture. Scenes drive audio through the existing `WalkmanAudio` instance (`setCue`, soundscape toggles) so there is one audio graph. The player's previous enabled state and volumes are restored when the scene ends. If the reader has muted or disabled the Walkman, the scene is silent.
- `prefers-reduced-motion`: the scene renders one static composition and the text appears without animation.
- No more than three flashes per second, where a flash is a relative-luminance change of 10 percent or more (WCAG 2.3.1); verified by sampling frames as was done for the hub.
- The scene module is not downloaded when the cooldown says it will not play.
- Forced replay with a query parameter for review, cleaned from the address bar afterwards (same behaviour as Sea).

### 4.3 The six cutscenes

Text for each is the existing epigraph for that number. Visuals use only assets listed in section 5.

| Scene | Mechanic | Input fallback | Assets |
|---|---|---|---|
| Prologue | Black screen and a Walkman. The reader presses play (this is the audio gesture). One earphone wire draws across the screen; the second earbud stays empty. The epigraph appears as slow subtitles. A station lamp lights at the stone steps. | Auto-starts after 6 seconds without input, silent. | `walkman.svg`, `cassette-mark.svg`, `tape-click`, `cassette-hiss`, cue `discovery` |
| Part 1, autumn | Rain on a fogged window over the part 1 background. Dragging wipes the fog and reveals the text. | Fog clears by itself in 6 seconds; keyboard Space or Enter clears it. | `section-01` background, `distant-train`, cue `discovery` |
| Part 2, twilight | A lamp casts shadows of the bench and petals; the girl casts none. The text breaks up like tape dropout and rewinds into place. | Runs by itself. | `section-02` background, `tape-rewind`, cue `reveal` |
| Part 3, warm room | A faded photograph in a warm room. Holding slows the fading; releasing lets it fade. Either way the scene ends after about 10 seconds and the story is unchanged. | Runs by itself; the choice is cosmetic. | `section-03` background, cue `decision` |
| Part 4, snow pact | Blizzard particles converge into the epigraph words and are blown apart. | Text is already in the DOM; particles only decorate. | `section-04` background, `mountain-wind`, cue `mountain` |
| Part 5, winter light | Ten years in about ten seconds: crowd streaks blur past while the wooden station sign stays sharp and weathers through the seasons. | Runs by itself. | `section-05` background, cue `ten-years` |

Length target: 20 to 35 seconds each, with the skip control always available. A scene never uses story information the reader does not already have on entering that part.

### 4.4 Home page: the concourse

- Hero keeps `hero-station` and the view-transition name `tsukinomi-home-hero` so the hub card morph is preserved (guarded by `hub-portal-contract.test.ts`).
- On load a train passes behind the platform without stopping. Its windows are lit and show film frames of the section illustrations. Frames for parts the reader has not reached are dark silhouettes, so new readers see no later scenes. Sound is off unless the reader has already enabled the Walkman.
- A departure board settles into view with one row for the prologue and each part: title, chapter range and reading time from existing section metadata. The final row reads "ขบวนสุดท้าย" with `--:--`. (New copy; needs author approval.)
- Scrolling draws a rail line through five stations, one per part. The page tint follows each part's palette token. A marker shows the furthest part read, taken from the read marks the table of contents already displays.
- Mobile portrait: the line is vertical and the board becomes stacked rows. Short landscape: the passing train is skipped and the board is shown directly.
- Reduced motion: static hero, board in its final state, line fully drawn.
- Progress-to-station and board-row logic live in a small pure module with unit tests, the same pattern as Sea's `home-reading-core`.

### 4.5 Reader

- Section header becomes a station-name sign (駅名標): current part, previous and next part as neighbouring stations. The existing previous and next controls remain as its links.
- Reading progress becomes a thin rail with a marker; chapter ticks come from the part's chapter range.
- Part-to-part navigation uses a horizontal view transition (reversed when going back). It is disabled under reduced motion.
- Existing illustrations (18, already placed in the text) get a film-frame or photograph treatment in CSS only, with reveal on scroll. Sizes and positions in the text do not change.
- `tape-divider.svg` marks chapter breaks; an optional soft chime plays only when the Walkman is already playing.
- The Walkman panel shows the five parts as a cassette track list with reading times.
- Decorative layers (petals, rain at the edges) stay outside the reading column and are paused when the tab is hidden.

### 4.6 Bug fixes (round R0)

- B1: emit the unlock gate only when the novel's status in `src/data/_novels.ts` is not published. When Tsukinomi is published no gate script is output for section pages; Extra unlock behaviour is untouched. Add a contract test that section pages contain no redirect while the novel is published.
- B2: minimal fix now (overlay above the backdrop and petals) so the live site works before R1 replaces the overlay with the dialog engine. Add an end-to-end check that samples pixels at the epigraph and the button and requires visible text.
- B3: commit the already-made removal of `worldtimeapi.org` from both layouts and the updated contract test.

## 5. Asset role map

| Asset (count) | Today | New role |
|---|---|---|
| Music cues (5) | Manual Walkman playback | Started by each part's cutscene after the play gesture, continues into reading; cross-fades when the part changes |
| Soundscapes: `cassette-hiss`, `distant-train`, `mountain-wind` | Manual toggles | Layered inside the matching cutscene (hiss in prologue, train in part 1, wind in part 4); the reader's settings are restored afterwards |
| Sound effects: `tape-click`, `tape-rewind` | Player buttons | Prologue play press; part 2 rewind; part change transition |
| Section backgrounds (5) | Page background | Also the base plate of each cutscene and the station thumbnail on the route |
| `hero-station` | Home hero | Also the plate the passing train is composited on |
| Illustrations (18, placed in text) | Inline once | Also the film frames in the passing train; unlocked by reading progress; CSS film treatment in the text |
| `walkman.svg`, `cassette-mark.svg` | Player UI | Prologue scene and the cassette track-list panel |
| `tape-divider.svg` | Divider | Chapter-break mark |
| `film-grain.png` | Site grain | Same, with intensity tuned per scene |
| Character portraits (8) | Characters page only | Unchanged (deferred) |
| `images/extra/*` drafts (21 PNG, 51 MB) | Shipped but unreferenced | Unchanged pending author decision (section 9) |

## 6. Delivery rounds

Each round ends with the gates in section 7 and a review by the author before anything is pushed.

- R0: B1, B2, B3 with tests. Small and independent; can ship at once.
- R1: shared engine and moves, Tsukinomi adapter, prologue and part 1 scenes, home concourse, asset roles for those. This is the first look at the full concept.
- R2: scenes for parts 2 to 5, one at a time with its own measurements.
- R3: reader upgrades from section 4.5.

## 7. Verification

- Unit tests for pure logic: cooldown (including the 06:00 boundary and legacy stored values), epigraph registry completeness, progress-to-station mapping, board rows.
- Contract tests for source rules: no third-party requests, dialog used for cutscenes, reduced-motion branch present, no overlay above the reader, view-transition name preserved.
- End-to-end script (Puppeteer, same approach as `sea-e2e.ts`): play, skip, Escape, cooldown, audio state restored, direct-link and refresh on section pages, text and button pixel-visible in every scene, no console errors.
- Performance targets: mean frame time under 2 ms per scene on desktop and under 6 ms at 4x CPU throttle, measured as for the hub. A scene that misses its target is reported with the measured number, not adjusted silently. Scene code lazy-loaded; report gzip size per scene.
- Flash safety: sampled luminance per second for each scene.
- Layout: five viewports (375x812, 390x844, 812x375, 667x375, 915x412), no horizontal scroll, touch targets at least 44 px.
- Repository gates: `pnpm check`, `pnpm build`, `pnpm sea:verify-dist`, the full test suite.
- Not verified by this plan: Safari and Firefox rendering, real-device touch feel, subjective animation quality. These are reported as unverified after each round.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Sea regression from the shared-engine extraction | Test parity guard in section 4.2, fallback to a copy |
| Train and illustration frames misalign with the hero plate | Compose in the lower third only; verify with screenshots at five viewports before merging |
| Thai text sampled into particles (part 4) renders incorrectly | Text stays in the DOM; particles decorate only; verify with Thai combining marks |
| Long scenes annoy returning readers | Once a day, skip always visible, scene not downloaded when it will not play |
| Audio surprise | Sound only after a gesture and only when the Walkman is enabled |
| Scope size similar to the Sea rework | Rounds R0 to R3 with review between them |

## 9. Assumptions and open decisions

1. B1 is a leftover of the 2026-06-07 lock feature and not an intended gate on published sections. Evidence: the hub gates only unpublished novels. Author to confirm.
2. The daily 06:00 cutscene reset used in Sea also applies to Tsukinomi. Author to confirm.
3. Prologue cutscene uses only the existing epigraph (a short opening); the full prologue text stays as a normal page read by scrolling.
4. Extract Sea's cutscene core into a shared module (section 4.2). Author may veto; the fallback is a copy.
5. Unreferenced drafts in `public/assets/tsukinomi/images/extra/` (51 MB): default is to leave them untouched. Moving them to `src/plan/tsukinomi/` would cut the deploy by about 45 MB and stop them being downloadable by URL, as was done for Sea. Author decision needed; the Extra page's own behaviour must be checked first.
6. New interface copy is limited to the departure-board final row and control labels; author approves before merge.
