import { describe, expect, it, vi } from "vitest";

import type { Photo, PhotoPage } from "@/contracts/album";

import {
  countFavorites,
  loadAllRemainingPhotos,
  resolveGalleryTotal,
} from "./gallery-pages";

function photo(id: string): Photo {
  return {
    id,
    name: `${id}.jpg`,
    width: 6000,
    height: 4000,
    bytes: 1_000_000,
    orientation: "landscape",
    thumbStatus: "ready",
    takenAt: null,
    sortIndex: 0,
  };
}

function page(ids: string[], nextCursor: string | null, total = ids.length): PhotoPage {
  return { photos: ids.map(photo), nextCursor, total };
}

describe("loadAllRemainingPhotos", () => {
  it("follows every cursor and keeps page order", async () => {
    const requested: string[] = [];
    const result = await loadAllRemainingPhotos(page(["a"], "c1", 3), async (cursor) => {
      requested.push(cursor);
      return cursor === "c1" ? page(["b"], "c2", 3) : page(["c"], null, 3);
    });

    expect(requested).toEqual(["c1", "c2"]);
    expect(result.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("does not fetch when the initial page is the only page", async () => {
    const fetchPage = vi.fn();

    await expect(loadAllRemainingPhotos(page(["a"], null), fetchPage)).resolves.toEqual([
      photo("a"),
    ]);
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("deduplicates photos that appear on more than one page", async () => {
    const result = await loadAllRemainingPhotos(page(["a", "b"], "c1"), async () =>
      page(["b", "c"], null),
    );

    expect(result.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("rejects when a page cannot be loaded", async () => {
    await expect(
      loadAllRemainingPhotos(page(["a"], "c1"), async () => {
        throw new Error("page failed");
      }),
    ).rejects.toThrow("page failed");
  });
});

describe("countFavorites", () => {
  it("counts only photos present in the share and in the favorite set", () => {
    const photos = [photo("a"), photo("b"), photo("c")];

    expect(countFavorites(photos, new Set(["a", "c", "removed"]))).toBe(2);
  });

  it("returns zero when no loaded photo is a favorite", () => {
    expect(countFavorites([photo("a")], new Set(["b"]))).toBe(0);
  });
});

describe("resolveGalleryTotal", () => {
  it("uses the active filter total for non-favorites views", () => {
    expect(
      resolveGalleryTotal({
        filter: "landscape",
        mode: "public",
        serverTotal: 120,
        favoriteCount: 42,
      }),
    ).toBe(120);
  });

  it("uses the live favorite count for public and password favorites", () => {
    expect(
      resolveGalleryTotal({
        filter: "favorites",
        mode: "public",
        serverTotal: 269,
        favoriteCount: 42,
      }),
    ).toBe(42);
    expect(
      resolveGalleryTotal({
        filter: "favorites",
        mode: "password",
        serverTotal: 269,
        favoriteCount: 7,
      }),
    ).toBe(7);
  });

  it("uses the server total for magic-link favorites", () => {
    expect(
      resolveGalleryTotal({
        filter: "favorites",
        mode: "magic_link",
        serverTotal: 269,
        favoriteCount: 50,
      }),
    ).toBe(269);
  });
});
