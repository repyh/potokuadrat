import { describe, expect, it, vi } from "vitest";

import type { SharePhotoRow, ShareRecord, ShareRepository } from "./repository";
import {
  decodePhotoCursor,
  encodePhotoCursor,
  listShareGallery,
  parsePhotoQuery,
  toPhoto,
} from "./gallery";

const now = new Date("2026-11-15T10:00:00Z");
const PHOTO_ID = "10000000-0000-4000-8000-000000000001";

const share: ShareRecord = {
  id: "20000000-0000-4000-8000-000000000001",
  slug: "album-share",
  mode: "public",
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

const row: SharePhotoRow = {
  id: PHOTO_ID,
  name: "TOP2.jpg",
  width: 6000,
  height: 4000,
  bytes: 2048,
  thumbStatus: "ready",
  takenAt: new Date("2026-10-01T10:00:00Z"),
  sortIndex: 3,
};

function repository(overrides: Partial<ShareRepository> = {}): ShareRepository {
  return {
    findBySlug: vi.fn(async () => share),
    getSharePhoto: vi.fn(async () => null),
    listSharePhotos: vi.fn(async () => ({ rows: [row], total: 1, hasMore: false })),
    listShareArchivePhotos: vi.fn(async () => []),
    consumeRecipient: vi.fn(async () => null),
    createClientSession: vi.fn(async () => ({
      id: "session-1",
      email: "guest@example.com",
      expiresAt: now,
    })),
    findOrCreateClientSession: vi.fn(async () => ({
      id: "session-1",
      email: "guest@example.com",
      expiresAt: now,
    })),
    findClientSession: vi.fn(async () => null),
    listFavoritePhotoIds: vi.fn(async () => []),
    addFavorite: vi.fn(async () => true),
    removeFavorite: vi.fn(async () => {}),
    ...overrides,
  };
}

function request(query = ""): Request {
  return new Request(`http://localhost/api/share/album-share/photos${query}`);
}

describe("photo cursor", () => {
  it("round-trips sort index and photo id", () => {
    const encoded = encodePhotoCursor({ sortIndex: 12, id: PHOTO_ID });

    expect(encoded).not.toContain(":");
    expect(decodePhotoCursor(encoded)).toEqual({ sortIndex: 12, id: PHOTO_ID });
  });

  it("rejects a cursor that was not produced by the encoder", () => {
    expect(decodePhotoCursor("not-base64")).toBeNull();
    expect(
      decodePhotoCursor(Buffer.from("12", "utf8").toString("base64url")),
    ).toBeNull();
    expect(
      decodePhotoCursor(Buffer.from("12:not-a-uuid", "utf8").toString("base64url")),
    ).toBeNull();
    expect(
      decodePhotoCursor(Buffer.from("-1:" + PHOTO_ID, "utf8").toString("base64url")),
    ).toBeNull();
  });
});

describe("parsePhotoQuery", () => {
  it("defaults to all photos and the default page size", () => {
    expect(parsePhotoQuery(new URLSearchParams())).toEqual({
      ok: true,
      query: { filter: "all", sort: "manual", cursor: null, limit: 50 },
    });
  });

  it("reads a filter, a limit, and a cursor", () => {
    const cursor = encodePhotoCursor({ sortIndex: 3, id: PHOTO_ID });
    const parsed = parsePhotoQuery(
      new URLSearchParams({ filter: "portrait", limit: "25", cursor }),
    );

    expect(parsed).toEqual({
      ok: true,
      query: { filter: "portrait", sort: "manual", cursor: { sortIndex: 3, id: PHOTO_ID }, limit: 25 },
    });
  });

  it("clamps an oversized limit instead of rejecting it", () => {
    const parsed = parsePhotoQuery(new URLSearchParams({ limit: "5000" }));

    expect(parsed).toMatchObject({ ok: true, query: { limit: 200 } });
  });

  it("rejects unknown filters, bad limits, and bad cursors", () => {
    expect(parsePhotoQuery(new URLSearchParams({ filter: "videos" }))).toMatchObject({
      ok: false,
      error: "Unsupported photo filter.",
    });
    expect(parsePhotoQuery(new URLSearchParams({ limit: "0" }))).toMatchObject({ ok: false });
    expect(parsePhotoQuery(new URLSearchParams({ limit: "ten" }))).toMatchObject({ ok: false });
    expect(parsePhotoQuery(new URLSearchParams({ cursor: "broken" }))).toMatchObject({
      ok: false,
      error: "Invalid photo cursor.",
    });
  });
});

describe("toPhoto", () => {
  it("derives orientation and ISO timestamps without exposing Drive ids", () => {
    const photo = toPhoto(row);

    expect(photo).toEqual({
      id: PHOTO_ID,
      name: "TOP2.jpg",
      width: 6000,
      height: 4000,
      bytes: 2048,
      orientation: "landscape",
      thumbStatus: "ready",
      takenAt: "2026-10-01T10:00:00.000Z",
      sortIndex: 3,
    });
    expect(photo).not.toHaveProperty("driveFileId");
  });

  it("keeps unknown dimensions out of the orientation filters", () => {
    expect(toPhoto({ ...row, width: null, height: null }).orientation).toBe("unknown");
  });
});

describe("listShareGallery", () => {
  it("returns a page for a public share", async () => {
    const repo = repository();

    const result = await listShareGallery(
      repo,
      request("?filter=landscape&limit=10"),
      "album-share",
      new URLSearchParams("filter=landscape&limit=10"),
    );

    expect(result).toMatchObject({
      ok: true,
      page: { total: 1, nextCursor: null, photos: [{ id: PHOTO_ID }] },
    });
    expect(repo.listSharePhotos).toHaveBeenCalledWith(share, {
      filter: "landscape",
      sort: "manual",
      clientSessionId: null,
      cursor: null,
      limit: 10,
    });
  });

  it("404s an unknown share", async () => {
    const repo = repository({ findBySlug: vi.fn(async () => null) });

    expect(
      await listShareGallery(repo, request(), "missing", new URLSearchParams()),
    ).toMatchObject({ ok: false, status: 404 });
  });

  it("410s an expired share", async () => {
    const repo = repository({
      findBySlug: vi.fn(async () => ({ ...share, expiresAt: new Date("2026-01-01T00:00:00Z") })),
    });

    expect(
      await listShareGallery(repo, request(), "album-share", new URLSearchParams()),
    ).toMatchObject({ ok: false, status: 410 });
  });

  it("403s a password share without proof", async () => {
    const repo = repository({
      findBySlug: vi.fn(async () => ({ ...share, mode: "password" as const })),
    });

    expect(
      await listShareGallery(repo, request(), "album-share", new URLSearchParams()),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses the favorites filter for shares without a magic-link session", async () => {
    const repo = repository();

    const result = await listShareGallery(
      repo,
      request("?filter=favorites"),
      "album-share",
      new URLSearchParams("filter=favorites"),
    );

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: "This share keeps favorites in the browser.",
    });
    expect(repo.listSharePhotos).not.toHaveBeenCalled();
  });

  it("points the next cursor at the last photo of the page", async () => {
    const second: SharePhotoRow = {
      ...row,
      id: "10000000-0000-4000-8000-000000000002",
      sortIndex: 7,
    };
    const repo = repository({
      listSharePhotos: vi.fn(async () => ({ rows: [row, second], total: 5, hasMore: true })),
    });

    const result = await listShareGallery(
      repo,
      request("?limit=2"),
      "album-share",
      new URLSearchParams("limit=2"),
    );

    expect(result.ok && result.page.nextCursor).toBe(
      encodePhotoCursor({ sortIndex: 7, id: second.id }),
    );
  });

  it("rejects a bad query before touching the album", async () => {
    const repo = repository();

    expect(
      await listShareGallery(
        repo,
        request("?filter=nope"),
        "album-share",
        new URLSearchParams("filter=nope"),
      ),
    ).toMatchObject({ ok: false, status: 400 });
    expect(repo.listSharePhotos).not.toHaveBeenCalled();
  });

  it("parses sort modes, validates sort cursors, and forwards sort to the repository", async () => {
    const repo = repository();
    const cursor = encodePhotoCursor({ sort: "name", sortIndex: 2, id: PHOTO_ID });

    const decoded = decodePhotoCursor(cursor);
    expect(decoded).toEqual({ sort: "name", sortIndex: 2, id: PHOTO_ID });

    const valid = await listShareGallery(
      repo,
      request(`?filter=all&sort=name&cursor=${cursor}`),
      "album-share",
      new URLSearchParams({ filter: "all", sort: "name", cursor }),
    );
    expect(valid.ok).toBe(true);
    expect(repo.listSharePhotos).toHaveBeenCalledWith(share, {
      filter: "all",
      sort: "name",
      clientSessionId: null,
      cursor: { sort: "name", sortIndex: 2, id: PHOTO_ID },
      limit: 50,
    });

    const mismatched = await listShareGallery(
      repo,
      request(`?sort=taken&cursor=${cursor}`),
      "album-share",
      new URLSearchParams({ sort: "taken", cursor }),
    );
    expect(mismatched).toMatchObject({ ok: false, status: 400 });

    const badSort = parsePhotoQuery(new URLSearchParams({ sort: "random" }));
    expect(badSort).toEqual({ ok: false, error: "Unsupported photo sort." });
  });
});
