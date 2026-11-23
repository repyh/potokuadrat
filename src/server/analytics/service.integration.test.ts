import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.TEST_DATABASE_URL;

const ALBUM_ID = "00000000-0000-4000-8000-0000000000b1";
const SHARE_ID = "00000000-0000-4000-8000-0000000000b2";

type DbInstance = ReturnType<(typeof import("@/server/db/client"))["getDb"]>;
type Service = ReturnType<(typeof import("./service"))["createAnalyticsService"]>;
type AdminRepository = ReturnType<
  (typeof import("@/server/shares/admin-repository"))["createDrizzleShareAdminRepository"]
>;

let db: DbInstance;
let service: Service;
let adminRepository: AdminRepository;
let closeDb: () => Promise<void>;

const NOW = new Date("2026-11-23T08:30:00.000Z");

async function resetDatabase(): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE view_events RESTART IDENTITY CASCADE`);
  await db.execute(
    sql`TRUNCATE TABLE organizations, users, sessions, accounts, verifications RESTART IDENTITY CASCADE`,
  );
}

describe.skipIf(!databaseUrl)("analytics service", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    const dbModule = await import("@/server/db/client");
    const repositoryModule = await import("./repository");
    const serviceModule = await import("./service");
    const adminModule = await import("@/server/shares/admin-repository");

    db = dbModule.getDb();
    closeDb = dbModule.closeDb;
    adminRepository = adminModule.createDrizzleShareAdminRepository(db);
    service = serviceModule.createAnalyticsService({
      repository: repositoryModule.createDrizzleViewEventRepository(db),
      now: () => NOW,
    });

    await resetDatabase();
    await db.execute(
      sql`INSERT INTO users (id, name, email, role) VALUES ('user-1', 'Owner', 'owner@example.com', 'admin')`,
    );
    await db.execute(
      sql`INSERT INTO albums (id, slug, title, status, owner_user_id) VALUES (${ALBUM_ID}, 'view-album', 'View Album', 'ready', 'user-1')`,
    );
    await db.execute(
      sql`INSERT INTO shares (id, album_id, slug, mode) VALUES (${SHARE_ID}, ${ALBUM_ID}, 'view-share', 'public')`,
    );
  });

  afterAll(async () => {
    await resetDatabase();
    await closeDb();
  });

  it("records a hashed view and surfaces it through the admin share list", async () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });

    await service.recordGalleryView(SHARE_ID, headers);

    const result = await db.execute<{ visitor_hash: string }>(
      sql`SELECT visitor_hash FROM view_events WHERE share_id = ${SHARE_ID}`,
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].visitor_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.rows[0].visitor_hash).not.toContain("203.0.113.9");

    const shares = await adminRepository.listByAlbum(ALBUM_ID, "user-1");
    expect(shares[0].visits).toBe(1);
    expect(new Date(shares[0].lastVisitAt ?? "").toISOString()).toBe(NOW.toISOString());
  });

  it("counts every page view, not one per visitor per day", async () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9" });

    await service.recordGalleryView(SHARE_ID, headers);
    await service.recordGalleryView(SHARE_ID, headers);

    const shares = await adminRepository.listByAlbum(ALBUM_ID, "user-1");
    expect(shares[0].visits).toBe(3);
  });
});
