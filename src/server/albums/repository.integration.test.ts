import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.TEST_DATABASE_URL;

type DbInstance = ReturnType<(typeof import("@/server/db/client"))["getDb"]>;
type Repository = ReturnType<(typeof import("./repository"))["createDrizzleAlbumRepository"]>;

let db: DbInstance;
let repository: Repository;
let closeDb: () => Promise<void>;

async function resetDatabase(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE organizations, users, sessions, accounts, verifications RESTART IDENTITY CASCADE`,
  );
}

describe.skipIf(!databaseUrl)("album repository", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    const dbModule = await import("@/server/db/client");
    const repositoryModule = await import("./repository");

    db = dbModule.getDb();
    closeDb = dbModule.closeDb;
    repository = repositoryModule.createDrizzleAlbumRepository(db);

    await resetDatabase();
    await db.execute(
      sql`INSERT INTO users (id, name, email, role) VALUES ('user-1', 'Owner', 'owner@example.com', 'admin')`,
    );
  });

  afterAll(async () => {
    await resetDatabase();
    await closeDb();
  });

  it("creates folders and an album, then reports progress", async () => {
    const folders = await repository.ensureDriveFolders("user-1", [
      { driveFolderId: "drive-folder-1", name: "Main folder", recursive: true },
    ]);
    expect(folders).toHaveLength(1);
    expect(folders[0].lastIndexedAt).toBeNull();

    const album = await repository.createAlbum({
      ownerUserId: "user-1",
      title: "Autumn Symposium",
      slug: "autumn-symposium-0001",
      folderIds: [folders[0].id],
    });
    expect(album.status).toBe("indexing");

    const list = await repository.listAlbums("user-1");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: "Autumn Symposium", photoCount: 0 });

    await repository.upsertPhotos(album.id, [
      {
        driveFileId: "drive-photo-1",
        name: "TOP2.jpg",
        mimeType: "image/jpeg",
        width: 6000,
        height: 4000,
        bytes: 100,
        takenAt: new Date("2026-10-30T08:00:00Z"),
        driveModifiedAt: new Date("2026-11-01T10:00:00Z"),
        sortIndex: 0,
      },
      {
        driveFileId: "drive-photo-2",
        name: "TOP10.jpg",
        mimeType: "image/jpeg",
        width: 4000,
        height: 6000,
        bytes: 200,
        takenAt: null,
        driveModifiedAt: null,
        sortIndex: 1,
      },
    ]);

    let progress = await repository.countProgress(album.id);
    expect(progress).toMatchObject({ total: 2, pending: 2, missing: 0 });

    const detail = await repository.getAlbumDetail(album.id);
    expect(detail?.folders).toHaveLength(1);
    expect(detail?.progress.total).toBe(2);

    const indexedAt = new Date("2026-11-15T10:00:00Z");
    await repository.markFoldersIndexed([folders[0].id], indexedAt);
    const refreshed = await repository.getAlbumFolders(album.id);
    expect(refreshed[0].lastIndexedAt?.toISOString()).toBe(indexedAt.toISOString());

    expect(await repository.markMissingPhotos(album.id, ["drive-photo-1"])).toBe(1);
    progress = await repository.countProgress(album.id);
    expect(progress).toMatchObject({ total: 2, missing: 1 });

    // A re-index that finds both files again clears the tombstones.
    await repository.upsertPhotos(album.id, [
      {
        driveFileId: "drive-photo-1",
        name: "TOP2.jpg",
        mimeType: "image/jpeg",
        width: 6000,
        height: 4000,
        bytes: 100,
        takenAt: null,
        driveModifiedAt: null,
        sortIndex: 0,
      },
      {
        driveFileId: "drive-photo-2",
        name: "TOP10.jpg",
        mimeType: "image/jpeg",
        width: 4000,
        height: 6000,
        bytes: 200,
        takenAt: null,
        driveModifiedAt: null,
        sortIndex: 1,
      },
    ]);
    expect(
      await repository.markMissingPhotos(album.id, ["drive-photo-1", "drive-photo-2"]),
    ).toBe(0);
    progress = await repository.countProgress(album.id);
    expect(progress.missing).toBe(0);

    await repository.setStatus(album.id, "ready");
    expect((await repository.getAlbumDetail(album.id))?.album.status).toBe("ready");
  });

  it("upserts by album and Drive file id instead of duplicating", async () => {
    const [album] = await repository.listAlbums("user-1");

    await repository.upsertPhotos(album.id, [
      {
        driveFileId: "drive-photo-1",
        name: "TOP2-renamed.jpg",
        mimeType: "image/jpeg",
        width: 6000,
        height: 4000,
        bytes: 100,
        takenAt: null,
        driveModifiedAt: null,
        sortIndex: 0,
      },
    ]);

    const progress = await repository.countProgress(album.id);
    expect(progress.total).toBe(2);
  });
});
