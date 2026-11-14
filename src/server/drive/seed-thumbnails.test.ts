import { afterEach, describe, expect, it, vi } from "vitest";

import { isSeedMedia, seedThumbnail } from "./seed-thumbnails";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isSeedMedia", () => {
  it("accepts seeded photo ids outside production builds", () => {
    expect(isSeedMedia("seed-photo-01")).toBe(true);
    expect(isSeedMedia("seed-photo-24")).toBe(true);
    expect(isSeedMedia("seed-photo-100")).toBe(false);
  });

  it("rejects real Drive ids", () => {
    expect(isSeedMedia("1XtiPMDZ5FWFJv8IqWNjnZDqwJD9LmURQ")).toBe(false);
  });

  it("is disabled in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isSeedMedia("seed-photo-01")).toBe(false);
  });
});

describe("seedThumbnail", () => {
  it("returns a deterministic SVG for a seed id", () => {
    const first = seedThumbnail("seed-photo-07", 400);
    const second = seedThumbnail("seed-photo-07", 400);

    expect(first).not.toBeNull();
    expect(first?.contentType).toBe("image/svg+xml");
    expect(first?.etag).toBe('"seed-seed-photo-07-400"');
    expect(first?.body.equals(second?.body ?? Buffer.alloc(0))).toBe(true);
    expect(first?.body.toString()).toContain("Seed 07");
    expect(first?.body.toString()).toContain('width="400"');
  });

  it("keeps portrait seeds taller than wide", () => {
    const thumbnail = seedThumbnail("seed-photo-03", 400, true);
    expect(thumbnail?.body.toString()).toContain('height="533"');
  });

  it("returns null for unknown ids", () => {
    expect(seedThumbnail("1XtiPMDZ5FWFJv8IqWNjnZDqwJD9LmURQ", 400)).toBeNull();
    expect(seedThumbnail("seed-photo-07", 400)).not.toBeNull();
  });

  it("returns null in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(seedThumbnail("seed-photo-07", 400)).toBeNull();
  });
});
