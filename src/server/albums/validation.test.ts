import { describe, expect, it } from "vitest";

import {
  albumIdSchema,
  createAlbumSchema,
  setAlbumCoverSchema,
  updateAlbumSchema,
} from "./validation";

const folder = { driveFolderId: "1XtiPMDZ5FWFJv8IqWNjnZDqwJD9LmURQ", name: "Main" };

describe("createAlbumSchema", () => {
  it("accepts a title with at least one folder", () => {
    expect(createAlbumSchema.safeParse({ title: "Album", folders: [folder] }).success).toBe(true);
  });

  it("rejects a short title and an empty folder list", () => {
    expect(createAlbumSchema.safeParse({ title: "A", folders: [folder] }).success).toBe(false);
    expect(createAlbumSchema.safeParse({ title: "Album", folders: [] }).success).toBe(false);
  });
});

describe("updateAlbumSchema", () => {
  it("accepts a partial update", () => {
    expect(updateAlbumSchema.safeParse({ title: "Renamed" }).success).toBe(true);
    expect(updateAlbumSchema.safeParse({ branding: { accent: "#ff0066" } }).success).toBe(true);
    expect(updateAlbumSchema.safeParse({ branding: null }).success).toBe(true);
  });

  it("rejects an empty folder list, a bad accent, and unknown fields", () => {
    expect(updateAlbumSchema.safeParse({ folders: [] }).success).toBe(false);
    expect(updateAlbumSchema.safeParse({ branding: { accent: "red" } }).success).toBe(false);
    expect(updateAlbumSchema.safeParse({ ownerUserId: "user-2" }).success).toBe(false);
  });
});

describe("setAlbumCoverSchema", () => {
  it("accepts a photo id or null", () => {
    expect(
      setAlbumCoverSchema.safeParse({
        photoId: "10000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(true);
    expect(setAlbumCoverSchema.safeParse({ photoId: null }).success).toBe(true);
  });

  it("rejects anything else", () => {
    expect(setAlbumCoverSchema.safeParse({ photoId: "photo-1" }).success).toBe(false);
    expect(setAlbumCoverSchema.safeParse({}).success).toBe(false);
  });
});

describe("albumIdSchema", () => {
  it("accepts only UUIDs", () => {
    expect(albumIdSchema.safeParse("10000000-0000-4000-8000-000000000001").success).toBe(true);
    expect(albumIdSchema.safeParse("album-1").success).toBe(false);
  });
});
