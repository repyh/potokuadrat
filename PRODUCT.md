# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Organizer admin** — self-hosts one installation, manages users, the Drive service
  account, default branding, and every album.
- **Photographer (member)** — attaches Drive folders, builds albums, and sends share
  links to clients.
- **Client** — no account. Opens a share link, filters photos, marks favorites, opens
  the lightbox, and downloads at the quality the share allows.

## Product Purpose

Potokuadrat turns photo folders already stored in Google Drive into a fast, branded
client gallery. Drive stays the source of the originals; Potokuadrat supplies the
viewing, selection, and download experience the photographer can send to a client.

## Positioning

A self-hosted, open-source tool for one organization per installation. It reads Drive
through a service account, so photographers keep their existing storage and clients
never see a Drive URL. Album links are share links with their own access mode, expiry,
download rules, and branding.

## Operating Context

One VPS runs the app and Postgres through Docker Compose. Albums are indexed from
folders shared with the service account; originals are proxied only when a client
downloads. Thumbnails are cached on disk and may be deleted at any time. Analytics are
first-party and stored in Postgres.

## Capabilities and Constraints

- Albums combine one or more Drive folders; indexing is recursive to a configurable
  depth and never downloads originals.
- Shares have three access modes (public, password, magic link) plus expiry, download
  toggle, allowed qualities, frozen photo subsets, and branding overrides.
- Clients can filter by orientation and favorites, and download originals or 2048px
  web copies, individually or as a streamed zip.
- Thumbnail metadata is stripped by default at organization and share level; the
  original file is never rewritten.
- Out of scope: video, editing, proofing, uploads into Potokuadrat, storing originals,
  multi-tenant SaaS, watermark (v2 candidate), and two-way Drive sync.

## Brand Commitments

- Default product and site name: `Potokuadrat`.
- Visual language: botanical ink, folio paper, lime accent, Young Serif display with a
  plain sans body. See `DESIGN.md`.
- Client pages show the photographer's branding, not Potokuadrat's, apart from a small
  footer that can be disabled.

## Evidence on Hand

Measured on a real Drive folder: 269 JPEGs at 6000×4000, 1.9 GB; Drive thumbnails at
400/1600/2048px for JPEG, HEIC, and Sony ARW; 20 cold thumbnails in 1.2 s and cache
hits around 1.4 ms; segment-level metadata stripping verified with no decode. Details
live in `docs/specs/2026-10-30-potokuadrat-client-gallery-design.md`.

No organizer biography, photographs, or client examples are bundled. Do not present
invented album content as a real event.

## Product Principles

- Speed first: the first grid screen must appear before anything else on the page.
- The client never talks to Drive; the server is the only Drive reader.
- Safe defaults for privacy, explicit warnings when a setting weakens them.
- Every share setting is visible in the UI, never hidden in code.
- The photographer's brand leads; the software stays out of the way.
