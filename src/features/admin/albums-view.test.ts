import { describe, expect, it } from "vitest";
import { ALBUM_STATUS_CONFIG, formatAlbumDate } from "./albums-view";

describe("AlbumsView Helpers", () => {
  it("formats dates into US English readable strings", () => {
    const formatted = formatAlbumDate("2026-11-21T10:00:00.000Z");
    expect(formatted).toContain("Nov");
    expect(formatted).toContain("2026");
  });

  it("handles invalid date gracefully", () => {
    expect(formatAlbumDate("invalid-date-string")).toBe("—");
  });

  it("provides status config for all AlbumSummary statuses", () => {
    expect(ALBUM_STATUS_CONFIG.ready.label).toBe("Public");
    expect(ALBUM_STATUS_CONFIG.ready.dotClass).toContain("bg-[#15803d]");

    expect(ALBUM_STATUS_CONFIG.indexing.label).toContain("Indexing");
    expect(ALBUM_STATUS_CONFIG.indexing.dotClass).toContain("bg-[#b45309]");

    expect(ALBUM_STATUS_CONFIG.failed.label).toContain("Failed");
    expect(ALBUM_STATUS_CONFIG.failed.dotClass).toContain("bg-[#b91c1c]");
  });
});
