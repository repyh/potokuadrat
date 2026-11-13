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

## Architecture

Potokuadrat uses Next.js App Router as a BFF, with feature-oriented UI modules, explicit contracts across the browser/server boundary, and server-side use cases and repositories backed by Drizzle ORM (Postgres) and Supabase Storage.

See `docs/ARCHITECTURE.md` for dependency rules and the request flow.

## Site branding

Edit the root `config.json` to set the name and profile details shown on the public landing page. `eventName` is the displayed site/event name; `organizerName`, `organizerRole`, `organizerSummary`, `tagline`, and `description` fill out the organizer preview and page introduction. The `brand` values set the accent, ink, paper, and surface colors. The document rows are labeled examples; replace them with real public files when the document feature is connected.
