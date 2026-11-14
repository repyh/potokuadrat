import { describe, expect, it } from "vitest";

import { createAlbumSlug } from "./slug";

describe("createAlbumSlug", () => {
  it("builds a readable slug with a random suffix", () => {
    const slug = createAlbumSlug("Autumn Architecture Symposium");

    expect(slug).toMatch(/^autumn-architecture-symposium-[0-9a-f]{8}$/);
  });

  it("strips punctuation and accents", () => {
    expect(createAlbumSlug("  Sésar's / Wedding!  ")).toMatch(/^sesar-s-wedding-[0-9a-f]{8}$/);
  });

  it("falls back to album when the title has no usable characters", () => {
    expect(createAlbumSlug("!!!")).toMatch(/^album-[0-9a-f]{8}$/);
  });

  it("does not repeat", () => {
    const slugs = new Set(Array.from({ length: 500 }, () => createAlbumSlug("Same title")));
    expect(slugs.size).toBe(500);
  });
});
