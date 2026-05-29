# Documentation

Project docs for the Pii-chan fiction site — two long-form Thai novels under one Astro app,
each with its own identity (`/lodge/` and `/tsukinomi/`).

## Tsukinomi Station — `/tsukinomi/`

- [tsukinomi_architecture.md](tsukinomi/tsukinomi_architecture.md) — architecture & theme spec.
  Note the **§4 AMENDMENT**: the live theme is finalized as **sakura-twilight**
  (source of truth: `src/styles/tsukinomi/tokens.css`), not the autumn-maple draft below it.
- [codex_tsukinomi_handoff.md](tsukinomi/codex_tsukinomi_handoff.md) — phased build plan P0–P8.
- [tsukinomi_handoff_results.md](tsukinomi/tsukinomi_handoff_results.md) — P7b QA results.

> These are documentation **copies**. The living canon the author edits each writing session
> stays at the **repo root**:
> - `tsukinomi_plan.md` — outline
> - `tsukinomi_state.md` — character canon, timeline, foreshadow ledger
> - `tsukinomi_station.txt` — prose source (read-only for the build)

## Hvitveldt Lodge — `/lodge/`

- [codex_handoff.md](lodge/codex_handoff.md) — original Hvitveldt build handoff (moved here in P8).

## Assets

- License ledger: [`../assets-manifest.md`](../assets-manifest.md)
- Per-novel notes: `public/assets/lodge/` and [`../public/assets/tsukinomi/README.md`](../public/assets/tsukinomi/README.md)

## Build plans

- [superpowers/plans/](superpowers/plans/) — written implementation plans (e.g. P0 migration).
