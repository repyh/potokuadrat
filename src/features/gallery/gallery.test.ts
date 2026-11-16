import { describe, expect, it } from "vitest";
import type { Photo, PhotoFilter } from "./types";

const mockPhotos: Photo[] = [
  {
    id: "p1",
    name: "photo-landscape-1.jpg",
    width: 6000,
    height: 4000,
    bytes: 3145728, // 3 MB
    orientation: "landscape",
    thumbStatus: "ready",
    takenAt: "2026-10-01T10:00:00Z",
    sortIndex: 0,
  },
  {
    id: "p2",
    name: "photo-portrait-1.jpg",
    width: 3000,
    height: 4500,
    bytes: 1572864, // 1.5 MB
    orientation: "portrait",
    thumbStatus: "ready",
    takenAt: "2026-10-02T10:00:00Z",
    sortIndex: 1,
  },
  {
    id: "p3",
    name: "photo-landscape-2.jpg",
    width: 4000,
    height: 3000,
    bytes: 524288, // 512 KB
    orientation: "landscape",
    thumbStatus: "ready",
    takenAt: "2026-10-03T10:00:00Z",
    sortIndex: 2,
  },
];

describe("Gallery filtering logic", () => {
  function filterPhotos(
    photos: Photo[],
    filter: PhotoFilter,
    favorites: Set<string>,
  ): Photo[] {
    switch (filter) {
      case "landscape":
        return photos.filter((p) => p.orientation === "landscape");
      case "portrait":
        return photos.filter((p) => p.orientation === "portrait");
      case "favorites":
        return photos.filter((p) => favorites.has(p.id));
      case "all":
      default:
        return photos;
    }
  }

  it("filters all photos", () => {
    const result = filterPhotos(mockPhotos, "all", new Set());
    expect(result).toHaveLength(3);
  });

  it("filters landscape photos accurately", () => {
    const result = filterPhotos(mockPhotos, "landscape", new Set());
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("filters portrait photos accurately", () => {
    const result = filterPhotos(mockPhotos, "portrait", new Set());
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("p2");
  });

  it("filters favorites accurately according to client favorite set", () => {
    const favorites = new Set(["p2", "p3"]);
    const result = filterPhotos(mockPhotos, "favorites", favorites);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(["p2", "p3"]);
  });

  it("returns empty array when favorites set is empty", () => {
    const result = filterPhotos(mockPhotos, "favorites", new Set());
    expect(result).toHaveLength(0);
  });
});

describe("Lightbox navigation calculations", () => {
  function getNextIndex(current: number, total: number): number {
    if (total === 0) return 0;
    return (current + 1) % total;
  }

  function getPrevIndex(current: number, total: number): number {
    if (total === 0) return 0;
    return (current - 1 + total) % total;
  }

  it("advances cyclically to the next frame", () => {
    expect(getNextIndex(0, 3)).toBe(1);
    expect(getNextIndex(1, 3)).toBe(2);
    expect(getNextIndex(2, 3)).toBe(0); // wraps around
  });

  it("recedes cyclically to the previous frame", () => {
    expect(getPrevIndex(2, 3)).toBe(1);
    expect(getPrevIndex(1, 3)).toBe(0);
    expect(getPrevIndex(0, 3)).toBe(2); // wraps around to end
  });

  it("handles single photo edge case", () => {
    expect(getNextIndex(0, 1)).toBe(0);
    expect(getPrevIndex(0, 1)).toBe(0);
  });
});

describe("Lightbox byte formatting", () => {
  function formatBytes(bytes: number | null): string {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  it("formats kilobytes correctly", () => {
    expect(formatBytes(524288)).toBe("512.0 KB");
  });

  it("formats megabytes correctly", () => {
    expect(formatBytes(3145728)).toBe("3.0 MB");
  });

  it("handles null or zero bytes safely", () => {
    expect(formatBytes(null)).toBe("");
    expect(formatBytes(0)).toBe("");
  });
});
