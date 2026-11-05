# Potokuadrat

Web application foundation using Next.js 16 Active LTS, Supabase Postgres and Storage, Drizzle ORM, and Tailwind CSS 4.

## Start locally

Requirements: Node.js 24 and npm 10.

1. Copy `.env.example` to `.env.local` and fill in the Supabase project URL, publishable/anon key, Storage bucket name, and Postgres URLs.
2. Install dependencies with `npm install`.
3. Start the app with `npm run dev`.

The app can render without environment values. Database and Storage clients validate their configuration when first used.

## Database workflow

- Add product tables under `src/server/db/schema/`.
- Generate reviewed SQL migrations with `npm run db:generate`.
- Apply migrations with `npm run db:migrate`.
- Inspect the database with `npm run db:studio`.
- Set `MIGRATION_DATABASE_URL` to a direct Postgres connection when `DATABASE_URL` uses the Supabase transaction pooler.

## Architecture discussion

The boundaries follow the overall approach in `documents/web/lomba-mia`: keep the Next.js server as a BFF, let feature modules own their UI, share explicit contracts across the browser/server boundary, and put domain operations behind server-side use cases and repositories. Drizzle replaces Prisma as the Postgres schema and migration owner for this project. Supabase Storage remains a separate file service.

This bootstrap deliberately does not copy SAKSI tables, endpoints, permissions, or product rules. It also does not assume authentication, public/private bucket policy, or Potokuadrat's domain model; those decisions belong with the first concrete feature.

See `docs/ARCHITECTURE.md` for dependency rules and the request flow.
