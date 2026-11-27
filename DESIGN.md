---
name: Potokuadrat
description: A self-hosted client gallery that feels like an open photographic folio.
colors:
  ink: "#183c34"
  ground: "#dce6d3"
  paper: "#e9eee2"
  surface: "#f8f8f0"
  accent: "#d9ef63"
  quiet: "#50675d"
  rule: "#c6d0c3"
typography:
  display:
    fontFamily: "Young Serif, Georgia, serif"
    fontSize: "clamp(2.625rem, 4.8vw, 4.125rem)"
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "15px"
    fontWeight: 400
rounded:
  square: "0px"
  circle: "50%"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "0 20px"
    height: "52px"
  photo-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "0"
---

## Overview

**Creative North Star: “The Open Photographic Folio”**

Potokuadrat is a guest folio for photographs. A dark spine carries the album title,
the photographer, and the photo count; the open page is the grid. The system comes
from the printed welcome packet: deep botanical ink, a pale spread, fine rules, and a
lime leaf tab marking the next action. The client should feel they were handed an
album, not dropped into a file browser.

The gallery is the product, so the visual system must never compete with the
photographs. Ink and paper hold the frame; the photographs stay unfiltered. Filters,
favorites, and downloads sit at the edge of the grid, not over it.

**Key characteristics:**

- A dark folio spine identifies the album and the photographer at a glance.
- The lime accent marks one primary action at a time: open the album, download, or
  unlock a share.
- Young Serif gives album titles a printed character; Arial keeps counts, filters, and
  metadata practical.
- Square corners and hairline rules frame the photographs; only avatars are circular.
- The grid is the hero. No decorative gradients, glass, or illustration substitutes.

## Colors

Deep botanical ink anchors the spine, headings, and controls. A cool green ground sits
behind the folio, and the near-white surface is the reading and grid area. Lime is
reserved for the primary action and the active filter. Quiet text and fine rules carry
counts, dimensions, and file sizes without competing with the images.

Branding comes from the organization row in the database, with optional per-share
overrides resolved on the server (`share override -> album -> organization`): title, logo
(with initial letter fallback), welcome message, and accent hex color (paired with
curated `ACCENT_PRESETS`: Lime Leaf `#d9ef63`, Warm Ochre `#d4a24c`, Pale Sky `#b8d8e8`,
Blush `#f0c9c0`, Mint `#c9f0d4`, and Butter `#f5e6a8`; each keeps ink text legible on the
primary action). Footer attribution visibility is configured per organization
(`organizations.footer_enabled`).

In `src/app/globals.css`, `:root` exposes `--ground` (`#e9eee2`), `--paper` (`#f8f8f0`),
`--surface` (`#f8f8f0`), `--ink` (`#183c34`), `--accent` (`#d9ef63`), `--quiet` (`#50675d`),
`--line` (`#c6d0c3`), and `--rule` (`#c6d0c3`), while `.folio-frame` binds `--brand-accent`
from the resolved branding.

## Typography

Young Serif is self-hosted and used for album titles, photographer names, empty-state
headlines, and the spine note. Arial carries navigation, filter chips, counts,
metadata, and controls. Keep body copy near a 65–75 character measure. Numerals in
counts, sizes, and progress readouts must be tabular.

## Layout

At desktop widths, the dark spine sits beside the open folio page. The album header
holds the title, photographer, photo count, and share actions; the grid follows
immediately, with the first row visible without scrolling. Grid columns are driven by
a minimum tile width, never a fixed count, so portrait and landscape frames keep
their own aspect ratio without cropping the photograph's edges.

Below 920px the spine collapses into a compact header and the actions move under the
album title. Below 640px the grid becomes two columns, the lightbox fills the
viewport, and the download control pins to the bottom bar.

Admin pages reuse the same frame: spine navigation on the left, ruled rows and tables
on the open page.

## Elevation & Depth

The folio sits above the green ground with one broad, low-contrast shadow offset
downward. Inside the page, separation comes from hairline rules and tonal surfaces.
The lightbox is the only true overlay: a dimmed ink scrim with the photograph centered
and controls on the frame edge. Do not stack shadows on cards.

## Shapes

The folio frame, album header, photo tiles, filter chips, and primary action use square
corners. Only the photographer avatar and the favorite marker are circular. Borders
are thin and always separate real surfaces or rows. The heart, arrows, and download
glyphs are line icons at the same stroke weight as the rules.

## Components

- **Primary action:** lime square button or link with a clear label and a right arrow.
  Hover inverts to ink with pale text; keyboard focus uses a visible accent outline.
- **Album spine:** title, photographer, photo count, share status, and the in-page
  destinations (Photos, Favorites, Downloads). The current destination gets a small
  lime marker.
- **Photo tile:** a square-cornered frame with the image, a favorite control in the
  corner, and the filename revealed on focus. Loading uses a tonal skeleton at the
  tile's aspect ratio, never a spinner over the grid.
- **Filter bar:** ruled chips for All, Favorites, Landscape, Portrait with tabular
  counts. The active chip uses ink fill and pale text, not the accent.
- **Lightbox:** full-viewport native dialog, photograph centered, filename,
  dimensions, position (`12 / 269`), previous/next, favorite, download, close. Neighbors
  preload at 1600px.
- **Share gate:** password or magic-link form in a ruled panel on paper, with one
  primary action and a clear error state for expired or revoked links.
- **Download menu:** quality choice (Original, Web 2048) and scope (all, favorites),
  with a warning when zip size is large.
- **Admin rows and tables:** ruled, full width, tabular numerals for sizes and counts;
  destructive actions use the danger button and a confirmation dialog.

## Do's and Don'ts

- Do let the grid reach the first viewport; no hero illustration above it.
- Do keep counts, dimensions, and file sizes in tabular numerals.
- Do show a clear, human message for expired shares, revoked access, and failed
  thumbnails instead of a blank grid.
- Do label empty states and sample content explicitly.
- Don't autoplay anything over the photographs; no carousels that hide the album.
- Don't crop photos to a uniform tile or apply decorative filters.
- Don't add gradients, glass effects, or icon glyphs that compete with the folio frame.
- Don't use the accent color for more than one action per view.
