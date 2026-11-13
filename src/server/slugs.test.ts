import { describe, expect, it } from "vitest";

import { createShareSlug, isValidShareSlug } from "./slugs";

describe("createShareSlug", () => {
  it("produces 22 URL-safe characters", () => {
    const slug = createShareSlug();
    expect(slug).toHaveLength(22);
    expect(isValidShareSlug(slug)).toBe(true);
  });

  it("does not repeat across many calls", () => {
    const slugs = new Set(Array.from({ length: 1_000 }, () => createShareSlug()));
    expect(slugs.size).toBe(1_000);
  });
});

describe("isValidShareSlug", () => {
  it("rejects values that are too short, too long, or unsafe", () => {
    expect(isValidShareSlug("")).toBe(false);
    expect(isValidShareSlug("short")).toBe(false);
    expect(isValidShareSlug("a".repeat(22))).toBe(true);
    expect(isValidShareSlug("a".repeat(23))).toBe(false);
    expect(isValidShareSlug("../etc/passwd-aaaaaaaaaa")).toBe(false);
  });
});
