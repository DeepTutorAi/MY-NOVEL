# Tsukinomi P0 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the existing Hvitveldt Lodge site under `/lodge/` without changing Hvitveldt prose or behavior, leaving `/` free for the future multi-novel hub.

**Architecture:** P0 is a path and ownership migration only. Existing Hvitveldt source files move into `lodge/` namespaces, shared pieces move into `_shared/`, collection loaders point at the moved markdown, and public asset references gain the `/assets/lodge/` prefix except shared grain.

**Tech Stack:** Astro 5.18.2, Astro content collections with `glob()` loader, TypeScript 5.9, Tailwind CSS 4.3 through Vite, pnpm 10.33.

---

## Source Of Truth

- Primary implementation source: `codex_tsukinomi_handoff.md`, phase `P0 · Repo migration to /lodge/`.
- Architecture source: `tsukinomi_architecture.md` sections 1 and 2.
- Style reference only: `codex_handoff.md` sections 1-4 and anti-patterns.
- Baseline proof before migration:
  - `pnpm check`: pass, 0 errors, 0 warnings.
  - `pnpm build`: pass, 24 pages built.

## Decisions

Decision: Keep collection names as `chapters` and `extras` during P0 unless renaming is mechanically low-risk.
Why: The phase goal is non-breaking Hvitveldt migration; collection renaming touches many typed consumers.
Trade-off: Lower regression risk now vs less semantic naming until P1/P2.
Alternative: Rename to `lodgeChapters` and `lodgeExtras` in P0; this is cleaner long-term but increases the first migration blast radius.

Decision: Update `assets-manifest.md` paths during P0.
Why: Moving public assets makes the old ledger paths false.
Trade-off: More files touched now vs keeping the legal/source ledger honest.
Alternative: Defer manifest path cleanup to P7; that would leave a known mismatch for several phases.

Decision: Preserve `hvitveldt:*` localStorage keys.
Why: The handoff marks them as non-breaking internal browser state.
Trade-off: Old key names remain even after URL migration vs preserving reader resume/audio state.
Alternative: Namespace by route (`lodge:*`), but that would break existing reader state.

## File Map

- Move: `src/pages/index.astro` to `src/pages/lodge/index.astro`.
- Move: `src/pages/chapters/index.astro`, `src/pages/chapters/[slug].astro`, `src/pages/chapters/does-not-exist.astro` to `src/pages/lodge/chapters/`.
- Move: `src/pages/characters.astro` to `src/pages/lodge/characters.astro`.
- Move: `src/pages/puzzle.astro` to `src/pages/lodge/puzzle.astro`.
- Keep and edit: `src/pages/404.astro`.
- Create: `src/pages/index.astro` as a temporary redirect/fallback link to `/lodge/`.
- Move: `src/content/chapters/*` to `src/content/lodge/chapters/*`.
- Move: `src/content/extras/*` to `src/content/lodge/extras/*`.
- Move: `src/layouts/BaseLayout.astro` to `src/layouts/lodge/LodgeBaseLayout.astro`.
- Move: `src/layouts/ChapterLayout.astro` to `src/layouts/lodge/LodgeChapterLayout.astro`.
- Move: `src/components/atmosphere/BackgroundFog.astro` and `SnowCanvas.astro` to `src/components/lodge/atmosphere/`.
- Move: `src/components/atmosphere/GrainOverlay.astro` to `src/components/_shared/GrainOverlay.astro`.
- Move: `src/components/audio/*` to `src/components/lodge/audio/`.
- Move: `src/components/reading/*` to `src/components/lodge/reading/`.
- Move: `src/components/marks/*` to `src/components/lodge/marks/`.
- Move: `src/components/navigation/*` to `src/components/lodge/navigation/`.
- Move: `src/components/pages/NotFoundScene.astro` to `src/components/_shared/NotFoundScene.astro`.
- Move: `src/scripts/audio-state.ts` and `src/scripts/soundscape-state.ts` to `src/scripts/lodge/`.
- Keep: `src/scripts/split-chapters.ts`.
- Move: `src/data/audio-cues.ts` and `src/data/characters.ts` to `src/data/lodge/`.
- Move: `src/styles/global.css`, `src/styles/chapter.css`, `src/styles/polish.css` to `src/styles/lodge/`.
- Move: `src/utils/act-for-chapter.ts` to `src/data/lodge/acts.ts`.
- Keep: `src/utils/base-path.ts`.
- Create: `src/utils/novel-meta.ts` with an exported empty novel metadata scaffold.
- Move: `public/assets/audio/*` to `public/assets/lodge/audio/`.
- Move: `public/assets/images/*` to `public/assets/lodge/images/`, except `grain.png` to `public/assets/_shared/grain.png`.
- Move: `public/assets/prompts/*` to `public/assets/lodge/prompts/`.

## Task 1: Create Namespaced Directories

- [ ] Create the target directories for `lodge`, `_shared`, and moved public assets.
- [ ] Verify target directories exist with `rg --files src public | rg "lodge|_shared"`.

## Task 2: Move Files Without Editing Hvitveldt Prose

- [ ] Move pages, layouts, components, scripts, data, styles, content, and public assets according to the file map.
- [ ] Confirm no Hvitveldt markdown content changed by comparing moved file contents against git history where possible.
- [ ] Do not touch `tsukinomi_station.txt`, `tsukinomi_plan.md`, or `tsukinomi_state.md`.

## Task 3: Update Imports And Collections

- [ ] Update all relative imports after the file moves.
- [ ] Update `src/content.config.ts` collection bases to:
  - `./src/content/lodge/chapters`
  - `./src/content/lodge/extras`
- [ ] Update typed references if collection names are renamed; otherwise preserve `CollectionEntry<"chapters">` and `getCollection("chapters")`.
- [ ] Update `src/scripts/split-chapters.ts` to import `actForChapter` from `src/data/lodge/acts.ts`.

## Task 4: Update Routes, Hrefs, And Asset Paths

- [ ] Update internal Hvitveldt hrefs from `/chapters/`, `/characters/`, `/puzzle/` to `/lodge/chapters/`, `/lodge/characters/`, `/lodge/puzzle/`.
- [ ] Update chapter image relative paths from old `../../assets/images/chapters/...` to the new public asset path only if Astro requires it after moving content.
- [ ] Update `withBase("/assets/images/...")`, `withBase("/assets/audio/...")`, and cue `srcBase` values to `/assets/lodge/...`.
- [ ] Update shared grain path to `/assets/_shared/grain.png`.
- [ ] Keep favicon and `public/og.jpg` at root.
- [ ] Update `assets-manifest.md` and `public/assets/README.md` so paths match the moved files.

## Task 5: Temporary Root Redirect

- [ ] Create a minimal `src/pages/index.astro` that redirects to `withBase("/lodge/")` with a readable fallback link.
- [ ] Keep it intentionally plain because P1 replaces it with the hub.

## Task 6: Verification

- [ ] Run `pnpm check`.
  - Expected: 0 errors, 0 warnings.
- [ ] Run `pnpm build`.
  - Expected: generated routes include `/lodge/`, `/lodge/chapters/`, `/lodge/chapters/01-arrival/`, `/lodge/characters/`, and `/lodge/puzzle/`.
- [ ] Run `pnpm preview` and verify:
  - `/MY-NOVEL/` redirects or links to `/MY-NOVEL/lodge/`.
  - `/MY-NOVEL/lodge/` shows the Hvitveldt home.
  - `/MY-NOVEL/lodge/chapters/01-arrival/` renders the reader with snow, fog, grain, topbar, and audio controls.
  - Browser console has no errors.

## What This Plan Will Not Do

- It will not build the hub UI; P1 owns `/`.
- It will not scaffold Tsukinomi routes or content; P2 and P3 own that.
- It will not fetch or generate Tsukinomi audio/images; P5 and P6 own assets.
- It will not alter Hvitveldt prose in the 18 chapter markdown files.
- It will not rename the deploy base from `/MY-NOVEL`; open decision D1 remains default `no`.

## Design Recheck

- Solves stated problem: yes, P0 frees `/` while preserving Hvitveldt under `/lodge/`.
- Necessary components only: yes, moves are ownership boundaries from the handoff.
- Clear source of truth: yes, existing Hvitveldt remains in `lodge`, shared utility in `_shared`.
- Failure paths: build/check/preview catch import, collection, route, and asset-path failures.
- Current dependencies verified: yes, package versions read locally and Astro collection API checked against current docs.
- Avoids dead code/fake completeness: yes, only one minimal future scaffold file `src/utils/novel-meta.ts` is added because handoff explicitly requires it.
- Testable: yes, P0 has check/build/browser route acceptance.
