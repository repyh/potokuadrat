# Working on Potokuadrat with more than one developer

Backend and UI are separate workstreams. What keeps them parallel is a small, stable
seam: `src/contracts/**`. Everything else is owned by one side.

## People

| Role | GitHub |
| --- | --- |
| Backend | `@Topher` |
| Frontend UI | `@repyh`, `@VANTER25` |
| QA and CI | `@toraaxlv` |

`.github/CODEOWNERS` requests the right people automatically. Contract PRs need the
backend owner and at least one UI owner; CI and tooling changes need the QA owner.

## Ownership

| Area | Owner | Rule |
| --- | --- | --- |
| `src/server/**` | Backend (Topher) | Use cases, repositories, Drive, jobs, auth. UI never imports it. |
| `src/contracts/**` | Backend + UI | Shared types and zod schemas. Changes need both reviewers. |
| `src/features/**` | UI (repyh, VANTER25) | Domain UI and browser interaction. No SQL, no Drive, no auth internals. |
| `src/components/ui/**` | UI (repyh, VANTER25) | Design system. Backend may consume it, not restyle it. |
| `src/app/**` | UI, except `src/app/api/**` | Composition only: load data, render a feature, wire a route. |
| `src/app/api/**` | Backend (Topher) | Route Handler adapters. |
| `drizzle/**` | Backend (Topher) | Only backend generates migrations. |
| CI, lint, test config, dependencies | QA (toraaxlv) | With the backend owner for dependency changes. |

The ESLint config enforces the first and third rows: `src/features/**` and
`src/components/ui/**` cannot import `@/server/**`, `drizzle-orm`, `pg`, `pg-boss`, or
`better-auth`. Contracts cannot import React, Next.js, or server code at all.

## The seam

- **First paint is a Server Component.** Pages call a use case directly; no HTTP hop.
- **Interaction is a Route Handler.** Filters, favorites, pagination, lightbox data,
  and downloads go through `/api/share/[slug]/...` with JSON from `src/contracts`.
- **Binary is always a Route Handler.** Thumbnails, originals, and zip need streaming
  and headers.
- **Admin mutations are Server Actions** and return `ActionResult<T>`.

The UI never re-declares a type that already exists in `src/contracts`. If a field is
missing, the contract is amended first.

## Contract-first loop

1. **Contract PR (small, first).** Backend adds or changes the contract, a fixture,
   and the error/status variants. UI reviews the shape before anyone builds.
2. **Parallel work.**
   - Backend: use case, repository, Drive access, integration test.
   - UI: page, states, interactions against the seeded database.
3. **Wire-up.** UI replaces the fixture call with the real route handler or Server
   Action. No component changes should be needed if the contract held.
4. **Joint review and demo** against the same seed.

Feature branches stay under two or three days and rebase onto `master` daily. Long
lived `backend`/`ui` branches defeat the seam.

## Working environments

Everyone runs the real stack, not a mock server:

```bash
docker compose up postgres
npm run db:migrate
npm run db:seed
npm run dev
```

The seed (owned by backend) creates:

- one organization and an admin with documented credentials;
- one album with 24 Unsplash travel/landscape photographs; in development the media
  routes serve them from `.cache/seed/` (warmed by the seed), so no Drive key is
  required;
- one public share, one password share, one magic-link share, and one expired share;
- a client session and a few favorites for the magic-link share.

UI must not need Google credentials. If a state cannot be reached from the seed, that
is a seed bug, not something to fake in a component.

## Pull requests

- Small PRs. Contract changes are their own PR, never hidden inside a feature PR.
- `.github/CODEOWNERS` requests the right reviewer automatically.
- CI runs lint, typecheck, unit tests, and integration tests with a Postgres service.
  UI PRs fail on typecheck; backend PRs fail on integration tests. The QA owner keeps
  those checks and the test setup healthy.
- A feature is done when its Server Component, route handler, contract, and empty /
  error / loading states all exist.

## Anti-patterns

- UI keeping a hand-written copy of `Photo`, `Share`, or `GalleryState`.
- Backend writing markup, or UI writing SQL and Drive calls.
- Access rules duplicated in the UI (`if (share.expiresAt < now)`) instead of returned
  as `GalleryState.access`.
- Fixtures that are never replaced by the real handler.
- `drizzle-kit generate` run from the UI workstream.
- Deleting `src/app/showcase`: it is the living design-system reference. It becomes a
  dev-only route before release instead of being removed.

## Reviewing across the boundary

When a PR changes `src/contracts/**`, the reviewer checks three things:

1. Does the UI need any field from `src/server/**` that is not exposed?
2. Are the failure states representable, not just the happy path?
3. Can the Seed produce the new state without Google credentials?

If any answer is no, the contract PR is not ready.
