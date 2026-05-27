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

Recommended target: Cloudflare Pages.

One-time setup:

1. Push this repository to GitHub or GitLab.
2. Create a Cloudflare Pages project.
3. Use framework preset `Astro`, build command `pnpm build`, output directory `dist`, and `NODE_VERSION=20`.

Manual deploy after login:

```bash
npx wrangler login
pnpm build
npx wrangler pages deploy dist --project-name hvitveldt-lodge
```

For non-interactive deploys, set `CLOUDFLARE_API_TOKEN` with Pages deploy permissions before running the deploy command.

Wrangler Pages configuration lives in `wrangler.jsonc`, and static cache headers are defined in `public/_headers`. Pull requests and pushes run `pnpm check` and `pnpm build` through GitHub Actions.
