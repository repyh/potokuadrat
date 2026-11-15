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
4. `npm run db:seed` (optional) for a sample organization, admin, album, and shares
5. `npm run dev` and open `http://localhost:3000`. The first visit redirects to
   `/setup`, where you create the organization and the admin account. With the seed,
   sign in as `admin@potokuadrat.local` / `potokuadrat-seed`.

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
| `npm run db:seed` | Create the sample organization, admin, album, and shares |
| `npm run db:studio` | Inspect the database |

## Share media API

| Route | Purpose |
| --- | --- |
| `GET /api/share/:slug` | `GalleryState`: access, album, and policy (no-store) |
| `POST /api/share/:slug/access` | Exchange a share password for a signed cookie |
| `POST /api/share/:slug/magic` | Exchange a one-time magic-link token for a client session |
| `GET /api/share/:slug/photos?filter=&cursor=&limit=` | `PhotoPage`; filter `all`, `favorites`, `landscape`, or `portrait` |
| `GET /api/share/:slug/favorites` | Server-side favorite photo ids of the magic-link session |
| `PUT /api/share/:slug/favorites/:photoId` | Favorite a photo; returns the updated id list |
| `DELETE /api/share/:slug/favorites/:photoId` | Remove a favorite; returns the updated id list |
| `GET /api/share/:slug/download.zip?quality=&scope=&ids=` | Streamed zip; quality `original`/`web`, scope `all`/`favorites` |
| `GET /s/:slug/thumb/:photoId?w=400\|800\|1600\|2048` | Cached thumbnail; `download=1` adds an attachment name |
| `GET /s/:slug/download/:photoId?quality=original\|web` | Original proxy, or a 2048px JPEG from the cache |

A photo is served only when it belongs to the share's album, is not tombstoned, and is
inside the share's frozen subset if one exists. Thumbnails carry a stable `ETag` and
`Cache-Control: immutable`; a matching `If-None-Match` returns `304`. The effective
metadata policy is the share override with the organization fallback, and clean and
raw entries never share a cache file.

The photo list orders by `sort_index`, uses an opaque cursor (`nextCursor`), and defaults
to 50 photos with a maximum of 200. Filters never widen the share: tombstoned photos,
other albums, and photos outside a frozen subset stay hidden. The `total` field counts
every photo matching the filter.

Favorites are stored server-side only for magic-link sessions (`favorites` table, keyed by
the client session). Exchanging a new magic link for the same email reuses the live
session, so favorites survive re-authentication. Public and password shares keep
favorites in the browser; their favorites endpoints answer `400`, and `filter=favorites`
is refused the same way. An unknown or out-of-share photo returns `404`.

Archives stream entries straight from Drive (originals) or the 2048 cache (`quality=web`)
through `yazl`; nothing is written to disk and only one Drive file is read at a time.
`scope=favorites` uses the magic-link session, while public and password clients pass the
ids they favorited locally via `ids` (comma separated, restricted to the share). Names in
the zip are flattened and deduplicated. A selection above 500 photos or 2 GB returns
`413` and asks for per-file downloads; an empty selection returns `404`.

Password and magic-link shares are protected by an HttpOnly, SameSite=Lax cookie signed
with `BETTER_AUTH_SECRET`; the password cookie lasts 12 hours, a magic-link session 7
days. Password attempts are limited to 5 per minute per share and client, magic-link
exchanges to 10. Expired shares return `410`, missing proof `403`, and unknown shares
or photos `404`. In development, the seeded magic token is `seed-magic-token`.

In development, the seeded album (`seed-photo-*`) serves generated SVG placeholders so
the gallery runs without Google credentials. That path is disabled in production
builds.

## Documentation

- `docs/specs/` — product and PoC specifications
- `docs/adr/` — decisions that changed the original plan
- `docs/WORKFLOW.md` — backend/UI split, contracts, and review rules
- `docs/ARCHITECTURE.md` — module ownership and request flow
- `PRODUCT.md` / `DESIGN.md` — product scope and visual system

## Admin API

Every route requires an admin session cookie (sign in through `/login` or
`/api/auth/sign-in/email`).

| Route | Purpose |
| --- | --- |
| `GET /api/admin/drive/folders` | Shared folders and Shared Drives the service account can see |
| `GET /api/admin/albums` | Albums owned by the signed-in admin |
| `POST /api/admin/albums` | Create an album from `{ title, folders[] }` and queue indexing |
| `GET /api/admin/albums/:id` | Album, folders, and indexing progress |
| `POST /api/admin/albums/:id/reindex` | Queue a re-index; `?mode=incremental` only fetches modified files |

Indexing runs through `pg-boss` in the app process. A full re-index re-lists every
folder and sets `missing_at` on files that disappeared. `mode=incremental` requests
only files modified since each folder's last successful listing, keeps existing
tombstones, and falls back to a full run until every folder has a timestamp. Drive
`403` rate-limit responses are retried with the same backoff as `429`/`5xx`.

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
