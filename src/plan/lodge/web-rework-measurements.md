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
