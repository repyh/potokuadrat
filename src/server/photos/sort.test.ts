import { describe, expect, it } from "vitest";

import { comparePhotos, naturalCompare, type SortablePhoto } from "./sort";

describe("naturalCompare", () => {
  it("orders numeric runs like a person would", () => {
    expect(naturalCompare("TOP2.jpg", "TOP10.jpg")).toBeLessThan(0);
    expect(naturalCompare("TOP10.jpg", "TOP2.jpg")).toBeGreaterThan(0);
    expect(naturalCompare("TOP2.jpg", "TOP2.jpg")).toBe(0);
  });

  it("is case-insensitive for filenames from different cameras", () => {
    expect(naturalCompare("dsc001.jpg", "DSC002.jpg")).toBeLessThan(0);
  });

  it("sorts a realistic list", () => {
    const names = ["TOP10.jpg", "top1.jpg", "TOP003.jpg", "TOP2.jpg"];
    expect([...names].sort(naturalCompare)).toEqual([
      "top1.jpg",
      "TOP2.jpg",
      "TOP003.jpg",
      "TOP10.jpg",
    ]);
  });
});

describe("comparePhotos", () => {
  const photos: SortablePhoto[] = [
    {
      id: "00000000-0000-4000-8000-000000000003",
      name: "IMG_10.jpg",
      takenAt: null,
      sortIndex: 0,
    },
    {
      id: "00000000-0000-4000-8000-000000000001",
      name: "IMG_2.jpg",
      takenAt: new Date("2026-10-02T12:00:00Z"),
      sortIndex: 2,
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      name: "IMG_2.jpg",
      takenAt: new Date("2026-10-01T08:00:00Z"),
      sortIndex: 1,
    },
  ];

  it("keeps sort_index then id order in manual mode", () => {
    expect([...photos].sort((a, b) => comparePhotos(a, b, "manual")).map((p) => p.id)).toEqual([
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000001",
    ]);
  });

  it("orders filenames naturally with sort_index as tie-breaker", () => {
    expect([...photos].sort((a, b) => comparePhotos(a, b, "name")).map((p) => p.id)).toEqual([
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000003",
    ]);
  });

  it("orders by takenAt ascending and puts missing EXIF dates last", () => {
    expect([...photos].sort((a, b) => comparePhotos(a, b, "taken")).map((p) => p.id)).toEqual([
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000003",
    ]);
  });
});
