import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createShareCookieValue, shareCookieName } from "./cookie";
import { addFavorite, favoriteSession, listFavorites, removeFavorite } from "./favorites";
import type { ShareRecord, ShareRepository } from "./repository";

const PHOTO_ID = "10000000-0000-4000-8000-000000000001";

const share: ShareRecord = {
  id: "20000000-0000-4000-8000-000000000001",
  slug: "album-share",
  mode: "magic_link",
  passwordHash: null,
  expiresAt: null,
  allowDownload: true,
  allowedQualities: ["original", "web"],
  stripMetadata: null,
  albumId: "00000000-0000-4000-8000-000000000001",
  albumSlug: "album",
  albumTitle: "Album",
  albumBranding: null,
  photographerName: "Owner",
  photoCount: 2,
  organizationStripMetadata: true,
};

function repository(overrides: Partial<ShareRepository> = {}): ShareRepository {
  return {
    findBySlug: vi.fn(async () => share),
    getSharePhoto: vi.fn(async () => null),
    listSharePhotos: vi.fn(async () => ({ rows: [], total: 0, hasMore: false })),
    consumeRecipient: vi.fn(async () => null),
    createClientSession: vi.fn(async () => ({
      id: "session-1",
      email: "guest@example.com",
      expiresAt: new Date(Date.now() + 60_000),
    })),
    findOrCreateClientSession: vi.fn(async () => ({
      id: "session-1",
      email: "guest@example.com",
      expiresAt: new Date(Date.now() + 60_000),
    })),
    findClientSession: vi.fn(async () => ({
      id: "session-1",
      email: "guest@example.com",
      expiresAt: new Date(Date.now() + 60_000),
    })),
    listFavoritePhotoIds: vi.fn(async () => [PHOTO_ID]),
    addFavorite: vi.fn(async () => true),
    removeFavorite: vi.fn(async () => {}),
    ...overrides,
  };
}

function authorizedRequest(): Request {
  const cookie = createShareCookieValue(share.id, { sessionId: "session-1" });
  return new Request("http://localhost/api/share/album-share/favorites", {
    headers: { cookie: `${shareCookieName(share.id)}=${cookie.value}` },
  });
}

function anonymousRequest(): Request {
  return new Request("http://localhost/api/share/album-share/favorites");
}

beforeEach(() => {
  process.env.BETTER_AUTH_SECRET = "favorites-test-secret-0123456789abcdef";
});

afterEach(() => {
  delete process.env.BETTER_AUTH_SECRET;
});

describe("favoriteSession", () => {
  it("accepts a magic-link session", () => {
    expect(favoriteSession(share, "session-1")).toEqual({ ok: true, sessionId: "session-1" });
  });

  it("sends other modes back to the browser", () => {
    expect(favoriteSession({ mode: "public" }, "session-1")).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(favoriteSession({ mode: "password" }, null)).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("rejects a magic-link share without a session", () => {
    expect(favoriteSession(share, null)).toMatchObject({ ok: false, status: 401 });
  });
});

describe("listFavorites", () => {
  it("returns the session's visible favorites", async () => {
    const repo = repository();

    const result = await listFavorites(repo, authorizedRequest(), "album-share");

    expect(result).toEqual({ ok: true, favorites: { photoIds: [PHOTO_ID] } });
    expect(repo.listFavoritePhotoIds).toHaveBeenCalledWith(share, "session-1");
  });

  it("403s a magic-link share without proof", async () => {
    const repo = repository();

    expect(await listFavorites(repo, anonymousRequest(), "album-share")).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(repo.listFavoritePhotoIds).not.toHaveBeenCalled();
  });

  it("400s a public share", async () => {
    const repo = repository({
      findBySlug: vi.fn(async () => ({ ...share, mode: "public" as const })),
    });

    expect(await listFavorites(repo, anonymousRequest(), "album-share")).toMatchObject({
      ok: false,
      status: 400,
      error: "This share keeps favorites in the browser.",
    });
  });
});

describe("addFavorite", () => {
  it("adds a visible photo and returns the new list", async () => {
    const repo = repository();

    expect(
      await addFavorite(repo, authorizedRequest(), "album-share", PHOTO_ID),
    ).toEqual({ ok: true, favorites: { photoIds: [PHOTO_ID] } });
    expect(repo.addFavorite).toHaveBeenCalledWith(share, "session-1", PHOTO_ID);
  });

  it("404s a photo outside the share", async () => {
    const repo = repository({ addFavorite: vi.fn(async () => false) });

    expect(
      await addFavorite(repo, authorizedRequest(), "album-share", PHOTO_ID),
    ).toMatchObject({ ok: false, status: 404 });
  });
});

describe("removeFavorite", () => {
  it("removes the favorite and returns the new list", async () => {
    const repo = repository({ listFavoritePhotoIds: vi.fn(async () => []) });

    expect(
      await removeFavorite(repo, authorizedRequest(), "album-share", PHOTO_ID),
    ).toEqual({ ok: true, favorites: { photoIds: [] } });
    expect(repo.removeFavorite).toHaveBeenCalledWith("session-1", PHOTO_ID);
  });
});
