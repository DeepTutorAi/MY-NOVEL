# Hvitveldt Lodge

Hvitveldt Lodge is a single-author Thai horror reading site for one long-form creepypasta, designed to feel like a found document rather than a tech showcase.

See `codex_handoff.md` for the phased build plan.

## Requirements

- Node.js 20 LTS or newer; deployment should use Node 20 or 22 LTS.
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

The GitHub Actions workflow runs `pnpm check`, builds the Astro site, uploads `dist`, and deploys it through GitHub Pages. The project is configured with `base: "/MY-NOVEL"` so links and assets work under the repository path.
