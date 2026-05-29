# Pii-chan Dechalert — Fiction Hub

A single-author Thai fiction site hosting two long-form works under one reading shell. Each novel
keeps its own identity — layout, atmosphere, audio, and reading state are separate — built on a
shared Astro stack.

- **`/`** — hub listing both novels
- **`/lodge/`** — *Hvitveldt Lodge* (ฮวิตเวลต์ ลอดจ์) · สยอง · หนาว · 18 บท
- **`/tsukinomi/`** — *Tsukinomi no Eki* (สถานีทะเลพระจันทร์) · สงบ · เหงา · 5 ภาค

Documentation lives in [`docs/`](docs/README.md). Phased build plans:
[`docs/lodge/codex_handoff.md`](docs/lodge/codex_handoff.md) and
[`docs/tsukinomi/codex_tsukinomi_handoff.md`](docs/tsukinomi/codex_tsukinomi_handoff.md).

## Requirements

- Node.js 20 LTS or newer (deploy on Node 20 or 22 LTS).
- pnpm 10 or newer.

## Development

```bash
pnpm install
pnpm dev
```

## Verification

```bash
pnpm check
pnpm build
pnpm exec tsx --test src/scripts/tsukinomi/*.test.ts   # Tsukinomi contract suite
```

## Deploy

Recommended target: GitHub Pages.

Live URL after the first successful Pages deployment:

```text
https://deeptutorai.github.io/MY-NOVEL/
```

One-time setup:

1. Push this repository to `DeepTutorAi/MY-NOVEL`.
2. In GitHub, open `Settings` -> `Pages`.
3. Set `Source` to `GitHub Actions`.

Deploy:

```bash
git push origin main
```

The GitHub Actions workflow runs `pnpm check`, builds the Astro site, uploads `dist`, and deploys it
through GitHub Pages. The project is configured with `base: "/MY-NOVEL"` so links and assets work
under the repository path. (The repo slug stays `MY-NOVEL`; only the internal package name changed
to `piichan-novels`.)
