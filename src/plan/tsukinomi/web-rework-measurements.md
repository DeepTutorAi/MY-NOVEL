# Tsukinomi web rework: measurements

Status: living record, one section per delivery round. Written 2026-10-01.
Source of the budgets: `web-rework-design.md` section 7. A scene that misses a budget is reported here with the measured number; the scene is not adjusted to improve it.

## Method (all rounds)

Every number comes from the same harness, `src/scripts/tsukinomi/scene-measure.ts` (pure parts in `scene-measure-core.ts`, with unit tests), run against a production build served by `astro preview`:

```
GITHUB_ACTIONS=true pnpm exec astro build --force        # CI base /MY-NOVEL/
GITHUB_ACTIONS=true pnpm exec astro preview --port 4450
pnpm exec tsx src/scripts/tsukinomi/scene-measure.ts http://localhost:4450/MY-NOVEL/ \
  --dist dist --targets prologue,part-1,home --json out.json
PUPPETEER_EXECUTABLE_PATH=<chromium with --no-sandbox> \
  node --import tsx src/scripts/tsukinomi/tsukinomi-e2e.ts http://localhost:4450/MY-NOVEL
```

- **Frame cost.** Delta of the CDP `Performance` metric `TaskDuration` (cumulative main-thread task time) over a 5 s window, divided by the `requestAnimationFrame` frames in the window, taken after the scene reports `data-state="playing"` and a settle time (1.5 s; 7 s for the prologue, which auto-starts after 6 s without input). Once at 1280x800 unthrottled and once with `Emulation.setCPUThrottlingRate(4)`. The harness also prints the script, layout, style and "other" parts of that figure, the main thread's busy share, fps, and the cost of an empty page with the same counter (the harness floor: 0.28 to 0.30 ms at 1x and 1.0 to 1.1 ms at 4x in these runs; included in every figure).
- **Flash safety.** `Page.startScreencast` for the whole scene (pages: 12 s); each frame is reduced to the mean WCAG relative luminance of the whole screen and of a 3x3 grid; general flashes per WCAG 2.3.1 are counted in the worst one-second window of each series. The budget is at most 3 flashes in any second.
- **Layout.** Five viewports (375x812, 390x844, 812x375, 667x375, 915x412) plus 1280x800, read about 1 s and 3.5 s into the scene: no horizontal scroll, Skip and every other control in the dialog at least 44x44 px, inside the viewport and not covered, the epigraph clear of the controls. Pages (home) are checked for horizontal scroll and console errors only.
- **Gzip.** Level-9 gzip of the scene's chunk in `dist/_astro` plus the chunks it imports statically. Scene CSS is imported with `?inline`, so it is already inside the JS figure.
- **Verdict rule.** A target passes only if every budget is met conclusively. A frame figure within 15 percent of a budget, or a spread between runs that straddles it, is inconclusive, not a pass.

### Limits that apply to every figure here

- Headless Chromium 141 on a shared 4-core Xeon container, **software rendering (no GPU)**. Rasterisation and canvas presentation that a phone's GPU would do run on the CPU here, and part of that lands on the main thread, so these frame costs are higher than a GPU device would show. They are comparable between rounds on the same machine, not predictions for a phone.
- 4x throttling slows the renderer main thread only. It emulates a slow phone, it is not a phone.
- `TaskDuration` is wall time of tasks, so another process on the machine inflates it. Load average is recorded per run; the CPU-time figures (ThreadTime) are the cross-check.
- Flash analysis sees changes in the mean of the whole screen and of nine cells (a cell is about 11 percent of the screen). A flash in a smaller area, a red flash, and a flash between two screencast frames are not detected. The screencast rate achieved is reported; under 12 frames a second the result is weak evidence.
- A scene that needs input (prologue Play, part 1 wiping) is measured on its no-input path, which is what plays by itself.

### Not verified by this plan (design section 7), after every round

Safari and Firefox rendering; real-device touch feel and real-device frame rates; subjective animation quality (how the rain, the fog, the train or the lamp look and feel); audible audio and the Walkman's restored state (the harness runs with the Walkman off, so no audio is requested).

## R1c measurements (round 1)

Prologue (part 0), part 1 and the home page train.

Measured 2026-10-01 on commit `43d8a1d` plus the uncommitted round-1 work in the working tree (prologue, part 1, concourse and train, harness). Build with `GITHUB_ACTIONS=true`, served at `/MY-NOVEL/`. `pnpm check`: 229 files, 0 errors, 0 warnings. Full unit suite: 748 tests, 747 pass, 0 fail, 1 skipped. In-repo e2e against the same preview: 16 passed, 0 failed, 0 skipped.

### Summary table

Frame cost is the harness figure (main-thread ms per frame, whole frame). Three runs of the frame check against the same preview (run 1 was the full run with flash, layout and gzip as well; runs 2 and 3 were frame-only); machine load average 0.7 to 2.0 on 4 cores. Each cell is mean, with the range of the three runs below it.

| Target | 1x ms/frame (budget 2) | 4x ms/frame (budget 6) | fps 1x / 4x | Flashes per second (budget 3) | gzip KB | Layout (6 viewports) | Verdict |
|---|---|---|---|---|---|---|---|
| Prologue | **8.06** (7.89 to 8.16) | **36.7** (34.7 to 38.9) | 59.5 / 27.0 | 0 (screencast 60 Hz) | 8.16 chunk, 8.56 with imports | ok | **miss both frame budgets** |
| Part 1, autumn | **10.43** (10.00 to 10.70) | **57.0** (53.4 to 60.4) | 59.6 / 17.3 | 0 (screencast 58 Hz) | 6.95 chunk, 9.87 with imports | ok | **miss both frame budgets** |
| Home train | **7.49** (7.13 to 8.17) | **32.8** (31.3 to 34.4) | 3.9 / 3.8 | 0 (screencast 3.6 Hz, weak; see below) | 3.72 script + 5.21 lazy train chunk, 11.77 with imports | ok (scroll and console only) | **miss both frame budgets** |

No frame figure is within 15 percent of its budget, and the spread between runs (3 to 14 percent at 1x and 9 to 12 percent at 4x) is far smaller than the gap to the budget, so these misses are conclusive, not noise. Multiples of the budget (means): prologue 4.0x at 1x and 6.1x at 4x; part 1 5.2x and 9.5x; home 3.7x and 5.5x.

Per-run figures (1x / 4x ms per frame): prologue 8.12 / 34.70, 7.89 / 36.40, 8.16 / 38.94. Part 1 10.70 / 60.38, 10.00 / 57.21, 10.58 / 53.44. Home 8.17 / 31.26, 7.18 / 34.35, 7.13 / 32.80. Raw JSON of the three runs is in the session scratchpad, not in the repository.

Where the harness figure goes (1x, mean of three runs): the scene's own JavaScript is 0.47 ms (prologue), 0.57 ms (part 1), 0.44 ms (home); at 4x 2.3, 3.3 and 3.1 ms. Layout and style add under 0.5 ms at 1x. The remaining 7 to 10 ms is the "other" bucket: browser work on the main thread that is neither script, layout nor style (paint, compositing hand-off, canvas presentation). The CPU-time cross-check agrees with the wall figure (ThreadTime 7.9, 10.3 and 6.6 ms per frame), so the numbers are not a product of machine load. The script-only figure is inside both budgets, but the budget in design section 7 is the mean frame time, so the verdict above uses the whole frame.

### Flash safety

| Target | Worst second, whole screen | Worst second, worst cell | Luminance range | Duration captured | Screencast |
|---|---|---|---|---|---|
| Prologue | 0 | 0 | 0.000 to 0.003 | 28.7 s (ended by itself) | 1613 frames, 60 Hz |
| Part 1 | 0 | 0 | 0.000 to 0.076 (the fade up in the first 4 s, then 0.01) | 20.9 s (ended by itself) | 1119 frames, 58 Hz |
| Home (as shipped) | 0 | 0 | 0.009 to 0.012 | 12 s page capture | 40 frames, 3.6 Hz: **weak evidence** |

The home page runs at about 4 frames a second in this Chromium (cause below), so the harness's own home result is sparse. As a supplementary check (not the harness figure) the same analysis was run with the pre-existing `.sakura-backdrop` hidden by an injected style so the page renders at a usable rate, with every part marked read so the train windows carry film frames: 1280x800, 41 Hz, 0 flashes whole screen and 0 in the worst cell, luminance 0.004 to 0.009; 375x812, 60 Hz, 0 and 0, luminance 0.007 to 0.023; 1280x800 with no read marks, 40 Hz, 0 and 0. This still does not see a flash in an area smaller than a cell (a single lit train window) or a red flash. Flash safety is therefore met on what the method can see, with the home train's small-area behaviour unverified by measurement.

### Layout and e2e

Prologue and part 1: no horizontal scroll, Skip and every other control at least 44x44 px, inside the viewport and on top, epigraph clear of the controls, at 375x812, 390x844, 812x375, 667x375, 915x412 and 1280x800, at both read points. No console errors or uncaught page errors in any target. Home: no horizontal scroll at the six viewports, no console errors; its inline links are not 44 px targets by design and the harness does not test them.

The in-repo e2e (`tsukinomi-e2e.ts`) passed all 16 checks: modal dialog and own epigraph for parts 0 to 5, play / Escape / same-day cooldown / `?resume=1` / replay, Skip with click, Enter, Space and triple click, the scene ending by itself, reduced motion (still, continue button, no scroll behind), soft navigation away mid-scene, a slow scene chunk (held cover plays, a lapsed one drops), layout at the five viewports in motion and still, 200 percent text size, the controls slot, no audio requested with the Walkman off, scroll lock, and no uncaught errors, console errors, third-party hosts or failed requests. It ran through a Chromium wrapper adding `--no-sandbox --disable-gpu`.

### Gzip size per scene

| Scene | Own chunk, gzip (raw) | Static imports, gzip | Total, gzip | Notes |
|---|---|---|---|---|
| Prologue | `prologue.*.js` 8.16 KB (21.41) | graphemes 0.23, styles 0.18 | 8.56 KB | Scene CSS (1.74 KB gzip, unminified source) is inside the chunk |
| Part 1 | `part-1-autumn-rain.*.js` 6.95 KB (17.46) | graphemes 0.23, plate-core 0.63, scene-runtime 1.88, styles 0.18 | 9.87 KB | scene-runtime is shared with the home train and later scenes |
| Home | `Concourse.*.js` 3.72 KB (9.08) loaded with the page; `train-scene.*.js` 5.21 KB (12.24) lazy | lifecycle 0.31, preload-helper 0.65, scene-runtime 1.88 | 11.77 KB | The train chunk is requested only after first paint and idle, and not at all under reduced motion or in short landscape |

The shared dialog engine chunk (`ArcCutscene.*.js`) is about 2.2 KB gzip and loads with the section page. The harness's default home chunk pattern (`concourse`, lower case) matched nothing because the built file is `Concourse.*`; the figures above were taken with `--home-chunk 'Concourse|train-scene'`. The harness default should be made case-insensitive (not changed here: `scene-measure.ts` is not part of this task).

### Missed budgets: measured number and cause

All three targets miss both frame budgets: prologue 8.06 ms at 1x and 36.7 ms at 4x; part 1 10.43 and 57.0; home 7.49 and 32.8 (budgets 2 and 6). No scene code was changed to improve these.

What the diagnostics show. These are not the budget figures: they were taken with a scratch script (not in the repository) that applies the harness's metric but removes parts of the page, so they differ from the harness by 0.3 to 1.0 ms. The shipped scene code is unchanged in all of them. Each row is the same page measured as shipped and with the pre-existing site backdrop `.sakura-backdrop` (the layered Sakura twilight backdrop with three blurred mist layers, a multiply blend and an animated petals canvas, in `SakuraTwilightBackdrop.astro`, which keeps drawing behind the open dialog) hidden by an injected style.

| Page | As shipped, 1x / 4x ms | Backdrop hidden, 1x / 4x ms | fps as shipped to hidden (1x) |
|---|---|---|---|
| Part 2 stub (plate text reveal, no scene code of its own) | 5.89 / 25.7 | 3.19 / 14.1 | 60 to 59 |
| Prologue | 7.43 / 35.3 | 4.91 / 22.2 | 60 to 59 |
| Part 1 | 9.78 / 57.0 | 6.77 / 38.3 | 60 to 60 |
| Home | 7.04 / 29.5 | 1.94 / 9.66 | 3.8 to 60 |

Further reference points from the same harness and build:

- A scene with nothing in the document but the dialog (part 2 stub, every other element hidden): 2.71 ms at 1x and 13.3 ms at 4x. The part 2 stub under the harness as shipped is 7.55 / 27.9. So even the empty shell of a scene is above 2 ms and 6 ms in this Chromium; the budgets cannot be met here by any scene built on this shell.
- Existing pages in the same harness: the site root `/MY-NOVEL/` is 15.0 ms at 1x (60 fps) and 103.7 ms at 4x (9 fps); a section page without a scene (`?resume=1`) is 48.7 ms at 1x and 3.4 fps. The pre-existing site is itself far over the design's 2 and 6 ms in software rendering.
- A Chrome trace of the prologue and part 1 (timing distorted by tracing, so only the ranking is meaningful) puts the browser's software canvas presentation (`CanvasResourceProviderSharedImage::ProduceCanvasResource`) at the top of main-thread self time, far above script. Scripts are about 0.5 ms a frame. The prologue and part 1 each draw one or more full-viewport canvases at 1280x800 and the backdrop's petals canvas is a further one; in a GPU-backed browser this presentation cost would likely not sit on the main thread (an inference, not measured).

Causes, by target.

- **Prologue and part 1.** The scene JavaScript is not the cost (0.47 and 0.57 ms a frame). The cost is the per-frame presentation of full-viewport canvases and layers in a software-rendered browser (2 canvases in the prologue, 3 in part 1, plus the site's petals canvas), on top of a floor of about 2.7 ms for the dialog shell and about 2.5 to 3.0 ms for the backdrop animating behind the dialog. Part 1 is the heaviest, plausibly because it keeps three full-viewport canvases (plate, fog at reduced resolution, rain) where the prologue has two. Even with the backdrop removed they are 4.9 and 6.8 ms. What the scenes add beyond the part 2 stub shell is indicative only, because the stub was sampled once per method: against the harness stub (7.55) the prologue adds about 0.5 ms and part 1 about 2.9 ms; against the scratch-script stub (5.89) about 1.5 ms and 3.9 ms. How much of that a GPU device would also pay is not known.
- **Home.** As shipped the page runs at about 4 frames a second here, with the main thread only 3 percent busy: the limit is the pre-existing backdrop being software-rendered (its blurred mist layers are the likely part; they were not separated from the petals canvas and the blend), not the train. With the train's chunk blocked the page is still 5.87 ms and 4.4 fps (21.7 ms at 4x); the train adds about 1.2 ms at 1x (7.04), about 2.2 ms with all eight film frames loaded for a reader who has read every part (8.06 ms, 4.4 fps; 39.9 ms at 4x). With the backdrop hidden the home page with the train is 1.94 ms at 1x and 60 fps, which is within 15 percent of the 2 ms budget (inconclusive on its own), and 9.66 ms at 4x, which is over 6 ms. The harness's home number therefore mostly measures the existing backdrop, and the train's own share at 1x is about 1 to 2 ms.
- **Unknown.** Whether any target meets its budget on a real phone or a desktop with a GPU. The causes above point at software rendering, but that is an inference from where the time goes, not a measurement on a GPU.

For the author to decide (design section 7 says to report, not to adjust): whether the 2 ms and 6 ms budgets stand as whole-frame main-thread cost measured in software rendering (every scene, and the existing site, will fail them there), or are judged on a GPU-backed browser or a real device, or on script, layout and style only (all three targets are inside the budgets on that reading: 0.4 to 0.6 ms at 1x, 2.3 to 3.3 ms at 4x). Whether the `.sakura-backdrop` should pause while a cutscene dialog is open is also the author's call: it is outside the scene files and was not changed; pausing it would remove about 2.5 to 3 ms per frame from every scene figure and make the home page render at 60 fps here.

### What this round did not measure

- Safari and Firefox (Chromium 141 only).
- Any real device: no phone, no GPU, no real touch (touch is emulated at the phone viewports).
- Subjective quality: how the rain, fog, Walkman wire, lamp and train look and feel.
- Audio: the Walkman was off in every run; the prologue's tape click and hiss, part 1's train sound and the music cues were not exercised, so their cost and behaviour (including restoring the reader's settings) are unmeasured.
- The input paths: the prologue after Play is pressed, and part 1 while the fog is being wiped by dragging. Only the paths that play by themselves were measured.
- Small-area and red flashes (a single lit train window, a lamp) and flashes between screencast frames.
- The home train for a reader part-way through the story (only no marks and all six marked read were looked at, in diagnostics), and a slow network (film frames arriving late).
- `pnpm sea:verify-dist` and the repository gates other than `pnpm check`, the unit suite and the e2e (not part of this task).
