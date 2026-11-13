# ADR-0003: Keep the custom design system instead of shadcn/ui

- Status: accepted
- Date: 2026-11-13

## Context

The architecture spec said "Tailwind + shadcn/ui". The repository already contains a
working design system: botanical-ink tokens in `src/app/globals.css`, a self-hosted
display face, and eleven accessible primitives in `src/components/ui` (buttons,
fields, selection controls, alerts, progress, tabs, data table, dialog, drawer). It is
used by the landing page and the specimen route.

Adopting shadcn/ui now would replace a system that already expresses the product's
visual language, and it would double the component inventory during a migration that
is already changing the backend.

## Decision

- Keep the custom design system. shadcn/ui is not a dependency.
- The spec §17 text is amended accordingly.
- Primitives that only served the document folio are deleted; primitives the gallery
  needs are kept and extended (photo grid, lightbox, filter chips, password gate,
  share settings).
- New domain components live in `src/features/<domain>/**`; `src/components/ui`
  stays the generic layer.

## Consequences

- The project owns component quality: keyboard behavior, focus management, and
  contrast are our tests, not a library's.
- The spec's component list is no longer authoritative for implementation details;
  `DESIGN.md` and the component code are.
- Any future proposal to adopt a component library needs a new ADR, not a silent
  dependency.
