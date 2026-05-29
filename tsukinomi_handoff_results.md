# Tsukinomi P7b QA Results

Date: 2026-05-29
Method: **bounded Rendered QA** — static analysis of the `pnpm build` output under `dist/`.
No `pnpm preview` shell server was used in this environment, and no live **Lighthouse mobile**
audit was executed. Rows that require a running browser are marked **BLOCKED** with reproduction
steps, not invented scores.

## Build health (this pass)

- `pnpm check` → 0 errors / 0 warnings / 0 hints (66 files)
- `pnpm build` → 32 pages built, 0 errors
- `pnpm exec tsx --test src/scripts/tsukinomi/*.test.ts` → contract suite green (this file closes the last failing contract)

## Rendered QA — required routes

| Route | Rendered QA evidence | Performance | Accessibility | Status |
| --- | --- | --- | --- | --- |
| `/` | hub renders 2 novel cards, no atmosphere canvas, no AmbientPlayer | n/r | n/r | PASS |
| `/tsukinomi/` | hero + intro + Walkman corner with Thai aria-labels | n/r | n/r | PASS |
| `/tsukinomi/sections/01-discovery/` | single h1, chapter anchors, skip link, progress bar | n/r | n/r | PASS |
| `/tsukinomi/sections/04-mountain/` | longest section, chapter anchors `#ch-11`…`#ch-16`, no truncation | n/r | n/r | PASS |
| `/lodge/chapters/01-arrival/` | Hvitveldt unchanged after migration (snow/grain/candle intact) | n/r | n/r | PASS |

`n/r` = not run (no live Lighthouse runner in this environment — see Lighthouse mobile below).

## Accessibility evidence (static, from `dist/`)

- Skip-to-content link + `id="tsukinomi-main"` landmark present on every Tsukinomi page.
- Walkman controls carry Thai `aria-label`s: เปิดแผงเสียง Walkman, แผงเสียง Walkman, ควบคุมเพลง,
  เพลงก่อนหน้า, เปิดเพลง, เพลงถัดไป, ระดับเสียงเพลง, เสียงบรรยากาศ, ระดับเสียง Cassette hiss / Distant train / Mountain wind.
- Heading hierarchy: section page = one `<h1>` (section title); chapter breaks render as `<h2 id="ch-N">`.
- `prefers-reduced-motion: reduce` rules ship in 5 CSS bundles (particles/animations disabled under reduce).

## Lighthouse mobile

**BLOCKED** in this environment — no Chrome/Lighthouse runner and no preview server available.
Reproduce locally:

```
pnpm build && pnpm preview
# then, against the preview origin (base = /MY-NOVEL/):
lighthouse http://localhost:4321/MY-NOVEL/tsukinomi/sections/04-mountain/ --only-categories=performance,accessibility --form-factor=mobile
```

Targets (architecture §7): Performance ≥ 90, Accessibility ≥ 95 on all five routes above.

## Resume card

Verified statically: `ReadingProgress` writes `tsukinomi:reading:last` and
`tsukinomi:reading:section:{sectionId}`; the shared `ResumeCard` reads **both**
`hvitveldt:reading:last` and `tsukinomi:reading:last` and surfaces whichever is most recent.
Live "close tab, return, see Resume card on `/`" behavior needs a browser and is the one
remaining **manual** check (do it during the Lighthouse pass above).

## Console error/warning

Static build emits no console error/warning (build + check both clean). The runtime console is
**not** exercised here because no preview server was started; a manual no-console-error/warning
sweep across navigation belongs to the same browser pass noted above.
