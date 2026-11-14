import { describe, expect, it, vi } from "vitest";

import type { DrivePhoto } from "@/server/drive/client";

import { indexAlbum } from "./indexing";
import type { AlbumRepository } from "./repository";

function photo(overrides: Partial<DrivePhoto> & { id: string; name: string }): DrivePhoto {
  return {
    mimeType: "image/jpeg",
    width: 6000,
    height: 4000,
    bytes: 100,
    modifiedTime: "2026-11-01T10:00:00.000Z",
    takenAt: "2026-10-30T08:00:00.000Z",
    thumbnailLink: null,
    ...overrides,
  };
}

function repository(overrides: Partial<AlbumRepository> = {}): AlbumRepository {
  return {
    ensureDriveFolders: vi.fn(),
    createAlbum: vi.fn(),
    listAlbums: vi.fn(),
    getAlbum: vi.fn(async () => ({
      id: "album-1",
      title: "Album",
      slug: "album",
      ownerUserId: "user-1",
      status: "ready" as const,
    })),
    getAlbumFolders: vi.fn(async () => [
      { id: "folder-1", driveFolderId: "drive-folder-1", name: "A", recursive: true },
      { id: "folder-2", driveFolderId: "drive-folder-2", name: "B", recursive: false },
    ]),
    getAlbumDetail: vi.fn(),
    setStatus: vi.fn(async () => {}),
    upsertPhotos: vi.fn(async () => {}),
    markMissingPhotos: vi.fn(async () => 1),
    countProgress: vi.fn(async () => ({
      total: 3,
      ready: 0,
      pending: 3,
      failed: 0,
      missing: 0,
    })),
    ...overrides,
  } as AlbumRepository;
}

describe("indexAlbum", () => {
  it("merges folders, dedupes, sorts naturally, and marks missing files", async () => {
    const top10 = photo({ id: "file-top10", name: "TOP10.jpg" });
    const top2 = photo({ id: "file-top2", name: "TOP2.jpg" });
    const sub = photo({ id: "file-sub1", name: "SUB1.jpg", width: 4000, height: 6000 });
    const repo = repository();
    const drive = {
      listImages: vi.fn(async (folderId: string) =>
        folderId === "drive-folder-1" ? [top10, top2] : [top2, sub],
      ),
    };

    const progress = await indexAlbum("album-1", { repository: repo, drive });

    expect(drive.listImages).toHaveBeenCalledWith("drive-folder-1", { recursive: true });
    expect(drive.listImages).toHaveBeenCalledWith("drive-folder-2", { recursive: false });

    const rows = vi.mocked(repo.upsertPhotos).mock.calls[0][1];
    expect(rows.map((row) => row.name)).toEqual(["SUB1.jpg", "TOP2.jpg", "TOP10.jpg"]);
    expect(rows.map((row) => row.sortIndex)).toEqual([0, 1, 2]);
    expect(rows[0]).toMatchObject({ width: 4000, height: 6000 });
    expect(rows[1].takenAt).toBeInstanceOf(Date);

    expect(repo.markMissingPhotos).toHaveBeenCalledWith("album-1", [
      "file-sub1",
      "file-top2",
      "file-top10",
    ]);
    expect(vi.mocked(repo.setStatus).mock.calls).toEqual([
      ["album-1", "indexing"],
      ["album-1", "ready"],
    ]);
    expect(progress).toMatchObject({ total: 3, pending: 3 });
  });

  it("marks the album failed and rethrows when Drive fails", async () => {
    const repo = repository();
    const drive = {
      listImages: vi.fn(async () => {
        throw new Error("Drive exploded");
      }),
    };

    await expect(indexAlbum("album-1", { repository: repo, drive })).rejects.toThrow(
      "Drive exploded",
    );

    expect(repo.upsertPhotos).not.toHaveBeenCalled();
    expect(vi.mocked(repo.setStatus).mock.calls).toEqual([
      ["album-1", "indexing"],
      ["album-1", "failed"],
    ]);
  });

  it("rejects an unknown album without touching Drive", async () => {
    const repo = repository({ getAlbum: vi.fn(async () => null) });
    const drive = { listImages: vi.fn() };

    await expect(indexAlbum("missing", { repository: repo, drive })).rejects.toThrow(
      /not found/,
    );
    expect(drive.listImages).not.toHaveBeenCalled();
  });
});
