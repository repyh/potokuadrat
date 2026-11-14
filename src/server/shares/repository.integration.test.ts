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
      albumTitle: "Album",
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
});
