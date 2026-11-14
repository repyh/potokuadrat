import { describe, expect, it } from "vitest";

import { naturalCompare } from "./sort";

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
