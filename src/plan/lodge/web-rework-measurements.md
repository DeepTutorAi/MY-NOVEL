# Hvitveldt Lodge web rework: measurements

Every number comes from the shared harness `src/scripts/tsukinomi/scene-measure.ts`, run for this novel with `pnpm lodge:measure <baseUrl>` (it passes `--novel lodge`), against a production build (`GITHUB_ACTIONS=true pnpm build`) served by `astro preview` at `/MY-NOVEL/`. End-to-end checks: `pnpm lodge:e2e <baseUrl>`. Chrome 155 through `PUPPETEER_EXECUTABLE_PATH`, Intel i5-11400H, Windows 11.

The harness budgets (2 ms per frame at 1x, 6 ms at 4x) are Tsukinomi's. For Lodge the design (section 9) reports frame time against a p95 target of 8 ms at 1x and treats only flashes as a hard limit, so a harness "FAIL" on frame budget alone is reported, not gated.

## Baseline (main 0f6fa36, before any Lodge change)

| Target | 1x ms/frame | 4x ms/frame | Flashes in worst second | Notes |
|---|---|---|---|---|
| home (static hero, global snow canvas) | 1.24 | 7.37 | 0 | 144 fps, 0 dropped |

Findings confirmed in the browser:

- B1 and B2: five seconds into the chapter 1 cutscene only 101 of the epigraph's characters were typed; no skip control is present.
- B4: `.snow-canvas` is `position: fixed; z-index: 998` while `.cutscene-overlay` is `z-index: 997`, so snow flakes are painted over the cutscene. The epigraph stays readable (the top element at the text is the epigraph), so the effect is visual noise rather than the hidden text Tsukinomi had.

E2E baseline: 6 passed, 0 failed (every Lodge page answers 200 with a `<main>`, chapter text present, no page errors, no console errors, no third-party requests, no failed requests).

## Final (branch head, after the review fixes)

Two full runs of the same targets on the finished build, plus a re-run of the targets that differed. The cutscene code is identical in both runs; what changed between them is the load on the machine, visible in the harness floor (an empty page with the same frame counter): 0.19 ms at 1x in run A, 0.43 to 0.48 ms in run B. Both are reported, neither is picked.

"1x ms" is the mean main-thread task time per animation frame over 5 s; "peak 1x" is the worst one-second mean in the same window, the closest the harness comes to a p95. Flashes are counted per WCAG 2.3.1 over the whole scene (about 19 s for a cutscene). Layout is checked at 375x812, 390x844, 812x375, 667x375, 915x412 and 1280x800.

| Target | Run | 1x ms | peak 1x | 4x ms | fps 1x | dropped 1x | Flashes | Layout |
|---|---|---|---|---|---|---|---|---|
| cutscene-0 (notebook) | A | 5.19 | 6.37 | 14.12 | 95.5 | 1.0% | 0 | ok |
| | B | 3.88 | 4.03 | 17.28 | 107.0 | 0.2% | 0 | ok |
| cutscene-1 (headlights) | A | 2.62 | 3.00 | 13.65 | 94.7 | 0.6% | 0 | ok |
| | B | 5.59 | 6.64 | 32.45 | 54.3 | 14.2% | 0 | ok |
| | B re-run | 5.37 | 6.90 | 36.98 | 55.5 | 11.8% | 0 | ok |
| cutscene-6 (lamp) | A | 4.79 | 5.57 | 10.22 | 127.8 | 0.8% | 0 | ok |
| | B | 4.21 | 5.27 | 25.51 | 115.3 | 0.2% | 0 | ok |
| cutscene-13 (descent) | A | 2.43 | 2.73 | 14.66 | 81.3 | 1.9% | 0 | ok |
| | B | 4.78 | 5.39 | 40.35 | 49.2 | 18.6% | 0 | ok |
| | B re-run | 4.98 | 5.89 | 36.21 | 47.5 | 19.7% | 0 | ok |
| cutscene-18 (mirror) | A | 3.65 | 4.33 | 23.91 | 142.4 | 0.1% | 0 | ok |
| | B | 4.76 | 5.35 | 24.21 | 112.7 | 1.4% | 0 | ok |
| home (whiteout, still pointer) | B | 2.89 | 3.93 | 13.39 | 82.1 | 3.9% | 0 | ok |
| home-scroll (top to bottom in 5 s) | B | 7.19 | 9.89 | 34.43 | 80.6 | 6.2% | 0 | ok |
| reader page (chapter 3) | B | 2.31 | 3.32 | 20.20 | 120.0 | 0.0% | 0 | ok |
| characters (Karlsen's board) | B re-run | 1.88 | 2.32 | 10.51 | 118.0 | 0.8% | 0 | ok |

Run A's home, home-scroll and characters rows are left out: they were taken before the two fixes below and are superseded.

Results against design section 9:

- Flashes: 0 in the worst second for every target in every run. Met.
- Frame time at 1x: every cutscene's mean and worst second are under 8 ms in both runs. Met.
- home-scroll: the mean is under 8 ms; the worst second is 9.0 to 10.0 ms. Main 0f6fa36, measured on the same machine in alternating runs, has a worst second of 8.0 to 9.8 ms for the same scroll (means 6.4 to 7.8 ms), so the miss is shared with the page as it was. The rest of the scroll cost is outside the Lodge code: Astro's ClientRouter saves the scroll position with history.replaceState on scroll, and the site-wide ambient player listens to scroll as well. Reported, not gated.
- Dropped frames in cutscenes 1 and 13 in run B (12 to 20%) come with a main thread that is only 24 to 30% busy, so the frames are lost to raster and compositing in software-rendered headless Chrome, not to script. Both scenes paint three to four full-screen layers a frame. On the idle run they drop under 2%.

Gzip size of each scene chunk with its static imports: notebook 5.65 KB, headlights 5.78 KB, lamp 4.50 KB, descent 5.94 KB, mirror 11.24 KB (the mirror's total includes shared chapter-layout modules that the page loads anyway).

### Fixes made because of these measurements

1. Characters page, 667x375: the page was 677px wide. Board cards keep overflow visible for their pin, and the two-column grid left a text column of about 100px at 641 to 760px, so a long word widened the page. The grid now goes to one column at 760px. Checked by a new e2e at six sizes.
2. Home whiteout: every snow flake was its own stroke (about 400 a frame at 1280x800, about 2 ms of script a frame), and the scene kept drawing under an 88% fill after the reader had scrolled to blank paper. Flakes are now drawn in nine paths (three depths by three tones), and the loop stops once the scene is fully faded and starts again above that point (new e2e). home-scroll went from 10.0 ms to 6.7 ms per frame in alternating runs against main's 6.4 to 7.8 ms; the still home page from 3.13 to 2.33 ms.

### End-to-end and unit gates at the branch head

check 0 errors, 0 warnings, 0 hints; build 48 pages; unit 770 tests, 769 pass, 0 fail, 1 skipped; sea:verify-dist OK; lodge e2e 28 of 28; tsukinomi e2e 16 of 16.
