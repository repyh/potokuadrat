import { describe, expect, it } from "vitest";

import {
  adminPhotoThumbUrl,
  formatPhotoBytes,
  formatPhotoDimensions,
  movePhoto,
} from "./album-media";

describe("adminPhotoThumbUrl", () => {
  it("builds the authenticated admin thumbnail URL", () => {
    expect(adminPhotoThumbUrl("album-1", "photo-2", 400)).toBe(
      "/api/admin/albums/album-1/photos/photo-2/thumb?w=400",
    );
  });
});

describe("movePhoto", () => {
  it("reorders an item forward or backward cleanly", () => {
    expect(movePhoto(["a", "b", "c", "d"], 1, 3)).toEqual(["a", "c", "d", "b"]);
    expect(movePhoto(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("returns a shallow copy without changes for out-of-bounds or identical indices", () => {
    expect(movePhoto(["a", "b"], 0, 0)).toEqual(["a", "b"]);
    expect(movePhoto(["a", "b"], -1, 1)).toEqual(["a", "b"]);
    expect(movePhoto(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});

describe("formatPhotoBytes", () => {
  it("formats null and byte magnitudes cleanly", () => {
    expect(formatPhotoBytes(null)).toBe("—");
    expect(formatPhotoBytes(512)).toBe("512 B");
    expect(formatPhotoBytes(1536)).toBe("1.5 KB");
    expect(formatPhotoBytes(4 * 1024 * 1024)).toBe("4.0 MB");
  });
});

describe("formatPhotoDimensions", () => {
  it("formats valid dimensions and falls back for missing ones", () => {
    expect(formatPhotoDimensions(4000, 2667)).toBe("4000 × 2667");
    expect(formatPhotoDimensions(null, 2000)).toBe("—");
  });
});
