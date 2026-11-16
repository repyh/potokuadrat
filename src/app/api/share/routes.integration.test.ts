import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

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

let db: DbInstance;
let closeDb: () => Promise<void>;
let shareRoute: ShareRoute;
let photosRoute: PhotosRoute;
let accessRoute: AccessRoute;
let magicRoute: MagicRoute;
let favoritesRoute: FavoritesRoute;
let favoriteRoute: FavoriteRoute;

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
}

describe.skipIf(!databaseUrl)("share route handlers", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET = "test-secret-".padEnd(48, "x");
    process.env.BETTER_AUTH_URL = "http://localhost:3000";

    const dbModule = await import("@/server/db/client");
    db = dbModule.getDb();
    closeDb = dbModule.closeDb;

    shareRoute = await import("@/app/api/share/[slug]/route");
    photosRoute = await import("@/app/api/share/[slug]/photos/route");
    accessRoute = await import("@/app/api/share/[slug]/access/route");
    magicRoute = await import("@/app/api/share/[slug]/magic/route");
    favoritesRoute = await import("@/app/api/share/[slug]/favorites/route");
    favoriteRoute = await import("@/app/api/share/[slug]/favorites/[photoId]/route");
  });

  beforeEach(async () => {
    await resetDatabase();
    await seed();
  });

  afterAll(async () => {
    await resetDatabase();
    await closeDb();
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

    it("rejects an invalid filter but clamps an oversized limit", async () => {
      const badFilter = await photosRoute.GET(
        new Request(`http://localhost:3000/api/share/public-share/photos?filter=sideways`),
        context({ slug: "public-share" }),
      );
      expect(badFilter.status).toBe(400);

      // parsePhotoQuery clamps instead of rejecting: "A large limit is clamped instead
      // of rejected; the client still gets a page."
      const clamped = await photosRoute.GET(
        new Request(`http://localhost:3000/api/share/public-share/photos?limit=500`),
        context({ slug: "public-share" }),
      );
      expect(clamped.status).toBe(200);
      expect((await clamped.json()).photos.length).toBeLessThanOrEqual(200);
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
