import { describe, expect, it } from "vitest";

import { parseFavoriteIds } from "./use-share-favorites";

describe("parseFavoriteIds", () => {
  it("returns an array of string ids from a valid JSON array", () => {
    const raw = JSON.stringify(["id-1", "id-2", "id-3"]);
    expect(parseFavoriteIds(raw)).toEqual(["id-1", "id-2", "id-3"]);
  });

  it("returns an empty array for an empty JSON array", () => {
    expect(parseFavoriteIds("[]")).toEqual([]);
  });

  it("filters out non-string elements from a mixed array", () => {
    const raw = JSON.stringify(["id-1", 42, null, true, "id-2"]);
    expect(parseFavoriteIds(raw)).toEqual(["id-1", "id-2"]);
  });

  it("returns an empty array for invalid JSON", () => {
    expect(parseFavoriteIds("not-json")).toEqual([]);
  });

  it("returns an empty array when the JSON value is not an array", () => {
    expect(parseFavoriteIds(JSON.stringify({ id: "id-1" }))).toEqual([]);
    expect(parseFavoriteIds(JSON.stringify("id-1"))).toEqual([]);
    expect(parseFavoriteIds(JSON.stringify(123))).toEqual([]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseFavoriteIds("")).toEqual([]);
  });
});
