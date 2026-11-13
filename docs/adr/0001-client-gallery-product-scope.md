# ADR-0001: Client gallery over Google Drive is the product

- Status: accepted
- Date: 2026-11-13

## Context

The repository started as a generic Next.js foundation with an event-folio landing
page: organizer profile, public document index, schedule and guest-pass primitives.
In parallel, `docs/specs/2026-10-30-potokuadrat-client-gallery-design.md` describes a
different product: a client gallery that reads photo folders from Google Drive and
serves albums through share links.

Keeping both directions means every UI, schema, and API decision has two owners. The
measured PoC confirms the gallery assumptions (Drive thumbnails for JPEG, HEIC and
RAW; fast-enough grid; dependency-free metadata stripping), so the gallery is the
direction with evidence behind it.

## Decision

- The product is a self-hosted client gallery over Google Drive, described by the
  spec in `docs/specs/`.
- The product name is **Potokuadrat**. Earlier documents used the temporary name
  "Potopoto"; all references are unified.
- Organizer profile pages, document indexes, schedules, guest passes, uploads, and
  proofing leave the product surface. The visual language stays.
- The public entry point is a share link at `/s/<slug>`. `/` redirects to `/setup`
  while no user exists and to `/login` afterwards.
- Client UI is English and structured for later i18n.

## Consequences

- `PRODUCT.md` and `DESIGN.md` describe the gallery, not the document folio.
- `src/app/showcase`, the specimen page, the showcase carousel, `FileDropzone`, and
  the document/schedule/guest primitives are removed before release.
- `config.json` stops being the branding source; an organization row in Postgres is
  the source of truth.
- Anything not listed in the spec (proofing, video, uploads, multi-tenant) is out of
  scope until a new spec says otherwise.
