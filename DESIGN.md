---
name: Potokuadrat
description: A welcoming public folio for event organizers and their shared documents.
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
  organizer-card:
    backgroundColor: "color-mix(in srgb, #e9eee2 54%, #f8f8f0)"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "21px 22px 22px"
---

## Overview

**Creative North Star: “The Open Welcome Folio”**

Potokuadrat is a guest folio made for the web. Its pages introduce the organizer and open directly into a useful public document index. The visual system comes from the printed welcome packet: a deep spine, an open pale spread, readable ruled entries, and a bright leaf tab that points to the next action.

The interface should feel hospitable and organized, with enough character to make a self-hosted event space memorable. The organizer’s identity leads; public files remain easy to scan and open. Instagram, Pinterest, and YouTube informed compact identity, visual discovery, and clear content hierarchy. The page uses those patterns within its own folio structure.

**Key Characteristics:**

- The dark folio spine makes the event name and page destinations easy to find.
- A configurable lime accent marks the primary action and current section.
- Young Serif gives headings a printed character; Arial keeps navigation and metadata practical.
- Ruled document rows keep the public collection direct and scannable.

## Colors

Deep botanical ink anchors the navigation and headings. A cool green ground sits behind the folio, while a soft near-white surface provides a calm reading area. The lime accent is reserved for the primary action and active navigation. Quiet text and fine rules keep supporting details legible without competing with the organizer or document titles.

The event organizer can adjust the default accent, ink, paper, and surface colors through the root `config.json`.

## Typography

Young Serif is self-hosted for display text and short folio notes. Use it for page headings, organizer names, document titles, and the spine note. Use the sans-serif body stack for navigation, descriptions, metadata, controls, and supporting copy. Keep body text near a 65–75 character measure where the layout permits it.

## Layout

At desktop widths, a dark left spine sits beside the open reading page. The welcome spread places the primary message and organizer preview side by side, followed immediately by the public document index. At widths below 920px, the organizer preview follows the welcome copy. Below 640px, the spine becomes a compact header with a second row of page links; the reading page becomes a single column.

Use generous separation around major page sections and tighter spacing inside profile and document groups. Keep document rows full width and use disclosure details for sample previews.

## Elevation & Depth

The folio sits above the green page ground with a broad, low-contrast shadow offset downward. Interior surfaces use fine rules and tonal separation rather than repeated shadows.

## Shapes

The folio frame, organizer preview, document tabs, and primary action use square corners. Only the organizer initial and its profile avatar are circular. Keep borders thin and use them to separate real page surfaces or document entries.

## Components

- **Primary action:** Lime square-cornered link with a clear action label and a small right arrow. Hover inverts to ink with pale text; keyboard focus uses a visible accent outline.
- **Spine navigation:** Two in-page links. The current destination receives a small lime marker and quiet tonal emphasis.
- **Organizer preview:** A lightly tinted, ruled panel with initials, organizer name, role, tagline, summary, and a link to public documents.
- **Document disclosure:** A full-width ruled row with a paper tab, document kind, title, duration, and a plus/minus control. Expanding reveals clearly labeled sample content.
- **Sample label:** A bordered text label that distinguishes illustrative entries from real event documents.

## Do's and Don'ts

- Do keep the event name, organizer details, page description, and palette configurable in `config.json`.
- Do label all fabricated document content as sample material until an organizer replaces it.
- Do keep the first viewport focused on the organizer and public-document action.
- Don't imply that example files, biographies, event dates, or client references are real.
- Don't turn the document index into a uniform social-media card grid.
- Don't add decorative gradients, glass effects, or icon glyphs that compete with the folio’s printed structure.
