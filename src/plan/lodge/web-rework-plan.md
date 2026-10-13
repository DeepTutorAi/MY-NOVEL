# Hvitveldt Lodge Web Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/lodge/` site as a graphite case file (notebook, GUEST RECORDS, Karlsen's board) with a restrained progress-driven mimic layer, five canvas cutscenes and a finale that casts the reader as the next guest.

**Architecture:** Pure rule modules (`*-core.ts`, unit tested with `node:test`) feed thin DOM and canvas layers. Canvas work runs on `src/scripts/_shared/scene-runtime.ts` through a Lodge kit; cutscenes run on the shared `createCutsceneRunner`. Progress-gated behaviour reads one module, `progress-core.ts`. Markdown changes go through the existing remark plugins in `astro.config.mjs`.

**Tech Stack:** Astro 5.18.2 (ClientRouter), TypeScript, Canvas 2D, CSS scroll-driven animation, `remark-directive` 4.0.0, `node:test` via `tsx --test`, Puppeteer with installed Chrome, pnpm 10.33.0, `@fontsource/sriracha` 5.3.0.

**Spec:** `src/plan/lodge/web-rework-design.md` (approved 2026-10-13). Section numbers below (§) refer to it.

## Global Constraints

- Story prose is never changed. Chapter files change only on the 25 journal opening lines (§6.2) and five `hand` marks in `18-mirror.md` (§6.3).
- Story text stays real DOM text; reading font, `--reading-size`, `--measure`, `--line-height-body` and the dark theme (`--paper: #0E0D0C`, `--ink: #ECE7DD`) are unchanged.
- Flash count 0 on every scene and page (WCAG 2.3.1). Luminance ramps of large areas take at least 1 s.
- Every animated surface has a still state under `prefers-reduced-motion: reduce` or when `hvitveldt:motion:snow` is off.
- Controls are real `<button>` or `<a>`, at least 44 px, keyboard reachable. Decorative canvases are `aria-hidden="true"`.
- Thai text: never `inline-block` or `transform` on spans inside running text; wrap whole grapheme clusters (`splitGraphemes` from `src/scripts/_shared/cutscene/graphemes.ts`).
- Untrusted strings (guest name, stored JSON) are rendered with `textContent` only and validated before use; malformed storage is treated as absent, never thrown.
- New storage keys `hvitveldt:guest`, `hvitveldt:suspects`, `hvitveldt:finale:seen` are added to the prefix list in `ProfileStorageInterceptor.astro`.
- Progress gates use `FINISHED = 0.995`; the existing Subject 8 unlock keeps `UNLOCK = 0.8`.
- Not reused from Tsukinomi: trains, tape, petals, film frames, fog wiping, press-and-hold verbs, twilight colour.
- Code, comments, commits and docs in neutral English. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work in a worktree: `git -c core.autocrlf=false worktree add C:/tmp/lodge-rework -b claude/lodge-rework main`. No push, merge or branch deletion without the author's instruction.

## Review Focus

1. A guest name made of emoji, combining marks or 200 characters: stored trimmed to 40 grapheme clusters, rendered intact without splitting a cluster. Test in Task 2.
2. Reading progress written under another profile (`...:p_other` suffix) must not raise this profile's drift level or stamps. Test in Task 1.
3. Navigating away (ClientRouter swap) mid-cutscene or mid-home-scene leaves no running loop, no `overflow: hidden` on the next page, and no stale `body` class. Tests in Tasks 6 and 13 (e2e).
4. Storage that throws on `setItem` (private mode, quota): guest book shows the session-only notice, suspicion pins still toggle for the session, the page keeps working. Tests in Tasks 7 and 20.
5. A reader who finishes chapter 18 without finishing 5 or 12 gets level 1, not level 4, and sees no finale. Test in Task 1.

---

## Round L0: foundations

### Task 1: Progress core

**Files:**
- Create: `src/scripts/lodge/progress-core.ts`
- Test: `src/scripts/lodge/progress-core.test.ts`
- Modify: `src/pages/lodge/characters.astro` (replace `getMaxChapterRead` scan with the core, `UNLOCK` threshold, behaviour unchanged)

**Interfaces:**
- Produces:
  - `FINISHED = 0.995`, `UNLOCK = 0.8`, `CHAPTER_KEY_PREFIX = "hvitveldt:reading:chapter:"`
  - `type DriftLevel = 0 | 1 | 2 | 3 | 4`
  - `readChapterProgress(entries: Iterable<readonly [key: string, raw: string | null]>, activeProfile: string): Map<number, number>` keeps the max progress per chapter number (taken from the record's `chapterNumber` field); skips keys outside the prefix, keys of other profiles (contain `:p_` and do not end with `:${activeProfile}`), unparsable JSON, non-finite numbers.
  - `finishedChapters(progress: ReadonlyMap<number, number>, threshold: number): Set<number>`
  - `furthestAtLeast(progress, threshold): number` (0 when none)
  - `lodgeDrift(finished: ReadonlySet<number>): DriftLevel` per §4.1: 4 if {5,12,18} ⊆ finished; 3 if {5,12}; 2 if 5; 1 if non-empty; else 0.
  - `storageEntries(storage: Storage): Array<[string, string | null]>` (browser helper, try/catch, returns `[]` on throw)
  - `activeProfileId(storage: Storage): string` (reads `piichan-novels:active-profile-id`, default `"guest"`)

- [ ] **Step 1: Write failing tests**: `lodgeDrift` table rows (∅→0, {1}→1, {1..5}→2, {1..12}→3, {1..18}→4, {18}→1, {5,18}→2); `readChapterProgress` ignores `hvitveldt:reading:chapter:01-arrival:p_other` when active is `p_me`, accepts unsuffixed legacy keys, keeps max of duplicates, ignores `"{bad"`; `finishedChapters(…, FINISHED)` excludes 0.99 and includes 0.995.
- [ ] **Step 2:** Run `pnpm exec tsx --test src/scripts/lodge/progress-core.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement the module.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Switch `characters.astro` to `readChapterProgress` + `furthestAtLeast(…, UNLOCK)`, still honouring `last.maxChapterNumber`. Run `pnpm check`. Expected: 0 errors.
- [ ] **Step 6:** Commit `feat(lodge): progress core for drift levels and unlock thresholds`.

### Task 2: Guest core and profile keys

**Files:**
- Create: `src/scripts/lodge/guest-core.ts`, test `src/scripts/lodge/guest-core.test.ts`
- Modify: `src/components/_shared/ProfileStorageInterceptor.astro` (add the three new keys to `prefixes`)

**Interfaces:**
- Produces:
  - `GUEST_KEY = "hvitveldt:guest"`, `GUEST_NAME_MAX = 40`
  - `interface GuestRecord { name: string | null; signedAt: string; skipped: boolean }`
  - `normalizeGuestName(input: string): string | null` (trim, collapse whitespace, strip `\p{Cc}`, cap at 40 grapheme clusters via `splitGraphemes`, empty → null)
  - `parseGuestRecord(raw: string | null): GuestRecord | null`
  - `guestMonthLabel(iso: string): string` → e.g. `"Oct 2026"` (English month abbreviation, matches chapter 3 record style)

- [ ] **Step 1: Failing tests**: `normalizeGuestName("  เอ   ลีน่า \u0007 ")` → `"เอ ลีน่า"`; a 200-char Thai string → 40 clusters, last cluster complete (no lone combining mark); `""`/`"   "` → null; `parseGuestRecord('{"name":1}')` → null; valid JSON round-trips; `guestMonthLabel("2026-10-13T00:00:00Z")` → `"Oct 2026"`. Contract: interceptor source contains each of the three new key strings.
- [ ] **Step 2:** Run `pnpm exec tsx --test src/scripts/lodge/guest-core.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement; edit the interceptor list.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(lodge): guest record rules and profile-scoped keys`.

### Task 3: Lodge e2e and measurement tooling, baseline

**Files:**
- Create: `src/scripts/lodge/lodge-e2e.ts`, `src/scripts/lodge/scene-measure.ts`, `src/plan/lodge/web-rework-measurements.md`
- Modify: `package.json` scripts: `"lodge:e2e": "tsx src/scripts/lodge/lodge-e2e.ts"`, `"lodge:measure": "tsx src/scripts/lodge/scene-measure.ts"`

**Interfaces:**
- Consumes: `scene-measure-core.ts` exports (`frameCost`, `perfSampleFromMetrics`, `analyseFlashes`, `findTransitions`, `judgeLayout`, `percentile`).
- Produces: e2e `check(name, run)` harness with `LODGE_E2E_ONLY` filter, base URL as `argv[2]` (same conventions as `tsukinomi-e2e.ts`); measure targets `home`, `cutscene-0|1|6|13|18`, `url:<path>`, flags `--targets --checks --json --viewports` as in the Tsukinomi harness.

- [ ] **Step 1:** Write e2e baseline checks: home, `/lodge/chapters/`, `/lodge/chapters/01-arrival/`, `/lodge/characters/` return 200 with no console errors and no third-party requests.
- [ ] **Step 2:** Build (`GITHUB_ACTIONS=true pnpm build`, rebuild once if fewer than 48 pages), serve with `pnpm preview --port 4470`, run `pnpm lodge:e2e http://localhost:4470/MY-NOVEL`. Expected: all PASS.
- [ ] **Step 3:** Run `pnpm lodge:measure http://localhost:4470/MY-NOVEL --targets home --json` and screenshot the chapter 1 cutscene to confirm or rule out baseline B4. Record both in the measurements doc under "Baseline".
- [ ] **Step 4:** Commit `test(lodge): e2e and measurement harness with baseline`.

### Task 4: Tokens, handwriting font, Lodge kit

**Files:**
- Modify: `package.json` (add `@fontsource/sriracha@5.3.0`), `src/layouts/lodge/LodgeBaseLayout.astro` (import Thai + Latin 400 subsets), `src/styles/lodge/global.css` (tokens `--graphite-1..4`, `--paper-grain` (url to an inline SVG noise), `--stamp-red: #8B3A2E`, `--font-hand: "Sriracha", var(--font-thai)`)
- Create: `src/scripts/lodge/scenes/kit.ts`, `src/scripts/lodge/scenes/kit-core.ts`, test `kit-core.test.ts`

**Interfaces:**
- Produces (kit-core, pure): `coverRect(srcW, srcH, dstW, dstH): {x,y,w,h}`; `platePoint(rect, u, v): {x,y}`; `hatchLines(w, h, spacing, angleRad): Array<[x1,y1,x2,y2]>`; `luminanceRamp(t: number, durationS: number): number` (smoothstep, used to keep veils ≥1 s).
- Produces (kit, DOM): `loadPlate(url, signal): Promise<HTMLImageElement>`; `makeLayer(w,h): {canvas, ctx}`; `paperGrain(ctx, w, h, seed)`; `smudge(ctx, x, y, r, alpha)`; `pencilFlake(ctx, x, y, len, angle, alpha)`; `erase(ctx, draw: () => void)` (destination-out wrapper); `runLodgeScene(opts: { canvas: HTMLCanvasElement; signal: AbortSignal; still: boolean; layout(size: SceneSize): void; render(frame: SceneFrame): void }): SceneHandle` built on `createScene`.

- [ ] **Step 1:** Verify the installed package ships Thai files: `ls node_modules/@fontsource/sriracha/files | grep thai`. Expected: `sriracha-thai-400-normal.woff2` present.
- [ ] **Step 2: Failing tests** for kit-core: `coverRect(1916,821,390,844)` fills height and centres; `platePoint` maps (0.5,0.5) to centre; `luminanceRamp(0.5,1)` = 0.5 and is monotonic; `hatchLines` covers the box.
- [ ] **Step 3:** Run, FAIL; implement; run, PASS.
- [ ] **Step 4:** `pnpm check` and build. Expected: 0 errors, 48 pages.
- [ ] **Step 5:** Commit `feat(lodge): graphite tokens, handwriting face and canvas kit`.

---

## Round L1: home, guest book, GUEST RECORDS

### Task 5: Whiteout rules

**Files:** Create `src/scripts/lodge/home/whiteout-core.ts`, test `whiteout-core.test.ts`.

**Interfaces:**
- Produces:
  - `STRIDE_PX = 34`, `PRINT_FADE_S = 8`, `FOLLOW_DELAY_S = { 2: 0.5, 3: 0.3 }`, `STILL_TURN_S = 3`, `GUST_EVERY_S = [25, 45]`, `GUST_LENGTH_S = [2, 3]`
  - `placeSteps(path: ReadonlyArray<{x,y,t}>, stride: number): Array<{x,y,t,angle,side: "L"|"R"}>`
  - `printAlpha(ageS: number): number` (1 → 0 over `PRINT_FADE_S`)
  - `followerSteps(steps, level: DriftLevel, nowS: number): steps` (empty below 2 and at 4; delayed by `FOLLOW_DELAY_S[level]`)
  - `shadowCount(level: DriftLevel): number` → 0,0,7,6,0
  - `shadowTurn(stillForS: number, index: number): number` (0..1, staggered 0.4 s per index after `STILL_TURN_S`)
  - `gustVeil(tS: number, schedule: number[]): number` (0..1; rises and falls over ≥1 s)
  - `nextGustAt(rng: () => number, afterS: number): number`

- [ ] **Step 1: Failing tests**: steps alternate L/R at stride; `printAlpha(8)` = 0; follower empty at levels 0, 1 and 4, and lags exactly 0.5 s at 2; `shadowCount` table; `shadowTurn(2.9, 0)` = 0; max veil slope ≤ 1 per second over the whole gust; `nextGustAt` within 25–45 s.
- [ ] **Step 2:** FAIL → implement → PASS (`pnpm exec tsx --test src/scripts/lodge/home/whiteout-core.test.ts`).
- [ ] **Step 3:** Commit `feat(lodge): whiteout scene rules`.

### Task 6: Whiteout scene on the home page

**Files:**
- Create: `src/scripts/lodge/home/whiteout-scene.ts`, `whiteout-loader.ts`, contract test `whiteout-contract.test.ts`
- Modify: `src/pages/lodge/index.astro` (mount `<div class="lodge-whiteout" aria-hidden="true" data-whiteout-mount>`, keep `<picture>` underneath), `src/components/lodge/atmosphere/SnowCanvas.astro` (pause while `body.lodge-whiteout-live`), `src/styles/lodge/polish.css`

**Interfaces:**
- Consumes: Task 1 (`lodgeDrift`, `finishedChapters`, `storageEntries`, `activeProfileId`), Task 4 kit, Task 5 rules.
- Produces: `mountWhiteout({ mount, level, still, mirrored, seed }): { setStill(v: boolean): void; destroy(): void }`; `startWhiteout({ mount }): () => void` (two rAFs then dynamic import, reads motion switch `hvitveldt:motion:snow` and `hvitveldt:motion-change`, sets `body.lodge-whiteout-live`, sets `mount.dataset.drift`). `mirrored` is wired in Task 22.

- [ ] **Step 1: Contract tests** (source rules, same style as `moonsea-contract.test.ts`): scene only reached via `await import("./whiteout-scene")`; loader listens to `hvitveldt:motion-change`; destroy on `astro:before-swap`; mount is `aria-hidden`; no `innerHTML`.
- [ ] **Step 2:** FAIL → implement scene (baked plate + grain per size; three flake depths; footprints from pointer path on the lower 30 % band; follower and shadows per level; gust veil; scroll fade to paper; still frame; procedural sky if the plate fails) → PASS.
- [ ] **Step 3: e2e checks**: seeded progress for levels 0, 2, 3 gives `data-drift` 0/2/3; reduced motion renders one still frame (no rAF after 2 s); navigating to `/lodge/chapters/` and back leaves exactly one canvas and no `lodge-whiteout-live` on the chapters page.
- [ ] **Step 4:** `pnpm lodge:measure … --targets home` → flashes 0; record frame time. Screenshots at six viewports.
- [ ] **Step 5:** Commit `feat(lodge): graphite whiteout scene on the home page`.

### Task 7: Guest book

**Files:**
- Create: `src/components/lodge/home/GuestBook.astro`, `src/scripts/lodge/home/guest-book.ts`
- Modify: `src/pages/lodge/index.astro` (inside `#found-note`, after the intro paragraph)

**Interfaces:**
- Consumes: Task 2.
- Produces: markup `[data-guest-card]` with `[data-guest-name]`, `[data-guest-referred]`, `[data-guest-month]`; buttons `[data-guest-sign]` "เซ็นชื่อ", `[data-guest-skip]` "ข้าม", `[data-guest-edit]` "แก้ชื่อ", `[data-guest-erase]` "ลบลายเซ็น"; `renderGuestCard(root: HTMLElement, record: GuestRecord | null, level: DriftLevel): void` reused by Tasks 8 and 22.

- [ ] **Step 1: e2e checks**: sign "เอลีน่า" → reload → name shown; skip → `GUEST`; edit and erase persist; with `localStorage.setItem` throwing (override in `evaluateOnNewDocument`), signing shows "เบราว์เซอร์ไม่อนุญาตให้บันทึก ชื่อจะหายเมื่อปิดหน้า" and the start link still navigates; a name `<img src=x onerror=alert(1)>` renders as text.
- [ ] **Step 2:** FAIL → implement (card fields exactly as §5.2; signature reveal by `clip-path` sweep in `--font-hand`, none under reduced motion) → PASS.
- [ ] **Step 3:** Commit `feat(lodge): optional guest book on the home page`.

### Task 8: GUEST RECORDS table of contents

**Files:** Modify `src/pages/lodge/chapters/index.astro`, `src/styles/lodge/polish.css`; create `src/scripts/lodge/toc/ledger.ts`.

**Interfaces:**
- Consumes: Task 1 (`readChapterProgress`, `FINISHED`), Task 7 `renderGuestCard`.
- Produces: each row `[data-ledger-row][data-chapter-id]` with `[data-ledger-status]` text "ยังไม่เปิด" / "อ่านไป N%" / stamp `READ`; final `[data-guest-card]`.

- [ ] **Step 1: e2e checks**: seeded progress 0.4 on chapter 2 shows "อ่านไป 40%"; 0.995 on chapter 1 shows `READ`; no row contains `DEPARTED`; every chapter link present in order; guest card last.
- [ ] **Step 2:** FAIL → implement (cover `GUEST RECORDS`, rows grouped by `ACTS`, `--font-mono` ledger lines) → PASS.
- [ ] **Step 3:** Round gates (§10). Commit `feat(lodge): GUEST RECORDS table of contents`.

---

## Round L2: the notebook reader

### Task 9: Journal kinds

**Files:**
- Modify: `astro.config.mjs` (`remarkJournalDirective`), the 8 chapter files with journals (opening lines only, kinds from §6.2 table), `src/styles/lodge/chapter.css`
- Create: `src/plugins/remark-journal-kind.mjs` exporting `journalClassName(attributes, location)`; tests `src/scripts/lodge/journal-kind.test.ts`, `src/scripts/lodge/journal-content-contract.test.ts`

**Interfaces:**
- Produces: `JOURNAL_KINDS = ["elena", "hand", "print"]`; `journalClassName(attrs: Record<string,string>|undefined, where: string): string[]` → `["journal", "journal--<kind>"]`, throws `Error("<where>: journal kind missing or unknown")` otherwise. Plugin passes `file.path:line` as `where`.

- [ ] **Step 1: Failing tests**: `journalClassName({kind:"elena"})` → `["journal","journal--elena"]`; `{}` and `{kind:"x"}` throw with the location; content contract: exactly 25 `:::สมุดบันทึก{kind=…}` openings, kinds match the §6.2 table by `file:line`, zero bare `:::สมุดบันทึก` lines.
- [ ] **Step 2:** FAIL → implement plugin change, edit the 25 opening lines → PASS.
- [ ] **Step 3:** CSS for three kinds (§6.2 Look column). Build: 48 pages; `git diff --stat src/content` shows only the 25 changed lines (`git diff -U0 src/content | grep -c '^+[^+]'` = 25).
- [ ] **Step 4:** Commit `feat(lodge): three journal kinds`.

### Task 10: Handwriting drift in chapter 18

**Files:**
- Modify: `astro.config.mjs` (`hand` allowed in `remarkNeutralizeStrayDirectives`; new handler), `src/content/lodge/chapters/18-mirror.md` (five marks, §6.3 table), `src/styles/lodge/chapter.css`
- Create: `src/plugins/hand-drift.mjs` (`driftClusters`), `src/plugins/remark-hand.mjs` (turns `:hand[...]{day}` into the spans below using `driftClusters`); test `src/scripts/lodge/hand-drift.test.ts`; drift stroke SVGs as CSS `url("data:image/svg+xml,…")`

**Interfaces:**
- Produces: `<span class="hand hand--day-<3|4|5>">` containing `<span class="hand-g hand-g--<k|kh|s>">cluster</span>` for clusters starting with ก/ข/ส; other clusters plain text. Throws on day outside 3–5. Reused by Task 21 in the browser. The pure function lives in `src/plugins/hand-drift.mjs` (plain JS with JSDoc types, grapheme split with `Intl.Segmenter("th", { granularity: "grapheme" })`) so both `astro.config.mjs` and browser code import it: `driftClusters(text: string, day: number): Array<{ text: string; glyph: "k" | "kh" | "s" | null }>`.

- [ ] **Step 1: Failing tests**: `driftClusters("กี่", 5)` → one cluster `"กี่"` glyph `k`; `driftClusters("ส้ม",3)` → `["ส้", "ม"]` with `s`, null; day 6 throws; contract: `hand` directives appear only in `18-mirror.md` at lines 521, 529, 531, 533, 545; no rule in `.hand*` CSS uses `inline-block` or `transform`.
- [ ] **Step 2:** FAIL → implement → PASS. Screenshot lines 519–551 at 390 px and 1440 px; Thai line breaks unchanged against a pre-change screenshot.
- [ ] **Step 3:** Commit `feat(lodge): canon handwriting drift in chapter 18`.

### Task 11: Notebook page, sketching figures, reader surfaces

**Files:** Modify `src/styles/lodge/chapter.css`, `src/components/lodge/reading/ChapterHeader.astro`, `Dropcap.astro`, `src/components/lodge/marks/EndOfChapter.astro`, `src/components/lodge/atmosphere/SnowCanvas.astro` (pencil-stroke flakes), `src/components/lodge/navigation/TableOfContents.astro` (ledger look); contract test `src/scripts/lodge/reader-contract.test.ts`.

- [ ] **Step 1: Contract tests**: reading tokens unchanged (`--reading-size`, `--measure`, `--line-height-body` values as in §Global); `.chapter-figure` sketch animation sits inside `@supports (animation-timeline: view())` and inside `@media (prefers-reduced-motion: no-preference)`; TOC menu keeps `hvitveldt:secret:reads` logic and every `data-chapter-id`.
- [ ] **Step 2:** FAIL → implement (§6.1, §6.4, §6.6) → PASS.
- [ ] **Step 3:** Screenshots: three journal kinds and a mid-sketch figure at six viewports; scroll frame time via `lodge:measure --targets url:/lodge/chapters/03-morning-without-marcus/`.
- [ ] **Step 4:** Commit `feat(lodge): notebook reader and sketching figures`.

### Task 12: Candle progress

**Files:** Modify `src/components/lodge/reading/ReaderAmbience.astro`, `ReadingProgress.astro` (dispatch `hvitveldt:reading-progress` CustomEvent `{ progress: number, sectionMarks: number[] }` on each save tick); create `src/scripts/lodge/reading/candle-core.ts`, test `candle-core.test.ts`.

**Interfaces:**
- Produces: `candleHeight(progress: number): number` (1 → 0.12 floor), `dripsFor(marks: number[], progress: number): number[]`, `flameState(progress: number): "lit" | "guttering" | "out"` (`guttering` from 0.98, `out` at ≥ 0.995).

- [ ] **Step 1: Failing tests** on the three functions; e2e: candle `--candle-height` decreases after scrolling half the chapter; stays `aria-hidden`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Round gates (§10). Commit `feat(lodge): candle as chapter progress`.

---

## Round L3: cutscenes

### Task 13: Lodge cutscene adapter on the shared runner

**Files:**
- Create: `src/scripts/lodge/cutscene/index.ts`, `epigraphs.ts` (move `EPIGRAPHS` out of the layout verbatim), `registry.ts`, `scene-types.ts`, `reveal.ts`; tests `epigraphs.test.ts`, `registry.test.ts`, `reveal.test.ts`
- Modify: `src/layouts/lodge/LodgeChapterLayout.astro` (remove inline overlay script and its global CSS; render `<dialog class="lodge-cutscene" data-lodge-cutscene>` with epigraph `<p>` holding the full text, `<button data-cutscene-skip>ข้าม</button>`, `<button data-cutscene-continue>เดินทางต่อ</button>`, canvas mount), `ChapterHeader.astro` (link "เล่นฉากเปิดอีกครั้ง" → `?cutscene=replay`, only on chapters 0, 1, 6, 13, 18)

**Interfaces:**
- Consumes: `createCutsceneRunner` (`playedKey: "hvitveldt:cutscene:played:" + n`, `focusAfterClose` = chapter header heading, `reducedMotion` = media query OR motion switch off).
- Produces: `interface LodgeSceneContext { canvas: HTMLCanvasElement; textEl: HTMLElement; controls: HTMLElement; signal: AbortSignal; still: boolean; reveal: Reveal; complete(): void }`; `interface LodgeSceneModule { play(ctx): { pause?(); dispose?() }; still(ctx): void }`; `SCENE_CHAPTERS = [0, 1, 6, 13, 18]`; `createReveal(textEl, text): Reveal` with `Reveal = { show(fraction: number): void; showAll(): void; graphemeCount: number }` (wraps clusters in inline spans, opacity only).

- [ ] **Step 1: Failing tests**: `EPIGRAPHS` equals the five strings formerly in the layout character for character (fixture copied from `git show main:src/layouts/lodge/LodgeChapterLayout.astro`); registry has exactly `SCENE_CHAPTERS`; `createReveal` on a fake DOM keeps `textContent` equal to the epigraph and never splits a cluster.
- [ ] **Step 2:** FAIL → implement adapter with a neutral scene (text reveal over paper) for all five chapters → PASS.
- [ ] **Step 3: e2e**: dialog opens with full text in DOM; skip at t = 0 closes; Escape closes; focus lands on the chapter heading; second visit same day stays closed; `?cutscene=replay` plays; reduced motion shows still with "เดินทางต่อ"; soft navigation mid-scene leaves no `overflow: hidden`; no caret element.
- [ ] **Step 4:** Commit `feat(lodge): cutscenes on the shared runner`.

### Tasks 14–18: The five scenes

Each scene task has the same shape. Files: `src/scripts/lodge/cutscene/scenes/<name>-core.ts` (+ `.test.ts`), `<name>.ts`, `<name>.css`; registry entry switched from neutral to the scene. Steps: failing core tests → implement core → PASS → implement scene on the kit (play and still) → `lodge:measure --targets cutscene-<n>` flashes 0, frame time recorded → screenshots six viewports → commit `feat(lodge): chapter <n> cutscene`. Total length ≤ 20 s; text fully revealed by 14 s at the latest.

| Task | Chapter, file stem | Core functions and pinned values | Scene notes (§7.3) |
|---|---|---|---|
| 14 | 0, `notebook` | `coverAngle(t)` 0→π over 1.6 s after "เปิดสมุด"; `inkWord(index)` returns `"first"` / `"last"` / null for the two "ฉัน" occurrences; `ringGlint(t)` amplitude ≤ 0.15 | Button `[data-scene-open]` "เปิดสมุด"; gold ring on the table; last "ฉัน" uses `hand--day-3` style |
| 15 | 1, `headlights` | `beamLength(high: boolean, t)` 0.35→0.85 of height over 0.6 s; `trunkVisible(high, beamLen)` true only when `beamLen ≥ 0.7`; `TRUNK_COUNT = 7`; `lodgeLightAt = 15 s` | Hold pointer or toggle `[data-scene-highbeam]` "ไฟสูง" (`aria-pressed`) |
| 16 | 6, `lamp` | `lightAt(cursor, t)`; `LINGER_S = 0.5` only inside Ben's region (plate `06A`, region from `platePoint`), 0 elsewhere; `autoPath(t)` for no pointer; firelight modulation ≤ 0.08 per second | Plate `06A.webp` |
| 17 | 13, `descent` | `STEPS = 12`; `stepFromDrag(dy, stepPx)`; `symbolGlow(beamAngle, symbolAngle)`; `hoardVisible(step)` true at `STEPS` | Drag/scroll or `[data-scene-step]` "ลงต่อ"; invented drum-style symbols only |
| 18 | 18, `mirror` | `reflectionLag(t)` 0.5 s until 12 s, then −0.25 s (leads) from 14 s; `mirrorReveal(t)` finishes 1.5 s before the real text; `mergeAt = 17 s` | Epigraph drawn mirrored on canvas; no use of `18B` |

---

## Round L4: board, finale, remaining pages

### Task 19: Fates and card copy

**Files:** Create `src/data/lodge/fates.ts`, test `src/scripts/lodge/fates.test.ts`; modify `src/data/lodge/characters.ts` (only the five field changes in §12 decision 9).

**Interfaces:**
- Produces: `interface FateStamp { chapter: number; stamp: string; ref: string; note?: true }`; `interface CharacterFate { name: string; fileNumber?: { label: string; chapter: number }; stamps: FateStamp[] }`; `FATES: CharacterFate[]` exactly per §8.4; `visibleStamps(fate, finished: ReadonlySet<number>): Array<FateStamp & { superseded: boolean }>` (notes never supersede).

- [ ] **Step 1: Failing tests**: every `FATES[].name` exists in `characters.ts`; chapters within 1–18; stamps ordered by chapter; Marcus with finished {1..7} shows `MISSING`(superseded), `DEAD`(superseded), `BODY GONE`; Tom's `COPY AT LARGE` never supersedes `DEAD`; `characters.ts` contains "Sophie Walters" and not "Sophie Hale" as a name, image path unchanged.
- [ ] **Step 2:** FAIL → implement → PASS. Commit `feat(lodge): fate table and card copy matching the text`.

### Task 20: Karlsen's board

**Files:** Modify `src/pages/lodge/characters.astro`, `src/styles/lodge/polish.css`; create `src/scripts/lodge/board/board.ts`, `board-core.ts` (+ test).

**Interfaces:**
- Consumes: Tasks 1, 19.
- Produces: `SUSPECTS_KEY = "hvitveldt:suspects"`; `parseSuspects(raw, knownNames): string[]`; `toggleSuspect(list, name): string[]`; card markup `[data-board-card][data-name]`, `button[data-suspect][aria-pressed]` "สงสัย", `[data-stamps]`, `[data-file-number]`.

- [ ] **Step 1: Failing tests**: `parseSuspects('["Diana Webb","Nobody"]', names)` → `["Diana Webb"]`; malformed → `[]`. e2e: pin persists; with throwing storage the pin toggles for the session; seeded finished {1..7} shows Marcus's three stamps with two crossed out; Subject 8 card behaviour unchanged (hidden before 17 at `UNLOCK`, manual unlock, toast).
- [ ] **Step 2:** FAIL → implement → PASS. Commit `feat(lodge): Karlsen's board with suspicion pins and fate stamps`.

### Task 21: Finale

**Files:** Modify `whiteout-scene.ts` (`mirrored`: bare long-toed own prints, no follower, no shadows, one lit window), `whiteout-loader.ts` (`hvitveldt:finale:seen` flip once over 1.5 s), `src/pages/lodge/index.astro` (note "รอบถัดไป · กุมภาพันธ์ 2026", hero layout mirrored at level 4, text not mirrored), `guest-book.ts` (`REFERRED BY` `E. VASQUEZ` at level 4; signature through `driftClusters(name, 5)`), `board.ts` (reader card pinned last, Elena `SUBJECT 8`, line listing suspects and whether Elena was suspected).

- [ ] **Step 1: e2e checks** with seeded finished {1..18}: `data-drift="4"`, `data-mirrored="true"` on mount; `getComputedStyle(h1).transform` is `none`; referred field reads `E. VASQUEZ`; Thai name "สมชาย" renders a `hand-g--s` span; Latin name has none; note text present; board shows reader card last; with finished {18} only, none of these appear.
- [ ] **Step 2:** FAIL → implement → PASS. Measure home at level 4: flashes 0 during the flip.
- [ ] **Step 3:** Commit `feat(lodge): finale after chapter 18`.

### Task 22: Puzzle and Extra pages, closing

**Files:** Modify `src/pages/lodge/puzzle.astro`, `src/pages/lodge/extra/index.astro` styles only; update `src/plan/lodge/web-rework-measurements.md`.

- [ ] **Step 1:** Restyle with the graphite tokens and paper grain; contract test that secret-read and puzzle-unlock code is byte-identical to main.
- [ ] **Step 2:** Full gates (§10): `pnpm check` 0/0/0; `pnpm exec tsx --test "src/**/*.test.ts"` 0 failures; `GITHUB_ACTIONS=true pnpm build` 48 pages; `pnpm sea:verify-dist`; `pnpm lodge:e2e` and `pnpm tsukinomi:e2e` against the preview; `pnpm lodge:measure` all targets at six viewports.
- [ ] **Step 3:** Write the measurements doc (per-scene ms per frame p50/p95 at 1x and 4x throttle, flash counts, layout results, unverified list: Safari, Firefox, real phones, audio).
- [ ] **Step 4:** Commit `docs(lodge): rework measurements`. Report to the author; merge, push, deploy and cleanup wait for instruction.
