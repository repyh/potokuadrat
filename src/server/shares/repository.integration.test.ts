import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.TEST_DATABASE_URL;

const ALBUM_ID = "00000000-0000-4000-8000-000000000001";
const PHOTO_1 = "10000000-0000-4000-8000-000000000001";
const PHOTO_2 = "10000000-0000-4000-8000-000000000002";
const PHOTO_MISSING = "10000000-0000-4000-8000-000000000003";
const PHOTO_OTHER = "10000000-0000-4000-8000-000000000004";
const ALBUM_2 = "00000000-0000-4000-8000-000000000002";
const SHARE_WHOLE = "20000000-0000-4000-8000-000000000001";
const SHARE_SUBSET = "20000000-0000-4000-8000-000000000002";
const SHARE_EXPIRED = "20000000-0000-4000-8000-000000000003";

type DbInstance = ReturnType<(typeof import("@/server/db/client"))["getDb"]>;
type Repository = ReturnType<(typeof import("./repository"))["createDrizzleShareRepository"]>;

let db: DbInstance;
let repository: Repository;
let closeDb: () => Promise<void>;

async function resetDatabase(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE organizations, users, sessions, accounts, verifications RESTART IDENTITY CASCADE`,
  );
}

describe.skipIf(!databaseUrl)("share repository", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    const dbModule = await import("@/server/db/client");
    const repositoryModule = await import("./repository");

    db = dbModule.getDb();
    closeDb = dbModule.closeDb;
    repository = repositoryModule.createDrizzleShareRepository(db);

    await resetDatabase();

    await db.execute(sql`INSERT INTO organizations (name, strip_metadata) VALUES ('Org', true)`);
    await db.execute(
      sql`INSERT INTO users (id, name, email, role) VALUES ('user-1', 'Owner', 'owner@example.com', 'admin')`,
    );
    await db.execute(
      sql`INSERT INTO albums (id, slug, title, status, owner_user_id) VALUES (${ALBUM_ID}, 'album-1', 'Album', 'ready', 'user-1')`,
    );
    await db.execute(sql`
      INSERT INTO photos (id, album_id, drive_file_id, name, width, height)
      VALUES
        (${PHOTO_1}, ${ALBUM_ID}, 'drive-1', 'TOP2.jpg', 6000, 4000),
        (${PHOTO_2}, ${ALBUM_ID}, 'drive-2', 'TOP10.jpg', 4000, 6000),
        (${PHOTO_MISSING}, ${ALBUM_ID}, 'drive-3', 'GONE.jpg', 6000, 4000)
    `);
    await db.execute(sql`UPDATE photos SET missing_at = now() WHERE id = ${PHOTO_MISSING}`);
    await db.execute(sql`
      INSERT INTO shares (id, album_id, slug, mode)
      VALUES
        (${SHARE_WHOLE}, ${ALBUM_ID}, 'whole', 'public'),
        (${SHARE_SUBSET}, ${ALBUM_ID}, 'subset', 'public'),
        (${SHARE_EXPIRED}, ${ALBUM_ID}, 'expired', 'public')
    `);
    await db.execute(sql`UPDATE shares SET expires_at = now() - interval '1 day' WHERE id = ${SHARE_EXPIRED}`);
    await db.execute(sql`INSERT INTO share_photos (share_id, photo_id) VALUES (${SHARE_SUBSET}, ${PHOTO_1})`);
    await db.execute(
      sql`INSERT INTO albums (id, slug, title, status, owner_user_id) VALUES (${ALBUM_2}, 'album-2', 'Other', 'ready', 'user-1')`,
    );
    await db.execute(sql`
      INSERT INTO photos (id, album_id, drive_file_id, name)
      VALUES (${PHOTO_OTHER}, ${ALBUM_2}, 'drive-other', 'OTHER.jpg')
    `);
  });

  afterAll(async () => {
    await resetDatabase();
    await closeDb();
  });

  it("finds a share with the organization metadata policy", async () => {
    const share = await repository.findBySlug("whole");

    expect(share).toMatchObject({
      id: SHARE_WHOLE,
      albumId: ALBUM_ID,
      albumSlug: "album-1",
      albumTitle: "Album",
      photographerName: "Owner",
      photoCount: 2,
      organizationStripMetadata: true,
      allowDownload: true,
    });
  });

  it("returns every existing photo for a whole-album share", async () => {
    const share = await repository.findBySlug("whole");

    expect(await repository.getSharePhoto(share!, PHOTO_1)).toMatchObject({
      name: "TOP2.jpg",
      driveFileId: "drive-1",
    });
    expect(await repository.getSharePhoto(share!, PHOTO_2)).not.toBeNull();
    expect(await repository.getSharePhoto(share!, PHOTO_MISSING)).toBeNull();
  });

  it("respects a frozen subset", async () => {
    const share = await repository.findBySlug("subset");

    expect(await repository.getSharePhoto(share!, PHOTO_1)).not.toBeNull();
    expect(await repository.getSharePhoto(share!, PHOTO_2)).toBeNull();
  });

  it("does not leak photos from another album", async () => {
    const share = await repository.findBySlug("whole");

    expect(await repository.getSharePhoto(share!, PHOTO_OTHER)).toBeNull();
  });

  it("consumes a magic-link token once and creates a live client session", async () => {
    await db.execute(sql`
      INSERT INTO share_recipients (share_id, email, token_hash)
      VALUES (${SHARE_WHOLE}, 'guest@example.com', 'token-hash-1')
    `);

    const recipient = await repository.consumeRecipient(SHARE_WHOLE, "token-hash-1");
    expect(recipient).toMatchObject({ email: "guest@example.com" });

    expect(await repository.consumeRecipient(SHARE_WHOLE, "token-hash-1")).toBeNull();

    const session = await repository.createClientSession(
      SHARE_WHOLE,
      recipient!.email,
      new Date(Date.now() + 60 * 60 * 1000),
    );

    expect(await repository.findClientSession(SHARE_WHOLE, session.id)).toMatchObject({
      email: "guest@example.com",
    });
    expect(await repository.findClientSession("20000000-0000-4000-8000-000000000099", session.id)).toBeNull();
  });


  it("pages the gallery and hides tombstoned and foreign photos", async () => {
    const share = await repository.findBySlug("whole");

    const first = await repository.listSharePhotos(share!, {
      filter: "all",
      clientSessionId: null,
      cursor: null,
      limit: 1,
    });

    expect(first.total).toBe(2);
    expect(first.hasMore).toBe(true);
    expect(first.rows.map((row) => row.name)).toEqual(["TOP2.jpg"]);

    const second = await repository.listSharePhotos(share!, {
      filter: "all",
      clientSessionId: null,
      cursor: { sortIndex: first.rows[0].sortIndex, id: first.rows[0].id },
      limit: 50,
    });

    expect(second.rows.map((row) => row.name)).toEqual(["TOP10.jpg"]);
    expect(second.hasMore).toBe(false);
    expect(second.rows.map((row) => row.id)).not.toContain(PHOTO_MISSING);
    expect(second.rows.map((row) => row.id)).not.toContain(PHOTO_OTHER);
  });

  it("applies orientation filters and the frozen subset", async () => {
    const whole = await repository.findBySlug("whole");
    const subset = await repository.findBySlug("subset");
    const options = { clientSessionId: null, cursor: null, limit: 50 };

    const landscape = await repository.listSharePhotos(whole!, {
      ...options,
      filter: "landscape",
    });
    const portrait = await repository.listSharePhotos(whole!, { ...options, filter: "portrait" });
    const frozen = await repository.listSharePhotos(subset!, { ...options, filter: "all" });

    expect(landscape.rows.map((row) => row.name)).toEqual(["TOP2.jpg"]);
    expect(portrait.rows.map((row) => row.name)).toEqual(["TOP10.jpg"]);
    expect(frozen.rows.map((row) => row.name)).toEqual(["TOP2.jpg"]);
    expect(frozen.total).toBe(1);
  });

  it("stores favorites per session and filters the gallery", async () => {
    const share = await repository.findBySlug("whole");
    const session = await repository.findOrCreateClientSession(
      SHARE_WHOLE,
      "favorites@example.com",
      new Date(Date.now() + 60 * 60 * 1000),
    );

    expect(await repository.addFavorite(share!, session.id, PHOTO_1)).toBe(true);
    expect(await repository.addFavorite(share!, session.id, PHOTO_OTHER)).toBe(false);
    expect(await repository.listFavoritePhotoIds(share!, session.id)).toEqual([PHOTO_1]);

    const page = await repository.listSharePhotos(share!, {
      filter: "favorites",
      clientSessionId: session.id,
      cursor: null,
      limit: 50,
    });

    expect(page.total).toBe(1);
    expect(page.rows.map((row) => row.name)).toEqual(["TOP2.jpg"]);

    await repository.removeFavorite(session.id, PHOTO_1);
    expect(await repository.listFavoritePhotoIds(share!, session.id)).toEqual([]);
  });

  it("reuses a live session for the same share and email", async () => {
    const first = await repository.findOrCreateClientSession(
      SHARE_WHOLE,
      "returning@example.com",
      new Date(Date.now() + 60 * 60 * 1000),
    );
    const second = await repository.findOrCreateClientSession(
      SHARE_WHOLE,
      "returning@example.com",
      new Date(Date.now() + 2 * 60 * 60 * 1000),
    );
    const elsewhere = await repository.findOrCreateClientSession(
      SHARE_SUBSET,
      "returning@example.com",
      new Date(Date.now() + 60 * 60 * 1000),
    );

    expect(second.id).toBe(first.id);
    expect(elsewhere.id).not.toBe(first.id);
  });


  it("lists archive photos in gallery order and respects the subset", async () => {
    const whole = await repository.findBySlug("whole");
    const subset = await repository.findBySlug("subset");

    const all = await repository.listShareArchivePhotos(whole!, {
      clientSessionId: null,
      photoIds: null,
      favoritesOnly: false,
    });
    const frozen = await repository.listShareArchivePhotos(subset!, {
      clientSessionId: null,
      photoIds: null,
      favoritesOnly: false,
    });

    expect(all.map((row) => row.name)).toEqual(["TOP2.jpg", "TOP10.jpg"]);
    expect(all.map((row) => row.driveFileId)).toEqual(["drive-1", "drive-2"]);
    expect(frozen.map((row) => row.name)).toEqual(["TOP2.jpg"]);
    expect(all.map((row) => row.id)).not.toContain(PHOTO_MISSING);
    expect(all.map((row) => row.id)).not.toContain(PHOTO_OTHER);
  });

  it("restricts an explicit archive selection to the share", async () => {
    const whole = await repository.findBySlug("whole");

    const photos = await repository.listShareArchivePhotos(whole!, {
      clientSessionId: null,
      photoIds: [PHOTO_1, PHOTO_OTHER],
      favoritesOnly: false,
    });

    expect(photos.map((row) => row.id)).toEqual([PHOTO_1]);
  });

  it("selects only the session's favorites for a favorites archive", async () => {
    const whole = await repository.findBySlug("whole");
    const session = await repository.findOrCreateClientSession(
      SHARE_WHOLE,
      "archive@example.com",
      new Date(Date.now() + 60 * 60 * 1000),
    );
    await repository.addFavorite(whole!, session.id, PHOTO_2);

    const favorites = await repository.listShareArchivePhotos(whole!, {
      clientSessionId: session.id,
      photoIds: null,
      favoritesOnly: true,
    });
    const everything = await repository.listShareArchivePhotos(whole!, {
      clientSessionId: session.id,
      photoIds: null,
      favoritesOnly: false,
    });

    expect(favorites.map((row) => row.id)).toEqual([PHOTO_2]);
    expect(everything).toHaveLength(2);

    await repository.removeFavorite(session.id, PHOTO_2);
  });

  it("refuses an expired magic-link token", async () => {
    await db.execute(sql`
      INSERT INTO share_recipients (share_id, email, token_hash, expires_at)
      VALUES (${SHARE_WHOLE}, 'late@example.com', 'expired-token-hash', now() - interval '1 minute')
    `);

    expect(await repository.consumeRecipient(SHARE_WHOLE, "expired-token-hash")).toBeNull();
  });

  it("does not return an expired client session", async () => {
    await db.execute(sql`
      INSERT INTO client_sessions (id, share_id, email, expires_at)
      VALUES (
        '30000000-0000-4000-8000-000000000001',
        ${SHARE_WHOLE},
        'guest@example.com',
        now() - interval '1 minute'
      )
    `);

    expect(
      await repository.findClientSession(SHARE_WHOLE, "30000000-0000-4000-8000-000000000001"),
    ).toBeNull();
  });
});
