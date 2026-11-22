import "server-only";

import type {
  CreateShareInput,
  IssuedMagicLink,
  ShareDetail,
  ShareRecipientSummary,
  ShareSummary,
  UpdateShareInput,
} from "@/contracts/share";

import type {
  AdminRecipientRecord,
  AdminShareDetailRecord,
  AdminShareRecord,
  ShareAdminRepository,
} from "./admin-repository";
import { createShareSlug } from "./slug";
import { createMagicToken, magicLinkUrl, magicTokenExpiry } from "./token";

export class ShareValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShareValidationError";
  }
}

export class ShareNotFoundError extends Error {
  constructor(message = "Share not found.") {
    super(message);
    this.name = "ShareNotFoundError";
  }
}

export interface ShareAdminDeps {
  repository: ShareAdminRepository;
  hashPassword: (password: string) => Promise<string>;
  /** Absolute app URL used to build copyable magic links. */
  baseUrl: () => string;
  now?: () => Date;
}

export interface CreateShareResult {
  share: ShareDetail;
  links: IssuedMagicLink[];
}

export interface ShareAdminService {
  list(ownerUserId: string, albumId: string): Promise<ShareSummary[]>;
  detail(ownerUserId: string, shareId: string): Promise<ShareDetail | null>;
  create(ownerUserId: string, albumId: string, input: CreateShareInput): Promise<CreateShareResult>;
  update(ownerUserId: string, shareId: string, input: UpdateShareInput): Promise<ShareDetail>;
  remove(ownerUserId: string, shareId: string): Promise<boolean>;
  setPhotos(
    ownerUserId: string,
    shareId: string,
    photoIds: string[] | null,
  ): Promise<ShareDetail>;
  addRecipient(ownerUserId: string, shareId: string, email: string): Promise<IssuedMagicLink>;
  removeRecipient(
    ownerUserId: string,
    shareId: string,
    recipientId: string,
  ): Promise<boolean>;
  reissueMagicLink(
    ownerUserId: string,
    shareId: string,
    recipientId: string,
  ): Promise<IssuedMagicLink>;
}

function toRecipient(row: AdminRecipientRecord): ShareRecipientSummary {
  return {
    id: row.id,
    email: row.email,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    usedAt: row.usedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toSummary(row: AdminShareRecord): ShareSummary {
  return {
    id: row.id,
    albumId: row.albumId,
    slug: row.slug,
    mode: row.mode,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    allowDownload: row.allowDownload,
    allowedQualities: row.allowedQualities,
    stripMetadata: row.stripMetadata,
    photoCount: row.photoCount > 0 ? row.photoCount : null,
    recipientCount: row.recipientCount,
    visits: row.visits,
    lastVisitAt: row.lastVisitAt ? new Date(row.lastVisitAt).toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDetail(row: AdminShareDetailRecord): ShareDetail {
  return {
    ...toSummary(row),
    branding: row.branding,
    photoIds: row.photoIds,
    recipients: row.recipients.map(toRecipient),
  };
}

function parseExpiry(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function createShareAdminService(deps: ShareAdminDeps): ShareAdminService {
  function now(): Date {
    return deps.now?.() ?? new Date();
  }

  async function validatePhotoIds(
    albumId: string,
    photoIds: string[] | null | undefined,
  ): Promise<string[] | null> {
    if (photoIds === null || photoIds === undefined || photoIds.length === 0) {
      return null;
    }

    const unique = [...new Set(photoIds)];
    const valid = await deps.repository.photoIdsInAlbum(albumId, unique);
    if (valid.length !== unique.length) {
      throw new ShareValidationError("Some photos do not belong to this album.");
    }
    return unique;
  }

  async function issueLink(
    shareId: string,
    slug: string,
    email: string,
  ): Promise<IssuedMagicLink> {
    const { token, tokenHash } = createMagicToken();
    const expiresAt = magicTokenExpiry(now());
    const recipient = await deps.repository.upsertRecipient(
      shareId,
      email.toLowerCase(),
      tokenHash,
      expiresAt,
    );

    return {
      recipientId: recipient.id,
      email: recipient.email,
      url: magicLinkUrl(deps.baseUrl(), slug, token),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async function updateShare(
    ownerUserId: string,
    shareId: string,
    input: UpdateShareInput,
  ): Promise<ShareDetail> {
    const owned = await deps.repository.findOwnedShare(shareId, ownerUserId);
    if (!owned) {
      throw new ShareNotFoundError();
    }

    const nextMode = input.mode ?? owned.mode;
    if (nextMode === "password" && !owned.hasPassword && !input.password) {
      throw new ShareValidationError("A password share needs a password.");
    }

    const photoIds =
      input.photoIds === undefined
        ? undefined
        : await validatePhotoIds(owned.albumId, input.photoIds);

    const passwordHash = input.password ? await deps.hashPassword(input.password) : undefined;

    await deps.repository.updateShare(shareId, {
      mode: input.mode,
      passwordHash,
      expiresAt: input.expiresAt === undefined ? undefined : parseExpiry(input.expiresAt),
      allowDownload: input.allowDownload,
      allowedQualities: input.allowedQualities,
      stripMetadata: input.stripMetadata,
      branding: input.branding,
      photoIds,
    });

    const detail = await deps.repository.findDetail(shareId, ownerUserId);
    if (!detail) {
      throw new ShareNotFoundError();
    }
    return toDetail(detail);
  }

  return {
    async list(ownerUserId, albumId) {
      const owned = await deps.repository.albumOwnedBy(albumId, ownerUserId);
      if (!owned) {
        throw new ShareNotFoundError("Album not found.");
      }

      const rows = await deps.repository.listByAlbum(albumId, ownerUserId);
      return rows.map(toSummary);
    },

    async detail(ownerUserId, shareId) {
      const row = await deps.repository.findDetail(shareId, ownerUserId);
      return row ? toDetail(row) : null;
    },

    async create(ownerUserId, albumId, input) {
      const owned = await deps.repository.albumOwnedBy(albumId, ownerUserId);
      if (!owned) {
        throw new ShareNotFoundError("Album not found.");
      }

      if (input.mode === "password" && !input.password) {
        throw new ShareValidationError("A password share needs a password.");
      }

      const photoIds = await validatePhotoIds(albumId, input.photoIds);
      const passwordHash = input.password ? await deps.hashPassword(input.password) : null;

      const shareId = await deps.repository.createShare({
        albumId,
        slug: createShareSlug(),
        mode: input.mode,
        passwordHash,
        expiresAt: parseExpiry(input.expiresAt),
        allowDownload: input.allowDownload ?? true,
        allowedQualities: input.allowedQualities ?? ["original", "web"],
        stripMetadata: input.stripMetadata ?? null,
        branding: input.branding ?? null,
        photoIds,
      });

      try {
        const detail = await deps.repository.findDetail(shareId, ownerUserId);
        if (!detail) {
          throw new ShareNotFoundError();
        }

        const links: IssuedMagicLink[] = [];
        if (input.mode === "magic_link" && input.recipients?.length) {
          const emails = [...new Set(input.recipients.map((email) => email.toLowerCase()))];
          for (const email of emails) {
            links.push(await issueLink(shareId, detail.slug, email));
          }
        }

        return { share: toDetail(detail), links };
      } catch (error) {
        // Do not leave a half-created share behind when recipient issuance fails.
        await deps.repository.deleteShare(shareId).catch(() => {});
        throw error;
      }
    },


    async remove(ownerUserId, shareId) {
      const owned = await deps.repository.findOwnedShare(shareId, ownerUserId);
      if (!owned) {
        return false;
      }

      await deps.repository.deleteShare(shareId);
      return true;
    },

    update: updateShare,

    async setPhotos(ownerUserId, shareId, photoIds) {
      return updateShare(ownerUserId, shareId, { photoIds });
    },

    async addRecipient(ownerUserId, shareId, email) {
      const owned = await deps.repository.findOwnedShare(shareId, ownerUserId);
      if (!owned) {
        throw new ShareNotFoundError();
      }
      if (owned.mode !== "magic_link") {
        throw new ShareValidationError("Magic links are only available for magic-link shares.");
      }

      return issueLink(shareId, owned.slug, email);
    },

    async removeRecipient(ownerUserId, shareId, recipientId) {
      const owned = await deps.repository.findOwnedShare(shareId, ownerUserId);
      if (!owned) {
        return false;
      }

      await deps.repository.removeRecipient(shareId, recipientId);
      return true;
    },

    async reissueMagicLink(ownerUserId, shareId, recipientId) {
      const owned = await deps.repository.findOwnedShare(shareId, ownerUserId);
      if (!owned) {
        throw new ShareNotFoundError();
      }
      if (owned.mode !== "magic_link") {
        throw new ShareValidationError("Magic links are only available for magic-link shares.");
      }

      const { token, tokenHash } = createMagicToken();
      const expiresAt = magicTokenExpiry(now());
      const recipient = await deps.repository.replaceRecipientToken(
        shareId,
        recipientId,
        tokenHash,
        expiresAt,
      );
      if (!recipient) {
        throw new ShareNotFoundError("Recipient not found.");
      }

      return {
        recipientId: recipient.id,
        email: recipient.email,
        url: magicLinkUrl(deps.baseUrl(), owned.slug, token),
        expiresAt: expiresAt.toISOString(),
      };
    },
  };
}
