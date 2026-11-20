import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const SEED_MEDIA_DIR = "/tmp/potokuadrat-test-seed-media";
const SEED_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0xff, 0xd9,
]);

/**
 * Exercises the public share route handlers over HTTP semantics: status codes, body
 * shapes, cookies, and the access gate. The use cases underneath have their own unit
 * tests; what is proven here is the adapter layer — the part a client actually calls.
 */
const databaseUrl = process.env.TEST_DATABASE_URL;

type DbInstance = ReturnType<(typeof import("@/server/db/client"))["getDb"]>;
type ShareRoute = typeof import("@/app/api/share/[slug]/route");
type PhotosRoute = typeof import("@/app/api/share/[slug]/photos/route");
type AccessRoute = typeof import("@/app/api/share/[slug]/access/route");
type MagicRoute = typeof import("@/app/api/share/[slug]/magic/route");
type FavoritesRoute = typeof import("@/app/api/share/[slug]/favorites/route");
type FavoriteRoute = typeof import("@/app/api/share/[slug]/favorites/[photoId]/route");
type ArchiveRoute = typeof import("@/app/api/share/[slug]/download.zip/route");
type ThumbRoute = typeof import("@/app/s/[slug]/thumb/[photoId]/route");
type DownloadRoute = typeof import("@/app/s/[slug]/download/[photoId]/route");

let db: DbInstance;
let closeDb: () => Promise<void>;
let shareRoute: ShareRoute;
let photosRoute: PhotosRoute;
let accessRoute: AccessRoute;
let magicRoute: MagicRoute;
let favoritesRoute: FavoritesRoute;
let favoriteRoute: FavoriteRoute;
let archiveRoute: ArchiveRoute;
let thumbRoute: ThumbRoute;
let downloadRoute: DownloadRoute;

const ALBUM = "00000000-0000-4000-8000-000000000001";
const PHOTO_1 = "10000000-0000-4000-8000-000000000001";
const PHOTO_2 = "10000000-0000-4000-8000-000000000002";
const PHOTO_MISSING = "10000000-0000-4000-8000-000000000003";
const PHOTO_OTHER_ALBUM = "10000000-0000-4000-8000-000000000004";
const ALBUM_OTHER = "00000000-0000-4000-8000-000000000002";

const SHARE_PUBLIC = "20000000-0000-4000-8000-000000000001";
const SHARE_PASSWORD = "20000000-0000-4000-8000-000000000002";
const SHARE_MAGIC = "20000000-0000-4000-8000-000000000003";
const SHARE_EXPIRED = "20000000-0000-4000-8000-000000000004";
const SHARE_SUBSET = "20000000-0000-4000-8000-000000000005";
const SHARE_MISSING = "20000000-0000-4000-8000-000000000099";

// A second album whose photo is served from the local seed, so the binary routes can
// be exercised end to end without Google credentials.
const ALBUM_MEDIA = "00000000-0000-4000-8000-000000000003";
const PHOTO_SEED = "10000000-0000-4000-8000-000000000005";
const SHARE_MEDIA = "20000000-0000-4000-8000-000000000006";
const SHARE_NO_DOWNLOAD = "20000000-0000-4000-8000-000000000007";

const PASSWORD = "open sesame please";

function context<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

function jsonRequest(url: string, body: unknown, init: RequestInit = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    body: JSON.stringify(body),
    ...init,
  });
}

async function resetDatabase(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE organizations, users, sessions, accounts, verifications RESTART IDENTITY CASCADE`,
  );
}

async function seed(): Promise<void> {
  await db.execute(sql`INSERT INTO organizations (name, strip_metadata) VALUES ('Org', true)`);
  await db.execute(
    sql`INSERT INTO users (id, name, email, role) VALUES ('user-1', 'Owner', 'owner@example.com', 'admin')`,
  );

  // The password hash is produced by the same helper the admin flow uses, so the
  // route's verifyPassword call is exercised against a real Better Auth hash.
  const { hashPassword } = await import("better-auth/crypto");
  const passwordHash = await hashPassword(PASSWORD);

  await db.execute(
    sql`INSERT INTO albums (id, slug, title, status, owner_user_id) VALUES (${ALBUM}, 'album-1', 'Album', 'ready', 'user-1')`,
  );
  await db.execute(
    sql`INSERT INTO albums (id, slug, title, status, owner_user_id) VALUES (${ALBUM_OTHER}, 'album-2', 'Other', 'ready', 'user-1')`,
  );
  await db.execute(sql`
    INSERT INTO photos (id, album_id, drive_file_id, name, width, height, sort_index)
    VALUES
      (${PHOTO_1}, ${ALBUM}, 'drive-1', 'A.jpg', 6000, 4000, 0),
      (${PHOTO_2}, ${ALBUM}, 'drive-2', 'B.jpg', 4000, 6000, 1),
      (${PHOTO_MISSING}, ${ALBUM}, 'drive-3', 'C.jpg', 6000, 4000, 2),
      (${PHOTO_OTHER_ALBUM}, ${ALBUM_OTHER}, 'drive-4', 'D.jpg', 6000, 4000, 0)
  `);
  await db.execute(sql`UPDATE photos SET missing_at = now() WHERE id = ${PHOTO_MISSING}`);

  await db.execute(sql`
    INSERT INTO shares (id, album_id, slug, mode, password_hash)
    VALUES
      (${SHARE_PUBLIC}, ${ALBUM}, 'public-share', 'public', NULL),
      (${SHARE_PASSWORD}, ${ALBUM}, 'password-share', 'password', ${passwordHash}),
      (${SHARE_MAGIC}, ${ALBUM}, 'magic-share', 'magic_link', NULL),
      (${SHARE_EXPIRED}, ${ALBUM}, 'expired-share', 'public', NULL),
      (${SHARE_SUBSET}, ${ALBUM}, 'subset-share', 'public', NULL)
  `);
  await db.execute(
    sql`UPDATE shares SET expires_at = now() - interval '1 day' WHERE id = ${SHARE_EXPIRED}`,
  );
  await db.execute(
    sql`INSERT INTO share_photos (share_id, photo_id) VALUES (${SHARE_SUBSET}, ${PHOTO_1})`,
  );

  // Binary routes need a photo the local seed can serve ("seed-photo-NN"), plus one
  // share that forbids downloads so the policy gate is observable.
  await db.execute(
    sql`INSERT INTO albums (id, slug, title, status, owner_user_id) VALUES (${ALBUM_MEDIA}, 'album-media', 'Media', 'ready', 'user-1')`,
  );
  await db.execute(sql`
    INSERT INTO photos (id, album_id, drive_file_id, name, width, height, sort_index)
    VALUES (${PHOTO_SEED}, ${ALBUM_MEDIA}, 'seed-photo-01', 'Seed.jpg', 6000, 4000, 0)
  `);
  await db.execute(sql`
    INSERT INTO shares (id, album_id, slug, mode, allow_download)
    VALUES
      (${SHARE_MEDIA}, ${ALBUM_MEDIA}, 'media-share', 'public', true),
      (${SHARE_NO_DOWNLOAD}, ${ALBUM_MEDIA}, 'no-download-share', 'public', false)
  `);
}

describe.skipIf(!databaseUrl)("share route handlers", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET = "test-secret-".padEnd(48, "x");
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    // The zip route resolves the Drive runtime before it authorizes the request, but
    // the service-account key is only read lazily when a real file is streamed. The
    // seeded photos never stream from Drive, so a path is all it needs.
    process.env.GOOGLE_DRIVE_KEY_FILE = "/nonexistent/service-account.json";
    process.env.THUMB_CACHE_DIR = "/tmp/potokuadrat-test-thumbs";
    // Seed media comes from the local cache, so the suite never touches Unsplash.
    process.env.SEED_MEDIA_DIR = SEED_MEDIA_DIR;
    await mkdir(SEED_MEDIA_DIR, { recursive: true });
    for (const width of [400, 1600, 2048]) {
      await writeFile(join(SEED_MEDIA_DIR, `seed-photo-01-${width}.jpg`), SEED_JPEG);
    }

    const dbModule = await import("@/server/db/client");
    db = dbModule.getDb();
    closeDb = dbModule.closeDb;

    shareRoute = await import("@/app/api/share/[slug]/route");
    photosRoute = await import("@/app/api/share/[slug]/photos/route");
    accessRoute = await import("@/app/api/share/[slug]/access/route");
    magicRoute = await import("@/app/api/share/[slug]/magic/route");
    favoritesRoute = await import("@/app/api/share/[slug]/favorites/route");
    favoriteRoute = await import("@/app/api/share/[slug]/favorites/[photoId]/route");
    archiveRoute = await import("@/app/api/share/[slug]/download.zip/route");
    thumbRoute = await import("@/app/s/[slug]/thumb/[photoId]/route");
    downloadRoute = await import("@/app/s/[slug]/download/[photoId]/route");
  });

  beforeEach(async () => {
    await resetDatabase();
    await seed();
  });

  afterAll(async () => {
    await resetDatabase();
    await closeDb();
    await rm(SEED_MEDIA_DIR, { recursive: true, force: true });
  });

  describe("GET /api/share/[slug]", () => {
    it("returns 404 for an unknown slug", async () => {
      const response = await shareRoute.GET(
        new Request(`http://localhost:3000/api/share/nope`),
        context({ slug: "nope" }),
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "Share not found." });
    });

    it("returns the gallery state for a public share", async () => {
      const response = await shareRoute.GET(
        new Request(`http://localhost:3000/api/share/public-share`),
        context({ slug: "public-share" }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");

      const body = await response.json();
      expect(body).toMatchObject({
        access: "ok",
        album: { slug: "album-1", title: "Album", photoCount: 2 },
        policy: { mode: "public", allowDownload: true, stripMetadata: true },
      });
    });

    it("gates a password share and reports expired shares", async () => {
      const gated = await shareRoute.GET(
        new Request(`http://localhost:3000/api/share/password-share`),
        context({ slug: "password-share" }),
      );
      expect((await gated.json()).access).toBe("password_required");

      const expired = await shareRoute.GET(
        new Request(`http://localhost:3000/api/share/expired-share`),
        context({ slug: "expired-share" }),
      );
      expect((await expired.json()).access).toBe("expired");
    });

    it("never leaks album or policy details to a gated caller", async () => {
      const response = await shareRoute.GET(
        new Request(`http://localhost:3000/api/share/magic-share`),
        context({ slug: "magic-share" }),
      );

      const body = await response.json();
      expect(body).toEqual({ access: "magic_link_required", album: null, policy: null });
    });
  });

  describe("GET /api/share/[slug]/photos", () => {
    it("lists only live photos of the share's album", async () => {
      const response = await photosRoute.GET(
        new Request(`http://localhost:3000/api/share/public-share/photos`),
        context({ slug: "public-share" }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");

      const body = await response.json();
      const names = body.photos.map((photo: { name: string }) => photo.name);
      expect(names).toEqual(["A.jpg", "B.jpg"]);
      expect(body.total).toBe(2);
    });

    it("honours the frozen subset", async () => {
      const response = await photosRoute.GET(
        new Request(`http://localhost:3000/api/share/subset-share/photos`),
        context({ slug: "subset-share" }),
      );

      const body = await response.json();
      expect(body.photos.map((photo: { name: string }) => photo.name)).toEqual(["A.jpg"]);
    });

    it("rejects a gated caller with 403 and an unknown slug with 404", async () => {
      const gated = await photosRoute.GET(
        new Request(`http://localhost:3000/api/share/password-share/photos`),
        context({ slug: "password-share" }),
      );
      expect(gated.status).toBe(403);
      expect((await gated.json()).error).toMatch(/password/i);

      const unknown = await photosRoute.GET(
        new Request(`http://localhost:3000/api/share/nope/photos`),
        context({ slug: "nope" }),
      );
      expect(unknown.status).toBe(404);
    });

    it("rejects an invalid filter", async () => {
      const badFilter = await photosRoute.GET(
        new Request(`http://localhost:3000/api/share/public-share/photos?filter=sideways`),
        context({ slug: "public-share" }),
      );
      expect(badFilter.status).toBe(400);
    });

    it("clamps an oversized limit to the maximum page size", async () => {
      // The seed has two live photos, so `<= 200` would hold even if the route
      // accepted 500 verbatim. Seed past the clamp so the difference is visible.
      await db.execute(sql`
        INSERT INTO photos (album_id, drive_file_id, name, width, height, sort_index)
        SELECT ${ALBUM}, 'bulk-' || g, 'Bulk ' || g || '.jpg', 6000, 4000, 100 + g
        FROM generate_series(1, 205) AS g
      `);

      const response = await photosRoute.GET(
        new Request(`http://localhost:3000/api/share/public-share/photos?limit=500`),
        context({ slug: "public-share" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      // Two seeded photographs plus the 205 bulk rows.
      expect(body.total).toBe(207);
      expect(body.photos).toHaveLength(200);
      expect(body.nextCursor).toBeTruthy();
    });

    it("rejects a non-numeric or non-positive limit", async () => {
      for (const value of ["abc", "0", "-3", "1.5"]) {
        const response = await photosRoute.GET(
          new Request(`http://localhost:3000/api/share/public-share/photos?limit=${value}`),
          context({ slug: "public-share" }),
        );
        expect(response.status, `limit=${value}`).toBe(400);
      }
    });

    it("paginates with an opaque cursor", async () => {
      const first = await photosRoute.GET(
        new Request(`http://localhost:3000/api/share/public-share/photos?limit=1`),
        context({ slug: "public-share" }),
      );
      const firstBody = await first.json();
      expect(firstBody.photos).toHaveLength(1);
      expect(firstBody.nextCursor).toBeTruthy();

      const second = await photosRoute.GET(
        new Request(
          `http://localhost:3000/api/share/public-share/photos?limit=1&cursor=${firstBody.nextCursor}`,
        ),
        context({ slug: "public-share" }),
      );
      const secondBody = await second.json();
      expect(secondBody.photos).toHaveLength(1);
      expect(secondBody.photos[0].id).not.toBe(firstBody.photos[0].id);
    });
  });

  describe("POST /api/share/[slug]/access", () => {
    it("returns 404 for an unknown slug and 410 for an expired one", async () => {
      const unknown = await accessRoute.POST(
        jsonRequest("http://localhost:3000/api/share/nope/access", { password: PASSWORD }),
        context({ slug: "nope" }),
      );
      expect(unknown.status).toBe(404);

      const expired = await accessRoute.POST(
        jsonRequest("http://localhost:3000/api/share/expired-share/access", { password: PASSWORD }),
        context({ slug: "expired-share" }),
      );
      expect(expired.status).toBe(410);
      expect((await expired.json()).error).toBe("Share expired.");
    });

    it("rejects a share that does not use a password", async () => {
      const response = await accessRoute.POST(
        jsonRequest("http://localhost:3000/api/share/public-share/access", { password: PASSWORD }),
        context({ slug: "public-share" }),
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatch(/does not use a password/i);
    });

    it("rejects a malformed body", async () => {
      const response = await accessRoute.POST(
        jsonRequest("http://localhost:3000/api/share/password-share/access", { password: "" }),
        context({ slug: "password-share" }),
      );

      expect(response.status).toBe(400);
    });

    it("rejects a wrong password with 401 and no cookie", async () => {
      const response = await accessRoute.POST(
        jsonRequest("http://localhost:3000/api/share/password-share/access", {
          password: "not the password",
        }),
        context({ slug: "password-share" }),
      );

      expect(response.status).toBe(401);
      expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("sets a signed cookie on the right password", async () => {
      const response = await accessRoute.POST(
        jsonRequest("http://localhost:3000/api/share/password-share/access", {
          password: PASSWORD,
        }),
        context({ slug: "password-share" }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true, data: { access: "ok" } });

      const cookie = response.headers.get("set-cookie");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");

      // The cookie the route hands out must satisfy the same gate it protects.
      const unlocked = await shareRoute.GET(
        new Request(`http://localhost:3000/api/share/password-share`, {
          headers: { cookie: cookie!.split(";")[0] },
        }),
        context({ slug: "password-share" }),
      );
      expect((await unlocked.json()).access).toBe("ok");
    });

    it("rate-limits repeated wrong passwords per client", async () => {
      // The limiter is a module-level singleton keyed by `shareId:clientIp`, so a fresh
      // x-forwarded-for gives this test its own bucket instead of inheriting the
      // attempts burned by the tests above.
      const attempt = () =>
        accessRoute.POST(
          jsonRequest(
            "http://localhost:3000/api/share/password-share/access",
            { password: "wrong" },
            { headers: { "x-forwarded-for": "203.0.113.7" } },
          ),
          context({ slug: "password-share" }),
        );

      const statuses: number[] = [];
      for (let i = 0; i < 7; i += 1) {
        statuses.push((await attempt()).status);
      }

      // Five attempts per minute per share and client, then 429.
      expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(statuses[5]).toBe(429);
      expect(statuses[6]).toBe(429);
    });

    it("does not share the rate-limit bucket across clients", async () => {
      const wrongPassword = (ip: string) =>
        accessRoute.POST(
          jsonRequest(
            "http://localhost:3000/api/share/password-share/access",
            { password: "wrong" },
            { headers: { "x-forwarded-for": ip } },
          ),
          context({ slug: "password-share" }),
        );

      for (let i = 0; i < 5; i += 1) {
        await wrongPassword("198.51.100.1");
      }
      expect((await wrongPassword("198.51.100.1")).status).toBe(429);

      // A different client is unaffected by the first one exhausting its bucket.
      expect((await wrongPassword("198.51.100.2")).status).toBe(401);
    });
  });

  describe("POST /api/share/[slug]/magic", () => {
    it("rejects a share that does not use magic links", async () => {
      const response = await magicRoute.POST(
        jsonRequest("http://localhost:3000/api/share/public-share/magic", {
          token: "a-long-enough-token",
        }),
        context({ slug: "public-share" }),
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatch(/does not use magic links/i);
    });

    it("rejects an unknown token with 401", async () => {
      const response = await magicRoute.POST(
        jsonRequest("http://localhost:3000/api/share/magic-share/magic", {
          token: "a-long-enough-token",
        }),
        context({ slug: "magic-share" }),
      );

      expect(response.status).toBe(401);
      expect((await response.json()).error).toMatch(/invalid or already used/i);
    });

    it("exchanges a valid token once and refuses the second use", async () => {
      const { hashMagicToken } = await import("@/server/shares/token");
      const rawToken = "magic-token-for-the-guest";
      await db.execute(sql`
        INSERT INTO share_recipients (share_id, email, token_hash)
        VALUES (${SHARE_MAGIC}, 'guest@example.com', ${hashMagicToken(rawToken)})
      `);

      const first = await magicRoute.POST(
        jsonRequest("http://localhost:3000/api/share/magic-share/magic", { token: rawToken }),
        context({ slug: "magic-share" }),
      );

      expect(first.status).toBe(200);
      await expect(first.json()).resolves.toEqual({
        ok: true,
        data: { access: "ok", email: "guest@example.com" },
      });

      const cookie = first.headers.get("set-cookie");
      expect(cookie).toContain("HttpOnly");

      const second = await magicRoute.POST(
        jsonRequest("http://localhost:3000/api/share/magic-share/magic", { token: rawToken }),
        context({ slug: "magic-share" }),
      );
      expect(second.status).toBe(401);
    });
  });

  describe("favorites", () => {
    async function magicSessionCookie(): Promise<string> {
      const { hashMagicToken } = await import("@/server/shares/token");
      const rawToken = "favorites-token-1234";
      await db.execute(sql`
        INSERT INTO share_recipients (share_id, email, token_hash)
        VALUES (${SHARE_MAGIC}, 'guest@example.com', ${hashMagicToken(rawToken)})
      `);

      const response = await magicRoute.POST(
        jsonRequest("http://localhost:3000/api/share/magic-share/magic", { token: rawToken }),
        context({ slug: "magic-share" }),
      );

      return response.headers.get("set-cookie")!.split(";")[0];
    }

    it("rejects an anonymous caller on a magic-link share", async () => {
      const response = await favoritesRoute.GET(
        new Request(`http://localhost:3000/api/share/magic-share/favorites`),
        context({ slug: "magic-share" }),
      );

      expect(response.status).toBe(403);
    });

    it("adds, lists, and removes a favorite for a live client session", async () => {
      const cookie = await magicSessionCookie();
      const headers = { cookie };

      const added = await favoriteRoute.PUT(
        new Request(`http://localhost:3000/api/share/magic-share/favorites/${PHOTO_1}`, {
          method: "PUT",
          headers,
        }),
        context({ slug: "magic-share", photoId: PHOTO_1 }),
      );
      expect(added.status).toBe(200);
      expect((await added.json()).photoIds).toContain(PHOTO_1);

      const listed = await favoritesRoute.GET(
        new Request(`http://localhost:3000/api/share/magic-share/favorites`, { headers }),
        context({ slug: "magic-share" }),
      );
      expect((await listed.json()).photoIds).toContain(PHOTO_1);

      const removed = await favoriteRoute.DELETE(
        new Request(`http://localhost:3000/api/share/magic-share/favorites/${PHOTO_1}`, {
          method: "DELETE",
          headers,
        }),
        context({ slug: "magic-share", photoId: PHOTO_1 }),
      );
      expect(removed.status).toBe(200);
      expect((await removed.json()).photoIds).not.toContain(PHOTO_1);
    });

    it("refuses a photo outside the share's album or tombstoned", async () => {
      const cookie = await magicSessionCookie();

      const otherAlbum = await favoriteRoute.PUT(
        new Request(`http://localhost:3000/api/share/magic-share/favorites/${PHOTO_OTHER_ALBUM}`, {
          method: "PUT",
          headers: { cookie },
        }),
        context({ slug: "magic-share", photoId: PHOTO_OTHER_ALBUM }),
      );
      expect(otherAlbum.status).toBe(404);

      const missing = await favoriteRoute.PUT(
        new Request(`http://localhost:3000/api/share/magic-share/favorites/${PHOTO_MISSING}`, {
          method: "PUT",
          headers: { cookie },
        }),
        context({ slug: "magic-share", photoId: PHOTO_MISSING }),
      );
      expect(missing.status).toBe(404);
    });
  });

  describe("GET /s/[slug]/thumb/[photoId]", () => {
    it("serves a seed thumbnail and answers 304 for a matching ETag", async () => {
      const first = await thumbRoute.GET(
        new Request(`http://localhost:3000/s/media-share/thumb/${PHOTO_SEED}?w=400`),
        context({ slug: "media-share", photoId: PHOTO_SEED }),
      );

      expect(first.status).toBe(200);
      expect(first.headers.get("content-type")).toBe("image/jpeg");
      expect(first.headers.get("cache-control")).toMatch(/immutable/);
      expect(Buffer.from(await first.arrayBuffer()).equals(SEED_JPEG)).toBe(true);

      const etag = first.headers.get("etag");
      expect(etag).toBeTruthy();

      const cached = await thumbRoute.GET(
        new Request(`http://localhost:3000/s/media-share/thumb/${PHOTO_SEED}?w=400`, {
          headers: { "if-none-match": etag! },
        }),
        context({ slug: "media-share", photoId: PHOTO_SEED }),
      );

      expect(cached.status).toBe(304);
      expect(cached.headers.get("etag")).toBe(etag);
    });

    it("rejects an unsupported width", async () => {
      const response = await thumbRoute.GET(
        new Request(`http://localhost:3000/s/media-share/thumb/${PHOTO_SEED}?w=999`),
        context({ slug: "media-share", photoId: PHOTO_SEED }),
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatch(/width/i);
    });

    it("gates a password share and rejects a photo from another album", async () => {
      const gated = await thumbRoute.GET(
        new Request(`http://localhost:3000/s/password-share/thumb/${PHOTO_1}`),
        context({ slug: "password-share", photoId: PHOTO_1 }),
      );
      expect(gated.status).toBe(403);
      expect((await gated.json()).error).toMatch(/password/i);

      const outside = await thumbRoute.GET(
        new Request(`http://localhost:3000/s/media-share/thumb/${PHOTO_1}`),
        context({ slug: "media-share", photoId: PHOTO_1 }),
      );
      expect(outside.status).toBe(404);
    });
  });

  describe("GET /s/[slug]/download/[photoId]", () => {
    it("serves a seed original as an attachment", async () => {
      const response = await downloadRoute.GET(
        new Request(`http://localhost:3000/s/media-share/download/${PHOTO_SEED}`),
        context({ slug: "media-share", photoId: PHOTO_SEED }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/jpeg");
      // The local seed serves the cached JPEG, and the route keeps that extension so
      // the zip entry and the download agree.
      expect(response.headers.get("content-disposition")).toBe(
        'attachment; filename="Seed.jpg"',
      );
      expect(Buffer.from(await response.arrayBuffer()).equals(SEED_JPEG)).toBe(true);
    });

    it("rejects an unknown quality", async () => {
      const response = await downloadRoute.GET(
        new Request(`http://localhost:3000/s/media-share/download/${PHOTO_SEED}?quality=lossless`),
        context({ slug: "media-share", photoId: PHOTO_SEED }),
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatch(/quality/i);
    });

    it("refuses a share that forbids downloads", async () => {
      const response = await downloadRoute.GET(
        new Request(`http://localhost:3000/s/no-download-share/download/${PHOTO_SEED}`),
        context({ slug: "no-download-share", photoId: PHOTO_SEED }),
      );

      expect(response.status).toBe(403);
      expect((await response.json()).error).toMatch(/does not allow/i);
    });
  });

  describe("GET /api/share/[slug]/download.zip", () => {
    it("streams a zip named after the album and quality", async () => {
      const response = await archiveRoute.GET(
        new Request("http://localhost:3000/api/share/media-share/download.zip?quality=original"),
        context({ slug: "media-share" }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/zip");
      expect(response.headers.get("content-disposition")).toContain("album-media-original.zip");

      const bytes = new Uint8Array(await response.arrayBuffer());
      // Local file header magic: "PK".
      expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
    });

    it("answers 404 for an unknown slug and 403 for a gated share", async () => {
      const unknown = await archiveRoute.GET(
        new Request("http://localhost:3000/api/share/nope/download.zip"),
        context({ slug: "nope" }),
      );
      expect(unknown.status).toBe(404);

      const gated = await archiveRoute.GET(
        new Request("http://localhost:3000/api/share/password-share/download.zip"),
        context({ slug: "password-share" }),
      );
      expect(gated.status).toBe(403);
      expect((await gated.json()).error).toMatch(/password/i);
    });

    it("rejects an unknown quality and a share that forbids downloads", async () => {
      const quality = await archiveRoute.GET(
        new Request("http://localhost:3000/api/share/media-share/download.zip?quality=lossless"),
        context({ slug: "media-share" }),
      );
      expect(quality.status).toBe(400);

      const forbidden = await archiveRoute.GET(
        new Request("http://localhost:3000/api/share/no-download-share/download.zip"),
        context({ slug: "no-download-share" }),
      );
      expect(forbidden.status).toBe(403);
    });
  });

  describe("unknown share id", () => {
    it("does not treat a well-formed but absent share as found", async () => {
      const response = await shareRoute.GET(
        new Request(`http://localhost:3000/api/share/${SHARE_MISSING}`),
        context({ slug: SHARE_MISSING }),
      );

      expect(response.status).toBe(404);
    });
  });
});
