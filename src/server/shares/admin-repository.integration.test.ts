import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { clientSessions, favorites, viewEvents } from "@/server/db/schema";

const databaseUrl = process.env.TEST_DATABASE_URL;

const ALBUM_ID = "00000000-0000-4000-8000-000000000001";
const PHOTO_1 = "10000000-0000-4000-8000-000000000001";
const PHOTO_2 = "10000000-0000-4000-8000-000000000002";

type DbInstance = ReturnType<(typeof import("@/server/db/client"))["getDb"]>;
type Repository = ReturnType<
  (typeof import("./admin-repository"))["createDrizzleShareAdminRepository"]
>;

let db: DbInstance;
let repository: Repository;
let closeDb: () => Promise<void>;

async function resetDatabase(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE organizations, users, sessions, accounts, verifications RESTART IDENTITY CASCADE`,
  );
}

describe.skipIf(!databaseUrl)("share admin repository", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    const dbModule = await import("@/server/db/client");
    const repositoryModule = await import("./admin-repository");

    db = dbModule.getDb();
    closeDb = dbModule.closeDb;
    repository = repositoryModule.createDrizzleShareAdminRepository(db);

    await resetDatabase();

    await db.execute(sql`INSERT INTO organizations (name) VALUES ('Org')`);
    await db.execute(
      sql`INSERT INTO users (id, name, email, role) VALUES ('user-1', 'Owner', 'owner@example.com', 'admin')`,
    );
    await db.execute(
      sql`INSERT INTO users (id, name, email, role) VALUES ('user-2', 'Other', 'other@example.com', 'admin')`,
    );
    await db.execute(
      sql`INSERT INTO albums (id, slug, title, status, owner_user_id) VALUES (${ALBUM_ID}, 'album-1', 'Album', 'ready', 'user-1')`,
    );
    await db.execute(sql`
      INSERT INTO photos (id, album_id, drive_file_id, name, width, height)
      VALUES
        (${PHOTO_1}, ${ALBUM_ID}, 'drive-1', 'TOP2.jpg', 6000, 4000),
        (${PHOTO_2}, ${ALBUM_ID}, 'drive-2', 'TOP10.jpg', 4000, 6000)
    `);
  });

  afterAll(async () => {
    await resetDatabase();
    await closeDb();
  });

  async function createShare(overrides: { photoIds?: string[] | null } = {}) {
    return repository.createShare({
      albumId: ALBUM_ID,
      slug: `share-${Math.random().toString(36).slice(2, 10)}`,
      mode: "public",
      passwordHash: null,
      expiresAt: null,
      allowDownload: true,
      allowedQualities: ["original", "web"],
      stripMetadata: null,
      branding: null,
      photoIds: overrides.photoIds ?? null,
    });
  }

  it("creates a share with a frozen subset and reads it back", async () => {
    const shareId = await createShare({ photoIds: [PHOTO_2, PHOTO_1] });

    const detail = await repository.findDetail(shareId, "user-1");

    expect(detail).toMatchObject({
      id: shareId,
      albumId: ALBUM_ID,
      mode: "public",
      hasPassword: false,
      photoCount: 2,
      recipientCount: 0,
    });
    expect(detail?.photoIds?.slice().sort()).toEqual([PHOTO_1, PHOTO_2]);

    expect(await repository.findDetail(shareId, "user-2")).toBeNull();
  });

  it("keeps a whole-album share on null photos", async () => {
    const shareId = await createShare();

    const detail = await repository.findDetail(shareId, "user-1");

    expect(detail?.photoIds).toBeNull();
    expect(detail?.photoCount).toBe(0);
  });

  it("counts views and reports the latest visit", async () => {
    const shareId = await createShare();
    const earlier = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const latest = new Date(Date.now() - 30 * 60 * 1000);

    await db.insert(viewEvents).values([
      { shareId, visitorHash: "visitor-a", createdAt: earlier },
      { shareId, visitorHash: "visitor-b", createdAt: latest },
    ]);

    const owned = (await repository.listByAlbum(ALBUM_ID, "user-1")).find(
      (share) => share.id === shareId,
    );

    expect(owned).toMatchObject({ visits: 2 });
    expect(owned?.lastVisitAt && new Date(owned.lastVisitAt).toISOString()).toBe(
      latest.toISOString(),
    );
  });

  it("lists shares only for the album owner", async () => {
    const shareId = await createShare();

    const owned = await repository.listByAlbum(ALBUM_ID, "user-1");
    expect(owned.map((row) => row.id)).toContain(shareId);

    expect(await repository.listByAlbum(ALBUM_ID, "user-2")).toEqual([]);
    expect(await repository.albumOwnedBy(ALBUM_ID, "user-1")).toBe(true);
    expect(await repository.albumOwnedBy(ALBUM_ID, "user-2")).toBe(false);
  });

  it("updates policy and replaces the subset", async () => {
    const shareId = await createShare({ photoIds: [PHOTO_1] });

    await repository.updateShare(shareId, {
      allowDownload: false,
      allowedQualities: ["web"],
      expiresAt: new Date("2027-01-01T00:00:00Z"),
      photoIds: [PHOTO_2],
    });

    const detail = await repository.findDetail(shareId, "user-1");
    expect(detail).toMatchObject({
      allowDownload: false,
      allowedQualities: ["web"],
      photoCount: 1,
    });
    expect(detail?.expiresAt?.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(detail?.photoIds).toEqual([PHOTO_2]);

    await repository.updateShare(shareId, { photoIds: null });
    expect((await repository.findDetail(shareId, "user-1"))?.photoIds).toBeNull();
  });

  it("upserts recipients and rotates their token", async () => {
    const shareId = await createShare();

    const first = await repository.upsertRecipient(
      shareId,
      "guest@example.com",
      "hash-1",
      new Date(Date.now() + 60_000),
    );
    const second = await repository.upsertRecipient(
      shareId,
      "guest@example.com",
      "hash-2",
      new Date(Date.now() + 120_000),
    );

    expect(second.id).toBe(first.id);
    expect(await repository.listRecipients(shareId)).toHaveLength(1);

    const rotated = await repository.replaceRecipientToken(
      shareId,
      first.id,
      "hash-3",
      new Date(Date.now() + 180_000),
    );
    expect(rotated?.id).toBe(first.id);

    expect(await repository.replaceRecipientToken(shareId, "30000000-0000-4000-8000-000000000099", "hash-4", new Date())).toBeNull();

    await repository.removeRecipient(shareId, first.id);
    expect(await repository.listRecipients(shareId)).toEqual([]);
  });

  it("cascades sessions and favorites when a share is deleted", async () => {
    const shareId = await createShare();

    await db.execute(sql`
      INSERT INTO client_sessions (id, share_id, email, expires_at)
      VALUES ('40000000-0000-4000-8000-000000000001', ${shareId}, 'guest@example.com', now() + interval '1 day')
    `);
    await db.execute(sql`
      INSERT INTO favorites (client_session_id, photo_id)
      VALUES ('40000000-0000-4000-8000-000000000001', ${PHOTO_1})
    `);

    await repository.deleteShare(shareId);

    const [sessions] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(clientSessions)
      .where(eq(clientSessions.shareId, shareId));
    const [favoriteRows] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(favorites)
      .where(eq(favorites.clientSessionId, "40000000-0000-4000-8000-000000000001"));

    expect(sessions.count).toBe(0);
    expect(favoriteRows.count).toBe(0);
    expect(await repository.findDetail(shareId, "user-1")).toBeNull();
  });
});
