import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminSessionMock = vi.fn();
const getAlbumRepositoryMock = vi.fn();
const getDriveRuntimeMock = vi.fn();
const isSeedMediaMock = vi.fn();
const seedMediaMock = vi.fn();

vi.mock("@/server/auth/api", () => ({
  getAdminSession: (...args: unknown[]) => getAdminSessionMock(...args),
}));

vi.mock("@/server/albums/runtime", () => ({
  getAlbumRepository: (...args: unknown[]) => getAlbumRepositoryMock(...args),
}));

vi.mock("@/server/drive", () => ({
  getDriveRuntime: (...args: unknown[]) => getDriveRuntimeMock(...args),
}));

vi.mock("@/server/drive/seed-media", () => ({
  isSeedMedia: (...args: unknown[]) => isSeedMediaMock(...args),
  seedMedia: (...args: unknown[]) => seedMediaMock(...args),
}));

import { GET } from "./route";

const ALBUM_ID = "11111111-1111-4111-8111-111111111111";
const PHOTO_ID = "22222222-2222-4222-8222-222222222222";

function makeContext(id = ALBUM_ID, photoId = PHOTO_ID) {
  return { params: Promise.resolve({ id, photoId }) };
}

describe("admin album photo thumb route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSeedMediaMock.mockReturnValue(false);
  });

  it("returns 401 when no admin session exists", async () => {
    getAdminSessionMock.mockResolvedValue(null);

    const response = await GET(
      new Request(`https://example.test/api/admin/albums/${ALBUM_ID}/photos/${PHOTO_ID}/thumb`),
      makeContext(),
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 when an unsupported thumbnail width is requested", async () => {
    getAdminSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await GET(
      new Request(
        `https://example.test/api/admin/albums/${ALBUM_ID}/photos/${PHOTO_ID}/thumb?w=999`,
      ),
      makeContext(),
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when the signed-in admin does not own the album", async () => {
    getAdminSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    getAlbumRepositoryMock.mockReturnValue({
      getAlbum: vi.fn(async () => ({ id: ALBUM_ID, ownerUserId: "user-2" })),
      findAlbumPhotoMedia: vi.fn(),
    });

    const response = await GET(
      new Request(`https://example.test/api/admin/albums/${ALBUM_ID}/photos/${PHOTO_ID}/thumb`),
      makeContext(),
    );

    expect(response.status).toBe(404);
  });

  it("serves thumbnail bytes with private cache-control for the owning admin and honors 304", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    getAdminSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    getAlbumRepositoryMock.mockReturnValue({
      getAlbum: vi.fn(async () => ({ id: ALBUM_ID, ownerUserId: "user-1" })),
      findAlbumPhotoMedia: vi.fn(async () => ({
        id: PHOTO_ID,
        driveFileId: "drive-file-1",
        name: "portrait.jpg",
      })),
    });
    getDriveRuntimeMock.mockReturnValue({
      cache: {
        get: vi.fn(async () => ({ etag: '"etag-1"', body: Buffer.from(bytes) })),
      },
    });

    const response = await GET(
      new Request(
        `https://example.test/api/admin/albums/${ALBUM_ID}/photos/${PHOTO_ID}/thumb?w=400`,
      ),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(response.headers.get("etag")).toBe('"etag-1"');

    const cached = await GET(
      new Request(
        `https://example.test/api/admin/albums/${ALBUM_ID}/photos/${PHOTO_ID}/thumb?w=400`,
        { headers: { "if-none-match": '"etag-1"' } },
      ),
      makeContext(),
    );

    expect(cached.status).toBe(304);
  });
});
