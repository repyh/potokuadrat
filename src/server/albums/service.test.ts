import { describe, expect, it, vi } from "vitest";

import type { AlbumRepository, FolderInput } from "./repository";
import { AlbumValidationError, createAlbumService } from "./service";

const folderId = "1XtiPMDZ5FWFJv8IqWNjnZDqwJD9LmURQ";
const otherFolderId = "1AbCdEfGhIjKlMnOpQrStUvWxYz";

function repository(overrides: Partial<AlbumRepository> = {}): AlbumRepository {
  return {
    ensureDriveFolders: vi.fn(async (_owner: string, folders: FolderInput[]) =>
      folders.map((folder, index) => ({
        id: `local-${index}`,
        driveFolderId: folder.driveFolderId,
        name: folder.name,
        recursive: folder.recursive,
        lastIndexedAt: null,
      })),
    ),
    createAlbum: vi.fn(async (input) => ({
      id: "album-1",
      slug: input.slug,
      title: input.title,
      status: "indexing" as const,
      coverPhotoId: null,
      photoCount: 0,
      readyPhotoCount: 0,
      shareCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    listAlbums: vi.fn(async () => []),
    getOrganizerStats: vi.fn(async () => ({
      albumCount: 0,
      indexingAlbumCount: 0,
      shareCount: 0,
      expiringShareCount: 0,
      indexedPhotoCount: 0,
      failedPhotoCount: 0,
      lastIndexedAt: null,
    })),
    getAlbum: vi.fn(async () => ({
      id: "album-1",
      title: "Album",
      slug: "album",
      ownerUserId: "user-1",
      status: "ready" as const,
    })),
    getAlbumFolders: vi.fn(async () => []),
    getAlbumDetail: vi.fn(async () => null),
    setStatus: vi.fn(async () => {}),
    updateAlbum: vi.fn(async () => {}),
    replaceFolders: vi.fn(async () => {}),
    deleteAlbum: vi.fn(async () => {}),
    setCoverPhoto: vi.fn(async () => {}),
    findAlbumPhoto: vi.fn(async () => ({ id: "photo-1" })),
    findAlbumPhotoMedia: vi.fn(async () => null),
    upsertPhotos: vi.fn(async () => {}),
    markMissingPhotos: vi.fn(async () => 0),
    countProgress: vi.fn(async () => ({
      total: 0,
      ready: 0,
      pending: 0,
      failed: 0,
      missing: 0,
    })),
    listAlbumPhotos: vi.fn(async () => []),
    setPhotoOrder: vi.fn(async () => {}),
    ...overrides,
  } as AlbumRepository;
}

function makeService(repo: AlbumRepository, options: {
  getFolder?: (id: string) => Promise<{ id: string; name: string }>;
  enqueue?: (albumId: string) => Promise<void>;
} = {}) {
  return createAlbumService({
    repository: repo,
    drive: () => ({ getFolder: options.getFolder ?? (async (id) => ({ id, name: "Fetched" })) }),
    enqueueIndex: options.enqueue ?? (async () => {}),
  });
}

describe("createAlbumService", () => {
  it("uses the provided folder name and dedupes repeated ids", async () => {
    const repo = repository();
    const enqueue = vi.fn(async () => {});
    const service = makeService(repo, { enqueue });

    const album = await service.create("user-1", {
      title: "  Autumn Symposium  ",
      folders: [
        { driveFolderId: folderId, name: "Main" },
        { driveFolderId: folderId, name: "Main duplicate" },
      ],
    });

    expect(album.title).toBe("Autumn Symposium");
    expect(repo.ensureDriveFolders).toHaveBeenCalledTimes(1);
    const ensured = vi.mocked(repo.ensureDriveFolders).mock.calls[0][1];
    expect(ensured).toEqual([{ driveFolderId: folderId, name: "Main", recursive: true }]);
    expect(repo.createAlbum).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUserId: "user-1", title: "Autumn Symposium" }),
    );
    expect(enqueue).toHaveBeenCalledWith("album-1", { mode: "full" });
  });

  it("accepts a Drive folder URL and fetches the name when it is missing", async () => {
    const repo = repository();
    const getFolder = vi.fn(async (id: string) => ({ id, name: "From Drive" }));
    const service = makeService(repo, { getFolder });

    await service.create("user-1", {
      title: "Album",
      folders: [{ driveFolderId: `https://drive.google.com/drive/folders/${folderId}?usp=sharing` }],
    });

    expect(getFolder).toHaveBeenCalledWith(folderId);
    expect(repo.ensureDriveFolders).toHaveBeenCalledWith("user-1", [
      { driveFolderId: folderId, name: "From Drive", recursive: true },
    ]);
  });

  it("rejects an invalid folder input before writing", async () => {
    const repo = repository();
    const service = makeService(repo);

    await expect(
      service.create("user-1", {
        title: "Album",
        folders: [{ driveFolderId: "https://example.com/not-a-folder" }],
      }),
    ).rejects.toBeInstanceOf(AlbumValidationError);

    expect(repo.ensureDriveFolders).not.toHaveBeenCalled();
    expect(repo.createAlbum).not.toHaveBeenCalled();
  });

  it("marks the album failed when the job cannot be queued", async () => {
    const repo = repository();
    const service = makeService(repo, {
      enqueue: async () => {
        throw new Error("queue down");
      },
    });

    await expect(
      service.create("user-1", {
        title: "Album",
        folders: [{ driveFolderId: folderId, name: "Main" }],
      }),
    ).rejects.toThrow("queue down");

    expect(repo.setStatus).toHaveBeenCalledWith("album-1", "failed");
  });

  it("re-indexes an existing album and returns false for a missing one", async () => {
    const repo = repository();
    const enqueue = vi.fn(async () => {});
    const service = makeService(repo, { enqueue });

    expect(await service.reindex("user-1", "album-1")).toBe(true);
    expect(repo.setStatus).toHaveBeenCalledWith("album-1", "indexing");
    expect(enqueue).toHaveBeenCalledWith("album-1", { mode: "full" });

    const missing = makeService(repository({ getAlbum: vi.fn(async () => null) }));
    expect(await missing.reindex("user-1", "nope")).toBe(false);

    const notOwned = makeService(
      repository({
        getAlbum: vi.fn(async () => ({
          id: "album-1",
          title: "Album",
          slug: "album",
          ownerUserId: "user-2",
          status: "ready" as const,
        })),
      }),
    );
    expect(await notOwned.reindex("user-1", "album-1")).toBe(false);
  });

  it("returns organizer stats from the repository", async () => {
    const stats = {
      albumCount: 3,
      indexingAlbumCount: 1,
      shareCount: 5,
      expiringShareCount: 2,
      indexedPhotoCount: 120,
      failedPhotoCount: 4,
      lastIndexedAt: "2026-11-21T09:00:00.000Z",
    };
    const service = makeService(repository({ getOrganizerStats: vi.fn(async () => stats) }));

    expect(await service.stats("user-1")).toEqual(stats);
  });

  it("updates the title and branding for the owner only", async () => {
    const detail = {
      album: {
        id: "album-1",
        slug: "album",
        title: "Renamed",
        status: "ready" as const,
        coverPhotoId: null,
        photoCount: 0,
        readyPhotoCount: 0,
        shareCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      folders: [],
      progress: { total: 0, ready: 0, pending: 0, failed: 0, missing: 0 },
    };
    const repo = repository({ getAlbumDetail: vi.fn(async () => detail) });
    const service = makeService(repo);

    const updated = await service.update("user-1", "album-1", {
      title: "  Renamed  ",
      branding: { accent: "#ff0066" },
    });

    expect(updated).toBe(detail);
    expect(repo.updateAlbum).toHaveBeenCalledWith("album-1", {
      title: "Renamed",
      branding: { accent: "#ff0066" },
    });

    expect(await service.update("user-2", "album-1", { title: "Nope" })).toBeNull();
    expect(repo.updateAlbum).toHaveBeenCalledTimes(1);
  });

  it("replaces folders and queues a full re-index", async () => {
    const repo = repository();
    const enqueue = vi.fn(async () => {});
    const service = makeService(repo, { enqueue });

    await service.update("user-1", "album-1", {
      folders: [{ driveFolderId: folderId, name: "New" }],
    });

    expect(repo.ensureDriveFolders).toHaveBeenCalledWith("user-1", [
      { driveFolderId: folderId, name: "New", recursive: true },
    ]);
    expect(repo.replaceFolders).toHaveBeenCalledWith("album-1", ["local-0"]);
    expect(repo.setStatus).toHaveBeenCalledWith("album-1", "indexing");
    expect(enqueue).toHaveBeenCalledWith("album-1", { mode: "full" });
  });

  it("marks the album failed when a folder change cannot be queued", async () => {
    const repo = repository();
    const service = makeService(repo, {
      enqueue: async () => {
        throw new Error("queue down");
      },
    });

    await expect(
      service.update("user-1", "album-1", {
        folders: [{ driveFolderId: folderId, name: "New" }],
      }),
    ).rejects.toThrow("queue down");

    expect(repo.setStatus).toHaveBeenCalledWith("album-1", "failed");
  });

  it("removes an album only for its owner", async () => {
    const repo = repository();
    const service = makeService(repo);

    expect(await service.remove("user-1", "album-1")).toBe(true);
    expect(repo.deleteAlbum).toHaveBeenCalledWith("album-1");

    expect(await service.remove("user-2", "album-1")).toBe(false);
    expect(repo.deleteAlbum).toHaveBeenCalledTimes(1);
  });

  it("returns the album photos for the owner only", async () => {
    const photos = [
      {
        id: "photo-1",
        name: "TOP2.jpg",
        width: 6000,
        height: 4000,
        bytes: 100,
        orientation: "landscape" as const,
        thumbStatus: "ready" as const,
        takenAt: null,
        sortIndex: 0,
      },
    ];
    const repo = repository({ listAlbumPhotos: vi.fn(async () => photos) });
    const service = makeService(repo);

    expect(await service.photos("user-1", "album-1")).toEqual({ photos });
    expect(
      await makeService(
        repository({
          getAlbum: vi.fn(async () => ({
            id: "album-1",
            title: "Album",
            slug: "album",
            ownerUserId: "user-2",
            status: "ready" as const,
          })),
        }),
      ).photos("user-1", "album-1"),
    ).toBeNull();
  });

  it("rewrites the order only when the ids match the album", async () => {
    const photos = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "a.jpg",
        width: 10,
        height: 10,
        bytes: 1,
        orientation: "landscape" as const,
        thumbStatus: "ready" as const,
        takenAt: null,
        sortIndex: 0,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "b.jpg",
        width: 10,
        height: 10,
        bytes: 1,
        orientation: "landscape" as const,
        thumbStatus: "ready" as const,
        takenAt: null,
        sortIndex: 1,
      },
    ];
    const setPhotoOrder = vi.fn(async () => {});
    const service = makeService(
      repository({ listAlbumPhotos: vi.fn(async () => photos), setPhotoOrder }),
    );

    const order = [
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111",
    ];
    await service.reorderPhotos("user-1", "album-1", order);
    expect(setPhotoOrder).toHaveBeenCalledWith("album-1", order);

    await expect(
      service.reorderPhotos("user-1", "album-1", [order[0]]),
    ).rejects.toBeInstanceOf(AlbumValidationError);
    await expect(
      service.reorderPhotos("user-1", "album-1", [order[0], order[0]]),
    ).rejects.toBeInstanceOf(AlbumValidationError);
    await expect(
      service.reorderPhotos("user-1", "album-1", [
        order[0],
        "33333333-3333-4333-8333-333333333333",
      ]),
    ).rejects.toBeInstanceOf(AlbumValidationError);
  });

  it("validates the cover photo and clears it with null", async () => {
    const repo = repository();
    const service = makeService(repo);

    await service.setCover("user-1", "album-1", "photo-1");
    expect(repo.findAlbumPhoto).toHaveBeenCalledWith("album-1", "photo-1");
    expect(repo.setCoverPhoto).toHaveBeenCalledWith("album-1", "photo-1");

    await service.setCover("user-1", "album-1", null);
    expect(repo.setCoverPhoto).toHaveBeenCalledWith("album-1", null);

    const foreignPhoto = repository({ findAlbumPhoto: vi.fn(async () => null) });
    await expect(
      makeService(foreignPhoto).setCover("user-1", "album-1", "photo-2"),
    ).rejects.toBeInstanceOf(AlbumValidationError);
    expect(foreignPhoto.setCoverPhoto).not.toHaveBeenCalled();

    expect(await service.setCover("user-2", "album-1", null)).toBeNull();
  });

  it("handles more than two folders", async () => {
    const repo = repository();
    const service = makeService(repo);

    await service.create("user-1", {
      title: "Album",
      folders: [
        { driveFolderId: folderId, name: "A" },
        { driveFolderId: otherFolderId, name: "B" },
        { driveFolderId: "1ZzYyXxWwVvUuTtSsRrQqPpOo", name: "C" },
      ],
    });

    expect(vi.mocked(repo.ensureDriveFolders).mock.calls[0][1]).toHaveLength(3);
  });
});
