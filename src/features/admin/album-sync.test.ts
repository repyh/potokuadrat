import { describe, expect, it } from "vitest";
import { ALBUM_STATUS_STYLES, getAlbumSyncBadge } from "./album-sync-card";

describe("AlbumSyncCard helpers (Figma O10 Drive)", () => {
  it("returns correct badge label and styling for ready status", () => {
    const badge = getAlbumSyncBadge("ready");
    expect(badge.label).toBe("Synced & Ready");
    expect(badge.badge).toContain("bg-[#dcfce7]");
  });

  it("returns correct badge label and styling for indexing status", () => {
    const badge = getAlbumSyncBadge("indexing");
    expect(badge.label).toBe("Indexing in progress…");
    expect(badge.badge).toContain("bg-[#fef3c7]");
  });

  it("returns correct badge label and styling for failed status", () => {
    const badge = getAlbumSyncBadge("failed");
    expect(badge.label).toBe("Indexing Failed");
    expect(badge.badge).toContain("bg-[#fee2e2]");
  });

  it("provides status mappings for all defined AlbumStatus keys", () => {
    expect(ALBUM_STATUS_STYLES.ready).toBeDefined();
    expect(ALBUM_STATUS_STYLES.indexing).toBeDefined();
    expect(ALBUM_STATUS_STYLES.failed).toBeDefined();
  });
});

