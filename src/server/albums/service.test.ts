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
      })),
    ),
    createAlbum: vi.fn(async (input) => ({
      id: "album-1",
      slug: input.slug,
      title: input.title,
      status: "indexing" as const,
      coverPhotoId: null,
      photoCount: 0,
      createdAt: new Date().toISOString(),
    })),
    listAlbums: vi.fn(async () => []),
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
    upsertPhotos: vi.fn(async () => {}),
    markMissingPhotos: vi.fn(async () => 0),
    countProgress: vi.fn(async () => ({
      total: 0,
      ready: 0,
      pending: 0,
      failed: 0,
      missing: 0,
    })),
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
    expect(enqueue).toHaveBeenCalledWith("album-1");
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

    expect(await service.reindex("album-1")).toBe(true);
    expect(repo.setStatus).toHaveBeenCalledWith("album-1", "indexing");
    expect(enqueue).toHaveBeenCalledWith("album-1");

    const missing = makeService(repository({ getAlbum: vi.fn(async () => null) }));
    expect(await missing.reindex("nope")).toBe(false);
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
