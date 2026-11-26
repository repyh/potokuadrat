import { describe, expect, it } from "vitest";

import { PHOTO_FILTERS, PHOTO_SORTS } from "@/contracts/album";
import {
  FILTER_LABELS,
  SORT_LABELS,
  formatExpiry,
  formatShareBytes,
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

describe("SORT_LABELS", () => {
  it("has a label for every PhotoSort key", () => {
    for (const s of PHOTO_SORTS) {
      expect(SORT_LABELS[s]).toBeDefined();
      expect(typeof SORT_LABELS[s]).toBe("string");
    }
    expect(Object.keys(SORT_LABELS)).toHaveLength(3);
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

describe("formatShareBytes", () => {
  it("formats zero and byte magnitudes cleanly", () => {
    expect(formatShareBytes(0)).toBe("0 B");
    expect(formatShareBytes(1024)).toBe("1.0 KB");
    expect(formatShareBytes(24 * 1024 * 1024)).toBe("24.0 MB");
    expect(formatShareBytes(1.5 * 1024 * 1024 * 1024)).toBe("1.50 GB");
  });
});
