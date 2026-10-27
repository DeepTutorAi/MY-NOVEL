# Hvitveldt Lodge web rework: design and scope

Status: approved by the author 2026-10-13. No implementation has started.
Related work: the Tsukinomi web rework (`src/plan/tsukinomi/web-rework-design.md`, main `0f6fa36`), whose canvas scene pattern, measurement harness and e2e approach are reused; the hub rework, whose `src/scripts/_shared/scene-runtime.ts` is the shared canvas runtime.

## 1. Purpose and success criteria

Give "ฮวิตเวลต์ ลอดจ์" a web presentation that tells the story through the interface, at the craft level of the Tsukinomi rework, without repeating any of its ideas. Reading stays the priority.

The rework is done when:

1. The site has one visual language (graphite and charcoal on paper, monochrome) and one frame (a recovered case file: Elena's notebook, the lodge's GUEST RECORDS, Detective Karlsen's board).
2. A restrained "the site is being copied" layer escalates with the reader's progress (section 4.1) and peaks after chapter 18. Story text is never altered, hidden or made harder to read by it.
3. The home page is a live graphite whiteout scene with footprints, progress-gated shadows and a guest book the reader may sign.
4. The table of contents is presented as GUEST RECORDS and ends with the reader's own guest card.
5. The reader shows three distinct journal styles, a canon-accurate handwriting drift in chapter 18, illustrations that sketch themselves in, and a candle that burns down with chapter progress.
6. The five existing epigraph points (chapters 0, 1, 6, 13, 18) each have a canvas cutscene with its own mechanic. The epigraph text is kept word for word. Every cutscene can be skipped at any moment.
7. The characters page is Karlsen's board with reader suspicion pins and progress-gated fate stamps.
8. Gates in section 10 pass on every round.

## 2. Baseline (read from the repository, 2026-10-13)

| Finding | Evidence |
|---|---|
| B1. Cutscene cannot be skipped until the epigraph finishes typing (about 300 characters at 40 ms, about 12 s). | `LodgeChapterLayout.astro` inline script: the continue button is shown only after `type()` reaches the end; there is no skip control and no Escape handling. |
| B2. Cutscene typing splits Thai grapheme clusters. | `textEl.textContent += epigraphText.charAt(index)` appends one UTF-16 unit at a time, so vowels and tone marks render detached for a frame. |
| B3. Cutscene ignores reduced motion, does not move focus, and screen readers receive the text one character at a time. The caret `▋` blinks with `step-start` at 1 Hz. | Same script and its `<style is:global>` block. |
| B4. Snow canvas is raised above the cutscene overlay. | `body.has-cutscene .snow-canvas { z-index: 998 !important }` while `.cutscene-overlay` is `z-index: 997`. Same pattern caused Tsukinomi finding B2. To be confirmed by screenshot in L0. |
| B5. Two definitions of "chapter read". | Home resume card treats `progress >= 0.995` as finished (`COMPLETED_PROGRESS` in `src/pages/lodge/index.astro`); the characters page unlock uses `progress >= 0.8` (`src/pages/lodge/characters.astro`). |
| B6. Sophie's surname differs between site data and text. | `src/data/lodge/characters.ts` names her "Sophie Hale"; chapter 3 GUEST RECORDS reads `WALTERS, Sophie (UK)`. Decided: Walters (section 12, decision 8). |
| B7. No Lodge e2e or measurement scripts. | `package.json` has `tsukinomi:e2e`, `tsukinomi:measure`, `sea:*` only. |
| B8. No visible reading progress in the reader. | `ReadingProgress.astro` only saves and restores position; `ReaderAmbience.astro` is a decorative candle. |
| B9. All 25 journal blocks share one style although they are different documents. | `remarkJournalDirective` in `astro.config.mjs` maps every container directive to `div.journal`. |
| B10. Home page is a static hero image with links. | `src/pages/lodge/index.astro`. |

Facts confirmed while writing this spec:

- `remark-directive` 4.0.0 parses `:::สมุดบันทึก{kind=elena}` with `attributes: { kind: "elena" }` and an ASCII text directive `:hand[ก]{day=3}` inside Thai prose. The Thai directive name can stay.
- Only Lodge chapters use container directives (`src/content/*/`: 25 in Lodge, 0 elsewhere), so changing the journal plugin does not affect other novels.
- `@fontsource/sriracha` and `@fontsource/charmonman` exist at 5.3.0.

## 3. Concept

### 3.1 Three layers

1. Visual language: graphite and charcoal on paper. The 36 chapter illustrations, the home plate and the character portraits are already drawn in this style.
2. Frame: a recovered case file. Reader pages are Elena's notebook; the table of contents is the lodge's GUEST RECORDS; the characters page is Karlsen's board.
3. Mimic layer: the site behaves slightly wrong, more as the reader progresses, ending with the reader cast as the next guest. Restrained: decorative surfaces only.

### 3.2 Contrast with Tsukinomi

| | Tsukinomi | Lodge |
|---|---|---|
| Mood | Warm nostalgia, a journey | Cold paranoia, stolen identity |
| Palette | Twilight colour, sakura, lamplight | Monochrome graphite, paper grain |
| Interface metaphor | Station, train, cassette tape, film frames | Notebook, guest ledger, evidence board, mirror |
| Reader role | Passenger | Guest number nine |
| Signature motion | Petals that freeze, film that develops | Footprints that follow half a second late, hatching that sketches in |

Not reused from Tsukinomi: trains, tape or Walkman, petals, film frames, fog wiping, press-and-hold as a cutscene verb, twilight colour.

### 3.3 Principles

- Story text is real DOM text at the existing size, measure, line height and contrast on every page.
- Reader pages carry only story-time effects (tied to what happens in the chapter). Progress-driven mimic effects live on the home page, the table of contents, the characters page and the finale.
- No camera, microphone, flashing light or jump scare. Flash count must be 0 (WCAG 2.3.1).
- Every animated surface has a still state for reduced motion or when the motion switch is off.
- Every control is a real `<button>` or link, at least 44 px, reachable by keyboard.
- Progress-gated content appears only after the reader finishes the chapter that establishes it.

## 4. Shared foundations (L0)

### 4.1 Progress and drift level

New pure module `src/scripts/lodge/progress-core.ts`, with unit tests:

- `readChapterProgress(getItem, keys)` reads `hvitveldt:reading:chapter:<id>` records and returns, per chapter number, the saved progress. Malformed records are ignored, never thrown.
- `furthestFinished(progress, threshold)` returns the highest chapter whose progress meets the threshold.
- Two named thresholds: `FINISHED = 0.995` (matches the home resume card) and `UNLOCK = 0.8` (matches the existing characters unlock). The existing Subject 8 unlock keeps `UNLOCK`; everything new uses `FINISHED`.
- Finishing is per chapter. Skipping ahead and finishing chapter 18 alone does not unlock level 4; levels require the chapters named below to be finished.
- `lodgeDrift(finished)` returns a level:

| Level | Condition | Meaning |
|---|---|---|
| 0 | No chapter finished | Arrival |
| 1 | At least one chapter finished | Act 1 in progress |
| 2 | Chapter 5 finished | Bare footprints and seven shadows are known |
| 3 | Chapter 12 finished | Six shadows herding the group are known (chapter 11) |
| 4 | Chapter 18 finished | Finale |

The characters page, home page and table of contents read levels and finished chapters only through this module.

### 4.2 Guest record

New pure module `src/scripts/lodge/guest-core.ts`, with unit tests:

- `normalizeGuestName(input)`: trims, collapses internal whitespace, removes control characters, limits to 40 grapheme clusters, returns `null` for empty.
- `parseGuestRecord(raw)`: validates `{ name: string | null, signedAt: string, skipped: boolean }`; any other shape returns "unsigned".
- Storage key `hvitveldt:guest`, written through the existing `ProfileStorageInterceptor` so profiles stay isolated.
- Names are rendered with `textContent` only.
- If storage throws, the guest book shows "เบราว์เซอร์ไม่อนุญาตให้บันทึก ชื่อจะหายเมื่อปิดหน้า" and keeps the name for the session only.

### 4.3 Storage keys

Existing keys are read, never renamed. New keys are added to the prefix list in `src/components/_shared/ProfileStorageInterceptor.astro` so they are namespaced per profile like the existing reading keys:

| Key | Content |
|---|---|
| `hvitveldt:guest` | Guest record (4.2) |
| `hvitveldt:suspects` | Array of character names the reader pinned, filtered against `characters.ts` on read |
| `hvitveldt:finale:seen` | Timestamp of the first finale flip on the home page |

### 4.4 Lodge canvas kit

New `src/scripts/lodge/scenes/kit.ts` on `_shared/scene-runtime.ts` and `_shared/cutscene/graphemes`:

- Paper: baked grain and tooth texture per size.
- Graphite: hatched fills, charcoal smudge sprites, stroke-style snow flakes.
- Eraser: `destination-out` helpers for light and reveal masks.
- Plates: load and cover-draw a WebP plate with a plate-to-canvas point mapping.
- `runLodgeScene(ctx, spec)`: frame loop with layout, render, still, cleanup, and abort-signal handling.

Not shared with the Tsukinomi kit, because that kit depends on Tsukinomi scene types and CSS. Common loop code may move to `_shared` later; the Kusabi rework is the natural point to decide.

### 4.5 Tokens and font

- Monochrome token set in `src/styles/lodge/global.css` for graphite, paper grain and stamp red; the existing dark reading theme (`--paper: #0E0D0C`, `--ink: #ECE7DD`) is kept.
- Add `@fontsource/sriracha` (weight 400, Thai and Latin subsets) as the handwriting face for Elena's hand, the guest signature, figure captions and handwritten notes. Chosen over Charmonman for legibility at body size. L0 verifies the Thai subset files exist in the installed package.

### 4.6 Tooling

- `src/scripts/lodge/lodge-e2e.ts` (Puppeteer, installed Chrome via `PUPPETEER_EXECUTABLE_PATH`), script `lodge:e2e`.
- `src/scripts/lodge/scene-measure.ts` reusing `src/scripts/tsukinomi/scene-measure-core.ts` for frame time and flash counting, script `lodge:measure`.

## 5. L1: home page, guest book, GUEST RECORDS

### 5.1 Whiteout scene

Files: `src/scripts/lodge/home/whiteout-core.ts` (pure, tested), `whiteout-scene.ts`, `whiteout-loader.ts` (dynamic import after first paint).

- Base: `Homebackground.webp` drawn with cover fit, baked once per size, with paper grain over it.
- Snow: three depths; near flakes are short pencil strokes.
- Whiteout gusts: every 25 to 45 s a white veil crosses the scene over 2 to 3 s. Luminance ramps take at least 1 s, so they never count as flashes. Text sits on its own scrim and is never covered.
- Footprints: pointer or touch movement over the lower snow band places alternating boot prints at a fixed stride. Prints fill with snow over about 8 s.
- Follower: from level 2, bare long-toed prints retrace the reader's path 0.5 s behind. At level 3 the gap shrinks.
- Shadows at the treeline: level 2 shows seven, level 3 shows six standing closer. They face away. When the pointer is still for 3 s they turn toward the viewer one by one; any movement turns them back.
- Scroll: the scene fades to blank paper as the reader scrolls to the found-note section.
- Still: reduced motion or motion switch off draws one frame with settled snow and level-appropriate shadows, without footprints.
- Motion switch: the existing `hvitveldt:motion:snow` key and `hvitveldt:motion-change` event control this scene. No new setting.
- Failure: if the plate fails to load, a procedural charcoal sky is drawn; if canvas is unavailable, the existing `<picture>` stays visible underneath.
- `SnowCanvas` stops while the home scene is live (same approach as Tsukinomi `yieldsToHomeSky`).
- The mount exposes `data-drift` for tests.

### 5.2 Guest book

Placed in the found-note section, never as a blocking modal. The start-reading link always works.

```
________, (—)  <Mon YYYY>
PROFESSION: Reader
REFERRED BY:
DEPARTED:
NOTES: Subject 9
```

- One name field and two buttons, "เซ็นชื่อ" and "ข้าม". After signing, the name is revealed left to right in the handwriting face. The reader can edit or erase the signature later.
- Skipping shows `GUEST`.
- `REFERRED BY` stays blank until level 4 (section 8.2).

### 5.3 GUEST RECORDS table of contents

`/lodge/chapters/` becomes a ledger with a `GUEST RECORDS` cover. Each chapter is a ledger line grouped by act: number, title, reading time, status (not opened, percent read, or a `READ` stamp when finished). `DEPARTED` is not used for chapters because it means a vanished guest in the story. The last entry is the reader's guest card from 5.2.

Kept: every link and its keyboard order, the `hvitveldt:secret:reads` logic in the menu, and the menu in the top bar (restyled in L2).

### 5.4 Tests

Unit tests for `progress-core`, `guest-core`, `whiteout-core`. A contract test for the home and table of contents markup (mount is `aria-hidden`, guest controls are buttons, no `innerHTML` for the name). E2E: sign, skip, edit and erase persist across reload; seeded progress yields `data-drift` 0, 2 and 3 with the matching shadow count; the reader card appears in the table of contents.

## 6. L2: the reader as Elena's notebook

### 6.1 Page

- Keep the dark reading theme, font, size, measure and line height. Add a faint paper grain and a pale red margin rule.
- Chapter header: "บทที่ N" in the handwriting face, a hatched underline under the title, and the existing drop cap restyled as charcoal.

### 6.2 Journal kinds

Markup change only, on the opening line of each block: `:::สมุดบันทึก{kind=elena|hand|print}`. No prose changes. `remarkJournalDirective` emits `div.journal.journal--<kind>`; a block with a missing or unknown kind fails the build with the file and line.

| Kind | Look |
|---|---|
| `elena` | Handwriting face on ruled notebook paper |
| `hand` | Another person's hand: faded ink on aged paper, visibly different from Elena's |
| `print` | Typed card in JetBrains Mono, with a rubber stamp where the document is a record |

| # | Chapter:line | Opening | Kind |
|---|---|---|---|
| 1 | 01:55 | ฮวิตเวลต์ / 3 KM → (road sign) | print |
| 2 | 01:375 | "For your notes. M." (Marcus, cursive) | hand |
| 3 | 01:415 | 6 กุมภาพันธ์ 2024 คืนแรก | elena |
| 4 | 02:552 | 6 กุมภาพันธ์ 2024 ค่ำคืนแรก | elena |
| 5 | 03:265 | ⚠ WEATHER LOCKDOWN ACTIVE | print |
| 6 | 03:525 | Don't (pen ink) | hand |
| 7 | 03:675 | "มาร์คัส & ลิเลียน ฮวิตเวลต์, 2019" (silver engraving on a frame) | print |
| 8 | 03:918 | WALTERS, Sophie (UK) | print |
| 9 | 03:933 | ANDERSEN, Henrik (NORWAY) | print |
| 10 | 03:944 | Subject 3 | print |
| 11 | 03:950 | Subject 4 | print |
| 12 | 03:988 | HALE, Lillian (USA) | print |
| 13 | 03:1005 | Sept 2021 / Seven subjects | print |
| 14 | 04:139 | บันทึกของ ลิเลียน เฮล | hand |
| 15 | 04:147 | 13 กันยายน 2019 วันที่ 1 | hand |
| 16 | 04:161 | 14 กันยายน 2019 วันที่ 2 | hand |
| 17 | 04:183 | 15 กันยายน 2019 วันที่ 3 | hand |
| 18 | 04:207 | 16 กันยายน 2019 วันที่ 4 | hand |
| 19 | 04:241 | 17 กันยายน 2019 วันที่ 5 | hand |
| 20 | 04:573 | หากคุณเปิดตู้เซฟนี้... M | hand |
| 21 | 05:155 | 7 กุมภาพันธ์ 2024 | elena |
| 22 | 06:507 | สิ่งนั้นไม่ได้ล่าเนื้อหนัง... (handwritten notes read aloud) | hand |
| 23 | 07:632 | Elena Vasquez (handwriting sample, the Tell) | elena |
| 24 | 18:66 | Ms. Vasquez, (Karlsen's e-mail) | print |
| 25 | 18:497 | 6 กุมภาพันธ์ 2024 คืนแรก (re-read) | elena |

### 6.3 Handwriting drift in chapter 18

Canon (`18-mirror.md` lines 519 to 551): the drift starts on day 3 with "ก"; by days 4 and 5 "ก" flicks harder, "ข" gains a stroke, "ส" grows a tail; the new entry dated 21 June 2024 matches day 5. Elena's journal blocks in the book are from days 1 and 2 only, so they are not drifted.

Markup, inside the existing quotation marks, no word changes:

| Line | Text | Markup |
|---|---|---|
| 521 | "ก" (day 3) | `:hand[ก]{day=3}` |
| 529 | "ก" (days 4 to 5) | `:hand[ก]{day=5}` |
| 531 | "ข" | `:hand[ข]{day=5}` |
| 533 | "ส" | `:hand[ส]{day=5}` |
| 545 | 21 มิถุนายน 2024 บรูคลิน | `:hand[21 มิถุนายน 2024 บรูคลิน]{day=5}` |

- `hand` joins the allowed inline directives so `remarkNeutralizeStrayDirectives` keeps it. It renders `span.hand.hand--day-<n>`; `day` must be 3, 4 or 5 or the build fails.
- Inside a `hand` span, each grapheme cluster that starts with ก, ข or ส is wrapped whole (consonant plus its marks).
- Rendering uses only inline-safe techniques: font change, `position: relative` baseline offset, and absolutely positioned pseudo-elements that draw the extra flick, stroke or tail as SVG. No `inline-block`, no `transform`, so Thai line breaking is unchanged.
- The same renderer is used in the finale for the reader's signature (8.2).

### 6.4 Illustrations sketch in

All 36 `figure.chapter-figure` elements, CSS only:

- A diagonal hatch mask sweeps across the image as it enters the viewport, then tone rises to full, using `animation-timeline: view()`.
- The figure sits in the notebook with paper corners and a slight tilt; the caption uses the handwriting face and keeps its code ("05A:").
- Without scroll timeline support (Firefox today) or under reduced motion the image is shown complete.

### 6.5 Candle progress

`ReaderAmbience` becomes the chapter progress indicator, fed by the existing `ReadingProgress` position: the candle shortens with progress, a wax drip appears at each `h2`, and the flame gutters out at the end of the chapter. It stays `aria-hidden`. Under reduced motion the flame is still and height changes are not animated.

### 6.6 Other reader surfaces

- Top bar table-of-contents menu restyled to match GUEST RECORDS.
- `SnowCanvas` flakes drawn as pencil strokes; same switch.
- `EndOfChapter` rune restyled as charcoal.

### 6.7 Tests

Unit tests for the plugin (kind attribute, unknown kind error, `hand` day validation, grapheme wrapping). A content contract test: all 25 blocks have a valid kind; `hand` appears only in chapter 18; no wrapped span splits a grapheme cluster. E2E: candle height decreases as the page scrolls. Screenshots of the three journal kinds and a sketching figure at six viewport sizes. Scroll frame time recorded.

## 7. L3: five cutscenes

### 7.1 Shared contract

- "ข้าม" button from the first frame, and Escape. "เดินทางต่อ" (existing copy) appears when the text has fully revealed.
- The epigraph text is the existing `EPIGRAPHS` entry, word for word, present in the DOM in full from the start; the visual reveal is per grapheme cluster with opacity. A scrim keeps it legible.
- Focus moves into the cutscene at start and returns to the chapter header at the end.
- The cutscene runs on the shared `createCutsceneRunner` (`src/scripts/_shared/cutscene/runner.ts`, already used by Sea and Tsukinomi and covered by `runner.test.ts`): native `<dialog>` with `showModal()`, always-visible skip, Escape, still mode, focus restore, `?cutscene=replay`. Consequence: the play rule becomes the shared once-per-day rule with a 06:00 local reset (`playedToday` in `_shared/cutscene/core.ts`) instead of the current rolling 24 hours, still under `hvitveldt:cutscene:played:<n>`. A stored legacy timestamp may let a cutscene play once more; nothing breaks. A small "เล่นฉากเปิดอีกครั้ง" link in the chapter header points to `?cutscene=replay`.
- Reduced motion, motion switch off, or no canvas: still frame, full text, continue button.
- Each cutscene lasts at most about 20 s. No flashes, no jump scares.
- No new audio system; the chapter's existing music cue plays only if the reader already enabled the player.
- Scenes are built on the Lodge kit, loaded per chapter by dynamic import, with timing rules in pure tested cores.
- Chapter illustrations are not used where they would reveal the chapter's own events (for example `18B`).
- Fixes B1 to B4.

### 7.2 Threads

1. The half-beat lag, also used by the home footprints, escalates: in chapter 6 light lingers, in chapter 18 the reflection leads.
2. Each scene has one verb, none borrowed from Tsukinomi.
3. The reader handles light: headlights, a lamp, a torch, a mirror. Darkness is where the entity is.

### 7.3 Scenes

| Chapter | Image | Verb | Peak |
|---|---|---|---|
| 0 Introduction | A closed notebook on a wooden table in a dark room, window-frame shadow, snow outside, a gold ring beside the notebook | "เปิดสมุด": the cover turns and the epigraph appears on the page | The word "ฉัน" in the epigraph is in Elena's hand; the last "ฉัน" is written slightly differently from the first |
| 1 Arrival | Black, no picture (revised by the author after release: the night-drive scene was removed) | None: the epigraph is revealed on black from 1 s to 11 s | The epigraph is held alone for five seconds before the chapter opens |
| 6 Cracks | Plate `06A` (Ben hunched in the living room), the room dark with slow firelight | "ส่องไฟ": the light follows the pointer and reveals the room; without a pointer it sweeps on its own | After the light leaves Ben, the brightness there lingers half a second while everywhere else darkens at once |
| 13 Descent | Ancient stone stair under the lodge in charcoal, carved symbols that catch the torch | "ลงบันได": drag or scroll down one step at a time; button "ลงต่อ" as alternative; the torch follows the pointer and symbols glow faintly as the beam passes | At the bottom, the edge of the beam finds a heap of suitcases and belongings of the vanished |
| 18 Mirror | A Brooklyn bathroom mirror; the epigraph also appears mirrored in the glass, drawn on canvas | Pointer movement: the reflection follows 0.5 s late; without a pointer it moves on its own | Near the end the reflection moves before the reader and its text finishes first; the two then merge |

Author-confirmed choices: chapter 1 was first a night drive with seven thin trunks in the high beam, later replaced by the epigraph on black at the author's request; the chapter 13 symbols are invented drum-style marks, not a real script; the gold ring is shown in the introduction as quiet foreshadowing.

### 7.4 Tests

Unit tests for each scene core (timing, lag, light falloff, steps). Contract tests: controls are buttons; the rendered epigraph equals `EPIGRAPHS` character for character; spans do not split grapheme clusters. E2E: skip works at t = 0, Escape works, focus returns to the header, replay link works, still frame under reduced motion. Frame time and flash count per scene; screenshots at six viewport sizes.

## 8. L4: Karlsen's board, finale, remaining pages

### 8.1 Characters page as Karlsen's board

- Cards are pinned photographs with the existing name, role and copy from `characters.ts`, unchanged.
- Each card has a "สงสัย" `<button aria-pressed>`; pinned cards show a red pin and a handwritten "?". Stored in `hvitveldt:suspects`.
- Fate stamps appear when the reader finishes the chapter that establishes them. A later stamp crosses out earlier ones, which stay visible, so the chain of misdirection is readable after the finale. Data in `src/data/lodge/fates.ts`, tested for chapter range and names matching `characters.ts`. The draft table is in section 8.4 for author confirmation.
- Kept: Subject 8 card unlock (automatic after chapter 17 at the `UNLOCK` threshold, manual unlock, toast) with its existing keys.

### 8.2 Finale (level 4)

1. Home scene and hero layout mirror horizontally; text is never mirrored. The first visit after finishing flips the scene once over about 1.5 s and records `hvitveldt:finale:seen`; reduced motion shows the mirrored state directly.
2. The reader's own footprints become bare and long-toed. There is no follower and no shadows; one lodge window stays lit.
3. Guest card: `REFERRED BY` is handwritten `E. VASQUEZ`. If the signed name contains ก, ข or ส, those clusters use the day-5 drift from 6.3. Latin names are unchanged.
4. A small handwritten note on the home page: "รอบถัดไป · กุมภาพันธ์ 2026".
5. Board: the reader's guest card is pinned last; Elena's card receives `SUBJECT 8`; a handwritten line lists whom the reader suspected and whether they ever suspected Elena.

The finale follows reading progress; clearing reading history returns the site to normal. No separate toggle unless the author asks for one.

### 8.3 Remaining pages

Puzzle map and Extra pages adopt the graphite tokens and paper texture. No new features. The secret-read and puzzle unlock logic is unchanged.

### 8.4 Fate stamps (draft for author confirmation)

Researched from the chapter text; references are `chapter:line` in `src/content/lodge/chapters/`. A stamp appears when the reader finishes that chapter. Earlier stamps are crossed out when a later one supersedes them. Stamps are kept to the events that change what the case file knows; suspicion-only beats are not stamped except where the narrator states it outright.

File numbers come from the February 2024 roster in chapter 3 (ch3:1014 to 1023) and are shown as a typed label, not a stamp, after chapter 3 is finished.

| Character | File no. | Stamps in order (chapter, reference) | Final |
|---|---|---|---|
| Elena Vasquez | Subject 7 | `SUBJECT 8?` (12, ch12:658) → `CLEARED` (15, ch15:395) → `SURVIVED` (16, ch16:389) → `SUBJECT 8` (18, ch18:611) | SUBJECT 8 |
| Marcus Hale | — | `MISSING` (3, ch3:855) → `DEAD` (7, ch7:209) → `BODY GONE` (7, ch7:440) → `ALIVE` (13, ch13:519) → `SUBJECT 8` (15, ch15:455) → `JUMPED` (15, ch15:539) → `DEAD SINCE 2019` (18, ch18:142) | DEAD SINCE 2019 |
| Diana Webb | Subject 4 | `CLEARED` (15, ch15:345) → `SURVIVED` (16, ch16:389) | SURVIVED |
| Sarah Kovac | Subject 2 | `CLEARED` (15, ch15:335) → `SURVIVED` (16, ch16:389) | SURVIVED |
| Vincent Leroux | Subject 6 | `LIED` (7, ch7:695) → `CLEARED` (15, ch15:421) → `SURVIVED` (16, ch16:389) | SURVIVED |
| Tom Janssen | Subject 5 | `DOUBLED` (9, ch9:293) → `DEAD` (9, ch9:426) ; separate note `COPY AT LARGE` (9, ch9:477) | DEAD, copy at large |
| Jake Whitmore | Subject 1 | `NOT JAKE?` (5, ch5:435) → `LEFT` (10, ch10:397) → `PRESUMED DEAD` (17, ch17:276) | PRESUMED DEAD |
| Ben Ross | Subject 3 | `LEFT` (10, ch10:387) → `REPLACED` (12, ch12:368) → `DEAD` (12, ch12:380) ; separate note `COPY BURNED` (12, ch12:692) | DEAD, copy burned |
| Lillian Hale | Subject 8 · 2019 (after 3, ch3:994) | `DEAD · 2019` (3, ch3:745) → `DNA MISMATCH` (18, ch18:122) | DNA MISMATCH |
| Sophie Walters | Subject 1 · 2019 (after 3, ch3:924) | `MISSING · 2019` (4, ch4:186) → `BELONGINGS FOUND` (13, ch13:242) → `SACRIFICED` (16, ch16:283) | SACRIFICED |
| Subject 8 | — | Card stays hidden until its existing unlock (chapter 17). Then `MARCUS` (15, ch15:455) crossed out by `ELENA` (18, ch18:629) | ELENA |
| Detective Karlsen | — | `CASE OPEN` (18, ch18:337) | CASE OPEN |

Notes from the research that affect the board but not the stamps:

- Jake is never confirmed as a mimic; chapter 5 is Elena's suspicion, hence the question mark.
- Tom's copy escapes in chapter 9 and is never destroyed (ch13:58, ch14:359).
- Jake's death is reported only by Ben's copy (ch12:91); he is mourned in chapter 17; his body is not among the three found in chapter 18.

## 9. Accessibility, motion and performance

- Flash count 0 for every scene (hard requirement).
- Frame time at 1x device pixel ratio in desktop Chrome is measured and reported for every scene. Target p95 at or under 8 ms; a miss is reported, not hidden.
- DPR cap from `scene-runtime.ts`.
- Six viewport sizes as in Tsukinomi, including phone portrait and landscape.
- Decorative canvases are `aria-hidden`; every state change that carries meaning (signing, suspicion pins, fate stamps) is in the DOM.

## 10. Gates

Per round, against a production build (`GITHUB_ACTIONS=true`, base `/MY-NOVEL/`; rebuild once if the first build after toggling yields an empty collection):

- `pnpm check`: 0 errors, 0 warnings, 0 hints.
- `pnpm exec tsx --test "src/**/*.test.ts"`: 0 failures.
- `pnpm build`: page count unchanged except for intentional additions.
- `pnpm sea:verify-dist`.
- `pnpm lodge:e2e` and `pnpm tsukinomi:e2e`.
- `pnpm lodge:measure` for rounds that add or change a scene.

Results go to `src/plan/lodge/web-rework-measurements.md`. Not verifiable in this environment: Safari, Firefox, real phones, audio output.

## 11. Delivery

Rounds L0 to L4 run in one pass on a work branch in a worktree created with `git -c core.autocrlf=false worktree add`, with one commit per task (see `web-rework-plan.md`); each round passes section 10 before the next starts. Merging into main, pushing, deploying and removing the branch and worktree happen only on the author's instruction.

## 12. Decisions

Author decisions taken 2026-10-13:

1. Mimic layer: restrained, escalating, peak after chapter 18.
2. Guest book: optional signature, stored on the device only.
3. Cutscenes: five, at the existing epigraph points, epigraph text unchanged.
4. Handwriting font: approved (Sriracha, see 4.5).
5. Markup additions in chapter files: approved (25 journal opening lines and five `hand` marks in chapter 18; no prose changes).
6. Chapter 1 thin trunks, invented chapter 13 symbols, gold ring in the introduction: approved.

Decided at spec review (2026-10-13):

7. Spec approved, including the fate stamp table (8.4) and the journal kind table (6.2).
8. Sophie's surname is Walters, the only form in the chapters (ch3:919; ch4:43, 319; ch5:166; ch7:281 to 287; ch8:96, 638; ch13:242, 244). Change the `name` field in `characters.ts`; keep the image file path.
9. Card copy that contradicts the text is corrected in L4, spoiler-light, with only these field changes in `src/data/lodge/characters.ts`:

| Card | Field | Current | New | Source |
|---|---|---|---|---|
| Elena Vasquez | role | นักเขียนอิสระจากนิวยอร์ก ผู้เล่าเรื่องหลักของบันทึก | นักข่าวอิสระจากนิวยอร์ก ผู้เล่าเรื่องหลักของบันทึก | ch0 introduction, ch16:333 to 335, ch17:139 |
| Lillian Hale | role | นักวิจัยที่ผูกอยู่กับอดีตของฮวิตเวลต์ | นักภาษาศาสตร์ที่ผูกอยู่กับอดีตของฮวิตเวลต์ | ch3:991 (PROFESSION: Linguist), ch14:145 |
| Sophie | name | Sophie Hale | Sophie Walters | decision 8 |
| Sophie | role | คนในความทรงจำและภาพถ่ายเก่า | สถาปนิกชาวอังกฤษในเอกสารเก่าของลอดจ์ | ch3:919 to 921 |
| Sophie | story | Sophie ไม่ได้เดินอยู่ใน lodge แบบแขกคนอื่น แต่ชื่อและภาพของเธอทำให้ความสัมพันธ์บางอย่างในอดีตเริ่มมีรูปร่างขึ้น | ชื่อของเธออยู่ในเอกสารเก่าของลอดจ์ และภาพของเธอทำให้ความสัมพันธ์บางอย่างในอดีตเริ่มมีรูปร่างขึ้น | ch3:919, ch7:281 to 287 |

Text-level inconsistencies found during research, reported only (prose is out of scope): Lillian's date of death (diary ends 17 September 2019; ch4:457 implies October 2019; ch14:227 says the night of day seven in a five-day round); Jake's military past (ch5:184) against his photographer profile (ch1:167); Sophie's departure date (records 18 September, diary 15 September, probably intended); Diana asking about Marcus's body at ch16:407.

## 13. Out of scope

- Prose changes of any kind.
- New audio recordings, sound effects or illustrations.
- The Kusabi House site.
- A light paper reading theme.
