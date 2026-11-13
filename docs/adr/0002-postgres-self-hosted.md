# ADR-0002: Self-hosted Postgres replaces Supabase

- Status: accepted
- Date: 2026-11-13

## Context

The foundation used Supabase for Postgres, Storage, and SSR session plumbing. The
spec instead requires one VPS running Docker Compose with `app` and `postgres`, no
additional paid services, and no product dependency on a hosted platform. It also
explicitly rejects storing originals and rejects a storage abstraction for thumbnail
derivatives: the cache is disk-local and disposable.

Supabase Storage therefore has no consumer in v1, while its presence pulls the
architecture toward exactly the pattern the spec rules out.

## Decision

- Use Postgres 16 in Docker Compose, accessed through Drizzle ORM with `pg`.
- Remove `@supabase/ssr`, `@supabase/supabase-js`, `src/lib/supabase/**`, and
  `src/server/storage/**`.
- Authenticate organization users with Better Auth (email + password), as required by
  the spec. Client access uses signed cookies and magic-link tokens issued by the app.
- Run jobs with `pg-boss` in the same process for v1; split a worker service later
  through a Compose profile.
- Store thumbnails on a persistent volume (`THUMB_CACHE_DIR`), with a size and file
  cap plus LRU eviction. No storage interface until a real second driver exists.

## Consequences

- `DATABASE_URL` points at the Compose Postgres directly; no transaction pooler. If a
  pooler is ever introduced, `pg-boss` and migrations need a direct connection.
- The image no longer needs Supabase credentials; `.env.example` carries database,
  auth, Drive, SMTP, and cache settings instead.
- Deploy, backup, and restore are our responsibility and must be documented.
- The schema owns `users`, `sessions`, and organization rows; Better Auth adds its
  own supporting tables (`accounts`, `verifications`), which are part of the schema
  source of truth.
