import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Exercises the admin route handlers: the auth boundary, request validation, status
 * codes, and the response envelope. `getAdminSession` reads `next/headers`, so the
 * module is mocked with a mutable Headers the test controls — the same request-scoped
 * contract the Next runtime provides.
 *
 * Drive is not reachable from CI, so the folder-discovery route is covered only for its
 * unauthenticated branch. Everything that needs a live service account belongs to a
 * manual check, not this suite.
 */
const databaseUrl = process.env.TEST_DATABASE_URL;

const headerState: { headers: Headers } = { headers: new Headers() };

vi.mock("next/headers", () => ({
  headers: async () => headerState.headers,
}));

type DbInstance = ReturnType<(typeof import("@/server/db/client"))["getDb"]>;
type AlbumsRoute = typeof import("@/app/api/admin/albums/route");
type AlbumRoute = typeof import("@/app/api/admin/albums/[id]/route");
type ReindexRoute = typeof import("@/app/api/admin/albums/[id]/reindex/route");
type FoldersRoute = typeof import("@/app/api/admin/drive/folders/route");

let db: DbInstance;
let closeDb: () => Promise<void>;
let albumsRoute: AlbumsRoute;
let albumRoute: AlbumRoute;
let reindexRoute: ReindexRoute;
let foldersRoute: FoldersRoute;

let adminCookie = "";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "admin password 123";
const ALBUM_ID = "00000000-0000-4000-8000-000000000001";
const MISSING_ALBUM = "00000000-0000-4000-8000-0000000000ff";
const PHOTO_ID = "10000000-0000-4000-8000-000000000001";

function context<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

function asAdmin(): void {
  headerState.headers = new Headers({ cookie: adminCookie });
}

function asAnonymous(): void {
  headerState.headers = new Headers();
}

function jsonRequest(url: string, body: unknown, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function resetDatabase(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE organizations, users, sessions, accounts, verifications RESTART IDENTITY CASCADE`,
  );
}

/**
 * Better Auth signs its session cookie, so a hand-written token is rejected. The seed
 * therefore goes through the real sign-up and sign-in API and keeps the cookie the
 * library issues — that is what getSession() has to accept.
 *
 * Only the first sign-up is allowed: the auth hook refuses every later one so a public
 * instance cannot grow accounts. The member is therefore inserted directly, which is
 * also the only way to reach the "authenticated but not admin" branch.
 */
async function seed(): Promise<void> {
  await db.execute(sql`INSERT INTO organizations (name, strip_metadata) VALUES ('Org', true)`);

  const { getAuth } = await import("@/server/auth/auth");
  const auth = getAuth();

  const admin = await auth.api.signUpEmail({
    body: { name: "Admin", email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: new Headers({ origin: "http://localhost:3000" }),
  });
  await db.execute(sql`UPDATE users SET role = 'admin' WHERE id = ${admin.user.id}`);

  const adminSignIn = await auth.api.signInEmail({
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: new Headers({ origin: "http://localhost:3000" }),
    asResponse: true,
  });
  adminCookie = (adminSignIn.headers.getSetCookie?.()[0] ?? "").split(";")[0];

  await db.execute(
    sql`INSERT INTO albums (id, slug, title, status, owner_user_id) VALUES (${ALBUM_ID}, 'album-1', 'Album One', 'ready', ${admin.user.id})`,
  );
  await db.execute(sql`
    INSERT INTO photos (id, album_id, drive_file_id, name, width, height, sort_index)
    VALUES (${PHOTO_ID}, ${ALBUM_ID}, 'drive-1', 'A.jpg', 6000, 4000, 0)
  `);
}

describe.skipIf(!databaseUrl)("admin route handlers", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET = "test-secret-".padEnd(48, "x");
    process.env.BETTER_AUTH_URL = "http://localhost:3000";

    const dbModule = await import("@/server/db/client");
    db = dbModule.getDb();
    closeDb = dbModule.closeDb;

    albumsRoute = await import("@/app/api/admin/albums/route");
    albumRoute = await import("@/app/api/admin/albums/[id]/route");
    reindexRoute = await import("@/app/api/admin/albums/[id]/reindex/route");
    foldersRoute = await import("@/app/api/admin/drive/folders/route");
  });

  beforeEach(async () => {
    await resetDatabase();
    await seed();
    asAnonymous();
  });

  afterAll(async () => {
    await resetDatabase();
    await closeDb();
  });

  describe("authentication boundary", () => {
    it("returns 401 without a session on every admin route", async () => {
      asAnonymous();

      const list = await albumsRoute.GET();
      expect(list.status).toBe(401);
      await expect(list.json()).resolves.toEqual({ error: "Unauthorized." });

      const detail = await albumRoute.GET(
        new Request(`http://localhost:3000/api/admin/albums/${ALBUM_ID}`),
        context({ id: ALBUM_ID }),
      );
      expect(detail.status).toBe(401);

      const create = await albumsRoute.POST(
        jsonRequest("http://localhost:3000/api/admin/albums", { title: "New", folders: [] }),
      );
      expect(create.status).toBe(401);

      const reindex = await reindexRoute.POST(
        new Request(`http://localhost:3000/api/admin/albums/${ALBUM_ID}/reindex`, {
          method: "POST",
        }),
        context({ id: ALBUM_ID }),
      );
      expect(reindex.status).toBe(401);

      const folders = await foldersRoute.GET();
      expect(folders.status).toBe(401);
    });

    it("returns 401 for a member, not 403", async () => {
      // getAdminSession() collapses "no session" and "not an admin" into null, so the
      // route answers 401 either way. Asserted so a future change to 403 is deliberate.
      //
      // The role is flipped on the signed-in admin instead of minting a second session:
      // Better Auth signs its cookie, so the session that already exists is the only
      // one this test can hold, and the branch under test is the role check.
      asAdmin();
      await db.execute(sql`UPDATE users SET role = 'member' WHERE email = ${ADMIN_EMAIL}`);

      const response = await albumsRoute.GET();
      expect(response.status).toBe(401);

      await db.execute(sql`UPDATE users SET role = 'admin' WHERE email = ${ADMIN_EMAIL}`);
    });
  });

  describe("GET /api/admin/albums", () => {
    it("lists the admin's albums with their photo counts", async () => {
      asAdmin();

      const response = await albumsRoute.GET();
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.albums).toHaveLength(1);
      expect(body.albums[0]).toMatchObject({
        id: ALBUM_ID,
        slug: "album-1",
        title: "Album One",
        status: "ready",
        photoCount: 1,
      });
    });
  });

  describe("POST /api/admin/albums", () => {
    it("rejects a body that is not JSON", async () => {
      asAdmin();

      const response = await albumsRoute.POST(
        new Request("http://localhost:3000/api/admin/albums", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{not json",
        }),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        ok: false,
        error: "Invalid JSON body.",
      });
    });

    it("rejects a payload that fails validation", async () => {
      asAdmin();

      const noFolders = await albumsRoute.POST(
        jsonRequest("http://localhost:3000/api/admin/albums", { title: "New Album", folders: [] }),
      );
      expect(noFolders.status).toBe(400);
      expect((await noFolders.json()).error).toMatch(/at least one drive folder/i);

      const shortTitle = await albumsRoute.POST(
        jsonRequest("http://localhost:3000/api/admin/albums", {
          title: "A",
          folders: [{ driveFolderId: "1XtiPMDZ5FWFJv8IqWNjnZDqwJD9LmURQ" }],
        }),
      );
      expect(shortTitle.status).toBe(400);
      expect((await shortTitle.json()).error).toMatch(/album title/i);
    });

    it("rejects a Drive folder input that is not a folder id or link", async () => {
      asAdmin();

      const response = await albumsRoute.POST(
        jsonRequest("http://localhost:3000/api/admin/albums", {
          title: "New Album",
          folders: [{ driveFolderId: "not a folder at all" }],
        }),
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatch(/valid drive folder/i);
    });
  });

  describe("GET /api/admin/albums/[id]", () => {
    it("returns the album detail", async () => {
      asAdmin();

      const response = await albumRoute.GET(
        new Request(`http://localhost:3000/api/admin/albums/${ALBUM_ID}`),
        context({ id: ALBUM_ID }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.album.album).toMatchObject({ id: ALBUM_ID, title: "Album One" });
      expect(body.album.progress).toBeDefined();
    });

    it("returns 404 for an unknown album", async () => {
      asAdmin();

      const response = await albumRoute.GET(
        new Request(`http://localhost:3000/api/admin/albums/${MISSING_ALBUM}`),
        context({ id: MISSING_ALBUM }),
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "Album not found." });
    });
  });

  describe("POST /api/admin/albums/[id]/reindex", () => {
    it("rejects an unsupported mode before touching the album", async () => {
      asAdmin();

      const response = await reindexRoute.POST(
        new Request(
          `http://localhost:3000/api/admin/albums/${ALBUM_ID}/reindex?mode=partial`,
          { method: "POST" },
        ),
        context({ id: ALBUM_ID }),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "Unsupported re-index mode." });
    });

    it("returns 404 for an unknown album", async () => {
      asAdmin();

      const response = await reindexRoute.POST(
        new Request(`http://localhost:3000/api/admin/albums/${MISSING_ALBUM}/reindex`, {
          method: "POST",
        }),
        context({ id: MISSING_ALBUM }),
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "Album not found." });
    });
  });

  describe("GET /api/admin/drive/folders", () => {
    it("answers 401 before it ever reaches Drive", async () => {
      // The route calls getDriveRuntime() only after the session check, so an anonymous
      // caller never triggers a service-account load. That ordering is the assertion.
      asAnonymous();

      const response = await foldersRoute.GET();
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
    });
  });
});
