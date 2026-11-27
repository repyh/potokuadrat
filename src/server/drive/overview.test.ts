import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readDriveLimits } from "./overview";

describe("readDriveLimits", () => {
  it("reads configured limits without requiring a key file", () => {
    expect(
      readDriveLimits({
        DRIVE_INDEX_MAX_DEPTH: "8",
        DRIVE_CONCURRENCY: "6",
        THUMB_CACHE_MAX_BYTES: "1073741824",
        THUMB_CACHE_MAX_FILES: "50000",
      }),
    ).toEqual({
      indexMaxDepth: 8,
      concurrency: 6,
      cacheMaxBytes: 1073741824,
      cacheMaxFiles: 50000,
      evictionPolicy: "LRU",
    });
  });

  it("falls back safely to shipped defaults when values are missing or invalid", () => {
    expect(readDriveLimits({})).toEqual({
      indexMaxDepth: 5,
      concurrency: 4,
      cacheMaxBytes: 5 * 1024 ** 3,
      cacheMaxFiles: 200_000,
      evictionPolicy: "LRU",
    });
  });
});
