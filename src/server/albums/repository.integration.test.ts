import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  albums,
  clientSessions,
  favorites,
  photos,
  shares,
} from "@/server/db/schema";

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


  it("reports share counts, ready photos, and organizer stats", async () => {
    const [album] = await repository.listAlbums("user-1");

    await db
      .update(photos)
      .set({ thumbStatus: "ready" })
      .where(eq(photos.albumId, album.id));

    await db.insert(shares).values([
      {
        albumId: album.id,
        slug: "stats-public",
        mode: "public",
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        albumId: album.id,
        slug: "stats-forever",
        mode: "public",
      },
    ]);

    const [listed] = await repository.listAlbums("user-1");
    expect(listed).toMatchObject({
      shareCount: 2,
      readyPhotoCount: 2,
      photoCount: 2,
    });
    expect(listed.updatedAt).toBe(
      (await repository.getAlbumDetail(album.id))?.album.updatedAt,
    );

    const stats = await repository.getOrganizerStats("user-1");
    expect(stats).toMatchObject({
      albumCount: 1,
      indexingAlbumCount: 0,
      shareCount: 2,
      expiringShareCount: 1,
      indexedPhotoCount: 2,
      failedPhotoCount: 0,
      lastIndexedAt: "2026-11-15T10:00:00.000Z",
    });
  });

  it("updates the title, branding, and folder set", async () => {
    const [album] = await repository.listAlbums("user-1");

    await repository.updateAlbum(album.id, {
      title: "Renamed Album",
      branding: { accent: "#ff0066" },
    });

    const [stored] = await db
      .select({ title: albums.title, branding: albums.branding })
      .from(albums)
      .where(eq(albums.id, album.id));

    expect(stored.title).toBe("Renamed Album");
    expect(stored.branding).toEqual({ accent: "#ff0066" });

    const [replacement] = await repository.ensureDriveFolders("user-1", [
      { driveFolderId: "drive-folder-2", name: "Replacement", recursive: false },
    ]);
    await repository.replaceFolders(album.id, [replacement.id]);

    const folders = await repository.getAlbumFolders(album.id);
    expect(folders).toHaveLength(1);
    expect(folders[0]).toMatchObject({ driveFolderId: "drive-folder-2", recursive: false });
  });

  it("sets and clears a cover only from the album's own photos", async () => {
    const [album] = await repository.listAlbums("user-1");
    const albumPhotos = await db
      .select({ id: photos.id })
      .from(photos)
      .where(eq(photos.albumId, album.id))
      .limit(1);

    expect(await repository.findAlbumPhoto(album.id, albumPhotos[0].id)).toEqual({
      id: albumPhotos[0].id,
    });
    expect(
      await repository.findAlbumPhoto(album.id, "10000000-0000-4000-8000-000000000099"),
    ).toBeNull();

    await repository.setCoverPhoto(album.id, albumPhotos[0].id);
    expect((await repository.getAlbumDetail(album.id))?.album.coverPhotoId).toBe(
      albumPhotos[0].id,
    );

    await repository.setCoverPhoto(album.id, null);
    expect((await repository.getAlbumDetail(album.id))?.album.coverPhotoId).toBeNull();
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
  it("lists photos in manual order and rewrites the order", async () => {
    const [album] = await repository.listAlbums("user-1");
    const before = await repository.listAlbumPhotos(album.id);

    expect(before.length).toBeGreaterThan(1);
    expect(before.map((photo) => photo.sortIndex)).toEqual(
      before.map((_, index) => index),
    );

    const reversed = before.map((photo) => photo.id).reverse();
    await repository.setPhotoOrder(album.id, reversed);

    const after = await repository.listAlbumPhotos(album.id);
    expect(after.map((photo) => photo.id)).toEqual(reversed);
    expect(after.map((photo) => photo.sortIndex)).toEqual(
      reversed.map((_, index) => index),
    );

    await repository.markMissingPhotos(album.id, [reversed[0]]);
    const visible = await repository.listAlbumPhotos(album.id);
    expect(visible.map((photo) => photo.id)).not.toContain(reversed[0]);
  });

  it("cascades photos, shares, sessions, and favorites on delete", async () => {
    const [album] = await repository.listAlbums("user-1");
    const [photo] = await db
      .select({ id: photos.id })
      .from(photos)
      .where(eq(photos.albumId, album.id))
      .limit(1);

    await db.insert(shares).values({
      albumId: album.id,
      slug: "lifecycle-share",
      mode: "magic_link",
    });
    const [share] = await db
      .select({ id: shares.id })
      .from(shares)
      .where(eq(shares.slug, "lifecycle-share"));

    await db.insert(clientSessions).values({
      id: "40000000-0000-4000-8000-000000000001",
      shareId: share.id,
      email: "guest@example.com",
      expiresAt: new Date(Date.now() + 60_000),
    });
    await db.insert(favorites).values({
      clientSessionId: "40000000-0000-4000-8000-000000000001",
      photoId: photo.id,
    });

    await repository.deleteAlbum(album.id);

    expect(await repository.getAlbumDetail(album.id)).toBeNull();
    const [photoCount] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(photos)
      .where(eq(photos.albumId, album.id));
    const [shareCount] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(shares)
      .where(eq(shares.albumId, album.id));
    const [sessionCount] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(clientSessions)
      .where(eq(clientSessions.shareId, share.id));
    const [favoriteCount] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(favorites)
      .where(eq(favorites.clientSessionId, "40000000-0000-4000-8000-000000000001"));

    expect(photoCount.count).toBe(0);
    expect(shareCount.count).toBe(0);
    expect(sessionCount.count).toBe(0);
    expect(favoriteCount.count).toBe(0);
  });
});
