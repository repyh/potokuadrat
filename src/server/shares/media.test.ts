import { describe, expect, it, vi } from "vitest";

import { resolveShareMedia } from "./media";
import type { SharePhotoRecord, ShareRecord, ShareRepository } from "./repository";

const share: ShareRecord = {
  id: "share-1",
  slug: "public-share",
  mode: "public",
  expiresAt: null,
  allowDownload: true,
  allowedQualities: ["original", "web"],
  stripMetadata: null,
  albumId: "album-1",
  albumTitle: "Album",
  organizationStripMetadata: true,
};

const photo: SharePhotoRecord = {
  id: "photo-1",
  driveFileId: "drive-photo-1",
  name: "TOP2.jpg",
  width: 6000,
  height: 4000,
  mimeType: "image/jpeg",
  bytes: 100,
};

function repository(overrides: Partial<ShareRepository> = {}): ShareRepository {
  return {
    findBySlug: vi.fn(async () => share),
    getSharePhoto: vi.fn(async () => photo),
    ...overrides,
  };
}

describe("resolveShareMedia", () => {
  it("returns the share and photo when everything is allowed", async () => {
    const result = await resolveShareMedia(repository(), "public-share", "photo-1");

    expect(result).toEqual({ ok: true, share, photo });
  });

  it("404s an unknown share without asking for a photo", async () => {
    const repo = repository({ findBySlug: vi.fn(async () => null) });

    const result = await resolveShareMedia(repo, "missing", "photo-1");

    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(repo.getSharePhoto).not.toHaveBeenCalled();
  });

  it("410s an expired share", async () => {
    const repo = repository({
      findBySlug: vi.fn(async () => ({
        ...share,
        expiresAt: new Date("2026-01-01T00:00:00Z"),
      })),
    });

    expect(await resolveShareMedia(repo, "public-share", "photo-1")).toMatchObject({
      ok: false,
      status: 410,
    });
  });

  it("403s a password share until the gate exists", async () => {
    const repo = repository({
      findBySlug: vi.fn(async () => ({ ...share, mode: "password" as const })),
    });

    expect(await resolveShareMedia(repo, "public-share", "photo-1")).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("404s a magic-link share until the gate exists", async () => {
    const repo = repository({
      findBySlug: vi.fn(async () => ({ ...share, mode: "magic_link" as const })),
    });

    expect(await resolveShareMedia(repo, "public-share", "photo-1")).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("404s a photo outside the album or subset", async () => {
    const repo = repository({ getSharePhoto: vi.fn(async () => null) });

    expect(await resolveShareMedia(repo, "public-share", "other-photo")).toMatchObject({
      ok: false,
      status: 404,
    });
  });
});
