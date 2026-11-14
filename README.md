# Potokuadrat

Self-hosted client gallery over Google Drive. Potokuadrat indexes photo folders,
serves a fast grid, and gives clients a branded share link with filters, favorites, and
downloads at the quality you allow.

Status: foundation. The application scaffold, database tooling, and design system are
in place; the gallery domain (Drive, albums, shares, auth) is being built against the
spec in `docs/specs/`.

## Requirements

- Node.js 24 and npm 10 (see `.nvmrc`)
- Postgres 16, or Docker with Compose

## Start locally

1. `cp .env.example .env.local` and fill in the database URL, Better Auth secret, and
   the path to a Google Drive service-account key.
2. `npm install`
3. `npm run db:migrate`
4. `npm run dev` and open `http://localhost:3000`. The first visit redirects to
   `/setup`, where you create the organization and the admin account.

Share the photo folders with the service account email (Viewer). The key file stays
outside git; `GOOGLE_DRIVE_KEY_FILE` only carries its path.

## Run with Docker

```bash
cp .env.example .env
mkdir -p secrets && cp /path/to/service-account.json secrets/
docker compose up --build
```

Compose starts `postgres`, runs migrations once in the `migrate` service, then starts
`app` on port 3000. The thumbnail cache lives in the `thumbs` volume; deleting it only
forces a rebuild.

## Environment

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Public base URL used in share links |
| `DATABASE_URL` | Direct Postgres connection (no transaction pooler) |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Better Auth session signing and base URL |
| `GOOGLE_DRIVE_KEY_FILE` | Path to the service-account JSON key |
| `DRIVE_INDEX_MAX_DEPTH` | Recursion depth while listing folders (default 5) |
| `THUMB_CACHE_DIR` | Thumbnail cache directory |
| `THUMB_CACHE_MAX_BYTES` / `THUMB_CACHE_MAX_FILES` | Cache cap and LRU eviction |
| `STRIP_METADATA` | `1` (default) strips EXIF/IPTC/comments from thumbnails |
| `SMTP_*` | Optional SMTP for magic links; without it links are copied manually |
| `ANALYTICS_RETENTION_MONTHS` | Retention for first-party analytics (default 12) |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript without emit |
| `npm test` | Vitest unit tests |
| `npm run test:integration` | Auth and setup tests against `TEST_DATABASE_URL` |
| `npm run db:generate` | Generate SQL migrations from the Drizzle schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Inspect the database |

## Documentation

- `docs/specs/` — product and PoC specifications
- `docs/adr/` — decisions that changed the original plan
- `docs/WORKFLOW.md` — backend/UI split, contracts, and review rules
- `docs/ARCHITECTURE.md` — module ownership and request flow
- `PRODUCT.md` / `DESIGN.md` — product scope and visual system

## Security notes

- Never commit the service-account key or `.env.local`. The key grants read access to
  every folder shared with the service account.
- `/setup` stays reachable until the first account exists. Finish setup right after
  deploying, or keep the instance off the public network until it is done. Sign-up is
  rejected once a user exists.
- `STRIP_METADATA=0` serves Drive thumbnails untouched; that can include GPS and
  photographer identity. Keep the default unless a share explicitly needs it.
- Original downloads are proxied from Drive and never rewritten.

## License

AGPL-3.0-only. See `LICENSE`.
