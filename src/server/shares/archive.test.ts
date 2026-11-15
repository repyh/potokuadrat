import { describe, expect, it, vi } from "vitest";

import {
  ARCHIVE_TOO_LARGE,
  MAX_ARCHIVE_PHOTOS,
  buildArchivePlan,
  entryNameFor,
  parseArchiveQuery,
  prepareShareArchive,
  safeEntryName,
  uniqueEntryNames,
} from "./archive";
import type { SharePhotoRecord, ShareRecord, ShareRepository } from "./repository";

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
  albumSlug: "album-share",
  albumTitle: "Album",
  albumBranding: null,
  photographerName: "Owner",
  photoCount: 2,
  organizationStripMetadata: true,
};

function photo(overrides: Partial<SharePhotoRecord> = {}): SharePhotoRecord {
  return {
    id: PHOTO_ID,
    driveFileId: "drive-photo-1",
    name: "TOP2.jpg",
    width: 6000,
    height: 4000,
    mimeType: "image/jpeg",
    bytes: 1024,
    ...overrides,
  };
}

function repository(overrides: Partial<ShareRepository> = {}): ShareRepository {
  return {
    findBySlug: vi.fn(async () => share),
    getSharePhoto: vi.fn(async () => null),
    listSharePhotos: vi.fn(async () => ({ rows: [], total: 0, hasMore: false })),
    listShareArchivePhotos: vi.fn(async () => [photo()]),
    consumeRecipient: vi.fn(async () => null),
    createClientSession: vi.fn(async () => ({
      id: "session-1",
      email: "guest@example.com",
      expiresAt: new Date(),
    })),
    findOrCreateClientSession: vi.fn(async () => ({
      id: "session-1",
      email: "guest@example.com",
      expiresAt: new Date(),
    })),
    findClientSession: vi.fn(async () => null),
    listFavoritePhotoIds: vi.fn(async () => []),
    addFavorite: vi.fn(async () => true),
    removeFavorite: vi.fn(async () => {}),
    ...overrides,
  };
}

function drive() {
  return {
    client: {
      openOriginal: vi.fn(
        async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
      ),
    },
    cache: {
      get: vi.fn(async () => ({
        body: Buffer.from([4, 5, 6]),
        etag: '"1"',
        contentType: "image/jpeg" as const,
        file: "cached.jpg",
        fromCache: true,
      })),
    },
    config: { concurrency: 4 },
  };
}

function request(query = ""): Request {
  return new Request(`http://localhost/api/share/album-share/download.zip${query}`);
}

describe("parseArchiveQuery", () => {
  it("defaults to originals of the whole share", () => {
    expect(parseArchiveQuery(new URLSearchParams())).toEqual({
      ok: true,
      query: { quality: "original", scope: "all", photoIds: null },
    });
  });

  it("reads quality, scope, and a deduplicated id list", () => {
    const parsed = parseArchiveQuery(
      new URLSearchParams({
        quality: "web",
        scope: "favorites",
        ids: `${PHOTO_ID}, ${PHOTO_ID}`,
      }),
    );

    expect(parsed).toEqual({
      ok: true,
      query: { quality: "web", scope: "favorites", photoIds: [PHOTO_ID] },
    });
  });

  it("rejects unknown quality, scope, and malformed ids", () => {
    expect(parseArchiveQuery(new URLSearchParams({ quality: "raw" }))).toMatchObject({
      ok: false,
      error: "Unsupported download quality.",
    });
    expect(parseArchiveQuery(new URLSearchParams({ scope: "all-photos" }))).toMatchObject({
      ok: false,
      error: "Unsupported download scope.",
    });
    expect(parseArchiveQuery(new URLSearchParams({ ids: "nope" }))).toMatchObject({
      ok: false,
      error: "Invalid photo ids.",
    });
    expect(parseArchiveQuery(new URLSearchParams({ ids: " , " }))).toMatchObject({
      ok: false,
    });
  });
});

describe("entry names", () => {
  it("flattens path separators and control characters", () => {
    expect(safeEntryName("../../etc/passwd")).toBe("_.._etc_passwd");
    expect(safeEntryName("bad\u0000name.jpg")).toBe("badname.jpg");
    expect(safeEntryName("   ")).toBe("photo");
  });

  it("uses the original name and the 2048 suffix per quality", () => {
    expect(entryNameFor(photo(), "original")).toBe("TOP2.jpg");
    expect(entryNameFor(photo(), "web")).toBe("TOP2-2048.jpg");
  });

  it("names development seed entries as SVG", () => {
    const seed = photo({ driveFileId: "seed-photo-01", name: "Seed Photo 01.jpg" });

    expect(entryNameFor(seed, "original")).toBe("Seed Photo 01.svg");
    expect(entryNameFor(seed, "web")).toBe("Seed Photo 01-2048.svg");
  });

  it("suffixes repeated filenames so every photo lands in the archive", () => {
    const entries = uniqueEntryNames([
      { photo: photo(), name: "TOP2.jpg" },
      { photo: photo({ id: "other" }), name: "TOP2.jpg" },
      { photo: photo({ id: "third" }), name: "TOP2.jpg" },
    ]);

    expect(entries.map((entry) => entry.name)).toEqual([
      "TOP2.jpg",
      "TOP2 (2).jpg",
      "TOP2 (3).jpg",
    ]);
  });
});

describe("buildArchivePlan", () => {
  it("keeps the photo order and totals the stored bytes", () => {
    const plan = buildArchivePlan([photo(), photo({ id: "other", bytes: 2048 })], "original");

    expect(plan).toMatchObject({ ok: true, bytes: 3072 });
    expect(plan.ok && plan.entries.map((entry) => entry.photo.id)).toEqual([PHOTO_ID, "other"]);
  });

  it("refuses more than 500 photos", () => {
    const photos = Array.from({ length: MAX_ARCHIVE_PHOTOS + 1 }, (_, index) =>
      photo({ id: `photo-${index}` }),
    );

    expect(buildArchivePlan(photos, "original")).toEqual({
      ok: false,
      status: 413,
      error: ARCHIVE_TOO_LARGE,
    });
  });

  it("refuses archives above 2 GB of stored bytes", () => {
    expect(buildArchivePlan([photo({ bytes: 2 * 1024 ** 3 + 1 })], "web")).toEqual({
      ok: false,
      status: 413,
      error: ARCHIVE_TOO_LARGE,
    });
  });
});

describe("prepareShareArchive", () => {
  it("streams a zip of the selected originals", async () => {
    const result = await prepareShareArchive(
      repository(),
      request(),
      "album-share",
      new URLSearchParams(),
      drive(),
    );

    expect(result).toMatchObject({ ok: true, filename: "album-share-original.zip" });
    if (!result.ok) return;

    const body = Buffer.from(await new Response(result.stream).arrayBuffer());
    expect(body.subarray(0, 2).toString()).toBe("PK");
    expect(body.includes("TOP2.jpg")).toBe(true);
  });

  it("uses the 2048 cache for web entries", async () => {
    const selection = drive();
    const result = await prepareShareArchive(
      repository(),
      request("?quality=web"),
      "album-share",
      new URLSearchParams("quality=web"),
      selection,
    );

    expect(result.ok).toBe(true);
    expect(selection.cache.get).toHaveBeenCalledWith(
      { id: "drive-photo-1", thumbnailLink: null },
      2048,
      "clean",
    );

    if (result.ok) {
      const body = Buffer.from(await new Response(result.stream).arrayBuffer());
      expect(body.includes("TOP2-2048.jpg")).toBe(true);
    }
  });

  it("404s an unknown share", async () => {
    expect(
      await prepareShareArchive(
        repository({ findBySlug: vi.fn(async () => null) }),
        request(),
        "missing",
        new URLSearchParams(),
        drive(),
      ),
    ).toMatchObject({ ok: false, status: 404 });
  });

  it("403s a quality the share does not allow", async () => {
    const repo = repository({
      findBySlug: vi.fn(async () => ({ ...share, allowedQualities: ["web" as const] })),
    });

    expect(
      await prepareShareArchive(repo, request(), "album-share", new URLSearchParams(), drive()),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("400s favorites without a session or an id list", async () => {
    expect(
      await prepareShareArchive(
        repository(),
        request("?scope=favorites"),
        "album-share",
        new URLSearchParams("scope=favorites"),
        drive(),
      ),
    ).toMatchObject({ ok: false, status: 400 });
  });

  it("404s an empty selection", async () => {
    expect(
      await prepareShareArchive(
        repository({ listShareArchivePhotos: vi.fn(async () => []) }),
        request("?scope=favorites&ids=" + PHOTO_ID),
        "album-share",
        new URLSearchParams(`scope=favorites&ids=${PHOTO_ID}`),
        drive(),
      ),
    ).toMatchObject({ ok: false, status: 404, error: "No photos to download." });
  });

  it("413s a selection above the photo cap before streaming", async () => {
    const photos = Array.from({ length: MAX_ARCHIVE_PHOTOS + 1 }, (_, index) =>
      photo({ id: `photo-${index}` }),
    );

    expect(
      await prepareShareArchive(
        repository({ listShareArchivePhotos: vi.fn(async () => photos) }),
        request(),
        "album-share",
        new URLSearchParams(),
        drive(),
      ),
    ).toMatchObject({ ok: false, status: 413, error: ARCHIVE_TOO_LARGE });
  });
});
