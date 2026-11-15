import { describe, expect, it, vi } from "vitest";

import type {
  AdminRecipientRecord,
  AdminShareDetailRecord,
  AdminShareRecord,
  ShareAdminRepository,
} from "./admin-repository";
import {
  ShareNotFoundError,
  ShareValidationError,
  createShareAdminService,
} from "./admin";

const now = new Date("2026-11-15T10:00:00Z");
const ALBUM_ID = "00000000-0000-4000-8000-000000000001";
const SHARE_ID = "20000000-0000-4000-8000-000000000001";
const PHOTO_1 = "10000000-0000-4000-8000-000000000001";
const PHOTO_2 = "10000000-0000-4000-8000-000000000002";

const summary: AdminShareRecord = {
  id: SHARE_ID,
  albumId: ALBUM_ID,
  slug: "share-slug",
  mode: "public",
  expiresAt: null,
  allowDownload: true,
  allowedQualities: ["original", "web"],
  stripMetadata: null,
  branding: null,
  createdAt: now,
  hasPassword: false,
  photoCount: 0,
  recipientCount: 0,
};

const recipient: AdminRecipientRecord = {
  id: "30000000-0000-4000-8000-000000000001",
  email: "guest@example.com",
  expiresAt: new Date("2026-11-22T10:00:00Z"),
  usedAt: null,
  createdAt: now,
};

function detailRow(overrides: Partial<AdminShareDetailRecord> = {}): AdminShareDetailRecord {
  return { ...summary, photoIds: null, recipients: [], ...overrides };
}

function repository(overrides: Partial<ShareAdminRepository> = {}): ShareAdminRepository {
  return {
    albumOwnedBy: vi.fn(async () => true),
    findOwnedShare: vi.fn(async () => ({
      albumId: ALBUM_ID,
      slug: summary.slug,
      mode: summary.mode,
      hasPassword: false,
    })),
    listByAlbum: vi.fn(async () => [summary]),
    findDetail: vi.fn(async () => detailRow()),
    createShare: vi.fn(async () => SHARE_ID),
    updateShare: vi.fn(async () => {}),
    deleteShare: vi.fn(async () => {}),
    photoIdsInAlbum: vi.fn(async (_albumId, ids) => ids),
    listRecipients: vi.fn(async () => []),
    upsertRecipient: vi.fn(async (_shareId, email) => ({ ...recipient, email })),
    replaceRecipientToken: vi.fn(async () => recipient),
    removeRecipient: vi.fn(async () => {}),
    ...overrides,
  };
}

function build(overrides: Partial<ShareAdminRepository> = {}) {
  const repo = repository(overrides);
  const hashPassword = vi.fn(async (password: string) => `hash:${password}`);
  const service = createShareAdminService({
    repository: repo,
    hashPassword,
    baseUrl: () => "https://gallery.test/",
    now: () => now,
  });

  return { repo, service, hashPassword };
}

describe("list and detail", () => {
  it("rejects an album owned by someone else", async () => {
    const { service } = build({ albumOwnedBy: vi.fn(async () => false) });

    await expect(service.list("user-1", ALBUM_ID)).rejects.toBeInstanceOf(ShareNotFoundError);
  });

  it("maps dates to ISO and a zero subset to null", async () => {
    const { service } = build();

    const shares = await service.list("user-1", ALBUM_ID);

    expect(shares[0]).toMatchObject({
      id: SHARE_ID,
      photoCount: null,
      createdAt: now.toISOString(),
      expiresAt: null,
    });
  });

  it("returns null for a share that is not owned", async () => {
    const { service } = build({ findDetail: vi.fn(async () => null) });

    expect(await service.detail("user-1", SHARE_ID)).toBeNull();
  });
});

describe("create", () => {
  it("hashes the password and keeps the defaults", async () => {
    const { service, repo, hashPassword } = build();

    const result = await service.create("user-1", ALBUM_ID, {
      mode: "password",
      password: "very-secret",
    });

    expect(hashPassword).toHaveBeenCalledWith("very-secret");
    expect(repo.createShare).toHaveBeenCalledWith(
      expect.objectContaining({
        albumId: ALBUM_ID,
        mode: "password",
        passwordHash: "hash:very-secret",
        allowDownload: true,
        allowedQualities: ["original", "web"],
        photoIds: null,
      }),
    );
    expect(result.share.id).toBe(SHARE_ID);
    expect(result.links).toEqual([]);
  });

  it("refuses a password share without a password", async () => {
    const { service } = build();

    await expect(
      service.create("user-1", ALBUM_ID, { mode: "password" }),
    ).rejects.toBeInstanceOf(ShareValidationError);
  });

  it("rejects photos that are not in the album", async () => {
    const { service } = build({
      photoIdsInAlbum: vi.fn(async () => [PHOTO_1]),
    });

    await expect(
      service.create("user-1", ALBUM_ID, {
        mode: "public",
        photoIds: [PHOTO_1, PHOTO_2],
      }),
    ).rejects.toBeInstanceOf(ShareValidationError);
  });

  it("issues one link per recipient and stores only hashes", async () => {
    const { service, repo } = build({
      findDetail: vi.fn(async () => detailRow({ mode: "magic_link", slug: "share-slug" })),
    });

    const result = await service.create("user-1", ALBUM_ID, {
      mode: "magic_link",
      recipients: ["Guest@Example.com", "guest@example.com"],
    });

    expect(repo.upsertRecipient).toHaveBeenCalledTimes(1);
    expect(repo.upsertRecipient).toHaveBeenCalledWith(
      SHARE_ID,
      "guest@example.com",
      expect.stringMatching(/^[0-9a-f]{64}$/),
      expect.any(Date),
    );
    expect(result.links).toHaveLength(1);
    expect(result.links[0].url).toMatch(/^https:\/\/gallery\.test\/s\/share-slug\?token=/);
    expect(result.links[0].expiresAt).toBe("2026-11-22T10:00:00.000Z");
  });

  it("removes a half-created share when recipient issuance fails", async () => {
    const { service, repo } = build({
      findDetail: vi.fn(async () => detailRow({ mode: "magic_link" })),
      upsertRecipient: vi.fn(async () => {
        throw new Error("database went away");
      }),
    });

    await expect(
      service.create("user-1", ALBUM_ID, {
        mode: "magic_link",
        recipients: ["guest@example.com"],
      }),
    ).rejects.toThrow("database went away");

    expect(repo.deleteShare).toHaveBeenCalledWith(SHARE_ID);
  });
});

describe("update", () => {
  it("requires a password when switching to password mode without a hash", async () => {
    const { service } = build();

    await expect(
      service.update("user-1", SHARE_ID, { mode: "password" }),
    ).rejects.toBeInstanceOf(ShareValidationError);
  });

  it("hashes a new password and patches only what was sent", async () => {
    const { service, repo, hashPassword } = build();

    await service.update("user-1", SHARE_ID, {
      mode: "password",
      password: "very-secret",
      allowDownload: false,
    });

    expect(hashPassword).toHaveBeenCalledWith("very-secret");
    expect(repo.updateShare).toHaveBeenCalledWith(SHARE_ID, {
      mode: "password",
      passwordHash: "hash:very-secret",
      expiresAt: undefined,
      allowDownload: false,
      allowedQualities: undefined,
      stripMetadata: undefined,
      branding: undefined,
      photoIds: undefined,
    });
  });

  it("clears the subset with null and validates the ids", async () => {
    const { service, repo } = build();

    await service.setPhotos("user-1", SHARE_ID, null);

    expect(repo.updateShare).toHaveBeenCalledWith(
      SHARE_ID,
      expect.objectContaining({ photoIds: null }),
    );
  });

  it("404s a share that is not owned", async () => {
    const { service } = build({ findOwnedShare: vi.fn(async () => null) });

    await expect(service.update("user-1", SHARE_ID, {})).rejects.toBeInstanceOf(
      ShareNotFoundError,
    );
  });
});

describe("recipients", () => {
  it("refuses to add a recipient to a non magic-link share", async () => {
    const { service } = build();

    await expect(
      service.addRecipient("user-1", SHARE_ID, "guest@example.com"),
    ).rejects.toBeInstanceOf(ShareValidationError);
  });

  it("issues a fresh link for a magic-link share", async () => {
    const { service, repo } = build({
      findOwnedShare: vi.fn(async () => ({
        albumId: ALBUM_ID,
        slug: "share-slug",
        mode: "magic_link" as const,
        hasPassword: false,
      })),
    });

    const link = await service.addRecipient("user-1", SHARE_ID, "guest@example.com");

    expect(repo.upsertRecipient).toHaveBeenCalledTimes(1);
    expect(link.email).toBe("guest@example.com");
    expect(link.url).toContain("/s/share-slug?token=");
  });

  it("404s a recipient that no longer exists when reissuing", async () => {
    const { service } = build({
      findOwnedShare: vi.fn(async () => ({
        albumId: ALBUM_ID,
        slug: "share-slug",
        mode: "magic_link" as const,
        hasPassword: false,
      })),
      replaceRecipientToken: vi.fn(async () => null),
    });

    await expect(
      service.reissueMagicLink("user-1", SHARE_ID, recipient.id),
    ).rejects.toBeInstanceOf(ShareNotFoundError);
  });

  it("removes a recipient only for an owned share", async () => {
    const { service, repo } = build();

    expect(await service.removeRecipient("user-1", SHARE_ID, recipient.id)).toBe(true);
    expect(repo.removeRecipient).toHaveBeenCalledWith(SHARE_ID, recipient.id);

    const { service: foreign } = build({ findOwnedShare: vi.fn(async () => null) });
    expect(await foreign.removeRecipient("user-1", SHARE_ID, recipient.id)).toBe(false);
  });
});

describe("remove", () => {
  it("deletes an owned share and reports a missing one", async () => {
    const { service, repo } = build();

    expect(await service.remove("user-1", SHARE_ID)).toBe(true);
    expect(repo.deleteShare).toHaveBeenCalledWith(SHARE_ID);

    const { service: foreign } = build({ findOwnedShare: vi.fn(async () => null) });
    expect(await foreign.remove("user-1", SHARE_ID)).toBe(false);
  });
});
