import { describe, expect, it } from "vitest";

import { PHOTO_FILTERS } from "@/contracts/album";
import {
  FILTER_LABELS,
  buildShareThumbSrcSet,
  formatExpiry,
  resolvePreferredQuality,
} from "./share-gallery";

describe("FILTER_LABELS", () => {
  it("has a label for every PhotoFilter key", () => {
    for (const f of PHOTO_FILTERS) {
      expect(FILTER_LABELS[f]).toBeDefined();
      expect(typeof FILTER_LABELS[f]).toBe("string");
    }
  });

  it("covers exactly the four known filters", () => {
    expect(Object.keys(FILTER_LABELS)).toHaveLength(4);
  });
});

describe("formatExpiry", () => {
  it("returns null when expiresAt is null", () => {
    expect(formatExpiry(null)).toBeNull();
  });

  it("returns null for an invalid date string", () => {
    expect(formatExpiry("not-a-date")).toBeNull();
  });

  it("formats a valid ISO 8601 date as 'Mon DD, YYYY'", () => {
    // 2026-01-15 UTC → "Jan 15, 2026"
    const result = formatExpiry("2026-01-15T00:00:00.000Z");
    expect(result).toMatch(/Jan(uary)?\s+15,?\s+2026/);
  });

  it("returns a non-empty string for a valid date", () => {
    const result = formatExpiry("2027-06-30T12:00:00.000Z");
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
  });
});

describe("resolvePreferredQuality", () => {
  it("returns 'original' when it is in the allowed list", () => {
    expect(resolvePreferredQuality(["original", "web"])).toBe("original");
    expect(resolvePreferredQuality(["web", "original"])).toBe("original");
  });

  it("returns the first quality when 'original' is not allowed", () => {
    expect(resolvePreferredQuality(["web"])).toBe("web");
  });

  it("returns 'web' as the fallback when the list is empty", () => {
    expect(resolvePreferredQuality([])).toBe("web");
  });
});

describe("buildShareThumbSrcSet", () => {
  it("builds encoded responsive thumbnail srcSet widths", () => {
    expect(buildShareThumbSrcSet("album/one", "photo 2")).toBe(
      "/s/album%2Fone/thumb/photo%202?w=400 400w, /s/album%2Fone/thumb/photo%202?w=800 800w",
    );
    expect(buildShareThumbSrcSet("slug", "id", [800, 1600])).toBe(
      "/s/slug/thumb/id?w=800 800w, /s/slug/thumb/id?w=1600 1600w",
    );
  });
});
